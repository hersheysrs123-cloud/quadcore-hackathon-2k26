"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ARM } from "@/components/visualizations/arm-rig";
import { ARM_MODEL } from "@/components/visualizations/arm-model-meta";
import { clamp } from "@/components/visualizations/scene-kit";

// ─── Our anatomical arm ─────────────────────────────────────────────
// The left upper limb both nerve-and-muscle scenes draw: every bone from
// the clavicle to the fingertips, and the muscles and tendons over them,
// modelled in Blender by scripts/arm-model from Gray's Anatomy plates (no
// third-party mesh). `public/models/arm.glb` holds:
//
//   girdle, humerus, forearm (ulna, radius, carpus)   rigid bones
//   hand      metacarpals and phalanges, posed per finger segment (_seg)
//   biceps    with its tendons; morph "contract" (shorter, fatter)
//   triceps   with its tendon; morph "stretch" (drawn out over the elbow)
//   muscles   everything else; morph "flex" (brachialis, brachioradialis)
//
// The soft tissue is stored at the rest pose (arm hanging, elbow straight)
// and bent on the GPU: each vertex carries how far it turns with the
// humerus and with the forearm (_bend.xy), and turns about the elbow by
// that share of the elbow angle, then about the shoulder. Angles, not
// positions, are blended, so a tendon crossing a joint bends round it
// without pinching while its belly stays put. Anything that reaches into
// the hand also follows the finger segments it lies on (_seg), which is
// how the tendons ride along when the hand grips or points.
//
// Muscles are shaded in the fragment shader: _bend.z says muscle (red,
// fibrous) or tendon (white, silky), _bend.w a per-muscle shade, and the
// rest-pose fibre direction (_fibre) lays fine fascicle striations along
// each muscle, drawn as a bump so they catch the light.
// ─────────────────────────────────────────────────────────────────────

export const ARM_GLB = "/models/arm.glb";
const DEG = Math.PI / 180;

export const ARM_MODEL_COLOURS = {
  bone: "#e8dcc4",
  muscle: "#9c2f3a",
  tendon: "#eceae2",
  active: "#ff5a6e",
  antagonist: "#c24a5c",
  fatigued: "#6e2f66",
  tendonStrained: "#fbbf24",
  tendonDanger: "#fb7185",
};

const HAND = ARM_MODEL.hand;
const NSEG = HAND.segments.length;

// ─── Hand posing ────────────────────────────────────────────────────

const _axis = new THREE.Vector3();
const _rf = new THREE.Matrix4();
const _ra = new THREE.Matrix4();
const _rs = new THREE.Matrix4();
const _t = new THREE.Matrix4();
const _local = new THREE.Matrix4();

/**
 * Segment matrices (forearm frame, rest -> posed) for a blend of two of the
 * model's hand poses ("rest", "relaxed", "grip", "point"): each joint turns
 * about its pivot by the blended flexion, then abduction, then (the thumb's
 * metacarpal, opposing) spin about the bone's own axis, composed down the
 * finger exactly as scripts/arm-model/hand.py does.
 */
export function handMatrices(from, to, t, out) {
  const A = HAND.poses[from] ?? HAND.poses.rest;
  const B = HAND.poses[to] ?? A;
  out[0].identity();
  for (let i = 1; i < NSEG; i += 1) {
    const s = HAND.segments[i];
    const flex = (A[i][0] + (B[i][0] - A[i][0]) * t) * DEG;
    const abd = (A[i][1] + (B[i][1] - A[i][1]) * t) * DEG;
    const spin = ((A[i][2] ?? 0) + ((B[i][2] ?? 0) - (A[i][2] ?? 0)) * t) * DEG;
    _rf.makeRotationAxis(_axis.fromArray(s.flex), flex);
    _ra.makeRotationAxis(_axis.fromArray(s.abd), abd);
    _rf.multiply(_ra);
    if (spin !== 0) _rf.multiply(_rs.makeRotationAxis(_axis.fromArray(s.spin), spin));
    const [px, py, pz] = s.pivot;
    _local.makeTranslation(px, py, pz).multiply(_rf).multiply(_t.makeTranslation(-px, -py, -pz));
    out[i].multiplyMatrices(out[s.parent], _local);
  }
  return out;
}

/** Where a point on a hand segment (forearm frame, rest) is in a pose. */
export function posedHandPoint(point, segment, from, to = from, t = 0) {
  const mats = handMatrices(from, to, t, Array.from({ length: NSEG }, () => new THREE.Matrix4()));
  return new THREE.Vector3(...point).applyMatrix4(mats[segment]).toArray();
}

// ─── Shaders ────────────────────────────────────────────────────────

const NOISE = /* glsl */ `
float armHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float armNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(armHash(i + vec3(0, 0, 0)), armHash(i + vec3(1, 0, 0)), f.x),
                 mix(armHash(i + vec3(0, 1, 0)), armHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(armHash(i + vec3(0, 0, 1)), armHash(i + vec3(1, 0, 1)), f.x),
                 mix(armHash(i + vec3(0, 1, 1)), armHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
vec3 armPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDirection) {
  vec3 sx = normalize(dFdx(surfPos));
  vec3 sy = normalize(dFdy(surfPos));
  vec3 r1 = cross(sy, surfNorm);
  vec3 r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDirection;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
`;

/**
 * Patch a MeshStandardMaterial into one of the arm's materials.
 * kind: "bone" (rigid), "soft" (muscle and tendon, bent), with `seg` when
 * the geometry follows the finger segments; `segOffset` takes the mesh's
 * frame to the forearm's (the soft tissue is in the shoulder frame).
 */
function armShader({ kind, seg, segOffset = 0, uniforms }) {
  return (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const soft = kind === "soft";
    const head = [
      "#include <common>",
      "uniform float uShoulder;",
      "uniform float uElbow;",
      "varying vec3 vRest;",
      soft ? "attribute vec4 _bend;\nattribute vec4 _fibre;\nvarying vec3 vFibre;\nvarying float vTendon;\nvarying float vShade;" : "",
      seg ? `uniform mat4 uSeg[${NSEG}];\nattribute vec4 _seg;` : "",
      "mat2 armTurn(float a) { float c = cos(a); float s = sin(a); return mat2(c, s, -s, c); }",
    ].join("\n");
    const segBlock = (what) =>
      seg
        ? `{
  int sa = int(_seg.x + 0.5);
  int sb = int(_seg.y + 0.5);
  float sw = _seg.z / 255.0;
  ${
    what === "position"
      ? `vec4 sp = vec4(transformed + vec3(0.0, ${segOffset.toFixed(3)}, 0.0), 1.0);
  transformed = mix((uSeg[sa] * sp).xyz, (uSeg[sb] * sp).xyz, sw) - vec3(0.0, ${segOffset.toFixed(3)}, 0.0);`
      : `objectNormal = normalize(mix(mat3(uSeg[sa]) * objectNormal, mat3(uSeg[sb]) * objectNormal, sw));`
  }
}`
        : "";
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", head)
      .replace(
        "#include <defaultnormal_vertex>",
        [
          segBlock("normal"),
          soft ? "objectNormal.xy = armTurn(uShoulder * _bend.x) * (armTurn(uElbow * _bend.y) * objectNormal.xy);" : "",
          "#include <defaultnormal_vertex>",
        ].join("\n"),
      )
      .replace(
        "#include <begin_vertex>",
        ["#include <begin_vertex>", "vRest = position;", soft ? "vFibre = _fibre.xyz; vTendon = _bend.z; vShade = _bend.w;" : ""].join("\n"),
      )
      .replace(
        "#include <project_vertex>",
        [
          segBlock("position"),
          soft
            ? [
                `vec2 elbowAt = vec2(0.0, ${(-ARM.humerus).toFixed(3)});`,
                "transformed.xy = armTurn(uElbow * _bend.y) * (transformed.xy - elbowAt) + elbowAt;",
                "transformed.xy = armTurn(uShoulder * _bend.x) * transformed.xy;",
              ].join("\n")
            : "",
          "#include <project_vertex>",
        ].join("\n"),
      );

    const fhead = [
      "#include <common>",
      "varying vec3 vRest;",
      soft ? "varying vec3 vFibre;\nvarying float vTendon;\nvarying float vShade;\nuniform vec3 uTendonColour;\nuniform float uFibre;" : "",
      NOISE,
      "float armBumpH = 0.0;",
      "float armTendon = 0.0;",
    ].join("\n");
    const colour = soft
      ? /* glsl */ `
#include <color_fragment>
{
  vec3 fd = normalize(vFibre);
  vec3 e1 = normalize(cross(fd, abs(fd.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 e2 = cross(fd, e1);
  vec2 q = vec2(dot(vRest, e1), dot(vRest, e2));
  float along = dot(vRest, fd);
  // fascicles (a couple of mm) and the finer fibres within them
  float fasc = armNoise(vec3(q * 48.0, along * 3.0));
  float fine = armNoise(vec3(q * 150.0, along * 9.0));
  armTendon = smoothstep(0.3, 0.75, vTendon);
  float fib = fasc * 0.65 + fine * 0.35;
  vec3 muscle = diffuseColor.rgb * (0.8 + 0.4 * vShade) * (0.72 + 0.42 * fib);
  vec3 tendon = uTendonColour * (0.9 + 0.12 * fine);
  diffuseColor.rgb = mix(muscle, tendon, armTendon);
  armBumpH = mix(fib, fine * 0.6, armTendon) * uFibre;
}`
      : /* glsl */ `
#include <color_fragment>
{
  float n = armNoise(vRest * 38.0) * 0.6 + armNoise(vRest * 120.0) * 0.4;
  diffuseColor.rgb *= 0.9 + 0.14 * n;
  armBumpH = n * 0.35;
}`;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", fhead)
      .replace("#include <color_fragment>", colour)
      .replace(
        "#include <normal_fragment_maps>",
        ["#include <normal_fragment_maps>", "normal = armPerturb(-vViewPosition, normal, vec2(dFdx(armBumpH), dFdy(armBumpH)) * 0.012, faceDirection);"].join("\n"),
      )
      .replace(
        "#include <emissivemap_fragment>",
        ["#include <emissivemap_fragment>", soft ? "totalEmissiveRadiance *= 1.0 - armTendon;" : ""].join("\n"),
      );
  };
}

function useArmMaterial(key, options, props) {
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial(props);
    m.onBeforeCompile = armShader(options);
    m.customProgramCacheKey = () => key;
    return m;
    // Made once; colours and uniforms are written per frame where they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

// ─── The arm ────────────────────────────────────────────────────────

const C = Object.fromEntries(Object.entries(ARM_MODEL_COLOURS).map(([k, v]) => [k, new THREE.Color(v)]));

/**
 * The modelled arm, driven by the shared rig's pose.
 *
 * poseRef       the arm-rig pose (shoulder and elbow angles)
 * handRef       { from, to, t }: blend of two hand poses (see handMatrices)
 * bicepsState, tricepsState   { activation, fatigue, strain } 0..1 (strain
 *               is a fraction; ~0.04 is a lot): tints the belly, and the
 *               tendons walk from pearl to amber to rose as strain climbs
 * humerusChildren, forearmChildren   rendered inside the rotating groups
 */
export function ModelledArm({ poseRef, handRef, bicepsState, tricepsState, humerusChildren = null, forearmChildren = null }) {
  const { nodes } = useGLTF(ARM_GLB);
  const humerusRef = useRef(null);
  const forearmRef = useRef(null);
  const bicepsRef = useRef(null);
  const tricepsRef = useRef(null);
  const musclesRef = useRef(null);

  const uniforms = useMemo(
    () => ({
      uShoulder: { value: 0 },
      uElbow: { value: 0 },
      uSeg: { value: Array.from({ length: NSEG }, () => new THREE.Matrix4()) },
      uFibre: { value: 1 },
    }),
    [],
  );
  const tendonUniform = (colour) => ({ uTendonColour: { value: new THREE.Color(colour) } });

  const bone = useArmMaterial("arm-bone", { kind: "bone", uniforms }, { color: ARM_MODEL_COLOURS.bone, roughness: 0.58, metalness: 0.0 });
  const handBone = useArmMaterial("arm-hand-bone", { kind: "bone", seg: true, segOffset: 0, uniforms }, { color: ARM_MODEL_COLOURS.bone, roughness: 0.58, metalness: 0.0 });
  const bicepsUniforms = useMemo(() => ({ ...uniforms, ...tendonUniform(ARM_MODEL_COLOURS.tendon) }), [uniforms]);
  const tricepsUniforms = useMemo(() => ({ ...uniforms, ...tendonUniform(ARM_MODEL_COLOURS.tendon) }), [uniforms]);
  const muscleUniforms = useMemo(() => ({ ...uniforms, ...tendonUniform(ARM_MODEL_COLOURS.tendon) }), [uniforms]);
  const softProps = { color: ARM_MODEL_COLOURS.muscle, roughness: 0.46, metalness: 0.0, emissive: "#000000" };
  const biceps = useArmMaterial("arm-soft", { kind: "soft", uniforms: bicepsUniforms }, softProps);
  const triceps = useArmMaterial("arm-soft", { kind: "soft", uniforms: tricepsUniforms }, softProps);
  const muscles = useArmMaterial("arm-soft-seg", { kind: "soft", seg: true, segOffset: ARM.humerus, uniforms: muscleUniforms }, softProps);

  const scratch = useMemo(() => ({ c: new THREE.Color(), t: new THREE.Color() }), []);

  useFrame(() => {
    const pose = poseRef.current;
    if (humerusRef.current) humerusRef.current.rotation.z = pose.humerus.angle;
    if (forearmRef.current) forearmRef.current.rotation.z = pose.elbowDeg * DEG;
    uniforms.uShoulder.value = pose.humerus.angle;
    uniforms.uElbow.value = pose.elbowDeg * DEG;
    const hand = handRef?.current ?? { from: "relaxed", to: "relaxed", t: 0 };
    handMatrices(hand.from, hand.to, hand.t, uniforms.uSeg.value);

    const tint = (material, tendonU, state, activeColour) => {
      const a = clamp(Number(state?.activation) || 0, 0, 1);
      const fatigue = clamp(Number(state?.fatigue) || 0, 0, 1);
      const strain = Math.max(Number(state?.strain) || 0, 0);
      scratch.c.copy(C.muscle).lerp(activeColour, a * 0.85).lerp(C.fatigued, fatigue * 0.6);
      material.color.copy(scratch.c);
      material.emissive.copy(activeColour).multiplyScalar(0.28 * a);
      const warm = clamp(strain / 0.04, 0, 1);
      const danger = clamp((strain - 0.04) / 0.04, 0, 1);
      tendonU.uTendonColour.value.copy(C.tendon).lerp(C.tendonStrained, warm * 0.8).lerp(C.tendonDanger, danger);
      return a;
    };
    const a = tint(biceps, bicepsUniforms, bicepsState?.current, C.active);
    tint(triceps, tricepsUniforms, tricepsState?.current, C.antagonist);

    // A flexed elbow means a shorter, fatter biceps (more so when it works),
    // a drawn-out triceps, and bunched brachialis and brachioradialis.
    const flex = clamp(pose.elbowDeg / 120, 0, 1);
    if (bicepsRef.current?.morphTargetInfluences) bicepsRef.current.morphTargetInfluences[0] = flex * 0.8 + 0.2 * a;
    if (tricepsRef.current?.morphTargetInfluences) tricepsRef.current.morphTargetInfluences[0] = clamp(pose.elbowDeg / 140, 0, 1);
    if (musclesRef.current?.morphTargetInfluences) musclesRef.current.morphTargetInfluences[0] = flex * 0.8;
  });

  const shoulder = poseRef.current.humerus.origin;
  const morph = (node) => ({ morphTargetInfluences: node.morphTargetInfluences, morphTargetDictionary: node.morphTargetDictionary });
  return (
    <group position={[shoulder.x, shoulder.y, shoulder.z]}>
      <mesh geometry={nodes.girdle.geometry} material={bone} />
      <group ref={humerusRef}>
        <mesh geometry={nodes.humerus.geometry} material={bone} />
        {humerusChildren}
        <group ref={forearmRef} position={[0, -ARM.humerus, 0]}>
          <mesh geometry={nodes.forearm.geometry} material={bone} />
          {/* Posed per finger segment in the shader, so its bounds move. */}
          <mesh geometry={nodes.hand.geometry} material={handBone} frustumCulled={false} />
          {forearmChildren}
        </group>
      </group>
      {/* Bent in the shader, so their bounds are the whole reach. */}
      <mesh ref={bicepsRef} geometry={nodes.biceps.geometry} material={biceps} {...morph(nodes.biceps)} frustumCulled={false} />
      <mesh ref={tricepsRef} geometry={nodes.triceps.geometry} material={triceps} {...morph(nodes.triceps)} frustumCulled={false} />
      <mesh ref={musclesRef} geometry={nodes.muscles.geometry} material={muscles} {...morph(nodes.muscles)} frustumCulled={false} />
    </group>
  );
}

"use client";

import { Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { HEART_MODEL_CREDIT } from "@/lib/heartCredits";
import ModelCredits from "@/components/visualizations/ModelCredits";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  clamp,
  hashRandom,
  Callout,
  FitCamera,
  LabelsOn,
  ToggleLabel,
} from "@/components/visualizations/scene-kit";
import { StageCaption, StageCycleDriver } from "@/components/visualizations/stage-stepper";
import { BEAT_VERTEX_BODY, BEAT_VERTEX_HEAD, HEART_GLB, HEART_MODEL, HEART_TISSUE, beatUniforms, deformPoint, makeBeat, setBeatUniforms, weightsAt } from "@/components/visualizations/heart-model";
import {
  CARDIAC_CYCLE,
  EDV_REST,
  ESV_REST,
  beatTime,
  hemodynamicsAtCycle,
  pathologyFor,
  soundMarkers,
  tempoFor,
  wiggersSamples,
} from "@/lib/cardiacCycle";

// ─── The cardiac cycle ──────────────────────────────────────────────
// A real human heart (BodyParts3D, CC BY 4.0: see heart-model.js and
// lib/heartCredits.js) opened along the four-chamber plane like an atlas
// plate: the scanned blood pools of all four chambers inside walls of
// textbook thickness, the scanned tricuspid and mitral leaflets with chordae
// to the scanned papillary muscles, and coronary vessels in their fat. The
// aortic and pulmonary valves really sit in front of this plane, so, as in an
// atlas section, they are not drawn; blood streams into the outflow tracts
// below them. The beat moves the vertices (in the vertex shader):
//
//   · each chamber scales about its centre so its wall keeps its volume —
//     the lining moves by the full amount and the outside less, so a
//     squeezing ventricle visibly thickens;
//   · in systole the AV plane descends ~11 mm towards an apex that barely
//     moves, stretching the atria as they refill;
//   · aortic stenosis thickens the LV wall (concentric hypertrophy) and
//     fibrillation shivers the ventricles.
//
// Everything else hangs off one hemodynamic state per frame
// (`hemodynamicsAtCycle` in `lib/cardiacCycle.js`, read from the stepper's
// clock): the valve leaflets swing by the model's open fraction and their
// chordae follow; blood particles run the inflow and outflow paths at the
// model's flow rates; the conduction system lights up along the real inner
// surfaces as the impulse travels SA → atria → AV → His → bundle branches
// → Purkinje; a ring blooms at the AV valves when they shut (S1). The Wiggers
// panel is ONE beat at the current rate and pathology with a cursor on the
// same clock, and the monitor strip scrolls the live ECG.
// ─────────────────────────────────────────────────────────────────────

const COLOURS = {
  myocardium: HEART_TISSUE.cutMuscle,
  coronaryArtery: "#b3261e",
  coronaryVein: "#4a3560",
  bloodLeft: "#ef4444",
  bloodRight: "#3b82f6",
  leaflet: "#ead2c4",
  chordae: "#f5ede4",
  node: "#fde047",
  conduction: "#fbbf24",
  conductionIdle: "#8a5a1c",
  chaos: "#f97316",
  panel: "#0d121c",
  traceLV: "#f87171",
  traceAo: "#fbbf24",
  traceLA: "#c084fc",
  traceVol: "#38bdf8",
  traceEcg: "#4ade80",
  tracePhono: "#e2e8f0",
  cursor: "#ffffff",
};

/** Where the vessel stumps are cut off: above the atria (rest y) and beyond the left atrium (rest x). */
const VESSEL_TOP = 3.0;
const VESSEL_RIGHT = 3.1;

/** Clip everything to the back of the section: z ≤ 0. */
const SECTION = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.004);

/** Rest point → where the beat has it now. */
function useDeformedPoint(point) {
  return useMemo(() => ({ rest: point, weights: weightsAt(point[0], point[1], point[2]), out: [0, 0, 0] }), [point]);
}
const place = (dp, beat) => deformPoint(dp.rest[0], dp.rest[1], dp.rest[2], dp.weights, beat, dp.out);

// ─── The heart ──────────────────────────────────────────────────────

function EnableLocalClipping() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const was = gl.localClippingEnabled;
    gl.localClippingEnabled = true;
    return () => {
      gl.localClippingEnabled = was;
    };
  }, [gl]);
  return null;
}

/**
 * Wet tissue: the baked vertex colour's alpha is how glistening the surface
 * is (endocardium and epicardium shine, the cut face of muscle is duller),
 * and drives roughness. Alpha is forced back to 1 so nothing turns see-through.
 */
function wetTissue(shader) {
  // The scan's superior vena cava and left pulmonary veins run on past the
  // heart, and their ends, joined only by thin strips of cut wall, floated as
  // loose rings; the vessels are cut off as short stubs instead.
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec2 vRestXY;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRestXY = position.xy;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying vec2 vRestXY;")
    .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n  if (vRestXY.y > ${VESSEL_TOP.toFixed(2)} || vRestXY.x > ${VESSEL_RIGHT.toFixed(2)}) discard;`)
    .replace("#include <color_fragment>", "#include <color_fragment>\n  float wetness = vColor.a;\n  diffuseColor.a = 1.0;")
    .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n  roughnessFactor = mix(0.78, 0.3, wetness);");
}

/**
 * A geometry ready for the GPU beat: the heart mesh's baked weights
 * (`_beat_a`, `_beat_b`) renamed for the shader, or weights computed once
 * from position for the loose parts (the coronary vessels).
 */
function useBeatGeometry(geometry, baked) {
  const g = useMemo(() => {
    const out = geometry.clone();
    if (baked) {
      out.setAttribute("aBeatA", geometry.attributes._beat_a);
      out.setAttribute("aBeatB", geometry.attributes._beat_b);
    } else {
      const p = geometry.attributes.position;
      const a = new Float32Array(p.count * 4);
      const b = new Float32Array(p.count * 4);
      for (let i = 0; i < p.count; i += 1) {
        const w = weightsAt(p.getX(i), p.getY(i), p.getZ(i));
        a.set(w.slice(0, 4), i * 4);
        b[i * 4] = w[4];
      }
      out.setAttribute("aBeatA", new THREE.BufferAttribute(a, 4));
      out.setAttribute("aBeatB", new THREE.BufferAttribute(b, 4));
    }
    // The walls move a little past their rest bounds; don't let culling clip them.
    out.computeBoundingSphere();
    out.boundingSphere.radius *= 1.15;
    return out;
  }, [geometry, baked]);
  useEffect(() => () => g.dispose(), [g]);
  return g;
}

/** onBeforeCompile for a beating mesh: the beat in the vertex shader, plus an optional fragment patch. */
function beatShader(uniforms, fragment) {
  return (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${BEAT_VERTEX_HEAD}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${BEAT_VERTEX_BODY}`);
    fragment?.(shader);
  };
}

/**
 * The scanned heart, opened along the four-chamber plane: muscle, fat,
 * linings and vessel walls in their baked colours, and the coronary
 * arteries and veins on its surface. What lies in front of the cut (the
 * outflow tracts, aortic and pulmonary valves, and great vessels) is left
 * out, as in an atlas section: drawn as x-ray glass it read as a clutter of
 * loose parts over the chambers. (The GLB still carries it as `ghost`.)
 */
function ScannedHeart({ live }) {
  const { nodes } = useGLTF(HEART_GLB);
  const heart = useBeatGeometry(nodes.heart.geometry, true);
  const arteries = useBeatGeometry(nodes.coronaryArteries.geometry, false);
  const veins = useBeatGeometry(nodes.coronaryVeins.geometry, false);
  const uniforms = useMemo(() => beatUniforms(), []);
  const shaders = useMemo(() => ({ wet: beatShader(uniforms, wetTissue), plain: beatShader(uniforms) }), [uniforms]);
  useFrame(() => setBeatUniforms(uniforms, live.current.beat));
  return (
    <group>
      <mesh geometry={heart}>
        <meshPhysicalMaterial vertexColors roughness={0.5} clearcoat={0.55} clearcoatRoughness={0.28} sheen={0.25} sheenColor="#ffcfc4" onBeforeCompile={shaders.wet} customProgramCacheKey={() => "heart-wet"} />
      </mesh>
      <mesh geometry={arteries}>
        <meshPhysicalMaterial color={COLOURS.coronaryArtery} roughness={0.35} clearcoat={0.6} clearcoatRoughness={0.25} clippingPlanes={[SECTION]} onBeforeCompile={shaders.plain} customProgramCacheKey={() => "heart-plain"} />
      </mesh>
      <mesh geometry={veins}>
        <meshPhysicalMaterial color={COLOURS.coronaryVein} roughness={0.35} clearcoat={0.6} clearcoatRoughness={0.25} clippingPlanes={[SECTION]} onBeforeCompile={shaders.plain} customProgramCacheKey={() => "heart-plain"} />
      </mesh>
    </group>
  );
}

/**
 * Where a scanned leaflet hinges and how far it swings, from its own shape.
 * The hinge is its attached rim (the vertices furthest from the valve's
 * axis), the free edge the ones nearest it. The swing is a turn about the
 * rim's tangent, in the plane of the leaflet's radius and the flow, from the
 * pose the scan caught it in to:
 * - shut: the free edge reaching the axis (leaflets meeting), just
 *   downstream of the ring;
 * - open: lying along the flow against the wall, tilted a little inward.
 * The bake's hinge sat at the middle of the valve rather than on the ring,
 * so a fixed turn about it swung the tricuspid out through the RV wall.
 */
function leafletPose(geometry, spec, kind) {
  const f = new THREE.Vector3(...spec.flow).normalize();
  const C = new THREE.Vector3(...spec.centre);
  const pos = geometry.attributes.position;
  const q = new THREE.Vector3();
  const pts = [];
  const mean = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    q.fromBufferAttribute(pos, i).sub(C);
    const radial = q.clone().addScaledVector(f, -q.dot(f));
    pts.push({ p: q.clone().add(C), rad: radial.length() });
    mean.add(radial);
  }
  const r = mean.normalize();
  const a = new THREE.Vector3().crossVectors(r, f).normalize(); // +turn carries r towards f
  pts.sort((u, v) => u.rad - v.rad);
  const band = (from, to) => pts.slice(Math.floor(from * pts.length), Math.max(Math.floor(from * pts.length) + 1, Math.floor(to * pts.length)));
  const avg = (list) => list.reduce((s, x) => s.add(x.p), new THREE.Vector3()).divideScalar(list.length);
  const hinge = avg(band(0.9, 1));
  const freeBand = band(0, 0.1);
  const edgeMid = avg(freeBand);
  const d = edgeMid.clone().sub(hinge);
  const phi0 = Math.atan2(d.dot(f), d.dot(r));
  const length = Math.hypot(d.dot(f), d.dot(r));
  const hingeRad = hinge.clone().sub(C).addScaledVector(f, -hinge.clone().sub(C).dot(f)).length();
  // Shut: the edge meets the axis; if the leaflet is too short, it points straight in.
  const shut = length > hingeRad ? Math.acos(-hingeRad / length) : Math.PI * 0.94;
  const open = Math.atan2(1, kind === "av" ? -0.22 : -0.1);
  // Three points along the free edge for the chordae.
  const byTangent = freeBand.slice().sort((u, v) => u.p.dot(a) - v.p.dot(a));
  const edge = [0.15, 0.5, 0.85].map((t) => byTangent[Math.floor(t * (byTangent.length - 1))].p.toArray());
  const hingeArr = hinge.toArray();
  return {
    hinge: hingeArr,
    edge,
    axisV: a,
    dp: { rest: hingeArr, weights: weightsAt(...hingeArr), out: [0, 0, 0] },
    angleAt: (openness) => shut + (open - shut) * clamp(openness, 0, 1) - phi0,
  };
}

const AV_VALVES = ["tricuspid", "mitral"];

/**
 * One AV valve, from the scan: each leaflet swings about its hinge on the
 * annulus by the model's open fraction, down into the ventricle, and the
 * hinge rides the beating wall. The leaflets are tied to their papillary
 * muscles by chordae tendineae. (The aortic and pulmonary valves sit in
 * front of the section, so they are not drawn.)
 */
function Valve({ live, id }) {
  const { nodes } = useGLTF(HEART_GLB);
  const spec = HEART_MODEL.valves[id];
  const kind = id === "tricuspid" || id === "mitral" ? "av" : "semilunar";
  const outer = useRef([]);
  const inner = useRef([]);
  const glow = useRef(null);
  const chords = useRef(null);
  const hinges = useMemo(() => spec.leaflets.map((_, i) => leafletPose(nodes[`leaflet_${id}_${i}`].geometry, spec, kind)), [nodes, spec, id, kind]);
  const centre = useDeformedPoint(spec.centre);
  const tips = useMemo(
    () =>
      Object.values(HEART_MODEL.papillary)
        .filter((p) => p.valve === id)
        .map((p) => ({ rest: p.tip, weights: weightsAt(...p.tip), out: [0, 0, 0] })),
    [id],
  );
  const chordGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(Math.max(1, hinges.length * 3) * 6), 3));
    return g;
  }, [hinges.length]);
  useEffect(() => () => chordGeometry.dispose(), [chordGeometry]);
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), v: new THREE.Vector3() }), []);

  useFrame(() => {
    const L = live.current;
    const v = L.valves[id];
    hinges.forEach((h, i) => {
      const o = outer.current[i];
      const m = inner.current[i];
      if (!o || !m) return;
      const p = place(h.dp, L.beat);
      o.position.set(p[0], p[1], p[2]);
      m.quaternion.setFromAxisAngle(h.axisV, h.angleAt(v.open));
    });
    const g = glow.current;
    if (g) {
      const c = place(centre, L.beat);
      g.position.set(c[0], c[1], c[2]);
      g.visible = v.sound > 0.05;
      g.scale.setScalar(spec.radius * (0.9 + 1.2 * v.sound));
      g.material.opacity = 0.5 * v.sound;
    }
    const lines = chords.current;
    if (lines) {
      const arr = chordGeometry.attributes.position.array;
      const tipsNow = tips.map((t) => place(t, L.beat).slice());
      let k = 0;
      hinges.forEach((h) => {
        const p = place(h.dp, L.beat);
        tmp.q.setFromAxisAngle(h.axisV, h.angleAt(v.open));
        for (const e of h.edge) {
          tmp.v.set(e[0] - h.hinge[0], e[1] - h.hinge[1], e[2] - h.hinge[2]).applyQuaternion(tmp.q);
          const ex = p[0] + tmp.v.x;
          const ey = p[1] + tmp.v.y;
          const ez = p[2] + tmp.v.z;
          let best = tipsNow[0];
          let bd = Infinity;
          for (const t of tipsNow) {
            const d = (t[0] - ex) ** 2 + (t[1] - ey) ** 2 + (t[2] - ez) ** 2;
            if (d < bd) {
              bd = d;
              best = t;
            }
          }
          arr.set([ex, ey, ez, best[0], best[1], best[2]], k * 6);
          k += 1;
        }
      });
      chordGeometry.attributes.position.needsUpdate = true;
      chordGeometry.computeBoundingSphere();
    }
  });

  return (
    <>
      {hinges.map((h, i) => (
        <group key={i} ref={(el) => (outer.current[i] = el)} position={h.hinge}>
          <group ref={(el) => (inner.current[i] = el)}>
            <mesh geometry={nodes[`leaflet_${id}_${i}`].geometry} position={[-h.hinge[0], -h.hinge[1], -h.hinge[2]]}>
              <meshPhysicalMaterial color={COLOURS.leaflet} roughness={0.42} clearcoat={0.5} side={THREE.DoubleSide} clippingPlanes={[SECTION]} />
            </mesh>
          </group>
        </group>
      ))}
      {/* The sound: a ring of light that blooms as the leaflets slam shut. */}
      <mesh ref={glow} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...spec.flow))}>
        <ringGeometry args={[0.8, 1, 40]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <lineSegments ref={chords} geometry={chordGeometry} frustumCulled={false}>
        <lineBasicMaterial color={COLOURS.chordae} transparent opacity={0.9} clippingPlanes={[SECTION]} />
      </lineSegments>
    </>
  );
}

// ─── Blood ──────────────────────────────────────────────────────────

const M = HEART_MODEL;
const V = M.valves;
/** Where the superior vena cava rises out of the right atrium on the cut face (its centroid is in front of the cut). */
const SVC_IN_SECTION = [-0.25, 2.6, -0.3];
/** Nudge a point just behind the section, so particles run inside the opened cavities. */
const behind = (p, z = -0.35) => [p[0], p[1], Math.min(p[2], z)];

/** Blood paths through the real chambers and valves, from the veins to the outflow tracts. */
const STREAMS = [
  { key: "svc", points: [SVC_IN_SECTION.map((c, k) => (k === 1 ? c + 0.35 : c)), [-0.45, 2.2, -0.35], behind(M.chambers.ra)], colour: COLOURS.bloodRight, drive: "venous", count: 9 },
  { key: "ivc", points: [M.vessels.ivc, [-1.3, 0.2, -1.6], behind(M.chambers.ra)], colour: COLOURS.bloodRight, drive: "venous", count: 8 },
  { key: "tricuspid", points: [behind(M.chambers.ra), behind(V.tricuspid.centre), behind(M.chambers.rv)], colour: COLOURS.bloodRight, drive: "av", count: 14 },
  // Outflow: towards the pulmonary and aortic valves, which sit just in front of the cut.
  { key: "pulmonary", points: [behind(M.chambers.rv), behind(V.pulmonary.centre, -0.1)], colour: COLOURS.bloodRight, drive: "semilunar", count: 12 },
  { key: "pvl", points: [behind(M.vessels.lspv2), behind(M.chambers.la)], colour: COLOURS.bloodLeft, drive: "venous", count: 6 },
  { key: "pvl2", points: [M.vessels.lipv3, behind(M.chambers.la)], colour: COLOURS.bloodLeft, drive: "venous", count: 6 },
  { key: "pvr", points: [M.vessels.rspv, behind(M.chambers.la)], colour: COLOURS.bloodLeft, drive: "venous", count: 6 },
  { key: "mitral", points: [behind(M.chambers.la), behind(V.mitral.centre), behind(M.chambers.lv)], colour: COLOURS.bloodLeft, drive: "av", count: 14 },
  { key: "aorta", points: [behind(M.chambers.lv), behind(V.aortic.centre, -0.1)], colour: COLOURS.bloodLeft, drive: "semilunar", count: 12 },
];

/** Particles running one path at the model's flow rate, carried with the beating walls. */
function BloodStream({ live, stream }) {
  const ref = useRef(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(stream.points.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.4), [stream.points]);
  const state = useRef({ dummy: new THREE.Object3D(), point: new THREE.Vector3(), out: [0, 0, 0], phases: Array.from({ length: stream.count }, (_, i) => (i + hashRandom(i * 2.3 + 5) * 0.6) / stream.count), speed: 0 });

  useFrame((_, rawDelta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const L = live.current;
    const s = state.current;
    const dt = Math.min(rawDelta, 1 / 30);
    const flow = L.flows[stream.drive];
    // Ease the speed so a valve snapping shut stops the stream over a few frames.
    s.speed += (flow - s.speed) * (1 - Math.exp(-dt * 12));
    const visible = s.speed > 0.03;
    mesh.visible = visible;
    if (!visible) return;
    const rate = (stream.drive === "venous" ? 0.3 : 0.75) * s.speed * L.speed;
    for (let i = 0; i < stream.count; i += 1) {
      s.phases[i] = (s.phases[i] + rate * dt) % 1;
      curve.getPointAt(s.phases[i], s.point);
      deformPoint(s.point.x, s.point.y, s.point.z, weightsAt(s.point.x, s.point.y, s.point.z), L.beat, s.out);
      s.dummy.position.set(s.out[0], s.out[1], s.out[2]);
      const fade = Math.sin(Math.PI * s.phases[i]);
      s.dummy.scale.setScalar(0.05 * (0.6 + 0.6 * fade) * (0.5 + 0.5 * s.speed));
      s.dummy.updateMatrix();
      mesh.setMatrixAt(i, s.dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, stream.count]} frustumCulled={false} renderOrder={6}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshStandardMaterial color={stream.colour} emissive={stream.colour} emissiveIntensity={0.9} roughness={0.4} toneMapped={false} />
    </instancedMesh>
  );
}

// ─── Conduction ─────────────────────────────────────────────────────

/**
 * The conduction system, baked onto the scan's inner walls (heart-model-meta):
 *   SA node   in the right atrial wall where the SVC enters
 *   atria     over the right atrium to the AV node; Bachmann's bundle across the roof
 *   AV node   on the right atrial floor by the septum (the triangle of Koch)
 *   His       to the crest of the interventricular septum
 *   branches  down each face of the septum; the right one crosses the
 *             moderator band to the anterior papillary muscle
 *   Purkinje  round the apex and up the free walls
 */
const PATHS = M.conduction.paths;

/** A tube along baked points that deforms with the beat and is revealed along its length by `progress`. */
function ConductionPath({ live, points, pick, radius = 0.028 }) {
  const ref = useRef(null);
  const built = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.35);
    const idle = new THREE.TubeGeometry(curve, 72, radius, 8, false);
    const lit = idle.clone();
    const rest = new Float32Array(idle.attributes.position.array);
    const n = rest.length / 3;
    const weights = new Float32Array(n * 6);
    for (let i = 0; i < n; i += 1) {
      const w = weightsAt(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]);
      for (let k = 0; k < 6; k += 1) weights[i * 6 + k] = w[k];
    }
    return { idle, lit, rest, weights };
  }, [points, radius]);
  useEffect(
    () => () => {
      built.idle.dispose();
      built.lit.dispose();
    },
    [built],
  );
  const total = built.lit.index ? built.lit.index.count : 0;
  const out = useMemo(() => [0, 0, 0], []);
  const wv = useMemo(() => [0, 0, 0, 0, 0, 0], []);

  useFrame(() => {
    const L = live.current;
    const { rest, weights } = built;
    const a = built.idle.attributes.position.array;
    const b = built.lit.attributes.position.array;
    for (let i = 0; i < rest.length / 3; i += 1) {
      for (let k = 0; k < 6; k += 1) wv[k] = weights[i * 6 + k];
      deformPoint(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2], wv, L.beat, out);
      a[i * 3] = b[i * 3] = out[0];
      a[i * 3 + 1] = b[i * 3 + 1] = out[1];
      a[i * 3 + 2] = b[i * 3 + 2] = out[2];
    }
    built.idle.attributes.position.needsUpdate = true;
    built.lit.attributes.position.needsUpdate = true;
    const m = ref.current;
    if (!m) return;
    const progress = clamp(pick(L.conduction), 0, 1);
    const shown = Math.max(0, Math.floor((total / 6) * progress) * 6);
    m.geometry.setDrawRange(0, shown);
    m.visible = shown > 0;
    m.material.emissiveIntensity = progress > 0 && progress < 1 ? 2.6 : 1.4;
  });

  return (
    <group>
      <mesh geometry={built.idle}>
        <meshStandardMaterial color={COLOURS.conductionIdle} emissive={COLOURS.conductionIdle} emissiveIntensity={0.35} roughness={0.6} clippingPlanes={[SECTION]} />
      </mesh>
      <mesh ref={ref} geometry={built.lit}>
        <meshStandardMaterial color={COLOURS.conduction} emissive={COLOURS.conduction} emissiveIntensity={1.4} toneMapped={false} clippingPlanes={[SECTION]} />
      </mesh>
    </group>
  );
}

function Node({ live, pick, position, radius = 0.1 }) {
  const ref = useRef(null);
  const dp = useDeformedPoint(position);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const L = live.current;
    const p = place(dp, L.beat);
    m.position.set(p[0], p[1], p[2]);
    const a = clamp(pick(L.conduction), 0, 1);
    m.scale.setScalar(1 + 0.9 * a);
    m.material.emissiveIntensity = 0.4 + 2.4 * a;
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[radius, 16, 12]} />
      <meshStandardMaterial color={COLOURS.node} emissive={COLOURS.node} emissiveIntensity={0.4} toneMapped={false} />
    </mesh>
  );
}

/** Fibrillation: sparks all over the ventricular walls, no order to them. */
function ChaosSparks({ live }) {
  const ref = useRef(null);
  const seats = useMemo(() => M.conduction.seats.map((p, i) => ({ p, w: weightsAt(...p), phase: hashRandom(i * 3.3 + 7) * 20, rate: 6 + 8 * hashRandom(i * 4.1 + 9) })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const out = useMemo(() => [0, 0, 0], []);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const L = live.current;
    const chaos = L.conduction.chaos;
    mesh.visible = chaos > 0.02;
    if (!mesh.visible) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < seats.length; i += 1) {
      const s = seats[i];
      deformPoint(s.p[0], s.p[1], s.p[2], s.w, L.beat, out);
      const flick = Math.max(0, Math.sin(t * s.rate + s.phase)) ** 6;
      dummy.position.set(out[0], out[1], out[2]);
      dummy.scale.setScalar(0.05 + 0.14 * flick * chaos);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, seats.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial color={COLOURS.chaos} emissive={COLOURS.chaos} emissiveIntensity={2} toneMapped={false} clippingPlanes={[SECTION]} />
    </instancedMesh>
  );
}

// ─── Traces ─────────────────────────────────────────────────────────

/** A polyline with a fixed vertex budget whose positions are written in place. */
function useTraceGeometry(n) {
  const built = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(n * 3);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { geometry, positions };
  }, [n]);
  useEffect(() => () => built.geometry.dispose(), [built]);
  return built;
}

const PANEL = { width: 5.1, height: 5.3 };
const PANEL_STAGE_NAMES = { atrialSystole: "Atrial", isoContraction: "Iso-contraction", ejection: "Ejection", isoRelaxation: "Iso-relaxation", filling: "Filling" };
const STRIP = { width: 5.1, height: 0.75, samples: 360, seconds: 3 };

const ROWS = {
  pressure: { y0: 3.05, h: 1.65, min: 0, max: 200 },
  volume: { y0: 1.75, h: 1.0, min: 30, max: 130 },
  ecg: { y0: 0.7, h: 0.85, min: -0.5, max: 1.7 },
  phono: { y0: 0.05, h: 0.45, min: 0, max: 1 },
};

/** One static trace of the sampled beat, rewritten when the samples change. */
function StaticTrace({ samples, pick, row, colour, width = PANEL.width }) {
  const built = useTraceGeometry(samples.length);
  useEffect(() => {
    const r = ROWS[row];
    const p = built.positions;
    for (let i = 0; i < samples.length; i += 1) {
      const s = samples[i];
      p[i * 3] = s.fraction * width;
      p[i * 3 + 1] = r.y0 + clamp((pick(s) - r.min) / (r.max - r.min), 0, 1) * r.h;
      p[i * 3 + 2] = 0.01;
    }
    built.geometry.attributes.position.needsUpdate = true;
    built.geometry.computeBoundingSphere();
  }, [samples, pick, row, width, built]);
  return (
    <line geometry={built.geometry}>
      <lineBasicMaterial color={colour} toneMapped={false} />
    </line>
  );
}

/** Vertical marker lines with labels: stage boundaries and S1 / S2. */
function Marker({ x, y0, h, colour, label, tone, dashed = false }) {
  const built = useTraceGeometry(2);
  useEffect(() => {
    const p = built.positions;
    p.set([x, y0, 0.005, x, y0 + h, 0.005]);
    built.geometry.attributes.position.needsUpdate = true;
    built.geometry.computeBoundingSphere();
  }, [x, y0, h, built]);
  return (
    <group>
      <line geometry={built.geometry}>
        <lineBasicMaterial color={colour} transparent opacity={dashed ? 0.35 : 0.9} toneMapped={false} />
      </line>
      {label && (
        <ToggleLabel position={[x, y0 + h + 0.18, 0]} tone={tone}>
          {label}
        </ToggleLabel>
      )}
    </group>
  );
}

/** The Wiggers diagram: pressures, volume, ECG and phonocardiogram over one beat, with a cursor on the live clock. */
function WiggersPanel({ live, bpm, pathology, position, scale }) {
  const data = useMemo(() => wiggersSamples(bpm, pathology, 240), [bpm, pathology]);
  const markers = useMemo(() => soundMarkers(bpm), [bpm]);
  const cursor = useRef(null);
  const picks = useMemo(
    () => ({
      lv: (s) => s.pLV,
      ao: (s) => s.pAo,
      la: (s) => s.pLA,
      vol: (s) => s.vLV,
      ecg: (s) => s.ecg,
      phono: (s) => s.sound,
    }),
    [],
  );
  useFrame(() => {
    const c = cursor.current;
    if (!c) return;
    c.position.x = live.current.beatFraction * PANEL.width;
  });
  const tl = data.timeline;
  const boundaries = CARDIAC_CYCLE.stages.map((s) => ({ key: s.key, x: (tl.starts[s.key] / tl.period) * PANEL.width }));
  // Each phase is named over the middle of its own span; the two short
  // isovolumetric phases go under the panel so no two names collide.
  const spans = CARDIAC_CYCLE.stages.map((s) => ({ key: s.key, mid: ((tl.starts[s.key] + tl.durations[s.key] / 2) / tl.period) * PANEL.width, text: PANEL_STAGE_NAMES[s.key], below: s.key.startsWith("iso") }));
  const summary = data.summary;

  return (
    <group position={position} scale={scale}>
      <mesh position={[PANEL.width / 2, PANEL.height / 2 - 0.15, -0.05]}>
        <planeGeometry args={[PANEL.width + 0.6, PANEL.height + 0.7]} />
        <meshBasicMaterial color={COLOURS.panel} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <ToggleLabel position={[PANEL.width / 2, PANEL.height + 0.2, 0]} accent>
        {`Wiggers diagram · one beat at ${Math.round(tl.bpm)} bpm · ${tl.period.toFixed(2)} s`}
      </ToggleLabel>

      {/* Stage boundaries, and each phase named over its span. */}
      {boundaries.map((b) => (
        <Marker key={b.key} x={b.x} y0={0} h={PANEL.height - 0.3} colour={PALETTE.slate} dashed />
      ))}
      {spans.map((sp) => (
        <ToggleLabel key={`${sp.key}-name`} position={[sp.mid, sp.below ? -0.3 : PANEL.height - 0.42, 0]} tone="text-ink-500">
          {sp.text}
        </ToggleLabel>
      ))}

      {/* Pressure row. */}
      <StaticTrace samples={data.samples} pick={picks.lv} row="pressure" colour={COLOURS.traceLV} />
      <StaticTrace samples={data.samples} pick={picks.ao} row="pressure" colour={COLOURS.traceAo} />
      <StaticTrace samples={data.samples} pick={picks.la} row="pressure" colour={COLOURS.traceLA} />
      <ToggleLabel position={[-0.55, ROWS.pressure.y0 + ROWS.pressure.h, 0]} tone="text-rose-300">
        {`${ROWS.pressure.max} mmHg`}
      </ToggleLabel>
      <ToggleLabel position={[PANEL.width + 0.5, ROWS.pressure.y0 + ROWS.pressure.h * 0.78, 0]} tone="text-rose-300">
        LV
      </ToggleLabel>
      <ToggleLabel position={[PANEL.width + 0.5, ROWS.pressure.y0 + ROWS.pressure.h * 0.52, 0]} tone="text-amber-300">
        aorta
      </ToggleLabel>
      <ToggleLabel position={[PANEL.width + 0.5, ROWS.pressure.y0 + ROWS.pressure.h * 0.1, 0]} tone="text-violet-300">
        LA
      </ToggleLabel>

      {/* Volume row. */}
      <StaticTrace samples={data.samples} pick={picks.vol} row="volume" colour={COLOURS.traceVol} />
      <ToggleLabel position={[-0.55, ROWS.volume.y0 + ROWS.volume.h, 0]} tone="text-sky-300">
        {`${ROWS.volume.max} mL`}
      </ToggleLabel>
      <ToggleLabel position={[PANEL.width + 0.5, ROWS.volume.y0 + ROWS.volume.h * 0.5, 0]} tone="text-sky-300">
        {`LV vol · SV ${Math.round(summary.strokeVolume)}`}
      </ToggleLabel>

      {/* ECG row. */}
      <StaticTrace samples={data.samples} pick={picks.ecg} row="ecg" colour={COLOURS.traceEcg} />
      <ToggleLabel position={[PANEL.width + 0.5, ROWS.ecg.y0 + ROWS.ecg.h * 0.5, 0]} tone="text-emerald-300">
        ECG
      </ToggleLabel>

      {/* Phonocardiogram row with S1 / S2 markers. */}
      <StaticTrace samples={data.samples} pick={picks.phono} row="phono" colour={COLOURS.tracePhono} />
      {pathology !== "vfib" && (
        <>
          <Marker x={markers.s1 * PANEL.width} y0={ROWS.phono.y0} h={ROWS.phono.h} colour={COLOURS.tracePhono} label="S1 · lub" tone="text-ink-100" />
          <Marker x={markers.s2 * PANEL.width} y0={ROWS.phono.y0} h={ROWS.phono.h} colour={COLOURS.tracePhono} label="S2 · dub" tone="text-ink-100" />
        </>
      )}
      <ToggleLabel position={[PANEL.width + 0.5, ROWS.phono.y0 + ROWS.phono.h * 0.5, 0]} tone="text-ink-300">
        sounds
      </ToggleLabel>

      {/* The cursor: where the heart is now. */}
      <mesh ref={cursor} position={[0, (PANEL.height - 0.3) / 2, 0.02]}>
        <planeGeometry args={[0.03, PANEL.height - 0.3]} />
        <meshBasicMaterial color={COLOURS.cursor} transparent opacity={0.85} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** A monitor strip: the last few seconds of ECG scrolling left. */
function EcgStrip({ live, position, scale }) {
  const built = useTraceGeometry(STRIP.samples);
  const ring = useRef({ values: new Float32Array(STRIP.samples), head: 0, acc: 0 });
  const perSample = STRIP.seconds / STRIP.samples;

  useFrame((_, rawDelta) => {
    const r = ring.current;
    const dt = Math.min(rawDelta, 1 / 30) * live.current.speed;
    r.acc += dt;
    const v = live.current.ecg;
    while (r.acc >= perSample) {
      r.acc -= perSample;
      r.values[r.head] = v;
      r.head = (r.head + 1) % STRIP.samples;
    }
    const p = built.positions;
    for (let i = 0; i < STRIP.samples; i += 1) {
      const idx = (r.head + i) % STRIP.samples;
      p[i * 3] = (i / (STRIP.samples - 1)) * STRIP.width;
      p[i * 3 + 1] = clamp((r.values[idx] + 0.5) / 2.2, 0, 1) * STRIP.height;
      p[i * 3 + 2] = 0.01;
    }
    built.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <group position={position} scale={scale}>
      <mesh position={[STRIP.width / 2, STRIP.height / 2, -0.05]}>
        <planeGeometry args={[STRIP.width + 0.6, STRIP.height + 0.5]} />
        <meshBasicMaterial color="#04140a" transparent opacity={0.92} depthWrite={false} />
      </mesh>
      <line geometry={built.geometry} frustumCulled={false}>
        <lineBasicMaterial color={COLOURS.traceEcg} toneMapped={false} />
      </line>
      <ToggleLabel position={[STRIP.width / 2, STRIP.height + 0.3, 0]} tone="text-emerald-300">
        {`live ECG · last ${STRIP.seconds} s`}
      </ToggleLabel>
    </group>
  );
}

// ─── Choreography ───────────────────────────────────────────────────

function makeLiveBag() {
  return {
    h: null,
    speed: 1,
    vfT: 0,
    beatFraction: 0,
    ecg: 0,
    beat: makeBeat(),
    valves: { tricuspid: { open: 1, sound: 0 }, mitral: { open: 1, sound: 0 }, pulmonary: { open: 0, sound: 0 }, aortic: { open: 0, sound: 0 } },
    flows: { venous: 0.5, av: 0, semilunar: 0 },
    conduction: { sa: 0, atria: 0, av: 0, his: 0, purkinje: 0, chaos: 0 },
  };
}

/** How far the AV plane drops towards the apex at full ejection: 0.55 units ≈ 11 mm (normal is 10–15 mm). */
const AV_DESCENT = 0.55;

function choreograph(live, snap, bpm, pathology, speed, clock) {
  const vf = pathology === "vfib";
  live.speed = speed;
  live.vfT = vf ? live.vfT + snap.dt * speed : 0;
  const h = hemodynamicsAtCycle(snap.t, bpm, pathology, { vfTime: live.vfT });
  live.h = h;
  live.ecg = h.ecg;
  live.beatFraction = beatTime(bpm, snap.t) / h.summary.period;

  const beat = live.beat;
  const quiver = vf ? 0.025 * Math.sin(clock * 38) * h.quiver : 0;
  // The mesh is the heart at end-diastole (resting EDV); cavities scale with the volume.
  const ventricle = Math.cbrt(clamp(h.vLV, 20, 140) / EDV_REST) * (1 + quiver);
  beat.lv = ventricle;
  beat.rv = ventricle;
  beat.la = (1 - 0.14 * h.atrialSqueeze) * (1 + 0.06 * h.ventricularSqueeze);
  beat.ra = beat.la;
  beat.descent = vf ? 0 : AV_DESCENT * clamp((EDV_REST - h.vLV) / (EDV_REST - ESV_REST), 0, 1.2);
  beat.hyper = pathology === "stenosis" ? 1 : 0;
  beat.jitter[0] = vf ? 0.018 * Math.sin(clock * 41) : 0;
  beat.jitter[1] = vf ? 0.018 * Math.cos(clock * 37) : 0;

  live.valves.tricuspid.open = h.valves.tricuspid;
  live.valves.mitral.open = h.valves.mitral;
  live.valves.pulmonary.open = h.valves.pulmonary;
  live.valves.aortic.open = h.valves.aortic;
  live.valves.tricuspid.sound = h.sounds.s1;
  live.valves.mitral.sound = h.sounds.s1;
  live.valves.pulmonary.sound = h.sounds.s2;
  live.valves.aortic.sound = h.sounds.s2 + 0.5 * h.sounds.murmur;
  live.flows.venous = vf ? 0.15 : 0.35 + 0.3 * h.ventricularSqueeze;
  live.flows.av = h.flow.av;
  live.flows.semilunar = h.flow.semilunar;
  Object.assign(live.conduction, h.conduction);
}

// ─── Labels ─────────────────────────────────────────────────────────

/**
 * Callouts in two columns beside the heart: the right heart (and the
 * conduction system, which starts there) on the viewer's left, the left
 * heart on the viewer's right. Anchors are rest positions.
 */
const LEFT_X = -3.45;
const RIGHT_X = 4.35;
const at = (p, z) => [p[0], p[1], z ?? p[2]];
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const row = (i) => 3.85 - i * 0.72;
const withRows = (list) => list.map((c, i) => ({ ...c, y: row(i) }));
const RIGHT_HEART = withRows([
  { key: "svc", anchor: SVC_IN_SECTION, text: "Superior vena cava", tone: "text-sky-300" },
  { key: "sa", anchor: M.conduction.sa, text: "SA node · pacemaker", tone: "text-amber-300" },
  { key: "ra", anchor: at(M.chambers.ra, -0.5), text: "Right atrium", tone: "text-sky-200" },
  { key: "tri", anchor: at(V.tricuspid.centre, -0.3), text: "Tricuspid valve", tone: "text-ink-200" },
  { key: "av", anchor: M.conduction.av, text: "AV node → bundle of His", tone: "text-amber-300" },
  // The pulmonary valve sits just in front of the cut: point into the outflow tract below it.
  { key: "pv", anchor: behind(V.pulmonary.centre, -0.3), text: "→ pulmonary valve · lungs", tone: "text-sky-300" },
  { key: "rv", anchor: at(M.chambers.rv, -0.5), text: "Right ventricle", tone: "text-sky-200" },
  { key: "mod", anchor: PATHS.rightBranch[3], text: "Moderator band", tone: "text-ink-300" },
  { key: "purk", anchor: PATHS.rightApical[2], text: "Purkinje fibres", tone: "text-amber-300" },
  { key: "ivc", anchor: M.vessels.ivc, text: "Inferior vena cava", tone: "text-sky-300" },
]);
const LEFT_HEART = withRows([
  // The descending aorta runs behind the left atrium, in the section.
  { key: "ao", anchor: [2.6, 1.0, -0.66], text: "Descending aorta", tone: "text-rose-300" },
  { key: "pvs", anchor: M.vessels.lipv3, text: "Pulmonary veins", tone: "text-rose-300" },
  { key: "la", anchor: at(M.chambers.la, -0.5), text: "Left atrium", tone: "text-rose-200" },
  { key: "mit", anchor: at(V.mitral.centre, -0.3), text: "Mitral (bicuspid) valve", tone: "text-ink-200" },
  // The aortic valve sits just in front of the cut: point into the outflow tract below it.
  { key: "aov", anchor: behind(V.aortic.centre, -0.3), text: "→ aortic valve · body", tone: "text-rose-300" },
  { key: "lv", anchor: at(M.chambers.lv, -0.5), text: "Left ventricle · thickest wall", tone: "text-rose-200" },
  { key: "pap", anchor: M.papillary.lvLateral.tip, text: "Papillary muscle · chordae", tone: "text-ink-300" },
  { key: "sep", anchor: mid(PATHS.leftBranch[2], PATHS.rightBranch[2]), text: "Interventricular septum", tone: "text-ink-300" },
  { key: "cor", anchor: [1.9, -1.7, -0.4], text: "Coronary vessels · epicardial fat", tone: "text-ink-300" },
  { key: "apex", anchor: at(M.apex, -0.4), text: "Apex", tone: "text-ink-300" },
]);

function Labels({ h, pathology, snapshot, bottom }) {
  const stenosis = pathology === "stenosis";
  return (
    <>
      {RIGHT_HEART.map((c) => {
        return (
          <Callout key={c.key} anchor={c.anchor} at={[LEFT_X, c.y, 0]} side="left" tone={c.tone}>
            {c.text}
          </Callout>
        );
      })}
      {LEFT_HEART.map((c) => (
        <Callout key={c.key} anchor={c.anchor} at={[RIGHT_X, c.y, 0]} side="right" tone={c.key === "aov" && stenosis ? "text-amber-300" : c.tone}>
          {c.key === "aov" && stenosis ? "→ aortic valve · STENOTIC (narrowed)" : c.key === "lv" && stenosis ? "Left ventricle · hypertrophied" : c.text}
        </Callout>
      ))}
      {h && (
        <ToggleLabel position={[0.1, bottom + 0.45, 0.3]} tone={pathology === "vfib" ? "text-orange-300" : "text-amber-200"}>
          {h.sounds.s1 > 0.45
            ? "S1 · 'lub' — tricuspid & mitral shut"
            : h.sounds.s2 > 0.45
              ? "S2 · 'dub' — aortic & pulmonary shut"
              : h.sounds.murmur > 0.35
                ? "ejection murmur — turbulent jet through the narrowed valve"
                : h.conduction.label}
        </ToggleLabel>
      )}
      <StageCaption position={[0.1, bottom, 0.3]} snapshot={snapshot} />
    </>
  );
}

// ─── Layout ─────────────────────────────────────────────────────────

/**
 * Wide canvases put the Wiggers panel beside the heart; narrow ones stack
 * it underneath, so the heart never shrinks to a thumbnail.
 */
/** The widest right-column callout, in CSS px ("Coronary vessels · epicardial fat"). */
const CALLOUT_PX = 165;

function useLayout() {
  const size = useThree((s) => s.size);
  const labelsOn = useContext(LabelsOn);
  return useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    // Callouts are a fixed width in pixels, so on a narrow canvas they cover
    // more of the scene. r is one column's share of the view's width W; the
    // left column needs the view's left edge 0.3 + r·W past LEFT_X, the right
    // column needs the panel 1.1 + r·W past RIGHT_X (clear of the panel's own
    // left-hand tags), and the panel (with its
    // own tags) takes 7.65. Solving W = left + right + 7.65 gives W below.
    const r = labelsOn ? CALLOUT_PX / Math.max(1, size.width) : 0;
    const wide = aspect > 1.2 && r < 0.25;
    const k = 1.15;
    if (wide) {
      const span = Math.max(21.6, (-LEFT_X + 0.3 + RIGHT_X + 1.1 + 7.65) / (1 - 2 * r));
      const left = Math.max(6.05, -LEFT_X + 0.3 + r * span);
      const px = Math.max(7.9, RIGHT_X + 1.1 + r * span);
      const right = px + 7.65;
      return {
        wide,
        panel: { position: [px, -2.55, 0], scale: k },
        strip: { position: [px, -4.1, 0], scale: [k, k, 1] },
        view: { cx: (right - left) / 2, cy: 0.05, width: right + left, height: 9.6, depth: 2.4 },
        bottom: -4.35,
      };
    }
    // Stacked: the panel at its natural size under the heart, the strip under that.
    return {
      wide,
      panel: { position: [0.45 - PANEL.width / 2, -11.0, 0], scale: 1 },
      strip: { position: [0.45 - STRIP.width / 2, -12.8, 0], scale: [1, 1, 1] },
      view: { cx: 0.45, cy: -4.35, width: 13.6, height: 18.2, depth: 2.4 },
      bottom: -4.35,
    };
  }, [size.width, size.height, labelsOn]);
}

// ─── The scene ──────────────────────────────────────────────────────

function CardiacScene({ params, setParam }) {
  const { bpm = 75, pathology: pathologyParam = "normal", stage = 0, playing = true, speed = 1 } = params || {};
  const pathology = pathologyFor(pathologyParam).key;
  const rate = clamp(Number(bpm) || 75, 40, 180);
  const tempo = useMemo(() => tempoFor(rate), [rate]);
  const live = useRef(null);
  if (live.current === null) live.current = makeLiveBag();
  const stepperLive = useRef(null);
  const [snapshot, setSnapshot] = useState(null);
  const [h, setH] = useState(null);
  const pushed = useRef({ progress: -1, vf: -1 });
  const layout = useLayout();

  // Reset the fibrillation clock when the rhythm changes.
  useEffect(() => {
    live.current.vfT = 0;
  }, [pathology]);

  const onFrame = useCallback(
    (snap) => {
      choreograph(live.current, snap, rate, pathology, speed, performance.now() / 1000);
    },
    [rate, pathology, speed],
  );
  const onTick = useCallback(
    (snap) => {
      setSnapshot(snap);
      setH(live.current.h);
      if (typeof setParam !== "function") return;
      const progress = Math.round(snap.progress * 20) / 20;
      const vf = Math.round(live.current.vfT * 2) / 2;
      if (progress !== pushed.current.progress) {
        pushed.current.progress = progress;
        setParam("liveProgress", progress);
      }
      if (vf !== pushed.current.vf) {
        pushed.current.vf = vf;
        setParam("liveVfTime", vf);
      }
    },
    [setParam],
  );

  return (
    <>
      <FitCamera view={layout.view} direction={[0.02, 0.05, 1]} fov={40} />
      <EnableLocalClipping />
      <StageCycleDriver cycle={CARDIAC_CYCLE} stage={stage} playing={playing} speed={speed} tempo={tempo} live={stepperLive} setParam={setParam} onFrame={onFrame} onTick={onTick} />

      {/* Soft fills into the opened cavities, so the back walls are not black holes. */}
      <pointLight position={[-1.2, 0.6, 4]} intensity={14} distance={12} decay={2} color="#fff1e8" />
      <pointLight position={[1.6, -0.8, 3.5]} intensity={10} distance={10} decay={2} color="#ffe8e0" />

      {/* The scanned heart streams in (about 7 MB); everything else draws meanwhile. */}
      <Suspense
        fallback={
          <SceneLabel position={[0.4, 0, 0]} tone="text-ink-400">
            loading the heart…
          </SceneLabel>
        }
      >
        <ScannedHeart live={live} />
        {AV_VALVES.map((id) => (
          <Valve key={id} live={live} id={id} />
        ))}
      </Suspense>
      {STREAMS.map((s) => (
        <BloodStream key={s.key} live={live} stream={s} />
      ))}
      <ConductionPath live={live} points={PATHS.atria} pick={(c) => c.atria} />
      <ConductionPath live={live} points={PATHS.bachmann} pick={(c) => c.atria} radius={0.022} />
      <ConductionPath live={live} points={PATHS.his} pick={(c) => (c.his > 0.05 || c.purkinje > 0 ? 1 : 0)} radius={0.036} />
      <ConductionPath live={live} points={PATHS.leftBranch} pick={(c) => c.purkinje} />
      <ConductionPath live={live} points={PATHS.rightBranch} pick={(c) => c.purkinje} />
      <ConductionPath live={live} points={PATHS.rightApical} pick={(c) => c.purkinje} radius={0.022} />
      <Node live={live} pick={(c) => c.sa} position={M.conduction.sa} />
      <Node live={live} pick={(c) => c.av} position={M.conduction.av} radius={0.085} />
      <ChaosSparks live={live} />

      <WiggersPanel live={live} bpm={rate} pathology={pathology} position={layout.panel.position} scale={layout.panel.scale} />
      <EcgStrip live={live} position={layout.strip.position} scale={layout.strip.scale} />

      <Labels layout={layout} h={h} pathology={pathology} snapshot={snapshot} bottom={layout.bottom} />
    </>
  );
}

/** The heart is scanned anatomy (BodyParts3D, CC BY 4.0): the credit the licence asks for, one click away. */
/** The heart's credit (BodyParts3D, CC BY 4.0), in the shared Credits panel. */
function HeartCredits() {
  return <ModelCredits credit={HEART_MODEL_CREDIT} />;
}

export default function CardiacCycleCanvas({ params = {}, setParam }) {
  const { showLabels = true } = params || {};
  return (
    <div className="relative h-full w-full">
      <SceneCanvas camera={{ position: [2.4, 0.4, 16], fov: 40 }} controls={{ minDistance: 4, maxDistance: 40 }} lights={{ ambient: 0.62, keyLight: 1.25, rim: PALETTE.rose }}>
        <LabelsOn.Provider value={showLabels !== false}>
          <CardiacScene params={params} setParam={setParam} />
        </LabelsOn.Provider>
      </SceneCanvas>
      <HeartCredits />
    </div>
  );
}

"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { usePackedModel } from "@/components/visualizations/plant-model";
import { SWEATER_MODEL } from "@/components/visualizations/sweater-model-meta";

// ─── Our wool sweater on its dress form ─────────────────────────────
// Modelled in Blender by scripts/sweater-model (no third-party mesh), in
// the static-electricity scene's units, centred on the sweater's own centre
// line (the scene moves it to SWEATER_X), front facing +z, standing on the
// floor. `public/models/sweater.glb` holds:
//
//   sweater   a cable-knit crew-neck: three rope cables front and back,
//             ribbed hem, cuffs and collar, empty sleeves hanging at the
//             sides. Every vertex carries _knit = (stitch across, row
//             along, kind, cable height) for the stitch shader below
//   form      the dress form's linen neck and base plate, felt feet
//   wood      its turned cap, the stand's hub and three legs
//   metal     the pole and its height collar
//
// The cables, ribs and folds are geometry. The stitches themselves are too
// small for a mesh, so the fragment shader draws them: a V of two legs per
// stitch in stockinette, k2p2 columns in the ribbing, purl bumps behind the
// cables. They fade out where a stitch is smaller than a couple of pixels,
// so a distant sweater does not shimmer.
// ─────────────────────────────────────────────────────────────────────

export const SWEATER_GLB = "/models/sweater.glb";
export const SWEATER = SWEATER_MODEL;

const KNIT_VERTEX = /* glsl */ `
attribute vec4 _knit;
varying vec4 vKnit;
`;

const KNIT_FRAGMENT = /* glsl */ `
varying vec4 vKnit;

float knitHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// One stockinette stitch in its cell: two legs leaning out into a V.
float knitLegs(vec2 f) {
  const float S = 0.37;  // sin of the lean
  const float C = 0.93;
  vec2 a = f - vec2(0.3, 0.52);
  vec2 b = f - vec2(0.7, 0.52);
  float la = length(vec2(dot(a, vec2(C, S)), dot(a, vec2(-S, C))) / vec2(0.19, 0.56));
  float lb = length(vec2(dot(b, vec2(C, -S)), dot(b, vec2(S, C))) / vec2(0.19, 0.56));
  float h = max(1.0 - la, 1.0 - lb);
  // the plies twisted round each leg
  float ply = 0.85 + 0.15 * sin((f.x * 0.6 + f.y) * 18.0);
  return clamp(h, 0.0, 1.0) * ply;
}

// Reverse stockinette: rounded bumps, each row offset half a stitch.
float knitPurl(vec2 k) {
  float row = floor(k.y);
  vec2 f = fract(vec2(k.x + 0.5 * mod(row, 2.0), k.y));
  return pow(sin(3.14159 * f.y), 2.0) * (0.55 + 0.45 * sin(3.14159 * f.x));
}

// Height of the knit surface (0..1) at stitch coordinates k.
float knitHeight(vec2 k, float kind, float cable) {
  vec2 f = fract(k);
  float plain = knitLegs(f);
  if (kind < 0.5) return plain;
  if (kind < 1.5) {
    // k1p1 rib: a knit column on each moulded ridge, a purl column sunk
    // between (the ridges sit at whole even stitch numbers)
    float col = mod(floor(k.x + 0.5), 2.0);
    return col < 1.0 ? knitLegs(fract(vec2(k.x + 0.5, k.y))) : 0.3 * knitPurl(k);
  }
  // cable panel: the ropes are stockinette, the ground between them purl
  return mix(0.7 * knitPurl(k), plain, smoothstep(0.1, 0.35, cable));
}

vec3 knitPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
  vec3 sx = normalize(dFdx(surfPos));
  vec3 sy = normalize(dFdy(surfPos));
  vec3 r1 = cross(sy, surfNorm);
  vec3 r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
`;

/** The wool: sheen for the fuzz, and the knit drawn in the fragment shader. */
function makeWoolMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.9,
    sheen: 1,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color("#f6ead4"),
  });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${KNIT_VERTEX}`)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvKnit = _knit;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${KNIT_FRAGMENT}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        // stitches: a fraction of a pixel apart, they are drawn flat
        vec2 knitK = vKnit.xy;
        float knitFw = max(fwidth(knitK.x), fwidth(knitK.y));
        float knitDetail = 1.0 - smoothstep(0.15, 0.45, knitFw);
        float knitH = knitHeight(knitK, vKnit.z, vKnit.w) * knitDetail;
        // the yarn's own shade varies a little from stitch to stitch
        float knitTone = 0.98 + 0.04 * knitHash(floor(knitK));
        diffuseColor.rgb *= mix(1.0, mix(0.74, 1.06, knitH) * knitTone, knitDetail);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        normal = knitPerturb(-vViewPosition, normal, vec2(dFdx(knitH), dFdy(knitH)) * 0.9, faceDirection);`,
      );
  };
  return m;
}

/** The sweater and its stand, at the sweater's own origin. */
export function SweaterModel() {
  const parts = usePackedModel(SWEATER_GLB);
  const materials = useMemo(
    () => ({
      sweater: makeWoolMaterial(),
      form: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }),
      wood: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42 }),
      // moderate: with no environment map a high metalness renders dark
      metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.5 }),
    }),
    [],
  );
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);
  return (
    <group>
      {["sweater", "form", "wood", "metal"].map((name) =>
        parts[name] ? (
          <mesh key={name} geometry={parts[name].geometry} material={materials[name]} castShadow receiveShadow />
        ) : null,
      )}
    </group>
  );
}

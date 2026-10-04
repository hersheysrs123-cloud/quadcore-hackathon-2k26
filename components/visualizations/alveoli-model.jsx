"use client";

import * as THREE from "three";
import { usePackedModel } from "@/components/visualizations/plant-model";
import { ALVEOLI_MODEL } from "@/components/visualizations/alveoli-model-meta";

// ─── Our alveoli ────────────────────────────────────────────────────
// Modelled in Blender by scripts/lung-model (no third-party mesh).
// `public/models/alveoli.glb` holds, each in its own frame:
//
//   acinus              a respiratory bronchiole, the alveolar duct and the
//                       sac at its end, hollow, the front-right quarter cut
//                       away (units of 50 µm)
//   capillaries         the net over every exposed alveolus; _tube.x is how
//                       far along the capillary each point is (0 where the
//                       blood comes in, 1 where it leaves)
//   vessels             the pulmonary arteriole (_tube.x = 0) and venules (1)
//   septum*             one alveolar septum cut open through a capillary (µm):
//                       epithelium, basement membrane, endothelium,
//                       interstitium, a type II cell and a macrophage
//   rbc                 a red cell, Evans & Fung's biconcave disc (µm), with a
//                       "parachute" morph for the squeeze through a capillary
//
// The blood is coloured on the GPU from the solved saturation along the
// capillary (lib/gasExchange.js), so one file shows every altitude, disease
// and exercise level.
// ─────────────────────────────────────────────────────────────────────

export const ALVEOLI_GLB = "/models/alveoli.glb";
export const ALVEOLI = ALVEOLI_MODEL;
export const useAlveoliModel = () => usePackedModel(ALVEOLI_GLB);

/** Samples of saturation along the capillary the shader reads. */
export const SAT_SAMPLES = 33;

/**
 * Blood by its haemoglobin saturation. Real deoxygenated blood is dark red,
 * not blue; the scale runs from a dark violet-red to scarlet so the change
 * reads at a glance, and the legend says what it means.
 */
export const BLOOD_STOPS = [
  [0.35, "#3f2f86"],
  [0.7, "#8c1d5c"],
  [0.85, "#c0213f"],
  [1.0, "#f43f3f"],
];

const STOP_COLOURS = BLOOD_STOPS.map(([s, hex]) => [s, new THREE.Color(hex)]);

/** The colour of blood at saturation `sat` (0–1), written into `out`. */
export function bloodColour(sat, out = new THREE.Color()) {
  if (sat <= STOP_COLOURS[0][0]) return out.copy(STOP_COLOURS[0][1]);
  for (let i = 1; i < STOP_COLOURS.length; i += 1) {
    const [s1, c1] = STOP_COLOURS[i];
    if (sat <= s1) {
      const [s0, c0] = STOP_COLOURS[i - 1];
      return out.copy(c0).lerp(c1, (sat - s0) / (s1 - s0));
    }
  }
  return out.copy(STOP_COLOURS[STOP_COLOURS.length - 1][1]);
}

const glslColour = (c) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;

export function makeBloodUniforms() {
  return { uSat: { value: new Array(SAT_SAMPLES).fill(0.75) }, uTime: { value: 0 } };
}

/** Fill the uniforms from a solved gas exchange (`profileAt`). */
export function setBloodUniforms(uniforms, solved, profileAt) {
  const arr = uniforms.uSat.value;
  for (let i = 0; i < SAT_SAMPLES; i += 1) arr[i] = profileAt(solved, i / (SAT_SAMPLES - 1)).sat;
}

/** Capillaries and vessels: coloured by the saturation at _tube.x along the capillary. */
export function makeBloodMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0, emissive: new THREE.Color("#000000") });
  const stops = STOP_COLOURS.map(([s, c]) => `if (sat <= ${s.toFixed(3)}) return mix(prev, ${glslColour(c)}, clamp((sat - ps) / max(${s.toFixed(3)} - ps, 1e-3), 0.0, 1.0)); prev = ${glslColour(c)}; ps = ${s.toFixed(3)};`);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSat = uniforms.uSat;
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nattribute vec4 _tube;\nvarying float vF;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvF = _tube.x;`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying float vF;
        uniform float uSat[${SAT_SAMPLES}];
        uniform float uTime;
        vec3 bloodAt(float sat) {
          vec3 prev = ${glslColour(STOP_COLOURS[0][1])};
          float ps = 0.0;
          ${stops.join("\n          ")}
          return prev;
        }
        float satAt(float f) {
          float x = clamp(f, 0.0, 1.0) * ${(SAT_SAMPLES - 1).toFixed(1)};
          int i = int(min(floor(x), ${(SAT_SAMPLES - 2).toFixed(1)}));
          float sat = 0.0;
          // GLSL ES 1 cannot index a uniform array by a non-constant: walk it
          for (int k = 0; k < ${SAT_SAMPLES - 1}; k++) {
            if (k == i) sat = mix(uSat[k], uSat[k + 1], x - float(k));
          }
          return sat;
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          vec3 b = bloodAt(satAt(vF));
          diffuseColor.rgb = b;
          totalEmissiveRadiance += b * 0.18;
        }`,
      );
  };
  m.customProgramCacheKey = () => "alveoli-blood";
  return m;
}

/**
 * The red cell, squeezed: the disc blended `k` of the way to its parachute
 * shape, as a plain geometry (no morph at draw time, so it can be instanced).
 */
export function squeezedRbc(rbc, k = 0.55) {
  const g = rbc.geometry.clone();
  const morph = g.morphAttributes.position?.[0];
  if (morph) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i += 1) p.setXYZ(i, p.getX(i) + morph.getX(i) * k, p.getY(i) + morph.getY(i) * k, p.getZ(i) + morph.getZ(i) * k);
  }
  g.morphAttributes = {};
  g.deleteAttribute("color");
  g.computeVertexNormals();
  return g;
}

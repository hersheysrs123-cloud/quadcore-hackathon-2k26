"use client";

import * as THREE from "three";
import { usePackedModel } from "@/components/visualizations/plant-model";
import { GUT_MODEL } from "@/components/visualizations/gut-model-meta";

// ─── Our oesophagus and stomach ─────────────────────────────────────
// Modelled in Blender by scripts/gut-model (no third-party mesh), in
// centimetres, mouth end of the oesophagus at the origin and the tube
// running down -y. `public/models/gut.glb` holds:
//
//   oesophagus   the tube with its front cut away, stored AT REST; every
//                vertex carries _tube = (station s, depth w into the wall,
//                mucosal fold offset, 0)
//   stomach      the J-shaped stomach and the vessels on its curvatures
//   bolusSoft    a chewed-food bolus about a unit sphere
//   bolusDry     a drier, crumbly one
//
// The oesophagus is moved on the GPU. Each frame the scene samples the
// peristaltic wave (lib/peristalsis.js) every GUT_STEP cm into `uProf`:
// (lumen radius, circular activation, longitudinal activation, how far that
// station has slid towards the shortening zone), and the vertex shader puts
// every vertex back at the radius its station now has: the wall closes and
// thickens behind the bolus and opens and thins ahead of it, the folds of
// the mucosa crowd together where it shuts and flatten where it stretches.
// The fragment shader draws the wall's layers from w, flushing the circular
// layer rose where it contracts and the longitudinal layer amber.
// ─────────────────────────────────────────────────────────────────────

export const GUT_GLB = "/models/gut.glb";
export const GUT = GUT_MODEL;
/** Station spacing of the profile the shader reads, cm, and how many. */
export const GUT_STEP = 0.25;
export const GUT_STATIONS = Math.round(GUT_MODEL.length / GUT_STEP) + 1;

export const useGutModel = () => usePackedModel(GUT_GLB);

/** The wall's colours (sRGB), lumen outwards, and the two layers' flushes. */
export const GUT_COLOURS = {
  epithelium: "#eeb4b9",
  laminaPropria: "#d8878f",
  muscularisMucosae: "#b75a65",
  submucosa: "#f1dfca",
  circular: "#9e3c48",
  circularContracted: "#ff5a6e",
  longitudinal: "#b25461",
  longitudinalContracted: "#fbbf24",
  adventitia: "#eadccb",
  // baked into the bolus models by scripts/gut-model, named here for the key
  bolus: "#c9a26b",
};

const glslColour = (hex) => {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};

/** Uniforms for the oesophagus: the per-station wave profile. */
export function makeGutUniforms() {
  return { uProf: { value: Array.from({ length: GUT_STATIONS }, () => new THREE.Vector4(GUT_MODEL.lumen, 0, 0, 0)) }, uTime: { value: 0 } };
}

export function makeOesophagusMaterial(uniforms) {
  const L = GUT_MODEL.layers;
  const W = GUT_MODEL.wall;
  const C = GUT_COLOURS;
  const m = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uProf = uniforms.uProf;
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute vec4 _tube;
        uniform vec4 uProf[${GUT_STATIONS}];
        varying vec3 vGut; // s, w, theta
        varying vec2 vAct; // circular, longitudinal
        vec4 gutProf(float s) {
          float f = clamp(s / ${GUT_STEP.toFixed(3)}, 0.0, ${(GUT_STATIONS - 1.001).toFixed(3)});
          int i = int(floor(f));
          return mix(uProf[i], uProf[i + 1], fract(f));
        }
        vec3 gutPos;`,
      )
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
        {
          float s = _tube.x;
          vec4 P = gutProf(s);
          float Lr = P.x;
          float theta = atan(position.x, position.z);
          // the folds crowd in where the lumen shuts, flatten where it stretches
          float foldAmt = (1.0 - smoothstep(0.95, 1.4, Lr)) * Lr / ${GUT_MODEL.lumen.toFixed(3)};
          // the contracting ring thickens the wall; a stretched wall thins
          float thick = 1.0 + 0.45 * P.y - 0.22 * clamp(Lr - 1.0, 0.0, 0.8);
          float r = Lr + _tube.z * foldAmt + _tube.y * thick;
          gutPos = vec3(r * sin(theta), -(s + P.w), r * cos(theta));
          // tilt the normal with the slope of the profile
          float dr = (gutProf(s + 0.2).x - gutProf(s - 0.2).x) / 0.4;
          float radial = dot(objectNormal.xz, vec2(sin(theta), cos(theta)));
          objectNormal.y += dr * radial;
          objectNormal = normalize(objectNormal);
          vGut = vec3(s, _tube.y, theta);
          vAct = P.yz;
        }`,
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed = gutPos;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vGut;
        varying vec2 vAct;
        float gutHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float gutNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(gutHash(i), gutHash(i + vec2(1, 0)), f.x), mix(gutHash(i + vec2(0, 1)), gutHash(i + vec2(1, 1)), f.x), f.y);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          float s = vGut.x;
          float w = vGut.y / ${W.toFixed(3)};
          float th = vGut.z;
          vec3 col;
          float glow = 0.0;
          if (w < ${L.laminaPropria.toFixed(3)}) {
            // the lining: pink, glossy, a faint mesh of capillaries
            col = ${glslColour(C.epithelium)};
            col *= 0.94 + 0.1 * gutNoise(vec2(s * 6.0, th * 14.0));
          } else if (w < ${L.submucosa.toFixed(3)}) {
            float mm = smoothstep(${(L.submucosa - 0.05).toFixed(3)}, ${(L.submucosa - 0.035).toFixed(3)}, w);
            col = mix(${glslColour(C.laminaPropria)}, ${glslColour(C.muscularisMucosae)}, mm);
          } else if (w < ${L.circular.toFixed(3)}) {
            // submucosa: loose and pale, with glands and small vessels in it
            col = ${glslColour(C.submucosa)};
            vec2 g = vec2(s * 5.0, w * 22.0);
            float d = length(fract(g) - 0.5);
            float pick = gutHash(floor(g));
            if (pick > 0.8 && d < 0.26) col = mix(col, vec3(0.86, 0.62, 0.62), 0.7);
            if (pick < 0.06 && d < 0.18) col = mix(col, vec3(0.62, 0.12, 0.16), 0.85);
          } else if (w < ${L.longitudinal.toFixed(3)}) {
            // circular muscle, its fibres cut across: a fine stipple
            float st = gutNoise(vec2(s * 22.0, w * 60.0));
            col = mix(${glslColour(C.circular)}, ${glslColour(C.circularContracted)}, vAct.x);
            col *= 0.86 + 0.24 * st;
            glow = vAct.x;
          } else if (w < 0.985) {
            // longitudinal muscle, its fibres cut along: streaks down the tube
            float st = gutNoise(vec2(s * 1.6, (w + th) * 45.0));
            col = mix(${glslColour(C.longitudinal)}, ${glslColour(C.longitudinalContracted)}, 0.75 * vAct.y);
            col *= 0.86 + 0.24 * st;
            glow = vAct.y * 0.8;
          } else {
            // the outside: longitudinal bundles under a thin, pale adventitia
            float st = gutNoise(vec2(s * 1.2, th * 40.0));
            vec3 mus = mix(${glslColour(C.longitudinal)}, ${glslColour(C.longitudinalContracted)}, 0.75 * vAct.y);
            col = mix(mus, ${glslColour(C.adventitia)}, 0.28) * (0.88 + 0.2 * st);
            glow = vAct.y * 0.6;
          }
          diffuseColor.rgb = col;
          totalEmissiveRadiance += col * glow * 0.35;
        }`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        // the mucosa is wet and shines
        if (vGut.y < 0.02) roughnessFactor = 0.22;`,
      );
  };
  m.customProgramCacheKey = () => "gut-oesophagus";
  return m;
}

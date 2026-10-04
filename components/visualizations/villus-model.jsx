"use client";

import * as THREE from "three";
import { usePackedModel } from "@/components/visualizations/plant-model";
import { GUT_COLOURS } from "@/components/visualizations/gut-model";
import { VILLUS_MODEL } from "@/components/visualizations/villus-model-meta";
import { ROUTES } from "@/lib/absorption";

// ─── Our small-intestine lining ─────────────────────────────────────
// Modelled in Blender by scripts/villus-model (no third-party mesh).
// `public/models/villus.glb` holds, each in its own frame:
//
//   wall          a block of jejunum wall opened out, with two circular
//                 folds (mm); _tube = (depth below the mucosal surface,
//                 depth below the wall's surface line, 0, 0)
//   villusLow     one villus to instance over it (mm), morph "atrophy"
//   villusSites   where the villi stand: vertex 3i of triangle i is a site,
//                 its _tube.xyz the surface normal there
//   villus        one villus dissected in three storeys (10 µm); _tube =
//                 (depth below its surface, arc length up it, angle round it)
//   lacteal       its lacteal laid open, and the smooth muscle beside it
//   villusVessels arteriole (_tube.x 0), capillaries (0.3–0.7), venule (1)
//   floor         the mucosa it stands on, with crypts; _tube = (depth below
//                 the nearest free surface, depth below the top, 0, 1)
//
// The cells are drawn by these fragment shaders from _tube — columnar
// enterocytes with their basal nuclei and brush border, goblet cells, the
// layers of the wall — so the pattern is finer than any mesh and survives
// the decimation.
// ─────────────────────────────────────────────────────────────────────

export const VILLUS_GLB = "/models/villus.glb";
export const VILLUS = VILLUS_MODEL;
export const useVillusModel = () => usePackedModel(VILLUS_GLB);

export const VILLUS_COLOURS = {
  brush: "#f1e9f7",
  enterocyte: "#f0bcc3",
  nucleus: "#6b4a98",
  goblet: "#e3ecf7",
  lamina: "#e8b2a5",
  lymphocyte: "#5b3f8a",
  paneth: "#e0455d",
  lacteal: ROUTES.lymph.colour,
  arteriole: ROUTES.blood.colour,
  venule: "#9f1239",
};

const glsl = (hex) => {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};

const NOISE = /* glsl */ `
float vmHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vmHash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float vmNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(vmHash(i), vmHash(i + vec2(1, 0)), f.x), mix(vmHash(i + vec2(0, 1)), vmHash(i + vec2(1, 1)), f.x), f.y);
}`;

function withTube(material, key, fragment, extraVertex = "") {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nattribute vec4 _tube;\nvarying vec4 vTube;\nvarying vec3 vObj;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvTube = _tube;\nvObj = position;${extraVertex}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec4 vTube;\nvarying vec3 vObj;\n${NOISE}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n{\n${fragment}\n}`);
  };
  material.customProgramCacheKey = () => key;
  return material;
}

/** The wall block: mucosa with its crypts, muscularis mucosae, submucosa, two muscle coats, serosa. */
export function makeWallMaterial() {
  const L = VILLUS.wall.layers;
  const C = GUT_COLOURS;
  const m = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 });
  return withTube(
    m,
    "villus-wall",
    `
    float d = vTube.x;
    float yd = vTube.y;
    vec3 col;
    if (d < 0.025) {
      col = ${glsl(C.epithelium)} * (0.94 + 0.1 * vmNoise(vObj.xz * 40.0));
    } else if (d < ${L.mucosa.toFixed(3)}) {
      // crypts of Lieberkuhn: tubular glands, seen cut along their length
      float g = fract(vObj.x / 0.07 + 0.3 * sin(vObj.z * 30.0));
      float wall = smoothstep(0.32, 0.38, g) * (1.0 - smoothstep(0.62, 0.68, g));
      float lumen = smoothstep(0.47, 0.5, g) * (1.0 - smoothstep(0.5, 0.53, g));
      col = mix(${glsl(C.laminaPropria)}, ${glsl("#f2c6cc")}, wall * 0.8);
      col = mix(col, ${glsl("#fbeff1")}, lumen * step(0.06, d));
    } else if (d < ${L.muscularisMucosae.toFixed(3)}) {
      col = ${glsl(C.muscularisMucosae)};
    } else if (yd < ${L.submucosa.toFixed(3)}) {
      col = ${glsl(C.submucosa)};
      vec2 q = vObj.xy * vec2(9.0, 12.0);
      float pick = vmHash(floor(q));
      float r = length(fract(q) - 0.5);
      if (pick > 0.85 && r < 0.22) col = ${glsl("#a8233a")};
      if (pick < 0.05 && r < 0.26) col = ${glsl("#4a4a8a")};
    } else if (yd < ${L.circular.toFixed(3)}) {
      col = ${glsl(C.circular)} * (0.86 + 0.24 * vmNoise(vObj.xy * 120.0));
    } else if (yd < ${L.longitudinal.toFixed(3)}) {
      col = ${glsl(C.longitudinal)} * (0.86 + 0.24 * vmNoise(vec2(vObj.x * 8.0, vObj.y * 160.0)));
    } else {
      col = ${glsl(C.adventitia)};
    }
    diffuseColor.rgb = col;`,
  );
}

/** Villi on the wall: pink, paler and glossier towards the tip. */
export function makeVillusLowMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0, color: VILLUS_COLOURS.enterocyte });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nuniform float uTime;\nvarying float vH;`)
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vH = clamp(position.y / ${VILLUS.wall.villusHeight.toFixed(3)}, 0.0, 1.2);
        // villi sway and pump: a slow bend that grows towards the tip, out of step
        #ifdef USE_INSTANCING
          vec3 site = vec3(instanceMatrix[3]);
          float ph = dot(site, vec3(9.1, 3.7, 7.3));
          transformed.x += 0.035 * vH * vH * sin(uTime * 1.3 + ph);
          transformed.z += 0.025 * vH * vH * cos(uTime * 1.1 + ph * 1.3);
        #endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying float vH;`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        diffuseColor.rgb = mix(${glsl("#d98a93")}, ${glsl("#f6cfd3")}, smoothstep(0.0, 1.0, vH));`,
      );
  };
  m.customProgramCacheKey = () => "villus-low";
  return m;
}

/** The dissected villus: brush border, enterocytes and their nuclei, goblet cells, lamina propria. */
export function makeVillusMaterial(uniforms) {
  const EPI = VILLUS.villus.epithelium;
  const V = VILLUS_COLOURS;
  const m = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0, side: THREE.DoubleSide });
  withTube(
    m,
    "villus-cells",
    `
    float d = vTube.x;
    float s = vTube.y;
    float th = vTube.z;
    float uB = uBrush;
    vec3 col;
    // cells about 7 µm wide along the surface, in rings round it
    float cellS = s / 0.72;
    float ring = th * 7.5 / 0.72;
    vec2 cell = vec2(floor(cellS), floor(ring + 0.5 * floor(cellS)));
    float h = vmHash(cell);
    float u = fract(cellS);
    if (d < ${EPI.toFixed(3)}) {
      float border = 1.0 - smoothstep(0.0, 0.07, min(u, 1.0 - u));
      bool goblet = h < 0.13;
      if (d < 0.17 * uB) {
        // the brush border: microvilli, a pale fuzzy fringe
        col = ${glsl(V.brush)} * (0.92 + 0.12 * vmNoise(vec2(s * 30.0, th * 60.0)));
      } else if (goblet && d < 1.5 && abs(u - 0.5) < 0.36 * smoothstep(0.0, 1.0, d / 0.5)) {
        col = ${glsl(V.goblet)};
      } else {
        col = ${glsl(V.enterocyte)} * (0.93 + 0.1 * vmNoise(vec2(s * 4.0, d * 9.0)));
        // nuclei near the base of each cell, elongated along it
        float nd = goblet ? 2.25 : 1.75 + 0.15 * (h - 0.5);
        vec2 q = vec2((u - 0.5) / 0.22, (d - nd) / 0.42);
        if (dot(q, q) < 1.0) col = ${glsl(V.nucleus)} * (0.9 + 0.2 * vmNoise(vec2(s * 40.0, d * 40.0)));
        col = mix(col, col * 0.72, border * step(0.25, d));
      }
      if (d > ${(EPI - 0.12).toFixed(3)}) col = ${glsl("#f6eee6")};
      // seen from outside: the cells' tops, and goblet cells' openings
      if (d < 0.03) {
        float edge = 1.0 - smoothstep(0.0, 0.09, min(min(u, 1.0 - u), min(fract(ring), 1.0 - fract(ring))));
        col = mix(${glsl(V.brush)} * 0.96, ${glsl("#d9b3c4")}, edge * 0.6);
        if (goblet && length(vec2(u - 0.5, fract(ring) - 0.5)) < 0.22) col = ${glsl("#fbfdff")};
      }
    } else {
      col = ${glsl(V.lamina)} * (0.9 + 0.12 * vmNoise(vObj.xy * 0.9));
      // lymphocytes and plasma cells scattered in the lamina propria
      vec3 g = vObj * 1.1;
      float pick = vmHash3(floor(g));
      if (pick > 0.86 && length(fract(g) - 0.5) < 0.24) col = ${glsl(V.lymphocyte)};
    }
    diffuseColor.rgb = col;`,
  );
  const inner = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    shader.uniforms.uBrush = uniforms.uBrush;
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uBrush;");
    inner(shader, renderer);
  };
  return m;
}

/** The mucosa under the villus: crypt epithelium with Paneth cells at the bottom, lamina propria, muscularis mucosae. */
export function makeFloorMaterial() {
  const EPI = VILLUS.villus.epithelium;
  const V = VILLUS_COLOURS;
  const C = GUT_COLOURS;
  return withTube(
    new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 }),
    "villus-floor",
    `
    float d = vTube.x;
    float yd = vTube.y;
    vec3 col;
    if (yd > 25.5) col = ${glsl(C.submucosa)};
    else if (yd > 23.5) col = ${glsl(C.muscularisMucosae)};
    else if (d < ${EPI.toFixed(3)}) {
      col = ${glsl(V.enterocyte)} * (0.92 + 0.1 * vmNoise(vObj.xy * 2.0));
      float u = fract(vObj.y / 0.72);
      col = mix(col, col * 0.75, 1.0 - smoothstep(0.0, 0.08, min(u, 1.0 - u)));
      if (d > 1.5 && d < 2.1) col = mix(col, ${glsl(V.nucleus)}, 0.75);
      // Paneth cells at the crypt base: bright granules
      if (yd > 17.0 && vmHash3(floor(vObj * 2.4)) > 0.55 && d < 1.4) col = ${glsl(V.paneth)};
      if (d < 0.12) col = ${glsl(V.brush)};
    } else {
      col = ${glsl(V.lamina)} * (0.9 + 0.12 * vmNoise(vObj.xz * 0.6));
      vec3 g = vObj * 1.1;
      if (vmHash3(floor(g)) > 0.88 && length(fract(g) - 0.5) < 0.24) col = ${glsl(V.lymphocyte)};
    }
    diffuseColor.rgb = col;`,
  );
}

/** Blood vessels in the villus: bright arteriole, darker venule, capillaries between. */
export function makeVesselMaterial() {
  const V = VILLUS_COLOURS;
  return withTube(
    new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0 }),
    "villus-vessels",
    `diffuseColor.rgb = mix(${glsl(V.arteriole)}, ${glsl(V.venule)}, clamp(vTube.x, 0.0, 1.0));
    totalEmissiveRadiance += diffuseColor.rgb * 0.12;`,
  );
}

/** villusLow blended `k` of the way to its atrophic stub, as a plain geometry for instancing. */
export function atrophiedVillus(villusLow, k) {
  const g = villusLow.geometry.clone();
  const morph = g.morphAttributes.position?.[0];
  if (morph && k > 0) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i += 1) p.setXYZ(i, p.getX(i) + morph.getX(i) * k, p.getY(i) + morph.getY(i) * k, p.getZ(i) + morph.getZ(i) * k);
  }
  g.morphAttributes = {};
  g.deleteAttribute("color");
  g.computeVertexNormals();
  return g;
}

/** The sites the villi stand on: positions and normals, from the villusSites node. */
export function villusSites(sitesNode) {
  const g = sitesNode.geometry;
  const p = g.attributes.position;
  const t = g.attributes._tube;
  const out = [];
  for (let i = 0; i < p.count; i += 3) {
    out.push({ p: new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)), n: new THREE.Vector3(t.getX(i), t.getY(i), t.getZ(i)).normalize() });
  }
  return out;
}

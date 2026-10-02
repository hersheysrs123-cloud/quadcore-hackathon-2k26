"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ─── Our bean seedling ──────────────────────────────────────────────
// Every mesh the transpiration scene draws, modelled in Blender by
// scripts/plant-model (no third-party mesh). `public/models/transpiration.glb`
// holds one node per part, each in its own frame:
//
//   plant         stem, leaves, cotyledons (morph "wilt"; _sway, _uvl)
//   roots, soil   the root system and the cut block of soil
//   stem          a wedge-cut length of stem, x40 (tissue shader)
//   stemDetail    vessel-wall thickenings, sieve plates, stem hairs
//   leafSection   a freeze-fractured block of leaf, x200
//   leafGuard     its guard cells (morph "open")
//   stomaSurface  the lower epidermis face-on, x800
//   stomaGuard    its guard cells (morph "open")
//   rootTip       a root tip and its root hairs, x100
//   rootStele     the root's central cylinder, seen through it
//   rootSoil      sand, silt and clay-humus crumbs round the hairs
//   rootWater     the water films on them (morph "dry")
//
// Positions are stored as 16-bit integers under a per-node scale; this
// module unpacks them to plain floats once, so the scene's shaders and
// particle paths work in the same units as scripts/plant-model.
// ─────────────────────────────────────────────────────────────────────

export const PLANT_GLB = "/models/transpiration.glb";

const cache = new WeakMap();

/** A node's geometry in float, in its own frame, with sRGB vertex colours made linear. */
function unpack(node) {
  const src = node.geometry;
  const g = new THREE.BufferGeometry();
  const pos = src.attributes.position;
  const n = pos.count;
  const s = node.scale.x;
  const t = node.position;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    out[i * 3] = pos.getX(i) * s + t.x;
    out[i * 3 + 1] = pos.getY(i) * s + t.y;
    out[i * 3 + 2] = pos.getZ(i) * s + t.z;
  }
  g.setAttribute("position", new THREE.BufferAttribute(out, 3));
  g.setAttribute("normal", src.attributes.normal);
  if (src.attributes.color) {
    const c = src.attributes.color;
    const lin = new Float32Array(n * 4);
    const col = new THREE.Color();
    for (let i = 0; i < n; i += 1) {
      col.setRGB(c.getX(i), c.getY(i), c.getZ(i), THREE.SRGBColorSpace);
      lin[i * 4] = col.r;
      lin[i * 4 + 1] = col.g;
      lin[i * 4 + 2] = col.b;
      lin[i * 4 + 3] = c.itemSize > 3 ? c.getW(i) : 1;
    }
    g.setAttribute("color", new THREE.BufferAttribute(lin, 4));
  }
  for (const name of ["_sway", "_uvl", "_cell", "_tube"]) {
    if (src.attributes[name]) g.setAttribute(name, src.attributes[name]);
  }
  g.setIndex(src.index);
  const morphs = src.morphAttributes.position;
  if (morphs && morphs.length) {
    g.morphAttributes.position = morphs.map((m) => {
      const d = new Float32Array(m.count * 3);
      for (let i = 0; i < m.count; i += 1) {
        d[i * 3] = m.getX(i) * s;
        d[i * 3 + 1] = m.getY(i) * s;
        d[i * 3 + 2] = m.getZ(i) * s;
      }
      return new THREE.BufferAttribute(d, 3);
    });
    g.morphTargetsRelative = true;
  }
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/**
 * A model written by one of our Blender builds (scripts/plant-model,
 * scripts/gut-model): its parts as float geometries keyed by node name.
 */
export function usePackedModel(url) {
  const gltf = useGLTF(url);
  return useMemo(() => {
    if (cache.has(gltf)) return cache.get(gltf);
    const parts = {};
    gltf.scene.traverse((o) => {
      if (o.isMesh) parts[o.name] = { geometry: unpack(o), morphs: o.morphTargetDictionary ?? {} };
    });
    cache.set(gltf, parts);
    return parts;
  }, [gltf]);
}

/** The seedling and the transpiration panels. */
export const usePlantModel = () => usePackedModel(PLANT_GLB);

// ─── Shaders ────────────────────────────────────────────────────────

const HASH = /* glsl */ `
vec3 pmHash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
float pmHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
// F1 and F2 of a 3D Voronoi: the distance to the nearest and second-nearest
// cell centre. F2 - F1 is small along the walls between cells.
vec2 pmVoronoi(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int k = -1; k <= 1; k++)
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec3 b = vec3(float(i), float(j), float(k));
    vec3 r = b - f + 0.12 + 0.76 * pmHash3(p + b);
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return vec2(sqrt(d1), sqrt(d2));
}
float pmCellWall(vec3 x, float width) {
  vec2 v = pmVoronoi(x);
  return 1.0 - smoothstep(0.0, width, v.y - v.x);
}
`;

/**
 * The seedling: wind sways it from the stem base up (_sway.x is how far a
 * point moves, _sway.y its phase, so the leaves flutter out of step), the
 * blades get a fine net of tertiary veins from their leaf coordinates
 * (_uvl), and their undersides are paler, as a bean leaf's are.
 */
export function makeShootMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.58, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec4 _sway;\nattribute vec2 _uvl;\nuniform float uTime;\nuniform float uWind;\nvarying vec2 vUvl;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vUvl = _uvl;
        {
          float w = _sway.x;
          float ph = _sway.y * 6.2831853;
          float g = uWind;
          float bend = sin(uTime * (1.1 + 1.6 * g) + ph) * 0.6 + 0.45 * g;
          transformed.x += w * (0.015 + 0.2 * g) * bend;
          transformed.z += w * (0.008 + 0.06 * g) * sin(uTime * 1.9 + ph * 1.7);
          if (abs(_uvl.x) + abs(_uvl.y) > 0.0) {
            transformed.y += w * (0.004 + 0.05 * g) * sin(uTime * (3.0 + 5.0 * g) + ph + _uvl.x * 3.0);
          }
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec2 vUvl;\n${HASH}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        if (abs(vUvl.x) + abs(vUvl.y) > 0.0) {
          // tertiary veins: a reticulate net between the main ones
          float net = pmCellWall(vec3(vUvl.x * 16.0, vUvl.y * 9.0, 0.5), 0.09);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 1.16, 1.02), net * 0.55);
          // the underside is paler (sRGB #9dbb6a, made linear)
          if (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.337, 0.497, 0.144), 0.45);
        }`,
      );
  };
  m.customProgramCacheKey = () => "plant-shoot";
  return m;
}

/**
 * Soil: fine grain speckle, and when it dries out it pales, and the top
 * surface cracks into polygons.
 */
export function makeSoilMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDry = uniforms.uDry;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSoil;\nvarying vec3 vSoilN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSoil = position;\nvSoilN = normal;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform float uDry;\nvarying vec3 vSoil;\nvarying vec3 vSoilN;\n${HASH}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          float grain = pmHash(floor(vSoil * 90.0));
          diffuseColor.rgb *= 0.86 + 0.26 * grain;
          vec3 dry = vec3(dot(diffuseColor.rgb, vec3(0.33))) * vec3(1.45, 1.22, 0.98) + vec3(0.06, 0.045, 0.02);
          diffuseColor.rgb = mix(diffuseColor.rgb, dry, uDry * 0.75);
          float top = smoothstep(0.6, 0.9, vSoilN.y);
          float crack = pmCellWall(vec3(vSoil.x * 2.6, 0.0, vSoil.z * 2.6), 0.07);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.25, crack * top * uDry);
        }`,
      );
  };
  m.customProgramCacheKey = () => "plant-soil";
  return m;
}

/**
 * The stem's tissues, drawn per pixel from the same rings and bundles
 * scripts/plant-model/stem.py cut the geometry with (passed in as `stem`,
 * the model meta): epidermis, collenchyma, cortex, endodermis, a ring of
 * collateral bundles (fibre cap, phloem, cambium, xylem with its vessels),
 * the rays between them and the pith. Each tissue is a 3D Voronoi of its
 * own cell size, stretched along the stem where its cells are long, with
 * walls of its own colour; the vessels are open lumens on the cut end.
 */
export function makeStemMaterial(stem) {
  const r = stem.rings;
  const vessels = stem.vessels.map(([rc, rv]) => `vec2(${rc.toFixed(4)}, ${rv.toFixed(4)})`).join(", ");
  const m = new THREE.MeshStandardMaterial({ vertexColors: false, roughness: 0.62, metalness: 0, color: "#ffffff" });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vStem;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvStem = position;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\nvarying vec3 vStem;\n${HASH}`).replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      {
        const float H = ${stem.H.toFixed(4)};
        vec3 p = vStem;
        float rad = length(p.xz);
        float phi = atan(p.x, p.z);
        // nearest bundle: they sit every pi/4 starting at pi/4
        float dphi = mod(phi - 0.7853982 + 0.3926991, 0.7853982) - 0.3926991;
        float s = dphi * rad;
        bool endFace = abs(p.y) > H - 0.003;
        vec3 cellCol = vec3(0.86, 0.9, 0.76);
        vec3 wallCol = vec3(0.97, 0.97, 0.9);
        float size = 0.05;
        float stretch = 1.6;
        float wall = 0.12;
        float lumen = 0.0;
        float xw = 0.035 + 0.1 * clamp((rad - ${r.xylem.toFixed(3)}) / (${r.cambium.toFixed(3)} - ${r.xylem.toFixed(3)}), 0.0, 1.0);
        if (rad > ${r.epidermis.toFixed(3)}) {
          cellCol = vec3(0.36, 0.55, 0.24); wallCol = vec3(0.6, 0.75, 0.45); size = 0.035; stretch = 3.0; wall = 0.14;
        } else if (rad > ${r.collenchyma.toFixed(3)}) {
          cellCol = vec3(0.47, 0.66, 0.32); wallCol = vec3(0.84, 0.92, 0.7); size = 0.026; stretch = 2.5; wall = 0.3;
        } else if (rad > ${r.cortex.toFixed(3)}) {
          float k = (rad - ${r.cortex.toFixed(3)}) / (${r.collenchyma.toFixed(3)} - ${r.cortex.toFixed(3)});
          cellCol = mix(vec3(0.78, 0.86, 0.64), vec3(0.56, 0.74, 0.4), k); wallCol = vec3(0.93, 0.96, 0.86); size = 0.05; stretch = 1.5; wall = 0.1;
        } else if (rad > ${r.endodermis.toFixed(3)}) {
          // the starch sheath
          cellCol = vec3(0.88, 0.84, 0.58); wallCol = vec3(0.96, 0.94, 0.82); size = 0.022; stretch = 2.0; wall = 0.14;
        } else if (rad > ${r.fibres.toFixed(3)}) {
          if (abs(s) < 0.11) { cellCol = vec3(0.94, 0.91, 0.8); wallCol = vec3(0.8, 0.68, 0.45); size = 0.013; stretch = 6.0; wall = 0.45; }
          else { cellCol = vec3(0.82, 0.88, 0.7); wallCol = vec3(0.95, 0.97, 0.88); size = 0.03; stretch = 1.5; wall = 0.12; }
        } else if (rad > ${r.phloem.toFixed(3)}) {
          if (abs(s) < 0.12) { cellCol = vec3(0.72, 0.84, 0.58); wallCol = vec3(0.94, 0.97, 0.87); size = 0.016; stretch = 5.0; wall = 0.16; }
          else { cellCol = vec3(0.84, 0.89, 0.72); wallCol = vec3(0.96, 0.97, 0.9); size = 0.03; stretch = 1.4; wall = 0.12; }
        } else if (rad > ${r.cambium.toFixed(3)}) {
          cellCol = vec3(0.84, 0.91, 0.68); wallCol = vec3(0.96, 0.98, 0.9); size = 0.009; stretch = 4.0; wall = 0.2;
        } else if (rad > ${r.xylem.toFixed(3)} && abs(s) < xw) {
          cellCol = vec3(0.95, 0.9, 0.76); wallCol = vec3(0.74, 0.55, 0.3); size = 0.022; stretch = 5.0; wall = 0.3;
          // the vessels: three radial files per bundle, the middle one widest
          vec2 V[3] = vec2[3](${vessels});
          for (int i = 0; i < 3; i++) {
            for (int f = -1; f <= 1; f++) {
              float rc = V[i].x;
              float rv = V[i].y * (f == 0 ? 1.0 : 0.72);
              float sc = float(f) * (0.03 + 0.2 * (rc - ${r.xylem.toFixed(3)}));
              float d = length(vec2(rad - rc, s - sc));
              lumen = max(lumen, 1.0 - smoothstep(rv - 0.006, rv, d));
              if (d < rv + 0.012 && d > rv - 0.006) { cellCol = vec3(0.72, 0.52, 0.28); }
            }
          }
        } else if (rad > ${r.xylem.toFixed(3)}) {
          // rays of parenchyma between the bundles
          cellCol = vec3(0.87, 0.91, 0.76); wallCol = vec3(0.96, 0.97, 0.9); size = 0.032; stretch = 1.4; wall = 0.12;
        } else {
          cellCol = vec3(0.94, 0.95, 0.86); wallCol = vec3(0.99, 0.99, 0.95); size = 0.068; stretch = 1.3; wall = 0.08;
        }
        vec3 q = vec3(p.x, p.y / stretch, p.z) / size;
        float w = pmCellWall(q, wall);
        vec3 col = mix(cellCol, wallCol, w * 0.85);
        col *= 0.93 + 0.12 * pmHash(floor(q + 0.5));
        if (endFace) col = mix(col, vec3(0.3, 0.22, 0.14), lumen * 0.85);
        // the colours above are written in sRGB, like every colour in the palette
        diffuseColor.rgb = pow(col, vec3(2.2));
      }`,
    );
  };
  m.customProgramCacheKey = () => "plant-stem";
  return m;
}

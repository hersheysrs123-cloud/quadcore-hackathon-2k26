"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { usePackedModel } from "@/components/visualizations/plant-model";
import { CANNON_MODEL } from "@/components/visualizations/cannon-model-meta";

// ─── Our bronze cannon on its oak garrison carriage ─────────────────
// Modelled in Blender by scripts/cannon-model (no third-party mesh), in the
// projectile scene's units. `public/models/cannon.glb` holds:
//
//   barrel  bronze: barrel, trunnions, vent and dolphins, in its own frame:
//           the trunnion axis is z through the origin and the bore runs
//           along +x, so the scene turns it to the launch angle about z
//   wood    the oak cheeks, axletrees and transom, in the scene's frame
//           (trunnions at y = launchY). _tube carries grain coordinates:
//           (along the grain, two offsets from the log's heart, seed)
//   iron    the trucks, axle arms, cap squares and bolts
//
// The grain is drawn by the oak's fragment shader: the parts are a few
// hundred flat faces, far too coarse to hold it in vertex colours.
// ─────────────────────────────────────────────────────────────────────

export const CANNON_GLB = "/models/cannon.glb";
export const CANNON = CANNON_MODEL;

const GRAIN_VERTEX = /* glsl */ `
attribute vec4 _tube;
varying vec4 vGrain;
`;

const GRAIN_FRAGMENT = /* glsl */ `
varying vec4 vGrain;
float grainHash(float n) { return fract(sin(n) * 43758.5453); }
float grainNoise(float x) {
  float i = floor(x);
  float f = fract(x);
  return mix(grainHash(i), grainHash(i + 1.0), f * f * (3.0 - 2.0 * f));
}
`;

/** Oak: growth rings round each part's own log, wavering along the grain. */
function makeOakMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${GRAIN_VERTEX}`)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGrain = _tube;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${GRAIN_FRAGMENT}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float along = vGrain.x * 4.0 + vGrain.w * 37.0;
        // the rings drift gently along the grain, as a real log's do
        float wobble = 0.006 * (grainNoise(along) - 0.5) + 0.0025 * (grainNoise(along * 4.3) - 0.5);
        float r = length(vGrain.yz) + wobble;
        float ring = fract(r * 120.0 + vGrain.w * 5.0);
        // late wood: a thin dark band at the end of each year's growth
        float late = smoothstep(0.75, 0.9, ring) * (1.0 - smoothstep(0.93, 1.0, ring));
        // each year's growth a slightly different shade, and fine pores along the grain
        float year = grainNoise(floor(r * 120.0) * 1.7 + vGrain.w * 11.0);
        float pore = grainNoise(along * 40.0 + r * 1500.0);
        float aa = clamp(fwidth(r * 120.0) * 1.5, 0.0, 1.0);
        float shade = (0.93 + 0.1 * year) * (1.0 - 0.22 * late) * (1.0 - 0.05 * pore);
        diffuseColor.rgb *= mix(shade, 0.92, aa);`,
      );
  };
  return m;
}

/** The cannon at `angleDeg` of elevation, trunnions at (0, launchY, 0). */
export function CannonModel({ angleDeg = 45 }) {
  const parts = usePackedModel(CANNON_GLB);
  const materials = useMemo(
    () => ({
      // gun bronze: the studio environment gives it something to reflect
      barrel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.9 }),
      wood: makeOakMaterial(),
      // painted iron: dark and satin, not polished
      iron: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.55 }),
    }),
    [],
  );
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);
  return (
    <group>
      {["wood", "iron"].map((name) =>
        parts[name] ? <mesh key={name} geometry={parts[name].geometry} material={materials[name]} castShadow receiveShadow /> : null,
      )}
      <group position={[0, CANNON.launchY, 0]} rotation={[0, 0, (angleDeg * Math.PI) / 180]}>
        {parts.barrel ? <mesh geometry={parts.barrel.geometry} material={materials.barrel} castShadow receiveShadow /> : null}
      </group>
    </group>
  );
}

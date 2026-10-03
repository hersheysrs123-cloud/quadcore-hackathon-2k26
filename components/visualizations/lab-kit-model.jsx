"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { usePackedModel } from "@/components/visualizations/plant-model";
import { LAB_KIT_MODEL } from "@/components/visualizations/lab-kit-model-meta";

// ─── The lab kit ────────────────────────────────────────────────────
// The bench apparatus the lab scenes share, modelled in Blender by
// scripts/labkit-model (no third-party mesh) into one GLB,
// `public/models/lab-kit.glb`. Each node is one part, in the frame of the
// component it replaced, so a scene draws it where the old stack of
// primitives stood:
//
//   stand     standBase, bossHead, bossScrews, clampSteel, clampCork
//   burner    burnerBase, burnerBarrel, burnerInlet, burnerValve (turns
//             about x at meta.burner.valveAt), burnerCollar (turns about y
//             at meta.burner.collarY; its air holes line up with the
//             barrel's at 0)
//   tripod    tripodRing, tripodLeg (top at its origin, foot at y = -1:
//             scaled to the tripod's height, one at each meta.tripod.legAngles)
//   supply    psuCase, psuTrim, psuKnob (turns about z), psuPostBrass, psuPostCaps
//   counting  scaler, hvSupply, gmTube, gmTrim, gmStand, roundFoot, leadCastle
//   circuit   bulbHolder, bulbBase, bulbGlass, bulbWires, cellWrap,
//             cellSteel, batteryHolder, batteryContacts, postMetal,
//             postCap (white: tinted by `color`), switchBase, switchMetal,
//             switchHandle, meterCase
//   induction galvoCase, galvoBezel, lampHolder, lampCap, lampGlass
//   gas       gasTurret, gasValve, gasLever (turns about y at its hub)
//
// Anything a slider stretches — stand rods and arms, a ring's radius, a
// flame, a display, a needle — stays in three.js beside these.
// ─────────────────────────────────────────────────────────────────────

export const LAB_KIT_GLB = "/models/lab-kit.glb";
export const LAB_KIT = LAB_KIT_MODEL;

/** What each node is made of. Metals reflect the scenes' studio environment. */
const FINISH = {
  painted: { roughness: 0.55, metalness: 0.3 },
  enamel: { roughness: 0.42, metalness: 0.15 },
  steel: { roughness: 0.3, metalness: 0.85 },
  brass: { roughness: 0.3, metalness: 0.9 },
  lead: { roughness: 0.62, metalness: 0.45 },
  cork: { roughness: 0.9, metalness: 0 },
  plastic: { roughness: 0.45, metalness: 0.05 },
  porcelain: { roughness: 0.22, metalness: 0.02 },
  glass: { roughness: 0.04, metalness: 0, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide },
};

const NODE_FINISH = {
  standBase: "painted",
  bossHead: "painted",
  bossScrews: "brass",
  clampSteel: "steel",
  clampCork: "cork",
  burnerBase: "painted",
  burnerBarrel: "steel",
  burnerInlet: "brass",
  burnerValve: "brass",
  burnerCollar: "brass",
  tripodRing: "steel",
  tripodLeg: "steel",
  psuCase: "enamel",
  psuTrim: "plastic",
  psuKnob: "plastic",
  psuPostBrass: "brass",
  psuPostCaps: "plastic",
  scaler: "plastic",
  hvSupply: "plastic",
  gmTube: "steel",
  gmTrim: "plastic",
  gmStand: "painted",
  roundFoot: "painted",
  leadCastle: "lead",
  bulbHolder: "porcelain",
  bulbBase: "brass",
  bulbGlass: "glass",
  bulbWires: "steel",
  cellWrap: "plastic",
  cellSteel: "steel",
  batteryHolder: "plastic",
  batteryContacts: "steel",
  postMetal: "brass",
  postCap: "plastic",
  switchBase: "porcelain",
  switchMetal: "brass",
  switchHandle: "plastic",
  meterCase: "plastic",
  galvoCase: "plastic",
  galvoBezel: "steel",
  lampHolder: "porcelain",
  lampCap: "brass",
  lampGlass: "glass",
  gasTurret: "enamel",
  gasValve: "brass",
  gasLever: "plastic",
};

/** A part's material: its finish, tinted by `color` and `shade`, lit by `emissive`. */
function makeMaterial(name, color, shade, emissive, emissiveIntensity) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, ...FINISH[NODE_FINISH[name] ?? "plastic"] });
  if (color) m.color.set(color);
  if (shade) m.color.multiplyScalar(shade);
  if (emissive) {
    m.emissive.set(emissive);
    m.emissiveIntensity = emissiveIntensity ?? 0;
  }
  return m;
}

/**
 * One part of the kit, drawn in its own frame. `color` tints it (the white
 * binding-post caps take their colour from it); `shade` scales its colours,
 * above 1 to lighten a part for a darker scene. Each part has a material of
 * its own: the studio environment patches materials per scene, so sharing
 * one across scenes would carry a stale reflection map. Must be under a
 * Suspense.
 */
export function KitPart({ name, color, shade, emissive, emissiveIntensity, castShadow = true, ...props }) {
  const parts = usePackedModel(LAB_KIT_GLB);
  const material = useMemo(() => makeMaterial(name, color, shade, emissive, emissiveIntensity), [name, color, shade, emissive, emissiveIntensity]);
  useEffect(() => () => material.dispose(), [material]);
  const part = parts[name];
  if (!part) return null;
  return (
    <mesh
      geometry={part.geometry}
      material={material}
      castShadow={castShadow && NODE_FINISH[name] !== "glass"}
      receiveShadow={NODE_FINISH[name] !== "glass"}
      {...props}
    />
  );
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePackedModel } from "@/components/visualizations/plant-model";
import { COASTER_CAR_MODEL } from "@/components/visualizations/coaster-car-model-meta";

// ─── Our roller-coaster car ─────────────────────────────────────────
// Modelled in Blender by scripts/coaster-model (no third-party mesh), in
// METRES in the car's frame: x forward, y up, z across, standing on rails
// whose centres are at y = 0, z = ±0.7. `public/models/coaster-car.glb`:
//
//   shell      the fibreglass body: amber gelcoat, white side stripe
//   seats      upholstered benches, backrests and headrests
//   riders     four riders, two with their arms up
//   pad        the lap bars' padding
//   steel      chassis, wheel carriers, couplings and lap-bar posts
//   roadWheel  running wheel (on top of the rail), turning about z
//   upWheel    upstop wheel (under the rail), turning about z
//   guideWheel guide wheel (outside the rail), turning about y
//
// Each wheel is one mesh drawn at every position the meta lists, and turned
// by how far the car has travelled: they roll on the rail, so each spins at
// distance / radius, and the upstop and guide wheels the way their contact
// with the rail makes them.
// ─────────────────────────────────────────────────────────────────────

export const COASTER_CAR_GLB = "/models/coaster-car.glb";
export const COASTER_CAR = COASTER_CAR_MODEL;

const BODY = ["shell", "seats", "riders", "pad", "steel"];

/** The car. `travelRef.current` is the distance it has run along the track, metres. */
export function CoasterCarModel({ travelRef }) {
  const parts = usePackedModel(COASTER_CAR_GLB);
  const wheels = useRef([]);
  const materials = useMemo(() => {
    // gelcoat: a clear coat over the colour, so the studio shows in it
    const shell = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.12 });
    shell.userData.envReflect = 0.55;
    return {
      shell,
      seats: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
      riders: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
      pad: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }),
      steel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.8 }),
      wheel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25 }),
    };
  }, []);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  // every wheel: its node, where it sits, and its spin per metre travelled
  const placed = useMemo(() => {
    const W = COASTER_CAR.wheels;
    const out = [];
    W.road.at.forEach((p) => out.push({ node: "roadWheel", p, axis: "z", perMetre: -1 / W.road.r }));
    W.up.at.forEach((p) => out.push({ node: "upWheel", p, axis: "z", perMetre: 1 / W.up.r }));
    W.guide.at.forEach((p) => out.push({ node: "guideWheel", p, axis: "y", perMetre: Math.sign(p[2]) / W.guide.r }));
    return out;
  }, []);

  useFrame(() => {
    const s = travelRef?.current ?? 0;
    placed.forEach((w, i) => {
      const g = wheels.current[i];
      if (g) g.rotation[w.axis] = s * w.perMetre;
    });
  });

  return (
    <group>
      {BODY.map((name) =>
        parts[name] ? <mesh key={name} geometry={parts[name].geometry} material={materials[name]} castShadow receiveShadow /> : null,
      )}
      {placed.map((w, i) =>
        parts[w.node] ? (
          <group key={i} position={w.p} ref={(g) => (wheels.current[i] = g)}>
            <mesh geometry={parts[w.node].geometry} material={materials.wheel} castShadow />
          </group>
        ) : null,
      )}
    </group>
  );
}

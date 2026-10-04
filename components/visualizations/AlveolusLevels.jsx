"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Callout, ToggleLabel, hashRandom } from "@/components/visualizations/scene-kit";
import { ScaleBar, ZoomHotspot, polyline, toPoints as toArr } from "@/components/visualizations/tissue-zoom";
import {
  ALVEOLI,
  bloodColour,
  makeBloodMaterial,
  makeBloodUniforms,
  setBloodUniforms,
  squeezedRbc,
  useAlveoliModel,
} from "@/components/visualizations/alveoli-model";
import { profileAt } from "@/lib/gasExchange";

// ─── The respiratory scene, zoomed in ───────────────────────────────
// Two levels below the chest (see tissue-zoom.jsx for the dive between
// them):
//
//   ALVEOLI   an alveolar duct and its sac (scripts/lung-model), the
//             capillary net over every alveolus coloured by the blood's
//             oxygen saturation along it, red cells running arteriole →
//             capillary → venule, air moving in and out of the duct with
//             the breath, the whole sac swelling a little as it fills
//   BARRIER   one septum cut open through a capillary: red cells squeezing
//             through single file and turning scarlet as they go, O₂
//             crossing down and CO₂ crossing up — in BOTH directions, at
//             rates set by each side's partial pressure, so the net flow is
//             visibly down the gradient and stops where the gradient does
//
// Everything is driven by lib/gasExchange.js's `solveGasExchange`; the
// blood's colour at each point is the solved saturation there.
// ─────────────────────────────────────────────────────────────────────

/** Acinus units (50 µm) to world units, and the acinus's centre. */
export const ACINUS_SCALE = 0.42;
const ACINUS_MID_Y = 1.45;
/** Septum units (µm) to world units. */
export const SEPTUM_SCALE = 0.26;
const SEPTUM_MID = [0, -0.9, -2];

/** Real capillary seconds shown per screen second. */
export const SLOW_MOTION = 8;

// The respiratory panel covers the left of the canvas, so each view is
// centred left of its content and wide enough to leave the model clear of it.
export const ACINUS_VIEW = { cx: -1.3, cy: 0, cz: 0, width: 11.4, height: 7.6, depth: 4 };
export const SEPTUM_VIEW = { cx: -1.0, cy: 0.1, cz: 0, width: 13.4, height: 5.6, depth: 2 };

/** The point on alveolus `i`'s surface facing the camera's default view: where the dive goes. */
export function acinusFocus() {
  const a = ALVEOLI.acinus.alveoli;
  let best = 0;
  let score = -Infinity;
  for (let i = 0; i < a.length / 4; i += 1) {
    const [x, y, z] = [a[i * 4], a[i * 4 + 1], a[i * 4 + 2]];
    // front-left, mid-height: exposed (not in the cut quarter) and facing us
    const s = z - Math.abs(x + 2.2) * 0.6 - Math.abs(y - 0.5) * 0.4 - (x > 0 ? 9 : 0);
    if (s > score) {
      score = s;
      best = i;
    }
  }
  const c = new THREE.Vector3(a[best * 4], a[best * 4 + 1], a[best * 4 + 2]);
  const dir = new THREE.Vector3(0.15, 0.1, 1).normalize();
  const p = c.addScaledVector(dir, a[best * 4 + 3] + 0.15);
  return [p.x * ACINUS_SCALE, (p.y - ACINUS_MID_Y) * ACINUS_SCALE, p.z * ACINUS_SCALE];
}

// ─── Level: the alveolar sac ────────────────────────────────────────

const RBC_PER_PATH = 3;
const VESSEL_SPEED = 3.2; // acinus units per screen second
const HIDDEN_S = 0.5;

function AcinusBlood({ solved, speed }) {
  const ac = ALVEOLI.acinus;
  const ref = useRef(null);
  const plan = useMemo(() => {
    const art = polyline(toArr(ac.arteriole));
    const vens = ac.venules.map((v) => toArr(v));
    // In exercise capillaries shut at rest open: more of the paths carry cells.
    const active = solved.exercise ? 1 : 0.6;
    const paths = ac.paths
      .filter((_, i) => hashRandom(i * 7.3 + 1) < active)
      .map((p) => ({ cap: polyline(toArr(p.pts)), ven: polyline(vens[p.v].slice(p.at)) }));
    const cells = [];
    paths.forEach((p, k) => {
      for (let j = 0; j < RBC_PER_PATH; j += 1) cells.push({ path: k, phase: hashRandom(k * 13.1 + j * 5.7) });
    });
    return { art, paths, cells };
  }, [ac, solved.exercise]);

  const clock = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colour = useMemo(() => new THREE.Color(), []);
  const at = useMemo(() => new THREE.Vector3(), []);
  const venous = useMemo(() => bloodColour(solved.venousSat), [solved.venousSat]);
  const arterial = useMemo(() => bloodColour(solved.endSat), [solved.endSat]);

  useFrame((_, raw) => {
    const m = ref.current;
    if (!m) return;
    clock.current += Math.min(Math.max(raw, 1 / 60), 1 / 20) * speed;
    const capS = solved.transitS * SLOW_MOTION;
    plan.cells.forEach((c, i) => {
      const p = plan.paths[c.path];
      const tA = plan.art.length / VESSEL_SPEED;
      const tV = p.ven.length / VESSEL_SPEED;
      const T = tA + HIDDEN_S + capS + HIDDEN_S + tV;
      let t = (clock.current / T + c.phase) % 1;
      t *= T;
      let visible = true;
      if (t < tA) {
        plan.art.at(t * VESSEL_SPEED, at);
        colour.copy(venous);
      } else if (t < tA + HIDDEN_S) {
        visible = false;
      } else if (t < tA + HIDDEN_S + capS) {
        const f = (t - tA - HIDDEN_S) / capS;
        p.cap.at(f * p.cap.length, at);
        bloodColour(profileAt(solved, f).sat, colour);
      } else if (t < tA + 2 * HIDDEN_S + capS) {
        visible = false;
      } else {
        p.ven.at((t - tA - 2 * HIDDEN_S - capS) * VESSEL_SPEED, at);
        colour.copy(arterial);
      }
      dummy.position.copy(at);
      dummy.scale.setScalar(visible ? 1 : 0);
      dummy.rotation.set(c.phase * 6, c.phase * 9, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, colour);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[null, null, plan.cells.length]} frustumCulled={false} key={plan.cells.length}>
      <sphereGeometry args={[0.1, 10, 8]} />
      <meshStandardMaterial roughness={0.4} emissive="#ffffff" emissiveIntensity={0.08} />
    </instancedMesh>
  );
}

/** Air in the bronchiole and duct, moving with the breath. */
function AcinusAir({ breathRef, speed, airColour }) {
  const COUNT = 70;
  const ref = useRef(null);
  const seeds = useMemo(() => Array.from({ length: COUNT }, (_, i) => ({ u: hashRandom(i * 3.1), a: hashRandom(i * 7.7) * Math.PI * 2, r: Math.sqrt(hashRandom(i * 1.9)) })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, raw) => {
    const m = ref.current;
    if (!m) return;
    const dt = Math.min(Math.max(raw, 1 / 60), 1 / 20) * speed;
    // negative flow is air going in
    const flow = -(breathRef?.current?.flowLps ?? -0.3);
    seeds.forEach((s, i) => {
      s.u = (s.u + flow * dt * 0.09 + 1) % 1;
      const y = ALVEOLI.acinus.top - s.u * (ALVEOLI.acinus.top + 2.6);
      const rad = (y > ALVEOLI.acinus.ductTop ? 0.85 : 1.05) * s.r;
      dummy.position.set(Math.cos(s.a) * rad, y, Math.sin(s.a) * rad - 0.2);
      dummy.scale.setScalar(Math.abs(flow) > 0.03 ? 1 : 0.6);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, COUNT]} frustumCulled={false}>
      <sphereGeometry args={[0.07, 8, 6]} />
      <meshBasicMaterial color={airColour} transparent opacity={0.85} toneMapped={false} />
    </instancedMesh>
  );
}

export function AcinusLevel({ solved, breathRef, speed = 1, showLabels = true, onZoom, focus }) {
  const parts = useAlveoliModel();
  const uniforms = useMemo(() => makeBloodUniforms(), []);
  const blood = useMemo(() => makeBloodMaterial(uniforms), [uniforms]);
  useEffect(() => () => blood.dispose(), [blood]);
  useEffect(() => setBloodUniforms(uniforms, solved, profileAt), [uniforms, solved]);
  const group = useRef(null);
  useFrame(() => {
    // Alveoli swell a little as the lungs fill: ±20 % of volume is ±6 % across.
    const e = breathRef?.current?.expansion ?? 0;
    if (group.current) group.current.scale.setScalar(ACINUS_SCALE * (1 + 0.035 * e));
  });
  const S = (x, y, z) => [x * ACINUS_SCALE, (y - ACINUS_MID_Y) * ACINUS_SCALE, z * ACINUS_SCALE];
  const emphysema = solved.condition.short === "emphysema";
  return (
    <group>
      <group position={[0, -ACINUS_MID_Y * ACINUS_SCALE, 0]}>
        <group ref={group} scale={ACINUS_SCALE}>
          <mesh geometry={parts.acinus.geometry}>
            <meshStandardMaterial vertexColors roughness={0.72} metalness={0} side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={parts.capillaries.geometry} material={blood} />
          <mesh geometry={parts.vessels.geometry} material={blood} />
          <AcinusBlood solved={solved} speed={speed} />
          <AcinusAir breathRef={breathRef} speed={speed} airColour="#bae6fd" />
        </group>
      </group>
      {showLabels && (
        <group>
          <Callout anchor={S(0.6, 8.6, 1.1)} at={[2.9, 3.6, 0.4]} side="right">respiratory bronchiole</Callout>
          <Callout anchor={S(0.2, 2.6, 0.6)} at={[2.9, 2.5, 0.4]} side="right">alveolar duct</Callout>
          <Callout anchor={S(1.6, -0.9, 2.2)} at={[2.9, 1.2, 0.4]} side="right">alveolus · cut open, hollow</Callout>
          <Callout anchor={S(0.9, -1.8, 0.05)} at={[2.9, 0.1, 0.4]} side="right">septum · shared wall</Callout>
          <Callout anchor={S(1.4, -4.2, 1.0)} at={[2.9, -1.2, 0.4]} side="right">alveolar sac</Callout>
          <Callout anchor={S(-0.5, 7.5, -1.6)} at={[-3.0, 3.4, 0.4]} side="left">pulmonary arteriole · from the heart</Callout>
          <Callout anchor={S(-3.6, 1.0, 1.2)} at={[-3.0, 1.9, 0.4]} side="left">capillary network</Callout>
          <Callout anchor={S(-4.9, -1.6, 0.9)} at={[-3.0, -0.6, 0.4]} side="left">pulmonary venule · to the heart</Callout>
        </group>
      )}
      {emphysema && (
        <ToggleLabel position={[0, -3.75, 0.5]} tone="text-amber-300">
          emphysema: walls like these break down, alveoli merge, a third of the area is left
        </ToggleLabel>
      )}
      <ScaleBar position={[-2.6, -3.4, 0.6]} length={2 * ACINUS_SCALE} text="100 µm" />
      {onZoom && focus && <ZoomHotspot position={focus} radius={0.32} label="the wall the gas crosses · ×4000" onZoom={onZoom} />}
    </group>
  );
}

// ─── Level: the barrier ─────────────────────────────────────────────

const RBC_GAP = 9.6; // µm between cells
const RBC_SPEED = 5.5; // µm per screen second at rest
const MOLECULES = 90;

/** O₂ as two touching red spheres, CO₂ as grey carbon between two red oxygens (not to scale: a molecule is ~0.0003 µm). */
function moleculeGeometry(kind) {
  const parts = [];
  if (kind === "o2") {
    for (const x of [-0.17, 0.17]) parts.push(new THREE.SphereGeometry(0.2, 10, 8).translate(x, 0, 0));
  } else {
    parts.push(new THREE.SphereGeometry(0.21, 10, 8));
    for (const x of [-0.36, 0.36]) parts.push(new THREE.SphereGeometry(0.17, 10, 8).translate(x, 0, 0));
  }
  const pos = [];
  const nrm = [];
  const col = [];
  const red = new THREE.Color("#ef4444");
  const grey = new THREE.Color("#3f3f46");
  parts.forEach((g, k) => {
    const n = g.attributes.position.count;
    const ix = g.index.array;
    const c = kind === "co2" && k === 0 ? grey : red;
    for (let i = 0; i < ix.length; i += 1) {
      const j = ix[i];
      pos.push(g.attributes.position.getX(j), g.attributes.position.getY(j), g.attributes.position.getZ(j));
      nrm.push(g.attributes.normal.getX(j), g.attributes.normal.getY(j), g.attributes.normal.getZ(j));
      col.push(c.r, c.g, c.b);
    }
    void n;
    g.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return out;
}

function SeptumRbcs({ solved, speed, parts }) {
  const sp = ALVEOLI.septum;
  const ref = useRef(null);
  const geometry = useMemo(() => squeezedRbc(parts.rbc, 0.3), [parts.rbc]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const span = sp.x[1] - sp.x[0] + 2 * RBC_GAP;
  const count = Math.ceil(span / RBC_GAP);
  const clock = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colour = useMemo(() => new THREE.Color(), []);
  useFrame((_, raw) => {
    const m = ref.current;
    if (!m) return;
    // exercise: three times the speed through the same capillary
    clock.current += Math.min(Math.max(raw, 1 / 60), 1 / 20) * speed * RBC_SPEED * (0.75 / solved.transitS);
    for (let i = 0; i < count; i += 1) {
      const x = sp.x[0] - RBC_GAP + ((clock.current + i * RBC_GAP) % span);
      const f = (x - sp.x[0]) / (sp.x[1] - sp.x[0]);
      dummy.position.set(x, sp.axisY, -0.9);
      dummy.rotation.set(i * 0.7, 0, -Math.PI / 2);
      // the cell is wider than the lumen: it is folded to fit
      dummy.scale.set(0.82, 0.82, 0.82);
      const inside = f > -0.02 && f < 1.02;
      if (!inside) dummy.scale.setScalar(0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      bloodColour(profileAt(solved, f).sat, colour);
      m.setColorAt(i, colour);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geometry, null, count]} frustumCulled={false}>
      <meshStandardMaterial roughness={0.42} metalness={0} />
    </instancedMesh>
  );
}

/**
 * Molecules crossing the thin side, both ways. A slot is born in the air (going
 * down) or at a red cell (going up) at a rate set by that side's partial
 * pressure at that point along the capillary: the down-rate is the same
 * everywhere, the up-rate rises as the blood loads, and where they match
 * there is no net flow at all.
 */
function Crossings({ solved, speed, kind }) {
  const sp = ALVEOLI.septum;
  const ref = useRef(null);
  const geometry = useMemo(() => moleculeGeometry(kind), [kind]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const yTop = sp.axisY + sp.lumen + sp.thin;
  const slots = useMemo(
    () =>
      Array.from({ length: MOLECULES }, () => ({ live: false, t: 0, life: 1, x: 0, z: 0, down: true, wob: 0 })),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const pending = useRef(0);
  const seed = useRef(kind === "o2" ? 1 : 77);
  const rnd = () => {
    seed.current += 1;
    return hashRandom(seed.current * 1.618 + (kind === "o2" ? 0.3 : 0.7));
  };
  // Molecules a screen second per kPa, so O₂ at 13 kPa is a steady trickle.
  const RATE = kind === "o2" ? 1.6 : 2.6;
  useFrame((_, raw) => {
    const m = ref.current;
    if (!m) return;
    const dt = Math.min(Math.max(raw, 1 / 60), 1 / 20) * speed;
    // births, both directions, by partial pressure on each side at a random x
    pending.current += dt * RATE * (kind === "o2" ? solved.pao2 + solved.pvo2 : solved.paco2 + solved.pvco2);
    while (pending.current >= 1) {
      pending.current -= 1;
      const slot = slots.find((s) => !s.live);
      if (!slot) break;
      const f = rnd();
      const local = profileAt(solved, f);
      const air = kind === "o2" ? solved.pao2 : solved.paco2;
      const blood = kind === "o2" ? local.po2 : local.pco2;
      // pick a direction in proportion to the two sides' pressures here
      const down = rnd() < air / (air + blood);
      Object.assign(slot, { live: true, t: 0, life: 1.6 + rnd() * 0.6, x: sp.x[0] + f * (sp.x[1] - sp.x[0]), z: -0.4 - rnd() * 2.2, down, wob: rnd() * 6.28 });
    }
    slots.forEach((s, i) => {
      if (s.live) {
        s.t += dt / s.life;
        if (s.t >= 1) s.live = false;
      }
      if (!s.live) {
        dummy.scale.setScalar(0);
      } else {
        // air (5 µm above) → the barrier → the red cell's edge, or back
        const u = s.down ? s.t : 1 - s.t;
        const yAir = yTop + 4.2;
        const yCell = sp.axisY + 1.6;
        const y = u < 0.55 ? yAir + (yTop - yAir) * (u / 0.55) : u < 0.7 ? yTop + (yTop - sp.thin - 0.2 - yTop) * ((u - 0.55) / 0.15) : yTop - sp.thin - 0.2 + (yCell - (yTop - sp.thin - 0.2)) * ((u - 0.7) / 0.3);
        const jig = 0.25 * Math.sin(s.wob + s.t * 9) * (u < 0.55 ? 1 : 0.3);
        dummy.position.set(s.x + jig, y, s.z);
        dummy.rotation.set(s.wob, s.t * 4 + s.wob, s.wob * 0.5);
        const fade = Math.min(1, s.t * 6, (1 - s.t) * 6);
        dummy.scale.setScalar(fade);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geometry, null, MOLECULES]} frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={0.35} emissive={kind === "o2" ? "#7f1d1d" : "#18181b"} emissiveIntensity={0.4} />
    </instancedMesh>
  );
}

/** Fibrosis: scar tissue laid down on the thin side pushes the epithelium out from the capillary. */
function useThickening(material, extraUm) {
  const uniforms = useMemo(() => ({ uExtra: { value: 0 } }), []);
  useEffect(() => {
    const sp = ALVEOLI.septum;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uExtra = uniforms.uExtra;
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform float uExtra;").replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          vec2 r = vec2(transformed.y - ${sp.axisY.toFixed(3)}, transformed.z);
          float len = length(r);
          vec2 dir = r / max(len, 1e-4);
          // only above the capillary: the thin side
          float top = smoothstep(0.15, 0.6, dir.x);
          float near = 1.0 - smoothstep(${(sp.lumen + 1.5).toFixed(3)}, ${(sp.lumen + 3.0).toFixed(3)}, len);
          transformed.yz += dir * uExtra * top * near;
        }`,
      );
    };
    material.customProgramCacheKey = () => "septum-thicken";
    material.needsUpdate = true;
  }, [material, uniforms]);
  useFrame((_, raw) => {
    const v = uniforms.uExtra.value;
    uniforms.uExtra.value = v + (extraUm - v) * (1 - Math.exp(-Math.min(raw, 0.1) * 4));
  });
}

function ScarLayer({ geometry, extraUm }) {
  // The basement membrane's outer surface goes out with the epithelium; the
  // gap it leaves is the scar: the shell rendered thick, in collagen white.
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f3e8de", roughness: 0.8 }), []);
  useEffect(() => () => material.dispose(), [material]);
  useThickening(material, extraUm);
  return <mesh geometry={geometry} material={material} />;
}

function Thickened({ geometry, extraUm, roughness = 0.6 }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness, side: THREE.DoubleSide }), [roughness]);
  useEffect(() => () => material.dispose(), [material]);
  useThickening(material, extraUm);
  return <mesh geometry={geometry} material={material} />;
}

export function SeptumLevel({ solved, speed = 1, showLabels = true }) {
  const parts = useAlveoliModel();
  const sp = ALVEOLI.septum;
  const extra = Math.max(0, solved.thicknessUm - sp.thin);
  const S = (x, y, z) => [(x - SEPTUM_MID[0]) * SEPTUM_SCALE, (y - SEPTUM_MID[1]) * SEPTUM_SCALE, (z - SEPTUM_MID[2]) * SEPTUM_SCALE];
  const yTop = sp.axisY + sp.lumen + sp.thin;
  const pao = solved.pao2.toFixed(1);
  return (
    <group>
      <group scale={SEPTUM_SCALE} position={S(0, 0, 0)}>
        <Thickened geometry={parts.septumEpithelium.geometry} extraUm={extra} />
        {extra > 0.05 && <ScarLayer geometry={parts.septumBasement.geometry} extraUm={extra} />}
        <mesh geometry={parts.septumBasement.geometry}>
          <meshStandardMaterial vertexColors roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={parts.septumEndothelium.geometry}>
          <meshStandardMaterial vertexColors roughness={0.55} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={parts.septumInterstitium.geometry}>
          <meshStandardMaterial vertexColors roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={parts.septumTypeTwo.geometry}>
          <meshStandardMaterial vertexColors roughness={0.6} />
        </mesh>
        <Thickened geometry={parts.septumMacrophage.geometry} extraUm={extra} roughness={0.75} />
        <SeptumRbcs solved={solved} speed={speed} parts={parts} />
        <Crossings solved={solved} speed={speed} kind="o2" />
        <Crossings solved={solved} speed={speed} kind="co2" />
      </group>
      <ToggleLabel position={S(-9, yTop + 5.6, -1)} tone="text-sky-200">
        {`alveolar air · PO₂ ${pao} kPa`}
      </ToggleLabel>
      <ToggleLabel position={S(-11.8, sp.axisY, 1.5)} tone="text-violet-300">
        blood arriving
      </ToggleLabel>
      <ToggleLabel position={S(11.8, sp.axisY, 1.5)} tone="text-rose-300">
        blood leaving
      </ToggleLabel>
      {showLabels && (
        <group>
          {/* One column on the right: the respiratory panel covers the left of the canvas. */}
          <Callout anchor={S(sp.macrophage[0], sp.macrophage[1] + extra, sp.macrophage[2])} at={[4.1, 2.35, 0.6]} side="right">alveolar macrophage · eats dust</Callout>
          <Callout anchor={S(2.0, yTop + extra - 0.1, 0)} at={[4.1, 1.8, 0.6]} side="right">type I cell · thin as cling film</Callout>
          <Callout anchor={S(0.5, yTop - sp.epithelium - 0.06, 0)} at={[4.1, 1.25, 0.6]} side="right">basement membrane · fused</Callout>
          <Callout anchor={S(-0.5, sp.axisY + sp.lumen + 0.1, 0)} at={[4.1, 0.7, 0.6]} side="right">capillary endothelium</Callout>
          <Callout anchor={S(5.5, sp.axisY, 1.0)} at={[4.1, 0.15, 0.6]} side="right">red cell · squeezed single file</Callout>
          <Callout anchor={S(1.5, sp.axisY - sp.lumen - 1.4, 0)} at={[4.1, -0.6, 0.6]} side="right">interstitium · the thick side</Callout>
          <Callout anchor={S(sp.typeTwo[0], sp.typeTwo[1], 0.2)} at={[4.1, -1.4, 0.6]} side="right">type II cell · makes surfactant</Callout>
        </group>
      )}
      <ToggleLabel position={S(0, yTop + extra + 0.9, 1.4)} tone={extra > 0.05 ? "text-amber-300" : "text-ink-200"}>
        {`air → blood: ${solved.thicknessUm.toFixed(1)} µm${extra > 0.05 ? " · thickened by scar" : ""}`}
      </ToggleLabel>
      <ScaleBar position={[-1.6, -2.4, 0.6]} length={5 * SEPTUM_SCALE} text="5 µm" />
    </group>
  );
}

"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Callout, ToggleLabel, hashRandom } from "@/components/visualizations/scene-kit";
import { ScaleBar, ZoomHotspot, polyline, toPoints } from "@/components/visualizations/tissue-zoom";
import {
  VILLUS,
  VILLUS_COLOURS,
  atrophiedVillus,
  makeFloorMaterial,
  makeVesselMaterial,
  makeVillusLowMaterial,
  makeVillusMaterial,
  makeWallMaterial,
  useVillusModel,
  villusSites,
} from "@/components/visualizations/villus-model";
import { GUT_CONDITIONS, NUTRIENTS } from "@/lib/absorption";

// ─── The peristalsis scene, zoomed in ───────────────────────────────
// Two levels below the gut (tissue-zoom.jsx dives between them):
//
//   LINING   a block of small-intestine wall opened out (scripts/
//            villus-model): two circular folds, every surface carpeted
//            with villi swaying in the chyme, the layers of the wall cut
//            on the front. Coeliac disease shrinks every villus to a stub.
//   VILLUS   one villus dissected in three storeys: the capillary net under
//            the peeled-off tip, a section through the middle with the
//            lacteal laid open, and the crypts in the mucosa below. Red
//            cells run up the arteriole and down the capillaries; digested
//            food crosses the epithelium in the section and goes its own
//            way — glucose and amino acids into the capillaries, fats
//            rebuilt into chylomicrons and into the lacteal. The share of a
//            meal each makes up, and how much of it gets absorbed at all,
//            come from lib/absorption.js.
// ─────────────────────────────────────────────────────────────────────

export const WALL_SCALE = 0.62;
const WALL_MID = 0.4;
export const VILLUS_SCALE = 0.1;
const VILLUS_MID = 14;

export const WALL_VIEW = { cx: 0, cy: 0.05, cz: 0, width: 8.6, height: 5.0, depth: 5 };
export const VILLUS_VIEW = { cx: 0.1, cy: 0, cz: 0, width: 8.2, height: 8.8, depth: 4 };

const ATROPHY_HEIGHT = GUT_CONDITIONS.coeliac.villusHeight;
/** How far a villus has shrunk, 0 (healthy) to 1 (the coeliac stub). */
const atrophyOf = (villusHeight) => Math.min(1, Math.max(0, (1 - villusHeight) / (1 - ATROPHY_HEIGHT)));

const dt = (raw) => Math.min(Math.max(raw, 1 / 60), 1 / 20);

// ─── Level: the lining ──────────────────────────────────────────────

function VillusCarpet({ parts, atrophy }) {
  const ref = useRef(null);
  const sites = useMemo(() => villusSites(parts.villusSites), [parts.villusSites]);
  const geometry = useMemo(() => atrophiedVillus(parts.villusLow, atrophy), [parts.villusLow, atrophy]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const material = useMemo(() => makeVillusLowMaterial(uniforms), [uniforms]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion();
    const yaw = new THREE.Quaternion();
    sites.forEach((s, i) => {
      q.setFromUnitVectors(up, s.n);
      yaw.setFromAxisAngle(up, hashRandom(i * 3.3) * Math.PI * 2);
      o.position.copy(s.p);
      o.quaternion.copy(q).multiply(yaw);
      o.scale.setScalar(0.85 + 0.3 * hashRandom(i * 5.1 + 2));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [sites, geometry]);
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });
  return <instancedMesh ref={ref} args={[geometry, material, sites.length]} key={sites.length} />;
}

/**
 * Chyme drifting over the lining, sloshed back and forth by segmentation.
 * Each speck is one of the meal's digested foods, in the meal's proportions
 * and the key's colours; fat droplets are a little bigger.
 */
function Chyme({ speed, nutrients }) {
  const COUNT = 140;
  const ref = useRef(null);
  const seeds = useMemo(() => Array.from({ length: COUNT }, (_, i) => ({ x: hashRandom(i * 1.7) * 12 - 6, z: hashRandom(i * 2.9) * 7.4 - 3.7, h: 0.75 + hashRandom(i * 4.1) * 1.6, ph: hashRandom(i * 6.7) * 6.28, pick: hashRandom(i * 8.3 + 0.4) })), []);
  const kinds = useMemo(
    () =>
      seeds.map((s) => {
        let acc = 0;
        return nutrients.find((n) => (acc += n.share) > s.pick) ?? nutrients[nutrients.length - 1];
      }),
    [seeds, nutrients],
  );
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const c = new THREE.Color();
    kinds.forEach((n, i) => m.setColorAt(i, c.set(n.colour)));
    m.instanceColor.needsUpdate = true;
  }, [kinds]);
  const o = useMemo(() => new THREE.Object3D(), []);
  const t = useRef(0);
  useFrame((_, raw) => {
    const m = ref.current;
    if (!m) return;
    t.current += dt(raw) * speed;
    seeds.forEach((s, i) => {
      // a slow net drift along the gut, and segmentation's back-and-forth
      s.x += dt(raw) * speed * 0.12;
      if (s.x > 6) s.x -= 12;
      const x = s.x + 0.35 * Math.sin(t.current * 0.9 + s.ph);
      const y = s.h + (s.z * s.z) / (2 * VILLUS.wall.curveR);
      o.position.set(x, y, s.z);
      o.scale.setScalar(Math.abs(x) < 5.9 ? (kinds[i].key === "fats" ? 1.35 : 1) : 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, COUNT]} frustumCulled={false}>
      <icosahedronGeometry args={[0.05, 0]} />
      <meshStandardMaterial roughness={0.7} emissive="#ffffff" emissiveIntensity={0.08} transparent opacity={0.9} />
    </instancedMesh>
  );
}

/**
 * Where the dive into one villus goes, in world units: over the flat lining
 * in front of the second fold, 0.4 mm right of centre and 3 mm towards the
 * viewer, at three-fifths of a villus's height. A constant, so the camera
 * knows its target before the model has loaded.
 */
const FOCUS_MM = [0.4, 3.0];
export const WALL_FOCUS = (() => {
  const [x, z] = FOCUS_MM;
  const y = (z * z) / (2 * VILLUS.wall.curveR) + VILLUS.wall.villusHeight * 0.6;
  return [x * WALL_SCALE, (y - WALL_MID) * WALL_SCALE, z * WALL_SCALE];
})();

export function WallLevel({ solved, speed = 1, showLabels = true, onZoom }) {
  const parts = useVillusModel();
  const material = useMemo(() => makeWallMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  const S = (x, y, z) => [x * WALL_SCALE, (y - WALL_MID) * WALL_SCALE, z * WALL_SCALE];
  const W = VILLUS.wall;
  const front = W.bz;
  const L = W.layers;
  const coeliac = solved.villusHeight < 0.99;
  return (
    <group>
      <group scale={WALL_SCALE} position={[0, -WALL_MID * WALL_SCALE, 0]}>
        <mesh geometry={parts.wall.geometry} material={material} />
        <VillusCarpet parts={parts} atrophy={atrophyOf(solved.villusHeight)} />
        <Chyme speed={speed} nutrients={solved.nutrients} />
      </group>
      {showLabels && (
        <group>
          <Callout anchor={S(W.plicae[0][0], W.plicae[0][1] * 0.8, 1.2)} at={[-4.2, 2.3, 0.4]} side="left">circular fold · ×3 area</Callout>
          <Callout anchor={S(-4.6, 0.45, 1.6)} at={[-4.2, 1.4, 0.4]} side="left">{coeliac ? "villi · flattened stubs" : "villi · ×10 area"}</Callout>
          <Callout anchor={S(5.2, 1.0, 0.0)} at={[3.7, 1.9, 0.4]} side="right">chyme · {solved.meal.label.toLowerCase()}</Callout>
          <Callout anchor={S(5.9, -L.mucosa / 2, front)} at={[3.7, 0.55, 0.4]} side="right">mucosa · crypts</Callout>
          <Callout anchor={S(5.9, -(L.muscularisMucosae + L.submucosa) / 2, front)} at={[3.7, 0.05, 0.4]} side="right">submucosa</Callout>
          <Callout anchor={S(5.9, -(L.submucosa + L.circular) / 2, front)} at={[3.7, -0.45, 0.4]} side="right">circular muscle</Callout>
          <Callout anchor={S(5.9, -(L.circular + L.longitudinal) / 2, front)} at={[3.7, -0.95, 0.4]} side="right">longitudinal muscle</Callout>
        </group>
      )}
      <ScaleBar position={[-3.2, -2.05, 2.2]} length={1 * WALL_SCALE} text="1 mm" />
      {onZoom && <ZoomHotspot position={WALL_FOCUS} radius={0.2} label="one villus · ×10 closer" onZoom={onZoom} />}
    </group>
  );
}

// ─── Level: one villus ──────────────────────────────────────────────

const RBC_SPACING = 3.2; // 10 µm units
const RBC_SPEED = 5;
const RBC_R = 0.36;

function VillusBlood({ speed }) {
  const v = VILLUS.villus;
  const ref = useRef(null);
  const plan = useMemo(() => {
    const art = polyline(toPoints(v.arteriole));
    const ven = polyline(toPoints(v.venule));
    const caps = v.capillaries.map((c) => polyline(toPoints(c)));
    // up the arteriole, down one capillary, out: a loop per capillary
    const loops = caps.map((c) => ({ c, length: art.length + c.length + ven.length * 0.5 }));
    const cells = [];
    loops.forEach((l, k) => {
      const n = Math.floor(l.length / RBC_SPACING / 3);
      for (let j = 0; j < n; j += 1) cells.push({ loop: k, phase: (j + hashRandom(k * 7.1)) / n });
    });
    return { art, ven, loops, cells };
  }, [v]);
  const o = useMemo(() => new THREE.Object3D(), []);
  const at = useMemo(() => new THREE.Vector3(), []);
  const clock = useRef(0);
  useFrame((_, raw) => {
    const m = ref.current;
    if (!m) return;
    clock.current += dt(raw) * speed * RBC_SPEED;
    plan.cells.forEach((c, i) => {
      const l = plan.loops[c.loop];
      const s = (clock.current + c.phase * l.length) % l.length;
      if (s < plan.art.length) plan.art.at(s, at);
      else if (s < plan.art.length + l.c.length) l.c.at(s - plan.art.length, at);
      else plan.ven.at(s - plan.art.length - l.c.length + plan.ven.length * 0.5, at);
      o.position.copy(at);
      o.rotation.set(c.phase * 9, c.phase * 5, 0);
      // the capillaries in the cut-away front of the middle storey were removed
      // with it; a cell is hidden a radius early, or it bulges through the cut faces
      o.scale.setScalar(at.z > 0.15 && at.y > v.midCut - RBC_R && at.y < v.tipCut + RBC_R ? 0 : 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, plan.cells.length]} frustumCulled={false}>
      <sphereGeometry args={[RBC_R, 10, 8]} />
      <meshStandardMaterial color="#dc2626" roughness={0.4} emissive="#7f1d1d" emissiveIntensity={0.25} />
    </instancedMesh>
  );
}

const SLOTS = 26;
const KINDS = ["glucose", "aminoAcids", "fats"];

/** Side radius of the villus at height y (10 µm units). */
function sideRadius(y) {
  const v = VILLUS.villus;
  const t = Math.min(1, Math.max(0, (y + 6) / (v.height - v.rTip + 6)));
  return v.rBase + (v.rTip - v.rBase) * t;
}

/**
 * Food crossing in the section. Each molecule comes in from the lumen on the
 * left or right edge of the cut, crosses the epithelium (the band of tall
 * cells), and goes where it goes: glucose and amino acids into the
 * capillary under that edge and down it, fatty acids built into a
 * chylomicron and carried into the lacteal and down it. A molecule that is
 * not absorbed reaches the surface and drifts on down the gut.
 */
function Nutrients({ kind, solved, speed }) {
  const v = VILLUS.villus;
  const ref = useRef(null);
  const n = solved.nutrients.find((x) => x.key === kind);
  const isFat = kind === "fats";
  const caps = useMemo(() => [polyline(toPoints(v.capillaries[0])), polyline(toPoints(v.capillaries[Math.round(v.capillaries.length / 2)]))], [v]);
  const slots = useMemo(() => Array.from({ length: SLOTS }, () => ({ live: false })), []);
  const pending = useRef(hashRandom(kind.length) * 0.9);
  const seed = useRef(kind.length * 31);
  const rnd = () => {
    seed.current += 1;
    return hashRandom(seed.current * 1.37 + 0.11);
  };
  const o = useMemo(() => new THREE.Object3D(), []);
  const colour = useMemo(() => new THREE.Color(), []);
  const base = useMemo(() => new THREE.Color(NUTRIENTS[kind].colour), [kind]);
  const chylo = useMemo(() => new THREE.Color(VILLUS_COLOURS.lacteal), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  // phase lengths, screen seconds
  const T_IN = 1.4;
  const T_CROSS = 1.1;
  const T_TO = 0.8;
  const T_RIDE = 2.6;
  useFrame((_, raw) => {
    const m = ref.current;
    if (!m) return;
    const step = dt(raw) * speed;
    pending.current += step * 3.6 * n.share;
    while (pending.current >= 1) {
      pending.current -= 1;
      const s = slots.find((x) => !x.live);
      if (!s) break;
      const side = rnd() < 0.5 ? 1 : -1;
      const y = v.midCut + 3 + rnd() * (v.tipCut - v.midCut - 7);
      Object.assign(s, { live: true, t: 0, side, y, absorbed: rnd() < solved.absorbed, off: 3.5 + rnd() * 3.5, dy: (rnd() - 0.5) * 3, z: 0.25 + rnd() * 0.3, spin: rnd() * 6 });
    }
    slots.forEach((s, i) => {
      let visible = false;
      let size = 1;
      if (s.live) {
        s.t += step;
        const r = sideRadius(s.y);
        const total = s.absorbed ? T_IN + T_CROSS + T_TO + T_RIDE : T_IN + 1.6;
        if (s.t >= total) s.live = false;
        else {
          visible = true;
          colour.copy(base);
          if (s.t < T_IN) {
            const u = s.t / T_IN;
            tmp.set(s.side * (r + s.off * (1 - u) + 0.1), s.y + s.dy * (1 - u), s.z);
          } else if (!s.absorbed) {
            // not taken up: turned away at the surface, carried on down the gut
            const u = (s.t - T_IN) / 1.6;
            tmp.set(s.side * (r + 0.1 + 2.5 * u), s.y - 6 * u, s.z);
            size = 1 - u;
          } else if (s.t < T_IN + T_CROSS) {
            const u = (s.t - T_IN) / T_CROSS;
            tmp.set(s.side * (r - (v.epithelium + 0.2) * u), s.y, s.z);
            if (isFat) {
              // re-made into fat inside the cell and packed into a chylomicron
              colour.lerp(chylo, u);
              size = 1 + 0.7 * u;
            }
          } else if (s.t < T_IN + T_CROSS + T_TO) {
            const u = (s.t - T_IN - T_CROSS) / T_TO;
            const x0 = s.side * (r - v.epithelium - 0.2);
            const x1 = isFat ? s.side * 0.4 : s.side * (r - v.epithelium - 0.35);
            tmp.set(x0 + (x1 - x0) * u, s.y, s.z);
            if (isFat) {
              colour.copy(chylo);
              size = 1.7;
            }
          } else {
            const u = (s.t - T_IN - T_CROSS - T_TO) / T_RIDE;
            if (isFat) {
              tmp.set(s.side * 0.4, s.y - (s.y + 8) * u, s.z);
              colour.copy(chylo);
              size = 1.7;
            } else {
              // down the capillary under this edge of the cut, with the blood
              const cap = caps[s.side > 0 ? 0 : 1];
              let s0 = 0;
              let best = Infinity;
              for (let k = 0; k <= 40; k += 1) {
                cap.at((k / 40) * cap.length, tmp);
                const d = Math.abs(tmp.y - s.y);
                if (d < best) {
                  best = d;
                  s0 = (k / 40) * cap.length;
                }
              }
              cap.at(s0 + (cap.length - s0) * u, tmp);
              tmp.z = Math.max(tmp.z, s.z);
            }
            size *= Math.min(1, (1 - u) * 5);
          }
          o.position.copy(tmp);
        }
      }
      o.scale.setScalar(visible ? size : 0);
      o.rotation.set(s.spin ?? 0, (s.t ?? 0) * 2, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, colour);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, SLOTS]} frustumCulled={false}>
      {kind === "glucose" ? <icosahedronGeometry args={[0.42, 0]} /> : kind === "aminoAcids" ? <octahedronGeometry args={[0.36, 0]} /> : <sphereGeometry args={[0.34, 12, 10]} />}
      <meshStandardMaterial roughness={0.4} emissive="#ffffff" emissiveIntensity={0.12} />
    </instancedMesh>
  );
}

function Neighbours({ parts, atrophy }) {
  const geometry = useMemo(() => atrophiedVillus(parts.villusLow, atrophy), [parts.villusLow, atrophy]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const material = useMemo(() => makeVillusLowMaterial(uniforms), [uniforms]);
  useEffect(() => () => material.dispose(), [material]);
  // the instanced villus is in mm; here 1 unit is 10 µm
  // only the ones behind: in front they would stand between the camera and the section
  return VILLUS.villus.neighbours.filter(([, z]) => z < -4).map(([x, z], i) => (
    <mesh key={i} geometry={geometry} material={material} position={[x, -0.3, z]} rotation={[0, i * 1.3, 0]} scale={100 * (0.92 + 0.12 * hashRandom(i + 4))} />
  ));
}

export function VillusLevel({ solved, speed = 1, showLabels = true }) {
  const parts = useVillusModel();
  const uniforms = useMemo(() => ({ uBrush: { value: 1 } }), []);
  const villusMat = useMemo(() => makeVillusMaterial(uniforms), [uniforms]);
  const floorMat = useMemo(() => makeFloorMaterial(), []);
  const vesselMat = useMemo(() => makeVesselMaterial(), []);
  useEffect(
    () => () => {
      villusMat.dispose();
      floorMat.dispose();
      vesselMat.dispose();
    },
    [villusMat, floorMat, vesselMat],
  );
  const atrophy = atrophyOf(solved.villusHeight);
  // coeliac: the brush border is damaged too
  useEffect(() => {
    uniforms.uBrush.value = 1 - 0.6 * atrophy;
  }, [uniforms, atrophy]);
  const squash = useRef(null);
  useFrame((_, raw) => {
    const g = squash.current;
    if (!g) return;
    const k = 1 - Math.exp(-dt(raw) * 3);
    const ty = 1 - (1 - ATROPHY_HEIGHT) * atrophy;
    const txz = 1 + 0.45 * atrophy;
    g.scale.set(g.scale.x + (txz - g.scale.x) * k, g.scale.y + (ty - g.scale.y) * k, g.scale.z + (txz - g.scale.z) * k);
  });
  const S = (x, y, z) => [x * VILLUS_SCALE, (y - VILLUS_MID) * VILLUS_SCALE, z * VILLUS_SCALE];
  const yLab = (y) => y * (1 - (1 - ATROPHY_HEIGHT) * atrophy);
  return (
    <group>
      <group scale={VILLUS_SCALE} position={[0, -VILLUS_MID * VILLUS_SCALE, 0]}>
        <mesh geometry={parts.floor.geometry} material={floorMat} />
        <Neighbours parts={parts} atrophy={atrophy} />
        {/* sunk a hair into the floor: the villus's foot is a flat skirt at the
            floor's own height (it seals the seam), and coplanar faces z-fight */}
        <group ref={squash} position={[0, -0.15, 0]}>
          <mesh geometry={parts.villus.geometry} material={villusMat} />
          <mesh geometry={parts.lacteal.geometry}>
            <meshStandardMaterial vertexColors roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={parts.villusVessels.geometry} material={vesselMat} />
          <VillusBlood speed={speed} />
          {KINDS.map((k) => (
            <Nutrients key={k} kind={k} solved={solved} speed={speed} />
          ))}
        </group>
      </group>
      {showLabels && (
        <group>
          <Callout anchor={S(-sideRadius(30) + 0.1, yLab(30), 0.2)} at={[-3.9, 2.4, 0.4]} side="left">brush border · microvilli ×20</Callout>
          <Callout anchor={S(-sideRadius(24) + 1.4, yLab(24), 0.2)} at={[-3.9, 1.7, 0.4]} side="left">enterocyte · one cell thick</Callout>
          <Callout anchor={S(-sideRadius(17) + 3.6, yLab(17), 0.2)} at={[-3.9, 1.0, 0.4]} side="left">capillary · to the liver</Callout>
          <Callout anchor={S(-2.6, yLab(12), 0.3)} at={[-3.9, 0.3, 0.4]} side="left">arteriole</Callout>
          <Callout anchor={S(0, yLab(22), -0.5)} at={[4.0, 1.3, 0.4]} side="right">lacteal · lymph, for fats</Callout>
          <Callout anchor={S(3.6, yLab(46), 2.5)} at={[4.0, 2.6, 0.4]} side="right">capillary network · epithelium peeled</Callout>
          <Callout anchor={S(2.25, yLab(15), 0.1)} at={[4.0, 0.6, 0.4]} side="right">smooth muscle · pumps the lacteal</Callout>
          <Callout anchor={S(-11.5, -12, 12)} at={[-3.9, -1.6, 0.4]} side="left">crypt of Lieberkühn · new cells</Callout>
          <Callout anchor={S(4, -2, 9)} at={[4.0, -1.1, 0.4]} side="right">lamina propria</Callout>
        </group>
      )}
      {atrophy > 0.5 ? (
        <ToggleLabel position={[0, 3.9, 0.5]} tone="text-amber-300">
          coeliac disease: the villus worn to a stub, the brush border damaged
        </ToggleLabel>
      ) : (
        <ToggleLabel position={[0, 3.9, 0.5]}>
          {solved.meal.label}: {solved.meal.note}
        </ToggleLabel>
      )}
      <ScaleBar position={[-3.3, -3.6, 1.4]} length={10 * VILLUS_SCALE} text="100 µm" />
    </group>
  );
}

"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  Halo,
  PALETTE,
  SceneCanvas,
  LabelsOn,
  ToggleLabel,
  VectorArrow,
  clamp,
  hashRandom,
} from "@/components/visualizations/scene-kit";
import { TubeFlow } from "@/components/visualizations/tube-transit";
import { PLANT_GLB, makeShootMaterial, makeSoilMaterial, makeStemMaterial, usePlantModel } from "@/components/visualizations/plant-model";
import { PLANT_MODEL } from "@/components/visualizations/plant-model-meta";
import {
  CAVITATION_TENSION_MPA,
  MAX_WIND_MS,
  STRAINED_TENSION_MPA,
  solveTranspiration,
} from "@/lib/transpiration";

// ─── Plant transpiration ────────────────────────────────────────────
// A bean seedling (Phaseolus vulgaris) in a cut block of soil, and four
// magnified panels that follow the water through it, like the numbered
// insets of a textbook figure:
//
//   1  root hairs   x100: hairs threading between soil particles, each
//                   wrapped in a film of water they draw on by osmosis
//   2  stem         x40: a wedge cut out of the stem shows the ring of
//                   vascular bundles; water rises in the split-open xylem
//                   vessels, sugar sinks in the phloem
//   3  leaf         x200: a freeze-fractured leaf; water leaves the vein,
//                   evaporates off the mesophyll into the air spaces and
//                   collects in the chamber over the stoma
//   4  stoma        x800: the lower epidermis face-on; two guard cells
//                   bow apart as K+ (and water) move in, and the vapour
//                   diffuses out through the pore
//
// Every mesh is our own (scripts/plant-model, in Blender). The scene adds
// what moves with the model: the particle streams, the wind, the guard
// cells' opening (a morph), the wilt of the whole plant in drought
// (a morph), the water films thinning in dry soil (a morph), the soil
// drying and cracking (its shader).
//
// Nothing here is a clock. `lib/transpiration.js` is steady state, so the
// scene is a picture of the controls: every stream runs at the one
// transpiration flux, and the guard cells sit at the aperture the light
// and the soil give them. "Focus" flies the camera into one panel.
// ─────────────────────────────────────────────────────────────────────

/** World units of flow speed per mL/hr of transpiration. */
const FLOW_UNITS_PER_ML = 0.005;

const M = PLANT_MODEL;
const PLANT_AT = [-4.35, -1.15, 0];
const PANEL = { width: 4.5, height: 3.75 };
const PANELS = {
  root: { n: 1, x: 0.95, y: -2.05, title: "1 · root hairs · ×100", tone: "text-sky-300", ring: "#7dd3fc" },
  stem: { n: 2, x: 0.95, y: 2.05, title: "2 · stem · cut-away · ×40", tone: "text-amber-300", ring: "#fcd34d" },
  leaf: { n: 3, x: 5.75, y: 2.05, title: "3 · leaf section · ×200", tone: "text-emerald-300", ring: "#6ee7b7" },
  stoma: { n: 4, x: 5.75, y: -2.05, title: "4 · stoma · lower epidermis · ×800", tone: "text-sky-300", ring: "#a5b4fc" },
};

/** The whole figure, and each panel on its own. */
const VIEWS = {
  all: { cx: 0.85, cy: 0.15, width: 16.6, height: 9.2 },
  root: { cx: PANELS.root.x, cy: PANELS.root.y, width: PANEL.width + 0.3, height: PANEL.height + 0.6 },
  stem: { cx: PANELS.stem.x, cy: PANELS.stem.y, width: PANEL.width + 0.3, height: PANEL.height + 0.6 },
  leaf: { cx: PANELS.leaf.x, cy: PANELS.leaf.y, width: PANEL.width + 0.3, height: PANEL.height + 0.6 },
  stoma: { cx: PANELS.stoma.x, cy: PANELS.stoma.y, width: PANEL.width + 0.3, height: PANEL.height + 0.6 },
};

const COLOURS = {
  water: PALETTE.sky,
  strained: "#fbbf24",
  cavitated: PALETTE.rose,
  sugar: PALETTE.goldDim,
  vapour: "#dbeafe",
  wind: "#cbd5e1",
  sun: "#fde68a",
  potassium: PALETTE.gold,
  embolism: "#f8fafc",
  // vertex colours baked by scripts/plant-model, named here for the key
  xylemWall: "#c8a266",
  guard: "#6fb455",
  boundary: "#93c5fd",
  film: "#7cc4f0",
  panel: "#141b29",
};

const columnColour = (tensionMPa) => {
  const c = new THREE.Color(COLOURS.water);
  if (tensionMPa >= CAVITATION_TENSION_MPA) return COLOURS.cavitated;
  if (tensionMPa > STRAINED_TENSION_MPA) {
    const k = clamp((tensionMPa - STRAINED_TENSION_MPA) / (CAVITATION_TENSION_MPA - STRAINED_TENSION_MPA), 0, 1);
    return `#${c.lerp(new THREE.Color(COLOURS.strained), k).getHexString()}`;
  }
  return COLOURS.water;
};

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// ─── Camera ─────────────────────────────────────────────────────────

/**
 * Frames `view` like scene-kit's FitCamera, but flies there over most of a
 * second when the view changes (Focus), instead of jumping.
 */
function FocusCamera({ view, direction = [0.03, 0.05, 1], fov = 42, margin = 1.03 }) {
  const camera = useThree((st) => st.camera);
  const controls = useThree((st) => st.controls);
  const aspect = useThree((st) => st.size.width / Math.max(st.size.height, 1));
  const anim = useRef({ t: 1, first: true, fromP: new THREE.Vector3(), fromT: new THREE.Vector3(), toP: new THREE.Vector3(), toT: new THREE.Vector3() });
  const { cx, cy, width, height } = view;
  useEffect(() => {
    if (!(aspect > 0.05)) return;
    const a = anim.current;
    const tanHalf = Math.tan(((fov / 2) * Math.PI) / 180);
    const fit = Math.max(height / 2 / tanHalf, width / 2 / (tanHalf * aspect)) * margin;
    a.toT.set(cx, cy, 0);
    a.toP.copy(a.toT).addScaledVector(new THREE.Vector3(...direction).normalize(), fit);
    if (a.first) {
      a.first = false;
      camera.position.copy(a.toP);
      camera.lookAt(a.toT);
      if (controls) {
        controls.target.copy(a.toT);
        controls.update();
      }
      a.t = 1;
      return;
    }
    a.fromP.copy(camera.position);
    a.fromT.copy(controls ? controls.target : a.toT);
    a.t = 0;
    // `direction` is a literal; its values are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, controls, aspect, cx, cy, width, height, fov, margin]);
  useFrame((_, delta) => {
    const a = anim.current;
    if (a.t >= 1) return;
    a.t = Math.min(1, a.t + delta / 0.9);
    const e = a.t < 0.5 ? 4 * a.t * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 3) / 2;
    camera.position.lerpVectors(a.fromP, a.toP, e);
    const target = new THREE.Vector3().lerpVectors(a.fromT, a.toT, e);
    camera.lookAt(target);
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
  });
  return null;
}

// ─── Particles ──────────────────────────────────────────────────────

/**
 * Particles born in a box round `origin` at `rateRef.current` per second,
 * carried by `velocity` (in the parent's frame) plus a sideways drift from
 * `driftRef.current`, fading over `life` seconds: vapour off the leaves, out
 * of a pore.
 */
function Plume({ count = 60, origin = [0, 0, 0], spread = [0.3, 0.05, 0.2], velocity = [0, -0.5, 0], driftRef = null, driftAxis = [1, 0, 0], rateRef, speed = 1, life = 2, colour = COLOURS.vapour, size = 0.05, opacity = 0.7, seed = 1 }) {
  const meshRef = useRef(null);
  const state = useMemo(
    () => ({
      age: new Float32Array(count).fill(-1),
      pos: new Float32Array(count * 3),
      wobble: Array.from({ length: count }, (_, i) => hashRandom(seed * 13.7 + i * 2.9) * Math.PI * 2),
      pending: 0,
      births: 0,
      dummy: new THREE.Object3D(),
    }),
    [count, seed],
  );
  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(rawDelta, 0.05) * speed;
    const rate = rateRef ? rateRef.current : 0;
    const drift = driftRef ? driftRef.current : 0;
    state.pending = Math.min(4, state.pending + rate * dt);
    const d = state.dummy;
    for (let i = 0; i < count; i += 1) {
      let age = state.age[i];
      if (age < 0 && state.pending >= 1) {
        state.pending -= 1;
        state.births += 1;
        age = 0;
        const h = (k) => hashRandom(seed * 31.1 + state.births * 7.3 + k * 97.7) - 0.5;
        state.pos[i * 3] = origin[0] + h(1) * 2 * spread[0];
        state.pos[i * 3 + 1] = origin[1] + h(2) * 2 * spread[1];
        state.pos[i * 3 + 2] = origin[2] + h(3) * 2 * spread[2];
      }
      if (age >= 0) {
        age += dt;
        if (age > life) age = -1;
      }
      state.age[i] = age;
      if (age < 0) {
        d.scale.setScalar(0);
      } else {
        const k = age / life;
        const sway = 0.1 * Math.sin(age * 3 + state.wobble[i]);
        state.pos[i * 3] += (velocity[0] + drift * driftAxis[0]) * dt + sway * dt;
        state.pos[i * 3 + 1] += (velocity[1] + drift * driftAxis[1]) * dt;
        state.pos[i * 3 + 2] += (velocity[2] + drift * driftAxis[2]) * dt + sway * 0.5 * dt;
        d.position.set(state.pos[i * 3], state.pos[i * 3 + 1], state.pos[i * 3 + 2]);
        d.scale.setScalar(size * (0.5 + Math.sin(Math.PI * Math.min(1, k * 1.1))));
      }
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color={colour} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

/** Wind: streaks sweeping left to right across a region at the wind speed. */
function WindStreaks({ count = 14, origin = [0, 0, 0], size = [4, 2.4, 1], windRef, speed = 1, seed = 5, length = 0.9 }) {
  const meshRef = useRef(null);
  const state = useMemo(
    () => ({
      x: Float32Array.from({ length: count }, (_, i) => (hashRandom(seed + i * 1.7) - 0.5) * size[0]),
      y: Float32Array.from({ length: count }, (_, i) => (hashRandom(seed * 3 + i * 2.3) - 0.5) * size[1]),
      z: Float32Array.from({ length: count }, (_, i) => (hashRandom(seed * 7 + i * 3.1) - 0.5) * size[2]),
      dummy: new THREE.Object3D(),
    }),
    // `size` is a literal from the caller; the seats only need laying out once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, seed],
  );
  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(rawDelta, 0.05) * speed;
    const frac = clamp((windRef ? windRef.current : 0) / MAX_WIND_MS, 0, 1);
    const d = state.dummy;
    for (let i = 0; i < count; i += 1) {
      // The number of streaks on show, and their speed and length, all rise with the wind.
      const on = i < Math.round(frac * count) && frac > 0.02;
      state.x[i] += (0.6 + 3.0 * frac) * dt;
      if (state.x[i] > size[0] / 2) state.x[i] = -size[0] / 2;
      d.position.set(origin[0] + state.x[i], origin[1] + state.y[i], origin[2] + state.z[i]);
      d.scale.set(on ? 0.25 + 0.75 * frac : 0, on ? 1 : 0, on ? 1 : 0);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[length, 0.016, 0.016]} />
      <meshBasicMaterial color={COLOURS.wind} transparent opacity={0.5} depthWrite={false} />
    </instancedMesh>
  );
}

/**
 * Particles running along polylines at `speedRef.current` (units a second),
 * `perPath` on each, evenly spaced and looping: water in the root hairs and
 * on into the root.
 */
function PathFlow({ paths, perPath = 2, speedRef, colour, size = 0.03, opacity = 0.95, seed = 3 }) {
  const meshRef = useRef(null);
  const state = useMemo(() => {
    const step = 0.02;
    const routes = paths.map((pts) => {
      const P = pts.map((p) => new THREE.Vector3(...p));
      const curve = new THREE.CatmullRomCurve3(P, false, "centripetal", 0.5);
      const len = curve.getLength();
      const n = Math.max(2, Math.ceil(len / step));
      return { pts: curve.getSpacedPoints(n), len };
    });
    const seats = [];
    routes.forEach((r, i) => {
      for (let k = 0; k < perPath; k += 1) seats.push({ route: i, u: (k + hashRandom(seed + i * 3.7 + k)) / perPath });
    });
    return { routes, seats, phase: 0, dummy: new THREE.Object3D() };
  }, [paths, perPath, seed]);
  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const v = speedRef ? speedRef.current : 0;
    state.phase += Math.min(rawDelta, 0.05) * v;
    const d = state.dummy;
    state.seats.forEach((seat, i) => {
      const r = state.routes[seat.route];
      const s = (((seat.u + state.phase / r.len) % 1) + 1) % 1;
      const f = s * (r.pts.length - 1);
      const j = Math.floor(f);
      const p = r.pts[j];
      const q = r.pts[Math.min(j + 1, r.pts.length - 1)];
      d.position.lerpVectors(p, q, f - j);
      // fade in at the start of a route and out at its end
      d.scale.setScalar(v > 0 ? Math.min(1, s * 12, (1 - s) * 12) : 0.85);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, state.seats.length]} frustumCulled={false} renderOrder={3}>
      <sphereGeometry args={[size, 8, 6]} />
      <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={1.6} toneMapped={false} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} />
    </instancedMesh>
  );
}

// ─── Panel frames ───────────────────────────────────────────────────

function PanelFrame({ panel, children }) {
  const hw = PANEL.width / 2;
  const hh = PANEL.height / 2;
  return (
    <group position={[panel.x, panel.y, 0]}>
      <mesh position={[0, 0, -1.25]}>
        <planeGeometry args={[PANEL.width, PANEL.height]} />
        <meshBasicMaterial color={COLOURS.panel} transparent opacity={0.72} depthWrite={false} />
      </mesh>
      <Line points={[[-hw, -hh, -1.2], [hw, -hh, -1.2], [hw, hh, -1.2], [-hw, hh, -1.2], [-hw, -hh, -1.2]]} color={panel.ring} lineWidth={1.2} transparent opacity={0.7} />
      <ToggleLabel position={[0, hh + 0.24, -1.2]} tone={panel.tone}>
        {panel.title}
      </ToggleLabel>
      {children}
    </group>
  );
}

/** A magnifier ring on the plant, numbered like the panel it opens. */
function Marker({ at, panel, radius = 0.32 }) {
  const pts = useMemo(() => Array.from({ length: 49 }, (_, i) => [Math.cos((i / 48) * Math.PI * 2) * radius, Math.sin((i / 48) * Math.PI * 2) * radius, 0]), [radius]);
  return (
    <group position={at}>
      <Line points={pts} color={panel.ring} lineWidth={1.6} transparent opacity={0.9} />
      <ToggleLabel position={[radius + 0.18, radius + 0.1, 0]} tone={panel.tone}>
        {String(panel.n)}
      </ToggleLabel>
    </group>
  );
}

/** An arrow between two panels: the way the water goes next. The panels' numbered titles name the steps. */
function Hop({ from, to }) {
  return <VectorArrow from={from} to={to} color={COLOURS.water} radius={0.022} headLength={0.18} headRadius={0.07} />;
}

// ─── The plant ──────────────────────────────────────────────────────

function Sun({ light }) {
  const k = clamp(light / 100, 0, 1);
  return (
    <group position={[-6.5, 3.55, -1.4]}>
      <mesh>
        <sphereGeometry args={[0.42, 24, 18]} />
        <meshStandardMaterial color={COLOURS.sun} emissive={COLOURS.sun} emissiveIntensity={0.3 + 2.2 * k} toneMapped={false} />
      </mesh>
      <Halo radius={0.75 + 0.6 * k} color={COLOURS.sun} opacity={0.04 + 0.12 * k} />
      <pointLight intensity={0.8 + 7 * k} distance={18} decay={2} color="#fff3c4" />
      <ToggleLabel position={[0, -0.9, 0]} tone={k > 0.15 ? "text-amber-200" : "text-ink-500"}>
        {k < 0.05 ? "night · no light" : `light ${Math.round(light)} %`}
      </ToggleLabel>
    </group>
  );
}

function Plant({ solved, windRef, evapRateRef, speed, drought, focusAll }) {
  const parts = usePlantModel();
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uWind: { value: 0 }, uDry: { value: 0 } }), []);
  const shootMat = useMemo(() => makeShootMaterial(uniforms), [uniforms]);
  const soilMat = useMemo(() => makeSoilMaterial(uniforms), [uniforms]);
  useEffect(() => () => {
    shootMat.dispose();
    soilMat.dispose();
  }, [shootMat, soilMat]);
  const shootRef = useRef(null);
  // A bean wilts in dry soil: its leaves hang at the pulvini as turgor goes.
  // Brighter light (more demand) makes it worse; a strained column in moist
  // soil only droops a little.
  const wiltTarget = drought ? 0.55 + 0.4 * clamp(solved.light / 100, 0, 1) : clamp((solved.tensionMPa - 1.2) / 1.5, 0, 0.25);
  const wiltRef = useRef(0);
  useFrame(({ clock }, delta) => {
    uniforms.uTime.value = clock.elapsedTime * speed;
    uniforms.uWind.value += (clamp(solved.wind / MAX_WIND_MS, 0, 1) - uniforms.uWind.value) * Math.min(1, delta * 2);
    uniforms.uDry.value += ((drought ? 1 : 0) - uniforms.uDry.value) * Math.min(1, delta * 1.2);
    wiltRef.current += (wiltTarget - wiltRef.current) * Math.min(1, delta * 0.9);
    const m = shootRef.current;
    if (m?.morphTargetInfluences) m.morphTargetInfluences[0] = wiltRef.current;
  });
  const leaves = M.plant.leaves;
  const soil = M.plant.soil;
  return (
    <group position={PLANT_AT}>
      <mesh ref={shootRef} geometry={parts.plant.geometry} material={shootMat} morphTargetInfluences={[0]} />
      <mesh geometry={parts.roots.geometry}>
        <meshStandardMaterial vertexColors roughness={0.72} metalness={0} />
      </mesh>
      <mesh geometry={parts.soil.geometry} material={soilMat} />
      {/* Vapour leaving the undersides of the leaves, carried off by the wind. */}
      {leaves.map((l, i) => (
        <Plume
          key={i}
          count={26}
          origin={add(l.centre, [-l.normal[0] * 0.12, -0.12, -l.normal[2] * 0.12])}
          spread={[l.length * 0.3, 0.04, l.length * 0.2]}
          velocity={[0, -0.14, 0.05]}
          driftRef={windRef}
          rateRef={evapRateRef}
          speed={speed}
          life={2.2}
          size={0.035}
          opacity={0.45}
          seed={70 + i}
        />
      ))}
      <WindStreaks count={16} origin={[0.2, 3.4, 0.6]} size={[6, 3.6, 1.2]} windRef={windRef} speed={speed} seed={9} length={0.7} />
      <Marker at={add(M.plant.hairZones.find((z) => z[0] > 0.6) ?? M.plant.hairZones[0], [0, 0, 0.1])} panel={PANELS.root} />
      <Marker at={add(M.plant.stemMid, [0, 0, 0.1])} panel={PANELS.stem} radius={0.28} />
      <Marker at={add(leaves[1].centre, [0, 0.05, 0.25])} panel={PANELS.leaf} radius={0.42} />
      <Marker at={add(leaves[0].centre, [0, -0.1, 0.25])} panel={PANELS.stoma} radius={0.36} />
      <ToggleLabel position={[soil.lo[0] + 1.2, soil.hi[1] - 0.25, 0.4]} tone={drought ? "text-amber-300" : "text-ink-300"}>
        {drought ? "dry soil · Ψ ≈ −2.0 MPa" : "moist soil · Ψ ≈ −0.05 MPa"}
      </ToggleLabel>
      {focusAll && (
        <>
          <ToggleLabel position={add(M.plant.stemTop, [0.95, 0.45, 0.3])} tone={solved.columnState === "cavitation" ? "text-rose-300" : solved.columnState === "strained" ? "text-amber-300" : "text-sky-300"}>
            {`column tension ${solved.tensionMPa.toFixed(2)} MPa · ${solved.columnState}`}
          </ToggleLabel>
          <ToggleLabel position={add(M.plant.stemMid, [0.95, -0.9, 0.3])} tone="text-ink-300">
            {`${solved.rateMlPerHour < 10 ? solved.rateMlPerHour.toFixed(1) : Math.round(solved.rateMlPerHour)} mL/hr up the stem`}
          </ToggleLabel>
          {drought && (
            <ToggleLabel position={add(M.plant.stemTop, [-1.4, -0.2, 0.3])} tone="text-amber-300">
              wilting · turgor lost
            </ToggleLabel>
          )}
        </>
      )}
    </group>
  );
}

// ─── Panel 1: root hairs ────────────────────────────────────────────

function RootPanel({ flowRef, colour, drought, detail }) {
  const parts = usePlantModel();
  const rt = M.rootTip;
  const waterRef = useRef(null);
  const dryRef = useRef(0);
  useFrame((_, delta) => {
    dryRef.current += ((drought ? 1 : 0) - dryRef.current) * Math.min(1, delta * 1.2);
    const w = waterRef.current;
    if (w?.morphTargetInfluences) w.morphTargetInfluences[0] = dryRef.current;
  });
  // Water: out of the film at a hair's tip, down the hair, into the root and
  // along its stele towards the plant (off the panel to the left).
  const paths = useMemo(() => {
    const axis = rt.axis;
    const out = [];
    rt.hairs.forEach((h, i) => {
      if (i % 2) return;
      const base = h[0];
      let best = 0;
      let bd = Infinity;
      axis.forEach((p, j) => {
        const d = (p[0] - base[0]) ** 2 + (p[1] - base[1]) ** 2 + (p[2] - base[2]) ** 2;
        if (d < bd) {
          bd = d;
          best = j;
        }
      });
      const tip = h[h.length - 1];
      const into = [...h].reverse();
      out.push([add(tip, [0.03, 0.03, 0]), ...into, ...axis.slice(0, best + 1).reverse()]);
    });
    return out;
  }, [rt]);
  const scale = 0.86;
  return (
    <PanelFrame panel={PANELS.root}>
      <group scale={scale} rotation={[0.1, 0.12, 0]}>
        <mesh geometry={parts.rootSoil.geometry}>
          <meshStandardMaterial vertexColors roughness={0.88} metalness={0} />
        </mesh>
        <mesh geometry={parts.rootStele.geometry}>
          <meshStandardMaterial vertexColors roughness={0.6} />
        </mesh>
        <mesh geometry={parts.rootTip.geometry} renderOrder={2}>
          <meshStandardMaterial vertexColors roughness={0.42} transparent opacity={0.7} depthWrite={false} />
        </mesh>
        <mesh ref={waterRef} geometry={parts.rootWater.geometry} morphTargetInfluences={[0]} renderOrder={4}>
          <meshStandardMaterial color={COLOURS.film} roughness={0.08} metalness={0} transparent opacity={0.26} depthWrite={false} emissive={COLOURS.film} emissiveIntensity={0.12} />
        </mesh>
        <PathFlow paths={paths} perPath={2} speedRef={flowRef} colour={colour} size={0.03} />
      </group>
      {detail && (
        <>
          <ToggleLabel position={[-1.2, -1.45, 0.6]} tone="text-sky-300">
            root hair · water in by osmosis
          </ToggleLabel>
          <ToggleLabel position={[1.55, -0.7, 0.6]} tone="text-ink-300">
            root cap
          </ToggleLabel>
          <ToggleLabel position={[-1.55, -0.55, 0.7]} tone="text-amber-200">
            stele · xylem to the stem
          </ToggleLabel>
          <ToggleLabel position={[1.15, 1.2, 0.6]} tone={drought ? "text-amber-300" : "text-sky-300"}>
            {drought ? "thin water films · dry soil" : "water film round each particle"}
          </ToggleLabel>
          <ToggleLabel position={[-0.2, 1.45, 0.6]} tone="text-ink-400">
            sand · silt · clay–humus crumbs
          </ToggleLabel>
        </>
      )}
    </PanelFrame>
  );
}

// ─── Panel 2: the stem ──────────────────────────────────────────────

function StemPanel({ flowRef, colour, cavitated, speed, detail }) {
  const parts = usePlantModel();
  const st = M.stem;
  const mat = useMemo(() => makeStemMaterial(st), [st]);
  useEffect(() => () => mat.dispose(), [mat]);
  const sugarRef = useRef(-0.12 * speed);
  useEffect(() => {
    sugarRef.current = -0.12 * speed;
  }, [speed]);
  const zero = useRef(0);
  const xylem = st.channels.filter((c) => c.kind === "xylem");
  const phloem = st.channels.filter((c) => c.kind === "phloem");
  // The widest vessel on the right-hand face is the one that embolises.
  const broken = xylem.reduce((b, c, i) => (c.r > xylem[b].r || (c.r === xylem[b].r && c.x > xylem[b].x) ? i : b), 0);
  return (
    <PanelFrame panel={PANELS.stem}>
      <group position={[0, -0.12, 0]} rotation={[0.42, 0, 0]}>
        <mesh geometry={parts.stem.geometry} material={mat} />
        <mesh geometry={parts.stemDetail.geometry}>
          <meshStandardMaterial vertexColors roughness={0.55} />
        </mesh>
        {xylem.map((c, i) => (
          <group key={`x${i}`} position={[c.x, -st.H, c.z]}>
            <TubeFlow length={2 * st.H} count={14} speedRef={cavitated && i === broken ? zero : flowRef} radius={c.r * 0.55} fill={0.9} colour={colour} size={Math.min(0.03, c.r * 0.55)} seed={i + 1} />
          </group>
        ))}
        {phloem.map((c, i) => (
          <group key={`p${i}`} position={[c.x, -st.H, c.z]}>
            <TubeFlow length={2 * st.H} count={8} speedRef={sugarRef} radius={c.r * 0.5} fill={0.8} colour={COLOURS.sugar} size={0.02} opacity={0.9} seed={i + 20} />
          </group>
        ))}
        {cavitated && (
          <group position={[xylem[broken].x, 0.35, xylem[broken].z]}>
            <mesh scale={[1, 2.2, 1]}>
              <sphereGeometry args={[xylem[broken].r * 0.9, 14, 10]} />
              <meshStandardMaterial color={COLOURS.embolism} emissive={COLOURS.embolism} emissiveIntensity={0.4} roughness={0.2} />
            </mesh>
            <Halo radius={0.16} color={PALETTE.rose} opacity={0.3} />
          </group>
        )}
      </group>
      {detail && (
        <>
          <ToggleLabel position={[-1.6, 0.9, 0.6]} tone="text-ink-300">
            epidermis · cortex
          </ToggleLabel>
          <ToggleLabel position={[-1.55, -0.55, 0.9]} tone="text-sky-300">
            xylem vessels · water up
          </ToggleLabel>
          <ToggleLabel position={[1.6, -0.55, 0.9]} tone="text-amber-300">
            phloem · sugar down
          </ToggleLabel>
          <ToggleLabel position={[0.0, 1.55, 0.2]} tone="text-ink-300">
            vascular bundles in a ring · pith inside
          </ToggleLabel>
          {cavitated && (
            <ToggleLabel position={[1.55, 0.55, 0.9]} tone="text-rose-300">
              embolism · column broken
            </ToggleLabel>
          )}
        </>
      )}
    </PanelFrame>
  );
}

// ─── Panel 3: the leaf section ──────────────────────────────────────

/**
 * Vapour in the leaf's air spaces: evaporated off the mesophyll walls, it
 * drifts to the substomatal chamber and, if the pore is open, out through
 * it. With the pore shut it only wanders and fades.
 */
function AirSpaceVapour({ rateRef, openRef, speed, box, chamber, pore, count = 70 }) {
  const meshRef = useRef(null);
  const state = useMemo(
    () => ({ age: new Float32Array(count).fill(-1), pos: new Float32Array(count * 3), births: 0, pending: 0, dummy: new THREE.Object3D() }),
    [count],
  );
  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(rawDelta, 0.05) * speed;
    state.pending = Math.min(4, state.pending + (rateRef.current || 0) * dt);
    const open = openRef.current;
    const d = state.dummy;
    for (let i = 0; i < count; i += 1) {
      let age = state.age[i];
      const o = i * 3;
      if (age < 0 && state.pending >= 1) {
        state.pending -= 1;
        state.births += 1;
        age = 0;
        const h = (k) => hashRandom(state.births * 5.1 + k * 31.7);
        state.pos[o] = box[0] + h(1) * (box[3] - box[0]);
        state.pos[o + 1] = box[1] + h(2) * (box[4] - box[1]);
        state.pos[o + 2] = box[2] + h(3) * (box[5] - box[2]);
      }
      if (age >= 0) {
        age += dt;
        const x = state.pos[o];
        const y = state.pos[o + 1];
        const z = state.pos[o + 2];
        // towards the chamber, then down through the pore
        const inChamber = Math.abs(x - chamber[0]) < 0.16 && y < chamber[1] + 0.12;
        const tx = inChamber ? pore[0] : chamber[0];
        const ty = inChamber ? pore[1] - 0.4 : chamber[1];
        const tz = inChamber ? pore[2] : chamber[2];
        let vx = tx - x;
        let vy = ty - y;
        let vz = tz - z;
        const l = Math.hypot(vx, vy, vz) || 1;
        const v = inChamber && open < 0.1 ? 0.05 : 0.45;
        vx = (vx / l) * v + 0.12 * Math.sin(age * 4 + i);
        vy = (vy / l) * v;
        vz = (vz / l) * v;
        state.pos[o] += vx * dt;
        state.pos[o + 1] += vy * dt;
        state.pos[o + 2] += vz * dt;
        if (age > 4.5 || state.pos[o + 1] < pore[1] - 0.05) age = -1;
      }
      state.age[i] = age;
      if (age < 0) d.scale.setScalar(0);
      else {
        d.position.set(state.pos[o], state.pos[o + 1], state.pos[o + 2]);
        d.scale.setScalar(0.028 * Math.min(1, age * 3));
      }
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color={COLOURS.vapour} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

function LeafPanel({ solved, flowRef, colour, evapRateRef, windRef, speed, detail }) {
  const parts = usePlantModel();
  const ls = M.leafSection;
  const guardRef = useRef(null);
  const openRef = useRef(solved.aperture);
  useFrame((_, delta) => {
    openRef.current += (solved.aperture - openRef.current) * Math.min(1, delta * 2);
    const g = guardRef.current;
    if (g?.morphTargetInfluences) g.morphTargetInfluences[0] = openRef.current;
  });
  const exitRef = useRef(0);
  useEffect(() => {
    exitRef.current = solved.aperture > 0.08 ? evapRateRef.current : 0;
  });
  const windFrac = clamp(solved.wind / MAX_WIND_MS, 0, 1);
  const layer = 0.3 * (1 - 0.8 * windFrac) + 0.04;
  // Water leaving the vein's two vessels for the mesophyll round it.
  const veinPaths = useMemo(() => {
    const out = [];
    ls.vessels.forEach(([x, y], i) => {
      for (let k = 0; k < 4; k += 1) {
        const a = (k / 4) * Math.PI * 2 + i;
        out.push([[x, y, ls.front], [x + Math.cos(a) * 0.2, y + Math.sin(a) * 0.18, ls.front - 0.02], [x + Math.cos(a) * 0.42, y + Math.sin(a) * 0.36, ls.front - 0.06]]);
      }
    });
    return out;
  }, [ls]);
  const box = ls.box;
  return (
    <PanelFrame panel={PANELS.leaf}>
      <group position={[0, 0.05, 0]} rotation={[0.1, -0.22, 0]}>
        <mesh geometry={parts.leafSection.geometry}>
          <meshStandardMaterial vertexColors roughness={0.55} metalness={0} />
        </mesh>
        <mesh ref={guardRef} geometry={parts.leafGuard.geometry} morphTargetInfluences={[0]}>
          <meshStandardMaterial vertexColors roughness={0.5} />
        </mesh>
        <PathFlow paths={veinPaths} perPath={2} speedRef={flowRef} colour={colour} size={0.022} />
        <AirSpaceVapour rateRef={evapRateRef} openRef={openRef} speed={speed} box={[box[0] + 0.1, -0.75, box[2] + 0.2, box[3] - 0.1, -0.05, box[5] - 0.05]} chamber={ls.chamber} pore={[ls.stoma.x, ls.stoma.y, ls.stoma.z - 0.05]} />
        {/* Out of the pore, into whatever air is under the leaf. */}
        <Plume count={50} origin={[ls.stoma.x, ls.stoma.y - 0.12, ls.stoma.z - 0.05]} spread={[0.04, 0.02, 0.06]} velocity={[0, -0.4, 0]} driftRef={windRef} rateRef={exitRef} speed={speed} life={1.8} size={0.032} seed={42} />
        {/* The boundary layer: humid, still air against the leaf, thinned by wind. */}
        <mesh position={[0, -1.04 - layer / 2, ls.front + 0.02]}>
          <planeGeometry args={[3.8, layer]} />
          <meshBasicMaterial color={COLOURS.boundary} transparent opacity={0.06 + 0.16 * clamp(solved.humidity / 100, 0, 1)} depthWrite={false} />
        </mesh>
        <WindStreaks count={12} origin={[0, -1.35, 0.1]} size={[3.8, 0.34, 0.5]} windRef={windRef} speed={speed} seed={5} />
      </group>
      {detail ? (
        <>
          <ToggleLabel position={[-1.1, 1.38, 0.5]} tone="text-ink-300">
            cuticle · upper epidermis
          </ToggleLabel>
          <ToggleLabel position={[1.55, 0.62, 0.6]} tone="text-emerald-300">
            palisade
          </ToggleLabel>
          <ToggleLabel position={[-1.55, -0.62, 0.7]} tone="text-sky-300">
            vein · xylem
          </ToggleLabel>
          <ToggleLabel position={[-0.25, -0.1, 0.7]} tone="text-emerald-300">
            spongy mesophyll · air spaces
          </ToggleLabel>
          <ToggleLabel position={[1.45, -0.55, 0.7]} tone="text-ink-200">
            substomatal chamber
          </ToggleLabel>
          <ToggleLabel position={[1.2, -1.05, 0.7]} tone={solved.poreOpen ? "text-sky-300" : "text-rose-300"}>
            {solved.poreOpen ? "stoma open · vapour out" : "stoma closed"}
          </ToggleLabel>
          <ToggleLabel position={[-0.7, -1.62, 0.5]} tone={solved.wind > 1 ? "text-ink-200" : "text-ink-500"}>
            {solved.wind > 0.5 ? `wind ${solved.wind.toFixed(1)} m/s strips the boundary layer` : `still air · boundary layer · RH ${Math.round(solved.humidity)} %`}
          </ToggleLabel>
        </>
      ) : (
        <ToggleLabel position={[1.2, -1.2, 0.7]} tone={solved.poreOpen ? "text-sky-300" : "text-rose-300"}>
          {solved.poreOpen ? "stoma open · vapour out" : "stoma closed"}
        </ToggleLabel>
      )}
    </PanelFrame>
  );
}

// ─── Panel 4: the stoma ─────────────────────────────────────────────

/** K⁺ ions in the guard cells of the stoma at the centre, as many as they hold. */
function IonFill({ held, bowRef, count = 12 }) {
  const meshRef = useRef(null);
  const sm = M.stoma;
  const seats = useMemo(
    () => Array.from({ length: count * 2 }, (_, i) => ({ side: i < count ? -1 : 1, t: (hashRandom(i * 1.9 + 3) - 0.5) * 2.2, rho: (hashRandom(i * 3.7) - 0.5) * 0.12, phase: hashRandom(i * 0.7) * 6.28 })),
    [count],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const shown = Math.round(held * count);
    const bow = bowRef.current;
    seats.forEach((s, i) => {
      const t = s.t * 0.55 * Math.PI / 2;
      const c = Math.cos(t);
      const x = s.side * (sm.GR * 1.02 * c + sm.openBow * bow * Math.pow(c, 1.2)) + s.side * s.rho * 0.5;
      const y = sm.GB * Math.sin(t) + 0.01 * Math.sin(clock.elapsedTime * 2 + s.phase);
      dummy.position.set(x, y, 0.16);
      dummy.scale.setScalar(i % count < shown ? 1 : 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count * 2]} frustumCulled={false}>
      <sphereGeometry args={[0.032, 8, 6]} />
      <meshStandardMaterial color={COLOURS.potassium} emissive={COLOURS.potassium} emissiveIntensity={1.6} toneMapped={false} />
    </instancedMesh>
  );
}

function StomaPanel({ solved, evapRateRef, windRef, speed, detail }) {
  const parts = usePlantModel();
  const sm = M.stoma;
  const guardRef = useRef(null);
  const bowRef = useRef(solved.aperture);
  useFrame((_, delta) => {
    bowRef.current += (solved.aperture - bowRef.current) * Math.min(1, delta * 2);
    const g = guardRef.current;
    if (g?.morphTargetInfluences) g.morphTargetInfluences[0] = bowRef.current;
  });
  const exitRef = useRef(0);
  useEffect(() => {
    exitRef.current = solved.aperture > 0.08 ? evapRateRef.current * 0.6 : 0;
  });
  const turgor = clamp((solved.turgorMPa - 0.6) / 3.9, 0, 1);
  const held = solved.aperture;
  const efflux = solved.droughtClosed && solved.kFraction > 0.04;
  const arrowLen = 0.22 + 0.4 * (efflux ? solved.kFraction : held);
  const outer = sm.GR * 2 + sm.openBow * solved.aperture + 0.15;
  const arrow = (sign, yOff, colour, name) => {
    const near = sign * (outer + 0.2);
    const far = sign * (outer + 0.2 + arrowLen);
    return efflux ? (
      <VectorArrow from={[near, yOff, 0.3]} to={[far, yOff, 0.3]} color={colour} radius={0.024} headLength={0.14} headRadius={0.06} label={detail ? name : undefined} labelOffset={0.28} />
    ) : (
      <VectorArrow from={[far, yOff, 0.3]} to={[near, yOff, 0.3]} color={colour} radius={0.024} headLength={0.14} headRadius={0.06} label={detail ? name : undefined} labelOffset={-arrowLen - 0.3} />
    );
  };
  return (
    <PanelFrame panel={PANELS.stoma}>
      <group rotation={[-0.32, 0, 0]} scale={0.95}>
        <mesh geometry={parts.stomaSurface.geometry}>
          <meshStandardMaterial vertexColors roughness={0.4} metalness={0} />
        </mesh>
        <mesh ref={guardRef} geometry={parts.stomaGuard.geometry} morphTargetInfluences={[0]}>
          <meshStandardMaterial vertexColors roughness={0.45} />
        </mesh>
        <IonFill held={held} bowRef={bowRef} />
        {/* Vapour diffusing out of the open pores, towards the viewer and away on the wind. */}
        {sm.stomata.map(([x, y], i) => (
          <Plume key={i} count={36} origin={[x, y, 0.02]} spread={[0.05, 0.25, 0.02]} velocity={[0, 0, 0.45]} driftRef={windRef} rateRef={exitRef} speed={speed} life={1.6} size={0.036} opacity={0.6} seed={50 + i} />
        ))}
        {(held > 0.04 || efflux) && (
          <>
            {arrow(-1, 0.3, COLOURS.potassium, "K⁺")}
            {arrow(1, 0.3, COLOURS.potassium, "K⁺")}
            {arrow(-1, -0.3, COLOURS.water, "H₂O")}
            {arrow(1, -0.3, COLOURS.water, "H₂O")}
          </>
        )}
      </group>
      <ToggleLabel position={[0, -1.25, 0.6]} accent={solved.poreOpen} tone={solved.poreOpen ? "text-sky-300" : "text-rose-300"}>
        {solved.poreOpen ? `open pore · ${solved.poreWidthUm.toFixed(1)} µm` : `closed pore · ${solved.poreWidthUm.toFixed(1)} µm`}
      </ToggleLabel>
      {detail && (
        <>
          <ToggleLabel position={[-1.2, 0.95, 0.6]} tone="text-emerald-300">
            guard cell · {turgor > 0.5 ? "turgid" : "flaccid"}
          </ToggleLabel>
          <ToggleLabel position={[1.35, 0.95, 0.4]} tone="text-ink-400">
            pavement cells
          </ToggleLabel>
          {solved.droughtClosed && (
            <ToggleLabel position={[0, 1.5, 0.6]} tone="text-amber-300">
              ABA from the roots · K⁺ dumped, pore shut
            </ToggleLabel>
          )}
        </>
      )}
    </PanelFrame>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

function Figure({ solved, speed, focus }) {
  // Every stream in the scene runs at the one flux.
  const flowRef = useRef(0);
  const evapRateRef = useRef(0);
  const windRef = useRef(0);
  useEffect(() => {
    flowRef.current = solved.rateMlPerHour * FLOW_UNITS_PER_ML * speed;
    evapRateRef.current = 1.5 + solved.rateMlPerHour * 0.1;
    windRef.current = solved.wind * 0.2;
  }, [solved, speed]);
  const colour = columnColour(solved.tensionMPa);
  const cavitated = solved.columnState === "cavitation";
  const drought = solved.soil === "drought";
  const all = focus === "all";
  const R = PANELS.root;
  const S = PANELS.stem;
  const L = PANELS.leaf;
  const T = PANELS.stoma;
  const hw = PANEL.width / 2;
  const hh = PANEL.height / 2;
  return (
    <>
      <Sun light={solved.light} />
      <Plant solved={solved} windRef={windRef} evapRateRef={evapRateRef} speed={speed} drought={drought} focusAll={all} />
      <RootPanel flowRef={flowRef} colour={colour} drought={drought} detail={focus === "root"} />
      <StemPanel flowRef={flowRef} colour={colour} cavitated={cavitated} speed={speed} detail={focus === "stem"} />
      <LeafPanel solved={solved} flowRef={flowRef} colour={colour} evapRateRef={evapRateRef} windRef={windRef} speed={speed} detail={focus === "leaf"} />
      <StomaPanel solved={solved} evapRateRef={evapRateRef} windRef={windRef} speed={speed} detail={focus === "stoma"} />
      {all && (
        <>
          <Hop from={[R.x, R.y + hh + 0.06, -1.1]} to={[S.x, S.y - hh - 0.32, -1.1]} />
          <Hop from={[S.x + hw + 0.04, S.y, -1.1]} to={[L.x - hw - 0.04, L.y, -1.1]} />
          <Hop from={[L.x, L.y - hh - 0.06, -1.1]} to={[T.x, T.y + hh + 0.32, -1.1]} />
        </>
      )}
    </>
  );
}

export default function TranspirationCanvas({ params = {} }) {
  const { light = 70, humidity = 50, wind = 2, soil = "hydrated", speed = 1, showLabels = true, focus = "all" } = params || {};
  const solved = useMemo(() => solveTranspiration({ light, humidity, wind, soil }), [light, humidity, wind, soil]);
  const view = VIEWS[focus] ?? VIEWS.all;
  return (
    <SceneCanvas
      camera={{ position: [0.7, 0.6, 16], fov: 42 }}
      controls={{ minDistance: 2.5, maxDistance: 34 }}
      lights={{ ambient: 0.6 + 0.25 * clamp(light / 100, 0, 1), keyLight: 0.7 + 0.9 * clamp(light / 100, 0, 1), rim: PALETTE.emerald }}
    >
      <FocusCamera view={view} />
      <LabelsOn.Provider value={showLabels !== false}>
        <Suspense fallback={null}>
          <Figure solved={solved} speed={speed} focus={VIEWS[focus] ? focus : "all"} />
        </Suspense>
      </LabelsOn.Provider>
    </SceneCanvas>
  );
}

useGLTF.preload(PLANT_GLB);

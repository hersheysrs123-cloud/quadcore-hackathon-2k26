"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Callout, Halo, PALETTE, SceneCanvas, SceneLabel, clamp, hashRandom, lerp, FitCamera, LabelsOn, ToggleLabel } from "@/components/visualizations/scene-kit";
import { TimelineCaption, TimelineDriver } from "@/components/visualizations/timeline-kit";
import { usePackedModel } from "@/components/visualizations/plant-model";
import { MICROBE_MODEL } from "@/components/visualizations/microbe-model-meta";
import { pulse, smoothstep } from "@/lib/timeline";
import { ANTIBIOTIC_TIMELINE, BURST_SIZE, LYTIC_TIMELINE, SIZE_RATIO, antibioticEfficacy, classify, describeAntibiotic, describeInfection, hostStatus } from "@/lib/pathogens";

// ─── Bacterium vs bacteriophage ─────────────────────────────────────
// Two specimens side by side, our own Blender models (public/models/
// microbes.glb, scripts/microbe-model), drawn to make the antibiotic
// argument visible.
//
// On the left, an E. coli cut away at the front, layer by layer: the
// peptidoglycan wall (its cut edge shows the outer membrane and the mesh),
// the cell membrane (a bilayer in section), and translucent cytoplasm with
// two hundred 70S ribosomes, a supercoiled nucleoid (no nucleus), two
// plasmids, short pili, and a bundle of flagella whose helical filaments
// spin. On the right, a T4 phage with none of those: an elongated
// icosahedral capsid of hexagonal capsomeres, its front sliced off to show
// the packed DNA spool, a contractile sheath of helical subunit rings, a
// baseplate and six kinked tail fibres.
//
// Two triggered timelines share the bacterium. PENICILLIN rains over both
// specimens: on the bacterium the molecules settle on the wall, the wall
// opens in holes (a dissolve driven by the model's integrity), the cell
// swells and bursts; on the phage they fall straight past. The LYTIC CYCLE
// sends a second phage across: it docks, its sheath contracts and drives
// the core through the wall, the DNA in its head drains into the cell, the
// host chromosome dissolves into fragments, ribosomes turn violet as the
// phage genes take them over, progeny assemble inside, and the wall breaks.
//
// Every motion — the flagella, the drifting ribosomes, the rain, both
// timelines — runs on one scene clock scaled by the speed slider.
// ─────────────────────────────────────────────────────────────────────

const MICROBES_GLB = "/models/microbes.glb";
const M = MICROBE_MODEL;

const BACT = { centre: [-2.0, 1.75, 0], radius: 1.0, half: M.cell.half };
const PHAGE_REF = { position: [5.6, 0.55, 0] };
/** Both specimens with their headline and meter labels. */
const MICROBE_VIEW = { cx: 1.1, cy: 1.15, width: 15.6, height: 8.2, depth: 3 };
/** Where the infecting phage docks: the strip of wall left on top, behind the cut-away. */
const ATTACH = [BACT.centre[0] - 0.3, BACT.centre[1] + BACT.radius + 0.01, -0.06];
const RIBOSOMES = 200;
const PROGENY_SEATS = 60;
const FRAGMENTS = 28;

const COLOURS = {
  ribosomeHijacked: "#a78bfa",
  penicillin: PALETTE.rose,
  burst: "#fecaca",
  meterOn: PALETTE.rose,
  phageDna: "#f472b6",
  flagellum: "#ece3cf",
  // vertex colours baked by scripts/microbe-model, named here for the key
  wall: "#c9a066",
  membrane: "#e98bb6",
  cytoplasm: "#c4e6f6",
  nucleoid: "#8b8ef4",
  plasmid: "#c084fc",
  ribosome: "#ffe39a",
  capsid: "#8b8fe0",
  sheath: "#9aa3ef",
  progeny: "#949ee6",
};

// ─── The scene clock ────────────────────────────────────────────────

/** One clock for every ambient motion, scaled by the speed slider (0 freezes it). */
function SceneClock({ clock, speed }) {
  useFrame((_, rawDelta) => {
    clock.dt = Math.min(rawDelta, 1 / 20) * speed;
    clock.t += clock.dt;
  }, -1);
  return null;
}

// ─── Materials ──────────────────────────────────────────────────────

const NOISE = /* glsl */ `
  float bvH(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float bvN(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(bvH(i), bvH(i + vec3(1, 0, 0)), f.x), mix(bvH(i + vec3(0, 1, 0)), bvH(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(bvH(i + vec3(0, 0, 1)), bvH(i + vec3(1, 0, 1)), f.x), mix(bvH(i + vec3(0, 1, 1)), bvH(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
`;

/**
 * A layer that can be eaten away: `uHoles` (0–1) opens holes in it (the
 * wall as penicillin stops its cross-links, the chromosome as the phage
 * degrades it) and `uBurst` (0–1) tears it apart, pushing the shreds
 * outwards. A thin pale rim glows on every torn edge.
 */
function makeDissolving(base, seed = 0) {
  const uniforms = {
    uHoles: { value: 0 },
    uBurst: { value: 0 },
    uSeed: { value: seed },
  };
  base.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\nuniform float uBurst, uSeed;\nvarying vec3 vLocal;\n${NOISE}`).replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
        vLocal = position;
        transformed += normal * uBurst * (0.2 + 0.8 * bvN(position * 2.3 + uSeed)) * 0.9;`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform float uHoles, uBurst, uSeed;\nvarying vec3 vLocal;\n${NOISE}`)
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        float bvNz = bvN(vLocal * 5.0 + uSeed) * 0.65 + bvN(vLocal * 16.0 + uSeed) * 0.35;
        float bvCut = max(uHoles, uBurst * 1.15);
        if (bvCut > 0.001 && bvNz < bvCut) discard;
        float bvEdge = bvCut > 0.001 ? 1.0 - smoothstep(0.0, 0.045, bvNz - bvCut) : 0.0;`,
      )
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.94, 0.82), bvEdge * 0.85);");
  };
  base.customProgramCacheKey = () => `dissolving-${seed}`;
  return { material: base, uniforms };
}

function useMaterials() {
  const mats = useMemo(() => {
    const wall = makeDissolving(
      new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.62,
        sheen: 0.4,
        sheenColor: new THREE.Color("#f3e3c2"),
        side: THREE.DoubleSide,
      }),
      1.7,
    );
    const pili = makeDissolving(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), 1.7);
    const membrane = makeDissolving(
      new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.35,
        clearcoat: 0.5,
        clearcoatRoughness: 0.3,
        side: THREE.DoubleSide,
      }),
      4.1,
    );
    const cytoplasm = makeDissolving(
      new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.15,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        side: THREE.DoubleSide,
      }),
      6.3,
    );
    const nucleoid = makeDissolving(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.45,
        emissive: new THREE.Color("#3b3fb0"),
        emissiveIntensity: 0.25,
      }),
      2.9,
    );
    return {
      wall,
      pili,
      membrane,
      cytoplasm,
      nucleoid,
      plain: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.5,
      }),
      flagellum: new THREE.MeshStandardMaterial({
        color: COLOURS.flagellum,
        roughness: 0.45,
        transparent: true,
        opacity: 1,
      }),
      // The hooks sit in the wall, so they tear away with it (same seed, same shreds).
      hook: makeDissolving(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }), 1.7),
      ribosome: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.55,
      }),
      capsid: new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.45,
        clearcoat: 0.3,
        side: THREE.DoubleSide,
      }),
      protein: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.5,
        metalness: 0.05,
      }),
      dna: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.4,
        emissive: new THREE.Color("#7a1f4f"),
        emissiveIntensity: 0.3,
      }),
      molecule: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.35,
        emissive: new THREE.Color("#3a0d18"),
        emissiveIntensity: 0.4,
      }),
    };
  }, []);
  useEffect(
    () => () =>
      Object.values(mats).forEach((m) => {
        (m.material ?? m).dispose();
      }),
    [mats],
  );
  return mats;
}

// ─── The bacterium ──────────────────────────────────────────────────

/** Ribosome seats inside the cytoplasm, clear of the nucleoid's core. */
function useRibosomeSeats(seed = 17) {
  return useMemo(() => {
    const seats = [];
    const r = M.cell.layers.cytoplasm[0] - 0.08;
    let k = 0;
    while (seats.length < RIBOSOMES && k < RIBOSOMES * 20) {
      k += 1;
      const x = (hashRandom(seed + k * 1.7) - 0.5) * 2 * (BACT.half + r);
      const y = (hashRandom(seed * 3 + k * 2.3) - 0.5) * 2 * r;
      const z = (hashRandom(seed * 5 + k * 0.9) - 0.5) * 2 * r;
      const over = Math.max(0, Math.abs(x) - BACT.half);
      if (y * y + z * z + over * over > r * r) continue;
      const core = (x / 1.0) ** 2 + (y / 0.3) ** 2 + (z / 0.28) ** 2 < 1; // the nucleoid excludes ribosomes
      if (core) continue;
      const dir = new THREE.Vector3(x * 0.5, y, z).normalize();
      seats.push({
        x,
        y,
        z,
        dir,
        phase: hashRandom(seed * 11 + k) * Math.PI * 2,
        rot: [hashRandom(k * 3.1) * 6, hashRandom(k * 4.3) * 6, hashRandom(k * 5.7) * 6],
      });
    }
    return seats;
  }, [seed]);
}

/** 70S ribosomes, drifting; hijacked to violet by the phage and flung out at lysis. */
function Ribosomes({ part, material, hijackRef, burstRef, clock }) {
  const meshRef = useRef(null);
  const seats = useRibosomeSeats();
  const state = useMemo(
    () => ({
      dummy: new THREE.Object3D(),
      colour: new THREE.Color(),
      white: new THREE.Color("#ffffff"),
      hijacked: new THREE.Color(COLOURS.ribosomeHijacked),
      last: -1,
    }),
    [],
  );
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const burst = smoothstep(burstRef.current);
    const t = clock.t;
    const d = state.dummy;
    for (let i = 0; i < seats.length; i += 1) {
      const s = seats[i];
      const fly = burst * 4.5;
      const j = burst > 0 ? 0 : 0.025;
      d.position.set(s.x + s.dir.x * fly + j * Math.sin(t * 1.3 + s.phase), s.y + s.dir.y * fly + j * Math.sin(t * 1.7 + s.phase * 2), s.z + s.dir.z * fly + j * Math.cos(t * 1.1 + s.phase));
      d.rotation.set(s.rot[0] + t * 0.4, s.rot[1] + burst * 6, s.rot[2]);
      d.scale.setScalar(0.075 * (1 - 0.8 * burst));
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    const h = clamp(hijackRef.current, 0, 1);
    if (h !== state.last) {
      state.last = h;
      state.colour.copy(state.white).lerp(state.hijacked, h);
      for (let i = 0; i < seats.length; i += 1) mesh.setColorAt(i, state.colour);
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });
  return <instancedMesh ref={meshRef} args={[part.geometry, material, seats.length]} frustumCulled={false} />;
}

/** Broken lengths of the host chromosome, scattering as the phage degrades it. */
function DnaFragments({ part, material, intactRef, burstRef, clock, seed = 23 }) {
  const meshRef = useRef(null);
  const seats = useMemo(
    () =>
      Array.from({ length: FRAGMENTS }, (_, i) => {
        const x = -0.1 + (hashRandom(seed + i * 1.3) - 0.5) * 1.9;
        const y = (hashRandom(seed * 3 + i * 1.7) - 0.5) * 0.7;
        const z = (hashRandom(seed * 5 + i * 2.1) - 0.5) * 0.65;
        return {
          x,
          y,
          z,
          dir: new THREE.Vector3(x * 0.6, y + 0.1, z + 0.2).normalize(),
          rot: [hashRandom(i * 7.1) * 6, hashRandom(i * 8.3) * 6, hashRandom(i * 9.7) * 6],
        };
      }),
    [seed],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const gone = 1 - clamp(intactRef.current, 0, 1);
    const burst = smoothstep(burstRef.current);
    const shown = Math.round(gone * FRAGMENTS);
    seats.forEach((s, i) => {
      const spread = 1 + 0.35 * gone;
      const fly = burst * 3.5;
      dummy.position.set(s.x * spread + s.dir.x * fly, s.y * spread + s.dir.y * fly + 0.02 * Math.sin(clock.t * 1.5 + i), s.z * spread + s.dir.z * fly);
      dummy.rotation.set(s.rot[0] + clock.t * 0.3, s.rot[1], s.rot[2]);
      dummy.scale.setScalar(i < shown ? 1 - 0.8 * burst : 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={meshRef} args={[part.geometry, material, FRAGMENTS]} frustumCulled={false} />;
}

/** Flagellar filament: a left-handed helix, its wave run along a curved axis. */
const FLAG = {
  length: 3.4,
  amp: 0.19,
  pitch: 1.2,
  tube: 0.022,
  stations: 150,
  sides: 6,
};
/**
 * Run and tumble: the bundle swims for a run, then the motors reverse and it
 * flies apart for TUMBLE seconds. Runs vary in length, as a real cell's do
 * (they end at random), between RUN_MIN and RUN_MIN + RUN_SPREAD seconds.
 */
const RUN_MIN = 3.5;
const RUN_SPREAD = 4.5;
const TUMBLE = 1.1;
const runLength = (k) => RUN_MIN + RUN_SPREAD * (0.5 + 0.5 * Math.sin(k * 12.9898 + 4.1) * Math.cos(k * 3.7));

const cr = (a0, a1, a2, a3, t, t2, t3) => 0.5 * (2 * a1 + (-a0 + a2) * t + (2 * a0 - 5 * a1 + 4 * a2 - a3) * t2 + (-a0 + 3 * a1 - 3 * a2 + a3) * t3);

/** Catmull-Rom through control points (arrays of Vector3) into `out` (Float32Array of xyz), `n` samples. */
function catmullInto(ctrl, out, n) {
  const k = ctrl.length;
  for (let i = 0; i < n; i += 1) {
    const u = (i / (n - 1)) * (k - 1);
    const seg = Math.min(k - 2, Math.floor(u));
    const t = u - seg;
    const p0 = ctrl[Math.max(seg - 1, 0)];
    const p1 = ctrl[seg];
    const p2 = ctrl[seg + 1];
    const p3 = ctrl[Math.min(seg + 2, k - 1)];
    const t2 = t * t;
    const t3 = t2 * t;
    out[i * 3] = cr(p0.x, p1.x, p2.x, p3.x, t, t2, t3);
    out[i * 3 + 1] = cr(p0.y, p1.y, p2.y, p3.y, t, t2, t3);
    out[i * 3 + 2] = cr(p0.z, p1.z, p2.z, p3.z, t, t2, t3);
  }
}

/** Parallel-transport frames along a polyline of `n` points (xyz in `P`), into N and B. */
const FT = new THREE.Vector3();
const FN = new THREE.Vector3();
function framesInto(P, n, T, N, B) {
  const t = FT;
  const nn = FN;
  for (let i = 0; i < n; i += 1) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    t.set(P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]).normalize();
    if (i === 0) {
      nn.set(0, 1, 0);
      if (Math.abs(nn.dot(t)) > 0.9) nn.set(0, 0, 1);
      nn.addScaledVector(t, -nn.dot(t)).normalize();
    } else {
      nn.set(N[(i - 1) * 3], N[(i - 1) * 3 + 1], N[(i - 1) * 3 + 2]);
      nn.addScaledVector(t, -nn.dot(t)).normalize();
    }
    T[i * 3] = t.x;
    T[i * 3 + 1] = t.y;
    T[i * 3 + 2] = t.z;
    N[i * 3] = nn.x;
    N[i * 3 + 1] = nn.y;
    N[i * 3 + 2] = nn.z;
    B[i * 3] = t.y * nn.z - t.z * nn.y;
    B[i * 3 + 1] = t.z * nn.x - t.x * nn.z;
    B[i * 3 + 2] = t.x * nn.y - t.y * nn.x;
  }
}

/**
 * One filament's path. It leaves its hook outwards, runs back along the
 * outside of the cell, and joins the bundle behind the pole. `splay` (0–1)
 * pushes the bundle apart, as in a tumble.
 */
function flagellumAxis(f, splay, out) {
  const half = BACT.half;
  const R = BACT.radius;
  const p0 = new THREE.Vector3(...f.hookEnd);
  const onCap = p0.x > half;
  const rad = new THREE.Vector3(0, p0.y, p0.z).normalize();
  const fan = 1 + splay * 6;
  const ctrl = [p0, p0.clone().add(new THREE.Vector3(onCap ? 0.3 : 0.2, rad.y * 0.32, rad.z * 0.32))];
  if (!onCap) ctrl.push(new THREE.Vector3(Math.max(p0.x + 0.5, half + 0.2), rad.y * (R + 0.4), rad.z * (R + 0.4)));
  const b = new THREE.Vector3(half + R + 0.75, 0.04 + rad.y * 0.16 * fan, -0.12 + rad.z * 0.16 * fan);
  ctrl.push(b);
  ctrl.push(b.clone().add(new THREE.Vector3(1.4 - 0.5 * splay, rad.y * (0.12 + 1.2 * splay), rad.z * (0.12 + 1.2 * splay))));
  ctrl.push(b.clone().add(new THREE.Vector3(2.9 - 1.2 * splay, rad.y * (0.25 + 2.0 * splay), rad.z * (0.25 + 2.0 * splay))));
  catmullInto(ctrl, out, out.length / 3);
}

/**
 * The flagella. Each filament is a left-handed helix whose wave runs down
 * a curved axis as its motor turns it: redrawn every frame on the scene
 * clock, so the speed slider sets the pace. Every few seconds the cell
 * tumbles, as E. coli does: the motors reverse, the bundle flies apart,
 * then it re-forms and the cell swims on. The motors stop when it dies.
 */
function Flagella({ material, burstRef, clock }) {
  const n = FLAG.stations;
  const sides = FLAG.sides;
  const data = useMemo(() => {
    const dense = 240;
    return M.flagella.map((f, k) => {
      const geometry = new THREE.BufferGeometry();
      const pos = new Float32Array(n * sides * 3);
      const nrm = new Float32Array(n * sides * 3);
      const idx = [];
      for (let i = 0; i < n - 1; i += 1) {
        for (let j = 0; j < sides; j += 1) {
          const a = i * sides + j;
          const b2 = i * sides + ((j + 1) % sides);
          idx.push(a, a + sides, b2, b2, a + sides, b2 + sides);
        }
      }
      geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geometry.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
      geometry.setIndex(idx);
      geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(2.5, 0, 0), 6);
      return {
        f,
        geometry,
        pos,
        nrm,
        phase: k * 1.7,
        axis: new Float32Array(dense * 3),
        A: new Float32Array(n * 3),
        AT: new Float32Array(n * 3),
        AN: new Float32Array(n * 3),
        AB: new Float32Array(n * 3),
        H: new Float32Array(n * 3),
        HT: new Float32Array(n * 3),
        HN: new Float32Array(n * 3),
        HB: new Float32Array(n * 3),
        cum: new Float32Array(dense),
      };
    });
  }, [n, sides]);
  useEffect(() => () => data.forEach((d) => d.geometry.dispose()), [data]);
  const motor = useRef({ angle: 0, start: 0, k: 0, run: runLength(0) });

  useFrame(() => {
    const burst = smoothstep(burstRef.current);
    const alive = 1 - burst;
    // Run and tumble on the scene clock.
    const mo = motor.current;
    while (clock.t - mo.start > mo.run + TUMBLE) {
      mo.start += mo.run + TUMBLE;
      mo.k += 1;
      mo.run = runLength(mo.k);
    }
    const cycle = clock.t - mo.start;
    const tumble = cycle > mo.run ? Math.sin(((cycle - mo.run) / TUMBLE) * Math.PI) : 0;
    const dir = cycle > mo.run + TUMBLE * 0.15 && cycle < mo.run + TUMBLE * 0.85 ? -1 : 1; // the motors reverse to tumble
    mo.angle += clock.dt * 13 * dir * alive;
    for (const d of data) {
      // The axis, then stations evenly spaced along its length.
      flagellumAxis(d.f, tumble * alive + burst * 0.4, d.axis);
      const m = d.axis.length / 3;
      d.cum[0] = 0;
      for (let i = 1; i < m; i += 1) {
        const dx = d.axis[i * 3] - d.axis[i * 3 - 3];
        const dy = d.axis[i * 3 + 1] - d.axis[i * 3 - 2];
        const dz = d.axis[i * 3 + 2] - d.axis[i * 3 - 1];
        d.cum[i] = d.cum[i - 1] + Math.hypot(dx, dy, dz);
      }
      const total = Math.min(FLAG.length, d.cum[m - 1]);
      let seg = 0;
      for (let i = 0; i < n; i += 1) {
        const s = (i / (n - 1)) * total;
        while (seg < m - 2 && d.cum[seg + 1] < s) seg += 1;
        const t = (s - d.cum[seg]) / Math.max(1e-6, d.cum[seg + 1] - d.cum[seg]);
        for (let j = 0; j < 3; j += 1) d.A[i * 3 + j] = d.axis[seg * 3 + j] + (d.axis[seg * 3 + 3 + j] - d.axis[seg * 3 + j]) * t;
      }
      framesInto(d.A, n, d.AT, d.AN, d.AB);
      // The helix round the axis: its phase runs with the motor, so the wave travels down the filament.
      for (let i = 0; i < n; i += 1) {
        const s = (i / (n - 1)) * total;
        const amp = FLAG.amp * Math.min(1, s / 0.45) * (1 - 0.2 * Math.max(0, (s - total * 0.75) / (total * 0.25)));
        const ph = (-2 * Math.PI * s) / FLAG.pitch + motor.current.angle + d.phase;
        const c = Math.cos(ph) * amp;
        const sn = Math.sin(ph) * amp;
        for (let j = 0; j < 3; j += 1) d.H[i * 3 + j] = d.A[i * 3 + j] + d.AN[i * 3 + j] * c + d.AB[i * 3 + j] * sn;
      }
      // The tube round the helix.
      framesInto(d.H, n, d.HT, d.HN, d.HB);
      for (let i = 0; i < n; i += 1) {
        const r = FLAG.tube * (1 - 0.3 * (i / (n - 1)));
        for (let j = 0; j < sides; j += 1) {
          const a = (j / sides) * Math.PI * 2;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const o = (i * sides + j) * 3;
          for (let k = 0; k < 3; k += 1) {
            const nv = d.HN[i * 3 + k] * ca + d.HB[i * 3 + k] * sa;
            d.nrm[o + k] = nv;
            d.pos[o + k] = d.H[i * 3 + k] + nv * r;
          }
        }
      }
      d.geometry.attributes.position.needsUpdate = true;
      d.geometry.attributes.normal.needsUpdate = true;
    }
    material.opacity = 1 - smoothstep(clamp(burstRef.current * 1.8 - 0.2, 0, 1)); // shed by the time the wall is gone
    material.visible = material.opacity > 0.01;
  });
  return data.map((d, i) => <mesh key={i} geometry={d.geometry} material={material} frustumCulled={false} />);
}

/**
 * The whole cell. `refs` carry per-frame values from the timelines:
 * wall integrity, swelling, burst progress, host-DNA intactness and the
 * ribosome hijack fraction.
 */
function Bacterium({ parts, mats, refs, clock, status }) {
  const shell = useRef(null);
  const plasmids = useRef(null);
  useFrame(() => {
    const burst = smoothstep(refs.burst.current);
    const swell = refs.swelling.current;
    if (shell.current) shell.current.scale.set(1 + swell * 0.8 + 0.12 * burst, 1 + swell + 0.18 * burst, 1 + swell + 0.18 * burst);
    const holes = (1 - clamp(refs.integrity.current, 0, 1)) * 0.6;
    mats.wall.uniforms.uHoles.value = holes;
    mats.pili.uniforms.uHoles.value = holes;
    mats.hook.uniforms.uHoles.value = holes;
    for (const m of [mats.wall, mats.pili, mats.hook, mats.membrane, mats.cytoplasm, mats.nucleoid]) m.uniforms.uBurst.value = burst;
    // The membrane bulges through the holes, then leaks too as the cell swells past bursting.
    mats.membrane.uniforms.uHoles.value = Math.max(0, holes - 0.45) * 1.5;
    mats.nucleoid.uniforms.uHoles.value = (1 - clamp(refs.dnaIntact.current, 0, 1)) * 1.02;
    if (plasmids.current) {
      plasmids.current.children.forEach((p, i) => {
        p.rotation.y = clock.t * (0.3 + 0.1 * i) + i;
        p.position.y = (i ? 0.35 : -0.42) + 0.03 * Math.sin(clock.t + i * 2) + (i ? 1 : -1) * burst * 1.6;
        p.position.x = (i ? -1.25 : 1.1) + (i ? -1 : 1) * burst * 2.2;
        p.scale.setScalar(Math.max(0.001, 1 - burst));
      });
    }
  });
  const alive = status.alive;
  return (
    <group position={BACT.centre}>
      <group ref={shell}>
        {parts.wall && <mesh geometry={parts.wall.geometry} material={mats.wall.material} />}
        {parts.membrane && <mesh geometry={parts.membrane.geometry} material={mats.membrane.material} />}
        {parts.cytoplasm && <mesh geometry={parts.cytoplasm.geometry} material={mats.cytoplasm.material} renderOrder={2} />}
        {parts.pili && <mesh geometry={parts.pili.geometry} material={mats.pili.material} />}
        {parts.flagellaHooks && <mesh geometry={parts.flagellaHooks.geometry} material={mats.hook.material} />}
        <Flagella material={mats.flagellum} burstRef={refs.burst} clock={clock} />
      </group>
      {parts.nucleoid && <mesh geometry={parts.nucleoid.geometry} material={mats.nucleoid.material} />}
      {parts.dnaFragment && <DnaFragments part={parts.dnaFragment} material={mats.nucleoid.material} intactRef={refs.dnaIntact} burstRef={refs.burst} clock={clock} />}
      {parts.ribosome && <Ribosomes part={parts.ribosome} material={mats.ribosome} hijackRef={refs.hijack} burstRef={refs.burst} clock={clock} />}
      <group ref={plasmids}>
        {parts.plasmid && (
          <>
            <mesh geometry={parts.plasmid.geometry} material={mats.plain} position={[1.1, -0.42, 0.3]} rotation={[0.5, 0, 0.2]} />
            <mesh geometry={parts.plasmid.geometry} material={mats.plain} position={[-1.25, 0.35, -0.1]} rotation={[-0.4, 0, 0.6]} scale={0.8} />
          </>
        )}
      </group>

      {/* Labels: callouts to a column on the left and short leaders to the right. Gone with the cell. */}
      {alive && (
        <>
          <Callout anchor={[0.35, 0.97, -0.15]} at={[-2.3, 1.35, 0.6]} side="left" tone="text-amber-200">
            peptidoglycan cell wall
          </Callout>
          <Callout anchor={[-1.05, 0.75, 0.48]} at={[-2.3, 0.75, 0.6]} side="left" tone="text-pink-300">
            cell membrane
          </Callout>
          <Callout anchor={[-0.45, 0.12, 0.2]} at={[-2.3, 0.15, 0.6]} side="left" tone="text-indigo-300">
            circular chromosome · no nucleus
          </Callout>
          <Callout anchor={[-0.7, -0.55, 0.6]} at={[-2.3, -0.45, 0.6]} side="left" tone="text-sky-300">
            cytoplasm · metabolism
          </Callout>
          <Callout anchor={[0.75, -0.3, 0.45]} at={[1.95, -0.55, 0.6]} side="right" tone="text-amber-100">
            70S ribosomes
          </Callout>
          <Callout anchor={[1.1, -0.42, 0.3]} at={[1.95, -1.05, 0.6]} side="right" tone="text-violet-300">
            plasmid
          </Callout>
          <ToggleLabel position={[3.6, 0.85, 0.2]} tone="text-ink-300">
            flagella · rotating motors
          </ToggleLabel>
        </>
      )}
      <ToggleLabel position={[0, -1.55, 0.5]} tone={alive ? "text-emerald-300" : "text-rose-300"} accent={!alive}>
        {`bacterium · 2 µm · ${status.label}`}
      </ToggleLabel>
    </group>
  );
}

// ─── The phage ──────────────────────────────────────────────────────

const SHEATH_LENGTH = M.phage.sheathLength;
const FIBRE_CORNERS = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2 + Math.PI / 6);

/**
 * A T4 phage with its origin at the baseplate, tail down. `contractionRef`
 * (0–1) shortens and fattens the sheath and drops the head, leaving the
 * core exposed below the baseplate; `dnaRef` (1 → 0) drains the spool.
 */
function PhageModel({ parts, mats, position, rotation = [0, 0, 0], contractionRef, dnaRef, labels = false, scale = 1, groupRef }) {
  const sheath = useRef(null);
  const upper = useRef(null);
  const core = useRef(null);
  const dna = useRef(null);
  useFrame(() => {
    const c = contractionRef ? clamp(contractionRef.current, 0, 1) : 0;
    const s = 1 - 0.5 * c;
    if (sheath.current) {
      sheath.current.scale.set(1 + 0.32 * c, s, 1 + 0.32 * c);
      sheath.current.position.y = 0.06 + (SHEATH_LENGTH * s) / 2;
    }
    if (upper.current) upper.current.position.y = 0.06 + SHEATH_LENGTH * s;
    if (core.current) core.current.position.y = 0.06 + SHEATH_LENGTH * s - SHEATH_LENGTH / 2;
    if (dna.current) {
      const f = dnaRef ? clamp(dnaRef.current, 0, 1) : 1;
      dna.current.scale.set(Math.max(0.001, 0.4 + 0.6 * f), Math.max(0.001, f), Math.max(0.001, 0.4 + 0.6 * f));
      dna.current.visible = f > 0.01;
    }
  });
  if (!parts.phageHead) return null;
  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <mesh geometry={parts.phageBaseplate.geometry} material={mats.protein} />
      {/* The tail tube: fixed length, so it pokes out below when the sheath contracts. */}
      <mesh ref={core} geometry={parts.phageCore.geometry} material={mats.protein} position={[0, 0.06 + SHEATH_LENGTH / 2, 0]} />
      <group ref={sheath} position={[0, 0.06 + SHEATH_LENGTH / 2, 0]}>
        <mesh geometry={parts.phageSheath.geometry} material={mats.protein} />
      </group>
      {/* Collar and head ride on top of the sheath. */}
      <group ref={upper} position={[0, 0.06 + SHEATH_LENGTH, 0]}>
        <mesh geometry={parts.phageHead.geometry} material={mats.capsid} />
        <mesh ref={dna} geometry={parts.phageDna.geometry} material={mats.dna} position={[0, M.phage.headCentre, 0]} />
      </group>
      {FIBRE_CORNERS.map((a, i) => (
        <group key={i} position={[0.3 * Math.cos(a), 0, -0.3 * Math.sin(a)]} rotation={[0, a, 0]}>
          <mesh geometry={parts.phageFibre.geometry} material={mats.protein} />
        </group>
      ))}
      {labels && (
        <>
          <ToggleLabel position={[1.2, 2.1, 0.2]} tone="text-sky-300">
            icosahedral capsid head · protein
          </ToggleLabel>
          <ToggleLabel position={[-1.15, 1.8, 0.2]} tone="text-pink-300">
            DNA core
          </ToggleLabel>
          <ToggleLabel position={[1.1, 0.7, 0.2]} tone="text-indigo-300">
            contractile sheath
          </ToggleLabel>
          <ToggleLabel position={[-1.0, 0.1, 0.2]} tone="text-indigo-200">
            baseplate
          </ToggleLabel>
          <ToggleLabel position={[1.25, -0.5, 0.2]} tone="text-ink-300">
            tail fibres · bind one host's receptors
          </ToggleLabel>
        </>
      )}
    </group>
  );
}

/** The infecting phage: flies in, docks tail-first, and fires. */
function InfectingPhage({ parts, mats, liveRef }) {
  const groupRef = useRef(null);
  const contractionRef = useRef(0);
  const dnaRef = useRef(1);
  const strand = useRef(null);
  const start = useMemo(() => new THREE.Vector3(5.2, 6.0, 1.4), []);
  const end = useMemo(() => new THREE.Vector3(...ATTACH), []);
  useFrame(() => {
    const snap = liveRef.current;
    const d = describeInfection(snap ? snap.t : 0);
    const g = groupRef.current;
    if (!g) return;
    if (!d.started) {
      g.visible = false;
      contractionRef.current = 0;
      dnaRef.current = 1;
      if (strand.current) strand.current.visible = false;
      return;
    }
    g.visible = d.lysis < 0.6;
    const k = smoothstep(d.attachment);
    g.position.lerpVectors(start, end, k);
    g.position.y += Math.sin(Math.PI * k) * 1.2;
    g.rotation.z = lerp(-0.6, 0, k);
    contractionRef.current = d.sheathContraction;
    dnaRef.current = 1 - d.genomeInjected;
    if (strand.current) {
      const len = 1.4 * d.genomeInjected;
      strand.current.visible = d.injection > 0 && d.takeover < 1;
      strand.current.scale.y = Math.max(0.001, len);
      strand.current.position.set(ATTACH[0], ATTACH[1] - 0.25 - len / 2, ATTACH[2]);
      strand.current.material.opacity = 1 - 0.9 * smoothstep(d.takeover);
    }
  });
  return (
    <group>
      <PhageModel parts={parts} mats={mats} groupRef={groupRef} position={[5.2, 6.0, 1.4]} contractionRef={contractionRef} dnaRef={dnaRef} scale={0.75} />
      {/* The genome, going down the tail tube into the cytoplasm. */}
      <mesh ref={strand} visible={false}>
        <cylinderGeometry args={[0.025, 0.025, 1, 6]} />
        <meshStandardMaterial color={COLOURS.phageDna} emissive={COLOURS.phageDna} emissiveIntensity={0.9} transparent opacity={1} />
      </mesh>
    </group>
  );
}

/** Progeny assembling in the cytoplasm, then bursting out. */
function Progeny({ part, material, liveRef, clock, seed = 31 }) {
  const meshRef = useRef(null);
  const seats = useMemo(
    () =>
      Array.from({ length: PROGENY_SEATS }, (_, i) => {
        const x = BACT.centre[0] + (hashRandom(seed + i * 1.9) - 0.5) * (2 * BACT.half + 0.8);
        const ang = hashRandom(seed * 3 + i * 2.7) * Math.PI * 2;
        const rr = Math.sqrt(hashRandom(seed * 5 + i * 0.7)) * BACT.radius * 0.65;
        const y = BACT.centre[1] + Math.cos(ang) * rr;
        const z = BACT.centre[2] + Math.sin(ang) * rr;
        const dir = new THREE.Vector3(x - BACT.centre[0], (y - BACT.centre[1]) * 1.6, z - BACT.centre[2] + 0.3).normalize();
        return {
          x,
          y,
          z,
          dir,
          tilt: (hashRandom(seed * 7 + i) - 0.5) * 1.2,
          spin: hashRandom(seed * 9 + i) * Math.PI * 2,
        };
      }),
    [seed],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const snap = liveRef.current;
    const d = describeInfection(snap ? snap.t : 0);
    const shown = Math.round((d.virionsAssembled / BURST_SIZE) * PROGENY_SEATS);
    const burst = smoothstep(d.lysis);
    const t = clock.t;
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < PROGENY_SEATS; i += 1) {
      const seat = seats[i];
      const on = i < shown;
      const fly = burst * 5.5;
      const fade = burst > 0.7 ? 1 - (burst - 0.7) / 0.3 : 1;
      dummy.position.set(seat.x + seat.dir.x * fly, seat.y + seat.dir.y * fly + (burst > 0 ? 0 : 0.02 * Math.sin(t * 2 + seat.spin)), seat.z + seat.dir.z * fly);
      dummy.rotation.set(seat.tilt + burst * 2.5, seat.spin + burst * 4, 0);
      dummy.scale.setScalar(on ? 0.13 * fade : 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={meshRef} args={[part.geometry, material, PROGENY_SEATS]} frustumCulled={false} />;
}

/**
 * Penicillin molecules raining over both specimens. Over the bacterium
 * they settle on the wall (binding the wall-building enzymes) and stay
 * until it bursts; over the phage there is nothing to bind, and they fall
 * straight past.
 */
function PenicillinRain({ part, material, rateRef, burstRef, clock, count = 90, seed = 41 }) {
  const meshRef = useRef(null);
  const state = useMemo(
    () => ({
      age: new Float32Array(count).fill(-1),
      x: new Float32Array(count),
      y: new Float32Array(count),
      z: new Float32Array(count),
      stuck: new Uint8Array(count),
      spin: Float32Array.from({ length: count }, (_, i) => hashRandom(seed + i * 1.3) * Math.PI * 2),
      pending: 0,
      spawned: 0,
      dummy: new THREE.Object3D(),
    }),
    [count, seed],
  );
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = clock.dt;
    const burst = smoothstep(burstRef.current);
    state.pending = Math.min(4, state.pending + rateRef.current * dt);
    const d = state.dummy;
    for (let i = 0; i < count; i += 1) {
      let age = state.age[i];
      if (age < 0 && state.pending >= 1) {
        state.pending -= 1;
        state.spawned += 1;
        age = 0;
        state.stuck[i] = 0;
        state.x[i] = -7 + hashRandom(seed * 3 + i * 2.1 + state.spawned * 0.37) * 13;
        state.z[i] = -1.2 + hashRandom(seed * 5 + i * 3.3 + state.spawned * 0.11) * 2.4;
        state.y[i] = 6.4;
      }
      if (age >= 0) {
        age += dt;
        if (!state.stuck[i]) {
          state.y[i] -= 2.1 * dt;
          // Over the cell: settle on its surface while there is a wall to bind.
          const lx = state.x[i] - BACT.centre[0];
          const over = Math.max(0, Math.abs(lx) - BACT.half);
          const r2 = BACT.radius * BACT.radius - over * over - state.z[i] * state.z[i];
          if (r2 > 0 && burst < 0.05) {
            const top = BACT.centre[1] + Math.sqrt(r2) + 0.05;
            if (state.y[i] <= top) {
              state.y[i] = top;
              state.stuck[i] = 1;
            }
          }
        } else if (burst > 0.05) {
          state.stuck[i] = 0; // the wall it bound is gone
        }
        if (state.y[i] < -2.5 || age > 9) age = -1;
      }
      state.age[i] = age;
      if (age < 0) {
        d.scale.setScalar(0);
        d.position.set(0, -100, 0);
      } else {
        const wobble = state.stuck[i] ? 0 : 0.12 * Math.sin(age * 3 + state.spin[i]);
        d.position.set(state.x[i] + wobble, state.y[i], state.z[i]);
        d.rotation.set(state.stuck[i] ? 0.3 : age * 1.6 + state.spin[i], state.spin[i], state.stuck[i] ? 0 : age);
        d.scale.setScalar(0.34);
      }
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={meshRef} args={[part.geometry, material, count]} frustumCulled={false} />;
}

/** A horizontal efficacy meter under each specimen. */
function EfficacyMeter({ position, percent, label, width = 2.6 }) {
  const fill = (width * clamp(percent, 0, 100)) / 100;
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[width, 0.16, 0.12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} transparent opacity={0.8} />
      </mesh>
      {fill > 0.01 && (
        <mesh position={[-width / 2 + fill / 2, 0, 0.02]} scale={[fill, 1, 1]}>
          <boxGeometry args={[1, 0.12, 0.12]} />
          <meshStandardMaterial color={COLOURS.meterOn} emissive={COLOURS.meterOn} emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
      )}
      <SceneLabel position={[0, -0.32, 0]} tone={percent > 0 ? "text-rose-300" : "text-ink-400"}>
        {label}
      </SceneLabel>
    </group>
  );
}

/**
 * Reads both timelines every frame and writes what the bacterium's parts
 * need: the wall is shredded by penicillin or broken by the phage's
 * lysozyme, whichever comes first; swelling, burst, host-DNA loss and
 * ribosome hijack each come from the timeline that owns them.
 */
function BlendDriver({ refs, rainRef, lyticLive, antibioticLive }) {
  useFrame(() => {
    const a = describeAntibiotic(antibioticLive.current ? antibioticLive.current.t : 0);
    const v = describeInfection(lyticLive.current ? lyticLive.current.t : 0);
    refs.integrity.current = Math.min(a.wallIntegrity, 1 - smoothstep(v.lysis));
    refs.swelling.current = a.swelling;
    refs.burst.current = Math.max(a.lysis, v.lysis);
    refs.dnaIntact.current = v.hostDnaIntact;
    refs.hijack.current = smoothstep(v.takeover);
    rainRef.current = a.started && !a.complete ? 8 + 40 * pulse(a.t / ANTIBIOTIC_TIMELINE.total, 0.45) : 0;
  });
  return null;
}

/** Everything built from the model: it suspends while the GLB loads, the labels do not. */
function Specimens({ refs, rainRef, clock, status, lyticLive }) {
  const parts = usePackedModel(MICROBES_GLB);
  const mats = useMaterials();
  return (
    <group>
      <Bacterium parts={parts} mats={mats} refs={refs} clock={clock} status={status} />
      {parts.phageLow && <Progeny part={parts.phageLow} material={mats.protein} liveRef={lyticLive} clock={clock} />}
      <InfectingPhage parts={parts} mats={mats} liveRef={lyticLive} />
      <PhageModel parts={parts} mats={mats} position={PHAGE_REF.position} labels scale={1.05} />
      {parts.penicillin && <PenicillinRain part={parts.penicillin} material={mats.molecule} rateRef={rainRef} burstRef={refs.burst} clock={clock} />}
    </group>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function BacteriaVsVirusCanvas({ params = {}, setParam }) {
  const { antibiotic = 0, lytic = 0, speed = 1, showLabels = true } = params || {};

  // Whichever button was pressed last owns the bacterium; the other timeline goes idle.
  const [latest, setLatest] = useState(null);
  const seen = useRef({ antibiotic, lytic });
  useEffect(() => {
    if (antibiotic !== seen.current.antibiotic) setLatest(antibiotic > 0 ? "antibiotic" : null);
    else if (lytic !== seen.current.lytic) setLatest(lytic > 0 ? "lytic" : null);
    seen.current = { antibiotic, lytic };
  }, [antibiotic, lytic]);
  const antibioticTrigger = latest === "antibiotic" ? antibiotic : 0;
  const lyticTrigger = latest === "lytic" ? lytic : 0;

  const lyticLive = useRef(null);
  const antibioticLive = useRef(null);
  const [lyticSnap, setLyticSnap] = useState(null);
  const [antibioticSnap, setAntibioticSnap] = useState(null);
  const infection = useMemo(() => describeInfection(lyticSnap ? lyticSnap.t : 0), [lyticSnap]);
  const drug = useMemo(() => describeAntibiotic(antibioticSnap ? antibioticSnap.t : 0), [antibioticSnap]);
  const status = hostStatus(infection, drug);
  const bursting = Math.max(infection.lysis, drug.lysis);

  // Per-frame refs the bacterium's parts read, and the scene clock.
  const refs = useMemo(
    () => ({
      integrity: { current: 1 },
      swelling: { current: 0 },
      burst: { current: 0 },
      dnaIntact: { current: 1 },
      hijack: { current: 0 },
    }),
    [],
  );
  const rainRef = useRef(0);
  const clock = useMemo(() => ({ t: 0, dt: 0 }), []);
  const sp = Number(speed);
  const rate = Number.isFinite(sp) ? Math.max(0, sp) : 1;

  // Tell the HUD where both clocks are.
  const pushed = useRef({});
  useEffect(() => {
    if (typeof setParam !== "function") return;
    const next = {
      liveLyticT: Math.round(infection.t * 10) / 10,
      liveAntibioticT: Math.round(drug.t * 10) / 10,
    };
    for (const key of Object.keys(next)) if (pushed.current[key] !== next[key]) setParam(key, next[key]);
    pushed.current = next;
  }, [infection.t, drug.t, setParam]);

  const bactLiving = classify("bacterium");
  const virusLiving = classify("virus");
  const eff = {
    bacterium: antibioticEfficacy("bacterium"),
    virus: antibioticEfficacy("virus"),
  };

  return (
    <SceneCanvas
      camera={{ position: [1.9, 2.9, 13.6], fov: 42 }}
      controls={{
        minDistance: 3,
        maxDistance: 30,
        maxPolarAngle: Math.PI * 0.55,
      }}
      lights={{ ambient: 0.55, keyLight: 1.25, rim: PALETTE.violet }}
    >
      <FitCamera view={MICROBE_VIEW} direction={[0.02, 0.1, 1]} fov={42} />
      <SceneClock clock={clock} speed={rate} />
      <hemisphereLight args={["#eef4ff", "#2b2440", 0.5]} />
      <directionalLight position={[-3, 4, 7]} intensity={0.55} color="#fff6ea" />
      <LabelsOn.Provider value={showLabels !== false}>
        <TimelineDriver timeline={LYTIC_TIMELINE} trigger={lyticTrigger} speed={rate} live={lyticLive} onTick={setLyticSnap} />
        <TimelineDriver timeline={ANTIBIOTIC_TIMELINE} trigger={antibioticTrigger} speed={rate} live={antibioticLive} onTick={setAntibioticSnap} />
        <BlendDriver refs={refs} rainRef={rainRef} lyticLive={lyticLive} antibioticLive={antibioticLive} />

        <Suspense fallback={null}>
          <Specimens refs={refs} rainRef={rainRef} clock={clock} status={status} lyticLive={lyticLive} />
        </Suspense>

        {/* Burst flash while the wall is going. */}
        {bursting > 0 && bursting < 1 && <Halo position={BACT.centre} radius={2.4} color={COLOURS.burst} opacity={0.14 * pulse(bursting, 0.4)} />}

        {/* Headline labels */}
        <ToggleLabel position={[BACT.centre[0], 4.75, 0]} accent>
          {`BACTERIUM · ${bactLiving.verdict} · ${bactLiving.met}/${bactLiving.total} criteria`}
        </ToggleLabel>
        <ToggleLabel position={[PHAGE_REF.position[0], 4.75, 0]} accent>
          {`VIRUS · ${virusLiving.verdict} · ${virusLiving.met}/${virusLiving.total} criteria`}
        </ToggleLabel>
        <ToggleLabel position={[PHAGE_REF.position[0], -0.95, 0]} tone="text-ink-400">
          {`T4 bacteriophage · 200 nm · ~${SIZE_RATIO}× smaller than the bacterium (not to scale)`}
        </ToggleLabel>

        <EfficacyMeter
          position={[BACT.centre[0], -1.35, 0]}
          percent={drug.started ? eff.bacterium.percent * smoothstep(Math.min(1, drug.t / 1.5)) : 0}
          label={drug.started ? `penicillin efficacy ${eff.bacterium.percent} % · wall ${Math.round(drug.wallIntegrity * 100)} % intact` : "penicillin efficacy — press Administer"}
        />
        <EfficacyMeter
          position={[PHAGE_REF.position[0], -1.35, 0]}
          percent={0}
          label={drug.started ? `penicillin efficacy ${eff.virus.percent} % · no wall, no ribosomes, no metabolism` : "penicillin efficacy — nothing to hit"}
        />

        {/* Event captions */}
        {infection.started && (
          <ToggleLabel position={[BACT.centre[0] + 1.7, 4.05, 0.4]} tone={infection.lysed ? "text-rose-300" : "text-sky-300"} accent={infection.lysed}>
            {infection.lysed
              ? `burst size · ${infection.released} new phages released`
              : infection.stage === "assembly"
                ? `virions assembled · ${infection.virionsAssembled} / ${BURST_SIZE}`
                : infection.stage === "takeover"
                  ? `host DNA ${Math.round(infection.hostDnaIntact * 100)} % intact · ribosomes making phage proteins`
                  : infection.stage === "injection"
                    ? `sheath contracts · genome ${Math.round(infection.genomeInjected * 100)} % injected`
                    : infection.stage === "lysis"
                      ? "lysozyme breaks the wall · the progeny escape"
                      : "tail fibres find their receptor · baseplate docks"}
          </ToggleLabel>
        )}
        {drug.started && (
          <ToggleLabel position={[PHAGE_REF.position[0], 4.1, 0.4]} tone="text-ink-300">
            penicillin falls straight past · no effect
          </ToggleLabel>
        )}
        {drug.started && !drug.lysed && (
          <ToggleLabel position={[BACT.centre[0], 4.05, 0.4]} tone="text-rose-300">
            {drug.stage === "administer"
              ? "penicillin binds the wall-building enzymes"
              : drug.stage === "breach"
                ? `cross-links fail · wall ${Math.round(drug.wallIntegrity * 100)} % intact · swelling`
                : "osmotic lysis · water rushes in"}
          </ToggleLabel>
        )}
        {drug.lysed && (
          <ToggleLabel position={[BACT.centre[0], 4.05, 0.4]} tone="text-rose-300" accent>
            lysed by penicillin · the virus next door is untouched
          </ToggleLabel>
        )}

        <TimelineCaption
          position={[0, -2.3, 0.5]}
          timeline={latest === "antibiotic" ? ANTIBIOTIC_TIMELINE : LYTIC_TIMELINE}
          snapshot={latest === "antibiotic" ? antibioticSnap : lyticSnap}
          idle="press Administer penicillin, or Trigger viral lytic cycle"
          tone={latest === "antibiotic" ? "text-rose-300" : "text-sky-300"}
        />
      </LabelsOn.Provider>
    </SceneCanvas>
  );
}

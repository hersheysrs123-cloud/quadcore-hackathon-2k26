"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import {
  Halo,
  PALETTE,
  SceneCanvas,
  SceneLabel,
  clamp,
  hashRandom,
  lerp,
} from "@/components/visualizations/scene-kit";
import { TimelineCaption, TimelineDriver } from "@/components/visualizations/timeline-kit";
import { pulse, smoothstep } from "@/lib/timeline";
import {
  ANTIBIOTIC_TIMELINE,
  BURST_SIZE,
  LYTIC_TIMELINE,
  SIZE_RATIO,
  antibioticEfficacy,
  classify,
  describeAntibiotic,
  describeInfection,
  hostStatus,
} from "@/lib/pathogens";

// ─── Bacterium vs bacteriophage ─────────────────────────────────────
// Two specimens side by side, drawn to make the antibiotic argument
// visible. On the left, a bacillus with every part an antibiotic can hit:
// a peptidoglycan wall drawn as a lattice of rings and struts, a membrane,
// cytoplasm with a hundred 70S ribosomes, a circular chromosome, a
// plasmid, a spinning flagellum. On the right, a T4 phage with none of
// them: an icosahedral capsid round a knot of DNA, a contractile sheath, a
// baseplate and six tail fibres.
//
// Two triggered timelines share the bacterium. PENICILLIN rains over both
// specimens; on the bacterium the lattice loses its struts one by one
// (integrity from the model), the cell swells and bursts, ribosomes
// flying; on the phage the molecules fall straight past. The LYTIC CYCLE
// sends a second phage across: it docks, its sheath contracts and drives
// the core through the wall, the DNA knot in its head drains into the
// cell, the host chromosome fragments, ribosomes turn violet as the phage
// genes take them over, progeny assemble inside, and the wall breaks —
// the burst counter reads 150. Everything moving is instanced and driven
// from the timeline's snapshot in `useFrame`; nothing is allocated during
// the burst, so there is nothing extra to dispose.
// ─────────────────────────────────────────────────────────────────────

const BACT = { centre: [-2.0, 1.75, 0], radius: 1.0, length: 2.6 };
const PHAGE_REF = { position: [5.6, 0.55, 0] };
const ATTACH = [-2.3, 2.75, 0.3];
const RIBOSOMES = 110;
const PROGENY_SEATS = 60;

const COLOURS = {
  wall: "#d4b483",
  lattice: "#f5deb3",
  membrane: "#f9a8d4",
  cytoplasm: "#7dd3fc",
  nucleoid: "#818cf8",
  plasmid: "#c084fc",
  ribosome: "#fde68a",
  ribosomeHijacked: PALETTE.violet,
  flagellum: "#e2e8f0",
  pilus: "#cbd5e1",
  capsid: "#93c5fd",
  capsidEdge: "#3b82f6",
  phageDna: "#f472b6",
  sheath: "#a5b4fc",
  core: "#e0e7ff",
  baseplate: "#6366f1",
  fibre: "#c7d2fe",
  penicillin: PALETTE.rose,
  progeny: "#bfdbfe",
  burst: "#fecaca",
  meterOn: PALETTE.rose,
  meterOff: "#475569",
};

// ─── The bacterium ──────────────────────────────────────────────────

/** Peptidoglycan: rings round the rod and struts along it, each with its own failure point. */
function PeptidoglycanLattice({ integrityRef }) {
  const ringsRef = useRef(null);
  const struts = useMemo(() => {
    const out = [];
    const n = 10;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      const r = BACT.radius * 1.03;
      const pts = [];
      for (let k = 0; k <= 24; k += 1) {
        const x = -BACT.length / 2 - BACT.radius + (k / 24) * (BACT.length + 2 * BACT.radius);
        // Follow the capsule profile: full radius over the cylinder, shrinking over the caps.
        const over = Math.max(0, Math.abs(x) - BACT.length / 2);
        const rr = Math.sqrt(Math.max(0, r * r - over * over));
        pts.push([x, Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      out.push({ points: pts, threshold: 0.15 + 0.8 * hashRandom(i * 3.7 + 1) });
    }
    return out;
  }, []);
  const rings = useMemo(
    () => Array.from({ length: 11 }, (_, i) => ({ x: -BACT.length / 2 + (i / 10) * BACT.length, threshold: 0.1 + 0.85 * hashRandom(i * 5.1 + 2) })),
    [],
  );
  const strutRefs = useRef([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const integrity = integrityRef.current;
    const mesh = ringsRef.current;
    if (mesh) {
      rings.forEach((ring, i) => {
        const on = integrity > ring.threshold;
        dummy.position.set(ring.x, 0, 0);
        dummy.rotation.set(0, Math.PI / 2, 0);
        dummy.scale.setScalar(on ? 1 : 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    struts.forEach((strut, i) => {
      const line = strutRefs.current[i];
      if (line) line.visible = integrity > strut.threshold;
    });
  });

  return (
    <group>
      <instancedMesh ref={ringsRef} args={[undefined, undefined, rings.length]} frustumCulled={false}>
        <torusGeometry args={[BACT.radius * 1.03, 0.014, 6, 48]} />
        <meshStandardMaterial color={COLOURS.lattice} emissive={COLOURS.lattice} emissiveIntensity={0.25} roughness={0.6} />
      </instancedMesh>
      {struts.map((strut, i) => (
        <Line
          key={i}
          ref={(l) => {
            strutRefs.current[i] = l;
          }}
          points={strut.points}
          color={COLOURS.lattice}
          lineWidth={1.4}
          transparent
          opacity={0.85}
        />
      ))}
    </group>
  );
}

/** Ribosomes, hijacked to violet by the phage and flung outward at lysis. */
function Ribosomes({ hijackRef, burstRef, seed = 17 }) {
  const meshRef = useRef(null);
  const seats = useMemo(
    () =>
      Array.from({ length: RIBOSOMES }, (_, i) => {
        const x = (hashRandom(seed + i * 1.7) - 0.5) * (BACT.length + 1.2);
        const ang = hashRandom(seed * 3 + i * 2.3) * Math.PI * 2;
        const rad = Math.sqrt(hashRandom(seed * 5 + i * 0.9)) * BACT.radius * 0.8;
        const over = Math.max(0, Math.abs(x) - BACT.length / 2);
        const cap = Math.sqrt(Math.max(0.05, BACT.radius * BACT.radius * 0.64 - over * over));
        const rr = Math.min(rad, cap);
        const dir = new THREE.Vector3(x * 0.4 + (hashRandom(seed * 7 + i) - 0.5), Math.cos(ang) * rr + (hashRandom(seed * 9 + i) - 0.5) * 0.4, Math.sin(ang) * rr).normalize();
        return { x, y: Math.cos(ang) * rr, z: Math.sin(ang) * rr, dir, spin: hashRandom(seed * 11 + i) * Math.PI * 2 };
      }),
    [seed],
  );
  const state = useRef({ dummy: new THREE.Object3D(), colour: new THREE.Color(), hijacked: new THREE.Color(COLOURS.ribosomeHijacked), lastHijack: -1 });

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const s = state.current;
    const burst = smoothstep(burstRef.current);
    const hijack = clamp(hijackRef.current, 0, 1);
    const t = clock.elapsedTime;
    const d = s.dummy;
    for (let i = 0; i < seats.length; i += 1) {
      const seat = seats[i];
      const fly = burst * 4.5;
      const jitter = burst > 0 ? 0 : 0.02 * Math.sin(t * 3 + seat.spin);
      d.position.set(seat.x + seat.dir.x * fly, seat.y + seat.dir.y * fly + jitter, seat.z + seat.dir.z * fly);
      d.scale.setScalar(0.055 * (1 - 0.85 * burst));
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (hijack !== s.lastHijack) {
      s.lastHijack = hijack;
      s.colour.set(COLOURS.ribosome).lerp(s.hijacked, hijack);
      mesh.material.color.copy(s.colour);
      mesh.material.emissive.copy(s.colour);
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, RIBOSOMES]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial color={COLOURS.ribosome} emissive={COLOURS.ribosome} emissiveIntensity={0.35} roughness={0.6} />
    </instancedMesh>
  );
}

/** The circular chromosome: a loop that breaks into fragments as the phage degrades it. */
function Nucleoid({ intactRef, burstRef, seed = 23 }) {
  const loop = useRef(null);
  const fragments = useRef(null);
  const seats = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2;
        return { x: Math.cos(a) * 1.0, y: Math.sin(a) * 0.42, z: 0.08, rot: a + Math.PI / 2, dir: new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.6, (hashRandom(seed + i) - 0.5) * 0.8).normalize() };
      }),
    [seed],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const intact = clamp(intactRef.current, 0, 1);
    const burst = smoothstep(burstRef.current);
    if (loop.current) {
      loop.current.visible = intact > 0.02;
      loop.current.material.opacity = intact;
      loop.current.scale.setScalar(1 + 0.3 * burst);
    }
    const mesh = fragments.current;
    if (mesh) {
      const shown = Math.round((1 - intact) * seats.length);
      seats.forEach((seat, i) => {
        const on = i < shown;
        const fly = burst * 3.5;
        dummy.position.set(seat.x * (1 + 0.25 * (1 - intact)) + seat.dir.x * fly, seat.y * (1 + 0.4 * (1 - intact)) + seat.dir.y * fly, seat.z + seat.dir.z * fly);
        dummy.rotation.set(0, 0, seat.rot + (1 - intact) * 1.2);
        dummy.scale.setScalar(on ? 1 - 0.8 * burst : 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <group>
      <mesh ref={loop} scale={[1, 1, 1]}>
        <torusGeometry args={[1, 0.045, 8, 72]} />
        <meshStandardMaterial color={COLOURS.nucleoid} emissive={COLOURS.nucleoid} emissiveIntensity={0.6} transparent opacity={1} />
      </mesh>
      <instancedMesh ref={fragments} args={[undefined, undefined, seats.length]} frustumCulled={false}>
        <capsuleGeometry args={[0.04, 0.22, 3, 6]} />
        <meshStandardMaterial color={COLOURS.nucleoid} emissive={COLOURS.nucleoid} emissiveIntensity={0.5} />
      </instancedMesh>
    </group>
  );
}

function Flagellum() {
  const group = useRef(null);
  const geometry = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 60; i += 1) {
      const s = i / 60;
      pts.push(new THREE.Vector3(BACT.length / 2 + BACT.radius + 0.05 + 2.6 * s, 0.24 * Math.sin(Math.PI * 2 * 3 * s) * Math.min(1, s * 4), 0.24 * Math.cos(Math.PI * 2 * 3 * s) * Math.min(1, s * 4)));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.03, 6, false);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, rawDelta) => {
    if (group.current) group.current.rotation.x += Math.min(rawDelta, 0.05) * 7;
  });
  return (
    <group ref={group}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={COLOURS.flagellum} roughness={0.5} emissive={COLOURS.flagellum} emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

/**
 * The whole cell. `refs` carry per-frame values from the timelines:
 * wall integrity, swelling, burst progress, host-DNA intactness and the
 * ribosome hijack fraction.
 */
function BacteriumModel({ refs, status }) {
  const shell = useRef(null);
  const wallMat = useRef(null);
  const membraneMat = useRef(null);
  const cytoMat = useRef(null);
  const plasmid = useRef(null);
  useFrame(() => {
    const burst = smoothstep(refs.burst.current);
    const swell = refs.swelling.current;
    if (shell.current) shell.current.scale.setScalar(1 + swell + 0.18 * burst);
    if (plasmid.current) {
      plasmid.current.position.set(1.05 + 2.2 * burst, -0.42 - 1.6 * burst, 0.35 + 0.8 * burst);
      plasmid.current.scale.setScalar(Math.max(0.001, 1 - burst));
    }
    if (wallMat.current) wallMat.current.opacity = (0.06 + 0.24 * refs.integrity.current) * (1 - 0.85 * burst);
    if (membraneMat.current) membraneMat.current.opacity = 0.3 * (1 - 0.9 * burst);
    if (cytoMat.current) cytoMat.current.opacity = 0.3 * (1 - 0.9 * burst);
  });
  const alive = status.alive;
  return (
    <group position={BACT.centre}>
      <group ref={shell}>
        <group rotation={[0, 0, Math.PI / 2]}>
          <mesh>
            <capsuleGeometry args={[BACT.radius, BACT.length, 8, 28]} />
            <meshStandardMaterial ref={wallMat} color={COLOURS.wall} roughness={0.5} transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh scale={0.96}>
            <capsuleGeometry args={[BACT.radius, BACT.length, 8, 28]} />
            <meshStandardMaterial ref={membraneMat} color={COLOURS.membrane} roughness={0.4} transparent opacity={0.3} depthWrite={false} side={THREE.BackSide} />
          </mesh>
          <mesh scale={0.9}>
            <capsuleGeometry args={[BACT.radius, BACT.length, 8, 28]} />
            <meshStandardMaterial ref={cytoMat} color={COLOURS.cytoplasm} roughness={0.3} transparent opacity={0.3} depthWrite={false} />
          </mesh>
        </group>
        <PeptidoglycanLattice integrityRef={refs.integrity} />
      </group>
      <Ribosomes hijackRef={refs.hijack} burstRef={refs.burst} />
      <group position={[-0.1, 0.05, 0]}>
        <Nucleoid intactRef={refs.dnaIntact} burstRef={refs.burst} />
      </group>
      <mesh ref={plasmid} position={[1.05, -0.42, 0.35]} rotation={[0.4, 0, 0]}>
        <torusGeometry args={[0.2, 0.035, 8, 32]} />
        <meshStandardMaterial color={COLOURS.plasmid} emissive={COLOURS.plasmid} emissiveIntensity={0.6} />
      </mesh>
      <Flagellum />
      {[[-0.6, 1.02, 0.35, 0.4], [0.7, 1.0, -0.3, -0.3], [-1.9, 0.55, 0.5, 0.9], [-1.6, -0.95, 0.4, 2.6]].map(([x, y, z, rz], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, 0, rz]}>
          <cylinderGeometry args={[0.012, 0.012, 0.6, 5]} />
          <meshStandardMaterial color={COLOURS.pilus} roughness={0.6} />
        </mesh>
      ))}

      {/* Labels */}
      <SceneLabel position={[0, 1.55, 0.6]} tone="text-amber-200">
        peptidoglycan cell wall
      </SceneLabel>
      <SceneLabel position={[-1.15, 1.2, 0.6]} tone="text-pink-300">
        cell membrane
      </SceneLabel>
      <SceneLabel position={[-0.1, 0.62, 0.9]} tone="text-indigo-300">
        circular chromosome · no nucleus
      </SceneLabel>
      <SceneLabel position={[1.7, -0.75, 0.6]} tone="text-violet-300">
        plasmid
      </SceneLabel>
      <SceneLabel position={[0.95, -0.2, 0.9]} tone="text-amber-100">
        70S ribosomes
      </SceneLabel>
      <SceneLabel position={[3.7, 0.5, 0.4]} tone="text-ink-300">
        flagellum · rotating motor
      </SceneLabel>
      <SceneLabel position={[-1.0, -0.6, 0.9]} tone="text-sky-300">
        cytoplasm · metabolism
      </SceneLabel>
      <SceneLabel position={[0, -1.55, 0.5]} tone={alive ? "text-emerald-300" : "text-rose-300"} accent={!alive}>
        {`bacterium · 2 µm · ${status.label}`}
      </SceneLabel>
    </group>
  );
}

// ─── The phage ──────────────────────────────────────────────────────

const SHEATH_LENGTH = 1.05;

/**
 * A T4 phage with its origin at the baseplate, tail pointing −y.
 * `contractionRef` (0–1) shortens the sheath and drops the head, leaving
 * the core exposed below the baseplate; `dnaRef` (1 → 0) drains the knot.
 */
function PhageModel({ position, rotation = [0, 0, 0], contractionRef, dnaRef, labels = false, scale = 1, groupRef }) {
  const sheath = useRef(null);
  const upper = useRef(null);
  const core = useRef(null);
  const dna = useRef(null);
  const fibres = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        return [
          [Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3],
          [Math.cos(a) * 0.7, -0.12, Math.sin(a) * 0.7],
          [Math.cos(a) * 0.9, -0.48, Math.sin(a) * 0.9],
        ];
      }),
    [],
  );
  useFrame(() => {
    const c = contractionRef ? clamp(contractionRef.current, 0, 1) : 0;
    const s = 1 - 0.45 * c;
    if (sheath.current) {
      sheath.current.scale.y = s;
      sheath.current.position.y = 0.08 + (SHEATH_LENGTH * s) / 2;
    }
    if (upper.current) upper.current.position.y = 0.08 + SHEATH_LENGTH * s;
    if (core.current) core.current.position.y = 0.08 + SHEATH_LENGTH * s - SHEATH_LENGTH / 2;
    if (dna.current) {
      const f = dnaRef ? clamp(dnaRef.current, 0, 1) : 1;
      dna.current.scale.setScalar(Math.max(0.001, f));
      dna.current.visible = f > 0.01;
    }
  });
  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* Baseplate: a hexagonal prism that docks on the wall. */}
      <mesh>
        <cylinderGeometry args={[0.34, 0.34, 0.1, 6]} />
        <meshStandardMaterial color={COLOURS.baseplate} roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Core: the hollow needle the DNA goes down. Fixed length, so it pokes out below when the sheath contracts. */}
      <mesh ref={core} position={[0, 0.08 + SHEATH_LENGTH / 2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, SHEATH_LENGTH, 8]} />
        <meshStandardMaterial color={COLOURS.core} roughness={0.4} emissive={COLOURS.core} emissiveIntensity={0.2} />
      </mesh>
      {/* Contractile sheath: a ribbed cylinder scaled from its base. */}
      <group ref={sheath} position={[0, 0.08 + SHEATH_LENGTH / 2, 0]}>
        <mesh>
          <cylinderGeometry args={[0.15, 0.16, SHEATH_LENGTH, 12, 1, true]} />
          <meshStandardMaterial color={COLOURS.sheath} roughness={0.5} side={THREE.DoubleSide} transparent opacity={0.85} />
        </mesh>
        {[-0.4, -0.24, -0.08, 0.08, 0.24, 0.4].map((y) => (
          <mesh key={y} position={[0, y * SHEATH_LENGTH, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.165, 0.025, 6, 20]} />
            <meshStandardMaterial color={COLOURS.baseplate} roughness={0.5} />
          </mesh>
        ))}
      </group>
      {/* Collar and head ride on top of the sheath. */}
      <group ref={upper} position={[0, 0.08 + SHEATH_LENGTH, 0]}>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.2, 0.15, 0.1, 8]} />
          <meshStandardMaterial color={COLOURS.baseplate} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <icosahedronGeometry args={[0.52, 0]} />
          <meshStandardMaterial color={COLOURS.capsid} roughness={0.35} flatShading transparent opacity={0.72} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <icosahedronGeometry args={[0.53, 0]} />
          <meshBasicMaterial color={COLOURS.capsidEdge} wireframe transparent opacity={0.5} />
        </mesh>
        <mesh ref={dna} position={[0, 0.62, 0]}>
          <torusKnotGeometry args={[0.2, 0.05, 56, 8, 2, 3]} />
          <meshStandardMaterial color={COLOURS.phageDna} emissive={COLOURS.phageDna} emissiveIntensity={0.8} roughness={0.4} />
        </mesh>
      </group>
      {fibres.map((pts, i) => (
        <Line key={i} points={pts} color={COLOURS.fibre} lineWidth={2} />
      ))}
      {labels && (
        <>
          <SceneLabel position={[1.15, 1.85, 0.2]} tone="text-sky-300">
            icosahedral capsid head · protein
          </SceneLabel>
          <SceneLabel position={[-1.1, 1.65, 0.2]} tone="text-pink-300">
            DNA core
          </SceneLabel>
          <SceneLabel position={[1.1, 0.7, 0.2]} tone="text-indigo-300">
            contractile sheath
          </SceneLabel>
          <SceneLabel position={[-1.0, 0.1, 0.2]} tone="text-indigo-200">
            baseplate
          </SceneLabel>
          <SceneLabel position={[1.2, -0.45, 0.2]} tone="text-ink-300">
            tail fibres · bind one host's receptors
          </SceneLabel>
        </>
      )}
    </group>
  );
}

/** The infecting phage: flies in, docks tail-first, and fires. */
function InfectingPhage({ liveRef }) {
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
      const len = 1.5 * d.genomeInjected;
      strand.current.visible = d.injection > 0 && d.takeover < 1;
      strand.current.scale.y = Math.max(0.001, len);
      strand.current.position.set(ATTACH[0], ATTACH[1] - 0.35 - len / 2, ATTACH[2]);
      strand.current.material.opacity = 1 - 0.9 * smoothstep(d.takeover);
    }
  });
  return (
    <group>
      <PhageModel groupRef={groupRef} position={[5.2, 6.0, 1.4]} contractionRef={contractionRef} dnaRef={dnaRef} scale={0.85} />
      {/* The genome, going down the core into the cytoplasm. */}
      <mesh ref={strand} visible={false}>
        <cylinderGeometry args={[0.03, 0.03, 1, 6]} />
        <meshStandardMaterial color={COLOURS.phageDna} emissive={COLOURS.phageDna} emissiveIntensity={1} transparent opacity={1} />
      </mesh>
    </group>
  );
}

/** Progeny assembling in the cytoplasm, then bursting out. */
function Progeny({ liveRef, seed = 31 }) {
  const heads = useRef(null);
  const tails = useRef(null);
  const seats = useMemo(
    () =>
      Array.from({ length: PROGENY_SEATS }, (_, i) => {
        const x = BACT.centre[0] + (hashRandom(seed + i * 1.9) - 0.5) * (BACT.length + 0.9);
        const ang = hashRandom(seed * 3 + i * 2.7) * Math.PI * 2;
        const rr = Math.sqrt(hashRandom(seed * 5 + i * 0.7)) * BACT.radius * 0.7;
        const y = BACT.centre[1] + Math.cos(ang) * rr;
        const z = BACT.centre[2] + Math.sin(ang) * rr;
        const dir = new THREE.Vector3(x - BACT.centre[0], (y - BACT.centre[1]) * 1.6, z - BACT.centre[2] + 0.3).normalize();
        return { x, y, z, dir, tilt: (hashRandom(seed * 7 + i) - 0.5) * 1.2, spin: hashRandom(seed * 9 + i) * Math.PI * 2 };
      }),
    [seed],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const snap = liveRef.current;
    const d = describeInfection(snap ? snap.t : 0);
    const shown = Math.round((d.virionsAssembled / BURST_SIZE) * PROGENY_SEATS);
    const burst = smoothstep(d.lysis);
    const t = clock.elapsedTime;
    const hm = heads.current;
    const tm = tails.current;
    if (!hm || !tm) return;
    for (let i = 0; i < PROGENY_SEATS; i += 1) {
      const seat = seats[i];
      const on = i < shown;
      const fly = burst * 5.5;
      const fade = burst > 0.7 ? 1 - (burst - 0.7) / 0.3 : 1;
      const sc = on ? 0.16 * fade : 0;
      dummy.position.set(seat.x + seat.dir.x * fly, seat.y + seat.dir.y * fly + (burst > 0 ? 0 : 0.02 * Math.sin(t * 2 + seat.spin)), seat.z + seat.dir.z * fly);
      dummy.rotation.set(seat.tilt + burst * 2.5, seat.spin + burst * 4, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      hm.setMatrixAt(i, dummy.matrix);
      tm.setMatrixAt(i, dummy.matrix);
    }
    hm.instanceMatrix.needsUpdate = true;
    tm.instanceMatrix.needsUpdate = true;
  });
  const tailGeometry = useMemo(() => new THREE.CylinderGeometry(0.16, 0.16, 1.3, 6).translate(0, -1.2, 0), []);
  useEffect(() => () => tailGeometry.dispose(), [tailGeometry]);
  return (
    <group>
      <instancedMesh ref={heads} args={[undefined, undefined, PROGENY_SEATS]} frustumCulled={false}>
        <icosahedronGeometry args={[0.9, 0]} />
        <meshStandardMaterial color={COLOURS.progeny} emissive={COLOURS.progeny} emissiveIntensity={0.35} flatShading roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={tails} args={[tailGeometry, undefined, PROGENY_SEATS]} frustumCulled={false}>
        <meshStandardMaterial color={COLOURS.sheath} roughness={0.5} />
      </instancedMesh>
    </group>
  );
}

/** Penicillin molecules raining over both specimens. */
function PenicillinRain({ rateRef, count = 140, seed = 41 }) {
  const meshRef = useRef(null);
  const state = useMemo(
    () => ({
      age: new Float32Array(count).fill(-1),
      x: new Float32Array(count),
      z: new Float32Array(count),
      spin: Float32Array.from({ length: count }, (_, i) => hashRandom(seed + i * 1.3) * Math.PI * 2),
      pending: 0,
      spawned: 0,
      dummy: new THREE.Object3D(),
    }),
    [count, seed],
  );
  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(rawDelta, 0.05);
    state.pending += rateRef.current * dt;
    const d = state.dummy;
    for (let i = 0; i < count; i += 1) {
      let age = state.age[i];
      if (age < 0 && state.pending >= 1) {
        state.pending -= 1;
        state.spawned += 1;
        age = 0;
        state.x[i] = -7 + hashRandom(seed * 3 + i * 2.1 + state.spawned * 0.37) * 13;
        state.z[i] = -1.5 + hashRandom(seed * 5 + i * 3.3 + state.spawned * 0.11) * 3;
      }
      if (age >= 0) {
        age += dt;
        if (age > 3.2) age = -1;
      }
      state.age[i] = age;
      if (age < 0) {
        d.scale.setScalar(0);
        d.position.set(0, -100, 0);
      } else {
        const y = 6.4 - age * 2.1;
        d.position.set(state.x[i] + 0.15 * Math.sin(age * 3 + state.spin[i]), y, state.z[i]);
        d.rotation.set(age * 2, state.spin[i], 0);
        d.scale.setScalar(1);
      }
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (state.pending > 4) state.pending = 4;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <cylinderGeometry args={[0.08, 0.08, 0.025, 6]} />
      <meshStandardMaterial color={COLOURS.penicillin} emissive={COLOURS.penicillin} emissiveIntensity={0.9} toneMapped={false} />
    </instancedMesh>
  );
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
    rainRef.current = a.started && !a.complete ? 10 + 55 * pulse(a.t / ANTIBIOTIC_TIMELINE.total, 0.45) : 0;
  });
  return null;
}

// ─── The scene ──────────────────────────────────────────────────────

export default function BacteriaVsVirusCanvas({ params = {}, setParam }) {
  const { antibiotic = 0, lytic = 0, speed = 1 } = params || {};

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

  // Per-frame refs the bacterium's parts read.
  const refs = useMemo(
    () => ({ integrity: { current: 1 }, swelling: { current: 0 }, burst: { current: 0 }, dnaIntact: { current: 1 }, hijack: { current: 0 } }),
    [],
  );
  const rainRef = useRef(0);

  // Tell the HUD where both clocks are.
  const pushed = useRef({});
  useEffect(() => {
    if (typeof setParam !== "function") return;
    const next = { liveLyticT: Math.round(infection.t * 10) / 10, liveAntibioticT: Math.round(drug.t * 10) / 10 };
    for (const key of Object.keys(next)) if (pushed.current[key] !== next[key]) setParam(key, next[key]);
    pushed.current = next;
  }, [infection.t, drug.t, setParam]);

  const bactLiving = classify("bacterium");
  const virusLiving = classify("virus");
  const eff = { bacterium: antibioticEfficacy("bacterium"), virus: antibioticEfficacy("virus") };

  return (
    <SceneCanvas
      camera={{ position: [1.9, 2.9, 13.6], fov: 42 }}
      controls={{ minDistance: 4, maxDistance: 30, target: [1.7, 1.5, 0], maxPolarAngle: Math.PI * 0.55 }}
      lights={{ ambient: 0.55, keyLight: 1.3, rim: PALETTE.violet }}
    >
      <TimelineDriver timeline={LYTIC_TIMELINE} trigger={lyticTrigger} speed={speed} live={lyticLive} onTick={setLyticSnap} />
      <TimelineDriver timeline={ANTIBIOTIC_TIMELINE} trigger={antibioticTrigger} speed={speed} live={antibioticLive} onTick={setAntibioticSnap} />
      <BlendDriver refs={refs} rainRef={rainRef} lyticLive={lyticLive} antibioticLive={antibioticLive} />

      <BacteriumModel refs={refs} status={status} />
      <Progeny liveRef={lyticLive} />
      <InfectingPhage liveRef={lyticLive} />
      <PhageModel position={PHAGE_REF.position} labels scale={1.15} />
      <PenicillinRain rateRef={rainRef} />

      {/* Burst flash while the wall is going. */}
      {bursting > 0 && bursting < 1 && <Halo position={BACT.centre} radius={2.4} color={COLOURS.burst} opacity={0.14 * pulse(bursting, 0.4)} />}

      {/* Headline labels */}
      <SceneLabel position={[BACT.centre[0], 4.75, 0]} accent>
        {`BACTERIUM · ${bactLiving.verdict} · ${bactLiving.met}/${bactLiving.total} criteria`}
      </SceneLabel>
      <SceneLabel position={[PHAGE_REF.position[0], 4.75, 0]} accent>
        {`VIRUS · ${virusLiving.verdict} · ${virusLiving.met}/${virusLiving.total} criteria`}
      </SceneLabel>
      <SceneLabel position={[PHAGE_REF.position[0], -0.95, 0]} tone="text-ink-400">
        {`T4 bacteriophage · 200 nm · ~${SIZE_RATIO}× smaller than the bacterium (not to scale)`}
      </SceneLabel>

      <EfficacyMeter position={[BACT.centre[0], -1.35, 0]} percent={drug.started ? eff.bacterium.percent * smoothstep(Math.min(1, drug.t / 1.5)) : 0} label={drug.started ? `penicillin efficacy ${eff.bacterium.percent} % · wall ${Math.round(drug.wallIntegrity * 100)} % intact` : "penicillin efficacy — press Administer"} />
      <EfficacyMeter position={[PHAGE_REF.position[0], -1.35, 0]} percent={0} label={drug.started ? `penicillin efficacy ${eff.virus.percent} % · no wall, no ribosomes, no metabolism` : "penicillin efficacy — nothing to hit"} />

      {/* Event captions */}
      {infection.started && (
        <SceneLabel position={[BACT.centre[0] + 1.7, 4.05, 0.4]} tone={infection.lysed ? "text-rose-300" : "text-sky-300"} accent={infection.lysed}>
          {infection.lysed
            ? `burst size · ${infection.released} new phages released`
            : infection.stage === "assembly"
              ? `virions assembled · ${infection.virionsAssembled} / ${BURST_SIZE}`
              : infection.stage === "takeover"
                ? `host DNA ${Math.round(infection.hostDnaIntact * 100)} % intact · ribosomes making phage proteins`
                : infection.stage === "injection"
                  ? `sheath contracts · genome ${Math.round(infection.genomeInjected * 100)} % injected`
                  : "tail fibres find their receptor · baseplate docks"}
        </SceneLabel>
      )}
      {drug.started && (
        <SceneLabel position={[PHAGE_REF.position[0], 4.1, 0.4]} tone="text-ink-300">
          penicillin falls straight past · no effect
        </SceneLabel>
      )}
      {drug.started && !drug.lysed && (
        <SceneLabel position={[BACT.centre[0], 4.05, 0.4]} tone="text-rose-300">
          {drug.stage === "administer" ? "penicillin binds the wall-building enzymes" : drug.stage === "breach" ? `cross-links fail · wall ${Math.round(drug.wallIntegrity * 100)} % intact · swelling` : "osmotic lysis · water rushes in"}
        </SceneLabel>
      )}
      {drug.lysed && (
        <SceneLabel position={[BACT.centre[0], 4.05, 0.4]} tone="text-rose-300" accent>
          lysed by penicillin · the virus next door is untouched
        </SceneLabel>
      )}

      <TimelineCaption
        position={[0, -2.3, 0.5]}
        timeline={latest === "antibiotic" ? ANTIBIOTIC_TIMELINE : LYTIC_TIMELINE}
        snapshot={latest === "antibiotic" ? antibioticSnap : lyticSnap}
        idle="press Administer penicillin, or Trigger viral lytic cycle"
        tone={latest === "antibiotic" ? "text-rose-300" : "text-sky-300"}
      />

    </SceneCanvas>
  );
}

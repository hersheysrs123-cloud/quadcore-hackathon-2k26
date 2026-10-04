"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ShellRing } from "@/components/visualizations/electron-shells";
import {
  ORBITAL_COLOURS,
  P_AXES,
  PHASE_COLOURS,
  describeOrbitals,
  displayRadius,
  sampleOrbital,
} from "@/lib/orbitals";

// ─── Quantum orbitals ───────────────────────────────────────────────
// The Bohr topic's second model. Each occupied orbital is a cloud of points
// drawn from |ψ|² (`lib/orbitals.js` samples real hydrogen-like
// wavefunctions at the Slater effective charge): dense where the electron
// is likely to be found, thin where it is not, with real gaps at the radial
// nodes. A half-filled p subshell draws only the orbitals Hund's rule puts
// electrons in, and an orbital with one electron is drawn half as dense as
// one with two.
//
// Focusing a subshell brightens it, dims the rest, rings its radial nodes,
// and sends one bright "electron" hopping from sample to sample: each place
// it lands is somewhere a measurement could find it — the cloud is where
// those places pile up.
//
// Radii are compressed for the screen (`displayRadius`): to scale, sodium's
// 1s would be a speck inside its 3s. The compression is monotonic, so the
// order of the shells and the nodes inside them survive it.
// ─────────────────────────────────────────────────────────────────────

const POINTS_PER_ELECTRON = 1500;
const HOP_EVERY_S = 0.14;
const TRAIL = 14;

/** A soft round sprite, so the points read as glow rather than squares. */
function useDotTexture() {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }, []);
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

/** Map true positions (Bohr radii) to the compressed screen radius, in place. */
function compress(positions) {
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    const r = Math.hypot(x, y, z);
    if (r < 1e-9) continue;
    const k = displayRadius(r) / r;
    positions[i] = x * k;
    positions[i + 1] = y * k;
    positions[i + 2] = z * k;
  }
  return positions;
}

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
/** A large stride with no common factor with n, so i·stride mod n visits every index once. */
function coprimeStride(n) {
  let s = Math.floor(n * 0.618) | 1;
  while (gcd(s, n) !== 1) s += 2;
  return s;
}

/** One subshell's clouds, merged into a single Points object. */
function buildSubshellCloud(Z, sub) {
  const parts = [];
  sub.occupancy.forEach((electrons, k) => {
    if (electrons === 0) return;
    const axis = sub.l === 0 ? "z" : P_AXES[k];
    const { positions, signs } = sampleOrbital({
      n: sub.n,
      l: sub.l,
      axis,
      Z: sub.Zeff,
      // Bigger orbitals spread their points thinner, so they get more of them.
      count: Math.round(POINTS_PER_ELECTRON * electrons * (1 + 0.7 * (sub.n - 1))),
      seed: Z * 97 + sub.n * 13 + sub.l * 5 + k,
    });
    parts.push({ positions: compress(positions), signs, axis });
  });
  const total = parts.reduce((s, p) => s + p.signs.length, 0);
  const merged = new Float32Array(total * 3);
  const mergedSigns = new Int8Array(total);
  let at = 0;
  for (const p of parts) {
    merged.set(p.positions, at * 3);
    mergedSigns.set(p.signs, at);
    at += p.signs.length;
  }
  // Interleave the orbitals (a fixed stride coprime to the count), so any
  // leading slice is a fair sample of all of them — the "all" view draws
  // only a slice of the dense inner clouds.
  const stride = coprimeStride(total);
  const positions = new Float32Array(total * 3);
  const signs = new Int8Array(total);
  for (let i = 0; i < total; i += 1) {
    const j = (i * stride) % total;
    positions[i * 3] = merged[j * 3];
    positions[i * 3 + 1] = merged[j * 3 + 1];
    positions[i * 3 + 2] = merged[j * 3 + 2];
    signs[i] = mergedSigns[j];
  }
  return { positions, signs, axes: parts.map((p) => p.axis), r90: displayRadius(sub.r90A0) };
}

function SubshellCloud({ cloud, colour, showPhase, opacity, size, fraction = 1, texture }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(cloud.positions, 3));
    const colours = new Float32Array(cloud.signs.length * 3);
    const plus = new THREE.Color(PHASE_COLOURS.plus);
    const minus = new THREE.Color(PHASE_COLOURS.minus);
    const base = new THREE.Color(colour);
    cloud.signs.forEach((s, i) => {
      const c = showPhase ? (s > 0 ? plus : minus) : base;
      colours[i * 3] = c.r;
      colours[i * 3 + 1] = c.g;
      colours[i * 3 + 2] = c.b;
    });
    g.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    return g;
  }, [cloud, colour, showPhase]);
  useEffect(() => {
    geometry.setDrawRange(0, Math.max(1, Math.floor(cloud.signs.length * fraction)));
  }, [geometry, cloud, fraction]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={size}
        map={texture}
        vertexColors
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

/** The bright electron that hops between samples of the focused cloud, with a fading trail. */
function HoppingElectron({ cloud, colour, speed }) {
  const refs = useRef([]);
  const trail = useRef([]);
  const clock = useRef(0);
  const pick = useRef(0);
  useFrame((_, delta) => {
    // A floor on the step, so a starved frame clock still hops.
    clock.current += Math.max(delta, 1 / 60) * Math.max(speed, 0);
    if (clock.current >= HOP_EVERY_S) {
      clock.current = 0;
      const n = cloud.signs.length;
      // A fixed stride through the samples: deterministic, and every point visited.
      pick.current = (pick.current + 7919) % n;
      const i = pick.current * 3;
      trail.current.unshift([cloud.positions[i], cloud.positions[i + 1], cloud.positions[i + 2]]);
      if (trail.current.length > TRAIL) trail.current.pop();
    }
    refs.current.forEach((m, k) => {
      if (!m) return;
      const p = trail.current[k];
      m.visible = Boolean(p);
      if (p) m.position.set(p[0], p[1], p[2]);
    });
  });
  return Array.from({ length: TRAIL }, (_, k) => (
    <mesh
      key={k}
      ref={(el) => {
        refs.current[k] = el;
      }}
      visible={false}
    >
      <sphereGeometry args={[k === 0 ? 0.09 : 0.05, 14, 14]} />
      <meshBasicMaterial color={k === 0 ? "#ffffff" : colour} transparent opacity={k === 0 ? 1 : 0.7 * (1 - k / TRAIL)} toneMapped={false} />
    </mesh>
  ));
}

export function OrbitalCloud({ symbol, focus = "all", showPhase = false, speed = 1, Label }) {
  const info = useMemo(() => describeOrbitals(symbol, focus), [symbol, focus]);
  const texture = useDotTexture();
  // Sampling only depends on the element, so changing focus or phase colouring is free.
  const clouds = useMemo(() => {
    const d = describeOrbitals(symbol);
    return Object.fromEntries(d.subshells.map((s) => [s.key, buildSubshellCloud(d.Z, s)]));
  }, [symbol]);

  const focused = info.focused;
  const hopKey = focused?.key ?? info.outermost.key;
  const outerR = displayRadius(info.outermost.r90A0);
  // Points are sized in world units, so a small atom (camera close) needs smaller ones.
  const pointSize = 0.022 * outerR + 0.012;

  return (
    <group>
      {/* The nucleus, drawn hugely over-size: to scale it would be 1/100 000 of the atom. */}
      <mesh>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color="#fb7185" toneMapped={false} />
      </mesh>

      {info.subshells.map((s) => (
        <SubshellCloud
          key={s.key}
          cloud={clouds[s.key]}
          colour={ORBITAL_COLOURS[s.key]}
          showPhase={showPhase}
          // Additive points: in "all" a lower opacity keeps the dense core from washing to white.
          opacity={!focused ? 0.42 : focused.key === s.key ? 0.95 : 0.06}
          size={focused?.key === s.key ? pointSize * 1.35 : pointSize}
          // On screen a cloud's density goes as points over its area; thin the
          // small inner ones to match the outermost, so the core is not a white blot.
          fraction={focused ? 1 : Math.min(1, Math.max(0.12, (clouds[s.key].r90 / outerR) ** 2))}
          texture={texture}
        />
      ))}

      <HoppingElectron cloud={clouds[hopKey]} colour={ORBITAL_COLOURS[hopKey]} speed={speed} />

      {focused &&
        focused.nodeRadiiA0.map((r, k) => (
          <group key={`node-${k}`}>
            <ShellRing billboard dashed radius={displayRadius(r)} colour="#e2e8f0" lineWidth={1.4} opacity={0.75} />
            <Label position={[displayRadius(r) * 0.72, displayRadius(r) * 0.72, 0]} tone="text-ink-300">
              node
            </Label>
          </group>
        ))}

      {focused &&
        focused.l === 1 &&
        clouds[focused.key].axes.map((axis) => {
          const tip = displayRadius(focused.r90A0) * 1.02;
          const pos = axis === "x" ? [tip, 0, 0] : axis === "y" ? [0, tip, 0] : [0, 0, tip];
          return (
            <Label key={axis} position={pos} tone="text-amber-200">
              {focused.key}
              <sub>{axis}</sub>
            </Label>
          );
        })}

      <Label position={[0, -(outerR * 1.08 + 0.4), 0]} accent>
        {`${info.symbol} · ${info.configuration}`}
      </Label>
      {info.focusEmpty && (
        <Label position={[0, outerR * 1.08 + 0.4, 0]} tone="text-amber-300">
          {`${info.name} has no electrons in ${focus}`}
        </Label>
      )}
    </group>
  );
}

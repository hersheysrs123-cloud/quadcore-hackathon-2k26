"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Grid, Line } from "@react-three/drei";
import * as THREE from "three";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
  clamp,
} from "@/components/visualizations/scene-kit";

// ─── Mathematics · three scenes ─────────────────────────────────────
// Gradient descent on a loss surface, solids of revolution, and the
// unit circle unrolled into a sine wave. Like every other canvas here,
// each scene is a pure function of the `params` object the HUD owns.
// ─────────────────────────────────────────────────────────────────────

// ═══ 1 · Gradient descent on a loss surface ══════════════════════════

/** Half-width of the (x, z) domain every surface is defined over. */
const DOMAIN = 3.2;
const SURFACE_SEGMENTS = 72;
/** Steep surfaces would otherwise draw walls tall enough to hide the ball. */
const HEIGHT_CLAMP = [-3, 5];
const TRAIL_MAX = 900;
/** Anything drawn on the surface has to obey the same clamp the mesh does. */
const drawHeight = (y) => clamp(y, HEIGHT_CLAMP[0], HEIGHT_CLAMP[1]);
/** Descent steps per second — 20 steps/sec provides fluid motion while remaining readable. */
const STEP_RATE = 20;

/**
 * Each surface carries its own analytic gradient rather than a numerical
 * one: the whole point of the scene is that the arrow is exactly ∇f, and a
 * finite-difference estimate visibly lags on the steep walls.
 */
const SURFACES = {
  bowl: {
    formula: "f = 0.22 (x² + z²)",
    f: (x, z) => 0.22 * (x * x + z * z),
    grad: (x, z) => [0.44 * x, 0.44 * z],
    note: "Convex: one minimum, and every starting point reaches it.",
    stationary: "a minimum — and on a convex surface, the only one, so it is also the global minimum.",
  },
  saddle: {
    formula: "f = 0.22 (x² − z²)",
    f: (x, z) => 0.22 * (x * x - z * z),
    grad: (x, z) => [0.44 * x, -0.44 * z],
    note: "The origin is a stationary point but not a minimum — descent falls off along z.",
    // A saddle is the one surface here where a flat gradient does NOT mean a
    // minimum, so it must not be described as one.
    stationary: "a saddle point, not a minimum: the gradient vanishes, but the surface still falls away along z. Nudge the start off z = 0 and it slides off.",
  },
  valley: {
    formula: "f = 0.008 [(1 − x)² + 12 (z − 0.45x²)²]",
    f: (x, z) => {
      const u = z - 0.45 * x * x;
      return 0.008 * ((1 - x) * (1 - x) + 12 * u * u);
    },
    grad: (x, z) => {
      const u = z - 0.45 * x * x;
      return [0.008 * (2 * x - 2 - 21.6 * x * u), 0.008 * 24 * u];
    },
    note: "A curved ravine — the gradient points across the valley, not along it.",
    stationary: "the minimum of the ravine, at (1, 0.45).",
  },
  wells: {
    formula: "f = 0.06 [(x² − 4)² + (z² − 4)²]",
    f: (x, z) => 0.06 * ((x * x - 4) * (x * x - 4) + (z * z - 4) * (z * z - 4)),
    grad: (x, z) => [0.24 * x * (x * x - 4), 0.24 * z * (z * z - 4)],
    note: "Four equal minima at (±2, ±2) — which one you land in depends only on where you start.",
    stationary: "one of four equally deep local minima. Nothing about the descent could have told you the others existed.",
  },
};

/** Height-ramped mesh of y = f(x, z), rebuilt only when the surface changes. */
function LossSurface({ surface }) {
  const geometry = useMemo(() => {
    const { f } = SURFACES[surface];
    const g = new THREE.PlaneGeometry(DOMAIN * 2, DOMAIN * 2, SURFACE_SEGMENTS, SURFACE_SEGMENTS);
    // The plane is born in XY; rotating the geometry (not the mesh) means the
    // vertex positions themselves are in the same XZ frame as the descent maths.
    g.rotateX(-Math.PI / 2);

    const pos = g.attributes.position;
    const colours = new Float32Array(pos.count * 3);
    const low = new THREE.Color(PALETTE.violet);
    const mid = new THREE.Color(PALETTE.sky);
    const high = new THREE.Color(PALETTE.rose);
    const scratch = new THREE.Color();

    for (let i = 0; i < pos.count; i += 1) {
      const y = clamp(f(pos.getX(i), pos.getZ(i)), HEIGHT_CLAMP[0], HEIGHT_CLAMP[1]);
      pos.setY(i, y);
      const t = clamp((y - HEIGHT_CLAMP[0]) / (HEIGHT_CLAMP[1] - HEIGHT_CLAMP[0]), 0, 1);
      scratch.copy(t < 0.5 ? low.clone().lerp(mid, t * 2) : mid.clone().lerp(high, (t - 0.5) * 2));
      colours[i * 3] = scratch.r;
      colours[i * 3 + 1] = scratch.g;
      colours[i * 3 + 2] = scratch.b;
    }

    g.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    g.computeVertexNormals();
    return g;
  }, [surface]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.62}
          metalness={0.12}
          transparent
          opacity={0.94}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Wireframe on top: without it a smooth surface gives the eye nothing
          to judge steepness by, which is the one thing the scene is about. */}
      <mesh geometry={geometry}>
        <meshBasicMaterial wireframe color="#ffffff" transparent opacity={0.055} />
      </mesh>
    </group>
  );
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const scratchVec = new THREE.Vector3();
const scratchQuat = new THREE.Quaternion();

/**
 * Owns the descent itself. Position lives in a ref and is written straight to
 * the ball's transform, so the simulation never costs a React render.
 * The direction indicator updates directly on Three.js objects at full 60 FPS,
 * completely eliminating React reconciliation stutter and lag.
 * `onSample` lifts the readout numbers at 6 Hz for the 2D HUD.
 */
function DescentRunner({ surface, rate, momentum, startX, startZ, running, resetKey, showGradient, onSample, speed = 1 }) {
  const ball = useRef(null);
  const trailLine = useRef(null);
  const trailGeo = useRef(null);
  const trail = useMemo(() => new Float32Array(TRAIL_MAX * 3), []);

  const indicatorGroup = useRef(null);
  const indicatorShaft = useRef(null);
  const indicatorHead = useRef(null);

  const walker = useRef({ x: 0, z: 0, vx: 0, vz: 0, steps: 0, count: 0, stepAcc: 0, sampleAcc: 0, dead: null, startLoss: 0 });

  const { f, grad } = SURFACES[surface];

  // Re-seed whenever the run is redefined.
  useEffect(() => {
    const startLoss = SURFACES[surface].f(startX, startZ);
    walker.current = {
      x: startX,
      z: startZ,
      vx: 0,
      vz: 0,
      steps: 0,
      count: 1,
      stepAcc: 0,
      sampleAcc: 0,
      dead: null,
      startLoss,
    };
    trail[0] = startX;
    trail[1] = drawHeight(startLoss) + 0.08;
    trail[2] = startZ;
    if (trailGeo.current) {
      trailGeo.current.setDrawRange(0, 1);
      trailGeo.current.attributes.position.needsUpdate = true;
      if (trailLine.current) trailLine.current.visible = false;
    }
  }, [surface, startX, startZ, resetKey, trail]);

  useFrame((_, delta) => {
    const w = walker.current;
    const step = Math.min(delta, 0.05);

    if (running && !w.dead) {
      w.stepAcc += step * speed;
      const interval = 1 / STEP_RATE; // 20 Hz simulation rate for fluid, responsive motion
      let budget = 4;
      while (w.stepAcc >= interval && budget > 0) {
        w.stepAcc -= interval;
        budget -= 1;

        const prevX = w.x;
        const prevZ = w.z;

        const [gx, gz] = grad(w.x, w.z);
        // Heavy-ball momentum: velocity carries over, so a ravine is crossed
        // in a damped oscillation rather than a zig-zag that never advances.
        w.vx = momentum * w.vx - rate * gx;
        w.vz = momentum * w.vz - rate * gz;
        w.x += w.vx;
        w.z += w.vz;
        w.steps += 1;

        if (!Number.isFinite(w.x) || !Number.isFinite(w.z) || Math.abs(w.x) > DOMAIN || Math.abs(w.z) > DOMAIN) {
          const overshot = !Number.isFinite(w.x) || !Number.isFinite(w.z) || f(w.x, w.z) > w.startLoss;
          w.x = clamp(Number.isFinite(w.x) ? w.x : 0, -DOMAIN, DOMAIN);
          w.z = clamp(Number.isFinite(w.z) ? w.z : 0, -DOMAIN, DOMAIN);
          w.vx = 0;
          w.vz = 0;
          w.dead = overshot ? "diverged" : "unbounded";
          break;
        }
        if (Math.hypot(gx, gz) < 0.004 && Math.hypot(w.vx, w.vz) < 0.004) {
          w.dead = "converged";
          break;
        }

        // Subdivide displacement so the yellow trail tightly hugs curved surface geometry
        const dist = Math.hypot(w.x - prevX, w.z - prevZ);
        const subSteps = Math.min(4, Math.max(1, Math.ceil(dist / 0.08)));
        for (let s = 1; s <= subSteps; s += 1) {
          if (w.count < TRAIL_MAX) {
            const frac = s / subSteps;
            const sx = prevX + (w.x - prevX) * frac;
            const sz = prevZ + (w.z - prevZ) * frac;
            const sy = drawHeight(f(sx, sz)) + 0.08;
            const o = w.count * 3;
            trail[o] = sx;
            trail[o + 1] = sy;
            trail[o + 2] = sz;
            w.count += 1;
          }
        }
      }
    }

    const height = f(w.x, w.z);
    const drawY = drawHeight(height);
    if (ball.current) ball.current.position.set(w.x, drawY + 0.19, w.z);

    if (trailGeo.current) {
      trailGeo.current.setDrawRange(0, w.count);
      trailGeo.current.attributes.position.needsUpdate = true;
      if (trailLine.current) trailLine.current.visible = w.count > 1;
    }

    // Direct 60 FPS downhill tangent pointer — sleek, perfectly scaled, zero React lag
    if (indicatorGroup.current) {
      if (showGradient && !w.dead) {
        const [gx, gz] = grad(w.x, w.z);
        const mag = Math.hypot(gx, gz);
        if (mag > 0.015) {
          indicatorGroup.current.visible = true;
          indicatorGroup.current.position.set(w.x, drawY + 0.19, w.z);

          // Downhill 2D direction (-gx, -gz)
          const dirX = -gx / mag;
          const dirZ = -gz / mag;

          // Compute surface tangent inclination in 3D
          const eps = 0.05;
          const hDrop = drawHeight(f(w.x + dirX * eps, w.z + dirZ * eps)) - drawY;
          const dirY = hDrop / eps;

          scratchVec.set(dirX, dirY, dirZ).normalize();

          // Refined, proportional scale (0.35 to 0.72) — avoids clumsy, oversized vectors
          const arrowLen = clamp(0.32 + Math.sqrt(mag) * 0.35, 0.35, 0.72);
          const headLen = 0.12;
          const shaftLen = Math.max(0.01, arrowLen - headLen);

          scratchQuat.setFromUnitVectors(Y_AXIS, scratchVec);
          indicatorGroup.current.quaternion.copy(scratchQuat);

          if (indicatorShaft.current) {
            indicatorShaft.current.scale.set(1, shaftLen, 1);
            indicatorShaft.current.position.set(0, shaftLen / 2, 0);
          }
          if (indicatorHead.current) {
            indicatorHead.current.position.set(0, shaftLen + headLen / 2, 0);
          }
        } else {
          indicatorGroup.current.visible = false;
        }
      } else {
        indicatorGroup.current.visible = false;
      }
    }

    w.sampleAcc += step;
    if (w.sampleAcc >= 0.16) {
      w.sampleAcc = 0;
      const [gx, gz] = grad(w.x, w.z);
      onSample({
        x: w.x,
        z: w.z,
        loss: height,
        slope: Math.hypot(gx, gz),
        steps: w.steps,
        status: w.dead,
      });
    }
  });

  const status = walker.current.dead;
  const ballColour =
    status === "diverged" || status === "unbounded"
      ? PALETTE.rose
      : status === "converged"
        ? PALETTE.emerald
        : PALETTE.gold;

  return (
    <group>
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[0.19, 26, 26]} />
        <meshStandardMaterial
          color={ballColour}
          emissive={ballColour}
          emissiveIntensity={1.5}
          roughness={0.2}
          toneMapped={false}
        />
      </mesh>

      {/* Yellow descent path: depthTest=false & depthWrite=false ensure it never dips into or is occluded by curved surface mesh */}
      <line ref={trailLine} frustumCulled={false} renderOrder={99}>
        <bufferGeometry ref={trailGeo}>
          <bufferAttribute attach="attributes-position" args={[trail, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={PALETTE.gold}
          transparent
          opacity={0.95}
          depthTest={false}
          depthWrite={false}
        />
      </line>

      {/* Direct-ref 60 FPS descent tangent indicator: sleek, slope-aligned, zero lag */}
      <group ref={indicatorGroup} visible={false}>
        <mesh ref={indicatorShaft}>
          <cylinderGeometry args={[0.018, 0.018, 1, 12]} />
          <meshStandardMaterial
            color={PALETTE.emerald}
            emissive={PALETTE.emerald}
            emissiveIntensity={1.4}
            roughness={0.25}
            toneMapped={false}
          />
        </mesh>
        <mesh ref={indicatorHead}>
          <coneGeometry args={[0.052, 0.12, 16]} />
          <meshStandardMaterial
            color={PALETTE.emerald}
            emissive={PALETTE.emerald}
            emissiveIntensity={1.6}
            roughness={0.2}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

const STATUS_LABEL = {
  diverged: "diverged",
  unbounded: "fell off — no minimum",
  converged: "settled",
};

export function GradientDescentScene({ params = {} }) {
  const {
    surface = "bowl",
    rate = 0.12,
    momentum = 0.6,
    startX = -2.6,
    startZ = 2.4,
    running = true,
    reset = 0,
    showGradient = true,
    spin = false,
    speed = 1.0,
  } = params || {};

  const [sample, setSample] = useState({ x: startX, z: startZ, loss: 0, slope: 0, steps: 0, status: null });
  const info = SURFACES[surface] ?? SURFACES.bowl;

  return (
    <SceneCanvas camera={{ position: [6.5, 6.2, 8.4], fov: 46 }} controls={{ autoRotate: spin, autoRotateSpeed: 0.45 * speed }}>
      <Grid
        position={[0, HEIGHT_CLAMP[0] - 0.4, 0]}
        args={[DOMAIN * 2.6, DOMAIN * 2.6]}
        cellSize={0.8}
        cellColor="#1e2531"
        sectionSize={3.2}
        sectionColor="#2b3442"
        fadeDistance={26}
        infiniteGrid={false}
      />

      <LossSurface surface={surface} />

      <DescentRunner
        // Remounting on a surface change is what guarantees the trail buffer
        // starts empty rather than trailing across the old landscape.
        key={surface}
        surface={surface}
        rate={rate}
        momentum={momentum}
        startX={startX}
        startZ={startZ}
        running={running}
        resetKey={reset}
        showGradient={showGradient}
        onSample={setSample}
        speed={params.speed ?? 1}
      />

      <SceneLabel position={[0, HEIGHT_CLAMP[1] + 0.5, 0]} accent>
        {info.formula}
      </SceneLabel>

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Descent state"
        subtitle="xₙ₊₁ = xₙ − α ∇f(xₙ)"
        rows={[
          ["Loss f(x, z)", sample.loss.toFixed(3), "gold"],
          ["Position x", sample.x.toFixed(2)],
          ["Position z", sample.z.toFixed(2)],
          ["Slope |∇f|", sample.slope.toFixed(3), sample.slope < 0.01 ? "good" : undefined],
          ["Learning rate α", rate.toFixed(3)],
          ["Momentum β", momentum.toFixed(2)],
          ["Steps taken", sample.steps],
          [
            "Status",
            STATUS_LABEL[sample.status] ?? (running ? "descending" : "paused"),
            sample.status === "diverged" || sample.status === "unbounded"
              ? "bad"
              : sample.status === "converged"
                ? "good"
                : undefined,
          ],
        ]}
        note={
          sample.status === "diverged"
            ? "Diverged: each step overshot by more than it started from, so the loss climbed away without bound. Lower α and reset."
            : sample.status === "unbounded"
              ? "It left the domain while still going downhill — the loss was falling the whole way. This surface has no minimum in that direction, so there is nothing to converge to."
              : sample.status === "converged"
                ? `Settled: the gradient here is flat, so every further step moves almost nothing. This is ${info.stationary}`
                : info.note
        }
        noteTone={
          sample.status === "diverged" || sample.status === "unbounded"
            ? "bad"
            : sample.status === "converged"
              ? "good"
              : "neutral"
        }
      />

      <SceneLegend
        title="Gradient descent"
        items={[
          { color: PALETTE.gold, label: "Current point", note: "the parameters being optimised" },
          { color: PALETTE.emerald, shape: "line", label: "−∇f", note: "steepest downhill — the step direction" },
          { color: PALETTE.violet, shape: "square", label: "Low loss", note: "the valleys you are trying to reach" },
          { color: PALETTE.rose, shape: "square", label: "High loss", note: "steep walls; a large α launches off them" },
        ]}
      />
    </SceneCanvas>
  );
}

// ═══ 2 · Solids of revolution ════════════════════════════════════════

/**
 * Radius as a function of u = y ÷ H, so every curve shares one domain
 * whatever the height slider says.
 *
 * The printed formulas are in u for that reason: writing them in y would only
 * be true at H = 1, and the panel would then disagree with the solid drawn
 * next to it the moment the height was changed.
 */
const CURVES = {
  line: {
    formula: "r = 0.25 + 1.45u",
    r: (u) => 0.25 + 1.45 * u,
    solid: "a truncated cone (frustum)",
  },
  parabola: {
    formula: "r = 0.2 + 1.6u²",
    r: (u) => 0.2 + 1.6 * u * u,
    solid: "a trumpet — the radius grows as the square of the height, so most of the volume sits at the top",
  },
  root: {
    formula: "r = 1.75√u",
    r: (u) => 1.75 * Math.sqrt(u),
    // r ∝ √y means r² ∝ y, so the cross-sectional area grows linearly: this
    // is the true paraboloid, and the one curve the disc sum gets exactly
    // right at any n, because a linear integrand is what the mid-ordinate
    // rule integrates without error.
    solid: "a paraboloid — the dish shape, whose cross-section grows in step with the height",
  },
  sine: {
    formula: "r = 1.05 + 0.62 sin(2.2πu)",
    r: (u) => 1.05 + 0.62 * Math.sin(u * Math.PI * 2.2),
    solid: "a vase — the radius turns over twice",
  },
  bell: {
    formula: "r = 0.18 + 1.6e^(−(3.1(u − ½))²)",
    r: (u) => 0.18 + 1.6 * Math.exp(-Math.pow((u - 0.5) * 3.1, 2)),
    solid: "a barrel, fattest at the mid-line",
  },
};

const LATHE_SEGMENTS = 96;
const PROFILE_POINTS = 120;

/** π ∫₀^H r² dy by Simpson's rule — the value the disc sum converges toward. */
function exactVolume(r, height, panels = 400) {
  // Substituting u = y/H turns the integral into πH ∫₀¹ r(u)² du.
  const h = 1 / panels;
  let sum = r(0) ** 2 + r(1) ** 2;
  for (let i = 1; i < panels; i += 1) {
    sum += (i % 2 ? 4 : 2) * r(i * h) ** 2;
  }
  return (Math.PI * height * h * sum) / 3;
}

export function SolidOfRevolutionScene({ params = {} }) {
  const {
    curve = "bell",
    sweep = 300,
    height = 3.6,
    slices = 12,
    showDiscs = true,
    showSolid = true,
    spin = true,
    speed = 1.0,
  } = params || {};

  const info = CURVES[curve] ?? CURVES.bell;
  const half = height / 2;
  const phiLength = (sweep * Math.PI) / 180;

  const lathe = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= PROFILE_POINTS; i += 1) {
      const t = i / PROFILE_POINTS;
      // Vector2(radius, y): LatheGeometry spins these about the Y axis, which
      // is why every curve here is written as a radius rather than a height.
      pts.push(new THREE.Vector2(Math.max(info.r(t), 0.001), t * height - half));
    }
    return new THREE.LatheGeometry(pts, LATHE_SEGMENTS, 0, phiLength);
  }, [curve, height, phiLength, info]);

  useEffect(() => () => lathe.dispose(), [lathe]);

  // The generating curve, drawn at φ = 0 where the lathe starts, so it reads
  // as the edge that was swept rather than a decoration floating nearby.
  const profile = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= PROFILE_POINTS; i += 1) {
      const t = i / PROFILE_POINTS;
      pts.push([0, t * height - half, info.r(t)]);
    }
    return pts;
  }, [curve, height, half, info]);

  const discs = useMemo(() => {
    const n = Math.round(slices);
    const h = height / n;
    return Array.from({ length: n }, (_, i) => {
      // Sampled at the midpoint: the mid-ordinate rule is second-order, so
      // the estimate closes on the true volume far faster than left endpoints.
      const t = (i + 0.5) / n;
      return { y: t * height - half, radius: Math.max(info.r(t), 0.001), thickness: h };
    });
  }, [curve, height, half, slices, info]);

  // The sweep angle cuts the solid open so you can see inside; it does not
  // make the solid smaller. Scaling the volumes by sweep/360 contradicted the
  // "V = π ∫ r² dy" printed directly above them, so both are now the full
  // solid of revolution and the sweep is labelled for what it is.
  const exact = exactVolume(info.r, height);
  const estimate = discs.reduce((sum, d) => sum + Math.PI * d.radius ** 2 * d.thickness, 0);
  const error = exact > 0 ? Math.abs(estimate - exact) / exact : 0;

  return (
    <SceneCanvas camera={{ position: [5.4, 2.6, 6.6], fov: 46 }} controls={{ autoRotate: spin, autoRotateSpeed: 0.45 * speed }}>
      <Grid
        position={[0, -half - 0.35, 0]}
        args={[9, 9]}
        cellSize={0.5}
        cellColor="#1e2531"
        sectionSize={2}
        sectionColor="#2b3442"
        fadeDistance={24}
        infiniteGrid={false}
      />

      {/* Axis of revolution. */}
      <Line
        points={[[0, -half - 0.6, 0], [0, half + 0.6, 0]]}
        color={PALETTE.slate}
        lineWidth={1.6}
        dashed
        dashSize={0.14}
        gapSize={0.1}
      />
      <SceneLabel position={[0, half + 0.95, 0]} tone="text-ink-400">
        axis of revolution (y)
      </SceneLabel>

      {showSolid && (
        <mesh geometry={lathe} castShadow receiveShadow>
          <meshStandardMaterial
            color={PALETTE.sky}
            emissive={PALETTE.sky}
            emissiveIntensity={0.16}
            roughness={0.32}
            metalness={0.28}
            transparent
            opacity={showDiscs ? 0.34 : 0.82}
            side={THREE.DoubleSide}
            depthWrite={!showDiscs}
          />
        </mesh>
      )}

      {showDiscs &&
        discs.map((d, i) => (
          <mesh key={i} position={[0, d.y, 0]}>
            {/* Flush contiguous Riemann discs with high-contrast alternating gold & bronze layers */}
            <cylinderGeometry
              args={[d.radius, d.radius, d.thickness, 48, 1, false, 0, phiLength]}
            />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#fcd34d" : "#b45309"}
              emissive={i % 2 === 0 ? "#d97706" : "#78350f"}
              emissiveIntensity={0.16}
              roughness={0.38}
              metalness={0.18}
              transparent
              opacity={0.92}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}

      <Line points={profile} color={PALETTE.emerald} lineWidth={3.2} />
      <SceneLabel position={[0, half + 0.2, info.r(1) + 0.55]} accent>
        r(y)
      </SceneLabel>

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Volume of revolution"
        subtitle="V = π ∫ r(y)² dy"
        rows={[
          ["Curve", info.formula],
          ["Height H", height.toFixed(1)],
          ["Cutaway", sweep >= 360 ? "closed" : `${Math.round(sweep)}° shown`],
          ["Exact V", exact.toFixed(3), "gold"],
          ["Disc sum", estimate.toFixed(3)],
          ["Discs n", Math.round(slices)],
          ["Error", `${(error * 100).toFixed(2)}%`, error < 0.01 ? "good" : error < 0.05 ? "warn" : "bad"],
        ]}
        note={
          error < 0.01
            ? "With this many discs the staircase is within 1% of the true solid — this is what taking the limit n → ∞ means in practice."
            : `Each disc is a cylinder of volume π r² Δy. Their sum approximates ${info.solid}; raise n and watch the error fall.`
        }
        noteTone={error < 0.01 ? "good" : "neutral"}
      />

      <SceneLegend
        title="Disc method"
        items={[
          { color: PALETTE.emerald, shape: "line", label: "r(y)", note: "the curve being revolved" },
          { color: PALETTE.gold, shape: "square", label: "Disc", note: "one cylinder, volume π r² Δy" },
          { color: PALETTE.sky, shape: "square", label: "True solid", note: "the limit as Δy → 0" },
          { color: PALETTE.slate, shape: "dash", label: "Axis", note: "revolve about y; r is measured from it" },
        ]}
      />
    </SceneCanvas>
  );
}

// ═══ 3 · Unit circle unrolled into a sine wave ═══════════════════════

const WAVE_SAMPLES = 260;
const CIRCLE_X = -5.4;
const WAVE_END = 5.6;
/** How many radians of phase one world unit along +x is worth. */
const WAVE_K = 0.62;
/** Subtle Z-depth separation between traces (cos and target wave) to prevent z-fighting while maintaining a tight, coherent 3D bundle */
const COS_Z = -0.22;
const TARGET_Z = 0.22;

const WAVEFORMS = {
  square: {
    label: "Square wave",
    k: (i) => 2 * i + 1,
    radius: (A, i) => A / (2 * i + 1),
    sign: () => 1,
    targetAmp: (A) => (A * Math.PI) / 4,
    hasGibbs: true,
  },
  sawtooth: {
    label: "Sawtooth wave",
    k: (i) => i + 1,
    radius: (A, i) => A / (i + 1),
    sign: (i) => (i % 2 === 0 ? 1 : -1),
    targetAmp: (A) => (A * Math.PI) / 2,
    hasGibbs: true,
  },
  triangle: {
    label: "Triangle wave",
    k: (i) => 2 * i + 1,
    radius: (A, i) => A / ((2 * i + 1) * (2 * i + 1)),
    sign: (i) => (i % 2 === 0 ? 1 : -1),
    targetAmp: (A) => (A * Math.PI * Math.PI) / 8,
    hasGibbs: false,
  },
};

/**
 * Peak of the partial sum, for the Gibbs overshoot readout.
 */
function partialSumPeak(waveform, amplitude, count) {
  if (count < 1) return 0;
  const wf = WAVEFORMS[waveform] ?? WAVEFORMS.square;
  if (!wf.hasGibbs) return wf.targetAmp(amplitude);
  const theta = waveform === "sawtooth" ? Math.PI - Math.PI / count : Math.PI / (2 * count);
  let v = 0;
  for (let i = 0; i < count; i += 1) {
    v += wf.sign(i) * wf.radius(amplitude, i) * Math.sin(wf.k(i) * theta);
  }
  return v;
}

function ringPoints(radius, segments = 72) {
  const pts = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([Math.cos(a) * radius, Math.sin(a) * radius, 0]);
  }
  return pts;
}

/**
 * The Fourier construction with multi-waveform synthesis, 3D phase helix, and tangent geometry.
 */
function Epicycles({
  waveform = "square",
  harmonics,
  amplitude,
  speed,
  showCircles,
  showTarget,
  showCos,
  showTangent,
  showHelix,
  onSample,
}) {
  const rings = useRef([]);
  const tip = useRef(null);
  const armGeo = useRef(null);
  const waveGeo = useRef(null);
  const cosGeo = useRef(null);
  const helixGeo = useRef(null);
  const targetGeo = useRef(null);
  const projGeo = useRef(null);
  const tangentSegGeo = useRef(null);
  const tangentRayGeo = useRef(null);
  const tangentPointRef = useRef(null);

  const count = Math.round(harmonics);
  const wf = WAVEFORMS[waveform] ?? WAVEFORMS.square;

  const armBuffer = useMemo(() => new Float32Array((count + 1) * 3), [count]);
  const waveBuffer = useMemo(() => new Float32Array(WAVE_SAMPLES * 3), []);
  const cosBuffer = useMemo(() => new Float32Array(WAVE_SAMPLES * 3), []);
  const helixBuffer = useMemo(() => new Float32Array(WAVE_SAMPLES * 3), []);
  const targetBuffer = useMemo(() => new Float32Array(WAVE_SAMPLES * 4 * 3), []);
  const projBuffer = useMemo(() => new Float32Array(6), []);
  const tangentSegBuffer = useMemo(() => new Float32Array(6), []);
  const tangentRayBuffer = useMemo(() => new Float32Array(6), []);

  const clock = useRef({ theta: 0, sampleAcc: 0 });

  const radii = useMemo(
    () => Array.from({ length: count }, (_, i) => wf.radius(amplitude, i)),
    [count, amplitude, wf],
  );

  const targetAmp = wf.targetAmp(amplitude);
  const overshoot = useMemo(() => {
    if (count < 2 || !wf.hasGibbs) return 0;
    return (partialSumPeak(waveform, amplitude, count) - targetAmp) / (2 * targetAmp);
  }, [waveform, amplitude, count, targetAmp, wf]);

  useFrame((_, delta) => {
    const c = clock.current;
    const step = Math.min(delta, 0.05);
    c.theta += step * speed;

    // Walk the epicycle chain
    let px = 0;
    let py = 0;
    armBuffer[0] = CIRCLE_X;
    armBuffer[1] = 0;
    armBuffer[2] = 0;

    for (let i = 0; i < count; i += 1) {
      const ring = rings.current[i];
      if (ring) ring.position.set(CIRCLE_X + px, py, 0);
      const k = wf.k(i);
      const sign = wf.sign(i);
      px += sign * radii[i] * Math.cos(k * c.theta);
      py += sign * radii[i] * Math.sin(k * c.theta);
      const o = (i + 1) * 3;
      armBuffer[o] = CIRCLE_X + px;
      armBuffer[o + 1] = py;
      armBuffer[o + 2] = 0;
    }

    if (tip.current) tip.current.position.set(CIRCLE_X + px, py, 0);
    if (armGeo.current) armGeo.current.attributes.position.needsUpdate = true;

    // Laser projection from orbiting tip to wave origin
    if (projGeo.current) {
      projBuffer[0] = CIRCLE_X + px;
      projBuffer[1] = py;
      projBuffer[2] = 0;
      projBuffer[3] = CIRCLE_X;
      projBuffer[4] = py;
      projBuffer[5] = 0;
      projGeo.current.attributes.position.needsUpdate = true;
    }

    // Travelling wave, cosine, and 3D Phase Helix
    for (let s = 0; s < WAVE_SAMPLES; s += 1) {
      const x = CIRCLE_X + ((WAVE_END - CIRCLE_X) * s) / (WAVE_SAMPLES - 1);
      const phase = c.theta - (x - CIRCLE_X) * WAVE_K;
      let y = 0;
      let cosY = 0;
      let z = 0;
      for (let i = 0; i < count; i += 1) {
        const k = wf.k(i);
        const sign = wf.sign(i);
        const term = sign * radii[i];
        y += term * Math.sin(k * phase);
        cosY += term * Math.cos(k * phase);
        z += term * Math.cos(k * phase);
      }
      const o = s * 3;
      waveBuffer[o] = x;
      waveBuffer[o + 1] = y;
      waveBuffer[o + 2] = 0;

      cosBuffer[o] = x;
      cosBuffer[o + 1] = cosY;
      cosBuffer[o + 2] = COS_Z;

      helixBuffer[o] = x;
      helixBuffer[o + 1] = y;
      helixBuffer[o + 2] = z;
    }
    if (waveGeo.current) waveGeo.current.attributes.position.needsUpdate = true;
    if (cosGeo.current) cosGeo.current.attributes.position.needsUpdate = true;
    if (helixGeo.current) helixGeo.current.attributes.position.needsUpdate = true;

    // Target wave synthesis: square (analytical step pairs), sawtooth (ramp), triangle
    if (showTarget) {
      let ptr = 0;
      const addPt = (px, py, pz) => {
        targetBuffer[ptr++] = px;
        targetBuffer[ptr++] = py;
        targetBuffer[ptr++] = pz;
      };

      if (waveform === "square") {
        const mMax = Math.floor(c.theta / Math.PI);
        const mMin = Math.ceil((c.theta - (WAVE_END - CIRCLE_X) * WAVE_K) / Math.PI);
        let currentY = (Math.sin(c.theta) >= 0 ? 1 : -1) * targetAmp;
        addPt(CIRCLE_X, currentY, TARGET_Z);
        for (let m = mMax; m >= mMin; m -= 1) {
          const x = CIRCLE_X + (c.theta - m * Math.PI) / WAVE_K;
          if (x > CIRCLE_X + 0.001 && x < WAVE_END - 0.001) {
            addPt(x, currentY, TARGET_Z);
            currentY = -currentY;
            addPt(x, currentY, TARGET_Z);
          }
        }
        addPt(WAVE_END, currentY, TARGET_Z);
      } else if (waveform === "sawtooth") {
        const twoPi = Math.PI * 2;
        for (let s = 0; s < WAVE_SAMPLES; s += 1) {
          const x = CIRCLE_X + ((WAVE_END - CIRCLE_X) * s) / (WAVE_SAMPLES - 1);
          const phase = c.theta - (x - CIRCLE_X) * WAVE_K;
          let norm = (phase + Math.PI) % twoPi;
          if (norm < 0) norm += twoPi;
          const y = ((norm - Math.PI) / Math.PI) * targetAmp;
          addPt(x, y, TARGET_Z);
        }
      } else if (waveform === "triangle") {
        for (let s = 0; s < WAVE_SAMPLES; s += 1) {
          const x = CIRCLE_X + ((WAVE_END - CIRCLE_X) * s) / (WAVE_SAMPLES - 1);
          const phase = c.theta - (x - CIRCLE_X) * WAVE_K;
          const y = ((2 * targetAmp) / Math.PI) * Math.asin(Math.sin(phase));
          addPt(x, y, TARGET_Z);
        }
      }

      if (targetGeo.current) {
        targetGeo.current.setDrawRange(0, ptr / 3);
        targetGeo.current.attributes.position.needsUpdate = true;
      }
    }

    // Tangent (tan θ) geometric construction
    const tanVal = Math.tan(c.theta);
    if (showTangent) {
      const tanX = CIRCLE_X + amplitude;
      const tanY = amplitude * tanVal;
      const clampedTanY = clamp(tanY, -4.5, 4.5);

      if (tangentSegGeo.current) {
        tangentSegBuffer[0] = tanX;
        tangentSegBuffer[1] = 0;
        tangentSegBuffer[2] = 0;
        tangentSegBuffer[3] = tanX;
        tangentSegBuffer[4] = clampedTanY;
        tangentSegBuffer[5] = 0;
        tangentSegGeo.current.attributes.position.needsUpdate = true;
      }

      if (tangentRayGeo.current) {
        tangentRayBuffer[0] = CIRCLE_X;
        tangentRayBuffer[1] = 0;
        tangentRayBuffer[2] = 0;
        tangentRayBuffer[3] = tanX;
        tangentRayBuffer[4] = clampedTanY;
        tangentRayBuffer[5] = 0;
        tangentRayGeo.current.attributes.position.needsUpdate = true;
      }

      if (tangentPointRef.current) {
        tangentPointRef.current.position.set(tanX, clampedTanY, 0);
        tangentPointRef.current.visible = Math.abs(tanVal) < 8;
      }
    }

    c.sampleAcc += step;
    if (c.sampleAcc >= 0.12) {
      c.sampleAcc = 0;
      const theta = c.theta % (Math.PI * 2);
      onSample({ theta, height: py, tanVal: Math.abs(tanVal) < 50 ? tanVal : undefined, overshoot });
    }
  });

  return (
    <group>
      {showCircles &&
        radii.map((r, i) => (
          <group key={i} ref={(el) => { rings.current[i] = el; }}>
            <Line points={ringPoints(r)} color={i === 0 ? PALETTE.sky : PALETTE.slate} lineWidth={i === 0 ? 2.2 : 1.2} transparent opacity={i === 0 ? 0.95 : 0.5} />
          </group>
        ))}

      {/* Epicycle chain radius arms */}
      <line frustumCulled={false}>
        <bufferGeometry ref={armGeo}>
          <bufferAttribute attach="attributes-position" args={[armBuffer, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={PALETTE.bone} transparent opacity={0.85} />
      </line>

      {/* Orbiting tip */}
      <mesh ref={tip}>
        <sphereGeometry args={[0.13, 20, 20]} />
        <meshStandardMaterial color={PALETTE.gold} emissive={PALETTE.gold} emissiveIntensity={1.7} toneMapped={false} />
      </mesh>

      {/* Horizontal laser projection from tip to wave start */}
      <line frustumCulled={false}>
        <bufferGeometry ref={projGeo}>
          <bufferAttribute attach="attributes-position" args={[projBuffer, 3]} />
        </bufferGeometry>
        <lineDashedMaterial color={PALETTE.gold} dashSize={0.12} gapSize={0.08} transparent opacity={0.5} />
      </line>

      {/* Travelling sine wave trace */}
      <line frustumCulled={false}>
        <bufferGeometry ref={waveGeo}>
          <bufferAttribute attach="attributes-position" args={[waveBuffer, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={PALETTE.gold} />
      </line>

      {/* Cosine wave trace */}
      {showCos && (
        <line frustumCulled={false}>
          <bufferGeometry ref={cosGeo}>
            <bufferAttribute attach="attributes-position" args={[cosBuffer, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={PALETTE.violet} transparent opacity={0.75} />
        </line>
      )}

      {/* 3D Phase Helix and reference cylinder */}
      {showHelix && (
        <group>
          <line frustumCulled={false} renderOrder={20}>
            <bufferGeometry ref={helixGeo}>
              <bufferAttribute attach="attributes-position" args={[helixBuffer, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color={PALETTE.sky} linewidth={2.5} />
          </line>
          <mesh position={[(CIRCLE_X + WAVE_END) / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[amplitude, amplitude, WAVE_END - CIRCLE_X, 36, 1, true]} />
            <meshBasicMaterial wireframe color={PALETTE.sky} transparent opacity={0.06} />
          </mesh>
        </group>
      )}

      {/* Tangent (tan θ) construction */}
      {showTangent && (
        <group>
          {/* Vertical contact line at x = A */}
          <Line
            points={[[CIRCLE_X + amplitude, -4.5, 0], [CIRCLE_X + amplitude, 4.5, 0]]}
            color={PALETTE.slate}
            lineWidth={1.2}
            dashed
            dashSize={0.12}
            gapSize={0.08}
          />
          {/* Extended ray through tip */}
          <line frustumCulled={false}>
            <bufferGeometry ref={tangentRayGeo}>
              <bufferAttribute attach="attributes-position" args={[tangentRayBuffer, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color={PALETTE.rose} transparent opacity={0.4} />
          </line>
          {/* Vertical tangent segment */}
          <line frustumCulled={false}>
            <bufferGeometry ref={tangentSegGeo}>
              <bufferAttribute attach="attributes-position" args={[tangentSegBuffer, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color={PALETTE.rose} linewidth={3} />
          </line>
          {/* Tangent point marker */}
          <mesh ref={tangentPointRef}>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial color={PALETTE.rose} emissive={PALETTE.rose} emissiveIntensity={2} toneMapped={false} />
          </mesh>
        </group>
      )}

      {/* Target synthesized waveform */}
      {showTarget && (
        <line frustumCulled={false}>
          <bufferGeometry ref={targetGeo}>
            <bufferAttribute attach="attributes-position" args={[targetBuffer, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={PALETTE.emerald} transparent opacity={0.85} />
        </line>
      )}
    </group>
  );
}

export function UnitCircleWaveScene({ params = {} }) {
  const {
    waveform = "square",
    harmonics = 1,
    amplitude = 1.4,
    speed = 1.1,
    showCircles = true,
    showCos = false,
    showTarget = false,
    showTangent = false,
    showHelix = false,
    spin = false,
  } = params || {};

  const [sample, setSample] = useState({ theta: 0, height: 0, tanVal: 0, overshoot: 0 });
  const count = Math.round(harmonics);
  const wf = WAVEFORMS[waveform] ?? WAVEFORMS.square;
  const targetAmp = wf.targetAmp(amplitude);

  return (
    <SceneCanvas
      camera={{ position: showHelix ? [3.2, 3.8, 11.2] : [0, 0.6, 12.5], fov: 48 }}
      controls={{ autoRotate: spin, autoRotateSpeed: 0.45 * speed }}
    >
      {/* Axes for the wave half of the scene. */}
      <Line points={[[CIRCLE_X, 0, 0], [WAVE_END + 0.4, 0, 0]]} color={PALETTE.line} lineWidth={1.4} />
      <Line points={[[CIRCLE_X, -2.6, 0], [CIRCLE_X, 2.6, 0]]} color={PALETTE.line} lineWidth={1.4} />

      <Epicycles
        key={`${count}-${waveform}`}
        waveform={waveform}
        harmonics={count}
        amplitude={amplitude}
        speed={speed}
        showCircles={showCircles}
        showTarget={showTarget}
        showCos={showCos}
        showTangent={showTangent}
        showHelix={showHelix}
        onSample={setSample}
      />

      <SceneLabel position={[CIRCLE_X, -3.1, 0]} accent>
        {count === 1 ? "one circle, radius A" : `${count} epicycles (${wf.label})`}
      </SceneLabel>
      <SceneLabel position={[1.6, -3.1, 0]} tone="text-ink-400">
        the same motion, plotted against time →
      </SceneLabel>

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Circular motion"
        subtitle={count === 1 ? "y = A sin θ · x = A cos θ" : `Fourier ${wf.label} synthesis`}
        rows={[
          ["Angle θ", `${((sample.theta * 180) / Math.PI).toFixed(0)}°`],
          ["…in radians", sample.theta.toFixed(2)],
          ["Height y", sample.height.toFixed(2), "gold"],
          ["sin θ", Math.sin(sample.theta).toFixed(3)],
          ["cos θ", Math.cos(sample.theta).toFixed(3)],
          ...(showTangent && sample.tanVal !== undefined
            ? [["tan θ", sample.tanVal.toFixed(3), "rose"]]
            : []),
          ["Amplitude A", amplitude.toFixed(2)],
          ["Harmonics", count],
          ...(count > 1
            ? [
                [`Target ${wf.label}`, targetAmp.toFixed(2)],
                ...(wf.hasGibbs
                  ? [["Overshoot of jump", `${(sample.overshoot * 100).toFixed(1)}%`, "warn"]]
                  : [["Gibbs overshoot", "0% (continuous)", "good"]]),
              ]
            : []),
        ]}
        note={
          count === 1
            ? "The sine wave is not a separate object from the circle — it is the height of a point going round, drawn against time. One full turn is one wavelength."
            : `Adding Fourier harmonics of amplitude scaled for a ${waveform} wave shapes the curve toward the target function. ${
                wf.hasGibbs
                  ? "The Gibbs phenomenon overshoot settles at about 9% of the jump however many terms you add."
                  : "The series converges uniformly with quadratic damping (1/k²) and zero overshoot."
              }`
        }
        noteTone={count > 1 && wf.hasGibbs ? "warn" : "neutral"}
      />

      <SceneLegend
        title="Circle → wave"
        items={[
          { color: PALETTE.sky, shape: "line", label: "Base circle", note: "radius A, turns at θ" },
          { color: PALETTE.gold, label: "Tip", note: "its height is the wave value" },
          { color: PALETTE.gold, shape: "line", label: "sin trace", note: "the tip's height against time" },
          ...(showTangent ? [{ color: PALETTE.rose, shape: "line", label: "Tangent line (tan θ)", note: "height on vertical line touching x = A" }] : []),
          ...(showCos ? [{ color: PALETTE.violet, shape: "line", label: "Horizontal trace", note: "cos θ — a quarter turn ahead of the sine" }] : []),
          ...(showHelix ? [{ color: PALETTE.sky, shape: "line", label: "3D Phase Helix", note: "unrolled 3D spatial trajectory (x, cos θ, sin θ)" }] : []),
          ...(showTarget ? [{ color: PALETTE.emerald, shape: "line", label: `Target ${wf.label}`, note: "what the Fourier series converges to" }] : []),
        ]}
      />
    </SceneCanvas>
  );
}

// ─── Dispatcher ─────────────────────────────────────────────────────

const SCENES = {
  gradient: GradientDescentScene,
  revolution: SolidOfRevolutionScene,
  unitcircle: UnitCircleWaveScene,
};

export default function MathCanvas({ topicId, params, setParam, onOpenQuiz }) {
  const Scene = SCENES[topicId];
  if (!Scene) return null;
  return <Scene params={params} setParam={setParam} onOpenQuiz={onOpenQuiz} />;
}

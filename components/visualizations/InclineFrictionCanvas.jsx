"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Grid, Line, RoundedBox } from "@react-three/drei";
import { Activity, X } from "lucide-react";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
  clamp,
} from "@/components/visualizations/scene-kit";
import {
  FORCE_COLOURS,
  ForceVector,
  ResolutionGuides,
  arcPoints,
  onSlope,
  slopeFrame,
  useBodyMotion,
  useForceScale,
  useRollingTrace,
  useWedgeGeometry,
} from "@/components/visualizations/force-diagram";
import { RAMP_LENGTH_M, advanceBlock, solveIncline, surfaceFor } from "@/lib/inclineForces";

// ─── Incline plane · Newton's laws & friction ───────────────────────
// A cargo block on an adjustable ramp, with every force that acts on it drawn
// from its centre of mass to one shared scale.
//
// The whole scene is a picture of two ideas that students routinely fuse into
// one: that weight resolves into mg·sinθ down the slope and mg·cosθ into it,
// and that friction is not a fixed force but a reaction with a ceiling. All of
// the arithmetic lives in `lib/inclineForces.js`, so the arrows, the trace and
// the HUD's Details panel are three views of a single solve.
// ─────────────────────────────────────────────────────────────────────

/** World units per metre. */
const SCALE = 1.15;
const RAMP_WORLD = RAMP_LENGTH_M * SCALE;
/** Where the ramp is hinged. Everything else is measured from here. */
const HINGE = [-2.75, -1.7, 0];
const RAMP_DEPTH = 1.5;
const PLANK = 0.14;
const BLOCK = 0.52;
const HALF_BLOCK = (BLOCK * 1.35) / 2;

/** Longest velocity the trace plots before it clips, m/s. */
const TRACE_SPEED = 6;
const TRACE_SECONDS = 8;

// ─── The block ──────────────────────────────────────────────────────

/**
 * The cargo block, its centre of mass, and every force on it.
 *
 * Coincident arrows are nudged a few centimetres apart along the surface —
 * N and mg·cosθ are equal and opposite and would otherwise be drawn exactly
 * on top of one another, which hides the very fact that they balance.
 */
function BlockAndForces({ frame, along, solved, scale, showComponents, showNet, showLabels = true, mass, surface }) {
  const lift = BLOCK / 2 + PLANK;
  const centre = onSlope(HINGE, frame, along, lift);
  const { up, out } = frame;

  /** A point offset from the centre of mass, to separate overlapping arrows. */
  const nudge = (alongBy, outBy) => [
    centre[0] + up[0] * alongBy + out[0] * outBy,
    centre[1] + up[1] * alongBy + out[1] * outBy,
    centre[2],
  ];

  const weightTip = [centre[0], centre[1] - solved.weight * scale, centre[2]];
  const parallelTip = [
    centre[0] - up[0] * solved.weightParallel * scale,
    centre[1] - up[1] * solved.weightParallel * scale,
    centre[2],
  ];
  const perpTip = [
    centre[0] - out[0] * solved.weightPerpendicular * scale,
    centre[1] - out[1] * solved.weightPerpendicular * scale,
    centre[2],
  ];

  return (
    <group>
      <group position={centre} rotation={[0, 0, frame.radians]}>
        {/* Main cargo crate body — bright golden honey wood, clean light rubber, or porcelain teflon */}
        <RoundedBox args={[BLOCK * 1.35, BLOCK, BLOCK * 0.95]} radius={0.05} smoothness={3} castShadow>
          <meshStandardMaterial
            color={surface === "teflon" ? "#ffffff" : surface === "rubber" ? "#64748b" : "#d4924b"}
            roughness={surface === "teflon" ? 0.2 : surface === "rubber" ? 0.75 : 0.55}
            metalness={surface === "teflon" ? 0.15 : 0.08}
          />
        </RoundedBox>

        {/* Structural reinforcement banding planks */}
        {[-1, 1].map((s) => (
          <group key={`band-${s}`} position={[s * (BLOCK * 0.42), 0, 0]}>
            <mesh>
              <boxGeometry args={[0.07, BLOCK + 0.008, BLOCK * 0.95 + 0.008]} />
              <meshStandardMaterial color="#a06030" roughness={0.7} />
            </mesh>
          </group>
        ))}

        {/* Polished brass corner reinforcement brackets */}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sy) =>
            [-1, 1].map((sz) => (
              <mesh
                key={`corner-${sx}-${sy}-${sz}`}
                position={[
                  (sx * (BLOCK * 1.35 - 0.06)) / 2,
                  (sy * (BLOCK - 0.06)) / 2,
                  (sz * (BLOCK * 0.95 - 0.06)) / 2,
                ]}
              >
                <boxGeometry args={[0.07, 0.07, 0.07]} />
                <meshStandardMaterial color="#fbbf24" roughness={0.25} metalness={0.85} />
              </mesh>
            )),
          ),
        )}

        {/* Recessed cargo crate side lifting handles */}
        {[-1, 1].map((side) => (
          <group key={`handle-${side}`} position={[0, 0, (side * (BLOCK * 0.95 + 0.02)) / 2]}>
            <mesh>
              <boxGeometry args={[0.22, 0.08, 0.015]} />
              <meshStandardMaterial color="#475569" roughness={0.5} />
            </mesh>
            <mesh position={[0, -0.01, 0.015]}>
              <cylinderGeometry args={[0.012, 0.012, 0.15, 12]} rotation={[0, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.85} />
            </mesh>
          </group>
        ))}

        {/* Bottom surface contact runner skids */}
        {[-1, 1].map((skid) => (
          <mesh
            key={`skid-${skid}`}
            position={[0, -BLOCK / 2 - 0.012, (skid * (BLOCK * 0.95 - 0.12)) / 2]}
          >
            <boxGeometry args={[BLOCK * 1.32, 0.024, 0.08]} />
            <meshStandardMaterial
              color={surface === "teflon" ? "#f8fafc" : surface === "rubber" ? "#334155" : "#b45309"}
              roughness={surface === "teflon" ? 0.05 : surface === "rubber" ? 0.9 : 0.4}
              metalness={surface === "teflon" ? 0.3 : 0.05}
            />
          </mesh>
        ))}

        {/* Front tow eyebolt ring on uphill face for pull string */}
        <group position={[(BLOCK * 1.35) / 2 + 0.02, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <mesh>
            <torusGeometry args={[0.035, 0.01, 12, 24]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.25} metalness={0.85} />
          </mesh>
        </group>
      </group>

      {/* Centre of mass — the point every arrow is drawn from. */}
      <mesh position={centre}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshStandardMaterial color={PALETTE.bone} emissive={PALETTE.bone} emissiveIntensity={1.4} toneMapped={false} />
      </mesh>

      {/* Weight, straight down, whatever the ramp is doing. */}
      <ForceVector
        at={centre}
        direction={[0, -1, 0]}
        newtons={solved.weight}
        scale={scale}
        colour={FORCE_COLOURS.weight}
        symbol="W = mg"
        showLabel={showLabels}
      />

      {showComponents && (
        <>
          <ForceVector
            at={nudge(0, 0.1)}
            direction={up}
            newtons={-solved.weightParallel}
            scale={scale}
            colour={FORCE_COLOURS.weightParallel}
            symbol="W∥ = mg sinθ"
            showLabel={showLabels}
          />
          <ForceVector
            at={nudge(-0.16, 0)}
            direction={out}
            newtons={-solved.weightPerpendicular}
            scale={scale}
            colour={FORCE_COLOURS.weightPerpendicular}
            symbol="W⊥ = mg cosθ"
            showLabel={showLabels}
          />
          {/* The rectangle that closes W∥ + W⊥ back onto W (only when both components exist). */}
          {solved.weightParallel * scale > 0.08 && solved.weightPerpendicular * scale > 0.08 && (
            <ResolutionGuides at={centre} tip={weightTip} componentTips={[parallelTip, perpTip]} />
          )}
        </>
      )}

      {/* Normal contact force — the surface pushing back. */}
      <ForceVector
        at={nudge(0.16, 0)}
        direction={out}
        newtons={solved.normal}
        scale={scale}
        colour={FORCE_COLOURS.normal}
        symbol="N"
        showLabel={showLabels}
      />

      {/* Friction. Signed, so it flips on its own when the motion reverses. */}
      <ForceVector
        at={nudge(0, -0.09)}
        direction={up}
        newtons={solved.friction}
        scale={scale}
        colour={FORCE_COLOURS.friction}
        symbol={solved.isStatic ? "fs" : "fk"}
        showLabel={showLabels}
      />

      {Math.abs(solved.appliedForce) > 0.05 && (
        <ForceVector
          at={nudge(0, 0.22)}
          direction={up}
          newtons={solved.appliedForce}
          scale={scale}
          colour={FORCE_COLOURS.applied}
          symbol="F"
          showLabel={showLabels}
          maxLength={
            solved.appliedForce > 0
              ? Math.max(0.18, (RAMP_WORLD + 0.04) - (along + HALF_BLOCK))
              : Math.max(0.18, along - HALF_BLOCK)
          }
        />
      )}

      {showNet && Math.abs(solved.netForce) > 0.05 && (
        <ForceVector
          at={nudge(0, -0.3)}
          direction={up}
          newtons={solved.netForce}
          scale={scale}
          colour={FORCE_COLOURS.net}
          symbol="Fnet = ma"
          showLabel={showLabels}
        />
      )}

      {showLabels && (
        <SceneLabel position={[centre[0], centre[1] + 0.52, centre[2]]} accent>
          {`${mass} kg`}
        </SceneLabel>
      )}
    </group>
  );
}

/**
 * Steps the block and reports where it got to.
 *
 * Lives inside the canvas because it drives `useFrame`; the parent only ever
 * sees throttled samples, which is what keeps a sixty-hertz simulation from
 * re-rendering a HUD sixty times a second.
 */
function BlockMotion({ options, running, speed = 1, resetKey, onSample, onTrace, maxTime = TRACE_SECONDS }) {
  const elapsed = useRef(0);
  const finished = useRef(false);

  const step = useCallback(
    (motion, dt) => {
      // If trace has reached the end of the graph time window or block hit barrier, stop
      if (elapsed.current >= maxTime || finished.current) {
        return motion;
      }
      const nextElapsed = Math.min(elapsed.current + dt, maxTime);
      const actualDt = nextElapsed - elapsed.current;
      elapsed.current = nextElapsed;
      const next = advanceBlock(motion, options, actualDt);
      if (next.hitBarrier) {
        onTrace(elapsed.current, next.arrivalVelocity ?? next.velocity, actualDt);
        finished.current = true;
      } else {
        onTrace(elapsed.current, next.velocity, actualDt);
      }
      return next;
    },
    [options, onTrace, maxTime],
  );

  const motion = useBodyMotion({ step, onSample, running, speed });

  // A reset puts the crate back in the middle of the ramp with the clock and
  // the trace both wiped, rather than leaving a stale curve on the graph.
  useEffect(() => {
    motion.current = { position: 0, velocity: 0 };
    elapsed.current = 0;
    finished.current = false;
    onSample(motion.current, 0);
  }, [resetKey, motion, onSample]);

  return null;
}

// ─── Right Telemetry Sidebar Components ──────────────────────────────

/**
 * Static friction grip capacity gauge bar.
 * Demonstrates the inequality f_s ≤ μ_s·N visually: fills as the slope
 * steepens and transitions to sliding state when the breakaway threshold is exceeded.
 */
function InclineGripBar({ solved, surface, rampAngle }) {
  const surf = surfaceFor(surface);
  const gripPct = Math.min(100, Math.max(0, (solved.gripUsed || 0) * 100));
  const isVerge = solved.onTheVerge;
  const isSliding = !solved.isStatic;

  const barColor = isSliding
    ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
    : isVerge
    ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]"
    : "bg-teal-400";

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-950/70 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-duck-300">
          Static Grip Capacity
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[9.5px] font-mono font-bold uppercase ${
            isSliding
              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
              : isVerge
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
              : "bg-teal-500/20 text-teal-300 border border-teal-500/40"
          }`}
        >
          {isSliding ? "Sliding" : isVerge ? "On The Verge" : "Equilibrium"}
        </span>
      </div>

      {/* The Grip Bar */}
      <div className="space-y-1">
        <div className="relative h-3.5 w-full overflow-hidden rounded-full border border-ink-700/80 bg-ink-900 p-0.5 shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-100 ${barColor}`}
            style={{ width: `${gripPct}%` }}
          />
          {/* 100% Break-away Ceiling marker */}
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/80" title="Ceiling: Break-away limit μs·N" />
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-ink-400">
          <span>0%</span>
          <span className="font-bold text-ink-200">{gripPct.toFixed(0)}% used</span>
          <span>100% (μs·N)</span>
        </div>
      </div>

      {/* Numerical friction breakdown */}
      <div className="rounded-lg border border-ink-800/80 bg-ink-900/60 p-2 text-[10.5px] leading-snug space-y-1">
        <div className="flex justify-between font-mono">
          <span className="text-ink-400">Friction Force:</span>
          <span className="text-ink-200 font-semibold">
            {solved.atBarrier ? `held by ${solved.atBarrier} stop` : `${solved.frictionMagnitude.toFixed(1)} N`}
          </span>
        </div>
        <div className="flex justify-between font-mono">
          <span className="text-ink-400">Max Static Limit (fs,max):</span>
          <span className="text-ink-200">{(solved.normal * surf.muS).toFixed(1)} N</span>
        </div>
        <div className="flex justify-between font-mono">
          <span className="text-ink-400">Repose Angle (θr):</span>
          <span className={`${rampAngle >= solved.reposeAngle ? "text-rose-400" : "text-emerald-400"} font-semibold`}>
            {solved.reposeAngle.toFixed(1)}° {rampAngle >= solved.reposeAngle ? "(exceeded)" : "(stable)"}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * 2D Velocity Trace graph plotted over time with adaptive zero-axis.
 */
function InclineVelocityGraph({ tracePoints, xMax, yMin, yMax, latest, markerLabel, solved, latestTime }) {
  const width = 280;
  const height = 120;
  const padL = 34;
  const padR = 10;
  const padT = 12;
  const padB = 20;

  const graphW = width - padL - padR;
  const graphH = height - padT - padB;

  const toSvgX = (t) => padL + (clamp(t, 0, xMax) / (xMax || 1)) * graphW;
  const toSvgY = (v) => {
    const range = (yMax - yMin) || 1;
    return padT + ((yMax - v) / range) * graphH;
  };

  const zeroY = toSvgY(0);

  const pathD = useMemo(() => {
    if (!tracePoints || tracePoints.length < 2) return "";
    return tracePoints.reduce((acc, pt, i) => {
      const x = toSvgX(pt[0]);
      const y = toSvgY(pt[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return acc;
      return `${acc} ${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, "");
  }, [tracePoints, xMax, yMin, yMax]);

  const latestSvg = latest && Number.isFinite(latest[0]) && Number.isFinite(latest[1])
    ? { x: toSvgX(latest[0]), y: toSvgY(latest[1]) }
    : null;

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-950/70 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-duck-300">
          Velocity Trace v(t)
        </span>
        <span className="font-mono text-[10px] text-ink-400">
          {latestTime.toFixed(2)}s / {xMax}s
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none overflow-visible">
        {/* Horizontal gridlines */}
        <line x1={padL} y1={padT} x2={width - padR} y2={padT} stroke="#2e3b52" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={padL} y1={padT + graphH / 2} x2={width - padR} y2={padT + graphH / 2} stroke="#2e3b52" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={padL} y1={padT + graphH} x2={width - padR} y2={padT + graphH} stroke="#2e3b52" strokeWidth="1" strokeDasharray="3 3" />

        {/* Zero baseline */}
        {zeroY >= padT && zeroY <= padT + graphH && (
          <line x1={padL} y1={zeroY} x2={width - padR} y2={zeroY} stroke="#64748b" strokeWidth="1.2" />
        )}

        {/* Y Axis labels */}
        <text x={padL - 4} y={padT + 4} textAnchor="end" className="text-[8.5px] fill-ink-500 font-mono">
          {yMax > 0 && yMin < 0 ? `+${yMax}` : yMax}
        </text>
        {zeroY >= padT + 10 && zeroY <= padT + graphH - 10 && (
          <text x={padL - 4} y={zeroY + 3} textAnchor="end" className="text-[8.5px] fill-ink-400 font-mono">
            0
          </text>
        )}
        <text x={padL - 4} y={padT + graphH + 3} textAnchor="end" className="text-[8.5px] fill-ink-500 font-mono">
          {yMin}
        </text>

        {/* X Axis labels */}
        <text x={padL} y={height - 4} textAnchor="start" className="text-[8.5px] fill-ink-500 font-mono">
          0s
        </text>
        <text x={width - padR} y={height - 4} textAnchor="end" className="text-[8.5px] fill-ink-500 font-mono">
          {xMax}s
        </text>

        {/* Trace path */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke={FORCE_COLOURS.velocity}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Marker */}
        {latestSvg && (
          <g transform={`translate(${latestSvg.x}, ${latestSvg.y})`}>
            <circle r="3.5" fill="#34d399" />
            <circle r="6" fill="#34d399" opacity="0.3" />
          </g>
        )}
      </svg>

      {/* Marker readout pill */}
      {markerLabel && (
        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-ink-800/60 font-mono">
          <span className="text-ink-400">Current Velocity:</span>
          <span className={`font-bold ${solved.atBarrier ? "text-amber-300" : latest?.[1] >= 0 ? "text-emerald-300" : "text-sky-300"}`}>
            {markerLabel}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Statistics & Newton's Second Law force resolution readout grid.
 */
function InclineStatsGrid({ solved, live, mass, surface, appliedForce, rampAngle }) {
  const surf = surfaceFor(surface);

  const stats = [
    { label: "Acceleration (a)", value: `${solved.acceleration.toFixed(2)} m/s²`, tone: solved.isStatic ? "neutral" : "bad" },
    { label: "Net Force (ΣF)", value: `${solved.netForce.toFixed(1)} N`, tone: solved.isStatic ? "good" : "warn" },
    { label: "Velocity (v)", value: `${live.velocity.toFixed(2)} m/s`, tone: "accent" },
    { label: "Ramp Angle (θ)", value: `${rampAngle}°`, tone: "gold" },
    { label: "Weight (W = mg)", value: `${solved.weight.toFixed(1)} N`, tone: "neutral" },
    { label: "Slope Force (W∥)", value: `${solved.weightParallel.toFixed(1)} N`, tone: "gold" },
    { label: "Normal Force (N)", value: `${solved.normal.toFixed(1)} N`, tone: "sky" },
    { label: "Applied Pull (F)", value: `${appliedForce.toFixed(1)} N`, tone: "neutral" },
    { label: "Static Coeff (μs)", value: `${surf.muS.toFixed(2)}`, tone: "neutral" },
    { label: "Kinetic Coeff (μk)", value: `${surf.muK.toFixed(2)}`, tone: "neutral" },
  ];

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-950/70 p-3 space-y-2">
      <div className="flex items-center justify-between border-b border-ink-800/80 pb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-duck-300">
          Forces & Dynamics
        </span>
        <span className="font-mono text-[9.5px] text-ink-500">
          m = {mass} kg · {surface}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-2.5 gap-y-2 pt-1">
        {stats.map((s, i) => (
          <div key={i} className="flex flex-col">
            <span className="text-[9.5px] uppercase tracking-wider text-ink-500 truncate">
              {s.label}
            </span>
            <span
              className={`font-mono text-xs font-bold ${
                s.tone === "accent"
                  ? "text-duck-300"
                  : s.tone === "gold"
                  ? "text-amber-300"
                  : s.tone === "sky"
                  ? "text-sky-300"
                  : s.tone === "good"
                  ? "text-emerald-400"
                  : s.tone === "warn"
                  ? "text-amber-400"
                  : s.tone === "bad"
                  ? "text-rose-400"
                  : "text-ink-200"
              }`}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function InclineFrictionCanvas({ params = {} }) {
  const {
    rampAngle = 20,
    surface = "wood",
    blockMass = 10,
    appliedForce = 0,
    showComponents = true,
    showNet = true,
    removeLabels = false,
    showLabels: paramShowLabels,
    running = true,
    speed = 1,
    reset = 0,
  } = params || {};

  const showLabels = removeLabels ? false : (paramShowLabels !== false);

  const [live, setLive] = useState({ position: 0, velocity: 0 });
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const trace = useRollingTrace(4000, 30, [[0, 0]]);

  const frame = useMemo(() => slopeFrame(rampAngle), [rampAngle]);

  const options = useMemo(
    () => ({ massKg: blockMass, angleDeg: rampAngle, surface, appliedForce }),
    [blockMass, rampAngle, surface, appliedForce],
  );

  // The solve the arrows are drawn from uses the CURRENT velocity, so friction
  // switches from static to kinetic in the diagram at the same instant the
  // block starts to move rather than a frame later.
  // Also account for barrier contact: when resting against the top or bottom stop,
  // the mechanical barrier supplies an equal reaction force, keeping the block at rest.
  const solved = useMemo(() => {
    const raw = solveIncline({ ...options, velocity: live.velocity });
    const limit = RAMP_LENGTH_M / 2;
    const atTop = live.position >= limit - 1e-4;
    const atBottom = live.position <= -limit + 1e-4;
    if (atTop && (live.velocity > 0 || raw.netForce > 0)) {
      return {
        ...raw,
        netForce: 0,
        acceleration: 0,
        isStatic: true,
        atBarrier: "top",
      };
    }
    if (atBottom && (live.velocity < 0 || raw.netForce < 0)) {
      return {
        ...raw,
        netForce: 0,
        acceleration: 0,
        isStatic: true,
        atBarrier: "bottom",
      };
    }
    return raw;
  }, [options, live.velocity, live.position]);

  const scale = useForceScale(
    [solved.weight, solved.normal, Math.abs(solved.appliedForce), solved.grip],
    1.7,
  );

  const onTrace = useCallback(
    (t, v, dt) => trace.push(t, v, dt),
    [trace],
  );
  const onSample = useCallback((motion) => setLive({ ...motion }), []);

  // Wiping the trace has to happen outside the frame loop, and the reset
  // counter is the only thing that should do it.
  useEffect(() => {
    trace.reset([[0, 0]]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset, rampAngle, surface, blockMass, appliedForce]);

  const b = RAMP_WORLD * Math.cos(frame.radians);
  const h = RAMP_WORLD * Math.sin(frame.radians);
  const wedge = useWedgeGeometry(b, h, RAMP_DEPTH);

  // Keep the crate on the plank rather than half off the end of it.
  const along = clamp(RAMP_WORLD / 2 + live.position * SCALE, HALF_BLOCK, RAMP_WORLD - HALF_BLOCK);

  const tracePoints = trace.points;
  const latest = tracePoints.length ? tracePoints[tracePoints.length - 1] : null;

  // Dynamic Y range that adapts to motion direction:
  // - Purely positive motion (uphill pull): yMin = 0, yMax = peak (zero axis at bottom, no middle line!)
  // - Purely negative motion (downhill slide): yMin = -peak, yMax = 0 (zero axis at top)
  // - Bipolar motion (reverses): symmetric -peak to +peak
  const { yMin, yMax } = useMemo(() => {
    let minV = 0;
    let maxV = 0;
    for (let i = 0; i < tracePoints.length; i += 1) {
      const v = tracePoints[i][1];
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const hasNeg = minV < -0.15;
    const hasPos = maxV > 0.15;

    if (!hasNeg && !hasPos) {
      return { yMin: 0, yMax: 4 };
    }
    if (!hasNeg) {
      const top = Math.max(2, Math.ceil(maxV * 1.15));
      return { yMin: 0, yMax: top };
    }
    if (!hasPos) {
      const bottom = Math.min(-2, Math.floor(minV * 1.15));
      return { yMin: bottom, yMax: 0 };
    }
    const peak = Math.max(2, Math.ceil(Math.max(Math.abs(minV), Math.abs(maxV)) * 1.15));
    return { yMin: -peak, yMax: peak };
  }, [tracePoints]);

  const latestTime = latest ? latest[0] : 0;
  const xMax = useMemo(() => {
    if (solved.atBarrier && latestTime > 0.1) {
      return Math.max(1.0, Math.ceil(latestTime * 1.25 * 2) / 2);
    }
    return Math.max(2.0, Math.min(TRACE_SECONDS, Math.ceil(Math.max(latestTime, 1) * 1.25)));
  }, [solved.atBarrier, latestTime]);

  const xLabel = solved.atBarrier && latestTime > 0.1
    ? `time · ${latestTime.toFixed(2)}s to stop`
    : `time · ${xMax}s window`;

  const markerLabel = latest
    ? solved.atBarrier
      ? `impact: ${latest[1] >= 0 ? "+" : ""}${latest[1].toFixed(2)} m/s`
      : `${latest[1] >= 0 ? "+" : ""}${latest[1].toFixed(2)} m/s`
    : undefined;

  return (
    <div className="relative flex h-full w-full flex-row overflow-hidden">
      {/* 3D WebGL Canvas Viewport */}
      <div className="relative h-full flex-1 min-w-0">
        <SceneCanvas
          camera={{ position: [0.6, 1.4, 12.8], fov: 46 }}
          controls={{ minDistance: 4, maxDistance: 26, target: [0.6, 0.2, 0] }}
          lights={{ ambient: 0.85, keyLight: 1.7 }}
        >
      <Grid
        position={[0, HINGE[1] - 0.001, 0]}
        args={[26, 16]}
        cellSize={SCALE / 2}
        cellColor="#334155"
        sectionSize={SCALE * 2}
        sectionColor="#475569"
        fadeDistance={40}
        infiniteGrid={false}
      />

      {/* ── Apparatus Sturdy Base Bed (anchored foundation, visible at all angles including 90°) ── */}
      <group position={[HINGE[0] + RAMP_WORLD / 2 - 0.05, HINGE[1] - 0.08, 0]}>
        {/* Main heavy aluminum/steel base plate — light satin brushed aluminum */}
        <mesh receiveShadow>
          <boxGeometry args={[RAMP_WORLD + 0.5, 0.14, RAMP_DEPTH + 0.14]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.35} metalness={0.65} />
        </mesh>
        {/* Green spirit level bubble vial embedded in the base */}
        <group position={[-RAMP_WORLD / 2 + 0.5, 0.075, (RAMP_DEPTH + 0.05) / 2]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.022, 0.022, 0.18, 16]} />
            <meshStandardMaterial color="#4ade80" roughness={0.1} metalness={0.2} transparent opacity={0.9} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.01, 12, 12]} />
            <meshStandardMaterial color="#bbf7d0" emissive="#4ade80" emissiveIntensity={1.5} />
          </mesh>
        </group>
      </group>

      {/* ── Hinge knuckle brackets at the pivot ── */}
      {[-1, 1].map((side) => (
        <group key={`hinge-${side}`} position={[HINGE[0], HINGE[1], (side * (RAMP_DEPTH + 0.14)) / 2]}>
          <mesh>
            <cylinderGeometry args={[0.13, 0.15, 0.06, 16]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.75} />
          </mesh>
        </group>
      ))}
      {/* Brass hinge pivot pin */}
      <mesh position={[HINGE[0], HINGE[1], 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.045, RAMP_DEPTH + 0.22, 16]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.25} metalness={0.9} />
      </mesh>

      {/* ── Rear Upright Support Mast at the end of the base (light satin extruded rail) ── */}
      <group position={[HINGE[0] + RAMP_WORLD, HINGE[1] + RAMP_WORLD / 2, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[0.08, RAMP_WORLD, RAMP_DEPTH * 0.4]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.25} metalness={0.8} />
        </mesh>
      </group>

      {/* ── Elevation Mast Sliding Clamp Collar ── */}
      <group position={[HINGE[0] + RAMP_WORLD, HINGE[1] + h, 0]}>
        <mesh>
          <boxGeometry args={[0.16, 0.12, RAMP_DEPTH * 0.45]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.8} />
        </mesh>
        {/* Knurled brass tightening knob */}
        <mesh position={[0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, 0.05, 16]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.25} metalness={0.9} />
        </mesh>
      </group>

      {/* ── The ramp wedge support (rendered when angle allows a non-degenerate wedge) ── */}
      {b > 0.05 && (
        <group position={[HINGE[0], HINGE[1], -RAMP_DEPTH / 2]}>
          <mesh geometry={wedge} receiveShadow>
            <meshStandardMaterial
              color="#cbd5e1"
              roughness={0.35}
              metalness={0.35}
              polygonOffset
              polygonOffsetFactor={1}
              polygonOffsetUnits={1}
            />
          </mesh>
        </group>
      )}

      {/* Sliding surface, laid on the hypotenuse — elevated by PLANK/2 and slightly wider to eliminate z-fighting */}
      <group
        position={onSlope(HINGE, frame, RAMP_WORLD / 2, PLANK / 2)}
        rotation={[0, 0, frame.radians]}
      >
        <mesh receiveShadow>
          <boxGeometry args={[RAMP_WORLD, PLANK, RAMP_DEPTH + 0.08]} />
          <meshStandardMaterial
            color={surfaceFor(surface).muS > 0.7 ? "#64748b" : surfaceFor(surface).muS > 0.2 ? "#d4a373" : "#f1f5f9"}
            roughness={clamp(surfaceFor(surface).muS + 0.1, 0.08, 0.85)}
            metalness={surfaceFor(surface).muS < 0.2 ? 0.35 : 0.08}
          />
        </mesh>
        {/* Dual extruded aluminum guide channel rails along both edges */}
        {[-1, 1].map((sz) => (
          <mesh
            key={`rail-${sz}`}
            position={[0, PLANK / 2 + 0.03, (sz * (RAMP_DEPTH + 0.08)) / 2]}
          >
            <boxGeometry args={[RAMP_WORLD, 0.06, 0.025]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.85} />
          </mesh>
        ))}
        {/* Laser-etched metric centimeter ruler ticks on the front rail */}
        {Array.from({ length: 9 }).map((_, i) => {
          const xPos = -RAMP_WORLD / 2 + (i * RAMP_WORLD) / 8;
          const isMajor = i % 2 === 0;
          return (
            <group key={`tick-${i}`} position={[xPos, PLANK / 2 + 0.05, (RAMP_DEPTH + 0.11) / 2]}>
              <Line
                points={[
                  [0, -0.02, 0],
                  [0, isMajor ? 0.03 : 0.01, 0],
                ]}
                color="#0f172a"
                lineWidth={isMajor ? 2.2 : 1.4}
              />
              {showLabels && isMajor && (
                <SceneLabel position={[0, -0.12, 0]} tone="text-ink-200">
                  {`${(i * 0.5).toFixed(1)}m`}
                </SceneLabel>
              )}
            </group>
          );
        })}
        {/* Bottom stopper bumper on the plank catching the crate */}
        <mesh position={[-RAMP_WORLD / 2 + 0.04, PLANK / 2 + 0.06, 0]}>
          <boxGeometry args={[0.08, 0.12, RAMP_DEPTH + 0.08]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.35} metalness={0.65} />
        </mesh>
      </group>

      {/* ── Top Pulley Wheel and Applied Pull Taut Tow String ── */}
      {Math.abs(appliedForce) > 0.05 && (
        <group position={onSlope(HINGE, frame, RAMP_WORLD + 0.06, PLANK + 0.08)} rotation={[0, 0, frame.radians]}>
          <mesh position={[0, -0.04, 0]}>
            <boxGeometry args={[0.06, 0.08, RAMP_DEPTH * 0.35]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.8} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.035, 24]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.15} metalness={0.95} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.05, 16]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.25} metalness={0.9} />
          </mesh>
        </group>
      )}

      {/* Taut nylon pull string from crate to top pulley */}
      {appliedForce > 0.05 && (RAMP_WORLD + 0.06 - (along + (BLOCK * 1.35) / 2 + 0.02)) > 0.03 && (
        <Line
          points={[
            onSlope(HINGE, frame, along + (BLOCK * 1.35) / 2 + 0.02, BLOCK / 2 + PLANK),
            onSlope(HINGE, frame, RAMP_WORLD + 0.06, PLANK + 0.08),
          ]}
          color="#f59e0b"
          lineWidth={2.8}
        />
      )}

      {/* ── The angle itself ── */}
      <Line
        points={[
          HINGE,
          [HINGE[0] + RAMP_WORLD * 1.02, HINGE[1], HINGE[2]],
        ]}
        color={PALETTE.slate}
        lineWidth={1.4}
        transparent
        opacity={0.6}
        dashed
        dashSize={0.14}
        gapSize={0.1}
      />
      <Line points={arcPoints(HINGE, 1.1, 0, frame.radians)} color={PALETTE.gold} lineWidth={2.2} />
      {showLabels && (
        <SceneLabel
          position={[
            HINGE[0] + Math.cos(frame.radians / 2) * 1.42,
            HINGE[1] + Math.sin(frame.radians / 2) * 1.42,
            0,
          ]}
          accent
        >
          {`θ = ${rampAngle}°`}
        </SceneLabel>
      )}

      {/* Where this surface lets go on its own, marked on the arc. */}
      {solved.reposeAngle <= 90 && (
        <Line
          points={[
            HINGE,
            [
              HINGE[0] + Math.cos((solved.reposeAngle * Math.PI) / 180) * 1.75,
              HINGE[1] + Math.sin((solved.reposeAngle * Math.PI) / 180) * 1.75,
              0,
            ],
          ]}
          color={PALETTE.rose}
          lineWidth={1.6}
          transparent
          opacity={0.75}
          dashed
          dashSize={0.1}
          gapSize={0.08}
        />
      )}

      <BlockAndForces
        frame={frame}
        along={along}
        solved={solved}
        scale={scale}
        showComponents={showComponents}
        showNet={showNet}
        showLabels={showLabels}
        mass={blockMass}
        surface={surface}
      />

      <BlockMotion
        options={options}
        running={running}
        speed={speed}
        maxTime={TRACE_SECONDS}
        resetKey={`${reset}-${rampAngle}-${surface}-${blockMass}-${appliedForce}`}
        onSample={onSample}
        onTrace={onTrace}
      />

      {/* Free-body diagram legend */}
      <SceneLegend
        title="Free-body diagram"
        items={[
          { color: FORCE_COLOURS.weight, shape: "line", label: "Weight W", note: "always vertically down" },
          { color: FORCE_COLOURS.weightParallel, shape: "line", label: "W∥", note: "mg sinθ, down the slope" },
          { color: FORCE_COLOURS.weightPerpendicular, shape: "line", label: "W⊥", note: "mg cosθ, into the surface" },
          { color: FORCE_COLOURS.normal, shape: "line", label: "Normal N", note: "balances W⊥ exactly" },
          { color: FORCE_COLOURS.friction, shape: "line", label: "Friction", note: "opposes motion, never causes it" },
          { color: FORCE_COLOURS.applied, shape: "line", label: "Applied F", note: "your pull, along the ramp" },
          { color: FORCE_COLOURS.net, shape: "line", label: "Resultant", note: "what is left over — this is ma" },
        ]}
      />
    </SceneCanvas>

        {/* Toggle button to reopen telemetry sidebar if closed */}
        {!rightSidebarOpen && (
          <button
            type="button"
            onClick={() => setRightSidebarOpen(true)}
            className="absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900/90 px-3 py-1.5 text-xs font-semibold text-ink-200 backdrop-blur shadow-lg transition-all hover:bg-ink-800 hover:text-white"
            title="Open Telemetry Sidebar"
          >
            <Activity className="h-3.5 w-3.5 text-duck-300" />
            <span>Telemetry</span>
          </button>
        )}
      </div>

      {/* Right Telemetry Sidebar: Graph, Grip Bar, Live Stats */}
      {rightSidebarOpen && (
        <aside className="relative flex h-full w-[320px] shrink-0 flex-col border-l border-ink-800 bg-ink-900/95 backdrop-blur-md z-10 overflow-y-auto p-3.5 space-y-3 shadow-2xl">
          <div className="flex items-center justify-between pb-1 border-b border-ink-800/70">
            <div className="flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-duck-300" />
              <span className="text-xs font-bold uppercase tracking-wider text-ink-100">
                Telemetry & Analytics
              </span>
            </div>
            <button
              type="button"
              onClick={() => setRightSidebarOpen(false)}
              className="rounded p-1 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
              title="Close Telemetry Sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <InclineGripBar solved={solved} surface={surface} rampAngle={rampAngle} />
          <InclineVelocityGraph
            tracePoints={tracePoints}
            xMax={xMax}
            yMin={yMin}
            yMax={yMax}
            latest={latest}
            markerLabel={markerLabel}
            solved={solved}
            latestTime={latestTime}
          />
          <InclineStatsGrid
            solved={solved}
            live={live}
            mass={blockMass}
            surface={surface}
            appliedForce={appliedForce}
            rampAngle={rampAngle}
          />
        </aside>
      )}
    </div>
  );
}

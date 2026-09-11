"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  SceneReadout,
  clamp,
} from "@/components/visualizations/scene-kit";
import { DialGauge, ENERGY_COLOURS, EnergyBars } from "@/components/visualizations/energy-bars";
import {
  buildTrack,
  describeRun,
  minimumReleaseHeight,
  minimumTopSpeed,
  positionAt,
  sampleAt,
  startRun,
  stepRun,
} from "@/lib/coasterEnergy";

// ─── Roller coaster · conservation of energy ────────────────────────
// A drop, a vertical loop and a braking straight, with the energy budget drawn
// as bars beside the track and the cart's speed taken from that budget rather
// than from a separate integration.
//
// Two things the scene is built to make undeniable: that the three bars always
// add to the same total, and that whether the cart survives the loop depends on
// the release height and the loop radius alone — the cart mass slider moves
// every energy in the chart and changes nothing about whether it makes it.
// ─────────────────────────────────────────────────────────────────────

/** Gauge below the loop where the accelerometer and speedo sit. */
const PANEL_Y = -5.4;

// ─── Rails ──────────────────────────────────────────────────────────

/**
 * The two running rails and their sleepers, swept along the centreline.
 *
 * Built from the same point list the physics samples, so the cart cannot ride
 * a rail that is a different shape from the one it is being solved against.
 */
function Track({ track, scale, showDanger = false }) {
  const { rails, sleepers } = useMemo(() => {
    const pts = track.points.map(([x, y]) => new THREE.Vector3(x * scale, y * scale, 0));
    const curve = new THREE.CatmullRomCurve3(pts);
    const gauge = 0.17;
    const built = [-1, 1].map((side) => {
      const offset = pts.map((p) => new THREE.Vector3(p.x, p.y, p.z + side * gauge));
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(offset), pts.length, 0.035, 6, false);
    });
    // Sleepers every few metres, oriented with the track.
    const ties = [];
    const stride = Math.max(Math.floor(track.points.length / 90), 1);
    for (let i = 0; i < track.points.length - 1; i += stride) {
      const a = track.points[i];
      const b = track.points[Math.min(i + 1, track.points.length - 1)];
      ties.push({
        position: [a[0] * scale, a[1] * scale, 0],
        rotation: Math.atan2(b[1] - a[1], b[0] - a[0]),
      });
    }
    return { rails: built, sleepers: ties, curve };
  }, [track, scale]);

  // Each release height and loop radius rebuilds the sweep, so the previous
  // pair of tubes has to be released with it.
  useEffect(() => () => rails.forEach((g) => g.dispose()), [rails]);

  /** The stretch of loop the cart cannot hold, drawn in warning colour. */
  const danger = useMemo(() => {
    if (!showDanger) return null;
    const pts = [];
    for (let i = 0; i <= 40; i += 1) {
      const at = track.loopEntryS + ((track.loopExitS - track.loopEntryS) * i) / 40;
      const [x, y] = positionAt(track, at);
      pts.push([x * scale, y * scale, 0]);
    }
    return pts;
  }, [showDanger, track, scale]);

  return (
    <group>
      {rails.map((g, i) => (
        <mesh key={i} geometry={g} castShadow>
          <meshStandardMaterial color="#c3ccd8" roughness={0.32} metalness={0.85} />
        </mesh>
      ))}
      {sleepers.map((tie, i) => (
        <mesh key={i} position={tie.position} rotation={[0, 0, tie.rotation]}>
          <boxGeometry args={[0.06, 0.05, 0.42]} />
          <meshStandardMaterial color="#4a5361" roughness={0.7} metalness={0.3} />
        </mesh>
      ))}
      {danger && <Line points={danger} color={ENERGY_COLOURS.thermal} lineWidth={5} transparent opacity={0.85} />}
    </group>
  );
}

/** Support columns, so the track reads as a structure rather than a drawing. */
function Supports({ track, scale }) {
  const columns = useMemo(() => {
    const out = [];
    const stride = Math.max(Math.floor(track.points.length / 26), 1);
    for (let i = 0; i < track.points.length; i += stride) {
      const [x, y] = track.points[i];
      // Nothing under the loop: its own uprights would run through the rail.
      if (track.s[i] > track.loopEntryS - 2 && track.s[i] < track.loopExitS + 2) continue;
      if (y < 0.4) continue;
      out.push({ x: x * scale, h: y * scale });
    }
    return out;
  }, [track, scale]);

  return (
    <group>
      {columns.map((c, i) => (
        <mesh key={i} position={[c.x, c.h / 2, 0]}>
          <boxGeometry args={[0.07, c.h, 0.07]} />
          <meshStandardMaterial color="#3a4352" roughness={0.7} metalness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

// ─── The cart ───────────────────────────────────────────────────────

/**
 * Drives the cart and reports back on a throttle.
 *
 * `useFrame` unsubscribes automatically when this component unmounts, which is
 * what makes switching topics clean: the run state lives in a ref inside here,
 * so nothing survives the switch to keep stepping a track that has gone.
 */
function CartRunner({ track, mass, friction, running, speed = 1, resetKey, scale, onSample }) {
  const cart = useRef(null);
  const state = useRef(startRun({ track, mass }));
  const since = useRef(0);

  // A new track, a new mass or a pressed reset all mean: put it back at the top
  // with a fresh, empty energy budget.
  useEffect(() => {
    state.current = startRun({ track, mass });
    onSample(describeRun({ track, state: state.current, mass }), state.current);
  }, [track, mass, resetKey, onSample]);

  useFrame((_, rawDelta) => {
    // A backgrounded tab hands back one enormous frame on return; integrating
    // it in a single step would teleport the cart through the loop.
    const delta = Math.min(rawDelta, 1 / 30);
    const dt = delta * speed;
    if (running && speed > 0) {
      // Sub-stepping keeps the loop accurate at speed without needing the
      // renderer to run any faster than it already is.
      for (let i = 0; i < 4; i += 1) state.current = stepRun(state.current, track, { mass, friction }, dt / 4);
    }

    const [x, y] = positionAt(track, state.current.s);
    if (cart.current) {
      const ahead = positionAt(track, Math.min(state.current.s + 0.6, track.length));
      const behind = positionAt(track, Math.max(state.current.s - 0.6, 0));
      const angle = Math.atan2(ahead[1] - behind[1], ahead[0] - behind[0]);
      // The cart rides on the inside of the rail, which on the loop means
      // above the track at the bottom and below it at the top.
      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);
      cart.current.position.set(x * scale + nx * 0.16, y * scale + ny * 0.16, 0);
      cart.current.rotation.z = angle;
    }

    since.current += delta;
    if (since.current >= 1 / 15) {
      since.current = 0;
      if (running) onSample(describeRun({ track, state: state.current, mass }), state.current);
    }
  });

  return (
    <group ref={cart}>
      <RoundedBox args={[0.52, 0.2, 0.3]} radius={0.04} smoothness={3}>
        <meshStandardMaterial color="#fbbf24" roughness={0.4} metalness={0.35} emissive="#fbbf24" emissiveIntensity={0.25} />
      </RoundedBox>
      {/* Riders, so the g-force readout has someone to happen to. */}
      {[-0.12, 0.12].map((dx) => (
        <mesh key={dx} position={[dx, 0.15, 0]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color="#e8ebf0" roughness={0.6} />
        </mesh>
      ))}
      {[-0.16, 0.16].map((dx) =>
        [-0.14, 0.14].map((dz) => (
          <mesh key={`${dx}${dz}`} position={[dx, -0.12, dz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.03, 10]} />
            <meshStandardMaterial color="#39414f" roughness={0.4} metalness={0.7} />
          </mesh>
        )),
      )}
    </group>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function RollerCoasterCanvas({ params = {} }) {
  const {
    releaseHeight = 25,
    loopRadius = 8,
    cartMass = 500,
    friction = false,
    running = true,
    speed = 1,
    relaunch = 0,
  } = params || {};

  const track = useMemo(
    () => buildTrack({ releaseHeight, loopRadius }),
    [releaseHeight, loopRadius],
  );

  const [live, setLive] = useState(() =>
    describeRun({ track, state: startRun({ track, mass: cartMass }), mass: cartMass }),
  );
  const onSample = useCallback((described) => setLive(described), []);

  // Fit the whole layout in frame whichever way the sliders are pushed: a
  // 50 m drop and a 3 m loop are very different shapes.
  const scale = useMemo(() => {
    const width = track.points[track.points.length - 1][0];
    const tallest = Math.max(releaseHeight, 2 * loopRadius);
    return Math.min(15.5 / Math.max(width, 1), 6.4 / Math.max(tallest, 1));
  }, [track, releaseHeight, loopRadius]);

  const minHeight = minimumReleaseHeight(loopRadius);
  const clears = releaseHeight >= minHeight;

  const total = live.gpe + live.ke + live.thermal;
  const centreX = (track.points[track.points.length - 1][0] * scale) / 2;

  return (
    <SceneCanvas
      // The layout is wide and the controls panel eats the left quarter of it,
      // so the whole ride is pushed right and the camera pulled back far
      // enough that the drop, the loop and the instrument row all fit at once.
      camera={{ position: [1.8, 0.4, 19.5], fov: 46 }}
      controls={{ minDistance: 6, maxDistance: 48, target: [1.8, -0.3, 0] }}
      lights={{ ambient: 0.55, keyLight: 1.0 }}
    >
      {/* The whole layout is shifted so its middle sits on the camera axis. */}
      <group position={[-centreX + 5, -0.4, 0]}>
        {/* Ground. */}
        <mesh position={[centreX, -0.06, 0]} receiveShadow>
          <boxGeometry args={[centreX * 2 + 3, 0.12, 3.2]} />
          <meshStandardMaterial color="#222a36" roughness={0.9} />
        </mesh>

        <Supports track={track} scale={scale} />
        <Track
          track={track}
          scale={scale}
          showDanger={Boolean(live.leftTrack)}
        />

        <CartRunner
          track={track}
          mass={cartMass}
          friction={friction}
          running={running}
          speed={speed}
          resetKey={relaunch}
          scale={scale}
          onSample={onSample}
        />

        {/* The theoretical minimum release height, drawn where it applies. */}
        <Line
          points={[
            [0, minHeight * scale, 0],
            [centreX * 2, minHeight * scale, 0],
          ]}
          color={clears ? ENERGY_COLOURS.workOut : ENERGY_COLOURS.thermal}
          lineWidth={1.8}
          transparent
          opacity={0.8}
          dashed
          dashSize={0.16}
          gapSize={0.12}
        />
        <SceneLabel position={[centreX * 2 + 0.9, minHeight * scale, 0]} tone={clears ? "text-emerald-300" : "text-rose-300"}>
          {`2.5 R = ${minHeight.toFixed(1)} m minimum`}
        </SceneLabel>

        {/* Release height marker. */}
        <SceneLabel position={[-0.6, releaseHeight * scale, 0]} accent>
          {`${releaseHeight} m`}
        </SceneLabel>

        {/* Loop diameter callout. */}
        <SceneLabel
          position={[
            (track.points[0][0] + 0) * scale + (track.loopEntryS + track.loopRadius) * 0 + centreX * 0.98,
            2 * loopRadius * scale + 0.55,
            0,
          ]}
          tone="text-ink-300"
        >
          {`loop R = ${loopRadius} m · needs ${minimumTopSpeed(loopRadius).toFixed(1)} m/s at the top`}
        </SceneLabel>
      </group>

      {/* ── Instruments ── */}
      <EnergyBars
        position={[-2.2, PANEL_Y, 0]}
        width={4.0}
        height={2.3}
        title="energy budget"
        unit="kJ"
        format={(v) => (v / 1000).toFixed(1)}
        reference={total}
        bars={[
          { key: "gpe", label: "GPE", value: live.gpe, colour: ENERGY_COLOURS.gpe },
          { key: "ke", label: "KE", value: live.ke, colour: ENERGY_COLOURS.kinetic },
          { key: "heat", label: "heat", value: live.thermal, colour: ENERGY_COLOURS.thermal },
        ]}
        stack={{
          label: "total",
          segments: [
            { key: "s-gpe", value: live.gpe, colour: ENERGY_COLOURS.gpe },
            { key: "s-ke", value: live.ke, colour: ENERGY_COLOURS.kinetic },
            { key: "s-heat", value: live.thermal, colour: ENERGY_COLOURS.thermal },
          ],
        }}
        footnote={friction ? "steel on steel — the stack still totals the same" : "frictionless — GPE and KE just trade places"}
      />

      <DialGauge
        position={[3.6, PANEL_Y + 1.05, 0]}
        radius={0.95}
        value={live.speed}
        max={Math.max(45, live.speed * 1.1)}
        label="speed"
        readout={`${live.speed.toFixed(1)} m/s`}
        colour={ENERGY_COLOURS.kinetic}
      />

      <DialGauge
        position={[6.6, PANEL_Y + 1.05, 0]}
        radius={0.95}
        value={live.gForce}
        min={-2}
        max={8}
        redline={5}
        label="passenger g-force"
        readout={`${live.gForce.toFixed(2)} g`}
        colour={ENERGY_COLOURS.gpe}
      />

      <SceneLabel position={[5.0, PANEL_Y - 0.55, 0]} tone={live.leftTrack ? "text-rose-300" : clears ? "text-emerald-300" : "text-amber-300"}>
        {live.leftTrack
          ? "the cart left the rail in the loop — raise the release height"
          : live.gForce > 5
            ? `${live.gForce.toFixed(1)} g — a real ride would grey its passengers out`
            : clears
              ? `clears the loop · ${live.topSpeed.toFixed(1)} m/s at the top, needs ${live.neededTopSpeed.toFixed(1)}`
              : `too low — ${minHeight.toFixed(1)} m is the minimum for this loop`}
      </SceneLabel>

      <SceneReadout
        hidden={params?.hideOverlayReadout}
        title="Energy on the track"
        subtitle="GPE + KE = constant"
        rows={[
          ["Height", `${live.height.toFixed(1)} m`],
          ["Speed", `${live.speed.toFixed(1)} m/s`, "gold"],
          ["GPE", `${(live.gpe / 1000).toFixed(1)} kJ`],
          ["KE", `${(live.ke / 1000).toFixed(1)} kJ`],
          ["Heat", `${(live.thermal / 1000).toFixed(1)} kJ`, live.thermal > 0 ? "warn" : "good"],
          ["g-force", `${live.gForce.toFixed(2)} g`, live.gForce < 0 ? "bad" : live.gForce > 5 ? "warn" : "good"],
        ]}
      />

      <SceneLegend
        title="Energy budget"
        items={[
          { color: ENERGY_COLOURS.gpe, label: "GPE = mgh", note: "all of it at the top of the drop" },
          { color: ENERGY_COLOURS.kinetic, label: "KE = ½mv²", note: "all of it at ground level" },
          { color: ENERGY_COLOURS.thermal, label: "Heat", note: "friction and brakes — this one never comes back" },
          { color: ENERGY_COLOURS.total, label: "Total", note: "the line the stack never crosses" },
        ]}
      />
    </SceneCanvas>
  );
}

"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { SceneLabel } from "@/components/visualizations/scene-kit";
import {
  clampIndex,
  createStepper,
  stepperJump,
  stepperLock,
  stepperPause,
  stepperPlay,
  stepperSnapshot,
  stepperTick,
} from "@/lib/stageCycle";

// ─── Stage stepper kit ──────────────────────────────────────────────
// The React half of `lib/stageCycle.js`: the clock that turns the HUD's
// "stepper" control into a time the scene can draw from.
//
// The HUD owns two params — a stage index and a playing flag — and renders
// them as chips, Prev/Next and Play/Pause (see `ControlField`'s "stepper"
// case in `VisualizationHUD.jsx`). `StageCycleDriver` lives inside the
// Canvas and reconciles those params with the pure stepper machine every
// frame:
//
//   stepping   a change to the stage index the driver did not write is the
//              student choosing a stage; the machine tweens the clock to
//              that stage's hold point and parks. The picture that results
//              is the settled, textbook tableau for the stage.
//   playing    the clock runs continuously and wraps. Each time the playhead
//              crosses into a new stage the driver pushes the index back to
//              the HUD, so the chips follow the film — and it remembers what
//              it pushed, so that echo is never mistaken for a jump.
//   lock       an optional arrest (colchicine): the clock may not pass that
//              stage's hold point in either mode.
//
// `live.current` is refreshed every frame for geometry; `onTick` fires on
// the push cadence for React state and labels. Both scenes that step
// through a cycle mount exactly this and nothing else.
// ─────────────────────────────────────────────────────────────────────

/**
 * @param cycle      from `makeCycle`
 * @param stage      the HUD's stage index param
 * @param playing    the HUD's play/pause param
 * @param speed      playback multiplier (the HUD's animation speed)
 * @param tempo      optional per-stage rate, cycle seconds per second — a
 *                   function of the stage index or an array (a heartbeat's
 *                   systole and diastole shorten by different amounts)
 * @param lock       stage index the cycle is arrested at, or null
 * @param live       a ref the driver fills with the snapshot every frame
 * @param setParam   the HUD setter; the driver writes `stageKey` through it
 * @param stageKey   which param carries the stage index (default "stage")
 * @param onFrame    called with the snapshot EVERY frame, before any mesh that
 *                   mounted after the driver runs its own `useFrame` — the
 *                   place for a scene's choreography to write shared refs
 * @param onTick     called with the snapshot every `pushEvery` seconds
 */
export function StageCycleDriver({
  cycle,
  stage = 0,
  playing = false,
  speed = 1,
  tempo = null,
  lock = null,
  live,
  setParam,
  stageKey = "stage",
  onFrame,
  onTick,
  pushEvery = 0.1,
}) {
  const ref = useRef(null);
  if (ref.current === null) {
    ref.current = {
      machine: createStepper(cycle, { index: stage, playing, lock }),
      seen: { cycle, stage: clampIndex(cycle, stage), playing, lock: lock ?? null },
      sincePush: 1,
    };
  }

  useFrame((_, rawDelta) => {
    const c = ref.current;
    const seen = c.seen;
    let m = c.machine;
    const push = (index) => {
      if (index === seen.stage) return;
      seen.stage = index;
      if (typeof setParam === "function") setParam(stageKey, index);
    };

    // A different cycle (mitosis ↔ meiosis) is a different set of stages:
    // rebuild the machine parked on the nearest stage that still exists.
    if (cycle !== seen.cycle) {
      const index = clampIndex(cycle, stage);
      m = createStepper(cycle, { index, playing, lock });
      seen.cycle = cycle;
      seen.playing = playing;
      seen.lock = lock ?? null;
      push(index);
    }

    if (playing !== seen.playing) {
      seen.playing = playing;
      m = playing ? stepperPlay(cycle, m) : stepperPause(cycle, m);
      // Pausing parks on whatever stage the playhead is in.
      push(m.index);
    }

    const lockValue = lock ?? null;
    if (lockValue !== seen.lock) {
      seen.lock = lockValue;
      m = stepperLock(cycle, m, lockValue);
      push(m.index);
    }

    // A stage index the driver did not write is the student choosing a stage.
    const wanted = clampIndex(cycle, stage);
    if (wanted !== seen.stage) {
      m = stepperJump(cycle, m, wanted);
      seen.stage = wanted;
      // The lock may have clamped the request; say so.
      push(m.index);
    }

    const dt = Math.min(rawDelta, 1 / 30);
    m = stepperTick(cycle, m, dt, speed, tempo);
    c.machine = m;

    // Playing: the chips follow the film.
    if (m.playing && m.index !== seen.stage) push(m.index);

    const snapshot = stepperSnapshot(cycle, m);
    snapshot.dt = dt;
    if (live) live.current = snapshot;
    if (typeof onFrame === "function") onFrame(snapshot);

    c.sincePush += dt;
    if (c.sincePush < pushEvery) return;
    c.sincePush = 0;
    if (typeof onTick === "function") onTick(snapshot);
  });

  return null;
}

/**
 * A one-line stage strip for the scene: "3 / 6 · Metaphase · ▰▰▰▱▱ · playing".
 * `snapshot` is what the driver hands `onTick`.
 */
export function StageCaption({ position = [0, -1, 0], snapshot, tone = "text-ink-300", arrestedLabel = "arrested" }) {
  if (!snapshot || snapshot.index < 0) return null;
  const bar = Array.from({ length: 5 }, (_, i) => (snapshot.progress * 5 > i + 0.5 ? "▰" : "▱")).join("");
  const state = snapshot.arrested ? arrestedLabel : snapshot.transitioning ? "stepping…" : snapshot.playing ? "playing" : "paused";
  return (
    <SceneLabel position={position} tone={snapshot.arrested ? "text-rose-300" : tone} accent={!snapshot.arrested && !snapshot.playing && !snapshot.transitioning}>
      {`${snapshot.index + 1} / ${snapshot.count} · ${snapshot.label} · ${bar} · ${state}`}
    </SceneLabel>
  );
}

"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { SceneLabel } from "@/components/visualizations/scene-kit";
import { advanceTimeline, clamp, describeTimeline } from "@/lib/timeline";

// ─── Triggered timeline kit ─────────────────────────────────────────
// The React half of `lib/timeline.js`: the clock that turns "the button
// was pressed" into a time the scene can draw from.
//
// `TimelineDriver` lives inside the Canvas and runs in `useFrame`. Its
// contract with the HUD is the same one the peristalsis and carbon scenes
// use — an action control bumps a counter, the driver notices the change
// and restarts from zero — with one addition: an optional SCRUB. Give it
// the time slider's value and setter and the driver pushes the playing
// clock into the slider ten times a second; drag the slider and the
// driver notices the value it did not push, jumps there, and pauses. The
// next press of the button plays again from the start.
//
// The driver writes `describeTimeline(...)` into `live.current` every
// frame (for particles and geometry) and calls `onTick` on the push
// cadence (for React state and the HUD), so nothing in the scene has to
// know which of the two clocks it is reading.
// ─────────────────────────────────────────────────────────────────────

const roundTo = (v, step) => Math.round(v / step) * step;

/**
 * @param timeline   from `makeTimeline`
 * @param trigger    the action counter; a change to a positive value restarts, a change to 0 goes idle
 * @param speed      playback multiplier (the HUD's animation speed)
 * @param autoplay   play once on mount without a press
 * @param live       a ref the driver fills with the current snapshot every frame
 * @param scrub      optional { value, onChange, step } — the time slider
 * @param onTick     called with the snapshot every `pushEvery` seconds
 */
export function TimelineDriver({ timeline, trigger = 0, speed = 1, autoplay = false, live, scrub, onTick, pushEvery = 0.1 }) {
  const clock = useRef({
    t: 0,
    playing: autoplay,
    trigger,
    scrubSeen: scrub ? Number(scrub.value) || 0 : null,
    sincePush: 1,
  });

  useFrame((_, rawDelta) => {
    const c = clock.current;
    const step = scrub?.step ?? 0.1;

    if (trigger !== c.trigger) {
      c.trigger = trigger;
      c.t = 0;
      c.playing = trigger > 0;
      c.sincePush = 1;
    }

    // A slider value the driver did not write is the user scrubbing.
    if (scrub) {
      const v = Number(scrub.value);
      if (Number.isFinite(v) && v !== c.scrubSeen) {
        c.scrubSeen = v;
        c.t = clamp(v, 0, timeline.total);
        c.playing = false;
        c.sincePush = 1;
      }
    }

    const dt = Math.min(rawDelta, 1 / 30);
    if (c.playing) {
      c.t = advanceTimeline(timeline, c.t, dt * speed);
      if (c.t >= timeline.total) c.playing = false;
    }

    const snapshot = describeTimeline(timeline, c.t);
    snapshot.playing = c.playing;
    snapshot.active = c.t > 0 || c.playing;
    if (live) live.current = snapshot;

    c.sincePush += dt;
    if (c.sincePush < pushEvery) return;
    c.sincePush = 0;
    if (typeof onTick === "function") onTick(snapshot);
    if (scrub && typeof scrub.onChange === "function") {
      const rounded = Number(Math.min(timeline.total, roundTo(c.t, step)).toFixed(3));
      if (rounded !== c.scrubSeen) {
        c.scrubSeen = rounded;
        scrub.onChange(rounded);
      }
    }
  });

  return null;
}

/**
 * A one-line stage strip for the scene: "3 / 6 · The pollen tube grows
 * down the style · ▰▰▰▱▱". `snapshot` is what the driver hands `onTick`.
 */
export function TimelineCaption({ position = [0, -1, 0], timeline, snapshot, idle = "press the button to begin", tone = "text-ink-300" }) {
  if (!snapshot || !snapshot.active) {
    return (
      <SceneLabel position={position} tone="text-ink-500">
        {idle}
      </SceneLabel>
    );
  }
  const n = timeline.stages.length;
  const bar = Array.from({ length: 5 }, (_, i) => (snapshot.progress * 5 > i + 0.5 ? "▰" : "▱")).join("");
  return (
    <SceneLabel position={position} tone={snapshot.complete ? "text-emerald-300" : tone} accent={snapshot.complete}>
      {snapshot.complete ? `complete · ${snapshot.label}` : `${snapshot.index + 1} / ${n} · ${snapshot.label} · ${bar}${snapshot.playing ? "" : " · paused"}`}
    </SceneLabel>
  );
}

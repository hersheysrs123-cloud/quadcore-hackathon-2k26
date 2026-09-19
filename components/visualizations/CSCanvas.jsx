"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Grid } from "@react-three/drei";
import BinaryTree3D from "@/components/visualizations/BinaryTree3D";
import { ALGORITHM_META } from "@/components/visualizations/topic-options";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  clamp,
  hashRandom,
} from "@/components/visualizations/scene-kit";

// ─── Computer Science · two scenes ──────────────────────────────────
// The binary search tree (which brings its own HUD) and a 3D sorting
// visualiser driven by the shared parameter HUD.
// ─────────────────────────────────────────────────────────────────────

// ═══ Sorting algorithms ══════════════════════════════════════════════

const MAX_BARS = 44;
/** Playback is precomputed, so a runaway O(n²) trace cannot hang the tab. */
const MAX_FRAMES = 5000;
const BAR_SPACING = 0.46;
const BAR_WIDTH = 0.34;
const HEIGHT_SCALE = 0.062;

/** Deterministic starting array, so a given shuffle count always replays. */
function makeValues(size, shuffle) {
  return Array.from({ length: size }, (_, i) => 8 + Math.round(hashRandom(i * 1.37 + shuffle * 91.7 + 3) * 92));
}

/**
 * Runs the algorithm to completion up front, recording a frame per comparison
 * and per write. Playback is then just an index into that list — which is what
 * lets the speed slider, pause and scrub all work without re-running anything.
 */
function buildFrames(values, algorithm) {
  const a = [...values];
  const n = a.length;
  const frames = [];
  const sorted = new Set();
  let comparisons = 0;
  let writes = 0;
  let truncated = false;

  const push = (active, op) => {
    if (frames.length >= MAX_FRAMES) {
      truncated = true;
      return;
    }
    frames.push({ arr: [...a], active, sorted: [...sorted], op, comparisons, writes });
  };
  const swap = (i, j) => {
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
    writes += 2;
  };

  if (algorithm === "bubble") {
    for (let end = n - 1; end > 0; end -= 1) {
      let swapped = false;
      for (let i = 0; i < end; i += 1) {
        comparisons += 1;
        push([i, i + 1], "compare");
        if (a[i] > a[i + 1]) {
          swap(i, i + 1);
          push([i, i + 1], "swap");
          swapped = true;
        }
      }
      sorted.add(end);
      // The early exit is the whole reason bubble sort has a linear best case.
      if (!swapped) {
        for (let i = 0; i <= end; i += 1) sorted.add(i);
        break;
      }
    }
    for (let i = 0; i < n; i += 1) sorted.add(i);
  } else if (algorithm === "insertion") {
    sorted.add(0);
    for (let i = 1; i < n; i += 1) {
      const key = a[i];
      let j = i - 1;
      push([i], "pick");
      while (j >= 0) {
        comparisons += 1;
        // Temporarily put key in the current insertion hole j+1 so the comparison frame shows key vs a[j]
        a[j + 1] = key;
        push([j, j + 1], "compare");
        if (a[j] <= key) break;
        a[j + 1] = a[j];
        writes += 1;
        push([j, j + 1], "write");
        j -= 1;
      }
      a[j + 1] = key;
      writes += 1;
      sorted.add(i);
      push([j + 1], "write");
    }
  } else if (algorithm === "selection") {
    for (let i = 0; i < n - 1; i += 1) {
      let min = i;
      for (let j = i + 1; j < n; j += 1) {
        comparisons += 1;
        push([min, j], "compare");
        if (a[j] < a[min]) min = j;
      }
      if (min !== i) {
        swap(i, min);
        push([i, min], "swap");
      }
      sorted.add(i);
    }
    sorted.add(n - 1);
  } else if (algorithm === "quick") {
    const quick = (lo, hi) => {
      if (lo > hi) return;
      if (lo === hi) {
        sorted.add(lo);
        return;
      }
      // Lomuto partition: the last element is the pivot, and `i` marks the
      // boundary of the "less than pivot" region built up so far.
      const pivot = a[hi];
      let i = lo;
      for (let j = lo; j < hi; j += 1) {
        comparisons += 1;
        push([j, hi], "compare");
        if (a[j] < pivot) {
          if (i !== j) {
            swap(i, j);
            push([i, j], "swap");
          }
          i += 1;
        }
      }
      swap(i, hi);
      push([i, hi], "swap");
      sorted.add(i);
      quick(lo, i - 1);
      quick(i + 1, hi);
    };
    quick(0, n - 1);
    for (let i = 0; i < n; i += 1) sorted.add(i);
  } else if (algorithm === "merge") {
    const buffer = new Array(n);
    const prevArr = new Array(n);
    const merge = (lo, mid, hi) => {
      for (let i = lo; i <= hi; i += 1) buffer[i] = a[i];
      let l = lo;
      let r = mid + 1;
      for (let k = lo; k <= hi; k += 1) {
        if (l > mid) {
          a[k] = buffer[r];
          r += 1;
        } else if (r > hi) {
          a[k] = buffer[l];
          l += 1;
        } else {
          comparisons += 1;
          // In the visualization snapshot, ensure unmerged items in [k..hi] reflect buffer elements
          // so comparing l and r highlights the actual candidate values
          for (let p = lo; p <= hi; p += 1) prevArr[p] = a[p];
          let fillIdx = k;
          for (let p = l; p <= mid; p += 1) a[fillIdx++] = buffer[p];
          for (let p = r; p <= hi; p += 1) a[fillIdx++] = buffer[p];
          push([k, k + (mid - l + 1)], "compare");
          for (let p = lo; p <= hi; p += 1) a[p] = prevArr[p];

          if (buffer[l] <= buffer[r]) {
            a[k] = buffer[l];
            l += 1;
          } else {
            a[k] = buffer[r];
            r += 1;
          }
        }
        writes += 1;
        push([k], "write");
      }
    };
    const sort = (lo, hi) => {
      if (lo >= hi) return;
      const mid = (lo + hi) >> 1;
      sort(lo, mid);
      sort(mid + 1, hi);
      merge(lo, mid, hi);
    };
    sort(0, n - 1);
    for (let i = 0; i < n; i += 1) sorted.add(i);
  }

  // A closing frame so the finished array is what you are left looking at.
  push([], "done");
  return { frames, comparisons, writes, truncated };
}

const OP_COLOUR = {
  compare: PALETTE.gold,
  swap: PALETTE.rose,
  write: PALETTE.violet,
  pick: PALETTE.sky,
};

function Bars({ frame, size, showValues }) {
  const activeSet = useMemo(() => new Set(frame.active), [frame.active]);
  const sortedSet = useMemo(() => new Set(frame.sorted), [frame.sorted]);
  const offset = ((size - 1) * BAR_SPACING) / 2;
  const highlight = OP_COLOUR[frame.op] ?? PALETTE.gold;

  return (
    <group>
      {frame.arr.map((value, i) => {
        const height = Math.max(value * HEIGHT_SCALE, 0.08);
        const isActive = activeSet.has(i);
        const isSorted = sortedSet.has(i);
        const colour = isActive ? highlight : isSorted ? PALETTE.emerald : PALETTE.sky;
        return (
          <group key={i} position={[i * BAR_SPACING - offset, 0, 0]}>
            <mesh position={[0, height / 2, 0]} castShadow>
              <boxGeometry args={[BAR_WIDTH, height, BAR_WIDTH]} />
              <meshStandardMaterial
                color={colour}
                emissive={colour}
                // Active bars are lifted well clear of the field so the
                // comparison being made is findable at a glance.
                emissiveIntensity={isActive ? 1.5 : isSorted ? 0.42 : 0.16}
                roughness={0.34}
                metalness={0.18}
                toneMapped={!isActive}
              />
            </mesh>
            {showValues && (
              <SceneLabel position={[0, height + 0.34, 0]} tone={isActive ? "text-duck-300" : "text-ink-400"}>
                {value}
              </SceneLabel>
            )}
          </group>
        );
      })}
    </group>
  );
}

export function SortingScene({ params = {} }) {
  const {
    algorithm = "bubble",
    size = 22,
    speed = 1.0,
    running = true,
    shuffle = 0,
    restart = 0,
    showValues = false,
    spin = false,
  } = params || {};

  const count = clamp(Math.round(size), 5, MAX_BARS);
  const values = useMemo(() => makeValues(count, shuffle), [count, shuffle]);
  const { frames, comparisons, writes, truncated } = useMemo(
    () => buildFrames(values, algorithm),
    [values, algorithm],
  );

  const [cursor, setCursor] = useState(0);
  const timer = useRef(null);

  // Any change to what is being sorted rewinds the playhead.
  useEffect(() => setCursor(0), [values, algorithm, restart]);

  useEffect(() => {
    if (!running || cursor >= frames.length - 1) return undefined;
    // Slower, clearer step pacing: 20 steps/sec at 1.0x instead of 40 steps/sec
    const fps = clamp(2 + speed * 18, 2, 90);
    timer.current = setTimeout(() => setCursor((c) => Math.min(c + 1, frames.length - 1)), 1000 / fps);
    return () => clearTimeout(timer.current);
  }, [running, cursor, frames.length, speed]);

  const frame = frames[Math.min(cursor, frames.length - 1)] ?? {
    arr: values,
    active: [],
    sorted: [],
    op: "done",
    comparisons: 0,
    writes: 0,
  };
  const done = cursor >= frames.length - 1;
  const info = ALGORITHM_META[algorithm] ?? ALGORITHM_META.bubble;

  return (
    <SceneCanvas camera={{ position: [0, 4.6, 12.5], fov: 46 }} controls={{ minDistance: 3, maxDistance: 30, autoRotate: spin, autoRotateSpeed: 0.45 * speed }}>
      <Grid
        args={[count * BAR_SPACING + 2, 6]}
        cellSize={0.46}
        cellColor="#1e2531"
        sectionSize={2.3}
        sectionColor="#2b3442"
        fadeDistance={30}
        infiniteGrid={false}
      />

      <Bars frame={frame} size={count} showValues={showValues} />

      <SceneLabel position={[0, -0.75, 0]} accent>
        {info.label} sort · {info.complexity}
      </SceneLabel>

    </SceneCanvas>
  );
}

// ─── Dispatcher ─────────────────────────────────────────────────────

export default function CSCanvas({ topicId, params, setParam, onOpenQuiz }) {
  // The tree ships its own controls, so it takes the whole viewport; the
  // sorting scene is driven by the shared HUD like every other topic.
  if (topicId === "binary_tree") return <BinaryTree3D onOpenQuiz={onOpenQuiz} />;
  if (topicId === "sorting") return <SortingScene params={params} setParam={setParam} onOpenQuiz={onOpenQuiz} />;
  return null;
}

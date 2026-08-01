"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { GitBranch, ListTree, Plus, RotateCcw, Search, Shuffle } from "lucide-react";
import { CANVAS_BG } from "@/components/visualizations/scene-kit";
import {
  HudButton,
  HudPanel,
  Slider,
  Stat,
  ViewportHint,
} from "@/components/visualizations/VisualizationHUD";

// ─── IGCSE Computer Science · Binary search tree ────────────────────
// The tree is derived from an ordered list of inserted values, so every
// operation is a pure rebuild — no mutation, no stale node references.
//
// NOTE: parked, not wired into the hub. The visualization hub's three
// categories are Physics / Chemistry / Biology, so there is no Computer
// Science tab for this to sit under. Kept so the work is not lost — add a
// fourth category in app/visualizations/page.jsx to bring it back.
// ─────────────────────────────────────────────────────────────────────

const INITIAL_VALUES = [50, 30, 70, 20, 40, 60, 80];
const MAX_NODES = 24;
const SPACING_X = 1.9;
const SPACING_Y = 2.0;
const DEPTH_Z = -0.55;

function insert(node, value) {
  if (!node) return { value, left: null, right: null };
  if (value === node.value) return node;
  if (value < node.value) return { ...node, left: insert(node.left, value) };
  return { ...node, right: insert(node.right, value) };
}

function buildTree(values) {
  return values.reduce((root, value) => insert(root, value), null);
}

/** The comparison path a search or insert walks, ending at `value` if present. */
function comparisonPath(root, value) {
  const path = [];
  let node = root;
  while (node) {
    path.push(node.value);
    if (value === node.value) break;
    node = value < node.value ? node.left : node.right;
  }
  return path;
}

function traverse(root, order) {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (order === "pre") out.push(node.value);
    walk(node.left);
    if (order === "in") out.push(node.value);
    walk(node.right);
    if (order === "post") out.push(node.value);
  };
  walk(root);
  return out;
}

/**
 * In-order index sets x, depth sets y, and depth also pushes nodes back in z
 * so the levels read as receding planes rather than a flat chart.
 */
function layoutTree(root) {
  const nodes = [];
  let column = 0;
  let maxDepth = 0;

  const walk = (node, depth, parent) => {
    if (!node) return;
    walk(node.left, depth + 1, node.value);
    maxDepth = Math.max(maxDepth, depth);
    nodes.push({ value: node.value, depth, column: column++, parent });
    walk(node.right, depth + 1, node.value);
  };
  walk(root, 0, null);

  const count = nodes.length;
  const spanX = Math.max(0, count - 1) * SPACING_X;
  const spanY = maxDepth * SPACING_Y;

  const positioned = nodes.map((n) => ({
    ...n,
    position: [
      n.column * SPACING_X - spanX / 2,
      spanY / 2 - n.depth * SPACING_Y,
      n.depth * DEPTH_Z,
    ],
  }));

  const byValue = new Map(positioned.map((n) => [n.value, n]));
  const edges = positioned
    .filter((n) => n.parent !== null)
    .map((n) => ({
      key: `${n.parent}-${n.value}`,
      from: byValue.get(n.parent).position,
      to: n.position,
      parent: n.parent,
      child: n.value,
    }));

  // One fixed camera, a scaled group: the tree always fits, however it grows.
  const scale = Math.max(
    0.4,
    Math.min(1, 13 / (spanX + 4), 9 / (spanY + 3)),
  );

  return { nodes: positioned, edges, count, height: maxDepth + 1, scale };
}

// ─── Scene pieces ───────────────────────────────────────────────────

const NODE_STYLES = {
  idle: { color: "#242931", emissive: "#101216", intensity: 0.4, ring: "#333a45" },
  visited: {
    color: "#065f46",
    emissive: "#10b981",
    intensity: 0.7,
    ring: "#10b981",
  },
  current: {
    color: "#d9a227",
    emissive: "#f0c04a",
    intensity: 2.2,
    ring: "#f0c04a",
  },
  found: {
    color: "#047857",
    emissive: "#34d399",
    intensity: 2.4,
    ring: "#34d399",
  },
  missing: {
    color: "#9f1239",
    emissive: "#fb7185",
    intensity: 2.2,
    ring: "#fb7185",
  },
  selected: {
    color: "#1e293b",
    emissive: "#38bdf8",
    intensity: 1.1,
    ring: "#38bdf8",
  },
};

const lerp = (from, to, alpha) => from + (to - from) * alpha;

function TreeNode({ node, state, labelFactor, onSelect }) {
  const mesh = useRef(null);
  const style = NODE_STYLES[state];
  const active = state === "current" || state === "found" || state === "missing";

  useFrame((frame) => {
    if (!mesh.current) return;
    const pulse = active
      ? 1.15 + Math.sin(frame.clock.elapsedTime * 6) * 0.08
      : 1;
    mesh.current.scale.setScalar(lerp(mesh.current.scale.x, pulse, 0.18));
  });

  return (
    <group position={node.position}>
      <mesh
        ref={mesh}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.value);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[0.46, 32, 32]} />
        <meshStandardMaterial
          color={style.color}
          emissive={style.emissive}
          emissiveIntensity={style.intensity}
          roughness={0.3}
          metalness={0.25}
        />
      </mesh>

      <Html center distanceFactor={labelFactor} style={{ pointerEvents: "none" }}>
        <span
          className="select-none text-[13px] font-semibold tabular-nums"
          style={{ color: state === "idle" ? "#c9cfd8" : "#0a0b0d" }}
        >
          {node.value}
        </span>
      </Html>
    </group>
  );
}

function TreeScene({ layout, nodeStates, visited, onSelect }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 9, 8]} intensity={1.5} />
      <directionalLight position={[-7, -3, -6]} intensity={0.4} color="#38bdf8" />

      <group scale={layout.scale}>
        {layout.edges.map((edge) => {
          // An edge lights up once the walk has stood on both of its ends.
          const lit = visited.has(edge.parent) && visited.has(edge.child);
          return (
            <Line
              key={edge.key}
              points={[edge.from, edge.to]}
              color={lit ? "#f0c04a" : "#333a45"}
              lineWidth={lit ? 2.6 : 1.4}
              transparent
              opacity={lit ? 0.95 : 0.55}
            />
          );
        })}

        {layout.nodes.map((node) => (
          <TreeNode
            key={node.value}
            node={node}
            state={nodeStates.get(node.value) ?? "idle"}
            labelFactor={13 * layout.scale}
            onSelect={onSelect}
          />
        ))}
      </group>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={5}
        maxDistance={32}
      />
    </>
  );
}

// ─── Viewport + HUD ─────────────────────────────────────────────────

export default function BinaryTree3D() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [insertValue, setInsertValue] = useState("45");
  const [searchValue, setSearchValue] = useState("40");
  const [selected, setSelected] = useState(null);
  const [speed, setSpeed] = useState(1);
  const [anim, setAnim] = useState(null);

  const tree = useMemo(() => buildTree(values), [values]);
  const layout = useMemo(() => layoutTree(tree), [tree]);

  // Step the running animation. `cursor` is the index of the highlighted step;
  // it stops on the last one so the result stays on screen.
  useEffect(() => {
    if (!anim || anim.cursor >= anim.steps.length - 1) return undefined;
    const id = setTimeout(
      () => setAnim((a) => (a ? { ...a, cursor: a.cursor + 1 } : a)),
      600 / speed,
    );
    return () => clearTimeout(id);
  }, [anim, speed]);

  const { nodeStates, visited } = useMemo(() => {
    const states = new Map();
    const seen = new Set();
    if (selected !== null) states.set(selected, "selected");
    if (!anim) return { nodeStates: states, visited: seen };

    const done = anim.cursor >= anim.steps.length - 1;
    anim.steps.slice(0, anim.cursor).forEach((v) => {
      states.set(v, "visited");
      seen.add(v);
    });
    const current = anim.steps[anim.cursor];
    if (current !== undefined) {
      states.set(current, done && anim.outcome ? anim.outcome : "current");
      seen.add(current);
    }
    return { nodeStates: states, visited: seen };
  }, [anim, selected]);

  const run = useCallback((label, steps, outcome = null, note = null) => {
    if (!steps.length) return;
    setAnim({ label, steps, cursor: 0, outcome, note });
  }, []);

  const handleInsert = useCallback(() => {
    const value = Number.parseInt(insertValue, 10);
    if (!Number.isFinite(value) || value < 1 || value > 99) return;
    if (values.includes(value)) {
      run(`Insert ${value}`, comparisonPath(tree, value), "missing", "already in tree");
      return;
    }
    if (values.length >= MAX_NODES) return;
    const next = [...values, value];
    setValues(next);
    setSelected(null);
    run(`Insert ${value}`, comparisonPath(buildTree(next), value), "found", "placed");
  }, [insertValue, values, tree, run]);

  const handleRandom = useCallback(() => {
    if (values.length >= MAX_NODES) return;
    const pool = Array.from({ length: 99 }, (_, i) => i + 1).filter(
      (n) => !values.includes(n),
    );
    const value = pool[Math.floor(Math.random() * pool.length)];
    setInsertValue(String(value));
    const next = [...values, value];
    setValues(next);
    setSelected(null);
    run(`Insert ${value}`, comparisonPath(buildTree(next), value), "found", "placed");
  }, [values, run]);

  const handleSearch = useCallback(() => {
    const value = Number.parseInt(searchValue, 10);
    if (!Number.isFinite(value)) return;
    const path = comparisonPath(tree, value);
    if (!path.length) return;
    const found = path[path.length - 1] === value;
    run(
      `Search ${value}`,
      path,
      found ? "found" : "missing",
      found ? `found in ${path.length} comparison${path.length > 1 ? "s" : ""}` : "not in tree",
    );
  }, [searchValue, tree, run]);

  const handleTraverse = useCallback(
    (order) => {
      const labels = { in: "In-order", pre: "Pre-order", post: "Post-order" };
      const notes = {
        in: "left → node → right, which always comes out in ascending order",
        pre: "node → left → right, used to copy a tree",
        post: "left → right → node, used to delete a tree",
      };
      run(`${labels[order]} traversal`, traverse(tree, order), "found", notes[order]);
    },
    [tree, run],
  );

  const handleReset = useCallback(() => {
    setValues(INITIAL_VALUES);
    setAnim(null);
    setSelected(null);
    setInsertValue("45");
    setSearchValue("40");
  }, []);

  const selectedNode =
    selected === null ? null : layout.nodes.find((n) => n.value === selected);
  const optimalHeight = Math.ceil(Math.log2(layout.count + 1));
  const revealed = anim ? anim.steps.slice(0, anim.cursor + 1) : [];
  const animDone = anim ? anim.cursor >= anim.steps.length - 1 : false;

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [0, 0.5, 15], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onPointerMissed={() => setSelected(null)}
      >
        <color attach="background" args={[CANVAS_BG]} />
        <TreeScene
          layout={layout}
          nodeStates={nodeStates}
          visited={visited}
          onSelect={setSelected}
        />
      </Canvas>

      {/* Controls */}
      <div className="absolute left-4 top-4 max-h-[calc(100%-2rem)] w-[236px] overflow-y-auto">
        <HudPanel title="Tree operations" icon={GitBranch}>
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-ink-500">
                Insert node (1–99)
              </p>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={insertValue}
                  onChange={(e) => setInsertValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInsert()}
                  className="w-full min-w-0 rounded-md border border-ink-700 bg-ink-850 px-2 py-1.5 text-[11px] tabular-nums text-ink-100 focus:border-duck-500/50 focus:outline-none"
                />
                <HudButton
                  icon={Plus}
                  variant="primary"
                  onClick={handleInsert}
                  disabled={values.length >= MAX_NODES}
                >
                  Insert
                </HudButton>
              </div>
              <HudButton
                icon={Shuffle}
                onClick={handleRandom}
                disabled={values.length >= MAX_NODES}
                className="mt-1.5 w-full"
              >
                Insert random value
              </HudButton>
            </div>

            <div className="border-t border-ink-800 pt-3">
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-ink-500">
                Search
              </p>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full min-w-0 rounded-md border border-ink-700 bg-ink-850 px-2 py-1.5 text-[11px] tabular-nums text-ink-100 focus:border-duck-500/50 focus:outline-none"
                />
                <HudButton icon={Search} onClick={handleSearch}>
                  Find
                </HudButton>
              </div>
            </div>

            <div className="border-t border-ink-800 pt-3">
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-ink-500">
                Traversals
              </p>
              <div className="grid grid-cols-3 gap-1">
                <HudButton icon={ListTree} onClick={() => handleTraverse("in")}>
                  In
                </HudButton>
                <HudButton onClick={() => handleTraverse("pre")}>Pre</HudButton>
                <HudButton onClick={() => handleTraverse("post")}>Post</HudButton>
              </div>
            </div>

            <div className="border-t border-ink-800 pt-3">
              <Slider
                label="Step speed"
                value={speed}
                onChange={setSpeed}
                min={0.4}
                max={2.5}
                step={0.1}
                format={(v) => `${v.toFixed(1)}×`}
              />
              <HudButton icon={RotateCcw} onClick={handleReset} className="mt-2 w-full">
                Reset tree
              </HudButton>
            </div>
          </div>
        </HudPanel>
      </div>

      {/* Live readout */}
      <div className="absolute right-4 top-4 w-[224px]">
        <HudPanel title={anim ? anim.label : "Tree state"}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <Stat label="Nodes" value={layout.count} tone="gold" />
            <Stat
              label="Height"
              value={layout.height}
              tone={layout.height <= optimalHeight ? "good" : "warn"}
              hint={`best case ${optimalHeight}`}
            />
            <Stat label="Steps taken" value={anim ? revealed.length : "—"} />
            <Stat
              label="Selected"
              value={selectedNode ? selectedNode.value : "—"}
              hint={selectedNode ? `depth ${selectedNode.depth}` : undefined}
            />
          </div>

          {anim && (
            <div className="mt-3">
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-ink-500">
                Sequence
              </p>
              <div className="flex flex-wrap gap-1">
                {revealed.map((v, i) => (
                  <span
                    key={`${v}-${i}`}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
                      i === revealed.length - 1
                        ? "bg-duck-500/20 text-duck-300"
                        : "bg-ink-800 text-ink-400"
                    }`}
                  >
                    {v}
                  </span>
                ))}
              </div>
              {animDone && anim.note && (
                <p
                  className={`mt-2 rounded-md border px-2 py-1.5 text-[10px] leading-relaxed ${
                    anim.outcome === "missing"
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  }`}
                >
                  {anim.note}
                </p>
              )}
            </div>
          )}

          <p className="mt-3 rounded-md border border-ink-700 bg-ink-850 px-2 py-1.5 text-[10px] leading-relaxed text-ink-400">
            Every comparison drops one level, so a balanced tree of {layout.count}{" "}
            nodes needs about {optimalHeight} of them.
          </p>
        </HudPanel>
      </div>

      <ViewportHint>
        drag to orbit · scroll to zoom · click a node to inspect it
      </ViewportHint>
    </div>
  );
}

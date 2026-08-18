"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html as DreiHtml, Line, OrbitControls } from "@react-three/drei";
import { ChevronDown, ChevronRight, GitBranch, Info, Lightbulb, ListTree, Plus, RotateCcw, Search, Shuffle, SlidersHorizontal, Target } from "lucide-react";
import { CANVAS_BG, WebGLCleanup } from "@/components/visualizations/scene-kit";
import {
  HudButton,
  HudPanel,
  Slider,
  Stat,
  ViewportHint,
} from "@/components/visualizations/VisualizationHUD";

// ─── IGCSE Computer Science · Binary search tree ────────────────────
// Interactive 3D Binary Search Tree (BST) visualizer for node insertion,
// searching, traversals, and tree metrics.
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
  idle: { color: "#2a3447", emissive: "#3b4963", intensity: 0.6, ring: "#475569" },
  visited: {
    color: "#059669",
    emissive: "#10b981",
    intensity: 1.0,
    ring: "#34d399",
  },
  current: {
    color: "#d97706",
    emissive: "#f59e0b",
    intensity: 2.2,
    ring: "#fbbf24",
  },
  found: {
    color: "#059669",
    emissive: "#34d399",
    intensity: 2.5,
    ring: "#6ee7b7",
  },
  missing: {
    color: "#e11d48",
    emissive: "#fb7185",
    intensity: 2.2,
    ring: "#fca5a5",
  },
  selected: {
    color: "#0284c7",
    emissive: "#38bdf8",
    intensity: 1.8,
    ring: "#7dd3fc",
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
          roughness={0.25}
          metalness={0.3}
        />
      </mesh>

      <DreiHtml center distanceFactor={labelFactor} style={{ pointerEvents: "none" }} zIndexRange={[40, 0]}>
        <span
          className="select-none text-[14px] font-extrabold tabular-nums text-white tracking-tight"
          style={{
            textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.9)",
            color: "#ffffff",
          }}
        >
          {node.value}
        </span>
      </DreiHtml>
    </group>
  );
}

function TreeScene({ layout, nodeStates, visited, onSelect }) {
  useEffect(() => {
    return () => {
      document.body.style.cursor = "auto";
    };
  }, []);

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

export default function BinaryTree3D({ onOpenQuiz }) {
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

  const [activeTab, setActiveTab] = useState("controls");
  const [keyConceptsOpen, setKeyConceptsOpen] = useState(false);

  const selectedNode =
    selected === null ? null : layout.nodes.find((n) => n.value === selected);
  const optimalHeight = Math.ceil(Math.log2(layout.count + 1));
  const revealed = anim ? anim.steps.slice(0, anim.cursor + 1) : [];
  const animDone = anim ? anim.cursor >= anim.steps.length - 1 : false;

  const BST_CONCEPTS = [
    "A Binary Search Tree (BST) maintains nodes such that every left descendant is smaller and right descendant is larger.",
    "Tree traversals visit nodes systematically: In-order (left, root, right) yields sorted order; Pre-order is used for cloning; Post-order is used for deletion.",
    "Search and insertion run in O(log n) time on balanced trees, but degrade to O(n) if the tree becomes unbalanced.",
  ];

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [0, 0.5, 15], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onPointerMissed={() => setSelected(null)}
        frameloop="always"
      >
        <WebGLCleanup />
        <color attach="background" args={[CANVAS_BG]} />
        <TreeScene
          layout={layout}
          nodeStates={nodeStates}
          visited={visited}
          onSelect={setSelected}
        />
      </Canvas>

      {/* Controls & Details Overlay */}
      <div className="absolute left-4 top-4 max-h-[calc(100%-2rem)] w-[280px] overflow-y-auto">
        <HudPanel title="Binary Search Tree 3D" icon={GitBranch}>
          {/* ─── Controls vs Details Tab Switcher ─── */}
          <div className="mb-3 flex items-center gap-1 rounded-lg border border-ink-800 bg-ink-950/60 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("controls")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all ${
                activeTab === "controls"
                  ? "border border-duck-500/40 bg-duck-500/20 text-duck-300 shadow-sm"
                  : "text-ink-400 hover:bg-ink-850 hover:text-ink-200"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Controls</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all ${
                activeTab === "details"
                  ? "border border-duck-500/40 bg-duck-500/20 text-duck-300 shadow-sm"
                  : "text-ink-400 hover:bg-ink-850 hover:text-ink-200"
              }`}
            >
              <Info className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Details</span>
            </button>
          </div>

          {activeTab === "controls" ? (
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
          ) : (
            <div className="space-y-3">
              {/* Syllabus & Overview */}
              <div className="rounded-lg border border-ink-800 bg-ink-950/50 p-2.5 space-y-1.5">
                <span className="inline-block rounded border border-duck-500/30 bg-duck-500/10 px-2 py-0.5 text-[10px] font-mono text-duck-300">
                  Computer Science 4.1 · Data Structures
                </span>
                <p className="text-xs font-medium leading-relaxed text-ink-200">
                  3D Binary Search Tree & AVL Operations — node insertion, searching & traversals
                </p>
              </div>

              {/* Key Concepts (toggle) Button & Content */}
              <div className="rounded-lg border border-ink-800 bg-ink-900/60 p-2.5">
                <button
                  type="button"
                  onClick={() => setKeyConceptsOpen(!keyConceptsOpen)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-3.5 w-3.5 shrink-0 text-duck-400" strokeWidth={2} />
                    <span className="text-xs font-semibold text-ink-100">
                      Key Concepts (toggle)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                        keyConceptsOpen
                          ? "border border-duck-500/40 bg-duck-500/20 text-duck-300"
                          : "bg-ink-800 text-ink-400"
                      }`}
                    >
                      {keyConceptsOpen ? "ON" : "OFF"}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-ink-400 transition-transform duration-200 ${
                        keyConceptsOpen ? "rotate-180 text-duck-300" : ""
                      }`}
                      strokeWidth={2}
                    />
                  </div>
                </button>

                {keyConceptsOpen && (
                  <div className="mt-3 space-y-2 border-t border-ink-800/80 pt-2.5">
                    {BST_CONCEPTS.map((concept, i) => (
                      <div key={i} className="flex gap-2">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-duck-400"
                          aria-hidden="true"
                        />
                        <p className="text-[11px] leading-relaxed text-ink-200">{concept}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tree State Readout */}
              <div className="rounded-lg border border-ink-800 bg-ink-950/50 p-2.5 space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                  {anim ? anim.label : "Tree state metrics"}
                </p>
                <div className="grid grid-cols-2 gap-2">
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
                  <div className="mt-2 border-t border-ink-800/60 pt-2">
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-ink-500">
                      Sequence
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {revealed.map((v, i) => (
                        <span
                          key={`${v}-${i}`}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
                            i === revealed.length - 1
                              ? "bg-duck-500/20 text-duck-300 border border-duck-500/30"
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
              </div>

              {/* Visual Legend Key */}
              <div className="rounded-lg border border-ink-800 bg-ink-950/60 p-2.5 space-y-2">
                <div className="border-b border-ink-800/80 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                  Visual Node Key
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#2a3447] border border-[#475569]" />
                    <div>
                      <p className="font-semibold text-ink-200">Idle Node</p>
                      <p className="text-[10px] text-ink-400">Unvisited BST node in tree structure</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#d97706] border border-[#fbbf24]" />
                    <div>
                      <p className="font-semibold text-amber-300">Active Comparison</p>
                      <p className="text-[10px] text-ink-400">Currently walking comparison node</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#059669] border border-[#34d399]" />
                    <div>
                      <p className="font-semibold text-emerald-300">Matched / Visited</p>
                      <p className="text-[10px] text-ink-400">Search hit or traversed node</p>
                    </div>
                  </div>
                </div>
              </div>

              {onOpenQuiz && (
                <button
                  type="button"
                  onClick={onOpenQuiz}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md bg-duck-400 px-3 py-2 text-[11px] font-semibold text-ink-950 transition-colors hover:bg-duck-300 shadow-md"
                >
                  <Target className="h-3.5 w-3.5" strokeWidth={2.25} />
                  Test understanding
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
              )}
            </div>
          )}
        </HudPanel>
      </div>

      <ViewportHint>
        drag to orbit · scroll to zoom · click a node to inspect it
      </ViewportHint>
    </div>
  );
}

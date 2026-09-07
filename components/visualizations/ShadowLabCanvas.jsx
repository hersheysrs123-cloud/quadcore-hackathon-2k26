"use client";

import { useCallback, useMemo, useState } from "react";
import { Grid, Line, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  Eye,
  EyeOff,
  Lightbulb,
  RotateCcw,
  RotateCw,
  Sparkles,
  Target,
} from "lucide-react";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  clamp,
} from "@/components/visualizations/scene-kit";
import {
  Choice,
  HudButton,
  HudPanel,
  Slider,
  Toggle,
} from "@/components/visualizations/VisualizationHUD";
import {
  BENCH,
  MATERIAL_OPTIONS,
  MATERIALS,
  PRESETS,
  SHAPES,
  SHAPE_LABELS,
  SOURCES,
  solveShadow,
} from "@/lib/shadowOptics";

// ─── Shadow lab ─────────────────────────────────────────────────────
// A torch, a stand and a screen on a ruled bench. Everything the child can
// move feeds `lib/shadowOptics.js`, and the shadow drawn on the screen is the
// solved geometry — not a rendered shadow map — so the picture and the ruler
// always tell the same story.
// ─────────────────────────────────────────────────────────────────────

/** World units per centimetre of bench. */
const CM = 0.062;
const cm = (v) => v * CM;
/** The bench runs along +Z; the origin sits at its midpoint. */
const zAt = (benchCm) => cm(benchCm - BENCH.max / 2);

const OBJECT_SIZE_CM = 10;
const SCREEN_HALF_CM = 34;

// ─── Bench furniture ────────────────────────────────────────────────

function Bench() {
  // Minor ticks every 10 cm, numbered every 20 so the ruler stays readable.
  const ticks = useMemo(() => {
    const out = [];
    for (let v = 0; v <= BENCH.max; v += 10) out.push({ v, major: v % 20 === 0 });
    return out;
  }, []);

  return (
    <group>
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[cm(46), 0.12, cm(BENCH.max + 12)]} />
        <meshStandardMaterial color="#252c38" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Floor ruler with printed centimetre marks. */}
      <mesh position={[cm(-19), 0.01, 0]}>
        <boxGeometry args={[cm(4.5), 0.02, cm(BENCH.max)]} />
        <meshStandardMaterial color="#e7e3d6" roughness={0.7} />
      </mesh>
      {ticks.map(({ v, major }) => (
        <group key={v} position={[cm(-19), 0.03, zAt(v)]}>
          <mesh>
            <boxGeometry args={[cm(major ? 3.6 : 2), 0.01, cm(major ? 0.5 : 0.35)]} />
            <meshBasicMaterial color={major ? "#94a2b5" : "#5b6472"} />
          </mesh>
          {/* SceneLabel rather than drei's Text: troika fetches its font data
              from a CDN at runtime, and nothing else in this app depends on
              the network to draw a scene. */}
          {major && (
            <SceneLabel position={[cm(-5.5), 0, 0]} tone="text-ink-400">
              {`${v} cm`}
            </SceneLabel>
          )}
        </group>
      ))}
    </group>
  );
}

/** Torch or tube lamp. Its emitting face is what sets the penumbra. */
function LightSource({ benchZ, source, on }) {
  const width = SOURCES[source].width;
  const broad = source === "broad";
  return (
    <group position={[0, cm(13), zAt(benchZ)]}>
      {broad ? (
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[cm(2.4), cm(2.4), cm(width), 20]} />
          <meshStandardMaterial
            color="#fdf6d8"
            emissive="#ffe9a8"
            emissiveIntensity={on ? 2.4 : 0.1}
            toneMapped={false}
          />
        </mesh>
      ) : (
        <group>
          <mesh position={[0, 0, cm(-4)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[cm(3), cm(3.4), cm(9), 20]} />
            <meshStandardMaterial color="#3b4453" roughness={0.5} metalness={0.6} />
          </mesh>
          <mesh>
            <sphereGeometry args={[cm(width), 16, 16]} />
            <meshStandardMaterial
              color="#fffbe8"
              emissive="#ffe9a8"
              emissiveIntensity={on ? 3 : 0.1}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}
      {on && <pointLight intensity={broad ? 9 : 7} distance={cm(240)} color="#fff3cf" />}
      <SceneLabel position={[0, cm(7), 0]} accent>
        {SOURCES[source].label}
      </SceneLabel>
    </group>
  );
}

/**
 * The object on its pedestal.
 *
 * `rotation` turns it about the horizontal axis across the bench, which is
 * what swaps a cylinder's rectangle for a circle.
 */
function TestObject({ shape, rotation, material, benchZ }) {
  const m = MATERIALS[material];
  const size = cm(OBJECT_SIZE_CM);

  const surface = (
    <meshPhysicalMaterial
      color={material === "opaque" ? "#8a5a3b" : material === "translucent" ? "#cfe6f2" : "#dff2ff"}
      roughness={material === "opaque" ? 0.8 : 0.15}
      metalness={0}
      transmission={m.transmission}
      thickness={material === "opaque" ? 0 : 1.2}
      transparent={m.transmission > 0}
      opacity={material === "transparent" ? 0.22 : material === "translucent" ? 0.62 : 1}
      ior={1.45}
    />
  );

  const body = () => {
    switch (shape) {
      case "cube":
        return (
          <RoundedBox args={[size, size, size]} radius={cm(0.4)} smoothness={3}>
            {surface}
          </RoundedBox>
        );
      case "cone":
        return (
          <mesh>
            <coneGeometry args={[size * 0.62, size * 1.1, 36]} />
            {surface}
          </mesh>
        );
      case "sphere":
        return (
          <mesh>
            <sphereGeometry args={[size / 2, 32, 32]} />
            {surface}
          </mesh>
        );
      case "letterT":
      case "letterL":
        return <LetterSolid letter={shape === "letterT" ? "T" : "L"} size={size} surface={surface} />;
      case "cylinder":
      default:
        return (
          <mesh>
            <cylinderGeometry args={[size * 0.55, size * 0.55, size * 1.2, 36]} />
            {surface}
          </mesh>
        );
    }
  };

  return (
    <group position={[0, cm(13), zAt(benchZ)]}>
      {/* Pedestal. */}
      <mesh position={[0, cm(-9), 0]}>
        <cylinderGeometry args={[cm(4.4), cm(5.4), cm(6), 24]} />
        <meshStandardMaterial color="#39414f" roughness={0.6} metalness={0.35} />
      </mesh>
      <group rotation={[rotation, 0, 0]}>{body()}</group>
    </group>
  );
}

/** Extruded block letters, built from bars so their silhouette is unmistakable. */
function LetterSolid({ letter, size, surface }) {
  const bar = size * 0.24;
  const bars =
    letter === "T"
      ? [
          { pos: [0, size * 0.38, 0], args: [size * 0.85, bar, bar] },
          { pos: [0, -size * 0.06, 0], args: [bar, size * 0.9, bar] },
        ]
      : [
          { pos: [-size * 0.22, 0, 0], args: [bar, size, bar] },
          { pos: [size * 0.08, -size * 0.38, 0], args: [size * 0.7, bar, bar] },
        ];
  return (
    <group>
      {bars.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <boxGeometry args={b.args} />
          {surface}
        </mesh>
      ))}
    </group>
  );
}

/**
 * The projection screen, with the shadow painted straight onto it.
 *
 * The umbra and penumbra are drawn as two nested shapes whose sizes come from
 * `solveShadow`, so what the child measures on screen is exactly the number
 * the readout prints.
 */
function ProjectionScreen({ benchZ, solved, curtain, letter }) {
  const { horizontal, vertical, darkness, outline, castsShadow } = solved;

  const shadowNode = (halfW, halfH, opacity, key) => {
    const w = cm(halfW * 2);
    const h = cm(halfH * 2);
    const paint = <meshBasicMaterial color="#05070b" transparent opacity={opacity} />;

    if (outline.kind === "circle") {
      return (
        <mesh key={key} position={[0, 0, cm(0.25)]}>
          <circleGeometry args={[Math.max(w, h) / 2, 48]} />
          {paint}
        </mesh>
      );
    }

    if (outline.kind === "triangle") {
      // A cone's silhouette is a triangle whichever way it is spun.
      return (
        <mesh key={key} position={[0, 0, cm(0.25)]} rotation={[0, 0, Math.PI]}>
          <circleGeometry args={[Math.max(w, h) / 2, 3]} />
          {paint}
        </mesh>
      );
    }

    if (outline.kind === "letter") {
      // The whole point of the letter shelf is that the shadow is legible, so
      // it is drawn from the same two bars the solid is built from.
      const bars =
        letter === "T"
          ? [
              { pos: [0, h * 0.38, 0], size: [w * 0.85, h * 0.24] },
              { pos: [0, -h * 0.06, 0], size: [w * 0.24, h * 0.9] },
            ]
          : [
              { pos: [-w * 0.22, 0, 0], size: [w * 0.24, h] },
              { pos: [w * 0.08, -h * 0.38, 0], size: [w * 0.7, h * 0.24] },
            ];
      return (
        <group key={key} position={[0, 0, cm(0.25)]}>
          {bars.map((b, i) => (
            <mesh key={i} position={b.pos}>
              <planeGeometry args={b.size} />
              <meshBasicMaterial color="#05070b" transparent opacity={opacity} />
            </mesh>
          ))}
        </group>
      );
    }

    return (
      <mesh key={key} position={[0, 0, cm(0.25)]}>
        <planeGeometry args={[w, h]} />
        {paint}
      </mesh>
    );
  };

  return (
    <group position={[0, cm(13), zAt(benchZ)]}>
      <mesh position={[0, cm(-3), 0]}>
        <planeGeometry args={[cm(SCREEN_HALF_CM * 2), cm(SCREEN_HALF_CM * 1.7)]} />
        <meshStandardMaterial color="#f7f6f1" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>

      {/* Centred on the beam axis, not on the screen panel: the lamp, the
          object and therefore the shadow all sit at the same height, and
          offsetting this group put the silhouette below the rays drawing it. */}
      {!curtain && castsShadow && (
        <group position={[0, 0, 0]}>
          {/* Penumbra first, then the darker umbra on top of it. */}
          {horizontal.penumbraWidth > 0.01 &&
            shadowNode(horizontal.penumbra, vertical.penumbra, darkness * 0.35, "pen")}
          {horizontal.umbra > 0 && shadowNode(horizontal.umbra, vertical.umbra, darkness * 0.92, "umb")}
          {horizontal.penumbraWidth <= 0.01 &&
            shadowNode(horizontal.penumbra, vertical.penumbra, darkness * 0.92, "sharp")}
        </group>
      )}

      {curtain && (
        <mesh position={[0, cm(-3), cm(0.6)]}>
          <planeGeometry args={[cm(SCREEN_HALF_CM * 2), cm(SCREEN_HALF_CM * 1.7)]} />
          <meshStandardMaterial color="#6d3f8f" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Stand. */}
      <mesh position={[0, cm(-24), 0]}>
        <boxGeometry args={[cm(24), cm(1.4), cm(2)]} />
        <meshStandardMaterial color="#39414f" roughness={0.6} />
      </mesh>

      <SceneLabel position={[0, cm(27), 0]} tone="text-ink-300">
        {curtain ? "screen hidden — make your prediction!" : "projection screen"}
      </SceneLabel>
    </group>
  );
}

/**
 * The rays themselves — the point of the whole lab.
 *
 * Each one is a single straight segment from the lamp, grazing an edge of the
 * object, continuing to the screen. They are drawn as ONE unbroken line
 * precisely so a child can see there is no bend at the object.
 */
function LightRays({ lightZ, objectZ, screenZ, solved, visible }) {
  const rays = useMemo(() => {
    if (!visible) return [];
    const { outline, sourceWidth } = solved;
    const lightY = cm(13);
    const out = [];
    const t = (screenZ - lightZ) / Math.max(objectZ - lightZ, 0.1);
    const edges = [
      [outline.halfWidth, 0],
      [-outline.halfWidth, 0],
      [0, outline.halfHeight],
      [0, -outline.halfHeight],
    ];

    // Rays leave the lamp's two EDGES, not its centre. Drawing them from the
    // centre gave the geometric shadow only, which is narrower than the
    // penumbra the readout reports — and it hid the very mechanism that makes
    // a wide lamp blur the border in the first place.
    const halfSource = sourceWidth / 2;
    for (const [ex, ey] of edges) {
      for (const sx of [-halfSource, halfSource]) {
        // Offset the source point along whichever axis this edge lies on.
        const sourceX = ex !== 0 ? sx : 0;
        const sourceY = ey !== 0 ? sx : 0;
        const landX = sourceX + (ex - sourceX) * t;
        const landY = sourceY + (ey - sourceY) * t;
        out.push({
          points: [
            [cm(sourceX), lightY + cm(sourceY), zAt(lightZ)],
            [cm(ex), lightY + cm(ey), zAt(objectZ)],
            [cm(landX), lightY + cm(landY), zAt(screenZ)],
          ],
          colour: ex !== 0 ? PALETTE.gold : PALETTE.sky,
        });
        // A pinpoint source's two edge rays sit on top of each other.
        if (halfSource < 0.15) break;
      }
    }

    // The undeviated central ray, straight down the axis.
    out.push({
      points: [
        [0, lightY, zAt(lightZ)],
        [0, lightY, zAt(screenZ)],
      ],
      colour: PALETTE.emerald,
    });
    return out;
  }, [lightZ, objectZ, screenZ, solved, visible]);

  return (
    <group>
      {rays.map((ray, i) => (
        <Line key={i} points={ray.points} color={ray.colour} lineWidth={2.2} transparent opacity={0.9} />
      ))}
    </group>
  );
}

// ─── Predict-the-shadow game ────────────────────────────────────────

const GUESSES = [
  { value: "bigger", label: "Bigger" },
  { value: "same", label: "About the same" },
  { value: "smaller", label: "Smaller" },
];

/**
 * Marks a prediction against the geometry rather than against a stored answer,
 * so the game stays honest no matter what the child changed in between.
 */
function judgeGuess(guess, before, after) {
  const ratio = after / Math.max(before, 1e-6);
  const truth = ratio > 1.05 ? "bigger" : ratio < 0.95 ? "smaller" : "same";
  return { truth, correct: guess === truth, ratio };
}

// ─── The scene ──────────────────────────────────────────────────────

export default function ShadowLabCanvas({ onOpenQuiz }) {
  const [lightZ, setLightZ] = useState(BENCH.lightHome);
  const [objectZ, setObjectZ] = useState(BENCH.objectHome);
  const [screenZ, setScreenZ] = useState(BENCH.screenHome);
  const [shape, setShape] = useState("cylinder");
  const [rotationDeg, setRotationDeg] = useState(0);
  const [material, setMaterial] = useState("opaque");
  const [source, setSource] = useState("point");
  const [showRays, setShowRays] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [game, setGame] = useState(null);

  const rotation = (rotationDeg * Math.PI) / 180;

  const solved = useMemo(
    () => solveShadow({ lightZ, objectZ, screenZ, shape, rotation, material, source, size: OBJECT_SIZE_CM }),
    [lightZ, objectZ, screenZ, shape, rotation, material, source],
  );

  // The bench must stay in order: lamp behind the object, screen in front.
  const setLight = useCallback((v) => setLightZ(clamp(v, BENCH.min, objectZ - 5)), [objectZ]);
  const setObject = useCallback(
    (v) => setObjectZ(clamp(v, lightZ + 5, screenZ - 5)),
    [lightZ, screenZ],
  );
  const setScreen = useCallback((v) => setScreenZ(clamp(v, objectZ + 5, BENCH.max)), [objectZ]);

  const reset = useCallback(() => {
    setLightZ(BENCH.lightHome);
    setObjectZ(BENCH.objectHome);
    setScreenZ(BENCH.screenHome);
    setShape("cylinder");
    setRotationDeg(0);
    setMaterial("opaque");
    setSource("point");
    setShowRays(true);
    setGame(null);
  }, []);

  const applyPreset = useCallback((key) => {
    const preset = PRESETS[key];
    if (preset.lightZ !== undefined) setLightZ(preset.lightZ);
    if (preset.objectZ !== undefined) setObjectZ(preset.objectZ);
    if (preset.screenZ !== undefined) setScreenZ(preset.screenZ);
    if (preset.shape) setShape(preset.shape);
    if (preset.rotation !== undefined) setRotationDeg(Math.round((preset.rotation * 180) / Math.PI));
  }, []);

  const startGame = useCallback(() => {
    setGame({ stage: "predict", startWidth: solved.shadowWidthCm, guess: null, result: null });
  }, [solved.shadowWidthCm]);

  const submitGuess = useCallback(
    (guess) => {
      setGame((g) =>
        g ? { ...g, stage: "revealed", guess, result: judgeGuess(guess, g.startWidth, solved.shadowWidthCm) } : g,
      );
    },
    [solved.shadowWidthCm],
  );

  const curtain = game?.stage === "predict";

  return (
    <div className="relative h-full w-full bg-ink-950">
      <SceneCanvas
        camera={{ position: [cm(70), cm(46), cm(76)], fov: 42 }}
        controls={{ minDistance: 2, maxDistance: 18, target: [0, cm(10), 0] }}
        lights={{ ambient: 0.34, keyLight: 0.35 }}
      >
        <Grid
          position={[0, 0.001, 0]}
          args={[cm(60), cm(BENCH.max + 20)]}
          cellSize={cm(10)}
          cellColor="#1e2531"
          sectionSize={cm(50)}
          sectionColor="#2b3442"
          fadeDistance={26}
          infiniteGrid={false}
        />
        <Bench />
        <LightSource benchZ={lightZ} source={source} on />
        <TestObject shape={shape} rotation={rotation} material={material} benchZ={objectZ} />
        <ProjectionScreen
          benchZ={screenZ}
          solved={solved}
          curtain={curtain}
          letter={shape === "letterT" ? "T" : "L"}
        />
        <LightRays
          lightZ={lightZ}
          objectZ={objectZ}
          screenZ={screenZ}
          solved={solved}
          visible={showRays && !curtain}
        />

        <SceneLegend
          corner="top-right"
          title="What to look for"
          items={[
            { color: PALETTE.gold, shape: "line", label: "Edge rays", note: "dead straight — they never bend round the object" },
            { color: PALETTE.emerald, shape: "line", label: "Centre ray", note: "straight through the middle" },
            { color: "#05070b", shape: "square", label: "Umbra", note: solved.horizontal.umbraLost ? "gone — the lamp is too wide" : "no light reaches here at all" },
            ...(solved.horizontal.penumbraWidth > 0.01
              ? [{ color: "#4a4f5c", shape: "square", label: "Penumbra", note: `fuzzy edge, ${solved.horizontal.penumbraWidth.toFixed(1)} cm wide` }]
              : []),
            { color: "#f7f6f1", shape: "square", label: "Screen", note: `shadow is ${solved.magnification.toFixed(2)}× life size` },
          ]}
        />
      </SceneCanvas>

      {/* ─── Controls ─────────────────────────────────────── */}
      {!panelOpen ? (
        <div className="pointer-events-auto absolute left-4 top-4 z-20">
          <HudButton icon={Lightbulb} onClick={() => setPanelOpen(true)}>
            Controls
          </HudButton>
        </div>
      ) : (
        <div
          onWheel={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute left-4 top-4 z-20 flex max-h-[calc(100%-2rem)] w-[288px] flex-col gap-3 overflow-y-auto pr-0.5"
        >
          <HudPanel
            title="Shadow lab"
            icon={Lightbulb}
            action={
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                aria-label="Hide controls"
                className="shrink-0 rounded p-0.5 text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
              >
                ✕
              </button>
            }
          >
            <div className="space-y-3">
              <Slider
                label="🔦 Torch position"
                value={lightZ}
                onChange={setLight}
                min={BENCH.min}
                max={BENCH.max - 10}
                step={1}
                format={(v) => `${v} cm`}
              />
              <Slider
                label="🧊 Object position"
                value={objectZ}
                onChange={setObject}
                min={BENCH.min + 5}
                max={BENCH.max - 5}
                step={1}
                format={(v) => `${v} cm`}
              />
              <Slider
                label="⬜ Screen position"
                value={screenZ}
                onChange={setScreen}
                min={BENCH.min + 10}
                max={BENCH.max}
                step={1}
                format={(v) => `${v} cm`}
              />

              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-ink-500">Shape on the stand</p>
                <Choice
                  options={SHAPES.map((s) => ({ value: s, label: SHAPE_LABELS[s] }))}
                  value={shape}
                  onChange={setShape}
                  columns={3}
                />
              </div>

              <Slider
                label="Turn the shape"
                value={rotationDeg}
                onChange={setRotationDeg}
                min={0}
                max={360}
                step={5}
                format={(v) => `${v}°`}
              />

              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-ink-500">What is it made of?</p>
                <Choice options={MATERIAL_OPTIONS} value={material} onChange={setMaterial} columns={3} />
              </div>

              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-ink-500">Kind of lamp</p>
                <Choice
                  options={Object.entries(SOURCES).map(([value, s]) => ({ value, label: s.label }))}
                  value={source}
                  onChange={setSource}
                  columns={2}
                />
              </div>

              <Toggle label="Show light rays" checked={showRays} onChange={setShowRays} />

              <div className="grid grid-cols-1 gap-1 border-t border-ink-800 pt-2.5">
                {Object.entries(PRESETS).map(([key, preset]) => (
                  <HudButton key={key} icon={key === "circle" ? RotateCw : Sparkles} onClick={() => applyPreset(key)}>
                    {preset.label}
                  </HudButton>
                ))}
                <HudButton icon={RotateCcw} onClick={reset}>
                  Reset the bench
                </HudButton>
                {onOpenQuiz && (
                  <HudButton icon={Target} variant="primary" onClick={onOpenQuiz}>
                    Test understanding
                  </HudButton>
                )}
              </div>
            </div>
          </HudPanel>

          {/* ─── What is happening ────────────────────── */}
          <HudPanel title="What the shadow is doing" icon={Eye}>
            <div className="space-y-2 text-[11px] leading-relaxed">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-ink-400">Shadow size</span>
                <span className="font-mono font-semibold text-duck-300">
                  {solved.castsShadow ? `${solved.shadowWidthCm.toFixed(1)} × ${solved.shadowHeightCm.toFixed(1)} cm` : "none"}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-ink-400">Times bigger</span>
                <span className="font-mono font-semibold text-duck-300">{solved.magnification.toFixed(2)}×</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-ink-400">Torch → object</span>
                <span className="font-mono text-ink-200">{solved.lightToObject.toFixed(0)} cm</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-ink-400">Object → screen</span>
                <span className="font-mono text-ink-200">{solved.objectToScreen.toFixed(0)} cm</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-ink-400">Fuzzy edge</span>
                <span className="font-mono text-ink-200">
                  {solved.horizontal.penumbraWidth < 0.05 ? "sharp" : `${solved.horizontal.penumbraWidth.toFixed(1)} cm`}
                </span>
              </div>

              <p className="rounded border border-ink-700 bg-ink-850 px-2 py-1.5 text-[10.5px] text-ink-300">
                {!solved.castsShadow
                  ? "Light goes almost straight through, so there is hardly any shadow to see. Transparent things do not block light."
                  : material === "translucent"
                    ? "Some light gets through, so the shadow is pale and grey instead of black — the object blocks only part of the light."
                    : solved.horizontal.umbraLost
                      ? "The lamp is so wide that every part of the shadow can still see a bit of it. There is no fully dark middle left — only a fuzzy penumbra."
                      : `The shadow is a ${solved.outline.description}. Move the torch closer to make it bigger, or slide the screen nearer to make it smaller.`}
              </p>
            </div>
          </HudPanel>

          {/* ─── Predict the shadow ───────────────────── */}
          <HudPanel title="Predict the shadow" icon={game ? EyeOff : Eye}>
            {!game ? (
              <>
                <p className="mb-2 text-[10.5px] leading-relaxed text-ink-400">
                  Hide the screen, change something, then guess what happened to the shadow.
                </p>
                <HudButton variant="primary" onClick={startGame} className="w-full">
                  Cover the screen
                </HudButton>
              </>
            ) : game.stage === "predict" ? (
              <>
                <p className="mb-2 text-[10.5px] leading-relaxed text-ink-400">
                  The screen is covered. Move the torch, the object or the screen — then predict: is the shadow now
                  bigger, smaller, or about the same?
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {GUESSES.map((g) => (
                    <HudButton key={g.value} onClick={() => submitGuess(g.value)}>
                      {g.label}
                    </HudButton>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p
                  className={`mb-2 rounded-md border px-2 py-1.5 text-[11px] font-medium ${
                    game.result.correct
                      ? "border-emerald-500/45 bg-emerald-500/12 text-emerald-300"
                      : "border-rose-500/45 bg-rose-500/12 text-rose-300"
                  }`}
                >
                  {game.result.correct ? "Correct!" : `Not quite — it got ${game.result.truth}.`}
                </p>
                <p className="mb-2 text-[10.5px] leading-relaxed text-ink-400">
                  The shadow went from {game.startWidth.toFixed(1)} cm to {solved.shadowWidthCm.toFixed(1)} cm —
                  that is {game.result.ratio.toFixed(2)}× the size it was.
                </p>
                <HudButton variant="primary" onClick={startGame} className="w-full">
                  Play again
                </HudButton>
              </>
            )}
          </HudPanel>
        </div>
      )}
    </div>
  );
}

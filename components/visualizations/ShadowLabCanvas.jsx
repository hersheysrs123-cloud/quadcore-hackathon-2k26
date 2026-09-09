"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  Eye,
  EyeOff,
  Lightbulb,
  Ruler,
  RotateCcw,
  RotateCw,
  Sparkles,
  Target,
} from "lucide-react";
import {
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
  SCENE,
  SHAPES,
  SHAPE_LABELS,
  SOURCES,
  silhouette,
  shadowFitsScreen,
  solveShadow,
} from "@/lib/shadowOptics";

// ─── Shadow lab ─────────────────────────────────────────────────────
// A torch, a stand and a screen on a ruled bench. Everything the child can
// move feeds `lib/shadowOptics.js`, and the shadow is PAINTED ONTO the screen
// as a texture rather than floated in front of it as a second mesh — so it is
// clipped by the screen's edges, visible from either side, and cannot drift
// off the surface it is supposed to be landing on.
// ─────────────────────────────────────────────────────────────────────

/** World units per centimetre of bench. */
const CM = 0.062;
const cm = (v) => v * CM;
/** The bench runs along +Z; the origin sits at its midpoint. */
const zAt = (benchCm) => cm(benchCm - BENCH.max / 2);

const OBJECT_SIZE_CM = 10;
/** Height of the optical axis above the bench: lamp, object and screen centre. */
const AXIS_CM = SCENE.axisHeightCm;
/** The screen panel, in centimetres. Its centre sits on the optical axis. */
const SCREEN = { halfW: SCENE.screenHalfWidthCm, halfH: SCENE.screenHalfHeightCm };

// ─── The shadow, drawn onto the screen ──────────────────────────────

const PX_PER_CM = 8;
const TEX_W = Math.round(SCREEN.halfW * 2 * PX_PER_CM);
const TEX_H = Math.round(SCREEN.halfH * 2 * PX_PER_CM);

const SCREEN_LIT = [252, 250, 244];
const SCREEN_DIM = [38, 41, 48];

/** Screen paper, dimmed toward `f` = 0 where little light lands. */
function litPaper(f) {
  const t = 0.2 + 0.8 * clamp(f, 0, 1);
  const c = SCREEN_LIT.map((hi, i) => Math.round(SCREEN_DIM[i] + (hi - SCREEN_DIM[i]) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/**
 * Block-letter bars as fractions of the silhouette's full width and height.
 *
 * ONE table drives both the extruded solid and the shadow painted on the
 * screen, which is the only way the two can be guaranteed to agree. `x` runs
 * to the right AS THE DEFAULT CAMERA SEES IT — that camera looks down the
 * bench in +Z, so screen-right is −X in world terms and both consumers negate
 * it. Without that the letters read back-to-front.
 */
const LETTER_BARS = {
  T: [
    { x: 0, y: 0.38, w: 0.85, h: 0.24 },
    { x: 0, y: -0.06, w: 0.24, h: 0.9 },
  ],
  L: [
    { x: 0.22, y: 0, w: 0.24, h: 1 },
    { x: -0.08, y: -0.38, w: 0.7, h: 0.24 },
  ],
};

/** The silhouette as a 2D path, centred on the origin, canvas y pointing down. */
function silhouettePath(ctx, kind, letter, halfW, halfH) {
  const W = halfW * 2;
  const H = halfH * 2;
  switch (kind) {
    case "circle":
      ctx.ellipse(0, 0, halfW, halfH, 0, 0, Math.PI * 2);
      return;
    case "triangle":
      // A cone's outline: apex up, matching the solid on the pedestal.
      ctx.moveTo(0, -halfH);
      ctx.lineTo(halfW, halfH);
      ctx.lineTo(-halfW, halfH);
      ctx.closePath();
      return;
    case "capsule": {
      const r = Math.min(halfW, halfH) * 0.85;
      if (ctx.roundRect) ctx.roundRect(-halfW, -halfH, W, H, r);
      else ctx.rect(-halfW, -halfH, W, H);
      return;
    }
    case "letter":
      for (const b of LETTER_BARS[letter] ?? LETTER_BARS.T) {
        ctx.rect(-b.x * W - (b.w * W) / 2, -b.y * H - (b.h * H) / 2, b.w * W, b.h * H);
      }
      return;
    default:
      ctx.rect(-halfW, -halfH, W, H);
  }
}

/**
 * Repaint the screen: illumination, ruled grid, then the shadow itself.
 *
 * The shadow is the geometric silhouette at magnification M, blurred by the
 * source. That blur is not decoration — convolving the outline with the shape
 * of the lamp IS how a penumbra arises, so a wide lamp softens the border and,
 * once it is wide enough, lifts the middle out of full darkness on its own,
 * exactly where `solveShadow` reports the umbra has been lost.
 */
function paintScreen(canvas, solved, letter, guides) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { horizontal, vertical, outline, darkness, magnification, lightToScreen } = solved;
  const cx = TEX_W / 2;
  const cy = TEX_H / 2;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.clearRect(0, 0, TEX_W, TEX_H);

  // ── Illumination. Falls off as 1/d² with the throw, and as cos³θ across
  //    the panel, so the middle of the screen is visibly the brightest part.
  const d = Math.max(lightToScreen, 1);
  const throwFactor = clamp((78 * 78) / (d * d), 0.4, 1);
  const maxR = Math.hypot(SCREEN.halfW, SCREEN.halfH);
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * PX_PER_CM);
  for (let i = 0; i <= 8; i += 1) {
    const t = i / 8;
    const cos = d / Math.hypot(d, t * maxR);
    grad.addColorStop(t, litPaper(throwFactor * cos * cos * cos));
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // ── Ruled 10 cm grid, so the shadow can actually be measured.
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(96,110,132,0.30)";
  ctx.beginPath();
  for (let x = -30; x <= 30; x += 10) {
    ctx.moveTo(cx + x * PX_PER_CM, 0);
    ctx.lineTo(cx + x * PX_PER_CM, TEX_H);
  }
  for (let y = -20; y <= 20; y += 10) {
    ctx.moveTo(0, cy + y * PX_PER_CM);
    ctx.lineTo(TEX_W, cy + y * PX_PER_CM);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(96,110,132,0.55)";
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, TEX_H);
  ctx.moveTo(0, cy);
  ctx.lineTo(TEX_W, cy);
  ctx.stroke();

  // ── The shadow.
  const halfW = outline.halfWidth * magnification * PX_PER_CM;
  const halfH = outline.halfHeight * magnification * PX_PER_CM;
  // σ = half the fuzzy band, so the transition runs from the umbra edge out to
  // the penumbra edge — the two numbers the readout prints.
  const blurPx = clamp((horizontal.penumbraWidth / 4) * PX_PER_CM, 0, 90);

  ctx.save();
  ctx.translate(cx, cy);
  if (blurPx > 0.4) ctx.filter = `blur(${blurPx.toFixed(2)}px)`;
  ctx.fillStyle = `rgba(6,8,13,${clamp(darkness, 0, 1).toFixed(3)})`;
  ctx.beginPath();
  silhouettePath(ctx, outline.kind, letter, halfW, halfH);
  ctx.fill();
  ctx.filter = "none";

  // ── Measuring guides: where full darkness ends and where any shadow at all
  //    ends. Only worth drawing once the two are actually distinguishable.
  if (guides && horizontal.penumbraWidth > 0.4) {
    ctx.setLineDash([7, 6]);
    ctx.lineWidth = 1.6;
    for (const [band, colour] of [
      [{ w: horizontal.umbra, h: vertical.umbra }, "rgba(251,191,36,0.85)"],
      [{ w: horizontal.penumbra, h: vertical.penumbra }, "rgba(56,189,248,0.8)"],
    ]) {
      if (band.w <= 0.05) continue;
      ctx.strokeStyle = colour;
      ctx.beginPath();
      silhouettePath(ctx, outline.kind, letter, band.w * PX_PER_CM, band.h * PX_PER_CM);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/**
 * The screen's paper as a live canvas, shared by the 3D panel and the HUD
 * preview. One element, one repaint — the inset cannot disagree with the
 * scene because it IS the scene's texture.
 */
function useScreenCanvas(solved, letter, guides) {
  const canvas = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = TEX_W;
    c.height = TEX_H;
    return c;
  }, []);

  const texture = useMemo(() => {
    if (!canvas) return null;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);

  useEffect(() => () => texture?.dispose(), [texture]);

  useEffect(() => {
    if (!canvas) return;
    paintScreen(canvas, solved, letter, guides);
    if (texture) texture.needsUpdate = true;
  }, [canvas, texture, solved, letter, guides]);

  return { canvas, texture };
}

// ─── Bench furniture ────────────────────────────────────────────────

function Bench() {
  return (
    <group>
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[cm(52), 0.12, cm(BENCH.max + 14)]} />
        <meshStandardMaterial color="#252c38" roughness={0.85} metalness={0.05} />
      </mesh>
    </group>
  );
}

/**
 * The post that carries a piece of apparatus up to the optical axis.
 *
 * `top` is where the post stops, relative to the axis — a solid sits on its
 * post rather than being skewered by it, so the post has to end at the bottom
 * of whatever it is holding and still reach all the way down to the bench.
 */
function Post({ height, radius = 1.5, top = 0 }) {
  return (
    <group>
      <mesh position={[0, cm(top - height / 2), 0]}>
        <cylinderGeometry args={[cm(radius), cm(radius), cm(height), 16]} />
        <meshStandardMaterial color="#39414f" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, cm(top - height + 0.7), 0]}>
        <cylinderGeometry args={[cm(5.2), cm(6), cm(1.4), 24]} />
        <meshStandardMaterial color="#2c3340" roughness={0.7} metalness={0.3} />
      </mesh>
    </group>
  );
}

/** Torch or tube lamp. Its emitting face is what sets the penumbra. */
function LightSource({ benchZ, source, on }) {
  const width = SOURCES[source].width;
  const broad = source === "broad";
  return (
    <group position={[0, cm(AXIS_CM), zAt(benchZ)]}>
      <Post height={AXIS_CM} />
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
          <mesh position={[0, 0, cm(-7)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[cm(3), cm(3.4), cm(9), 20]} />
            <meshStandardMaterial color="#3b4453" roughness={0.5} metalness={0.6} />
          </mesh>
          {/* Reflector, opening toward the bench. */}
          <mesh position={[0, 0, cm(-1.6)]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[cm(3.4), cm(3.6), 20, 1, true]} />
            <meshStandardMaterial
              color="#8d9aad"
              roughness={0.25}
              metalness={0.8}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* The filament, drawn oversize on purpose: a true 2 mm source is
              invisible at this scale, and the rays still leave from the width
              the optics module reports, not from what is drawn here. */}
          <mesh>
            <sphereGeometry args={[cm(Math.max(width, 1.2)), 16, 16]} />
            <meshStandardMaterial
              color="#fffbe8"
              emissive="#ffe9a8"
              emissiveIntensity={on ? 3 : 0.1}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}
      {on && <pointLight intensity={broad ? 9 : 7} distance={cm(260)} color="#fff3cf" />}
      <SceneLabel position={[0, cm(8), 0]} accent>
        {SOURCES[source].label}
      </SceneLabel>
    </group>
  );
}

/**
 * Which axis a turn of the slider spins each solid about.
 *
 * Not one axis for everything: the outline that `silhouette()` computes is the
 * outline of the turn that actually CHANGES the shadow. Tipping the rod toward
 * the screen is what turns it into a disc; spinning the cube about the upright
 * is what presents its diagonal. A cone spun about its own axis keeps the same
 * triangle, which is the point the lab makes about it.
 */
const TIP_AXIS = { cylinder: "x" };

/** The object on its pedestal, sized from the very silhouette that is cast. */
function TestObject({ shape, rotation, material, benchZ }) {
  const m = MATERIALS[material];
  // Driving the mesh from `silhouette()` is what stops the solid and its
  // shadow disagreeing: the drawn cylinder used to be twice as wide as the
  // outline the optics module was projecting.
  const sil = useMemo(() => silhouette(shape, 0, OBJECT_SIZE_CM), [shape]);
  const halfW = cm(sil.halfWidth);
  const halfH = cm(sil.halfHeight);
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
          <RoundedBox args={[halfW * 2, halfH * 2, halfW * 2]} radius={cm(0.4)} smoothness={3}>
            {surface}
          </RoundedBox>
        );
      case "cone":
        return (
          <mesh>
            <coneGeometry args={[halfW, halfH * 2, 40]} />
            {surface}
          </mesh>
        );
      case "sphere":
        return (
          <mesh>
            <sphereGeometry args={[halfW, 32, 32]} />
            {surface}
          </mesh>
        );
      case "letterT":
      case "letterL":
        return (
          <LetterSolid
            letter={shape === "letterT" ? "T" : "L"}
            halfW={halfW}
            halfH={halfH}
            depth={size * 0.22}
            surface={surface}
          />
        );
      case "cylinder":
      default:
        return (
          <mesh>
            <cylinderGeometry args={[halfW, halfW, halfH * 2, 40]} />
            {surface}
          </mesh>
        );
    }
  };

  const turn = TIP_AXIS[shape] === "x" ? [rotation, 0, 0] : [0, rotation, 0];

  return (
    <group position={[0, cm(AXIS_CM), zAt(benchZ)]}>
      <Post height={AXIS_CM - sil.halfHeight} top={-sil.halfHeight} radius={1.3} />
      <group rotation={turn}>{body()}</group>
    </group>
  );
}

/** Extruded block letters, built from the same bars the shadow is drawn from. */
function LetterSolid({ letter, halfW, halfH, depth, surface }) {
  const W = halfW * 2;
  const H = halfH * 2;
  return (
    <group>
      {(LETTER_BARS[letter] ?? LETTER_BARS.T).map((b, i) => (
        <mesh key={i} position={[-b.x * W, b.y * H, 0]}>
          <boxGeometry args={[b.w * W, b.h * H, depth]} />
          {surface}
        </mesh>
      ))}
    </group>
  );
}

/**
 * The projection screen.
 *
 * The shadow is the screen's own texture, so it is bounded by the paper, lands
 * on both faces of it and cannot float free of the surface. The previous
 * version stacked two translucent planes a quarter-centimetre BEHIND the
 * panel, on the face pointing away from the lamp — which is why nothing ever
 * appeared to be projected onto it.
 */
function ProjectionScreen({ benchZ, texture, curtain, overflows }) {
  return (
    <group position={[0, cm(AXIS_CM), zAt(benchZ)]}>
      {/* Frame — BEHIND the paper. The lamp is on −Z, so anything mounted on
          that side of the panel stands between the camera and the very surface
          the shadow is cast on, and hides all of it. */}
      <mesh position={[0, 0, cm(0.9)]}>
        <boxGeometry args={[cm(SCREEN.halfW * 2 + 3), cm(SCREEN.halfH * 2 + 3), cm(1.2)]} />
        <meshStandardMaterial color="#2f3745" roughness={0.65} metalness={0.35} />
      </mesh>

      {/* The paper itself. Unlit on purpose: what the child sees is exactly the
          illumination the optics module computed, not that plus a key light. */}
      <mesh>
        <planeGeometry args={[cm(SCREEN.halfW * 2), cm(SCREEN.halfH * 2)]} />
        {curtain ? (
          <meshStandardMaterial color="#6d3f8f" roughness={0.9} side={THREE.DoubleSide} />
        ) : (
          <meshBasicMaterial map={texture ?? undefined} side={THREE.DoubleSide} toneMapped={false} />
        )}
      </mesh>

      {/* Stand: two short legs onto a foot that rests on the bench. The panel
          is centred on the optical axis, 30 cm up, so there are only a couple
          of centimetres of leg to draw. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[cm(side * (SCREEN.halfW - 5)), cm(-SCREEN.halfH - 0.6), cm(1.4)]}
        >
          <boxGeometry args={[cm(1.8), cm(AXIS_CM - SCREEN.halfH + 1.2), cm(1.8)]} />
          <meshStandardMaterial color="#39414f" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, cm(-AXIS_CM + 0.8), cm(1.4)]}>
        <boxGeometry args={[cm(SCREEN.halfW * 1.6), cm(1.6), cm(9)]} />
        <meshStandardMaterial color="#39414f" roughness={0.6} />
      </mesh>

      <SceneLabel position={[0, cm(SCREEN.halfH + 5), 0]} tone="text-ink-300">
        {curtain
          ? "screen covered — make your prediction!"
          : overflows
            ? "projection screen — shadow is running off the edge"
            : "projection screen"}
      </SceneLabel>
    </group>
  );
}


// ─── Face-on view of the screen ─────────────────────────────────────

/**
 * The screen's own canvas, mounted straight into the HUD.
 *
 * Not a second drawing of the shadow — literally the same element the WebGL
 * texture samples, so the inset and the scene can never disagree, and the
 * child always has one unambiguous face-on view no matter where they have
 * orbited the camera to.
 */
function ScreenPreview({ canvas, covered, solved }) {
  const host = useRef(null);

  useEffect(() => {
    const el = host.current;
    if (!el || !canvas) return undefined;
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.style.display = "block";
    el.appendChild(canvas);
    return () => {
      if (canvas.parentNode === el) el.removeChild(canvas);
    };
  }, [canvas]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-ink-700 bg-ink-900">
      <div ref={host} aria-hidden="true" />
      {covered && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#6d3f8f]/95 text-[10.5px] font-medium text-white/90">
          screen covered
        </div>
      )}
      {!covered && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-1.5 py-1 text-[9px] font-mono text-ink-950/70">
          <span>grid = 10 cm</span>
          <span>
            {solved.shadowWidthCm.toFixed(1)} × {solved.shadowHeightCm.toFixed(1)} cm
          </span>
        </div>
      )}
    </div>
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
  const [showGuides, setShowGuides] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [game, setGame] = useState(null);

  const rotation = (rotationDeg * Math.PI) / 180;

  const solved = useMemo(
    () => solveShadow({ lightZ, objectZ, screenZ, shape, rotation, material, source, size: OBJECT_SIZE_CM }),
    [lightZ, objectZ, screenZ, shape, rotation, material, source],
  );

  const letter = shape === "letterT" ? "T" : "L";
  const curtain = game?.stage === "predict";
  const { canvas, texture } = useScreenCanvas(solved, letter, showGuides);

  /** True once the shadow no longer fits on the paper — worth saying out loud. */
  const overflows = !shadowFitsScreen(solved);

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
    setShowGuides(true);
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

  return (
    <div className="relative h-full w-full bg-ink-950">
      <SceneCanvas
        // Framed from BEHIND THE TORCH, looking down the bench. The shadow
        // lands on the face of the screen that points back at the lamp, so a
        // camera parked past the screen — as this one used to be — sees only
        // its blank back, edge-on and half out of frame.
        camera={{ position: [cm(92), cm(74), zAt(SCENE.cameraBenchZ)], fov: 48 }}
        controls={{ minDistance: 3, maxDistance: 30, target: [0, cm(AXIS_CM - 8), zAt(SCENE.targetBenchZ)] }}
        lights={{ ambient: 0.5, keyLight: 0.55 }}
      >
        <Bench />
        <LightSource benchZ={lightZ} source={source} on />
        <TestObject shape={shape} rotation={rotation} material={material} benchZ={objectZ} />
        <ProjectionScreen
          benchZ={screenZ}
          texture={texture}
          curtain={curtain}
          overflows={overflows}
        />

        <SceneLegend
          corner="top-right"
          title="What to look for"
          items={[
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

              <Toggle label="Mark umbra / penumbra" checked={showGuides} onChange={setShowGuides} />

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

          {/* ─── The screen, face on ──────────────────── */}
          <HudPanel title="On the screen" icon={Ruler}>
            <ScreenPreview canvas={canvas} covered={curtain} solved={solved} />
            <p className="mt-2 text-[10px] leading-relaxed text-ink-500">
              {curtain
                ? "Covered up. Change something on the bench, then predict what the shadow did."
                : showGuides && solved.horizontal.penumbraWidth > 0.4
                  ? "Gold dashes mark where the fully dark umbra ends; blue dashes mark the outer edge of the fuzzy penumbra."
                  : "Every square is 10 cm, so the shadow can be measured straight off the paper."}
            </p>
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
                  : overflows
                    ? "The shadow has grown bigger than the screen, so its edges are running off the paper. Slide the screen closer to the object to fit it back on."
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

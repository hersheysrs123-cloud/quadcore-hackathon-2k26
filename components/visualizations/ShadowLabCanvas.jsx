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
    { x: -0.22, y: 0, w: 0.24, h: 1 },
    { x: 0.08, y: -0.38, w: 0.7, h: 0.24 },
  ],
};

/** The silhouette as a 2D path, centred on the origin, canvas y pointing down. */
function silhouettePath(ctx, kind, letter, halfW, halfH, tiltProgress = 0, rotationRad = 0) {
  const W = halfW * 2;
  const H = halfH * 2;
  switch (kind) {
    case "circle":
      ctx.ellipse(0, 0, halfW, halfH, 0, 0, Math.PI * 2);
      return;
    case "triangle":
      // A cone's or pyramid's outline: apex up, matching the solid on the pedestal.
      ctx.moveTo(0, -halfH);
      ctx.lineTo(halfW, halfH);
      ctx.lineTo(-halfW, halfH);
      ctx.closePath();
      return;
    case "conical": {
      // Smooth continuous vertical tilt of cone from triangle (upright) to circular base
      const s = Math.min(1, Math.max(0, tiltProgress));
      const c = Math.sqrt(Math.max(0, 1 - s * s));
      const apexY = -halfH * c;
      const baseCenterY = halfH * (1 - c) * 0.4;
      const baseRx = halfW;
      const baseRy = Math.max(halfW * 0.15, halfW * s);
      ctx.moveTo(-baseRx, baseCenterY);
      ctx.lineTo(0, apexY);
      ctx.lineTo(baseRx, baseCenterY);
      ctx.ellipse(0, baseCenterY, baseRx, baseRy, 0, 0, Math.PI, false);
      ctx.closePath();
      return;
    }
    case "ring": {
      // Outer ellipse
      ctx.ellipse(0, 0, halfW, halfH, 0, 0, Math.PI * 2);
      // Inner hole cutout (wound counter-clockwise for cutout hole in canvas)
      const holeRatio = 0.44;
      ctx.moveTo(halfW * holeRatio, 0);
      ctx.ellipse(0, 0, halfW * holeRatio, halfH * holeRatio, 0, 0, Math.PI * 2, true);
      return;
    }
    case "pyramid": {
      // Tilted 4-sided pyramid: trapezoid silhouette widening into square base
      const s = Math.min(1, Math.max(0, tiltProgress));
      const c = Math.sqrt(Math.max(0, 1 - s * s));
      const topW = halfW * (0.05 + 0.95 * s);
      const topY = -halfH * c;
      ctx.moveTo(-topW, topY);
      ctx.lineTo(topW, topY);
      ctx.lineTo(halfW, halfH);
      ctx.lineTo(-halfW, halfH);
      ctx.closePath();
      return;
    }
    case "capsule": {
      // Continuous corner radius prevents harsh pop when cylinder or ring begins tilting
      const maxR = Math.min(halfW, halfH);
      const r = maxR * (tiltProgress > 0 ? tiltProgress : 0.85);
      if (ctx.roundRect) ctx.roundRect(-halfW, -halfH, W, H, Math.max(0.1, r));
      else ctx.rect(-halfW, -halfH, W, H);
      return;
    }
    case "letter": {
      const cosTheta = Math.cos(rotationRad);
      const sinTheta = Math.sin(rotationRad);
      const baseRatio = letter === "L" ? 0.7 : 0.85;
      const depthRatio = 0.16;
      const depthFactor = depthRatio / baseRatio;
      const denom = Math.max(0.01, baseRatio * Math.abs(cosTheta) + depthRatio * Math.abs(sinTheta));
      const Wface = W * (baseRatio / denom);

      for (const b of LETTER_BARS[letter] ?? LETTER_BARS.T) {
        // Horizontal center rotates with cos(theta), maintaining signed direction
        const xc = b.x * Wface * cosTheta;
        // Bar width combines foreshortened face and exposed side thickness
        const wb = Math.max(0.5, (b.w * Math.abs(cosTheta) + depthFactor * Math.abs(sinTheta)) * Wface);
        ctx.rect(xc - wb / 2, -b.y * H - (b.h * H) / 2, wb, b.h * H);
      }
      return;
    }
    default: {
      // For cylinder transitioning from rectangle, use continuous corner radius if tiltProgress > 0
      if (tiltProgress > 0.005) {
        const r = Math.min(halfW, halfH) * tiltProgress;
        if (ctx.roundRect) {
          ctx.roundRect(-halfW, -halfH, W, H, r);
          return;
        }
      }
      ctx.rect(-halfW, -halfH, W, H);
    }
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
  silhouettePath(ctx, outline.kind, letter, halfW, halfH, outline.tiltProgress, outline.rotationRad ?? 0);
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
      silhouettePath(ctx, outline.kind, letter, band.w * PX_PER_CM, band.h * PX_PER_CM, outline.tiltProgress, outline.rotationRad ?? 0);
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
      <mesh position={[0, -0.07, 0]} receiveShadow>
        <boxGeometry args={[cm(160), 0.14, cm(160)]} />
        <meshStandardMaterial color="#8c9cb3" roughness={0.65} metalness={0.1} />
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
        <group>
          {/* Stanchion mounting collar gripping the central post */}
          <mesh position={[0, cm(-1.2), 0]}>
            <cylinderGeometry args={[cm(1.6), cm(1.6), cm(2.0), 16]} />
            <meshStandardMaterial color="#2d3748" roughness={0.45} metalness={0.65} />
          </mesh>
          {/* Brass locking thumbscrew on collar */}
          <mesh position={[cm(1.9), cm(-1.2), 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[cm(0.6), cm(0.6), cm(0.7), 12]} />
            <meshStandardMaterial color="#d4af37" roughness={0.3} metalness={0.8} />
          </mesh>

          {/* Support bracket arms connecting stanchion collar to tube chassis */}
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              position={[cm(s * (width * 0.28)), cm(-0.6), cm(-0.15)]}
              rotation={[0.15, 0, s * 0.38]}
            >
              <cylinderGeometry args={[cm(0.35), cm(0.35), cm(1.6), 12]} />
              <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.7} />
            </mesh>
          ))}

          {/* Slender horizontal cylindrical chassis bar behind the tube */}
          <mesh position={[0, cm(-0.2), cm(-0.4)]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[cm(0.35), cm(0.35), cm(width + 1.0), 16]} />
            <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.7} />
          </mesh>

          {/* Left and right bi-pin socket end-caps */}
          {[-1, 1].map((s) => (
            <group key={s} position={[cm(s * (width / 2 + 0.5)), 0, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[cm(1.7), cm(1.7), cm(1.0), 20]} />
                <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.5} />
              </mesh>
              {/* Brass contact collar ring */}
              <mesh position={[cm(-s * 0.55), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[cm(1.5), cm(1.5), cm(0.2), 20]} />
                <meshStandardMaterial color="#d4af37" roughness={0.25} metalness={0.85} />
              </mesh>
            </group>
          ))}

          {/* Frosted fluorescent diffuser tube */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[cm(1.35), cm(1.35), cm(width), 24]} />
            <meshStandardMaterial
              color="#fef9c3"
              emissive="#fef08a"
              emissiveIntensity={on ? 2.5 : 0.1}
              roughness={0.35}
              toneMapped={false}
            />
          </mesh>

          {/* Internal glowing cathode filament core visible inside tube */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[cm(0.35), cm(0.35), cm(width * 0.94), 16]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#fffbeb"
              emissiveIntensity={on ? 3.5 : 0.1}
              toneMapped={false}
            />
          </mesh>
        </group>
      ) : (
        <group>
          {/* Stanchion post mounting clamp with brass thumbscrew */}
          <mesh position={[0, cm(-1.2), cm(-3.5)]}>
            <cylinderGeometry args={[cm(1.6), cm(1.6), cm(2.0), 16]} />
            <meshStandardMaterial color="#2d3748" roughness={0.45} metalness={0.65} />
          </mesh>
          <mesh position={[cm(1.9), cm(-1.2), cm(-3.5)]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[cm(0.6), cm(0.6), cm(0.7), 12]} />
            <meshStandardMaterial color="#d4af37" roughness={0.3} metalness={0.8} />
          </mesh>

          {/* Main machined flashlight barrel */}
          <mesh position={[0, 0, cm(-6.6)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[cm(2.7), cm(3.1), cm(8.4), 24]} />
            <meshStandardMaterial color="#1e293b" roughness={0.45} metalness={0.7} />
          </mesh>

          {/* Knurled grip ribs along barrel */}
          {[-5.0, -6.4, -7.8].map((zPos, idx) => (
            <mesh key={idx} position={[0, 0, cm(zPos)]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[cm(2.9), cm(2.9), cm(0.55), 24]} />
              <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.8} />
            </mesh>
          ))}

          {/* Tailcap and rear click button */}
          <mesh position={[0, 0, cm(-11.0)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[cm(3.0), cm(2.6), cm(1.2), 24]} />
            <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.6} />
          </mesh>
          <mesh position={[0, 0, cm(-11.7)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[cm(1.0), cm(1.0), cm(0.4), 16]} />
            <meshStandardMaterial color="#ef4444" roughness={0.4} metalness={0.2} />
          </mesh>

          {/* Front brass retaining collar */}
          <mesh position={[0, 0, cm(-2.0)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[cm(3.4), cm(3.1), cm(1.0), 24]} />
            <meshStandardMaterial color="#d4af37" roughness={0.25} metalness={0.85} />
          </mesh>

          {/* Beveled outer lens rim */}
          <mesh position={[0, 0, cm(-1.2)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[cm(3.6), cm(3.4), cm(0.8), 24]} />
            <meshStandardMaterial color="#1e293b" roughness={0.35} metalness={0.8} />
          </mesh>

          {/* Specular chrome parabolic reflector dish */}
          <mesh position={[0, 0, cm(-1.6)]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[cm(3.3), cm(3.6), 24, 1, true]} />
            <meshStandardMaterial
              color="#f8fafc"
              roughness={0.08}
              metalness={0.96}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Convex optical front glass lens disc */}
          <mesh position={[0, 0, cm(-0.6)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[cm(3.3), cm(3.3), cm(0.15), 24]} />
            <meshPhysicalMaterial
              color="#e0f2fe"
              roughness={0.05}
              transmission={0.85}
              transparent
              opacity={0.35}
              ior={1.5}
            />
          </mesh>

          {/* Pinpoint filament emitter core */}
          <mesh position={[0, 0, cm(-0.8)]}>
            <sphereGeometry args={[cm(Math.max(width, 1.1)), 16, 16]} />
            <meshStandardMaterial
              color="#fffbe8"
              emissive="#ffe9a8"
              emissiveIntensity={on ? 3.4 : 0.1}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}
      {on && <pointLight intensity={broad ? 9 : 7} distance={cm(260)} color="#fff3cf" castShadow />}
      <SceneLabel position={[0, cm(8), 0]} accent>
        {SOURCES[source].label}
      </SceneLabel>
    </group>
  );
}

/**
 * Which axis a turn of the slider spins each solid about.
 *
 * Tipping the cylinder, cone, ring, or pyramid toward the screen is what changes
 * its silhouette. Spinning the cube about the upright is what presents its diagonal.
 */
const TIP_AXIS = { cylinder: "x", cone: "x", ring: "x", pyramid: "x" };

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
      case "ring":
        return (
          <mesh>
            <torusGeometry args={[halfW * 0.72, halfW * 0.22, 24, 48]} />
            {surface}
          </mesh>
        );
      case "pyramid":
        return (
          <mesh rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[halfW * 1.414, halfH * 2, 4]} />
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
            depth={size * 0.16}
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

  // Dynamic clearance prevents rotating objects from clipping into the pedestal post
  const clearance = useMemo(() => {
    if (TIP_AXIS[shape] === "x") {
      const dip = sil.halfHeight * Math.abs(Math.cos(rotation)) + sil.halfWidth * Math.abs(Math.sin(rotation));
      return Math.max(sil.halfHeight, dip) + 0.4;
    }
    return sil.halfHeight + 0.2;
  }, [shape, rotation, sil.halfHeight, sil.halfWidth]);

  return (
    <group position={[0, cm(AXIS_CM), zAt(benchZ)]}>
      <Post height={AXIS_CM - clearance} top={-clearance} radius={1.3} />
      {/* Pivot mount spindle */}
      <mesh position={[0, cm(-clearance / 2), 0]}>
        <cylinderGeometry args={[cm(0.6), cm(0.6), cm(clearance), 16]} />
        <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.6} />
      </mesh>
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
      <mesh rotation={[0, Math.PI, 0]}>
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

  // Resizable panel width state (10% to 80% screen width)
  // Default to 288 to match SSR markup, then hydrate saved width on client mount
  const [panelWidth, setPanelWidth] = useState(288);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("socratic_hud_panel_width");
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= 180 && parsed <= (window.innerWidth || 1920) * 0.85) {
            setPanelWidth(parsed);
          }
        }
      }
    } catch (_) {}
  }, []);

  const isResizingRef = useRef(false);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = panelWidth;

    let rafId;
    const onPointerMove = (moveEvent) => {
      if (!isResizingRef.current) return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const deltaX = moveEvent.clientX - startX;
        const minW = Math.max(180, Math.floor(window.innerWidth * 0.10));
        const maxW = Math.floor(window.innerWidth * 0.80);
        const clamped = Math.min(Math.max(startWidth + deltaX, minW), maxW);
        setPanelWidth(clamped);
      });
    };

    const cleanup = () => {
      isResizingRef.current = false;
      setIsResizing(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      try {
        if (typeof window !== "undefined") {
          setPanelWidth((curr) => {
            localStorage.setItem("socratic_hud_panel_width", String(curr));
            return curr;
          });
        }
      } catch (_) {}
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  };

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
          style={{ width: `${panelWidth}px`, maxWidth: "80vw", minWidth: "10vw" }}
          className={`pointer-events-auto absolute left-4 top-4 z-20 flex max-h-[calc(100%-2rem)] flex-col gap-3 ${
            isResizing ? "select-none" : ""
          }`}
        >
          <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl">
            <div className="max-h-[calc(100vh-2rem)] overflow-y-auto pr-0.5 flex flex-col gap-3">
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
                  columns={4}
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

            {/* ─── Right Edge Drag-To-Resize Handle (10% to 80% screen width) ─── */}
            <div
              onPointerDown={handleResizePointerDown}
              className="absolute -right-1 top-0 bottom-0 z-30 flex w-3.5 cursor-ew-resize items-center justify-center select-none group"
              title="Drag to resize panel (10% to 80% screen width)"
            >
              <div
                className={`h-14 w-1 rounded-full transition-all ${
                  isResizing ? "bg-duck-400 shadow-md scale-y-110" : "bg-ink-700/50 group-hover:bg-duck-400/80 group-hover:h-20"
                }`}
              />
            </div>

            {/* ─── Bottom-Right Corner Resize Grip Indicator ─── */}
            <div
              onPointerDown={handleResizePointerDown}
              className="absolute bottom-1.5 right-1.5 z-30 cursor-nwse-resize p-1 text-ink-600 transition-colors hover:text-duck-400 select-none"
              title="Drag to resize panel width"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-60 hover:opacity-100 fill-current">
                <circle cx="8" cy="8" r="1.2" />
                <circle cx="8" cy="4" r="1.2" />
                <circle cx="4" cy="8" r="1.2" />
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import {
  Aperture,
  Eye,
  Focus,
  Moon,
  RotateCcw,
  Sun,
  Target,
} from "lucide-react";
import {
  PALETTE,
  SceneCanvas,
  SceneLabel,
  SceneLegend,
  clamp,
  lerp,
} from "@/components/visualizations/scene-kit";
import {
  Choice,
  HudButton,
  HudPanel,
  Slider,
  Toggle,
} from "@/components/visualizations/VisualizationHUD";
import {
  EYE,
  EYE_GEOMETRY,
  accommodationDemand,
  solveEye,
  traceRayHeights,
} from "@/lib/eyeOptics";

// ─── Human eye · accommodation and the pupil reflex ─────────────────
// A cutaway eyeball whose every moving part is driven by `lib/eyeOptics.js`:
// the lens curvature, the ray convergence point, the pupil aperture and the
// status pills all read the same solved model, so the picture and the numbers
// cannot disagree.
// ─────────────────────────────────────────────────────────────────────

/** World units per millimetre of real anatomy. */
const MM = 0.22;
const mm = (v) => v * MM;

/**
 * Scene anatomy, layered over the axial geometry the optics module owns.
 *
 * The lens plane and the principal plane come from there rather than being
 * chosen by eye: both are forced by the 24 mm globe and the 60 D total power,
 * and picking them by hand left the drawn rays crossing short of the fovea
 * while the panel reported a perfect focus.
 */
const ANATOMY = {
  ...EYE_GEOMETRY,
  lensPlane: EYE_GEOMETRY.lensPlane,
  principalPlane: EYE_GEOMETRY.principalPlane,
  eyeRadius: 12,
  corneaRadius: 7.8,
  ciliaryPlane: -6.2,
  irisOuterRadius: 6,
  opticDiscOffset: -4.2,
};
const PRINCIPAL_PLANE = ANATOMY.principalPlane;

/**
 * Cutaway: keep the far half (z ≤ 0) of every shell so the camera looks
 * straight into the eye.
 *
 * The angle that achieves that is NOT the same for every primitive, because
 * three.js parametrises them differently: a lathe puts z on cos φ, a sphere
 * and a ring put it on sin. Using one constant for all of them sliced the
 * shells along three different planes.
 */
const CUT = { phiStart: Math.PI / 2, phiLength: Math.PI };
const SPHERE_CUT = { phiStart: Math.PI, phiLength: Math.PI };
/** Rings are built in their own XY plane, then laid flat onto the axis. */
const RING_CUT = { thetaStart: Math.PI, thetaLength: Math.PI };
/** Angular half-width of the corneal opening in the sclera, radians. */
const LIMBUS = 0.55;

const TISSUE = {
  sclera: "#e9e6dd",
  cornea: "#a9d9f0",
  aqueous: "#7fc7e8",
  iris: "#3f7fa8",
  irisDark: "#1e4258",
  lens: "#ffe8a3",
  ciliary: "#c96f7a",
  zonule: "#dfe6ee",
  vitreous: "#bfe3f2",
  retina: "#d4646f",
  fovea: "#f0a33c",
  nerve: "#e4c98f",
  choroid: "#8a4d54",
};

// ─── Parametric crystalline lens ────────────────────────────────────

/**
 * Profile of a biconvex lens as a lathe cross-section.
 *
 * Both faces are spherical caps of radius R. The half-thickness at radial
 * distance r is T/2 minus that surface's sagitta, so the rim automatically
 * closes at the edge thickness and the whole mesh follows from the one number
 * the optics module hands over — the radius of curvature.
 */
function lensProfile(radiusM, semiDiameterM, thicknessM, segments = 26) {
  const R = radiusM * 1000;
  const h = semiDiameterM * 1000;
  const T = thicknessM * 1000;
  const sagitta = (r) => R - Math.sqrt(Math.max(R * R - r * r, 0));
  const edge = Math.max(T - 2 * sagitta(h), 0.15);

  const front = [];
  const back = [];
  for (let i = 0; i <= segments; i += 1) {
    const r = (h * i) / segments;
    const half = T / 2 - sagitta(r);
    front.push(new THREE.Vector2(mm(r), mm(-half)));
    back.push(new THREE.Vector2(mm(r), mm(half)));
  }
  // Anterior pole → equator → posterior pole, with a flat rim of `edge`.
  return [...front, new THREE.Vector2(mm(h), mm(-edge / 2)), new THREE.Vector2(mm(h), mm(edge / 2)), ...back.reverse()];
}

function CrystallineLens({ solved }) {
  const geometry = useMemo(() => {
    const pts = lensProfile(solved.lensRadius, solved.lensSemiDiameter, solved.lensThickness);
    const g = new THREE.LatheGeometry(pts, 60, CUT.phiStart, CUT.phiLength);
    // Lathe spins about Y; the whole eye group lays that axis down onto X.
    return g;
  }, [solved.lensRadius, solved.lensSemiDiameter, solved.lensThickness]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group position={[0, mm(ANATOMY.lensPlane), 0]}>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          color={TISSUE.lens}
          transmission={0.72}
          thickness={1.2}
          roughness={0.08}
          metalness={0}
          ior={1.42}
          clearcoat={1}
          transparent
          opacity={0.92}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ─── Shells ─────────────────────────────────────────────────────────

/** Sclera, choroid and retina as nested half-shells, so the layers read. */
function EyeShells({ showRetina }) {
  const layers = [
    { r: ANATOMY.eyeRadius, colour: TISSUE.sclera, opacity: 0.3, label: "sclera" },
    { r: ANATOMY.eyeRadius - 0.45, colour: TISSUE.choroid, opacity: 0.5 },
    ...(showRetina ? [{ r: ANATOMY.eyeRadius - 0.85, colour: TISSUE.retina, opacity: 0.72 }] : []),
  ];

  return (
    <group>
      {layers.map((layer, i) => (
        <mesh key={i}>
          {/* thetaStart trims the front cap: the cornea takes over there. */}
          {/* theta runs from the posterior pole, so the cap to remove is the
              ANTERIOR one where the cornea takes over — trimmed off the end,
              not the start. */}
          <sphereGeometry
            args={[
              mm(layer.r),
              64,
              44,
              SPHERE_CUT.phiStart,
              SPHERE_CUT.phiLength,
              0,
              Math.PI - LIMBUS,
            ]}
          />
          <meshStandardMaterial
            color={layer.colour}
            transparent
            opacity={layer.opacity}
            roughness={0.55}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Vitreous body — the bulk of the globe. */}
      <mesh>
        <sphereGeometry args={[mm(ANATOMY.eyeRadius - 1.1), 48, 36, SPHERE_CUT.phiStart, SPHERE_CUT.phiLength]} />
        <meshPhysicalMaterial
          color={TISSUE.vitreous}
          transmission={0.85}
          thickness={2}
          roughness={0.2}
          transparent
          opacity={0.24}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Cornea() {
  const geometry = useMemo(() => {
    const R = ANATOMY.corneaRadius;
    // Centre of the corneal sphere, so its front pole lands on the vertex.
    const centre = ANATOMY.corneaVertex + R;
    const pts = [];
    const maxAngle = Math.asin(clamp(5.8 / R, 0, 1));
    for (let i = 0; i <= 28; i += 1) {
      const a = (maxAngle * i) / 28;
      pts.push(new THREE.Vector2(mm(R * Math.sin(a)), mm(centre - R * Math.cos(a))));
    }
    return new THREE.LatheGeometry(pts, 56, CUT.phiStart, CUT.phiLength);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry}>
      <meshPhysicalMaterial
        color={TISSUE.cornea}
        transmission={0.9}
        thickness={0.5}
        roughness={0.05}
        ior={1.376}
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** The iris as a flat annulus whose hole is the live pupil. */
function Iris({ pupilRadiusMm }) {
  const geometry = useMemo(
    () =>
      new THREE.RingGeometry(
        mm(Math.max(pupilRadiusMm, 0.4)),
        mm(ANATOMY.irisOuterRadius),
        56,
        1,
        RING_CUT.thetaStart,
        RING_CUT.thetaLength,
      ),
    [pupilRadiusMm],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group position={[0, mm(ANATOMY.pupilPlane), 0]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={TISSUE.iris}
          roughness={0.62}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/**
 * Ciliary ring and the zonules it pulls on.
 *
 * The counter-intuitive part made visible: as the muscle contracts it moves
 * INWARD, which shortens the span it has to bridge, so the zonules go slack
 * and the lens is released to round up.
 */
function CiliaryApparatus({ solved, showZonules }) {
  const ringRadius = solved.ciliary.ciliaryRingRadius * 1000;
  const slack = 1 - solved.ciliary.effort;

  const zonules = useMemo(() => {
    const lensEdge = solved.lensSemiDiameter * 1000;
    const strands = [];
    for (let i = 0; i <= 10; i += 1) {
      const phi = CUT.phiStart + (CUT.phiLength * i) / 10;
      const dirZ = Math.cos(phi);
      const dirX = Math.sin(phi);
      const from = [mm(ringRadius) * dirX, mm(ANATOMY.ciliaryPlane), mm(ringRadius) * dirZ];
      const to = [mm(lensEdge) * dirX, mm(ANATOMY.lensPlane), mm(lensEdge) * dirZ];
      // A taut fibre is a straight line; a slack one bows outward under its
      // own slack, which is exactly what releases the lens capsule.
      const points = [];
      for (let s = 0; s <= 10; s += 1) {
        const t = s / 10;
        const sag = Math.sin(t * Math.PI) * slack * mm(0.9);
        points.push([
          lerp(from[0], to[0], t) + sag * dirX,
          lerp(from[1], to[1], t),
          lerp(from[2], to[2], t) + sag * dirZ,
        ]);
      }
      strands.push(points);
    }
    return strands;
  }, [ringRadius, slack, solved.lensSemiDiameter]);

  return (
    <group>
      <mesh position={[0, mm(ANATOMY.ciliaryPlane), 0]} rotation={[Math.PI / 2, 0, 0]}>
        {/* Drawn whole: torusGeometry sweeps from a fixed zero, so a half arc
            lands on the wrong side of the cut, and a complete ring reads as a
            ring anyway through the translucent shells. */}
        <torusGeometry args={[mm(ringRadius), mm(0.85), 14, 44]} />
        <meshStandardMaterial
          color={TISSUE.ciliary}
          emissive={TISSUE.ciliary}
          emissiveIntensity={0.15 + solved.ciliary.effort * 0.5}
          roughness={0.5}
        />
      </mesh>

      {showZonules &&
        zonules.map((points, i) => (
          <Line
            key={i}
            points={points}
            color={TISSUE.zonule}
            lineWidth={slack > 0.6 ? 1.2 : 2}
            transparent
            opacity={0.55 + (1 - slack) * 0.4}
          />
        ))}
    </group>
  );
}

function PosteriorDetail() {
  return (
    <group>
      {/* Fovea — the pit on the visual axis where acuity is highest. */}
      <mesh position={[0, mm(ANATOMY.retina - 1.0), 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[mm(0.85), 24]} />
        <meshStandardMaterial
          color={TISSUE.fovea}
          emissive={TISSUE.fovea}
          emissiveIntensity={0.8}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {/* Optic disc sits off-axis — there are no photoreceptors on it, which
          is why it is the blind spot rather than a second fovea. */}
      <mesh
        position={[0, mm(ANATOMY.retina - 2.2), mm(ANATOMY.opticDiscOffset)]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[mm(0.9), 20]} />
        <meshStandardMaterial color="#f2ead4" side={THREE.DoubleSide} />
      </mesh>
      <mesh
        position={[0, mm(ANATOMY.retina + 1.4), mm(ANATOMY.opticDiscOffset - 0.6)]}
        rotation={[0, 0, 0]}
      >
        <cylinderGeometry args={[mm(1.5), mm(1.9), mm(5), 18]} />
        <meshStandardMaterial color={TISSUE.nerve} roughness={0.6} />
      </mesh>
    </group>
  );
}

// ─── Ray tracing ────────────────────────────────────────────────────

/** Where the compressed object marker is drawn, mm in front of the cornea. */
const OBJECT_DRAW_NEAR = 14;
const OBJECT_DRAW_FAR = 30;

/**
 * The object distance axis is compressed logarithmically — 10 m at true scale
 * would be forty metres of empty canvas. Every ray height and slope INSIDE
 * the eye is exact paraxial optics; only this first leg is schematic, which
 * is the same licence every textbook ray diagram takes.
 */
function objectDrawDistance(objectDistanceM) {
  const t = clamp((Math.log10(objectDistanceM) + 1) / 2, 0, 1);
  return lerp(OBJECT_DRAW_NEAR, OBJECT_DRAW_FAR, t);
}

/**
 * One ray's polyline, from the object marker to the retina.
 *
 * The heights come from `traceRayHeights` in the optics module, so the point
 * where the rays cross the axis IS the image position the readout reports —
 * and the cornea still visibly does the larger share of the bending, because
 * it genuinely supplies about two thirds of the eye's power.
 */
function traceRay(heightAtPupil, solved, objectDistanceM) {
  const t = traceRayHeights(heightAtPupil, objectDistanceM, solved.imageDistance);
  const drawGap = objectDrawDistance(objectDistanceM) / 1000;
  return {
    ...t,
    points: [
      // Schematic first leg: every ray leaves the compressed object marker on
      // the axis, so the cone the eye actually receives stays readable.
      [0, mm((t.yC - drawGap) * 1000), 0],
      [mm(t.hC * 1000), mm(t.yC * 1000), 0],
      [mm(heightAtPupil * 1000), mm(t.yP * 1000), 0],
      [mm(t.hL * 1000), mm(t.yL * 1000), 0],
      [mm(t.hR * 1000), mm(t.yR * 1000), 0],
    ],
  };
}

const RAY_MODES = {
  bundle: { label: "Full bundle", count: 9 },
  marginal: { label: "Marginal", count: 2 },
  axis: { label: "Chief axis", count: 1 },
};

function RayBundle({ solved, objectDistanceM, rayMode }) {
  const rays = useMemo(() => {
    const a = solved.pupil / 2;
    const mode = RAY_MODES[rayMode] ?? RAY_MODES.bundle;
    let heights;
    if (rayMode === "axis") heights = [0];
    else if (rayMode === "marginal") heights = [-a, a];
    else {
      heights = [];
      for (let i = 0; i < mode.count; i += 1) {
        heights.push(-a + (2 * a * i) / (mode.count - 1));
      }
    }
    return heights.map((h) => traceRay(h, solved, objectDistanceM));
  }, [solved, objectDistanceM, rayMode]);

  const colour = solved.inFocus ? PALETTE.gold : PALETTE.rose;

  return (
    <group>
      {rays.map((ray, i) => (
        <Line key={i} points={ray.points} color={colour} lineWidth={1.7} transparent opacity={0.85} />
      ))}
    </group>
  );
}

/**
 * The crossing point, and how far it misses the retina by.
 *
 * Drawn only when the eye is out of focus, because that is the one case where
 * the image plane and the retina are different places.
 */
function FocalMarker({ solved }) {
  if (solved.inFocus || !Number.isFinite(solved.imageDistance)) return null;
  const focusMm = PRINCIPAL_PLANE + solved.imageDistance * 1000;
  const behind = solved.focusError > 0;
  const blurRadius = (solved.blur * 1000) / 2;

  return (
    <group>
      {/* Where the rays actually cross. */}
      <mesh position={[0, mm(clamp(focusMm, -10, 26)), 0]}>
        <sphereGeometry args={[mm(0.5), 16, 16]} />
        <meshStandardMaterial color={PALETTE.rose} emissive={PALETTE.rose} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      <SceneLabel position={[mm(3.4), mm(clamp(focusMm, -10, 26)), 0]} tone="text-rose-300">
        {behind ? "focus behind retina" : "focus in front of retina"}
      </SceneLabel>

      {/* The blur circle it leaves on the retina instead of a point. */}
      <mesh position={[0, mm(ANATOMY.retina - 0.9), 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0, mm(Math.max(blurRadius, 0.05)), 24, 1, RING_CUT.thetaStart, RING_CUT.thetaLength]} />
        <meshBasicMaterial color={PALETTE.rose} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** The object being looked at, with its true distance printed on it. */
function ObjectMarker({ objectDistanceM, inFocus }) {
  const y = ANATOMY.corneaVertex - objectDrawDistance(objectDistanceM);
  return (
    <group position={[0, mm(y), 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[mm(1.3), mm(4.4), 18]} />
        <meshStandardMaterial
          color={inFocus ? PALETTE.emerald : PALETTE.slate}
          emissive={inFocus ? PALETTE.emerald : PALETTE.slate}
          emissiveIntensity={0.6}
        />
      </mesh>
      <SceneLabel position={[mm(5.5), 0, 0]} accent>
        {objectDistanceM < 1 ? `${(objectDistanceM * 100).toFixed(0)} cm` : `${objectDistanceM.toFixed(1)} m`}
      </SceneLabel>
    </group>
  );
}

// ─── Front-facing iris viewport ─────────────────────────────────────

/**
 * The iris seen face-on, with both muscle groups drawn.
 *
 * They are antagonists, and the scene has to show that: the circular
 * sphincter is a band of concentric fibres right at the pupil margin, while
 * the dilator fibres run radially like spokes. Whichever is contracting is
 * lit; the other dims.
 */
function IrisFace({ solved, animate }) {
  const pupil = useRef(null);
  const target = solved.iris.diameterMm;
  const shown = useRef(target);

  useFrame((_, delta) => {
    // The real reflex takes a fraction of a second, and easing toward the
    // target is what makes constriction read as a *reflex* rather than a jump.
    const speed = animate ? clamp(delta * 6, 0, 1) : 1;
    shown.current += (target - shown.current) * speed;
    if (pupil.current) {
      const r = Math.max(shown.current / 2, 0.2) * 0.36;
      pupil.current.scale.set(r, r, 1);
    }
  });

  const sphincterActive = solved.iris.sphincter.startsWith("contracted");
  const dilatorActive = solved.iris.dilator.startsWith("contracted");

  const spokes = useMemo(() => {
    const out = [];
    for (let i = 0; i < 48; i += 1) {
      const a = (i / 48) * Math.PI * 2;
      out.push([
        [Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0.01],
        [Math.cos(a) * 2.05, Math.sin(a) * 2.05, 0.01],
      ]);
    }
    return out;
  }, []);

  const rings = useMemo(
    () =>
      [0.72, 0.84, 0.96].map((r) => {
        const pts = [];
        for (let i = 0; i <= 72; i += 1) {
          const a = (i / 72) * Math.PI * 2;
          pts.push([Math.cos(a) * r, Math.sin(a) * r, 0.02]);
        }
        return pts;
      }),
    [],
  );

  return (
    <group>
      {/* Iris stroma. */}
      <mesh>
        <circleGeometry args={[2.05, 64]} />
        <meshStandardMaterial color={TISSUE.iris} roughness={0.7} />
      </mesh>

      {/* Radial dilator fibres — contract in the dark to haul the pupil open. */}
      {spokes.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color={dilatorActive ? PALETTE.gold : TISSUE.irisDark}
          lineWidth={dilatorActive ? 1.6 : 1}
          transparent
          opacity={dilatorActive ? 0.95 : 0.4}
        />
      ))}

      {/* Circular sphincter band — contracts in bright light to close it. */}
      {rings.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color={sphincterActive ? PALETTE.rose : TISSUE.irisDark}
          lineWidth={sphincterActive ? 3 : 1.6}
          transparent
          opacity={sphincterActive ? 0.95 : 0.45}
        />
      ))}

      {/* The pupil itself: a hole, scaled by the reflex. */}
      <mesh ref={pupil} position={[0, 0, 0.05]}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial color="#04070c" />
      </mesh>

      {/* Limbus. */}
      <mesh position={[0, 0, -0.02]}>
        <ringGeometry args={[2.05, 2.35, 64]} />
        <meshStandardMaterial color="#f3f1ea" roughness={0.8} />
      </mesh>
    </group>
  );
}

function IrisViewport({ solved, animate, expanded }) {
  return (
    <div
      className={`pointer-events-auto absolute bottom-3 right-3 z-20 overflow-hidden rounded-xl border border-ink-700 bg-ink-950/90 shadow-2xl backdrop-blur-md transition-all ${
        expanded ? "h-[248px] w-[248px]" : "h-[150px] w-[150px]"
      }`}
    >
      <SceneCanvas
        camera={{ position: [0, 0, 6.2], fov: 45 }}
        controls={{ enablePan: false, minDistance: 4, maxDistance: 9 }}
        lights={{ ambient: 0.9, keyLight: 0.7 }}
      >
        <IrisFace solved={solved} animate={animate} />
      </SceneCanvas>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-2 py-1.5">
        <span className="text-[9.5px] font-semibold uppercase tracking-wider text-ink-300">Iris · front view</span>
        <span className="rounded bg-ink-900/80 px-1.5 py-0.5 text-[9.5px] font-mono text-duck-300">
          {solved.iris.diameterMm.toFixed(2)} mm
        </span>
      </div>
    </div>
  );
}

// ─── Readout ────────────────────────────────────────────────────────

const PILL_TONES = {
  active: "border-rose-500/45 bg-rose-500/12 text-rose-300",
  slack: "border-amber-500/45 bg-amber-500/12 text-amber-300",
  rest: "border-sky-500/40 bg-sky-500/12 text-sky-300",
  good: "border-emerald-500/45 bg-emerald-500/12 text-emerald-300",
  neutral: "border-ink-700 bg-ink-850 text-ink-300",
};

function Pill({ label, value, tone = "neutral" }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[9.5px] uppercase tracking-wider text-ink-500">{label}</p>
      <p className={`truncate rounded-md border px-2 py-1 text-[11px] font-medium ${PILL_TONES[tone]}`}>
        {value}
      </p>
    </div>
  );
}

/**
 * What the world looks like through this eye right now.
 *
 * The blur is applied as a real Gaussian in CSS, scaled from the retinal blur
 * circle the optics module computed — so the preview gets worse for exactly
 * the reason the ray diagram above it says it should.
 */
function VisionPreview({ solved, enabled }) {
  // Blur circle in arcminutes → pixels, at roughly 60 px per degree.
  const px = enabled ? clamp((solved.blurArcmin / 60) * 30, 0, 26) : 0;
  return (
    <div className="overflow-hidden rounded-lg border border-ink-700 bg-white">
      <div
        className="flex h-[74px] items-center justify-center gap-2 select-none"
        style={{ filter: `blur(${px.toFixed(2)}px)` }}
        aria-hidden="true"
      >
        <span className="text-[34px] font-bold leading-none text-ink-950">E</span>
        <span className="text-[26px] font-bold leading-none text-ink-950">F P</span>
        <span className="text-[17px] font-bold leading-none text-ink-950">T O Z</span>
      </div>
    </div>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

const MODES = [
  { value: "accommodation", label: "Accommodation" },
  { value: "pupil", label: "Pupil reflex" },
];

const LIGHT_PRESETS = [
  { lux: 0.005, label: "Starlight" },
  { lux: 1, label: "Moonlit" },
  { lux: 400, label: "Indoors" },
  { lux: 100000, label: "Direct sun" },
];

export default function EyeCanvas({ onOpenQuiz }) {
  const [mode, setMode] = useState("accommodation");
  const [objectDistance, setObjectDistance] = useState(6);
  const [autoAccommodate, setAutoAccommodate] = useState(true);
  const [manualAccommodation, setManualAccommodation] = useState(0);
  const [showBlur, setShowBlur] = useState(true);
  const [logLux, setLogLux] = useState(2.6);
  const [rayMode, setRayMode] = useState("bundle");
  const [showZonules, setShowZonules] = useState(true);
  const [showRetina, setShowRetina] = useState(true);
  const [showRays, setShowRays] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);

  const lux = useMemo(() => 10 ** logLux, [logLux]);

  const solved = useMemo(
    () =>
      solveEye({
        objectDistanceM: objectDistance,
        lux,
        auto: autoAccommodate,
        manualAccommodation,
      }),
    [objectDistance, lux, autoAccommodate, manualAccommodation],
  );

  const reset = useCallback(() => {
    setObjectDistance(6);
    setAutoAccommodate(true);
    setManualAccommodation(0);
    setLogLux(2.6);
    setRayMode("bundle");
    setShowBlur(true);
    setShowZonules(true);
    setShowRetina(true);
    setShowRays(true);
  }, []);

  const demand = accommodationDemand(objectDistance);

  return (
    <div className="relative h-full w-full bg-ink-950">
      <SceneCanvas
        // Framed off-centre: the eye sits on the right and the object it is
        // looking at extends to the left, so centring on the origin cropped
        // the marker at the far end of the distance slider.
        camera={{ position: [-2, 0.4, 15], fov: 44 }}
        controls={{ minDistance: 5, maxDistance: 34, target: [-2, 0, 0] }}
        lights={{ ambient: 0.72, keyLight: 1.1 }}
      >
        {/* Internal frame runs the optical axis along +Y; this lays it down so
            the cornea faces left and the cut face meets the camera. */}
        <group rotation={[0, 0, -Math.PI / 2]}>
          <EyeShells showRetina={showRetina} />
          <Cornea />
          <Iris pupilRadiusMm={solved.iris.diameterMm / 2} />
          <CrystallineLens solved={solved} />
          <CiliaryApparatus solved={solved} showZonules={showZonules} />
          <PosteriorDetail />

          {mode === "accommodation" && (
            <>
              <ObjectMarker objectDistanceM={objectDistance} inFocus={solved.inFocus} />
              {showRays && (
                <RayBundle solved={solved} objectDistanceM={objectDistance} rayMode={rayMode} />
              )}
              <FocalMarker solved={solved} />
            </>
          )}

          <SceneLabel position={[mm(4.2), mm(ANATOMY.retina - 1), 0]} accent>
            fovea
          </SceneLabel>
          <SceneLabel position={[mm(-7.4), mm(ANATOMY.ciliaryPlane), 0]} tone="text-rose-300">
            ciliary body
          </SceneLabel>
          <SceneLabel position={[mm(7.2), mm(ANATOMY.pupilPlane), 0]} tone="text-sky-300">
            iris · pupil
          </SceneLabel>
          <SceneLabel position={[mm(-6.4), mm(ANATOMY.lensPlane), 0]} tone="text-amber-200">
            lens
          </SceneLabel>
        </group>

        <SceneLegend
          corner="top-right"
          title={mode === "accommodation" ? "Accommodation" : "Pupil reflex"}
          items={
            mode === "accommodation"
              ? [
                  { color: solved.inFocus ? PALETTE.gold : PALETTE.rose, shape: "line", label: "Light rays", note: solved.inFocus ? "converging on the fovea" : "missing the retina" },
                  { color: TISSUE.lens, label: "Crystalline lens", note: solved.ciliary.lens },
                  { color: TISSUE.ciliary, label: "Ciliary muscle", note: solved.ciliary.muscle },
                  { color: TISSUE.zonule, shape: "line", label: "Zonules", note: solved.ciliary.zonules },
                  { color: PALETTE.slate, shape: "dash", label: "Object axis", note: "compressed — not to scale" },
                ]
              : [
                  { color: PALETTE.rose, shape: "line", label: "Sphincter", note: `circular · ${solved.iris.sphincter}` },
                  { color: PALETTE.gold, shape: "line", label: "Dilator", note: `radial · ${solved.iris.dilator}` },
                  { color: "#04070c", label: "Pupil", note: `${solved.iris.diameterMm.toFixed(2)} mm aperture` },
                  { color: TISSUE.retina, label: "Retina", note: "what the aperture is protecting" },
                ]
          }
        />
      </SceneCanvas>

      <IrisViewport solved={solved} animate expanded={mode === "pupil"} />

      {/* ─── Controls ─────────────────────────────────────── */}
      {!panelOpen ? (
        <div className="pointer-events-auto absolute left-4 top-4 z-20">
          <HudButton icon={Eye} onClick={() => setPanelOpen(true)}>
            Controls
          </HudButton>
        </div>
      ) : (
        <div
          onWheel={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute left-4 top-4 z-20 flex max-h-[calc(100%-2rem)] w-[286px] flex-col gap-3 overflow-y-auto pr-0.5"
        >
          <HudPanel
            title="Human eye"
            icon={Eye}
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
              <Choice options={MODES} value={mode} onChange={setMode} columns={2} />

              {mode === "accommodation" ? (
                <>
                  <Slider
                    label="Object distance"
                    value={objectDistance}
                    onChange={setObjectDistance}
                    min={0.1}
                    max={10}
                    step={0.05}
                    format={(v) => (v < 1 ? `${(v * 100).toFixed(0)} cm` : `${v.toFixed(2)} m`)}
                  />
                  <Toggle label="Auto-accommodate" checked={autoAccommodate} onChange={setAutoAccommodate} />
                  {!autoAccommodate && (
                    <Slider
                      label="Manual accommodation"
                      value={manualAccommodation}
                      onChange={setManualAccommodation}
                      min={0}
                      max={EYE.accommodationAmplitude}
                      step={0.1}
                      format={(v) => `${v.toFixed(1)} D of ${demand.toFixed(1)} D needed`}
                    />
                  )}
                  <Toggle label="Out-of-focus preview" checked={showBlur} onChange={setShowBlur} />
                  <Toggle label="Show light rays" checked={showRays} onChange={setShowRays} />
                  <div>
                    <p className="mb-1.5 text-[10px] uppercase tracking-wider text-ink-500">Ray visualiser</p>
                    <Choice
                      options={Object.entries(RAY_MODES).map(([value, r]) => ({ value, label: r.label }))}
                      value={rayMode}
                      onChange={setRayMode}
                      columns={3}
                    />
                  </div>
                </>
              ) : (
                <>
                  <Slider
                    label="Ambient light"
                    value={logLux}
                    onChange={setLogLux}
                    min={-3}
                    max={5}
                    step={0.05}
                    format={(v) => {
                      const l = 10 ** v;
                      return l < 1 ? `${l.toFixed(3)} lx` : l < 1000 ? `${l.toFixed(0)} lx` : `${(l / 1000).toFixed(0)}k lx`;
                    }}
                  />
                  <div className="flex items-center justify-between gap-1.5 text-ink-500">
                    <Moon className="h-3.5 w-3.5 shrink-0" />
                    <div className="h-px flex-1 bg-gradient-to-r from-sky-900 via-ink-600 to-duck-400" />
                    <Sun className="h-3.5 w-3.5 shrink-0 text-duck-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {LIGHT_PRESETS.map((preset) => (
                      <HudButton key={preset.label} onClick={() => setLogLux(Math.log10(preset.lux))}>
                        {preset.label}
                      </HudButton>
                    ))}
                  </div>
                </>
              )}

              <Toggle label="Show zonules" checked={showZonules} onChange={setShowZonules} />
              <Toggle label="Show retina layer" checked={showRetina} onChange={setShowRetina} />

              <div className="space-y-1 border-t border-ink-800 pt-2.5">
                <HudButton icon={RotateCcw} onClick={reset} className="w-full">
                  Reset
                </HudButton>
                {onOpenQuiz && (
                  <HudButton icon={Target} variant="primary" onClick={onOpenQuiz} className="w-full">
                    Test understanding
                  </HudButton>
                )}
              </div>
            </div>
          </HudPanel>

          {/* ─── Live anatomy readout ────────────────── */}
          <HudPanel title="Live anatomy" icon={Focus}>
            <div className="grid grid-cols-2 gap-2.5">
              <Pill
                label="Ciliary muscle"
                value={solved.ciliary.muscle}
                tone={solved.ciliary.effort > 0.3 ? "active" : "rest"}
              />
              <Pill
                label="Zonule tension"
                value={solved.ciliary.zonules}
                tone={solved.ciliary.zonules === "slack" ? "slack" : "rest"}
              />
              <Pill label="Lens shape" value={solved.ciliary.lens} tone="neutral" />
              <Pill
                label="Curvature index"
                value={solved.curvatureIndex.toFixed(2)}
                tone={solved.curvatureIndex > 0.5 ? "active" : "neutral"}
              />
              <Pill label="Refractive power" value={`${solved.power.toFixed(2)} D`} tone="good" />
              <Pill label="Lens power" value={`${solved.lensPower.toFixed(2)} D`} tone="neutral" />
              <Pill label="Lens radius" value={`${(solved.lensRadius * 1000).toFixed(2)} mm`} tone="neutral" />
              <Pill label="Pupil" value={`${solved.iris.diameterMm.toFixed(2)} mm`} tone="neutral" />
              <Pill label="Sphincter" value={solved.iris.sphincter} tone={solved.iris.sphincter === "contracted" ? "active" : "rest"} />
              <Pill label="Dilator" value={solved.iris.dilator} tone={solved.iris.dilator === "contracted" ? "active" : "rest"} />
              <Pill
                label="Focus error"
                value={solved.inFocus ? "on the retina" : `${(solved.focusError * 1000).toFixed(2)} mm ${solved.focusError > 0 ? "behind" : "in front"}`}
                tone={solved.inFocus ? "good" : "active"}
              />
              <Pill
                label="Depth of focus"
                value={`±${solved.depthOfFocus.toFixed(2)} D`}
                tone="neutral"
              />
            </div>

            {mode === "pupil" && (
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <Pill label="Scene luminance" value={`${solved.luminance.toFixed(solved.luminance < 10 ? 3 : 0)} cd/m²`} tone="neutral" />
                <Pill label="Retinal illuminance" value={`${solved.trolands.toExponential(1)} Td`} tone="neutral" />
              </div>
            )}

            <p className="mt-3 rounded border border-ink-700 bg-ink-850 px-2 py-1.5 text-[10px] leading-relaxed text-ink-400">
              {mode === "accommodation"
                ? solved.beyondNearPoint
                  ? `Closer than the near point (${(1 / EYE.accommodationAmplitude) * 100} cm). The lens is already at maximum curvature and still cannot bend the light enough — this is why small print has to be held at arm's length as the lens stiffens with age.`
                  : solved.inFocus
                    ? "Sharp: the ciliary muscle is supplying exactly the accommodation this distance demands, so the rays cross precisely at the fovea."
                    : `Blurred by ${solved.blurArcmin.toFixed(1)} arcmin. The focus lands ${Math.abs(solved.focusError * 1000).toFixed(2)} mm ${solved.focusError > 0 ? "behind" : "in front of"} the retina, so each object point paints a disc instead of a point.`
                : `The pupil is a coarse control: from starlight to direct sun the light changes by a factor of about 10⁸, and the reflex answers with barely a 14× change in area. Most adaptation is photochemical, in the receptors themselves.`}
            </p>
          </HudPanel>

          {mode === "accommodation" && (
            <HudPanel title="Retinal image" icon={Aperture}>
              <VisionPreview solved={solved} enabled={showBlur} />
              <p className="mt-2 text-[10px] leading-relaxed text-ink-500">
                {showBlur
                  ? "The chart is blurred by the actual retinal blur circle — turn auto-accommodate off and move the object to watch it soften."
                  : "Blur preview disabled; the chart is shown as a perfectly focused eye would see it."}
              </p>
            </HudPanel>
          )}
        </div>
      )}
    </div>
  );
}

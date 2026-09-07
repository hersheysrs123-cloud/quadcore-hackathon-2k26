"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import {
  Aperture,
  Eye,
  Focus,
  Layers,
  Microscope,
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
  hashRandom,
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

// ─── Human eye · accommodation, the pupil reflex and gross anatomy ──
// A cutaway eyeball whose every moving part is driven by `lib/eyeOptics.js`:
// the lens curvature, the ray convergence point, the pupil aperture and the
// status pills all read the same solved model, so the picture and the numbers
// cannot disagree.
//
// Everything that does NOT move — the corneal layers, the anterior chamber
// and its drainage angle, the ciliary processes, the ora serrata, the macula,
// the retinal vasculature, the optic nerve and its sheath, and the rectus
// muscles slung round the globe — is here because a diagram that shows only
// the four parts that happen to be animated teaches an eye with four parts.
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
  /** Central corneal thickness — half a millimetre of five ordered layers. */
  corneaThickness: 0.55,
  /** Semi-diameter of the clear cornea, so the limbus lands at 11.6 mm across. */
  corneaSemiDiameter: 5.8,
  ciliaryPlane: -6.2,
  irisOuterRadius: 6,
  /** Iris is a real 0.5 mm slab, not a sheet of paper. */
  irisThickness: 0.5,
  /** Where the retina stops and the ciliary body takes over. */
  oraSerrataPlane: -7.5,
  /** Optic disc, nasal to the fovea — hence a blind spot, not a second fovea. */
  opticDiscOffset: -4.2,
  /** Macula lutea: the 5.5 mm pigmented patch the fovea sits in the middle of. */
  maculaRadius: 2.75,
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

/** …and the same primitives left whole, for the intact-globe view. */
const WHOLE = { phiStart: 0, phiLength: Math.PI * 2 };
const RING_WHOLE = { thetaStart: 0, thetaLength: Math.PI * 2 };

const cutOf = (open) => (open ? CUT : WHOLE);
const sphereCutOf = (open) => (open ? SPHERE_CUT : WHOLE);
const ringCutOf = (open) => (open ? RING_CUT : RING_WHOLE);

/** Angular half-width of the corneal opening in the sclera, radians. */
const LIMBUS = 0.55;

const TISSUE = {
  sclera: "#e9e6dd",
  episclera: "#dcd6c6",
  cornea: "#a9d9f0",
  stroma: "#c3e6f6",
  aqueous: "#7fc7e8",
  iris: "#3f7fa8",
  irisDark: "#1e4258",
  irisPigment: "#14202c",
  lens: "#ffe8a3",
  nucleus: "#ffd977",
  capsule: "#fff6d8",
  ciliary: "#c96f7a",
  processes: "#e08a94",
  zonule: "#dfe6ee",
  vitreous: "#bfe3f2",
  retina: "#d4646f",
  macula: "#b8484f",
  fovea: "#f0a33c",
  nerve: "#e4c98f",
  sheath: "#cfc3a0",
  vessel: "#c1343f",
  choroid: "#8a4d54",
  muscle: "#c05a52",
  tendon: "#e7dcc6",
  trabecular: "#8fb8cc",
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
function lensProfile(radiusM, semiDiameterM, thicknessM, segments = 26, scale = 1) {
  const R = radiusM * 1000;
  const h = semiDiameterM * 1000 * scale;
  const T = thicknessM * 1000 * scale;
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

/**
 * The lens is not homogeneous: a stiff nucleus sits inside a softer cortex,
 * both wrapped in an elastic capsule. That layering is the whole reason
 * presbyopia happens — the nucleus hardens with age until the capsule can no
 * longer round the lens up, however hard the ciliary muscle pulls.
 */
function CrystallineLens({ solved, cutaway, highlight }) {
  const cut = cutOf(cutaway);

  const cortex = useMemo(
    () =>
      new THREE.LatheGeometry(
        lensProfile(solved.lensRadius, solved.lensSemiDiameter, solved.lensThickness),
        60,
        cut.phiStart,
        cut.phiLength,
      ),
    [solved.lensRadius, solved.lensSemiDiameter, solved.lensThickness, cut],
  );

  const nucleus = useMemo(
    () =>
      new THREE.LatheGeometry(
        lensProfile(solved.lensRadius * 0.72, solved.lensSemiDiameter, solved.lensThickness, 22, 0.6),
        48,
        cut.phiStart,
        cut.phiLength,
      ),
    [solved.lensRadius, solved.lensSemiDiameter, solved.lensThickness, cut],
  );

  useEffect(() => () => cortex.dispose(), [cortex]);
  useEffect(() => () => nucleus.dispose(), [nucleus]);

  return (
    <group position={[0, mm(ANATOMY.lensPlane), 0]}>
      {/* Cortex + capsule. */}
      <mesh geometry={cortex}>
        <meshPhysicalMaterial
          color={TISSUE.lens}
          emissive={TISSUE.lens}
          // Enough transmission to read as glass, not so much that the amber
          // vanishes into the red of the retina behind it.
          emissiveIntensity={highlight ? 0.6 : 0.22}
          transmission={0.42}
          thickness={1.2}
          roughness={0.08}
          metalness={0}
          ior={1.42}
          clearcoat={1}
          transparent
          opacity={0.96}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Nucleus — visibly denser, and the part that stiffens with age. */}
      <mesh geometry={nucleus}>
        <meshPhysicalMaterial
          color={TISSUE.nucleus}
          transmission={0.35}
          roughness={0.15}
          ior={1.45}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ─── Shells ─────────────────────────────────────────────────────────

/** Sclera, choroid and retina as nested half-shells, so the layers read. */
function EyeShells({ layers, cutaway, highlight }) {
  const cut = sphereCutOf(cutaway);
  const shells = [
    {
      id: "sclera",
      r: ANATOMY.eyeRadius,
      colour: TISSUE.sclera,
      // Whole-globe view: the sclera has to be the white of the eye, not a
      // ghost you can see the retina through.
      opacity: cutaway ? 0.3 : 0.97,
      on: layers.sclera,
    },
    { id: "choroid", r: ANATOMY.eyeRadius - 0.45, colour: TISSUE.choroid, opacity: 0.5, on: layers.choroid },
    { id: "retina", r: ANATOMY.eyeRadius - 0.85, colour: TISSUE.retina, opacity: 0.72, on: layers.retina },
  ].filter((s) => s.on);

  return (
    <group>
      {shells.map((layer) => (
        <mesh key={layer.id}>
          {/* theta runs from the posterior pole, so the cap to remove is the
              ANTERIOR one where the cornea takes over — trimmed off the end,
              not the start. */}
          <sphereGeometry
            args={[mm(layer.r), 64, 44, cut.phiStart, cut.phiLength, 0, Math.PI - LIMBUS]}
          />
          <meshStandardMaterial
            color={layer.colour}
            emissive={layer.colour}
            emissiveIntensity={highlight === layer.id ? 0.45 : 0}
            transparent
            opacity={layer.opacity}
            roughness={0.55}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Vitreous body — the bulk of the globe. */}
      {layers.vitreous && cutaway && (
        <mesh>
          <sphereGeometry args={[mm(ANATOMY.eyeRadius - 1.1), 48, 36, cut.phiStart, cut.phiLength]} />
          <meshPhysicalMaterial
            color={TISSUE.vitreous}
            transmission={0.85}
            thickness={2}
            roughness={0.2}
            transparent
            opacity={highlight === "vitreous" ? 0.42 : 0.24}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

/**
 * The cornea, as two surfaces rather than one.
 *
 * Its front and back faces have different radii — 7.8 mm and 6.5 mm — and the
 * pair of them is where about 43 of the eye's 60 dioptres comes from. Drawing
 * it as a single shell hides the fact that it is a lens at all.
 */
function Cornea({ cutaway, highlight }) {
  const cut = cutOf(cutaway);

  const build = useCallback(
    (R, offset, semi) => {
      const centre = ANATOMY.corneaVertex + offset + R;
      const pts = [];
      const maxAngle = Math.asin(clamp(semi / R, 0, 1));
      for (let i = 0; i <= 30; i += 1) {
        const a = (maxAngle * i) / 30;
        pts.push(new THREE.Vector2(mm(R * Math.sin(a)), mm(centre - R * Math.cos(a))));
      }
      return new THREE.LatheGeometry(pts, 60, cut.phiStart, cut.phiLength);
    },
    [cut],
  );

  const anterior = useMemo(() => build(ANATOMY.corneaRadius, 0, ANATOMY.corneaSemiDiameter), [build]);
  const posterior = useMemo(
    () => build(6.5, ANATOMY.corneaThickness, ANATOMY.corneaSemiDiameter * 0.97),
    [build],
  );
  useEffect(() => () => anterior.dispose(), [anterior]);
  useEffect(() => () => posterior.dispose(), [posterior]);

  return (
    <group>
      <mesh geometry={anterior}>
        <meshPhysicalMaterial
          color={TISSUE.cornea}
          emissive={TISSUE.cornea}
          emissiveIntensity={highlight === "cornea" ? 0.6 : 0.14}
          transmission={0.82}
          thickness={0.5}
          roughness={0.03}
          ior={1.376}
          clearcoat={1}
          transparent
          opacity={cutaway ? 0.6 : 0.45}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Posterior surface — the endothelium, and the reason the cornea is a
          two-surface lens rather than a curved window. */}
      <mesh geometry={posterior}>
        <meshPhysicalMaterial
          color={TISSUE.stroma}
          transmission={0.85}
          roughness={0.06}
          ior={1.376}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/**
 * The anterior chamber, and the drainage angle in its corner.
 *
 * Aqueous humour is secreted behind the iris, flows through the pupil and
 * leaves through the trabecular meshwork in the angle. Block that outlet and
 * pressure rises: it is the anatomy behind glaucoma, and it is invisible
 * unless the chamber is drawn as a volume with a corner.
 */
function AnteriorChamber({ cutaway, highlight }) {
  const cut = cutOf(cutaway);

  const R = 6.5;
  const semi = ANATOMY.corneaSemiDiameter * 0.97;
  const maxAngle = Math.asin(clamp(semi / R, 0, 1));
  /** The corner itself: where the cornea's back meets the root of the iris. */
  const angleY =
    (ANATOMY.corneaVertex + ANATOMY.corneaThickness + R - R * Math.cos(maxAngle) + ANATOMY.pupilPlane) / 2;

  const geometry = useMemo(() => {
    const centre = ANATOMY.corneaVertex + ANATOMY.corneaThickness + R;
    const pts = [];
    for (let i = 0; i <= 24; i += 1) {
      const a = (maxAngle * i) / 24;
      pts.push(new THREE.Vector2(mm(R * Math.sin(a)), mm(centre - R * Math.cos(a))));
    }
    // …then back along the front of the iris to the axis, closing the volume.
    pts.push(new THREE.Vector2(mm(semi * 0.99), mm(ANATOMY.pupilPlane - ANATOMY.irisThickness / 2)));
    pts.push(new THREE.Vector2(mm(0.05), mm(ANATOMY.pupilPlane - ANATOMY.irisThickness / 2)));
    return new THREE.LatheGeometry(pts, 52, cut.phiStart, cut.phiLength);
  }, [cut, maxAngle]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          color={TISSUE.aqueous}
          transmission={0.92}
          thickness={1.5}
          roughness={0.05}
          ior={1.336}
          transparent
          opacity={highlight === "aqueous" ? 0.4 : 0.16}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Trabecular meshwork, ringing the angle. */}
      <mesh position={[0, mm(angleY), 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[mm(6.05), mm(0.3), 10, 40]} />
        <meshStandardMaterial
          color={TISSUE.trabecular}
          emissive={TISSUE.trabecular}
          emissiveIntensity={highlight === "aqueous" ? 0.8 : 0.2}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}

/**
 * The iris as a real slab of tissue: pigmented behind, stroma in front, with
 * a hole in it that the reflex opens and closes.
 */
function Iris({ pupilRadiusMm, cutaway, highlight }) {
  const cut = cutOf(cutaway);
  const rInner = Math.max(pupilRadiusMm, 0.4);
  const t = ANATOMY.irisThickness / 2;

  const geometry = useMemo(() => {
    // Cross-section of the annulus, bowed very slightly forward as the real
    // iris is where it rests on the front of the lens.
    const pts = [
      new THREE.Vector2(mm(rInner), mm(-t * 0.8)),
      new THREE.Vector2(mm(rInner + 0.35), mm(-t)),
      new THREE.Vector2(mm(ANATOMY.irisOuterRadius), mm(-t * 0.6)),
      new THREE.Vector2(mm(ANATOMY.irisOuterRadius), mm(t * 0.6)),
      new THREE.Vector2(mm(rInner + 0.35), mm(t)),
      new THREE.Vector2(mm(rInner), mm(t * 0.8)),
    ];
    return new THREE.LatheGeometry(pts, 52, cut.phiStart, cut.phiLength);
  }, [rInner, t, cut]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const ring = ringCutOf(cutaway);

  return (
    <group position={[0, mm(ANATOMY.pupilPlane), 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={TISSUE.iris}
          emissive={TISSUE.iris}
          emissiveIntensity={highlight === "iris" ? 0.55 : 0.05}
          roughness={0.62}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Posterior pigment epithelium — two cell layers of pure black, which
          is what makes the pupil look like a hole rather than a window. */}
      <mesh position={[0, mm(t * 0.9), 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry
          args={[mm(rInner), mm(ANATOMY.irisOuterRadius), 52, 1, ring.thetaStart, ring.thetaLength]}
        />
        <meshStandardMaterial color={TISSUE.irisPigment} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/**
 * Ciliary ring, its processes, and the zonules it pulls on.
 *
 * The counter-intuitive part made visible: as the muscle contracts it moves
 * INWARD, which shortens the span it has to bridge, so the zonules go slack
 * and the lens is released to round up.
 */
function CiliaryApparatus({ solved, showZonules, cutaway, highlight }) {
  const cut = cutOf(cutaway);
  const ringRadius = solved.ciliary.ciliaryRingRadius * 1000;
  const slack = 1 - solved.ciliary.effort;

  const zonules = useMemo(() => {
    const lensEdge = solved.lensSemiDiameter * 1000;
    const strands = [];
    const count = 16;
    for (let i = 0; i <= count; i += 1) {
      const phi = cut.phiStart + (cut.phiLength * i) / count;
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
  }, [ringRadius, slack, solved.lensSemiDiameter, cut]);

  /**
   * Ciliary processes: ~70 radial folds in life, which is what actually
   * secretes the aqueous humour. Drawn as ridges leaning in toward the lens
   * so the ring reads as a pleated collar rather than a smooth doughnut.
   */
  const processes = useMemo(() => {
    const out = [];
    const count = 22;
    for (let i = 0; i < count; i += 1) {
      const phi = cut.phiStart + (cut.phiLength * (i + 0.5)) / count;
      out.push({ phi, x: Math.sin(phi), z: Math.cos(phi) });
    }
    return out;
  }, [cut]);

  return (
    <group>
      <mesh position={[0, mm(ANATOMY.ciliaryPlane), 0]} rotation={[Math.PI / 2, 0, 0]}>
        {/* Drawn whole: torusGeometry sweeps from a fixed zero, so a half arc
            lands on the wrong side of the cut, and a complete ring reads as a
            ring anyway through the translucent shells. */}
        <torusGeometry args={[mm(ringRadius + 1.4), mm(1.1), 16, 48]} />
        <meshStandardMaterial
          color={TISSUE.ciliary}
          emissive={TISSUE.ciliary}
          emissiveIntensity={(highlight === "ciliary" ? 0.6 : 0.15) + solved.ciliary.effort * 0.5}
          roughness={0.5}
        />
      </mesh>

      {processes.map((p, i) => (
        <mesh
          key={i}
          position={[
            mm(ringRadius + 0.2) * p.x,
            mm(ANATOMY.ciliaryPlane + 0.6),
            mm(ringRadius + 0.2) * p.z,
          ]}
          rotation={[0, p.phi, Math.PI / 2]}
        >
          <coneGeometry args={[mm(0.34), mm(1.7), 6]} />
          <meshStandardMaterial color={TISSUE.processes} roughness={0.55} />
        </mesh>
      ))}

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

/**
 * Ora serrata — the scalloped frontier where the retina simply stops.
 *
 * Worth drawing because it answers a question the smooth red shell provokes:
 * the retina does not carry on all the way to the iris, and the gap is why a
 * detachment usually starts out here rather than at the back.
 */
function OraSerrata({ cutaway }) {
  const cut = cutOf(cutaway);
  const y = ANATOMY.oraSerrataPlane;
  const r = Math.sqrt(Math.max(ANATOMY.eyeRadius ** 2 - y * y, 0)) - 0.85;

  const points = useMemo(() => {
    const pts = [];
    const steps = 96;
    for (let i = 0; i <= steps; i += 1) {
      const phi = cut.phiStart + (cut.phiLength * i) / steps;
      // 18 teeth: the "serrata" is not decorative, it is the actual margin.
      const tooth = Math.abs(Math.sin(phi * 9)) * 0.5;
      pts.push([mm(r) * Math.sin(phi), mm(y + tooth), mm(r) * Math.cos(phi)]);
    }
    return pts;
  }, [cut, r, y]);

  return <Line points={points} color={TISSUE.macula} lineWidth={2} transparent opacity={0.8} />;
}

// ─── The back of the eye ────────────────────────────────────────────

/** A point on the retinal shell, `rho` radians from `dir` at bearing `theta`. */
function walkSphere(radius, dir, e1, e2, rho, theta) {
  return new THREE.Vector3()
    .copy(dir)
    .multiplyScalar(Math.cos(rho))
    .addScaledVector(e1, Math.sin(rho) * Math.cos(theta))
    .addScaledVector(e2, Math.sin(rho) * Math.sin(theta))
    .multiplyScalar(radius);
}

/**
 * Retinal vessels, fanning out from the optic disc.
 *
 * They are generated on the retinal sphere rather than drawn on a flat card,
 * because the one thing an ophthalmoscope view teaches is that every vessel
 * in the eye enters at ONE point — the disc — and that is only obvious if they
 * all visibly radiate from it.
 */
function retinalVessels(radiusMm, dir, cutaway) {
  const e1 = new THREE.Vector3(1, 0, 0);
  const tmp = new THREE.Vector3().crossVectors(dir, e1);
  if (tmp.lengthSq() < 1e-6) e1.set(0, 0, 1);
  const a1 = new THREE.Vector3().crossVectors(dir, e1).normalize();
  const a2 = new THREE.Vector3().crossVectors(dir, a1).normalize();

  const strands = [];
  const trunks = 6;
  for (let k = 0; k < trunks; k += 1) {
    const base = (k / trunks) * Math.PI * 2 + 0.3;
    const wob = (hashRandom(k + 1) - 0.5) * 0.8;
    const reach = 0.95 + hashRandom(k + 11) * 0.5;
    const trunk = [];
    for (let s = 0; s <= 16; s += 1) {
      const rho = (reach * s) / 16;
      const theta = base + Math.sin(rho * 3.4) * 0.28 + wob * rho;
      trunk.push({ v: walkSphere(radiusMm, dir, a1, a2, rho, theta), w: 1 - s / 22 });
    }
    strands.push(trunk);

    // Two branches per trunk, leaving at a shallow angle as real ones do.
    for (const [at, sign] of [[0.4, 1], [0.68, -1]]) {
      const branch = [];
      const rho0 = reach * at;
      const theta0 = base + Math.sin(rho0 * 3.4) * 0.28 + wob * rho0;
      for (let s = 0; s <= 10; s += 1) {
        const rho = rho0 + ((reach - rho0) * 0.8 * s) / 10;
        const theta = theta0 + sign * 0.42 * ((rho - rho0) / Math.max(reach - rho0, 1e-3));
        branch.push({ v: walkSphere(radiusMm, dir, a1, a2, rho, theta), w: 0.55 - s / 30 });
      }
      strands.push(branch);
    }
  }

  // Only the kept half of the cutaway has anything to draw on.
  const out = [];
  for (const strand of strands) {
    let run = [];
    for (const p of strand) {
      if (!cutaway || p.v.z <= 0.02) run.push(p);
      else {
        if (run.length > 1) out.push(run);
        run = [];
      }
    }
    if (run.length > 1) out.push(run);
  }
  return out;
}

function PosteriorDetail({ cutaway, highlight, showVessels }) {
  const ring = ringCutOf(cutaway);
  const retinaR = ANATOMY.eyeRadius - 0.85;

  // Direction of the optic disc from the centre of the globe: nasal to the
  // fovea, which is why the blind spot is off to one side of fixation.
  const discDir = useMemo(
    () => new THREE.Vector3(0, ANATOMY.retina - 2.2, ANATOMY.opticDiscOffset).normalize(),
    [],
  );
  const discPos = useMemo(() => discDir.clone().multiplyScalar(mm(retinaR)), [discDir, retinaR]);
  const discQuat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), discDir),
    [discDir],
  );

  const vessels = useMemo(
    () => (showVessels ? retinalVessels(mm(retinaR - 0.05), discDir, cutaway) : []),
    [showVessels, retinaR, discDir, cutaway],
  );

  return (
    <group>
      {/* Macula lutea — the pigmented patch the fovea sits at the centre of. */}
      <mesh position={[0, mm(ANATOMY.retina - 1.35), 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[mm(ANATOMY.maculaRadius), 40]} />
        <meshStandardMaterial
          color={TISSUE.macula}
          emissive={TISSUE.macula}
          emissiveIntensity={highlight === "fovea" ? 0.6 : 0.12}
          side={THREE.DoubleSide}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Fovea — the pit on the visual axis where acuity is highest. */}
      <mesh position={[0, mm(ANATOMY.retina - 1.15), 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[mm(0.85), 24]} />
        <meshStandardMaterial
          color={TISSUE.fovea}
          emissive={TISSUE.fovea}
          emissiveIntensity={highlight === "fovea" ? 1.6 : 0.8}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {/* Retinal vasculature, all of it entering at the disc. */}
      {vessels.map((strand, i) => (
        <Line
          key={i}
          points={strand.map((p) => [p.v.x, p.v.y, p.v.z])}
          color={TISSUE.vessel}
          lineWidth={Math.max(strand[0].w * 2.4, 0.7)}
          transparent
          opacity={0.75}
        />
      ))}

      {/* Optic disc: no photoreceptors on it, which is why it is the blind
          spot rather than a second fovea. */}
      <mesh position={discPos} quaternion={discQuat}>
        <cylinderGeometry args={[mm(0.9), mm(0.9), mm(0.12), 24]} />
        <meshStandardMaterial
          color="#f2ead4"
          emissive="#f2ead4"
          emissiveIntensity={highlight === "opticNerve" ? 0.8 : 0.15}
        />
      </mesh>

      {/* Optic nerve, leaving along the disc's own axis with its dural sheath
          around it — the nerve does not exit down the optical axis. */}
      <group position={discPos} quaternion={discQuat}>
        <mesh position={[0, mm(2.6), 0]}>
          <cylinderGeometry args={[mm(1.5), mm(1.7), mm(5.4), 20]} />
          <meshStandardMaterial
            color={TISSUE.nerve}
            emissive={TISSUE.nerve}
            emissiveIntensity={highlight === "opticNerve" ? 0.5 : 0}
            roughness={0.6}
          />
        </mesh>
        <mesh position={[0, mm(2.8), 0]}>
          <cylinderGeometry args={[mm(2.1), mm(2.35), mm(5.2), 20, 1, true]} />
          <meshStandardMaterial
            color={TISSUE.sheath}
            roughness={0.7}
            transparent
            opacity={0.55}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Central retinal artery and vein, running inside the nerve. */}
        <mesh position={[0, mm(2.6), 0]}>
          <cylinderGeometry args={[mm(0.28), mm(0.28), mm(5.6), 10]} />
          <meshStandardMaterial color={TISSUE.vessel} emissive={TISSUE.vessel} emissiveIntensity={0.35} />
        </mesh>
      </group>

      {/* Blind-spot marker, so the disc is named as well as drawn. */}
      <mesh position={discPos} quaternion={discQuat}>
        <ringGeometry args={[mm(1.0), mm(1.25), 28, 1, ring.thetaStart, ring.thetaLength]} />
        <meshBasicMaterial color={PALETTE.slate} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/**
 * Two of the six extraocular muscles, slung from the back of the orbit onto
 * the sclera just behind the limbus.
 *
 * They are the reason the globe is a ball at all, and they set the scale: the
 * eye is not a free-floating lens system, it is a 24 mm sphere on gimbals.
 */
function ExtraocularMuscles({ show }) {
  const straps = useMemo(() => {
    if (!show) return [];
    const out = [];
    // World up after the scene's axis rotation is internal −X, so ±X is the
    // superior / inferior pair.
    for (const side of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 24; i += 1) {
        const beta = lerp(0.30, 1.94, i / 24);
        const r = ANATOMY.eyeRadius + 0.45;
        pts.push(
          new THREE.Vector3(
            mm(side * r * Math.sin(beta)),
            mm(r * Math.cos(beta)),
            mm(-0.9 * Math.sin(beta)),
          ),
        );
      }
      out.push(new THREE.CatmullRomCurve3(pts));
    }
    return out;
  }, [show]);

  const geometries = useMemo(
    () => straps.map((curve) => new THREE.TubeGeometry(curve, 40, mm(1.5), 10, false)),
    [straps],
  );
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  return (
    <group>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={TISSUE.muscle} roughness={0.7} />
        </mesh>
      ))}
      {/* Tendons, pale where the muscle inserts into the sclera. */}
      {straps.map((curve, i) => (
        <mesh key={`t${i}`} position={curve.getPoint(1)}>
          <sphereGeometry args={[mm(1.6), 14, 12]} />
          <meshStandardMaterial color={TISSUE.tendon} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** The limbus: the grey-blue seam where clear cornea meets white sclera. */
function LimbusRing() {
  const maxAngle = Math.asin(clamp(ANATOMY.corneaSemiDiameter / ANATOMY.corneaRadius, 0, 1));
  const y = ANATOMY.corneaVertex + ANATOMY.corneaRadius - ANATOMY.corneaRadius * Math.cos(maxAngle);
  return (
    <mesh position={[0, mm(y - 0.25), 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[mm(6.05), mm(0.42), 12, 52]} />
      <meshStandardMaterial color={TISSUE.episclera} roughness={0.75} />
    </mesh>
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

// ─── The parts list ─────────────────────────────────────────────────

/**
 * Every structure the scene draws, with where it is and what it does.
 *
 * `anchor` is in the internal frame — radial x, axial y — so a label and a
 * highlight ring can be placed from the same single source as the prose.
 */
const PARTS = [
  {
    id: "cornea",
    name: "Cornea",
    anchor: [2.0, ANATOMY.corneaVertex - 0.4],
    tone: "text-sky-300",
    blurb:
      "The clear front window, five layers and about 0.55 mm thick. Its two curved surfaces supply roughly 43 of the eye's 60 dioptres — two thirds of all the focusing — and none of it is adjustable.",
  },
  {
    id: "aqueous",
    name: "Aqueous humour",
    anchor: [5.8, ANATOMY.pupilPlane - 1.2],
    tone: "text-sky-200",
    blurb:
      "Watery fluid made behind the iris, flowing forward through the pupil and draining out through the trabecular meshwork in the angle. It sets the pressure that holds the front of the eye in shape.",
  },
  {
    id: "iris",
    name: "Iris & pupil",
    anchor: [8.6, ANATOMY.pupilPlane + 0.4],
    tone: "text-sky-300",
    blurb:
      "A pigmented diaphragm with two antagonistic muscles: a circular sphincter at the margin that closes it, and radial dilator fibres that pull it open. Black behind, so the pupil reads as a hole.",
  },
  {
    id: "lens",
    name: "Crystalline lens",
    anchor: [-5.2, ANATOMY.lensPlane + 0.6],
    tone: "text-amber-200",
    blurb:
      "A stiff nucleus inside a softer cortex, wrapped in an elastic capsule. It adds about 20 D and is the only element that can change power — which it does by changing shape, not position.",
  },
  {
    id: "ciliary",
    name: "Ciliary body",
    anchor: [-9.4, ANATOMY.ciliaryPlane - 0.4],
    tone: "text-rose-300",
    blurb:
      "A muscular ring with ~70 folded processes. Contracting it moves it INWARD, which slackens the zonules and lets the lens round up — the opposite of what most people guess. It also secretes the aqueous.",
  },
  {
    id: "vitreous",
    name: "Vitreous humour",
    anchor: [6.6, 3],
    tone: "text-sky-200",
    blurb:
      "A clear gel filling four fifths of the globe's volume. It transmits light with almost no refraction and keeps the retina pressed against the wall behind it.",
  },
  {
    id: "retina",
    name: "Retina",
    anchor: [8.2, 7.5],
    tone: "text-rose-200",
    blurb:
      "The light-sensitive lining: rods for dim light out at the edges, cones for colour and detail toward the middle. It ends abruptly at the ora serrata, well short of the iris.",
  },
  {
    id: "fovea",
    name: "Fovea & macula",
    anchor: [4.2, ANATOMY.retina - 1],
    tone: "text-amber-300",
    blurb:
      "A 0.35 mm pit of pure cones at the centre of the yellow macula. Acuity there is twenty times better than a few degrees away, which is why the eye must be aimed rather than merely open.",
  },
  {
    id: "opticNerve",
    name: "Optic nerve & blind spot",
    anchor: [-4.4, ANATOMY.retina - 3.4],
    tone: "text-ink-200",
    blurb:
      "A million axons leaving through one hole in the retina, with the central retinal artery and vein running inside them. There are no receptors on the disc, so it is a genuine blind spot.",
  },
  {
    id: "sclera",
    name: "Sclera & choroid",
    anchor: [-9.6, 3],
    tone: "text-ink-200",
    blurb:
      "The tough white coat that gives the globe its shape, lined with the choroid — a dense blood supply that also acts as a black backdrop, soaking up stray light that would otherwise fog the image.",
  },
];

const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p]));

/** A pulsing marker on whichever structure the anatomy list has selected. */
function PartHighlight({ part }) {
  const ref = useRef(null);
  useFrame((state) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.12;
    ref.current.scale.set(s, s, s);
  });
  if (!part) return null;
  return (
    <group position={[mm(part.anchor[0]), mm(part.anchor[1]), 0]}>
      <mesh ref={ref}>
        <ringGeometry args={[mm(1.5), mm(1.9), 32]} />
        <meshBasicMaterial color={PALETTE.gold} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
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
  const pupilGroup = useRef(null);
  const target = solved.iris.diameterMm;
  const shown = useRef(target);

  useFrame((_, delta) => {
    // The real reflex takes a fraction of a second, and easing toward the
    // target is what makes constriction read as a *reflex* rather than a jump.
    const speed = animate ? clamp(delta * 6, 0, 1) : 1;
    shown.current += (target - shown.current) * speed;
    if (pupilGroup.current) {
      const r = Math.max(shown.current / 2, 0.2) * 0.36;
      pupilGroup.current.scale.set(r, r, 1);
    }
  });

  const sphincterActive = solved.iris.sphincter.startsWith("contracted");
  const dilatorActive = solved.iris.dilator.startsWith("contracted");

  /** Radial dilator fibres, with the stroma's crypts drawn among them. */
  const spokes = useMemo(() => {
    const out = [];
    for (let i = 0; i < 72; i += 1) {
      const a = (i / 72) * Math.PI * 2;
      const jitter = (hashRandom(i + 3) - 0.5) * 0.045;
      const outer = 2.05 - hashRandom(i + 40) * 0.12;
      out.push({
        pts: [
          [Math.cos(a + jitter) * 0.62, Math.sin(a + jitter) * 0.62, 0.01],
          [Math.cos(a) * outer, Math.sin(a) * outer, 0.01],
        ],
        heavy: i % 3 === 0,
      });
    }
    return out;
  }, []);

  /** Circular sphincter band, right at the pupil margin. */
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

  /** The collarette: the scalloped ridge where the two muscle beds meet. */
  const collarette = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 160; i += 1) {
      const a = (i / 160) * Math.PI * 2;
      const r = 1.16 + Math.sin(a * 11) * 0.06;
      pts.push([Math.cos(a) * r, Math.sin(a) * r, 0.03]);
    }
    return pts;
  }, []);

  /** Fine vessels on the white of the eye, outside the limbus. */
  const scleralVessels = useMemo(() => {
    const out = [];
    for (let i = 0; i < 14; i += 1) {
      const a = (i / 14) * Math.PI * 2 + hashRandom(i + 7);
      const pts = [];
      for (let s = 0; s <= 6; s += 1) {
        const r = 2.42 + (s / 6) * 1.0;
        const wob = Math.sin(s * 1.6 + i) * 0.05;
        pts.push([Math.cos(a + wob) * r, Math.sin(a + wob) * r, -0.03]);
      }
      out.push(pts);
    }
    return out;
  }, []);

  return (
    <group>
      {/* Sclera and its vessels. */}
      <mesh position={[0, 0, -0.06]}>
        <circleGeometry args={[3.5, 64]} />
        <meshStandardMaterial color="#f4f2ec" roughness={0.85} />
      </mesh>
      {scleralVessels.map((pts, i) => (
        <Line key={`v${i}`} points={pts} color="#d98b8b" lineWidth={1} transparent opacity={0.5} />
      ))}

      {/* Iris stroma. */}
      <mesh>
        <circleGeometry args={[2.05, 64]} />
        <meshStandardMaterial color={TISSUE.iris} roughness={0.7} />
      </mesh>

      {/* Radial dilator fibres — contract in the dark to haul the pupil open. */}
      {spokes.map((s, i) => (
        <Line
          key={i}
          points={s.pts}
          color={dilatorActive ? PALETTE.gold : TISSUE.irisDark}
          lineWidth={(dilatorActive ? 1.6 : 1) * (s.heavy ? 1.25 : 0.75)}
          transparent
          opacity={(dilatorActive ? 0.95 : 0.4) * (s.heavy ? 1 : 0.7)}
        />
      ))}

      {/* Collarette — the boundary between the two muscle beds. */}
      <Line points={collarette} color={TISSUE.irisDark} lineWidth={1.6} transparent opacity={0.65} />

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

      {/* The pupil itself: a hole, plus the pigmented ruff at its margin,
          both scaled together by the reflex. */}
      <group ref={pupilGroup} position={[0, 0, 0.05]}>
        <mesh>
          <circleGeometry args={[1, 48]} />
          <meshBasicMaterial color="#04070c" />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <ringGeometry args={[0.94, 1.06, 40]} />
          <meshBasicMaterial color={TISSUE.irisPigment} />
        </mesh>
      </group>

      {/* Limbus, and the specular highlight the tear film always carries. */}
      <mesh position={[0, 0, -0.02]}>
        <ringGeometry args={[2.05, 2.35, 64]} />
        <meshStandardMaterial color="#cfd6dd" roughness={0.8} />
      </mesh>
      <mesh position={[-0.72, 0.78, 0.3]}>
        <circleGeometry args={[0.24, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0.55, -0.62, 0.3]}>
        <circleGeometry args={[0.09, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
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
        camera={{ position: [0, 0, 7.4], fov: 45 }}
        controls={{ enablePan: false, minDistance: 4, maxDistance: 11 }}
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
  { value: "accommodation", label: "Focusing", title: "Accommodation — how the lens changes power" },
  { value: "pupil", label: "Pupil", title: "The pupil reflex" },
  { value: "anatomy", label: "Anatomy", title: "Structure by structure" },
];

const LIGHT_PRESETS = [
  { lux: 0.005, label: "Starlight" },
  { lux: 1, label: "Moonlit" },
  { lux: 400, label: "Indoors" },
  { lux: 100000, label: "Direct sun" },
];

const DEFAULT_LAYERS = { sclera: true, choroid: true, retina: true, vitreous: true };

export default function EyeCanvas({ onOpenQuiz }) {
  const [mode, setMode] = useState("accommodation");
  const [objectDistance, setObjectDistance] = useState(6);
  const [autoAccommodate, setAutoAccommodate] = useState(true);
  const [manualAccommodation, setManualAccommodation] = useState(0);
  const [showBlur, setShowBlur] = useState(true);
  const [logLux, setLogLux] = useState(2.6);
  const [rayMode, setRayMode] = useState("bundle");
  const [showZonules, setShowZonules] = useState(true);
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [cutaway, setCutaway] = useState(true);
  const [showVessels, setShowVessels] = useState(true);
  const [showMuscles, setShowMuscles] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedPart, setSelectedPart] = useState(null);
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

  const toggleLayer = useCallback(
    (key) => setLayers((l) => ({ ...l, [key]: !l[key] })),
    [],
  );

  const reset = useCallback(() => {
    setObjectDistance(6);
    setAutoAccommodate(true);
    setManualAccommodation(0);
    setLogLux(2.6);
    setRayMode("bundle");
    setShowBlur(true);
    setShowZonules(true);
    setLayers(DEFAULT_LAYERS);
    setCutaway(true);
    setShowVessels(true);
    setShowMuscles(false);
    setShowLabels(true);
    setSelectedPart(null);
    setShowRays(true);
  }, []);

  const demand = accommodationDemand(objectDistance);
  const part = selectedPart ? PART_BY_ID[selectedPart] : null;
  // Rays and the object marker only make sense in the optics modes.
  const optics = mode === "accommodation";

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
          <EyeShells layers={layers} cutaway={cutaway} highlight={selectedPart} />
          <ExtraocularMuscles show={showMuscles} />
          <Cornea cutaway={cutaway} highlight={selectedPart} />
          <LimbusRing />
          {cutaway && (
            <>
              <AnteriorChamber cutaway={cutaway} highlight={selectedPart} />
              <Iris pupilRadiusMm={solved.iris.diameterMm / 2} cutaway={cutaway} highlight={selectedPart} />
              <CrystallineLens solved={solved} cutaway={cutaway} highlight={selectedPart === "lens"} />
              <CiliaryApparatus
                solved={solved}
                showZonules={showZonules}
                cutaway={cutaway}
                highlight={selectedPart}
              />
              {layers.retina && <OraSerrata cutaway={cutaway} />}
              {layers.retina && (
                <PosteriorDetail cutaway={cutaway} highlight={selectedPart} showVessels={showVessels} />
              )}
            </>
          )}

          {optics && cutaway && (
            <>
              <ObjectMarker objectDistanceM={objectDistance} inFocus={solved.inFocus} />
              {showRays && (
                <RayBundle solved={solved} objectDistanceM={objectDistance} rayMode={rayMode} />
              )}
              <FocalMarker solved={solved} />
            </>
          )}

          <PartHighlight part={part} />

          {showLabels &&
            cutaway &&
            PARTS.map((p) => (
              <SceneLabel
                key={p.id}
                position={[mm(p.anchor[0]), mm(p.anchor[1]), 0]}
                tone={p.tone}
                accent={p.id === selectedPart}
              >
                {p.name}
              </SceneLabel>
            ))}
        </group>

        <SceneLegend
          corner="top-right"
          title={mode === "accommodation" ? "Accommodation" : mode === "pupil" ? "Pupil reflex" : "Anatomy"}
          items={
            mode === "accommodation"
              ? [
                  { color: solved.inFocus ? PALETTE.gold : PALETTE.rose, shape: "line", label: "Light rays", note: solved.inFocus ? "converging on the fovea" : "missing the retina" },
                  { color: TISSUE.lens, label: "Crystalline lens", note: solved.ciliary.lens },
                  { color: TISSUE.ciliary, label: "Ciliary muscle", note: solved.ciliary.muscle },
                  { color: TISSUE.zonule, shape: "line", label: "Zonules", note: solved.ciliary.zonules },
                  { color: PALETTE.slate, shape: "dash", label: "Object axis", note: "compressed — not to scale" },
                ]
              : mode === "pupil"
                ? [
                    { color: PALETTE.rose, shape: "line", label: "Sphincter", note: `circular · ${solved.iris.sphincter}` },
                    { color: PALETTE.gold, shape: "line", label: "Dilator", note: `radial · ${solved.iris.dilator}` },
                    { color: "#04070c", label: "Pupil", note: `${solved.iris.diameterMm.toFixed(2)} mm aperture` },
                    { color: TISSUE.retina, label: "Retina", note: "what the aperture is protecting" },
                  ]
                : PARTS.slice(0, 5).map((p) => ({ color: TISSUE.retina, label: p.name, note: p.blurb }))
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
              <Choice options={MODES} value={mode} onChange={setMode} columns={3} />

              {mode === "accommodation" && (
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
              )}

              {mode === "pupil" && (
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

              {mode === "anatomy" && (
                <p className="text-[10.5px] leading-relaxed text-ink-400">
                  Pick a structure below to ring it in the scene and read what it does. Peel the coats away with the
                  layer switches, or close the cutaway to see the whole globe with its muscles.
                </p>
              )}

              <div className="space-y-2 border-t border-ink-800 pt-2.5">
                <Toggle label="Cutaway view" checked={cutaway} onChange={setCutaway} />
                <Toggle label="Structure labels" checked={showLabels} onChange={setShowLabels} />
                <Toggle label="Show zonules" checked={showZonules} onChange={setShowZonules} />
                <Toggle label="Retinal blood vessels" checked={showVessels} onChange={setShowVessels} />
                <Toggle label="Eye muscles" checked={showMuscles} onChange={setShowMuscles} />
              </div>

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

          {/* ─── Peel the coats ───────────────────────── */}
          <HudPanel title="Coats of the globe" icon={Layers}>
            <div className="grid grid-cols-2 gap-1">
              {[
                ["sclera", "Sclera"],
                ["choroid", "Choroid"],
                ["retina", "Retina"],
                ["vitreous", "Vitreous"],
              ].map(([key, label]) => (
                <HudButton
                  key={key}
                  variant={layers[key] ? "primary" : "ghost"}
                  onClick={() => toggleLayer(key)}
                >
                  {label}
                </HudButton>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-ink-500">
              Three coats, outside in: the tough sclera, the vascular choroid that also blacks out stray light, and
              the retina itself. Switch one off to see what it was hiding.
            </p>
          </HudPanel>

          {/* ─── Structures ───────────────────────────── */}
          <HudPanel title="Structures" icon={Microscope}>
            <div className="grid grid-cols-2 gap-1">
              {PARTS.map((p) => (
                <HudButton
                  key={p.id}
                  variant={selectedPart === p.id ? "primary" : "ghost"}
                  onClick={() => setSelectedPart(selectedPart === p.id ? null : p.id)}
                >
                  {p.name}
                </HudButton>
              ))}
            </div>
            <p className="mt-2 rounded border border-ink-700 bg-ink-850 px-2 py-1.5 text-[10.5px] leading-relaxed text-ink-300">
              {part
                ? part.blurb
                : "Ten structures, each drawn where the anatomy actually puts it. Tap one to ring it in the scene."}
            </p>
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
              <Pill label="Lens thickness" value={`${(solved.lensThickness * 1000).toFixed(2)} mm`} tone="neutral" />
              <Pill label="Pupil" value={`${solved.iris.diameterMm.toFixed(2)} mm`} tone="neutral" />
              <Pill label="Axial length" value={`${(solved.axialLength * 1000).toFixed(1)} mm`} tone="neutral" />
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
                : mode === "pupil"
                  ? "The pupil is a coarse control: from starlight to direct sun the light changes by a factor of about 10⁸, and the reflex answers with barely a 14× change in area. Most adaptation is photochemical, in the receptors themselves."
                  : "Three coats, two fluid compartments and one adjustable lens, packed into 24 mm. Every number in this panel is measured off the same model the picture is drawn from."}
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

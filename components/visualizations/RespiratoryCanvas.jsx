"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  ChevronRight,
  ExternalLink,
  Gauge,
  Info,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Sparkles,
  X,
} from "lucide-react";
import {
  CANVAS_BG,
  PALETTE,
  SceneLabel,
  VectorArrow,
  WebGLCleanup,
  hashRandom,
} from "@/components/visualizations/scene-kit";
import {
  Slider,
  Toggle,
  ViewportHint,
} from "@/components/visualizations/VisualizationHUD";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { RESPIRATORY_MODEL_CREDITS } from "@/lib/respiratoryCredits";
import {
  PUSH_EVERY_S,
  RESPIRATORY_PHASES,
  breathAt,
  restingState,
} from "@/lib/respiratory";

// Preload the photorealistic medical 3D GLB assets
if (typeof window !== "undefined") {
  useGLTF.preload("/models/lung.glb");
  useGLTF.preload("/models/skeleton_ct.glb");
}

/**
 * Runs one callback per frame. Module scope, deliberately: declared inside the
 * component this is a new type on every render, and React unmounts and
 * remounts the subtree — re-subscribing useFrame each time.
 */
function FrameController({ onFrame }) {
  useFrame(onFrame);
  return null;
}

// ─── 3D Model Attribution & Open Source Licensing Metadata ──────────────
// RESPIRATORY_MODEL_CREDITS now lives in lib/respiratoryCredits.js, so the
// attribution test can assert against the table that actually ships.
export { RESPIRATORY_MODEL_CREDITS };

// ─── Physiological Constants & Formulations ──────────────────────────
// RESPIRATORY_PHASES and the breath arithmetic now live in lib/respiratory.js,
// so the auto-loop, the manual tableaux and the readout cannot disagree about
// what a tidal volume is. Re-exported because other modules import it here.
export { RESPIRATORY_PHASES };

const ANATOMICAL_PALETTE = {
  activeMuscle: "#ef4444",
  activeMuscleGlow: "#f43f5e",
  relaxedMuscle: "#881337",
  relaxedMuscleFiber: "#9f1239",
  boneIvory: "#f8f6f0",
  boneMarrow: "#e2dac7",
  cartilageHyaline: "#bae6fd",
  centralTendon: "#f8fafc",
  lungPleura: "#f472b6",
  lungOxygenated: "#fb7185",
  lungDeoxygenated: "#be185d",
  airwayInflow: "#38bdf8",
  airwayOutflow: "#fbbf24",
};

// ─── Procedural PBR Canvas Texture Generators ────────────────────────
function generateStriatedMuscleTexture() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  // Deep crimson muscle sarcoplasm base
  ctx.fillStyle = "#6b1426";
  ctx.fillRect(0, 0, 256, 256);

  // Longitudinal myofibrils
  for (let y = 0; y < 256; y += 2.5) {
    const alpha = 0.35 + Math.sin(y * 0.5) * 0.22;
    ctx.fillStyle = `rgba(225, 29, 72, ${alpha})`;
    ctx.fillRect(0, y, 256, 1.8);
  }

  // Sarcomere striation bands (Z-discs & A-bands)
  for (let x = 0; x < 256; x += 5.5) {
    const alpha = 0.2 + (x % 11 === 0 ? 0.35 : 0.12);
    ctx.fillStyle = `rgba(254, 205, 211, ${alpha})`;
    ctx.fillRect(x, 0, 1.5, 256);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 2);
  return texture;
}


function generatePearlyTendonTexture() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 90; i++) {
    const angle = (i / 90) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.lineTo(128 + Math.cos(angle) * 140, 128 + Math.sin(angle) * 140);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// ─── 3D Motion Vector Arrow Helper ────────────────────────────────────
function KinematicVector({ from, to, color, label, visible = true }) {
  if (!visible) return null;
  return (
    <VectorArrow
      from={from}
      to={to}
      color={color}
      radius={0.038}
      headLength={0.24}
      headRadius={0.095}
      label={label}
      opacity={0.94}
    />
  );
}

// ─── Real CT-Scanned Thoracic Skeleton (Ribs 1-12, Spine T1-T12, Sternum, Clavicles) ─
function RealisticCTSkeleton({ expansion = 0, cutaway = 0, visible = true }) {
  if (!visible) return null;
  const { scene } = useGLTF("/models/skeleton_ct.glb");
  const groupRef = useRef(null);
  const bonesMapRef = useRef(new Map());

  const isThoracicName = useCallback((name) => {
    return (
      /^(l_|r_)?rib\d+/i.test(name) ||
      /^t\d+(_|$)/i.test(name) ||
      /^l[1-3](_|$)/i.test(name) ||
      /sternum/i.test(name) ||
      /xiphoid/i.test(name) ||
      /^(l_|r_)?clavicle/i.test(name)
    );
  }, []);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    const map = new Map();

    const rootNode = clone.getObjectByName("RootNode");
    if (rootNode) {
      rootNode.children.forEach((child) => {
        const name = child.name || "";
        if (!isThoracicName(name)) {
          child.visible = false;
        } else {
          child.visible = true;
          // Track movable bones for kinematic breathing
          if (
            /^(l_|r_)?rib\d+$/i.test(name) ||
            /sternum/i.test(name) ||
            /xiphoid/i.test(name)
          ) {
            map.set(name.toLowerCase(), {
              node: child,
              origPos: child.position.clone(),
              origRot: child.rotation.clone(),
            });
          }
        }
      });
    }

    // Apply realistic ivory calcium bone material
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.material = new THREE.MeshStandardMaterial({
          color: ANATOMICAL_PALETTE.boneIvory,
          roughness: 0.38,
          metalness: 0.06,
        });
      }
    });

    bonesMapRef.current = map;
    return clone;
  }, [scene, isThoracicName]);

  useFrame(() => {
    if (!groupRef.current) return;

    // Cutaway opacity
    const opacity = cutaway > 0.8 ? Math.max(0.12, 1 - (cutaway - 0.8) * 4.5) : 1;
    clonedScene.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.transparent = opacity < 1;
        child.material.opacity = opacity;
      }
    });

    // Dynamic Kinematics: Bucket-handle and Pump-handle ribcage expansion
    bonesMapRef.current.forEach((data, name) => {
      const { node, origPos, origRot } = data;
      const ribMatch = name.match(/^(l_|r_)?rib(\d+)$/i);
      if (ribMatch) {
        const isLeft = ribMatch[1]?.toLowerCase().startsWith("l");
        const ribNum = parseInt(ribMatch[2], 10);

        // Bucket-handle lateral swing (predominant in ribs 3-10)
        const bucketRatio = Math.min(1, Math.max(0, (ribNum - 2) / 6));
        const roll = expansion * 0.048 * bucketRatio;
        node.rotation.z = origRot.z + (isLeft ? -roll : roll);

        // Pump-handle anterior elevation (predominant in ribs 1-6)
        const pumpRatio = Math.max(0, 1 - (ribNum - 1) / 6);
        node.rotation.x = origRot.x + expansion * 0.038 * pumpRatio;
      } else if (name.includes("sternum") || name.includes("xiphoid")) {
        // Pump-handle sternal elevation upward and forward
        node.position.y = origPos.y + expansion * 0.012;
        node.position.z = origPos.z + expansion * 0.016;
        node.rotation.x = origRot.x + expansion * 0.032;
      }
    });
  });

  return (
    <group
      ref={groupRef}
      position={[-0.01, -2.66 + expansion * 0.08, 0.26]}
      rotation={[0, 0, 0]}
      scale={[
        11.2 * (1 + expansion * 0.035),
        11.2,
        11.2 * (1 + expansion * 0.04),
      ]}
    >
      <primitive object={clonedScene} />
    </group>
  );
}

// ─── Ribcage Kinematic Motion Arrows ──────────────────────────────────
/**
 * The three arrows describing how the ribcage itself moves.
 *
 * These used to live at the tail of PhotorealisticIntercostalMuscles, which
 * drew 11 rib spaces x two oblique muscle layers -- every mesh carrying an
 * inline material that read `expansion`, `extTension` and `intTension` as
 * props. That geometry is gone; the arrows are not muscle, so they stayed.
 *
 * Bucket-handle and pump-handle motion are the two rib movements the topic
 * teaches, and they are a property of the ribs, not of what pulls them.
 */
function RibcageKinematicVectors({ expansion = 0 }) {
  return (
    <group>
      <KinematicVector
        from={[-1.4, 1.4, 0.1]}
        to={[-1.4 - expansion * 0.38, 1.4 + expansion * 0.35, 0.1 + expansion * 0.24]}
        color={expansion >= 0 ? PALETTE.rose : PALETTE.sky}
        label={expansion >= 0 ? "Ribcage Up & Out (Bucket-Handle)" : "Ribcage Recoil (Down & In)"}
      />
      <KinematicVector
        from={[1.4, 1.4, 0.1]}
        to={[1.4 + expansion * 0.38, 1.4 + expansion * 0.35, 0.1 + expansion * 0.24]}
        color={expansion >= 0 ? PALETTE.rose : PALETTE.sky}
        label={expansion >= 0 ? "Transverse Thorax Expansion" : "Passive Elastic Recoil"}
      />
      <KinematicVector
        from={[0, 1.8, 1.2]}
        to={[0, 1.8 + expansion * 0.36, 1.2 + expansion * 0.34]}
        color={PALETTE.gold}
        label="Pump-Handle AP Elevation"
      />
    </group>
  );
}

// ─── Sculpted Muscular Diaphragm Dome with Central Tendon, Hiatuses & Crura ───
function SculptedDiaphragmDome({
  expansion = 0,
  isContracted = false,
  showVectors = false,
  cutaway = 0,
  muscleTexture,
  tendonTexture,
}) {
  const meshRef = useRef(null);

  // Dynamic central tendon apex height (Y):
  // Resting / Expiration: arches high into the thoracic cavity at Y = 1.05
  // Inspiration (Active Contraction): flattens downward to Y = 0.63
  const domeApexY = useMemo(() => {
    return 1.05 - expansion * 0.42;
  }, [expansion]);

  // Initial parametric dome geometry
  const domeGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const radialSegments = 32;
    const rings = 16;
    const vertices = [];
    const uvs = [];
    const indices = [];

    // Center apex vertex
    vertices.push(0, 1.05, 0.25);
    uvs.push(0.5, 0.5);

    function getRim(angle) {
      const sinA = Math.sin(angle);
      const cosA = Math.cos(angle);
      const x = -sinA * 1.30;
      const z = 0.415 + cosA * 0.635;
      const y = 0.55 + cosA * 0.49;
      return { x, y, z };
    }

    for (let r = 1; r <= rings; r++) {
      const frac = r / rings;
      const profile = Math.cos(frac * (Math.PI / 2));
      for (let s = 0; s < radialSegments; s++) {
        const angle = (s / radialSegments) * Math.PI * 2;
        const rim = getRim(angle);
        const rightLiverBump = Math.sin(angle) < 0 ? 0.08 * profile * Math.abs(Math.sin(angle)) : 0;
        const vx = rim.x * frac;
        const vz = 0.25 + (rim.z - 0.25) * frac;
        const vy = rim.y + (1.05 - rim.y) * profile + rightLiverBump;
        vertices.push(vx, vy, vz);
        uvs.push(0.5 - Math.sin(angle) * frac * 0.5, 0.5 + Math.cos(angle) * frac * 0.5);
      }
    }

    for (let s = 0; s < radialSegments; s++) {
      const nextS = (s + 1) % radialSegments;
      indices.push(0, 1 + s, 1 + nextS);
    }

    for (let r = 1; r < rings; r++) {
      const ringStart = 1 + (r - 1) * radialSegments;
      const nextRingStart = 1 + r * radialSegments;
      for (let s = 0; s < radialSegments; s++) {
        const nextS = (s + 1) % radialSegments;
        const a = ringStart + s;
        const b = ringStart + nextS;
        const c = nextRingStart + s;
        const d = nextRingStart + nextS;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    geom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, []);

  useEffect(() => {
    return () => {
      domeGeometry.dispose();
    };
  }, [domeGeometry]);

  useFrame(() => {
    if (!meshRef.current) return;
    const pos = meshRef.current.geometry.attributes.position;
    const radialSegments = 32;
    const rings = 16;

    // Update apex
    pos.setY(0, domeApexY);

    function getRim(angle) {
      const cosA = Math.cos(angle);
      return 0.55 + cosA * 0.49;
    }

    let vIdx = 1;
    for (let r = 1; r <= rings; r++) {
      const frac = r / rings;
      const profile = Math.cos(frac * (Math.PI / 2));
      for (let s = 0; s < radialSegments; s++) {
        const angle = (s / radialSegments) * Math.PI * 2;
        const rimY = getRim(angle);
        const rightLiverBump = Math.sin(angle) < 0 ? 0.08 * profile * Math.abs(Math.sin(angle)) : 0;
        const vy = rimY + (domeApexY - rimY) * profile + rightLiverBump;
        pos.setY(vIdx, vy);
        vIdx++;
      }
    }

    pos.needsUpdate = true;
    meshRef.current.geometry.computeVertexNormals();
  });

  const muscleColor = isContracted ? ANATOMICAL_PALETTE.activeMuscle : "#881337";
  const emissiveIntensity = isContracted ? 1.6 : 0.14;
  const opacity = cutaway > 0.8 ? Math.max(0.2, 1 - (cutaway - 0.8) * 4) : 0.96;

  // 16 Radiating Muscular Fiber Slips
  const radialRays = useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2;
      return { angle, id: i };
    });
  }, []);

  const cruraScale = Math.max(0.2, Math.abs(domeApexY - (-0.65)));

  return (
    <group>
      {/* 3D Curved Muscular Diaphragm Dome Surface */}
      <mesh ref={meshRef} geometry={domeGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={muscleColor}
          emissive={muscleColor}
          emissiveIntensity={emissiveIntensity}
          map={muscleTexture}
          roughness={0.46}
          metalness={0.06}
          side={THREE.DoubleSide}
          transparent={opacity < 0.96}
          opacity={opacity}
        />
      </mesh>

      {/* Radiating Muscular Bundles */}
      {radialRays.map((ray) => {
        const x = -Math.sin(ray.angle) * 0.72;
        const z = 0.25 + Math.cos(ray.angle) * 0.52;
        const y = domeApexY - 0.12;
        return (
          <mesh
            key={ray.id}
            position={[x, y, z]}
            rotation={[-0.3 * Math.cos(ray.angle), ray.angle, -0.3 * Math.sin(ray.angle)]}
          >
            <cylinderGeometry args={[0.032, 0.046, 0.65, 8]} />
            <meshStandardMaterial
              color={muscleColor}
              emissive={muscleColor}
              emissiveIntensity={emissiveIntensity * 0.85}
              roughness={0.46}
              transparent
              opacity={opacity * 0.92}
            />
          </mesh>
        );
      })}

      {/* Trifoliate Central Tendon with Anatomical Hiatuses */}
      <group position={[0, domeApexY + 0.02, 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
        {/* Anterior Leaflet */}
        <mesh position={[0, 0.16, 0]}>
          <circleGeometry args={[0.38, 24]} />
          <meshStandardMaterial
            color={ANATOMICAL_PALETTE.centralTendon}
            map={tendonTexture}
            roughness={0.25}
            metalness={0.12}
            side={THREE.DoubleSide}
            transparent={opacity < 0.96}
            opacity={opacity * 0.98}
          />
        </mesh>
        {/* Right Leaflet */}
        <mesh position={[0.30, -0.08, 0]}>
          <circleGeometry args={[0.34, 24]} />
          <meshStandardMaterial
            color={ANATOMICAL_PALETTE.centralTendon}
            map={tendonTexture}
            roughness={0.25}
            metalness={0.12}
            side={THREE.DoubleSide}
            transparent={opacity < 0.96}
            opacity={opacity * 0.98}
          />
        </mesh>
        {/* Left Leaflet */}
        <mesh position={[-0.30, -0.08, 0]}>
          <circleGeometry args={[0.32, 24]} />
          <meshStandardMaterial
            color={ANATOMICAL_PALETTE.centralTendon}
            map={tendonTexture}
            roughness={0.25}
            metalness={0.12}
            side={THREE.DoubleSide}
            transparent={opacity < 0.96}
            opacity={opacity * 0.98}
          />
        </mesh>

        {/* Anatomical Aperture 1: Caval Opening (T8 Level, right leaflet) */}
        <mesh position={[0.22, 0.06, 0.01]}>
          <circleGeometry args={[0.075, 16]} />
          <meshBasicMaterial color="#020617" side={THREE.DoubleSide} />
        </mesh>

        {/* Anatomical Aperture 2: Esophageal Hiatus (T10 Level, muscular) */}
        <mesh position={[-0.06, -0.16, 0.01]}>
          <circleGeometry args={[0.07, 16]} />
          <meshBasicMaterial color="#020617" side={THREE.DoubleSide} />
        </mesh>

        {/* Anatomical Aperture 3: Aortic Hiatus (T12 Level, posterior midline) */}
        <mesh position={[0, -0.38, 0.01]}>
          <circleGeometry args={[0.08, 16]} />
          <meshBasicMaterial color="#020617" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Lumbar Crura Anchoring into L1-L3 Vertebrae */}
      <mesh
        position={[0.07, (domeApexY - 0.70) / 2, -0.18]}
        rotation={[0.22, 0, 0]}
        scale={[1, cruraScale, 1]}
      >
        <cylinderGeometry args={[0.085, 0.075, 1.0, 12]} />
        <meshStandardMaterial color="#881337" roughness={0.48} transparent opacity={opacity} />
      </mesh>
      <mesh
        position={[-0.07, (domeApexY - 0.38) / 2, -0.18]}
        rotation={[0.22, 0, 0]}
        scale={[1, cruraScale, 1]}
      >
        <cylinderGeometry args={[0.08, 0.07, 1.0, 12]} />
        <meshStandardMaterial color="#881337" roughness={0.48} transparent opacity={opacity} />
      </mesh>

      {showVectors && (
        <KinematicVector
          from={[0, 1.05, 0.25]}
          to={[0, domeApexY, 0.25]}
          color={expansion >= 0 ? PALETTE.rose : PALETTE.sky}
          label={expansion >= 0 ? "Diaphragm Descent & Flattening (Vertical Lift)" : "Elastic Dome Recoil"}
        />
      )}
    </group>
  );
}

// ─── Photorealistic Medical Scanned Lungs (GLB Model Asset) ───────────
function PhotorealisticMedicalLungs({ expansion = 0, cutaway = 0 }) {
  const { scene } = useGLTF("/models/lung.glb");
  const modelRef = useRef(null);

  // Clone scene so materials can be safely customized
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = Array.isArray(child.material)
          ? child.material.map((m) => m.clone())
          : child.material.clone();
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  useFrame(() => {
    if (!modelRef.current) return;
    // Anatomical 3D volume expansion driving synchronous lateral, vertical, and AP swelling
    const baseScale = 11.2;
    const sX = baseScale * (1 + expansion * 0.12);
    const sY = baseScale * (1 + expansion * 0.16);
    const sZ = baseScale * (1 + expansion * 0.14);
    modelRef.current.scale.set(sX, sY, sZ);

    // Apply cutaway opacity to all lung materials
    const opacity = cutaway > 0 ? Math.max(0.18, 1 - cutaway * 0.82) : 1;
    modelRef.current.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.transparent = opacity < 1;
        child.material.opacity = opacity;
        child.material.roughness = 0.38;
      }
    });
  });

  return (
    <group
      ref={modelRef}
      position={[0, 0.42 + expansion * 0.04, 0.82]}
      rotation={[0, 0, 0]}
    >
      <primitive object={clonedScene} />
    </group>
  );
}

// ─── Dynamic Airway Particle Streams (Trachea & Bronchi) ───────────────
function AirwayParticleStream({ flowRate = 0, active = true }) {
  const particleCount = 180;
  const meshRef = useRef(null);

  const paths = useMemo(() => {
    const leftBranch = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 3.45, 0.35),
      new THREE.Vector3(0, 2.75, 0.28),
      new THREE.Vector3(0, 2.05, 0.16),
      new THREE.Vector3(-0.42, 1.72, 0.14),
      new THREE.Vector3(-0.85, 1.35, 0.18),
      new THREE.Vector3(-1.15, 0.82, 0.22),
    ]);

    const rightBranch = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 3.45, 0.35),
      new THREE.Vector3(0, 2.75, 0.28),
      new THREE.Vector3(0, 2.05, 0.16),
      new THREE.Vector3(0.42, 1.74, 0.14),
      new THREE.Vector3(0.82, 1.38, 0.18),
      new THREE.Vector3(1.15, 0.82, 0.22),
    ]);

    return { leftBranch, rightBranch };
  }, []);

  const particles = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      u: i / particleCount,
      branch: i % 2 === 0 ? "left" : "right",
      // C35: deterministic, like the rest of the suite. Math.random() here
      // was memoised, so it was stable within a mount -- but it made the
      // scene irreproducible across mounts, and across screenshots.
      jitterX: (hashRandom(i * 2.7 + 11) - 0.5) * 0.07,
      jitterZ: (hashRandom(i * 3.9 + 29) - 0.5) * 0.07,
    }));
  }, [particleCount]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    if (!meshRef.current || !active) return;
    const speed = flowRate * -0.58 * delta;

    particles.forEach((p, i) => {
      p.u = (p.u + speed) % 1.0;
      if (p.u < 0) p.u += 1.0;

      const curve = p.branch === "left" ? paths.leftBranch : paths.rightBranch;
      const point = curve.getPoint(p.u);
      const scale = (1 - p.u * 0.42) * 0.048;

      dummy.position.set(
        point.x + p.jitterX * (1 - p.u * 0.5),
        point.y,
        point.z + p.jitterZ * (1 - p.u * 0.5)
      );
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();

      meshRef.current.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const particleColor =
    flowRate <= 0 ? ANATOMICAL_PALETTE.airwayInflow : ANATOMICAL_PALETTE.airwayOutflow;

  return (
    <instancedMesh ref={meshRef} args={[null, null, particleCount]} frustumCulled={false}>
      <sphereGeometry args={[1, 10, 10]} />
      <meshStandardMaterial
        color={particleColor}
        emissive={particleColor}
        emissiveIntensity={1.9}
        toneMapped={false}
        transparent
        opacity={0.92}
      />
    </instancedMesh>
  );
}

// ─── 3D Anatomical Labels (CT Skeleton & Medical Geometry Aligned) ───
function AnatomicalLabels({ visible = true }) {
  if (!visible) return null;
  return (
    <group>
      <SceneLabel position={[0, 3.42, 0.42]} accent>
        Trachea & C-Shaped Rings
      </SceneLabel>
      <SceneLabel position={[0, 2.15, 1.22]}>
        Sternum & Costal Cartilage
      </SceneLabel>
      <SceneLabel position={[0, 1.04, 1.25]}>
        Xiphoid Process
      </SceneLabel>
      <SceneLabel position={[1.45, 0.85, 0.85]}>
        Right Lung (3 Lobes)
      </SceneLabel>
      <SceneLabel position={[-1.45, 0.85, 0.85]}>
        Left Lung (Cardiac Notch)
      </SceneLabel>
      <SceneLabel position={[0, 0.78, 1.05]} accent>
        Muscular Diaphragm Dome
      </SceneLabel>
      <SceneLabel position={[0, 1.18, 0.32]}>
        Trifoliate Central Tendon
      </SceneLabel>
    </group>
  );
}

// ─── Real-Time Physics SVG Gauges ─────────────────────────────────────
function PhysicsGaugesHUD({ volume, pressure, flowRate, extTension, intTension }) {
  const volMin = 1.5;
  const volMax = 5.2;
  const volPct = Math.min(100, Math.max(0, ((volume - volMin) / (volMax - volMin)) * 100));

  const presMin = -0.5;
  const presMax = 1.4;
  const zeroPosPct = ((0 - presMin) / (presMax - presMin)) * 100;
  const presPct = ((pressure - presMin) / (presMax - presMin)) * 100;

  const flowMin = -2.0;
  const flowMax = 4.5;
  const flowZeroPct = ((0 - flowMin) / (flowMax - flowMin)) * 100;
  const flowPct = ((flowRate - flowMin) / (flowMax - flowMin)) * 100;

  return (
    <div className="space-y-3">
      {/* Gauge 1: Thorax Volume */}
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-ink-400 font-medium">Thorax Volume</span>
          <span className="font-mono font-bold text-duck-300 tabular-nums">{volume.toFixed(2)} L</span>
        </div>
        <div className="relative h-4 w-full rounded-md bg-ink-950 border border-ink-800 overflow-hidden">
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-ink-500 z-10"
            style={{ left: `${((2.8 - volMin) / (volMax - volMin)) * 100}%` }}
            title="Resting FRC (2.8 L)"
          />
          <div
            className="h-full rounded-sm bg-gradient-to-r from-duck-500 via-emerald-400 to-sky-400 transition-all duration-75"
            style={{ width: `${volPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-ink-500 font-mono mt-0.5">
          <span>1.5 L (RV)</span>
          <span className="text-ink-400">FRC (2.8L)</span>
          <span>5.2 L (TLC)</span>
        </div>
      </div>

      {/* Gauge 2: Pressure ΔP */}
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-ink-400 font-medium">Intra-thoracic Pressure (ΔP)</span>
          <span
            className={`font-mono font-bold tabular-nums ${
              pressure < -0.05 ? "text-sky-300" : pressure > 0.05 ? "text-rose-400" : "text-ink-300"
            }`}
          >
            {pressure > 0 ? `+${pressure.toFixed(2)}` : pressure.toFixed(2)} kPa
          </span>
        </div>
        <div className="relative h-4 w-full rounded-md bg-ink-950 border border-ink-800 overflow-hidden">
          <div className="absolute top-0 bottom-0 w-0.5 bg-ink-400 z-10" style={{ left: `${zeroPosPct}%` }} />
          {pressure < 0 ? (
            <div
              className="absolute top-0 bottom-0 bg-sky-500 transition-all duration-75"
              style={{ left: `${presPct}%`, width: `${zeroPosPct - presPct}%` }}
            />
          ) : (
            <div
              className="absolute top-0 bottom-0 bg-rose-500 transition-all duration-75"
              style={{ left: `${zeroPosPct}%`, width: `${Math.max(0, presPct - zeroPosPct)}%` }}
            />
          )}
        </div>
        <div className="flex justify-between text-[9px] text-ink-500 font-mono mt-0.5">
          <span className="text-sky-400">-0.5 (Inflow Vacuum)</span>
          <span className="text-ink-300">0 (Patm)</span>
          <span className="text-rose-400">+1.4 (Compression)</span>
        </div>
      </div>

      {/* Gauge 3: Airflow V̇ */}
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-ink-400 font-medium">Air Flow Rate (V̇)</span>
          <span
            className={`font-mono font-bold tabular-nums ${
              flowRate < -0.05 ? "text-sky-300" : flowRate > 0.05 ? "text-duck-300" : "text-ink-300"
            }`}
          >
            {flowRate > 0 ? `+${flowRate.toFixed(2)}` : flowRate.toFixed(2)} L/s
          </span>
        </div>
        <div className="relative h-4 w-full rounded-md bg-ink-950 border border-ink-800 overflow-hidden">
          <div className="absolute top-0 bottom-0 w-0.5 bg-ink-400 z-10" style={{ left: `${flowZeroPct}%` }} />
          {flowRate < 0 ? (
            <div
              className="absolute top-0 bottom-0 bg-sky-400 transition-all duration-75"
              style={{ left: `${flowPct}%`, width: `${flowZeroPct - flowPct}%` }}
            />
          ) : (
            <div
              className="absolute top-0 bottom-0 bg-duck-400 transition-all duration-75"
              style={{ left: `${flowZeroPct}%`, width: `${Math.max(0, flowPct - flowZeroPct)}%` }}
            />
          )}
        </div>
        <div className="flex justify-between text-[9px] text-ink-500 font-mono mt-0.5">
          <span className="text-sky-400">Inspiration (Inflow)</span>
          <span className="text-duck-400">Expiration (Outflow)</span>
        </div>
      </div>

      {/* Muscle State Status */}
      <div className="pt-2 border-t border-ink-800/80">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
          Antagonistic Intercostal Activation
        </span>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div
            className={`rounded-md border p-1.5 text-center transition-all ${
              extTension > 0.4
                ? "border-rose-500/50 bg-rose-500/15 text-rose-300 font-bold shadow-sm"
                : "border-ink-800 bg-ink-900/60 text-ink-400"
            }`}
          >
            <div className="text-[10px] text-ink-400">External Intercostals</div>
            <div className="mt-0.5 text-xs">
              {extTension > 0.4 ? "🔥 CONTRACTING" : "Passive Relaxation"}
            </div>
          </div>
          <div
            className={`rounded-md border p-1.5 text-center transition-all ${
              intTension > 0.4
                ? "border-rose-500/50 bg-rose-500/15 text-rose-300 font-bold shadow-sm"
                : "border-ink-800 bg-ink-900/60 text-ink-400"
            }`}
          >
            <div className="text-[10px] text-ink-400">Internal Intercostals</div>
            <div className="mt-0.5 text-xs">
              {intTension > 0.4 ? "🔥 ACTIVE DEPRESSION" : "Passive Relaxation"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main 3D Respiratory Scene Container ──────────────────────────────
export default function RespiratoryCanvas({ params, setParam, onOpenQuiz }) {
  const [phase, setPhase] = useState(RESPIRATORY_PHASES.INSPIRATION);
  /** Whether the looping breath is a forced one, so the third phase is reachable while playing. */
  const [forcedLoop, setForcedLoop] = useState(false);
  const [autoLoop, setAutoLoop] = useState(true);
  const [bpm, setBpm] = useState(14);
  const [cutaway, setCutaway] = useState(0.25);
  const [showBones, setShowBones] = useState(true);
  const [showLungs, setShowLungs] = useState(true);
  const [showDiaphragm, setShowDiaphragm] = useState(true);
  const [showAirflow, setShowAirflow] = useState(true);
  const [showVectors, setShowVectors] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showCredits, setShowCredits] = useState(false);

  // Close credits modal on Escape key press
  useEffect(() => {
    if (!showCredits) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setShowCredits(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCredits]);

  const [panelWidth, setPanelWidth] = useState(360);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(360);

  const [expansion, setExpansion] = useState(0.8);
  const [volume, setVolume] = useState(3.45);
  const [pressure, setPressure] = useState(-0.25);
  const [flowRate, setFlowRate] = useState(-0.55);
  const [extTension, setExtTension] = useState(0.9);
  const [intTension, setIntTension] = useState(0.0);
  /** The live breath, mutated every frame; React hears a throttled copy. */
  const shown = useRef(restingState(RESPIRATORY_PHASES.INSPIRATION));
  const pushed = useRef({ phase: null, expansion: null, volumeL: null, pressureKPa: null, flowLps: null, external: null, internal: null });
  const pushClock = useRef(0);

  const cycleTime = useRef(0);

  const muscleTexture = useMemo(() => generateStriatedMuscleTexture(), []);
  const tendonTexture = useMemo(() => generatePearlyTendonTexture(), []);

  useEffect(() => {
    return () => {
      muscleTexture?.dispose?.();
      tendonTexture?.dispose?.();
    };
  }, [muscleTexture, tendonTexture]);

  const handleResizePointerDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = panelWidth;
  }, [panelWidth]);

  useEffect(() => {
    if (!isResizing) return;
    const handlePointerMove = (e) => {
      const delta = e.clientX - resizeStartX.current;
      const newWidth = Math.min(Math.max(280, resizeStartWidth.current + delta), 540);
      setPanelWidth(newWidth);
    };
    const handlePointerUp = () => setIsResizing(false);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizing]);

  /**
   * Drives the breath.
   *
   * Two things were wrong with the old loop, and they compounded.
   *
   * It called seven React setters EVERY FRAME — setExpansion, setPhase,
   * setVolume, setPressure, setFlowRate, setExtTension, setIntTension — so a
   * 2,000-line component holding two multi-megabyte GLB scenes re-rendered at
   * 60 Hz. Every other scene in the suite mutates refs in useFrame and pushes
   * to React on a throttle: TimelineDriver uses 10 Hz, ArmDriver 5 Hz.
   *
   * And `FrameController` was declared inside the component body, so React saw
   * a brand-new component TYPE on every render and tore the subtree down and
   * rebuilt it — which meant unsubscribing and resubscribing useFrame sixty
   * times a second, on top of the re-renders causing it.
   *
   * The arithmetic now comes from lib/respiratory.js (one copy, tested), and
   * the push is quantised and throttled: React only hears about a value when
   * it has actually changed by something visible, and at most ten times a
   * second. The full conversion to ref-mutated meshes is a larger job — the
   * animated values are threaded as props through hundreds of inline material
   * properties — and is tracked separately.
   */
  const handleFrameUpdate = useCallback(
    (_state, rawDelta) => {
      const delta = Math.min(rawDelta, 1 / 30);
      let next;

      if (autoLoop) {
        cycleTime.current = (cycleTime.current + delta * (bpm / 60)) % 1.0;
        next = breathAt(cycleTime.current, { forced: forcedLoop });
      } else {
        // Manual: ease towards the resting tableau for the chosen phase.
        const goal = restingState(phase);
        const k = 0.08;
        const cur = shown.current;
        next = {
          phase: goal.phase,
          expansion: THREE.MathUtils.lerp(cur.expansion, goal.expansion, k),
          volumeL: THREE.MathUtils.lerp(cur.volumeL, goal.volumeL, k),
          pressureKPa: THREE.MathUtils.lerp(cur.pressureKPa, goal.pressureKPa, k),
          flowLps: THREE.MathUtils.lerp(cur.flowLps, goal.flowLps, k),
          external: THREE.MathUtils.lerp(cur.external, goal.external, k),
          internal: THREE.MathUtils.lerp(cur.internal, goal.internal, k),
        };
      }

      shown.current = next;

      // Throttle, then only push what changed.
      pushClock.current += delta;
      if (pushClock.current < PUSH_EVERY_S) return;
      pushClock.current = 0;

      const q = (v, places = 2) => Number(v.toFixed(places));
      const last = pushed.current;
      if (next.phase !== last.phase) setPhase(next.phase);
      if (q(next.expansion) !== last.expansion) setExpansion(q(next.expansion));
      if (q(next.volumeL) !== last.volumeL) setVolume(q(next.volumeL));
      if (q(next.pressureKPa) !== last.pressureKPa) setPressure(q(next.pressureKPa));
      if (q(next.flowLps) !== last.flowLps) setFlowRate(q(next.flowLps));
      if (q(next.external, 1) !== last.external) setExtTension(q(next.external, 1));
      if (q(next.internal, 1) !== last.internal) setIntTension(q(next.internal, 1));

      pushed.current = {
        phase: next.phase,
        expansion: q(next.expansion),
        volumeL: q(next.volumeL),
        pressureKPa: q(next.pressureKPa),
        flowLps: q(next.flowLps),
        external: q(next.external, 1),
        internal: q(next.internal, 1),
      };
    },
    [autoLoop, bpm, forcedLoop, phase]
  );

  return (
    <div className="relative h-full w-full bg-ink-950 overflow-hidden select-none">
      {/* ─── 3D WebGL Canvas ────────────────────────────────────────── */}
      <Canvas
        camera={{ position: [0, 1.45, 6.6], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: "high-performance" }}
      >
        <WebGLCleanup />
        <color attach="background" args={[CANVAS_BG]} />
        <ambientLight intensity={0.72} />
        <directionalLight position={[5, 9, 6]} intensity={1.55} castShadow />
        <directionalLight position={[-6, -3, -5]} intensity={0.65} color="#38bdf8" />
        <pointLight position={[0, 1.5, 3.5]} intensity={0.9} color="#ffffff" />

        <FrameController onFrame={handleFrameUpdate} />

        {/* 1. Real CT-Scanned Thoracic Skeleton (Ribs 1-12, Spine, Sternum, Clavicles) */}
        {showBones && (
          <Suspense fallback={null}>
            <RealisticCTSkeleton
              expansion={expansion}
              cutaway={cutaway}
              visible={showBones}
            />
          </Suspense>
        )}

        {/* 2. Ribcage kinematics (the intercostal geometry has been removed) */}
        {showVectors && <RibcageKinematicVectors expansion={expansion} />}

        {/* 3. Sculpted Muscular Diaphragm Dome with Central Tendon & Hiatuses */}
        {showDiaphragm && (
          <SculptedDiaphragmDome
            expansion={expansion}
            isContracted={phase === RESPIRATORY_PHASES.INSPIRATION}
            showVectors={showVectors}
            cutaway={cutaway}
            muscleTexture={muscleTexture}
            tendonTexture={tendonTexture}
          />
        )}

        {/* 4. Photorealistic Medical Scanned Lungs */}
        {showLungs && (
          <Suspense fallback={null}>
            <PhotorealisticMedicalLungs
              expansion={expansion}
              cutaway={cutaway}
            />
          </Suspense>
        )}

        {/* 5. Dynamic Airway Particle Streams */}
        {showAirflow && <AirwayParticleStream flowRate={flowRate} active={true} />}

        {/* 6. 3D Anatomical Labels */}
        <AnatomicalLabels visible={showLabels} />

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={3.0}
          maxDistance={16}
          target={[0, 1.45, 0.2]}
        />
      </Canvas>

      {/* Top Right Floating Quick-Access Credits Button */}
      <div className="absolute top-3 right-3 z-20 pointer-events-auto">
        <button
          type="button"
          onClick={() => setShowCredits(true)}
          className="flex items-center gap-1.5 rounded-lg border border-ink-800/90 bg-ink-900/90 px-2.5 py-1.5 text-xs font-semibold text-ink-300 shadow-xl backdrop-blur-md transition-all hover:border-duck-500/50 hover:bg-ink-850 hover:text-duck-300 cursor-pointer"
          title="3D Model Attribution & Open Source Licenses"
        >
          <Info className="h-3.5 w-3.5 text-duck-400" />
          <span>Credits</span>
        </button>
      </div>

      {/* ─── Floating Physiological Control HUD ─────────────────────── */}
      <div
        className="absolute left-3 top-3 bottom-3 z-20 flex flex-col pointer-events-none"
        style={{ width: isCollapsed ? "auto" : `${panelWidth}px` }}
      >
        <div className={`relative flex flex-col pointer-events-auto rounded-xl border border-ink-800 bg-ink-900/95 p-3.5 shadow-2xl backdrop-blur-md overflow-hidden transition-all ${
          isCollapsed ? "h-auto" : "h-full"
        }`}>
          {/* Header */}
          <div className={`flex items-center justify-between gap-3 ${!isCollapsed ? "border-b border-ink-800 pb-2.5 mb-3" : ""}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-duck-500/30 bg-duck-500/10 text-sm">
                🫁
              </span>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-ink-100 truncate">
                  Respiratory & Thoracic Mechanics
                </h3>
                {!isCollapsed && (
                  <span className="text-[10px] text-ink-400 font-mono">
                    Boyle&apos;s Law: P₁V₁ = P₂V₂
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowCredits((prev) => !prev)}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                  showCredits
                    ? "border-duck-500/50 bg-duck-500/20 text-duck-300"
                    : "border-ink-700 bg-ink-800 text-ink-400 hover:text-ink-200 hover:border-ink-600"
                }`}
                title="View 3D Model Credits & Open Source Licenses"
              >
                <Info className="h-3 w-3 text-duck-400" />
                <span className="hidden sm:inline">Credits</span>
              </button>

              <button
                type="button"
                onClick={() => setAutoLoop(!autoLoop)}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all ${
                  autoLoop
                    ? "border-duck-500/50 bg-duck-500/20 text-duck-300"
                    : "border-ink-700 bg-ink-800 text-ink-400 hover:text-ink-200"
                }`}
                title={autoLoop ? "Pause auto breathing loop" : "Start auto breathing loop"}
              >
                {autoLoop ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                <span className="hidden sm:inline">{autoLoop ? "Looping" : "Manual"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-700 bg-ink-800 text-ink-400 hover:text-ink-200 transition-colors"
                title={isCollapsed ? "Expand panel" : "Minimize panel"}
              >
                {isCollapsed ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          {!isCollapsed && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar">
            {/* 1. Phase Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                  Breathing Phase
                </span>
                {autoLoop && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-duck-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-duck-400 animate-pulse" />
                    Auto Breathing
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setAutoLoop(false);
                    setForcedLoop(false);
                    setPhase(RESPIRATORY_PHASES.INSPIRATION);
                  }}
                  className={`rounded-lg border px-2 py-1.5 text-center text-xs font-semibold transition-all ${
                    phase === RESPIRATORY_PHASES.INSPIRATION
                      ? "border-duck-500 bg-duck-500/20 text-duck-300 shadow-sm"
                      : "border-ink-800 bg-ink-850/60 text-ink-400 hover:bg-ink-800"
                  }`}
                >
                  Inspiration
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAutoLoop(false);
                    setForcedLoop(false);
                    setPhase(RESPIRATORY_PHASES.QUIET_EXPIRATION);
                  }}
                  className={`rounded-lg border px-2 py-1.5 text-center text-xs font-semibold transition-all ${
                    phase === RESPIRATORY_PHASES.QUIET_EXPIRATION
                      ? "border-duck-500 bg-duck-500/20 text-duck-300 shadow-sm"
                      : "border-ink-800 bg-ink-850/60 text-ink-400 hover:bg-ink-800"
                  }`}
                >
                  Quiet Exp.
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAutoLoop(false);
                    // Pressing Loop after this breathes forcefully, which is the only
                    // way the third phase was ever reachable while playing.
                    setForcedLoop(true);
                    setPhase(RESPIRATORY_PHASES.FORCED_EXPIRATION);
                  }}
                  className={`rounded-lg border px-2 py-1.5 text-center text-xs font-semibold transition-all ${
                    phase === RESPIRATORY_PHASES.FORCED_EXPIRATION
                      ? "border-rose-500 bg-rose-500/25 text-rose-300 shadow-sm"
                      : "border-ink-800 bg-ink-850/60 text-ink-400 hover:bg-ink-800"
                  }`}
                >
                  Forced Exp.
                </button>
              </div>
            </div>

            {/* 2. Real-Time Physics Gauges */}
            <div className="rounded-lg border border-ink-800 bg-ink-950/60 p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-duck-400 mb-2">
                <Gauge className="h-3 w-3" />
                <span>Live Thoracic Physics Gauges</span>
              </div>
              <PhysicsGaugesHUD
                volume={volume}
                pressure={pressure}
                flowRate={flowRate}
                extTension={extTension}
                intTension={intTension}
              />
            </div>

            {/* 3. Sliders */}
            <div className="space-y-2.5">
              {autoLoop && (
                <Slider
                  label="Respiratory Rate (BPM)"
                  value={bpm}
                  onChange={setBpm}
                  min={6}
                  max={30}
                  step={1}
                  format={(v) => `${v} breaths/min`}
                />
              )}

              <Slider
                label="Cross-Section / Cutaway"
                value={cutaway}
                onChange={setCutaway}
                min={0}
                max={1}
                step={0.05}
                format={(v) =>
                  v === 0 ? "0% (Full Torso)" : v >= 0.85 ? "100% (Full Interior)" : `${Math.round(v * 100)}%`
                }
              />
            </div>

            {/* 4. Model Fidelity & Layer Toggles */}
            <div className="rounded-lg border border-ink-800 bg-ink-950/40 p-2 space-y-1.5">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-500 mb-0.5">
                3D Anatomical Structures & Scans
              </span>
              <Toggle
                label="3D CT Thoracic Skeleton"
                checked={showBones}
                onChange={setShowBones}
              />
              <Toggle
                label="Photorealistic Medical Lungs"
                checked={showLungs}
                onChange={setShowLungs}
              />
              <Toggle
                label="Muscular Diaphragm Dome"
                checked={showDiaphragm}
                onChange={setShowDiaphragm}
              />
              <div className="pt-1 border-t border-ink-800/60 space-y-1">
                <Toggle
                  label="Airway Particle Vectors"
                  checked={showAirflow}
                  onChange={setShowAirflow}
                />
                <Toggle
                  label="3D Kinematic Motion Arrows"
                  checked={showVectors}
                  onChange={setShowVectors}
                />
                <Toggle
                  label="Anatomical 3D Labels"
                  checked={showLabels}
                  onChange={setShowLabels}
                />
                <div className="pt-2 border-t border-ink-800/60 flex items-center justify-between text-[10px] text-ink-400">
                  <span>Open-Source 3D Models</span>
                  <button
                    type="button"
                    onClick={() => setShowCredits(true)}
                    className="text-duck-400 hover:text-duck-300 hover:underline font-semibold cursor-pointer"
                  >
                    View Credits & Licenses →
                  </button>
                </div>
              </div>
            </div>

            {/* 5. AI Study Handover & Quiz Button */}
            {onOpenQuiz && (
              <button
                type="button"
                onClick={() => {
                  const respiratoryTopic = {
                    id: "respiratory",
                    category: "biology",
                    title: "Respiratory Mechanics & Thoracic Physics",
                    syllabus: "Biology 11 · Gas Exchange & Respiration",
                    blurb:
                      "Thoracic volume expansion, Boyle's law pressure gradients, antagonistic intercostal muscle action, and diaphragm mechanics in 3D.",
                    concepts: [
                      "Inspiration is an active process: External intercostals contract (pulling ribcage up and out) and the diaphragm contracts (flattens downwards), expanding thoracic volume.",
                      "Boyle's Law governs airflow: As thoracic volume increases, intra-alveolar pressure falls below atmospheric pressure (-0.3 kPa), drawing air inward down the pressure gradient.",
                      "Quiet expiration is passive due to elastic recoil; forced expiration is an active process recruiting internal intercostals and abdominal muscles to rapidly compress thorax volume.",
                    ],
                    keywords:
                      "respiratory system lungs diaphragm external intercostal internal intercostal ribcage sternum inspiration expiration forced expiration Boyle's law tidal volume FRC thoracic cavity",
                  };
                  const liveParams = {
                    phase,
                    thoraxVolumeL: volume.toFixed(2),
                    intraThoracicPressureKPa: pressure.toFixed(2),
                    airFlowRateLps: flowRate.toFixed(2),
                    bpm,
                    cutawayPercent: Math.round(cutaway * 100),
                  };
                  onOpenQuiz(respiratoryTopic, liveParams);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg bg-gradient-to-r from-duck-400 to-duck-500 px-3.5 py-2.5 text-xs font-bold text-ink-950 transition-all hover:from-duck-300 hover:to-duck-400 shadow-md hover:shadow-duck-500/20 active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="h-4 w-4 shrink-0 text-ink-950" strokeWidth={2.25} />
                  <div className="text-left">
                    <p className="leading-none text-xs font-bold">AI Concept Breakdown & Quiz</p>
                    <p className="text-[10px] font-medium text-ink-900/80 leading-tight mt-0.5">
                      Test with AI · logs to Mastery
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-70" strokeWidth={2.25} />
              </button>
            )}
          </div>
        )}

          {/* Drag Resize Handle (only when expanded) */}
          {!isCollapsed && (
            <div
              onPointerDown={handleResizePointerDown}
              className="absolute -right-1 top-0 bottom-0 z-30 flex w-3 cursor-ew-resize items-center justify-center select-none group"
              title="Drag to resize HUD panel"
            >
              <div
                className={`h-12 w-1 rounded-full transition-all ${
                  isResizing ? "bg-duck-400 scale-y-110" : "bg-ink-700/50 group-hover:bg-duck-400/80"
                }`}
              />
            </div>
          )}
        </div>
      </div>

      {/* ─── 3D Model Credits & Open Source Attribution Modal ─────────── */}
      {showCredits && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink-950/80 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCredits(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="credits-modal-title"
        >
          <div className="relative w-full max-w-xl max-h-[88vh] flex flex-col rounded-2xl border border-ink-700/80 bg-ink-900/98 shadow-2xl backdrop-blur-xl text-ink-100 overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-ink-800 px-5 py-4 shrink-0 bg-ink-900">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-duck-500/40 bg-duck-500/10 text-duck-400 shadow-inner">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 id="credits-modal-title" className="text-sm sm:text-base font-bold text-ink-100">
                      3D Model & Anatomy Attribution
                    </h3>
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      100% Free & Open Source
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-400 mt-0.5">
                    Open-source assets & scientific models used for Grade 10 Respiratory Mechanics
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCredits(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-700 bg-ink-800 text-ink-400 hover:text-ink-100 hover:bg-ink-750 transition-colors cursor-pointer"
                title="Close credits"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto px-5 py-4 space-y-3.5 no-scrollbar">
              {/* Notice Banner */}
              <div className="rounded-xl border border-duck-500/30 bg-duck-500/10 p-3 text-xs text-ink-200 leading-relaxed">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-duck-300">Open Source & Commercial Rights Notice</p>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded">
                    Commercial Use Permitted
                  </span>
                </div>
                <p className="text-ink-300 text-[11px] leading-relaxed">
                  Both the <strong className="text-ink-100">3D Thoracic CT Skeleton</strong> and <strong className="text-ink-100">Medical Lungs</strong> models were originally published under the <strong className="text-emerald-300">Creative Commons Attribution 4.0 International (CC-BY-4.0)</strong> license. CC-BY-4.0 explicitly grants the right to adapt and use the models for <strong className="text-duck-300">any purpose, including commercial applications</strong>, as long as appropriate author attribution is preserved. The diaphragm is 100% original SocraticOS code.
                </p>
              </div>

              {/* Model Cards */}
              <div className="space-y-3">
                {RESPIRATORY_MODEL_CREDITS.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-ink-800 bg-ink-850/70 p-3.5 transition-colors hover:border-ink-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg leading-none">{item.icon}</span>
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-ink-100">{item.name}</h4>
                          <span className="font-mono text-[10px] text-ink-400">
                            {item.file} · {item.size} · {item.type}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold border ${
                          item.licenseColor === "sky"
                            ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                            : item.licenseColor === "emerald"
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : item.licenseColor === "rose"
                            ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                            : "bg-purple-500/15 text-purple-300 border-purple-500/30"
                        }`}
                      >
                        {item.license}
                      </span>
                    </div>

                    <p className="mt-2 text-ink-300 text-[11px] leading-relaxed">
                      {item.description}
                    </p>

                    <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                      <span>✓ Commercial Use:</span>
                      <span className="text-ink-300">{item.commercialUse}</span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] pt-2 border-t border-ink-800/80">
                      <div className="text-ink-400 text-[10px]">
                        Creator: <span className="text-ink-200 font-semibold">{item.originalCreator || item.author}</span>
                        {item.project ? ` · Host: ${item.author} (${item.project})` : ""}
                      </div>
                      <div className="flex items-center gap-2.5">
                        {item.sourceUrl && (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-ink-300 hover:text-ink-100 hover:underline text-[10px]"
                          >
                            <span>Sketchfab Source</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                        {item.repoUrl ? (
                          <a
                            href={item.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-duck-400 hover:text-duck-300 hover:underline text-[10px]"
                          >
                            <span>GitHub</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <span className="text-[10px] font-mono text-ink-500">Original Procedural Code</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Curriculum & Hackathon Note */}
              <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-3 text-[11px] text-ink-400 leading-relaxed">
                <span className="font-semibold text-ink-300">Licensing Summary: </span>
                Both 3D models are fully free and permissive for academic, hackathon, and commercial applications under CC-BY-4.0. Retaining this Credits modal satisfies all legal attribution requirements.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-ink-800 px-5 py-3 shrink-0 bg-ink-900">
              <span className="text-[11px] text-ink-500">SocraticOS 3D Anatomy Engine</span>
              <button
                type="button"
                onClick={() => setShowCredits(false)}
                className="rounded-lg bg-duck-500 px-4 py-1.5 text-xs font-bold text-ink-950 transition-all hover:bg-duck-400 shadow-sm active:scale-98 cursor-pointer"
              >
                Close Credits
              </button>
            </div>
          </div>
        </div>
      )}

      <ViewportHint>
        drag to orbit · scroll to zoom · right-drag to pan
      </ViewportHint>
    </div>
  );
}

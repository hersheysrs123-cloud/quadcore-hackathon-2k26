"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Line } from "@react-three/drei";
import * as THREE from "three";
import { CANVAS_BG, SceneLabel } from "@/components/visualizations/scene-kit";

// ─── Zooming into tissue ────────────────────────────────────────────
// One scene, several magnifications: the organ, then the tissue, then the
// cells. The lungs → an alveolar sac → the wall one oxygen molecule crosses;
// the gut → the lining of the small intestine → one villus. Each level is
// its own little world (`levels[i].view` frames it, in world units), and
// only the level on show is mounted.
//
// Changing level is a dive, not a cut. Zooming in, the camera flies at the
// point the next level magnifies (`levels[i].focus`) while an iris closes;
// behind the closed iris the levels swap, the camera starts far back from
// the new level and closes in to frame it while the iris opens. Zooming out
// runs the same thing backwards. The orbit controls are off for the second
// it takes, and each level gets its own orbit limits.
//
//   <TissueZoom level={i} levels={LEVELS}>{(shown) => …}</TissueZoom>
//
// `shown` lags `level` by half a transition: render from it, not from the
// level the user picked, so the old scene stays up until the iris is shut.
// ─────────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180;
const OUT_S = 0.55;
const IN_S = 0.75;

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeInCubic = (t) => t * t * t;

/** Where the camera sits to frame `view` from `direction` at this aspect. */
function framePose(view, direction, fov, aspect, margin = 1.04) {
  const { cx = 0, cy = 0, cz = 0, width, height, depth = 0 } = view;
  const tanHalf = Math.tan((fov / 2) * DEG);
  const fit = Math.max(height / 2 / tanHalf, width / 2 / (tanHalf * aspect)) * margin + depth / 2;
  const target = new THREE.Vector3(cx, cy, cz);
  const dir = new THREE.Vector3(...(direction ?? [0, 0.1, 1])).normalize();
  return { target, position: target.clone().addScaledVector(dir, fit), fit };
}

/** A full-screen iris: the frame outside a circle of `uRadius` (1 = the corner) goes to the background colour, with a thin bright ring at its edge. */
function Iris({ radiusRef, colour = "#7dd3fc" }) {
  const size = useThree((st) => st.size);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uRadius: { value: 2 },
          uAspect: { value: 1 },
          uBg: { value: new THREE.Color(CANVAS_BG) },
          uRing: { value: new THREE.Color(colour) },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform float uRadius;
          uniform float uAspect;
          uniform vec3 uBg;
          uniform vec3 uRing;
          void main() {
            vec2 p = (vUv - 0.5) * 2.0;
            p.x *= uAspect;
            float d = length(p) / length(vec2(uAspect, 1.0));
            float edge = 0.012;
            float outside = smoothstep(uRadius - edge, uRadius + edge, d);
            float ring = exp(-pow((d - uRadius) / 0.006, 2.0)) * step(0.001, uRadius);
            vec3 col = mix(uBg, uRing, ring);
            gl_FragColor = vec4(col, max(outside, ring * 0.9));
            #include <colorspace_fragment>
          }`,
      }),
    [colour],
  );
  useEffect(() => () => material.dispose(), [material]);
  const ref = useRef(null);
  useFrame(() => {
    const r = radiusRef.current;
    if (ref.current) ref.current.visible = r < 1.3;
    material.uniforms.uRadius.value = r;
    material.uniforms.uAspect.value = size.width / Math.max(size.height, 1);
  });
  return (
    <mesh ref={ref} frustumCulled={false} renderOrder={1000} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

/**
 * The levels and the dive between them. Each level is
 * `{ view, direction, focus, minDistance?, maxDistance? }`: `focus` is the
 * point in this level the next one magnifies.
 */
export function TissueZoom({ level, levels, fov = 42, children, ringColour, onShown }) {
  const camera = useThree((st) => st.camera);
  const controls = useThree((st) => st.controls);
  const aspect = useThree((st) => st.size.width / Math.max(st.size.height, 1));
  const clampLevel = (l) => Math.max(0, Math.min(levels.length - 1, l | 0));
  const [shown, setShown] = useState(() => clampLevel(level));
  const iris = useRef(2);
  const anim = useRef({ phase: "idle", t: 0, from: 0, to: 0, fromP: new THREE.Vector3(), fromT: new THREE.Vector3(), toP: new THREE.Vector3(), toT: new THREE.Vector3(), first: true });

  const applyLimits = (lv, fit) => {
    if (!controls) return;
    controls.minDistance = lv.minDistance ?? fit * 0.2;
    controls.maxDistance = lv.maxDistance ?? fit * 2.6;
  };

  // A new level asked for: start the dive (or, on mount, just frame it).
  useEffect(() => {
    const a = anim.current;
    const want = clampLevel(level);
    if (!(aspect > 0.05)) return;
    if (a.first) {
      a.first = false;
      const pose = framePose(levels[want].view, levels[want].direction, fov, aspect);
      camera.position.copy(pose.position);
      camera.lookAt(pose.target);
      if (controls) {
        controls.target.copy(pose.target);
        applyLimits(levels[want], pose.fit);
        controls.update();
      }
      return;
    }
    if (want === a.to && a.phase !== "idle") return;
    if (want === shown && a.phase === "idle") return;
    a.from = shown;
    a.to = want;
    a.phase = "out";
    a.t = 0;
    a.fromP.copy(camera.position);
    a.fromT.copy(controls ? controls.target : new THREE.Vector3());
    const goingIn = want > shown;
    const lv = levels[shown];
    if (goingIn && lv.focus) {
      // dive at the focus point
      a.toT.set(...lv.focus);
      // end a short way off the focus, on the line the camera is already on
      const dir = a.fromP.clone().sub(a.toT).normalize();
      a.toP.copy(a.toT).addScaledVector(dir, framePose(lv.view, lv.direction, fov, aspect).fit * 0.08);
    } else {
      // pull straight back
      a.toT.copy(a.fromT);
      a.toP.copy(a.fromT).addScaledVector(a.fromP.clone().sub(a.fromT), 3.2);
    }
    if (controls) controls.enabled = false;
    // the levels' configs are literals; their values are what matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, aspect]);

  // Refit on resize while idle, and once the orbit controls exist (they
  // mount after this, and would otherwise orbit round their own default).
  useEffect(() => {
    const a = anim.current;
    if (a.first || a.phase !== "idle" || !(aspect > 0.05)) return;
    const pose = framePose(levels[shown].view, levels[shown].direction, fov, aspect);
    camera.position.copy(pose.position);
    camera.lookAt(pose.target);
    if (controls) {
      controls.target.copy(pose.target);
      applyLimits(levels[shown], pose.fit);
      controls.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, controls]);

  useEffect(() => {
    onShown?.(shown);
  }, [shown, onShown]);

  useFrame((_, rawDelta) => {
    const a = anim.current;
    if (a.phase === "idle") return;
    // A floor on the step, so a starved frame clock still finishes the dive.
    const dt = Math.min(Math.max(rawDelta, 1 / 60), 1 / 20);
    if (a.phase === "out") {
      a.t = Math.min(1, a.t + dt / OUT_S);
      const e = easeInCubic(a.t);
      camera.position.lerpVectors(a.fromP, a.toP, e);
      const tgt = new THREE.Vector3().lerpVectors(a.fromT, a.toT, Math.min(1, a.t * 1.6));
      camera.lookAt(tgt);
      if (controls) controls.target.copy(tgt);
      iris.current = 1.25 * (1 - easeInOutCubic(a.t));
      if (a.t >= 1) {
        // behind the shut iris: swap levels and set up the approach
        const lv = levels[a.to];
        const pose = framePose(lv.view, lv.direction, fov, aspect);
        const goingIn = a.to > a.from;
        a.toP.copy(pose.position);
        a.toT.copy(pose.target);
        if (goingIn) {
          a.fromT.copy(pose.target);
          a.fromP.copy(pose.target).addScaledVector(pose.position.clone().sub(pose.target), 3.4);
        } else {
          const focus = lv.focus ? new THREE.Vector3(...lv.focus) : pose.target.clone();
          a.fromT.copy(focus);
          a.fromP.copy(focus).addScaledVector(pose.position.clone().sub(pose.target).normalize(), pose.fit * 0.1);
        }
        camera.position.copy(a.fromP);
        camera.lookAt(a.fromT);
        a.phase = "in";
        a.t = 0;
        setShown(a.to);
        applyLimits(lv, pose.fit);
      }
    } else if (a.phase === "in") {
      a.t = Math.min(1, a.t + dt / IN_S);
      const e = easeInOutCubic(a.t);
      camera.position.lerpVectors(a.fromP, a.toP, e);
      const tgt = new THREE.Vector3().lerpVectors(a.fromT, a.toT, e);
      camera.lookAt(tgt);
      if (controls) controls.target.copy(tgt);
      iris.current = 0.02 + 1.3 * easeInOutCubic(Math.min(1, a.t * 1.25));
      if (a.t >= 1) {
        a.phase = "idle";
        iris.current = 2;
        if (controls) {
          controls.target.copy(a.toT);
          controls.enabled = true;
          controls.update();
        }
      }
    }
  });

  return (
    <>
      {children(shown)}
      <Iris radiusRef={iris} colour={ringColour} />
    </>
  );
}

/**
 * A magnifier on a level: a pulsing ring round the part the next level
 * shows, with its name and the magnification, that zooms in when clicked.
 */
export function ZoomHotspot({ position, radius = 0.4, label, colour = "#7dd3fc", onZoom }) {
  const ring = useRef(null);
  const [hover, setHover] = useState(false);
  const points = useMemo(() => Array.from({ length: 65 }, (_, i) => [Math.cos((i / 64) * Math.PI * 2) * radius, Math.sin((i / 64) * Math.PI * 2) * radius, 0]), [radius]);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const k = 1 + 0.08 * Math.sin(clock.elapsedTime * 3.2);
    ring.current.scale.setScalar(hover ? 1.15 : k);
  });
  return (
    <group position={position}>
      <Billboard>
        <group ref={ring}>
          <Line points={points} color={colour} lineWidth={hover ? 2.6 : 1.8} transparent opacity={0.95} depthTest={false} renderOrder={20} />
        </group>
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            onZoom?.();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(true);
            document.body.style.cursor = "zoom-in";
          }}
          onPointerOut={() => {
            setHover(false);
            document.body.style.cursor = "";
          }}
        >
          <circleGeometry args={[radius * 1.1, 32]} />
          <meshBasicMaterial transparent opacity={hover ? 0.12 : 0.04} color={colour} depthWrite={false} />
        </mesh>
      </Billboard>
      {label && (
        <SceneLabel position={[0, radius + 0.28, 0]} tone="text-sky-200">
          {label}
        </SceneLabel>
      )}
    </group>
  );
}

/** A scale bar lying in the level's own units: `length` world units, labelled `text`. */
export function ScaleBar({ position, length, text, colour = "#e2e8f0" }) {
  const half = length / 2;
  const tick = length * 0.06;
  return (
    <group position={position}>
      <Line points={[[-half, 0, 0], [half, 0, 0]]} color={colour} lineWidth={2} />
      <Line points={[[-half, -tick, 0], [-half, tick, 0]]} color={colour} lineWidth={2} />
      <Line points={[[half, -tick, 0], [half, tick, 0]]} color={colour} lineWidth={2} />
      <SceneLabel position={[0, -tick * 3.2, 0]} tone="text-ink-200">
        {text}
      </SceneLabel>
    </group>
  );
}

/**
 * The ladder of magnifications, in the page (not the canvas): one pill a
 * level, the current one lit, each one a button that dives there.
 */
export function ZoomLadder({ levels, level, onSelect, className = "" }) {
  return (
    <div className={`pointer-events-auto flex items-center gap-1 rounded-xl border border-ink-800 bg-ink-900/90 p-1 shadow-xl ${className}`}>
      {levels.map((lv, i) => (
        <div key={lv.id} className="flex items-center gap-1">
          {i > 0 && <span className="text-[10px] text-ink-600">›</span>}
          <button
            type="button"
            onClick={() => onSelect?.(lv.id)}
            className={`rounded-lg px-2 py-1 text-left text-[11px] font-semibold transition-colors ${
              i === level ? "bg-sky-500/20 text-sky-200" : "text-ink-400 hover:bg-ink-800 hover:text-ink-200"
            }`}
            title={lv.hint}
          >
            <span>{lv.label}</span>
            <span className="ml-1 font-mono text-[10px] opacity-70">{lv.magnification}</span>
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Paths through a level ─────────────────────────────────────────

/** A flat [x, y, z, x, y, z, …] list (as the model metas store them) as vectors. */
export function toPoints(flat) {
  const out = [];
  for (let i = 0; i < flat.length; i += 3) out.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]));
  return out;
}

/** A polyline with cumulative lengths, sampled by distance along it: `at(s, out)`. */
export function polyline(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i += 1) cum.push(cum[i - 1] + points[i].distanceTo(points[i - 1]));
  return {
    points,
    length: cum[cum.length - 1],
    at(s, out) {
      const L = cum[cum.length - 1];
      const d = Math.min(Math.max(s, 0), L);
      let lo = 0;
      let hi = cum.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= d) lo = mid;
        else hi = mid;
      }
      const u = (d - cum[lo]) / Math.max(cum[hi] - cum[lo], 1e-9);
      return out.lerpVectors(points[lo], points[hi], u);
    },
  };
}

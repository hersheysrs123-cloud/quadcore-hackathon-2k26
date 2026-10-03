"use client";

import { createContext, useContext, useMemo, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useLiveQuery } from "dexie-react-hooks";
import { db, DEFAULT_GRAPHICS_SETTINGS } from "@/lib/db";

// ─── Shared 3D kit ──────────────────────────────────────────────────
// Camera rig, lighting, and the primitives (arrows, bonds, labels) that
// every scene in Physics / Chemistry / Biology draws with. Keeping them
// here is what makes thirteen scenes look like one product.
// ─────────────────────────────────────────────────────────────────────

/**
 * WebGL clear colour. Balanced studio slate (#273043): brighter than pitch-black (#090d16),
 * calibrated to provide rich contrast and depth in both dark mode and light mode.
 */
export const CANVAS_BG = "#273043";

export const PALETTE = {
  gold: "#fbbf24",
  goldDim: "#f59e0b",
  sky: "#38bdf8",
  emerald: "#34d399",
  rose: "#fb7185",
  violet: "#a78bfa",
  slate: "#64748b",
  bone: "#e8ebf0",
  line: "#525e76",
};

/**
 * `keyLight`, not `key`: React reserves `key`, so spreading a `lights` object
 * that carried one both dropped the value and logged a warning per frame.
 */
export function StudioLights({ ambient = 0.55, keyLight = 1.5, rim = PALETTE.sky }) {
  return (
    <>
      <ambientLight intensity={ambient} />
      {/* The bias pair stops shadow acne: without it a mesh that both casts and
          receives shadows (a porcelain basin, a stand's base) shades itself in
          fine stripes that read as z-fighting. */}
      <directionalLight position={[6, 9, 6]} intensity={keyLight} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-bias={-0.0004} shadow-normalBias={0.04} />
      <directionalLight position={[-7, -4, -6]} intensity={0.42} color={rim} />
    </>
  );
}

/**
 * Which materials reflect the studio, and how strongly: metal fully, clear
 * glass enough to catch highlights, everything else not at all. Returns 0 to
 * leave a material alone. A material can opt out (or set its own strength)
 * with `userData.envReflect`.
 */
export function reflectStrength(m, { metal = 0.75, glass = 1.3 } = {}) {
  if (!m || !m.isMeshStandardMaterial) return 0;
  if (typeof m.userData?.envReflect === "number") return m.userData.envReflect;
  if (m.metalness >= 0.35) return metal;
  if (m.transparent && m.opacity <= 0.6 && m.roughness <= 0.35) return glass;
  return 0;
}

/**
 * Patch a material so the environment only shows up as reflection. An
 * envMap normally also lights a surface diffusely (`iblIrradiance`), which
 * turned half-metal brackets chalky and pale liquids milky; dropping that
 * term after the maps are sampled leaves the mirror image alone. Chains any
 * patch the material already has.
 */
function reflectionsOnly(m) {
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (shader, renderer) => {
    if (prev) prev.call(m, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_fragment_maps>",
      "#include <lights_fragment_maps>\n\tiblIrradiance = vec3( 0.0 );",
    );
  };
  m.customProgramCacheKey = () => `${prevKey ? prevKey.call(m) : ""}|envReflectOnly`;
}

/**
 * The room the lab scenes' metal and glass reflect, built as a small three.js
 * scene and prefiltered once (no HDRI to download, so it works offline).
 *
 * three.js's own RoomEnvironment was tried first: its ceiling is one bright
 * light panel, so every flat surface facing up (a bench, a stand's base, a
 * water surface) mirrored it and went white. This studio keeps the overhead
 * a moderate grey and puts its bright softboxes at the sides and behind, so
 * curved and upright metal catches crisp highlights while flat tops reflect
 * a quiet tone. Its floor is near the canvas colour, so undersides stay dark.
 *
 * `tone: "light"` is the same studio for a scene set in a bright room (the
 * static-electricity room with its pale walls and rug): there a chrome dome
 * mirroring a dark floor read as black, where the real one shows the room.
 */
const STUDIO_TONES = {
  dark: { floor: "#1c2230", wall: "#58616f", top: "#737d8c" },
  light: { floor: "#9a9184", wall: "#b9bfc8", top: "#cdd2d9" },
};

function buildStudio(tone = "dark") {
  const studio = new THREE.Scene();
  const t = STUDIO_TONES[tone] ?? STUDIO_TONES.dark;
  // A sphere painted from floor to ceiling: floor, walls, a quiet overhead.
  const shell = new THREE.SphereGeometry(20, 48, 24);
  const pos = shell.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const floor = new THREE.Color(t.floor);
  const wall = new THREE.Color(t.wall);
  const top = new THREE.Color(t.top);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const h = pos.getY(i) / 20;
    if (h < 0) c.copy(wall).lerp(floor, Math.min(1, -h * 2.2));
    else c.copy(wall).lerp(top, Math.min(1, h * 1.4));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  shell.setAttribute("color", new THREE.BufferAttribute(col, 3));
  studio.add(new THREE.Mesh(shell, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  // Softboxes: two tall ones front left and right, a wide one behind and a
  // thin strip high at the back for a rim on top edges. Brighter than 1, so
  // the prefiltered reflection keeps a hot core.
  const box = (w, h, x, y, z, power) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(power, power, power), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    studio.add(m);
  };
  box(5, 11, -11, 2, 11, 4.5);
  box(5, 11, 12, 1, 9, 3.2);
  box(14, 6, 0, 3, -15, 2.2);
  box(18, 1.2, 0, 11, -10, 3);
  return studio;
}

/**
 * A studio for metal and glass to reflect. Without one a polished surface
 * has nothing to mirror: high metalness renders near-black and glass shows no
 * highlights, which is why the lab scenes had dialled their metals down.
 *
 * It is NOT the scene's environment: as scene-wide image-based light it
 * flooded the walls, benches and labels each scene had balanced its lights
 * for. It is handed only to the materials `reflectStrength` picks (metal and
 * clear glass) as their envMap, and as reflection only (`reflectionsOnly`).
 * New meshes keep mounting as a scene runs, so the scene is re-scanned a few
 * times a second; a material is looked at once. `metal` and `glass` scale the
 * two kinds' reflections, `rotation` (radians about y) turns the studio and
 * `tone` picks the dark or light room (see `buildStudio`).
 */
function StudioEnvironment({ metal = 0.75, glass = 1.3, rotation = 0, tone = "dark" }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const texture = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const studio = buildStudio(tone);
    const target = pmrem.fromScene(studio, 0.03);
    studio.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
    pmrem.dispose();
    return target;
  }, [gl, tone]);
  const seen = useMemo(() => new WeakSet(), [texture, metal, glass]);
  const clock = useRef(0);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((_, delta) => {
    clock.current -= delta;
    if (clock.current > 0) return;
    clock.current = 0.25;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m || seen.has(m)) continue;
        seen.add(m);
        const k = reflectStrength(m, { metal, glass });
        if (k <= 0) continue;
        m.envMap = texture.texture;
        m.envMapIntensity = k;
        m.envMapRotation.set(0, rotation, 0);
        reflectionsOnly(m);
        m.needsUpdate = true;
      }
    });
  });

  return null;
}

function PerformanceManager({ autoPauseHidden }) {
  const setFrameloop = useThree((state) => state.setFrameloop);
  
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && autoPauseHidden) {
        setFrameloop("demand"); // "demand" pauses the continuous rAF loop while tab is hidden
      } else {
        setFrameloop("always");
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibility);
    // Trigger once on mount
    handleVisibility();
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [autoPauseHidden, setFrameloop]);

  return null;
}

export function WebGLCleanup() {
  const { scene } = useThree();
  useEffect(() => {
    return () => {
      try {
        if (scene) {
          scene.traverse((object) => {
            try {
              if (object.geometry) object.geometry.dispose();
              if (object.material) {
                // Dispose all texture maps
                for (const key in object.material) {
                  const value = object.material[key];
                  if (value && typeof value.dispose === 'function') {
                    value.dispose();
                  }
                }
                object.material.dispose();
              }
            } catch (_) {
              // Safe geometry/material disposal
            }
          });
        }
      } catch (_) {
        // Safe scene teardown
      }
    };
  }, [scene]);
  return null;
}

/**
 * Every scene mounts through here, so orbit behaviour, colour management
 * and DPR policy are decided once.
 */
export function SceneCanvas({
  camera = { position: [0, 2.5, 11], fov: 45 },
  controls,
  fog,
  lights,
  environment,
  onPointerMissed,
  children,
}) {
  // Read graphics settings reactively
  const gfxArray = useLiveQuery(() => db.settings.where('key').startsWith('gfx_').toArray());
  
  const gfx = useMemo(() => {
    const s = { ...DEFAULT_GRAPHICS_SETTINGS };
    if (gfxArray) {
      for (const item of gfxArray) {
        const key = item.key.replace("gfx_", "");
        s[key] = item.value;
      }
    }
    return s;
  }, [gfxArray]);

  return (
    <Canvas
      camera={camera}
      dpr={[1, gfx.pixelRatio]}
      shadows={gfx.enableShadows}
      gl={{
        antialias: gfx.enableAntialias,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
        powerPreference: "high-performance",
      }}
      onPointerMissed={onPointerMissed}
      frameloop="always"
    >
      <WebGLCleanup />
      <PerformanceManager autoPauseHidden={gfx.autoPauseHidden} />
      <color attach="background" args={[CANVAS_BG]} />
      {fog && <fog attach="fog" args={[CANVAS_BG, fog[0], fog[1]]} />}
      <StudioLights {...lights} />
      {environment ? <StudioEnvironment {...(typeof environment === "object" ? environment : {})} /> : null}
      {children}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={2}
        maxDistance={45}
        autoRotate={controls?.autoRotate ?? false}
        autoRotateSpeed={controls?.autoRotateSpeed !== undefined ? controls.autoRotateSpeed : 0.45 * (controls?.speed ?? 1.0)}
        {...controls}
      />
    </Canvas>
  );
}

// ─── In-scene text ──────────────────────────────────────────────────

// No `backdrop-blur` on these: a label is re-positioned every frame, and a
// blurred backdrop behind thirty moving elements makes the browser re-blur the
// canvas under each of them on every frame. The fill is 85% opaque already, so
// the blur was close to invisible and the cost was not.
export function SceneLabel({
  position,
  children,
  tone = "text-ink-200",
  accent = false,
  distanceFactor,
  zIndexRange = [40, 0],
  className = "",
}) {
  return (
    <Html
      position={position}
      center
      distanceFactor={distanceFactor}
      style={{ pointerEvents: "none" }}
      zIndexRange={zIndexRange}
    >
      <span
        className={`whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
          accent
            ? "border-duck-500/50 bg-duck-500/15 text-duck-300"
            : `border-ink-800 bg-ink-950/85 ${tone}`
        } ${className}`}
      >
        {children}
      </span>
    </Html>
  );
}

/** Stands in for SceneLabel when a scene's labels are switched off. */
export const NoLabel = () => null;

/**
 * Whether a scene's labels are on, for scenes whose labels are spread over
 * many subcomponents. Provide it INSIDE SceneCanvas — React context does not
 * cross the R3F boundary, so a provider outside the canvas is never seen.
 */
export const LabelsOn = createContext(true);

/** A SceneLabel that renders nothing while the nearest LabelsOn is false. */
export function ToggleLabel(props) {
  return useContext(LabelsOn) ? <SceneLabel {...props} /> : null;
}

/**
 * A label in a column beside the model, joined to the part it names by a thin
 * leader line with a dot on the part. For crowded models, where labels sat on
 * their parts and piled on top of each other.
 *
 * `side` is the column the label is in: a left-column label ends at `at`, a
 * right-column one starts there, so neither runs back over the model.
 */
export function Callout({ anchor, at, side = "right", children, tone = "text-ink-200", accent = false, color = "#c6cfdf" }) {
  const points = useMemo(() => [anchor, at], [anchor[0], anchor[1], anchor[2], at[0], at[1], at[2]]);
  if (!useContext(LabelsOn)) return null;
  return (
    <group>
      {/* Drawn over everything: a leader line that vanishes behind the first
          rib it passes is no help finding what it points at. */}
      <Line points={points} color={color} lineWidth={1} transparent opacity={0.75} depthTest={false} renderOrder={10} />
      <mesh position={anchor} renderOrder={10}>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshBasicMaterial color={color} depthTest={false} transparent />
      </mesh>
      <Html position={at} style={{ pointerEvents: "none" }} zIndexRange={[40, 0]}>
        <span
          className={`inline-block whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
            accent ? "border-duck-500/50 bg-duck-500/15 text-duck-300" : `border-ink-800 bg-ink-950/85 ${tone}`
          }`}
          style={{ transform: side === "left" ? "translate(-100%, -50%)" : "translate(0, -50%)" }}
        >
          {children}
        </span>
      </Html>
    </group>
  );
}

/**
 * Frames a `view` box ({ cx, cy, cz?, width, height, depth? }) at any canvas
 * aspect, looking along `direction`, and hands the target to the orbit
 * controls. Runs on resize and when the box changes, never per frame, so the
 * user's orbiting is left alone in between.
 *
 * `depth` is the box's extent towards the camera: its front face is that
 * much nearer, and it is the front face that has to fit.
 *
 * Do not also pass `target` in SceneCanvas's `controls`: SceneCanvas spreads
 * it onto OrbitControls every render, which would undo the target set here.
 */
export function FitCamera({ view, direction = [0, 0.15, 1], fov = 45, margin = 1.04 }) {
  const camera = useThree((st) => st.camera);
  const controls = useThree((st) => st.controls);
  const aspect = useThree((st) => st.size.width / Math.max(st.size.height, 1));
  const { cx = 0, cy = 0, cz = 0, width, height, depth = 0 } = view;
  const [dx, dy, dz] = direction;
  useEffect(() => {
    // A canvas measured before layout is 0 wide; fitting to it sends the camera to NaN.
    if (!(aspect > 0.05)) return;
    const tanHalf = Math.tan((fov / 2) * DEG);
    const target = new THREE.Vector3(cx, cy, cz);
    const fit = Math.max(height / 2 / tanHalf, width / 2 / (tanHalf * aspect)) * margin + depth / 2;
    camera.position.copy(target).addScaledVector(new THREE.Vector3(dx, dy, dz).normalize(), fit);
    camera.lookAt(target);
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
  }, [camera, controls, aspect, cx, cy, cz, width, height, depth, dx, dy, dz, fov, margin]);
  return null;
}

const _camTarget = new THREE.Vector3();
const _camStep = new THREE.Vector3();
const _camOffset = new THREE.Vector3();
const _camQuat = new THREE.Quaternion();

/**
 * A camera that can follow something moving: a scene's "Camera" choice.
 *
 *   overview  the scene's own framing. Switching back to it glides the
 *             camera home to `home` ({ position, target }).
 *   follow    the orbit target tracks `targetRef`'s world position, and the
 *             camera moves with it, so the user can still orbit and zoom
 *             round the moving thing. On entering (and on each `resetKey`)
 *             it closes in to `distance`, until the user zooms themselves.
 *   ride      the camera rides on `targetRef`: at `eye` in its local frame,
 *             looking at `look`, with its up turning with the object (upside
 *             down at the top of a loop). Orbiting is switched off.
 *
 * It owns the orbit target: do not also pass `target` in SceneCanvas's
 * `controls`, which re-applies it every render and would undo the follow.
 * `home.target` is set on mount instead.
 *
 * Mount it AFTER whatever moves `targetRef`: frame callbacks run in mount
 * order, and one mounted first reads last frame's position. Riding a fast
 * car, that put the camera a third of a metre behind the rider's eyes.
 */
export function FollowCamera({ mode = "overview", targetRef, distance = 3, home, eye = [0, 1, 0], look = [4, 1, 0], near = 0.02, resetKey = 0 }) {
  const camera = useThree((st) => st.camera);
  const controls = useThree((st) => st.controls);
  const homing = useRef(false);
  const settling = useRef(false);
  const saved = useRef(null);
  const homePos = home?.position;
  const homeTarget = home?.target;

  // The home framing on mount: SceneCanvas sets the camera's position, this
  // its target.
  useEffect(() => {
    if (!controls || !homeTarget) return;
    controls.target.set(...homeTarget);
    controls.update();
  }, [controls]); // eslint-disable-line react-hooks/exhaustive-deps

  // The user taking the camera stops any glide in progress.
  useEffect(() => {
    if (!controls) return undefined;
    const stop = () => {
      homing.current = false;
      settling.current = false;
    };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  useEffect(() => {
    homing.current = mode === "overview";
    settling.current = mode === "follow";
  }, [mode, resetKey]);

  // Riding needs a near plane close enough for the car's own nose, the
  // controls off, and both put back afterwards.
  useEffect(() => {
    if (mode !== "ride" || !controls) return undefined;
    saved.current = { near: camera.near };
    controls.enabled = false;
    camera.near = near;
    camera.updateProjectionMatrix();
    return () => {
      camera.near = saved.current.near;
      camera.up.set(0, 1, 0);
      camera.updateProjectionMatrix();
      controls.enabled = true;
      // back out behind the car rather than staying inside it
      _camOffset.copy(camera.position).sub(controls.target);
      if (_camOffset.lengthSq() < distance * distance) {
        camera.position.copy(controls.target).addScaledVector(_camOffset.normalize(), distance);
      }
      camera.lookAt(controls.target);
    };
  }, [mode, controls, camera, near, distance]);

  useFrame((_, rawDelta) => {
    if (!controls) return;
    const dt = Math.min(rawDelta, 0.1);
    const obj = targetRef?.current;

    if (mode === "ride" && obj) {
      obj.updateWorldMatrix(true, false);
      obj.getWorldQuaternion(_camQuat);
      camera.position.set(...eye).applyMatrix4(obj.matrixWorld);
      controls.target.set(...look).applyMatrix4(obj.matrixWorld);
      camera.up.set(0, 1, 0).applyQuaternion(_camQuat);
      camera.lookAt(controls.target);
      return;
    }

    if (mode === "follow" && obj) {
      obj.getWorldPosition(_camTarget);
      // the target eases after the object, and the camera moves with it
      _camStep.copy(_camTarget).sub(controls.target).multiplyScalar(1 - Math.exp(-dt * 7));
      controls.target.add(_camStep);
      camera.position.add(_camStep);
      if (settling.current) {
        _camOffset.copy(camera.position).sub(controls.target);
        const d = _camOffset.length();
        const next = d + (distance - d) * (1 - Math.exp(-dt * 3));
        camera.position.copy(controls.target).addScaledVector(_camOffset, next / Math.max(d, 1e-6));
        if (Math.abs(next - distance) < 0.01 * distance) settling.current = false;
      }
      return;
    }

    if (mode === "overview" && homing.current && homePos && homeTarget) {
      const a = 1 - Math.exp(-dt * 4);
      _camTarget.set(...homeTarget);
      controls.target.lerp(_camTarget, a);
      _camStep.set(...homePos);
      camera.position.lerp(_camStep, a);
      if (camera.position.distanceTo(_camStep) < 0.01 && controls.target.distanceTo(_camTarget) < 0.01) homing.current = false;
    }
  });

  return null;
}

// ─── Corner-pinned panels ───────────────────────────────────────────

// The two placeholders that used to live here -- SceneReadout and
// SceneLegend -- are gone. Both returned null, but every scene passed them a
// full readout spec and colour key anyway: 97 call sites, 1,518 lines of
// rows, notes and legend entries that rendered nowhere.
//
// That was finding X1. The live panels are built by VisualizationHUD from
// the solveX() engines in lib/, so the scene-side copies had no way of being
// wrong loudly -- they just drifted. The enzyme scene still carried a 50 degC
// denaturation note and a rate > 0.6 threshold of its own; the crystal scene
// still keyed bonds in a colour it had stopped drawing them in.
//
// The single definition is the lib/ module, which the scene and the HUD both
// import. Re-exporting a spec from the scene would move it back out of that
// shared home -- and could not work anyway, since VisualizationHUD is
// upstream of the scenes.

// ─── Geometry primitives ────────────────────────────────────────────

const UP = new THREE.Vector3(0, 1, 0);

/** Orientation + midpoint for a segment, shared by Bond and VectorArrow. */
function useSegment(from = [0, 0, 0], to = [0, 1, 0]) {
  return useMemo(() => {
    const fromArr = Array.isArray(from) ? from : [0, 0, 0];
    const toArr = Array.isArray(to) ? to : [0, 1, 0];
    const a = new THREE.Vector3(fromArr[0] ?? 0, fromArr[1] ?? 0, fromArr[2] ?? 0);
    const b = new THREE.Vector3(toArr[0] ?? 0, toArr[1] ?? 0, toArr[2] ?? 0);
    const delta = new THREE.Vector3().subVectors(b, a);
    const length = delta.length();
    const direction = length > 1e-6 ? delta.clone().normalize() : UP.clone();
    return {
      a,
      length,
      direction,
      quaternion: new THREE.Quaternion().setFromUnitVectors(UP, direction),
      midpoint: new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
    };
    // Arrays are fresh objects on every render, so depend on the numbers.
  }, [from?.[0], from?.[1], from?.[2], to?.[0], to?.[1], to?.[2]]);
}

export function Bond({
  from = [0, 0, 0],
  to = [0, 1, 0],
  radius = 0.075,
  color = PALETTE.line,
  opacity = 1,
  emissive,
}) {
  const { length, quaternion, midpoint } = useSegment(from, to);
  if (length < 1e-6) return null;
  return (
    <mesh position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 14]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive ?? color}
        emissiveIntensity={emissive ? 0.7 : 0.12}
        roughness={0.4}
        metalness={0.2}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

/** Shaft + head + optional floating label. The workhorse for vector fields. */
export function VectorArrow({
  from = [0, 0, 0],
  to = [0, 1, 0],
  color = PALETTE.gold,
  radius = 0.05,
  headLength = 0.34,
  headRadius = 0.14,
  label,
  labelOffset = 0.42,
  opacity = 1,
}) {
  const { a, length, direction, quaternion } = useSegment(from, to);
  if (length < 0.005) return null;

  // Adaptively scale head & shaft so short arrows never vanish
  const effHeadLength = Math.min(headLength, length * 0.45);
  const headScale = effHeadLength / Math.max(0.001, headLength);
  const effHeadRadius = Math.max(0.02, headRadius * headScale);
  const effRadius = Math.max(0.008, Math.min(radius, effHeadRadius * 0.45));

  const shaft = Math.max(0.001, length - effHeadLength);
  const shaftCentre = a.clone().addScaledVector(direction, shaft / 2);
  const headCentre = a.clone().addScaledVector(direction, shaft + effHeadLength / 2);
  const labelAt = a.clone().addScaledVector(direction, length + labelOffset);

  return (
    <group>
      <mesh position={shaftCentre} quaternion={quaternion}>
        <cylinderGeometry args={[effRadius, effRadius, shaft, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.1}
          toneMapped={false}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </mesh>
      <mesh position={headCentre} quaternion={quaternion}>
        <coneGeometry args={[effHeadRadius, effHeadLength, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          toneMapped={false}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </mesh>
      {label && (
        <Html position={labelAt} center style={{ pointerEvents: "none" }} zIndexRange={[40, 0]}>
          <div 
            className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm whitespace-nowrap"
            style={{ backgroundColor: color, opacity: 0.9 }}
          >
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

export function AtomSphere({
  position,
  radius = 0.3,
  color = PALETTE.bone,
  emissiveIntensity = 0.45,
  opacity = 1,
  onClick,
  onPointerOver,
  onPointerOut,
}) {
  return (
    <mesh
      position={position}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <sphereGeometry args={[radius, 28, 28]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        roughness={0.28}
        metalness={0.2}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

/** Soft glow shell — cheap depth cue for nuclei, cells and lamps. */
export function Halo({ position = [0, 0, 0], radius, color, opacity = 0.07 }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 24, 24]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

// ─── Maths helpers ──────────────────────────────────────────────────

export const DEG = Math.PI / 180;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Circle in the XZ plane — orbital shells, coils, field loops. */
export function circlePoints(radius, segments = 128) {
  const pts = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([Math.cos(a) * radius, 0, Math.sin(a) * radius]);
  }
  return pts;
}

/** Deterministic pseudo-random in [0,1) — stable across re-renders. */
export function hashRandom(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE, SceneCanvas, clamp, hashRandom, lerp, FitCamera, LabelsOn, ToggleLabel } from "@/components/visualizations/scene-kit";
import { ProfiledTube } from "@/components/visualizations/tube-transit";
import { usePackedModel } from "@/components/visualizations/plant-model";
import { StageCaption, StageCycleDriver } from "@/components/visualizations/stage-stepper";
import { smoothstep } from "@/lib/stageCycle";
import { PAIRS, PARENTS, arrestIndexFor, chiasmaPlan, chromatids as listChromatids, colchicineApplied, cycleFor, modeFor } from "@/lib/cellDivision";
import {
  ARM_LENGTH,
  D2,
  LMAX,
  MITOCHONDRIA,
  NUCLEUS_R,
  ORGANELLES,
  R,
  R2,
  VESICLES,
  choreograph,
  chromatidProfile,
  fibreReach,
  makeLiveBag,
  placeOrganelle,
  smax,
  sphereProfile,
} from "@/components/visualizations/mitosis-choreography";

// ─── Mitosis and meiosis ────────────────────────────────────────────
// A 2n = 4 cell — two homologous pairs, maternal red and paternal blue —
// stepped through division, or left to run.
//
// Everything animated reads ONE bag, `live.current`, that the choreography
// fills every frame from the stepper's clock: the pure `divisionPose` in
// `lib/cellDivision.js` gives the continuous channels (condensation,
// envelope, pole separation, spindle, alignment, separation, elongation,
// furrow, synapsis, crossing over), and `choreograph` below turns them into
// where every chromatid, centrosome, nucleus and cell lobe is. The meshes
// then only copy numbers into transforms and buffers — nothing allocates
// per frame:
//
//   membrane    a dynamic `ProfiledTube` lathe: two sphere profiles under a
//               smooth-max, whose centres drift apart and whose neck sharpens
//               as the furrow closes — one sphere, a stretched cell, two
//               lobes, two cells, from the same buffer. Its shader makes the
//               thin membrane show most where it is seen edge-on.
//   chromatids  eight dynamic `ProfiledTube`s along their own long axis. The
//               centre-offset callback lays sisters side by side, touching at
//               the centromere; sweeps the arms back when they are pulled;
//               and, in meiosis, drags the distal arms across to the
//               homologue at a chiasma. The colour callback paints each
//               station by which parent that stretch of DNA now comes from
//               (`originAt`), with the pair's G-bands; a bump map gives the
//               coiled-fibre surface.
//   chromatin   in interphase each chromosome is a decondensed fibre in its
//               own territory (our Blender model, `division.glb`), drawn
//               where that chromatid is and shrinking into it as it condenses.
//   spindle     one instanced mesh of unit cylinders: kinetochore fibres in
//               bundles from each centrosome to the kinetochores facing it,
//               interpolar fibres overlapping at the equator, asters.
//               Colchicine collapses them to stubs.
//
// The nuclear envelope (with its pores), nucleolus, centrioles and
// mitochondria are also our models (`scripts/division-model`).
//
// Meiosis II is the same machinery in two smaller cells whose spindle axis
// is turned 90°, each holding the two chromosomes its pole received in
// anaphase I — one from each pair, assorted independently.
//
// The choreography itself lives in `mitosis-choreography.js`, where a test
// runs the whole cycle frame by frame and checks nothing jumps between
// stages. Every ambient motion runs on `live.clock`, which the speed slider
// scales.
// ─────────────────────────────────────────────────────────────────────

const DIVISION_GLB = "/models/division.glb";

/** The two daughter cells at their widest, the stage headline above and the caption below. */
const DIVISION_VIEW = { cx: 0, cy: -0.25, width: 10.4, height: 8, depth: 5.2 };
const MEMBRANE_RINGS = 96;
const MEMBRANE_SEGMENTS = 48;
const CHROMATID_RINGS = 44;
const CHROMATID_SEGMENTS = 12;
const CENTRIOLE_LENGTH = 0.3;
const KFIBRES = 3;
const FIBRES_INTERPOLAR = 14;
const FIBRES_ASTRAL = 14;

const COLOURS = {
  membrane: "#7fe3d6",
  envelope: "#cbbcff",
  maternal: PARENTS.maternal.colour,
  paternal: PARENTS.paternal.colour,
  kinetochore: "#fde68a",
  centrosome: "#fbbf24",
  pcm: "#fcd34d",
  microtubule: "#7dd3fc",
  microtubulePoisoned: "#a3e635",
  actin: "#fb923c",
  chiasma: "#fef9c3",
  poison: "#84cc16",
  vesicle: "#d6f5ef",
  // vertex colours baked by scripts/division-model, named here for the key
  mitochondrion: "#f7a07e",
  nucleolus: "#8f80c4",
};

const MT_COLOUR = new THREE.Color(COLOURS.microtubule);
const MT_POISONED = new THREE.Color(COLOURS.microtubulePoisoned);

/**
 * Giemsa (G) bands, as [from, to] in u (−1 p-arm tip → 0 centromere → +1
 * q-arm tip). Homologues share a banding pattern — the same genes in the
 * same order — so a crossover swaps colour, never bands.
 */
const BANDS = [
  [[-0.9, -0.78], [-0.55, -0.42], [-0.22, -0.13], [0.16, 0.27], [0.42, 0.55], [0.7, 0.8], [0.9, 0.96]],
  [[-0.82, -0.62], [-0.32, -0.18], [0.2, 0.38], [0.6, 0.78]],
];

/** Which parent a station of a chromatid comes from, as a 0–1 blend towards the other parent — allocation-free `originAt`. */
function blendAt(ch, u, plan, reveal) {
  if (reveal <= 0 || plan.length === 0) return 0;
  const arm = u < 0 ? "p" : "q";
  const d = Math.abs(u);
  let flips = 0;
  for (const x of plan) if (x.pair === ch.pair && x.which === ch.which && x.arm === arm && d > x.u) flips += 1;
  return flips % 2 === 1 ? reveal : 0;
}

/** How dark the G-band is at u, 0–1. */
function bandAt(pair, u) {
  let best = 0;
  for (const [a, b] of BANDS[pair]) {
    const w = smoothstep(clamp((u - a + 0.025) / 0.05, 0, 1)) * (1 - smoothstep(clamp((u - b + 0.025) / 0.05, 0, 1)));
    if (w > best) best = w;
  }
  return best;
}

// ─── Shaders and textures ───────────────────────────────────────────

const NOISE = /* glsl */ `
  float mmH(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float mmN(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(mmH(i), mmH(i + vec3(1, 0, 0)), f.x), mix(mmH(i + vec3(0, 1, 0)), mmH(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(mmH(i + vec3(0, 0, 1)), mmH(i + vec3(1, 0, 1)), f.x), mix(mmH(i + vec3(0, 1, 1)), mmH(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
`;

/**
 * The plasma membrane: a thin film, so it shows most where it is seen
 * edge-on (a Fresnel rim) and lets the inside through face-on, with a
 * faint lumpiness from the cortex beneath.
 */
function makeMembraneMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    color: COLOURS.membrane,
    roughness: 0.32,
    metalness: 0,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
    clearcoat: 0.7,
    clearcoatRoughness: 0.3,
    sheen: 0.7,
    sheenColor: new THREE.Color("#e2fffb"),
  });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vMmLocal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvMmLocal = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vMmLocal;\n${NOISE}`)
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        vec3 mmP = vMmLocal * 2.4;
        normal = normalize(normal + 0.16 * (vec3(mmN(mmP), mmN(mmP + 3.1), mmN(mmP + 5.7)) - 0.5));`,
      )
      .replace(
        "#include <opaque_fragment>",
        `float mmFres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.6);
        diffuseColor.a = clamp(opacity * (0.38 + 2.6 * mmFres), 0.0, 0.9);
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => "mm-membrane";
  return m;
}

/**
 * A nuclear envelope that breaks into fragments as `uHoles` rises (prophase)
 * and fuses back as it falls (telophase). The torn edges glow faintly.
 */
function makeEnvelopeMaterial(seed) {
  const uniforms = { uHoles: { value: 0 }, uSeed: { value: seed } };
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, color: COLOURS.envelope, roughness: 0.45, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nuniform float uHoles, uSeed;\nvarying vec3 vEnvLocal;\n${NOISE}`)
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vEnvLocal = position;
        transformed *= 1.0 + uHoles * (0.06 + 0.12 * mmN(position * 3.0 + uSeed));`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform float uHoles, uSeed;\nvarying vec3 vEnvLocal;\n${NOISE}`)
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        float envN = mmN(vEnvLocal * 4.5 + uSeed) * 0.7 + mmN(vEnvLocal * 13.0 + uSeed) * 0.3;
        float envCut = uHoles * 1.08;
        if (envCut > 0.001 && envN < envCut) discard;
        float envEdge = envCut > 0.001 ? 1.0 - smoothstep(0.0, 0.05, envN - envCut) : 0.0;`,
      )
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.93, 1.0), envEdge * 0.8);");
  };
  m.customProgramCacheKey = () => `mm-envelope-${seed}`;
  return { material: m, uniforms };
}

/**
 * A tileable bump texture for the chromatids: the lumpy surface of a
 * chromatid, which is a fibre folded into loops and coiled. Integer
 * frequencies wrap round (u) and along (v) seamlessly.
 */
let chromatidBump = null;
function getChromatidBump() {
  if (chromatidBump) return chromatidBump;
  const W = 64;
  const Hh = 256;
  const data = new Uint8Array(W * Hh * 4);
  const waves = Array.from({ length: 14 }, (_, i) => ({
    ku: 1 + Math.floor(hashRandom(i * 3.7 + 1) * 6),
    kv: 4 + Math.floor(hashRandom(i * 5.1 + 2) * 30),
    ph: hashRandom(i * 7.3 + 3) * Math.PI * 2,
    a: 0.4 + 0.6 * hashRandom(i * 2.9 + 4),
  }));
  for (let y = 0; y < Hh; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const u = x / W;
      const v = y / Hh;
      let s = 0;
      let t = 0;
      for (const w of waves) {
        s += w.a * Math.abs(Math.sin(Math.PI * (w.ku * u + w.kv * v) + w.ph));
        t += w.a;
      }
      // Coils: a helix of ridges running round the chromatid.
      const coil = 0.5 + 0.5 * Math.sin(2 * Math.PI * (u + 22 * v));
      const value = clamp(0.78 * (s / t) + 0.22 * coil, 0, 1);
      const k = (y * W + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = Math.round(value * 255);
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, Hh, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  chromatidBump = tex;
  return tex;
}

// ─── Cell parts ─────────────────────────────────────────────────────

/** The membrane lathe, along local +y; the parent turns +y onto the unit's spindle axis. */
function Membrane({ live, index }) {
  const material = useMemo(() => makeMembraneMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  const radiusAt = useCallback(
    (s) => {
      const u = live.current.units[index];
      const a = s - LMAX;
      return smax(sphereProfile(a, -u.c, u.r), sphereProfile(a, u.c, u.r), u.k);
    },
    [live, index],
  );
  useFrame(() => {
    const u = live.current.units[index];
    material.opacity = u.membraneOpacity * u.fade;
  });
  return (
    <group rotation={[0, 0, -Math.PI / 2]} position={[-LMAX, 0, 0]}>
      <ProfiledTube length={LMAX * 2} rings={MEMBRANE_RINGS} segments={MEMBRANE_SEGMENTS} radiusAt={radiusAt} dynamic renderOrder={5}>
        <primitive object={material} attach="material" />
      </ProfiledTube>
    </group>
  );
}

/** Actin contractile ring at the equator, tightening as the furrow closes; what is left is the midbody. */
function ContractileRing({ live, index }) {
  const ref = useRef(null);
  useFrame(() => {
    const u = live.current.units[index];
    const m = ref.current;
    if (!m) return;
    const on = u.furrow > 0.001 && u.fade > 0.02 && u.ringFade > 0.01;
    m.visible = on;
    if (!on) return;
    const rr = Math.max(0.06, u.ringRadius + 0.04);
    m.scale.set(rr, rr, 1);
    m.material.opacity = (u.furrow < 0.995 ? 0.9 : 0.6) * u.fade * u.ringFade;
  });
  return (
    <mesh ref={ref} rotation={[0, Math.PI / 2, 0]}>
      <torusGeometry args={[1, 0.045, 10, 64]} />
      <meshStandardMaterial color={COLOURS.actin} emissive={COLOURS.actin} emissiveIntensity={0.7} transparent opacity={0.9} />
    </mesh>
  );
}

/** A nuclear envelope (our model, with its pores) that fragments as it breaks down and fuses as it re-forms. */
function NuclearEnvelope({ live, index, which, part }) {
  const ref = useRef(null);
  const env = useMemo(() => makeEnvelopeMaterial(index * 3.1 + (which === "centre" ? 0.4 : which === "left" ? 1.7 : 2.9)), [index, which]);
  useEffect(() => () => env.material.dispose(), [env]);
  useFrame(() => {
    const u = live.current.units[index];
    const m = ref.current;
    if (!m) return;
    if (!u.active || !u.frame) {
      m.visible = false;
      return;
    }
    const n = u.nucleus;
    const amount = which === "centre" ? n.centre : n.poles;
    const radius = which === "centre" ? n.centreRadius : n.poleRadius;
    m.visible = amount > 0.01 && u.fade > 0.02;
    m.position.set(which === "centre" ? 0 : (which === "left" ? -1 : 1) * n.poleOffset, 0, 0);
    m.scale.setScalar(radius);
    m.quaternion.copy(u.frame.inverse);
    env.uniforms.uHoles.value = 1 - amount;
    env.material.opacity = 0.22 * u.fade;
  });
  return <mesh ref={ref} geometry={part.geometry} material={env.material} renderOrder={3} />;
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const SPIN = new THREE.Quaternion();
const SPIN_E = new THREE.Euler();

/** The nucleolus: gone early in prophase, back late in telophase. */
function Nucleolus({ live, index, which, part }) {
  const ref = useRef(null);
  useFrame(() => {
    const u = live.current.units[index];
    const m = ref.current;
    if (!m) return;
    const n = u.nucleus;
    const amount = which === "centre" ? n.nucleolus : n.poleNucleolus;
    m.visible = u.active && Boolean(u.frame) && amount > 0.02 && u.fade > 0.02;
    if (!m.visible) return;
    const radius = which === "centre" ? n.centreRadius : n.poleRadius;
    if (which === "centre" && u.frame.axis === "y") {
      // Meiosis II: the same offset in the world as the nucleolus had at the end of meiosis I.
      m.position.set(radius * 0.22, 0, -radius * 0.18);
    } else {
      m.position.set(which === "centre" ? 0.3 : (which === "left" ? -1 : 1) * n.poleOffset, radius * 0.22, radius * 0.18);
    }
    m.scale.setScalar(radius * 0.24 * (0.4 + 0.6 * amount));
    m.material.opacity = amount * u.fade;
    SPIN.setFromAxisAngle(Y_AXIS, live.current.clock * 0.05);
    m.quaternion.copy(u.frame.inverse).multiply(SPIN);
  });
  return (
    <mesh ref={ref} geometry={part.geometry}>
      <meshStandardMaterial vertexColors roughness={0.7} transparent opacity={1} />
    </mesh>
  );
}

/** A centrosome: a mother centriole and its daughter at right angles, in their pericentriolar material. */
function Centrosome({ live, index, which, parts }) {
  const ref = useRef(null);
  const pcmRef = useRef(null);
  useFrame(() => {
    const L = live.current;
    const u = L.units[index];
    const g = ref.current;
    if (!g || !u.active || !u.frame) return;
    const k = which === "left" ? 0 : 1;
    g.position.copy(u.centrosomes[k]);
    SPIN_E.set(0.6 + 0.2 * Math.sin(L.clock * 0.3), L.clock * 0.25, 0.3);
    g.quaternion.copy(u.frame.inverse).multiply(SPIN.setFromEuler(SPIN_E));
    g.visible = u.fade > 0.02;
    if (pcmRef.current) {
      pcmRef.current.material.opacity = (0.16 + 0.12 * u.spindle) * u.fade;
      pcmRef.current.scale.setScalar(0.2 + 0.06 * u.spindle);
    }
  });
  return (
    <group ref={ref}>
      <group position={[0, -CENTRIOLE_LENGTH / 2, 0]}>
        {parts.centrioleMother && <mesh geometry={parts.centrioleMother.geometry} scale={CENTRIOLE_LENGTH} material={CENTRIOLE_MATERIAL} />}
        {parts.centriole && <mesh geometry={parts.centriole.geometry} scale={CENTRIOLE_LENGTH * 0.85} position={[0.02, 0.06, -0.13]} rotation={[Math.PI / 2, 0, 0]} material={CENTRIOLE_MATERIAL} />}
      </group>
      {parts.pcm && (
        <mesh ref={pcmRef} geometry={parts.pcm.geometry} scale={0.2}>
          <meshStandardMaterial vertexColors color={COLOURS.pcm} emissive={COLOURS.pcm} emissiveIntensity={0.25} roughness={0.8} transparent opacity={0.2} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

const CENTRIOLE_MATERIAL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.05, emissive: new THREE.Color("#3a2604"), emissiveIntensity: 0.6 });

/**
 * The spindle: kinetochore fibres (in bundles), interpolar and astral
 * microtubules as one instanced mesh of unit cylinders, aimed every frame.
 */
function Spindle({ live, index, chromatids }) {
  const ref = useRef(null);
  const kinetochoreCount = chromatids.length * KFIBRES;
  const count = kinetochoreCount + 2 * FIBRES_INTERPOLAR + 2 * FIBRES_ASTRAL;
  const state = useRef({
    dummy: new THREE.Object3D(),
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    mid: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
    quat: new THREE.Quaternion(),
    colour: new THREE.Color(),
    lastPoison: -1,
  });
  // Fixed fan directions for the interpolar and astral fibres, and the spread of each kinetochore bundle.
  const fans = useMemo(() => {
    const inter = Array.from({ length: FIBRES_INTERPOLAR }, (_, i) => {
      const ang = (i / FIBRES_INTERPOLAR) * Math.PI * 2 + 0.3;
      const spread = 0.12 + 0.3 * hashRandom(i + 11);
      return { y: Math.cos(ang) * spread, z: Math.sin(ang) * spread, len: 1.06 + 0.2 * hashRandom(i + 21) };
    });
    const astral = Array.from({ length: FIBRES_ASTRAL }, (_, i) => {
      const ang = (i / FIBRES_ASTRAL) * Math.PI * 2 + 0.9;
      const tilt = 0.3 + 0.7 * hashRandom(i + 31);
      return { y: Math.cos(ang) * tilt, z: Math.sin(ang) * tilt, len: 0.5 + 0.35 * hashRandom(i + 41) };
    });
    const bundle = Array.from({ length: KFIBRES }, (_, i) => ({ y: (hashRandom(i + 51) - 0.5) * 0.06, z: (hashRandom(i + 61) - 0.5) * 0.06, start: (hashRandom(i + 71) - 0.5) * 0.1 }));
    return { inter, astral, bundle };
  }, []);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const L = live.current;
    const u = L.units[index];
    const s = state.current;
    const d = s.dummy;
    const t = L.clock;
    const grow = u.spindle;
    const poison = L.poison;
    const visible = grow > 0.01 && u.fade > 0.02;
    mesh.visible = visible;
    if (!visible) return;
    const jitter = 1 + 0.03 * Math.sin(t * 6);
    // Kinetochores are only reachable once the envelope is down (prometaphase).
    const reach = 1 - u.nucleus.centre;

    let i = 0;
    const hide = () => {
      d.scale.set(0, 0, 0);
      d.updateMatrix();
      mesh.setMatrixAt(i++, d.matrix);
    };
    const place = (fromX, fromY, fromZ, toX, toY, toZ, fraction, radius) => {
      s.from.set(fromX, fromY, fromZ);
      s.to.set(toX, toY, toZ);
      s.dir.subVectors(s.to, s.from);
      const full = s.dir.length();
      const len = full * fraction;
      if (len < 0.02) {
        hide();
        return;
      }
      s.dir.normalize();
      s.mid.copy(s.from).addScaledVector(s.dir, len / 2);
      s.quat.setFromUnitVectors(s.up, s.dir);
      d.position.copy(s.mid);
      d.quaternion.copy(s.quat);
      d.scale.set(radius, len, radius);
      d.updateMatrix();
      mesh.setMatrixAt(i++, d.matrix);
    };

    // Kinetochore fibres: bundles from the centrosome a chromatid faces to its kinetochore (unit-local).
    for (const ch of chromatids) {
      const st = L.chromatids[ch.key];
      const hold = reach * u.kinetochoreHold * smoothstep(clamp((st.condense - 0.3) / 0.3, 0, 1));
      const off = st.unit !== index || hold < 0.01;
      const c = u.centrosomes[st.pullDir < 0 ? 0 : 1];
      for (const b of fans.bundle) {
        if (off) hide();
        else place(c.x, c.y + b.start, c.z + b.start, st.kin.x, st.kin.y + b.y, st.kin.z + b.z, grow * hold * jitter, 0.011);
      }
    }
    // Interpolar fibres from each pole, overlapping past the equator; they lengthen in anaphase B.
    // After anaphase only the midzone between the new nuclei is left.
    for (let k = 0; k < 2; k += 1) {
      const pole = k === 0 ? -1 : 1;
      const c = u.centrosomes[k];
      const S = u.midzoneStart;
      const mz = u.midzone;
      for (const fb of fans.inter) {
        const fromX = lerp(c.x, pole * S, mz);
        const fromY = lerp(c.y, fb.y * 0.4, mz);
        const fromZ = lerp(c.z, fb.z * 0.4, mz);
        place(fromX, fromY, fromZ, pole * S * (1 - fb.len * grow), fb.y * S * u.midzoneSpread, fb.z * S * u.midzoneSpread, 1, 0.009);
      }
      // Asters: short fibres radiating from the centrosome away from the spindle.
      const ox = c.x;
      const oy = c.y;
      const oz = c.z;
      const norm = Math.hypot(ox, oy) || 1;
      for (const fb of fans.astral) {
        const len = fb.len * grow;
        const ex = ox + (ox / norm) * len - fb.y * len * (oy / norm);
        const ey = oy + (oy / norm) * len + fb.y * len * (ox / norm);
        const ez = oz + fb.z * len;
        // They reach the cortex under the membrane, never through it.
        place(ox, oy, oz, ex, ey, ez, fibreReach(u, ox, oy, oz, ex, ey, ez), 0.008);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (Math.abs(poison - s.lastPoison) > 0.01) {
      s.lastPoison = poison;
      s.colour.copy(MT_COLOUR).lerp(MT_POISONED, poison);
      mesh.material.color.copy(s.colour);
      mesh.material.emissive.copy(s.colour);
      mesh.material.opacity = 0.75 - 0.4 * poison;
    }
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <cylinderGeometry args={[1, 1, 1, 5, 1]} />
      <meshStandardMaterial color={COLOURS.microtubule} emissive={COLOURS.microtubule} emissiveIntensity={0.8} roughness={0.5} transparent opacity={0.75} toneMapped={false} depthWrite={false} />
    </instancedMesh>
  );
}

/**
 * Mitochondria and vesicles in the cytoplasm. Each rides with the lobe on
 * its side, so the furrow shares them out between the daughters, and stays
 * where it was when meiosis II takes over (`placeOrganelle`).
 */
function Organelles({ live, part }) {
  const mitoRef = useRef(null);
  const vesRef = useRef(null);
  const state = useMemo(() => ({ dummy: new THREE.Object3D(), p: new THREE.Vector3() }), []);
  useFrame(() => {
    const L = live.current;
    const { dummy, p } = state;
    for (const [ref, list, base, alpha] of [
      [mitoRef, ORGANELLES.mito, 0.36, 1],
      [vesRef, ORGANELLES.ves, 0.055, 0.6],
    ]) {
      const mesh = ref.current;
      if (!mesh) continue;
      let fade = 0;
      list.forEach((o, i) => {
        const placed = placeOrganelle(L, o, p);
        if (!placed) {
          dummy.scale.setScalar(0);
        } else {
          dummy.position.copy(p);
          dummy.rotation.set(o.rot[0] + 0.1 * Math.sin(L.clock * 0.3 + o.phase), o.rot[1], o.rot[2]);
          dummy.scale.setScalar(base * o.size * placed[0]);
          fade = Math.max(fade, placed[1]);
        }
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = fade > 0.02;
      mesh.material.opacity = alpha * fade;
    }
  });
  return (
    <>
      {part && (
        <instancedMesh ref={mitoRef} args={[part.geometry, undefined, MITOCHONDRIA]} frustumCulled={false}>
          <meshStandardMaterial vertexColors roughness={0.55} transparent opacity={1} />
        </instancedMesh>
      )}
      <instancedMesh ref={vesRef} args={[undefined, undefined, VESICLES]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color={COLOURS.vesicle} roughness={0.3} transparent opacity={0.6} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

/**
 * One chromatid: a dynamic tube along its own +y with the centromere at
 * the group origin. Sisters lie side by side, joined at the centromere;
 * separated chromatids sweep their arms back; chiasma arms cross over to
 * the homologue; every station is coloured by the parent it now comes
 * from, with the pair's G-bands.
 */
function Chromatid({ live, ch }) {
  const groupRef = useRef(null);
  const kinetoRef = useRef(null);
  const pair = PAIRS[ch.pair];
  const total = ARM_LENGTH * pair.length;
  const Lp = total * pair.centromere;
  const Lq = total - Lp;
  const tmp = useMemo(() => ({ colour: new THREE.Color(), own: new THREE.Color(ch.parent === "maternal" ? COLOURS.maternal : COLOURS.paternal), other: new THREE.Color(ch.parent === "maternal" ? COLOURS.paternal : COLOURS.maternal) }), [ch.parent]);
  const material = useMemo(() => {
    const bump = getChromatidBump();
    return new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.62,
      metalness: 0,
      bumpMap: bump,
      bumpScale: 1.5,
      sheen: 1,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color("#ffffff"),
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0.06,
      transparent: true,
      opacity: 1,
    });
  }, []);
  useEffect(() => () => material.dispose(), [material]);

  // u: −1 at the p-arm tip, 0 at the centromere, +1 at the q-arm tip.
  const uOf = (s) => (s < Lp ? -(Lp - s) / Lp : (s - Lp) / Lq);

  const radiusAt = useCallback(
    (s) => {
      const st = live.current.chromatids[ch.key];
      return chromatidProfile(uOf(s), s, ch.pair, ch.which) * (0.3 + 0.7 * st.condense);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live, ch.key, Lp, Lq],
  );

  const centreAt = useCallback(
    (s, out) => {
      const L = live.current;
      const st = L.chromatids[ch.key];
      const u = uOf(s);
      const au = Math.abs(u);
      const armLen = u < 0 ? Lp : Lq;
      // Side by side with the sister, touching at the centromere and opening a little towards the tips.
      const r = chromatidProfile(u, s, ch.pair, ch.which) * (0.3 + 0.7 * st.condense);
      const off = st.side * st.bow * (r + 0.012 + 0.09 * Math.pow(au, 1.5) * st.splay * pair.length);
      // A pulled chromatid trails its arms behind the kinetochore.
      const sweep = -st.pullDir * st.bend * 0.42 * au * armLen;
      // Decondensing chromatin wanders (less inside an intact nucleus).
      const wander = st.wander * 0.25 * Math.sin(s * 9 + L.clock * 0.6 + ch.pair);
      let x = sweep + wander + off;
      const z = wander * 0.6;
      // Chiasma: beyond the crossover point the arm crosses to the homologue's side.
      if (st.chiasmaPull > 0.001) {
        for (const cx of L.plan) {
          if (cx.pair !== ch.pair || cx.which !== ch.which) continue;
          if ((cx.arm === "p") !== (u < 0)) continue;
          if (au > cx.u) {
            // Homologues sit at a = ±0.27; the distal arm crosses to the partner's side.
            const k = smoothstep(clamp((au - cx.u) / 0.25, 0, 1)) * st.chiasmaPull;
            x -= st.pullDir * 0.42 * k;
          }
        }
      }
      out[0] = x;
      out[1] = z;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live, ch.key, ch.pair, ch.which, ch.parent, Lp, Lq, pair.length],
  );

  const colourAt = useCallback(
    (s, out) => {
      const st = live.current.chromatids[ch.key];
      const u = uOf(s);
      tmp.colour.copy(tmp.own).lerp(tmp.other, blendAt(ch, u, live.current.plan, st.reveal));
      // G-bands, and the centromere a little darker still.
      const dark = (1 - 0.34 * bandAt(ch.pair, u)) * (1 - 0.25 * Math.exp(-(u * u) / 0.01));
      out[0] = tmp.colour.r * dark;
      out[1] = tmp.colour.g * dark;
      out[2] = tmp.colour.b * dark;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live, ch, Lp, Lq, tmp],
  );

  useFrame(() => {
    const st = live.current.chromatids[ch.key];
    const u = live.current.units[st.unit];
    const g = groupRef.current;
    if (!g || !u.frame) return;
    g.visible = st.visible && st.opacity > 0.02;
    g.position.copy(st.world);
    g.quaternion.copy(st.quat);
    const stretch = st.lengthScale;
    g.scale.set(1, stretch, 1);
    material.opacity = st.opacity;
    material.transparent = st.opacity < 0.995;
    material.depthWrite = st.opacity > 0.6;
    const k = kinetoRef.current;
    if (k) {
      const grow = smoothstep(clamp((st.condense - 0.4) / 0.25, 0, 1));
      k.visible = grow > 0.01;
      k.position.copy(st.kinLocal);
      k.scale.set(0.45 * grow, grow / stretch, grow);
      k.material.opacity = st.opacity;
    }
  });

  return (
    <group ref={groupRef}>
      <group position={[0, -Lp, 0]}>
        <ProfiledTube length={total} rings={CHROMATID_RINGS} segments={CHROMATID_SEGMENTS} radiusAt={radiusAt} centreAt={centreAt} colourAt={colourAt} dynamic vRepeat={3 * pair.length}>
          <primitive object={material} attach="material" />
        </ProfiledTube>
      </group>
      {/* Kinetochore: the protein plate on the centromere that the fibres grab. */}
      <mesh ref={kinetoRef}>
        <sphereGeometry args={[0.05, 12, 10]} />
        <meshStandardMaterial color={COLOURS.kinetochore} emissive={COLOURS.kinetochore} emissiveIntensity={0.7} transparent opacity={1} />
      </mesh>
    </group>
  );
}

/** Interphase chromatin: each chromosome decondensed in its own territory, tinted by its parent. */
function Territory({ live, ch, part, variant }) {
  const ref = useRef(null);
  const material = useMemo(() => {
    const tint = new THREE.Color(ch.parent === "maternal" ? COLOURS.maternal : COLOURS.paternal).lerp(new THREE.Color("#ffffff"), 0.42);
    return new THREE.MeshStandardMaterial({ vertexColors: true, color: tint, roughness: 0.6, transparent: true, opacity: 1, emissive: tint, emissiveIntensity: 0.12 });
  }, [ch.parent]);
  useEffect(() => () => material.dispose(), [material]);
  const spin = useMemo(() => [hashRandom(variant * 3.3 + ch.pair) * 6.28, hashRandom(variant * 5.1 + 1) * 6.28, hashRandom(variant * 7.7 + 2) * 6.28], [variant, ch.pair]);
  useFrame(() => {
    const L = live.current;
    const st = L.chromatids[ch.key];
    const m = ref.current;
    if (!m) return;
    m.visible = st.territoryOpacity > 0.02;
    if (!m.visible) return;
    m.position.copy(st.territory);
    m.rotation.set(spin[0] + 0.05 * Math.sin(L.clock * 0.2 + variant), spin[1] + L.clock * 0.03, spin[2]);
    m.scale.setScalar(st.territorySize);
    material.opacity = st.territoryOpacity;
    material.depthWrite = st.territoryOpacity > 0.6;
  });
  return <mesh ref={ref} geometry={part.geometry} material={material} />;
}

/** A soft glow where non-sister chromatids are held together at a chiasma. */
function Chiasmata({ live }) {
  const ref = useRef(null);
  const count = 4;
  const state = useRef({ dummy: new THREE.Object3D(), p: new THREE.Vector3() });
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const L = live.current;
    const d = state.current.dummy;
    const p = state.current.p;
    const amount = L.pose ? L.pose.chiasmaVisible : 0;
    for (let i = 0; i < count; i += 1) {
      const cx = L.plan[i];
      if (!cx || amount < 0.02) {
        d.scale.set(0, 0, 0);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
        continue;
      }
      // Halfway between the two participants, at the crossover point along the arm.
      const pairKey = PAIRS[cx.pair];
      const mat = L.chromatids[`${pairKey.key}-maternal-${cx.which}`];
      const pat = L.chromatids[`${pairKey.key}-paternal-${cx.which}`];
      const u = L.units[mat.unit];
      const total = ARM_LENGTH * pairKey.length;
      const Lp = total * pairKey.centromere;
      const along = (cx.arm === "p" ? -Lp : total - Lp) * cx.u;
      p.set((mat.seat[0] + pat.seat[0]) / 2 - along * Math.sin(mat.tilt), (mat.seat[1] + pat.seat[1]) / 2 + along * Math.cos(mat.tilt), (mat.seat[2] + pat.seat[2]) / 2).applyMatrix4(u.frame.matrix);
      d.position.copy(p);
      d.scale.setScalar(0.11 * amount * (1 + 0.12 * Math.sin(L.clock * 3 + i)));
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial color={COLOURS.chiasma} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

/** One cell (or, in meiosis II, one daughter): its frame, membrane, nuclei, centrosomes, spindle and furrow ring. */
function CellUnit({ live, index, chromatids, parts }) {
  const ref = useRef(null);
  useFrame(() => {
    const u = live.current.units[index];
    const g = ref.current;
    if (!g) return;
    g.visible = u.active;
    if (!u.active) return;
    g.position.copy(u.frame.origin);
    g.quaternion.copy(u.frame.quat);
    g.scale.setScalar(u.frame.scale);
  });
  return (
    <group ref={ref}>
      <Membrane live={live} index={index} />
      <ContractileRing live={live} index={index} />
      {parts.envelope &&
        ["centre", "left", "right"].map((w) => <NuclearEnvelope key={w} live={live} index={index} which={w} part={parts.envelope} />)}
      {parts.nucleolus && ["centre", "left", "right"].map((w) => <Nucleolus key={w} live={live} index={index} which={w} part={parts.nucleolus} />)}
      <Centrosome live={live} index={index} which="left" parts={parts} />
      <Centrosome live={live} index={index} which="right" parts={parts} />
      <Spindle live={live} index={index} chromatids={chromatids} />
    </group>
  );
}

/** The parts drawn from our model; mounted under Suspense so the clock runs while it loads. */
function ModelledParts({ live, chromatids }) {
  const parts = usePackedModel(DIVISION_GLB);
  return (
    <>
      <CellUnit live={live} index={0} chromatids={chromatids} parts={parts} />
      <CellUnit live={live} index={1} chromatids={chromatids} parts={parts} />
      <Organelles live={live} part={parts.mitochondrion} />
      {chromatids.map((ch) => {
        const variant = (ch.pair * 2 + ch.which + (ch.parent === "paternal" ? 1 : 0)) % 4;
        const part = parts[`territory${variant}`];
        return part ? <Territory key={ch.key} live={live} ch={ch} part={part} variant={variant} /> : null;
      })}
    </>
  );
}

/** A sickly haze over the cell while the spindle poison is in. */
function PoisonHaze({ live }) {
  const ref = useRef(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const L = live.current;
    const p = L.poison;
    m.visible = p > 0.02;
    m.material.opacity = 0.09 * p * (1 + 0.2 * Math.sin(L.clock * 1.5));
    m.scale.setScalar(R * 1.25 + 0.4 * p);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 64, 48]} />
      <meshBasicMaterial color={COLOURS.poison} transparent opacity={0} depthWrite={false} side={THREE.BackSide} />
    </mesh>
  );
}

// ─── Labels ─────────────────────────────────────────────────────────

function Labels({ pose, modeKey, plan, poison, snapshot }) {
  if (!pose) return null;
  const meiosis = modeKey === "meiosis";
  const two = pose.division === 2;
  const xL = two ? -D2 : 0;
  const yTop = two ? R2 + 0.5 : R + 0.6;
  const items = [];
  const at = (x, y, z, text, tone, key) => items.push({ x, y, z, text, tone, key });

  if (poison > 0.4) {
    at(0, yTop + 0.7, 0, "colchicine · microtubules depolymerised — no spindle, no plate, no anaphase", "text-lime-300", "poison");
  }
  if (pose.phase === "interphase") {
    at(-0.2, NUCLEUS_R + 0.35, 0.6, "nucleus · chromatin decondensed, each chromosome in its own territory, already replicated", "text-violet-300", "nuc");
    at(1.15, NUCLEUS_R + 0.85, 0, "centrosomes · two centriole pairs (duplicated)", "text-amber-300", "cen");
    at(0.95, 0.55, 1.1, "nucleolus", "text-violet-200", "nucleolus");
    at(-2.15, -1.25, 0.6, "mitochondria", "text-orange-300", "mito");
  }
  if (pose.phase === "prophase" && pose.condense > 0.5 && !two) {
    at(0, -R - 0.55, 0.3, meiosis ? "prophase I · homologues pair up — a bivalent is 2 chromosomes, 4 chromatids" : "prophase · each chromosome = 2 identical sister chromatids joined at the centromere", "text-ink-100", "pro");
    if (pose.envelope < 0.6) at(0, NUCLEUS_R + 0.55, 0.3, "nuclear envelope breaking into fragments", "text-violet-300", "env");
  }
  if (pose.phase === "prophase" && two) {
    at(xL, -R2 - 0.55, 0.3, "prophase II · no replication — each chromosome is still 2 chromatids", "text-ink-100", "pro2");
  }
  if (pose.poles > 0.6 && pose.phase !== "cytokinesis" && pose.phase !== "interphase" && poison < 0.4) {
    const P = R * (0.7 + 0.16 * pose.elongate) * (two ? R2 / R : 1);
    if (two) {
      at(xL - 0.2, -P - 0.3, 0.3, "centrosome", "text-amber-300", "cL");
      at(D2 + 0.2, P + 0.3, 0.3, "centrosome", "text-amber-300", "cR");
    } else if (pose.phase !== "telophase") {
      at(-P - 0.1, -0.55, 0, "centrosome · spindle pole", "text-amber-300", "cL");
      at(P + 0.1, -0.55, 0, "centrosome · spindle pole", "text-amber-300", "cR");
    }
  }
  if (pose.phase === "metaphase" && pose.align > 0.7 && poison < 0.4) {
    if (meiosis && !two) {
      at(0, R + 0.35, 0, "metaphase I · bivalents on the plate — HOMOLOGUES face opposite poles", "text-sky-300", "plate");
      at(1.45, 1.6, 0.5, "homologous pair — red maternal, blue paternal", "text-rose-300", "homo");
      at(1.25, -1.45, 0.5, "kinetochore fibres · both sisters face ONE pole", "text-sky-200", "mono");
    } else if (two) {
      at(xL, R2 + 0.35, 0, "metaphase II · single chromosomes on each plate", "text-sky-300", "plate2");
      at(xL + 0.9, 0.62, 0.6, plan.length > 0 ? "sister chromatids — no longer identical after crossing over" : "sister chromatids — identical", "text-rose-300", "sis2");
    } else {
      at(0, R + 0.35, 0, "metaphase plate · every chromosome's centromere on the equator", "text-sky-300", "plate");
      at(1.3, 1.95, 0.4, "sister chromatids — one chromosome, two copies", "text-rose-300", "sis");
      at(1.3, -1.25, 0.4, "kinetochore fibres · sisters face opposite poles", "text-sky-200", "kfib");
    }
  }
  if (pose.phase === "anaphase" && pose.separate > 0.2) {
    const text = meiosis && !two ? "anaphase I · homologues part — sisters STAY together (reductional)" : two ? "anaphase II · sister chromatids part (equational)" : "anaphase · sister chromatids part — each is now a chromosome";
    at(two ? xL : 0, (two ? R2 : R) + 0.35, 0, text, "text-emerald-300", "ana");
    if (pose.elongate > 0.4) at(0, -(two ? R2 : R) - 0.55, 0.3, "anaphase B · interpolar fibres slide, the cell elongates", "text-sky-300", "anaB");
  }
  if (pose.phase === "telophase" && pose.envelope > 0.3) {
    at(
      two ? xL : 0,
      (two ? R2 : R) + 0.35,
      0,
      meiosis && !two ? "telophase I · two haploid nuclei — n = 2, each chromosome still 2 chromatids" : two ? "telophase II · four haploid nuclei" : "telophase · two nuclei re-form, chromosomes decondense",
      "text-violet-300",
      "telo",
    );
  }
  if (pose.phase === "cytokinesis" && pose.furrow > 0.1) {
    const done = meiosis && !two ? "two haploid cells · now meiosis II, with no S phase between" : two ? (plan.length > 0 ? "four gametes · n = 2, all genetically different" : "four gametes · n = 2 — two identical pairs: only crossing over makes all four differ") : "two identical diploid cells · 2n = 4";
    at(two ? xL : 0, -(two ? R2 : R) - 0.55, 0.3, pose.furrow < 0.95 ? "cleavage furrow · actin–myosin ring tightens" : done, "text-amber-300", "furrow");
  }
  if (meiosis && !two && pose.chiasmaVisible > 0.5 && plan.length > 0) {
    at(-0.9, -1.6, 0.7, `${plan.length} chiasma${plan.length === 1 ? "" : "ta"} · non-sister chromatids swap arms`, "text-yellow-200", "chi");
  }
  if (meiosis && !two && pose.phase === "prophase" && pose.chiasmaVisible > 0.5 && plan.length === 0) {
    at(-0.9, -1.6, 0.7, "no chiasmata · arms keep their parent's alleles", "text-ink-400", "chi0");
  }

  return (
    <>
      {items.map((it) => (
        <ToggleLabel key={it.key} position={[it.x, it.y, it.z]} tone={it.tone}>
          {it.text}
        </ToggleLabel>
      ))}
      <StageCaption position={[0, -(two ? R2 : R) - 1.25, 0.4]} snapshot={snapshot} arrestedLabel="arrested by colchicine" />
    </>
  );
}

// ─── The scene ──────────────────────────────────────────────────────

export default function MitosisMeiosisCanvas({ params = {}, setParam }) {
  const { mode: modeParam = "mitosis", stage = 0, playing = true, chiasmata = 2, colchicine = 0, speed = 1, showLabels = true } = params || {};
  const mode = modeFor(modeParam);
  const cycle = cycleFor(mode.key);
  const chromatids = useMemo(() => listChromatids(), []);
  const live = useRef(null);
  if (live.current === null) live.current = makeLiveBag(chromatids);
  const plan = useMemo(() => (mode.key === "meiosis" ? chiasmaPlan(chiasmata) : []), [mode.key, chiasmata]);
  useEffect(() => {
    live.current.plan = plan;
  }, [plan]);
  const sp = Number(speed);
  const rate = Number.isFinite(sp) ? Math.max(0, sp) : 1;

  const lock = colchicineApplied(colchicine) ? arrestIndexFor(mode.key) : null;
  const stepperLive = useRef(null);
  const [snapshot, setSnapshot] = useState(null);
  const [pose, setPose] = useState(null);
  const [poison, setPoison] = useState(0);

  const onFrame = useCallback(
    (snap) => {
      choreograph(live.current, snap, mode.key, chromatids, snap.dt, rate);
    },
    [mode.key, chromatids, rate],
  );
  const onTick = useCallback((snap) => {
    setSnapshot(snap);
    setPose(live.current.pose);
    setPoison(Math.round(live.current.poison * 20) / 20);
  }, []);

  return (
    <SceneCanvas camera={{ position: [0.6, 2.4, 10.5], fov: 44 }} controls={{ minDistance: 4, maxDistance: 26 }} lights={{ ambient: 0.62, keyLight: 1.3, rim: PALETTE.violet }}>
      <FitCamera view={DIVISION_VIEW} direction={[0.05, 0.22, 1]} fov={44} />
      <LabelsOn.Provider value={showLabels !== false}>
        <StageCycleDriver cycle={cycle} stage={stage} playing={playing} speed={rate} lock={lock} live={stepperLive} setParam={setParam} onFrame={onFrame} onTick={onTick} />

        <Suspense fallback={null}>
          <ModelledParts live={live} chromatids={chromatids} />
        </Suspense>
        {chromatids.map((ch) => (
          <Chromatid key={ch.key} live={live} ch={ch} />
        ))}
        <Chiasmata live={live} />
        <PoisonHaze live={live} />

        <Labels pose={pose} modeKey={mode.key} plan={plan} poison={poison} snapshot={snapshot} />
      </LabelsOn.Provider>
    </SceneCanvas>
  );
}

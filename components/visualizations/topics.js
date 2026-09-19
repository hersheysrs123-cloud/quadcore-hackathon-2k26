// ─── Topic registry ─────────────────────────────────────────────────
// The single source of truth for every 3D topic: its category, the schema
// the HUD renders its controls from, the takeaways, and the quiz.
//
// This lives apart from any one screen because two surfaces render it — the
// workspace 3D tab and the standalone /visualizations route. They used to
// hold byte-identical copies of the whole thing, which is exactly the kind
// of duplication that goes stale the first time only one is updated.
// ─────────────────────────────────────────────────────────────────────

import {
  Activity,
  Aperture,
  Eye,
  ArrowUpDown,
  Atom,
  AudioWaveform,
  BatteryCharging,
  Beaker,
  Bell,
  BicepsFlexed,
  Biohazard,
  Boxes,
  Bug,
  CircuitBoard,
  CloudLightning,
  Cylinder,
  Dna,
  Droplets,
  Earth,
  Filter,
  Flame,
  FlameKindling,
  FlaskConical,
  Flower2,
  GitBranch,
  Hexagon,
  Leaf,
  Lightbulb,
  Magnet,
  Microscope,
  Orbit,
  Pill,
  Puzzle,
  Pyramid,
  Radiation,
  Rocket,
  RotateCcw,
  Sandwich,
  Scale,
  Scissors,
  Shapes,
  ShieldCheck,
  Ship,
  Shuffle,
  Sigma,
  Skull,
  Sparkles,
  SprayCan,
  Spline,
  Split,
  Syringe,
  HeartPulse,
  Thermometer,
  ThermometerSun,
  TrainFront,
  Triangle,
  TrendingDown,
  Unplug,
  Waves,
  Weight,
  Wind,
  Zap,
} from "lucide-react";
import { MEDIA, MEDIA_OPTIONS, mediumFor } from "@/components/visualizations/media";
import {
  ALGORITHM_OPTIONS,
  AQUEOUS_SOLUTION_OPTIONS,
  BARRIER_OPTIONS,
  BOLUS_CONSISTENCY_OPTIONS,
  CARDIAC_PATHOLOGY_OPTIONS,
  CIRCUIT_TOPOLOGY_OPTIONS,
  DECAY_MODE_OPTIONS,
  DIVISION_MODE_OPTIONS,
  CURVE_OPTIONS,
  ELECTROLYTE_OPTIONS,
  FLUID_OPTIONS,
  FRICTION_SURFACE_OPTIONS,
  GRAVITY_OPTIONS,
  GRAVITY_ORIENTATION_OPTIONS,
  HEAT_VIEW_OPTIONS,
  METAL_STRIP_OPTIONS,
  NERVE_PATHWAY_OPTIONS,
  POLLINATION_VECTOR_OPTIONS,
  ROD_MATERIAL_OPTIONS,
  SACRIFICIAL_METAL_OPTIONS,
  SAMPLE_MIXTURE_OPTIONS,
  SEPARATION_STATION_OPTIONS,
  SOIL_MOISTURE_OPTIONS,
  SOLVENT_TYPE_OPTIONS,
  SOLID_PRESET_OPTIONS,
  SPECIMEN_SHAPE_OPTIONS,
  STATIC_TARGET_OPTIONS,
  STIMULUS_OPTIONS,
  STRUCTURE_OPTIONS,
  SUBSTANCE_OPTIONS,
  SURFACE_OPTIONS,
  VSEPR_PRESETS,
  vseprPresetFor,
} from "@/components/visualizations/topic-options";
import { MAX_DENSITY, MIN_DENSITY, SOLIDS, solidPresetFor } from "@/lib/buoyancy";
import { leakTimeConstant } from "@/lib/electrostatics";
import { flameIsLit, flameTemperature } from "@/lib/heatTransfer";
import { FOSSIL_GTC_PER_YEAR, solarLabel } from "@/lib/carbonCycle";
import { PRODUCER_KJ_AT_FULL_SUN } from "@/lib/foodChain";
import { TIMELINE_SECONDS, timeLabel } from "@/lib/pollination";
import { MAX_CHIASMATA, arrestIndexFor, colchicineApplied, stagesFor } from "@/lib/cellDivision";
import { CARDIAC_STAGE_OPTIONS, MAX_BPM, MIN_BPM, formatBpm } from "@/lib/cardiacCycle";
import { MAX_DAYS, MIN_DAYS, dayLabel } from "@/lib/redox";
import { COLLAR_MAX, COLLAR_MIN, collarLabel } from "@/lib/combustion";
import { PRESSURE_MAX_ATM, PRESSURE_MIN_ATM, TEMP_MAX_C, TEMP_MIN_C } from "@/lib/particleModel";
import { DEFAULT_ATOMS, MAX_ATOMS, MIN_ATOMS, SIM_HALF_LIFE_S } from "@/lib/radioactiveDecay";

export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "physics", label: "Physics", emoji: "⚛️" },
  { id: "chemistry", label: "Chemistry", emoji: "🧪" },
  { id: "biology", label: "Biology", emoji: "🧬" },
  { id: "cs", label: "Computer Science", emoji: "💻" },
  { id: "math", label: "Mathematics", emoji: "📐" },
];
export const CATEGORY_EMOJI = { physics: "⚛️", chemistry: "🧪", biology: "🧬", cs: "💻", math: "📐" };

export const TOPICS = [
  // ═══ Physics ═══════════════════════════════════════════════════════
  {
    id: "refraction",
    category: "physics",
    icon: Waves,
    title: "Wave Refraction & Snell's Law",
    blurb: "Light crossing a boundary between two media",
    syllabus: "Physics 3.2 · Light",
    keywords:
      "snell refraction critical angle total internal reflection optical fibre emergent ray glass block lateral displacement air water perspex diamond",
    defaults: {
      angle: 40,
      medium1: "air",
      medium2: "glass",
      n1: 1.0,
      n2: 1.5,
      thickness: 3,
      wavelength: 520,
      showReflection: true,
      showLabels: true,
      animate: true,
    },
    controls: [
      {
        type: "choice",
        key: "medium1",
        label: "Medium 1 — around the block",
        columns: 3,
        options: MEDIA_OPTIONS,
        patch: (v) => ({ medium1: v, n1: MEDIA[v].n }),
      },
      {
        type: "choice",
        key: "medium2",
        label: "Medium 2 — the block",
        columns: 3,
        options: MEDIA_OPTIONS,
        patch: (v) => ({ medium2: v, n2: MEDIA[v].n }),
      },
      { type: "slider", key: "angle", label: "Angle of incidence i", min: 0, max: 89, step: 1, format: (v) => `${v}°` },
      {
        type: "slider",
        key: "n1",
        label: "Refractive index n₁",
        min: 1,
        max: 2.5,
        step: 0.01,
        format: (v) => v.toFixed(2),
        patch: (v) => ({ n1: v, medium1: mediumFor(v) }),
      },
      {
        type: "slider",
        key: "n2",
        label: "Refractive index n₂",
        min: 1,
        max: 2.5,
        step: 0.01,
        format: (v) => v.toFixed(2),
        patch: (v) => ({ n2: v, medium2: mediumFor(v) }),
      },
      { type: "slider", key: "thickness", label: "Block thickness t", min: 1.2, max: 4.5, step: 0.1, format: (v) => v.toFixed(1) },
      { type: "slider", key: "wavelength", label: "Wavelength", min: 380, max: 700, step: 5, format: (v) => `${v} nm` },
      { type: "toggle", key: "showLabels", label: "Label the rays" },
      { type: "toggle", key: "showReflection", label: "Reflected rays" },
      { type: "toggle", key: "animate", label: "Animate photon" },
    ],
    concepts: [
      "Light bends toward the normal entering an optically denser medium, because it travels slower there (v = c ÷ n), and away from the normal on the way out.",
      "Snell's law holds at both surfaces: n₁ sin i = n₂ sin r, with every angle measured from the normal — never from the surface.",
      "Because the block has parallel faces, the second refraction undoes the first: the emergent ray is parallel to the incident ray, displaced sideways by d = t·sin(i − r) ÷ cos r.",
    ],
    quiz: [
      {
        question:
          "A ray travels from air (n = 1.00) into glass (n = 1.50), striking the boundary at 30° to the normal. What happens?",
        options: [
          "It bends toward the normal, so θ₂ is less than 30°",
          "It bends away from the normal, so θ₂ is more than 30°",
          "It carries straight on at 30°",
          "It reflects entirely back into the air",
        ],
        answer: 0,
        explanation:
          "sin θ₂ = (1.00 × sin 30°) ÷ 1.50 = 0.333, so θ₂ ≈ 19.5°. Entering a denser medium always bends the ray toward the normal.",
      },
      {
        question:
          "Light inside glass (n = 1.50) meets the glass–air boundary at 60°. The critical angle is about 41.8°. What do you see?",
        options: [
          "Total internal reflection — no light leaves the glass",
          "A refracted ray leaving at exactly 90°",
          "A refracted ray leaving at about 35°",
          "The light splits equally between reflection and refraction",
        ],
        answer: 0,
        explanation:
          "60° exceeds the critical angle, so Snell's law has no solution — sin θ₂ would have to exceed 1. All the light reflects back inside.",
      },
    ],
  },
  {
    id: "motor",
    category: "physics",
    icon: Magnet,
    title: "Fleming's Left-Hand Rule & Motor Effect",
    blurb: "Force on a current-carrying wire in a magnetic field",
    syllabus: "Physics 4.5 · Electromagnetism",
    keywords: "fleming left hand motor effect force current field BIL commutator magnet",
    defaults: {
      current: 1.2,
      field: 1.0,
      reverseCurrent: false,
      reverseField: false,
      showFieldLines: true,
      animate: true,
    },
    controls: [
      { type: "slider", key: "current", label: "Current I", min: 0, max: 2, step: 0.05, format: (v) => `${v.toFixed(2)} A` },
      { type: "slider", key: "field", label: "Flux density B", min: 0.2, max: 2, step: 0.05, format: (v) => `${v.toFixed(2)} T` },
      { type: "toggle", key: "reverseCurrent", label: "Reverse current" },
      { type: "toggle", key: "reverseField", label: "Reverse poles" },
      { type: "toggle", key: "animate", label: "Animate flow" },
      { type: "toggle", key: "showFieldLines", label: "Field lines & poles" },
    ],
    concepts: [
      "A current-carrying wire in a magnetic field feels a force because the two fields interact — the motor effect, F = BIL.",
      "Fleming's left-hand rule gives the direction: First finger Field, seCond finger Current, thuMb Motion — all at right angles.",
      "Reversing either the current or the field reverses the force; reversing both leaves it unchanged, which is why a d.c. motor needs a split-ring commutator.",
    ],
    quiz: [
      {
        question: "In Fleming's left-hand rule, what does the second finger represent?",
        options: ["The magnetic field", "The current", "The force on the wire", "The voltage across the wire"],
        answer: 1,
        explanation:
          "First finger = Field, seCond finger = Current, thuMb = Motion. All three must be held at right angles to each other.",
      },
      {
        question:
          "A motor's coil is spinning. If you reverse BOTH the current and the magnetic field, what happens to the direction of rotation?",
        options: [
          "It spins the same way as before",
          "It reverses",
          "It stops completely",
          "It spins twice as fast",
        ],
        answer: 0,
        explanation:
          "Each reversal on its own flips the force. Doing both cancels out, so the force — and the rotation — is unchanged.",
      },
    ],
  },
  {
    id: "lenses",
    category: "physics",
    icon: Aperture,
    title: "Ray Optics — Lenses & Curved Mirrors",
    blurb: "Real and virtual image formation with convex/concave lenses and spherical mirrors",
    syllabus: "Physics 3.2 · Light",
    keywords: "lens mirror convex concave converging diverging focal point real virtual image magnification ray diagram reflection refraction",
    hideSpeedSlider: true,
    defaults: {
      opticsType: "convex_lens",
      lensType: "convex",
      focal: 2.5,
      objectDistance: 5.0,
      objectHeight: 1.5,
      showRays: true,
      showLabels: true,
      showConstruction: true,
    },
    controls: [
      {
        type: "choice",
        key: "opticsType",
        label: "Optical element",
        options: [
          { value: "convex_lens", label: "Convex Lens (Converging)" },
          { value: "concave_lens", label: "Concave Lens (Diverging)" },
          { value: "concave_mirror", label: "Concave Mirror (Converging)" },
          { value: "convex_mirror", label: "Convex Mirror (Diverging)" },
        ],
        patch: (v) => ({
          opticsType: v,
          lensType: v.includes("concave") ? "concave" : "convex",
        }),
      },
      { type: "slider", key: "focal", label: "Focal length f", min: 1, max: 4, step: 0.1, format: (v) => `${v.toFixed(1)} cm` },
      { type: "slider", key: "objectDistance", label: "Object distance u", min: 0.6, max: 9, step: 0.1, format: (v) => `${v.toFixed(1)} cm` },
      { type: "slider", key: "objectHeight", label: "Object height h", min: 0.5, max: 3.0, step: 0.1, format: (v) => `${v.toFixed(1)} cm` },
      { type: "toggle", key: "showRays", label: "Principal rays" },
      { type: "toggle", key: "showConstruction", label: "Virtual ray extensions" },
      { type: "toggle", key: "showLabels", label: "Labels & markers" },
    ],
    concepts: [
      "Convex lenses and concave mirrors converge rays toward a real focus; concave lenses and convex mirrors diverge rays so they appear to originate from a virtual focus.",
      "Lenses and mirrors share one equation, not two: 1/v + 1/u = 1/f, with u and f measured as positive distances and the magnification m = v/u. A converging element focuses real light, so it takes f > 0; a diverging one only appears to, so it takes f < 0.",
      "Real images form where light rays physically intersect and can be caught on a screen; virtual images form where only backward ray projections meet.",
      "Spherical mirrors reverse ray direction via reflection, whereas lenses refract rays through the optical material.",
    ],
    quiz: [
      {
        question:
          "An object is placed between a convex lens and its focal point. What kind of image forms?",
        options: [
          "Virtual, upright and magnified",
          "Real, inverted and magnified",
          "Real, inverted and diminished",
          "No image forms at all",
        ],
        answer: 0,
        explanation:
          "Inside F the refracted rays still diverge, so only their back-extensions meet. That gives a virtual, upright, magnified image — exactly how a magnifying glass works.",
      },
      {
        question: "What kind of image does a concave (diverging) lens always produce?",
        options: [
          "Virtual, upright and diminished",
          "Real, inverted and diminished",
          "Virtual, inverted and magnified",
          "It depends on where the object is placed",
        ],
        answer: 0,
        explanation:
          "A diverging lens spreads all rays outward, so wherever the object sits the image is virtual, upright and smaller than the object.",
      },
      {
        question: "What type of image does a convex mirror always produce regardless of object distance?",
        options: [
          "Virtual, upright and diminished",
          "Real, inverted and magnified",
          "Real, upright and same size",
          "Virtual, inverted and diminished",
        ],
        answer: 0,
        explanation:
          "A convex mirror diverges incident rays away from its virtual focal point behind the mirror, always producing an upright, virtual, diminished image (used in vehicle rear-view mirrors).",
      },
    ],
  },
  {
    id: "induction",
    category: "physics",
    icon: Zap,
    title: "Electromagnetic Induction & Faraday's Law",
    blurb: "Rotating dynamo coil & moving bar magnet with live glowing bulb and galvanometer",
    syllabus: "Physics 4.5 · Electromagnetism",
    keywords: "faraday lenz induction generator emf flux alternating current dynamo coil solenoid bar magnet",
    defaults: {
      apparatus: "generator",
      speed: 1,
      field: 1,
      turns: 3,
      showFieldLines: true,
      showCurrent: true,
      showBulb: true,
      magnetPos: 0,
      autoOscillate: true,
      magnetStrength: 1.2,
      flipPoles: false,
    },
    controls: [
      {
        type: "choice",
        key: "apparatus",
        label: "Apparatus",
        options: [
          { value: "generator", label: "AC Generator" },
          { value: "solenoid", label: "Bar Magnet & Coil" },
        ],
      },
      // Generator specific controls
      {
        type: "slider",
        key: "field",
        label: "Flux density B",
        min: 0.2,
        max: 2,
        step: 0.05,
        format: (v) => `${v.toFixed(2)} T`,
        when: (p) => !p.apparatus || p.apparatus === "generator",
      },
      // Solenoid specific controls
      {
        type: "toggle",
        key: "autoOscillate",
        label: "Auto-move magnet",
        when: (p) => p.apparatus === "solenoid",
      },
      {
        type: "slider",
        key: "magnetPos",
        label: "Magnet position x",
        min: -4.5,
        max: 4.5,
        step: 0.1,
        format: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} cm`,
        when: (p) => p.apparatus === "solenoid" && !p.autoOscillate,
      },
      {
        type: "slider",
        key: "magnetStrength",
        label: "Magnet strength",
        min: 0.5,
        max: 2.5,
        step: 0.1,
        format: (v) => `${v.toFixed(1)} T`,
        when: (p) => p.apparatus === "solenoid",
      },
      {
        type: "toggle",
        key: "flipPoles",
        label: "Reverse poles (S ⇄ N)",
        when: (p) => p.apparatus === "solenoid",
      },
      // Common controls
      {
        type: "slider",
        key: "turns",
        label: "Coil turns N",
        min: 1,
        max: 8,
        step: 1,
        format: (v) => `${v} turn${v === 1 ? "" : "s"}`,
      },
      { type: "toggle", key: "showBulb", label: "Demonstration light bulb" },
      { type: "toggle", key: "showFieldLines", label: "Show field lines" },
      { type: "toggle", key: "showCurrent", label: "Show current arrows" },
    ],
    concepts: [
      "Faraday's Law: An e.m.f. is induced in a conductor whenever there is a change in the magnetic flux linking it (ε = −N ΔΦ/Δt).",
      "Relative motion is required: A stationary magnet inside a coil produces constant flux (ΔΦ/Δt = 0), yielding zero induced e.m.f.",
      "Lenz's Law: The direction of the induced e.m.f. and current always opposes the change in flux that caused it.",
      "In an AC generator, rotating a coil continuously alters the flux linkage angle, generating a smooth alternating voltage waveform.",
    ],
    quiz: [
      {
        question: "A strong bar magnet is held completely stationary inside a multi-turn solenoid. What is the induced e.m.f.?",
        options: [
          "0 V (zero)",
          "Maximum positive voltage",
          "Maximum negative voltage",
          "A high-frequency alternating current",
        ],
        answer: 0,
        explanation:
          "Faraday's law requires a *change* in magnetic flux (dΦ/dt ≠ 0). With the magnet stationary, the flux through the coil is constant, so the induced e.m.f. is strictly zero.",
      },
      {
        question: "A coil spins steadily in a uniform magnetic field. When is the induced e.m.f. greatest?",
        options: [
          "When the plane of the coil is parallel to the field lines",
          "When the plane of the coil is perpendicular to the field lines",
          "It is constant throughout the rotation",
          "Only at the instant the coil starts moving",
        ],
        answer: 0,
        explanation:
          "e.m.f. depends on the rate of cutting field lines. With the coil's plane parallel to the field, the sides sweep across lines fastest, so dΦ/dt and e.m.f. peak.",
      },
      {
        question: "If you push the North pole of a bar magnet into a coil and the needle kicks right, what happens when you pull it out?",
        options: [
          "The needle kicks left (opposite direction)",
          "The needle kicks right again",
          "The needle stays at zero",
          "The needle spins continuously",
        ],
        answer: 0,
        explanation:
          "By Lenz's law, withdrawing the magnet causes flux to decrease instead of increase, reversing the induced current and deflecting the needle in the opposite direction.",
      },
    ],
  },
  {
    id: "gas",
    category: "physics",
    icon: Thermometer,
    title: "Kinetic Particle Theory & Gas Laws",
    blurb: "Particle collisions, temperature and pressure",
    syllabus: "Physics 2.1 · Kinetic model of matter",
    keywords: "kinetic particle theory gas pressure boyle charles temperature volume brownian collisions",
    defaults: { temperature: 300, volume: 1, particles: 60 },
    controls: [
      { type: "slider", key: "temperature", label: "Temperature", min: 100, max: 800, step: 10, format: (v) => `${v} K` },
      { type: "slider", key: "volume", label: "Volume", min: 0.4, max: 1.6, step: 0.05, format: (v) => `${v.toFixed(2)} V₀` },
      { type: "slider", key: "particles", label: "Particles", min: 20, max: 140, step: 1 },
    ],
    concepts: [
      "Gas particles move randomly at high speed; pressure is the total force of their collisions with the container walls per unit area.",
      "Heating a gas raises the average kinetic energy, so particles hit the walls harder and more often — at fixed volume, p ∝ T in kelvin.",
      "Squeezing a gas packs the same collisions into less wall area, so pressure rises: pV = constant at fixed temperature (Boyle's law).",
    ],
    quiz: [
      {
        question:
          "A sealed gas is compressed to half its volume at constant temperature. What happens to the pressure?",
        options: ["It doubles", "It halves", "It stays the same", "It quadruples"],
        answer: 0,
        explanation:
          "Boyle's law: pV = constant. Halving V must double p, because the same number of collisions now happens over half the wall area.",
      },
      {
        question: "What happens to the gas particles when the gas is cooled?",
        options: [
          "Their average kinetic energy and speed both fall",
          "They shrink in size",
          "They stop moving entirely at 0 °C",
          "They lose mass",
        ],
        answer: 0,
        explanation:
          "Temperature is a measure of average kinetic energy. Cooling slows the particles; they only stop at absolute zero (0 K, −273 °C), not 0 °C.",
      },
    ],
  },

  {
    id: "projectile",
    category: "physics",
    icon: Rocket,
    title: "Projectile Motion & Air Resistance",
    blurb: "Why a real trajectory is not the parabola in the textbook",
    syllabus: "Physics 1.5 · Forces & Motion",
    keywords:
      "projectile motion trajectory parabola air resistance drag range maximum height launch angle terminal velocity gravity moon mars jupiter horizontal vertical components suvat",
    defaults: {
      launchSpeed: 22,
      speed: 1.0,
      angle: 45,
      gravity: 9.81,
      drag: 0.04,
      mass: 1,
      showIdeal: true,
      showVectors: true,
      showLabels: true,
      running: true,
      replay: 0,
      spin: false,
    },
    controls: [
      { type: "slider", key: "angle", label: "Launch angle θ", min: 5, max: 85, step: 1, format: (v) => `${v}°` },
      { type: "slider", key: "launchSpeed", label: "Launch speed u", min: 5, max: 40, step: 1, format: (v) => `${v} m/s` },
      { type: "choice", key: "gravity", label: "Gravitational field g", columns: 4, options: GRAVITY_OPTIONS },
      { type: "slider", key: "drag", label: "Drag coefficient k", min: 0, max: 0.25, step: 0.005, format: (v) => (v === 0 ? "vacuum" : v.toFixed(3)) },
      { type: "slider", key: "mass", label: "Mass m", min: 0.2, max: 5, step: 0.1, format: (v) => `${v.toFixed(1)} kg` },
      { type: "toggle", key: "showIdeal", label: "Compare with no drag" },
      { type: "toggle", key: "showVectors", label: "Show force vectors" },
      { type: "toggle", key: "showLabels", label: "Show 3D labels" },
      { type: "toggle", key: "running", label: "Animate flight" },
      { type: "action", key: "replay", label: "Replay launch", icon: RotateCcw },
    ],
    concepts: [
      "Without drag the horizontal and vertical motions are completely independent: horizontal velocity never changes, vertical velocity changes at g. That independence is what makes the path a parabola and puts the maximum range at 45°.",
      "Air resistance acts along the path and against it, with a size that grows as v². Because it is always opposing the motion, it bleeds horizontal speed the whole flight — so the descent is steeper than the climb and the path stops being symmetric.",
      "With drag, the optimum launch angle drops below 45°, and a heavier object of the same shape travels further: the drag deceleration is k|v|v ÷ m, so more mass means the same force decelerates it less.",
    ],
    quiz: [
      {
        question:
          "Ignoring air resistance, a ball is launched at 30° and another at 60° with the same speed. How do their ranges compare?",
        options: [
          "They are equal",
          "The 30° launch goes further",
          "The 60° launch goes further",
          "It depends on the mass of each ball",
        ],
        answer: 0,
        explanation:
          "Without drag the range is (u²sin2θ)/g, and sin60° = sin120°, so angles either side of 45° that are equally far from it give identical ranges. The 60° launch simply trades horizontal speed for a longer, higher flight.",
      },
      {
        question:
          "With air resistance switched on, the trajectory becomes visibly asymmetric — steeper coming down than going up. Why?",
        options: [
          "Drag removes horizontal speed throughout the flight, so less ground is covered on the way down",
          "Gravity is stronger during the descent",
          "The ball becomes heavier as it falls",
          "Drag acts only downward, adding to the weight",
        ],
        answer: 0,
        explanation:
          "Drag opposes the velocity, so it always has a backward horizontal component. Horizontal speed therefore decays continuously, and by the time the ball is descending it is covering far less ground per second than it did on the way up.",
      },
    ],
  },
  {
    id: "interference",
    category: "physics",
    icon: AudioWaveform,
    title: "Two-Source Interference & Young's Slits",
    blurb: "Path difference, and where the bright and dark fringes land",
    syllabus: "Physics 3.1 · Waves",
    keywords:
      "interference double slit young diffraction path difference constructive destructive fringe spacing coherent superposition wavelength maxima minima ripple tank nodal lines",
    defaults: {
      slits: 2,
      separation: 2.2,
      wavelength: 1.2,
      amplitude: 0.62,
      speed: 1,
      showScreen: true,
      spin: false,
    },
    controls: [
      {
        type: "choice",
        key: "slits",
        label: "Sources",
        columns: 2,
        options: [
          { value: 1, label: "One", title: "No interference — a single spreading wave" },
          { value: 2, label: "Two", title: "Young's double slit" },
        ],
      },
      { type: "slider", key: "separation", label: "Slit separation d", min: 0.6, max: 4.5, step: 0.1, format: (v) => v.toFixed(1) },
      { type: "slider", key: "wavelength", label: "Wavelength λ", min: 0.5, max: 2.6, step: 0.05, format: (v) => v.toFixed(2) },
      { type: "slider", key: "amplitude", label: "Amplitude", min: 0.2, max: 1.2, step: 0.05, format: (v) => v.toFixed(2) },
      { type: "slider", key: "speed", label: "Animation speed", min: 0, max: 2.5, step: 0.1, format: (v) => (v === 0 ? "frozen" : `${v.toFixed(1)}×`) },
      { type: "toggle", key: "showScreen", label: "Show screen pattern" },
      { type: "toggle", key: "spin", label: "Orbit camera" },
    ],
    concepts: [
      "Where two coherent waves meet, their displacements simply add. Crest on crest gives a bigger crest — constructive interference; crest on trough cancels — destructive.",
      "Which one you get at a point depends only on the path difference to the two sources. A whole number of wavelengths means the waves arrive in step and reinforce; a half-odd number means they arrive exactly out of step and cancel.",
      "The fringes on the screen are spaced by λL ÷ d, so widening the slit separation packs them closer together and using a longer wavelength spreads them further apart.",
    ],
    quiz: [
      {
        question:
          "At a point on the screen the path difference from the two slits is 2.5λ. What is seen there?",
        options: [
          "A dark fringe — the waves arrive exactly out of phase",
          "A bright fringe — the waves arrive in phase",
          "A fringe of half the maximum brightness",
          "Nothing, because interference only occurs on the central axis",
        ],
        answer: 0,
        explanation:
          "A path difference of a half-odd number of wavelengths (0.5λ, 1.5λ, 2.5λ …) puts one wave's crest on the other's trough, so they cancel. Whole-number path differences give the bright fringes.",
      },
      {
        question: "The slit separation d is doubled while λ and L stay the same. What happens to the fringes?",
        options: [
          "They move half as far apart",
          "They move twice as far apart",
          "Their spacing is unchanged",
          "They disappear entirely",
        ],
        answer: 0,
        explanation:
          "Fringe spacing is λL ÷ d, so it is inversely proportional to d. Doubling the separation halves the spacing — which is why very fine gratings throw their orders far apart while a wide pair of slits gives a tightly packed pattern.",
      },
    ],
  },
  {
    id: "orbits",
    category: "physics",
    icon: Orbit,
    title: "Gravity Wells & Orbital Motion",
    blurb: "Circular, elliptical and escape trajectories from one launch speed",
    syllabus: "Physics 1.7 · Gravitation",
    keywords:
      "gravity orbital motion satellite ellipse kepler escape velocity circular orbit eccentricity gravitational potential well centripetal force period newton universal gravitation",
    defaults: {
      mass: 1,
      launchRadius: 3.4,
      launchSpeed: 1.35,
      running: true,
      reset: 0,
      showTrail: true,
      showWell: true,
      spin: false,
    },
    controls: [
      // Not M☉: G, the radii and the periods are all in scene units, so a
      // solar-mass label would invite reading real years off the panel.
      { type: "slider", key: "mass", label: "Central mass M", min: 0.3, max: 3, step: 0.05, format: (v) => `${v.toFixed(2)} M₀` },
      { type: "slider", key: "launchRadius", label: "Launch radius r", min: 1.6, max: 6, step: 0.1, format: (v) => v.toFixed(1) },
      { type: "slider", key: "launchSpeed", label: "Launch speed v", min: 0.2, max: 3.5, step: 0.05, format: (v) => v.toFixed(2) },
      { type: "toggle", key: "running", label: "Run orbit" },
      { type: "toggle", key: "showTrail", label: "Show path" },
      { type: "toggle", key: "showWell", label: "Show potential well" },
      { type: "toggle", key: "spin", label: "Orbit camera" },
      { type: "action", key: "reset", label: "Relaunch satellite", icon: RotateCcw },
    ],
    concepts: [
      "A satellite in orbit is in free fall the entire time. Gravity supplies the centripetal force, and the orbit is closed only because the sideways speed is exactly enough to keep missing the central body.",
      "At a given radius there is one speed that gives a circle. Slower and the satellite falls inward into an ellipse; faster and it swings out into a wider ellipse; at √2 times the circular speed the total energy reaches zero and it escapes.",
      "The rubber sheet is a picture of gravitational potential, not of space. Its depth is −GM ÷ r, which is why the well is steep close in and almost flat far out — and why escaping costs most of its energy in the first stretch.",
    ],
    quiz: [
      {
        question:
          "A satellite in a stable circular orbit is given a brief forward push, increasing its speed by 10%. What happens to its orbit?",
        options: [
          "It becomes an ellipse, with the boost point now the closest approach",
          "It stays circular but at a larger radius",
          "It immediately escapes the central body",
          "It falls directly inward toward the central body",
        ],
        answer: 0,
        explanation:
          "The extra speed adds energy, so the satellite climbs away from the boost point — but it comes back round to the same place at the same speed. That makes the boost point the perigee of a new ellipse. A circular orbit at a larger radius would need a second burn once it arrives.",
      },
      {
        question:
          "Two satellites orbit the same planet at the same radius, one twice the mass of the other. How do their orbital speeds compare?",
        options: [
          "They are identical — orbital speed does not depend on the satellite's mass",
          "The heavier one orbits faster",
          "The heavier one orbits more slowly",
          "The heavier one cannot maintain the same radius",
        ],
        answer: 0,
        explanation:
          "The required speed is √(GM ÷ r), where M is the central mass — the satellite's own mass cancels out. Doubling it doubles both the gravitational force needed and the force actually supplied, so the motion is unchanged. This is why astronauts float alongside their spacecraft.",
      },
    ],
  },
  {
    id: "incline_friction",
    category: "physics",
    icon: Triangle,
    title: "Incline Plane — Newton's Laws & Friction",
    blurb: "Resolving weight on a ramp, and the moment static friction runs out",
    syllabus: "Physics 1.5 · Forces & Motion",
    keywords:
      "inclined plane ramp friction static kinetic coefficient mu normal force resolving components mg sin theta mg cos theta free body diagram newton second law angle of repose limiting friction net force acceleration slope",
    defaults: {
      rampAngle: 20,
      surface: "wood",
      blockMass: 10,
      appliedForce: 0,
      showComponents: true,
      showNet: true,
      removeLabels: false,
      running: true,
      reset: 0,
      speed: 1,
    },
    controls: [
      { type: "slider", key: "rampAngle", label: "Ramp angle θ", min: 0, max: 90, step: 1, format: (v) => `${v}°` },
      { type: "choice", key: "surface", label: "Surface material", columns: 3, options: FRICTION_SURFACE_OPTIONS },
      { type: "slider", key: "blockMass", label: "Block mass m", min: 1, max: 50, step: 1, format: (v) => `${v} kg` },
      {
        type: "slider",
        key: "appliedForce",
        label: "External applied pull",
        min: -500,
        max: 500,
        step: 5,
        format: (v) => (v === 0 ? "none" : v > 0 ? `${v} N up the ramp` : `${-v} N down the ramp`),
      },
      { type: "toggle", key: "showComponents", label: "Resolve weight into components" },
      { type: "toggle", key: "showNet", label: "Show resultant force" },
      { type: "toggle", key: "removeLabels", label: "Remove labels" },
      { type: "toggle", key: "running", label: "Let the block move" },
      { type: "action", key: "reset", label: "Put the block back", icon: RotateCcw },
    ],
    concepts: [
      "Weight always points straight down, but on a slope it is easier to handle as two pieces: mg sinθ down the surface and mg cosθ pressing into it. Steepen the ramp and the first grows while the second shrinks — a steeper slope pulls harder AND grips less, which is why the effect runs away with itself.",
      "Static friction is not a fixed force. It takes whatever value is needed to hold the block still, up to a ceiling of μs·N — so f ≤ μs·N is an inequality, not an equation. Quoting μs·N for a block that is sitting still is the single most common mistake in this topic.",
      "The angle at which an unhelped block lets go obeys tanθ = μs, and the mass cancels out entirely: doubling the mass doubles the pull down the slope and doubles the grip holding it. A grain of sand and a shipping container slip at the same angle.",
    ],
    quiz: [
      {
        question:
          "A 10 kg crate rests, motionless, on a ramp tilted at 15°. The surfaces have μs = 0.50. What is the friction force acting on the crate?",
        options: [
          "About 25 N — exactly enough to balance mg sin 15°",
          "About 47 N — the maximum, μs mg cos 15°",
          "About 98 N — equal to the crate's weight",
          "Zero, because the crate is not moving",
        ],
        answer: 0,
        explanation:
          "Static friction is a reaction: it supplies exactly what is needed and no more. The crate is in equilibrium, so friction must equal the component of weight down the slope, mg sin 15° ≈ 25 N. The 47 N figure is the ceiling it has not yet reached — the crate is using about half its available grip.",
      },
      {
        question:
          "A block just begins to slide when a ramp reaches 27°. You replace it with a block of twice the mass. At what angle does the heavier block begin to slide?",
        options: [
          "The same 27°",
          "About 13.5°, because it is heavier",
          "About 54°, because it presses down harder",
          "It depends on the surface area in contact",
        ],
        answer: 0,
        explanation:
          "Slipping starts when mg sinθ exceeds μs mg cosθ, and the mass appears on both sides. Cancel it and the condition is just tanθ = μs — independent of mass, and of contact area too. Doubling the mass doubles the pull down the slope and doubles the grip in exactly the same proportion.",
      },
      {
        question:
          "For most surfaces μk is smaller than μs. What does a student actually SEE because of that?",
        options: [
          "The block lurches suddenly once it starts, instead of easing into motion",
          "The block slides at a perfectly constant speed",
          "The block needs a larger force to keep it going than to start it",
          "Nothing — the difference is only theoretical",
        ],
        answer: 0,
        explanation:
          "The instant the block breaks away, the friction opposing it drops from μs·N to the smaller μk·N. The forces no longer balance, so there is a sudden net force and the block jerks into motion. It is also why keeping something sliding takes less push than starting it.",
      },
    ],
  },
  {
    id: "hookes_law",
    category: "physics",
    icon: Weight,
    title: "Hooke's Law & the Elastic Limit",
    blurb: "Where F = kx stops being true, and what the spring is like afterwards",
    syllabus: "Physics 1.6 · Forces & Deformation",
    keywords:
      "hooke law spring constant extension elastic limit limit of proportionality plastic deformation permanent set force extension graph gradient elastic potential energy strain stress yield load slotted masses retort stand",
    defaults: {
      hangingMass: 0.5,
      springConstant: 80,
      overload: 0,
      newSpring: 0,
      showGraph: true,
      speed: 1,
    },
    controls: [
      {
        type: "slider",
        key: "hangingMass",
        label: "Add slotted masses",
        min: 0.05,
        max: 2.5,
        step: 0.05,
        format: (v) => (v < 1 ? `${(v * 1000).toFixed(0)} g` : `${v.toFixed(2)} kg`),
      },
      { type: "slider", key: "springConstant", label: "Spring constant k", min: 10, max: 150, step: 5, format: (v) => `${v} N/m` },
      { type: "toggle", key: "showGraph", label: "Show force–extension graph" },
      { type: "action", key: "overload", label: "Exceed the elastic limit", icon: TrendingDown, variant: "danger" },
      { type: "action", key: "newSpring", label: "Fit a fresh spring", icon: RotateCcw },
    ],
    concepts: [
      "F = kx is not a law about springs — it is a description of what a spring does BELOW a threshold. The gradient of the straight part of a force–extension graph is the spring constant k, and the graph only stays straight up to the limit of proportionality.",
      "Below the elastic limit the deformation is elastic: take the load off and the spring returns to its original length L₀. Past it, some of the deformation is plastic. Unloading runs back down a line of the same gradient k, but it arrives at a permanent set instead of at zero.",
      "The elastic potential energy stored is ½kx², which is the area under the straight line. Beyond the elastic limit that formula over-states what you get back, because part of the work went into permanently rearranging the metal and is never returned.",
    ],
    quiz: [
      {
        question:
          "A spring obeying Hooke's law stretches by 4.0 cm when a 2.0 N weight hangs from it. It is still elastic. What load produces an extension of 6.0 cm?",
        options: ["3.0 N", "4.0 N", "2.7 N", "6.0 N"],
        answer: 0,
        explanation:
          "Below the limit, extension is proportional to load, so 6.0 ÷ 4.0 = 1.5 times the extension needs 1.5 times the force: 3.0 N. In passing, k = F ÷ x = 2.0 ÷ 0.040 = 50 N/m, and 50 × 0.060 = 3.0 N.",
      },
      {
        question:
          "A spring is loaded well past its elastic limit, then every weight is taken off. What do you find?",
        options: [
          "It is permanently longer than it started, though it still springs when you pull it",
          "It returns exactly to its original length, just more slowly",
          "It has become permanently softer — its k is now smaller",
          "It snaps back past its original length and becomes shorter",
        ],
        answer: 0,
        explanation:
          "Unloading follows a line of the ORIGINAL gradient k, so the spring is just as stiff as before — but that line no longer passes through the origin. The offset is the permanent set: the spring has a new, longer natural length. Plastic flow moves where a spring starts from without changing how stiff it is.",
      },
      {
        question: "What does the gradient of a force–extension graph tell you, and what does the area under it tell you?",
        options: [
          "Gradient is the spring constant k; area is the elastic energy stored",
          "Gradient is the energy stored; area is the spring constant k",
          "Gradient is the extension; area is the force applied",
          "Gradient is the elastic limit; area is the permanent set",
        ],
        answer: 0,
        explanation:
          "Gradient = ΔF ÷ Δx, which is the definition of k. Area under a straight line from the origin = ½ × base × height = ½ × x × kx = ½kx², the elastic potential energy. Watching the gradient collapse past the elastic limit is how you see the spring stop obeying Hooke's law.",
      },
    ],
  },
  {
    id: "simple_machines",
    category: "physics",
    icon: Scale,
    title: "Simple Machines & Mechanical Advantage",
    blurb: "Levers and a block and tackle — less force, but never less work",
    syllabus: "Physics 1.7 · Work, Energy & Machines",
    keywords:
      "simple machines lever class 1 2 3 fulcrum effort load arm mechanical advantage velocity ratio distance ratio pulley block and tackle sheaves work input output efficiency wheelbarrow tweezers crowbar moment principle of moments",
    defaults: {
      machineType: "lever1",
      armPosition: 0.35,
      sheaves: 2,
      loadN: 300,
      running: true,
      speed: 1,
    },
    controls: [
      {
        type: "choice",
        key: "machineType",
        label: "Machine type",
        columns: 2,
        options: [
          { value: "lever1", label: "Class 1 lever", title: "load — fulcrum — effort · see-saw, crowbar" },
          { value: "lever2", label: "Class 2 lever", title: "fulcrum — load — effort · wheelbarrow" },
          { value: "lever3", label: "Class 3 lever", title: "fulcrum — effort — load · tweezers, forearm" },
          { value: "pulley", label: "Block & tackle", title: "n sheaves sharing the load between n ropes" },
        ],
      },
      {
        type: "slider",
        key: "armPosition",
        label: "Fulcrum position",
        min: 0.1,
        max: 0.9,
        step: 0.01,
        format: (v) => `${(v * 100).toFixed(0)}% along the bar`,
        when: (params) => (params?.machineType ?? "lever1") !== "pulley",
      },
      {
        type: "slider",
        key: "sheaves",
        label: "Sheaves in the tackle",
        min: 1,
        max: 4,
        step: 1,
        format: (v) => `${v} rope${v === 1 ? "" : "s"} supporting the load`,
        when: (params) => params?.machineType === "pulley",
      },
      { type: "slider", key: "loadN", label: "Load weight", min: 10, max: 500, step: 10, format: (v) => `${v} N` },
      { type: "toggle", key: "running", label: "Animate the stroke" },
    ],
    concepts: [
      "A machine changes the force you need, never the work you do. Work in = work out (plus whatever friction takes), so cutting the effort force to a third means moving your hand three times as far. That trade is the whole of what a simple machine is.",
      "The three classes of lever are defined by which of the three points is in the middle. Class 2 always has the effort arm longer, so its advantage is always above 1. Class 3 always has it shorter, so its advantage is always below 1 — your forearm gives up force to gain speed and reach.",
      "In a block and tackle the load is shared between the rope segments supporting it, so n ropes need one nth of the force — and n metres of rope hauled through for every metre the load rises. Adding sheaves keeps paying, but each one adds friction, so efficiency falls as the advantage grows.",
    ],
    quiz: [
      {
        question:
          "A pulley system lets you raise a 400 N crate using an effort of 100 N. Ignoring friction, how far must you pull the rope to raise the crate by 0.5 m?",
        options: ["2.0 m", "0.5 m", "0.125 m", "4.0 m"],
        answer: 0,
        explanation:
          "Work in must equal work out: 100 × d = 400 × 0.5 = 200 J, so d = 2.0 m. The force went down by a factor of four, so the distance goes up by the same factor of four — that is the trade, and no arrangement of pulleys escapes it.",
      },
      {
        question:
          "For a real machine, the distance ratio d_effort ÷ d_load and the force ratio F_load ÷ F_effort are not quite equal. What is the relationship between them?",
        options: [
          "The force ratio is smaller, and dividing it by the distance ratio gives the efficiency",
          "The force ratio is larger, because friction helps lift the load",
          "They are always exactly equal — any difference is measurement error",
          "The distance ratio changes with friction; the force ratio does not",
        ],
        answer: 0,
        explanation:
          "The distance ratio is fixed by the machine's geometry — friction cannot change the shape of a lever. But friction means some input work never reaches the load, so the effort force must be larger than the ideal, and the measured force ratio comes out smaller. Efficiency = MA ÷ VR is exactly that shortfall.",
      },
      {
        question:
          "Your forearm is a class 3 lever: the biceps attaches about 4 cm from the elbow, and you hold a load about 32 cm from it. What does this arrangement buy you?",
        options: [
          "Speed and range — your hand moves eight times as far as the muscle contracts",
          "Force — the muscle only needs an eighth of the load's weight",
          "Nothing; the body is simply badly designed",
          "Efficiency — no energy is wasted in a class 3 lever",
        ],
        answer: 0,
        explanation:
          "The effort arm is the shorter one, so the mechanical advantage is 4 ÷ 32 = 0.125 — the biceps must pull about eight times the load's weight. In exchange, a small, slow muscle contraction becomes a large, fast hand movement. For throwing and reaching, that is the better bargain.",
      },
    ],
  },
  {
    id: "roller_coaster_energy",
    category: "physics",
    icon: TrainFront,
    title: "Energy Conservation — Loop-the-Loop",
    blurb: "GPE into KE and back, and the least height that survives the loop",
    syllabus: "Physics 1.7 · Energy Stores & Transfers",
    keywords:
      "conservation of energy gravitational potential kinetic energy roller coaster loop the loop centripetal force minimum speed root gR g-force normal reaction thermal dissipation friction brakes mgh half mv squared energy transfer",
    defaults: {
      releaseHeight: 25,
      loopRadius: 8,
      cartMass: 500,
      friction: false,
      running: true,
      relaunch: 0,
      speed: 1,
    },
    controls: [
      { type: "slider", key: "releaseHeight", label: "Initial release height", min: 5, max: 50, step: 1, format: (v) => `${v} m` },
      { type: "slider", key: "loopRadius", label: "Loop radius R", min: 3, max: 15, step: 1, format: (v) => `${v} m · needs ${(2.5 * v).toFixed(1)} m of drop` },
      { type: "slider", key: "cartMass", label: "Cart mass", min: 200, max: 1000, step: 50, format: (v) => `${v} kg` },
      { type: "toggle", key: "friction", label: "Realistic steel-on-steel friction" },
      { type: "toggle", key: "running", label: "Run the cart" },
      { type: "action", key: "relaunch", label: "Send it round again", icon: RotateCcw },
    ],
    concepts: [
      "On a frictionless track GPE + KE never changes. Every metre of height the cart gives up buys exactly the same amount of kinetic energy, so mgh = ½mv² and the speed at any point depends only on how far it has descended — not on the shape of the track it took to get there.",
      "The cart's mass cancels out of that equation entirely. A full train and a single empty car released from the same height arrive at the bottom at the same speed, and need the same minimum height to survive the loop. The mass changes every energy in the budget and none of the conclusions.",
      "At the top of the loop gravity has to supply the centripetal force by itself, which needs v² ≥ gR. Working back through conservation gives a minimum release height of 2.5R. Below it the rail would have to pull the cart inward to hold it on, and a wheel on the inside of a rail cannot pull.",
    ],
    quiz: [
      {
        question:
          "A coaster has a vertical loop of radius 10 m. Ignoring friction, what is the lowest height the cart can be released from and still make it round?",
        options: ["25 m", "20 m", "10 m", "12.5 m"],
        answer: 0,
        explanation:
          "At the top of the loop the cart needs v² ≥ gR to stay on the rail. The top is at a height of 2R = 20 m, so conservation gives ½v² = g(h − 20), and v² = gR = 10g requires h − 20 ≥ 5, so h ≥ 25 m. The general result is h ≥ 2.5R, and the mass never enters it.",
      },
      {
        question:
          "Two identical carts are released from the same height on the same frictionless track, but one carries four passengers and the other is empty. Which is travelling faster at the bottom?",
        options: [
          "Neither — they arrive at exactly the same speed",
          "The heavier one, because it has more gravitational potential energy",
          "The lighter one, because it has less inertia to accelerate",
          "It depends on the shape of the drop",
        ],
        answer: 0,
        explanation:
          "mgh = ½mv² has m on both sides, so it cancels: v = √(2gh) regardless of mass. The loaded cart does start with more energy, but it also has proportionally more to move, and the two effects exactly balance. It is the same reason all objects fall at the same rate.",
      },
      {
        question:
          "With friction switched on, what happens to the total of GPE + KE + thermal energy as the cart runs?",
        options: [
          "It stays constant — friction moves energy into the thermal store, it does not destroy it",
          "It falls steadily, because friction removes energy from the system",
          "It rises, because the brakes add energy",
          "It stays constant only until the brakes engage",
        ],
        answer: 0,
        explanation:
          "Energy is conserved whether or not friction acts. What friction changes is where the energy is: it moves out of the mechanical stores and into thermal energy in the wheels, rails and air. That store is the one the cart cannot draw back on, which is why the ride ends — but the total never budges.",
      },
    ],
  },
  {
    id: "shadows",
    category: "physics",
    icon: Lightbulb,
    title: "Light, Shadows & Straight Lines",
    blurb: "A torch, a shape and a screen — why shadows have the size and sharpness they do",
    syllabus: "Physics · Primary Science · Light",
    keywords:
      "light shadow straight lines rectilinear propagation opaque translucent transparent umbra penumbra point source shadow size magnification torch screen silhouette blocking light primary school",
    ownHud: true,
    defaults: {},
    controls: [],
    concepts: [
      "Light only ever travels in straight lines. A shadow is simply the place a straight ray could not reach — which is why the shadow's outline is exactly the object's outline, stretched, and never bends around the sides.",
      "Move the torch closer to the object and the shadow grows; move the screen further back and it grows too. Both follow from one rule: the shadow is (torch→screen) ÷ (torch→object) times life size.",
      "What the object is made of decides how dark the shadow is. Opaque blocks every ray and gives a black shadow, translucent lets some through for a pale grey one, and transparent lets nearly all of them past so there is barely a shadow at all.",
    ],
    quiz: [
      {
        question:
          "A torch shines on a toy, casting a shadow on the wall behind it. You move the torch closer to the toy without moving anything else. What happens to the shadow?",
        options: [
          "It gets bigger",
          "It gets smaller",
          "It stays exactly the same size",
          "It disappears completely",
        ],
        answer: 0,
        explanation:
          "The rays leaving a nearby torch spread apart more steeply by the time they reach the wall, so the gap they leave is wider. The shadow is (torch→wall) ÷ (torch→toy) times life size, and moving the torch closer shrinks the bottom of that fraction — so the shadow grows.",
      },
      {
        question:
          "A sheet of frosted glass is held in the beam. What sort of shadow does it cast, and why?",
        options: [
          "A pale, faint shadow, because it lets some of the light straight through",
          "A completely black shadow, because it is solid",
          "No shadow at all, because glass is see-through",
          "A shadow with a bright spot in the middle",
        ],
        answer: 0,
        explanation:
          "Frosted glass is translucent: some light passes and some is blocked or scattered. Fewer rays reach the screen there than around it, so the patch is dimmer than its surroundings but nowhere near black.",
      },
    ],
  },
  {
    id: "circuits_breadboard",
    category: "physics",
    icon: CircuitBoard,
    title: "Series vs Parallel Circuits",
    blurb: "Unscrew one bulb and watch which circuit survives it",
    syllabus: "Physics 4.3 · Electric Circuits",
    keywords:
      "series parallel circuit equivalent resistance R1 + R2 reciprocal branch current ammeter voltmeter kirchhoff junction rule loop rule potential difference bulb filament brightness short circuit internal resistance drift velocity electrons breadboard ohm law V=IR",
    defaults: {
      topology: "series",
      voltage: 6,
      bulbR: 10,
      unscrewA: 0,
      shortCircuit: 0,
      running: true,
      speed: 1,
    },
    controls: [
      {
        type: "choice",
        key: "topology",
        label: "Circuit topology",
        columns: 3,
        options: CIRCUIT_TOPOLOGY_OPTIONS,
      },
      {
        type: "slider",
        key: "voltage",
        label: "Battery voltage",
        min: 1.5,
        max: 24,
        step: 0.5,
        format: (v) => `${Number(v).toFixed(1)} V`,
      },
      {
        type: "slider",
        key: "bulbR",
        label: "Bulb resistance",
        min: 2,
        max: 50,
        step: 1,
        format: (v) => `${v} Ω each`,
      },
      { type: "action", key: "unscrewA", label: "Unscrew / replace bulb A", icon: Unplug, variant: "ghost" },
      { type: "action", key: "shortCircuit", label: "Add / remove short circuit", icon: Zap, variant: "danger" },
      { type: "toggle", key: "running", label: "Animate the drift electrons" },
    ],
    concepts: [
      "A series circuit is one loop, so the same current passes through every component in it — and the resistances simply add, R_eq = R₁ + R₂. Because the two bulbs share the supply voltage between them, each gets half of it and runs at a quarter of the power a single bulb would. Break the loop anywhere and everything stops, because there is no longer any path back to the battery.",
      "In parallel each branch sits across the full supply, so each bulb gets the whole voltage and runs at full brightness, and the branch currents add up to the total. Adding a branch adds a path rather than an obstacle, so the equivalent resistance goes DOWN — 1/R_eq = 1/R₁ + 1/R₂ — and the battery has to deliver more current, not less. That is why house wiring is parallel and why a circuit can be overloaded.",
      "The electrons in the wire are not consumed. Watch the streams: every conductor carries the same spacing of carriers and only their speed changes, and at every junction the current arriving equals the current leaving. Charge is not used up by a bulb — energy is. That is the difference between current, which is the same on both sides of a lamp, and potential difference, which is not.",
    ],
    quiz: [
      {
        question:
          "Two identical 10 Ω bulbs are wired in series across a 12 V supply. One bulb is unscrewed. What happens, and why?",
        options: [
          "Both go out — removing the bulb breaks the single loop, so no current flows anywhere",
          "The other bulb gets brighter, because it now has all 12 V to itself",
          "The other bulb is unaffected — it has its own path to the battery",
          "The other bulb dims but stays lit, at half its previous brightness",
        ],
        answer: 0,
        explanation:
          "A series circuit has exactly one path. An unscrewed bulb is an infinite resistance in that path, so the current everywhere in the loop falls to zero and the remaining bulb goes dark too. The full supply voltage appears across the empty socket — which is why old fairy lights all failed together, and why a voltmeter across the gap reads 12 V while an ammeter reads nothing.",
      },
      {
        question:
          "The same two 10 Ω bulbs are re-wired in parallel across the same 12 V supply. Compared with the series arrangement, what happens to the total current drawn from the battery?",
        options: [
          "It rises by about four times, because R_eq falls from 20 Ω to 5 Ω",
          "It halves, because the current now splits between two branches",
          "It is unchanged — the same two bulbs are connected to the same battery",
          "It doubles, because there are two branches instead of one",
        ],
        answer: 0,
        explanation:
          "Series gives R_eq = 10 + 10 = 20 Ω. Parallel gives 1/R_eq = 1/10 + 1/10, so R_eq = 5 Ω — a quarter of the resistance, and therefore about four times the current. The trap is thinking that splitting the current between branches must reduce the total; each branch draws what it would have drawn alone, so the total is their sum.",
      },
      {
        question:
          "A wire of almost no resistance is connected directly across the two bulbs in a parallel circuit. What do the bulbs do, and what does the battery do?",
        options: [
          "The bulbs go out and the battery delivers a very large current through the wire",
          "The bulbs get much brighter, because the extra wire lets more current reach them",
          "Nothing changes — the wire is just another parallel branch",
          "The bulbs flicker, because the current alternates between paths",
        ],
        answer: 0,
        explanation:
          "The jumper is a parallel branch of about 0.01 Ω, so almost the entire current takes it and the voltage across the network — and therefore across the bulbs — collapses to nearly nothing. The current is limited only by the battery's own internal resistance, which is why a shorted cell gets hot: with almost no external resistance, the power is being dissipated inside the battery itself.",
      },
    ],
  },
  {
    id: "static_electricity",
    category: "physics",
    icon: CloudLightning,
    title: "Static Electricity & Charge Transfer",
    blurb: "Rub a balloon on wool and count the electrons that moved",
    syllabus: "Physics 4.2 · Electric Charge",
    keywords:
      "static electricity electrostatic charge friction triboelectric electron transfer positive negative attraction repulsion induction polarisation dipole neutral wall balloon wool coulomb law inverse square van de graaff earthing humidity charge leakage",
    defaults: {
      target: "wall",
      separation: 0.12,
      humidity: 40,
      rubs: 0,
      discharge: 0,
      vdg: false,
      speed: 1,
    },
    controls: [
      { type: "action", key: "rubs", label: "Rub the balloon on the sweater", icon: Sparkles },
      {
        type: "choice",
        key: "target",
        label: "Hold the balloon near",
        columns: 3,
        options: STATIC_TARGET_OPTIONS,
      },
      {
        type: "slider",
        key: "separation",
        label: "Position — gap to the object",
        min: 0.01,
        max: 0.4,
        step: 0.005,
        format: (v) => `${(Number(v) * 100).toFixed(1)} cm · or drag the balloon`,
      },
      {
        type: "slider",
        key: "humidity",
        label: "Air humidity",
        min: 10,
        max: 95,
        step: 1,
        format: (v) => `${v}% RH · charge half-life ${(0.693 * leakTimeConstant(v)).toFixed(1)} s`,
      },
      { type: "toggle", key: "vdg", label: "Run the Van de Graaff" },
      { type: "action", key: "discharge", label: "Earth everything", icon: Waves, variant: "ghost" },
    ],
    concepts: [
      "Rubbing does not create charge — it moves electrons. Wool holds its outer electrons loosely and latex grips them tightly, so every electron that crosses leaves a matching positive behind on the sweater. The two counts on screen are always equal and opposite, which is what conservation of charge means: the pair was there all along, and rubbing only separated them.",
      "A charged object attracts a NEUTRAL one. The balloon's field pulls the wall's electrons back and leaves the near surface positive, and since the attracted charge is closer than the repelled charge, attraction always wins. That is induction, and it is why a charged balloon picks up paper, bends a stream of water and sticks to a wall that has no charge of its own.",
      "Coulomb's law is an inverse square: F = k·q₁q₂/r². Halving the gap quadruples the force, which is why the balloon snaps in over the last centimetre. Damp air ends the demonstration by giving the charge a conducting film of water to leak away along — the physics has not changed, the charge has simply gone.",
    ],
    quiz: [
      {
        question:
          "After rubbing a balloon on a wool sweater, the balloon carries a negative charge. What is the sweater's charge, and why?",
        options: [
          "Equally positive — it lost exactly the electrons the balloon gained",
          "Also negative, because rubbing creates charge on both surfaces",
          "Neutral, because the charge all went onto the balloon",
          "Positive, but smaller, because some charge is lost to the air during rubbing",
        ],
        answer: 0,
        explanation:
          "Charge is conserved: rubbing separates existing charges rather than making new ones. Every electron the latex gained is one the wool no longer has, so the two objects carry equal and opposite charges. Nothing was created, and if you brought them back together they would neutralise exactly.",
      },
      {
        question:
          "A negatively charged balloon is held near a neutral wall and sticks to it. Why does a neutral object attract a charged one?",
        options: [
          "The wall polarises — positives are drawn to the near surface, and being closer, they win",
          "The wall must have been positively charged already",
          "The balloon's charge flows into the wall and pulls it along",
          "Neutral objects are always attracted to charged ones by gravity",
        ],
        answer: 0,
        explanation:
          "The balloon's field shifts charge within each molecule of the wall, leaving the near surface slightly positive and the far side slightly negative. The wall is still neutral overall, but the attracted positives sit closer than the repelled negatives, and because the force falls off as 1/r² the nearer charges dominate. Induction always produces attraction — never repulsion.",
      },
      {
        question:
          "Two balloons carrying the same charge repel each other with a force F when their centres are 20 cm apart. They are moved to 10 cm apart. What is the force now?",
        options: ["4F", "2F", "F/2", "F/4"],
        answer: 0,
        explanation:
          "Coulomb's law goes as 1/r², so halving the separation multiplies the force by 2² = 4. This is the same inverse square behaviour as gravity, and it is why electrostatic effects seem to switch on suddenly as objects get close — most of the force appears over the last short distance.",
      },
      {
        question:
          "The same demonstration works beautifully on a dry winter day and barely at all in a humid bathroom. What has changed?",
        options: [
          "A film of water on the surfaces conducts the charge away almost as fast as rubbing puts it there",
          "Water molecules block the electric field between the objects",
          "Humid air stops electrons being transferred by rubbing in the first place",
          "The balloon becomes heavier when damp, so the force cannot lift it",
        ],
        answer: 0,
        explanation:
          "Humid air is not itself much of a conductor. What happens is that a thin layer of water condenses on both surfaces and gives the separated charge a conducting path to creep away along. The transfer still occurs; the charge simply does not stay put long enough to demonstrate anything, which is why electrostatics experiments are a winter activity.",
      },
    ],
  },
  {
    id: "buoyancy",
    category: "physics",
    icon: Ship,
    title: "Archimedes' Principle, Density & Buoyant Force",
    blurb: "Why a steel ship floats and a steel pebble sinks",
    syllabus: "Physics 1.4 · Density & Pressure",
    keywords:
      "archimedes principle buoyancy upthrust buoyant force density relative density displacement displaced volume overflow can eureka floating sinking flotation apparent weight spring balance hull ship pebble mercury saltwater honey gasoline plimsoll line submarine iceberg",
    defaults: {
      objectDensity: 2.7,
      densityPreset: "aluminium",
      objectVolume: 200,
      fluid: "freshwater",
      solidShape: "cube",
      showForces: true,
      speed: 1,
    },
    controls: [
      {
        type: "choice",
        key: "densityPreset",
        label: "Material",
        columns: 5,
        options: SOLID_PRESET_OPTIONS,
        patch: (v) => ({ densityPreset: v, objectDensity: SOLIDS[v].density }),
      },
      {
        type: "slider",
        key: "objectDensity",
        label: "Object density ρ",
        min: MIN_DENSITY,
        max: MAX_DENSITY,
        step: 0.05,
        format: (v) => `${Number(v).toFixed(2)} g/cm³`,
        // Dragging off a preset has to clear the preset, or the highlighted
        // button goes on claiming the specimen is steel when it is not.
        patch: (v) => ({ objectDensity: v, densityPreset: solidPresetFor(v) }),
      },
      {
        type: "slider",
        key: "objectVolume",
        label: "Object volume V — of the material itself",
        min: 50,
        max: 500,
        step: 10,
        format: (v) => `${Number(v).toFixed(0)} cm³`,
      },
      {
        type: "choice",
        key: "fluid",
        label: "Fluid medium",
        columns: 3,
        options: FLUID_OPTIONS,
      },
      {
        type: "choice",
        key: "solidShape",
        label: "On the hook",
        columns: 4,
        options: SPECIMEN_SHAPE_OPTIONS,
      },
      { type: "toggle", key: "showForces", label: "Show force vectors" },
    ],
    concepts: [
      "The upthrust on anything in a fluid equals the weight of the fluid it pushes out of the way — that is Archimedes' principle, and the overflow can measures it directly. It is not a separate force that fluids happen to exert: pressure grows with depth, so the push upward on an object's underside is larger than the push downward on its top, and the difference is ρVg. That also settles the question students ask next — once an object is fully under, taking it deeper changes nothing, because both faces gain pressure equally and only the difference between them matters.",
      "Whether something floats has nothing to do with how heavy it is and everything to do with its density — mass divided by the volume of fluid it can push aside. A steel pebble and a steel ship are made of the same 7.85 g/cm³ metal, but the ship's hull encloses a great deal of air, so the mass of the whole vessel spread over the volume it displaces comes out below 1.00 g/cm³ and it floats. Punch a hole in that hull and the air is replaced by water: the mean density jumps back to steel's, and the ship goes down.",
      "A floating object sinks until it has displaced exactly its own weight of fluid, and no further — so the fraction submerged is simply ρ_object ÷ ρ_fluid. Ice at 0.92 g/cm³ floats with 92% of itself below the waterline in fresh water, which is why an iceberg is mostly invisible. Move to the sea at 1.03 and everything floats a little higher, because each cubic centimetre displaced is now worth 3% more upthrust.",
    ],
    quiz: [
      {
        question:
          "A solid steel pebble sinks, but a ship built from the same steel floats. What is the essential difference?",
        options: [
          "The ship's hull encloses air, so its mass ÷ displaced volume is below the water's density",
          "The ship is much heavier, and heavier objects displace more water",
          "The ship's paint and coatings stop water reaching the steel",
          "The ship's shape lets water flow around it instead of pressing down on it",
        ],
        answer: 0,
        explanation:
          "Floating is decided by mean density, not by material or by weight. The pebble's mass is spread over the volume of steel alone, so its mean density is 7.85 g/cm³ and it goes down. The hull spreads its mass over the whole volume of the vessel — steel plus the air inside — which brings the mean below 1.00 g/cm³. Being heavier is irrelevant: an object that weighs a thousand times more simply needs to displace a thousand times more water, and a large enough hull can do exactly that.",
      },
      {
        question:
          "A wooden block floats in fresh water with 60% of its volume below the surface. What is the block's density?",
        options: ["0.60 g/cm³", "1.60 g/cm³", "0.40 g/cm³", "It cannot be found without knowing the block's size"],
        answer: 0,
        explanation:
          "A floating object displaces exactly its own weight, so ρ_object·V·g = ρ_fluid·V_submerged·g. The volumes cancel down to a ratio: the fraction submerged IS ρ_object ÷ ρ_fluid. Sixty per cent under fresh water means 0.60 × 1.00 = 0.60 g/cm³. The size never enters it, which is why the same timber floats at the same waterline whether it is a matchstick or a log.",
      },
      {
        question:
          "A fully submerged metal cube hanging from a spring balance is lowered from 10 cm deep to 40 cm deep. What happens to the buoyant force on it?",
        options: [
          "It is unchanged — the same volume of water is displaced at both depths",
          "It quadruples, because the pressure at 40 cm is four times that at 10 cm",
          "It increases slightly, because deeper water is more compressed",
          "It falls, because there is more water above the cube pushing it down",
        ],
        answer: 0,
        explanation:
          "Upthrust is ρVg and depth appears nowhere in it. Both faces of the cube do feel much larger pressures at 40 cm, but the buoyant force comes from the DIFFERENCE between them, and that difference is set by the cube's own height, which has not changed. The balance reading is identical at both depths — the classic experiment that separates pressure, which grows with depth, from upthrust, which does not.",
      },
      {
        question:
          "An object weighs 5.00 N in air and 3.00 N when fully immersed in water. What volume of water has it displaced? (ρ_water = 1000 kg/m³, g = 9.81 m/s²)",
        options: ["About 204 cm³", "About 306 cm³", "About 510 cm³", "About 20 cm³"],
        answer: 0,
        explanation:
          "The apparent loss in weight IS the upthrust: 5.00 − 3.00 = 2.00 N. Archimedes' principle says that is the weight of the displaced water, so its mass is 2.00 ÷ 9.81 = 0.204 kg, and at 1000 kg/m³ that is 2.04 × 10⁻⁴ m³, or 204 cm³. Because the object was fully immersed, that is also the object's own volume — which is precisely how the density of an awkwardly shaped object is measured in the lab.",
      },
    ],
  },
  {
    id: "heat_transfer",
    category: "physics",
    icon: ThermometerSun,
    title: "Thermal Heat Transfer — Conduction, Convection & Radiation",
    blurb: "One bench, three ways for heat to move, all running at once",
    syllabus: "Physics 2.3 · Thermal Energy Transfer",
    keywords:
      "conduction convection radiation thermal conductivity heat transfer copper iron glass wood insulator conductor free electrons lattice vibration convection current density difference potassium permanganate dye tracer bunsen burner beaker infrared electromagnetic wave emission absorption black surface stefan boltzmann vacuum flask thermal imaging FLIR",
    defaults: {
      flameIntensity: 55,
      rodMaterial: "copper",
      viewMode: "flir",
      dyeDrop: 0,
      speed: 1,
    },
    controls: [
      {
        type: "slider",
        key: "flameIntensity",
        label: "Flame intensity",
        min: 0,
        max: 100,
        step: 1,
        format: (v) =>
          flameIsLit(v) ? `${Number(v).toFixed(0)}% · ${flameTemperature(v).toFixed(0)} °C` : "out",
      },
      {
        type: "choice",
        key: "rodMaterial",
        label: "Rod material — the one being probed",
        columns: 4,
        options: ROD_MATERIAL_OPTIONS,
      },
      {
        type: "choice",
        key: "viewMode",
        label: "View mode",
        columns: 2,
        options: HEAT_VIEW_OPTIONS,
      },
      { type: "action", key: "dyeDrop", label: "Drop a KMnO₄ crystal", icon: Droplets },
    ],
    concepts: [
      "Conduction passes energy along without anything travelling: a hot particle vibrates harder, jostles its neighbour, and the disturbance moves through a lattice that stays exactly where it is. Metals do it far better than anything else because they have free electrons as well, which drift through the whole structure carrying energy with them — copper's k of 385 W/m·K against wood's 0.15 is a factor of two and a half thousand. That is why the copper rod's far end becomes too hot to hold while the wooden one beside it, in the same beaker for the same time, never leaves room temperature.",
      "Convection needs the material itself to move, so it happens only in fluids. Water at the bottom of the beaker is heated, expands, becomes less dense than the water above it, and is pushed up by that colder water sinking to take its place — the dye traces the resulting loop. This is also why kettles and radiators are heated from below: heat the top of a beaker and the warm, less dense layer simply stays where it is, and the water underneath can sit near room temperature indefinitely.",
      "Radiation is electromagnetic wave — infrared, mostly — and it is the only mode that needs no material at all, which is how the Sun's energy crosses 150 million kilometres of vacuum. Emission follows the Stefan–Boltzmann law and goes as the FOURTH power of absolute temperature, so a flame at 1500 °C radiates roughly ninety times as strongly as the same flame at 300 °C. Dull black surfaces are the best emitters and the best absorbers, which is why the plate in this scene is blackened and why a vacuum flask is silvered.",
    ],
    quiz: [
      {
        question:
          "Copper and glass rods of identical size are left in the same beaker of hot water. After a minute the copper's far end is hot and the glass's is still cold. Why?",
        options: [
          "Copper has free electrons that carry energy through it as well as passing it between vibrating atoms",
          "Copper absorbs more heat from the water because metals are better absorbers",
          "The glass rod is reflecting the heat back into the water",
          "Copper has a lower specific heat capacity, so the same energy raises its temperature further",
        ],
        answer: 0,
        explanation:
          "Both rods conduct by the same lattice mechanism — vibrating particles jostling their neighbours — but a metal has a second channel that an insulator does not: a sea of delocalised electrons free to move through the whole structure, carrying kinetic energy from the hot end to the cold one directly. That is the difference between k = 385 and k = 0.8. Specific heat capacity affects how quickly a rod warms, not how far along it the heat gets, and at the steady state the glass rod's far end is simply losing to the air everything the glass manages to deliver.",
      },
      {
        question:
          "Why is a beaker of water heated from underneath rather than from the top?",
        options: [
          "Heating the bottom makes the warm water rise and sets up a convection current that stirs the whole beaker",
          "The glass at the bottom of a beaker is thinner, so heat gets in faster",
          "Heat naturally travels upward, so heating the top would send it out of the beaker",
          "Water conducts heat well downward but poorly upward",
        ],
        answer: 0,
        explanation:
          "Water heated at the bottom expands, becomes less dense than the water above it and is displaced upward by colder water sinking past it — the loop carries the heat through the whole beaker in seconds. Heat the top instead and the warm layer is already the least dense, so it stays put, no current forms, and you are left with conduction alone through water that conducts about as well as glass. The classic demonstration is a test tube of water boiled at the top while ice sits unmelted at the bottom.",
      },
      {
        question:
          "The blackened plate in this scene warms up although nothing touches it and it sits to the side of the rising hot air. Which mode is responsible, and what rules the others out?",
        options: [
          "Radiation — conduction needs contact and convection needs the air to carry heat to it, and the plate is neither touching nor downstream of the flame",
          "Conduction, through the layer of air between the flame and the plate",
          "Convection, because the hot air spreads out in all directions from the flame",
          "All three equally, since heat always travels by every mode at once",
        ],
        answer: 0,
        explanation:
          "Conduction requires a material path in contact, and the plate is mounted on its own stand with only still air in between — air being one of the poorest conductors there is. Convection carries heat with moving fluid, and the flame's hot gases rise straight up into the beaker rather than sideways to the plate. What is left is infrared radiation, which travels in straight lines from the flame, passes through air without warming it appreciably, and is absorbed by the black surface. Blocking the line of sight with a card stops it at once, which is the experiment that proves it.",
      },
      {
        question:
          "A hot object's absolute temperature is doubled. By what factor does the power it radiates increase?",
        options: ["16", "2", "4", "8"],
        answer: 0,
        explanation:
          "The Stefan–Boltzmann law gives P = εσAT⁴, so doubling T multiplies the radiated power by 2⁴ = 16. The fourth power is why radiation is almost negligible for warm objects and utterly dominant for hot ones: it is barely worth mentioning for a radiator at 60 °C, but it is how essentially all of a filament lamp's — and the Sun's — energy leaves. Note that T must be in kelvin, since the law is about absolute temperature; doubling a Celsius reading is not doubling T.",
      },
    ],
  },
  // ═══ Chemistry ═════════════════════════════════════════════════════
  {
    id: "bohr",
    category: "chemistry",
    icon: Atom,
    title: "3D Bohr Atom & Orbital Shells",
    blurb: "Electron shells of hydrogen, carbon, sodium and chlorine",
    syllabus: "Chemistry 2.1 · Atomic structure",
    keywords: "bohr atom electron shell configuration valence proton neutron isotope ion nucleus",
    defaults: {
      element: "Na",
      speed: 1,
      showShells: true,
      showLabels: true,
      highlightValence: true,
      spinNucleus: true,
    },
    controls: [
      {
        type: "choice",
        key: "element",
        label: "Element",
        options: [
          { value: "H", label: "H · 1" },
          { value: "C", label: "C · 6" },
          { value: "Na", label: "Na · 11" },
          { value: "Cl", label: "Cl · 17" },
        ],
      },
      // No "speed" slider here: the HUD renders a universal Animation Speed
      // slider bound to the same key, and two sliders on one parameter is one
      // too many. The universal one reaches 0 ("paused") too.
      { type: "toggle", key: "highlightValence", label: "Highlight valence shell" },
      { type: "toggle", key: "showShells", label: "Show shell paths" },
      { type: "toggle", key: "showLabels", label: "Show shell labels" },
      { type: "toggle", key: "spinNucleus", label: "Spin nucleus" },
    ],
    concepts: [
      "An atom is a tiny, dense nucleus of protons and neutrons surrounded by electrons in fixed shells (K, L, M …).",
      "For the first twenty elements the shells fill 2, then 8, then 8 — so sodium is 2,8,1 and chlorine is 2,8,7.",
      "The outer shell holds the valence electrons, and reactions happen so atoms reach a full one: Na loses 1 to give Na⁺, Cl gains 1 to give Cl⁻.",
    ],
    quiz: [
      {
        question:
          "Chlorine has the electron configuration 2,8,7. What does it do to reach a full outer shell?",
        options: [
          "Gains 1 electron to form a Cl⁻ ion",
          "Loses 7 electrons to form a Cl⁷⁺ ion",
          "Gains 8 electrons to form a Cl⁸⁻ ion",
          "Nothing — 7 electrons already fills the M shell",
        ],
        answer: 0,
        explanation:
          "Gaining one electron is far easier than losing seven. Cl⁻ is 2,8,8 — which is why chlorine sits in Group 7 and forms ionic compounds like NaCl.",
      },
      {
        question: "What is the maximum number of electrons the second shell (L) can hold?",
        options: ["2", "8", "18", "32"],
        answer: 1,
        explanation:
          "The L shell holds 2n² = 2 × 2² = 8. The K shell below holds only 2, which is why carbon (6 electrons) is written 2,4.",
      },
    ],
  },
  {
    id: "organic",
    category: "chemistry",
    icon: Hexagon,
    title: "Organic Chemistry & Isomer Builder",
    blurb: "Ball-and-stick alkanes, alkenes, alkynes, alcohols, carboxylic acids & esters",
    syllabus: "Chemistry 14 · Organic chemistry",
    keywords: "organic alkane alkene alkyne alcohol acid ester homologous series cracking saturated unsaturated bromine ethanol methane carboxylic ester",
    defaults: { family: "alkane", carbons: 3, crack: 0, spin: true },
    controls: [
      {
        type: "choice",
        key: "family",
        label: "Homologous series",
        columns: 3,
        options: [
          { value: "alkane",  label: "Alkane" },
          { value: "alkene",  label: "Alkene" },
          { value: "alkyne",  label: "Alkyne" },
          { value: "alcohol", label: "Alcohol" },
          { value: "acid",    label: "Carboxylic Acid" },
          { value: "ester",   label: "Ester" },
        ],
      },
      { type: "slider", key: "carbons", label: "Carbon chain length", min: 1, max: 12, step: 1, format: (v) => `C${v}` },
      { type: "toggle", key: "spin", label: "Rotate molecule" },
      { type: "action", key: "crack", label: "Trigger cracking", icon: Scissors },
    ],
    concepts: [
      "Alkanes (CₙH₂ₙ₊₂) are saturated — only single C–C bonds. Alkenes (CₙH₂ₙ) are unsaturated and contain a C=C double bond.",
      "Members of a homologous series share a general formula and differ by CH₂, so their properties change gradually down the series.",
      "Cracking breaks long alkanes into a shorter alkane plus a useful alkene, matching supply to demand for petrol and polymer feedstock.",
    ],
    quiz: [
      {
        question: "What is the general formula of the alkenes?",
        options: ["CₙH₂ₙ₊₂", "CₙH₂ₙ", "CₙH₂ₙ₋₂", "CₙH₂ₙ₊₁OH"],
        answer: 1,
        explanation:
          "The C=C double bond uses two bonds between the same pair of carbons, so an alkene carries two fewer hydrogens than the matching alkane — CₙH₂ₙ.",
      },
      {
        question: "Which test distinguishes an alkene from an alkane?",
        options: [
          "Bromine water is decolourised by the alkene",
          "Limewater turns milky with the alkene",
          "The alkene turns damp litmus paper red",
          "Only the alkane burns in air",
        ],
        answer: 0,
        explanation:
          "Bromine adds across the C=C double bond, so orange bromine water goes colourless. A saturated alkane leaves it orange. Both burn in air.",
      },
    ],
  },
  {
    id: "distillation",
    category: "chemistry",
    icon: FlaskConical,
    title: "Fractional Distillation Column",
    blurb: "Separating crude oil by boiling point",
    syllabus: "Chemistry 14.2 · Fuels",
    keywords: "crude oil fractional distillation fraction petrol kerosene diesel bitumen boiling point hydrocarbon refinery",
    defaults: { heat: 0.7, showLabels: true, flow: true },
    controls: [
      { type: "slider", key: "heat", label: "Furnace heat", min: 0.15, max: 1, step: 0.01, format: (v) => `${Math.round(250 + v * 200)}°C` },
      { type: "toggle", key: "showLabels", label: "Show fraction labels" },
      { type: "toggle", key: "flow", label: "Animate vapour" },
    ],
    concepts: [
      "Crude oil is a mixture of hydrocarbons separated by boiling point — a physical process, not a chemical reaction.",
      "The column is hottest at the bottom and coolest at the top; each fraction condenses where the temperature falls to its boiling range.",
      "Short chains have weaker forces between molecules, so they boil at low temperatures and rise highest; long chains like bitumen stay at the bottom.",
    ],
    quiz: [
      {
        question: "Which fraction is collected nearest the top of the column?",
        options: ["Bitumen", "Diesel oil", "Refinery gases", "Kerosene"],
        answer: 2,
        explanation:
          "The top of the column is coolest, so only the fractions with the lowest boiling points — the shortest chains, the refinery gases — still reach it as vapour.",
      },
      {
        question: "Why do longer hydrocarbon molecules have higher boiling points?",
        options: [
          "They have stronger forces of attraction between molecules",
          "Their covalent bonds are stronger",
          "They contain more hydrogen per carbon",
          "They are less dense",
        ],
        answer: 0,
        explanation:
          "Boiling separates whole molecules, so it is the intermolecular forces that matter. Bigger molecules attract each other more strongly, so more energy is needed.",
      },
    ],
  },
  {
    id: "lattice",
    category: "chemistry",
    icon: Boxes,
    title: "Crystal Lattices",
    blurb: "NaCl ionic cube, diamond network, graphite sheets, quartz and ice",
    syllabus: "Chemistry 3 · Structure & bonding",
    keywords: "lattice giant ionic covalent nacl sodium chloride diamond graphite allotrope delocalised conductivity quartz silica ice hydrogen bond",
    defaults: { structure: "nacl", slide: 0, showBonds: true, spin: true },
    controls: [
      {
        type: "choice",
        key: "structure",
        label: "Structure",
        columns: 3,
        options: [
          { value: "nacl", label: "NaCl" },
          { value: "diamond", label: "Diamond" },
          { value: "graphite", label: "Graphite" },
          { value: "quartz", label: "Quartz (SiO₂)" },
          { value: "ice", label: "Ice (H₂O)" },
        ],
      },
      { type: "slider", key: "slide", label: "Layer slide (graphite)", min: 0, max: 1, step: 0.01, format: (v) => `${Math.round(v * 100)}%` },
      { type: "toggle", key: "showBonds", label: "Show bonds" },
      { type: "toggle", key: "spin", label: "Rotate lattice" },
    ],
    concepts: [
      "In sodium chloride, Na⁺ and Cl⁻ alternate in a giant ionic lattice held by strong attraction in every direction — high melting point, conducts only when molten or aqueous.",
      "Diamond is a giant covalent lattice where every carbon bonds to four others tetrahedrally, so it is extremely hard and does not conduct.",
      "Graphite bonds each carbon to only three others in flat hexagonal layers; the spare electron is delocalised (so it conducts) and weak forces between layers let them slide.",
    ],
    quiz: [
      {
        question: "Why does graphite conduct electricity but diamond does not?",
        options: [
          "Graphite has one delocalised electron per carbon; diamond uses all four outer electrons in bonds",
          "Graphite contains metal ions",
          "Diamond's bonds are ionic rather than covalent",
          "Graphite is a liquid at room temperature",
        ],
        answer: 0,
        explanation:
          "Each carbon in graphite forms only three covalent bonds, leaving one electron free to move through the layers. In diamond all four outer electrons are locked into bonds.",
      },
      {
        question: "Why does solid sodium chloride not conduct electricity, while molten NaCl does?",
        options: [
          "The ions are fixed in the lattice until it melts",
          "Solid NaCl contains no charged particles",
          "The solid has no delocalised electrons but the liquid does",
          "Melting turns the ionic bonds into covalent ones",
        ],
        answer: 0,
        explanation:
          "Conduction needs charge carriers that can move. The ions exist in the solid but are locked in place; melting frees them to migrate to the electrodes.",
      },
    ],
  },
  {
    id: "electrolysis",
    category: "chemistry",
    icon: BatteryCharging,
    title: "Electrolysis Cell",
    blurb: "Cu²⁺ and SO₄²⁻ migrating to the electrodes",
    syllabus: "Chemistry 5 · Electrochemistry",
    keywords: "electrolysis anode cathode cation anion electroplating copper sulfate oxidation reduction electrode",
    defaults: { current: 1, showLabels: true, run: true, reset: 0 },
    controls: [
      { type: "slider", key: "current", label: "Current", min: 0.2, max: 2, step: 0.1, format: (v) => `${v.toFixed(1)} A` },
      { type: "toggle", key: "run", label: "Supply on" },
      { type: "toggle", key: "showLabels", label: "Show half-equations" },
      { type: "action", key: "reset", label: "Reset deposit", icon: RotateCcw, variant: "ghost" },
    ],
    concepts: [
      "Electrolysis splits an ionic compound using electricity, and only works when the ions are free to move — molten or in solution.",
      "Positive ions (cations, e.g. Cu²⁺) move to the negative cathode and gain electrons — reduction. Negative ions move to the positive anode and lose electrons — oxidation.",
      "With copper(II) sulfate and copper electrodes, copper dissolves from the anode and plates onto the cathode — the basis of electroplating and copper purification.",
    ],
    quiz: [
      {
        question: "During the electrolysis of copper(II) sulfate solution, where do the Cu²⁺ ions travel?",
        options: [
          "To the cathode, which is negative",
          "To the anode, which is positive",
          "They stay in the middle of the solution",
          "To whichever electrode is closest",
        ],
        answer: 0,
        explanation:
          "Cu²⁺ is positive, so it is attracted to the negative electrode — the cathode — where it gains two electrons and is reduced to copper metal.",
      },
      {
        question: "What kind of reaction happens at the anode in any electrolysis?",
        options: [
          "Oxidation — the ions lose electrons",
          "Reduction — the ions gain electrons",
          "Neutralisation",
          "Thermal decomposition",
        ],
        answer: 0,
        explanation:
          "The anode is positive, so it attracts anions and pulls electrons from them. Loss of electrons is oxidation — remember OIL RIG.",
      },
    ],
  },

  {
    id: "vsepr",
    category: "chemistry",
    icon: Shapes,
    title: "VSEPR & Molecular Shape",
    blurb: "Counting electron pairs to predict the shape and the bond angles",
    syllabus: "Chemistry 2.3 · Bonding",
    keywords:
      "vsepr molecular geometry shape bond angle lone pair bonding pair tetrahedral trigonal planar pyramidal bent linear octahedral seesaw t-shaped square planar polarity dipole methane ammonia water",
    defaults: {
      preset: "CH4",
      bonding: 4,
      lone: 0,
      bondLength: 1.9,
      showLonePairs: true,
      showAngles: true,
      spin: true,
    },
    controls: [
      {
        type: "choice",
        key: "preset",
        label: "Common molecules",
        columns: 3,
        options: VSEPR_PRESETS,
        // Picking a molecule writes both pair counts at once; nudging either
        // slider afterwards simply leaves no preset selected.
        patch: (v) => {
          const preset = VSEPR_PRESETS.find((p) => p.value === v);
          return preset ? { preset: v, bonding: preset.bonding, lone: preset.lone } : { preset: v };
        },
      },
      {
        type: "slider",
        key: "bonding",
        label: "Bonding pairs (X)",
        min: 1,
        max: 6,
        step: 1,
        patch: (v, params) => ({ bonding: v, lone: Math.min(params.lone ?? 0, 6 - v), preset: vseprPresetFor(v, Math.min(params.lone ?? 0, 6 - v)) }),
      },
      {
        type: "slider",
        key: "lone",
        label: "Lone pairs (E)",
        min: 0,
        max: 3,
        step: 1,
        patch: (v, params) => ({ lone: v, bonding: Math.min(params.bonding ?? 4, 6 - v), preset: vseprPresetFor(Math.min(params.bonding ?? 4, 6 - v), v) }),
      },
      { type: "slider", key: "bondLength", label: "Bond length", min: 1.4, max: 2.6, step: 0.05, format: (v) => v.toFixed(2) },
      { type: "toggle", key: "showLonePairs", label: "Show lone pairs" },
      { type: "toggle", key: "showAngles", label: "Show bond angle" },
      { type: "toggle", key: "spin", label: "Orbit camera" },
    ],
    concepts: [
      "Electron pairs all repel each other, so they arrange themselves as far apart as possible around the central atom. Count the pairs and the electron geometry follows: 2 linear, 3 trigonal planar, 4 tetrahedral, 5 trigonal bipyramidal, 6 octahedral.",
      "A lone pair is held closer to the nucleus than a bonding pair, so it takes up more room and repels harder. Each one squeezes the remaining bond angles by roughly 2–3° — which is why methane is 109.5°, ammonia 107° and water 104.5°.",
      "The shape is named only from where the atoms sit, never the lone pairs. Four electron pairs give a tetrahedral arrangement, but with two lone pairs the molecule is called bent, not tetrahedral.",
    ],
    quiz: [
      {
        question:
          "Ammonia (NH₃) and methane (CH₄) both have four electron pairs around the central atom, yet their bond angles are 107° and 109.5°. Why is ammonia's smaller?",
        options: [
          "Its lone pair repels the bonding pairs more strongly than they repel each other",
          "Nitrogen is smaller than carbon, so the bonds are shorter",
          "Ammonia has only three bonds, so they spread out less",
          "Nitrogen is more electronegative, which pulls the bonds together",
        ],
        answer: 0,
        explanation:
          "A lone pair is attracted to only one nucleus instead of two, so it sits closer in and occupies a wider region. That extra repulsion pushes the three N–H bonds together, closing the angle from the ideal 109.5° to about 107°.",
      },
      {
        question: "A molecule has 4 bonding pairs and 2 lone pairs around its central atom. What is its shape?",
        options: ["Square planar", "Octahedral", "Tetrahedral", "Seesaw"],
        answer: 0,
        explanation:
          "Six electron pairs give an octahedral arrangement. The two lone pairs take opposite (trans) positions to get as far from each other as possible, leaving the four bonded atoms in one plane — square planar, as in XeF₄.",
      },
    ],
  },
  {
    id: "energetics",
    category: "chemistry",
    icon: Flame,
    title: "Reaction Energy Profiles & Catalysis",
    blurb: "Activation energy, ΔH, and what a catalyst actually changes",
    syllabus: "Chemistry 4.1 · Energetics",
    keywords:
      "energy profile activation energy enthalpy exothermic endothermic catalyst transition state reaction coordinate collision theory boltzmann arrhenius rate delta h bond breaking making",
    defaults: {
      activation: 90,
      deltaH: -60,
      catalyst: false,
      catalystDrop: 35,
      temperature: 350,
      // B33: `showReverse: true` lived here with no control, no reader and no
      // effect -- it was meant to toggle a reverse-activation arrow that was
      // never built, and it read as a working feature. The reverse Ea itself
      // is real and is shown: solveEnergetics() derives it and the Details
      // panel prints it.
      spin: false,
    },
    controls: [
      { type: "slider", key: "activation", label: "Activation energy Ea", min: 20, max: 160, step: 5, format: (v) => `${v} kJ/mol` },
      { type: "slider", key: "deltaH", label: "Enthalpy change ΔH", min: -120, max: 120, step: 5, format: (v) => `${v > 0 ? "+" : ""}${v} kJ/mol` },
      { type: "slider", key: "temperature", label: "Temperature", min: 250, max: 800, step: 10, format: (v) => `${v} K` },
      { type: "toggle", key: "catalyst", label: "Add a catalyst" },
      { type: "slider", key: "catalystDrop", label: "Catalyst lowers Ea by", min: 10, max: 70, step: 5, format: (v) => `${v} kJ/mol` },
      { type: "toggle", key: "spin", label: "Orbit camera" },
    ],
    concepts: [
      "Activation energy is the barrier every colliding pair must clear to reach the transition state. Only the small fraction of collisions carrying at least Ea can react, which is why most collisions achieve nothing at all.",
      "ΔH is the difference between the reactant and product levels, and it is set by bonds alone: exothermic when making the new bonds releases more than breaking the old ones absorbed, endothermic when it does not.",
      "A catalyst provides an alternative route with a lower barrier, so a far larger fraction of collisions succeeds and the rate rises sharply. It cannot change ΔH — the reactants and products sit where they always did.",
    ],
    quiz: [
      {
        question: "Adding a catalyst to an exothermic reaction changes which of the following?",
        options: [
          "The activation energy only",
          "Both the activation energy and ΔH",
          "ΔH only",
          "Neither — a catalyst only speeds up the collisions",
        ],
        answer: 0,
        explanation:
          "A catalyst opens a different pathway with a lower barrier, so more collisions have enough energy to react. The reactants and products are unchanged, so the energy difference between them — ΔH — is exactly the same as before.",
      },
      {
        question:
          "A reaction has a forward activation energy of 90 kJ/mol and ΔH of −60 kJ/mol. What is the activation energy of the reverse reaction?",
        options: ["150 kJ/mol", "30 kJ/mol", "60 kJ/mol", "90 kJ/mol"],
        answer: 0,
        explanation:
          "The products sit 60 kJ/mol below the reactants, and the peak is 90 kJ/mol above the reactants. Climbing back to that same peak from the product side therefore costs 90 + 60 = 150 kJ/mol — which is why exothermic reactions are hard to reverse.",
      },
    ],
  },
  {
    id: "reactivity_series",
    category: "chemistry",
    icon: Beaker,
    title: "Reactivity Series & Metal Displacement",
    blurb: "One metal, four solutions — which ions does it push out?",
    syllabus: "Chemistry 10.2 · Reactivity Series · grades 8–10",
    keywords:
      "reactivity series displacement reaction single displacement metal potassium magnesium zinc iron copper silver gold copper sulfate iron sulfate silver nitrate magnesium sulfate oxidation reduction redox half equation electron transfer electrode potential silver tree",
    defaults: {
      metal: "Zn",
      solution: "cuso4",
      timeLapse: 10,
      dip: 0,
      speed: 1,
    },
    controls: [
      {
        type: "choice",
        key: "metal",
        label: "Metal strip — most reactive on the left",
        columns: 4,
        options: METAL_STRIP_OPTIONS,
      },
      {
        type: "choice",
        key: "solution",
        label: "Aqueous solution — the beaker in focus",
        columns: 4,
        options: AQUEOUS_SOLUTION_OPTIONS,
      },
      {
        type: "slider",
        key: "timeLapse",
        label: "Time-lapse speed",
        min: 1,
        max: 50,
        step: 1,
        format: (v) => `${Number(v).toFixed(0)}×`,
      },
      { type: "action", key: "dip", label: "Dip fresh strips", icon: RotateCcw, variant: "ghost" },
    ],
    concepts: [
      "The reactivity series ranks metals by how readily they give up electrons — potassium most readily, gold least — and a metal higher in the series will take the place of any metal lower down that is dissolved as ions: zinc pushes copper out of copper sulfate, but copper cannot push zinc out of zinc sulfate. Standard electrode potentials put a number on the ranking: the more negative E° is, the more readily the metal is oxidised, and the difference between two metals' potentials is the driving force. That is why magnesium (−2.37 V) coats itself in copper within a minute while iron (−0.44 V) takes ten in the same beaker.",
      "A displacement is two half-reactions at once, both happening at the surface of the strip. The strip's atoms are oxidised — Zn → Zn²⁺ + 2e⁻ — and the electrons travel through the metal to wherever an ion from the solution has arrived, which is reduced — Cu²⁺ + 2e⁻ → Cu — and plates out as a deposit. Nothing crosses the solution but ions: the electrons never leave the metal. The evidence is in the colours. Blue Cu²⁺ fades as it is used up, pale green Fe²⁺ appears as iron dissolves, and a strip of copper in colourless silver nitrate grows a silver 'tree' while the solution slowly turns blue.",
      "Some metals cannot be tested this way at all, and that is a result too. Potassium is so reactive that it reduces the water itself — 2K + 2H₂O → 2KOH + H₂, fizzing off hydrogen — long before it could displace anything; and no strip on the rack can displace Mg²⁺ from magnesium sulfate, because magnesium is above all of them except potassium. Gold, at the bottom, displaces nothing and is displaced by everything: the reason it is found in the ground as metal while iron is found as ore.",
    ],
    quiz: [
      {
        question:
          "A strip of zinc is placed in blue copper(II) sulfate solution. What is observed, and why?",
        options: [
          "The blue fades and a brown deposit grows on the zinc — zinc is above copper in the series, so it displaces Cu²⁺",
          "The zinc dissolves and the solution turns a deeper blue — zinc ions are blue",
          "Nothing happens — zinc and copper are both transition metals",
          "Bubbles of hydrogen form — zinc reacts with the water",
        ],
        answer: 0,
        explanation:
          "Zinc (E° = −0.76 V) loses electrons more readily than copper (+0.34 V), so zinc atoms are oxidised to Zn²⁺ and the electrons reduce Cu²⁺ ions to copper metal on the strip. The blue is the Cu²⁺; Zn²⁺ is colourless, so the solution fades as the copper plates out. Zinc does not react with cold water — that needs a metal as reactive as potassium.",
      },
      {
        question:
          "Copper is dipped into silver nitrate solution and, separately, into iron(II) sulfate solution. Which beaker reacts?",
        options: [
          "Only the silver nitrate — copper is above silver in the series but below iron",
          "Only the iron(II) sulfate — copper is a better conductor than iron",
          "Both — copper is a reactive metal",
          "Neither — copper is too unreactive to displace anything",
        ],
        answer: 0,
        explanation:
          "Copper sits between iron and silver in the series. It can give electrons to Ag⁺ (Cu + 2Ag⁺ → Cu²⁺ + 2Ag: silver crystals grow and the solution turns blue) but it cannot give them to Fe²⁺, because iron holds its electrons less tightly than copper does. Reactivity, not conductivity, decides displacement.",
      },
      {
        question:
          "Why does the simulation not show potassium displacing copper from copper sulfate, even though potassium is far above copper in the series?",
        options: [
          "Potassium is so reactive that it reacts with the water first, giving hydrogen and potassium hydroxide",
          "Potassium ions are too large to fit into the copper lattice",
          "Potassium is below copper in the series",
          "Copper sulfate is a covalent compound and has no ions to displace",
        ],
        answer: 0,
        explanation:
          "Metals above hydrogen in the series can reduce water, and the most reactive ones do so violently: 2K + 2H₂O → 2KOH + H₂. The water is present in enormous excess over the copper ions, so it takes the electrons first. That is why the classroom displacement grid stops at magnesium — the metals above it cannot be handled in aqueous solution at all.",
      },
      {
        question:
          "In the reaction Fe + CuSO₄ → FeSO₄ + Cu, which species is oxidised and which is reduced?",
        options: [
          "Iron is oxidised (Fe → Fe²⁺ + 2e⁻); copper ions are reduced (Cu²⁺ + 2e⁻ → Cu)",
          "Copper ions are oxidised; iron is reduced",
          "The sulfate ions are reduced; iron is oxidised",
          "Both iron and copper are oxidised, and sulfate is reduced",
        ],
        answer: 0,
        explanation:
          "OIL RIG: oxidation is loss of electrons, reduction is gain. Iron atoms lose two electrons each to become Fe²⁺, and each Cu²⁺ gains two to become copper metal. The sulfate ion is a spectator — it starts and ends as SO₄²⁻, which is why the ionic equation Fe + Cu²⁺ → Fe²⁺ + Cu leaves it out.",
      },
    ],
  },
  {
    id: "rusting_galvanic",
    category: "chemistry",
    icon: ShieldCheck,
    title: "Iron Rusting & Sacrificial Protection",
    blurb: "Four nails, four tubes — what rust needs, and how a second metal stops it",
    syllabus: "Chemistry 10.3 · Corrosion of Metals · grades 7–10",
    keywords:
      "rusting rust corrosion iron nail oxygen water hydrated iron(III) oxide boiled water paraffin oil desiccant calcium chloride sacrificial protection galvanising zinc magnesium copper cathodic protection anode cathode electron flow salt water electrolyte ship hull pipeline",
    defaults: {
      days: 7,
      electrolyte: "distilled",
      partner: "zinc",
      playing: false,
      speed: 1,
    },
    controls: [
      {
        type: "slider",
        key: "days",
        label: "Time-lapse",
        min: MIN_DAYS,
        max: MAX_DAYS,
        step: 1,
        format: (v) => dayLabel(v),
      },
      { type: "toggle", key: "playing", label: "Play the 30 days" },
      {
        type: "choice",
        key: "electrolyte",
        label: "Electrolyte additive — in every wet tube",
        columns: 2,
        options: ELECTROLYTE_OPTIONS,
      },
      {
        type: "choice",
        key: "partner",
        label: "Sacrificial metal — wrapped round nail 4",
        columns: 3,
        options: SACRIFICIAL_METAL_OPTIONS,
      },
    ],
    concepts: [
      "Rusting is the oxidation of iron to hydrated iron(III) oxide, Fe₂O₃·xH₂O, and it needs both water and oxygen at the same time: 4Fe + 3O₂ + 2xH₂O → 2Fe₂O₃·xH₂O. The three-tube experiment proves it by removing one at a time. Boiled water under a layer of oil has had its dissolved oxygen driven out and cannot take in any more, so the nail in it stays bright; a stoppered tube with a drying agent has oxygen but no water, and that nail stays bright too. Only the nail with both goes brown — worst of all at the waterline, where the two meet.",
      "Rusting is an electrochemical cell, which is why an electrolyte speeds it up so much. Iron is oxidised in one place — Fe → Fe²⁺ + 2e⁻ — and the electrons travel through the metal to where dissolved oxygen is reduced, O₂ + 2H₂O + 4e⁻ → 4OH⁻; the Fe²⁺ and OH⁻ meet in the water and the hydroxide oxidises to rust. Dissolved ions carry the charge between the two sites, so salt water, which conducts thousands of times better than pure water, lets the cell run several times faster. It is why cars rust in winter road salt and ships rust faster than bridges.",
      "Wrap the nail in a more reactive metal and the cell runs the other way. Zinc (E° = −0.76 V) or magnesium (−2.37 V) gives up its electrons more readily than iron (−0.44 V), so the wrap becomes the anode and corrodes while the iron, now the cathode, is fed electrons and cannot be oxidised — sacrificial protection, used on ship hulls, pipelines and every galvanised roof. Magnesium protects harder than zinc but is used up faster, because the driving force is larger. Wrap the nail in copper (+0.34 V) and iron is the more reactive of the pair: the nail becomes the anode for the copper and rusts faster than it would alone.",
    ],
    quiz: [
      {
        question:
          "A nail in boiled water sealed under a layer of oil does not rust, while an identical nail in ordinary water open to the air does. What does this show?",
        options: [
          "Rusting needs oxygen — boiling drove the dissolved oxygen out and the oil keeps the air away",
          "Rusting needs heat — the boiled water has cooled and can no longer rust the nail",
          "Oil is a rust inhibitor that coats the nail",
          "Rusting needs light, and the oil layer blocks it",
        ],
        answer: 0,
        explanation:
          "The water is still water, so the only thing missing in the sealed tube is dissolved oxygen. Boiling removes it and the oil stops the air from dissolving back in. With no oxygen there is nothing to reduce, so the iron is not oxidised. The oil never touches the nail; it is a lid, not a coating.",
      },
      {
        question:
          "An iron nail is wrapped in zinc ribbon and left in salt water for a month. What happens?",
        options: [
          "The zinc corrodes and the nail stays bright — zinc is more reactive, so it is oxidised instead of the iron",
          "The nail rusts faster — two metals always corrode each other",
          "Both metals corrode at the same rate, since they are in the same water",
          "Neither corrodes — the zinc insulates the nail from the water",
        ],
        answer: 0,
        explanation:
          "Zinc is above iron in the reactivity series (E° −0.76 V against −0.44 V), so when the two are in contact zinc gives up its electrons first. Those electrons flow into the iron and are used to reduce oxygen there, so the iron is never oxidised. The zinc wastes away — it is 'sacrificed' — and once it is gone the nail starts to rust. This is how galvanising works, and why it keeps protecting even when the zinc coat is scratched.",
      },
      {
        question:
          "Why does wrapping the nail in copper wire make it rust FASTER than a bare nail?",
        options: [
          "Copper is less reactive than iron, so the iron becomes the anode of the pair and is oxidised for both metals",
          "Copper conducts heat into the nail",
          "Copper reacts with the water to make an acid",
          "The copper wire scratches the nail's protective oxide layer",
        ],
        answer: 0,
        explanation:
          "In a galvanic pair, the more reactive metal corrodes. With copper (E° +0.34 V) touching iron (−0.44 V), iron is the more reactive, so it is the anode: its electrons flow into the copper, where oxygen is reduced over the copper's whole surface as well. That gives the iron a much larger cathode to feed, so it loses electrons faster than it would alone. It is the reason you must not fit copper pipes directly to steel ones without an insulating joint.",
      },
      {
        question:
          "Which direction do electrons flow in the tube where the nail is wrapped in magnesium?",
        options: [
          "From the magnesium into the iron",
          "From the iron into the magnesium",
          "Through the water from the iron to the oxygen",
          "They do not flow — magnesium stops the reaction",
        ],
        answer: 0,
        explanation:
          "Magnesium is the more reactive metal, so it is oxidised — Mg → Mg²⁺ + 2e⁻ — and its electrons pass through the metal-to-metal contact into the iron. The iron passes them on to oxygen at its surface (O₂ + 2H₂O + 4e⁻ → 4OH⁻). Electrons never travel through the water; ions do that. The iron is kept supplied with electrons the whole time, which is precisely what stops it losing its own.",
      },
    ],
  },
  {
    id: "separation_techniques",
    category: "chemistry",
    icon: Filter,
    title: "Separation Techniques Studio",
    blurb: "Filtration, crystallisation and chromatography — one sample, three benches, three properties",
    syllabus: "Chemistry 2.2 · Separation Techniques · grades 6–9",
    keywords:
      "separation techniques filtration filter paper funnel residue filtrate crystallisation crystallization evaporating basin saturated solution solubility boiling point chromatography paper chromatography rf retention factor solvent front baseline pigment dye mixture sand salt copper sulfate ethanol water particle size insoluble soluble",
    defaults: {
      station: "filtration",
      mixture: "sand_salt",
      solvent: "water",
      restart: 0,
      speed: 1,
    },
    controls: [
      {
        type: "choice",
        key: "station",
        label: "Station selector — which apparatus runs",
        columns: 3,
        options: SEPARATION_STATION_OPTIONS,
      },
      {
        type: "choice",
        key: "mixture",
        label: "Sample mixture",
        columns: 1,
        options: SAMPLE_MIXTURE_OPTIONS,
      },
      {
        type: "choice",
        key: "solvent",
        label: "Solvent type",
        columns: 2,
        options: SOLVENT_TYPE_OPTIONS,
      },
      { type: "action", key: "restart", label: "Restart this station", icon: RotateCcw, variant: "ghost" },
    ],
    concepts: [
      "Every separation technique works because the parts of a mixture differ in some physical property, and the technique is chosen to match the difference. Filtration exploits particle size: an insoluble solid such as sand has grains hundreds of micrometres across, far larger than the 11 µm pores of filter paper, so it is held back as the residue, while a dissolved solute is present as ions or molecules under a nanometre wide and runs straight through in the filtrate. Filtration therefore separates a solid from a liquid — it cannot separate a solute from its solvent, which is why filtering copper sulfate solution gives a blue filtrate and an empty paper.",
      "Crystallisation exploits solubility. A solvent can only hold so much solute per 100 mL, and usually more when hot than when cold. Evaporating the solvent concentrates the solution until it is saturated, and from then on every drop that leaves forces some solute out as crystals. Where the solubility curve is steep — copper sulfate holds 32 g at 20 °C but 114 g at the boil — the method is to heat only until the first crystals appear and then let it cool, so falling solubility does most of the work and the crystals grow large and well formed. Where the curve is flat, as for salt, cooling recovers almost nothing and the basin is taken to dryness. Substances that are not crystalline, such as food dyes, simply dry to a film.",
      "Paper chromatography exploits how strongly each component is attracted to the moving solvent compared with the paper. The solvent front climbs the paper by capillary action and each dissolved, coloured component is carried a fixed fraction of that distance — its retention factor, Rf = distance moved by the spot ÷ distance moved by the solvent, always between 0 and 1. Rf is a property of the substance in a given solvent, not of how long the paper was left, which is why it identifies things: a single pure substance gives one spot, a black marker ink gives three, and swapping water for ethanol changes every Rf because the balance between solvent and paper changes. A colourless solute travels too, but needs a locating agent before it can be seen — and the baseline is drawn in pencil because ink would run up the paper with the sample.",
    ],
    quiz: [
      {
        question:
          "A mixture of sand and salt water is poured through filter paper. What is found on the paper and what is in the flask?",
        options: [
          "Sand on the paper; salt solution in the flask — the sand grains are far larger than the pores, the dissolved salt is not",
          "Salt on the paper; sand in the flask — salt is denser than sand",
          "Both on the paper; pure water in the flask — filter paper removes everything but the solvent",
          "Nothing on the paper; everything in the flask — filter paper only removes bacteria",
        ],
        answer: 0,
        explanation:
          "Filter paper is a sieve with ~11 µm pores. Sand grains (hundreds of µm) cannot pass; sodium and chloride ions (under 1 nm) pass with the water. Filtration separates an insoluble solid from a liquid — the dissolved salt is not a particle the paper can see, so the filtrate is still salt water.",
      },
      {
        question:
          "Why is copper sulfate solution heated only until the first crystals appear, and then left to cool, rather than boiled dry?",
        options: [
          "Its solubility falls steeply as it cools (114 g → 32 g per 100 mL), so cooling brings most of it out as large, well-formed crystals",
          "Copper sulfate decomposes above 100 °C, so it must never boil",
          "Boiling dry would leave the crystals blue instead of white",
          "The first crystals are the purest and the rest must be thrown away",
        ],
        answer: 0,
        explanation:
          "A saturated hot solution holds far more copper sulfate than a cold one. Once the first crystals show, the solution is saturated at the boil; taking the flame away and letting the temperature fall drags the solubility down with it, and the excess comes out slowly as good crystals. Boiling dry works, but fuses everything into a crust and loses the water of crystallisation.",
      },
      {
        question:
          "On a chromatogram the solvent front moved 60 mm and a blue spot moved 23 mm. What is the Rf of the blue dye, and what would it be if the paper had been left twice as long?",
        options: [
          "Rf = 23 ÷ 60 ≈ 0.38, and it would still be 0.38 — Rf is a ratio that does not depend on time",
          "Rf = 60 ÷ 23 ≈ 2.6, and it would double",
          "Rf = 23 mm, and it would be 46 mm",
          "Rf = 0.38, and it would rise to 0.76 because the spot keeps moving",
        ],
        answer: 0,
        explanation:
          "Rf is the fraction of the solvent's journey the spot is carried along, so it is always between 0 and 1 and has no units. Both distances grow together as the run continues, so the ratio stays fixed — which is exactly why an Rf value can be used to identify a substance in a given solvent.",
      },
      {
        question:
          "Black marker ink gives three spots with water as the solvent but the same three spots in a different order with ethanol. What does this show?",
        options: [
          "The ink is a mixture of three dyes, and each dye's affinity for the solvent relative to the paper depends on which solvent is used",
          "Ethanol dissolves the paper, so the spots are in the wrong place",
          "The ink reacts with ethanol to make new dyes",
          "Water is a better solvent, so the ethanol result is wrong",
        ],
        answer: 0,
        explanation:
          "Three spots means three components. Rf reflects the balance between how much a dye likes the moving solvent and how much it clings to the paper; change the solvent and that balance changes for each dye differently — a dye that clings in water may be carried well by the less polar ethanol. Same substances, different Rf values, different order.",
      },
    ],
  },
  {
    id: "combustion_fire_triangle",
    category: "chemistry",
    icon: FlameKindling,
    title: "Combustion & the Fire Triangle",
    blurb: "Turn the collar, watch the flame change — then take away fuel, oxygen or heat",
    syllabus: "Chemistry 3.4 · Combustion · grades 6–9",
    keywords:
      "combustion fire triangle fuel oxygen heat bunsen burner air hole collar methane complete combustion incomplete combustion carbon monoxide soot carbon dioxide water blue flame yellow flame safety flame roaring flame inner cone ignition temperature extinguish bell jar smother water mist gas tap",
    defaults: {
      collar: 15,
      cutFuel: 0,
      bellJar: 0,
      waterMist: 0,
      holdBasin: 0,
      relight: 0,
      speed: 1,
    },
    controls: [
      {
        type: "slider",
        key: "collar",
        label: "Air collar rotation — closed (yellow) → fully open (blue)",
        min: COLLAR_MIN,
        max: COLLAR_MAX,
        step: 1,
        format: (v) => `${Number(v).toFixed(0)}% · ${collarLabel(v)}`,
      },
      { type: "action", key: "cutFuel", label: "Fire triangle · cut the fuel (gas tap off)", icon: Unplug, variant: "danger" },
      { type: "action", key: "bellJar", label: "Fire triangle · smother with a bell jar (starve O₂)", icon: Bell, variant: "danger" },
      { type: "action", key: "waterMist", label: "Fire triangle · spray water mist (remove heat)", icon: SprayCan, variant: "danger" },
      { type: "action", key: "holdBasin", label: "Hold a cold evaporating basin over the flame", icon: Flame, variant: "primary" },
      { type: "action", key: "relight", label: "Relight the burner & reset the apparatus", icon: RotateCcw, variant: "ghost" },
    ],
    concepts: [
      "A flame needs three things at once — a fuel, oxygen, and enough heat to keep the reaction going — and the fire triangle is the reminder that removing any one of them puts it out. Close the gas tap and there is nothing left to burn; lower a bell jar and the flame uses up the oxygen inside until the air is too lean (below about 16% O₂ a methane flame cannot survive); spray a fine water mist and the water's evaporation carries heat away faster than the flame can supply it, dropping the fuel–air mixture below its ignition temperature. Each interrupter targets one side, which is the basis of every method of firefighting: turning off the supply, smothering with a blanket or foam, and cooling with water.",
      "A Bunsen burner's air collar decides how completely the methane burns, because it decides how much oxygen is mixed with the gas BEFORE it reaches the flame. With the holes closed the gas only meets air at the edge of the flame, burns slowly and relatively cool (around 300 °C in the luminous tip), and there is not enough oxygen for every carbon atom: the carbon stops at carbon monoxide, 2CH₄ + 3O₂ → 2CO + 4H₂O, and some is left as tiny solid particles that glow yellow in the flame and land as soot on anything cold held in it. Fully open, the pre-mixed flame burns fast and hot (up to about 1 400 °C at the tip of the inner cone), almost invisible blue, and clean: CH₄ + 2O₂ → CO₂ + 2H₂O.",
      "The difference matters outside the lab. Carbon monoxide is colourless, odourless and binds to haemoglobin about 200 times more strongly than oxygen does, so a yellow-flamed gas appliance in a closed room is dangerous — which is why boilers and heaters are serviced to keep their flames blue and why homes have CO detectors. The soot is wasted fuel, and the incomplete reaction also releases less energy per mole of methane (about 607 kJ against 890 kJ), so a blue flame is not just safer but hotter and more efficient. The yellow 'safety' flame exists only so that a burner that is lit but not in use can be seen.",
    ],
    quiz: [
      {
        question:
          "A Bunsen burner's air hole is opened fully. What happens to the flame, and why?",
        options: [
          "It turns blue, quieter to see but roaring, and much hotter — air is mixed in before the flame, so the methane burns completely to CO₂ and water",
          "It turns yellow and brighter — more air makes more light",
          "It goes out — the extra air blows the flame off the barrel",
          "It stays the same colour but gets taller",
        ],
        answer: 0,
        explanation:
          "With the holes open, oxygen is pre-mixed with the gas, so every carbon atom has enough oxygen to reach CO₂ and the reaction runs fast and hot (up to ~1 400 °C at the inner cone tip). There is no unburnt carbon to glow, so the flame loses its yellow and becomes a faint blue with a sharp inner cone.",
      },
      {
        question:
          "A cold evaporating basin is held in a yellow Bunsen flame and comes out black underneath. What is the black substance, and what does it tell you about the flame?",
        options: [
          "Soot — unburnt carbon — showing the flame is short of oxygen and burning incompletely",
          "Copper oxide from the burner barrel",
          "Condensed methane, frozen onto the cold surface",
          "Carbon dioxide, which is black when solid",
        ],
        answer: 0,
        explanation:
          "In a closed-collar flame some carbon never gets the oxygen to become CO or CO₂; it is left as particles of carbon that glow yellow (that is the flame's colour) and land on a cold surface as soot. A blue flame leaves the basin clean because its carbon all leaves as colourless CO₂.",
      },
      {
        question:
          "A lit burner is covered with a bell jar. The gas is still flowing and the flame is still hot, yet it goes out after a few seconds. Which side of the fire triangle was removed?",
        options: [
          "Oxygen — the flame used up the oxygen in the jar until the air was too lean to burn in",
          "Fuel — the jar stops the gas reaching the flame",
          "Heat — the glass cools the flame",
          "None — the flame was blown out by the draught of lowering the jar",
        ],
        answer: 0,
        explanation:
          "The jar seals off the supply of fresh air. The flame keeps consuming oxygen (and producing CO₂ and water vapour) until the oxygen fraction falls below what methane needs — roughly 16% — and the reaction can no longer sustain itself. Fuel and heat were both still present; only oxygen was missing.",
      },
      {
        question:
          "Why does a fine water mist put a flame out?",
        options: [
          "Evaporating water absorbs a great deal of heat (about 2 260 kJ per kg), cooling the fuel–air mix below its ignition temperature",
          "Water reacts with methane to form a non-flammable gas",
          "The droplets physically block oxygen from reaching the flame",
          "Water dissolves the methane so it cannot burn",
        ],
        answer: 0,
        explanation:
          "Water's latent heat of vaporisation is enormous, and a mist has a huge surface area, so it evaporates instantly in the flame and carries the heat away faster than the reaction can replace it. Fuel and oxygen are both still there; the flame simply drops below the temperature needed to keep igniting the next bit of gas. Cooling is the heat side of the triangle.",
      },
    ],
  },
  {
    id: "particle_model_matter",
    category: "chemistry",
    icon: Thermometer,
    title: "Particle Model of Matter & Phase Changes",
    blurb: "500 particles on a hotplate under a piston — and the thermometer that stops while they melt and boil",
    syllabus: "Chemistry 1.1 · States of matter · grades 6–9",
    keywords:
      "particle model kinetic theory states of matter solid liquid gas melting boiling freezing condensing sublimation evaporation latent heat fusion vaporisation heating curve plateau temperature kinetic energy intermolecular forces hydrogen bond dispersion pressure piston boiling point clausius clapeyron dry ice supercritical ice floats",
    defaults: {
      temperature: 20,
      pressure: 1,
      substance: "water",
      speed: 1,
    },
    controls: [
      {
        type: "slider",
        key: "temperature",
        label: "Temperature — hotplate / cryocooler setpoint",
        min: TEMP_MIN_C,
        max: TEMP_MAX_C,
        step: 1,
        format: (v) => `${Number(v).toFixed(0)} °C`,
      },
      {
        type: "slider",
        key: "pressure",
        label: "Pressure piston",
        min: PRESSURE_MIN_ATM,
        max: PRESSURE_MAX_ATM,
        step: 0.1,
        format: (v) => `${Number(v).toFixed(1)} atm`,
      },
      { type: "choice", key: "substance", label: "Substance", options: SUBSTANCE_OPTIONS, columns: 3 },
    ],
    concepts: [
      "Everything is made of particles that are always moving, and temperature is a measure of how fast — the average kinetic energy of a particle is proportional to the absolute temperature (³⁄₂ kT). In a solid the particles have only enough energy to vibrate about fixed positions in a regular lattice; in a liquid they have enough to slide past one another but not to escape each other's attraction, so they stay touching; in a gas they have broken free entirely and fly in straight lines between collisions, filling whatever space the piston leaves them. Heating a gas makes its particles hit the walls harder and more often, which is pressure; pushing the piston down squeezes the same particles into less room, which is also pressure.",
      "While a substance melts or boils its temperature does not change. The heating curve shows this as two flat steps: energy is still going in, but it is being spent breaking the attractions between particles — pulling them out of the lattice (the latent heat of fusion, 6.0 kJ per mole for ice) or apart from one another altogether (the latent heat of vaporisation, 40.7 kJ per mole for water) — not on making them move faster. Only when every particle has crossed does the temperature rise again. The boiling step is far longer than the melting step because separating particles completely costs far more than loosening them.",
      "How high those steps sit depends on how strong the attractions are, and where they sit depends on the pressure. Water's hydrogen bonds hold it together to 100 °C; neon's feeble dispersion forces give way at −246 °C, far below anything this hotplate reaches. Raise the pressure and a liquid has to get hotter before its vapour can push back — water boils at 180 °C at 10 atm, which is how a pressure cooker works, and at 81 °C at 0.5 atm on a mountain. Carbon dioxide has no liquid at all at 1 atm: dry ice sublimes straight to gas at −78.5 °C, and only above 5.1 atm can it be a liquid. Ice is the odd one out for another reason — its open hydrogen-bonded lattice takes up 9% more room than the water it melts into, which is why it floats.",
    ],
    quiz: [
      {
        question: "Water is heated steadily from 20 °C. At 100 °C the thermometer stops rising for a long time even though the hotplate is still on. Where is the energy going?",
        options: [
          "Into separating the water molecules from one another completely — the latent heat of vaporisation — not into making them move faster",
          "Into the thermometer, which has stopped working",
          "It is being reflected by the water's surface",
          "Into making the molecules move faster, but the thermometer is too slow to show it",
        ],
        answer: 0,
        explanation:
          "During boiling every joule supplied is spent breaking the attractions that hold the liquid together (about 40.7 kJ per mole for water). The average kinetic energy of the molecules — which is what temperature measures — stays the same until every molecule has escaped into the gas, so the heating curve is flat.",
      },
      {
        question: "The piston is pushed down to raise the pressure on the water from 1 atm to 10 atm. What happens to its boiling point?",
        options: [
          "It rises, to about 180 °C — the vapour must push harder to escape, so the liquid must be hotter",
          "It falls, because pressure squeezes the molecules apart",
          "It stays at 100 °C — boiling point is a fixed property of water",
          "The water cannot boil at all above 1 atm",
        ],
        answer: 0,
        explanation:
          "Boiling happens when the vapour pressure of the liquid matches the pressure on it. At higher pressure that needs a higher temperature (Clausius–Clapeyron): about 180 °C at 10 atm. A pressure cooker uses exactly this to cook food faster; on a mountain at 0.5 atm water boils at only 81 °C.",
      },
      {
        question: "At 1 atm, dry ice (solid CO₂) is warmed on the hotplate. What does the heating curve show?",
        options: [
          "One flat step at −78.5 °C as the solid turns straight to gas — there is no liquid stage at this pressure",
          "Two flat steps, like water — melting then boiling",
          "No flat steps — CO₂ has no latent heats",
          "A flat step at 0 °C, because that is where solids melt",
        ],
        answer: 0,
        explanation:
          "Below its triple-point pressure of 5.1 atm carbon dioxide cannot exist as a liquid. The solid sublimes directly to gas at −78.5 °C, and the heating curve has a single flat step there whose width is the latent heat of sublimation (about 25 kJ per mole). Raise the piston pressure above 5.1 atm and a liquid appears between a melting step and a boiling step.",
      },
      {
        question: "Neon is chosen and the hotplate is set to its coldest, −100 °C. Why do the particles stay a gas?",
        options: [
          "Neon's atoms attract each other only through weak dispersion forces, so it boils at −246 °C — far colder than the cryocooler can reach",
          "Neon is always a gas; it cannot be a liquid or solid",
          "The cryocooler is broken",
          "The piston pressure is too low for neon to condense at any temperature",
        ],
        answer: 0,
        explanation:
          "Whether a substance is solid, liquid or gas at a given temperature depends on how strong the attractions between its particles are compared with their kinetic energy. Neon's closed-shell atoms attract only by instantaneous dipoles, the weakest force there is, so it condenses at −246 °C and freezes at −249 °C. At −100 °C its atoms have many times the energy needed to stay free.",
      },
      {
        question: "The same 500 water particles stand taller as a block of ice than as a pool of liquid water. What does this tell you?",
        options: [
          "Ice is less dense than water — the hydrogen-bonded lattice holds the molecules further apart than they sit in the liquid — which is why ice floats",
          "There are more particles in ice than in water",
          "Ice particles are bigger than water particles",
          "The ice has trapped air",
        ],
        answer: 0,
        explanation:
          "In liquid water molecules tumble past one another and pack closer than the rigid, open hexagonal arrangement hydrogen bonds impose in ice. The same mass takes about 9% more volume as ice — an unusual property (most solids are denser than their liquids, as neon and CO₂ are here) and the reason lakes freeze from the top down.",
      },
    ],
  },
  {
    id: "radioactive_decay",
    category: "chemistry",
    icon: Radiation,
    title: "Radioactive Decay Modes & Half-Life",
    blurb: "Ten thousand nuclei rolling dice — α, β and γ through plates and barriers, and the curve that falls out",
    syllabus: "Chemistry 2.4 / Physics 5.2 · Nuclear · grades 9–10",
    keywords:
      "radioactive decay half-life alpha beta gamma positron neutrino nucleon number atomic number conservation nuclear equation uranium thorium carbon-14 carbon dating fluorine-18 PET technetium-99m exponential decay constant activity becquerel geiger counter ionising penetrating paper aluminium lead electric field deflection random probability statistics",
    defaults: {
      mode: "alpha",
      atoms: DEFAULT_ATOMS,
      barrier: "paper",
      fieldOn: false,
      restart: 0,
      speed: 1,
    },
    controls: [
      { type: "choice", key: "mode", label: "Decay mode", options: DECAY_MODE_OPTIONS, columns: 2 },
      {
        type: "slider",
        key: "atoms",
        label: "Sample population size",
        min: MIN_ATOMS,
        max: MAX_ATOMS,
        step: 100,
        format: (v) => `${Number(v).toLocaleString("en-GB")} atoms`,
      },
      { type: "choice", key: "barrier", label: "Barrier material", options: BARRIER_OPTIONS, columns: 3 },
      { type: "toggle", key: "fieldOn", label: "Electric field plates (+ above, − below)" },
      { type: "action", key: "restart", label: `Fresh sample (restart · 1 t½ = ${SIM_HALF_LIFE_S} s on screen)`, icon: RotateCcw, variant: "ghost" },
    ],
    concepts: [
      "A nuclear equation must balance twice over: the nucleon numbers (top, A) add up on both sides and so do the atomic numbers (bottom, Z), because nucleons and charge are both conserved. An alpha particle is a helium nucleus, ⁴₂He, so alpha decay takes A down by 4 and Z down by 2: ²³⁸₉₂U → ²³⁴₉₀Th + ⁴₂He. In beta-minus decay a neutron becomes a proton and an electron (⁰₋₁e) leaves, so Z goes UP by one and A stays the same: ¹⁴₆C → ¹⁴₇N + ⁰₋₁e + ν̄ₑ. Beta-plus is the mirror — a proton becomes a neutron, a positron (⁰₊₁e) leaves, Z goes DOWN by one. A gamma ray is a photon: no mass, no charge, so the nucleus is unchanged, only calmer.",
      "The three radiations are told apart by what stops them and what bends them. Alpha is heavy and doubly charged, so it ionises intensely and is spent within a few centimetres of air or a single sheet of paper. Beta is light and singly charged, penetrates paper and about a metre of air, and is stopped by a few millimetres of aluminium. Gamma has no charge, ionises weakly, and is only attenuated — never quite stopped — by thick lead. Between charged plates the alpha (positive) bends toward the negative plate, the beta-minus (negative) bends the other way and, being 7 000 times lighter, bends far more; gamma goes straight through.",
      "Decay is random: no nucleus knows how old it is, and each undecayed nucleus has exactly the same probability of decaying in the next second as every other. That is all the model contains, yet from it the number remaining follows N = N₀e^(−λt), so the time for half to go — the half-life — is the same whether you start with the whole sample or with what is left. With a hundred atoms the curve is jagged and the measured half-lives scatter; with ten thousand it lies on the prediction, because averages over many random events are predictable even though each event is not. The activity (decays per second, in becquerels) is λN, so it halves with N — a Geiger counter clicks half as often every half-life.",
    ],
    quiz: [
      {
        question: "Uranium-238 (A = 238, Z = 92) emits an alpha particle. What is the daughter nucleus?",
        options: [
          "Thorium-234: A = 234, Z = 90 — the alpha carries away 4 nucleons and 2 protons",
          "Uranium-234: A = 234, Z = 92 — only the mass changes",
          "Plutonium-242: A = 242, Z = 94 — the nucleus gains an alpha",
          "Protactinium-238: A = 238, Z = 91 — one proton becomes a neutron",
        ],
        answer: 0,
        explanation:
          "An alpha particle is ⁴₂He. Both A and Z must balance: 238 = 234 + 4 and 92 = 90 + 2. Element 90 is thorium.",
      },
      {
        question: "Carbon-14 (Z = 6) undergoes beta-minus decay. Why does the daughter have Z = 7 when no proton was added?",
        options: [
          "A neutron inside the nucleus turned into a proton, emitting an electron to conserve charge — so Z rises by one while A stays 14",
          "The nucleus captured a proton from the surroundings",
          "The electron emitted was a proton in disguise",
          "Z does not change in beta decay; the daughter is still carbon",
        ],
        answer: 0,
        explanation:
          "In β⁻ decay n → p + e⁻ + ν̄ₑ. The proton count goes up by one (carbon becomes nitrogen), the nucleon count is unchanged (the neutron became a proton, still one nucleon), and the electron's charge of −1 balances the new +1 in the nucleus: ¹⁴₆C → ¹⁴₇N + ⁰₋₁e + ν̄ₑ.",
      },
      {
        question: "A source is placed in front of a Geiger counter with the field plates on. The count drops to almost nothing when the plates are switched on, and returns when they are off. Which radiation is it NOT?",
        options: [
          "Gamma — a gamma photon has no charge, so the field could not have moved it off the detector",
          "Alpha — alpha particles are too heavy to deflect",
          "Beta-minus — electrons are not affected by electric fields",
          "It could be any of them",
        ],
        answer: 0,
        explanation:
          "Only charged particles are deflected by an electric field. If switching the field on steers the beam off the window, the radiation carries charge — it is alpha or beta. Gamma photons pass straight through with the field on or off.",
      },
      {
        question: "A sample of 100 atoms gives measured half-lives of 8.1 s, 11.4 s and 9.2 s; a sample of 10 000 atoms gives 9.9 s, 10.0 s and 10.1 s. What does this show?",
        options: [
          "Decay is random for each nucleus, so a small sample scatters — but with many nuclei the randomness averages out and the half-life is sharply defined",
          "Small samples have a shorter half-life than large ones",
          "The large sample is a different isotope",
          "Half-life depends on how many atoms have already decayed",
        ],
        answer: 0,
        explanation:
          "Every nucleus has the same probability of decaying per second whatever the sample size. With few nuclei, chance fluctuations in WHEN they go are large compared with the total, so the time for half to go varies from run to run. With thousands, the fluctuations are a small fraction of the whole and N(t) follows N₀e^(−λt) closely. The half-life is a property of the isotope, not of the sample.",
      },
      {
        question: "Technetium-99m is used as a medical tracer and decays by emitting a gamma ray. What happens to its A and Z?",
        options: [
          "Neither changes — a gamma ray carries energy but no mass and no charge, so ⁹⁹ᵐTc simply becomes ⁹⁹Tc",
          "A falls by 4 and Z by 2",
          "Z rises by one",
          "A falls by one — the photon carries off one nucleon",
        ],
        answer: 0,
        explanation:
          "The 'm' means metastable: the nucleus was left in an excited state and sheds the surplus as a photon. Since no nucleon or charge leaves, the nuclide is unchanged. The gamma's penetrating power is exactly why it can be detected from outside the body, and the 6-hour half-life is short enough to limit the patient's dose.",
      },
    ],
  },
  // ═══ Biology ═══════════════════════════════════════════════════════
  {
    id: "enzyme",
    category: "biology",
    icon: Puzzle,
    title: "Enzyme Action & Denaturation",
    blurb: "Lock-and-key binding, and what heat does to it",
    syllabus: "Biology 5 · Enzymes",
    keywords: "enzyme substrate active site lock key denature optimum temperature ph catalyst protein",
    defaults: { temperature: 37, ph: 7, speed: 1 },
    controls: [
      { type: "slider", key: "temperature", label: "Temperature", min: 0, max: 80, step: 1, format: (v) => `${v}°C` },
      { type: "slider", key: "ph", label: "pH", min: 1, max: 14, step: 0.5, format: (v) => v.toFixed(1) },
      // No "speed" slider here — the HUD's universal Animation Speed slider
      // already writes this key. See the note on `bohr`.
    ],
    concepts: [
      "Enzymes are protein catalysts: the substrate fits a specific active site like a key in a lock, so each enzyme catalyses one reaction.",
      "Rate rises with temperature up to an optimum (about 37 °C in humans) because collisions become more frequent and more energetic.",
      "Above the optimum the protein's shape changes permanently — it is denatured — so the substrate no longer fits and the rate falls to zero. Extreme pH does the same.",
    ],
    quiz: [
      {
        question: "What happens to an enzyme heated well above its optimum temperature?",
        options: [
          "Its active site changes shape permanently, so the substrate no longer fits",
          "It speeds up indefinitely",
          "It is used up in the reaction",
          "It temporarily stops, then works normally once cooled",
        ],
        answer: 0,
        explanation:
          "Heat breaks the bonds holding the protein's three-dimensional shape. Denaturation is permanent — cooling the enzyme back down does not restore the active site.",
      },
      {
        question: "Why does one enzyme usually catalyse only one reaction?",
        options: [
          "Its active site is complementary in shape to only one substrate",
          "It is used up after a single reaction",
          "Each enzyme can only work at one temperature",
          "Enzymes carry an electrical charge specific to one molecule",
        ],
        answer: 0,
        explanation:
          "This is the lock-and-key model: only a substrate whose shape matches the active site can bind, which makes enzymes highly specific.",
      },
    ],
  },
  {
    id: "dna",
    category: "biology",
    icon: Dna,
    title: "DNA Double Helix & Base Pairing",
    blurb: "Complementary A–T and C–G pairs, and replication",
    syllabus: "Biology 17 · Inheritance",
    keywords: "dna double helix base pair adenine thymine cytosine guanine replication chromosome gene nucleotide",
    defaults: { spin: 1, pairs: 16, unzip: 0 },
    controls: [
      { type: "slider", key: "spin", label: "Spin speed", min: 0, max: 2.5, step: 0.1, format: (v) => (v === 0 ? "paused" : `${v.toFixed(1)}×`) },
      { type: "slider", key: "pairs", label: "Base pairs", min: 8, max: 26, step: 1 },
      { type: "action", key: "unzip", label: "Unzip DNA", icon: Scissors },
    ],
    concepts: [
      "DNA is a double helix: two strands of nucleotides wound around each other and joined by base pairs.",
      "A always pairs with T, and C always pairs with G, so the two strands are complementary — each carries the full instructions.",
      "During replication the helix unzips and each old strand acts as a template for a new complementary strand, so the two copies are identical.",
    ],
    quiz: [
      {
        question: "One DNA strand reads A–T–G–C. What does the complementary strand read?",
        options: ["T–A–C–G", "A–T–G–C", "G–C–A–T", "C–G–T–A"],
        answer: 0,
        explanation:
          "Each base pairs with its complement: A with T, T with A, G with C, C with G. So A–T–G–C pairs with T–A–C–G.",
      },
      {
        question: "What holds the two strands of the double helix together?",
        options: [
          "Hydrogen bonds between complementary base pairs",
          "Ionic bonds between the sugar molecules",
          "The phosphate backbone of a third strand",
          "Nothing — the strands are held only by the twist",
        ],
        answer: 0,
        explanation:
          "Weak hydrogen bonds between the paired bases hold the strands together. Being weak is the point: they can be unzipped for replication without breaking the strands.",
      },
    ],
  },
  {
    id: "cell",
    category: "biology",
    icon: Microscope,
    title: "3D Cell Organelle Explorer",
    blurb: "Plant vs. animal cells, with an osmosis simulation",
    syllabus: "Biology 2 · Cell structure",
    keywords: "cell organelle nucleus mitochondria chloroplast vacuole cell wall membrane osmosis turgid plasmolysis plant animal",
    defaults: { cellType: "plant", tonicity: 0, showLabels: true, water: true, cutaway: false },
    controls: [
      {
        type: "choice",
        key: "cellType",
        label: "Cell type",
        options: [
          { value: "plant", label: "Plant" },
          { value: "animal", label: "Animal" },
        ],
      },
      {
        type: "slider",
        key: "tonicity",
        label: "External solution",
        min: -1,
        max: 1,
        step: 0.05,
        format: (v) => (v > 0.05 ? "concentrated" : v < -0.05 ? "dilute" : "isotonic"),
      },
      { type: "toggle", key: "cutaway", label: "Cutaway view" },
      { type: "toggle", key: "water", label: "Show water movement" },
      { type: "toggle", key: "showLabels", label: "Show organelle labels" },
    ],
    concepts: [
      "Plant and animal cells share a nucleus, cytoplasm, cell membrane, mitochondria and ribosomes; only plant cells add a cellulose wall, chloroplasts and a large permanent vacuole.",
      "Mitochondria release energy by aerobic respiration; chloroplasts trap light for photosynthesis, which is why only plant cells have them.",
      "Osmosis moves water across the partially permeable membrane from dilute to concentrated: a plant cell turns turgid or plasmolysed, an animal cell swells and bursts or shrivels.",
    ],
    quiz: [
      {
        question: "Which set of structures is found in plant cells but NOT in animal cells?",
        options: [
          "Cell wall, chloroplasts and a large permanent vacuole",
          "Nucleus, mitochondria and ribosomes",
          "Cell membrane and cytoplasm",
          "Mitochondria and chloroplasts",
        ],
        answer: 0,
        explanation:
          "Both cell types have a nucleus, membrane, cytoplasm, mitochondria and ribosomes. The cellulose wall, chloroplasts and permanent vacuole are the plant-only three.",
      },
      {
        question: "An animal cell is placed in pure water. What happens?",
        options: [
          "Water enters by osmosis and the cell may swell and burst",
          "Water leaves by osmosis and the cell shrivels",
          "Nothing — animal cells are impermeable to water",
          "The cell wall stops it changing size",
        ],
        answer: 0,
        explanation:
          "Pure water is more dilute than the cytoplasm, so water moves in by osmosis. With no cell wall to resist the pressure, the animal cell can burst — lysis.",
      },
    ],
  },

  {
    id: "protein",
    category: "biology",
    icon: Spline,
    title: "Protein Folding & Secondary Structure",
    blurb: "α-helices, β-sheets, and what heat does to both",
    syllabus: "Biology 1.3 · Biological Molecules",
    keywords:
      "protein folding secondary structure alpha helix beta pleated sheet hydrogen bond denaturation amino acid residue peptide chain hydrophobic hydrophilic tertiary structure enzyme shape",
    defaults: {
      structure: "helix",
      residues: 30,
      fold: 1,
      temperature: 300,
      showBonds: true,
      colourByType: true,
      spin: true,
    },
    controls: [
      { type: "choice", key: "structure", label: "Secondary structure", columns: 3, options: STRUCTURE_OPTIONS },
      { type: "slider", key: "residues", label: "Chain length", min: 8, max: 64, step: 1, format: (v) => `${v} residues` },
      { type: "slider", key: "fold", label: "Folding progress", min: 0, max: 1, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
      { type: "slider", key: "temperature", label: "Temperature", min: 280, max: 380, step: 2, format: (v) => `${v} K · ${(v - 273).toFixed(0)} °C` },
      { type: "toggle", key: "showBonds", label: "Show hydrogen bonds" },
      { type: "toggle", key: "colourByType", label: "Colour by hydrophobicity" },
      { type: "toggle", key: "spin", label: "Orbit camera" },
    ],
    concepts: [
      "Secondary structure is held together by hydrogen bonds along the backbone. In an α-helix each one runs from residue i to residue i+4, and that fixed spacing is what forces the spiral of 3.6 residues per turn.",
      "In a β-pleated sheet the hydrogen bonds run sideways between neighbouring strands rather than along one, and adjacent strands usually run in opposite directions — antiparallel.",
      "Heat and extremes of pH break those hydrogen bonds without touching the peptide bonds, so the chain unravels into a random coil. The sequence of amino acids survives denaturation intact; the shape, and therefore the function, does not.",
    ],
    quiz: [
      {
        question: "An enzyme is heated to 70 °C and stops working, but chemical analysis shows its amino acid sequence is unchanged. What has happened?",
        options: [
          "The hydrogen bonds holding its shape have broken, so the active site no longer fits its substrate",
          "The peptide bonds have been hydrolysed into separate amino acids",
          "The enzyme has been used up by the reaction it catalysed",
          "The substrate has been denatured instead of the enzyme",
        ],
        answer: 0,
        explanation:
          "Denaturation breaks the weak hydrogen and ionic bonds that hold the secondary and tertiary structure, while the strong covalent peptide bonds of the primary sequence survive. The active site loses its complementary shape, so the substrate no longer binds.",
      },
      {
        question: "In an α-helix, each hydrogen bond forms between a residue and which other one?",
        options: [
          "The residue four positions further along the chain",
          "The residue immediately next to it",
          "A residue on a neighbouring strand",
          "The residue at the opposite end of the chain",
        ],
        answer: 0,
        explanation:
          "The i to i+4 hydrogen bond is what defines the α-helix. That spacing sets the pitch of the spiral at 3.6 residues per turn and a rise of 0.54 nm. Bonds between neighbouring strands are what hold a β-sheet together instead.",
      },
    ],
  },
  {
    id: "eye",
    category: "biology",
    icon: Eye,
    title: "The Human Eye — Accommodation & Pupil Reflex",
    blurb: "Cutaway eyeball with live ray tracing, a deforming lens, and the iris reflex",
    syllabus: "Biology 2.4 · Coordination & Response",
    keywords:
      "eye accommodation ciliary muscle suspensory ligaments zonules crystalline lens cornea iris pupil reflex sphincter dilator retina fovea optic nerve refraction dioptres near point far point blurred vision short sight long sight aqueous vitreous humour",
    ownHud: true,
    defaults: {},
    controls: [],
    concepts: [
      "Focusing on something NEAR is the active state, and it runs backwards from most people's intuition: the ciliary muscle CONTRACTS, which slackens the suspensory ligaments it was pulling on, and the freed lens springs back to its naturally fat, highly curved shape.",
      "For a distant object the ciliary muscle relaxes and widens, pulling the zonules taut and stretching the lens thin and flat. Less curvature means less refraction — which is all that is needed, because rays from far away arrive almost parallel.",
      "The iris works two antagonistic muscles: circular sphincter fibres constrict the pupil in bright light to protect the photoreceptors, and radial dilator fibres pull it open in the dark to gather more light.",
    ],
    quiz: [
      {
        question:
          "You look up from a book to a tree on the horizon. What happens to the ciliary muscle and the suspensory ligaments?",
        options: [
          "Ciliary muscle relaxes; ligaments become taut",
          "Ciliary muscle contracts; ligaments become taut",
          "Ciliary muscle relaxes; ligaments become slack",
          "Ciliary muscle contracts; ligaments become slack",
        ],
        answer: 0,
        explanation:
          "Distance vision is the resting state. The ciliary ring relaxes and so widens, which pulls the zonules taut, and the taut zonules stretch the lens thin. A thin lens refracts weakly — exactly right for rays that are already nearly parallel.",
      },
      {
        question:
          "Someone holds a page 15 cm away but their lens stays fully relaxed. Where does the image form, and why?",
        options: [
          "Behind the retina, because the lens is not curved enough to converge the diverging rays in time",
          "In front of the retina, because the relaxed lens is too powerful",
          "On the retina, because the cornea does all the focusing",
          "Behind the retina, because the pupil has constricted",
        ],
        answer: 0,
        explanation:
          "Rays from 15 cm away diverge strongly and need about 6.7 D of extra power. Without accommodation the eye is still set for infinity, so the rays have not converged by the time they reach the retina and cross behind it — each point of the page paints a blur circle instead.",
      },
    ],
  },
  {
    id: "respiratory",
    category: "biology",
    icon: Wind,
    title: "Respiratory Mechanics & Thoracic Physics",
    blurb: "Thoracic volume expansion, Boyle's law pressure gradients, antagonistic intercostals, and diaphragm mechanics in 3D",
    syllabus: "Biology 11 · Gas Exchange & Respiration",
    keywords:
      "respiratory system lungs diaphragm external intercostal internal intercostal ribcage sternum inspiration expiration forced expiration Boyle's law tidal volume FRC thoracic cavity mechanics pressure volume airflow",
    ownHud: true,
    defaults: {
      phase: "inspiration",
      autoLoop: true,
      bpm: 14,
      cutaway: 0.25,
      showMuscles: true,
      showAirflow: true,
      showVectors: true,
      showLabels: true,
    },
    controls: [
      {
        type: "choice",
        key: "phase",
        label: "Breathing Phase",
        columns: 3,
        options: [
          { value: "inspiration", label: "Inspiration" },
          { value: "quiet_expiration", label: "Quiet Exp." },
          { value: "forced_expiration", label: "Forced Exp." },
        ],
      },
      { type: "toggle", key: "autoLoop", label: "Auto breathing cycle" },
      { type: "slider", key: "bpm", label: "Breathing rate", min: 6, max: 30, step: 1, format: (v) => `${v} BPM` },
      { type: "slider", key: "cutaway", label: "Cutaway view", min: 0, max: 1, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
      { type: "toggle", key: "showMuscles", label: "Intercostal muscles" },
      { type: "toggle", key: "showAirflow", label: "Airway particle flow" },
      { type: "toggle", key: "showVectors", label: "3D motion vectors" },
      { type: "toggle", key: "showLabels", label: "Anatomical labels" },
    ],
    concepts: [
      "Inspiration is an active process: External intercostal muscles contract (pulling ribcage up and out) and the diaphragm contracts and flattens downward, expanding thoracic cavity volume.",
      "Boyle's Law ($P_1 V_1 = P_2 V_2$) governs pulmonary ventilation: Thoracic expansion decreases intra-alveolar pressure below atmospheric pressure (negative relative pressure), drawing ambient air into the lungs along the pressure gradient.",
      "Quiet expiration is passive due to elastic recoil of the lungs and chest wall. Forced expiration actively contracts internal intercostals (depressing ribs) and abdominal muscles (forcing diaphragm upward), generating high positive expulsion pressure.",
    ],
    quiz: [
      {
        question: "During inspiration, what are the physiological actions of the external intercostal muscles and diaphragm?",
        options: [
          "External intercostals contract to elevate ribs; diaphragm contracts and flattens downward",
          "External intercostals relax; diaphragm relaxes and arches upward into a dome",
          "Internal intercostals contract; diaphragm relaxes and moves downward",
          "External intercostals contract; diaphragm relaxes and pushes upward",
        ],
        answer: 0,
        explanation:
          "Inspiration is driven by active contraction: external intercostals pull the ribcage upwards and outwards ('bucket-handle' and 'pump-handle' mechanics) while the diaphragm contracts, flattening its dome downward to expand thoracic volume.",
      },
      {
        question: "How does Boyle's Law explain the movement of air into the lungs during inspiration?",
        options: [
          "Thoracic volume increases, causing internal pressure to fall below atmospheric pressure, drawing air inward down the pressure gradient",
          "Thoracic volume decreases, raising internal pressure to push air inward",
          "Lung temperature increases, causing gas molecules to expand into the alveoli",
          "Atmospheric pressure increases while lung pressure remains completely constant",
        ],
        answer: 0,
        explanation:
          "Boyle's Law states that for a fixed mass of gas at constant temperature, pressure is inversely proportional to volume ($P \\propto 1/V$). Expanding thoracic volume drops intra-alveolar pressure below atmospheric pressure (creating a relative vacuum), causing air to rush inward down the pressure gradient.",
      },
      {
        question: "Which muscle group actively contracts during FORCED expiration (such as blowing out candles or coughing)?",
        options: [
          "Internal intercostals and abdominal muscles",
          "External intercostals and diaphragm",
          "Pectoralis major and sternocleidomastoid",
          "Only the elastic recoil fibers of the alveoli, with no muscle contraction",
        ],
        answer: 0,
        explanation:
          "While quiet expiration is passive elastic recoil, forced expiration is an active muscular process where internal intercostals actively depress the ribcage down and inwards, paired with abdominal muscle compression driving the diaphragm upward.",
      },
    ],
  },
  {
    id: "reflex_arc",
    category: "biology",
    icon: Activity,
    title: "The Reflex Arc & Spinal Circuit",
    blurb: "A hand in a candle flame, and the 30 ms round trip through the spinal cord that pulls it out",
    syllabus: "Biology 14 · Coordination & Response",
    keywords:
      "reflex arc withdrawal reflex stimulus receptor nociceptor sensory neuron relay neuron interneuron motor neuron effector spinal cord dorsal root ganglion ventral root synapse neurotransmitter action potential myelin conduction velocity involuntary response time",
    defaults: { stimulus: "flame", pathway: "intact", slowMotion: true, speed: 1 },
    controls: [
      { type: "choice", key: "stimulus", label: "Stimulus type", columns: 1, options: STIMULUS_OPTIONS },
      { type: "choice", key: "pathway", label: "Nerve pathway", columns: 1, options: NERVE_PATHWAY_OPTIONS },
      { type: "toggle", key: "slowMotion", label: "Slow-motion playback (10× slowed)" },
    ],
    concepts: [
      "A reflex arc is the shortest route from a stimulus to a response: receptor → sensory neuron → relay neuron in the spinal cord → motor neuron → effector. The impulse never has to reach the brain's cortex to make the arm move, which is why the response is involuntary and why it is fast — about 30 ms from the burn to the biceps being told to contract, most of it spent travelling up the arm.",
      "The two spinal roots carry traffic one way only. Sensory impulses enter through the DORSAL root, past the ganglion that holds the sensory neuron's cell body; motor impulses leave through the VENTRAL root. Cut the dorsal root and nothing is felt and nothing moves; cut the ventral root and the pain is still felt, but the order to move never reaches the muscle.",
      "Every junction is a synapse, and a synapse is a one-way chemical gap: neurotransmitter is released from the presynaptic side only, so the impulse cannot run backwards. Each one costs about half a millisecond — and a stimulus that does not reach the pain threshold, like warmth, never recruits the motor side of the arc at all.",
    ],
    quiz: [
      {
        question: "A person's dorsal (sensory) root at the spinal segment serving the hand is completely severed. Their hand touches a flame. What happens?",
        options: [
          "No withdrawal reflex and no sensation — the impulse cannot enter the spinal cord at all",
          "The hand withdraws normally, but they feel nothing",
          "They feel the pain, but the hand does not withdraw",
          "Nothing changes, because the reflex uses the ventral root",
        ],
        answer: 0,
        explanation:
          "All sensory information enters the cord through the dorsal root. With it cut, the impulse from the nociceptor stops at the cut: it reaches neither the relay neuron (so no reflex) nor the brain (so no sensation). A ventral-root cut would be the opposite — pain felt, no movement.",
      },
      {
        question: "Why does a reflex response happen BEFORE you consciously feel the pain?",
        options: [
          "The arc is completed within the spinal cord; the message to the brain travels on separately and takes longer to be processed",
          "Pain receptors send their signal to the muscle directly, without any neurons",
          "The brain processes the reflex first and only feels the pain afterwards",
          "Motor neurons conduct faster than any other cell, so the muscle is reached first",
        ],
        answer: 0,
        explanation:
          "The relay neuron in the cord sends the impulse straight to a motor neuron — the whole loop is about 30 ms. A copy of the signal also ascends to the brain, but conscious perception involves many more synapses and takes several hundred milliseconds, by which time the hand has already moved.",
      },
      {
        question: "Which of these is a reason the reflex takes about 30 ms rather than being instant?",
        options: [
          "The impulse has to travel about 70 cm along the sensory neuron at roughly 30 m/s, which alone takes over 20 ms",
          "The receptor waits for the brain's permission before firing",
          "Neurotransmitter has to diffuse all the way from the fingertip to the spinal cord",
          "The muscle contracts before the impulse arrives, so timing is irrelevant",
        ],
        answer: 0,
        explanation:
          "Conduction is not instantaneous. A thin myelinated Aδ pain fibre carries the impulse at tens of metres per second, so the long run up the arm is the largest single part of the delay. The synapses add only about half a millisecond each, and the thick, fast motor axon covers its 35 cm in under 4 ms.",
      },
    ],
  },
  {
    id: "antagonistic_muscles",
    category: "biology",
    icon: BicepsFlexed,
    title: "Antagonistic Muscle Pairs & the Levered Elbow",
    blurb: "Biceps and triceps across the elbow — why a muscle can only pull, and what τ = F·d costs it",
    syllabus: "Biology 14 · Coordination & Response · Movement",
    keywords:
      "antagonistic muscle pair biceps triceps agonist antagonist flexor extensor elbow joint hinge lever torque moment force distance tendon ligament contraction relaxation bulge fatigue lactic acid anaerobic respiration strain skeleton humerus radius ulna scapula",
    defaults: { elbowAngle: 90, load: 10, fatigue: 0, speed: 1 },
    controls: [
      { type: "slider", key: "elbowAngle", label: "Elbow joint angle", min: 0, max: 145, step: 1, format: (v) => (v === 0 ? "0° · full extension" : v === 145 ? "145° · full flexion" : `${v}°`) },
      { type: "slider", key: "load", label: "Handheld load", min: 0, max: 25, step: 0.5, format: (v) => (v === 0 ? "no dumbbell" : `${v} kg dumbbell`) },
      { type: "action", key: "fatigue", label: "Fatigue mode — lactic acid build-up", icon: Activity, variant: "danger" },
    ],
    concepts: [
      "Muscle tissue can only PULL. It contracts, gets shorter and fatter, and hauls its two attachment points together; it cannot push them apart. So a joint that has to move both ways needs two muscles on opposite sides: the biceps flexes the elbow, the triceps extends it, and while one contracts the other relaxes and is stretched. That is an antagonistic pair.",
      "The elbow is a lever with the pivot at the joint. The load hangs about 28 cm from it; the biceps tendon pulls only about 4 cm from it. Because the turning effect τ = F·d must balance on both sides, the muscle has to pull with roughly seven times the load's weight — a 10 kg dumbbell needs close to 700 N of biceps force.",
      "A contracting muscle keeps its volume, so shortening by a third makes it about 20 % wider — the bulge is the same tissue rearranged, not more of it. When it works hard without enough oxygen it respires anaerobically, lactic acid builds up, and its maximum force falls: the arm gives way to an angle it can still hold, and recovers as the lactic acid is cleared.",
    ],
    quiz: [
      {
        question: "You straighten your arm to lower a dumbbell slowly. Which muscle is contracting to control the movement, and what is the biceps doing?",
        options: [
          "The triceps contracts to extend the elbow; the biceps relaxes and is stretched",
          "The biceps contracts to push the forearm straight; the triceps relaxes",
          "Both contract equally — that is what makes the movement slow",
          "Neither contracts; the ligaments extend the joint",
        ],
        answer: 0,
        explanation:
          "No muscle can push. Extending the elbow is the triceps' job: it contracts, pulling on the olecranon behind the joint, while its antagonist the biceps relaxes and lengthens. (In a real slow lowering the biceps also 'brakes' by lengthening under tension, but it is still not pushing.)",
      },
      {
        question: "A 10 kg dumbbell is held with the forearm horizontal. Taking g = 10 N/kg, the load is 28 cm from the elbow and the biceps pulls 4 cm from it. Roughly what force must the biceps produce?",
        options: ["About 700 N", "About 100 N", "About 40 N", "About 2800 N"],
        answer: 0,
        explanation:
          "Balance the turning effects about the elbow: F × 0.04 m = 100 N × 0.28 m, so F = 28 ÷ 0.04 = 700 N. The short muscle lever arm is why muscle forces are so much larger than the loads they hold — and why tendons are built to take it.",
      },
      {
        question: "After many fast curls, the arm can no longer hold the dumbbell up. What has happened in the biceps?",
        options: [
          "Anaerobic respiration has produced lactic acid, which reduces the force the fibres can generate",
          "The muscle has run out of fibres and must grow new ones",
          "The tendon has stretched permanently, so the lever arm is shorter",
          "The triceps has taken over and is pushing the arm down",
        ],
        answer: 0,
        explanation:
          "When the blood cannot deliver oxygen fast enough, the muscle respires anaerobically. Lactic acid accumulates, the pH inside the fibres falls, and the cross-bridges that generate force work less well — fatigue. Rest lets the lactic acid be cleared (the oxygen debt is repaid) and the strength returns.",
      },
    ],
  },
  {
    id: "transpiration",
    category: "biology",
    icon: Leaf,
    title: "Plant Transpiration — Roots, Xylem & Stomata",
    blurb: "How a tree lifts water with no pump: root osmosis, the cohesion–tension column in the xylem, and guard cells that open the stoma to the light",
    syllabus: "Biology 8 · Transport in Plants",
    keywords:
      "transpiration transpiration stream xylem vessel lignin cohesion tension adhesion capillary root hair osmosis water potential stoma stomata guard cell turgor potassium abscisic acid ABA humidity wind light intensity boundary layer vapour pressure deficit cavitation embolism phloem translocation spongy mesophyll palisade epidermis",
    defaults: { light: 70, humidity: 50, wind: 2, soil: "hydrated", speed: 1 },
    controls: [
      { type: "slider", key: "light", label: "Light intensity", min: 0, max: 100, step: 1, format: (v) => (v === 0 ? "0 % · night" : `${v} %`) },
      { type: "slider", key: "humidity", label: "Relative humidity", min: 10, max: 95, step: 1, format: (v) => `${v} % RH` },
      { type: "slider", key: "wind", label: "Wind speed", min: 0, max: 10, step: 0.5, format: (v) => (v === 0 ? "still air" : `${v} m/s`) },
      { type: "choice", key: "soil", label: "Soil moisture", columns: 2, options: SOIL_MOISTURE_OPTIONS },
    ],
    concepts: [
      "There is no pump. Water evaporates from the wet walls of the spongy mesophyll cells and diffuses out of the stomata; that loss pulls on the column of water in the xylem, and because water molecules cling to each other (cohesion) and to the lignified vessel wall (adhesion), the whole unbroken thread is dragged up from the roots — the cohesion–tension theory. The column is under TENSION, typically −1 to −2 MPa at midday, and if it is pulled too hard it snaps: an air bubble (embolism) breaks the vessel.",
      "Stomata are the tap. In light, guard cells pump in K⁺ ions, water follows by osmosis, the cells swell, and because their inner wall is thicker than their outer wall they bow apart and open the pore. In darkness, or when a drought-stressed root sends abscisic acid (ABA) up the stem, the K⁺ is dumped, the cells go flaccid and the pore closes — even in full sun, because losing the water column is worse than missing a morning's photosynthesis.",
      "Once the pore is open the rate depends on the air outside. Dry air (low humidity) has a bigger vapour-pressure deficit, so vapour diffuses out faster; still air lets a skin of saturated vapour build up against the leaf (the boundary layer), which wind strips away. Humid, still, dark conditions — a rainforest night — give almost no transpiration; dry, windy, bright ones give the most, and the most tension.",
    ],
    quiz: [
      {
        question: "A tall tree moves hundreds of litres of water a day to its crown. What actually provides the lifting force?",
        options: [
          "Evaporation at the leaves pulls on a continuous column of water held together by cohesion and to the vessel walls by adhesion",
          "Root pressure pumps the water up from below like a mechanical pump",
          "The xylem vessels contract in waves like a muscle to squeeze the water upwards",
          "Capillary action alone is enough to lift water to the top of any tree",
        ],
        answer: 0,
        explanation:
          "Cohesion–tension: water lost from the mesophyll puts the xylem column under tension, and the hydrogen-bonded column is pulled up as one thread. Root pressure exists but is far too weak to lift water more than a metre or so, and capillarity in xylem-sized vessels manages less than a metre.",
      },
      {
        question: "On a bright day the soil dries out. What happens to the stomata, and why?",
        options: [
          "They close: the roots release abscisic acid, guard cells lose K⁺ and water, go flaccid, and the pore shuts",
          "They open wider to draw more water up from the drying soil",
          "Nothing changes, because stomata respond only to light",
          "They close because the leaf has run out of potassium",
        ],
        answer: 0,
        explanation:
          "Drought overrides light. ABA from the stressed roots travels up in the xylem and triggers K⁺ efflux from the guard cells; without the solute their water potential rises, water leaves by osmosis, turgor drops and the pore closes. Photosynthesis is sacrificed to protect the water column from cavitating.",
      },
      {
        question: "Which combination of conditions gives the HIGHEST rate of transpiration for a plant with open stomata?",
        options: [
          "Low humidity, strong wind, bright light",
          "High humidity, still air, bright light",
          "Low humidity, still air, darkness",
          "High humidity, strong wind, darkness",
        ],
        answer: 0,
        explanation:
          "Low humidity gives the steepest vapour-pressure gradient out of the leaf; wind removes the humid boundary layer that would otherwise slow diffusion; and light keeps the stomata open. Darkness closes them regardless of the weather.",
      },
    ],
  },
  {
    id: "peristalsis",
    category: "biology",
    icon: Sandwich,
    title: "Peristalsis & Digestive Transit",
    blurb: "Circular and longitudinal smooth muscle squeezing a bolus down the gut — and why it still works upside-down",
    syllabus: "Biology 7 · Nutrition & the Alimentary Canal",
    keywords:
      "peristalsis oesophagus esophagus small intestine bolus chyme swallowing smooth muscle circular muscle longitudinal muscle muscularis contraction relaxation wave gravity antiperistalsis lumen mucosa transit digestive tract alimentary canal segmentation sphincter",
    defaults: { swallow: 0, consistency: "soft", orientation: "upright", speed: 1 },
    controls: [
      { type: "action", key: "swallow", label: "Trigger swallow — peristaltic wave", icon: Waves },
      { type: "choice", key: "consistency", label: "Bolus consistency", columns: 1, options: BOLUS_CONSISTENCY_OPTIONS },
      { type: "choice", key: "orientation", label: "Gravity inversion", columns: 2, options: GRAVITY_ORIENTATION_OPTIONS },
    ],
    concepts: [
      "The wall of the gut has two layers of smooth muscle at right angles: an inner CIRCULAR layer whose fibres run round the tube, and an outer LONGITUDINAL layer whose fibres run along it. Neither can push — each can only contract and shorten — so moving food is a matter of WHERE each layer is contracting.",
      "Peristalsis is a travelling wave of coordination. Behind the bolus the circular muscle contracts, narrowing the lumen so the food cannot go back; ahead of it the longitudinal muscle contracts and the circular muscle relaxes, shortening and widening that segment to receive the food. The wave then moves on, a few centimetres a second, and the bolus moves with it.",
      "Because the bolus is squeezed along by the wall, gravity is not needed. Food arrives in the stomach of someone lying flat, hanging upside-down, or an astronaut in free fall; a liquid may run ahead of the wave when gravity helps, but when gravity opposes it the closed ring behind the bolus stops it falling back, and it arrives at exactly the wave's speed. Dry or lumpy food needs slower, stronger waves — which is why it should be chewed.",
    ],
    quiz: [
      {
        question: "During peristalsis, where is the circular muscle contracting relative to the bolus, and what does that achieve?",
        options: [
          "Behind the bolus — it narrows the lumen so the food can only move forward",
          "Ahead of the bolus — it opens the tube to receive the food",
          "Around the bolus itself — it grips the food and carries it",
          "Along the whole length at once — it squeezes the tube flat",
        ],
        answer: 0,
        explanation:
          "The circular layer contracts just behind the bolus, closing the lumen there. Ahead of the bolus it is the longitudinal layer that contracts (shortening and widening the segment) while the circular layer relaxes, so the tube opens in front and shuts behind — a wave that pushes.",
      },
      {
        question: "A student drinks water while doing a handstand and it still reaches the stomach. What does this demonstrate?",
        options: [
          "Food is moved by muscular peristalsis in the gut wall, not by gravity",
          "Water is light enough for gravity not to matter",
          "The oesophagus contains one-way valves every few centimetres",
          "The stomach sucks food in by creating a vacuum",
        ],
        answer: 0,
        explanation:
          "The wave of circular contraction behind the bolus and relaxation ahead of it moves food regardless of which way is up. Gravity can help a liquid along when upright, but it is not what drives transit.",
      },
      {
        question: "Why does a dry, poorly chewed bolus take longer to reach the stomach than a soft, well-chewed one?",
        options: [
          "It resists deforming to the lumen, so the wall must stretch round it and the muscle contracts more slowly and forcefully to push it",
          "Dry food is lighter, so gravity pulls it down less",
          "The oesophagus refuses to swallow dry food until it is wet",
          "Peristaltic waves cannot start until the bolus is liquid",
        ],
        answer: 0,
        explanation:
          "A compliant bolus takes the shape of the tube and slides on the mucus; a hard one distends the wall, which reflexly recruits stronger, slower contractions (and often a second, 'secondary' peristaltic wave). Chewing and saliva make the bolus something the wave can move easily.",
      },
    ],
  },
  {
    id: "carbon_cycle",
    category: "biology",
    icon: Earth,
    title: "The Carbon Cycle & Greenhouse Heat Trapping",
    blurb: "Forest, ocean, cattle and a coal plant under one sky: where the carbon goes, how fast, and what the CO₂ left in the air does to the temperature",
    syllabus: "Biology 9 · Ecosystems & Human Influence",
    keywords:
      "carbon cycle photosynthesis respiration combustion fossil fuel coal decomposition ocean carbonate dissolved carbon dioxide CO2 methane CH4 livestock deforestation forest cover greenhouse effect greenhouse gas longwave infrared shortwave radiation albedo radiative forcing global warming temperature anomaly climate change ppm gigatonne carbon sink source solar cycle",
    defaults: { combustion: 100, forest: 60, solar: 50, longwave: false, reset: 0, speed: 1 },
    controls: [
      { type: "slider", key: "combustion", label: "Fossil fuel combustion rate", min: 0, max: 500, step: 5, format: (v) => (v === 0 ? "0 % · shut down" : `${v} % · ${((FOSSIL_GTC_PER_YEAR * v) / 100).toFixed(1)} GtC/yr`) },
      { type: "slider", key: "forest", label: "Global forest cover", min: 10, max: 100, step: 1, format: (v) => `${v} % forest · ${100 - v} % pasture` },
      { type: "slider", key: "solar", label: "Solar activity cycle", min: 0, max: 100, step: 1, format: (v) => solarLabel(v) },
      { type: "toggle", key: "longwave", label: "Photon filter: re-radiated longwave IR (off = shortwave sunlight)" },
      { type: "action", key: "reset", label: "Reset to present day · 420 ppm", icon: RotateCcw, variant: "ghost" },
    ],
    concepts: [
      "Carbon moves round a loop. Photosynthesis takes about 120 gigatonnes of carbon a year out of the air into plants; respiration and decay put almost all of it back. The ocean swaps a similar amount with the air across its surface. Left alone this loop is BALANCED — for ten thousand years before industry the air sat at 280 ppm — and the tiny net flows today (the land and sea each soaking up 2–3 GtC/yr more than they give) only exist because the air is now richer in CO₂ than the plants and water below it.",
      "Fossil fuels break the loop. Coal, oil and gas are carbon that photosynthesis buried 300 million years ago and the cycle forgot; burning them adds ~10 GtC/yr from OUTSIDE the loop, and clearing forest for pasture adds more (and cattle add methane, a stronger greenhouse gas). The sinks cannot keep up, so about half of what is emitted stays in the air: +2.3 ppm every year. Planting every acre with forest helps, but the chart shows it cannot on its own offset the furnaces.",
      "Sunlight is mostly short-wavelength (visible) light, and the atmosphere is transparent to it — it passes straight through to warm the ground. The warm ground re-radiates LONG-wavelength infrared, and CO₂ and CH₄ molecules absorb that. They re-emit it in all directions, so about half comes back down: the greenhouse effect. More CO₂ traps a larger share, with diminishing returns (each DOUBLING of CO₂ adds the same ~3 °C at equilibrium), and the deep ocean's heat capacity means the surface lags the forcing by decades — warming already in the pipeline continues after the dials stop moving. Flip the photon filter to watch each kind of light separately.",
    ],
    quiz: [
      {
        question: "Sunlight passes through the atmosphere easily, but the Earth still warms when CO₂ rises. Why?",
        options: [
          "The ground re-radiates energy as longwave infrared, which CO₂ and CH₄ absorb and re-emit — about half of it back down",
          "CO₂ reflects incoming sunlight back towards the ground before it can escape",
          "CO₂ is a dark gas that heats up in the sun and warms the air by contact",
          "CO₂ makes the atmosphere thinner, so more sunlight reaches the ground",
        ],
        answer: 0,
        explanation:
          "Shortwave visible light is not absorbed by CO₂; the warm surface's longwave infrared is. Greenhouse gases absorb that outgoing radiation and re-emit it in every direction, so part of the energy that would have escaped to space returns to the surface — the same photons the longwave filter shows being caught in the greenhouse layer.",
      },
      {
        question: "Photosynthesis removes far more carbon from the air each year than all fossil fuel burning adds. Why does CO₂ still rise?",
        options: [
          "Respiration and decay return almost all of what photosynthesis fixed, so the cycle is nearly closed — fossil carbon is an addition from outside that loop",
          "Plants only photosynthesise in summer, so on average they remove less than they release",
          "Photosynthesis is slowing down because the air is too polluted",
          "The carbon in fossil fuels is a different kind that plants cannot absorb",
        ],
        answer: 0,
        explanation:
          "The 120 GtC/yr of photosynthesis is matched by ~117 GtC/yr of respiration and decomposition; the NET land sink is only ~3 GtC/yr. Fossil combustion (~10 GtC/yr) is new carbon that was locked out of the cycle for hundreds of millions of years, and only about half of it can be soaked up by the land and ocean sinks — the rest accumulates.",
      },
      {
        question: "You cut fossil fuel combustion to zero, yet the temperature readout keeps rising for years. What explains this?",
        options: [
          "The ocean's heat capacity means the surface has not yet caught up with the warming the CO₂ already in the air commits it to",
          "The temperature readout is broken — with no emissions it should fall immediately",
          "Forests keep releasing stored heat for decades after emissions stop",
          "The Sun gets hotter to compensate for the missing CO₂",
        ],
        answer: 0,
        explanation:
          "Radiative forcing depends on the CO₂ concentration, which stays high after emissions stop; the surface temperature relaxes towards its equilibrium over decades because heating the oceans takes time. That gap between the realised anomaly and the equilibrium anomaly is the 'warming in the pipeline' the readout reports.",
      },
    ],
  },
  {
    id: "food_chain_pyramid",
    category: "biology",
    icon: Pyramid,
    title: "Food Chains & the 10 % Energy Pyramid",
    blurb: "Oak leaves → caterpillars → blue tits → sparrowhawk: why nine-tenths of the energy is lost at every link, why apex predators are rare, and why a poison gets stronger up the chain",
    syllabus: "Biology 9 · Energy Flow in Ecosystems",
    keywords:
      "food chain food web energy pyramid trophic level producer primary consumer secondary consumer tertiary apex predator herbivore carnivore ten percent rule energy transfer efficiency heat loss respiration biomass pyramid of numbers chain length bioaccumulation biomagnification DDT microplastics persistent toxin trophic cascade keystone predator sparrowhawk blue tit caterpillar oak",
    defaults: { insolation: 100, toxin: 0, cascade: 0, speed: 1 },
    controls: [
      { type: "slider", key: "insolation", label: "Primary solar insolation", min: 50, max: 150, step: 5, format: (v) => `${v} % · ${Math.round((PRODUCER_KJ_AT_FULL_SUN * v) / 100).toLocaleString()} kJ fixed` },
      { type: "action", key: "toxin", label: "Introduce persistent bioaccumulative toxin", icon: Biohazard, variant: "danger" },
      { type: "action", key: "cascade", label: "Apex predator removal / trophic cascade", icon: Skull, variant: "ghost" },
    ],
    concepts: [
      "Only about 10 % of the energy stored in one trophic level becomes stored energy in the next. The rest — 90 % — is used by the organisms themselves (respiration, movement, keeping warm), lost as heat, left uneaten (roots, bones, feathers) or passed out undigested, and none of that is available to whatever eats them. So 10 000 kJ in the oak leaves becomes 1 000 kJ of caterpillar, 100 kJ of blue tit and 10 kJ of sparrowhawk — and since each animal up the chain is bigger and needs more, the headcounts fall even faster: half a million leaves feed a single hawk.",
      "That is why food chains are short. A fifth link would receive a tenth of the hawk's 10 kJ — 1 kJ — which is less than one of any larger predator needs to stay alive, so there is nothing for it to be. Dim the sun and even the fourth link fails: the sparrowhawk is the rarest thing in the wood precisely because it lives on one part in a thousand of what the leaves captured. Apex predators are few, wide-ranging and the first to disappear when the base of the pyramid shrinks.",
      "A toxin that dissolves in fat and is not broken down (DDT, mercury, some microplastics) is NOT lost with the 90 %. Every kilojoule of blue tit was ten kilojoules of caterpillar, and the toxin in all ten came along and stayed. So the concentration per gram of tissue multiplies by about ten at every link — biomagnification — and a trace on the leaves is an egg-shell-thinning dose in the birds and a lethal one in the hawk. Removing the hawk, by poison or otherwise, sets off a trophic cascade: its prey booms, their prey is eaten down, and the leaves recover.",
    ],
    quiz: [
      {
        question: "The oak leaves in a wood store 10 000 kJ of energy. Roughly how much ends up stored in the sparrowhawk at the top of a four-link chain, and why?",
        options: [
          "About 10 kJ — roughly 90 % is lost at each of the three transfers as heat, movement, waste and uneaten material",
          "About 10 000 kJ — energy is conserved, so all of it reaches the top",
          "About 5 000 kJ — each animal eats half of what is below it",
          "About 1 000 kJ — only the first transfer loses any energy",
        ],
        answer: 0,
        explanation:
          "Each transfer passes on about 10 %: 10 000 → 1 000 → 100 → 10 kJ. Energy is conserved overall, but most of it leaves the food chain as heat from respiration and as material that is never eaten or never digested — it is not destroyed, just unavailable to the next level.",
      },
      {
        question: "Why are there so few sparrowhawks in a wood full of caterpillars, and why is there no animal that lives by eating sparrowhawks?",
        options: [
          "Each level gets only a tenth of the energy below it, so by the fourth link there is barely enough for one predator and a fifth link would starve",
          "Sparrowhawks are hunted by people, which keeps their numbers down",
          "Predators are always rare because they choose large territories",
          "There is a law that food chains can only ever have four organisms",
        ],
        answer: 0,
        explanation:
          "The 10 % rule sets the chain's length. By the top of the pyramid the energy available is tiny, and bigger animals need more of it, so the apex population is small; one more link would receive less energy than a single individual needs, so it cannot exist.",
      },
      {
        question: "A pesticide is sprayed at 0.01 ppm on the leaves. Blue tits are found with 1 ppm and the sparrowhawk with 10 ppm in their fat. What is happening?",
        options: [
          "Biomagnification: the toxin is retained while 90 % of the energy is lost at each link, so its concentration multiplies by about ten per level",
          "Birds make their own pesticide from the chemicals in caterpillars",
          "The hawk has been sprayed directly and more heavily than the leaves",
          "Larger animals simply have more fat, so the concentration looks higher",
        ],
        answer: 0,
        explanation:
          "A persistent fat-soluble toxin is not excreted or broken down. Each animal eats roughly ten times its own stored energy's worth of food from below and keeps the toxin from all of it, so concentration rises about tenfold per link — exactly the reciprocal of the energy transfer efficiency. Top predators like birds of prey are hit hardest, which is how DDT thinned raptor eggshells.",
      },
    ],
  },
  {
    id: "flower_pollination",
    category: "biology",
    icon: Flower2,
    title: "Flower Anatomy, Pollination & Pollen Tube Growth",
    blurb: "A flower cut down the middle: a bee or the wind delivers a grain to the stigma (pollination), then a tube grows down the style for hours to fuse nuclei in the ovule (fertilisation) — two different events, and the scene keeps them apart",
    syllabus: "Biology 8 · Reproduction in Plants",
    keywords:
      "flower pollination fertilisation fertilization pollen grain stigma style ovary ovule micropyle anther filament stamen carpel pistil petal sepal nectar wind-pollinated insect-pollinated pollen tube tube nucleus generative nucleus sperm nuclei egg cell polar nuclei zygote endosperm double fertilisation diploid triploid seed",
    defaults: { vector: "insect", pollinate: 0, time: 0, speed: 1 },
    controls: [
      { type: "choice", key: "vector", label: "Pollination vector", columns: 2, options: POLLINATION_VECTOR_OPTIONS },
      { type: "action", key: "pollinate", label: "Trigger pollination — deliver a grain to the stigma", icon: Flower2 },
      { type: "slider", key: "time", label: "Time — pollen tube growth", min: 0, max: TIMELINE_SECONDS, step: 0.1, format: (v) => timeLabel(v) },
    ],
    concepts: [
      "POLLINATION is a delivery: a pollen grain from an anther lands on a stigma. It is over in a moment and involves no fusion of anything. A wind-pollinated flower makes millions of small, smooth, dry grains and holds a feathery stigma out in the air to sieve them; an insect-pollinated flower makes fewer, larger, spiky and sticky grains, and pays a courier with nectar, scent and bright petals to carry them from anther to a sticky stigma inside the flower.",
      "FERTILISATION is a fusion, and it happens hours later and a centimetre away. The grain absorbs water from the stigma and grows a pollen tube down through the style at about 1.5 mm per hour, steered towards the ovary. Three nuclei travel in it: the tube nucleus at the tip, and a generative nucleus that divides on the way into two sperm nuclei (n). The tube enters the ovule through a tiny gap in its coat — the micropyle — and delivers both sperm into the embryo sac.",
      "Flowering plants fertilise twice. One sperm nucleus fuses with the egg cell to make the zygote (2n), which becomes the embryo; the other fuses with the two polar nuclei to make the endosperm (3n), the food store the seed will pack around it. The ovule becomes the seed and the ovary becomes the fruit. Move the time slider back and forth: the flower is pollinated as soon as the grain lands, but not fertilised until the last stage.",
    ],
    quiz: [
      {
        question: "A bee brushes pollen from an anther onto the stigma of another flower. Which statement is correct?",
        options: [
          "The flower is now pollinated, but not yet fertilised — fertilisation needs a pollen tube to reach the ovule and nuclei to fuse",
          "The flower is now fertilised, because pollen has reached the female part",
          "The flower is neither pollinated nor fertilised until a seed forms",
          "Pollination and fertilisation are two names for the same event",
        ],
        answer: 0,
        explanation:
          "Pollination is the transfer of pollen to the stigma; fertilisation is the fusion of a sperm nucleus with the egg cell inside the ovule. The second needs a pollen tube to grow the length of the style first, which takes hours.",
      },
      {
        question: "Which set of features tells you a flower is wind-pollinated?",
        options: [
          "Small dull petals, large dangling anthers, feathery stigmas outside the flower, huge numbers of light smooth pollen grains",
          "Large bright petals, nectar and scent, sticky stigma inside the flower, spiky pollen",
          "No stamens at all, only a large ovary",
          "Petals that close at night to trap insects",
        ],
        answer: 0,
        explanation:
          "Wind cannot be attracted or rewarded, so wind-pollinated flowers invest in quantity and exposure: anthers and stigmas hang outside the flower, the pollen is light and smooth so it blows, and there are millions of grains because almost all miss.",
      },
      {
        question: "Why is fertilisation in flowering plants called 'double fertilisation'?",
        options: [
          "One sperm nucleus fuses with the egg cell to form the 2n zygote, and a second fuses with the two polar nuclei to form the 3n endosperm",
          "Two pollen grains must land on the stigma for one seed to form",
          "The egg cell is fertilised once by wind pollen and once by insect pollen",
          "The zygote divides in two immediately after fertilisation",
        ],
        answer: 0,
        explanation:
          "The generative nucleus divides into two sperm nuclei on the way down the pollen tube. Both are delivered through the micropyle: one makes the embryo (zygote, diploid), the other makes the endosperm (triploid) that feeds it in the seed.",
      },
    ],
  },
  {
    id: "bacteria_vs_virus",
    category: "biology",
    icon: Bug,
    title: "Bacteria vs Virus — Anatomy & the Lytic Cycle",
    blurb: "A bacillus and a T4 phage side by side: which one is alive, which parts an antibiotic can hit, and why penicillin bursts one and falls straight past the other",
    syllabus: "Biology 9 · Microorganisms & Disease",
    keywords:
      "bacteria bacterium virus bacteriophage T4 phage prokaryote cell wall peptidoglycan cell membrane cytoplasm circular DNA chromosome plasmid 70S ribosome flagellum capsid head DNA core contractile sheath baseplate tail fibres lytic cycle attachment injection replication assembly lysis burst size antibiotic penicillin tetracycline antibiotic resistance living non-living pathogen infection",
    defaults: { antibiotic: 0, lytic: 0, speed: 1 },
    controls: [
      { type: "action", key: "antibiotic", label: "Administer penicillin / antibiotics", icon: Pill, variant: "danger" },
      { type: "action", key: "lytic", label: "Trigger viral lytic cycle", icon: Bug },
    ],
    concepts: [
      "A bacterium is a living cell. It has a peptidoglycan cell wall, a membrane, cytoplasm in which it respires and makes its own proteins on 70S ribosomes, a single circular chromosome loose in the cytoplasm (no nucleus), often small extra rings of DNA called plasmids, and sometimes a flagellum. It grows, responds to its surroundings and reproduces on its own by splitting in two. A virus has none of that: a T4 bacteriophage is a protein capsid round a length of DNA, with a contractile sheath, a baseplate and tail fibres — a particle, not a cell, and not alive by any of the criteria.",
      "Because a virus has no metabolism, it can only reproduce inside a cell — the LYTIC CYCLE. The tail fibres recognise receptors on one kind of bacterium; the baseplate docks; the sheath contracts like a syringe and drives the core through the wall, injecting the DNA. The phage genes take over the host's ribosomes, the host chromosome is degraded, and the cell is turned into a factory that assembles new heads, tails and fibres. Finally a phage enzyme (lysozyme) breaks the wall and the cell bursts, releasing about 150 new phages: the burst size.",
      "Antibiotics work by hitting parts a bacterial cell has and human cells do not: penicillin blocks the enzyme that cross-links the peptidoglycan wall, so the wall shreds and the cell bursts under its own osmotic pressure; tetracycline jams the 70S ribosome. A virus has no wall and no ribosomes — nothing for the drug to bind to — so antibiotics have zero effect on viral infections, and taking them for one does nothing except breed resistance in the bacteria you do carry. Vaccines and antiviral drugs are the tools for viruses.",
    ],
    quiz: [
      {
        question: "Why does penicillin cure a bacterial infection but do nothing for a cold or flu?",
        options: [
          "Penicillin blocks peptidoglycan wall building, and viruses have no cell wall — there is nothing for the drug to act on",
          "Viruses are too small for the penicillin molecules to reach",
          "Viruses hide inside the nucleus of the bacterium where penicillin cannot enter",
          "Penicillin only works in the lungs, and colds are in the nose",
        ],
        answer: 0,
        explanation:
          "Every antibiotic targets a structure or process of a bacterial cell — the wall, the 70S ribosome, DNA copying. A virus is a protein coat round genetic material with none of those, so it is untouched; it borrows the machinery of the cells it infects.",
      },
      {
        question: "Which feature is found in a bacterium but NOT in a virus?",
        options: [
          "Ribosomes and a cell membrane",
          "Genetic material",
          "A protein coat",
          "The ability to evolve",
        ],
        answer: 0,
        explanation:
          "Both carry genetic material and both evolve, and a phage's capsid is a protein coat. Only the bacterium is a cell, with a membrane, cytoplasm, ribosomes and its own metabolism — which is exactly what makes it 'alive' and what antibiotics attack.",
      },
      {
        question: "Put the lytic cycle in order.",
        options: [
          "Attachment → genome injection → host takeover → virion assembly → lysis",
          "Lysis → attachment → assembly → injection → takeover",
          "Injection → attachment → lysis → assembly → takeover",
          "Assembly → injection → attachment → takeover → lysis",
        ],
        answer: 0,
        explanation:
          "The phage must first bind its host's receptors, then inject its DNA; only then can the phage genes hijack the ribosomes, build new virions, and finally burst the cell to release them.",
      },
    ],
  },
  {
    id: "mitosis_meiosis",
    category: "biology",
    icon: Split,
    title: "Mitosis & Meiosis — Spindle Mechanics & Crossing Over",
    blurb: "A 2n = 4 cell with red maternal and blue paternal chromatids, stepped through division: watch sister chromatids part in mitosis, homologues pair, swap arms at chiasmata and part in meiosis I, and sisters finally part in meiosis II — or poison the spindle and see why nothing moves",
    syllabus: "Biology 17 · Inheritance · Cell Division",
    keywords:
      "mitosis meiosis cell division chromosome chromatid sister chromatids homologous chromosomes homologues bivalent tetrad centromere kinetochore spindle microtubule centrosome centriole prophase metaphase anaphase telophase cytokinesis interphase G2 S phase replication diploid haploid 2n n ploidy gamete equational reductional crossing over chiasma chiasmata recombination synapsis independent assortment genetic variation diversity colchicine spindle poison metaphase arrest cleavage furrow nuclear envelope",
    defaults: { mode: "mitosis", stage: 0, playing: true, chiasmata: 2, colchicine: 0, speed: 1 },
    controls: [
      { type: "choice", key: "mode", label: "Mode", columns: 1, options: DIVISION_MODE_OPTIONS, patch: (mode) => ({ mode, stage: 0 }) },
      {
        type: "stepper",
        key: "stage",
        playKey: "playing",
        label: "Stage stepper",
        stages: (p) => stagesFor(p.mode),
        locked: (p) => (colchicineApplied(p.colchicine) ? arrestIndexFor(p.mode) : null),
        playLabel: "Step-by-step",
        pauseLabel: "Auto-play · on",
      },
      {
        type: "slider",
        key: "chiasmata",
        label: "Chiasma crossing-over frequency",
        min: 0,
        max: MAX_CHIASMATA,
        step: 1,
        format: (v) => (v === 0 ? "0 · no crossing over" : `${v} crossover event${v === 1 ? "" : "s"}`),
        when: (p) => p.mode === "meiosis",
      },
      { type: "action", key: "colchicine", label: "Colchicine — spindle poison (press again to wash out)", icon: Syringe, variant: "danger" },
    ],
    concepts: [
      "Two words students swap: SISTER CHROMATIDS are the two identical copies of one chromosome, made in S phase and joined at the centromere — same colour, same alleles, one chromosome until they part. HOMOLOGOUS CHROMOSOMES are the two different members of a pair, one from each parent (red and blue here), carrying the same genes but possibly different alleles. Count centromeres to count chromosomes: a cell with 2n = 4 has four chromosomes and eight chromatids after replication, and still four chromosomes when they are lined up on the plate.",
      "Mitosis is EQUATIONAL: one division, sister chromatids pulled apart by kinetochore microtubules shortening towards the centrosomes, two nuclei each with 2n = 4, two genetically identical cells. Meiosis is REDUCTIONAL: in prophase I the homologues pair up (synapsis) into bivalents, non-sister chromatids cross over at chiasmata and exchange arms, and anaphase I separates the HOMOLOGUES — the sisters stay together, so each daughter has n = 2 chromosomes that are still two chromatids each. Meiosis II is then a mitosis-like division with no replication before it: sisters part, and four haploid gametes result, none of them identical.",
      "Genetic diversity comes from two sources in meiosis I. Independent assortment — which way round each bivalent faces the poles is random, 2ⁿ combinations — and crossing over, which makes recombinant chromatids that neither parent had. The spindle is what makes any of it happen: colchicine stops tubulin polymerising, the kinetochore fibres cannot form or hold, the chromosomes never align and the spindle checkpoint keeps the cell at metaphase for good. That is why it is used to double chromosome numbers in plant breeding, and why a related drug stops tumour cells dividing.",
    ],
    quiz: [
      {
        question: "A cell with 2n = 4 is in metaphase of mitosis. How many chromosomes and how many chromatids does it contain?",
        options: ["4 chromosomes, 8 chromatids", "8 chromosomes, 8 chromatids", "4 chromosomes, 4 chromatids", "2 chromosomes, 4 chromatids"],
        answer: 0,
        explanation:
          "The DNA was replicated in S phase, so each of the four chromosomes is two sister chromatids joined at one centromere — eight chromatids, but still four chromosomes. Only when the centromeres split in anaphase do the chromatids become chromosomes in their own right.",
      },
      {
        question: "What is pulled apart in anaphase I of meiosis, and what does that do to the chromosome number?",
        options: [
          "Homologous chromosomes are separated; each daughter nucleus gets one of each pair (n), still made of two chromatids",
          "Sister chromatids are separated; each daughter nucleus keeps 2n chromosomes",
          "Homologous chromosomes are separated; each daughter nucleus gets 2n chromosomes",
          "Nothing is separated until meiosis II",
        ],
        answer: 0,
        explanation:
          "Meiosis I is the reductional division: the bivalent splits into its two homologues, one to each pole, halving the chromosome number to n. The sister chromatids stay joined until anaphase II, which is why the cells after meiosis I have n chromosomes each made of two chromatids.",
      },
      {
        question: "Colchicine is added to dividing cells. Which stage do they accumulate at, and why?",
        options: [
          "Metaphase — without microtubules there is no spindle to align the chromosomes or satisfy the checkpoint, so anaphase never starts",
          "Anaphase — the chromatids separate but cannot travel without microtubules",
          "Prophase — the nuclear envelope cannot break down",
          "Cytokinesis — the contractile ring is made of microtubules",
        ],
        answer: 0,
        explanation:
          "Colchicine binds tubulin and stops microtubules assembling. Kinetochores are never captured, the chromosomes drift instead of lining up, and the spindle checkpoint holds the cell in a 'c-metaphase'. The contractile ring is actin, not tubulin, but it never gets its cue.",
      },
    ],
  },
  {
    id: "cardiac_cycle",
    category: "biology",
    icon: HeartPulse,
    title: "Cardiac Cycle & 4-Chambered Heart Hemodynamics",
    blurb: "A sectioned four-chamber heart beating beside its own Wiggers diagram: the ECG's P–QRS–T, the four valves slamming and swinging, chamber volumes and pressures, and the lub-dub — at any rate from 40 to 180, in sinus rhythm, fibrillation or with a stenosed aortic valve",
    syllabus: "Biology 9 · Transport in Animals · The Heart",
    keywords:
      "heart cardiac cycle atrium atria ventricle ventricles right left atrial systole ventricular systole diastole isovolumetric contraction relaxation ejection filling valve tricuspid mitral bicuspid aortic pulmonary semilunar atrioventricular lub dub S1 S2 heart sounds phonocardiogram murmur ECG electrocardiogram P wave QRS complex T wave SA node sinoatrial pacemaker AV node bundle of His Purkinje fibres conduction Wiggers diagram pressure volume stroke volume cardiac output ejection fraction heart rate bpm ventricular fibrillation defibrillator aortic stenosis pressure gradient aorta vena cava pulmonary artery pulmonary vein",
    defaults: { bpm: 75, pathology: "normal", stage: 0, playing: true, speed: 1 },
    controls: [
      { type: "slider", key: "bpm", label: "Heart rate", min: MIN_BPM, max: MAX_BPM, step: 1, format: formatBpm },
      { type: "choice", key: "pathology", label: "Pathology mode", columns: 1, options: CARDIAC_PATHOLOGY_OPTIONS },
      {
        type: "stepper",
        key: "stage",
        playKey: "playing",
        label: "Playback · phase of the beat",
        stages: CARDIAC_STAGE_OPTIONS,
        playLabel: "Step-by-step",
        pauseLabel: "Continuous · real-time",
      },
    ],
    concepts: [
      "One beat is a sequence of pressure changes that open and shut four one-way valves. The SA node fires (P wave) and the atria contract, topping up ventricles that are already mostly full. The impulse waits at the AV node, then races down the bundle of His and Purkinje fibres (QRS); the ventricles contract, pressure inside them shoots above atrial pressure and the tricuspid and mitral valves slam shut — S1, 'lub'. For a moment every valve is closed and the volume cannot change: isovolumetric contraction.",
      "When ventricular pressure passes the pressure in the aorta and pulmonary artery, the semilunar valves are pushed open and blood is ejected — about 70 mL from each ventricle at rest, the stroke volume. The ventricles repolarise (T wave), relax, their pressure falls below the arteries' and the aortic and pulmonary valves snap shut — S2, 'dub' — leaving the dicrotic notch on the aortic trace. Pressure keeps falling with the volume fixed (isovolumetric relaxation) until it drops below atrial pressure and the AV valves open again for filling. Cardiac output = stroke volume × heart rate.",
      "Raising the rate shortens diastole far more than systole, so at 180 bpm the ventricles barely have time to fill and stroke volume falls even as output rises. Ventricular fibrillation is what happens when the Purkinje system's order is lost: the myocardium fires chaotically, the walls quiver, no pressure is generated, no valve shuts cleanly, there are no heart sounds — and only a defibrillator can reset it. Aortic stenosis stiffens the aortic leaflets: the left ventricle must generate 60–90 mmHg more than reaches the aorta, its wall thickens, and the turbulent jet through the narrowed valve is heard as an ejection murmur between S1 and S2.",
    ],
    quiz: [
      {
        question: "What causes the first heart sound, S1 ('lub')?",
        options: [
          "The tricuspid and mitral valves closing as ventricular pressure rises above atrial pressure at the start of ventricular systole",
          "The aortic and pulmonary valves closing at the end of ventricular systole",
          "The atria contracting",
          "Blood hitting the wall of the aorta",
        ],
        answer: 0,
        explanation:
          "As soon as the ventricles begin to contract their pressure exceeds the atria's, and the AV valves are forced shut. S2 is the semilunar valves shutting when ventricular pressure falls below arterial pressure; it marks the end of ejection and the start of isovolumetric relaxation.",
      },
      {
        question: "During isovolumetric contraction, ventricular pressure is rising steeply but ventricular volume does not change. Why?",
        options: [
          "The AV valves have shut and the semilunar valves have not yet opened, so no blood can enter or leave",
          "The ventricle walls are rigid at this moment",
          "The atria are refilling the ventricles at exactly the rate blood is ejected",
          "The aorta is full and cannot accept more blood",
        ],
        answer: 0,
        explanation:
          "Both sets of valves are closed: pressure is above atrial pressure (AV valves shut) but still below aortic pressure (semilunar valves shut). The muscle tightens around a fixed volume of blood until pressure passes the aortic pressure and the valve opens — ejection begins.",
      },
      {
        question: "Stroke volume is 70 mL and the heart rate is 75 bpm. What is the cardiac output, and roughly how does it change at 180 bpm?",
        options: [
          "5.25 L/min; at 180 bpm the output rises but less than proportionally, because the shortened diastole cuts the stroke volume",
          "5.25 L/min; at 180 bpm the output is exactly 2.4 times greater",
          "0.93 L/min; it does not change with rate",
          "70 L/min; it halves",
        ],
        answer: 0,
        explanation:
          "Cardiac output = stroke volume × heart rate = 0.07 L × 75 = 5.25 L/min. Filling time shrinks fastest as the rate climbs, so the ventricles start systole less full: stroke volume drops and the output at 180 bpm is well under 2.4 × 5.25 L/min.",
      },
    ],
  },
  // ═══ Computer Science ══════════════════════════════════════════════
  {
    id: "binary_tree",
    category: "cs",
    icon: GitBranch,
    title: "3D Binary Search Tree & AVL Operations",
    blurb: "Node insertion, deletion, searching & tree traversals",
    syllabus: "Computer Science 4.1 · Data Structures",
    keywords:
      "binary search tree bst avl tree data structure node traversal in-order pre-order post-order balance height algorithm graph computer science",
    // This scene ships its own controls, so the shared parameter HUD would
    // only sit on top of them.
    ownHud: true,
    defaults: {},
    controls: [],
    concepts: [
      "A Binary Search Tree (BST) maintains nodes such that every left descendant is smaller and right descendant is larger.",
      "Tree traversals visit nodes systematically: In-order (left, root, right) yields sorted order; Pre-order is used for cloning; Post-order is used for deletion.",
      "Search and insertion run in O(log n) time on balanced trees, but degrade to O(n) if the tree becomes unbalanced — insert values in ascending order with balancing off and the tree becomes a linked list.",
      "An AVL tree keeps every node's two subtree heights within 1 of each other, rotating whenever an insert breaks that rule. A rotation rearranges three subtrees without disturbing the ordering, so the search property survives it untouched.",
    ],
    quiz: [
      {
        question: "Which traversal of a Binary Search Tree produces values in sorted ascending order?",
        options: ["In-order traversal", "Pre-order traversal", "Post-order traversal", "Level-order traversal"],
        answer: 0,
        explanation:
          "In-order traversal visits left subtree, root, then right subtree. Since all left values are smaller and right values are larger, this yields sorted ascending order.",
      },
      {
        question: "What is the worst-case time complexity of searching a value in an unbalanced Binary Search Tree with N nodes?",
        options: ["O(N)", "O(log N)", "O(1)", "O(N log N)"],
        answer: 0,
        explanation:
          "In a degenerate (unbalanced) BST where nodes form a single linear chain, finding a value requires visiting all N nodes, giving O(N) worst-case time.",
      },
    ],
  },
  {
    id: "sorting",
    category: "cs",
    icon: ArrowUpDown,
    title: "Sorting Algorithms in 3D",
    blurb: "Watching comparisons and swaps add up to a complexity class",
    syllabus: "Computer Science 4.2 · Algorithms",
    keywords:
      "sorting algorithm bubble insertion selection quicksort merge sort comparison swap time complexity big o notation stable divide and conquer pivot partition efficiency",
    defaults: {
      algorithm: "bubble",
      size: 22,
      speed: 1.0,
      running: true,
      shuffle: 0,
      restart: 0,
      showValues: false,
      spin: false,
    },
    controls: [
      { type: "choice", key: "algorithm", label: "Algorithm", columns: 3, options: ALGORITHM_OPTIONS },
      { type: "slider", key: "size", label: "Array size n", min: 5, max: 44, step: 1, format: (v) => `${v} elements` },
      { type: "slider", key: "speed", label: "Playback speed", min: 0.1, max: 4, step: 0.1, format: (v) => `${v.toFixed(1)}×` },
      { type: "toggle", key: "running", label: "Run" },
      { type: "toggle", key: "showValues", label: "Show values" },
      { type: "toggle", key: "spin", label: "Orbit camera" },
      { type: "action", key: "restart", label: "Replay from the start", icon: RotateCcw },
      { type: "action", key: "shuffle", label: "Shuffle new array", icon: Shuffle, variant: "ghost" },
    ],
    concepts: [
      "Bubble, insertion and selection sort all compare every element against many others, so the work grows as n² — doubling the array roughly quadruples the comparisons. Quicksort and merge sort divide the problem in half repeatedly and grow as n log n instead.",
      "Complexity is about growth, not a single measurement. At n = 10 the difference barely shows; the same two algorithms at n = 1,000,000 differ by a factor of tens of thousands, which is why the notation ignores constants entirely.",
      "A sort is stable if equal elements keep their original relative order. Bubble, insertion and merge sort are stable; selection sort and quicksort are not, because both move elements across long distances in a single swap.",
    ],
    quiz: [
      {
        question:
          "Bubble sort is run on an array that is already in ascending order. How many passes does an optimised implementation make?",
        options: [
          "One — it detects that no swaps occurred and stops",
          "n passes, the same as any other array",
          "n² passes, its worst case",
          "None — it checks the array is sorted without any comparisons",
        ],
        answer: 0,
        explanation:
          "The optimised version tracks whether any swap happened during a pass. On sorted input the first pass makes n−1 comparisons, swaps nothing, and the algorithm exits — giving bubble sort its O(n) best case.",
      },
      {
        question:
          "Merge sort is O(n log n) in every case, while quicksort is O(n log n) on average but O(n²) at worst. What causes quicksort's worst case?",
        options: [
          "Pivots that repeatedly split the array into one element and the rest",
          "Arrays containing duplicate values",
          "Running out of space for the temporary array",
          "Arrays whose length is not a power of two",
        ],
        answer: 0,
        explanation:
          "Quicksort depends on its pivot roughly halving the array. If every pivot turns out to be the smallest or largest remaining value — which naive pivot choice hits on already-sorted input — the recursion depth becomes n instead of log n, giving n² comparisons.",
      },
    ],
  },

  // ═══ Mathematics ═══════════════════════════════════════════════════
  {
    id: "gradient",
    category: "math",
    icon: TrendingDown,
    title: "Gradient Descent on a Loss Surface",
    blurb: "How learning rate and momentum decide whether training converges",
    syllabus: "Mathematics 5.2 · Optimisation",
    keywords:
      "gradient descent optimisation loss surface learning rate momentum partial derivative slope local minimum global minimum convex machine learning training convergence divergence saddle point",
    defaults: {
      surface: "bowl",
      rate: 0.12,
      momentum: 0.6,
      startX: -2.6,
      startZ: 2.4,
      running: true,
      reset: 0,
      showGradient: true,
      spin: false,
    },
    controls: [
      { type: "choice", key: "surface", label: "Loss surface", columns: 2, options: SURFACE_OPTIONS },
      { type: "slider", key: "rate", label: "Learning rate α", min: 0.01, max: 0.9, step: 0.01, format: (v) => v.toFixed(2) },
      { type: "slider", key: "momentum", label: "Momentum β", min: 0, max: 0.95, step: 0.05, format: (v) => (v === 0 ? "none" : v.toFixed(2)) },
      { type: "slider", key: "startX", label: "Start x", min: -3, max: 3, step: 0.1, format: (v) => v.toFixed(1) },
      { type: "slider", key: "startZ", label: "Start z", min: -3, max: 3, step: 0.1, format: (v) => v.toFixed(1) },
      { type: "toggle", key: "running", label: "Run descent" },
      { type: "toggle", key: "showGradient", label: "Show −∇f arrow" },
      { type: "toggle", key: "spin", label: "Orbit camera" },
      { type: "action", key: "reset", label: "Restart from start point", icon: RotateCcw },
    ],
    concepts: [
      "Each step moves against the gradient: xₙ₊₁ = xₙ − α∇f(xₙ). The gradient points straight uphill, so its negative is the steepest way down from where you are standing.",
      "The learning rate α is a trade-off, not a setting to maximise. Too small and it crawls; too large and each step overshoots the minimum by more than it began with, so the loss grows and the run diverges.",
      "Descent only ever finds a local minimum. On the four-well surface the answer you get depends entirely on where you started — only a convex surface like the bowl guarantees there is just one minimum to find.",
    ],
    quiz: [
      {
        question:
          "Training diverges: the loss grows larger every step until it overflows. Which single change is most likely to fix it?",
        options: [
          "Decrease the learning rate",
          "Increase the learning rate",
          "Increase the momentum",
          "Start from a different random point",
        ],
        answer: 0,
        explanation:
          "Divergence means each step overshoots the minimum and lands further up the opposite wall than it started. A smaller α shortens every step, so the iteration contracts toward the minimum instead of climbing away from it.",
      },
      {
        question:
          "On the four-well surface, two runs with identical α and β reach different final losses. Why?",
        options: [
          "They started in different basins, so they converged to different local minima",
          "Gradient descent is random, so it never repeats",
          "One of the runs had not finished converging",
          "The gradient was computed incorrectly for one run",
        ],
        answer: 0,
        explanation:
          "Gradient descent is fully deterministic — it only ever moves downhill from where it is. With four separate basins the starting point alone decides which minimum you fall into, which is why non-convex optimisation is sensitive to initialisation.",
      },
    ],
  },
  {
    id: "revolution",
    category: "math",
    icon: Cylinder,
    title: "Solids of Revolution & the Disc Method",
    blurb: "Sweeping a curve about an axis, and integrating the discs it makes",
    syllabus: "Mathematics 4.4 · Integration",
    keywords:
      "solid of revolution disc method volume integral integration calculus lathe rotate curve about axis riemann sum limit cross section paraboloid cone frustum",
    defaults: {
      curve: "bell",
      sweep: 300,
      height: 3.6,
      slices: 12,
      showDiscs: true,
      showSolid: true,
      spin: true,
    },
    controls: [
      { type: "choice", key: "curve", label: "Curve r(y)", columns: 3, options: CURVE_OPTIONS },
      { type: "slider", key: "sweep", label: "Sweep angle", min: 30, max: 360, step: 5, format: (v) => `${v}°` },
      { type: "slider", key: "height", label: "Height H", min: 2, max: 5, step: 0.1, format: (v) => v.toFixed(1) },
      { type: "slider", key: "slices", label: "Number of discs n", min: 3, max: 80, step: 1 },
      { type: "toggle", key: "showDiscs", label: "Show discs" },
      { type: "toggle", key: "showSolid", label: "Show true solid" },
      { type: "toggle", key: "spin", label: "Orbit camera" },
    ],
    concepts: [
      "Revolving the curve r(y) about the y-axis sweeps out a solid whose cross-section at every height is a circle of radius r(y), and therefore of area πr².",
      "Stacking those circles as discs of thickness Δy gives V ≈ Σ πr²Δy. Taking the limit as Δy → 0 turns the sum into the integral V = π∫r(y)² dy — the disc method is a Riemann sum you can see.",
      "Because the radius is squared, the volume is dominated by wherever the curve is widest: doubling r at some height contributes four times the volume, not twice.",
    ],
    quiz: [
      {
        question:
          "Raising the number of discs from 6 to 30 makes the disc-sum estimate much closer to the exact volume. What does that demonstrate?",
        options: [
          "The sum converges to the integral as the disc thickness tends to zero",
          "The exact volume changes as more discs are used",
          "The discs are a better shape than cylinders for this solid",
          "The curve becomes smoother when it is sampled more often",
        ],
        answer: 0,
        explanation:
          "The solid never changes — only the approximation does. Each disc misses a sliver where the radius varies across its thickness, and those slivers shrink to nothing as Δy → 0. That limit is exactly what the integral sign means.",
      },
      {
        question: "Why does the volume formula use πr(y)² rather than 2πr(y)?",
        options: [
          "Each slice is a disc, and πr² is the area of its circular face",
          "2πr is the volume of a cylinder of unit height",
          "The radius has to be squared to keep the units positive",
          "It accounts for both the top and bottom faces of the slice",
        ],
        answer: 0,
        explanation:
          "The slice is a solid disc, so what you need is the area of a circle, πr². 2πr is the circumference — using it would give you the surface area swept, not the volume enclosed.",
      },
    ],
  },
  {
    id: "unitcircle",
    category: "math",
    icon: Sigma,
    title: "Unit Circle → Sine Wave & Fourier Series",
    blurb: "Circular motion unrolled into a wave, then stacked into a square one",
    syllabus: "Mathematics 3.5 · Trigonometry",
    keywords:
      "unit circle sine cosine wave trigonometry radians amplitude period phase fourier series harmonics square wave epicycle gibbs phenomenon simple harmonic motion",
    defaults: {
      viewMode: "front",
      waveform: "square",
      harmonics: 1,
      amplitude: 1.4,
      speed: 1.1,
      showCircles: true,
      showCos: false,
      showTarget: false,
      showTangent: false,
      showHelix: false,
      spin: false,
    },
    controls: [
      {
        type: "choice",
        key: "viewMode",
        label: "Camera view angle",
        columns: 4,
        options: [
          { value: "front", label: "Front (Sine)" },
          { value: "top", label: "Top (Cosine)" },
          { value: "barrel", label: "Barrel (Circle)" },
          { value: "iso", label: "3D Iso" },
        ],
      },
      {
        type: "choice",
        key: "waveform",
        label: "Target waveform",
        columns: 3,
        options: [
          { value: "square", label: "Square" },
          { value: "sawtooth", label: "Sawtooth" },
          { value: "triangle", label: "Triangle" },
        ],
      },
      { type: "slider", key: "harmonics", label: "Harmonics in the sum", min: 1, max: 16, step: 1, format: (v) => (v === 1 ? "1 — pure sine" : `${v} terms`) },
      { type: "slider", key: "amplitude", label: "Amplitude A", min: 0.4, max: 2.2, step: 0.05, format: (v) => v.toFixed(2) },
      { type: "slider", key: "speed", label: "Angular speed ω", min: 0, max: 3, step: 0.1, format: (v) => (v === 0 ? "paused" : `${v.toFixed(1)} rad/s`) },
      { type: "toggle", key: "showCircles", label: "Show construction circles" },
      { type: "toggle", key: "showTarget", label: "Show target wave" },
      { type: "toggle", key: "showTangent", label: "Show tangent line (tan θ)" },
      { type: "toggle", key: "showCos", label: "Show cosine trace" },
      { type: "toggle", key: "showHelix", label: "3D Phase Helix" },
      { type: "toggle", key: "spin", label: "Orbit camera" },
    ],
    concepts: [
      "A sine wave is not a separate object from a circle — it is the height of a point travelling round one, plotted against time. One full revolution is exactly one wavelength, which is why the period is 2π radians.",
      "Cosine is the same motion measured horizontally instead of vertically, so it runs a quarter of a turn ahead: cos θ = sin(θ + π/2).",
      "Adding odd harmonics of decreasing amplitude — A/k for k = 1, 3, 5 … — squares the wave off, converging on a square wave of amplitude πA/4. The overshoot at each jump settles at about 9% of the jump however many terms you add; that is the Gibbs phenomenon.",
    ],
    quiz: [
      {
        question:
          "A point moves round a circle of radius A at a steady rate. Its height is plotted against time. What is the amplitude of the resulting wave?",
        options: ["A", "2A", "A ÷ 2", "πA"],
        answer: 0,
        explanation:
          "The point's height ranges from +A at the top to −A at the bottom, so the wave peaks at A either side of the axis. The amplitude is the radius; the peak-to-peak distance is 2A.",
      },
      {
        question:
          "Adding more harmonics to the square-wave series makes the flat sections flatter, but the spike at each jump stays about 9% too tall. What is this called?",
        options: [
          "The Gibbs phenomenon",
          "Aliasing",
          "Resonance",
          "Destructive interference",
        ],
        answer: 0,
        explanation:
          "The Gibbs phenomenon: near a jump discontinuity the partial sums always overshoot by about 9% of the step. More terms narrow the overshoot but never shrink its height, because no finite sum of continuous sines can produce a true instantaneous jump.",
      },
    ],
  },
];

export const TOPICS_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

/**
 * Builds rich, structured markdown content from an active 3D visualization
 * for feeding into the AI Explain and Quiz generation pipeline.
 */
export function formatTopicStudyContext(topic, params = {}) {
  if (!topic) {
    return {
      concept: "3D Visualization",
      focus: "",
      content: "Interactive 3D scientific model simulation.",
      noteId: "3d_vis",
      noteTitle: "3D Visualization",
      space: "Sciences",
    };
  }

  const categoryName = {
    physics: "Physics",
    chemistry: "Chemistry",
    biology: "Biology",
    cs: "Computer Science",
    math: "Mathematics",
  }[topic.category] || "Sciences";

  const paramEntries = Object.entries(params || {})
    .filter(
      ([k]) =>
        ![
          "spin",
          "hideOverlayReadout",
          "replay",
          "restart",
          "shuffle",
          "crack",
          "unzip",
        ].includes(k),
    )
    .map(
      ([k, v]) =>
        `- **${k}**: ${typeof v === "boolean" ? (v ? "Enabled" : "Disabled") : v}`,
    )
    .join("\n");

  const conceptsList =
    Array.isArray(topic.concepts) && topic.concepts.length > 0
      ? topic.concepts.map((c, i) => `${i + 1}. ${c}`).join("\n\n")
      : "Comprehensive interactive 3D scientific model simulation.";

  const content = `# ${topic.title}
**Subject**: ${categoryName}
**Curriculum**: ${topic.syllabus || "IGCSE / Secondary STEM"}
**Overview**: ${topic.blurb || ""}

## Key Theoretical Concepts & Mechanisms
${conceptsList}

## Interactive 3D Model Parameters & State
${paramEntries || "Default scientific parameters loaded."}

## Keywords & Core Principles
${topic.keywords || topic.title}
`;

  return {
    concept: topic.title,
    focus: topic.title,
    content,
    noteId: `3d_${topic.id}`,
    noteTitle: `3D: ${topic.title}`,
    space: categoryName,
  };
}

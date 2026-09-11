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
  Aperture,
  Eye,
  ArrowUpDown,
  Atom,
  AudioWaveform,
  BatteryCharging,
  Boxes,
  CircuitBoard,
  CloudLightning,
  Cylinder,
  Dna,
  Droplets,
  Flame,
  FlaskConical,
  GitBranch,
  Hexagon,
  Lightbulb,
  Magnet,
  Microscope,
  Orbit,
  Puzzle,
  Rocket,
  RotateCcw,
  Scale,
  Scissors,
  Shapes,
  Ship,
  Shuffle,
  Sigma,
  Sparkles,
  Spline,
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
  CIRCUIT_TOPOLOGY_OPTIONS,
  CURVE_OPTIONS,
  FLUID_OPTIONS,
  FRICTION_SURFACE_OPTIONS,
  GRAVITY_OPTIONS,
  HEAT_VIEW_OPTIONS,
  ROD_MATERIAL_OPTIONS,
  SOLID_PRESET_OPTIONS,
  SPECIMEN_SHAPE_OPTIONS,
  STATIC_TARGET_OPTIONS,
  STRUCTURE_OPTIONS,
  SURFACE_OPTIONS,
  VSEPR_PRESETS,
  vseprPresetFor,
} from "@/components/visualizations/topic-options";
import { MAX_DENSITY, MIN_DENSITY, SOLIDS, solidPresetFor } from "@/lib/buoyancy";
import { leakTimeConstant } from "@/lib/electrostatics";
import { flameIsLit, flameTemperature } from "@/lib/heatTransfer";

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
    title: "Ray Optics — Convex & Concave Lenses",
    blurb: "Real and virtual image formation about the focal point",
    syllabus: "Physics 3.2 · Light",
    keywords: "lens convex concave converging diverging focal point real virtual image magnification ray diagram",
    defaults: { lensType: "convex", focal: 2, objectDistance: 5, showConstruction: true },
    controls: [
      {
        type: "choice",
        key: "lensType",
        label: "Lens",
        options: [
          { value: "convex", label: "Convex" },
          { value: "concave", label: "Concave" },
        ],
      },
      { type: "slider", key: "focal", label: "Focal length f", min: 1, max: 3.5, step: 0.1, format: (v) => `${v.toFixed(1)} cm` },
      { type: "slider", key: "objectDistance", label: "Object distance u", min: 0.6, max: 9, step: 0.1, format: (v) => `${v.toFixed(1)} cm` },
      { type: "toggle", key: "showConstruction", label: "Construction rays & extensions" },
    ],
    concepts: [
      "A convex (converging) lens brings parallel rays to a focus at F; a concave (diverging) lens spreads them so they only appear to come from F.",
      "Where the object sits decides the image: beyond 2F gives a real, inverted, diminished image; inside F gives a virtual, upright, magnified one — a magnifying glass.",
      "Real images can be caught on a screen because light actually converges there; virtual images cannot, because only the back-extensions of the rays meet.",
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
    ],
  },
  {
    id: "induction",
    category: "physics",
    icon: Zap,
    title: "Electromagnetic Induction & Faraday's Law",
    blurb: "Rotating coil cutting magnetic field lines",
    syllabus: "Physics 4.5 · Electromagnetism",
    keywords: "faraday lenz induction generator emf flux alternating current dynamo coil",
    defaults: { speed: 1, field: 1, turns: 3, showFieldLines: true, showCurrent: true },
    controls: [
      { type: "slider", key: "speed", label: "Rotation speed", min: 0, max: 2.5, step: 0.1, format: (v) => (v === 0 ? "stopped" : `${v.toFixed(1)} rev/s`) },
      { type: "slider", key: "field", label: "Flux density B", min: 0.2, max: 2, step: 0.05, format: (v) => `${v.toFixed(2)} T` },
      { type: "slider", key: "turns", label: "Turns on the coil N", min: 1, max: 8, step: 1, format: (v) => `${v} turn${v === 1 ? "" : "s"}` },
      { type: "toggle", key: "showFieldLines", label: "Show field lines" },
      { type: "toggle", key: "showCurrent", label: "Show current arrows" },
    ],
    concepts: [
      "Moving a conductor across magnetic field lines — or changing the flux through a coil — induces an e.m.f. This is Faraday's law.",
      "The e.m.f. is largest when the coil cuts field lines fastest, with its plane parallel to the field, and zero when the coil is perpendicular to it.",
      "Lenz's law: the induced current always opposes the change producing it, which is why a generator gets harder to turn as more current is drawn.",
    ],
    quiz: [
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
          "e.m.f. depends on the rate of cutting field lines. With the coil's plane parallel to the field the sides sweep straight across the lines, so the rate — and the e.m.f. — peaks.",
      },
      {
        question: "If you double the speed of rotation of the coil, what happens to the peak e.m.f.?",
        options: ["It doubles", "It halves", "It stays the same", "It quadruples"],
        answer: 0,
        explanation:
          "The flux is cut twice as fast, so the induced e.m.f. doubles — and the output frequency doubles with it.",
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
      { type: "slider", key: "launchSpeed", label: "Launch speed v", min: 0.2, max: 4, step: 0.05, format: (v) => v.toFixed(2) },
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
      { type: "slider", key: "speed", label: "Orbit speed", min: 0, max: 3, step: 0.1, format: (v) => (v === 0 ? "paused" : `${v.toFixed(1)}×`) },
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
      showReverse: true,
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
      { type: "slider", key: "speed", label: "Animation speed", min: 0.2, max: 2, step: 0.1, format: (v) => `${v.toFixed(1)}×` },
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
      "Search and insertion run in O(log n) time on balanced trees, but degrade to O(n) if the tree becomes unbalanced.",
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

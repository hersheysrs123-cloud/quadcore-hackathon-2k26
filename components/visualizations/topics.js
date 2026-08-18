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
  ArrowUpDown,
  Atom,
  AudioWaveform,
  BatteryCharging,
  Boxes,
  Cylinder,
  Dna,
  Flame,
  FlaskConical,
  GitBranch,
  Hexagon,
  Magnet,
  Microscope,
  Orbit,
  Puzzle,
  Rocket,
  RotateCcw,
  Scissors,
  Shapes,
  Shuffle,
  Sigma,
  Spline,
  Thermometer,
  TrendingDown,
  Waves,
  Zap,
} from "lucide-react";
import { MEDIA, MEDIA_OPTIONS, mediumFor } from "@/components/visualizations/media";
import {
  ALGORITHM_OPTIONS,
  CURVE_OPTIONS,
  GRAVITY_OPTIONS,
  STRUCTURE_OPTIONS,
  SURFACE_OPTIONS,
  VSEPR_PRESETS,
  vseprPresetFor,
} from "@/components/visualizations/topic-options";

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
      speed: 22,
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
      { type: "slider", key: "speed", label: "Launch speed u", min: 5, max: 40, step: 1, format: (v) => `${v} m/s` },
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
      speed: 1.4,
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
      { type: "slider", key: "slices", label: "Number of discs n", min: 3, max: 40, step: 1 },
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
      harmonics: 1,
      amplitude: 1.4,
      speed: 1.1,
      showCircles: true,
      showCos: false,
      showTarget: false,
      spin: false,
    },
    controls: [
      { type: "slider", key: "harmonics", label: "Harmonics in the sum", min: 1, max: 12, step: 1, format: (v) => (v === 1 ? "1 — pure sine" : `${v} terms`) },
      { type: "slider", key: "amplitude", label: "Amplitude A", min: 0.4, max: 2.2, step: 0.05, format: (v) => v.toFixed(2) },
      { type: "slider", key: "speed", label: "Angular speed ω", min: 0, max: 3, step: 0.1, format: (v) => (v === 0 ? "paused" : `${v.toFixed(1)} rad/s`) },
      { type: "toggle", key: "showCircles", label: "Show construction circles" },
      { type: "toggle", key: "showCos", label: "Show cosine trace" },
      { type: "toggle", key: "showTarget", label: "Show target square wave" },
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

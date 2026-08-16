"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Aperture,
  Atom,
  BatteryCharging,
  Boxes,
  Dna,
  FlaskConical,
  GitBranch,
  Hexagon,
  Magnet,
  Microscope,
  Puzzle,
  RotateCcw,
  Scissors,
  Search,
  Thermometer,
  Waves,
  X,
  Zap,
} from "lucide-react";
import {
  QuizOverlay,
  ViewportHint,
  VisualizationHUD,
} from "@/components/visualizations/VisualizationHUD";
import { MEDIA, MEDIA_OPTIONS, mediumFor } from "@/components/visualizations/media";

// ─── IGCSE Grade 10 · Interactive 3D Visualization Hub ──────────────
// Scenes across sciences & computer science. Every scene is a pure function
// of the params declared here, so the HUD can drive all of them from one
// schema and the canvases stay free of UI state.
// ─────────────────────────────────────────────────────────────────────

const viewportLoader = () => (
  <div className="flex h-full w-full items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-duck-400" />
      <span className="text-[11px] uppercase tracking-wider text-ink-500">Compiling scene</span>
    </div>
  </div>
);

const CANVASES = {
  physics: dynamic(() => import("@/components/visualizations/PhysicsCanvas"), {
    ssr: false,
    loading: viewportLoader,
  }),
  chemistry: dynamic(() => import("@/components/visualizations/ChemistryCanvas"), {
    ssr: false,
    loading: viewportLoader,
  }),
  biology: dynamic(() => import("@/components/visualizations/BiologyCanvas"), {
    ssr: false,
    loading: viewportLoader,
  }),
  cs: dynamic(() => import("@/components/visualizations/BinaryTree3D"), {
    ssr: false,
    loading: viewportLoader,
  }),
};

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "physics", label: "Physics", emoji: "⚛️" },
  { id: "chemistry", label: "Chemistry", emoji: "🧪" },
  { id: "biology", label: "Biology", emoji: "🧬" },
  { id: "cs", label: "Computer Science", emoji: "💻" },
];

const CATEGORY_EMOJI = { physics: "⚛️", chemistry: "🧪", biology: "🧬", cs: "💻" };

// ─── Topic registry ─────────────────────────────────────────────────

const TOPICS = [
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
];

const TOPICS_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

// ─── Page ───────────────────────────────────────────────────────────

export default function VisualizationsPage() {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [topicId, setTopicId] = useState(TOPICS[0].id);
  const [quizOpen, setQuizOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from URL / LocalStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlVis = params.get("vis");
    let fallback = null;
    try { fallback = JSON.parse(localStorage.getItem("socratic_last_vis_state")); } catch(e){}

    const targetVis = urlVis || fallback?.topicId || TOPICS[0].id;
    if (TOPICS_BY_ID[targetVis]) {
       setTopicId(targetVis);
       setCategory(TOPICS_BY_ID[targetVis].category);
    }
    setIsHydrated(true);
  }, []);

  // Sync state to URL and localStorage
  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("vis", topicId);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    localStorage.setItem("socratic_last_vis_state", JSON.stringify({ topicId }));
  }, [topicId, isHydrated]);

  // Params live per topic, so switching away and back keeps your settings.
  const [paramsByTopic, setParamsByTopic] = useState(() =>
    Object.fromEntries(TOPICS.map((t) => [t.id, { ...t.defaults }])),
  );

  const topic = TOPICS_BY_ID[topicId] || TOPICS[0];
  const params = (topic && paramsByTopic[topic.id]) || topic.defaults;
  const Canvas = CANVASES[topic.category];

  const visibleTopics = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return TOPICS.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (!needle) return true;
      return `${t.title} ${t.blurb} ${t.syllabus} ${t.keywords}`
        .toLowerCase()
        .includes(needle);
    });
  }, [category, query]);

  /** Merge a patch of several keys at once — see ControlField's `patch`. */
  const setParams = useCallback(
    (patch) => {
      setParamsByTopic((prev) => ({
        ...prev,
        [topicId]: { ...prev[topicId], ...patch },
      }));
    },
    [topicId],
  );

  const setParam = useCallback(
    (key, value) => setParams({ [key]: value }),
    [setParams],
  );

  const resetParams = useCallback(() => {
    setParamsByTopic((prev) => ({ ...prev, [topicId]: { ...topic.defaults } }));
  }, [topicId, topic]);

  const selectTopic = useCallback((id) => {
    setTopicId(id);
    setQuizOpen(false);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 lg:h-screen lg:overflow-hidden">
      {/* ─── Header ──────────────────────────────────────── */}
      <header className="shrink-0 border-b border-ink-800 bg-ink-900">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Workspace
          </Link>

          <div className="h-5 w-px bg-ink-800" aria-hidden="true" />

          <div className="min-w-0 flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold tracking-tight text-ink-100">
              Visualization Hub
            </h1>

            {/* Dropdown Topic Selector */}
            <p className="truncate text-[11px] text-ink-500">
              {TOPICS.length} interactive 3D models
            </p>
            <div className="relative min-w-0">
              <select
                value={topicId}
                onChange={(e) => selectTopic(e.target.value)}
                className="appearance-none rounded-lg border border-ink-700 bg-ink-850 py-1 pl-3 pr-8 text-xs font-semibold text-ink-100 focus:border-duck-500/50 focus:outline-none cursor-pointer truncate max-w-[260px]"
              >
                {TOPICS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {CATEGORY_EMOJI[t.category]} {t.title}
                  </option>
                ))}
              </select>
            </div>

            <span className="hidden md:inline-block rounded border border-ink-800 bg-ink-850 px-2 py-0.5 text-[10px] text-ink-400 font-mono">
              {topic.syllabus}
            </span>
          </div>

          {/* Search */}
          <div className="relative ml-auto w-full max-w-[200px]">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500"
              strokeWidth={2}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics…"
              aria-label="Search visualizations"
              suppressHydrationWarning
              className="w-full rounded-md border border-ink-700 bg-ink-850 py-1.5 pl-8 pr-7 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                suppressHydrationWarning
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-500 transition-colors hover:text-ink-200"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─── Category & Topic Quick Switch Strip ───────────────────── */}
      <div className="shrink-0 border-b border-ink-800/70 bg-ink-900/40 px-3 py-1.5 overflow-x-auto flex items-center gap-2 no-scrollbar">
        <div className="flex items-center gap-1 border-r border-ink-800 pr-2 shrink-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-all ${
                category === cat.id
                  ? "bg-duck-500/20 text-duck-300 border border-duck-500/40"
                  : "text-ink-400 hover:text-ink-200"
              }`}
            >
              <span>{cat.emoji || "🌐"}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {visibleTopics.map((t) => {
            const active = topic.id === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTopic(t.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? "border-duck-500/50 bg-duck-500/15 text-duck-300 shadow-sm"
                    : "border-transparent text-ink-400 hover:border-ink-800 hover:bg-ink-850 hover:text-ink-200"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? "text-duck-300" : "text-ink-500"}`} />
                <span>{t.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Body ────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col relative overflow-hidden">
        {/* Viewport + overlaid HUD */}
        <main className="relative min-h-[600px] flex-1 lg:min-h-0">
          {/* Remounting per topic gives each scene a clean WebGL context. */}
          <Canvas key={topic.id} topicId={topic.id} params={params} setParam={setParam} onOpenQuiz={() => setQuizOpen(true)} />

          {topic.category !== "cs" && (
            <VisualizationHUD
              topic={topic}
              params={params}
              setParam={setParam}
              setParams={setParams}
              onReset={resetParams}
              onOpenQuiz={() => setQuizOpen(true)}
            />
          )}

          <ViewportHint>drag to orbit · scroll to zoom · right-drag to pan</ViewportHint>
        </main>
      </div>

      {quizOpen && <QuizOverlay topic={topic} onClose={() => setQuizOpen(false)} />}
    </div>
  );
}

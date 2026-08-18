"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Lightbulb,
  RotateCcw,
  SlidersHorizontal,
  Target,
  X,
} from "lucide-react";

// ─── Visualization HUD ──────────────────────────────────────────────
// One overlay drives all thirteen scenes: parameter controls rendered
// from each topic's declarative schema, the three IGCSE takeaways, and
// the Socratic quiz trigger.
// ─────────────────────────────────────────────────────────────────────

// `suppressHydrationWarning` on every interactive element here is not
// covering for non-deterministic rendering — this tree is pure. Form-filler
// browser extensions stamp their own attribute (`fdprocessedid`) onto every
// button and input before React hydrates, and React then reports the whole
// page as a hydration mismatch. The flag scopes the suppression to the
// elements those extensions actually touch, so a genuine mismatch anywhere
// else still surfaces.

export function HudPanel({ title, icon: Icon, action, children, className = "" }) {
  return (
    <div
      className={`rounded-xl border border-ink-800 bg-ink-900/85 p-3.5 shadow-2xl backdrop-blur-md ${className}`}
    >
      {title && (
        <div className="mb-3 flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-duck-400" strokeWidth={2} />}
          <span className="flex-1 truncate text-[11px] font-medium uppercase tracking-wider text-ink-500">
            {title}
          </span>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Slider({ label, value, onChange, min, max, step = 1, format }) {
  const safeValue = typeof value === "number" && !isNaN(value) ? value : (min ?? 0);
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-ink-400">{label}</span>
        <span className="text-[11px] font-medium tabular-nums text-duck-300">
          {format ? format(safeValue) : safeValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeValue}
        onChange={(e) => onChange(Number(e.target.value))}
        suppressHydrationWarning
        className="w-full cursor-pointer accent-duck-400"
      />
    </label>
  );
}

export function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      suppressHydrationWarning
      className="flex w-full items-center justify-between gap-3 rounded-md py-1 text-left text-[11px] text-ink-400 transition-colors hover:text-ink-200"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span
        className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
          checked ? "bg-duck-500" : "bg-ink-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-ink-100 transition-all ${
            checked ? "left-3.5" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function Choice({ options, value, onChange, columns = 2 }) {
  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            title={opt.title}
            suppressHydrationWarning
            className={`truncate rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
              active
                ? "border-duck-500/60 bg-duck-500/15 text-duck-300"
                : "border-ink-700 bg-ink-850 text-ink-400 hover:border-ink-600 hover:text-ink-200"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function HudButton({
  children,
  onClick,
  icon: Icon,
  disabled = false,
  variant = "ghost",
  className = "",
  type = "button",
}) {
  const variants = {
    primary: "border-transparent bg-duck-400 font-medium text-ink-950 hover:bg-duck-300",
    ghost: "border-ink-700 bg-ink-850 text-ink-200 hover:border-ink-600 hover:bg-ink-800",
    danger: "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      suppressHydrationWarning
      className={`flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${variants[variant]} ${className}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />}
      {children}
    </button>
  );
}

const TONES = {
  default: "text-ink-100",
  gold: "text-duck-300",
  good: "text-emerald-400",
  warn: "text-amber-400",
  bad: "text-rose-400",
};

export function Stat({ label, value, tone = "default", hint }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-ink-500">{label}</p>
      <p className={`truncate text-sm font-medium tabular-nums ${TONES[tone]}`}>{value}</p>
      {hint && <p className="text-[10px] leading-tight text-ink-500">{hint}</p>}
    </div>
  );
}

export function ViewportHint({ children }) {
  return (
    <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-ink-800 bg-ink-950/70 px-3 py-1 text-[10px] text-ink-500 backdrop-blur-sm">
      {children}
    </p>
  );
}

// ─── Schema-driven controls ─────────────────────────────────────────

/**
 * Renders one entry of a topic's `controls` array. Actions carry no value
 * of their own — they bump a counter the scene watches, which is what lets
 * "Unzip DNA" or "Trigger cracking" fire repeatedly.
 */
function ControlField({ control, params, setParam, setParams }) {
  const value = params[control.key];

  // A control may write more than its own key: picking "Glass" sets both the
  // medium and its refractive index, and moving the index slider sets the
  // medium back to custom. `patch` returns the whole object to merge.
  const emit = (next) => {
    if (control.patch) setParams(control.patch(next, params));
    else setParam(control.key, next);
  };

  switch (control.type) {
    case "slider":
      return (
        <Slider
          label={control.label}
          value={value}
          onChange={emit}
          min={control.min}
          max={control.max}
          step={control.step ?? 1}
          format={control.format}
        />
      );

    case "toggle":
      return (
        <Toggle
          label={control.label}
          checked={Boolean(value)}
          onChange={emit}
        />
      );

    case "choice":
      return (
        <div>
          {control.label && (
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-ink-500">
              {control.label}
            </p>
          )}
          <Choice
            options={control.options}
            value={value}
            onChange={emit}
            columns={control.columns ?? 2}
          />
        </div>
      );

    case "action":
      return (
        <HudButton
          icon={control.icon}
          variant={control.variant ?? "primary"}
          onClick={() => emit((Number(value) || 0) + 1)}
          className="w-full"
        >
          {control.label}
        </HudButton>
      );

    default:
      return null;
  }
}

// ─── The overlay ────────────────────────────────────────────────────

// ─── Details readout helper ─────────────────────────────────────────

function renderTopicDetailsReadout(topic, params) {
  if (!topic || !params) return null;

  let readout = { title: "", subtitle: "", rows: [], note: "", noteTone: "neutral" };
  let legend = { title: "Visual Key", items: [] };

  switch (topic.id) {
    case "refraction": {
      const n1 = Number(params.n1) || 1.0;
      const n2 = Number(params.n2) || 1.5;
      const iDeg = Number(params.angle) || 0;
      const iRad = (iDeg * Math.PI) / 180;
      const sinR = (n1 * Math.sin(iRad)) / n2;
      const thickness = Number(params.thickness) || 3.0;

      const tir = sinR > 1.0;
      const rRad = tir ? 0 : Math.asin(sinR);
      const rDeg = (rRad * 180) / Math.PI;
      const critical = n1 > n2 ? (Math.asin(n2 / n1) * 180) / Math.PI : null;

      const reflectance = tir
        ? 1.0
        : Math.pow((n1 * Math.cos(iRad) - n2 * Math.cos(rRad)) / (n1 * Math.cos(iRad) + n2 * Math.cos(rRad)), 2);

      const lateral = tir ? 0 : (thickness * Math.sin(iRad - rRad)) / Math.cos(rRad);

      readout = {
        title: "Snell's Law Optics",
        subtitle: `n₁ (${n1.toFixed(2)}) → n₂ (${n2.toFixed(2)}) → n₁`,
        rows: [
          ["Incidence (i)", `${iDeg.toFixed(1)}°`, "gold"],
          ["Refraction (r)", tir ? "TIR" : `${rDeg.toFixed(1)}°`, tir ? "bad" : "good"],
          ["Emergence (e)", tir ? "TIR" : `${iDeg.toFixed(1)}°`, tir ? "bad" : "gold"],
          ["n₁ sin i", (n1 * Math.sin(iRad)).toFixed(3), "good"],
          ["n₂ sin r", tir ? "—" : (n2 * Math.sin(rRad)).toFixed(3), tir ? "bad" : "good"],
          ["Lateral shift d", tir ? "—" : `${Math.abs(lateral).toFixed(2)} cm`],
          ["Critical angle θc", critical === null ? "None (n₂ ≥ n₁)" : `${critical.toFixed(1)}°`],
          ["Reflected share", `${(reflectance * 100).toFixed(0)}%`, reflectance > 0.5 ? "warn" : undefined],
          ["Transmitted share", `${((1 - reflectance) * 100).toFixed(0)}%`, reflectance > 0.5 ? "warn" : "good"],
          ["Speed in medium 2", `${(3 / n2).toFixed(2)} × 10⁸ m/s`],
        ],
        note: tir
          ? `Total internal reflection: angle of incidence (${iDeg}°) exceeds the critical angle of ${critical?.toFixed(1)}°. No light enters medium 2.`
          : n2 > n1
          ? "Snell's law: n₁ sin i = n₂ sin r. Light bends toward the normal and slows down on entry, then bends back by the exact same angle on exit."
          : n2 < n1
          ? "Medium 2 is optically less dense, so the ray bends away from the normal on entry."
          : "Both media have equal refractive indices — ray passes straight through.",
        noteTone: tir ? "bad" : "good",
      };

      legend = {
        title: "Ray Construction Key",
        items: [
          { color: "#38bdf8", shape: "line", label: "Light Ray", note: `${params.wavelength || 520} nm beam` },
          { color: "#64748b", shape: "dash", label: "Normal Line", note: "Perpendicular (90°) boundary reference" },
          { color: "#0ea5e9", shape: "square", label: "Optical Medium Block", note: `n = ${n2.toFixed(2)}` },
        ],
      };
      break;
    }

    case "motor": {
      const I = Number(params.current) || 0;
      const B = Number(params.field) || 0;
      const L = 0.25;
      const F = B * I * L;
      const revI = Boolean(params.reverseCurrent);
      const revB = Boolean(params.reverseField);
      const reversed = revI ^ revB;
      const hasForce = F > 0.001;

      readout = {
        title: "Motor Effect (F = BIL)",
        subtitle: "Electromagnetic force on current-carrying conductor",
        rows: [
          ["Field B", `${B.toFixed(2)} T`, "gold"],
          ["Current I", `${I.toFixed(2)} A`, "gold"],
          ["Wire length L", `${L.toFixed(2)} m`],
          ["Force F", `${F.toFixed(3)} N`, hasForce ? "good" : "bad"],
          ["First finger (Field)", revB ? "−x (left)" : "+x (right)"],
          ["Second finger (Current)", revI ? "−z (back)" : "+z (front)"],
          ["Thumb (Motion/Force)", hasForce ? (reversed ? "downward (↓)" : "upward (↑)") : "no motion", hasForce ? "good" : "bad"],
        ],
        note: !hasForce
          ? "Turn up the current. With I = 0, no magnetic field is generated around the wire, so F = BIL = 0."
          : reversed
          ? "One input reversed: the force direction flips. A d.c. motor uses a split-ring commutator to reverse current every half turn."
          : revI && revB
          ? "Both inputs reversed: the two flips cancel out, keeping the force direction unchanged."
          : "Fleming's Left-Hand Rule: First finger Field, seCond finger Current, thuMb Motion.",
        noteTone: !hasForce ? "bad" : reversed ? "warn" : "good",
      };

      legend = {
        title: "Fleming's Left Hand Key",
        items: [
          { color: "#38bdf8", shape: "line", label: "First finger — Field B", note: "N pole → S pole" },
          { color: "#fbbf24", shape: "line", label: "seCond finger — Current I", note: "Conventional current (+ to −)" },
          { color: "#34d399", shape: "line", label: "Thumb — Motion / Force F", note: "Resulting force direction" },
        ],
      };
      break;
    }

    case "lenses": {
      const type = params.lensType || "convex";
      const isConvex = type === "convex";
      const f = Number(params.focal) || 2;
      const u = Number(params.objectDistance) || 5;

      const atInfinity = isConvex && Math.abs(u - f) < 0.02;
      let v = 0;
      let real = false;
      let m = 0;
      let natureText = "";

      if (isConvex) {
        if (!atInfinity) {
          if (u > f) {
            v = (f * u) / (u - f);
            real = true;
            m = v / u;
            natureText = u > 2 * f ? "Real, Inverted, Diminished" : Math.abs(u - 2 * f) < 0.05 ? "Real, Inverted, Same Size" : "Real, Inverted, Magnified";
          } else {
            v = (f * u) / (f - u);
            real = false;
            m = v / u;
            natureText = "Virtual, Upright, Magnified";
          }
        }
      } else {
        v = (f * u) / (u + f);
        real = false;
        m = v / u;
        natureText = "Virtual, Upright, Diminished";
      }

      readout = {
        title: isConvex ? "Converging Lens" : "Diverging Lens",
        subtitle: "1/v = 1/f − 1/u · m = |v ÷ u|",
        rows: [
          ["Object distance u", `${u.toFixed(1)} cm`],
          ["Focal length f", `${f.toFixed(1)} cm`, "gold"],
          ["Image distance v", atInfinity ? "∞" : `${v.toFixed(1)} cm`, real ? "good" : "bad"],
          ["Magnification m", atInfinity ? "∞" : `${m.toFixed(2)}×`],
          ["Nature", atInfinity ? "None (Spotlight)" : real ? "Real" : "Virtual", real ? "good" : "warn"],
          ["Orientation", atInfinity ? "—" : real ? "Inverted" : "Upright"],
          ["Object position", u > 2 * f ? "Beyond 2F" : u > f ? "Between F and 2F" : "Inside F"],
        ],
        note: atInfinity
          ? "Object is at focal point F: refracted rays leave parallel and never meet (collimator spotlight)."
          : isConvex
          ? u > f
            ? "Real image formed where rays physically intersect. Can be projected onto a screen."
            : "Virtual image formed inside F — rays diverge, back-extensions meet (magnifying glass)."
          : "Diverging lens spreads rays outward; image is always virtual, upright, and smaller.",
        noteTone: real ? "good" : "neutral",
      };

      legend = {
        title: "Ray Construction Key",
        items: [
          { color: "#fbbf24", shape: "square", label: "Object", note: "Upright arrow of fixed height" },
          { color: "#34d399", shape: "line", label: "Ray 1 (Parallel)", note: isConvex ? "Passes through F" : "Diverges from F" },
          { color: "#38bdf8", shape: "line", label: "Ray 2 (Center)", note: "Passes straight through optical center" },
          { color: "#a855f7", shape: "square", label: "Formed Image", note: natureText },
        ],
      };
      break;
    }

    case "induction": {
      const speed = Number(params.speed) || 0;
      const B = Number(params.field) || 0;
      const N = Number(params.turns) || 1;
      const flux = B * 0.6;
      const peak = speed * B * N * 1.5;

      readout = {
        title: "Faraday's Law of Induction",
        subtitle: "Φ = B A sin θ · ε = −N ΔΦ/Δt",
        rows: [
          ["Turns N", N, "gold"],
          ["Coil area A", "0.6 m²"],
          ["Flux Φ per turn", `${flux.toFixed(2)} Wb`],
          ["Peak e.m.f. ε₀", `${peak.toFixed(2)} V`, peak > 0.05 ? "good" : "bad"],
          ["Rotation speed", speed < 0.05 ? "Stopped" : `${speed.toFixed(1)} rev/s`],
          ["Output frequency", `${speed.toFixed(1)} Hz`],
          ["Current type", "Alternating Current (AC)"],
        ],
        note: speed < 0.05
          ? "Coil stationary: flux never changes, so induced e.m.f. is zero. Motion or changing flux is required."
          : "As the coil rotates, it cuts field lines at varying angles, producing a smooth sinusoidal AC wave.",
        noteTone: speed < 0.05 ? "bad" : "good",
      };

      legend = {
        title: "Generator Components Key",
        items: [
          { color: "#f43f5e", shape: "square", label: "North Pole (N)", note: "Field flows N → S" },
          { color: "#38bdf8", shape: "dash", label: "Magnetic Field Lines B", note: "Flux density lines" },
          { color: "#fbbf24", shape: "line", label: "Rotating Coil Wire", note: "Cuts field lines to induce e.m.f." },
        ],
      };
      break;
    }

    case "gas": {
      const T = Number(params.temperature) || 300;
      const V = Number(params.volume) || 1;
      const N = Number(params.particles) || 60;
      const pressure = (N * T) / (V * 180);
      const pV_T = (pressure * V) / T;

      readout = {
        title: "Ideal Gas State (pV = NkT)",
        subtitle: "Particle collisions per unit wall area",
        rows: [
          ["Pressure p", `${pressure.toFixed(1)} kPa`, "gold"],
          ["Temperature T", `${T} K (${T - 273}°C)`, T > 600 ? "warn" : undefined],
          ["Volume V", `${V.toFixed(2)} V₀`],
          ["Particles N", N],
          ["Mean particle speed", `${Math.sqrt(T / 300).toFixed(2)}×`],
          ["pV ÷ T constant", pV_T.toFixed(3), "good"],
        ],
        note: T > 600
          ? "High temperature: particles move faster with higher kinetic energy, hitting walls harder and more frequently."
          : V < 0.7
          ? "Compressed volume: same number of collisions squeezed into less wall area, raising pressure (Boyle's Law)."
          : "Gas pressure is the sum of all microscopic particle wall impacts per unit area.",
        noteTone: "neutral",
      };

      legend = {
        title: "Particle Kinetic Key",
        items: [
          { color: "#38bdf8", shape: "dot", label: "Cold Gas Particle", note: "Lower kinetic energy / speed" },
          { color: "#f43f5e", shape: "dot", label: "Hot Gas Particle", note: "High kinetic energy / speed" },
          { color: "#64748b", shape: "square", label: "Piston / Wall", note: "Measures collision force" },
        ],
      };
      break;
    }

    case "bohr": {
      const elemKey = params.element || "Na";
      const data = {
        H: { name: "Hydrogen", z: 1, n: 0, shells: [1], group: "1" },
        C: { name: "Carbon", z: 6, n: 6, shells: [2, 4], group: "4" },
        Na: { name: "Sodium", z: 11, n: 12, shells: [2, 8, 1], group: "1" },
        Cl: { name: "Chlorine", z: 17, n: 18, shells: [2, 8, 7], group: "7" },
      }[elemKey] || { name: "Sodium", z: 11, n: 12, shells: [2, 8, 1], group: "1" };

      const valence = data.shells[data.shells.length - 1];

      readout = {
        title: `${data.name} Atom (${elemKey})`,
        subtitle: `Shell configuration: ${data.shells.join(",")}`,
        rows: [
          ["Protons (Z)", data.z, "gold"],
          ["Neutrons", data.n],
          ["Mass Number (A)", data.z + data.n],
          ["Electrons", data.z],
          ["Configuration", data.shells.join(", "), "gold"],
          ["Valence Electrons", valence, "good"],
          ["Group / Period", `${data.group} / ${data.shells.length}`],
        ],
        note: `Atoms react to achieve a full outer shell. ${
          elemKey === "Na"
            ? "Sodium loses 1 electron to form Na⁺ (2,8)."
            : elemKey === "Cl"
            ? "Chlorine gains 1 electron to form Cl⁻ (2,8,8)."
            : "Carbon shares 4 valence electrons via covalent bonds."
        }`,
        noteTone: "good",
      };

      legend = {
        title: "Subatomic Particle Key",
        items: [
          { color: "#f43f5e", shape: "dot", label: "Proton (+1 charge)", note: `${data.z} in nucleus` },
          { color: "#94a3b8", shape: "dot", label: "Neutron (0 charge)", note: `${data.n} in nucleus` },
          { color: "#38bdf8", shape: "dot", label: "Inner Shell Electron", note: "Filled, stable orbits" },
          { color: "#fbbf24", shape: "dot", label: "Valence Electron", note: "Outer shell reactive electron" },
        ],
      };
      break;
    }

    case "organic": {
      const family = params.family || "alkane";
      const n = Number(params.carbons) || 3;
      const saturated = family === "alkane";

      let formula = `C${n}H${2 * n + 2}`;
      if (family === "alkene") formula = `C${n}H${2 * n}`;
      else if (family === "alkyne") formula = `C${n}H${2 * n - 2}`;
      else if (family === "alcohol") formula = `C${n}H${2 * n + 1}OH`;

      readout = {
        title: `${family.toUpperCase()} Series`,
        subtitle: `Molecule formula: ${formula}`,
        rows: [
          ["Formula", formula, "gold"],
          ["Carbon chain length", `C${n}`],
          ["Saturated", saturated ? "Yes (single bonds)" : "No (unsaturated)", saturated ? "good" : "warn"],
          ["Bromine test", saturated ? "Orange (No reaction)" : "Decolourised (Clear)", saturated ? undefined : "good"],
        ],
        note: saturated
          ? "Alkanes are saturated hydrocarbons with single C–C bonds."
          : "Unsaturated hydrocarbons contain double/triple bonds that rapidly decolourise bromine water.",
        noteTone: "neutral",
      };

      legend = {
        title: "Ball and Stick Key",
        items: [
          { color: "#475569", shape: "dot", label: "Carbon Atom (C)", note: "Forms 4 covalent bonds" },
          { color: "#f8fafc", shape: "dot", label: "Hydrogen Atom (H)", note: "Forms 1 covalent bond" },
          { color: "#f43f5e", shape: "dot", label: "Oxygen Atom (O)", note: "Forms 2 covalent bonds" },
          { color: "#fbbf24", shape: "line", label: "Covalent Bond", note: "Shared electron pairs" },
        ],
      };
      break;
    }

    case "enzyme": {
      const temp = Number(params.temperature) || 37;
      const ph = Number(params.ph) || 7.0;

      const denatured = temp > 55 || ph < 3 || ph > 11;
      let rate = 0;
      if (!denatured) {
        rate = Math.round(Math.max(0, 1 - Math.abs(temp - 37) / 25) * Math.max(0, 1 - Math.abs(ph - 7) / 4) * 100);
      }

      readout = {
        title: "Enzyme Kinetics",
        subtitle: "Lock and key substrate binding",
        rows: [
          ["Catalytic Rate", `${rate}%`, rate > 60 ? "good" : denatured ? "bad" : "warn"],
          ["Temperature", `${temp}°C`, temp > 50 ? "bad" : undefined],
          ["pH", ph.toFixed(1), Math.abs(ph - 7) > 3 ? "bad" : undefined],
          ["Optimum conditions", "37°C, pH 7.0"],
          ["Active site state", denatured ? "Denatured (Distorted)" : "Complementary Lock", denatured ? "bad" : "good"],
        ],
        note: denatured
          ? "Above ~50°C, high thermal energy breaks hydrogen/disulfide bonds holding protein tertiary structure. Active site shape changes permanently."
          : "Near optimum (37°C, pH 7): frequent collisions with active site in correct orientation.",
        noteTone: denatured ? "bad" : "good",
      };

      legend = {
        title: "Enzyme Component Key",
        items: [
          { color: denatured ? "#f43f5e" : "#34d399", shape: "square", label: "Enzyme Protein", note: denatured ? "Denatured tertiary shape" : "Active lock shape" },
        ],
      };
      break;
    }

    case "distillation": {
      const heat = Number(params.heat) || 0.7;
      const furnace = Math.round(250 + heat * 200);

      const fractions = [
        { name: "Refinery gases", chain: "C1–C4", top: 20, use: "bottled gas fuel", colour: "#f43f5e" },
        { name: "Petrol / Gasoline", chain: "C5–C9", top: 70, use: "fuel for cars", colour: "#fbbf24" },
        { name: "Naphtha", chain: "C8–C12", top: 120, use: "chemical feedstock", colour: "#a855f7" },
        { name: "Kerosene", chain: "C10–C16", top: 170, use: "jet fuel & heating", colour: "#38bdf8" },
        { name: "Diesel oil", chain: "C14–C20", top: 270, use: "diesel engines", colour: "#34d399" },
        { name: "Bitumen", chain: "C50+", top: 350, use: "roads & roofing", colour: "#64748b" },
      ];

      const rising = Math.min(fractions.length, Math.max(1, Math.floor(heat * 7)));

      readout = {
        title: "Fractionating Column",
        subtitle: "Physical separation of crude oil by boiling point",
        rows: [
          ["Furnace Heat", `${furnace}°C`, "gold"],
          ["Column Top Temp", "~25°C"],
          ["Separated By", "Boiling Point"],
          ["Fractions Vaporised", `${rising} of ${fractions.length}`, rising > 3 ? "good" : "warn"],
          ["Highest Riser", fractions[0].name],
          ["Base Residue", "Bitumen"],
        ],
        note: rising <= 2
          ? "Furnace is too cool for most crude oil to vaporise. Turn up the heat."
          : "Short chains have weaker intermolecular forces, boiling at lower temperatures to climb highest.",
        noteTone: rising <= 2 ? "warn" : "good",
      };

      legend = {
        title: "Fractions Key (Top to Bottom)",
        items: fractions.map((f) => ({
          color: f.colour,
          label: `${f.name} (${f.chain})`,
          note: `≤${f.top}°C · ${f.use}`,
        })),
      };
      break;
    }

    case "lattice": {
      const structure = params.structure || "nacl";

      const data = {
        nacl: {
          title: "Sodium Chloride (NaCl)",
          type: "Giant Ionic Lattice",
          rows: [
            ["Structure", "Face-Centered Cubic", "gold"],
            ["Bonding", "Giant Ionic Attraction", "good"],
            ["Melting Point", "801°C (High)", "good"],
            ["Solid Conducts", "No (Ions locked)"],
            ["Liquid Conducts", "Yes (Ions free)", "good"],
          ],
          note: "Alternating Na⁺ and Cl⁻ ions held by strong electrostatic attraction in 3D.",
          keys: [
            { color: "#fbbf24", shape: "dot", label: "Na⁺ Cation", note: "Positive sodium ion" },
            { color: "#34d399", shape: "dot", label: "Cl⁻ Anion", note: "Negative chloride ion" },
            { color: "#38bdf8", shape: "line", label: "Ionic Attraction", note: "Electrostatic bond" },
          ],
        },
        diamond: {
          title: "Diamond Allotrope",
          type: "Giant Covalent Network",
          rows: [
            ["Structure", "Tetrahedral Carbon", "gold"],
            ["Bonding", "4 Single Covalent Bonds"],
            ["Hardness", "Extremely Hard (10 Mohs)", "good"],
            ["Conductivity", "Non-conductor (No free e⁻)"],
          ],
          note: "Every carbon forms 4 strong covalent bonds tetrahedrally, producing extreme hardness.",
          keys: [
            { color: "#94a3b8", shape: "dot", label: "Carbon Atom", note: "sp³ hybridized" },
            { color: "#38bdf8", shape: "line", label: "Covalent Bond", note: "Strong directional bond" },
          ],
        },
        graphite: {
          title: "Graphite Allotrope",
          type: "Hexagonal Covalent Layers",
          rows: [
            ["Structure", "Hexagonal Sheets", "gold"],
            ["Bonding", "3 Covalent Bonds / Carbon"],
            ["Delocalised e⁻", "1 per Carbon", "good"],
            ["Conductivity", "Conducts along layers", "good"],
            ["Properties", "Soft & Slippery (Lubricant)"],
          ],
          note: "Delocalised electrons move freely through hexagonal layers to conduct electricity.",
          keys: [
            { color: "#94a3b8", shape: "dot", label: "Carbon Atom", note: "sp² hybridized" },
            { color: "#fbbf24", shape: "dot", label: "Delocalised Electron", note: "Free charge carrier" },
            { color: "#64748b", shape: "dash", label: "Interlayer Force", note: "Weak van der Waals" },
          ],
        },
        quartz: {
          title: "Quartz (SiO₂)",
          type: "Giant Covalent Network",
          rows: [
            ["Structure", "Tetrahedral Silica", "gold"],
            ["Ratio", "1 Silicon : 2 Oxygen"],
            ["Melting Point", "1713°C (High)", "good"],
          ],
          note: "Each silicon bonds to 4 oxygen atoms; each oxygen bonds to 2 silicons.",
          keys: [
            { color: "#fbbf24", shape: "dot", label: "Silicon Atom (Si)", note: "Central atom" },
            { color: "#f43f5e", shape: "dot", label: "Oxygen Atom (O)", note: "Bridging atom" },
          ],
        },
        ice: {
          title: "Ice (H₂O)",
          type: "Hydrogen-Bonded Molecular Crystal",
          rows: [
            ["Structure", "Open Hexagonal Cage", "gold"],
            ["Bonding", "Covalent H–O & Hydrogen Bonds"],
            ["Density", "Lower than liquid water", "warn"],
          ],
          note: "Hydrogen bonds hold H₂O molecules in an open tetrahedral lattice, making ice float.",
          keys: [
            { color: "#f43f5e", shape: "dot", label: "Oxygen Atom", note: "Electronegative atom" },
            { color: "#f8fafc", shape: "dot", label: "Hydrogen Atom", note: "Electropositive atom" },
            { color: "#38bdf8", shape: "dash", label: "Hydrogen Bond", note: "Intermolecular attraction" },
          ],
        },
      }[structure] || {};

      readout = {
        title: data.title || "Crystal Lattice",
        subtitle: data.type || "",
        rows: data.rows || [],
        note: data.note || "",
        noteTone: "good",
      };

      legend = {
        title: "Lattice Component Key",
        items: data.keys || [],
      };
      break;
    }

    case "electrolysis": {
      const run = Boolean(params.run);
      const current = Number(params.current) || 1.0;
      const deposit = Math.round(current * 14);

      readout = {
        title: "Electrolysis of CuSO₄",
        subtitle: "Copper electrodes · OIL RIG oxidation & reduction",
        rows: [
          ["Supply Current", run ? `${current.toFixed(1)} A` : "OFF", run ? "gold" : "bad"],
          ["Cathode Deposit", run ? `${deposit} Cu atoms` : "0", run ? "good" : undefined],
          ["Cathode (−) Reaction", "Cu²⁺ + 2e⁻ → Cu (Reduction)", "good"],
          ["Anode (+) Reaction", "Cu → Cu²⁺ + 2e⁻ (Oxidation)", "warn"],
          ["Charge Carriers", "Ions in solution"],
        ],
        note: run
          ? "Copper dissolves from anode (oxidation) and plates onto cathode (reduction) — purifying copper."
          : "Supply is off: electrolysis requires electric potential and mobile ions.",
        noteTone: run ? "good" : "bad",
      };

      legend = {
        title: "Electrochemistry Key",
        items: [
          { color: "#38bdf8", shape: "dot", label: "Cu²⁺ Cation", note: "Positive → moves to negative cathode" },
          { color: "#fbbf24", shape: "dot", label: "SO₄²⁻ Anion", note: "Negative → moves to positive anode" },
          { color: "#34d399", shape: "square", label: "Cathode (−)", note: "Plating copper metal" },
          { color: "#f43f5e", shape: "square", label: "Anode (+)", note: "Dissolving copper metal" },
        ],
      };
      break;
    }

    case "dna": {
      const count = Number(params.pairs) || 16;
      const bases = ["A", "T", "G", "C", "C", "A", "T", "G", "A", "T", "C", "G", "T", "A", "G", "C"];
      const strand1 = bases.slice(0, Math.min(count, bases.length)).join("−");
      const compMap = { A: "T", T: "A", G: "C", C: "G" };
      const strand2 = bases.slice(0, Math.min(count, bases.length)).map((b) => compMap[b]).join("−");

      readout = {
        title: "DNA Double Helix",
        subtitle: "Complementary base pair strands",
        rows: [
          ["Base Pairs Shown", count, "gold"],
          ["Strand 1 (5′→3′)", strand1],
          ["Strand 2 (3′→5′)", strand2],
          ["Base Pairing Rule", "A–T (2 H-bonds), C–G (3 H-bonds)", "good"],
          ["Helix Backbone", "Deoxyribose sugar + phosphate"],
          ["Turn Frequency", "10.5 base pairs per turn"],
        ],
        note: "Unzipping breaks weak hydrogen bonds between strands, allowing each strand to serve as a replication template.",
        noteTone: "good",
      };

      legend = {
        title: "Nucleotide Base Key",
        items: [
          { color: "#f43f5e", shape: "dot", label: "Adenine (A)", note: "Pairs with Thymine (T)" },
          { color: "#38bdf8", shape: "dot", label: "Thymine (T)", note: "Pairs with Adenine (A)" },
          { color: "#fbbf24", shape: "dot", label: "Cytosine (C)", note: "Pairs with Guanine (G)" },
          { color: "#34d399", shape: "dot", label: "Guanine (G)", note: "Pairs with Cytosine (C)" },
          { color: "#94a3b8", shape: "line", label: "Sugar-Phosphate Backbone", note: "Outer structural helical strands" },
        ],
      };
      break;
    }

    case "cell": {
      const cellType = params.cellType || "plant";
      const isPlant = cellType === "plant";
      const tonicity = Number(params.tonicity) || 0;

      let stateText = "Normal (Isotonic)";
      if (tonicity > 0.05) stateText = isPlant ? "Plasmolysed (Hypertonic)" : "Shrivelled (Hypertonic)";
      else if (tonicity < -0.05) stateText = isPlant ? "Turgid (Hypotonic)" : "Lysis / Burst (Hypotonic)";

      readout = {
        title: isPlant ? "Plant Cell Explorer" : "Animal Cell Explorer",
        subtitle: "Osmosis: dilute → concentrated water potential",
        rows: [
          ["External Solution", tonicity > 0.05 ? "Concentrated" : tonicity < -0.05 ? "Dilute" : "Isotonic"],
          ["Net Water Flow", tonicity > 0.05 ? "Out of cell" : tonicity < -0.05 ? "Into cell" : "Equilibrium"],
          ["Cell Status", stateText, tonicity < -0.05 && isPlant ? "good" : tonicity > 0.05 ? "warn" : "default"],
          ["Cellulose Wall", isPlant ? "Yes" : "No", isPlant ? "good" : "bad"],
          ["Chloroplasts", isPlant ? "Yes" : "No", isPlant ? "good" : "bad"],
          ["Permanent Vacuole", isPlant ? "Yes" : "No", isPlant ? "good" : "bad"],
        ],
        note: isPlant
          ? "Rigid cellulose wall withstands internal turgor pressure when water enters by osmosis."
          : "Animal cells lack cell walls; placing in pure water causes excessive swelling and lysis (bursting).",
        noteTone: "neutral",
      };

      legend = {
        title: "Cell Organelle Key",
        items: [
          { color: "#a855f7", shape: "dot", label: "Nucleus", note: "Controls cell activities & DNA" },
          { color: "#f43f5e", shape: "dot", label: "Mitochondria", note: "Site of aerobic respiration" },
          { color: "#34d399", shape: "dot", label: "Chloroplast", note: "Photosynthesis (plant only)" },
          { color: "#38bdf8", shape: "square", label: "Cell Membrane", note: "Partially permeable barrier" },
        ],
      };
      break;
    }

    default:
      return null;
  }

  return (
    <div className="space-y-3">
      {/* ─── Right-Sidebar Live Readout Section ─── */}
      <div className="rounded-lg border border-ink-800 bg-ink-950/60 p-2.5 space-y-2">
        <div className="flex items-center justify-between border-b border-ink-800/80 pb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-duck-300">
            {readout.title}
          </span>
          <span className="text-[9.5px] font-mono text-ink-500">{readout.subtitle}</span>
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 pt-0.5">
          {readout.rows.map(([label, value, tone], i) => (
            <Stat key={i} label={label} value={value} tone={tone || "default"} />
          ))}
        </div>

        {readout.note && (
          <p
            className={`mt-2 rounded-md border p-2 text-[10.5px] leading-relaxed ${
              readout.noteTone === "good"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : readout.noteTone === "bad"
                ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                : readout.noteTone === "warn"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-ink-700 bg-ink-850 text-ink-300"
            }`}
          >
            {readout.note}
          </p>
        )}
      </div>

      {/* ─── Right-Sidebar Visual Legend & Color Key Section ─── */}
      {legend.items && legend.items.length > 0 && (
        <div className="rounded-lg border border-ink-800 bg-ink-950/60 p-2.5 space-y-2">
          <div className="border-b border-ink-800/80 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            {legend.title}
          </div>

          <div className="space-y-1.5">
            {legend.items.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-200">{item.label}</p>
                  {item.note && <p className="text-[10px] text-ink-400 leading-tight">{item.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── The overlay ────────────────────────────────────────────────────

export function VisualizationHUD({ topic, params, setParam, setParams, onReset, onOpenQuiz }) {
  const [open, setOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("controls"); // "controls" | "details"
  const [keyConceptsOpen, setKeyConceptsOpen] = useState(false); // default to false (not toggled)

  // Reopen and reset tab states on topic switch
  useEffect(() => {
    setOpen(true);
    setActiveTab("controls");
    setKeyConceptsOpen(false);
  }, [topic.id]);

  if (!open) {
    return (
      <div className="pointer-events-auto absolute left-4 top-4 z-20 flex flex-wrap items-center gap-1.5">
        <HudButton icon={SlidersHorizontal} onClick={() => { setOpen(true); setActiveTab("controls"); }}>
          Controls
        </HudButton>
        <HudButton icon={Info} onClick={() => { setOpen(true); setActiveTab("details"); }}>
          Details
        </HudButton>
        <HudButton
          icon={Lightbulb}
          variant={keyConceptsOpen ? "primary" : "ghost"}
          onClick={() => {
            setOpen(true);
            setActiveTab("details");
            setKeyConceptsOpen(!keyConceptsOpen);
          }}
        >
          Key Concepts (toggle) [{keyConceptsOpen ? "ON" : "OFF"}]
        </HudButton>
      </div>
    );
  }

  return (
    <div
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute left-4 top-4 z-20 flex max-h-[calc(100%-2rem)] w-[280px] flex-col gap-3 overflow-y-auto pr-0.5"
    >
      <HudPanel
        title={topic.title}
        icon={topic.icon}
        action={
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Hide panel"
            suppressHydrationWarning
            className="shrink-0 rounded p-0.5 text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        }
      >
        {/* ─── Controls vs Details Tab Switcher ─── */}
        <div className="mb-3 flex items-center gap-1 rounded-lg border border-ink-800 bg-ink-950/60 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("controls")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all ${
              activeTab === "controls"
                ? "border border-duck-500/40 bg-duck-500/20 text-duck-300 shadow-sm"
                : "text-ink-400 hover:bg-ink-850 hover:text-ink-200"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
            <span>Controls</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all ${
              activeTab === "details"
                ? "border border-duck-500/40 bg-duck-500/20 text-duck-300 shadow-sm"
                : "text-ink-400 hover:bg-ink-850 hover:text-ink-200"
            }`}
          >
            <Info className="h-3.5 w-3.5" strokeWidth={2} />
            <span>Details</span>
          </button>
        </div>

        {activeTab === "controls" ? (
          <div className="space-y-3">
            {topic.controls.map((control) => (
              <ControlField
                key={control.key}
                control={control}
                params={params}
                setParam={setParam}
                setParams={setParams}
              />
            ))}

            <div className="border-t border-ink-800 pt-2.5">
              <HudButton icon={RotateCcw} onClick={onReset} className="w-full">
                Reset parameters
              </HudButton>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Syllabus & Overview */}
            <div className="rounded-lg border border-ink-800 bg-ink-950/50 p-2.5 space-y-1.5">
              {topic.syllabus && (
                <span className="inline-block rounded border border-duck-500/30 bg-duck-500/10 px-2 py-0.5 text-[10px] font-mono text-duck-300">
                  {topic.syllabus}
                </span>
              )}
              {topic.blurb && (
                <p className="text-xs font-medium leading-relaxed text-ink-200">
                  {topic.blurb}
                </p>
              )}
            </div>

            {/* Key Concepts (toggle) Button & Content */}
            <div className="rounded-lg border border-ink-800 bg-ink-900/60 p-2.5">
              <button
                type="button"
                onClick={() => setKeyConceptsOpen(!keyConceptsOpen)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-3.5 w-3.5 shrink-0 text-duck-400" strokeWidth={2} />
                  <span className="text-xs font-semibold text-ink-100">
                    Key Concepts (toggle)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                      keyConceptsOpen
                        ? "border border-duck-500/40 bg-duck-500/20 text-duck-300"
                        : "bg-ink-800 text-ink-400"
                    }`}
                  >
                    {keyConceptsOpen ? "ON" : "OFF"}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-ink-400 transition-transform duration-200 ${
                      keyConceptsOpen ? "rotate-180 text-duck-300" : ""
                    }`}
                    strokeWidth={2}
                  />
                </div>
              </button>

              {keyConceptsOpen && (
                <div className="mt-3 space-y-2 border-t border-ink-800/80 pt-2.5">
                  {topic.concepts &&
                    topic.concepts.map((concept, i) => (
                      <div key={i} className="flex gap-2">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-duck-400"
                          aria-hidden="true"
                        />
                        <p className="text-[11px] leading-relaxed text-ink-200">{concept}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Calculated Details Readout */}
            {renderTopicDetailsReadout(topic, params)}

            {/* Quiz Button */}
            {onOpenQuiz && (
              <button
                type="button"
                onClick={onOpenQuiz}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-duck-400 px-3 py-2 text-[11px] font-semibold text-ink-950 transition-colors hover:bg-duck-300 shadow-md"
              >
                <Target className="h-3.5 w-3.5" strokeWidth={2.25} />
                Test understanding
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            )}
          </div>
        )}
      </HudPanel>
    </div>
  );
}

// ─── Socratic quiz ──────────────────────────────────────────────────

export function QuizOverlay({ topic, onClose }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const quizList = topic?.quiz || [];
  const question = quizList[index];
  const isLast = quizList.length > 0 ? index === quizList.length - 1 : true;

  const choose = (option) => {
    if (picked !== null || !question) return;
    setPicked(option);
    if (option === question.answer) setCorrect((c) => c + 1);
  };

  const next = () => {
    if (isLast) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  };

  const retry = () => {
    setIndex(0);
    setPicked(null);
    setCorrect(0);
    setFinished(false);
  };

  if (quizList.length === 0 || !question) {
    return (
      <>
        <div
          onClick={onClose}
          aria-hidden="true"
          className="fixed inset-0 z-[200] bg-ink-950/80 backdrop-blur-sm"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quiz"
          className="fixed left-1/2 top-1/2 z-[210] w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-ink-700 bg-ink-900 p-6 shadow-2xl text-center"
        >
          <p className="text-sm text-ink-200">No quiz questions available for this topic yet.</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-lg bg-duck-400 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-duck-300"
          >
            Back to the model
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-[200] bg-ink-950/80 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Test understanding — ${topic.title}`}
        className="fixed left-1/2 top-1/2 z-[210] w-[min(580px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-ink-700 bg-ink-900 shadow-2xl"
      >
        <header className="sticky top-0 flex items-center justify-between gap-3 border-b border-ink-800 bg-ink-900 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="text-base leading-none">{topic.emoji}</span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-ink-100">
                Test understanding
              </h2>
              <p className="truncate text-[11px] text-ink-500">{topic.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quiz"
            className="shrink-0 rounded-md p-1.5 text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>

        {finished ? (
          <div className="px-5 py-8 text-center">
            <p className="text-4xl font-semibold tabular-nums text-duck-400">
              {correct}
              <span className="text-lg text-ink-500"> / {topic.quiz.length}</span>
            </p>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-200">
              {correct === topic.quiz.length
                ? "Both right — you can explain this one, not just recognise it. Push a control to a value you have not predicted yet and see if you still can."
                : correct === 0
                  ? "Nothing landed yet. Go back to the model, change one variable at a time, and watch which number moves with it."
                  : "Half-solid. The one you missed is worth reproducing in the 3D model before you move on."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={retry}
                className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-200 transition-colors hover:bg-ink-800"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-duck-400 px-4 py-2 text-sm font-medium text-ink-950 transition-colors hover:bg-duck-300"
              >
                Back to the model
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 py-5">
            <div className="mb-4 flex items-center gap-2">
              {topic.quiz.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full ${
                    i < index ? "bg-duck-500" : i === index ? "bg-duck-400" : "bg-ink-800"
                  }`}
                />
              ))}
              <span className="ml-1 shrink-0 text-[10px] tabular-nums text-ink-500">
                {index + 1}/{topic.quiz.length}
              </span>
            </div>

            <p className="mb-4 text-sm leading-relaxed text-ink-100">{question.question}</p>

            <div className="space-y-1.5">
              {question.options.map((option, i) => {
                const isAnswer = i === question.answer;
                const isPicked = picked === i;
                const revealed = picked !== null;
                let tone =
                  "border-ink-700 bg-ink-850 text-ink-200 hover:border-ink-600 hover:bg-ink-800";
                if (revealed && isAnswer) {
                  tone = "border-emerald-500/50 bg-emerald-500/10 text-emerald-300";
                } else if (revealed && isPicked) {
                  tone = "border-rose-500/50 bg-rose-500/10 text-rose-300";
                } else if (revealed) {
                  tone = "border-ink-800 bg-ink-850/50 text-ink-500";
                }
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => choose(i)}
                    disabled={revealed}
                    className={`flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-default ${tone}`}
                  >
                    <span className="mt-0.5 shrink-0 text-[11px] font-medium opacity-60">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1 leading-snug">{option}</span>
                    {revealed && isAnswer && (
                      <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
                    )}
                    {revealed && isPicked && !isAnswer && (
                      <X className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
                    )}
                  </button>
                );
              })}
            </div>

            {picked !== null && (
              <div className="mt-4 rounded-lg border border-ink-800 bg-ink-850 px-3 py-2.5">
                <p className="text-xs leading-relaxed text-ink-200">
                  {question.explanation}
                </p>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={next}
                disabled={picked === null}
                className="rounded-lg bg-duck-400 px-4 py-2 text-sm font-medium text-ink-950 transition-opacity disabled:opacity-30"
              >
                {isLast ? "See result" : "Next question"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default VisualizationHUD;

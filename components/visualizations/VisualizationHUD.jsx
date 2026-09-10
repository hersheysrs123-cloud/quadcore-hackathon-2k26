"use client";

import { useEffect, useState, useRef } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Lightbulb,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { solveIncline, surfaceFor } from "@/lib/inclineForces";
import { loadForce, solveSpring } from "@/lib/hookesLaw";
import { isLever, solveMachine } from "@/lib/simpleMachines";
import { buildTrack, minimumReleaseHeight, minimumTopSpeed } from "@/lib/coasterEnergy";

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
      className={`rounded-xl border border-ink-800 bg-ink-900 p-3.5 shadow-2xl ${className}`}
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

const num = (v, fallback) => (v !== undefined && v !== null && !isNaN(Number(v)) ? Number(v) : fallback);

function renderTopicDetailsReadout(topic, params) {
  if (!topic || !params) return null;

  let readout = { title: "", subtitle: "", rows: [], note: "", noteTone: "neutral" };
  let legend = { title: "Visual Key", items: [] };

  switch (topic.id) {
    // ═════════════════════════════════════════════════════════════════════
    // 1. PHYSICS
    // ═════════════════════════════════════════════════════════════════════

    case "refraction": {
      const n1 = num(params.n1, 1.0);
      const n2 = num(params.n2, 1.5);
      const iDeg = num(params.angle, 0);
      const iRad = (iDeg * Math.PI) / 180;
      const sinR = (n1 * Math.sin(iRad)) / n2;
      const thickness = num(params.thickness, 3.0);

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
          { color: "#38bdf8", shape: "line", label: "Incident / Refracted / Emergent Ray", note: `${params.wavelength || 520} nm beam` },
          { color: "#fbbf24", shape: "line", label: "Reflected Ray", note: "Fresnel partial reflection / TIR" },
          { color: "#64748b", shape: "dash", label: "Normal Line", note: "Perpendicular (90°) boundary reference" },
          { color: "#0ea5e9", shape: "square", label: "Optical Medium Block", note: `Refractive index n = ${n2.toFixed(2)}` },
        ],
      };
      break;
    }

    case "motor": {
      const I = num(params.current, 0);
      const B = num(params.field, 0);
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
        note: hasForce
          ? "Fleming's Left-Hand Rule: First finger = Field (N→S), seCond finger = Current (+→−), Thumb = Force/Motion direction."
          : "Zero current or zero field produces no magnetic Lorentz force.",
        noteTone: hasForce ? "good" : "bad",
      };

      legend = {
        title: "Fleming's Left Hand & Magnetic Key",
        items: [
          { color: "#38bdf8", shape: "line", label: "First finger — Field B", note: "Magnetic flux lines (N → S)" },
          { color: "#fbbf24", shape: "line", label: "seCond finger — Current I", note: "Conventional current (+ to −)" },
          { color: "#34d399", shape: "line", label: "Thumb — Motion / Force F", note: "Resulting Lorentz force vector" },
          { color: "#ef4444", shape: "square", label: "North Pole (N)", note: "Magnetic source pole" },
          { color: "#3b82f6", shape: "square", label: "South Pole (S)", note: "Magnetic sink pole" },
        ],
      };
      break;
    }

    case "lenses": {
      const type = params.lensType || "convex";
      const isConvex = type === "convex";
      const f = num(params.focal, 2);
      const u = num(params.objectDistance, 5);

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
          { color: "#fbbf24", shape: "square", label: "Object Arrow", note: "Source object of fixed height" },
          { color: "#34d399", shape: "line", label: "Ray 1 (Parallel → Focus)", note: isConvex ? "Refracts through focal point F" : "Diverges in line with focal point F" },
          { color: "#38bdf8", shape: "line", label: "Ray 2 (Optical Center)", note: "Passes straight through undeviated" },
          { color: "#f43f5e", shape: "square", label: "Formed Image Arrow", note: natureText || "Projected image" },
          { color: "#f43f5e", shape: "dash", label: "Virtual Ray Extension", note: "Apparent ray back-projection" },
          { color: "#64748b", shape: "line", label: "Principal Axis", note: "Central horizontal optical reference" },
        ],
      };
      break;
    }

    case "induction": {
      const speed = num(params.speed, 0);
      const B = num(params.field, 0);
      const N = num(params.turns, 1);
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
          { color: "#ef4444", shape: "square", label: "North Pole (N)", note: "Magnetic field source" },
          { color: "#3b82f6", shape: "square", label: "South Pole (S)", note: "Magnetic field sink" },
          { color: "#38bdf8", shape: "dash", label: "Magnetic Field Lines B", note: "Flux density vector lines" },
          { color: "#fbbf24", shape: "line", label: "Rotating Coil Wire", note: "Cuts field lines to induce e.m.f." },
          { color: "#34d399", shape: "dot", label: "Induced AC Pulses", note: "Alternating electron flow" },
          { color: "#38bdf8", shape: "line", label: "Induced EMF Waveform", note: "Sinusoidal voltage output" },
        ],
      };
      break;
    }

    case "gas": {
      const T = num(params.temperature, 300);
      const V = num(params.volume, 1);
      const N = num(params.particles, 60);
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
          { color: "#ef4444", shape: "dot", label: "Hot Gas Particle", note: "High kinetic energy / speed" },
          { color: "#38bdf8", shape: "dot", label: "Cold Gas Particle", note: "Lower kinetic energy / speed" },
          { color: "#64748b", shape: "square", label: "Piston / Cylinder Wall", note: "Enclosed volume boundary" },
          { color: "#fbbf24", shape: "dot", label: "Wall Collision Impulses", note: "Transfers momentum to generate pressure" },
        ],
      };
      break;
    }

    case "projectile": {
      const speed = num(params.launchSpeed ?? params.speed, 22);
      const angle = num(params.angle, 45);
      const gravity = num(params.gravity, 9.81);
      const drag = num(params.drag, 0.04);
      const mass = num(params.mass, 1);

      const rad = (angle * Math.PI) / 180;
      const idealRange = (speed * speed * Math.sin(2 * rad)) / gravity;
      const idealApex = (speed * speed * Math.sin(rad) * Math.sin(rad)) / (2 * gravity);
      const idealTime = (2 * speed * Math.sin(rad)) / gravity;

      const dragLossEst = drag > 0 ? Math.min(0.65, drag * 10) : 0;
      const estRange = idealRange * (1 - dragLossEst);
      const estApex = idealApex * (1 - dragLossEst * 0.5);

      readout = {
        title: "2D Projectile Trajectory",
        subtitle: "F_drag = −k|v|v · gravity = −g ĵ",
        rows: [
          ["Launch Speed v₀", `${speed.toFixed(1)} m/s`, "gold"],
          ["Launch Angle θ", `${angle.toFixed(1)}°`],
          ["Gravity g", `${gravity.toFixed(2)} m/s²`],
          ["Drag Coefficient k", `${drag.toFixed(3)}`],
          ["Range with Drag", `${estRange.toFixed(1)} m`, "good"],
          ["Ideal Range (No Drag)", `${idealRange.toFixed(1)} m`],
          ["Apex Height", `${estApex.toFixed(1)} m`],
          ["Ideal Flight Time", `${idealTime.toFixed(2)} s`],
        ],
        note: drag > 0.005
          ? `Quadratic drag causes the projectile to lose horizontal momentum throughout its flight, steepening its descent and reducing range by approx ${(dragLossEst * 100).toFixed(0)}%.`
          : "With zero atmospheric drag, the flight path is a perfect symmetrical parabola with maximum range achieved at exactly 45°.",
        noteTone: drag > 0.005 ? "warn" : "good",
      };

      legend = {
        title: "Ballistic Trajectory Key",
        items: [
          { color: "#34d399", shape: "line", label: "Trajectory with Drag", note: "Realistic asymmetric flight path" },
          { color: "#64748b", shape: "dash", label: "Ideal Parabola (No Drag)", note: "Theoretical symmetric vacuum path" },
          { color: "#38bdf8", shape: "line", label: "Velocity Vector v", note: "Instantaneous tangential velocity" },
          { color: "#fb7185", shape: "line", label: "Weight Vector W", note: "Constant downward gravitational force" },
          { color: "#fbbf24", shape: "dot", label: "Projectile Mass m", note: `${mass} kg launch mass` },
        ],
      };
      break;
    }

    case "interference": {
      const slits = num(params.slits, 2);
      const separation = num(params.separation, 2.2);
      const wavelength = num(params.wavelength, 1.2);
      const L = 10.2;

      const ratio = wavelength / separation;
      const fringeSpacing = slits === 2 ? (wavelength * L) / separation : null;
      const firstOrderX = slits === 2 && ratio <= 1 ? L * Math.tan(Math.asin(ratio)) : null;
      const highestOrder = slits === 2 ? Math.floor(separation / wavelength) : 0;

      readout = {
        title: "Wave Interference & Fringes",
        subtitle: slits === 2 ? "d sin θ = mλ (path difference decides fringes)" : "Single source diffraction",
        rows: [
          ["Slit Sources", slits, "gold"],
          ["Wavelength λ", `${wavelength.toFixed(2)} m`],
          ["Slit Separation d", slits === 2 ? `${separation.toFixed(2)} m` : "—"],
          ["Screen Distance L", `${L.toFixed(1)} m`],
          ["1st Max Position x", firstOrderX ? `${firstOrderX.toFixed(2)} m` : "—", "good"],
          ["λL ÷ d Estimate", fringeSpacing ? `${fringeSpacing.toFixed(2)} m` : "—"],
          ["Highest Order m_max", slits === 2 ? highestOrder : "—"],
        ],
        note: slits === 1
          ? "A single source produces circular wavefronts with uniform radial decay. Switch to 2 slits to create interference fringes."
          : "Constructive interference (bright fringes) occurs where path difference is an integer multiple of λ (mλ). Destructive interference occurs at half-wavelengths.",
        noteTone: slits === 2 ? "good" : "neutral",
      };

      legend = {
        title: "Wave Interference Key",
        items: [
          { color: "#fbbf24", shape: "square", label: "Wave Crest", note: "Positive displacement ripple peak" },
          { color: "#a78bfa", shape: "square", label: "Wave Trough", note: "Negative displacement ripple valley" },
          { color: "#fbbf24", shape: "dot", label: "Slit Source Emitter", note: "Coherent wave source in phase" },
          { color: "#39424f", shape: "square", label: "Double Slit Barrier", note: "Opaque aperture obstacle" },
          { color: "#fbbf24", shape: "line", label: "Screen Intensity Fringes", note: "Constructive interference maxima" },
        ],
      };
      break;
    }

    case "orbits": {
      const mass = num(params.mass, 1);
      const launchRadius = num(params.launchRadius, 3.4);
      const launchSpeed = num(params.launchSpeed, 1.35);
      const mu = 6 * mass;

      const circular = Math.sqrt(mu / launchRadius);
      const escapeSpeed = Math.sqrt((2 * mu) / launchRadius);
      const energy = (launchSpeed * launchSpeed) / 2 - mu / launchRadius;
      const unbound = energy >= 0;

      readout = {
        title: "Keplerian Gravitational Orbits",
        subtitle: "Specific orbital energy ε = v²/2 − GM/r",
        rows: [
          ["Grav Parameter μ", `${mu.toFixed(1)}`, "gold"],
          ["Launch Radius r₀", `${launchRadius.toFixed(2)} AU`],
          ["Launch Speed v₀", `${launchSpeed.toFixed(2)} km/s`, "gold"],
          ["Circular Speed v_c", `${circular.toFixed(2)} km/s`],
          ["Escape Speed v_esc", `${escapeSpeed.toFixed(2)} km/s`],
          ["Orbital Energy ε", `${energy.toFixed(2)} J/kg`, unbound ? "bad" : "good"],
          ["Trajectory Type", unbound ? "Hyperbolic (Escape)" : Math.abs(launchSpeed - circular) < 0.05 ? "Circular" : "Elliptical", unbound ? "bad" : "good"],
        ],
        note: unbound
          ? "Launch speed exceeds escape velocity (ε ≥ 0): the satellite is on an open hyperbolic path and will permanently escape the gravitational well."
          : Math.abs(launchSpeed - circular) < 0.05
          ? "Launch speed matches circular velocity: centripetal force exactly balances gravitational attraction, maintaining constant orbital radius."
          : "Launch speed is bounded (ε < 0): the satellite travels in a stable elliptical orbit around the central focus.",
        noteTone: unbound ? "bad" : "good",
      };

      legend = {
        title: "Gravitational Orbit Key",
        items: [
          { color: "#fbbf24", shape: "dot", label: "Central Mass (Star / Planet)", note: "Gravitational source creating potential well" },
          { color: "#34d399", shape: "dot", label: "Orbiting Satellite", note: "Body in continuous gravitational free-fall" },
          { color: "#34d399", shape: "line", label: "Orbital Path Trail", note: "Closed elliptical or open escape trajectory" },
          { color: "#38bdf8", shape: "line", label: "Spacetime Potential Sheet", note: "Depth represents −GM/r potential energy" },
        ],
      };
      break;
    }

    case "incline_friction": {
      const angle = num(params.rampAngle, 20);
      const mass = num(params.blockMass, 10);
      const applied = num(params.appliedForce, 0);
      const key = params.surface || "wood";
      const s = surfaceFor(key);
      // Solved at rest: the panel describes the situation the block is IN,
      // and re-deriving it here rather than mirroring the scene's arithmetic
      // is what stops the two drifting apart.
      const f = solveIncline({ massKg: mass, angleDeg: angle, surface: key, appliedForce: applied });
      const slips = angle > f.reposeAngle + 1e-9;

      readout = {
        title: "Block on an Incline",
        subtitle: `${s.label} · μs = ${s.muS}, μk = ${s.muK}`,
        rows: [
          ["Weight W = mg", `${f.weight.toFixed(1)} N`],
          ["W∥ = mg sinθ", `${f.weightParallel.toFixed(1)} N`, "gold"],
          ["W⊥ = mg cosθ", `${f.weightPerpendicular.toFixed(1)} N`],
          ["Normal force N", `${f.normal.toFixed(1)} N`, "good"],
          ["Friction acting", `${f.frictionMagnitude.toFixed(1)} N`, f.isStatic ? "good" : "warn"],
          ["Maximum grip μs·N", `${f.grip.toFixed(1)} N`],
          ["Grip in use", `${(f.gripUsed * 100).toFixed(0)}%`, f.onTheVerge ? "warn" : f.isStatic ? "good" : "bad"],
          ["Kinetic friction μk·N", `${f.slidingFriction.toFixed(1)} N`],
          ["Applied force F", applied === 0 ? "none" : `${applied.toFixed(0)} N ${applied > 0 ? "up" : "down"} the ramp`],
          ["Resultant ΣF", `${f.netForce.toFixed(1)} N`, Math.abs(f.netForce) < 0.05 ? "good" : "warn"],
          ["Acceleration a", `${f.acceleration.toFixed(2)} m/s²`, f.isStatic ? "good" : "bad"],
          ["State", f.isStatic ? "in equilibrium" : "sliding", f.isStatic ? "good" : "bad"],
          ["Angle of repose", `${f.reposeAngle.toFixed(1)}°`, slips ? "bad" : "good"],
        ],
        note: f.isStatic
          ? f.onTheVerge
            ? `On the verge: friction is supplying ${f.frictionMagnitude.toFixed(1)} N of the ${f.grip.toFixed(1)} N available. One more degree and it goes.`
            : `Static friction is supplying exactly ${f.frictionMagnitude.toFixed(1)} N — no more than the ${f.demand.toFixed(1)} N being asked of it. It could supply up to ${f.grip.toFixed(1)} N, so f ≤ μs·N still holds with room to spare.`
          : `Sliding, so friction is now fixed at μk·N = ${f.slidingFriction.toFixed(1)} N and no longer adjusts. The resultant ${Math.abs(f.netForce).toFixed(1)} N gives a = ${Math.abs(f.acceleration).toFixed(2)} m/s² ${f.acceleration < 0 ? "down" : "up"} the slope.`,
        noteTone: f.isStatic ? (f.onTheVerge ? "warn" : "good") : "bad",
      };

      legend = {
        title: "Free-Body Diagram Key",
        items: [
          { color: "#fb7185", label: "Weight W = mg", note: "vertically down, whatever the slope does" },
          { color: "#fb923c", label: "W∥ = mg sinθ", note: `${f.weightParallel.toFixed(1)} N down the surface` },
          { color: "#a78bfa", label: "W⊥ = mg cosθ", note: `${f.weightPerpendicular.toFixed(1)} N into the surface` },
          { color: "#38bdf8", label: "Normal force N", note: "equal and opposite to W⊥ — they cancel" },
          { color: "#2dd4bf", label: "Friction f", note: f.isStatic ? "a reaction, ≤ μs·N" : "fixed at μk·N once sliding" },
          { color: "#fbbf24", label: "Applied force F", note: "acts along the ramp, so N is unchanged" },
          { color: "#34d399", label: "Resultant ΣF", note: "whatever is left over — this is ma" },
        ],
      };
      break;
    }

    case "hookes_law": {
      const massKg = num(params.hangingMass, 0.5);
      const k = num(params.springConstant, 80);
      const force = loadForce(massKg);
      // The Details panel has no access to the spring's history — that lives
      // in the scene, because it is a property of the spring rather than a
      // setting. So this describes the spring as if freshly fitted, and says so.
      const sp = solveSpring({ massKg, k });
      const cm = (m) => (m * 100).toFixed(2);

      readout = {
        title: "Spring Under Load",
        subtitle: "F = kx · below the elastic limit only",
        rows: [
          ["Hanging mass", massKg < 1 ? `${(massKg * 1000).toFixed(0)} g` : `${massKg.toFixed(2)} kg`],
          ["Applied force F = mg", `${force.toFixed(2)} N`, "gold"],
          ["Spring constant k", `${k} N/m`],
          ["Extension x", `${cm(sp.extension)} cm`, sp.elastic ? "good" : "warn"],
          ["Spring length", `${cm(sp.length)} cm`],
          ["Natural length L₀", `${cm(sp.naturalLength)} cm`],
          ["Gradient ΔF/Δx", `${sp.stiffness.toFixed(0)} N/m`, sp.elastic ? "good" : "bad"],
          ["Elastic limit at", `${sp.limitForce.toFixed(2)} N (${cm(sp.limitExtension)} cm)`],
          ["Heaviest safe mass", `${sp.safeMassKg.toFixed(2)} kg`, "good"],
          ["Limit used", `${(sp.limitUsed * 100).toFixed(0)}%`, sp.limitUsed > 0.95 ? "bad" : sp.limitUsed > 0.75 ? "warn" : "good"],
          ["Energy ½kx²", `${sp.elasticEnergy.toFixed(3)} J`],
          ["Recoverable energy", `${sp.recoverableEnergy.toFixed(3)} J`, sp.elastic ? "good" : "warn"],
          ["Permanent set", sp.permanentSet > 0 ? `${cm(sp.permanentSet)} cm` : "none", sp.permanentSet > 0 ? "bad" : "good"],
        ],
        note: sp.failed
          ? `Far too much: at ${force.toFixed(1)} N this ${k} N/m spring has had its coils pulled straight and is scrap. It gives way at ${sp.failureForce.toFixed(1)} N.`
          : sp.yielding
            ? `Past the elastic limit. The graph has bent over — the gradient has fallen from ${k} to about ${sp.stiffness.toFixed(0)} N/m — and the spring will not return to L₀ when this load comes off.`
            : `Elastic: x = F ÷ k = ${force.toFixed(2)} ÷ ${k} = ${cm(sp.extension)} cm, and the spring returns to L₀ when unloaded. It stays proportional up to ${sp.limitForce.toFixed(2)} N, which is ${sp.safeMassKg.toFixed(2)} kg.`,
        noteTone: sp.failed ? "bad" : sp.yielding ? "warn" : "good",
      };

      legend = {
        title: "Force–Extension Graph Key",
        items: [
          { color: "#38bdf8", label: "Hooke's law region", note: "straight line through the origin, gradient k" },
          { color: "#fbbf24", label: "Plastic region", note: "graph bends over — the spring is yielding" },
          { color: "#f43f5e", label: "Elastic limit", note: `${sp.limitForce.toFixed(2)} N for this spring` },
          { color: "#34d399", label: "Measured gradient", note: "ΔF/Δx drawn where the load currently sits" },
          { color: "#cbd5e1", label: "Working point", note: `${cm(sp.extension)} cm at ${force.toFixed(2)} N` },
        ],
      };
      break;
    }

    case "simple_machines": {
      const type = params.machineType || "lever1";
      const p = num(params.armPosition, 0.35);
      const sheaves = num(params.sheaves, 2);
      const loadN = num(params.loadN, 300);
      const m = solveMachine({ type, p, sheaves, loadN });
      const lever = isLever(type);

      readout = {
        title: m.machine.label,
        subtitle: m.machine.order,
        rows: [
          ["Load", `${loadN.toFixed(0)} N (${m.loadMassKg.toFixed(1)} kg)`, "gold"],
          ["Effort needed", `${m.effortForce.toFixed(1)} N`, m.losesForce ? "bad" : "good"],
          ...(lever
            ? [
                ["Effort arm", `${m.layout.effortArm.toFixed(2)} m`],
                ["Load arm", `${m.layout.loadArm.toFixed(2)} m`],
              ]
            : [["Supporting ropes", `${m.ropes}`]]),
          ["Distance ratio d_e/d_l", `${m.velocityRatio.toFixed(2)}`],
          ["Mechanical advantage", `${m.mechanicalAdvantage.toFixed(2)}`, m.losesForce ? "warn" : "good"],
          ["Load moves", `${(m.loadDistance * 100).toFixed(1)} cm`],
          ["Effort moves", `${(m.effortDistance * 100).toFixed(1)} cm`],
          ["Work in", `${m.workIn.toFixed(1)} J`],
          ["Work out", `${m.workOut.toFixed(1)} J`, "good"],
          ["Wasted as heat", `${m.wasted.toFixed(1)} J`, m.wasted > 0 ? "warn" : "good"],
          ["Efficiency", `${(m.efficiency * 100).toFixed(1)}%`, m.efficiency > 0.9 ? "good" : "warn"],
        ],
        note: m.losesForce
          ? `This machine costs force rather than saving it: ${m.effortForce.toFixed(0)} N of effort to lift ${loadN.toFixed(0)} N. What you get back is speed and reach — the load moves ${(1 / m.velocityRatio).toFixed(1)}× further than your hand does. Your forearm is built this way.`
          : `The effort is ${m.mechanicalAdvantage.toFixed(2)}× smaller than the load, and has to move ${m.velocityRatio.toFixed(2)}× further. Multiply those and you are back where you started — no machine reduces the work, only the force.`,
        noteTone: m.losesForce ? "warn" : "good",
      };

      legend = {
        title: "Work Bookkeeping Key",
        items: [
          { color: "#fbbf24", label: "Work in", note: `${m.effortForce.toFixed(1)} N × ${(m.effortDistance * 100).toFixed(1)} cm = ${m.workIn.toFixed(1)} J` },
          { color: "#34d399", label: "Work out", note: `${loadN.toFixed(0)} N × ${(m.loadDistance * 100).toFixed(1)} cm = ${m.workOut.toFixed(1)} J` },
          { color: "#fb7185", label: "Wasted as heat", note: `${m.wasted.toFixed(1)} J at the ${lever ? "pivot" : "sheaves"}` },
          { color: "#e8ebf0", label: "Distance ratio", note: "geometry only — friction cannot change it" },
        ],
      };
      break;
    }

    case "roller_coaster_energy": {
      const h0 = num(params.releaseHeight, 25);
      const R = num(params.loopRadius, 8);
      const mass = num(params.cartMass, 500);
      const rough = Boolean(params.friction);
      const g = 9.81;

      const minH = minimumReleaseHeight(R);
      const vNeeded = minimumTopSpeed(R);
      // Ideal figures: what conservation alone predicts, before any friction.
      const vGround = Math.sqrt(2 * g * h0);
      const vTop = Math.sqrt(Math.max(2 * g * (h0 - 2 * R), 0));
      const clears = h0 >= minH;
      const startEnergy = mass * g * h0;
      const track = buildTrack({ releaseHeight: h0, loopRadius: R });

      readout = {
        title: "Roller Coaster Energy",
        subtitle: rough ? "steel on steel — some energy is lost" : "frictionless ideal",
        rows: [
          ["Release height h₀", `${h0.toFixed(0)} m`, clears ? "good" : "bad"],
          ["Loop radius R", `${R.toFixed(0)} m`],
          ["Loop top height 2R", `${(2 * R).toFixed(0)} m`],
          ["Cart mass", `${mass.toFixed(0)} kg`],
          ["Starting GPE", `${(startEnergy / 1000).toFixed(1)} kJ`, "gold"],
          ["Speed at the ground", `${vGround.toFixed(1)} m/s`],
          ["Speed at the loop top", `${vTop.toFixed(1)} m/s`, clears ? "good" : "bad"],
          ["Needed at the top √(gR)", `${vNeeded.toFixed(1)} m/s`],
          ["Minimum height 2.5R", `${minH.toFixed(1)} m`, clears ? "good" : "bad"],
          ["g-force at the loop top", `${(vTop * vTop / (g * R) - 1).toFixed(2)} g`, clears ? "good" : "bad"],
          ["g-force at the loop foot", `${(2 * g * h0 / (g * R) + 1).toFixed(2)} g`, 2 * h0 / R + 1 > 5 ? "warn" : "good"],
          ["Track length", `${track.length.toFixed(0)} m`],
        ],
        note: !clears
          ? `Below the threshold. At the top of the loop the cart would only have ${vTop.toFixed(1)} m/s, and it needs √(gR) = ${vNeeded.toFixed(1)} m/s for gravity alone to supply the centripetal force. Any slower and the rail would have to pull the cart inward, which it cannot — so the cart falls away from the track. Raise the release height above ${minH.toFixed(1)} m.`
          : rough
            ? `Clears the loop, and note the mass is irrelevant to that: it appears on both sides of ½mv² = mgh and cancels. With friction on, some of the starting ${(startEnergy / 1000).toFixed(0)} kJ ends up as heat in the wheels and brakes — the three bars still add to the same total, but the heat bar never gives anything back.`
            : `Clears the loop with ${vTop.toFixed(1)} m/s against the ${vNeeded.toFixed(1)} m/s needed. With no friction, GPE and KE simply trade places: every metre of height lost buys exactly ½v² of speed, whatever the cart weighs.`,
        noteTone: !clears ? "bad" : rough ? "warn" : "good",
      };

      legend = {
        title: "Energy & Forces Key",
        items: [
          { color: "#a78bfa", label: "GPE = mgh", note: `${(startEnergy / 1000).toFixed(1)} kJ at the top of the drop` },
          { color: "#38bdf8", label: "KE = ½mv²", note: `all ${(startEnergy / 1000).toFixed(1)} kJ of it at ground level` },
          { color: "#fb7185", label: "Thermal", note: rough ? "friction and brakes — one-way" : "none: the ideal track wastes nothing" },
          { color: "#e8ebf0", label: "Total", note: "constant — that is what conservation means" },
          { color: "#fbbf24", label: "The cart", note: `${mass.toFixed(0)} kg, and the mass changes nothing about the loop` },
        ],
      };
      break;
    }

    // ═════════════════════════════════════════════════════════════════════
    // 2. CHEMISTRY
    // ═════════════════════════════════════════════════════════════════════

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
          { color: "#ef4444", shape: "dot", label: "Proton (+1 charge)", note: `${data.z} positive nuclear protons` },
          { color: "#94a3b8", shape: "dot", label: "Neutron (0 charge)", note: `${data.n} neutral nuclear neutrons` },
          { color: "#38bdf8", shape: "dot", label: "Core Electron", note: "Filled, stable inner electron shells" },
          { color: "#fbbf24", shape: "dot", label: "Valence Electron", note: "Outer shell chemically reactive electron" },
          { color: "#a78bfa", shape: "line", label: "Photon Wave Packet", note: "Quantized light emission during shell drop" },
        ],
      };
      break;
    }

    case "organic": {
      const family = params.family || "alkane";
      const n = num(params.carbons, 3);
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
          { color: "#ef4444", shape: "dot", label: "Oxygen Atom (O)", note: "Forms 2 covalent bonds in functional groups" },
          { color: "#fbbf24", shape: "line", label: "Single Covalent Bond", note: "Shared electron pair (sigma bond)" },
          { color: "#94a3b8", shape: "line", label: "Double / Triple Bond", note: "Unsaturated pi bond system" },
        ],
      };
      break;
    }

    case "distillation": {
      const heat = num(params.heat, 0.7);
      const furnace = Math.round(250 + heat * 200);

      const fractions = [
        { name: "Refinery gases", chain: "C1–C4", top: 20, use: "bottled gas fuel", colour: "#ef4444" },
        { name: "Petrol / Gasoline", chain: "C5–C9", top: 70, use: "fuel for cars", colour: "#fbbf24" },
        { name: "Naphtha", chain: "C8–C12", top: 120, use: "chemical feedstock", colour: "#a78bfa" },
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
          shape: "square",
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
            { color: "#38bdf8", shape: "line", label: "Ionic Attraction", note: "Electrostatic matrix bond" },
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
            { color: "#94a3b8", shape: "dot", label: "Carbon Atom", note: "sp³ hybridized carbon" },
            { color: "#38bdf8", shape: "line", label: "Covalent Bond", note: "Strong directional covalent link" },
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
            { color: "#94a3b8", shape: "dot", label: "Carbon Atom", note: "sp² hybridized carbon" },
            { color: "#fbbf24", shape: "dot", label: "Delocalised Electron", note: "Free electrical charge carrier" },
            { color: "#64748b", shape: "dash", label: "Interlayer Force", note: "Weak van der Waals attraction" },
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
            { color: "#fbbf24", shape: "dot", label: "Silicon Atom (Si)", note: "Central tetravalent silicon" },
            { color: "#ef4444", shape: "dot", label: "Oxygen Atom (O)", note: "Bridging divalent oxygen" },
            { color: "#38bdf8", shape: "line", label: "Si–O Bond", note: "Strong covalent silicate link" },
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
            { color: "#ef4444", shape: "dot", label: "Oxygen Atom", note: "Electronegative central atom" },
            { color: "#f8fafc", shape: "dot", label: "Hydrogen Atom", note: "Electropositive bonded atom" },
            { color: "#38bdf8", shape: "dash", label: "Hydrogen Bond", note: "Intermolecular dipole attraction" },
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
      const current = num(params.current, 1.0);
      const deposit = Math.round(current * 14);

      readout = {
        title: "Electrolysis of Aqueous CuSO₄",
        subtitle: "Copper electrodes · OIL RIG oxidation & reduction",
        rows: [
          ["Supply Current", run ? `${current.toFixed(1)} A` : "OFF", run ? "gold" : "bad"],
          ["Cathode Deposit", run ? `${deposit} Cu atoms` : "0", run ? "good" : undefined],
          ["Cathode (−) Reaction", "Cu²⁺ + 2e⁻ → Cu (Reduction)", "good"],
          ["Anode (+) Reaction", "Cu → Cu²⁺ + 2e⁻ (Oxidation)", "warn"],
          ["Charge Carriers", "Ions in solution, electrons in wire"],
        ],
        note: run
          ? "Copper dissolves from anode (oxidation) and plates onto cathode (reduction) — purifying copper."
          : "Supply is off: electrolysis requires electric potential and mobile ions.",
        noteTone: run ? "good" : "bad",
      };

      legend = {
        title: "Electrochemistry Key",
        items: [
          { color: "#38bdf8", shape: "dot", label: "Cu²⁺ Cation", note: "Positive ion → migrates to negative cathode" },
          { color: "#fbbf24", shape: "dot", label: "SO₄²⁻ Anion", note: "Negative ion → migrates to positive anode" },
          { color: "#34d399", shape: "square", label: "Cathode (−) Electrode", note: "Site of copper reduction & metal plating" },
          { color: "#ef4444", shape: "square", label: "Anode (+) Electrode", note: "Site of copper oxidation & dissolution" },
          { color: "#fbbf24", shape: "line", label: "External Circuit Current", note: "Electron transport through wires" },
        ],
      };
      break;
    }

    case "vsepr": {
      const bonding = num(params.bonding, 4);
      const lone = num(params.lone, 0);
      const steric = bonding + lone;

      const electronGeom = {
        2: "Linear",
        3: "Trigonal Planar",
        4: "Tetrahedral",
        5: "Trigonal Bipyramidal",
        6: "Octahedral",
      }[steric] || "Tetrahedral";

      const molecularShape = {
        "2-0": "Linear (180°)",
        "3-0": "Trigonal Planar (120°)",
        "2-1": "Bent (~118°)",
        "4-0": "Tetrahedral (109.5°)",
        "3-1": "Trigonal Pyramidal (~107°)",
        "2-2": "Bent (~104.5°)",
        "5-0": "Trigonal Bipyramidal (90°/120°)",
        "6-0": "Octahedral (90°)",
      }[`${bonding}-${lone}`] || `${electronGeom} (${bonding} bonds, ${lone} lone)`;

      readout = {
        title: "VSEPR Molecular Geometry",
        subtitle: `Steric Number = ${steric} (${bonding} bonding, ${lone} lone)`,
        rows: [
          ["Bonding Pairs", bonding, "gold"],
          ["Lone Pairs", lone, lone > 0 ? "warn" : "good"],
          ["Steric Number SN", steric],
          ["Electron Geometry", electronGeom],
          ["Molecular Shape", molecularShape, "good"],
          ["Angle Compression", lone > 0 ? `${(lone * 2.5).toFixed(1)}° squeeze` : "Ideal angle", lone > 0 ? "warn" : "good"],
        ],
        note: lone > 0
          ? "Lone pairs are held closer to the central nucleus and exert stronger electrostatic repulsion than bonding pairs, squeezing bond angles below ideal values."
          : "With zero lone pairs, bonding pairs repel equally into maximum symmetry, yielding exact ideal geometric angles.",
        noteTone: lone > 0 ? "warn" : "good",
      };

      legend = {
        title: "Electron Domains Key",
        items: [
          { color: "#fbbf24", shape: "dot", label: "Central Atom", note: "Core atom providing valence shell" },
          { color: "#38bdf8", shape: "dot", label: "Bonded Ligand Atom", note: "Peripheral atom in covalent bond" },
          { color: "#a78bfa", shape: "dot", label: "Non-Bonding Lone Pair", note: "Repels harder, closing bond angles" },
          { color: "#64748b", shape: "line", label: "Covalent Bond Rod", note: "Shared bonding pair domain" },
          { color: "#34d399", shape: "line", label: "Bond Angle Arc", note: "Measured inter-bond angle" },
        ],
      };
      break;
    }

    case "energetics": {
      const activation = num(params.activation, 90);
      const deltaH = num(params.deltaH, -60);
      const catalyst = Boolean(params.catalyst);
      const catalystDrop = num(params.catalystDrop, 35);
      const temperature = num(params.temperature, 350);

      const exothermic = deltaH < 0;
      const floorEa = Math.max(deltaH + 5, 5);
      const uncatalysed = Math.max(activation, floorEa);
      const effectiveEa = Math.max(catalyst ? uncatalysed - catalystDrop : uncatalysed, floorEa);
      const reverseEa = effectiveEa - deltaH;

      const fraction = Math.exp((-effectiveEa * 1000) / (8.314 * temperature));

      readout = {
        title: "Reaction Energetics & Catalysis",
        subtitle: exothermic ? "Exothermic (ΔH < 0, energy released)" : "Endothermic (ΔH > 0, energy absorbed)",
        rows: [
          ["Forward Activation Ea", `${effectiveEa.toFixed(0)} kJ/mol`, catalyst ? "good" : "gold"],
          ["Uncatalysed Barrier", `${uncatalysed.toFixed(0)} kJ/mol`],
          ["Reverse Activation", `${reverseEa.toFixed(0)} kJ/mol`],
          ["Enthalpy Change ΔH", `${deltaH > 0 ? "+" : ""}${deltaH.toFixed(0)} kJ/mol`, exothermic ? "good" : "warn"],
          ["Temperature", `${temperature} K (${temperature - 273}°C)`],
          ["Collision Fraction ≥ Ea", fraction.toExponential(1), fraction > 1e-12 ? "good" : "bad"],
          ["Catalyst Effect", catalyst ? `Lowers barrier by ${catalystDrop} kJ/mol` : "None", catalyst ? "good" : undefined],
        ],
        note: catalyst
          ? "The catalyst provides an alternative pathway with a lower activation energy (Ea), increasing successful collision frequency without changing overall ΔH."
          : exothermic
          ? "Exothermic: energy released during new bond formation exceeds energy absorbed in bond breaking (ΔH is negative)."
          : "Endothermic: energy required to break bonds exceeds energy released on forming products (ΔH is positive).",
        noteTone: catalyst || exothermic ? "good" : "neutral",
      };

      legend = {
        title: "Energy Profile Key",
        items: [
          { color: catalyst ? "#34d399" : "#fbbf24", shape: "line", label: "Reaction Energy Curve", note: "Potential energy along reaction coordinate" },
          ...(catalyst ? [{ color: "#64748b", shape: "dash", label: "Uncatalysed Barrier", note: "Original higher activation energy curve" }] : []),
          { color: "#fb7185", shape: "line", label: "Activation Energy (Ea)", note: "Reactants → Transition state summit" },
          { color: exothermic ? "#34d399" : "#a78bfa", shape: "line", label: "Enthalpy Change (ΔH)", note: "Net energy difference (Products − Reactants)" },
        ],
      };
      break;
    }

    // ═════════════════════════════════════════════════════════════════════
    // 3. BIOLOGY
    // ═════════════════════════════════════════════════════════════════════

    case "enzyme": {
      const temp = num(params.temperature, 37);
      const ph = num(params.ph, 7.0);

      const denatured = temp > 55 || ph < 3 || ph > 11;
      let rate = 0;
      if (!denatured) {
        rate = Math.round(Math.max(0, 1 - Math.abs(temp - 37) / 25) * Math.max(0, 1 - Math.abs(ph - 7) / 4) * 100);
      }

      readout = {
        title: "Enzyme Kinetics & Catalysis",
        subtitle: "Lock and key substrate binding",
        rows: [
          ["Catalytic Rate", `${rate}%`, rate > 60 ? "good" : denatured ? "bad" : "warn"],
          ["Temperature", `${temp}°C`, temp > 50 ? "bad" : undefined],
          ["pH Level", ph.toFixed(1), Math.abs(ph - 7) > 3 ? "bad" : undefined],
          ["Optimum Conditions", "37°C, pH 7.0"],
          ["Active Site State", denatured ? "Denatured (Distorted)" : "Complementary Lock", denatured ? "bad" : "good"],
        ],
        note: denatured
          ? "Excessive temperature (>50°C) or extreme pH breaks hydrogen and ionic bonds holding tertiary protein structure, permanently destroying active site shape."
          : "Near optimum conditions (37°C, pH 7), substrate molecules collide frequently and fit precisely into the complementary catalytic active site.",
        noteTone: denatured ? "bad" : "good",
      };

      legend = {
        title: "Enzyme Component Key",
        items: [
          { color: "#3b82f6", shape: "square", label: "Enzyme Protein Globule", note: "Folded globular tertiary catalyst" },
          { color: denatured ? "#ef4444" : "#34d399", shape: "square", label: "Active Catalytic Site", note: denatured ? "Denatured non-functional site" : "Complementary binding cleft" },
          { color: "#fbbf24", shape: "dot", label: "Substrate Molecule", note: "Reacting substrate key" },
          { color: "#a78bfa", shape: "dot", label: "Catalysed Products", note: "Released reaction product fragments" },
        ],
      };
      break;
    }

    case "dna": {
      const count = num(params.pairs, 16);
      const bases = ["A", "T", "G", "C", "C", "A", "T", "G", "A", "T", "C", "G", "T", "A", "G", "C"];
      const strand1 = bases.slice(0, Math.min(count, bases.length)).join("−");
      const compMap = { A: "T", T: "A", G: "C", C: "G" };
      const strand2 = bases.slice(0, Math.min(count, bases.length)).map((b) => compMap[b]).join("−");

      readout = {
        title: "DNA Double Helix Structure",
        subtitle: "Antiparallel complementary nucleotide strands",
        rows: [
          ["Base Pairs Shown", count, "gold"],
          ["Strand 1 (5′→3′)", strand1],
          ["Strand 2 (3′→5′)", strand2],
          ["Base Pairing Rules", "A–T (2 H-bonds), C–G (3 H-bonds)", "good"],
          ["Helix Backbone", "Deoxyribose sugar + phosphate"],
          ["Turn Frequency", "10.5 base pairs per full 360° turn"],
        ],
        note: "Unzipping breaks weak hydrogen bonds between strands, allowing each strand to serve as a template for semi-conservative DNA replication.",
        noteTone: "good",
      };

      legend = {
        title: "Nucleotide Base Key",
        items: [
          { color: "#ef4444", shape: "dot", label: "Adenine (A)", note: "Purine base (pairs with Thymine via 2 H-bonds)" },
          { color: "#38bdf8", shape: "dot", label: "Thymine (T)", note: "Pyrimidine base (pairs with Adenine via 2 H-bonds)" },
          { color: "#fbbf24", shape: "dot", label: "Cytosine (C)", note: "Pyrimidine base (pairs with Guanine via 3 H-bonds)" },
          { color: "#34d399", shape: "dot", label: "Guanine (G)", note: "Purine base (pairs with Cytosine via 3 H-bonds)" },
          { color: "#94a3b8", shape: "line", label: "Sugar-Phosphate Backbone", note: "Antiparallel helical structural chains" },
          { color: "#e8ebf0", shape: "dash", label: "Hydrogen Bonds", note: "Non-covalent base pairing stabilization" },
        ],
      };
      break;
    }

    case "cell": {
      const cellType = params.cellType || "plant";
      const isPlant = cellType === "plant";
      const tonicity = num(params.tonicity, 0);

      let stateText = "Normal (Isotonic)";
      if (tonicity > 0.05) stateText = isPlant ? "Plasmolysed (Hypertonic)" : "Shrivelled (Hypertonic)";
      else if (tonicity < -0.05) stateText = isPlant ? "Turgid (Hypotonic)" : "Lysis / Burst (Hypotonic)";

      readout = {
        title: isPlant ? "Plant Cell Explorer" : "Animal Cell Explorer",
        subtitle: "Osmosis: dilute → concentrated water potential",
        rows: [
          ["External Solution", tonicity > 0.05 ? "Concentrated (Hypertonic)" : tonicity < -0.05 ? "Dilute (Hypotonic)" : "Isotonic Equilibrium"],
          ["Net Water Flow", tonicity > 0.05 ? "Out of cell" : tonicity < -0.05 ? "Into cell" : "Equilibrium"],
          ["Cell Status", stateText, tonicity < -0.05 && isPlant ? "good" : tonicity > 0.05 ? "warn" : "default"],
          ["Cellulose Wall", isPlant ? "Yes (Rigid)" : "No", isPlant ? "good" : "bad"],
          ["Chloroplasts", isPlant ? "Yes (Photosynthesis)" : "No", isPlant ? "good" : "bad"],
          ["Permanent Vacuole", isPlant ? "Yes (Cell sap)" : "No", isPlant ? "good" : "bad"],
        ],
        note: isPlant
          ? "Plant cells are supported by a rigid cellulose wall that withstands turgor pressure when water enters by osmosis."
          : "Animal cells lack cell walls; placing in pure water causes excessive osmotic intake and lysis (bursting).",
        noteTone: "neutral",
      };

      legend = {
        title: "Cell Organelle Key",
        items: [
          { color: "#a78bfa", shape: "dot", label: "Nucleus & DNA", note: "Controls cellular genetic activity" },
          { color: "#fb7185", shape: "dot", label: "Mitochondria", note: "Site of aerobic respiration & ATP synthesis" },
          { color: "#34d399", shape: "dot", label: "Chloroplast (Plants)", note: "Site of photosynthesis (chlorophyll)" },
          { color: "#38bdf8", shape: "square", label: "Endoplasmic Reticulum", note: "Membrane network for protein synthesis" },
          { color: "#f59e0b", shape: "square", label: "Golgi Apparatus", note: "Modifies and packages secretory proteins" },
          { color: "#0ea5e9", shape: "square", label: "Permanent Vacuole", note: "Stores cell sap & maintains turgor (plants)" },
          { color: "#38bdf8", shape: "square", label: "Cell Membrane", note: "Partially permeable lipid bilayer" },
          { color: "#10b981", shape: "square", label: "Cellulose Cell Wall", note: "Rigid structural outer support (plants)" },
        ],
      };
      break;
    }

    case "protein": {
      const structure = params.structure || "helix";
      const residues = num(params.residues, 30);
      const fold = num(params.fold, 1);
      const temperature = num(params.temperature, 300);

      const denatured = temperature > 320 || fold < 0.35;

      readout = {
        title: "Protein Structure & Folding",
        subtitle: `${structure === "helix" ? "α-Helix" : structure === "sheet" ? "β-Pleated Sheet" : "Random Coil"} Secondary Structure`,
        rows: [
          ["Residues Count", residues, "gold"],
          ["Conformation", denatured ? "Denatured (Random Coil)" : structure === "helix" ? "α-Helix (3.6 res/turn)" : structure === "sheet" ? "β-Sheet" : "Unstructured Coil", denatured ? "bad" : "good"],
          ["Folded Progress", `${Math.round(fold * 100)}%`, fold > 0.8 ? "good" : "warn"],
          ["Temperature", `${temperature} K (${temperature - 273}°C)`, temperature > 320 ? "bad" : undefined],
          ["Stabilization", "Hydrogen bonding between N–H and C=O", "good"],
        ],
        note: denatured
          ? "Elevated thermal energy breaks the weak hydrogen bonds holding the secondary structure, causing the polypeptide chain to collapse into an inactive random coil."
          : structure === "helix"
          ? "Alpha-helix is held by periodic hydrogen bonds between residue i and residue i+4, producing a spiral of 3.6 residues per turn."
          : "Beta-sheets are held by hydrogen bonds between adjacent antiparallel polypeptide strands.",
        noteTone: denatured ? "bad" : "good",
      };

      legend = {
        title: "Protein Folding Key",
        items: [
          { color: "#fbbf24", shape: "dot", label: "Hydrophobic Residue", note: "Non-polar residue packing into internal core" },
          { color: "#38bdf8", shape: "dot", label: "Hydrophilic Residue", note: "Polar residue facing surrounding solvent" },
          { color: "#34d399", shape: "dash", label: "Hydrogen Bond", note: "Secondary structure stabilizing interaction" },
          { color: "#64748b", shape: "line", label: "Polypeptide Backbone", note: "Covalent peptide chain link" },
          { color: "#fbbf24", shape: "dot", label: "Denatured State", note: "Unfolded disordered conformation" },
        ],
      };
      break;
    }

    case "respiratory": {
      const phase = params?.phase || "inspiration";
      const vol = params?.thoraxVolumeL ? `${params.thoraxVolumeL} L` : (phase === "forced_expiration" ? "1.95 L" : phase === "quiet_expiration" ? "2.80 L" : "3.50 L");
      const pres = params?.intraThoracicPressureKPa ? `${params.intraThoracicPressureKPa} kPa` : (phase === "forced_expiration" ? "+1.15 kPa" : phase === "quiet_expiration" ? "+0.18 kPa" : "-0.28 kPa");
      const flow = params?.airFlowRateLps ? `${params.airFlowRateLps} L/s` : (phase === "forced_expiration" ? "+3.85 L/s" : phase === "quiet_expiration" ? "+0.45 L/s" : "-0.65 L/s");
      const bpmVal = params?.bpm || 14;

      readout = {
        title: "Respiratory Mechanics & Thoracic Physics",
        subtitle: "Boyle's Law: P · V = constant (ΔP relative to Patm = 101.3 kPa)",
        rows: [
          ["Current Phase", phase === "inspiration" ? "Inspiration (Active)" : phase === "quiet_expiration" ? "Quiet Expiration (Passive)" : "Forced Expiration (Active)", phase === "inspiration" ? "good" : phase === "forced_expiration" ? "warn" : "gold"],
          ["Thorax Volume", vol, "good"],
          ["Intra-thoracic ΔP", pres, pres.startsWith("-") ? "sky" : "warn"],
          ["Air Flow Rate (V̇)", flow, flow.startsWith("-") ? "sky" : "gold"],
          ["Breathing Rate", `${bpmVal} BPM`],
          ["External Intercostals", phase === "inspiration" ? "Active Contraction (Elevating)" : "Passive Relaxation", phase === "inspiration" ? "good" : "neutral"],
          ["Internal Intercostals", phase === "forced_expiration" ? "Active Contraction (Depressing)" : "Passive Relaxation", phase === "forced_expiration" ? "warn" : "neutral"],
          ["Diaphragm Action", phase === "inspiration" ? "Contracts & Flattens Downward" : phase === "forced_expiration" ? "Pushed Upward (Abdominal Push)" : "Passively Recoils into Dome", phase === "inspiration" ? "good" : "neutral"],
        ],
        note: "Inspiration expands thoracic volume, causing intra-alveolar pressure to fall below atmospheric pressure (-0.3 kPa) and drawing air inward. Quiet expiration relies on elastic recoil; forced expiration actively recruits internal intercostals and abdominal muscles.",
        noteTone: phase === "forced_expiration" ? "warn" : "good",
      };

      legend = {
        title: "Thoracic Anatomy & Physics Key",
        items: [
          { color: "#ef4444", shape: "dot", label: "Active Muscle Contraction", note: "Glowing crimson tension shader" },
          { color: "#475569", shape: "dot", label: "Passive Muscle Relaxation", note: "Muted slate blue resting tone" },
          { color: "#38bdf8", shape: "dot", label: "Inflow Airway Particles", note: "Fresh ambient oxygen intake" },
          { color: "#fbbf24", shape: "dot", label: "Outflow Airway Particles", note: "Expired CO2-rich air streams" },
          { color: "#f1f5f9", shape: "dot", label: "Bony Ribcage & Sternum", note: "Pump-handle & bucket-handle mechanics" },
          { color: "#93c5fd", shape: "dot", label: "Costal Cartilage & C-Rings", note: "Flexible cartilaginous airway support" },
          { color: "#fb7185", shape: "dot", label: "Lung Parenchyma", note: "Volumetric lobes expanding synchronously" },
          { color: "#dc2626", shape: "dot", label: "Diaphragm Dome", note: "Muscular floor flattening down during contraction" },
        ],
      };
      break;
    }

    // ═════════════════════════════════════════════════════════════════════
    // 4. COMPUTER SCIENCE
    // ═════════════════════════════════════════════════════════════════════

    case "binary_tree": {
      readout = {
        title: "3D Binary Search Tree (BST)",
        subtitle: "BST Invariant: Left Child < Root < Right Child",
        rows: [
          ["Average Search", "O(log n)", "good"],
          ["Worst Case Search", "O(n) (unbalanced)", "warn"],
          ["In-Order Traversal", "Yields sorted ascending array", "good"],
          ["Insert Time", "O(log n) avg", "good"],
          ["Tree Structure", "Hierarchical 3D level planes"],
        ],
        note: "In a binary search tree, every left subtree node has a value smaller than the root, and every right subtree node has a value greater. In-order traversal visits nodes in exact sorted order.",
        noteTone: "good",
      };

      legend = {
        title: "Binary Tree Nodes Key",
        items: [
          { color: "#2a3447", shape: "dot", label: "Idle / Stored Node", note: "Unvisited tree node" },
          { color: "#f59e0b", shape: "dot", label: "Comparison Pivot", note: "Node currently compared in search" },
          { color: "#34d399", shape: "dot", label: "Target Match Found", note: "Successful search value located" },
          { color: "#fb7185", shape: "dot", label: "Search Miss / Missing", note: "Value not present in tree branch" },
          { color: "#10b981", shape: "dot", label: "Visited Traversal Node", note: "Traversed in pre/in/post-order" },
          { color: "#38bdf8", shape: "dot", label: "Selected Node", note: "User-clicked inspected node" },
          { color: "#64748b", shape: "line", label: "Tree Branch Edge", note: "Directed pointer from parent to child" },
        ],
      };
      break;
    }

    case "sorting": {
      const algorithm = params.algorithm || "bubble";
      const size = num(params.size, 22);

      const meta = {
        bubble: { name: "Bubble Sort", time: "O(n²)", stable: "Yes" },
        insertion: { name: "Insertion Sort", time: "O(n²)", stable: "Yes" },
        selection: { name: "Selection Sort", time: "O(n²)", stable: "No" },
        quick: { name: "Quicksort", time: "O(n log n)", stable: "No" },
        merge: { name: "Merge Sort", time: "O(n log n)", stable: "Yes" },
      }[algorithm] || { name: "Bubble Sort", time: "O(n²)", stable: "Yes" };

      readout = {
        title: `${meta.name} Visualizer`,
        subtitle: `Time Complexity: ${meta.time} · Stable: ${meta.stable}`,
        rows: [
          ["Array Size n", size, "gold"],
          ["Algorithm", meta.name],
          ["Time Complexity", meta.time, meta.time.includes("log") ? "good" : "warn"],
          ["Stability", meta.stable === "Yes" ? "Stable" : "Unstable", meta.stable === "Yes" ? "good" : "warn"],
        ],
        note: `Watch the bar comparisons and swaps in real time. Divide-and-conquer algorithms like Quicksort and Merge Sort run in O(n log n) time, drastically outperforming O(n²) quadratic sorts on large datasets.`,
        noteTone: meta.time.includes("log") ? "good" : "neutral",
      };

      legend = {
        title: "Sorting Bar States Key",
        items: [
          { color: "#38bdf8", shape: "square", label: "Unsorted Bar", note: "Pillar height represents numerical value" },
          { color: "#fbbf24", shape: "square", label: "Active Comparison", note: "The two elements currently being compared" },
          { color: "#fb7185", shape: "square", label: "Active Swap / Write", note: "Array element transposition / memory write" },
          { color: "#34d399", shape: "square", label: "Final Sorted State", note: "Confirmed in final sorted position" },
        ],
      };
      break;
    }

    // ═════════════════════════════════════════════════════════════════════
    // 5. MATHEMATICS
    // ═════════════════════════════════════════════════════════════════════

    case "gradient": {
      const surface = params.surface || "bowl";
      const rate = num(params.rate, 0.12);
      const momentum = num(params.momentum, 0.6);

      const surfaceNames = {
        bowl: "Parabolic Bowl (f = x² + z²)",
        saddle: "Saddle Surface (f = x² − z²)",
        valley: "Rosenbrock Banana Valley",
        wells: "4-Well Multi-Modal Landscape",
      }[surface] || "Loss Landscape";

      readout = {
        title: "3D Gradient Descent Optimization",
        subtitle: "x_n+1 = x_n − α ∇f(x_n) + β v_n",
        rows: [
          ["Landscape", surfaceNames, "gold"],
          ["Learning Rate α", rate.toFixed(3)],
          ["Momentum β", momentum.toFixed(2)],
          ["Step Rule", "Steepest descent along −∇f"],
        ],
        note: "Gradient descent moves iteratively down the steepest slope of the loss landscape. If learning rate α is too high, the optimizer overshoots and diverges; if too low, convergence is extremely slow.",
        noteTone: "neutral",
      };

      legend = {
        title: "Optimization Landscape Key",
        items: [
          { color: "#fbbf24", shape: "dot", label: "Current Point (x, z)", note: "Model parameters being optimized" },
          { color: "#34d399", shape: "line", label: "Negative Gradient (−∇f)", note: "Direction of steepest downhill descent" },
          { color: "#fbbf24", shape: "line", label: "Optimization Trail", note: "History of parameter update steps" },
          { color: "#a78bfa", shape: "square", label: "Low Loss Valley", note: "Optimal global or local minimum target" },
          { color: "#fb7185", shape: "square", label: "High Loss Ridge", note: "Steep objective function elevation" },
        ],
      };
      break;
    }

    case "revolution": {
      const curve = params.curve || "bell";
      const height = num(params.height, 3.6);
      const slices = num(params.slices, 12);
      const sweep = num(params.sweep, 300);

      readout = {
        title: "Solids of Revolution & Integration",
        subtitle: "Disk Method Volume V = π ∫ [r(y)]² dy",
        rows: [
          ["Profile Curve r(y)", curve.toUpperCase(), "gold"],
          ["Height H", `${height.toFixed(1)} units`],
          ["Riemann Discs n", Math.round(slices)],
          ["Cutaway Angle", sweep >= 360 ? "360° (Closed)" : `${Math.round(sweep)}° shown`],
          ["Volume Formula", "V = π ∑ r_i² Δy", "good"],
        ],
        note: "The volume of a solid of revolution is calculated by slicing the continuous 3D volume into infinitesimal cylindrical discs of radius r(y) and thickness dy, summing their volumes via definite integration.",
        noteTone: "good",
      };

      legend = {
        title: "Revolution & Slicing Key",
        items: [
          { color: "#34d399", shape: "line", label: "Generating Curve r(y)", note: "2D profile curve being revolved" },
          { color: "#fbbf24", shape: "square", label: "Approximating Disc", note: "One cylindrical slice of volume π r² Δy" },
          { color: "#38bdf8", shape: "square", label: "True Solid Shell", note: "Exact continuous volume of revolution" },
          { color: "#64748b", shape: "dash", label: "Axis of Revolution (y)", note: "Central vertical spindle axis" },
        ],
      };
      break;
    }

    case "unitcircle": {
      const count = num(params.harmonics, 1);
      const amplitude = num(params.amplitude, 1.8);

      readout = {
        title: "Unit Circle & Wave Synthesis",
        subtitle: count === 1 ? "y(t) = A sin(θ) · x(t) = A cos(θ)" : "Fourier Series Square Wave Synthesis",
        rows: [
          ["Amplitude A", amplitude.toFixed(2), "gold"],
          ["Harmonics Count", count],
          ["Coordinates (x, y)", "(cos θ, sin θ) on unit circle"],
          ["Fourier Limit", count > 1 ? "Converges to πA/4 square wave" : "Pure fundamental sine wave", "good"],
          ["Gibbs Phenomenon", count > 1 ? "~9% overshoot at step jumps" : "None", count > 1 ? "warn" : "good"],
        ],
        note: count === 1
          ? "The sine wave is the vertical projection (y = A sin θ) of a particle moving uniformly along the unit circle, unrolled over time along the z-axis."
          : "By adding odd Fourier harmonics (sin kθ / k), the waveform squares off, demonstrating how complex periodic signals decompose into pure sinusoidal harmonics.",
        noteTone: "good",
      };

      legend = {
        title: "Trigonometric Key",
        items: [
          { color: "#38bdf8", shape: "line", label: "Unit Circle Orbit", note: "Circle of radius A turning at angle θ" },
          { color: "#fbbf24", shape: "dot", label: "Rotating Tip Point", note: "Position (cos θ, sin θ) on circumference" },
          { color: "#fbbf24", shape: "line", label: "Sine Wave Trace (y)", note: "Vertical displacement unrolled over time" },
          { color: "#a78bfa", shape: "line", label: "Cosine Wave Trace (x)", note: "Horizontal projection (90° phase shifted)" },
          { color: "#34d399", shape: "line", label: "Target Square Wave", note: "Fourier series summation limit πA/4" },
        ],
      };
      break;
    }

    default: {
      readout = {
        title: topic.title || "3D Visualization",
        subtitle: topic.syllabus || "Interactive STEM Model",
        rows: Object.entries(params || {})
          .filter(([k]) => !k.startsWith("hide") && k !== "spin" && k !== "animate")
          .slice(0, 6)
          .map(([k, v]) => [k, typeof v === "number" ? v.toFixed(2) : String(v)]),
        note: topic.blurb || "Interactive 3D simulation exploring foundational science and mathematical principles.",
        noteTone: "neutral",
      };

      legend = {
        title: "Visual Key",
        items: [
          { color: "#38bdf8", shape: "line", label: "Active 3D Elements", note: "Interactive simulation components" },
          { color: "#fbbf24", shape: "dot", label: "Focus / Target Marker", note: "Real-time parameter indicator" },
        ],
      };
      break;
    }
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

  // Resizable panel width state (10% to 80% screen width)
  // Default to 300 to match SSR markup, then hydrate saved width on client mount
  const [panelWidth, setPanelWidth] = useState(300);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("socratic_hud_panel_width");
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= 180 && parsed <= (window.innerWidth || 1920) * 0.85) {
            setPanelWidth(parsed);
          }
        }
      }
    } catch (_) {}
  }, []);

  const isResizingRef = useRef(false);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = panelWidth;

    const onPointerMove = (moveEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = moveEvent.clientX - startX;
      const minW = Math.max(180, Math.floor(window.innerWidth * 0.10));
      const maxW = Math.floor(window.innerWidth * 0.80);
      const clamped = Math.min(Math.max(startWidth + deltaX, minW), maxW);
      setPanelWidth(clamped);
    };

    const cleanup = () => {
      isResizingRef.current = false;
      setIsResizing(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      try {
        if (typeof window !== "undefined") {
          setPanelWidth((curr) => {
            localStorage.setItem("socratic_hud_panel_width", String(curr));
            return curr;
          });
        }
      } catch (_) {}
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  };

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
        {topic.concepts && topic.concepts.length > 0 && (
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
        )}
      </div>
    );
  }

  return (
    <div
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ width: `${panelWidth}px`, maxWidth: "80vw", minWidth: "10vw" }}
      className={`pointer-events-auto absolute left-4 top-4 z-20 flex max-h-[calc(100%-2rem)] flex-col gap-3 ${
        isResizing ? "select-none" : ""
      }`}
    >
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl">
        <div className="max-h-[calc(100vh-2rem)] overflow-y-auto pr-0.5">
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

            {/* ─── Universal Animation Speed Slider (Prominently Right Below Tab Switcher) ─── */}
            <div className="mb-3 rounded-lg border border-ink-800 bg-ink-950/60 p-2.5 shadow-inner">
              <Slider
                label="⚡ Animation Speed"
                value={typeof params?.speed === "number" ? params.speed : 1.0}
                onChange={(val) => setParam("speed", val)}
                min={0.1}
                max={3.0}
                step={0.1}
                format={(v) => (v === 0 ? "paused" : `${Number(v).toFixed(1)}×`)}
              />
            </div>

            {activeTab === "controls" ? (
              <div className="space-y-3">
                {topic.controls
                  .filter((control) => control.key !== "speed")
                  // A control may only apply to some of a topic's modes — the
                  // simple-machines bench needs a fulcrum slider for levers and
                  // a sheave count for the tackle, and showing both at once
                  // invites a student to set the one that does nothing.
                  .filter((control) => (typeof control.when === "function" ? control.when(params) : true))
                  .map((control) => (
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
                {topic.concepts && topic.concepts.length > 0 && (
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
                          className={`h-3.5 w-3.5 text-ink-400 transition-transform ${
                            keyConceptsOpen ? "rotate-180" : ""
                          }`}
                          strokeWidth={2}
                        />
                      </div>
                    </button>

                    {keyConceptsOpen && topic.concepts && (
                      <div className="mt-2.5 space-y-2 border-t border-ink-800/80 pt-2.5">
                        {topic.concepts.map((concept, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-duck-500/20 text-[9px] font-mono font-bold text-duck-400">
                              {i + 1}
                            </span>
                            <p className="text-[11px] leading-relaxed text-ink-300">
                              {concept}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Live Mathematical / Scientific State Readout & Visual Key */}
                {renderTopicDetailsReadout(topic, params)}

                {/* AI Concept Breakdown & Quiz Action Button */}
                {onOpenQuiz && (
                  <button
                    type="button"
                    onClick={() => onOpenQuiz(topic, params)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg bg-gradient-to-r from-duck-400 to-duck-500 px-3.5 py-2.5 text-xs font-bold text-ink-950 transition-all hover:from-duck-300 hover:to-duck-400 shadow-md hover:shadow-duck-500/20 active:scale-[0.99] cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className="h-4 w-4 shrink-0 text-ink-950" strokeWidth={2.25} />
                      <div className="text-left">
                        <p className="leading-none text-xs font-bold">AI Concept Breakdown & Quiz</p>
                        <p className="text-[10px] font-medium text-ink-900/80 leading-tight mt-0.5">Test with AI · logs to Mastery</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-70" strokeWidth={2.25} />
                  </button>
                )}
              </div>
            )}
          </HudPanel>
        </div>

        {/* ─── Right Edge Drag-To-Resize Handle (10% to 80% screen width) ─── */}
        <div
          onPointerDown={handleResizePointerDown}
          className="absolute -right-1 top-0 bottom-0 z-30 flex w-3.5 cursor-ew-resize items-center justify-center select-none group"
          title="Drag to resize panel (10% to 80% screen width)"
        >
          <div
            className={`h-14 w-1 rounded-full transition-all ${
              isResizing ? "bg-duck-400 shadow-md scale-y-110" : "bg-ink-700/50 group-hover:bg-duck-400/80 group-hover:h-20"
            }`}
          />
        </div>

        {/* ─── Bottom-Right Corner Resize Grip Indicator ─── */}
        <div
          onPointerDown={handleResizePointerDown}
          className="absolute bottom-1.5 right-1.5 z-30 cursor-nwse-resize p-1 text-ink-600 transition-colors hover:text-duck-400 select-none"
          title="Drag to resize panel width"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-60 hover:opacity-100 fill-current">
            <circle cx="8" cy="8" r="1.2" />
            <circle cx="8" cy="4" r="1.2" />
            <circle cx="4" cy="8" r="1.2" />
          </svg>
        </div>
      </div>
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

"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  X,
} from "lucide-react";
import { PALETTE } from "@/components/visualizations/scene-kit";
import { mediumColour } from "@/components/visualizations/media";
import { ATOM_COLOURS, describeAtom } from "@/lib/atomicStructure";
import { solveColumn } from "@/lib/distillation";
import { ORGANIC_COLOURS, describeMolecule } from "@/lib/organic";
import { CELL_COLOURS, ELECTROLYTE, formatGasVolume, formatRunTime, solveElectrolysis } from "@/lib/electrolysis";
import { DENATURE_TEMP, ENZYME_COLOURS, OPTIMUM_PH, OPTIMUM_TEMP, solveEnzyme } from "@/lib/enzymes";
import { BACKBONE_COLOURS, BASE_CLASS, BASE_COLOURS, BASE_NAMES, BASE_PAIRS_PER_TURN, COMPLEMENT, PAIR_BONDS, describeHelix } from "@/lib/dna";
import { WATER_COLOUR, solveOsmosis } from "@/lib/cellBiology";
import { STRUCTURE_COLOURS, solveFolding } from "@/lib/proteinFolding";
import { latticeFactsFor, latticeKeyFor } from "@/lib/lattices";
import { ELEMENT_STYLE, VSEPR_BOND_COLOUR, solveVsepr } from "@/lib/vsepr";
import { solveEnergetics } from "@/lib/energetics";
import { slideForecast, solveIncline, surfaceFor } from "@/lib/inclineForces";
import {
  ELASTIC_LIMIT_EXTENSION,
  FAILURE_EXTENSION,
  elasticLimitForce,
  failureForce,
  forceAxisMax,
  loadForce,
  loadingExtension,
  permanentSet,
  solveSpring,
} from "@/lib/hookesLaw";
import { isLever, solveMachine } from "@/lib/simpleMachines";
import { buildTrack, minimumReleaseHeight, minimumTopSpeed } from "@/lib/coasterEnergy";
import { FLUIDS, fluidComparison, formatNewtons, solveBuoyancy } from "@/lib/buoyancy";
import { solveCircuit, strandedBulbs } from "@/lib/circuits";
import {
  OPTICS_TITLES,
  imageNature,
  objectZone,
  opticsTypeOf,
  solveBlock,
  solveRayOptics,
} from "@/lib/rayOptics";
import { COIL_AREA, MAGNET_OMEGA, fluxAt, solveInduction } from "@/lib/induction";
import { FIELD_HALF_X, SCREEN_DISTANCE, fringePosition } from "@/lib/interference";
import { VIEW_MAX, solveOrbit } from "@/lib/orbit";
import { idealFlight, simulateFlight } from "@/lib/projectile";
import { gasLawReadout } from "@/lib/particleModel";
import {
  CHARGE_PER_MARKER,
  MAX_MARKERS,
  chargeOf,
  electronCount,
  formatForce,
  leakTimeConstant,
  solveStatic,
} from "@/lib/electrostatics";
import {
  ROD_MATERIALS,
  TIME_LAPSE,
  WAX_MELTING_C,
  solveHeatTransfer,
} from "@/lib/heatTransfer";
import {
  FIBRES,
  NOCICEPTOR_THRESHOLD_C,
  PATHWAYS,
  STAGES,
  STIMULI,
  formatMs,
  solveReflex,
} from "@/lib/reflexArc";
import { maxHoldableLoad, solveMuscles } from "@/lib/muscleMechanics";
import {
  CAVITATION_TENSION_MPA,
  LEAF_AREA_M2,
  OPEN_PORE_THRESHOLD,
  SOILS,
  TREE_HEIGHT_M,
  solveTranspiration,
} from "@/lib/transpiration";
import {
  CONSISTENCIES,
  CONSTRICTION_LAG_CM,
  ORIENTATIONS,
  RELAXATION_LEAD_CM,
  TUBE_LENGTH_CM,
  solvePeristalsis,
} from "@/lib/peristalsis";
import {
  BASELINE_FOREST_PCT,
  GTC_PER_PPM,
  OCEAN_BASELINE_PPM,
  OCEAN_THERMAL_LAG_YEARS,
  PREINDUSTRIAL_PPM,
  PRESENT_ANOMALY_C,
  PRESENT_PPM,
  solarLabel,
  solveCarbon,
} from "@/lib/carbonCycle";
import {
  NEXT_LINK,
  TIERS,
  TOXIN_HARM_PPM,
  TOXIN_LETHAL_PPM,
  TOXIN_MAGNIFICATION,
  TRANSFER_EFFICIENCY,
  solveFoodChain,
} from "@/lib/foodChain";
import {
  GENERATIVE_DIVISION_FRACTION,
  POLLINATION_TIMELINE,
  STYLE_LENGTH_MM,
  TUBE_GROWTH_MM_PER_H,
  describePollination,
} from "@/lib/pollination";
import {
  ANTIBIOTIC_TARGETS,
  ANTIBIOTIC_TIMELINE,
  BURST_SIZE,
  LIVING_CRITERIA,
  LYTIC_TIMELINE,
  SIZE_RATIO,
  antibioticEfficacy,
  classify,
  describeAntibiotic,
  describeInfection,
  hostStatus,
} from "@/lib/pathogens";
import { HAPLOID_N, MAX_CHIASMATA, PARENTS, describeDivision } from "@/lib/cellDivision";
import {
  ELECTROLYTES,
  ION_APPEARANCE,
  METALS,
  NAIL_MASS_G,
  PARTNERS,
  RUST_EQUATIONS,
  SERIES,
  SOLUTIONS,
  SOLUTION_MOL,
  SOLUTION_ORDER,
  STRIP_MASS_G,
  describeOutcome,
  formatModelTime,
  ionSymbol,
  seriesRank,
  solveDisplacement,
  solveRusting,
} from "@/lib/redox";
import { CARDIAC_CYCLE, beatSummary, hemodynamicsAt, pathologyFor } from "@/lib/cardiacCycle";
import {
  COMPONENTS,
  FILTER_PORE_UM,
  FRONT_MAX_MM,
  MIXTURES,
  SAMPLE_VOLUME_ML,
  SOLVENTS,
  STATIONS,
  formatSeconds,
  rfText,
  solveChromatography,
  solveCrystallization,
  solveFiltration,
  stationFit,
} from "@/lib/separation";
import {
  BASIN_HOLD_S,
  EQUATIONS,
  FLAME_MAX_C,
  FLAME_MIN_C,
  HEAT_EXTINCTION,
  IGNITION_C,
  O2_AIR,
  O2_EXTINCTION,
  describeFlame,
  flameProfile,
} from "@/lib/combustion";
import {
  HEATING_CONDUCTANCE,
  boilingPointC,
  describePhase,
  heatingCurve,
  kineticReadout,
  meltingPointC,
  molarVolumes,
  phaseComposition,
  substanceFor,
  transitionsAt,
} from "@/lib/particleModel";
import {
  CURVE_HALF_LIVES,
  LAMBDA,
  PARTICLE_KINDS,
  SIM_HALF_LIFE_S,
  activityBq,
  barrierFor,
  deflection,
  describeSample,
  formatDuration,
  halfLifeIntervals,
  halfLifeLabel,
  modeFor,
  nuclearEquation,
  penetrates,
  realSecondsPerSimSecond,
  theoreticalN,
  transmission,
} from "@/lib/radioactiveDecay";

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

/**
 * Row tones. A readout row's third element is a key of this map.
 *
 * `neutral`, `sky` and `rose` are here because rows already passed them and
 * `TONES[tone]` was then `undefined` — which does not throw, it just appends
 * the literal string "undefined" to the className and silently drops the
 * colour. The `?? TONES.default` below closes the same hole for anything
 * added later.
 */
const TONES = {
  default: "text-ink-100",
  neutral: "text-ink-100",
  gold: "text-duck-300",
  good: "text-emerald-400",
  warn: "text-amber-400",
  bad: "text-rose-400",
  sky: "text-sky-400",
  rose: "text-rose-400",
};

export function Stat({ label, value, tone = "default", hint, wide = false }) {
  return (
    <div className={`min-w-0 ${wide ? "col-span-2" : ""}`}>
      <p className="text-[10px] uppercase tracking-wider text-ink-500">{label}</p>
      <p
        className={`${wide ? "break-words" : "truncate"} text-sm font-medium tabular-nums ${TONES[tone] ?? TONES.default}`}
      >
        {value}
      </p>
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
          // A label may depend on the other controls (the orbit slider's does).
          format={control.format && ((v) => control.format(v, params))}
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

    case "stepper":
      return <StageStepper control={control} params={params} setParam={setParam} value={value} emit={emit} />;

    default:
      return null;
  }
}

/**
 * The shared stage stepper: discrete navigation through a cyclical process
 * (chips, Prev / Next) plus a Play / Pause for continuous auto-play. The
 * control owns two params — `key` is the stage index, `playKey` the playing
 * flag — and the scene's `StageCycleDriver` (stage-stepper.jsx) reconciles
 * them with its clock, pushing the index back here while playing so the
 * chips follow the film.
 *
 * `stages` may be an array or a function of the params (meiosis has eleven
 * stages to mitosis's six). `locked(params)` may name a stage index the
 * cycle is arrested at; chips beyond it are dimmed and Next stops there.
 */
function StageStepper({ control, params, setParam, value, emit }) {
  const stages = typeof control.stages === "function" ? control.stages(params) : control.stages ?? [];
  const n = stages.length;
  const index = n > 0 ? Math.min(n - 1, Math.max(0, Math.round(Number(value) || 0))) : 0;
  const playing = Boolean(params[control.playKey ?? "playing"]);
  const lock = typeof control.locked === "function" ? control.locked(params) : null;
  const lockIndex = lock === null || lock === undefined ? null : Number(lock);
  const allowed = (i) => lockIndex === null || i <= lockIndex;
  const go = (i) => {
    if (n === 0) return;
    const wrapped = ((i % n) + n) % n;
    emit(allowed(wrapped) ? wrapped : lockIndex);
  };
  const columns = control.columns ?? (n > 6 ? 3 : 2);
  const current = stages[index];
  const label = typeof current === "string" ? current : current?.short ?? current?.label ?? "";

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        {control.label && (
          <p className="text-[10px] uppercase tracking-wider text-ink-500">{control.label}</p>
        )}
        <button
          type="button"
          onClick={() => setParam(control.playKey ?? "playing", !playing)}
          aria-pressed={playing}
          suppressHydrationWarning
          className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
            playing
              ? "border-duck-500/60 bg-duck-500/15 text-duck-300"
              : "border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600 hover:text-ink-100"
          }`}
        >
          {playing ? <Pause className="h-3 w-3" strokeWidth={2} /> : <Play className="h-3 w-3" strokeWidth={2} />}
          {playing ? (control.pauseLabel ?? "Auto-play · on") : (control.playLabel ?? "Step-by-step")}
        </button>
      </div>

      <div className="mb-1.5 flex items-stretch gap-1">
        <HudButton icon={SkipBack} onClick={() => go(index - 1)} className="shrink-0 px-2" disabled={n === 0}>
          <span className="sr-only">Previous stage</span>
        </HudButton>
        <div className="flex min-w-0 flex-1 items-center justify-center rounded-md border border-ink-800 bg-ink-950/60 px-2 text-[11px]">
          <span className="mr-1.5 shrink-0 font-mono text-[10px] text-ink-500">{n > 0 ? `${index + 1}/${n}` : "—"}</span>
          <span className="truncate font-medium text-ink-100">{label}</span>
          {lockIndex !== null && index === lockIndex && (
            <span className="ml-1.5 shrink-0 rounded bg-rose-500/15 px-1 text-[9px] font-semibold uppercase tracking-wider text-rose-300">arrested</span>
          )}
        </div>
        <HudButton icon={SkipForward} onClick={() => go(index + 1)} className="shrink-0 px-2" disabled={n === 0 || (lockIndex !== null && index >= lockIndex)}>
          <span className="sr-only">Next stage</span>
        </HudButton>
      </div>

      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {stages.map((stage, i) => {
          const text = typeof stage === "string" ? stage : stage.short ?? stage.label;
          const title = typeof stage === "string" ? undefined : stage.label;
          const active = i === index;
          const ok = allowed(i);
          return (
            <button
              key={typeof stage === "string" ? stage : stage.key ?? i}
              type="button"
              onClick={() => go(i)}
              aria-pressed={active}
              aria-disabled={!ok}
              title={ok ? title : `${title ?? text} — blocked by the arrest`}
              suppressHydrationWarning
              className={`flex items-center gap-1 truncate rounded-md border px-1.5 py-1 text-left text-[10.5px] font-medium transition-colors ${
                active
                  ? "border-duck-500/60 bg-duck-500/15 text-duck-300"
                  : ok
                    ? "border-ink-700 bg-ink-850 text-ink-400 hover:border-ink-600 hover:text-ink-200"
                    : "border-ink-800 bg-ink-900 text-ink-600 line-through decoration-rose-500/60"
              }`}
            >
              <span className={`shrink-0 font-mono text-[9px] ${active ? "text-duck-400" : "text-ink-600"}`}>{i + 1}</span>
              <span className="truncate">{text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Hooke's Law 2D Sidebar Graph ───────────────────────────────────

/**
 * 2D Force–Extension graph in the left sidebar HUD.
 * Plots Hooke's law elastic line, plastic yield curve, unload line,
/**
 * High-precision 2D Force–Extension graph in the left sidebar HUD.
 * Renders smooth Hookean elastic response, smooth plastic yield curvature,
 * parallel unloading line, elastic limit guideline, local tangent gradient,
 * permanent set indicator, and live operating point with overload protection.
 */
function HookesLawSidebarGraph({ params }) {
  const massKg = typeof params?.hangingMass === "number" ? params.hangingMass : 0.5;
  const k = typeof params?.springConstant === "number" ? params.springConstant : 80;
  const force = loadForce(massKg);
  const peakForce = Math.max(typeof params?.peakForce === "number" ? params.peakForce : 0, force);

  const solved = useMemo(() => solveSpring({ massKg, k, peakForce }), [massKg, k, peakForce]);

  const x_L = ELASTIC_LIMIT_EXTENSION; // 0.14 m
  const x_F = FAILURE_EXTENSION; // 0.30 m
  const F_L = elasticLimitForce(k);
  const F_F = failureForce(k);

  // Overloaded is when CURRENT force meets or exceeds the failure threshold
  const isOverloaded = solved.force >= F_F - 1e-6;
  const activeF = isOverloaded ? F_F : solved.force;
  const activeX = isOverloaded ? x_F : solved.extension;
  const activeStiffness = isOverloaded ? 0 : solved.stiffness;

  // A round top for the axis, so its printed labels ARE its gridline values.
  const yMax = forceAxisMax(Math.max(F_F, force));
  const xMax = x_F * 1.08;
  /** A gridline value as printed: exact, with no trailing zeros. */
  const newtons = (v) => `${Math.round(v * 100) / 100}N`;

  const width = 280;
  const height = 132;
  const padL = 34;
  const padR = 14;
  const padT = 18;
  const padB = 22;

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const toSvgX = (x) => padL + (Math.max(0, Math.min(x, xMax)) / (xMax || 1)) * plotW;
  const toSvgY = (f) => padT + ((yMax - Math.max(0, Math.min(f, yMax))) / (yMax || 1)) * plotH;

  const limitX = toSvgX(x_L);
  const failX = toSvgX(x_F);
  const baselineY = toSvgY(0);

  // Peak reached along loading path
  const peakF = Math.min(peakForce, F_F);
  const peakX = Math.min(loadingExtension(peakF, k), x_F);

  // The curve is drawn exactly as the solver has it: a straight Hooke's-law
  // line up to the elastic limit, then a straight, shallower plastic branch.
  // It used to be rounded off at the corner with a 1.4 cm fillet, which is not
  // in the model — the plotted curve then missed the operating point by a
  // little wherever it sat near the limit, and the end of a partly drawn
  // plastic branch could land off the curve altogether.

  // 1. Full Capability Envelope (faint reference background)
  const envelopePath = useMemo(() => {
    return `M ${toSvgX(0)} ${toSvgY(0)} L ${toSvgX(x_L)} ${toSvgY(F_L)} L ${toSvgX(x_F)} ${toSvgY(F_F)}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, xMax, yMax]);

  // 2. Active Elastic Path & Area Fill
  const { elasticStrokeD, elasticFillD } = useMemo(() => {
    const endX = Math.min(peakX, x_L);
    const endF = endX * k;
    const stroke = `M ${toSvgX(0)} ${toSvgY(0)} L ${toSvgX(endX)} ${toSvgY(endF)}`;
    const fill = `M ${toSvgX(0)} ${toSvgY(0)} L ${toSvgX(endX)} ${toSvgY(endF)} L ${toSvgX(endX)} ${baselineY} L ${toSvgX(0)} ${baselineY} Z`;
    return { elasticStrokeD: stroke, elasticFillD: fill };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peakX, k, xMax, yMax, baselineY]);

  // 3. Active Plastic Path & Area Fill (when peakForce > F_L)
  const { plasticStrokeD, plasticFillD } = useMemo(() => {
    if (peakF <= F_L) return { plasticStrokeD: "", plasticFillD: "" };
    const stroke = `M ${toSvgX(x_L)} ${toSvgY(F_L)} L ${toSvgX(peakX)} ${toSvgY(peakF)}`;
    const fill = `${stroke} L ${toSvgX(peakX)} ${baselineY} L ${toSvgX(x_L)} ${baselineY} Z`;
    return { plasticStrokeD: stroke, plasticFillD: fill };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peakF, peakX, F_L, k, xMax, yMax, baselineY]);

  // 4. Unload line (from peak point down to permanent set)
  const unloadData = useMemo(() => {
    if (peakF <= F_L) return null;
    const setM = permanentSet(peakF, k);
    return {
      x0: toSvgX(peakX),
      y0: toSvgY(peakF),
      x1: toSvgX(setM),
      y1: toSvgY(0),
      setM,
      setSvgX: toSvgX(setM),
    };
  }, [peakF, peakX, F_L, k, xMax, yMax]);

  // 5. Operating point & tangent line
  const markerX = toSvgX(activeX);
  const markerY = toSvgY(activeF);

  const tangentPoints = useMemo(() => {
    const half = 0.028;
    const m = activeStiffness;
    const x0 = Math.max(activeX - half, 0);
    const x1 = Math.min(activeX + half, xMax);
    return {
      x0: toSvgX(x0),
      y0: toSvgY(activeF - (activeX - x0) * m),
      x1: toSvgX(x1),
      y1: toSvgY(activeF + (x1 - activeX) * m),
    };
  }, [activeX, activeF, activeStiffness, xMax, yMax]);

  // Status Badge
  const statusBadge = isOverloaded
    ? { label: "Broken (Scrap)", badge: "bg-rose-500/20 text-rose-300 border-rose-500/40" }
    : solved.yielding
    ? { label: "Plastic Yielding", badge: "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse" }
    : solved.yielded
    ? { label: `Set: ${(solved.permanentSet * 100).toFixed(1)}cm`, badge: "bg-duck-500/20 text-duck-300 border-duck-500/40" }
    : { label: "Hooke's Law (F=kx)", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" };

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-950/70 p-2.5 space-y-2 shadow-inner">
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] font-bold uppercase tracking-wider text-duck-300"
          style={{ fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" }}
        >
          Force–Extension F(x)
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wide border shadow-sm ${statusBadge.badge}`}
          style={{ fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" }}
        >
          {statusBadge.label}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto select-none overflow-visible"
        style={{ textRendering: "geometricPrecision" }}
      >
        <defs>
          {/* Elastic Region Fill Gradient */}
          <linearGradient id="hookeElasticGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
          </linearGradient>

          {/* Plastic Region Fill Gradient */}
          <linearGradient id="hookePlasticGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
        <line x1={padL} y1={padT} x2={width - padR} y2={padT} stroke="#1e2638" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={padL} y1={padT + plotH / 2} x2={width - padR} y2={padT + plotH / 2} stroke="#1e2638" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={padL} y1={baselineY} x2={width - padR} y2={baselineY} stroke="#475569" strokeWidth="1.2" />

        {/* Vertical zero axis */}
        <line x1={padL} y1={padT} x2={padL} y2={baselineY} stroke="#475569" strokeWidth="1.2" />

        {/* Y Axis Title */}
        <text
          x={padL - 4}
          y={padT - 7}
          textAnchor="end"
          style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
          className="text-[8px] fill-ink-400 font-semibold"
        >
          F (N)
        </text>

        {/* X Axis Title */}
        <text
          x={width - padR}
          y={baselineY - 5}
          textAnchor="end"
          style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
          className="text-[7.5px] fill-ink-500 font-medium"
        >
          Δx (cm)
        </text>

        {/* Elastic Limit Vertical Guideline */}
        <line x1={limitX} y1={padT} x2={limitX} y2={baselineY} stroke="#f43f5e" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.8" />
        <g transform={`translate(${limitX}, ${padT - 7})`}>
          <rect x="-24" y="-7" width="48" height="13" rx="3" fill="#1e1824" stroke="#f43f5e" strokeWidth="0.8" />
          <text
            x="0"
            y="2.5"
            textAnchor="middle"
            style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
            className="text-[7.5px] fill-rose-300 font-bold"
          >
            {(x_L * 100).toFixed(0)}cm Limit
          </text>
        </g>

        {/* Background Full Capability Envelope (Faint reference) */}
        <path
          d={envelopePath}
          fill="none"
          stroke="#334155"
          strokeWidth="1.2"
          strokeDasharray="3 3"
          opacity="0.45"
        />

        {/* Active Elastic Curve & Fill */}
        {elasticFillD && <path d={elasticFillD} fill="url(#hookeElasticGrad)" />}
        {elasticStrokeD && (
          <path
            d={elasticStrokeD}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        )}

        {/* Active Plastic Curve & Fill */}
        {plasticFillD && <path d={plasticFillD} fill="url(#hookePlasticGrad)" />}
        {plasticStrokeD && (
          <path
            d={plasticStrokeD}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Unload Line (Dashed Gold) */}
        {unloadData && (
          <g>
            <line
              x1={unloadData.x0}
              y1={unloadData.y0}
              x2={unloadData.x1}
              y2={unloadData.y1}
              stroke="#fbbf24"
              strokeWidth="1.8"
              strokeDasharray="4 3"
              strokeLinecap="round"
              opacity="0.9"
            />
            {/* Permanent set axis indicator */}
            {unloadData.setM > 0.005 && (
              <g transform={`translate(${unloadData.setSvgX}, ${baselineY})`}>
                <polygon points="0,-4 -3,0 3,0" fill="#fbbf24" />
                <text
                  x="0"
                  y="12"
                  textAnchor="middle"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums" }}
                  className="text-[7.5px] fill-amber-300 font-bold"
                >
                  Set: {(unloadData.setM * 100).toFixed(1)}
                </text>
              </g>
            )}
          </g>
        )}

        {/* Measured Tangent Gradient Line */}
        <line
          x1={tangentPoints.x0}
          y1={tangentPoints.y0}
          x2={tangentPoints.x1}
          y2={tangentPoints.y1}
          stroke="#34d399"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* Overload guide when hung load exceeds spring breaking threshold */}
        {isOverloaded && force > F_F + 0.05 && (
          <g>
            <line
              x1={failX}
              y1={markerY}
              x2={failX}
              y2={toSvgY(force)}
              stroke="#f43f5e"
              strokeWidth="1.4"
              strokeDasharray="3 3"
              opacity="0.8"
            />
            <circle cx={failX} cy={toSvgY(force)} r="3" fill="#f43f5e" opacity="0.9" />
            <text
              x={failX - 5}
              y={toSvgY(force) + 3}
              textAnchor="end"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums" }}
              className="text-[7.5px] fill-rose-400 font-semibold"
            >
              Hung: {force.toFixed(1)}N
            </text>
          </g>
        )}

        {/* Live Operating Point Marker */}
        <circle
          cx={markerX}
          cy={markerY}
          r={isOverloaded ? "7" : "6"}
          fill={isOverloaded ? "#f43f5e" : solved.yielded ? "#fbbf24" : solved.yielding ? "#f59e0b" : "#38bdf8"}
          opacity="0.25"
          className="animate-pulse"
        />
        <circle
          cx={markerX}
          cy={markerY}
          r={isOverloaded ? "4" : "3.6"}
          fill={isOverloaded ? "#f43f5e" : solved.yielded ? "#fbbf24" : solved.yielding ? "#f59e0b" : "#38bdf8"}
          stroke="#ffffff"
          strokeWidth="1.5"
        />
        <circle cx={markerX} cy={markerY} r="1.3" fill="#ffffff" />

        {/* Y Axis numerical tick labels */}
        <text
          x={padL - 4}
          y={padT + 3}
          textAnchor="end"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums" }}
          className="text-[8px] fill-ink-400 font-medium"
        >
          {newtons(yMax)}
        </text>
        <text
          x={padL - 4}
          y={padT + plotH / 2 + 3}
          textAnchor="end"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums" }}
          className="text-[8px] fill-ink-500 font-medium"
        >
          {newtons(yMax / 2)}
        </text>
        <text
          x={padL - 4}
          y={baselineY + 3}
          textAnchor="end"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums" }}
          className="text-[8px] fill-ink-500 font-medium"
        >
          0
        </text>

        {/* X Axis numerical tick labels */}
        {(!unloadData || unloadData.setSvgX > padL + 36) && (
          <text
            x={padL}
            y={baselineY + 12}
            textAnchor="start"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums" }}
            className="text-[8px] fill-ink-500 font-medium"
          >
            0cm
          </text>
        )}
        <text
          x={limitX}
          y={baselineY + 12}
          textAnchor="middle"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums" }}
          className="text-[8px] fill-rose-400 font-semibold"
        >
          {(x_L * 100).toFixed(0)}cm
        </text>
        <text
          x={failX}
          y={baselineY + 12}
          textAnchor="middle"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums" }}
          className="text-[8px] fill-ink-400 font-medium"
        >
          {(x_F * 100).toFixed(0)}cm
        </text>
      </svg>

      {/* Mini 3-value readout cards */}
      <div className="grid grid-cols-3 gap-1 border-t border-ink-800/80 pt-1.5 text-center">
        <div className="flex flex-col bg-ink-900/60 rounded px-1 py-0.5 border border-ink-800/50">
          <span className="text-[7.5px] uppercase tracking-wider text-ink-500 font-sans">Load (F)</span>
          <span
            className="text-[9.5px] font-bold text-amber-300 truncate"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums" }}
          >
            {solved.force.toFixed(2)} N
          </span>
        </div>
        <div className="flex flex-col bg-ink-900/60 rounded px-1 py-0.5 border border-ink-800/50">
          <span className="text-[7.5px] uppercase tracking-wider text-ink-500 font-sans">Extension (x)</span>
          <span
            className="text-[9.5px] font-bold text-duck-300 truncate"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums" }}
          >
            {(solved.extension * 100).toFixed(1)} cm
          </span>
        </div>
        <div className="flex flex-col bg-ink-900/60 rounded px-1 py-0.5 border border-ink-800/50">
          <span className="text-[7.5px] uppercase tracking-wider text-ink-500 font-sans">Stiffness (k)</span>
          <span
            className={`text-[9.5px] font-bold truncate ${
              isOverloaded
                ? "text-rose-400"
                : solved.yielding
                ? "text-amber-400"
                : solved.yielded
                ? "text-duck-300"
                : "text-emerald-400"
            }`}
            style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums" }}
          >
            {isOverloaded ? "0 (Scrap)" : `${activeStiffness.toFixed(0)} N/m`}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── The overlay ────────────────────────────────────────────────────

// ─── Details readout helper ─────────────────────────────────────────

const num = (v, fallback) => (v !== undefined && v !== null && !isNaN(Number(v)) ? Number(v) : fallback);

/** What each aqueous metal ion looks like — the words, for the Details panel. */
const SOLUTION_TINT = { Cu: "blue", Fe: "pale green", Ag: "colourless", Mg: "colourless", Zn: "colourless", K: "colourless", Au: "yellow" };

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
      const thickness = num(params.thickness, 3.0);

      // The same solver the scene traces the ray with (lib/rayOptics.js).
      // This case used to recompute all of it, and got two of them wrong: the
      // reflected share came from the s-polarisation alone where unpolarised
      // light is the average of both, and the lateral shift was unguarded at
      // grazing incidence where cos r goes to zero.
      const block = solveBlock(iDeg, n1, n2, thickness);
      const { tir, critical, lateral, reflectance } = block;
      const iRad = block.i;
      const rRad = block.r ?? 0;
      const rDeg = (rRad * 180) / Math.PI;

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
          { color: mediumColour(medium2), shape: "square", label: "Optical Medium Block", note: `Refractive index n = ${n2.toFixed(2)}` },
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
          { color: PALETTE.rose, shape: "square", label: "North Pole (N)", note: "Magnetic source pole" },
          { color: PALETTE.sky, shape: "square", label: "South Pole (S)", note: "Magnetic sink pole" },
        ],
      };
      break;
    }

    case "lenses": {
      const type = opticsTypeOf(params);
      const f = num(params.focal, 2.5);
      const u = num(params.objectDistance, 5);
      const h = num(params.objectHeight, 1.5);

      // From lib/rayOptics.js, the same call the scene makes. Kept separately
      // here, this case called an object "at infinity" within 0.03 of F where
      // the scene used 0.035, and printed h' as +m·h for a real image the
      // scene drew inverted — the panel said "Inverted" one row above a
      // positive height.
      const solved = solveRayOptics({ type, focal: f, objectDistance: u, objectHeight: h });
      const { atInfinity, v, imageHeight: imgHeight, magnification: m, real, isMirror, isConverging } = solved;
      const natureText = imageNature(solved);
      const titleMap = OPTICS_TITLES;

      readout = {
        title: titleMap[type] || "Ray Optics",
        subtitle: isMirror
          ? "1/v + 1/u = 1/f  ·  m = |v ÷ u|"
          : "1/v − 1/u = 1/f  ·  m = |v ÷ u|",
        rows: [
          ["Optical element", titleMap[type]?.split(" ")[0] || "Lens"],
          ["Object distance u", `${u.toFixed(1)} cm`],
          ["Object height h", `${h.toFixed(1)} cm`],
          ["Focal length f", `${f.toFixed(1)} cm`, "gold"],
          ["Image distance v", atInfinity ? "∞" : `${v.toFixed(1)} cm`, real ? "good" : "bad"],
          ["Image height h'", atInfinity ? "—" : `${imgHeight.toFixed(2)} cm`],
          ["Magnification m", atInfinity ? "∞" : `${m.toFixed(2)}×`],
          ["Nature", atInfinity ? "None (Spotlight)" : real ? "Real" : "Virtual", real ? "good" : "warn"],
          ["Orientation", atInfinity ? "—" : solved.inverted ? "Inverted" : "Upright"],
          ["Object position", objectZone(f, u)],
        ],
        note: atInfinity
          ? "Object is at focal point F: rays leave exactly parallel and never intersect (collimator spotlight)."
          : isMirror
          ? isConverging
            ? u > f
              ? "Concave mirror: reflected rays converge in front of the mirror to form an inverted real image."
              : "Concave mirror (magnifier): rays diverge upon reflection; back-extensions meet behind the mirror to produce a magnified upright virtual image."
            : "Convex mirror: rays diverge outward from the virtual focal point behind the mirror; always upright, virtual, and diminished (wide field of view)."
          : isConverging
          ? u > f
            ? "Convex lens: refracted rays converge to form an inverted real image that can be caught on a screen."
            : "Convex lens (magnifying glass): refracted rays diverge; apparent back-extensions form an upright magnified virtual image."
          : "Concave lens: refracted rays diverge away from virtual focus; image is always virtual, upright, and diminished.",
        noteTone: real ? "good" : "neutral",
      };

      legend = {
        title: "Ray Construction Key",
        items: [
          { color: "#fbbf24", shape: "square", label: "Object Arrow", note: `Upright object (h = ${h.toFixed(1)} cm)` },
          {
            color: "#34d399",
            shape: "line",
            label: "Ray 1 (Parallel → Focus)",
            note: isMirror
              ? (isConverging ? "Reflects through focal point F" : "Reflects diverging from virtual focus F")
              : (isConverging ? "Refracts through focal point F" : "Refracts diverging from virtual focus F"),
          },
          {
            color: "#38bdf8",
            shape: "line",
            label: isMirror ? "Ray 2 (Focal Ray → Parallel)" : "Ray 2 (Optical Center)",
            note: isMirror
              ? "Passes through (or aims at) F, reflects parallel to axis"
              : "Passes undeviated through optical center",
          },
          ...(isMirror
            ? [{ color: PALETTE.violet, shape: "line", label: "Ray 3 (Vertex Reflection)", note: "Reflects at equal angle from mirror pole" }]
            : [{ color: PALETTE.violet, shape: "line", label: "Ray 3 (Focal Ray → Parallel)", note: "Passes through F, emerges parallel to axis" }]),
          { color: real ? PALETTE.emerald : PALETTE.rose, shape: "square", label: "Formed Image Arrow", note: natureText || "Projected image" },
          { color: PALETTE.rose, shape: "dash", label: "Virtual Ray Extension", note: "Apparent ray back-projection behind surface" },
          { color: "#64748b", shape: "line", label: "Principal Axis", note: "Central horizontal optical reference" },
        ],
      };
      break;
    }

    case "induction": {
      const isSolenoid = params?.apparatus === "solenoid";
      const speed = num(params.speed, 1.0);
      const N = num(params.turns, 3);

      if (isSolenoid) {
        const strength = num(params.magnetStrength, 1.2);
        const auto = params.autoOscillate !== false;
        const flipped = Boolean(params.flipPoles);
        const pos = auto ? "Auto-shaker active" : `${num(params.magnetPos, 0).toFixed(1)} cm`;

        readout = {
          title: "Faraday's Law: Bar Magnet & Solenoid",
          subtitle: "ε = −N (dΦ/dt) = −N (dΦ/dx) · v",
          rows: [
            ["Coil turns N", N, "gold"],
            ["Magnet dipole field", `${strength.toFixed(1)} T`],
            ["Magnet position x", pos],
            // The shaker turns at MAGNET_OMEGA rad/s per slider unit: f = ω / 2π, not the slider value.
            ["Motion mode", auto ? `Harmonic oscillation (${((speed * MAGNET_OMEGA) / (2 * Math.PI)).toFixed(2)} Hz)` : "Manual slider"],
            ["Pole orientation", flipped ? "South leading (S ⇄ N)" : "North leading (N ⇄ S)"],
            ["Active indicators", "Galvanometer + Incandescent Bulb"],
            ["Lenz's law status", "Induced B opposes the change in flux ΔΦ"],
          ],
          note: !auto && Math.abs(num(params.magnetPos, 0)) < 0.05
            ? "Magnet resting at coil center: flux is maximized but NOT changing (dΦ/dt = 0). Induced e.m.f. is strictly 0 V!"
            : auto
              ? "As the magnet moves in and out of the solenoid, changing flux induces alternating voltage, causing the light bulb to flash and the needle to swing left and right."
              : "Slide the magnet position: e.m.f. is only induced while the magnet is physically in motion across the coil windings.",
          noteTone: "good",
        };

        legend = {
          title: "Solenoid Apparatus Key",
          items: [
            { color: "#ef4444", shape: "square", label: "North Pole (N)", note: "Red magnetic pole half" },
            { color: "#3b82f6", shape: "square", label: "South Pole (S)", note: "Blue magnetic pole half" },
            { color: "#ea580c", shape: "line", label: "Copper Solenoid Coils", note: "One wire wound N times, both ends to the meter" },
            { color: "#fef08a", shape: "dot", label: "Charge dots", note: "Conventional current (+ to −); reverses as the magnet enters vs leaves" },
            { color: PALETTE.emerald, shape: "square", label: "Induced field B", note: "Opposes ΔΦ; the end it leaves from is an induced north pole" },
            { color: "#38bdf8", shape: "dash", label: "Field Lines B", note: "Arrowed from N to S outside the magnet" },
            { color: "#fef08a", shape: "dot", label: "Demonstration Light Bulb", note: "Incandescent filament glow (P ∝ ε²)" },
            { color: "#334155", shape: "square", label: "Center-Zero Galvanometer", note: "Deflects ± to show induced current direction" },
          ],
        };
      } else {
        const B = num(params.field, 1.0);
        // From lib/induction.js, the coil the scene actually turns. This case
        // had its own two lines, and the peak was out by a factor of seven:
        // the real coil generates N·B·A·ω with A = 6.0 m² and ω = 1.7·speed,
        // where this printed N·B·speed·1.5.
        const dynamo = solveInduction({ speed, field: B, turns: N });
        const flux = fluxAt(B, 0); // Φ₀ = B·A, the peak of B·A·cos θ
        const peak = dynamo.peakEmf;

        readout = {
          title: "Faraday's Law of Induction (Dynamo)",
          subtitle: "Φ = B A cos θ · ε = −N dΦ/dt = NBAω sin ωt",
          rows: [
            ["Turns N", dynamo.turns, "gold"],
            ["Coil area A", `${COIL_AREA.toFixed(1)} m²`],
            ["Max flux Φ₀", `${flux.toFixed(2)} Wb`],
            ["Peak e.m.f. ε₀", `${peak.toFixed(2)} V`, peak > 0.05 ? "good" : "bad"],
            ["Angular speed ω", `${dynamo.omega.toFixed(2)} rad/s`],
            // f = ω / 2π. The slider unit is 1.7 rad/s (0.27 Hz), so quoting the
            // slider value here as hertz overstated the frequency almost fourfold.
            ["Output frequency f = ω/2π", speed < 0.05 ? "Stopped" : `${dynamo.frequencyHz.toFixed(2)} Hz`],
            ["Period T", speed < 0.05 ? "—" : `${dynamo.period.toFixed(1)} s`],
            ["Active loads", "Bulb + Center-Zero Galvanometer"],
          ],
          note: speed < 0.05
            ? "Coil stationary: flux never changes, so induced e.m.f. is zero. Motion or changing flux is required."
            : "As the coil rotates, it cuts magnetic field lines at varying angles, producing a smooth sinusoidal AC wave and pulsing the demonstration bulb.",
          noteTone: speed < 0.05 ? "bad" : "good",
        };

        legend = {
          title: "Generator Components Key",
          items: [
            { color: "#ef4444", shape: "square", label: "North Pole (N)", note: "Magnetic field source" },
            { color: "#3b82f6", shape: "square", label: "South Pole (S)", note: "Magnetic field sink" },
            { color: "#38bdf8", shape: "dash", label: "Magnetic Field Lines B", note: "Flux density vector lines" },
            { color: "#ea580c", shape: "line", label: "Copper Coil Winding", note: "One wire wound N times; its two ends go to the slip rings" },
            { color: "#fef08a", shape: "dot", label: "Charge dots & gold arrows", note: "Conventional current (+ to −); reverses every half turn" },
            { color: "#fef08a", shape: "dot", label: "Demonstration Light Bulb", note: "Flashes at each AC voltage crest" },
            { color: "#334155", shape: "square", label: "Center-Zero Galvanometer", note: "Needle tracks instantaneous e.m.f." },
          ],
        };
      }
      break;
    }

    case "gas": {
      const T = num(params.temperature, 300);
      const V = num(params.volume, 1);
      const N = num(params.particles, 60);
      // From lib/particleModel.js, the same scale the cylinder label prints.
      // This case normalised the pressure by (V · 180) and the scene by the
      // reference point, so the panel read 100 kPa over a scene that said 101.
      const gas = gasLawReadout({ temperature: T, volume: V, particles: N });
      const pressure = gas.pressureKPa;

      readout = {
        title: "Ideal Gas State (pV = NkT)",
        subtitle: "Particle collisions per unit wall area",
        rows: [
          ["Pressure p", `${pressure.toFixed(1)} kPa`, "gold"],
          ["Temperature T", `${T} K (${T - 273}°C)`, T > 600 ? "warn" : undefined],
          ["Volume V", `${V.toFixed(2)} V₀`],
          ["Particles N", N],
          ["Mean particle speed", `${Math.sqrt(T / 300).toFixed(2)}×`],
          ["pV", gas.pV.toFixed(1), "good"],
          ["p ÷ T constant", gas.pOverT.toFixed(3), "good"],
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
          { color: PALETTE.rose, shape: "dot", label: "Hot Gas Particle", note: "High kinetic energy / speed" },
          { color: "#38bdf8", shape: "dot", label: "Cold Gas Particle", note: "Lower kinetic energy / speed" },
          { color: "#64748b", shape: "square", label: "Piston / Cylinder Wall", note: "Enclosed volume boundary" },
          { color: "#fbbf24", shape: "dot", label: "Wall Collision Impulses", note: "Transfers momentum to generate pressure" },
        ],
      };
      break;
    }

    case "projectile": {
      // launchSpeed only: `speed` is the animation-speed slider, and falling back to it
      // would print a launch of "1 m/s" over a scene that fires at 22.
      const speed = num(params.launchSpeed, 22);
      const angle = num(params.angle, 45);
      const gravity = num(params.gravity, 9.81);
      const drag = num(params.drag, 0.04);
      const mass = num(params.mass, 1);

      // The flight the scene draws, not an estimate of it (lib/projectile.js).
      // This case guessed: range = ideal × (1 − min(0.65, 10k)), apex at a
      // hardcoded 44% of that. On a 25 m/s launch into k = 0.06 the guess and
      // the curve beside it disagreed by metres.
      const flight = simulateFlight(speed, angle, gravity, drag, mass);
      const ideal = idealFlight(speed, angle, gravity);
      const idealRange = ideal.range;
      const idealApex = ideal.apex;
      const idealTime = ideal.flightTime;
      const dragLoss = idealRange > 0 ? Math.max(0, 1 - flight.range / idealRange) : 0;

      readout = {
        title: "2D Projectile Trajectory",
        subtitle: "F_drag = −k|v|v · gravity = −g ĵ",
        rows: [
          ["Launch Speed v₀", `${speed.toFixed(1)} m/s`, "gold"],
          ["Launch Angle θ", `${angle.toFixed(1)}°`],
          ["Gravity g", `${gravity.toFixed(2)} m/s²`],
          ["Drag constant k", drag === 0 ? "vacuum" : `${drag.toFixed(3)} kg/m`],
          ["Range with Drag", `${flight.range.toFixed(1)} m`, "good"],
          ["Ideal Range (No Drag)", `${idealRange.toFixed(1)} m`],
          ["Apex Height", `${flight.apex.toFixed(1)} m`],
          ["Apex Distance", `${flight.apexX.toFixed(1)} m`],
          ["Flight Time", `${flight.flightTime.toFixed(2)} s`],
          ["Ideal Flight Time", `${idealTime.toFixed(2)} s`],
          ["Impact Speed", `${flight.impactSpeed.toFixed(1)} m/s`, flight.impactSpeed < speed - 0.05 ? "warn" : undefined],
        ],
        note: drag > 0.005
          ? `Quadratic drag causes the projectile to lose horizontal momentum throughout its flight, steepening its descent and reducing range by ${(dragLoss * 100).toFixed(0)}%.`
          : "With zero atmospheric drag, the flight path is a perfect symmetrical parabola with maximum range achieved at exactly 45°.",
        noteTone: drag > 0.005 ? "warn" : "good",
      };

      legend = {
        title: "Ballistic Trajectory Key",
        items: [
          { color: "#34d399", shape: "line", label: "Trajectory with Drag", note: "Realistic asymmetric flight path" },
          { color: "#64748b", shape: "dash", label: "Ideal Parabola (No Drag)", note: "Theoretical symmetric vacuum path" },
          { color: "#38bdf8", shape: "line", label: "Velocity Vector v", note: "Instantaneous tangential velocity" },
          { color: "#fb7185", shape: "line", label: "Weight Vector W", note: "Constant downward gravitational force (m·g)" },
          { color: "#fbbf24", shape: "line", label: "Drag Force F_drag", note: "Quadratic air resistance (−k|v|v)" },
          { color: "#34d399", shape: "line", label: "Resultant Force F_net", note: "Vector sum of weight and air drag (W + F_drag); all three force arrows share one scale" },
          { color: "#fbbf24", shape: "dot", label: "Projectile Mass m", note: `${mass} kg launch mass` },
        ],
      };
      break;
    }

    case "interference": {
      const slits = num(params.slits, 2);
      const separation = num(params.separation, 2.2);
      const wavelength = num(params.wavelength, 1.2);
      // The tank's own screen distance (lib/interference.js). This case carried
      // its own L = 10.2 beside a scene whose screen is 10.7 from the sources.
      const L = SCREEN_DISTANCE;

      const fringeSpacing = slits === 2 ? (wavelength * L) / separation : null;
      // Exact for this tank — the same position the order labels sit at — rather
      // than the far-field L·tan θ, which is only good when L is much larger than d.
      const firstOrderX = slits === 2 ? fringePosition(1, separation, wavelength, L) : null;
      const highestOrder = slits === 2 ? Math.floor(separation / wavelength) : 0;

      readout = {
        title: "Wave Interference & Fringes",
        subtitle: slits === 2 ? "d sin θ = mλ (path difference decides fringes)" : "Single source diffraction",
        rows: [
          ["Slit Sources", slits, "gold"],
          ["Wavelength λ", `${wavelength.toFixed(2)} m`],
          ["Slit Separation d", slits === 2 ? `${separation.toFixed(2)} m` : "—"],
          ["Screen Distance L", `${L.toFixed(1)} m`],
          ["1st Max Position x", firstOrderX ? `${firstOrderX.toFixed(2)} m${firstOrderX > FIELD_HALF_X ? " · off the screen" : ""}` : "—", firstOrderX && firstOrderX > FIELD_HALF_X ? "warn" : "good"],
          ["Spacing ≈ λL ÷ d", fringeSpacing ? `${fringeSpacing.toFixed(2)} m` : "—"],
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
          { color: "#fbbf24", shape: "line", label: "Screen Fringes & Intensity Graph", note: "Bright fringes are maxima; the curve above plots the same pattern, and each bright fringe is labelled by its order m" },
        ],
      };
      break;
    }

    case "orbits": {
      const mass = num(params.mass, 1);
      const launchRadius = num(params.launchRadius, 3.4);
      // The launch speed is a multiple of the circular speed at that radius.
      const launchRatio = num(params.launchRatio, 1);
      const loops = params.loopEscape !== false;

      // The conic the scene actually flies (lib/orbit.js). This case carried its
      // own copy of μ, and labelled scene units as AU, km/s and J/kg — none of
      // which these numbers are, as the topic itself says.
      const orbit = solveOrbit({ mass, launchRadius, launchRatio });
      const { mu, circularSpeed: circular, escapeSpeed, energy } = orbit;
      const unbound = !orbit.bound;

      readout = {
        title: "Keplerian Gravitational Orbits",
        subtitle: "Specific orbital energy ε = v²/2 − GM/r",
        rows: [
          ["Grav Parameter μ = GM", `${mu.toFixed(1)}`, "gold"],
          ["Launch Radius r₀", `${launchRadius.toFixed(2)} units`],
          ["Launch Speed v₀", `${orbit.launchSpeed.toFixed(2)} units/s · ${launchRatio.toFixed(2)}× v_c`, "gold"],
          ["Circular Speed v_c", `${circular.toFixed(2)} units/s`],
          ["Escape Speed v_esc", `${escapeSpeed.toFixed(2)} units/s`],
          ["Orbital Energy ε", `${energy.toFixed(2)} units²/s²`, unbound ? "bad" : "good"],
          ["Eccentricity e", orbit.eccentricity.toFixed(2)],
          ["Closest / farthest r", unbound ? `${orbit.periapsis.toFixed(1)} / ∞` : `${orbit.periapsis.toFixed(1)} / ${orbit.apoapsis.toFixed(1)}`],
          ["Period T", unbound ? "never returns" : `${orbit.period.toFixed(1)} s`],
          ["Trajectory Type", unbound ? "Hyperbolic (Escape)" : orbit.kind === "circular" ? "Circular" : "Elliptical", unbound ? "bad" : "good"],
        ],
        note: unbound
          ? `Launch speed reaches escape velocity (ε ≥ 0, i.e. ≥ 1.41 × v_c): the satellite is on an open hyperbolic path and never returns. ${loops ? "It is shown leaving, then relaunched." : "It keeps going, and the camera follows it out."}`
          : orbit.kind === "circular"
          ? "Launch speed matches circular velocity: centripetal force exactly balances gravitational attraction, maintaining constant orbital radius."
          : orbit.apoapsis * 1.1 > VIEW_MAX
          ? `Launch speed is bounded (ε < 0) but only just: the ellipse is far wider than the view, so the satellite is shown leaving it${loops ? " and relaunched" : ""}. It does return, after T = ${orbit.period.toFixed(0)} s.`
          : "Launch speed is bounded (ε < 0): the satellite travels in a stable elliptical orbit around the central focus, and the camera backs off to fit the whole of it.",
        noteTone: unbound ? "bad" : "good",
      };

      legend = {
        title: "Gravitational Orbit Key",
        items: [
          { color: "#fbbf24", shape: "dot", label: "Central Mass (Star / Planet)", note: "Gravitational source creating potential well" },
          { color: "#34d399", shape: "dot", label: "Orbiting Satellite", note: "Body in continuous gravitational free-fall" },
          { color: "#34d399", shape: "line", label: "Orbital Path Trail", note: "Closed elliptical or open escape trajectory" },
          { color: "#38bdf8", shape: "line", label: "Potential Well Sheet", note: "Depth is −GM/r, the potential per kg — a picture of the potential, not of space; it fades out with distance and is not a wall" },
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
      // When it does go, how long and how fast until it meets the end stop.
      const slide = slideForecast({ massKg: mass, angleDeg: angle, surface: key, appliedForce: applied });

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
          ...(slide.slides
            ? [
                ["Time to the end stop", `${slide.timeToStop.toFixed(2)} s ${slide.direction > 0 ? "up" : "down"} the ramp`],
                ["Speed on reaching it", `${slide.impactSpeed.toFixed(2)} m/s`, "gold"],
              ]
            : []),
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
          { color: "#94a3b8", label: "Stop reaction R", note: "the end stop's push, drawn only once the block is pressed against it" },
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
          ? !lever
            ? `A single pulley saves no force: ${m.effortForce.toFixed(0)} N of effort to lift ${loadN.toFixed(0)} N, a little more than the load because of friction in the sheave. What it changes is the direction of the pull — you haul down instead of lifting up — and your hand moves exactly as far as the load. Add sheaves to start saving force.`
            : m.velocityRatio < 1
            ? `This machine costs force rather than saving it: ${m.effortForce.toFixed(0)} N of effort to lift ${loadN.toFixed(0)} N. What you get back is speed and reach — the load moves ${(1 / m.velocityRatio).toFixed(1)}× further than your hand does.${type === "lever3" ? " Your forearm is built this way." : ""}`
            : `The two arms are almost equal, so the lever saves no force: it takes ${m.effortForce.toFixed(0)} N to lift ${loadN.toFixed(0)} N — a little more than the load, because of friction at the pivot. Lengthen the effort arm to start saving force.`
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
            ? `The figures above are the frictionless ideal, so with friction on they are an upper bound: some of the starting ${(startEnergy / 1000).toFixed(0)} kJ ends up as heat in the wheels and brakes, and a release only just over 2.5 R can fall short — the live verdict on the scene says whether it does. The three bars still add to the same total; the heat bar never gives anything back. The mass is irrelevant to the ideal answer: it appears on both sides of ½mv² = mgh and cancels.`
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

    case "circuits_breadboard": {
      const topology = params.topology || "series";
      const voltage = num(params.voltage, 6);
      const bulbR = num(params.bulbR, 10);
      const unscrewed = Math.round(num(params.unscrewA, 0)) % 2 === 1;
      const shorted = Math.round(num(params.shortCircuit, 0)) % 2 === 1;
      const c = solveCircuit({ topology, voltage, bulbR, unscrewed, shorted });

      const ohms = (r) => (Number.isFinite(r) ? `${r.toFixed(2)} Ω` : "∞ — open");
      const lit = c.bulbs.filter((b) => b.lit).length;

      readout = {
        title: `${c.spec.label} circuit`,
        subtitle: c.spec.summary,
        rows: [
          ["Supply emf", `${voltage.toFixed(1)} V`, "gold"],
          ["Each bulb", `${bulbR.toFixed(0)} Ω`],
          // "wide" rows take both columns and wrap: the worked equation and the
          // per-bulb lines are far longer than half the sidebar and were being
          // cut off mid-number with an ellipsis.
          [c.formula, c.worked, "gold", "wide"],
          ["R of the network", ohms(c.networkR)],
          ...(shorted ? [["With the short fitted", ohms(c.externalR), "bad"]] : []),
          ["Total current from the pack", `${c.totalCurrent.toFixed(3)} A`, c.overCurrent ? "bad" : "default"],
          ...c.branches.map((b, i) => [
            `I${i + 1} — branch ${b.id}`,
            b.open ? "0 A — branch open" : `${b.current.toFixed(3)} A`,
            b.open ? "bad" : "good",
            b.open ? "wide" : undefined,
          ]),
          ...(shorted ? [["Through the jumper", `${c.shortCurrent.toFixed(2)} A`, "bad"]] : []),
          ["Volts across the network", `${c.networkVoltage.toFixed(2)} V`],
          ["Terminal voltage", `${c.terminalVoltage.toFixed(2)} V`, c.terminalVoltage < voltage * 0.85 ? "warn" : "good"],
          ...c.bulbs.map((b) => [
            `Bulb ${b.id}`,
            b.removed
              ? "unscrewed — infinite resistance"
              : `${b.voltage.toFixed(2)} V · ${b.power.toFixed(2)} W · ${(b.brightness * 100).toFixed(0)}% bright`,
            b.removed ? "bad" : b.lit ? "good" : "warn",
            "wide",
          ]),
          ["Bulbs lit", `${lit} of ${c.bulbs.length}`, lit === 0 ? "bad" : "good"],
          ["Wasted inside the pack", `${c.internalLoss.toFixed(2)} W`, c.overCurrent ? "bad" : "default"],
        ],
        note: c.dead
          ? `No current anywhere. The loop is broken at bulb A's socket, and in a series circuit there is only one loop — so every component is dead and the whole ${voltage.toFixed(1)} V sits across the empty socket. Switch to parallel and unscrew it again: the other branch will not notice.`
          : shorted
            ? `The jumper is a ${c.externalR.toFixed(3)} Ω path in parallel with the bulbs, so ${((c.shortCurrent / c.totalCurrent) * 100).toFixed(0)}% of the ${c.totalCurrent.toFixed(1)} A takes it and the bulbs are left with ${c.networkVoltage.toFixed(2)} V. The current is limited only by the pack's own 0.5 Ω, which is why ${c.internalLoss.toFixed(1)} W is now being dissipated inside the battery itself.`
            : unscrewed
              ? strandedBulbs(c).length > 0
                ? `Bulb A is out of its socket, and bulb ${strandedBulbs(c).join(" and ")} goes dark with it — they are in series on the same branch, so A's gap is ${strandedBulbs(c).length > 1 ? "their" : "its"} only path as well. Only the parallel branch survives, because each branch is its own loop back to the battery. The total current has FALLEN to ${c.totalCurrent.toFixed(2)} A: one fewer path means more resistance, not less.`
                : `Bulb A is out of its socket and its branch is open, but the rest of the board is unaffected — each parallel branch is its own loop back to the battery. Note the total current has FALLEN to ${c.totalCurrent.toFixed(2)} A: one fewer path means more resistance, not less.`
              : topology === "parallel"
                ? `Each branch sits across the supply, so both bulbs run at ${(c.bulbs[0].brightness * 100).toFixed(0)}% and the branch currents add to ${c.totalCurrent.toFixed(2)} A. In series the same two bulbs would draw ${solveCircuit({ topology: "series", voltage, bulbR }).totalCurrent.toFixed(2)} A and run at a quarter of the power — adding a parallel branch lowers R_eq and raises the demand on the supply.`
                : topology === "series"
                  ? `One loop, so the same ${c.totalCurrent.toFixed(2)} A passes through both bulbs, and they split the supply between them — ${c.bulbs[0].voltage.toFixed(1)} V each, giving a quarter of the power a single bulb would take. Rewire in parallel and the current rises to ${solveCircuit({ topology: "parallel", voltage, bulbR }).totalCurrent.toFixed(2)} A.`
                  : `A and B share their branch's ${c.branches[0].current.toFixed(2)} A between them, so each drops ${c.bulbs[0].voltage.toFixed(1)} V; C has the whole ${c.networkVoltage.toFixed(1)} V to itself and is correspondingly brighter. Reduce it in stages — series first, then parallel.`,
        noteTone: c.dead || shorted ? "bad" : unscrewed ? "warn" : "good",
      };

      legend = {
        title: "Circuit Key",
        items: [
          { color: "#38bdf8", label: "Drift electrons", note: "same spacing on every wire — only the SPEED tracks the current" },
          { color: "#c2703b", label: "Copper trace", note: `carrying up to ${c.totalCurrent.toFixed(2)} A` },
          { color: "#fbbf24", label: "Filament", note: c.allDark ? "cold — no bulb is lit" : `hotter with power: P = I²R` },
          { color: "#fb7185", label: "Short circuit", note: shorted ? `${c.shortCurrent.toFixed(1)} A bypassing the bulbs` : "not fitted" },
          { color: "#e8ebf0", label: "Junction rule", note: "current in = current out, at every node on the board" },
        ],
      };
      break;
    }

    case "static_electricity": {
      const target = params.target || "wall";
      const separation = num(params.separation, 0.12);
      const humidity = num(params.humidity, 40);
      // The live counts are drawn on the surfaces themselves, where they can
      // be counted. What belongs here is the model behind them — and the
      // clearest way to show an inverse square is the pair of figures for
      // this gap and for half of it.
      const full = solveStatic({ markers: MAX_MARKERS, domeMarkers: 45, separation, target, humidity });
      const half = solveStatic({ markers: MAX_MARKERS, domeMarkers: 45, separation: separation / 2, target, humidity });
      const tau = leakTimeConstant(humidity);
      const fmt = formatForce; // lib/electrostatics.js — the scene's own formatter

      readout = {
        title: "Static Electricity",
        subtitle: `balloon held near the ${full.spec.label.toLowerCase()}`,
        rows: [
          ["Gap r", `${(separation * 100).toFixed(1)} cm`, "gold"],
          ["Charge per marker", `${(CHARGE_PER_MARKER * 1e9).toFixed(0)} nC`],
          ["Balloon at full charge", `${MAX_MARKERS} markers · ${(chargeOf(MAX_MARKERS) * 1e9).toFixed(0)} nC`, "default", "wide"],
          ["Electrons that moved", electronCount(MAX_MARKERS).toExponential(2)],
          ["Left behind on the wool", `${MAX_MARKERS} unpaired +`, "warn"],
          [
            target === "wall" ? "Induced on the wall" : "On the other object",
            `${Math.round(full.otherMarkers)} markers`,
          ],
          // These figures are for a fully charged balloon (24 markers), so they
          // stay meaningful before the first rub; the scene's label is the live one.
          ["F at this gap, full charge", fmt(full.force), full.attracts ? "good" : "bad", "wide"],
          ["…as a multiple of its weight", `${full.forceInWeights.toFixed(1)}×`],
          ["F at half the gap", `${fmt(half.force)} — 4× larger`, "gold", "wide"],
          ["Direction", full.attracts ? "attraction" : "repulsion", full.attracts ? "good" : "bad"],
          ...(target === "wall"
            ? [["Sticks to the wall?", full.sticks ? "yes — friction holds it" : "no — it slides down", full.sticks ? "good" : "warn", "wide"]]
            : []),
          ["Air humidity", `${humidity.toFixed(0)}% RH`],
          ["Charge time constant", `${tau.toFixed(1)} s`, humidity > 70 ? "bad" : humidity > 45 ? "warn" : "good"],
          ["Half the charge gone in", `${(0.693 * tau).toFixed(1)} s`],
        ],
        note:
          target === "wall"
            ? `The wall has no charge of its own. The balloon's field pulls its electrons back and leaves the near surface positive, and because those induced positives are closer than the pushed-back negatives, the 1/r² law makes attraction win. That is why a charged object attracts anything neutral — whichever sign the charge is.`
            : target === "balloon"
              ? `Both balloons were rubbed on the same wool, so both carry the same sign and repel: F = k·q₁q₂/r² = ${fmt(full.force)} at ${(separation * 100).toFixed(1)} cm, which is ${full.forceInWeights.toFixed(0)} times the balloon's own weight. Halve the gap and it quadruples — that is what an inverse square feels like.`
              : `The dome and the balloon are both negative, so the dome pushes the balloon away hard. The dome reaches about ${(full.domeVolts / 1000).toFixed(0)} kV — a large voltage on a tiny charge, which is why it makes hair stand up but cannot deliver a dangerous current.`,
        noteTone: humidity > 75 ? "warn" : "good",
      };

      legend = {
        title: "Charge Key",
        items: [
          { color: "#38bdf8", label: "− electrons", note: "the only thing that actually moves" },
          { color: "#fb7185", label: "+ unpaired", note: "not added — simply left behind where an electron used to be" },
          { color: "#34d399", label: "Attraction", note: "charged to neutral, via induction — always" },
          { color: "#14b8a6", label: "Water in the air", note: `leaks the charge away with a ${tau.toFixed(0)} s time constant` },
          { color: "#e8ebf0", label: "Conservation", note: "the + count and the − count are always equal" },
        ],
      };
      break;
    }

    case "buoyancy": {
      const density = num(params.objectDensity, 2.7);
      const volume = num(params.objectVolume, 200);
      const fluidKey = params.fluid || "freshwater";
      const shape = params.solidShape || "cube";
      const b = solveBuoyancy({ density, volume, fluid: fluidKey, shape });

      // Which of the six it would float in. The single most useful thing the
      // panel can add to the tank, because the tank only ever shows one.
      const floatsIn = fluidComparison({ density, volume, shape })
        .filter((f) => f.floats)
        .map((f) => f.label);

      const hull = b.shape.envelope > 1;
      const isAir = b.fluid.density < 0.01;
      // Air's upthrust is a few pascals of pressure difference: kPa to three places prints them as 0.001.
      const fmtPressure = (pa) => (pa >= 100 ? `${(pa / 1000).toFixed(3)} kPa` : `${pa.toFixed(2)} Pa`);

      readout = {
        title: "Archimedes' Principle",
        subtitle: `${b.shape.label} of ${density.toFixed(2)} g/cm³ in ${b.fluid.label.toLowerCase()}`,
        rows: [
          ["Material volume V", `${volume.toFixed(0)} cm³`],
          ...(hull ? [["Hull envelope", `${b.metrics.envelopeCC.toFixed(0)} cm³ — ${b.shape.envelope}× the steel`, "gold"]] : []),
          ["Mass m = ρV", `${b.massG.toFixed(0)} g`],
          ["True weight W = mg", `${b.weight.toFixed(2)} N`, "gold"],
          ["Mean density m ÷ V_env", `${b.meanDensity.toFixed(3)} g/cm³`, b.floats ? "good" : "bad"],
          ["Fluid density ρ_f", `${b.fluidDensity} g/cm³`],
          ["Density ratio ρ_mean/ρ_f", b.densityRatio.toFixed(3), b.floats ? "good" : "bad"],
          ["Fluid displaced", `${b.overflowML.toFixed(0)} cm³ = ${b.displacedMassG < 10 ? b.displacedMassG.toFixed(2) : b.displacedMassG.toFixed(0)} g`],
          ["Buoyant force F_b = ρVg", formatNewtons(b.upthrust), "good"],
          ["…from the pressure difference", formatNewtons(b.pressureUpthrust)],
          ["Apparent weight", formatNewtons(b.apparentWeight), b.floats ? "good" : "default"],
          ["Weight apparently lost", `${(b.weightLostFraction * 100).toFixed(1)}%`],
          ["Resultant F_b − W", `${b.netForce < 0 ? "−" : ""}${formatNewtons(b.netForce)}`, Math.abs(b.netForce) < 0.005 ? "good" : b.netForce > 0 ? "good" : "bad"],
          ...(b.floats
            ? [
                ["Submerged", `${(b.submergedFraction * 100).toFixed(1)}% by volume`, "good"],
                ["Draft", `${b.draftCm.toFixed(2)} cm of ${b.metrics.height.toFixed(2)} cm`],
                ["Freeboard", `${b.freeboardCm.toFixed(2)} cm`, b.freeboardCm < 0.4 ? "warn" : "good"],
              ]
            : [
                ["Pressure on the top face", fmtPressure(b.pressureTop)],
                ["Pressure on the base", fmtPressure(b.pressureBottom)],
                ["Difference across it", fmtPressure(b.pressureDifference), "gold"],
                ["Released, it would accelerate", `${Math.abs(b.acceleration).toFixed(2)} m/s² ${b.acceleration > 0 ? "up" : "down"}`, "bad"],
              ]),
          ["Floats in", floatsIn.length ? floatsIn.join(", ") : "none of the six", floatsIn.length ? "good" : "bad"],
        ],
        note: isAir
          ? `Air is a fluid too, and this ${b.shape.label.toLowerCase()} pushes aside ${b.overflowML.toFixed(0)} cm³ of it — but that much air weighs only ${formatNewtons(b.upthrust)}, ${(b.weightLostFraction * 100).toFixed(2)}% of the ${formatNewtons(b.weight)} weight. That is why nobody notices it, and why weighing something in air is treated as weighing it in a vacuum. Switch to water and the same object suddenly loses ${(fluidComparison({ density, volume, shape }).find((f) => f.key === "freshwater").upthrust).toFixed(2)} N.`
          : b.swamped
          ? `The hull has gone under, and a swamped hull displaces only the steel it is made of — ${b.overflowML.toFixed(0)} cm³ instead of the ${b.metrics.envelopeCC.toFixed(0)} cm³ it displaced while it floated. That is why a breach is fatal so quickly: the buoyancy does not fall off gradually, it collapses to a ${b.shape.envelope}th as soon as the air is replaced by water.`
          : b.floats
            ? hull
              ? `The steel is still ${density.toFixed(2)} g/cm³ — nothing about the material changed. What changed is the volume it pushes aside: spread over the hull's ${b.metrics.envelopeCC.toFixed(0)} cm³ envelope the SAME ${b.massG.toFixed(0)} g comes out at ${b.meanDensity.toFixed(2)} g/cm³, below the fluid's ${b.fluidDensity}, so it floats with ${(b.freeboardCm).toFixed(1)} cm of freeboard. Switch the shape to a rock and watch the identical metal sink.`
              : `Floating, and it has sunk until it displaced exactly its own weight: ${b.overflowML.toFixed(0)} cm³ of ${b.fluid.label.toLowerCase()} weighs ${formatNewtons(b.upthrust)}, which is W to the last decimal. The fraction submerged is just ρ_object ÷ ρ_fluid = ${b.densityRatio.toFixed(2)}, so the string is slack and the scale reads nothing at all.`
            : `Sinking: at ${b.meanDensity.toFixed(2)} g/cm³ it cannot displace its own weight even fully under. The scale still reads ${formatNewtons(b.apparentWeight)} rather than ${formatNewtons(b.weight)}, and that missing ${formatNewtons(b.upthrust)} is exactly the weight of the ${b.overflowML.toFixed(0)} cm³ ${b.fluid.density < 0.01 ? "of air pushed aside" : "in the measuring cylinder"}. Lower it deeper and the reading will not budge — both faces gain pressure equally, and only the difference lifts.`,
        noteTone: isAir ? "warn" : b.swamped ? "bad" : b.floats ? "good" : "warn",
      };

      legend = {
        title: "Buoyancy Key",
        items: [
          { color: "#fb7185", label: "Weight W = mg", note: `${b.weight.toFixed(2)} N of material, always straight down` },
          { color: "#38bdf8", label: "Upthrust F_b = ρVg", note: `${formatNewtons(b.upthrust)} — the weight of the ${b.overflowML.toFixed(0)} cm³ ${b.fluid.density < 0.01 ? "of air pushed aside" : "in the cylinder"}` },
          { color: "#fbbf24", label: "Tension T", note: `${formatNewtons(b.apparentWeight)} — whatever the fluid did not carry` },
          { color: "#34d399", label: "Mean density", note: `${b.meanDensity.toFixed(2)} g/cm³ against the fluid's ${b.fluidDensity} — this decides it` },
          { color: FLUIDS[fluidKey]?.colour ?? "#38bdf8", label: b.fluid.label, note: b.fluid.title },
        ],
      };
      break;
    }

    case "heat_transfer": {
      const intensity = num(params.flameIntensity, 55);
      const material = params.rodMaterial || "copper";
      // No clock in the Details panel, so this describes where the apparatus
      // SETTLES rather than where it currently is — the scene shows it getting
      // there, and the note says which of the two is on screen.
      const h = solveHeatTransfer({ intensity, material });
      const probe = h.selected;
      const copper = h.rods.find((r) => r.key === "copper");
      const wood = h.rods.find((r) => r.key === "wood");

      readout = {
        title: "Conduction · Convection · Radiation",
        subtitle: h.lit ? `Bunsen at ${intensity.toFixed(0)}% — steady state` : "burner out — everything at room temperature",
        rows: [
          ["Flame temperature", h.lit ? `${h.flameC.toFixed(0)} °C` : "out", "gold"],
          ["Flame output", `${h.flamePower.toFixed(0)} W`],
          ["— CONDUCTION —", `${probe.spec.label}, k = ${probe.spec.k} W/m·K`, "gold"],
          ["Rod hot end (in the water)", `${probe.hotC.toFixed(1)} °C`],
          ["Rod tip, 20 cm away", `${probe.tipC.toFixed(1)} °C`, probe.tipC > 50 ? "good" : probe.tipC > 25 ? "warn" : "bad"],
          ["Decay length 1/m", `${(probe.decayLength * 100).toFixed(1)} cm`],
          ["Heat it carries", `${probe.rate.toFixed(2)} W`],
          ["Wax melted along it", `${(probe.waxFront * 100).toFixed(0)}% of the rod`, probe.waxFront > 0.5 ? "good" : "warn"],
          ["Copper tip vs wood tip", `${copper.tipC.toFixed(1)} °C vs ${wood.tipC.toFixed(1)} °C`, "gold"],
          ["— CONVECTION —", h.water.boiling ? "rolling boil" : "density current", "gold"],
          ["Water, bottom", `${h.water.bottom.toFixed(1)} °C`, "bad"],
          ["Water, top", `${h.water.top.toFixed(1)} °C`, "good"],
          ["Difference Δθ", `${h.water.delta.toFixed(2)} K`],
          ["Density, bottom vs top", `${h.water.densityBottom.toFixed(2)} vs ${h.water.densityTop.toFixed(2)} kg/m³`],
          ["Current speed", h.water.speed > 1e-6 ? `${(h.water.speed * 100).toFixed(2)} cm/s` : "still"],
          ["One circuit of the loop", Number.isFinite(h.water.loopSeconds) ? `${h.water.loopSeconds.toFixed(1)} s` : "—"],
          ["— RADIATION —", "no medium required", "gold"],
          ["Radiated by the flame", `${h.radiatedPower.toFixed(1)} W`],
          ["Reaching the plate", `${h.irradiance.toFixed(0)} W/m² at 15 cm`],
          ["Absorbed by the blackened plate", `${(h.absorbedPower * 1000).toFixed(0)} mW`],
          ["Blackened plate", `${h.plateC.toFixed(1)} °C`, h.plateC > 35 ? "warn" : "good"],
          ["Blackened plate, rise above room", `${(h.plateC - h.ambientC).toFixed(1)} K`, "gold"],
          ["Silvered plate (same size, same distance)", `${h.shinyC.toFixed(1)} °C`],
          ["Silvered plate, rise above room", `${(h.shinyC - h.ambientC).toFixed(2)} K`, "gold"],
          [
            "Absorbed: black vs silver",
            `${(h.absorbedPower * 1000).toFixed(0)} mW vs ${(h.shinyAbsorbedPower * 1000).toFixed(0)} mW`,
            "default",
            "wide",
          ],
        ],
        note: !h.lit
          ? "The burner is out, so all three transfers have nothing to move: the rods, the water and the plate are all at room temperature. Open the gas and watch which one responds first — the plate, at the speed of light, before the water has warmed at all."
          : h.water.boiling
            ? `At a rolling boil the water stops getting hotter however much more heat goes in — the energy is going into latent heat of vaporisation instead — so the top and bottom thermometers have converged. Conduction along the rods has therefore also topped out: the copper tip holds at ${copper.tipC.toFixed(0)} °C and the wood at ${wood.tipC.toFixed(0)} °C. Only radiation is still climbing, because it depends on the FLAME's temperature and not on the water's.`
            : `All three are running at once and each is doing something the others cannot. The rods carry ${probe.rate.toFixed(1)} W to a tip that nothing has travelled to — the metal has not moved. The water carries its heat by physically going there at ${(h.water.speed * 100).toFixed(1)} cm/s, driven by a density difference of ${Math.abs(h.water.densityDifference).toFixed(2)} kg/m³. And the plate, touching nothing and out of the path of the hot gases, is ${(h.plateC - h.ambientC).toFixed(1)} K above the room on ${(h.absorbedPower * 1000).toFixed(0)} mW of infrared that crossed the gap without warming the air on the way.`,
        noteTone: !h.lit ? "neutral" : h.water.boiling ? "warn" : "good",
      };

      legend = {
        title: "Heat Transfer Key",
        items: [
          {
            color: ROD_MATERIALS.copper.colour,
            label: "Conduction",
            note: `k = 385 vs wood's 0.15 — a factor of ${(ROD_MATERIALS.copper.k / ROD_MATERIALS.wood.k).toFixed(0)}, and no material moves`,
          },
          {
            color: "#c026d3",
            label: "Convection",
            note: `the dye IS the current — hot water rises because it is ${Math.abs(h.water.densityDifference).toFixed(1)} kg/m³ lighter`,
          },
          {
            color: "#fb923c",
            label: "Radiation",
            note: `${h.radiatedPower.toFixed(0)} W leaving the flame, spreading as 1/r² and needing no medium`,
          },
          {
            color: "#e6ebf2",
            label: "Silvered plate",
            note: `a shiny surface absorbs only ${(h.shinyAbsorbedPower / Math.max(h.absorbedPower, 1e-12) * 100).toFixed(0)}% of what the black one does, so it warms by only ${(h.shinyC - h.ambientC).toFixed(1)} K where the black one warms by ${(h.plateC - h.ambientC).toFixed(1)} K`,
          },
          {
            color: "#f5e6c8",
            label: "Wax beads",
            note: `let go at ${WAX_MELTING_C} °C — four rods, one race, run side by side`,
          },
          {
            color: "#e8ebf0",
            label: `${TIME_LAPSE}× time lapse`,
            note: "every rate scaled by the same factor, so the ratios are the real ones",
          },
        ],
      };
      break;
    }

    // ═════════════════════════════════════════════════════════════════════
    // 2. CHEMISTRY
    // ═════════════════════════════════════════════════════════════════════

    case "bohr": {
      const a = describeAtom(params.element || "Na");

      readout = {
        title: `${a.name} atom (${a.symbol})`,
        subtitle: `Shell configuration: ${a.configuration}`,
        rows: [
          ["Protons (Z)", a.protons, "gold"],
          ["Neutrons", a.neutrons],
          ["Mass number (A)", a.massNumber],
          ["Electrons", a.electrons],
          ["Configuration", a.shells.join(", "), "gold"],
          ["Valence electrons", `${a.valence} of ${a.capacity} in the ${a.shellName} shell`, a.full ? "good" : "warn"],
          ["Group / Period", `${a.group} / ${a.period}`],
        ],
        // One branch per element, from the shared table — the old ternary had
        // branches for Na and Cl only and printed the carbon note for hydrogen.
        note: `Atoms react to achieve a full outer shell. ${a.reaction}`,
        noteTone: "good",
      };

      legend = {
        title: "Subatomic particle key",
        items: [
          { color: ATOM_COLOURS.proton, shape: "dot", label: "Proton (+1)", note: `${a.protons} in the nucleus` },
          { color: ATOM_COLOURS.neutron, shape: "dot", label: "Neutron (0)", note: `${a.neutrons} in the nucleus` },
          { color: ATOM_COLOURS.electron, shape: "dot", label: "Inner-shell electron", note: "a filled, unreactive shell" },
          {
            // Valence electrons are only drawn gold while the toggle is on.
            color: params.highlightValence ? ATOM_COLOURS.valence : ATOM_COLOURS.electron,
            shape: "dot",
            label: "Valence electron",
            note: params.highlightValence
              ? "the outer shell — where all the chemistry happens"
              : "turn on “Highlight valence shell” to pick these out",
          },
        ],
      };
      break;
    }

    case "organic": {
      // One description, shared with the scene. The panel used to fall through
      // to the alkane formula for acids and esters (propanoic acid printed as
      // "C3H8") and to decide saturation with `family === "alkane"`, which
      // reported ethanol as unsaturated and as decolourising bromine water.
      const m = describeMolecule(params.family || "alkane", num(params.carbons, 3));

      readout = {
        title: `${m.label} series`,
        subtitle: m.valid ? `${m.name} · ${m.formula}` : `needs ${m.minCarbons}+ carbons`,
        rows: [
          ["Formula", m.formula, "gold"],
          ["Name", m.valid ? m.name : "—", m.valid ? undefined : "bad"],
          ["General formula", m.general],
          ["Carbon chain length", `C${m.carbons}`],
          ["Saturated", m.saturated ? "yes — only single C–C bonds" : `no — it has a ${m.unsaturation}`, m.saturated ? "good" : "warn"],
          ["Bromine water", m.decolourisesBromine ? "decolourised — orange to clear" : "stays orange — no reaction", m.decolourisesBromine ? "good" : undefined],
          ...(m.functionalGroup ? [["Functional group", m.functionalGroup]] : []),
          ...(m.crackable ? [["Cracking", "long enough to break in two", "gold"]] : []),
        ],
        note: m.valid
          ? m.note
          : `${m.label}s need at least ${m.minCarbons} carbons — there is no such thing as a one-carbon ${m.label.toLowerCase()}. Increase the chain length.`,
        noteTone: m.valid ? "neutral" : "bad",
      };

      legend = {
        title: "Ball and stick key",
        items: [
          { color: ORGANIC_COLOURS.carbon, shape: "dot", label: "Carbon atom (C)", note: "always forms four bonds" },
          { color: ORGANIC_COLOURS.hydrogen, shape: "dot", label: "Hydrogen atom (H)", note: "always forms one" },
          { color: ORGANIC_COLOURS.oxygen, shape: "dot", label: "Oxygen atom (O)", note: "two bonds — in –OH, C=O and –COO–" },
          // Colours the scene actually draws with: single bonds are the dark
          // grey, and it is the DOUBLE bond that is gold. The old key had these
          // the other way round.
          { color: ORGANIC_COLOURS.single, shape: "line", label: "Single C–C bond", note: "one shared pair — saturated" },
          ...(m.unsaturation === "C=C"
            ? [{ color: ORGANIC_COLOURS.double, shape: "line", label: "C=C double bond", note: "two shared pairs — the reactive site" }]
            : m.unsaturation === "C≡C"
              ? [{ color: ORGANIC_COLOURS.triple, shape: "line", label: "C≡C triple bond", note: "three shared pairs — very reactive, sp linear" }]
              : []),
        ],
      };
      break;
    }

    case "distillation": {
      const col = solveColumn(num(params.heat, 0.7));

      readout = {
        title: "Fractionating column",
        subtitle: "A physical separation, not a reaction",
        rows: [
          ["Furnace", `${col.furnaceC} °C`, "gold"],
          ["Top of the column", `~${col.topC} °C`],
          ["Separated by", "boiling point"],
          ["Fractions vaporised", `${col.rising} of ${col.total}`, col.rising > 3 ? "good" : "warn"],
          ["Highest riser", col.highest ? col.highest.name : "nothing — the furnace is cold", col.highest ? undefined : "bad"],
          ["Left at the base", col.residue ? `${col.residue.name} — it never boils` : "—"],
        ],
        note: col.tooCool
          ? `At ${col.furnaceC} °C the furnace is too cool for most of the crude oil to vaporise, so the heavier fractions never leave the base. Turn the heat up.`
          : "Short chains have weaker forces between their molecules, so they boil at low temperatures and climb highest before condensing. Long chains condense low down; bitumen never boils at all, whatever the furnace does.",
        noteTone: col.tooCool ? "warn" : "good",
      };

      legend = {
        title: "Fractions, top to bottom",
        // One table, shared with the scene. The panel used to carry its own
        // with different boiling points, different chain ranges and colours
        // that matched nothing in the viewport.
        items: col.fractions.map((f) => ({
          color: f.colour,
          shape: "square",
          label: `${f.name} (${f.chain})`,
          note: f.residue
            ? `never vaporises — drained off at the base · ${f.use}`
            : f.rises
              ? `≤${f.top} °C · ${f.use}`
              : `needs more heat than ${col.furnaceC} °C`,
        })),
      };
      break;
    }

    case "lattice": {
      const structure = params.structure || "nacl";
      const facts = latticeFactsFor(structure);

      readout = {
        title: facts.title,
        subtitle: facts.type,
        rows: facts.rows,
        note: facts.note,
        noteTone: "good",
      };

      legend = {
        title: "Lattice component key",
        // Shared with the scene. The graphite key used to name a gold
        // "Delocalised Electron" and a dashed "Interlayer Force"; the scene
        // draws neither, and the gold is actually the middle layer's carbons.
        items: latticeKeyFor(structure),
      };
      break;
    }

    case "electrolysis": {
      // The scene pushes its run clock into params; the numbers below are
      // Faraday's laws applied to it. The panel used to print
      // `Math.round(current * 14)` labelled "Cu atoms" — not atoms, not
      // tracking the cell, and constant for the whole run.
      const run = Boolean(params.run);
      const cell = solveElectrolysis({
        current: num(params.current, 1.0),
        seconds: num(params.liveSeconds, 0),
        running: run,
        electrode: params.electrode ?? "copper",
      });

      readout = {
        title: "Electrolysis of aqueous CuSO₄",
        subtitle: `${cell.material.label} electrodes · OIL RIG`,
        rows: [
          ["Electrodes", cell.material.label, cell.inert ? "sky" : "gold"],
          ["Supply", run ? `${cell.current.toFixed(1)} A` : "off", run ? "gold" : "bad"],
          ["Run time", formatRunTime(cell.seconds)],
          ["Charge passed", `${cell.chargeC.toFixed(0)} C · Q = It`, "gold"],
          ["Electrons", `${(cell.electronsMol * 1000).toFixed(2)} mmol · Q ÷ F`],
          ["Copper deposited", `${cell.depositMg.toFixed(1)} mg at the cathode`, cell.depositMg > 0 ? "good" : undefined],
          // The one row that differs: a copper anode loses exactly what the
          // cathode gains; an inert one loses nothing and gives off oxygen.
          cell.inert
            ? ["Anode loss", "none — graphite is inert", "good"]
            : ["Copper dissolved", `${cell.depositMg.toFixed(1)} mg from the anode`, cell.depositMg > 0 ? "bad" : undefined],
          ["Cathode (−)", `reduction · ${cell.cathode}`, "good"],
          ["Anode (+)", `oxidation · ${cell.anode}`, "bad"],
          ["Overall", cell.overall, "gold"],
          cell.inert
            ? [
                "Electrolyte concentration",
                cell.depleted
                  ? `exhausted — every Cu²⁺ has plated out; what is left is H₂SO₄`
                  : `${cell.remainingMolarity.toFixed(3)} mol/dm³ of ${ELECTROLYTE.molarity.toFixed(2)} — ${((1 - cell.blueFraction) * 100).toFixed(1)} % of the Cu²⁺ used, and the blue with it`,
                cell.depleted ? "bad" : "warn",
              ]
            : ["Electrolyte concentration", "unchanged — as much Cu²⁺ made as used", "good"],
          cell.inert
            ? ["Gas given off", `oxygen at the anode · ${formatGasVolume(cell.oxygenCm3)} at RTP`, "sky"]
            : ["Gas given off", "none — both electrodes are copper", "good"],
          ["Charge carried by", "ions in the solution, electrons in the wire"],
        ],
        note: !run
          ? "The supply is off, so nothing migrates. Electrolysis needs both a potential difference and ions that are free to move — molten or in solution."
          : cell.inert
            ? `Graphite cannot dissolve, so the anode has to oxidise something else — and it oxidises water: ${cell.anode}. Copper still plates onto the cathode (${cell.depositMg.toFixed(1)} mg so far), but nothing replaces the Cu²⁺ it takes out, so the concentration has fallen from ${ELECTROLYTE.molarity.toFixed(2)} to ${cell.remainingMolarity.toFixed(3)} mol/dm³ in this ${ELECTROLYTE.volumeCm3} cm³ cell, the blue drains away and what is left is sulfuric acid. ${formatGasVolume(cell.oxygenCm3)} of oxygen has come off, and the four electrons per O₂ against two per Cu is why there is exactly half as much gas as there is copper.`
            : `Copper leaves the anode, crosses the solution as Cu²⁺ and plates onto the cathode, so the anode thins by exactly what the cathode gains — ${cell.depositMg.toFixed(1)} mg so far. Because the two happen at the same rate the solution never changes colour, and because both electrodes are copper neither gives off a gas. That is electroplating, and it is how copper is purified. Switch to graphite and the anode reaction changes completely.`,
        noteTone: run ? (cell.inert ? "sky" : "good") : "bad",
      };

      legend = {
        title: "Electrochemistry key",
        items: [
          { color: CELL_COLOURS.cation, shape: "dot", label: "Cu²⁺ cation (hydrated)", note: "positive → travels to the negative cathode" },
          { color: CELL_COLOURS.sulfur, shape: "dot", label: "SO₄²⁻ anion (tetrahedral)", note: "negative → travels to the positive anode, but never discharges" },
          { color: CELL_COLOURS.electron, shape: "dot", label: "Electron", note: "only ever in the wire — never through the solution" },
          // The cathode is copper either way -- it is copper the moment the
          // first Cu²⁺ discharges on it. The key used to show a green cathode
          // and a red anode, neither of which the scene drew.
          { color: CELL_COLOURS.cathode, shape: "square", label: "Cathode (−)", note: "thickens as copper plates onto it" },
          cell.inert
            ? { color: CELL_COLOURS.graphite, shape: "square", label: "Anode (+)", note: "graphite — inert, so it is not consumed" }
            : { color: CELL_COLOURS.anode, shape: "square", label: "Anode (+)", note: "copper — thins as it dissolves" },
          ...(cell.inert
            ? [{ color: CELL_COLOURS.bubble, shape: "dot", label: "Oxygen bubble", note: "from the water: 2H₂O → O₂ + 4H⁺ + 4e⁻" }]
            : []),
        ],
      };
      break;
    }

    case "vsepr": {
      // One solver, shared with the scene. The panel used to look the shape up
      // in a table that stopped at 6-0 and report a flat `lone × 2.5°` squeeze,
      // so AX₄E₂ read "Octahedral · 5.0° squeeze" against a scene correctly
      // drawing a square planar molecule at 90°.
      const v = solveVsepr(num(params.bonding, 4), num(params.lone, 0), params.preset);

      readout = {
        title: "VSEPR molecular geometry",
        subtitle: `${v.notation} · steric number ${v.steric}`,
        rows: [
          ["Bonding pairs (X)", v.bonding, "gold"],
          ["Lone pairs (E)", v.lone, v.lone > 0 ? "warn" : "good"],
          ["Steric number", v.steric],
          ["Electron geometry", v.electronGeometry],
          ["Molecular shape", v.shape, "gold"],
          [v.molecule ? "Molecule" : "Example", v.molecule ? `${v.molecule.label} · ${v.molecule.name}` : v.example],
          ["Ideal angle", v.hasAngle ? v.idealLabel : "— (diatomic)"],
          [
            v.angles.length > 1 ? "Measured angles" : "Measured angle",
            v.hasAngle ? v.angles.map((a) => `${a.toFixed(1)}°`).join(" · ") : "—",
            v.lone > 0 ? "warn" : "good",
          ],
          [
            "Angle compression",
            !v.hasAngle
              ? "—"
              : v.compression < 0.05
                ? v.lone > 0
                  ? "none — the lone pairs cancel"
                  : "none — ideal angles"
                : `${v.compression.toFixed(1)}° closed by ${v.lone} lone pair${v.lone === 1 ? "" : "s"}`,
            v.compression >= 0.05 ? "warn" : "good",
          ],
          ["Polarity", v.polar ? "polar" : "non-polar", v.polar ? "warn" : "good"],
        ],
        note: !v.hasAngle
          ? "With a single bond there is no angle to compress — any diatomic is linear whatever its lone pairs do. Add a second bonding pair to see VSEPR bite."
          : v.lone === 0
            ? "With no lone pairs the electron geometry and the molecular shape are the same thing, and the bond angles sit at their ideal values."
            : v.cancels
              ? `The ${v.lone} lone pairs sit opposite each other, so their repulsions cancel and the bond angles stay at the ideal ${v.ideal}°. This is why XeF₄ is a flat square rather than a squashed one.`
              : `Lone pairs repel more strongly than bonding pairs, so the ${v.bonding} bonds are squeezed from ${v.ideal}° down to about ${v.angle.toFixed(1)}°. You only name the shape from where the atoms are — the lone pairs are invisible in the name.`,
        noteTone: !v.hasAngle ? "neutral" : v.lone > 0 ? "warn" : "good",
      };

      legend = {
        title: "Electron domains key",
        items: [
          // A real molecule is drawn in its elements' colours, a bare AXₙEₘ in gold and sky.
          v.molecule
            ? { color: ELEMENT_STYLE[v.molecule.centre].colour, shape: "dot", label: `${v.molecule.centre} · central atom`, note: "counts its own valence electrons" }
            : { color: PALETTE.gold, shape: "dot", label: "Central atom", note: "counts its own valence electrons" },
          v.molecule
            ? { color: ELEMENT_STYLE[v.molecule.ligand].colour, shape: "dot", label: `${v.molecule.ligand} · bonded atom`, note: "one bonding domain each" }
            : { color: PALETTE.sky, shape: "dot", label: "Bonded atom", note: "one bonding pair each" },
          { color: PALETTE.violet, shape: "dot", label: "Lone pair", note: "repels harder — closes the angles" },
          { color: VSEPR_BOND_COLOUR, shape: "line", label: "Bond", note: "a shared pair of electrons" },
        ],
      };
      break;
    }

    case "energetics": {
      // Shared solver. The panel was missing the rate constant and the
      // catalyst speed-up — the two numbers that turn a Boltzmann fraction
      // into an answer to "does this reaction actually go?" — and it never
      // mentioned that ΔH can force Ea above the value the slider asked for.
      const e = solveEnergetics({
        activation: num(params.activation, 90),
        deltaH: num(params.deltaH, -60),
        catalyst: Boolean(params.catalyst),
        catalystDrop: num(params.catalystDrop, 35),
        temperature: num(params.temperature, 350),
      });
      const signed = (v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}`;

      readout = {
        title: "Reaction energetics & catalysis",
        subtitle: e.exothermic ? "Exothermic · ΔH < 0, energy released" : "Endothermic · ΔH > 0, energy absorbed",
        rows: [
          ["Forward activation Ea", `${e.effectiveEa.toFixed(0)} kJ/mol`, e.catalyst ? "good" : "gold"],
          ["…uncatalysed", `${e.uncatalysed.toFixed(0)} kJ/mol`],
          ["Reverse activation", `${e.reverseEa.toFixed(0)} kJ/mol`],
          ["Enthalpy change ΔH", `${signed(e.deltaH)} kJ/mol`, e.exothermic ? "good" : "warn"],
          ["Temperature", `${e.temperature.toFixed(0)} K (${(e.temperature - 273).toFixed(0)} °C)`],
          ["Collision fraction ≥ Ea", e.fraction.toExponential(1)],
          ["Rate constant k", `${e.rateConstant.toExponential(1)} s⁻¹`, e.proceeds ? "good" : "bad"],
          ["Does it go?", e.proceeds ? "yes — at a measurable rate" : "no — far too slow to see", e.proceeds ? "good" : "bad"],
          ["Catalyst", e.catalyst ? `lowers the barrier by ${e.lowering.toFixed(0)} kJ/mol` : "none", e.catalyst ? "good" : undefined],
          ["Rate ×", e.catalyst ? e.speedUp.toExponential(1) : "1", e.catalyst ? "good" : undefined],
        ],
        note: e.clampedByDeltaH
          ? `An endothermic reaction cannot have a forward barrier below ΔH — the products would sit above the transition state. Ea is held at ${e.effectiveEa.toFixed(0)} kJ/mol, just clear of ΔH, rather than the ${e.activation.toFixed(0)} the slider asks for.`
          : e.catalyst
            ? `The catalyst offers a different route with a lower barrier, so ${e.speedUp.toExponential(1)}× as many collisions succeed at this temperature. Note ΔH has not moved — a catalyst changes the rate, never the energy released.`
            : !e.proceeds
              ? `At ${e.temperature.toFixed(0)} K almost no collision carries ${e.effectiveEa.toFixed(0)} kJ/mol, so k is only ${e.rateConstant.toExponential(1)} s⁻¹ and nothing gets over the barrier. Raise the temperature or add a catalyst.`
              : e.exothermic
                ? "The products sit below the reactants, so bond making released more energy than bond breaking absorbed. ΔH is negative and the surroundings warm up."
                : "The products sit above the reactants: breaking bonds cost more than making them returned. ΔH is positive and the surroundings cool.",
        noteTone: e.clampedByDeltaH ? "warn" : !e.proceeds ? "bad" : e.catalyst || e.exothermic ? "good" : "warn",
      };

      legend = {
        title: "Energy profile key",
        items: [
          { color: e.catalyst ? PALETTE.emerald : PALETTE.gold, shape: "line", label: "Reaction path", note: "potential energy along the reaction coordinate" },
          ...(e.catalyst ? [{ color: PALETTE.slate, shape: "dash", label: "Uncatalysed", note: "the barrier without the catalyst" }] : []),
          { color: PALETTE.rose, shape: "line", label: "Ea", note: "reactants → transition state" },
          { color: e.exothermic ? PALETTE.emerald : PALETTE.violet, shape: "line", label: "ΔH", note: "reactants → products" },
        ],
      };
      break;
    }

    case "reactivity_series": {
      const metal = METALS[params.metal] ? params.metal : "Zn";
      const solutionKey = SOLUTIONS[params.solution] ? params.solution : "cuso4";
      const timeLapse = num(params.timeLapse, 10);
      // The scene owns the clock and pushes it here; before the first push
      // (or while the arm is still travelling) there is simply no time yet.
      const seconds = num(params.liveSeconds, 0);
      const dipped = params.liveDipped !== false;
      const M = METALS[metal];
      const r = solveDisplacement({ metal, solution: solutionKey, seconds });
      const rack = SOLUTION_ORDER.map((key) => solveDisplacement({ metal, solution: key, seconds }));
      const displaced = rack.filter((x) => x.reason === "displaces");
      const N = METALS[r.ionMetal];

      readout = {
        title: "Reactivity Series & Displacement",
        subtitle: `${M.label} in ${SOLUTIONS[solutionKey].label} · ${timeLapse}× time-lapse`,
        rows: [
          ["Strip", `${M.label} · rank ${seriesRank(metal) + 1} of ${SERIES.length}`, "gold"],
          ["Electrode potential E°", `${M.potential > 0 ? "+" : ""}${M.potential.toFixed(2)} V`],
          ["Solution", `${SOLUTIONS[solutionKey].label} · ${ionSymbol(N.symbol, N.charge)}`],
          ["Time in the liquid", dipped ? formatModelTime(seconds) : "arm travelling", dipped ? undefined : "warn"],
          ["Verdict", r.reacts ? (r.reason === "reacts_with_water" ? "attacks the water" : "displaces") : "no reaction", r.reacts ? "good" : "bad"],
          ["Cell voltage E°cell", r.reacts ? `${r.ecell.toFixed(2)} V` : "—", r.reacts ? "gold" : undefined],
          ["— HALF-EQUATIONS —", r.reacts ? "OIL RIG" : "nothing to write", "gold"],
          ["Oxidation (loses e⁻)", r.oxidation, r.reacts ? "bad" : undefined],
          ["Reduction (gains e⁻)", r.reduction, r.reacts ? "good" : undefined],
          ["Ionic equation", r.ionic],
          ["Full equation", r.molecular ?? "no reaction"],
          ["— THIS BEAKER —", `${(r.progress * 100).toFixed(0)}% of the way`, "gold"],
          ["Solution colour", r.reason === "displaces" ? `${SOLUTION_TINT[r.ionMetal]} → ${SOLUTION_TINT[metal] ?? "colourless"}` : `${SOLUTION_TINT[r.ionMetal]} — unchanged`],
          [`${N.label} deposited`, r.depositG > 0 ? `${r.depositG.toFixed(3)} g` : "—", r.depositG > 0 ? "good" : undefined],
          ["Ions left in solution", `${(r.ionsRemainingMol * 1000).toFixed(2)} mmol of ${(SOLUTION_MOL * 1000).toFixed(0)}`],
          ["Strip mass lost", r.metalLostG > 0 ? `${r.metalLostG.toFixed(3)} g of ${STRIP_MASS_G.toFixed(1)} g` : "—", r.metalLostG > 0 ? "warn" : undefined],
          ["Electrons transferred", r.electronsMol > 0 ? `${(r.electronsMol * 1000).toFixed(2)} mmol` : "—"],
          ["Hydrogen given off", r.hydrogenCm3 > 0 ? `${r.hydrogenCm3.toFixed(1)} cm³` : "none"],
          ["— ACROSS THE RACK —", `${displaced.length} of 4 react`, "gold"],
          ...rack.map((x) => [SOLUTIONS[x.solution].short, x.reacts ? (x.reason === "reacts_with_water" ? "water first" : `${(x.progress * 100).toFixed(0)}% displaced`) : "no reaction", x.reacts ? (x.reason === "reacts_with_water" ? "warn" : "good") : "bad"]),
        ],
        note: describeOutcome(r) + (r.reacts && r.reason === "displaces"
          ? ` The strip is the anode and the cathode at once: ${M.symbol} atoms give up electrons at one patch of the surface, those electrons cross the metal — never the solution — and reduce ${ionSymbol(N.symbol, N.charge)} at another, where the ${N.label.toLowerCase()} plates out. E°cell of ${r.ecell.toFixed(2)} V is the size of that pull, and it is why this beaker takes ${formatModelTime(r.tau)} to get 63% of the way while ${displaced.length > 1 ? "the others take their own time" : "nothing else on the rack moves at all"}.`
          : ""),
        noteTone: r.reason === "displaces" ? "good" : r.reason === "reacts_with_water" ? "warn" : "bad",
      };

      legend = {
        title: "Displacement Key",
        items: [
          { color: M.colour, shape: "square", label: `${M.label} strip`, note: `E° = ${M.potential > 0 ? "+" : ""}${M.potential.toFixed(2)} V — the same metal in all four beakers` },
          { color: ION_APPEARANCE.Cu.colour, shape: "dot", label: "Cu²⁺(aq)", note: "the blue that fades as copper plates out" },
          { color: ION_APPEARANCE.Fe.colour, shape: "dot", label: "Fe²⁺(aq)", note: "pale green — appears when iron dissolves" },
          { color: METALS[r.ionMetal].deposit, shape: "square", label: `${METALS[r.ionMetal].label} deposit`, note: "grows on the dipped part of the strip" },
          { color: "#e8ebf0", shape: "dot", label: "Electron", note: "travels inside the metal only — ions carry the charge in solution" },
          { color: "#c084fc", shape: "dot", label: "Hydrogen fizz", note: "a metal above magnesium reducing the water itself" },
        ],
      };
      break;
    }

    case "rusting_galvanic": {
      // The rack's own clock when it has one, the slider otherwise. See B39.
      const days = num(params.liveDays, num(params.days, 7));
      const electrolyteKey = ELECTROLYTES[params.electrolyte] ? params.electrolyte : "distilled";
      const partnerKey = PARTNERS[params.partner] ? params.partner : "zinc";
      const r = solveRusting({ days, electrolyte: electrolyteKey, partner: partnerKey });
      const [open, deox, dry, coupled] = r.tubes;
      const couple = r.couple;
      const P = couple.partner;
      const saved = open.ironLostMg - coupled.ironLostMg;

      readout = {
        title: "Rusting & Sacrificial Protection",
        subtitle: `day ${Math.round(days)} of 30 · ${r.electrolyte.label}`,
        rows: [
          ["Electrolyte", `${r.electrolyte.label} · ${r.electrolyte.conductivity}`, electrolyteKey === "saltwater" ? "bad" : undefined],
          ["Rate against pure water", `${r.electrolyte.factor.toFixed(1)}×`, electrolyteKey === "saltwater" ? "warn" : "good"],
          ["— TUBE 1 · water + air —", "the control", "gold"],
          ["Rust thickness", `${open.rustThicknessUm.toFixed(1)} µm`, "bad"],
          ["Surface covered", `${(open.coverage * 100).toFixed(0)}%`, "bad"],
          ["Iron lost", `${open.ironLostMg.toFixed(1)} mg of ${(NAIL_MASS_G * 1000).toFixed(0)} mg`],
          ["Rust formed", `${open.rustFormedMg.toFixed(1)} mg`],
          ["— TUBE 2 · no oxygen —", "boiled, under oil", "gold"],
          ["Rust thickness", `${deox.rustThicknessUm.toFixed(1)} µm — none`, "good"],
          ["— TUBE 3 · no water —", "desiccant, stoppered", "gold"],
          ["Rust thickness", `${dry.rustThicknessUm.toFixed(1)} µm — none`, "good"],
          ["— TUBE 4 · coupled —", `nail + ${P.label.toLowerCase()}`, "gold"],
          ["Anode (oxidised)", couple.anode, couple.protects ? "good" : "bad"],
          ["Cathode (protected)", couple.cathode, couple.protects ? "good" : "bad"],
          ["Driving voltage ΔE°", `${couple.deltaE.toFixed(2)} V`],
          ["Electron flow", couple.direction === "none" ? `none — ${P.label.toLowerCase()} used up` : couple.direction === "partner_to_iron" ? `${P.symbol} → Fe` : `Fe → ${P.symbol}`, couple.protects && couple.direction !== "none" ? "good" : "bad"],
          ["Nail rust thickness", `${coupled.rustThicknessUm.toFixed(2)} µm`, couple.protects ? "good" : "bad"],
          ["Nail iron lost", `${coupled.ironLostMg.toFixed(2)} mg`, couple.protects ? "good" : "bad"],
          ["Against the bare nail", `${saved >= 0 ? "saved" : "cost"} ${Math.abs(saved).toFixed(1)} mg`, saved >= 0 ? "good" : "bad"],
          [`${P.label} mass lost`, couple.protects ? `${couple.partnerLostMg.toFixed(0)} mg of ${(P.wrapMassG * 1000).toFixed(0)} mg` : "none — it is the cathode", couple.protects ? "warn" : undefined],
          [`${P.label} left`, couple.protects ? `${(couple.partnerRemainingFraction * 100).toFixed(0)}%` : "100%", couple.partnerExhausted ? "bad" : couple.protects ? "warn" : undefined],
          ["— EQUATIONS —", "OIL RIG at two sites", "gold"],
          ["Anode half-equation", couple.oxidation, "bad"],
          ["Cathode half-equation", couple.reduction, "good"],
          ["Overall", RUST_EQUATIONS.overall],
        ],
        note: couple.partnerExhausted
          ? `The ${P.label.toLowerCase()} has been completely consumed, and from this point the nail is on its own — sacrificial protection lasts exactly as long as the anode does. That is why a ship's hull carries anodes that are inspected and replaced, rather than a coating that is meant to last forever.`
          : couple.protects
            ? `Tubes 2 and 3 have no rust at all, which settles the first question: iron needs BOTH water and oxygen, and removing either one is enough. Tube 4 answers the second. ${P.label} (E° = ${P.potential.toFixed(2)} V) gives up electrons more readily than iron (−0.44 V), so it is the anode and corrodes at ${couple.partnerLostMg.toFixed(0)} mg while the nail — now a cathode fed with electrons — has lost only ${coupled.ironLostMg.toFixed(2)} mg against the bare nail's ${open.ironLostMg.toFixed(1)} mg.`
            : `Copper is BELOW iron in the series, so wrapping the nail in it reverses the protection: the iron is the more reactive of the pair and becomes the anode for both. It has lost ${coupled.ironLostMg.toFixed(0)} mg against the bare nail's ${open.ironLostMg.toFixed(0)} mg — ${(coupled.ironLostMg / Math.max(open.ironLostMg, 1e-9)).toFixed(1)}× worse — because the copper gives the corrosion cell a large extra cathode to reduce oxygen on.`,
        noteTone: couple.partnerExhausted ? "warn" : couple.protects ? "good" : "bad",
      };

      legend = {
        title: "Corrosion Key",
        items: [
          { color: "#c2410c", shape: "square", label: "Rust · Fe₂O₃·xH₂O", note: "hydrated iron(III) oxide — flaky, so it never protects the metal underneath" },
          { color: "#f4d35e", shape: "square", label: "Paraffin oil", note: "seals tube 2 — boiled water plus no air means no dissolved O₂" },
          { color: "#eef2f6", shape: "dot", label: "Desiccant", note: "anhydrous CaCl₂ keeps tube 3 dry, so there is oxygen but no water" },
          { color: P.colour, shape: "square", label: `${P.label} wrap`, note: P.protects ? `E° = ${P.potential.toFixed(2)} V — more reactive than iron, so it corrodes instead` : `E° = +${P.potential.toFixed(2)} V — less reactive, so the NAIL corrodes for it` },
          { color: couple.protects ? "#34d399" : "#fb7185", shape: "line", label: "Electron flow", note: couple.direction === "partner_to_iron" ? `${P.symbol} → Fe, which is what keeps the iron from being oxidised` : `Fe → ${P.symbol}, which is what destroys the nail` },
          { color: "#8e97a6", shape: "square", label: "Bright iron", note: "unoxidised mild steel — what tubes 2 and 3 still look like at day 30" },
        ],
      };
      break;
    }

    case "separation_techniques": {
      const stationKey = STATIONS[params.station] ? params.station : "filtration";
      const mixKey = MIXTURES[params.mixture] ? params.mixture : "sand_salt";
      const solKey = SOLVENTS[params.solvent] ? params.solvent : "water";
      const seconds = num(params.liveSeconds, 0);
      const M = MIXTURES[mixKey];
      const S = SOLVENTS[solKey];
      const args = { mixture: mixKey, solvent: solKey, seconds };
      const pct = (v) => `${(v * 100).toFixed(0)}%`;

      if (stationKey === "filtration") {
        const r = solveFiltration(args);
        readout = {
          title: "Gravity filtration",
          subtitle: `${M.label} · ${S.label} · ${formatSeconds(seconds)} at ${r.timeLapse}×`,
          rows: [
            ["Property used", "particle size — and whether it dissolved", "gold"],
            ["Filter paper pores", `${FILTER_PORE_UM} µm`],
            ["Poured in", `${(r.pouredFraction * SAMPLE_VOLUME_ML).toFixed(0)} of ${SAMPLE_VOLUME_ML} mL`],
            ["Filtrate collected", `${r.filtrateMl.toFixed(1)} mL`, r.filtrateMl > 0 ? "good" : undefined],
            ["Residue on the paper", r.residueG > 0.01 ? `${r.residueNowG.toFixed(2)} g of ${r.residueG.toFixed(1)} g` : "none", r.residueG > 0.01 ? "warn" : undefined],
            ["Flow time constant", `${r.tau.toFixed(0)} s${r.residueG > 0.01 ? " — the cake slows it" : ""}`],
            ["— EACH COMPONENT —", r.separates ? "separated" : "not separated", r.separates ? "good" : "bad"],
            ...r.components.map((c) => [`${c.label} (${c.formula})`, `${c.retained ? "RESIDUE" : "filtrate"} · ${c.reason}`, c.retained ? "warn" : "good"]),
            ["Filtrate looks", r.nothingPassed ? `clear ${S.label.toLowerCase()}` : r.components.some((c) => c.passedG > 0 && COMPONENTS[c.key].tint) ? "coloured — the solute went through" : "colourless — dissolved salt is invisible"],
            ["Verdict", r.verdict, r.fines ? "warn" : r.verdict.startsWith("separates") ? "good" : "bad"],
          ],
          note: r.separates
            ? `The paper is a sieve with ${FILTER_PORE_UM} µm holes. ${r.components.filter((c) => c.retained).map((c) => c.label).join(" and ")} is held back because it never dissolved and its grains are far larger than a pore; ${r.components.filter((c) => !c.retained).map((c) => c.label.toLowerCase()).join(" and ")} is present as ions or molecules under a nanometre across and passes with the solvent. Filtration separates a solid from a liquid — nothing more.`
            : r.nothingRetained
              ? `Everything in this sample is dissolved in ${S.label.toLowerCase()}, so there is no particle for the paper to catch: the whole sample runs through and the filtrate is the same ${M.label.toLowerCase()} you poured in. To take the solute out of a solution you need crystallisation, not filtration.`
              : r.components.filter((c) => c.retained).every((c) => COMPONENTS[c.key].kind === "solid")
                ? `${r.components.map((c) => c.label).join(" and ")} never dissolves — it is suspended in the ${S.label.toLowerCase()}, not dissolved in it. The paper holds it back and clear ${S.label.toLowerCase()} runs through: a suspension is exactly what filtration is for.`
                : `${S.label} does not dissolve this solute, so it stays a solid and the paper keeps it. The filtrate is just ${S.label.toLowerCase()} — which is a separation, but of the solvent from everything else. Swap to water and watch the same salt run straight through.`,
          noteTone: r.separates ? "good" : "warn",
        };
        legend = {
          title: "Filtration Key",
          items: [
            { color: r.residueColour, shape: "square", label: "Residue", note: "undissolved solid held on the fluted paper" },
            { color: r.filtrateColour, shape: "square", label: "Filtrate", note: "whatever dissolved, plus the solvent" },
            { color: "#f4f1e6", shape: "square", label: "Fluted filter paper", note: `pores ~${FILTER_PORE_UM} µm — folded to speed the flow` },
          ],
        };
      } else if (stationKey === "crystallization") {
        const r = solveCrystallization(args);
        const lead = r.crystallisers[0];
        readout = {
          title: "Evaporating crystallisation",
          subtitle: `${M.label} · ${S.label} · ${formatSeconds(seconds)} at ${r.timeLapse}×`,
          rows: [
            ["Property used", "solubility — and how it changes with temperature", "gold"],
            ["Phase", r.phase, r.phase === "cooling" || r.phase === "done" ? "good" : r.phase === "dry" ? "warn" : undefined],
            ["Basin temperature", `${r.temperatureC.toFixed(0)} °C (boils at ${S.boilingC} °C)`, r.boiling ? "warn" : undefined],
            ["Burner", r.flameOn ? "on" : "off — flame taken away", r.flameOn ? "gold" : undefined],
            ["Solvent left", `${r.volumeMl.toFixed(1)} of ${SAMPLE_VOLUME_ML} mL`],
            ["Evaporation rate", `${(r.evapMlPerS * 60).toFixed(1)} mL/min — latent heat ${S.latentKJPerKg} kJ/kg`],
            ...(lead
              ? [
                  ["— " + lead.label.toUpperCase() + " —", lead.crystal === "prism" ? "blue prisms" : "cubes", "gold"],
                  ["Dissolved at the start", `${lead.dissolvedG.toFixed(1)} g`],
                  ["Concentration now", Number.isFinite(lead.concentration) ? `${lead.concentration.toFixed(1)} g/100 mL` : "—"],
                  ["Solubility at this T", `${lead.solubility.toFixed(1)} g/100 mL`],
                  ["Saturation", pct(lead.saturation), lead.saturation >= 0.999 ? "warn" : undefined],
                  ["Crystals out", `${lead.crystalsG.toFixed(2)} g (${pct(lead.crystalFraction)})`, lead.nucleated ? "good" : undefined],
                  ["Method", lead.crystal && COMPONENTS[lead.key].method === "cool" ? "stop at first crystals, then cool" : "evaporate to dryness"],
                ]
              : r.filmG > 0 || M.components.every((k) => !COMPONENTS[k].crystal)
                ? [["Dye film", `${r.filmG.toFixed(2)} g dried down`, "warn"], ["Crystals", "none — dyes are not crystalline", "bad"]]
                : [["Undissolved solid", `${r.precipitateG.toFixed(1)} g — never in solution`, "warn"], ["Crystals", "none to grow", "bad"]]),
            ["Verdict", r.verdict, r.nucleated ? "good" : r.dry ? "warn" : undefined],
          ],
          note: lead
            ? `${lead.label} can be held in solution only up to its solubility, ${lead.solubility.toFixed(0)} g per 100 mL at ${r.temperatureC.toFixed(0)} °C. ${r.nucleated ? `With ${r.volumeMl.toFixed(0)} mL of solvent left the solution is saturated and ${lead.crystalsG.toFixed(1)} g has come out as crystals.` : `With ${r.volumeMl.toFixed(0)} mL of solvent left it is ${pct(lead.saturation)} of the way to saturation — the crystals appear the moment it passes 100%.`} ${COMPONENTS[lead.key].method === "cool" ? "Its solubility falls steeply on cooling, so the flame is taken away at the first crystals and cooling does the rest." : "Its solubility barely changes with temperature, so the basin is taken to dryness."}${S.flammable ? " Ethanol is flammable: in a real lab this basin sits in a water bath, never over a naked flame." : ""}`
            : M.components.every((k) => !COMPONENTS[k].crystal)
              ? "Food dyes are not crystalline solids: as the solvent leaves they dry to a smear on the basin rather than forming crystals. Crystallisation only recovers a solute that can build a lattice — and this sample is a mixture, so the film is all three dyes together."
              : `Nothing dissolved in ${S.label.toLowerCase()} to begin with, so there is no solution to saturate. Evaporation just dries the solid that was already there — a reminder that crystallisation starts from a solution, and that ${M.label.toLowerCase()} needs water for that.`,
          noteTone: r.nucleated ? "good" : lead ? "neutral" : "warn",
        };
        legend = {
          title: "Crystallisation Key",
          items: [
            { color: r.liquidColour, shape: "square", label: "Solution in the basin", note: "concentrates as the solvent leaves" },
            ...(lead ? [{ color: lead.colour, shape: "square", label: `${lead.label} crystals`, note: lead.crystal === "prism" ? "blue triclinic prisms, growing on cooling" : "white cubes, left when the basin dries" }] : []),
            { color: "#e8eef5", shape: "dot", label: "Steam", note: `solvent leaving at ${(r.evapMlPerS * 60).toFixed(1)} mL/min` },
            { color: "#4f8ff7", shape: "dot", label: "Bunsen flame", note: r.flameOn ? "on — heating through the gauze" : "off — cooling now" },
          ],
        };
      } else {
        const r = solveChromatography(args);
        readout = {
          title: "Paper chromatography",
          subtitle: `${M.label} · ${S.label} · ${formatSeconds(seconds)} at ${r.timeLapse}×`,
          rows: [
            ["Property used", "affinity for the solvent vs the paper", "gold"],
            ["Solvent (mobile phase)", `${S.label} — ${S.polarity}`],
            ["Solvent front", `${r.frontMm.toFixed(1)} mm of ${FRONT_MAX_MM} mm${r.finished ? " · run complete" : ""}`, r.finished ? "good" : undefined],
            ["Rf formula", "Rf = d(pigment) ÷ d(solvent front)", "gold"],
            ...r.spots.map((spot) => [
              `${spot.label}`,
              spot.moves ? `Rf = ${rfText(spot, r.frontMm)}` : spot.visible ? "stays on the baseline" : "colourless — cannot be seen",
              spot.moves && spot.visible ? "good" : spot.visible ? "warn" : undefined,
            ]),
            ...r.spots.filter((spot) => spot.moves).map((spot) => [`${spot.label} affinity`, spot.note]),
            ["Visible spots", `${r.distinct}`, r.distinct >= 2 ? "good" : r.distinct === 1 ? "gold" : "bad"],
            ["Verdict", r.verdict, r.distinct >= 2 ? "good" : r.distinct === 1 ? "gold" : "bad"],
          ],
          note:
            r.distinct >= 2
              ? `Each dye is carried a fixed fraction of the solvent's journey — its Rf — set by how much it likes ${S.label.toLowerCase()} against how much it clings to the paper. The fractions differ, so the spots pull apart, and because both distances grow together the Rf values (${r.movingVisible.map((sp) => sp.rf.toFixed(2)).join(", ")}) do not change during the run. Swap the solvent and every Rf changes: the same dyes, a different balance.`
              : r.distinct === 1
                ? `One spot moving at a single Rf (${r.movingVisible[0].rf.toFixed(2)}) is the chromatographic signature of a pure substance. Chromatography cannot separate what is not a mixture — it can only confirm it is not one.`
                : r.spots.some((sp) => !sp.visible && sp.rf > 0.05)
                  ? "The salt does travel up the paper with the water, but sodium chloride is colourless, so there is nothing to see without a locating agent — and it is a single substance, so it would give one spot anyway. The sand does not dissolve and never leaves the baseline."
                  : `Nothing in this sample dissolves in ${S.label.toLowerCase()}, so nothing is carried up the paper. Chromatography needs a solvent the components actually move in.`,
          noteTone: r.distinct >= 2 ? "good" : r.distinct === 1 ? "neutral" : "warn",
        };
        legend = {
          title: "Chromatography Key",
          items: [
            ...r.spots.filter((sp) => sp.visible).map((sp) => ({ color: sp.colour, shape: "dot", label: sp.label, note: sp.moves ? `Rf ${sp.rf.toFixed(2)} in ${S.label.toLowerCase()}` : sp.note })),
            { color: "#64748b", shape: "line", label: "Solvent front", note: "climbs as √t by capillary action" },
            { color: "#4b5563", shape: "line", label: "Pencil baseline", note: "pencil, because ink would run" },
          ],
        };
      }
      // Is this the right station for this sample at all? Leads the panel.
      const fit = stationFit({ station: stationKey, mixture: mixKey, solvent: solKey });
      const fitLabel = { right: "✓ right tool", partly: "≈ only partly", wrong: "✗ wrong tool" }[fit.fit];
      const fitTone = { right: "good", partly: "warn", wrong: "bad" }[fit.fit];
      const tryNext = fit.betterSolvent ? ` — try ${SOLVENTS[fit.betterSolvent].label.toLowerCase()}` : fit.better.length ? ` — try ${fit.better.map((s) => STATIONS[s].label.toLowerCase()).join(" or ")}` : "";
      readout.rows.unshift(["Right tool for this sample?", `${fitLabel} · ${fit.reason}${tryNext}`, fitTone]);
      break;
    }

    case "combustion_fire_triangle": {
      const collar = num(params.collar, 15);
      const p = flameProfile(collar);
      const lit = params.liveLit !== false;
      const tempC = params.liveTempC === undefined || params.liveTempC === null ? Math.round(p.temperatureC) : num(params.liveTempC, p.temperatureC);
      const o2 = num(params.liveO2, O2_AIR * 100);
      const heat = num(params.liveHeat, 1);
      const fuel = params.liveFuel !== false;
      const jar = typeof params.liveJar === "string" ? params.liveJar : "up";
      const soot = num(params.liveSoot, 0);
      const basin = typeof params.liveBasin === "string" ? params.liveBasin : "rest";
      const out = typeof params.liveOut === "string" ? params.liveOut : "";
      // The side that put the flame out stays missing until a relight; the
      // other two stay present — one interrupter, one side.
      const oxygenOk = out === "oxygen" ? false : o2 >= O2_EXTINCTION * 100;
      const heatOk = lit || (out !== "heat" && (out !== "" || heat >= HEAT_EXTINCTION));
      const complete = p.mode === "complete";

      readout = {
        title: "Combustion & the fire triangle",
        subtitle: `collar ${p.label} · ${lit ? "lit" : "out"}`,
        rows: [
          ["Flame", lit ? (complete ? "blue, roaring, inner cone" : p.air < 0.35 ? "yellow, sooty, lazy" : "orange — part way") : "out", lit ? (complete ? "good" : "warn") : "bad"],
          ["Core temperature", `${tempC} °C (range ${FLAME_MIN_C}–${FLAME_MAX_C} °C)`, lit ? "gold" : undefined],
          ["Air mixed in", `${(p.air * 100).toFixed(0)}% of the holes open`],
          ["— LIVE EQUATION —", p.equation.label, complete ? "good" : "warn"],
          ["Equation", lit ? p.equation.text : "— no reaction —", lit ? (complete ? "good" : "warn") : "bad"],
          ["Products", p.equation.products],
          ["Energy released", `${Math.abs(p.equation.enthalpyKJPerMol)} kJ per mol CH₄`],
          ["CO in the exhaust", lit ? `${p.coPpm} ppm` : "0 ppm", lit && p.coFraction > 0.45 ? "bad" : lit && p.coFraction > 0.12 ? "warn" : "good"],
          ["Soot", lit ? `${(p.sootRate * 100).toFixed(0)}% of the closed-collar rate` : "none", lit && p.sootRate > 0.2 ? "warn" : undefined],
          ["— FIRE TRIANGLE —", fuel && oxygenOk && heatOk ? "complete" : "broken", fuel && oxygenOk && heatOk ? "good" : "bad"],
          ["Fuel (methane)", fuel ? "gas tap open" : "gas tap SHUT", fuel ? "good" : "bad"],
          ["Oxygen", `${o2.toFixed(1)}% ${jar === "up" ? "(room air)" : `inside the jar (${jar})`} — needs ≥ ${(O2_EXTINCTION * 100).toFixed(0)}%`, oxygenOk ? "good" : "bad"],
          ["Heat", lit ? "the flame keeps its own zone hot" : out === "heat" ? `removed — the mist cooled the zone below ignition (${IGNITION_C} °C)` : out ? `still there — hot barrel, striker to hand; it went out for want of ${out}` : `${(heat * 100).toFixed(0)}% reserve — will not reignite by itself`, heatOk ? "good" : "bad"],
          ["Flame went out because", out ? `${out} was removed` : "— it has not", out ? "bad" : undefined],
          ["— COLD BASIN —", basin === "held" ? `in the flame (${BASIN_HOLD_S} s)` : basin === "showing" ? "on the cradle, underside out" : "on the bench", basin === "held" ? "warn" : undefined],
          ["Soot deposit", soot > 0.02 ? `${(soot * 100).toFixed(0)}% cover — unburnt carbon` : "clean", soot > 0.02 ? "warn" : "good"],
        ],
        note: describeFlame({ lit, extinguishedBy: out || null, jarO2: o2 / 100, heat }, collar) + (lit ? ` ${p.equation.note}` : ""),
        noteTone: lit ? (complete ? "good" : "warn") : "bad",
      };
      legend = {
        title: "Combustion Key",
        items: [
          { color: "#f5b731", shape: "dot", label: "Yellow flame", note: `collar closed — incomplete: ${EQUATIONS.incomplete.text}` },
          { color: "#4f8ff7", shape: "dot", label: "Blue flame", note: `collar open — complete: ${EQUATIONS.complete.text}` },
          { color: "#7dd3fc", shape: "dot", label: "Inner cone", note: "unburnt gas–air mix; the hottest point is just above its tip" },
          { color: "#0b0d12", shape: "dot", label: "Soot", note: "carbon that never met enough oxygen" },
          { color: "#34d399", shape: "dot", label: "Triangle side present", note: "fuel, oxygen and heat all needed at once" },
          { color: "#fb7185", shape: "dot", label: "Triangle side removed", note: "tap shut · jar starved · mist cooled" },
        ],
      };
      break;
    }


    case "particle_model_matter": {
      const substance = typeof params.substance === "string" ? params.substance : "water";
      const S = substanceFor(substance);
      const setpoint = num(params.temperature, 20);
      const P = num(params.pressure, 1);
      const tempC = num(params.liveTempC, setpoint);
      const phase = typeof params.livePhase === "string" ? params.livePhase : "liquid";
      const fraction = num(params.liveFraction, 0);
      const heating = num(params.liveHeating, 0);
      const energyKJ = num(params.liveEnergyKJ, 0);
      const pistonPct = num(params.livePistonPct, 50);
      const info = describePhase({ substance, pressureAtm: P, tempC, phase, fraction, heating });
      const ke = kineticReadout(substance, tempC);
      const tr = transitionsAt(substance, P);
      const curve = heatingCurve(substance, P);
      const comp = phaseComposition(phase, fraction);
      const vol = molarVolumes(substance, P, tempC);
      const onStep = phase === "melting" || phase === "boiling" || phase === "subliming";
      const drive = heating > 50 ? "heating" : heating < -50 ? "cooling" : "at the setpoint";
      const tmAt1 = substance === "co2" ? null : meltingPointC(substance, 1);
      const tbAt1 = substance === "co2" ? null : boilingPointC(substance, 1);
      const stepRows =
        tr.kind === "sublime"
          ? [
              ["Sublimation point", `${tr.sublimeC.toFixed(1)} °C at ${P.toFixed(1)} atm (−78.5 °C at 1 atm)`, phase === "subliming" ? "bad" : undefined],
              ["Latent heat of sublimation", `${(tr.dHsub / 1000).toFixed(1)} kJ/mol — the single flat step`],
              ["Liquid?", `none below the triple-point pressure of ${S.tripleAtm} atm`, "warn"],
            ]
          : [
              ["Melting point", `${tr.meltC.toFixed(2)} °C at ${P.toFixed(1)} atm${tmAt1 !== null ? ` (${tmAt1.toFixed(1)} °C at 1 atm)` : ""}`, phase === "melting" ? "bad" : undefined],
              ["Boiling point", `${tr.boilC.toFixed(1)} °C at ${P.toFixed(1)} atm${tbAt1 !== null ? ` (${tbAt1.toFixed(1)} °C at 1 atm)` : ""}`, phase === "boiling" ? "bad" : undefined],
              ["ΔH fusion · ΔH vaporisation", `${(tr.dHfus / 1000).toFixed(1)} · ${(tr.dHvap / 1000).toFixed(1)} kJ/mol`],
            ];
      readout = {
        title: "Particle model of matter",
        subtitle: `${S.label} (${S.formula}) · ${info.label}`,
        rows: [
          ["Phase", info.label, onStep ? "bad" : phase === "solid" ? "gold" : phase === "liquid" ? "good" : "warn"],
          ["Particles are", info.detail, onStep ? "bad" : undefined],
          ["Sample temperature", `${tempC.toFixed(1)} °C (${ke.tempK.toFixed(0)} K)`, onStep ? "bad" : "gold"],
          ["Hotplate setpoint", `${setpoint.toFixed(0)} °C — ${drive}${drive !== "at the setpoint" ? ` at ${Math.abs(heating).toLocaleString("en-GB")} J/mol·s` : ""}`, drive === "heating" ? "warn" : drive === "cooling" ? "good" : undefined],
          ["Energy supplied", `${energyKJ.toFixed(1)} of ${(curve.totalE / 1000).toFixed(0)} kJ/mol on the curve`],
          ["— KINETIC ENERGY —", `∝ absolute temperature`, "gold"],
          ["Mean KE per particle", `³⁄₂kT = ${ke.meanKEzJ.toFixed(2)} ×10⁻²¹ J`, "gold"],
          ["r.m.s. speed", `√(3RT/M) = ${ke.vRms.toFixed(0)} m/s`],
          ["Particles", `${Math.round(comp.solid * 100)}% lattice · ${Math.round(comp.liquid * 100)}% liquid · ${Math.round(comp.gas * 100)}% gas`],
          ["— PHASE BOUNDARIES —", `${S.bonding}`, undefined],
          ...stepRows,
          ["Critical point", `${S.criticalC} °C, ${S.criticalAtm} atm${tempC > S.criticalC ? " — above T꜀: a gas no pressure can liquefy" : ""}`, tempC > S.criticalC ? "warn" : undefined],
          ["— PISTON —", `${P.toFixed(1)} atm · ${pistonPct}% of travel`, undefined],
          ["Solid vs liquid volume", `${S.solidExpansion > 1 ? "+" : "−"}${Math.abs(Math.round((S.solidExpansion - 1) * 100))}% as a solid — ${S.solidExpansion > 1 ? "the solid floats" : "the solid sinks"}`, S.solidExpansion > 1 ? "warn" : undefined],
          ["Real gas : liquid volume", `${vol.ratio >= 1000 ? Math.round(vol.ratio).toLocaleString("en-GB") : vol.ratio.toFixed(0)} : 1 at ${tempC.toFixed(0)} °C, ${P.toFixed(1)} atm — the column is a compressed map`],
        ],
        note: onStep
          ? `The thermometer has stopped at ${tempC.toFixed(1)} °C while the hotplate is still ${drive}. Every joule going in is spent ${phase === "melting" ? "pulling particles out of the lattice" : phase === "boiling" ? "separating particles from one another completely" : "lifting particles straight out of the lattice into the gas"} — not on speed — until all of them have crossed. ${S.bondingNote}`
          : `${S.bondingNote} The hotplate pushes energy in at ${HEATING_CONDUCTANCE} J/mol·s per kelvin of gap, so the sample chases the setpoint — and stalls at each flat step of the curve.`,
        noteTone: onStep ? "bad" : "good",
      };
      legend = {
        title: "Particle Key",
        items: [
          { color: S.colour.solid, shape: "dot", label: "Solid lattice", note: "vibrating about fixed sites — harder as T rises" },
          { color: S.colour.liquid, shape: "dot", label: "Liquid", note: "touching, sliding past one another" },
          { color: S.colour.gas, shape: "dot", label: "Gas", note: "free flight at √T speed, wall collisions" },
          { color: "#fb7185", shape: "line", label: "Flat step", note: "latent heat — temperature held" },
          { color: "#f97316", shape: "square", label: "Hotplate glow", note: "orange heating · blue cooling" },
        ],
      };
      break;
    }

    case "radioactive_decay": {
      const modeId = typeof params.mode === "string" ? params.mode : "alpha";
      const M = modeFor(modeId);
      const n0 = Math.max(1, Math.round(num(params.atoms, 2000)));
      const barrierId = typeof params.barrier === "string" ? params.barrier : "paper";
      const B = barrierFor(barrierId);
      const fieldOn = Boolean(params.fieldOn);
      const alive = Math.round(num(params.liveAlive, n0));
      const t = num(params.liveT, 0);
      const rate = num(params.liveRate, 0);
      const activity = num(params.liveActivity, activityBq(n0));
      const finished = Boolean(params.liveFinished);
      const marks = typeof params.liveMarks === "string" && params.liveMarks ? params.liveMarks.split(",").map(Number).filter((v) => Number.isFinite(v)) : [];
      const intervals = halfLifeIntervals(marks);
      const eq = nuclearEquation(modeId);
      const primary = M.emissions[0];
      const PK = PARTICLE_KINDS[primary.kind];
      const defl = deflection(primary.kind, fieldOn);
      const through = transmission(primary.kind, barrierId);
      const halves = t / SIM_HALF_LIFE_S;
      const expected = theoreticalN(n0, t);
      const realPerSim = realSecondsPerSimSecond(modeId);
      const meanInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : null;
      const scatter = intervals.length > 1 ? Math.sqrt(intervals.reduce((a, b) => a + (b - meanInterval) ** 2, 0) / intervals.length) : null;
      readout = {
        title: "Radioactive decay & half-life",
        subtitle: `${M.label} · ${M.parent.name} → ${M.daughter.name}`,
        rows: [
          ["Nuclear equation", eq.text, "gold"],
          ["Nucleon number A", `${eq.left.A} = ${eq.right.A} ${eq.conservedA ? "✓ conserved" : "✗"}`, eq.conservedA ? "good" : "bad"],
          ["Atomic number Z", `${eq.left.Z} = ${eq.right.Z} ${eq.conservedZ ? "✓ conserved" : "✗"} (${eq.deltaZ === 0 ? "Z unchanged" : `Z ${eq.deltaZ > 0 ? "+" : ""}${eq.deltaZ}`}, ${eq.deltaA === 0 ? "A unchanged" : `A ${eq.deltaA}`})`, eq.conservedZ ? "good" : "bad"],
          ["Emitted", M.emissions.map((e) => `${e.display} (${e.name})`).join(" + ")],
          ["— HALF-LIFE —", `${halfLifeLabel(modeId)} real · ${SIM_HALF_LIFE_S} s on screen`, "gold"],
          ["1 second on screen", `= ${formatDuration(realPerSim)} for ${M.parent.name}`],
          ["Decay constant λ", `ln 2 / t½ = ${LAMBDA.toFixed(4)} per sim second`],
          ["Elapsed", `${t.toFixed(1)} s = ${halves.toFixed(2)} half-lives`],
          ["Remaining N", `${alive.toLocaleString("en-GB")} of ${n0.toLocaleString("en-GB")} (${((alive / n0) * 100).toFixed(1)}%) — predicted ${Math.round(expected).toLocaleString("en-GB")}`, finished ? undefined : Math.abs(alive - expected) / n0 < 0.02 ? "good" : "warn"],
          ["Half-life stamps", marks.length > 0 ? marks.map((v, i) => `N₀/${2 ** (i + 1)} at ${v.toFixed(1)} s`).join(" · ") : "— waiting for N to reach N₀/2", marks.length > 0 ? "gold" : undefined],
          ["Measured intervals", intervals.length > 0 ? `${intervals.map((v) => `${v.toFixed(1)} s`).join(", ")}${meanInterval !== null ? ` · mean ${meanInterval.toFixed(1)} s` : ""}${scatter !== null ? ` · scatter ±${scatter.toFixed(1)} s` : ""}` : "—", scatter !== null ? (scatter < 0.6 ? "good" : "warn") : undefined],
          ["— GEIGER COUNTER —", `${activity.toFixed(1)} Bq`, "gold"],
          ["Activity A = λN", `${activity.toFixed(1)} decays/s at the source`, "gold"],
          ["Counted last second", `${rate.toFixed(1)} /s — every decay is a click, whatever the barrier`],
          ["Through the barrier", defl.direction !== 0 ? `0 /s — the field has bent the ${primary.display} off the tube's window` : `${(rate * through).toFixed(1)} /s — ${B.label.toLowerCase()} (${B.thickness}) passes ${Math.round(through * 100)}% of ${primary.display}`, defl.direction !== 0 || through < 0.5 ? "bad" : "good"],
          ["— THE RADIATION —", `${primary.name} at ~${M.speedOfLight === 1 ? "c" : `${Math.round(M.speedOfLight * 100)}% of c`}`, undefined],
          ["Charge · mass", `${PK.charge > 0 ? "+" : ""}${PK.charge} e · ${PK.massU === 0 ? "0" : PK.massU >= 1 ? `${PK.massU.toFixed(1)} u` : "1/1836 u"}`],
          ["Ionising · range", `${M.ionising} · ${M.range}`],
          ["Field plates", fieldOn ? `on — ${primary.display} ${defl.direction === 0 ? "goes straight: " + defl.reason : defl.reason}` : "off — every path is straight", fieldOn ? (defl.direction === 0 ? "warn" : "good") : undefined],
          ["Stopped by", ["paper", "aluminium", "lead"].map((b) => `${barrierFor(b).label}: ${penetrates(primary.kind, b) ? "passes" : "stopped"}`).join(" · ")],
          ["Drawn tracers", `a sample of the decays — up to 3 a frame; the counts above are the model's`, undefined],
        ],
        note: `${describeSample({ n0, alive, t }, modeId)} ${M.note} The curve is drawn over ${CURVE_HALF_LIVES} half-lives; press Fresh sample to roll the dice again.`,
        noteTone: finished ? "neutral" : Math.abs(alive - expected) / n0 < 0.02 ? "good" : "warn",
      };
      legend = {
        title: "Decay Key",
        items: [
          { color: "#fbbf24", shape: "dot", label: `${M.parent.name} (parent)`, note: "undecayed — the same chance every second" },
          { color: "#3b4658", shape: "dot", label: `${M.daughter.name} (daughter)`, note: "decayed — its nucleus has changed" },
          { color: PK.colour, shape: "dot", label: `${primary.display} ${primary.name}`, note: M.range },
          ...(M.emissions.length > 1 ? [{ color: PARTICLE_KINDS.neutrino.colour, shape: "dot", label: `${M.emissions[1].display} ${M.emissions[1].name}`, note: "no charge — through the plates, the barrier and the tube" }] : []),
          { color: "#a78bfa", shape: "dash", label: "N₀e^(−λt)", note: "the prediction the sample is judged against" },
          { color: "#fbbf24", shape: "line", label: "Measured N(t)", note: "this sample, one vertex a tenth of a second" },
          { color: "#34d399", shape: "dash", label: "Half-life stamps", note: "when N first reached N₀/2, N₀/4, N₀/8 …" },
        ],
      };
      break;
    }

    // ═════════════════════════════════════════════════════════════════════
    // 3. BIOLOGY
    // ═════════════════════════════════════════════════════════════════════

    case "enzyme": {
      // Shared solver. The panel used to run a different rate model from the
      // scene (linear triangles against Gaussians) and denature at 55 °C where
      // the scene denatures at 50, so at 52 °C it reported 40 % and
      // "Complementary Lock" over a visibly wrecked active site.
      const e = solveEnzyme({ temperature: num(params.temperature, 37), ph: num(params.ph, 7.0) });

      readout = {
        title: "Enzyme kinetics & catalysis",
        subtitle: "Lock and key · one enzyme, one substrate",
        rows: [
          ["Catalytic rate", `${e.ratePercent}%`, e.rate > 0.6 ? "good" : e.rate < 0.2 ? "bad" : "gold"],
          ["Temperature", `${e.temperature.toFixed(0)} °C`, e.denatured ? "bad" : undefined],
          ["pH", e.ph.toFixed(1), e.extremePh ? "bad" : undefined],
          ["Optimum", `${OPTIMUM_TEMP} °C, pH ${OPTIMUM_PH}`],
          ["Denatures above", `${DENATURE_TEMP} °C`, e.denatured ? "bad" : "good"],
          ["Active site", e.activeSite, e.denatured || e.extremePh ? "bad" : "good"],
          ["Reversible?", e.reversible ? "yes — just slower; warming it up recovers the rate" : "no — the shape is permanently changed", e.reversible ? "good" : "bad"],
        ],
        note: e.denatured
          ? `Above ${DENATURE_TEMP} °C the active site has permanently changed shape — the substrate no longer fits, and cooling will not bring the rate back. Look at the cliff on the curve.`
          : e.extremePh
            ? "Extreme pH distorts the active site too, so the substrate binds poorly. Move pH back towards 7 and the whole curve lifts."
            : e.tooCold
              ? "Cold: the particles collide less often and with less energy, so the rate is low — but the enzyme is unharmed and warming it up recovers the rate."
              : "Near the optimum: frequent, energetic collisions and a perfectly shaped active site.",
        noteTone: e.denatured ? "bad" : e.extremePh ? "warn" : "good",
      };

      legend = {
        title: "Enzyme component key",
        items: [
          {
            // The scene draws the enzyme emerald and lerps it to rose as it
            // unfolds. The key used to show it blue.
            color: e.distortion > 0.5 ? ENZYME_COLOURS.denatured : ENZYME_COLOURS.enzyme,
            shape: "square",
            label: e.distortion > 0.5 ? "Denatured enzyme" : "Enzyme",
            note: "a protein catalyst — not used up by the reaction",
          },
          { color: ENZYME_COLOURS.substrate, shape: "square", label: "Substrate", note: "the key that fits this lock" },
          { color: ENZYME_COLOURS.product, shape: "square", label: "Products", note: "the two halves, drifting apart after the split" },
          { color: ENZYME_COLOURS.curve, shape: "line", label: "Rate against temperature", note: "climbs to the optimum, then falls off a cliff" },
          { color: ENZYME_COLOURS.marker, shape: "dot", label: "Where you are on that curve" },
        ],
      };
      break;
    }

    case "dna": {
      // Shared generator. The panel used to print a hard-coded sequence
      // ("A-T-G-C-C-A-T-G…") while the scene drew its own — not one base
      // matched — and keyed every base to the wrong colour.
      const h = describeHelix(num(params.pairs, 16));

      readout = {
        title: "DNA double helix",
        subtitle: "Antiparallel complementary strands",
        rows: [
          ["Base pairs shown", h.pairs, "gold"],
          ["Strand 1 (5′→3′)", h.sequence.join("–")],
          ["Strand 2 (3′→5′)", h.complement.join("–")],
          ["Pairing rule", "A–T and C–G, always", "good"],
          ["Hydrogen bonds", `${h.hydrogenBonds} · 2 per A–T, 3 per C–G`],
          ["Base composition", `A ${h.counts.A} · T ${h.counts.T} · C ${h.counts.C} · G ${h.counts.G}`],
          ["GC content", `${Math.round(h.gcFraction * 100)}% — more C–G means a stronger helix`],
          ["Backbone", "deoxyribose sugar + phosphate"],
          ["Full turn every", `${BASE_PAIRS_PER_TURN} base pairs · ${h.turns.toFixed(1)} turns shown`],
        ],
        note: "Because the strands are complementary, each one carries the full instructions on its own. Press “Unzip DNA”: the weak hydrogen bonds break, the strong sugar–phosphate backbones do not, and both old strands become templates for new ones. That is semi-conservative replication.",
        noteTone: "good",
      };

      legend = {
        title: "Nucleotide base key",
        items: [
          // Straight from the table the scene colours the bases with. The old
          // key had all four wrong, and circularly so: A keyed red but drawn
          // green, T keyed sky but drawn rose, C keyed gold but drawn sky.
          ...Object.keys(BASE_COLOURS).map((base) => ({
            color: BASE_COLOURS[base],
            shape: "dot",
            label: `${BASE_NAMES[base]} (${base})`,
            note: `${BASE_CLASS[base]} · pairs with ${BASE_NAMES[COMPLEMENT[base]]} via ${PAIR_BONDS[base]} hydrogen bonds`,
          })),
          { color: BACKBONE_COLOURS.strandA, shape: "line", label: "Backbone, strand 1", note: "sugar–phosphate — strong, and never broken by unzipping" },
          { color: BACKBONE_COLOURS.strandB, shape: "line", label: "Backbone, strand 2", note: "running the opposite way — the strands are antiparallel" },
        ],
      };
      break;
    }

    case "cell": {
      // Shared solver, and an organelle table that knows which cell type each
      // organelle belongs to. The key used to list chloroplasts, a vacuole and
      // a cell wall for animal cells, and omitted smooth ER, ribosomes,
      // lysosomes, centrioles and the cytoskeleton entirely.
      const c = solveOsmosis({ cellType: params.cellType || "plant", tonicity: num(params.tonicity, 0) });

      readout = {
        title: c.isPlant ? "Plant cell explorer" : "Animal cell explorer",
        subtitle: "Osmosis: water moves from dilute to concentrated",
        rows: [
          ["Outside the cell", c.outside],
          ["Net water flow", c.flow],
          ["Cell state", c.state, c.tone],
          ["…which means", c.detail],
          ["Cell wall", c.hasWall ? "yes — cellulose, rigid" : "no", c.hasWall ? "good" : "bad"],
          ["Chloroplasts", c.hasChloroplasts ? "yes" : "no", c.hasChloroplasts ? "good" : "bad"],
          ["Permanent vacuole", c.hasVacuole ? "yes — cell sap" : "no", c.hasVacuole ? "good" : "bad"],
          ["Centrioles", c.hasCentrioles ? "yes" : "no", c.hasCentrioles ? "good" : "bad"],
        ],
        note: c.isPlant
          ? "Click any organelle to identify it, and turn on Cutaway to see inside. The rigid wall is what saves a plant cell: water can push the membrane against it until the cell is turgid, without the cell bursting."
          : "Click any organelle to identify it, and turn on Cutaway to see inside. With no cell wall, an animal cell has nothing to resist the pressure — too much water in and it bursts.",
        noteTone: "neutral",
      };

      legend = {
        title: c.isPlant ? "Organelles · plant cell" : "Organelles · animal cell",
        items: [
          ...c.organelles.map((o) => ({ color: o.colour, shape: "dot", label: o.label, note: o.note })),
          ...(c.moving
            ? [{ color: WATER_COLOUR, shape: "dot", label: "Water molecules", note: c.tonicity > 0 ? "leaving by osmosis" : "entering by osmosis" }]
            : []),
        ],
      };
      break;
    }

    case "protein": {
      // Shared solver. The panel used `temperature > 320 || fold < 0.35` where
      // the scene applies heat as a window multiplying the slider, so a
      // 74 %-folded helix at 330 K was reported as a random coil — and
      // "Folded Progress" printed the raw slider, not what was drawn.
      const f = solveFolding({
        structure: params.structure || "helix",
        residues: num(params.residues, 30),
        fold: num(params.fold, 1),
        temperature: num(params.temperature, 300),
      });
      const structureLabel =
        f.structure === "helix" ? "α-helix (3.6 residues/turn)" : f.structure === "sheet" ? "β-pleated sheet" : "Random coil";

      readout = {
        title: "Protein structure & folding",
        subtitle: `${structureLabel} · secondary structure`,
        rows: [
          ["Residues", f.residues, "gold"],
          ["Conformation", f.denatured ? "denatured — random coil" : structureLabel, f.denatured ? "bad" : "good"],
          ["Folding asked for", `${Math.round(f.asked * 100)}%`],
          ["Actually folded", `${f.foldedPercent}%`, f.folded > 0.8 ? "good" : f.denatured ? "bad" : "warn"],
          ["Temperature", `${f.temperatureK.toFixed(0)} K (${f.temperatureC.toFixed(0)} °C)`, f.heating ? "warn" : undefined],
          ["Heat leaves", `${Math.round(f.heatFactor * 100)}% of the fold intact`, f.heatFactor < 0.5 ? "bad" : f.heatFactor < 1 ? "warn" : "good"],
          ["Hydrogen bonds", f.bondsFormed ? "formed — holding the structure" : "not formed — the partners are out of reach", f.bondsFormed ? "good" : "bad"],
          ["Stabilised by", "hydrogen bonds between N–H and C=O"],
        ],
        note: f.isCoil
          ? "A random coil has no regular hydrogen bonding and so no fixed shape. Real proteins use coil regions as the hinges between helices and sheets."
          : f.denatured
            // Name the control that actually did it, rather than blaming heat
            // for an unfolding the fold slider caused at room temperature.
            ? f.cause === "slider"
              ? `The fold slider is at ${Math.round(f.asked * 100)}%, so the chain has simply not been folded — at ${f.temperatureC.toFixed(0)} °C the hydrogen bonds could hold it perfectly well. Raise the slider and watch it fold.`
              : `At ${f.temperatureC.toFixed(0)} °C the hydrogen bonds holding the secondary structure have broken and the chain has fallen into a random coil. The sequence of amino acids is untouched — but the shape, and so the function, is gone.`
            : f.structure === "helix"
              ? "Each hydrogen bond runs from residue i to residue i+4, four along the chain — that spacing is what forces the backbone into a spiral of 3.6 residues per turn."
              : "Neighbouring strands run in opposite directions and hydrogen-bond sideways to each other, so the sheet is held across the chain rather than along it.",
        noteTone: f.denatured ? "bad" : "good",
      };

      legend = {
        title: "Protein folding key",
        items: params.colourByType !== false && !f.denatured
          ? [
              { color: STRUCTURE_COLOURS.hydrophobic, shape: "dot", label: "Hydrophobic residue", note: "non-polar — packs into the core, away from water" },
              { color: STRUCTURE_COLOURS.hydrophilic, shape: "dot", label: "Hydrophilic residue", note: "polar — faces the water outside" },
              { color: STRUCTURE_COLOURS.bond, shape: "dash", label: "Hydrogen bond", note: "weak alone, decisive in numbers" },
              { color: STRUCTURE_COLOURS.backbone, shape: "line", label: "Polypeptide backbone", note: "the peptide chain itself" },
            ]
          : [
              // Only one entry can own #fbbf24; the old key gave it to both
              // "Hydrophobic Residue" and "Denatured State" at once.
              {
                color: f.denatured ? STRUCTURE_COLOURS.denatured : STRUCTURE_COLOURS[f.structure] ?? STRUCTURE_COLOURS.helix,
                shape: "dot",
                label: f.denatured ? "Denatured residue" : "Residue",
                note: f.denatured ? "unfolded, disordered chain" : "one amino acid",
              },
              { color: STRUCTURE_COLOURS.bond, shape: "dash", label: "Hydrogen bond", note: "weak alone, decisive in numbers" },
              { color: STRUCTURE_COLOURS.backbone, shape: "line", label: "Polypeptide backbone", note: "the peptide chain itself" },
            ],
      };
      break;
    }

    // No `case "respiratory"` here, deliberately.
    //
    // `respiratory` sets `ownHud: true` in topics.js, and ThreeDView skips
    // VisualizationHUD entirely for such topics — RespiratoryCanvas renders
    // its own panel. A case here can never run. One used to, and it rotted
    // unnoticed: it printed tidal volumes that disagreed with the scene and
    // passed tone keys the TONES map did not define.

    case "reflex_arc": {
      const stimulus = STIMULI[params.stimulus] ? params.stimulus : "flame";
      const pathway = PATHWAYS[params.pathway] ? params.pathway : "intact";
      const slow = params.slowMotion !== false;
      const solved = solveReflex({ stimulus, pathway });
      const stim = STIMULI[stimulus];

      // The scene reports its clock: physiological ms since the finger met
      // the flame, which milestone the impulse is in (−1 between events, 5
      // once the chain is complete), and whether the biceps has been told to
      // contract. Everything else about the arc is the model's to say.
      const tMs = num(params.liveMs, 0);
      const stageIdx = num(params.liveStage, -1);
      const fired = Boolean(params.liveFired);
      const running = stageIdx >= 0;

      const milestoneRows = STAGES.map((stage, i) => {
        const st = solved.stages[i];
        const reached = st.reached && stageIdx >= i;
        const blocked = st.blocked && stageIdx >= i;
        const window = st.reached ? `${st.start.toFixed(1)}–${st.end.toFixed(1)} ms` : "never reached";
        const mark = reached ? (blocked ? "✕ stopped" : "✓") : st.reached ? "○" : "—";
        return [`${i + 1} · ${stage.label}`, `${mark} ${window}`, reached ? (blocked ? "bad" : "good") : st.reached ? undefined : "bad"];
      });

      const fibre = FIBRES[solved.sensoryFibre];

      readout = {
        title: "Reflex Arc Timing",
        subtitle: slow ? "slow-motion · 10× slowed" : "real-time playback",
        rows: [
          ["Stimulus", `${stim.short} · ${stim.skinC} °C`, stim.nociceptive ? "bad" : "gold"],
          ["Pain threshold", `${NOCICEPTOR_THRESHOLD_C} °C · ${stim.nociceptive ? "exceeded" : "below"}`, stim.nociceptive ? "warn" : "good"],
          ["Time since stimulus", running ? formatMs(tMs) : "— (between events)", running ? "gold" : undefined],
          ["Time to response", solved.fires ? formatMs(solved.responseMs) : "no response", solved.fires ? "good" : "bad"],
          ["Pathway", PATHWAYS[pathway].short, pathway === "intact" ? "good" : "bad"],
          ["Sensory fibre", `${fibre.label.split(" ")[0]} · ${fibre.velocity} m/s`, fibre.myelinated ? "good" : "warn"],
          ...milestoneRows,
          [
            "Biceps trigger",
            fired ? "⚡ FIRED · contracting" : solved.fires ? "armed · waiting" : "will not fire",
            fired ? "good" : solved.fires ? "warn" : "bad",
          ],
          [
            "Sensation (brain)",
            solved.sensationReachesBrain ? "felt · ~0.5 s later" : "nothing felt",
            solved.sensationReachesBrain ? "gold" : "bad",
          ],
        ],
        note:
          solved.reason === "dorsal"
            ? "The dorsal root is cut, so the impulse stops just past the ganglion and never enters the spinal cord. No relay neuron, no motor neuron, no withdrawal — and no sensation either, because the message to the brain used the same root."
            : solved.reason === "ventral"
              ? `The sensory side is intact: the impulse reaches the relay neuron at ${solved.stages[2].start.toFixed(1)} ms and the brain is informed — the pain IS felt. But the ventral root is cut, so the motor neuron's order never reaches the biceps and the hand stays in the flame.`
              : solved.reason === "threshold"
                ? `${stim.skinC} °C is below the ${NOCICEPTOR_THRESHOLD_C} °C heat-pain threshold. Warm receptors fire slowly along unmyelinated C fibres (${fibre.velocity} m/s — over ${Math.round(solved.stages[1].duration)} ms to reach the cord), the relay neuron passes the message up to the brain, but no motor neuron is recruited. You feel warmth; the arm stays where it is.`
                : `Receptor → sensory neuron → relay → motor neuron → biceps in ${solved.responseMs.toFixed(1)} ms. ${Math.round(solved.stages[1].duration)} ms of that is the impulse travelling ${(0.7 * 100).toFixed(0)} cm up the arm; the two synapses in the cord add only ${(solved.stages[2].duration).toFixed(1)} ms. The brain is told in parallel and finds out afterwards — the hand has moved before the pain is felt.`,
        noteTone: solved.fires ? "good" : solved.reason === "threshold" ? "neutral" : "bad",
      };

      legend = {
        title: "Reflex Arc Key",
        items: [
          { color: "#fbbf24", shape: "line", label: "Sensory (afferent) neuron", note: "Fingertip → dorsal root ganglion → dorsal horn" },
          { color: "#a78bfa", shape: "line", label: "Relay (inter) neuron", note: "Dorsal horn → ventral horn, inside the grey matter" },
          { color: "#38bdf8", shape: "line", label: "Motor (efferent) neuron", note: "Ventral horn → ventral root → biceps end plates" },
          { color: "#ffffff", shape: "dot", label: "Action potential", note: "The travelling impulse, with a fading trail" },
          { color: "#34d399", shape: "dot", label: "Synapse / end plate flash", note: "Neurotransmitter crossing the gap (~0.6 ms each)" },
          { color: "#fb7185", shape: "square", label: "Severed root · pain", note: "Where the impulse stops; the burn at the fingertip" },
          { color: "#ff5a6e", shape: "square", label: "Biceps brachii — effector", note: "Brightens and bulges as it contracts" },
          { color: "#fb923c", shape: "dot", label: "Candle flame", note: "≈ 80 °C at the tip; warm air above it ≈ 40 °C" },
          { color: "#64748b", shape: "dash", label: "Ascending path to the brain", note: "Sensation — slower, and not part of the arc" },
        ],
      };
      break;
    }

    case "antagonistic_muscles": {
      const target = num(params.elbowAngle, 90);
      const loadKg = num(params.load, 10);
      // The scene reports where the arm actually is, which way it is going,
      // and how fatigued the biceps is right now; the model does the rest.
      const fatigue = num(params.liveFatigue, 0);
      const motion = ["flexing", "extending", "holding"].includes(params.liveMotion) ? params.liveMotion : "holding";
      const liveAngle = num(params.liveAngle, target);
      const m = solveMuscles({ elbowAngle: target, loadKg, fatigue, motion });
      const pct = (v) => `${(v * 100).toFixed(2)}%`;
      const cm = (metres) => `${(metres * 100).toFixed(1)} cm`;
      const strainTone = (state) => (state === "safe" ? "good" : state === "high" ? "warn" : "bad");
      const ratio = m.loadWeightN > 1 ? m.biceps.force / m.loadWeightN : null;
      const hangingFree = !m.biceps.active && !m.triceps.active;

      readout = {
        title: "Antagonistic Pair at the Elbow",
        subtitle: "τ = F·d on both sides of the pivot",
        rows: [
          ["Elbow angle", m.sagging ? `${liveAngle}° (asked ${target}°)` : `${liveAngle}°`, m.sagging ? "bad" : "gold"],
          ["Motion", motion === "flexing" ? "flexing ↑ biceps" : motion === "extending" ? "extending ↓ triceps" : m.sagging ? "giving way" : "holding still", m.sagging ? "bad" : undefined],
          ["Biceps brachii", m.biceps.state === "contracted" ? "Contracted" : "Relaxed", m.biceps.state === "contracted" ? "gold" : undefined],
          ["Triceps brachii", m.triceps.state === "contracted" ? "Contracted" : "Relaxed", m.triceps.state === "contracted" ? "gold" : undefined],
          ["Biceps length · width", `${Math.round(m.biceps.lengthFraction * 100)}% · ×${m.biceps.bulge.toFixed(2)}`],
          ["Triceps length · width", `${Math.round(m.triceps.lengthFraction * 100)}% · ×${m.triceps.bulge.toFixed(2)}`],
          ["Load weight W", `${m.loadWeightN.toFixed(0)} N · ${loadKg} kg`],
          ["Lever arm d = L·sin θ", cm(m.leverArmM)],
          ["Torque τ = W·d", `${m.torque.toFixed(1)} N·m`, "gold"],
          ["Biceps moment arm", cm(m.biceps.momentArmM)],
          ["Biceps force τ ÷ d", `${m.biceps.force.toFixed(0)} N`, m.biceps.active ? "gold" : undefined],
          ["Force ratio F ÷ W", ratio ? `${ratio.toFixed(1)}×` : "—"],
          ["Biceps capacity · used", `${m.biceps.available.toFixed(0)} N · ${Math.round(m.biceps.utilisation * 100)}%`, m.biceps.utilisation > 0.95 ? "bad" : m.biceps.utilisation > 0.7 ? "warn" : "good"],
          ["Triceps force", `${m.triceps.force.toFixed(0)} N`],
          ["Biceps tendon strain", `${pct(m.biceps.tendonStrain)} · ${m.biceps.tendonState}`, strainTone(m.biceps.tendonState)],
          ["Triceps tendon strain", `${pct(m.triceps.tendonStrain)} · ${m.triceps.tendonState}`, strainTone(m.triceps.tendonState)],
          ["Fatigue · strength", fatigue > 0.01 ? `${Math.round(fatigue * 100)}% · ${Math.round(m.strengthPct)}%` : "none · 100%", fatigue > 0.5 ? "bad" : fatigue > 0.01 ? "warn" : "good"],
          ["Max load at this angle", `${maxHoldableLoad(liveAngle, fatigue).toFixed(1)} kg`],
        ],
        note: m.sagging
          ? `Fatigue: lactic acid has cut the biceps' peak force to ${Math.round(m.strengthPct)}%. Holding ${target}° with this load needs ${m.biceps.required.toFixed(0)} N, but only ${m.biceps.available.toFixed(0)} N is available, so the arm gives way to ${m.angle}° — where the smaller torque can be held. Strength returns as the acid is cleared.`
          : hangingFree
            ? "Arm hanging with nothing to hold: the load's line of action passes through the elbow, the torque is zero, and both muscles are relaxed. Neither one is doing anything — and neither could push even if it wanted to."
            : motion === "extending"
              ? "Extending: the triceps is the agonist now. It contracts and pulls on the olecranon behind the joint, while the biceps relaxes and is stretched. Neither muscle ever pushes — each can only pull its own way, which is why the pair is needed."
              : `Holding: the load's torque about the elbow is W × d = ${m.loadWeightN.toFixed(0)} × ${m.leverArmM.toFixed(3)} (plus the forearm's own weight) = ${m.torque.toFixed(1)} N·m. The biceps tendon pulls only ${cm(m.biceps.momentArmM)} from the pivot, so balancing it takes ${m.biceps.force.toFixed(0)} N — ${ratio ? ratio.toFixed(1) : "many"}× the weight in the hand.`,
        noteTone: m.sagging ? "bad" : motion === "extending" ? "neutral" : "good",
      };

      legend = {
        title: "Muscle & Lever Key",
        items: [
          { color: "#ff5a6e", shape: "square", label: "Contracted muscle", note: "Bright, short and swollen — pulling" },
          { color: "#9e3547", shape: "square", label: "Relaxed muscle", note: "Dark, long and thin — being stretched" },
          { color: "#6e2f66", shape: "square", label: "Fatigued muscle", note: "Purple tint and tremor after the trigger" },
          { color: "#f1f5f9", shape: "line", label: "Tendon", note: "Pearl → amber → rose as tensile strain climbs" },
          { color: "#e7e0cf", shape: "square", label: "Bone", note: "Scapula, humerus, radius, ulna, hand" },
          { color: "#fbbf24", shape: "dot", label: "Origin", note: "Fixed attachment on the scapula / humerus" },
          { color: "#34d399", shape: "dot", label: "Insertion", note: "Radial tuberosity (biceps), olecranon (triceps)" },
          { color: "#fb7185", shape: "line", label: "W — load weight", note: "Acts straight down at the hand" },
          { color: "#fb923c", shape: "line", label: "τ — joint torque", note: "The load's turning effect about the elbow" },
          { color: "#38bdf8", shape: "line", label: "θ — elbow angle", note: "0° extension → 145° flexion" },
        ],
      };
      break;
    }

    case "transpiration": {
      const light = num(params.light, 70);
      const humidity = num(params.humidity, 50);
      const wind = num(params.wind, 2);
      const soil = SOILS[params.soil] ? params.soil : "hydrated";
      const t = solveTranspiration({ light, humidity, wind, soil });
      const drought = soil === "drought";
      const tensionTone = t.columnState === "cavitation" ? "bad" : t.columnState === "strained" ? "warn" : "good";
      const rate = t.rateMlPerHour < 10 ? t.rateMlPerHour.toFixed(1) : Math.round(t.rateMlPerHour).toString();

      readout = {
        title: "Transpiration Stream",
        subtitle: `cohesion–tension · ${TREE_HEIGHT_M} m sapling · ${LEAF_AREA_M2} m² of leaf`,
        rows: [
          ["Transpiration rate", `${rate} mL/hr`, t.rateMlPerHour > 150 ? "warn" : t.rateMlPerHour > 5 ? "gold" : "bad"],
          ["Guard cells", t.poreOpen ? "Open pore · turgid" : "Closed pore · flaccid", t.poreOpen ? "good" : "bad"],
          ["Xylem tension", `−${t.tensionMPa.toFixed(2)} MPa · ${t.columnState}`, tensionTone],
          ["Stomatal aperture", `${Math.round(t.aperture * 100)} % · ${t.poreWidthUm.toFixed(1)} µm`, t.aperture >= OPEN_PORE_THRESHOLD ? "good" : "bad"],
          ["Guard-cell turgor", `${t.turgorMPa.toFixed(2)} MPa`, t.turgorMPa > 2.5 ? "good" : undefined],
          ["K⁺ uptake (light)", `${Math.round(t.kFraction * 100)} %${drought ? " · dumped (ABA)" : ""}`, drought ? "bad" : t.kFraction > 0.5 ? "gold" : undefined],
          ["Soil water potential", `${t.soilPsiMPa.toFixed(2)} MPa · ${t.soilLabel}`, drought ? "bad" : "good"],
          ["Vapour-pressure deficit", `${t.vpdKPa.toFixed(2)} kPa · RH ${humidity} %`, t.vpdKPa > 2 ? "warn" : undefined],
          ["Stomatal conductance", `${t.stomatalConductance.toFixed(3)} mol m⁻² s⁻¹`],
          ["Boundary-layer conductance", `${t.boundaryConductance.toFixed(2)} mol m⁻² s⁻¹ · ${wind === 0 ? "still" : `${wind} m/s`}`],
          ["Limited by", t.limitedBy, t.limitedBy === "stomata" ? "gold" : undefined],
          ["Sap velocity", `${t.sapCmPerHour < 10 ? t.sapCmPerHour.toFixed(1) : Math.round(t.sapCmPerHour)} cm/hr up the stem`],
          ["Cavitation threshold", `−${CAVITATION_TENSION_MPA.toFixed(1)} MPa`, t.columnState === "cavitation" ? "bad" : undefined],
        ],
        note:
          t.columnState === "cavitation"
            ? `The column is under −${t.tensionMPa.toFixed(2)} MPa: dry soil (Ψ ${t.soilPsiMPa} MPa) means the leaf has to pull that much harder just to get water in at the root, and even the ${Math.round(t.aperture * 100)} % that leaks past the ABA-closed stomata on a dry, windy day adds enough tension to snap the thread. An air bubble forms — an embolism — and that vessel is out of service.`
            : drought
              ? `Drought stress: the roots are sending abscisic acid up the xylem, the guard cells have dumped their K⁺ and water, and the pore is shut even at ${light} % light. Transpiration is down to ${rate} mL/hr — but notice the column is still under −${t.tensionMPa.toFixed(2)} MPa, because dry soil holds its water at −${(-t.soilPsiMPa).toFixed(1)} MPa and the leaf must be lower still.`
              : !t.poreOpen
                ? `Not enough light: without the K⁺ pumped in by light the guard cells stay flaccid, the pore is ${t.poreWidthUm.toFixed(1)} µm wide and the transpiration stream all but stops. The little that moves is leaking through the cuticle. The column relaxes to the −${t.tensionMPa.toFixed(2)} MPa it takes just to hold ${TREE_HEIGHT_M} m of water up.`
                : t.limitedBy === "boundary layer"
                  ? `The pore is open, but the air is still: a layer of saturated vapour sits against the leaf and vapour has to diffuse across it, so the boundary layer (${t.boundaryConductance.toFixed(2)} mol m⁻² s⁻¹), not the stomata (${t.stomatalConductance.toFixed(2)}), is the bottleneck. Add wind and watch the rate climb.`
                  : `Water evaporates from the mesophyll and leaves through the ${t.poreWidthUm.toFixed(1)} µm pore at ${rate} mL/hr, driven by a ${t.vpdKPa.toFixed(2)} kPa vapour-pressure deficit. That loss drags the column up the xylem at about ${Math.round(t.sapCmPerHour)} cm/hr and puts it under −${t.tensionMPa.toFixed(2)} MPa of tension — cohesion between water molecules is what lets a thread ${TREE_HEIGHT_M} m long be pulled without breaking.`,
        noteTone: t.columnState === "cavitation" ? "bad" : drought ? "warn" : !t.poreOpen ? "neutral" : "good",
      };

      legend = {
        title: "Pathway Key",
        items: [
          { color: "#38bdf8", shape: "dot", label: "Liquid water", note: "Soil → root hair → xylem → leaf; turns amber then rose as tension climbs" },
          { color: "#dbeafe", shape: "dot", label: "Water vapour", note: "Off the mesophyll walls, out through the stoma, away on the wind" },
          { color: "#e3d3ab", shape: "line", label: "Xylem vessel", note: "Dead, hollow, lignified — the rings are the thickening" },
          { color: "#8a5a3c", shape: "line", label: "Phloem", note: "Sugars going the other way (not part of the stream)" },
          { color: "#4fbf60", shape: "square", label: "Guard cells", note: "Kidney-shaped; bow apart when turgid to open the pore" },
          { color: "#fbbf24", shape: "dot", label: "K⁺ ions", note: "Pumped into guard cells by light; water follows by osmosis" },
          { color: "#93c5fd", shape: "square", label: "Boundary layer", note: "Humid still air under the leaf — thinner in wind" },
          { color: "#f8fafc", shape: "dot", label: "Embolism", note: "An air bubble where the column has cavitated" },
        ],
      };
      break;
    }

    case "peristalsis": {
      const consistency = CONSISTENCIES[params.consistency] ? params.consistency : "soft";
      const orientation = ORIENTATIONS[params.orientation] ? params.orientation : "upright";
      const p = solvePeristalsis({ consistency, orientation });
      // The scene reports its clock: which phase the swallow is in and where
      // the ring, the bolus and the relaxation zone are, in cm from the mouth.
      const phase = ["idle", "swallow", "transit", "delivered"].includes(params.livePhase) ? params.livePhase : "idle";
      const wave = params.liveWave === null || params.liveWave === undefined ? null : num(params.liveWave, 0);
      const bolus = params.liveBolus === null || params.liveBolus === undefined ? null : num(params.liveBolus, 0);
      const liveSpeed = num(params.liveSpeed, 0);
      const ahead = num(params.liveAhead, 0);
      const moving = phase === "transit";
      const relax = bolus === null ? null : Math.min(TUBE_LENGTH_CM, bolus + RELAXATION_LEAD_CM);
      const cm = (v) => (v === null ? "—" : `${v.toFixed(1)} cm`);
      const c = CONSISTENCIES[consistency];

      readout = {
        title: "Peristaltic Wave",
        subtitle: `${c.short} · ${ORIENTATIONS[orientation].short} · ${TUBE_LENGTH_CM} cm oesophagus`,
        rows: [
          ["Phase", phase === "idle" ? "waiting for a swallow" : phase === "swallow" ? "swallowing" : phase === "transit" ? "wave in transit" : "delivered to stomach", moving ? "gold" : phase === "delivered" ? "good" : undefined],
          ["Circular muscle wave", wave === null ? "—" : `${cm(wave)} · contracting behind bolus`, moving ? "bad" : undefined],
          ["Longitudinal relaxation zone", relax === null ? "—" : `${cm(relax)} · opening ahead of bolus`, moving ? "warn" : undefined],
          ["Bolus position", bolus === null ? "—" : `${cm(bolus)} from the mouth`, moving ? "gold" : undefined],
          ["Bolus transit speed", moving ? `${liveSpeed.toFixed(2)} cm/s` : "0.00 cm/s", moving ? "good" : undefined],
          ["Wave speed", `${p.waveSpeed.toFixed(2)} cm/s · ${c.short.toLowerCase()}`],
          ["Ring → bolus gap", `${CONSTRICTION_LAG_CM.toFixed(1)} cm${ahead > 0.05 ? ` + ${ahead.toFixed(1)} cm run-ahead` : ""}`, ahead > 0.05 ? "warn" : undefined],
          ["Gravity", p.gravityHelps ? "helping · right-side up" : "opposing · upside-down", p.gravityHelps ? undefined : "warn"],
          ["Gravity's contribution", p.gravitySlip > 0.01 ? `+${p.gravitySlip.toFixed(1)} cm/s (bolus runs ahead)` : "none — wave does all the work", p.gravitySlip > 0.01 ? "gold" : "good"],
          ["Transit time", `${p.transitTime.toFixed(1)} s`, "gold"],
          ["…by the wave alone", `${p.transitTimeNoGravity.toFixed(1)} s`],
          ["Bolus vs lumen", p.lumenFit === "fits" ? "fits · takes the tube's shape" : "wider · wall stretches round it", p.lumenFit === "fits" ? "good" : "warn"],
        ],
        note:
          orientation === "inverted"
            ? `Upside-down, gravity is pulling the bolus back towards the mouth — and it still arrives, in ${p.transitTime.toFixed(1)} s, at exactly the wave's ${p.waveSpeed.toFixed(1)} cm/s. The ring of contracted circular muscle behind it is a closed door; the relaxed, widened segment ahead is an open one. Nothing about that needs "down".`
            : consistency === "liquid"
              ? `Right-side up, water pours ahead of the wave — gravity adds about ${p.gravitySlip.toFixed(1)} cm/s and it arrives in ${p.transitTime.toFixed(1)} s instead of ${p.transitTimeNoGravity.toFixed(1)} s. Flip the tube over and the gap closes: the liquid pools against the ring and rides it down at the wave's own speed.`
              : consistency === "dry"
                ? `A dry bolus is wider than the resting lumen and will not take its shape, so the wall has to stretch round it. Stretch receptors in the wall recruit stronger, slower contractions — the wave drops to ${p.waveSpeed.toFixed(1)} cm/s and transit takes ${p.transitTime.toFixed(1)} s. Gravity makes no difference to a lump that has to be pushed.`
                : `Circular muscle contracts BEHIND the bolus (the ring ${CONSTRICTION_LAG_CM.toFixed(1)} cm back, lumen closed), longitudinal muscle contracts AHEAD of it (the segment ${RELAXATION_LEAD_CM.toFixed(1)} cm forward shortens and widens, circular muscle there relaxes). The wave moves at ${p.waveSpeed.toFixed(1)} cm/s and the bolus goes with it; gravity only adds a little slip to a soft bolus.`,
        noteTone: orientation === "inverted" ? "good" : "neutral",
      };

      legend = {
        title: "Gut Wall Key",
        items: [
          { color: "#ff5a6e", shape: "dot", label: "Circular muscle — contracting", note: "Rings fatten, flush and close the lumen behind the bolus" },
          { color: "#8e3a48", shape: "dot", label: "Circular muscle — relaxed", note: "Dark, thin rings elsewhere" },
          { color: "#fbbf24", shape: "line", label: "Longitudinal muscle — contracting", note: "Fibres brighten ahead of the bolus; the segment shortens and widens" },
          { color: "#8a5a2a", shape: "line", label: "Longitudinal muscle — relaxed", note: "Dull fibres along the outside of the wall" },
          { color: "#f4b8c1", shape: "square", label: "Mucosa · lumen", note: "The glassy lining you see the bolus through" },
          { color: "#c9a26b", shape: "dot", label: "Bolus", note: "Chewed food — or water, or a dry lump" },
          { color: "#64748b", shape: "line", label: "g — gravity", note: "Fixed to the world; the tube flips, the arrow does not" },
        ],
      };
      break;
    }

    case "carbon_cycle": {
      const combustion = num(params.combustion, 100);
      const forest = num(params.forest, BASELINE_FOREST_PCT);
      const solar = num(params.solar, 50);
      const longwave = Boolean(params.longwave);
      // The scene owns the clock; it reports the atmosphere's state ten times a second.
      const state = {
        year: num(params.liveYear, 0),
        ppm: num(params.livePpm, PRESENT_PPM),
        oceanPpm: num(params.liveOceanPpm, OCEAN_BASELINE_PPM),
        anomaly: num(params.liveAnomaly, PRESENT_ANOMALY_C),
        fossilBurned: num(params.liveFossil, 0),
        landStored: num(params.liveLand, 0),
        oceanStored: num(params.liveOcean, 0),
      };
      const c = solveCarbon(state, { combustion, forest, solar });
      const sign = (v, digits = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;
      const bandTone = c.band === "safe" ? "good" : c.band === "present" ? "gold" : c.band === "elevated" ? "warn" : "bad";
      const anomalyTone = c.anomaly < 1.5 ? "gold" : c.anomaly < 2.5 ? "warn" : "bad";
      const netTone = c.net > 0.5 ? "bad" : c.net < -0.5 ? "good" : "gold";

      readout = {
        title: "Carbon Cycle & Greenhouse",
        subtitle: `year ${c.year.toFixed(0)} · combustion ${combustion} % · forest ${forest} % · ${solarLabel(solar)}`,
        rows: [
          ["Atmospheric CO₂", `${Math.round(c.ppm)} ppm · ${c.band}`, bandTone],
          ["CO₂ trend", `${sign(c.ppmPerYear)} ppm/yr · ${c.trend}`, c.ppmPerYear > 0.2 ? "bad" : c.ppmPerYear < -0.2 ? "good" : "gold"],
          ["Global mean temperature anomaly", `${sign(c.anomaly, 2)} °C vs pre-industrial`, anomalyTone],
          ["Equilibrium warming", `${sign(c.equilibriumAnomaly, 2)} °C · ${sign(c.committedWarming, 2)} °C in the pipeline`, c.committedWarming > 0.3 ? "warn" : undefined],
          ["Carbon pool exchange balance", `${sign(c.net)} GtC/yr to the atmosphere`, netTone],
          ["…photosynthesis", `−${c.photosynthesis.toFixed(1)} GtC/yr (air → plants)`, "good"],
          ["…respiration & decay", `+${c.respiration.toFixed(1)} GtC/yr (plants, animals, soil → air)`],
          ["…net land sink", `${sign(-c.landNet)} GtC/yr`, c.landNet > 0 ? "good" : "bad"],
          ["…fossil combustion", `+${c.combustion.toFixed(1)} GtC/yr`, c.combustion > 0 ? "bad" : "good"],
          ["…land use & livestock", `+${c.landUse.toFixed(2)} GtC/yr · ${Math.round(c.pasture * 100)} % pasture`, c.landUse > 0.5 ? "warn" : undefined],
          ["…ocean net uptake", `${sign(-c.oceanUptake)} GtC/yr · surface at ${Math.round(c.oceanPpm)} ppm-eq`, c.oceanUptake > 0 ? "good" : "bad"],
          ["Ocean surface pH", `${c.pH.toFixed(2)}`, c.pH < 8.0 ? "warn" : undefined],
          ["Radiative forcing", `${sign(c.forcing.total, 2)} W/m² · CO₂ ${sign(c.forcing.co2, 2)} · CH₄ ${sign(c.forcing.methane, 2)} · solar ${sign(c.forcing.solar, 2)}`],
          ["CO₂ doublings since 280 ppm", `${c.doublings.toFixed(2)} × 3 °C each`],
          ["Longwave IR trapped", `${Math.round(c.opacity * 100)} % of outgoing photons absorbed`, c.opacity > 0.8 ? "bad" : undefined],
          ["Photon filter", longwave ? "longwave infrared · re-radiated by the ground · absorbed by CO₂/CH₄" : "shortwave visible · from the Sun · passes through, 30 % reflected"],
          ["Fossil carbon burned", `${c.fossilBurned.toFixed(0)} GtC since year 0`],
          ["Atmosphere holds", `${Math.round(c.ppm * GTC_PER_PPM)} GtC · ${sign((c.ppm - PREINDUSTRIAL_PPM) * GTC_PER_PPM, 0)} GtC vs pre-industrial`],
        ],
        note:
          c.band === "extreme"
            ? `${Math.round(c.ppm)} ppm is ${c.doublings.toFixed(1)} doublings of the pre-industrial 280 ppm. Because CO₂ forcing is logarithmic each doubling adds the same ~3 °C at equilibrium, so the surface is heading for ${sign(c.equilibriumAnomaly, 1)} °C — it reads ${sign(c.anomaly, 1)} °C now only because the ocean takes ~${OCEAN_THERMAL_LAG_YEARS} years to catch up. The ocean is dissolving ${c.oceanUptake.toFixed(1)} GtC/yr and its pH has fallen to ${c.pH.toFixed(2)}.`
            : c.net < -0.5
              ? `The atmosphere is draining at ${Math.abs(c.ppmPerYear).toFixed(1)} ppm/yr: with ${c.combustion.toFixed(1)} GtC/yr of combustion and ${Math.round(forest)} % forest, the land sink (${c.landNet.toFixed(1)} GtC/yr) and ocean (${c.oceanUptake.toFixed(1)} GtC/yr) take out more than goes in. Notice the sinks shrink as CO₂ falls — at 280 ppm the land and sea are in balance with the air and stop absorbing — and that the temperature lags on the way down as well as up.`
              : combustion >= 300
                ? `At ${combustion} % the furnaces are adding ${c.combustion.toFixed(1)} GtC/yr from OUTSIDE the natural loop. Photosynthesis still removes ${c.photosynthesis.toFixed(0)} GtC/yr, but respiration returns ${c.respiration.toFixed(0)}, so the land keeps only ${c.landNet.toFixed(1)} and the ocean ${c.oceanUptake.toFixed(1)}. The rest — ${c.net.toFixed(1)} GtC/yr — stays in the air: ${sign(c.ppmPerYear)} ppm/yr.`
                : forest <= 25
                  ? `With only ${forest} % forest the land sink has collapsed to ${c.landNet.toFixed(1)} GtC/yr, cleared land and cattle add ${c.landUse.toFixed(1)} GtC/yr and ${c.forcing.methane.toFixed(2)} W/m² of methane forcing, and the greenhouse layer now absorbs ${Math.round(c.opacity * 100)} % of the outgoing infrared. Deforestation is a double loss: a sink removed and a source created.`
                  : `The loop is nearly closed: photosynthesis takes ${c.photosynthesis.toFixed(0)} GtC/yr out of the air and respiration puts ${c.respiration.toFixed(0)} back, so the land keeps just ${c.landNet.toFixed(1)}. Fossil fuel (${c.combustion.toFixed(1)} GtC/yr) and land use (${c.landUse.toFixed(1)}) are additions from outside that loop, and only about half is soaked up — ${sign(c.net)} GtC/yr stays in the air, ${sign(c.ppmPerYear)} ppm/yr. The temperature keeps climbing towards ${sign(c.equilibriumAnomaly, 1)} °C even with the dials still, because the ocean has not yet caught up with the forcing already in place.`,
        noteTone: c.band === "extreme" ? "bad" : c.net < -0.5 ? "good" : combustion >= 300 || forest <= 25 ? "warn" : "neutral",
      };

      legend = {
        title: "Carbon & Light Key",
        items: [
          { color: "#34d399", shape: "dot", label: "Photosynthesis", note: "CO₂ from the air into the forest canopy" },
          { color: "#f59e0b", shape: "dot", label: "Respiration & decay", note: "Carbon from living things back into the air" },
          { color: "#94a3b8", shape: "dot", label: "Combustion", note: "Fossil carbon up the coal plant's stacks" },
          { color: "#a78bfa", shape: "dot", label: "Land use & methane", note: "Cleared pasture and its cattle" },
          { color: "#38bdf8", shape: "dot", label: "Ocean uptake", note: "Dissolving into the sea; turns rose if the sea outgasses" },
          { color: "#e2e8f0", shape: "dot", label: "CO₂ molecules", note: "The greenhouse layer — more of them as ppm climbs" },
          { color: "#fde047", shape: "dot", label: "Shortwave photon", note: "Sunlight; passes through the air, 30 % bounces off the ground" },
          { color: "#fb7185", shape: "dot", label: "Longwave photon", note: "Infrared re-radiated by the warm ground" },
          { color: "#f97316", shape: "dot", label: "Trapped photon", note: "Absorbed by CO₂/CH₄ and re-emitted — half of them back down" },
          { color: "#fbbf24", shape: "square", label: "Net to atmosphere", note: "The accented column on the chart: sources minus sinks" },
        ],
      };
      break;
    }

    case "food_chain_pyramid": {
      const insolation = num(params.insolation, 100);
      const toxinDoses = num(params.toxin, 0);
      const cascadePresses = num(params.cascade, 0);
      const p = solveFoodChain({ insolation, toxinDoses, cascadePresses });
      const [leaves, caterpillars, tits, hawk] = p.tiers;
      const kj = (v) => (v >= 1000 ? `${Math.round(v).toLocaleString()} kJ` : v >= 10 ? `${Math.round(v)} kJ` : `${v.toFixed(1)} kJ`);
      const ppm = (v) => (v === 0 ? "0 ppm" : v < 1 ? `${v.toFixed(2)} ppm` : `${v.toFixed(1)} ppm`);
      const toxinTone = (t) => (t.toxinStatus === "lethal" ? "bad" : t.toxinStatus === "harmed" ? "warn" : t.toxinStatus === "trace" ? "gold" : undefined);
      const tierRows = p.tiers.flatMap((t) => [
        [
          `${t.label} · energy`,
          t.level === 0
            ? `${kj(t.energyKJ)} stored${t.cascade !== 1 ? ` (×${t.cascade}, cascade)` : ""} · fixed by photosynthesis`
            : `${kj(t.energyKJ)} stored${t.cascade !== 1 && t.energyKJ > 0 ? ` (×${t.cascade}, cascade)` : ""} · flow ${kj(t.intactKJ)} of ${kj(t.receivedKJ)} received, ${kj(t.lostKJ)} lost`,
          t.energyKJ > 0 ? "gold" : "bad",
        ],
        [`${t.organism} · population`, t.population > 0 ? `${t.population.toLocaleString()} ${t.population === 1 ? t.singular : t.plural}${t.cascade !== 1 && t.population > 0 ? ` · ×${t.cascade} cascade` : ""}` : t.removed ? "0 · removed" : `0 · ${kj(t.intactKJ)} cannot feed one (needs ${t.kjPerIndividual} kJ)`, t.population > 0 ? undefined : "bad"],
        [`${t.organism} · toxin in fat`, `${ppm(t.toxinPpm)} · ${t.toxinLabel}`, toxinTone(t)],
      ]);

      readout = {
        title: "Energy Pyramid",
        subtitle: `${insolation} % insolation · ${p.doses} toxin dose${p.doses === 1 ? "" : "s"} · apex ${p.apexRemoved ? (p.apexPoisoned ? "poisoned" : "removed") : "present"}`,
        rows: [
          ["Transfer efficiency", `${Math.round(TRANSFER_EFFICIENCY * 100)} % per link · ${Math.round((1 - TRANSFER_EFFICIENCY) * 100)} % lost`, "gold"],
          ["Chain length", `${p.chainLength} of ${TIERS.length} links viable`, p.chainLength === TIERS.length ? "good" : "warn"],
          ...tierRows,
          ["A fifth link?", `${NEXT_LINK.organism} would receive ${kj(p.nextLink.energyKJ)} · needs ${NEXT_LINK.kjPerIndividual} kJ · ${p.nextLink.viable ? "viable" : "not viable"}`, p.nextLink.viable ? "good" : "bad"],
          ["Total lost as heat & waste", `${kj(p.totalLostKJ)} of ${kj(p.producerKJ)}`],
          // C36: with the apex gone these transfers describe a chain that is
          // still rearranging, so the panel says so rather than presenting
          // them as the steady 10 % ladder above.
          ...(p.apexRemoved
            ? [[
                "Equilibrium",
                `out of balance — ${p.tiers.filter((t) => t.gaining).map((t) => t.organism).join(" and ")} released, so the transfers above are not the steady 10 % ladder`,
                "warn",
              ]]
            : []),
          ["Apex share of producers' energy", `${(p.apexShare * 100).toFixed(1)} %`],
          ["Biomagnification", `×${TOXIN_MAGNIFICATION} per link · harm ≥ ${TOXIN_HARM_PPM} ppm · lethal ≥ ${TOXIN_LETHAL_PPM} ppm`, p.doses > 0 ? "warn" : undefined],
        ],
        note:
          p.apexPoisoned
            ? `${p.doses} sprays at ${(p.doses * 0.01).toFixed(2)} ppm on the leaves have become ${ppm(hawk.toxinPpm)} in the sparrowhawk — above the ${TOXIN_LETHAL_PPM} ppm lethal dose. The toxin was never lost with the 90 % of energy at each link: every kilojoule of hawk was ten of blue tit, and the poison in all ten came with it. With the hawk gone the blue tits have boomed to ${tits.population}, the caterpillars are eaten down to ${caterpillars.population.toLocaleString()}, and the leaves recover — a trophic cascade started by a trace.`
            : p.apexRemoved
              ? `Remove the apex predator and the chain rearranges itself. Blue tits, no longer hunted, rise ×${tits.cascade} to ${tits.population}; they eat the caterpillars down ×${caterpillars.cascade} to ${caterpillars.population.toLocaleString()}; with fewer caterpillars the oak keeps ×${leaves.cascade} more of its leaves. The energy entering the pyramid has not changed — only where it sits. Press again to reintroduce the hawk.`
              : !hawk.viable
                ? `At ${insolation} % insolation the leaves fix only ${kj(leaves.energyKJ)}, so by the fourth link there is ${kj(hawk.intactKJ)} — less than the ${hawk.kjPerIndividual} kJ one sparrowhawk needs. The apex predator is the first to go when the base shrinks, because it lives on ${(p.apexShare * 100).toFixed(1)} % of what the producers captured.`
                : p.doses > 0
                  ? `One spray of ${(p.doses * 0.01).toFixed(2)} ppm is harmless on the leaves, ${ppm(caterpillars.toxinPpm)} in the caterpillars, ${ppm(tits.toxinPpm)} in the blue tits and ${ppm(hawk.toxinPpm)} in the sparrowhawk — ${hawk.toxinLabel}. The concentration climbs ×${TOXIN_MAGNIFICATION} per link because the energy falls ÷${TOXIN_MAGNIFICATION} per link while the persistent toxin is kept. ${hawk.toxinStatus === "harmed" ? `Birds of prey above ${TOXIN_HARM_PPM} ppm lay thin-shelled eggs that break; ${Math.ceil(TOXIN_LETHAL_PPM / (hawk.toxinPpm / p.doses)) - p.doses} more spray${Math.ceil(TOXIN_LETHAL_PPM / (hawk.toxinPpm / p.doses)) - p.doses === 1 ? "" : "s"} would kill it.` : ""}`
                  : `The leaves store ${kj(leaves.energyKJ)}; the caterpillars that eat them store ${kj(caterpillars.energyKJ)}; the blue tits ${kj(tits.energyKJ)}; the sparrowhawk ${kj(hawk.energyKJ)}. Ninety per cent goes at every link — respired as heat, spent moving and keeping warm, left uneaten or passed undigested — which is why ${leaves.population.toLocaleString()} leaves end up as ${hawk.population} hawk, and why a fifth link, offered ${kj(p.nextLink.energyKJ)}, cannot exist.`,
        noteTone: p.apexPoisoned ? "bad" : p.apexRemoved || !hawk.viable || hawk.toxinStatus === "harmed" ? "warn" : "neutral",
      };

      legend = {
        title: "Pyramid Key",
        items: [
          { color: "#34d399", shape: "square", label: "Producers · oak leaves", note: "Fix the Sun's energy by photosynthesis" },
          { color: "#a3e635", shape: "square", label: "Primary consumers · caterpillars", note: "Herbivores" },
          { color: "#38bdf8", shape: "square", label: "Secondary consumers · blue tits", note: "Insectivores" },
          { color: "#fbbf24", shape: "square", label: "Apex predator · sparrowhawk", note: "Nothing eats it" },
          { color: "#fbbf24", shape: "dot", label: "Energy passed on", note: "The 10 % climbing to the next slab" },
          { color: "#fb7185", shape: "dot", label: "Energy lost", note: "The 90 % pouring off the side as heat and waste" },
          { color: "#fde047", shape: "dot", label: "Sunlight", note: "Falling on the leaves; brighter with insolation" },
          { color: "#d946ef", shape: "dot", label: "Toxin", note: "Slabs flush violet as concentration climbs; grey organisms are dead" },
          { color: "#94a3b8", shape: "dash", label: "Fifth link", note: "The dashed slab that cannot be fed" },
        ],
      };
      break;
    }

    case "flower_pollination": {
      // The time slider IS the clock: the scene pushes the playing time into it.
      const time = num(params.time, 0);
      const f = describePollination(time, params.vector);
      const v = f.vector;
      const pct = (x) => (x === null || x === undefined ? "—" : `${Math.round(Math.min(1, x) * 100)} % of the way down the style`);
      const stageIndex = POLLINATION_TIMELINE.byKey[f.stage]?.index ?? 0;
      const tubeTone = f.entered ? "good" : f.tubeMm > 0 ? "gold" : undefined;

      readout = {
        title: "Pollination & Fertilisation",
        subtitle: `${v.label} · ${f.status}`,
        rows: [
          ["Stage", f.started ? `${stageIndex + 1} / ${POLLINATION_TIMELINE.stages.length} · ${f.label}` : "waiting — press Trigger pollination", f.complete ? "good" : f.started ? "gold" : undefined],
          ["Pollinated?", f.pollinated ? "yes — a grain is on the stigma" : "no — nothing on the stigma yet", f.pollinated ? "good" : "bad"],
          ["Fertilised?", f.fertilised ? "yes — nuclei fused in the ovule" : f.zygoteFormed ? "half — zygote formed, endosperm next" : "no — no nuclei have fused", f.fertilised ? "good" : f.zygoteFormed ? "warn" : "bad"],
          ["Hours after pollination", f.pollinated ? `${f.hoursAfterPollination.toFixed(1)} h` : "—"],
          ["Pollen tube length", `${f.tubeMm.toFixed(1)} mm of ${STYLE_LENGTH_MM} mm style · ${Math.round(Math.min(1, f.tubeFraction) * 100)} %`, tubeTone],
          ["Growth rate", f.growthRateMmPerH > 0 ? `${f.growthRateMmPerH.toFixed(1)} mm/h` : f.entered ? "arrived — inside the ovule" : "0 mm/h", f.growthRateMmPerH > 0 ? "gold" : undefined],
          ["Tube nucleus", pct(f.nuclei.tube), f.nuclei.tube !== null ? "gold" : undefined],
          ["Generative nucleus", f.nuclei.generative !== null ? `${pct(f.nuclei.generative)} · not yet divided` : f.nuclei.divided ? `divided at ${Math.round(GENERATIVE_DIVISION_FRACTION * 100)} % into two sperm nuclei (n)` : "—", f.nuclei.divided ? "good" : undefined],
          ["Sperm nucleus 1", f.nuclei.sperm1 !== null ? pct(f.nuclei.sperm1) : f.zygoteFormed ? "fused with the egg cell → zygote (2n)" : "—", f.zygoteFormed ? "good" : undefined],
          ["Sperm nucleus 2", f.nuclei.sperm2 !== null ? pct(f.nuclei.sperm2) : f.endospermFormed ? "fused with the 2 polar nuclei → endosperm (3n)" : "—", f.endospermFormed ? "good" : undefined],
          ["Zygote", f.zygoteFormed ? `formed · ${f.ploidy.zygote} · sperm (n) + egg (n)` : `not yet · egg cell waiting (${f.ploidy.egg})`, f.zygoteFormed ? "good" : undefined],
          ["Endosperm", f.endospermFormed ? `formed · ${f.ploidy.endosperm} · sperm (n) + polar nuclei (${f.ploidy.polarNuclei})` : `not yet · 2 polar nuclei waiting (${f.ploidy.polarNuclei})`, f.endospermFormed ? "good" : undefined],
          ["Pollen", `${v.pollen.surface} · ${v.pollen.size} · ${v.pollen.amount}`],
          ["Stigma", v.stigma],
          ["Anthers", v.anthers],
          ["Petals", v.petals],
          ["Nectar & scent", v.nectar ? "yes — the reward that pays the courier" : "none — the wind cannot be paid", v.nectar ? "gold" : undefined],
          ["Examples", v.examples],
        ],
        note:
          !f.started
            ? `Press Trigger pollination and ${v.key === "wind" ? "a gust carries a cloud of light, smooth grains past the feathery stigma" : "a bee visits the anther and then the sticky stigma"}. Watch for two separate events: the moment a grain lands (pollination) and, hours later, the moment nuclei fuse in the ovule (fertilisation). The time slider is the same clock — drag it to scrub.`
            : !f.pollinated
              ? `${v.key === "wind" ? "The air is full of grains; the feathery stigma is a sieve, and one will catch." : "The bee has picked up spiky pollen at the anther and is heading for the stigma."} Until a grain is on the stigma the flower is not even pollinated — and pollination on its own fertilises nothing.`
              : !f.germinated
                ? "A grain is on the stigma: the flower is POLLINATED. That is all that has happened. The grain now takes up water and sugars from the stigma and begins to grow a tube; the egg cell in the ovule is untouched and the flower is not fertilised."
                : !f.entered
                  ? `The pollen tube is ${f.tubeMm.toFixed(1)} mm down the ${STYLE_LENGTH_MM} mm style, growing at ${TUBE_GROWTH_MM_PER_H} mm/h — ${f.hoursAfterPollination.toFixed(1)} h since landing. ${f.nuclei.divided ? "The generative nucleus has divided: two sperm nuclei (n) now follow the tube nucleus towards the ovary." : "The tube nucleus leads; the generative nucleus behind it will divide into two sperm on the way."} Still pollinated, still not fertilised.`
                  : !f.fertilised
                    ? `The tube has entered the ovule through the micropyle and delivered both sperm nuclei into the embryo sac. ${f.zygoteFormed ? "The first has fused with the egg cell: the zygote (2n) exists — the flower is fertilised. The second is about to fuse with the two polar nuclei." : "Fertilisation is about to happen: the first sperm nucleus is fusing with the egg cell."}`
                    : `Double fertilisation is complete: sperm + egg → zygote (2n), which will become the embryo; sperm + two polar nuclei → endosperm (3n), the seed's food store. Pollination happened ${f.hoursAfterPollination.toFixed(1)} h ago and a centimetre away — the two events are different things.`,
        noteTone: f.fertilised ? "good" : f.pollinated ? "warn" : "neutral",
      };

      legend = {
        title: "Flower Key",
        items: [
          { color: v.key === "insect" ? "#f472b6" : "#8fae74", shape: "square", label: "Petals", note: v.key === "insect" ? "Large and bright — an advertisement" : "Small and dull — no visitor to attract" },
          { color: "#f5c518", shape: "square", label: "Anther (on its filament)", note: "Makes the pollen · anther + filament = stamen" },
          { color: v.key === "insect" ? "#fbbf24" : "#fde68a", shape: "dot", label: "Pollen grain", note: v.key === "insect" ? "Spiky, sticky — clings to the bee" : "Smooth, light — rides the wind" },
          { color: "#a3e635", shape: "square", label: "Stigma", note: v.key === "insect" ? "Sticky knob inside the flower" : "Feathery sieve held out in the air" },
          { color: "#c7e8a8", shape: "line", label: "Style", note: "The tube grows down its middle" },
          { color: "#86c96b", shape: "square", label: "Ovary (cut open) with ovules", note: "Stigma + style + ovary = carpel" },
          { color: "#fcd34d", shape: "line", label: "Pollen tube", note: "Grows ~1.5 mm/h towards the micropyle" },
          { color: "#38bdf8", shape: "dot", label: "Tube nucleus", note: "Leads the growing tip" },
          { color: "#a78bfa", shape: "dot", label: "Generative nucleus / polar nuclei", note: "Divides into 2 sperm · 2 polar nuclei await the second" },
          { color: "#fb7185", shape: "dot", label: "Sperm nuclei (n) / egg cell (n)", note: "Sperm + egg → zygote" },
          { color: "#fbbf24", shape: "dot", label: "Zygote (2n)", note: "Gold once fertilised" },
          { color: "#c084fc", shape: "dot", label: "Endosperm (3n)", note: "The seed's food store" },
        ],
      };
      break;
    }

    case "bacteria_vs_virus": {
      const infection = describeInfection(num(params.liveLyticT, 0));
      const drug = describeAntibiotic(num(params.liveAntibioticT, 0));
      const host = hostStatus(infection, drug);
      const bact = classify("bacterium");
      const virus = classify("virus");
      const effB = antibioticEfficacy("bacterium");
      const effV = antibioticEfficacy("virus");
      const tick = (yes) => (yes ? "✓" : "✗");
      const lyticIndex = LYTIC_TIMELINE.byKey[infection.stage]?.index ?? 0;
      const drugIndex = ANTIBIOTIC_TIMELINE.byKey[drug.stage]?.index ?? 0;

      readout = {
        title: "Bacterium vs Virus",
        subtitle: `host cell: ${host.label}`,
        rows: [
          ["Living-vs-non-living checklist", `bacterium ${bact.met}/${bact.total} · virus ${virus.met}/${virus.total}`, "gold"],
          ...LIVING_CRITERIA.map((c) => [`…${c.label}`, `bacterium ${tick(c.bacterium)} · virus ${tick(c.virus)}`, c.virus ? undefined : "warn"]),
          ["Verdict", `bacterium: ${bact.verdict} · virus: ${virus.verdict}`],
          ["Antibiotic efficacy — bacterium", `${effB.percent} % · ${effB.drug} → ${effB.target}`, "good"],
          ["Antibiotic efficacy — virus", `${effV.percent} % · ${effV.reason}`, "bad"],
          ...ANTIBIOTIC_TARGETS.map((t) => [`…${t.drug}`, `${t.target} — bacterium ✓ · virus ✗`]),
          ["Penicillin event", drug.started ? `${drugIndex + 1} / ${ANTIBIOTIC_TIMELINE.stages.length} · ${drug.label}` : "not administered", drug.lysed ? "bad" : drug.started ? "warn" : undefined],
          ["Peptidoglycan wall", `${Math.round(drug.wallIntegrity * 100)} % intact${drug.swelling > 0 ? ` · swelling ${Math.round(drug.swelling * 100)} %` : ""}`, drug.wallIntegrity < 0.5 ? "bad" : drug.wallIntegrity < 1 ? "warn" : "good"],
          ["Lytic cycle", infection.started ? `${lyticIndex + 1} / ${LYTIC_TIMELINE.stages.length} · ${infection.label}` : "not triggered", infection.lysed ? "bad" : infection.started ? "gold" : undefined],
          ["Phage attached", infection.attached ? "yes — baseplate docked, sheath contracting" : infection.started ? `${Math.round(infection.attachment * 100)} % — tail fibres searching for receptors` : "no"],
          ["Genome injected", `${Math.round(infection.genomeInjected * 100)} %`, infection.injected ? "warn" : undefined],
          ["Host DNA intact", `${Math.round(infection.hostDnaIntact * 100)} %`, infection.hostDnaIntact < 0.5 ? "bad" : undefined],
          ["Ribosomes", infection.takeover > 0 ? `${Math.round(infection.takeover * 100)} % making phage proteins` : "making the bacterium's own proteins"],
          ["Progeny virus burst-size counter", `${infection.virionsAssembled} assembled · ${infection.released} released · burst size ${BURST_SIZE}`, infection.released > 0 ? "bad" : infection.virionsAssembled > 0 ? "warn" : undefined],
          ["Size", `bacterium 2 µm · phage 200 nm · ~${SIZE_RATIO}× (drawn ~3×)`],
        ],
        note:
          drug.lysed
            ? `Penicillin blocked the enzyme that cross-links the peptidoglycan; with no wall to hold it in, the bacterium's own osmotic pressure pulled water in until it burst. The T4 phage next door has no wall, no ribosomes and no metabolism — it is a protein coat round DNA — so the same drug fell straight past it. That is the whole reason antibiotics cure bacterial infections and do nothing for viral ones.`
            : drug.started
              ? `Penicillin is binding the wall-building enzymes; every time the bacterium tries to grow or repair its wall a cross-link fails. The lattice is ${Math.round(drug.wallIntegrity * 100)} % intact and the cell is starting to swell. Nothing is happening to the phage: there is no target in it.`
              : infection.lysed
                ? `Lysis: the phage's lysozyme has broken the wall from inside and ${infection.released} new phages have escaped to find their own hosts. A virus reproduces only by hijacking a cell — it has no ribosomes or metabolism of its own — which is exactly why an antibiotic aimed at ribosomes or walls cannot touch it.`
                : infection.stage === "assembly"
                  ? `The host's ribosomes are now making only phage proteins; ${infection.virionsAssembled} of ~${BURST_SIZE} new virions have been assembled from capsids, sheaths and fibres, each packed with a copy of the phage DNA. The bacterium is still intact — for the moment.`
                  : infection.injected
                    ? `The phage DNA is inside and the host chromosome is being degraded (${Math.round(infection.hostDnaIntact * 100)} % left). From here the bacterium's ribosomes work for the virus. Notice the phage brought nothing but instructions — everything else is borrowed.`
                    : infection.started
                      ? "The tail fibres recognise receptor molecules on this bacterium's wall — a phage is specific to its host. The baseplate docks, then the sheath contracts like a syringe to drive the core through the wall."
                      : `Two specimens: a bacterium that meets all ${bact.total} criteria for life, and a T4 phage that meets ${virus.met} (it has genes and its populations evolve) but is not a cell and cannot do anything on its own. Administer penicillin to see which one has a wall to lose, or trigger the lytic cycle to see how a virus reproduces.`,
        noteTone: drug.lysed || infection.lysed ? "bad" : drug.started || infection.started ? "warn" : "neutral",
      };

      legend = {
        title: "Anatomy Key",
        items: [
          { color: "#f5deb3", shape: "line", label: "Peptidoglycan wall lattice", note: "Penicillin's target — struts vanish as cross-links fail" },
          { color: "#f9a8d4", shape: "square", label: "Cell membrane", note: "Inside the wall" },
          { color: "#7dd3fc", shape: "square", label: "Cytoplasm", note: "Where the bacterium's metabolism runs" },
          { color: "#818cf8", shape: "dot", label: "Circular chromosome & fragments", note: "Degraded during host takeover" },
          { color: "#c084fc", shape: "dot", label: "Plasmid", note: "Extra DNA ring — resistance genes ride here" },
          { color: "#fde68a", shape: "dot", label: "70S ribosomes", note: "Turn violet when the phage genes take them over" },
          { color: "#e2e8f0", shape: "line", label: "Flagellum", note: "A rotating motor" },
          { color: "#93c5fd", shape: "square", label: "Phage capsid head", note: "Protein — not a cell" },
          { color: "#f472b6", shape: "dot", label: "Phage DNA", note: "Drains from the head into the host" },
          { color: "#a5b4fc", shape: "line", label: "Contractile sheath · baseplate · fibres", note: "The syringe" },
          { color: "#bfdbfe", shape: "dot", label: "Progeny virions", note: "Assembled inside, released at lysis" },
          { color: "#fb7185", shape: "dot", label: "Penicillin", note: "Rains on both — acts on one" },
        ],
      };
      break;
    }

    case "mitosis_meiosis": {
      const d = describeDivision({ mode: params.mode, stage: num(params.stage, 0), chiasmata: num(params.chiasmata, 0), colchicine: num(params.colchicine, 0) });
      const c = d.census;
      const dv = d.diversity;
      const meiosis = d.mode.key === "meiosis";
      const arrested = d.colchicine.applied;
      const held = d.colchicine.held;
      const gauge = Array.from({ length: 8 }, (_, i) => (dv.index * 8 > i + 0.5 ? "▰" : "▱")).join("");

      readout = {
        title: d.mode.short,
        subtitle: `${d.index + 1} / ${d.cycle.stages.length} · ${d.stage.short}`,
        rows: [
          ["Mode", d.mode.label, "gold"],
          ["Stage", d.stage.label],
          ["Playback", params.playing ? "auto-play · looping through the cycle" : "step-by-step · parked on this stage's tableau"],
          ["Cells", `${c.cells} · ${c.cellLabel}`, c.cells > 1 ? "good" : undefined],
          ["Ploidy counter", `${c.ploidy} · ${c.perCell.setLabel}`, meiosis && c.ploidy.startsWith("n") ? "good" : "gold"],
          ["Chromosomes per cell", `${c.perCell.chromosomes}${c.perCell.bivalents ? ` · as ${c.perCell.bivalents} bivalents` : ""}`],
          ["Chromatids per cell", `${c.perCell.chromatids}`],
          ["Chromatids per chromosome", c.chromatidsPerChromosome === 2 ? "2 · replicated — sister chromatids joined at the centromere" : "1 · each chromatid is now its own chromosome", c.chromatidsPerChromosome === 2 ? undefined : "warn"],
          ["Being separated", c.separating ? c.separating : "nothing — no anaphase pull at this stage", c.separating === "homologous chromosomes" ? "warn" : c.separating ? "good" : undefined],
          ["Crossing over", meiosis ? `${dv.crossovers} of ${MAX_CHIASMATA} chiasmata · ${dv.recombinantChromatids} of 8 chromatids recombinant` : "none — mitosis never pairs homologues", meiosis && dv.crossovers > 0 ? "gold" : undefined],
          ["Genetic diversity variance", meiosis ? `${gauge} ${dv.percent} % · ${dv.combinations} gamete genotypes` : `${gauge} 0 % · clones`, meiosis ? (dv.percent > 60 ? "good" : "gold") : undefined],
          ["…independent assortment", meiosis ? `2ⁿ = ${dv.assortment} ways to deal the ${HAPLOID_N} pairs to the poles` : "—"],
          ["Colchicine", arrested ? `applied · arrests at ${d.colchicine.arrestStage.short}${held ? " — ARRESTED" : " — running on to it"}` : "not applied", held ? "bad" : arrested ? "warn" : undefined],
        ],
        note: held
          ? `Colchicine has bound the tubulin: no microtubules, no spindle, no kinetochore fibres. The chromosomes are condensed but cannot be aligned or pulled, and the spindle checkpoint holds the cell in a 'c-metaphase' indefinitely. Press the button again to wash it out and the spindle rebuilds.`
          : arrested
            ? `Colchicine is in the cytoplasm. A cell already past metaphase cannot un-separate its chromatids, so it runs on round the cycle — and is caught at the next ${d.colchicine.arrestStage.short}.`
            : d.stage.phase === "interphase"
              ? `Interphase (G2): the DNA was replicated in S phase, so each of the ${c.perCell.chromosomes} chromosomes is already two sister chromatids — ${c.perCell.chromatids} chromatids — but they are decondensed threads inside an intact nuclear envelope. The duplicated centrosome sits beside the nucleus.`
              : d.stage.phase === "prophase"
                ? meiosis && d.stage.division === 1
                  ? `Prophase I: the chromatin condenses and — uniquely — each red chromosome finds its blue homologue and lines up alongside it (synapsis). The pair is a BIVALENT: two chromosomes, four chromatids. Non-sister chromatids cross over at ${dv.crossovers} chiasma${dv.crossovers === 1 ? "" : "ta"}, swapping the arms beyond the crossover point.`
                  : `Prophase${meiosis ? " II" : ""}: chromatin condenses into visible chromosomes, each an X of two identical sister chromatids; the centrosomes move to opposite poles, microtubules grow from them, and the nuclear envelope breaks down. ${meiosis ? "No replication has happened since meiosis I — these are n = 2 chromosomes, still two chromatids each." : ""}`
                : d.stage.phase === "metaphase"
                  ? meiosis && d.stage.division === 1
                    ? `Metaphase I: the bivalents sit on the equator with the two HOMOLOGUES on opposite sides of the plate, each chromosome's kinetochores facing one pole. Which way round each bivalent lies is random — independent assortment.`
                    : `Metaphase${meiosis ? " II" : ""}: every chromosome's centromere is on the equatorial plate, with the two sister kinetochores held by fibres from OPPOSITE poles. Still ${c.perCell.chromosomes} chromosomes, ${c.perCell.chromatids} chromatids.`
                  : d.stage.phase === "anaphase"
                    ? c.separating === "homologous chromosomes"
                      ? `Anaphase I — the reductional step. The kinetochore fibres shorten and pull whole HOMOLOGUES apart; the sister chromatids stay joined. Each pole receives n = ${c.perCell.chromosomes / 2} chromosomes, one of each pair, still two chromatids each.`
                      : `Anaphase${meiosis ? " II" : ""}: the centromeres split and the SISTER chromatids are pulled to opposite poles — each is now a chromosome in its own right (${c.perCell.chromosomes} in the cell, ${c.perCell.chromosomes / 2} heading each way). Interpolar fibres slide past each other and the cell elongates.`
                    : d.stage.phase === "telophase"
                      ? `Telophase${meiosis ? (d.stage.division === 1 ? " I" : " II") : ""}: the spindle disassembles, a nuclear envelope re-forms round each set and the chromosomes decondense. ${c.nuclei} nuclei, ${c.perCell.setLabel}.`
                      : `Cytokinesis${meiosis ? (d.stage.division === 1 ? " I" : " II") : ""}: a ring of actin and myosin tightens at the equator and pinches the cytoplasm in two. Result: ${c.cellLabel}, ${c.perCell.setLabel}. ${meiosis ? (d.stage.division === 1 ? "Meiosis II follows with NO S phase." : `Four gametes, ${dv.combinations} possible genotypes with ${dv.crossovers} crossover${dv.crossovers === 1 ? "" : "s"}.`) : "Genetically identical to the parent."}`,
        noteTone: held ? "bad" : arrested ? "warn" : d.stage.phase === "anaphase" ? "good" : "neutral",
      };

      legend = {
        title: "Cell Key",
        items: [
          { color: PARENTS.maternal.colour, shape: "line", label: "Maternal chromatids", note: "One colour = one parent; two of the same colour side by side are SISTERS" },
          { color: PARENTS.paternal.colour, shape: "line", label: "Paternal chromatids", note: "A red and a blue of the same length are HOMOLOGUES" },
          { color: "#fde68a", shape: "dot", label: "Kinetochore", note: "Where a spindle fibre grips the centromere" },
          { color: "#fbbf24", shape: "dot", label: "Centrosome · spindle pole", note: "Duplicated in interphase, parted in prophase" },
          { color: "#7dd3fc", shape: "line", label: "Microtubules", note: "Kinetochore, interpolar and astral fibres — colchicine dissolves them" },
          { color: "#c4b5fd", shape: "square", label: "Nuclear envelope", note: "Breaks down in prophase, re-forms in telophase" },
          { color: "#fef9c3", shape: "dot", label: "Chiasma", note: "Where non-sister chromatids have exchanged arms" },
          { color: "#fb923c", shape: "line", label: "Contractile ring", note: "Actin–myosin; cytokinesis" },
          { color: "#5eead4", shape: "square", label: "Cell membrane", note: "Elongates in anaphase B, furrows in cytokinesis" },
        ],
      };
      break;
    }

    case "cardiac_cycle": {
      const bpm = num(params.bpm, 75);
      const path = pathologyFor(params.pathology);
      const stageIndex = Math.min(CARDIAC_CYCLE.stages.length - 1, Math.max(0, Math.round(num(params.stage, 0))));
      const st = CARDIAC_CYCLE.stages[stageIndex];
      const progress = num(params.liveProgress, st.holdFraction);
      const h = hemodynamicsAt(st.key, progress, bpm, path.key, { vfTime: num(params.liveVfTime, 0) });
      const sm = beatSummary(bpm, path.key);
      const vf = path.key === "vfib";
      const pct = (v) => `${Math.round(v * 100)} %`;
      const valve = (v) => (v > 0.85 ? "open" : v > 0.15 ? `${pct(v)} open` : "shut");
      const ms = (v) => `${Math.round(v * 1000)} ms`;

      readout = {
        title: "Cardiac cycle",
        subtitle: `${Math.round(sm.bpm)} bpm · ${path.short}`,
        rows: [
          ["Rhythm", path.label, vf ? "bad" : path.key === "stenosis" ? "warn" : "good"],
          ["Heart rate", `${Math.round(sm.bpm)} bpm · one beat every ${sm.period.toFixed(2)} s`, "gold"],
          ["Systole / diastole", `${ms(sm.systole)} / ${ms(sm.diastole)} · systole ${pct(sm.systoleFraction)} of the beat`, sm.systoleFraction > 0.5 ? "warn" : undefined],
          ["Phase", `${stageIndex + 1} / ${CARDIAC_CYCLE.stages.length} · ${st.short} · ${pct(progress)} through`],
          ["Playback", params.playing ? "continuous · real-time" : "step-by-step · parked"],
          ["LV pressure", `${h.pLV.toFixed(0)} mmHg`, "bad"],
          ["Aortic pressure", `${h.pAo.toFixed(0)} mmHg`, "gold"],
          ["Left atrial pressure", `${h.pLA.toFixed(0)} mmHg`],
          ["RV / pulmonary artery", `${h.pRV.toFixed(0)} / ${h.pPA.toFixed(0)} mmHg`],
          ["LV volume", `${h.vLV.toFixed(0)} mL · EDV ${sm.edv.toFixed(0)} · ESV ${sm.esv.toFixed(0)}`, "good"],
          ["Stroke volume", vf ? "0 mL — nothing is pumped" : `${sm.strokeVolume.toFixed(0)} mL`, vf ? "bad" : undefined],
          ["Cardiac output", vf ? "0 L/min" : `${sm.cardiacOutput.toFixed(2)} L/min · SV × HR`, vf ? "bad" : "gold"],
          ["Ejection fraction", vf ? "0 %" : pct(sm.ejectionFraction)],
          ["AV valves (tricuspid · mitral)", valve(h.valves.mitral), h.valves.mitral > 0.5 ? "good" : undefined],
          ["Semilunar valves (pulmonary · aortic)", `${valve(h.valves.pulmonary)} · ${valve(h.valves.aortic)}${path.key === "stenosis" ? " (max 32 %)" : ""}`, h.valves.aortic > 0.1 ? "good" : undefined],
          ["Heart sounds", h.sounds.label, h.sounds.s1 > 0.5 || h.sounds.s2 > 0.5 ? "gold" : h.sounds.murmur > 0.3 ? "warn" : undefined],
          ["ECG", vf ? `${h.ecg.toFixed(2)} mV · chaotic, no P–QRS–T` : `${h.ecg.toFixed(2)} mV · ${st.key === "atrialSystole" ? "P wave" : st.key === "isoContraction" ? "QRS complex" : st.key === "ejection" ? (progress > 0.55 ? "T wave" : "ST segment") : st.key === "isoRelaxation" ? "end of T" : "isoelectric"}`, vf ? "bad" : undefined],
          ["Conduction", h.conduction.label],
          ["LV – aortic gradient", `${Math.max(0, sm.gradient).toFixed(0)} mmHg peak${path.key === "stenosis" ? " — the ventricle's extra work" : ""}`, path.key === "stenosis" ? "bad" : undefined],
        ],
        note: vf
          ? `Ventricular fibrillation: the Purkinje system's order is gone and the ventricular muscle fires in chaotic wavelets. The walls quiver instead of contracting, so no pressure is generated, no blood is ejected, no valve shuts cleanly and there are no heart sounds; the aortic pressure is draining towards nothing. The ECG has no P, QRS or T. Only a defibrillator can reset the myocardium so the SA node can pace it again.`
          : path.key === "stenosis"
            ? `The calcified aortic leaflets open only a third of the way. To push the same blood through a narrower orifice the left ventricle must generate about ${Math.max(0, sm.gradient).toFixed(0)} mmHg more than the aorta ever sees — its wall thickens (hypertrophy), the aortic pulse rises late and small (pulsus parvus et tardus), and the turbulent jet through the valve is the crescendo–decrescendo murmur between S1 and S2.`
            : st.key === "atrialSystole"
              ? `The SA node fires; the P wave is the atria depolarising and they contract, topping up ventricles that were already about 80 % full through the open AV valves. The impulse then waits at the AV node — the PR interval — so the atria finish before the ventricles start.`
              : st.key === "isoContraction"
                ? `The QRS: the impulse races down the bundle of His and Purkinje fibres and the ventricles contract. Their pressure passes the atria's within milliseconds and the tricuspid and mitral valves slam shut — S1, 'lub'. Every valve is now closed: pressure rockets from ${Math.round(10)} to ${Math.round(sm.diastolicAorta)} mmHg while the volume stays at ${sm.edv.toFixed(0)} mL.`
                : st.key === "ejection"
                  ? `Ventricular pressure has passed the aortic and pulmonary pressures, the semilunar leaflets are pushed open and ${sm.strokeVolume.toFixed(0)} mL is ejected — fast at first, then slower as the muscle shortens. The aortic trace rides just under the ventricular one. The T wave late in ejection is the ventricles repolarising.`
                  : st.key === "isoRelaxation"
                    ? `The ventricles relax and their pressure drops below the arteries'; the aortic and pulmonary valves snap shut — S2, 'dub' — and the rebound leaves the dicrotic notch on the aortic trace. All four valves are closed again and the volume sits at ${sm.esv.toFixed(0)} mL while pressure falls towards the atria's.`
                    : `Ventricular pressure has fallen below atrial pressure, the AV valves fall open and blood pours in — rapidly at first, then slowly (diastasis). Most filling is passive; the atrial kick at the end adds the last 20 %. At ${Math.round(sm.bpm)} bpm this phase lasts ${ms(sm.durations.filling)}${sm.bpm > 130 ? " — barely enough, which is why stroke volume falls at high rates" : ""}.`,
        noteTone: vf ? "bad" : path.key === "stenosis" ? "warn" : st.key === "isoContraction" || st.key === "isoRelaxation" ? "good" : "neutral",
      };

      legend = {
        title: "Heart Key",
        items: [
          { color: "#b91c1c", shape: "square", label: "Myocardium · cut face", note: "Wall thickness: atria thin, RV thicker, LV thickest — it thickens as it squeezes" },
          { color: "#ef4444", shape: "dot", label: "Oxygenated blood", note: "Left side: pulmonary veins → LA → LV → aorta" },
          { color: "#3b82f6", shape: "dot", label: "Deoxygenated blood", note: "Right side: venae cavae → RA → RV → pulmonary trunk" },
          { color: "#fde2e2", shape: "square", label: "Valve leaflets", note: "Swing open with the pressure gradient; a ring of light blooms when they shut (S1, S2)" },
          { color: "#e5d5a0", shape: "square", label: "Stenotic leaflets", note: "Thick, calcified, opening a third of the way" },
          { color: "#fde047", shape: "dot", label: "SA node · AV node", note: "Flash as they fire" },
          { color: "#fbbf24", shape: "line", label: "Conduction pathway", note: "Lights up along its length as the impulse travels" },
          { color: "#f97316", shape: "dot", label: "Fibrillation wavelets", note: "Chaotic sparks in V-fib" },
          { color: "#f87171", shape: "line", label: "LV pressure trace", note: "Wiggers panel, mmHg" },
          { color: "#fbbf24", shape: "line", label: "Aortic pressure trace", note: "Dicrotic notch at S2" },
          { color: "#38bdf8", shape: "line", label: "LV volume trace", note: "EDV → ESV is the stroke volume" },
          { color: "#4ade80", shape: "line", label: "ECG", note: "Panel: one beat · strip: live" },
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
      const amplitude = num(params.amplitude, 1.4);
      const waveform = params.waveform || "square";
      const wfLabels = {
        square: "Square Wave (πA/4)",
        sawtooth: "Sawtooth Wave (πA/2)",
        triangle: "Triangle Wave (π²A/8)",
      };

      readout = {
        title: "Unit Circle & Wave Synthesis",
        subtitle: count === 1 ? "y(t) = A sin(θ) · x(t) = A cos(θ)" : `Fourier ${wfLabels[waveform] || "Wave"} Synthesis`,
        rows: [
          ["Target Wave", (waveform || "square").toUpperCase(), "gold"],
          ["Amplitude A", amplitude.toFixed(2)],
          ["Harmonics Count", count],
          ["Coordinates (x, y)", "(cos θ, sin θ) on unit circle"],
          ["Fourier Limit", count > 1 ? `Converges to ${wfLabels[waveform] || "target wave"}` : "Pure fundamental sine wave", "good"],
          ["Gibbs Phenomenon", count > 1 ? (waveform === "triangle" ? "None (uniform convergence)" : "~9% overshoot at step jumps") : "None", count > 1 && waveform !== "triangle" ? "warn" : "good"],
          ...(params.showTangent ? [["tan θ", "A · sin(θ)/cos(θ)", "rose"]] : []),
          ...(params.showHelix ? [["3D Phase Space", "(x, cos θ, sin θ) helix", "sky"]] : []),
        ],
        note: count === 1
          ? "The sine wave is the vertical projection (y = A sin θ) of a particle moving uniformly along the unit circle, unrolled over time."
          : `By adding Fourier harmonics with amplitudes and signs tailored for a ${waveform} wave, the waveform shapes towards the target function, demonstrating how complex periodic signals decompose into pure sinusoidal harmonics.`,
        noteTone: "good",
      };

      legend = {
        title: "Trigonometric Key",
        items: [
          { color: "#38bdf8", shape: "line", label: "Unit Circle Orbit", note: "Circle of radius A turning at angle θ" },
          { color: "#fbbf24", shape: "dot", label: "Rotating Tip Point", note: "Position (cos θ, sin θ) on circumference" },
          { color: "#fbbf24", shape: "line", label: "Sine Wave Trace (y)", note: "Vertical displacement unrolled over time" },
          ...(params.showTangent ? [{ color: "#fb7185", shape: "line", label: "Tangent Line (tan θ)", note: "Vertical projection on x = A touching line" }] : []),
          ...(params.showCos ? [{ color: "#a78bfa", shape: "line", label: "Cosine Wave Trace (x)", note: "Horizontal projection (90° phase shifted)" }] : []),
          ...(params.showHelix ? [{ color: "#38bdf8", shape: "line", label: "3D Phase Helix", note: "Unrolled 3D spatial trajectory (x, cos θ, sin θ)" }] : []),
          ...(params.showTarget ? [{ color: "#34d399", shape: "line", label: `Target ${waveform} wave`, note: `Fourier series target summation limit` }] : []),
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

        {/* `grid-flow-row-dense` lets a short row backfill the cell a full-width
            row would otherwise leave empty beside it. */}
        <div className="grid grid-flow-row-dense grid-cols-2 gap-x-2 gap-y-1.5 pt-0.5">
          {readout.rows.map(([label, value, tone, layout], i) => (
            <Stat key={i} label={label} value={value} tone={tone || "default"} wide={layout === "wide"} />
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
      <div className="pointer-events-auto absolute left-4 top-4 z-20">
        <HudButton
          icon={SlidersHorizontal}
          onClick={() => {
            setOpen(true);
            setActiveTab("controls");
          }}
          title="Open Controls & Details sidebar"
        >
          Controls
        </HudButton>
      </div>
    );
  }

  return (
    <aside
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ width: `${panelWidth}px` }}
      className={`relative z-20 flex h-full shrink-0 flex-col border-r border-ink-800 bg-ink-900/95 backdrop-blur-sm ${
        isResizing ? "select-none" : ""
      }`}
    >
      <div className="relative flex h-full flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-800 px-3.5 py-2.5 shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            {topic.icon && <topic.icon className="h-4 w-4 shrink-0 text-duck-400" strokeWidth={2} />}
            <span className="truncate text-xs font-semibold uppercase tracking-wider text-ink-300">
              {topic.title}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Hide panel"
            title="Collapse sidebar (fullscreen 3D view)"
            suppressHydrationWarning
            className="shrink-0 rounded p-1 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100 cursor-pointer"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Scrollable controls body directly in the rectangular sidebar */}
        <div className={`h-full flex-1 overflow-y-auto ${topic.id === "hookes_law" ? "p-2.5 space-y-2" : "p-3.5 space-y-3"}`}>
          {/* ─── Controls vs Details Tab Switcher ─── */}
            <div className={`${topic.id === "hookes_law" ? "mb-2" : "mb-3"} flex items-center gap-1 rounded-lg border border-ink-800 bg-ink-950/60 p-1`}>
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
            {!topic?.hideSpeedSlider && !params?.hideSpeedSlider && (
              <div className={`${topic.id === "hookes_law" ? "mb-2 p-2" : "mb-3 p-2.5"} rounded-lg border border-ink-800 bg-ink-950/60 shadow-inner`}>
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
            )}

            {activeTab === "controls" ? (
              topic.id === "hookes_law" ? (
                <div className="space-y-2">
                  {/* Slotted masses slider */}
                  <Slider
                    label="Add slotted masses"
                    value={typeof params?.hangingMass === "number" ? params.hangingMass : 0.5}
                    onChange={(val) => {
                      const f = loadForce(val);
                      setParams({
                        hangingMass: val,
                        peakForce: Math.max(typeof params?.peakForce === "number" ? params.peakForce : 0, f),
                      });
                    }}
                    min={0.05}
                    max={2.5}
                    step={0.05}
                    format={(v) => (v < 1 ? `${(v * 1000).toFixed(0)} g` : `${Number(v).toFixed(2)} kg`)}
                  />

                  {/* Spring constant slider */}
                  <Slider
                    label="Spring constant k"
                    value={typeof params?.springConstant === "number" ? params.springConstant : 80}
                    onChange={(val) => {
                      setParams({
                        springConstant: val,
                        peakForce: 0,
                      });
                    }}
                    min={10}
                    max={150}
                    step={5}
                    format={(v) => `${v} N/m`}
                  />

                  {/* Show graph toggle */}
                  <Toggle
                    label="Show force–extension graph"
                    checked={params?.showGraph !== false}
                    onChange={(val) => setParam("showGraph", val)}
                  />

                  {/* The Force–Extension Graph in Left Sidebar */}
                  {params?.showGraph !== false && (
                    <HookesLawSidebarGraph params={params} />
                  )}

                  {/* Action buttons paired in a 2-column grid */}
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <HudButton
                      icon={TrendingDown}
                      variant="danger"
                      onClick={() => {
                        const k = params?.springConstant || 80;
                        setParams({
                          overload: (Number(params?.overload) || 0) + 1,
                          peakForce: elasticLimitForce(k) * 1.4,
                        });
                      }}
                      className="text-[11px] py-1.5 px-2"
                    >
                      Exceed limit
                    </HudButton>

                    <HudButton
                      icon={RotateCcw}
                      onClick={() => {
                        setParams({
                          newSpring: (Number(params?.newSpring) || 0) + 1,
                          peakForce: 0,
                        });
                      }}
                      className="text-[11px] py-1.5 px-2"
                    >
                      Fresh spring
                    </HudButton>
                  </div>

                  <div className="border-t border-ink-800 pt-1.5">
                    <HudButton icon={RotateCcw} onClick={onReset} className="w-full text-xs py-1.5">
                      Reset parameters
                    </HudButton>
                  </div>
                </div>
              ) : (
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
              )
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
    </aside>
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

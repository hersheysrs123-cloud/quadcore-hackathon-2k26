"use client";

import { Choice, Toggle } from "@/components/visualizations/VisualizationHUD";
import { BLOOD_STOPS, bloodColour } from "@/components/visualizations/alveoli-model";
import { ALTITUDE_OPTIONS, LUNG_CONDITION_OPTIONS } from "@/components/visualizations/topic-options";
import { KPA_PER_MMHG } from "@/lib/gasExchange";

// ─── Gas exchange: the respiratory panel's zoomed-in section ─────────
// The respiratory scene draws its own HUD; when it is zoomed into the
// alveoli this is the part of it about the blood: what sets the gradient
// (altitude), what sets the barrier (disease), how long the blood has
// (exercise), and a chart of PO₂ along the capillary against the alveolar
// air's — the curve that either reaches the line in time or does not.
// ─────────────────────────────────────────────────────────────────────

const pct = (v) => `${Math.round(v * 100)} %`;
const kpa = (v) => `${v.toFixed(1)} kPa`;
const mmhg = (v) => `${Math.round(v / KPA_PER_MMHG)} mmHg`;

/** PO₂ along the capillary (solid), the alveolar PO₂ it is chasing (dashed), and where it got there. */
function CapillaryChart({ solved }) {
  const W = 300;
  const H = 120;
  const pad = { l: 28, r: 8, t: 10, b: 22 };
  const maxP = 15;
  const x = (t) => pad.l + (t / 0.75) * (W - pad.l - pad.r);
  const y = (p) => pad.t + (1 - p / maxP) * (H - pad.t - pad.b);
  const line = solved.profile.map((s, i) => `${i ? "L" : "M"}${x(s.t).toFixed(1)},${y(s.po2).toFixed(1)}`).join(" ");
  const eq = solved.equilibratedAt;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Oxygen partial pressure along the capillary">
      <defs>
        <linearGradient id="gx-blood" x1="0" x2="1" y1="0" y2="0">
          {solved.profile
            .filter((_, i) => i % 12 === 0 || i === solved.profile.length - 1)
            .map((s) => (
              <stop key={s.t} offset={`${(s.t / solved.transitS) * 100}%`} stopColor={`#${bloodColour(s.sat).getHexString()}`} />
            ))}
        </linearGradient>
      </defs>
      {[0, 5, 10, 15].map((p) => (
        <g key={p}>
          <line x1={pad.l} x2={W - pad.r} y1={y(p)} y2={y(p)} stroke="#1f2937" strokeWidth="1" />
          <text x={pad.l - 4} y={y(p) + 3} textAnchor="end" fontSize="8" fill="#6b7280">
            {p}
          </text>
        </g>
      ))}
      {[0, 0.25, 0.5, 0.75].map((t) => (
        <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize="8" fill="#6b7280">
          {t.toFixed(2)} s
        </text>
      ))}
      {/* the time the blood has */}
      <rect x={x(0)} y={pad.t} width={x(solved.transitS) - x(0)} height={H - pad.t - pad.b} fill="#0ea5e9" opacity="0.06" />
      <line x1={x(solved.transitS)} x2={x(solved.transitS)} y1={pad.t} y2={H - pad.b} stroke="#38bdf8" strokeDasharray="2 2" strokeWidth="1" />
      <line x1={x(0)} x2={W - pad.r} y1={y(solved.pao2)} y2={y(solved.pao2)} stroke="#7dd3fc" strokeDasharray="4 3" strokeWidth="1.2" />
      <text x={W - pad.r} y={y(solved.pao2) - 3} textAnchor="end" fontSize="8" fill="#7dd3fc">
        alveolar air
      </text>
      <path d={line} fill="none" stroke="url(#gx-blood)" strokeWidth="2.6" strokeLinecap="round" />
      {eq !== null && <circle cx={x(eq)} cy={y(solved.pao2)} r="3" fill="#34d399" />}
      <text x={pad.l + 2} y={H - pad.b - 4} fontSize="8" fill="#9ca3af">
        PO₂ in the blood, kPa
      </text>
    </svg>
  );
}

function Row({ label, value, tone = "text-ink-200" }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-ink-400">{label}</span>
      <span className={`font-mono tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}

export function GasExchangePanel({ solved, altitude, condition, exercise, setParam }) {
  const limited = solved.diffusionLimited;
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-ink-800 bg-ink-950/60 p-2.5">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">Along one capillary</div>
        <CapillaryChart solved={solved} />
        <p className={`mt-1 text-[11px] leading-snug ${limited ? "text-amber-300" : "text-emerald-300"}`}>
          {limited
            ? `Out of time: the blood leaves ${kpa(solved.shortfall)} short of the air, at ${pct(solved.endSat)} saturated.`
            : `Caught up with the air after ${solved.equilibratedAt.toFixed(2)} s of its ${solved.transitS.toFixed(2)} s — ${pct(solved.reserve)} of the capillary to spare.`}
        </p>
      </div>
      <div className="space-y-1 rounded-lg border border-ink-800 bg-ink-950/40 p-2.5">
        <Row label="Air pressure" value={kpa(solved.pb)} />
        <Row label="Alveolar PO₂" value={`${kpa(solved.pao2)} · ${mmhg(solved.pao2)}`} tone="text-sky-300" />
        <Row label="Blood in → out PO₂" value={`${solved.pvo2.toFixed(1)} → ${solved.endPo2.toFixed(1)} kPa`} tone={limited ? "text-amber-300" : "text-rose-300"} />
        <Row label="Haemoglobin saturation" value={`${pct(solved.venousSat)} → ${pct(solved.endSat)}`} tone={limited ? "text-amber-300" : "text-rose-300"} />
        <Row label="PCO₂ in → out" value={`${solved.pvco2.toFixed(1)} → ${solved.endPco2.toFixed(1)} kPa`} />
        <Row label="Barrier · area" value={`${solved.thicknessUm.toFixed(1)} µm · ${solved.areaM2} m²`} />
        <Row label="Fick factor (area ÷ thickness)" value={pct(solved.factor)} tone={solved.factor < 0.99 ? "text-amber-300" : "text-emerald-300"} />
        <Row label="O₂ picked up per litre" value={`${solved.o2PerLitre.toFixed(0)} mL`} />
      </div>
      <div className="space-y-2">
        <div>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-500">Altitude</span>
          <Choice options={ALTITUDE_OPTIONS} value={altitude} onChange={(v) => setParam?.("altitude", v)} columns={1} />
        </div>
        <div>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-500">Lung</span>
          <Choice options={LUNG_CONDITION_OPTIONS} value={condition} onChange={(v) => setParam?.("condition", v)} columns={1} />
        </div>
        <Toggle label="Hard exercise · blood through 3× faster" checked={exercise} onChange={(v) => setParam?.("exercise", v)} />
      </div>
      <div className="flex items-center gap-2 text-[10px] text-ink-400">
        <span>blood</span>
        <span className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, ${BLOOD_STOPS.map(([, c]) => c).join(", ")})` }} />
        <span>35 % → 100 % saturated</span>
      </div>
    </div>
  );
}

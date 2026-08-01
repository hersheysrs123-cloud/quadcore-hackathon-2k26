"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronRight,
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
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-ink-400">{label}</span>
        <span className="text-[11px] font-medium tabular-nums text-duck-300">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
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

export function VisualizationHUD({ topic, params, setParam, setParams, onReset, onOpenQuiz }) {
  const [open, setOpen] = useState(true);

  // A new topic means a new control set — reopen so it is not hidden.
  useEffect(() => setOpen(true), [topic.id]);

  if (!open) {
    return (
      <div className="pointer-events-auto absolute left-4 top-4 z-20">
        <HudButton icon={SlidersHorizontal} onClick={() => setOpen(true)}>
          Controls
        </HudButton>
      </div>
    );
  }

  return (
    <div
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute left-4 top-4 z-20 flex max-h-[calc(100%-2rem)] w-[264px] flex-col gap-3 overflow-y-auto pr-0.5"
    >
      <HudPanel
        title={topic.title}
        icon={topic.icon}
        action={
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Hide controls"
            suppressHydrationWarning
            className="shrink-0 rounded p-0.5 text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        }
      >
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
      </HudPanel>

      {/* 3-bullet takeaways */}
      <HudPanel title="Key concepts" icon={Lightbulb}>
        <ul className="space-y-2">
          {topic.concepts.map((concept, i) => (
            <li key={i} className="flex gap-2">
              <span
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-duck-400"
                aria-hidden="true"
              />
              <p className="text-[11px] leading-relaxed text-ink-200">{concept}</p>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onOpenQuiz}
          suppressHydrationWarning
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-duck-400 px-3 py-2 text-[11px] font-medium text-ink-950 transition-colors hover:bg-duck-300"
        >
          <Target className="h-3.5 w-3.5" strokeWidth={2.25} />
          Test understanding
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
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
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const question = topic.quiz[index];
  const isLast = index === topic.quiz.length - 1;

  const choose = (option) => {
    if (picked !== null) return;
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

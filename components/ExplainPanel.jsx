"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Drawer, { DrawerError } from "@/components/Drawer";

/**
 * The teaching half of the app.
 *
 * Where the Duck refuses to answer, this panel answers properly: a one-line
 * summary, the mechanism in order, an analogy with its own limits marked, the
 * misconceptions most likely to bite, a worked example, and questions that
 * hand straight over to the quiz.
 */
export default function ExplainPanel({
  open,
  concept,
  focus,
  noteContent,
  onClose,
  onQuiz,
}) {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExplanation(null);

    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept, focus, noteContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
      setExplanation(data.explanation);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [concept, focus, noteContent]);

  // One fetch per (concept, focus) the drawer is opened on. noteContent is
  // deliberately not a trigger — it changes on every keystroke behind the
  // drawer, and re-explaining mid-read would be maddening.
  useEffect(() => {
    if (!open || !concept) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, concept, focus]);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: 0 });
  }, [open, explanation]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      icon="✨"
      title="Explain"
      subtitle={concept}
      scrollRef={scrollRef}
      actions={
        explanation && (
          <button
            type="button"
            onClick={load}
            title="Explain again"
            className="shrink-0 rounded-md px-2 py-1 text-sm text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
          >
            ↻
          </button>
        )
      }
    >
      <div className="px-5 py-5">
        {loading && <ExplainSkeleton />}

        <DrawerError message={error} onRetry={load} />

        {explanation && !loading && (
          <div className="animate-fade-up space-y-7">
            {/* TL;DR */}
            <section>
              <p className="rounded-xl border border-duck-500/25 bg-duck-500/5 px-4 py-3.5 text-[15px] font-medium leading-relaxed text-ink-100">
                {explanation.tldr}
              </p>
            </section>

            {/* Key ideas */}
            {explanation.keyIdeas.length > 0 && (
              <Section label="How it works">
                <ol className="space-y-3.5">
                  {explanation.keyIdeas.map((idea, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-[11px] font-semibold tabular-nums text-duck-300">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-100">
                          {idea.heading}
                        </p>
                        <p className="mt-1 text-[13px] leading-relaxed text-ink-300">
                          {idea.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>
            )}

            {/* Analogy */}
            {explanation.analogy?.body && (
              <Section label="An analogy">
                <div className="rounded-xl border border-ink-800 bg-ink-850 px-4 py-3.5">
                  <p className="text-sm font-semibold text-ink-100">
                    {explanation.analogy.title}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-300">
                    {explanation.analogy.body}
                  </p>
                  {explanation.analogy.breaksDown && (
                    <p className="mt-2.5 border-t border-ink-800 pt-2.5 text-[12px] leading-relaxed text-ink-500">
                      <span className="font-medium text-ink-400">
                        Where it breaks:
                      </span>{" "}
                      {explanation.analogy.breaksDown}
                    </p>
                  )}
                </div>
              </Section>
            )}

            {/* Misconceptions */}
            {explanation.misconceptions.length > 0 && (
              <Section label="Easy to get wrong">
                <ul className="space-y-2.5">
                  {explanation.misconceptions.map((m, i) => (
                    <li
                      key={i}
                      className="rounded-xl border border-shaky-500/25 bg-shaky-500/5 px-4 py-3"
                    >
                      <p className="flex gap-2 text-[13px] font-medium leading-relaxed text-shaky-500">
                        <span aria-hidden="true">✗</span>
                        <span>“{m.claim}”</span>
                      </p>
                      <p className="mt-1.5 pl-5 text-[13px] leading-relaxed text-ink-300">
                        {m.correction}
                      </p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Worked example */}
            {explanation.workedExample?.steps?.length > 0 && (
              <Section label="Worked through">
                <div className="rounded-xl border border-ink-800 bg-ink-850 px-4 py-3.5">
                  <p className="text-sm font-semibold text-ink-100">
                    {explanation.workedExample.title}
                  </p>
                  <ol className="mt-2.5 space-y-2">
                    {explanation.workedExample.steps.map((step, i) => (
                      <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-600">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-ink-300">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </Section>
            )}

            {/* Check yourself → the quiz */}
            {explanation.checkYourself.length > 0 && (
              <Section label="Check yourself">
                <ul className="space-y-2">
                  {explanation.checkYourself.map((question, i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 text-[13px] leading-relaxed text-ink-300"
                    >
                      <span aria-hidden="true" className="text-duck-500">
                        ?
                      </span>
                      <span>{question}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={onQuiz}
                  className="mt-4 w-full rounded-xl bg-duck-400 px-4 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-duck-300"
                >
                  🦆 Test me on this
                </button>
                <p className="mt-2 text-center text-[11px] text-ink-600">
                  Reading it is not knowing it.
                </p>
              </Section>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}

function Section({ label, children }) {
  return (
    <section>
      <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-500">
        {label}
      </p>
      {children}
    </section>
  );
}

function ExplainSkeleton() {
  return (
    <div className="space-y-6" aria-live="polite" aria-busy="true">
      <p className="sr-only">Writing an explanation…</p>
      <div className="skeleton h-20 rounded-xl" />
      <div className="space-y-2.5">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-16 rounded-xl" />
        <div className="skeleton h-16 rounded-xl" />
      </div>
      <div className="space-y-2.5">
        <div className="skeleton h-3 w-20 rounded" />
        <div className="skeleton h-24 rounded-xl" />
      </div>
    </div>
  );
}

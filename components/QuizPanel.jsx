"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Drawer, { DrawerError } from "@/components/Drawer";
import ConfidenceHeatmap from "@/components/ConfidenceHeatmap";
import ScoreRing from "@/components/ScoreRing";
import { quizGenerate, quizGrade, shouldUseClientAI } from "@/lib/aiService";
import { getSyllabusStatement, getSpaceSettings } from "@/lib/storageService";
import { CheckSquare, ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import MathText from "@/components/MathText";
import "katex/dist/katex.min.css";

const MATH_SYMBOLS_DRAWER = [
  { label: "a/b", snippet: "\\frac{a}{b}" },
  { label: "√x", snippet: "\\sqrt{x}" },
  { label: "x²", snippet: "^2" },
  { label: "xⁿ", snippet: "^{n}" },
  { label: "π", snippet: "\\pi" },
  { label: "±", snippet: "\\pm" },
  { label: "θ", snippet: "\\theta" },
  { label: "≤", snippet: "\\le" },
  { label: "≥", snippet: "\\ge" },
  { label: "≈", snippet: "\\approx" },
  { label: "∞", snippet: "\\infty" },
  { label: "×", snippet: "\\times" },
  { label: "÷", snippet: "\\div" },
  { label: "°", snippet: "^\\circ" },
];

/**
 * Graded Quiz Runner drawer. Generates concept-aligned questions,
 * grades multiple choice and short answers, and records mastery feedback.
 */
export default function QuizPanel({
  open,
  concept,
  noteContent,
  spaceId = null,
  onClose,
  onComplete,
}) {
  const scrollRef = useRef(null);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      icon="🦆"
      title="Quiz me"
      subtitle={concept}
      scrollRef={scrollRef}
    >
      <QuizRunner
        open={open}
        concept={concept}
        noteContent={noteContent}
        spaceId={spaceId}
        onComplete={onComplete}
        scrollRef={scrollRef}
      />
    </Drawer>
  );
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data;
}

// ─── Quick quiz ─────────────────────────────────────────────────────
function QuizRunner({ open, concept, noteContent, spaceId = null, onComplete, scrollRef }) {
  const [quiz, setQuiz] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | generating | answering | grading | review
  const [error, setError] = useState(null);

  const lastConceptRef = useRef(null);
  const genSeqRef = useRef(0);
  const valInputRef = useRef(null);

  const generate = useCallback(
    async (force = false) => {
      if (!concept) return;
      if (!force && phase === "generating") return;

      const seq = ++genSeqRef.current;
      lastConceptRef.current = concept;

      setPhase("generating");
      setError(null);
      setQuiz(null);
      setResult(null);
      setAnswers({});
      setIndex(0);

      try {
        const { statement: syllabus, enabled } = await getSyllabusStatement(spaceId);
        const spaceConfig = spaceId ? await getSpaceSettings(spaceId) : null;
        const payload = {
          concept,
          noteContent,
          mcqCount: 5,
          shortAnswerCount: 3,
          longAnswerCount: 0,
          valueInputCount: 0,
          stepOrderingCount: 0,
          codeInputCount: 0,
          multiSelectCount: 0,
          syllabus: enabled ? syllabus : "",
          spaceId,
          aiPersona: spaceConfig?.aiPersona || "examiner",
          strictness: spaceConfig?.strictness || "standard",
          academicLevel: spaceConfig?.academicLevel || "general",
        };
        const isClient = await shouldUseClientAI();
        const data = isClient
          ? await quizGenerate(payload)
          : await postJson("/api/quiz/generate", payload);

        // Discard out-of-order responses or superseded requests
        if (genSeqRef.current !== seq) return;

        const rawQuestions = Array.isArray(data?.quiz?.questions) ? data.quiz.questions : [];
        const safeQuestions = rawQuestions.filter((q) => q.type !== "value_input");
        setQuiz({ ...data.quiz, questions: safeQuestions });
        setPhase("answering");
      } catch (err) {
        if (genSeqRef.current !== seq) return;
        setError(err.message ?? "Failed to generate quiz.");
        setPhase("idle");
      }
    },
    [concept, noteContent, spaceId, quiz, phase]
  );

  useEffect(() => {
    if (!open || !concept) return;
    if (lastConceptRef.current !== concept || !quiz) {
      generate();
    }
  }, [open, concept]);

  useEffect(() => {
    scrollRef?.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [index, phase, scrollRef]);

  async function submit() {
    setPhase("grading");
    setError(null);

    try {
      const { statement: syllabus, enabled } = await getSyllabusStatement(spaceId);
      const spaceConfig = spaceId ? await getSpaceSettings(spaceId) : null;
      const payload = {
        concept,
        noteContent,
        questions: quiz.questions,
        responses: quiz.questions.map((_, i) => ({ answer: answers[i] })),
        syllabus: enabled ? syllabus : "",
        spaceId,
        aiPersona: spaceConfig?.aiPersona || "examiner",
        strictness: spaceConfig?.strictness || "standard",
        academicLevel: spaceConfig?.academicLevel || "general",
      };

      const isClient = await shouldUseClientAI();
      const data = isClient
        ? await quizGrade(payload)
        : await postJson("/api/quiz/grade", payload);

      setResult(data.result);
      setPhase("review");
      onComplete?.({
        mode: "quiz",
        concept,
        score: data.result.score,
        summary: data.result.summary,
        heatmap: data.result.heatmap,
      });
    } catch (err) {
      setError(err.message);
      setPhase("answering");
    }
  }

  if (phase === "generating") {
    return (
      <div className="space-y-4 px-5 py-6" aria-busy="true">
        <p className="text-xs text-ink-500">
          Reading your note and writing questions…
        </p>
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-24 rounded-xl" />
        <div className="skeleton h-11 rounded-xl" />
        <div className="skeleton h-11 rounded-xl" />
        <div className="skeleton h-11 rounded-xl" />
      </div>
    );
  }

  if (error && !quiz) {
    return (
      <div className="px-5 py-6">
        <DrawerError message={error} onRetry={generate} />
      </div>
    );
  }

  if (phase === "review" && result) {
    return (
      <QuizReview result={result} concept={concept} onRetake={() => generate(true)} />
    );
  }

  if (!quiz) return null;

  const question = quiz.questions[index];
  const total = quiz.questions.length;
  const isFilled = (val) => {
    if (val === undefined || val === null) return false;
    if (Array.isArray(val)) return val.length > 0;
    return String(val).trim().length > 0;
  };

  const answered = isFilled(answers[index]);
  const isLast = index === total - 1;
  const answeredCount = quiz.questions.filter((_, i) => isFilled(answers[i])).length;
  const grading = phase === "grading";

  return (
    <div className="px-5 py-5">
      {/* Progress */}
      <div className="mb-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
            Question {index + 1} of {total}
          </span>
          <span className="rounded-full border border-ink-700 bg-ink-850 px-2 py-0.5 text-[10px] text-ink-400">
            <MathText text={question.subtopic} />
          </span>
        </div>
        <div className="flex gap-1" aria-hidden="true">
          {quiz.questions.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i === index
                  ? "bg-duck-400"
                  : isFilled(answers[i])
                    ? "bg-duck-500/40"
                    : "bg-ink-800"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <div className="mb-4 text-[15px] font-medium leading-relaxed text-ink-100">
        <MathText text={question.prompt} />
      </div>

      {question.type === "multiple_choice" ? (
        <ul className="space-y-2">
          {question.options.map((option, oi) => {
            const picked = answers[index] === oi;
            return (
              <li key={oi}>
                <button
                  type="button"
                  onClick={() => setAnswers((prev) => ({ ...prev, [index]: oi }))}
                  className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-[13px] leading-relaxed transition-colors ${
                    picked
                      ? "border-duck-500/60 bg-duck-500/10 text-ink-100"
                      : "border-ink-800 bg-ink-850 text-ink-300 hover:border-ink-700 hover:text-ink-200"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                      picked
                        ? "border-duck-400 bg-duck-400 text-ink-950"
                        : "border-ink-600 text-ink-500"
                    }`}
                  >
                    {String.fromCharCode(65 + oi)}
                  </span>
                  <span className="flex-1">
                    <MathText text={option} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : question.type === "multi_select" ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-duck-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <CheckSquare size={13} /> Select all correct options:
          </p>
          <ul className="space-y-2">
            {question.options.map((option, oi) => {
              const currentArr = Array.isArray(answers[index]) ? answers[index] : [];
              const picked = currentArr.includes(oi);
              return (
                <li key={oi}>
                  <button
                    type="button"
                    onClick={() => {
                      const next = picked
                        ? currentArr.filter((x) => x !== oi)
                        : [...currentArr, oi].sort((a, b) => a - b);
                      setAnswers((prev) => ({ ...prev, [index]: next }));
                    }}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-[13px] leading-relaxed transition-colors ${
                      picked
                        ? "border-duck-500/60 bg-duck-500/10 text-ink-100"
                        : "border-ink-800 bg-ink-850 text-ink-300 hover:border-ink-700 hover:text-ink-200"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        picked
                          ? "border-duck-400 bg-duck-400 text-ink-950"
                          : "border-ink-600 text-transparent"
                      }`}
                    >
                      {picked ? <CheckSquare size={12} className="text-ink-950" /> : null}
                    </span>
                    <span className="flex-1">
                      <MathText text={option} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : question.type === "step_ordering" ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-duck-400 uppercase tracking-wider">
              Arrange steps in logical order:
            </p>
            <button
              type="button"
              onClick={() => {
                const initial = question.options?.length > 0 ? question.options : question.steps || [];
                setAnswers((prev) => ({ ...prev, [index]: [...initial] }));
              }}
              className="text-[10px] text-ink-500 hover:text-ink-300 flex items-center gap-1"
            >
              <RotateCcw size={10} /> Reset
            </button>
          </div>
          {(() => {
            const currentSteps = Array.isArray(answers[index])
              ? answers[index]
              : (question.options?.length > 0 ? question.options : question.steps || []);
            return (
              <div className="space-y-1.5">
                {currentSteps.map((step, sIdx) => (
                  <div
                    key={sIdx}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-ink-800 bg-ink-850 text-[13px]"
                  >
                    <span className="w-5 h-5 rounded-full bg-ink-800 border border-ink-700 text-ink-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {sIdx + 1}
                    </span>
                    <div className="flex-1 min-w-0 text-ink-200">
                      <MathText text={step} />
                    </div>
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={sIdx === 0}
                        onClick={() => {
                          const cur = [...currentSteps];
                          const temp = cur[sIdx];
                          cur[sIdx] = cur[sIdx - 1];
                          cur[sIdx - 1] = temp;
                          setAnswers((prev) => ({ ...prev, [index]: cur }));
                        }}
                        className="p-1 rounded bg-ink-800 text-ink-400 hover:text-ink-100 disabled:opacity-20 cursor-pointer"
                        title="Move step up"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        type="button"
                        disabled={sIdx === currentSteps.length - 1}
                        onClick={() => {
                          const cur = [...currentSteps];
                          const temp = cur[sIdx];
                          cur[sIdx] = cur[sIdx + 1];
                          cur[sIdx + 1] = temp;
                          setAnswers((prev) => ({ ...prev, [index]: cur }));
                        }}
                        className="p-1 rounded bg-ink-800 text-ink-400 hover:text-ink-100 disabled:opacity-20 cursor-pointer"
                        title="Move step down"
                      >
                        <ChevronDown size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      ) : question.type === "value_input" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1 p-2 rounded-xl bg-ink-850 border border-ink-800">
            {MATH_SYMBOLS_DRAWER.map((sym) => (
              <button
                key={sym.snippet}
                type="button"
                onClick={() => {
                  const input = valInputRef.current;
                  const currentVal = answers[index] ?? "";
                  if (!input) {
                    setAnswers((prev) => ({ ...prev, [index]: currentVal + sym.snippet }));
                    return;
                  }
                  const start = input.selectionStart ?? currentVal.length;
                  const end = input.selectionEnd ?? currentVal.length;
                  const nextVal = currentVal.slice(0, start) + sym.snippet + currentVal.slice(end);
                  setAnswers((prev) => ({ ...prev, [index]: nextVal }));
                  setTimeout(() => {
                    input.focus();
                    const newPos = start + sym.snippet.length;
                    input.setSelectionRange(newPos, newPos);
                  }, 0);
                }}
                className="px-2 py-1 rounded-lg border border-ink-750 bg-ink-900 hover:border-duck-500/50 hover:bg-duck-500/10 text-ink-200 text-xs font-mono transition-colors cursor-pointer"
              >
                {sym.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              ref={valInputRef}
              type="text"
              value={answers[index] ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [index]: e.target.value }))}
              placeholder="e.g. \\frac{1}{2}, \\sqrt{3}, 42.5"
              className="w-full rounded-xl border border-ink-800 bg-ink-850 px-3.5 py-2.5 text-sm font-mono text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none"
            />
          </div>

          <div className="p-3 rounded-xl border border-ink-800 bg-ink-900/60">
            <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider mb-1">
              Live KaTeX Preview:
            </p>
            <div className="text-sm text-duck-300 min-h-[1.5rem] flex items-center">
              {answers[index] ? (
                <MathText text={answers[index]} />
              ) : (
                <span className="text-ink-600 text-xs italic">Type numbers or LaTeX formula above</span>
              )}
            </div>
          </div>
        </div>
      ) : question.type === "code_input" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-ink-500">
            <span className="font-mono text-duck-400 uppercase font-semibold">
              {question.language || "code"}
            </span>
            <span>Tab = 2 spaces</span>
          </div>
          <textarea
            rows={7}
            value={answers[index] ?? question.starterCode ?? ""}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [index]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                const textarea = e.currentTarget;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const val = textarea.value;
                const nextVal = val.substring(0, start) + "  " + val.substring(end);
                setAnswers((prev) => ({ ...prev, [index]: nextVal }));
                setTimeout(() => {
                  textarea.selectionStart = textarea.selectionEnd = start + 2;
                }, 0);
              }
            }}
            placeholder={question.starterCode || "# Write your code solution here..."}
            className="w-full resize-none rounded-xl border border-ink-800 bg-ink-900 px-3.5 py-3 font-mono text-xs leading-relaxed text-emerald-200 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none"
          />
        </div>
      ) : (
        <div>
          <textarea
            rows={5}
            value={answers[index] ?? ""}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [index]: e.target.value }))}
            placeholder="Explain it in your own words…"
            className="w-full resize-none rounded-xl border border-ink-800 bg-ink-850 px-3.5 py-3 text-[13px] leading-relaxed text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none"
          />
          <p className="mt-1.5 text-[11px] text-ink-600">
            Graded on the mechanism, not the wording.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <DrawerError message={error} />
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          disabled={index === 0 || grading}
          onClick={() => setIndex((i) => i - 1)}
          className="rounded-xl border border-ink-700 px-3.5 py-2 text-xs text-ink-400 transition-colors hover:text-ink-200 disabled:opacity-30"
        >
          Back
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={submit}
            disabled={answeredCount === 0 || grading}
            className="flex-1 rounded-xl bg-duck-400 px-4 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-duck-300 disabled:opacity-30"
          >
            {grading
              ? "Grading…"
              : answeredCount === 0
                ? "Answer at least one question"
                : `Submit ${answeredCount} of ${total}`}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIndex((i) => i + 1)}
            className="flex-1 rounded-xl bg-duck-400 px-4 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-duck-300"
          >
            {answered ? "Next question" : "Skip"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Quiz review ────────────────────────────────────────────────────
function QuizReview({ result, concept, onRetake }) {
  return (
    <div className="animate-fade-up">
      <section className="border-b border-ink-800 px-5 py-6">
        <div className="flex items-center gap-5">
          <ScoreRing score={result.score} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-100">
              {result.correctCount} of {result.totalCount} correct
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-300">
              {result.summary}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRetake}
          className="mt-5 w-full rounded-xl border border-ink-700 px-4 py-2.5 text-xs font-medium text-ink-300 transition-colors hover:border-duck-500/50 hover:text-duck-300"
        >
          ↻ New questions on {concept.length > 28 ? "this note" : concept}
        </button>
      </section>

      <ConfidenceHeatmap
        diagnostic={{ score: result.score, summary: null, heatmap: result.heatmap }}
      />

      <section className="px-5 py-5">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-ink-500">
          Question by question
        </p>
        <ul className="space-y-2.5">
          {result.gradedAnswers.map((answer) => (
            <li
              key={answer.questionIndex}
              className={`rounded-xl border px-4 py-3.5 transition-all ${
                answer.correct
                  ? "border-emerald-500/40 bg-emerald-950/25"
                  : "border-rose-500/40 bg-rose-950/25"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-start gap-2.5 text-[13px] font-medium leading-relaxed text-ink-100 flex-1">
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-bold mt-0.5 ${
                      answer.correct
                        ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                        : "border-rose-500/50 bg-rose-500/20 text-rose-400"
                    }`}
                  >
                    {answer.correct ? "✓" : "✗"}
                  </span>
                  <span>
                    <span className="sr-only">
                      {answer.correct ? "Correct. " : "Incorrect. "}
                    </span>
                    <MathText text={answer.prompt} />
                  </span>
                </p>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                    answer.correct
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  }`}
                >
                  {answer.correct ? "Correct" : "Incorrect"}
                </span>
              </div>

              <dl className="mt-3 space-y-2 pl-7 text-[12px] leading-relaxed">
                <div className="flex items-start gap-2">
                  <dt className="shrink-0 text-ink-400 font-medium pt-0.5">Your Answer:</dt>
                  <dd className="text-ink-200 flex-1">
                    {answer.answered ? (
                      answer.type === "code_input" ? (
                        <pre
                          className={`p-2 rounded-lg border font-mono text-[11px] overflow-x-auto whitespace-pre ${
                            answer.correct
                              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                              : "bg-rose-950/40 border-rose-500/40 text-rose-200"
                          }`}
                        >
                          <code>{answer.yourAnswer}</code>
                        </pre>
                      ) : (
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-xs ${
                            answer.correct
                              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-200"
                              : "bg-rose-500/15 border-rose-500/30 text-rose-200"
                          }`}
                        >
                          {typeof answer.yourAnswer === "string" ? (
                            <MathText text={answer.yourAnswer} />
                          ) : (
                            answer.yourAnswer
                          )}
                        </span>
                      )
                    ) : (
                      <span className="italic text-ink-500">left blank</span>
                    )}
                  </dd>
                </div>

                {!answer.correct && answer.type === "multiple_choice" && answer.options && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex items-start gap-2">
                    <dt className="shrink-0 text-emerald-400 font-bold">Correct Answer:</dt>
                    <dd className="text-emerald-200 font-medium">
                      <MathText text={answer.options[answer.correctIndex]} />
                    </dd>
                  </div>
                )}

                {!answer.correct && answer.type === "multi_select" && answer.options && Array.isArray(answer.correctIndices) && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex flex-col gap-1">
                    <dt className="shrink-0 text-emerald-400 font-bold">Correct Selections:</dt>
                    <div className="flex flex-wrap gap-1">
                      {answer.correctIndices.map((idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-xs font-medium"
                        >
                          <MathText text={answer.options[idx] ?? `Option ${idx + 1}`} />
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!answer.correct && answer.type === "step_ordering" && Array.isArray(answer.steps) && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex flex-col gap-1">
                    <dt className="shrink-0 text-emerald-400 font-bold">Correct Step Sequence:</dt>
                    <ol className="space-y-0.5 text-emerald-200 text-xs list-decimal list-inside font-medium">
                      {answer.steps.map((step, sIdx) => (
                        <li key={sIdx} className="leading-relaxed">
                          <MathText text={step} />
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {answer.type === "value_input" && (
                  <div className="p-2.5 rounded-lg bg-duck-500/10 border border-duck-500/30 flex items-start gap-2">
                    <dt className="shrink-0 text-duck-400 font-bold">Expected Value:</dt>
                    <dd className="text-duck-200 font-medium">
                      <MathText text={answer.expectedAnswer || "—"} />
                      {answer.tolerance ? (
                        <span className="text-ink-400 ml-1 font-mono text-[11px]">(±{answer.tolerance})</span>
                      ) : null}
                    </dd>
                  </div>
                )}

                {answer.type === "code_input" && (
                  <div className="p-2.5 rounded-lg bg-duck-500/10 border border-duck-500/30 flex flex-col gap-1">
                    <dt className="text-duck-400 font-bold">
                      Model Solution {answer.language ? `(${answer.language})` : ""}:
                    </dt>
                    <pre className="p-2 rounded-lg bg-ink-950/90 border border-ink-800 font-mono text-[11px] text-duck-200 overflow-x-auto whitespace-pre">
                      <code>{answer.expectedAnswer || "# No reference code"}</code>
                    </pre>
                  </div>
                )}

                {answer.expectedAnswer && !["multiple_choice", "multi_select", "step_ordering", "value_input", "code_input"].includes(answer.type) && (
                  <div className="p-2.5 rounded-lg bg-duck-500/10 border border-duck-500/30 flex items-start gap-2">
                    <dt className="shrink-0 text-duck-400 font-bold">Model Rubric:</dt>
                    <dd className="text-duck-200 font-medium">
                      <MathText text={answer.expectedAnswer} />
                    </dd>
                  </div>
                )}
              </dl>

              {answer.feedback && (
                <div className="mt-2 border-t border-ink-800 pt-2 pl-5 text-[12px] leading-relaxed text-ink-400">
                  <MathText text={answer.feedback} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

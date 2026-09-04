"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Drawer, { DrawerError } from "@/components/Drawer";
import ConfidenceHeatmap from "@/components/ConfidenceHeatmap";
import WidgetCanvas from "@/components/WidgetCanvas";
import ScoreRing from "@/components/ScoreRing";
import { quizGenerate, quizGrade, socraticChat, socraticWidget, shouldUseClientAI } from "@/lib/aiService";
import { getSyllabusStatement, getSpaceSettings } from "@/lib/storageService";
import MathText from "@/components/MathText";
import "katex/dist/katex.min.css";

/**
 * Both ways of being quizzed, in one drawer.
 *
 *   Quick quiz — generated questions, graded, straight to a heatmap. Fast, and
 *                the multiple-choice half is marked deterministically.
 *   Socratic   — the Duck asks and never answers, then scores the transcript.
 *                Slower, and much better at finding what you only think you know.
 *
 * Both produce the same { score, summary, heatmap } shape, which is what lets
 * the mastery dashboard treat them as one dataset.
 */
export default function QuizPanel({
  open,
  concept,
  noteContent,
  spaceId = null,
  onClose,
  onComplete,
}) {
  const [mode, setMode] = useState("quiz");
  const scrollRef = useRef(null);

  // A fresh concept starts on the quick quiz. Switching modes mid-concept is
  // the learner's call and survives until they open something else.
  useEffect(() => {
    if (open) setMode("quiz");
  }, [open, concept]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      icon="🦆"
      title="Quiz me"
      subtitle={concept}
      scrollRef={scrollRef}
    >
      <div className="sticky top-0 z-10 border-b border-ink-800 bg-ink-900/95 px-5 py-3 backdrop-blur">
        <div
          role="tablist"
          aria-label="Quiz mode"
          className="flex gap-1 rounded-xl bg-ink-850 p-1"
        >
          <ModeTab
            active={mode === "quiz"}
            onClick={() => setMode("quiz")}
            label="Quick quiz"
            hint="8 questions, graded"
          />
          <ModeTab
            active={mode === "socratic"}
            onClick={() => setMode("socratic")}
            label="Socratic duck"
            hint="Feynman-style probe"
          />
        </div>
      </div>

      {/* Keying on the mode preserves the active quiz session during edits */}
      {mode === "quiz" ? (
        <QuizRunner
          open={open}
          concept={concept}
          noteContent={noteContent}
          spaceId={spaceId}
          onComplete={onComplete}
          scrollRef={scrollRef}
        />
      ) : (
        <SocraticSession
          open={open}
          concept={concept}
          noteContent={noteContent}
          spaceId={spaceId}
          onComplete={onComplete}
          scrollRef={scrollRef}
        />
      )}
    </Drawer>
  );
}

function ModeTab({ active, onClick, label, hint }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 text-left transition-colors ${
        active ? "bg-ink-800 text-ink-100" : "text-ink-500 hover:text-ink-300"
      }`}
    >
      <span className="block text-xs font-semibold">{label}</span>
      <span className="block text-[10px] text-ink-600">{hint}</span>
    </button>
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

        setQuiz(data.quiz);
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
  const answered = answers[index] !== undefined && answers[index] !== "";
  const isLast = index === total - 1;
  const answeredCount = quiz.questions.filter(
    (_, i) => answers[i] !== undefined && answers[i] !== "",
  ).length;
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
                  : answers[i] !== undefined && answers[i] !== ""
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
                  <dd className="text-ink-200">
                    {answer.answered ? (
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
                    ) : (
                      <span className="italic text-ink-500">left blank</span>
                    )}
                  </dd>
                </div>
                {!answer.correct && answer.type === "multiple_choice" && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex items-start gap-2">
                    <dt className="shrink-0 text-emerald-400 font-bold">Correct Answer:</dt>
                    <dd className="text-emerald-200 font-medium">
                      <MathText text={answer.options[answer.correctIndex]} />
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

// ─── Socratic session ───────────────────────────────────────────────
function SocraticSession({ open, concept, noteContent, spaceId = null, onComplete, scrollRef }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [diagnostic, setDiagnostic] = useState(null);
  const [widget, setWidget] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [buildingWidget, setBuildingWidget] = useState(false);
  const [error, setError] = useState(null);
  const [widgetError, setWidgetError] = useState(null);
  const lastConceptRef = useRef(null);

  const { visible, answerCount } = useMemo(() => {
    const vis = messages.filter((m) => !m.hidden);
    const count = vis.filter((m) => m.role === "user").length;
    return { visible: vis, answerCount: count };
  }, [messages]);
  const scored = Boolean(diagnostic);

  const toWire = (history) => history.map(({ role, content }) => ({ role, content }));

  /**
   * The transcript opens with one hidden user turn. The API must start on a
   * user message and the server drops any leading assistant turn, so without
   * this seed the Duck's own first question would fall out of context on every
   * later call — it would end up scoring answers to a question it never saw
   * itself ask.
   */
  const seed = useCallback(
    () => [
      {
        role: "user",
        content: `I want to be examined on: ${concept}. Ask me your first question.`,
        hidden: true,
      },
    ],
    [concept],
  );

  const askDuck = useCallback(
    async (history) => {
      setThinking(true);
      setError(null);
      try {
        const { statement: syllabus, enabled } = await getSyllabusStatement(spaceId);
        const payload = {
          noteContent,
          concept,
          conversationHistory: toWire(history),
          isFinalTurn: false,
          syllabus: enabled ? syllabus : "",
          spaceId,
        };

        const isClient = await shouldUseClientAI();
        const data = isClient
          ? await socraticChat(payload)
          : await postJson("/api/socratic/chat", payload);

        const newMsgIndex = history.length;
        const assistantMsg = { role: "assistant", content: data.reply };
        setMessages([...history, assistantMsg]);

        if (autoSpeak && data.reply && ttsSupported) {
          speak(data.reply, `msg-${newMsgIndex}`);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setThinking(false);
      }
    },
    [concept, noteContent, autoSpeak, ttsSupported, speak, spaceId],
  );

  const buildWidget = useCallback(
    async (result) => {
      const reds = result.heatmap.filter((h) => h.status === "red");
      const gaps = reds.length
        ? reds
        : result.heatmap.filter((h) => h.status === "yellow");
      if (!gaps.length) return;

      setBuildingWidget(true);
      setWidgetError(null);
      try {
        const payload = {
          concept,
          redSubtopics: gaps.map((g) => ({
            subtopic: g.subtopic,
            feedback: g.feedback,
          })),
          recommendedWidget: result.recommendedWidget,
        };

        const isClient = await shouldUseClientAI();
        const data = isClient
          ? await socraticWidget(payload)
          : await postJson("/api/socratic/widget", payload);

        setWidget(data.widget);
      } catch (err) {
        setWidgetError(err.message);
      } finally {
        setBuildingWidget(false);
      }
    },
    [concept],
  );

  async function endSession() {
    setScoring(true);
    setError(null);
    stopSpeaking();
    try {
      const { statement: syllabus, enabled } = await getSyllabusStatement(spaceId);
      const payload = {
        noteContent,
        concept,
        conversationHistory: toWire(messages),
        isFinalTurn: true,
        syllabus: enabled ? syllabus : "",
        spaceId,
      };

      const isClient = await shouldUseClientAI();
      const data = isClient
        ? await socraticChat(payload)
        : await postJson("/api/socratic/chat", payload);

      setDiagnostic(data.diagnostic);
      onComplete?.({
        mode: "socratic",
        concept,
        score: data.diagnostic.score,
        summary: data.diagnostic.summary,
        heatmap: data.diagnostic.heatmap,
      });
      await buildWidget(data.diagnostic);
    } catch (err) {
      setError(err.message);
    } finally {
      setScoring(false);
    }
  }

  useEffect(() => {
    if (!open || !concept) return;
    if (lastConceptRef.current === concept && messages.length > 0) return;
    lastConceptRef.current = concept;
    const opening = seed();
    setMessages(opening);
    askDuck(opening);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, concept]);

  useEffect(() => {
    scrollRef?.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, thinking, diagnostic, widget, scrollRef]);

  const submitAnswer = useCallback(
    (textToSubmit) => {
      const answer = (textToSubmit !== undefined ? textToSubmit : input).trim();
      if (!answer || thinking || scoring || scored) return;

      const next = [...messages, { role: "user", content: answer }];
      setMessages(next);
      setInput("");
      askDuck(next);
    },
    [input, thinking, scoring, scored, messages, askDuck],
  );

  function handleSubmit(event) {
    if (event) event.preventDefault();
    submitAnswer();
  }


  const busy = thinking || scoring;

  return (
    <>
      <div className="space-y-4 px-5 py-5">
        {visible.map((message, i) => {
          return (
            <div
              key={i}
              className={message.role === "user" ? "flex justify-end" : "flex items-start gap-2"}
            >
              <p
                className={`max-w-[85%] animate-fade-up whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  message.role === "user"
                    ? "rounded-br-md bg-ink-800 text-ink-100"
                    : "rounded-bl-md border border-duck-500/25 bg-duck-500/5 text-ink-200"
                }`}
              >
                {message.content}
              </p>
            </div>
          );
        })}

        {busy && (
          <p className="flex items-center gap-2 text-xs text-ink-500">
            <span className="inline-flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-duck-500"
                  style={{ animationDelay: `${i * 160}ms` }}
                />
              ))}
            </span>
            {scoring ? "Scoring your explanation…" : "The Duck is thinking…"}
          </p>
        )}

        <DrawerError message={error} />
      </div>

      {scored && (
        <ConfidenceHeatmap diagnostic={diagnostic} />
      )}

      {scored && (buildingWidget || widget || widgetError) && (
        <section className="px-5 py-5">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-ink-500">
            Playground built from your gaps
          </p>
          <WidgetCanvas
            widget={widget}
            loading={buildingWidget}
            error={widgetError}
          />
        </section>
      )}

      {!scored && (
        <form
          onSubmit={handleSubmit}
          className="sticky bottom-0 border-t border-ink-800 bg-ink-900/95 px-5 py-4 backdrop-blur"
        >


          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) handleSubmit(e);
              }}
              disabled={busy}
              placeholder="Explain it in your own words..."
              className="flex-1 resize-none rounded-xl border border-ink-800 bg-ink-850 px-3.5 py-2.5 text-[13px] text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none disabled:opacity-50"
            />


            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="shrink-0 rounded-xl bg-duck-400 px-4 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-duck-300 disabled:opacity-30"
            >
              Send
            </button>
          </div>

          <button
            type="button"
            onClick={endSession}
            disabled={busy || answerCount === 0}
            className="mt-2.5 w-full rounded-xl border border-ink-700 px-3 py-2 text-xs text-ink-400 transition-colors hover:border-duck-500/50 hover:text-duck-300 disabled:opacity-30 disabled:hover:border-ink-700 disabled:hover:text-ink-400"
          >
            {answerCount === 0
              ? "Answer at least once to be scored"
              : `End session & score me (${answerCount} answer${answerCount === 1 ? "" : "s"})`}
          </button>
        </form>
      )}

      {scored && (
        <p className="border-t border-ink-800 px-5 py-4 text-xs text-ink-500">
          Saved to your mastery map. Close the drawer and pick another note to
          keep going.
        </p>
      )}
    </>
  );
}

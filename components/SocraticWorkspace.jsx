"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ConfidenceHeatmap from "@/components/ConfidenceHeatmap";
import WidgetCanvas from "@/components/WidgetCanvas";

/**
 * Drives the full Socratic loop:
 *
 *   chat  ──(isFinalTurn)──▶  diagnostic + heatmap  ──(red gaps)──▶  widget
 *
 * Owns the transcript, calls /api/socratic/chat for both turn types, then hands
 * the resulting gaps to /api/socratic/widget and renders the playground.
 */
export default function SocraticWorkspace({
  open,
  concept,
  noteContent = "",
  onClose,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [diagnostic, setDiagnostic] = useState(null);
  const [widget, setWidget] = useState(null);

  const [thinking, setThinking] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [buildingWidget, setBuildingWidget] = useState(false);
  const [error, setError] = useState(null);
  const [widgetError, setWidgetError] = useState(null);

  const scrollRef = useRef(null);

  // The transcript carries one hidden opening turn (see `seedTranscript`). It
  // goes to the API but never to the screen, so both counts filter it out.
  const visible = messages.filter((m) => !m.hidden);
  const answerCount = visible.filter((m) => m.role === "user").length;
  const scored = Boolean(diagnostic);

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

  /**
   * The Messages API must open on a user turn, and the server strips any leading
   * assistant turn to enforce that. Without this seed the Duck's own first
   * question would be dropped from context on every later call — it would end up
   * scoring answers without knowing what it asked.
   */
  const seedTranscript = useCallback(
    () => [
      {
        role: "user",
        content: `I want to be examined on: ${concept}. Ask me your first question.`,
        hidden: true,
      },
    ],
    [concept],
  );

  const toWire = (history) =>
    history.map(({ role, content }) => ({ role, content }));

  const noteContentRef = useRef(noteContent);
  useEffect(() => {
    noteContentRef.current = noteContent;
  }, [noteContent]);

  /** One conversational turn. `history` already ends with the learner's answer. */
  const askDuck = useCallback(
    async (history) => {
      setThinking(true);
      setError(null);
      try {
        const data = await postJson("/api/socratic/chat", {
          noteContent: noteContentRef.current,
          concept,
          conversationHistory: toWire(history),
          isFinalTurn: false,
        });
        setMessages([...history, { role: "assistant", content: data.reply }]);
      } catch (err) {
        setError(err.message);
      } finally {
        setThinking(false);
      }
    },
    [concept],
  );

  /** Builds the playground from whatever the diagnostic flagged. */
  const buildWidget = useCallback(
    async (result) => {
      // Reds are the target, but an all-green session still deserves a
      // playground — fall back to yellows so the widget route has something to
      // build around instead of 400ing.
      const reds = result.heatmap.filter((h) => h.status === "red");
      const gaps = reds.length
        ? reds
        : result.heatmap.filter((h) => h.status === "yellow");

      if (!gaps.length) return; // genuinely nothing to reinforce

      setBuildingWidget(true);
      setWidgetError(null);
      try {
        const data = await postJson("/api/socratic/widget", {
          concept,
          redSubtopics: gaps.map((g) => ({
            subtopic: g.subtopic,
            feedback: g.feedback,
          })),
          recommendedWidget: result.recommendedWidget,
        });
        setWidget(data.widget);
      } catch (err) {
        setWidgetError(err.message);
      } finally {
        setBuildingWidget(false);
      }
    },
    [concept],
  );

  const endSession = useCallback(async () => {
    setScoring(true);
    setError(null);
    try {
      const data = await postJson("/api/socratic/chat", {
        noteContent: noteContentRef.current,
        concept,
        conversationHistory: toWire(messages),
        isFinalTurn: true,
      });
      setDiagnostic(data.diagnostic);
      await buildWidget(data.diagnostic);
    } catch (err) {
      setError(err.message);
    } finally {
      setScoring(false);
    }
  }, [buildWidget, concept, messages]);

  // Fresh session each time the drawer opens on a concept.
  useEffect(() => {
    if (!open || !concept) return;
    const seed = seedTranscript();
    setMessages(seed);
    setInput("");
    setDiagnostic(null);
    setWidget(null);
    setError(null);
    setWidgetError(null);
    askDuck(seed);
  }, [open, concept]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, thinking, diagnostic, widget]);

  function handleSubmit(event) {
    event.preventDefault();
    const answer = input.trim();
    if (!answer || thinking || scoring || scored) return;

    const next = [...messages, { role: "user", content: answer }];
    setMessages(next);
    setInput("");
    askDuck(next);
  }

  const busy = thinking || scoring;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-ink-950/70 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Socratic Rubber Duck"
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-ink-800 bg-ink-900 shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-start gap-3 border-b border-ink-800 px-5 py-4">
          <span className="text-xl leading-none">🦆</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-100">
              Socratic Rubber Duck
            </p>
            <p className="truncate text-xs text-ink-500">{concept}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md px-2 py-1 text-sm text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
          >
            ✕
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="space-y-4 px-5 py-5">
            {visible.map((message, i) => (
              <div
                key={i}
                className={message.role === "user" ? "flex justify-end" : "flex"}
              >
                <p
                  className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-ink-800 text-ink-100"
                      : "border border-duck-500/25 bg-duck-500/5 text-ink-200"
                  }`}
                >
                  {message.content}
                </p>
              </div>
            ))}

            {busy && (
              <p className="text-xs text-ink-500">
                {scoring ? "Scoring your explanation..." : "The Duck is thinking..."}
              </p>
            )}

            {error && (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3.5 py-2.5 text-xs text-rose-400">
                {error}
              </p>
            )}
          </div>

          {scored && <ConfidenceHeatmap diagnostic={diagnostic} />}

          {scored && (buildingWidget || widget || widgetError) && (
            <section className="px-5 py-5">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-ink-500">
                Playground
              </p>
              <WidgetCanvas
                widget={widget}
                loading={buildingWidget}
                error={widgetError}
              />
            </section>
          )}
        </div>

        {scored ? (
          <div className="border-t border-ink-800 px-5 py-4">
            <p className="text-xs text-ink-500">
              Session complete. Close the drawer and flag another block to keep
              going.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="border-t border-ink-800 px-5 py-4">
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
                className="flex-1 resize-none rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="shrink-0 rounded-lg bg-duck-400 px-3.5 py-2 text-sm font-medium text-ink-950 transition-opacity disabled:opacity-30"
              >
                Send
              </button>
            </div>

            <button
              type="button"
              onClick={endSession}
              disabled={busy || answerCount === 0}
              className="mt-2.5 w-full rounded-lg border border-ink-700 px-3 py-2 text-xs text-ink-400 transition-colors hover:border-duck-500/50 hover:text-duck-300 disabled:opacity-30 disabled:hover:border-ink-700 disabled:hover:text-ink-400"
            >
              {answerCount === 0
                ? "Answer at least once to end the session"
                : `End session & score me (${answerCount} answer${answerCount === 1 ? "" : "s"})`}
            </button>
          </form>
        )}
      </aside>
    </>
  );
}

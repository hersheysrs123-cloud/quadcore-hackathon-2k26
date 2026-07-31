"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { conceptFromBlock } from "@/lib/blocks";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function confidenceColor(v) {
  if (v >= 0.7) return "bg-emerald-500";
  if (v >= 0.4) return "bg-duck-400";
  return "bg-rose-500";
}

function Heatmap({ entries }) {
  if (!entries.length) return null;

  return (
    <div className="border-t border-ink-800 px-5 py-4">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-ink-500">
        Understanding map
      </p>
      <ul className="space-y-2.5">
        {entries.map((entry, i) => (
          <li key={`${entry.concept}-${i}`}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-xs text-ink-200">
                {entry.concept}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-ink-500">
                {Math.round(entry.confidence * 100)}%
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-ink-800">
              <div
                className={`h-full rounded-full ${confidenceColor(entry.confidence)}`}
                style={{ width: `${Math.round(entry.confidence * 100)}%` }}
              />
            </div>
            {entry.evidence && (
              <p className="mt-1 text-[11px] leading-snug text-ink-500">
                {entry.evidence}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DuckPane({ open, block, onClose }) {
  const [messages, setMessages] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [status, setStatus] = useState("active");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stubbed, setStubbed] = useState(false);
  const scrollRef = useRef(null);

  const concept = conceptFromBlock(block);

  const runTurn = useCallback(
    async (history) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/socratic/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conceptName: concept,
            messages: history,
            // Mock blocks use short ids; only real rows can be persisted.
            ...(UUID_RE.test(block?.id ?? "") ? { blockId: block.id } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);

        setMessages([...history, { role: "assistant", content: data.reply }]);
        setHeatmap(data.understanding ?? []);
        setStatus(data.status ?? "active");
        setStubbed(Boolean(data.stubbed));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [concept, block?.id],
  );

  // Fresh session whenever the pane opens on a different block.
  useEffect(() => {
    if (!open || !block) return;
    setMessages([]);
    setHeatmap([]);
    setStatus("active");
    setInput("");
    setError(null);
    setStubbed(false);
    runTurn([]);
  }, [open, block, runTurn]);

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
  }, [messages, loading]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const next = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    runTurn(next);
  }

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-ink-950/60 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Socratic Duck"
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-ink-800 bg-ink-900 shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-start gap-3 border-b border-ink-800 px-5 py-4">
          <span className="text-xl leading-none">🦆</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-100">Socratic Duck</p>
            <p className="truncate text-xs text-ink-500">{concept}</p>
          </div>
          {status === "completed" && (
            <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400">
              Done
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md px-2 py-1 text-sm text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
          >
            ✕
          </button>
        </header>

        {stubbed && (
          <p className="border-b border-ink-800 bg-ink-850 px-5 py-2 text-[11px] text-ink-500">
            Placeholder response — set{" "}
            <code className="text-duck-400">ANTHROPIC_API_KEY</code> to get real
            questions.
          </p>
        )}

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex"}
            >
              <p
                className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-ink-800 text-ink-100"
                    : "border border-duck-500/25 bg-duck-500/5 text-ink-200"
                }`}
              >
                {m.content}
              </p>
            </div>
          ))}

          {loading && (
            <p className="text-xs text-ink-500">The Duck is thinking...</p>
          )}

          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3.5 py-2.5 text-xs text-rose-400">
              {error}
            </p>
          )}
        </div>

        <Heatmap entries={heatmap} />

        <form
          onSubmit={handleSubmit}
          className="border-t border-ink-800 px-5 py-4"
        >
          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) handleSubmit(e);
              }}
              placeholder="Explain it in your own words..."
              className="flex-1 resize-none rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:border-duck-500/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 rounded-lg bg-duck-400 px-3.5 py-2 text-sm font-medium text-ink-950 transition-opacity disabled:opacity-30"
            >
              Send
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}

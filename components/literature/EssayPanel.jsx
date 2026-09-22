"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const TABS = [
  { id: "intro", label: "Intro" },
  { id: "conclusion", label: "Conclusion" },
];

/**
 * Intro / Conclusion drafting, kept separately for every poem.
 *
 * The textarea is uncontrolled-by-debounce: local state keeps typing smooth
 * and a 350 ms debounce writes to Dexie, with a flush on blur, tab change and
 * unmount so nothing is lost by navigating away mid-sentence.
 */
export default function EssayPanel({ poem, tab, onTabChange, onSave, onClose }) {
  const [value, setValue] = useState("");
  const timerRef = useRef(null);
  /* Held in a ref so the flush-on-unmount effect can save the right field of
     the right poem without re-subscribing on every keystroke. */
  const pendingRef = useRef(null);

  const key = `${poem?.id || ""}:${tab}`;
  const keyRef = useRef(key);

  useEffect(() => {
    keyRef.current = key;
    setValue(poem ? poem[tab] || "" : "");
    pendingRef.current = null;
  }, [key, poem, tab]);

  const flush = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    onSave(pending.poemId, pending.field, pending.value);
  };

  useEffect(() => flush, []); // flush whatever is in flight when unmounting

  const handleChange = (e) => {
    const next = e.target.value;
    setValue(next);
    if (!poem) return;
    pendingRef.current = { poemId: poem.id, field: tab, value: next };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 350);
  };

  const words = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <aside
      data-testid="literature-essay-panel"
      className="flex w-[330px] shrink-0 flex-col border-l border-ink-800 bg-ink-900"
    >
      <div className="flex gap-0.5 border-b border-ink-800 p-1.5" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              flush();
              onTabChange(t.id);
            }}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:bg-ink-850 hover:text-ink-200"
            }`}
          >
            {t.label}
          </button>
        ))}
        {onClose && (
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="rounded-lg px-2 py-1.5 text-ink-400 transition-colors hover:bg-ink-850 hover:text-ink-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 p-3">
        <textarea
          value={value}
          onChange={handleChange}
          onBlur={flush}
          disabled={!poem}
          spellCheck
          placeholder={
            tab === "intro"
              ? "Write your introduction for this poem here."
              : "Write your conclusion for this poem here."
          }
          className="h-full w-full resize-none rounded-xl border border-ink-800 bg-ink-850 p-3 text-[13px] leading-relaxed text-ink-200 outline-none transition-colors placeholder:text-ink-600 focus:border-duck-500/50 focus:ring-2 focus:ring-duck-400/20 disabled:opacity-50"
        />
      </div>

      <div className="border-t border-ink-800 px-4 py-2 text-[11px] text-ink-500">
        {words} {words === 1 ? "word" : "words"}
      </div>
    </aside>
  );
}

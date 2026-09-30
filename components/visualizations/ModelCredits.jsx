"use client";

import { useState } from "react";
import { Info } from "lucide-react";

/**
 * The Credits button and panel for a scene that loads a licensed 3D model
 * (the heart, the arm). CC BY asks for the credit line, a link to the licence
 * and a note of what was changed; `credit` is one of the tables in
 * lib/heartCredits.js. Sits over the canvas's top-right corner.
 */
export default function ModelCredits({ credit: c }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[60] flex max-w-[22rem] flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`pointer-events-auto flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all ${
          open ? "border-duck-500/50 bg-duck-500/20 text-duck-300" : "border-ink-700 bg-ink-900/85 text-ink-400 hover:border-ink-600 hover:text-ink-200"
        }`}
        title="3D model credits and licence"
      >
        <Info className="h-3 w-3 text-duck-400" />
        Credits
      </button>
      {open && (
        <div className="pointer-events-auto rounded-xl border border-ink-800 bg-ink-950/95 p-3 text-[11px] leading-relaxed text-ink-300 shadow-xl">
          <div className="mb-1 font-semibold text-ink-100">{c.name}</div>
          <p className="mb-2">{c.attribution}.</p>
          <p className="mb-2 text-ink-400">{c.changes}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <a className="text-duck-300 underline-offset-2 hover:underline" href={c.sourceUrl} target="_blank" rel="noreferrer">
              {c.source} source
            </a>
            <a className="text-duck-300 underline-offset-2 hover:underline" href={c.licenseUrlCc} target="_blank" rel="noreferrer">
              {c.license} · commercial use allowed with credit
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

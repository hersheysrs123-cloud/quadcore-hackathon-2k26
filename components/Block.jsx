"use client";

import { BLOCK_TYPE_LABELS } from "@/lib/blocks";

function BlockBody({ block }) {
  const c = block.content_json ?? {};

  switch (block.block_type) {
    case "heading":
      return (
        <h2 className="text-xl font-semibold tracking-tight text-ink-100">
          {c.text}
        </h2>
      );

    case "media":
      return (
        <figure className="rounded-lg border border-ink-800 bg-ink-900 p-4">
          <div className="flex h-32 items-center justify-center rounded border border-dashed border-ink-700 text-xs text-ink-600">
            {c.url ? c.url : "No media attached"}
          </div>
          {c.caption && (
            <figcaption className="mt-2 text-xs text-ink-500">
              {c.caption}
            </figcaption>
          )}
        </figure>
      );

    case "socratic":
      return (
        <div className="rounded-lg border border-duck-500/30 bg-duck-500/5 p-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-duck-400">
            {c.concept || "Flagged concept"}
          </p>
          <p className="text-sm leading-relaxed text-ink-200">{c.prompt}</p>
        </div>
      );

    case "text":
    default:
      return (
        <p className="text-[15px] leading-relaxed text-ink-200">{c.text}</p>
      );
  }
}

export default function Block({ block, onTalkToDuck }) {
  const isSocratic = block.block_type === "socratic";

  return (
    <div className="group relative rounded-lg px-3 py-2.5 transition-colors hover:bg-ink-900/60">
      <span className="absolute -left-16 top-3 hidden w-12 text-right text-[10px] uppercase tracking-wider text-ink-600 group-hover:block">
        {BLOCK_TYPE_LABELS[block.block_type] ?? block.block_type}
      </span>

      <BlockBody block={block} />

      <div
        className={`mt-2.5 ${isSocratic ? "" : "opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"}`}
      >
        <button
          type="button"
          onClick={() => onTalkToDuck(block)}
          className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-xs font-medium text-ink-200 transition-colors hover:border-duck-500/50 hover:bg-duck-500/10 hover:text-duck-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-duck-400"
        >
          Talk to Duck 🦆
        </button>
      </div>
    </div>
  );
}

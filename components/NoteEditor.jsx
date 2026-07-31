"use client";

import Block from "@/components/Block";

/**
 * Locale and timeZone are both pinned deliberately.
 *
 * Passing `undefined` as the locale means "use the runtime default", and the
 * Node server's default rarely matches the browser's — that renders "Jul 31" on
 * the server and "31 Jul" on the client, which React reports as a hydration
 * mismatch. Pinning the timeZone kills the same class of bug for servers running
 * in a different zone than the viewer.
 *
 * Swap "en-US" for "en-GB" if you prefer day-first; just keep it explicit.
 */
function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function NoteEditor({ note, activeSpace, onTalkToDuck }) {
  return (
    <div className="mx-auto max-w-3xl px-10 py-12">
      <header className="mb-10">
        <div className="mb-3 flex items-center gap-2 text-xs text-ink-500">
          <span>{activeSpace}</span>
          <span aria-hidden="true">/</span>
          <span>Edited {formatDate(note.updated_at)}</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-100">
          {note.title}
        </h1>
      </header>

      <div className="space-y-1">
        {note.blocks.map((block) => (
          <Block key={block.id} block={block} onTalkToDuck={onTalkToDuck} />
        ))}
      </div>

      <button
        type="button"
        className="mt-4 w-full rounded-lg border border-dashed border-ink-800 px-4 py-3 text-left text-sm text-ink-600 transition-colors hover:border-ink-700 hover:text-ink-500"
      >
        + Add block
      </button>
    </div>
  );
}

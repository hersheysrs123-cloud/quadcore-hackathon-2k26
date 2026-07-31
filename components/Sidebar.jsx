"use client";

export default function Sidebar({ spaces, activeSpace, onSelectSpace, note }) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-900">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="text-lg leading-none">🦆</span>
        <span className="text-sm font-semibold tracking-tight text-ink-100">
          SocraticOS
        </span>
      </div>

      <nav className="px-3">
        <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-ink-500">
          Spaces
        </p>
        <ul className="space-y-0.5">
          {spaces.map((space) => {
            const isActive = space.name === activeSpace;
            return (
              <li key={space.name}>
                <button
                  type="button"
                  onClick={() => onSelectSpace(space.name)}
                  aria-current={isActive ? "true" : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-ink-800 text-ink-100"
                      : "text-ink-400 hover:bg-ink-850 hover:text-ink-200"
                  }`}
                >
                  <span className="text-base leading-none">{space.icon}</span>
                  <span className="flex-1 truncate">{space.name}</span>
                  {isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-duck-400" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6 px-3">
        <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-ink-500">
          {activeSpace} · Notes
        </p>
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md bg-ink-800 px-2.5 py-2 text-left text-sm text-ink-100"
            >
              <span className="truncate">{note.title}</span>
            </button>
          </li>
        </ul>
        <button
          type="button"
          className="mt-2 w-full rounded-md border border-dashed border-ink-700 px-2.5 py-2 text-left text-sm text-ink-500 transition-colors hover:border-ink-600 hover:text-ink-400"
        >
          + New note
        </button>
      </div>

      <div className="mt-auto border-t border-ink-800 px-5 py-4">
        <p className="text-[11px] leading-relaxed text-ink-500">
          Blocks you flag get quizzed by the Duck until it can score what you
          actually know.
        </p>
      </div>
    </aside>
  );
}

"use client";

import { useEffect } from "react";

/**
 * The right-hand panel every LLM surface lives in.
 *
 * Stays mounted while closed and slides out on a transform, so the content
 * doesn't vanish mid-animation. That is also why callers keep their state
 * around instead of clearing it on close.
 */
export default function Drawer({
  open,
  onClose,
  icon,
  title,
  subtitle,
  actions,
  footer,
  scrollRef,
  children,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-[60] bg-ink-950/70 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* A closed drawer stays mounted so it can slide out, which means it is
          still in the accessibility tree and still in the tab order. `inert`
          takes it out of both — without it a screen reader finds two dialogs
          and Tab walks into the panel that isn't on screen. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        inert={!open}
        className={`fixed right-0 top-0 z-[70] flex h-full w-full max-w-xl flex-col border-l border-ink-800 bg-ink-900 shadow-2xl shadow-ink-950/80 transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-ink-800 px-5 py-4">
          <span className="text-xl leading-none">{icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-100">{title}</p>
            {subtitle && (
              <p className="truncate text-xs text-ink-500" title={subtitle}>
                {subtitle}
              </p>
            )}
          </div>
          {actions}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md px-2 py-1 text-sm text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
          >
            ✕
          </button>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-ink-800">{footer}</div>
        )}
      </aside>
    </>
  );
}

/** Shared failure state, so an error looks the same wherever it surfaces. */
export function DrawerError({ message, onRetry }) {
  if (!message) return null;

  return (
    <div className="rounded-xl border border-gap-500/30 bg-gap-500/5 px-4 py-3">
      <p className="flex items-start gap-2 text-xs leading-relaxed text-gap-500">
        <span aria-hidden="true">⚠</span>
        <span>{message}</span>
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2.5 rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-300 transition-colors hover:border-duck-500/50 hover:text-duck-300"
        >
          Try again
        </button>
      )}
    </div>
  );
}

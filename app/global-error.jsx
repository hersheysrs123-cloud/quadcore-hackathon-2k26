"use client";

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-4 text-center text-ink-100">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-duck-500/30 bg-duck-500/10 text-2xl mb-4">
          🦆
        </div>
        <h1 className="text-xl font-bold text-ink-100">Application Error</h1>
        <p className="mt-2 text-xs text-ink-400">{error?.message || "A critical error occurred."}</p>
        <button
          onClick={() => reset()}
          className="mt-6 rounded-xl bg-duck-400 px-4 py-2 text-xs font-bold text-ink-950 hover:bg-duck-300 transition-all cursor-pointer"
        >
          Reload SocraticOS
        </button>
      </body>
    </html>
  );
}

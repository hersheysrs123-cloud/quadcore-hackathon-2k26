"use client";

// global-error replaces the root layout, so it brings its own stylesheet;
// without it every class below rendered unstyled.
import "./globals.css";
import { MalloDefs, MalloIcon } from "@/components/brand/Brand";

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-4 text-center text-ink-100">
        <MalloDefs />
        <MalloIcon mood="dizzy" className="mb-5 h-16 w-16" title="Mallo, dizzy" />
        <h1 className="text-xl font-bold text-ink-100">Application Error</h1>
        <p className="mt-2 text-xs text-ink-400">{error?.message || "A critical error occurred."}</p>
        <button
          onClick={() => reset()}
          className="mt-6 rounded-xl bg-brand-400 px-4 py-2 text-xs font-bold text-ink-950 hover:bg-brand-300 transition-all cursor-pointer"
        >
          Reload Learnory
        </button>
      </body>
    </html>
  );
}

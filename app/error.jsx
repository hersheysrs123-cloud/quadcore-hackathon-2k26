"use client";

import { useEffect } from "react";
import { MalloIcon } from "@/components/brand/Brand";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center bg-ink-950 text-ink-100">
      <MalloIcon mood="dizzy" className="h-14 w-14" title="Mallo, dizzy" />
      <h2 className="text-base font-bold text-ink-200">Something went wrong</h2>
      <p className="text-xs text-ink-400">{error?.message || "An unexpected error occurred."}</p>
      <button
        onClick={() => reset()}
        className="rounded-lg bg-brand-400 px-4 py-2 text-xs font-bold text-ink-950 hover:bg-brand-300 transition-all cursor-pointer"
      >
        Try again
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import WidgetCanvas from "@/components/WidgetCanvas";

// ─── 3D Visualizations Studio ─────────────────────────────────────────
// Studio for rendering interactive 3D visualizations generated from
// Socratic Duck diagnostic sessions or custom models saved to Supabase.
// ─────────────────────────────────────────────────────────────────────

export default function ThreeDView() {
  const [customWidgets, setCustomWidgets] = useState([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState(null);

  // Fetch saved 3D visualization models on mount
  useEffect(() => {
    async function loadVisualizations() {
      try {
        const res = await fetch("/api/visualizations");
        const data = await res.json();
        if (data.visualizations && data.visualizations.length > 0) {
          const formatted = data.visualizations.map((v) => ({
            id: v.id,
            title: v.title || v.concept_name || "3D Model",
            widget: v.widget_json,
          }));
          setCustomWidgets(formatted);
          setSelectedWidgetId(formatted[0].id);
        }
      } catch {
        // Fallback if network/DB table not populated yet
      }
    }
    loadVisualizations();
  }, []);

  const activeWidgetObj = customWidgets.find((w) => w.id === selectedWidgetId);

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧊</span>
            <h1 className="text-2xl font-bold tracking-tight text-ink-100">
              3D Interactive Visualizations
            </h1>
          </div>
          <p className="mt-1 text-xs text-ink-400">
            Real-time 3D spatial models saved to Supabase to build mechanical intuition for your flagged concepts.
          </p>
        </div>

        {customWidgets.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-ink-800 bg-ink-900 p-1.5 shadow-lg">
            {customWidgets.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedWidgetId(w.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedWidgetId === w.id
                    ? "border border-duck-500/30 bg-duck-500/20 text-duck-300 shadow-sm"
                    : "text-ink-400 hover:text-ink-200"
                }`}
              >
                {w.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {customWidgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-800 bg-ink-900/50 py-16 px-6 text-center shadow-xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-duck-500/30 bg-duck-500/10 text-3xl">
            🦆
          </div>
          <h2 className="mt-4 text-base font-semibold text-ink-100">
            No 3D Visualizations Saved Yet
          </h2>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-400">
            Flag a concept or text block in your notes and click <strong className="text-duck-300">"🦆 Test Understanding with Duck"</strong>. When gaps are found during a diagnostic session, Gemini generates custom 3D models targeted at your specific knowledge gaps and saves them directly to Supabase!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-ink-800 bg-ink-900 p-5 shadow-2xl lg:col-span-2">
            <div className="mb-4 flex items-center justify-between border-b border-ink-800 pb-3">
              <h2 className="text-sm font-semibold text-ink-100">
                {activeWidgetObj?.title || "Active 3D Model"}
              </h2>
              <span className="rounded-full border border-ink-700 bg-ink-850 px-2.5 py-1 text-[10px] text-ink-400">
                Interactive 3D Canvas
              </span>
            </div>
            {activeWidgetObj && <WidgetCanvas widget={activeWidgetObj.widget} />}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-duck-500/20 bg-duck-500/5 p-4">
              <p className="text-xs font-semibold text-duck-300">💡 Supabase Persistence</p>
              <p className="mt-1 text-xs text-ink-300 leading-relaxed">
                Visual models saved to Supabase dynamically render camera perspective, rotational vectors, and gap status overlays.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

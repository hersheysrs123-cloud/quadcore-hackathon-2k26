"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useMediaQuery } from "usehooks-ts";
import {
  BookOpen,
  Download,
  Eye,
  EyeOff,
  List,
  NotebookPen,
  PanelRight,
  Pencil,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { db } from "@/lib/db";
import {
  countAnnotations,
  countPhrases,
  migrate,
  numberMap,
  orderAnnotations,
} from "@/lib/literature";
import {
  addAnnotation,
  createPoem,
  deleteAnnotation,
  deletePoem,
  exportPoemsJson,
  importPoems,
  initLiteratureData,
  loadLiteratureUI,
  saveLiteratureUI,
  setEssay,
  updateAnnotation,
  updatePoemContent,
} from "@/lib/literatureService";
import PoemCanvas from "@/components/literature/PoemCanvas";
import AnalysisPanel from "@/components/literature/AnalysisPanel";
import AnnotationPopover, { sameRange } from "@/components/literature/AnnotationPopover";
import PoemLinesModal, { ConfirmDialog } from "@/components/literature/PoemLinesModal";
import EssayPanel from "@/components/literature/EssayPanel";
import ImportPoemsModal from "@/components/literature/ImportPoemsModal";

/**
 * LiteratureView — the Literature section.
 *
 * Three columns, matching the rest of the workspace: the poem list, the poem
 * itself (with an optional analysis panel), and the intro/conclusion drafting
 * panel. Poems live in Dexie (`db.poems`), scoped to the active space; the
 * view preferences (mode, tab, selection, panel) live in localStorage because
 * they are per-browser, not per-workspace.
 *
 * Two modes, and the difference matters:
 *   · Normal — hover or click an annotation to read it. The poem stays clean.
 *   · Test   — every analysis is blurred; click to reveal. The POEM is never
 *              blurred, because the thing being recalled is your reading of
 *              it, not the text.
 */
export default function LiteratureView({ activeSpace = "School" }) {
  const [ui, setUi] = useState(() => ({
    selectedPoemId: null,
    mode: "normal",
    tab: "intro",
    annPanelOpen: false,
  }));
  const [uiLoaded, setUiLoaded] = useState(false);
  const [toast, setToast] = useState("");
  const [linesModal, setLinesModal] = useState(null); // null | { poem } | { poem: null }
  const [importPreview, setImportPreview] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  /* Annotation interaction state */
  const [popover, setPopover] = useState(null); // {type, rect, pinned, ...}
  const [hotIds, setHotIds] = useState([]);
  const [revealed, setRevealed] = useState({});
  const [pendingRange, setPendingRange] = useState(null);
  const [floatAdd, setFloatAdd] = useState(null); // {rect}

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const hoverTimerRef = useRef(null);
  const leaveTimerRef = useRef(null);
  const popHoveredRef = useRef(false);
  const toastTimerRef = useRef(null);
  /* Test mode force-opens the analysis panel; this remembers what the user
     actually prefers so leaving test mode restores it. */
  const panelPrefRef = useRef(false);

  /* Four fixed columns (rail 68 + list 244 + analysis 322 + essay 330) leave
     the poem nothing below ~1600px, so each side panel becomes an overlay
     drawer once it stops fitting rather than squeezing the poem to nothing.
     `useMediaQuery` comes from usehooks-ts, already used across the app. */
  const essayFits = useMediaQuery("(min-width: 1536px)");
  const analysisFits = useMediaQuery("(min-width: 1280px)");
  const listFits = useMediaQuery("(min-width: 900px)");
  const [drawer, setDrawer] = useState(null); // null | "list" | "analysis" | "essay"

  const showToast = useCallback((msg, ms = 2600) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), ms);
  }, []);

  /* ── data ──────────────────────────────────────────────────── */

  const poems = useLiveQuery(
    async () => {
      if (!db.poems) return [];
      const rows = await db.poems.where("spaceId").equals(activeSpace).toArray();
      return rows.sort((a, b) => (a.created || 0) - (b.created || 0));
    },
    [activeSpace],
    undefined
  );

  const loading = poems === undefined;
  const poemList = poems || [];

  useEffect(() => {
    const saved = loadLiteratureUI();
    setUi(saved);
    panelPrefRef.current = saved.annPanelOpen;
    setUiLoaded(true);
    initLiteratureData(activeSpace).then(({ adopted }) => {
      if (adopted > 0) {
        showToast(`Imported ${adopted} ${adopted === 1 ? "poem" : "poems"} from your Literature app.`, 5000);
      }
    });
    // Intentionally boot-only: adoption and seeding must happen exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (uiLoaded) saveLiteratureUI(ui);
  }, [ui, uiLoaded]);

  const poem = useMemo(
    () => poemList.find((p) => p.id === ui.selectedPoemId) || poemList[0] || null,
    [poemList, ui.selectedPoemId]
  );

  /* Keep the stored selection honest when the chosen poem disappears. */
  useEffect(() => {
    if (!uiLoaded || loading) return;
    if (poem && ui.selectedPoemId !== poem.id) {
      setUi((u) => ({ ...u, selectedPoemId: poem.id }));
    } else if (!poem && ui.selectedPoemId) {
      setUi((u) => ({ ...u, selectedPoemId: null }));
    }
  }, [poem, ui.selectedPoemId, uiLoaded, loading]);

  const numbers = useMemo(
    () => (poem ? numberMap(orderAnnotations(poem.annotations || [])) : {}),
    [poem]
  );

  const testMode = ui.mode === "test";
  const panelOpen = testMode || ui.annPanelOpen;

  /* ── popover lifecycle ─────────────────────────────────────── */

  const clearTimers = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    hoverTimerRef.current = null;
    leaveTimerRef.current = null;
  };

  const closePopover = useCallback((force = false) => {
    let closed = false;
    setPopover((p) => {
      /* The editor holds unsaved writing: only Save, Cancel or Esc may close
         it, never an incidental click or a hover timeout. */
      if (p?.type === "edit" && !force) return p;
      closed = true;
      return null;
    });
    if (closed) {
      clearTimers();
      popHoveredRef.current = false;
    }
    return closed;
  }, []);

  const openView = useCallback(
    (annId, rect, pinned = true) => {
      if (!poem) return;
      const annotation = (poem.annotations || []).find((a) => a.id === annId);
      if (!annotation) return;
      clearTimers();
      setPopover({ type: "view", annotation, rect, pinned });
    },
    [poem]
  );

  /* Re-resolve the open popover's annotation against fresh data, so an edit
     or a reveal does not leave a stale object on screen. */
  useEffect(() => {
    if (!poem || !popover) return;
    if (popover.type === "view") {
      const fresh = (poem.annotations || []).find((a) => a.id === popover.annotation.id);
      if (!fresh) return setPopover(null);
      if (fresh !== popover.annotation) setPopover((p) => ({ ...p, annotation: fresh }));
    }
  }, [poem, popover]);

  /* ── selection ─────────────────────────────────────────────── */

  const handleSelectionChange = useCallback(
    ({ range, rect, anchoredInPoem }) => {
      /* Focusing a textarea wipes the document selection in every browser, so
         the last real poem selection is kept alive while the editor is open —
         that is what keeps "+ Add selected phrase" usable. */
      if (range) setPendingRange(range);
      else if (anchoredInPoem) setPendingRange(null);

      setPopover((p) => {
        if (p?.type === "edit") {
          setFloatAdd(null);
          return p;
        }
        setFloatAdd(range && rect ? { rect } : null);
        return p;
      });
    },
    []
  );

  const startCreate = useCallback(() => {
    if (!pendingRange || !poem) return;
    const rect =
      canvasRef.current?.getSelectionRect() || {
        left: window.innerWidth / 2 - 185,
        right: window.innerWidth / 2 + 185,
        top: 140,
        bottom: 160,
        width: 370,
        height: 20,
      };
    setFloatAdd(null);
    setPopover({ type: "edit", annotation: null, ranges: [pendingRange], rect, pinned: true });
  }, [pendingRange, poem]);

  /* ── hover ─────────────────────────────────────────────────── */

  const handleHoverIds = useCallback(
    (ids, anchor) => {
      setHotIds(ids);
      if (!ids.length) {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        setPopover((p) => {
          if (p?.type !== "view" || p.pinned) return p;
          if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
          leaveTimerRef.current = setTimeout(() => {
            leaveTimerRef.current = null;
            /* Tracked with real enter/leave events: :hover is not reliably
               recomputed for elements that appear under the cursor. */
            if (popHoveredRef.current) return;
            closePopover();
          }, 220);
          return p;
        });
        return;
      }

      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = null;
      }
      if (testMode) return; // no spoilers while testing
      if (ids.length !== 1 || !anchor) return;

      setPopover((p) => {
        if (p?.type === "edit" || p?.pinned) return p;
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = setTimeout(() => {
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed) return;
          openView(ids[0], anchor.getBoundingClientRect(), false);
        }, 380);
        return p;
      });
    },
    [testMode, openView, closePopover]
  );

  /* ── reveal ────────────────────────────────────────────────── */

  const toggleReveal = useCallback((annId) => {
    setRevealed((r) => {
      const next = { ...r };
      if (next[annId]) delete next[annId];
      else next[annId] = 1;
      return next;
    });
  }, []);

  const revealAll = useCallback(() => {
    if (!poem) return;
    const next = {};
    (poem.annotations || []).forEach((a) => {
      next[a.id] = 1;
    });
    setRevealed(next);
  }, [poem]);

  /* Switching poems must not carry revealed answers across. */
  useEffect(() => {
    setRevealed({});
    closePopover(true);
  }, [poem?.id, closePopover]);

  /* ── writes ────────────────────────────────────────────────── */

  const handleSaveAnnotation = useCallback(
    async ({ text, label }) => {
      if (!poem || !popover) return;
      const { annotation, ranges } = popover;
      if (annotation) {
        await updateAnnotation(poem.id, annotation.id, { ranges, text, label });
      } else {
        await addAnnotation(poem.id, ranges, text, label);
      }
      closePopover(true);
      canvasRef.current?.clearSelection();
      setPendingRange(null);
      setFloatAdd(null);
    },
    [poem, popover, closePopover]
  );

  const handleDeleteAnnotation = useCallback(
    (annotation) => {
      if (!poem || !annotation) return;
      setConfirmState({
        title: "Delete this analysis?",
        message:
          "This removes the highlight and the analysis you wrote for it. This cannot be undone.",
        confirmText: "Delete",
        onConfirm: async () => {
          setConfirmState(null);
          closePopover(true);
          await deleteAnnotation(poem.id, annotation.id);
          showToast("Analysis deleted.");
        },
      });
    },
    [poem, closePopover, showToast]
  );

  const handleSaveLines = useCallback(
    async ({ title, lines, lineMap }) => {
      const target = linesModal?.poem;
      setLinesModal(null);
      if (!target) {
        const created = await createPoem({ title, lines, spaceId: activeSpace });
        if (created) setUi((u) => ({ ...u, selectedPoemId: created.id }));
        showToast("Poem added.");
        return;
      }
      const result = await updatePoemContent(target.id, title, lines, lineMap);
      if (result?.droppedAnns) {
        showToast(
          `${result.droppedAnns} ${
            result.droppedAnns === 1 ? "annotation was" : "annotations were"
          } removed because their lines were deleted.`,
          4200
        );
      } else if (result?.droppedParts) {
        showToast(
          `${result.droppedParts} highlighted phrase(s) no longer matched and were removed.`,
          4200
        );
      } else {
        showToast("Poem saved.");
      }
    },
    [linesModal, activeSpace, showToast]
  );

  const handleDeletePoem = useCallback(
    async (id) => {
      setLinesModal(null);
      await deletePoem(id);
      setUi((u) => (u.selectedPoemId === id ? { ...u, selectedPoemId: null } : u));
      showToast("Poem deleted.");
    },
    [showToast]
  );

  /* ── import / export ───────────────────────────────────────── */

  const handleExport = useCallback(async () => {
    const json = await exportPoemsJson(activeSpace);
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `literature-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast("Backup downloaded.");
  }, [activeSpace, showToast]);

  const handleImportFile = useCallback(
    (file) => {
      const reader = new FileReader();
      reader.onload = () => {
        let raw;
        try {
          raw = JSON.parse(String(reader.result));
        } catch (err) {
          showToast("That file is not valid JSON.", 4000);
          return;
        }
        try {
          setImportPreview({ raw, preview: migrate(raw) });
        } catch (err) {
          showToast("That file does not look like a Literature backup.", 4200);
        }
      };
      reader.readAsText(file);
    },
    [showToast]
  );

  const runImport = useCallback(
    async (mode) => {
      if (!importPreview) return;
      const { raw } = importPreview;
      setImportPreview(null);
      const n = await importPoems(raw, mode, activeSpace);
      showToast(
        mode === "replace" ? "Backup restored." : `Added ${n} ${n === 1 ? "poem" : "poems"}.`
      );
    },
    [importPreview, activeSpace, showToast]
  );

  /* ── keyboard ──────────────────────────────────────────────── */

  useEffect(() => {
    const isTyping = (e) => {
      const t = e.target;
      return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    };

    const onKey = (e) => {
      if (linesModal || importPreview || confirmState) return; // those own Esc
      if (e.key === "Escape") {
        if (popover) {
          e.stopPropagation();
          closePopover(true);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "e" || e.key === "E")) {
        if (pendingRange && !isTyping(e)) {
          e.preventDefault();
          startCreate();
        }
        return;
      }
      if (isTyping(e)) return;
      /* Alt+T on macOS emits "†" rather than "t". */
      if (e.altKey && (e.key === "t" || e.key === "T" || e.key === "†")) {
        e.preventDefault();
        setUi((u) => ({ ...u, mode: u.mode === "test" ? "normal" : "test" }));
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [popover, pendingRange, startCreate, closePopover, linesModal, importPreview, confirmState]);

  /* Clicking outside the poem, panel or popover dismisses a pinned popover. */
  useEffect(() => {
    const onDown = (e) => {
      if (!popover) return;
      if (popover.type === "edit") return;
      if (e.target.closest?.("[data-lit-popover]")) return;
      if (e.target.closest?.("[data-lit-float-add]")) return;
      if (e.target.closest?.(".lit-poem")) return;
      if (e.target.closest?.("[data-lit-panel]")) return;
      closePopover();
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [popover, closePopover]);

  /* Scroll and resize invalidate every anchored rect we are holding. */
  useEffect(() => {
    const onResize = () => {
      setPopover((p) => (p && p.type !== "edit" ? null : p));
      setFloatAdd(null);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => () => clearTimers(), []);

  /* ── derived header text ───────────────────────────────────── */

  const subline = useMemo(() => {
    if (!poem) return "";
    const lines = poem.lines.filter((l) => l.trim() !== "").length;
    const anns = countAnnotations(poem);
    const parts = countPhrases(poem);
    return (
      `${lines} ${lines === 1 ? "line" : "lines"}  ·  ` +
      `${anns} ${anns === 1 ? "analysis note" : "analysis notes"}` +
      (parts > anns ? `  ·  ${parts} highlighted phrases` : "")
    );
  }, [poem]);

  /* ── render ────────────────────────────────────────────────── */

  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
      {/* ── poem list ─────────────────────────────────────────── */}
      <aside
        data-testid="literature-poem-list"
        className={
          listFits
            ? "flex w-[244px] shrink-0 flex-col border-r border-ink-800 bg-ink-900"
            : `absolute inset-y-0 left-0 z-[120] flex w-[244px] max-w-[85vw] flex-col border-r border-ink-800 bg-ink-900 shadow-2xl transition-transform duration-200 ${
                drawer === "list" ? "translate-x-0" : "-translate-x-full"
              }`
        }
      >
        <div className="flex items-center gap-2 border-b border-ink-800 px-3 py-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-ink-300">Poems</h2>
          <span className="rounded-full border border-ink-750 bg-ink-850 px-2 py-0.5 text-[10px] font-bold tabular-nums text-ink-400">
            {poemList.length}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            title="Add poem"
            onClick={() => setLinesModal({ poem: null })}
            className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-duck-300"
          >
            <Plus className="h-4 w-4" />
          </button>
          {!listFits && (
            <button
              type="button"
              title="Close"
              onClick={() => setDrawer(null)}
              className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="space-y-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-9 animate-pulse rounded-xl bg-ink-850" />
              ))}
            </div>
          ) : poemList.length === 0 ? (
            <p className="px-2 py-6 text-center text-[12px] text-ink-500">No poems yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {poemList.map((p) => {
                const n = countAnnotations(p);
                const active = p.id === poem?.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      title={p.title}
                      onClick={() => {
                        setUi((u) => ({ ...u, selectedPoemId: p.id }));
                        if (!listFits) setDrawer(null);
                      }}
                      className={`flex w-full items-center gap-1.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition-colors ${
                        active
                          ? "bg-ink-800 font-semibold text-ink-100"
                          : "text-ink-300 hover:bg-ink-850 hover:text-ink-100"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{p.title}</span>
                      {p.sample && (
                        <span className="shrink-0 rounded border border-ink-750 bg-ink-850 px-1 py-0.5 text-[9px] font-semibold uppercase text-ink-500">
                          Sample
                        </span>
                      )}
                      <span
                        title={`${n} ${n === 1 ? "annotation" : "annotations"}`}
                        className={`shrink-0 rounded-full border border-ink-750 px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                          n ? "bg-duck-500/15 text-duck-300" : "bg-ink-850 text-ink-600"
                        }`}
                      >
                        {n}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        <div className="flex gap-1 border-t border-ink-800 p-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-ink-750 bg-ink-850 px-2 py-1.5 text-[11px] font-semibold text-ink-300 transition-colors hover:border-ink-700 hover:text-ink-100"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-ink-750 bg-ink-850 px-2 py-1.5 text-[11px] font-semibold text-ink-300 transition-colors hover:border-ink-700 hover:text-ink-100"
          >
            <Upload className="h-3.5 w-3.5" />
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </aside>

      {/* ── poem ──────────────────────────────────────────────── */}
      <section className="flex min-w-0 flex-1 flex-col">
        {!poem ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <BookOpen className="h-10 w-10 text-ink-600" />
            <h1 className="text-lg font-bold text-ink-100">No poem selected</h1>
            <p className="max-w-sm text-sm text-ink-400">
              Add a poem to start annotating. Select any words in it and attach your analysis — one
              note can cover several phrases at once.
            </p>
            <button
              type="button"
              onClick={() => setLinesModal({ poem: null })}
              className="mt-1 rounded-xl bg-duck-400 px-4 py-2 text-xs font-bold text-ink-950 transition-colors hover:bg-duck-300"
            >
              Add poem
            </button>
          </div>
        ) : (
          <>
            <div className="shrink-0 border-b border-ink-800 px-8 py-4">
              <div className="flex items-start gap-4">
                <h1 className="min-w-0 flex-1 font-note-serif text-2xl font-semibold leading-tight text-ink-100">
                  {poem.title}
                </h1>
                <div className="flex shrink-0 items-center gap-1">
                  {/* Narrow screens: the columns that no longer fit become
                      drawers, reached from here. */}
                  {!listFits && (
                    <button
                      type="button"
                      title="Poems"
                      onClick={() => setDrawer((d) => (d === "list" ? null : "list"))}
                      className="rounded-xl p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
                    >
                      <List className="h-4 w-4" />
                    </button>
                  )}

                  {/* Mode switch: the single most-used control here. */}
                  <div className="mr-1 flex items-center rounded-xl border border-ink-800 bg-ink-850 p-0.5">
                    {[
                      { id: "normal", label: "Normal" },
                      { id: "test", label: "Test" },
                    ].map(({ id: m, label }) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setUi((u) => {
                            if (u.mode === m) return u;
                            if (m === "test") panelPrefRef.current = u.annPanelOpen;
                            return {
                              ...u,
                              mode: m,
                              annPanelOpen: m === "test" ? u.annPanelOpen : panelPrefRef.current,
                            };
                          });
                          closePopover(true);
                        }}
                        title={m === "test" ? "Test mode (Alt+T)" : "Normal mode (Alt+T)"}
                        aria-pressed={ui.mode === m}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                          ui.mode === m
                            ? "bg-ink-700 text-ink-100"
                            : "text-ink-400 hover:bg-ink-800 hover:text-ink-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {testMode && (
                    <>
                      <button
                        type="button"
                        onClick={revealAll}
                        className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="hidden xl:inline">Reveal all</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRevealed({})}
                        className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                        <span className="hidden xl:inline">Hide all</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setLinesModal({ poem })}
                    className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">Edit lines</span>
                  </button>

                  <button
                    type="button"
                    aria-pressed={analysisFits ? panelOpen : drawer === "analysis"}
                    disabled={testMode && analysisFits}
                    title={
                      testMode && analysisFits
                        ? "Always shown in Test mode"
                        : "Toggle the analysis panel"
                    }
                    onClick={() => {
                      if (!analysisFits) {
                        setDrawer((d) => (d === "analysis" ? null : "analysis"));
                        return;
                      }
                      const next = !ui.annPanelOpen;
                      panelPrefRef.current = next;
                      setUi((u) => ({ ...u, annPanelOpen: next }));
                    }}
                    className={`rounded-xl p-1.5 transition-colors disabled:opacity-40 ${
                      (analysisFits ? panelOpen : drawer === "analysis")
                        ? "text-duck-400"
                        : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"
                    }`}
                  >
                    <PanelRight className="h-4 w-4" />
                  </button>

                  {!essayFits && (
                    <button
                      type="button"
                      title="Intro & conclusion"
                      aria-pressed={drawer === "essay"}
                      onClick={() => setDrawer((d) => (d === "essay" ? null : "essay"))}
                      className={`rounded-xl p-1.5 transition-colors ${
                        drawer === "essay"
                          ? "text-duck-400"
                          : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"
                      }`}
                    >
                      <NotebookPen className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-1 text-[11.5px] text-ink-500">{subline}</div>

              {poem.sample && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl border border-ink-800 bg-ink-850 px-3 py-2 text-[11.5px] text-ink-400">
                  <span>
                    This is a sample poem included to show how the app works — overlapping
                    annotations, two readings of the same words, and one note across a rhyme pair.
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmState({
                        title: "Delete the sample poem?",
                        message:
                          "This removes the demonstration poem and its example annotations.",
                        confirmText: "Delete sample",
                        onConfirm: async () => {
                          setConfirmState(null);
                          await handleDeletePoem(poem.id);
                        },
                      })
                    }
                    className="font-semibold text-duck-300 underline underline-offset-2 hover:text-duck-200"
                  >
                    Delete sample
                  </button>
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-1">
              <div className="min-w-0 flex-1 overflow-y-auto px-10 pb-32 pt-8">
                <PoemCanvas
                  ref={canvasRef}
                  poem={poem}
                  hotIds={hotIds}
                  openAnnId={popover?.annotation?.id || null}
                  onSelectionChange={handleSelectionChange}
                  onHoverIds={handleHoverIds}
                  onMarkerClick={(id, rect) => openView(id, rect, true)}
                  onSegmentClick={(ids, rect) => {
                    if (ids.length === 1) openView(ids[0], rect, true);
                    else if (ids.length > 1) {
                      const anns = ids
                        .map((id) => (poem.annotations || []).find((a) => a.id === id))
                        .filter(Boolean);
                      clearTimers();
                      setPopover({ type: "choose", annotations: anns, rect, pinned: true });
                    }
                  }}
                  onBackgroundClick={() => closePopover()}
                />
                {!testMode && (
                  <p className="mt-8 text-[11.5px] text-ink-600">
                    Select any words in the poem to attach analysis.
                  </p>
                )}
              </div>

              {(analysisFits ? panelOpen : drawer === "analysis") && (
                <div
                  data-lit-panel
                  className={
                    analysisFits
                      ? "flex"
                      : "absolute inset-y-0 right-0 z-[120] flex shadow-2xl"
                  }
                >
                  <AnalysisPanel
                    poem={poem}
                    testMode={testMode}
                    revealed={revealed}
                    openAnnId={popover?.annotation?.id || null}
                    hotIds={hotIds}
                    onCardHover={setHotIds}
                    onCardClick={(id) => {
                      if (testMode) return toggleReveal(id);
                      const scrolled = canvasRef.current?.scrollToAnnotation(id);
                      setTimeout(
                        () => {
                          const rect = canvasRef.current?.rectForAnnotation(id);
                          if (rect) openView(id, rect, true);
                        },
                        scrolled ? 180 : 0
                      );
                    }}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* ── intro / conclusion ────────────────────────────────── */}
      {essayFits ? (
        <EssayPanel
          poem={poem}
          tab={ui.tab}
          onTabChange={(tab) => setUi((u) => ({ ...u, tab }))}
          onSave={(poemId, field, value) => setEssay(poemId, field, value)}
        />
      ) : (
        <div
          className={`absolute inset-y-0 right-0 z-[130] flex shadow-2xl transition-transform duration-200 ${
            drawer === "essay" ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <EssayPanel
            poem={poem}
            tab={ui.tab}
            onTabChange={(tab) => setUi((u) => ({ ...u, tab }))}
            onSave={(poemId, field, value) => setEssay(poemId, field, value)}
            onClose={() => setDrawer(null)}
          />
        </div>
      )}

      {/* One scrim for whichever drawer is open. */}
      {drawer && (
        <div
          onClick={() => setDrawer(null)}
          className="absolute inset-0 z-[110] bg-ink-950/50 backdrop-blur-xs"
          aria-hidden="true"
        />
      )}

      {/* ── floating "Add analysis" ───────────────────────────── */}
      {floatAdd && !testMode && (
        <FloatingAdd rect={floatAdd.rect} onClick={startCreate} />
      )}

      {/* ── popover ───────────────────────────────────────────── */}
      {popover && poem && (
        <div data-lit-popover>
          <AnnotationPopover
            state={{ ...popover, pendingRange }}
            poem={poem}
            numbers={numbers}
            testMode={testMode}
            revealed={revealed}
            handlers={{
              onClose: () => closePopover(true),
              onMouseEnter: () => {
                popHoveredRef.current = true;
                if (leaveTimerRef.current) {
                  clearTimeout(leaveTimerRef.current);
                  leaveTimerRef.current = null;
                }
              },
              onMouseLeave: () => {
                popHoveredRef.current = false;
                setPopover((p) => {
                  if (p?.type !== "view" || p.pinned) return p;
                  if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
                  leaveTimerRef.current = setTimeout(() => closePopover(), 220);
                  return p;
                });
              },
              onToggleReveal: toggleReveal,
              onHover: setHotIds,
              onPick: (id) => openView(id, popover.rect, true),
              onEdit: (ann) =>
                setPopover({
                  type: "edit",
                  annotation: ann,
                  ranges: ann.ranges.slice(),
                  rect: popover.rect,
                  pinned: true,
                }),
              onDelete: handleDeleteAnnotation,
              onAddPart: () => {
                if (!pendingRange) return;
                setPopover((p) => {
                  if (!p || p.type !== "edit") return p;
                  if (p.ranges.some((r) => sameRange(r, pendingRange))) return p;
                  return { ...p, ranges: [...p.ranges, pendingRange] };
                });
                canvasRef.current?.clearSelection();
                setPendingRange(null);
              },
              onRemovePart: (i) =>
                setPopover((p) =>
                  p && p.type === "edit"
                    ? { ...p, ranges: p.ranges.filter((_, k) => k !== i) }
                    : p
                ),
              onSaveAnnotation: handleSaveAnnotation,
              onCancelEditor: () => {
                closePopover(true);
                canvasRef.current?.clearSelection();
                setPendingRange(null);
              },
            }}
          />
        </div>
      )}

      {/* ── modals & toast ────────────────────────────────────── */}
      <PoemLinesModal
        open={Boolean(linesModal)}
        poem={linesModal?.poem || null}
        onClose={() => setLinesModal(null)}
        onSave={handleSaveLines}
        onDelete={() => linesModal?.poem && handleDeletePoem(linesModal.poem.id)}
      />

      <ImportPoemsModal
        open={Boolean(importPreview)}
        preview={importPreview?.preview}
        currentCount={poemList.length}
        onClose={() => setImportPreview(null)}
        onMerge={() => runImport("merge")}
        onReplace={() => runImport("replace")}
      />

      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          onCancel={() => setConfirmState(null)}
          onConfirm={confirmState.onConfirm}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[300] -translate-x-1/2 rounded-xl border border-ink-750 bg-ink-800 px-4 py-2.5 text-xs font-semibold text-ink-100 shadow-2xl animate-fade-up">
          {toast}
        </div>
      )}
    </div>
  );
}

/** The button that follows a live text selection. */
function FloatingAdd({ rect, onClick }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !rect) return;
    const pad = 10;
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - pad) top = Math.max(pad, rect.top - 6 - h);
    let left = rect.left + rect.width / 2 - w / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - pad - w));
    node.style.top = `${Math.round(top)}px`;
    node.style.left = `${Math.round(left)}px`;
  }, [rect]);

  return (
    <div ref={ref} data-lit-float-add className="fixed z-[210]">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()} // keep the selection alive
        onClick={onClick}
        className="flex items-center gap-1.5 rounded-xl bg-duck-400 px-3 py-1.5 text-xs font-bold text-ink-950 shadow-xl transition-colors hover:bg-duck-300"
      >
        <Plus className="h-3.5 w-3.5" />
        Add analysis
      </button>
    </div>
  );
}

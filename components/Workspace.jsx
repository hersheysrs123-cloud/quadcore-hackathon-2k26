"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import BlockNoteEditor from "@/components/BlockNoteEditor";
import CalendarView from "@/components/CalendarView";
import ThreeDView from "@/components/ThreeDView";
import SocraticWorkspace from "@/components/SocraticWorkspace";
import InstantNoteModal from "@/components/InstantNoteModal";
import AlarmOverlay from "@/components/AlarmOverlay";
import { SPACES } from "@/lib/constants";
import { conceptFromText, editorBlocksToText } from "@/lib/blocks";

const DEFAULT_NOTES_BY_SPACE = {
  School: [],
  Personal: [],
  Misc: [],
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export default function Workspace({ note: initialNote }) {
  const [mounted, setMounted] = useState(false);
  const [activeSpace, setActiveSpace] = useState(SPACES[0].name);
  const [activeTab, setActiveTab] = useState("notes");
  const [duckConcept, setDuckConcept] = useState("");
  const [duckOpen, setDuckOpen] = useState(false);
  const [instantNoteOpen, setInstantNoteOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  // Site-wide Theme (Dark vs Light)
  const [theme, setTheme] = useState("dark");

  // Notes state
  const [notesBySpace, setNotesBySpace] = useState(DEFAULT_NOTES_BY_SPACE);
  const [trashNotes, setTrashNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [editorBlocks, setEditorBlocks] = useState([]);

  // Bind global Ctrl+I shortcut to open Instant Note modal
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setInstantNoteOpen(true);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Sync notes directly from Supabase DB
  const syncFromSupabase = useCallback(async () => {
    try {
      const res = await fetch("/api/notes/save");
      const data = await res.json();
      if (data.success && Array.isArray(data.notes) && data.notes.length > 0) {
        const spaceMap = { School: [], Personal: [], Misc: [] };
        data.notes.forEach((n) => {
          const sp = n.space || n.space_id || "School";
          const formattedBlocks = (n.blocks || []).map((b) => {
            const cObj = typeof b.content_json === "object" && b.content_json !== null ? b.content_json : {};
            return {
              id: b.id,
              type: b.block_type || "text",
              content: cObj.text ?? (typeof b.content_json === "string" ? b.content_json : ""),
              drawingData: cObj.drawingData || undefined,
              bgType: cObj.bgType || undefined,
              url: cObj.url || undefined,
              mediaKind: cObj.mediaKind || undefined,
              checked: cObj.checked ?? undefined,
              icon: cObj.icon || undefined,
            };
          });
          const noteObj = {
            id: n.id,
            title: n.title || "Untitled Note",
            space: sp,
            banner: n.banner || null,
            blocks: formattedBlocks.length > 0 ? formattedBlocks : [{ id: `blk_${Date.now()}`, type: "text", content: "" }],
          };
          if (!spaceMap[sp]) spaceMap[sp] = [];
          spaceMap[sp].push(noteObj);
        });

        setNotesBySpace(spaceMap);
        if (typeof window !== "undefined") {
          localStorage.setItem("socratic_notes_by_space", JSON.stringify(spaceMap));
        }
        const firstInActive = (spaceMap[activeSpace] || [])[0];
        if (firstInActive) setActiveNoteId(firstInActive.id);
      }
    } catch {
      // Fallback to local
    }
  }, [activeSpace]);

  // Factory Reset Handler
  const handleResetData = useCallback(async (target) => {
    try {
      await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });

      if (target === "notes" || target === "all") {
        setNotesBySpace(DEFAULT_NOTES_BY_SPACE);
        setActiveNoteId(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("socratic_notes_by_space");
        }
      }

      if (target === "calendar" || target === "all") {
        if (typeof window !== "undefined") {
          localStorage.removeItem("socratic_calendar_events");
        }
      }

      if (target === "3d" || target === "all") {
        if (typeof window !== "undefined") {
          localStorage.removeItem("socratic_visualizations");
        }
      }

      if (target === "all") {
        setTrashNotes([]);
        if (typeof window !== "undefined") {
          localStorage.removeItem("socratic_trash_notes");
        }
      }

      window.location.reload();
    } catch (err) {
      alert("Reset error: " + err.message);
    }
  }, []);

  // Hydrate state from localStorage & Supabase on client mount
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      try {
        const savedTheme = localStorage.getItem("socratic_theme") || "dark";
        setTheme(savedTheme);

        const cachedNotes = localStorage.getItem("socratic_notes_by_space");
        if (cachedNotes) {
          const parsed = JSON.parse(cachedNotes);
          setNotesBySpace(parsed);
          const firstInActive = (parsed[SPACES[0].name] || [])[0];
          if (firstInActive) setActiveNoteId(firstInActive.id);
        }

        const cachedTrash = localStorage.getItem("socratic_trash_notes");
        if (cachedTrash) {
          const parsedTrash = JSON.parse(cachedTrash);
          const now = Date.now();
          setTrashNotes(parsedTrash.filter((item) => now - item.deletedAt < TWENTY_FOUR_HOURS_MS));
        }

        syncFromSupabase();
      } catch {
        // Fallback
      }
    }
  }, [syncFromSupabase]);

  // Update theme data attribute on root HTML element
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
      if (theme === "light") {
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
      }
      localStorage.setItem("socratic_theme", theme);
    }
  }, [theme]);

  // Save notesBySpace & trashNotes to localStorage
  useEffect(() => {
    if (mounted && typeof window !== "undefined") {
      localStorage.setItem("socratic_notes_by_space", JSON.stringify(notesBySpace));
    }
  }, [notesBySpace, mounted]);

  useEffect(() => {
    if (mounted && typeof window !== "undefined") {
      localStorage.setItem("socratic_trash_notes", JSON.stringify(trashNotes));
    }
  }, [trashNotes, mounted]);

  // Periodic 24h auto-purge check every minute
  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setTrashNotes((prev) =>
        prev.filter((item) => now - item.deletedAt < TWENTY_FOUR_HOURS_MS)
      );
    }, 60000);
    return () => clearInterval(interval);
  }, [mounted]);

  const currentNotesInSpace = notesBySpace[activeSpace] || [];
  const activeNoteObj = currentNotesInSpace.find((n) => n.id === activeNoteId) || currentNotesInSpace[0];

  const noteContent = useMemo(
    () => editorBlocksToText(editorBlocks),
    [editorBlocks],
  );

  const openDuck = useCallback((blockContent) => {
    setDuckConcept(conceptFromText(blockContent));
    setDuckOpen(true);
  }, []);

  const closeDuck = useCallback(() => setDuckOpen(false), []);

  const handleSaveNote = useCallback(
    async ({ title, blocks, banner, isFavorite, emoji }) => {
      const targetNoteId = activeNoteObj?.id || `n_${Date.now()}`;
      const updatedTitle = title || activeNoteObj?.title || "Untitled Note";
      const updatedBlocks = blocks || activeNoteObj?.blocks || [{ id: `blk_${Date.now()}`, type: "text", content: "" }];
      const updatedBanner = banner !== undefined ? banner : activeNoteObj?.banner;
      const updatedFav = isFavorite !== undefined ? isFavorite : activeNoteObj?.isFavorite;
      const updatedEmoji = emoji !== undefined ? emoji : activeNoteObj?.emoji;

      setNotesBySpace((prev) => {
        const spaceNotes = prev[activeSpace] || [];
        const existingIdx = spaceNotes.findIndex((n) => n.id === targetNoteId);
        let updatedNotes;

        if (existingIdx >= 0) {
          updatedNotes = spaceNotes.map((n) =>
            n.id === targetNoteId
              ? { ...n, title: updatedTitle, blocks: updatedBlocks, banner: updatedBanner, isFavorite: updatedFav, emoji: updatedEmoji }
              : n
          );
        } else {
          // Auto-create new note when typing on blank page in an empty space
          const newNoteObj = {
            id: targetNoteId,
            title: updatedTitle,
            space: activeSpace,
            blocks: updatedBlocks,
            banner: updatedBanner,
            isFavorite: updatedFav,
            emoji: updatedEmoji,
          };
          updatedNotes = [...spaceNotes, newNoteObj];
        }

        const next = { ...prev, [activeSpace]: updatedNotes };
        if (typeof window !== "undefined") {
          localStorage.setItem("socratic_notes_by_space", JSON.stringify(next));
        }
        return next;
      });

      if (!activeNoteObj) {
        setActiveNoteId(targetNoteId);
      }

      try {
        await fetch("/api/notes/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            noteId: targetNoteId,
            title: updatedTitle,
            blocks: updatedBlocks,
            banner: updatedBanner,
            isFavorite: updatedFav,
            emoji: updatedEmoji,
            space: activeSpace,
          }),
        });
        setSaveStatus("✓ Saved");
        setTimeout(() => setSaveStatus(""), 3000);
      } catch {
        setSaveStatus("✓ Saved locally");
        setTimeout(() => setSaveStatus(""), 3000);
      }
    },
    [activeNoteObj, activeSpace]
  );

  const handleSaveInstantNote = useCallback(
    async (instantNote) => {
      const targetSpace = instantNote.space || "Misc";

      setNotesBySpace((prev) => {
        const spaceNotes = prev[targetSpace] || [];
        const next = { ...prev, [targetSpace]: [...spaceNotes, instantNote] };
        if (typeof window !== "undefined") {
          localStorage.setItem("socratic_notes_by_space", JSON.stringify(next));
        }
        return next;
      });

      setActiveSpace(targetSpace);
      setActiveNoteId(instantNote.id);
      setActiveTab("notes");

      try {
        await fetch("/api/notes/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            noteId: instantNote.id,
            title: instantNote.title,
            blocks: instantNote.blocks,
            space: targetSpace,
          }),
        });
      } catch {
        // Saved locally
      }
    },
    []
  );

  function handleCreateNote() {
    const newNote = {
      id: `n_${Date.now()}`,
      title: "Untitled Note",
      space: activeSpace,
      banner: null,
      blocks: [{ id: `blk_${Date.now()}`, type: "text", content: "" }],
    };

    setNotesBySpace((prev) => ({
      ...prev,
      [activeSpace]: [...(prev[activeSpace] || []), newNote],
    }));

    setActiveNoteId(newNote.id);
    setActiveTab("notes");
  }

  function handleDeleteNote(noteId) {
    const targetNote = currentNotesInSpace.find((n) => n.id === noteId);
    if (!targetNote) return;

    setNotesBySpace((prev) => ({
      ...prev,
      [activeSpace]: (prev[activeSpace] || []).filter((n) => n.id !== noteId),
    }));

    setTrashNotes((prev) => [
      ...prev,
      { ...targetNote, space: activeSpace, deletedAt: Date.now() },
    ]);

    if (activeNoteId === noteId) {
      setActiveNoteId(null);
    }
  }

  function handleRecoverNote(noteId) {
    const target = trashNotes.find((n) => n.id === noteId);
    if (!target) return;

    const targetSpace = target.space || activeSpace;

    setTrashNotes((prev) => prev.filter((n) => n.id !== noteId));
    setNotesBySpace((prev) => ({
      ...prev,
      [targetSpace]: [...(prev[targetSpace] || []), target],
    }));

    setActiveNoteId(target.id);
  }

  function handlePermanentlyDeleteNote(noteId) {
    setTrashNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  function handleRecoverAllNotes() {
    setNotesBySpace((prev) => {
      const updated = { ...prev };
      for (const item of trashNotes) {
        const sp = item.space || "School";
        updated[sp] = [...(updated[sp] || []), item];
      }
      return updated;
    });
    setTrashNotes([]);
  }

  function handlePermanentlyDeleteAllNotes() {
    setTrashNotes([]);
  }

  function handleSelectNote(noteObj) {
    setActiveNoteId(noteObj.id);
    setActiveTab("notes");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ink-950 text-ink-100 transition-colors duration-200">
      {/* Left Sidebar */}
      <Sidebar
        spaces={SPACES}
        activeSpace={activeSpace}
        onSelectSpace={(spaceName) => {
          setActiveSpace(spaceName);
          const firstInSpace = (notesBySpace[spaceName] || [])[0];
          if (firstInSpace) setActiveNoteId(firstInSpace.id);
          else setActiveNoteId(null);
        }}
        activeNoteId={activeNoteObj?.id || null}
        notesBySpace={notesBySpace}
        onSelectNote={handleSelectNote}
        onCreateNote={handleCreateNote}
        onDeleteNote={handleDeleteNote}
        trashNotes={trashNotes}
        onRecoverNote={handleRecoverNote}
        onPermanentlyDeleteNote={handlePermanentlyDeleteNote}
        onRecoverAllNotes={handleRecoverAllNotes}
        onPermanentlyDeleteAllNotes={handlePermanentlyDeleteAllNotes}
        theme={theme}
        setTheme={setTheme}
        onSyncSupabase={syncFromSupabase}
        onResetData={handleResetData}
        onOpenInstantNote={() => setInstantNoteOpen(true)}
        note={initialNote}
      />

      {/* Main Container with Top HUD Header */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top HUD Header with 3 Tabs: Notes, Calendar, 3D */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-ink-800 bg-ink-900/90 px-6 backdrop-blur-md transition-colors duration-200">
          {/* Left Breadcrumb Context (Bigger Active Note Title) */}
          <div className="flex items-center gap-2 text-sm text-ink-400">
            <span className="font-semibold text-ink-300">{activeSpace}</span>
            <span aria-hidden="true" className="text-ink-600">/</span>
            <span className="truncate text-base font-bold text-ink-100">
              {activeNoteObj?.title || "Untitled Note"}
            </span>
          </div>

          {/* Center: HUD Navigation Tabs */}
          <nav className="flex items-center rounded-lg border border-ink-800 bg-ink-950 p-1 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab("notes")}
              className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
                activeTab === "notes"
                  ? "bg-ink-800 text-ink-100 shadow-sm"
                  : "text-ink-400 hover:bg-ink-900 hover:text-ink-200"
              }`}
            >
              <span>📝</span>
              <span>Notes</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("calendar")}
              className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
                activeTab === "calendar"
                  ? "bg-ink-800 text-ink-100 shadow-sm"
                  : "text-ink-400 hover:bg-ink-900 hover:text-ink-200"
              }`}
            >
              <span>📅</span>
              <span>Calendar</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("3d")}
              className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
                activeTab === "3d"
                  ? "border border-duck-500/30 bg-duck-500/20 text-duck-300 shadow-sm"
                  : "text-ink-400 hover:bg-ink-900 hover:text-ink-200"
              }`}
            >
              <span>🧊</span>
              <span>3D</span>
            </button>
          </nav>

          {/* Right Action Bar: Save Note (Full Right) + Socratic Duck Trigger */}
          <div className="flex items-center gap-2.5">
            {saveStatus && (
              <span className="text-xs font-semibold text-emerald-400 animate-fade-in">
                {saveStatus}
              </span>
            )}
            <button
              type="button"
              onClick={() => handleSaveNote({ title: activeNoteObj?.title, blocks: activeNoteObj?.blocks, banner: activeNoteObj?.banner, isFavorite: activeNoteObj?.isFavorite, emoji: activeNoteObj?.emoji })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-duck-500/40 bg-duck-500/10 px-3.5 py-1.5 text-xs font-semibold text-duck-300 transition-all hover:bg-duck-500/20 hover:text-duck-200 shadow-sm"
            >
              <span>💾</span>
              <span>Save Note</span>
            </button>

            <button
              type="button"
              onClick={() =>
                openDuck(noteContent || activeNoteObj?.title || "Socratic Workspace")
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-duck-500/30 bg-duck-500/10 px-3 py-1.5 text-xs font-medium text-duck-300 transition-all hover:bg-duck-500/20 hover:text-duck-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-duck-400"
            >
              <span>🦆</span>
              <span className="hidden sm:inline">Ask Duck</span>
            </button>
          </div>
        </header>

        {/* Tab Viewport Content */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === "notes" && (
            <BlockNoteEditor
              key={activeNoteObj?.id || "empty_editor"}
              initialTitle={activeNoteObj?.title || ""}
              initialBlocks={activeNoteObj?.blocks}
              initialBanner={activeNoteObj?.banner}
              initialFavorite={activeNoteObj?.isFavorite}
              initialEmoji={activeNoteObj?.emoji}
              onBlocksChange={setEditorBlocks}
              onSaveNote={handleSaveNote}
              onTriggerSocratic={openDuck}
              notesBySpace={notesBySpace}
              onSelectNote={handleSelectNote}
            />
          )}

          {activeTab === "calendar" && (
            <CalendarView activeSpace={activeSpace} />
          )}

          {activeTab === "3d" && <ThreeDView />}
        </main>
      </div>

      {/* Socratic Rubber Duck Drawer */}
      <SocraticWorkspace
        open={duckOpen}
        concept={duckConcept}
        noteContent={noteContent}
        onClose={closeDuck}
      />

      {/* 75% Screen Instant Note Popup Modal */}
      <InstantNoteModal
        open={instantNoteOpen}
        onClose={() => setInstantNoteOpen(false)}
        onSaveInstantNote={handleSaveInstantNote}
      />

      {/* Global Visual & Audio Alarm Alert Overlay */}
      <AlarmOverlay />
    </div>
  );
}

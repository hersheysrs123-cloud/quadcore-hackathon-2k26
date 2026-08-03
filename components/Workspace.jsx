"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import BlockNoteEditor from "@/components/BlockNoteEditor";
import CalendarView from "@/components/CalendarView";
import ThreeDView from "@/components/ThreeDView";
import InstantNoteModal from "@/components/InstantNoteModal";
import AlarmOverlay from "@/components/AlarmOverlay";
import SocraticWorkspace from "@/components/SocraticWorkspace";
import ExplainPanel from "@/components/ExplainPanel";
import QuizPanel from "@/components/QuizPanel";
import MasteryDashboard from "@/components/MasteryDashboard";
import GlobalTimerHUD from "@/components/GlobalTimerHUD";
import PinnedTimersOverlay from "@/components/PinnedTimersOverlay";
import { SPACES } from "@/lib/constants";
import { conceptFromText, editorBlocksToText } from "@/lib/blocks";
import { demoNotesBySpace } from "@/lib/demoNotes";
import { summariseMastery } from "@/lib/mastery";
import { initAndSeedDatabase } from "@/lib/db";
import {
  getAllNotes,
  saveNote,
  deleteNoteToTrash,
  getTrashNotes,
  recoverNote,
  permanentlyDeleteNote,
  getStudySessions,
  recordStudySession,
  factoryResetWorkspace,
  clearTrash,
} from "@/lib/storageService";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const DEFAULT_NOTES_BY_SPACE = {
  School: [],
  Personal: [],
  Misc: [],
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/** Graded quiz and Socratic sessions, for the mastery heatmap. */
const SESSIONS_KEY = "socratic_study_sessions";

/** Set once the seed has been planted, so clearing every note doesn't re-seed. */
const SEEDED_KEY = "socratic_demo_seeded_v6";

const isEmptyWorkspace = (bySpace) =>
  !bySpace || Object.values(bySpace).every((list) => !list || list.length === 0);

export default function Workspace({ note: initialNote }) {
  const [mounted, setMounted] = useState(false);
  const [activeSpace, setActiveSpace] = useState(SPACES[0].name);
  const [activeTab, setActiveTab] = useState("notes");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [instantNoteOpen, setInstantNoteOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  // Explain / Quiz drawers. `studyTarget` survives closing so the panel does
  // not blank out mid-slide.
  const [studyTarget, setStudyTarget] = useState(null);
  const [studyKind, setStudyKind] = useState(null); // "explain" | "quiz"
  const [socraticOpen, setSocraticOpen] = useState(false);
  const [socraticConcept, setSocraticConcept] = useState("");
  const [sessions, setSessions] = useState([]);

  const handleOpenSocratic = useCallback((concept) => {
    setSocraticConcept(concept || "Socratic Workspace Concept");
    setSocraticOpen(true);
  }, []);

  // Site-wide Theme (Dark vs Light)
  const [theme, setTheme] = useState("dark");

  // Notes state
  const [notesBySpace, setNotesBySpace] = useState(DEFAULT_NOTES_BY_SPACE);
  const [trashNotes, setTrashNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [editorBlocks, setEditorBlocks] = useState([]);

  // Bind global Ctrl+I shortcut to open Instant Note modal
  useEffect(() => {
    setMounted(true);

    function handleGlobalKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setInstantNoteOpen(true);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);



  // Factory Reset Handler
  const handleResetData = useCallback(async (target) => {
    try {
      await factoryResetWorkspace();
      setNotesBySpace(DEFAULT_NOTES_BY_SPACE);
      setActiveNoteId(null);
      setSessions([]);
      setTrashNotes([]);
      window.location.reload();
    } catch (err) {
      alert("Reset error: " + err.message);
    }
  }, []);

  // Hydrate state from IndexedDB on client mount
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("socratic_theme") || "dark";
      setTheme(savedTheme);

      async function loadLocalWorkspace() {
        try {
          await initAndSeedDatabase();
          const allDbNotes = await getAllNotes();

          const spaceMap = { School: [], Personal: [], Misc: [] };
          allDbNotes.forEach((n) => {
            const sp = n.spaceId || n.space || "School";
            if (!spaceMap[sp]) spaceMap[sp] = [];
            spaceMap[sp].push({
              id: n.id,
              title: n.title || "Untitled Note",
              space: sp,
              spaceId: sp,
              banner: n.banner || null,
              emoji: n.emoji || "📝",
              isFavorite: Boolean(n.isFavorite),
              blocks: n.blocks || [],
            });
          });

          setNotesBySpace(spaceMap);
          const firstInActive = (spaceMap[SPACES[0].name] || [])[0];
          if (firstInActive) setActiveNoteId(firstInActive.id);

          const trash = await getTrashNotes();
          setTrashNotes(trash);

          const studySess = await getStudySessions();
          setSessions(studySess);
        } catch (err) {
          console.error("Dexie hydration error:", err);
        }
      }

      loadLocalWorkspace();
    }
  }, []);

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

  useEffect(() => {
    if (mounted && typeof window !== "undefined") {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    }
  }, [sessions, mounted]);

  // Periodic 24h auto-purge check every minute
  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setTrashNotes((prev) =>
        prev.filter((item) => {
          const ts = typeof item.deletedAt === "number" ? item.deletedAt : new Date(item.deletedAt || 0).getTime();
          return !isNaN(ts) && now - ts < TWENTY_FOUR_HOURS_MS;
        })
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

  /**
   * Opens the Explain or Quiz drawer.
   *
   * `blockText` is the selected block when this came from a block's ⠿ menu,
   * and null when it came from the header. A block narrows the concept and
   * becomes the focus; the whole note is the context either way.
   */
  const openStudy = useCallback(
    (kind, blockText, note = activeNoteObj, content = noteContent) => {
      if (!note) return;
      const focused = blockText?.trim?.() ? blockText : "";
      setStudyTarget({
        concept: focused ? conceptFromText(focused) : note.title || "this note",
        focus: focused,
        content,
        noteId: note.id,
        noteTitle: note.title,
        space: note.space || activeSpace,
      });
      setStudyKind(kind);
    },
    [activeNoteObj, activeSpace, noteContent],
  );

  const closeStudy = useCallback(() => setStudyKind(null), []);

  /** One graded session — from either quiz mode — lands on the mastery map. */
  const handleRecordSession = useCallback(
    async ({ mode, concept, score, summary, heatmap }) => {
      const newSession = {
        id: `ses_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        noteId: studyTarget?.noteId ?? null,
        noteTitle: studyTarget?.noteTitle ?? "",
        space: studyTarget?.space ?? activeSpace,
        concept,
        mode,
        score: Number(score) || 0,
        summary: summary ?? "",
        heatmap: Array.isArray(heatmap) ? heatmap : [],
        createdAt: new Date().toISOString(),
      };
      setSessions((prev) => [newSession, ...prev]);
      await recordStudySession(newSession);
    },
    [activeSpace, studyTarget],
  );

  /** From the mastery dashboard: open that note, then reopen on that topic. */
  const handleStudyTopic = useCallback(
    (topic, kind) => {
      let found = null;
      for (const [space, list] of Object.entries(notesBySpace)) {
        const match = (list || []).find((n) => n.id === topic.noteId);
        if (match) {
          found = { ...match, space };
          break;
        }
      }

      if (found) {
        setActiveSpace(found.space);
        setActiveNoteId(found.id);
      }
      setActiveTab("notes");

      const note = found ?? activeNoteObj;
      if (!note) return;

      setStudyTarget({
        concept: topic.subtopic || note.title || "this note",
        focus: topic.subtopic ?? "",
        content: editorBlocksToText(note.blocks || []),
        noteId: note.id,
        noteTitle: note.title,
        space: note.space || activeSpace,
      });
      setStudyKind(kind);
    },
    [activeNoteObj, activeSpace, notesBySpace],
  );

  const allNotes = useMemo(
    () =>
      Object.entries(notesBySpace).flatMap(([space, list]) =>
        (list || []).map((n) => ({ ...n, space })),
      ),
    [notesBySpace],
  );

  const gapCount = useMemo(
    () => summariseMastery(sessions).weaknesses.length,
    [sessions],
  );

  const handleSaveNote = useCallback(
    async ({ title, blocks, banner, isFavorite, emoji }) => {
      const targetNoteId = activeNoteObj?.id || `n_${Date.now()}`;
      const updatedTitle = title || activeNoteObj?.title || "Untitled Note";
      const updatedBlocks = blocks || activeNoteObj?.blocks || [{ id: `blk_${Date.now()}`, type: "text", content: "" }];
      const updatedBanner = banner !== undefined ? banner : activeNoteObj?.banner;
      const updatedFav = isFavorite !== undefined ? isFavorite : activeNoteObj?.isFavorite;
      const updatedEmoji = emoji !== undefined ? emoji : activeNoteObj?.emoji;

      const noteData = {
        id: targetNoteId,
        spaceId: activeSpace,
        title: updatedTitle,
        blocks: updatedBlocks,
        banner: updatedBanner,
        isFavorite: updatedFav,
        emoji: updatedEmoji,
      };

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
          updatedNotes = [...spaceNotes, noteData];
        }
        return { ...prev, [activeSpace]: updatedNotes };
      });

      if (!activeNoteObj) {
        setActiveNoteId(targetNoteId);
      }

      await saveNote(noteData);
      setSaveStatus("✓ Saved locally");
      setTimeout(() => setSaveStatus(""), 3000);
    },
    [activeNoteObj, activeSpace]
  );

  const handleSaveInstantNote = useCallback(
    async (instantNote) => {
      const targetSpace = instantNote.space || "Misc";
      const noteData = {
        id: instantNote.id,
        spaceId: targetSpace,
        title: instantNote.title || "Untitled Note",
        blocks: instantNote.blocks || [],
        banner: instantNote.banner || null,
        emoji: instantNote.emoji || "📝",
        isFavorite: Boolean(instantNote.isFavorite),
      };

      setNotesBySpace((prev) => {
        const spaceNotes = prev[targetSpace] || [];
        return { ...prev, [targetSpace]: [...spaceNotes, noteData] };
      });

      setActiveSpace(targetSpace);
      setActiveNoteId(instantNote.id);
      setActiveTab("notes");

      await saveNote(noteData);
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

  async function handleDeleteNote(noteId) {
    const spaceNotes = notesBySpace[activeSpace] || [];
    const targetNote = spaceNotes.find((n) => n.id === noteId);
    if (!targetNote) return;

    setNotesBySpace((prev) => ({
      ...prev,
      [activeSpace]: (prev[activeSpace] || []).filter((n) => n.id !== noteId),
    }));

    setTrashNotes((prev) => [
      ...prev,
      { ...targetNote, space: activeSpace, deletedAt: new Date().toISOString() },
    ]);

    if (activeNoteId === noteId) {
      setActiveNoteId(null);
    }

    await deleteNoteToTrash(noteId);
  }

  async function handleRecoverNote(noteId) {
    const target = trashNotes.find((n) => n.id === noteId);
    if (!target) return;

    const targetSpace = target.space || activeSpace;

    setTrashNotes((prev) => prev.filter((n) => n.id !== noteId));
    setNotesBySpace((prev) => ({
      ...prev,
      [targetSpace]: [...(prev[targetSpace] || []), target],
    }));

    setActiveNoteId(target.id);
    await recoverNote(noteId);
  }

  async function handlePermanentlyDeleteNote(noteId) {
    setTrashNotes((prev) => prev.filter((n) => n.id !== noteId));
    await permanentlyDeleteNote(noteId);
  }

  async function handleRecoverAllNotes() {
    setNotesBySpace((prev) => {
      const updated = { ...prev };
      for (const item of trashNotes) {
        const sp = item.space || "School";
        updated[sp] = [...(updated[sp] || []), item];
      }
      return updated;
    });

    const itemsToRecover = [...trashNotes];
    setTrashNotes([]);

    for (const item of itemsToRecover) {
      await recoverNote(item.id);
    }
  }

  async function handlePermanentlyDeleteAllNotes() {
    setTrashNotes([]);
    await clearTrash();
  }

  function handleSelectNote(noteObj) {
    setActiveNoteId(noteObj.id);
    setActiveTab("notes");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ink-950 text-ink-100 transition-colors duration-200">
      {/* Left Sidebar */}
      <div
        className={`transition-all duration-300 ease-in-out shrink-0 h-full ${
          sidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0 overflow-hidden pointer-events-none"
        }`}
      >
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
          onResetData={handleResetData}
          onOpenInstantNote={() => setInstantNoteOpen(true)}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          note={initialNote}
        />
      </div>

      {/* Main Container with Top HUD Header */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top HUD Header with 4 Tabs: Notes, Calendar, 3D, Mastery */}
        <header className="relative z-[60] flex h-14 shrink-0 items-center justify-between gap-4 border-b border-ink-800 bg-ink-900/90 px-6 backdrop-blur-md transition-colors duration-200">
          {/* Left Breadcrumb Context & Sidebar Toggle */}
          <div className="flex min-w-0 max-w-[30%] sm:max-w-[36%] md:max-w-[44%] items-center gap-2.5 text-sm text-ink-400">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100 transition-colors shrink-0"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" strokeWidth={2} />
              ) : (
                <PanelLeftOpen className="h-4 w-4 text-duck-400" strokeWidth={2} />
              )}
            </button>

            <span className="shrink-0 font-semibold text-ink-300">{activeSpace}</span>
            <span aria-hidden="true" className="shrink-0 text-ink-600">/</span>
            <span
              title={activeNoteObj?.title || "Untitled Note"}
              className="min-w-0 truncate text-base font-bold text-ink-100"
            >
              {activeNoteObj?.title || "Untitled Note"}
            </span>
          </div>

          {/* Center: HUD Navigation Tabs */}
          <nav className="flex shrink-0 items-center rounded-lg border border-ink-800 bg-ink-950 p-1 shadow-inner">
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

            <button
              type="button"
              onClick={() => setActiveTab("mastery")}
              className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
                activeTab === "mastery"
                  ? "bg-ink-800 text-ink-100 shadow-sm"
                  : "text-ink-400 hover:bg-ink-900 hover:text-ink-200"
              }`}
            >
              <span>📊</span>
              <span>Mastery</span>
              {gapCount > 0 && (
                <span className="rounded-full border border-gap-500/40 bg-gap-500/10 px-1.5 text-[10px] font-semibold tabular-nums text-gap-500">
                  {gapCount}
                </span>
              )}
            </button>
          </nav>

          {/* Right Action Bar: Timer HUD + Save Note + Socratic Duck Triggers */}
          <div className="flex shrink-0 items-center gap-2.5">
            <GlobalTimerHUD onNavigateCalendar={() => setActiveTab("calendar")} />

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
              onClick={() => openStudy("explain", null)}
              title="Explain this note"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-300 transition-all hover:border-duck-500/50 hover:text-duck-300"
            >
              <span>✨</span>
              <span className="hidden sm:inline">Explain</span>
            </button>

            <button
              type="button"
              onClick={() => openStudy("quiz", null)}
              title="Quiz me on this note"
              className="inline-flex items-center gap-1.5 rounded-lg border border-duck-500/30 bg-duck-500/10 px-3 py-1.5 text-xs font-medium text-duck-300 transition-all hover:bg-duck-500/20 hover:text-duck-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-duck-400"
            >
              <span>🦆</span>
              <span className="hidden sm:inline">Quiz me</span>
            </button>
          </div>
        </header>

        {/* Tab Viewport Content */}
        <main className={`flex-1 ${activeTab === "3d" ? "overflow-hidden flex flex-col h-full min-h-0" : "overflow-y-auto"}`}>
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
              onExplainBlock={(text) => openStudy("explain", text)}
              onQuizBlock={(text) => openStudy("quiz", text)}
              onTriggerSocratic={(concept) => handleOpenSocratic(concept || activeNoteObj?.title)}
              onSwitchTab={setActiveTab}
              notesBySpace={notesBySpace}
              onSelectNote={handleSelectNote}
            />
          )}

          {activeTab === "calendar" && (
            <CalendarView activeSpace={activeSpace} />
          )}

          {activeTab === "3d" && <ThreeDView />}

          {activeTab === "mastery" && (
            <MasteryDashboard
              sessions={sessions}
              notes={allNotes}
              mounted={mounted}
              onOpenNote={(noteId) => {
                const match = allNotes.find((n) => n.id === noteId);
                if (match) {
                  setActiveSpace(match.space);
                  setActiveNoteId(match.id);
                }
                setActiveTab("notes");
              }}
              onStudy={handleStudyTopic}
              onClearSessions={() => setSessions([])}
            />
          )}
        </main>
      </div>

      {/* Socratic Rubber Duck Examination Drawer */}
      <SocraticWorkspace
        open={socraticOpen}
        concept={socraticConcept}
        noteContent={editorBlocksToText(editorBlocks)}
        onClose={() => setSocraticOpen(false)}
      />

      {/* Explain — the teaching half. Stays mounted so it can animate out,
          which is also why `studyTarget` survives closing. */}
      <ExplainPanel
        open={studyKind === "explain"}
        concept={studyTarget?.concept ?? ""}
        focus={studyTarget?.focus ?? ""}
        noteContent={studyTarget?.content ?? ""}
        onClose={closeStudy}
        onQuiz={() => setStudyKind("quiz")}
      />

      {/* Quiz — graded questions or a Socratic interrogation. */}
      <QuizPanel
        open={studyKind === "quiz"}
        concept={studyTarget?.concept ?? ""}
        noteContent={studyTarget?.content ?? ""}
        onClose={closeStudy}
        onComplete={handleRecordSession}
      />

      {/* 75% Screen Instant Note Popup Modal */}
      <InstantNoteModal
        open={instantNoteOpen}
        onClose={() => setInstantNoteOpen(false)}
        onSaveInstantNote={handleSaveInstantNote}
      />

      {/* Global Visual & Audio Alarm Alert Overlay */}
      <AlarmOverlay />

      {/* Floating Pinned Timers Screen Overlay */}
      <PinnedTimersOverlay />
    </div>
  );
}

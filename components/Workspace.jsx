"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Sidebar from "@/components/Sidebar";
import BlockNoteEditor from "@/components/BlockNoteEditor";
import CalendarView from "@/components/CalendarView";
import WebSaverView from "@/components/WebSaverView";
import dynamic from "next/dynamic";
const ThreeDView = dynamic(() => import("@/components/ThreeDView"), { ssr: false });
import InstantNoteModal from "@/components/InstantNoteModal";
import AlarmOverlay from "@/components/AlarmOverlay";
import ExplainPanel from "@/components/ExplainPanel";
import QuizPanel from "@/components/QuizPanel";
import MasteryDashboard from "@/components/MasteryDashboard";
import GlobalTimerHUD from "@/components/GlobalTimerHUD";
import PinnedTimersOverlay from "@/components/PinnedTimersOverlay";
import ExportImportModal from "@/components/ExportImportModal";
import NoteMenu from "@/components/NoteMenu";
import CommandPalette from "@/components/CommandPalette";
import InteractiveTutorial from "@/components/InteractiveTutorial";
import { SPACES } from "@/lib/constants";
import { conceptFromText, editorBlocksToText } from "@/lib/blocks";
import { demoNotesBySpace } from "@/lib/demoNotes";
import { summariseMastery } from "@/lib/mastery";
import { initAndSeedDatabase, db } from "@/lib/db";
import SetPasswordModal from "@/components/SetPasswordModal";
import EnterPasswordModal from "@/components/EnterPasswordModal";
import {
  getAllNotes,
  saveNote,
  deleteNoteToTrash,
  getTrashNotes,
  recoverNote,
  permanentlyDeleteNote,
  getStudySessions,
  recordStudySession,
  clearStudySessions,
  factoryResetWorkspace,
  clearTrash,
  seedDemoContent,
} from "@/lib/storageService";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const DEFAULT_NOTES_BY_SPACE = {
  School: [],
  Personal: [],
  Misc: [],
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * `btoa` throws a DOMException on any character outside Latin1 (accents,
 * emoji, non-Latin scripts), which would otherwise make setting a space
 * password with such a character fail silently — the modal closes as if it
 * worked, but `spacePasswords` and Dexie are never updated. Route through
 * UTF-8 bytes first so any password string can be encoded.
 */
function toBase64(input) {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

/** Graded quiz and Socratic sessions, for the mastery heatmap. */
const SESSIONS_KEY = "socratic_study_sessions";

/** Set once the seed has been planted, so clearing every note doesn't re-seed. */
const SEEDED_KEY = "socratic_demo_seeded_v7";

const isEmptyWorkspace = (bySpace) =>
  !bySpace || Object.values(bySpace).every((list) => !list || list.length === 0);

export default function Workspace() {
  const [mounted, setMounted] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeSpace, setActiveSpace] = useState(SPACES[0].name);
  const [spaces, setSpaces] = useState(SPACES);
  const [activeTab, setActiveTab] = useState("notes");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [instantNoteOpen, setInstantNoteOpen] = useState(false);
  const [exportImportOpen, setExportImportOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  // Explain / Quiz drawers. `studyTarget` survives closing so the panel does
  // not blank out mid-slide.
  const [studyTarget, setStudyTarget] = useState(null);
  const [studyKind, setStudyKind] = useState(null); // "explain" | "quiz"
  const [sessions, setSessions] = useState([]);

  // Password Locks State
  const [spacePasswords, setSpacePasswords] = useState({});
  const [setPasswordTarget, setSetPasswordTarget] = useState(null);
  const [enterPasswordTarget, setEnterPasswordTarget] = useState(null);

  // Site-wide Theme (Dark vs Light)
  const [theme, setTheme] = useState("dark");

  // Notes state
  const [notesBySpace, setNotesBySpace] = useState(DEFAULT_NOTES_BY_SPACE);
  const [trashNotes, setTrashNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [editorBlocks, setEditorBlocks] = useState([]);

  const clickToAppendSetting = useLiveQuery(
    async () => {
      const item = await db.settings.get("editor_click_to_append");
      return item ? item.value !== "false" : true;
    },
    []
  );

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



  // Factory Reset Handler
  const handleResetData = useCallback(async (target) => {
    try {
      if (target === "notes" || target === "all" || !target) {
        setNotesBySpace(DEFAULT_NOTES_BY_SPACE);
        setActiveNoteId(null);
        setTrashNotes([]);
      }
      if (target === "all" || !target) {
        setSessions([]);
      }
      await factoryResetWorkspace(target);
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
          let allDbNotes = await getAllNotes();
          if (!allDbNotes || allDbNotes.length === 0) {
            await seedDemoContent({ overwrite: true });
            allDbNotes = await getAllNotes();
          }

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

          let savedCustomSpaces = [];
          try { savedCustomSpaces = JSON.parse(localStorage.getItem("socratic_custom_spaces")) || []; } catch(e){}
          
          const merged = new Map();
          SPACES.forEach(s => merged.set(s.name, s));
          savedCustomSpaces.forEach(s => merged.set(s.name, s));
          Object.keys(spaceMap).forEach(sp => {
             if (!merged.has(sp)) merged.set(sp, { name: sp, icon: "📂" });
          });
          setSpaces(Array.from(merged.values()));

          const params = new URLSearchParams(window.location.search);
          const urlNoteId = params.get("noteId");
          const urlTab = params.get("tab");
          const urlTour = params.get("tour");
          const tourCompleted = localStorage.getItem("socratic_tutorial_completed") === "true";

          if (urlTour === "true" || !tourCompleted) {
            setTutorialOpen(true);
          }
          
          let fallback = null;
          try { fallback = JSON.parse(localStorage.getItem("socratic_last_workspace_state")); } catch(e){}

          const targetNoteId = urlNoteId || fallback?.activeNoteId;
          const targetTab = urlTab || fallback?.activeTab || "notes";

          let foundSpace = SPACES[0].name;
          let foundNoteId = null;
          
          if (targetNoteId) {
            for (const [sp, notes] of Object.entries(spaceMap)) {
              if (notes.find(n => n.id === targetNoteId)) {
                foundSpace = sp;
                foundNoteId = targetNoteId;
                break;
              }
            }
          }

          if (!foundNoteId) {
            const firstInActive = (spaceMap[foundSpace] || [])[0];
            if (firstInActive) foundNoteId = firstInActive.id;
          }

          setActiveSpace(foundSpace);
          setActiveNoteId(foundNoteId);
          setActiveTab(targetTab);

          const trash = await getTrashNotes();
          setTrashNotes(trash);

          const studySess = await getStudySessions();
          setSessions(studySess);
          
          const savedPasswords = await db.settings.get("socratic_space_passwords");
          if (savedPasswords?.value) {
            setSpacePasswords(JSON.parse(savedPasswords.value));
          }
          
          setIsHydrated(true);
        } catch (err) {
          console.error("Dexie hydration error:", err);
        }
      }

      loadLocalWorkspace();
    }
  }, []);

  // Sync state to URL and localStorage with trailing debounce
  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (activeNoteId) params.set("noteId", activeNoteId);
      if (activeTab) params.set("tab", activeTab);

      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, "", newUrl);

      localStorage.setItem(
        "socratic_last_workspace_state",
        JSON.stringify({ activeNoteId, activeTab, activeSpace })
      );
    }, 150);

    return () => clearTimeout(timer);
  }, [activeNoteId, activeTab, activeSpace, isHydrated]);

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

  useEffect(() => {
    if (mounted && typeof window !== "undefined") {
      const custom = spaces.filter(s => !SPACES.find(bs => bs.name === s.name));
      localStorage.setItem("socratic_custom_spaces", JSON.stringify(custom));
    }
  }, [spaces, mounted]);

  // Removed redundant localStorage saves for notesBySpace & trashNotes to prevent QuotaExceededError

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

  const handleDeleteSpace = useCallback(async (spaceName) => {
    if (confirm(`Are you sure you want to delete the space "${spaceName}" and ALL notes inside it?`)) {
       const notesToDelete = notesBySpace[spaceName] || [];
       for (const note of notesToDelete) {
           await handleDeleteNote(note.id, spaceName); // move to trash
       }
        setSpaces(prev => prev.filter(s => s.name !== spaceName));
        if (activeSpace === spaceName) {
          const fallbackSpace = SPACES[0].name;
          setActiveSpace(fallbackSpace);
          const firstInFallback = (notesBySpace[fallbackSpace] || [])[0];
          setActiveNoteId(firstInFallback ? firstInFallback.id : null);
        }
       // Otherwise a space recreated later with the same name would silently
       // inherit the deleted space's old password lock.
       if (spacePasswords[spaceName]) {
         const newMap = { ...spacePasswords };
         delete newMap[spaceName];
         setSpacePasswords(newMap);
         await db.settings.put({ key: "socratic_space_passwords", value: JSON.stringify(newMap) });
       }
    }
  }, [notesBySpace, activeSpace, handleDeleteNote, spacePasswords]);

  const handleSaveNote = useCallback(
    async (noteToSave) => {
      const targetNoteId = noteToSave?.id || activeNoteObj?.id || `n_${Date.now()}`;
      const targetSpace = noteToSave?.spaceId || noteToSave?.space || activeSpace;
      const updatedTitle = noteToSave?.title || activeNoteObj?.title || "Untitled Note";
      const updatedBlocks = noteToSave?.blocks || activeNoteObj?.blocks || [{ id: `blk_${Date.now()}`, type: "text", content: "" }];
      const updatedBanner = noteToSave?.banner !== undefined ? noteToSave.banner : activeNoteObj?.banner;
      const updatedFav = noteToSave?.isFavorite !== undefined ? noteToSave.isFavorite : activeNoteObj?.isFavorite;
      const updatedEmoji = noteToSave?.emoji !== undefined ? noteToSave.emoji : activeNoteObj?.emoji;

      const noteData = {
        id: targetNoteId,
        spaceId: targetSpace,
        title: updatedTitle,
        blocks: updatedBlocks,
        banner: updatedBanner,
        isFavorite: updatedFav,
        emoji: updatedEmoji,
      };

      setNotesBySpace((prev) => {
        const spaceNotes = prev[targetSpace] || [];
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
        return { ...prev, [targetSpace]: updatedNotes };
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

  // Bind global Ctrl+S shortcut to save note
  useEffect(() => {
    function handleSaveShortcut(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveNote();
      }
    }
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [handleSaveNote]);

  const handleToggleFavoriteNote = useCallback(
    async (targetNote) => {
      if (!targetNote) return;
      const nextFav = !Boolean(targetNote.isFavorite);
      await handleSaveNote({
        ...targetNote,
        isFavorite: nextFav,
      });
    },
    [handleSaveNote]
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

  const handleImportSuccess = useCallback((importedNote) => {
    if (!importedNote) return;
    const sp = importedNote.spaceId || importedNote.space || "School";

    setNotesBySpace((prev) => {
      const spaceNotes = prev[sp] || [];
      const existingIdx = spaceNotes.findIndex((n) => n.id === importedNote.id);
      if (existingIdx >= 0) return prev;
      return { ...prev, [sp]: [importedNote, ...spaceNotes] };
    });

    setActiveSpace(sp);
    setActiveNoteId(importedNote.id);
    setActiveTab("notes");
    setSaveStatus("✓ Note imported");
    setTimeout(() => setSaveStatus(""), 3500);
  }, []);

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

  async function handleDeleteNote(noteId, spaceOverride) {
    const targetSpace = spaceOverride || activeSpace;
    const spaceNotes = notesBySpace[targetSpace] || [];
    const targetNote = spaceNotes.find((n) => n.id === noteId);
    if (!targetNote) return;

    setNotesBySpace((prev) => ({
      ...prev,
      [targetSpace]: (prev[targetSpace] || []).filter((n) => n.id !== noteId),
    }));

    setTrashNotes((prev) => [
      ...prev,
      { ...targetNote, space: targetSpace, deletedAt: new Date().toISOString() },
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

    setActiveSpace(targetSpace);
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
        className={`no-print transition-all duration-300 ease-in-out shrink-0 h-full ${
          sidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0 overflow-hidden pointer-events-none"
        }`}
      >
        <Sidebar
          spaces={spaces}
          setSpaces={setSpaces}
          handleDeleteSpace={handleDeleteSpace}
          activeSpace={activeSpace}
          onSelectSpace={(spaceName) => {
            if (spacePasswords[spaceName] && spaceName !== activeSpace) {
              setEnterPasswordTarget({ name: spaceName, mode: "enter" });
              return;
            }

            setActiveSpace(spaceName);
            const firstInSpace = (notesBySpace[spaceName] || [])[0];
            if (firstInSpace) setActiveNoteId(firstInSpace.id);
            else setActiveNoteId(null);
          }}
          spacePasswords={spacePasswords}
          onSetPasswordRequest={setSetPasswordTarget}
          onRemovePasswordRequest={(spaceName) => setEnterPasswordTarget({ name: spaceName, mode: "remove" })}
          activeNoteId={activeNoteObj?.id || null}
          notesBySpace={notesBySpace}
          onSelectNote={handleSelectNote}
          onCreateNote={handleCreateNote}
          onDeleteNote={handleDeleteNote}
          onSaveNote={handleSaveNote}
          onToggleFavorite={handleToggleFavoriteNote}
          onOpenExportImport={(n) => {
            if (n) handleSelectNote(n);
            setExportImportOpen(true);
          }}
          trashNotes={trashNotes}
          onRecoverNote={handleRecoverNote}
          onPermanentlyDeleteNote={handlePermanentlyDeleteNote}
          onRecoverAllNotes={handleRecoverAllNotes}
          onPermanentlyDeleteAllNotes={handlePermanentlyDeleteAllNotes}
          theme={theme}
          setTheme={setTheme}
          onResetData={handleResetData}
          onOpenInstantNote={() => setInstantNoteOpen(true)}
          onNavigateCalendar={() => setActiveTab("calendar")}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onStartTutorial={() => setTutorialOpen(true)}
        />
      </div>

      {/* Main Container with Dual Top HUD Header */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top HUD Header 1: Workspace Breadcrumb, Navigation Tabs & Socratic Triggers */}
        <header className="no-print relative z-[60] flex h-14 shrink-0 items-center justify-between gap-4 border-b border-ink-800 bg-ink-900/90 px-6 backdrop-blur-md transition-colors duration-200">
          {/* Left Space Breadcrumb & Sidebar Toggle */}
          <div className="flex items-center gap-2.5 text-sm text-ink-400">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100 transition-colors shrink-0"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" strokeWidth={2} />
              ) : (
                <PanelLeftClose className="h-4 w-4 rotate-180" strokeWidth={2} />
              )}
            </button>

            <div className="flex items-center gap-1.5 font-medium">
              <span className="shrink-0 text-ink-500">📁</span>
              <span className="truncate text-ink-200 font-semibold">{activeSpace}</span>
            </div>
          </div>

          {/* Center View Navigation Tabs (Notes, Calendar, 3D Orbit, Mastery) */}
          <nav className="flex items-center gap-1 rounded-xl bg-ink-950 p-1 border border-ink-800 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab("notes")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
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
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
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
              onClick={() => setActiveTab("websaver")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                activeTab === "websaver"
                  ? "bg-ink-800 text-ink-100 shadow-sm"
                  : "text-ink-400 hover:bg-ink-900 hover:text-ink-200"
              }`}
            >
              <span>🔖</span>
              <span>Web Saver</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("3d")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                activeTab === "3d"
                  ? "bg-ink-800 text-ink-100 shadow-sm"
                  : "text-ink-400 hover:bg-ink-900 hover:text-ink-200"
              }`}
            >
              <span>🌌</span>
              <span>3D Orbit</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("mastery")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
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

          {/* Right Action Bar: Socratic Duck Triggers */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={!activeNoteObj}
              onClick={() => {
                if (activeTab !== "notes") setActiveTab("notes");
                openStudy("explain", null);
              }}
              title={activeNoteObj ? "Explain this note with AI" : "Create or select a note to explain"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-300 transition-all hover:border-duck-500/50 hover:text-duck-300 disabled:opacity-30 disabled:pointer-events-none"
            >
              <span>✨</span>
              <span className="hidden sm:inline">Explain</span>
            </button>

            <button
              type="button"
              disabled={!activeNoteObj}
              onClick={() => {
                if (activeTab !== "notes") setActiveTab("notes");
                openStudy("quiz", null);
              }}
              title={activeNoteObj ? "Quiz me on this note" : "Create or select a note to quiz"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-duck-500/30 bg-duck-500/10 px-3 py-1.5 text-xs font-medium text-duck-300 transition-all hover:bg-duck-500/20 hover:text-duck-200 disabled:opacity-30 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-duck-400"
            >
              <span>🦆</span>
              <span className="hidden sm:inline">Quiz me</span>
            </button>
          </div>
        </header>

        {/* Top HUD Header 2: Note Name & Note Menu Sub-bar */}
        <div className="no-print relative z-50 flex h-12 shrink-0 items-center justify-between border-b border-ink-800/80 bg-ink-900/60 px-6 backdrop-blur-md transition-colors duration-200">
          {/* Left: Active Note Emoji, Title & Favorite Badge */}
          <div className="flex items-center gap-2.5 min-w-0 font-medium">
            <span className="text-lg leading-none shrink-0">
              {activeTab === "websaver" ? "🔖" : activeNoteObj?.emoji || "📝"}
            </span>
            <span className="truncate text-sm font-extrabold text-ink-100 tracking-tight">
              {activeTab === "notes"
                ? activeNoteObj?.title || "Untitled Note"
                : activeTab === "calendar"
                ? "Study Calendar & Timers"
                : activeTab === "websaver"
                ? "Website Saver & Folder Manager"
                : activeTab === "3d"
                ? "3D Concept Visualizer"
                : "Mastery Dashboard"}
            </span>
            {activeTab === "notes" && activeNoteObj?.isFavorite && (
              <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30 shrink-0">
                ⭐ Starred
              </span>
            )}
          </div>

          {/* Right: Save Status & Note Menu Dropdown */}
          <div className="flex items-center gap-3 shrink-0">
            {saveStatus && (
              <span className="text-xs font-semibold text-emerald-400 animate-fade-in">
                {saveStatus}
              </span>
            )}

            {activeTab === "notes" && activeNoteObj && (
              <NoteMenu
                note={{
                  id: activeNoteObj.id,
                  title: activeNoteObj.title,
                  blocks: editorBlocks.length > 0 ? editorBlocks : activeNoteObj.blocks,
                  banner: activeNoteObj.banner,
                  isFavorite: activeNoteObj.isFavorite,
                  emoji: activeNoteObj.emoji,
                  space: activeSpace,
                }}
                onSaveNote={({ title, blocks, banner, isFavorite, emoji }) =>
                  handleSaveNote({ title, blocks, banner, isFavorite, emoji })
                }
                onToggleFavorite={handleToggleFavoriteNote}
                onExportImport={() => setExportImportOpen(true)}
                onDeleteNote={handleDeleteNote}
                variant="button"
                align="right"
              />
            )}
          </div>
        </div>

        {/* Tab Viewport Content */}
        <main className={`flex-1 ${activeTab === "3d" || activeTab === "websaver" ? "overflow-hidden flex flex-col h-full min-h-0" : "overflow-y-auto"}`}>
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
              onExportImport={() => setExportImportOpen(true)}
              onExplainBlock={(text) => openStudy("explain", text)}
              onQuizBlock={(text) => openStudy("quiz", text)}
              onSwitchTab={setActiveTab}
              notesBySpace={notesBySpace}
              onSelectNote={handleSelectNote}
              clickToAppend={clickToAppendSetting ?? true}
            />
          )}

          {activeTab === "calendar" && (
            <CalendarView activeSpace={activeSpace} spaces={spaces} />
          )}

          {activeTab === "websaver" && (
            <WebSaverView activeSpace={activeSpace} spaces={spaces} />
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
              onClearSessions={async () => {
                setSessions([]);
                await clearStudySessions();
              }}
            />
          )}
        </main>
      </div>

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
      {instantNoteOpen && (
        <InstantNoteModal
          open={instantNoteOpen}
          spaces={spaces}
          onClose={() => setInstantNoteOpen(false)}
          onSaveInstantNote={handleSaveInstantNote}
        />
      )}

      {/* Global Visual & Audio Alarm Alert Overlay */}
      <AlarmOverlay />

      {/* Floating Pinned Timers Screen Overlay */}
      <PinnedTimersOverlay />

      {/* Multi-Format Note Export & Import Modal (PDF, DOCX, HTML, TXT, MD) */}
      <ExportImportModal
        open={exportImportOpen}
        onClose={() => setExportImportOpen(false)}
        activeNote={activeNoteObj}
        activeSpace={activeSpace}
        spaces={spaces}
        onImportSuccess={handleImportSuccess}
      />

      <SetPasswordModal
        open={!!setPasswordTarget}
        spaceName={setPasswordTarget}
        onClose={() => setSetPasswordTarget(null)}
        onSave={async (space, pwd) => {
          const newMap = { ...spacePasswords, [space]: toBase64(pwd) };
          setSpacePasswords(newMap);
          await db.settings.put({ key: "socratic_space_passwords", value: JSON.stringify(newMap) });
          
          setActiveSpace(space);
          const firstInSpace = (notesBySpace[space] || [])[0];
          if (firstInSpace) setActiveNoteId(firstInSpace.id);
          else setActiveNoteId(null);
        }}
      />

      <EnterPasswordModal
        open={!!enterPasswordTarget}
        spaceName={enterPasswordTarget?.name}
        mode={enterPasswordTarget?.mode}
        expectedHash={enterPasswordTarget ? spacePasswords[enterPasswordTarget.name] : null}
        onClose={() => setEnterPasswordTarget(null)}
        onSuccess={async (space) => {
          if (enterPasswordTarget?.mode === "remove") {
            const newMap = { ...spacePasswords };
            delete newMap[space];
            setSpacePasswords(newMap);
            await db.settings.put({ key: "socratic_space_passwords", value: JSON.stringify(newMap) });
          } else {
            setActiveSpace(space);
            const firstInSpace = (notesBySpace[space] || [])[0];
            if (firstInSpace) setActiveNoteId(firstInSpace.id);
            else setActiveNoteId(null);
          }
        }}
      />

      <CommandPalette
        notesBySpace={notesBySpace}
        activeSpace={activeSpace}
        setActiveSpace={setActiveSpace}
        setActiveTab={setActiveTab}
        setActiveNoteId={setActiveNoteId}
      />

      <InteractiveTutorial
        isOpen={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setTutorialOpen(false);
        }}
        onOpenInstantNote={() => {
          setInstantNoteOpen(true);
          setTutorialOpen(false);
        }}
        onOpenCommandPalette={() => {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
          setTutorialOpen(false);
        }}
      />
    </div>
  );
}

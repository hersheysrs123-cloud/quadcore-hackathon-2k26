"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { SettingsModal } from "@/components/Sidebar";
import NavRail from "@/components/redesign/NavRail";
import NotesPanel from "@/components/redesign/NotesPanel";
import TopBar from "@/components/redesign/TopBar";
import HomeView from "@/components/redesign/HomeView";
import BlockNoteEditor from "@/components/BlockNoteEditor";
import CalendarView from "@/components/CalendarView";
import WebSaverView from "@/components/WebSaverView";
import dynamic from "next/dynamic";
const ThreeDView = dynamic(() => import("@/components/ThreeDView"), { ssr: false });
import QuizStudioView from "@/components/QuizStudioView";
import SpaceHubView from "@/components/SpaceHubView";
import InstantNoteModal from "@/components/InstantNoteModal";
import AlarmOverlay from "@/components/AlarmOverlay";
import ExplainPanel from "@/components/ExplainPanel";
import QuizPanel from "@/components/QuizPanel";
import AITutorPanel from "@/components/AITutorPanel";
import MasteryDashboard from "@/components/MasteryDashboard";
import ExportImportModal from "@/components/ExportImportModal";
import NoteMenu from "@/components/NoteMenu";
import CommandPalette from "@/components/CommandPalette";
import InteractiveTutorial from "@/components/InteractiveTutorial";
import { SPACES } from "@/lib/constants";
import { conceptFromText, editorBlocksToText } from "@/lib/blocks";
import { summariseMastery } from "@/lib/mastery";
import { initAndSeedDatabase, db, DEMO_SEED_KEY } from "@/lib/db";
import { TOPICS_BY_ID, formatTopicStudyContext } from "@/components/visualizations/topics";
import {
  getAllNotes,
  saveNote,
  saveNotesOrder,
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
  renameSpace,
  saveAllSpaces,
  deleteSpace,
  getSavedSpaces,
  saveSpaceSettings,
  moveNoteTreeToSpace,
} from "@/lib/storageService";
import {
  buildBreadcrumbPath,
  cloneNoteTree,
  collectDescendantIds,
  expandSelectionWithDescendants,
  findNoteAcrossSpaces,
  getChildNotes,
  getTopmostSelected,
  hasPageBlockFor,
  normalizeParentId,
  resolveRestoredParentId,
  sortNotes,
} from "@/lib/noteHierarchy";
import { Minimize2 } from "lucide-react";

const DEFAULT_NOTES_BY_SPACE = {
  School: [],
  Personal: [],
  Misc: [],
  Journal: [],
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/** Graded quiz and Socratic sessions, for the mastery heatmap. */
const SESSIONS_KEY = "socratic_study_sessions";

export default function Workspace() {
  const [mounted, setMounted] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeSpace, setActiveSpace] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const deleted = new Set(JSON.parse(localStorage.getItem("socratic_deleted_spaces") || "[]"));
        const lastState = JSON.parse(localStorage.getItem("socratic_last_workspace_state") || "null");
        if (lastState?.activeSpace && !deleted.has(lastState.activeSpace)) {
          return lastState.activeSpace;
        }
        const savedSpaces = JSON.parse(localStorage.getItem("socratic_spaces") || "null");
        if (Array.isArray(savedSpaces) && savedSpaces.length > 0) {
          const firstNonDeleted = savedSpaces.find((s) => s?.name && !deleted.has(s.name));
          if (firstNonDeleted) return firstNonDeleted.name;
        }
        const firstDefault = SPACES.find((s) => !deleted.has(s.name));
        if (firstDefault) return firstDefault.name;
      } catch (e) {}
    }
    return SPACES[0].name;
  });
  const [spaces, setSpaces] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const deleted = new Set(JSON.parse(localStorage.getItem("socratic_deleted_spaces") || "[]"));
        const savedSpaces = JSON.parse(localStorage.getItem("socratic_spaces") || "null");
        if (Array.isArray(savedSpaces) && savedSpaces.length > 0) {
          const filtered = savedSpaces.filter((s) => s?.name && !deleted.has(s.name));
          if (filtered.length > 0) return filtered;
        }
        const nonDeletedDefaults = SPACES.filter((s) => !deleted.has(s.name));
        if (nonDeletedDefaults.length > 0) return nonDeletedDefaults;
        return [{ name: "General", icon: "📂", blurb: "" }];
      } catch (e) {}
    }
    return SPACES;
  });
  const [activeTab, setActiveTab] = useState("notes");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [instantNoteOpen, setInstantNoteOpen] = useState(false);
  const [exportImportOpen, setExportImportOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [isZenMode, setIsZenMode] = useState(false);
  const [isReformattingNote, setIsReformattingNote] = useState(false);

  const toggleZenMode = useCallback(() => {
    setIsZenMode((prev) => {
      const next = !prev;
      if (next) {
        setSidebarOpen(false);
        setStudyKind(null); // Close any open Explain or Quiz drawers
      } else {
        setSidebarOpen(true);
      }
      return next;
    });
  }, []);

  // Explain / Quiz drawers. `studyTarget` survives closing so the panel does
  // not blank out mid-slide.
  const [studyTarget, setStudyTarget] = useState(null);
  const [studyKind, setStudyKind] = useState(null); // "explain" | "quiz"
  const [sessions, setSessions] = useState([]);

  // Site-wide Theme (Dark vs Light)
  const [theme, setTheme] = useState("dark");

  // Notes state
  const [notesBySpace, setNotesBySpace] = useState(DEFAULT_NOTES_BY_SPACE);
  const [trashNotes, setTrashNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [editorBlocks, setEditorBlocks] = useState([]);
  const editorBlocksRef = useRef(editorBlocks);
  const reformatNoteRef = useRef(null);
  // Imperative hook registered by the open editor so the workspace can drop a
  // sub-page card into the live document (sidebar "New sub-page", trash restore).
  const insertPageBlockRef = useRef(null);
  const registerInsertPageBlock = useCallback((fn) => {
    insertPageBlockRef.current = fn;
  }, []);

  // In-Memory Note Navigation History (Alt+← / Alt+→)
  const navHistoryRef = useRef([]); // Array of { noteId, spaceName }
  const historyIndexRef = useRef(-1);
  const [historyState, setHistoryState] = useState({ canGoBack: false, canGoForward: false });
  const isNavigatingHistoryRef = useRef(false);

  const updateHistoryState = useCallback(() => {
    setHistoryState({
      canGoBack: historyIndexRef.current > 0,
      canGoForward: historyIndexRef.current < navHistoryRef.current.length - 1,
    });
  }, []);

  const pushNavHistory = useCallback(
    (noteId, spaceName) => {
      if (!noteId || isNavigatingHistoryRef.current) return;
      const history = navHistoryRef.current;
      const curIdx = historyIndexRef.current;
      const currentEntry = history[curIdx];
      if (currentEntry && currentEntry.noteId === noteId) return;

      const newHistory = [
        ...history.slice(0, curIdx + 1),
        { noteId, spaceName: spaceName || activeSpace },
      ].slice(-50);
      navHistoryRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
      updateHistoryState();
    },
    [activeSpace, updateHistoryState]
  );

  useEffect(() => {
    if (activeNoteId && !isNavigatingHistoryRef.current) {
      pushNavHistory(activeNoteId, activeSpace);
    }
  }, [activeNoteId, activeSpace, pushNavHistory]);

  const navigateBack = useCallback(() => {
    if (historyIndexRef.current > 0) {
      isNavigatingHistoryRef.current = true;
      historyIndexRef.current -= 1;
      const target = navHistoryRef.current[historyIndexRef.current];
      if (target) {
        if (target.spaceName && target.spaceName !== activeSpace) {
          setActiveSpace(target.spaceName);
        }
        setActiveNoteId(target.noteId);
        setActiveTab("notes");
      }
      updateHistoryState();
      setTimeout(() => {
        isNavigatingHistoryRef.current = false;
      }, 60);
    }
  }, [activeSpace, updateHistoryState]);

  const navigateForward = useCallback(() => {
    if (historyIndexRef.current < navHistoryRef.current.length - 1) {
      isNavigatingHistoryRef.current = true;
      historyIndexRef.current += 1;
      const target = navHistoryRef.current[historyIndexRef.current];
      if (target) {
        if (target.spaceName && target.spaceName !== activeSpace) {
          setActiveSpace(target.spaceName);
        }
        setActiveNoteId(target.noteId);
        setActiveTab("notes");
      }
      updateHistoryState();
      setTimeout(() => {
        isNavigatingHistoryRef.current = false;
      }, 60);
    }
  }, [activeSpace, updateHistoryState]);

  useEffect(() => {
    editorBlocksRef.current = editorBlocks;
  }, [editorBlocks]);

  const clickToAppendSetting = useLiveQuery(
    async () => {
      const item = await db.settings.get("editor_click_to_append");
      return item ? item.value !== "false" : true;
    },
    []
  );

  const liveSessions = useLiveQuery(
    async () => {
      if (!db.studySessions) return [];
      return await db.studySessions.toArray();
    },
    [],
    null
  );

  useEffect(() => {
    if (liveSessions) {
      setSessions(liveSessions);
    }
  }, [liveSessions]);

  // Bind global shortcuts: Alt+← (History Back), Alt+→ (History Forward), Ctrl+I (Instant Note), Ctrl+Shift+F (Zen mode), Escape (exit Zen mode)
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        navigateBack();
      } else if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        navigateForward();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i" && !e.shiftKey) {
        e.preventDefault();
        setInstantNoteOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleZenMode();
      } else if (e.key === "Escape" && isZenMode) {
        setIsZenMode(false);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [toggleZenMode, isZenMode, navigateBack, navigateForward]);



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
          const hasSeeded = localStorage.getItem(DEMO_SEED_KEY);
          if (!hasSeeded) {
            let trashCount = 0;
            try { trashCount = await db.trash.count(); } catch (e) {}
            let deletedNotesCount = 0;
            try {
              deletedNotesCount = (JSON.parse(localStorage.getItem("socratic_deleted_notes") || "[]")).length;
            } catch (e) {}

            // Only auto-seed if workspace has NEVER seeded before and user has not trashed/deleted notes
            if ((!allDbNotes || allDbNotes.length === 0) && trashCount === 0 && deletedNotesCount === 0) {
              await seedDemoContent({ overwrite: true });
              allDbNotes = await getAllNotes();
            }
            localStorage.setItem(DEMO_SEED_KEY, "true");
          }

          const resolvedSpaces = await getSavedSpaces();

          let deletedSpaces = new Set();
          try {
            const delArr = JSON.parse(localStorage.getItem("socratic_deleted_spaces") || "[]");
            if (Array.isArray(delArr)) delArr.forEach((d) => deletedSpaces.add(d));
          } catch (e) {}

          const spaceMap = {};
          resolvedSpaces.forEach((s) => {
            if (!deletedSpaces.has(s.name)) {
              spaceMap[s.name] = [];
            }
          });

          const primaryFallbackSpace = resolvedSpaces.find((s) => !deletedSpaces.has(s.name))?.name || "General";

          allDbNotes.forEach((n) => {
            let sp = n.spaceId || n.space || primaryFallbackSpace;
            if (deletedSpaces.has(sp)) {
              sp = primaryFallbackSpace;
              // Reassign in DB in background so note doesn't reference deleted space
              db.notes.update(n.id, { space: primaryFallbackSpace, spaceId: primaryFallbackSpace }).catch(() => {});
            }
            if (!spaceMap[sp]) spaceMap[sp] = [];
            spaceMap[sp].push({
              id: n.id,
              title: n.title || "Untitled Note",
              space: sp,
              spaceId: sp,
              banner: n.banner || null,
              emoji: n.emoji || "📝",
              fontStyle: n.fontStyle || "sans",
              fullWidth: Boolean(n.fullWidth),
              isLocked: Boolean(n.isLocked),
              isFavorite: Boolean(n.isFavorite),
              parentId: normalizeParentId(n.parentId),
              order: typeof n.order === "number" ? n.order : 0,
              blocks: n.blocks || [],
              createdAt: n.createdAt || null,
              updatedAt: n.updatedAt || n.createdAt || null,
            });
          });

          // Sort each space's notes by order index
          Object.keys(spaceMap).forEach((sp) => {
            spaceMap[sp].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          });

          // A sub-page must live in the same space as its parent. Repair any
          // drift (e.g. from an older backup) by pulling strays into the parent's space.
          {
            const locationById = new Map();
            Object.entries(spaceMap).forEach(([sp, list]) => list.forEach((n) => locationById.set(n.id, sp)));
            let moved = true;
            let guard = 0;
            while (moved && guard < 64) {
              moved = false;
              guard += 1;
              Object.entries(spaceMap).forEach(([sp, list]) => {
                for (const n of [...list]) {
                  const pid = normalizeParentId(n.parentId);
                  if (!pid || !locationById.has(pid)) continue;
                  const parentSpace = locationById.get(pid);
                  if (parentSpace === sp) continue;
                  spaceMap[sp] = spaceMap[sp].filter((x) => x.id !== n.id);
                  const fixed = { ...n, space: parentSpace, spaceId: parentSpace };
                  spaceMap[parentSpace] = [...(spaceMap[parentSpace] || []), fixed];
                  locationById.set(n.id, parentSpace);
                  db.notes.update(n.id, { space: parentSpace, spaceId: parentSpace }).catch(() => {});
                  moved = true;
                }
              });
            }
          }

          setNotesBySpace(spaceMap);

          const merged = new Map();
          resolvedSpaces.forEach((s) => {
            if (!deletedSpaces.has(s.name)) {
              merged.set(s.name, s);
            }
          });
          Object.keys(spaceMap).forEach((sp) => {
            if (!merged.has(sp) && !deletedSpaces.has(sp) && (spaceMap[sp] || []).length > 0) {
              merged.set(sp, { name: sp, icon: "📂", blurb: "" });
            }
          });
          const finalSpaces = Array.from(merged.values());
          const safeFinalSpaces = finalSpaces.length > 0 ? finalSpaces : [{ name: "General", icon: "📂", blurb: "" }];
          setSpaces(safeFinalSpaces);

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
          const targetTab = urlTab || fallback?.activeTab || "home";

          let foundSpace = safeFinalSpaces[0]?.name || "General";
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

          if (!foundNoteId && fallback?.activeSpace && safeFinalSpaces.some((s) => s.name === fallback.activeSpace)) {
            foundSpace = fallback.activeSpace;
          }

          if (!foundNoteId) {
            const firstInActive = getChildNotes(spaceMap[foundSpace] || [], null)[0] || (spaceMap[foundSpace] || [])[0];
            if (firstInActive) foundNoteId = firstInActive.id;
          }

          setActiveSpace(foundSpace);
          setActiveNoteId(foundNoteId);
          setActiveTab(targetTab);

          const urlVis = params.get("vis");
          const urlStudy = params.get("study");
          if (urlStudy === "true" && urlVis && TOPICS_BY_ID[urlVis]) {
            const visTopic = TOPICS_BY_ID[urlVis];
            const studyCtx = formatTopicStudyContext(visTopic);
            setStudyTarget({
              concept: studyCtx.concept,
              focus: studyCtx.focus,
              content: studyCtx.content,
              noteId: studyCtx.noteId,
              noteTitle: studyCtx.noteTitle,
              space: studyCtx.space || foundSpace,
            });
            setStudyKind("explain");
          }

          const trash = await getTrashNotes();
          setTrashNotes(trash);

          const studySess = await getStudySessions();
          setSessions(studySess);
          
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
    if (isHydrated && typeof window !== "undefined") {
      saveAllSpaces(spaces);
    }
  }, [spaces, isHydrated]);

  // Removed redundant localStorage saves for notesBySpace & trashNotes to prevent QuotaExceededError

  useEffect(() => {
    if (isHydrated && typeof window !== "undefined") {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    }
  }, [sessions, isHydrated]);

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
      const focused = blockText?.trim?.() ? blockText : "";
      const concept = focused
        ? conceptFromText(focused)
        : (note?.title || (kind === "tutor" ? `${activeSpace} Subject Doubts` : "this note"));

      setStudyTarget({
        concept,
        focus: focused,
        content: content || "",
        noteId: note?.id ?? null,
        noteTitle: note?.title ?? "",
        space: note?.space || activeSpace,
        spaceId: note?.spaceId || activeSpace,
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

  const handleStudy3DTopic = useCallback(
    (studyData, kind = "explain") => {
      setStudyTarget({
        concept: studyData.concept || "3D Visualization",
        focus: studyData.focus || studyData.concept || "",
        content: studyData.content || "",
        noteId: studyData.noteId || `3d_${Date.now()}`,
        noteTitle: studyData.noteTitle || studyData.concept || "3D Visualization",
        space: studyData.space || activeSpace,
      });
      setStudyKind(kind);
    },
    [activeSpace],
  );

  /** From the mastery dashboard: open that note or 3D topic, then reopen on that topic. */
  const handleStudyTopic = useCallback(
    (topic, kind) => {
      if (topic.noteId && String(topic.noteId).startsWith("3d_")) {
        const visId = String(topic.noteId).replace("3d_", "");
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          params.set("vis", visId);
          window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
          try { localStorage.setItem("socratic_last_vis_state", JSON.stringify({ topicId: visId })); } catch(e){}
        }
        setActiveTab("3d");
        setStudyTarget({
          concept: topic.subtopic || topic.noteTitle?.replace("3D: ", "") || "3D Model",
          focus: topic.subtopic ?? "",
          content: topic.noteTitle || topic.subtopic || "",
          noteId: topic.noteId,
          noteTitle: topic.noteTitle || "3D Visualization",
          space: topic.space || activeSpace,
        });
        setStudyKind(kind);
        return;
      }

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

  const currentSpaceSessions = useMemo(() => {
    return sessions.filter((s) => {
      const sp = s.space || (s.noteId ? allNotes.find((n) => n.id === s.noteId)?.space : null) || "School";
      return sp === activeSpace;
    });
  }, [sessions, activeSpace, allNotes]);

  const gapCount = useMemo(
    () => summariseMastery(currentSpaceSessions).weaknesses.length,
    [currentSpaceSessions],
  );

  /** Space › Parent › … › current note, for the header breadcrumb. */
  const breadcrumbPath = useMemo(() => {
    if (!activeNoteObj?.id) return [];
    const path = buildBreadcrumbPath(notesBySpace[activeSpace] || [], activeNoteObj.id);
    return path.length > 0 ? path : [activeNoteObj];
  }, [notesBySpace, activeSpace, activeNoteObj]);

  /**
   * Moves a note to the Trash together with every nested sub-page below it
   * (Notion semantics: a parent and its children always travel as one unit).
   * If the note being viewed is part of the deleted subtree, the view jumps
   * up to the closest surviving ancestor.
   */
  const handleDeleteNote = useCallback(
    async (noteId, spaceOverride) => {
      const located = findNoteAcrossSpaces(notesBySpace, noteId);
      const targetSpace = located?.space || spaceOverride || activeSpace;
      const targetNote = located?.note || (notesBySpace[targetSpace] || []).find((n) => n.id === noteId);
      if (!targetNote) return;

      const subtreeIds = [noteId, ...collectDescendantIds(allNotes, noteId)];
      const subtreeSet = new Set(subtreeIds);
      const deletedAt = new Date().toISOString();

      setNotesBySpace((prev) => {
        const next = {};
        for (const [sp, list] of Object.entries(prev)) {
          next[sp] = (list || []).filter((n) => !subtreeSet.has(n.id));
        }
        return next;
      });

      // Order: root first, then descendants (mirrors the DB cascade). Built from
      // the memoised flat list rather than inside the state updater, which React
      // may run lazily.
      const trashedOrdered = subtreeIds
        .map((id) => {
          const n = allNotes.find((x) => x.id === id) || (id === noteId ? { ...targetNote, space: targetSpace } : null);
          return n ? { ...n, space: n.space || targetSpace, spaceId: n.spaceId || n.space || targetSpace, deletedAt } : null;
        })
        .filter(Boolean);
      setTrashNotes((prev) => {
        const existing = new Set(prev.map((t) => t.id));
        return [...prev, ...trashedOrdered.filter((t) => !existing.has(t.id))];
      });

      if (activeNoteId && subtreeSet.has(activeNoteId)) {
        const survivingParentId = normalizeParentId(targetNote.parentId);
        const survivingParent = survivingParentId ? findNoteAcrossSpaces(notesBySpace, survivingParentId) : null;
        if (survivingParent && !subtreeSet.has(survivingParent.note.id)) {
          setActiveSpace(survivingParent.space);
          setActiveNoteId(survivingParent.note.id);
        } else {
          setActiveNoteId(null);
        }
      }

      await deleteNoteToTrash(noteId);
    },
    [activeSpace, notesBySpace, activeNoteId, allNotes]
  );

  const handleRenameSpace = useCallback(
    async (oldName, newName, newIcon, newBlurb) => {
      const trimmedNew = (newName || "").trim();
      if (!oldName || !trimmedNew) return;

      try {
        await renameSpace(oldName, trimmedNew, newIcon, newBlurb);

        setSpaces((prev) => {
          const next = prev.map((s) => {
            if (s.name === oldName) {
              return {
                ...s,
                name: trimmedNew,
                icon: newIcon || s.icon || "📂",
                blurb: newBlurb !== undefined ? newBlurb : (s.blurb || ""),
              };
            }
            return s;
          });
          saveAllSpaces(next);
          return next;
        });

        setNotesBySpace((prev) => {
          const next = { ...prev };
          const notesToMove = next[oldName] || [];
          next[trimmedNew] = notesToMove.map((n) => ({
            ...n,
            space: trimmedNew,
            spaceId: trimmedNew,
          }));
          delete next[oldName];
          return next;
        });

        if (activeSpace === oldName) {
          setActiveSpace(trimmedNew);
        }

        setSessions((prev) =>
          prev.map((s) => (s.space === oldName ? { ...s, space: trimmedNew } : s))
        );

        setSaveStatus(`✓ Space updated to "${trimmedNew}"`);
        setTimeout(() => setSaveStatus(""), 3000);
      } catch (err) {
        console.error("Failed to rename space:", err);
      }
    },
    [activeSpace]
  );

  const handleEditSpace = useCallback(
    async (spaceName, updates) => {
      if (!spaceName || !updates) return;
      const trimmedNewName = updates.name ? updates.name.trim() : null;
      if (trimmedNewName && trimmedNewName !== spaceName) {
        await handleRenameSpace(spaceName, trimmedNewName, updates.icon, updates.blurb);
        return;
      }

      setSpaces((prev) => {
        const next = prev.map((s) => {
          if (s.name === spaceName) {
            return {
              ...s,
              ...updates,
              icon: updates.icon || s.icon || "📂",
              blurb: updates.blurb !== undefined ? updates.blurb : (s.blurb || ""),
            };
          }
          return s;
        });
        saveAllSpaces(next);
        return next;
      });

      if (updates.icon || updates.blurb !== undefined) {
        await saveSpaceSettings(spaceName, {
          icon: updates.icon,
          blurb: updates.blurb,
        });
      }
      setSaveStatus(`✓ Space "${spaceName}" updated`);
      setTimeout(() => setSaveStatus(""), 3000);
    },
    [handleRenameSpace]
  );


  const handleSaveNote = useCallback(
    async (noteToSave) => {
      const targetNoteId = noteToSave?.id || activeNoteObj?.id || `n_${Date.now()}`;
      const targetSpace = noteToSave?.spaceId || noteToSave?.space || activeNoteObj?.spaceId || activeNoteObj?.space || activeSpace;
      
      const isTargetActive = !noteToSave?.id || targetNoteId === activeNoteObj?.id;
      const currentBlocks = isTargetActive && editorBlocksRef.current && editorBlocksRef.current.length > 0
        ? editorBlocksRef.current
        : (activeNoteObj?.blocks || []);

      const updatedTitle = noteToSave?.title !== undefined
        ? noteToSave.title
        : (activeNoteObj?.title || "Untitled Note");

      const updatedBlocks = noteToSave?.blocks !== undefined
        ? noteToSave.blocks
        : (currentBlocks.length > 0 ? currentBlocks : [{ id: `blk_${Date.now()}`, type: "text", content: "" }]);

      const updatedBanner = noteToSave?.banner !== undefined
        ? noteToSave.banner
        : (activeNoteObj?.banner ?? null);

      const updatedFav = noteToSave?.isFavorite !== undefined
        ? Boolean(noteToSave.isFavorite)
        : Boolean(activeNoteObj?.isFavorite);

      const updatedEmoji = noteToSave?.emoji !== undefined
        ? noteToSave.emoji
        : (activeNoteObj?.emoji || "📝");

      const updatedFontStyle = noteToSave?.fontStyle !== undefined
        ? noteToSave.fontStyle
        : (activeNoteObj?.fontStyle || "sans");

      const updatedFullWidth = noteToSave?.fullWidth !== undefined
        ? Boolean(noteToSave.fullWidth)
        : Boolean(activeNoteObj?.fullWidth);

      const updatedIsLocked = noteToSave?.isLocked !== undefined
        ? Boolean(noteToSave.isLocked)
        : Boolean(activeNoteObj?.isLocked);

      const existingTarget = (notesBySpace[targetSpace] || []).find((n) => n.id === targetNoteId)
        || findNoteAcrossSpaces(notesBySpace, targetNoteId)?.note
        || null;

      const targetOrder = noteToSave?.order !== undefined
        ? noteToSave.order
        : (isTargetActive
            ? (activeNoteObj?.order ?? existingTarget?.order ?? 0)
            : (existingTarget?.order ?? 0));

      // Sub-page linkage: explicit value wins, otherwise keep what the note already has.
      let updatedParentId = noteToSave?.parentId !== undefined
        ? normalizeParentId(noteToSave.parentId)
        : normalizeParentId(existingTarget?.parentId ?? (isTargetActive ? activeNoteObj?.parentId : null));
      if (updatedParentId === targetNoteId) updatedParentId = null;

      const now = new Date().toISOString();

      const noteData = {
        id: targetNoteId,
        spaceId: targetSpace,
        parentId: updatedParentId,
        title: updatedTitle,
        blocks: updatedBlocks,
        banner: updatedBanner,
        fontStyle: updatedFontStyle,
        fullWidth: updatedFullWidth,
        isLocked: updatedIsLocked,
        isFavorite: updatedFav,
        emoji: updatedEmoji,
        order: targetOrder,
        createdAt: noteToSave?.createdAt || activeNoteObj?.createdAt || now,
        updatedAt: now,
      };

      setNotesBySpace((prev) => {
        const spaceNotes = prev[targetSpace] || [];
        const existingIdx = spaceNotes.findIndex((n) => n.id === targetNoteId);
        let updatedNotes;

        if (existingIdx >= 0) {
          updatedNotes = spaceNotes.map((n) =>
            n.id === targetNoteId
              ? { ...n, ...noteData, space: targetSpace }
              : n
          );
        } else {
          updatedNotes = [...spaceNotes, { ...noteData, space: targetSpace }];
        }
        return { ...prev, [targetSpace]: updatedNotes };
      });

      if (!activeNoteId || (isTargetActive && !activeNoteObj)) {
        setActiveNoteId(targetNoteId);
      }

      await saveNote(noteData);
      setSaveStatus("✓ Saved locally");
      setTimeout(() => setSaveStatus(""), 3000);
    },
    [activeNoteObj, activeNoteId, activeSpace, notesBySpace]
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

  /**
   * Duplicates a note together with its whole sub-page tree. Every nested page
   * is cloned with a fresh id and the parent's `page` cards are re-pointed at
   * the clones, so the copy never shares children with the original.
   */
  const handleDuplicateNote = useCallback(
    async (noteToDuplicate) => {
      if (!noteToDuplicate) return;
      const targetSpace = noteToDuplicate.spaceId || noteToDuplicate.space || activeSpace;
      const spaceNotes = notesBySpace[targetSpace] || [];

      // Use the live editor blocks for the note currently open so the copy is never stale.
      const sourceNotes = allNotes.map((n) =>
        n.id === activeNoteObj?.id && editorBlocksRef.current && editorBlocksRef.current.length > 0
          ? { ...n, blocks: editorBlocksRef.current }
          : n
      );
      if (!sourceNotes.some((n) => n.id === noteToDuplicate.id)) {
        sourceNotes.push({ ...noteToDuplicate, space: targetSpace, spaceId: targetSpace });
      }

      const siblings = getChildNotes(spaceNotes, normalizeParentId(noteToDuplicate.parentId));
      const siblingIdx = siblings.findIndex((n) => n.id === noteToDuplicate.id);
      const newOrder = siblingIdx >= 0 ? siblingIdx + 1 : siblings.length;

      const cloned = cloneNoteTree(sourceNotes, noteToDuplicate.id, {
        overrides: { space: targetSpace, spaceId: targetSpace, order: newOrder },
      });
      if (cloned.length === 0) return;
      const duplicatedNote = cloned[0];

      setNotesBySpace((prev) => {
        const currentList = [...(prev[targetSpace] || [])];
        const currentIdx = currentList.findIndex((n) => n.id === noteToDuplicate.id);
        // Shift following siblings down one slot so the copy lands right below the original.
        const shifted = currentList.map((n) =>
          normalizeParentId(n.parentId) === normalizeParentId(noteToDuplicate.parentId) && (n.order ?? 0) >= newOrder
            ? { ...n, order: (n.order ?? 0) + 1 }
            : n
        );
        if (currentIdx >= 0) {
          shifted.splice(currentIdx + 1, 0, ...cloned);
        } else {
          shifted.push(...cloned);
        }
        return { ...prev, [targetSpace]: shifted };
      });

      setActiveSpace(targetSpace);
      setActiveNoteId(duplicatedNote.id);
      setEditorBlocks(duplicatedNote.blocks);
      setActiveTab("notes");

      for (const n of cloned) {
        await saveNote(n);
      }
      setSaveStatus(cloned.length > 1 ? `✓ Duplicated (+${cloned.length - 1} nested)` : "✓ Duplicated note");
      setTimeout(() => setSaveStatus(""), 2500);
    },
    [activeNoteObj, activeSpace, notesBySpace, allNotes]
  );

  /**
   * Moves a note into another space. Its nested sub-pages always come along
   * (a sub-page must live in the same space as its parent). A moved sub-page
   * becomes a top-level note in the destination space.
   */
  const handleMoveNoteToSpace = useCallback(
    async (noteToMove, targetSpaceName) => {
      if (!noteToMove || !targetSpaceName) return;
      const fromSpace = findNoteAcrossSpaces(notesBySpace, noteToMove.id)?.space || noteToMove.spaceId || noteToMove.space || activeSpace;
      if (fromSpace === targetSpaceName) return;

      const rawBlocks =
        noteToMove.id === activeNoteObj?.id && editorBlocksRef.current && editorBlocksRef.current.length > 0
          ? editorBlocksRef.current
          : (noteToMove.blocks || []);

      const descendantIds = collectDescendantIds(allNotes, noteToMove.id);
      const subtreeSet = new Set([noteToMove.id, ...descendantIds]);
      const targetRoots = getChildNotes(notesBySpace[targetSpaceName] || [], null);
      const now = new Date().toISOString();

      const updatedRoot = {
        ...noteToMove,
        space: targetSpaceName,
        spaceId: targetSpaceName,
        parentId: null, // the moved note becomes top-level in its new space
        blocks: rawBlocks,
        order: targetRoots.length,
        updatedAt: now,
      };
      const updatedDescendants = descendantIds
        .map((id) => allNotes.find((n) => n.id === id))
        .filter(Boolean)
        .map((n) => ({ ...n, space: targetSpaceName, spaceId: targetSpaceName, updatedAt: now }));
      const movedNotes = [updatedRoot, ...updatedDescendants];

      setNotesBySpace((prev) => {
        const next = {};
        for (const [sp, list] of Object.entries(prev)) {
          next[sp] = (list || []).filter((n) => !subtreeSet.has(n.id));
        }
        next[targetSpaceName] = [...(next[targetSpaceName] || []), ...movedNotes];
        return next;
      });

      // Switch to target space and keep the moved note active
      setActiveSpace(targetSpaceName);
      setActiveNoteId(noteToMove.id);
      setEditorBlocks(updatedRoot.blocks);
      setActiveTab("notes");

      await saveNote(updatedRoot);
      if (descendantIds.length > 0) {
        await moveNoteTreeToSpace(noteToMove.id, targetSpaceName, { rootOrder: targetRoots.length });
      }
      setSaveStatus(
        descendantIds.length > 0
          ? `✓ Moved to ${targetSpaceName} (+${descendantIds.length} nested)`
          : `✓ Moved to ${targetSpaceName}`
      );
      setTimeout(() => setSaveStatus(""), 2500);
    },
    [activeNoteObj, activeSpace, notesBySpace, allNotes]
  );

  const handleRenameNote = useCallback(
    async (noteToRename, newTitle) => {
      if (!noteToRename || !newTitle?.trim()) return;
      await handleSaveNote({
        ...noteToRename,
        title: newTitle.trim(),
      });
      setSaveStatus("✓ Renamed note");
      setTimeout(() => setSaveStatus(""), 2500);
    },
    [handleSaveNote]
  );

  const handleDeleteMultipleNotes = useCallback(
    async (noteIds, spaceOverride) => {
      if (!noteIds || noteIds.length === 0) return;
      const targetSpace = spaceOverride || activeSpace;
      const spaceNotes = notesBySpace[targetSpace] || [];
      // Sub-pages always follow their parent into the trash.
      const expandedIds = expandSelectionWithDescendants(allNotes, noteIds);
      const noteIdSet = new Set(expandedIds);
      const notesToDelete = expandedIds.map((id) => allNotes.find((n) => n.id === id)).filter(Boolean);
      if (notesToDelete.length === 0) return;

      setNotesBySpace((prev) => {
        const next = {};
        for (const [sp, list] of Object.entries(prev)) {
          next[sp] = (list || []).filter((n) => !noteIdSet.has(n.id));
        }
        return next;
      });

      const now = new Date().toISOString();
      setTrashNotes((prev) => {
        const existing = new Set(prev.map((t) => t.id));
        return [
          ...prev,
          ...notesToDelete
            .filter((n) => !existing.has(n.id))
            .map((n) => ({ ...n, space: n.space || targetSpace, deletedAt: now })),
        ];
      });

      if (noteIdSet.has(activeNoteId)) {
        const remainingNotes = getChildNotes(spaceNotes.filter((n) => !noteIdSet.has(n.id)), null);
        if (remainingNotes.length > 0) {
          setActiveNoteId(remainingNotes[0].id);
          setEditorBlocks(remainingNotes[0].blocks || []);
        } else {
          setActiveNoteId(null);
          setEditorBlocks([]);
        }
      }

      // Only the topmost selected notes need a DB call: the storage layer cascades.
      for (const rootId of getTopmostSelected(allNotes, expandedIds)) {
        await deleteNoteToTrash(rootId);
      }

      setSaveStatus(`✓ Moved ${notesToDelete.length} note${notesToDelete.length === 1 ? "" : "s"} to Trash`);
      setTimeout(() => setSaveStatus(""), 2500);
    },
    [activeSpace, notesBySpace, activeNoteId, allNotes]
  );

  const handleDeleteSpace = useCallback(async (spaceName) => {
    if (confirm(`Are you sure you want to delete the space "${spaceName}" and ALL notes inside it?`)) {
       const notesToDelete = notesBySpace[spaceName] || [];
       if (notesToDelete.length > 0) {
           await handleDeleteMultipleNotes(notesToDelete.map((n) => n.id), spaceName); // move to trash
       }
       const nextSpaces = spaces.filter((s) => s.name !== spaceName);
       const fallbackSpaces = nextSpaces.length > 0 ? nextSpaces : [{ name: "General", icon: "📂", blurb: "" }];
       setSpaces(fallbackSpaces);
       await deleteSpace(spaceName);
       await saveAllSpaces(fallbackSpaces);

       setNotesBySpace((prev) => {
         const next = { ...prev };
         delete next[spaceName];
         return next;
       });

       if (activeSpace === spaceName) {
         const fallbackSpace = fallbackSpaces[0]?.name || "General";
         setActiveSpace(fallbackSpace);
         const firstInFallback = getChildNotes(notesBySpace[fallbackSpace] || [], null)[0] || (notesBySpace[fallbackSpace] || [])[0];
         setActiveNoteId(firstInFallback ? firstInFallback.id : null);
       }
    }
  }, [spaces, notesBySpace, activeSpace, handleDeleteMultipleNotes]);

  const handleMoveMultipleNotes = useCallback(
    async (noteIds, targetSpaceName) => {
      if (!noteIds || noteIds.length === 0 || !targetSpaceName) return;
      const fromSpace = activeSpace;
      if (fromSpace === targetSpaceName) return;

      const spaceNotes = notesBySpace[fromSpace] || [];
      // Selected subtrees move as units: the topmost selected notes become
      // top-level in the destination, everything beneath them keeps its parent.
      const topmostIds = getTopmostSelected(spaceNotes, noteIds);
      const expandedIds = expandSelectionWithDescendants(spaceNotes, topmostIds);
      const noteIdSet = new Set(expandedIds);
      const topmostSet = new Set(topmostIds);
      const notesToMove = expandedIds.map((id) => spaceNotes.find((n) => n.id === id)).filter(Boolean);
      if (notesToMove.length === 0) return;

      const baseOrder = getChildNotes(notesBySpace[targetSpaceName] || [], null).length;
      const now = new Date().toISOString();

      let rootIdx = 0;
      const updatedMovedNotes = notesToMove.map((n) => {
        const rawBlocks =
          n.id === activeNoteObj?.id && editorBlocksRef.current && editorBlocksRef.current.length > 0
            ? editorBlocksRef.current
            : (n.blocks || []);
        const isRoot = topmostSet.has(n.id);
        return {
          ...n,
          space: targetSpaceName,
          spaceId: targetSpaceName,
          parentId: isRoot ? null : normalizeParentId(n.parentId),
          blocks: rawBlocks,
          order: isRoot ? baseOrder + rootIdx++ : (n.order ?? 0),
          updatedAt: now,
        };
      });

      setNotesBySpace((prev) => {
        const prevFromList = (prev[fromSpace] || []).filter((n) => !noteIdSet.has(n.id));
        const prevToList = [...(prev[targetSpaceName] || []), ...updatedMovedNotes];
        return {
          ...prev,
          [fromSpace]: prevFromList,
          [targetSpaceName]: prevToList,
        };
      });

      if (noteIdSet.has(activeNoteId)) {
        setActiveSpace(targetSpaceName);
      }

      for (const note of updatedMovedNotes) {
        await saveNote(note);
      }

      setSaveStatus(`✓ Moved ${notesToMove.length} note${notesToMove.length === 1 ? "" : "s"} to ${targetSpaceName}`);
      setTimeout(() => setSaveStatus(""), 2500);
    },
    [activeNoteObj, activeNoteId, activeSpace, notesBySpace]
  );

  const handleToggleFavoriteMultipleNotes = useCallback(
    async (noteIds, forceFavorite) => {
      if (!noteIds || noteIds.length === 0) return;
      const noteIdSet = new Set(noteIds);
      const spaceNotes = notesBySpace[activeSpace] || [];
      const targetNotes = spaceNotes.filter((n) => noteIdSet.has(n.id));
      if (targetNotes.length === 0) return;

      const allFav = targetNotes.every((n) => Boolean(n.isFavorite));
      const nextFav = forceFavorite !== undefined ? Boolean(forceFavorite) : !allFav;

      setNotesBySpace((prev) => {
        const currentList = prev[activeSpace] || [];
        const updated = currentList.map((n) =>
          noteIdSet.has(n.id) ? { ...n, isFavorite: nextFav } : n
        );
        return { ...prev, [activeSpace]: updated };
      });

      for (const note of targetNotes) {
        await saveNote({
          ...note,
          isFavorite: nextFav,
        });
      }

      setSaveStatus(`✓ ${nextFav ? "Starred" : "Unstarred"} ${targetNotes.length} note${targetNotes.length === 1 ? "" : "s"}`);
      setTimeout(() => setSaveStatus(""), 2500);
    },
    [activeSpace, notesBySpace]
  );

  const handleDuplicateMultipleNotes = useCallback(
    async (noteIds) => {
      if (!noteIds || noteIds.length === 0) return;
      const spaceNotes = notesBySpace[activeSpace] || [];
      // A selected sub-page whose ancestor is also selected is already part of
      // that ancestor's clone, so only the topmost selections are duplicated.
      const topmostIds = getTopmostSelected(spaceNotes, noteIds);
      const notesToDuplicate = topmostIds.map((id) => spaceNotes.find((n) => n.id === id)).filter(Boolean);
      if (notesToDuplicate.length === 0) return;

      const sourceNotes = spaceNotes.map((n) =>
        n.id === activeNoteObj?.id && editorBlocksRef.current && editorBlocksRef.current.length > 0
          ? { ...n, blocks: editorBlocksRef.current }
          : n
      );

      const duplicatedNotes = [];
      const rootCount = getChildNotes(spaceNotes, null).length;
      const now = new Date().toISOString();

      for (let i = 0; i < notesToDuplicate.length; i++) {
        const n = notesToDuplicate[i];
        // Copies of sub-pages land at the top level so they are visible in the sidebar.
        const cloned = cloneNoteTree(sourceNotes, n.id, {
          now,
          overrides: { space: activeSpace, spaceId: activeSpace, parentId: null, order: rootCount + i },
        });
        duplicatedNotes.push(...cloned);
      }

      setNotesBySpace((prev) => {
        const currentList = prev[activeSpace] || [];
        return {
          ...prev,
          [activeSpace]: [...currentList, ...duplicatedNotes],
        };
      });

      for (const dup of duplicatedNotes) {
        await saveNote(dup);
      }

      setSaveStatus(`✓ Duplicated ${duplicatedNotes.length} note${duplicatedNotes.length === 1 ? "" : "s"}`);
      setTimeout(() => setSaveStatus(""), 2500);
    },
    [activeNoteObj, activeSpace, notesBySpace]
  );

  const handleSaveInstantNote = useCallback(
    async (instantNote) => {
      const targetSpace = instantNote.space || "Misc";
      const spaceNotes = notesBySpace[targetSpace] || [];
      const order = typeof instantNote.order === "number" ? instantNote.order : spaceNotes.length;
      const noteData = {
        id: instantNote.id,
        spaceId: targetSpace,
        title: instantNote.title || "Untitled Note",
        blocks: instantNote.blocks || [],
        banner: instantNote.banner || null,
        emoji: instantNote.emoji || "📝",
        isFavorite: Boolean(instantNote.isFavorite),
        order,
      };

      setNotesBySpace((prev) => {
        const currentSpaceNotes = prev[targetSpace] || [];
        return { ...prev, [targetSpace]: [...currentSpaceNotes, noteData] };
      });

      setActiveSpace(targetSpace);
      setActiveNoteId(instantNote.id);
      setActiveTab("notes");

      await saveNote(noteData);
    },
    [notesBySpace]
  );

  const handleImportSuccess = useCallback(async (importedNote) => {
    if (!importedNote) return;
    const sp = importedNote.spaceId || importedNote.space || "School";

    try {
      const allDbNotes = await getAllNotes();
      const resolvedSpaces = await getSavedSpaces();
      const spaceMap = {};
      resolvedSpaces.forEach((s) => {
        spaceMap[s.name] = [];
      });
      allDbNotes.forEach((n) => {
        const noteSp = n.spaceId || n.space || resolvedSpaces[0]?.name || "School";
        if (!spaceMap[noteSp]) spaceMap[noteSp] = [];
        spaceMap[noteSp].push({
          id: n.id,
          title: n.title || "Untitled Note",
          space: noteSp,
          spaceId: noteSp,
          banner: n.banner || null,
          emoji: n.emoji || "📝",
          fontStyle: n.fontStyle || "sans",
          fullWidth: Boolean(n.fullWidth),
          isLocked: Boolean(n.isLocked),
          isFavorite: Boolean(n.isFavorite),
          parentId: normalizeParentId(n.parentId),
          order: typeof n.order === "number" ? n.order : 0,
          blocks: n.blocks || [],
          createdAt: n.createdAt || null,
          updatedAt: n.updatedAt || n.createdAt || null,
        });
      });

      // Sort each space's notes by order index
      Object.keys(spaceMap).forEach((noteSp) => {
        spaceMap[noteSp].sort(
          (a, b) =>
            (a.order ?? 0) - (b.order ?? 0) ||
            (a.createdAt || "").localeCompare(b.createdAt || "") ||
            (a.id || "").localeCompare(b.id || "")
        );
      });

      setNotesBySpace(spaceMap);

      const merged = new Map();
      resolvedSpaces.forEach((s) => merged.set(s.name, s));
      Object.keys(spaceMap).forEach((noteSp) => {
        if (!merged.has(noteSp) && (spaceMap[noteSp] || []).length > 0) {
          merged.set(noteSp, { name: noteSp, icon: "📂", blurb: "" });
        }
      });
      setSpaces(Array.from(merged.values()));

      setActiveSpace(sp);
      if (importedNote.id) {
        setActiveNoteId(importedNote.id);
      }
      setActiveTab("notes");
      setSaveStatus("✓ Imported successfully");
      setTimeout(() => setSaveStatus(""), 3500);
    } catch (err) {
      console.error("Failed to reload workspace after import:", err);
    }
  }, []);

  function handleCreateNote() {
    const spaceNotes = notesBySpace[activeSpace] || [];
    const now = new Date().toISOString();
    const newNote = {
      id: `n_${Date.now()}`,
      title: "Untitled Note",
      space: activeSpace,
      spaceId: activeSpace,
      parentId: null,
      banner: null,
      emoji: "📝",
      isFavorite: false,
      order: getChildNotes(spaceNotes, null).length,
      blocks: [{ id: `blk_${Date.now()}`, type: "text", content: "" }],
      createdAt: now,
      updatedAt: now,
    };

    setNotesBySpace((prev) => ({
      ...prev,
      [activeSpace]: [...(prev[activeSpace] || []), newNote],
    }));

    setActiveNoteId(newNote.id);
    setEditorBlocks(newNote.blocks);
    setActiveTab("notes");
    saveNote(newNote);
  }

  /**
   * Guarantees the parent note embeds a `page` card for `childId` (Notion
   * invariant: every sub-page appears exactly once in its parent's body).
   * If the parent is open in the editor the card is inserted into the live
   * document; otherwise the stored blocks are patched directly.
   */
  const ensurePageBlockInParent = useCallback(
    (parentId, childId, childMeta = {}) => {
      if (!parentId || !childId) return;
      const located = findNoteAcrossSpaces(notesBySpace, parentId);
      if (!located) return;
      const parent = located.note;

      const cardBlock = {
        id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: "page",
        pageId: childId,
        content: "",
        title: childMeta.title || "Untitled Note",
        emoji: childMeta.emoji || "📄",
      };

      if (parent.id === activeNoteId && insertPageBlockRef.current) {
        insertPageBlockRef.current(cardBlock);
        return;
      }

      const liveBlocks = parent.id === activeNoteId && editorBlocksRef.current?.length > 0
        ? editorBlocksRef.current
        : (parent.blocks || []);
      if (hasPageBlockFor(liveBlocks, childId)) return;

      const nextBlocks = [...liveBlocks, cardBlock];
      setNotesBySpace((prev) => ({
        ...prev,
        [located.space]: (prev[located.space] || []).map((n) =>
          n.id === parent.id ? { ...n, blocks: nextBlocks, updatedAt: new Date().toISOString() } : n
        ),
      }));
      if (parent.id === activeNoteId) setEditorBlocks(nextBlocks);
      saveNote({ ...parent, spaceId: located.space, blocks: nextBlocks });
    },
    [notesBySpace, activeNoteId]
  );

  /**
   * Creates a brand-new blank note nested under `parentId` (same space as the
   * parent). Returns the note object synchronously so the caller (editor slash
   * menu / gutter "+" / sidebar) can embed it and navigate into it right away.
   */
  const handleCreateSubPage = useCallback(
    (parentId, spaceOverride, { insertCard = false, open = false } = {}) => {
      if (!parentId) return null;
      const located = findNoteAcrossSpaces(notesBySpace, parentId);
      const targetSpace = located?.space || spaceOverride || activeSpace;
      const siblings = getChildNotes(notesBySpace[targetSpace] || [], parentId);
      const now = new Date().toISOString();
      const child = {
        id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: "Untitled Note",
        space: targetSpace,
        spaceId: targetSpace,
        parentId,
        banner: null,
        emoji: "📄",
        fontStyle: located?.note?.fontStyle || "sans",
        fullWidth: Boolean(located?.note?.fullWidth),
        isLocked: false,
        isFavorite: false,
        order: siblings.length,
        blocks: [{ id: `blk_${Date.now()}`, type: "text", content: "" }],
        createdAt: now,
        updatedAt: now,
      };

      setNotesBySpace((prev) => ({
        ...prev,
        [targetSpace]: [...(prev[targetSpace] || []), child],
      }));
      saveNote(child);

      if (insertCard) {
        ensurePageBlockInParent(parentId, child.id, { title: child.title, emoji: child.emoji });
      }
      if (open) {
        setActiveSpace(targetSpace);
        setActiveNoteId(child.id);
        setEditorBlocks(child.blocks);
        setActiveTab("notes");
      }
      return child;
    },
    [notesBySpace, activeSpace, ensurePageBlockInParent]
  );

  /**
   * Restores a trashed note with every sub-page trashed beneath it. The root's
   * parent link is kept only when that parent is live; otherwise the note is
   * promoted to top-level. If the parent is live but lost its card (e.g. the
   * card was deleted from the parent body), the card is re-inserted.
   */
  async function handleRecoverNote(noteId, { navigate = true } = {}) {
    const target = trashNotes.find((n) => n.id === noteId);
    if (!target) return;

    const subtreeIds = [noteId, ...collectDescendantIds(trashNotes, noteId)];
    const subtreeSet = new Set(subtreeIds);
    const liveIds = new Set([...allNotes.map((n) => n.id), ...subtreeIds]);
    const rootParentId = resolveRestoredParentId(target, liveIds);
    const parentLocation = rootParentId ? findNoteAcrossSpaces(notesBySpace, rootParentId) : null;
    // A restored sub-page must land in its parent's space.
    const targetSpace = parentLocation?.space || target.space || target.spaceId || activeSpace;
    const spaceNotes = notesBySpace[targetSpace] || [];
    const rootSiblings = getChildNotes(spaceNotes, rootParentId);

    const restoredNotes = subtreeIds
      .map((id) => trashNotes.find((t) => t.id === id))
      .filter(Boolean)
      .map((item) => {
        const { deletedAt, ...rest } = item;
        const isRoot = item.id === noteId;
        return {
          ...rest,
          space: targetSpace,
          spaceId: targetSpace,
          parentId: isRoot ? rootParentId : resolveRestoredParentId(rest, liveIds),
          order: isRoot
            ? (typeof rest.order === "number" ? rest.order : rootSiblings.length)
            : (typeof rest.order === "number" ? rest.order : 0),
        };
      });

    setTrashNotes((prev) => prev.filter((n) => !subtreeSet.has(n.id)));
    setNotesBySpace((prev) => ({
      ...prev,
      [targetSpace]: [...(prev[targetSpace] || []).filter((n) => !subtreeSet.has(n.id)), ...restoredNotes],
    }));

    if (navigate) {
      setActiveSpace(targetSpace);
      setActiveNoteId(target.id);
    }
    await recoverNote(noteId);
    if (targetSpace !== (target.space || target.spaceId) && restoredNotes.length > 0) {
      for (const n of restoredNotes) await saveNote(n);
    }
    if (rootParentId) {
      ensurePageBlockInParent(rootParentId, target.id, { title: target.title, emoji: target.emoji });
    }
  }

  async function handlePermanentlyDeleteNote(noteId) {
    const subtreeSet = new Set([noteId, ...collectDescendantIds(trashNotes, noteId)]);
    setTrashNotes((prev) => prev.filter((n) => !subtreeSet.has(n.id)));
    await permanentlyDeleteNote(noteId);
  }

  async function handleRecoverAllNotes() {
    const itemsToRecover = [...trashNotes];
    if (itemsToRecover.length === 0) return;
    const liveIds = new Set([...allNotes.map((n) => n.id), ...itemsToRecover.map((t) => t.id)]);
    const trashById = new Map(itemsToRecover.map((t) => [t.id, t]));

    // Sub-pages must end up in their (possibly also restored) parent's space.
    const resolveSpace = (item, depth = 0) => {
      const pid = resolveRestoredParentId(item, liveIds);
      if (!pid || depth > 64) return item.space || item.spaceId || "School";
      const liveParent = findNoteAcrossSpaces(notesBySpace, pid);
      if (liveParent) return liveParent.space;
      const trashedParent = trashById.get(pid);
      return trashedParent ? resolveSpace(trashedParent, depth + 1) : (item.space || item.spaceId || "School");
    };

    const restored = itemsToRecover.map((item) => {
      const { deletedAt, ...rest } = item;
      const sp = resolveSpace(item);
      return { ...rest, space: sp, spaceId: sp, parentId: resolveRestoredParentId(rest, liveIds) };
    });

    setNotesBySpace((prev) => {
      const updated = { ...prev };
      for (const item of restored) {
        const sp = item.space;
        const currentSpNotes = (updated[sp] || []).filter((n) => n.id !== item.id);
        const recoveredItem = {
          ...item,
          order: typeof item.order === "number" ? item.order : getChildNotes(currentSpNotes, item.parentId).length,
        };
        updated[sp] = [...currentSpNotes, recoveredItem];
      }
      return updated;
    });

    setTrashNotes([]);

    for (const item of itemsToRecover) {
      await recoverNote(item.id);
    }
    // Persist any space / parent corrections the resolver made.
    for (const item of restored) {
      const original = trashById.get(item.id);
      if (item.space !== (original.space || original.spaceId) || normalizeParentId(item.parentId) !== normalizeParentId(original.parentId)) {
        await saveNote(item);
      }
    }
    // Re-link restored sub-pages whose parent stayed live but lost its card.
    for (const item of restored) {
      if (item.parentId && !trashById.has(item.parentId)) {
        ensurePageBlockInParent(item.parentId, item.id, { title: item.title, emoji: item.emoji });
      }
    }
  }

  async function handlePermanentlyDeleteAllNotes() {
    setTrashNotes([]);
    await clearTrash();
  }

  const handleSelectNote = useCallback((noteObj) => {
    if (!noteObj) return;
    const targetId = typeof noteObj === "string" ? noteObj : noteObj.id;
    if (!targetId) return;

    let found = null;
    for (const [space, list] of Object.entries(notesBySpace)) {
      const match = (list || []).find((n) => n.id === targetId);
      if (match) {
        found = { ...match, space };
        break;
      }
    }

    if (found) {
      setActiveSpace(found.space);
      setActiveNoteId(found.id);
      setEditorBlocks(found.blocks || []);
    } else {
      setActiveNoteId(targetId);
      if (noteObj.blocks) setEditorBlocks(noteObj.blocks);
    }
    setActiveTab("notes");
  }, [notesBySpace]);

  /**
   * Re-orders one sibling group (the top-level notes, or the children of one
   * parent). Notes outside the group are untouched; the space list is re-sorted
   * so `order` stays the single source of truth.
   */
  const handleReorderNotes = useCallback(async (spaceId, reorderedNotes) => {
    if (!spaceId || !Array.isArray(reorderedNotes)) return;

    const indexedNotes = reorderedNotes.map((n, idx) => ({
      ...n,
      space: spaceId,
      spaceId: spaceId,
      order: idx,
    }));
    const orderById = new Map(indexedNotes.map((n) => [n.id, n]));

    setNotesBySpace((prev) => {
      const list = prev[spaceId] || [];
      const known = new Set(list.map((n) => n.id));
      const merged = list.map((n) => (orderById.has(n.id) ? { ...n, order: orderById.get(n.id).order } : n));
      indexedNotes.forEach((n) => {
        if (!known.has(n.id)) merged.push(n);
      });
      return { ...prev, [spaceId]: sortNotes(merged) };
    });

    await saveNotesOrder(spaceId, indexedNotes);
  }, []);

  /** Open a 3D topic from Home / Mastery without also opening a drawer. */
  const openVisualisation = useCallback((visId) => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("vis", visId);
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
      try { localStorage.setItem("socratic_last_vis_state", JSON.stringify({ topicId: visId })); } catch (e) {}
    }
    setActiveTab("3d");
  }, []);

  /** Explain / quiz a note that is not necessarily the open one (Home cards). */
  const studyNote = useCallback(
    (kind, note) => {
      if (!note) return;
      handleSelectNote(note);
      openStudy(kind, null, note, editorBlocksToText(note.blocks || []));
    },
    [handleSelectNote, openStudy]
  );

  const openCommandPalette = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
  }, []);

  const noteMenuNode =
    activeTab === "notes" && activeNoteObj ? (
      <NoteMenu
        mode="document"
        note={{
          id: activeNoteObj.id,
          spaceId: activeNoteObj.spaceId || activeSpace,
          space: activeNoteObj.space || activeSpace,
          title: activeNoteObj.title,
          blocks: editorBlocks.length > 0 ? editorBlocks : activeNoteObj.blocks,
          banner: activeNoteObj.banner,
          isFavorite: activeNoteObj.isFavorite,
          emoji: activeNoteObj.emoji,
          fontStyle: activeNoteObj.fontStyle || "sans",
          fullWidth: Boolean(activeNoteObj.fullWidth),
          isLocked: Boolean(activeNoteObj.isLocked),
          updatedAt: activeNoteObj.updatedAt,
          createdAt: activeNoteObj.createdAt,
        }}
        spaces={spaces}
        onChangeFontStyle={(fontStyle) => handleSaveNote({ ...activeNoteObj, fontStyle })}
        onToggleFullWidth={(fullWidth) => handleSaveNote({ ...activeNoteObj, fullWidth })}
        onToggleLockPage={(isLocked) => handleSaveNote({ ...activeNoteObj, isLocked })}
        onSaveNote={handleSaveNote}
        onToggleFavorite={handleToggleFavoriteNote}
        onDuplicateNote={handleDuplicateNote}
        onMoveNote={handleMoveNoteToSpace}
        onRenameNote={handleRenameNote}
        onReformatNote={() => reformatNoteRef.current?.()}
        isReformatting={isReformattingNote}
        onExportImport={() => setExportImportOpen(true)}
        onDeleteNote={handleDeleteNote}
        onCreateSubPage={(parentNote) => {
          const pid = parentNote?.id || activeNoteObj?.id;
          if (!pid) return;
          handleCreateSubPage(pid, undefined, { insertCard: true, open: true });
        }}
        variant="icon"
        align="right"
      />
    ) : null;

  return (
    <div className="flex h-screen overflow-hidden bg-ink-950 text-ink-100 transition-colors duration-200">
      {/* ── Primary navigation rail ─────────────────────────────── */}
      {!isZenMode && (
        <NavRail
          activeTab={activeTab}
          onNavigate={setActiveTab}
          gapCount={gapCount}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenInstantNote={() => setInstantNoteOpen(true)}
          onOpenSearch={openCommandPalette}
        />
      )}

      {/* ── Contextual notes panel (Notes section only) ───────────── */}
      {!isZenMode && activeTab === "notes" && sidebarOpen && (
        <NotesPanel
          spaces={spaces}
          setSpaces={setSpaces}
          activeSpace={activeSpace}
          onSelectSpace={(spaceName) => {
            setActiveSpace(spaceName);
            const notesInSelected = notesBySpace[spaceName] || [];
            const firstInSpace = getChildNotes(notesInSelected, null)[0] || notesInSelected[0];
            if (firstInSpace) {
              setActiveNoteId(firstInSpace.id);
              setEditorBlocks(firstInSpace.blocks || []);
            } else {
              setActiveNoteId(null);
              setEditorBlocks([]);
            }
          }}
          onEditSpace={handleEditSpace}
          onDeleteSpace={handleDeleteSpace}
          onOpenSpaceHub={() => setActiveTab("spacehub")}
          notesBySpace={notesBySpace}
          activeNoteId={activeNoteObj?.id || null}
          onSelectNote={handleSelectNote}
          onCreateNote={handleCreateNote}
          onSaveNote={handleSaveNote}
          onToggleFavorite={handleToggleFavoriteNote}
          onDuplicateNote={handleDuplicateNote}
          onMoveNote={handleMoveNoteToSpace}
          onRenameNote={handleRenameNote}
          onDeleteNote={handleDeleteNote}
          onCreateSubPage={(parentNote) => {
            const pid = typeof parentNote === "string" ? parentNote : parentNote?.id;
            if (!pid) return;
            handleCreateSubPage(pid, undefined, { insertCard: true, open: true });
          }}
          onReorderNotes={handleReorderNotes}
          onDeleteMultipleNotes={handleDeleteMultipleNotes}
          onMoveMultipleNotes={handleMoveMultipleNotes}
          onToggleFavoriteMultipleNotes={handleToggleFavoriteMultipleNotes}
          onDuplicateMultipleNotes={handleDuplicateMultipleNotes}
          trashNotes={trashNotes}
          onRecoverNote={handleRecoverNote}
          onPermanentlyDeleteNote={handlePermanentlyDeleteNote}
          onRecoverAllNotes={handleRecoverAllNotes}
          onPermanentlyDeleteAllNotes={handlePermanentlyDeleteAllNotes}
        />
      )}

      {/* ── Content column ───────────────────────────────────────── */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {isZenMode && (
          <div className="no-print fixed right-4 top-3 z-[100] animate-fade-in">
            <button
              type="button"
              onClick={toggleZenMode}
              title="Exit focus mode (Esc or Ctrl+Shift+F)"
              className="flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900/90 px-3.5 py-1.5 text-xs font-semibold text-ink-200 shadow-xl backdrop-blur-md transition-colors hover:border-duck-500/50 hover:text-duck-300"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              <span>Exit focus</span>
              <kbd className="hidden rounded border border-ink-700 bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-ink-400 sm:inline">Esc</kbd>
            </button>
          </div>
        )}

        {!isZenMode && (
          <TopBar
            activeTab={activeTab}
            activeSpace={activeSpace}
            breadcrumbPath={breadcrumbPath}
            activeNote={activeNoteObj}
            onSelectNote={handleSelectNote}
            onOpenSpaceHub={() => setActiveTab("spacehub")}
            showPanelToggle={activeTab === "notes"}
            panelOpen={sidebarOpen}
            onTogglePanel={() => setSidebarOpen((v) => !v)}
            historyState={historyState}
            onBack={navigateBack}
            onForward={navigateForward}
            saveStatus={saveStatus}
            studyKind={studyKind}
            onExplain={() => {
              if (studyKind === "explain") return setStudyKind(null);
              if (activeTab !== "notes") setActiveTab("notes");
              openStudy("explain", null);
            }}
            onQuiz={() => {
              if (studyKind === "quiz") return setStudyKind(null);
              if (activeTab !== "notes") setActiveTab("notes");
              openStudy("quiz", null);
            }}
            onTutor={() => (studyKind === "tutor" ? setStudyKind(null) : openStudy("tutor", null))}
            noteMenu={noteMenuNode}
            onToggleZen={toggleZenMode}
          />
        )}

        <main
          className={`flex-1 transition-all duration-300 ease-in-out ${
            !isZenMode && studyKind ? "lg:mr-[480px] xl:mr-[520px]" : ""
          } ${
            activeTab === "3d" || activeTab === "websaver" || activeTab === "quizzes"
              ? "flex h-full min-h-0 flex-col overflow-hidden"
              : "overflow-y-auto"
          }`}
        >
          {activeTab === "home" && (
            <HomeView
              activeSpace={activeSpace}
              notes={allNotes}
              sessions={sessions}
              mounted={mounted}
              onOpenNote={handleSelectNote}
              onCreateNote={handleCreateNote}
              onOpenInstantNote={() => setInstantNoteOpen(true)}
              onExplainNote={(n) => studyNote("explain", n)}
              onQuizNote={(n) => studyNote("quiz", n)}
              onNavigate={setActiveTab}
              onOpen3D={openVisualisation}
              onStartTutorial={() => setTutorialOpen(true)}
            />
          )}

          {activeTab === "notes" && (
            <BlockNoteEditor
              key={activeNoteObj?.id || `empty_${activeSpace}`}
              noteId={activeNoteObj?.id || ""}
              spaceId={activeNoteObj?.spaceId || activeNoteObj?.space || activeSpace}
              initialTitle={activeNoteObj?.title || ""}
              initialBlocks={activeNoteObj?.blocks}
              initialBanner={activeNoteObj?.banner}
              initialFavorite={activeNoteObj?.isFavorite}
              initialEmoji={activeNoteObj?.emoji}
              initialFontStyle={activeNoteObj?.fontStyle || "sans"}
              initialFullWidth={Boolean(activeNoteObj?.fullWidth)}
              initialLocked={Boolean(activeNoteObj?.isLocked)}
              onToggleLock={() => {
                handleSaveNote({ ...activeNoteObj, isLocked: !Boolean(activeNoteObj?.isLocked) });
              }}
              onBlocksChange={setEditorBlocks}
              onSaveNote={handleSaveNote}
              onExportImport={() => setExportImportOpen(true)}
              onRegisterReformat={(fn) => {
                reformatNoteRef.current = fn;
              }}
              onReformatStateChange={({ isReformatting }) => {
                setIsReformattingNote(Boolean(isReformatting));
              }}
              onExplainBlock={(text) => openStudy("explain", text)}
              onQuizBlock={(text) => openStudy("quiz", text)}
              onTriggerSocratic={openStudy}
              onSwitchTab={setActiveTab}
              notesBySpace={notesBySpace}
              onSelectNote={handleSelectNote}
              clickToAppend={clickToAppendSetting ?? true}
              trashNotes={trashNotes}
              onCreateSubPage={(parentId, spaceId) =>
                handleCreateSubPage(parentId || activeNoteObj?.id, spaceId || activeNoteObj?.spaceId || activeSpace)
              }
              onTrashSubPage={(pageId) => handleDeleteNote(pageId)}
              onRecoverSubPage={(pageId) => handleRecoverNote(pageId, { navigate: false })}
              onRegisterInsertPageBlock={registerInsertPageBlock}
            />
          )}

          {activeTab === "calendar" && (
            <CalendarView activeSpace={activeSpace} spaces={spaces} />
          )}

          {activeTab === "websaver" && (
            <WebSaverView activeSpace={activeSpace} spaces={spaces} />
          )}

          {activeTab === "3d" && (
            <ThreeDView
              hideTopBars={isZenMode}
              onToggleTopBars={toggleZenMode}
              onStudyTopic={handleStudy3DTopic}
            />
          )}

          {activeTab === "quizzes" && (
            <QuizStudioView
              activeSpace={activeSpace}
              setActiveSpace={setActiveSpace}
              notesBySpace={notesBySpace}
              onSelectNote={handleSelectNote}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === "spacehub" && (
            <SpaceHubView
              activeSpace={activeSpace}
              onSelectSpace={setActiveSpace}
              spaces={spaces}
              onUpdateSpace={handleEditSpace}
              onRenameSpace={handleRenameSpace}
              onBack={() => setActiveTab("notes")}
              notesCount={(notesBySpace[activeSpace] || []).length}
            />
          )}

          {activeTab === "mastery" && (
            <MasteryDashboard
              sessions={sessions}
              notes={allNotes}
              activeSpace={activeSpace}
              spaces={spaces}
              onSelectSpace={setActiveSpace}
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
              onClearSessions={async (targetSpace) => {
                const spaceToClear = targetSpace || activeSpace;
                if (spaceToClear === "all") {
                  setSessions([]);
                  await clearStudySessions();
                } else {
                  setSessions((prev) =>
                    prev.filter((s) => {
                      const sp = s.space || (s.noteId ? allNotes.find((n) => n.id === s.noteId)?.space : null) || "School";
                      return sp !== spaceToClear;
                    })
                  );
                  await clearStudySessions(spaceToClear);
                }
              }}
            />
          )}
        </main>
      </div>

      {/* Explain — the teaching half. Stays mounted so it can animate out. */}
      <ExplainPanel
        open={!isZenMode && studyKind === "explain"}
        concept={studyTarget?.concept ?? ""}
        focus={studyTarget?.focus ?? ""}
        noteContent={studyTarget?.content ?? ""}
        spaceId={studyTarget?.spaceId || activeSpace}
        onClose={closeStudy}
        onQuiz={() => setStudyKind("quiz")}
      />

      {/* Quiz — graded questions or a Socratic interrogation. */}
      <QuizPanel
        open={!isZenMode && studyKind === "quiz"}
        concept={studyTarget?.concept ?? ""}
        noteContent={studyTarget?.content ?? ""}
        spaceId={studyTarget?.spaceId || activeSpace}
        onClose={closeStudy}
        onComplete={handleRecordSession}
      />

      {/* AI Tutor — doubt clearing with the space's syllabus documents. */}
      <AITutorPanel
        open={!isZenMode && studyKind === "tutor"}
        concept={studyTarget?.concept ?? ""}
        noteContent={studyTarget?.content ?? ""}
        spaceId={studyTarget?.spaceId || activeSpace}
        spaceName={studyTarget?.space || activeSpace}
        onClose={closeStudy}
      />

      {instantNoteOpen && (
        <InstantNoteModal
          open={instantNoteOpen}
          spaces={spaces}
          onClose={() => setInstantNoteOpen(false)}
          onSaveInstantNote={handleSaveInstantNote}
        />
      )}

      <AlarmOverlay />

      <ExportImportModal
        open={exportImportOpen}
        onClose={() => setExportImportOpen(false)}
        activeNote={activeNoteObj}
        activeSpace={activeSpace}
        spaces={spaces}
        onImportSuccess={handleImportSuccess}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        onResetData={handleResetData}
        spaces={spaces}
        onStartTutorial={() => {
          setSettingsOpen(false);
          setTutorialOpen(true);
        }}
      />

      <CommandPalette
        notesBySpace={notesBySpace}
        activeSpace={activeSpace}
        setActiveSpace={setActiveSpace}
        setActiveTab={setActiveTab}
        setActiveNoteId={setActiveNoteId}
        onOpenSettings={() => setSettingsOpen(true)}
        onStartTutorial={() => setTutorialOpen(true)}
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
          openCommandPalette();
          setTutorialOpen(false);
        }}
      />
    </div>
  );
}

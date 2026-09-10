"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Sidebar from "@/components/Sidebar";
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
import { SPACES } from "@/lib/constants";
import { conceptFromText, editorBlocksToText } from "@/lib/blocks";
import { summariseMastery } from "@/lib/mastery";
import { initAndSeedDatabase, db } from "@/lib/db";
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
  getSavedSpaces,
  saveSpaceSettings,
} from "@/lib/storageService";
import { PanelLeftClose, Maximize2, Minimize2, ChevronLeft, ChevronRight } from "lucide-react";

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
  const [activeSpace, setActiveSpace] = useState(SPACES[0].name);
  const [spaces, setSpaces] = useState(SPACES);
  const [activeTab, setActiveTab] = useState("notes");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [instantNoteOpen, setInstantNoteOpen] = useState(false);
  const [exportImportOpen, setExportImportOpen] = useState(false);
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
          if (!allDbNotes || allDbNotes.length === 0) {
            await seedDemoContent({ overwrite: true });
            allDbNotes = await getAllNotes();
          }

          const spaceMap = { School: [], Personal: [], Misc: [], Journal: [] };
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
              fontStyle: n.fontStyle || "sans",
              fullWidth: Boolean(n.fullWidth),
              isLocked: Boolean(n.isLocked),
              isFavorite: Boolean(n.isFavorite),
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

          setNotesBySpace(spaceMap);

          const resolvedSpaces = await getSavedSpaces();
          const merged = new Map();
          resolvedSpaces.forEach((s) => merged.set(s.name, s));
          Object.keys(spaceMap).forEach((sp) => {
            if (!merged.has(sp)) merged.set(sp, { name: sp, icon: "📂", blurb: "" });
          });
          setSpaces(Array.from(merged.values()));

          const params = new URLSearchParams(window.location.search);
          const urlNoteId = params.get("noteId");
          const urlTab = params.get("tab");
          
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
    if (mounted && typeof window !== "undefined") {
      saveAllSpaces(spaces);
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

  const handleDeleteNote = useCallback(
    async (noteId, spaceOverride) => {
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
    },
    [activeSpace, notesBySpace, activeNoteId]
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

  const handleDeleteSpace = useCallback(async (spaceName) => {
    if (confirm(`Are you sure you want to delete the space "${spaceName}" and ALL notes inside it?`)) {
       const notesToDelete = notesBySpace[spaceName] || [];
       for (const note of notesToDelete) {
           await handleDeleteNote(note.id, spaceName); // move to trash
       }
       setSpaces(prev => {
         const next = prev.filter(s => s.name !== spaceName);
         saveAllSpaces(next);
         return next;
       });
       if (activeSpace === spaceName) {
         const fallbackSpace = SPACES[0].name;
         setActiveSpace(fallbackSpace);
         const firstInFallback = (notesBySpace[fallbackSpace] || [])[0];
         setActiveNoteId(firstInFallback ? firstInFallback.id : null);
       }
    }
  }, [notesBySpace, activeSpace, handleDeleteNote]);

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

      const targetOrder = noteToSave?.order !== undefined
        ? noteToSave.order
        : (isTargetActive
            ? (activeNoteObj?.order ?? 0)
            : ((notesBySpace[targetSpace] || []).find((n) => n.id === targetNoteId)?.order ?? 0));

      const now = new Date().toISOString();

      const noteData = {
        id: targetNoteId,
        spaceId: targetSpace,
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

  const handleDuplicateNote = useCallback(
    async (noteToDuplicate) => {
      if (!noteToDuplicate) return;
      const targetSpace = noteToDuplicate.spaceId || noteToDuplicate.space || activeSpace;
      const spaceNotes = notesBySpace[targetSpace] || [];

      // Clone blocks with new unique IDs
      const rawBlocks =
        noteToDuplicate.id === activeNoteObj?.id && editorBlocksRef.current && editorBlocksRef.current.length > 0
          ? editorBlocksRef.current
          : (noteToDuplicate.blocks || []);

      const clonedBlocks = rawBlocks.map((b) => ({
        ...b,
        id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        tableData: b.tableData ? JSON.parse(JSON.stringify(b.tableData)) : undefined,
        meta: b.meta ? JSON.parse(JSON.stringify(b.meta)) : undefined,
      }));

      const currentIdx = spaceNotes.findIndex((n) => n.id === noteToDuplicate.id);
      const newOrder = currentIdx >= 0 ? currentIdx + 1 : spaceNotes.length;

      const duplicatedNote = {
        id: `n_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        title: `Copy of ${noteToDuplicate.title || "Untitled Note"}`,
        space: targetSpace,
        spaceId: targetSpace,
        banner: noteToDuplicate.banner || null,
        emoji: noteToDuplicate.emoji || "📝",
        isFavorite: Boolean(noteToDuplicate.isFavorite),
        order: newOrder,
        blocks: clonedBlocks.length > 0 ? clonedBlocks : [{ id: `blk_${Date.now()}`, type: "text", content: "" }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setNotesBySpace((prev) => {
        const currentList = [...(prev[targetSpace] || [])];
        if (currentIdx >= 0) {
          currentList.splice(currentIdx + 1, 0, duplicatedNote);
        } else {
          currentList.push(duplicatedNote);
        }
        return { ...prev, [targetSpace]: currentList };
      });

      setActiveSpace(targetSpace);
      setActiveNoteId(duplicatedNote.id);
      setEditorBlocks(duplicatedNote.blocks);
      setActiveTab("notes");

      await saveNote(duplicatedNote);
      setSaveStatus("✓ Duplicated note");
      setTimeout(() => setSaveStatus(""), 2500);
    },
    [activeNoteObj, activeSpace, notesBySpace]
  );

  const handleMoveNoteToSpace = useCallback(
    async (noteToMove, targetSpaceName) => {
      if (!noteToMove || !targetSpaceName) return;
      const fromSpace = noteToMove.spaceId || noteToMove.space || activeSpace;
      if (fromSpace === targetSpaceName) return;

      const rawBlocks =
        noteToMove.id === activeNoteObj?.id && editorBlocksRef.current && editorBlocksRef.current.length > 0
          ? editorBlocksRef.current
          : (noteToMove.blocks || []);

      const targetSpaceNotes = notesBySpace[targetSpaceName] || [];
      const updatedNote = {
        ...noteToMove,
        space: targetSpaceName,
        spaceId: targetSpaceName,
        blocks: rawBlocks,
        order: targetSpaceNotes.length,
        updatedAt: new Date().toISOString(),
      };

      setNotesBySpace((prev) => {
        const prevFromList = (prev[fromSpace] || []).filter((n) => n.id !== noteToMove.id);
        const prevToList = [...(prev[targetSpaceName] || []), updatedNote];
        return {
          ...prev,
          [fromSpace]: prevFromList,
          [targetSpaceName]: prevToList,
        };
      });

      // Switch to target space and keep the moved note active
      setActiveSpace(targetSpaceName);
      setActiveNoteId(noteToMove.id);
      setEditorBlocks(updatedNote.blocks);
      setActiveTab("notes");

      await saveNote(updatedNote);
      setSaveStatus(`✓ Moved to ${targetSpaceName}`);
      setTimeout(() => setSaveStatus(""), 2500);
    },
    [activeNoteObj, activeSpace, notesBySpace]
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
      const noteIdSet = new Set(noteIds);
      const notesToDelete = spaceNotes.filter((n) => noteIdSet.has(n.id));
      if (notesToDelete.length === 0) return;

      setNotesBySpace((prev) => ({
        ...prev,
        [targetSpace]: (prev[targetSpace] || []).filter((n) => !noteIdSet.has(n.id)),
      }));

      const now = new Date().toISOString();
      setTrashNotes((prev) => [
        ...prev,
        ...notesToDelete.map((n) => ({ ...n, space: targetSpace, deletedAt: now })),
      ]);

      if (noteIdSet.has(activeNoteId)) {
        const remainingNotes = spaceNotes.filter((n) => !noteIdSet.has(n.id));
        if (remainingNotes.length > 0) {
          setActiveNoteId(remainingNotes[0].id);
          setEditorBlocks(remainingNotes[0].blocks || []);
        } else {
          setActiveNoteId(null);
          setEditorBlocks([]);
        }
      }

      for (const note of notesToDelete) {
        await deleteNoteToTrash(note.id);
      }

      setSaveStatus(`✓ Moved ${notesToDelete.length} note${notesToDelete.length === 1 ? "" : "s"} to Trash`);
      setTimeout(() => setSaveStatus(""), 2500);
    },
    [activeSpace, notesBySpace, activeNoteId]
  );

  const handleMoveMultipleNotes = useCallback(
    async (noteIds, targetSpaceName) => {
      if (!noteIds || noteIds.length === 0 || !targetSpaceName) return;
      const fromSpace = activeSpace;
      if (fromSpace === targetSpaceName) return;

      const noteIdSet = new Set(noteIds);
      const spaceNotes = notesBySpace[fromSpace] || [];
      const notesToMove = spaceNotes.filter((n) => noteIdSet.has(n.id));
      if (notesToMove.length === 0) return;

      const targetSpaceNotes = notesBySpace[targetSpaceName] || [];
      const baseOrder = targetSpaceNotes.length;

      const updatedMovedNotes = notesToMove.map((n, idx) => {
        const rawBlocks =
          n.id === activeNoteObj?.id && editorBlocksRef.current && editorBlocksRef.current.length > 0
            ? editorBlocksRef.current
            : (n.blocks || []);
        return {
          ...n,
          space: targetSpaceName,
          spaceId: targetSpaceName,
          blocks: rawBlocks,
          order: baseOrder + idx,
          updatedAt: new Date().toISOString(),
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
      const noteIdSet = new Set(noteIds);
      const spaceNotes = notesBySpace[activeSpace] || [];
      const notesToDuplicate = spaceNotes.filter((n) => noteIdSet.has(n.id));
      if (notesToDuplicate.length === 0) return;

      const duplicatedNotes = [];
      const currentMaxOrder = spaceNotes.length;

      for (let i = 0; i < notesToDuplicate.length; i++) {
        const n = notesToDuplicate[i];
        const rawBlocks =
          n.id === activeNoteObj?.id && editorBlocksRef.current && editorBlocksRef.current.length > 0
            ? editorBlocksRef.current
            : (n.blocks || []);

        const clonedBlocks = (rawBlocks || []).map((b) => ({
          ...b,
          id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 6)}_${i}`,
          tableData: b.tableData ? JSON.parse(JSON.stringify(b.tableData)) : undefined,
          meta: b.meta ? JSON.parse(JSON.stringify(b.meta)) : undefined,
        }));

        const dupNote = {
          id: `n_${Date.now()}_${Math.random().toString(36).substr(2, 6)}_${i}`,
          title: `Copy of ${n.title || "Untitled Note"}`,
          space: activeSpace,
          spaceId: activeSpace,
          banner: n.banner || null,
          emoji: n.emoji || "📝",
          isFavorite: Boolean(n.isFavorite),
          order: currentMaxOrder + i,
          blocks: clonedBlocks.length > 0 ? clonedBlocks : [{ id: `blk_${Date.now()}_${i}`, type: "text", content: "" }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        duplicatedNotes.push(dupNote);
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
      const spaceMap = { School: [], Personal: [], Misc: [] };
      allDbNotes.forEach((n) => {
        const noteSp = n.spaceId || n.space || "School";
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

      const resolvedSpaces = await getSavedSpaces();
      const merged = new Map();
      resolvedSpaces.forEach((s) => merged.set(s.name, s));
      Object.keys(spaceMap).forEach((noteSp) => {
        if (!merged.has(noteSp)) merged.set(noteSp, { name: noteSp, icon: "📂", blurb: "" });
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
      banner: null,
      emoji: "📝",
      isFavorite: false,
      order: spaceNotes.length,
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

  async function handleRecoverNote(noteId) {
    const target = trashNotes.find((n) => n.id === noteId);
    if (!target) return;

    const targetSpace = target.space || activeSpace;
    const spaceNotes = notesBySpace[targetSpace] || [];
    const recoveredNote = {
      ...target,
      order: typeof target.order === "number" ? target.order : spaceNotes.length,
    };

    setTrashNotes((prev) => prev.filter((n) => n.id !== noteId));
    setNotesBySpace((prev) => ({
      ...prev,
      [targetSpace]: [...(prev[targetSpace] || []), recoveredNote],
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
        const currentSpNotes = updated[sp] || [];
        const recoveredItem = {
          ...item,
          order: typeof item.order === "number" ? item.order : currentSpNotes.length,
        };
        updated[sp] = [...currentSpNotes, recoveredItem];
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

  const handleReorderNotes = useCallback(async (spaceId, reorderedNotes) => {
    if (!spaceId || !Array.isArray(reorderedNotes)) return;

    const indexedNotes = reorderedNotes.map((n, idx) => ({
      ...n,
      space: spaceId,
      spaceId: spaceId,
      order: idx,
    }));

    setNotesBySpace((prev) => ({
      ...prev,
      [spaceId]: indexedNotes,
    }));

    await saveNotesOrder(spaceId, indexedNotes);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-ink-950 text-ink-100 transition-colors duration-200">
      {/* Left Sidebar */}
      <div
        className={`no-print transition-all duration-300 ease-in-out shrink-0 h-full ${
          sidebarOpen && !isZenMode ? "w-64 opacity-100" : "w-0 opacity-0 overflow-hidden pointer-events-none"
        }`}
      >
        <Sidebar
          spaces={spaces}
          setSpaces={setSpaces}
          onEditSpace={handleEditSpace}
          onRenameSpace={handleRenameSpace}
          handleDeleteSpace={handleDeleteSpace}
          activeSpace={activeSpace}
          onSelectSpace={(spaceName) => {
            setActiveSpace(spaceName);
            const notesInSelected = notesBySpace[spaceName] || [];
            const firstInSpace = notesInSelected[0];
            if (firstInSpace) {
              setActiveNoteId(firstInSpace.id);
              setEditorBlocks(firstInSpace.blocks || []);
            } else {
              setActiveNoteId(null);
              setEditorBlocks([]);
            }
          }}
          activeNoteId={activeNoteObj?.id || null}
          notesBySpace={notesBySpace}
          onSelectNote={handleSelectNote}
          onCreateNote={handleCreateNote}
          onDeleteNote={handleDeleteNote}
          onSaveNote={handleSaveNote}
          onReorderNotes={handleReorderNotes}
          onToggleFavorite={handleToggleFavoriteNote}
          onDuplicateNote={handleDuplicateNote}
          onMoveNote={handleMoveNoteToSpace}
          onRenameNote={handleRenameNote}
          onDeleteMultipleNotes={handleDeleteMultipleNotes}
          onMoveMultipleNotes={handleMoveMultipleNotes}
          onToggleFavoriteMultipleNotes={handleToggleFavoriteMultipleNotes}
          onDuplicateMultipleNotes={handleDuplicateMultipleNotes}
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
          activeTab={activeTab}
          onNavigateTab={setActiveTab}
          onOpenInstantNote={() => setInstantNoteOpen(true)}
          onOpenTutor={() => openStudy("tutor", null)}
          onReformatNote={() => reformatNoteRef.current?.()}
          onNavigateCalendar={() => setActiveTab("calendar")}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />
      </div>

      {/* Main Container with Single Top HUD Header */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Zen Focus Mode Floating Exit Pill */}
        {isZenMode && (
          <div className="no-print fixed top-3 right-4 z-[100] animate-fade-in">
            <button
              type="button"
              onClick={toggleZenMode}
              title="Exit Zen Focus Mode (Esc or Ctrl+Shift+F)"
              className="flex items-center gap-2 rounded-full border border-duck-500/40 bg-ink-900/90 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-duck-300 shadow-xl transition-all hover:bg-ink-850 hover:border-duck-400 hover:text-duck-200 hover:scale-105 active:scale-95"
            >
              <Minimize2 className="h-3.5 w-3.5 text-duck-400" />
              <span>Exit Focus Mode</span>
              <kbd className="hidden sm:inline rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-mono text-ink-400 border border-ink-700">Esc</kbd>
            </button>
          </div>
        )}

        {/* Single Unified Sleek Top Navigation Header */}
        {!isZenMode && (
          <header className="no-print relative z-[60] flex h-13 shrink-0 items-center justify-between gap-3 border-b border-ink-800 bg-ink-900 px-4 sm:px-5 transition-colors duration-200 shadow-sm">
            {/* Left Breadcrumb & Sidebar Toggle & History Controls */}
            <div className="flex items-center gap-2 text-sm text-ink-400 min-w-0 max-w-[calc(50%-135px)] sm:max-w-[calc(50%-145px)]">
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

              {/* Note Navigation History Back / Forward Controls */}
              <div className="flex items-center gap-0.5 shrink-0 border-r border-ink-800 pr-1 mr-0.5">
                <button
                  type="button"
                  onClick={navigateBack}
                  disabled={!historyState.canGoBack}
                  title="Back (Alt+←)"
                  className="rounded-md p-1 text-ink-400 hover:bg-ink-800 hover:text-ink-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={navigateForward}
                  disabled={!historyState.canGoForward}
                  title="Forward (Alt+→)"
                  className="rounded-md p-1 text-ink-400 hover:bg-ink-800 hover:text-ink-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 font-medium truncate text-xs sm:text-sm">
                {activeTab === "3d" ? (
                  <>
                    <span className="shrink-0 text-duck-400">🌌</span>
                    <span className="truncate text-ink-100 font-semibold">3D Simulations Studio</span>
                  </>
                ) : activeTab === "calendar" ? (
                  <>
                    <span className="shrink-0 text-duck-400">📅</span>
                    <span className="truncate text-ink-100 font-semibold">Study Calendar & Timers</span>
                  </>
                ) : activeTab === "websaver" ? (
                  <>
                    <span className="shrink-0 text-duck-400">🔖</span>
                    <span className="truncate text-ink-100 font-semibold">Web Saver & Bookmarks</span>
                  </>
                ) : activeTab === "spacehub" ? (
                  <>
                    <span className="shrink-0 text-duck-400">⚙️</span>
                    <span className="truncate text-ink-100 font-semibold">Space Hub · {activeSpace}</span>
                  </>
                ) : (
                  <>
                    <span className="shrink-0 text-ink-500">📁</span>
                    <span className="text-ink-300 font-semibold shrink-0">{activeSpace}</span>
                    {activeTab === "notes" && activeNoteObj && (
                      <>
                        <span className="text-ink-600 shrink-0">/</span>
                        <span className="truncate font-semibold text-ink-100 flex items-center gap-1 min-w-0">
                          <span className="shrink-0">{activeNoteObj.emoji || "📝"}</span>
                          <span className="truncate">{activeNoteObj.title || "Untitled Note"}</span>
                          {activeNoteObj.isFavorite && (
                            <span className="text-amber-400 text-xs shrink-0" title="Starred">⭐</span>
                          )}
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Center Space-Specific Study Tabs (Notes, Quizzes, Mastery) - Mathematically Centered */}
            <nav className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-1 rounded-xl bg-ink-950 p-1 border border-ink-800 shadow-inner shrink-0 pointer-events-auto">
              <button
                type="button"
                onClick={() => setActiveTab("notes")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  activeTab === "notes"
                    ? "bg-ink-800 text-ink-100 shadow-sm"
                    : "text-ink-400 hover:bg-ink-900 hover:text-ink-200"
                }`}
              >
                <span>📝</span>
                <span className="hidden sm:inline">Notes</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("quizzes")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  activeTab === "quizzes"
                    ? "bg-ink-800 text-ink-100 shadow-sm"
                    : "text-ink-400 hover:bg-ink-900 hover:text-ink-200"
                }`}
              >
                <span>🎯</span>
                <span className="hidden sm:inline">Quizzes</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("mastery")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  activeTab === "mastery"
                    ? "bg-ink-800 text-ink-100 shadow-sm"
                    : "text-ink-400 hover:bg-ink-900 hover:text-ink-200"
                }`}
              >
                <span>📊</span>
                <span className="hidden sm:inline">Mastery</span>
                {gapCount > 0 && (
                  <span className="rounded-full border border-gap-500/40 bg-gap-500/10 px-1.5 text-[10px] font-semibold tabular-nums text-gap-500">
                    {gapCount}
                  </span>
                )}
              </button>
            </nav>

            {/* Right Action Bar: Save Status, Socratic Duck Triggers, 3-dots Note Menu & Zen Mode */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 ml-auto">
              {saveStatus && (
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 animate-fade-in mr-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{saveStatus}</span>
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  if (studyKind === "tutor") {
                    setStudyKind(null);
                  } else {
                    openStudy("tutor", null);
                  }
                }}
                title="AI Tutor: Ask doubts and get step-by-step guidance"
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg border p-1.5 xl:px-2.5 xl:py-1.5 text-xs font-semibold transition-all ${
                  studyKind === "tutor"
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 shadow-xs"
                    : "border-ink-700 bg-ink-850/60 text-ink-200 hover:border-emerald-500/50 hover:text-emerald-300 hover:bg-ink-800"
                }`}
              >
                <span>🧑‍🏫</span>
                <span className="hidden xl:inline">AI Tutor</span>
              </button>

              <button
                type="button"
                disabled={!activeNoteObj}
                onClick={() => {
                  if (activeTab !== "notes") setActiveTab("notes");
                  openStudy("explain", null);
                }}
                title={activeNoteObj ? "Explain this note with AI" : "Create or select a note to explain"}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-ink-700 bg-ink-850/50 p-1.5 xl:px-2.5 xl:py-1.5 text-xs font-medium text-ink-300 transition-all hover:border-duck-500/50 hover:text-duck-300 disabled:opacity-30 disabled:pointer-events-none"
              >
                <span>✨</span>
                <span className="hidden xl:inline">Explain</span>
              </button>

              <button
                type="button"
                disabled={!activeNoteObj}
                onClick={() => {
                  if (activeTab !== "notes") setActiveTab("notes");
                  openStudy("quiz", null);
                }}
                title={activeNoteObj ? "Quiz me on this note" : "Create or select a note to quiz"}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-duck-500/30 bg-duck-500/10 p-1.5 xl:px-2.5 xl:py-1.5 text-xs font-medium text-duck-300 transition-all hover:bg-duck-500/20 hover:text-duck-200 disabled:opacity-30 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-duck-400"
              >
                <span>🦆</span>
                <span className="hidden xl:inline">Quiz me</span>
              </button>

              {/* 3-Dots Note Menu (Only 3 dots, no text) */}
              {activeTab === "notes" && activeNoteObj && (
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
                  onChangeFontStyle={(fontStyle) => {
                    handleSaveNote({ ...activeNoteObj, fontStyle });
                  }}
                  onToggleFullWidth={(fullWidth) => {
                    handleSaveNote({ ...activeNoteObj, fullWidth });
                  }}
                  onToggleLockPage={(isLocked) => {
                    handleSaveNote({ ...activeNoteObj, isLocked });
                  }}
                  onSaveNote={handleSaveNote}
                  onToggleFavorite={handleToggleFavoriteNote}
                  onDuplicateNote={handleDuplicateNote}
                  onMoveNote={handleMoveNoteToSpace}
                  onRenameNote={handleRenameNote}
                  onReformatNote={() => reformatNoteRef.current?.()}
                  isReformatting={isReformattingNote}
                  onExportImport={() => setExportImportOpen(true)}
                  onDeleteNote={handleDeleteNote}
                  variant="icon"
                  align="right"
                />
              )}

              {/* Zen Focus Mode Toggle */}
              <button
                type="button"
                onClick={toggleZenMode}
                title="Zen Focus Mode (Ctrl+Shift+F)"
                className="inline-flex items-center justify-center rounded-lg border border-ink-700/80 bg-ink-850 p-1.5 text-ink-300 transition-all hover:border-duck-500/50 hover:bg-ink-800 hover:text-duck-300"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </header>
        )}

        {/* Tab Viewport Content */}
        <main
          className={`flex-1 transition-all duration-300 ease-in-out ${
            !isZenMode && studyKind ? "lg:mr-[480px] xl:mr-[520px]" : ""
          } ${
            activeTab === "3d" || activeTab === "websaver" || activeTab === "quizzes"
              ? "overflow-hidden flex flex-col h-full min-h-0"
              : "overflow-y-auto"
          }`}
        >
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

      {/* Explain — the teaching half. Stays mounted so it can animate out,
          which is also why `studyTarget` survives closing. */}
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

      {/* AI Tutor — Interactive doubt clearing with space curriculum documents & pedagogy */}
      <AITutorPanel
        open={!isZenMode && studyKind === "tutor"}
        concept={studyTarget?.concept ?? ""}
        noteContent={studyTarget?.content ?? ""}
        spaceId={studyTarget?.spaceId || activeSpace}
        spaceName={studyTarget?.space || activeSpace}
        onClose={closeStudy}
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

      {/* Multi-Format Note Export & Import Modal (PDF, DOCX, HTML, TXT, MD) */}
      <ExportImportModal
        open={exportImportOpen}
        onClose={() => setExportImportOpen(false)}
        activeNote={activeNoteObj}
        activeSpace={activeSpace}
        spaces={spaces}
        onImportSuccess={handleImportSuccess}
      />

      <CommandPalette
        notesBySpace={notesBySpace}
        activeSpace={activeSpace}
        setActiveSpace={setActiveSpace}
        setActiveTab={setActiveTab}
        setActiveNoteId={setActiveNoteId}
      />
    </div>
  );
}

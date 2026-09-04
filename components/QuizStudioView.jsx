"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Plus,
  Search,
  Check,
  CheckCircle2,
  Trash2,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Eraser,
  X,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  CheckSquare,
  Square,
  Code,
  Calculator,
} from "lucide-react";
import { db } from "@/lib/db";
import {
  saveQuiz,
  getNoteById,
  getTrashQuizzes,
  deleteQuizToTrash,
  recoverQuiz,
  permanentlyDeleteQuiz,
  clearQuizTrash,
  recordStudySession,
  getSyllabusStatement,
  getSpaceSettings,
} from "@/lib/storageService";
import { shouldUseClientAI, quizGrade } from "@/lib/aiService";
import { editorBlocksToText } from "@/lib/blocks";
import ScoreRing from "@/components/ScoreRing";
import ConfidenceHeatmap from "@/components/ConfidenceHeatmap";
import CreateQuizModal from "@/components/CreateQuizModal";
import MathText from "@/components/MathText";
import "katex/dist/katex.min.css";

const MATH_SYMBOLS = [
  { label: "a/b", snippet: "\\frac{a}{b}", desc: "Fraction" },
  { label: "√x", snippet: "\\sqrt{x}", desc: "Square Root" },
  { label: "x²", snippet: "^2", desc: "Power of 2" },
  { label: "xⁿ", snippet: "^{n}", desc: "Power of n" },
  { label: "π", snippet: "\\pi", desc: "Pi" },
  { label: "±", snippet: "\\pm", desc: "Plus-Minus" },
  { label: "θ", snippet: "\\theta", desc: "Theta" },
  { label: "≤", snippet: "\\le", desc: "Less or equal" },
  { label: "≥", snippet: "\\ge", desc: "Greater or equal" },
  { label: "≈", snippet: "\\approx", desc: "Approximately" },
  { label: "∞", snippet: "\\infty", desc: "Infinity" },
  { label: "×", snippet: "\\times", desc: "Multiplication" },
  { label: "÷", snippet: "\\div", desc: "Division" },
  { label: "°", snippet: "^\\circ", desc: "Degree" },
];

function DeleteQuizConfirmModal({ open, mode = "trash", quiz = null, count = 0, onClose, onConfirm }) {
  if (!open) return null;

  const isTrash = mode === "trash";
  const isPermanent = mode === "permanent";
  const isClearAll = mode === "clear_all";

  const title = isClearAll
    ? "Empty Quiz Trash?"
    : isPermanent
      ? "Permanently Delete Quiz?"
      : "Move Quiz to Trash?";

  const description = isClearAll
    ? `Are you sure you want to permanently delete all ${count} quizzes in the trash? This action cannot be undone.`
    : isPermanent
      ? `Are you sure you want to permanently delete "${quiz?.title || "this quiz"}"? All questions, draft answers, and score history will be erased forever.`
      : `Are you sure you want to move "${quiz?.title || "this quiz"}" to the trash? You can restore it from the Trash tab within 24 hours.`;

  const confirmButtonText = isClearAll
    ? "Empty Trash Forever"
    : isPermanent
      ? "Delete Forever"
      : "Move to Trash";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-quiz-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-ink-900 border border-ink-800 shadow-2xl p-6 space-y-4 animate-scale-in text-left"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gap-500/10 border border-gap-500/20 text-gap-400">
            <Trash2 size={20} />
          </div>
          <div className="space-y-1 flex-1">
            <h3 id="delete-quiz-dialog-title" className="text-base font-bold text-ink-100">
              {title}
            </h3>
            <p className="text-xs leading-relaxed text-ink-400">
              {description}
            </p>
          </div>
        </div>

        {quiz && !isClearAll && (
          <div className="p-3 rounded-xl bg-ink-850 border border-ink-800 text-xs space-y-1">
            <div className="font-semibold text-ink-200 line-clamp-1">
              {quiz.title}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-ink-400">
              <span className="capitalize">{quiz.difficulty || "medium"}</span>
              <span>•</span>
              <span>{quiz.questions?.length || 0} questions</span>
              {quiz.status === "completed" && quiz.result && (
                <>
                  <span>•</span>
                  <span className="text-solid-400 font-semibold">Score: {quiz.result.score}%</span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-ink-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-ink-700 text-xs font-semibold text-ink-300 hover:text-ink-100 hover:bg-ink-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-gap-500 hover:bg-gap-400 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 size={14} />
            <span>{confirmButtonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SourceNotesModal({ quiz, onClose, onSelectNote, setActiveTab }) {
  const [search, setSearch] = useState("");
  if (!quiz) return null;

  const noteIds = Array.isArray(quiz.noteIds) ? quiz.noteIds : quiz.noteId ? [quiz.noteId] : [];
  const noteTitles = Array.isArray(quiz.noteTitles) ? quiz.noteTitles : quiz.noteTitle ? [quiz.noteTitle] : [];

  const notes = noteIds.map((id, idx) => ({
    id,
    title: noteTitles[idx] || `Note ${idx + 1}`,
  }));

  const filtered = notes.filter((n) =>
    (n.title || "").toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-notes-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-ink-900 border border-ink-800 shadow-2xl p-6 space-y-4 animate-scale-in text-left flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-duck-500/10 border border-duck-500/20 text-duck-400">
              📚
            </div>
            <div>
              <h3 id="source-notes-dialog-title" className="text-base font-bold text-ink-100 flex items-center gap-2">
                <span>Source Notes</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-duck-500/10 border border-duck-500/20 text-duck-400 font-semibold">
                  {notes.length} notes
                </span>
              </h3>
              <p className="text-xs text-ink-400 line-clamp-1">
                Used to synthesize "{quiz.title}"
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close dialog"
            className="p-1.5 rounded-lg text-ink-400 hover:text-ink-100 hover:bg-ink-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search input for when there are many notes */}
        {notes.length > 4 && (
          <div className="relative shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-ink-850 border border-ink-750 text-xs text-ink-100 placeholder:text-ink-500 focus:border-duck-400 focus:outline-none"
            />
          </div>
        )}

        {/* Scrollable Notes List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 divide-y divide-ink-850/60 max-h-[360px]">
          {filtered.map((note, idx) => (
            <div
              key={note.id || idx}
              className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-ink-850/80 transition-colors group/item"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="text-sm shrink-0">📝</span>
                <span className="text-xs font-medium text-ink-200 group-hover/item:text-ink-100 truncate" title={note.title}>
                  {note.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectNote?.(note);
                  setActiveTab?.("notes");
                  onClose();
                }}
                className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-duck-400 hover:text-ink-950 hover:bg-duck-400 border border-duck-500/30 transition-all flex items-center gap-1 cursor-pointer"
                title={`Open "${note.title}" in notes tab`}
              >
                <span>Open</span>
                <ArrowRight size={11} />
              </button>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-8 text-xs text-ink-500">
              No matching notes found for "{search}"
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-ink-800 shrink-0 text-xs text-ink-500">
          <span>Click "Open" to edit any note</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl border border-ink-700 text-xs font-medium text-ink-300 hover:text-ink-100 hover:bg-ink-800 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QuizStudioView({
  activeSpace = "School",
  setActiveSpace,
  notesBySpace = {},
  onSelectNote,
  setActiveTab,
}) {
  const [activeSubTab, setActiveSubTab] = useState("all"); // all | pending | completed | trash
  const [difficultyFilter, setDifficultyFilter] = useState("all"); // all | easy | medium | hard | mastery
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Active quiz runner state
  const [takingQuiz, setTakingQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizIndex, setQuizIndex] = useState(0);
  const [isGrading, setIsGrading] = useState(false);
  const [gradingError, setGradingError] = useState(null);
  const [saveStatus, setSaveStatus] = useState("saved"); // "saving" | "saved"

  // Delete confirmation modal state
  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    mode: "trash",
    quiz: null,
    count: 0,
  });

  // Source notes modal state
  const [viewingSourceNotesQuiz, setViewingSourceNotesQuiz] = useState(null);

  const saveTimeoutRef = useRef(null);
  const answersRef = useRef(quizAnswers);
  answersRef.current = quizAnswers;
  const indexRef = useRef(quizIndex);
  indexRef.current = quizIndex;
  const takingQuizRef = useRef(takingQuiz);
  takingQuizRef.current = takingQuiz;

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Auto-save quiz draft progress to IndexedDB
  const persistQuizProgress = useCallback(async (updatedAnswers, targetIndex) => {
    const active = takingQuizRef.current;
    if (!active) return;
    setSaveStatus("saving");
    try {
      const answersToSave = updatedAnswers !== undefined ? updatedAnswers : answersRef.current;
      const targetIdx = typeof targetIndex === "number" ? targetIndex : indexRef.current;

      const answeredKeys = Object.keys(answersToSave || {}).filter(
        (k) => answersToSave[k] !== undefined && answersToSave[k] !== ""
      );
      const newStatus = answeredKeys.length > 0 ? "in_progress" : (active.status || "pending");

      await saveQuiz({
        ...active,
        draftAnswers: answersToSave,
        draftIndex: targetIdx,
        status: newStatus,
      });
      setSaveStatus("saved");
    } catch (err) {
      console.error("Failed to persist quiz progress:", err);
      setSaveStatus("saved");
    }
  }, []);

  const mathInputRef = useRef(null);

  const insertMathSymbol = (snippet) => {
    const input = mathInputRef.current;
    const current = String(quizAnswers[quizIndex] ?? "");
    if (!input) {
      handleAnswerTextChange(quizIndex, current + snippet);
      return;
    }
    const start = input.selectionStart ?? current.length;
    const end = input.selectionEnd ?? current.length;
    const next = current.substring(0, start) + snippet + current.substring(end);
    handleAnswerTextChange(quizIndex, next);
    setTimeout(() => {
      input.focus();
      const pos = start + snippet.length;
      input.setSelectionRange(pos, pos);
    }, 10);
  };

  const handlePickOption = (qIdx, oi) => {
    const nextAnswers = { ...quizAnswers, [qIdx]: oi };
    setQuizAnswers(nextAnswers);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistQuizProgress(nextAnswers, qIdx);
    }, 250);
  };

  const handleToggleMultiOption = (qIdx, oi) => {
    const current = Array.isArray(quizAnswers[qIdx]) ? quizAnswers[qIdx] : [];
    const next = current.includes(oi)
      ? current.filter((item) => item !== oi)
      : [...current, oi].sort((a, b) => a - b);
    const nextAnswers = { ...quizAnswers, [qIdx]: next };
    setQuizAnswers(nextAnswers);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistQuizProgress(nextAnswers, qIdx);
    }, 250);
  };

  const handleMoveStep = (qIdx, fromIdx, toIdx) => {
    const defaultSteps = takingQuiz?.questions?.[qIdx]?.options || takingQuiz?.questions?.[qIdx]?.steps || [];
    const current = Array.isArray(quizAnswers[qIdx]) && quizAnswers[qIdx].length > 0
      ? [...quizAnswers[qIdx]]
      : [...defaultSteps];
    if (toIdx < 0 || toIdx >= current.length) return;
    const [moved] = current.splice(fromIdx, 1);
    current.splice(toIdx, 0, moved);
    const nextAnswers = { ...quizAnswers, [qIdx]: current };
    setQuizAnswers(nextAnswers);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistQuizProgress(nextAnswers, qIdx);
    }, 250);
  };

  const handleResetSteps = (qIdx) => {
    const defaultSteps = takingQuiz?.questions?.[qIdx]?.options || takingQuiz?.questions?.[qIdx]?.steps || [];
    const nextAnswers = { ...quizAnswers, [qIdx]: [...defaultSteps] };
    setQuizAnswers(nextAnswers);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistQuizProgress(nextAnswers, qIdx);
    }, 250);
  };

  const handleAnswerTextChange = (qIdx, text) => {
    const nextAnswers = { ...quizAnswers, [qIdx]: text };
    setQuizAnswers(nextAnswers);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistQuizProgress(nextAnswers, qIdx);
    }, 350);
  };

  const handleSelectQuestionIndex = (newIndex) => {
    setQuizIndex(newIndex);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    persistQuizProgress(quizAnswers, newIndex);
  };

  const handleCloseRunner = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (takingQuiz) {
      await persistQuizProgress(quizAnswers, quizIndex);
    }
    setTakingQuiz(null);
  };

  const handleClearAnswer = (qIdx) => {
    const nextAnswers = { ...quizAnswers };
    delete nextAnswers[qIdx];
    setQuizAnswers(nextAnswers);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistQuizProgress(nextAnswers, qIdx);
    }, 250);
  };

  // Keyboard navigation & quick answer hotkeys for active quiz runner
  useEffect(() => {
    if (!takingQuiz) return;
    const handleKeyDown = (e) => {
      // Ignore if user is currently typing in an input or textarea
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "textarea" || tag === "input") return;

      const currentQ = takingQuiz.questions?.[quizIndex];
      const totalQ = takingQuiz.questions?.length || 0;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (quizIndex < totalQ - 1) {
          handleSelectQuestionIndex(quizIndex + 1);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (quizIndex > 0) {
          handleSelectQuestionIndex(quizIndex - 1);
        }
      } else if (currentQ?.type === "multiple_choice") {
        const key = e.key.toUpperCase();
        const optionsCount = currentQ.options?.length || 0;
        let selectedIndex = -1;

        if ((key === "A" || key === "1") && optionsCount > 0) selectedIndex = 0;
        else if ((key === "B" || key === "2") && optionsCount > 1) selectedIndex = 1;
        else if ((key === "C" || key === "3") && optionsCount > 2) selectedIndex = 2;
        else if ((key === "D" || key === "4") && optionsCount > 3) selectedIndex = 3;
        else if ((key === "E" || key === "5") && optionsCount > 4) selectedIndex = 4;

        if (selectedIndex !== -1) {
          e.preventDefault();
          handlePickOption(quizIndex, selectedIndex);
        }
      } else if (currentQ?.type === "multi_select") {
        const key = e.key.toUpperCase();
        const optionsCount = currentQ.options?.length || 0;
        let selectedIndex = -1;

        if ((key === "A" || key === "1") && optionsCount > 0) selectedIndex = 0;
        else if ((key === "B" || key === "2") && optionsCount > 1) selectedIndex = 1;
        else if ((key === "C" || key === "3") && optionsCount > 2) selectedIndex = 2;
        else if ((key === "D" || key === "4") && optionsCount > 3) selectedIndex = 3;
        else if ((key === "E" || key === "5") && optionsCount > 4) selectedIndex = 4;

        if (selectedIndex !== -1) {
          e.preventDefault();
          handleToggleMultiOption(quizIndex, selectedIndex);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [takingQuiz, quizIndex, quizAnswers]);

  const handleExecuteDelete = async () => {
    const { mode, quiz } = confirmDelete;
    if (mode === "clear_all") {
      await clearQuizTrash();
    } else if (mode === "permanent" && quiz?.id) {
      await permanentlyDeleteQuiz(quiz.id);
    } else if (mode === "trash" && quiz?.id) {
      await deleteQuizToTrash(quiz.id);
      if (takingQuiz?.id === quiz.id) setTakingQuiz(null);
      if (reviewingQuiz?.id === quiz.id) setReviewingQuiz(null);
    }
    setConfirmDelete({ open: false, mode: "trash", quiz: null, count: 0 });
  };

  // Active review state
  const [reviewingQuiz, setReviewingQuiz] = useState(null);

  // Live queries from IndexedDB
  const allQuizzes = useLiveQuery(
    async () => {
      if (!db.quizzes) return [];
      return await db.quizzes.toArray();
    },
    [],
    []
  );

  const trashedQuizzes = useLiveQuery(
    async () => {
      if (!db.quizTrash) return [];
      return await getTrashQuizzes();
    },
    [],
    []
  );

  // Filter quizzes by active space, difficulty, status, and search query
  const spaceQuizzes = useMemo(() => {
    if (takingQuiz) return [];
    return (allQuizzes || []).filter((q) => !activeSpace || q.spaceId === activeSpace);
  }, [takingQuiz, allQuizzes, activeSpace]);

  const filteredQuizzes = useMemo(() => {
    if (takingQuiz) return [];
    return spaceQuizzes.filter((quiz) => {
      // Sub-tab filter
      if (activeSubTab === "pending" && quiz.status === "completed") return false;
      if (activeSubTab === "completed" && quiz.status !== "completed") return false;

      // Difficulty filter
      if (difficultyFilter !== "all" && quiz.difficulty !== difficultyFilter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = quiz.title?.toLowerCase().includes(q);
        const matchNote = quiz.noteTitle?.toLowerCase().includes(q);
        const matchNotes = Array.isArray(quiz.noteTitles) && quiz.noteTitles.some((t) => t?.toLowerCase().includes(q));
        if (!matchTitle && !matchNote && !matchNotes) return false;
      }

      return true;
    });
  }, [takingQuiz, spaceQuizzes, activeSubTab, difficultyFilter, searchQuery]);

  const spaceTrash = useMemo(() => {
    if (takingQuiz) return [];
    return (trashedQuizzes || []).filter((q) => !activeSpace || q.spaceId === activeSpace);
  }, [takingQuiz, trashedQuizzes, activeSpace]);

  const counts = useMemo(() => {
    if (takingQuiz) return { total: 0, pending: 0, completed: 0, trash: 0 };
    const total = spaceQuizzes.length;
    const pending = spaceQuizzes.filter((q) => q.status !== "completed").length;
    const completed = spaceQuizzes.filter((q) => q.status === "completed").length;
    const trash = spaceTrash.length;
    return { total, pending, completed, trash };
  }, [takingQuiz, spaceQuizzes, spaceTrash]);

  // Start taking a quiz (fresh reset when retaking, or resumes draft)
  const handleStartQuiz = async (quiz, isRetake = false) => {
    setTakingQuiz(quiz);
    if (isRetake) {
      setQuizAnswers({});
      setQuizIndex(0);
      try {
        await saveQuiz({
          ...quiz,
          draftAnswers: null,
          draftIndex: 0,
          status: "pending",
        });
      } catch (err) {
        console.error("Failed to reset quiz draft:", err);
      }
    } else {
      const initialAnswers = quiz.draftAnswers || quiz.userAnswers || {};
      setQuizAnswers(initialAnswers);
      const initialIndex =
        typeof quiz.draftIndex === "number" && quiz.draftIndex >= 0
          ? Math.min(quiz.draftIndex, (quiz.questions?.length || 1) - 1)
          : 0;
      setQuizIndex(initialIndex);
    }
    setGradingError(null);
    setReviewingQuiz(null);
  };

  // View completed quiz results
  const handleViewReview = (quiz) => {
    setReviewingQuiz(quiz);
    setTakingQuiz(null);
  };

  // Submit quiz for grading
  const handleSubmitQuiz = async () => {
    if (!takingQuiz || !takingQuiz.questions?.length) return;

    setIsGrading(true);
    setGradingError(null);

    try {
      // Resolve full source note content for accurate rubric context during grading
      let noteContent = takingQuiz.focusText || "";
      const noteIdsToFetch =
        Array.isArray(takingQuiz.noteIds) && takingQuiz.noteIds.length > 0
          ? takingQuiz.noteIds
          : takingQuiz.noteId
            ? [takingQuiz.noteId]
            : [];

      if (noteIdsToFetch.length > 0) {
        try {
          const contents = [];
          for (const nid of noteIdsToFetch) {
            const note = await getNoteById(nid);
            if (note?.blocks && Array.isArray(note.blocks) && note.blocks.length > 0) {
              const fullText = editorBlocksToText(note.blocks);
              if (fullText && fullText.trim()) {
                contents.push(
                  noteIdsToFetch.length > 1
                    ? `=== Source Note: "${note.title || "Untitled Note"}" ===\n${fullText.trim()}`
                    : fullText.trim()
                );
              }
            }
          }
          if (contents.length > 0) {
            noteContent = contents.join("\n\n----------------------------------------\n\n");
          }
        } catch (e) {
          console.warn("Could not fetch full note content for grading:", e);
        }
      }
      if (!noteContent) noteContent = takingQuiz.noteTitle || "Study Quiz";

      const { statement: syllabus, enabled: syllabusEnabled } = await getSyllabusStatement(activeSpace);
      const spaceConfig = await getSpaceSettings(activeSpace);
      const payload = {
        concept: takingQuiz.title || takingQuiz.noteTitle || "Study Quiz",
        noteContent,
        questions: takingQuiz.questions,
        responses: takingQuiz.questions.map((_, i) => ({ answer: quizAnswers[i] ?? "" })),
        syllabus: syllabusEnabled ? syllabus : "",
        spaceId: activeSpace,
        aiPersona: spaceConfig?.aiPersona || "examiner",
        strictness: spaceConfig?.strictness || "standard",
        academicLevel: spaceConfig?.academicLevel || "general",
      };

      const isClient = await shouldUseClientAI();
      let data;
      if (isClient) {
        data = await quizGrade(payload);
      } else {
        const res = await fetch("/api/quiz/grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to grade quiz (${res.status})`);
      }

      const result = {
        score: data.result.score,
        summary: data.result.summary,
        heatmap: data.result.heatmap,
        gradedAnswers: data.result.gradedAnswers,
        correctCount: data.result.correctCount,
        totalCount: data.result.totalCount,
        completedAt: new Date().toISOString(),
      };

      // 1. Update quiz in db.quizzes
      const updatedQuiz = await saveQuiz({
        ...takingQuiz,
        status: "completed",
        draftAnswers: null,
        draftIndex: 0,
        result,
        userAnswers: quizAnswers,
      });

      // 2. Correlate with Mastery Dashboard
      await recordStudySession({
        noteId: takingQuiz.noteId || "general",
        noteTitle: takingQuiz.noteTitle || takingQuiz.title || "Custom Quiz",
        space: takingQuiz.spaceId || activeSpace,
        concept: takingQuiz.title || takingQuiz.noteTitle || "Custom Quiz",
        mode: "quiz",
        score: result.score,
        summary: result.summary,
        heatmap: result.heatmap,
      });

      setTakingQuiz(null);
      setReviewingQuiz(updatedQuiz);
    } catch (err) {
      console.error("Grading error:", err);
      setGradingError(err.message || "Failed to grade quiz. Please try again.");
    } finally {
      setIsGrading(false);
    }
  };

  const difficultyColors = {
    easy: "border-solid-500/30 bg-solid-500/10 text-solid-400",
    medium: "border-duck-500/30 bg-duck-500/10 text-duck-300",
    hard: "border-gap-500/30 bg-gap-500/10 text-gap-400",
    mastery: "border-purple-500/30 bg-purple-500/10 text-purple-300",
  };

  // ─────────────────────────────────────────────────────────────────────
  // RENDER: Quiz Runner (Taking active quiz)
  // ─────────────────────────────────────────────────────────────────────
  if (takingQuiz) {
    const total = takingQuiz.questions.length;
    const currentQ = takingQuiz.questions[quizIndex];
    const isLast = quizIndex === total - 1;
    const isAnswerFilled = (val) => {
      if (val === undefined || val === null || val === "") return false;
      if (Array.isArray(val)) return val.length > 0;
      return true;
    };
    const answeredCount = takingQuiz.questions.filter((_, i) => isAnswerFilled(quizAnswers[i])).length;
    const currentIsAnswered = isAnswerFilled(quizAnswers[quizIndex]);
    const progressPercent = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

    return (
      <div className="flex-1 flex flex-col h-full bg-ink-950 overflow-hidden">
        {/* Runner Top Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-ink-800 bg-ink-900/95 backdrop-blur-xs shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCloseRunner}
              title="Save & Exit Quiz"
              className="p-2 rounded-xl border border-ink-700 text-ink-400 hover:text-ink-100 hover:bg-ink-800 transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h2 className="text-sm font-bold text-ink-100 flex items-center gap-2">
                <span className="line-clamp-1">{takingQuiz.title}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-semibold shrink-0 ${
                    difficultyColors[takingQuiz.difficulty] || difficultyColors.medium
                  }`}
                >
                  {takingQuiz.difficulty}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-ink-400 bg-ink-850 px-2.5 py-1 rounded-full border border-ink-800">
              {saveStatus === "saving" ? (
                <>
                  <div className="w-2 h-2 border-2 border-duck-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-ink-400">Saving...</span>
                </>
              ) : (
                <>
                  <Check size={11} className="text-duck-400" />
                  <span className="text-ink-300">Progress saved</span>
                </>
              )}
            </div>

            <div className="text-xs font-semibold px-2.5 py-1 rounded-full bg-duck-500/10 border border-duck-500/30 text-duck-300">
              {answeredCount} / {total} answered
            </div>

            <button
              type="button"
              onClick={handleCloseRunner}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-ink-700 text-xs font-medium text-ink-400 hover:text-ink-100 hover:bg-ink-800 transition-colors cursor-pointer"
            >
              Exit Quiz
            </button>
          </div>
        </div>

        {/* Runner Body: Split layout with expansive Q&A on Left/Center and all controls on Right */}
        <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
          {/* Main Q&A Stage */}
          <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col items-center">
            <div className="w-full max-w-4xl space-y-6">
              {gradingError && (
                <div className="p-4 text-xs text-gap-400 bg-gap-500/10 border border-gap-500/20 rounded-xl flex items-start gap-2 animate-fade-in">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{gradingError}</span>
                </div>
              )}

              {/* Question Meta Row */}
              <div className="flex items-center justify-between gap-4 pb-1">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold uppercase tracking-wider text-duck-400">
                    Question {quizIndex + 1} of {total}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full border border-ink-700 bg-ink-850 text-xs font-medium text-ink-300">
                    🏷️ <MathText text={currentQ.subtopic || "General"} />
                  </span>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-ink-850 text-ink-400 border border-ink-750 uppercase tracking-wider">
                  {currentQ.type.replace("_", " ")}
                </span>
              </div>

              {/* Spacious Question & Answers Card */}
              <div className="p-6 md:p-8 rounded-2xl bg-ink-900 border border-ink-800 shadow-xl space-y-6">
                {/* Question Prompt */}
                <div className="text-base md:text-lg font-semibold text-ink-100 leading-relaxed">
                  <MathText text={currentQ.prompt} />
                </div>

                {/* Multiple Choice Options */}
                {currentQ.type === "multiple_choice" && (
                  <div className="space-y-3 pt-2">
                    {(currentQ.options || []).map((option, oi) => {
                      const picked = quizAnswers[quizIndex] === oi;
                      const letter = String.fromCharCode(65 + oi);
                      return (
                        <button
                          key={oi}
                          type="button"
                          onClick={() => handlePickOption(quizIndex, oi)}
                          className={`group flex w-full items-start gap-4 p-4 md:p-4.5 rounded-xl border text-left text-sm leading-relaxed transition-all cursor-pointer ${
                            picked
                              ? "border-duck-400/90 bg-duck-400/10 text-ink-100 shadow-[0_0_20px_rgba(240,192,74,0.12)]"
                              : "border-ink-800 bg-ink-850/70 text-ink-300 hover:border-ink-700 hover:bg-ink-800/80 hover:text-ink-100"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold mt-0.5 transition-colors ${
                              picked
                                ? "border-duck-400 bg-duck-400 text-ink-950 shadow-xs"
                                : "border-ink-700 text-ink-400 bg-ink-800 group-hover:border-ink-600 group-hover:text-ink-200"
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="flex-1 font-medium pt-0.5">
                            <MathText text={option} />
                          </span>
                          <span className="text-[10px] font-mono text-ink-600 uppercase pt-1 hidden sm:inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                            Key {letter}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Multi-Select Options */}
                {currentQ.type === "multi_select" && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-xs text-ink-400 pb-1">
                      <span className="flex items-center gap-1.5 font-medium text-duck-300">
                        <CheckSquare size={14} />
                        <span>Select all options that apply:</span>
                      </span>
                      <span className="text-[11px] font-semibold bg-ink-850 px-2.5 py-0.5 rounded-full border border-ink-800 text-ink-300">
                        {(Array.isArray(quizAnswers[quizIndex]) ? quizAnswers[quizIndex].length : 0)} selected
                      </span>
                    </div>
                    {(currentQ.options || []).map((option, oi) => {
                      const selectedList = Array.isArray(quizAnswers[quizIndex]) ? quizAnswers[quizIndex] : [];
                      const isSelected = selectedList.includes(oi);
                      const letter = String.fromCharCode(65 + oi);
                      return (
                        <button
                          key={oi}
                          type="button"
                          onClick={() => handleToggleMultiOption(quizIndex, oi)}
                          className={`group flex w-full items-start gap-4 p-4 md:p-4.5 rounded-xl border text-left text-sm leading-relaxed transition-all cursor-pointer ${
                            isSelected
                              ? "border-duck-400/90 bg-duck-400/10 text-ink-100 shadow-[0_0_20px_rgba(240,192,74,0.12)]"
                              : "border-ink-800 bg-ink-850/70 text-ink-300 hover:border-ink-700 hover:bg-ink-800/80 hover:text-ink-100"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold mt-0.5 transition-colors ${
                              isSelected
                                ? "border-duck-400 bg-duck-400 text-ink-950 shadow-xs"
                                : "border-ink-700 text-ink-400 bg-ink-800 group-hover:border-ink-600 group-hover:text-ink-200"
                            }`}
                          >
                            {isSelected ? "✓" : letter}
                          </span>
                          <span className="flex-1 font-medium pt-0.5">
                            <MathText text={option} />
                          </span>
                          <span className="text-[10px] font-mono text-ink-600 uppercase pt-1 hidden sm:inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                            Key {letter}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Value Input (Math / Number / Formula with Virtual Symbol Keyboard & Live KaTeX Preview) */}
                {currentQ.type === "value_input" && (
                  <div className="space-y-4 pt-2">
                    {/* Virtual Symbol Keyboard Tray */}
                    <div className="p-3.5 rounded-xl bg-ink-850/90 border border-ink-750 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-duck-400 flex items-center gap-1.5">
                          <Calculator size={13} />
                          <span>Virtual Math Symbols & Functions</span>
                        </span>
                        <span className="text-[10px] text-ink-500">Tap to insert at cursor</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {MATH_SYMBOLS.map((sym, si) => (
                          <button
                            key={si}
                            type="button"
                            onClick={() => insertMathSymbol(sym.snippet)}
                            title={sym.desc}
                            className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-ink-900 border border-ink-700 hover:border-duck-400/60 hover:bg-duck-500/15 text-duck-300 hover:text-duck-200 transition-colors cursor-pointer shadow-xs active:scale-95"
                          >
                            {sym.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Primary Input Field */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-ink-300">
                        Enter Exact Numerical Value or Algebraic Formula:
                      </label>
                      <input
                        ref={mathInputRef}
                        type="text"
                        value={quizAnswers[quizIndex] ?? ""}
                        onChange={(e) => handleAnswerTextChange(quizIndex, e.target.value)}
                        placeholder="e.g. 12.5, 3/4, 2x + 5, or \frac{-b \pm \sqrt{D}}{2a}"
                        className="w-full px-4 py-3.5 rounded-xl bg-ink-850/90 border border-ink-700 text-sm font-mono text-ink-100 placeholder:text-ink-600 focus:border-duck-400 focus:outline-none focus:ring-1 focus:ring-duck-400/50"
                      />
                    </div>

                    {/* Live KaTeX Preview Card */}
                    <div className="p-4 rounded-xl bg-ink-900/90 border border-ink-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-ink-400 font-medium">
                        <span className="flex items-center gap-1.5 text-duck-400 font-semibold">
                          <span>✨</span>
                          <span>Live Formatted Math Preview</span>
                        </span>
                        {currentQ.tolerance ? (
                          <span className="text-[10px] text-ink-500 bg-ink-850 px-2 py-0.5 rounded border border-ink-800">
                            Tolerance: ±{currentQ.tolerance}
                          </span>
                        ) : null}
                      </div>
                      <div className="min-h-[3rem] flex items-center justify-center p-3 rounded-lg bg-ink-950/60 border border-ink-800/80 text-center text-sm md:text-base text-ink-100">
                        {(quizAnswers[quizIndex] || "").trim() ? (
                          <MathText text={`$${quizAnswers[quizIndex]}$`} />
                        ) : (
                          <span className="text-xs text-ink-600 italic">Formula preview will render here in real-time as you type...</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step Ordering (Proof / Derivation Reordering) */}
                {currentQ.type === "step_ordering" && (() => {
                  const defaultSteps = currentQ.options || currentQ.steps || [];
                  const currentSteps = Array.isArray(quizAnswers[quizIndex]) && quizAnswers[quizIndex].length > 0
                    ? quizAnswers[quizIndex]
                    : defaultSteps;

                  return (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between text-xs text-ink-400 pb-1">
                        <span className="flex items-center gap-1.5 text-duck-300 font-medium">
                          <span>🧩</span>
                          <span>Use the ▲ / ▼ arrows to arrange the steps into the correct logical derivation order:</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleResetSteps(quizIndex)}
                          className="text-[11px] text-ink-400 hover:text-duck-300 hover:underline flex items-center gap-1"
                        >
                          <RotateCcw size={11} />
                          <span>Reset Order</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {currentSteps.map((stepText, si) => (
                          <div
                            key={si}
                            className="flex items-center gap-3 p-3.5 rounded-xl border border-ink-800 bg-ink-850/80 hover:border-ink-700 transition-colors"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-duck-500/10 border border-duck-500/30 text-xs font-bold text-duck-300">
                              {si + 1}
                            </span>
                            <div className="flex-1 text-sm font-medium text-ink-100">
                              <MathText text={stepText} />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleMoveStep(quizIndex, si, si - 1)}
                                disabled={si === 0}
                                className="p-1.5 rounded-lg border border-ink-700 text-ink-400 hover:text-duck-300 hover:bg-ink-800 hover:border-duck-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Move Up"
                              >
                                <ChevronUp size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveStep(quizIndex, si, si + 1)}
                                disabled={si === currentSteps.length - 1}
                                className="p-1.5 rounded-lg border border-ink-700 text-ink-400 hover:text-duck-300 hover:bg-ink-800 hover:border-duck-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Move Down"
                              >
                                <ChevronDown size={15} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Built-in Code Editor */}
                {currentQ.type === "code_input" && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-duck-300 bg-duck-500/10 border border-duck-500/30 px-2.5 py-1 rounded-lg">
                          <Code size={13} />
                          <span>{currentQ.language || "python"}</span>
                        </span>
                        <span className="text-[11px] text-ink-500 hidden sm:inline">Press Tab for 2-space indentation</span>
                      </div>
                      {currentQ.starterCode && (
                        <button
                          type="button"
                          onClick={() => handleAnswerTextChange(quizIndex, currentQ.starterCode)}
                          className="text-[11px] text-ink-400 hover:text-duck-300 hover:underline flex items-center gap-1"
                        >
                          <RotateCcw size={11} />
                          <span>Reset Starter Code</span>
                        </button>
                      )}
                    </div>

                    <div className="relative rounded-xl border border-ink-750 bg-ink-950 overflow-hidden shadow-inner focus-within:border-duck-400 focus-within:ring-1 focus-within:ring-duck-400/50">
                      <textarea
                        rows={12}
                        value={
                          quizAnswers[quizIndex] !== undefined
                            ? quizAnswers[quizIndex]
                            : currentQ.starterCode || ""
                        }
                        onChange={(e) => handleAnswerTextChange(quizIndex, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Tab") {
                            e.preventDefault();
                            const start = e.target.selectionStart;
                            const end = e.target.selectionEnd;
                            const val = e.target.value;
                            const next = val.substring(0, start) + "  " + val.substring(end);
                            handleAnswerTextChange(quizIndex, next);
                            setTimeout(() => {
                              e.target.selectionStart = e.target.selectionEnd = start + 2;
                            }, 0);
                          }
                        }}
                        placeholder="# Write your algorithm or code solution here..."
                        spellCheck={false}
                        className="w-full p-4 bg-transparent text-sm font-mono text-ink-100 placeholder:text-ink-600 focus:outline-none resize-y leading-relaxed selection:bg-duck-500/30"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-ink-400 px-1">
                      <span>💡 Graded on logic, algorithm accuracy, and edge-case handling.</span>
                      <span className="font-mono text-[11px] bg-ink-850 px-2 py-0.5 rounded border border-ink-800">
                        Lines: {((quizAnswers[quizIndex] !== undefined ? quizAnswers[quizIndex] : currentQ.starterCode || "").split("\n")).length}
                      </span>
                    </div>
                  </div>
                )}

                {/* Short Answer Input */}
                {currentQ.type === "short_answer" && (
                  <div className="space-y-3 pt-2">
                    <textarea
                      rows={6}
                      value={quizAnswers[quizIndex] ?? ""}
                      onChange={(e) => handleAnswerTextChange(quizIndex, e.target.value)}
                      placeholder="Explain the mechanism or principle in your own words..."
                      className="w-full p-5 rounded-xl bg-ink-850/80 border border-ink-700 text-sm text-ink-100 placeholder:text-ink-600 focus:border-duck-400 focus:outline-none focus:ring-1 focus:ring-duck-400/50 resize-y leading-relaxed"
                    />
                    <p className="text-xs text-ink-400 flex items-center gap-1.5">
                      <span>💡</span>
                      <span>Graded on clarity, technical accuracy, and explanation of the underlying mechanism.</span>
                    </p>
                  </div>
                )}

                {/* Long Answer / Essay Input */}
                {currentQ.type === "long_answer" && (
                  <div className="space-y-3 pt-2">
                    <textarea
                      rows={12}
                      value={quizAnswers[quizIndex] ?? ""}
                      onChange={(e) => handleAnswerTextChange(quizIndex, e.target.value)}
                      placeholder="Write a structured, detailed answer discussing key mechanisms, derivations, and implications..."
                      className="w-full p-5 rounded-xl bg-ink-850/80 border border-ink-700 text-sm font-mono text-ink-100 placeholder:text-ink-600 focus:border-duck-400 focus:outline-none focus:ring-1 focus:ring-duck-400/50 resize-y leading-relaxed"
                    />
                    <div className="flex items-center justify-between text-xs text-ink-400 px-1">
                      <span>💡 Evaluated on depth, structural reasoning, and rubric coverage.</span>
                      <span className="font-mono text-[11px] bg-ink-850 px-2 py-0.5 rounded border border-ink-800">
                        Words: {(quizAnswers[quizIndex] || "").trim().split(/\s+/).filter(Boolean).length}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Control & Navigation Station */}
          <div className="w-full lg:w-80 xl:w-88 shrink-0 border-t lg:border-t-0 lg:border-l border-ink-800 bg-ink-900/60 backdrop-blur-xs p-6 flex flex-col justify-between overflow-y-auto space-y-6">
            {/* Top: Primary Navigation Actions */}
            <div className="space-y-4">
              {/* Next / Submit Question Primary Button */}
              {isLast ? (
                <button
                  type="button"
                  onClick={handleSubmitQuiz}
                  disabled={isGrading || answeredCount === 0}
                  className="w-full py-3 px-4 rounded-xl bg-duck-400 text-ink-950 text-xs font-bold shadow-md hover:bg-duck-300 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isGrading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-ink-950 border-t-transparent rounded-full animate-spin" />
                      <span>Grading Exam...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Finish & Submit Exam</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSelectQuestionIndex(quizIndex + 1)}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    currentIsAnswered
                      ? "bg-duck-400 text-ink-950 hover:bg-duck-300 shadow-md"
                      : "bg-ink-800 text-ink-200 hover:bg-ink-750 hover:text-ink-100 border border-ink-700"
                  }`}
                >
                  <span>{currentIsAnswered ? "Next Question" : "Skip Question"}</span>
                  <ArrowRight size={15} />
                </button>
              )}

              {/* Secondary Navigation Row: Previous & Clear Answer */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={quizIndex === 0 || isGrading}
                  onClick={() => handleSelectQuestionIndex(quizIndex - 1)}
                  className="flex-1 py-2 px-3 rounded-xl border border-ink-700 text-xs font-semibold text-ink-300 hover:text-ink-100 hover:bg-ink-850 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>Previous</span>
                </button>

                {currentIsAnswered && (
                  <button
                    type="button"
                    onClick={() => handleClearAnswer(quizIndex)}
                    title="Clear current answer"
                    className="py-2 px-3 rounded-xl border border-ink-750 bg-ink-850/60 hover:bg-gap-500/10 hover:border-gap-500/30 text-ink-400 hover:text-gap-400 text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Eraser size={13} />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {/* Question Navigator Matrix */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-200">Questions</span>
                  <span className="text-[11px] text-duck-400 font-semibold font-mono">
                    {answeredCount} / {total} answered
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {takingQuiz.questions.map((q, i) => {
                    const isCurrent = i === quizIndex;
                    const isAnswered = quizAnswers[i] !== undefined && quizAnswers[i] !== "";
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectQuestionIndex(i)}
                        title={`Jump to Question ${i + 1} (${q.type.replace("_", " ")})`}
                        className={`h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer relative ${
                          isCurrent
                            ? "bg-duck-400 text-ink-950 font-black ring-2 ring-duck-300 ring-offset-2 ring-offset-ink-900 shadow-md scale-105 z-1"
                            : isAnswered
                            ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30"
                            : "bg-ink-850 border border-ink-800 text-ink-400 hover:bg-ink-800 hover:text-ink-200 hover:border-ink-700"
                        }`}
                      >
                        <span>{i + 1}</span>
                        {isAnswered && !isCurrent && (
                          <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Matrix Legend */}
                <div className="flex items-center justify-between text-[11px] text-ink-400 pt-1.5 px-1 border-t border-ink-800/60">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-duck-400 inline-block shrink-0 shadow-[0_0_6px_rgba(240,192,74,0.6)]" />
                    <span className="text-ink-300 font-medium">Current</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                    <span className="text-ink-300 font-medium">Answered</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-ink-700 border border-ink-600 inline-block shrink-0" />
                    <span className="text-ink-500">Remaining</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom: Progress Summary & Submit Action */}
            <div className="space-y-4 pt-4 border-t border-ink-800/80">
              {/* Progress Bar & Stats */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-ink-400 font-medium">
                  <span>Overall Progress</span>
                  <span className="font-mono text-ink-300">{progressPercent}%</span>
                </div>
                <div className="w-full bg-ink-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-duck-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Status and Submission Actions */}
              <div className="space-y-2">
                {!isLast && (
                  <button
                    type="button"
                    onClick={handleSubmitQuiz}
                    disabled={isGrading || answeredCount === 0}
                    className="w-full py-2.5 px-4 rounded-xl bg-duck-400/20 border border-duck-400/40 text-duck-300 hover:bg-duck-400 hover:text-ink-950 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isGrading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-duck-300 border-t-transparent rounded-full animate-spin" />
                        <span>Grading...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        <span>Submit Exam ({answeredCount}/{total})</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCloseRunner}
                  className="w-full py-2 px-3 rounded-xl border border-ink-750 text-ink-400 hover:text-ink-200 hover:bg-ink-850 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  <span>Save Progress & Exit</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // RENDER: Graded Review Screen
  // ─────────────────────────────────────────────────────────────────────
  if (reviewingQuiz && reviewingQuiz.result) {
    const res = reviewingQuiz.result;
    return (
      <div className="flex-1 flex flex-col h-full bg-ink-950 overflow-hidden">
        {/* Review Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-800 bg-ink-900/90 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setReviewingQuiz(null)}
              className="p-1.5 rounded-lg border border-ink-700 text-ink-400 hover:text-ink-100 hover:bg-ink-800 transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h2 className="text-sm font-bold text-ink-100 flex items-center gap-2">
                <span>{reviewingQuiz.title} — Review & Diagnostic</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-semibold ${
                    difficultyColors[reviewingQuiz.difficulty] || difficultyColors.medium
                  }`}
                >
                  {reviewingQuiz.difficulty}
                </span>
              </h2>
              <p className="text-xs text-ink-400">
                Completed: {res.completedAt ? new Date(res.completedAt).toLocaleDateString() : "Just now"} · Synced with Mastery
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStartQuiz(reviewingQuiz, true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ink-800 text-ink-200 hover:text-ink-100 hover:bg-ink-700 text-xs font-semibold transition-colors border border-ink-700"
            >
              <RotateCcw size={14} />
              <span>Retake Quiz</span>
            </button>
            <button
              type="button"
              onClick={() => setReviewingQuiz(null)}
              className="px-4 py-2 rounded-xl bg-duck-400 text-ink-950 text-xs font-bold hover:bg-duck-300 transition-colors"
            >
              Done
            </button>
          </div>
        </div>

        {/* Review Content */}
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto space-y-6">
          {/* Headline Summary Card */}
          <div className="p-6 rounded-2xl bg-ink-900 border border-ink-800 shadow-md flex flex-col sm:flex-row items-center gap-6">
            <ScoreRing score={res.score} />
            <div className="flex-1 space-y-2 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="text-lg font-bold text-ink-100">
                  {res.correctCount ?? 0} of {res.totalCount ?? reviewingQuiz.questions.length} Correct
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-duck-500/10 text-duck-400 border border-duck-500/20">
                  {res.score}% Score
                </span>
              </div>
              <div className="text-xs text-ink-300 leading-relaxed">
                <MathText text={res.summary} />
              </div>
            </div>
          </div>

          {/* Subtopic Heatmap */}
          {res.heatmap && res.heatmap.length > 0 && (
            <div className="p-5 rounded-2xl bg-ink-900 border border-ink-800 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-ink-300 uppercase tracking-wider">
                  Sub-Topic Mastery Diagnostic
                </p>
                <span className="text-[10px] text-ink-500">Updated in Mastery Tab</span>
              </div>
              <ConfidenceHeatmap
                diagnostic={{ score: res.score, summary: null, heatmap: res.heatmap }}
              />
            </div>
          )}

          {/* Question Breakdown List */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider">
              Question-by-Question Diagnostic
            </h3>
            <div className="space-y-3">
              {(res.gradedAnswers || []).map((ans, idx) => (
                <div
                  key={idx}
                  className={`p-5 rounded-2xl border transition-all ${
                    ans.correct
                      ? "bg-emerald-950/25 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.06)]"
                      : "bg-rose-950/25 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.06)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold mt-0.5 ${
                          ans.correct
                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                            : "bg-rose-500/20 border-rose-500/50 text-rose-400"
                        }`}
                      >
                        {ans.correct ? "✓" : "✗"}
                      </span>
                      <p className="text-sm font-semibold text-ink-100 leading-relaxed">
                        <span className="text-ink-400 font-normal mr-1">{idx + 1}.</span>
                        <MathText text={ans.prompt} />
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border shrink-0 uppercase tracking-wider flex items-center gap-1 ${
                        ans.correct
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      }`}
                    >
                      {ans.correct ? "✓ Correct" : "✗ Incorrect"}
                    </span>
                  </div>

                  <div className="mt-3.5 pl-9 space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="text-ink-400 shrink-0 font-medium pt-0.5">Your Answer:</span>
                      <div className="flex-1 font-medium">
                        {ans.answered ? (
                          ans.type === "code_input" ? (
                            <pre
                              className={`p-2.5 rounded-xl border font-mono text-[11px] overflow-x-auto whitespace-pre ${
                                ans.correct
                                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                                  : "bg-rose-950/40 border-rose-500/40 text-rose-200"
                              }`}
                            >
                              <code>{ans.yourAnswer}</code>
                            </pre>
                          ) : (
                            <span
                              className={`inline-block px-2.5 py-1 rounded-lg border text-xs ${
                                ans.correct
                                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-200"
                                  : "bg-rose-500/15 border-rose-500/30 text-rose-200"
                              }`}
                            >
                              {typeof ans.yourAnswer === "string" ? (
                                <MathText text={ans.yourAnswer} />
                              ) : (
                                ans.yourAnswer
                              )}
                            </span>
                          )
                        ) : (
                          <span className="inline-block px-2.5 py-1 rounded-lg border border-ink-800 bg-ink-850 text-ink-500 italic">
                            Left blank
                          </span>
                        )}
                      </div>
                    </div>

                    {!ans.correct && ans.type === "multiple_choice" && ans.options && (
                      <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex items-start gap-2">
                        <span className="text-emerald-400 shrink-0 font-bold">Correct Answer:</span>
                        <span className="text-emerald-200 font-semibold">
                          <MathText text={ans.options[ans.correctIndex]} />
                        </span>
                      </div>
                    )}

                    {!ans.correct && ans.type === "multi_select" && ans.options && Array.isArray(ans.correctIndices) && (
                      <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex flex-col gap-1.5">
                        <span className="text-emerald-400 font-bold">Correct Selections:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {ans.correctIndices.map((idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-xs font-medium"
                            >
                              <MathText text={ans.options[idx] ?? `Option ${idx + 1}`} />
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {!ans.correct && ans.type === "step_ordering" && Array.isArray(ans.steps) && (
                      <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex flex-col gap-1.5">
                        <span className="text-emerald-400 font-bold">Correct Logical Sequence:</span>
                        <ol className="space-y-1 text-emerald-200 text-xs list-decimal list-inside font-medium">
                          {ans.steps.map((step, sIdx) => (
                            <li key={sIdx} className="leading-relaxed">
                              <MathText text={step} />
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {ans.type === "value_input" && (
                      <div className="p-3 rounded-lg bg-duck-500/10 border border-duck-500/30 flex items-start gap-2">
                        <span className="text-duck-400 shrink-0 font-bold">Expected Value:</span>
                        <span className="text-duck-200 font-medium">
                          <MathText text={ans.expectedAnswer || "—"} />
                          {ans.tolerance ? (
                            <span className="text-ink-400 ml-1 font-mono text-[11px]">(±{ans.tolerance})</span>
                          ) : null}
                        </span>
                      </div>
                    )}

                    {ans.type === "code_input" && (
                      <div className="p-3 rounded-lg bg-duck-500/10 border border-duck-500/30 flex flex-col gap-1.5">
                        <span className="text-duck-400 font-bold">
                          Model Solution / Rubric {ans.language ? `(${ans.language})` : ""}:
                        </span>
                        <pre className="p-2.5 rounded-lg bg-ink-950/90 border border-ink-800 font-mono text-[11px] text-duck-200 overflow-x-auto whitespace-pre">
                          <code>{ans.expectedAnswer || "# No reference code"}</code>
                        </pre>
                      </div>
                    )}

                    {ans.expectedAnswer && !["multiple_choice", "multi_select", "step_ordering", "value_input", "code_input"].includes(ans.type) && (
                      <div className="p-3 rounded-lg bg-duck-500/10 border border-duck-500/30 flex items-start gap-2">
                        <span className="text-duck-400 shrink-0 font-bold">Model Rubric:</span>
                        <span className="text-duck-200 font-medium">
                          <MathText text={ans.expectedAnswer} />
                        </span>
                      </div>
                    )}

                    {ans.feedback && (
                      <div className="mt-2 text-xs text-ink-300 border-t border-ink-800/80 pt-2.5 leading-relaxed">
                        <span className="text-duck-400 mr-1 font-semibold">💡 Feedback:</span>
                        <MathText text={ans.feedback} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // RENDER: Main Quizzes Studio Dashboard
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col h-full bg-ink-950 overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 border-b border-ink-800 bg-ink-900/90">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-duck-500/10 border border-duck-500/20 text-duck-400 flex items-center justify-center text-xl shadow-xs">
            🎯
          </div>
          <div>
            <h1 className="text-base font-bold text-ink-100 flex items-center gap-2">
              <span>Quizzes Studio</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-ink-800 border border-ink-700 text-ink-300 font-normal">
                {activeSpace} Space
              </span>
            </h1>
            <p className="text-xs text-ink-400">
              Generate customizable quizzes from your notes & track your mastery
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-duck-400 text-ink-950 text-xs font-bold shadow-md hover:bg-duck-300 transition-all"
          >
            <Plus size={16} />
            <span>Create New Quiz</span>
          </button>
        </div>
      </div>

      {/* Sub-header Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 px-6 py-3 border-b border-ink-800 bg-ink-900/50">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-ink-850 p-1 rounded-xl border border-ink-800 overflow-x-auto">
          {[
            { id: "all", label: "All Quizzes", count: counts.total },
            { id: "pending", label: "Ready to Take", count: counts.pending },
            { id: "completed", label: "Completed", count: counts.completed },
            { id: "trash", label: "Trash", count: counts.trash },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeSubTab === tab.id
                  ? "bg-ink-800 text-ink-100 shadow-xs"
                  : "text-ink-400 hover:text-ink-200"
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-ink-900 text-ink-400 font-mono">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Difficulty Filter */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter quizzes..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-ink-850 border border-ink-800 text-xs text-ink-100 placeholder:text-ink-500 focus:border-duck-500/60 focus:outline-none"
            />
          </div>

          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-ink-850 border border-ink-800 text-xs font-medium text-ink-200 focus:border-duck-500/60 focus:outline-none"
          >
            <option value="all">All Difficulties</option>
            <option value="easy">🟢 Easy</option>
            <option value="medium">🟡 Medium</option>
            <option value="hard">🔴 Hard</option>
            <option value="mastery">🟣 Mastery</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeSubTab === "trash" ? (
          /* Trash View */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-ink-200 uppercase tracking-wider">
                  Quiz Trash Bin
                </h3>
                <p className="text-[11px] text-ink-500">
                  Items in trash are automatically purged after 24 hours.
                </p>
              </div>
              {spaceTrash.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDelete({
                      open: true,
                      mode: "clear_all",
                      quiz: null,
                      count: spaceTrash.length,
                    })
                  }
                  className="px-3 py-1.5 rounded-xl border border-gap-500/30 bg-gap-500/10 text-gap-400 hover:bg-gap-500/20 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Empty Trash
                </button>
              )}
            </div>

            {spaceTrash.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-ink-800 rounded-2xl">
                <Trash2 size={32} className="mx-auto text-ink-600 mb-2" />
                <p className="text-xs text-ink-400 font-medium">Trash is empty</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {spaceTrash.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl bg-ink-900 border border-ink-800 space-y-3 opacity-80 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-ink-200 line-clamp-1">{item.title}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-ink-800 text-ink-400">
                        {item.difficulty}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-500 line-clamp-1">
                      {Array.isArray(item.noteIds) && item.noteIds.length > 1
                        ? `Notes: ${item.noteTitles?.join(", ") || `${item.noteIds.length} notes`}`
                        : `Note: ${item.noteTitle || "General"}`}
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-ink-800">
                      <button
                        type="button"
                        onClick={() => recoverQuiz(item.id)}
                        className="flex items-center gap-1 text-xs text-duck-400 hover:text-duck-300 font-semibold cursor-pointer"
                      >
                        <RotateCcw size={13} />
                        <span>Restore</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDelete({
                            open: true,
                            mode: "permanent",
                            quiz: item,
                            count: 1,
                          })
                        }
                        className="flex items-center gap-1 text-xs text-gap-400 hover:text-gap-300 font-semibold cursor-pointer"
                      >
                        <Trash2 size={13} />
                        <span>Delete Forever</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Active Quizzes Grid */
          <div>
            {filteredQuizzes.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-ink-800 rounded-3xl space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-ink-900 border border-ink-800 text-duck-400 flex items-center justify-center text-2xl mx-auto shadow-sm">
                  🎯
                </div>
                <h3 className="text-sm font-bold text-ink-200">No quizzes found</h3>
                <p className="text-xs text-ink-500 max-w-sm mx-auto">
                  {searchQuery || difficultyFilter !== "all"
                    ? "Try adjusting your search or difficulty filter."
                    : "Create your first customized AI quiz based on your study notes."}
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-duck-400 text-ink-950 text-xs font-bold hover:bg-duck-300 shadow-md transition-colors mt-2"
                >
                  <Plus size={15} />
                  <span>Create Quiz</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredQuizzes.map((quiz) => {
                  const isCompleted = quiz.status === "completed" && quiz.result;
                  const questionCount = quiz.questions?.length || 0;
                  const draftCount = quiz.draftAnswers
                    ? Object.keys(quiz.draftAnswers).filter(
                        (k) => quiz.draftAnswers[k] !== undefined && quiz.draftAnswers[k] !== ""
                      ).length
                    : 0;
                  const hasDraft = !isCompleted && draftCount > 0;

                  return (
                    <div
                      key={quiz.id}
                      className="flex flex-col p-5 rounded-2xl bg-ink-900 border border-ink-800 hover:border-ink-700 transition-all shadow-md group"
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-full border uppercase tracking-wider font-bold ${
                            difficultyColors[quiz.difficulty] || difficultyColors.medium
                          }`}
                        >
                          {quiz.difficulty}
                        </span>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            title="Delete quiz"
                            onClick={() =>
                              setConfirmDelete({
                                open: true,
                                mode: "trash",
                                quiz,
                                count: 1,
                              })
                            }
                            className="p-1 rounded-lg text-ink-500 hover:text-gap-400 hover:bg-ink-800 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Title & Note */}
                      <div className="flex-1 space-y-1 mb-4">
                        <h3 className="text-sm font-bold text-ink-100 line-clamp-2 leading-snug">
                          {quiz.title}
                        </h3>
                        {Array.isArray(quiz.noteIds) && quiz.noteIds.length > 1 ? (
                          <div className="pt-0.5">
                            <button
                              type="button"
                              onClick={() => setViewingSourceNotesQuiz(quiz)}
                              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-ink-850/90 hover:bg-ink-800 border border-ink-750 hover:border-duck-500/40 text-xs font-medium text-ink-300 hover:text-duck-300 transition-all cursor-pointer group/src shadow-xs"
                              title="Click to view all source notes"
                            >
                              <span className="text-duck-400 font-semibold flex items-center gap-1">
                                <span>📚</span>
                                <span>{quiz.noteIds.length} notes</span>
                              </span>
                              <span className="text-ink-600 group-hover/src:text-ink-400">•</span>
                              <span className="text-[11px] text-ink-400 group-hover/src:text-duck-300 flex items-center gap-0.5">
                                <span>View notes</span>
                                <ChevronRight size={12} />
                              </span>
                            </button>
                          </div>
                        ) : quiz.noteId ? (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectNote?.({ id: quiz.noteId, title: quiz.noteTitle });
                              setActiveTab?.("notes");
                            }}
                            className="text-xs text-ink-400 hover:text-duck-300 transition-colors flex items-center gap-1.5 text-left group/note truncate max-w-full"
                            title="Open note in editor"
                          >
                            <span>📝</span>
                            <span className="truncate underline-offset-2 group-hover/note:underline">
                              {quiz.noteTitle || "Untitled Note"}
                            </span>
                          </button>
                        ) : (
                          <p className="text-xs text-ink-400 flex items-center gap-1.5 truncate">
                            <span>📝</span>
                            <span className="truncate">{quiz.noteTitle || "Untitled Note"}</span>
                          </p>
                        )}
                      </div>

                      {/* Question Breakdown Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-4 text-[10px] font-medium text-ink-400">
                        <span className="px-2 py-0.5 rounded-md bg-ink-850 border border-ink-800">
                          {questionCount} Questions
                        </span>
                        {quiz.questionCounts?.mcq > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-ink-850 border border-ink-800">
                            {quiz.questionCounts.mcq} MCQ
                          </span>
                        )}
                        {quiz.questionCounts?.shortAnswer > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-ink-850 border border-ink-800">
                            {quiz.questionCounts.shortAnswer} Short
                          </span>
                        )}
                        {quiz.questionCounts?.longAnswer > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-ink-850 border border-ink-800">
                            {quiz.questionCounts.longAnswer} Essay
                          </span>
                        )}
                      </div>

                      {/* Status / Score Footer */}
                      <div className="pt-3 border-t border-ink-800 flex items-center justify-between">
                        {isCompleted ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-solid-400">
                              Score: {quiz.result.score}%
                            </span>
                            <span className="text-[11px] text-ink-500">
                              ({quiz.result.correctCount}/{quiz.result.totalCount})
                            </span>
                          </div>
                        ) : hasDraft ? (
                          <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span>In Progress ({draftCount}/{questionCount})</span>
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-duck-400 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-duck-400 animate-pulse" />
                            Ready to Take
                          </span>
                        )}

                        <div className="flex items-center gap-2">
                          {isCompleted ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleViewReview(quiz)}
                                className="px-3 py-1.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-xs font-semibold text-ink-200 hover:text-ink-100 transition-colors cursor-pointer"
                              >
                                Review
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartQuiz(quiz, true)}
                                className="p-1.5 rounded-xl bg-ink-850 hover:bg-ink-800 text-ink-400 hover:text-ink-100 transition-colors border border-ink-800 cursor-pointer"
                                title="Retake Quiz"
                              >
                                <RotateCcw size={14} />
                              </button>
                            </>
                          ) : hasDraft ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartQuiz(quiz, false)}
                                className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-xs font-bold text-ink-950 shadow-sm transition-colors cursor-pointer"
                              >
                                Resume Quiz
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartQuiz(quiz, true)}
                                className="p-1.5 rounded-xl bg-ink-850 hover:bg-ink-800 text-ink-400 hover:text-ink-100 transition-colors border border-ink-800 cursor-pointer"
                                title="Restart Quiz Fresh"
                              >
                                <RotateCcw size={14} />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartQuiz(quiz, false)}
                              className="px-4 py-1.5 rounded-xl bg-duck-400 hover:bg-duck-300 text-xs font-bold text-ink-950 shadow-sm transition-colors cursor-pointer"
                            >
                              Take Quiz
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Quiz Modal */}
      {isCreateOpen && (
        <CreateQuizModal
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          activeSpace={activeSpace}
          notesBySpace={notesBySpace}
          onQuizCreated={(quiz) => {
            setIsCreateOpen(false);
            handleStartQuiz(quiz);
          }}
        />
      )}

      {/* Delete Quiz Confirmation Modal */}
      <DeleteQuizConfirmModal
        open={confirmDelete.open}
        mode={confirmDelete.mode}
        quiz={confirmDelete.quiz}
        count={confirmDelete.count}
        onClose={() => setConfirmDelete({ open: false, mode: "trash", quiz: null, count: 0 })}
        onConfirm={handleExecuteDelete}
      />

      {/* Source Notes Viewer Modal */}
      <SourceNotesModal
        quiz={viewingSourceNotesQuiz}
        onClose={() => setViewingSourceNotesQuiz(null)}
        onSelectNote={onSelectNote}
        setActiveTab={setActiveTab}
      />
    </div>
  );
}

"use client";

import { useState, useMemo, useEffect, useRef, useCallback, memo } from "react";
import { X, Sparkles, Search, ChevronDown, ChevronUp } from "lucide-react";
import { saveQuiz, getSyllabusStatement, getSpaceSettings } from "@/lib/storageService";
import { shouldUseClientAI, quizGenerate } from "@/lib/aiService";
import { editorBlocksToText, extractHeadingsFromBlocks } from "@/lib/blocks";

const HeadingCheckboxItem = memo(function HeadingCheckboxItem({
  heading,
  isChecked,
  onToggle,
  showNoteTitle,
  disabled,
}) {
  const badgeStyle =
    heading.type === "H1"
      ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
      : heading.type === "H2"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : heading.type === "H3"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
      : "bg-purple-500/20 text-purple-300 border-purple-500/40";

  return (
    <label
      className={`flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors cursor-pointer select-none ${
        isChecked
          ? "bg-duck-500/10 border-duck-500/40 text-ink-100 shadow-xs"
          : "bg-ink-900/60 border-ink-800 text-ink-300 hover:border-ink-700 hover:bg-ink-800"
      }`}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={() => onToggle(heading.displayLabel)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-600 bg-ink-800 text-duck-500 focus:ring-duck-400 focus:ring-offset-0 cursor-pointer accent-duck-500"
      />
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider border ${badgeStyle}`}
      >
        {heading.type}
      </span>
      <div className="flex-1 min-w-0">
        {showNoteTitle && (
          <span className="block text-[10px] text-duck-400 font-medium truncate mb-0.5">
            📄 {heading.noteTitle}
          </span>
        )}
        <span className="text-xs font-semibold leading-relaxed break-words text-ink-100">
          {heading.text}
        </span>
      </div>
    </label>
  );
});

export default function CreateQuizModal({
  open,
  onClose,
  activeSpace,
  notesBySpace = {},
  onQuizCreated,
}) {
  const [selectedSpace, setSelectedSpace] = useState(activeSpace || "School");
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);
  const [isNotePickerOpen, setIsNotePickerOpen] = useState(false);
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [difficulty, setDifficulty] = useState("medium"); // easy | medium | hard | mastery
  const [scope, setScope] = useState("whole"); // whole | heading | custom
  const [selectedHeadings, setSelectedHeadings] = useState([]);
  const [customFocus, setCustomFocus] = useState("");
  const [mcqCount, setMcqCount] = useState(3);
  const [multiSelectCount, setMultiSelectCount] = useState(1);
  const [valueInputCount, setValueInputCount] = useState(2);
  const [stepOrderingCount, setStepOrderingCount] = useState(1);
  const [codeInputCount, setCodeInputCount] = useState(0);
  const [shortAnswerCount, setShortAnswerCount] = useState(1);
  const [longAnswerCount, setLongAnswerCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [syllabusStatement, setSyllabusStatement] = useState("");
  const [syllabusEnabled, setSyllabusEnabled] = useState(true);
  const [spaceConfig, setSpaceConfig] = useState(null);

  const prevOpenRef = useRef(false);
  const notePickerRef = useRef(null);

  // Synchronize space and syllabus settings on transition from closed to open
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const space = activeSpace || Object.keys(notesBySpace)[0] || "School";
      setSelectedSpace(space);
      const notes = notesBySpace[space] || [];
      if (notes.length > 0) {
        setSelectedNoteIds([notes[0].id]);
        setCustomTitle(`${notes[0].title || "Untitled"} Quiz`);
      } else {
        setSelectedNoteIds([]);
        setCustomTitle("Custom Quiz");
      }
      setIsNotePickerOpen(false);
      setNoteSearchQuery("");
      setError(null);

      // Load space-specific syllabus statement and settings
      getSyllabusStatement(space).then(({ statement, enabled }) => {
        setSyllabusStatement(statement || "");
        setSyllabusEnabled(Boolean(enabled));
      });
      getSpaceSettings(space).then((settings) => {
        setSpaceConfig(settings || null);
      });
    }
    prevOpenRef.current = open;
  }, [open, activeSpace, notesBySpace]);

  // Click outside listener for note multi-select picker
  useEffect(() => {
    function handleClickOutside(event) {
      if (notePickerRef.current && !notePickerRef.current.contains(event.target)) {
        setIsNotePickerOpen(false);
      }
    }
    if (isNotePickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isNotePickerOpen]);

  const currentNotes = useMemo(() => {
    if (!open) return [];
    return notesBySpace[selectedSpace] || [];
  }, [open, notesBySpace, selectedSpace]);

  const filteredNotes = useMemo(() => {
    if (!open) return [];
    if (!noteSearchQuery.trim()) return currentNotes;
    const q = noteSearchQuery.toLowerCase().trim();
    return currentNotes.filter((n) => (n.title || "Untitled").toLowerCase().includes(q));
  }, [open, currentNotes, noteSearchQuery]);

  // When selected space changes, pick first note and reload space syllabus
  const handleSpaceChange = useCallback((space) => {
    setSelectedSpace(space);
    const notes = notesBySpace[space] || [];
    if (notes.length > 0) {
      setSelectedNoteIds([notes[0].id]);
      setCustomTitle(`${notes[0].title || "Untitled"} Quiz`);
    } else {
      setSelectedNoteIds([]);
      setCustomTitle("Custom Quiz");
    }
    setIsNotePickerOpen(false);
    setNoteSearchQuery("");

    // Reload syllabus documents and settings for this newly selected space
    getSyllabusStatement(space).then(({ statement, enabled }) => {
      setSyllabusStatement(statement || "");
      setSyllabusEnabled(Boolean(enabled));
    });
    getSpaceSettings(space).then((settings) => {
      setSpaceConfig(settings || null);
    });
  }, [notesBySpace]);

  const selectedNotes = useMemo(() => {
    if (!open) return [];
    return currentNotes.filter((n) => selectedNoteIds.includes(n.id));
  }, [open, currentNotes, selectedNoteIds]);

  const toggleNote = useCallback((id) => {
    setSelectedNoteIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      if (next.length === 1) {
        const single = currentNotes.find((n) => n.id === next[0]);
        if (single) setCustomTitle(`${single.title || "Untitled"} Quiz`);
      } else if (next.length > 1) {
        const picked = currentNotes.filter((n) => next.includes(n.id));
        if (picked.length > 3) {
          setCustomTitle(`${selectedSpace} Synthesis Quiz (${picked.length} Notes)`);
        } else {
          const names = picked
            .slice(0, 2)
            .map((n) => {
              const t = n.title || "Untitled";
              return t.length > 25 ? `${t.slice(0, 22).trim()}...` : t;
            })
            .join(" & ");
          setCustomTitle(`${names}${picked.length > 2 ? ` +${picked.length - 2}` : ""} Quiz`);
        }
      }
      return next;
    });
  }, [currentNotes, selectedSpace]);

  const handleSelectAllNotes = useCallback(() => {
    const allIds = currentNotes.map((n) => n.id);
    setSelectedNoteIds(allIds);
    if (allIds.length > 1) {
      setCustomTitle(`${selectedSpace} Notes Synthesis Quiz`);
    } else if (allIds.length === 1) {
      setCustomTitle(`${currentNotes[0]?.title || "Untitled"} Quiz`);
    }
  }, [currentNotes, selectedSpace]);

  const handleClearAllNotes = useCallback(() => {
    setSelectedNoteIds([]);
  }, []);

  // Extract all headings (H1–H4) across all selected notes
  const headings = useMemo(() => {
    if (!open || !selectedNotes || selectedNotes.length === 0) return [];
    const all = [];
    selectedNotes.forEach((note) => {
      if (Array.isArray(note.blocks)) {
        const noteHeadings = extractHeadingsFromBlocks(note.blocks);
        noteHeadings.forEach((h, idx) => {
          const displayLabel =
            selectedNotes.length > 1 ? `[${note.title || "Untitled"}] ${h.text}` : h.text;
          all.push({
            ...h,
            id: `${note.id}_${h.type}_${idx}_${h.text}`,
            noteId: note.id,
            noteTitle: note.title || "Untitled",
            displayLabel,
          });
        });
      }
    });
    return all;
  }, [open, selectedNotes]);

  // Set lookup for O(1) heading selection checks
  const selectedHeadingsSet = useMemo(() => new Set(selectedHeadings), [selectedHeadings]);

  // Auto-synchronize selected headings when notes or headings change
  useEffect(() => {
    if (!open) return;
    if (headings.length > 0) {
      const labelSet = new Set(headings.map((h) => h.displayLabel));
      setSelectedHeadings((prev) => {
        const valid = prev.filter((lbl) => labelSet.has(lbl));
        return valid.length > 0 ? valid : [headings[0].displayLabel];
      });
    } else {
      setSelectedHeadings([]);
    }
  }, [open, headings]);

  const toggleHeading = useCallback((label) => {
    setSelectedHeadings((prev) =>
      prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]
    );
  }, []);

  const totalQuestions =
    mcqCount +
    multiSelectCount +
    valueInputCount +
    stepOrderingCount +
    codeInputCount +
    shortAnswerCount +
    longAnswerCount;

  const applyDistributionPreset = useCallback((preset) => {
    if (preset === "igcse") {
      setMcqCount(3);
      setMultiSelectCount(1);
      setValueInputCount(2);
      setStepOrderingCount(1);
      setCodeInputCount(0);
      setShortAnswerCount(1);
      setLongAnswerCount(0);
    } else if (preset === "math") {
      setMcqCount(2);
      setMultiSelectCount(0);
      setValueInputCount(3);
      setStepOrderingCount(2);
      setCodeInputCount(0);
      setShortAnswerCount(1);
      setLongAnswerCount(0);
    } else if (preset === "cs") {
      setMcqCount(2);
      setMultiSelectCount(2);
      setValueInputCount(0);
      setStepOrderingCount(1);
      setCodeInputCount(2);
      setShortAnswerCount(1);
      setLongAnswerCount(0);
    } else if (preset === "quick") {
      setMcqCount(5);
      setMultiSelectCount(0);
      setValueInputCount(0);
      setStepOrderingCount(0);
      setCodeInputCount(0);
      setShortAnswerCount(0);
      setLongAnswerCount(0);
    }
  }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (selectedNotes.length === 0) {
      setError("Please select at least one note with content to generate a quiz.");
      return;
    }

    if (totalQuestions <= 0) {
      setError("Please select at least 1 question for the quiz.");
      return;
    }

    // Build note contents across all selected notes
    const noteContentsList = [];
    for (const note of selectedNotes) {
      const text = editorBlocksToText(note.blocks || []);
      if (text && text.trim()) {
        noteContentsList.push(
          selectedNotes.length > 1
            ? `=== Source Note: "${note.title || "Untitled Note"}" ===\n${text.trim()}`
            : text.trim()
        );
      }
    }

    if (noteContentsList.length === 0) {
      setError(
        selectedNotes.length > 1
          ? "The selected notes have no text content. Please add content to your notes before creating a quiz."
          : "The selected note is empty. Please add content to your note before creating a quiz."
      );
      return;
    }

    const noteContent = noteContentsList.join("\n\n----------------------------------------\n\n");

    setGenerating(true);
    setError(null);

    let focusText = "";
    if (scope === "heading") {
      if (selectedHeadings.length === 0) {
        setError("Please check at least one heading section to focus on.");
        setGenerating(false);
        return;
      }
      focusText = `Target Sections: ${selectedHeadings.map((h) => `"${h}"`).join(", ")}`;
    } else if (scope === "custom" && customFocus.trim()) {
      focusText = customFocus.trim();
    }

    let concept = "";
    if (scope === "heading" && selectedHeadings.length > 0) {
      concept = selectedHeadings.join(" & ");
    } else if (selectedNotes.length === 1) {
      concept = selectedNotes[0].title || "Study Concept";
    } else {
      concept = selectedNotes.map((n) => n.title || "Untitled Note").join(" & ");
    }

    const defaultTitle =
      selectedNotes.length === 1
        ? `${selectedNotes[0].title || "Note"} Quiz`
        : `${selectedNotes.map((n) => n.title || "Note").slice(0, 2).join(" & ")}${
            selectedNotes.length > 2 ? ` +${selectedNotes.length - 2}` : ""
          } Quiz`;
    const title = customTitle.trim() || defaultTitle;

    try {
      const payload = {
        concept,
        noteContent,
        focus: focusText,
        difficulty,
        mcqCount,
        multiSelectCount,
        valueInputCount,
        stepOrderingCount,
        codeInputCount,
        shortAnswerCount,
        longAnswerCount,
        title,
        syllabus: syllabusEnabled ? syllabusStatement : "",
        spaceId: selectedSpace,
        aiPersona: spaceConfig?.aiPersona || "examiner",
        strictness: spaceConfig?.strictness || "standard",
        academicLevel: spaceConfig?.academicLevel || "igcse_grade_10",
      };

      const isClient = await shouldUseClientAI();
      let data;
      if (isClient) {
        data = await quizGenerate(payload);
      } else {
        const res = await fetch("/api/quiz/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to generate quiz (${res.status})`);
      }

      if (!data?.quiz?.questions?.length) {
        throw new Error(
          selectedNotes.length > 1
            ? "No questions could be built from the selected notes. Try selecting different notes or sections."
            : "No questions could be built from this note. Try selecting a different section or note."
        );
      }

      const newQuiz = await saveQuiz({
        spaceId: selectedSpace,
        noteId: selectedNotes[0]?.id || null,
        noteTitle: selectedNotes.map((n) => n.title || "Untitled Note").join(", "),
        noteIds: selectedNotes.map((n) => n.id),
        noteTitles: selectedNotes.map((n) => n.title || "Untitled Note"),
        title: title,
        difficulty,
        scope,
        focusText,
        questionCounts: {
          mcq: mcqCount,
          multiSelect: multiSelectCount,
          valueInput: valueInputCount,
          stepOrdering: stepOrderingCount,
          codeInput: codeInputCount,
          shortAnswer: shortAnswerCount,
          longAnswer: longAnswerCount,
        },
        questions: data.quiz.questions,
        status: "pending",
        result: null,
      });

      onQuizCreated?.(newQuiz);
      onClose();
    } catch (err) {
      console.error("Quiz generation error:", err);
      setError(err.message || "Failed to generate quiz. Please check your connection or API key.");
    } finally {
      setGenerating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-xs animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-quiz-title"
        className="flex flex-col w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] bg-ink-900 border border-ink-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-b border-ink-800 bg-ink-900/90">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-duck-500/10 text-duck-400 border border-duck-500/20 text-lg">
              🎯
            </span>
            <div>
              <h2 id="create-quiz-title" className="text-base font-semibold text-ink-100">
                Create AI Study Quiz
              </h2>
              <p className="text-xs text-ink-400">
                Configure question types, difficulty, and note scope
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="p-1.5 text-ink-400 hover:text-ink-200 hover:bg-ink-800 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleGenerate} className="flex-1 overflow-y-auto px-6 sm:px-8 py-5 sm:py-6 space-y-6">
          {syllabusEnabled && syllabusStatement && (
            <div className="p-3 text-xs bg-duck-500/10 border border-duck-500/30 rounded-xl flex items-center justify-between gap-3 text-duck-200">
              <div className="flex items-center gap-2 truncate">
                <span className="text-sm shrink-0">🎓</span>
                <span className="truncate">
                  <strong>Syllabus Bound:</strong> {syllabusStatement}
                </span>
              </div>
              <span className="text-[10px] text-duck-400 font-mono shrink-0">Settings ⚙️</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 text-xs text-gap-400 bg-gap-500/10 border border-gap-500/20 rounded-xl flex items-start gap-2">
              <span className="shrink-0 font-bold">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Title & Space */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-300 mb-1.5">
                Target Space
              </label>
              <select
                value={selectedSpace}
                onChange={(e) => handleSpaceChange(e.target.value)}
                disabled={generating}
                className="w-full px-3 py-2 text-xs font-medium bg-ink-850 text-ink-100 border border-ink-700 rounded-xl focus:border-duck-500/60 focus:outline-none"
              >
                {Object.keys(notesBySpace).map((s) => (
                  <option key={s} value={s}>
                    📁 {s} ({notesBySpace[s]?.length || 0} notes)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-ink-300">
                  Source Note{selectedNotes.length > 1 ? "s" : ""}
                </label>
                {currentNotes.length > 0 && (
                  <span className="text-[10px] font-bold text-duck-300 bg-duck-500/15 border border-duck-500/30 px-1.5 py-0.5 rounded-full">
                    {selectedNoteIds.length} of {currentNotes.length} selected
                  </span>
                )}
              </div>

              {/* Multi-Select Dropdown Container */}
              <div className="relative" ref={notePickerRef}>
                <button
                  type="button"
                  onClick={() => setIsNotePickerOpen((prev) => !prev)}
                  disabled={generating || currentNotes.length === 0}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium bg-ink-850 text-ink-100 border border-ink-700 rounded-xl hover:border-ink-600 focus:border-duck-500/60 focus:outline-none transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {currentNotes.length === 0 ? (
                      <span className="text-ink-500">No notes in this space</span>
                    ) : selectedNotes.length === 0 ? (
                      <span className="text-ink-500">Select source note(s)...</span>
                    ) : selectedNotes.length === 1 ? (
                      <>
                        <span className="shrink-0">{selectedNotes[0].emoji || "📝"}</span>
                        <span className="truncate text-ink-100 font-semibold">
                          {selectedNotes[0].title || "Untitled Note"}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="shrink-0">📚</span>
                        <span className="truncate text-ink-100 font-semibold">
                          {selectedNotes.length} Notes Selected
                        </span>
                        <span className="text-[10px] text-ink-400 font-normal truncate hidden sm:inline">
                          ({selectedNotes.map((n) => n.title || "Untitled").slice(0, 2).join(", ")}{selectedNotes.length > 2 ? "..." : ""})
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-ink-400 shrink-0 ml-2">
                    {isNotePickerOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>

                {/* Dropdown Popover */}
                {isNotePickerOpen && (
                  <div className="absolute z-30 left-0 right-0 mt-1 p-2 bg-ink-900 border border-ink-700 rounded-xl shadow-2xl space-y-2 animate-fade-in">
                    {/* Search & Quick Actions */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
                        <input
                          type="text"
                          value={noteSearchQuery}
                          onChange={(e) => setNoteSearchQuery(e.target.value)}
                          placeholder="Filter notes..."
                          className="w-full pl-7 pr-2.5 py-1 text-[11px] text-ink-100 bg-ink-850 border border-ink-750 rounded-lg placeholder:text-ink-500 focus:outline-none focus:border-duck-500/60"
                        />
                      </div>
                      <div className="flex items-center gap-1 text-[10px] shrink-0 font-semibold">
                        <button
                          type="button"
                          onClick={handleSelectAllNotes}
                          className="text-duck-400 hover:text-duck-300 hover:underline px-1 py-0.5"
                        >
                          All
                        </button>
                        <span className="text-ink-600">•</span>
                        <button
                          type="button"
                          onClick={handleClearAllNotes}
                          className="text-ink-400 hover:text-ink-300 hover:underline px-1 py-0.5"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Note List */}
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
                      {filteredNotes.length === 0 ? (
                        <div className="py-3 text-center text-xs text-ink-500 italic">
                          No matching notes found
                        </div>
                      ) : (
                        filteredNotes.map((n) => {
                          const isSelected = selectedNoteIds.includes(n.id);
                          return (
                            <label
                              key={n.id}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                                isSelected
                                  ? "bg-duck-500/10 border border-duck-500/30 text-ink-100"
                                  : "hover:bg-ink-850 text-ink-300 border border-transparent"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleNote(n.id)}
                                className="h-3.5 w-3.5 rounded border-ink-600 bg-ink-800 text-duck-500 focus:ring-0 cursor-pointer accent-duck-500"
                              />
                              <span className="shrink-0">{n.emoji || "📝"}</span>
                              <span className="flex-1 truncate font-medium">
                                {n.title || "Untitled Note"}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Removable Badges / Selected Notes Chips */}
              {selectedNotes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedNotes.map((note) => (
                    <span
                      key={note.id}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-ink-850 border border-ink-750 text-[11px] font-medium text-ink-200 shadow-xs"
                    >
                      <span className="text-xs">{note.emoji || "📝"}</span>
                      <span className="truncate max-w-[140px]">{note.title || "Untitled Note"}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleNote(note.id);
                        }}
                        disabled={generating}
                        className="text-ink-500 hover:text-gap-400 p-0.5 rounded-xs transition-colors"
                        title={`Remove ${note.title || "Note"}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quiz Title */}
          <div>
            <label className="block text-xs font-semibold text-ink-300 mb-1.5">
              Quiz Title
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g. Optics & Wave Optics Diagnostic"
              disabled={generating}
              className="w-full px-3.5 py-2 text-xs text-ink-100 bg-ink-850 border border-ink-700 rounded-xl placeholder:text-ink-500 focus:border-duck-500/60 focus:outline-none"
            />
          </div>

          {/* Scope / Specific Part */}
          <div>
            <label className="block text-xs font-semibold text-ink-300 mb-1.5">
              Note Scope / Part to Test
            </label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                {
                  id: "whole",
                  label: selectedNotes.length > 1 ? "All Selected Notes" : "Whole Note",
                  desc: selectedNotes.length > 1 ? "Covers all chosen notes" : "Covers entire note",
                },
                { id: "heading", label: "Specific Section(s)", desc: "Select headings" },
                { id: "custom", label: "Custom Focus", desc: "Specific sub-topic" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setScope(opt.id)}
                  disabled={generating}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    scope === opt.id
                      ? "bg-duck-500/10 border-duck-500/60 text-duck-300 font-semibold"
                      : "bg-ink-850 border-ink-800 text-ink-400 hover:border-ink-700 hover:text-ink-200"
                  }`}
                >
                  <p className="text-xs">{opt.label}</p>
                  <p className="text-[10px] text-ink-500">{opt.desc}</p>
                </button>
              ))}
            </div>

            {scope === "heading" && (
              <div className="animate-fade-in space-y-2">
                {headings.length > 0 ? (
                  <div className="rounded-xl border border-ink-700 bg-ink-850 p-3 space-y-2.5">
                    {/* Header & Quick Action Controls */}
                    <div className="flex items-center justify-between border-b border-ink-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink-200">
                          Select Section Headings
                        </span>
                        <span className="rounded-full bg-duck-500/20 px-2 py-0.5 text-[10px] font-extrabold text-duck-300 border border-duck-500/30">
                          {selectedHeadings.length} of {headings.length} selected
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setSelectedHeadings(headings.map((h) => h.displayLabel))}
                          disabled={generating}
                          className="text-duck-400 hover:text-duck-300 hover:underline font-semibold"
                        >
                          Select All
                        </button>
                        <span className="text-ink-600">•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedHeadings([])}
                          disabled={generating}
                          className="text-ink-400 hover:text-ink-300 hover:underline font-medium"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Checkbox Menu */}
                    <div className="max-h-60 overflow-y-auto pr-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {headings.map((h, i) => (
                          <HeadingCheckboxItem
                            key={`${h.id || i}_${h.displayLabel}`}
                            heading={h}
                            isChecked={selectedHeadingsSet.has(h.displayLabel)}
                            onToggle={toggleHeading}
                            showNoteTitle={selectedNotes.length > 1}
                            disabled={generating}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Helper Hint */}
                    <p className="pt-1.5 border-t border-ink-800/80 text-[11px] text-ink-400 flex items-center gap-1.5 leading-relaxed">
                      <span className="text-duck-400 shrink-0">💡</span>
                      <span>
                        <strong className="text-ink-300 font-semibold">Tip:</strong> Choose your main headings. Selecting subheadings is not required since the full note is provided to the AI.
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="text-xs text-ink-400 italic p-3 rounded-xl bg-ink-850 border border-ink-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <span className="not-italic">💡</span>
                      <span>No headings (H1–H4) detected in {selectedNotes.length > 1 ? "these notes" : "this note"}.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setScope("whole")}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-duck-400/15 text-duck-300 hover:bg-duck-400/25 border border-duck-500/30 text-[11px] font-semibold transition-colors not-italic"
                    >
                      Switch to {selectedNotes.length > 1 ? "All Selected Notes" : "Whole Note"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {scope === "custom" && (
              <div className="animate-fade-in">
                <input
                  type="text"
                  value={customFocus}
                  onChange={(e) => setCustomFocus(e.target.value)}
                  placeholder="e.g. Total Internal Reflection & Critical Angle equations"
                  disabled={generating}
                  className="w-full px-3.5 py-2 text-xs text-ink-100 bg-ink-850 border border-ink-700 rounded-xl placeholder:text-ink-500 focus:border-duck-500/60 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Difficulty Selection */}
          <div>
            <label className="block text-xs font-semibold text-ink-300 mb-1.5">
              Difficulty Level
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "easy", label: "Easy", emoji: "🟢", desc: "Definitions & basics" },
                { id: "medium", label: "Medium", emoji: "🟡", desc: "Standard exams" },
                { id: "hard", label: "Hard", emoji: "🔴", desc: "Tricky edge cases" },
                { id: "mastery", label: "Mastery", emoji: "🟣", desc: "Expert synthesis" },
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  disabled={generating}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    difficulty === d.id
                      ? "bg-duck-500/10 border-duck-500/60 text-duck-300 font-semibold shadow-xs"
                      : "bg-ink-850 border-ink-800 text-ink-400 hover:border-ink-700 hover:text-ink-200"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{d.emoji}</span>
                    <span className="text-xs font-medium">{d.label}</span>
                  </div>
                  <p className="text-[10px] text-ink-500 mt-1">{d.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Question Breakdown */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-semibold text-ink-200">
                  Question Type Distribution
                </label>
                <p className="text-[10px] text-ink-400">
                  Tailor question formats for math derivations, coding, or objective recall
                </p>
              </div>
              <span className="self-start sm:self-auto text-xs font-bold text-duck-300 bg-duck-500/15 px-2.5 py-0.5 rounded-full border border-duck-500/30">
                {totalQuestions} Total Questions
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] uppercase tracking-wider font-bold text-ink-500 mr-1">
                Presets:
              </span>
              <button
                type="button"
                onClick={() => applyDistributionPreset("igcse")}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-ink-800 hover:bg-duck-500/20 text-ink-200 hover:text-duck-300 border border-ink-700 hover:border-duck-500/40 transition-colors"
              >
                🎓 IGCSE Gr.10 STEM (8 Qs)
              </button>
              <button
                type="button"
                onClick={() => applyDistributionPreset("math")}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-ink-800 hover:bg-duck-500/20 text-ink-200 hover:text-duck-300 border border-ink-700 hover:border-duck-500/40 transition-colors"
              >
                🧮 Pure Math & Derivations (8 Qs)
              </button>
              <button
                type="button"
                onClick={() => applyDistributionPreset("cs")}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-ink-800 hover:bg-duck-500/20 text-ink-200 hover:text-duck-300 border border-ink-700 hover:border-duck-500/40 transition-colors"
              >
                💻 Computer Science (8 Qs)
              </button>
              <button
                type="button"
                onClick={() => applyDistributionPreset("quick")}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-ink-800 hover:bg-duck-500/20 text-ink-200 hover:text-duck-300 border border-ink-700 hover:border-duck-500/40 transition-colors"
              >
                ⚡ Quick 5 MCQ
              </button>
            </div>

            {/* 1. Mathematics & Science Reasoning */}
            <div className="space-y-2 pt-1">
              <p className="text-[10px] font-bold text-duck-400 uppercase tracking-wider">
                🧮 Mathematics & Science Reasoning
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <QuestionCountSlider
                  label="Math / Value Input"
                  desc="Exact calculation, fraction or formula with LaTeX keyboard"
                  value={valueInputCount}
                  onChange={setValueInputCount}
                  max={30}
                  disabled={generating}
                />
                <QuestionCountSlider
                  label="Step Ordering (Parsons)"
                  desc="Derivations, proofs, or algorithm steps to rearrange"
                  value={stepOrderingCount}
                  onChange={setStepOrderingCount}
                  max={20}
                  disabled={generating}
                />
              </div>
            </div>

            {/* 2. Objective & Multi-Select */}
            <div className="space-y-2 pt-1">
              <p className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">
                🎯 Objective Questions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <QuestionCountSlider
                  label="Multiple Choice"
                  desc="Standard 4-choice single option"
                  value={mcqCount}
                  onChange={setMcqCount}
                  max={60}
                  disabled={generating}
                />
                <QuestionCountSlider
                  label="Multi-Select (Check All)"
                  desc="2+ correct choices out of 4 options"
                  value={multiSelectCount}
                  onChange={setMultiSelectCount}
                  max={30}
                  disabled={generating}
                />
              </div>
            </div>

            {/* 3. Applied Analysis & Coding */}
            <div className="space-y-2 pt-1">
              <p className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">
                💻 Applied & Written Analysis
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <QuestionCountSlider
                  label="Code Input"
                  desc="Inbuilt code editor problem (Python / CS)"
                  value={codeInputCount}
                  onChange={setCodeInputCount}
                  max={20}
                  disabled={generating}
                />
                <QuestionCountSlider
                  label="Short Answer"
                  desc="Concise mechanism explanations"
                  value={shortAnswerCount}
                  onChange={setShortAnswerCount}
                  max={30}
                  disabled={generating}
                />
                <QuestionCountSlider
                  label="Long Answer"
                  desc="Full essay reasoning & proofs"
                  value={longAnswerCount}
                  onChange={setLongAnswerCount}
                  max={20}
                  disabled={generating}
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 sm:px-8 py-4 border-t border-ink-800 bg-ink-900/90">
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 text-xs font-medium text-ink-400 hover:text-ink-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || selectedNotes.length === 0 || totalQuestions === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-duck-400 text-ink-950 text-xs font-bold shadow-md hover:bg-duck-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-ink-950 border-t-transparent rounded-full animate-spin" />
                <span>Generating Quiz ({totalQuestions} Qs)...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Generate Quiz</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const QuestionCountSlider = memo(function QuestionCountSlider({
  label,
  desc,
  value,
  onChange,
  max,
  disabled,
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="p-3.5 rounded-xl bg-ink-850 border border-ink-800 space-y-3 transition-colors hover:border-ink-700/80">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-ink-100">{label}</p>
          <p className="text-[10px] text-ink-400">{desc}</p>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={max}
            value={value}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (isNaN(val)) onChange(0);
              else onChange(Math.max(0, Math.min(max, val)));
            }}
            disabled={disabled}
            className="w-12 px-1.5 py-0.5 text-center text-xs font-black text-duck-300 bg-duck-500/10 border border-duck-500/30 rounded-lg focus:outline-none focus:border-duck-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text"
          />
          <span className="text-[10px] font-semibold text-ink-500">/ {max}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <input
          type="range"
          min="0"
          max={max}
          step="1"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          style={{
            background: `linear-gradient(to right, #f0c04a 0%, #f0c04a ${pct}%, #282d3f ${pct}%, #282d3f 100%)`,
          }}
          className="quiz-slider w-full cursor-pointer disabled:opacity-40"
        />
        <div className="flex items-center justify-between text-[10px] text-ink-500 font-medium px-0.5 select-none">
          <span>0</span>
          <span className={value > 0 ? "text-duck-400 font-bold" : "text-ink-500"}>
            {value} {value === 1 ? "question" : "questions"}
          </span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  );
});

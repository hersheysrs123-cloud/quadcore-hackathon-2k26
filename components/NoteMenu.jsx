"use client";

import { useState, useRef, useEffect } from "react";
import {
  MoreVertical,
  Save,
  Star,
  BarChart2,
  ArrowRightLeft,
  Trash2,
  Check,
  ChevronDown,
  X,
  FileText,
  Clock,
  Layers,
} from "lucide-react";

export default function NoteMenu({
  note,
  onSaveNote,
  onToggleFavorite,
  onExportImport,
  onDeleteNote,
  variant = "button", // "button" | "icon" | "pill"
  align = "right", // "left" | "right"
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const blocks = note?.blocks || [];
  const isFavorite = Boolean(note?.isFavorite);
  const title = note?.title || "Untitled Note";

  // Calculate note statistics across all block properties
  const getBlockText = (b) => {
    let text = "";
    if (b?.content) text += b.content + " ";
    if (b?.details) text += b.details + " ";
    if (b?.formula) text += b.formula + " ";
    return text.trim();
  };

  const totalChars = blocks.reduce(
    (sum, b) => sum + getBlockText(b).length,
    0
  );
  const totalWords = blocks.reduce((sum, b) => {
    const text = getBlockText(b);
    if (!text) return sum;
    const words = text.split(/\s+/).filter(Boolean);
    return sum + words.length;
  }, 0);
  const totalBlocks = blocks.length;
  const readingTimeMinutes = Math.max(1, Math.ceil(totalWords / 200));

  const handleSave = (e) => {
    e?.stopPropagation();
    onSaveNote?.(note);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleFavoriteToggle = (e) => {
    e?.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(note);
    } else if (onSaveNote) {
      onSaveNote({ ...note, isFavorite: !isFavorite });
    }
  };

  const handleOpenExportImport = (e) => {
    e?.stopPropagation();
    setIsOpen(false);
    onExportImport?.(note);
  };

  const handleDelete = (e) => {
    e?.stopPropagation();
    setIsOpen(false);
    onDeleteNote?.(note?.id);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={menuRef}>
      {/* Menu Trigger Button */}
      {variant === "icon" ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          title="Note Menu (Save, Export, Stats, Favorite)"
          className="rounded-lg p-1.5 text-ink-400 transition-all hover:bg-ink-800 hover:text-ink-100 focus:outline-none"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      ) : variant === "pill" ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-900/90 px-3 py-1 text-xs font-semibold text-ink-200 shadow-sm backdrop-blur-md transition-all hover:border-duck-500/50 hover:text-duck-300"
        >
          <MoreVertical className="h-3.5 w-3.5 text-duck-400" />
          <span>Note Menu</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-duck-500/40 bg-duck-500/10 px-3.5 py-1.5 text-xs font-semibold text-duck-300 shadow-sm transition-all hover:bg-duck-500/20 hover:text-duck-200 focus:outline-none"
        >
          <MoreVertical className="h-4 w-4" />
          <span>Note Menu</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      )}

      {/* Dropdown Menu Overlay */}
      {isOpen && (
        <div
          className={`absolute ${
            align === "left" ? "left-0" : "right-0"
          } top-full mt-1.5 z-[90] w-56 rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-2xl backdrop-blur-xl animate-fade-in space-y-1`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Note Info Header */}
          <div className="px-2.5 py-1.5 border-b border-ink-800/80 mb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-duck-400">
              Note Menu
            </p>
            <p className="text-xs font-semibold text-ink-200 truncate">
              {note?.emoji ? `${note.emoji} ` : ""}{title}
            </p>
          </div>

          {/* 1. Save Note Button */}
          <button
            type="button"
            onClick={handleSave}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-ink-200 transition-colors hover:bg-ink-800 hover:text-ink-100"
          >
            <div className="flex items-center gap-2">
              <Save className="h-4 w-4 text-emerald-400" />
              <span>Save Note</span>
            </div>
            {savedFeedback && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 animate-fade-in">
                <Check className="h-3 w-3" /> Saved
              </span>
            )}
          </button>

          {/* 2. Favorites Button */}
          <button
            type="button"
            onClick={handleFavoriteToggle}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors ${
              isFavorite
                ? "bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                : "text-ink-200 hover:bg-ink-800 hover:text-ink-100"
            }`}
          >
            <div className="flex items-center gap-2">
              <Star
                className={`h-4 w-4 ${
                  isFavorite ? "fill-amber-400 text-amber-400" : "text-amber-400/70"
                }`}
              />
              <span>{isFavorite ? "Favorited" : "Add to Favorites"}</span>
            </div>
            {isFavorite && (
              <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                ⭐ Starred
              </span>
            )}
          </button>

          {/* 3. Note Stats Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowStatsModal(!showStatsModal);
            }}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-ink-200 transition-colors hover:bg-ink-800 hover:text-ink-100"
          >
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-blue-400" />
              <span>Note Stats</span>
            </div>
            <ChevronDown
              className={`h-3.5 w-3.5 text-ink-500 transition-transform ${
                showStatsModal ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Inline Expanded Stats sub-panel */}
          {showStatsModal && (
            <div className="mx-1 my-1 rounded-lg border border-ink-750 bg-ink-950 p-2.5 text-xs space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-ink-300">
                <span className="flex items-center gap-1.5 text-ink-400">
                  <FileText className="h-3.5 w-3.5 text-blue-400" />
                  <span>Characters</span>
                </span>
                <span className="font-mono font-bold text-ink-100">
                  {totalChars.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between text-ink-300">
                <span className="flex items-center gap-1.5 text-ink-400">
                  <FileText className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Words</span>
                </span>
                <span className="font-mono font-bold text-ink-100">
                  {totalWords.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between text-ink-300">
                <span className="flex items-center gap-1.5 text-ink-400">
                  <Layers className="h-3.5 w-3.5 text-purple-400" />
                  <span>Blocks</span>
                </span>
                <span className="font-mono font-bold text-ink-100">
                  {totalBlocks.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-ink-800 pt-1.5 text-ink-300">
                <span className="flex items-center gap-1.5 text-ink-400">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <span>Read Time</span>
                </span>
                <span className="font-mono font-semibold text-ink-200">
                  ~{readingTimeMinutes} min
                </span>
              </div>
            </div>
          )}

          {/* 4. Export / Import Button */}
          <button
            type="button"
            onClick={handleOpenExportImport}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-ink-200 transition-colors hover:bg-ink-800 hover:text-ink-100"
          >
            <ArrowRightLeft className="h-4 w-4 text-cyan-400" />
            <span>Export / Import Note</span>
          </button>

          {/* 5. Delete Note Button (Optional) */}
          {onDeleteNote && (
            <div className="pt-1 border-t border-ink-800/80">
              <button
                type="button"
                onClick={handleDelete}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-rose-400 transition-colors hover:bg-rose-500/10"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Note</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

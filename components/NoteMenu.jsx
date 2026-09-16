"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useOnClickOutside } from "usehooks-ts";
import { createPortal } from "react-dom";
import {
  MoreHorizontal,
  Save,
  Star,
  Copy,
  Edit3,
  FolderInput,
  ExternalLink,
  BarChart2,
  ArrowRightLeft,
  ArrowLeftRight,
  Lock,
  Trash2,
  Check,
  ChevronDown,
  ChevronRight,
  X,
  FileText,
  Clock,
  Layers,
  Sparkles,
  ClipboardCopy,
  FilePlus2,
} from "lucide-react";
import { blocksToMarkdownLossy } from "@/lib/exportImport";

/**
 * Formats timestamps into human-readable Notion-style edit dates.
 */
function formatLastEdited(timestamp) {
  if (!timestamp) return "Just now";
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "Recently";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
    if (diffDays === 0) return `Today at ${timeStr}`;
    if (diffDays === 1) return `Yesterday at ${timeStr}`;

    return (
      date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      }) + ` at ${timeStr}`
    );
  } catch (e) {
    return "Recently";
  }
}

export const NOTE_FONTS = [
  { id: "sans", label: "Default", preview: "Ag", class: "font-note-sans", tip: "Clean & Modern" },
  { id: "serif", label: "Serif", preview: "Ag", class: "font-note-serif", tip: "Academic & Bookish" },
  { id: "mono", label: "Mono", preview: "Ag", class: "font-note-mono", tip: "Technical & STEM" },
];

export default function NoteMenu({
  note,
  spaces = [],
  mode = "document", // "document" (in-note / header) | "sidebar" (sidebar row)
  onChangeFontStyle,
  onToggleFullWidth,
  onToggleLockPage,
  onSaveNote,
  onToggleFavorite,
  onDuplicateNote,
  onMoveNote,
  onRenameNote,
  onReformatNote,
  onExportImport,
  onDeleteNote,
  onCreateSubPage,
  isReformatting = false,
  variant = "button", // "button" | "icon" | "pill"
  align = "right", // "left" | "right"
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState({
    top: 0,
    bottom: "auto",
    left: 0,
    openUpwards: false,
    maxHeight: 480,
    width: 224,
  });

  const buttonRef = useRef(null);
  const menuDropdownRef = useRef(null);
  const renameInputRef = useRef(null);

  const isSidebar = mode === "sidebar";

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute dynamic position & orientation (up vs down)
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = isSidebar ? 224 : 256; // w-56 (224px) for sidebar, w-64 (256px) for header
    const estimatedHeight = isSidebar ? 280 : 380;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpwards = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    // Horizontal placement with screen-bounds clamping
    let left = align === "left" ? rect.left : rect.right - menuWidth;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

    let top = 0;
    let bottom = "auto";
    let maxHeight = 480;

    if (openUpwards) {
      bottom = window.innerHeight - rect.top + 6;
      maxHeight = Math.min(rect.top - 16, 500);
    } else {
      top = rect.bottom + 6;
      maxHeight = Math.min(window.innerHeight - rect.bottom - 16, 500);
    }

    setMenuPos({ top, bottom, left, openUpwards, maxHeight, width: menuWidth });
  }, [align, isSidebar]);

  // Recalculate position on scroll / resize while open
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => {
        updatePosition();
      };
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
      return () => {
        window.removeEventListener("scroll", handleScrollOrResize, true);
        window.removeEventListener("resize", handleScrollOrResize);
      };
    }
  }, [isOpen, updatePosition]);

  // Close dropdown on click outside via usehooks-ts
  const handleClickOutside = () => {
    if (isOpen) {
      setIsOpen(false);
      setIsRenaming(false);
      setShowStatsModal(false);
      setShowMoveModal(false);
    }
  };
  useOnClickOutside([buttonRef, menuDropdownRef], handleClickOutside);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setIsRenaming(false);
        setShowStatsModal(false);
        setShowMoveModal(false);
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (isRenaming) {
      setRenameValue(note?.title || "");
      setTimeout(() => {
        if (renameInputRef.current) {
          renameInputRef.current.focus();
          renameInputRef.current.select();
        }
      }, 50);
    }
  }, [isRenaming, note?.title]);

  const blocks = note?.blocks || [];
  const isFavorite = Boolean(note?.isFavorite);
  const title = note?.title || "Untitled Note";
  const currentSpace = note?.spaceId || note?.space || "School";

  // Calculate note statistics across all block properties (for document mode)
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


  const handleFavoriteToggle = (e) => {
    e?.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(note);
    } else if (onSaveNote) {
      onSaveNote({ ...note, isFavorite: !isFavorite });
    }
  };

  const handleCopyContents = async (e) => {
    e?.stopPropagation();
    try {
      const noteTitle = note?.title || "Untitled Note";
      const markdownBody = blocksToMarkdownLossy(note?.blocks || []);
      const fullText = noteTitle ? `# ${noteTitle}\n\n${markdownBody}` : markdownBody;

      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullText);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = fullText;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2000);
    } catch (err) {
      console.error("Failed to copy note contents:", err);
    }
  };

  const handleDuplicate = (e) => {
    e?.stopPropagation();
    setIsOpen(false);
    if (onDuplicateNote) {
      onDuplicateNote(note);
    } else if (onSaveNote) {
      const clonedBlocks = (note?.blocks || []).map((b) => ({
        ...b,
        id: `blk_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      }));
      const duplicatedNote = {
        ...note,
        id: `n_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        title: `Copy of ${note?.title || "Untitled Note"}`,
        blocks: clonedBlocks.length > 0 ? clonedBlocks : [{ id: `blk_${Date.now()}`, type: "text", content: "" }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onSaveNote(duplicatedNote);
    }
  };

  const handleStartRename = (e) => {
    e?.stopPropagation();
    setIsRenaming(true);
    setShowStatsModal(false);
    setShowMoveModal(false);
  };

  const handleConfirmRename = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== note?.title) {
      if (onRenameNote) {
        onRenameNote(note, trimmed);
      } else if (onSaveNote) {
        onSaveNote({ ...note, title: trimmed });
      }
    }
    setIsRenaming(false);
  };

  const handleMoveToSpace = (e, targetSpaceName) => {
    e?.stopPropagation();
    if (targetSpaceName === currentSpace) return;
    setIsOpen(false);
    setShowMoveModal(false);
    if (onMoveNote) {
      onMoveNote(note, targetSpaceName);
    } else if (onSaveNote) {
      onSaveNote({ ...note, spaceId: targetSpaceName, space: targetSpaceName });
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

  // Default fallback spaces list if none provided
  const availableSpaces =
    spaces && spaces.length > 0
      ? spaces
      : [
          { name: "School", icon: "🎓" },
          { name: "Personal", icon: "🌱" },
          { name: "Misc", icon: "📦" },
          { name: "Journal", icon: "📓" },
        ];

  const handleToggleOpen = (e) => {
    e?.stopPropagation();
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
      setIsRenaming(false);
      setShowStatsModal(false);
      setShowMoveModal(false);
    } else {
      setIsOpen(false);
      setIsRenaming(false);
      setShowStatsModal(false);
      setShowMoveModal(false);
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`}>
      {/* Menu Trigger Button */}
      {variant === "icon" ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggleOpen}
          title={isSidebar ? "Page options" : "Note options"}
          className="inline-flex items-center justify-center rounded-lg border border-ink-700/80 bg-ink-850/60 p-1.5 text-ink-300 transition-all hover:border-duck-500/50 hover:bg-ink-800 hover:text-ink-100 focus:outline-none shadow-sm"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      ) : variant === "pill" ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggleOpen}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-900/90 px-3 py-1 text-xs font-semibold text-ink-200 shadow-sm backdrop-blur-md transition-all hover:border-duck-500/50 hover:text-duck-300"
        >
          <MoreHorizontal className="h-3.5 w-3.5 text-duck-400" />
          <span>{isSidebar ? "Page Menu" : "Note Menu"}</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggleOpen}
          className="inline-flex items-center gap-2 rounded-lg border border-duck-500/40 bg-duck-500/10 px-3.5 py-1.5 text-xs font-semibold text-duck-300 shadow-sm transition-all hover:bg-duck-500/20 hover:text-duck-200 focus:outline-none"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span>{isSidebar ? "Page Menu" : "Note Menu"}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      )}

      {/* Portal Dropdown Menu Overlay: Escape all parent overflow boundaries */}
      {isOpen &&
        mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuDropdownRef}
            style={{
              position: "fixed",
              top: menuPos.openUpwards ? "auto" : `${menuPos.top}px`,
              bottom: menuPos.openUpwards ? `${menuPos.bottom}px` : "auto",
              left: `${menuPos.left}px`,
              width: `${menuPos.width}px`,
              maxHeight: `${menuPos.maxHeight}px`,
              zIndex: 9999,
            }}
            className="overflow-y-auto rounded-xl border border-ink-700 bg-ink-900/95 p-1.5 shadow-2xl backdrop-blur-xl animate-fade-in space-y-0.5 ring-1 ring-ink-700/80 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Note Info Header / Inline Rename Mode */}
            <div className="px-2 py-1.5 border-b border-ink-800/80 mb-1">
              {isRenaming ? (
                <form onSubmit={handleConfirmRename} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-duck-400">
                    <span>Rename Note</span>
                    <button
                      type="button"
                      onClick={() => setIsRenaming(false)}
                      className="text-ink-500 hover:text-ink-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm shrink-0">{note?.emoji || "📝"}</span>
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          setIsRenaming(false);
                        }
                      }}
                      placeholder="Note title..."
                      className="flex-1 rounded border border-duck-500/50 bg-ink-950 px-1.5 py-0.5 text-xs text-ink-100 focus:outline-none focus:ring-1 focus:ring-duck-400"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setIsRenaming(false)}
                      className="rounded px-2 py-0.5 text-[10px] text-ink-400 hover:bg-ink-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded bg-duck-400 px-2 py-0.5 text-[10px] font-bold text-ink-950 hover:bg-duck-300"
                    >
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-duck-400 flex items-center justify-between">
                    <span>{isSidebar ? "Page Options" : "Note Menu"}</span>
                    <span className="text-ink-500 font-normal normal-case text-[10px] truncate max-w-[80px]">
                      {currentSpace}
                    </span>
                  </p>
                  <p className="text-xs font-semibold text-ink-200 truncate mt-0.5" title={title}>
                    {note?.emoji ? `${note.emoji} ` : ""}{title}
                  </p>
                </div>
              )}
            </div>

            {/* Notion-Style Typography Font Selector (In-Note Only) */}
            {!isSidebar && (
              <div className="px-2 py-1.5 border-b border-ink-800/80 mb-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1.5 flex items-center justify-between">
                  <span>Typography</span>
                  <span className="text-[9px] text-ink-500 font-normal capitalize">
                    {NOTE_FONTS.find((f) => f.id === (note?.fontStyle || "sans"))?.label || "Default"}
                  </span>
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {NOTE_FONTS.map((f) => {
                    const isSelected = (note?.fontStyle || "sans") === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onChangeFontStyle?.(f.id);
                        }}
                        title={`${f.label} (${f.tip})`}
                        className={`flex flex-col items-center justify-center rounded-lg border py-2 px-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? "border-duck-400/80 bg-duck-500/20 text-duck-300 shadow-sm ring-1 ring-duck-400/40"
                            : "border-ink-700/60 bg-ink-850/40 text-ink-300 hover:border-ink-600 hover:bg-ink-800 hover:text-ink-100"
                        }`}
                      >
                        <span className={`text-base leading-none font-semibold ${f.class}`}>{f.preview}</span>
                        <span className="text-[10px] mt-1.5 font-medium truncate w-full text-center tracking-tight">
                          {f.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Favorites Button (Both) */}
            <button
              type="button"
              onClick={handleFavoriteToggle}
              className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                isFavorite
                  ? "bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                  : "text-ink-200 hover:bg-ink-800 hover:text-ink-100"
              }`}
            >
              <div className="flex items-center gap-2">
                <Star
                  className={`h-3.5 w-3.5 ${
                    isFavorite ? "fill-amber-400 text-amber-400" : "text-amber-400/70"
                  }`}
                />
                <span>{isFavorite ? "Favorited" : "Add to Favorites"}</span>
              </div>
              {isFavorite && (
                <span className="rounded bg-amber-400/20 px-1 py-0.2 text-[9px] font-bold text-amber-300">
                  ⭐ Starred
                </span>
              )}
            </button>

            {/* 3. In-Note Only: Reformat Note (AI) */}
            {!isSidebar && onReformatNote && (
              <button
                type="button"
                disabled={isReformatting}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isReformatting) return;
                  setIsOpen(false);
                  onReformatNote?.(note);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                  isReformatting
                    ? "bg-duck-500/15 border border-duck-500/30 text-duck-200 cursor-wait"
                    : "text-duck-300 hover:bg-ink-800 hover:text-duck-200"
                }`}
                title={isReformatting ? "AI is structuring and reformatting this note..." : "Reformat Note (AI)"}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className={`h-3.5 w-3.5 text-amber-400 ${isReformatting ? "animate-spin" : ""}`} />
                  <span>{isReformatting ? "Reformatting Note..." : "Reformat Note (AI)"}</span>
                </div>
                {isReformatting && (
                  <span className="text-[10px] text-duck-400 font-bold animate-pulse">AI</span>
                )}
              </button>
            )}

            {/* 4. In-Note Only: Copy Contents Button (Right above Duplicate) */}
            {!isSidebar && (
              <button
                type="button"
                onClick={handleCopyContents}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-medium text-ink-200 transition-colors hover:bg-ink-800 hover:text-ink-100"
              >
                <div className="flex items-center gap-2">
                  <ClipboardCopy className="h-3.5 w-3.5 text-sky-400" />
                  <span>Copy Contents</span>
                </div>
                {copiedFeedback ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-sky-400 animate-fade-in">
                    <Check className="h-3 w-3" /> Copied
                  </span>
                ) : (
                  <span className="text-[10px] text-ink-500">MD</span>
                )}
              </button>
            )}

            {/* 5. Duplicate Note (Both) */}
            <button
              type="button"
              onClick={handleDuplicate}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-medium text-ink-200 transition-colors hover:bg-ink-800 hover:text-ink-100"
            >
              <div className="flex items-center gap-2">
                <Copy className="h-3.5 w-3.5 text-indigo-400" />
                <span>Duplicate</span>
              </div>
              <span className="text-[10px] text-ink-500">Copy</span>
            </button>

            {/* 5b. New nested sub-page inside this note (Both) */}
            {onCreateSubPage && (
              <button
                type="button"
                data-testid="note-menu-new-subpage"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onCreateSubPage(note);
                }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-medium text-ink-200 transition-colors hover:bg-ink-800 hover:text-ink-100"
                title="Create a blank page nested inside this note"
              >
                <div className="flex items-center gap-2">
                  <FilePlus2 className="h-3.5 w-3.5 text-duck-400" />
                  <span>New sub-page</span>
                </div>
                <span className="text-[10px] text-ink-500">Nested</span>
              </button>
            )}

            {/* 5. Sidebar Only: Rename Note */}
            {isSidebar && (
              <button
                type="button"
                onClick={handleStartRename}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-ink-200 transition-colors hover:bg-ink-800 hover:text-ink-100"
              >
                <Edit3 className="h-3.5 w-3.5 text-amber-400" />
                <span>Rename</span>
              </button>
            )}

            {/* 6. Move to Space (Both) */}
            <div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMoveModal(!showMoveModal);
                  setShowStatsModal(false);
                  setIsRenaming(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-medium text-ink-200 transition-colors hover:bg-ink-800 hover:text-ink-100"
              >
                <div className="flex items-center gap-2">
                  <FolderInput className="h-3.5 w-3.5 text-teal-400" />
                  <span>Move to Space</span>
                </div>
                <ChevronRight
                  className={`h-3.5 w-3.5 text-ink-500 transition-transform ${
                    showMoveModal ? "rotate-90" : ""
                  }`}
                />
              </button>

              {/* Inline Spaces Sub-Menu */}
              {showMoveModal && (
                <div className="mx-0.5 my-1 rounded-lg border border-ink-750 bg-ink-950 p-1 text-xs space-y-0.5 animate-fade-in">
                  <p className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-500">
                    Select Space
                  </p>
                  {availableSpaces.map((sp) => {
                    const isCurrent = sp.name === currentSpace;
                    return (
                      <button
                        key={sp.name}
                        type="button"
                        disabled={isCurrent}
                        onClick={(e) => handleMoveToSpace(e, sp.name)}
                        className={`flex w-full items-center justify-between rounded-md px-1.5 py-1 text-left text-xs transition-colors ${
                          isCurrent
                            ? "bg-ink-850/50 text-ink-400 font-semibold cursor-default"
                            : "text-ink-200 hover:bg-ink-800 hover:text-duck-300"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-sm leading-none shrink-0">{sp.icon || "📂"}</span>
                          <span className="truncate text-xs">{sp.name}</span>
                        </div>
                        {isCurrent && (
                          <span className="text-[9px] text-duck-400 font-medium shrink-0">
                            Current
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notion-Style Page Toggles: Full width & Lock page (In-Note Only, under Move to Space) */}
            {!isSidebar && (
              <div className="py-1 border-t border-ink-800/80 my-1 space-y-0.5">
                {/* Full width Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newFullWidth = !Boolean(note?.fullWidth);
                    onToggleFullWidth?.(newFullWidth);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-medium text-ink-200 transition-colors hover:bg-ink-800 hover:text-ink-100 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-3.5 w-3.5 text-amber-400" />
                    <span>Full width</span>
                  </div>
                  <div
                    className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                      note?.fullWidth ? "bg-duck-400" : "bg-ink-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-ink-950 transition-transform ${
                        note?.fullWidth ? "translate-x-3.5" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </button>

                {/* Lock page Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newLocked = !Boolean(note?.isLocked);
                    onToggleLockPage?.(newLocked);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-medium text-ink-200 transition-colors hover:bg-ink-800 hover:text-ink-100 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Lock className={`h-3.5 w-3.5 ${note?.isLocked ? "text-duck-400" : "text-ink-400"}`} />
                    <span>Lock page</span>
                  </div>
                  <div
                    className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                      note?.isLocked ? "bg-duck-400" : "bg-ink-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-ink-950 transition-transform ${
                        note?.isLocked ? "translate-x-3.5" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </button>
              </div>
            )}


            {/* 8. In-Note Only: Export / Import Button */}
            {!isSidebar && (
              <button
                type="button"
                onClick={handleOpenExportImport}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-ink-200 transition-colors hover:bg-ink-800 hover:text-ink-100"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 text-cyan-400" />
                <span>Export / Import Note</span>
              </button>
            )}

            {/* 9. Delete Note Button (Both) */}
            {onDeleteNote && (
              <div className="pt-0.5 border-t border-ink-800/80">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-rose-400 transition-colors hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Note</span>
                </button>
              </div>
            )}

            {/* 10. In-Note Only: Note Stats Button (at the bottom, after Delete Note) */}
            {!isSidebar && (
              <div className="pt-0.5 border-t border-ink-800/80">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStatsModal(!showStatsModal);
                    setShowMoveModal(false);
                    setIsRenaming(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-medium text-ink-200 transition-colors hover:bg-ink-800 hover:text-ink-100"
                >
                  <div className="flex items-center gap-2">
                    <BarChart2 className="h-3.5 w-3.5 text-blue-400" />
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
                  <div className="mx-0.5 my-1 rounded-lg border border-ink-750 bg-ink-950 p-2 text-xs space-y-1.5 animate-fade-in">
                    <div className="flex items-center justify-between text-ink-300 text-[11px]">
                      <span className="flex items-center gap-1.5 text-ink-400">
                        <FileText className="h-3 w-3 text-blue-400" />
                        <span>Characters</span>
                      </span>
                      <span className="font-mono font-bold text-ink-100">
                        {totalChars.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-ink-300 text-[11px]">
                      <span className="flex items-center gap-1.5 text-ink-400">
                        <FileText className="h-3 w-3 text-emerald-400" />
                        <span>Words</span>
                      </span>
                      <span className="font-mono font-bold text-ink-100">
                        {totalWords.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-ink-300 text-[11px]">
                      <span className="flex items-center gap-1.5 text-ink-400">
                        <Layers className="h-3 w-3 text-purple-400" />
                        <span>Blocks</span>
                      </span>
                      <span className="font-mono font-bold text-ink-100">
                        {totalBlocks.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-ink-800 pt-1 text-ink-300 text-[11px]">
                      <span className="flex items-center gap-1.5 text-ink-400">
                        <Clock className="h-3 w-3 text-amber-400" />
                        <span>Read Time</span>
                      </span>
                      <span className="font-mono font-semibold text-ink-200">
                        ~{readingTimeMinutes} min
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 11. Last Date and Time Edited (Bottom Footer) */}
            <div className="pt-1 mt-0.5 border-t border-ink-800/80 px-2 py-0.5">
              <div className="flex items-center gap-1 text-[10px] text-ink-400">
                <Clock className="h-3 w-3 text-ink-500 shrink-0" />
                <span className="truncate">
                  Edited {formatLastEdited(note?.updatedAt || note?.createdAt)}
                </span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}




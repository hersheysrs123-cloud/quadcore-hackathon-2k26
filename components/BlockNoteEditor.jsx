"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── BlockNoteEditor ────────────────────────────────────────────────
// Full Notion-style block suite:
//   • Headings 1–4 (h1, h2, h3, h4)
//   • Bullet List, Numbered List, To-Do List (checkboxes), Toggle List
//   • Callout Box with icon picker (💡, ⚠️, 📌, 🔥, ⭐, 🎉, ℹ️, 🦆)
//   • Quote (accent bar), Divider (hr), Note Link (workspace note picker)
//   • Media Embeds (Image / Audio / Video) & Clickable Site Bookmark Embeds
//   • 6-dots (⠿) context menu: Explain / Quiz, formatting (B, I, U, S), turn-into
// ─────────────────────────────────────────────────────────────────────

const BLOCK_TYPES = [
  { type: "text", label: "Text", icon: "Aa", description: "Plain text paragraph" },
  { type: "h1", label: "Heading 1", icon: "H1", description: "Large section heading" },
  { type: "h2", label: "Heading 2", icon: "H2", description: "Medium section heading" },
  { type: "h3", label: "Heading 3", icon: "H3", description: "Small section heading" },
  { type: "h4", label: "Heading 4", icon: "H4", description: "Sub-heading" },
  { type: "bullet", label: "Bullet List", icon: "•", description: "Bulleted list item" },
  { type: "number", label: "Numbered List", icon: "1.", description: "Numbered list item" },
  { type: "todo", label: "To-Do List", icon: "☑", description: "Track tasks with a checkbox" },
  { type: "toggle", label: "Toggle List", icon: "▶", description: "Collapsible text container" },
  { type: "callout", label: "Callout Box", icon: "💡", description: "Highlighted callout frame" },
  { type: "quote", label: "Quote", icon: "“", description: "Capture quotes & citations" },
  { type: "divider", label: "Divider", icon: "―", description: "Visual horizontal line" },
  { type: "notelink", label: "Note Link", icon: "🔗", description: "Link to another note" },
  { type: "site", label: "Site Bookmark Embed", icon: "🌐", description: "Clickable website card" },
  { type: "media", label: "Image / Audio / Video", icon: "🖼️", description: "Embed media file or URL" },
  { type: "code", label: "Code Snippet", icon: "</>", description: "Code block with syntax" },
  { type: "action", label: "Action Button", icon: "▶", description: "Clickable action block" },
  { type: "canvas", label: "Canvas / Drawing", icon: "🎨", description: "Interactive 70% whiteboard & sketching tool" },
];

const BANNER_PRESETS = [
  { id: "cyber", label: "Cyberpunk", style: "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600" },
  { id: "sunset", label: "Sunset Amber", style: "bg-gradient-to-r from-amber-500 via-orange-600 to-red-600" },
  { id: "ocean", label: "Ocean Teal", style: "bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600" },
  { id: "midnight", label: "Midnight Blue", style: "bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900" },
  { id: "gold", label: "Socratic Gold", style: "bg-gradient-to-r from-yellow-400 via-amber-500 to-amber-600" },
];

const CALLOUT_ICONS = ["💡", "⚠️", "📌", "🔥", "⭐", "🎉", "ℹ️", "🦆"];

const NOTE_EMOJIS = [
  "📝", "🎓", "💡", "🚀", "📚", "💻", "🎨", "⚡",
  "🦆", "🔥", "⭐", "🎯", "📌", "✨", "🧪", "🧠",
  "🏆", "🌱", "💬", "🌐", "⚙️", "🔮", "💎", "📜"
];

function formatUrl(url) {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function makeId() {
  return `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createBlock(type = "text", content = "") {
  return { id: makeId(), type, content };
}

// ─── Slash-Command Menu ─────────────────────────────────────────────
function SlashMenu({ onSelect, onClose, filter }) {
  const menuRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const filtered = BLOCK_TYPES.filter((bt) =>
    bt.label.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    setActiveIdx(0);
  }, [filter]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[activeIdx]) onSelect(filtered[activeIdx].type);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIdx, filtered, onSelect, onClose]);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-2xl animate-fade-in"
    >
      <p className="border-b border-ink-800 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-500">
        Block type
      </p>
      <ul className="max-h-56 overflow-y-auto py-1">
        {filtered.map((bt, i) => (
          <li key={bt.type}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(bt.type);
              }}
              onMouseEnter={() => setActiveIdx(i)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                i === activeIdx
                  ? "bg-ink-800 text-ink-100"
                  : "text-ink-400 hover:bg-ink-850"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                  i === activeIdx
                    ? "bg-duck-500/20 text-duck-300"
                    : "bg-ink-850 text-ink-500"
                }`}
              >
                {bt.icon}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{bt.label}</p>
                <p className="truncate text-[11px] text-ink-500">{bt.description}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Notion 6-Dots Block Context Menu ───────────────────────────────
function BlockContextMenu({
  block,
  onClose,
  onChangeType,
  onDelete,
  onExplainBlock,
  onQuizBlock,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [onClose]);

  function applyFormat(command) {
    document.execCommand(command, false, null);
  }

  return (
    <div
      ref={menuRef}
      className="absolute -left-2 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-2xl animate-fade-in p-2 text-xs"
    >
      {/* Study this block specifically: explained, or tested. Both scope to
          the block's text but still send the whole note as context. */}
      {(onExplainBlock || onQuizBlock) && (
        <div className="mb-1.5 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={!block.content?.trim()}
            onClick={() => {
              onExplainBlock?.(block.content);
              onClose();
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-ink-700 px-2 py-2 font-medium text-ink-200 transition-colors hover:border-duck-500/50 hover:text-duck-300 disabled:opacity-30"
          >
            <span>✨</span>
            <span>Explain</span>
          </button>
          <button
            type="button"
            disabled={!block.content?.trim()}
            onClick={() => {
              onQuizBlock?.(block.content);
              onClose();
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-ink-700 px-2 py-2 font-medium text-ink-200 transition-colors hover:border-duck-500/50 hover:text-duck-300 disabled:opacity-30"
          >
            <span>🦆</span>
            <span>Quiz me</span>
          </button>
        </div>
      )}

      <div className="my-2 flex items-center justify-around rounded-lg border border-ink-800 bg-ink-850 p-1.5">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            applyFormat("bold");
          }}
          className="rounded px-2 py-1 font-bold text-ink-200 hover:bg-ink-800"
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            applyFormat("italic");
          }}
          className="rounded px-2 py-1 italic text-ink-200 hover:bg-ink-800"
          title="Italic"
        >
          I
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            applyFormat("underline");
          }}
          className="rounded px-2 py-1 underline text-ink-200 hover:bg-ink-800"
          title="Underline"
        >
          U
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            applyFormat("strikethrough");
          }}
          className="rounded px-2 py-1 line-through text-ink-200 hover:bg-ink-800"
          title="Strikethrough"
        >
          S
        </button>
      </div>

      <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
        Turn into
      </p>
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {BLOCK_TYPES.map((bt) => (
          <button
            key={bt.type}
            type="button"
            onClick={() => {
              onChangeType(block.id, bt.type);
              onClose();
            }}
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
              block.type === bt.type
                ? "bg-duck-500/20 text-duck-300 font-semibold"
                : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"
            }`}
          >
            <span className="w-5 text-center font-bold text-ink-400">{bt.icon}</span>
            <span>{bt.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-2 border-t border-ink-800/80 pt-1.5">
        <button
          type="button"
          onClick={() => {
            onDelete(block.id);
            onClose();
          }}
          className="flex w-full items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/15 px-2.5 py-1.5 text-left text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/25"
        >
          <span>🗑️</span>
          <span>Delete Block</span>
        </button>
      </div>
    </div>
  );
}

const ACTION_KINDS = [
  { id: "socratic", label: "Rubber Duck Drill", icon: "🦆", badge: "Duck", description: "Examine understanding with Duck" },
  { id: "quiz", label: "Fast Recall Quiz", icon: "⚡", badge: "Quiz", description: "Generate instant quiz questions" },
  { id: "explain", label: "Explain Concept", icon: "✨", badge: "Explain", description: "Get Socratic breakdown of idea" },
  { id: "3d", label: "3D Visualization", icon: "🧊", badge: "3D Studio", description: "Switch to 3D concept models" },
  { id: "calendar", label: "Study Timer & Calendar", icon: "📅", badge: "Timer", description: "Open Pomodoro timer & events" },
  { id: "mastery", label: "Mastery Dashboard", icon: "📊", badge: "Mastery", description: "View confidence & gap heatmap" },
];

// ─── Single Block Component ─────────────────────────────────────────
function EditorBlock({
  block,
  blockNumber,
  isLast,
  isSelected,
  onSelect,
  onChange,
  onChangeType,
  onUpdateBlock,
  onDelete,
  onKeyDown,
  onAddAfter,
  onExplainBlock,
  onQuizBlock,
  onTriggerSocratic,
  onSwitchTab,
  notesBySpace = {},
  onSelectNote,
  registerRef,
  onSaveNote,
  dragHandlers,
  isDragTarget,
}) {
  const contentRef = useRef(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  // The block only becomes draggable while the ⠿ handle is held. Making the
  // whole row draggable would hijack text selection inside contentEditable.
  const [handleHeld, setHandleHeld] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showNotePicker, setShowNotePicker] = useState(false);
  const [showCanvasModal, setShowCanvasModal] = useState(false);
  const [showActionPicker, setShowActionPicker] = useState(false);

  function handleExecuteAction(actBlock) {
    const kind = actBlock.actionKind || "socratic";
    const textTarget = actBlock.content || "Socratic Concept";
    if (kind === "socratic") {
      onTriggerSocratic?.(textTarget);
    } else if (kind === "quiz") {
      onQuizBlock?.(textTarget);
    } else if (kind === "explain") {
      onExplainBlock?.(textTarget);
    } else if (kind === "3d") {
      onSwitchTab?.("3d");
    } else if (kind === "calendar") {
      onSwitchTab?.("calendar");
    } else if (kind === "mastery") {
      onSwitchTab?.("mastery");
    }
  }

  useEffect(() => {
    if (registerRef) registerRef(block.id, contentRef);
  }, [block.id, registerRef]);

  useEffect(() => {
    if (
      contentRef.current &&
      contentRef.current.textContent !== block.content
    ) {
      contentRef.current.textContent = block.content;
    }
  }, [block.id, block.type]);

  function handleInput() {
    const text = contentRef.current?.textContent ?? "";
    onChange(block.id, text);

    if (text.startsWith("/")) {
      setSlashOpen(true);
      setSlashFilter(text.slice(1));
    } else {
      setSlashOpen(false);
      setSlashFilter("");
    }
  }

  function handleSlashSelect(type) {
    onChange(block.id, "");
    if (contentRef.current) {
      contentRef.current.textContent = "";
    }
    onChangeType(block.id, type);
    setSlashOpen(false);
    setSlashFilter("");
    setTimeout(() => contentRef.current?.focus(), 20);
  }

  function handleKeyDown(e) {
    if (slashOpen && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter")) {
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && block.type !== "code") {
      e.preventDefault();
      onAddAfter(block.id);
      return;
    }

    onKeyDown?.(e, block.id, contentRef.current);
  }

  const typeStyles = {
    text: "text-[15px] leading-relaxed text-ink-200",
    h1: "text-3xl font-extrabold tracking-tight leading-snug text-ink-100 pt-3 pb-1.5 my-1.5",
    h2: "text-2xl font-bold tracking-tight leading-snug text-ink-100 pt-2.5 pb-1 my-1",
    h3: "text-xl font-semibold leading-snug text-ink-100 pt-2 pb-0.5 my-0.5",
    h4: "text-base font-semibold leading-normal text-ink-100 pt-1 pb-0.5",
    bullet: "text-[15px] leading-relaxed text-ink-200",
    number: "text-[15px] leading-relaxed text-ink-200",
    todo: "text-[15px] leading-relaxed text-ink-200",
    toggle: "text-[15px] leading-relaxed text-ink-200",
    quote: "text-[15px] leading-relaxed text-ink-300 italic",
    code: "font-mono text-sm leading-relaxed text-emerald-400 bg-ink-850 rounded-lg px-4 py-3 border border-ink-700 whitespace-pre-wrap code-block",
    action: "",
  };

  const placeholders = {
    text: isLast ? "Type something, or press '/' for commands…" : "",
    h1: "Heading 1",
    h2: "Heading 2",
    h3: "Heading 3",
    h4: "Heading 4",
    bullet: "List item",
    number: "Numbered item",
    todo: "To-do item",
    toggle: "Toggle heading…",
    callout: "Callout text…",
    quote: "Quote or citation…",
    code: "Write code…",
    action: "Button label…",
  };

  const Tag =
    block.type === "h1"
      ? "h1"
      : block.type === "h2"
        ? "h2"
        : block.type === "h3"
          ? "h3"
          : block.type === "h4"
            ? "h4"
            : "div";

  // Flatten all notes from notesBySpace for Note Link picker
  const allNotes = Object.entries(notesBySpace).flatMap(([space, notes]) =>
    (notes || []).map((n) => ({ ...n, space }))
  );

  return (
    <div
      className={`group relative rounded-lg px-2.5 py-1.5 transition-colors ${
        isSelected ? "bg-ink-900/60" : "hover:bg-ink-900/30"
      } ${
        isDragTarget
          ? "before:absolute before:-top-px before:left-0 before:h-0.5 before:w-full before:rounded-full before:bg-duck-400"
          : ""
      }`}
      onClick={() => onSelect(block.id)}
      draggable={handleHeld}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        dragHandlers?.onDragStart(block.id);
      }}
      onDragOver={(e) => {
        if (!dragHandlers?.dragging) return;
        e.preventDefault();
        dragHandlers.onDragOver(block.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setHandleHeld(false);
        dragHandlers?.onDrop();
      }}
      onDragEnd={() => {
        setHandleHeld(false);
        dragHandlers?.onDragEnd();
      }}
    >
      {/* Properly Aligned Controls */}
      <div className="absolute -left-14 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(block.id);
          }}
          title="Delete Block"
          className="rounded p-1 text-xs text-rose-400/90 transition-colors hover:bg-rose-500/20 hover:text-rose-300"
        >
          🗑️
        </button>
        <button
          type="button"
          onMouseDown={() => setHandleHeld(true)}
          onMouseUp={() => setHandleHeld(false)}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          title="Drag to move · click for block menu"
          className="cursor-grab rounded p-1 text-xs text-ink-500 transition-colors hover:bg-ink-800 hover:text-duck-300 active:cursor-grabbing"
        >
          ⠿
        </button>
      </div>

      {menuOpen && (
        <BlockContextMenu
          block={block}
          onClose={() => setMenuOpen(false)}
          onChangeType={onChangeType}
          onDelete={onDelete}
          onExplainBlock={onExplainBlock}
          onQuizBlock={onQuizBlock}
        />
      )}

      {/* ─── Render Specific Block Types ─────────────────── */}

      {/* 1. Divider */}
      {block.type === "divider" ? (
        <div className="py-2">
          <hr className="border-t border-ink-800" />
        </div>
      ) : block.type === "action" ? (
        /* 2. Interactive Action Button */
        <div className="relative flex items-center gap-2 my-1">
          <div className="group/btn relative flex items-center rounded-xl border border-duck-500/40 bg-duck-500/10 p-1 shadow-sm transition-all hover:bg-duck-500/20 hover:border-duck-500/60">
            {/* Clickable Icon & Badge Button to trigger action */}
            <button
              type="button"
              onClick={() => handleExecuteAction(block)}
              className="flex items-center gap-1.5 rounded-lg bg-duck-500/20 px-3 py-1.5 text-xs font-bold text-duck-300 transition-all active:scale-95 hover:bg-duck-500/35 hover:text-duck-100 shadow-sm"
              title={`Click to execute action: ${(ACTION_KINDS.find(a => a.id === (block.actionKind || "socratic")) || ACTION_KINDS[0]).label}`}
            >
              <span className="text-sm">{(ACTION_KINDS.find(a => a.id === (block.actionKind || "socratic")) || ACTION_KINDS[0]).icon}</span>
              <span className="uppercase tracking-wider text-[10px] text-duck-400 font-extrabold">
                {(ACTION_KINDS.find(a => a.id === (block.actionKind || "socratic")) || ACTION_KINDS[0]).badge}
              </span>
            </button>

            {/* Editable Action Button Text Label */}
            <Tag
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={() => onSelect(block.id)}
              data-placeholder={placeholders.action}
              className="min-w-[6rem] px-3 py-1 text-sm font-semibold text-ink-100 outline-none empty:before:text-duck-500/50 empty:before:content-[attr(data-placeholder)]"
            />

            {/* Action Kind Picker Settings Dropdown Button */}
            <div className="relative ml-auto pr-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActionPicker(!showActionPicker);
                }}
                className="rounded-md p-1.5 text-xs text-ink-400 hover:bg-ink-800 hover:text-ink-100 transition-colors"
                title="Choose Action Type (Quiz, Duck, 3D, Timer, etc.)"
              >
                ⚙️
              </button>

              {showActionPicker && (
                <div className="absolute right-0 top-8 z-50 w-56 rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-2xl space-y-1 animate-fade-in text-xs">
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    Select Action Target
                  </p>
                  {ACTION_KINDS.map((ak) => (
                    <button
                      key={ak.id}
                      type="button"
                      onClick={() => {
                        onUpdateBlock(block.id, { actionKind: ak.id });
                        setShowActionPicker(false);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                        (block.actionKind || "socratic") === ak.id
                          ? "bg-duck-500/20 text-duck-300 font-semibold"
                          : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                      }`}
                    >
                      <span className="text-sm">{ak.icon}</span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{ak.label}</p>
                        <p className="truncate text-[10px] text-ink-500">{ak.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : block.type === "bullet" ? (
        /* 3. Bullet List */
        <div className="flex items-start gap-2.5">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-400" />
          <Tag
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => onSelect(block.id)}
            data-placeholder={placeholders.bullet}
            className={`min-h-[1.5em] flex-1 outline-none ${typeStyles.bullet} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)]`}
          />
        </div>
      ) : block.type === "number" ? (
        /* 4. Numbered List */
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 w-5 font-mono text-sm font-semibold text-ink-400">
            {blockNumber || 1}.
          </span>
          <Tag
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => onSelect(block.id)}
            data-placeholder={placeholders.number}
            className={`min-h-[1.5em] flex-1 outline-none ${typeStyles.number} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)]`}
          />
        </div>
      ) : block.type === "todo" ? (
        /* 5. To-Do List */
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={Boolean(block.checked)}
            onChange={(e) => onUpdateBlock(block.id, { checked: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-ink-700 bg-ink-850 text-duck-400 focus:ring-0 cursor-pointer"
          />
          <Tag
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => onSelect(block.id)}
            data-placeholder={placeholders.todo}
            className={`min-h-[1.5em] flex-1 outline-none ${typeStyles.todo} ${
              block.checked ? "line-through text-ink-500" : ""
            } empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)]`}
          />
        </div>
      ) : block.type === "toggle" ? (
        /* 6. Toggle / Collapsible Dropdown Block */
        <div className="my-1 rounded-xl border border-ink-800 bg-ink-900/60 p-2.5 shadow-sm space-y-2 transition-all">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdateBlock(block.id, { open: block.open === false ? true : false })}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-ink-700 bg-ink-850 text-xs font-bold text-duck-400 transition-transform active:scale-95 hover:border-duck-500/40 hover:bg-duck-500/10"
              title="Toggle Dropdown Section"
            >
              {block.open === false ? "▶" : "▼"}
            </button>
            <Tag
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={() => onSelect(block.id)}
              data-placeholder={placeholders.toggle}
              className={`min-h-[1.5em] flex-1 font-semibold text-ink-100 outline-none ${typeStyles.toggle} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)]`}
            />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 px-2 py-0.5 rounded border border-ink-800 bg-ink-950">
              {block.open === false ? "Collapsed" : "Expanded"}
            </span>
          </div>

          {block.open !== false && (
            <div className="ml-7 rounded-lg border-l-2 border-duck-500/40 bg-ink-850/70 p-3 text-xs leading-relaxed text-ink-200 animate-fade-in">
              <textarea
                value={block.details ?? block.toggleContent ?? ""}
                onChange={(e) => onUpdateBlock(block.id, { details: e.target.value })}
                placeholder="Add collapsible details, deep dive text, or code breakdown here..."
                rows={3}
                className="w-full bg-transparent font-sans text-xs text-ink-200 placeholder:text-ink-600 focus:outline-none resize-y min-h-[3rem]"
              />
            </div>
          )}
        </div>
      ) : block.type === "callout" ? (
        /* 7. Callout Box */
        <div className="relative rounded-xl border border-ink-700 bg-ink-850/90 p-3.5 shadow-md flex items-start gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="text-lg leading-none p-1 rounded hover:bg-ink-800"
            >
              {block.calloutIcon || "💡"}
            </button>

            {showIconPicker && (
              <div className="absolute left-0 top-8 z-50 flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-900 p-1.5 shadow-2xl">
                {CALLOUT_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => {
                      onUpdateBlock(block.id, { calloutIcon: icon });
                      setShowIconPicker(false);
                    }}
                    className="p-1 text-base hover:bg-ink-800 rounded"
                  >
                    {icon}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Tag
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => onSelect(block.id)}
            data-placeholder={placeholders.callout}
            className={`min-h-[1.5em] flex-1 outline-none ${typeStyles.text} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)]`}
          />
        </div>
      ) : block.type === "quote" ? (
        /* 8. Quote */
        <div className="border-l-4 border-duck-400 pl-4 py-1 italic">
          <Tag
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => onSelect(block.id)}
            data-placeholder={placeholders.quote}
            className={`min-h-[1.5em] outline-none ${typeStyles.quote} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)]`}
          />
        </div>
      ) : block.type === "notelink" ? (
        /* 9. Note Link Embed */
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => setShowNotePicker(!showNotePicker)}
            className="inline-flex items-center gap-2 rounded-lg border border-duck-500/30 bg-duck-500/10 px-3 py-1.5 text-xs font-semibold text-duck-300 transition-colors hover:bg-duck-500/20"
          >
            <span>🔗</span>
            <span>{block.targetNoteTitle ? `Link: ${block.targetNoteTitle}` : "Select Note to Link..."}</span>
          </button>

          {showNotePicker && (
            <div className="absolute left-0 top-9 z-50 w-64 max-h-56 overflow-y-auto rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-2xl space-y-1">
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                Link Workspace Note
              </p>
              {allNotes.length === 0 ? (
                <p className="px-2 py-1 text-xs text-ink-500 italic">No notes found.</p>
              ) : (
                allNotes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      onUpdateBlock(block.id, { targetNoteId: n.id, targetNoteTitle: n.title });
                      setShowNotePicker(false);
                      onSelectNote?.(n);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-ink-200 hover:bg-ink-800"
                  >
                    <span className="truncate font-medium">{n.title || "Untitled Note"}</span>
                    <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-500">{n.space}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      ) : block.type === "site" ? (
        /* 10. Site Bookmark Embed */
        <div className="rounded-xl border border-ink-700 bg-ink-850 p-4 shadow-lg space-y-3">
          {!block.url ? (
            <div className="flex items-center gap-2">
              <span className="text-lg">🌐</span>
              <input
                type="url"
                placeholder="Paste website URL (e.g. google.com or https://wikipedia.org) and press Enter…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.target.value.trim()) {
                    onUpdateBlock(block.id, { url: e.target.value.trim() });
                  }
                }}
                className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-1.5 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500 focus:outline-none"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-900 p-3.5 transition-all hover:border-duck-500/40 group">
              <a
                href={formatUrl(block.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 min-w-0 pr-4 flex-1"
              >
                <img
                  src={`https://www.google.com/s2/favicons?domain=${formatUrl(block.url)}&sz=64`}
                  alt="favicon"
                  className="h-6 w-6 shrink-0 rounded"
                  onError={(e) => (e.target.style.display = "none")}
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink-100 truncate group-hover:text-duck-300">
                    {block.url}
                  </p>
                  <p className="text-[11px] text-ink-500 truncate">{formatUrl(block.url)}</p>
                </div>
              </a>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onUpdateBlock(block.id, { url: "" })}
                  className="rounded bg-ink-850 px-2 py-1 text-[11px] font-medium text-ink-400 hover:bg-ink-700 hover:text-ink-100 transition-colors"
                  title="Change URL"
                >
                  ✏️ Change URL
                </button>
                <a
                  href={formatUrl(block.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-ink-500 hover:text-duck-300"
                >
                  ↗
                </a>
              </div>
            </div>
          )}
        </div>
      ) : block.type === "media" ? (
        /* 11. Image / Audio / Video Embed */
        <div className="rounded-xl border border-ink-700 bg-ink-850 p-4 shadow-lg space-y-3">
          {!block.url ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-ink-400">
                <span>Select media type:</span>
                {["image", "audio", "video"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onUpdateBlock(block.id, { mediaKind: m })}
                    className={`rounded px-2 py-0.5 text-[10px] uppercase font-bold transition-all ${
                      (block.mediaKind || "image") === m
                        ? "bg-duck-500/20 text-duck-300 border border-duck-500/40"
                        : "bg-ink-800 text-ink-400"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <input
                type="url"
                placeholder="Paste media URL and press Enter…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.target.value.trim()) {
                    onUpdateBlock(block.id, { url: e.target.value.trim() });
                  }
                }}
                className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-1.5 text-xs text-ink-100 placeholder:text-ink-600 focus:border-duck-500 focus:outline-none"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">
                  {block.mediaKind || "image"} preview
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateBlock(block.id, { url: "" })}
                  className="rounded bg-ink-800 px-2.5 py-1 text-xs text-ink-300 hover:bg-ink-700 hover:text-ink-100 transition-colors"
                >
                  ✏️ Change URL
                </button>
              </div>
              {block.mediaKind === "audio" ? (
                <audio src={formatUrl(block.url)} controls className="w-full" />
              ) : block.mediaKind === "video" ? (
                <video src={formatUrl(block.url)} controls className="w-full max-h-96 rounded-xl border border-ink-800" />
              ) : (
                <img src={formatUrl(block.url)} alt="media" className="w-full max-h-96 rounded-xl object-cover border border-ink-800 shadow" />
              )}
            </div>
          )}
        </div>
      ) : block.type === "canvas" ? (
        /* 12. Canvas / Drawing Block */
        <div className="rounded-xl border border-ink-700 bg-ink-850 p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 pr-3">
              <span className="text-lg">🎨</span>
              <input
                type="text"
                value={block.content || ""}
                onChange={(e) => onUpdateBlock(block.id, { content: e.target.value })}
                placeholder="Canvas Drawing Title..."
                className="w-full bg-transparent text-sm font-semibold text-ink-100 outline-none placeholder:text-ink-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowCanvasModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-duck-500/40 bg-duck-500/15 px-3 py-1.5 text-xs font-bold text-duck-300 transition-all hover:bg-duck-500/25 hover:scale-105"
            >
              <span>🔍</span>
              <span>Open Drawing (85% Screen)</span>
            </button>
          </div>

          <div
            onClick={() => setShowCanvasModal(true)}
            className={`relative min-h-[160px] w-full cursor-pointer rounded-xl border border-dashed border-ink-700 p-4 transition-all hover:border-duck-500/50 group flex flex-col items-center justify-center ${
              (block.bgType || "dots") === "dots"
                ? "bg-[radial-gradient(#38bdf8_1.5px,transparent_1.5px)] [background-size:18px_18px] bg-ink-950"
                : "bg-ink-950"
            }`}
          >
            {block.drawingData ? (
              <img
                src={block.drawingData}
                alt="Canvas drawing preview"
                className="max-h-60 w-auto object-contain rounded-lg shadow-md"
              />
            ) : (
              <div className="text-center space-y-2 p-6">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-duck-500/10 text-duck-300 text-2xl group-hover:scale-110 transition-transform">
                  🎨
                </div>
                <p className="text-xs font-semibold text-ink-200">Interactive Whiteboard & Canvas</p>
                <p className="text-[11px] text-ink-500">Click to expand to 85% screen drawing workspace</p>
              </div>
            )}

            <div className="absolute bottom-2 right-2 rounded bg-ink-900/80 px-2 py-0.5 text-[10px] font-semibold text-ink-400 border border-ink-700">
              {(block.bgType || "dots") === "dots" ? "••• Dotted Grid" : "Plain Canvas"}
            </div>
          </div>

          {showCanvasModal && (
            <CanvasModal
              drawingData={block.drawingData}
              bgType={block.bgType || "dots"}
              title={block.content || "Canvas Drawing"}
              onSave={(newData, newBg) => {
                onUpdateBlock(block.id, { drawingData: newData, bgType: newBg }, true);
                setShowCanvasModal(false);
              }}
              onClose={() => setShowCanvasModal(false)}
            />
          )}
        </div>
      ) : (
        /* Standard Paragraph & Code Blocks */
        <Tag
          ref={contentRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => onSelect(block.id)}
          data-placeholder={placeholders[block.type] ?? ""}
          className={`min-h-[1.5em] outline-none ${typeStyles[block.type] ?? typeStyles.text} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)]`}
        />
      )}

      {/* Slash Menu pops up directly below current block */}
      {slashOpen && (
        <SlashMenu
          onSelect={handleSlashSelect}
          onClose={() => {
            setSlashOpen(false);
            setSlashFilter("");
          }}
          filter={slashFilter}
        />
      )}
    </div>
  );
}

// ─── Canvas Modal (85% Screen Drawing Workspace) ────────────────────
function CanvasModal({ drawingData, bgType: initialBgType, title, onSave, onClose }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [bgType, setBgType] = useState(initialBgType || "dots");
  const [color, setColor] = useState("#3B82F6");
  const [tool, setTool] = useState("pen");
  const [lastNonRulerTool, setLastNonRulerTool] = useState("pen");
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [currentPos, setCurrentPos] = useState(null);
  const [mousePos, setMousePos] = useState(null);
  const [lastPoint, setLastPoint] = useState(null);

  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const [eraserSize, setEraserSize] = useState(24);
  const [penSize, setPenSize] = useState(4);
  const [measureInfo, setMeasureInfo] = useState(null);

  const COLORS = [
    "#FFFFFF",
    "#F59E0B",
    "#3B82F6",
    "#EF4444",
    "#10B981",
    "#A855F7",
    "#06B6D4",
    "#F97316",
    "#EAB308",
    "#64748B",
  ];

  const TOOLS = [
    { id: "pen", label: "Pen", icon: "🖊️", opacity: 1 },
    { id: "pencil", label: "Pencil", icon: "✏️", opacity: 0.65 },
    { id: "marker", label: "Marker", icon: "🖌️", opacity: 0.9 },
    { id: "highlighter", label: "Highlighter", icon: "🖍️", opacity: 0.35 },
    { id: "fountain", label: "Fountain", icon: "✒️", opacity: 0.9 },
    { id: "eraser", label: "Eraser", icon: "🧹", opacity: 1 },
    { id: "ruler", label: "Ruler Line", icon: "📐", opacity: 1 },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const container = containerRef.current;

    if (container) {
      canvas.width = container.clientWidth || 1000;
      canvas.height = container.clientHeight || 700;
    }

    if (drawingData) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        saveState();
      };
      img.src = drawingData;
    } else {
      saveState();
    }
  }, []);

  // Global Ctrl+Z (Undo) and Ctrl+Y / Ctrl+Shift+Z (Redo) inside Canvas Modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoStack, redoStack]);

  function saveState() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoStack((prev) => [...prev.slice(-25), data]);
    setRedoStack([]);
  }

  function handleUndo() {
    if (undoStack.length <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const nextUndo = [...undoStack];
    const currentData = nextUndo.pop();
    setRedoStack((prev) => [currentData, ...prev]);

    const previousState = nextUndo[nextUndo.length - 1];
    setUndoStack(nextUndo);

    if (previousState) {
      ctx.putImageData(previousState, 0, 0);
    }
  }

  function handleRedo() {
    if (redoStack.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const nextRedo = [...redoStack];
    const targetData = nextRedo.shift();
    setRedoStack(nextRedo);

    if (targetData) {
      ctx.putImageData(targetData, 0, 0);
      setUndoStack((prev) => [...prev, targetData]);
    }
  }

  function handleClear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveState();
  }

  function handleToolClick(toolId) {
    if (toolId === "ruler") {
      if (tool === "ruler") {
        // Toggle ruler off -> restore previous tool
        setTool(lastNonRulerTool || "pen");
      } else {
        setLastNonRulerTool(tool);
        setTool("ruler");
      }
    } else {
      setLastNonRulerTool(toolId);
      setTool(toolId);
    }
  }

  function getCanvasCoords(e) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function applyToolStyle(ctx) {
    const tObj = TOOLS.find((t) => t.id === tool) || TOOLS[0];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = eraserSize;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.globalAlpha = tObj.opacity;

      if (tool === "pencil") {
        ctx.lineWidth = Math.max(1, penSize * 0.5);
      } else if (tool === "marker") {
        ctx.lineWidth = Math.max(4, penSize * 2.2);
      } else if (tool === "highlighter") {
        ctx.lineWidth = Math.max(12, penSize * 4.5);
      } else if (tool === "fountain") {
        ctx.lineWidth = penSize;
      } else {
        // Standard Pen
        ctx.lineWidth = penSize;
      }
    }
  }

  function startDrawing(e) {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    setIsDrawing(true);
    setDragStart(coords);
    setCurrentPos(coords);
    setLastPoint(coords);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      applyToolStyle(ctx);
    }
  }

  function draw(e) {
    const coords = getCanvasCoords(e);
    setMousePos(coords);

    if (!isDrawing) return;
    e.preventDefault();
    setCurrentPos(coords);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (tool === "ruler") {
      if (dragStart) {
        const dx = coords.x - dragStart.x;
        const dy = coords.y - dragStart.y;
        const length = Math.round(Math.sqrt(dx * dx + dy * dy));
        const angle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
        setMeasureInfo({ length, angle });
      }
    } else if (tool === "pencil") {
      // ✏️ Graphite Pencil: Textured, grainy sub-pixel stipple strokes
      if (lastPoint) {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(1, penSize * 0.75);

        // Core graphite line
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();

        // Secondary grainy scatter stroke for authentic pencil texture
        const jitterX = (Math.random() - 0.5) * 1.5;
        const jitterY = (Math.random() - 0.5) * 1.5;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(lastPoint.x + jitterX, lastPoint.y + jitterY);
        ctx.lineTo(coords.x + jitterX, coords.y + jitterY);
        ctx.stroke();

        setLastPoint(coords);
      }
    } else if (tool === "marker") {
      // 🖌️ Felt-Tip Marker: Saturated felt ink with soft edge bleed
      if (lastPoint) {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Outer soft felt bleed
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = Math.max(6, penSize * 2.8);
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();

        // Inner saturated ink core
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = Math.max(4, penSize * 2.0);
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();

        setLastPoint(coords);
      }
    } else if (tool === "highlighter") {
      // 🖍️ Translucent Chisel Highlighter: Wide flat chisel stroke
      if (lastPoint) {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.35;
        ctx.lineCap = "square";
        ctx.lineJoin = "bevel";
        ctx.lineWidth = Math.max(16, penSize * 4.5);

        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();

        setLastPoint(coords);
      }
    } else if (tool === "fountain") {
      // ✒️ Calligraphic Fountain Pen: 45-degree angled nib thickness dynamics
      if (lastPoint) {
        const dx = coords.x - lastPoint.x;
        const dy = coords.y - lastPoint.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.5) {
          const moveAngle = Math.atan2(dy, dx);
          const nibAngle = Math.PI / 4; // 45 degrees
          const angleDiff = Math.abs(Math.sin(moveAngle - nibAngle));
          const nibWidth = Math.max(1.5, penSize * (0.25 + 1.5 * angleDiff));

          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.95;
          ctx.lineCap = "butt";
          ctx.lineJoin = "miter";
          ctx.lineWidth = nibWidth;

          ctx.beginPath();
          ctx.moveTo(lastPoint.x, lastPoint.y);
          ctx.lineTo(coords.x, coords.y);
          ctx.stroke();

          setLastPoint(coords);
        }
      }
    } else if (tool === "pen") {
      // 🖊️ Gel Ballpoint Pen: Smooth velocity-sensitive ink line
      if (lastPoint) {
        const dx = coords.x - lastPoint.x;
        const dy = coords.y - lastPoint.y;
        const speed = Math.sqrt(dx * dx + dy * dy);
        const dynamicWidth = Math.max(1, penSize * (1.2 / (1 + speed * 0.04)));

        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.globalAlpha = 1.0;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = dynamicWidth;

        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();

        setLastPoint(coords);
      }
    } else {
      // Eraser
      applyToolStyle(ctx);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    }
  }

  function stopDrawing(e) {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (tool === "ruler" && dragStart && currentPos) {
      applyToolStyle(ctx);
      ctx.beginPath();
      ctx.moveTo(dragStart.x, dragStart.y);
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.stroke();
    }

    setDragStart(null);
    setCurrentPos(null);
    setLastPoint(null);
    setMeasureInfo(null);
    saveState();
  }

  function handleSaveAndClose() {
    const canvas = canvasRef.current;
    if (!canvas) {
      onClose();
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl, bgType);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 animate-fade-in">
      <div className="flex w-[85vw] h-[85vh] flex-col rounded-2xl border border-ink-700 bg-ink-950 shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-ink-800 bg-ink-900 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-xl">🎨</span>
            <div>
              <h2 className="text-sm font-bold text-ink-100">{title || "Canvas Whiteboard"}</h2>
              <p className="text-[11px] text-ink-400">85% Viewport Drawing Workspace • Ctrl+Z / Ctrl+Y to Undo/Redo</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dots vs Clear Toggle */}
            <div className="flex items-center rounded-lg border border-ink-700 bg-ink-850 p-1 text-xs">
              <button
                type="button"
                onClick={() => setBgType("dots")}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                  bgType === "dots"
                    ? "bg-duck-500/20 text-duck-300 border border-duck-500/40 shadow"
                    : "text-ink-400 hover:text-ink-200"
                }`}
              >
                ••• Dots
              </button>
              <button
                type="button"
                onClick={() => setBgType("clear")}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                  bgType === "clear"
                    ? "bg-duck-500/20 text-duck-300 border border-duck-500/40 shadow"
                    : "text-ink-400 hover:text-ink-200"
                }`}
              >
                Plain Canvas
              </button>
            </div>

            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-xs font-medium text-ink-200 hover:bg-ink-800 disabled:opacity-40"
              title="Undo (Ctrl+Z)"
            >
              <span>↩</span>
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-xs font-medium text-ink-200 hover:bg-ink-800 disabled:opacity-40"
              title="Redo (Ctrl+Y)"
            >
              <span>↪</span>
              <span>Redo</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20"
              title="Clear full grid/canvas"
            >
              🗑️ Clear Full Grid
            </button>

            <button
              type="button"
              onClick={handleSaveAndClose}
              className="rounded-lg bg-gradient-to-r from-duck-500 to-amber-500 px-4 py-1.5 text-xs font-bold text-ink-950 shadow hover:brightness-110"
            >
              Save & Done
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Toolbar: Tools + Size Selectors + 10 Colors */}
        <div className="flex flex-wrap items-center justify-between border-b border-ink-800 bg-ink-900/90 px-4 py-2 gap-3">
          {/* Tool Picker */}
          <div className="flex items-center gap-1">
            {TOOLS.map((t) => {
              const isActive = tool === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleToolClick(t.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-duck-500/20 text-duck-300 border border-duck-500/40 shadow-sm"
                      : "text-ink-400 hover:bg-ink-800 hover:text-ink-200"
                  }`}
                  title={t.id === "ruler" ? (isActive ? "Click to deactivate Ruler" : "Click to activate Ruler") : t.label}
                >
                  <span>{t.icon}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                  {t.id === "ruler" && isActive && <span className="text-[10px] text-amber-400">●</span>}
                </button>
              );
            })}
          </div>

          {/* Dynamic Tool Size Control */}
          <div className="flex items-center gap-2 rounded-xl border border-ink-800 bg-ink-850 px-3 py-1">
            <span className="text-[11px] font-semibold text-ink-400">
              {tool === "eraser" ? "Eraser Size:" : "Stroke Width:"}
            </span>
            {tool === "eraser" ? (
              <div className="flex items-center gap-1">
                {[12, 24, 40, 60, 80].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setEraserSize(sz)}
                    className={`rounded px-2 py-0.5 text-[11px] font-bold transition-all ${
                      eraserSize === sz
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : "text-ink-400 hover:text-ink-200"
                    }`}
                  >
                    {sz}px
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {[1.5, 3, 6, 12, 20].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setPenSize(sz)}
                    className={`rounded px-2 py-0.5 text-[11px] font-bold transition-all ${
                      penSize === sz
                        ? "bg-duck-500/20 text-duck-300 border border-duck-500/40"
                        : "text-ink-400 hover:text-ink-200"
                    }`}
                  >
                    {sz}px
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 10 Colors Palette */}
          <div className="flex items-center gap-1.5 rounded-xl border border-ink-800 bg-ink-850 p-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`h-5 w-5 rounded-full transition-transform hover:scale-125 ${
                  color === c ? "ring-2 ring-duck-400 ring-offset-2 ring-offset-ink-900 scale-110" : ""
                }`}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Canvas Body (85% viewport height container) */}
        <div
          ref={containerRef}
          className={`relative flex-1 w-full h-full cursor-crosshair overflow-hidden ${
            bgType === "dots"
              ? "bg-[radial-gradient(#38bdf8_1.5px,transparent_1.5px)] [background-size:20px_20px] bg-ink-950"
              : "bg-ink-950"
          }`}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="absolute inset-0 z-10 block"
          />

          {/* Floating Circular Eraser Preview Cursor */}
          {tool === "eraser" && mousePos && (
            <div
              style={{
                left: mousePos.x - eraserSize / 2,
                top: mousePos.y - eraserSize / 2,
                width: eraserSize,
                height: eraserSize,
              }}
              className="pointer-events-none absolute z-30 rounded-full border-2 border-dashed border-rose-400 bg-rose-500/20 shadow-lg"
            />
          )}

          {/* Ruler Line Preview Guide while dragging */}
          {tool === "ruler" && isDrawing && dragStart && currentPos && (
            <svg className="absolute inset-0 z-20 pointer-events-none w-full h-full">
              <line
                x1={dragStart.x}
                y1={dragStart.y}
                x2={currentPos.x}
                y2={currentPos.y}
                stroke={color}
                strokeWidth={Math.max(2, penSize)}
                strokeDasharray="6 4"
              />
              <circle cx={dragStart.x} cy={dragStart.y} r={5} fill={color} />
              <circle cx={currentPos.x} cy={currentPos.y} r={5} fill={color} />
            </svg>
          )}

          {/* Floating measurement readout for Ruler tool */}
          {tool === "ruler" && measureInfo && currentPos && (
            <div
              style={{ left: currentPos.x + 12, top: currentPos.y + 12 }}
              className="absolute z-30 rounded bg-ink-900/90 border border-duck-500/40 px-2 py-1 text-[11px] font-mono font-bold text-duck-300 shadow-lg pointer-events-none"
            >
              📏 {measureInfo.length}px | {measureInfo.angle}°
            </div>
          )}

          {/* Translucent Ruler Active Banner */}
          {tool === "ruler" && !isDrawing && (
            <div className="absolute top-4 left-4 z-20 flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-950/90 px-3 py-1.5 text-xs text-amber-300 font-semibold shadow-lg">
              <span>📐 Ruler Guide Active: Drag to draw straight lines</span>
              <button
                type="button"
                onClick={() => setTool(lastNonRulerTool || "pen")}
                className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/40 transition-colors"
              >
                ✕ Deactivate
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── BlockNoteEditor (main export) ──────────────────────────────────
export default function BlockNoteEditor({
  onExplainBlock,
  onQuizBlock,
  onTriggerSocratic,
  onSwitchTab,
  initialTitle = "",
  initialBlocks,
  initialBanner = null,
  initialFavorite = false,
  initialEmoji = null,
  onBlocksChange,
  onSaveNote,
  notesBySpace = {},
  onSelectNote,
}) {
  const [title, setTitle] = useState(initialTitle);
  const [banner, setBanner] = useState(initialBanner);
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const [blocks, setBlocks] = useState(() =>
    initialBlocks && initialBlocks.length > 0
      ? initialBlocks
      : [createBlock("text", "")]
  );
  const [selectedId, setSelectedId] = useState(null);
  const blockRefs = useRef({});

  // Drag-to-reorder, driven by each block's ⠿ handle.
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const dragHandlers = useMemo(
    () => ({
      dragging,
      onDragStart: setDragging,
      onDragOver: (id) => setDragOver((current) => (current === id ? current : id)),
      onDragEnd: () => {
        setDragging(null);
        setDragOver(null);
      },
      onDrop: () => {
        setBlocks((prev) => {
          if (!dragging || !dragOver || dragging === dragOver) return prev;
          const from = prev.findIndex((b) => b.id === dragging);
          const to = prev.findIndex((b) => b.id === dragOver);
          if (from === -1 || to === -1) return prev;
          const next = [...prev];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          return next;
        });
        setDragging(null);
        setDragOver(null);
      },
    }),
    [dragging, dragOver],
  );

  const totalCharacters = useMemo(() => {
    return blocks.reduce((sum, b) => sum + (b.content ? b.content.length : 0), 0);
  }, [blocks]);

  const totalWords = useMemo(() => {
    return blocks.reduce((sum, b) => {
      if (!b.content) return sum;
      const words = b.content.trim().split(/\s+/).filter(Boolean);
      return sum + words.length;
    }, 0);
  }, [blocks]);

  const totalBlocks = blocks.length;

  useEffect(() => {
    if (initialTitle !== undefined) setTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    if (initialBlocks && initialBlocks.length > 0) setBlocks(initialBlocks);
  }, [initialBlocks]);

  useEffect(() => {
    if (initialBanner !== undefined) setBanner(initialBanner);
  }, [initialBanner]);

  useEffect(() => {
    if (initialFavorite !== undefined) setIsFavorite(initialFavorite);
  }, [initialFavorite]);

  useEffect(() => {
    if (initialEmoji !== undefined) setEmoji(initialEmoji);
  }, [initialEmoji]);

  useEffect(() => {
    onBlocksChange?.(blocks);
  }, [blocks, onBlocksChange]);

  const registerRef = useCallback((id, ref) => {
    blockRefs.current[id] = ref;
  }, []);

  const handleChange = useCallback((id, content) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, content } : b))
    );
  }, []);

  const [pastBlocks, setPastBlocks] = useState([]);
  const [futureBlocks, setFutureBlocks] = useState([]);

  const blocksRef = useRef(blocks);
  const pastBlocksRef = useRef(pastBlocks);
  const futureBlocksRef = useRef(futureBlocks);
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  useEffect(() => {
    pastBlocksRef.current = pastBlocks;
  }, [pastBlocks]);

  useEffect(() => {
    futureBlocksRef.current = futureBlocks;
  }, [futureBlocks]);

  const handleTitleChange = useCallback(
    (newTitle) => {
      setTitle(newTitle);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        onSaveNote?.({ title: newTitle, blocks: blocksRef.current, banner, isFavorite, emoji });
      }, 400);
    },
    [banner, isFavorite, emoji, onSaveNote]
  );

  useEffect(() => {
    const handleGlobalUndoRedo = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          if (futureBlocksRef.current.length > 0) {
            e.preventDefault();
            const next = futureBlocksRef.current[0];
            setFutureBlocks((f) => f.slice(1));
            setPastBlocks((p) => [...p, blocksRef.current]);
            setBlocks(next);
          }
        } else {
          const activeEl = document.activeElement;
          const isTextEditing = activeEl && (activeEl.isContentEditable || activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");
          if (!isTextEditing && pastBlocksRef.current.length > 0) {
            e.preventDefault();
            const previous = pastBlocksRef.current[pastBlocksRef.current.length - 1];
            setPastBlocks((p) => p.slice(0, p.length - 1));
            setFutureBlocks((f) => [blocksRef.current, ...f]);
            setBlocks(previous);
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        if (futureBlocksRef.current.length > 0) {
          e.preventDefault();
          const next = futureBlocksRef.current[0];
          setFutureBlocks((f) => f.slice(1));
          setPastBlocks((p) => [...p, blocksRef.current]);
          setBlocks(next);
        }
      }
    };
    window.addEventListener("keydown", handleGlobalUndoRedo);
    return () => window.removeEventListener("keydown", handleGlobalUndoRedo);
  }, []);

  const handleChangeType = useCallback((id, type) => {
    setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
    setFutureBlocks([]);
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, type } : b))
    );
  }, []);

  const handleUpdateBlock = useCallback(
    (id, patch, shouldSaveNote = false) => {
      setBlocks((prev) => {
        const next = prev.map((b) => (b.id === id ? { ...b, ...patch } : b));
        if (shouldSaveNote) {
          queueMicrotask(() => {
            onSaveNote?.({ title, blocks: next, banner, isFavorite, emoji });
          });
        }
        return next;
      });
    },
    [title, banner, isFavorite, emoji, onSaveNote]
  );

  const handleDeleteBlock = useCallback((id) => {
    setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
    setFutureBlocks([]);
    setBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      return next.length > 0 ? next : [createBlock("text", "")];
    });
  }, []);

  const handleAddAfter = useCallback((afterId) => {
    setPastBlocks((p) => [...p.slice(-25), blocksRef.current]);
    setFutureBlocks([]);
    const newBlock = createBlock("text", "");
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === afterId);
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock);
      return next;
    });
    setSelectedId(newBlock.id);
    setTimeout(() => {
      blockRefs.current[newBlock.id]?.current?.focus();
    }, 30);
  }, []);

  const handleKeyDown = useCallback(
    (e, blockId) => {
      if (e.key === "Backspace") {
        const block = blocks.find((b) => b.id === blockId);
        if (!block) return;

        if (block.type !== "text" && block.content === "") {
          e.preventDefault();
          handleChangeType(blockId, "text");
          return;
        }

        if (block.content === "" && blocks.length > 1) {
          e.preventDefault();
          const idx = blocks.findIndex((b) => b.id === blockId);
          const prevBlock = idx > 0 ? blocks[idx - 1] : null;
          setBlocks((prev) => prev.filter((b) => b.id !== blockId));
          if (prevBlock) {
            setSelectedId(prevBlock.id);
            setTimeout(() => {
              const el = blockRefs.current[prevBlock.id]?.current;
              if (el) {
                el.focus();
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(el);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
              }
            }, 30);
          }
        }
      } else if (e.key === "ArrowUp" && e.altKey) {
        e.preventDefault();
        const idx = blocks.findIndex((b) => b.id === blockId);
        if (idx > 0) {
          const prevId = blocks[idx - 1].id;
          setSelectedId(prevId);
          blockRefs.current[prevId]?.current?.focus();
        }
      } else if (e.key === "ArrowDown" && e.altKey) {
        e.preventDefault();
        const idx = blocks.findIndex((b) => b.id === blockId);
        if (idx < blocks.length - 1) {
          const nextId = blocks[idx + 1].id;
          setSelectedId(nextId);
          blockRefs.current[nextId]?.current?.focus();
        }
      }
    },
    [blocks, handleChangeType]
  );

  const activeBannerPreset = BANNER_PRESETS.find((b) => b.id === banner);

  // Compute sequential numbered list indices
  let currentNumber = 0;

  return (
    <div className="relative min-h-full w-full pb-32">
      {banner && (
        <div className={`group relative h-44 md:h-52 w-full ${activeBannerPreset?.style || "bg-gradient-to-r from-indigo-600 to-purple-600"} border-b border-ink-800/40 shadow-lg transition-all`} />
      )}

      <div className={`absolute right-6 ${banner ? "top-4" : "top-3"} z-30 flex items-center gap-2`}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowBannerPicker(!showBannerPicker)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-md transition-all ${
              banner
                ? "border-white/30 bg-ink-950/40 text-white opacity-60 hover:opacity-100 hover:bg-ink-950/80 hover:border-white/50"
                : "border-ink-700 bg-ink-900/90 text-ink-200 hover:border-duck-500/40 hover:text-duck-300"
            }`}
          >
            <span>🖼️</span>
            <span>{banner ? "Change Cover" : "Add Cover Banner"}</span>
          </button>

          {showBannerPicker && (
            <div className="absolute right-0 top-9 z-50 w-64 rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-2xl">
              <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                Select Cover Style
              </p>
              <div className="space-y-1">
                {BANNER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setBanner(preset.id);
                      setShowBannerPicker(false);
                      onSaveNote?.({ title, blocks, banner: preset.id });
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-ink-200 hover:bg-ink-800"
                  >
                    <span className={`h-4 w-8 rounded ${preset.style}`} />
                    <span>{preset.label}</span>
                  </button>
                ))}
                {banner && (
                  <button
                    type="button"
                    onClick={() => {
                      setBanner(null);
                      setShowBannerPicker(false);
                      onSaveNote?.({ title, blocks, banner: null });
                    }}
                    className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10"
                  >
                    Remove Banner
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Note Content Container */}
      <div
        data-editor-root
        className="relative mx-auto max-w-3xl px-10 pt-4 pb-20 cursor-text"
        onClick={(e) => {
          if (e.target === e.currentTarget && blocks.length > 0) {
            const lastBlock = blocks[blocks.length - 1];
            setSelectedId(lastBlock.id);
            const el = blockRefs.current[lastBlock.id]?.current;
            if (el) {
              el.focus();
              const range = document.createRange();
              const sel = window.getSelection();
              range.selectNodeContents(el);
              range.collapse(false);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        }}
      >
        {/* Controls Bar Below Banner: Add Icon, Favorite Star & Note Stats */}
        <div className="mb-4 pl-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900/90 px-3 py-1.5 text-xs font-semibold text-ink-300 shadow-sm backdrop-blur-md transition-all hover:border-duck-500/40 hover:text-duck-300"
              >
                <span>{emoji || "😀"}</span>
                <span>{emoji ? "Change Icon" : "Add Icon"}</span>
              </button>

              {showEmojiPicker && (
                <div className="absolute left-0 top-9 z-50 w-64 rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-2xl space-y-1.5 animate-fade-in">
                  <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    Select Note Icon
                  </p>
                  <div className="grid grid-cols-6 gap-1 p-1">
                    {NOTE_EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => {
                          setEmoji(e);
                          setShowEmojiPicker(false);
                          onSaveNote?.({ title, blocks, banner, isFavorite, emoji: e });
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors hover:bg-ink-800"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  {emoji && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmoji(null);
                        setShowEmojiPicker(false);
                        onSaveNote?.({ title, blocks, banner, isFavorite, emoji: null });
                      }}
                      className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10"
                    >
                      Remove Icon
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                const nextFav = !isFavorite;
                setIsFavorite(nextFav);
                onSaveNote?.({ title, blocks, banner, isFavorite: nextFav, emoji });
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-md transition-all ${
                isFavorite
                  ? "border-amber-500/50 bg-amber-500/20 text-amber-300 shadow-amber-500/10"
                  : "border-ink-700 bg-ink-900/90 text-ink-400 hover:border-ink-600 hover:text-ink-200"
              }`}
            >
              <span>{isFavorite ? "⭐" : "☆"}</span>
              <span>{isFavorite ? "Favorited" : "Favorite"}</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowStats(!showStats)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900/90 px-3 py-1.5 text-xs font-semibold text-ink-300 shadow-sm backdrop-blur-md transition-all hover:border-duck-500/40 hover:text-duck-300"
              >
                <span>📊</span>
                <span>Stats</span>
              </button>

              {showStats && (
                <div className="absolute left-0 top-9 z-50 w-64 rounded-xl border border-ink-700 bg-ink-900 p-3.5 shadow-2xl space-y-2.5 text-xs animate-fade-in">
                  <p className="border-b border-ink-800 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    Note Statistics
                  </p>

                  <div className="flex items-center justify-between text-ink-200">
                    <span className="flex items-center gap-1.5 text-ink-400">
                      <span>🔤</span>
                      <span>Total Characters</span>
                    </span>
                    <span className="font-mono font-bold text-ink-100">{totalCharacters.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between text-ink-200">
                    <span className="flex items-center gap-1.5 text-ink-400">
                      <span>📝</span>
                      <span>Total Words</span>
                    </span>
                    <span className="font-mono font-bold text-ink-100">{totalWords.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between text-ink-200">
                    <span className="flex items-center gap-1.5 text-ink-400">
                      <span>🧱</span>
                      <span>Block Components</span>
                    </span>
                    <span className="font-mono font-bold text-ink-100">{totalBlocks.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notion Large Note Icon & Title Input */}
        <div className="mb-6 pl-8">
          {emoji && (
            <div className="mb-2">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="text-5xl leading-none transition-transform hover:scale-105"
                title="Change Icon"
              >
                {emoji}
              </button>
            </div>
          )}
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (blocks.length > 0) {
                  const firstId = blocks[0].id;
                  setSelectedId(firstId);
                  blockRefs.current[firstId]?.current?.focus();
                }
              }
            }}
            placeholder="Untitled Note"
            className="w-full border-b border-ink-800/80 bg-transparent pt-1 pb-3 leading-snug text-4xl font-extrabold tracking-tight text-ink-100 placeholder:text-ink-700 focus:border-duck-500/50 focus:outline-none min-h-[3.5rem]"
          />
        </div>

        {/* Notion Blocks */}
        <div className="space-y-2 pl-8">
          {blocks.map((block, index) => {
            if (block.type === "number") {
              currentNumber += 1;
            } else {
              currentNumber = 0;
            }

            return (
              <EditorBlock
                key={block.id}
                block={block}
                blockNumber={currentNumber}
                isLast={index === blocks.length - 1}
                isSelected={selectedId === block.id}
                onSelect={setSelectedId}
                onChange={handleChange}
                onChangeType={handleChangeType}
                onUpdateBlock={handleUpdateBlock}
                onDelete={handleDeleteBlock}
                onKeyDown={handleKeyDown}
                onAddAfter={handleAddAfter}
                onExplainBlock={onExplainBlock}
                onQuizBlock={onQuizBlock}
                onTriggerSocratic={onTriggerSocratic}
                onSwitchTab={onSwitchTab}
                dragHandlers={dragHandlers}
                isDragTarget={dragOver === block.id && dragging !== block.id}
                notesBySpace={notesBySpace}
                onSelectNote={onSelectNote}
                registerRef={registerRef}
                onSaveNote={() => onSaveNote?.({ title, blocks, banner, isFavorite, emoji })}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

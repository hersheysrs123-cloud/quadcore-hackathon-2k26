"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── BlockNoteEditor ────────────────────────────────────────────────
// A clean, Notion-style block-based note editor.
//
// Supported block types:
//   text, h1, h2, h3, bullet, code, action
//
// Features:
//   • Inline editing with contentEditable
//   • Slash-command menu to change block type
//   • Floating action bar on selected blocks ("🦆 Test Understanding with Duck")
//   • Fires onTriggerSocratic(blockContent) when the Duck button is clicked
//   • Drag handle visible on hover
//   • "Add block" button at the bottom
// ─────────────────────────────────────────────────────────────────────

const BLOCK_TYPES = [
  { type: "text", label: "Text", icon: "Aa", description: "Plain text paragraph" },
  { type: "h1", label: "Heading 1", icon: "H1", description: "Large section heading" },
  { type: "h2", label: "Heading 2", icon: "H2", description: "Medium section heading" },
  { type: "h3", label: "Heading 3", icon: "H3", description: "Small section heading" },
  { type: "bullet", label: "Bullet List", icon: "•", description: "Bulleted list item" },
  { type: "code", label: "Code Snippet", icon: "</>", description: "Code block with syntax" },
  { type: "action", label: "Action Button", icon: "▶", description: "Clickable action block" },
];

function makeId() {
  return `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createBlock(type = "text", content = "") {
  return { id: makeId(), type, content };
}

// ─── Slash-Command Menu ─────────────────────────────────────────────
function SlashMenu({ position, onSelect, onClose, filter }) {
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

  // Close on outside click
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
      className="absolute z-50 w-64 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-2xl"
      style={{ top: position.top, left: position.left }}
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

// ─── Floating Action Bar ────────────────────────────────────────────
function FloatingActionBar({ blockContent, onTriggerSocratic, position }) {
  return (
    <div
      className="absolute z-40 flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-900 px-1 py-1 shadow-xl"
      style={{ top: position.top, left: position.left }}
    >
      <button
        type="button"
        onClick={() => onTriggerSocratic(blockContent)}
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-ink-200 transition-all hover:bg-duck-500/15 hover:text-duck-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-duck-400"
      >
        🦆 Test Understanding with Duck
      </button>
      <span className="h-4 w-px bg-ink-700" />
      <button
        type="button"
        className="rounded-md px-2 py-1.5 text-xs text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
        title="Bold"
      >
        B
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1.5 text-xs italic text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-200"
        title="Italic"
      >
        I
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1.5 text-xs text-ink-500 underline transition-colors hover:bg-ink-800 hover:text-ink-200"
        title="Underline"
      >
        U
      </button>
    </div>
  );
}

// ─── Single Block ───────────────────────────────────────────────────
function EditorBlock({
  block,
  isSelected,
  onSelect,
  onChange,
  onChangeType,
  onKeyDown,
  onAddAfter,
  registerRef,
}) {
  const contentRef = useRef(null);
  const [slashMenu, setSlashMenu] = useState(null);
  const [slashFilter, setSlashFilter] = useState("");

  useEffect(() => {
    if (registerRef) registerRef(block.id, contentRef);
  }, [block.id, registerRef]);

  // Sync contentEditable text
  useEffect(() => {
    if (
      contentRef.current &&
      contentRef.current.textContent !== block.content
    ) {
      contentRef.current.textContent = block.content;
    }
    // Only run when block.id changes (new block or type switch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id, block.type]);

  function handleInput() {
    const text = contentRef.current?.textContent ?? "";
    onChange(block.id, text);

    // Detect slash command at the start of empty block
    if (text.startsWith("/")) {
      const rect = contentRef.current.getBoundingClientRect();
      const parentRect =
        contentRef.current.closest("[data-editor-root]")?.getBoundingClientRect() ?? rect;
      setSlashMenu({
        top: rect.bottom - parentRect.top + 4,
        left: rect.left - parentRect.left,
      });
      setSlashFilter(text.slice(1));
    } else {
      setSlashMenu(null);
      setSlashFilter("");
    }
  }

  function handleSlashSelect(type) {
    // Clear the slash text and switch type
    onChange(block.id, "");
    onChangeType(block.id, type);
    setSlashMenu(null);
    setSlashFilter("");
    // Refocus
    setTimeout(() => contentRef.current?.focus(), 20);
  }

  function handleKeyDown(e) {
    if (slashMenu && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter")) {
      // Let slash menu handle it
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && block.type !== "code") {
      e.preventDefault();
      onAddAfter(block.id);
    }
    onKeyDown?.(e, block.id);
  }

  const typeStyles = {
    text: "text-[15px] leading-relaxed text-ink-200",
    h1: "text-3xl font-bold tracking-tight text-ink-100",
    h2: "text-xl font-semibold tracking-tight text-ink-100",
    h3: "text-lg font-semibold text-ink-100",
    bullet: "text-[15px] leading-relaxed text-ink-200",
    code: "font-mono text-sm leading-relaxed text-emerald-300 bg-ink-850 rounded-lg px-4 py-3 border border-ink-700 whitespace-pre-wrap",
    action: "",
  };

  const placeholders = {
    text: "Type something, or press '/' for commands…",
    h1: "Heading 1",
    h2: "Heading 2",
    h3: "Heading 3",
    bullet: "List item",
    code: "Write some code…",
    action: "Button label…",
  };

  const Tag =
    block.type === "h1"
      ? "h1"
      : block.type === "h2"
        ? "h2"
        : block.type === "h3"
          ? "h3"
          : "div";

  // Action block renders as a styled button
  if (block.type === "action") {
    return (
      <div
        className={`group relative rounded-lg px-1 py-1 transition-colors ${
          isSelected ? "bg-ink-900/80" : "hover:bg-ink-900/40"
        }`}
        onClick={() => onSelect(block.id)}
      >
        {/* Drag handle */}
        <span className="absolute -left-7 top-1/2 -translate-y-1/2 cursor-grab text-ink-700 opacity-0 transition-opacity group-hover:opacity-100">
          ⠿
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-duck-500/40 bg-duck-500/10 px-4 py-2.5 text-sm font-medium text-duck-300 transition-all hover:bg-duck-500/20 hover:text-duck-200"
          >
            <span>▶</span>
            <span
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={() => onSelect(block.id)}
              data-placeholder={placeholders.action}
              className="min-w-[4rem] outline-none empty:before:text-duck-500/50 empty:before:content-[attr(data-placeholder)]"
            />
          </button>
        </div>

        {slashMenu && (
          <SlashMenu
            position={slashMenu}
            onSelect={handleSlashSelect}
            onClose={() => {
              setSlashMenu(null);
              setSlashFilter("");
            }}
            filter={slashFilter}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`group relative rounded-lg px-1 py-0.5 transition-colors ${
        isSelected ? "bg-ink-900/80" : "hover:bg-ink-900/40"
      }`}
      onClick={() => onSelect(block.id)}
    >
      {/* Drag handle */}
      <span className="absolute -left-7 top-2 cursor-grab text-ink-700 opacity-0 transition-opacity group-hover:opacity-100">
        ⠿
      </span>

      {/* Bullet marker */}
      {block.type === "bullet" && (
        <div className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-500" />
          <Tag
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => onSelect(block.id)}
            data-placeholder={placeholders[block.type]}
            className={`min-h-[1.5em] flex-1 outline-none ${typeStyles[block.type]} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)]`}
          />
        </div>
      )}

      {block.type !== "bullet" && (
        <Tag
          ref={contentRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => onSelect(block.id)}
          data-placeholder={placeholders[block.type]}
          className={`min-h-[1.5em] outline-none ${typeStyles[block.type]} empty:before:text-ink-600 empty:before:content-[attr(data-placeholder)]`}
        />
      )}

      {/* Slash menu */}
      {slashMenu && (
        <SlashMenu
          position={slashMenu}
          onSelect={handleSlashSelect}
          onClose={() => {
            setSlashMenu(null);
            setSlashFilter("");
          }}
          filter={slashFilter}
        />
      )}
    </div>
  );
}

// ─── BlockNoteEditor (main export) ──────────────────────────────────
export default function BlockNoteEditor({ onTriggerSocratic, initialBlocks }) {
  const [blocks, setBlocks] = useState(() =>
    initialBlocks && initialBlocks.length > 0
      ? initialBlocks
      : [
          createBlock("h1", ""),
          createBlock("text", ""),
        ]
  );
  const [selectedId, setSelectedId] = useState(null);
  const blockRefs = useRef({});

  // Register refs for each block's contentEditable element
  const registerRef = useCallback((id, ref) => {
    blockRefs.current[id] = ref;
  }, []);

  // Update block content
  const handleChange = useCallback((id, content) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, content } : b))
    );
  }, []);

  // Change block type
  const handleChangeType = useCallback((id, type) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, type } : b))
    );
  }, []);

  // Add block after a given block
  const handleAddAfter = useCallback((afterId) => {
    const newBlock = createBlock("text", "");
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === afterId);
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock);
      return next;
    });
    setSelectedId(newBlock.id);
    // Focus the new block
    setTimeout(() => {
      blockRefs.current[newBlock.id]?.current?.focus();
    }, 30);
  }, []);

  // Add block at the end
  function handleAddBlock() {
    const newBlock = createBlock("text", "");
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedId(newBlock.id);
    setTimeout(() => {
      blockRefs.current[newBlock.id]?.current?.focus();
    }, 30);
  }

  // Handle key events for navigation and deletion
  const handleKeyDown = useCallback(
    (e, blockId) => {
      if (e.key === "Backspace") {
        const block = blocks.find((b) => b.id === blockId);
        if (block && block.content === "" && blocks.length > 1) {
          e.preventDefault();
          const idx = blocks.findIndex((b) => b.id === blockId);
          const prevId = idx > 0 ? blocks[idx - 1].id : blocks[idx + 1]?.id;
          setBlocks((prev) => prev.filter((b) => b.id !== blockId));
          if (prevId) {
            setSelectedId(prevId);
            setTimeout(() => {
              blockRefs.current[prevId]?.current?.focus();
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
    [blocks]
  );

  // Floating action bar position — show above the selected block
  const selectedBlock = blocks.find((b) => b.id === selectedId);
  const selectedRef = blockRefs.current[selectedId]?.current;
  const [barPos, setBarPos] = useState(null);

  useEffect(() => {
    if (!selectedRef || !selectedId) {
      setBarPos(null);
      return;
    }

    function update() {
      const el = selectedRef;
      const editor = el?.closest("[data-editor-root]");
      if (!el || !editor) return;
      const elRect = el.getBoundingClientRect();
      const editorRect = editor.getBoundingClientRect();
      setBarPos({
        top: elRect.top - editorRect.top - 44,
        left: elRect.left - editorRect.left,
      });
    }

    update();
    // Recalculate on scroll/resize
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [selectedId, selectedRef, blocks]);

  return (
    <div data-editor-root className="relative mx-auto max-w-3xl px-10 py-12">
      {/* Header */}
      <header className="mb-10">
        <div className="mb-3 flex items-center gap-2 text-xs text-ink-500">
          <span>Workspace</span>
          <span aria-hidden="true">/</span>
          <span>New Note</span>
        </div>
      </header>

      {/* Floating Action Bar */}
      {selectedId && selectedBlock && barPos && barPos.top > 0 && (
        <FloatingActionBar
          blockContent={selectedBlock.content}
          onTriggerSocratic={onTriggerSocratic}
          position={barPos}
        />
      )}

      {/* Blocks */}
      <div className="space-y-1 pl-8">
        {blocks.map((block) => (
          <EditorBlock
            key={block.id}
            block={block}
            isSelected={selectedId === block.id}
            onSelect={setSelectedId}
            onChange={handleChange}
            onChangeType={handleChangeType}
            onKeyDown={handleKeyDown}
            onAddAfter={handleAddAfter}
            registerRef={registerRef}
          />
        ))}
      </div>

      {/* Add block */}
      <button
        type="button"
        onClick={handleAddBlock}
        className="mt-4 ml-8 w-[calc(100%-2rem)] rounded-lg border border-dashed border-ink-800 px-4 py-3 text-left text-sm text-ink-600 transition-colors hover:border-ink-700 hover:text-ink-500"
      >
        + Add block
      </button>

      {/* Type hint */}
      <p className="mt-6 ml-8 text-[11px] text-ink-600">
        Type <kbd className="rounded border border-ink-700 bg-ink-850 px-1 py-0.5 text-[10px] text-ink-400">/</kbd>{" "}
        to change block type · Select a block to reveal the Duck action bar
      </p>
    </div>
  );
}

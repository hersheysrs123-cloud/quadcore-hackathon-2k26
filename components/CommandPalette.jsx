"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Settings, FileText, Calendar, Box, Activity } from "lucide-react";

export default function CommandPalette({
  notesBySpace = {},
  activeSpace,
  setActiveSpace,
  setActiveTab,
  setActiveNoteId,
  onOpenSettings,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  // Combine all searchable items (memoized)
  const items = useMemo(() => {
    const list = [
      { id: "action_notes", type: "View", title: "Open Notes", icon: <FileText size={16} />, onSelect: () => setActiveTab("notes") },
      { id: "action_calendar", type: "View", title: "Open Calendar", icon: <Calendar size={16} />, onSelect: () => setActiveTab("calendar") },
      { id: "action_3d", type: "View", title: "Open 3D Visualizations", icon: <Box size={16} />, onSelect: () => setActiveTab("3d") },
      { id: "action_mastery", type: "View", title: "Open Mastery Dashboard", icon: <Activity size={16} />, onSelect: () => setActiveTab("mastery") },
    ];

    if (onOpenSettings) {
      list.push({ id: "action_settings", type: "Settings", title: "Open Settings", icon: <Settings size={16} />, onSelect: () => onOpenSettings() });
    }

    Object.entries(notesBySpace).forEach(([space, spaceNotes]) => {
      (spaceNotes || []).forEach((note) => {
        list.push({
          id: `note_${note.id}`,
          type: "Note",
          title: note.title || "Untitled Note",
          subtitle: `Space: ${space}`,
          icon: <span>{note.emoji || "📝"}</span>,
          onSelect: () => {
            setActiveSpace(space);
            setActiveNoteId(note.id);
            setActiveTab("notes");
          },
        });
      });
    });

    return list;
  }, [notesBySpace, setActiveSpace, setActiveNoteId, setActiveTab, onOpenSettings]);

  // Fuzzy filter (memoized)
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  }, [items, query]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].onSelect();
        setIsOpen(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4 sm:px-0">
      <div className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-2xl bg-ink-900 border border-ink-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-fade-up">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-ink-800 bg-ink-900">
          <Search className="w-5 h-5 text-duck-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-ink-100 placeholder-ink-500 text-lg"
            placeholder="Search notes, views, settings..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center gap-1.5 shrink-0 text-ink-500 font-mono text-[10px] tracking-wider uppercase">
            <span className="px-1.5 py-0.5 bg-ink-800 rounded border border-ink-700">esc</span>
            <span>to close</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-ink-500 text-sm">
              No results found for "{query}"
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredItems.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      item.onSelect();
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left w-full ${
                      isSelected ? "bg-duck-500/10 border border-duck-500/20" : "bg-transparent border border-transparent hover:bg-ink-800/50"
                    }`}
                  >
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${isSelected ? "bg-duck-500/20 text-duck-400 border border-duck-500/20" : "bg-ink-800 text-ink-400"}`}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold truncate ${isSelected ? "text-duck-100" : "text-ink-200"}`}>
                        {item.title}
                      </div>
                      {(item.subtitle || item.type) && (
                        <div className="text-[11px] text-ink-500 truncate flex items-center gap-1.5 mt-0.5">
                          <span className="text-ink-400 font-medium">{item.type}</span>
                          {item.subtitle && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-ink-700" />
                              <span>{item.subtitle}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div className="text-duck-500 font-mono text-[10px] uppercase tracking-wider px-2 shrink-0">
                        Enter
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

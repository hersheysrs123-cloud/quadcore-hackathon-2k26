"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, Search, X, Check, Sparkles } from "lucide-react";
import {
  TOPICS,
  TOPICS_BY_ID,
  CATEGORIES,
  CATEGORY_EMOJI,
} from "@/components/visualizations/topics";

const SUBJECTS = CATEGORIES.filter((c) => c.id !== "all");

export default function TopicSelectorDropdown({
  currentTopicId,
  onSelectTopic,
  className = "",
  searchQuery = "",
  onSearchChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState("all");
  const [localQuery, setLocalQuery] = useState("");
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Sync external search query if provided
  const query = onSearchChange ? searchQuery : localQuery;
  const setQuery = onSearchChange ? onSearchChange : setLocalQuery;

  const currentTopic = TOPICS_BY_ID[currentTopicId] || TOPICS[0];
  const CurrentIcon = currentTopic?.icon || Sparkles;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
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

  // Focus search on open & handle Escape key
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Filter topics by subject and search query
  const filteredTopics = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return TOPICS.filter((t) => {
      if (activeSubject !== "all" && t.category !== activeSubject) {
        return false;
      }
      if (!needle) return true;
      return (
        t.title.toLowerCase().includes(needle) ||
        (t.syllabus && t.syllabus.toLowerCase().includes(needle)) ||
        (t.keywords && t.keywords.toLowerCase().includes(needle)) ||
        (t.blurb && t.blurb.toLowerCase().includes(needle))
      );
    });
  }, [activeSubject, query]);

  // Group topics by subject in categorical order
  const groupedSections = useMemo(() => {
    const sections = [];
    for (const cat of SUBJECTS) {
      if (activeSubject !== "all" && activeSubject !== cat.id) continue;
      const topicsInCat = filteredTopics.filter((t) => t.category === cat.id);
      if (topicsInCat.length > 0) {
        sections.push({
          category: cat,
          topics: topicsInCat,
        });
      }
    }
    return sections;
  }, [filteredTopics, activeSubject]);

  const handleSelect = useCallback(
    (id) => {
      onSelectTopic(id);
      setIsOpen(false);
    },
    [onSelectTopic],
  );

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* ─── Trigger Button ─────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select 3D simulation: currently ${currentTopic.title}`}
        className={`group flex items-center gap-2 rounded-xl border py-1.5 pl-2.5 pr-3 text-xs font-semibold transition-all cursor-pointer select-none ${
          isOpen
            ? "border-duck-500/60 bg-ink-800 text-duck-300 ring-2 ring-duck-500/20 shadow-md"
            : "border-ink-700 bg-ink-850 text-ink-100 hover:border-duck-500/40 hover:bg-ink-800 shadow-sm"
        }`}
      >
        {/* Subject Category Badge */}
        <span className="flex items-center gap-1 rounded-md bg-ink-900/90 px-1.5 py-0.5 text-[10.5px] font-bold text-ink-300 border border-ink-800 shadow-inner shrink-0">
          <span>{CATEGORY_EMOJI[currentTopic.category] || "🧊"}</span>
          <span className="capitalize hidden sm:inline">{currentTopic.category}</span>
        </span>

        <div className="h-3.5 w-px bg-ink-750 shrink-0" aria-hidden="true" />

        {/* Topic Icon & Title */}
        <CurrentIcon className="h-3.5 w-3.5 text-duck-400 shrink-0" />
        <span className="truncate max-w-[160px] sm:max-w-[220px] md:max-w-[280px] text-left">
          {currentTopic.title}
        </span>

        {/* Animated Chevron */}
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform duration-200 group-hover:text-ink-200 ${
            isOpen ? "rotate-180 text-duck-400" : ""
          }`}
        />
      </button>

      {/* ─── Dropdown Popover ───────────────────────────────────── */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-2 w-[340px] sm:w-[420px] rounded-2xl border border-ink-750 bg-ink-900/98 shadow-2xl backdrop-blur-2xl z-50 flex flex-col overflow-hidden ring-1 ring-black/40 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* 1. Header with Search Input */}
          <div className="p-2.5 border-b border-ink-800 bg-ink-900/90">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-500" />
              <input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search models by name or keyword…"
                aria-label="Filter 3D simulations"
                className="w-full rounded-lg border border-ink-750 bg-ink-950/80 py-1.5 pl-8 pr-7 text-xs text-ink-100 placeholder:text-ink-500 focus:border-duck-500/50 focus:outline-none focus:ring-1 focus:ring-duck-500/30"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear filter"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-200 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* 2. Subject Filter Pills */}
          <div className="flex items-center gap-1 px-2.5 py-1.5 border-b border-ink-800/80 bg-ink-950/50 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveSubject("all")}
              className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                activeSubject === "all"
                  ? "bg-duck-500/20 text-duck-300 border border-duck-500/50 shadow-sm"
                  : "text-ink-400 hover:text-ink-200 hover:bg-ink-850 border border-transparent"
              }`}
            >
              <span>🌐</span>
              <span>All</span>
              <span className="text-[9.5px] opacity-60 font-mono">({TOPICS.length})</span>
            </button>

            {SUBJECTS.map((cat) => {
              const count = TOPICS.filter((t) => t.category === cat.id).length;
              const active = activeSubject === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveSubject(cat.id)}
                  className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-duck-500/20 text-duck-300 border border-duck-500/50 shadow-sm"
                      : "text-ink-400 hover:text-ink-200 hover:bg-ink-850 border border-transparent"
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                  <span className="text-[9.5px] opacity-60 font-mono">({count})</span>
                </button>
              );
            })}
          </div>

          {/* 3. Scrollable List Separated by Subject */}
          <div className="max-h-[340px] overflow-y-auto divide-y divide-ink-800/60 no-scrollbar">
            {groupedSections.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-xs font-semibold text-ink-300">No simulations found</p>
                <p className="text-[11px] text-ink-500 mt-1">
                  No 3D model matches &ldquo;{query}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setActiveSubject("all");
                  }}
                  className="mt-3 rounded-lg border border-ink-700 bg-ink-850 px-3 py-1 text-xs font-semibold text-ink-200 hover:bg-ink-800 hover:border-duck-500/40 cursor-pointer"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              groupedSections.map(({ category: cat, topics: sectionTopics }) => (
                <div key={cat.id} className="relative">
                  {/* Subject Section Header */}
                  <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-1.5 bg-ink-900/95 backdrop-blur-md border-b border-ink-800/80 text-[11px] font-bold text-ink-300 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{cat.emoji}</span>
                      <span className="text-ink-100 font-semibold">{cat.label}</span>
                    </div>
                    <span className="text-[10px] font-mono text-ink-400 bg-ink-800/80 px-2 py-0.5 rounded-full border border-ink-700/60">
                      {sectionTopics.length} {sectionTopics.length === 1 ? "model" : "models"}
                    </span>
                  </div>

                  {/* Topic Items in Subject */}
                  <div className="divide-y divide-ink-850/50">
                    {sectionTopics.map((t) => {
                      const isSelected = t.id === currentTopicId;
                      const Icon = t.icon || Sparkles;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelect(t.id)}
                          className={`group flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-all cursor-pointer ${
                            isSelected
                              ? "bg-duck-500/15 border-l-2 border-duck-400 text-duck-200"
                              : "hover:bg-ink-850/80 text-ink-300 hover:text-ink-100 border-l-2 border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                                isSelected
                                  ? "border-duck-500/40 bg-duck-500/20 text-duck-300"
                                  : "border-ink-800 bg-ink-850 text-ink-400 group-hover:border-ink-700 group-hover:text-ink-200"
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p
                                className={`text-xs font-semibold truncate leading-tight ${
                                  isSelected
                                    ? "text-duck-200"
                                    : "text-ink-200 group-hover:text-ink-100"
                                }`}
                              >
                                {t.title}
                              </p>
                              <p className="text-[10px] font-mono text-ink-500 truncate leading-tight mt-0.5">
                                {t.syllabus}
                              </p>
                            </div>
                          </div>

                          {isSelected && (
                            <Check className="h-4 w-4 shrink-0 text-duck-400" strokeWidth={2.5} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 4. Dropdown Footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-ink-800 bg-ink-950/70 text-[10px] text-ink-500">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-duck-400/80 animate-pulse" />
              <span>{TOPICS.length} Models across 5 Disciplines</span>
            </span>
            <span className="font-mono text-ink-400">Esc to close</span>
          </div>
        </div>
      )}
    </div>
  );
}

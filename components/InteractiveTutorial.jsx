"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  BookOpen,
  HelpCircle,
  Folder,
  Bookmark,
  Box,
  Calendar,
  Activity,
  Shield,
  Clock,
  Code,
  FileText,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
  Keyboard,
  Layers,
  Search,
  ExternalLink,
  Flame,
  Volume2,
  Compass,
  ArrowRight,
  RotateCcw,
  Check,
  Globe,
  Tag,
  Download,
  Trash2,
  Lock,
  Edit3,
  Cpu,
  ListOrdered,
  List,
  CheckSquare,
  ChevronDown,
  Quote,
  Minus,
  Binary,
  Palette,
  Image as ImageIcon,
  Link as LinkIcon,
} from "lucide-react";

/**
 * 🎓 SocraticOS Interactive Onboarding & Feature Mastery Guide
 * Complete, interactive walkthrough covering all 8 core pillars of SocraticOS.
 */
export default function InteractiveTutorial({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenInstantNote,
  onOpenCommandPalette,
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [copiedShortcut, setCopiedShortcut] = useState(null);

  // Sync "don't show again" preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      const completed = localStorage.getItem("socratic_tutorial_completed") === "true";
      setDontShowAgain(completed);
    }
  }, [isOpen]);

  const handleClose = (markCompleted = true) => {
    if (typeof window !== "undefined" && (markCompleted || dontShowAgain)) {
      localStorage.setItem("socratic_tutorial_completed", "true");
    }
    onClose();
  };

  // Keyboard navigation for tutorial
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose(true);
      } else if (e.key === "ArrowRight") {
        if (currentStep < TUTORIAL_STEPS.length - 1) {
          setCurrentStep((prev) => prev + 1);
        }
      } else if (e.key === "ArrowLeft") {
        if (currentStep > 0) {
          setCurrentStep((prev) => prev - 1);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStep, dontShowAgain]);

  if (!isOpen) return null;

  const step = TUTORIAL_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TUTORIAL_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      {/* Backdrop */}
      <div
        onClick={() => handleClose(true)}
        aria-hidden="true"
        className="fixed inset-0 bg-ink-950/80 backdrop-blur-md transition-opacity"
      />

      {/* Main Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="SocraticOS Interactive Guide"
        className="relative z-[310] flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl border border-ink-700/80 bg-ink-900 shadow-2xl shadow-ink-950/90 overflow-hidden"
      >
        {/* Top Header */}
        <header className="flex items-center justify-between border-b border-ink-800 bg-ink-950/70 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-duck-500/20 text-duck-300 text-lg border border-duck-500/30">
              {step.badgeEmoji}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-duck-400">
                  Step {currentStep + 1} of {TUTORIAL_STEPS.length} · {step.category}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-ink-100 tracking-tight">
                {step.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleClose(true)}
              className="rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-100 transition-colors"
              title="Close Guide (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Step Indicator Navigation Pills */}
        <div className="flex items-center gap-1.5 px-6 py-2.5 bg-ink-950/40 border-b border-ink-800/80 overflow-x-auto shrink-0 scrollbar-none">
          {TUTORIAL_STEPS.map((s, idx) => {
            const isActive = idx === currentStep;
            const isDone = idx < currentStep;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStep(idx)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-duck-400 text-ink-950 shadow-sm"
                    : isDone
                    ? "bg-ink-800/80 text-duck-300 hover:bg-ink-800"
                    : "text-ink-400 hover:bg-ink-850 hover:text-ink-200"
                }`}
              >
                <span>{s.badgeEmoji}</span>
                <span className="hidden md:inline">{s.shortTitle}</span>
                <span className="md:hidden">{idx + 1}</span>
                {isDone && <Check size={12} className="text-duck-400" />}
              </button>
            );
          })}
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-6 text-ink-200 min-h-0">
          {/* Subtitle / Pitch */}
          <div className="rounded-xl border border-ink-800 bg-ink-850/60 p-4">
            <p className="text-sm leading-relaxed text-ink-200">
              {step.description}
            </p>
          </div>

          {/* Step Component Content */}
          <div className="space-y-4">
            {step.render({
              onNavigateTab,
              onOpenInstantNote,
              onOpenCommandPalette,
              copiedShortcut,
              setCopiedShortcut,
            })}
          </div>
        </div>

        {/* Footer Controls */}
        <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-ink-800 bg-ink-950/80 px-6 py-4 shrink-0">
          {/* Don't show again toggle */}
          <label className="flex items-center gap-2 text-xs text-ink-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => {
                const val = e.target.checked;
                setDontShowAgain(val);
                if (typeof window !== "undefined") {
                  localStorage.setItem("socratic_tutorial_completed", val ? "true" : "false");
                }
              }}
              className="rounded border-ink-700 bg-ink-850 text-duck-400 focus:ring-duck-400/40"
            />
            <span>Don't show this walkthrough on startup</span>
          </label>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                className="flex items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-850 px-4 py-2 text-xs font-bold text-ink-200 hover:bg-ink-800 hover:text-ink-100 transition-all shadow-sm"
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>
            )}

            {!isLast ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.min(TUTORIAL_STEPS.length - 1, prev + 1))}
                className="flex items-center gap-1.5 rounded-xl bg-duck-400 px-5 py-2 text-xs font-extrabold text-ink-950 hover:bg-duck-300 transition-all shadow-md"
              >
                <span>Next Step</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleClose(true)}
                className="flex items-center gap-2 rounded-xl bg-duck-400 px-6 py-2 text-xs font-extrabold text-ink-950 hover:bg-duck-300 transition-all shadow-lg shadow-duck-500/20"
              >
                <span>Start Studying! 🚀</span>
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

// ─── 18 Editor Block Registry for Interactive Showcase ─────────────────
const ALL_18_BLOCKS = [
  { type: "paragraph", name: "Text / Paragraph", icon: FileText, syntax: "Normal typing", desc: "Clean body text with markdown shortcuts and live inline math." },
  { type: "heading1", name: "Heading 1", icon: Layers, syntax: "# + Space", desc: "Top-level section heading with bold hierarchy." },
  { type: "heading2", name: "Heading 2", icon: Layers, syntax: "## + Space", desc: "Subsection heading for major topics." },
  { type: "heading3", name: "Heading 3", icon: Layers, syntax: "### + Space", desc: "Sub-topic heading for structured notes." },
  { type: "heading4", name: "Heading 4", icon: Layers, syntax: "#### + Space", desc: "Minor heading for compact categorization." },
  { type: "bullet", name: "Bullet List", icon: List, syntax: "- or * + Space", desc: "Unordered list with clean bullet indentations." },
  { type: "numbered", name: "Numbered List", icon: ListOrdered, syntax: "1. + Space", desc: "Sequential ordered list that numbers automatically." },
  { type: "todo", name: "To-Do Checklist", icon: CheckSquare, syntax: "[] + Space", desc: "Interactive checkboxes to track study goals and tasks." },
  { type: "toggle", name: "Toggle List", icon: ChevronDown, syntax: "> + Space", desc: "Collapsible disclosure block for hiding answers and details." },
  { type: "callout", name: "Callout Box", icon: Sparkles, syntax: "Select in slash menu", desc: "Accent highlighted box with custom emoji badge." },
  { type: "quote", name: "Blockquote", icon: Quote, syntax: "| or \" + Space", desc: "Emphasized quote with left border accent." },
  { type: "divider", name: "Horizontal Divider", icon: Minus, syntax: "---", desc: "Subtle separator line to split distinct sections." },
  { type: "math", name: "LaTeX Equation", icon: Binary, syntax: "$$ or /math", desc: "Centered KaTeX mathematical formula rendering." },
  { type: "inlinemath", name: "Inline Math Pill", icon: Binary, syntax: "$E=mc^2$", desc: "In-sentence formula rendering with KaTeX compilation." },
  { type: "code", name: "Code Snippet", icon: Code, syntax: "``` or /code", desc: "10-language syntax highlighted snippet with copy trigger." },
  { type: "canvas", name: "Canvas Whiteboard", icon: Palette, syntax: "/canvas", desc: "Embedded vector whiteboard for freehand sketches and diagrams." },
  { type: "bookmark", name: "Site Bookmark Embed", icon: LinkIcon, syntax: "/bookmark", desc: "Live web bookmark card with auto-extracted metadata." },
  { type: "embed", name: "Media Embed", icon: ImageIcon, syntax: "/embed", desc: "Embedded media and image container for diagrams." },
];

// ─── 8 Tutorial Steps Definition ──────────────────────────────────────
const TUTORIAL_STEPS = [
  // ── Step 1: Welcome & Philosophy
  {
    id: "welcome",
    category: "Getting Started",
    shortTitle: "Philosophy",
    badgeEmoji: "🦆",
    title: "Welcome to SocraticOS — The Active Learning OS",
    description:
      "SocraticOS is built on one fundamental cognitive science principle: rereading notes is an illusion of competence. True learning happens when you are actively quizzed, interrogated on mechanisms, and forced to retrieve knowledge.",
    render: ({ onNavigateTab, onOpenCommandPalette }) => (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-duck-500/30 bg-duck-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-duck-200">
            <span>🧠</span>
            <span>Active Retrieval</span>
          </div>
          <p className="text-xs text-ink-300 leading-relaxed">
            Every note connects directly to AI-generated diagnostic quizzes and Socratic Rubber Duck dialogues that score your understanding onto a sub-topic heatmap.
          </p>
        </div>

        <div className="rounded-xl border border-ink-800 bg-ink-850/70 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-ink-100">
            <span>🔒</span>
            <span>100% Local-First</span>
          </div>
          <p className="text-xs text-ink-300 leading-relaxed">
            All your notes, drawings, calendar events, bookmarks, and sessions live inside your browser's IndexedDB (Dexie.js). Zero cloud lock-in, fully offline-ready.
          </p>
        </div>

        <div className="rounded-xl border border-ink-800 bg-ink-850/70 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-ink-100">
            <span>⚡</span>
            <span>Spaces &amp; Shortcuts</span>
          </div>
          <p className="text-xs text-ink-300 leading-relaxed">
            Organize materials into <strong>School</strong>, <strong>Personal</strong>, and <strong>Misc</strong> spaces. Use <code className="text-duck-300 font-mono">Ctrl+K</code> for global search and <code className="text-duck-300 font-mono">Ctrl+I</code> for instant capture.
          </p>
        </div>
      </div>
    ),
  },

  // ── Step 2: 18-Block Notion Editor
  {
    id: "editor",
    category: "Note Taking",
    shortTitle: "18 Blocks",
    badgeEmoji: "✍️",
    title: "18-Block Studio, Slash Menu & KaTeX Math",
    description:
      "Type '/' on any line to summon the slash menu. Format notes with 18 distinct block types, drag the 6-dots handle (⠿) to reorder, add page cover banners, and write inline LaTeX math like $E=mc^2$.",
    render: () => {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl border border-duck-500/30 bg-duck-500/5 text-xs text-duck-200">
            <div className="flex items-center gap-2 font-bold">
              <span>💡</span>
              <span>Pro Tip: Press <kbd className="bg-ink-950 px-1.5 py-0.5 rounded border border-ink-700 font-mono text-duck-300">/</kbd> to insert any block, or <kbd className="bg-ink-950 px-1.5 py-0.5 rounded border border-ink-700 font-mono text-duck-300">$$</kbd> for centered LaTeX math equations.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
            {ALL_18_BLOCKS.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.type}
                  className="flex items-start gap-2.5 p-2.5 rounded-lg border border-ink-800 bg-ink-850 hover:border-duck-500/40 hover:bg-ink-800 transition-all"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink-900 border border-ink-700 text-duck-400">
                    <Icon size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-ink-100 truncate">{b.name}</span>
                      <span className="text-[9px] font-mono text-duck-400 bg-duck-500/10 px-1 rounded truncate shrink-0">{b.syntax}</span>
                    </div>
                    <p className="text-[10px] text-ink-400 leading-tight mt-0.5 line-clamp-2">{b.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    },
  },

  // ── Step 3: Socratic Duck & AI Explainer
  {
    id: "socratic",
    category: "AI Study Drill",
    shortTitle: "Socratic Duck",
    badgeEmoji: "🦆",
    title: "Socratic Duck & Diagnostic Concept Explainer",
    description:
      "Select any block or click '🦆 Quiz me' in the top bar. SocraticOS provides two revolutionary AI mechanisms that find the exact edge of your knowledge.",
    render: () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-ink-800 bg-ink-850 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-duck-300">
            <span>✨</span>
            <span>1. Structured Explainer</span>
          </div>
          <p className="text-xs text-ink-300 leading-relaxed">
            The Explainer analyzes your notes and pitches directly to your level:
          </p>
          <ul className="text-xs text-ink-400 space-y-1.5 list-disc pl-4">
            <li><strong>Core Mechanism</strong>: The physical or mathematical rules in logical order.</li>
            <li><strong>Intuitive Analogy</strong>: A mental model with its failure point explicitly noted.</li>
            <li><strong>Common Traps</strong>: The exact exam pitfalls most likely to mislead you.</li>
          </ul>
        </div>

        <div className="rounded-xl border border-ink-800 bg-ink-850 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-duck-300">
            <span>🦆</span>
            <span>2. Socratic Rubber Duck &amp; Quizzes</span>
          </div>
          <p className="text-xs text-ink-300 leading-relaxed">
            Two rigorous ways to prove you actually know the material:
          </p>
          <ul className="text-xs text-ink-400 space-y-1.5 list-disc pl-4">
            <li><strong>Diagnostic Quiz</strong>: Deterministic multiple-choice questions + mechanism evaluation.</li>
            <li><strong>Socratic Chat</strong>: The Duck questions you relentlessly and guides you to the insight.</li>
            <li><strong>Voice Dictation</strong>: Speak your explanations aloud using the microphone hook.</li>
          </ul>
        </div>
      </div>
    ),
  },

  // ── Step 4: Web Saver & Folder Manager
  {
    id: "websaver",
    category: "Resource Library",
    shortTitle: "Web Saver",
    badgeEmoji: "🔖",
    title: "Web Saver & Netscape Bookmark Manager",
    description:
      "Save study links, research papers (arXiv), documentation (MDN), and interactive tools (Desmos, 3Blue1Brown). Organize bookmarks into collapsible parent-child folder hierarchies per space.",
    render: ({ onNavigateTab }) => (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-ink-800 bg-ink-850 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-duck-300">
              <Folder size={15} />
              <span>Hierarchical Folders</span>
            </div>
            <p className="text-[11px] text-ink-400 leading-relaxed">
              Create nested folders per space with drag-and-drop support, inline renaming, and unorganized filters.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-ink-800 bg-ink-850 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-duck-300">
              <Globe size={15} />
              <span>Smart Metadata</span>
            </div>
            <p className="text-[11px] text-ink-400 leading-relaxed">
              Instant URL normalization, high-res Google favicon extraction, domain badges, tags, and personal study notes.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-ink-800 bg-ink-850 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-duck-300">
              <Download size={15} />
              <span>Browser HTML Sync</span>
            </div>
            <p className="text-[11px] text-ink-400 leading-relaxed">
              One-click import and export of standard Netscape HTML bookmarks (Chrome, Firefox, Safari, Edge, Arc, Brave).
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-xl border border-ink-800 bg-ink-950/60">
          <span className="text-xs text-ink-300">Ready to explore your saved research links?</span>
          <button
            type="button"
            onClick={() => {
              if (onNavigateTab) onNavigateTab("websaver");
            }}
            className="flex items-center gap-1.5 rounded-lg bg-duck-400/20 border border-duck-400/40 px-3 py-1.5 text-xs font-bold text-duck-300 hover:bg-duck-400/30 transition-all"
          >
            <span>Switch to 🔖 Web Saver Tab</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    ),
  },

  // ── Step 5: 3D Concept Visualizer & Socratic 3D Canvas
  {
    id: "3d",
    category: "Interactive 3D",
    shortTitle: "3D Visualizer",
    badgeEmoji: "🌌",
    title: "14 Interactive 3D Simulations & Socratic Canvas",
    description:
      "Explore 14 full-screen 3D scientific simulations across Physics, Chemistry, Biology, and Computer Science. Orbit around balanced AVL trees, Snell's law refraction rays, gas law pistons, and thin lenses.",
    render: ({ onNavigateTab }) => (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[
            { name: "Snell's Law Refraction", cat: "Physics 3.2", emoji: "🌊" },
            { name: "Thin Lenses (1/f=1/u+1/v)", cat: "Physics 3.3", emoji: "🔍" },
            { name: "Kinetic Gas Laws (PV=nRT)", cat: "Physics 2.1", emoji: "🌡️" },
            { name: "3D BST & AVL Tree", cat: "CS 4.1", emoji: "🌳" },
            { name: "Enzyme Lock & Key", cat: "Biology 5.1", emoji: "🧬" },
            { name: "Organic Chemistry Chains", cat: "Chemistry 8.2", emoji: "🧪" },
            { name: "Wave Interference", cat: "Physics 3.1", emoji: "〰️" },
            { name: "Doppler Effect & Waves", cat: "Physics 3.4", emoji: "🔊" },
          ].map((item) => (
            <div key={item.name} className="p-2.5 rounded-lg border border-ink-800 bg-ink-850">
              <span className="text-base">{item.emoji}</span>
              <div className="font-bold text-ink-100 mt-1 truncate">{item.name}</div>
              <div className="text-[10px] text-ink-500 font-mono">{item.cat}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-xl border border-ink-800 bg-ink-950/60">
          <span className="text-xs text-ink-300">Interact with real-time sliders and camera controls:</span>
          <button
            type="button"
            onClick={() => {
              if (onNavigateTab) onNavigateTab("3d");
            }}
            className="flex items-center gap-1.5 rounded-lg bg-duck-400/20 border border-duck-400/40 px-3 py-1.5 text-xs font-bold text-duck-300 hover:bg-duck-400/30 transition-all"
          >
            <span>Open 🌌 3D Orbit Studio</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    ),
  },

  // ── Step 6: Study Calendar, Pomodoro Timers & Alarms
  {
    id: "timers",
    category: "Time Management",
    shortTitle: "Timers & Calendar",
    badgeEmoji: "📅",
    title: "Multi-Timer HUD, Pomodoro & Web Audio Alarms",
    description:
      "Keep study momentum going with our centralized multi-timer subsystem. Run Pomodoro focus blocks (25m), short breaks (5m), or custom timers with zero idle CPU overhead.",
    render: () => (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-ink-800 bg-ink-850 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-duck-300">
            <Clock size={16} />
            <span>Global Timer Dropdown</span>
          </div>
          <p className="text-xs text-ink-400 leading-relaxed">
            Click the timer widget in the top right header anytime to start, pause, or switch between Pomodoro, breaks, and custom countdowns.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-ink-800 bg-ink-850 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-duck-300">
            <Volume2 size={16} />
            <span>Audio Alarms &amp; Tab Pulse</span>
          </div>
          <p className="text-xs text-ink-400 leading-relaxed">
            When a timer completes, a synthesizer chime plays and the browser tab flashes <code className="text-duck-300">🦆 ↔ ❗️</code> to grab your attention.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-ink-800 bg-ink-850 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-duck-300">
            <Calendar size={16} />
            <span>Study Agenda Calendar</span>
          </div>
          <p className="text-xs text-ink-400 leading-relaxed">
            Schedule revision blocks across months, link notes directly to calendar slots, and track completion streaks.
          </p>
        </div>
      </div>
    ),
  },

  // ── Step 7: Mastery Heatmaps & Weakest-First Analytics
  {
    id: "mastery",
    category: "Analytics",
    shortTitle: "Mastery Heatmap",
    badgeEmoji: "📊",
    title: "Mastery Heatmaps & Weakest-First Study Queue",
    description:
      "Every quiz session grades each sub-topic individually into Solid, Shaky, or Gap. The Mastery Dashboard groups topics by note and sorts them weakest-first.",
    render: ({ onNavigateTab }) => (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-solid-500/40 bg-solid-500/10 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-solid-400">
              <span>●</span>
              <span>Solid Mastery</span>
            </div>
            <p className="text-[11px] text-ink-300 leading-relaxed">
              Explained the underlying mechanism unprompted with 0 hints needed.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-shaky-500/40 bg-shaky-500/10 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-shaky-400">
              <span>◐</span>
              <span>Shaky Understanding</span>
            </div>
            <p className="text-[11px] text-ink-300 leading-relaxed">
              Correct on high-level definitions, but stumbled on follow-up mechanics.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-gap-500/40 bg-gap-500/10 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-gap-400">
              <span>○</span>
              <span>Critical Gap</span>
            </div>
            <p className="text-[11px] text-ink-300 leading-relaxed">
              Wrong answer or misconception. Top of your revision queue!
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-xl border border-ink-800 bg-ink-950/60">
          <span className="text-xs text-ink-300">View your weakest-first revision backlog:</span>
          <button
            type="button"
            onClick={() => {
              if (onNavigateTab) onNavigateTab("mastery");
            }}
            className="flex items-center gap-1.5 rounded-lg bg-duck-400/20 border border-duck-400/40 px-3 py-1.5 text-xs font-bold text-duck-300 hover:bg-duck-400/30 transition-all"
          >
            <span>Open 📊 Mastery Dashboard</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    ),
  },

  // ── Step 8: Security, Backups & Power Shortcuts
  {
    id: "shortcuts",
    category: "Pro Features",
    shortTitle: "Power Shortcuts",
    badgeEmoji: "⚡",
    title: "Password Locks, Backups & Global Shortcuts",
    description:
      "Lock sensitive spaces with custom passwords, restore soft-deleted notes from the 24-hour auto-purge trash, and export to PDF, Word (DOCX), HTML, or .socratic backup packages.",
    render: ({ copiedShortcut, setCopiedShortcut, onOpenCommandPalette, onOpenInstantNote }) => {
      const shortcuts = [
        { key: "Ctrl + K", desc: "Global Command Palette & Search", action: onOpenCommandPalette },
        { key: "Ctrl + I", desc: "75% Quick Note Capture Window", action: onOpenInstantNote },
        { key: "Ctrl + S", desc: "Instantly Save Active Note", action: null },
        { key: "/", desc: "Open 18-Block Slash Menu", action: null },
        { key: "$$", desc: "Insert Centered LaTeX Math Equation", action: null },
        { key: "Ctrl + Z / Y", desc: "Full Document Undo / Redo", action: null },
      ];

      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {shortcuts.map((sc) => (
              <div
                key={sc.key}
                className="flex items-center justify-between p-2.5 rounded-lg border border-ink-800 bg-ink-850"
              >
                <span className="text-xs text-ink-300">{sc.desc}</span>
                <kbd className="rounded-md border border-ink-700 bg-ink-900 px-2 py-1 font-mono text-[11px] font-bold text-duck-300 shadow-sm">
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>

          <div className="p-3.5 rounded-xl border border-duck-500/30 bg-duck-500/5 text-xs text-ink-300 leading-relaxed">
            🛡️ <strong>Security &amp; Backups</strong>: Encrypt spaces with passwords via the space context menu. Export complete workspaces anytime to <code className="text-duck-300">.socratic</code> packages from the <strong>Export / Import</strong> modal or <strong>Settings</strong>.
          </div>
        </div>
      );
    },
  },
];

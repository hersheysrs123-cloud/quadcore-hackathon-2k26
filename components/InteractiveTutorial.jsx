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
  Play,
  Pause,
  Award,
  Star,
  Copy,
  Sliders,
  Eye,
  CheckCheck,
  Atom,
  Dna,
  Zap,
  Sigma,
  PlusSquare,
  Columns,
  Table as TableIcon,
} from "lucide-react";
import { ALL_19_BLOCKS as RAW_BLOCKS } from "@/lib/tutorialData.js";

/**
 * 🎓 SocraticOS Interactive Onboarding & Feature Mastery Guide
 * Exhaustive, fully interactive walkthrough covering all core pillars and 100+ features of SocraticOS.
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
  const StepComponent = step?.render;
  const isFirst = currentStep === 0;
  const isLast = currentStep === TUTORIAL_STEPS.length - 1;
  const progressPercent = Math.round(((currentStep + 1) / TUTORIAL_STEPS.length) * 100);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      {/* Backdrop */}
      <div
        onClick={() => handleClose(true)}
        aria-hidden="true"
        className="fixed inset-0 bg-ink-950/85 backdrop-blur-md transition-opacity"
      />

      {/* Main Modal Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="SocraticOS Interactive Onboarding Guide"
        className="relative z-[310] flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl border border-ink-700/80 bg-ink-900 shadow-2xl shadow-ink-950/90 overflow-hidden"
      >
        {/* Progress Bar */}
        <div className="w-full bg-ink-800 h-1.5 shrink-0 overflow-hidden">
          <div
            className="bg-gradient-to-r from-duck-500 to-duck-300 h-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Top Header */}
        <header className="flex items-center justify-between border-b border-ink-800 bg-ink-950/70 px-6 py-3.5 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-duck-500/20 text-duck-300 text-xl border border-duck-500/30 shrink-0">
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

        {/* Modal Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <p className="text-xs sm:text-sm text-ink-300 leading-relaxed">
            {step.description}
          </p>

          {/* Interactive Step Content */}
          <div className="pt-1">
            {StepComponent && (
              <StepComponent
                key={step.id}
                onNavigateTab={onNavigateTab}
                onOpenInstantNote={onOpenInstantNote}
                onOpenCommandPalette={onOpenCommandPalette}
                copiedShortcut={copiedShortcut}
                setCopiedShortcut={setCopiedShortcut}
              />
            )}
          </div>
        </div>

        {/* Bottom Footer & Navigation Controls */}
        <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-ink-800 bg-ink-950/70 px-6 py-3.5 shrink-0">
          {/* Left: Don't show again toggle */}
          <label className="flex items-center gap-2 text-xs text-ink-400 hover:text-ink-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => {
                const val = e.target.checked;
                setDontShowAgain(val);
                if (typeof window !== "undefined") {
                  if (val) localStorage.setItem("socratic_tutorial_completed", "true");
                  else localStorage.removeItem("socratic_tutorial_completed");
                }
              }}
              className="h-3.5 w-3.5 rounded border-ink-700 bg-ink-800 text-duck-400 focus:ring-duck-400/50"
            />
            <span>Don&apos;t show automatically on startup</span>
          </label>

          {/* Center: Step Dots */}
          <div className="hidden md:flex items-center gap-1.5">
            {TUTORIAL_STEPS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStep(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentStep
                    ? "w-6 bg-duck-400"
                    : "w-2 bg-ink-700 hover:bg-ink-500"
                }`}
                title={`Jump to Step ${idx + 1}: ${s.shortTitle}`}
              />
            ))}
          </div>

          {/* Right: Step Navigation */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                className="flex items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-850 px-4 py-2 text-xs font-bold text-ink-200 hover:bg-ink-800 hover:text-ink-100 transition-all shadow-sm cursor-pointer"
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>
            )}

            {!isLast ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.min(TUTORIAL_STEPS.length - 1, prev + 1))}
                className="flex items-center gap-1.5 rounded-xl bg-duck-400 px-5 py-2 text-xs font-extrabold text-ink-950 hover:bg-duck-300 transition-all shadow-md cursor-pointer"
              >
                <span>Next Step</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleClose(true)}
                className="flex items-center gap-2 rounded-xl bg-duck-400 px-6 py-2 text-xs font-extrabold text-ink-950 hover:bg-duck-300 transition-all shadow-lg shadow-duck-500/20 cursor-pointer"
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

// ─── 19 Notion Editor Block Registry ─────────────────────────────────
const BLOCK_ICON_MAP = {
  text: FileText,
  h1: Layers,
  h2: Layers,
  h3: Layers,
  h4: Layers,
  bullet: List,
  number: ListOrdered,
  todo: CheckSquare,
  toggle: ChevronDown,
  callout: Sparkles,
  columns: Columns,
  table: TableIcon,
  quote: Quote,
  divider: Minus,
  math: Binary,
  inlinemath: Binary,
  code: Code,
  media: ImageIcon,
  site: LinkIcon,
};

export const ALL_19_BLOCKS = RAW_BLOCKS.map((b) => ({
  ...b,
  icon: BLOCK_ICON_MAP[b.type] || FileText,
}));

// ─── 9 Comprehensive Interactive Tutorial Steps ──────────────────────
export const TUTORIAL_STEPS = [
  // ── Step 1: Active Learning Philosophy & 100% Local-First
  {
    id: "philosophy",
    category: "Philosophy & Architecture",
    shortTitle: "Philosophy",
    badgeEmoji: "🦆",
    title: "Welcome to SocraticOS — The Active Learning OS",
    description:
      "SocraticOS is built on one core cognitive science principle: rereading is an illusion of competence. True learning happens when you are actively quizzed, interrogated on mechanisms, and forced to retrieve knowledge.",
    render: () => {
      const [activePillar, setActivePillar] = useState("retrieval");
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                id: "retrieval",
                title: "Active Retrieval",
                icon: "🧠",
                short: "Rereading is passive; Socratic testing builds long-term recall.",
                details: "Every note connects directly to diagnostic AI quizzes, the Socratic AI Tutor, and real-time confidence heatmaps (Solid ●, Shaky ◐, Gap ○).",
              },
              {
                id: "local",
                title: "100% Local-First",
                icon: "🔒",
                short: "Private IndexedDB engine (Dexie.js v7 with 11 stores).",
                details: "Your notes, 3D simulations, calendar events, folders, bookmarks, and Gemini API keys never leave your browser. Zero cloud lock-in, 100% offline capable.",
              },
              {
                id: "spaces",
                title: "Isolated Spaces",
                icon: "⚡",
                short: "School, Personal, Misc, Journal & custom spaces.",
                details: "Separate subjects and projects with independent syllabus grounding, custom emojis, and dedicated Quizzes Studio assessments.",
              },
            ].map((pillar) => (
              <button
                key={pillar.id}
                type="button"
                onClick={() => setActivePillar(pillar.id)}
                className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                  activePillar === pillar.id
                    ? "border-duck-500/60 bg-duck-500/15 shadow-md ring-1 ring-duck-400/40"
                    : "border-ink-800 bg-ink-850/70 hover:border-ink-700 hover:bg-ink-850"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{pillar.icon}</span>
                  <span className="text-xs font-bold text-ink-100">{pillar.title}</span>
                </div>
                <p className="text-[11px] text-ink-400 mt-2 leading-relaxed">{pillar.short}</p>
              </button>
            ))}
          </div>

          <div className="p-4 rounded-xl border border-duck-500/30 bg-duck-500/10 text-xs text-ink-200 flex items-start gap-3">
            <span className="text-base shrink-0">💡</span>
            <div>
              <span className="font-bold text-duck-300">Why this matters: </span>
              <span>
                {activePillar === "retrieval" && "Active recall creates strong synaptic pathways. Whenever you write a note, take an immediate AI quiz on your weakest points!"}
                {activePillar === "local" && "Everything is stored in your device's IndexedDB. You can export complete .socratic backups anytime from Settings."}
                {activePillar === "spaces" && "Each space has its own syllabus documents and mastery heatmap, preventing chemistry formulas from mixing with history notes."}
              </span>
            </div>
          </div>
        </div>
      );
    },
  },

  // ── Step 2: 19-Block Editor, Math & Typography
  {
    id: "editor",
    category: "Note Taking Studio",
    shortTitle: "19 Blocks",
    badgeEmoji: "✍️",
    title: "19-Block Notion-Grade Studio, KaTeX & Fonts",
    description:
      "Type '/' on any line to open the 22-item slash menu. Format notes with 19 distinct block types, drag the 6-dots handle (⠿) to reorder, add cover banners, and write formulas like $E=mc^2$.",
    render: ({ onNavigateTab }) => {
      const [activeCategory, setActiveCategory] = useState("All");
      const [previewFont, setPreviewFont] = useState("sans");

      const filteredBlocks = useMemo(() => {
        if (activeCategory === "All") return ALL_19_BLOCKS;
        return ALL_19_BLOCKS.filter((b) => b.cat === activeCategory);
      }, [activeCategory]);

      return (
        <div className="space-y-4">
          {/* Interactive Font Switcher */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-ink-800 bg-ink-850/80">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-300">
              <Palette size={14} className="text-duck-400" />
              <span>Preview 3 Note Typography Fonts:</span>
            </div>
            <div className="flex gap-1">
              {[
                { id: "sans", label: "Sans", fontClass: "font-sans" },
                { id: "serif", label: "Serif", fontClass: "font-serif" },
                { id: "mono", label: "Mono", fontClass: "font-mono" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPreviewFont(f.id)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                    previewFont === f.id
                      ? "border-duck-400 bg-duck-400 text-ink-950 shadow-sm"
                      : "border-ink-700 bg-ink-900 text-ink-300 hover:text-ink-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Font Preview Sample */}
          <div className={`p-3 rounded-xl border border-duck-500/30 bg-duck-500/5 text-xs text-ink-100 ${
            previewFont === "serif" ? "font-serif" : previewFont === "mono" ? "font-mono" : "font-sans"
          }`}>
            ✨ <strong>Live Font Preview:</strong> &ldquo;The unexamined life is not worth living.&rdquo; — Formula: <span className="text-duck-300 font-mono font-bold">{"$F = G \\frac{m_1 m_2}{r^2}$"}</span>
          </div>

          {/* Block Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {["All", "Text", "Lists", "Containers", "Math & Code", "Media & Web"].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-lg border font-semibold transition-all shrink-0 cursor-pointer ${
                  activeCategory === cat
                    ? "border-duck-400/50 bg-duck-400/20 text-duck-300"
                    : "border-ink-800 bg-ink-900 text-ink-400 hover:text-ink-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Blocks Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1">
            {filteredBlocks.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.type}
                  className="p-2.5 rounded-xl border border-ink-800 bg-ink-850/80 hover:border-duck-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon size={14} className="text-duck-400" />
                      <span className="text-xs font-bold text-ink-100">{b.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-duck-300 bg-ink-950 px-1.5 py-0.5 rounded border border-ink-800">
                      {b.syntax}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-400 mt-1 leading-snug">{b.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Direct Editor Jump Button */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-ink-800 bg-ink-950/60">
            <span className="text-xs text-ink-300">Try out the 19-block editor on your current notes:</span>
            <button
              type="button"
              onClick={() => {
                if (onNavigateTab) onNavigateTab("notes");
              }}
              className="flex items-center gap-1.5 rounded-lg bg-duck-400/20 border border-duck-400/40 px-3 py-1.5 text-xs font-bold text-duck-300 hover:bg-duck-400/30 transition-all cursor-pointer"
            >
              <span>Open Note Editor</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      );
    },
  },

  // ── Step 3: Interactive AI Study Suite (Tutor, Explain, Quick Quiz)
  {
    id: "ai_suite",
    category: "AI Learning Engine",
    shortTitle: "AI Study Suite",
    badgeEmoji: "🤖",
    title: "AI Tutor, Explain Panel & Diagnostic Quizzes",
    description:
      "Study side-by-side with your notes without losing context. Open the persistent study drawer to interrogate doubts, get structured 4-part explanations, or run instant quizzes.",
    render: () => {
      const [aiTab, setAiTab] = useState("quiz");
      const [quizSelected, setQuizSelected] = useState(null);
      const [quizSubmitted, setQuizSubmitted] = useState(false);

      return (
        <div className="space-y-3">
          {/* Sub-Tabs Switcher */}
          <div className="flex rounded-xl border border-ink-800 bg-ink-950 p-1">
            {[
              { id: "quiz", label: "🦆 Interactive Mini-Quiz", desc: "Try answering live!" },
              { id: "explain", label: "✨ Structured Explain Panel", desc: "Mechanism & Analogies" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setAiTab(t.id)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                  aiTab === t.id
                    ? "bg-duck-500/20 text-duck-300 border border-duck-400/40 shadow-sm"
                    : "text-ink-400 hover:text-ink-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Interactive Mini-Quiz Sandbox */}
          {aiTab === "quiz" && (
            <div className="p-4 rounded-xl border border-duck-500/40 bg-ink-850 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-duck-400 tracking-wider">
                  Live Interactive Question · Physics Optics
                </span>
                <span className="text-xs text-ink-400">Score: {quizSubmitted ? (quizSelected === 1 ? "100%" : "0%") : "—"}</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-ink-100">
                When a ray of monochromatic light enters a glass block (n = 1.5) from air at an angle of 30° to the normal, what occurs?
              </p>

              <div className="space-y-1.5">
                {[
                  { id: 0, text: "The ray bends away from the normal and speed increases." },
                  { id: 1, text: "The ray bends toward the normal and its speed decreases." }, // Correct
                  { id: 2, text: "The ray passes straight through without any deviation." },
                  { id: 3, text: "Total internal reflection occurs regardless of angle." },
                ].map((opt) => {
                  let optStyle = "border-ink-700 bg-ink-900 text-ink-200 hover:border-duck-500/50";
                  if (quizSubmitted) {
                    if (opt.id === 1) optStyle = "border-emerald-500 bg-emerald-500/20 text-emerald-200 font-bold";
                    else if (quizSelected === opt.id) optStyle = "border-rose-500 bg-rose-500/20 text-rose-200";
                    else optStyle = "border-ink-800 bg-ink-950/60 text-ink-500 opacity-60";
                  } else if (quizSelected === opt.id) {
                    optStyle = "border-duck-400 bg-duck-400/20 text-duck-200 ring-1 ring-duck-400";
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={quizSubmitted}
                      onClick={() => setQuizSelected(opt.id)}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all cursor-pointer flex items-center justify-between ${optStyle}`}
                    >
                      <span>{opt.text}</span>
                      {quizSubmitted && opt.id === 1 && <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-1">
                {quizSubmitted ? (
                  <div className="text-xs">
                    {quizSelected === 1 ? (
                      <span className="text-emerald-400 font-bold">
                        {"✓ Correct! Snell's law (n₁ sin θ₁ = n₂ sin θ₂) dictates it bends toward normal. Topic logged as Solid ●."}
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold">
                        {"✕ Incorrect. Because glass is denser (n₂ > n₁), light slows down and bends toward the normal. Logged as Gap ○!"}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] text-ink-400">Click an answer option above to test your knowledge!</span>
                )}

                {!quizSubmitted ? (
                  <button
                    type="button"
                    disabled={quizSelected === null}
                    onClick={() => setQuizSubmitted(true)}
                    className="px-4 py-1.5 rounded-lg bg-duck-400 text-ink-950 text-xs font-bold hover:bg-duck-300 disabled:opacity-40 cursor-pointer"
                  >
                    Check Answer
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setQuizSubmitted(false);
                      setQuizSelected(null);
                    }}
                    className="px-3 py-1 rounded-lg border border-ink-700 bg-ink-800 text-xs text-ink-300 hover:text-ink-100 cursor-pointer"
                  >
                    Reset Question
                  </button>
                )}
              </div>
            </div>
          )}


          {/* Structured Explain Simulation */}
          {aiTab === "explain" && (
            <div className="p-4 rounded-xl border border-ink-800 bg-ink-850 space-y-2.5 animate-fade-in text-xs">
              <div className="flex items-center gap-2 font-bold text-duck-300">
                <span>✨</span>
                <span>4-Part Concept Breakdown:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg border border-ink-700 bg-ink-900">
                  <div className="font-bold text-duck-300">1. TL;DR Abstract</div>
                  <p className="text-[11px] text-ink-400 mt-1">High-level executive summary in plain English.</p>
                </div>
                <div className="p-2.5 rounded-lg border border-ink-700 bg-ink-900">
                  <div className="font-bold text-duck-300">2. Step-by-Step Mechanism</div>
                  <p className="text-[11px] text-ink-400 mt-1">Causal step 1 → step 2 physical breakdown.</p>
                </div>
                <div className="p-2.5 rounded-lg border border-ink-700 bg-ink-900">
                  <div className="font-bold text-duck-300">3. Real-World Analogy</div>
                  <p className="text-[11px] text-ink-400 mt-1">Intuitive everyday metaphor to cement intuition.</p>
                </div>
                <div className="p-2.5 rounded-lg border border-ink-700 bg-ink-900">
                  <div className="font-bold text-duck-300">4. Common Misconceptions</div>
                  <p className="text-[11px] text-ink-400 mt-1">Classic exam pitfalls and distractor traps.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    },
  },

  // ── Step 4: Quizzes Studio & 7 Question Types
  {
    id: "quizzes",
    category: "Assessments & Exams",
    shortTitle: "Quizzes Studio",
    badgeEmoji: "🎯",
    title: "Quizzes Studio: 2-Column Exam Runner & 7 Question Types",
    description:
      "Take full-length diagnostic exams synthesized across multiple notes or curriculum docs. Features question matrix navigation, draft auto-saving, rubric grading, and 7 question types.",
    render: ({ onNavigateTab }) => {
      const [activeQType, setActiveQType] = useState("ordering");
      const [steps, setSteps] = useState([
        { id: 2, text: "Ribosome translates mRNA into peptide chain" },
        { id: 1, text: "RNA Polymerase transcribes DNA into mRNA" },
        { id: 3, text: "Chaperone proteins fold peptide into tertiary 3D structure" },
      ]);
      const [orderChecked, setOrderChecked] = useState(false);

      const moveStep = (index, direction) => {
        const newSteps = [...steps];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= newSteps.length) return;
        const temp = newSteps[index];
        newSteps[index] = newSteps[targetIndex];
        newSteps[targetIndex] = temp;
        setSteps(newSteps);
        setOrderChecked(false);
      };

      const isOrderCorrect = steps[0].id === 1 && steps[1].id === 2 && steps[2].id === 3;

      return (
        <div className="space-y-4">
          {/* Question Types Pills */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "ordering", label: "Step Ordering 🔢" },
              { id: "mc", label: "Multiple Choice 🔘" },
              { id: "multiselect", label: "Multi-Select ☑️" },
              { id: "short", label: "Short Answer ✍️" },
              { id: "value", label: "Value Input 📐" },
              { id: "code", label: "Code Snippet 💻" },
              { id: "tf", label: "True / False ⚖️" },
            ].map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setActiveQType(q.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  activeQType === q.id
                    ? "border-duck-400 bg-duck-400/20 text-duck-300"
                    : "border-ink-800 bg-ink-900 text-ink-400 hover:text-ink-200"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Interactive Step Ordering Puzzle */}
          <div className="p-4 rounded-xl border border-ink-800 bg-ink-850 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-duck-300 flex items-center gap-1.5">
                <Sliders size={14} />
                <span>Interactive Question Type Demo: Step Ordering</span>
              </span>
              <span className="text-[11px] text-ink-400">Order from first to last:</span>
            </div>

            <div className="space-y-2">
              {steps.map((s, idx) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-ink-700 bg-ink-900 text-xs text-ink-200"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-duck-500/20 text-duck-300 font-mono text-[11px] font-bold">
                      {idx + 1}
                    </span>
                    <span>{s.text}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveStep(idx, -1)}
                      className="p-1 rounded bg-ink-800 text-ink-300 hover:text-ink-100 disabled:opacity-30 cursor-pointer"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === steps.length - 1}
                      onClick={() => moveStep(idx, 1)}
                      className="p-1 rounded bg-ink-800 text-ink-300 hover:text-ink-100 disabled:opacity-30 cursor-pointer"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                {orderChecked && (
                  <span className={`text-xs font-bold ${isOrderCorrect ? "text-emerald-400" : "text-rose-400"}`}>
                    {isOrderCorrect
                      ? "✓ Correct sequence! Full credit awarded in Quizzes Studio."
                      : "✕ Not quite right yet. DNA transcription occurs before translation."}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOrderChecked(true)}
                className="px-4 py-1.5 rounded-lg bg-duck-400 text-ink-950 text-xs font-bold hover:bg-duck-300 cursor-pointer"
              >
                Validate Order
              </button>
            </div>
          </div>

          {/* Jump to Quizzes Studio */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-ink-800 bg-ink-950/60">
            <span className="text-xs text-ink-300">Take full diagnostic exams with review reports:</span>
            <button
              type="button"
              onClick={() => {
                if (onNavigateTab) onNavigateTab("quizzes");
              }}
              className="flex items-center gap-1.5 rounded-lg bg-duck-400/20 border border-duck-400/40 px-3 py-1.5 text-xs font-bold text-duck-300 hover:bg-duck-400/30 transition-all cursor-pointer"
            >
              <span>Open 🎯 Quizzes Studio</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      );
    },
  },

  // ── Step 5: Space Hub & Curriculum Grounding
  {
    id: "spacehub",
    category: "Curriculum Management",
    shortTitle: "Space Hub",
    badgeEmoji: "⚙️",
    title: "Space Hub: Per-Space Syllabus Documents & Pedagogy",
    description:
      "Upload full course syllabi (.pdf, .docx, .txt, .md) to strictly anchor AI quizzes within your grade level. Never get penalised for Grade 12 content when you're in Grade 10.",
    render: ({ onNavigateTab }) => {
      const [selectedStandard, setSelectedStandard] = useState("IGCSE");

      const standards = {
        IGCSE: {
          level: "IGCSE Cambridge (Grades 9-10)",
          persona: "Concise examiner focusing strictly on Cambridge IGCSE learning objectives.",
          strictness: "Moderate · Marks strictly by Cambridge marking scheme keys.",
        },
        IB: {
          level: "IB Diploma (Grades 11-12 HL/SL)",
          persona: "Analytical examiner demanding command-term precision (Evaluate, Deduce, Explain).",
          strictness: "High · Enforces rigorous IB terminology and step-by-step logic.",
        },
        AP: {
          level: "AP / Advanced Placement",
          persona: "College-board aligned examiner focusing on Free-Response Rubric criteria.",
          strictness: "High · Rigorous quantitative error-propagation standards.",
        },
        University: {
          level: "Undergraduate / University",
          persona: "First-principles academic researcher exploring edge-cases and proofs.",
          strictness: "Maximum · Requires rigorous mathematical proofs and counter-examples.",
        },
      };

      const cur = standards[selectedStandard];

      return (
        <div className="space-y-4">
          {/* Preset Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-400 font-semibold">Test Curriculum Preset:</span>
            <div className="flex gap-1.5">
              {Object.keys(standards).map((std) => (
                <button
                  key={std}
                  type="button"
                  onClick={() => setSelectedStandard(std)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    selectedStandard === std
                      ? "border-duck-400 bg-duck-400 text-ink-950 shadow-sm"
                      : "border-ink-700 bg-ink-850 text-ink-300 hover:text-ink-100"
                  }`}
                >
                  {std}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Preset Preview */}
          <div className="p-4 rounded-xl border border-ink-800 bg-ink-850 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-ink-800 pb-2">
              <span className="font-bold text-duck-300">{cur.level}</span>
              <span className="font-mono text-[10px] text-ink-400">Strictness: {cur.strictness}</span>
            </div>
            <div>
              <span className="text-ink-400 font-semibold">AI System Persona: </span>
              <span className="text-ink-200">{cur.persona}</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-ink-800 bg-ink-950/60">
            <span className="text-xs text-ink-300">Upload syllabus PDFs or customize space emojis:</span>
            <button
              type="button"
              onClick={() => {
                if (onNavigateTab) onNavigateTab("spacehub");
              }}
              className="flex items-center gap-1.5 rounded-lg bg-duck-400/20 border border-duck-400/40 px-3 py-1.5 text-xs font-bold text-duck-300 hover:bg-duck-400/30 transition-all cursor-pointer"
            >
              <span>Open ⚙️ Space Hub</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      );
    },
  },

  // ── Step 6: 27-Topic 3D Simulation Studio
  {
    id: "visualizations",
    category: "3D Scientific Studio",
    shortTitle: "3D Studio",
    badgeEmoji: "🌌",
    title: "27 Interactive 3D Simulations Across 5 STEM Domains",
    description:
      "Interact with real-time WebGL models featuring OrbitControls, parameter sliders, clinical CT respiratory kinematics, optical benches, and dynamic physics equations.",
    render: ({ onNavigateTab }) => {
      const [domain, setDomain] = useState("all");

      const SIMULATIONS = [
        { id: "refraction", domain: "physics", emoji: "〰️", name: "Wave Refraction & Snell's Law", desc: "Critical angle & total internal reflection." },
        { id: "motor", domain: "physics", emoji: "🧲", name: "The Motor Effect & Lorentz Force", desc: "Fleming's Left Hand Rule & B-field." },
        { id: "lenses", domain: "physics", emoji: "🔍", name: "Thin Lens Optics & Ray Diagrams", desc: "Convex/concave focal lengths & images." },
        { id: "shadows", domain: "physics", emoji: "💡", name: "Shadow Lab Optical Bench", desc: "Draggable bench, umbra, penumbra & 3D solids." },
        { id: "bohr", domain: "chemistry", emoji: "⚛️", name: "Bohr Atom & Emission Spectra", desc: "Quantized shells & photon wave packets." },
        { id: "vsepr", domain: "chemistry", emoji: "🔷", name: "VSEPR Molecular Geometry", desc: "Steric numbers 2-6 with lone pair clouds." },
        { id: "distillation", domain: "chemistry", emoji: "🧪", name: "Fractional Distillation Column", desc: "Petroleum fractions & boiling points." },
        { id: "cell", domain: "biology", emoji: "🔬", name: "Plant & Animal Cell Explorer", desc: "Organelle cutaways & osmotic tonicity." },
        { id: "eye", domain: "biology", emoji: "👁️", name: "Human Eye & Pupil Accommodation", desc: "Gullstrand optical power & ciliary focus." },
        { id: "respiratory", domain: "biology", emoji: "🫁", name: "CT Thoracic Skeleton & Lungs", desc: "Clinical CT breathing kinematics & Boyle's Law." },
        { id: "tree", domain: "cs", emoji: "🌳", name: "Binary Search & AVL Tree", desc: "Animated auto-balancing rotations & traversals." },
        { id: "sorting", domain: "cs", emoji: "📊", name: "3D Sorting Visualizer", desc: "Bubble, Quick, Merge & Radix algorithms." },
        { id: "loss", domain: "math", emoji: "📐", name: "Gradient Descent on Loss Surfaces", desc: "Optimization paths on 3D surfaces." },
      ];

      const visibleSims = domain === "all" ? SIMULATIONS : SIMULATIONS.filter((s) => s.domain === domain);

      return (
        <div className="space-y-4">
          {/* Domain Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: "all", label: "All (27)" },
              { id: "physics", label: "Physics ⚛️" },
              { id: "chemistry", label: "Chemistry 🧪" },
              { id: "biology", label: "Biology 🧬" },
              { id: "cs", label: "Computer Science 💻" },
              { id: "math", label: "Mathematics 📐" },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDomain(d.id)}
                className={`px-3 py-1 rounded-lg border font-semibold transition-all shrink-0 cursor-pointer ${
                  domain === d.id
                    ? "border-duck-400 bg-duck-400/20 text-duck-300"
                    : "border-ink-800 bg-ink-900 text-ink-400 hover:text-ink-200"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Grid of Simulation Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
            {visibleSims.map((sim) => (
              <div
                key={sim.id}
                className="p-2.5 rounded-xl border border-ink-800 bg-ink-850 hover:border-duck-500/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{sim.emoji}</span>
                  <div className="font-bold text-xs text-ink-100 truncate">{sim.name}</div>
                </div>
                <p className="text-[11px] text-ink-400 mt-1 leading-relaxed">{sim.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-ink-800 bg-ink-950/60">
            <span className="text-xs text-ink-300">Rotate, pan, zoom, and tweak real-time simulation sliders:</span>
            <button
              type="button"
              onClick={() => {
                if (onNavigateTab) onNavigateTab("3d");
              }}
              className="flex items-center gap-1.5 rounded-lg bg-duck-400/20 border border-duck-400/40 px-3 py-1.5 text-xs font-bold text-duck-300 hover:bg-duck-400/30 transition-all cursor-pointer"
            >
              <span>Launch 🌌 3D Studio</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      );
    },
  },

  // ── Step 7: Study Rhythm, Pomodoro Cycle & Calendar
  {
    id: "timers",
    category: "Time Management",
    shortTitle: "Timers & Calendar",
    badgeEmoji: "📅",
    title: "Multi-Timer HUD, Pomodoro Rhythm & Study Calendar",
    description:
      "Keep study momentum going with zero idle CPU timers. Run Pomodoro focus blocks (25m), short breaks (5m), or custom countdowns with animated browser tab pulse notifications (🦆 ↔ ❗️).",
    render: ({ onNavigateTab }) => {
      const [activePhase, setActivePhase] = useState("focus");

      const phases = {
        focus: {
          title: "25m Deep Work Focus",
          icon: "🎯",
          duration: "25:00",
          progress: 85,
          color: "text-duck-400 border-duck-400",
          desc: "Single-task focus block on your hardest concepts or quiz reviews.",
          tabPreview: "🦆 SocraticOS · Studying",
        },
        shortBreak: {
          title: "5m Active Short Break",
          icon: "☕",
          duration: "05:00",
          progress: 100,
          color: "text-emerald-400 border-emerald-400",
          desc: "Stand up, stretch, hydrate. Let your diffuse memory networks consolidate.",
          tabPreview: "❗️ Break Time! · SocraticOS",
        },
        longBreak: {
          title: "15m Recharge Break",
          icon: "🌿",
          duration: "15:00",
          progress: 100,
          color: "text-sky-400 border-sky-400",
          desc: "Take a walk or grab a snack after 4 completed Pomodoro cycles.",
          tabPreview: "🌴 Long Break · SocraticOS",
        },
      };

      const current = phases[activePhase];

      return (
        <div className="space-y-4">
          {/* Phase Switcher Buttons */}
          <div className="flex rounded-xl border border-ink-800 bg-ink-950 p-1">
            {[
              { id: "focus", label: "Focus (25m) 🎯" },
              { id: "shortBreak", label: "Short Break (5m) ☕" },
              { id: "longBreak", label: "Long Break (15m) 🌿" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePhase(p.id)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                  activePhase === p.id
                    ? "bg-duck-500/20 text-duck-300 border border-duck-400/40 shadow-sm"
                    : "text-ink-400 hover:text-ink-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Interactive Timer Simulator Card */}
          <div className="p-4 rounded-xl border border-ink-800 bg-ink-850 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="text-xl">{current.icon}</span>
                <span className="text-sm font-bold text-ink-100">{current.title}</span>
              </div>
              <p className="text-xs text-ink-400 max-w-sm leading-relaxed">{current.desc}</p>
              <div className="pt-1 flex items-center justify-center sm:justify-start gap-2 text-[11px] font-mono text-ink-300">
                <span className="text-ink-500">Browser Tab Notification:</span>
                <span className="bg-ink-950 px-2 py-0.5 rounded border border-ink-800 text-duck-300">
                  {current.tabPreview}
                </span>
              </div>
            </div>

            {/* Circular Timer Visual Display */}
            <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-ink-700 bg-ink-900 shrink-0 min-w-[120px]">
              <span className="text-2xl font-black font-mono text-duck-300">{current.duration}</span>
              <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mt-0.5">
                Multi-Timer HUD
              </span>
            </div>
          </div>

          {/* Jump to Calendar */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-ink-800 bg-ink-950/60">
            <span className="text-xs text-ink-300">Plan your study schedule and link notes to calendar agenda slots:</span>
            <button
              type="button"
              onClick={() => {
                if (onNavigateTab) onNavigateTab("calendar");
              }}
              className="flex items-center gap-1.5 rounded-lg bg-duck-400/20 border border-duck-400/40 px-3 py-1.5 text-xs font-bold text-duck-300 hover:bg-duck-400/30 transition-all cursor-pointer"
            >
              <span>Open 📅 Calendar</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      );
    },
  },

  // ── Step 8: Web Saver & Bookmark Manager
  {
    id: "websaver",
    category: "Research Management",
    shortTitle: "Web Saver",
    badgeEmoji: "🔖",
    title: "Dual-Pane Web Saver & Netscape Bookmark Manager",
    description:
      "Bookmark reference articles and documentation alongside your notes. Organize links in nested drag-and-drop folders, with live Google Favicon resolution and Netscape HTML import/export.",
    render: ({ onNavigateTab }) => {
      const [selectedFolder, setSelectedFolder] = useState("Physics");

      const folders = [
        { id: "Physics", count: 4, emoji: "⚛️" },
        { id: "Chemistry", count: 3, emoji: "🧪" },
        { id: "Biology", count: 5, emoji: "🧬" },
      ];

      const sampleBookmarks = {
        Physics: [
          { title: "Feynman Lectures on Physics", domain: "feynmanlectures.caltech.edu", tag: "Reference" },
          { title: "HyperPhysics — Snell's Law & Optics", domain: "hyperphysics.phy-astr.gsu.edu", tag: "Optics" },
        ],
        Chemistry: [
          { title: "PubChem Compound Explorer", domain: "pubchem.ncbi.nlm.nih.gov", tag: "Molecules" },
          { title: "VSEPR Geometry Tables", domain: "chem.libretexts.org", tag: "Bonding" },
        ],
        Biology: [
          { title: "NCBI Protein Data Bank", domain: "rcsb.org", tag: "Structures" },
          { title: "Cell Biology by the Numbers", domain: "book.bionumbers.org", tag: "Bio" },
        ],
      };

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Interactive Mock Folder Tree */}
            <div className="p-3 rounded-xl border border-ink-800 bg-ink-850 space-y-2">
              <div className="text-xs font-bold text-duck-300 flex items-center gap-1.5">
                <Folder size={14} />
                <span>Folders Tree:</span>
              </div>
              <div className="space-y-1">
                {folders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFolder(f.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selectedFolder === f.id
                        ? "bg-duck-500/20 text-duck-300 border border-duck-400/30"
                        : "text-ink-400 hover:bg-ink-800 hover:text-ink-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{f.emoji}</span>
                      <span>{f.id}</span>
                    </div>
                    <span className="text-[10px] font-mono bg-ink-950 px-1.5 py-0.5 rounded border border-ink-800">
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Bookmark Cards */}
            <div className="md:col-span-2 p-3 rounded-xl border border-ink-800 bg-ink-850 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-duck-300">
                <div className="flex items-center gap-1.5">
                  <Bookmark size={14} />
                  <span>Bookmarks in &ldquo;{selectedFolder}&rdquo;:</span>
                </div>
                <span className="text-[10px] text-ink-500 font-mono">Netscape HTML Ready</span>
              </div>

              <div className="space-y-2">
                {(sampleBookmarks[selectedFolder] || []).map((bm, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg border border-ink-700 bg-ink-900 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-ink-100">{bm.title}</div>
                      <div className="text-[10px] text-ink-400 font-mono mt-0.5">{bm.domain}</div>
                    </div>
                    <span className="text-[10px] bg-duck-500/10 text-duck-300 border border-duck-500/30 px-2 py-0.5 rounded-full font-semibold">
                      {bm.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-ink-800 bg-ink-950/60">
            <span className="text-xs text-ink-300">Import your Chrome / Arc bookmarks or add new links:</span>
            <button
              type="button"
              onClick={() => {
                if (onNavigateTab) onNavigateTab("websaver");
              }}
              className="flex items-center gap-1.5 rounded-lg bg-duck-400/20 border border-duck-400/40 px-3 py-1.5 text-xs font-bold text-duck-300 hover:bg-duck-400/30 transition-all cursor-pointer"
            >
              <span>Open 🔖 Web Saver</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      );
    },
  },

  // ── Step 9: Power Shortcuts, Bulk Actions & Data Safety
  {
    id: "shortcuts",
    category: "Pro Features & Shortcuts",
    shortTitle: "Power Shortcuts",
    badgeEmoji: "⚡",
    title: "Bulk Actions, 24h Auto-Purge Trash & Power Shortcuts",
    description:
      "Bulk select notes to star, duplicate, or move. Restore soft-deleted notes within 24 hours, and navigate the entire OS using global keyboard shortcuts.",
    render: ({ onOpenCommandPalette, onOpenInstantNote, copiedShortcut, setCopiedShortcut }) => {
      const shortcuts = [
        { key: "Ctrl + K", desc: "Global Command Palette & Search", action: onOpenCommandPalette },
        { key: "Ctrl + I", desc: "75% Quick Note Capture Window", action: onOpenInstantNote },
        { key: "Ctrl + S", desc: "Instantly Save Active Note", action: null },
        { key: "Alt + ← / →", desc: "Back / Forward Visited Notes History", action: null },
        { key: "/", desc: "Open 22-Command Slash Menu", action: null },
        { key: "$$", desc: "Insert Centered LaTeX Math Equation", action: null },
        { key: "Ctrl + Z / Y", desc: "Full Document Undo / Redo", action: null },
        { key: "Esc", desc: "Dismiss Any Modal / Close Zen Mode", action: null },
      ];

      const copyToClipboard = (text) => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          navigator.clipboard.writeText(text);
          setCopiedShortcut(text);
          setTimeout(() => setCopiedShortcut(null), 1500);
        }
      };

      return (
        <div className="space-y-4">
          {/* Shortcuts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
            {shortcuts.map((sc) => (
              <div
                key={sc.key}
                onClick={() => {
                  if (sc.action) sc.action();
                  else copyToClipboard(sc.key);
                }}
                className="flex items-center justify-between p-2.5 rounded-xl border border-ink-800 bg-ink-850 hover:border-duck-500/40 transition-all cursor-pointer group"
                title={sc.action ? "Click to launch shortcut live!" : "Click to copy shortcut"}
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-ink-200 group-hover:text-duck-300 transition-colors">
                    {sc.desc}
                  </div>
                  {sc.action && (
                    <span className="text-[10px] text-duck-400 font-bold flex items-center gap-1">
                      <span>⚡ Click to try live</span>
                    </span>
                  )}
                </div>
                <kbd className="rounded-md border border-ink-700 bg-ink-950 px-2 py-1 font-mono text-[11px] font-bold text-duck-300 shadow-sm shrink-0">
                  {copiedShortcut === sc.key ? "Copied! ✓" : sc.key}
                </kbd>
              </div>
            ))}
          </div>

          {/* Data Safety & 24h Trash Card */}
          <div className="p-3.5 rounded-xl border border-duck-500/30 bg-duck-500/10 text-xs text-ink-300 leading-relaxed flex items-start gap-3">
            <span className="text-lg shrink-0">🛡️</span>
            <div>
              <strong className="text-duck-200">24h Auto-Purge Trash &amp; Workspace Backups: </strong>
              Deleted notes stay safe in the 24-hour trash drawer with real-time recovery countdowns. You can export complete workspace packages anytime to <code className="text-duck-300 font-mono font-bold">.socratic</code> JSON backup files from the <strong>Export / Import</strong> modal or <strong>Settings</strong>.
            </div>
          </div>
        </div>
      );
    },
  },
];

"use client";

import {
  House,
  FileText,
  Target,
  BarChart3,
  CalendarDays,
  Box,
  Bookmark,
  BookOpen,
  Clock,
  Zap,
  Search,
  Sun,
  Moon,
  Settings,
} from "lucide-react";
import { useGlobalTimer } from "@/lib/timerStore";

/**
 * The single navigation surface of the redesigned workspace.
 *
 * Every section of the product lives here, in one column, so a first-time
 * user gets a complete map of the app without hunting through a sidebar
 * grid and a header tab-strip. Sections are ordered by the study loop:
 * write (Notes) → test (Quizzes) → review (Mastery), then the supporting
 * tools (Calendar, 3D Lab, Saved).
 */
const SECTIONS = [
  { id: "home", label: "Home", icon: House, hint: "Overview" },
  { id: "notes", label: "Notes", icon: FileText, hint: "Write and organise notes" },
  { id: "quizzes", label: "Quizzes", icon: Target, hint: "Generate and take quizzes" },
  { id: "mastery", label: "Mastery", icon: BarChart3, hint: "What you actually understood" },
  { id: "calendar", label: "Calendar", icon: CalendarDays, hint: "Schedule, timers and alarms" },
  { id: "3d", label: "3D Lab", icon: Box, hint: "Interactive 3D models" },
  { id: "literature", label: "Literature", icon: BookOpen, hint: "Annotate and revise poems" },
  { id: "websaver", label: "Saved", icon: Bookmark, hint: "Bookmarks and links" },
];

function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function RailButton({ active, label, hint, icon: Icon, onClick, badge, accent = false, sublabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint || label}
      aria-current={active ? "page" : undefined}
      className={`group relative flex w-full flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors ${
        active
          ? "bg-ink-800 text-ink-100"
          : accent
          ? "text-duck-400 hover:bg-ink-850 hover:text-duck-300"
          : "text-ink-500 hover:bg-ink-850 hover:text-ink-200"
      }`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute -left-2 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-duck-400"
        />
      )}
      <span className="relative">
        <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.9} />
        {badge > 0 && (
          <span className="absolute -right-2 -top-1.5 min-w-[16px] rounded-full bg-gap-500 px-1 text-center text-[9px] font-bold leading-4 text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className="leading-none">{sublabel || label}</span>
    </button>
  );
}

export default function NavRail({
  activeTab,
  onNavigate,
  gapCount = 0,
  theme = "dark",
  onToggleTheme,
  onOpenSettings,
  onOpenInstantNote,
  onOpenSearch,
}) {
  const { primaryTimer } = useGlobalTimer();
  const timerRunning = Boolean(primaryTimer?.isActive && primaryTimer.secondsLeft > 0);

  // Space settings is part of the Notes section for navigation purposes.
  const highlighted = activeTab === "spacehub" ? "notes" : activeTab;

  return (
    <nav
      aria-label="Primary"
      className="no-print flex h-full w-[68px] shrink-0 flex-col items-stretch border-r border-ink-800 bg-ink-900 px-2 py-3"
    >
      <button
        type="button"
        onClick={() => onNavigate("home")}
        title="SocraticOS"
        className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-duck-400 text-xl shadow-sm transition-transform hover:scale-105"
      >
        <span aria-hidden="true">🦆</span>
        <span className="sr-only">SocraticOS home</span>
      </button>

      <div className="flex flex-col gap-0.5">
        {SECTIONS.map((s) => (
          <RailButton
            key={s.id}
            active={highlighted === s.id}
            label={s.label}
            hint={s.hint}
            icon={s.icon}
            badge={s.id === "mastery" ? gapCount : 0}
            onClick={() => onNavigate(s.id)}
          />
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-ink-800 pt-2">
        <RailButton
          label="Timer"
          hint={timerRunning ? `${primaryTimer.title} · ${formatClock(primaryTimer.secondsLeft)}` : "Focus timer"}
          icon={Clock}
          accent={timerRunning}
          sublabel={timerRunning ? formatClock(primaryTimer.secondsLeft) : "Timer"}
          onClick={() => onNavigate("calendar")}
        />
        <RailButton label="Capture" hint="Quick note (Ctrl+I)" icon={Zap} onClick={onOpenInstantNote} />
        <RailButton label="Search" hint="Search everything (Ctrl+K)" icon={Search} onClick={onOpenSearch} />
        <RailButton
          label={theme === "light" ? "Dark" : "Light"}
          hint="Switch theme"
          icon={theme === "light" ? Moon : Sun}
          onClick={onToggleTheme}
        />
        <RailButton label="Settings" hint="Settings" icon={Settings} onClick={onOpenSettings} />
      </div>
    </nav>
  );
}

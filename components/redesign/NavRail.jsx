"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  House,
  Lock,
  PinOff,
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

/** Foot tools, listed here so the pin menu can name them. Settings cannot be
 * unpinned: it is the way back to everything else. */
const TOOLS = [
  { id: "timer", label: "Timer" },
  { id: "capture", label: "Capture" },
  { id: "search", label: "Search" },
  { id: "theme", label: "Theme toggle" },
  { id: "settings", label: "Settings", locked: true },
];

const HIDDEN_KEY = "socratic_rail_hidden";

/** Which rail items the user has unpinned. A per-device preference, so it
 * lives in localStorage; loaded after mount to keep the SSR markup stable. */
function useHiddenRailItems() {
  const [hidden, setHidden] = useState(() => new Set());
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]");
      if (Array.isArray(saved)) setHidden(new Set(saved));
    } catch {
      /* convenience only */
    }
  }, []);
  const update = useCallback((next) => {
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(next)));
    } catch {
      /* convenience only */
    }
  }, []);
  return [hidden, update];
}

function PinMenu({ x, y, targetId, hidden, onToggle, onShowAll, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Keep the menu on screen when the click was near the bottom of the rail.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos({
      left: Math.min(x, window.innerWidth - el.offsetWidth - 8),
      top: Math.max(8, Math.min(y, window.innerHeight - el.offsetHeight - 8)),
    });
  }, [x, y]);

  useEffect(() => {
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const target = [...SECTIONS, ...TOOLS].find((i) => i.id === targetId);

  const row = (item) => {
    const shown = !hidden.has(item.id);
    return (
      <button
        key={item.id}
        type="button"
        role="menuitemcheckbox"
        aria-checked={shown}
        disabled={item.locked}
        onClick={() => onToggle(item.id)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[12px] text-ink-200 hover:bg-ink-850 disabled:cursor-default disabled:text-ink-500 disabled:hover:bg-transparent"
      >
        <span
          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
            shown ? "border-duck-400 bg-duck-500 text-ink-950" : "border-ink-600 bg-ink-850"
          }`}
        >
          {shown && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        {item.locked && <Lock className="h-3 w-3 text-ink-600" />}
      </button>
    );
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Customise sidebar"
      style={{ left: pos.left, top: pos.top }}
      className="fixed z-[160] w-52 rounded-xl border border-ink-700 bg-ink-900 p-1.5 shadow-2xl"
    >
      {target && !target.locked && (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onToggle(target.id);
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-ink-100 hover:bg-ink-850"
          >
            <PinOff className="h-3.5 w-3.5 text-ink-400" /> Unpin {target.label}
          </button>
          <div className="my-1 border-t border-ink-800" />
        </>
      )}
      <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Show in sidebar</p>
      {SECTIONS.map(row)}
      <div className="my-1 border-t border-ink-800" />
      {TOOLS.map(row)}
      {hidden.size > 0 && (
        <>
          <div className="my-1 border-t border-ink-800" />
          <button
            type="button"
            role="menuitem"
            onClick={onShowAll}
            className="w-full rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-duck-400 hover:bg-ink-850"
          >
            Show everything
          </button>
        </>
      )}
    </div>
  );
}

function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function RailButton({ id, active, label, hint, icon: Icon, onClick, badge, accent = false, sublabel }) {
  return (
    <button
      type="button"
      data-rail-id={id}
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

  const [hidden, setHidden] = useHiddenRailItems();
  const [menu, setMenu] = useState(null); // { x, y, targetId }
  const closeMenu = useCallback(() => setMenu(null), []);
  const shown = (id) => !hidden.has(id);

  const toggleItem = (id) => {
    if (TOOLS.find((t) => t.id === id)?.locked) return;
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setHidden(next);
  };

  return (
    <nav
      aria-label="Primary"
      onContextMenu={(e) => {
        e.preventDefault();
        const targetId = e.target.closest?.("[data-rail-id]")?.dataset.railId || null;
        setMenu({ x: e.clientX, y: e.clientY, targetId });
      }}
      className="no-print flex h-full min-h-0 w-[68px] shrink-0 flex-col items-stretch overflow-y-auto overflow-x-hidden border-r border-ink-800 bg-ink-900 px-2 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
        {SECTIONS.filter((s) => shown(s.id)).map((s) => (
          <RailButton
            key={s.id}
            id={s.id}
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
        {shown("timer") && (
          <RailButton
            id="timer"
            label="Timer"
            hint={timerRunning ? `${primaryTimer.title} · ${formatClock(primaryTimer.secondsLeft)}` : "Focus timer"}
            icon={Clock}
            accent={timerRunning}
            sublabel={timerRunning ? formatClock(primaryTimer.secondsLeft) : "Timer"}
            onClick={() => onNavigate("calendar")}
          />
        )}
        {shown("capture") && (
          <RailButton id="capture" label="Capture" hint="Quick note (Ctrl+I)" icon={Zap} onClick={onOpenInstantNote} />
        )}
        {shown("search") && (
          <RailButton id="search" label="Search" hint="Search everything (Ctrl+K)" icon={Search} onClick={onOpenSearch} />
        )}
        {shown("theme") && (
          <RailButton
            id="theme"
            label={theme === "light" ? "Dark" : "Light"}
            hint="Switch theme"
            icon={theme === "light" ? Moon : Sun}
            onClick={onToggleTheme}
          />
        )}
        <RailButton id="settings" label="Settings" hint="Settings" icon={Settings} onClick={onOpenSettings} />
      </div>

      {menu && (
        <PinMenu
          x={menu.x}
          y={menu.y}
          targetId={menu.targetId}
          hidden={hidden}
          onToggle={toggleItem}
          onShowAll={() => {
            setHidden(new Set());
            closeMenu();
          }}
          onClose={closeMenu}
        />
      )}
    </nav>
  );
}

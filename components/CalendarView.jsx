"use client";

import { useEffect, useRef, useState } from "react";

// ─── Calendar & Pomodoro Timer View ──────────────────────────────────
// Features:
//   1. Full month toggling (Prev, Next, Today reset)
//   2. Dynamic addition, deletion, and Supabase / Local persistence of events
//   3. Integrated Pomodoro & Countdown Timer widget (25m Focus / 5m Break / Custom)
// ─────────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { id: "socratic", label: "Socratic Drill", icon: "🦆", badge: "bg-duck-500/20 text-duck-300 border-duck-500/30" },
  { id: "study", label: "Study Session", icon: "📚", badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
  { id: "deadline", label: "Deadline", icon: "⏰", badge: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  { id: "pomodoro", label: "Pomodoro Focus", icon: "🍅", badge: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { id: "lab", label: "Lab / Experiment", icon: "🧪", badge: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  { id: "exam", label: "Exam / Quiz", icon: "📝", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  { id: "group", label: "Group Review", icon: "👥", badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
];

function StudyTimerWidget() {
  const [mode, setMode] = useState("focus");
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [customMins, setCustomMins] = useState(10);
  const timerRef = useRef(null);

  const presets = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };

  function switchMode(newMode) {
    setIsActive(false);
    clearInterval(timerRef.current);
    setMode(newMode);
    if (newMode === "custom") {
      const secs = Math.max(1, customMins) * 60;
      setTotalSeconds(secs);
      setSecondsLeft(secs);
    } else {
      const secs = presets[newMode];
      setTotalSeconds(secs);
      setSecondsLeft(secs);
    }
  }

  function handleCustomChange(mins) {
    const validMins = Math.max(1, Math.min(180, Number(mins) || 1));
    setCustomMins(validMins);
    if (mode === "custom") {
      setIsActive(false);
      clearInterval(timerRef.current);
      const secs = validMins * 60;
      setTotalSeconds(secs);
      setSecondsLeft(secs);
    }
  }

  // Listen for timer extension events from Alarm Overlay
  useEffect(() => {
    function handleExtend(e) {
      const mins = e.detail?.minutes || 5;
      const addSecs = mins * 60;
      setTotalSeconds((prev) => prev + addSecs);
      setSecondsLeft(addSecs);
      setIsActive(true);
    }
    window.addEventListener("socratic_extend_timer", handleExtend);
    return () => window.removeEventListener("socratic_extend_timer", handleExtend);
  }, []);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isActive]);

  useEffect(() => {
    if (secondsLeft === 0 && isActive) {
      setIsActive(false);
      if (typeof window !== "undefined") {
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("socratic_alarm_triggered", {
              detail: {
                alarmType: "timer",
                title: "Timer Complete!",
                message: `Your ${mode.toUpperCase()} timer of ${Math.round(totalSeconds / 60)} minutes has finished.`,
              },
            })
          );
        }, 0);
      }
    }
  }, [secondsLeft, isActive, mode, totalSeconds]);

  function toggleTimer() {
    if (secondsLeft === 0) setSecondsLeft(totalSeconds);
    setIsActive((prev) => !prev);
  }

  function resetTimer() {
    setIsActive(false);
    clearInterval(timerRef.current);
    setSecondsLeft(totalSeconds);
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeFormatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const progressPercent = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0;

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between border-b border-ink-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">⏱️</span>
          <h2 className="text-sm font-semibold text-ink-100">Study & Pomodoro Timer</h2>
        </div>
        {secondsLeft === 0 && (
          <span className="animate-pulse rounded-full border border-duck-400/40 bg-duck-400/20 px-2 py-0.5 text-[10px] font-bold text-duck-300">
            🎉 Session Complete!
          </span>
        )}
      </div>

      <div className="mb-4 flex items-center justify-center gap-1.5 rounded-lg border border-ink-800 bg-ink-950 p-1">
        <button
          type="button"
          onClick={() => switchMode("focus")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            mode === "focus"
              ? "border border-amber-500/30 bg-amber-500/20 text-amber-300"
              : "text-ink-400 hover:text-ink-200"
          }`}
        >
          🍅 Focus (25m)
        </button>
        <button
          type="button"
          onClick={() => switchMode("short")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            mode === "short"
              ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
              : "text-ink-400 hover:text-ink-200"
          }`}
        >
          ☕ Short (5m)
        </button>
        <button
          type="button"
          onClick={() => switchMode("long")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            mode === "long"
              ? "border border-cyan-500/30 bg-cyan-500/20 text-cyan-300"
              : "text-ink-400 hover:text-ink-200"
          }`}
        >
          🌴 Long (15m)
        </button>
        <button
          type="button"
          onClick={() => switchMode("custom")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            mode === "custom"
              ? "border border-purple-500/30 bg-purple-500/20 text-purple-300"
              : "text-ink-400 hover:text-ink-200"
          }`}
        >
          ⚙️ Custom
        </button>
      </div>

      {mode === "custom" && (
        <div className="mb-4 flex items-center justify-center gap-2">
          <label className="text-xs text-ink-400">Duration (mins):</label>
          <input
            type="number"
            min="1"
            max="180"
            value={customMins}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="w-20 rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-center text-xs font-semibold text-ink-100 focus:border-duck-500/50 focus:outline-none"
          />
        </div>
      )}

      <div className="my-3 text-center">
        <div className="font-mono text-5xl font-extrabold tracking-tight text-ink-100">
          {timeFormatted}
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-800">
          <div
            className="h-full bg-duck-400 transition-all duration-300 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={toggleTimer}
          className={`w-28 rounded-lg px-4 py-2 text-xs font-semibold shadow-md transition-all ${
            isActive
              ? "border border-rose-500/40 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
              : "bg-duck-400 text-ink-950 hover:bg-duck-300"
          }`}
        >
          {isActive ? "⏸ Pause" : secondsLeft === 0 ? "🔄 Restart" : "▶ Start"}
        </button>

        <button
          type="button"
          onClick={resetTimer}
          className="rounded-lg border border-ink-700 bg-ink-850 px-3.5 py-2 text-xs font-medium text-ink-400 transition-colors hover:border-ink-600 hover:text-ink-200"
        >
          ↺ Reset
        </button>
      </div>
    </div>
  );
}

export default function CalendarView({ activeSpace }) {
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(6);
  const [selectedDate, setSelectedDate] = useState("2026-07-31");
  const [events, setEvents] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("socratic");
  const [newTime, setNewTime] = useState("10:00 AM");

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Fetch events from Supabase or localStorage on mount
  useEffect(() => {
    async function loadEvents() {
      try {
        const res = await fetch("/api/calendar/events");
        const data = await res.json();
        if (data.events && data.events.length > 0) {
          setEvents(data.events);
          localStorage.setItem("socratic_calendar_events", JSON.stringify(data.events));
        } else {
          const cached = localStorage.getItem("socratic_calendar_events");
          if (cached) setEvents(JSON.parse(cached));
        }
      } catch {
        const cached = localStorage.getItem("socratic_calendar_events");
        if (cached) setEvents(JSON.parse(cached));
      }
    }
    loadEvents();
  }, []);

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function goToday() {
    setCurrentYear(2026);
    setCurrentMonth(6);
    setSelectedDate("2026-07-31");
  }

  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) calendarCells.push(null);
  for (let day = 1; day <= totalDays; day++) {
    const formattedDay = String(day).padStart(2, "0");
    const formattedMonth = String(currentMonth + 1).padStart(2, "0");
    const dateStr = `${currentYear}-${formattedMonth}-${formattedDay}`;
    calendarCells.push({ day, dateStr });
  }

  async function handleAddEvent(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newEv = {
      id: `ev_${Date.now()}`,
      date: selectedDate,
      title: newTitle.trim(),
      type: newType,
      time: newTime,
      space: activeSpace || "School",
    };

    const nextEvents = [...events, newEv];
    setEvents(nextEvents);
    localStorage.setItem("socratic_calendar_events", JSON.stringify(nextEvents));
    setNewTitle("");
    setShowAddModal(false);

    try {
      await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", event: newEv }),
      });
    } catch {
      // Saved to local state & localStorage fallback
    }
  }

  async function handleDeleteEvent(eventId) {
    const nextEvents = events.filter((ev) => ev.id !== eventId);
    setEvents(nextEvents);
    localStorage.setItem("socratic_calendar_events", JSON.stringify(nextEvents));

    try {
      await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: eventId }),
      });
    } catch {
      // Saved to local state & localStorage fallback
    }
  }

  const selectedDateEvents = events.filter((ev) => ev.date === selectedDate);
  const getTypeObj = (typeId) => EVENT_TYPES.find((t) => t.id === typeId) || EVENT_TYPES[0];

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-100">
            Study Schedule & Timers
          </h1>
          <p className="mt-1 text-xs text-ink-400">
            Track Socratic drills, deadlines, and run Pomodoro focus sprints saved to Supabase.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-ink-800 bg-ink-900 p-1 shadow-md">
            <button
              type="button"
              onClick={prevMonth}
              title="Previous Month"
              className="rounded-md px-2 py-1 text-xs text-ink-400 hover:bg-ink-800 hover:text-ink-100"
            >
              ◀
            </button>
            <span className="px-3 text-xs font-bold text-duck-400">
              {monthNames[currentMonth]} {currentYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              title="Next Month"
              className="rounded-md px-2 py-1 text-xs text-ink-400 hover:bg-ink-800 hover:text-ink-100"
            >
              ▶
            </button>
          </div>

          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-ink-800 bg-ink-900 px-3 py-1.5 text-xs font-medium text-ink-300 hover:border-ink-700 hover:text-ink-100"
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-duck-400 px-3.5 py-2 text-xs font-semibold text-ink-950 shadow-md transition-opacity hover:opacity-90"
          >
            <span>＋</span>
            <span>Add Event</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-5 shadow-xl lg:col-span-2">
          <div className="mb-3 grid grid-cols-7 text-center text-xs font-medium text-ink-500">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {calendarCells.map((cell, idx) => {
              if (!cell) {
                return (
                  <div
                    key={`pad-${idx}`}
                    className="h-24 rounded-lg bg-ink-950/30 p-1.5"
                  />
                );
              }

              const isSelected = cell.dateStr === selectedDate;
              const isToday = cell.dateStr === "2026-07-31";
              const dayEvs = events.filter((ev) => ev.date === cell.dateStr);

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(cell.dateStr)}
                  className={`group relative flex h-24 flex-col justify-between rounded-lg border p-2 text-left transition-all ${
                    isSelected
                      ? "border-duck-500/60 bg-duck-500/10"
                      : isToday
                      ? "border-ink-700 bg-ink-850"
                      : "border-ink-800/60 bg-ink-950/50 hover:border-ink-700 hover:bg-ink-850/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        isToday
                          ? "bg-duck-400 font-bold text-ink-950"
                          : isSelected
                          ? "font-semibold text-duck-300"
                          : "text-ink-300"
                      }`}
                    >
                      {cell.day}
                    </span>
                    {dayEvs.length > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-duck-400" />
                    )}
                  </div>

                  <div className="space-y-1 overflow-hidden">
                    {dayEvs.slice(0, 2).map((ev) => {
                      const tObj = getTypeObj(ev.type);
                      return (
                        <div
                          key={ev.id}
                          className={`truncate rounded border px-1.5 py-0.5 text-[10px] font-medium ${tObj.badge}`}
                        >
                          {tObj.icon} {ev.title}
                        </div>
                      );
                    })}
                    {dayEvs.length > 2 && (
                      <p className="pl-1 text-[9px] font-medium text-ink-500">
                        +{dayEvs.length - 2} more
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <StudyTimerWidget />

          <div className="rounded-xl border border-ink-800 bg-ink-900 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b border-ink-800 pb-3">
              <h2 className="text-sm font-semibold text-ink-100">
                Agenda ({selectedDate})
              </h2>
              <span className="text-xs font-medium text-duck-400">
                {selectedDateEvents.length} Event{selectedDateEvents.length === 1 ? "" : "s"}
              </span>
            </div>

            {selectedDateEvents.length === 0 ? (
              <div className="py-6 text-center">
                <span className="text-2xl">📅</span>
                <p className="mt-2 text-xs text-ink-500">
                  No events scheduled for this date.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="mt-3 text-xs text-duck-400 hover:underline"
                >
                  + Add an event or drill
                </button>
              </div>
            ) : (
              <ul className="space-y-3">
                {selectedDateEvents.map((ev) => {
                  const tObj = getTypeObj(ev.type);
                  return (
                    <li
                      key={ev.id}
                      className="group rounded-lg border border-ink-800 bg-ink-850 p-3 transition-colors hover:border-ink-700"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${tObj.badge}`}
                        >
                          <span>{tObj.icon}</span>
                          <span>{tObj.label}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-ink-500">{ev.time}</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof window !== "undefined") {
                                setTimeout(() => {
                                  window.dispatchEvent(
                                    new CustomEvent("socratic_alarm_triggered", {
                                      detail: {
                                        alarmType: "event",
                                        title: `Event Alert: ${ev.title}`,
                                        message: `Scheduled ${tObj.label} event for ${ev.space} space at ${ev.time}.`,
                                      },
                                    })
                                  );
                                }, 0);
                              }
                            }}
                            title="Trigger Event Alarm"
                            className="text-xs text-amber-400/80 opacity-0 transition-opacity hover:scale-110 hover:text-amber-300 group-hover:opacity-100"
                          >
                            ⏰
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(ev.id)}
                            title="Delete Event"
                            className="text-xs text-ink-600 opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs font-medium leading-snug text-ink-100">
                        {ev.title}
                      </p>
                      <p className="mt-1 text-[10px] text-ink-500">
                        Space: {ev.space}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-ink-700 bg-ink-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink-800 pb-3">
              <h3 className="text-sm font-semibold text-ink-100">
                Add Event ({selectedDate})
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-ink-500 hover:text-ink-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-400">
                  Event Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Pomodoro Sprint or Socratic Quiz"
                  className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-400">
                    Event Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none"
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.icon} {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-400">
                    Time
                  </label>
                  <input
                    type="text"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    placeholder="10:00 AM"
                    className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg px-3 py-1.5 text-xs text-ink-400 hover:text-ink-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="rounded-lg bg-duck-400 px-4 py-1.5 text-xs font-semibold text-ink-950 disabled:opacity-40"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

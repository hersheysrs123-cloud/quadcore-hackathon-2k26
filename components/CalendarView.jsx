"use client";

import { useEffect, useRef, useState } from "react";
import {
  getCalendarEvents,
  saveCalendarEvent,
  deleteCalendarEvent,
  getAlarms,
  saveAlarm,
  deleteAlarm,
  toggleAlarm,
} from "@/lib/storageService";
import { Edit3, Trash2, Bell, Plus, Clock, Calendar as CalendarIcon, Check, Volume2 } from "lucide-react";
import { useGlobalTimer } from "@/lib/timerStore";

// ─── Constants ──────────────────────────────────────────────────────────────
const EVENT_TYPES = [
  { id: "socratic", label: "Socratic Drill", icon: "🦆", badge: "bg-duck-500/20 text-duck-300 border-duck-500/30" },
  { id: "study", label: "Study Session", icon: "📚", badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
  { id: "deadline", label: "Deadline", icon: "⏰", badge: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  { id: "pomodoro", label: "Pomodoro Focus", icon: "🍅", badge: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { id: "lab", label: "Lab / Experiment", icon: "🧪", badge: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  { id: "exam", label: "Exam / Quiz", icon: "📝", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  { id: "group", label: "Group Review", icon: "👥", badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
];

const DAY_LABELS = [
  { id: 0, short: "S", label: "Sun" },
  { id: 1, short: "M", label: "Mon" },
  { id: 2, short: "T", label: "Tue" },
  { id: 3, short: "W", label: "Wed" },
  { id: 4, short: "T", label: "Thu" },
  { id: 5, short: "F", label: "Fri" },
  { id: 6, short: "S", label: "Sat" },
];

// Helper to convert 24h "14:30" to 12h "2:30 PM"
function format24to12(timeStr) {
  if (!timeStr) return "12:00 AM";
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  const minuteStr = String(m || 0).padStart(2, "0");
  return `${hour12}:${minuteStr} ${period}`;
}

// ─── Real-Time Timer Widget ──────────────────────────────────────────────────
function StudyTimerWidget() {
  const {
    mode,
    totalSeconds,
    secondsLeft,
    isActive,
    isNearingEnd,
    percentLeft,
    customMins,
    togglePlayPause,
    resetTimer,
    extendTimer,
    startTimer,
    pausedSecondsLeft,
  } = useGlobalTimer();

  const [inputCustomMins, setInputCustomMins] = useState(customMins || 10);

  function handleCustomSubmit(e) {
    e.preventDefault();
    const valid = Math.max(1, Math.min(180, Number(inputCustomMins) || 10));
    startTimer("custom", valid);
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeFormatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <div className={`rounded-xl border p-5 shadow-xl transition-colors ${
      isNearingEnd
        ? "border-rose-500/60 bg-rose-500/10 ring-2 ring-rose-500/30 animate-pulse"
        : "border-ink-800 bg-ink-900"
    }`}>
      <div className="mb-4 flex items-center justify-between border-b border-ink-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">⏱️</span>
          <h2 className="text-sm font-semibold text-ink-100">Real-Time Study & Pomodoro Timer</h2>
        </div>
        {secondsLeft === 0 && (
          <span className="animate-pulse rounded-full border border-duck-400/40 bg-duck-400/20 px-2.5 py-0.5 text-[10px] font-bold text-duck-300">
            🎉 Session Complete!
          </span>
        )}
        {isNearingEnd && (
          <span className="animate-bounce rounded-full border border-rose-500/40 bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-bold text-rose-300">
            ⚠️ Nearing End!
          </span>
        )}
      </div>

      <div className="mb-4 flex items-center justify-center gap-1.5 rounded-lg border border-ink-800 bg-ink-950 p-1">
        <button
          type="button"
          onClick={() => startTimer("focus")}
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
          onClick={() => startTimer("short")}
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
          onClick={() => startTimer("long")}
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
          onClick={() => startTimer("custom", inputCustomMins)}
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
        <form onSubmit={handleCustomSubmit} className="mb-4 flex items-center justify-center gap-2">
          <label className="text-xs text-ink-400">Duration (mins):</label>
          <input
            type="number"
            min="1"
            max="180"
            value={inputCustomMins}
            onChange={(e) => setInputCustomMins(e.target.value)}
            className="w-20 rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-center text-xs font-semibold text-ink-100 focus:border-duck-500/50 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md border border-purple-500/40 bg-purple-500/20 px-2 py-1 text-[11px] font-semibold text-purple-300 hover:bg-purple-500/30"
          >
            Apply
          </button>
        </form>
      )}

      <div className="my-3 text-center">
        <div className={`font-mono text-5xl font-extrabold tracking-tight tabular-nums ${
          isNearingEnd ? "text-rose-400" : "text-ink-100"
        }`}>
          {timeFormatted}
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-800">
          <div
            className={`h-full transition-all duration-300 ease-linear ${
              isNearingEnd ? "bg-rose-500" : "bg-duck-400"
            }`}
            style={{ width: `${percentLeft}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => togglePlayPause()}
          className={`w-28 rounded-lg px-4 py-2 text-xs font-semibold shadow-md transition-all ${
            isActive
              ? "border border-rose-500/40 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
              : "bg-duck-400 text-ink-950 hover:bg-duck-300"
          }`}
        >
          {isActive ? "⏸ Pause" : secondsLeft === 0 ? "🔄 Restart" : pausedSecondsLeft !== null ? "▶ Resume" : "▶ Start"}
        </button>

        <button
          type="button"
          onClick={() => resetTimer()}
          className="rounded-lg border border-ink-700 bg-ink-850 px-3.5 py-2 text-xs font-medium text-ink-400 transition-colors hover:border-ink-600 hover:text-ink-200"
        >
          ↺ Reset
        </button>
      </div>
    </div>
  );
}

// ─── Regular Alarms Widget ──────────────────────────────────────────────────
function RegularAlarmsWidget({ alarms, onAddAlarm, onEditAlarm, onDeleteAlarm, onToggleAlarm }) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between border-b border-ink-800 pb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-duck-400" />
          <h2 className="text-sm font-semibold text-ink-100">Regular Alarms & Reminders</h2>
        </div>
        <button
          type="button"
          onClick={onAddAlarm}
          className="flex items-center gap-1 rounded-lg border border-duck-500/40 bg-duck-500/10 px-2.5 py-1 text-xs font-bold text-duck-300 hover:bg-duck-500/20 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Alarm</span>
        </button>
      </div>

      {alarms.length === 0 ? (
        <div className="py-6 text-center">
          <Bell className="mx-auto h-8 w-8 text-ink-600 mb-2" />
          <p className="text-xs text-ink-500">No regular alarms configured.</p>
          <button
            type="button"
            onClick={onAddAlarm}
            className="mt-2 text-xs font-semibold text-duck-400 hover:underline"
          >
            + Add a recurring daily or weekly alarm
          </button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {alarms.map((alarm) => {
            const daysList = Array.isArray(alarm.days) ? alarm.days : [0, 1, 2, 3, 4, 5, 6];
            return (
              <li
                key={alarm.id}
                className={`group flex items-center justify-between rounded-xl border p-3 transition-all ${
                  alarm.enabled
                    ? "border-ink-700 bg-ink-850"
                    : "border-ink-800/60 bg-ink-950/40 opacity-60"
                }`}
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-lg font-bold text-ink-100">
                      {format24to12(alarm.time)}
                    </span>
                    <span className="truncate text-xs font-medium text-ink-300">
                      {alarm.title || "Study Alarm"}
                    </span>
                  </div>

                  {/* Day badges */}
                  <div className="mt-1 flex items-center gap-1">
                    {DAY_LABELS.map((d) => {
                      const active = daysList.includes(d.id);
                      return (
                        <span
                          key={d.id}
                          className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold ${
                            active
                              ? alarm.enabled
                                ? "bg-duck-400 text-ink-950"
                                : "bg-ink-700 text-ink-300"
                              : "bg-ink-950 text-ink-600"
                          }`}
                          title={d.label}
                        >
                          {d.short}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Test Alarm Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("socratic_alarm_triggered", {
                            detail: {
                              alarmType: "regular_alarm",
                              title: `Test Alarm: ${alarm.title}`,
                              message: `Testing regular alarm set for ${format24to12(alarm.time)}.`,
                            },
                          })
                        );
                      }
                    }}
                    title="Test Sound & Overlay"
                    className="p-1 text-ink-500 hover:text-amber-400 transition-colors"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => onEditAlarm(alarm)}
                    title="Edit Alarm"
                    className="p-1 text-ink-500 hover:text-duck-300 transition-colors"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => onDeleteAlarm(alarm.id)}
                    title="Delete Alarm"
                    className="p-1 text-ink-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => onToggleAlarm(alarm.id)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      alarm.enabled ? "bg-duck-400" : "bg-ink-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-ink-950 shadow ring-0 transition duration-200 ease-in-out ${
                        alarm.enabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Add/Edit Event Modal ───────────────────────────────────────────────────
function EventModal({ open, eventData, selectedDate, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("socratic");
  const [time, setTime] = useState("10:00 AM");
  const [date, setDate] = useState(selectedDate || "2026-07-31");
  const [space, setSpace] = useState("School");

  useEffect(() => {
    if (open) {
      if (eventData) {
        setTitle(eventData.title || "");
        setType(eventData.type || "socratic");
        setTime(eventData.time || "10:00 AM");
        setDate(eventData.date || selectedDate || "2026-07-31");
        setSpace(eventData.space || "School");
      } else {
        setTitle("");
        setType("socratic");
        setTime("10:00 AM");
        setDate(selectedDate || "2026-07-31");
        setSpace("School");
      }
    }
  }, [open, eventData, selectedDate]);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      id: eventData?.id || `evt_${Date.now()}`,
      title: title.trim(),
      type,
      time: time.trim(),
      date,
      space,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-ink-700 bg-ink-900 p-6 shadow-2xl animate-fade-up">
        <div className="flex items-center justify-between border-b border-ink-800 pb-3">
          <h3 className="text-sm font-semibold text-ink-100">
            {eventData ? "Edit Calendar Event" : `Add Event (${date})`}
          </h3>
          <button type="button" onClick={onClose} className="text-ink-500 hover:text-ink-200">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-400">Event Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Socratic Quiz or Exam Review"
              className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-400">Event Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
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
              <label className="mb-1 block text-xs font-medium text-ink-400">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-400">Time</label>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="10:00 AM"
                className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink-400">Space</label>
              <input
                type="text"
                value={space}
                onChange={(e) => setSpace(e.target.value)}
                placeholder="School"
                className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-ink-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs text-ink-400 hover:text-ink-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="rounded-lg bg-duck-400 px-4 py-1.5 text-xs font-semibold text-ink-950 disabled:opacity-40"
            >
              {eventData ? "Update Event" : "Save Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add/Edit Regular Alarm Modal ──────────────────────────────────────────
function AlarmModal({ open, alarmData, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("08:00");
  const [days, setDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (open) {
      if (alarmData) {
        setTitle(alarmData.title || "");
        setTime(alarmData.time || "08:00");
        setDays(Array.isArray(alarmData.days) ? alarmData.days : [0, 1, 2, 3, 4, 5, 6]);
        setEnabled(alarmData.enabled !== undefined ? alarmData.enabled : true);
      } else {
        setTitle("Morning Study Review");
        setTime("08:00");
        setDays([0, 1, 2, 3, 4, 5, 6]);
        setEnabled(true);
      }
    }
  }, [open, alarmData]);

  if (!open) return null;

  function toggleDay(dayId) {
    setDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId].sort()
    );
  }

  function selectQuick(type) {
    if (type === "all") setDays([0, 1, 2, 3, 4, 5, 6]);
    if (type === "weekdays") setDays([1, 2, 3, 4, 5]);
    if (type === "weekends") setDays([0, 6]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      id: alarmData?.id || `alarm_${Date.now()}`,
      title: title.trim() || "Study Alarm",
      time,
      days,
      enabled,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-ink-700 bg-ink-900 p-6 shadow-2xl animate-fade-up">
        <div className="flex items-center justify-between border-b border-ink-800 pb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-duck-400" />
            <h3 className="text-sm font-semibold text-ink-100">
              {alarmData ? "Edit Regular Alarm" : "New Regular Alarm"}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-ink-500 hover:text-ink-200">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-400">Alarm Label</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Daily Math Review"
              className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-ink-100 focus:border-duck-500/50 focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-400">Time (24h format)</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm font-mono font-bold text-ink-100 focus:border-duck-500/50 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-ink-400">Repeat Days</label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => selectQuick("all")}
                  className="text-[10px] text-duck-400 hover:underline"
                >
                  Every Day
                </button>
                <span className="text-[10px] text-ink-600">•</span>
                <button
                  type="button"
                  onClick={() => selectQuick("weekdays")}
                  className="text-[10px] text-duck-400 hover:underline"
                >
                  Weekdays
                </button>
                <span className="text-[10px] text-ink-600">•</span>
                <button
                  type="button"
                  onClick={() => selectQuick("weekends")}
                  className="text-[10px] text-duck-400 hover:underline"
                >
                  Weekends
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {DAY_LABELS.map((d) => {
                const active = days.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDay(d.id)}
                    className={`flex flex-col items-center justify-center rounded-lg border py-2 text-xs transition-all ${
                      active
                        ? "border-duck-500/60 bg-duck-500/20 text-duck-300 font-bold"
                        : "border-ink-800 bg-ink-850 text-ink-500 hover:border-ink-700"
                    }`}
                  >
                    <span>{d.short}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="alarm-enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-ink-700 bg-ink-850 text-duck-400 focus:ring-0"
            />
            <label htmlFor="alarm-enabled" className="text-xs text-ink-300 font-medium">
              Enable Alarm Immediately
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-ink-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs text-ink-400 hover:text-ink-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-duck-400 px-4 py-1.5 text-xs font-semibold text-ink-950"
            >
              {alarmData ? "Update Alarm" : "Save Alarm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main CalendarView Export ───────────────────────────────────────────────
export default function CalendarView({ activeSpace = "School", onNavigateNote }) {
  const today = new Date();
  const initialYear = today.getFullYear();
  const initialMonth = today.getMonth();
  const initialFormattedDay = String(today.getDate()).padStart(2, "0");
  const initialFormattedMonth = String(today.getMonth() + 1).padStart(2, "0");
  const initialDateStr = `${initialYear}-${initialFormattedMonth}-${initialFormattedDay}`;

  const [currentYear, setCurrentYear] = useState(initialYear);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState(initialDateStr);
  const [events, setEvents] = useState([]);
  const [alarms, setAlarms] = useState([]);

  // Modal controls
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const [alarmModalOpen, setAlarmModalOpen] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState(null);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Fetch events & alarms from Dexie on mount
  useEffect(() => {
    async function loadData() {
      try {
        const localEvts = await getCalendarEvents();
        if (Array.isArray(localEvts)) setEvents(localEvts);

        const localAlarms = await getAlarms();
        if (Array.isArray(localAlarms)) setAlarms(localAlarms);
      } catch (err) {
        console.error("Failed to load calendar data:", err);
      }
    }
    loadData();
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
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    const formattedDay = String(today.getDate()).padStart(2, "0");
    const formattedMonth = String(today.getMonth() + 1).padStart(2, "0");
    setSelectedDate(`${today.getFullYear()}-${formattedMonth}-${formattedDay}`);
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

  // Event handlers
  async function handleSaveEvent(evData) {
    const saved = await saveCalendarEvent(evData);
    setEvents((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [...prev, saved];
    });
  }

  async function handleDeleteEvent(eventId) {
    setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
    await deleteCalendarEvent(eventId);
  }

  // Alarm handlers
  async function handleSaveAlarm(alarmData) {
    const saved = await saveAlarm(alarmData);
    setAlarms((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [...prev, saved];
    });
  }

  async function handleDeleteAlarm(alarmId) {
    setAlarms((prev) => prev.filter((a) => a.id !== alarmId));
    await deleteAlarm(alarmId);
  }

  async function handleToggleAlarm(alarmId) {
    setAlarms((prev) =>
      prev.map((a) => (a.id === alarmId ? { ...a, enabled: !a.enabled } : a))
    );
    await toggleAlarm(alarmId);
  }

  const selectedDateEvents = events.filter((ev) => ev.date === selectedDate);
  const getTypeObj = (typeId) => EVENT_TYPES.find((t) => t.id === typeId) || EVENT_TYPES[0];

  return (
    <div className="mx-auto max-w-6xl px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-100">
            Study Schedule, Timers &amp; Alarms
          </h1>
          <p className="mt-1 text-xs text-ink-400">
            Manage drills, Pomodoro focus sprints, and recurring alarms stored 100% locally in IndexedDB.
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
            onClick={() => {
              setEditingEvent(null);
              setEventModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-duck-400 px-3.5 py-2 text-xs font-semibold text-ink-950 shadow-md transition-opacity hover:opacity-90"
          >
            <span>＋</span>
            <span>Add Event</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Month Grid */}
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
                  <div key={`pad-${idx}`} className="h-24 rounded-lg bg-ink-950/30 p-1.5" />
                );
              }

              const isSelected = cell.dateStr === selectedDate;
              const todayObj = new Date();
              const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, "0")}-${String(todayObj.getDate()).padStart(2, "0")}`;
              const isToday = cell.dateStr === todayStr;
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
                    {dayEvs.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-duck-400" />}
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

        {/* Sidebar Widgets (Timer + Alarms + Agenda) */}
        <div className="space-y-6">
          <StudyTimerWidget />

          <RegularAlarmsWidget
            alarms={alarms}
            onAddAlarm={() => {
              setEditingAlarm(null);
              setAlarmModalOpen(true);
            }}
            onEditAlarm={(alarm) => {
              setEditingAlarm(alarm);
              setAlarmModalOpen(true);
            }}
            onDeleteAlarm={handleDeleteAlarm}
            onToggleAlarm={handleToggleAlarm}
          />

          {/* Agenda */}
          <div className="rounded-xl border border-ink-800 bg-ink-900 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b border-ink-800 pb-3">
              <h2 className="text-sm font-semibold text-ink-100">Agenda ({selectedDate})</h2>
              <span className="text-xs font-medium text-duck-400">
                {selectedDateEvents.length} Event{selectedDateEvents.length === 1 ? "" : "s"}
              </span>
            </div>

            {selectedDateEvents.length === 0 ? (
              <div className="py-6 text-center">
                <CalendarIcon className="mx-auto h-8 w-8 text-ink-600 mb-2" />
                <p className="text-xs text-ink-500">No events scheduled for this date.</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingEvent(null);
                    setEventModalOpen(true);
                  }}
                  className="mt-2 text-xs font-semibold text-duck-400 hover:underline"
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
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-ink-500">{ev.time}</span>

                          {/* Test Trigger */}
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof window !== "undefined") {
                                window.dispatchEvent(
                                  new CustomEvent("socratic_alarm_triggered", {
                                    detail: {
                                      alarmType: "event",
                                      title: `Event Alert: ${ev.title}`,
                                      message: `Scheduled ${tObj.label} event for ${ev.space || "School"} space at ${ev.time}.`,
                                    },
                                  })
                                );
                              }
                            }}
                            title="Trigger Event Alarm"
                            className="p-1 text-ink-500 hover:text-amber-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Bell className="h-3.5 w-3.5" />
                          </button>

                          {/* Edit Event */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEvent(ev);
                              setEventModalOpen(true);
                            }}
                            title="Edit Event"
                            className="p-1 text-ink-500 hover:text-duck-300 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>

                          {/* Delete Event */}
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(ev.id)}
                            title="Delete Event"
                            className="p-1 text-ink-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs font-medium leading-snug text-ink-100">
                        {ev.title}
                      </p>
                      <p className="mt-1 text-[10px] text-ink-500">Space: {ev.space || "School"}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Event Add/Edit Modal */}
      <EventModal
        open={eventModalOpen}
        eventData={editingEvent}
        selectedDate={selectedDate}
        onClose={() => {
          setEventModalOpen(false);
          setEditingEvent(null);
        }}
        onSave={handleSaveEvent}
      />

      {/* Alarm Add/Edit Modal */}
      <AlarmModal
        open={alarmModalOpen}
        alarmData={editingAlarm}
        onClose={() => {
          setAlarmModalOpen(false);
          setEditingAlarm(null);
        }}
        onSave={handleSaveAlarm}
      />
    </div>
  );
}

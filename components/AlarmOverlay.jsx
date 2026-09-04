"use client";

import { useEffect, useRef, useState } from "react";

// ─── AlarmOverlay ───────────────────────────────────────────────────
// Features:
//   1. Full-screen visual alarm modal with flashing alert visuals
//   2. Dynamic browser favicon swap: Normal Duck (🦆) <-> Alarm Exclamation (❗️)
//   3. Dynamic browser title update: "🚨 ALARM TRIGGERED! — SocraticOS"
//   4. Web Audio API chime sound generator
//   5. Timer extension (+1, +2, +5, +10 mins) & Event snooze (5, 10, 15, 20, 30 mins)
// ─────────────────────────────────────────────────────────────────────

const DUCK_FAVICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🦆</text></svg>";
const CHIME_FAVICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>☕</text></svg>";

function setFavicon(url) {
  if (typeof document === "undefined") return;
  let link = document.querySelector("link[rel*='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "shortcut icon";
    document.getElementsByTagName("head")[0].appendChild(link);
  }
  link.href = url;
}

function playAlarmChime() {
  if (typeof window === "undefined") return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    // Pleasant C-major triad gentle bell chime
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.12, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.75);
    });
  } catch {
    // Audio context fallback
  }
}

export default function AlarmOverlay() {
  const [alarm, setAlarm] = useState(null);
  const snoozeTimerRef = useRef(null);
  const lastTriggeredRef = useRef(new Set());

  // Set default Duck favicon on mount
  useEffect(() => {
    setFavicon(DUCK_FAVICON);
  }, []);

  // Real-time Background Alarm Checker (runs every 5s)
  useEffect(() => {
    let intervalId;
    async function checkAlarms() {
      if (typeof window === "undefined") return;
      try {
        const { getAlarms } = await import("@/lib/storageService");
        const alarms = await getAlarms();

        const now = new Date();
        const currentHours = String(now.getHours()).padStart(2, "0");
        const currentMinutes = String(now.getMinutes()).padStart(2, "0");
        const currentTimeStr = `${currentHours}:${currentMinutes}`;
        const currentDay = now.getDay(); // 0 = Sun .. 6 = Sat
        const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

        for (const a of alarms) {
          if (!a.enabled) continue;
          const daysList = Array.isArray(a.days) ? a.days : [0, 1, 2, 3, 4, 5, 6];

          if (a.time === currentTimeStr && daysList.includes(currentDay)) {
            const triggerKey = `${a.id}_${dateKey}_${currentTimeStr}`;
            if (!lastTriggeredRef.current.has(triggerKey)) {
              lastTriggeredRef.current.add(triggerKey);

              // Limit size of set to prevent memory growth
              if (lastTriggeredRef.current.size > 100) {
                lastTriggeredRef.current.clear();
                lastTriggeredRef.current.add(triggerKey);
              }

              window.dispatchEvent(
                new CustomEvent("socratic_alarm_triggered", {
                  detail: {
                    alarmType: "regular_alarm",
                    title: `Alarm: ${a.title || "Scheduled Study Session"}`,
                    message: `Scheduled alert for ${a.time}. Take a breath and review!`,
                  },
                })
              );
            }
          }
        }
      } catch (err) {
        console.error("Error in alarm background check:", err);
      }
    }

    intervalId = setInterval(checkAlarms, 5000);
    checkAlarms(); // Check immediately on mount

    return () => clearInterval(intervalId);
  }, []);

  // Listen for socratic_alarm_triggered events
  useEffect(() => {
    function handleAlarmEvent(e) {
      const { title, message, alarmType } = e.detail || {};
      setAlarm({
        alarmType: alarmType || "timer",
        title: title || "Study Interval Complete!",
        message: message || "Great focus session! Time to take a breather or review.",
      });

      // Swap tab favicon to gentle chime ☕
      setFavicon(CHIME_FAVICON);

      // Update browser title calmly
      document.title = "⏰ Study Break / Timer Complete — SocraticOS";

      // Play soft chime
      playAlarmChime();
    }

    window.addEventListener("socratic_alarm_triggered", handleAlarmEvent);
    return () => window.removeEventListener("socratic_alarm_triggered", handleAlarmEvent);
  }, []);

  function handleDismiss() {
    setAlarm(null);
    // Restore normal Duck favicon 🦆
    setFavicon(DUCK_FAVICON);
    // Restore normal document title
    document.title = "SocraticOS — AI-Powered Learning Environment";
  }

  function handleExtendTimer(minutes) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("socratic_extend_timer", {
          detail: { minutes },
        })
      );
    }
    handleDismiss();
  }

  function handleSnoozeEvent(minutes) {
    if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
    const ms = minutes * 60 * 1000;
    const currentAlarm = alarm;

    snoozeTimerRef.current = setTimeout(() => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("socratic_alarm_triggered", {
            detail: {
              alarmType: "event",
              title: currentAlarm?.title || "Snoozed Event Alert",
              message: `Snoozed alert (${minutes} mins) for scheduled event.`,
            },
          })
        );
      }
    }, ms);

    handleDismiss();
  }

  if (!alarm) return null;

  const isTimer = alarm.alarmType === "timer";

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-ink-950/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="flex w-full max-w-md flex-col items-center text-center space-y-4 bg-ink-900 p-6 rounded-2xl border border-duck-500/30 shadow-2xl">
        <div className="flex items-center justify-center gap-3 text-3xl">
          <span>✨</span>
          <span className="text-4xl">☕</span>
          <span>🌱</span>
        </div>

        <div>
          <span className="rounded-full bg-duck-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-duck-300 border border-duck-500/40">
            {isTimer ? "Session Interval Complete" : "Scheduled Study Event"}
          </span>
          <h2 className="mt-2.5 text-xl font-bold tracking-tight text-ink-100">
            {alarm.title}
          </h2>
          <p className="mt-1 text-xs text-ink-400 leading-relaxed max-w-sm mx-auto">
            {alarm.message}
          </p>
        </div>

        {/* Dynamic Action Buttons */}
        {isTimer ? (
          <div className="w-full space-y-2 rounded-xl border border-ink-800 bg-ink-950/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Add Extra Study Minutes:
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 5, 10].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleExtendTimer(mins)}
                  className="rounded-lg border border-ink-700 bg-ink-850 py-1.5 text-xs font-semibold text-duck-300 hover:bg-ink-800 hover:border-duck-500/40 transition-all active:scale-95"
                >
                  +{mins}m
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full space-y-2 rounded-xl border border-ink-800 bg-ink-950/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Snooze Event:
            </p>
            <div className="grid grid-cols-5 gap-1">
              {[5, 10, 15, 20, 30].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleSnoozeEvent(mins)}
                  className="rounded-lg border border-ink-700 bg-ink-850 py-1.5 text-[11px] font-semibold text-ink-300 hover:bg-ink-800 hover:text-ink-100 transition-all active:scale-95"
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          className="w-full rounded-xl bg-duck-500 hover:bg-duck-400 py-2.5 text-xs font-bold text-ink-950 shadow-md transition-all hover:brightness-105 active:scale-95"
        >
          {isTimer ? "Dismiss & Continue" : "Got It"}
        </button>
      </div>
    </div>
  );
}

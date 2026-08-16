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
const EXCLAMATION_FAVICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>❗️</text></svg>";

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
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(1318.5, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Fallback
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
                    title: `Alarm: ${a.title || "Scheduled Alarm"}`,
                    message: `Regular alarm set for ${a.time} is triggering!`,
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
        title: title || "Timer Complete!",
        message: message || "Timer or scheduled event alert has occurred.",
      });

      // Swap tab favicon to Exclamation ❗️
      setFavicon(EXCLAMATION_FAVICON);

      // Update browser title
      document.title = "🚨 ALARM TRIGGERED! — SocraticOS";

      // Play chime
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
              title: currentAlarm?.title || "Snoozed Event Alert!",
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-rose-950/85 backdrop-blur-xl border-8 border-rose-500 animate-pulse text-white shadow-2xl p-6 transition-all">
      <div className="flex w-full max-w-lg flex-col items-center text-center space-y-5 bg-ink-950/90 p-7 rounded-3xl border border-rose-500/40 shadow-2xl">
        <div className="flex items-center justify-center gap-4 text-5xl">
          <span>🚨</span>
          <span className="animate-bounce">⏰</span>
          <span>❗️</span>
        </div>

        <div>
          <span className="rounded-full bg-rose-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-300 border border-rose-500/40">
            {isTimer ? "Timer Alert" : "Event Alarm"}
          </span>
          <h1 className="mt-2.5 text-2xl font-extrabold tracking-tight text-white">
            {alarm.title}
          </h1>
          <p className="mt-1.5 text-xs text-rose-200 leading-relaxed">
            {alarm.message}
          </p>
        </div>

        {/* Dynamic Action Buttons based on alarm type */}
        {isTimer ? (
          <div className="w-full space-y-2 rounded-2xl border border-rose-500/30 bg-rose-900/20 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-300">
              Add Extra Time:
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 5, 10].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleExtendTimer(mins)}
                  className="rounded-xl border border-rose-400/40 bg-rose-500/20 py-2 text-xs font-bold text-white transition-all hover:bg-rose-500/30 hover:scale-105 active:scale-95 shadow-sm"
                >
                  +{mins} Min{mins > 1 ? "s" : ""}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full space-y-2 rounded-2xl border border-amber-500/30 bg-amber-900/20 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
              Snooze Event Alert:
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {[5, 10, 15, 20, 30].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleSnoozeEvent(mins)}
                  className="rounded-xl border border-amber-500/40 bg-amber-500/20 py-2 text-[11px] font-bold text-amber-200 transition-all hover:bg-amber-500/30 hover:scale-105 active:scale-95 shadow-sm"
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
          className="w-full rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 py-3.5 text-sm font-extrabold text-white shadow-xl transition-all hover:scale-[1.02] hover:brightness-110 active:scale-95"
        >
          Dismiss Alarm
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { scoreStatus } from "@/lib/mastery";

const SIZES = {
  sm: { box: 56, stroke: 5, text: "text-base" },
  md: { box: 84, stroke: 6, text: "text-2xl" },
  lg: { box: 112, stroke: 8, text: "text-4xl" },
};

/**
 * A single number, drawn as a ring.
 *
 * The arc is redundant with the digits on purpose — it is the "at a glance"
 * read, and the digits are the precise one. The colour is a third channel and
 * never the only one: the number is always legible on its own.
 */
export default function ScoreRing({ score, size = "md", label }) {
  const { box, stroke, text } = SIZES[size] ?? SIZES.md;
  const status = scoreStatus(score);

  const radius = (box - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Sweep up from zero on mount so the result lands rather than appears.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(score));
    return () => cancelAnimationFrame(id);
  }, [score]);

  const offset = circumference * (1 - Math.max(0, Math.min(100, shown)) / 100);

  return (
    <div
      className="relative shrink-0"
      style={{ width: box, height: box }}
      role="img"
      aria-label={`${score} out of 100 — ${status.label}`}
    >
      <svg width={box} height={box} className="-rotate-90">
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-ink-800"
        />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${status.text} transition-[stroke-dashoffset] duration-700 ease-out`}
          stroke="currentColor"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-semibold tabular-nums ${text} ${status.text}`}>
          {score}
        </span>
        {label && (
          <span className="text-[9px] uppercase tracking-wider text-ink-600">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

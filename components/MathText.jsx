"use client";

import React, { useMemo, memo } from "react";
import "katex/dist/katex.min.css";
import { renderKatexToStringMemoized } from "@/lib/editorCaret";
import { parseMathSegments } from "@/lib/mathUtils";

const MathText = memo(function MathText({ text, className = "" }) {
  const segments = useMemo(() => parseMathSegments(text), [text]);

  if (!segments || segments.length === 0) return null;

  return (
    <span className={`katex-text-container ${className}`}>
      {segments.map((seg, idx) => {
        if (seg.type === "text") {
          return <React.Fragment key={idx}>{seg.content}</React.Fragment>;
        }

        const isDisplay = seg.type === "display_math";
        const html = renderKatexToStringMemoized(seg.content, {
          displayMode: isDisplay,
        });

        if (isDisplay) {
          return (
            <span
              key={idx}
              className="block my-2 overflow-x-auto overflow-y-hidden text-center py-1 select-text"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }

        return (
          <span
            key={idx}
            className="inline-block align-baseline mx-0.5 select-text"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
});

export default MathText;

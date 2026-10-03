"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import {
  buildLineSegments,
  bucketAnnotationsByLine,
  numberMap,
  orderAnnotations,
  trimRange,
} from "@/lib/literature";

/**
 * PoemCanvas — the poem itself, plus the browser-selection → poem-range
 * mapping that everything else in the Literature section depends on.
 *
 * The rendered DOM is a deliberate contract, not an implementation detail:
 *
 *   .lit-line[data-line]          one poem line, 0-based
 *     .lit-seg[data-start][data-end]   a run of text with a fixed coverage set
 *     .lit-marker[data-id][data-at]    a superscript number, TEXT-FREE
 *
 * `data-start` lets us turn a DOM node + offset straight back into a character
 * offset within the line without walking text. The markers must stay text-free
 * (their digits come from a CSS pseudo-element) or they would contribute
 * characters to the line and shift every offset after them.
 */
const PoemCanvas = forwardRef(function PoemCanvas(
  {
    poem,
    hotIds = [],
    openAnnId = null,
    onSelectionChange,
    onSegmentClick,
    onMarkerClick,
    onHoverIds,
    onBackgroundClick,
  },
  ref
) {
  const rootRef = useRef(null);
  const mouseDownRef = useRef(false);

  const numbers = useMemo(
    () => (poem ? numberMap(orderAnnotations(poem.annotations || [])) : {}),
    [poem]
  );

  const lines = useMemo(() => {
    if (!poem) return [];
    const byLine = bucketAnnotationsByLine(poem);
    return poem.lines.map((text, i) => {
      const built = buildLineSegments(i, text, byLine[i] || []);
      /* Two annotations can end on the same character: show them in number
         order so the superscripts read 3,4 rather than 4,3. */
      const markers = built.markers
        .slice()
        .sort((a, b) => a.at - b.at || (numbers[a.id] || 0) - (numbers[b.id] || 0));
      return { text, segments: built.segments, markers };
    });
  }, [poem, numbers]);

  /* ── selection → range ─────────────────────────────────────── */

  const lineElOf = useCallback((node) => {
    if (!node) return null;
    const e = node.nodeType === 3 ? node.parentElement : node;
    return e?.closest ? e.closest(".lit-line") : null;
  }, []);

  const offsetInLine = useCallback((lineEl, node, offset) => {
    let total = 0;
    if (node.nodeType === 3) {
      const seg = node.parentElement?.closest(".lit-seg");
      if (seg) return Number(seg.dataset.start) + Math.min(offset, node.length);
      return Math.min(offset, node.length);
    }
    if (node === lineEl) {
      for (let i = 0; i < Math.min(offset, node.childNodes.length); i++) {
        total += node.childNodes[i].textContent.length;
      }
      return total;
    }
    if (node.classList?.contains("lit-marker")) {
      return parseInt(node.dataset.at, 10) || 0;
    }
    const seg2 = node.closest ? node.closest(".lit-seg") : null;
    if (seg2) {
      for (let i = 0; i < Math.min(offset, node.childNodes.length); i++) {
        total += node.childNodes[i].textContent.length;
      }
      return Number(seg2.dataset.start) + total;
    }
    return 0;
  }, []);

  const resolveEdge = useCallback(
    (container, offset, isEnd) => {
      const lineEl = lineElOf(container);
      if (lineEl) {
        return { line: Number(lineEl.dataset.line), char: offsetInLine(lineEl, container, offset) };
      }
      /* The selection anchored on the poem container itself (a drag that ran
         past the last line, usually). Snap to a whole line edge. */
      if (container === rootRef.current) {
        const kids = rootRef.current.childNodes;
        if (!kids.length) return null;
        const idx = isEnd
          ? Math.max(0, Math.min(offset, kids.length) - 1)
          : Math.max(0, Math.min(offset, kids.length - 1));
        const le = kids[idx];
        if (!le?.dataset) return null;
        return { line: Number(le.dataset.line), char: isEnd ? le.textContent.length : 0 };
      }
      return null;
    },
    [lineElOf, offsetInLine]
  );

  const currentSelectionRange = useCallback(() => {
    if (!poem || !rootRef.current) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const r = sel.getRangeAt(0);
    const cac = r.commonAncestorContainer;
    if (cac !== rootRef.current && !rootRef.current.contains(cac)) return null;
    const a = resolveEdge(r.startContainer, r.startOffset, false);
    const b = resolveEdge(r.endContainer, r.endOffset, true);
    if (!a || !b) return null;
    return trimRange(poem.lines, {
      startLine: a.line,
      startChar: a.char,
      endLine: b.line,
      endChar: b.char,
    });
  }, [poem, resolveEdge]);

  const selectionRect = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const rects = sel.getRangeAt(0).getClientRects();
    if (rects.length) {
      /* Anchor to the LAST line of the selection so the floating button never
         covers the words the user just chose. */
      const last = rects[rects.length - 1];
      return {
        left: last.left,
        right: last.right,
        top: last.top,
        bottom: last.bottom,
        width: last.width,
        height: last.height,
      };
    }
    const r = sel.getRangeAt(0).getBoundingClientRect();
    return r.width || r.height ? r : null;
  }, []);

  const selectionAnchorInPoem = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.anchorNode) return false;
    const n = sel.anchorNode;
    const e = n.nodeType === 3 ? n.parentElement : n;
    return Boolean(e && rootRef.current?.contains(e));
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getSelectionRange: currentSelectionRange,
      getSelectionRect: selectionRect,
      isAnchoredInPoem: selectionAnchorInPoem,
      clearSelection() {
        const sel = window.getSelection();
        if (sel?.removeAllRanges) sel.removeAllRanges();
      },
      /** Client rect of any element showing this annotation, for anchoring. */
      rectForAnnotation(annId) {
        const root = rootRef.current;
        if (!root) return null;
        const node =
          root.querySelector(`.lit-seg[data-ids~="${annId}"]`) ||
          root.querySelector(`.lit-marker[data-id="${annId}"]`);
        return node ? node.getBoundingClientRect() : null;
      },
      scrollToAnnotation(annId) {
        const node = rootRef.current?.querySelector(`.lit-seg[data-ids~="${annId}"]`);
        if (node) node.scrollIntoView({ block: "center", behavior: "smooth" });
        return Boolean(node);
      },
    }),
    [currentSelectionRange, selectionRect, selectionAnchorInPoem]
  );

  /* Selection lives on the document, not on this element, so it has to be
     tracked globally. `mouseDown` suppresses updates mid-drag, which would
     otherwise fire a range per pixel. */
  useEffect(() => {
    const report = () =>
      onSelectionChange?.({
        range: currentSelectionRange(),
        rect: selectionRect(),
        anchoredInPoem: selectionAnchorInPoem(),
      });

    const onDown = () => {
      mouseDownRef.current = true;
    };
    const onUp = () => {
      mouseDownRef.current = false;
      setTimeout(report, 0);
    };
    const onSelChange = () => {
      if (mouseDownRef.current) return;
      setTimeout(report, 0);
    };

    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("selectionchange", onSelChange);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("selectionchange", onSelChange);
    };
  }, [currentSelectionRange, selectionRect, selectionAnchorInPoem, onSelectionChange]);

  /* ── hot / open classes ────────────────────────────────────── */

  /* Applied imperatively rather than through render props: a poem can hold
     hundreds of segments and hovering must not re-render the whole canvas. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const set = new Set(hotIds);
    root.querySelectorAll(".lit-seg.has-ann").forEach((s) => {
      const ids = (s.dataset.ids || "").split(" ").filter(Boolean);
      s.classList.toggle("is-hot", ids.some((id) => set.has(id)));
      s.classList.toggle("is-open", Boolean(openAnnId) && ids.includes(openAnnId));
    });
    root.querySelectorAll(".lit-marker").forEach((m) => {
      m.classList.toggle("is-hot", set.has(m.dataset.id));
      m.classList.toggle("is-open", m.dataset.id === openAnnId);
    });
  }, [hotIds, openAnnId, lines]);

  /* ── pointer handlers ──────────────────────────────────────── */

  const handleClick = useCallback(
    (e) => {
      const marker = e.target.closest?.(".lit-marker");
      if (marker) {
        e.preventDefault();
        onMarkerClick?.(marker.dataset.id, marker.getBoundingClientRect());
        return;
      }
      const seg = e.target.closest?.(".lit-seg.has-ann");
      if (seg) {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) return; // the user is selecting, not clicking
        const ids = (seg.dataset.ids || "").split(" ").filter(Boolean);
        onSegmentClick?.(ids, seg.getBoundingClientRect());
        return;
      }
      onBackgroundClick?.();
    },
    [onMarkerClick, onSegmentClick, onBackgroundClick]
  );

  const handleMouseOver = useCallback(
    (e) => {
      if (mouseDownRef.current) return;
      const node = e.target;
      let ids = [];
      let anchor = null;
      if (node.classList?.contains("lit-marker")) {
        ids = [node.dataset.id];
        anchor = node;
      } else {
        const seg = node.closest?.(".lit-seg.has-ann");
        if (seg) {
          ids = (seg.dataset.ids || "").split(" ").filter(Boolean);
          anchor = seg;
        }
      }
      onHoverIds?.(ids, anchor);
    },
    [onHoverIds]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("lit-marker")) {
        e.preventDefault();
        onMarkerClick?.(e.target.dataset.id, e.target.getBoundingClientRect());
      }
    },
    [onMarkerClick]
  );

  if (!poem) return null;

  return (
    <div
      ref={rootRef}
      className="lit-poem max-w-[46em] font-note-serif text-[19px] leading-[2.35] text-ink-100"
      spellCheck={false}
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onMouseLeave={() => onHoverIds?.([], null)}
      onKeyDown={handleKeyDown}
    >
      {lines.map((line, i) => {
        const isBlank = line.text.trim() === "";
        const children = [];
        let mi = 0;
        line.segments.forEach((seg) => {
          children.push(
            <span
              key={`s${seg.start}`}
              className={seg.ids.length ? "lit-seg has-ann" : "lit-seg"}
              data-start={seg.start}
              data-end={seg.end}
              {...(seg.ids.length
                ? {
                    "data-depth": Math.min(seg.ids.length, 3),
                    "data-ids": seg.ids.join(" "),
                    "data-count": seg.ids.length,
                  }
                : {})}
            >
              {seg.text}
            </span>
          );
          while (mi < line.markers.length && line.markers[mi].at <= seg.end) {
            const m = line.markers[mi];
            children.push(
              <sup
                key={`m${m.id}_${m.partIndex}`}
                className={`lit-marker${m.partIndex > 0 ? " is-part" : ""}`}
                data-n={numbers[m.id] || "?"}
                data-id={m.id}
                data-at={m.at}
                role="button"
                tabIndex={0}
                aria-label={`Analysis ${numbers[m.id] || ""}`}
              />
            );
            mi++;
          }
        });
        while (mi < line.markers.length) {
          const m = line.markers[mi];
          children.push(
            <sup
              key={`m${m.id}_${m.partIndex}`}
              className={`lit-marker${m.partIndex > 0 ? " is-part" : ""}`}
              data-n={numbers[m.id] || "?"}
              data-id={m.id}
              data-at={m.at}
              role="button"
              tabIndex={0}
              aria-label={`Analysis ${numbers[m.id] || ""}`}
            />
          );
          mi++;
        }

        return (
          <div key={i} className={`lit-line${isBlank ? " is-blank" : ""}`} data-line={i}>
            {children}
          </div>
        );
      })}
    </div>
  );
});

export default PoemCanvas;

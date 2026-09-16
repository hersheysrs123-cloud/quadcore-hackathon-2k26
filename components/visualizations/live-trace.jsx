"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// ─── Live trace ─────────────────────────────────────────────────────
// A polyline that grows while the scene runs — the measured decay curve,
// the sample's path along the heating curve — without React re-rendering
// and without rebuilding geometry.
//
// drei's `<Line>` rebuilds its fat-line buffers whenever `points` changes,
// which is right for a curve that changes when a slider moves and wrong
// for one that gains a point ten times a second (the GL buffer churn shows
// up as hundreds of `deleteBuffer`s a minute). This is a plain `THREE.Line`
// over a position buffer allocated once at `capacity`; `push` writes the
// next vertex in place and widens the draw range. When the buffer is
// full the trace simply stops growing.
//
// The trace is driven through its ref: `ref.current.push(x, y)` and
// `ref.current.reset()`. Coordinates are in the parent group's space, so
// a chart maps its data to world units before pushing.
// ─────────────────────────────────────────────────────────────────────

export function LiveTrace({ traceRef, capacity = 1024, colour = "#fbbf24", opacity = 1, depthTest = true }) {
  const line = useRef(null);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", attr);
    g.setDrawRange(0, 0);
    return g;
  }, [capacity]);

  useEffect(() => {
    const attr = geometry.getAttribute("position");
    let n = 0;
    const api = {
      get length() {
        return n;
      },
      push(x, y, z = 0) {
        if (n >= capacity) return false;
        attr.array[n * 3] = x;
        attr.array[n * 3 + 1] = y;
        attr.array[n * 3 + 2] = z;
        n += 1;
        // Only the new vertex needs uploading, but the range must cover
        // it; three re-uploads the whole attribute when a range is not
        // given, so give one.
        attr.addUpdateRange((n - 1) * 3, 3);
        attr.needsUpdate = true;
        geometry.setDrawRange(0, n);
        return true;
      },
      /** Move the last vertex — for a marker-style head that follows the sample between pushes. */
      moveLast(x, y, z = 0) {
        if (n === 0) return;
        const i = n - 1;
        attr.array[i * 3] = x;
        attr.array[i * 3 + 1] = y;
        attr.array[i * 3 + 2] = z;
        attr.addUpdateRange(i * 3, 3);
        attr.needsUpdate = true;
      },
      reset() {
        n = 0;
        geometry.setDrawRange(0, 0);
      },
    };
    if (traceRef) traceRef.current = api;
    return () => {
      if (traceRef && traceRef.current === api) traceRef.current = null;
      geometry.dispose();
    };
  }, [geometry, capacity, traceRef]);

  return (
    <line ref={line} geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial color={colour} transparent={opacity < 1} opacity={opacity} depthTest={depthTest} toneMapped={false} />
    </line>
  );
}

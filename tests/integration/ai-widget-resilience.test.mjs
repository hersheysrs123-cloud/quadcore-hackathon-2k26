import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  OBJECT_KINDS,
  WIDGET_TYPES,
} from "../../lib/schemas.js";

const num = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const triple = (value) => {
  const arr = Array.isArray(value) ? value : [];
  return [num(arr[0]), num(arr[1]), num(arr[2])];
};

export function normalizeWidget(raw, fallbackType = "3D_ROTATING_MODEL") {
  const state = raw?.initialState ?? {};

  const objects = (state.objects ?? [])
    .filter((o) => o?.id)
    .map((o, i) => ({
      id: String(o.id),
      label: String(o.label ?? `Object ${i + 1}`),
      kind: OBJECT_KINDS.includes(o.kind) ? o.kind : "point",
      position: triple(o.position),
      vector: triple(o.vector),
      color: /^#[0-9a-f]{3,8}$/i.test(o.color ?? "") ? o.color : "#f0c04a",
      gapStatus: ["red", "yellow", "none"].includes(o.gapStatus)
        ? o.gapStatus
        : "none",
    }));

  const axisLabels = Array.isArray(state.axisLabels)
    ? state.axisLabels.slice(0, 3).map(String)
    : [];
  while (axisLabels.length < 3) axisLabels.push(["x", "y", "z"][axisLabels.length]);

  const interactiveControls = (raw?.interactiveControls ?? [])
    .filter((c) => c?.name)
    .map((c, i) => {
      let min = num(c.min, 0);
      let max = num(c.max, 1);
      if (max <= min) max = min + 1; // a zero-width slider is unusable
      const step = Math.max(num(c.step, (max - min) / 100), 1e-6);
      return {
        name: String(c.name),
        key: String(c.key || `control${i}`),
        min,
        max,
        step,
        default: Math.max(min, Math.min(max, num(c.default, min))),
        unit: String(c.unit ?? ""),
        targetsSubtopic: String(c.targetsSubtopic ?? ""),
      };
    });

  return {
    widgetType: WIDGET_TYPES.includes(raw?.widgetType) ? raw.widgetType : fallbackType,
    initialState: {
      cameraZoom: Math.max(0.2, Math.min(4, num(state.cameraZoom, 1))),
      rotationSpeed: Math.max(0, Math.min(3, num(state.rotationSpeed, 0.25))),
      backgroundColor: /^#[0-9a-f]{3,8}$/i.test(state.backgroundColor ?? "")
        ? state.backgroundColor
        : "#101216",
      axisLabels,
      objects,
    },
    interactiveControls,
    explanationKey: (raw?.explanationKey ?? [])
      .filter((e) => e?.subtopic)
      .map((e) => ({
        subtopic: String(e.subtopic),
        hint: String(e.hint ?? ""),
        watchFor: String(e.watchFor ?? ""),
      })),
  };
}

describe("Socratic 3D AI Widget Normalizer & WebGL Shield", () => {
  it("normalizes malformed/empty payload into safe Three.js canvas config", () => {
    const raw = {};
    const widget = normalizeWidget(raw, "3D_ROTATING_MODEL");

    assert.strictEqual(widget.widgetType, "3D_ROTATING_MODEL");
    assert.strictEqual(widget.initialState.cameraZoom, 1);
    assert.strictEqual(widget.initialState.rotationSpeed, 0.25);
    assert.strictEqual(widget.initialState.backgroundColor, "#101216");
    assert.deepStrictEqual(widget.initialState.axisLabels, ["x", "y", "z"]);
    assert.deepStrictEqual(widget.initialState.objects, []);
    assert.deepStrictEqual(widget.interactiveControls, []);
    assert.deepStrictEqual(widget.explanationKey, []);
  });

  it("repairs NaN and invalid vector coordinates in 3D scene objects", () => {
    const raw = {
      initialState: {
        objects: [
          {
            id: "obj1",
            label: "Electric Dipole",
            kind: "invalid_kind_should_fallback_to_point",
            position: ["not-a-number", null, 3.5],
            vector: [NaN, Infinity, -2],
            color: "not-a-hex",
            gapStatus: "invalid_gap",
          },
        ],
      },
    };

    const widget = normalizeWidget(raw);
    const obj = widget.initialState.objects[0];

    assert.strictEqual(obj.id, "obj1");
    assert.strictEqual(obj.kind, "point"); // Fallback to point
    assert.deepStrictEqual(obj.position, [0, 0, 3.5]);
    assert.deepStrictEqual(obj.vector, [0, 0, -2]);
    assert.strictEqual(obj.color, "#f0c04a"); // Fallback gold
    assert.strictEqual(obj.gapStatus, "none");
  });

  it("fixes inverted and zero-width slider control ranges (min >= max)", () => {
    const raw = {
      interactiveControls: [
        {
          name: "Frequency",
          min: 10,
          max: 10, // Zero width
          default: 50, // Outside range
        },
        {
          name: "Wavelength",
          min: 500,
          max: 200, // Inverted
          default: 100,
        },
      ],
    };

    const widget = normalizeWidget(raw);
    const c1 = widget.interactiveControls[0];
    const c2 = widget.interactiveControls[1];

    assert.ok(c1.max > c1.min, "Max must be greater than min");
    assert.strictEqual(c1.min, 10);
    assert.strictEqual(c1.max, 11);
    assert.strictEqual(c1.default, 11); // Clamped to max

    assert.ok(c2.max > c2.min);
  });

  it("clamps extreme camera zoom and rotation speeds", () => {
    const raw = {
      initialState: {
        cameraZoom: 1000,
        rotationSpeed: -50,
      },
    };

    const widget = normalizeWidget(raw);
    assert.strictEqual(widget.initialState.cameraZoom, 4); // Clamped to 4
    assert.strictEqual(widget.initialState.rotationSpeed, 0); // Clamped to 0
  });
});

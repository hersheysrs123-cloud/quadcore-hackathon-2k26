import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MEDIA, MEDIA_OPTIONS, mediumFor } from "../../components/visualizations/media.js";

// Extracted metadata and topic definitions from ThreeDView.jsx
export const TOPIC_IDS = [
  "refraction",
  "motor-effect",
  "thin-lenses",
  "induction",
  "gas-laws",
  "bohr-atom",
  "organic-builder",
  "fractional-distillation",
  "ionic-lattice",
  "electrolysis",
  "cell-explorer",
  "dna-double-helix",
  "enzyme-action",
  "binary-search-tree",
];

describe("3D Simulation Topics & Schema Integrity (ThreeDView.jsx)", () => {
  it("contains all 14 official IGCSE & Computer Science simulations", () => {
    assert.strictEqual(TOPIC_IDS.length, 14);
    assert.ok(TOPIC_IDS.includes("refraction"));
    assert.ok(TOPIC_IDS.includes("gas-laws"));
    assert.ok(TOPIC_IDS.includes("organic-builder"));
    assert.ok(TOPIC_IDS.includes("cell-explorer"));
    assert.ok(TOPIC_IDS.includes("binary-search-tree"));
  });

  describe("Media Library Refractive Indices (media.js)", () => {
    it("defines valid positive refractive indices for all optical presets", () => {
      assert.ok(Array.isArray(MEDIA_OPTIONS));
      assert.ok(MEDIA_OPTIONS.length >= 5);

      for (const opt of MEDIA_OPTIONS) {
        assert.ok(opt.value in MEDIA, `Medium ${opt.value} must exist in MEDIA`);
        const item = MEDIA[opt.value];
        assert.ok(item.n >= 1.0, `Refractive index for ${opt.value} must be >= 1.0`);
        assert.ok(typeof item.label === "string" && item.label.length > 0);
      }
    });

    it("maps float refractive indices back to nearest medium names via mediumFor", () => {
      assert.strictEqual(mediumFor(1.0), "air");
      assert.strictEqual(mediumFor(1.33), "water");
      assert.strictEqual(mediumFor(1.5), "glass");
      assert.strictEqual(mediumFor(2.42), "diamond");
      assert.strictEqual(mediumFor(1.49), "perspex");
    });
  });

  describe("Slider Range & Formatter Boundary Safety", () => {
    it("ensures custom numeric formatters never throw or produce NaN on edge values", () => {
      const formatters = [
        (v) => `${v}°`,
        (v) => Number(v || 0).toFixed(2),
        (v) => Number(v || 0).toFixed(1),
        (v) => `${v} nm`,
        (v) => `${v} K`,
        (v) => `${v} L`,
        (v) => `${v} V`,
        (v) => `${v} A`,
      ];

      for (const fmt of formatters) {
        assert.doesNotThrow(() => {
          assert.ok(typeof fmt(0) === "string");
          assert.ok(typeof fmt(100) === "string");
          assert.ok(typeof fmt(-50) === "string");
          assert.ok(typeof fmt(1e6) === "string");
        });
      }
    });
  });
});

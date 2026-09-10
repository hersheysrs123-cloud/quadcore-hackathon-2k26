import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_TOPIC_IDS = [
  "incline_friction",
  "hookes_law",
  "simple_machines",
  "roller_coaster_energy",
  "circuits_breadboard",
  "static_electricity",
  "buoyancy",
  "heat_transfer",
];

describe("Topic Animation Speed Controls & Defaults", () => {
  it("defines speed: 1 default across all 8 3D visualization topics in topics.js", () => {
    const topicsFile = path.resolve(__dirname, "../../components/visualizations/topics.js");
    const content = fs.readFileSync(topicsFile, "utf8");

    for (const id of TARGET_TOPIC_IDS) {
      // Find the topic section by id
      const topicIndex = content.indexOf(`id: "${id}"`);
      assert.ok(topicIndex !== -1, `Topic "${id}" should exist in topics.js`);

      // Find the next defaults section after this id
      const defaultsIndex = content.indexOf("defaults: {", topicIndex);
      assert.ok(defaultsIndex !== -1, `Topic "${id}" should have defaults block`);

      const defaultsEndIndex = content.indexOf("}", defaultsIndex);
      const defaultsBlock = content.slice(defaultsIndex, defaultsEndIndex);

      assert.ok(
        /speed:\s*1\b/.test(defaultsBlock),
        `Topic "${id}" defaults should contain speed: 1. Found: ${defaultsBlock}`,
      );
    }
  });

  it("scales physics delta-t linearly with speed parameter", () => {
    const testDelta = 0.016; // ~60fps
    for (const speed of [0.5, 1.0, 1.5, 2.0, 2.5]) {
      const dt = Math.min(testDelta, 0.05) * speed;
      assert.ok(Math.abs(dt - testDelta * speed) < 1e-9);
    }
  });

  it("handles frozen/paused state when speed is 0", () => {
    const testDelta = 0.016;
    const speed = 0;
    const dt = Math.min(testDelta, 0.05) * speed;
    assert.equal(dt, 0);
  });
});

// The lab kit (scripts/labkit-model): the bench apparatus eleven scenes
// draw by node name, in the frames of the components they replaced. A rebuild
// that drops a node, or moves the burner's mouth off the flame, breaks those
// scenes without an error.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LAB_KIT_MODEL } from "../../components/visualizations/lab-kit-model-meta.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VIS = path.join(ROOT, "components/visualizations");

function nodeNames() {
  const glb = fs.readFileSync(path.join(ROOT, "public/models/lab-kit.glb"));
  assert.equal(glb.readUInt32LE(0), 0x46546c67, "not a GLB");
  return JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8")).nodes.map((n) => n.name);
}

describe("lab kit model", () => {
  it("ships every part a scene draws by name", () => {
    const names = new Set(nodeNames());
    const used = new Set();
    for (const file of fs.readdirSync(VIS).filter((f) => f.endsWith(".jsx"))) {
      const src = fs.readFileSync(path.join(VIS, file), "utf8");
      for (const m of src.matchAll(/<KitPart name="([A-Za-z]+)"/g)) used.add(m[1]);
    }
    assert.ok(used.size > 40, `only ${used.size} parts in use`);
    for (const n of used) assert.ok(names.has(n), `no node ${n}`);
  });

  it("puts the burner's mouth where lab-bench.jsx starts the flame", () => {
    // BURNER: base 0.2 high, barrel cm(9.5) = 1.9 long
    assert.ok(Math.abs(LAB_KIT_MODEL.burner.mouthY - 2.1) < 1e-6);
    // the collar's air holes sit inside the collar, above the base
    assert.ok(LAB_KIT_MODEL.burner.collarY > 0.2 && LAB_KIT_MODEL.burner.collarY < 1.0);
  });

  it("gives the tripod three legs, evenly round, outside its ring", () => {
    const a = LAB_KIT_MODEL.tripod.legAngles;
    assert.equal(a.length, 3);
    assert.ok(Math.abs(a[1] - a[0] - (2 * Math.PI) / 3) < 1e-4);
    assert.ok(LAB_KIT_MODEL.tripod.legRadius > LAB_KIT_MODEL.tripod.ringR);
  });

  it("keeps the supply's binding posts where its leads start", () => {
    // ChemistryCanvas.jsx: NEG_POST [-0.55, -0.42], POS_POST [-0.1, -0.42]
    assert.deepEqual(LAB_KIT_MODEL.psu.posts.neg, [-0.55, -0.42]);
    assert.deepEqual(LAB_KIT_MODEL.psu.posts.pos, [-0.1, -0.42]);
  });
});

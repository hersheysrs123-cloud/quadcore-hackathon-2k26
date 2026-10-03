// The static-electricity scene's sweater (scripts/sweater-model). The charge
// signs are laid on its chest from the meta, and the stitch shader reads the
// _KNIT attribute, so a rebuild that drops either breaks the scene silently.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SWEATER_MODEL } from "../../components/visualizations/sweater-model-meta.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function gltf() {
  const glb = fs.readFileSync(path.join(ROOT, "public/models/sweater.glb"));
  assert.equal(glb.readUInt32LE(0), 0x46546c67, "not a GLB");
  return JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8"));
}

describe("sweater model", () => {
  it("ships the four nodes the scene draws", () => {
    const names = gltf().nodes.map((n) => n.name);
    for (const n of ["sweater", "form", "wood", "metal"]) assert.ok(names.includes(n), `no node ${n}`);
  });

  it("gives the wool the knit coordinates the stitch shader reads", () => {
    const g = gltf();
    const node = g.nodes.find((n) => n.name === "sweater");
    const prim = g.meshes[node.mesh].primitives[0];
    assert.ok("_KNIT" in prim.attributes, "no _KNIT attribute");
    assert.equal(g.accessors[prim.attributes._KNIT].type, "VEC4");
  });

  it("puts the front of the chest where the charge signs can sit just clear of it", () => {
    assert.ok(SWEATER_MODEL.frontZ > 0.3 && SWEATER_MODEL.frontZ < 0.45);
    assert.ok(SWEATER_MODEL.chestY > SWEATER_MODEL.hemY && SWEATER_MODEL.chestY < SWEATER_MODEL.neckY);
  });

  it("stands on the scene's floor", () => {
    assert.equal(SWEATER_MODEL.floorY, -2.6);
  });
});

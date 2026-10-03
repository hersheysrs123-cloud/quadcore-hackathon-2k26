// The motor-effect scene's hand (scripts/hand-model) is the diagram: its
// first finger is the field, its second finger the current and its thumb the
// force. These hold the generated model to that, so a rebuild that bends a
// finger the wrong way, or mirrors the hand into a right hand, fails here.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FLEMING_HAND } from "../../components/visualizations/fleming-hand-model-meta.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(...a);

describe("Fleming hand model", () => {
  const { field, current, force } = FLEMING_HAND.anchors;

  it("points each digit along its own axis, within 8 degrees", () => {
    const cos8 = Math.cos((8 * Math.PI) / 180);
    assert.ok(dot(field.dir, [1, 0, 0]) > cos8, "first finger is not along +X (B)");
    assert.ok(dot(current.dir, [0, 0, 1]) > cos8, "second finger is not along +Z (I)");
    assert.ok(dot(force.dir, [0, 1, 0]) > cos8, "thumb is not along +Y (F)");
  });

  it("is a left hand: the thumb follows I x B, as F = IL x B does", () => {
    const iCrossB = cross(current.dir, field.dir);
    assert.ok(dot(iCrossB, force.dir) / len(iCrossB) > 0.95);
  });

  it("puts each fingertip out along its own digit, clear of the palm", () => {
    assert.ok(dot(field.tip, field.dir) > 1.5);
    assert.ok(dot(current.tip, current.dir) > 1.5);
    assert.ok(dot(force.tip, force.dir) > 1.5);
  });

  it("ships the GLB the scene loads, with its hand node", () => {
    const glb = fs.readFileSync(path.join(ROOT, "public/models/fleming-hand.glb"));
    assert.equal(glb.readUInt32LE(0), 0x46546c67, "not a GLB");
    const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8"));
    assert.ok(json.nodes.some((n) => n.name === "hand"), "no node named hand");
  });
});

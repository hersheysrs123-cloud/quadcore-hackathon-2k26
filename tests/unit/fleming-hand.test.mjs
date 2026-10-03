// The motor-effect scene's hand (scripts/hand-model) is the diagram: its
// first finger is the field, its second finger the current and its thumb the
// force. These hold the generated model to that, so a rebuild that bends a
// finger the wrong way, or mirrors the hand into a right hand, fails here.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { FLEMING_HAND } from "../../components/visualizations/fleming-hand-model-meta.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Plain vector arithmetic, from three.js, so the test models nothing itself.
const v = (a) => new THREE.Vector3(...a);

describe("Fleming hand model", () => {
  const field = { tip: v(FLEMING_HAND.anchors.field.tip), dir: v(FLEMING_HAND.anchors.field.dir) };
  const current = { tip: v(FLEMING_HAND.anchors.current.tip), dir: v(FLEMING_HAND.anchors.current.dir) };
  const force = { tip: v(FLEMING_HAND.anchors.force.tip), dir: v(FLEMING_HAND.anchors.force.dir) };

  it("points each digit along its own axis, within 8 degrees", () => {
    const cos8 = Math.cos((8 * Math.PI) / 180);
    assert.ok(field.dir.dot(v([1, 0, 0])) > cos8, "first finger is not along +X (B)");
    assert.ok(current.dir.dot(v([0, 0, 1])) > cos8, "second finger is not along +Z (I)");
    assert.ok(force.dir.dot(v([0, 1, 0])) > cos8, "thumb is not along +Y (F)");
  });

  it("is a left hand: the thumb follows I x B, as F = IL x B does", () => {
    const iCrossB = current.dir.clone().cross(field.dir).normalize();
    assert.ok(iCrossB.dot(force.dir) > 0.95);
  });

  it("puts each fingertip out along its own digit, clear of the palm", () => {
    assert.ok(field.tip.dot(field.dir) > 1.5);
    assert.ok(current.tip.dot(current.dir) > 1.5);
    assert.ok(force.tip.dot(force.dir) > 1.5);
  });

  it("ships the GLB the scene loads, with its hand node", () => {
    const glb = fs.readFileSync(path.join(ROOT, "public/models/fleming-hand.glb"));
    assert.equal(glb.readUInt32LE(0), 0x46546c67, "not a GLB");
    const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8"));
    assert.ok(json.nodes.some((n) => n.name === "hand"), "no node named hand");
  });
});

// The projectile scene's cannon (scripts/cannon-model). The scene turns the
// barrel about its own origin and launches the ball from the trunnions, so a
// rebuild that moves either, or lets the carriage poke into the runway,
// breaks the scene without an error.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CANNON_MODEL } from "../../components/visualizations/cannon-model-meta.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function gltf() {
  const glb = fs.readFileSync(path.join(ROOT, "public/models/cannon.glb"));
  assert.equal(glb.readUInt32LE(0), 0x46546c67, "not a GLB");
  return JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8"));
}

/** A node's bounds in its own (dequantised) frame: positions are int16 scaled by the node. */
function bounds(g, name) {
  const node = g.nodes.find((n) => n.name === name);
  const acc = g.accessors[g.meshes[node.mesh].primitives[0].attributes.POSITION];
  const s = node.scale[0] / 32767;
  return {
    min: acc.min.map((v, i) => v * s + node.translation[i]),
    max: acc.max.map((v, i) => v * s + node.translation[i]),
  };
}

describe("cannon model", () => {
  it("ships the barrel, wood and iron the scene draws", () => {
    const names = gltf().nodes.map((n) => n.name);
    for (const n of ["barrel", "wood", "iron"]) assert.ok(names.includes(n), `no node ${n}`);
  });

  it("launches from the trunnions, where the ball sits on the runway's deck", () => {
    // PhysicsCanvas: LAUNCH_Y = RUNWAY_TOP_Y (0.28) + BALL_RADIUS (0.13)
    assert.ok(Math.abs(CANNON_MODEL.launchY - 0.41) < 1e-6);
  });

  it("has a bore wide enough for the ball, and its muzzle at the barrel's front", () => {
    assert.ok(CANNON_MODEL.boreR > 0.13);
    const b = bounds(gltf(), "barrel");
    assert.ok(Math.abs(b.max[0] - CANNON_MODEL.muzzleX) < 0.005, "muzzle is not the barrel's front");
    // pivoting about the origin: the breech sits behind it, the bore ahead
    assert.ok(b.min[0] < -0.2 && b.min[0] > -0.4);
  });

  it("keeps the carriage off the runway: below its top, nothing ahead of x = 0", () => {
    const g = gltf();
    for (const name of ["wood", "iron"]) {
      const b = bounds(g, name);
      assert.ok(b.min[1] > -0.005, `${name} sinks through the floor`);
      // the cap squares over the trunnions stand above the deck and may reach forward
      assert.ok(b.max[0] < 0.09, `${name} reaches too far forward`);
    }
  });
});

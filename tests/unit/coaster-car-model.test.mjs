// The roller-coaster scene's car (scripts/coaster-model). The scene draws a
// copy of each wheel at the meta's positions and rolls it by distance /
// radius, and the ride camera sits at the meta's eye, so a rebuild that moves
// a wheel off its rail or the eye out of the car breaks the scene silently.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COASTER_CAR_MODEL } from "../../components/visualizations/coaster-car-model-meta.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// RollerCoasterCanvas.jsx: rail centres at y = 0, z = ±HALF_GAUGE, tubes RAIL_R thick
const HALF_GAUGE = 0.7;
const RAIL_R = 0.16;

function nodeNames() {
  const glb = fs.readFileSync(path.join(ROOT, "public/models/coaster-car.glb"));
  assert.equal(glb.readUInt32LE(0), 0x46546c67, "not a GLB");
  return JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8")).nodes.map((n) => n.name);
}

describe("coaster car model", () => {
  const W = COASTER_CAR_MODEL.wheels;

  it("ships the body parts and one of each wheel", () => {
    const names = nodeNames();
    for (const n of ["shell", "seats", "riders", "pad", "steel", "roadWheel", "upWheel", "guideWheel"]) {
      assert.ok(names.includes(n), `no node ${n}`);
    }
  });

  it("has three wheels at each of the four corners", () => {
    assert.equal(W.road.at.length, 4);
    assert.equal(W.up.at.length, 4);
    assert.equal(W.guide.at.length, 4);
  });

  it("runs each wheel against its rail: on top, underneath and outside", () => {
    for (const [x, y, z] of W.road.at) {
      assert.ok(Math.abs(Math.abs(z) - HALF_GAUGE) < 1e-6, "running wheel is off its rail");
      assert.ok(Math.abs(y - (RAIL_R + W.road.r)) < 1e-6, "running wheel does not sit on the rail");
      assert.ok(Math.abs(Math.abs(x) - 0.95) < 1e-6, "running wheel is not on a bogie");
    }
    for (const [, y] of W.up.at) assert.ok(Math.abs(y + RAIL_R + W.up.r) < 1e-6, "upstop wheel does not touch the rail's underside");
    for (const [, y, z] of W.guide.at) {
      assert.equal(y, 0);
      assert.ok(Math.abs(Math.abs(z) - (HALF_GAUGE + RAIL_R + W.guide.r)) < 1e-6, "guide wheel does not touch the rail's side");
    }
  });

  it("puts the ride camera's eye at a seated rider's head height, inside the car", () => {
    const [x, y, z] = COASTER_CAR_MODEL.eye;
    assert.ok(y > COASTER_CAR_MODEL.floor + 0.7 && y < COASTER_CAR_MODEL.floor + 1.1);
    assert.ok(Math.abs(z) < HALF_GAUGE);
    assert.ok(x > -1.5 && x < 1.5);
  });
});

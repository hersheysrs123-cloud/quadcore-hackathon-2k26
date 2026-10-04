import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bestFitRigid, rotateByQuaternion } from "../../lib/rigidFit.js";

// A fixed pseudo-random sequence, so a failure reproduces.
let seed = 7;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const point = () => [rand() * 4 - 2, rand() * 4 - 2, rand() * 4 - 2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function randomQuaternion() {
  const axis = point();
  const len = Math.hypot(...axis);
  const angle = rand() * 2 * Math.PI;
  return [Math.cos(angle / 2), ...axis.map((v) => (v / len) * Math.sin(angle / 2))];
}

describe("bestFitRigid", () => {
  it("recovers an exact rotation and translation", () => {
    for (let trial = 0; trial < 100; trial += 1) {
      const from = Array.from({ length: 3 + (trial % 6) }, point);
      const q = randomQuaternion();
      const move = point();
      const to = from.map((p) => rotateByQuaternion(q, p).map((v, i) => v + move[i]));
      const { apply } = bestFitRigid(from, to);
      from.forEach((p, i) => assert.ok(dist(apply(p), to[i]) < 1e-9, `trial ${trial}`));
    }
  });

  it("never reflects: it is a proper rotation even when a mirror would fit better", () => {
    const from = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, 0]];
    const to = from.map(([x, y, z]) => [x, y, -z]);
    const { quaternion, apply } = bestFitRigid(from, to);
    assert.ok(Math.abs(Math.hypot(...quaternion) - 1) < 1e-12);
    // A rotation keeps handedness: the triple product keeps its sign.
    const [x, y, z, o] = from.map(apply);
    const sub = (a, b) => a.map((v, i) => v - b[i]);
    const [a, b, c] = [sub(x, o), sub(y, o), sub(z, o)];
    const triple = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
    assert.ok(triple > 0);
  });

  it("rejects mismatched point sets", () => {
    assert.throws(() => bestFitRigid([[0, 0, 0]], []));
  });
});

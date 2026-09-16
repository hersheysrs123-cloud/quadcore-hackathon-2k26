import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  advanceFront,
  advancePhase,
  bump,
  columnSpeed,
  lignifiedRings,
  profileRadius,
  ringVertexCount,
  sampleProfile,
  squeezeBody,
  streamPositions,
  tubeIndices,
  tubeVertexCount,
  writeTubeVertices,
} from "../../lib/tubeTransit.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

describe("Tube profiles", () => {
  it("makes a unit bump that falls to 1/e at one half-width and is symmetric", () => {
    assert.ok(close(bump(5, 5, 1), 1));
    assert.ok(close(bump(6, 5, 1), Math.exp(-1)));
    assert.ok(close(bump(4, 5, 1), bump(6, 5, 1)));
    assert.equal(bump(5, 5, 0), 0, "a zero-width feature contributes nothing");
  });

  it("subtracts constrictions and adds dilations as fractions of the base radius", () => {
    const base = 2;
    assert.ok(close(profileRadius(0, base, []), base));
    assert.ok(close(profileRadius(5, base, [{ centre: 5, width: 1, depth: 0.5 }]), 1), "half-depth constriction halves the radius");
    assert.ok(close(profileRadius(5, base, [{ centre: 5, width: 1, depth: -0.25 }]), 2.5), "negative depth dilates");
    assert.ok(profileRadius(5, base, [{ centre: 5, width: 1, depth: 2 }]) >= 0.02, "the floor keeps a sliver");
  });

  it("samples the profile evenly from 0 to the full length", () => {
    const seen = [];
    const out = sampleProfile(10, 5, (s) => {
      seen.push(s);
      return s * 2;
    });
    assert.deepEqual(seen, [0, 2.5, 5, 7.5, 10]);
    assert.deepEqual(out, [0, 5, 10, 15, 20]);
  });

  it("lays lignin rings one pitch apart, starting half a pitch in, that narrow the lumen", () => {
    const rings = lignifiedRings(4, 1, 0.2);
    assert.deepEqual(rings.map((r) => r.centre), [0.5, 1.5, 2.5, 3.5]);
    assert.ok(rings.every((r) => r.depth === 0.2));
    assert.ok(profileRadius(0.5, 1, rings) < profileRadius(1, 1, rings), "the wall bulges inward at a ring");
    assert.deepEqual(lignifiedRings(4, 0, 0.2), []);
  });
});

describe("Moving a body along the tube", () => {
  it("advances a front and reports arrival at the far end", () => {
    assert.deepEqual(advanceFront(1, 2, 0.5, 10), { position: 2, arrived: false });
    assert.deepEqual(advanceFront(9.5, 2, 0.5, 10), { position: 10, arrived: true });
    assert.deepEqual(advanceFront(0.2, -2, 0.5, 10), { position: 0, arrived: false });
  });

  it("turns a volume flow into a mean speed through the cross-section", () => {
    assert.ok(close(columnSpeed(Math.PI, 1), 1));
    assert.ok(close(columnSpeed(2 * Math.PI, 1), 2));
    assert.equal(columnSpeed(5, 0), 0, "no area is no flow, not infinite flow");
  });

  it("squeezes a compliant body into a narrower tube while conserving its volume", () => {
    const rest = { r: 1, h: 1 };
    const fit = squeezeBody(rest.r, rest.h, 0.5, 1);
    assert.ok(close(fit.radius, 0.5));
    assert.ok(close(fit.radius * fit.radius * (fit.length / 2), rest.r * rest.r * rest.h), "r²·L is conserved");
    const loose = squeezeBody(rest.r, rest.h, 2, 1);
    assert.ok(close(loose.radius, 1) && close(loose.length, 2), "a wider tube leaves the body at rest");
  });

  it("lets a stiff body keep most of its width, so the wall has to stretch", () => {
    const stiff = squeezeBody(1, 1, 0.5, 0.2);
    assert.ok(stiff.radius > 0.5, "wider than the lumen");
    assert.ok(close(stiff.radius, 1 - 0.5 * 0.2));
  });
});

describe("Recycling particle stream", () => {
  it("spreads particles evenly and recycles them at the far end", () => {
    const out = new Float32Array(4);
    assert.equal(streamPositions(4, 0, 8, 0, out), 4);
    assert.deepEqual(Array.from(out), [0, 2, 4, 6]);
    streamPositions(4, 0, 8, 3, out);
    assert.deepEqual(Array.from(out), [3, 5, 7, 1], "past the end, a particle reappears at the start");
  });

  it("hides particles beyond the column front", () => {
    const out = new Float32Array(4);
    const visible = streamPositions(4, 0, 8, 0, out, 4);
    assert.equal(visible, 3);
    assert.ok(Number.isNaN(out[3]));
  });

  it("keeps the phase inside one span, forwards and backwards", () => {
    assert.ok(close(advancePhase(7.5, 1, 1, 8), 0.5));
    assert.ok(close(advancePhase(0.5, -1, 1, 8), 7.5));
    assert.equal(advancePhase(3, 1, 1, 0), 0);
  });
});

describe("Tube mesh vertices", () => {
  it("counts vertices with a duplicated seam column", () => {
    assert.equal(ringVertexCount(8), 9);
    assert.equal(tubeVertexCount(4, 8), 36);
    assert.equal(tubeIndices(4, 8).length, 3 * 8 * 6);
  });

  it("winds triangles so the analytic normals face outward, even through a constriction", () => {
    const rings = 16;
    const segments = 12;
    const n = tubeVertexCount(rings, segments);
    const positions = new Float32Array(n * 3);
    const normals = new Float32Array(n * 3);
    const uvs = new Float32Array(n * 2);
    const station = Float32Array.from({ length: rings }, (_, i) => (i / (rings - 1)) * 6);
    const radius = Float32Array.from(station, (s) => profileRadius(s, 1, [{ centre: 3, width: 0.8, depth: 0.6 }]));
    writeTubeVertices({ positions, normals, uvs }, { rings, segments, station, radius });

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions.slice(), 3));
    g.setIndex(new THREE.BufferAttribute(tubeIndices(rings, segments), 1));
    g.computeVertexNormals();
    const ref = g.attributes.normal.array;
    let minDot = 1;
    for (let i = 0; i < n; i += 1) {
      const d = normals[3 * i] * ref[3 * i] + normals[3 * i + 1] * ref[3 * i + 1] + normals[3 * i + 2] * ref[3 * i + 2];
      minDot = Math.min(minDot, d);
    }
    assert.ok(minDot > 0.9, `analytic and winding normals agree (min dot ${minDot.toFixed(3)})`);
    g.dispose();
  });

  it("puts each ring at its station and radius, with v running 0 → 1 along the length", () => {
    const rings = 3;
    const segments = 4;
    const n = tubeVertexCount(rings, segments);
    const positions = new Float32Array(n * 3);
    const normals = new Float32Array(n * 3);
    const uvs = new Float32Array(n * 2);
    writeTubeVertices({ positions, normals, uvs }, { rings, segments, station: [0, 1, 2], radius: [1, 2, 1] });
    // Ring 1, vertex 0: at θ = 0 → (r, s, 0).
    const k = (1 * ringVertexCount(segments) + 0) * 3;
    assert.ok(close(positions[k], 2, 1e-6) && close(positions[k + 1], 1, 1e-6) && close(positions[k + 2], 0, 1e-6));
    assert.ok(close(uvs[1], 0) && close(uvs[(2 * ringVertexCount(segments)) * 2 + 1], 1));
    // The seam vertex duplicates the first.
    const a = 0;
    const b = segments * 3;
    assert.ok(close(positions[a], positions[b], 1e-6) && close(positions[a + 2], positions[b + 2], 1e-6));
  });

  it("tilts normals down a widening cone and follows a centre offset", () => {
    const rings = 3;
    const segments = 4;
    const n = tubeVertexCount(rings, segments);
    const positions = new Float32Array(n * 3);
    const normals = new Float32Array(n * 3);
    const uvs = new Float32Array(n * 2);
    writeTubeVertices({ positions, normals, uvs }, { rings, segments, station: [0, 1, 2], radius: [1, 2, 3], centreX: [0, 0.5, 1], centreZ: [0, 0, 0] });
    const k = (1 * ringVertexCount(segments) + 0) * 3;
    assert.ok(close(positions[k], 2.5, 1e-6), "centre offset shifts the ring");
    assert.ok(normals[k + 1] < 0, "a cone widening upward has normals pointing down and out");
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  BENCH,
  MATERIALS,
  MATERIAL_OPTIONS,
  SOURCES,
  SHAPES,
  SHAPE_DEFS,
  SHAPE_GROUPS,
  SHAPE_LABELS,
  PRESETS,
  magnification,
  shadowBands,
  shadowDarkness,
  screenBrightness,
  shadowEdgeOnScreen,
  solveShadow,
  castShadow,
  measureField,
  describeShadow,
  hasUmbra,
  lightRays,
  placeSolid,
  turnMatrix,
  underside,
  benchGap,
  enforceBench,
  getSolid,
  sourceSamples,
  SCENE,
  seesShadowSide,
  shadowFitsScreen,
} from "../../lib/shadowOptics.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const bench = { lightZ: 12, objectZ: 55, screenZ: 105 };
/** One lamp point on the axis and no jitter: a single, exact ray per pixel. */
const ONE = [{ x: 0, y: 0, jx: 0, jy: 0 }];
const deg = (d) => (d * Math.PI) / 180;

describe("light travels in straight lines", () => {
  it("finds the shadow edge by extending a straight ray, never bending it", () => {
    // Lamp at x=0,z=0; object edge at x=2,z=10; screen at z=30.
    // Straight line reaches x = 6 — three times as far along, three times across.
    assert.ok(close(shadowEdgeOnScreen(0, 0, 2, 10, 30), 6));
  });

  it("keeps a ray on the axis on the axis", () => {
    assert.ok(close(shadowEdgeOnScreen(0, 0, 0, 10, 40), 0));
  });

  it("projects symmetrically either side of the lamp", () => {
    const right = shadowEdgeOnScreen(0, 0, 3, 10, 25);
    const left = shadowEdgeOnScreen(0, 0, -3, 10, 25);
    assert.ok(close(right, -left));
  });
});

describe("rule 1 — moving the LIGHT changes the shadow size", () => {
  it("makes the shadow BIGGER as the lamp moves closer to the object", () => {
    let previous = 0;
    for (const lightZ of [0, 10, 20, 30, 40, 46]) {
      const r = solveShadow({ ...bench, lightZ });
      assert.ok(r.shadowWidthCm > previous, `lamp at ${lightZ} should cast a wider shadow than the step before`);
      assert.ok(r.magnification > 1);
      previous = r.shadowWidthCm;
    }
  });

  it("makes the shadow SMALLER as the lamp moves further away", () => {
    const near = solveShadow({ ...bench, lightZ: 45 });
    const far = solveShadow({ ...bench, lightZ: 0 });
    assert.ok(far.shadowWidthCm < near.shadowWidthCm);
    assert.ok(far.magnification < near.magnification);
  });

  it("approaches life size as the lamp recedes toward parallel rays", () => {
    // With the lamp a kilometre away the rays are effectively parallel and the
    // shadow is the same size as the object — exactly, for a cube square on.
    assert.ok(close(magnification(100000, 50), 1, 0.001));
    const r = solveShadow({ lightZ: -1e7, objectZ: 55, screenZ: 105, shape: "cube", source: "point" });
    assert.ok(close(r.shadowWidthCm, 10, 1e-3), `${r.shadowWidthCm}`);
    assert.ok(close(r.shadowHeightCm, 10, 1e-3), `${r.shadowHeightCm}`);
  });
});

describe("rule 2 — moving the SCREEN changes the shadow size", () => {
  it("makes the shadow BIGGER as the screen moves further from the object", () => {
    let previous = 0;
    for (const screenZ of [64, 75, 85, 100, 118]) {
      const r = solveShadow({ ...bench, screenZ });
      assert.ok(r.shadowWidthCm > previous, `screen at ${screenZ} should cast a wider shadow`);
      assert.ok(r.magnification > 1);
      previous = r.shadowWidthCm;
    }
  });

  it("gives a life-size shadow when the screen touches the object", () => {
    assert.ok(close(magnification(40, 0), 1));
    assert.ok(close(solveShadow({ ...bench, screenZ: 55 }).magnification, 1));
  });

  it("obeys M = 1 + b/a exactly", () => {
    for (const [a, b] of [[10, 30], [25, 25], [40, 5], [1, 99]]) {
      assert.ok(close(magnification(a, b), 1 + b / a));
    }
  });
});

describe("the shadow is exact, not a scaled outline", () => {
  const { lightZ, objectZ, screenZ } = bench;
  const D = screenZ - lightZ;
  const a = objectZ - lightZ;
  const hx = SOURCES.point.width / 2;

  it("magnifies a cube's NEAR face, which is what casts the shadow", () => {
    // The face toward the lamp is 5 cm nearer than the middle, so it is
    // magnified by D/(a−5), not by the D/a the simple rule quotes.
    const t = D / (a - 5);
    const r = solveShadow({ ...bench, shape: "cube", source: "point" });
    // The 0.2 cm lamp adds hx·(t−1) at each edge, and takes the same off the umbra.
    assert.ok(close(r.shadowWidthCm, 10 * t + 2 * hx * (t - 1), 1e-9), `${r.shadowWidthCm}`);
    assert.ok(close(r.shadowHeightCm, 10 * t + 2 * hx * (t - 1), 1e-9));
    assert.ok(close(2 * r.horizontal.umbra, 10 * t - 2 * hx * (t - 1), 1e-9));
    assert.ok(r.shadowWidthCm > 10 * r.magnification * 1.05, "bigger than the thin-object rule says");
  });

  it("casts a sphere's shadow with the tangent cone, not with M × its radius", () => {
    // The sphere's shadow edge is where the cone of rays that just miss it
    // meets the screen: radius D·r/√(d²−r²), from a lamp d away from its centre.
    const r = 5;
    const exact = (D * r) / Math.sqrt(a * a - r * r);
    const field = castShadow({ ...bench, shape: "sphere", source: "point" }, { samples: ONE, pxPerCm: 16 });
    const m = measureField(field, 0.5);
    assert.ok(close(m.widthCm / 2, exact, 0.08), `${(m.widthCm / 2).toFixed(3)} vs ${exact.toFixed(3)}`);
    assert.ok(close(m.heightCm / 2, exact, 0.08));
    assert.ok(Math.abs(exact - r * (D / a)) > 0.05, "and that differs from the simple rule");
  });

  it("gives a cylinder end-on a circle the size of its NEAR rim", () => {
    const field = castShadow({ ...bench, shape: "cylinder", rotation: deg(90), source: "point" }, { samples: ONE, pxPerCm: 16 });
    const m = measureField(field, 0.5);
    const exact = (2.75 * D) / (a - 6);
    assert.ok(close(m.widthCm / 2, exact, 0.08), `${(m.widthCm / 2).toFixed(3)} vs ${exact.toFixed(3)}`);
    assert.ok(close(m.widthCm, m.heightCm, 0.12), "and it is a circle");
  });

  it("makes a thick upright cylinder's shadow taller than the thin-object rule", () => {
    const r = solveShadow({ ...bench, shape: "cylinder", source: "point" });
    // Height 12: the rim nearest the lamp is magnified by D/(a−2.75).
    const tallest = 12 * (D / (a - 2.75)) / 2 + 0; // half-height of the near rim
    assert.ok(close(r.shadowHeightCm / 2, tallest + hx * ((D / (a - 2.75)) - 1), 1e-9));
    assert.ok(r.shadowHeightCm > 12 * r.magnification * 1.04);
  });

  it("turns a cube square on into a wider shadow as it turns to show its corner", () => {
    const flat = solveShadow({ ...bench, shape: "cube", rotation: 0, source: "point" });
    const corner = solveShadow({ ...bench, shape: "cube", rotation: deg(45), source: "point" });
    // Not the flat √2 of parallel light: the corner is nearer the lamp, but the
    // face it replaces was too, and the sides sit back at the cube's middle depth.
    const ratio = corner.shadowWidthCm / flat.shadowWidthCm;
    assert.ok(ratio > 1.2 && ratio < 1.5, `${ratio.toFixed(3)}`);
  });

  it("keeps a sphere's shadow the same however it is turned", () => {
    const base = solveShadow({ ...bench, shape: "sphere", rotation: 0 });
    for (const d of [15, 45, 90, 137, 260]) {
      const turned = solveShadow({ ...bench, shape: "sphere", rotation: deg(d) });
      // Identical, but for the mesh's own tessellation: a hundredth of a millimetre.
      assert.ok(close(turned.shadowWidthCm, base.shadowWidthCm, 0.02), `${d}° width`);
      assert.ok(close(turned.shadowHeightCm, base.shadowHeightCm, 0.02), `${d}° height`);
    }
  });

  it("is deterministic: the same bench gives the same picture", () => {
    const params = { ...bench, shape: "heart", source: "broad", material: "translucent", rotation: 0.4 };
    const a1 = castShadow(params, { pxPerCm: 3 });
    const a2 = castShadow(params, { pxPerCm: 3 });
    assert.deepEqual(Array.from(a1.blocked), Array.from(a2.blocked));
    assert.deepEqual(Array.from(a1.shade), Array.from(a2.shade));
  });
});

/** Does the segment from S to P pass through any triangle of the placed solid? (Möller–Trumbore) */
function occluded(world, tris, S, P) {
  const dx = P[0] - S[0], dy = P[1] - S[1], dz = P[2] - S[2];
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t] * 3, b = tris[t + 1] * 3, c = tris[t + 2] * 3;
    const e1x = world[b] - world[a], e1y = world[b + 1] - world[a + 1], e1z = world[b + 2] - world[a + 2];
    const e2x = world[c] - world[a], e2y = world[c + 1] - world[a + 1], e2z = world[c + 2] - world[a + 2];
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-14) continue;
    const inv = 1 / det;
    const tx = S[0] - world[a], ty = S[1] - world[a + 1], tz = S[2] - world[a + 2];
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < 0 || u > 1) continue;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < 0 || u + v > 1) continue;
    const s = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (s > 0 && s < 1) return true;
  }
  return false;
}

describe("every screen point agrees with a ray fired at the solid", () => {
  // The painted shadow is checked against the definition of a shadow: a screen
  // point is dark exactly when the straight ray from the lamp to it is stopped
  // by the solid. Brute force, one ray per sampled pixel, every triangle.
  const layouts = [
    { lightZ: 12, objectZ: 55, screenZ: 105 },
    { lightZ: 30, objectZ: 55, screenZ: 90 },
  ];
  const PX = 2;

  for (const shape of SHAPES) {
    it(`${SHAPE_LABELS[shape]}: the picture is the ray test, pixel for pixel`, () => {
      const solid = getSolid(shape);
      let checked = 0;
      let mismatches = 0;
      for (const rotation of [0, 0.6, Math.PI / 2]) {
        for (const layout of layouts) {
          const field = castShadow({ shape, rotation, ...layout, source: "point" }, { samples: ONE, pxPerCm: PX });
          const { world } = placeSolid({ shape, rotation, objectZ: layout.objectZ });
          const S = [0, 0, layout.lightZ];
          const { width: W, height: H } = field;
          for (let j = 1; j < H; j += 3) {
            for (let i = 1; i < W; i += 3) {
              const X = (W / 2 - (i + 0.5)) / PX;
              const Y = (H / 2 - (j + 0.5)) / PX;
              const dark = occluded(world, solid.tris, S, [X, Y, layout.screenZ]);
              if (dark !== field.blocked[j * W + i] > 0) mismatches += 1;
              checked += 1;
            }
          }
        }
      }
      assert.ok(checked > 5000);
      assert.ok(mismatches <= 2, `${mismatches} of ${checked} screen points disagree with the ray test`);
    });
  }
});

describe("the solids on the shelf", () => {
  it("offers twenty shapes, in two groups, each named", () => {
    assert.equal(SHAPES.length, 20);
    assert.equal(new Set(SHAPES).size, SHAPES.length);
    assert.deepEqual(SHAPE_GROUPS.flatMap((g) => g.shapes).sort(), [...SHAPES].sort());
    for (const shape of SHAPES) {
      assert.ok(SHAPE_LABELS[shape] && SHAPE_LABELS[shape].length > 2, shape);
      assert.ok(["x", "y"].includes(SHAPE_DEFS[shape].turn), `${shape} needs a turn axis`);
    }
  });

  it("makes every solid watertight, outward-facing and centred", () => {
    for (const shape of SHAPES) {
      const s = getSolid(shape);
      const edges = new Map();
      for (let t = 0; t < s.tris.length; t += 3) {
        const v = [s.tris[t], s.tris[t + 1], s.tris[t + 2]];
        if (v[0] === v[1] || v[1] === v[2] || v[0] === v[2]) continue;
        for (let k = 0; k < 3; k += 1) {
          const p = v[k], q = v[(k + 1) % 3];
          const key = p < q ? `${p}-${q}` : `${q}-${p}`;
          const e = edges.get(key) ?? { n: 0, dir: 0 };
          e.n += 1;
          e.dir += p < q ? 1 : -1;
          edges.set(key, e);
        }
      }
      for (const [key, e] of edges) {
        assert.ok(e.n === 2 && e.dir === 0, `${shape}: edge ${key} is not shared by exactly two consistently-wound faces`);
      }
      // Positive signed volume: the faces point outward.
      let volume = 0;
      const P = s.positions;
      for (let t = 0; t < s.tris.length; t += 3) {
        const a = s.tris[t] * 3, b = s.tris[t + 1] * 3, c = s.tris[t + 2] * 3;
        volume += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
      }
      assert.ok(volume > 10, `${shape} volume ${volume}`);
      // Centred on its bounding box.
      s.geometry.computeBoundingBox();
      const c = new THREE.Vector3();
      s.geometry.boundingBox.getCenter(c);
      assert.ok(c.length() < 1e-4, `${shape} centre ${c.toArray()}`);
      assert.ok(s.radius > 0 && s.radius < 10, `${shape} radius ${s.radius}`);
    }
  });

  it("has the volumes the formulae give, so the mesh really is the named shape", () => {
    const vol = (shape) => {
      const s = getSolid(shape);
      const P = s.positions;
      let v = 0;
      for (let t = 0; t < s.tris.length; t += 3) {
        const a = s.tris[t] * 3, b = s.tris[t + 1] * 3, c = s.tris[t + 2] * 3;
        v += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
      }
      return v;
    };
    const within = (shape, expected, rel) => {
      const got = vol(shape);
      assert.ok(Math.abs(got - expected) / expected < rel, `${shape}: ${got.toFixed(2)} vs ${expected.toFixed(2)}`);
    };
    within("cube", 1000, 1e-9);
    within("cuboid", 360, 1e-9);
    within("sphere", (4 / 3) * Math.PI * 125, 0.005);
    within("hemisphere", (2 / 3) * Math.PI * 125, 0.005);
    within("cylinder", Math.PI * 2.75 * 2.75 * 12, 0.005);
    within("cone", (Math.PI * 3.1 * 3.1 * 11) / 3, 0.005);
    within("pyramid", (7.5 * 7.5 * 10) / 3, 1e-9);
    within("ring", 2 * Math.PI * Math.PI * 3.6 * 1.2 * 1.2, 0.01);
    within("pipe", Math.PI * (9 - 4) * 10, 0.005);
    within("prism", 0.5 * 8 * 7 * 8, 1e-9);
  });

  it("draws the ring at the size it casts: outer radius 4.8 cm, hole radius 2.4 cm", () => {
    // The old ring was drawn 2.9 cm across and shadowed as if it were 8.
    const P = getSolid("ring").positions;
    let outer = 0;
    let inner = Infinity;
    for (let i = 0; i < P.length; i += 3) {
      const r = Math.hypot(P[i], P[i + 1]);
      outer = Math.max(outer, r);
      inner = Math.min(inner, r);
    }
    assert.ok(close(outer, 4.8, 1e-3), `${outer}`);
    assert.ok(close(inner, 2.4, 1e-3), `${inner}`);
  });

  it("turns with the same rotation the scene applies to the mesh", () => {
    for (const shape of SHAPES) {
      for (const angle of [0, 0.3, 1.1, Math.PI / 2, 3, 5.2]) {
        const R = turnMatrix(shape, angle);
        const m = SHAPE_DEFS[shape].turn === "x" ? new THREE.Matrix4().makeRotationX(angle) : new THREE.Matrix4().makeRotationY(angle);
        // three.js keeps matrices column-major.
        const e = m.elements;
        const rowMajor = [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]];
        rowMajor.forEach((v, i) => assert.ok(close(v, R[i], 1e-12), `${shape} ${angle} [${i}]`));
      }
    }
  });

  it("reports the lowest point of the turned solid, where its stand must stop", () => {
    assert.ok(close(underside("cylinder", 0), 6, 1e-6));
    assert.ok(close(underside("cylinder", Math.PI / 2), 2.75, 1e-6), "tipped end-on it lies along the bench, so only its radius hangs below");
    assert.ok(close(underside("sphere", 1.234), 5, 1e-3));
    assert.ok(underside("cube", Math.PI / 4) > underside("cube", 0) - 1e-9, "a cube spun on its edge is no lower than flat");
  });
});

describe("the lamp is a real area of points", () => {
  it("spreads its samples over the whole emitting face, one per stratum", () => {
    for (const source of ["point", "broad"]) {
      const s = SOURCES[source];
      const pts = sourceSamples(source, 60);
      assert.ok(pts.length >= 45, `${pts.length}`);
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      assert.ok(Math.min(...xs) >= -s.width / 2 - 1e-9 && Math.max(...xs) <= s.width / 2 + 1e-9);
      assert.ok(Math.min(...ys) >= -s.height / 2 - 1e-9 && Math.max(...ys) <= s.height / 2 + 1e-9);
      assert.ok(Math.max(...xs) - Math.min(...xs) > 0.8 * s.width, `${source} covers its width`);
    }
  });

  it("uses a genuinely wider lamp for the broad source", () => {
    assert.ok(SOURCES.broad.width > SOURCES.point.width * 5);
    assert.ok(SOURCES.broad.height > SOURCES.point.height);
  });
});

describe("umbra and penumbra", () => {
  it("gives a pinpoint source a perfectly sharp edge — no penumbra at all", () => {
    const b = shadowBands(5, 40, 50, 0);
    assert.ok(close(b.umbra, b.penumbra), "umbra and penumbra edges must coincide");
    assert.equal(b.penumbraWidth, 0);
  });

  it("gives a wide source a fuzzy border around a dark core", () => {
    const b = shadowBands(5, 40, 50, 6);
    assert.ok(b.umbra > 0, "there should still be a fully dark core");
    assert.ok(b.penumbra > b.umbra, "the penumbra must extend beyond the umbra");
  });

  it("makes the fuzzy band exactly sourceWidth × b ÷ a", () => {
    for (const [s, a, b] of [[6, 40, 50], [2, 10, 30], [14, 25, 25]]) {
      assert.ok(close(shadowBands(5, a, b, s).penumbraWidth, (s * b) / a));
    }
  });

  it("blurs the edge more as the screen moves back", () => {
    const near = shadowBands(5, 40, 10, 6).penumbraWidth;
    const far = shadowBands(5, 40, 60, 6).penumbraWidth;
    assert.ok(far > near);
  });

  it("can erase the umbra entirely with a wide enough source", () => {
    const b = shadowBands(1, 5, 60, 20);
    assert.ok(b.umbraLost, "a broad nearby source should wipe out the umbra");
    assert.equal(b.umbra, 0);
    assert.ok(b.penumbra > 0, "but there is still a partial shadow");
  });

  it("keeps the umbra no larger than the penumbra, ever", () => {
    for (const s of [0, 1, 6, 20]) {
      for (const a of [5, 20, 45]) {
        for (const b of [0, 20, 60]) {
          const bands = shadowBands(4, a, b, s);
          assert.ok(bands.umbra <= bands.penumbra + 1e-9, `s=${s} a=${a} b=${b}`);
          assert.ok(bands.umbra >= 0);
        }
      }
    }
  });

  it("measures the solved penumbra as the lamp's width × the near face's b ÷ a", () => {
    // A cube square on: its edges are the near face's, at depth a−5 from the lamp.
    for (const source of ["point", "broad"]) {
      const r = solveShadow({ ...bench, shape: "cube", source });
      const aNear = bench.objectZ - 5 - bench.lightZ;
      const bNear = bench.screenZ - (bench.objectZ - 5);
      assert.ok(close(r.horizontal.penumbraWidth, SOURCES[source].width * (bNear / aNear), 1e-9), source);
      assert.ok(close(r.vertical.penumbraWidth, SOURCES[source].height * (bNear / aNear), 1e-9), source);
    }
  });

  it("paints the penumbra as a linear ramp of shut-out lamp points across that width", () => {
    // Across the right edge of a cube, the number of lamp points blocked falls
    // linearly from all of them to none over exactly the penumbra's width.
    const params = { ...bench, shape: "cube", source: "broad" };
    const PX = 8;
    const field = castShadow(params, { pxPerCm: PX, samples: sourceSamples("broad", 120).map((s) => ({ ...s, jx: 0, jy: 0 })) });
    const r = solveShadow(params);
    const W = field.width;
    const row = (field.height / 2) | 0;
    const N = field.samples;
    // Walk from the middle of the shadow outward, to its right-hand edge.
    let umbraEdge = -1;
    let outerEdge = -1;
    for (let i = W / 2; i < W; i += 1) {
      const v = field.blocked[row * W + i];
      if (umbraEdge < 0 && v < N) umbraEdge = i;
      if (v === 0) { outerEdge = i; break; }
    }
    assert.ok(umbraEdge > 0 && outerEdge > umbraEdge);
    const measured = (outerEdge - umbraEdge) / PX;
    assert.ok(close(measured, r.horizontal.penumbraWidth, 0.5), `${measured.toFixed(2)} vs ${r.horizontal.penumbraWidth.toFixed(2)} cm`);
    // Monotone: never gets darker as it goes out.
    let previous = N;
    for (let i = umbraEdge; i <= outerEdge; i += 1) {
      const v = field.blocked[row * W + i];
      assert.ok(v <= previous, "the ramp must fall steadily");
      previous = v;
    }
    // …and the shadow's outer edge and its umbra's are the solved ones.
    const outerCm = (outerEdge - W / 2) / PX;
    assert.ok(close(outerCm, -r.box.outer.left, 0.4) || close(outerCm, r.box.outer.right, 0.4), `${outerCm}`);
  });

  it("blurs a thin arm by more than its own width under a wide, close lamp", () => {
    // The plus sign's arms are 3.4 cm wide; the wide lamp's penumbra is far wider than that.
    const r = solveShadow({ lightZ: 55 - 12, objectZ: 55, screenZ: 115, shape: "cross", source: "broad" });
    assert.ok(r.horizontal.penumbraWidth > 6, `${r.horizontal.penumbraWidth}`);
    assert.ok(r.horizontal.penumbra > 0);
  });

  it("finds a true umbra only where the whole lamp is shut out", () => {
    // Read off the painted rays: a pixel is umbra when ALL its lamp points are blocked.
    assert.equal(hasUmbra({ blocked: Uint8Array.from([0, 1, 2, 3]), samples: 4 }), false);
    assert.equal(hasUmbra({ blocked: Uint8Array.from([0, 1, 4, 3]), samples: 4 }), true);
    for (const source of ["point", "broad"]) {
      assert.ok(hasUmbra(castShadow({ ...bench, shape: "cube", source }, { pxPerCm: 4 })), `${source} cube`);
    }
    // No shadow at all, no umbra.
    assert.equal(hasUmbra({ blocked: new Uint8Array(16), samples: 8 }), false);
  });
});

describe("material opacity", () => {
  it("gives an opaque object a completely black shadow", () => {
    assert.equal(shadowDarkness("opaque"), 1);
    assert.equal(MATERIALS.opaque.transmission, 0);
    assert.ok(solveShadow({ ...bench, material: "opaque" }).castsShadow);
    const f = castShadow({ ...bench, shape: "cube", material: "opaque" }, { pxPerCm: 4 });
    const centre = f.shade[((f.height / 2) | 0) * f.width + (f.width / 2 | 0)];
    assert.equal(centre, 1);
  });

  it("gives a translucent object a partial, paler shadow", () => {
    const d = shadowDarkness("translucent");
    assert.ok(d > 0.2 && d < 0.8, `darkness ${d}`);
    assert.ok(d < shadowDarkness("opaque"), "must be lighter than opaque");
    assert.ok(d > shadowDarkness("transparent"), "must be darker than transparent");
    assert.ok(solveShadow({ ...bench, material: "translucent" }).castsShadow);
  });

  it("gives a transparent object effectively no shadow", () => {
    assert.ok(shadowDarkness("transparent") < 0.1);
    assert.ok(!solveShadow({ ...bench, material: "transparent" }).castsShadow);
    const f = castShadow({ ...bench, shape: "cube", material: "transparent" }, { pxPerCm: 4 });
    assert.ok(Math.max(...f.shade) < 0.2, `${Math.max(...f.shade)}`);
  });

  it("orders the three materials correctly, every time", () => {
    const order = ["opaque", "translucent", "transparent"].map(shadowDarkness);
    assert.deepEqual(order, [...order].sort((a, b) => b - a));
  });

  it("never lets a material transmit more light than arrives", () => {
    for (const m of Object.values(MATERIALS)) {
      assert.ok(m.transmission >= 0 && m.transmission <= 1);
      assert.ok(m.scatter >= 0 && m.scatter <= 1);
    }
    assert.equal(MATERIAL_OPTIONS.length, 3);
  });

  it("dims light by the path it took through the object (Beer–Lambert)", () => {
    // A ray through the middle of the sphere crosses 2r = 10 cm of material;
    // one nearer the rim crosses a shorter chord. T = τ^(length ÷ reference).
    const f = castShadow({ ...bench, shape: "sphere", material: "translucent", source: "point" }, { samples: ONE, pxPerCm: 8 });
    const tau = MATERIALS.translucent.transmission;
    const ref = MATERIALS.translucent.referenceCm;
    const row = (f.height / 2) | 0;
    const a = bench.objectZ - bench.lightZ;
    const D = bench.screenZ - bench.lightZ;
    const centre = f.shade[row * f.width + f.width / 2];
    assert.ok(close(centre, 1 - tau ** (10 / ref), 2e-3), `${centre}`);
    for (const col of [f.width / 2 - 24, f.width / 2 - 48, f.width / 2 - 72]) {
      const X = (f.width / 2 - (col + 0.5)) / f.pxPerCm;
      const d = a * Math.sin(Math.atan2(X, D)); // how far the ray passes from the sphere's centre
      const chord = 2 * Math.sqrt(25 - d * d);
      assert.ok(close(f.shade[row * f.width + col], 1 - tau ** (chord / ref), 2e-3), `X=${X.toFixed(2)}`);
    }
    assert.ok(centre > f.shade[row * f.width + f.width / 2 - 72], "thicker in the middle, so darker");
  });
});

describe("what a letter looks like from the torch", () => {
  /** The furthest column the blocked region reaches on one side, within a band of its rows. */
  const reach = (field, fromFrac, toFrac, side) => {
    const { width: W, height: H, blocked } = field;
    let best = side === "right" ? -1 : W;
    let top = H;
    let bottom = -1;
    for (let j = 0; j < H; j += 1) for (let i = 0; i < W; i += 1) if (blocked[j * W + i]) { top = Math.min(top, j); bottom = Math.max(bottom, j); }
    for (let j = Math.floor(top + (bottom - top) * fromFrac); j <= Math.floor(top + (bottom - top) * toFrac); j += 1) {
      for (let i = 0; i < W; i += 1) {
        if (!blocked[j * W + i]) continue;
        best = side === "right" ? Math.max(best, i) : Math.min(best, i);
      }
    }
    return best;
  };
  const rightReach = (f, a, b) => reach(f, a, b, "right");
  const leftReach = (f, a, b) => reach(f, a, b, "left");

  it("reads a letter L the right way round, foot to the right, as seen from the torch", () => {
    const f = castShadow({ ...bench, shape: "letterL", rotation: 0, source: "point" }, { samples: ONE, pxPerCm: 4 });
    assert.ok(rightReach(f, 0.85, 1) > rightReach(f, 0, 0.3) + 20, "the foot sticks out to the right at the bottom");
  });

  it("shows it back to front when it is turned round to face away", () => {
    const f = castShadow({ ...bench, shape: "letterL", rotation: Math.PI, source: "point" }, { samples: ONE, pxPerCm: 4 });
    // The stem is now on the right and the foot points left: at the bottom the
    // shadow reaches further left than it does at the top.
    assert.ok(leftReach(f, 0.85, 1) < leftReach(f, 0, 0.3) - 20, "the foot points left");
  });

  it("turns a flat letter edge-on into a narrow bar", () => {
    for (const shape of ["letterT", "letterL", "letterF", "star", "heart", "cross", "arrow"]) {
      const face = solveShadow({ ...bench, shape, rotation: 0 });
      const edge = solveShadow({ ...bench, shape, rotation: Math.PI / 2 });
      assert.ok(edge.shadowWidthCm < face.shadowWidthCm * 0.5, `${shape}: ${edge.shadowWidthCm.toFixed(1)} vs ${face.shadowWidthCm.toFixed(1)}`);
    }
  });
});

describe("naming what landed on the screen", () => {
  const name = (shape, rotation = 0, source = "point") => {
    // At the resolution the screen is painted at.
    const field = castShadow({ ...bench, shape, rotation, source }, { pxPerCm: 8 });
    return describeShadow({ shape, rotation, field });
  };

  it("calls a standing cylinder a rectangle and one turned end-on a circle", () => {
    assert.equal(name("cylinder", 0), "a rectangle");
    assert.equal(name("cylinder", deg(90)), "a circle");
  });

  it("calls a sphere a circle whichever way it is turned", () => {
    for (const d of [0, 33, 90, 200]) assert.equal(name("sphere", deg(d)), "a circle");
  });

  it("calls a cube square on a square, an upright cone a triangle, and its base a circle", () => {
    assert.equal(name("cube", 0), "a square");
    assert.equal(name("cone", 0), "a triangle");
    assert.equal(name("cone", deg(90)), "a circle");
  });

  it("tells a diamond from a triangle: both fill half their box", () => {
    assert.equal(name("octahedron", 0), "a diamond");
    assert.equal(name("pyramid", 0), "a triangle");
  });

  it("finds the hole in a ring face-on and a pipe seen end-on", () => {
    assert.match(name("ring", 0), /hole/);
    assert.match(name("pipe", deg(90)), /hole/);
    assert.equal(name("pipe", 0), "a rectangle");
  });

  it("names a cut-out, its mirror image and its edge-on view", () => {
    assert.equal(name("letterT", 0), "the letter T");
    assert.match(name("letterL", Math.PI), /back to front/);
    assert.match(name("star", deg(90)), /narrow bar/);
    assert.match(name("heart", deg(40)), /squashed/);
  });

  it("admits when the shadow has run off the paper", () => {
    const field = castShadow({ ...bench, ...PRESETS.huge, shape: "cube" }, { pxPerCm: 4 });
    assert.match(describeShadow({ shape: "cube", rotation: 0, field }), /running off/);
  });
});

describe("the rays that are drawn", () => {
  it("passes each ray exactly through a vertex of the solid, in a straight line, to the screen", () => {
    for (const shape of ["cube", "cylinder", "star", "ring"]) {
      const params = { shape, rotation: 0.5, ...bench, source: "point" };
      const rays = lightRays(params);
      assert.ok(rays.length >= 4, shape);
      const { world } = placeSolid({ shape, rotation: 0.5, objectZ: bench.objectZ });
      for (const r of rays) {
        assert.equal(r.to[2], bench.screenZ);
        assert.equal(r.from[2], bench.lightZ);
        // Collinear: from → through → to is one straight line.
        const t = (r.through[2] - r.from[2]) / (r.to[2] - r.from[2]);
        assert.ok(close(r.from[0] + (r.to[0] - r.from[0]) * t, r.through[0], 1e-9), shape);
        assert.ok(close(r.from[1] + (r.to[1] - r.from[1]) * t, r.through[1], 1e-9), shape);
        // …and it goes through a real vertex of the drawn solid.
        let found = false;
        for (let i = 0; i < world.length && !found; i += 3) {
          found = close(world[i], r.through[0], 1e-9) && close(world[i + 1], r.through[1], 1e-9) && close(world[i + 2], r.through[2], 1e-9);
        }
        assert.ok(found, `${shape}: the ray does not pass through the solid`);
      }
    }
  });

  it("lands every ray on the edge of the shadow it explains", () => {
    const params = { shape: "heart", rotation: 0.2, ...bench, source: "point" };
    const rays = lightRays(params);
    const field = castShadow(params, { samples: ONE, pxPerCm: 8 });
    const W = field.width;
    const H = field.height;
    for (const r of rays.filter((q) => q.kind === "fan")) {
      // The screen point, as a pixel; the shadow must reach it but not run far beyond it.
      const col = Math.round(W / 2 - r.to[0] * 8);
      const row = Math.round(H / 2 - r.to[1] * 8);
      let near = false;
      for (let dj = -2; dj <= 2 && !near; dj += 1) for (let di = -2; di <= 2 && !near; di += 1) {
        const i = col + di, j = row + dj;
        if (i >= 0 && j >= 0 && i < W && j < H && field.blocked[j * W + i]) near = true;
      }
      assert.ok(near, "a fan ray must land on the shadow's outline");
    }
  });

  it("draws the four edge rays of a wide lamp on the solved umbra and penumbra edges", () => {
    const params = { shape: "cube", rotation: 0, ...bench, source: "broad" };
    const rays = lightRays(params);
    const solved = solveShadow(params);
    const outer = rays.filter((r) => r.kind === "outer").map((r) => r.to[0]).sort((p, q) => p - q);
    const inner = rays.filter((r) => r.kind === "inner").map((r) => r.to[0]).sort((p, q) => p - q);
    assert.equal(outer.length, 2);
    assert.equal(inner.length, 2);
    // The viewer's u is −x, so the outer left edge is at x = −left, and so on.
    assert.ok(close(outer[0], -solved.box.outer.right, 1e-9), `${outer[0]} vs ${-solved.box.outer.right}`);
    assert.ok(close(outer[1], -solved.box.outer.left, 1e-9));
    assert.ok(close(inner[0], -solved.box.inner.right, 1e-9));
    assert.ok(close(inner[1], -solved.box.inner.left, 1e-9));
  });

  it("draws no edge rays for a pinpoint lamp: its two edges are one", () => {
    const rays = lightRays({ shape: "cube", rotation: 0, ...bench, source: "point" });
    assert.ok(rays.every((r) => r.kind === "fan"));
  });
});

describe("brightness", () => {
  it("falls off as the inverse square of the distance", () => {
    assert.ok(close(screenBrightness(20) / screenBrightness(40), 4, 1e-9));
    assert.ok(close(screenBrightness(10) / screenBrightness(30), 9, 1e-9));
  });
});

describe("keeping the bench in order", () => {
  it("keeps the lamp, object and screen a whole solid's reach apart", () => {
    for (const shape of SHAPES) {
      const gap = benchGap(shape);
      assert.ok(gap > getSolid(shape).radius, `${shape}: gap ${gap} vs radius ${getSolid(shape).radius}`);
      const fixed = enforceBench({ lightZ: 54, objectZ: 55, screenZ: 56 }, shape);
      assert.ok(fixed.objectZ - fixed.lightZ >= gap - 1e-9, shape);
      assert.ok(fixed.screenZ - fixed.objectZ >= gap - 1e-9, shape);
      assert.ok(fixed.lightZ >= BENCH.min && fixed.screenZ <= BENCH.max, shape);
    }
  });

  it("leaves a sensible layout alone", () => {
    assert.deepEqual(enforceBench(bench, "cube"), bench);
  });

  it("never lets a turned solid poke through the lamp or the screen", () => {
    for (const shape of SHAPES) {
      const layout = enforceBench({ lightZ: 50, objectZ: 55, screenZ: 60 }, shape);
      for (let d = 0; d < 360; d += 15) {
        const { world } = placeSolid({ shape, rotation: deg(d), objectZ: layout.objectZ });
        let zMin = Infinity;
        let zMax = -Infinity;
        for (let i = 2; i < world.length; i += 3) {
          zMin = Math.min(zMin, world[i]);
          zMax = Math.max(zMax, world[i]);
        }
        assert.ok(zMin > layout.lightZ, `${shape} at ${d}° reaches the lamp`);
        assert.ok(zMax < layout.screenZ, `${shape} at ${d}° reaches the screen`);
      }
    }
  });
});

describe("presets do what they promise", () => {
  const applied = (preset, shape = "cylinder") => {
    const fixed = enforceBench({ ...bench, ...Object.fromEntries(["lightZ", "objectZ", "screenZ"].filter((k) => preset[k] !== undefined).map((k) => [k, preset[k]])) }, shape);
    return solveShadow({ ...fixed, shape, rotation: preset.rotation ?? 0 });
  };

  it("makes the shadow huge", () => {
    const baseline = solveShadow(bench);
    const preset = applied(PRESETS.huge);
    assert.ok(preset.magnification > baseline.magnification * 1.8, `${preset.magnification.toFixed(2)}×`);
  });

  it("makes the shadow tiny", () => {
    const baseline = solveShadow(bench);
    const preset = applied(PRESETS.tiny);
    assert.ok(preset.magnification < baseline.magnification, `${preset.magnification.toFixed(2)}×`);
    assert.ok(preset.magnification < 1.3, "should be close to life size");
  });

  it("turns the cylinder into a circle", () => {
    const field = castShadow({ ...bench, shape: PRESETS.circle.shape, rotation: PRESETS.circle.rotation }, { pxPerCm: 8 });
    assert.equal(describeShadow({ shape: "cylinder", rotation: PRESETS.circle.rotation, field }), "a circle");
  });

  it("keeps every preset inside the bench", () => {
    for (const preset of Object.values(PRESETS)) {
      for (const key of ["lightZ", "objectZ", "screenZ"]) {
        if (preset[key] === undefined) continue;
        assert.ok(preset[key] >= BENCH.min && preset[key] <= BENCH.max, `${preset.label}.${key}`);
      }
    }
  });
});

describe("solveShadow contract", () => {
  it("returns finite, non-negative geometry across the whole bench, for every shape", () => {
    for (const lightZ of [0, 20, 45]) {
      for (const screenZ of [56, 80, 120]) {
        for (const shape of SHAPES) {
          for (const source of ["point", "broad"]) {
            const layout = enforceBench({ lightZ, objectZ: 55, screenZ }, shape);
            const r = solveShadow({ ...layout, shape, source, rotation: 0.7 });
            assert.ok(Number.isFinite(r.magnification) && r.magnification >= 1, `${shape} M`);
            assert.ok(r.shadowWidthCm > 0 && r.shadowHeightCm > 0, `${shape} size`);
            assert.ok(r.horizontal.umbra >= 0 && r.vertical.umbra >= 0);
            assert.ok(r.horizontal.penumbraWidth >= 0 && r.vertical.penumbraWidth >= 0);
            assert.ok(Number.isFinite(r.brightness) && r.brightness > 0);
          }
        }
      }
    }
  });

  it("survives the light being placed level with the object", () => {
    const r = solveShadow({ lightZ: 55, objectZ: 55, screenZ: 105 });
    assert.ok(Number.isFinite(r.magnification), "must not divide by zero");
    assert.ok(Number.isFinite(r.shadowWidthCm));
  });

  it("keeps the shadow at least as big as the object", () => {
    for (const lightZ of [0, 15, 35, 46]) {
      const r = solveShadow({ ...bench, lightZ });
      assert.ok(r.magnification >= 1, `M=${r.magnification} at lightZ=${lightZ}`);
    }
  });

  it("agrees with the painted picture about how big the shadow is", () => {
    for (const shape of ["cylinder", "cube", "heart", "ring", "sphere"]) {
      for (const source of ["point", "broad"]) {
        const params = { ...bench, shape, rotation: 0.3, source };
        const r = solveShadow(params);
        const m = measureField(castShadow(params, { pxPerCm: 8 }), 0.0001);
        // The picture's outermost fringe is lit by only the lamp's extreme
        // corner — under one lamp sample in a hundred, invisibly faint — so the
        // painted edge stops up to half a lamp-sample short of the analytic one.
        const tol = source === "broad" ? 1 : 0.4;
        assert.ok(close(m.outer.right - m.outer.left, r.shadowWidthCm, tol), `${shape}/${source} width ${(m.outer.right - m.outer.left).toFixed(2)} vs ${r.shadowWidthCm.toFixed(2)}`);
        assert.ok(close(m.outer.top - m.outer.bottom, r.shadowHeightCm, tol), `${shape}/${source} height`);
      }
    }
  });
});

describe("the scene must actually show the shadow", () => {
  // The bug this block exists to prevent: the shadow lands on the face of the
  // screen that points BACK at the lamp, and the default camera was parked
  // past the screen, looking at its blank back nearly edge-on. Nothing was
  // ever visibly projected onto anything.
  it("stands the camera on the lamp's side of the screen", () => {
    assert.ok(
      seesShadowSide(SCENE.cameraBenchZ, BENCH.screenHome),
      `camera at ${SCENE.cameraBenchZ} cm is not in front of the screen at ${BENCH.screenHome} cm`,
    );
  });

  it("keeps the camera behind the lamp so the whole bench is in front of it", () => {
    assert.ok(SCENE.cameraBenchZ <= BENCH.min, "camera should not sit inside the apparatus");
  });

  it("aims the camera at the bench between the object and the screen", () => {
    assert.ok(SCENE.targetBenchZ > BENCH.objectHome);
    assert.ok(SCENE.targetBenchZ <= BENCH.screenHome);
  });

  it("keeps every reachable position on a screen that stands on the bench", () => {
    assert.ok(
      SCENE.screenHalfHeightCm <= SCENE.axisHeightCm,
      "screen would extend below the bench surface",
    );
  });

  it("keeps the bench in a physically possible order", () => {
    assert.ok(BENCH.lightHome < BENCH.objectHome);
    assert.ok(BENCH.objectHome < BENCH.screenHome);
    assert.ok(BENCH.screenHome <= BENCH.max);
  });

  it("fits the default shadow comfortably on the paper, for every shape", () => {
    for (const shape of SHAPES) {
      assert.ok(shadowFitsScreen(solveShadow({ ...bench, shape })), `${shape} must land on the screen at the home layout`);
    }
  });

  it("notices when a shadow has grown off the edge of the screen", () => {
    const huge = solveShadow({ ...enforceBench({ ...bench, ...PRESETS.huge }, "cube"), shape: "cube" });
    assert.equal(shadowFitsScreen(huge), false, "the huge preset overflows and should say so");
  });
});

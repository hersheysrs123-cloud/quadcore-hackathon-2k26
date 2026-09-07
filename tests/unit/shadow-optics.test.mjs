import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BENCH,
  MATERIALS,
  MATERIAL_OPTIONS,
  SOURCES,
  SHAPES,
  SHAPE_LABELS,
  PRESETS,
  silhouette,
  magnification,
  shadowBands,
  shadowDarkness,
  screenBrightness,
  shadowEdgeOnScreen,
  solveShadow,
} from "../../lib/shadowOptics.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const bench = { lightZ: 12, objectZ: 55, screenZ: 105 };

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
    for (const lightZ of [0, 10, 20, 30, 40, 50]) {
      const M = solveShadow({ ...bench, lightZ }).magnification;
      assert.ok(M > previous, `lamp at ${lightZ} should magnify more than the step before`);
      previous = M;
    }
  });

  it("makes the shadow SMALLER as the lamp moves further away", () => {
    const near = solveShadow({ ...bench, lightZ: 45 });
    const far = solveShadow({ ...bench, lightZ: 0 });
    assert.ok(far.shadowWidthCm < near.shadowWidthCm);
  });

  it("approaches life size as the lamp recedes toward parallel rays", () => {
    // With the lamp a kilometre away the rays are effectively parallel and the
    // shadow is the same size as the object.
    const M = magnification(100000, 50);
    assert.ok(close(M, 1, 0.001), `${M}`);
  });
});

describe("rule 2 — moving the SCREEN changes the shadow size", () => {
  it("makes the shadow BIGGER as the screen moves further from the object", () => {
    let previous = 0;
    for (const screenZ of [56, 70, 85, 100, 118]) {
      const M = solveShadow({ ...bench, screenZ }).magnification;
      assert.ok(M > previous, `screen at ${screenZ} should magnify more`);
      previous = M;
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

describe("material opacity", () => {
  it("gives an opaque object a completely black shadow", () => {
    assert.equal(shadowDarkness("opaque"), 1);
    assert.equal(MATERIALS.opaque.transmission, 0);
    assert.ok(solveShadow({ ...bench, material: "opaque" }).castsShadow);
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
    // A wide lamp very close to a small object: every point of the shadow
    // still sees part of the lamp, so nothing is fully dark.
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

  it("uses a genuinely wider lamp for the broad source", () => {
    assert.ok(SOURCES.broad.width > SOURCES.point.width * 5);
  });
});

describe("3D shape and orientation", () => {
  it("turns a standing cylinder's rectangle into a circle", () => {
    assert.equal(silhouette("cylinder", 0).kind, "rectangle");
    assert.equal(silhouette("cylinder", Math.PI / 2).kind, "circle");
    assert.equal(silhouette("cylinder", 0).description, "a rectangle");
    assert.equal(silhouette("cylinder", Math.PI / 2).description, "a circle");
  });

  it("makes the turned cylinder's silhouette square, as a circle must be", () => {
    const turned = silhouette("cylinder", Math.PI / 2);
    assert.ok(close(turned.halfWidth, turned.halfHeight, 1e-9));
  });

  it("shortens the cylinder's shadow overall as it tips end-on", () => {
    const upright = silhouette("cylinder", 0).halfHeight;
    const endOn = silhouette("cylinder", Math.PI / 2).halfHeight;
    assert.ok(endOn < upright * 0.6, `${endOn.toFixed(2)} vs ${upright.toFixed(2)}`);
    // Monotonic once past the rim-edge bulge below.
    let previous = Infinity;
    for (const deg of [40, 60, 80, 90]) {
      const h = silhouette("cylinder", (deg * Math.PI) / 180).halfHeight;
      assert.ok(h < previous, `${deg}° should be shorter than the step before`);
      previous = h;
    }
  });

  it("grows slightly taller at first, because the tilted rim swings up", () => {
    // Projected half-height is (h/2)cos θ + r sin θ, whose slope at θ = 0 is
    // +r — so a small tilt genuinely lengthens the silhouette before the
    // foreshortening of the axis takes over. Worth asserting: it looks like a
    // bug on screen until you work out that it is real.
    const upright = silhouette("cylinder", 0).halfHeight;
    const tipped = silhouette("cylinder", (20 * Math.PI) / 180).halfHeight;
    assert.ok(tipped > upright, `${tipped.toFixed(3)} should exceed ${upright.toFixed(3)}`);
  });

  it("keeps the cylinder's shadow the same width however it tips", () => {
    const widths = [0, 30, 60, 90].map((d) => silhouette("cylinder", (d * Math.PI) / 180).halfWidth);
    assert.ok(widths.every((w) => close(w, widths[0], 1e-9)), widths.join(", "));
  });

  it("widens a cube to its diagonal at 45°", () => {
    const flat = silhouette("cube", 0).halfWidth;
    const diagonal = silhouette("cube", Math.PI / 4).halfWidth;
    assert.ok(close(diagonal / flat, Math.SQRT2, 1e-9), `${(diagonal / flat).toFixed(4)}`);
  });

  it("leaves a sphere's shadow a circle no matter how it is turned", () => {
    const base = silhouette("sphere", 0);
    for (const deg of [15, 45, 90, 137, 260]) {
      const turned = silhouette("sphere", (deg * Math.PI) / 180);
      assert.deepEqual(turned, base, `a sphere at ${deg}° must look identical`);
    }
  });

  it("turns a letter edge-on into a narrow bar", () => {
    for (const letter of ["letterT", "letterL"]) {
      const face = silhouette(letter, 0);
      const edge = silhouette(letter, Math.PI / 2);
      assert.ok(edge.halfWidth < face.halfWidth * 0.4, `${letter} should narrow sharply`);
      assert.ok(face.description.includes(letter === "letterT" ? "T" : "L"));
    }
  });

  it("names and sizes every shape on the shelf", () => {
    for (const shape of SHAPES) {
      const sil = silhouette(shape, 0.4);
      assert.ok(sil.halfWidth > 0 && sil.halfHeight > 0, shape);
      assert.ok(typeof sil.description === "string" && sil.description.length > 0, shape);
      assert.ok(SHAPE_LABELS[shape], `${shape} needs a label`);
    }
  });

  it("scales every silhouette with the object size", () => {
    for (const shape of SHAPES) {
      const small = silhouette(shape, 0.3, 5);
      const big = silhouette(shape, 0.3, 10);
      assert.ok(close(big.halfWidth / small.halfWidth, 2, 1e-9), shape);
    }
  });
});

describe("brightness", () => {
  it("falls off as the inverse square of the distance", () => {
    assert.ok(close(screenBrightness(20) / screenBrightness(40), 4, 1e-9));
    assert.ok(close(screenBrightness(10) / screenBrightness(30), 9, 1e-9));
  });
});

describe("presets do what they promise", () => {
  it("makes the shadow huge", () => {
    const preset = solveShadow({ ...bench, ...PRESETS.huge });
    const baseline = solveShadow(bench);
    assert.ok(preset.magnification > baseline.magnification * 1.8, `${preset.magnification.toFixed(2)}×`);
  });

  it("makes the shadow tiny", () => {
    const preset = solveShadow({ ...bench, ...PRESETS.tiny });
    const baseline = solveShadow(bench);
    assert.ok(preset.magnification < baseline.magnification, `${preset.magnification.toFixed(2)}×`);
    assert.ok(preset.magnification < 1.2, "should be close to life size");
  });

  it("turns the cylinder into a circle", () => {
    const preset = solveShadow({ ...bench, ...PRESETS.circle });
    assert.equal(preset.outline.kind, "circle");
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
  it("returns finite, non-negative geometry across the whole bench", () => {
    for (const lightZ of [0, 20, 45]) {
      for (const screenZ of [56, 80, 120]) {
        for (const shape of SHAPES) {
          for (const source of ["point", "broad"]) {
            const r = solveShadow({ lightZ, objectZ: 55, screenZ, shape, source, rotation: 0.7 });
            assert.ok(Number.isFinite(r.magnification) && r.magnification >= 1);
            assert.ok(r.shadowWidthCm >= 0 && r.shadowHeightCm >= 0);
            assert.ok(r.horizontal.umbra >= 0 && r.vertical.umbra >= 0);
            assert.ok(Number.isFinite(r.brightness) && r.brightness > 0);
          }
        }
      }
    }
  });

  it("survives the light being placed level with the object", () => {
    const r = solveShadow({ lightZ: 55, objectZ: 55, screenZ: 105 });
    assert.ok(Number.isFinite(r.magnification), "must not divide by zero");
  });

  it("keeps the shadow at least as big as the object", () => {
    // With the lamp on the near side, a shadow can never be smaller than life size.
    for (const lightZ of [0, 15, 35, 50]) {
      const r = solveShadow({ ...bench, lightZ });
      assert.ok(r.magnification >= 1, `M=${r.magnification} at lightZ=${lightZ}`);
    }
  });
});

describe("scene geometry — drawn rays must reach the computed shadow edge", () => {
  /** Mirrors the edge-ray construction in ShadowLabCanvas. */
  const landing = (sourceOffset, objectEdge, lightZ, objectZ, screenZ) => {
    const t = (screenZ - lightZ) / (objectZ - lightZ);
    return sourceOffset + (objectEdge - sourceOffset) * t;
  };

  it("lands the near-edge ray exactly on the penumbra boundary", () => {
    for (const [lightZ, objectZ, screenZ] of [[12, 55, 105], [0, 30, 120], [40, 55, 60]]) {
      for (const source of ["point", "broad"]) {
        const solved = solveShadow({ lightZ, objectZ, screenZ, shape: "cube", source });
        const x = landing(-solved.sourceWidth / 2, solved.outline.halfWidth, lightZ, objectZ, screenZ);
        assert.ok(close(x, solved.horizontal.penumbra, 1e-9), `${source} ${lightZ}/${objectZ}/${screenZ}`);
      }
    }
  });

  it("lands the far-edge ray exactly on the umbra boundary", () => {
    const [lightZ, objectZ, screenZ] = [12, 55, 105];
    const solved = solveShadow({ lightZ, objectZ, screenZ, shape: "cube", source: "broad" });
    const x = landing(solved.sourceWidth / 2, solved.outline.halfWidth, lightZ, objectZ, screenZ);
    assert.ok(close(x, solved.horizontal.umbra, 1e-9), `${x.toFixed(4)} vs ${solved.horizontal.umbra.toFixed(4)}`);
  });

  it("keeps the pinpoint lamp's two edge rays visually coincident", () => {
    const solved = solveShadow({ lightZ: 12, objectZ: 55, screenZ: 105, source: "point" });
    const near = landing(-solved.sourceWidth / 2, solved.outline.halfWidth, 12, 55, 105);
    const far = landing(solved.sourceWidth / 2, solved.outline.halfWidth, 12, 55, 105);
    assert.ok(Math.abs(near - far) < 0.5, `${(near - far).toFixed(3)} cm apart — should read as one sharp edge`);
  });

  it("keeps the bench in a physically possible order", () => {
    // Object between lamp and screen, which the canvas clamps enforce.
    assert.ok(BENCH.lightHome < BENCH.objectHome);
    assert.ok(BENCH.objectHome < BENCH.screenHome);
    assert.ok(BENCH.screenHome <= BENCH.max);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DOMAIN_DIRECTIONS,
  ELECTRON_GEOMETRY,
  IDEAL_ANGLE,
  IDEAL_ANGLE_LABEL,
  LONE_PAIR_COMPRESSION,
  MOLECULES,
  SHAPES,
  smallestAngleOf,
  solveVsepr,
  vseprGeometry,
} from "../../lib/vsepr.js";

/** Every combination the two sliders can reach: 1–6 bonds, 0–3 lone pairs, steric ≤ 6. */
const REACHABLE = [];
for (let b = 1; b <= 6; b += 1) {
  for (let l = 0; l <= 3; l += 1) {
    if (b + l <= 6) REACHABLE.push([b, l]);
  }
}

const close = (a, b, tol) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} to be within ${tol} of ${b}`);

describe("the domain tables", () => {
  it("holds a direction set for every steric number 2–6", () => {
    for (let s = 2; s <= 6; s += 1) {
      assert.equal(DOMAIN_DIRECTIONS[s].length, s, `steric ${s} has the wrong domain count`);
      assert.ok(ELECTRON_GEOMETRY[s]);
      assert.ok(IDEAL_ANGLE[s]);
      assert.ok(IDEAL_ANGLE_LABEL[s]);
    }
  });

  it("keeps every domain direction a unit vector", () => {
    for (let s = 2; s <= 6; s += 1) {
      for (const d of DOMAIN_DIRECTIONS[s]) close(d.length(), 1, 1e-9);
    }
  });

  it("reproduces the ideal angles from the geometry alone", () => {
    close(smallestAngleOf(DOMAIN_DIRECTIONS[2]), 180, 1e-6);
    close(smallestAngleOf(DOMAIN_DIRECTIONS[3]), 120, 1e-6);
    close(smallestAngleOf(DOMAIN_DIRECTIONS[4]), 109.4712, 1e-3);
    close(smallestAngleOf(DOMAIN_DIRECTIONS[5]), 90, 1e-6);
    close(smallestAngleOf(DOMAIN_DIRECTIONS[6]), 90, 1e-6);
  });

  it("puts the lone-pair sites last, where the model takes them from", () => {
    // Trigonal bipyramidal: lone pairs go equatorial, so the equatorial sites
    // must come after the two axial ones.
    const tbp = DOMAIN_DIRECTIONS[5];
    close(Math.abs(tbp[0].y), 1, 1e-9);
    close(Math.abs(tbp[1].y), 1, 1e-9);
    for (let i = 2; i < 5; i += 1) close(tbp[i].y, 0, 1e-9);
    // Octahedral: the second lone pair must land trans to the first.
    const oct = DOMAIN_DIRECTIONS[6];
    close(oct[4].dot(oct[5]), -1, 1e-9);
  });
});

describe("the shape table", () => {
  // The regression: the panel's table stopped at 6-0, so seesaw, T-shaped,
  // square pyramidal, square planar and linear XeF₂ all printed as
  // "<electron geometry> (n bonds, m lone)".
  it("names EVERY reachable slider combination", () => {
    for (const [b, l] of REACHABLE) {
      const entry = SHAPES[`${b}-${l}`];
      assert.ok(entry, `AX${b}E${l} has no entry`);
      assert.ok(entry.name.length > 0);
      assert.ok(!entry.name.includes("undefined"));
    }
  });

  it("holds nothing the sliders cannot reach", () => {
    const reachable = new Set(REACHABLE.map(([b, l]) => `${b}-${l}`));
    for (const k of Object.keys(SHAPES)) assert.ok(reachable.has(k), `${k} is unreachable`);
  });

  it("gives the standard names for the shapes the syllabus teaches", () => {
    assert.equal(SHAPES["4-0"].name, "Tetrahedral");
    assert.equal(SHAPES["3-1"].name, "Trigonal pyramidal");
    assert.equal(SHAPES["2-2"].name, "Bent");
    assert.equal(SHAPES["2-1"].name, "Bent");
    assert.equal(SHAPES["3-0"].name, "Trigonal planar");
    assert.equal(SHAPES["2-0"].name, "Linear");
    assert.equal(SHAPES["4-1"].name, "Seesaw");
    assert.equal(SHAPES["3-2"].name, "T-shaped");
    assert.equal(SHAPES["5-1"].name, "Square pyramidal");
  });

  // The one the topic's own quiz asks about.
  it("calls AX₄E₂ square planar, not octahedral", () => {
    const s = solveVsepr(4, 2);
    assert.equal(s.shape, "Square planar");
    assert.equal(s.example, "XeF₄");
    assert.equal(s.electronGeometry, "Octahedral");
    assert.notEqual(s.shape, s.electronGeometry);
  });

  it("calls AX₂E₃ linear, not trigonal bipyramidal", () => {
    const s = solveVsepr(2, 3);
    assert.equal(s.shape, "Linear");
    assert.equal(s.example, "XeF₂");
    assert.equal(s.electronGeometry, "Trigonal bipyramidal");
  });
});

describe("solved geometry", () => {
  it("draws exactly as many bonds and lone pairs as asked for", () => {
    for (const [b, l] of REACHABLE) {
      const g = vseprGeometry(b, l);
      assert.equal(g.bonds.length, b, `AX${b}E${l} drew ${g.bonds.length} bonds`);
      assert.equal(g.lonePairs.length, l, `AX${b}E${l} drew ${g.lonePairs.length} lone pairs`);
      assert.equal(g.steric, Math.max(2, b + l));
      for (const d of g.bonds) close(d.length(), 1, 1e-9);
    }
  });

  it("reproduces the observed angles the model exists to explain", () => {
    // 109.5° → 107° → 104.5°, one lone pair at a time.
    close(solveVsepr(4, 0).angle, 109.47, 0.05);
    close(solveVsepr(3, 1).angle, 106.97, 0.2);
    close(solveVsepr(2, 2).angle, 104.47, 0.2);
  });

  it("closes the angle by about 2.5° per lone pair where they do not cancel", () => {
    close(solveVsepr(3, 1).compression, LONE_PAIR_COMPRESSION, 0.2);
    close(solveVsepr(2, 2).compression, LONE_PAIR_COMPRESSION * 2, 0.2);
  });

  // The regression: the panel reported a flat `lone × 2.5°` squeeze even where
  // the lone pairs sit opposite each other and their repulsions cancel, so
  // AX₄E₂ read "5.0° squeeze" over a scene drawing a clean 90°.
  it("reports NO compression where the lone pairs cancel", () => {
    const xef4 = solveVsepr(4, 2);
    assert.equal(xef4.cancels, true);
    close(xef4.compression, 0, 0.05);
    close(xef4.angle, 90, 0.05);

    const xef2 = solveVsepr(2, 3);
    assert.equal(xef2.cancels, true);
    close(xef2.compression, 0, 0.05);
    close(xef2.angle, 180, 0.05);
  });

  it("measures the reported angle off the geometry actually drawn", () => {
    for (const [b, l] of REACHABLE) {
      const s = solveVsepr(b, l);
      if (b < 2) continue;
      close(s.angle, smallestAngleOf(s.geometry.bonds), 1e-9);
      assert.ok(s.angle > 0 && s.angle <= 180.0001, `AX${b}E${l} gave ${s.angle}°`);
    }
  });

  it("never reports a negative compression, or one bigger than the ideal angle", () => {
    for (const [b, l] of REACHABLE) {
      const s = solveVsepr(b, l);
      assert.ok(s.compression >= 0, `AX${b}E${l} compression ${s.compression}`);
      assert.ok(s.compression <= s.ideal, `AX${b}E${l} closed past zero`);
      if (l === 0) close(s.compression, 0, 1e-6);
    }
  });

  it("has no bond angle at all for a diatomic", () => {
    for (let l = 0; l <= 3; l += 1) {
      const s = solveVsepr(1, l);
      assert.equal(s.hasAngle, false);
      assert.equal(s.angle, 0);
      assert.equal(s.compression, 0);
      // "The repulsions cancelled" is the wrong thing to say about a molecule
      // that has no angle to close in the first place.
      assert.equal(s.cancels, false);
      assert.match(s.shape, /Linear \(diatomic\)/);
    }
  });
});

describe("polarity", () => {
  it("agrees with the shape table on every reachable combination", () => {
    for (const [b, l] of REACHABLE) {
      const s = solveVsepr(b, l);
      assert.equal(s.polar, SHAPES[`${b}-${l}`].polar, `AX${b}E${l} polarity disagrees`);
      assert.equal(s.symmetric, !s.polar);
    }
  });

  it("calls the cancelling shapes non-polar", () => {
    assert.equal(solveVsepr(4, 2).polar, false, "XeF₄ is non-polar");
    assert.equal(solveVsepr(2, 3).polar, false, "XeF₂ is non-polar");
    assert.equal(solveVsepr(4, 0).polar, false, "CH₄ is non-polar");
    assert.equal(solveVsepr(2, 2).polar, true, "water is polar");
    assert.equal(solveVsepr(3, 1).polar, true, "ammonia is polar");
  });
});

describe("solveVsepr — what the readout prints", () => {
  it("writes the AXₙEₘ notation from the counts", () => {
    assert.equal(solveVsepr(4, 0).notation, "AX4");
    assert.equal(solveVsepr(2, 2).notation, "AX2E2");
    assert.equal(solveVsepr(4, 2).notation, "AX4E2");
  });

  it("clamps sliders to a steric number the model can draw", () => {
    const over = solveVsepr(6, 3);
    assert.ok(over.steric <= 6);
    assert.equal(over.bonding + over.lone, over.steric);
    assert.equal(solveVsepr(0, 0).bonding, 1);
    assert.equal(solveVsepr(99, 99).bonding, 6);
    assert.equal(solveVsepr(undefined, undefined).bonding, 1);
  });

  it("returns a complete record for every reachable combination", () => {
    for (const [b, l] of REACHABLE) {
      const s = solveVsepr(b, l);
      assert.equal(s.bonding, b);
      assert.equal(s.lone, l);
      assert.equal(s.steric, Math.max(2, b + l));
      assert.equal(s.electronGeometry, ELECTRON_GEOMETRY[s.steric]);
      assert.equal(s.ideal, IDEAL_ANGLE[s.steric]);
      assert.equal(s.idealLabel, IDEAL_ANGLE_LABEL[s.steric]);
      assert.equal(typeof s.polar, "boolean");
      assert.ok(Number.isFinite(s.angle));
      assert.ok(Number.isFinite(s.compression));
    }
  });
});

describe("real molecules draw their measured angles", () => {
  const measured = (id) => {
    const m = MOLECULES.find((x) => x.id === id);
    return solveVsepr(m.bonding, m.lone, id);
  };

  it("hits each bent or pyramidal molecule's single angle", () => {
    for (const m of MOLECULES.filter((x) => x.angle)) close(measured(m.id).angle, m.angle, 0.01);
  });

  it("knows H₂S and PH₃ close far more than 2.5° a lone pair would", () => {
    close(measured("H2S").angle, 92.1, 0.01);
    close(measured("PH3").angle, 93.5, 0.01);
  });

  it("gives the seesaw all three of SF₄'s angles", () => {
    const [axEq, eqEq, axAx] = measured("SF4").angles;
    close(axEq, 87.8, 0.1);
    close(eqEq, 101.6, 0.01);
    close(axAx, 173.1, 0.01);
  });

  it("bends ClF₃'s and BrF₅'s bonds away from their lone pairs", () => {
    assert.deepEqual(measured("ClF3").angles.map((a) => +a.toFixed(1)), [87.5, 175]);
    assert.deepEqual(measured("BrF5").angles.slice(0, 2).map((a) => +a.toFixed(1)), [84.8, 89.5]);
  });

  it("keeps lone-pair-free and cancelling shapes exactly ideal", () => {
    close(measured("CCl4").angle, 109.47, 0.01);
    assert.deepEqual(measured("PCl5").angles.map((a) => +a.toFixed(1)), [90, 120]);
    close(measured("SF6").angle, 90, 1e-6);
    close(measured("XeF4").angle, 90, 1e-6);
    close(measured("CO2").angle, 180, 1e-6);
  });

  it("keeps the example for every AXₙEₘ the first molecule listed", () => {
    for (const m of MOLECULES) assert.equal(solveVsepr(m.bonding, m.lone).example, SHAPES[`${m.bonding}-${m.lone}`].example);
  });

  it("ignores a preset that does not fit the counts", () => {
    assert.equal(solveVsepr(2, 2, "NH3").example, "H₂O");
  });
});

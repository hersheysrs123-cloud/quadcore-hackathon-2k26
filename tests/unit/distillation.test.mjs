import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COLUMN_TOP_C,
  FRACTIONS,
  HEAT_PER_LEVEL,
  RISE_THRESHOLD,
  atTheBase,
  furnaceTemperature,
  highestRiser,
  rises,
  risingCount,
  solveColumn,
} from "../../lib/distillation.js";

/** The heat slider, swept at the resolution the UI can actually produce. */
const SWEEP = Array.from({ length: 101 }, (_, i) => i / 100);

describe("the column", () => {
  it("lists the fractions top to bottom, coolest first", () => {
    for (let i = 1; i < FRACTIONS.length; i += 1) {
      assert.ok(
        FRACTIONS[i].top > FRACTIONS[i - 1].top,
        `${FRACTIONS[i].name} boils below ${FRACTIONS[i - 1].name} but is listed under it`,
      );
    }
  });

  it("starts at the condenser temperature and rises from there", () => {
    assert.equal(FRACTIONS[0].top, COLUMN_TOP_C);
  });

  it("gives every fraction a name, a use, a chain range and a colour", () => {
    for (const f of FRACTIONS) {
      assert.ok(f.key.length > 0);
      assert.ok(f.name.length > 0);
      assert.ok(f.use.length > 0);
      assert.match(f.chain, /^C/);
      assert.match(f.colour, /^#[0-9a-f]{6}$/i);
    }
  });

  it("gives each fraction a distinct colour, so the key can tell them apart", () => {
    const colours = FRACTIONS.map((f) => f.colour);
    assert.equal(new Set(colours).size, FRACTIONS.length);
  });

  it("has exactly one residue, and it is at the bottom", () => {
    const residues = FRACTIONS.filter((f) => f.residue);
    assert.equal(residues.length, 1);
    assert.equal(residues[0].key, "bitumen");
    assert.equal(FRACTIONS[FRACTIONS.length - 1].key, "bitumen");
  });
});

describe("furnace temperature", () => {
  it("runs from 250 °C to 450 °C across the slider", () => {
    assert.equal(furnaceTemperature(0), 250);
    assert.equal(furnaceTemperature(1), 450);
    assert.equal(furnaceTemperature(0.5), 350);
  });

  it("never decreases as the slider is pushed up, and clamps outside 0–1", () => {
    let last = -Infinity;
    for (const h of SWEEP) {
      const t = furnaceTemperature(h);
      assert.ok(t >= last, `furnace cooled going from below ${h}`);
      last = t;
    }
    assert.equal(furnaceTemperature(-3), 250);
    assert.equal(furnaceTemperature(9), 450);
  });

  it("is always hotter than the top of the column", () => {
    for (const h of SWEEP) assert.ok(furnaceTemperature(h) > COLUMN_TOP_C);
  });
});

describe("which fractions rise", () => {
  // The regression: bitumen is a residue — it is drained off, not condensed
  // out — but the old predicate had no residue branch, so at full heat the
  // scene floated it to the top of the column.
  it("never lets the residue rise, at ANY heat", () => {
    const bitumen = FRACTIONS.findIndex((f) => f.residue);
    for (const h of SWEEP) {
      assert.equal(rises(h, bitumen), false, `bitumen rose at heat ${h}`);
    }
    for (const h of SWEEP) {
      assert.ok(
        atTheBase(h).some((f) => f.residue),
        `the residue left the base at heat ${h}`,
      );
      assert.notEqual(highestRiser(h)?.key, "bitumen");
    }
  });

  it("rises from the top down — a fraction never rises unless the one above it does", () => {
    for (const h of SWEEP) {
      let seenGround = false;
      FRACTIONS.forEach((f, i) => {
        if (!rises(h, i)) seenGround = true;
        else assert.ok(!seenGround, `${f.name} rose at heat ${h} while a lighter fraction did not`);
      });
    }
  });

  it("is monotonic in heat: more heat never sends fewer fractions up", () => {
    let last = -1;
    for (const h of SWEEP) {
      const n = risingCount(h);
      assert.ok(n >= last, `raising the heat to ${h} dropped the riser count`);
      last = n;
    }
  });

  it("sends nothing up at zero heat, and everything but the residue at full", () => {
    assert.equal(risingCount(0), 0);
    assert.equal(highestRiser(0), null);
    assert.equal(risingCount(1), FRACTIONS.length - 1);
  });

  it("uses one threshold for both the count and the predicate", () => {
    for (const h of SWEEP) {
      assert.equal(risingCount(h), FRACTIONS.filter((_, i) => rises(h, i)).length);
      assert.equal(risingCount(h) + atTheBase(h).length, FRACTIONS.length);
    }
  });

  it("puts each fraction's threshold one HEAT_PER_LEVEL above the last", () => {
    FRACTIONS.forEach((f, i) => {
      if (f.residue) return;
      const threshold = i * HEAT_PER_LEVEL + RISE_THRESHOLD;
      assert.equal(rises(threshold - 1e-9, i), false, `${f.name} rose below its threshold`);
      assert.equal(rises(threshold + 1e-9, i), true, `${f.name} failed to rise above its threshold`);
    });
  });
});

describe("solveColumn — what the readout prints", () => {
  it("agrees with the predicate for every fraction, at every heat", () => {
    for (const h of SWEEP) {
      const s = solveColumn(h);
      s.fractions.forEach((f, i) => {
        assert.equal(f.rises, rises(h, i), `${f.name} disagrees at heat ${h}`);
        assert.equal(f.index, i);
      });
      assert.equal(s.rising, risingCount(h));
      assert.equal(s.total, FRACTIONS.length);
      assert.equal(s.furnaceC, furnaceTemperature(h));
      assert.deepEqual(s.highest, highestRiser(h));
    }
  });

  it("always names the residue, so the base of the column is never empty", () => {
    for (const h of SWEEP) {
      const s = solveColumn(h);
      assert.ok(s.residue, `no residue reported at heat ${h}`);
      assert.equal(s.residue.key, "bitumen");
      assert.equal(s.fractions.find((f) => f.key === "bitumen").rises, false);
    }
  });

  it("clamps a slider that has gone out of range", () => {
    assert.equal(solveColumn(-1).heat, 0);
    assert.equal(solveColumn(4).heat, 1);
    assert.equal(solveColumn(undefined).heat, 0);
    assert.equal(solveColumn(NaN).heat, 0);
  });

  it("calls the column too cool only while two or fewer fractions have risen", () => {
    for (const h of SWEEP) {
      const s = solveColumn(h);
      assert.equal(s.tooCool, s.rising <= 2);
    }
  });
});

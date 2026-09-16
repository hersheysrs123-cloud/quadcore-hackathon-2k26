import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DIPLOID_2N,
  HAPLOID_N,
  MAX_CHIASMATA,
  MEIOSIS_CYCLE,
  MITOSIS_CYCLE,
  POSE_CHANNELS,
  arrestIndexFor,
  census,
  chiasmaPlan,
  chromatids,
  colchicineApplied,
  describeDivision,
  diversity,
  divisionPose,
  holdPose,
  isRecombinant,
  originAt,
  poseDistance,
} from "../../lib/cellDivision.js";

describe("Stages", () => {
  it("mitosis is one division of six stages; meiosis is two divisions of eleven", () => {
    assert.equal(MITOSIS_CYCLE.stages.length, 6);
    assert.equal(MEIOSIS_CYCLE.stages.length, 11);
    assert.deepEqual(
      MITOSIS_CYCLE.stages.map((s) => s.phase),
      ["interphase", "prophase", "metaphase", "anaphase", "telophase", "cytokinesis"],
    );
    assert.deepEqual(MEIOSIS_CYCLE.stages.map((s) => s.division), [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2]);
    assert.equal(MEIOSIS_CYCLE.byKey.prophase2.phase, "prophase");
  });

  it("colchicine arrests at the first metaphase of either mode, and toggles with each press", () => {
    assert.equal(MITOSIS_CYCLE.stages[arrestIndexFor("mitosis")].key, "metaphase");
    assert.equal(MEIOSIS_CYCLE.stages[arrestIndexFor("meiosis")].key, "metaphase1");
    assert.equal(colchicineApplied(0), false);
    assert.equal(colchicineApplied(1), true);
    assert.equal(colchicineApplied(2), false);
  });
});

describe("Census — chromosomes vs chromatids", () => {
  it("counts 2n = 4 chromosomes and 8 chromatids from G2 to metaphase", () => {
    for (const key of ["interphase", "prophase", "metaphase"]) {
      const c = census("mitosis", key);
      assert.equal(c.cells, 1);
      assert.equal(c.perCell.chromosomes, DIPLOID_2N);
      assert.equal(c.perCell.chromatids, DIPLOID_2N * 2);
      assert.equal(c.chromatidsPerChromosome, 2);
    }
  });

  it("mitosis doubles the chromosome count at anaphase and ends with two identical 2n cells", () => {
    const ana = census("mitosis", "anaphase");
    assert.equal(ana.separating, "sister chromatids");
    assert.equal(ana.perCell.chromosomes, DIPLOID_2N * 2, "each chromatid is now a chromosome");
    assert.equal(ana.chromatidsPerChromosome, 1);
    const end = census("mitosis", "cytokinesis");
    assert.equal(end.cells, 2);
    assert.equal(end.ploidy, "2n");
    assert.equal(end.perCell.chromosomes, DIPLOID_2N);
    assert.equal(end.perCell.chromatids, DIPLOID_2N);
  });

  it("meiosis I separates homologues (sisters stay joined) and halves the number", () => {
    const meta = census("meiosis", "metaphase1");
    assert.equal(meta.perCell.bivalents, HAPLOID_N);
    const ana = census("meiosis", "anaphase1");
    assert.equal(ana.separating, "homologous chromosomes");
    assert.equal(ana.chromatidsPerChromosome, 2, "sister chromatids are still joined after anaphase I");
    const after = census("meiosis", "cytokinesis1");
    assert.equal(after.cells, 2);
    assert.equal(after.ploidy, "n");
    assert.equal(after.perCell.chromosomes, HAPLOID_N);
    assert.equal(after.perCell.chromatids, HAPLOID_N * 2);
  });

  it("meiosis II finally separates sisters and yields four haploid gametes", () => {
    const ana = census("meiosis", "anaphase2");
    assert.equal(ana.separating, "sister chromatids");
    assert.equal(ana.cells, 2);
    const end = census("meiosis", "cytokinesis2");
    assert.equal(end.cells, 4);
    assert.equal(end.perCell.chromosomes, HAPLOID_N);
    assert.equal(end.perCell.chromatids, HAPLOID_N);
    assert.equal(end.chromatidsPerChromosome, 1);
  });

  it("accepts a stage index as well as a key", () => {
    assert.deepEqual(census("meiosis", 10), census("meiosis", "cytokinesis2"));
  });
});

describe("Crossing over", () => {
  it("deals crossovers alternately to the two bivalents and never between sisters", () => {
    assert.equal(chiasmaPlan(0).length, 0);
    assert.equal(chiasmaPlan(9).length, MAX_CHIASMATA, "clamped to the slider's range");
    const plan = chiasmaPlan(4);
    assert.deepEqual(plan.map((x) => x.pair), [0, 1, 0, 1]);
    assert.deepEqual(plan.map((x) => x.arm), ["q", "q", "p", "p"]);
    for (const x of plan) assert.ok(x.u > 0 && x.u < 1);
  });

  it("swaps the segment distal to the chiasma between one maternal and one paternal chromatid", () => {
    const plan = chiasmaPlan(1);
    const mat = { pair: 0, parent: "maternal", which: 0 };
    const pat = { pair: 0, parent: "paternal", which: 0 };
    const sisterMat = { pair: 0, parent: "maternal", which: 1 };
    assert.equal(originAt(mat, 0.2, plan).parent, "maternal", "proximal to the chiasma: own parent");
    assert.equal(originAt(mat, 0.9, plan).parent, "paternal", "distal q arm now comes from the other parent");
    assert.equal(originAt(pat, 0.9, plan).parent, "maternal");
    assert.equal(originAt(mat, -0.9, plan).parent, "maternal", "the p arm is untouched");
    assert.equal(originAt(sisterMat, 0.9, plan).parent, "maternal", "the sister that did not take part is unchanged");
    assert.equal(originAt(mat, 0.9, plan, 0.4).blend, 0.4, "a partial reveal blends");
    assert.equal(isRecombinant(mat, plan), true);
    assert.equal(isRecombinant(sisterMat, plan), false);
  });

  it("four crossovers leave every one of the eight chromatids recombinant", () => {
    const plan = chiasmaPlan(4);
    const all = chromatids();
    assert.equal(all.length, 8);
    assert.ok(all.every((ch) => isRecombinant(ch, plan)));
    assert.ok(chromatids().every((ch) => !isRecombinant(ch, chiasmaPlan(0))));
  });
});

describe("Genetic diversity", () => {
  it("is nil for mitosis whatever the slider says", () => {
    const d = diversity("mitosis", 4);
    assert.equal(d.combinations, 1);
    assert.equal(d.percent, 0);
    assert.equal(d.recombinantChromatids, 0);
  });

  it("grows with crossovers on top of independent assortment", () => {
    assert.equal(diversity("meiosis", 0).combinations, 4, "2ⁿ from assortment alone");
    assert.equal(diversity("meiosis", 0).assortment, 4);
    assert.deepEqual([0, 1, 2, 3, 4].map((c) => diversity("meiosis", c).combinations), [4, 8, 16, 24, 36]);
    assert.equal(diversity("meiosis", 4).percent, 100);
    assert.equal(diversity("meiosis", 2).recombinantChromatids, 4);
    const pct = [0, 1, 2, 3, 4].map((c) => diversity("meiosis", c).percent);
    for (let i = 1; i < pct.length; i += 1) assert.ok(pct[i] > pct[i - 1], "monotonic");
  });
});

describe("The pose", () => {
  it("has every channel in 0–1 everywhere in both cycles", () => {
    for (const mode of ["mitosis", "meiosis"]) {
      const cycle = mode === "mitosis" ? MITOSIS_CYCLE : MEIOSIS_CYCLE;
      for (let t = 0; t < cycle.total; t += 0.05) {
        const p = divisionPose(mode, t);
        for (const k of [...POSE_CHANNELS, "crossover", "fade"]) assert.ok(p[k] >= -1e-9 && p[k] <= 1 + 1e-9, `${mode} ${k} at ${t.toFixed(2)} = ${p[k]}`);
      }
    }
  });

  it("parks every stage on a tableau visibly different from its neighbours", () => {
    for (const mode of ["mitosis", "meiosis"]) {
      const cycle = mode === "mitosis" ? MITOSIS_CYCLE : MEIOSIS_CYCLE;
      for (let i = 0; i < cycle.stages.length; i += 1) {
        const a = holdPose(mode, i);
        const b = holdPose(mode, (i + 1) % cycle.stages.length);
        assert.ok(poseDistance(a, b) >= 0.5, `${mode}: ${cycle.stages[i].short} → ${cycle.stages[(i + 1) % cycle.stages.length].short} differ by only ${poseDistance(a, b).toFixed(2)}`);
      }
    }
  });

  it("tells the textbook story: envelope down before the plate, plate before the pull, furrow last", () => {
    const inter = holdPose("mitosis", "interphase");
    const pro = holdPose("mitosis", "prophase");
    const meta = holdPose("mitosis", "metaphase");
    const ana = holdPose("mitosis", "anaphase");
    const telo = holdPose("mitosis", "telophase");
    const cyto = holdPose("mitosis", "cytokinesis");
    assert.equal(inter.envelope, 1);
    assert.equal(inter.condense, 0);
    assert.ok(pro.condense > 0.9 && pro.poles > 0.9 && pro.spindle > 0.5);
    assert.equal(meta.envelope, 0);
    assert.equal(meta.align, 1);
    assert.equal(meta.separate, 0);
    assert.ok(ana.separate > 0.5 && ana.separate < 1);
    assert.ok(telo.envelope > 0.5 && telo.spindle < 0.1 && telo.separate === 1);
    assert.ok(cyto.furrow > 0.95);
    assert.equal(cyto.cells, 2);
  });

  it("only meiosis I pairs homologues and shows chiasmata; the swapped colours persist into meiosis II", () => {
    assert.equal(holdPose("mitosis", "metaphase").pair, 0);
    assert.equal(holdPose("meiosis", "prophase1").pair, 1);
    assert.equal(holdPose("meiosis", "metaphase1").pair, 1);
    assert.ok(holdPose("meiosis", "metaphase1").chiasmaVisible === 1);
    assert.equal(holdPose("meiosis", "anaphase1").pair, 0);
    assert.equal(holdPose("meiosis", "metaphase2").pair, 0);
    assert.equal(holdPose("meiosis", "metaphase2").chiasmaVisible, 0);
    assert.equal(holdPose("meiosis", "metaphase2").crossover, 1, "the exchanged arms stay exchanged");
    assert.equal(holdPose("meiosis", "cytokinesis2").cells, 4);
  });

  it("crossfades over the wrap so daughters can become one cell again", () => {
    assert.ok(divisionPose("mitosis", 0.0).fade < 0.05);
    assert.ok(divisionPose("mitosis", MITOSIS_CYCLE.total - 0.01).fade < 0.1);
    assert.equal(divisionPose("mitosis", 5).fade, 1);
  });
});

describe("describeDivision", () => {
  it("bundles the stage, census, diversity and arrest state for the HUD", () => {
    const d = describeDivision({ mode: "meiosis", stage: 2, chiasmata: 3, colchicine: 1 });
    assert.equal(d.stage.key, "metaphase1");
    assert.equal(d.census.perCell.bivalents, 2);
    assert.equal(d.diversity.combinations, 24);
    assert.equal(d.plan.length, 3);
    assert.equal(d.colchicine.applied, true);
    assert.equal(d.colchicine.held, true, "parked on the arrest stage");
    assert.equal(describeDivision({ mode: "meiosis", stage: 5, colchicine: 1 }).colchicine.held, false);
    assert.equal(describeDivision({ mode: "mitosis", chiasmata: 4 }).plan.length, 0, "no chiasmata in mitosis");
  });
});

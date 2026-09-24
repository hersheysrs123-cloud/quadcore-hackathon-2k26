import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BASE_PENETRATION_MM_PER_DAY,
  COLOURLESS,
  COVER_SCALE_UM,
  ELECTROLYTES,
  E_SCALE_V,
  ION_APPEARANCE,
  IRON_DENSITY_G_PER_MM3,
  IRON_MOLAR_MASS,
  IRON_POTENTIAL_V,
  MAX_DAYS,
  METALS,
  MIN_DAYS,
  NAIL,
  NAIL_AREA_MM2,
  NAIL_MASS_G,
  PARTNERS,
  RUST_EQUATIONS,
  RUST_EXPANSION,
  RUST_MASS_RATIO,
  SERIES,
  SOLUTIONS,
  SOLUTION_MOL,
  SOLUTION_MOLARITY,
  SOLUTION_ORDER,
  SOLUTION_VOLUME_CM3,
  STRIP_MASS_G,
  TAU_REF_S,
  TUBES,
  WATER_POTENTIAL_V,
  WATER_TAU_S,
  balancedDisplacement,
  corrodeIron,
  dayLabel,
  describeOutcome,
  displacementOutcome,
  displacementProgress,
  electronsText,
  formatModelTime,
  hexToRgb,
  ionSymbol,
  mixHex,
  reactionTimeConstant,
  rgbToHex,
  saltFormula,
  seriesRank,
  solutionAppearance,
  solveCouple,
  solveDisplacement,
  solveReactivityRack,
  solveRusting,
} from "../../lib/redox.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

describe("Reactivity series — the ordering itself", () => {
  it("lists every metal in the series exactly once", () => {
    assert.equal(SERIES.length, 7);
    assert.equal(new Set(SERIES).size, 7);
    for (const symbol of SERIES) assert.ok(METALS[symbol], `${symbol} must be in METALS`);
    assert.equal(Object.keys(METALS).length, SERIES.length);
  });

  it("orders the series by electrode potential, most negative first", () => {
    for (let i = 1; i < SERIES.length; i += 1) {
      const above = METALS[SERIES[i - 1]].potential;
      const below = METALS[SERIES[i]].potential;
      assert.ok(above < below, `${SERIES[i - 1]} (${above} V) must be more reactive than ${SERIES[i]} (${below} V)`);
    }
  });

  it("gives seriesRank 0 to potassium and the last rank to gold", () => {
    assert.equal(seriesRank("K"), 0);
    assert.equal(seriesRank("Au"), SERIES.length - 1);
    assert.equal(seriesRank("Zn"), 2);
    assert.equal(seriesRank("nonsense"), -1);
  });

  it("quotes the syllabus electrode potentials", () => {
    assert.equal(METALS.Mg.potential, -2.37);
    assert.equal(METALS.Zn.potential, -0.76);
    assert.equal(METALS.Fe.potential, -0.44);
    assert.equal(METALS.Cu.potential, 0.34);
    assert.equal(METALS.Ag.potential, 0.8);
  });

  it("marks only potassium as attacking the water", () => {
    const attackers = SERIES.filter((s) => METALS[s].reactsWithWater);
    assert.deepEqual(attackers, ["K"]);
  });
});

describe("Ion and equation notation", () => {
  it("writes ion charges as superscripts", () => {
    assert.equal(ionSymbol("Ag", 1), "Ag⁺");
    assert.equal(ionSymbol("Cu", 2), "Cu²⁺");
    assert.equal(ionSymbol("Au", 3), "Au³⁺");
  });

  it("writes one electron without a coefficient", () => {
    assert.equal(electronsText(1), "e⁻");
    assert.equal(electronsText(2), "2e⁻");
    assert.equal(electronsText(3), "3e⁻");
  });

  it("builds the right salt formula for each metal charge and anion", () => {
    assert.equal(saltFormula("Cu", 2, "sulfate"), "CuSO₄");
    assert.equal(saltFormula("K", 1, "sulfate"), "K₂SO₄");
    assert.equal(saltFormula("Au", 3, "sulfate"), "Au₂(SO₄)₃");
    assert.equal(saltFormula("Ag", 1, "nitrate"), "AgNO₃");
    assert.equal(saltFormula("Cu", 2, "nitrate"), "Cu(NO₃)₂");
    assert.equal(saltFormula("Au", 3, "nitrate"), "Au(NO₃)₃");
  });

  it("balances Zn + CuSO₄ as the textbook does", () => {
    const eq = balancedDisplacement("Zn", "Cu", "sulfate");
    assert.equal(eq.electrons, 2);
    assert.equal(eq.oxidation, "Zn → Zn²⁺ + 2e⁻");
    assert.equal(eq.reduction, "Cu²⁺ + 2e⁻ → Cu");
    assert.equal(eq.ionic, "Zn + Cu²⁺ → Zn²⁺ + Cu");
    assert.equal(eq.molecular, "Zn + CuSO₄ → ZnSO₄ + Cu");
  });

  it("balances a 2:1 charge mismatch — Cu into silver nitrate", () => {
    const eq = balancedDisplacement("Cu", "Ag", "nitrate");
    assert.equal(eq.electrons, 2);
    assert.equal(eq.metalCoefficient, 1);
    assert.equal(eq.ionCoefficient, 2);
    assert.equal(eq.ionic, "Cu + 2Ag⁺ → Cu²⁺ + 2Ag");
    assert.equal(eq.molecular, "Cu + 2AgNO₃ → Cu(NO₃)₂ + 2Ag");
  });

  it("doubles the equation rather than emitting a fractional salt coefficient", () => {
    // Mg (2+) into K₂SO₄ would give ½K₂SO₄ if not scaled.
    const eq = balancedDisplacement("K", "Cu", "sulfate");
    assert.equal(eq.molecular, "2K + CuSO₄ → K₂SO₄ + Cu");
    for (const metal of SERIES) {
      for (const ion of SERIES) {
        for (const anion of ["sulfate", "nitrate"]) {
          const m = balancedDisplacement(metal, ion, anion).molecular;
          assert.ok(!m.includes("."), `${metal}/${ion}/${anion} must have whole coefficients: ${m}`);
          assert.ok(!m.includes("0.5"), `${metal}/${ion}/${anion} must have whole coefficients: ${m}`);
        }
      }
    }
  });

  it("conserves atoms of every element in each ionic equation", () => {
    for (const metal of SERIES) {
      for (const ion of SERIES) {
        const eq = balancedDisplacement(metal, ion);
        // a·n = b·m — the electrons given up equal the electrons taken.
        assert.equal(eq.metalCoefficient * METALS[metal].charge, eq.ionCoefficient * METALS[ion].charge);
        assert.equal(eq.electrons, eq.metalCoefficient * METALS[metal].charge);
      }
    }
  });
});

describe("Which beaker reacts", () => {
  it("has a metal displace everything below it and nothing above it", () => {
    for (const metal of SERIES) {
      if (METALS[metal].reactsWithWater) continue;
      for (const key of SOLUTION_ORDER) {
        const ionMetal = SOLUTIONS[key].metal;
        const o = displacementOutcome(metal, key);
        if (metal === ionMetal) {
          assert.equal(o.reason, "same_metal");
          assert.equal(o.reacts, false);
        } else if (seriesRank(metal) < seriesRank(ionMetal)) {
          assert.equal(o.reason, "displaces", `${metal} should displace ${ionMetal}`);
          assert.ok(o.ecell > 0);
        } else {
          assert.equal(o.reason, "less_reactive", `${metal} should not displace ${ionMetal}`);
          assert.ok(o.ecell < 0);
        }
      }
    }
  });

  it("sends potassium to the water in every beaker, whatever is dissolved in it", () => {
    for (const key of SOLUTION_ORDER) {
      const o = displacementOutcome("K", key);
      assert.equal(o.reason, "reacts_with_water");
      assert.equal(o.reacts, true);
      assert.equal(o.tau, WATER_TAU_S);
      assert.equal(o.reduction, "2H₂O + 2e⁻ → H₂ + 2OH⁻");
      assert.ok(close(o.ecell, WATER_POTENTIAL_V - METALS.K.potential));
      assert.equal(o.depositMetal, null);
    }
  });

  it("gives the classroom results for the four textbook pairs", () => {
    assert.equal(displacementOutcome("Zn", "cuso4").reason, "displaces");
    assert.equal(displacementOutcome("Cu", "feso4").reason, "less_reactive");
    assert.equal(displacementOutcome("Cu", "agno3").reason, "displaces");
    assert.equal(displacementOutcome("Au", "agno3").reason, "less_reactive");
  });

  it("leaves magnesium sulfate untouched by everything except potassium", () => {
    for (const metal of SERIES) {
      const o = displacementOutcome(metal, "mgso4");
      assert.notEqual(o.reason, "displaces", `${metal} must not displace Mg²⁺`);
    }
  });

  it("computes E°cell as the cathode potential minus the anode's", () => {
    const o = displacementOutcome("Zn", "cuso4");
    assert.ok(close(o.ecell, METALS.Cu.potential - METALS.Zn.potential));
    assert.ok(close(o.ecell, 1.1));
  });
});

describe("Displacement rate", () => {
  it("makes a bigger cell voltage mean a shorter time constant", () => {
    const mg = displacementOutcome("Mg", "cuso4");
    const zn = displacementOutcome("Zn", "cuso4");
    const fe = displacementOutcome("Fe", "cuso4");
    assert.ok(mg.ecell > zn.ecell && zn.ecell > fe.ecell);
    assert.ok(mg.tau < zn.tau && zn.tau < fe.tau);
  });

  it("uses τ = TAU_REF·exp(−E°cell/E_SCALE)", () => {
    assert.ok(close(reactionTimeConstant(0), TAU_REF_S));
    assert.ok(close(reactionTimeConstant(E_SCALE_V), TAU_REF_S / Math.E, 1e-9));
    assert.ok(close(reactionTimeConstant(1.1), TAU_REF_S * Math.exp(-1.1)));
  });

  it("reaches 63% of the way after one time constant", () => {
    assert.ok(close(displacementProgress(0, 100), 0));
    assert.ok(close(displacementProgress(100, 100), 1 - 1 / Math.E, 1e-12));
    assert.ok(displacementProgress(5000, 100) > 0.999);
  });

  it("never lets progress leave [0, 1], and saturates there", () => {
    let previous = -1;
    for (const t of [0, 1, 10, 100, 1e4, 1e6]) {
      const p = displacementProgress(t, 300);
      assert.ok(p >= 0 && p <= 1, `progress left the range at t=${t}`);
      assert.ok(p >= previous);
      previous = p;
    }
    assert.equal(displacementProgress(1e6, 300), 1, "an unreachably long wait saturates rather than overshooting");
    assert.equal(displacementProgress(-5, 300), 0);
  });
});

describe("Colour of the solution", () => {
  it("round-trips hex through rgb", () => {
    for (const hex of ["#000000", "#ffffff", "#1e8fe0", "#a3d18c"]) {
      assert.equal(rgbToHex(hexToRgb(hex)), hex);
    }
    assert.equal(rgbToHex(hexToRgb("#abc")), "#aabbcc");
  });

  it("mixes endpoints exactly and clamps beyond them", () => {
    assert.equal(mixHex("#000000", "#ffffff", 0), "#000000");
    assert.equal(mixHex("#000000", "#ffffff", 1), "#ffffff");
    assert.equal(mixHex("#000000", "#ffffff", 0.5), "#808080");
    assert.equal(mixHex("#000000", "#ffffff", -3), "#000000");
    assert.equal(mixHex("#000000", "#ffffff", 9), "#ffffff");
  });

  it("starts a beaker at its own ion's appearance", () => {
    const a = solutionAppearance(0, "Cu", "Zn", 1);
    assert.equal(a.colour, ION_APPEARANCE.Cu.colour);
    assert.ok(close(a.opacity, ION_APPEARANCE.Cu.opacity));
  });

  it("fades blue toward colourless as zinc displaces copper", () => {
    const start = solutionAppearance(0, "Cu", "Zn", 1);
    const mid = solutionAppearance(0.5, "Cu", "Zn", 1);
    const end = solutionAppearance(1, "Cu", "Zn", 1);
    assert.ok(mid.opacity < start.opacity);
    assert.ok(end.opacity < mid.opacity);
    assert.ok(close(end.opacity, COLOURLESS.opacity, 1e-9));
  });

  it("brings blue UP as copper dissolves into silver nitrate", () => {
    const start = solutionAppearance(0, "Ag", "Cu", 0.5);
    const end = solutionAppearance(1, "Ag", "Cu", 0.5);
    assert.ok(end.opacity > start.opacity, "the solution should gain colour, not lose it");
    assert.notEqual(end.colour, start.colour);
  });

  it("never goes below the colourless floor or above the cap", () => {
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      for (const [ion, product] of [["Cu", "Zn"], ["Fe", "Mg"], ["Ag", "Cu"], ["Mg", null]]) {
        const a = solutionAppearance(p, ion, product, 1);
        assert.ok(a.opacity >= COLOURLESS.opacity - 1e-12 && a.opacity <= 0.6 + 1e-12);
      }
    }
  });
});

describe("solveDisplacement", () => {
  it("conserves electrons between the strip and the solution", () => {
    for (const metal of ["Mg", "Zn", "Fe", "Cu"]) {
      for (const key of SOLUTION_ORDER) {
        const r = solveDisplacement({ metal, solution: key, seconds: 400 });
        if (r.reason !== "displaces") continue;
        const ionsConsumed = SOLUTION_MOL - r.ionsRemainingMol;
        // electrons gained by the ions === electrons given up by the strip
        assert.ok(close(r.electronsMol, ionsConsumed * METALS[r.ionMetal].charge, 1e-12));
        assert.ok(close(r.metalLostG, (r.electronsMol / METALS[metal].charge) * METALS[metal].molarMass, 1e-12));
      }
    }
  });

  it("deposits the mass of metal the ions carried away", () => {
    const r = solveDisplacement({ metal: "Zn", solution: "cuso4", seconds: 1e6 });
    assert.ok(close(r.depositG, SOLUTION_MOL * METALS.Cu.molarMass, 1e-9));
    assert.ok(close(r.metalLostG, SOLUTION_MOL * METALS.Zn.molarMass, 1e-9));
    assert.ok(r.complete);
  });

  it("does nothing at all in a beaker it cannot react with, however long", () => {
    const r = solveDisplacement({ metal: "Cu", solution: "feso4", seconds: 1e9 });
    assert.equal(r.progress, 0);
    assert.equal(r.depositG, 0);
    assert.equal(r.metalLostG, 0);
    assert.equal(r.ionsRemainingMol, SOLUTION_MOL);
    assert.equal(r.stripRemainingFraction, 1);
    assert.equal(r.depositColour, null);
    assert.equal(r.complete, false);
  });

  it("starts every beaker untouched at t = 0", () => {
    for (const metal of SERIES) {
      for (const key of SOLUTION_ORDER) {
        const r = solveDisplacement({ metal, solution: key, seconds: 0 });
        assert.equal(r.progress, 0);
        assert.equal(r.depositG, 0);
        assert.ok(close(r.stripRemainingFraction, 1));
      }
    }
  });

  it("eats the potassium strip rather than the solution", () => {
    const r = solveDisplacement({ metal: "K", solution: "cuso4", seconds: 1e5 });
    assert.equal(r.ionsRemainingMol, SOLUTION_MOL, "the Cu²⁺ is still there");
    assert.ok(r.stripRemainingFraction < 0.01, "the strip is gone");
    assert.ok(r.hydrogenCm3 > 0);
    // 2K + 2H₂O → 2KOH + H₂ — one H₂ per two potassium atoms.
    assert.ok(close(r.hydrogenMol, STRIP_MASS_G / METALS.K.molarMass / 2, 1e-9));
  });

  it("never lets the strip lose more than it has", () => {
    for (const metal of SERIES) {
      for (const key of SOLUTION_ORDER) {
        const r = solveDisplacement({ metal, solution: key, seconds: 1e7 });
        assert.ok(r.stripRemainingFraction >= 0, `${metal}/${key} strip went negative`);
        assert.ok(r.metalLostG <= STRIP_MASS_G + 1e-9);
      }
    }
  });

  it("is monotonic in time for every reacting pair", () => {
    for (const metal of ["Mg", "Zn", "Fe", "Cu"]) {
      for (const key of SOLUTION_ORDER) {
        let previous = -1;
        for (const t of [0, 10, 60, 300, 900, 3600]) {
          const r = solveDisplacement({ metal, solution: key, seconds: t });
          assert.ok(r.progress >= previous - 1e-12, `${metal}/${key} went backwards at t=${t}`);
          previous = r.progress;
        }
      }
    }
  });

  it("treats a negative or missing time as zero", () => {
    assert.equal(solveDisplacement({ metal: "Zn", solution: "cuso4", seconds: -50 }).progress, 0);
    assert.equal(solveDisplacement({}).progress, 0);
    assert.equal(solveDisplacement().metal, "Zn");
  });

  it("solves all four beakers at once for the rack", () => {
    const rack = solveReactivityRack({ metal: "Fe", seconds: 500 });
    assert.equal(rack.length, SOLUTION_ORDER.length);
    assert.deepEqual(rack.map((r) => r.solution), SOLUTION_ORDER);
    assert.deepEqual(rack.map((r) => r.reason), ["displaces", "same_metal", "displaces", "less_reactive"]);
  });

  it("has a sentence for every outcome", () => {
    for (const metal of SERIES) {
      for (const key of SOLUTION_ORDER) {
        const text = describeOutcome(solveDisplacement({ metal, solution: key, seconds: 1 }));
        assert.ok(typeof text === "string" && text.length > 20);
      }
    }
  });

  it("keeps the four beakers' concentrations consistent", () => {
    assert.ok(close(SOLUTION_MOL, (SOLUTION_VOLUME_CM3 / 1000) * SOLUTION_MOLARITY));
    assert.ok(close(SOLUTION_MOL, 0.02, 1e-12));
  });
});

describe("formatModelTime", () => {
  it("switches units at the thresholds", () => {
    assert.equal(formatModelTime(0), "0.0 s");
    assert.equal(formatModelTime(4.25), "4.3 s");
    assert.equal(formatModelTime(42), "42 s");
    assert.equal(formatModelTime(100), "1 min 40 s");
    assert.equal(formatModelTime(3600), "1 h 00 min");
    assert.equal(formatModelTime(7500), "2 h 05 min");
  });

  it("treats rubbish as zero", () => {
    assert.equal(formatModelTime(-9), "0.0 s");
    assert.equal(formatModelTime(undefined), "0.0 s");
    assert.equal(formatModelTime(NaN), "0.0 s");
  });
});

// ─── Rusting ────────────────────────────────────────────────────────

describe("Rusting — the nail and the rate", () => {
  it("derives the nail's mass and area from its dimensions", () => {
    const r = NAIL.diameterMm / 2;
    assert.ok(close(NAIL_AREA_MM2, Math.PI * NAIL.diameterMm * NAIL.lengthMm + 2 * Math.PI * r * r, 1e-9));
    assert.ok(close(NAIL_MASS_G, IRON_DENSITY_G_PER_MM3 * Math.PI * r * r * NAIL.lengthMm, 1e-12));
    // A 50 mm × 2.5 mm mild-steel nail is about two grams.
    assert.ok(NAIL_MASS_G > 1.5 && NAIL_MASS_G < 2.5);
  });

  it("uses the Fe₂O₃·H₂O mass ratio, about 1.59 g of rust per gram of iron", () => {
    assert.ok(close(RUST_MASS_RATIO, (2 * IRON_MOLAR_MASS + 3 * 16 + 18) / (2 * IRON_MOLAR_MASS), 1e-12));
    assert.ok(RUST_MASS_RATIO > 1.5 && RUST_MASS_RATIO < 1.7);
  });

  it("scales penetration linearly with days and with the rate factor", () => {
    const a = corrodeIron(10, 1);
    const b = corrodeIron(20, 1);
    const c = corrodeIron(10, 2);
    assert.ok(close(b.penetrationMm, 2 * a.penetrationMm, 1e-12));
    assert.ok(close(c.penetrationMm, 2 * a.penetrationMm, 1e-12));
    assert.ok(close(a.penetrationMm, BASE_PENETRATION_MM_PER_DAY * 10, 1e-12));
  });

  it("draws rust thicker than the iron it replaced", () => {
    const r = corrodeIron(30, 1);
    assert.ok(close(r.rustThicknessUm, r.penetrationMm * 1000 * RUST_EXPANSION, 1e-9));
    assert.ok(RUST_EXPANSION > 1);
  });

  it("approaches full coverage without reaching it", () => {
    assert.equal(corrodeIron(0, 1).coverage, 0);
    const early = corrodeIron(1, 1).coverage;
    const late = corrodeIron(30, 3.5).coverage;
    assert.ok(early > 0 && early < late && late < 1);
    // One COVER_SCALE_UM of surface loss is 63% covered.
    const days = COVER_SCALE_UM / 1000 / BASE_PENETRATION_MM_PER_DAY;
    assert.ok(close(corrodeIron(days, 1).coverage, 1 - 1 / Math.E, 1e-9));
  });

  it("makes rust mass follow the iron lost", () => {
    const r = corrodeIron(30, 3.5);
    assert.ok(close(r.rustFormedMg, r.ironLostMg * RUST_MASS_RATIO, 1e-9));
    assert.ok(close(r.electronsMol, (r.ironLostMg / 1000 / IRON_MOLAR_MASS) * 2, 1e-15));
  });

  it("gives nothing at all when the rate factor is zero", () => {
    const r = corrodeIron(30, 0);
    assert.equal(r.penetrationMm, 0);
    assert.equal(r.rustThicknessUm, 0);
    assert.equal(r.coverage, 0);
    assert.equal(r.ironLostMg, 0);
    assert.equal(r.rustFormedMg, 0);
  });

  it("clamps the day count to the slider's range", () => {
    assert.deepEqual(corrodeIron(99, 1), corrodeIron(MAX_DAYS, 1));
    assert.deepEqual(corrodeIron(-5, 1), corrodeIron(0, 1));
  });
});

describe("The four tubes", () => {
  it("lists the four conditions with the right two variables removed", () => {
    assert.equal(TUBES.length, 4);
    const byKey = Object.fromEntries(TUBES.map((t) => [t.key, t]));
    assert.ok(byKey.open.o2 && byKey.open.h2o);
    assert.ok(!byKey.deoxygenated.o2 && byKey.deoxygenated.h2o);
    assert.ok(byKey.dry.o2 && !byKey.dry.h2o);
    assert.ok(byKey.coupled.o2 && byKey.coupled.h2o);
  });

  it("rusts only where water and oxygen are both present", () => {
    const r = solveRusting({ days: MAX_DAYS, electrolyte: "saltwater", partner: "zinc" });
    const [open, deox, dry, coupled] = r.tubes;
    assert.ok(open.rustThicknessUm > 0);
    assert.equal(deox.rustThicknessUm, 0);
    assert.equal(dry.rustThicknessUm, 0);
    assert.equal(deox.coverage, 0);
    assert.equal(dry.coverage, 0);
    assert.ok(coupled.rustThicknessUm > 0 && coupled.rustThicknessUm < open.rustThicknessUm);
  });

  it("keeps tubes 2 and 3 clean at every day and every setting", () => {
    for (const days of [1, 7, 15, 30]) {
      for (const electrolyte of Object.keys(ELECTROLYTES)) {
        for (const partner of Object.keys(PARTNERS)) {
          const r = solveRusting({ days, electrolyte, partner });
          assert.equal(r.tubes[1].ironLostMg, 0, "no oxygen, no rust");
          assert.equal(r.tubes[2].ironLostMg, 0, "no water, no rust");
        }
      }
    }
  });

  it("runs salt water several times faster than distilled", () => {
    const pure = solveRusting({ days: 30, electrolyte: "distilled", partner: "zinc" });
    const salt = solveRusting({ days: 30, electrolyte: "saltwater", partner: "zinc" });
    assert.ok(close(salt.tubes[0].ironLostMg / pure.tubes[0].ironLostMg, ELECTROLYTES.saltwater.factor, 1e-9));
    assert.ok(ELECTROLYTES.saltwater.factor > ELECTROLYTES.distilled.factor);
  });

  it("gives each tube a verdict that matches its numbers", () => {
    const r = solveRusting({ days: 20, electrolyte: "distilled", partner: "copper" });
    assert.match(r.tubes[1].verdict, /no oxygen/);
    assert.match(r.tubes[2].verdict, /no water/);
    assert.match(r.tubes[3].verdict, /accelerated/);
    assert.match(solveRusting({ days: 20, partner: "zinc" }).tubes[3].verdict, /protected/);
  });

  it("carries the overall equation the syllabus wants", () => {
    assert.match(RUST_EQUATIONS.overall, /Fe₂O₃·xH₂O/);
    assert.equal(RUST_EQUATIONS.oxidation, "Fe → Fe²⁺ + 2e⁻");
    assert.equal(RUST_EQUATIONS.reduction, "O₂ + 2H₂O + 4e⁻ → 4OH⁻");
  });

  it("defaults to a day inside the slider's range", () => {
    const r = solveRusting({});
    assert.ok(r.days >= MIN_DAYS && r.days <= MAX_DAYS);
    assert.equal(solveRusting({ days: 99 }).days, MAX_DAYS);
  });
});

describe("Sacrificial protection", () => {
  it("makes the more reactive metal the anode", () => {
    assert.equal(solveCouple({ partner: "zinc" }).anode, "Zn");
    assert.equal(solveCouple({ partner: "magnesium" }).anode, "Mg");
    assert.equal(solveCouple({ partner: "copper" }).anode, "Fe");
    assert.equal(solveCouple({ partner: "copper" }).cathode, "Cu");
  });

  it("sends electrons from the anode to the cathode", () => {
    assert.equal(solveCouple({ partner: "zinc" }).direction, "partner_to_iron");
    assert.equal(solveCouple({ partner: "magnesium" }).direction, "partner_to_iron");
    assert.equal(solveCouple({ partner: "copper" }).direction, "iron_to_partner");
  });

  it("protects with zinc and magnesium, and accelerates with copper", () => {
    const bare = solveRusting({ days: 30 }).tubes[0].ironLostMg;
    for (const partner of ["zinc", "magnesium"]) {
      const c = solveCouple({ days: 30, partner });
      assert.ok(c.protects);
      assert.ok(c.iron.ironLostMg < bare, `${partner} should reduce the nail's loss`);
    }
    const cu = solveCouple({ days: 30, partner: "copper" });
    assert.equal(cu.protects, false);
    assert.ok(cu.iron.ironLostMg > bare, "copper should make it worse");
  });

  it("has magnesium protect harder than zinc and be consumed faster", () => {
    const zn = solveCouple({ days: 30, electrolyte: "saltwater", partner: "zinc" });
    const mg = solveCouple({ days: 30, electrolyte: "saltwater", partner: "magnesium" });
    assert.ok(Math.abs(mg.deltaE) > Math.abs(zn.deltaE));
    assert.ok(mg.iron.ironLostMg < zn.iron.ironLostMg, "magnesium leaves less rust");
    assert.ok(mg.partnerRemainingFraction < zn.partnerRemainingFraction, "magnesium runs out first");
  });

  it("computes ΔE° from the two electrode potentials", () => {
    for (const [key, P] of Object.entries(PARTNERS)) {
      const c = solveCouple({ partner: key });
      assert.ok(close(c.deltaE, Math.abs(IRON_POTENTIAL_V - P.potential), 1e-12));
    }
    assert.equal(IRON_POTENTIAL_V, METALS.Fe.potential);
  });

  // B37: ΔE° is a cell potential, so it is a magnitude. It used to be the
  // signed difference under the label "Driving voltage", and every consumer
  // wrapped it in Math.abs -- which meant the sign was carried around and
  // never read. Polarity lives in `direction`, `anode` and `cathode`.
  it("reports ΔE° as a magnitude, with the polarity carried separately", () => {
    for (const key of Object.keys(PARTNERS)) {
      const c = solveCouple({ partner: key });
      assert.ok(c.deltaE >= 0, `${key} gave a negative driving voltage: ${c.deltaE}`);
      assert.ok(["partner_to_iron", "iron_to_partner"].includes(c.direction));
      assert.notEqual(c.anode, c.cathode);
    }
    // Copper sits below iron, so the nail is the anode and the couple still
    // has a real driving voltage -- it just drives the wrong way.
    const cu = solveCouple({ partner: "copper" });
    assert.ok(cu.deltaE > 0);
    assert.equal(cu.anode, "Fe");
  });

  it("never lets the wrap go past exhausted", () => {
    for (const partner of Object.keys(PARTNERS)) {
      for (const days of [0, 1, 15, 30]) {
        const c = solveCouple({ days, electrolyte: "saltwater", partner });
        assert.ok(c.partnerRemainingFraction >= 0 && c.partnerRemainingFraction <= 1);
      }
    }
    assert.equal(solveCouple({ days: 0, partner: "zinc" }).partnerRemainingFraction, 1);
  });

  it("never reports more anode lost than the ribbon weighed", () => {
    for (const partner of ["zinc", "magnesium"]) {
      const c = solveCouple({ days: 30, electrolyte: "saltwater", partner });
      assert.ok(c.partnerLostMg <= PARTNERS[partner].wrapMassG * 1000 + 1e-9, `${partner} lost more than it had`);
    }
  });

  it("uses magnesium up in salt water before day 30, then lets the nail rust at the bare rate", () => {
    const c = solveCouple({ days: 30, electrolyte: "saltwater", partner: "magnesium" });
    assert.ok(c.partnerExhausted);
    assert.ok(c.partnerLifetimeDays < 30);
    assert.equal(c.partnerRemainingFraction, 0);
    const before = solveCouple({ days: c.partnerLifetimeDays, electrolyte: "saltwater", partner: "magnesium" });
    const unprotected = 30 - c.partnerLifetimeDays;
    const bareTail = corrodeIron(unprotected, ELECTROLYTES.saltwater.factor);
    // The days after the anode went add exactly what a bare nail loses in them.
    assert.ok(close(c.iron.ironLostMg - before.iron.ironLostMg, bareTail.ironLostMg, 1e-6));
    assert.ok(c.iron.ironLostMg > before.iron.ironLostMg, "the nail starts losing iron again");
    assert.match(solveRusting({ days: 30, electrolyte: "saltwater", partner: "magnesium" }).tubes[3].verdict, /used up/);
    assert.equal(c.bubbleRate, 0, "no magnesium left, so no hydrogen");
  });

  it("keeps zinc protecting the whole month, even in salt water", () => {
    const c = solveCouple({ days: 30, electrolyte: "saltwater", partner: "zinc" });
    assert.equal(c.partnerExhausted, false);
    assert.ok(c.partnerLifetimeDays > 30);
    assert.ok(c.iron.ironLostMg < c.bare.ironLostMg * 0.05);
  });

  it("consumes nothing of a copper wrap — a cathode does not corrode", () => {
    const c = solveCouple({ days: 30, electrolyte: "saltwater", partner: "copper" });
    assert.equal(c.partnerLostMg, 0);
    assert.equal(c.partnerRemainingFraction, 1);
  });

  it("writes the anode's half-equation, not iron's, when the partner protects", () => {
    assert.equal(solveCouple({ partner: "zinc" }).oxidation, "Zn → Zn²⁺ + 2e⁻");
    assert.equal(solveCouple({ partner: "magnesium" }).oxidation, "Mg → Mg²⁺ + 2e⁻");
    assert.equal(solveCouple({ partner: "copper" }).oxidation, RUST_EQUATIONS.oxidation);
    for (const partner of Object.keys(PARTNERS)) {
      assert.equal(solveCouple({ partner }).reduction, RUST_EQUATIONS.reduction);
    }
  });

  it("ranks the three partners the same way in the alternatives table", () => {
    const { alternatives } = solveRusting({ days: 30, electrolyte: "saltwater", partner: "zinc" });
    assert.ok(alternatives.magnesium < alternatives.zinc);
    assert.ok(alternatives.zinc < alternatives.copper);
  });

  it("falls back to sane defaults for an unknown partner or electrolyte", () => {
    const bad = solveRusting({ days: 10, electrolyte: "lemonade", partner: "unobtanium" });
    const good = solveRusting({ days: 10, electrolyte: "distilled", partner: "zinc" });
    assert.equal(bad.electrolyte.key, "distilled");
    assert.equal(bad.couple.partner.key, "zinc");
    assert.ok(close(bad.tubes[0].ironLostMg, good.tubes[0].ironLostMg, 1e-12));
  });
});

describe("Labels", () => {
  it("names the day", () => {
    assert.equal(dayLabel(1), "day 1");
    assert.equal(dayLabel(12.4), "day 12");
    assert.equal(dayLabel(undefined), `day ${MIN_DAYS}`);
  });
});

describe("a used-up sacrificial anode", () => {
  const spent = solveCouple({ days: 90, electrolyte: "saltwater", partner: "magnesium" });

  it("is actually used up by day 90 in salt water", () => {
    assert.equal(spent.partnerExhausted, true);
  });

  it("stops the electron flow and hands the anode back to the iron", () => {
    assert.equal(spent.direction, "none");
    assert.equal(spent.anode, "Fe");
    assert.equal(spent.oxidation, "Fe → Fe²⁺ + 2e⁻");
  });

  it("still names the partner as anode while any of it is left", () => {
    const fresh = solveCouple({ days: 1, electrolyte: "saltwater", partner: "magnesium" });
    assert.equal(fresh.partnerExhausted, false);
    assert.equal(fresh.anode, "Mg");
    assert.equal(fresh.direction, "partner_to_iron");
  });
});

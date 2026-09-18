import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BONDS_FORM_ABOVE,
  DENATURED_BELOW,
  DENATURE_END,
  DENATURE_START,
  STRUCTURE_COLOURS,
  foldedFraction,
  heatFactor,
  solveFolding,
} from "../../lib/proteinFolding.js";

const STRUCTURES = ["helix", "sheet", "coil"];
const FOLDS = [0, 0.2, 0.35, 0.5, 0.74, 0.9, 1];
const TEMPS = [280, 300, 320, 330, 340, 358, 380];

const sweep = (fn) => {
  for (const structure of STRUCTURES) {
    for (const fold of FOLDS) {
      for (const temperature of TEMPS) fn({ structure, fold, temperature, residues: 30 });
    }
  }
};

describe("the heat window", () => {
  it("runs from 320 K to 358 K, folded below and random coil above", () => {
    assert.equal(DENATURE_START, 320);
    assert.equal(DENATURE_END, 358);
    assert.equal(heatFactor(300), 1);
    assert.equal(heatFactor(DENATURE_START), 1);
    assert.equal(heatFactor(DENATURE_END), 0);
    assert.equal(heatFactor(400), 0);
  });

  it("falls smoothly and monotonically across the window", () => {
    let last = Infinity;
    for (let t = 300; t <= 380; t += 0.5) {
      const h = heatFactor(t);
      assert.ok(h >= 0 && h <= 1, `heat factor ${h} at ${t} K`);
      assert.ok(h <= last + 1e-12, `the fold recovered on heating at ${t} K`);
      last = h;
    }
  });

  it("is linear through the window", () => {
    const mid = (DENATURE_START + DENATURE_END) / 2;
    assert.ok(Math.abs(heatFactor(mid) - 0.5) < 1e-12);
  });
});

describe("how folded the chain actually is", () => {
  // The regression: the panel printed the raw fold slider as "Folded Progress:
  // 100 %" over a chain the scene had half unravelled. The scene applies heat
  // as a WINDOW multiplying the slider, so the two numbers are not the same.
  it("is the slider scaled by the heat, not the slider alone", () => {
    sweep(({ structure, fold, temperature }) => {
      const s = solveFolding({ structure, fold, temperature });
      assert.equal(s.asked, fold);
      assert.equal(s.heatFactor, heatFactor(temperature));
      assert.ok(Math.abs(s.folded - fold * heatFactor(temperature)) < 1e-12);
      assert.equal(s.folded, foldedFraction(fold, temperature));
      assert.equal(s.foldedPercent, Math.round(s.folded * 100));
    });
  });

  it("reports less than the slider asked for once the chain is being heated", () => {
    const s = solveFolding({ fold: 1, temperature: 340 });
    assert.equal(s.asked, 1);
    assert.ok(s.folded < 1, "heat must cost the chain some of its fold");
    assert.ok(s.foldedPercent < 100);
  });

  // The regression: the panel used `temperature > 320 || fold < 0.35`, so a
  // fully-folded helix at 330 K — still 74 % folded with its i→i+4 bonds
  // intact — was called a random coil.
  it("does not call a 74 %-folded helix at 330 K denatured", () => {
    const s = solveFolding({ structure: "helix", fold: 1, temperature: 330 });
    assert.ok(Math.abs(s.folded - 0.7368) < 0.001, `folded ${s.folded}`);
    assert.equal(s.denatured, false);
    assert.equal(s.bondsFormed, true, "the i→i+4 hydrogen bonds are still there");
    assert.equal(s.heating, true, "it IS being heated — just not denatured yet");
  });

  it("stays a fraction across the whole control space", () => {
    sweep((controls) => {
      const s = solveFolding(controls);
      assert.ok(s.folded >= 0 && s.folded <= 1, `folded ${s.folded}`);
      assert.ok(s.foldedPercent >= 0 && s.foldedPercent <= 100);
      assert.ok(s.heatFactor >= 0 && s.heatFactor <= 1);
    });
  });

  it("clamps a fold slider that has gone out of range", () => {
    assert.equal(solveFolding({ fold: 5, temperature: 300 }).asked, 1);
    assert.equal(solveFolding({ fold: -5, temperature: 300 }).asked, 0);
    assert.equal(solveFolding({ fold: NaN, temperature: 300 }).asked, 0);
  });
});

describe("denaturation", () => {
  it("is decided on what the chain is at, not on what was asked for", () => {
    sweep((controls) => {
      const s = solveFolding(controls);
      assert.equal(s.denatured, s.folded < DENATURED_BELOW);
    });
  });

  it("is complete once the chain is past the top of the window", () => {
    const s = solveFolding({ fold: 1, temperature: DENATURE_END + 10 });
    assert.equal(s.folded, 0);
    assert.equal(s.denatured, true);
    assert.equal(s.fullyDenaturedByHeat, true);
    assert.equal(s.bondsFormed, false);
  });

  // The regression: the scene blamed heat for a COLD unfolding — dragging fold
  // to 0.2 at 300 K produced "Above about 47 °C the hydrogen bonds break".
  it("blames the slider, not the heat, for an unfolding at room temperature", () => {
    const s = solveFolding({ fold: 0.2, temperature: 300 });
    assert.equal(s.denatured, true);
    assert.equal(s.cause, "slider");
    assert.equal(s.heating, false);
    assert.equal(s.heatFactor, 1);
  });

  it("blames the heat when the slider alone would have left it folded", () => {
    const s = solveFolding({ fold: 1, temperature: 350 });
    assert.equal(s.denatured, true);
    assert.equal(s.cause, "heat");
    assert.ok(s.asked >= DENATURED_BELOW);
  });

  it("blames both when both contributed", () => {
    const s = solveFolding({ fold: 0.3, temperature: 340 });
    assert.equal(s.denatured, true);
    assert.equal(s.cause, "both");
  });

  it("blames nothing when the chain is not denatured", () => {
    const s = solveFolding({ fold: 1, temperature: 300 });
    assert.equal(s.denatured, false);
    assert.equal(s.cause, null);
  });

  it("always names a cause when it says the chain is denatured", () => {
    sweep((controls) => {
      const s = solveFolding(controls);
      if (s.denatured) assert.ok(["heat", "slider", "both"].includes(s.cause), `cause "${s.cause}"`);
      else assert.equal(s.cause, null);
    });
  });
});

describe("hydrogen bonds", () => {
  it("form only once the partners are in reach", () => {
    assert.equal(solveFolding({ structure: "helix", fold: 1, temperature: 300 }).bondsFormed, true);
    assert.equal(solveFolding({ structure: "helix", fold: 0.4, temperature: 300 }).bondsFormed, false);
    sweep((controls) => {
      const s = solveFolding(controls);
      const want = s.folded >= BONDS_FORM_ABOVE && controls.structure !== "coil";
      assert.equal(s.bondsFormed, want);
    });
  });

  it("never form in a random coil, however tight the slider", () => {
    for (const temperature of TEMPS) {
      const s = solveFolding({ structure: "coil", fold: 1, temperature });
      assert.equal(s.isCoil, true);
      assert.equal(s.bondsFormed, false);
    }
  });

  it("break as the chain is heated out of its fold", () => {
    const cool = solveFolding({ structure: "sheet", fold: 1, temperature: 300 });
    const hot = solveFolding({ structure: "sheet", fold: 1, temperature: 350 });
    assert.equal(cool.bondsFormed, true);
    assert.equal(hot.bondsFormed, false);
  });
});

describe("solveFolding — what the readout prints", () => {
  it("converts kelvin to celsius", () => {
    assert.equal(solveFolding({ temperature: 300 }).temperatureC, 27);
    assert.equal(solveFolding({ temperature: DENATURE_START }).temperatureC, 47);
  });

  it("clamps the residue count to what the scene can draw", () => {
    assert.equal(solveFolding({ residues: 2 }).residues, 8);
    assert.equal(solveFolding({ residues: 500 }).residues, 64);
    assert.equal(solveFolding({ residues: 30.4 }).residues, 30);
    assert.equal(solveFolding().residues, 30);
  });

  it("passes the structure through and flags the coil", () => {
    for (const structure of STRUCTURES) {
      const s = solveFolding({ structure });
      assert.equal(s.structure, structure);
      assert.equal(s.isCoil, structure === "coil");
    }
  });

  it("has usable defaults — a fully folded helix at room temperature", () => {
    const s = solveFolding();
    assert.equal(s.structure, "helix");
    assert.equal(s.folded, 1);
    assert.equal(s.foldedPercent, 100);
    assert.equal(s.denatured, false);
  });
});

describe("the colour key", () => {
  it("draws a denatured chain differently from a folded one", () => {
    assert.notEqual(STRUCTURE_COLOURS.denatured, STRUCTURE_COLOURS.helix);
    assert.notEqual(STRUCTURE_COLOURS.helix, STRUCTURE_COLOURS.sheet);
    assert.notEqual(STRUCTURE_COLOURS.hydrophobic, STRUCTURE_COLOURS.hydrophilic);
    for (const c of Object.values(STRUCTURE_COLOURS)) assert.match(c, /^#[0-9a-f]{6}$/i);
  });
});

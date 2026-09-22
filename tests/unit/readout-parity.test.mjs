// ─── Guardrail 5.2 — readout parity ─────────────────────────────────
// The Details panel and the scene must never be able to disagree.
//
// This is finding X1, the one that produced most of the report. The panel
// and the scene each carried their own arithmetic, so the panel could say
// 40 % and "Complementary Lock" over a scene that had collapsed the rate to
// 9 % and gaped the active site open. Phase 1 and 3 gave the eleven worst
// offenders a single engine in lib/ that both sides call.
//
// So parity is now two things, and this file checks both:
//
//   1. STRUCTURAL -- the HUD case and the scene both call the same solver,
//      and the HUD does not re-derive what the solver already returns. This
//      is what stops a second copy growing back.
//   2. TOTAL -- sweeping the control ranges that topics.js actually declares,
//      the solver returns a complete, finite answer at every reachable
//      combination. A readout that both sides derive is still wrong if it is
//      NaN at the end of a slider.
// ─────────────────────────────────────────────────────────────────────

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  componentClosure,
  parseHud,
  parseScenes,
  parseTopics,
  readSource,
} from "../helpers/source-registry.mjs";

import { describeAtom } from "../../lib/atomicStructure.js";
import { describeMolecule } from "../../lib/organic.js";
import { solveColumn } from "../../lib/distillation.js";
import { solveElectrolysis } from "../../lib/electrolysis.js";
import { solveVsepr } from "../../lib/vsepr.js";
import { solveEnergetics } from "../../lib/energetics.js";
import { solveEnzyme } from "../../lib/enzymes.js";
import { describeHelix } from "../../lib/dna.js";
import { solveOsmosis } from "../../lib/cellBiology.js";
import { solveFolding } from "../../lib/proteinFolding.js";
import { latticeFactsFor } from "../../lib/lattices.js";

const topics = parseTopics();
const scenes = parseScenes();
const hud = parseHud();
const topicFor = (id) => topics.find((t) => t.id === id);

/**
 * The eleven topics Phase 1 and 3 put behind a single engine.
 *
 * `solver` is the function both sides are meant to call; `also` lists the
 * other names from that module either side may legitimately use instead.
 */
const EXTRACTED = [
  { id: "bohr", solver: "describeAtom", also: ["ELEMENTS", "SHELL_CAPACITY", "ATOM_COLOURS"] },
  { id: "organic", solver: "describeMolecule", also: ["buildMolecule", "formulaFor", "nameFor", "crackProducts", "isCrackable", "FAMILIES", "ORGANIC_COLOURS"] },
  { id: "distillation", solver: "solveColumn", also: ["FRACTIONS", "rises", "risingCount"] },
  { id: "lattice", solver: "latticeFactsFor", also: ["LATTICE_FACTS", "LATTICE_KEYS", "BOND_COLOUR", "latticeKeyFor"] },
  { id: "electrolysis", solver: "solveElectrolysis", also: ["FARADAY", "COPPER", "CELL_COLOURS", "formatRunTime"] },
  { id: "vsepr", solver: "solveVsepr", also: ["vseprGeometry", "SHAPES", "DOMAIN_DIRECTIONS"] },
  { id: "energetics", solver: "solveEnergetics", also: ["boltzmannFraction", "floorEa"] },
  { id: "enzyme", solver: "solveEnzyme", also: ["enzymeRate", "DENATURE_TEMP", "ENZYME_COLOURS"] },
  { id: "dna", solver: "describeHelix", also: ["sequenceFor", "BASE_COLOURS", "PAIR_BONDS", "COMPLEMENT"] },
  { id: "cell", solver: "solveOsmosis", also: ["osmosisState", "ORGANELLES", "organellesIn"] },
  { id: "protein", solver: "solveFolding", also: ["heatFactor", "foldedFraction", "STRUCTURE_COLOURS"] },
];

/** Every value a slider can take, at the step the UI moves in. */
function sliderValues(spec, cap = 40) {
  const { min = 0, max = 1, step = (max - min) / 10 } = spec;
  const out = [];
  const count = Math.round((max - min) / step);
  const stride = Math.max(1, Math.ceil(count / cap));
  for (let i = 0; i <= count; i += stride) out.push(Number((min + i * step).toFixed(6)));
  if (out[out.length - 1] !== max) out.push(max);
  return out;
}

/** The cartesian product of a topic's declared controls. */
function grid(topicId, keys) {
  const specs = topicFor(topicId).controlSpecs.filter((c) => keys.includes(c.key));
  let combos = [{}];
  for (const spec of specs) {
    const values =
      spec.type === "slider" ? sliderValues(spec)
      : spec.type === "toggle" ? [false, true]
      : spec.options ?? [];
    if (values.length === 0) continue;
    combos = combos.flatMap((base) => values.map((v) => ({ ...base, [spec.key]: v })));
  }
  return combos;
}

/** Nothing a readout prints may be NaN, Infinity, undefined or "undefined". */
function assertTotal(result, label) {
  assert.ok(result !== null && result !== undefined, `${label}: solver returned ${result}`);
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "number") {
      assert.ok(Number.isFinite(value), `${label}: ${key} is ${value}`);
    } else if (typeof value === "string") {
      assert.ok(!value.includes("undefined"), `${label}: ${key} is "${value}"`);
      assert.ok(!value.includes("NaN"), `${label}: ${key} is "${value}"`);
    }
  }
}

// ─── 1. Structural parity ───────────────────────────────────────────

describe("the panel and the scene call the same engine", () => {
  for (const { id, solver, also } of EXTRACTED) {
    it(`${id} — both sides call ${solver}()`, () => {
      assert.ok(hud.has(id), `${id} has no HUD case`);
      assert.ok(scenes.has(id), `${id} has no scene`);

      const names = [solver, ...also];
      const hudBody = hud.get(id).body;
      const scene = scenes.get(id);
      const sceneBody =
        componentClosure(scene.defining, scene.component).bodies.join("\n") +
        readSource(scene.defining);

      const hudUses = names.filter((n) => new RegExp(`\\b${n}\\b`).test(hudBody));
      const sceneUses = names.filter((n) => new RegExp(`\\b${n}\\b`).test(sceneBody));

      assert.ok(
        hudUses.length > 0,
        `${id}: the Details panel does not call ${solver}() or anything else from its module — ` +
          `it is deriving its own numbers again.`,
      );
      assert.ok(
        sceneUses.length > 0,
        `${id}: the scene does not call ${solver}() or anything else from its module — ` +
          `it is drawing from its own numbers again.`,
      );
    });
  }
});

describe("the panel does not re-derive what the engine returns", () => {
  // The specific arithmetic each panel used to carry. Finding any of it back
  // in the HUD means a second copy has started growing.
  const FORBIDDEN = [
    { id: "enzyme", pattern: /Math\.exp\([^)]*temperature/i, what: "its own Gaussian rate model" },
    { id: "energetics", pattern: /Math\.exp\(\s*\(?-\s*\w+\s*\*\s*1000/, what: "its own Boltzmann factor" },
    { id: "electrolysis", pattern: /\b96485\b/, what: "a hard-coded Faraday constant" },
    { id: "protein", pattern: /temperature\s*>\s*320|\b358\b/, what: "its own denaturation window" },
    { id: "cell", pattern: /tonicity\s*[<>]\s*0\.05/, what: "its own osmosis thresholds" },
    { id: "vsepr", pattern: /lone\s*\*\s*2\.5/, what: "the flat lone-pair squeeze that ignored cancellation" },
  ];

  // Comments are stripped first. Several of these cases carry a note naming
  // the formula they used to duplicate, which is exactly the documentation
  // that should survive -- it is the code that must not come back.
  const codeOf = (src) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  for (const { id, pattern, what } of FORBIDDEN) {
    it(`${id} does not carry ${what}`, () => {
      assert.ok(
        !pattern.test(codeOf(hud.get(id).body)),
        `${id}: the Details panel has grown ${what} back. It belongs in lib/, where the scene ` +
          `can read the same copy.`,
      );
    });
  }
});

// ─── 2. Total over the declared control ranges ──────────────────────

describe("the engine answers everywhere the controls can reach", () => {
  it("bohr", () => {
    for (const symbol of ["H", "C", "Na", "Cl"]) assertTotal(describeAtom(symbol), `bohr ${symbol}`);
  });

  it("organic", () => {
    for (const c of grid("organic", ["family", "carbons"])) {
      assertTotal(describeMolecule(c.family, c.carbons), `organic ${JSON.stringify(c)}`);
    }
  });

  it("distillation", () => {
    for (const c of grid("distillation", ["heat"])) {
      assertTotal(solveColumn(c.heat), `distillation ${JSON.stringify(c)}`);
    }
  });

  it("lattice", () => {
    for (const key of ["nacl", "diamond", "graphite", "quartz", "ice"]) {
      const facts = latticeFactsFor(key);
      assert.ok(facts.title && facts.rows.length, `lattice ${key} is incomplete`);
    }
  });

  it("electrolysis", () => {
    for (const c of grid("electrolysis", ["current"])) {
      for (const seconds of [0, 1, 60, 1800, 7200]) {
        assertTotal(solveElectrolysis({ current: c.current, seconds }), `electrolysis ${c.current}A ${seconds}s`);
      }
    }
  });

  it("vsepr", () => {
    for (const c of grid("vsepr", ["bonding", "lone"])) {
      const r = solveVsepr(c.bonding, c.lone);
      assertTotal(r, `vsepr ${JSON.stringify(c)}`);
      assert.ok(r.shape && r.shape !== "—", `vsepr ${JSON.stringify(c)} has no named shape`);
    }
  });

  it("energetics", () => {
    for (const c of grid("energetics", ["activation", "deltaH", "temperature", "catalyst"])) {
      assertTotal(solveEnergetics(c), `energetics ${JSON.stringify(c)}`);
    }
  });

  it("enzyme", () => {
    for (const c of grid("enzyme", ["temperature", "ph"])) {
      const r = solveEnzyme(c);
      assertTotal(r, `enzyme ${JSON.stringify(c)}`);
      assert.ok(r.rate >= 0 && r.rate <= 1, `enzyme ${JSON.stringify(c)} rate ${r.rate}`);
    }
  });

  it("dna", () => {
    const spec = topicFor("dna").controlSpecs.find((c) => c.key === "pairs" || c.type === "slider");
    for (const pairs of sliderValues(spec)) {
      const r = describeHelix(pairs);
      assert.equal(r.sequence.length, r.pairs);
      assert.ok(Number.isFinite(r.gcFraction), `dna ${pairs} gcFraction ${r.gcFraction}`);
    }
  });

  it("cell", () => {
    for (const c of grid("cell", ["cellType", "tonicity"])) {
      const r = solveOsmosis(c);
      assertTotal(r, `cell ${JSON.stringify(c)}`);
      assert.ok(r.state.length > 0, `cell ${JSON.stringify(c)} has no state`);
    }
  });

  it("protein", () => {
    for (const c of grid("protein", ["structure", "residues", "fold", "temperature"])) {
      assertTotal(solveFolding(c), `protein ${JSON.stringify(c)}`);
    }
  });
});

describe("the grid is a real one", () => {
  it("sweeps a meaningful number of combinations per topic", () => {
    const sizes = {
      organic: grid("organic", ["family", "carbons"]).length,
      enzyme: grid("enzyme", ["temperature", "ph"]).length,
      cell: grid("cell", ["cellType", "tonicity"]).length,
      vsepr: grid("vsepr", ["bonding", "lone"]).length,
    };
    for (const [id, n] of Object.entries(sizes)) {
      assert.ok(n >= 12, `${id} only produced ${n} combinations — the control specs did not parse`);
    }
  });
});

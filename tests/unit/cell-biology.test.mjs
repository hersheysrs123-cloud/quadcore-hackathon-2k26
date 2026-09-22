import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CRENATION_AT,
  LYSIS_BELOW,
  ORGANELLES,
  PLASMOLYSIS_AT,
  TURGID_BELOW,
  organelleFor,
  organellesIn,
  osmosisState,
  solveOsmosis,
} from "../../lib/cellBiology.js";

/** The tonicity slider at the resolution the UI produces. */
const SWEEP = Array.from({ length: 201 }, (_, i) => -1 + i / 100);

describe("the organelles", () => {
  it("gives every organelle a key, a label, a colour, a note and a cell type", () => {
    for (const o of ORGANELLES) {
      assert.ok(o.key.length > 0);
      assert.ok(o.label.length > 0);
      assert.match(o.colour, /^#[0-9a-f]{6}$/i, `${o.key} has no colour`);
      assert.ok(o.note.length > 0, `${o.key} has no note`);
      assert.ok(Array.isArray(o.in) && o.in.length > 0, `${o.key} belongs to no cell type`);
      for (const t of o.in) assert.ok(["plant", "animal"].includes(t), `${o.key} claims "${t}"`);
    }
  });

  it("has no duplicate keys", () => {
    const keys = ORGANELLES.map((o) => o.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  // The regression: the rough ER shared a colour with the cell membrane, so
  // two different clickable things looked identical in the key.
  it("gives every organelle a colour nothing else in the same cell uses", () => {
    for (const type of ["plant", "animal"]) {
      const here = organellesIn(type);
      const colours = here.map((o) => o.colour);
      assert.equal(
        new Set(colours).size,
        here.length,
        `two ${type} organelles share a colour: ${here.map((o) => `${o.label} ${o.colour}`).join(", ")}`,
      );
    }
  });

  // The regression: the `plant` / `animal` flag existed on every organelle and
  // was never read, so the panel listed chloroplasts, a vacuole and a
  // cellulose wall for ANIMAL cells and lysosomes for plant ones.
  it("keeps the plant-only organelles out of an animal cell", () => {
    const animal = organellesIn("animal").map((o) => o.key);
    for (const k of ["chloroplast", "vacuole", "wall"]) {
      assert.ok(!animal.includes(k), `an animal cell was given a ${k}`);
    }
  });

  it("keeps the animal-only organelles out of a plant cell", () => {
    const plant = organellesIn("plant").map((o) => o.key);
    for (const k of ["lysosome", "centriole"]) {
      assert.ok(!plant.includes(k), `a plant cell was given a ${k}`);
    }
  });

  it("gives both cell types the organelles they share", () => {
    const plant = organellesIn("plant").map((o) => o.key);
    const animal = organellesIn("animal").map((o) => o.key);
    for (const k of ["nucleus", "mitochondrion", "er", "smoothEr", "golgi", "ribosome", "membrane", "cytoskeleton"]) {
      assert.ok(plant.includes(k), `the plant cell is missing its ${k}`);
      assert.ok(animal.includes(k), `the animal cell is missing its ${k}`);
    }
  });

  // The regression: half the clickable organelles — smooth ER, ribosomes,
  // lysosomes, centrioles, cytoskeleton — had no key entry at all.
  it("keys every organelle the scene draws, with no unreachable entries", () => {
    for (const k of ["smoothEr", "ribosome", "lysosome", "centriole", "cytoskeleton"]) {
      assert.ok(organelleFor(k), `${k} has no entry`);
    }
    const union = new Set([...organellesIn("plant"), ...organellesIn("animal")].map((o) => o.key));
    assert.equal(union.size, ORGANELLES.length, "an organelle belongs to neither cell type");
  });

  it("returns null rather than a wrong organelle for an unknown key", () => {
    assert.equal(organelleFor("mitochondria"), null);
    assert.equal(organelleFor(undefined), null);
  });

  it("treats anything that is not a plant as an animal", () => {
    assert.deepEqual(organellesIn("animal"), organellesIn("nonsense"));
    assert.deepEqual(organellesIn("animal"), organellesIn(undefined));
  });
});

describe("osmosis in a plant cell", () => {
  // The regression: the panel switched state at ±0.05 and the scene at
  // +0.45 / −0.3, so at tonicity 0.1 the panel said "Plasmolysed" over a scene
  // that had barely moved — and "Flaccid", one of the three states the topic
  // teaches, never appeared in the panel at all.
  it("reaches all three states the topic teaches", () => {
    const states = new Set(SWEEP.map((t) => osmosisState("plant", t).state));
    assert.deepEqual([...states].sort(), ["Flaccid", "Plasmolysed", "Turgid"]);
  });

  it("switches at the thresholds the scene draws at", () => {
    assert.equal(osmosisState("plant", PLASMOLYSIS_AT + 0.01).state, "Plasmolysed");
    assert.equal(osmosisState("plant", PLASMOLYSIS_AT - 0.01).state, "Flaccid");
    assert.equal(osmosisState("plant", TURGID_BELOW - 0.01).state, "Turgid");
    assert.equal(osmosisState("plant", TURGID_BELOW + 0.01).state, "Flaccid");
  });

  it("is flaccid, not plasmolysed, in an isotonic solution", () => {
    const s = osmosisState("plant", 0);
    assert.equal(s.state, "Flaccid");
    assert.match(s.outside, /isotonic/);
  });

  it("is flaccid, not plasmolysed, at a mildly concentrated 0.1", () => {
    assert.equal(osmosisState("plant", 0.1).state, "Flaccid");
  });

  it("is turgid in a dilute solution — the state that holds the plant up", () => {
    const s = osmosisState("plant", -1);
    assert.equal(s.state, "Turgid");
    assert.equal(s.tone, "good");
    assert.match(s.detail, /against the wall/);
  });

  it("never bursts — the cell wall is what stops it", () => {
    for (const t of SWEEP) {
      assert.ok(!/Lysed/.test(osmosisState("plant", t).state), `a plant cell lysed at ${t}`);
      assert.ok(!/Crenated/.test(osmosisState("plant", t).state));
    }
  });

  it("does not claim flaccid means no water is moving", () => {
    // The flaccid band is a RANGE of tonicities, and at the concentrated end
    // of it water is leaving. What defines flaccid is the absence of turgor
    // pressure, not the absence of movement.
    const s = osmosisState("plant", 0.3);
    assert.equal(s.state, "Flaccid");
    assert.equal(s.flow, "out of the cell");
    assert.ok(!/no net flow/i.test(s.detail), `self-contradicting detail: ${s.detail}`);
    assert.match(s.detail, /turgor pressure/);
  });
});

describe("osmosis in an animal cell", () => {
  it("reaches all three of its states", () => {
    const states = new Set(SWEEP.map((t) => osmosisState("animal", t).state));
    assert.deepEqual([...states].sort(), ["Crenated (shrivelled)", "Lysed (burst)", "Normal"]);
  });

  it("switches at the thresholds the scene draws at", () => {
    assert.match(osmosisState("animal", CRENATION_AT + 0.01).state, /Crenated/);
    assert.equal(osmosisState("animal", CRENATION_AT - 0.01).state, "Normal");
    assert.match(osmosisState("animal", LYSIS_BELOW - 0.01).state, /Lysed/);
    assert.equal(osmosisState("animal", LYSIS_BELOW + 0.01).state, "Normal");
  });

  it("bursts in a very dilute solution, because it has no wall to resist", () => {
    const s = osmosisState("animal", -1);
    assert.match(s.state, /Lysed/);
    assert.match(s.detail, /no wall/);
    assert.equal(s.tone, "bad");
  });

  it("is never turgid or plasmolysed — those are plant words", () => {
    for (const t of SWEEP) {
      const state = osmosisState("animal", t).state;
      assert.ok(!/Turgid|Plasmolysed|Flaccid/.test(state), `an animal cell read "${state}" at ${t}`);
    }
  });
});

describe("what the readout prints", () => {
  it("describes the flow in the direction the concentration gradient demands", () => {
    for (const type of ["plant", "animal"]) {
      for (const t of SWEEP) {
        const s = osmosisState(type, t);
        if (t > 0.05) {
          assert.equal(s.flow, "out of the cell", `flow wrong at ${t}`);
          assert.match(s.outside, /hypertonic/);
        } else if (t < -0.05) {
          assert.equal(s.flow, "into the cell", `flow wrong at ${t}`);
          assert.match(s.outside, /hypotonic/);
        } else {
          assert.match(s.flow, /balanced/);
          assert.match(s.outside, /isotonic/);
        }
      }
    }
  });

  it("returns a named state, a tone and a reason for every slider position", () => {
    const TONES = new Set(["good", "warn", "bad"]);
    for (const type of ["plant", "animal"]) {
      for (const t of SWEEP) {
        const s = osmosisState(type, t);
        assert.ok(s.state.length > 0);
        assert.ok(TONES.has(s.tone), `tone "${s.tone}" at ${t}`);
        assert.ok(s.detail.length > 10, `no reason given at ${t}`);
      }
    }
  });

  it("agrees between solveOsmosis and the state function", () => {
    for (const type of ["plant", "animal"]) {
      for (const t of SWEEP) {
        const solved = solveOsmosis({ cellType: type, tonicity: t });
        const raw = osmosisState(type, t);
        assert.equal(solved.state, raw.state);
        assert.equal(solved.flow, raw.flow);
        assert.equal(solved.detail, raw.detail);
        assert.deepEqual(solved.organelles, organellesIn(type));
      }
    }
  });

  it("reports the plant cell's structures only for a plant cell", () => {
    const plant = solveOsmosis({ cellType: "plant" });
    const animal = solveOsmosis({ cellType: "animal" });
    assert.equal(plant.hasWall, true);
    assert.equal(plant.hasChloroplasts, true);
    assert.equal(plant.hasVacuole, true);
    assert.equal(plant.hasCentrioles, false);
    assert.equal(animal.hasWall, false);
    assert.equal(animal.hasChloroplasts, false);
    assert.equal(animal.hasVacuole, false);
    assert.equal(animal.hasCentrioles, true);
  });

  it("clamps a tonicity that has gone out of range", () => {
    assert.equal(solveOsmosis({ tonicity: 5 }).tonicity, 1);
    assert.equal(solveOsmosis({ tonicity: -5 }).tonicity, -1);
    assert.equal(solveOsmosis({ tonicity: NaN }).tonicity, 0);
    assert.equal(solveOsmosis().tonicity, 0);
    assert.equal(solveOsmosis().cellType, "plant");
  });

  it("says water is moving exactly when the solution is not isotonic", () => {
    for (const t of SWEEP) {
      assert.equal(solveOsmosis({ tonicity: t }).moving, Math.abs(t) > 0.05, `moving wrong at ${t}`);
    }
  });
});

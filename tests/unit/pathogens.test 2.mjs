import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ANTIBIOTIC_STAGES,
  ANTIBIOTIC_TARGETS,
  ANTIBIOTIC_TIMELINE,
  BACTERIUM,
  BURST_SIZE,
  LIVING_CRITERIA,
  LYTIC_STAGES,
  LYTIC_TIMELINE,
  PHAGE,
  SIZE_RATIO,
  antibioticEfficacy,
  classify,
  describeAntibiotic,
  describeInfection,
  hasTarget,
  hostStatus,
  virionsAssembled,
} from "../../lib/pathogens.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const at = (tl, key, frac = 0) => tl.byKey[key].start + tl.byKey[key].duration * frac;

describe("Anatomy", () => {
  it("lists the parts an antibiotic can hit on the bacterium and none of them on the phage", () => {
    const bact = BACTERIUM.parts.map((p) => p.key);
    assert.ok(bact.includes("wall") && bact.includes("ribosomes") && bact.includes("nucleoid") && bact.includes("plasmid") && bact.includes("flagellum"));
    const phage = PHAGE.parts.map((p) => p.key);
    assert.deepEqual(phage, ["capsid", "genome", "sheath", "baseplate", "fibres"]);
    assert.ok(!phage.includes("wall") && !phage.includes("ribosomes"));
    assert.equal(SIZE_RATIO, 10, "a bacterium is ~10× the phage's length");
  });
});

describe("Living or not", () => {
  it("ticks every box for the bacterium and only the genetic ones for the virus", () => {
    const b = classify("bacterium");
    const v = classify("virus");
    assert.equal(b.met, LIVING_CRITERIA.length);
    assert.equal(b.living, true);
    assert.equal(v.living, false);
    assert.equal(v.met, 2);
    assert.deepEqual(
      v.checklist.filter((c) => c.met).map((c) => c.key),
      ["genes", "evolves"],
    );
    assert.equal(v.checklist.find((c) => c.key === "cells").met, false);
    assert.match(v.verdict, /non-living/);
  });
});

describe("Antibiotics", () => {
  it("are 100 % effective on the bacterium and 0 % on the virus, whatever the drug", () => {
    for (const target of ANTIBIOTIC_TARGETS) {
      const b = antibioticEfficacy("bacterium", target.key);
      const v = antibioticEfficacy("virus", target.key);
      assert.equal(b.percent, 100);
      assert.equal(v.percent, 0);
      assert.equal(b.drug, target.drug);
      assert.match(v.reason, /no .* — there is nothing/);
    }
    assert.equal(hasTarget("bacterium"), true);
    assert.equal(hasTarget("virus"), false);
    assert.equal(antibioticEfficacy("virus", "nope").drug, "Penicillin", "unknown target falls back to penicillin");
  });

  it("shred the wall and then burst the cell", () => {
    assert.deepEqual(ANTIBIOTIC_STAGES.map((s) => s.key), ["administer", "breach", "lysis"]);
    const before = describeAntibiotic(0);
    assert.equal(before.started, false);
    assert.ok(close(before.wallIntegrity, 1));
    assert.equal(before.lysed, false);
    const half = describeAntibiotic(at(ANTIBIOTIC_TIMELINE, "breach", 0.5));
    assert.ok(half.wallIntegrity > 0.3 && half.wallIntegrity < 0.7);
    assert.ok(half.swelling > 0);
    const gone = describeAntibiotic(at(ANTIBIOTIC_TIMELINE, "breach", 1));
    assert.ok(close(gone.wallIntegrity, 0));
    const end = describeAntibiotic(ANTIBIOTIC_TIMELINE.total);
    assert.equal(end.lysed, true);
    assert.equal(end.complete, true);
    assert.equal(end.bacterium.percent, 100);
    assert.equal(end.virus.percent, 0);
  });
});

describe("The lytic cycle", () => {
  it("runs attachment → injection → takeover → assembly → lysis", () => {
    assert.deepEqual(LYTIC_STAGES.map((s) => s.key), ["attachment", "injection", "takeover", "assembly", "lysis"]);
    assert.ok(LYTIC_TIMELINE.total > 10);
  });

  it("injects the genome after attaching, then degrades the host's DNA", () => {
    const attached = describeInfection(at(LYTIC_TIMELINE, "attachment", 1));
    assert.equal(attached.attached, true);
    assert.equal(attached.injected, false);
    assert.equal(attached.genomeInjected, 0);
    assert.ok(close(attached.hostDnaIntact, 1));
    const injecting = describeInfection(at(LYTIC_TIMELINE, "injection", 0.5));
    assert.ok(injecting.sheathContraction > 0.9, "sheath contracts in the first half of injection");
    assert.ok(close(injecting.genomeInjected, 0.5));
    const taken = describeInfection(at(LYTIC_TIMELINE, "takeover", 1));
    assert.equal(taken.injected, true);
    assert.ok(close(taken.hostDnaIntact, 0));
    assert.equal(taken.virionsAssembled, 0);
    assert.equal(taken.hostAlive, true);
  });

  it("assembles the burst size, then releases it all at lysis", () => {
    assert.equal(virionsAssembled(0), 0);
    assert.equal(virionsAssembled(1), BURST_SIZE);
    assert.ok(virionsAssembled(0.5) < BURST_SIZE / 2, "slow start, then a rush");
    const built = describeInfection(at(LYTIC_TIMELINE, "assembly", 1));
    assert.equal(built.virionsAssembled, BURST_SIZE);
    assert.equal(built.released, 0);
    assert.equal(built.lysed, false);
    const end = describeInfection(LYTIC_TIMELINE.total);
    assert.equal(end.lysed, true);
    assert.equal(end.hostAlive, false);
    assert.equal(end.released, BURST_SIZE);
    assert.equal(end.burstSize, BURST_SIZE);
    assert.equal(end.complete, true);
  });

  it("never builds more than it releases", () => {
    for (let t = 0; t <= LYTIC_TIMELINE.total; t += 0.1) {
      const d = describeInfection(t);
      assert.ok(d.released <= d.virionsAssembled);
    }
  });
});

describe("Host status", () => {
  it("reports what the bacterium is going through", () => {
    const idle = { started: false, injected: false, lysed: false };
    const none = { started: false, lysed: false };
    assert.equal(hostStatus(idle, none).key, "healthy");
    assert.equal(hostStatus({ ...idle, started: true }, none).key, "under_attack");
    assert.equal(hostStatus({ ...idle, started: true, injected: true }, none).key, "hijacked");
    assert.equal(hostStatus({ ...idle, started: true, injected: true }, { started: true, lysed: false }).key, "wall_failing");
    assert.equal(hostStatus({ ...idle, lysed: true }, none).key, "lysed_phage");
    assert.equal(hostStatus({ ...idle, lysed: true }, { started: true, lysed: true }).key, "lysed_antibiotic");
    assert.equal(hostStatus({ ...idle, lysed: true }, { started: true, lysed: true }).alive, false);
  });
});

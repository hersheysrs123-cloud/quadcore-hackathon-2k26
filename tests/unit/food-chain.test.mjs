import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NEXT_LINK,
  PRODUCER_KJ_AT_FULL_SUN,
  TIERS,
  TOXIN_HARM_PPM,
  TOXIN_LETHAL_PPM,
  TOXIN_MAGNIFICATION,
  TOXIN_PPM_PER_DOSE,
  TRANSFER_EFFICIENCY,
  TRANSFER_LOSS,
  apexRemovedByButton,
  cascadeMultiplier,
  headcount,
  isViable,
  solveFoodChain,
  tierEnergy,
  toxinAtTier,
  toxinStatus,
  toxinStatusLabel,
} from "../../lib/foodChain.js";

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

describe("The ten per cent rule", () => {
  it("gives each level a tenth of the one below: 10 000 → 1 000 → 100 → 10 kJ", () => {
    assert.ok(close(TRANSFER_EFFICIENCY + TRANSFER_LOSS, 1));
    assert.equal(tierEnergy(100, 0), PRODUCER_KJ_AT_FULL_SUN);
    assert.ok(close(tierEnergy(100, 1), 1000));
    assert.ok(close(tierEnergy(100, 2), 100));
    assert.ok(close(tierEnergy(100, 3), 10));
  });

  it("scales the whole pyramid with the Sun", () => {
    assert.ok(close(tierEnergy(150, 0), 15000));
    assert.ok(close(tierEnergy(50, 3), 5));
    assert.ok(close(tierEnergy(500, 0), 15000), "clamped to the slider's top");
    assert.ok(close(tierEnergy(0, 0), 5000), "and its bottom");
  });

  it("supports far fewer, bigger organisms at each step", () => {
    const [leaves, caterpillars, tits, hawk] = TIERS;
    assert.equal(headcount(10000, leaves), 500000);
    assert.equal(headcount(1000, caterpillars), 5000);
    assert.equal(headcount(100, tits), 20);
    assert.equal(headcount(10, hawk), 1);
    assert.equal(headcount(-3, hawk), 0);
  });

  it("caps the chain where one more organism cannot be fed", () => {
    const hawk = TIERS[3];
    assert.ok(isViable(10, hawk));
    assert.ok(!isViable(5, hawk), "half the Sun, no hawk");
    assert.ok(!isViable(tierEnergy(150, 3) * TRANSFER_EFFICIENCY, NEXT_LINK), "even in strong sun a fifth link starves");
  });
});

describe("Biomagnification", () => {
  it("multiplies concentration by ten per link — the reciprocal of the energy transfer", () => {
    assert.ok(close(TOXIN_MAGNIFICATION, 1 / TRANSFER_EFFICIENCY));
    assert.ok(close(toxinAtTier(1, 0), TOXIN_PPM_PER_DOSE));
    assert.ok(close(toxinAtTier(1, 1), TOXIN_PPM_PER_DOSE * 10));
    assert.ok(close(toxinAtTier(1, 3), TOXIN_PPM_PER_DOSE * 1000));
    assert.equal(toxinAtTier(0, 3), 0);
    assert.equal(toxinAtTier(-2, 3), 0);
  });

  it("is a trace on the leaves and eggshell thinning in the hawk after one spray", () => {
    assert.equal(toxinStatus(0), "clean");
    assert.equal(toxinStatus(toxinAtTier(1, 0)), "trace");
    assert.equal(toxinStatus(toxinAtTier(1, 3)), "harmed");
    assert.ok(toxinAtTier(1, 3) >= TOXIN_HARM_PPM && toxinAtTier(1, 3) < TOXIN_LETHAL_PPM);
    assert.equal(toxinStatus(toxinAtTier(3, 3)), "lethal");
    assert.equal(toxinStatusLabel("harmed", TIERS[3]), "eggshell thinning");
    assert.equal(toxinStatusLabel("harmed", TIERS[1]), "sub-lethal load");
    assert.equal(toxinStatusLabel("lethal", TIERS[3]), "lethal dose");
    assert.equal(toxinStatusLabel("clean", TIERS[0]), "clean");
  });
});

describe("The cascade", () => {
  it("toggles with the button", () => {
    assert.equal(apexRemovedByButton(0), false);
    assert.equal(apexRemovedByButton(1), true);
    assert.equal(apexRemovedByButton(2), false);
    assert.equal(apexRemovedByButton(3), true);
  });

  it("booms the prey, crashes their prey, and lets the producers recover", () => {
    const [leaves, caterpillars, tits, hawk] = TIERS;
    assert.equal(cascadeMultiplier(hawk, false), 1);
    assert.equal(cascadeMultiplier(hawk, true), 0);
    assert.ok(cascadeMultiplier(tits, true) > 1);
    assert.ok(cascadeMultiplier(caterpillars, true) < 1);
    assert.ok(cascadeMultiplier(leaves, true) > 1);
  });
});

describe("The pyramid", () => {
  it("stands intact at the defaults, four links long", () => {
    const p = solveFoodChain({ insolation: 100, toxinDoses: 0, cascadePresses: 0 });
    assert.equal(p.tiers.length, 4);
    assert.deepEqual(
      p.tiers.map((t) => Math.round(t.energyKJ)),
      [10000, 1000, 100, 10],
    );
    assert.deepEqual(
      p.tiers.map((t) => t.population),
      [500000, 5000, 20, 1],
    );
    assert.equal(p.chainLength, 4);
    assert.equal(p.apexRemoved, false);
    assert.ok(p.tiers.every((t) => t.toxinStatus === "clean"));
    assert.ok(close(p.apexShare, 0.001), "one part in a thousand of what the leaves stored");
  });

  it("accounts for the 90 % lost at each transfer", () => {
    const p = solveFoodChain({ insolation: 100 });
    assert.equal(p.tiers[0].lostKJ, 0);
    assert.ok(close(p.tiers[1].lostKJ, 9000));
    assert.ok(close(p.tiers[2].lostKJ, 900));
    assert.ok(close(p.tiers[3].lostKJ, 90));
    assert.ok(close(p.totalLostKJ, 9990));
    assert.ok(close(p.tiers[3].receivedKJ, 100));
  });

  it("says why there is no fifth link", () => {
    const p = solveFoodChain({ insolation: 100 });
    assert.ok(close(p.nextLink.energyKJ, 1));
    assert.equal(p.nextLink.viable, false);
    assert.ok(p.nextLink.individuals < 0.1);
    const bright = solveFoodChain({ insolation: 150 });
    assert.equal(bright.nextLink.viable, false, "still not in strong sun");
    assert.equal(bright.chainLength, 4);
  });

  it("loses the sparrowhawk when the Sun dims", () => {
    const dim = solveFoodChain({ insolation: 50 });
    const hawk = dim.tiers[3];
    assert.equal(hawk.viable, false);
    assert.equal(hawk.population, 0);
    assert.equal(hawk.energyKJ, 0);
    assert.equal(dim.chainLength, 3);
    assert.equal(dim.apexRemoved, false, "starved, not removed — no cascade");
    assert.equal(dim.tiers[2].cascade, 1);
  });

  it("magnifies a spray up the chain and poisons the hawk after three", () => {
    const one = solveFoodChain({ toxinDoses: 1 });
    assert.deepEqual(
      one.tiers.map((t) => t.toxinStatus),
      ["trace", "trace", "trace", "harmed"],
    );
    assert.ok(close(one.tiers[3].toxinPpm, 10));
    assert.equal(one.apexPoisoned, false);
    assert.equal(one.tiers[3].toxinLabel, "eggshell thinning");

    const three = solveFoodChain({ toxinDoses: 3 });
    assert.equal(three.tiers[3].toxinStatus, "lethal");
    assert.equal(three.apexPoisoned, true);
    assert.equal(three.apexRemoved, true, "a poisoned apex is a removed apex");
    assert.equal(three.tiers[3].population, 0);
    assert.ok(three.tiers[2].population > one.tiers[2].population, "and the cascade follows");
    assert.equal(three.chainLength, 3);
    assert.ok(three.nextLink.toxinPpm > three.tiers[3].toxinPpm);
  });

  it("runs the trophic cascade when the apex is removed, and back again", () => {
    const intact = solveFoodChain({});
    const removed = solveFoodChain({ cascadePresses: 1 });
    assert.equal(removed.apexRemoved, true);
    assert.equal(removed.cascadeByButton, true);
    assert.equal(removed.tiers[3].removed, true);
    assert.equal(removed.tiers[3].population, 0);
    assert.ok(removed.tiers[2].population > intact.tiers[2].population, "blue tits boom");
    assert.ok(removed.tiers[1].population < intact.tiers[1].population, "caterpillars crash");
    assert.ok(removed.tiers[0].population > intact.tiers[0].population, "leaves recover");
    assert.equal(removed.chainLength, 3);
    assert.ok(close(removed.tiers[2].intactKJ, intact.tiers[2].energyKJ), "the intact figures are kept for comparison");

    const back = solveFoodChain({ cascadePresses: 2 });
    assert.equal(back.apexRemoved, false);
    assert.deepEqual(back.tiers.map((t) => t.population), intact.tiers.map((t) => t.population));
  });

  it("tolerates missing or silly inputs", () => {
    const p = solveFoodChain();
    assert.equal(p.insolation, 100);
    assert.equal(p.doses, 0);
    const q = solveFoodChain({ insolation: 9999, toxinDoses: -4, cascadePresses: 2.7 });
    assert.equal(q.insolation, 150);
    assert.equal(q.doses, 0);
    assert.equal(q.apexRemoved, false);
  });
});

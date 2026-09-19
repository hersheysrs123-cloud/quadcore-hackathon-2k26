// ─── Food chains and the energy pyramid ─────────────────────────────
// The arithmetic behind the trophic-pyramid scene: one oak-wood food chain,
// Sun → oak leaves → caterpillars → blue tits → sparrowhawk, and the single
// number that shapes it. Of the energy stored in one trophic level, only
// about TEN PER CENT ends up stored in the next. The rest is respired as
// heat, left uneaten, or passed out undigested — and none of that is
// available to the level above.
//
// Three things fall out of that one fraction, and the scene teaches each:
//
//   the shape       a pyramid, because each tier has a tenth the energy of
//                   the one below — 10 000 → 1 000 → 100 → 10 kJ — and,
//                   with a bigger animal at each step, a far smaller
//                   headcount: half a million leaves feed one hawk;
//   the length      a fifth link would receive 1 kJ, less than one more
//                   predator needs to live, so the chain stops at four;
//                   dim the Sun and even the fourth link starves;
//   biomagnification a fat-soluble toxin is NOT lost with the 90 %. Every
//                   kilojoule at one level was ten kilojoules at the level
//                   below, and the toxin in all ten came with it, so the
//                   concentration per kilojoule of tissue multiplies by
//                   the same factor the energy divides by. A trace on the
//                   leaves is a lethal dose in the hawk.
//
// Removing the apex predator runs the other classic result, the trophic
// cascade: its prey booms, THEIR prey crashes, and the producers recover.
//
// Steady state throughout: the dials give an equilibrium, and the scene
// eases its populations towards it.
// ─────────────────────────────────────────────────────────────────────

/** Fraction of one level's energy that becomes stored energy in the next. */
export const TRANSFER_EFFICIENCY = 0.1;

/** The 90 % that goes as heat, waste and the uneaten. */
export const TRANSFER_LOSS = 1 - TRANSFER_EFFICIENCY;

/** Energy the producers store at 100 % insolation, kJ — the base of the pyramid. */
export const PRODUCER_KJ_AT_FULL_SUN = 10000;

export const MIN_INSOLATION_PCT = 50;
export const MAX_INSOLATION_PCT = 150;

/**
 * The four levels. `kjPerIndividual` is the stored energy of one organism
 * (so the headcount is energy ÷ that); `cascade` is what happens to the
 * level's standing crop when the sparrowhawk is removed.
 */
export const TIERS = [
  {
    key: "producers",
    label: "Producers",
    organism: "Oak leaves",
    singular: "oak leaf",
    plural: "oak leaves",
    kjPerIndividual: 0.02,
    colour: "#34d399",
    cascade: 1.3,
    bird: false,
    note: "Photosynthesis fixes the Sun's energy into sugar",
  },
  {
    key: "primary",
    label: "Primary consumers",
    organism: "Caterpillars",
    singular: "caterpillar",
    plural: "caterpillars",
    kjPerIndividual: 0.2,
    colour: "#a3e635",
    cascade: 0.35,
    bird: false,
    note: "Herbivores — eat the leaves",
  },
  {
    key: "secondary",
    label: "Secondary consumers",
    organism: "Blue tits",
    singular: "blue tit",
    plural: "blue tits",
    kjPerIndividual: 5,
    colour: "#38bdf8",
    cascade: 2.2,
    bird: true,
    note: "Small insectivorous birds — eat the caterpillars",
  },
  {
    key: "apex",
    label: "Apex predator",
    organism: "Sparrowhawk",
    singular: "sparrowhawk",
    plural: "sparrowhawks",
    kjPerIndividual: 8,
    colour: "#fbbf24",
    cascade: 0,
    bird: true,
    note: "Nothing in the wood eats it — it is the top of the chain",
  },
];

/** The link that is not there: what would eat sparrowhawks, and what one of them would need. */
export const NEXT_LINK = { label: "A fifth link", organism: "Goshawk", kjPerIndividual: 15 };

// ─── Toxin ──────────────────────────────────────────────────────────

/** Concentration one spray leaves on the leaves, ppm in tissue. */
export const TOXIN_PPM_PER_DOSE = 0.01;

/** Concentration multiplies by this per link — the reciprocal of the energy transfer. */
export const TOXIN_MAGNIFICATION = 1 / TRANSFER_EFFICIENCY;

/** Tissue concentration at which birds' eggshells thin and breeding fails, ppm. */
export const TOXIN_HARM_PPM = 5;

/** Tissue concentration that kills, ppm. */
export const TOXIN_LETHAL_PPM = 25;

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ─── Energy ─────────────────────────────────────────────────────────

/** Stored energy at level `i` (0 = producers) for a given insolation, kJ. */
export function tierEnergy(insolationPct, i) {
  const ins = clamp(insolationPct, MIN_INSOLATION_PCT, MAX_INSOLATION_PCT) / 100;
  return PRODUCER_KJ_AT_FULL_SUN * ins * Math.pow(TRANSFER_EFFICIENCY, i);
}

/** Whole organisms that much energy supports. */
export function headcount(energyKJ, tier) {
  return Math.max(0, Math.floor(energyKJ / tier.kjPerIndividual));
}

/** A level exists only if it can feed at least one of its organism. */
export function isViable(energyKJ, tier) {
  return energyKJ >= tier.kjPerIndividual;
}

// ─── Toxin ──────────────────────────────────────────────────────────

/** Tissue concentration at level `i` after `doses` sprays, ppm. */
export function toxinAtTier(doses, i) {
  return Math.max(0, doses) * TOXIN_PPM_PER_DOSE * Math.pow(TOXIN_MAGNIFICATION, i);
}

/** `clean` · `trace` · `harmed` (eggshell thinning in birds) · `lethal`. */
export function toxinStatus(ppm) {
  if (ppm >= TOXIN_LETHAL_PPM) return "lethal";
  if (ppm >= TOXIN_HARM_PPM) return "harmed";
  if (ppm > 0) return "trace";
  return "clean";
}

export function toxinStatusLabel(status, tier) {
  switch (status) {
    case "lethal":
      return "lethal dose";
    case "harmed":
      return tier.bird ? "eggshell thinning" : "sub-lethal load";
    case "trace":
      return "trace";
    default:
      return "clean";
  }
}

// ─── Cascade ────────────────────────────────────────────────────────

/** The removal button toggles: odd presses = removed. */
export function apexRemovedByButton(presses) {
  return Math.max(0, Math.floor(presses)) % 2 === 1;
}

/** Standing-crop multiplier for a level once the apex predator is gone. */
export function cascadeMultiplier(tier, removed) {
  return removed ? tier.cascade : 1;
}

// ─── The pyramid ────────────────────────────────────────────────────

/**
 * The whole chain from the three dials. Each tier carries its energy (kJ),
 * headcount, toxin concentration and status; the result also says how long
 * the chain can be and what a fifth link would get.
 */
export function solveFoodChain({ insolation = 100, toxinDoses = 0, cascadePresses = 0 } = {}) {
  const ins = clamp(insolation, MIN_INSOLATION_PCT, MAX_INSOLATION_PCT);
  const doses = Math.max(0, Math.floor(toxinDoses));

  // The intact pyramid first: the cascade needs to know whether the hawk was ever there.
  const intact = TIERS.map((tier, i) => {
    const energy = tierEnergy(ins, i);
    const toxin = toxinAtTier(doses, i);
    return { tier, i, energy, toxin, status: toxinStatus(toxin), viable: isViable(energy, tier) };
  });
  const apex = intact[intact.length - 1];
  const apexPoisoned = apex.status === "lethal";
  const removed = apexRemovedByButton(cascadePresses) || apexPoisoned;

  // C36: what each tier actually holds once the cascade is applied, worked
  // out for the whole chain FIRST.
  //
  // `receivedKJ` and `lostKJ` used to be read off the intact pyramid
  // (`intact[i - 1].energy`) while `energyKJ` had the cascade multiplier in
  // it. So with the apex removed the panel went on reporting the transfers
  // of a chain that was no longer on screen -- the tiers had changed and the
  // arrows between them had not.
  const storedByTier = intact.map(({ tier, energy, viable }) =>
    viable ? energy * cascadeMultiplier(tier, removed) : 0,
  );

  const tiers = intact.map(({ tier, i, energy, toxin, status, viable }) => {
    const multiplier = cascadeMultiplier(tier, removed);
    const stored = storedByTier[i];
    // Producers are fed by the sun, not by a tier below, so they receive
    // exactly what they capture and lose nothing to a transfer.
    const received = i === 0 ? stored : storedByTier[i - 1];
    const lost = i === 0 ? 0 : received - stored;
    return {
      key: tier.key,
      label: tier.label,
      organism: tier.organism,
      singular: tier.singular,
      plural: tier.plural,
      colour: tier.colour,
      bird: tier.bird,
      note: tier.note,
      level: i,
      energyKJ: stored,
      intactKJ: energy,
      receivedKJ: received,
      lostKJ: lost,
      population: viable ? headcount(stored, tier) : 0,
      intactPopulation: headcount(energy, tier),
      kjPerIndividual: tier.kjPerIndividual,
      viable,
      toxinPpm: toxin,
      toxinStatus: status,
      toxinLabel: toxinStatusLabel(status, tier),
      cascade: multiplier,
      removed: removed && tier.key === "apex",
      /**
       * True when the cascade has left this tier holding MORE than it would
       * have in the intact chain -- the producers released from grazing, and
       * the mesopredator released from predation. That is the whole point of
       * the cascade button, and it is not a steady state, so a readout has to
       * be able to say which case it is describing.
       */
      gaining: stored > energy + 1e-9,
    };
  });

  const chainLength = (() => {
    let n = 0;
    for (const t of tiers) {
      if (!t.viable || t.removed) break;
      n += 1;
    }
    return n;
  })();

  const nextEnergy = apex.energy * TRANSFER_EFFICIENCY;
  const nextLink = {
    ...NEXT_LINK,
    energyKJ: nextEnergy,
    viable: isViable(nextEnergy, NEXT_LINK),
    individuals: nextEnergy / NEXT_LINK.kjPerIndividual,
    toxinPpm: toxinAtTier(doses, TIERS.length),
  };

  const totalLost = tiers.reduce((s, t) => s + t.lostKJ, 0);

  return {
    insolation: ins,
    doses,
    tiers,
    apexRemoved: removed,
    apexPoisoned,
    apexViable: apex.viable,
    cascadeByButton: apexRemovedByButton(cascadePresses),
    chainLength,
    nextLink,
    totalLostKJ: totalLost,
    producerKJ: intact[0].energy,
    apexShare: Math.pow(TRANSFER_EFFICIENCY, TIERS.length - 1),
  };
}

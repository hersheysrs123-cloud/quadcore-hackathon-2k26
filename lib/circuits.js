// ─── Series and parallel circuits ───────────────────────────────────
// Two bulbs, a battery pack and a switch, solved as a real supply rather than
// an ideal one: the battery has internal resistance, so adding a parallel
// branch visibly drags the terminal voltage down and a short circuit draws a
// large but finite current instead of dividing by zero.
//
// That choice is the whole reason this module exists. With an ideal cell the
// series/parallel comparison degenerates into two arithmetic facts a student
// can memorise without believing. With a real one, closing the second branch
// makes the first branch's bulb dim slightly — the supply is being asked for
// more current than it can deliver at full voltage — and the trade-off stops
// being a formula and becomes something visible on the meters.
// ─────────────────────────────────────────────────────────────────────

/** Internal resistance of the battery pack, ohms. A tired AA holder. */
export const BATTERY_INTERNAL_R = 0.5;
/** Total resistance of the copper traces in the supply run, ohms. */
export const WIRE_R = 0.04;
/** The shorting jumper. Not zero — nothing is. */
export const SHORT_R = 0.01;
/** Current above which the pack is being damaged, amps. */
export const FUSE_A = 5;

export const TOPOLOGIES = {
  series: {
    label: "Series",
    short: "Series",
    bulbs: ["A", "B"],
    formula: "R_eq = R₁ + R₂",
    summary: "one loop, one current, and every bulb sharing the same voltage",
    note: "One path means one current. Break it anywhere — unscrew a bulb, open the switch — and every component goes dark, because there is no longer a loop for charge to go round.",
  },
  parallel: {
    label: "Parallel",
    short: "Parallel",
    bulbs: ["A", "B"],
    formula: "1/R_eq = 1/R₁ + 1/R₂",
    summary: "two independent branches, each across the full supply",
    note: "Each branch sits across the whole battery, so each bulb gets the full voltage and runs at full brightness. Removing one leaves the other's loop untouched — and the total current is the sum of the branches, so it is larger, not smaller.",
  },
  combination: {
    label: "Combination",
    short: "Combination",
    bulbs: ["A", "B", "C"],
    formula: "R_eq = (R₁ + R₂) ∥ R₃",
    summary: "a two-bulb series branch, in parallel with a single bulb",
    note: "Reduce it in stages: add the two series bulbs into one branch resistance, then combine that branch with the single bulb in parallel. A and B share their branch's voltage between them, so they are dimmer than C.",
  },
};

/** Two resistances side by side. Infinity is an open branch, not an error. */
export function parallelPair(a, b) {
  if (!Number.isFinite(a)) return b;
  if (!Number.isFinite(b)) return a;
  if (a <= 0 || b <= 0) return 0;
  return (a * b) / (a + b);
}

/** Reciprocal sum over any number of branches. */
export function parallelAll(resistances) {
  const conductance = resistances.reduce(
    (sum, r) => sum + (Number.isFinite(r) && r > 0 ? 1 / r : 0),
    0,
  );
  return conductance > 0 ? 1 / conductance : Infinity;
}

/**
 * Which bulbs sit on which branch, and which of them has been unscrewed.
 *
 * An unscrewed bulb is an infinite resistance in its socket, so the branch it
 * belongs to goes open. In series that is the whole circuit; in parallel it is
 * one branch and the other never notices — which is the single fact both
 * topologies exist in the syllabus to establish.
 */
export function branchesFor(topology, bulbR, unscrewed) {
  const R = Math.max(bulbR, 0.1);
  const socket = (id, removed) => ({ id, resistance: removed ? Infinity : R, removed });

  switch (topology) {
    case "parallel":
      return [
        { id: "1", bulbs: [socket("A", unscrewed)] },
        { id: "2", bulbs: [socket("B", false)] },
      ];
    case "combination":
      return [
        { id: "1", bulbs: [socket("A", unscrewed), socket("B", false)] },
        { id: "2", bulbs: [socket("C", false)] },
      ];
    case "series":
    default:
      return [{ id: "1", bulbs: [socket("A", unscrewed), socket("B", false)] }];
  }
}

/** Worked arithmetic for the equivalent resistance, for the readout to print. */
function workedFormula(topology, branches, bulbR, networkR) {
  const R = Math.max(bulbR, 0.1).toFixed(1);
  const eq = Number.isFinite(networkR) ? `${networkR.toFixed(2)} Ω` : "∞ (open)";
  switch (topology) {
    case "parallel":
      return `1/${R} + 1/${R} → R_eq = ${eq}`;
    case "combination":
      return `(${R} + ${R}) ∥ ${R} → R_eq = ${eq}`;
    case "series":
    default:
      return `${R} + ${R} = ${eq}`;
  }
}

/**
 * The whole circuit, from the sliders to every meter reading on the board.
 *
 * Brightness is reported as a fraction of what the bulb would do with the
 * FULL supply voltage across it, not against a fixed wattage rating. That
 * makes the comparison the scene is for read correctly at any slider setting:
 * a series bulb sits at half the supply and therefore a quarter of the power,
 * and shows 25% however the voltage and resistance are set.
 */
export function solveCircuit({
  topology = "series",
  voltage = 6,
  bulbR = 10,
  unscrewed = false,
  shorted = false,
} = {}) {
  const emf = Math.max(voltage, 0);
  const R = Math.max(bulbR, 0.1);
  const spec = TOPOLOGIES[topology] ?? TOPOLOGIES.series;
  const branches = branchesFor(topology, R, unscrewed);

  const branchR = branches.map((b) =>
    b.bulbs.reduce((sum, bulb) => sum + bulb.resistance, 0),
  );
  const networkR = branches.length === 1 ? branchR[0] : parallelAll(branchR);

  // The jumper sits across the same two rails the bulb network does, so it is
  // simply one more parallel path — and a near-zero one, which is exactly why
  // it steals the current and leaves the bulbs dark.
  const externalR = shorted ? parallelPair(networkR, SHORT_R) : networkR;
  const dead = !Number.isFinite(externalR);

  const circuitR = dead ? Infinity : externalR + BATTERY_INTERNAL_R + WIRE_R;
  const totalCurrent = dead ? 0 : emf / circuitR;
  const terminalVoltage = emf - totalCurrent * BATTERY_INTERNAL_R;
  // Volts across the bulb network. Open circuit puts the whole emf across the
  // gap and none across the bulbs, which is the correct reading on both meters.
  const networkVoltage = dead ? 0 : totalCurrent * externalR;

  // Full-voltage power, the reference every brightness is quoted against.
  const powerAtFullVolts = (emf * emf) / R;

  const solvedBranches = branches.map((b, i) => {
    const resistance = branchR[i];
    const current = Number.isFinite(resistance) && resistance > 0 ? networkVoltage / resistance : 0;
    return { id: b.id, resistance, current, open: !Number.isFinite(resistance) };
  });

  const bulbs = [];
  branches.forEach((b, i) => {
    for (const socket of b.bulbs) {
      const current = solvedBranches[i].current;
      const drop = socket.removed ? 0 : current * socket.resistance;
      const power = socket.removed ? 0 : current * current * socket.resistance;
      const brightness = powerAtFullVolts > 0 ? Math.min(power / powerAtFullVolts, 1) : 0;
      bulbs.push({
        id: socket.id,
        branch: b.id,
        resistance: socket.removed ? Infinity : socket.resistance,
        removed: socket.removed,
        current,
        voltage: drop,
        power,
        brightness,
        lit: brightness > 0.015,
      });
    }
  });

  const shortCurrent = shorted && !dead ? networkVoltage / SHORT_R : 0;
  const internalLoss = totalCurrent * totalCurrent * BATTERY_INTERNAL_R;

  return {
    topology,
    spec,
    emf,
    bulbR: R,
    unscrewed,
    shorted,
    /** R_eq of the bulb network alone — the number the formula predicts. */
    networkR,
    /** Including the short, if one is fitted. */
    externalR,
    circuitR,
    totalCurrent,
    terminalVoltage,
    networkVoltage,
    shortCurrent,
    powerAtFullVolts,
    branches: solvedBranches,
    bulbs,
    /** No current anywhere — the loop is genuinely broken. */
    dead,
    /** No bulb is lit, whether from an open loop or from a short. */
    allDark: bulbs.every((b) => !b.lit),
    overCurrent: totalCurrent > FUSE_A,
    internalLoss,
    batteryPower: emf * totalCurrent,
    formula: spec.formula,
    worked: workedFormula(topology, branches, R, networkR),
  };
}

// ─── Board layout and conductor splitting ───────────────────────────

/**
 * Which bulbs sit on which row of the board, per topology.
 *
 * Row order matches the branch order `branchesFor` produces — row 0 is
 * branch 1 — so a row and its solved current share an index. Which row the
 * rails REACH first is a different question, and `buildConductors` sorts for
 * it. `x` and `z` are in the scene's own board units.
 */
export const BOARD_ROWS = {
  series: [{ z: -1.3, bulbs: [{ id: "A", x: -1.4 }, { id: "B", x: 1.4 }] }],
  parallel: [
    { z: -2.2, bulbs: [{ id: "A", x: 0 }] },
    { z: -0.4, bulbs: [{ id: "B", x: 0 }] },
  ],
  combination: [
    { z: -2.2, bulbs: [{ id: "A", x: -1.4 }, { id: "B", x: 1.4 }] },
    { z: -0.4, bulbs: [{ id: "C", x: 0 }] },
  ],
};

/**
 * Every conductor on the board, cut at the junctions, each with the current
 * that piece actually carries.
 *
 * This is the junction rule expressed as geometry. A rail is not one wire
 * carrying "the current" — it is a series of pieces, and each time a branch
 * taps off, the piece beyond it carries less. The scene draws one stream of
 * electrons per piece at a speed set by that piece's current, so a student
 * watching the parallel board sees the supply rail running fast and each
 * branch running slower, and the sum is visible rather than asserted.
 *
 * The short circuit is built as simply one more tap, because that is what it
 * is: a parallel branch with a hundredth of an ohm in it.
 */
export function buildConductors(solved, geometry = {}) {
  const {
    railX = 3.5,
    batteryZ = 2.5,
    terminalX = 0.9,
    shortZ = 1.35,
    y = 0.12,
  } = geometry;

  const rows = BOARD_ROWS[solved.topology] ?? BOARD_ROWS.series;

  const taps = [];
  if (solved.shorted) {
    taps.push({ key: "short", z: shortZ, current: solved.shortCurrent, kind: "short", open: false });
  }
  rows.forEach((row, i) => {
    const branch = solved.branches[i];
    taps.push({
      key: `branch-${i}`,
      z: row.z,
      current: branch?.current ?? 0,
      kind: "branch",
      open: branch?.open ?? false,
    });
  });

  // The rails run from the battery at +z towards −z, so the tap with the
  // largest z is reached first and everything below it is still downstream.
  taps.sort((a, b) => b.z - a.z);

  // What each rail piece still has to carry: the sum of every tap from here on.
  const remaining = taps.map((_, i) =>
    taps.slice(i).reduce((sum, t) => sum + (Number.isFinite(t.current) ? t.current : 0), 0),
  );

  const segments = [];
  taps.forEach((tap, i) => {
    const from = i === 0 ? batteryZ : taps[i - 1].z;

    segments.push({
      key: `left-${tap.key}`,
      current: remaining[i],
      kind: "rail",
      open: false,
      points:
        i === 0
          ? [
              [-terminalX, y, batteryZ],
              [-railX, y, batteryZ],
              [-railX, y, tap.z],
            ]
          : [
              [-railX, y, from],
              [-railX, y, tap.z],
            ],
    });

    segments.push({
      key: `across-${tap.key}`,
      current: tap.current,
      kind: tap.kind,
      open: tap.open,
      points: [
        [-railX, y, tap.z],
        [railX, y, tap.z],
      ],
    });

    segments.push({
      key: `right-${tap.key}`,
      current: remaining[i],
      kind: "rail",
      open: false,
      points:
        i === 0
          ? [
              [railX, y, tap.z],
              [railX, y, batteryZ],
              [terminalX, y, batteryZ],
            ]
          : [
              [railX, y, tap.z],
              [railX, y, from],
            ],
    });
  });

  return { rows, segments, taps };
}

/**
 * How fast the drift electrons should be drawn, in world units per second.
 *
 * Deliberately proportional to current rather than to anything else: the
 * scene keeps the carrier SPACING fixed and varies only their speed, because
 * that is what actually happens in a wire. Charge density in copper is set by
 * the metal, so a bigger current is the same electrons moving faster.
 */
export function driftSpeed(current, { scale = 0.75, max = 4.5 } = {}) {
  if (!Number.isFinite(current) || current <= 0) return 0;
  return Math.min(current * scale, max);
}

/**
 * Filament colour temperature as a fraction of full brightness.
 *
 * Returns a 0–1 position along cold-iron → dull red → orange → white, so a
 * dim bulb reads as a cooler filament rather than simply a fainter white one.
 * A filament at a quarter of its power really is visibly redder.
 */
export function filamentHeat(brightness) {
  return Math.pow(Math.max(brightness, 0), 0.45);
}

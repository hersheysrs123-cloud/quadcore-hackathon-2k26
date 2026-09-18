// ─── Atomic structure ───────────────────────────────────────────────
// The four elements on the Bohr scene's element picker, and the shell
// rules they are drawn from.
//
// This lives in lib/ so the scene and the Details panel read the same
// table. They used to hold one copy each, and the copies disagreed: the
// panel's note had branches for sodium and chlorine and fell through to
// the carbon explanation for everything else, so picking hydrogen printed
// "Carbon shares 4 valence electrons via covalent bonds."
// ─────────────────────────────────────────────────────────────────────

export const SHELL_NAMES = ["K", "L", "M", "N"];

/**
 * The 2, 8, 8 rule taught for the first twenty elements — not the full 2n².
 * The N shell's 2 is calcium's, not its true capacity.
 */
export const SHELL_CAPACITY = [2, 8, 8, 2];

/**
 * Colours the scene actually draws with. The Details panel keys off these
 * rather than its own literals, because a colour key that names a colour
 * nothing on screen uses is worse than no colour key at all.
 */
export const ATOM_COLOURS = {
  proton: "#fb7185",
  neutron: "#8a92a0",
  electron: "#38bdf8",
  valence: "#fbbf24",
};

export const ELEMENTS = {
  H: {
    symbol: "H",
    name: "Hydrogen",
    protons: 1,
    neutrons: 0,
    shells: [1],
    group: "1",
    bonding: "One electron short of a full K shell — shares a pair to form H₂ or HCl.",
    reaction: "Hydrogen shares its single electron to complete the K shell, as in H₂ or HCl.",
  },
  C: {
    symbol: "C",
    name: "Carbon",
    protons: 6,
    neutrons: 6,
    shells: [2, 4],
    group: "4",
    bonding: "Four valence electrons, so it shares all four in covalent bonds (CH₄, CO₂).",
    reaction: "Carbon shares all four valence electrons in covalent bonds.",
  },
  Na: {
    symbol: "Na",
    name: "Sodium",
    protons: 11,
    neutrons: 12,
    shells: [2, 8, 1],
    group: "1",
    bonding: "Loses its single outer electron to form Na⁺, exposing a full shell beneath.",
    reaction: "Sodium loses 1 electron to form Na⁺ (2,8).",
  },
  Cl: {
    symbol: "Cl",
    name: "Chlorine",
    protons: 17,
    neutrons: 18,
    shells: [2, 8, 7],
    group: "7",
    bonding: "Gains one electron to complete its outer shell, forming Cl⁻.",
    reaction: "Chlorine gains 1 electron to form Cl⁻ (2,8,8).",
  },
};

export const elementFor = (symbol) => ELEMENTS[symbol] ?? ELEMENTS.Na;

/** Everything a readout wants about a neutral atom of `symbol`. */
export function describeAtom(symbol) {
  const el = elementFor(symbol);
  const outerIndex = el.shells.length - 1;
  const valence = el.shells[outerIndex];
  const capacity = SHELL_CAPACITY[outerIndex];
  return {
    ...el,
    outerIndex,
    valence,
    capacity,
    /** A neutral atom has as many electrons as protons. */
    electrons: el.protons,
    massNumber: el.protons + el.neutrons,
    configuration: el.shells.join(","),
    full: valence === capacity,
    period: el.shells.length,
    shellName: SHELL_NAMES[outerIndex],
  };
}

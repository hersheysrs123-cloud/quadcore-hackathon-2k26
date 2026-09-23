// ─── Atomic structure ───────────────────────────────────────────────
// The twenty elements on the Bohr scene's element picker (H to Ca), and
// the shell rules they are drawn from.
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

/** One row of the table; neutrons are the most abundant isotope's. */
const el = (symbol, name, protons, neutrons, shells, group, bonding, reaction) => ({
  symbol, name, protons, neutrons, shells, group, bonding, reaction,
});

// The first twenty — exactly the elements the 2,8,8,2 rule describes.
// Group "0" is the noble gases, as the syllabus names them.
export const ELEMENTS = {
  H: el("H", "Hydrogen", 1, 0, [1], "1",
    "One electron short of a full K shell — shares a pair to form H₂ or HCl.",
    "Hydrogen shares its single electron to complete the K shell, as in H₂ or HCl."),
  He: el("He", "Helium", 2, 2, [2], "0",
    "Its only shell, K, is already full with 2 — nothing to gain, lose or share.",
    "Helium's K shell is already full, so it does not react."),
  Li: el("Li", "Lithium", 3, 4, [2, 1], "1",
    "A lone electron in the L shell, easily lost to leave Li⁺ with a full K shell.",
    "Lithium loses 1 electron to form Li⁺ (2)."),
  Be: el("Be", "Beryllium", 4, 5, [2, 2], "2",
    "Two outer electrons; loses both to form Be²⁺, though its small size makes it bond partly covalently.",
    "Beryllium loses 2 electrons to form Be²⁺ (2)."),
  B: el("B", "Boron", 5, 6, [2, 3], "3",
    "Three outer electrons, shared in three covalent bonds (BF₃) rather than lost.",
    "Boron shares its 3 valence electrons in covalent bonds, as in BF₃."),
  C: el("C", "Carbon", 6, 6, [2, 4], "4",
    "Four valence electrons, so it shares all four in covalent bonds (CH₄, CO₂).",
    "Carbon shares all four valence electrons in covalent bonds."),
  N: el("N", "Nitrogen", 7, 7, [2, 5], "5",
    "Five outer electrons: shares three to make NH₃ or N₂, or gains three as N³⁻.",
    "Nitrogen shares 3 electrons (NH₃, N≡N) or gains 3 to form N³⁻ (2,8)."),
  O: el("O", "Oxygen", 8, 8, [2, 6], "6",
    "Two short of an octet — gains two as O²⁻ or shares two, as in H₂O.",
    "Oxygen gains 2 electrons to form O²⁻ (2,8), or shares 2 as in H₂O."),
  F: el("F", "Fluorine", 9, 10, [2, 7], "7",
    "One short of an octet and very strongly pulls one in — the most reactive non-metal.",
    "Fluorine gains 1 electron to form F⁻ (2,8)."),
  Ne: el("Ne", "Neon", 10, 10, [2, 8], "0",
    "A full L shell of 8 — a stable octet, so it forms no compounds.",
    "Neon already has a full outer shell (2,8), so it does not react."),
  Na: el("Na", "Sodium", 11, 12, [2, 8, 1], "1",
    "Loses its single outer electron to form Na⁺, exposing a full shell beneath.",
    "Sodium loses 1 electron to form Na⁺ (2,8)."),
  Mg: el("Mg", "Magnesium", 12, 12, [2, 8, 2], "2",
    "Loses its two outer electrons to form Mg²⁺, as in MgO.",
    "Magnesium loses 2 electrons to form Mg²⁺ (2,8)."),
  Al: el("Al", "Aluminium", 13, 14, [2, 8, 3], "3",
    "Loses its three outer electrons to form Al³⁺, as in Al₂O₃.",
    "Aluminium loses 3 electrons to form Al³⁺ (2,8)."),
  Si: el("Si", "Silicon", 14, 14, [2, 8, 4], "4",
    "Like carbon, shares all four outer electrons — in a giant covalent lattice in SiO₂.",
    "Silicon shares all 4 valence electrons in covalent bonds, as in SiO₂."),
  P: el("P", "Phosphorus", 15, 16, [2, 8, 5], "5",
    "Five outer electrons; shares three to make PCl₃ or PH₃.",
    "Phosphorus shares 3 electrons in covalent bonds (PCl₃) or gains 3 to form P³⁻ (2,8,8)."),
  S: el("S", "Sulfur", 16, 16, [2, 8, 6], "6",
    "Two short of an octet — gains two as S²⁻ or shares two, as in H₂S.",
    "Sulfur gains 2 electrons to form S²⁻ (2,8,8), or shares 2 as in H₂S."),
  Cl: el("Cl", "Chlorine", 17, 18, [2, 8, 7], "7",
    "Gains one electron to complete its outer shell, forming Cl⁻.",
    "Chlorine gains 1 electron to form Cl⁻ (2,8,8)."),
  Ar: el("Ar", "Argon", 18, 22, [2, 8, 8], "0",
    "A full M shell of 8 — a stable octet, which is why it is used as an inert gas.",
    "Argon already has a stable outer octet (2,8,8), so it does not react."),
  K: el("K", "Potassium", 19, 20, [2, 8, 8, 1], "1",
    "One electron in the N shell, far from the nucleus — lost even more easily than sodium's.",
    "Potassium loses 1 electron to form K⁺ (2,8,8)."),
  Ca: el("Ca", "Calcium", 20, 20, [2, 8, 8, 2], "2",
    "Loses its two N-shell electrons to form Ca²⁺, as in CaCO₃.",
    "Calcium loses 2 electrons to form Ca²⁺ (2,8,8)."),
};

export const elementFor = (symbol) => ELEMENTS[symbol] ?? ELEMENTS.Na;

/** Everything a readout wants about a neutral atom of `symbol`. */
export function describeAtom(symbol) {
  const el = elementFor(symbol);
  const outerIndex = el.shells.length - 1;
  const valence = el.shells[outerIndex];
  // What the outer shell is aiming for: a duet in K, otherwise an octet.
  // Not SHELL_CAPACITY — its N-shell 2 is calcium's count, and a "full"
  // calcium would contradict it reacting to become Ca²⁺.
  const capacity = outerIndex === 0 ? 2 : 8;
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

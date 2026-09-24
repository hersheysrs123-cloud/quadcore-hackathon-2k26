// ─── Giant structures ───────────────────────────────────────────────
// The facts and the colour key for each lattice the crystal scene builds.
//
// Shared so the Details panel cannot key a colour the scene never draws.
// It used to: the graphite key named a "Delocalised Electron" and an
// "Interlayer Force" and the scene drew neither — the gold it pointed at was
// actually the middle layer's carbon atoms, coloured so the shear is visible.
// Both are now drawn, because they are the two facts graphite is taught for.
// Bond entries were also keyed #38bdf8 against bonds drawn #3f4854.
// ─────────────────────────────────────────────────────────────────────

/** The one colour every bond in the lattice scene is drawn with. */
export const BOND_COLOUR = "#3f4854";

export const LATTICE_FACTS = {
  nacl: {
    title: "Sodium chloride (NaCl)",
    type: "Giant ionic lattice",
    rows: [
      ["Structure", "face-centred cubic", "gold"],
      ["Bonding", "electrostatic attraction", "good"],
      ["Melting point", "801 °C — high", "good"],
      ["Solid conducts", "no — the ions are locked in place"],
      ["Molten / aqueous conducts", "yes — the ions are free to move", "good"],
    ],
    note: "Na⁺ and Cl⁻ alternate in every direction. Strong attraction in all directions means a high melting point, and it only conducts once the ions are free to move.",
  },
  diamond: {
    title: "Diamond",
    type: "Giant covalent network",
    rows: [
      ["Structure", "tetrahedral carbon", "gold"],
      ["Bonds per carbon", "4 single covalent bonds"],
      ["Hardness", "extremely hard — 10 on Mohs", "good"],
      ["Melting point", "3550 °C"],
      ["Conducts", "no — every outer electron is in a bond"],
    ],
    note: "Every carbon is covalently bonded to four others in a rigid tetrahedral network — extremely hard, and no free electrons, so it does not conduct.",
  },
  graphite: {
    title: "Graphite",
    type: "Giant covalent, in layers",
    rows: [
      ["Structure", "hexagonal sheets", "gold"],
      ["Bonds per carbon", "3 — one electron left over"],
      ["Delocalised electrons", "1 per carbon", "good"],
      ["Conducts", "yes, along the layers", "good"],
      ["Between the layers", "weak forces — they slide"],
    ],
    note: "Three bonds per carbon leaves one delocalised electron, so graphite conducts. Weak forces between layers let them slide, which is why it lubricates.",
  },
  quartz: {
    title: "Quartz (silicon dioxide)",
    type: "Giant covalent network",
    rows: [
      ["Structure", "tetrahedral silica", "gold"],
      ["Formula", "SiO₂"],
      ["Ratio", "1 silicon : 2 oxygen, throughout the structure"],
      ["Melting point", "1710 °C — high", "good"],
      ["Conducts", "no"],
    ],
    note: "Each silicon is bonded to four oxygens and each oxygen bridges two silicons, on and on in every direction. Extremely hard, with a high melting point, because melting it means breaking covalent bonds. The SiO₄ tetrahedra link into spirals up the crystal — which is why quartz crystals come left- and right-handed. What is drawn is a fragment, so the silicons at its surface are short of their four — in the real solid none of them are.",
  },
  ice: {
    title: "Ice (H₂O)",
    type: "Molecular crystal",
    rows: [
      ["Structure", "open hexagonal cage", "gold"],
      ["Within a molecule", "covalent O–H bonds"],
      ["Between molecules", "hydrogen bonds"],
      ["Melting point", "0 °C — low"],
      ["Density", "lower than liquid water", "warn"],
    ],
    note: "Hydrogen bonds hold the water molecules in an open cage with more empty space than the liquid has — which is why ice is less dense, and why it floats.",
  },
};

export const LATTICE_KEYS = {
  nacl: [
    { color: "#fbbf24", shape: "dot", label: "Na⁺ ion", note: "smaller — it lost an electron" },
    { color: "#34d399", shape: "dot", label: "Cl⁻ ion", note: "larger — it gained one" },
    { color: BOND_COLOUR, shape: "line", label: "Electrostatic attraction", note: "strong, and pulling in every direction" },
  ],
  diamond: [
    { color: "#94a3b8", shape: "dot", label: "Carbon atom", note: "bonded to four others, tetrahedrally" },
    { color: BOND_COLOUR, shape: "line", label: "Covalent bond", note: "all four outer electrons used — none left to conduct" },
  ],
  graphite: [
    { color: "#fbbf24", shape: "dot", label: "Carbon in the middle layer", note: "picked out in gold so the slide is easy to follow" },
    { color: "#94a3b8", shape: "dot", label: "Carbon in the outer layers" },
    { color: BOND_COLOUR, shape: "line", label: "Covalent bond within a layer", note: "three per carbon — strong, and never broken by sliding" },
    { color: "#fbbf24", shape: "dot", label: "Delocalised electron", note: "the fourth electron, free to drift ALONG a layer — this is what conducts" },
    { color: "#38bdf8", shape: "line", label: "Force between the layers", note: "weak only — drag the slider and the sheets shear apart" },
  ],
  quartz: [
    { color: "#fbbf24", shape: "dot", label: "Silicon atom (Si)", note: "four bonds, tetrahedrally arranged" },
    { color: "#fb7185", shape: "dot", label: "Oxygen atom (O)", note: "bridges two silicon atoms" },
    { color: BOND_COLOUR, shape: "line", label: "Si–O covalent bond" },
  ],
  ice: [
    { color: "#fb7185", shape: "dot", label: "Oxygen atom (O)" },
    { color: "#e8ebf0", shape: "dot", label: "Hydrogen atom (H)" },
    { color: "#38bdf8", shape: "line", label: "Hydrogen bond", note: "between molecules — weak, and what holds the cage open" },
  ],
};

export const latticeFactsFor = (structure) => LATTICE_FACTS[structure] ?? LATTICE_FACTS.nacl;
export const latticeKeyFor = (structure) => LATTICE_KEYS[structure] ?? LATTICE_KEYS.nacl;

// ─── Organic homologous series ──────────────────────────────────────
// Names, formulae and the facts that go with them for the six series the
// isomer builder draws.
//
// Shared because the Details panel had its own copy and it was wrong in
// two ways at once. It handled alkane/alkene/alkyne/alcohol and fell
// through to the alkane formula for everything else, so propanoic acid
// printed as "C3H8" — propane. And it decided saturation with
// `family === "alkane"`, which reported ethanol, ethanoic acid and ethyl
// ethanoate as unsaturated AND as decolourising bromine water. They do
// not: that test is for C=C and C≡C, and it is exactly the distinction
// the topic's own second quiz question asks about.
// ─────────────────────────────────────────────────────────────────────

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

/** "C₃H₈" — a subscript, or nothing at all for one. */
export const sub = (n) => (n <= 1 ? "" : String(n).replace(/\d/g, (d) => SUBSCRIPTS[Number(d)]));

export const CHAIN_NAMES = [
  "meth", "eth", "prop", "but", "pent", "hex", "hept", "oct", "non", "dec", "undec", "dodec",
];

export const MAX_CARBONS = CHAIN_NAMES.length;

/** Colours the scene draws bonds and atoms with, so the key can name them. */
export const ORGANIC_COLOURS = {
  carbon: "#475569",
  hydrogen: "#e8ebf0",
  oxygen: "#fb7185",
  single: "#3f4854",
  double: "#fbbf24",
  triple: "#38bdf8",
};

/**
 * The six series. `minCarbons` is what the series needs to exist at all —
 * there is no such thing as a one-carbon alkene.
 *
 * `saturated` means "only single bonds between carbons", which is the thing
 * bromine water tests for. An alcohol, a carboxylic acid and an ester are
 * all saturated: they carry oxygen, not a C=C.
 */
export const FAMILIES = {
  alkane: {
    key: "alkane",
    label: "Alkane",
    general: "CₙH₂ₙ₊₂",
    saturated: true,
    minCarbons: 1,
    functionalGroup: null,
    note: "Each member differs by CH₂, so properties change gradually down the series.",
  },
  alkene: {
    key: "alkene",
    label: "Alkene",
    general: "CₙH₂ₙ",
    saturated: false,
    unsaturation: "C=C",
    minCarbons: 2,
    functionalGroup: "C=C (double bond)",
    note: "The C=C double bond decolourises bromine water — the standard test for unsaturation.",
  },
  alkyne: {
    key: "alkyne",
    label: "Alkyne",
    general: "CₙH₂ₙ₋₂",
    saturated: false,
    unsaturation: "C≡C",
    minCarbons: 2,
    functionalGroup: "C≡C (triple bond)",
    note: "The C≡C triple bond makes alkynes very reactive; ethyne (acetylene) is used in welding torches.",
  },
  alcohol: {
    key: "alcohol",
    label: "Alcohol",
    general: "CₙH₂ₙ₊₁OH",
    saturated: true,
    minCarbons: 1,
    functionalGroup: "–OH (hydroxyl)",
    note: "The –OH group makes alcohols soluble in water and is what oxidises to a carboxylic acid.",
  },
  acid: {
    key: "acid",
    label: "Carboxylic acid",
    general: "CₙH₂ₙO₂ (RCOOH)",
    saturated: true,
    minCarbons: 1,
    functionalGroup: "–COOH (carboxyl)",
    note: "Carboxylic acids have –COOH: a carbonyl C=O and a hydroxyl –OH on the same carbon. They are weak acids.",
  },
  ester: {
    key: "ester",
    label: "Ester",
    general: "RCOO–R′",
    saturated: true,
    minCarbons: 1,
    functionalGroup: "–COO– (ester linkage)",
    note: "Esters form from an acid plus an alcohol (condensation). The –COO– linkage gives fruits their characteristic smells.",
  },
};

export const familyFor = (key) => FAMILIES[key] ?? FAMILIES.alkane;

/** Is this family/length combination a molecule that exists? */
export const isValid = (family, n) => n >= familyFor(family).minCarbons && n <= MAX_CARBONS;

/**
 * Atom counts for the molecule the scene builds.
 *
 * The ester is the one that needs saying out loud: the builder always makes
 * an n-carbon acyl chain esterified with a METHYL group, so it carries n + 1
 * carbons in total. Naming it from a fixed table indexed by n — which is what
 * used to happen — labelled methyl propanoate "ethyl methanoate".
 */
export function atomCounts(family, carbons) {
  const n = Math.max(1, Math.min(MAX_CARBONS, Math.round(carbons)));
  switch (family) {
    case "alkene":  return { c: n, h: 2 * n, o: 0 };
    case "alkyne":  return { c: n, h: 2 * n - 2, o: 0 };
    case "alcohol": return { c: n, h: 2 * n + 2, o: 1 };
    case "acid":    return { c: n, h: 2 * n, o: 2 };
    case "ester":   return { c: n + 1, h: 2 * n + 2, o: 2 };
    default:        return { c: n, h: 2 * n + 2, o: 0 };
  }
}

/** "C₂H₅OH", "C₃H₆O₂" — in the subscripts the rest of the panel uses. */
export function formulaFor(family, carbons) {
  const n = Math.max(1, Math.min(MAX_CARBONS, Math.round(carbons)));
  if (!isValid(family, n)) return "—";
  const { c, h, o } = atomCounts(family, n);
  // Alcohols are conventionally written with the –OH spelled out.
  if (family === "alcohol") return `C${sub(c)}H${sub(h - 1)}OH`;
  if (o > 0) return `C${sub(c)}H${sub(h)}O${sub(o)}`;
  return `C${sub(c)}H${sub(h)}`;
}

/** "propan-1-ol", "methyl propanoate", "ethene". */
export function nameFor(family, carbons) {
  const n = Math.max(1, Math.min(MAX_CARBONS, Math.round(carbons)));
  const stem = CHAIN_NAMES[n - 1];
  if (!isValid(family, n)) return `needs ${familyFor(family).minCarbons}+ carbons for this series`;
  switch (family) {
    case "alkene":  return `${stem}ene`;
    case "alkyne":  return `${stem}yne`;
    case "alcohol": return `${stem}anol`;
    case "acid":    return `${stem}anoic acid`;
    // Named from the molecule that is actually built: an n-carbon acyl chain
    // with a methyl on the far side of the ester oxygen.
    case "ester":   return `methyl ${stem}anoate`;
    default:        return `${stem}ane`;
  }
}

/** Cracking only makes sense for an alkane long enough to break in two. */
export const isCrackable = (family, carbons) => family === "alkane" && carbons >= 3;

/** Carbons that leave in the alkene. Two is the ethene the syllabus uses. */
export const CRACK_ALKENE_CARBONS = 2;

/**
 * What an alkane cracks INTO.
 *
 * CₙH₂ₙ₊₂ → C₍ₙ₋₂₎H₂₍ₙ₋₂₎₊₂ + C₂H₄, which balances: n − 2 + 2 carbons, and
 * (2n − 4 + 2) + 4 = 2n + 2 hydrogens. Propane gives methane and ethene;
 * decane gives octane and ethene, which is the example in the syllabus.
 *
 * This exists because the scene used to "crack" by sliding two halves of the
 * SAME molecule apart. No bond ever became a double bond, no hydrogen moved,
 * and both fragments were left as radicals — while the readout beside it
 * promised "a shorter alkane plus a useful alkene".
 */
export function crackProducts(carbons) {
  const n = Math.max(1, Math.min(MAX_CARBONS, Math.round(carbons)));
  if (!isCrackable("alkane", n)) return null;
  const alkaneCarbons = n - CRACK_ALKENE_CARBONS;
  const alkane = {
    family: "alkane",
    carbons: alkaneCarbons,
    formula: formulaFor("alkane", alkaneCarbons),
    name: nameFor("alkane", alkaneCarbons),
  };
  const alkene = {
    family: "alkene",
    carbons: CRACK_ALKENE_CARBONS,
    formula: formulaFor("alkene", CRACK_ALKENE_CARBONS),
    name: nameFor("alkene", CRACK_ALKENE_CARBONS),
  };
  return {
    reactant: { family: "alkane", carbons: n, formula: formulaFor("alkane", n), name: nameFor("alkane", n) },
    alkane,
    alkene,
    equation: `${formulaFor("alkane", n)} → ${alkane.formula} + ${alkene.formula}`,
    wordEquation: `${nameFor("alkane", n)} → ${alkane.name} + ${alkene.name}`,
  };
}

/** Everything a readout wants from the two controls. */
export function describeMolecule(family, carbons) {
  const f = familyFor(family);
  const n = Math.max(1, Math.min(MAX_CARBONS, Math.round(carbons)));
  const valid = isValid(family, n);
  return {
    family: f.key,
    label: f.label,
    minCarbons: f.minCarbons,
    carbons: n,
    valid,
    formula: formulaFor(family, n),
    name: nameFor(family, n),
    general: f.general,
    saturated: f.saturated,
    unsaturation: f.unsaturation ?? null,
    functionalGroup: f.functionalGroup,
    /** Bromine water is decolourised by C=C and C≡C — and by nothing else here. */
    decolourisesBromine: !f.saturated,
    crackable: isCrackable(family, n),
    note: f.note,
    counts: atomCounts(family, n),
  };
}

// ─── Absorption in the small intestine ──────────────────────────────
// Where digested food leaves the gut. By the time chyme reaches the ileum,
// starch is glucose, protein is amino acids and fat is fatty acids and
// glycerol (monoglycerides), and each crosses the lining a different way
// and goes a different way afterwards:
//
//   glucose       actively, with sodium, through SGLT1 in the brush border;
//                 out the far side by facilitated diffusion (GLUT2); into
//                 the villus's blood capillaries → hepatic portal vein → liver
//   amino acids   actively, with sodium; out into the same capillaries
//   fats          diffuse straight through the membrane from bile's micelles,
//                 are built back into triglycerides inside the cell, packed
//                 into chylomicrons — too big for a blood capillary — and
//                 leave into the lacteal: lymph → thoracic duct → the blood
//                 at the left subclavian vein, bypassing the liver
//
// The lining is folded three times over to make room for all of it: the
// circular folds (plicae circulares), the villi on them and the microvilli
// on every cell of the villi. The classic textbook multipliers, against a
// smooth tube of the same length, are ×3, ×10 and ×20. Measured carefully
// (Helander & Fändriks, 2014) the whole adult small intestine has about
// 30 m² of mucosa, microvilli included — half a badminton court, not the
// tennis court older books quote.
//
// Coeliac disease is what the multipliers mean. Gluten sets off an immune
// attack on the lining; the villi shrink to stubs (villous atrophy) and the
// brush border is damaged, so most of the area is gone and much of the food
// passes on unabsorbed — fat most visibly (steatorrhoea), and iron and
// folate, which are absorbed high up where the damage is worst.
// ─────────────────────────────────────────────────────────────────────

export const NUTRIENTS = {
  glucose: {
    label: "Glucose",
    formula: "C₆H₁₂O₆",
    from: "starch, by amylase then maltase",
    route: "blood",
    across: "active transport with Na⁺ (SGLT1)",
    out: "facilitated diffusion (GLUT2) into the capillaries",
    colour: "#fbbf24",
  },
  aminoAcids: {
    label: "Amino acids",
    formula: "H₂N–CHR–COOH",
    from: "protein, by pepsin, trypsin and peptidases",
    route: "blood",
    across: "active transport with Na⁺",
    out: "into the capillaries",
    colour: "#38bdf8",
  },
  fats: {
    label: "Fatty acids & glycerol",
    formula: "R–COOH + C₃H₈O₃",
    from: "fat, emulsified by bile, digested by lipase",
    route: "lymph",
    across: "diffusion through the membrane, out of bile's micelles",
    out: "rebuilt into fat, packed into chylomicrons, into the lacteal",
    colour: "#bef264",
  },
};

export const NUTRIENT_KEYS = Object.keys(NUTRIENTS);

/** Where each route goes next. */
export const ROUTES = {
  blood: { label: "Blood capillaries", next: "hepatic portal vein → liver", colour: "#e11d48" },
  lymph: { label: "Lacteal", next: "lymph → thoracic duct → left subclavian vein", colour: "#f6ead2" },
};

/** What reaches the ileum after three meals, as shares of the digested food (by number of molecules shown). */
export const MEALS = {
  balanced: { label: "Balanced meal", share: { glucose: 0.5, aminoAcids: 0.25, fats: 0.25 }, note: "half glucose, the rest amino acids and fat" },
  starchy: { label: "Pasta · starchy", share: { glucose: 0.72, aminoAcids: 0.16, fats: 0.12 }, note: "mostly glucose, so most of it goes into the capillaries" },
  fatty: { label: "Fried breakfast · fatty", share: { glucose: 0.22, aminoAcids: 0.26, fats: 0.52 }, note: "mostly fat, so half of it goes into the lacteal as chylomicrons" },
};

/** The three foldings, textbook multipliers of the area of a smooth tube. */
export const FOLDINGS = [
  { key: "folds", label: "Circular folds", factor: 3 },
  { key: "villi", label: "Villi", factor: 10 },
  { key: "microvilli", label: "Microvilli", factor: 20 },
];

export const GUT_CONDITIONS = {
  healthy: {
    label: "Healthy lining",
    short: "healthy",
    villusHeight: 1,
    factors: { folds: 3, villi: 10, microvilli: 20 },
  },
  coeliac: {
    label: "Coeliac disease · villous atrophy",
    short: "coeliac",
    // Marsh 3: villi flattened to low stubs, crypts lengthened, brush border damaged.
    villusHeight: 0.22,
    factors: { folds: 3, villi: 2.5, microvilli: 9 },
  },
};

/** Measured mucosal area of a healthy adult small intestine, m² (Helander & Fändriks 2014). */
export const MEASURED_AREA_M2 = 30;

/**
 * Fraction of the food presented that this stretch of gut absorbs, as a
 * function of the total area multiplier: 1 − e^(−k·area). k is set so a
 * healthy lining takes up 98 % — almost nothing absorbable reaches the
 * large intestine.
 */
export const UPTAKE_PER_AREA = -Math.log(1 - 0.98) / (3 * 10 * 20);

/** The total area multiplier, against a smooth tube. */
export function areaMultiplier(condition) {
  const f = (GUT_CONDITIONS[condition] ?? GUT_CONDITIONS.healthy).factors;
  return f.folds * f.villi * f.microvilli;
}

export function absorbedFraction(condition) {
  return 1 - Math.exp(-UPTAKE_PER_AREA * areaMultiplier(condition));
}

/**
 * Everything the villus scene and its readout need: per nutrient, its
 * share of the meal, how much of that is absorbed, and which way it goes.
 * Rates are relative (molecules a second on screen), shares sum to 1.
 */
export function solveAbsorption({ meal = "balanced", condition = "healthy" } = {}) {
  const m = MEALS[meal] ?? MEALS.balanced;
  const c = GUT_CONDITIONS[condition] ?? GUT_CONDITIONS.healthy;
  const area = areaMultiplier(condition);
  const absorbed = absorbedFraction(condition);
  const nutrients = NUTRIENT_KEYS.map((key) => {
    const n = NUTRIENTS[key];
    const share = m.share[key];
    return { key, ...n, share, absorbed: share * absorbed, lost: share * (1 - absorbed) };
  });
  const toBlood = nutrients.filter((n) => n.route === "blood").reduce((s, n) => s + n.absorbed, 0);
  const toLymph = nutrients.filter((n) => n.route === "lymph").reduce((s, n) => s + n.absorbed, 0);
  return {
    meal: m,
    condition: c,
    area,
    areaRelative: area / areaMultiplier("healthy"),
    absorbed,
    nutrients,
    toBlood,
    toLymph,
    /** The measured area this lining would have, m². */
    areaM2: MEASURED_AREA_M2 * (area / areaMultiplier("healthy")),
    villusHeight: c.villusHeight,
  };
}

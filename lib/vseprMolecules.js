// ─── VSEPR molecules ────────────────────────────────────────────────
// The real molecules the VSEPR scene can show, with their measured bond
// angles. Kept free of three.js so the topic registry can build its preset
// buttons from it without pulling three into the main bundle.
// ─────────────────────────────────────────────────────────────────────

/**
 * Real molecules with their measured gas-phase bond angles.
 *
 *   angle      — the single bond angle of a bent or pyramidal molecule
 *   axial      — seesaw: F(ax)–S–F(ax). T-shaped and square pyramidal: the
 *                angle between the axial bond(s) and the others
 *   equatorial — seesaw: F(eq)–S–F(eq)
 *
 * Shapes with no lone pairs, or whose lone pairs cancel, sit exactly at their
 * ideal angles and need no numbers. `order` is the bond order drawn (1.5 for
 * ozone's two resonance-averaged bonds). The first molecule for each AXₙEₘ is
 * that shape's example.
 */
export const MOLECULES = [
  { id: "CO2", label: "CO₂", name: "Carbon dioxide", centre: "C", ligand: "O", bonding: 2, lone: 0, order: 2 },
  { id: "BeCl2", label: "BeCl₂", name: "Beryllium chloride (gas)", centre: "Be", ligand: "Cl", bonding: 2, lone: 0 },
  { id: "BF3", label: "BF₃", name: "Boron trifluoride", centre: "B", ligand: "F", bonding: 3, lone: 0 },
  { id: "SO3", label: "SO₃", name: "Sulfur trioxide", centre: "S", ligand: "O", bonding: 3, lone: 0, order: 2 },
  { id: "SO2", label: "SO₂", name: "Sulfur dioxide", centre: "S", ligand: "O", bonding: 2, lone: 1, angle: 119.5, order: 2 },
  { id: "O3", label: "O₃", name: "Ozone", centre: "O", ligand: "O", bonding: 2, lone: 1, angle: 116.8, order: 1.5 },
  { id: "CH4", label: "CH₄", name: "Methane", centre: "C", ligand: "H", bonding: 4, lone: 0 },
  { id: "CCl4", label: "CCl₄", name: "Tetrachloromethane", centre: "C", ligand: "Cl", bonding: 4, lone: 0 },
  { id: "NH3", label: "NH₃", name: "Ammonia", centre: "N", ligand: "H", bonding: 3, lone: 1, angle: 107 },
  { id: "NF3", label: "NF₃", name: "Nitrogen trifluoride", centre: "N", ligand: "F", bonding: 3, lone: 1, angle: 102.2 },
  { id: "PH3", label: "PH₃", name: "Phosphine", centre: "P", ligand: "H", bonding: 3, lone: 1, angle: 93.5 },
  { id: "H2O", label: "H₂O", name: "Water", centre: "O", ligand: "H", bonding: 2, lone: 2, angle: 104.5 },
  { id: "H2S", label: "H₂S", name: "Hydrogen sulfide", centre: "S", ligand: "H", bonding: 2, lone: 2, angle: 92.1 },
  { id: "PCl5", label: "PCl₅", name: "Phosphorus pentachloride", centre: "P", ligand: "Cl", bonding: 5, lone: 0 },
  { id: "SF4", label: "SF₄", name: "Sulfur tetrafluoride", centre: "S", ligand: "F", bonding: 4, lone: 1, axial: 173.1, equatorial: 101.6 },
  { id: "ClF3", label: "ClF₃", name: "Chlorine trifluoride", centre: "Cl", ligand: "F", bonding: 3, lone: 2, axial: 87.5 },
  { id: "XeF2", label: "XeF₂", name: "Xenon difluoride", centre: "Xe", ligand: "F", bonding: 2, lone: 3 },
  { id: "SF6", label: "SF₆", name: "Sulfur hexafluoride", centre: "S", ligand: "F", bonding: 6, lone: 0 },
  { id: "BrF5", label: "BrF₅", name: "Bromine pentafluoride", centre: "Br", ligand: "F", bonding: 5, lone: 1, axial: 84.8 },
  { id: "XeF4", label: "XeF₄", name: "Xenon tetrafluoride", centre: "Xe", ligand: "F", bonding: 4, lone: 2 },
];

/** The molecule the counts stand for: the named preset if it fits them, else the shape's example. */
export function moleculeFor(bonding, lone, preset) {
  const fits = (m) => m.bonding === bonding && m.lone === lone;
  return MOLECULES.find((m) => m.id === preset && fits(m)) ?? MOLECULES.find(fits) ?? null;
}

/**
 * How each element is drawn: CPK colours, lightened so none sinks into the
 * dark background, and a radius that grows down the table (H small, Br and
 * Xe large).
 */
export const ELEMENT_STYLE = {
  H: { colour: "#f1f5f9", radius: 0.24 },
  Be: { colour: "#bef264", radius: 0.4 },
  B: { colour: "#fda4af", radius: 0.4 },
  C: { colour: "#94a3b8", radius: 0.42 },
  N: { colour: "#60a5fa", radius: 0.4 },
  O: { colour: "#f87171", radius: 0.38 },
  F: { colour: "#86efac", radius: 0.33 },
  P: { colour: "#fb923c", radius: 0.5 },
  S: { colour: "#fde047", radius: 0.5 },
  Cl: { colour: "#4ade80", radius: 0.42 },
  Br: { colour: "#d97706", radius: 0.54 },
  Xe: { colour: "#22d3ee", radius: 0.58 },
};

/** Bonds, a step lighter than the scene kit's slate so they read against the dark background. */
export const VSEPR_BOND_COLOUR = "#a3b1c6";

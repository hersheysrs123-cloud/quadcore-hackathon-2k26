// ─── Reaction energetics ────────────────────────────────────────────
// Activation energy, enthalpy change, and what a catalyst and the
// temperature do to the rate.
//
// The scene and the Details panel already agreed on the clamping and the
// Boltzmann fraction — they had two identical copies of it, which is one
// copy too many. The panel was missing the two numbers that make the point,
// though: the rate constant (the bare fraction is ~1e-14 for a reaction
// that runs perfectly briskly, so it answers "does this go?" with "no"
// almost always) and the factor by which the catalyst speeds things up.
// ─────────────────────────────────────────────────────────────────────

export const GAS_CONSTANT = 8.314;

/** Typical Arrhenius pre-exponential factor for a unimolecular step, s⁻¹. */
export const PRE_EXPONENTIAL = 1e13;

/** Rate constant above which the reaction is treated as going anywhere. */
export const PROCEEDS_ABOVE_K = 1e-3;

/**
 * The forward barrier can never be lower than ΔH: the products would then
 * sit above the "peak", and the reverse activation energy would come out
 * negative. The sliders can reach that combination, so it is clamped — and
 * the readout says so rather than silently showing a different Ea.
 */
export const floorEa = (deltaH) => Math.max(deltaH + 5, 5);

/** Fraction of collisions carrying at least Ea, from the Boltzmann factor. */
export const boltzmannFraction = (eaKJ, temperatureK) =>
  Math.exp((-eaKJ * 1000) / (GAS_CONSTANT * Math.max(temperatureK, 1)));

/** Everything the profile and its readout need, from the five controls. */
export function solveEnergetics({
  activation = 90,
  deltaH = -60,
  catalyst = false,
  catalystDrop = 35,
  temperature = 350,
} = {}) {
  const floor = floorEa(deltaH);
  const uncatalysed = Math.max(activation, floor);
  const effectiveEa = Math.max(catalyst ? uncatalysed - catalystDrop : uncatalysed, floor);
  const reverseEa = effectiveEa - deltaH;

  const fraction = boltzmannFraction(effectiveEa, temperature);
  const baseFraction = boltzmannFraction(uncatalysed, temperature);
  const rateConstant = PRE_EXPONENTIAL * fraction;

  return {
    activation,
    deltaH,
    temperature,
    catalyst: Boolean(catalyst),
    catalystDrop,
    exothermic: deltaH < 0,
    floorEa: floor,
    uncatalysed,
    effectiveEa,
    reverseEa,
    /** True when ΔH forced Ea above the value the slider asked for. */
    clampedByDeltaH: uncatalysed > activation,
    lowering: uncatalysed - effectiveEa,
    fraction,
    baseFraction,
    /** How many more collisions succeed because of the catalyst. */
    speedUp: baseFraction > 0 ? fraction / baseFraction : 1,
    rateConstant,
    proceeds: rateConstant > PROCEEDS_ABOVE_K,
  };
}

// ─── Antagonistic muscles at the elbow ──────────────────────────────
// The mechanics behind the biceps/triceps scene: the elbow as a third-class
// lever, the torque a handheld load puts on it, the force the biceps has to
// pull with to hold it, and what fatigue does to that.
//
// The point the scene exists to make is that a muscle can only PULL. The
// biceps shortens to flex the elbow and can do nothing whatever to straighten
// it again — that needs a second muscle on the other side of the joint. So
// the model treats the two as a pair from the start: every angle has a
// length, a state and a tension for each of them.
//
// The second thing to take away is the lever ratio. The load hangs about
// 28 cm from the elbow; the biceps tendon pulls about 4 cm from it. Holding
// 10 kg therefore takes not 100 N of muscle force but closer to 700 N, and
// τ = F·d is the whole of the reason.
// ─────────────────────────────────────────────────────────────────────

/** Standard gravity, m/s². */
export const G = 9.81;

/** Elbow axis to the centre of the hand, where the dumbbell sits, metres. */
export const FOREARM_LENGTH_M = 0.28;

/** Mass of the forearm and hand together, kg — it has to be held up too. */
export const FOREARM_MASS_KG = 1.5;

/** Where that mass acts, metres from the elbow. */
export const FOREARM_COM_M = 0.13;

export const MIN_ANGLE_DEG = 0;
export const MAX_ANGLE_DEG = 145;
export const MIN_LOAD_KG = 0;
export const MAX_LOAD_KG = 25;

/**
 * Peak isometric force of the elbow flexors at their best length, newtons.
 *
 * "Biceps" in the scene stands for the whole flexor group (biceps brachii,
 * brachialis, brachioradialis), which is how a student meets it. Together
 * they produce a peak elbow torque of roughly 70 N·m in an adult, which over
 * a 4 cm moment arm is about this much.
 */
export const BICEPS_MAX_FORCE_N = 1900;

/** Peak isometric force of the triceps, newtons. */
export const TRICEPS_MAX_FORCE_N = 1500;

/** Young's modulus of tendon, Pa. Stiff, but nothing like bone. */
export const TENDON_MODULUS_PA = 1.2e9;

/** Cross-sectional area of the distal biceps tendon, m² (≈ 32 mm²). */
export const BICEPS_TENDON_AREA_M2 = 3.2e-5;

/** The triceps aponeurosis is broad and flat — about twice the area. */
export const TRICEPS_TENDON_AREA_M2 = 6.0e-5;

/** Strain beyond which collagen fibres start to tear microscopically. */
export const TENDON_DAMAGE_STRAIN = 0.04;

/** Strain at which a tendon ruptures. */
export const TENDON_FAILURE_STRAIN = 0.08;

/**
 * Fraction of the antagonist's maximum it holds as resting tone, so the joint
 * stays stable. It is why a relaxed muscle is never completely slack.
 */
export const CO_CONTRACTION = 0.05;

/**
 * Peak strength lost when fully fatigued. Lactic acid and the fall in pH stop
 * cross-bridges cycling properly; the muscle is still there, it just cannot
 * pull as hard.
 */
export const FATIGUE_MAX_LOSS = 0.75;

/** Seconds for fatigue to build to its peak after the trigger. */
export const FATIGUE_ONSET_S = 1.5;

/** Seconds the muscle stays at peak fatigue before recovery begins. */
export const FATIGUE_PLATEAU_S = 4;

/** Time constant of recovery once the plateau is over, seconds. */
export const FATIGUE_RECOVERY_S = 10;

/** Biceps length at full flexion as a fraction of its length at full extension. */
export const BICEPS_SHORTENING = 0.32;

/** Triceps length at full extension as a fraction of its length at full flexion. */
export const TRICEPS_SHORTENING = 0.28;

const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const clampAngle = (deg) => clamp(Number(deg) || 0, MIN_ANGLE_DEG, MAX_ANGLE_DEG);
export const clampLoad = (kg) => clamp(Number(kg) || 0, MIN_LOAD_KG, MAX_LOAD_KG);

/**
 * Perpendicular distance from the elbow axis to the biceps tendon, metres.
 *
 * It is not constant: the tendon runs almost parallel to the bone at full
 * extension and stands well off it at 90°, which is why a curl feels hardest
 * near the bottom even though the load's own lever arm is longest at 90°.
 */
export const bicepsMomentArm = (deg) => 0.015 + 0.028 * Math.sin(clampAngle(deg) * DEG);

/** The triceps pulls over the olecranon, a lever arm that barely changes. */
export const tricepsMomentArm = (deg) => 0.022 - 0.003 * Math.sin(clampAngle(deg) * DEG);

/**
 * Length of each muscle as a fraction of its own longest length. The biceps
 * is longest at full extension; the triceps is longest at full flexion.
 */
export const bicepsLengthFraction = (deg) => 1 - BICEPS_SHORTENING * (clampAngle(deg) / MAX_ANGLE_DEG);
export const tricepsLengthFraction = (deg) => 1 - TRICEPS_SHORTENING * (1 - clampAngle(deg) / MAX_ANGLE_DEG);

/**
 * Belly radius factor for a muscle at length fraction `f`, relative to its
 * radius at full length.
 *
 * Muscle is essentially incompressible, so r²·L is fixed: a belly that
 * shortens to 68 % of its length swells to √(1/0.68) ≈ 1.21× its radius.
 * That, and nothing else, is the bulge.
 */
export const bulgeFactor = (lengthFraction) => Math.sqrt(1 / Math.max(lengthFraction, 0.2));

/**
 * Length–tension relationship, 0–1: how much of its peak force a muscle can
 * produce at this joint angle. Sarcomeres overlap best near mid-range and the
 * curve falls away towards either end.
 */
export function lengthTension(deg, optimumDeg = 95, spread = 95, floor = 0.35) {
  const x = (clampAngle(deg) - optimumDeg) / spread;
  return clamp(1 - 0.65 * x * x, floor, 1);
}

/** Fraction of the biceps' peak force still available at fatigue `f` (0–1). */
export const strengthFactor = (fatigue) => 1 - FATIGUE_MAX_LOSS * clamp(fatigue, 0, 1);

/**
 * Fatigue level `t` seconds after the trigger: a quick build-up to 1, a
 * spell at the peak while the acid is still accumulating faster than the
 * blood can carry it away, then an exponential recovery as it is cleared.
 * Negative or missing `t` means the trigger has not been pressed.
 */
export function fatigueAt(tSeconds) {
  if (!(tSeconds >= 0)) return 0;
  if (tSeconds < FATIGUE_ONSET_S) {
    const x = tSeconds / FATIGUE_ONSET_S;
    return 0.5 - 0.5 * Math.cos(Math.PI * x);
  }
  const recovering = tSeconds - FATIGUE_ONSET_S - FATIGUE_PLATEAU_S;
  if (recovering <= 0) return 1;
  return Math.exp(-recovering / FATIGUE_RECOVERY_S);
}

/** Below this the fatigue is over for all practical purposes. */
export const FATIGUE_DONE = 0.01;

/**
 * Torque the load and the forearm's own weight exert about the elbow, N·m.
 *
 * With the upper arm hanging vertically the forearm makes angle θ with the
 * vertical, so the horizontal lever arm of anything held in the hand is
 * L·sin θ: zero with the arm straight down, greatest at 90°.
 */
export function loadTorque(deg, loadKg) {
  const s = Math.sin(clampAngle(deg) * DEG);
  const load = clampLoad(loadKg);
  return G * (load * FOREARM_LENGTH_M + FOREARM_MASS_KG * FOREARM_COM_M) * s;
}

/** Horizontal lever arm of the load about the elbow, metres. */
export const loadLeverArm = (deg) => FOREARM_LENGTH_M * Math.sin(clampAngle(deg) * DEG);

/**
 * Force the biceps must pull with to hold the forearm still at this angle,
 * newtons. The antagonist's resting tone pulls the other way and has to be
 * overcome as well — a small term, but it is why the answer is never
 * exactly τ ÷ d.
 */
export function bicepsForceRequired(deg, loadKg) {
  const tone = CO_CONTRACTION * TRICEPS_MAX_FORCE_N * tricepsMomentArm(deg);
  return (loadTorque(deg, loadKg) + tone) / bicepsMomentArm(deg);
}

/** The most the biceps can pull with here, given its length and fatigue. */
export const bicepsForceAvailable = (deg, fatigue) =>
  BICEPS_MAX_FORCE_N * lengthTension(deg) * strengthFactor(fatigue);

export const canHold = (deg, loadKg, fatigue) =>
  bicepsForceRequired(deg, loadKg) <= bicepsForceAvailable(deg, fatigue);

/**
 * Where the forearm actually ends up when asked to hold `targetDeg`.
 *
 * If the biceps cannot supply the force the target needs, the arm gives way.
 * It does not fall to the floor: the torque required changes with angle, so
 * it sags until it reaches an angle it CAN hold — the largest angle at or
 * below the target where required ≤ available, found by walking down from
 * the target a degree at a time. At 0° the required torque is zero, so the
 * walk always terminates.
 */
export function settledAngle(targetDeg, loadKg, fatigue) {
  const target = clampAngle(targetDeg);
  for (let deg = target; deg > 0; deg -= 1) {
    if (canHold(deg, loadKg, fatigue)) return deg;
  }
  return 0;
}

/** Tensile strain in a tendon carrying `force` newtons. */
export const tendonStrain = (force, area) => Math.max(force, 0) / (TENDON_MODULUS_PA * area);

/** Passive tension from stretch: nothing until near full length, then rising steeply. */
export function passiveTension(lengthFraction, maxForce) {
  const x = clamp((lengthFraction - 0.85) / 0.15, 0, 1);
  return maxForce * 0.06 * x * x;
}

/**
 * Which way the joint is moving. "holding" is the static case; the scene
 * reports "flexing" or "extending" while the slider is being dragged.
 */
export const MOTIONS = ["holding", "flexing", "extending"];

/**
 * Solve the pair for one elbow angle, load, fatigue level and direction of
 * motion. `targetAngle` is what the slider asks for; `angle` is where the arm
 * actually is once fatigue has had its say.
 */
export function solveMuscles({ elbowAngle = 90, loadKg = 5, fatigue = 0, motion = "holding" } = {}) {
  const targetAngle = clampAngle(elbowAngle);
  const load = clampLoad(loadKg);
  const f = clamp(Number(fatigue) || 0, 0, 1);
  const angle = settledAngle(targetAngle, load, f);
  const sagging = angle < targetAngle - 0.5;
  const dir = MOTIONS.includes(motion) ? motion : "holding";

  const torque = loadTorque(angle, load);
  const dB = bicepsMomentArm(angle);
  const dT = tricepsMomentArm(angle);
  const available = bicepsForceAvailable(angle, f);
  const required = bicepsForceRequired(angle, load);

  const bicepsFraction = bicepsLengthFraction(angle);
  const tricepsFraction = tricepsLengthFraction(angle);

  // Who is the agonist? Flexing or holding a load: the biceps. Extending: the
  // triceps — gravity would do the job on its own with the arm hanging, but a
  // controlled extension, or any push, is the triceps pulling the forearm
  // straight. Arm hanging at rest with nothing to hold: neither.
  const hangingFree = angle < 2 && load < 0.05;
  const bicepsActive = !hangingFree && dir !== "extending";
  const tricepsActive = !hangingFree && dir === "extending";

  const bicepsForce = bicepsActive ? Math.min(required, available) : passiveTension(bicepsFraction, BICEPS_MAX_FORCE_N);
  const tricepsTone = CO_CONTRACTION * TRICEPS_MAX_FORCE_N;
  const tricepsPassive = passiveTension(tricepsFraction, TRICEPS_MAX_FORCE_N);
  const tricepsForce = tricepsActive
    ? Math.max(tricepsTone + tricepsPassive, 0.45 * TRICEPS_MAX_FORCE_N * lengthTension(145 - angle, 50, 95))
    : tricepsTone + tricepsPassive;

  const bicepsStrain = tendonStrain(bicepsForce, BICEPS_TENDON_AREA_M2);
  const tricepsStrain = tendonStrain(tricepsForce, TRICEPS_TENDON_AREA_M2);

  return {
    targetAngle,
    angle,
    sagging,
    motion: dir,
    loadKg: load,
    loadWeightN: load * G,
    forearmWeightN: FOREARM_MASS_KG * G,
    leverArmM: loadLeverArm(angle),
    torque,
    fatigue: f,
    strengthPct: strengthFactor(f) * 100,
    biceps: {
      active: bicepsActive,
      state: bicepsActive ? "contracted" : "relaxed",
      lengthFraction: bicepsFraction,
      bulge: bulgeFactor(bicepsFraction),
      force: bicepsForce,
      required,
      available,
      momentArmM: dB,
      utilisation: available > 0 ? Math.min(required / available, 1) : 1,
      tendonStrain: bicepsStrain,
      tendonState: tendonStateFor(bicepsStrain),
    },
    triceps: {
      active: tricepsActive,
      state: tricepsActive ? "contracted" : "relaxed",
      lengthFraction: tricepsFraction,
      bulge: bulgeFactor(tricepsFraction),
      force: tricepsForce,
      momentArmM: dT,
      tendonStrain: tricepsStrain,
      tendonState: tendonStateFor(tricepsStrain),
    },
  };
}

export function tendonStateFor(strain) {
  if (strain >= TENDON_FAILURE_STRAIN) return "rupture";
  if (strain >= TENDON_DAMAGE_STRAIN) return "micro-tears";
  if (strain >= 0.02) return "high";
  return "safe";
}

/** The heaviest dumbbell this arm can hold still at `deg`, kg. */
export function maxHoldableLoad(deg, fatigue) {
  const angle = clampAngle(deg);
  const s = Math.sin(angle * DEG);
  if (s < 1e-6) return MAX_LOAD_KG;
  const available = bicepsForceAvailable(angle, fatigue);
  const tone = CO_CONTRACTION * TRICEPS_MAX_FORCE_N * tricepsMomentArm(angle);
  const torqueBudget = available * bicepsMomentArm(angle) - tone;
  const kg = torqueBudget / (G * s) / FOREARM_LENGTH_M - (FOREARM_MASS_KG * FOREARM_COM_M) / FOREARM_LENGTH_M;
  return clamp(kg, 0, MAX_LOAD_KG);
}

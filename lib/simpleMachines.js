// ─── Simple machines · mechanical advantage ─────────────────────────
// Levers of all three classes and a block-and-tackle, reduced to the one
// trade-off they all express: a machine can cut the force you need, but never
// the work you have to do.
//
// The distinction this module is careful about is the one textbooks blur.
// The DISTANCE ratio is pure geometry and is fixed by the machine's shape.
// The FORCE ratio is what you actually measure, and friction makes it smaller.
// They are equal only in an ideal machine, and their quotient is the
// efficiency — so a scene that prints one number labelled "MA" is hiding the
// entire reason efficiency exists.
// ─────────────────────────────────────────────────────────────────────

export const G = 9.81;

/** Length of the lever bar, metres. */
export const BEAM_LENGTH_M = 2.4;
/** How far the load is raised in one stroke, metres. */
export const LIFT_M = 0.25;

/** Loss at a single lever pivot — one bearing, lightly loaded. */
export const LEVER_EFFICIENCY = 0.97;
/** Loss per pulley sheave. The standard engineering rule of thumb. */
export const SHEAVE_EFFICIENCY = 0.96;

export const MACHINES = {
  lever1: {
    label: "Class 1 lever",
    short: "Class 1",
    example: "see-saw, crowbar, scissors",
    order: "load — fulcrum — effort",
    /** What the contextual slider moves for this machine. */
    slider: "fulcrum position along the bar",
    note: "The only class whose advantage can be either way round: put the fulcrum near the load and you gain force, near the effort and you gain speed.",
  },
  lever2: {
    label: "Class 2 lever",
    short: "Class 2",
    example: "wheelbarrow, nutcracker, bottle opener",
    order: "fulcrum — load — effort",
    slider: "how far the load sits from the fulcrum",
    note: "The load is always between the other two, so the effort arm is always the longer one. A class 2 lever cannot have an advantage below 1.",
  },
  lever3: {
    label: "Class 3 lever",
    short: "Class 3",
    example: "tweezers, fishing rod, your own forearm",
    order: "fulcrum — effort — load",
    slider: "how far the effort is applied from the fulcrum",
    note: "Always an advantage below 1 — you pull harder than the load weighs. You buy speed and range of movement with that force, which is exactly the deal your biceps makes.",
  },
  pulley: {
    label: "Block and tackle",
    short: "Pulley",
    example: "crane, sail rigging, engine hoist",
    order: "load shared between the supporting ropes",
    slider: "number of sheaves in the tackle",
    note: "Each rope segment supporting the load carries its share, so n segments need one nth of the force — and n times the rope pulled through.",
  },
};

export const machineFor = (key) => MACHINES[key] ?? MACHINES.lever1;
export const isLever = (key) => key !== "pulley";

/**
 * Where the three points sit on the bar, in metres from its left end.
 *
 * `p` is the one contextual slider, and each class reads it differently
 * because each class is defined by which of the three is in the middle.
 */
export function leverLayout(type, p, beam = BEAM_LENGTH_M) {
  const f = Math.min(Math.max(p, 0.08), 0.92);
  switch (type) {
    case "lever2":
      // Fulcrum pinned at the left end; the load slides along the bar.
      return { fulcrum: 0, load: f * beam, effort: beam, loadArm: f * beam, effortArm: beam };
    case "lever3":
      // Fulcrum pinned at the left end; the effort is applied part-way along.
      return { fulcrum: 0, effort: f * beam, load: beam, loadArm: beam, effortArm: f * beam };
    case "lever1":
    default:
      // Fulcrum between the two, so moving it changes both arms at once.
      return {
        fulcrum: f * beam,
        load: 0,
        effort: beam,
        loadArm: f * beam,
        effortArm: (1 - f) * beam,
      };
  }
}

/** Rope segments supporting the load — one per sheave in the tackle. */
export const supportingRopes = (sheaves) => Math.max(Math.round(sheaves), 1);

/**
 * The distance ratio, sometimes called the velocity ratio.
 *
 * Fixed entirely by the machine's geometry: how far the effort has to travel
 * for every metre the load rises. Friction cannot change it, which is exactly
 * why it is the honest thing to compare the measured force ratio against.
 */
export function velocityRatio(type, p, sheaves) {
  if (type === "pulley") return supportingRopes(sheaves);
  const { loadArm, effortArm } = leverLayout(type, p);
  return effortArm / Math.max(loadArm, 1e-6);
}

/** Fraction of the input work that reaches the load. */
export function efficiencyOf(type, sheaves) {
  if (type === "pulley") return SHEAVE_EFFICIENCY ** supportingRopes(sheaves);
  return LEVER_EFFICIENCY;
}

/**
 * One solve for the whole bench.
 *
 * Work out is fixed by the job — raising this load by this height — and work
 * in is whatever it costs to do it. The gap between them is the friction, and
 * it is heat, not a bookkeeping error.
 */
export function solveMachine({ type = "lever1", p = 0.35, sheaves = 2, loadN = 300, lift = LIFT_M }) {
  const machine = machineFor(type);
  const vr = velocityRatio(type, p, sheaves);
  const efficiency = efficiencyOf(type, sheaves);
  /** The force ratio you would actually measure — friction has eaten into it. */
  const mechanicalAdvantage = vr * efficiency;

  const effortForce = loadN / Math.max(mechanicalAdvantage, 1e-6);
  const loadDistance = lift;
  const effortDistance = lift * vr;

  const workOut = loadN * loadDistance;
  const workIn = effortForce * effortDistance;

  return {
    machine,
    type,
    /** Geometry only: d_effort ÷ d_load. */
    velocityRatio: vr,
    /** Forces: F_load ÷ F_effort. Smaller than the distance ratio in real life. */
    mechanicalAdvantage,
    /** What an ideal, frictionless version of this machine would give. */
    idealAdvantage: vr,
    efficiency,
    loadN,
    effortForce,
    loadDistance,
    effortDistance,
    workIn,
    workOut,
    wasted: Math.max(workIn - workOut, 0),
    /** The load expressed as the mass a student would recognise. */
    loadMassKg: loadN / G,
    /** True when the machine costs more force than it saves. */
    losesForce: mechanicalAdvantage < 1,
    layout: isLever(type) ? leverLayout(type, p) : null,
    ropes: type === "pulley" ? supportingRopes(sheaves) : 0,
  };
}

/**
 * How far each end of the bar moves when the load rises by `lift`.
 *
 * Small angles are not assumed: the bar pivots, so both ends travel along
 * arcs, and the ratio of those arcs is the ratio of the radii. That IS the
 * distance ratio — the geometry and the force ratio are the same statement.
 */
export function leverSwing(type, p, lift, beam = BEAM_LENGTH_M) {
  const { loadArm, effortArm } = leverLayout(type, p, beam);
  const theta = Math.asin(Math.min(lift / Math.max(loadArm, 1e-6), 0.999));
  return {
    angle: theta,
    loadRise: loadArm * Math.sin(theta),
    effortDrop: effortArm * Math.sin(theta),
  };
}

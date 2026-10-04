// ─── Diffusion and Brownian motion ──────────────────────────────────
// The particle-model topic's second mode: gases spreading into each other.
//
// Diffusion is NOT particles flying in straight lines from one end to the
// other. A gas molecule at room temperature moves at hundreds of metres a
// second but hits another molecule every ~70 nm, so its path is a random
// walk and the gas as a whole creeps. Drawing free flight — as the phase
// scene's gas does, for a different lesson — would mix a box in a second
// and make every gas mix at the same rate as it fills the box.
//
// So each particle here moves at a Maxwell–Boltzmann velocity for its own
// molar mass and the temperature, and is knocked onto a fresh random
// velocity at a rate of |v| / λ (one mean free path λ between collisions —
// the BGK picture of a gas). That random walk gives a diffusion
// coefficient D ≈ v̄λ/3, so
//
//   • every gas spreads from where it is concentrated to where it is not,
//     with no "push" in the code — only randomness;
//   • a hotter gas diffuses faster (v ∝ √T);
//   • a lighter gas diffuses faster (v ∝ 1/√M) — which is why the NH₃/HCl
//     ring forms nearer the HCl end.
//
// The Brownian particle is a much heavier body in the same gas, given the
// same thermal energy by the collisions (an Ornstein–Uhlenbeck walk): it
// jiggles visibly and wanders with no direction, which is the evidence for
// the invisible particles hitting it.
//
// Everything is in scene units and scene seconds; `SPEED_SCALE` maps real
// r.m.s. speeds onto the screen, and the readout reports the real ones.
// ─────────────────────────────────────────────────────────────────────

export const R = 8.314;
export const C_TO_K = 273.15;

export const GASES = {
  bromine: { key: "bromine", label: "Bromine", formula: "Br₂", M: 159.8, colour: "#b93a0a", note: "brown-orange vapour" },
  air: { key: "air", label: "Air", formula: "N₂ + O₂", M: 28.96, colour: "#cbd5e1", note: "colourless" },
  ammonia: { key: "ammonia", label: "Ammonia", formula: "NH₃", M: 17.03, colour: "#60a5fa", note: "from conc. ammonia solution" },
  hcl: { key: "hcl", label: "Hydrogen chloride", formula: "HCl", M: 36.46, colour: "#f472b6", note: "from conc. hydrochloric acid" },
};

/** The white smoke that forms where the two meet: NH₃ + HCl → NH₄Cl(s). */
export const AMMONIUM_CHLORIDE = { formula: "NH₄Cl", label: "Ammonium chloride", colour: "#f8fafc" };

/**
 * A smoke particle, nominally. A real one is around 10¹⁰ times heavier than
 * a gas molecule and would barely move on screen; this one is drawn far
 * lighter so its jiggle can be seen. The readout says so.
 */
export const SMOKE_M = 2000;

export const EXPERIMENTS = {
  mixing: {
    key: "mixing",
    label: "Bromine into air",
    left: "bromine",
    right: "air",
    perGas: 240,
  },
  tube: {
    key: "tube",
    label: "NH₃ + HCl tube",
    left: "ammonia",
    right: "hcl",
    perGas: 260,
  },
};

export const experimentFor = (key) => EXPERIMENTS[key] ?? EXPERIMENTS.mixing;

/** The mixing box (centred on the origin) and the tube (axis along x). */
export const BOX = { halfL: 4, halfH: 1.15, halfD: 1.15 };
export const TUBE = { halfL: 5, r: 0.42 };
/** Particle radius in the scene, and the contact distance at which NH₃ meets HCl. */
export const PARTICLE_R = 0.07;
export const REACT_DIST = 0.16;
/** Mean free path, scene units. */
export const MEAN_FREE_PATH = 0.6;
/** Scene units per second, per metre per second of real r.m.s. speed. */
export const SPEED_SCALE = 0.006;
/** Particles each soaked cotton plug gives off per scene second. */
export const EMIT_RATE = 45;
/** How quickly the smoke particle's velocity forgets itself, per second. */
const TRACER_DAMPING = 2;
const TRACER_TRAIL = 240;
const TRAIL_EVERY_S = 0.05;

export const GAS_TEMP_MIN_C = 0;
export const GAS_TEMP_MAX_C = 200;

/** Real r.m.s. speed, m/s: √(3RT/M). */
export const vRms = (M, tempC) => Math.sqrt((3 * R * Math.max(tempC + C_TO_K, 1)) / (M / 1000));

/** Graham: rate(A) / rate(B) = √(M_B / M_A). */
export const grahamRatio = (Ma, Mb) => Math.sqrt(Mb / Ma);

/**
 * Where the ring would be if each gas's front simply travelled at its own
 * r.m.s. speed — the textbook estimate, as a fraction of the tube from the
 * NH₃ end. Random-walk fronts advance as √(Dt), not vt, so the ring the
 * simulation actually makes sits a little nearer the middle than this.
 */
export const speedRatioRingFraction = (Ma, Mb) => 1 / (1 + Math.sqrt(Ma / Mb));

/** Mulberry32 — seeded, so tests and the scene can replay the same run. */
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng) {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** Species codes in `state.species`. */
export const SPECIES = { left: 0, right: 1, product: 2, unborn: 255 };

/** Scene r.m.s. speed per velocity component for a gas of molar mass M. */
const sigmaFor = (M, tempC) => (vRms(M, tempC) * SPEED_SCALE) / Math.sqrt(3);

function thermalise(s, i, sigma) {
  const o = i * 3;
  s.vel[o] = gaussian(s.rng) * sigma;
  s.vel[o + 1] = gaussian(s.rng) * sigma;
  s.vel[o + 2] = gaussian(s.rng) * sigma;
}

/** A random point inside the tube's cross-section, at x. */
function placeInTube(s, i, x) {
  const o = i * 3;
  const rMax = TUBE.r - PARTICLE_R;
  const a = s.rng() * Math.PI * 2;
  const r = Math.sqrt(s.rng()) * rMax;
  s.pos[o] = x;
  s.pos[o + 1] = Math.cos(a) * r;
  s.pos[o + 2] = Math.sin(a) * r;
}

/**
 * A fresh run. The mixing box starts with bromine filling the left half and
 * air the right, the partition in; the tube starts empty, waiting for the
 * cotton wool. `released` is false until `releaseDiffusion`.
 */
export function createDiffusion(experimentKey, { tempC = 20, seed = 1, tracer = false } = {}) {
  const exp = experimentFor(experimentKey);
  const n = exp.perGas * 2;
  const s = {
    experiment: exp.key,
    n,
    perGas: exp.perGas,
    pos: new Float32Array(n * 3),
    vel: new Float32Array(n * 3),
    species: new Uint8Array(n),
    released: false,
    time: 0,
    emitted: [0, 0],
    emitCarry: [0, 0],
    reacted: 0,
    firstRingX: null,
    rng: makeRng(seed),
    tracer: null,
  };
  const masses = [GASES[exp.left].M, GASES[exp.right].M];
  for (let i = 0; i < n; i += 1) {
    const side = i < exp.perGas ? 0 : 1;
    const o = i * 3;
    if (exp.key === "tube") {
      s.species[i] = SPECIES.unborn;
      continue;
    }
    s.species[i] = side;
    const inX = BOX.halfL - PARTICLE_R;
    s.pos[o] = side === 0 ? -s.rng() * inX : s.rng() * inX;
    s.pos[o + 1] = (s.rng() * 2 - 1) * (BOX.halfH - PARTICLE_R);
    s.pos[o + 2] = (s.rng() * 2 - 1) * (BOX.halfD - PARTICLE_R);
    thermalise(s, i, sigmaFor(masses[side], tempC));
  }
  if (tracer && exp.key === "mixing") {
    s.tracer = { pos: [0.6, 0, 0], vel: [0, 0, 0], trail: [], sinceTrail: 0, radius: 0.16 };
  }
  return s;
}

/** Lift the partition, or push the cotton wool in. */
export function releaseDiffusion(s) {
  s.released = true;
  s.time = 0;
  return s;
}

/** Keep particle i inside the box, reflecting its velocity off the walls (and the partition while it is in). */
function confineBox(s, i) {
  const o = i * 3;
  const lim = [BOX.halfL - PARTICLE_R, BOX.halfH - PARTICLE_R, BOX.halfD - PARTICLE_R];
  for (let k = 0; k < 3; k += 1) {
    if (s.pos[o + k] > lim[k]) {
      s.pos[o + k] = 2 * lim[k] - s.pos[o + k];
      s.vel[o + k] = -Math.abs(s.vel[o + k]);
    } else if (s.pos[o + k] < -lim[k]) {
      s.pos[o + k] = -2 * lim[k] - s.pos[o + k];
      s.vel[o + k] = Math.abs(s.vel[o + k]);
    }
  }
  if (!s.released) {
    const side = s.species[i];
    const edge = PARTICLE_R;
    if (side === 0 && s.pos[o] > -edge) {
      s.pos[o] = -edge;
      s.vel[o] = -Math.abs(s.vel[o]);
    } else if (side === 1 && s.pos[o] < edge) {
      s.pos[o] = edge;
      s.vel[o] = Math.abs(s.vel[o]);
    }
  }
}

/** Keep particle i inside the tube: reflect off the round wall and the two plugged ends. */
function confineTube(s, i) {
  const o = i * 3;
  const lim = TUBE.halfL - 0.35;
  if (s.pos[o] > lim) {
    s.pos[o] = 2 * lim - s.pos[o];
    s.vel[o] = -Math.abs(s.vel[o]);
  } else if (s.pos[o] < -lim) {
    s.pos[o] = -2 * lim - s.pos[o];
    s.vel[o] = Math.abs(s.vel[o]);
  }
  const y = s.pos[o + 1];
  const z = s.pos[o + 2];
  const rMax = TUBE.r - PARTICLE_R;
  const r = Math.hypot(y, z);
  if (r > rMax) {
    const ny = y / r;
    const nz = z / r;
    // Back inside by the overshoot, and the radial velocity turned inward.
    const back = 2 * rMax - r;
    s.pos[o + 1] = ny * back;
    s.pos[o + 2] = nz * back;
    const vn = s.vel[o + 1] * ny + s.vel[o + 2] * nz;
    if (vn > 0) {
      s.vel[o + 1] -= 2 * vn * ny;
      s.vel[o + 2] -= 2 * vn * nz;
    }
  }
}

/** The cotton plugs give off gas until each has released its share. */
function emit(s, dt, masses, tempC) {
  for (let side = 0; side < 2; side += 1) {
    s.emitCarry[side] += EMIT_RATE * dt;
    while (s.emitCarry[side] >= 1 && s.emitted[side] < s.perGas) {
      s.emitCarry[side] -= 1;
      const i = side * s.perGas + s.emitted[side];
      s.emitted[side] += 1;
      s.species[i] = side;
      placeInTube(s, i, (side === 0 ? -1 : 1) * (TUBE.halfL - 0.45));
      thermalise(s, i, sigmaFor(masses[side], tempC));
    }
    if (s.emitted[side] >= s.perGas) s.emitCarry[side] = 0;
  }
}

const BIN = 0.3;

/**
 * NH₃ + HCl → NH₄Cl wherever the two touch. The pair becomes one speck of
 * white solid, stuck to the glass where they met; the second particle of
 * the pair is used up (`unborn` again, never re-emitted).
 */
function react(s) {
  const bins = new Map();
  const n = s.n;
  for (let i = 0; i < n; i += 1) {
    if (s.species[i] !== SPECIES.right) continue;
    const b = Math.floor(s.pos[i * 3] / BIN);
    if (!bins.has(b)) bins.set(b, []);
    bins.get(b).push(i);
  }
  const d2 = REACT_DIST * REACT_DIST;
  for (let i = 0; i < n; i += 1) {
    if (s.species[i] !== SPECIES.left) continue;
    const o = i * 3;
    const b = Math.floor(s.pos[o] / BIN);
    let partner = -1;
    for (let k = b - 1; k <= b + 1 && partner < 0; k += 1) {
      const list = bins.get(k);
      if (!list) continue;
      for (const j of list) {
        if (s.species[j] !== SPECIES.right) continue;
        const q = j * 3;
        const dx = s.pos[o] - s.pos[q];
        const dy = s.pos[o + 1] - s.pos[q + 1];
        const dz = s.pos[o + 2] - s.pos[q + 2];
        if (dx * dx + dy * dy + dz * dz < d2) {
          partner = j;
          break;
        }
      }
    }
    if (partner < 0) continue;
    const q = partner * 3;
    const x = (s.pos[o] + s.pos[q]) / 2;
    // Deposited on the inside of the glass, at the angle they met.
    const a = Math.atan2(s.pos[o + 2] + s.pos[q + 2], s.pos[o + 1] + s.pos[q + 1]);
    const r = TUBE.r - PARTICLE_R * 1.2;
    s.species[i] = SPECIES.product;
    s.pos[o] = x;
    s.pos[o + 1] = Math.cos(a) * r;
    s.pos[o + 2] = Math.sin(a) * r;
    s.vel[o] = s.vel[o + 1] = s.vel[o + 2] = 0;
    s.species[partner] = SPECIES.unborn;
    s.reacted += 1;
    if (s.firstRingX === null) s.firstRingX = x;
  }
}

function stepTracer(s, dt, tempC) {
  const t = s.tracer;
  const sigma = sigmaFor(SMOKE_M, tempC);
  const kick = sigma * Math.sqrt(2 * TRACER_DAMPING * dt);
  const lim = [BOX.halfL - t.radius, BOX.halfH - t.radius, BOX.halfD - t.radius];
  for (let k = 0; k < 3; k += 1) {
    t.vel[k] += -TRACER_DAMPING * t.vel[k] * dt + kick * gaussian(s.rng);
    t.pos[k] += t.vel[k] * dt;
    if (t.pos[k] > lim[k]) {
      t.pos[k] = 2 * lim[k] - t.pos[k];
      t.vel[k] = -Math.abs(t.vel[k]);
    } else if (t.pos[k] < -lim[k]) {
      t.pos[k] = -2 * lim[k] - t.pos[k];
      t.vel[k] = Math.abs(t.vel[k]);
    }
  }
  t.sinceTrail += dt;
  if (t.sinceTrail >= TRAIL_EVERY_S) {
    t.sinceTrail = 0;
    t.trail.push([t.pos[0], t.pos[1], t.pos[2]]);
    if (t.trail.length > TRACER_TRAIL) t.trail.shift();
  }
}

/** Advance the run by dt scene seconds at `tempC`. Mutates and returns `s`. */
export function stepDiffusion(s, dt, tempC) {
  if (!(dt > 0)) return s;
  const exp = experimentFor(s.experiment);
  const masses = [GASES[exp.left].M, GASES[exp.right].M];
  const sigmas = masses.map((M) => sigmaFor(M, tempC));
  const tube = exp.key === "tube";
  if (tube && s.released) emit(s, dt, masses, tempC);

  for (let i = 0; i < s.n; i += 1) {
    const sp = s.species[i];
    if (sp !== SPECIES.left && sp !== SPECIES.right) continue;
    const o = i * 3;
    const speed = Math.hypot(s.vel[o], s.vel[o + 1], s.vel[o + 2]);
    // A collision: a fresh thermal velocity, at the rate speed / λ.
    if (s.rng() < 1 - Math.exp((-speed * dt) / MEAN_FREE_PATH)) thermalise(s, i, sigmas[sp]);
    s.pos[o] += s.vel[o] * dt;
    s.pos[o + 1] += s.vel[o + 1] * dt;
    s.pos[o + 2] += s.vel[o + 2] * dt;
    if (tube) confineTube(s, i);
    else confineBox(s, i);
  }
  if (tube) react(s);
  if (s.tracer) stepTracer(s, dt, tempC);
  if (s.released) s.time += dt;
  return s;
}

/** Counts of each gas in `bins` slices along x, left end first. */
export function concentrationProfile(s, bins = 24) {
  const exp = experimentFor(s.experiment);
  const half = exp.key === "tube" ? TUBE.halfL : BOX.halfL;
  const left = new Array(bins).fill(0);
  const right = new Array(bins).fill(0);
  for (let i = 0; i < s.n; i += 1) {
    const sp = s.species[i];
    if (sp !== SPECIES.left && sp !== SPECIES.right) continue;
    const b = Math.min(bins - 1, Math.max(0, Math.floor(((s.pos[i * 3] + half) / (2 * half)) * bins)));
    (sp === SPECIES.left ? left : right)[b] += 1;
  }
  return { left, right };
}

/**
 * How mixed the box is: 0% with each gas in its own half, 100% with each
 * spread evenly over both. It is the share of each gas that has crossed the
 * middle, doubled (an even spread puts half of each across).
 */
export function mixingPercent(s) {
  let crossed = 0;
  let counted = 0;
  for (let i = 0; i < s.n; i += 1) {
    const sp = s.species[i];
    if (sp !== SPECIES.left && sp !== SPECIES.right) continue;
    counted += 1;
    const x = s.pos[i * 3];
    if ((sp === SPECIES.left && x > 0) || (sp === SPECIES.right && x < 0)) crossed += 1;
  }
  return counted ? Math.min(100, (200 * crossed) / counted) : 0;
}

/** Mean distance travelled into the other half, per gas — the lighter gas gets further. */
export function penetration(s) {
  const sum = [0, 0];
  const count = [0, 0];
  for (let i = 0; i < s.n; i += 1) {
    const sp = s.species[i];
    if (sp !== SPECIES.left && sp !== SPECIES.right) continue;
    const x = s.pos[i * 3];
    sum[sp] += sp === SPECIES.left ? Math.max(0, x) : Math.max(0, -x);
    count[sp] += 1;
  }
  return sum.map((v, k) => (count[k] ? v / count[k] : 0));
}

/** Where the white ring is, as a fraction of the tube from the NH₃ end; null before it forms. */
export function ringFraction(s) {
  const xs = [];
  for (let i = 0; i < s.n; i += 1) if (s.species[i] === SPECIES.product) xs.push(s.pos[i * 3]);
  if (!xs.length) return null;
  xs.sort((a, b) => a - b);
  const median = xs[Math.floor(xs.length / 2)];
  return (median + TUBE.halfL) / (2 * TUBE.halfL);
}

/** Everything the readout prints for one moment of a run. */
export function describeDiffusion({ experiment = "mixing", tempC = 20, time = 0, mixPct = 0, ring = null, deposits = 0, released = false, tracer = false } = {}) {
  const exp = experimentFor(experiment);
  const A = GASES[exp.left];
  const B = GASES[exp.right];
  const left = { ...A, vRms: vRms(A.M, tempC) };
  const right = { ...B, vRms: vRms(B.M, tempC) };
  const vA = left.vRms;
  const vB = right.vRms;
  return {
    experiment: exp.key,
    label: exp.label,
    tempC,
    tempK: tempC + C_TO_K,
    left,
    right,
    faster: vA >= vB ? left : right,
    slower: vA >= vB ? right : left,
    speedRatio: Math.max(vA, vB) / Math.min(vA, vB),
    graham: grahamRatio(A.M, B.M),
    estimateRing: exp.key === "tube" ? speedRatioRingFraction(A.M, B.M) : null,
    released,
    time,
    mixPct,
    ring,
    deposits,
    tracer: tracer && exp.key === "mixing",
    smokeVRms: vRms(SMOKE_M, tempC),
    equation: exp.key === "tube" ? "NH₃(g) + HCl(g) → NH₄Cl(s)" : null,
  };
}

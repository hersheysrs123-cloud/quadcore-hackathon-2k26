// ─── Atomic orbitals ────────────────────────────────────────────────
// The Bohr topic's "Quantum orbitals" model: where the electrons of the
// first twenty elements actually are, as probability clouds.
//
// The shells of the Bohr picture split into subshells — K is 1s; L is 2s
// and 2p; M is 3s and 3p (3d stays empty up to calcium); N starts with 4s,
// which fills BEFORE 3d. Each subshell is one or three orbitals, and an
// orbital holds at most two electrons. Three p orbitals with fewer than six
// electrons fill singly first (Hund's rule), so carbon's two 2p electrons
// sit in two different p orbitals and the third is empty.
//
// The clouds are sampled from real hydrogen-like wavefunctions, with the
// nuclear charge each electron actually feels (Slater's rules: inner
// electrons screen the nucleus, so sodium's 3s electron feels about +2.2,
// not +11). Point density follows |ψ|², the radial nodes of 2s, 3s and 4s
// are really there, and each lobe of a p orbital carries the sign of ψ.
//
// Radii are in Bohr radii (a₀ = 52.9 pm). `displayRadius` compresses them
// for the screen — sodium's 1s is forty times smaller than its 3s, which
// drawn to scale is a speck — monotonically, so nodes and order survive.
// ─────────────────────────────────────────────────────────────────────

import { ELEMENTS } from "./atomicStructure.js";

/** The filling order up to calcium. 3d comes after 4s, and nothing here reaches it. */
export const SUBSHELLS = [
  { key: "1s", n: 1, l: 0, capacity: 2, shell: "K" },
  { key: "2s", n: 2, l: 0, capacity: 2, shell: "L" },
  { key: "2p", n: 2, l: 1, capacity: 6, shell: "L" },
  { key: "3s", n: 3, l: 0, capacity: 2, shell: "M" },
  { key: "3p", n: 3, l: 1, capacity: 6, shell: "M" },
  { key: "4s", n: 4, l: 0, capacity: 2, shell: "N" },
];

export const subshellFor = (key) => SUBSHELLS.find((s) => s.key === key) ?? null;

/** p orbitals by the axis they lie along. */
export const P_AXES = ["x", "y", "z"];

const SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export const sup = (n) => String(n).replace(/\d/g, (d) => SUPERSCRIPTS[Number(d)]);

/** Aufbau: how many electrons each subshell holds for atomic number Z (≤ 20). */
export function configuration(Z) {
  let left = Math.max(0, Math.min(20, Math.round(Z)));
  const out = [];
  for (const s of SUBSHELLS) {
    if (left <= 0) break;
    const e = Math.min(s.capacity, left);
    out.push({ ...s, electrons: e });
    left -= e;
  }
  return out;
}

/** "1s² 2s² 2p⁶ 3s¹". */
export const configurationString = (Z) => configuration(Z).map((s) => `${s.key}${sup(s.electrons)}`).join(" ");

/**
 * Electrons in each orbital of a subshell, Hund's rule: singly into each
 * of the 2l + 1 orbitals first, then paired. A p subshell with 4 is [2,1,1].
 */
export function orbitalOccupancy(subshell, electrons) {
  const count = 2 * subshell.l + 1;
  const occ = new Array(count).fill(0);
  for (let e = 0; e < electrons; e += 1) occ[e % count] += 1;
  return occ;
}

/**
 * Slater's effective nuclear charge for an electron in `key`, for atomic
 * number Z. Groups (1s)(2s,2p)(3s,3p)(4s): others in the same group screen
 * 0.35 each (0.30 within 1s), the shell below 0.85 each, anything deeper
 * 1.00 each.
 */
export function slaterZeff(Z, key) {
  const target = subshellFor(key);
  const config = configuration(Z);
  let shielding = 0;
  for (const s of config) {
    // An electron does not screen itself.
    const others = s.key === key ? s.electrons - 1 : s.electrons;
    if (s.n === target.n) {
      shielding += others * (target.n === 1 ? 0.3 : 0.35);
    } else if (s.n === target.n - 1) {
      shielding += others * 0.85;
    } else if (s.n < target.n - 1) {
      shielding += others * 1.0;
    }
  }
  return Z - shielding;
}

/**
 * Hydrogen-like radial function R_nl(r) for charge Z, up to normalisation.
 * x = Zr in Bohr radii.
 */
export function radial(n, l, Z, r) {
  const x = Z * r;
  if (n === 1) return Math.exp(-x);
  if (n === 2 && l === 0) return (2 - x) * Math.exp(-x / 2);
  if (n === 2 && l === 1) return x * Math.exp(-x / 2);
  if (n === 3 && l === 0) return (27 - 18 * x + 2 * x * x) * Math.exp(-x / 3);
  if (n === 3 && l === 1) return x * (6 - x) * Math.exp(-x / 3);
  if (n === 4 && l === 0) return (192 - 144 * x + 24 * x * x - x * x * x) * Math.exp(-x / 4);
  throw new Error(`no radial function for n=${n}, l=${l}`);
}

/** Where r²R² peaks — the most probable radius — found numerically. */
export function mostProbableRadius(n, l, Z) {
  const rMax = (6 * n * n + 10) / Z;
  let best = 0;
  let bestP = -1;
  for (let i = 1; i <= 4000; i += 1) {
    const r = (i / 4000) * rMax;
    const R = radial(n, l, Z, r);
    const p = r * r * R * R;
    if (p > bestP) {
      bestP = p;
      best = r;
    }
  }
  return best;
}

/**
 * The radii (Bohr radii) of the spherical nodes, where R changes sign —
 * found by bisecting each sign change on a fine grid. 2s has one, 3s two.
 */
export function radialNodeRadii(n, l, Z) {
  const rMax = (6 * n * n + 10) / Z;
  const out = [];
  let prevR = 1e-6;
  let prev = radial(n, l, Z, prevR);
  for (let i = 1; i <= 4000; i += 1) {
    const r = (i / 4000) * rMax;
    const v = radial(n, l, Z, r);
    if (Math.sign(v) !== Math.sign(prev) && prev !== 0) {
      let lo = prevR;
      let hi = r;
      for (let k = 0; k < 50; k += 1) {
        const mid = (lo + hi) / 2;
        if (Math.sign(radial(n, l, Z, mid)) === Math.sign(prev)) lo = mid;
        else hi = mid;
      }
      out.push((lo + hi) / 2);
    }
    prev = v;
    prevR = r;
  }
  return out;
}

/** One colour per subshell, and the two signs of ψ. */
export const ORBITAL_COLOURS = { "1s": "#fda4af", "2s": "#38bdf8", "2p": "#fbbf24", "3s": "#34d399", "3p": "#c084fc", "4s": "#fb923c" };
export const PHASE_COLOURS = { plus: "#38bdf8", minus: "#fb7185" };

/** One Bohr radius in picometres. */
export const BOHR_PM = 52.92;

/** The radius (Bohr radii) inside which the electron is found with probability `fraction`. */
export function radiusEnclosing(n, l, Z, fraction = 0.9) {
  const rMax = (6 * n * n + 10) / Z;
  const N = 4000;
  const cdf = new Float64Array(N + 1);
  for (let i = 1; i <= N; i += 1) {
    const r = ((i - 0.5) / N) * rMax;
    const R = radial(n, l, Z, r);
    cdf[i] = cdf[i - 1] + r * r * R * R;
  }
  const want = fraction * cdf[N];
  let i = 0;
  while (i < N && cdf[i] < want) i += 1;
  return (i / N) * rMax;
}

/** Radial nodes: n − l − 1 spheres where ψ is zero. Angular nodes: l planes. */
export const nodes = (n, l) => ({ radial: n - l - 1, angular: l });

/** The screen radius for a true radius in Bohr radii — compressed, monotonic. */
export const displayRadius = (r) => 1.45 * Math.pow(Math.max(r, 0), 0.55);

/** Mulberry32, so a cloud is the same every time it is drawn. */
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

/**
 * `count` points distributed as |ψ|² for orbital (n, l, axis) at charge Z.
 *
 * r is drawn from the radial distribution r²R² by inverting its CDF on a
 * fine grid; the direction is uniform for s and, for p, accepted with
 * probability cos²θ about the orbital's axis — exactly |Y₁|². Returns the
 * TRUE positions in Bohr radii and the sign of ψ at each.
 */
export function sampleOrbital({ n, l, axis = "z", Z, count, seed = 1 }) {
  const rng = makeRng(seed);
  const rMax = (6 * n * n + 10) / Z;
  const N = 2048;
  const cdf = new Float64Array(N + 1);
  for (let i = 1; i <= N; i += 1) {
    const r = ((i - 0.5) / N) * rMax;
    const R = radial(n, l, Z, r);
    cdf[i] = cdf[i - 1] + r * r * R * R;
  }
  const total = cdf[N];
  const positions = new Float32Array(count * 3);
  const signs = new Int8Array(count);
  const k = P_AXES.indexOf(axis);
  for (let p = 0; p < count; p += 1) {
    // Radius by inverse CDF (binary search, then linear within the bin).
    const u = rng() * total;
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < u) lo = mid;
      else hi = mid;
    }
    const frac = (u - cdf[lo]) / Math.max(cdf[hi] - cdf[lo], 1e-300);
    const r = ((lo + frac) / N) * rMax;
    // Direction: uniform on the sphere, kept with probability cos²θ for p.
    let d;
    for (;;) {
      const z = rng() * 2 - 1;
      const phi = rng() * Math.PI * 2;
      const s = Math.sqrt(1 - z * z);
      d = [s * Math.cos(phi), s * Math.sin(phi), z];
      if (l === 0 || rng() < d[k] * d[k]) break;
    }
    const o = p * 3;
    positions[o] = d[0] * r;
    positions[o + 1] = d[1] * r;
    positions[o + 2] = d[2] * r;
    const R = radial(n, l, Z, r);
    const angular = l === 0 ? 1 : d[k];
    signs[p] = R * angular >= 0 ? 1 : -1;
  }
  return { positions, signs };
}

/** Everything the readout and the scene want about an atom's orbitals. */
export function describeOrbitals(symbol, focus = "all") {
  const el = ELEMENTS[symbol] ?? ELEMENTS.Na;
  const Z = el.protons;
  const config = configuration(Z);
  const subshells = config.map((s) => {
    const Zeff = slaterZeff(Z, s.key);
    return {
      ...s,
      Zeff,
      occupancy: orbitalOccupancy(s, s.electrons),
      nodes: nodes(s.n, s.l),
      shape: s.l === 0 ? "sphere" : "dumbbell (two lobes)",
      peakA0: mostProbableRadius(s.n, s.l, Zeff),
      nodeRadiiA0: radialNodeRadii(s.n, s.l, Zeff),
      r90A0: radiusEnclosing(s.n, s.l, Zeff, 0.9),
    };
  });
  const focused = focus === "all" ? null : subshells.find((s) => s.key === focus) ?? null;
  const last = subshells[subshells.length - 1];
  const half = subshells.find((s) => s.l === 1 && s.electrons > 0 && s.electrons < 6);
  return {
    symbol: el.symbol,
    name: el.name,
    Z,
    subshells,
    configuration: configurationString(Z),
    /** The Bohr shells this regroups: 2,8,1 is 1s² | 2s² 2p⁶ | 3s¹. */
    shells: el.shells.join(","),
    focus,
    focused,
    /** Asked for a subshell this atom has no electrons in. */
    focusEmpty: focus !== "all" && !focused,
    outermost: last,
    unpairedP: half ? half.occupancy.filter((o) => o === 1).length : 0,
    hund: half ? `${half.key}${sup(half.electrons)}: ${half.occupancy.map((o) => (o === 2 ? "↑↓" : o === 1 ? "↑" : "·")).join(" ")}` : null,
    fourSBeforeThreeD: Z >= 19,
  };
}

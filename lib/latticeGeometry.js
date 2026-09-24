// ─── Lattice geometry ───────────────────────────────────────────────
// Atom positions for the covalent networks the crystal scene draws, as plain
// arrays so the tests can hold them to real crystallography — coordination
// numbers, bond lengths, bond angles. The scene only colours and draws what
// is here; lib/lattices.js keeps the facts and colour keys.
//
// Every builder returns { atoms: [{ el, position }], bonds: [{ i, j, kind }] }
// in world units, centred on the origin. `kind` is "covalent" or "hydrogen".
// ─────────────────────────────────────────────────────────────────────

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

/** Recentre positions on their bounding box. */
function centred(points) {
  const mid = [0, 1, 2].map((k) => {
    const v = points.map((p) => p[k]);
    return (Math.min(...v) + Math.max(...v)) / 2;
  });
  return points.map((p) => p.map((v, k) => v - mid[k]));
}

/** Every pair of points `length` apart (± tol), as index pairs. */
function pairsAt(points, length, tol = 0.02) {
  const pairs = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (Math.abs(dist(points[i], points[j]) - length) < tol) pairs.push([i, j]);
    }
  }
  return pairs;
}

/**
 * Drop points with fewer than `min` bonds, repeatedly, then reindex. A finite
 * block of a network leaves spurs at its surface, and an atom hanging off one
 * bond reads as a stray rather than as part of a lattice.
 */
function prune(points, pairs, min = 2) {
  const keep = points.map(() => true);
  for (let changed = true; changed; ) {
    changed = false;
    const degree = points.map(() => 0);
    pairs.forEach(([i, j]) => {
      if (keep[i] && keep[j]) {
        degree[i] += 1;
        degree[j] += 1;
      }
    });
    degree.forEach((dg, i) => {
      if (keep[i] && dg < min) {
        keep[i] = false;
        changed = true;
      }
    });
  }
  const index = new Map();
  const kept = [];
  points.forEach((p, i) => {
    if (!keep[i]) return;
    index.set(i, kept.length);
    kept.push(p);
  });
  return {
    points: kept,
    pairs: pairs.filter(([i, j]) => keep[i] && keep[j]).map(([i, j]) => [index.get(i), index.get(j)]),
  };
}

// ─── Diamond ────────────────────────────────────────────────────────

/** C–C in diamond is 1.54 Å; drawn at 1.04 world units. */
export const DIAMOND_BOND = 1.04;

/**
 * Diamond: the diamond-cubic net, cut as a ball centred on a carbon rather
 * than as a cube, and pruned so every atom has at least two bonds.
 *
 * The old 2 × 2 × 2 cube left ten carbons hanging off a single bond and only
 * 27 of 64 showing the four-bond tetrahedron the whole topic is about; the
 * ball keeps 87, with 35 fully bonded and none on a single bond.
 */
export function diamondFragment({ radius = 3.3 } = {}) {
  const a = (4 / Math.sqrt(3)) * DIAMOND_BOND; // the cubic cell, from the bond
  const basis = [
    [0, 0, 0],
    [0, 0.5, 0.5],
    [0.5, 0, 0.5],
    [0.5, 0.5, 0],
  ];
  const raw = [];
  for (let x = -2; x <= 1; x += 1) {
    for (let y = -2; y <= 1; y += 1) {
      for (let z = -2; z <= 1; z += 1) {
        basis.forEach(([bx, by, bz]) => {
          raw.push([(x + bx) * a, (y + by) * a, (z + bz) * a]);
          raw.push([(x + bx + 0.25) * a, (y + by + 0.25) * a, (z + bz + 0.25) * a]);
        });
      }
    }
  }
  const ball = raw.filter((p) => Math.hypot(...p) <= radius);
  const { points, pairs } = prune(ball, pairsAt(ball, DIAMOND_BOND));
  return {
    atoms: points.map((position) => ({ el: "C", position })),
    bonds: pairs.map(([i, j]) => ({ i, j, kind: "covalent" })),
  };
}

// ─── α-quartz ───────────────────────────────────────────────────────

/**
 * α-quartz: space group P3₂21, a = 4.913 Å, c = 5.405 Å, Si at 3a
 * (0.4697, 0, 0) and O at 6c (0.4135, 0.2669, 0.1191).
 */
export const QUARTZ = { a: 4.913, c: 5.405, u: 0.4697, o: [0.4135, 0.2669, 0.1191], siO: 1.61 };
/** World units per ångström for the quartz build. */
export const QUARTZ_SCALE = 0.42;

/**
 * Quartz, from its crystal structure rather than a sketch of one.
 *
 * Every Si has four O at 1.60–1.61 Å with O–Si–O 108.8–110.5°, every O
 * bridges two Si at the real 143.7°, and the cell comes to 2.65 g/cm³. The
 * old build (a diamond net with bent midpoint oxygens) came out at Si–O–Si
 * 89° and O–Si–O anywhere from 49° to 169°, while its readout said
 * "tetrahedral". The tetrahedra here spiral about the c axis — the helices
 * that make a quartz crystal left- or right-handed.
 *
 * Only oxygens that bridge two drawn silicons are kept, and silicons left
 * with fewer than two oxygens are dropped, until nothing changes.
 */
export function quartzFragment({ radius = 3.6, halfHeight = 2.3 } = {}) {
  const { a, c, u } = QUARTZ;
  const [x, y, z] = QUARTZ.o;
  const siSites = [
    [u, 0, 0],
    [0, u, 2 / 3],
    [-u, -u, 1 / 3],
  ];
  const oSites = [
    [x, y, z],
    [-y, x - y, z + 2 / 3],
    [y - x, -x, z + 1 / 3],
    [x - y, -y, -z],
    [y, x, 2 / 3 - z],
    [-x, y - x, 1 / 3 - z],
  ];
  const s = QUARTZ_SCALE;
  // a and b in the horizontal plane; c runs up the screen (world y).
  const toWorld = ([p, q, r]) => [s * a * (p - 0.5 * q), s * c * r, s * a * (Math.sqrt(3) / 2) * q];
  const tile = (sites) => {
    const out = [];
    for (let i = -3; i <= 3; i += 1) {
      for (let j = -3; j <= 3; j += 1) {
        for (let k = -2; k <= 2; k += 1) sites.forEach((f) => out.push(toWorld([f[0] + i, f[1] + j, f[2] + k])));
      }
    }
    return out;
  };
  const inside = (p) => Math.hypot(p[0], p[2]) <= radius && Math.abs(p[1]) <= halfHeight;
  const oxygens = tile(oSites);
  const bondLength = QUARTZ.siO * s;

  let silicons = tile(siSites).filter(inside);
  let bridges = [];
  for (let pass = 0; pass < 8; pass += 1) {
    bridges = [];
    oxygens.forEach((o) => {
      const near = [];
      silicons.forEach((p, k) => {
        if (Math.abs(dist(o, p) - bondLength) < 0.05) near.push(k);
      });
      if (near.length === 2) bridges.push({ o, near });
    });
    const count = silicons.map(() => 0);
    bridges.forEach((b) => b.near.forEach((k) => (count[k] += 1)));
    const next = silicons.filter((_, k) => count[k] >= 2);
    if (next.length === silicons.length) break;
    silicons = next;
  }

  const atoms = silicons.map((position) => ({ el: "Si", position }));
  const bonds = [];
  bridges.forEach(({ o, near }) => {
    const oi = atoms.length;
    atoms.push({ el: "O", position: o });
    near.forEach((k) => bonds.push({ i: k, j: oi, kind: "covalent" }));
  });
  const moved = centred(atoms.map((at) => at.position));
  return { atoms: atoms.map((at, k) => ({ ...at, position: moved[k] })), bonds };
}

// ─── Ice Ih ─────────────────────────────────────────────────────────

/** O···O across a hydrogen bond is 2.76 Å and O–H is 0.96 Å; world units. */
export const ICE = { OO: 1.4375, OH: 0.5 };

/**
 * Hexagonal ice, Ih — the structure of snow and of every ice cube.
 *
 * Oxygens sit on the hexagonal-diamond (wurtzite) net: every one has four
 * neighbours at 2.76 Å at the tetrahedral angle, in puckered six-rings that
 * stack into open hexagonal channels — the empty space that makes ice less
 * dense than water. The old build used flat rings at 120°, gave its middle
 * oxygens six neighbours, and put two hydrogens on every link it drew.
 *
 * Hydrogens obey the Bernal–Fowler ice rules: two on every oxygen, one on
 * every O···O link. Choosing which end of each link holds the hydrogen is an
 * Euler-circuit problem. A dummy vertex is joined to every surface oxygen's
 * missing neighbour, so every oxygen has degree four; walking Euler circuits
 * orients every link, and leaves each oxygen with exactly two pointing out —
 * its two hydrogens — and two pointing in. A surface oxygen may spend a
 * hydrogen on a missing neighbour: it points out of the fragment, at where
 * the next molecule would be.
 *
 * The hydrogens lie on the O···O lines, which puts H–O–H at the tetrahedral
 * 109.5°; in real ice it relaxes to about 106°, close to the free molecule's
 * 104.5°.
 */
export function iceFragment({ radius = 3.9, halfHeight = 2.6 } = {}) {
  const d = ICE.OO;
  const a = d * Math.sqrt(8 / 3);
  const c = (d * 8) / 3;
  const basis = [
    [1 / 3, 2 / 3, 0],
    [2 / 3, 1 / 3, 1 / 2],
    [1 / 3, 2 / 3, 3 / 8],
    [2 / 3, 1 / 3, 7 / 8],
  ];
  // The fragment is centred on a hexagonal channel (the cell origin) and on
  // the middle of a puckered bilayer.
  const zMid = c * (3 / 16);
  const toWorld = ([p, q, r]) => [a * (p - 0.5 * q), c * r - zMid, a * (Math.sqrt(3) / 2) * q];
  const lattice = [];
  for (let i = -4; i <= 4; i += 1) {
    for (let j = -4; j <= 4; j += 1) {
      for (let k = -3; k <= 3; k += 1) basis.forEach((b) => lattice.push(toWorld([b[0] + i, b[1] + j, b[2] + k])));
    }
  }
  const inside = (p) => Math.hypot(p[0], p[2]) <= radius && Math.abs(p[1]) <= halfHeight;
  const ball = lattice.filter(inside);
  const { points: oxygens, pairs } = prune(ball, pairsAt(ball, d));

  // Directions to each kept oxygen's lattice neighbours that were cut away.
  const keyOf = (p) => p.map((v) => v.toFixed(3)).join(",");
  const kept = new Set(oxygens.map(keyOf));
  const missing = oxygens.map((p) =>
    lattice
      .filter((q) => Math.abs(dist(p, q) - d) < 0.02 && !kept.has(keyOf(q)))
      .map((q) => q.map((v, k) => (v - p[k]) / d)),
  );

  // Euler orientation. Vertex `dummy` stands in for everything cut away.
  const dummy = oxygens.length;
  const edges = pairs.map(([i, j]) => ({ i, j, used: false, from: -1, dir: null }));
  missing.forEach((dirs, i) => dirs.forEach((dir) => edges.push({ i, j: dummy, used: false, from: -1, dir })));
  const incident = Array.from({ length: dummy + 1 }, () => []);
  edges.forEach((e, k) => {
    incident[e.i].push(k);
    incident[e.j].push(k);
  });
  const cursor = new Array(dummy + 1).fill(0);
  for (let start = 0; start <= dummy; start += 1) {
    // Hierholzer's walk: take any unused edge, orient it the way it is walked.
    const stack = [start];
    while (stack.length) {
      const v = stack[stack.length - 1];
      while (cursor[v] < incident[v].length && edges[incident[v][cursor[v]]].used) cursor[v] += 1;
      if (cursor[v] === incident[v].length) {
        stack.pop();
        continue;
      }
      const e = edges[incident[v][cursor[v]]];
      e.used = true;
      e.from = v;
      stack.push(e.i === v ? e.j : e.i);
    }
  }

  const atoms = oxygens.map((position) => ({ el: "O", position }));
  const bonds = [];
  const hydrogen = (donor, dir) => {
    const o = oxygens[donor];
    const index = atoms.length;
    atoms.push({ el: "H", position: o.map((v, k) => v + dir[k] * ICE.OH) });
    bonds.push({ i: donor, j: index, kind: "covalent" });
    return index;
  };
  edges.forEach((e) => {
    if (e.from === dummy) return; // the missing neighbour holds this link's H
    if (e.j === dummy) {
      hydrogen(e.from, e.dir);
      return;
    }
    const donor = e.from;
    const acceptor = donor === e.i ? e.j : e.i;
    const dir = oxygens[acceptor].map((v, k) => (v - oxygens[donor][k]) / d);
    const h = hydrogen(donor, dir);
    bonds.push({ i: h, j: acceptor, kind: "hydrogen" });
  });
  return { atoms, bonds };
}

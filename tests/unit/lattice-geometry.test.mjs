import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DIAMOND_BOND,
  ICE,
  QUARTZ,
  QUARTZ_SCALE,
  diamondFragment,
  iceFragment,
  quartzFragment,
} from "../../lib/latticeGeometry.js";

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const angle = (a, o, b) => {
  const u = a.map((v, i) => v - o[i]);
  const w = b.map((v, i) => v - o[i]);
  const dot = u[0] * w[0] + u[1] * w[1] + u[2] * w[2];
  return (Math.acos(dot / Math.hypot(...u) / Math.hypot(...w)) * 180) / Math.PI;
};
/** Covalent neighbours of atom i, as positions. */
const neighbours = (f, i, kind = "covalent") =>
  f.bonds
    .filter((b) => b.kind === kind && (b.i === i || b.j === i))
    .map((b) => f.atoms[b.i === i ? b.j : b.i].position);
const anglesAt = (f, i) => {
  const nb = neighbours(f, i);
  const out = [];
  for (let x = 0; x < nb.length; x += 1) {
    for (let y = x + 1; y < nb.length; y += 1) out.push(angle(nb[x], f.atoms[i].position, nb[y]));
  }
  return out;
};
const indicesOf = (f, el) => f.atoms.map((a, i) => (a.el === el ? i : -1)).filter((i) => i >= 0);
const TETRAHEDRAL = 109.47;

describe("diamond", () => {
  const f = diamondFragment();

  it("bonds every carbon to at most four others, all at the C–C length", () => {
    f.bonds.forEach((b) => assert.ok(Math.abs(dist(f.atoms[b.i].position, f.atoms[b.j].position) - DIAMOND_BOND) < 1e-6));
    f.atoms.forEach((_, i) => assert.ok(neighbours(f, i).length <= 4));
  });

  it("puts every C–C–C at the tetrahedral 109.47°", () => {
    f.atoms.forEach((_, i) => anglesAt(f, i).forEach((a) => assert.ok(Math.abs(a - TETRAHEDRAL) < 0.1, `${a}° at C${i}`)));
  });

  it("leaves no carbon hanging off a single bond, and shows real tetrahedra", () => {
    const degrees = f.atoms.map((_, i) => neighbours(f, i).length);
    assert.ok(degrees.every((d) => d >= 2));
    assert.ok(degrees.filter((d) => d === 4).length >= 30, "too few fully bonded carbons to see the tetrahedron");
  });
});

describe("α-quartz", () => {
  const f = quartzFragment();
  const si = indicesOf(f, "Si");
  const o = indicesOf(f, "O");

  it("bonds Si–O at 1.60–1.61 Å", () => {
    f.bonds.forEach((b) => {
      const d = dist(f.atoms[b.i].position, f.atoms[b.j].position) / QUARTZ_SCALE;
      assert.ok(d > 1.595 && d < 1.62, `Si–O ${d} Å`);
    });
  });

  it("makes every oxygen a bridge between exactly two silicons, at 143.7°", () => {
    o.forEach((i) => {
      assert.equal(neighbours(f, i).length, 2);
      assert.ok(Math.abs(anglesAt(f, i)[0] - 143.7) < 0.5, `Si–O–Si ${anglesAt(f, i)[0]}°`);
    });
  });

  it("keeps each SiO₄ unit tetrahedral — O–Si–O within 108.5–111°", () => {
    si.forEach((i) => anglesAt(f, i).forEach((a) => assert.ok(a > 108.5 && a < 111, `O–Si–O ${a}°`)));
  });

  it("never gives a silicon more than four oxygens, and shows some with all four", () => {
    const degrees = si.map((i) => neighbours(f, i).length);
    assert.ok(degrees.every((d) => d >= 2 && d <= 4));
    assert.ok(degrees.some((d) => d === 4));
  });

  it("uses a cell that comes to quartz's 2.65 g/cm³", () => {
    const volume = ((QUARTZ.a * QUARTZ.a * Math.sqrt(3)) / 2) * QUARTZ.c * 1e-24; // cm³
    const density = (3 * 60.08) / (6.02214e23 * volume);
    assert.ok(Math.abs(density - 2.65) < 0.01, `${density}`);
  });
});

describe("ice Ih", () => {
  const f = iceFragment();
  const oxygens = indicesOf(f, "O");
  const OO = (p, q) => Math.abs(dist(p, q) - ICE.OO) < 0.02;

  it("gives every oxygen at most four O···O neighbours at 2.76 Å, tetrahedrally", () => {
    oxygens.forEach((i) => {
      const p = f.atoms[i].position;
      const nb = oxygens.filter((j) => j !== i && OO(p, f.atoms[j].position)).map((j) => f.atoms[j].position);
      assert.ok(nb.length >= 2 && nb.length <= 4, `O${i} has ${nb.length}`);
      for (let x = 0; x < nb.length; x += 1) {
        for (let y = x + 1; y < nb.length; y += 1) assert.ok(Math.abs(angle(nb[x], p, nb[y]) - TETRAHEDRAL) < 0.1);
      }
    });
  });

  it("obeys the first ice rule: exactly two hydrogens on every oxygen, at 0.96 Å", () => {
    oxygens.forEach((i) => {
      const hs = neighbours(f, i);
      assert.equal(hs.length, 2, `O${i} holds ${hs.length} H`);
      hs.forEach((h) => assert.ok(Math.abs(dist(h, f.atoms[i].position) - ICE.OH) < 1e-9));
    });
  });

  it("obeys the second ice rule: exactly one hydrogen on every O···O link drawn", () => {
    const donorOf = new Map();
    f.bonds.filter((b) => b.kind === "covalent").forEach((b) => donorOf.set(b.j, b.i));
    const perLink = new Map();
    f.bonds
      .filter((b) => b.kind === "hydrogen")
      .forEach((b) => {
        const key = [donorOf.get(b.i), b.j].sort((x, y) => x - y).join("-");
        perLink.set(key, (perLink.get(key) ?? 0) + 1);
      });
    assert.ok(perLink.size > 0);
    perLink.forEach((n, key) => assert.equal(n, 1, `link ${key} carries ${n} H`));
    // …and no link between two drawn oxygens is left without its hydrogen.
    let links = 0;
    for (let x = 0; x < oxygens.length; x += 1) {
      for (let y = x + 1; y < oxygens.length; y += 1) if (OO(f.atoms[oxygens[x]].position, f.atoms[oxygens[y]].position)) links += 1;
    }
    assert.equal(perLink.size, links);
  });

  it("points each hydrogen bond straight along its O···O line", () => {
    f.bonds
      .filter((b) => b.kind === "hydrogen")
      .forEach((b) => {
        const h = f.atoms[b.i].position;
        const acceptor = f.atoms[b.j].position;
        assert.ok(Math.abs(dist(h, acceptor) - (ICE.OO - ICE.OH)) < 1e-6);
      });
  });
});

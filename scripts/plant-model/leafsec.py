"""A block of bean leaf, magnified about x200, broken open the way a
freeze-fractured leaf looks under a scanning electron microscope.

Frame: x across the panel, y up (the upper surface is at the top), z out of
the panel towards the viewer; the fracture face is z = FRONT. Cells are
whole except the guard cells, which the fracture cuts through the middle of
the pore so its section shows.

From the top down (Esau, "Anatomy of Seed Plants"; SEM images of Phaseolus
leaves):

  cuticle           a thin waxy film over everything
  upper epidermis   one layer of flat, clear cells
  palisade          one layer of tall columns packed with chloroplasts,
                    narrow air spaces between them
  spongy mesophyll  irregular lobed cells joined by their arms round large
                    air spaces; a minor vein (xylem vessels in a sheath of
                    large cells) runs through it into the page
  lower epidermis   flat cells, and a stoma: two guard cells over a
                    substomatal chamber, a large air space the water vapour
                    collects in before it diffuses out through the pore
"""

import math

import numpy as np

import plantlib as pl
from plantlib import sdf

X0, X1 = -1.9, 1.9
Z0, FRONT = -0.36, 0.24
STOMA_X = 0.45
VEIN = (-1.05, -0.32)  # x, y of the minor vein (it runs along z)

C = {
    "cuticle": pl.hex_rgb("#e7efd2"),
    "epidermis": pl.hex_rgb("#cfe3b4"),
    "palisade": pl.hex_rgb("#4f9a3c"),
    "spongy": pl.hex_rgb("#79b85c"),
    "chloroplast": pl.hex_rgb("#235f1c"),
    "guard": pl.hex_rgb("#5fae4a"),
    "guardWall": pl.hex_rgb("#d8e8c0"),
    "sheath": pl.hex_rgb("#b9d69a"),
    "xylem": pl.hex_rgb("#c9a36a"),
    "phloem": pl.hex_rgb("#a8c98c"),
}


def rbox(P, c, half, r):
    half = np.asarray(half, dtype=np.float64)
    c = np.asarray(c, dtype=np.float64)

    def f(Q):
        q = np.abs(Q - c) - half + r
        return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(axis=1), 0) - r

    return sdf._boxed(P, c - half, c + half, f)


def slab(P, y0, y1, x0=X0, x1=X1, z0=Z0, z1=FRONT, r=0.01):
    return rbox(P, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), ((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2), r)


def disc(P, c, n, ra, rb):
    """An oblate spheroid (a chloroplast): radius ra across, rb along the
    unit axis n (IQ's ellipsoid bound, written for an arbitrary axis)."""
    c = np.asarray(c, dtype=np.float64)
    n = np.asarray(n, dtype=np.float64)

    def f(Q):
        q = Q - c
        al = q @ n
        pe = np.linalg.norm(q - al[:, None] * n[None, :], axis=1)
        k0 = np.sqrt((pe / ra) ** 2 + (al / rb) ** 2)
        k1 = np.sqrt((pe / ra**2) ** 2 + (al / rb**2) ** 2)
        return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)

    return sdf._boxed(P, c - ra, c + ra, f)


class Layout:
    """Every cell's placement, drawn once from a seed so the field and the
    colouring agree."""

    def __init__(self, seed=5):
        rng = pl.rng(seed)
        self.epi_up = []
        for x in np.arange(X0 + 0.17, X1, 0.34):
            for z in np.arange(Z0 + 0.15, FRONT, 0.3):
                self.epi_up.append(((x + rng.uniform(-0.02, 0.02), 0.99, z + rng.uniform(-0.02, 0.02)), (0.18 + rng.uniform(-0.01, 0.02), 0.1, 0.16)))
        self.epi_lo = []
        for x in np.arange(X0 + 0.15, X1, 0.3):
            if abs(x - STOMA_X) < 0.3:
                continue
            for z in np.arange(Z0 + 0.15, FRONT, 0.3):
                self.epi_lo.append(((x + rng.uniform(-0.02, 0.02), -0.905, z + rng.uniform(-0.02, 0.02)), (0.165 + rng.uniform(-0.01, 0.015), 0.08, 0.16)))
        # the two epidermal cells flanking the guard cells
        for s in (-1, 1):
            for z in np.arange(Z0 + 0.15, FRONT, 0.3):
                self.epi_lo.append(((STOMA_X + s * 0.25, -0.905, z), (0.085, 0.075, 0.16)))
        self.palisade = []
        for x in np.arange(X0 + 0.1, X1 - 0.05, 0.19):
            for z in (FRONT - 0.1, FRONT - 0.29, FRONT - 0.48):
                r = 0.078 + rng.uniform(-0.008, 0.006)
                self.palisade.append((x + rng.uniform(-0.02, 0.02), z + rng.uniform(-0.02, 0.02), 0.16 + rng.uniform(-0.03, 0.04), 0.86 + rng.uniform(-0.02, 0.0), r, rng.uniform(-0.025, 0.025), rng.uniform(-0.02, 0.02)))
        # spongy cells: dart-throwing, keeping clear of the chamber and the vein
        self.spongy = []
        tries = 0
        while len(self.spongy) < 34 and tries < 5000:
            tries += 1
            c = np.array([rng.uniform(X0 + 0.1, X1 - 0.1), rng.uniform(-0.7, -0.05), rng.uniform(Z0 + 0.08, FRONT - 0.1)])
            if abs(c[0] - STOMA_X) < 0.32 and c[1] < -0.32:
                continue
            if math.hypot(c[0] - VEIN[0], c[1] - VEIN[1]) < 0.32:
                continue
            if any(np.linalg.norm(c - s[0]) < 0.34 for s in self.spongy):
                continue
            self.spongy.append((c, rng.uniform(0.11, 0.15)))
        # arms: each cell reaches towards two or three near neighbours
        self.arms = []
        for i, (c, r) in enumerate(self.spongy):
            d = [(np.linalg.norm(c - o[0]), j) for j, o in enumerate(self.spongy) if j != i]
            d.sort()
            for dist, j in d[:3]:
                if dist < 0.55 and (j, i) not in [(a[0], a[1]) for a in self.arms]:
                    self.arms.append((i, j, rng.uniform(0.065, 0.085)))
        # chloroplasts: discs lying just under the wall, face-on to it
        self.chloro = []
        for x, z, y0, y1, r, tx, tz in self.palisade:
            if z < FRONT - 0.4:
                continue
            for _ in range(24):
                a = rng.uniform(0, 2 * math.pi)
                y = rng.uniform(y0 + 0.07, y1 - 0.07)
                f = (y - y0) / (y1 - y0)
                n = np.array([math.cos(a), 0.0, math.sin(a)])
                c = np.array([x + tx * f, y, z + tz * f]) + n * (r - 0.006)
                self.chloro.append((c, n, 0.024, 0.009))
        for c, r in self.spongy:
            for _ in range(12):
                v = rng.normal(size=3)
                v /= np.linalg.norm(v)
                v[1] *= 0.85
                self.chloro.append((c + v * (r * 0.97 - 0.006), v / np.linalg.norm(v), 0.022, 0.008))


def epidermis_field(L):
    def f(P):
        d = slab(P, 1.075, 1.105, r=0.012)  # upper cuticle
        for c, h in L.epi_up:
            d = sdf.smin(d, rbox(P, c, h, 0.05), 0.02)
        lo = slab(P, -1.0, -0.975, r=0.01)  # lower cuticle, with the pore cut through
        lo = sdf.smax(lo, -(np.abs(P[:, 0] - STOMA_X) - 0.17), 0.02)
        d = np.minimum(d, lo)
        for c, h in L.epi_lo:
            d = sdf.smin(d, rbox(P, c, h, 0.045), 0.02)
        return d

    return f


def chloro_field(L):
    def f(P):
        d = np.full(len(P), 1.0)
        for c, n, ra, rb in L.chloro:
            d = np.minimum(d, disc(P, c, n, ra, rb))
        return d

    return f


def mesophyll_field(L):
    chl = chloro_field(L)

    def f(P):
        d = np.full(len(P), 1.0)
        for x, z, y0, y1, r, tx, tz in L.palisade:
            d = np.minimum(d, sdf.capsule(P, (x, y0 + r, z), (x + tx, y1 - r, z + tz), r, r * 0.95))
        sp = np.full(len(P), 1.0)
        for c, r in L.spongy:
            sp = sdf.smin(sp, sdf.ellipsoid(P, c, (r * 1.15, r * 0.8, r)), 0.05)
        for i, j, w in L.arms:
            a = L.spongy[i][0]
            b = L.spongy[j][0]
            m = (a + b) / 2
            sp = sdf.smin(sp, sdf.capsule(P, a, m, w, w * 0.85), 0.06)
            sp = sdf.smin(sp, sdf.capsule(P, b, m, w, w * 0.85), 0.06)
        # lobed and lumpy, not smooth balls and sticks
        sp = sdf.roughen(sp, P, 0.018, np.array([0.1, 0.1, 0.1]), seed=4, octaves=2)
        d = np.minimum(d, sp)
        d = sdf.smin(d, chl(P), 0.006)
        return d

    return f


def guard_field(P, open_=0.0):
    """Two guard cells along z, cut by the fracture at z = FRONT. Their
    section is round, the inner wall (towards the pore) thick."""
    out = np.full(len(P), 1.0)
    L = 0.55
    zc = FRONT
    for s in (-1, 1):
        def one(Q, s=s):
            t = np.clip((Q[:, 2] - (zc - L / 2)) / L, 0, 1)
            bow = np.sin(math.pi * t)
            cx = STOMA_X + s * (0.068 + open_ * 0.07 * bow)
            ry = 0.072 + 0.008 * open_
            rx = 0.07 + 0.01 * open_
            dx = (Q[:, 0] - cx) / rx
            dy = (Q[:, 1] + 0.92) / ry
            q = np.sqrt(dx * dx + dy * dy) - 1.0
            q = q * min(rx, ry)
            # taper to the tips (pinned ends)
            dz = np.abs(Q[:, 2] - zc) - L / 2
            return np.maximum(q + 0.03 * (1 - bow), dz)

        out = np.minimum(out, sdf._boxed(P, (STOMA_X - 0.3, -1.05, FRONT - 0.35), (STOMA_X + 0.3, -0.8, FRONT + 0.35), one))
    return np.maximum(out, P[:, 2] - FRONT)


def vein_field(P):
    vx, vy = VEIN
    d = np.full(len(P), 1.0)
    for k in range(9):
        a = 2 * math.pi * k / 9
        cx, cy = vx + 0.17 * math.cos(a), vy + 0.15 * math.sin(a)
        d = np.minimum(d, sdf.capsule(P, (cx, cy, Z0 + 0.06), (cx, cy, FRONT - 0.06), 0.07, 0.07))
    return d


def xylem_field(P):
    vx, vy = VEIN
    d = np.full(len(P), 1.0)
    for dx, dy, rv in ((-0.04, 0.03, 0.038), (0.045, 0.045, 0.032)):
        tube = sdf.cylinder(P, (vx + dx, vy + dy, Z0 + 0.02), (vx + dx, vy + dy, FRONT - 0.02), rv)
        hole = sdf.cylinder(P, (vx + dx, vy + dy, Z0 - 0.1), (vx + dx, vy + dy, FRONT + 0.1), rv - 0.012)
        d = np.minimum(d, np.maximum(tube, -hole))
    # phloem: a few small cells below the vessels
    for dx, dy in ((-0.05, -0.06), (0.03, -0.07), (0.0, -0.02)):
        d = np.minimum(d, sdf.capsule(P, (vx + dx, vy + dy, Z0 + 0.03), (vx + dx, vy + dy, FRONT - 0.03), 0.028, 0.028))
    return d


def colour_meso(P, L):
    chl = chloro_field(L)(P)
    y = P[:, 1]
    base = pl.mix(C["spongy"], C["palisade"], pl.smooth(0.0, 0.2, y))
    n = sdf.value_noise(P, np.array([0.06, 0.06, 0.06]), 3)
    base = base * (0.95 + 0.08 * n)[:, None]
    return pl.mix(base, C["chloroplast"], pl.smooth(0.006, -0.002, chl))


def colour_epi(P):
    y = np.abs(P[:, 1])
    return pl.mix(C["epidermis"], C["cuticle"], pl.smooth(1.06, 1.09, y) + pl.smooth(0.965, 0.985, y) * (P[:, 1] < 0))


def colour_guard(P):
    # the cut face (z = FRONT) shows the thick inner wall facing the pore
    on_cut = P[:, 2] > FRONT - 0.003
    dx = np.abs(P[:, 0] - STOMA_X)
    inner = pl.smooth(0.06, 0.03, dx)
    col = np.tile(C["guard"], (len(P), 1))
    col = pl.mix(col, C["guardWall"], np.where(on_cut, inner, 0.0))
    return col


def colour_vein(P):
    vx, vy = VEIN
    r = np.hypot(P[:, 0] - vx, P[:, 1] - vy)
    return pl.mix(C["xylem"], C["sheath"], pl.smooth(0.09, 0.12, r))


def meta():
    vx, vy = VEIN
    return {
        "front": FRONT,
        "stoma": {"x": STOMA_X, "y": -0.92, "z": FRONT},
        "vessels": [[vx - 0.04, vy + 0.03, 0.026], [vx + 0.045, vy + 0.045, 0.02]],
        "chamber": [STOMA_X, -0.6, FRONT - 0.12],
        "box": [X0, -1.0, Z0, X1, 1.1, FRONT],
    }

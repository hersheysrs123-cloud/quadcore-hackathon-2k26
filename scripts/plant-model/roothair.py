"""A young bean root tip among soil particles, magnified about x100.

Frame: the panel is the x-y plane, z towards the viewer. The root comes in
from the left (towards the plant) and ends at its tip on the right.

  root            translucent, as a young root is: its epidermis of long
                  cells, the stele (the central cylinder that carries the
                  xylem) showing through as a paler core, the root cap
                  over the tip with a few cells sloughing off it
  zones           no hairs over the tip and the zone of elongation; the
                  root-hair zone behind it, the oldest hairs (furthest from
                  the tip) the longest
  root hairs      single-cell outgrowths of the epidermis, threading
                  between the particles
  soil            quartz sand grains, silt, and crumbly aggregates of clay
                  and humus, each wrapped in a film of water; where two
                  particles (or a particle and a hair) nearly touch, the
                  water bridges the gap. That film is where the hairs take
                  water in by osmosis.

The water carries a "dry" morph: in drought the films thin back towards
the particles and the bridges shrink.
"""

import math

import numpy as np

import plantlib as pl
from plantlib import sdf

ROOT_PTS = [(-2.35, -1.2, -0.28), (-1.2, -0.95, -0.12), (0.0, -0.72, 0.0), (1.05, -0.5, 0.1), (1.42, -0.42, 0.12)]
ROOT_R = 0.3
C = {
    "root": pl.hex_rgb("#eee6cf"),
    "rootCap": pl.hex_rgb("#e6d29a"),
    "stele": pl.hex_rgb("#d6c182"),
    "hair": pl.hex_rgb("#f5f1e4"),
    "sand": pl.hex_rgb("#cfc4ad"),
    "sand2": pl.hex_rgb("#b8ab93"),
    "clay": pl.hex_rgb("#7a5634"),
    "humus": pl.hex_rgb("#4a3322"),
    "silt": pl.hex_rgb("#a38b6c"),
}


def root_axis():
    P = pl.resample(pl.catmull(ROOT_PTS, 10), 0.028)
    s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))])
    return P, s


def root_radius(s, L):
    from_tip = L - s
    r = ROOT_R * np.ones_like(s)
    # the tip: the root cap rounds it off over the last 0.45
    r = r * np.sqrt(np.clip(from_tip / 0.45, 0, 1)) ** 0.9
    return np.maximum(r, 0.0)


def root_mesh():
    P, s = root_axis()
    L = s[-1]
    r = root_radius(s, L)
    r[-1] = 0.0
    sides = 40
    T, N, Bn = pl.frames(P)
    th = np.linspace(0, 2 * math.pi, sides, endpoint=False)
    # epidermal cells: long domes in staggered files round the root
    files = 16
    cell_len = 0.24
    j = np.floor(th / (2 * math.pi) * files)
    u = th / (2 * math.pi) * files - j
    stagger = (j % 2) * 0.5
    v = s[:, None] / cell_len + stagger[None, :]
    vi = np.floor(v)
    vf = v - vi
    dome = np.sin(math.pi * u)[None, :] ** 0.6 * np.sin(math.pi * vf) ** 0.4
    bump = 1 + 0.035 * dome - 0.02
    # no cell relief on the cap
    cap = pl.smooth(0.5, 0.25, (L - s))[:, None]
    bump = bump * (1 - cap) + cap
    R = r[:, None] * bump
    V = P[:, None, :] + R[..., None] * (np.cos(th)[None, :, None] * N[:, None, :] + np.sin(th)[None, :, None] * Bn[:, None, :])
    V = V.reshape(-1, 3)
    M = len(P)
    F = []
    for i in range(M - 1):
        for k in range(sides):
            k2 = (k + 1) % sides
            F.append([i * sides + k, i * sides + k2, (i + 1) * sides + k2, (i + 1) * sides + k])
    F = np.asarray(F)
    # outward winding
    e1 = V[F[0, 1]] - V[F[0, 0]]
    e2 = V[F[0, 3]] - V[F[0, 0]]
    if np.dot(np.cross(e1, e2), V[F[0, 0]] - P[0]) < 0:
        F = F[:, ::-1]
    tcol = np.repeat(pl.smooth(0.55, 0.15, L - s), sides)
    col = pl.mix(C["root"], C["rootCap"], tcol)
    return V, pl.quads_to_tris(F), col


def stele_mesh():
    P, s = root_axis()
    L = s[-1]
    m = s < L - 0.3
    r = 0.085 * np.ones(m.sum())
    r[-6:] *= np.linspace(1, 0.3, 6)
    V, F, t, a = pl.sweep(P[m], r, sides=16, cap_start=False, cap_end=True)
    return V, pl.quads_to_tris(F)


class Soil:
    """The particles, laid out once so the hairs, the water and the meta agree."""

    def __init__(self, seed=17):
        rng = pl.rng(seed)
        P, s = root_axis()
        self.grains = []  # (centre, radii, rotation matrix, kind)
        tries = 0
        while len(self.grains) < 58 and tries < 20000:
            tries += 1
            c = np.array([rng.uniform(-2.2, 2.2), rng.uniform(-1.6, 1.55), rng.uniform(-0.75, 0.45)])
            kind = rng.choice(["sand", "sand", "silt", "clay", "humus"], p=[0.3, 0.2, 0.2, 0.2, 0.1])
            base = {"sand": rng.uniform(0.17, 0.34), "silt": rng.uniform(0.07, 0.12), "clay": rng.uniform(0.14, 0.26), "humus": rng.uniform(0.12, 0.2)}[kind]
            radii = base * np.array([rng.uniform(0.85, 1.25), rng.uniform(0.7, 1.0), rng.uniform(0.8, 1.1)])
            # clear of the root, and not overlapping another particle much
            d_root = np.min(np.linalg.norm(P - c, axis=1))
            if d_root < ROOT_R + radii.max() + 0.04:
                continue
            if any(np.linalg.norm(c - g[0]) < 0.9 * (radii.min() + g[1].min()) + 0.02 for g in self.grains):
                continue
            q = rng.normal(size=4)
            q /= np.linalg.norm(q)
            w, x, y, z = q
            Rm = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)], [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)], [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]])
            self.grains.append((c, radii, Rm, kind, int(rng.integers(0, 1000))))
        self.hairs = self._grow_hairs(rng, P, s)

    def grain_dist(self, X):
        d = np.full(len(X), 9.0)
        for c, r, Rm, kind, sd in self.grains:
            q = (X - c) @ Rm
            k0 = np.linalg.norm(q / r, axis=1)
            k1 = np.linalg.norm(q / (r * r), axis=1)
            d = np.minimum(d, k0 * (k0 - 1.0) / np.maximum(k1, 1e-9))
        return d

    def _grow_hairs(self, rng, P, s):
        L = s[-1]
        T, N, Bn = pl.frames(P)
        hairs = []
        # hairs from 0.75 to 3.0 behind the tip, older ones longer
        for k in range(110):
            from_tip = rng.uniform(0.8, 3.1)
            i = int(np.argmin(np.abs((L - s) - from_tip)))
            ang = rng.uniform(0, 2 * math.pi)
            out = math.cos(ang) * N[i] + math.sin(ang) * Bn[i]
            # the viewer sees the front: favour hairs that are not hidden behind
            if out[2] < -0.55 and rng.random() < 0.7:
                continue
            base = P[i] + out * (ROOT_R * 0.98)
            length = float(np.interp(from_tip, [0.8, 3.1], [0.3, 1.7])) * rng.uniform(0.7, 1.15)
            d = out + T[i] * rng.uniform(-0.15, 0.15)
            d /= np.linalg.norm(d)
            pts = [base]
            p = base.copy()
            step = 0.03
            ph = rng.uniform(0, 6.28, 2)
            for j in range(int(length / step)):
                q = p + d * step
                # steer round particles: away from any that is too close
                g = self.grain_dist(q[None, :])[0]
                if g < 0.03:
                    # nudge sideways along the particle's surface
                    e = 0.01
                    grad = np.array([(self.grain_dist((q + e * ax)[None, :])[0] - g) / e for ax in np.eye(3)])
                    grad /= max(np.linalg.norm(grad), 1e-9)
                    d = d + grad * 0.8
                d = d + 0.08 * np.array([math.sin(j * 0.2 + ph[0]), math.sin(j * 0.17 + ph[1]), 0.0])
                d /= np.linalg.norm(d)
                p = p + d * step
                if abs(p[0]) > 2.35 or abs(p[1]) > 1.75 or p[2] > 0.6 or p[2] < -0.9:
                    break
                pts.append(p.copy())
            if len(pts) >= 5:
                hairs.append(np.asarray(pts))
        return hairs

    def hair_dist(self, X):
        d = np.full(len(X), 9.0)
        for h in self.hairs:
            for a, b in zip(h[:-1:2], h[2::2]):
                d = np.minimum(d, sdf.capsule(X, a, b, 0.026, 0.026))
        return d


def hair_meshes(soil):
    parts = []
    for h in soil.hairs:
        m = len(h)
        r = np.interp(np.linspace(0, 1, m), [0, 0.06, 1], [0.04, 0.027, 0.023])
        V, F, t, a = pl.sweep(h[::2] if len(h) > 12 else h, r[::2] if len(h) > 12 else r, sides=7, cap_start=False, cap_end=True)
        parts.append((V, F))
    return pl.combine(parts)


def grain_meshes(soil):
    parts = []
    cols = []
    for c, r, Rm, kind, sd in soil.grains:
        V, F = pl.ellipsoid_mesh((0, 0, 0), r, nu=22, nv=13)
        n = sdf.fbm(V + sd, np.array([0.12, 0.12, 0.12]) * r.max() * 3, 3, sd)
        if kind == "sand":
            # sub-angular: a few flat facets, rounded edges
            amp = 0.12
            n = np.sign(n) * np.abs(n) ** 0.6
        elif kind in ("clay", "humus"):
            # crumbly aggregates
            amp = 0.2
            n = n + 0.5 * sdf.value_noise(V * 3.0 + sd, np.array([0.04, 0.04, 0.04]), sd + 1)
        else:
            amp = 0.1
        V = V * (1 + amp * n)[:, None]
        V = V @ Rm.T + c
        tone = {"sand": C["sand"] if sd % 2 else C["sand2"], "silt": C["silt"], "clay": C["clay"], "humus": C["humus"]}[kind]
        col = tone[None, :] * (0.9 + 0.12 * n)[:, None]
        parts.append((V, F))
        cols.append(col)
    V, F = pl.combine(parts)
    return V, F, np.concatenate(cols)


def water_field(soil, film=0.032):
    """Water: a film round every particle, hair and the root, bridging the
    narrow gaps between them."""
    P, s = root_axis()
    L = s[-1]

    def root_d(X):
        d = np.full(len(X), 9.0)
        for i in range(0, len(P) - 4, 4):
            if s[i] > L - 0.45:
                break
            d = np.minimum(d, sdf.capsule(X, P[i], P[i + 4], ROOT_R, ROOT_R))
        return d

    def f(X):
        g = soil.grain_dist(X)
        h = soil.hair_dist(X)
        r = root_d(X)
        d = sdf.smin(g, h, 0.1)
        d = sdf.smin(d, r, 0.08)
        return d - film

    return f


def meta(soil):
    P, s = root_axis()
    return {
        "axis": [p.round(3).tolist() for p in P[::6]],
        "hairs": [h[:: max(1, len(h) // 12)].round(3).tolist() + [h[-1].round(3).tolist()] for h in soil.hairs],
        "radius": ROOT_R,
    }

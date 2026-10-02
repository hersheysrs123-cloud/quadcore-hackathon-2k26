"""The models of the carbon-cycle diorama, each in its own frame, y up,
standing on y = 0 and facing +x where facing matters.

  broadleaf    a broadleaf tree (an oak or beech in full leaf), metres
  conifer      a spruce, metres
  stump        a felled stump with its cut face, metres
  cow          a Holstein cow, decimetres
  plant        a coal-fired power station: turbine hall, boiler house, two
               stacks, a coal heap and its conveyor, metres

The trees' canopies, the cow and the coal heap are signed-distance
sculptures meshed by scripts/arm-model's mesher; the rest is parametric.
Colours are per vertex, in sRGB terms.
"""

import math

import numpy as np

import plantlib as pl
from plantlib import sdf

H = pl.hex_rgb


def _noise(P, scale, seed):
    return sdf.value_noise(np.asarray(P, dtype=np.float64), scale, seed)


# ─── Trees ─────────────────────────────────────────────────────────


def _trunk_parts(height, base_r, top_r, branches, seed):
    """A trunk with a flared foot, and branches sweeping up into the crown."""
    r = pl.rng(seed)
    parts = []
    path = pl.catmull([(0, 0, 0), (0.05, height * 0.35, 0.03), (-0.04, height * 0.7, -0.02), (0.02, height, 0.0)], 8)
    t = np.linspace(0, 1, len(path))
    rad = base_r + (top_r - base_r) * t + base_r * 0.7 * np.exp(-t / 0.05)
    V, F, tt, aa = pl.sweep(path, rad * 1.3, sides=12, cap_start=False, cap_end=True)
    parts.append((V, pl.quads_to_tris(F)))
    for k in range(branches):
        phi = k * 2 * math.pi / branches + r.uniform(-0.3, 0.3)
        y0 = height * r.uniform(0.62, 0.92)
        out = np.array([math.cos(phi), 0, math.sin(phi)])
        p0 = np.array([0, y0, 0])
        bp = pl.catmull([p0, p0 + out * 0.7 + [0, 0.7, 0], p0 + out * 1.4 + [0, 1.6, 0]], 6)
        V, F, _, _ = pl.sweep(bp, np.linspace(top_r * 0.8, top_r * 0.35, len(bp)), sides=7)
        parts.append((V, pl.quads_to_tris(F)))
    V, F = pl.combine(parts)
    bark = pl.mix(H("#4a3a2b"), H("#6b5741"), 0.5 + 0.5 * _noise(V * [3, 0.6, 3], 1.0, seed))
    return V, F, bark


def broadleaf_field(seed=1):
    """The crown: a cluster of leafy lobes, lumpy at the scale of sprays."""
    r = pl.rng(seed)
    blobs = [((0.0, 5.7, 0.0), (2.2, 1.7, 2.2))]
    for k in range(9):
        phi = k * 2 * math.pi / 9 + r.uniform(-0.25, 0.25)
        rad = r.uniform(1.4, 2.1)
        y = r.uniform(4.6, 6.6)
        blobs.append(((math.cos(phi) * rad, y, math.sin(phi) * rad), (r.uniform(1.1, 1.5), r.uniform(0.9, 1.2), r.uniform(1.1, 1.5))))
    blobs.append(((0.2, 7.0, -0.1), (1.4, 1.1, 1.4)))

    def f(P):
        d = None
        for c, rr in blobs:
            v = sdf._ellipsoid(P, c, rr, (0, 0, 0))
            d = v if d is None else sdf.smin(d, v, 0.6)
        return sdf.roughen(d, P, 0.22, 0.55, seed=seed + 4, octaves=2)

    return f, blobs


def broadleaf_colour(seed):
    def colour(P, N):
        light = pl.smooth(-0.6, 0.9, N[:, 1] + 0.25 * N[:, 0])
        n = 0.5 + 0.5 * _noise(P, 0.9, seed)
        C = pl.mix(H("#1f4a22"), H("#4c8a36"), light * 0.8 + n * 0.25)
        C = pl.mix(C, H("#7aa846"), pl.smooth(0.75, 1.0, light) * pl.smooth(0.55, 0.8, n) * 0.6)
        # The inside of the crown is shaded.
        depth = pl.smooth(5.0, 4.0, P[:, 1]) * 0.25
        return np.clip(C * (1 - depth)[:, None], 0, 1)

    return colour


def conifer_field(seed=2):
    """A spruce: tiers of drooping whorls round a tapering spire."""
    tiers = 7

    def f(P):
        d = None
        for k in range(tiers):
            t = k / (tiers - 1)
            y = 1.6 + t * 6.2
            rr = 2.0 * (1 - t) ** 0.9 + 0.35
            v = sdf._round_cone(P, (0, y, 0), (0, y + 1.6 - 0.6 * t, 0), rr, 0.12)
            d = v if d is None else sdf.smin(d, v, 0.25)
        return sdf.roughen(d, P, 0.14, 0.4, seed=seed, octaves=2)

    return f


def conifer_colour(seed):
    def colour(P, N):
        light = pl.smooth(-0.5, 0.9, N[:, 1] + 0.2 * N[:, 0])
        n = 0.5 + 0.5 * _noise(P, 0.6, seed)
        C = pl.mix(H("#0f2e22"), H("#2e5e3c"), light * 0.85 + n * 0.2)
        return np.clip(C, 0, 1)

    return colour


def stump(seed=5):
    """A felled stump: bark round a pale cut face with growth rings."""
    path = np.array([(0, 0, 0), (0, 0.25, 0), (0, 0.55, 0)])
    rad = np.array([0.62, 0.45, 0.42])
    V, F, tt, aa = pl.sweep(pl.catmull(path, 4), np.interp(np.linspace(0, 1, 9), [0, 0.5, 1], rad), sides=14, cap_start=False, cap_end=True)
    top = V[:, 1] > 0.6
    C = pl.mix(H("#4a3a2b"), H("#5e4a36"), 0.5 + 0.5 * _noise(V * 4, 1.0, seed))
    rr = np.linalg.norm(V[:, [0, 2]], axis=1)
    C[top] = pl.mix(H("#c9a777"), H("#a5824f"), (0.5 + 0.5 * np.sin(rr[top] * 40)) * 0.6)
    return V, pl.quads_to_tris(F), C


# ─── Cow ───────────────────────────────────────────────────────────


def cow():
    """A Holstein cow standing square, decimetres, facing +x, hooves on y = 0."""
    E, C_, RC = sdf._ellipsoid, sdf._capsule, sdf._round_cone
    p = {
        "body": lambda P: sdf.smin(
            sdf.smin(E(P, (0, 9.6, 0), (7.8, 4.4, 3.6), (0, 0, 0)), E(P, (-5.6, 10.3, 0), (3.8, 4.0, 3.4), (0, 0, 0)), 1.5),
            sdf.smin(E(P, (5.6, 9.4, 0), (3.6, 4.4, 3.2), (0, 0, 0)), E(P, (0, 8.2, 0), (6.8, 3.6, 3.7), (0, 0, 0)), 1.5),
            1.5,
        ),
        "neck": lambda P: RC(P, (7.8, 10.6, 0), (11.6, 9.8, 0), 2.6, 1.7),
        "head": lambda P: sdf.smin(E(P, (12.7, 8.9, 0), (2.7, 1.75, 1.6), (0, 0, -0.95)), E(P, (14.4, 7.0, 0), (1.2, 1.15, 1.25), (0, 0, -0.5)), 0.6),
        "ears": lambda P: np.minimum(E(P, (12.0, 10.2, 1.85), (0.75, 0.38, 1.25), (0.3, 0, 0)), E(P, (12.0, 10.2, -1.85), (0.75, 0.38, 1.25), (-0.3, 0, 0))),
        "horns": lambda P: np.minimum(RC(P, (12.4, 10.6, 0.9), (12.7, 11.2, 1.5), 0.3, 0.1), RC(P, (12.4, 10.6, -0.9), (12.7, 11.2, -1.5), 0.3, 0.1)),
        "udder": lambda P: E(P, (-3.6, 5.6, 0), (2.0, 1.4, 1.8), (0, 0, 0)),
        "tail": lambda P: np.minimum(C_(P, (-9.6, 11.6, 0), (-10.3, 4.6, 0), 0.36, 0.28), E(P, (-10.3, 3.9, 0), (0.45, 1.0, 0.45), (0, 0, 0))),
    }
    for side, z in (("L", 2.0), ("R", -2.0)):
        p["front" + side] = lambda P, z=z: sdf.smin(C_(P, (6.3, 8.0, z), (6.6, 3.2, z), 1.25, 0.8), C_(P, (6.6, 3.2, z), (6.7, 0.45, z), 0.8, 0.72), 0.3)
        p["rear" + side] = lambda P, z=z: sdf.smin(
            sdf.smin(C_(P, (-6.2, 8.5, z), (-7.5, 4.0, z * 1.05), 1.55, 0.75), C_(P, (-7.5, 4.0, z * 1.05), (-6.9, 0.45, z * 1.05), 0.75, 0.72), 0.3),
            E(P, (-6.0, 7.6, z * 0.9), (2.0, 2.4, 1.2), (0, 0, 0.3)),
            0.8,
        )
    blends = [("body", 0), ("neck", 1.4), ("head", 0.9), ("ears", 0.3), ("horns", 0.15), ("udder", 0.7), ("tail", 0.3)]
    blends += [(k, 0.9) for k in ("frontL", "frontR", "rearL", "rearR")]

    def field(P):
        d = None
        for name, k in blends:
            v = p[name](P)
            d = v if d is None else sdf.smin(d, v, k)
        return d

    def colour(P, N):
        names = list(p)
        D = np.stack([p[n](P) for n in names], axis=1)
        part = np.array(names)[np.argmin(D, axis=1)]
        WHITE, BLACK = H("#f1efe8"), H("#1d1d21")
        # Holstein patches: large, blotchy, on the body and the upper legs.
        patch = _noise(P * [1, 1, 1.4], 4.5, 3) + 0.35 * _noise(P, 1.6, 9)
        C = np.where((patch > 0.05)[:, None], BLACK, WHITE).astype(np.float64)
        soft = pl.smooth(0.02, 0.07, patch)
        C = pl.mix(WHITE, BLACK, soft)
        legs = np.isin(part, ["frontL", "frontR", "rearL", "rearR"])
        lower = legs & (P[:, 1] < 4.5)
        C[lower] = WHITE
        C[legs & (P[:, 1] < 0.95)] = H("#2b2622")
        head = part == "head"
        C[head] = BLACK
        # A white blaze down the face.
        blaze = head & (np.abs(P[:, 2]) < 0.55) & (P[:, 0] > 12.4)
        C[blaze] = WHITE
        muzzle = head & (P[:, 1] < 7.6) & (P[:, 0] > 13.6)
        C[muzzle] = H("#c9a19a")
        C[part == "ears"] = BLACK
        C[part == "horns"] = H("#d9cfb4")
        C[part == "udder"] = H("#e7b3ad")
        tail = part == "tail"
        C[tail] = pl.mix(WHITE, BLACK, (P[tail, 1] > 8).astype(float))
        C[tail & (P[:, 1] < 5.0)] = H("#2a2420")
        return np.clip(C * (1 + 0.04 * _noise(P, 1.0, 2))[:, None], 0, 1)

    return field, colour


def cow_eyes():
    out = []
    for s in (1, -1):
        c = np.array([12.75, 9.3, 1.2 * s])
        V, F = pl.ellipsoid_mesh((0, 0, 0), (0.28, 0.28, 0.28), nu=10, nv=7)
        out.append((V + c, pl.quads_to_tris(F), np.tile(H("#0e0e10"), (len(V), 1))))
    return out


# ─── Power station ─────────────────────────────────────────────────


def box_grid(lo, hi, step, sides=("px", "nx", "py", "pz", "nz")):
    """An axis-aligned box whose faces are grids `step` apart, so per-vertex
    colour can draw windows and courses on it. No bottom face."""
    lo = np.asarray(lo, dtype=np.float64)
    hi = np.asarray(hi, dtype=np.float64)
    parts = []

    def face(axis, sign):
        a, b = [i for i in range(3) if i != axis]
        na = max(2, int(round((hi[a] - lo[a]) / step)) + 1)
        nb = max(2, int(round((hi[b] - lo[b]) / step)) + 1)
        ua = np.linspace(lo[a], hi[a], na)
        ub = np.linspace(lo[b], hi[b], nb)
        A, B = np.meshgrid(ua, ub, indexing="ij")
        V = np.zeros((na * nb, 3))
        V[:, a] = A.ravel()
        V[:, b] = B.ravel()
        V[:, axis] = hi[axis] if sign > 0 else lo[axis]
        F = []
        for i in range(na - 1):
            for j in range(nb - 1):
                q = [i * nb + j, (i + 1) * nb + j, (i + 1) * nb + j + 1, i * nb + j + 1]
                F.append(q)
        F = np.asarray(F)
        # Outward winding: (a, b) right-handed with the axis when sign > 0.
        right = (axis, a, b) in ((0, 1, 2), (1, 2, 0), (2, 0, 1))
        if right != (sign > 0):
            F = F[:, ::-1]
        return V, F

    for s in sides:
        axis = "xyz".index(s[1])
        parts.append(face(axis, 1 if s[0] == "p" else -1))
    return pl.combine(parts)


def _windows(P, lo, hi, every, rows, sill=0.25):
    """1 where a window is: a grid of panes on the walls of a block."""
    # Panes run along whichever axis the wall runs along.
    on_x = (np.abs(P[:, 0] - lo[0]) < 1e-6) | (np.abs(P[:, 0] - hi[0]) < 1e-6)
    u = np.where(on_x, np.mod(P[:, 2] - lo[2], every), np.mod(P[:, 0] - lo[0], every)) / every
    y = P[:, 1]
    win = np.zeros(len(P))
    for y0, y1 in rows:
        band = (y > y0) & (y < y1)
        col = (u > sill) & (u < 1 - sill)
        win = np.maximum(win, (band & col).astype(float))
    return win


def power_station(seed=7):
    """Turbine hall and boiler house in brick, two banded stacks, a coal heap
    and the conveyor that feeds it in. Metres; the station is ~60 m long."""
    parts = []
    cols = []
    BRICK = H("#7b4a3a")
    BRICK2 = H("#6a3f31")
    GLASS = H("#2b3b4c")
    # Turbine hall: long and low, with a band of tall windows.
    lo, hi = np.array([-14.0, 0, -7.0]), np.array([10.0, 11.0, 7.0])
    V, F = box_grid(lo, hi, 0.5)
    w = _windows(V, lo, hi, 2.5, [(4.2, 8.8)], 0.22)
    course = (np.mod(V[:, 1], 1.0) < 0.12).astype(float) * 0.15
    C = pl.mix(pl.mix(BRICK, BRICK2, course + 0.3 * (0.5 + 0.5 * _noise(V, 2.0, seed))), GLASS, w)
    C[V[:, 1] >= hi[1] - 1e-6] = H("#4b4f55")
    parts.append((V, F))
    cols.append(C)
    # Boiler house: taller, behind the hall's east end.
    lo, hi = np.array([2.0, 0, -6.0]), np.array([14.0, 20.0, 6.0])
    V, F = box_grid(lo, hi, 0.5)
    w = _windows(V, lo, hi, 2.4, [(4.0, 6.0), (9.0, 11.0), (14.0, 16.0)], 0.3)
    C = pl.mix(pl.mix(BRICK2, BRICK, 0.3 * (0.5 + 0.5 * _noise(V, 2.0, seed + 1))), GLASS, w)
    C[V[:, 1] >= hi[1] - 1e-6] = H("#44484e")
    parts.append((V, F))
    cols.append(C)
    # Two stacks, concrete, with red and white bands near the top.
    for x in (6.0, 11.0):
        path = np.array([(x, 0, -1.0), (x, 18, -1.0), (x, 36, -1.0)])
        path = pl.catmull(path, 12)
        rad = np.interp(path[:, 1], [0, 36], [1.6, 1.15])
        V, F, tt, aa = pl.sweep(path, rad, sides=16, cap_start=False, cap_end=False)
        y = V[:, 1]
        C = pl.mix(H("#a7a39b"), H("#8d8980"), 0.5 + 0.5 * _noise(V * [1, 0.3, 1], 1.0, seed + 3))
        band = (y > 29) & (np.mod(y - 29, 2.4) < 1.2)
        C[band] = H("#b23a32")
        C[(y > 29) & ~band] = H("#e7e3dc")
        C[y > 35.3] = H("#2a2a2c")
        parts.append((V, pl.quads_to_tris(F)))
        cols.append(C)
        # A dark rim inside the mouth.
        inner = path[-4:]
        Vi, Fi, _, _ = pl.sweep(inner, np.full(len(inner), 1.0), sides=16, cap_start=False, cap_end=False)
        parts.append((Vi, pl.quads_to_tris(Fi)[:, ::-1]))
        cols.append(np.tile(H("#141416"), (len(Vi), 1)))
    # A covered conveyor gallery from the heap up to the turbine hall's west
    # wall, where the coal goes in to the boiler, on two trestles.
    a, b = np.array([-19.5, 1.6, 0.0]), np.array([-14.0, 9.2, 0.0])
    d = b - a
    L = float(np.linalg.norm(d))
    th = math.atan2(d[1], d[0])
    R = np.array([[math.cos(th), -math.sin(th), 0], [math.sin(th), math.cos(th), 0], [0, 0, 1.0]])
    V, F = box_grid((0, -0.8, -1.1), (L, 0.8, 1.1), 0.4, sides=("px", "nx", "py", "ny", "pz", "nz"))
    V = V @ R.T + a
    C = pl.mix(H("#6b7078"), H("#868b93"), (np.mod(V[:, 0] * 2.5, 1.0) < 0.5).astype(float) * 0.5)
    parts.append((V, F))
    cols.append(C)
    for x in (-18.2, -16.2):
        y = a[1] + (x - a[0]) * d[1] / d[0] - 0.9
        V, F = box_grid((x - 0.25, 0, -0.9), (x + 0.25, y, 0.9), 0.5)
        parts.append((V, F))
        cols.append(np.tile(H("#4a4e55"), (len(V), 1)))
    V, F = pl.combine(parts)
    return V, F, np.concatenate(cols)


def coal_heap_field(seed=8):
    def f(P):
        d = sdf._ellipsoid(P, (-25.5, -1.5, 0.0), (7.5, 5.0, 6.0), (0, 0.4, 0))
        d = sdf.smax(d, -P[:, 1], 0.3)
        return sdf.roughen(d, P, 0.45, 1.2, seed=seed, octaves=3)

    return f


def coal_colour(P, N):
    n = 0.5 + 0.5 * _noise(P, 0.5, 3)
    C = pl.mix(H("#141417"), H("#2d2d33"), n)
    glint = (_noise(P, 0.18, 6) > 0.6) & (N[:, 1] > 0.2)
    C[glint] = H("#4a4d57")
    return np.clip(C, 0, 1)


def meta():
    return {
        "units": {"broadleaf": "m", "conifer": "m", "stump": "m", "cow": "dm", "plant": "m"},
        # Where the stacks' mouths and the furnace door are, in the plant's metres.
        "stacks": [[6.0, 36.0, -1.0], [11.0, 36.0, -1.0]],
        "furnace": [-3.0, 2.4, 7.0],
        "heap": [-25.5, 0.0, 0.0],
    }

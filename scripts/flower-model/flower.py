"""The half-flower of the pollination scene, in the scene's own units (y up).

A generic insect-pollinated dicot flower cut down the middle, as a botany
practical dissects one: the cut is the plane z = 0 and everything with z > 0
has been taken away. Solid organs (pedicel, receptacle, carpel, ovules,
nectary, the sticky stigma) are signed-distance fields cut by that plane, so
their cut faces are real faces, painted as fresh tissue: a green epidermis,
pale cortex, dark vascular strands and the pale transmitting tract the pollen
tube grows down. Thin organs (petals, sepals, tepals, filaments, the plumes
of the feathery stigma) are parametric surfaces and sweeps; the scene clips
the petals and sepals at z = 0 so the ones crossing the cut are halved too.

Each function returns scene-space geometry for one node; build_flower.py
meshes, paints and exports them.
"""

import math

import numpy as np

import plantlib as pl

sdf = pl.sdf
H = pl.hex_rgb
sm = pl.smooth

# ─── Layout (the scene reads these through the generated meta) ─────

PEDICEL_BOTTOM = -3.0
RECEP_C = np.array([0.0, 0.08, 0.0])
RECEP_R = (1.02, 0.24, 1.02)
OVARY_C = np.array([0.0, 1.05, 0.0])
OVARY_R = (0.88, 1.02, 0.8)
LOCULE_C = np.array([0.0, 1.06, 0.0])
LOCULE_R = (0.7, 0.81, 0.62)
PLACENTA = (np.array([0.0, 0.25, 0.0]), (0.34, 0.15, 0.3))
STYLE_BOTTOM, STYLE_TOP = 1.72, 4.64
STYLE_R = (0.205, 0.15)
STIGMA_Y = 4.75
# Orthotropous ovules on a basal placenta, micropyle up towards the style.
OVULES = [
    {"centre": (0.33, 1.02, -0.02), "rx": 0.27, "ry": 0.4, "root": (0.12, 0.34)},
    {"centre": (-0.36, 0.95, -0.06), "rx": 0.25, "ry": 0.36, "root": (-0.12, 0.34)},
]
NECTARY = {"radius": 0.64, "y": 0.33, "tube": 0.085}
STAMEN_BASE = {"radius": 0.95, "y": 0.22}
PETAL_BASE = {"radius": 0.98, "y": 0.16}
SEPAL_BASE = {"radius": 0.88, "y": 0.02}
TEPAL_BASE = {"radius": 0.9, "y": 0.2}
ANTHER_INSECT = (0.14, 3.92)
ANTHER_WIND = (0.72, 4.08)

CUT_EPS = 0.0045


def cut_mask(P, N):
    """Points on the dissection plane z = 0, facing the viewer."""
    return (np.abs(P[:, 2]) < CUT_EPS) & (N[:, 2] > 0.55)


def _seg_dist(P2, a, b):
    a = np.asarray(a, dtype=np.float64)
    ba = np.asarray(b, dtype=np.float64) - a
    pa = P2 - a
    t = np.clip((pa @ ba) / max(ba @ ba, 1e-12), 0.0, 1.0)
    return np.linalg.norm(pa - t[:, None] * ba, axis=1)


def poly_dist(P2, pts):
    """Distance in the cut plane (x, y) to a polyline through pts."""
    pts = pl.catmull(pts, 6) if len(pts) > 2 else np.asarray(pts, dtype=np.float64)
    d = np.full(len(P2), 1e9)
    for i in range(len(pts) - 1):
        d = np.minimum(d, _seg_dist(P2, pts[i], pts[i + 1]))
    return d


def mix(a, b, t):
    return pl.mix(np.asarray(a, dtype=np.float64), np.asarray(b, dtype=np.float64), np.clip(t, 0, 1))


# ─── Blades: petals, sepals, tepals ────────────────────────────────


def blade(L, W, width, heading, cup, nu=56, nv=33, wave=0.0, seed=0.0):
    """A thin blade, base at the origin, running out along +x and curving in
    the xy plane (its heading a(u) in radians above the horizontal), z across.
    Returns V, F (upper face outward) and the leaf coordinates (u along,
    v across, -1..1)."""
    s = np.linspace(0, 1, nu)
    u = np.sin(s * np.pi / 2)  # denser towards the apex, where the outline turns
    v = np.linspace(-1, 1, nv)
    a = heading(u)
    du = np.diff(u)
    am = (a[1:] + a[:-1]) / 2
    cx = np.concatenate([[0], np.cumsum(np.cos(am) * du * L)])
    cy = np.concatenate([[0], np.cumsum(np.sin(am) * du * L)])
    w = W * np.maximum(width(u), 0.012)
    U, Vv = np.meshgrid(u, v, indexing="ij")
    nx, ny = -np.sin(a), np.cos(a)
    disp = cup(u)[:, None] * Vv**2 * W + wave * W * np.sin(11 * U + 3.0 * Vv + seed) * np.abs(Vv) ** 3 * sm(0.2, 0.7, U)
    X = cx[:, None] + nx[:, None] * disp
    Y = cy[:, None] + ny[:, None] * disp
    Z = Vv * w[:, None]
    V = np.stack([X, Y, Z], axis=-1).reshape(-1, 3)
    F = []
    for i in range(nu - 1):
        for j in range(nv - 1):
            F.append([i * nv + j, i * nv + j + 1, (i + 1) * nv + j + 1, (i + 1) * nv + j])
    return V, np.asarray(F), np.stack([U.ravel(), Vv.ravel()], axis=1)


def petal():
    """Broadly obovate on a short claw, cupped and gently ruffled: the petal
    of a wild rose or apple blossom, white at the claw flushing to pink."""

    def width(u):
        base = 0.15 + 0.85 * np.sin(np.clip(u / 0.62, 0, 1) * np.pi / 2) ** 1.5
        tip = np.sqrt(np.clip(1 - ((u - 0.62) / 0.38) ** 2, 0, 1))
        return np.where(u > 0.62, base * tip, base)

    V, F, uvl = blade(2.75, 0.92, width, lambda u: 1.3 - 1.0 * u**1.2, lambda u: 0.26 * np.sin(np.pi * np.clip(u, 0, 1)) ** 0.7, nu=64, nv=41, wave=0.05, seed=1.3)
    u, v = uvl[:, 0], uvl[:, 1]
    edge = np.maximum(np.abs(v), sm(0.78, 1.0, u))
    c = mix(H("#f6a2c8"), H("#e2559a"), sm(0.45, 1.0, edge) * 0.85)
    c = mix(H("#fff6ea"), c, sm(0.04, 0.34, u))  # white claw
    c = mix(c, H("#fde9a8"), (1 - sm(0.0, 0.1, u)) * 0.55)  # a yellow nectar guide at the base
    return V, F, c, uvl


def sepal():
    """Ovate, acuminate, slightly cupped, with a paler midrib."""

    def width(u):
        return (0.55 + 0.45 * sm(0.0, 0.3, u)) * np.sin(np.pi * (0.22 + 0.78 * u**0.85))

    V, F, uvl = blade(1.3, 0.36, width, lambda u: 0.5 - 0.55 * u, lambda u: 0.18 * np.sin(np.pi * u), nu=36, nv=17)
    u, v = uvl[:, 0], uvl[:, 1]
    c = mix(H("#3c7a2a"), H("#5f9f3f"), sm(0.0, 0.4, u))
    c = mix(c, H("#86b85c"), np.exp(-((v / 0.1) ** 2)) * 0.7)
    c = mix(c, H("#7b8a3a"), sm(0.75, 1.0, np.abs(v)) * 0.5 + sm(0.85, 1.0, u) * 0.4)
    return V, F, c, uvl


def tepal():
    """A wind flower's reduced perianth: a small, dull, papery scale."""

    def width(u):
        return (0.6 + 0.4 * sm(0.0, 0.25, u)) * np.sin(np.pi * (0.25 + 0.75 * u**0.9))

    V, F, uvl = blade(0.78, 0.17, width, lambda u: 1.15 - 0.45 * u, lambda u: 0.3 * np.sin(np.pi * u), nu=24, nv=11)
    u, v = uvl[:, 0], uvl[:, 1]
    c = mix(H("#9fae6a"), H("#c6c08a"), sm(0.1, 0.7, u))
    c = mix(c, H("#e3dcb8"), sm(0.6, 1.0, np.abs(v)) * 0.7)
    c = mix(c, H("#8a6f45"), sm(0.8, 1.0, u) * 0.7)
    return V, F, c, uvl


# ─── The body: pedicel, receptacle and carpel, cut down the middle ─


def ovary_outer(P):
    """The ovary, with five faint ribs (the carpel's sutures and bundles)."""
    q = P - OVARY_C
    th = np.arctan2(q[:, 2], q[:, 0])
    s = 1 + 0.02 * np.cos(5 * th + 0.6)
    Q = OVARY_C + q / s[:, None]
    return sdf._ellipsoid(Q, OVARY_C, OVARY_R, (0, 0, 0)) * s


def locule(P):
    loc = sdf._ellipsoid(P, LOCULE_C, LOCULE_R, (0, 0, 0))
    plac = sdf._ellipsoid(P, PLACENTA[0], PLACENTA[1], (0, 0, 0))
    return sdf.cut(loc, plac, 0.08)


def body_full(P):
    ped = sdf._round_cone(P, (0, PEDICEL_BOTTOM, 0), (0, -0.05, 0), 0.13, 0.17)
    rec = sdf._ellipsoid(P, RECEP_C, RECEP_R, (0, 0, 0))
    d = sdf.smin(ped, rec, 0.4)
    d = sdf.smin(d, ovary_outer(P), 0.14)
    sty = sdf._round_cone(P, (0, STYLE_BOTTOM, 0), (0, STYLE_TOP, 0), STYLE_R[0], STYLE_R[1])
    d = sdf.smin(d, sty, 0.32)
    return sdf.cut(d, locule(P), 0.03)


def dissect(d, P):
    """Cut a field at z = 0 with a slightly softened edge, so the meshed rim
    is a clean curve, not a voxel staircase."""
    return sdf.smax(d, P[:, 2], 0.012)


def body_field(P):
    return dissect(body_full(P), P)


def _bundles():
    """Vascular strands in the cut plane, as (x, y) polylines, mirrored."""
    one = [
        # pedicel → receptacle → sepal, petal and stamen traces
        [(0.085, PEDICEL_BOTTOM), (0.09, -0.6), (0.12, -0.1), (0.4, 0.02), (0.82, 0.03)],
        [(0.12, -0.1), (0.5, 0.1), (0.92, 0.16)],
        [(0.12, -0.1), (0.45, 0.17), (0.88, 0.25)],
        # dorsal bundle up the ovary wall into the style
        [(0.12, -0.1), (0.4, 0.2), (0.7, 0.62), (0.8, 1.05), (0.7, 1.55), (0.42, 1.92), (0.11, 2.3), (0.085, 3.4), (0.07, 4.55)],
        # ventral bundle to the placenta
        [(0.09, -0.1), (0.07, 0.15), (0.12, 0.33)],
    ]
    out = []
    for p in one:
        out.append(p)
        out.append([(-x, y) for x, y in p])
    return out


BUNDLES = None


def tissue(P, depth, green, cortex="#cfe3a6", pith="#e9f2d6"):
    """A fresh cut face: a thin green epidermis, a cortex paling inwards, and
    dark strands where the vascular bundles were sliced along their length."""
    global BUNDLES
    if BUNDLES is None:
        BUNDLES = _bundles()
    P2 = P[:, :2]
    c = mix(H(cortex), H(pith), sm(0.03, 0.12, depth))
    c = mix(H(green), c, sm(0.006, 0.028, depth))
    d = np.full(len(P), 1e9)
    for b in BUNDLES:
        d = np.minimum(d, poly_dist(P2, b))
    c = mix(c, H("#b6d48a"), (1 - sm(0.012, 0.03, d)) * 0.8)
    c = mix(c, H("#5f8f3c"), 1 - sm(0.004, 0.011, d))
    # A faint mottle of cells.
    n = sdf.value_noise(P, 0.018, 7)
    return c * (1 + 0.035 * n[:, None])


def body_colour(P, N):
    cutf = cut_mask(P, N)
    y = P[:, 1]
    stem =mix(H("#3e7c2e"), H("#57943a"), sm(-3.0, 0.0, y))
    streak = sdf.value_noise(P, (0.05, 0.6, 0.05), 3)
    stem = stem * (1 + 0.06 * streak[:, None])
    ovary = mix(H("#7fb94b"), H("#9fd060"), sm(0.3, 1.6, y))
    q = P - OVARY_C
    rib = np.cos(5 * np.arctan2(q[:, 2], q[:, 0]) + 0.6)
    ovary = mix(ovary, H("#6aa23c"), sm(0.85, 1.0, rib) * 0.5)
    style = mix(H("#bfe08e"), H("#e4efb0"), sm(2.0, 4.6, y))
    c = mix(stem, ovary, sm(0.18, 0.4, y))
    c = np.where((y > 1.9)[:, None], mix(ovary, style, sm(1.9, 2.4, y)), c)
    # The locule's lining, inside the ovary.
    inner = (np.abs(locule(P)) < 0.025) & ~cutf
    c = np.where(inner[:, None], mix(H("#eef4dc"), H("#d8e8bd"), sm(0.2, 0.6, y)), c)
    if cutf.any():
        Pc = P[cutf]
        depth = -body_full(Pc)
        green = np.where((Pc[:, 1] > 1.9)[:, None], H("#a9cf6e"), H("#5f9a3a"))
        t = tissue(Pc, depth, "#5f9a3a")
        t = np.where((Pc[:, 1] > 1.9)[:, None], mix(green, t, sm(0.006, 0.025, depth)), t)
        # The transmitting tract down the middle of the style.
        tract = (1 - sm(0.035, 0.06, np.abs(Pc[:, 0]))) * sm(1.8, 2.1, Pc[:, 1])
        t = mix(t, H("#f6f1c4"), tract * 0.85)
        c[cutf] = t
    return c


# ─── Ovules ────────────────────────────────────────────────────────


def _ovule_parts(P, o):
    c = np.asarray(o["centre"], dtype=np.float64)
    rx, ry = o["rx"], o["ry"]
    outer = sdf._ellipsoid(P, c, (rx, ry, rx * 0.9), (0, 0, 0))
    sac_c = c + np.array([0.0, 0.03 * ry, 0.0])
    sac = sdf._ellipsoid(P, sac_c, (rx * 0.52, ry * 0.62, rx * 0.47), (0, 0, 0))
    canal = sdf._capsule(P, c + np.array([0, ry * 0.5, 0]), c + np.array([0, ry * 1.15, 0]), 0.03, 0.045)
    return c, outer, sac, canal


def ovules_full(P):
    d = None
    for o in OVULES:
        c, outer, sac, canal = _ovule_parts(P, o)
        x0, y0 = o["root"]
        fun = sdf._round_cone(P, (x0, y0, c[2]), (c[0], c[1] - o["ry"] + 0.05, c[2]), 0.05, 0.062)
        e = sdf.smin(outer, fun, 0.06)
        e = sdf.cut(e, sac, 0.015)
        e = sdf.cut(e, canal, 0.012)
        d = e if d is None else np.minimum(d, e)
    return d


def ovules_field(P):
    return dissect(ovules_full(P), P)


def ovules_colour(P, N):
    cutf = cut_mask(P, N)
    c = np.tile(H("#eef0d4"), (len(P), 1))
    for o in OVULES:
        cc, outer, sac, canal = _ovule_parts(P, o)
        near = outer < 0.03
        # Chalaza (where the funicle joins) greener; the micropyle a darker pore.
        c = np.where((near & (P[:, 1] < cc[1] - o["ry"] * 0.6))[:, None], mix(c, H("#c9e09a"), 0.7), c)
        inside_sac = (np.abs(sac) < 0.02) & ~cutf
        c = np.where(inside_sac[:, None], H("#fffbe9"), c)
        rim = cutf & (outer < 0.02)
        if rim.any():
            depth = -outer[rim]
            layer = mix(H("#f3eecf"), H("#e6dfb6"), sm(0.035, 0.05, depth))  # outer → inner integument
            layer = mix(layer, H("#d9cf9e"), (1 - sm(0.0, 0.006, np.abs(depth - 0.042))) * 0.8)
            layer = mix(layer, H("#f8f4e4"), sm(0.08, 0.1, depth))  # nucellus
            c[rim] = layer
        c = np.where((canal < 0.02)[:, None], mix(c, H("#a89a62"), 0.55), c)
    stalk = P[:, 1] < 0.62
    c = np.where(stalk[:, None], mix(c, H("#cfe3a8"), 0.8), c)
    return c


# ─── Nectary ───────────────────────────────────────────────────────


def nectary_full(P):
    q = P - np.array([0.0, NECTARY["y"], 0.0])
    th = np.arctan2(q[:, 2], q[:, 0])
    R = NECTARY["radius"] * (1 + 0.04 * np.cos(5 * th))
    xz = np.hypot(q[:, 0], q[:, 2]) - R
    r = NECTARY["tube"] * (1 + 0.25 * np.cos(5 * th))
    return np.sqrt(xz * xz + (q[:, 1] * 1.25) ** 2) - r


def nectary_field(P):
    return dissect(nectary_full(P), P)


def nectary_colour(P, N):
    cutf = cut_mask(P, N)
    n = sdf.value_noise(P, 0.02, 5)
    c = mix(H("#c8cf3c"), H("#e7e46a"), 0.5 + 0.5 * n)
    c[cutf] = H("#eef0a0")
    return c


# ─── Stigmas ───────────────────────────────────────────────────────


def stigma_sticky_full(P):
    neck = sdf._round_cone(P, (0, STYLE_TOP - STIGMA_Y - 0.25, 0), (0, -0.05, 0), STYLE_R[1] * 0.98, 0.2)
    head = sdf._ellipsoid(P, (0, 0.06, 0), (0.31, 0.2, 0.29), (0, 0, 0))
    d = sdf.smin(neck, head, 0.12)
    for k in range(3):
        a = math.pi / 2 + k * 2 * math.pi / 3
        lobe = sdf._ellipsoid(P, (0.14 * math.cos(a), 0.11, -0.14 * math.sin(a)), (0.16, 0.14, 0.16), (0, 0, 0))
        d = sdf.smin(d, lobe, 0.07)
    # Papillae: the wet, bumpy receptive surface on top.
    top = sm(-0.02, 0.1, P[:, 1])
    m = np.abs(d) < 0.05
    if m.any():
        d = d.copy()
        bumps = sdf.value_noise(P[m], 0.022, 11)
        d[m] -= 0.011 * top[m] * np.maximum(bumps, -0.2)
    return d


def stigma_sticky_field(P):
    return dissect(stigma_sticky_full(P), P)


def stigma_sticky_colour(P, N):
    cutf = cut_mask(P, N)
    top = sm(-0.04, 0.12, P[:, 1])
    n = sdf.value_noise(P, 0.022, 11)
    c = mix(H("#bfe08e"), H("#c8df4c"), top)
    c = mix(c, H("#eaf39a"), np.clip(n, 0, 1) * top * 0.8)
    if cutf.any():
        Pc = P[cutf]
        depth = -stigma_sticky_full(Pc)
        t = mix(H("#9fc64a"), H("#e3efb8"), sm(0.006, 0.03, depth))
        tract = 1 - sm(0.035, 0.08, np.hypot(Pc[:, 0], np.maximum(Pc[:, 1] - 0.04, 0) * 0.6))
        t = mix(t, H("#f6f1c4"), tract * 0.85)
        c[cutf] = t
    return c


def stigma_neck_field(P):
    """The top of the style under a feathery stigma, cut like the rest."""
    d = sdf._round_cone(P, (0, STYLE_TOP - STIGMA_Y - 0.25, 0), (0, -0.02, 0), STYLE_R[1] * 0.98, 0.11)
    return dissect(d, P)


def stigma_neck_colour(P, N):
    cutf = cut_mask(P, N)
    c = np.tile(H("#cfe4a0"), (len(P), 1))
    c[cutf] = H("#eef2c6")
    return c


def stigma_feathery(seed=4):
    """Two plumose branches held out in the air, each a feather of fine
    barbs: a sieve for airborne pollen, as in a grass floret."""
    rnd = pl.rng(seed)
    parts = []
    for k, phi in enumerate((0.45, math.pi - 0.45)):
        out = np.array([math.cos(phi), 0.0, -math.sin(phi)])
        ctrl = [(0, -0.04, 0), tuple(out * 0.1 + [0, 0.32, 0]), tuple(out * 0.36 + [0, 0.72, 0]), tuple(out * 0.5 + [0, 1.02, 0])]
        path = pl.resample(pl.catmull(ctrl, 8), 0.02)
        n = len(path)
        t = np.linspace(0, 1, n)
        V, F, _, _ = pl.sweep(path, 0.022 * (1 - 0.6 * t), sides=6)
        parts.append((V, F, np.tile(H("#d7e7ad"), (len(V), 1))))
        T, Nn, Bn = pl.frames(path)
        nb = 72
        for b in range(nb):
            tb = 0.12 + 0.86 * b / (nb - 1)
            i = int(tb * (n - 1))
            ang = b * 2.399 + rnd.uniform(-0.2, 0.2)
            d = math.cos(ang) * Nn[i] + math.sin(ang) * Bn[i]
            d = d + 0.35 * T[i]
            d /= np.linalg.norm(d)
            ln = (0.3 * (1 - 0.6 * tb) + 0.06) * rnd.uniform(0.85, 1.1)
            p0 = path[i]
            pts = [p0, p0 + d * ln * 0.5 + T[i] * ln * 0.12, p0 + d * ln + T[i] * ln * 0.3]
            bp = pl.catmull(pts, 2)
            Vb, Fb, tt, _ = pl.sweep(bp, 0.0065 * (1 - 0.55 * np.linspace(0, 1, len(bp))), sides=4, cap_start=False)
            cb = mix(H("#e4efc6"), H("#f4eefa"), tt)
            parts.append((Vb, Fb, cb))
    V, F, C = pl.combine(parts)
    return V, F, C


# ─── Stamens ───────────────────────────────────────────────────────


def filament(kind):
    if kind == "insect":
        ctrl = [(0, 0, 0), (0.05, 1.0, 0), (0.12, 2.4, 0), (ANTHER_INSECT[0], ANTHER_INSECT[1] - 0.24, 0)]
        r0, r1 = 0.034, 0.018
        top = "#f6e1ea"
    else:
        x, y = ANTHER_WIND
        ctrl = [(0, 0, 0), (0.08, 1.6, 0), (0.28, 3.3, 0), (0.48, 4.36, 0), (0.6, 4.6, 0), (x, y + 0.43, 0)]
        r0, r1 = 0.02, 0.009
        top = "#efe8c8"
    path = pl.resample(pl.catmull(ctrl, 10), 0.03)
    t = np.linspace(0, 1, len(path))
    V, F, tt, _ = pl.sweep(path, r0 + (r1 - r0) * t, sides=8)
    C = mix(H("#e3eecb"), H(top), sm(0.3, 1.0, tt))
    return V, F, C


def anther_insect_full(P):
    """Four pollen sacs in two thecae on a connective, basifixed, with a
    dehiscence slit down each theca's inner face (facing the carpel, -x)."""
    cx, cy = ANTHER_INSECT
    d = sdf._ellipsoid(P, (cx + 0.025, cy, 0), (0.05, 0.22, 0.05), (0, 0, 0))
    for s in (-1, 1):
        for dx in (-0.032, 0.03):
            sac = sdf._ellipsoid(P, (cx + dx, cy, s * 0.072), (0.055, 0.25, 0.058), (0, 0, s * 0.04))
            d = sdf.smin(d, sac, 0.025)
        slit = sdf._capsule(P, (cx - 0.085, cy - 0.17, s * 0.072), (cx - 0.085, cy + 0.17, s * 0.072), 0.018, 0.018)
        d = sdf.cut(d, slit, 0.012)
    tip = sdf._round_cone(P, (cx + 0.01, cy + 0.2, 0), (cx + 0.01, cy + 0.3, 0), 0.04, 0.012)
    return sdf.smin(d, tip, 0.03)


def anther_insect_colour(P, N):
    cx, cy = ANTHER_INSECT
    n = sdf.value_noise(P, 0.015, 21)
    c = mix(H("#f0b92a"), H("#ffd95a"), 0.5 + 0.5 * n)
    slit = np.zeros(len(P))
    for s in (-1, 1):
        slit = np.maximum(slit, 1 - sm(0.02, 0.045, np.hypot(P[:, 0] - (cx - 0.085), P[:, 2] - s * 0.072)))
    c = mix(c, H("#d97a12"), slit * 0.85)
    c = mix(c, H("#e2a227"), sm(0.0, 0.04, P[:, 0] - cx) * 0.4)  # the connective at the back
    return c


def anther_wind_full(P):
    """A long, linear, versatile anther dangling on a hair-thin filament, its
    two thecae splayed at both ends (an X in profile), as in a grass."""
    cx, cy = ANTHER_WIND
    d = None
    for s in (-1, 1):
        pts = [(cx + 0.015, cy + 0.42, s * 0.07), (cx, cy + 0.2, s * 0.046), (cx, cy - 0.2, s * 0.046), (cx + 0.015, cy - 0.42, s * 0.07)]
        th = sdf.tube(P, [(*p, r) for p, r in zip(pts, (0.034, 0.054, 0.054, 0.034))], per_span=3)
        d = th if d is None else sdf.smin(d, th, 0.02)
    return d


def anther_wind_colour(P, N):
    cx, cy = ANTHER_WIND
    end = sm(0.26, 0.42, np.abs(P[:, 1] - cy))
    n = sdf.value_noise(P, 0.02, 23)
    c = mix(H("#e3d277"), H("#efe39a"), 0.5 + 0.5 * n)
    return mix(c, H("#9d6f8e"), end * 0.6)


# ─── The honeybee ──────────────────────────────────────────────────

BEE = {
    "head": ((0.315, 0.0, 0.0), (0.072, 0.098, 0.104)),
    "thorax": ((0.15, 0.012, 0.0), (0.118, 0.106, 0.106)),
    "abdomen": ((-0.15, -0.03, 0.0), (0.215, 0.118, 0.126)),
}


def bee_full(P):
    (hc, hr), (tc, tr), (ac, ar) = BEE["head"], BEE["thorax"], BEE["abdomen"]
    head = sdf._ellipsoid(P, hc, hr, (0, 0, 0))
    thorax = sdf._ellipsoid(P, tc, tr, (0, 0, 0))
    abd = sdf._ellipsoid(P, ac, ar, (0, 0, 0.14))
    # Tergites: a shallow step at each segment's front edge.
    seg = np.mod((ac[0] + 0.2 - P[:, 0]) / 0.068, 1.0)
    abd = abd + 0.007 * sm(0.0, 0.18, seg) * (P[:, 0] < ac[0] + 0.17)
    d = sdf.smin(head, thorax, 0.02)
    d = sdf.smin(d, abd, 0.018)
    for s in (-1, 1):
        eye = sdf._ellipsoid(P, (hc[0] + 0.004, hc[1] + 0.02, s * 0.074), (0.05, 0.078, 0.036), (0, 0, 0))
        d = sdf.smin(d, eye, 0.008)
    # Fuzz: a fine roughness all over (the hairs, at this scale).
    return sdf.roughen(d, P, 0.0028, 0.012, 3, 2)


def bee_colour(P, N):
    (hc, hr), (tc, tr), (ac, ar) = BEE["head"], BEE["thorax"], BEE["abdomen"]
    n = sdf.value_noise(P, 0.01, 31)
    x = P[:, 0]
    thorax = mix(H("#5e3a1a"), H("#c08a45"), 0.45 + 0.5 * n)
    head = mix(H("#2a1d12"), H("#7a5530"), 0.3 + 0.3 * n)
    seg = np.mod((ac[0] + 0.2 - x) / 0.068, 1.0)
    band = mix(H("#c98a2a"), H("#33210f"), sm(0.45, 0.7, seg))
    band = mix(band, H("#e3c58c"), (1 - sm(0.08, 0.2, seg)) * 0.7)
    band = np.where((x < ac[0] - 0.13)[:, None], mix(band, H("#2b1b0d"), 0.75), band)
    c = np.where((x > 0.245)[:, None], head, np.where((x > 0.05)[:, None], thorax, band))
    for s in (-1, 1):
        e = sdf._ellipsoid(P, (hc[0] + 0.004, hc[1] + 0.02, s * 0.074), (0.05, 0.078, 0.036), (0, 0, 0))
        c = np.where((e < 0.006)[:, None], mix(H("#16110c"), H("#3a2c20"), 0.5 + 0.5 * n), c)
    return c


def bee_limbs():
    """Six legs (the hind tibiae broad, for the pollen baskets), elbowed
    antennae and the mouthparts, as sweeps."""
    parts = []
    dark, tan = H("#2a2016"), H("#6b4a2a")
    legs = [
        # coxa → femur → tibia → tarsus, left side (z > 0); mirrored below
        [(0.22, -0.06, 0.04), (0.25, -0.12, 0.1), (0.27, -0.2, 0.12), (0.3, -0.26, 0.13)],
        [(0.15, -0.08, 0.05), (0.13, -0.15, 0.14), (0.09, -0.24, 0.16), (0.06, -0.3, 0.17)],
        [(0.08, -0.07, 0.05), (0.02, -0.14, 0.15), (-0.08, -0.22, 0.17), (-0.15, -0.28, 0.17)],
    ]
    for s in (-1, 1):
        for k, leg in enumerate(legs):
            pts = [(x, y, s * z) for x, y, z in leg]
            path = pl.catmull(pts, 4)
            t = np.linspace(0, 1, len(path))
            r = 0.0095 * (1 - 0.45 * t)
            if k == 2:
                r = r + 0.009 * np.exp(-(((t - 0.62) / 0.12) ** 2))  # the broad hind tibia
            V, F, tt, _ = pl.sweep(path, r, sides=6)
            parts.append((V, F, mix(dark, tan, 0.25 * np.ones(len(V)))))
        ant = [(0.375, 0.04, s * 0.025), (0.41, 0.1, s * 0.04), (0.43, 0.12, s * 0.06), (0.5, 0.1, s * 0.1), (0.55, 0.06, s * 0.13)]
        path = pl.catmull(ant, 4)
        V, F, _, _ = pl.sweep(path, 0.0085, sides=5)
        parts.append((V, F, np.tile(dark, (len(V), 1))))
    path = pl.catmull([(0.37, -0.06, 0), (0.39, -0.11, 0), (0.37, -0.15, 0)], 4)
    V, F, _, _ = pl.sweep(path, 0.009, sides=5)
    parts.append((V, F, np.tile(H("#3a2a18"), (len(V), 1))))
    return pl.combine(parts)


def bee_pollen():
    """Pollen loads packed into the hind-leg baskets (the corbiculae)."""
    parts = []
    for s in (-1, 1):
        V, F = pl.ellipsoid_mesh((-0.06, -0.24, s * 0.175), (0.035, 0.03, 0.026), nu=12, nv=9)
        parts.append((V, F, np.tile(H("#f59e0b"), (len(V), 1))))
    return pl.combine(parts)


def bee_wing():
    """Fore- and hindwing of one side, hinge at the origin, spanning +z: a
    pale membrane with dark veins (vertex alpha)."""
    parts = []
    for span, chord, x0, nu, nv in ((0.44, 0.14, 0.0, 36, 14), (0.3, 0.085, -0.075, 26, 9)):
        u = np.linspace(0, 1, nu)
        v = np.linspace(0, 1, nv)
        U, Vv = np.meshgrid(u, v, indexing="ij")
        ch = chord * (0.45 + 0.55 * np.sin(np.pi * np.clip(U, 0, 1) ** 0.6))
        ch = ch * np.sqrt(np.clip(1 - ((U - 0.72) / 0.3) ** 2, 0.02, 1) * (U > 0.72) + (U <= 0.72))
        lead = x0 + 0.02 - 0.05 * U**1.4
        X = lead - Vv * ch
        Z = U * span
        Y = 0.004 * np.sin(np.pi * Vv)
        V = np.stack([X, Y, Z], axis=-1).reshape(-1, 3)
        F = []
        for i in range(nu - 1):
            for j in range(nv - 1):
                F.append([i * nv + j, (i + 1) * nv + j, (i + 1) * nv + j + 1, i * nv + j + 1])
        uu, vv = U.ravel(), Vv.ravel()
        vein = (1 - sm(0.0, 0.1, vv)) * (uu < 0.8)
        if span > 0.4:
            vein = np.maximum(vein, (1 - sm(0.0, 0.035, np.abs(vv - (0.4 + 0.12 * uu)))) * (uu < 0.62))
            vein = np.maximum(vein, (1 - sm(0.0, 0.03, np.abs(uu - 0.38))) * (vv < 0.75))
            vein = np.maximum(vein, (1 - sm(0.0, 0.03, np.abs(uu - 0.62))) * (vv < 0.55))
            vein = np.maximum(vein, (1 - sm(0.0, 0.035, np.abs(vv - 0.72 + 0.2 * uu))) * (uu < 0.5))
        col = mix(H("#cfd8e2"), H("#3c3024"), vein)
        alpha = 0.22 + 0.73 * vein
        parts.append((V, np.asarray(F), np.concatenate([col, alpha[:, None]], axis=1)))
    return pl.combine(parts)


# ─── Pollen grains (unit radius; the scene scales and tints them) ──


def _ico(subdiv):
    t = (1 + 5**0.5) / 2
    V = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    F = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    V = [np.asarray(v, dtype=np.float64) / np.linalg.norm(v) for v in V]
    for _ in range(subdiv):
        mid = {}
        nf = []

        def m(a, b):
            k = (min(a, b), max(a, b))
            if k not in mid:
                p = V[a] + V[b]
                V.append(p / np.linalg.norm(p))
                mid[k] = len(V) - 1
            return mid[k]

        for a, b, c in F:
            ab, bc, ca = m(a, b), m(b, c), m(c, a)
            nf += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        F = nf
    return np.asarray(V), np.asarray(F)


def pollen_spiky(n_spines=32):
    """An echinate grain: a sphere studded with conical spines and three
    germination pores, as in a sunflower or mallow."""
    V, F = _ico(2)
    pores = np.array([[1, 0, 0], [-0.5, 0, 0.866], [-0.5, 0, -0.866]])
    pd = np.max(V @ pores.T, axis=1)
    C = mix(H("#fff4cc"), H("#c9a24a"), sm(0.9, 0.97, pd))
    parts = [(V, F, C)]
    k = np.arange(n_spines) + 0.5
    phi = np.arccos(1 - 2 * k / n_spines)
    th = math.pi * (1 + 5**0.5) * k
    dirs = np.stack([np.cos(th) * np.sin(phi), np.cos(phi), np.sin(th) * np.sin(phi)], axis=1)
    for d in dirs:
        if np.max(pores @ d) > 0.93:
            continue
        path = np.stack([d * 0.92, d * 1.18, d * 1.42])
        Vs, Fs, tt, _ = pl.sweep(path, np.array([0.13, 0.06, 0.012]), sides=5, cap_start=False)
        parts.append((Vs, Fs, mix(H("#fff0c0"), H("#ffffff"), tt)))
    return pl.combine(parts)


def pollen_smooth():
    """A smooth, dry, wind grain, slightly flattened, with a single pore in a
    raised ring (monoporate, as in a grass)."""
    V, F = _ico(2)
    V = V * np.array([1.0, 0.94, 0.97])
    pd = V @ np.array([1.0, 0.0, 0.0])
    ring = np.exp(-(((pd - 0.93) / 0.025) ** 2))
    V = V * (1 + 0.06 * ring)[:, None]
    C = mix(H("#fffbe8"), H("#e9dca8"), ring)
    C = np.where((pd > 0.965)[:, None], H("#b9a56a"), C)
    return V, F, C


def meta():
    return {
        "units": "scene",
        "receptacleTop": 0.3,
        "ovary": {"centre": OVARY_C.tolist(), "radius": list(OVARY_R)},
        "locule": {"centre": LOCULE_C.tolist(), "radius": list(LOCULE_R)},
        "ovules": [{"centre": list(o["centre"]), "rx": o["rx"], "ry": o["ry"]} for o in OVULES],
        "style": {"bottom": STYLE_BOTTOM, "top": STYLE_TOP, "radius": list(STYLE_R)},
        "stigmaY": STIGMA_Y,
        "stigmaTop": 0.25,
        "nectary": NECTARY,
        "stamenBase": STAMEN_BASE,
        "petalBase": PETAL_BASE,
        "sepalBase": SEPAL_BASE,
        "tepalBase": TEPAL_BASE,
        "anther": {"insect": list(ANTHER_INSECT), "wind": list(ANTHER_WIND)},
        "bee": {"length": 0.75},
    }

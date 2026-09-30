"""The oesophagus, the stomach it empties into, and the food it carries.

Units are centimetres and the frame is the scene's: y up, the mouth end of
the oesophagus at the origin and the tube running down -y (station s is
depth below the mouth end, y = -s), +x to the viewer's right (the body's
left, where the stomach lies), +z towards the viewer.

The oesophagus (Gray's Anatomy; Ross & Pawlina, "Histology"):

  lumen           collapsed at rest into a star of longitudinal mucosal
                  folds, which flatten out as a bolus stretches it
  wall            about 0.9 cm here: mucosa (stratified squamous
                  epithelium, lamina propria, muscularis mucosae),
                  submucosa with its glands and vessels, the muscularis
                  externa (INNER circular layer, OUTER longitudinal layer)
                  and a thin adventitia; the longitudinal fibres show on
                  the outside as bundles running down it
  window          the front 110 degrees are cut away along the whole
                  length, so the lumen, the bolus and every layer of the
                  wall show

The tube is stored AT REST and moved on the GPU: every vertex carries its
station s, its depth w into the wall (0 at the lumen surface, 0.9 at the
outside) and its fold offset, and the scene's vertex shader puts it back
at the radius the peristaltic wave gives that station. So the geometry
here only has to be fine enough in s to carry the wave (0.2 cm).

The stomach is J-shaped, flattened front to back: the cardia where the
oesophagus enters, the fundus domed above it, the body down the viewer's
right (the greater curvature), the antrum swinging back across, and the
pylorus opening into the duodenum. Branches of the gastric and
gastro-epiploic arteries and veins run along both curvatures.
"""

import math

import numpy as np

import plantlib as pl
from plantlib import sdf

LENGTH = 25.0
LUMEN = 1.0
WALL = 0.9
WINDOW = math.radians(55)  # half-angle of the cut-away, about +z
DS = 0.2

# Depths (fraction of WALL from the lumen) where each layer starts; the
# scene's fragment shader reads the same numbers from the meta.
LAYERS = {
    "epithelium": 0.0,
    "laminaPropria": 0.07,
    "submucosa": 0.2,
    "circular": 0.44,
    "longitudinal": 0.73,
    "adventitia": 0.94,
}
FOLDS = 7


def fold(theta, s):
    """Inward ridges of mucosa (negative = into the lumen), wandering a
    little along the tube."""
    ph = 0.35 * np.sin(s * 0.33) + 0.2 * np.sin(s * 0.91 + 1.3)
    c = 0.5 + 0.5 * np.cos(FOLDS * (theta + ph))
    return -0.3 * c**3 - 0.02 * np.sin(theta * 23 + s * 2.1)


def bundles(theta, s):
    """Longitudinal muscle bundles on the outside: low ridges down the tube."""
    b = np.abs(np.cos(11 * theta + 0.15 * np.sin(s * 0.5))) ** 0.6
    return 0.05 * b + 0.012 * np.sin(s * 3.1 + theta * 5)


def _grid(nu, nv, closed_u=False):
    F = []
    for i in range(nu - 1 + (1 if closed_u else 0)):
        i2 = (i + 1) % nu
        for j in range(nv - 1):
            F.append([i * nv + j, i2 * nv + j, i2 * nv + j + 1, i * nv + j + 1])
    return np.asarray(F)


def oesophagus():
    """V, F and per-vertex (s, w, fold, 0) for the whole cut-away tube."""
    ss = np.arange(0, LENGTH + 1e-6, DS)
    th = np.linspace(WINDOW, 2 * math.pi - WINDOW, 90)
    parts = []

    def pos(theta, s, r):
        return np.stack([r * np.sin(theta), -s, r * np.cos(theta)], axis=-1)

    # lumen surface (w = 0, carries the folds)
    TH, S = np.meshgrid(th, ss, indexing="ij")
    fo = fold(TH, S)
    V = pos(TH, S, LUMEN + fo).reshape(-1, 3)
    A = np.stack([S.ravel(), np.zeros(S.size), fo.ravel(), np.zeros(S.size)], axis=1)
    F = _grid(len(th), len(ss))
    parts.append((V, F, A, "in"))
    # outer surface (w = WALL + the bundles)
    bu = bundles(TH, S)
    V = pos(TH, S, LUMEN + WALL + bu).reshape(-1, 3)
    A = np.stack([S.ravel(), (WALL + bu).ravel(), np.zeros(S.size), np.zeros(S.size)], axis=1)
    F = _grid(len(th), len(ss))[:, ::-1]
    parts.append((V, F, A, "out"))
    # the two cut faces: sampled finely across each layer boundary
    ws = [0.0]
    for f0 in LAYERS.values():
        for d in (-0.012, 0.0, 0.012):
            ws.append(f0 * WALL + d)
    ws += list(np.linspace(0, WALL, 16))
    ws = np.unique(np.clip(ws, 0, WALL))
    for k, theta in enumerate((WINDOW, 2 * math.pi - WINDOW)):
        W, S2 = np.meshgrid(ws, ss, indexing="ij")
        fo = fold(theta, S2) * np.clip(1 - W / (LAYERS["submucosa"] * WALL), 0, 1)
        bu = bundles(theta, S2) * np.clip((W - 0.8 * WALL) / (0.2 * WALL), 0, 1)
        V = pos(theta, S2, LUMEN + W + fo + bu).reshape(-1, 3)
        A = np.stack([S2.ravel(), (W + bu).ravel(), fo.ravel(), np.zeros(S2.size)], axis=1)
        F = _grid(len(ws), len(ss))
        if k == 0:  # this face looks back into the wedge, towards smaller angles
            F = F[:, ::-1]
        parts.append((V, F, A, "cut"))
    # the cut end at the top (s = 0)
    W, TH2 = np.meshgrid(ws, th, indexing="ij")
    fo = fold(TH2, 0.0) * np.clip(1 - W / (LAYERS["submucosa"] * WALL), 0, 1)
    bu = bundles(TH2, 0.0) * np.clip((W - 0.8 * WALL) / (0.2 * WALL), 0, 1)
    V = pos(TH2, np.zeros_like(W), LUMEN + W + fo + bu).reshape(-1, 3)
    A = np.stack([np.zeros(W.size), (W + bu).ravel(), fo.ravel(), np.zeros(W.size)], axis=1)
    F = _grid(len(ws), len(th))
    parts.append((V, F, A, "end"))
    Vs, Fs, As = [], [], []
    base = 0
    for V, F, A, kind in parts:
        Vs.append(V)
        Fs.append(pl.quads_to_tris(F) + base)
        As.append(A)
        base += len(V)
    return np.concatenate(Vs), np.concatenate(Fs), np.concatenate(As)


# ─── Stomach ───────────────────────────────────────────────────────

# The J: (x, y, radius) along the stomach's axis, cardia first.
J = [
    (1.0, -26.0, 1.7),
    (3.3, -24.9, 2.7),  # fundus, domed up beside the cardia (the cardiac notch between)
    (4.0, -27.4, 3.4),
    (3.9, -30.2, 3.4),  # body
    (3.1, -33.2, 3.0),
    (1.0, -35.2, 2.5),  # antrum
    (-1.6, -35.3, 1.95),
    (-3.5, -34.2, 1.3),
    (-4.4, -33.2, 0.95),  # pylorus
    (-5.3, -32.0, 1.15),  # duodenum
    (-5.9, -30.8, 1.15),
]
FLAT = 0.72  # front-to-back flattening


def stomach_field():
    pts = pl.catmull([(x, y, 0.0, r) for x, y, r in J], 6)
    pinch = np.array([0.0] * len(pts))
    # the pyloric sphincter: a waist between antrum and duodenum
    for i, p in enumerate(pts):
        d = math.hypot(p[0] + 4.4, p[1] + 33.2)
        pinch[i] = 0.3 * math.exp(-((d / 0.6) ** 2))

    def f(P):
        Q = P.copy()
        Q[:, 2] = Q[:, 2] / FLAT
        d = np.full(len(P), 9.0)
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            # exact distances (not sdf.capsule's box-culled ones): a blend this
            # wide would pull the culled placeholder values below zero
            d = sdf.smin(d, sdf._capsule(Q, a[:3], b[:3], a[3] - pinch[i], b[3] - pinch[i + 1]), 0.6)
        d = d * FLAT
        # the cardia: the oesophagus's end runs into the fundus's shoulder
        neck = sdf._capsule(P, (0.0, -24.2, 0.0), (0.9, -26.2, 0.0), LUMEN + WALL + 0.05, 1.6)
        d = sdf.smin(d, neck, 0.8)
        # a clean cut across the duodenum, square to it
        end = np.array([-5.9, -30.8])
        n = np.array([-0.6, 1.2]) / math.hypot(0.6, 1.2)
        plane = (P[:, 0] - end[0]) * n[0] + (P[:, 1] - end[1]) * n[1]
        d = np.where(P[:, 0] < -4.6, np.maximum(d, plane), d)
        return sdf.roughen(d, P, 0.03, np.array([0.8, 0.8, 0.8]), seed=2, octaves=2)

    return f


LESSER = [(0.9, -26.4), (0.5, -28.6), (0.1, -31.4), (-1.1, -33.0), (-3.0, -33.1)]
GREATER = [(5.2, -26.6), (5.9, -30.0), (5.1, -33.9), (2.4, -36.6), (-1.6, -37.3), (-4.0, -35.7)]


def surface_z(f, xy):
    """Where the stomach's front surface is above each (x, y), by bisection
    along z, all points at once; NaN where the line misses the organ."""
    xy = np.asarray(xy, dtype=np.float64)
    n = len(xy)
    P = lambda z: np.stack([xy[:, 0], xy[:, 1], z], axis=1)
    lo = np.zeros(n)
    hi = np.full(n, 4.5)
    hit = f(P(lo)) <= 0
    for _ in range(24):
        mid = (lo + hi) / 2
        inside = f(P(mid)) <= 0
        lo = np.where(inside, mid, lo)
        hi = np.where(inside, hi, mid)
    return np.where(hit, lo, np.nan)


def stomach_vessels(f, seed=4):
    """Arteries and veins lying on the stomach: the left and right gastric
    along the lesser curvature, the gastro-epiploics along the greater, and
    branches running in over the front. Each vessel is a polyline pressed
    onto the surface; returns [(points (M,3), radius, 'artery'|'vein')]."""
    rng = pl.rng(seed)
    out = []

    def press(pts2, lift):
        """Onto the front surface; a point off the edge steps in towards the
        middle of the stomach until it lands."""
        xy = np.asarray(pts2, dtype=np.float64)[:, :2].copy()
        z = surface_z(f, xy)
        for _ in range(8):
            miss = np.isnan(z)
            if not miss.any():
                break
            xy[miss] += (np.array([1.5, -31.0]) - xy[miss]) * 0.06
            z[miss] = surface_z(f, xy[miss])
        ok = ~np.isnan(z)
        return np.stack([xy[ok, 0], xy[ok, 1], z[ok] + lift], axis=1)

    for poly, off in ((LESSER, 0.28), (GREATER, -0.3)):
        path = pl.catmull(poly, 10)
        a = press(path, 0.06)
        # the vein runs beside its artery
        n = np.stack([-np.gradient(path[:, 1]), np.gradient(path[:, 0])], axis=1)
        n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
        v = press(path + n * off, 0.07)
        if len(a) > 3:
            out.append((a, 0.13, "artery"))
        if len(v) > 3:
            out.append((v, 0.15, "vein"))
        # branches in over the front
        for k in range(9):
            i = int(rng.uniform(0.06, 0.94) * (len(path) - 1))
            p0 = path[i]
            target = np.array([2.2, -30.5])
            d = target - p0
            d /= np.linalg.norm(d)
            ang = rng.uniform(-0.5, 0.5)
            c, s_ = math.cos(ang), math.sin(ang)
            d = np.array([c * d[0] - s_ * d[1], s_ * d[0] + c * d[1]])
            L = rng.uniform(1.4, 2.8)
            pts2 = [p0 + d * t + np.array([math.sin(t * 2.3 + k), math.cos(t * 1.7 + k)]) * 0.15 * t for t in np.linspace(0, L, 7)]
            b = press(pl.catmull(pts2, 4), 0.04)
            if len(b) > 3:
                out.append((b, 0.07, "artery" if k % 2 == 0 else "vein"))
    return out


def stomach_colour(P, N):
    base = pl.hex_rgb("#c9757a")
    col = np.tile(base, (len(P), 1))
    n = sdf.fbm(P, np.array([1.2, 1.2, 1.2]), 3, 7)
    col = col * (0.92 + 0.1 * n)[:, None]
    # vessels along both curvatures, with branches over the front
    def curve_dist(poly):
        poly = np.asarray(poly, dtype=np.float64)
        return np.min(np.stack([np.hypot(P[:, 0] - x, P[:, 1] - y) for x, y in poly]), axis=0)

    greater = pl.catmull(GREATER, 12)
    # the pale, fatty omentum's edge along the greater curvature
    d = curve_dist(greater + np.array([0.5, -0.4]))
    col = pl.mix(col, pl.hex_rgb("#e8d3a8"), np.clip(1 - d / 0.4, 0, 1) * 0.45)
    return col


# ─── Boluses ───────────────────────────────────────────────────────


def bolus_field(kind, seed=3):
    """A bolus about a unit sphere (the scene squeezes it to the lumen):
    'soft' is chewed food glued by saliva, with bits of what it was made of;
    'dry' is a crumbly, drier lump."""
    rng = pl.rng(seed)
    bits = []
    n = 16 if kind == "soft" else 22
    for _ in range(n):
        v = rng.normal(size=3)
        v /= np.linalg.norm(v)
        c = v * rng.uniform(0.8, 1.02)
        r = rng.uniform(0.1, 0.22) if kind == "soft" else rng.uniform(0.12, 0.3)
        bits.append((c, (r * rng.uniform(1.0, 1.8), r * rng.uniform(0.5, 0.9), r), tuple(rng.uniform(0, 3, 3)), int(rng.integers(0, 4))))

    def f(P):
        d = sdf.ellipsoid(P, (0, 0, 0), (1.0, 1.0, 1.0))
        d = sdf.roughen(d, P, 0.06 if kind == "soft" else 0.13, np.array([0.35, 0.35, 0.35]), seed=seed, octaves=3)
        for c, r, rot, _ in bits:
            d = sdf.smin(d, sdf.ellipsoid(P, c, r, rot), 0.04 if kind == "soft" else 0.02)
        return d

    return f, bits


def bolus_colour(P, kind, bits):
    base = pl.hex_rgb("#c9a26b") if kind == "soft" else pl.hex_rgb("#8b6b3e")
    n = sdf.fbm(P, np.array([0.25, 0.25, 0.25]), 3, 11)
    col = np.tile(base, (len(P), 1)) * (0.9 + 0.2 * n)[:, None]
    tones = [pl.hex_rgb(h) for h in (("#6f8f33", "#efe2c0", "#a0612e", "#d7b56d") if kind == "soft" else ("#c8a877", "#5e4424", "#a88652", "#e0c89a"))]
    for c, r, rot, t in bits:
        inside = sdf.ellipsoid(P, c, np.asarray(r) * 1.05, rot) < 0.01
        col[inside] = tones[t] * (0.92 + 0.1 * n[inside, None])
    return col


def meta():
    return {"length": LENGTH, "lumen": LUMEN, "wall": WALL, "window": WINDOW, "layers": LAYERS, "stationStep": DS}

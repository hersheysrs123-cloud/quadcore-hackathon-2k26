"""The bean seedling (Phaseolus vulgaris, about three weeks old), its roots
and the block of soil it grows in.

Frame: the soil surface is y = 0 and the stem stands at x = 0, z = STEM_Z.
The soil block is cut away at z = 0 (its front face), through the plane of
the root system, so the roots show half-sunk in the cut face as they do in a
dug-out profile.

Morphology (epigeal germination, as drawn in every botany text and seen in
photographs of bean seedlings at this age):

  hypocotyl       from the soil to the cotyledonary node, flushed red-brown
                  near the soil
  cotyledons      two, shrivelled and yellowing: their food is spent
  first node      two opposite, simple, cordate (heart-shaped) primary leaves
                  with an acuminate tip, each on a petiole with a pulvinus
                  (the swollen joint that moves the leaf) at both ends
  second node     the first trifoliate leaf: a long petiole, a terminal
                  leaflet on a short rachis, two lopsided lateral leaflets
  apex            the shoot tip, with the next leaf still folded
  roots           a tap root, lateral roots, finer laterals on those, a fuzz
                  of root hairs just behind every tip, and the pink root
                  nodules a legume keeps its nitrogen-fixing bacteria in

The plant is built twice with the same topology, turgid and wilted, and the
difference is its "wilt" morph: the petioles and blades droop at their
pulvini and the shoot tip nods, which is what a bean does in dry soil.
"""

import math

import numpy as np

import plantlib as pl
from plantlib import sdf

STEM_Z = -0.02

# Colours (sRGB), from photographs of young bean plants.
C = {
    "leaf": pl.hex_rgb("#3f7f2a"),
    "leafYoung": pl.hex_rgb("#5d9a34"),
    "vein": pl.hex_rgb("#9dc36a"),
    "stem": pl.hex_rgb("#6f9c3f"),
    "hypocotyl": pl.hex_rgb("#8b5a44"),
    "petiole": pl.hex_rgb("#79a543"),
    "pulvinus": pl.hex_rgb("#5e8a31"),
    "cotyledon": pl.hex_rgb("#c7b45a"),
    "cotyledonDry": pl.hex_rgb("#8c6b3a"),
    "root": pl.hex_rgb("#e8dcc0"),
    "rootOld": pl.hex_rgb("#c9ad86"),
    "rootTip": pl.hex_rgb("#f4ecd6"),
    "nodule": pl.hex_rgb("#c98a7c"),
    "soil": pl.hex_rgb("#5a3f2c"),
    "soilDark": pl.hex_rgb("#3d2a1e"),
    "soilLight": pl.hex_rgb("#7a5a40"),
    "pebble": pl.hex_rgb("#7d6f5e"),
    "pebble2": pl.hex_rgb("#8f7c63"),
}

# ─── The shoot ─────────────────────────────────────────────────────

STEM_POINTS = [
    (0.0, -0.3, STEM_Z),
    (0.015, 0.4, STEM_Z),
    (0.0, 1.1, STEM_Z + 0.01),
    (-0.03, 1.75, STEM_Z),  # cotyledonary node
    (-0.01, 2.5, STEM_Z),
    (0.03, 3.3, STEM_Z - 0.01),  # first node: the primary leaves
    (0.02, 4.0, STEM_Z),
    (-0.02, 4.72, STEM_Z),  # second node: the trifoliate leaf
    (0.0, 5.12, STEM_Z),  # shoot tip
]
NODE_Y = {"cot": 1.75, "n1": 3.3, "n2": 4.72, "tip": 5.12}


def stem_radius(y):
    r = np.interp(y, [-0.3, 0.0, 1.75, 3.3, 4.72, 5.12], [0.078, 0.082, 0.07, 0.058, 0.044, 0.03])
    # Nodes are a little swollen.
    for ny in (1.75, 3.3, 4.72):
        r = r * (1 + 0.12 * np.exp(-(((y - ny) / 0.06) ** 2)))
    return r


def stem_path(wilt):
    P = pl.resample(pl.catmull(STEM_POINTS, 8), 0.035)
    # Wilting: the upper stem leans and the tip nods over.
    y = P[:, 1]
    k = pl.smooth(3.4, 5.12, y)
    P[:, 0] += wilt * (0.28 * k * k)
    P[:, 1] -= wilt * (0.12 * k ** 3)
    return P


def point_on_stem(path, y):
    i = int(np.argmin(np.abs(path[:, 1] - y)))
    return path[i], i


def yaw_frame(yaw, pitch, roll=0.0):
    """Columns: the blade's axis (x_l), its upper normal (y_l), across (z_l).
    yaw about +y from +x, pitch down from horizontal, roll about the axis."""
    cy, sy = math.cos(yaw), math.sin(yaw)
    cp, sp = math.cos(pitch), math.sin(pitch)
    ax = np.array([cy * cp, -sp, -sy * cp])
    side = np.array([sy, 0.0, cy])  # horizontal, square to the axis
    up = np.cross(side, ax)
    cr, sr = math.cos(roll), math.sin(roll)
    up2 = up * cr + side * sr
    side2 = -up * sr + side * cr
    return np.stack([ax, up2, side2], axis=1)


# ─── Leaf blades ───────────────────────────────────────────────────


def outline(theta, L, W, kind, asym=0.0):
    """Polar outline about the blade's centre (theta = 0 points at the tip)."""
    ct, st = np.cos(theta), np.sin(theta)
    if kind == "cordate":
        Af, Ab = 0.6 * L, 0.4 * L
    else:
        Af, Ab = 0.6 * L, 0.4 * L
    A = np.where(ct > 0, Af, Ab)
    B = W / 2 * (1 + asym * np.sign(st))
    r = 1.0 / np.sqrt((ct / A) ** 2 + (st / B) ** 2)
    th = np.abs(theta)
    # Acuminate: shoulders drawn in, then a drawn-out tip.
    r = r * (1 - 0.13 * np.exp(-(((th - 0.42) / 0.22) ** 2))) * (1 + 0.2 * np.exp(-((th / 0.1) ** 2)))
    if kind == "cordate":
        r = r * (1 - 0.3 * np.exp(-(((math.pi - th) / 0.16) ** 2)))
    else:
        r = r * (1 - 0.14 * np.exp(-(((math.pi - th) / 0.45) ** 2)))
    return r


def veins(L, W, kind, c, tip):
    """Vein polylines in blade (a, b) coordinates, with a width each."""
    out = [(np.array([[0.0, 0.0], [tip * 0.5, 0.0], [tip * 0.985, 0.0]]), 0.013 * L)]
    B = W / 2
    if kind == "cordate":
        # Palmate at the base: a strong pair of basal veins.
        for s in (-1, 1):
            pts = [(0.0, 0.0), (0.12 * L, s * 0.3 * B), (0.3 * L, s * 0.6 * B), (0.52 * L, s * 0.7 * B), (0.72 * L, s * 0.52 * B)]
            out.append((pl.catmull(pts, 6), 0.007 * L))
            # a vein from the basal one down into the lobe
            lobe = [(0.06 * L, s * 0.18 * B), (-0.02 * L, s * 0.5 * B), (0.02 * L, s * 0.8 * B)]
            out.append((pl.catmull(lobe, 5), 0.005 * L))
        starts = [0.3, 0.45, 0.6, 0.73]
    else:
        starts = [0.12, 0.26, 0.4, 0.54, 0.68, 0.8]
    for f in starts:
        a0 = f * tip
        for s in (-1, 1):
            reach = 0.85 * B * math.sin(math.pi * min(0.95, 0.15 + f)) * (1 + 0.0 * s)
            pts = [(a0, 0.0), (a0 + 0.14 * L, s * reach * 0.55), (a0 + 0.3 * L, s * reach * 0.85), (min(a0 + 0.46 * L, tip * 0.97), s * reach * 0.62)]
            out.append((pl.catmull(pts, 6), 0.0055 * L))
    return out


def seg_distance(p, poly):
    """Distance from 2D points p (N,2) to a polyline."""
    d = np.full(len(p), np.inf)
    for i in range(len(poly) - 1):
        a, b = poly[i], poly[i + 1]
        ab = b - a
        t = np.clip(((p - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
        q = a + t[:, None] * ab
        d = np.minimum(d, np.linalg.norm(p - q, axis=1))
    return d


def blade(L, W, kind, asym=0.0, fold=0.2, droop=0.12, curl=0.15, n_theta=96, n_s=19, seed=0):
    """A blade in its own frame: the petiole joins at the origin, the midrib
    runs +x, the upper side faces +y. Returns V, F, colour, uv, vein weight."""
    th = np.linspace(-math.pi, math.pi, n_theta, endpoint=False)
    r_back = outline(np.array([math.pi]), L, W, kind, asym)[0]
    c = r_back  # the centre sits r_back in front of the join (the sinus)
    r = outline(th, L, W, kind, asym)
    tip = c + outline(np.array([0.0]), L, W, kind, asym)[0]
    s = np.linspace(0, 1, n_s)[1:] ** 0.85
    S, TH = np.meshgrid(s, th, indexing="ij")
    R = np.meshgrid(s, r, indexing="ij")[1]
    a = c + S * R * np.cos(TH)
    b = S * R * np.sin(TH)
    a = np.concatenate([[c], a.ravel()])
    b = np.concatenate([[0.0], b.ravel()])
    sr = np.concatenate([[0.0], S.ravel()])
    B = W / 2
    ab = np.stack([a, b], axis=1)
    vs = veins(L, W, kind, c, tip)
    vein = np.zeros(len(a))
    groove = np.zeros(len(a))
    for poly, w in vs:
        d = seg_distance(ab, poly)
        v = np.exp(-((d / w) ** 2))
        vein = np.maximum(vein, v * (1.0 if w > 0.01 * L else 0.75))
        groove = np.maximum(groove, v * w / (0.013 * L))
    # Shape: halves raised off the midrib, margins curled under, tip drooped,
    # the areoles between veins puckered a touch, the margin a little wavy.
    bb = np.abs(b) / B
    h = fold * np.abs(b) - curl * B * bb ** 2.2
    h -= droop * L * (a / L) ** 2
    h -= 0.012 * L * groove
    rng_off = np.array([seed * 3.1, seed * 1.7, seed * 5.3])
    P3 = np.stack([a, np.zeros_like(a), b], axis=1)
    h += 0.004 * L * sdf.fbm(P3 * 1.0 + rng_off, np.array([0.08, 0.08, 0.08]) * L, 2, seed)
    h += 0.01 * L * np.sin(np.arctan2(b, a - c) * 9 + seed) * sr ** 4
    V = np.stack([a, h, b], axis=1)
    # Faces: a fan round the centre, then quads ring to ring.
    nt = n_theta
    F = []
    for j in range(nt):
        F.append([0, 1 + (j + 1) % nt, 1 + j])
    for i in range(len(s) - 1):
        for j in range(nt):
            j2 = (j + 1) % nt
            p0 = 1 + i * nt + j
            p1 = 1 + i * nt + j2
            q0 = 1 + (i + 1) * nt + j
            q1 = 1 + (i + 1) * nt + j2
            F.append([p0, p1, q1])
            F.append([p0, q1, q0])
    F = np.asarray(F)
    # +y must be the front: check one triangle's winding.
    e1 = V[F[0, 1]] - V[F[0, 0]]
    e2 = V[F[0, 2]] - V[F[0, 0]]
    if np.cross(e1, e2)[1] < 0:
        F = F[:, ::-1]
    uv = np.stack([a / tip, b / B], axis=1)
    return V, F, uv, vein, sr


def place(V, origin, frame):
    return V @ frame.T + origin


def leaf_colour(vein, sr, uv, young=0.0, seed=0):
    base = pl.mix(C["leaf"], C["leafYoung"], young)
    col = base[None, :] * (0.93 + 0.1 * np.cos(uv[:, 0] * 5 + seed))[:, None]
    col = pl.mix(col, C["vein"], 0.85 * vein)
    # the margin is a shade paler
    col = pl.mix(col, C["leafYoung"], 0.25 * pl.smooth(0.85, 1.0, sr))
    return col


# ─── Tubes: stem, petioles ─────────────────────────────────────────


def tube_mesh(path, radius, sides, ribs=0, rib_depth=0.0, cap_start=False, cap_end=True):
    V, F, t, ang = pl.sweep(path, radius, sides=sides, cap_start=cap_start, cap_end=cap_end)
    if ribs:
        # angular ribs: push each ring out and in round its circumference
        M = len(path)
        ring = V[: M * sides].reshape(M, sides, 3)
        centre = path[:, None, :]
        k = 1 + rib_depth * np.cos(np.arange(sides) / sides * 2 * math.pi * ribs)
        ring = centre + (ring - centre) * k[None, :, None]
        V = V.copy()
        V[: M * sides] = ring.reshape(-1, 3)
    return V, pl.quads_to_tris(F), t


def petiole_path(start, direction, length, rise, arc, n=26):
    """A petiole: leaves the stem along `direction` (unit, mostly outward and
    up) and bends over by `arc` towards the horizontal."""
    d = np.asarray(direction, dtype=np.float64)
    d /= np.linalg.norm(d)
    out = d.copy()
    out[1] = 0
    out /= max(np.linalg.norm(out), 1e-9)
    pts = []
    p = np.asarray(start, dtype=np.float64).copy()
    step = length / (n - 1)
    cur = d.copy()
    for i in range(n):
        pts.append(p.copy())
        f = i / (n - 1)
        # rotate the heading down towards `out` and past it
        target = out * math.cos(arc * f) - np.array([0, 1, 0]) * math.sin(arc * f) * 0.35
        cur = cur * (1 - 0.12) + (d * (1 - f) + target * f) * 0.12
        cur /= np.linalg.norm(cur)
        p = p + cur * step
    P = np.asarray(pts)
    P[:, 1] += rise * np.sin(np.linspace(0, math.pi, n)) * 0.0
    return P


def petiole_radius(n, r0, r1, pulvinus=True):
    t = np.linspace(0, 1, n)
    r = r0 + (r1 - r0) * t
    if pulvinus:
        r = r * (1 + 0.45 * np.exp(-((t / 0.06) ** 2)) + 0.6 * np.exp(-(((1 - t) / 0.07) ** 2)))
    return r


# ─── Cotyledons ────────────────────────────────────────────────────


def cotyledon(origin, yaw, droop, seed, wilt):
    """A spent, shrivelled cotyledon: a kidney-shaped lobe gone wrinkled."""
    V, F = pl.ellipsoid_mesh((0, 0, 0), (0.3, 0.075, 0.19), nu=36, nv=20)
    F = pl.quads_to_tris(F)
    x = V[:, 0]
    # kidney: bend round the hilum, flatten the attached side, pinch it thin
    V[:, 2] -= 0.08 * (1 - (x / 0.3) ** 2)
    V[:, 1] *= 0.7 + 0.3 * (1 - np.abs(x / 0.3))
    # shrivelled: fine wrinkles across it, puckered in places
    n = sdf.fbm(V * 1.0 + seed, np.array([0.06, 0.06, 0.06]), 3, seed)
    w = np.sin(V[:, 0] * 60 + 4 * n) * 0.5 + 0.5
    nrm = V / np.maximum(np.linalg.norm(V / np.array([0.3, 0.075, 0.19]), axis=1, keepdims=True), 1e-6)
    V = V + nrm * (0.1 * n - 0.035 * w)[:, None]
    V[:, 0] += 0.3
    frame = yaw_frame(yaw, droop + 0.2 * wilt)
    Vw = place(V, origin, frame)
    col = pl.mix(C["cotyledon"], C["cotyledonDry"], np.clip(0.3 + 0.9 * n + 0.35 * (V[:, 0] / 0.6) + 0.25 * w, 0, 1))
    return Vw, F, col


# ─── Assemble the shoot ────────────────────────────────────────────


LEAF_SPECS = [
    # primary (unifoliate) leaves, opposite at the first node
    dict(node="n1", kind="cordate", yaw=math.radians(180 - 14), rise=1.0, plen=0.8, L=1.7, W=1.55, pitch=0.5, roll=-0.55, asym=0.0, seed=1, young=0.0),
    dict(node="n1", kind="cordate", yaw=math.radians(10), rise=0.95, plen=0.76, L=1.62, W=1.48, pitch=0.55, roll=0.6, asym=0.0, seed=2, young=0.0),
]
TRIFOLIATE = dict(node="n2", yaw=math.radians(-50), rise=0.95, plen=1.0, seed=3)


def shoot(wilt=0.0):
    """Everything above the soil: (V, F, colour, sway(2), uv, info)."""
    parts = []  # (V, F, col, sway_w, phase, uv)
    info = {"leaves": []}
    sp = stem_path(wilt)
    rs = stem_radius(sp[:, 1])
    Vs, Fs, ts = tube_mesh(sp, rs, 18, ribs=5, rib_depth=0.05, cap_end=True)
    ys = Vs[:, 1]
    col = pl.mix(C["stem"], C["hypocotyl"], 0.8 * (1 - pl.smooth(0.05, 0.9, ys)))
    col = pl.mix(col, C["hypocotyl"] * 0.8, 0.9 * (1 - pl.smooth(-0.2, 0.02, ys)))
    col = col * (0.95 + 0.05 * np.cos(np.arctan2(Vs[:, 2] - STEM_Z, Vs[:, 0]) * 5))[:, None]
    sway_stem = 0.22 * pl.smooth(0.0, 5.2, ys) ** 2
    parts.append((Vs, Fs, col, sway_stem, np.zeros(len(Vs)), np.zeros((len(Vs), 2))))
    info["stemTop"] = sp[-1].round(3).tolist()
    info["stemMid"] = point_on_stem(sp, 2.5)[0].round(3).tolist()

    def node_sway(y):
        return 0.22 * float(pl.smooth(0.0, 5.2, y)) ** 2

    # cotyledons
    pc, _ = point_on_stem(sp, NODE_Y["cot"])
    for k, (yaw, sd) in enumerate([(math.radians(120), 11), (math.radians(-55), 12)]):
        V, F, col = cotyledon(pc, yaw, 1.0, sd, wilt)
        parts.append((V, F, col, np.full(len(V), node_sway(pc[1])), np.full(len(V), 0.3 * k), np.zeros((len(V), 2))))

    def add_leaf(start_dir, base, spec_blade, pitch, yaw, roll, plen, r0, r1, sway0, phase, arc, young=0.0, with_petiole=True):
        """A petiole from `base` then a blade at its end."""
        end = base
        if with_petiole:
            pp = petiole_path(base, start_dir, plen, 0, arc)
            rr = petiole_radius(len(pp), r0, r1)
            Vp, Fp, tp = tube_mesh(pp, rr, 10)
            colp = pl.mix(C["petiole"], C["pulvinus"], np.clip(np.exp(-((tp / 0.06) ** 2)) + np.exp(-(((1 - tp) / 0.07) ** 2)), 0, 1))
            parts.append((Vp, Fp, colp, sway0 + 0.25 * tp, np.full(len(Vp), phase), np.zeros((len(Vp), 2))))
            end = pp[-1]
        V, F, uv, vein, sr = blade(**spec_blade)
        frame = yaw_frame(yaw, pitch, roll)
        Vw = place(V, end, frame)
        dist = np.linalg.norm(V[:, [0, 2]], axis=1)
        sw = sway0 + 0.25 + 0.35 * dist / (spec_blade["L"])
        colb = leaf_colour(vein, sr, uv, young, spec_blade.get("seed", 0))
        parts.append((Vw, F, colb, sw, np.full(len(Vw), phase), uv))
        # where vapour leaves: the underside, at the blade's middle
        mid = place(np.array([[spec_blade["L"] * 0.45, 0.0, 0.0]]), end, frame)[0]
        info["leaves"].append({"centre": mid.round(3).tolist(), "normal": frame[:, 1].round(3).tolist(), "length": spec_blade["L"]})
        return end, frame

    # primary leaves
    pn1, _ = point_on_stem(sp, NODE_Y["n1"])
    for k, s in enumerate(LEAF_SPECS):
        yaw = s["yaw"]
        d = np.array([math.cos(yaw), s["rise"] - 0.35 * wilt, -math.sin(yaw)])
        base = pn1 + np.array([math.cos(yaw), 0, -math.sin(yaw)]) * 0.04
        spec = dict(L=s["L"], W=s["W"], kind="cordate", asym=s["asym"], fold=0.16 + 0.25 * wilt, droop=0.1 + 0.08 * wilt, seed=s["seed"])
        add_leaf(d, base, spec, s["pitch"] + 0.75 * wilt, yaw, s["roll"], s["plen"], 0.024, 0.017, node_sway(pn1[1]), 0.9 * k + 0.2, 0.5 + 0.5 * wilt)

    # trifoliate leaf: petiole to the rachis, then three leaflets
    pn2, _ = point_on_stem(sp, NODE_Y["n2"])
    t = TRIFOLIATE
    yaw = t["yaw"]
    d = np.array([math.cos(yaw), t["rise"] - 0.4 * wilt, -math.sin(yaw)])
    pp = petiole_path(pn2 + np.array([math.cos(yaw), 0, -math.sin(yaw)]) * 0.03, d, t["plen"], 0, 0.35 + 0.5 * wilt)
    rr = petiole_radius(len(pp), 0.022, 0.015)
    Vp, Fp, tp = tube_mesh(pp, rr, 10)
    colp = pl.mix(C["petiole"], C["pulvinus"], np.clip(np.exp(-((tp / 0.06) ** 2)) + np.exp(-(((1 - tp) / 0.07) ** 2)), 0, 1))
    sw0 = node_sway(pn2[1])
    parts.append((Vp, Fp, colp, sw0 + 0.3 * tp, np.full(len(Vp), 1.7), np.zeros((len(Vp), 2))))
    rachis_base = pp[-1]
    head = pp[-1] - pp[-3]
    head /= np.linalg.norm(head)
    # rachis extension to the terminal leaflet
    rach = petiole_path(rachis_base, head + np.array([0, 0.25, 0]), 0.28, 0, 0.2)
    Vr, Fr, tr = tube_mesh(rach, petiole_radius(len(rach), 0.013, 0.011), 8)
    parts.append((Vr, Fr, pl.mix(C["petiole"], C["pulvinus"], np.exp(-(((1 - tr) / 0.1) ** 2))), sw0 + 0.3 + 0.1 * tr, np.full(len(Vr), 1.7), np.zeros((len(Vr), 2))))
    hyaw = math.atan2(-head[2], head[0])
    spec = dict(L=1.15, W=0.82, kind="ovate", asym=0.0, fold=0.18 + 0.25 * wilt, droop=0.12 + 0.1 * wilt, seed=5)
    add_leaf(None, rach[-1], spec, 0.62 + 0.8 * wilt, hyaw, 0.0, 0, 0, 0, sw0 + 0.4, 1.7, 0, young=0.25, with_petiole=False)
    # lateral leaflets on short petiolules, lopsided (the outer half wider)
    for k, side in enumerate((1, -1)):
        lyaw = hyaw + side * math.radians(78)
        ld = np.array([math.cos(lyaw), 0.1, -math.sin(lyaw)])
        stalk = petiole_path(rachis_base, ld, 0.08, 0, 0.1, n=8)
        Vt, Ft, tt = tube_mesh(stalk, petiole_radius(len(stalk), 0.012, 0.011), 8)
        parts.append((Vt, Ft, C["pulvinus"] * np.ones((len(Vt), 3)), sw0 + 0.3 + 0.05 * tt, np.full(len(Vt), 1.7 + k), np.zeros((len(Vt), 2))))
        spec = dict(L=1.0, W=0.74, kind="ovate", asym=-0.18 * side, fold=0.16 + 0.25 * wilt, droop=0.1 + 0.1 * wilt, seed=6 + k)
        add_leaf(None, stalk[-1], spec, 0.35 + 0.8 * wilt, lyaw, side * 0.35, 0, 0, 0, sw0 + 0.38, 1.9 + k, 0, young=0.3, with_petiole=False)

    # the shoot tip: the next trifoliate leaf, still folded
    ptip = sp[-1]
    V, F = pl.ellipsoid_mesh((0, 0, 0), (0.05, 0.13, 0.035), nu=14, nv=9)
    V[:, 1] += 0.1
    V = V @ pl.rot_to((0, 1, 0), (0.25 + 0.4 * wilt, 1, 0)).T + ptip
    F = pl.quads_to_tris(F)
    parts.append((V, F, C["leafYoung"] * np.ones((len(V), 3)), np.full(len(V), 0.3), np.zeros(len(V)), np.zeros((len(V), 2))))

    Vs, Fs, cols, sws, phs, uvs = [], [], [], [], [], []
    base = 0
    for V, F, col, sw, ph, uv in parts:
        Vs.append(V)
        Fs.append(np.asarray(F) + base)
        cols.append(col)
        sws.append(sw)
        phs.append(ph)
        uvs.append(uv)
        base += len(V)
    return (np.concatenate(Vs), np.concatenate(Fs), np.concatenate(cols), np.stack([np.concatenate(sws), np.concatenate(phs)], axis=1), np.concatenate(uvs), info)


# ─── Roots ─────────────────────────────────────────────────────────


def root_path(start, angle, length, rng, setpoint=0.6, relax=0.9, meander=0.3, z_pull=0.0, step=0.03):
    """A root growing from `start` in the x-y plane (roughly): `angle` is its
    heading from straight down (+ towards +x). It relaxes towards its
    gravitropic set-point angle as it grows, and meanders about it (a sum of
    slow sines, so it wanders like a real root rather than zig-zagging)."""
    p = np.asarray(start, dtype=np.float64).copy()
    pts = [p.copy()]
    n = max(3, int(length / step))
    freqs = rng.uniform(0.6, 2.4, 3)
    phases = rng.uniform(0, 6.28, 3)
    amps = rng.uniform(0.5, 1.0, 3)
    sp = math.copysign(setpoint, angle) if angle != 0 else setpoint
    a = angle
    zv = 0.0
    for i in range(n):
        s = i * step
        a += (sp - a) * relax * step
        wig = meander * sum(amps[k] * math.sin(freqs[k] * s * 6 + phases[k]) for k in range(3)) / 2
        h = a + wig
        zv += (z_pull - p[2]) * 0.6 * step + rng.normal(0, 0.01)
        zv *= 0.9
        d = np.array([math.sin(h), -math.cos(h), zv])
        d /= np.linalg.norm(d)
        p = p + d * step
        pts.append(p.copy())
    P = np.asarray(pts)
    P[:, 1] = np.minimum(P[:, 1], -0.04)
    return P


def roots(seed=7):
    rng = pl.rng(seed)
    parts = []  # (V, F, col)
    info = {"hairZones": []}
    tap = root_path((0.0, -0.25, STEM_Z), 0.05, 2.1, rng, setpoint=0.0, relax=2.0, meander=0.12, z_pull=STEM_Z)
    tap = np.concatenate([[[0.0, 0.05, STEM_Z]], tap])
    n = len(tap)
    rt = np.interp(np.arange(n) / (n - 1), [0, 0.08, 0.5, 1.0], [0.08, 0.062, 0.036, 0.012])
    all_paths = [(tap, rt, 0)]
    laterals = []
    k = 0
    ys = np.linspace(-0.28, -1.7, 13) + rng.uniform(-0.04, 0.04, 13)
    for y0 in ys:
        k += 1
        i = int(np.argmin(np.abs(tap[:, 1] - y0)))
        side = 1 if (k % 2) else -1
        if rng.random() < 0.2:
            side = -side
        ang = side * rng.uniform(1.15, 1.45)
        length = float(np.interp(y0, [-1.7, -0.28], [0.8, 2.3])) * rng.uniform(0.85, 1.15)
        zp = rng.uniform(-0.08, 0.0)
        path = root_path(tap[i], ang, length, rng, setpoint=rng.uniform(0.45, 0.8), relax=rng.uniform(0.6, 1.1), meander=0.35, z_pull=zp)
        # keep inside the block
        path[:, 0] = np.clip(path[:, 0], -2.2, 2.2)
        path[:, 1] = np.maximum(path[:, 1], -2.42)
        m = len(path)
        r0 = float(np.interp(y0, [-1.7, -0.28], [0.017, 0.03]))
        rad = r0 * np.interp(np.arange(m) / (m - 1), [0, 0.06, 1], [1.25, 1.0, 0.4])
        all_paths.append((path, rad, 1))
        laterals.append(path)
        # finer laterals off the longer ones
        for j in range(int(length / 0.3)):
            a = rng.uniform(0.12, 0.85)
            q = path[int(a * (m - 1))]
            sub = root_path(q, side * rng.uniform(0.3, 1.5) * (1 if rng.random() < 0.7 else -1), rng.uniform(0.15, 0.55), rng, setpoint=0.3, relax=0.8, meander=0.5, z_pull=zp, step=0.02)
            ms = len(sub)
            all_paths.append((sub, r0 * 0.42 * np.interp(np.arange(ms) / (ms - 1), [0, 1], [1, 0.5]), 2))
            laterals.append(sub)
    for path, rad, order in all_paths:
        sides = {0: 12, 1: 7, 2: 5}[order]
        V, F, t, a = pl.sweep(path, rad, sides=sides, cap_start=False, cap_end=True)
        F = pl.quads_to_tris(F)
        # older (upper) root is browner, the tip creamy white
        col = pl.mix(C["root"], C["rootOld"], 0.6 * (1 - t) * (1 if order == 0 else 0.5))
        col = pl.mix(col, C["rootTip"], pl.smooth(0.85, 1.0, t))
        parts.append((V, F, col))
    # Root hairs: a fuzz 3-12 mm behind every lateral tip, square to the root.
    for path in laterals:
        m = len(path)
        if m < 6:
            continue
        T, N, Bn = pl.frames(path)
        L = np.sum(np.linalg.norm(np.diff(path, axis=0), axis=1))
        zone = []
        for h in range(int(24 * min(L, 1.0)) + 6):
            f = rng.uniform(0.62, 0.93) if L > 0.4 else rng.uniform(0.4, 0.9)
            i = int(f * (m - 1))
            ang = rng.uniform(0, 2 * math.pi)
            dirn = math.cos(ang) * N[i] + math.sin(ang) * Bn[i]
            dirn = dirn + T[i] * rng.uniform(-0.2, 0.3)
            dirn /= np.linalg.norm(dirn)
            base = path[i] + dirn * 0.008
            ln = rng.uniform(0.03, 0.07)
            tip = base + dirn * ln + np.array([0, -0.005, 0])
            hp = np.array([base, (base + tip) / 2 + rng.normal(0, 0.004, 3), tip])
            V, F, t, a = pl.sweep(hp, np.array([0.0035, 0.003, 0.0022]), sides=3, cap_start=False, cap_end=False)
            parts.append((V, pl.quads_to_tris(F), np.tile(C["rootTip"], (len(V), 1))))
            zone.append(path[i])
        if L > 0.9:
            info["hairZones"].append(np.mean(zone, axis=0).round(3).tolist())
    # Nodules on the upper laterals.
    for path in laterals[:10]:
        m = len(path)
        for j in range(int(rng.integers(1, 4))):
            i = int(rng.uniform(0.05, 0.5) * (m - 1))
            T, N, Bn = pl.frames(path)
            ang = rng.uniform(0, 2 * math.pi)
            off = (math.cos(ang) * N[i] + math.sin(ang) * Bn[i])
            r = rng.uniform(0.018, 0.034)
            V, F = pl.ellipsoid_mesh(path[i] + off * r * 0.7, (r, r * 0.9, r), nu=10, nv=7)
            V += 0.003 * rng.normal(size=V.shape)
            parts.append((V, pl.quads_to_tris(F), np.tile(C["nodule"], (len(V), 1)) * rng.uniform(0.9, 1.05)))
    Vs, Fs, cols = [], [], []
    base = 0
    for V, F, col in parts:
        Vs.append(V)
        Fs.append(F + base)
        cols.append(col)
        base += len(V)
    return np.concatenate(Vs), np.concatenate(Fs), np.concatenate(cols), info


# ─── Soil ──────────────────────────────────────────────────────────

SOIL_LO = np.array([-2.3, -2.5, -1.7])
SOIL_HI = np.array([2.3, 0.0, -0.07])


def soil_field(seed=3):
    rng = pl.rng(seed)
    centre = (SOIL_LO + SOIL_HI) / 2
    half = (SOIL_HI - SOIL_LO) / 2
    # pebbles half-sunk in the cut face and on the surface
    peb = []
    for _ in range(22):
        c = np.array([rng.uniform(-2.2, 2.2), rng.uniform(-2.4, -0.05), rng.uniform(-0.11, -0.07)])
        r = rng.uniform(0.025, 0.07)
        peb.append((c, (r * rng.uniform(0.9, 1.4), r, r * rng.uniform(0.8, 1.2)), tuple(rng.uniform(0, 3, 3))))
    for _ in range(14):
        c = np.array([rng.uniform(-2.2, 2.2), rng.uniform(-0.02, 0.02), rng.uniform(-1.6, -0.15)])
        r = rng.uniform(0.03, 0.07)
        peb.append((c, (r * 1.3, r * 0.8, r), tuple(rng.uniform(0, 3, 3))))

    def box(P):
        q = np.abs(P - centre) - half + 0.04
        return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(axis=1), 0) - 0.04

    def field(P):
        d = box(P)
        # crumbly: clods on the top surface and the cut face
        d = sdf.roughen(d, P, 0.02, np.array([0.12, 0.12, 0.12]), seed=seed, octaves=3)
        # a slight mound round the stem
        mound = 0.05 * np.exp(-((P[:, 0] ** 2 + (P[:, 2] - STEM_Z) ** 2) / 0.09))
        top = np.abs(P[:, 1]) < 0.15
        d[top] -= mound[top]
        for c, r, rot in peb:
            d = sdf.smin(d, sdf.ellipsoid(P, c, r, rot), 0.015)
        return d

    return field, peb


def soil_colour(P, peb, seed=3):
    n = sdf.fbm(P, np.array([0.18, 0.18, 0.18]), 3, seed + 5)
    col = pl.mix(C["soil"], C["soilDark"], np.clip(0.5 + 0.9 * n, 0, 1))
    fine = sdf.value_noise(P, np.array([0.025, 0.025, 0.025]), seed + 9)
    col = pl.mix(col, C["soilLight"], np.clip(fine - 0.55, 0, 1) * 1.5)
    col = pl.mix(col, C["soilDark"] * 0.8, np.clip(-fine - 0.6, 0, 1) * 1.8)
    for k, (c, r, rot) in enumerate(peb):
        inside = sdf.ellipsoid(P, c, np.asarray(r) * 1.08, rot) < 0.004
        if inside.any():
            tone = C["pebble"] if k % 3 else C["pebble2"]
            col[inside] = tone * (0.9 + 0.12 * n[inside, None])
    return col

"""A cable-knit wool sweater on a dress form, for the static-electricity scene.

The sweater is one signed-distance field meshed with the arm build's OpenVDB
mesher:

  body     a loft of horizontal sections (scripts/arm-model/sculpt.py's
           RadialLoft): boxy at the chest, hanging straight past the waist,
           bloused a little over the ribbed hem band, and sloping in over the
           shoulders to the neck. The hem is hollow (you can see up into it)
           and the neck is cut for the form's neck.
  sleeves  empty sleeves hanging against the sides, flattened front to back
           as an empty sleeve is, with soft folds, bunching above the cuff and
           a ribbed cuff.
  collar   a ribbed crew-neck band.
  relief   three rope cables up the front and back, k2p2 ribbing on the hem,
           cuffs and collar, and gentle drape folds.

Everything is in the scene's frame and units, with x measured from the
sweater's centre line (the scene adds SWEATER_X): y up, the front facing +z,
the floor at FLOOR_Y. The stitches themselves are a three.js shader; each
vertex carries knit coordinates for it (`knit`: stitch across, row along,
kind, cable height).
"""

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARM = os.path.join(HERE, "..", "arm-model")
if ARM not in sys.path:
    sys.path.insert(0, ARM)

import numpy as np  # noqa: E402

import sdf  # noqa: E402
from sculpt import RadialLoft, section  # noqa: E402

FLOOR_Y = -2.6

# ─── Helpers ───────────────────────────────────────────────────────


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def smin(a, b, k):
    """Polynomial smooth minimum with a per-point (or scalar) width."""
    k = np.broadcast_to(np.asarray(k, dtype=np.float64), a.shape)
    out = np.minimum(a, b)
    m = (np.abs(a - b) < k) & (k > 1e-9)
    if m.any():
        am, bm, km = a[m], b[m], k[m]
        h = 0.5 + 0.5 * (bm - am) / km
        out[m] = bm * (1 - h) + am * h - km * h * (1 - h)
    return out


def catmull(points, n):
    P = [np.asarray(p, dtype=np.float64) for p in points]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2])
    return np.array(out)


# ─── Body ──────────────────────────────────────────────────────────

HEM_Y = -0.53  # bottom edge of the hem
RIB_TOP = -0.36  # top of the hem's rib band
NECK_Y = 1.25  # the neckline
CHEST_Y = 0.42

# (y, half-width across, half-depth to the front, half-depth to the back)
BODY = [
    (HEM_Y, 0.565, 0.29, 0.27),
    (RIB_TOP, 0.575, 0.3, 0.28),
    (-0.26, 0.615, 0.325, 0.3),  # bloused over the rib band
    (0.05, 0.615, 0.32, 0.3),
    (CHEST_Y, 0.625, 0.335, 0.3),
    (0.82, 0.63, 0.31, 0.28),
    (0.98, 0.575, 0.27, 0.25),  # the shoulder line
    (1.1, 0.42, 0.21, 0.2),
    (1.19, 0.27, 0.195, 0.19),
    (NECK_Y + 0.02, 0.215, 0.165, 0.165),
]

# The loft's local x is the front (+z here) and its local z the side (-x).
_M = np.array([[0.0, 0.0, -1.0], [0.0, 1.0, 0.0], [1.0, 0.0, 0.0]])
LOFT = RadialLoft(
    [(y, 0.0, 0.0, section(f, b, a, a, n=2.0 if y > 1.05 else 2.6)) for y, a, f, b in BODY],
    harmonics=8,
    frame=(np.zeros(3), _M),
)

HEM_WALL = 0.03  # fabric thickness at the open hem
NECK_R = 0.17  # the neck opening
COLLAR = dict(y=NECK_Y + 0.035, rx=0.205, rz=0.19, half_h=0.05, half_t=0.028)

# Rope cables: centre lines across the front (and the back), their width,
# strand radius, twist period and height.
CABLES = (-0.3, 0.0, 0.3)
CABLE_W = 0.15
STRAND_R = 0.032
CABLE_P = 0.2
CABLE_H = 0.026
CABLE_Y = (RIB_TOP + 0.04, 0.93)

RIB_H = 0.007  # height of a rib ridge
HEM_RIBS = 64  # k2p2 rib ridges round the hem
COLLAR_RIBS = 44
CUFF_RIBS = 28


def body_shape(P):
    """The body without its relief, hollow hem and cut neck."""
    return LOFT(P)


def cable_relief(P):
    """Height of the rope cables (0 off them), and the front/back weight."""
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    face = np.maximum(sstep(0.12, 0.24, z), sstep(0.12, 0.24, -z))
    along = sstep(CABLE_Y[0], CABLE_Y[0] + 0.05, y) * (1 - sstep(CABLE_Y[1] - 0.05, CABLE_Y[1], y))
    ph = 2 * np.pi * y / CABLE_P
    h = np.zeros(len(P))
    for cx in CABLES:
        u = x - cx
        o = 0.25 * CABLE_W * np.sin(ph)
        bias = 0.28 * CABLE_H * np.cos(ph)  # which strand is on top alternates
        s1 = np.sqrt(np.clip(1 - ((u - o) / STRAND_R) ** 2, 0, 1))
        s2 = np.sqrt(np.clip(1 - ((u + o) / STRAND_R) ** 2, 0, 1))
        # the over/under bias only on each strand's own footprint, or it
        # ripples the whole panel
        h1 = (CABLE_H * s1 + bias) * (s1 > 0)
        h2 = (CABLE_H * s2 - bias) * (s2 > 0)
        strands = np.maximum(np.maximum(h1, h2), 0.0)
        # a twisted-stitch column either side of each cable
        side = 0.45 * CABLE_H * np.sqrt(np.clip(1 - ((np.abs(u) - CABLE_W * 0.72) / 0.014) ** 2, 0, 1))
        h = np.maximum(h, np.maximum(strands, side))
    return h * face * along


def body_relief(P):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    th = np.arctan2(x, z)
    rib = RIB_H * (0.5 + 0.5 * np.cos(HEM_RIBS * th)) * (1 - sstep(RIB_TOP - 0.01, RIB_TOP + 0.01, y))
    # soft vertical drape folds, deepest low down and away from the cables
    front = sstep(0.12, 0.24, np.abs(z))
    fold = 0.009 * np.sin(th * 7.0 + 0.8 * np.sin(y * 2.7)) * sstep(0.6, -0.2, y) * sstep(RIB_TOP, RIB_TOP + 0.12, y)
    fold *= 1 - 0.7 * front
    return cable_relief(P) + rib + fold


def collar_field(P):
    c = COLLAR
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    rho = np.sqrt((x / c["rx"]) ** 2 + (z / c["rz"]) ** 2) * 0.5 * (c["rx"] + c["rz"])
    q0 = rho - 0.5 * (c["rx"] + c["rz"])
    q1 = y - c["y"]
    # a rounded rectangle of a band, swept round the neck
    r = 0.02
    dx = np.abs(q0) - (c["half_t"] - r)
    dy = np.abs(q1) - (c["half_h"] - r)
    d = np.sqrt(np.maximum(dx, 0) ** 2 + np.maximum(dy, 0) ** 2) + np.minimum(np.maximum(dx, dy), 0) - r
    th = np.arctan2(x, z)
    ridge = RIB_H * 0.8 * (0.5 + 0.5 * np.cos(COLLAR_RIBS * th)) * sstep(0.0, 0.02, q0 + c["half_t"])
    return d - ridge


def body_field(P):
    d = body_shape(P) - body_relief(P)
    # the open hem: hollowed up inside the rib band
    inner = np.maximum(body_shape(P) + HEM_WALL, P[:, 1] - (RIB_TOP + 0.08))
    d = sdf.cut(d, inner, 0.012)
    # the neck opening, for the form's neck
    neck = np.sqrt(P[:, 0] ** 2 + P[:, 2] ** 2) - NECK_R
    neck = np.maximum(neck, (NECK_Y - 0.08) - P[:, 1])
    d = sdf.cut(d, neck, 0.02)
    return smin(d, collar_field(P), 0.025)


# ─── Sleeves ───────────────────────────────────────────────────────

CUFF_LEN = 0.17


def sleeve_path(side):
    s = float(side)
    pts = [
        (s * 0.5, 0.98, 0.0),
        (s * 0.67, 0.86, 0.0),
        (s * 0.735, 0.48, 0.02),
        (s * 0.745, 0.02, 0.04),
        (s * 0.74, -0.32, 0.05),
    ]
    return catmull(pts, 14)


PATHS = {s: sleeve_path(s) for s in (-1, 1)}


def _path_frames(path):
    seg = np.diff(path, axis=0)
    L = np.linalg.norm(seg, axis=1)
    cum = np.concatenate([[0.0], np.cumsum(L)])
    return seg, L, cum


FRAMES = {s: _path_frames(p) for s, p in PATHS.items()}


def sleeve_coords(P, side):
    """Per point: distance from the sleeve's top along its path, the total
    length, and the offsets across (front-back) and through (sideways) the
    flattened sleeve."""
    path = PATHS[side]
    seg, L, cum = FRAMES[side]
    best = np.full(len(P), np.inf)
    s_at = np.zeros(len(P))
    T = np.zeros((len(P), 3))
    base = np.zeros((len(P), 3))
    for i in range(len(seg)):
        a = path[i]
        t = np.clip(((P - a) @ seg[i]) / (L[i] ** 2), 0, 1)
        q = a + np.outer(t, seg[i])
        d = np.linalg.norm(P - q, axis=1)
        m = d < best
        best[m] = d[m]
        s_at[m] = cum[i] + t[m] * L[i]
        T[m] = seg[i] / L[i]
        base[m] = q[m]
    across = np.array([0.0, 0.0, 1.0])
    A = across - (T @ across)[:, None] * T
    A /= np.linalg.norm(A, axis=1)[:, None]
    Th = np.cross(T, A)
    q = P - base
    return s_at, cum[-1], np.einsum("ij,ij->i", q, A), np.einsum("ij,ij->i", q, Th), np.einsum("ij,ij->i", q, T)


def sleeve_field(P, side):
    lo = np.array([min(side * 0.35, side * 0.95), -0.55, -0.35])
    hi = np.array([max(side * 0.35, side * 0.95), 1.15, 0.4])

    def f(Q):
        s, total, ua, ut, ul = sleeve_coords(Q, side)
        from_cuff = total - s
        k = np.clip(s / total, 0, 1)
        # wide front to back, thin side to side, narrowing to the cuff
        ra = 0.168 - 0.03 * k
        rt = 0.088 - 0.016 * k
        cuff = 1 - sstep(CUFF_LEN - 0.01, CUFF_LEN + 0.03, from_cuff)
        ra = ra - 0.022 * cuff
        rt = rt - 0.01 * cuff
        e = np.sqrt((ua / ra) ** 2 + (ut / rt) ** 2)
        d = (e - 1.0) * np.minimum(ra, rt)
        # beyond the ends: flat at the cuff, buried in the body at the top
        d = np.maximum(d, np.where(s >= total - 1e-6, ul, -1.0))
        # soft folds down the sleeve, and bunching just above the cuff
        phi = np.arctan2(ut / rt, ua / ra)
        fold = 0.008 * np.sin(phi * 3 + s * 5.0 + side) * sstep(0.1, 0.35, s)
        bunch = 0.011 * np.sin(2 * np.pi * from_cuff / 0.075) * sstep(CUFF_LEN + 0.24, CUFF_LEN + 0.05, from_cuff) * sstep(CUFF_LEN, CUFF_LEN + 0.04, from_cuff)
        rib = RIB_H * (0.5 + 0.5 * np.cos(CUFF_RIBS * phi)) * cuff
        return d - fold - bunch - rib

    return sdf._boxed(P, lo, hi, f)


SHOULDERS = {s: np.array([s * 0.6, 0.95, 0.0]) for s in (-1, 1)}


def sweater_field(P):
    d = body_field(P)
    for s in (-1, 1):
        # joined to the body with a seam's fillet at the shoulder only, so the
        # sleeve hangs against the side without melting into it
        k = 0.06 * np.clip(1 - np.linalg.norm(P - SHOULDERS[s], axis=1) / 0.3, 0, 1)
        d = smin(d, sleeve_field(P, s), k)
    return d * 0.7  # under-reports distance so the coarse pass never skips the surface


def bounds():
    return np.array([-1.05, HEM_Y - 0.1, -0.5]), np.array([1.05, NECK_Y + 0.2, 0.5])


# ─── Knit coordinates and colour ───────────────────────────────────

ROW = 0.04  # one row's height: a chunky Aran yarn
BODY_STITCHES = 64  # round the body (a whole number, so the pattern closes)
SLEEVE_STITCHES = 24
# In the ribbing the shader draws k1p1, one knit column on each moulded ridge,
# so there the stitch coordinate counts two stitches per ridge.
KIND_PLAIN, KIND_RIB, KIND_CABLE = 0.0, 1.0, 2.0


def part_of(P):
    """0 body, 1 collar, 2 left sleeve, 3 right sleeve: whichever field is
    nearest to zero at the point."""
    fields = [np.abs(body_shape(P) - body_relief(P)), np.abs(collar_field(P)), np.abs(sleeve_field(P, -1)), np.abs(sleeve_field(P, 1))]
    return np.argmin(np.stack(fields), axis=0)


def knit(P):
    """Per vertex: (stitch across, row along, kind, cable height 0..1)."""
    n = len(P)
    out = np.zeros((n, 4))
    part = part_of(P)
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    th = np.arctan2(x, z)
    # body: stitches round, rows up from the hem
    m = part == 0
    out[m, 0] = th[m] / (2 * np.pi) * BODY_STITCHES
    out[m, 1] = (y[m] - HEM_Y) / ROW
    cable = cable_relief(P[m])
    in_panel = np.zeros(m.sum(), dtype=bool)
    for cx in CABLES:
        in_panel |= np.abs(x[m] - cx) < CABLE_W * 0.8
    in_panel &= (np.abs(z[m]) > 0.16) & (y[m] > CABLE_Y[0]) & (y[m] < CABLE_Y[1])
    kind = np.where(y[m] < RIB_TOP, KIND_RIB, np.where(in_panel, KIND_CABLE, KIND_PLAIN))
    out[m, 2] = kind
    rib = kind == KIND_RIB
    out[np.flatnonzero(m)[rib], 0] = th[m][rib] / (2 * np.pi) * HEM_RIBS * 2
    out[m, 3] = np.clip(cable / CABLE_H, 0, 1)
    # collar: ribs round, rows up
    m = part == 1
    out[m, 0] = th[m] / (2 * np.pi) * COLLAR_RIBS * 2
    out[m, 1] = (y[m] - (COLLAR["y"] - COLLAR["half_h"])) / ROW
    out[m, 2] = KIND_RIB
    # sleeves: stitches round the sleeve, rows up from the cuff
    for part_id, side in ((2, -1), (3, 1)):
        m = part == part_id
        if not m.any():
            continue
        s, total, ua, ut, _ = sleeve_coords(P[m], side)
        phi = np.arctan2(ut / 0.08, ua / 0.16)
        cuff = total - s < CUFF_LEN
        out[m, 0] = phi / (2 * np.pi) * np.where(cuff, CUFF_RIBS * 2, SLEEVE_STITCHES)
        out[m, 1] = (total - s) / ROW
        out[m, 2] = np.where(cuff, KIND_RIB, KIND_PLAIN)
    return out


WOOL = np.array([0.95, 0.91, 0.82])  # undyed cream wool


def colour(P, N):
    """sRGB per vertex: the wool, heathered, darker inside the hem."""
    c = np.broadcast_to(WOOL, (len(P), 3)).copy()
    heather = sdf.value_noise(P, (0.05, 0.05, 0.05), seed=5) - 0.5
    c *= (1 + 0.06 * heather)[:, None]
    # inside the hem and the neck the wool is in shadow and shows its back
    inside = (P[:, 1] < RIB_TOP + 0.06) & (body_shape(P) < -HEM_WALL * 0.5)
    c[inside] *= 0.72
    return np.clip(c, 0, 1)


# ─── The dress form and its stand ──────────────────────────────────

FORM_NECK_R = 0.15
FORM_TOP = 1.44
POLE_R = 0.042
LEG_REACH = 0.62
HUB_Y = FLOOR_Y + 0.42


def revolve(profile, segs=48):
    """A surface of revolution about y from (radius, y) pairs, top to bottom
    or bottom to top, with the ends closed when their radius is 0."""
    prof = np.asarray(profile, dtype=np.float64)
    a = np.linspace(0, 2 * np.pi, segs, endpoint=False)
    V = np.array([[r * math.sin(t), y, r * math.cos(t)] for r, y in prof for t in a])
    F = []
    for i in range(len(prof) - 1):
        for j in range(segs):
            p = i * segs + j
            q = i * segs + (j + 1) % segs
            F.append([p, q, q + segs])
            F.append([p, q + segs, p + segs])
    V, F = np.asarray(V), np.asarray(F)
    # face outward: a closed outward-facing mesh has a positive signed volume
    t = V[F]
    if np.einsum("ij,ij->i", t[:, 0], np.cross(t[:, 1], t[:, 2])).sum() < 0:
        F = F[:, ::-1]
    return V, F


def form_parts():
    """(name, V, F, colour) for the dress form's visible parts."""
    parts = []
    # the form's neck, linen-covered, rising out of the collar
    parts.append(("form", *revolve([(0.0, FORM_TOP), (FORM_NECK_R - 0.01, FORM_TOP), (FORM_NECK_R, FORM_TOP - 0.012), (FORM_NECK_R, NECK_Y - 0.2), (0.0, NECK_Y - 0.2)]), (0.86, 0.83, 0.76)))
    # its turned wooden cap and finial
    cap = [(0.0, FORM_TOP + 0.135), (0.03, FORM_TOP + 0.13), (0.045, FORM_TOP + 0.11), (0.03, FORM_TOP + 0.085), (0.04, FORM_TOP + 0.07), (0.15, FORM_TOP + 0.055), (0.172, FORM_TOP + 0.035), (0.17, FORM_TOP + 0.005), (0.0, FORM_TOP + 0.005)]
    parts.append(("wood", *revolve(cap), (0.4, 0.25, 0.14)))
    # the form's base plate, seen from below inside the hem
    # (elliptical, like the body, and clear of the hem's inside)
    V, F = revolve([(0.0, RIB_TOP + 0.06), (0.48, RIB_TOP + 0.06), (0.48, RIB_TOP + 0.03), (0.0, RIB_TOP + 0.03)])
    V[:, 2] *= 0.23 / 0.48
    parts.append(("form", V, F, (0.5, 0.47, 0.42)))
    # the pole, with its height collar and thumbscrew
    parts.append(("metal", *revolve([(0.0, RIB_TOP + 0.04), (POLE_R, RIB_TOP + 0.04), (POLE_R, HUB_Y + 0.05), (0.0, HUB_Y + 0.05)], 24), (0.78, 0.79, 0.82)))
    col_y = -1.35
    parts.append(("metal", *revolve([(0.0, col_y + 0.06), (0.065, col_y + 0.06), (0.07, col_y + 0.04), (0.07, col_y - 0.04), (0.065, col_y - 0.06), (0.0, col_y - 0.06)], 32), (0.7, 0.71, 0.74)))
    # wooden hub and three curved legs on felt feet
    parts.append(("wood", *revolve([(0.0, HUB_Y + 0.1), (0.06, HUB_Y + 0.1), (0.1, HUB_Y + 0.06), (0.11, HUB_Y - 0.04), (0.08, HUB_Y - 0.1), (0.0, HUB_Y - 0.1)], 32), (0.4, 0.25, 0.14)))
    return parts


def leg_paths():
    out = []
    for k in range(3):
        a = 2 * np.pi * k / 3 + np.pi / 6  # one leg toward the back, two forward
        d = np.array([math.sin(a), 0.0, math.cos(a)])
        pts = [
            np.array([0.0, HUB_Y, 0.0]) + d * 0.06,
            np.array([0.0, HUB_Y - 0.06, 0.0]) + d * 0.22,
            np.array([0.0, FLOOR_Y + 0.12, 0.0]) + d * 0.45,
            np.array([0.0, FLOOR_Y + 0.035, 0.0]) + d * LEG_REACH,
        ]
        out.append(catmull(pts, 10))
    return out


def anchors():
    """What the scene needs to know: where the front is for the charge signs."""
    P = np.array([[0.0, y, 0.0] for y in np.linspace(RIB_TOP, 1.0, 40)])
    best = 0.0
    for p in P:
        # walk out along +z until the field turns positive
        for zz in np.linspace(0.2, 0.5, 300):
            q = np.array([[p[0], p[1], zz]])
            if body_shape(q)[0] - body_relief(q)[0] > 0:
                best = max(best, zz)
                break
    return {
        "frontZ": round(float(best), 4),
        "chestY": CHEST_Y,
        "hemY": HEM_Y,
        "neckY": NECK_Y,
        "top": round(FORM_TOP + 0.135, 4),
        "halfWidth": 0.63,
        "sleeveX": 0.745,
        "floorY": FLOOR_Y,
    }

"""The lining of the small intestine at two magnifications.

LEVEL 1, THE WALL (units: millimetres). A block of jejunum opened out and
seen from the lumen: y up, the mucosal surface at y = 0 (curving up gently
at the sides: the tube's radius is about 14 mm), x along the gut, +z
towards the viewer. Two circular folds (plicae circulares) cross it, folds
of mucosa over a core of submucosa about 3 mm tall, and under the mucosa
lie the submucosa, the circular and longitudinal muscle and the serosa,
cut on the front and right faces. The villi that carpet everything are not
in this mesh: `villus_low()` is one villus, instanced by the scene at the
`villus_sites()` (each with its normal), with an "atrophy" morph for
coeliac disease.

LEVEL 2, ONE VILLUS (units: 10 um). A villus 560 um tall on a floor of
mucosa with crypts of Lieberkuhn going down into it. Dissected in three
storeys like a textbook figure:

  tip, y > 34     the epithelium peeled off the front, showing the
                  capillary net fountaining over the core
  middle, 8..34   the front half cut away: a section through the axis shows
                  the epithelium (tall columnar cells with their brush
                  border), the lamina propria, the central lacteal laid
                  open, smooth muscle beside it, and the capillaries and
                  vessels at the cut
  base, y < 8     intact, rising out of the floor

Every tissue vertex carries `tube` = (depth below the surface, arc length
along the villus, angle round it, 0), and the scene's fragment shader draws
the cells from those (borders, basal nuclei, goblet cells, brush border):
patterns finer than any mesh, which interpolate cleanly however the mesh
was decimated. The vessels' paths go in the meta for the flows.
"""

import math

import numpy as np

import plantlib as pl
from plantlib import sdf

# ─── Level 1: the wall, mm ─────────────────────────────────────────

CURVE_R = 14.0
BX, BZ = 6.0, 4.0
WALL_T = 2.5
PLICAE = [(-2.6, 2.7, 0.72), (2.9, 2.5, 0.66)]
LAYERS_MM = {"mucosa": 0.42, "muscularisMucosae": 0.5, "submucosa": 1.35, "circular": 1.95, "longitudinal": 2.38}


def surf_y(x, z):
    return z * z / (2 * CURVE_R)


def mucosa_field(P):
    """The mucosal surface: negative inside the tissue."""
    yy = P[:, 1] - surf_y(P[:, 0], P[:, 2])
    d = yy.copy()
    for xk, h, a in PLICAE:
        wob = 0.22 * np.sin(P[:, 2] * 0.6 + xk)
        q = np.stack([P[:, 0] - xk - wob, yy, np.zeros(len(P))], axis=1)
        e = sdf._ellipsoid(q, (0, 0, 0), (a, h, 1.0), (0, 0, 0))
        d = sdf.smin(d, e, 0.35)
    return d


def wall_field(P):
    m = mucosa_field(P)
    yy = P[:, 1] - surf_y(P[:, 0], P[:, 2])
    return np.maximum.reduce([m, -(yy + WALL_T), np.abs(P[:, 0]) - BX, np.abs(P[:, 2]) - BZ])


def wall_tube(P):
    """Per vertex: depth below the mucosal surface, depth below the base
    surface (for the muscle layers), 0, 0."""
    m = -mucosa_field(P)
    yy = surf_y(P[:, 0], P[:, 2]) - P[:, 1]
    return np.stack([np.maximum(m, 0), yy, np.zeros(len(P)), np.zeros(len(P))], axis=1)


def _project(P, field, iters=6, h=1e-3):
    for _ in range(iters):
        f = field(P)
        g = np.stack([(field(P + np.array([h, 0, 0])) - f) / h, (field(P + np.array([0, h, 0])) - f) / h, (field(P + np.array([0, 0, h])) - f) / h], axis=1)
        g2 = np.maximum((g * g).sum(1), 1e-9)
        P = P - (f / g2)[:, None] * g
    f = field(P)
    g = np.stack([(field(P + np.array([h, 0, 0])) - f) / h, (field(P + np.array([0, h, 0])) - f) / h, (field(P + np.array([0, 0, h])) - f) / h], axis=1)
    return P, g / np.maximum(np.linalg.norm(g, axis=1, keepdims=True), 1e-9), np.abs(f)


def villus_sites(spacing=0.235, seed=3):
    """Points on the mucosal surface a villus stands on, about `spacing`
    apart (about 20 a square millimetre), with the outward normal."""
    rng = pl.rng(seed)
    n = 60000
    P = np.stack([rng.uniform(-BX, BX, n), rng.uniform(-0.2, 3.4, n), rng.uniform(-BZ, BZ, n)], axis=1)
    P[:, 1] += surf_y(P[:, 0], P[:, 2])
    P, N, err = _project(P, mucosa_field)
    ok = (err < 0.01) & (np.abs(P[:, 0]) < BX - 0.12) & (np.abs(P[:, 2]) < BZ - 0.12) & (N[:, 1] > -0.2)
    P, N = P[ok], N[ok]
    # greedy Poisson-disc thinning on a hash grid
    keep = []
    grid = {}
    cell = spacing
    for i in rng.permutation(len(P)):
        p = P[i]
        key = tuple((p // cell).astype(int))
        clash = False
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for j in grid.get((key[0] + dx, key[1] + dy, key[2] + dz), ()):
                        if np.sum((P[j] - p) ** 2) < spacing * spacing:
                            clash = True
                            break
                    if clash:
                        break
                if clash:
                    break
            if clash:
                break
        if not clash:
            grid.setdefault(key, []).append(i)
            keep.append(i)
    keep = np.array(keep)
    return P[keep], N[keep]


VL_H = 0.56
VL_R = 0.082


def _lathe(profile, sides, flat=0.78):
    """A closed lathe round +y from (radius, height) rows, flattened in z."""
    a = np.linspace(0, 2 * math.pi, sides, endpoint=False)
    rows = [np.stack([r * np.cos(a), np.full(sides, y), r * np.sin(a) * flat], axis=1) for r, y in profile]
    V = np.concatenate(rows + [np.array([[0, profile[-1][1] + 1e-4, 0]])])
    F = []
    m = len(rows)
    for i in range(m - 1):
        for j in range(sides):
            j2 = (j + 1) % sides
            F.append([i * sides + j, i * sides + j2, (i + 1) * sides + j2, (i + 1) * sides + j])
    tip = len(V) - 1
    for j in range(sides):
        j2 = (j + 1) % sides
        F.append([(m - 1) * sides + j, (m - 1) * sides + j2, tip, tip])
    return V, np.array(F)[:, ::-1]


def _villus_profile(h, r):
    rows = [(r * 1.25, -0.04), (r * 1.08, 0.0)]
    for t in np.linspace(0.08, 0.82, 6):
        rows.append((r * (1.0 - 0.12 * t), h * t))
    for k in range(1, 5):
        ang = k / 5 * math.pi / 2
        rows.append((r * 0.88 * math.cos(ang), h * 0.82 + r * 0.95 * math.sin(ang) + (h * 0.18 - r * 0.95) * (k / 5)))
    return rows


def villus_low(sides=10):
    """One villus for instancing, 0.56 mm tall, base at the origin, +y up;
    and the atrophic stub coeliac disease leaves (same vertices)."""
    V, F = _lathe(_villus_profile(VL_H, VL_R), sides)
    A, _ = _lathe(_villus_profile(VL_H * 0.22, VL_R * 1.45), sides)
    return V, F, A - V


# ─── Level 2: one villus, 10 um ────────────────────────────────────

VH = 56.0
RB, RT = 8.6, 7.0  # radius at the base and of the tip's dome
SQ = 0.85  # z is narrower than x: a slightly flattened finger
EPI = 2.6
TIP_CUT = 34.0
MID_CUT = 8.0
LACT_R, LACT_W = 1.5, 0.25
LACT_TOP = 44.0
CAPR = 0.38
FLOOR = (-26.0, 26.0, -28.0, 12.0, -28.0)  # x0, x1, z0, z1, y bottom
CRYPT_R, CRYPT_LUMEN, CRYPT_DEPTH = 2.4, 0.5, 22.0


def _scaled(P):
    Q = P.copy()
    Q[:, 2] = Q[:, 2] / SQ
    return Q


A_PT = np.array([0.0, -6.0, 0.0])
B_PT = np.array([0.0, VH - RT, 0.0])


def villus_outer(P):
    return SQ * sdf._round_cone(_scaled(P), A_PT, B_PT, RB, RT)


def lacteal_d(P):
    return sdf._capsule(P, (0.0, -12.0, 0.0), (0.0, LACT_TOP - LACT_R, 0.0), LACT_R, LACT_R)


def villus_field(P):
    V = villus_outer(P)
    core = V + EPI
    z, y = P[:, 2], P[:, 1]
    # the tip storey's front: positive inside it; the epithelium there is peeled off
    regA = np.minimum(z, y - TIP_CUT)
    t = np.minimum(np.maximum(V, regA), core)
    # the middle storey: the front half cut away
    t = np.maximum(t, np.minimum.reduce([z, y - MID_CUT, TIP_CUT - y]))
    # room for the lacteal (its own mesh)
    t = np.maximum(t, -(lacteal_d(P) - LACT_W))
    # standing on the floor
    t = sdf.smin(t, np.maximum(y - 0.0, villus_outer(P) - 1.5), 0.0)
    return np.maximum(t, -y - 0.6)


def arc_s(P):
    """Arc length along the villus's meridian: y up the sides, then round the dome."""
    Q = _scaled(P)
    rho = np.hypot(Q[:, 0], Q[:, 2])
    dy = Q[:, 1] - B_PT[1]
    ang = np.arctan2(np.maximum(dy, 0), np.maximum(rho, 1e-6))
    return np.where(dy > 0, B_PT[1] + RT * ang, Q[:, 1])


def villus_tube(P):
    return np.stack([np.maximum(-villus_outer(P), 0), arc_s(P), np.arctan2(P[:, 2], P[:, 0]), np.zeros(len(P))], axis=1)


def lacteal_field(P):
    d = np.abs(lacteal_d(P) - LACT_W / 2) - LACT_W / 2
    # open in the middle storey
    d = np.maximum(d, np.minimum.reduce([P[:, 2], P[:, 1] - MID_CUT, TIP_CUT - P[:, 1]]))
    return np.maximum(d, -P[:, 1] - 8.0)


def core_point(theta, y, lift=0.0):
    """A point on the core's surface (EPI under the outer surface) at angle
    theta (round y from +x) and height y."""
    # the side radius in scaled space at this height, then into real space
    t = np.clip((y - A_PT[1]) / (B_PT[1] - A_PT[1]), 0, 1)
    r = RB + (RT - RB) * t
    if y > B_PT[1]:
        r = math.sqrt(max(RT * RT - (y - B_PT[1]) ** 2, 0.0))
    rr = r - EPI / SQ * 0.95 + lift
    return np.array([rr * math.cos(theta), y, rr * math.sin(theta) * SQ])


def capillary_paths(n=12, seed=4):
    """The arteriole up the core to just under the tip, a fountain of
    capillaries down the core's surface (meridians, with a few crossing
    links), and the venule down the other side into the floor. Returns
    arteriole, venule and the capillary paths (each from the tip branch to
    the base)."""
    rng = pl.rng(seed)
    art = pl.resample(pl.catmull([(-2.6, -14.0, -0.2), (-2.7, 6.0, -0.15), (-2.5, 30.0, -0.1), (-1.6, 46.0, -0.4), (0.0, 50.5, -1.2)], 10), 0.6)
    ven = pl.resample(pl.catmull([(0.4, 50.0, -2.2), (2.6, 44.0, -0.4), (3.0, 26.0, -0.1), (3.1, 6.0, -0.15), (3.0, -14.0, -0.2)], 10), 0.6)
    top = art[-1]
    caps = []
    for k in range(n):
        # the two meridians at the sides lie exactly in the cut plane, so the
        # section shows them; the rest wander a little
        side = k in (0, n // 2)
        th = k / n * 2 * math.pi + (0.0 if side else rng.uniform(-0.08, 0.08))
        ys = np.linspace(VH - 4.0, 2.0, 30)
        pts = [top]
        for i, y in enumerate(ys):
            wob = 0.0 if side else 0.06 * math.sin(i * 0.9 + k)
            pts.append(core_point(th + wob, y, lift=0.15))
        p = np.array(pts)
        caps.append(pl.resample(pl.catmull(p, 3), 0.5))
    # cross links between neighbours, a few per pair
    links = []
    for k in range(n):
        a, b = caps[k], caps[(k + 1) % n]
        for y in rng.uniform(6, VH - 10, 3):
            ia = int(np.argmin(np.abs(a[:, 1] - y)))
            ib = int(np.argmin(np.abs(b[:, 1] - y - rng.uniform(-2, 2))))
            th0 = math.atan2(a[ia, 2] / SQ, a[ia, 0])
            th1 = math.atan2(b[ib, 2] / SQ, b[ib, 0])
            if th1 < th0:
                th1 += 2 * math.pi
            seg = [core_point(th0 + (th1 - th0) * u, a[ia, 1] + (b[ib, 1] - a[ia, 1]) * u, lift=0.15) for u in np.linspace(0, 1, 6)]
            links.append(np.array(seg))
    return art, ven, caps, links


def in_cut_away(P, slack=0.15):
    """Points in the middle storey's removed front half (no tissue there)."""
    P = np.atleast_2d(P)
    return (P[:, 2] > slack) & (P[:, 1] > MID_CUT) & (P[:, 1] < TIP_CUT)


def runs_outside_cut(pts):
    """Split a polyline into the runs that stay out of the cut-away storey."""
    keep = ~in_cut_away(pts)
    runs, cur = [], []
    for p, k in zip(pts, keep):
        if k:
            cur.append(p)
        elif cur:
            runs.append(np.array(cur))
            cur = []
    if cur:
        runs.append(np.array(cur))
    return [r for r in runs if len(r) >= 2]


def floor_field(P):
    x0, x1, z0, z1, yb = FLOOR
    d = np.maximum.reduce([P[:, 1], yb - P[:, 1], x0 - P[:, 0], P[:, 0] - x1, z0 - P[:, 2], P[:, 2] - z1])
    for c in crypts():
        d = np.maximum(d, -sdf._capsule(P, (c[0], 1.0, c[1]), (c[0], -CRYPT_DEPTH, c[1]), CRYPT_LUMEN, CRYPT_LUMEN))
    return d


def crypts():
    out = []
    for x in np.arange(-22.0, 23.0, 5.5):
        for z in (11.9, 4.5, -3.0, -10.5, -18.0, -25.0):
            p = np.array([x + (2.0 if int(z) % 2 else 0.0), z])
            # not under a villus
            if min(np.hypot(p[0] - vx, p[1] - vz) for vx, vz in NEIGHBOURS + [(0.0, 0.0)]) < RB + 1.0:
                continue
            out.append(p)
    return out


NEIGHBOURS = [(-16.5, -9.0), (16.5, -7.5), (-5.5, -20.5), (9.5, -19.5), (-20.0, 6.0), (20.5, 7.5)]


def floor_tube(P):
    """Depth below the nearest free surface: the top, or a crypt's lumen."""
    d = -P[:, 1]
    for c in crypts():
        dc = sdf._capsule(P, (c[0], 1.0, c[1]), (c[0], -CRYPT_DEPTH, c[1]), CRYPT_LUMEN, CRYPT_LUMEN)
        d = np.minimum(d, dc)
    return np.stack([np.maximum(d, 0), -P[:, 1], np.zeros(len(P)), np.ones(len(P))], axis=1)


def muscle_strands():
    """Smooth muscle beside the lacteal, lying on the cut face."""
    out = []
    for x in (-2.2, 2.25):
        ys = np.linspace(-8, LACT_TOP - 4, 40)
        pts = np.stack([x + 0.15 * np.sin(ys * 0.4 + x), ys, np.full_like(ys, -0.05)], axis=1)
        out.append(pts)
    return out


def meta(sites_count, art, ven, caps, links):
    r2 = lambda a: np.round(np.asarray(a, dtype=np.float64), 2).ravel().tolist()
    return {
        "wall": {"unit": "mm", "curveR": CURVE_R, "bx": BX, "bz": BZ, "thickness": WALL_T, "plicae": [list(p) for p in PLICAE], "layers": LAYERS_MM, "villusHeight": VL_H, "villusRadius": VL_R, "sites": sites_count},
        "villus": {
            "unitUm": 10,
            "height": VH,
            "rBase": RB,
            "rTip": RT,
            "squash": SQ,
            "epithelium": EPI,
            "tipCut": TIP_CUT,
            "midCut": MID_CUT,
            "lactealR": LACT_R,
            "lactealTop": LACT_TOP,
            "capR": CAPR,
            "floor": list(FLOOR),
            "neighbours": [list(n) for n in NEIGHBOURS],
            "arteriole": r2(art),
            "venule": r2(ven),
            "capillaries": [r2(c) for c in caps],
            "links": [r2(l) for l in links],
        },
    }

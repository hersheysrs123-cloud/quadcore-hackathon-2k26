"""The lab kit: the bench apparatus the physics and chemistry scenes share,
modelled as it is made (see README.md).

Every part is in the frame and units of the three.js component it replaces,
so a scene swaps a stack of primitives for the part without moving anything:
scene units, y up, the origins named in each builder's docstring. Parts the
scenes drive (a burner's collar, a supply's knob, a valve wheel, a lever) are
separate nodes in their own pivot frames; anything a slider stretches (stand
rods, arms, a ring's radius) stays a three.js primitive.

Turned parts are lathes and machined or moulded parts are chamfered
extrusions (scripts/cannon-model's `lathe`, `crisp`, `extrude`), so their
edges stay crisp. The Bunsen collar, which needs real air holes, is a
signed-distance field.
"""

import math

import numpy as np

import sdf
from cannon import crisp, extrude, lathe

cm = lambda v: v * 0.2  # noqa: E731  one real centimetre in scene units

# ─── Colours (sRGB) ─────────────────────────────────────────────────

CAST = np.array([0.3, 0.34, 0.41])  # hammertone-painted cast iron
STEELC = np.array([0.72, 0.74, 0.78])
BRASSC = np.array([0.8, 0.63, 0.3])
CORK = np.array([0.66, 0.5, 0.33])
DARK = np.array([0.06, 0.06, 0.07])
BLACK = np.array([0.1, 0.11, 0.13])
CASE_GREY = np.array([0.78, 0.8, 0.82])
PANEL = np.array([0.16, 0.18, 0.22])
RED = np.array([0.82, 0.12, 0.1])
LEAD = np.array([0.42, 0.44, 0.47])
PORC = np.array([0.95, 0.94, 0.9])
WHITE = np.array([1.0, 1.0, 1.0])
MICA = np.array([0.62, 0.5, 0.36])
CREAM = np.array([0.9, 0.86, 0.76])
HOUSING = np.array([0.83, 0.85, 0.88])


# ─── Geometry helpers ───────────────────────────────────────────────


def rx(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def ry(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rz(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def xf(part, R=None, t=(0.0, 0.0, 0.0), s=1.0):
    """Scale, rotate, then translate a (V, F, C) part."""
    V, F, C = part
    V = V * s
    if R is not None:
        V = V @ np.asarray(R).T
    return V + np.asarray(t, dtype=np.float64), F, C


def coloured(V, F, colour):
    return V, F, np.tile(np.asarray(colour, dtype=np.float64), (len(V), 1))


def turned(profile, axis="y", segs=48, colour=STEELC, angle=40.0):
    """A lathe part: (along, radius) pairs about x, y or z, crisp-edged."""
    V, F, _ = lathe(profile, axis, segs)
    V, F, _ = crisp(V, F, angle)
    return coloured(V, F, colour)


def turned_rows(profile, axis, segs, colours, angle=40.0):
    """A lathe part coloured per profile point (`colours[i]` for row i)."""
    V, F, row = lathe(profile, axis, segs)
    V, F, row = crisp(V, F, angle, row.astype(np.float64))
    row = np.clip(np.rint(row).astype(int), 0, len(colours) - 1)
    return V, F, np.asarray(colours, dtype=np.float64)[row]


def slab(outline, z0, z1, chamfer, colour, plane="xy"):
    """A chamfered extrusion of an outline. `plane` names the outline's axes:
    "xy" extrudes along z, "xz" along y (the outline's second coordinate is
    z), "zy" along x."""
    V, F = extrude(outline, z0, z1, chamfer)
    if plane == "xz":
        V = np.stack([V[:, 0], V[:, 2], V[:, 1]], axis=1)
        F = F[:, ::-1]
    elif plane == "zy":
        V = np.stack([V[:, 2], V[:, 1], V[:, 0]], axis=1)
        F = F[:, ::-1]
    return coloured(V, F, colour)


def rect(cx, cy, w, h):
    return [(cx - w / 2, cy - h / 2), (cx + w / 2, cy - h / 2), (cx + w / 2, cy + h / 2), (cx - w / 2, cy + h / 2)]


def rounded_rect(cx, cy, w, h, r, n=5):
    pts = []
    for (qx, qy), a0 in (((w / 2 - r, -h / 2 + r), -math.pi / 2), ((w / 2 - r, h / 2 - r), 0.0), ((-w / 2 + r, h / 2 - r), math.pi / 2), ((-w / 2 + r, -h / 2 + r), math.pi)):
        for k in range(n + 1):
            a = a0 + (math.pi / 2) * k / n
            pts.append((cx + qx + r * math.cos(a), cy + qy + r * math.sin(a)))
    return pts


def block(lo, hi, chamfer, colour, r=None):
    """A box from lo to hi, chamfered; `r` rounds its corners seen from above."""
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    if r:
        out = rounded_rect((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, r)
        return slab(out, y0, y1, chamfer, colour, plane="xz")
    return slab(rect((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0), z0, z1, chamfer, colour)


def star(r_out, r_in, n, phase=0.0):
    """A fluted outline: n rounded ridges between r_in and r_out."""
    pts = []
    m = n * 6
    for k in range(m):
        a = phase + 2 * math.pi * k / m
        f = 0.5 + 0.5 * math.cos(n * (a - phase))
        r = r_in + (r_out - r_in) * f ** 0.6
        pts.append((r * math.cos(a), r * math.sin(a)))
    return pts


def knob(r_out, r_in, n, z0, z1, colour, chamfer=0.006):
    """A fluted knob turning about z, from z0 to z1."""
    return slab(star(r_out, r_in, n), z0, z1, chamfer, colour)


def rod(a, b, r, colour, sides=16, caps=True):
    """A straight round bar from a to b."""
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    L = float(np.linalg.norm(b - a))
    prof = [(0.0, 0.0), (0.0, r), (L, r), (L, 0.0)] if caps else [(0.0, r), (L, r)]
    V, F, _ = lathe(prof, "y", sides)
    V, F, _ = crisp(V, F, 40.0)
    d = (b - a) / L
    y = np.array([0.0, 1.0, 0.0])
    v = np.cross(y, d)
    c = float(np.dot(y, d))
    if np.linalg.norm(v) < 1e-9:
        R = np.eye(3) if c > 0 else rx(math.pi)
    else:
        vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
        R = np.eye(3) + vx + vx @ vx * (1 / (1 + c))
    return coloured(V @ R.T + a, F, colour)


def bar(points, r, colour, sides=14, n=6, caps=True):
    """A round bar along a smooth path through `points`."""
    import plantlib as pl

    path = pl.catmull([np.asarray(p, dtype=np.float64) for p in points], n) if len(points) > 2 else np.asarray(points, dtype=np.float64)
    V, F, _, _ = pl.sweep(path, r, sides=sides, cap_start=caps, cap_end=caps)
    V, F, _ = crisp(V, pl.quads_to_tris(F), 60.0)
    return coloured(V, F, colour)


def ring(centre, axis, R, r, colour, segs=48, sides=12):
    """A torus of major radius R about `axis` ("x", "y" or "z")."""
    a = np.linspace(0, 2 * math.pi, segs + 1)
    pts = np.stack([R * np.cos(a), np.zeros_like(a), R * np.sin(a)], axis=1)
    part = bar(list(pts[:-1]) + [pts[0], pts[1]], r, colour, sides=sides, n=2, caps=False)
    R_ = {"y": np.eye(3), "x": rz(math.pi / 2), "z": rx(math.pi / 2)}[axis]
    return xf(part, R_, centre)


def disc_on_cylinder(radius, y, angle, half, colour, n=12):
    """A disc of radius `half` wrapped onto a cylinder of `radius` about y,
    centred at height y and azimuth `angle` (radians from +x toward +z)."""
    rings = np.linspace(0, half, n // 2 + 1)
    V = [[0.0, 0.0]]
    for r_ in rings[1:]:
        for k in range(n * 2):
            a = 2 * math.pi * k / (n * 2)
            V.append([r_ * math.cos(a), r_ * math.sin(a)])
    V = np.array(V)
    F = []
    m = n * 2
    for k in range(m):
        F.append([0, 1 + k, 1 + (k + 1) % m])
    for i in range(len(rings) - 2):
        b0 = 1 + i * m
        b1 = 1 + (i + 1) * m
        for k in range(m):
            k2 = (k + 1) % m
            F.append([b0 + k, b1 + k, b1 + k2])
            F.append([b0 + k, b1 + k2, b0 + k2])
    u, v = V[:, 0], V[:, 1]
    th = angle + u / radius
    P = np.stack([radius * np.cos(th), y + v, radius * np.sin(th)], axis=1)
    F = np.asarray(F)
    # face outward
    t = P[F]
    n_ = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
    out = t.mean(axis=1) * np.array([1, 0, 1])
    if np.einsum("ij,ij->i", n_, out).mean() < 0:
        F = F[:, ::-1]
    return coloured(P, F, colour)


def merge(parts):
    parts = [p for p in parts if p is not None]
    Vs, Fs, Cs = [], [], []
    base = 0
    for V, F, C in parts:
        Vs.append(V)
        Fs.append(np.asarray(F) + base)
        Cs.append(C)
        base += len(V)
    return np.concatenate(Vs), np.concatenate(Fs), np.concatenate(Cs)


# ─── Retort stand ───────────────────────────────────────────────────
# lab-bench.jsx RetortStand: the rod's foot is the origin and the base runs
# out along +x under the arms. Rods and arms stay three.js (their lengths
# vary); the cast base, the boss heads and the clamp are here.


def stand_base():
    """A cast-iron base plate cm(16) x cm(10), 0.12 thick, centred at x =
    cm(5), with a raised boss where the rod screws in at the origin."""
    w, d, t = cm(16), cm(10), 0.12
    plate = block((cm(5) - w / 2, 0.0, -d / 2), (cm(5) + w / 2, t, d / 2), 0.03, CAST, r=0.12)
    # a raised rim round the top, cast in, and the rod's boss
    rim_out = rounded_rect(cm(5), 0.0, w - 0.18, d - 0.18, 0.08)
    rim = slab(rim_out, t - 0.005, t + 0.025, 0.012, CAST * 1.08, plane="xz")
    boss = turned([(t - 0.01, 0.0), (t - 0.01, 0.2), (t + 0.04, 0.19), (t + 0.1, 0.13), (t + 0.12, 0.1), (t + 0.12, 0.0)], "y", 40, CAST)
    # four rubber feet under the corners
    feet = [turned([(-0.012, 0.0), (-0.012, 0.09), (0.0, 0.1), (0.002, 0.0)], "y", 20, DARK) for _ in range(4)]
    feet = [xf(f, None, (cm(5) + sx * (w / 2 - 0.25), 0.012, sz * (d / 2 - 0.22))) for f, (sx, sz) in zip(feet, [(-1, -1), (-1, 1), (1, -1), (1, 1)])]
    return merge([xf(plate, None, (0, 0.012, 0)), xf(rim, None, (0, 0.012, 0)), xf(boss, None, (0, 0.012, 0))] + feet)


def boss_head():
    """A double boss head on the rod at the origin, the arm leaving along +x.
    Returns (cast body, brass thumbscrews)."""
    body = block((-0.13, -0.16, -0.12), (0.15, 0.16, 0.12), 0.03, CAST, r=0.05)
    # the collar the arm passes through, on the +x face
    collar = turned([(0.13, 0.0), (0.13, 0.075), (0.2, 0.07), (0.215, 0.06), (0.215, 0.0)], "x", 28, CAST)
    screws = []
    # one screw on -z bearing on the rod, one on top bearing on the arm
    for R, t in ((rx(-math.pi / 2), (0.0, 0.06, -0.12)), (np.eye(3), (0.09, 0.16, 0.0))):
        shank = turned([(0.0, 0.0), (0.0, 0.022), (0.07, 0.022), (0.07, 0.0)], "y", 12, BRASSC)
        head = knob(0.06, 0.045, 7, 0.0, 0.05, BRASSC, 0.006)
        head = xf(head, rx(-math.pi / 2), (0, 0.07, 0))
        cap = turned([(0.12, 0.0), (0.12, 0.05), (0.125, 0.04), (0.13, 0.0)], "y", 16, BRASSC)
        screws.append(xf(merge([shank, head, cap]), R, t))
    return merge([body, collar]), merge(screws)


def clamp():
    """A two-prong clamp on the end of an arm at the origin, its cork-lined
    jaws closing on a point at x = 0.14 from above and below (y = +-0.12),
    as lab-bench.jsx's clamp does. Returns (steel, cork)."""
    steel = []
    # the clamp's own stem over the arm's end, and the fork it splits into
    steel.append(turned([(-0.16, 0.0), (-0.16, 0.05), (-0.04, 0.05), (-0.02, 0.06), (0.02, 0.06), (0.02, 0.0)], "x", 20, STEELC))
    for s in (-1, 1):
        # each prong: out of the fork, curving to its jaw plate
        steel.append(bar([(0.0, s * 0.03, 0.0), (0.05, s * 0.07, 0.0), (0.08, s * 0.12, 0.0), (0.06, s * 0.13, 0.0)], 0.022, STEELC, n=6))
        steel.append(block((0.0, s * 0.12 - 0.022, -0.17), (0.3, s * 0.12 + 0.022, 0.17), 0.012, STEELC))
    # the wing nut and screw that close the jaws
    steel.append(rod((0.06, -0.2, 0.0), (0.06, 0.2, 0.0), 0.014, STEELC, 10))
    wing = slab([(-0.09, -0.012), (-0.03, -0.02), (0.03, -0.02), (0.09, -0.012), (0.09, 0.012), (0.03, 0.02), (-0.03, 0.02), (-0.09, 0.012)], -0.018, 0.018, 0.006, BRASSC, plane="xz")
    steel.append(xf(merge([wing, turned([(0.0, 0.0), (0.0, 0.03), (0.04, 0.026), (0.04, 0.0)], "y", 14, BRASSC)]), None, (0.06, 0.2, 0.0)))
    cork = []
    for s in (-1, 1):
        y0 = s * 0.12 - s * 0.022
        cork.append(block((0.04, min(y0, y0 - s * 0.035), -0.16), (0.28, max(y0, y0 - s * 0.035), 0.16), 0.01, CORK))
    return merge(steel), merge(cork)


# ─── Bunsen burner ──────────────────────────────────────────────────
# lab-bench.jsx BunsenBurner: origin at the foot, centred on the barrel.

B_BASE_R, B_BASE_H = cm(4.2), 0.2
B_BARREL_R, B_BARREL_H = cm(0.85), cm(9.5)
B_COLLAR_R, B_COLLAR_H, B_COLLAR_Y = cm(1.25), cm(1.9), cm(1.6)
B_MOUTH = B_BASE_H + B_BARREL_H
#: the barrel's air holes, and the collar's (two, opposite, on the x axis)
B_HOLE_R = 0.075
B_HOLE_Y = B_BASE_H + B_COLLAR_Y + B_COLLAR_H / 2
#: where the gas inlet's hose barb ends (the scenes' hoses meet it here)
B_INLET_TIP = (-0.95, 0.29, 0.0)
B_VALVE_AT = (B_BASE_R * 0.7, 0.3, 0.0)


def burner_base():
    R, H = B_BASE_R, B_BASE_H
    prof = [(0.0, 0.0), (0.0, R), (0.025, R), (0.05, R - 0.02), (0.09, R - 0.12), (0.14, R - 0.32), (0.18, 0.36), (H, 0.27), (H + 0.03, 0.24), (H + 0.12, 0.215), (H + 0.12, 0.0)]
    return turned([(y, r) for y, r in prof], "y", 56, CAST)


def burner_barrel():
    r = B_BARREL_R
    prof = [
        (B_BASE_H + 0.1, 0.0),
        (B_BASE_H + 0.1, r * 1.08),
        (B_MOUTH - 0.1, r),
        (B_MOUTH - 0.09, r + 0.02),
        (B_MOUTH - 0.01, r + 0.02),
        (B_MOUTH, r + 0.005),
        (B_MOUTH, r - 0.025),
        (B_MOUTH - 0.25, r - 0.025),
        (B_MOUTH - 0.25, 0.0),
    ]
    cols = [STEELC] * 6 + [DARK] * 3
    barrel = turned_rows(prof, "y", 40, cols)
    # the air holes, dark through the collar when it is open
    holes = [disc_on_cylinder(r * 1.07 + 0.001, B_HOLE_Y, a, B_HOLE_R * 0.95, DARK) for a in (0.0, math.pi)]
    return merge([barrel] + holes)


def burner_inlet():
    """The brass gas inlet: a nut on the barrel's foot, a tube out along -x
    and a barbed nozzle for the hose."""
    y = B_INLET_TIP[1]
    parts = [slab([(0.09 * math.cos(a), 0.09 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 6, endpoint=False) + math.pi / 6], -0.32, -0.2, 0.008, BRASSC, plane="zy")]
    parts[0] = xf(parts[0], None, (0, y, 0))
    barb = [(-0.2, 0.0), (-0.2, 0.05), (-0.55, 0.05), (-0.57, 0.065), (-0.63, 0.052), (-0.66, 0.068), (-0.72, 0.052), (-0.75, 0.07), (-0.81, 0.052), (-0.84, 0.07), (-0.9, 0.05), (-0.95, 0.045), (-0.95, 0.0)]
    parts.append(xf(turned(barb, "x", 24, BRASSC), None, (0, y, 0)))
    return merge(parts)


def burner_valve():
    """The needle valve's knurled wheel, turning about x, centred on its pivot."""
    wheel = knob(0.17, 0.15, 18, -0.04, 0.04, BRASSC, 0.008)
    wheel = xf(wheel, ry(math.pi / 2))
    stem = turned([(-0.18, 0.0), (-0.18, 0.04), (-0.04, 0.04), (-0.04, 0.0)], "x", 16, BRASSC)
    return merge([wheel, stem])


def collar_field(P):
    """The air collar: a brass sleeve with two opposite air holes, a knurled
    band round its top, and a grip tab. Centred on its own middle."""
    H = B_COLLAR_H / 2
    r = np.sqrt(P[:, 0] ** 2 + P[:, 2] ** 2)
    rin, rout = B_BARREL_R + 0.02, B_COLLAR_R
    d = np.maximum(np.maximum(r - rout, rin - r), np.abs(P[:, 1]) - H)
    # a bead round each lip
    for y in (-H, H):
        q = np.stack([r - (rout - 0.005), P[:, 1] - y], axis=1)
        d = sdf.smin(d, np.linalg.norm(q, axis=1) - 0.02, 0.01)
    # air holes along +-x
    for s in (-1, 1):
        hole = sdf._cylinder(P, np.array([s * 0.1, 0.0, 0.0]), np.array([s * 0.4, 0.0, 0.0]), B_HOLE_R)
        d = sdf.smax(d, -hole, 0.006)
    # the grip tab along +z
    tab = np.maximum(np.maximum(np.abs(P[:, 0]) - 0.035, np.abs(P[:, 1]) - H * 0.7), np.abs(P[:, 2] - (rout + 0.06)) - 0.07)
    d = sdf.smin(d, tab, 0.015)
    return d


def collar_bounds():
    return np.array([-0.35, -0.25, -0.35]), np.array([0.35, 0.25, 0.42])


# ─── Tripod ─────────────────────────────────────────────────────────
# lab-bench.jsx Tripod: origin on the ring's top at its centre; a leg is one
# node, top at the origin and foot at y = -1, scaled to the tripod's height.

T_RING_R = cm(4.6)
T_LEG_R = T_RING_R + 0.07
T_SPLAY = 0.22


def tripod_ring():
    """A flat steel ring with three lugs riveted to the legs."""
    # a flat annulus of strip steel
    band = turned([(-0.035, T_RING_R - 0.04), (-0.035, T_RING_R + 0.06), (0.0, T_RING_R + 0.06), (0.0, T_RING_R - 0.04)], "y", 72, STEELC)
    lugs = []
    for k in range(3):
        t = 2 * math.pi * k / 3 + math.pi / 2
        lug = block((-0.05, -0.1, -0.03), (0.05, 0.0, 0.03), 0.006, STEELC)
        rivet = turned([(0.03, 0.0), (0.03, 0.022), (0.045, 0.012), (0.05, 0.0)], "z", 12, STEELC)
        part = merge([lug, xf(rivet, None, (0, -0.05, 0))])
        lugs.append(xf(part, ry(-t + math.pi / 2), (math.cos(t) * (T_LEG_R - 0.01), 0.0, math.sin(t) * (T_LEG_R - 0.01))))
    return merge([band] + lugs)


#: the legs' azimuths (radians), so the scene can place one at each
T_LEG_ANGLES = [2 * math.pi * k / 3 + math.pi / 2 for k in range(3)]


def tripod_leg():
    """One leg, in its own frame: the top at the origin, running down to a
    foot at y = -1 that splays T_SPLAY out along +x. The scene turns it to
    its azimuth and scales y to the tripod's height."""
    pts = [(0.0, -0.02, 0.0), (0.02, -0.25, 0.0), (T_SPLAY - 0.02, -0.97, 0.0), (T_SPLAY, -1.0, 0.0)]
    leg = bar(pts, 0.04, STEELC, n=8)
    foot = turned([(-1.0, 0.0), (-1.0, 0.055), (-0.985, 0.05), (-0.975, 0.0)], "y", 16, DARK)
    return merge([leg, xf(foot, None, (T_SPLAY, 0.0, 0.0))])


# ─── Bench power supply ─────────────────────────────────────────────
# ChemistryCanvas.jsx PowerSupply: centred on the case, front at +z.

PSU = dict(w=2.5, h=1.45, d=1.7)
#: binding posts (x, y) on the front panel: black (-) left, red (+) right
PSU_POSTS = {"neg": (-0.55, -0.42), "pos": (-0.1, -0.42)}
PSU_KNOB_AT = (0.72, 0.28)


def psu_case():
    """The wrap-around steel cover: top and sides, with vent slots."""
    w, h, d = PSU["w"], PSU["h"], PSU["d"]
    cover = block((-w / 2, -h / 2 + 0.06, -d / 2 + 0.06), (w / 2, h / 2, d / 2 - 0.06), 0.035, CASE_GREY)
    slots = []
    for k in range(9):
        x = -0.85 + k * 0.2
        slots.append(block((x - 0.035, h / 2 - 0.004, -0.75), (x + 0.035, h / 2 + 0.006, 0.15), 0.006, PANEL))
    for s in (-1, 1):
        for k in range(6):
            y = 0.35 - k * 0.13
            slots.append(block((s * w / 2 - 0.006, y - 0.025, -0.6), (s * w / 2 + 0.006, y + 0.025, 0.3), 0.006, PANEL))
    return merge([cover] + slots)


def psu_trim():
    """The dark front and rear panels, carry handle, feet and power switch."""
    w, h, d = PSU["w"], PSU["h"], PSU["d"]
    parts = []
    for s in (-1, 1):
        z0, z1 = (d / 2 - 0.08, d / 2) if s > 0 else (-d / 2, -d / 2 + 0.08)
        parts.append(block((-w / 2 + 0.01, -h / 2 + 0.06, z0), (w / 2 - 0.01, h / 2 - 0.01, z1), 0.02, PANEL))
    front = d / 2
    # display bezel: a raised frame round the window the scene's display fills
    frame = [slab(rect(-0.3, 0.3 + 0.26, 1.34, 0.06), front, front + 0.035, 0.01, BLACK), slab(rect(-0.3, 0.3 - 0.26, 1.34, 0.06), front, front + 0.035, 0.01, BLACK), slab(rect(-0.3 - 0.64, 0.3, 0.06, 0.58), front, front + 0.035, 0.01, BLACK), slab(rect(-0.3 + 0.64, 0.3, 0.06, 0.58), front, front + 0.035, 0.01, BLACK)]
    parts += frame
    # power switch: a rocker in a bezel
    parts.append(slab(rect(0.72, -0.38, 0.3, 0.36), front, front + 0.03, 0.01, BLACK))
    parts.append(xf(slab(rect(0.0, 0.0, 0.2, 0.26), 0.0, 0.045, 0.012, np.array([0.7, 0.12, 0.1])), rx(0.18), (0.72, -0.38, front + 0.03)))
    # a lamp bezel the scene's lamp sits in
    parts.append(xf(turned([(0.0, 0.07), (0.03, 0.065), (0.03, 0.05), (0.0, 0.05)], "z", 20, STEELC), None, (0.72, -0.12, front)))
    # the knob's shaft bush
    parts.append(xf(turned([(0.0, 0.0), (0.0, 0.07), (0.03, 0.06), (0.03, 0.0)], "z", 20, STEELC), None, (PSU_KNOB_AT[0], PSU_KNOB_AT[1], front)))
    # carry handle: two mounts and a bar along x, above the top, toward the front
    for s in (-1, 1):
        parts.append(block((s * 0.78 - 0.07, h / 2 - 0.02, 0.28), (s * 0.78 + 0.07, h / 2 + 0.2, 0.42), 0.02, BLACK))
    parts.append(rod((-0.85, h / 2 + 0.24, 0.35), (0.85, h / 2 + 0.24, 0.35), 0.055, BLACK, 18))
    for s in (-1, 1):
        parts.append(xf(turned([(0.0, 0.0), (0.0, 0.07), (0.05, 0.07), (0.05, 0.0)], "x", 16, BLACK), None, (s * 0.8 - (0.05 if s > 0 else 0), h / 2 + 0.24, 0.35)))
    # rubber feet
    for sx in (-1, 1):
        for sz in (-1, 1):
            parts.append(xf(turned([(0.0, 0.0), (0.0, 0.11), (0.06, 0.1), (0.07, 0.0)], "y", 16, DARK), None, (sx * (w / 2 - 0.22), -h / 2 - 0.01, sz * (d / 2 - 0.22))))
    return merge(parts)


def psu_knob():
    """The current knob, turning about z, its pointer line toward -y."""
    body = knob(0.21, 0.19, 20, 0.0, 0.12, BLACK, 0.01)
    skirt = turned([(0.0, 0.0), (0.0, 0.25), (0.025, 0.25), (0.035, 0.215), (0.035, 0.0)], "z", 40, BLACK)
    cap = turned([(0.12, 0.0), (0.12, 0.17), (0.145, 0.16), (0.15, 0.0)], "z", 32, STEELC)
    pointer = block((-0.012, -0.19, 0.135), (0.012, -0.03, 0.155), 0.004, WHITE)
    return merge([skirt, body, cap, pointer])


def psu_posts():
    """Binding posts: (brass bodies, coloured caps), on the front panel."""
    front = PSU["d"] / 2
    brass, caps = [], []
    for key, colour in (("neg", BLACK), ("pos", RED)):
        x, y = PSU_POSTS[key]
        b = turned([(0.0, 0.0), (0.0, 0.13), (0.03, 0.13), (0.04, 0.1), (0.1, 0.1), (0.1, 0.035), (0.2, 0.035), (0.21, 0.0)], "z", 24, BRASSC)
        c = turned([(0.1, 0.0), (0.1, 0.11), (0.2, 0.1), (0.23, 0.07), (0.24, 0.0)], "z", 24, colour)
        k = knob(0.115, 0.1, 12, 0.11, 0.2, colour, 0.01)
        brass.append(xf(b, None, (x, y, front)))
        caps.append(xf(merge([c, k]), None, (x, y, front)))
    return merge(brass), merge(caps)


# ─── Instrument cases: the GM scaler and the HV supply ──────────────
# RadioactiveDecayCanvas.jsx: origin on the bench at the case's centre.


def instrument(w, h, d, colour, display, knobs=(), sockets=()):
    """A bench instrument: a moulded case with a tilt bail, a dark front
    panel, a display window bezel, push buttons, knobs and sockets."""
    parts = [block((-w / 2, 0.04, -d / 2), (w / 2, h - 0.01, d / 2), 0.05, colour, r=0.07)]
    front = d / 2
    parts.append(slab(rounded_rect(0, h / 2 + 0.02, w - 0.12, h - 0.16, 0.04), front - 0.01, front + 0.015, 0.008, PANEL))
    dx, dy, dw, dh = display
    for sx, sy, ww, hh in ((dx, dy + dh / 2 + 0.025, dw + 0.1, 0.05), (dx, dy - dh / 2 - 0.025, dw + 0.1, 0.05), (dx - dw / 2 - 0.025, dy, 0.05, dh), (dx + dw / 2 + 0.025, dy, 0.05, dh)):
        parts.append(slab(rect(sx, sy, ww, hh), front + 0.015, front + 0.04, 0.008, BLACK))
    for kx, ky in knobs:
        parts.append(xf(merge([knob(0.1, 0.088, 14, 0.0, 0.07, BLACK, 0.008), turned([(0.07, 0.0), (0.07, 0.07), (0.085, 0.06), (0.09, 0.0)], "z", 20, STEELC)]), None, (kx, ky, front + 0.015)))
    for sx, sy, sc in sockets:
        parts.append(xf(turned([(0.0, 0.0), (0.0, 0.06), (0.04, 0.06), (0.05, 0.04), (0.05, 0.0)], "z", 18, sc), None, (sx, sy, front + 0.015)))
    # rubber feet and a folding bail under the front
    for sx in (-1, 1):
        for sz in (-1, 1):
            parts.append(xf(turned([(0.0, 0.0), (0.0, 0.07), (0.035, 0.065), (0.045, 0.0)], "y", 14, DARK), None, (sx * (w / 2 - 0.15), 0.0, sz * (d / 2 - 0.15))))
    parts.append(bar([(-w / 2 + 0.02, 0.1, d / 2 - 0.12), (-w / 2 + 0.02, 0.03, d / 2 - 0.02), (w / 2 - 0.02, 0.03, d / 2 - 0.02), (w / 2 - 0.02, 0.1, d / 2 - 0.12)], 0.018, STEELC, n=4))
    return merge(parts)


def scaler():
    """The GM counter (1.6 x 0.8 x 0.9): its LCD at (-0.15, 0.44), the count
    LED at (0.6, 0.44), START / STOP / RESET buttons and a BNC input."""
    p = instrument(1.6, 0.8, 0.9, np.array([0.86, 0.85, 0.8]), (-0.15, 0.44, 0.95, 0.34), sockets=[(0.6, 0.2, STEELC)])
    btns = []
    for k, c in enumerate((np.array([0.12, 0.55, 0.25]), np.array([0.75, 0.15, 0.12]), np.array([0.3, 0.33, 0.38]))):
        btns.append(xf(slab(rounded_rect(0, 0, 0.16, 0.09, 0.02), 0.0, 0.035, 0.008, c), None, (-0.5 + k * 0.24, 0.16, 0.45 + 0.015)))
    # the LED's chrome bezel
    btns.append(xf(turned([(0.0, 0.085), (0.02, 0.08), (0.02, 0.065), (0.0, 0.065)], "z", 20, STEELC), None, (0.6, 0.44, 0.45 + 0.015)))
    return merge([p] + btns)


def hv_supply():
    """The high-voltage supply (1.5 x 0.8 x 0.9): a meter window at (-0.2,
    0.44), a voltage knob at (0.45, 0.44), and red / black terminals on top."""
    p = instrument(1.5, 0.8, 0.9, np.array([0.3, 0.33, 0.4]), (-0.2, 0.44, 0.7, 0.3), knobs=[(0.45, 0.44)])
    t = []
    for x, c in ((-0.3, RED), (0.3, BLACK)):
        t.append(xf(turned([(0.0, 0.0), (0.0, 0.09), (0.03, 0.09), (0.04, 0.06), (0.1, 0.06), (0.11, 0.0)], "y", 18, c), None, (x, 0.79, 0.3)))
    # a warning label beside the meter
    t.append(slab(rect(-0.2, 0.17, 0.6, 0.1), 0.465, 0.47, 0.002, np.array([0.95, 0.78, 0.1])))
    return merge([p] + t)


# ─── Geiger-Muller tube ─────────────────────────────────────────────
# RadioactiveDecayCanvas.jsx GeigerTube: centred on the tube, its axis x,
# the end window toward -x. The stand is in the scene's frame about GM_X.

GM_R, GM_L = 0.42, 1.7
GM_TRACK_Y = 2.2


def gm_tube():
    """(steel body, dark trim): the tube, its window end and its connector."""
    h = GM_L / 2
    body = turned_rows(
        [(-h + 0.03, 0.0), (-h + 0.03, 0.37), (-h + 0.06, 0.37), (-h + 0.06, GM_R), (-0.3, GM_R), (-0.28, GM_R - 0.012), (-0.2, GM_R - 0.012), (-0.18, GM_R), (h - 0.08, GM_R), (h - 0.03, GM_R - 0.05), (h, GM_R - 0.06), (h, 0.0)],
        "x",
        64,
        [MICA, MICA, STEELC, STEELC, STEELC, STEELC, STEELC, STEELC, STEELC, STEELC, STEELC, STEELC],
    )
    # the open collar round the window, a knurled grip, the clamp band and
    # the connector at the back
    trim = [turned([(-h - 0.04, GM_R - 0.03), (-h - 0.04, 0.46), (-h + 0.05, 0.46), (-h + 0.06, GM_R - 0.005), (-h + 0.06, GM_R - 0.03)], "x", 64, BLACK)]
    grip = knob(GM_R + 0.025, GM_R + 0.005, 36, -0.62, -0.42, BLACK, 0.006)
    trim.append(xf(grip, ry(math.pi / 2)))
    trim.append(turned([(-0.05, 0.0), (-0.05, 0.445), (0.05, 0.445), (0.05, 0.0)], "x", 64, BLACK))
    conn = turned([(h, 0.0), (h, 0.12), (h + 0.06, 0.12), (h + 0.06, 0.08), (h + 0.2, 0.08), (h + 0.21, 0.06), (h + 0.21, 0.0)], "x", 24, STEELC)
    # a boss on top for the count LED (the scene's LED sits on it at x 0.3)
    led = turned([(GM_R - 0.02, 0.0), (GM_R - 0.02, 0.09), (GM_R + 0.03, 0.085), (GM_R + 0.03, 0.0)], "y", 20, BLACK)
    trim.append(xf(led, None, (0.3, 0.0, 0.0)))
    return merge([body, conn]), merge(trim)


def gm_stand():
    """A round cast foot, a rod and a cradle under the tube, about GM_X."""
    top = GM_TRACK_Y - GM_R
    foot = turned([(0.0, 0.0), (0.0, 0.5), (0.03, 0.5), (0.06, 0.47), (0.11, 0.3), (0.14, 0.12), (0.2, 0.08), (0.2, 0.0)], "y", 48, CAST)
    pole = rod((0, 0.15, 0), (0, top - 0.06, 0), 0.05, STEELC, 18)
    # a V cradle the tube lies in
    cradle = slab([(-0.3, -0.06), (0.3, -0.06), (0.36, 0.12), (0.2, 0.12), (0.0, -0.01), (-0.2, 0.12), (-0.36, 0.12)], -0.08, 0.08, 0.012, CAST, plane="zy")
    return merge([foot, pole, xf(cradle, None, (0, top - 0.08, 0))])


def round_foot(r=0.5, h=0.12):
    """A cast round foot for a single rod (the barrier's stand)."""
    return turned([(0.0, 0.0), (0.0, r), (0.03, r), (0.05, r - 0.03), (h * 0.8, r * 0.55), (h, r * 0.3), (h + 0.06, 0.1), (h + 0.06, 0.0)], "y", 48, CAST)


# ─── Lead castle ────────────────────────────────────────────────────
# RadioactiveDecayCanvas.jsx SourceHolder, in the scene's frame: lead
# bricks laid in staggered courses, as a real castle is built.

SOURCE_X = -3.7
HOLDER_BACK_X = SOURCE_X - 2.05
HOLDER_HALF_Z = 2.15
HOLDER_H = 3.7
HOLDER_FLOOR = 0.18


def _course(x0, x1, z0, z1, y0, y1, along, offset, length, rng):
    """One course of bricks filling the box, laid along `along` ("x"/"z")."""
    bricks = []
    a0, a1 = (x0, x1) if along == "x" else (z0, z1)
    gap = 0.006
    edges = [a0]
    a = a0 + offset
    while a < a1 - 0.15:
        if a > a0 + 0.15:
            edges.append(a)
        a += length
    edges.append(a1)
    for e0, e1 in zip(edges[:-1], edges[1:]):
        shade = LEAD * (0.92 + 0.12 * rng.random())
        if along == "x":
            lo, hi = (e0 + gap, y0 + gap, z0), (e1 - gap, y1 - gap, z1)
        else:
            lo, hi = (x0, y0 + gap, e0 + gap), (x1, y1 - gap, e1 - gap)
        bricks.append(block(lo, hi, 0.018, shade))
    return bricks


def lead_castle():
    rng = np.random.default_rng(7)
    parts = []
    floor = HOLDER_FLOOR
    x1 = SOURCE_X + 1.95
    # the base plate: one cast slab
    parts.append(block((SOURCE_X - 0.2 - 2.35, -0.01, -(HOLDER_HALF_Z + 0.45)), (SOURCE_X - 0.2 + 2.35, floor, HOLDER_HALF_Z + 0.45), 0.02, LEAD * 0.9))
    course_h = 0.462
    n = int(round(HOLDER_H / course_h))
    ch = HOLDER_H / n
    for i in range(n):
        y0 = floor + i * ch - 0.01
        y1 = y0 + ch
        off = 0.46 if i % 2 else 0.92
        # back wall, laid along z
        parts += _course(HOLDER_BACK_X - 0.25, HOLDER_BACK_X + 0.25, -(HOLDER_HALF_Z + 0.28), HOLDER_HALF_Z + 0.28, y0, y1 + 0.03 * (i == n - 1), "z", off, 0.92, rng)
        # far wall, laid along x
        parts += _course(HOLDER_BACK_X + 0.25, x1, -(HOLDER_HALF_Z + 0.5), -HOLDER_HALF_Z, y0, y1, "x", off, 0.92, rng)
    # the near wall is one course high, so the sample is in view
    parts += _course(HOLDER_BACK_X + 0.25, x1, HOLDER_HALF_Z, HOLDER_HALF_Z + 0.5, floor - 0.01, floor + 0.45, "x", 0.6, 0.92, rng)
    return merge(parts)


# ─── Circuit board parts ────────────────────────────────────────────
# CircuitBoardCanvas.jsx: each in its component's own frame.


def bulb_holder():
    """A batten lampholder: porcelain plate and socket barrel, with the
    contact ring the bulb's thread sits in (Bulb's origin)."""
    plate = turned([(0.0, 0.0), (0.0, 0.34), (0.022, 0.335), (0.032, 0.31), (0.032, 0.0)], "y", 48, PORC)
    barrel = turned_rows([(0.03, 0.0), (0.03, 0.2), (0.27, 0.17), (0.28, 0.165), (0.28, 0.13), (0.24, 0.13), (0.24, 0.0)], "y", 40, [PORC, PORC, PORC, PORC, STEELC * 0.85, STEELC * 0.6, STEELC * 0.6])
    screws = [xf(turned([(0.0, 0.0), (0.0, 0.03), (0.008, 0.028), (0.014, 0.018), (0.016, 0.0)], "y", 14, STEELC), None, (s * 0.25, 0.032, 0)) for s in (-1, 1)]
    return merge([plate, barrel] + screws)


def bulb_base():
    """An MES screw cap from y = 0 (the contact) to 0.18, its thread rolled."""
    prof = [(0.0, 0.0), (0.0, 0.05), (0.012, 0.06), (0.02, 0.1)]
    cols = [DARK, DARK, DARK, DARK]
    for k in range(4):
        y = 0.03 + k * 0.038
        prof += [(y, 0.138), (y + 0.019, 0.152)]
        cols += [BRASSC, BRASSC]
    prof += [(0.175, 0.15), (0.18, 0.14), (0.185, 0.12), (0.185, 0.0)]
    cols += [BRASSC, BRASSC, np.array([0.85, 0.85, 0.82]), np.array([0.85, 0.85, 0.82])]
    return turned_rows(prof, "y", 40, cols, angle=50.0)


def bulb_glass():
    """The envelope (a thin lathe shell) and the glass stem inside it."""
    prof = [(0.17, 0.115), (0.2, 0.118), (0.25, 0.15), (0.3, 0.2), (0.36, 0.232), (0.42, 0.235), (0.5, 0.215), (0.56, 0.17), (0.6, 0.1), (0.618, 0.03), (0.62, 0.0)]
    V, F, _ = lathe(prof, "y", 48)
    env = coloured(V, F, np.array([0.86, 0.92, 0.97]))
    stem = turned([(0.17, 0.0), (0.17, 0.06), (0.24, 0.032), (0.3, 0.022), (0.31, 0.018), (0.31, 0.0)], "y", 20, np.array([0.86, 0.92, 0.97]))
    return merge([env, stem])


def bulb_wires():
    """The two lead-in wires from the stem up to the filament's ends."""
    return merge([bar([(s * 0.02, 0.28, 0.0), (s * 0.04, 0.33, 0.0), (s * 0.05, 0.36, 0.0)], 0.007, STEELC, sides=6, n=4) for s in (-1, 1)])


def cell():
    """(wrapper, steel): an AA cell lying along x, + toward +x."""
    L = 0.76
    h = L / 2
    wrap = turned_rows([(-h + 0.02, 0.163), (-h + 0.21, 0.163), (-h + 0.22, 0.1635), (h - 0.2, 0.1635), (h - 0.19, 0.163), (h - 0.04, 0.163), (h - 0.02, 0.152)], "x", 40, [np.array([0.17, 0.19, 0.23])] * 2 + [np.array([0.9, 0.7, 0.24])] * 2 + [np.array([0.17, 0.19, 0.23])] * 3, angle=60.0)
    steel = turned([(-h, 0.0), (-h, 0.15), (-h + 0.012, 0.16), (-h + 0.03, 0.16), (h - 0.03, 0.16), (h - 0.015, 0.15), (h, 0.13), (h, 0.07), (h + 0.05, 0.065), (h + 0.055, 0.05), (h + 0.055, 0.0)], "x", 40, STEELC)
    return wrap, steel


def battery_holder():
    """(moulded holder, steel contacts) for two AA cells end to end, the
    cells' axis along x at y = 0.42, centred at x = +-0.42."""
    body = block((-1.15, 0.0, -0.45), (1.15, 0.3, 0.45), 0.04, HOUSING, r=0.06)
    # the cradles the cells lie in: two raised side walls along the tray
    walls = []
    for s in (-1, 1):
        walls.append(block((-0.95, 0.28, s * 0.18 - 0.03), (0.95, 0.45, s * 0.18 + 0.03), 0.015, HOUSING))
    # end walls carrying the contacts, and a centre divider
    for x in (-0.86, 0.0, 0.86):
        walls.append(block((x - 0.035, 0.28, -0.21), (x + 0.035, 0.5, 0.21), 0.015, HOUSING))
    contacts = []
    # coil springs at each cell's - end, flat tabs at its + end
    for cx in (-0.42, 0.42):
        neg = cx - 0.38
        ts = np.linspace(0, 8 * math.pi, 120)
        pts = [(neg - 0.06 + 0.07 * (i / 119), 0.42 + 0.08 * math.sin(t), 0.08 * math.cos(t)) for i, t in enumerate(ts)]
        contacts.append(bar(pts, 0.007, STEELC, sides=6, n=1, caps=True))
        contacts.append(block((cx + 0.39, 0.34, -0.09), (cx + 0.43, 0.5, 0.09), 0.006, STEELC))
    return merge([body] + walls), merge(contacts)


def binding_post():
    """(brass and steel, cap): BindingPost's frame, origin at its foot."""
    metal = merge([
        turned([(0.0, 0.0), (0.0, 0.16), (0.04, 0.15), (0.06, 0.12), (0.06, 0.0)], "y", 24, BRASSC),
        turned([(0.3, 0.0), (0.3, 0.05), (0.36, 0.05), (0.37, 0.035), (0.37, 0.0)], "y", 16, STEELC),
    ])
    cap = merge([
        turned([(0.06, 0.0), (0.06, 0.09), (0.08, 0.095), (0.3, 0.085), (0.31, 0.06), (0.31, 0.0)], "y", 24, WHITE),
        xf(knob(0.105, 0.092, 14, 0.0, 0.1, WHITE, 0.008), rx(-math.pi / 2), (0, 0.29, 0)),
    ])
    return metal, cap


def knife_switch():
    """(porcelain base, brass jaws and steel blade, black handle)."""
    base = block((-0.22, 0.0, -0.43), (0.22, 0.09, 0.43), 0.025, CREAM, r=0.04)
    metal = []
    for z in (-0.3, 0.3):
        for s in (-1, 1):
            metal.append(block((s * 0.045 - 0.012, 0.09, z - 0.05), (s * 0.045 + 0.012, 0.25, z + 0.05), 0.006, BRASSC))
        metal.append(block((-0.07, 0.09, z - 0.06), (0.07, 0.12, z + 0.06), 0.008, BRASSC))
        metal.append(rod((-0.08, 0.2, z), (0.08, 0.2, z), 0.018, BRASSC, 10))
        for s in (-1, 1):
            metal.append(xf(turned([(0.0, 0.0), (0.0, 0.03), (0.01, 0.026), (0.016, 0.0)], "y", 12, STEELC), None, (s * 0.15, 0.09, z)))
    metal.append(block((-0.02, 0.17, -0.34), (0.02, 0.23, 0.36), 0.006, STEELC))
    grip = turned([(0.0, 0.0), (0.0, 0.05), (0.05, 0.065), (0.11, 0.06), (0.14, 0.035), (0.15, 0.0)], "y", 20, BLACK)
    handle = merge([rod((0, 0.23, -0.24), (0, 0.33, -0.24), 0.035, BLACK, 14), xf(grip, None, (0, 0.3, -0.24))])
    return base, merge(metal), handle


def meter_case():
    """A digital panel meter (0.8 x 0.2 x 0.52): bezel and LCD recess on top."""
    body = block((-0.4, 0.0, -0.26), (0.4, 0.2, 0.26), 0.03, HOUSING, r=0.035)
    bezel = []
    for cx, cz, ww, dd in ((0.0, 0.18, 0.68, 0.04), (0.0, -0.18, 0.68, 0.04), (-0.32, 0.0, 0.04, 0.32), (0.32, 0.0, 0.04, 0.32)):
        bezel.append(block((cx - ww / 2, 0.195, cz - dd / 2), (cx + ww / 2, 0.215, cz + dd / 2), 0.006, np.array([0.17, 0.2, 0.27])))
    lcd = block((-0.3, 0.19, -0.16), (0.3, 0.205, 0.16), 0.003, np.array([0.03, 0.06, 0.05]))
    sockets = [xf(turned([(0.0, 0.0), (0.0, 0.04), (0.02, 0.04), (0.025, 0.028), (0.025, 0.0)], "y", 14, c), None, (s * 0.22, 0.195, -0.215)) for s, c in ((-1, BLACK), (1, RED))]
    return merge([body, lcd] + bezel + sockets)


# ─── Induction: demonstration galvanometer and lamp ─────────────────
# PhysicsCanvas.jsx: origins on the bench at each instrument's centre.


def galvo_case():
    """(black case, chrome bezel): a demonstration meter 2.2 x 1.3 x 0.35
    standing on the bench, its dial face at z 0.205."""
    case = merge([
        block((-1.1, 0.0, -0.175), (1.1, 1.3, 0.175), 0.05, BLACK * 1.4, r=None),
        block((-1.2, 0.0, -0.3), (1.2, 0.08, 0.3), 0.03, BLACK * 1.2),
    ])
    w, h = 2.08, 1.18
    bez = []
    for cx, cy, ww, hh in ((0, 0.65 + h / 2 - 0.04, w, 0.08), (0, 0.65 - h / 2 + 0.04, w, 0.08), (-w / 2 + 0.04, 0.65, 0.08, h), (w / 2 - 0.04, 0.65, 0.08, h)):
        bez.append(slab(rect(cx, cy, ww, hh), 0.17, 0.215, 0.012, STEELC))
    # terminal posts on the plinth
    for x, c in ((-0.85, RED), (0.85, BLACK)):
        bez.append(xf(merge([turned([(0.0, 0.0), (0.0, 0.08), (0.04, 0.075), (0.05, 0.06), (0.16, 0.06), (0.17, 0.0)], "y", 18, BRASSC)]), None, (x, 0.08, 0.22)))
        case = merge([case, xf(knob(0.07, 0.06, 10, 0.0, 0.08, c, 0.006), rx(-math.pi / 2), (x, 0.24, 0.22))])
    return case, merge(bez)


def demo_lamp():
    """(porcelain batten holder, brass B22 cap, glass): the induction scene's
    demonstration bulb, standing on the bench."""
    holder = turned([(0.0, 0.0), (0.0, 0.48), (0.03, 0.47), (0.24, 0.44), (0.3, 0.42), (0.32, 0.3), (0.42, 0.29), (0.42, 0.0)], "y", 56, PORC)
    holder = merge([holder] + [xf(turned([(0.0, 0.0), (0.0, 0.07), (0.04, 0.065), (0.06, 0.04), (0.06, 0.0)], "y", 16, BRASSC), None, (s * 0.34, 0.24, 0.0)) for s in (-1, 1)])
    cap = turned([(0.27, 0.0), (0.27, 0.27), (0.29, 0.28), (0.47, 0.28), (0.5, 0.26), (0.52, 0.2), (0.52, 0.0)], "y", 48, BRASSC)
    # the bayonet pins either side of the cap
    pins = [rod((s * 0.26, 0.36, 0.0), (s * 0.32, 0.36, 0.0), 0.03, BRASSC, 10) for s in (-1, 1)]
    prof = [(0.5, 0.2), (0.56, 0.22), (0.64, 0.3), (0.72, 0.4), (0.82, 0.44), (0.92, 0.43), (1.04, 0.37), (1.14, 0.25), (1.21, 0.1), (1.23, 0.0)]
    V, F, _ = lathe(prof, "y", 56)
    glass = coloured(V, F, np.array([0.95, 0.97, 1.0]))
    return holder, merge([cap] + pins), glass


# ─── Bench gas tap ──────────────────────────────────────────────────
# CombustionFireTriangleCanvas.jsx GasTap: origin on the bench under the tap.


def gas_turret():
    """(painted turret, brass valve body and hose nozzle along +x)."""
    turret = merge([
        turned([(0.0, 0.0), (0.0, 0.3), (0.03, 0.29), (0.06, 0.24), (0.3, 0.2), (0.38, 0.16), (0.4, 0.14), (0.4, 0.0)], "y", 40, np.array([0.85, 0.66, 0.1])),
    ])
    brass = merge([
        turned([(0.38, 0.0), (0.38, 0.15), (0.45, 0.15), (0.5, 0.13), (0.62, 0.13), (0.66, 0.09), (0.7, 0.07), (0.7, 0.0)], "y", 32, BRASSC),
        xf(turned([(0.0, 0.0), (0.0, 0.07), (0.25, 0.06), (0.27, 0.075), (0.3, 0.06), (0.32, 0.075), (0.35, 0.06), (0.37, 0.07), (0.4, 0.05), (0.4, 0.0)], "x", 24, BRASSC), None, (0.0, 0.42, 0.0)),
    ])
    return turret, brass


def gas_lever():
    """The tap's lever, turning about y at its hub (origin): along +x open."""
    hub = turned([(-0.05, 0.0), (-0.05, 0.075), (0.03, 0.075), (0.05, 0.05), (0.05, 0.0)], "y", 24, BRASSC)
    arm = bar([(0.04, 0.0, 0.0), (0.2, 0.01, 0.0), (0.42, 0.03, 0.0)], 0.03, RED, sides=12, n=4)
    grip = xf(turned([(0.0, 0.0), (0.0, 0.045), (0.08, 0.05), (0.1, 0.0)], "x", 16, RED), None, (0.4, 0.03, 0.0))
    return merge([hub, arm, grip])


# ─── Hotplate ───────────────────────────────────────────────────────
# ParticleModelMatterCanvas.jsx HotPlate: origin on the bench at the
# plate's centre, the control fascia toward +z. The glowing face and its
# rings stay three.js (they follow the heating).

HP_TOP = 0.5
HP_W = 4.6


def hotplate():
    """(enamel body with knobs, black ceramic top): the body on rubber feet,
    side vents, a dark fascia with a display bezel and two fluted knobs, and
    the ceramic glass top plate."""
    w = HP_W
    body = [block((-w / 2, 0.02, -w / 2), (w / 2, HP_TOP - 0.01, w / 2), 0.06, np.array([0.88, 0.89, 0.9]), r=0.18)]
    body.append(slab(rounded_rect(0, 0.26, w - 0.3, HP_TOP - 0.16, 0.05), w / 2 - 0.02, w / 2 + 0.012, 0.01, PANEL))
    for cx, cy, ww, hh in ((0, 0.26 + 0.14, 1.04, 0.05), (0, 0.26 - 0.14, 1.04, 0.05), (-0.5, 0.26, 0.05, 0.23), (0.5, 0.26, 0.05, 0.23)):
        body.append(slab(rect(cx, cy, ww, hh), w / 2 + 0.012, w / 2 + 0.035, 0.008, BLACK))
    for s in (-1, 1):
        for k in range(8):
            z = -1.6 + k * 0.4
            body.append(block((s * w / 2 - 0.008, 0.16, z - 0.07), (s * w / 2 + 0.008, 0.38, z + 0.07), 0.006, PANEL))
    for sx in (-1, 1):
        for sz in (-1, 1):
            body.append(xf(turned([(0.0, 0.0), (0.0, 0.18), (0.022, 0.17), (0.03, 0.0)], "y", 18, DARK), None, (sx * 2.0, 0.0, sz * 2.0)))
    # knobs: red (heat) and blue (cool), fluted, their pointers up
    for x, c in ((-1.4, RED), (1.4, np.array([0.12, 0.3, 0.75]))):
        k = merge([knob(0.17, 0.15, 14, 0.0, 0.1, c, 0.01), block((-0.015, 0.03, 0.1), (0.015, 0.14, 0.112), 0.003, WHITE)])
        body.append(xf(k, None, (x, 0.28, w / 2 + 0.012)))
    top = block((-2.15, HP_TOP - 0.01, -2.15), (2.15, HP_TOP + 0.04, 2.15), 0.015, np.array([0.1, 0.11, 0.13]), r=0.12)
    return merge(body), top


# ─── Distillation furnace and crude tank ────────────────────────────
# ChemistryCanvas.jsx Furnace: origin at FURNACE_POS (x, z) with absolute y.
# The fire, the glowing lining, the coil, the burners and the sight-port
# glass stay three.js (they follow the heat).

HEATER = dict(w=1.9, h=2.0, d=1.5, legs=0.45, wall=0.08)
F_FLOOR = -7.6 / 2 - 0.95 + 0.1
F_BOTTOM = F_FLOOR + HEATER["legs"]
F_TOP = F_BOTTOM + HEATER["h"]
F_CONV_H = 0.8
F_STACK_H = 1.9
CASING = np.array([0.74, 0.78, 0.83])
TRIM = np.array([0.42, 0.47, 0.55])


def furnace():
    """(casing, steelwork): an insulated box cut away at the front, on four
    I-beam legs, with stiffeners, a convection section and a tapered stack."""
    w, h, d, t = HEATER["w"], HEATER["h"], HEATER["d"], HEATER["wall"]
    b, top = F_BOTTOM, F_TOP
    casing = [
        block((-w / 2 - 0.02, b, -d / 2 - 0.02), (w / 2 + 0.02, b + t, d / 2 + 0.02), 0.012, CASING),
        block((-w / 2 - 0.02, top - t, -d / 2 - 0.02), (w / 2 + 0.02, top, d / 2 + 0.02), 0.012, CASING),
        block((-w / 2 + 0.005, b + t, -d / 2), (w / 2 - 0.005, top - t, -d / 2 + t), 0.01, CASING),
        block((w / 2 - t, b + t, -d / 2 + 0.005), (w / 2, top - t, d / 2 - 0.005), 0.01, CASING),
        block((-w / 2, b + t, -d / 2 + 0.005), (-w / 2 + t, top - t, d / 2 - 0.005), 0.01, CASING),
    ]
    cw, cd = w * 0.62, d * 0.7
    casing.append(block((-cw / 2, top, -0.1 - cd / 2), (cw / 2, top + F_CONV_H, -0.1 + cd / 2), 0.015, CASING))
    conv_top = top + F_CONV_H
    stack = turned([(conv_top, 0.0), (conv_top, 0.45), (conv_top + 0.16, 0.34), (conv_top + 0.16, 0.28), (conv_top + 0.16 + F_STACK_H, 0.2), (conv_top + 0.16 + F_STACK_H, 0.17), (conv_top + 0.06 + F_STACK_H, 0.17), (conv_top + 0.06 + F_STACK_H, 0.0)], "y", 32, CASING)
    casing.append(xf(stack, None, (0, 0, -0.1)))

    steel = []
    # I-beam legs on base plates
    web = [(-0.06, -0.06), (0.06, -0.06), (0.06, -0.045), (0.012, -0.045), (0.012, 0.045), (0.06, 0.045), (0.06, 0.06), (-0.06, 0.06), (-0.06, 0.045), (-0.012, 0.045), (-0.012, -0.045), (-0.06, -0.045)]
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = sx * (w / 2 - 0.1), sz * (d / 2 - 0.1)
            steel.append(xf(slab(web, F_FLOOR + 0.02, b, 0.004, TRIM, plane="xz"), None, (x, 0, z)))
            steel.append(block((x - 0.11, F_FLOOR, z - 0.11), (x + 0.11, F_FLOOR + 0.025, z + 0.11), 0.006, TRIM))
    # the front frame round the cut-away, and rails at roof and floor
    for s in (-1, 1):
        x = s * (w / 2 - 0.05)
        steel.append(block((x - 0.06, b + t, d / 2 - 0.11), (x + 0.06, top - t, d / 2 + 0.01), 0.012, TRIM))
    for y in (b + t / 2, top - t / 2):
        steel.append(block((-w / 2 - 0.04, y - 0.06, d / 2), (w / 2 + 0.04, y + 0.06, d / 2 + 0.06), 0.012, TRIM))
    # stiffener channels round the side and back walls, and vertical ribs
    for y in np.linspace(b + 0.45, top - 0.45, 3):
        for s in (-1, 1):
            x = s * (w / 2 + 0.02)
            steel.append(block((x - 0.03, y - 0.04, -d / 2 - 0.02), (x + 0.03, y + 0.04, d / 2 - 0.06), 0.008, TRIM))
        steel.append(block((-w / 2 - 0.02, y - 0.04, -d / 2 - 0.05), (w / 2 + 0.02, y + 0.04, -d / 2 + 0.01), 0.008, TRIM))
    for s in (-1, 1):
        for z in (-0.35, 0.1):
            x = s * (w / 2 + 0.05)
            steel.append(block((x - 0.025, b + t, z - 0.04), (x + 0.025, top - t, z + 0.04), 0.008, TRIM))
    # sight-port bezels on the +x wall, four bolts each (the glass is three.js)
    for y in (b + 0.6, b + 1.35):
        bez = turned([(0.0, 0.06), (0.0, 0.12), (0.035, 0.115), (0.04, 0.09), (0.04, 0.06)], "z", 28, TRIM)
        bolts = [xf(turned([(0.04, 0.0), (0.04, 0.018), (0.055, 0.012), (0.06, 0.0)], "z", 10, TRIM), None, (math.cos(a) * 0.13, math.sin(a) * 0.13, 0.0)) for a in np.arange(4) * math.pi / 2 + math.pi / 4]
        steel.append(xf(merge([bez] + bolts), ry(math.pi / 2), (w / 2 + 0.06, y, -0.58)))
    # an angle flange round the convection section's foot, and the stack's bands
    steel.append(block((-cw / 2 - 0.04, top, -0.1 - cd / 2 - 0.04), (cw / 2 + 0.04, top + 0.06, -0.1 + cd / 2 + 0.04), 0.01, TRIM))
    for hh in (0.45, 1.25):
        r = 0.28 - hh / F_STACK_H * 0.08 + 0.012
        y0 = conv_top + 0.16 + hh
        steel.append(xf(turned([(y0 - 0.03, r - 0.02), (y0 - 0.03, r), (y0 + 0.03, r), (y0 + 0.03, r - 0.02)], "y", 32, TRIM), None, (0, 0, -0.1)))
    return merge(casing), merge(steel)


TANK_R, TANK_H = 0.8, 1.5


def crude_tank():
    """(shell, steelwork): a crude-oil tank, origin at its foot's centre: a
    black band of crude round the shell, wind girders, a shallow roof with a
    handrail, a caged ladder on the -x side and a manway."""
    R, H = TANK_R, TANK_H
    rows = [(0.0, 0.0), (0.0, R + 0.03), (0.06, R + 0.03), (0.06, R), (0.43, R), (0.43, R + 0.002), (0.73, R + 0.002), (0.73, R), (H, R)]
    cols = [TRIM, TRIM, TRIM, CASING, CASING, DARK * 2, DARK * 2, CASING, CASING]
    shell = turned_rows(rows, "y", 64, cols, angle=50.0)
    roof = turned([(H, R), (H + 0.04, R - 0.02), (H + 0.12, R * 0.6), (H + 0.17, 0.12), (H + 0.19, 0.1), (H + 0.19, 0.0)], "y", 64, CASING)
    steel = []
    for y in (0.35, 0.8, 1.25):
        steel.append(turned([(y - 0.02, R - 0.005), (y - 0.02, R + 0.03), (y + 0.02, R + 0.03), (y + 0.02, R - 0.005)], "y", 64, TRIM))
    # a caged ladder up the -x side to the roof
    lx = -R - 0.12
    for s in (-1, 1):
        steel.append(rod((lx, 0.06, s * 0.14), (lx, H + 0.35, s * 0.14), 0.015, TRIM, 8))
    for y in np.arange(0.2, H + 0.2, 0.2):
        steel.append(rod((lx, y, -0.14), (lx, y, 0.14), 0.01, TRIM, 6))
    for y in np.arange(0.7, H + 0.4, 0.3):
        hoop = [(lx - 0.2 * math.sin(a), y, 0.2 * math.cos(a)) for a in np.linspace(0, math.pi, 9)]
        steel.append(bar(hoop, 0.008, TRIM, sides=6, n=2))
    # a handrail round the roof's edge
    steel.append(ring((0, H + 0.3, 0), "y", R - 0.06, 0.012, TRIM, segs=64, sides=6))
    for a in np.linspace(0, 2 * math.pi, 9)[:-1]:
        c, s_ = math.cos(a) * (R - 0.06), math.sin(a) * (R - 0.06)
        steel.append(rod((c, H + 0.04, s_), (c, H + 0.3, s_), 0.01, TRIM, 6))
    # a bolted manway low on the front
    steel.append(xf(turned([(0.0, 0.0), (0.0, 0.17), (0.04, 0.17), (0.05, 0.14), (0.05, 0.0)], "z", 28, TRIM), None, (0.25, 0.25, R - 0.04)))
    return merge([shell, roof]), merge(steel)

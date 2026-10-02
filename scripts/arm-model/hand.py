"""The bones of the left hand, as a jointed skeleton.

Traced against Gray's Anatomy Figs. 219-220 (the bones of the hand, palmar
and dorsal) with standard adult lengths: an index ray of 6.8 cm metacarpal,
4.0 / 2.3 / 1.6 cm phalanges, and a carpus about 5 cm wide and 3 cm tall.

All in the FOREARM frame (elbow axis at the origin), at the rest pose: the
hand hanging straight in line with the forearm, palm forward (+X), thumb
lateral (-Z), fingers straight and a little spread.

The hand is a chain of rigid SEGMENTS: 0 is the carpus (fixed to the
forearm); then for each ray its metacarpal and phalanges. Every segment
turns about its proximal joint's pivot (the centre of the bone head it sits
on) round a flexion axis and an abduction axis given in the rest pose. Each
bone head is a surface of revolution about its flexion axis and the next
bone's base is cut to fit it, so the joint stays closed at any flexion. The
scene poses the hand (a grip round a dumbbell, a pointing index finger) by
composing those rotations, with the same numbers as `pose_matrices` here;
exporter.py writes them to arm-model-meta.js.
"""

import math

import numpy as np

import sdf
from sculpt import RadialLoft, bump, lathe, section
from sdf import capsule, cut, ellipsoid, smax, smin, sphere


def unit(v):
    v = np.asarray(v, dtype=np.float64)
    return v / np.linalg.norm(v)


def rot(axis, deg):
    """Rotation matrix about a unit axis (right-handed), degrees."""
    a = unit(axis)
    t = math.radians(deg)
    c, s = math.cos(t), math.sin(t)
    x, y, z = a
    C = 1 - c
    return np.array(
        [
            [c + x * x * C, x * y * C - z * s, x * z * C + y * s],
            [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
            [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
        ]
    )


# ─── Carpus ────────────────────────────────────────────────────────

WRIST = -2.26  # the radiocarpal joint line, forearm frame

# (name, centre, radii, rotation (x, y, z radians)). Proximal row, then
# distal row; they are trimmed against each other (see carpus_field) so
# they meet at flat joint facets with a thin gap, as real carpals do.
CARPALS = [
    ("scaphoid", (0.02, -2.35, -0.16), (0.08, 0.125, 0.075), (0.0, 0.25, 0.55)),
    ("lunate", (-0.005, -2.345, -0.035), (0.095, 0.085, 0.08), (0, 0, 0)),
    ("triquetrum", (-0.015, -2.37, 0.09), (0.075, 0.075, 0.075), (0, 0, -0.35)),
    ("pisiform", (0.08, -2.39, 0.125), (0.05, 0.055, 0.045), (0, 0, 0)),
    ("trapezium", (0.045, -2.525, -0.2), (0.085, 0.08, 0.072), (0, 0.4, 0.2)),
    ("trapezoid", (0.0, -2.53, -0.105), (0.07, 0.075, 0.06), (0, 0, 0)),
    ("capitate", (-0.01, -2.51, 0.0), (0.085, 0.12, 0.07), (0, 0, 0)),
    ("hamate", (-0.005, -2.5, 0.11), (0.08, 0.105, 0.072), (0, 0, -0.1)),
]
HAMULUS = ((0.075, -2.53, 0.13), (0.045, 0.04, 0.028))  # the hook of the hamate


# ─── Rays ──────────────────────────────────────────────────────────

# Per ray: metacarpal base centre, direction, and per bone (pivot-to-pivot
# length, half-width, palmar half-depth, dorsal half-depth). The index to
# little fingers fan a little from the carpus; the thumb leaves the
# trapezium forwards, outwards and down, turned so its nail faces laterally.
RAYS = {
    "index": dict(
        base=(0.005, -2.6, -0.115),
        dir=(0.03, -1.0, -0.07),
        bones=[("mc", 0.64, 0.045, 0.04, 0.042), ("p1", 0.38, 0.043, 0.026, 0.032), ("p2", 0.22, 0.036, 0.022, 0.026), ("p3", 0.16, 0.03, 0.018, 0.02)],
    ),
    "middle": dict(
        base=(-0.005, -2.605, -0.01),
        dir=(0.02, -1.0, -0.015),
        bones=[("mc", 0.62, 0.046, 0.04, 0.043), ("p1", 0.43, 0.045, 0.027, 0.033), ("p2", 0.27, 0.037, 0.023, 0.027), ("p3", 0.18, 0.031, 0.018, 0.02)],
    ),
    "ring": dict(
        base=(0.0, -2.59, 0.085),
        dir=(0.02, -1.0, 0.04),
        bones=[("mc", 0.55, 0.042, 0.037, 0.04), ("p1", 0.4, 0.042, 0.025, 0.031), ("p2", 0.25, 0.035, 0.021, 0.025), ("p3", 0.17, 0.029, 0.017, 0.019)],
    ),
    "little": dict(
        base=(0.01, -2.575, 0.17),
        dir=(0.04, -1.0, 0.1),
        bones=[("mc", 0.5, 0.04, 0.035, 0.038), ("p1", 0.31, 0.038, 0.023, 0.028), ("p2", 0.18, 0.031, 0.019, 0.022), ("p3", 0.15, 0.026, 0.016, 0.017)],
    ),
    "thumb": dict(
        base=(0.085, -2.57, -0.235),
        dir=(0.38, -0.82, -0.36),
        bones=[("mc", 0.42, 0.045, 0.04, 0.04), ("p1", 0.3, 0.043, 0.026, 0.03), ("p3", 0.2, 0.036, 0.021, 0.024)],
    ),
}
ORDER = ["thumb", "index", "middle", "ring", "little"]


def _ray_frames(name):
    """Rest-pose frames of one ray's bones: list of (kind, origin(pivot),
    R (columns: palmar x, proximal y, z = x cross y), L, w, dp, dd)."""
    r = RAYS[name]
    d = unit(r["dir"])
    y = -d  # local +y points back towards the base
    if name == "thumb":
        # The thumb is turned about its own axis: its pulp faces the palm
        # (medially and forwards), not straight forwards.
        palmar = unit(np.array([0.35, 0.0, 1.0]))
    else:
        palmar = np.array([1.0, 0.0, 0.0])
    x = unit(palmar - (palmar @ y) * y)
    z = np.cross(x, y)
    R = np.stack([x, y, z], axis=1)
    out = []
    p = np.asarray(r["base"], dtype=np.float64)
    for kind, L, w, dp, dd in r["bones"]:
        out.append((kind, p.copy(), R.copy(), L, w, dp, dd))
        p = p + d * L
    return out


def segments():
    """All segments: index 0 is the carpus. Returns a list of dicts with
    ray, kind, parent, pivot, R (rest), L and section sizes."""
    segs = [dict(name="carpus", ray=None, kind="carpus", parent=-1)]
    for ray in ORDER:
        parent = 0
        for kind, o, R, L, w, dp, dd in _ray_frames(ray):
            segs.append(dict(name=f"{ray}_{kind}", ray=ray, kind=kind, parent=parent, pivot=o, R=R, L=L, w=w, dp=dp, dd=dd))
            parent = len(segs) - 1
    return segs


def head_radius(seg):
    """The radius of a bone's head about its flexion axis."""
    return 0.5 * (seg["dp"] + seg["dd"]) * (1.3 if seg["kind"] == "mc" else 1.15)


# ─── One small long bone ───────────────────────────────────────────


def bone_field(seg, prev):
    """The field of one metacarpal or phalanx, in the rig (forearm frame).

    Local frame: origin at the proximal pivot, the bone running down -y to
    its head centre at y = -L, x palmar, z across. `prev` is the proximal
    segment (its head, round the origin, is what this bone's base fits)."""
    kind, L, w, dp, dd = seg["kind"], seg["L"], seg["w"], seg["dp"], seg["dd"]
    o, R = seg["pivot"], seg["R"]
    hr = head_radius(seg) if kind != "p3" else 0.0
    if kind == "mc":
        y0 = -0.005
    else:
        y0 = -(head_radius(prev) + 0.012)
    S = []

    def add(y, cx, r):
        S.append((y, cx, 0.0, r))

    if kind == "mc":
        # base: a squarish block against the carpus, flaring a little
        add(y0, 0.0, section(dp * 1.2, dd * 1.2, w * 1.25, w * 1.25, n=3.0))
        add(y0 - 0.06, 0.0, section(dp * 1.05, dd * 1.12, w * 1.12, w * 1.12, n=2.7))
        add(y0 - 0.15, -0.005, section(dp * 0.78, dd * 0.9, w * 0.85, w * 0.85, n=2.3))
        add(-L * 0.5, -0.008, bump(section(dp * 0.72, dd * 0.82, w * 0.78, w * 0.78, n=2.3), 0, 0.006, 25))
        add(-L + hr * 1.6, -0.004, section(dp * 0.82, dd * 0.88, w * 0.88, w * 0.88, n=2.3))
        add(-L + hr * 0.4, 0.0, section(dp * 1.05, dd * 1.0, w * 1.1, w * 1.1, n=2.2))
    elif kind == "p3":
        # distal phalanx: base, a slim shaft and the spade-shaped tuft
        add(y0, 0.0, section(dp * 1.2, dd * 1.3, w * 1.3, w * 1.3, n=2.5))
        add(y0 - 0.035, 0.0, section(dp * 0.95, dd * 1.05, w * 1.05, w * 1.05, n=2.4))
        add(-L * 0.55, 0.0, section(dp * 0.62, dd * 0.72, w * 0.72, w * 0.72, n=2.3))
        add(-L * 0.82, 0.0, section(dp * 0.62, dd * 0.58, w * 1.0, w * 1.0, n=2.6))
        add(-L * 0.94, 0.0, section(dp * 0.5, dd * 0.45, w * 0.8, w * 0.8, n=2.4))
        add(-L, 0.0, section(dp * 0.22, dd * 0.22, w * 0.3, w * 0.3))
    else:
        # proximal and middle phalanges: flat in front, round behind
        add(y0, 0.0, section(dp * 1.25, dd * 1.3, w * 1.45, w * 1.45, n=2.6))
        add(y0 - 0.045, 0.0, section(dp * 1.05, dd * 1.12, w * 1.2, w * 1.2, n=2.5))
        add(-L * 0.5, 0.0, section(dp * 0.85, dd * 1.0, w * 0.98, w * 0.98, n=2.8))
        add(-L + hr * 1.5, 0.0, section(dp * 0.85, dd * 0.95, w * 1.0, w * 1.0, n=2.6))
        add(-L + hr * 0.3, 0.0, section(dp * 1.05, dd * 1.0, w * 1.18, w * 1.18, n=2.4))
    loft = RadialLoft(S, harmonics=8, frame=(o, R))
    # head: a pulley about the flexion axis (bicondylar on the phalanges)
    head = None
    if kind != "p3":
        zc = o + R @ np.array([0.0, -L, 0.0])
        zax = R[:, 2]
        hw = w * 1.1
        if kind == "mc":
            prof = [(0.0, hr * 0.6), (0.15, hr * 0.92), (0.5, hr), (0.85, hr * 0.92), (1.0, hr * 0.6)]
        else:
            prof = [(0.0, hr * 0.6), (0.2, hr * 0.98), (0.5, hr * 0.86), (0.8, hr * 0.98), (1.0, hr * 0.6)]
        head = (zc, zax, hw, prof)

    lo = np.minimum(loft.wlo, (o + R @ np.array([0, -L, 0])) - hr - w) if head else loft.wlo
    hi = np.maximum(loft.whi, (o + R @ np.array([0, -L, 0])) + hr + w) if head else loft.whi

    def f(P):
        d = loft(P)
        if head is not None:
            zc, zax, hw, prof = head
            h = lathe(P, zc - zax * hw, zc + zax * hw, prof)
            d = smin(d, h, 0.02)
        if kind == "p3":
            # the tuft rounds off the tip
            tip = o + R @ np.array([0.0, -L * 0.88, 0.0])
            d = smin(d, ellipsoid(P, tuple(tip), (w * 0.75, w * 0.75, w * 0.75)), 0.015)
        if prev is not None and kind != "mc":
            # the base is cupped to the head it sits on
            d = cut(d, sphere(P, tuple(o), head_radius(prev) + 0.01), 0.008)
        if kind == "mc":
            # the base sits on the distal carpal row, with a joint gap
            d = cut(d, carpus_field(P) - GAP, 0.006)
        return sdf.roughen(d, P, 0.0008, (0.02, 0.02, 0.02), seed=7, octaves=1)

    return f, lo, hi


# ─── Carpus field ──────────────────────────────────────────────────

GAP = 0.007


def carpus_field(P):
    """The eight carpals, each trimmed to the part of space nearer itself
    than any neighbour (less half a joint gap), so neighbours meet at
    matching facets."""
    fields = [ellipsoid(P, c, r, rt) for _, c, r, rt in CARPALS]
    fields[-1] = smin(fields[-1], ellipsoid(P, *HAMULUS), 0.02)
    # the metacarpal bases sit on the distal row: trim against them too
    F = np.stack(fields)
    d = None
    for i in range(len(fields)):
        others = np.delete(F, i, axis=0).min(axis=0)
        cell = (F[i] - others) * 0.5 + GAP * 0.5
        di = smax(F[i], cell, 0.01)
        d = di if d is None else np.minimum(d, di)
    return sdf.roughen(d, P, 0.0008, (0.02, 0.02, 0.02), seed=9, octaves=1)


# ─── Posing ────────────────────────────────────────────────────────

# Joint angles, degrees: per ray (flexion at each joint in order MC, P1,
# P2, P3 for fingers, where the MC entry is the carpometacarpal joint),
# plus abduction at the first joint.
POSES = {
    "rest": {r: dict(flex=[0, 0, 0, 0], abd=0) for r in ORDER},
    # the reflex scene: index finger pointing, the others curled
    "point": {
        # opposed as in the grip, and folded over the curled middle finger
        "thumb": dict(flex=[10, 60, 35], abd=40, spin=-60),
        "index": dict(flex=[0, 4, 4, 2], abd=0),
        "middle": dict(flex=[0, 85, 100, 60], abd=0),
        "ring": dict(flex=[4, 88, 100, 55], abd=0),
        "little": dict(flex=[8, 90, 95, 50], abd=0),
    },
    # a relaxed hand, fingers a little curled
    "relaxed": {
        "thumb": dict(flex=[8, 10, 12], abd=6),
        "index": dict(flex=[0, 15, 20, 10], abd=0),
        "middle": dict(flex=[0, 20, 28, 14], abd=0),
        "ring": dict(flex=[2, 24, 32, 16], abd=0),
        "little": dict(flex=[4, 28, 34, 18], abd=0),
    },
    # round a dumbbell handle: the thumb opposed (turned 60 deg about its
    # metacarpal), over the top of the handle and down its front onto the
    # fingers, as in a power grip
    "grip": {
        "thumb": dict(flex=[10, 45, 50], abd=35, spin=-60),
        "index": dict(flex=[0, 58, 80, 38], abd=0),
        "middle": dict(flex=[0, 62, 82, 40], abd=0),
        "ring": dict(flex=[5, 66, 84, 40], abd=0),
        "little": dict(flex=[10, 70, 84, 38], abd=0),
    },
}


def joint_axes(segs, i):
    """Rest-pose flexion and abduction axes at segment i's proximal joint."""
    s = segs[i]
    R = s["R"]
    flex = R[:, 2]
    abd = R[:, 0]
    if s["ray"] == "thumb" and s["kind"] == "mc":
        # the thumb's carpometacarpal saddle: flexion swings it medially
        # across the front of the palm, (palmar) abduction lifts it forwards
        flex = np.array([-1.0, 0.0, 0.0])
        abd = np.array([0.0, 0.0, 1.0])
    return flex, abd


def spin_axis(segs, i):
    """The segment's own long axis: the thumb's metacarpal turns about it
    as it opposes (`spin` in a pose), which turns the plane its phalanges
    bend in from across the palm to round whatever the hand holds."""
    return segs[i]["R"][:, 1]


def pose_matrices(pose_name):
    """4x4 matrices (forearm frame, rest -> posed) for every segment."""
    segs = segments()
    P = POSES[pose_name]
    M = [np.eye(4) for _ in segs]
    count = {}
    for i, s in enumerate(segs):
        if i == 0:
            continue
        k = count.get(s["ray"], 0)
        count[s["ray"]] = k + 1
        spec = P[s["ray"]]
        ang = spec["flex"][k] if k < len(spec["flex"]) else 0.0
        ab = spec["abd"] if k == 0 else 0.0
        sp = spec.get("spin", 0.0) if k == 0 else 0.0
        flex, abd = joint_axes(segs, i)
        Rj = rot(flex, ang) @ rot(abd, ab) @ rot(spin_axis(segs, i), sp)
        T = np.eye(4)
        T[:3, :3] = Rj
        T[:3, 3] = s["pivot"] - Rj @ s["pivot"]
        M[i] = M[s["parent"]] @ T
    return M


def tip_of(ray, pose_name="rest", pad=0.03):
    """The pad of a fingertip (just beyond its distal phalanx), posed."""
    segs = segments()
    idx = max(i for i, s in enumerate(segs) if s["ray"] == ray)
    s = segs[idx]
    p = s["pivot"] + s["R"] @ np.array([0.012, -s["L"] - pad * 0.3, 0.0])
    M = pose_matrices(pose_name)[idx]
    return M[:3, :3] @ p + M[:3, 3]


# ─── Building ──────────────────────────────────────────────────────


def build(col, mesh_sdf, finish, voxel=0.0042):
    """One mesh object per segment (named hand_<segment>), each with a
    'seg' property; the carpus is 'hand_carpus'."""
    segs = segments()
    objs = []
    lo = np.array([-0.16, -2.72, -0.3])
    hi = np.array([0.16, -2.2, 0.26])
    o = mesh_sdf("hand_carpus", col, carpus_field, tuple(lo), tuple(hi), voxel)
    o["seg"] = 0
    objs.append(finish(o, 9000, 1))
    for i, s in enumerate(segs):
        if i == 0:
            continue
        prev = segs[s["parent"]] if s["parent"] > 0 else None
        f, blo, bhi = bone_field(s, prev)
        ob = mesh_sdf("hand_" + s["name"], col, f, tuple(blo - 0.02), tuple(bhi + 0.02), voxel)
        ob["seg"] = i
        objs.append(finish(ob, 2600 if s["kind"] == "mc" else 1600, 1))
    return objs


# ─── Soft tissue on the hand ───────────────────────────────────────


def ray_point(ray, k, frac, palmar=0.0, side=0.0):
    """A point on ray `ray`'s k-th bone (0 = metacarpal) at `frac` of its
    length, offset `palmar` towards its palm side and `side` across (+ =
    towards the little finger for the fingers), rest pose, forearm frame."""
    segs = [s for s in segments() if s["ray"] == ray]
    s = segs[k]
    R = s["R"]
    return s["pivot"] + R @ np.array([palmar, -s["L"] * frac, side])


def segment_weights(P, reach=0.16, blend=0.035):
    """Which hand segments each point (forearm frame, rest pose) follows:
    (segA, segB, wB). A point near a bone follows it; near a joint it is
    shared with the neighbour across the joint (wB rising through the
    joint); anything further than `reach` from every bone stays with the
    carpus and forearm (segment 0)."""
    segs = segments()
    P = np.asarray(P, dtype=np.float64)
    n = len(P)
    best = np.full(n, np.inf)
    seg = np.zeros(n, dtype=np.int64)
    along = np.zeros(n)
    for i, s in enumerate(segs):
        if i == 0:
            continue
        a = s["pivot"]
        b = a + s["R"] @ np.array([0.0, -s["L"], 0.0])
        ab = b - a
        tr = ((P - a) @ ab) / (ab @ ab)
        t = np.clip(tr, 0, 1)
        d = np.linalg.norm(P - (a + t[:, None] * ab), axis=1)
        m = d < best
        best[m] = d[m]
        seg[m] = i
        along[m] = tr[m] * s["L"]
    segA = np.where(best < reach, seg, 0)
    # blend across the proximal joint of the nearest segment
    parent = np.array([s["parent"] if i > 0 else 0 for i, s in enumerate(segs)])
    pa = np.where(segA > 0, parent[segA], 0)
    # weight of the distal (own) segment: 0.5 at the pivot
    wown = np.clip(along / (2 * blend) + 0.5, 0.0, 1.0)
    wown = wown * wown * (3 - 2 * wown)
    near = (segA > 0) & (wown < 1.0)
    A = np.where(near, pa, segA)
    Bs = np.where(near, segA, 0)
    wB = np.where(near, wown, 0.0)
    # fade the whole hand's influence out beyond reach
    return A, Bs, wB

"""The roller-coaster scene's car: a fibreglass four-seater with its riders,
lap bars and steel undercarriage, and the three wheels per corner that hold
a real car on its rails (see README.md).

Units are METRES, in the car's frame: x forward, y up, z across. The rails'
centres are at y = 0, z = +-HALF_GAUGE, as the scene draws them
(components/visualizations/RollerCoasterCanvas.jsx).

Smooth, moulded things (the shell, the seats, the riders, the chassis) are
signed-distance fields meshed with OpenVDB. Turned things (the wheels) are
lathes from scripts/cannon-model.
"""

import math

import numpy as np

import sdf
from cannon import crisp, lathe

# ─── The scene's numbers ────────────────────────────────────────────

HALF_GAUGE = 0.7
RAIL_R = 0.16
BOGIE_X = 0.95
FLOOR = 0.5

# ─── Wheels: running on top, upstop under, guide outside each rail ──

ROAD_R, ROAD_W = 0.17, 0.12
UP_R, UP_W = 0.11, 0.08
GUIDE_R, GUIDE_W = 0.08, 0.07
ROAD_Y = RAIL_R + ROAD_R
UP_Y = -(RAIL_R + UP_R)
UP_Z = HALF_GAUGE + 0.04
GUIDE_Z = HALF_GAUGE + RAIL_R + GUIDE_R
#: the wheel carriers' outer plates
CARRIER_Z = 1.07

AMBER = np.array([0.97, 0.6, 0.07])
WHITE = np.array([0.93, 0.93, 0.9])
TRIM = np.array([0.12, 0.12, 0.14])
UPHOLSTERY = np.array([0.1, 0.1, 0.12])
STEEL = np.array([0.32, 0.34, 0.38])
TYRE = np.array([0.55, 0.08, 0.06])
HUB = np.array([0.72, 0.74, 0.77])

#: x of each row of seats (front, rear); a rider sits just behind it
ROWS = (0.55, -0.6)
SEAT_Z = 0.33


# ─── Field helpers ──────────────────────────────────────────────────


def rbox(P, c, half, r, tilt=0.0):
    """A box rounded by r, centred on c with half-extents `half`, tipped
    back by `tilt` radians about z."""
    c = np.asarray(c, dtype=np.float64)
    h = np.asarray(half, dtype=np.float64) - r
    reach = float(np.linalg.norm(half)) + 0.02
    lo, hi = c - reach, c + reach

    def f(Q):
        q = Q - c
        if tilt:
            ct, st = math.cos(tilt), math.sin(tilt)
            q = np.stack([ct * q[:, 0] + st * q[:, 1], -st * q[:, 0] + ct * q[:, 1], q[:, 2]], axis=1)
        d = np.abs(q) - h
        return np.linalg.norm(np.maximum(d, 0), axis=1) + np.minimum(d.max(axis=1), 0) - r

    return sdf._boxed(P, lo, hi, f)


def ell(P, c, r):
    return sdf.ellipsoid(P, c, r)


def cap(P, a, b, ra, rb=None):
    return sdf.capsule(P, np.asarray(a, dtype=np.float64), np.asarray(b, dtype=np.float64), ra, ra if rb is None else rb)


def smin(a, b, k):
    return sdf.smin(a, b, k)


# ─── The shell ──────────────────────────────────────────────────────

COCKPIT = dict(c=(0.16, 1.33, 0.0), half=(1.17, 0.78, 0.74), r=0.1)


def cockpit(P):
    return rbox(P, COCKPIT["c"], COCKPIT["half"], COCKPIT["r"])


def shell_field(P):
    tub = rbox(P, (-0.13, 0.69, 0.0), (1.38, 0.3, 0.88), 0.15)
    nose = ell(P, (1.25, 0.62, 0.0), (0.88, 0.36, 0.86))
    d = smin(tub, nose, 0.1)
    # a fairing behind the rear row, rising to the riders' shoulders
    d = smin(d, ell(P, (-1.28, 0.95, 0.0), (0.32, 0.3, 0.72)), 0.1)
    # a flat underside, clear of the chassis
    d = sdf.smax(d, 0.4 - P[:, 1], 0.04)
    # the cockpit, open to the sky
    d = sdf.cut(d, cockpit(P), 0.03)
    # wheel arches over the running wheels
    for x in (-BOGIE_X, BOGIE_X):
        for s in (-1, 1):
            d = sdf.cut(d, sdf.cylinder(P, np.array([x, ROAD_Y, s * 0.55]), np.array([x, ROAD_Y, s * 1.0]), ROAD_R + 0.02), 0.02)
    # a swage line along each side
    for s in (-1, 1):
        groove = cap(P, (-1.3, 0.72, s * 0.885), (1.0, 0.72, s * 0.885), 0.018)
        d = sdf.cut(d, groove, 0.01)
    return d


def shell_bounds():
    return np.array([-1.7, 0.36, -1.0]), np.array([2.2, 1.3, 1.0])


def shell_colour(P, N):
    c = np.tile(AMBER, (len(P), 1))
    # a white band along the sides, below the swage line, sweeping up the nose
    y0 = 0.6 + 0.08 * np.clip((P[:, 0] - 0.6) / 1.2, 0, 1)
    band = sdf_smooth(y0 - 0.052, y0 - 0.042, P[:, 1]) * (1 - sdf_smooth(y0 + 0.042, y0 + 0.052, P[:, 1]))
    side = sdf_smooth(0.74, 0.8, np.abs(P[:, 2]))
    c = mix(c, WHITE, band * side)
    # dark skirt and dark cockpit lining
    c = mix(c, TRIM, 1 - sdf_smooth(0.43, 0.47, P[:, 1]))
    inside = 1 - sdf_smooth(-0.005, 0.03, cockpit(P))
    c = mix(c, TRIM * 1.3, inside)
    return c


def sdf_smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    t = np.asarray(t, dtype=np.float64)[:, None]
    return a * (1 - t) + b * t


# ─── Seats and lap bars ─────────────────────────────────────────────


def seat_field(P):
    d = np.full(len(P), 1e3)
    for rx in ROWS:
        # bench cushion, one per pair, with a raised bolster between the riders
        d = np.minimum(d, rbox(P, (rx, FLOOR + 0.08, 0.0), (0.3, 0.07, 0.72), 0.05))
        d = smin(d, rbox(P, (rx - 0.02, FLOOR + 0.17, 0.0), (0.24, 0.05, 0.04), 0.035), 0.03)
        # backrest, tipped back, and a headrest for each rider
        d = smin(d, rbox(P, (rx - 0.36, FLOOR + 0.46, 0.0), (0.06, 0.38, 0.72), 0.05, tilt=0.14), 0.03)
        for z in (-SEAT_Z, SEAT_Z):
            d = smin(d, rbox(P, (rx - 0.48, FLOOR + 0.97, z), (0.07, 0.13, 0.17), 0.06, tilt=0.14), 0.03)
    return d


def seat_bounds():
    return np.array([-1.25, 0.45, -0.8]), np.array([0.95, 1.65, 0.8])


def lap_bars():
    """(V, F) sweeps: a padded bar across each row on a post from the floor."""
    import plantlib as pl

    out = []
    for rx in ROWS:
        x = rx + 0.38
        bar = np.array([[x, FLOOR + 0.42, z] for z in np.linspace(-0.66, 0.66, 24)])
        V, F, _, _ = pl.sweep(bar, 0.05, sides=16)
        out.append(("pad", V, pl.quads_to_tris(F)))
        for z in (-0.66, 0.66):
            post = np.array([[x + 0.03, FLOOR - 0.02, z], [x + 0.01, FLOOR + 0.2, z], [x, FLOOR + 0.42, z]])
            V, F, _, _ = pl.sweep(pl.catmull(post, 6), 0.028, sides=12)
            out.append(("steel", V, pl.quads_to_tris(F)))
    return out


# ─── Riders ─────────────────────────────────────────────────────────

SKINS = [(0.94, 0.76, 0.6), (0.55, 0.36, 0.24), (0.86, 0.64, 0.46), (0.36, 0.23, 0.16)]
SHIRTS = [(0.15, 0.39, 0.92), (0.86, 0.15, 0.15), (0.09, 0.64, 0.29), (0.58, 0.2, 0.92)]
HAIRS = [(0.25, 0.16, 0.09), (0.05, 0.04, 0.04), (0.55, 0.35, 0.15), (0.08, 0.06, 0.05)]
TROUSERS = (0.12, 0.2, 0.42)
SHOES = (0.92, 0.92, 0.9)

#: which riders have their arms up (front left, front right, rear left, rear right)
ARMS_UP = (True, False, False, True)


def _riders():
    """Each rider's parts as (kind, rider, field)."""
    parts = []
    k = 0
    for rx in ROWS:
        for z0 in (-SEAT_Z, SEAT_Z):
            up = ARMS_UP[k]
            sz = 1 if z0 > 0 else -1
            hx = rx - 0.12
            parts.append(("shirt", k, lambda P, hx=hx, z0=z0: ell(P, (hx - 0.02, FLOOR + 0.33, z0), (0.13, 0.2, 0.16))))
            parts.append(("shirt", k, lambda P, hx=hx, z0=z0: ell(P, (hx - 0.08, FLOOR + 0.55, z0), (0.13, 0.2, 0.19))))
            parts.append(("skin", k, lambda P, hx=hx, z0=z0: cap(P, (hx - 0.1, FLOOR + 0.7, z0), (hx - 0.11, FLOOR + 0.8, z0), 0.048)))
            parts.append(("skin", k, lambda P, hx=hx, z0=z0: ell(P, (hx - 0.11, FLOOR + 0.9, z0), (0.1, 0.12, 0.09))))
            parts.append(("hair", k, lambda P, hx=hx, z0=z0: ell(P, (hx - 0.13, FLOOR + 0.93, z0), (0.1, 0.105, 0.095))))
            for s in (-1, 1):
                zl = z0 + s * 0.095
                knee = (rx + 0.36, FLOOR + 0.3, zl)
                ankle = (rx + 0.5, FLOOR + 0.1, zl)
                parts.append(("legs", k, lambda P, hx=hx, zl=zl, knee=knee: cap(P, (hx + 0.02, FLOOR + 0.2, zl), knee, 0.085, 0.065)))
                parts.append(("legs", k, lambda P, knee=knee, ankle=ankle: cap(P, knee, ankle, 0.06, 0.045)))
                parts.append(("shoes", k, lambda P, ankle=ankle, rx=rx, zl=zl: cap(P, ankle, (rx + 0.64, FLOOR + 0.09, zl), 0.048, 0.042)))
                sh = (hx - 0.09, FLOOR + 0.64, z0 + s * 0.19)
                # out-board arm up for a rider who has both up, else both on the bar
                if up:
                    elbow = (hx - 0.05, FLOOR + 0.92, z0 + s * 0.3)
                    hand = (hx + 0.02, FLOOR + 1.2, z0 + s * 0.3)
                else:
                    elbow = (hx + 0.12, FLOOR + 0.42, z0 + s * 0.24)
                    hand = (rx + 0.36, FLOOR + 0.42, z0 + s * 0.2)
                parts.append(("shirt", k, lambda P, sh=sh, elbow=elbow: cap(P, sh, elbow, 0.055, 0.048)))
                parts.append(("skin", k, lambda P, elbow=elbow, hand=hand: cap(P, elbow, hand, 0.045, 0.038)))
                parts.append(("skin", k, lambda P, hand=hand: sdf.sphere(P, np.asarray(hand), 0.047)))
            k += 1
    return parts


def rider_field(P):
    d = np.full(len(P), 1e3)
    for kind, _, f in _riders():
        d = smin(d, f(P), 0.035 if kind in ("shirt", "skin") else 0.02)
    return d


def rider_bounds():
    return np.array([-1.0, 0.5, -0.75]), np.array([1.3, 1.85, 0.75])


def rider_colour(P, N):
    parts = _riders()
    D = np.stack([f(P) for _, _, f in parts], axis=1)
    # soft nearest-part weights, so a colour edge stays clean after decimation
    W = np.exp(-(D - D.min(axis=1, keepdims=True)) / 0.006)
    W /= W.sum(axis=1, keepdims=True)
    C = np.zeros((len(P), 3))
    for j, (kind, k, _) in enumerate(parts):
        col = {"shirt": SHIRTS[k], "skin": SKINS[k], "hair": HAIRS[k], "legs": TROUSERS, "shoes": SHOES}[kind]
        C += W[:, j : j + 1] * np.asarray(col)
    return C


# ─── Chassis and wheel carriers ─────────────────────────────────────


def chassis_field(P):
    # spine under the floor, and a cross-member over each bogie
    d = rbox(P, (0.05, 0.36, 0.0), (1.6, 0.06, 0.24), 0.03)
    for x in (-BOGIE_X, BOGIE_X):
        d = smin(d, rbox(P, (x, 0.39, 0.0), (0.09, 0.06, CARRIER_Z), 0.03), 0.04)
        for s in (-1, 1):
            # the carrier: a plate outside the rail, from the cross-member down
            # past the rail, with an arm in under it for the upstop wheel
            d = smin(d, rbox(P, (x, 0.04, s * CARRIER_Z), (0.13, 0.4, 0.03), 0.02), 0.03)
            d = smin(d, rbox(P, (x, UP_Y, s * (UP_Z + 0.06 + CARRIER_Z) / 2), (0.07, 0.05, (CARRIER_Z - UP_Z - 0.06) / 2), 0.02), 0.03)
            # stub axles to the running and upstop wheels, a pin for the guide
            d = np.minimum(d, sdf.cylinder(P, np.array([x, ROAD_Y, s * (HALF_GAUGE + 0.05)]), np.array([x, ROAD_Y, s * CARRIER_Z]), 0.04))
            d = np.minimum(d, sdf.cylinder(P, np.array([x, UP_Y, s * (UP_Z + 0.03)]), np.array([x, UP_Y, s * (UP_Z + 0.12)]), 0.03))
            # the guide wheel's fork: an arm over it and a pin down through it
            d = smin(d, rbox(P, (x, GUIDE_W / 2 + 0.03, s * (GUIDE_Z + CARRIER_Z) / 2), (0.05, 0.02, (CARRIER_Z - GUIDE_Z) / 2 + 0.01), 0.012), 0.02)
            d = np.minimum(d, sdf.cylinder(P, np.array([x, -GUIDE_W / 2 - 0.015, s * GUIDE_Z]), np.array([x, GUIDE_W / 2 + 0.03, s * GUIDE_Z]), 0.014))
    # couplings: a tow bar behind, a bumper in front
    d = np.minimum(d, sdf.cylinder(P, np.array([-1.55, 0.36, 0.0]), np.array([-1.85, 0.36, 0.0]), 0.05))
    d = smin(d, sdf.sphere(P, np.array([-1.86, 0.36, 0.0]), 0.07), 0.02)
    return d


def chassis_bounds():
    return np.array([-2.0, -0.45, -1.15]), np.array([1.75, 0.5, 1.15])


# ─── Wheels, each in its own frame ──────────────────────────────────


def wheel(radius, width, axis):
    """A polyurethane tyre on an aluminium hub, centred on the origin and
    turning about `axis`. Returns V, F, colours."""
    w = width / 2
    prof = [
        (-w * 0.55, 0.0),
        (-w * 0.55, radius * 0.3),
        (-w * 0.9, radius * 0.36),
        (-w * 0.9, radius * 0.62),
        (-w, radius * 0.66),
        (-w, radius - 0.018),
        (-w + 0.012, radius),
        (w - 0.012, radius),
        (w, radius - 0.018),
        (w, radius * 0.66),
        (w * 0.9, radius * 0.62),
        (w * 0.9, radius * 0.36),
        (w * 0.55, radius * 0.3),
        (w * 0.55, 0.0),
    ]
    V, F, row = lathe(prof, axis, 40)
    V, F, row = crisp(V, F, 40.0, row.astype(np.float64))
    row = np.rint(row).astype(int)
    C = np.tile(HUB, (len(V), 1))
    C[(row >= 4) & (row <= 9)] = TYRE
    return V, F, C


def wheel_positions():
    """Where each kind of wheel sits on the car, and its axis."""
    road, up, guide = [], [], []
    for x in (-BOGIE_X, BOGIE_X):
        for s in (-1, 1):
            road.append([x, ROAD_Y, s * HALF_GAUGE])
            up.append([x, UP_Y, s * UP_Z])
            guide.append([x, 0.0, s * GUIDE_Z])
    return {"road": road, "up": up, "guide": guide}


def anchors():
    return {
        "units": "metres",
        "floor": FLOOR,
        "rows": list(ROWS),
        "seatZ": SEAT_Z,
        "wheels": {
            "road": {"r": ROAD_R, "at": wheel_positions()["road"]},
            "up": {"r": UP_R, "at": wheel_positions()["up"]},
            "guide": {"r": GUIDE_R, "at": wheel_positions()["guide"]},
        },
        # the front-right rider's eyes (the one holding the bar): the ride
        # camera looks out from inside his head, whose faces it does not see
        "eye": [round(ROWS[0] - 0.15, 3), round(FLOOR + 0.92, 3), SEAT_Z],
    }

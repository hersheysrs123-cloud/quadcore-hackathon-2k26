"""Anatomical landmarks and helpers for authoring the soft tissue.

Everything is in the SHOULDER frame at the rest pose (arm hanging, elbow
straight, palm forward): decimetres, humeral head centre at the origin, +X
anterior, -Y down, +Z medial. `F(x, y, z)` converts a forearm-frame point
(elbow axis at the origin) into it. `hum`, `uln` and `rad` find points on
the bones' own surfaces, so origins and insertions sit exactly on bone.
"""

import math

import numpy as np

import skeleton
from sculpt import RadialLoft
from skeleton import H


def F(x, y, z):
    """A forearm-frame point in the shoulder frame (rest pose)."""
    return (x, y - H, z)


def unit(v):
    v = np.asarray(v, dtype=np.float64)
    return tuple(v / np.linalg.norm(v))


def radial(ang):
    """The outward direction at `ang` degrees round a vertical axis (0
    anterior, 90 medial, 180 posterior, 270 lateral)."""
    a = math.radians(ang)
    return (math.cos(a), 0.0, math.sin(a))


def add(p, d):
    return tuple(a + b for a, b in zip(p, d))


def bone_field(P):
    """All the bones at the rest pose, shoulder frame."""
    P = np.atleast_2d(np.asarray(P, dtype=np.float64))
    fa = np.array([0.0, -H, 0.0])
    d = np.minimum(skeleton.humerus_field(P), skeleton.girdle_field(P))
    d = np.minimum(d, skeleton.ulna_field(P - fa))
    d = np.minimum(d, skeleton.radius_field(P - fa))
    return d


def bone_depth(p, out, max_d=0.45, step=0.005):
    """How far in from p (along -out) the nearest bone surface lies."""
    o = np.asarray(unit(out))
    ts = np.arange(0.0, max_d, step)
    pts = np.asarray(p, dtype=np.float64)[None, :] - ts[:, None] * o[None, :]
    import sdf

    saved = sdf.MARGIN
    sdf.MARGIN = 0.2
    try:
        d = bone_field(pts)
    finally:
        sdf.MARGIN = saved
    hit = np.nonzero(d < 0)[0]
    return float(ts[hit[0]]) if len(hit) else max_d


def S(p, w, t, ti=None, out=None, tend=None, h=None, f=None, shift=None):
    """One station of a Sweep (see sculpt.Sweep). ti="bone" sinks the
    underside onto the skeleton beneath (it is trimmed back to the bone's
    surface when packed), so a deep muscle rests on bone with no gap."""
    d = dict(p=tuple(float(v) for v in p), w=w, t=t)
    if ti == "bone":
        # sink onto the bone beneath; if there is none within reach (the ray
        # passes beside it) keep a plain belly rather than a sliver
        depth = bone_depth(p, out if out is not None else _LAST_OUT[0], max_d=0.22)
        ti = depth + 0.03 if depth < 0.22 else t * 0.85
    if out is not None:
        _LAST_OUT[0] = out
    if ti is not None:
        d["ti"] = ti
    if out is not None:
        d["out"] = unit(out)
    if tend is not None:
        d["tend"] = tend
    if h is not None:
        d["h"] = h
    if f is not None:
        d["f"] = f
    if shift is not None:
        d["shift"] = shift
    return d


_LAST_OUT = [(1.0, 0.0, 0.0)]


def _humerus_loft():
    if skeleton.HUMERUS_SHAFT is None:
        skeleton.HUMERUS_SHAFT = RadialLoft(skeleton._humerus_sections(), harmonics=10)
    return skeleton.HUMERUS_SHAFT


def _forearm_loft(name):
    if name == "ulna":
        if skeleton._ULNA is None:
            skeleton._ULNA = RadialLoft(skeleton._ulna_sections(), harmonics=10)
        return skeleton._ULNA
    if skeleton._RADIUS is None:
        skeleton._RADIUS = RadialLoft(skeleton._radius_sections(), harmonics=10)
    return skeleton._RADIUS


def _on(loft, y, ang, off):
    cx, cz = loft.centre_at(y)
    r = float(loft.radius_at(y, ang)[0]) + off
    a = math.radians(ang)
    return float(cx[0]) + r * math.cos(a), float(cz[0]) + r * math.sin(a)


def hum(y, ang, off=0.0):
    """A point on the humeral shaft at height y, `ang` degrees round it,
    pushed out by `off`."""
    x, z = _on(_humerus_loft(), y, ang, off)
    return (x, y, z)


def hum_c(y, dx=0.0, dz=0.0):
    """The humeral shaft's centre at height y (offset by dx, dz): the path of
    a muscle that wraps the shaft and is carved to it (spec `carve`)."""
    cx, cz = _humerus_loft().centre_at(y)
    return (float(cx[0]) + dx, y, float(cz[0]) + dz)


def uln(yf, ang, off=0.0):
    """A point on the ulna at forearm-frame height yf (shoulder frame)."""
    x, z = _on(_forearm_loft("ulna"), yf, ang, off)
    return F(x, yf, z)


def rad(yf, ang, off=0.0):
    """A point on the radius at forearm-frame height yf (shoulder frame)."""
    x, z = _on(_forearm_loft("radius"), yf, ang, off)
    return F(x, yf, z)


# Landmarks
GLEN = tuple(skeleton.GLENOID)
SUPRAGLENOID = add(GLEN, (0.01, 0.17, -0.01))
INFRAGLENOID = add(GLEN, (-0.02, -0.2, 0.0))
CORACOID_TIP = (0.32, 0.06, 0.18)
MED_EPI = (-0.03, -2.85, 0.35)  # the front of the medial epicondyle
LAT_EPI = (-0.03, -2.86, -0.25)
OLECRANON = F(-0.2, 0.17, 0.12)
RADIAL_TUB = F(0.075, -0.4, -0.07)
S3 = skeleton.S3
BN = tuple(skeleton.BLADE_N)
BNi = tuple(-skeleton.BLADE_N)

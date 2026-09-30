"""The muscles and tendons of the left upper limb.

Each muscle is one or more Sweeps (sculpt.py): a band along its path whose
section is sized, level by level, from Gray's Anatomy (Figs. 409-424: the
muscles of the shoulder, arm, forearm and hand, and the cross-sections
through the middle of the arm and the forearm) and standard adult girths.
A muscle lies on the layer beneath it (bone, or a deeper muscle), so its
inner half-thickness is usually the smaller; where muscles meet, their
rounded edges leave the shallow grooves an ecorche shows.

All authored in the SHOULDER frame at the rest pose (arm hanging straight,
elbow straight, palm forward): decimetres, humeral head centre at the
origin, +X anterior, -Y down, +Z medial. `F(x, y, z)` converts a point
given in the forearm frame (elbow axis at the origin) into that space.

Per station a muscle carries:
  tend  0 red muscle .. 1 white tendon, so one mesh can be a whole
        muscle-tendon unit with a real musculotendinous junction
  h, f  how far it turns with the humerus and with the forearm; the
        scene's vertex shader bends each vertex by those shares of the
        shoulder and elbow angles, so a tendon crossing a joint bends round
        it while the belly it comes from stays put
Muscles ending in the hand also follow the finger segments (hand.py).
"""

import numpy as np

import skeleton
from anat import H  # noqa: F401  (re-exported for callers)
from muscle_specs import specs
from sculpt import Pillow, Sweep

# ─── Building ──────────────────────────────────────────────────────

import bpy  # noqa: E402

import sdf  # noqa: E402
from armlib import decimate, shade_smooth, smooth, tri_count  # noqa: E402
from sdf import mesh_sdf, smin  # noqa: E402


def field_of(sweeps, blend):
    def f(P):
        d = None
        for sw in sweeps:
            e = sw(P)
            d = e if d is None else (smin(d, e, blend) if blend > 0 else np.minimum(d, e))
        return d

    return f


def _rig_points(obj):
    me = obj.data
    co = np.empty(len(me.vertices) * 3, dtype=np.float64)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    return np.stack([co[:, 0], co[:, 2], -co[:, 1]], axis=1)


def _to_blender(P):
    return np.stack([P[:, 0], -P[:, 2], P[:, 1]], axis=1)


def _write(me, name, values, kind="FLOAT"):
    attr = me.attributes.get(name)
    if attr is None:
        attr = me.attributes.new(name, kind, "POINT")
    key = "vector" if kind == "FLOAT_VECTOR" else "value"
    attr.data.foreach_set(key, np.asarray(values, dtype=np.float32).ravel())


HEAD_BLEND = 0.015  # dm: how softly per-vertex data passes from head to head


def head_weights(P, sweeps):
    """A soft partition of the vertices among the heads, by how near each
    head's surface is. Taking a vertex's data from its nearest head alone
    would jump where two heads merge, and a jump in the bend weights or a
    morph tears the mesh there when it moves."""
    saved = sdf.MARGIN
    sdf.MARGIN = 0.5
    try:
        D = np.stack([sw(P) for sw in sweeps])
    finally:
        sdf.MARGIN = saved
    W = np.exp(-(D - D.min(axis=0)) / HEAD_BLEND)
    return W / W.sum(axis=0), D.argmin(axis=0)


def vertex_attributes(obj, sweeps):
    """Per vertex, blended over the heads (head_weights). Also returns each
    head's own attributes, which the morphs are built from."""
    P = _rig_points(obj)
    W, which = head_weights(P, sweeps)
    per = [sw.attributes(P) for sw in sweeps]
    out = {"head": which, "W": W, "per": per}
    for key in ("s", "tend", "h", "f"):
        out[key] = sum(W[k] * a[key] for k, a in enumerate(per))
    for key in ("fib", "N", "C"):
        out[key] = sum(W[k][:, None] * a[key] for k, a in enumerate(per))
    for key in ("fib", "N"):
        out[key] /= np.maximum(np.linalg.norm(out[key], axis=1, keepdims=True), 1e-9)
    return P, out


def add_morph(obj, spec, sweeps, P, A):
    """Shape keys for the two muscles the scenes animate most.

    contract: the belly draws up towards its origin and fattens (shorter
      and thicker at about the same volume); tendons do not change.
    stretch:  the belly slides towards its insertion and thins, as the
      triceps is drawn out over the flexed elbow."""
    kind = spec.get("morph")
    if not kind:
        return
    # each head's own displacement, blended by the same soft partition as
    # the rest of the vertex data, so the morph cannot tear the mesh where
    # the heads merge
    delta = np.zeros_like(P)
    for k, a in enumerate(A["per"]):
        s = np.clip(a["s"], 0, 1)
        belly = 1.0 - A["tend"]
        radial = P - a["C"]
        r_n = np.linalg.norm(radial, axis=1) + 1e-9
        front = np.clip(radial[:, 0] / r_n, 0, 1)
        length = sweeps[k].length
        if kind == "contract":
            swell = 0.3 * np.sin(np.pi * s) ** 1.3 * belly * (1 + 0.35 * front)
            # the belly gathers towards its origin a little; it does not
            # retract off its tendon, which would be left as a bare string
            shift = -0.06 * length * _smooth(0.1, 0.95, s) * belly
        else:
            swell = -0.12 * np.sin(np.pi * s) * belly
            shift = 0.1 * length * _smooth(0.05, 0.9, s) * np.maximum(belly, 0.3)
        delta += A["W"][k][:, None] * (radial * swell[:, None] + a["fib"] * shift[:, None])
    if spec.get("carve"):
        # the face lying on the bone stays on it
        delta *= _smooth(0.0, 0.05, bone_grid(spec["carve"])(P))[:, None]
    new = P + delta
    obj.shape_key_add(name="Basis", from_mix=False)
    key = obj.shape_key_add(name=kind, from_mix=False)
    key.data.foreach_set("co", _to_blender(new).astype(np.float32).ravel())
    # at rest in the file (the scenes drive it)
    key.value = 0.0


MUSCLE_RGB = np.array([0.52, 0.1, 0.12])
TENDON_RGB = np.array([0.86, 0.85, 0.8])
BONE_RGB = np.array([0.85, 0.8, 0.68])


def preview_colour(obj, tend, shade=None, rgb=None):
    """A colour attribute for Workbench previews (the scene shades its own)."""
    me = obj.data
    n = len(me.vertices)
    if rgb is None:
        k = 0.85 + 0.3 * (np.asarray(shade) - 0.5) if shade is not None else 1.0
        c = MUSCLE_RGB[None, :] * np.asarray(k).reshape(-1, 1) * (1 - tend[:, None]) + TENDON_RGB[None, :] * tend[:, None]
    else:
        c = np.tile(np.asarray(rgb), (n, 1))
    rgba = np.concatenate([c, np.ones((n, 1))], axis=1)
    attr = me.color_attributes.get("Col") or me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    attr.data.foreach_set("color", rgba.astype(np.float32).ravel())
    me.color_attributes.active_color = attr


def _smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def _smin_var(a, b, k):
    """sdf.smin with a blend width that varies per point."""
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b * (1 - h) + a * h - k * h * (1 - h)


GROOVE = 0.008  # the fascial seam between neighbouring muscles, dm
SEAM = 0.02  # how rounded a muscle's edge is where it meets a neighbour
# How wide a gap between neighbours the packing fills (a blend of width k
# closes gaps up to about k/2): wide over the fleshy upper forearm, where
# the bellies fill the limb, narrowing to the wrist, where the tendons
# run apart.
HULL = 0.2
HULL_EDGE = 0.03
HULL_TO_WRIST = (-3.9, -4.8)  # heights (shoulder frame) of the taper
# ... and narrow at the epicondyles too, where the bellies spring from one
# common tendon rather than swelling into a cap round it
HULL_TO_ELBOW = (-3.35, -3.0)
# Tendons take no part in the packing: a cord would otherwise claim a
# belly's share of the limb and show as a broad white sheet. Along a
# muscle's path, the part past the musculotendinous junction is pushed out
# of the hull (and the belly out of the part kept as a plain cord).
TENDON_OUT = 0.15


def _hull_width(y):
    wrist = _smooth(HULL_TO_WRIST[1], HULL_TO_WRIST[0], y)
    elbow = 1.0 - _smooth(HULL_TO_ELBOW[0], HULL_TO_ELBOW[1], y)
    return HULL_EDGE + (HULL - HULL_EDGE) * wrist * elbow


def _field_tend(sweeps, blend):
    def f(P):
        d = t = None
        for sw in sweeps:
            e, te = sw.field_tend(P)
            if d is None:
                d, t = e, te
                continue
            t = np.where(e < d, te, t)
            d = smin(d, e, blend) if blend > 0 else np.minimum(d, e)
        return d, t

    return f
BONE_GAP = 0.004
RAW_VOXEL = 0.014
N_DEFAULT = 2.3

# Caches that survive a module reload while iterating in one Blender
# session (the bones rarely change; a muscle's grid is keyed by its spec).
import builtins  # noqa: E402

if not hasattr(builtins, "_ARM_CACHE"):
    builtins._ARM_CACHE = {"raw": {}, "bones": {}}
_RAW = builtins._ARM_CACHE["raw"]
_BONES = builtins._ARM_CACHE["bones"]


def clear_caches(bones=True):
    _RAW.clear()
    if bones:
        _BONES.clear()


def _overlap(lo1, hi1, lo2, hi2):
    return bool(np.all(lo1 <= hi2) and np.all(lo2 <= hi1))


def _box(sweeps, pad=0.0):
    return np.min([sw.lo for sw in sweeps], axis=0) - pad, np.max([sw.hi for sw in sweeps], axis=0) + pad


def sweeps_of(name, spec):
    """A muscle's heads: Sweeps (a list of stations) or Pillows (a dict of
    Pillow arguments, for a flat muscle filling a fossa)."""
    n = spec.get("n", N_DEFAULT if spec.get("tissue", "muscle") == "muscle" else 2.0)
    out = []
    for i, head in enumerate(spec["heads"]):
        if isinstance(head, dict):
            out.append(Pillow(name=f"{name}_{i}", **head))
        else:
            out.append(Sweep(head, name=f"{name}_{i}", n=n))
    return out


def raw_grid(name, spec):
    """A muscle's own field, cached on a coarse band grid for its neighbours."""
    key = (name, repr(spec))
    g = _RAW.get(name)
    if g is None or g[0] != key:
        sw = sweeps_of(name, spec)
        lo, hi = _box(sw, 0.06)
        g = (key, sdf.GridField(field_of(sw, spec.get("blend", 0.0)), lo, hi, RAW_VOXEL), lo, hi)
        _RAW[name] = g
    return g[1], g[2], g[3]


BONE_BOXES = {
    "humerus": ((-0.3, -3.2, -0.4), (0.3, 0.3, 0.45)),
    "forearm": ((-0.3, -5.45, -0.36), (0.25, -2.7, 0.33)),
    "girdle": ((-0.85, -1.35, -0.3), (0.45, 0.5, 1.15)),
    "hand": ((-0.2, -7.1, -0.45), (0.45, -5.15, 0.35)),
}


def _hand_bones_field():
    import hand as hm

    segs = hm.segments()
    parts = [hm.carpus_field]
    for i, sg in enumerate(segs):
        if i == 0:
            continue
        prev = segs[sg["parent"]] if sg["parent"] > 0 else None
        parts.append(hm.bone_field(sg, prev)[0])
    fa = np.array([0.0, -H, 0.0])

    def f(P):
        Q = P - fa
        d = None
        for g in parts:
            e = g(Q)
            d = e if d is None else np.minimum(d, e)
        return d

    return f


def bone_grid(name):
    if name not in _BONES:
        fa = np.array([0.0, -H, 0.0])
        if name == "humerus":
            f = skeleton.humerus_field
        elif name == "forearm":
            f = lambda P: np.minimum(skeleton.ulna_field(P - fa), skeleton.radius_field(P - fa))
        elif name == "hand":
            f = _hand_bones_field()
        else:
            f = skeleton.girdle_field
        lo, hi = BONE_BOXES[name]
        _BONES[name] = sdf.GridField(f, lo, hi, 0.006 if name == "hand" else 0.01, outside=0.3)
    return _BONES[name]


def packed_field(name, spec, all_specs):
    """The muscle as it sits in the limb.

    By default each muscle is a smooth body of its own; sized to lie on the
    layer beneath and against its neighbours, they meet in clean creases, as
    the separate forms of a sculpted ecorche do.

    Muscles marked `pack` (the crowded forearm) are packed instead: the
    muscles of their group join in a hull that fills the narrow gaps between
    them (HULL wide), and each keeps the part of the hull nearer its own
    inside than any neighbour's, with a fascial seam between, so they fill
    the limb and still show each belly."""
    sweeps = sweeps_of(name, spec)
    lo, hi = _box(sweeps)
    if spec.get("tissue", "muscle") != "muscle" or not spec.get("pack"):
        return field_of(sweeps, spec.get("blend", 0.0)), sweeps, lo, hi
    own = _field_tend(sweeps, spec.get("blend", 0.0))
    group = spec["pack"]
    peers = []
    for other, osp in all_specs.items():
        if other == name or osp.get("pack") != group:
            continue
        osw = sweeps_of(other, osp)
        olo, ohi = _box(osw)
        if _overlap(lo - HULL, hi + HULL, olo, ohi):
            peers.append(_field_tend(osw, osp.get("blend", 0.0)))
    belly = lambda d, t: d + TENDON_OUT * _smooth(0.6, 0.95, t)

    def f(P):
        d, t = own(P)
        cord = d + TENDON_OUT * (1.0 - _smooth(0.3, 0.6, t))
        db = belly(d, t)
        if not peers:
            return np.minimum(db, cord)
        k = _hull_width(P[:, 1])
        others = None
        hull = db
        for g in peers:
            o = belly(*g(P))
            others = o if others is None else np.minimum(others, o)
            hull = _smin_var(hull, o, k)
        cell = (db - others) * 0.5 + GROOVE * 0.5
        packed = sdf.smax(hull, cell, SEAM)
        # Where the bellies converge on their common origin at an
        # epicondyle, cutting each to its share leaves flat-topped stumps.
        # There each keeps its own shape and they overlap, as they do in
        # their common tendon. (Relaxing the cut instead gives every muscle
        # the same shared hull there, and identical surfaces z-fight.)
        e = _smooth(HULL_TO_ELBOW[0], HULL_TO_ELBOW[1], P[:, 1])
        return np.minimum(packed * (1.0 - e) + db * e, cord)

    return f, sweeps, lo, hi


def build_one(col, name, spec, all_specs=None):
    all_specs = all_specs or {}
    field, sweeps, lo, hi = packed_field(name, spec, all_specs)
    if spec.get("carve"):
        # a muscle wrapping a shaft: the bone is carved out of it, so it
        # lies on the bone all the way round instead of bridging over it
        bone = bone_grid(spec["carve"])
        wrapped = field
        field = lambda P: sdf.smax(wrapped(P), BONE_GAP - bone(P), 0.01)
    # a packed muscle can grow into the gaps beside it (up to half of one)
    pad = 0.03 + (HULL * 0.4 if spec.get("pack") else 0.0)
    lo = lo - pad
    hi = hi + pad
    tissue = spec.get("tissue", "muscle")

    def surfaced(Pq):
        # The band estimates are not true distances (they run long near thin
        # edges), and the mesher only samples finely where the coarse pass
        # says the surface is near; scaling the field down keeps that pass
        # conservative without moving the surface.
        d = field(Pq) * 0.6
        # a faint organic unevenness (fascicle relief is drawn in the shader)
        return sdf.roughen(d, Pq, 0.0009 if tissue == "muscle" else 0.0004, (0.03, 0.03, 0.03), seed=len(name), octaves=2)

    obj = mesh_sdf(name, col, surfaced, tuple(lo), tuple(hi), spec.get("voxel", 0.009))
    smooth(obj, iters=1, factor=0.4)
    n = tri_count(obj)
    if n > spec.get("tris", 3000):
        decimate(obj, spec["tris"] / n)
    shade_smooth(obj)
    P, A = vertex_attributes(obj, sweeps)
    for pname in spec.get("paint", ()):
        # an aponeurosis on the muscle's surface: the muscle is white over
        # the sheet's footprint (wherever the surface lies within reach of
        # it), with a clean edge, not wherever it happens to cut the sheet
        for sw in sweeps_of(pname, all_specs[pname]):
            q, depth = sw.footprint(P)
            on = (1.0 - _smooth(0.7, 1.0, q)) * (1.0 - _smooth(0.06, 0.1, np.abs(depth)))
            A["tend"] = np.maximum(A["tend"], on)
    me = obj.data
    _write(me, "_humerus", A["h"])
    _write(me, "_forearm", A["f"])
    tend = A["tend"] if tissue == "muscle" else np.ones(len(P))
    _write(me, "_tendon", tend)
    _write(me, "_fibre", A["fib"], "FLOAT_VECTOR")
    shade = spec.get("shade", 0.5) + 0.12 * sdf.value_noise(P, (0.06, 0.25, 0.06), seed=len(name))
    _write(me, "_shade", np.clip(shade, 0, 1))
    add_morph(obj, spec, sweeps, P, A)
    preview_colour(obj, tend, shade)
    obj["tissue"] = tissue
    obj["frame"] = "shoulder"
    obj["part"] = name
    obj["hand"] = bool(spec.get("hand", False))
    return obj


def build(col, only=None):
    out = {}
    saved = sdf.MARGIN
    sdf.MARGIN = 0.2
    try:
        all_specs = specs()
        for name, spec in all_specs.items():
            if (only and name not in only) or spec.get("paint_only"):
                continue
            for old in [o for o in col.objects if o.get("part") == name]:
                me = old.data
                bpy.data.objects.remove(old, do_unlink=True)
                if me.users == 0:
                    bpy.data.meshes.remove(me)
            obj = build_one(col, name, spec, all_specs)
            out[obj.name] = tri_count(obj)
    finally:
        sdf.MARGIN = saved
    return out

"""Build the arm in Blender and export public/models/arm.glb.

Everything here is our own geometry: bones modelled from cross-sections
traced off Gray's Anatomy plates (skeleton.py, hand.py), muscles and
tendons swept along their paths (muscle_specs.py, soft.py), all meshed with
the OpenVDB that ships with Blender. No scanned or third-party mesh is used.

Run inside Blender (5.x), from its Python console or the Blender MCP:

    import sys; sys.path.insert(0, r"<repo>/scripts/arm-model")
    import build_arm; build_arm.build_all(r"<repo>")

or headless:

    blender --background --python-expr "import sys; sys.path.insert(0, r'<repo>/scripts/arm-model'); import build_arm; build_arm.build_all(r'<repo>')"

A full build takes a few minutes. Each step can also be run on its own
(`build_bones`, `soft.build(col, only=[...])`, `export`), which is how the
model was iterated on with preview.py renders.
"""

import importlib

import numpy as np

import anat
import armlib
import hand
import muscle_specs
import preview
import sculpt
import sdf
import skeleton
import soft

ELBOW = (0.0, -skeleton.H, 0.0)
COLLECTION = "Arm"


def reload_all():
    for m in (armlib, sdf, sculpt, skeleton, hand, anat, muscle_specs, soft, preview):
        importlib.reload(m)
    import exporter

    importlib.reload(exporter)


def _col():
    return armlib.collection(COLLECTION)


def _place_forearm(obj):
    """For previews: forearm-frame objects sit at the elbow in the rest pose."""
    obj.location = armlib.B(ELBOW)
    obj["frame"] = "forearm"


def build_bones(col=None):
    col = col or _col()
    out = {}
    h = skeleton.humerus(col)
    h["frame"] = "humerus"
    g = skeleton.girdle(col)
    g["frame"] = "girdle"
    fa = skeleton.forearm_bones(col)
    hd = hand.build(col, sdf.mesh_sdf, skeleton.finish)
    for o in fa + hd:
        _place_forearm(o)
    for o in [h, g] + fa + hd:
        o["tissue"] = "bone"
        out[o.name] = armlib.tri_count(o)
    return out


def grip_fit():
    """Where a dumbbell handle sits in the gripping hand (forearm frame):
    the circle through the palm-side surfaces of the curled fingers."""
    M = hand.pose_matrices("grip")
    segs = hand.segments()
    pts = []
    for ray in ("index", "middle", "ring", "little"):
        for k, frac in ((0, 0.95), (1, 0.5), (2, 0.5), (3, 0.4)):
            i = [j for j, s in enumerate(segs) if s["ray"] == ray][k]
            s = segs[i]
            # the flexor tendon's palm-side surface over this bone
            off = s["dp"] + 0.03
            p = s["pivot"] + s["R"] @ np.array([off, -s["L"] * frac, 0.0])
            q = M[i][:3, :3] @ p + M[i][:3, 3]
            pts.append(q)
    P = np.array(pts)
    # least-squares circle in the x-y plane (the handle runs along z)
    A = np.stack([2 * P[:, 0], 2 * P[:, 1], np.ones(len(P))], axis=1)
    b = P[:, 0] ** 2 + P[:, 1] ** 2
    cx, cy, c = np.linalg.lstsq(A, b, rcond=None)[0]
    r = float(np.sqrt(c + cx * cx + cy * cy))
    cz = float(P[:, 2].mean())
    return {"centre": [round(float(cx), 3), round(float(cy), 3), round(cz, 3)], "radius": round(max(r - 0.01, 0.1), 3)}


def landmarks():
    """Attachment points the scenes mark and draw forces at, in the frame of
    the bone each rides on (humerus frame = shoulder frame at rest)."""
    r = lambda p: [round(float(v), 3) for v in p]
    return {
        "bicepsOrigin": r(anat.CORACOID_TIP),
        "bicepsInsertion": r(np.array(anat.RADIAL_TUB) + np.array([0.0, skeleton.H, 0.0])),
        "tricepsOrigin": r(anat.INFRAGLENOID),
        "tricepsInsertion": r(np.array(anat.OLECRANON) + np.array([0.0, skeleton.H, 0.0])),
    }


def build_all(repo):
    reload_all()
    armlib.clear_collection(COLLECTION)
    col = _col()
    build_bones(col)
    soft.build(col)
    import exporter

    return exporter.export(repo, col, landmarks=landmarks(), grip=grip_fit())

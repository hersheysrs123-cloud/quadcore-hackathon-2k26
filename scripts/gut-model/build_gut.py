"""Builds public/models/gut.glb and components/visualizations/gut-model-meta.js:
the oesophagus, stomach and boluses the peristalsis scene draws (see README.md).
Reuses scripts/plant-model's helpers and GLB writer."""

import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PLANT = os.path.join(HERE, "..", "plant-model")
if PLANT not in sys.path:
    sys.path.insert(0, PLANT)

import numpy as np  # noqa: E402

import plantlib as pl  # noqa: E402

COLLECTION = "Gut"


def _gut():
    import gut

    importlib.reload(pl)
    importlib.reload(gut)
    return gut


def build_oesophagus(col):
    gut = _gut()
    pl.clear(col, "oesophagus")
    V, F, A = gut.oesophagus()
    o = pl.mesh_from("oesophagus", col, V, F, node="oesophagus")
    pl.set_attr(o, "tube", A)
    pl.set_attr(o, "col", np.tile([1.0, 1.0, 1.0, 1.0], (len(V), 1)))
    pl.smooth_shade(o)
    return {"verts": len(V), "tris": len(F)}


def build_stomach(col, voxel=0.12, ratio=0.12):
    gut = _gut()
    pl.clear(col, "stomach")
    o = pl.sdf.mesh_sdf("stomach", col, gut.stomach_field(), np.array([-6.8, -38.5, -3.3]), np.array([8.2, -22.0, 3.3]), voxel)
    o["node"] = "stomach"
    pl.decimate(o, ratio)
    pl.paint(o, gut.stomach_colour)
    pl.smooth_shade(o)
    pl.clear(col, "stomach_vessels")
    parts, cols = [], []
    for pts, r, kind in gut.stomach_vessels(gut.stomach_field()):
        m = len(pts)
        rad = r * np.interp(np.linspace(0, 1, m), [0, 1], [1.0, 0.55])
        V, F, t, a = pl.sweep(pts, rad, sides=6, cap_start=True, cap_end=True)
        parts.append((V, F))
        cols.append(np.tile(pl.hex_rgb("#a8233a" if kind == "artery" else "#4a4a8a"), (len(V), 1)))
    V, F = pl.combine(parts)
    v = pl.mesh_from("stomach_vessels", col, V, F, node="stomach")
    c = np.concatenate(cols)
    pl.set_attr(v, "col", np.concatenate([c, np.ones((len(c), 1))], axis=1))
    pl.smooth_shade(v)
    return {"tris": pl.triangles(o), "vessels": len(parts)}


def build_boluses(col, voxel=0.035, ratio=0.2):
    gut = _gut()
    out = {}
    for kind in ("soft", "dry"):
        name = f"bolus_{kind}"
        pl.clear(col, name)
        f, bits = gut.bolus_field(kind, seed=3 if kind == "soft" else 7)
        o = pl.sdf.mesh_sdf(name, col, f, np.array([-1.5, -1.5, -1.5]), np.array([1.5, 1.5, 1.5]), voxel)
        o["node"] = "bolus" + kind.capitalize()
        pl.decimate(o, ratio)
        pl.paint(o, lambda P, N, kind=kind, bits=bits: gut.bolus_colour(P, kind, bits))
        pl.smooth_shade(o)
        out[kind] = pl.triangles(o)
    return out


def build_all(repo, export_only=False):
    import plant_export as px

    importlib.reload(px)
    gut = _gut()
    col = pl.collection(COLLECTION)
    if not export_only:
        build_oesophagus(col)
        build_stomach(col)
        build_boluses(col)
    return px.export_to(
        os.path.join(repo, "public", "models", "gut.glb"),
        os.path.join(repo, "components", "visualizations", "gut-model-meta.js"),
        "GUT_MODEL",
        [col],
        gut.meta(),
        "SocraticOS. Modelled in-house in Blender (scripts/gut-model) from Gray's Anatomy (public domain) and histology texts; no third-party mesh.",
        "SocraticOS gut build (scripts/gut-model)",
        "scripts/gut-model/build_gut.py",
    )


def run_async(status_path, fn, *args, **kwargs):
    import build_plant

    return build_plant.run_async(status_path, fn, *args, **kwargs)

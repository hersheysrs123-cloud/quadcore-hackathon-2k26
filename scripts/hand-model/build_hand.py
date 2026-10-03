"""Builds public/models/fleming-hand.glb and
components/visualizations/fleming-hand-model-meta.js: the left hand the
motor-effect scene draws for Fleming's left-hand rule (see README.md).

Reuses scripts/plant-model's helpers, GLB writer and run_async, and
scripts/arm-model's hand skeleton and SDF mesher.
"""

import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PLANT = os.path.join(HERE, "..", "plant-model")
for p in (HERE, PLANT):
    if p not in sys.path:
        sys.path.insert(0, p)

import numpy as np  # noqa: E402

import plantlib as pl  # noqa: E402

COL = "FlemingHand"


def _fl():
    import fleming

    importlib.reload(pl)
    importlib.reload(fleming)
    return fleming


def build(voxel_dm=0.005, tris=50000):
    """Mesh the skin (SCENE units) on a `voxel_dm` decimetre grid, decimate it
    to about `tris` triangles and paint it."""
    fl = _fl()
    voxel = voxel_dm * fl.SCALE
    col = pl.collection(COL)
    pl.clear(col)
    lo, hi = fl.bounds()
    o = pl.sdf.mesh_sdf("fleming_hand", col, fl.scene_field, tuple(lo), tuple(hi), voxel)
    o["node"] = "hand"
    raw = pl.triangles(o)
    pl.decimate(o, tris / (2.0 * raw))  # the raw mesh is quads
    pl.smooth_shade(o)
    info = paint()
    info["faces_raw"] = raw
    return info


def paint():
    """Repaint the built skin (after a colour change, without re-meshing)."""
    fl = _fl()
    o = pl.collection(COL).objects["fleming_hand"]
    P = pl.verts(o)
    N = pl.normals(o)
    c, a = fl.colour(P, N)
    pl.set_attr(o, "col", np.concatenate([c, a[:, None]], axis=1))
    return {"tris": pl.triangles(o), "verts": len(P)}


def export(repo):
    import plant_export

    fl = _fl()
    col = pl.collection(COL)
    meta = {"units": "scene", "scale": fl.SCALE, "anchors": fl.anchors()}
    return plant_export.export_to(
        os.path.join(repo, "public", "models", "fleming-hand.glb"),
        os.path.join(repo, "components", "visualizations", "fleming-hand-model-meta.js"),
        "FLEMING_HAND",
        [col],
        meta,
        "SocraticOS. Modelled in-house in Blender (scripts/hand-model) on the arm build's hand skeleton, traced from Gray's Anatomy; no third-party mesh.",
        "SocraticOS hand build (scripts/hand-model)",
        "scripts/hand-model/build_hand.py",
    )


def build_all(repo):
    info = build()
    info["export"] = export(repo)
    return info


def run_async(status_path, fn, *args, **kwargs):
    import build_plant

    return build_plant.run_async(status_path, fn, *args, **kwargs)

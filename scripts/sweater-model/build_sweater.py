"""Builds public/models/sweater.glb and
components/visualizations/sweater-model-meta.js: the wool sweater on its
dress form that the static-electricity scene rubs the balloon on (see
README.md).

Reuses scripts/plant-model's helpers, GLB writer and run_async, and
scripts/arm-model's SDF mesher and loft.

Nodes:
  sweater  the wool (COLOR_0, _KNIT for the stitch shader)
  form     the dress form's linen neck and base plate
  wood     its turned cap, the hub and the three legs
  metal    the pole and its height collar
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

COL = "Sweater"


def _sw():
    import sweater

    importlib.reload(pl)
    importlib.reload(sweater)
    return sweater


def build_wool(voxel=0.0075, tris=90000):
    """Mesh the sweater, decimate it to about `tris` triangles, paint it and
    give it its knit coordinates."""
    sw = _sw()
    col = pl.collection(COL)
    pl.clear(col, "wool")
    lo, hi = sw.bounds()
    o = pl.sdf.mesh_sdf("wool", col, sw.sweater_field, tuple(lo), tuple(hi), voxel)
    o["node"] = "sweater"
    raw = pl.triangles(o)
    pl.decimate(o, tris / (2.0 * raw))
    pl.smooth_shade(o)
    info = paint()
    info["faces_raw"] = raw
    return info


def paint():
    """Recolour and re-coordinate the built wool, without re-meshing."""
    sw = _sw()
    o = pl.collection(COL).objects["wool"]
    P = pl.verts(o)
    N = pl.normals(o)
    c = sw.colour(P, N)
    pl.set_attr(o, "col", np.concatenate([c, np.ones((len(P), 1))], axis=1))
    pl.set_attr(o, "knit", sw.knit(P))
    return {"tris": pl.triangles(o), "verts": len(P)}


def build_stand():
    sw = _sw()
    col = pl.collection(COL)
    for prefix in ("form", "wood", "metal"):
        pl.clear(col, prefix)
    for i, (node, V, F, rgb) in enumerate(sw.form_parts()):
        o = pl.mesh_from(f"{node}_{i}", col, V, F, node=node)
        pl.paint(o, rgb)
        pl.smooth_shade(o)
    for i, path in enumerate(sw.leg_paths()):
        r = np.linspace(0.042, 0.03, len(path))
        V, F, _, _ = pl.sweep(path, r, sides=14)
        o = pl.mesh_from(f"wood_leg{i}", col, V, pl.quads_to_tris(F), node="wood")
        pl.paint(o, (0.4, 0.25, 0.14))
        pl.smooth_shade(o)
        # a felt foot under the end of each leg
        fV, fF = sw.revolve([(0.0, sw.FLOOR_Y + 0.03), (0.05, sw.FLOOR_Y + 0.03), (0.055, sw.FLOOR_Y + 0.005), (0.0, sw.FLOOR_Y + 0.005)], 20)
        fV = fV + np.array([path[-1][0], 0.0, path[-1][2]])
        f = pl.mesh_from(f"form_foot{i}", col, fV, fF, node="form")
        pl.paint(f, (0.22, 0.2, 0.19))
    return {"objects": len(col.objects)}


def export(repo):
    import plant_export

    sw = _sw()
    col = pl.collection(COL)
    return plant_export.export_to(
        os.path.join(repo, "public", "models", "sweater.glb"),
        os.path.join(repo, "components", "visualizations", "sweater-model-meta.js"),
        "SWEATER_MODEL",
        [col],
        {"units": "scene", **sw.anchors()},
        "SocraticOS. Modelled in-house in Blender (scripts/sweater-model); no third-party mesh.",
        "SocraticOS sweater build (scripts/sweater-model)",
        "scripts/sweater-model/build_sweater.py",
    )


def build_all(repo):
    info = build_wool()
    info["stand"] = build_stand()
    info["export"] = export(repo)
    return info


def run_async(status_path, fn, *args, **kwargs):
    import build_plant

    return build_plant.run_async(status_path, fn, *args, **kwargs)

"""Builds public/models/cannon.glb and
components/visualizations/cannon-model-meta.js: the projectile scene's
bronze cannon on its oak garrison carriage (see README.md).

Reuses scripts/plant-model's helpers, GLB writer and run_async.

Nodes:
  barrel   bronze: the barrel, trunnions, vent and dolphins, in the barrel's
           own frame (trunnion axis = z through the origin, bore along +x)
  wood     the oak cheeks, axletrees and transom (_TUBE = grain coordinates)
  iron     the trucks, axle arms, cap squares and bolts
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

COL = "Cannon"


def _cn():
    import cannon

    importlib.reload(pl)
    importlib.reload(cannon)
    return cannon


def _add(col, name, node, V, F, C, grain=None):
    o = pl.mesh_from(name, col, V, F, node=node)
    pl.set_attr(o, "col", np.concatenate([C, np.ones((len(V), 1))], axis=1))
    if grain is not None:
        pl.set_attr(o, "tube", grain)
    pl.smooth_shade(o)
    return o


def build():
    cn = _cn()
    col = pl.collection(COL)
    pl.clear(col)
    for i, (V, F, C) in enumerate(cn.barrel()):
        _add(col, f"barrel_{i}", "barrel", V, F, C)
    for i, (node, V, F, C, g) in enumerate(cn.carriage()):
        _add(col, f"{node}_{i}", node, V, F, C, g)
    return {"objects": len(col.objects), "tris": sum(pl.triangles(o) for o in col.objects)}


def export(repo):
    import plant_export

    importlib.reload(plant_export)
    cn = _cn()
    return plant_export.export_to(
        os.path.join(repo, "public", "models", "cannon.glb"),
        os.path.join(repo, "components", "visualizations", "cannon-model-meta.js"),
        "CANNON_MODEL",
        [pl.collection(COL)],
        {"units": "scene", **cn.anchors()},
        "SocraticOS. Modelled in-house in Blender (scripts/cannon-model); no third-party mesh.",
        "SocraticOS cannon build (scripts/cannon-model)",
        "scripts/cannon-model/build_cannon.py",
    )


def build_all(repo):
    info = build()
    info["export"] = export(repo)
    return info

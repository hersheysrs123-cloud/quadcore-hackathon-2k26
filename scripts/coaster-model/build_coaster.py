"""Builds public/models/coaster-car.glb and
components/visualizations/coaster-car-model-meta.js: the roller-coaster
scene's car (see README.md).

Reuses scripts/plant-model's helpers, GLB writer and run_async,
scripts/arm-model's SDF mesher, and scripts/cannon-model's lathe.

Nodes (metres, the car's frame: x forward, y up, z across):
  shell       the fibreglass body, painted
  seats       the upholstered benches, backrests and headrests
  riders      the four riders
  pad         the lap bars' padding
  steel       the chassis, wheel carriers, couplings and lap-bar posts
  roadWheel   one running wheel, centred on the origin, turning about z
  upWheel     one upstop wheel, the same
  guideWheel  one guide wheel, turning about y
The scene places a copy of each wheel at every position in the meta.
"""

import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PLANT = os.path.join(HERE, "..", "plant-model")
ARM = os.path.join(HERE, "..", "arm-model")
CANNON = os.path.join(HERE, "..", "cannon-model")
for p in (HERE, PLANT, CANNON, ARM):
    if p not in sys.path:
        sys.path.insert(0, p)

import numpy as np  # noqa: E402

import plantlib as pl  # noqa: E402

COL = "CoasterCar"


def _car():
    import cannon
    import coaster_car

    importlib.reload(pl)
    importlib.reload(cannon)
    importlib.reload(coaster_car)
    return coaster_car


def _sdf_part(col, name, node, field, bounds, voxel, tris, colour):
    cc = _car()
    pl.clear(col, name)
    lo, hi = bounds()
    o = pl.sdf.mesh_sdf(name, col, field, tuple(lo), tuple(hi), voxel)
    o["node"] = node
    raw = pl.triangles(o)
    pl.decimate(o, tris / (2.0 * raw))
    pl.smooth_shade(o)
    pl.paint(o, colour if callable(colour) else np.asarray(colour))
    del cc
    return {"raw": raw, "tris": pl.triangles(o)}


def build_shell(voxel=0.014, tris=36000):
    cc = _car()
    return _sdf_part(pl.collection(COL), "shell", "shell", cc.shell_field, cc.shell_bounds, voxel, tris, cc.shell_colour)


def build_seats(voxel=0.014, tris=9000):
    cc = _car()
    return _sdf_part(pl.collection(COL), "seats", "seats", cc.seat_field, cc.seat_bounds, voxel, tris, cc.UPHOLSTERY)


def build_riders(voxel=0.009, tris=36000):
    cc = _car()
    return _sdf_part(pl.collection(COL), "riders", "riders", cc.rider_field, cc.rider_bounds, voxel, tris, cc.rider_colour)


def build_chassis(voxel=0.012, tris=14000):
    cc = _car()
    return _sdf_part(pl.collection(COL), "chassis", "steel", cc.chassis_field, cc.chassis_bounds, voxel, tris, cc.STEEL)


def build_parts():
    """The lap bars and the three wheels: explicit meshes, quick to build."""
    cc = _car()
    col = pl.collection(COL)
    for prefix in ("bar", "wheel"):
        pl.clear(col, prefix)
    for i, (node, V, F) in enumerate(cc.lap_bars()):
        o = pl.mesh_from(f"bar_{i}", col, V, F, node=node)
        pl.paint(o, (0.98, 0.78, 0.12) if node == "pad" else (0.75, 0.77, 0.8))
        pl.smooth_shade(o)
    for node, (r, w, axis) in {
        "roadWheel": (cc.ROAD_R, cc.ROAD_W, "z"),
        "upWheel": (cc.UP_R, cc.UP_W, "z"),
        "guideWheel": (cc.GUIDE_R, cc.GUIDE_W, "y"),
    }.items():
        V, F, C = cc.wheel(r, w, axis)
        o = pl.mesh_from(f"wheel_{node}", col, V, F, node=node)
        pl.set_attr(o, "col", np.concatenate([C, np.ones((len(V), 1))], axis=1))
        pl.smooth_shade(o)
    return {"objects": len(col.objects)}


def export(repo):
    import plant_export

    importlib.reload(plant_export)
    cc = _car()
    return plant_export.export_to(
        os.path.join(repo, "public", "models", "coaster-car.glb"),
        os.path.join(repo, "components", "visualizations", "coaster-car-model-meta.js"),
        "COASTER_CAR_MODEL",
        [pl.collection(COL)],
        cc.anchors(),
        "SocraticOS. Modelled in-house in Blender (scripts/coaster-model); no third-party mesh.",
        "SocraticOS coaster car build (scripts/coaster-model)",
        "scripts/coaster-model/build_coaster.py",
    )


def build_all(repo):
    info = {"shell": build_shell(), "seats": build_seats(), "riders": build_riders(), "chassis": build_chassis(), "parts": build_parts()}
    info["export"] = export(repo)
    return info


def run_async(status_path, fn, *args, **kwargs):
    import build_plant

    return build_plant.run_async(status_path, fn, *args, **kwargs)

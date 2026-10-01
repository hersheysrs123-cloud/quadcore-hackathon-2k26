"""Builds public/models/food-chain.glb and
components/visualizations/food-chain-model-meta.js: the oak sprig,
caterpillar, blue tit and sparrowhawk the food-chain scene draws (see
README.md). Reuses scripts/plant-model's helpers and GLB writer."""

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

FOOD = "FoodChain"
CARBON = "CarbonCycle"


def _cc():
    import carbon

    importlib.reload(pl)
    importlib.reload(carbon)
    return carbon


def _fc():
    import foodchain

    importlib.reload(pl)
    importlib.reload(foodchain)
    return foodchain


def _mesh(name, col, node, V, F, C):
    o = pl.mesh_from(name, col, V, F, node=node)
    pl.set_attr(o, "col", np.concatenate([np.asarray(C), np.ones((len(C), 1))], axis=1))
    pl.smooth_shade(o)
    return o


def build_sprig(col, seed=3):
    fc = _fc()
    pl.clear(col, "sprig")
    V, F, C = fc.sprig(seed)
    o = _mesh("sprig", col, "sprig", V, F, C)
    return {"tris": pl.triangles(o)}


def build_caterpillar(col):
    fc = _fc()
    pl.clear(col, "caterpillar")
    V, F, C = fc.caterpillar(loop=False)
    Vl, Fl, _ = fc.caterpillar(loop=True)
    assert len(V) == len(Vl)
    o = _mesh("caterpillar", col, "caterpillar", V, F, C)
    o.shape_key_add(name="Basis")
    k = o.shape_key_add(name="loop")
    k.data.foreach_set("co", pl.to_blender(Vl).ravel())
    k.value = 0.0
    return {"tris": pl.triangles(o)}


def _bird(col, name, node, bird, colour, lo, hi, voxel, ratio, eyes):
    pl.clear(col, name)
    o = pl.sdf.mesh_sdf(name, col, bird.field(), np.array(lo), np.array(hi), voxel)
    o["node"] = node
    pl.decimate(o, ratio)
    pl.paint(o, colour)
    pl.smooth_shade(o)
    for k, (V, F, C) in enumerate(eyes):
        _mesh(f"{name}_eye{k}", col, node, V, F, C)
    return pl.triangles(o)


def build_blue_tit(col, voxel=0.06, ratio=0.07):
    fc = _fc()
    b = fc.blue_tit()
    hc, hr = fc.TIT["head"]
    eyes = fc.eye_meshes(hc, hr, (0.42, 0.22, 0.88), fc.TIT["eye"])
    return {"tris": _bird(col, "blueTit", "blueTit", b, fc.blue_tit_colour(b), (-7.2, -0.2, -3.4), (6.0, 8.3, 3.4), voxel, ratio, eyes)}


def build_hawk(col, voxel=0.12, ratio=0.09):
    fc = _fc()
    b = fc.hawk()
    hc, hr = fc.HAWK["head"]
    eyes = fc.eye_meshes(hc, hr[0] * 0.93, (0.5, 0.2, 0.84), 0.72, iris="#f2a71b")
    tris = _bird(col, "hawk", "hawk", b, fc.hawk_colour(b), (-8.0, -8.6, -6.6), (8.2, 21.0, 6.6), voxel, ratio, eyes)
    pl.clear(col, "hawkLog")
    R = fc.HAWK["log"]
    o = pl.sdf.mesh_sdf("hawkLog", col, fc.log_field(), np.array([-4.8, -2 * R - 0.8, -9.4]), np.array([5.6, 0.8, 9.4]), 0.14)
    o["node"] = "hawk"
    pl.decimate(o, 0.1)
    pl.paint(o, fc.log_colour)
    pl.smooth_shade(o)
    return {"tris": tris, "log": pl.triangles(o)}


def build_food_chain(col=None):
    col = col or pl.collection(FOOD)
    return {
        "sprig": build_sprig(col),
        "caterpillar": build_caterpillar(col),
        "blueTit": build_blue_tit(col),
        "hawk": build_hawk(col),
    }


def export_food_chain(repo):
    import plant_export as px

    importlib.reload(px)
    fc = _fc()
    return px.export_to(
        os.path.join(repo, "public", "models", "food-chain.glb"),
        os.path.join(repo, "components", "visualizations", "food-chain-model-meta.js"),
        "FOOD_CHAIN_MODEL",
        [pl.collection(FOOD)],
        fc.meta(),
        "SocraticOS. Modelled in-house in Blender (scripts/ecosystem-model) from field-guide plates and photographs; no third-party mesh.",
        "SocraticOS ecosystem build (scripts/ecosystem-model)",
        "scripts/ecosystem-model/build_eco.py",
    )


# ─── Carbon cycle ──────────────────────────────────────────────────


def _sdf_part(col, name, node, field, colour, lo, hi, voxel, ratio):
    o = pl.sdf.mesh_sdf(name, col, field, np.array(lo), np.array(hi), voxel)
    o["node"] = node
    pl.decimate(o, ratio)
    pl.paint(o, colour)
    pl.smooth_shade(o)
    return pl.triangles(o)


def build_trees(col):
    cc = _cc()
    pl.clear(col, "broadleaf")
    pl.clear(col, "conifer")
    V, F, C = cc._trunk_parts(4.6, 0.36, 0.2, 5, 3)
    _mesh("broadleaf_trunk", col, "broadleaf", V, F, C)
    f, _ = cc.broadleaf_field(1)
    a = _sdf_part(col, "broadleaf_crown", "broadleaf", f, cc.broadleaf_colour(1), (-4.4, 2.6, -4.4), (4.4, 8.8, 4.4), 0.08, 0.06)
    V, F, C = cc._trunk_parts(2.4, 0.28, 0.14, 0, 4)
    _mesh("conifer_trunk", col, "conifer", V, F, C)
    b = _sdf_part(col, "conifer_crown", "conifer", cc.conifer_field(2), cc.conifer_colour(2), (-2.7, 1.2, -2.7), (2.7, 9.8, 2.7), 0.07, 0.07)
    pl.clear(col, "stump")
    V, F, C = cc.stump()
    _mesh("stump", col, "stump", V, F, C)
    return {"broadleaf": a, "conifer": b}


def build_cow(col):
    cc = _cc()
    pl.clear(col, "cow")
    field, colour = cc.cow()
    t = _sdf_part(col, "cow", "cow", field, colour, (-11.6, -0.3, -4.6), (16.2, 13.2, 4.6), 0.12, 0.06)
    for k, (V, F, C) in enumerate(cc.cow_eyes()):
        _mesh(f"cow_eye{k}", col, "cow", V, F, C)
    return {"tris": t}


def build_power_station(col):
    cc = _cc()
    pl.clear(col, "plant")
    V, F, C = cc.power_station()
    _mesh("plant_buildings", col, "plant", V, pl.quads_to_tris(F), C)
    t = _sdf_part(col, "plant_heap", "plant", cc.coal_heap_field(), cc.coal_colour, (-34.0, -0.6, -7.5), (-17.0, 4.5, 7.5), 0.2, 0.12)
    return {"heap": t}


def build_carbon(col=None):
    col = col or pl.collection(CARBON)
    return {"trees": build_trees(col), "cow": build_cow(col), "plant": build_power_station(col)}


def export_carbon(repo):
    import plant_export as px

    importlib.reload(px)
    cc = _cc()
    return px.export_to(
        os.path.join(repo, "public", "models", "carbon-cycle.glb"),
        os.path.join(repo, "components", "visualizations", "carbon-cycle-model-meta.js"),
        "CARBON_CYCLE_MODEL",
        [pl.collection(CARBON)],
        cc.meta(),
        "SocraticOS. Modelled in-house in Blender (scripts/ecosystem-model); no third-party mesh.",
        "SocraticOS ecosystem build (scripts/ecosystem-model)",
        "scripts/ecosystem-model/build_eco.py",
    )


def build_all(repo, export_only=False):
    if not export_only:
        build_food_chain()
        build_carbon()
    return {"food": export_food_chain(repo), "carbon": export_carbon(repo)}


def run_async(status_path, fn, *args, **kwargs):
    import build_plant

    return build_plant.run_async(status_path, fn, *args, **kwargs)

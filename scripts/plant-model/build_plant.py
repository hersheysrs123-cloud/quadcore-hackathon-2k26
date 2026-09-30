"""Builds public/models/transpiration.glb and
components/visualizations/plant-model-meta.js: every mesh the transpiration
scene draws, modelled in Blender (see README.md).

Each part is a function that fills a collection; `build_all` runs them in
turn and exports. Parts can be rebuilt on their own from a Blender session.
"""

import importlib

import numpy as np

import plantlib as pl

PARTS = ("shoot", "roots", "soil", "stem", "leafsec", "stoma", "roothair")


def _reload():
    import plant

    importlib.reload(pl)
    importlib.reload(plant)
    return plant


def build_shoot(col):
    plant = _reload()
    pl.clear(col, "shoot")
    V, F, colr, sway, uv, info = plant.shoot(0.0)
    Vw = plant.shoot(1.0)[0]
    o = pl.mesh_from("shoot", col, V, F, node="plant")
    pl.set_attr(o, "col", np.concatenate([colr, np.ones((len(colr), 1))], axis=1))
    pl.set_attr(o, "sway", sway)
    pl.set_attr(o, "uvl", uv)
    pl.smooth_shade(o)
    o.shape_key_add(name="Basis")
    k = o.shape_key_add(name="wilt")
    k.data.foreach_set("co", pl.to_blender(Vw).ravel())
    k.value = 0.0
    o["info"] = str(info)
    return info


def build_roots(col):
    plant = _reload()
    pl.clear(col, "roots")
    V, F, colr, info = plant.roots()
    o = pl.mesh_from("roots", col, V, F, node="roots")
    pl.set_attr(o, "col", np.concatenate([colr, np.ones((len(colr), 1))], axis=1))
    pl.smooth_shade(o)
    return info


def build_soil(col, voxel=0.03, ratio=0.14):
    plant = _reload()
    pl.clear(col, "soil")
    field, peb = plant.soil_field()
    o = pl.sdf.mesh_sdf("soil", col, field, plant.SOIL_LO - 0.1, plant.SOIL_HI + 0.1, voxel)
    o["node"] = "soil"
    pl.decimate(o, ratio)
    P = pl.verts(o)
    c = plant.soil_colour(P, peb)
    pl.set_attr(o, "col", np.concatenate([c, np.ones((len(c), 1))], axis=1))
    pl.smooth_shade(o)
    return {"tris": pl.triangles(o)}


def build_stem(col):
    import stem

    importlib.reload(stem)
    pl.clear(col, "stem")
    (Vb, Fb), (Vt, Ft), (Vh, Fh) = stem.build()
    body = pl.mesh_from("stem_body", col, Vb, Fb, node="stem")
    # colour is drawn by the stem shader; COLOR_0 flags the body (alpha 1)
    pl.set_attr(body, "col", np.tile([0.85, 0.85, 0.8, 1.0], (len(Vb), 1)))
    pl.smooth_shade(body)
    th = pl.mesh_from("stem_thick", col, Vt, Ft, node="stemDetail")
    pl.set_attr(th, "col", np.tile([*pl.hex_rgb("#c8a266"), 1.0], (len(Vt), 1)))
    pl.smooth_shade(th)
    hr = pl.mesh_from("stem_hairs", col, Vh, Fh, node="stemDetail")
    pl.set_attr(hr, "col", np.tile([*pl.hex_rgb("#d9e8c4"), 1.0], (len(Vh), 1)))
    pl.smooth_shade(hr)
    return stem.meta()


def _guard_morph(P):
    """Open the stoma: each guard cell bows away from the pore (most at the
    middle, pinned at the tips) and swells a little, as turgor rises."""
    import leafsec as ls

    s = np.sign(P[:, 0] - ls.STOMA_X)
    t = np.clip((P[:, 2] - (ls.FRONT - 0.275)) / 0.55, 0, 1)
    bow = np.sin(np.pi * t)
    cx = ls.STOMA_X + s * 0.068
    d = np.zeros_like(P)
    d[:, 0] = s * 0.07 * bow + (P[:, 0] - cx) * 0.14
    d[:, 1] = (P[:, 1] + 0.92) * 0.11
    return d


def add_morph(obj, name, delta):
    if obj.data.shape_keys is None:
        obj.shape_key_add(name="Basis")
    k = obj.shape_key_add(name=name)
    P = pl.verts(obj)
    k.data.foreach_set("co", pl.to_blender(P + delta).ravel())
    k.value = 0.0
    return k


def build_leafsec(col, voxel=0.0125, ratio=0.065, parts=("epi", "meso", "guard", "vein")):
    import leafsec as ls

    importlib.reload(ls)
    L = ls.Layout()
    lo = np.array([ls.X0 - 0.05, -1.1, ls.Z0 - 0.08])
    hi = np.array([ls.X1 + 0.05, 1.15, ls.FRONT + 0.05])
    out = {}
    if "epi" in parts:
        pl.clear(col, "leafsec_epi")
        o = pl.sdf.mesh_sdf("leafsec_epi", col, ls.epidermis_field(L), lo, hi, voxel * 1.2)
        o["node"] = "leafSection"
        pl.decimate(o, ratio)
        pl.paint(o, lambda P, N: ls.colour_epi(P), alpha=0.72)
        pl.smooth_shade(o)
        out["epi"] = pl.triangles(o)
    if "meso" in parts:
        pl.clear(col, "leafsec_meso")
        o = pl.sdf.mesh_sdf("leafsec_meso", col, ls.mesophyll_field(L), lo, np.array([hi[0], 0.95, hi[2]]), voxel)
        o["node"] = "leafSection"
        pl.decimate(o, ratio)
        pl.paint(o, lambda P, N: ls.colour_meso(P, L))
        pl.smooth_shade(o)
        out["meso"] = pl.triangles(o)
    if "vein" in parts:
        pl.clear(col, "leafsec_vein")
        f = lambda P: np.minimum(ls.vein_field(P), ls.xylem_field(P))
        o = pl.sdf.mesh_sdf("leafsec_vein", col, f, np.array([ls.VEIN[0] - 0.35, ls.VEIN[1] - 0.3, ls.Z0 - 0.05]), np.array([ls.VEIN[0] + 0.35, ls.VEIN[1] + 0.3, ls.FRONT + 0.05]), voxel * 0.8)
        o["node"] = "leafSection"
        pl.decimate(o, 0.14)
        pl.paint(o, lambda P, N: ls.colour_vein(P))
        pl.smooth_shade(o)
        out["vein"] = pl.triangles(o)
    if "guard" in parts:
        pl.clear(col, "leafsec_guard")
        o = pl.sdf.mesh_sdf("leafsec_guard", col, ls.guard_field, np.array([ls.STOMA_X - 0.3, -1.08, ls.FRONT - 0.4]), np.array([ls.STOMA_X + 0.3, -0.76, ls.FRONT + 0.05]), voxel * 0.5)
        o["node"] = "leafGuard"
        pl.decimate(o, 0.3)
        pl.paint(o, lambda P, N: ls.colour_guard(P))
        pl.smooth_shade(o)
        add_morph(o, "open", _guard_morph(pl.verts(o)))
        out["guard"] = pl.triangles(o)
    return out


# ─── Running long builds from an MCP call ──────────────────────────
# A Blender MCP call times out at about a minute. `run_async` runs a build
# from a timer instead and writes its result (or error) to a JSON file.


def run_async(status_path, fn, *args, **kwargs):
    import json
    import time
    import traceback

    import bpy

    def tick():
        t = time.time()
        try:
            res = fn(*args, **kwargs)
            doc = {"ok": True, "result": res, "seconds": round(time.time() - t, 1)}
        except Exception:
            doc = {"ok": False, "error": traceback.format_exc()}
        with open(status_path, "w") as f:
            json.dump(doc, f, default=str)
        return None

    with open(status_path, "w") as f:
        json.dump({"running": True}, f)
    bpy.app.timers.register(tick, first_interval=0.1)


def build_stoma(col, voxel=0.011):
    import stoma

    importlib.reload(stoma)
    pl.clear(col, "stoma")
    V, F, S = stoma.surface()
    o = pl.mesh_from("stoma_surface", col, V, pl.quads_to_tris(F), node="stomaSurface")
    pl.decimate(o, 0.14)
    pl.paint(o, lambda P, N: stoma.colour_surface(P, S))
    pl.smooth_shade(o)
    Vh, Fh = stoma.hair()
    h = pl.mesh_from("stoma_hair", col, Vh, Fh, node="stomaSurface")
    pl.paint(h, stoma.C["hair"])
    pl.smooth_shade(h)
    lo = np.array([-stoma.W, -stoma.HGT, -0.3])
    hi = np.array([stoma.W, stoma.HGT, 0.3])
    g = pl.sdf.mesh_sdf("stoma_guard", col, stoma.guard_field, lo, hi, voxel)
    g["node"] = "stomaGuard"
    pl.decimate(g, 0.14)
    # the guard cells of the stoma at the corner are clipped by the patch edge
    pl.paint(g, lambda P, N: stoma.colour_guard(P))
    pl.smooth_shade(g)
    add_morph(g, "open", stoma.guard_open(pl.verts(g)))
    return {"surface": pl.triangles(o), "guard": pl.triangles(g), **stoma.meta()}


def build_roothair(col, voxel=0.022):
    import roothair as rh

    importlib.reload(rh)
    pl.clear(col, "rh_")
    soil = rh.Soil()
    V, F, c = rh.root_mesh()
    o = pl.mesh_from("rh_root", col, V, F, node="rootTip")
    pl.set_attr(o, "col", np.concatenate([c, np.ones((len(c), 1))], axis=1))
    pl.smooth_shade(o)
    V, F = rh.hair_meshes(soil)
    o = pl.mesh_from("rh_hairs", col, V, F, node="rootTip")
    pl.paint(o, rh.C["hair"])
    pl.smooth_shade(o)
    V, F = rh.stele_mesh()
    o = pl.mesh_from("rh_stele", col, V, F, node="rootStele")
    pl.paint(o, rh.C["stele"])
    pl.smooth_shade(o)
    V, F, c = rh.grain_meshes(soil)
    o = pl.mesh_from("rh_grains", col, V, pl.quads_to_tris(F), node="rootSoil")
    pl.set_attr(o, "col", np.concatenate([c, np.ones((len(c), 1))], axis=1))
    pl.smooth_shade(o)
    w = pl.sdf.mesh_sdf("rh_water", col, rh.water_field(soil), np.array([-2.45, -1.85, -1.05]), np.array([2.45, 1.85, 0.75]), voxel)
    w["node"] = "rootWater"
    pl.decimate(w, 0.1)
    pl.paint(w, pl.hex_rgb("#7cc4f0"))
    pl.smooth_shade(w)
    # drought: the films thin back towards the particles
    add_morph(w, "dry", -pl.normals(w) * 0.024)
    return {"hairs": len(soil.hairs), "grains": len(soil.grains), "water": pl.triangles(w), "meta": rh.meta(soil)}


# ─── Everything ────────────────────────────────────────────────────

COLLECTIONS = ("Plant", "Stem", "LeafSec", "Stoma", "RootHair")


def build_all(repo, export_only=False):
    import leafsec as ls
    import plant_export as px
    import roothair as rh

    importlib.reload(px)
    cols = {name: pl.collection(name) for name in COLLECTIONS}
    if not export_only:
        build_shoot(cols["Plant"])
        build_roots(cols["Plant"])
        build_soil(cols["Plant"])
        build_stem(cols["Stem"])
        build_leafsec(cols["LeafSec"])
        build_stoma(cols["Stoma"])
        build_roothair(cols["RootHair"])
    import ast
    import stem
    import stoma

    plant = _reload()
    importlib.reload(rh)
    importlib.reload(ls)
    shoot_obj = cols["Plant"].objects["shoot"]
    info = ast.literal_eval(shoot_obj["info"])
    roots_info = plant.roots()[3]
    meta = {
        "plant": {**info, "hairZones": roots_info["hairZones"], "soil": {"lo": plant.SOIL_LO.tolist(), "hi": plant.SOIL_HI.tolist()}},
        "stem": stem.meta(),
        "leafSection": ls.meta(),
        "stoma": stoma.meta(),
        "rootTip": rh.meta(rh.Soil()),
    }
    return px.export(repo, [cols[n] for n in COLLECTIONS], meta)

"""Builds public/models/alveoli.glb and components/visualizations/alveoli-model-meta.js:
the alveolar duct and sac, their capillary net, and an alveolar septum cut
open, for the respiratory scene's two zoomed-in levels (see README.md).
Reuses scripts/plant-model's helpers and GLB writer."""

import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PLANT = os.path.join(HERE, "..", "plant-model")
if PLANT not in sys.path:
    sys.path.insert(0, PLANT)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import numpy as np  # noqa: E402

import plantlib as pl  # noqa: E402

COLLECTION = "Alveoli"
STATE = {}


def _mods():
    import acinus
    import septum

    importlib.reload(pl)
    importlib.reload(acinus)
    importlib.reload(septum)
    return acinus, septum


def build_acinus(col, voxel=0.05, ratio=0.12):
    ac, _ = _mods()
    pl.clear(col, "acinus")
    lo = np.array([-5.4, -7.6, -5.4])
    hi = np.array([5.4, ac.TOP + 0.2, 5.4])
    o = pl.sdf.mesh_sdf("acinus_tissue", col, ac.tissue_field, lo, hi, voxel)
    o["node"] = "acinus"
    raw = pl.triangles(o)
    pl.decimate(o, ratio)
    pl.paint(o, ac.tissue_colour)
    pl.smooth_shade(o)
    return {"rawQuads": raw, "tris": pl.triangles(o)}


def build_net(col):
    ac, _ = _mods()
    pl.clear(col, "capillaries")
    pl.clear(col, "vessels")
    nets = ac.nets()
    V, F, A = ac.net_mesh(nets)
    o = pl.mesh_from("capillaries", col, V, F, node="capillaries")
    pl.set_attr(o, "tube", A)
    pl.set_attr(o, "col", np.tile([1.0, 1.0, 1.0, 1.0], (len(V), 1)))
    pl.smooth_shade(o)
    art = ac.arteriole()
    vens = ac.venules()
    V, F, A = ac.vessel_mesh(art, vens)
    v = pl.mesh_from("vessels", col, V, F, node="vessels")
    pl.set_attr(v, "tube", A)
    pl.set_attr(v, "col", np.tile([1.0, 1.0, 1.0, 1.0], (len(V), 1)))
    pl.smooth_shade(v)
    flow = ac.paths(nets, vens)
    STATE["acinus"] = ac.meta(nets, art, vens, flow)
    return {"alveoliWithNets": len(nets), "netTris": pl.triangles(o), "paths": len(flow)}


def build_septum(col, voxel=0.06):
    _, se = _mods()
    lo = np.array([se.X0 - 0.3, -8.0, se.Z0 - 0.3])
    hi = np.array([se.X1 + 0.3, 7.5, 0.4])
    out = {}
    layers = [
        ("septum_epithelium", "septumEpithelium", se.epithelium, se.epithelium_colour, 0.06),
        ("septum_basement", "septumBasement", se.basement, se.C["basement"], 0.05),
        ("septum_endothelium", "septumEndothelium", se.endothelium, se.endothelium_colour, 0.08),
        ("septum_interstitium", "septumInterstitium", se.interstitium, se.interstitium_colour, 0.15),
        ("septum_typetwo", "septumTypeTwo", se.type_two, se.type_two_colour, 0.25),
        ("septum_parts", "septumTypeTwo", se.type_two_parts, se.parts_colour, 0.4),
        ("septum_macrophage", "septumMacrophage", se.macrophage, se.macrophage_colour, 0.3),
    ]
    for name, node, field, colour, ratio in layers:
        pl.clear(col, name)
        o = pl.sdf.mesh_sdf(name, col, field, lo, hi, voxel)
        o["node"] = node
        raw = pl.triangles(o)
        pl.decimate(o, ratio)
        pl.paint(o, colour if callable(colour) else pl.hex_rgb(colour))
        pl.smooth_shade(o)
        out[name] = [raw, pl.triangles(o)]
    out.update(build_septum_extras(col))
    return out


def build_septum_extras(col):
    _, se = _mods()
    out = {}
    pl.clear(col, "septum_fibres")
    parts, cols = [], []
    for pts, r, kind in se.fibres():
        keep = se.inside_septum(pts)
        # split into runs that stay inside the interstitium
        runs, cur = [], []
        for p, k in zip(pts, keep):
            if k:
                cur.append(p)
            elif cur:
                runs.append(cur)
                cur = []
        if cur:
            runs.append(cur)
        for run in runs:
            if len(run) < 4:
                continue
            V, F, t, _ = pl.sweep(np.array(run), r, sides=7)
            parts.append((V, F))
            cols.append(np.tile(pl.hex_rgb(se.C[kind]), (len(V), 1)))
    if parts:
        V, F = pl.combine(parts)
        o = pl.mesh_from("septum_fibres", col, V, F, node="septumInterstitium")
        c = np.concatenate(cols)
        pl.set_attr(o, "col", np.concatenate([c, np.ones((len(c), 1))], axis=1))
        pl.smooth_shade(o)
    pl.clear(col, "rbc")
    V, F, M = se.rbc()
    o = pl.mesh_from("rbc", col, V, F, node="rbc")
    pl.set_attr(o, "col", np.tile([1.0, 1.0, 1.0, 1.0], (len(V), 1)))
    pl.smooth_shade(o)
    o.shape_key_add(name="Basis")
    k = o.shape_key_add(name="parachute")
    k.data.foreach_set("co", pl.to_blender(V + M).ravel())
    k.value = 0
    STATE["septum"] = se.meta()
    out["fibres"] = len(parts)
    return out


def build_all(repo, export_only=False):
    import plant_export as px

    importlib.reload(px)
    col = pl.collection(COLLECTION)
    if not export_only:
        build_acinus(col)
        build_net(col)
        build_septum(col)
    return export(repo)


def export(repo):
    import plant_export as px

    importlib.reload(px)
    col = pl.collection(COLLECTION)
    return px.export_to(
        os.path.join(repo, "public", "models", "alveoli.glb"),
        os.path.join(repo, "components", "visualizations", "alveoli-model-meta.js"),
        "ALVEOLI_MODEL",
        [col],
        {"acinus": STATE.get("acinus"), "septum": STATE.get("septum")},
        "SocraticOS. Modelled in-house in Blender (scripts/lung-model) from Weibel's lung morphometry and histology texts; no third-party mesh.",
        "SocraticOS alveoli build (scripts/lung-model)",
        "scripts/lung-model/build_alveoli.py",
    )


def run_async(status_path, fn, *args, **kwargs):
    import build_plant

    return build_plant.run_async(status_path, fn, *args, **kwargs)

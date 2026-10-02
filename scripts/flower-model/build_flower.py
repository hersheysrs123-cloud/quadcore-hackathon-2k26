"""Builds public/models/flower.glb and
components/visualizations/flower-model-meta.js: the dissected half-flower,
the honeybee and the pollen grains of the pollination scene (see README.md).
Reuses scripts/plant-model's helpers and GLB writer."""

import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PLANT = os.path.join(HERE, "..", "plant-model")
for p in (HERE, PLANT):
    if p not in sys.path:
        sys.path.insert(0, p)

import bpy  # noqa: E402
import numpy as np  # noqa: E402

import plantlib as pl  # noqa: E402

COL = "Flower"


def _fl():
    import flower

    importlib.reload(pl)
    importlib.reload(flower)
    return flower


def _mesh(name, col, node, V, F, C, uvl=None):
    o = pl.mesh_from(name, col, V, pl.quads_to_tris(F), node=node)
    C = np.asarray(C, dtype=np.float64)
    if C.shape[1] == 3:
        C = np.concatenate([C, np.ones((len(C), 1))], axis=1)
    pl.set_attr(o, "col", C)
    if uvl is not None:
        pl.set_attr(o, "uvl", uvl)
    pl.smooth_shade(o)
    return o


def decimate_keep_cut(obj, ratio, fl, factor=1.0):
    """Decimate everything but the dissection face to `ratio`: the cut's
    painted tissue (epidermis, strands, the transmitting tract) needs its
    vertices to show. Weight 0 spares a vertex from the collapse."""
    P = pl.verts(obj)
    N = pl.normals(obj)
    keep = fl.cut_mask(P, N)
    ratio = (keep.sum() * 0.6 + ratio * (~keep).sum()) / len(P)
    g = obj.vertex_groups.new(name="dec")
    g.add(np.nonzero(~keep)[0].tolist(), 1.0, "REPLACE")
    g.add(np.nonzero(keep)[0].tolist(), 0.0, "REPLACE")
    mod = obj.modifiers.new("dec", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    mod.vertex_group = "dec"
    mod.vertex_group_factor = factor
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    old = obj.data
    obj.modifiers.clear()
    obj.vertex_groups.clear()
    obj.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)
    return obj


def _solid(col, name, node, field, colour, lo, hi, voxel, ratio, fl, factor=1.0):
    pl.clear(col, name)
    o = pl.sdf.mesh_sdf(name, col, field, np.array(lo, dtype=np.float64), np.array(hi, dtype=np.float64), voxel)
    o["node"] = node
    decimate_keep_cut(o, ratio, fl, factor)
    pl.paint(o, colour)
    pl.smooth_shade(o)
    return pl.triangles(o)


def build_body(col):
    fl = _fl()
    return _solid(col, "body", "body", fl.body_field, fl.body_colour, (-1.1, fl.PEDICEL_BOTTOM - 0.05, -1.1), (1.1, fl.STYLE_TOP + 0.05, 0.03), 0.017, 0.16, fl)


def build_ovules(col):
    fl = _fl()
    return _solid(col, "ovules", "ovules", fl.ovules_field, fl.ovules_colour, (-0.68, 0.28, -0.4), (0.66, 1.46, 0.03), 0.0105, 0.22, fl)


def build_nectary(col):
    fl = _fl()
    r = fl.NECTARY["radius"] + 0.2
    y = fl.NECTARY["y"]
    return _solid(col, "nectary", "nectary", fl.nectary_field, fl.nectary_colour, (-r, y - 0.15, -r), (r, y + 0.15, 0.03), 0.011, 0.2, fl)


def build_stigmas(col):
    fl = _fl()
    a = _solid(col, "stigmaSticky", "stigmaSticky", fl.stigma_sticky_field, fl.stigma_sticky_colour, (-0.42, -0.42, -0.42), (0.42, 0.34, 0.03), 0.009, 0.2, fl)
    b = _solid(col, "stigmaNeck", "stigmaFeathery", fl.stigma_neck_field, fl.stigma_neck_colour, (-0.2, -0.42, -0.2), (0.2, 0.06, 0.03), 0.008, 0.25, fl)
    pl.clear(col, "stigmaPlumes")
    V, F, C = fl.stigma_feathery()
    _mesh("stigmaPlumes", col, "stigmaFeathery", V, F, C)
    return {"sticky": a, "neck": b, "plumes": int(len(F))}


def build_stamens(col):
    fl = _fl()
    out = {}
    for kind, field, colour, lo, hi in (
        ("insect", fl.anther_insect_full, fl.anther_insect_colour, (-0.06, 3.55, -0.2), (0.3, 4.3, 0.2)),
        ("wind", fl.anther_wind_full, fl.anther_wind_colour, (0.55, 3.55, -0.16), (0.9, 4.6, 0.16)),
    ):
        node = "stamenInsect" if kind == "insect" else "stamenWind"
        pl.clear(col, node)
        V, F, C = fl.filament(kind)
        _mesh(node + "_filament", col, node, V, F, C)
        o = pl.sdf.mesh_sdf(node + "_anther", col, field, np.array(lo), np.array(hi), 0.006)
        o["node"] = node
        pl.decimate(o, 0.2)
        pl.paint(o, colour)
        pl.smooth_shade(o)
        out[kind] = pl.triangles(o)
    return out


def build_perianth(col):
    fl = _fl()
    out = {}
    for name, fn in (("petal", fl.petal), ("sepal", fl.sepal), ("tepal", fl.tepal)):
        pl.clear(col, name)
        V, F, C, uvl = fn()
        o = _mesh(name, col, name, V, F, C, uvl)
        out[name] = pl.triangles(o)
    return out


def build_bee(col):
    fl = _fl()
    pl.clear(col, "bee")
    o = pl.sdf.mesh_sdf("bee", col, fl.bee_full, np.array([-0.4, -0.18, -0.16]), np.array([0.42, 0.15, 0.16]), 0.005)
    o["node"] = "bee"
    pl.decimate(o, 0.12)
    pl.paint(o, fl.bee_colour)
    pl.smooth_shade(o)
    V, F, C = fl.bee_limbs()
    _mesh("bee_limbs", col, "bee", V, F, C)
    V, F, C = fl.bee_pollen()
    _mesh("beePollen", col, "beePollen", V, F, C)
    V, F, C = fl.bee_wing()
    _mesh("beeWing", col, "beeWing", V, F, C)
    return {"body": pl.triangles(o)}


def build_pollen(col):
    fl = _fl()
    pl.clear(col, "pollen")
    V, F, C = fl.pollen_spiky()
    _mesh("pollenSpiky", col, "pollenSpiky", V, F, C)
    V, F, C = fl.pollen_smooth()
    _mesh("pollenSmooth", col, "pollenSmooth", V, F, C)
    return {}


def build_flower(col=None):
    col = col or pl.collection(COL)
    return {
        "body": build_body(col),
        "ovules": build_ovules(col),
        "nectary": build_nectary(col),
        "stigmas": build_stigmas(col),
        "stamens": build_stamens(col),
        "perianth": build_perianth(col),
        "bee": build_bee(col),
        "pollen": build_pollen(col),
    }


def export_flower(repo):
    import plant_export as px

    importlib.reload(px)
    fl = _fl()
    return px.export_to(
        os.path.join(repo, "public", "models", "flower.glb"),
        os.path.join(repo, "components", "visualizations", "flower-model-meta.js"),
        "FLOWER_MODEL",
        [pl.collection(COL)],
        fl.meta(),
        "SocraticOS. Modelled in-house in Blender (scripts/flower-model) from botany texts, dissection photographs and entomology plates; no third-party mesh.",
        "SocraticOS flower build (scripts/flower-model)",
        "scripts/flower-model/build_flower.py",
    )


def build_all(repo, export_only=False):
    if not export_only:
        build_flower()
    return export_flower(repo)


def run_async(status_path, fn, *args, **kwargs):
    import build_plant

    return build_plant.run_async(status_path, fn, *args, **kwargs)

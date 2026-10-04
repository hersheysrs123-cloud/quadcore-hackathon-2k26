"""Builds public/models/villus.glb and components/visualizations/villus-model-meta.js:
the small intestine's wall (level 1) and one villus cut open (level 2) for
the peristalsis scene's absorption levels (see README.md).
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

COLLECTION = "Villus"
STATE = {}


def _v():
    import villus

    importlib.reload(pl)
    importlib.reload(villus)
    return villus


def _white(o):
    pl.set_attr(o, "col", np.tile([1.0, 1.0, 1.0, 1.0], (len(o.data.vertices), 1)))


def build_wall(col, voxel=0.05, ratio=0.15):
    vi = _v()
    pl.clear(col, "wall")
    lo = np.array([-vi.BX - 0.1, -vi.WALL_T - 0.2, -vi.BZ - 0.1])
    hi = np.array([vi.BX + 0.1, 3.6, vi.BZ + 0.1])
    o = pl.sdf.mesh_sdf("wall_block", col, vi.wall_field, lo, hi, voxel)
    o["node"] = "wall"
    raw = pl.triangles(o)
    pl.decimate(o, ratio)
    pl.set_attr(o, "tube", vi.wall_tube(pl.verts(o)))
    _white(o)
    pl.smooth_shade(o)
    pl.clear(col, "villus_low")
    V, F, M = vi.villus_low()
    v = pl.mesh_from("villus_low", col, V, F, node="villusLow")
    _white(v)
    pl.smooth_shade(v)
    v.shape_key_add(name="Basis")
    k = v.shape_key_add(name="atrophy")
    k.data.foreach_set("co", pl.to_blender(V + M).ravel())
    k.value = 0
    # the sites, as one tiny triangle each (vertex 3i is the site), its normal in `tube`
    pl.clear(col, "villus_sites")
    P, N = vi.villus_sites()
    n = len(P)
    t1 = np.cross(N, np.array([0.0, 0.0, 1.0]))
    t1 /= np.maximum(np.linalg.norm(t1, axis=1, keepdims=True), 1e-9)
    t2 = np.cross(N, t1)
    V = np.stack([P, P + t1 * 0.01, P + t2 * 0.01], axis=1).reshape(-1, 3)
    F = np.arange(3 * n).reshape(n, 3)
    s = pl.mesh_from("villus_sites", col, V, F, node="villusSites")
    pl.set_attr(s, "tube", np.concatenate([np.repeat(N, 3, axis=0), np.zeros((3 * n, 1))], axis=1))
    _white(s)
    STATE["sites"] = int(n)
    return {"rawQuads": raw, "tris": pl.triangles(o), "sites": int(n)}


def build_villus(col, voxel=0.16, ratio=0.2):
    vi = _v()
    out = {}
    pl.clear(col, "villus_tissue")
    lo = np.array([-vi.RB - 0.6, -1.0, -vi.RB - 0.6])
    hi = np.array([vi.RB + 0.6, vi.VH + 0.6, vi.RB + 0.6])
    o = pl.sdf.mesh_sdf("villus_tissue", col, vi.villus_field, lo, hi, voxel)
    o["node"] = "villus"
    out["tissue"] = [pl.triangles(o)]
    pl.decimate(o, ratio)
    pl.set_attr(o, "tube", vi.villus_tube(pl.verts(o)))
    _white(o)
    pl.smooth_shade(o)
    out["tissue"].append(pl.triangles(o))
    pl.clear(col, "villus_lacteal")
    lo2 = np.array([-vi.LACT_R - 0.8, -8.5, -vi.LACT_R - 0.8])
    hi2 = np.array([vi.LACT_R + 0.8, vi.LACT_TOP + 0.5, vi.LACT_R + 0.8])
    la = pl.sdf.mesh_sdf("villus_lacteal", col, vi.lacteal_field, lo2, hi2, 0.08)
    la["node"] = "lacteal"
    pl.decimate(la, 0.08)
    pl.paint(la, pl.hex_rgb("#f6ead2"))
    pl.smooth_shade(la)
    out["lacteal"] = pl.triangles(la)
    pl.clear(col, "villus_floor")
    x0, x1, z0, z1, yb = vi.FLOOR
    fl = pl.sdf.mesh_sdf("villus_floor", col, vi.floor_field, np.array([x0 - 0.4, yb - 0.4, z0 - 0.4]), np.array([x1 + 0.4, 0.5, z1 + 0.4]), 0.22)
    fl["node"] = "floor"
    pl.decimate(fl, 0.1)
    pl.set_attr(fl, "tube", vi.floor_tube(pl.verts(fl)))
    _white(fl)
    pl.smooth_shade(fl)
    out["floor"] = pl.triangles(fl)
    # vessels
    pl.clear(col, "villus_vessels")
    art, ven, caps, links = vi.capillary_paths()
    parts, kinds = [], []
    V, F, t, _ = pl.sweep(art, 0.62, sides=12, cap_start=False, cap_end=False)
    parts.append((V, F))
    kinds.append(np.zeros(len(V)))
    V, F, t, _ = pl.sweep(ven, 0.72, sides=12, cap_start=False, cap_end=False)
    parts.append((V, F))
    kinds.append(np.ones(len(V)))
    # nothing floats where the middle storey's front half was cut away
    for c in caps:
        for run in vi.runs_outside_cut(c):
            V, F, t, _ = pl.sweep(run, vi.CAPR, sides=7, cap_start=False, cap_end=False)
            parts.append((V, F))
            kinds.append(np.full(len(V), 0.5))
    for l in links:
        for run in vi.runs_outside_cut(l):
            V, F, t, _ = pl.sweep(run, vi.CAPR * 0.85, sides=6, cap_start=True, cap_end=True)
            parts.append((V, F))
            kinds.append(np.full(len(V), 0.5))
    V, F = pl.combine(parts)
    k = np.concatenate(kinds)
    ve = pl.mesh_from("villus_vessels", col, V, F, node="villusVessels")
    pl.set_attr(ve, "tube", np.stack([k, np.zeros_like(k), np.zeros_like(k), np.zeros_like(k)], axis=1))
    _white(ve)
    pl.smooth_shade(ve)
    out["vessels"] = pl.triangles(ve)
    # smooth muscle strands beside the lacteal
    pl.clear(col, "villus_muscle")
    mparts = []
    for pts in vi.muscle_strands():
        V, F, t, _ = pl.sweep(pts, 0.32, sides=8)
        mparts.append((V, F))
    V, F = pl.combine(mparts)
    mu = pl.mesh_from("villus_muscle", col, V, F, node="lacteal")
    pl.paint(mu, pl.hex_rgb("#c0596a"))
    pl.smooth_shade(mu)
    STATE["villus"] = (art, ven, caps, links)
    return out


def build_all(repo, export_only=False):
    col = pl.collection(COLLECTION)
    if not export_only:
        build_wall(col)
        build_villus(col)
    return export(repo)


def export(repo):
    import plant_export as px

    importlib.reload(px)
    vi = _v()
    col = pl.collection(COLLECTION)
    art, ven, caps, links = STATE.get("villus") or vi.capillary_paths()
    return px.export_to(
        os.path.join(repo, "public", "models", "villus.glb"),
        os.path.join(repo, "components", "visualizations", "villus-model-meta.js"),
        "VILLUS_MODEL",
        [col],
        vi.meta(STATE.get("sites", 0), art, ven, caps, links),
        "SocraticOS. Modelled in-house in Blender (scripts/villus-model) from histology texts (Ross & Pawlina) and Helander & Fandriks (2014); no third-party mesh.",
        "SocraticOS villus build (scripts/villus-model)",
        "scripts/villus-model/build_villus.py",
    )


def run_async(status_path, fn, *args, **kwargs):
    import build_plant

    return build_plant.run_async(status_path, fn, *args, **kwargs)

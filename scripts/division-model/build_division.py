"""Builds public/models/division.glb and
components/visualizations/division-model-meta.js: chromatin territories,
the nucleolus, the nuclear envelope with its pores, centrioles, the
pericentriolar material and a mitochondrion for the mitosis-and-meiosis
scene (see README.md). Reuses scripts/plant-model's helpers and GLB writer."""

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

COL = "Division"


def _dv():
    import division

    importlib.reload(pl)
    importlib.reload(division)
    return division


def _mesh(name, col, node, V, F, C):
    o = pl.mesh_from(name, col, V, pl.quads_to_tris(F), node=node)
    C = np.asarray(C, dtype=np.float64)
    if C.shape[1] == 3:
        C = np.concatenate([C, np.ones((len(C), 1))], axis=1)
    pl.set_attr(o, "col", C)
    pl.smooth_shade(o)
    return o


def _solid(col, name, field, colour, lo, hi, voxel, ratio):
    pl.clear(col, name)
    o = pl.sdf.mesh_sdf(name, col, field, np.array(lo, dtype=np.float64), np.array(hi, dtype=np.float64), voxel)
    o["node"] = name
    pl.decimate(o, ratio)
    pl.paint(o, colour)
    pl.smooth_shade(o)
    return pl.triangles(o)


def build_division(col=None):
    col = col or pl.collection(COL)
    dv = _dv()
    out = {}
    for k in range(dv.TERRITORIES):
        name = f"territory{k}"
        pl.clear(col, name)
        V, F, C = dv.territory(k)
        _mesh(name, col, name, V, F, C)
        out[name] = int(len(F))
    for name, mother in (("centriole", False), ("centrioleMother", True)):
        pl.clear(col, name)
        V, F, C = dv.centriole(mother)
        _mesh(name, col, name, V, F, C)
        out[name] = int(len(F))
    out["nucleolus"] = _solid(col, "nucleolus", dv.nucleolus_field, dv.nucleolus_colour, (-1.2, -1.2, -1.2), (1.2, 1.2, 1.2), 0.025, 0.25)
    out["envelope"] = _solid(col, "envelope", dv.envelope_field, dv.envelope_colour, (-1.06, -1.06, -1.06), (1.06, 1.06, 1.06), 0.0075, 0.06)
    out["pcm"] = _solid(col, "pcm", dv.pcm_field, dv.pcm_colour, (-1.3, -1.3, -1.3), (1.3, 1.3, 1.3), 0.04, 0.3)
    out["mitochondrion"] = _solid(col, "mitochondrion", dv.mito_field, dv.mito_colour, (-0.78, -0.3, -0.3), (0.78, 0.36, 0.3), 0.012, 0.18)
    return out


def export_division(repo):
    import plant_export as px

    importlib.reload(px)
    dv = _dv()
    return px.export_to(
        os.path.join(repo, "public", "models", "division.glb"),
        os.path.join(repo, "components", "visualizations", "division-model-meta.js"),
        "DIVISION_MODEL",
        [pl.collection(COL)],
        dv.meta(),
        "SocraticOS. Modelled in-house in Blender (scripts/division-model) from electron micrographs and textbook cell-biology figures; no third-party mesh.",
        "SocraticOS division build (scripts/division-model)",
        "scripts/division-model/build_division.py",
    )


def build_all(repo, export_only=False):
    if not export_only:
        build_division()
    return export_division(repo)


def run_async(status_path, fn, *args, **kwargs):
    import build_plant

    return build_plant.run_async(status_path, fn, *args, **kwargs)

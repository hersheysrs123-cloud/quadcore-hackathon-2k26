"""Builds public/models/microbes.glb and
components/visualizations/microbe-model-meta.js: the cut-away E. coli, the
T4 bacteriophage and penicillin for the bacteria-vs-virus scene (see
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

COL = "Microbes"


def _mb():
    import microbe

    importlib.reload(pl)
    importlib.reload(microbe)
    return microbe


def _mesh(name, col, node, V, F, C):
    o = pl.mesh_from(name, col, V, pl.quads_to_tris(F), node=node)
    C = np.asarray(C, dtype=np.float64)
    if C.shape[1] == 3:
        C = np.concatenate([C, np.ones((len(C), 1))], axis=1)
    pl.set_attr(o, "col", C)
    pl.smooth_shade(o)
    return o


def decimate_keep(obj, ratio, keep):
    """Collapse-decimate everything but the vertices `keep` marks (weight 0
    spares a vertex), so painted detail on a cut edge keeps its vertices;
    `ratio` applies to the rest."""
    import bpy

    k = np.asarray(keep, dtype=bool)
    g = obj.vertex_groups.new(name="dec")
    g.add(np.nonzero(~k)[0].tolist(), 1.0, "REPLACE")
    g.add(np.nonzero(k)[0].tolist(), 0.0, "REPLACE")
    mod = obj.modifiers.new("dec", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = float((k.sum() + ratio * (~k).sum()) / len(k))
    mod.use_collapse_triangulate = True
    mod.vertex_group = "dec"
    mod.vertex_group_factor = 1.0
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    old = obj.data
    obj.modifiers.clear()
    obj.vertex_groups.clear()
    obj.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)
    return obj


def _solid(col, name, node, field, colour, lo, hi, voxel, ratio, keep=None):
    pl.clear(col, name)
    o = pl.sdf.mesh_sdf(name, col, field, np.array(lo, dtype=np.float64), np.array(hi, dtype=np.float64), voxel)
    o["node"] = node
    if keep is None:
        pl.decimate(o, ratio)
    else:
        decimate_keep(o, ratio, keep(pl.verts(o)))
    pl.paint(o, colour)
    pl.smooth_shade(o)
    return pl.triangles(o)


def build_cell(col):
    mb = _mb()
    out = {}
    e = mb.HALF + 1.05
    lo, hi = (-e, -1.05, -1.05), (e, 1.05, 1.05)
    # The cut rims carry the layers' painted sections; elsewhere a smooth shell decimates hard.
    rim = lambda name: (lambda P: np.abs(mb.window(P, name)) < 0.03)  # noqa: E731
    out["wall"] = _solid(col, "wall", "wall", mb.layer_field("wall"), mb.wall_colour, lo, hi, 0.013, 0.035, rim("wall"))
    out["membrane"] = _solid(col, "membrane", "membrane", mb.layer_field("membrane"), mb.membrane_colour, lo, hi, 0.013, 0.03, rim("membrane"))
    out["cytoplasm"] = _solid(col, "cytoplasm", "cytoplasm", mb.layer_field("cytoplasm"), mb.cytoplasm_colour, lo, hi, 0.02, 0.12)
    for name, fn in (("pili", mb.pili), ("flagellaHooks", mb.flagella_hooks), ("nucleoid", mb.nucleoid), ("plasmid", mb.plasmid), ("dnaFragment", mb.dna_fragment)):
        pl.clear(col, name)
        V, F, C = fn()
        _mesh(name, col, name, V, F, C)
        out[name] = int(len(F))
    out["ribosome"] = _solid(col, "ribosome", "ribosome", mb.ribosome_field, mb.ribosome_colour, (-1.0, -0.8, -0.8), (1.0, 1.0, 0.8), 0.035, 0.12)
    return out


def build_phage(col):
    mb = _mb()
    out = {}
    out["head"] = _solid(col, "phageHead", "phageHead", mb.head_field, mb.head_colour, (-0.6, -0.2, -0.6), (0.6, 1.4, 0.35), 0.008, 0.12)
    out["sheath"] = _solid(col, "phageSheath", "phageSheath", mb.sheath_field, mb.sheath_colour, (-0.22, -0.56, -0.22), (0.22, 0.56, 0.22), 0.006, 0.14)
    out["baseplate"] = _solid(col, "phageBaseplate", "phageBaseplate", mb.baseplate_field, mb.baseplate_colour, (-0.45, -0.2, -0.45), (0.45, 0.12, 0.45), 0.007, 0.15)
    for name, fn in (("phageDna", mb.dna_spool), ("phageCore", mb.core_mesh), ("phageFibre", mb.tail_fibre), ("phageLow", mb.phage_low), ("penicillin", mb.penicillin)):
        pl.clear(col, name)
        V, F, C = fn()
        _mesh(name, col, name, V, F, C)
        out[name] = int(len(F))
    return out


def build_microbes(col=None):
    col = col or pl.collection(COL)
    return {"cell": build_cell(col), "phage": build_phage(col)}


def export_microbes(repo):
    import plant_export as px

    importlib.reload(px)
    mb = _mb()
    return px.export_to(
        os.path.join(repo, "public", "models", "microbes.glb"),
        os.path.join(repo, "components", "visualizations", "microbe-model-meta.js"),
        "MICROBE_MODEL",
        [pl.collection(COL)],
        mb.meta(),
        "SocraticOS. Modelled in-house in Blender (scripts/microbe-model) from electron micrographs, cryo-EM structures and textbook cut-aways; no third-party mesh.",
        "SocraticOS microbe build (scripts/microbe-model)",
        "scripts/microbe-model/build_microbe.py",
    )


def build_all(repo, export_only=False):
    if not export_only:
        build_microbes()
    return export_microbes(repo)


def run_async(status_path, fn, *args, **kwargs):
    import build_plant

    return build_plant.run_async(status_path, fn, *args, **kwargs)

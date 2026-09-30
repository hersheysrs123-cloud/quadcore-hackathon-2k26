"""Write public/models/transpiration.glb and
components/visualizations/plant-model-meta.js.

Reuses the arm build's small GLB writer (scripts/arm-model/exporter.py) for
its accessors, sparse morph targets and packed normals. Every object in the
build collections with a "node" property is merged into that node's mesh.

  POSITION  int16 normalised, dequantised by the node's translation and
            (uniform) scale: its own frame, scene axes, y up. The scene
            unpacks it to float once on load (plant-model.jsx).
  NORMAL    int8 normalised (KHR_mesh_quantization)
  COLOR_0   uint8 x4 normalised: base colour (sRGB) and alpha
  _SWAY     uint8 x4 normalised: wind weight, phase / 2pi, 0, 0 (plant)
  _UVL      int16 x2 normalised: leaf coordinates (plant)
  _CELL     uint8 x4 normalised: cell size / 0.4, wall strength, stretch / 8,
            tissue / 255 (the panels' cell shader)
  morphs    POSITION deltas as sparse accessors, one per shape key
"""

import json
import os

import numpy as np

import exporter as armexp
import plantlib as pl

UBYTE, SHORT, FLOAT = 5121, 5122, 5126


def _arrays(obj):
    me = obj.data
    me.calc_loop_triangles()
    nv = len(me.vertices)
    tri = np.empty(len(me.loop_triangles) * 3, dtype=np.int64)
    me.loop_triangles.foreach_get("vertices", tri)
    out = {"pos": pl.verts(obj).astype(np.float32), "nrm": pl.normals(obj).astype(np.float32), "idx": tri}
    for name in ("col", "sway", "uvl", "cell"):
        v = pl.get_attr(obj, name)
        if v is not None:
            out[name] = v
    if me.shape_keys:
        for kb in me.shape_keys.key_blocks[1:]:
            kc = np.empty(nv * 3, dtype=np.float32)
            kb.data.foreach_get("co", kc)
            out["morph:" + kb.name] = pl.from_blender(kc.reshape(-1, 3)) - out["pos"]
    return out


WIDTH = {"col": 4, "sway": 2, "uvl": 2, "cell": 4}
FILL = {"col": (1, 1, 1, 1), "sway": (0, 0), "uvl": (0, 0), "cell": (0, 0, 0, 0)}


def _merge(parts):
    names = [k for k in WIDTH if any(k in p for p in parts)]
    morphs = sorted({k for p in parts for k in p if k.startswith("morph:")})
    out = {"pos": [], "nrm": [], "idx": []}
    for k in names + morphs:
        out[k] = []
    base = 0
    for p in parts:
        n = len(p["pos"])
        out["pos"].append(p["pos"])
        out["nrm"].append(p["nrm"])
        out["idx"].append(p["idx"] + base)
        for k in names:
            out[k].append(p[k] if k in p else np.tile(np.asarray(FILL[k], dtype=np.float32), (n, 1)))
        for k in morphs:
            out[k].append(p.get(k, np.zeros((n, 3), dtype=np.float32)))
        base += n
    return {k: np.concatenate(v) for k, v in out.items()}


class PlantGlb(armexp.Glb):
    def add_node(self, name, m, extras=None):
        n = len(m["pos"])
        pos = m["pos"].astype(np.float64)
        lo, hi = pos.min(axis=0), pos.max(axis=0)
        centre = (lo + hi) / 2
        scale = float(max((hi - lo).max() / 2, 1e-6)) * 1.0001
        q = np.round((pos - centre) / scale * 32767).astype(np.int16)
        q4 = np.zeros((n, 4), dtype=np.int16)
        q4[:, :3] = q
        while len(self.bin) % 4:
            self.bin.append(0)
        view = {"buffer": 0, "byteOffset": len(self.bin), "byteLength": q4.nbytes, "byteStride": 8, "target": 34962}
        self.bin.extend(q4.tobytes())
        self.views.append(view)
        self.accessors.append({"bufferView": len(self.views) - 1, "componentType": SHORT, "normalized": True, "count": int(n), "type": "VEC3", "min": q.min(axis=0).astype(int).tolist(), "max": q.max(axis=0).astype(int).tolist()})
        attrs = {"POSITION": len(self.accessors) - 1}
        attrs["NORMAL"] = self._normals(m["nrm"])
        if "col" in m:
            c = np.round(np.clip(m["col"], 0, 1) * 255).astype(np.uint8)
            attrs["COLOR_0"] = self.accessor(c, "VEC4", UBYTE, normalized=True, target=34962)
        if "sway" in m:
            s = np.zeros((n, 4), dtype=np.uint8)
            s[:, 0] = np.round(np.clip(m["sway"][:, 0], 0, 1) * 255)
            s[:, 1] = np.round((m["sway"][:, 1] / (2 * np.pi)) % 1.0 * 255)
            attrs["_SWAY"] = self.accessor(s, "VEC4", UBYTE, normalized=True, target=34962)
        if "uvl" in m:
            u = np.round(np.clip(m["uvl"], -1, 1) * 32767).astype(np.int16)
            attrs["_UVL"] = self.accessor(u, "VEC2", SHORT, normalized=True, target=34962)
        if "cell" in m:
            c = m["cell"] * np.array([1 / 0.4, 1.0, 1 / 8.0, 1 / 255.0])
            c = np.round(np.clip(c, 0, 1) * 255).astype(np.uint8)
            attrs["_CELL"] = self.accessor(c, "VEC4", UBYTE, normalized=True, target=34962)
        big = n >= 65536
        idx = m["idx"].astype(np.uint32 if big else np.uint16)
        prim = {"attributes": attrs, "indices": self.accessor(idx, "SCALAR", armexp.UINT if big else armexp.USHORT, target=34963)}
        mesh = {"name": name, "primitives": [prim]}
        morphs = [k[6:] for k in m if k.startswith("morph:")]
        if morphs:
            prim["targets"] = [{"POSITION": self.sparse_vec3((m["morph:" + k] / scale).astype(np.float32))} for k in morphs]
            mesh["weights"] = [0.0] * len(morphs)
            mesh["extras"] = {"targetNames": morphs}
        self.meshes.append(mesh)
        node = {"name": name, "mesh": len(self.meshes) - 1, "translation": centre.tolist(), "scale": [scale, scale, scale]}
        if extras:
            node["extras"] = extras
        self.nodes.append(node)

    def write_plant(self, path, copyright):
        doc = {
            "asset": {"version": "2.0", "generator": "SocraticOS plant build (scripts/plant-model)", "copyright": copyright},
            "extensionsUsed": ["KHR_mesh_quantization"],
            "extensionsRequired": ["KHR_mesh_quantization"],
            "scene": 0,
            "scenes": [{"nodes": list(range(len(self.nodes)))}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "accessors": self.accessors,
            "bufferViews": self.views,
            "buffers": [{"byteLength": len(self.bin)}],
        }
        import struct

        js = json.dumps(doc, separators=(",", ":")).encode()
        js += b" " * ((4 - len(js) % 4) % 4)
        binb = bytes(self.bin) + b"\0" * ((4 - len(self.bin) % 4) % 4)
        total = 12 + 8 + len(js) + 8 + len(binb)
        with open(path, "wb") as f:
            f.write(struct.pack("<III", 0x46546C67, 2, total))
            f.write(struct.pack("<II", len(js), 0x4E4F534A))
            f.write(js)
            f.write(struct.pack("<II", len(binb), 0x004E4942))
            f.write(binb)
        return total


def export(repo, collections, meta):
    groups = {}
    order = []
    for col in collections:
        for o in col.objects:
            if o.type != "MESH" or "node" not in o.keys():
                continue
            name = o["node"]
            if name not in groups:
                groups[name] = []
                order.append(name)
            groups[name].append(_arrays(o))
    g = PlantGlb()
    counts = {}
    for name in order:
        m = _merge(groups[name])
        g.add_node(name, m)
        counts[name] = {"verts": int(len(m["pos"])), "tris": int(len(m["idx"]) // 3)}
    path = os.path.join(repo, "public", "models", "transpiration.glb")
    size = g.write_plant(
        path,
        "SocraticOS. Modelled in-house in Blender (scripts/plant-model) from botany texts and photographs of Phaseolus vulgaris; no third-party mesh.",
    )
    mpath = os.path.join(repo, "components", "visualizations", "plant-model-meta.js")
    with open(mpath, "w", encoding="utf-8", newline="\n") as f:
        f.write("// GENERATED by scripts/plant-model/build_plant.py. Do not edit.\n")
        f.write("// Scene units; each part's points are in that part's own frame (see TranspirationCanvas).\n")
        f.write("export const PLANT_MODEL = " + json.dumps(meta, separators=(",", ":")) + ";\n")
    return {"bytes": size, "nodes": counts}

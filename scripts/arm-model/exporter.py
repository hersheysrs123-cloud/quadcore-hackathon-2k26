"""Write public/models/arm.glb and components/visualizations/arm-model-meta.js.

A small hand-rolled GLB writer (numpy + json), so the file carries exactly
what the scenes read, compactly:

  POSITION  float32, in the node's rig frame (three is Y-up like the rig)
  NORMAL    int8 normalised (KHR_mesh_quantization)
  _BEND     uint8 x4 normalised (soft tissue): humerus weight, forearm
            weight, tendon (0 muscle .. 1 tendon), shade
  _FIBRE    int8 x4 normalised (soft tissue): the fibre direction at rest
  _SEG      uint8 x4 (hand and anything that follows it): segment A,
            segment B, weight of B (normalised), 0; segment 0 is the carpus
  morphs    POSITION deltas, float32: "contract" (biceps), "stretch"
            (triceps), "flex" (brachialis and brachioradialis)

Nodes, each in the frame it moves with:
  girdle    clavicle and scapula            shoulder frame, fixed
  humerus                                   humerus frame (turns at the shoulder)
  forearm   ulna, radius, carpus            forearm frame (elbow axis at the origin)
  hand      metacarpals and phalanges       forearm frame, posed per segment
  biceps, triceps, muscles                  shoulder frame at the rest pose,
                                            bent in the vertex shader
"""

import json
import os
import struct

import bpy
import numpy as np

import hand as handmod

FLOAT, UBYTE, USHORT, UINT, BYTE = 5126, 5121, 5123, 5125, 5120


def _get(me, name, n, comps=1):
    attr = me.attributes.get(name)
    if attr is None:
        return None
    vals = np.empty(n * comps, dtype=np.float32)
    attr.data.foreach_get("vector" if comps == 3 else "value", vals)
    return vals.reshape(n, comps) if comps > 1 else vals


def mesh_arrays(obj, frame_offset=(0.0, 0.0, 0.0)):
    """Triangulated arrays in rig coordinates (mesh-local space, which is
    the object's rig frame)."""
    me = obj.data
    me.calc_loop_triangles()
    nv = len(me.vertices)
    co = np.empty(nv * 3, dtype=np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    nrm = np.empty(nv * 3, dtype=np.float32)
    me.vertex_normals.foreach_get("vector", nrm)
    nrm = nrm.reshape(-1, 3)
    tri = np.empty(len(me.loop_triangles) * 3, dtype=np.int64)
    me.loop_triangles.foreach_get("vertices", tri)
    to_rig = lambda a: np.stack([a[:, 0], a[:, 2], -a[:, 1]], axis=1)
    out = {"pos": to_rig(co), "nrm": to_rig(nrm), "idx": tri}
    h = _get(me, "_humerus", nv)
    f = _get(me, "_forearm", nv)
    t = _get(me, "_tendon", nv)
    sh = _get(me, "_shade", nv)
    if h is not None:
        out["bend"] = np.stack([h, f, t, sh], axis=1)
        out["fibre"] = to_rig(_get(me, "_fibre", nv, 3))
    if me.shape_keys:
        for kb in me.shape_keys.key_blocks[1:]:
            kc = np.empty(nv * 3, dtype=np.float32)
            kb.data.foreach_get("co", kc)
            out["morph:" + kb.name] = to_rig(kc.reshape(-1, 3)) - out["pos"]
    return out


def with_segments(m, seg=None):
    """Attach _SEG: a fixed segment, or per vertex from the hand's bones."""
    n = len(m["pos"])
    if seg is not None:
        m["seg"] = np.stack([np.full(n, seg), np.zeros(n), np.zeros(n)], axis=1)
    else:
        # soft tissue is in the shoulder frame; the hand's is the forearm's
        P = m["pos"] + np.array([0.0, 3.0, 0.0], dtype=np.float32)
        A, Bs, w = handmod.segment_weights(P)
        m["seg"] = np.stack([A, Bs, w], axis=1)
    return m


def merge(parts, morphs=()):
    out = {"pos": [], "nrm": [], "idx": []}
    keys = [k for k in ("bend", "fibre", "seg") if any(k in p for p in parts)]
    for k in keys:
        out[k] = []
    for mname in morphs:
        out["morph:" + mname] = []
    base = 0
    for p in parts:
        n = len(p["pos"])
        out["pos"].append(p["pos"])
        out["nrm"].append(p["nrm"])
        out["idx"].append(p["idx"] + base)
        for k in keys:
            if k in p:
                out[k].append(p[k])
            else:
                width = {"bend": 4, "fibre": 3, "seg": 3}[k]
                fill = np.zeros((n, width), dtype=np.float32)
                if k == "bend":
                    fill[:, 3] = 0.5
                if k == "fibre":
                    fill[:, 1] = 1.0
                out[k].append(fill)
        for mname in morphs:
            out["morph:" + mname].append(p.get("morph:" + mname, np.zeros((n, 3), dtype=np.float32)))
        base += n
    return {k: np.concatenate(v) for k, v in out.items()}


class Glb:
    def __init__(self):
        self.bin = bytearray()
        self.views = []
        self.accessors = []
        self.meshes = []
        self.nodes = []

    def _view(self, data, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        view = {"buffer": 0, "byteOffset": len(self.bin), "byteLength": len(data)}
        if target:
            view["target"] = target
        self.bin.extend(data)
        self.views.append(view)
        return len(self.views) - 1

    def accessor(self, arr, gltf_type, ctype, normalized=False, target=None, minmax=False):
        v = self._view(arr.tobytes(), target)
        comps = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[gltf_type]
        count = arr.shape[0] if arr.ndim > 1 else arr.size // comps
        acc = {"bufferView": v, "componentType": ctype, "count": int(count), "type": gltf_type}
        if normalized:
            acc["normalized"] = True
        if minmax:
            a = arr.reshape(int(count), -1)[:, :comps].astype(np.float64)
            acc["min"] = a.min(axis=0).tolist()
            acc["max"] = a.max(axis=0).tolist()
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def sparse_vec3(self, arr, eps=1e-5):
        """A morph target as a sparse accessor: only the vertices it moves
        are stored (most of a merged mesh does not move at all)."""
        moved = np.nonzero(np.abs(arr).max(axis=1) > eps)[0].astype(np.uint32)
        if len(moved) == 0:
            moved = np.array([0], dtype=np.uint32)
        iv = self._view(moved.tobytes())
        vv = self._view(arr[moved].astype(np.float32).tobytes())
        acc = {
            "componentType": FLOAT,
            "count": int(len(arr)),
            "type": "VEC3",
            "min": np.minimum(arr.min(axis=0), 0).astype(float).tolist(),
            "max": np.maximum(arr.max(axis=0), 0).astype(float).tolist(),
            "sparse": {"count": int(len(moved)), "indices": {"bufferView": iv, "componentType": UINT}, "values": {"bufferView": vv}},
        }
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def _vec3_bytes(self, v, signed=True):
        """int8 x4 normalised (padded to 4 bytes for alignment)."""
        q = np.zeros((len(v), 4), dtype=np.int8)
        nn = v / np.maximum(np.linalg.norm(v, axis=1, keepdims=True), 1e-9)
        q[:, :3] = np.round(nn * 127).astype(np.int8)
        return q

    def add_mesh(self, name, m, morph_names=()):
        n = len(m["pos"])
        attrs = {"POSITION": self.accessor(m["pos"].astype(np.float32), "VEC3", FLOAT, target=34962, minmax=True)}
        attrs["NORMAL"] = self._normals(m["nrm"])
        if "bend" in m:
            b = np.round(np.clip(m["bend"], 0, 1) * 255).astype(np.uint8)
            attrs["_BEND"] = self.accessor(b, "VEC4", UBYTE, normalized=True, target=34962)
            attrs["_FIBRE"] = self.accessor(self._vec3_bytes(m["fibre"]), "VEC4", BYTE, normalized=True, target=34962)
        if "seg" in m:
            s = np.zeros((n, 4), dtype=np.uint8)
            s[:, 0] = m["seg"][:, 0].astype(np.uint8)
            s[:, 1] = m["seg"][:, 1].astype(np.uint8)
            s[:, 2] = np.round(np.clip(m["seg"][:, 2], 0, 1) * 255).astype(np.uint8)
            attrs["_SEG"] = self.accessor(s, "VEC4", UBYTE, target=34962)
        big = n >= 65536
        idx = m["idx"].astype(np.uint32 if big else np.uint16)
        prim = {"attributes": attrs, "indices": self.accessor(idx, "SCALAR", UINT if big else USHORT, target=34963)}
        mesh = {"name": name, "primitives": [prim]}
        if morph_names:
            prim["targets"] = [{"POSITION": self.sparse_vec3(m["morph:" + k].astype(np.float32))} for k in morph_names]
            mesh["weights"] = [0.0] * len(morph_names)
            mesh["extras"] = {"targetNames": list(morph_names)}
        self.meshes.append(mesh)
        self.nodes.append({"name": name, "mesh": len(self.meshes) - 1})

    def _normals(self, nrm):
        # VEC3 BYTE normalised with a 4-byte stride: write VEC4-padded data
        # into its own view and describe it as VEC3 with byteStride 4.
        q = self._vec3_bytes(nrm)
        while len(self.bin) % 4:
            self.bin.append(0)
        view = {"buffer": 0, "byteOffset": len(self.bin), "byteLength": q.nbytes, "byteStride": 4, "target": 34962}
        self.bin.extend(q.tobytes())
        self.views.append(view)
        acc = {"bufferView": len(self.views) - 1, "componentType": BYTE, "normalized": True, "count": int(len(q)), "type": "VEC3"}
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def write(self, path, copyright):
        doc = {
            "asset": {"version": "2.0", "generator": "SocraticOS arm build (scripts/arm-model)", "copyright": copyright},
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


# ─── Meta: what the scenes need to pose and label the model ───────


def hand_meta():
    segs = handmod.segments()
    out = []
    for i, s in enumerate(segs):
        if i == 0:
            out.append({"name": "carpus", "parent": -1})
            continue
        flex, abd = handmod.joint_axes(segs, i)
        spin = handmod.spin_axis(segs, i)
        r4 = lambda a: [round(float(v), 4) for v in a]
        out.append({"name": s["name"], "parent": int(s["parent"]), "pivot": r4(s["pivot"]), "flex": r4(flex), "abd": r4(abd), "spin": r4(spin)})
    poses = {}
    for pname, spec in handmod.POSES.items():
        angles = [[0, 0, 0]]
        count = {}
        for i, s in enumerate(segs):
            if i == 0:
                continue
            k = count.get(s["ray"], 0)
            count[s["ray"]] = k + 1
            ray = spec[s["ray"]]
            fl = ray["flex"][k] if k < len(ray["flex"]) else 0
            ab = ray["abd"] if k == 0 else 0
            sp = ray.get("spin", 0) if k == 0 else 0
            angles.append([fl, ab, sp])
        poses[pname] = angles
    return {"segments": out, "poses": poses}


def export(repo, col, landmarks=None, grip=None):
    objs = {o.get("part", o.name): o for o in col.objects if o.type == "MESH"}
    bones = {o.name.split(".")[0]: o for o in col.objects if o.type == "MESH" and o.get("tissue", "bone") == "bone"}
    g = Glb()

    def bone(name):
        for k, o in bones.items():
            if k == name or k.startswith(name):
                return o
        raise KeyError(name)

    g.add_mesh("girdle", mesh_arrays(bone("girdle")))
    g.add_mesh("humerus", mesh_arrays(bone("humerus")))
    g.add_mesh("forearm", merge([mesh_arrays(bone("ulna")), mesh_arrays(bone("radius")), mesh_arrays(bone("hand_carpus"))]))
    hand_parts = []
    for o in col.objects:
        if o.type == "MESH" and "seg" in o.keys() and int(o["seg"]) > 0:
            hand_parts.append(with_segments(mesh_arrays(o), seg=int(o["seg"])))
    g.add_mesh("hand", merge(hand_parts))

    def soft(name):
        m = mesh_arrays(objs[name])
        return with_segments(m) if objs[name].get("hand") else m

    g.add_mesh("biceps", merge([soft("biceps"), soft("biceps_tendon")], morphs=("contract",)), morph_names=("contract",))
    g.add_mesh("triceps", merge([soft("triceps"), soft("triceps_tendon")], morphs=("stretch",)), morph_names=("stretch",))
    used = {"biceps", "biceps_tendon", "triceps", "triceps_tendon"}
    rest = []
    for name, o in objs.items():
        if name in used or o.get("tissue") not in ("muscle", "tendon"):
            continue
        m = soft(name)
        if "morph:contract" in m:
            m["morph:flex"] = m.pop("morph:contract")
        rest.append(with_segments(m) if "seg" not in m else m)
    g.add_mesh("muscles", merge(rest, morphs=("flex",)), morph_names=("flex",))

    path = os.path.join(repo, "public", "models", "arm.glb")
    size = g.write(path, "SocraticOS. Modelled in-house in Blender from Gray's Anatomy (public domain) and standard anatomical proportions (scripts/arm-model); no third-party mesh.")

    tip = [round(float(v), 3) for v in handmod.tip_of("index", "point")]
    meta = {"indexTip": tip, "hand": hand_meta()}
    if landmarks:
        meta["landmarks"] = landmarks
    if grip:
        meta["grip"] = grip
    mpath = os.path.join(repo, "components", "visualizations", "arm-model-meta.js")
    with open(mpath, "w", encoding="utf-8", newline="\n") as f:
        f.write("// GENERATED by scripts/arm-model/build_arm.py. Do not edit.\n")
        f.write("// Rig units (dm). indexTip, hand pivots and the grip are in the forearm frame\n")
        f.write("// (elbow axis at the origin); landmarks say which frame they are in.\n")
        f.write("export const ARM_MODEL = " + json.dumps(meta, separators=(",", ":")) + ";\n")
    return {"bytes": size, "nodes": [n["name"] for n in g.nodes], "tip": tip}

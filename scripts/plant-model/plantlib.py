"""Shared helpers for the plant build (run inside Blender).

Everything is authored in SCENE coordinates: y up, in the transpiration
scene's world units, each part in its own local frame (the scene places it).
Like the arm, a scene point (x, y, z) is stored in Blender as (x, -z, y), so
the SDF mesher from scripts/arm-model can be reused as it is, and the
exporter turns it back.

Per-vertex data lives in Blender attributes on the point domain:

  col    FLOAT_COLOR  base colour (linear 0..1 in the scene's sRGB terms)
  cell   FLOAT x4     cell pattern for the fragment shader: cell size, wall
                      strength, stretch along the fibre (1 = round), 0
  sway   FLOAT x2     wind: how far this point moves (0 at the stem base),
                      and a phase, so leaves flutter out of step
  uvl    FLOAT x2     leaf coordinates (0..1 along the midrib, -1..1 across)
"""

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARM = os.path.join(HERE, "..", "arm-model")
if ARM not in sys.path:
    sys.path.insert(0, ARM)

import bmesh  # noqa: E402
import bpy  # noqa: E402
import numpy as np  # noqa: E402

import sdf  # noqa: E402,F401  (re-exported for the part builders)


def smooth(a, b, x):
    t = np.clip((np.asarray(x, dtype=np.float64) - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def hex_rgb(h):
    """'#rrggbb' -> linear-ish (0..1) floats, kept in sRGB terms: the scene
    material reads COLOR_0 as sRGB, like every colour in the palette."""
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4)])


def mix(a, b, t):
    t = np.asarray(t, dtype=np.float64)[..., None] if np.ndim(t) else t
    return a * (1 - t) + b * t


# ─── Scene plumbing ────────────────────────────────────────────────


def collection(name):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def clear(col, prefix=None):
    for obj in list(col.objects):
        if prefix and not obj.name.startswith(prefix):
            continue
        data = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if data is not None and data.users == 0 and isinstance(data, bpy.types.Mesh):
            bpy.data.meshes.remove(data)


def to_blender(V):
    V = np.asarray(V, dtype=np.float32)
    return np.stack([V[:, 0], -V[:, 2], V[:, 1]], axis=1)


def from_blender(V):
    return np.stack([V[:, 0], V[:, 2], -V[:, 1]], axis=1)


def mesh_from(name, col, V, F, node=None):
    """A mesh object from scene-space vertices and faces (triangles or quads,
    counter-clockwise seen from outside)."""
    Vb = to_blender(V)
    F = np.asarray(F, dtype=np.int32)
    k = F.shape[1]
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(Vb))
    me.vertices.foreach_set("co", Vb.ravel())
    me.loops.add(len(F) * k)
    me.loops.foreach_set("vertex_index", F.ravel())
    me.polygons.add(len(F))
    me.polygons.foreach_set("loop_start", np.arange(0, len(F) * k, k, dtype=np.int32))
    me.update(calc_edges=True)
    me.validate()
    obj = bpy.data.objects.new(name, me)
    col.objects.link(obj)
    if node:
        obj["node"] = node
    return obj


def verts(obj):
    me = obj.data
    co = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get("co", co)
    return from_blender(co.reshape(-1, 3)).astype(np.float64)


def normals(obj):
    me = obj.data
    n = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertex_normals.foreach_get("vector", n)
    return from_blender(n.reshape(-1, 3)).astype(np.float64)


def set_attr(obj, name, values):
    """A point-domain attribute: (N,) FLOAT, (N,2) FLOAT2, (N,4) FLOAT_COLOR
    for 'col', else (N,k) packed into a FLOAT_VECTOR / float4 colour."""
    me = obj.data
    v = np.asarray(values, dtype=np.float32)
    if name in me.attributes:
        me.attributes.remove(me.attributes[name])
    if v.ndim == 1:
        a = me.attributes.new(name, "FLOAT", "POINT")
        a.data.foreach_set("value", v)
    elif v.shape[1] == 2:
        a = me.attributes.new(name, "FLOAT2", "POINT")
        a.data.foreach_set("vector", v.ravel())
    elif v.shape[1] == 3:
        a = me.attributes.new(name, "FLOAT_VECTOR", "POINT")
        a.data.foreach_set("vector", v.ravel())
    else:
        a = me.attributes.new(name, "FLOAT_COLOR", "POINT")
        a.data.foreach_set("color", v.ravel())
    return a


def get_attr(obj, name):
    me = obj.data
    a = me.attributes.get(name)
    if a is None:
        return None
    n = len(me.vertices)
    kind = {"FLOAT": (1, "value"), "FLOAT2": (2, "vector"), "FLOAT_VECTOR": (3, "vector"), "FLOAT_COLOR": (4, "color")}[a.data_type]
    out = np.empty(n * kind[0], dtype=np.float32)
    a.data.foreach_get(kind[1], out)
    return out.reshape(n, kind[0]) if kind[0] > 1 else out


def paint(obj, rgb, cell=None, alpha=1.0):
    """Colour every vertex from a function of (P, N) or an array."""
    P = verts(obj)
    N = normals(obj)
    c = rgb(P, N) if callable(rgb) else np.broadcast_to(np.asarray(rgb, dtype=np.float64), (len(P), 3))
    a = alpha(P, N) if callable(alpha) else np.full(len(P), alpha)
    set_attr(obj, "col", np.concatenate([c, a[:, None]], axis=1))
    if cell is not None:
        cv = cell(P, N) if callable(cell) else np.broadcast_to(np.asarray(cell, dtype=np.float64), (len(P), 4))
        set_attr(obj, "cell", cv)
    return obj


def decimate(obj, ratio):
    """Collapse-decimate in place. Attributes are painted after this, from
    positions, so nothing has to survive the collapse."""
    if ratio >= 1:
        return obj
    mod = obj.modifiers.new("dec", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    old = obj.data
    obj.modifiers.clear()
    obj.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)
    return obj


def smooth_shade(obj):
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def triangles(obj):
    return len(obj.data.polygons)


# ─── Parametric builders ───────────────────────────────────────────


def catmull(points, n):
    """Catmull-Rom through points (each a sequence), n samples per span."""
    P = [np.asarray(p, dtype=np.float64) for p in points]
    k = len(P)
    out = []
    for i in range(k - 1):
        p0, p1, p2, p3 = P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, k - 1)]
        for s in range(n):
            t = s / n
            t2, t3 = t * t, t * t * t
            out.append(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-1])
    return np.asarray(out)


def resample(path, step):
    """A polyline resampled to roughly even spacing `step`."""
    path = np.asarray(path, dtype=np.float64)
    seg = np.linalg.norm(np.diff(path, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    n = max(2, int(math.ceil(s[-1] / step)) + 1)
    t = np.linspace(0, s[-1], n)
    return np.stack([np.interp(t, s, path[:, j]) for j in range(path.shape[1])], axis=1)


def frames(path, up=(0.0, 0.0, 1.0)):
    """Parallel-transport frames along a polyline: tangent T, normal N, binormal Bn."""
    T = np.gradient(path, axis=0)
    T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-12)
    up = np.asarray(up, dtype=np.float64)
    if abs(np.dot(up, T[0])) > 0.9:
        up = np.array([1.0, 0.0, 0.0])
    N = np.zeros_like(path)
    n0 = np.cross(T[0], up)
    N[0] = n0 / np.linalg.norm(n0)
    for i in range(1, len(path)):
        n = N[i - 1] - np.dot(N[i - 1], T[i]) * T[i]
        ln = np.linalg.norm(n)
        N[i] = n / ln if ln > 1e-9 else N[i - 1]
    Bn = np.cross(T, N)
    return T, N, Bn


def sweep(path, radius, sides=10, cap_start=True, cap_end=True, squash=None, up=(0.0, 0.0, 1.0)):
    """A tube along `path` (M,3) with per-station `radius` (M,) or a float.
    `squash` (M,) flattens the section along the normal (1 = round).
    Returns V, F, and per-vertex (t along 0..1, angle 0..1)."""
    path = np.asarray(path, dtype=np.float64)
    M = len(path)
    r = np.broadcast_to(np.asarray(radius, dtype=np.float64), (M,))
    sq = np.ones(M) if squash is None else np.broadcast_to(np.asarray(squash, dtype=np.float64), (M,))
    T, N, Bn = frames(path, up)
    a = np.linspace(0, 2 * math.pi, sides, endpoint=False)
    ca, sa = np.cos(a), np.sin(a)
    V = path[:, None, :] + r[:, None, None] * (ca[None, :, None] * N[:, None, :] * sq[:, None, None] + sa[None, :, None] * Bn[:, None, :])
    V = V.reshape(-1, 3)
    seg = np.linalg.norm(np.diff(path, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    tt = np.repeat(s / max(s[-1], 1e-9), sides)
    aa = np.tile(np.arange(sides) / sides, M)
    F = []
    for i in range(M - 1):
        for j in range(sides):
            j2 = (j + 1) % sides
            a0, a1, b0, b1 = i * sides + j, i * sides + j2, (i + 1) * sides + j, (i + 1) * sides + j2
            F.append([a0, a1, b1, b0])
    F = np.asarray(F)
    # The winding above faces outward when N x Bn = T; flip if not.
    if np.dot(np.cross(N[0], Bn[0]), T[0]) < 0:
        F = F[:, ::-1]
    extraV, extraF, extraT, extraA = [], [], [], []
    base = len(V)

    def cap(i, sign, t_at):
        nonlocal base
        # A dome of two rings so a root tip is rounded, not a flat disc.
        c = path[i]
        rr = r[i]
        ring0 = i * sides
        pts = []
        for k, (f, h) in enumerate([(0.72, 0.55), (0.0, 1.0)]):
            if f == 0.0:
                pts.append(c + sign * T[i] * rr * h)
            else:
                ring = c + sign * T[i] * rr * h * 0.62 + rr * f * (ca[:, None] * N[i] * sq[i] + sa[:, None] * Bn[i])
                pts.append(ring)
        ring1 = np.asarray(pts[0])
        tip = np.asarray(pts[1])
        i1 = base
        extraV.append(ring1)
        extraT.append(np.full(sides, t_at))
        extraA.append(np.arange(sides) / sides)
        base += sides
        it = base
        extraV.append(tip[None, :])
        extraT.append([t_at])
        extraA.append([0.0])
        base += 1
        for j in range(sides):
            j2 = (j + 1) % sides
            quad = [ring0 + j, ring0 + j2, i1 + j2, i1 + j]
            tri = [i1 + j, i1 + j2, it]
            if sign < 0:
                quad = quad[::-1]
                tri = tri[::-1]
            extraF.append(quad)
            extraF.append(tri + [tri[-1]])  # degenerate quad == triangle

    if cap_end:
        cap(M - 1, 1.0, 1.0)
    if cap_start:
        cap(0, -1.0, 0.0)
    if extraV:
        V = np.concatenate([V] + [np.asarray(e).reshape(-1, 3) for e in extraV])
        F = np.concatenate([F, np.asarray(extraF)])
        tt = np.concatenate([tt] + [np.asarray(e, dtype=np.float64) for e in extraT])
        aa = np.concatenate([aa] + [np.asarray(e, dtype=np.float64) for e in extraA])
    return V, F, tt, aa


def quads_to_tris(F):
    """Split quads (dropping the degenerate half of cap triangles)."""
    F = np.asarray(F)
    if F.shape[1] == 3:
        return F
    t1 = F[:, [0, 1, 2]]
    t2 = F[:, [0, 2, 3]]
    keep2 = F[:, 3] != F[:, 2]
    return np.concatenate([t1, t2[keep2]])


def combine(parts):
    """Concatenate (V, F, extra...) tuples into one; extras concatenate too."""
    Vs, Fs, extras = [], [], None
    base = 0
    for p in parts:
        V, F = p[0], quads_to_tris(p[1])
        Vs.append(V)
        Fs.append(F + base)
        base += len(V)
        if len(p) > 2:
            if extras is None:
                extras = [[] for _ in p[2:]]
            for k, e in enumerate(p[2:]):
                extras[k].append(np.asarray(e))
    out = [np.concatenate(Vs), np.concatenate(Fs)]
    if extras:
        out += [np.concatenate(e) for e in extras]
    return out


def ellipsoid_mesh(c, r, R=np.eye(3), nu=10, nv=7):
    """A UV ellipsoid (for chloroplasts, nodules, grains): centre c, radii r,
    rotation R (columns are the axes)."""
    u = np.linspace(0, 2 * math.pi, nu, endpoint=False)
    v = np.linspace(-math.pi / 2, math.pi / 2, nv)[1:-1]
    U, W = np.meshgrid(u, v, indexing="ij")
    pts = np.stack([np.cos(W) * np.cos(U), np.sin(W), np.cos(W) * np.sin(U)], axis=-1).reshape(-1, 3)
    pts = np.concatenate([pts, [[0, -1, 0], [0, 1, 0]]])
    V = (pts * np.asarray(r)) @ np.asarray(R).T + np.asarray(c)
    nvv = len(v)
    F = []
    for i in range(nu):
        i2 = (i + 1) % nu
        for j in range(nvv - 1):
            F.append([i * nvv + j, i * nvv + j + 1, i2 * nvv + j + 1, i2 * nvv + j])
        s = nu * nvv
        F.append([i * nvv, i2 * nvv, s, s])
        F.append([i2 * nvv + nvv - 1, i * nvv + nvv - 1, s + 1, s + 1])
    return V, np.asarray(F)


def rot_to(a, b):
    """Rotation matrix taking unit vector a to unit vector b."""
    a = np.asarray(a, dtype=np.float64) / np.linalg.norm(a)
    b = np.asarray(b, dtype=np.float64) / np.linalg.norm(b)
    v = np.cross(a, b)
    c = float(np.dot(a, b))
    if c < -0.9999:
        return -np.eye(3)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + K + K @ K / (1 + c)


def rng(seed):
    return np.random.default_rng(seed)

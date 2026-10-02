"""Shared helpers for build_arm.py (run inside Blender).

Everything is authored in the ARM RIG's frame (components/visualizations/
arm-rig.jsx): decimetres, the humeral head's centre at the origin, the arm
hanging down -Y, +X anterior, +Z medial. Blender is Z-up and the glTF exporter
turns Blender (x, y, z) into glTF (x, z, -y), so a rig point (X, Y, Z) is
stored in Blender as (X, -Z, Y).
"""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector


def B(p):
    """Rig (X, Y, Z) -> Blender vector."""
    return Vector((p[0], -p[2], p[1]))


def vadd(a, b, s=1.0):
    return (a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s)


def lerp3(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ─── Scene plumbing ────────────────────────────────────────────────


def collection(name):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def clear_collection(name):
    col = bpy.data.collections.get(name)
    if col is None:
        return
    for obj in list(col.all_objects):
        data = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if data is not None and data.users == 0 and isinstance(data, bpy.types.Mesh):
            bpy.data.meshes.remove(data)
    for child in list(col.children):
        clear_collection(child.name)
        bpy.data.collections.remove(child)


def mesh_object(name, bm, col):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    col.objects.link(obj)
    return obj


def apply_modifiers(obj):
    """Bake the modifier stack into the mesh, in place."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    old = obj.data
    obj.modifiers.clear()
    obj.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)
    return obj


# ─── Primitive builders (append into a bmesh, rig coordinates) ──────


def add_ellipsoid(bm, centre, radii, rot=(0, 0, 0), segs=32, rings=20):
    """An ellipsoid; `rot` is an XYZ Euler in RIG axes (radians)."""
    m = bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    verts = m["verts"]
    rx, ry, rz = radii
    from mathutils import Euler

    e = Euler(rot, "XYZ").to_matrix()
    for v in verts:
        p = Vector((v.co.x * rx, v.co.y * ry, v.co.z * rz))  # rig axes
        p = e @ p
        v.co = B((p.x + centre[0], p.y + centre[1], p.z + centre[2]))
    return verts


def catmull(points, n):
    """Catmull-Rom through `points` (tuples of any equal length), n samples per span."""
    out = []
    k = len(points)
    for i in range(k - 1):
        p0 = points[max(i - 1, 0)]
        p1 = points[i]
        p2 = points[i + 1]
        p3 = points[min(i + 2, k - 1)]
        for s in range(n):
            t = s / n
            t2 = t * t
            t3 = t2 * t
            out.append(
                tuple(
                    0.5
                    * (
                        2 * p1[j]
                        + (-p0[j] + p2[j]) * t
                        + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                        + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3
                    )
                    for j in range(len(p1))
                )
            )
    out.append(tuple(points[-1]))
    return out


def add_sweep(bm, stations, ref=(1, 0, 0), segs=28, per_span=6, power=2.0, cap=True):
    """
    A closed tube through `stations`, each (x, y, z, ra, rb[, twist]) in rig
    units: `ra` is the half-width along `ref` (projected square to the path),
    `rb` the half-width across it. `power` > 2 squares the section off
    (superellipse). Ends are closed with a pole, so the result is manifold.
    """
    rows = catmull([tuple(s) + ((0.0,) if len(s) == 5 else ()) for s in stations], per_span)
    ref = Vector(ref)
    rings = []
    for i, r in enumerate(rows):
        c = Vector(r[:3])
        a = Vector(rows[min(i + 1, len(rows) - 1)][:3]) - Vector(rows[max(i - 1, 0)][:3])
        t = a.normalized()
        u = (ref - t * ref.dot(t)).normalized()
        w = t.cross(u)
        tw = r[5]
        cu, su = math.cos(tw), math.sin(tw)
        u, w = u * cu + w * su, w * cu - u * su
        ring = []
        for k in range(segs):
            th = 2 * math.pi * k / segs
            ct, st = math.cos(th), math.sin(th)
            # superellipse
            ex = math.copysign(abs(ct) ** (2 / power), ct)
            ey = math.copysign(abs(st) ** (2 / power), st)
            p = c + u * (ex * max(r[3], 1e-4)) + w * (ey * max(r[4], 1e-4))
            ring.append(bm.verts.new(B(p)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for k in range(segs):
            bm.faces.new((a[k], a[(k + 1) % segs], b[(k + 1) % segs], b[k]))
    if cap:
        for ring, rev in ((rings[0], True), (rings[-1], False)):
            c = sum((v.co for v in ring), Vector()) / len(ring)
            pole = bm.verts.new(c)
            for k in range(segs):
                q = (ring[k], ring[(k + 1) % segs], pole)
                bm.faces.new(q[::-1] if rev else q)
    return rings


def add_spool(bm, centre, axis_len, profile, segs=36):
    """A surface of revolution about the rig Z axis (the elbow's hinge axis):
    `profile` is [(z_offset, radius), ...] from one end to the other."""
    cx, cy, cz = centre
    st = [(cx, cy, cz + dz, r, r) for dz, r in profile]
    return add_sweep(bm, st, ref=(1, 0, 0), segs=segs, per_span=4)


# ─── Modifier helpers ──────────────────────────────────────────────


def remesh(obj, voxel, smooth_iters=0, smooth_factor=0.5):
    m = obj.modifiers.new("remesh", "REMESH")
    m.mode = "VOXEL"
    m.voxel_size = voxel
    m.adaptivity = 0.0
    m.use_smooth_shade = True
    if smooth_iters:
        s = obj.modifiers.new("smooth", "SMOOTH")
        s.factor = smooth_factor
        s.iterations = smooth_iters
    apply_modifiers(obj)


def boolean(obj, cutter_bm, op="DIFFERENCE"):
    cut = mesh_object(obj.name + "_cut", cutter_bm, obj.users_collection[0])
    m = obj.modifiers.new("bool", "BOOLEAN")
    m.operation = op
    m.object = cut
    m.solver = "EXACT"
    apply_modifiers(obj)
    me = cut.data
    bpy.data.objects.remove(cut, do_unlink=True)
    bpy.data.meshes.remove(me)


def noise_texture(name, kind="CLOUDS", size=0.25, depth=2):
    tex = bpy.data.textures.get(name) or bpy.data.textures.new(name, kind)
    if kind == "CLOUDS":
        tex.noise_scale = size
        tex.noise_depth = depth
    elif kind == "VORONOI":
        tex.noise_scale = size
    elif kind == "STUCCI":
        tex.noise_scale = size
    return tex


def displace(obj, tex, strength, coords_obj=None, midlevel=0.5):
    m = obj.modifiers.new("disp", "DISPLACE")
    m.texture = tex
    m.strength = strength
    m.mid_level = midlevel
    if coords_obj is not None:
        m.texture_coords = "OBJECT"
        m.texture_coords_object = coords_obj
    apply_modifiers(obj)


def decimate(obj, ratio):
    m = obj.modifiers.new("dec", "DECIMATE")
    m.ratio = ratio
    apply_modifiers(obj)


def smooth(obj, iters=4, factor=0.5):
    s = obj.modifiers.new("smooth", "SMOOTH")
    s.factor = factor
    s.iterations = iters
    apply_modifiers(obj)


def shade_smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def set_point_attr(obj, name, fn):
    """A float point attribute from fn(rig_xyz) -> float."""
    me = obj.data
    attr = me.attributes.get(name) or me.attributes.new(name, "FLOAT", "POINT")
    for i, v in enumerate(me.vertices):
        co = v.co
        attr.data[i].value = fn((co.x, co.z, -co.y))


def rig_co(v):
    return (v.co.x, v.co.z, -v.co.y)

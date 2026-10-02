"""Signed-distance sculpting in numpy, meshed with OpenVDB (both ship with Blender).

A shape is a function of an (N, 3) array of RIG points returning N signed
distances (negative inside). Shapes are combined with smooth unions and
subtractions, which is what lets a tubercle grow out of a bone instead of
sitting on it like a ball of clay. `mesh_sdf` samples the field on a grid
and extracts the zero level set as quads.
"""

import math

import bmesh
import bpy
import numpy as np
import openvdb

from armlib import B, mesh_object

# ─── Combinators ───────────────────────────────────────────────────


def smin(a, b, k):
    """Polynomial smooth minimum; only the samples within k of a tie change."""
    out = np.minimum(a, b)
    if k <= 0:
        return out
    m = np.abs(a - b) < k
    if m.any():
        am, bm = a[m], b[m]
        h = 0.5 + 0.5 * (bm - am) / k
        out[m] = bm * (1 - h) + am * h - k * h * (1 - h)
    return out


def smax(a, b, k):
    return -smin(-a, -b, k)


def cut(a, b, k):
    """a minus b, with a rounded edge k wide."""
    return smax(a, -b, k)


# ─── Primitives ────────────────────────────────────────────────────

MARGIN = 0.12  # beyond a primitive's box, its distance is reported as this


_SORTED = {"id": None, "y": None}


def evaluate(field, P):
    """Evaluate field(P) with P sorted by height, so each primitive's box
    test (`_boxed`) scans only the slab of points at its own heights."""
    order = np.argsort(P[:, 1], kind="stable")
    Ps = np.ascontiguousarray(P[order])
    _SORTED["id"] = id(Ps)
    _SORTED["y"] = np.ascontiguousarray(Ps[:, 1])
    try:
        d = field(Ps)
    finally:
        _SORTED["id"] = None
        _SORTED["y"] = None
    out = np.empty(len(P), dtype=np.float64)
    out[order] = d
    return out


def _boxed(P, lo, hi, fn):
    """Evaluate fn only on points inside the box [lo, hi] grown by MARGIN.
    Outside it the true distance is at least MARGIN, which is all a smooth
    blend narrower than MARGIN needs to know."""
    lo = np.asarray(lo, dtype=np.float64) - MARGIN
    hi = np.asarray(hi, dtype=np.float64) + MARGIN
    out = np.full(len(P), MARGIN)
    if id(P) == _SORTED["id"]:
        y = _SORTED["y"]
        i0 = int(np.searchsorted(y, lo[1], "left"))
        i1 = int(np.searchsorted(y, hi[1], "right"))
        if i1 <= i0:
            return out
        sub = P[i0:i1]
        m = (sub[:, 0] >= lo[0]) & (sub[:, 0] <= hi[0]) & (sub[:, 2] >= lo[2]) & (sub[:, 2] <= hi[2])
        if m.any():
            idx = np.nonzero(m)[0] + i0
            out[idx] = fn(P[idx])
        return out
    m = np.all((P >= lo) & (P <= hi), axis=1)
    if m.any():
        out[m] = fn(P[m])
    return out


def ellipsoid(P, c, r, rot=(0, 0, 0)):
    """Inigo Quilez's bound for an ellipsoid (good near the surface)."""
    e = max(r)
    return _boxed(P, np.asarray(c) - e, np.asarray(c) + e, lambda Q: _ellipsoid(Q, c, r, rot))


def _rot(rot):
    """The rotation matrix of an XYZ Euler in rig axes (radians), as
    armlib.add_ellipsoid and Blender's Euler(rot, "XYZ") build it: X first,
    then Y, then Z."""
    x, y, z = rot
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def _ellipsoid(P, c, r, rot):
    q = P - np.asarray(c)
    if any(rot):
        q = q @ _rot(rot)  # into the ellipsoid's frame (R^T p, row-vector form)
    r = np.asarray(r, dtype=np.float64)
    k0 = np.linalg.norm(q / r, axis=1)
    k1 = np.linalg.norm(q / (r * r), axis=1)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


def sphere(P, c, r):
    return _boxed(P, np.asarray(c) - r, np.asarray(c) + r, lambda Q: np.linalg.norm(Q - np.asarray(c), axis=1) - r)


def round_cone(P, a, b, ra, rb):
    """Exact distance to a cone capped by spheres (IQ), a->b with radii ra, rb."""
    r = max(ra, rb)
    lo = np.minimum(a, b) - r
    hi = np.maximum(a, b) + r
    return _boxed(P, lo, hi, lambda Q: _round_cone(Q, a, b, ra, rb))


def _round_cone(P, a, b, ra, rb):
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    ba = b - a
    l2 = ba @ ba
    rr = ra - rb
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pa = P - a
    y = pa @ ba
    z = y - l2
    xv = pa * l2 - np.outer(y, ba)
    x2 = np.einsum("ij,ij->i", xv, xv)
    y2 = y * y * l2
    z2 = z * z * l2
    k = math.copysign(1.0, rr) * rr * rr * x2
    out = (np.sqrt(x2 * a2 * il2) + y * rr) * il2 - ra
    m1 = np.sign(z) * a2 * z2 > k
    m2 = np.sign(y) * a2 * y2 < k
    out = np.where(m1, np.sqrt(x2 + z2) * il2 - rb, out)
    out = np.where(m2 & ~m1, np.sqrt(x2 + y2) * il2 - ra, out)
    return out


def capsule(P, a, b, ra, rb):
    """A capsule whose radius runs linearly from ra to rb: cheaper than the
    exact round cone and indistinguishable when the radius changes slowly
    along the segment, which is the case for every chain `tube` builds."""
    r = max(ra, rb)
    return _boxed(P, np.minimum(a, b) - r, np.maximum(a, b) + r, lambda Q: _capsule(Q, a, b, ra, rb))


def _capsule(P, a, b, ra, rb):
    a = np.asarray(a, dtype=P.dtype)
    ba = np.asarray(b, dtype=P.dtype) - a
    pa = P - a
    t = np.clip((pa @ ba) / (ba @ ba), 0.0, 1.0)
    q = pa - t[:, None] * ba
    return np.sqrt(np.einsum("ij,ij->i", q, q)) - (ra + (rb - ra) * t)


def cylinder(P, a, b, r):
    """A flat-ended cylinder from a to b (IQ's capped cylinder)."""
    lo = np.minimum(a, b) - r
    hi = np.maximum(a, b) + r
    return _boxed(P, lo, hi, lambda Q: _cylinder(Q, a, b, r))


def _cylinder(P, a, b, r):
    a = np.asarray(a, dtype=np.float64)
    ba = np.asarray(b, dtype=np.float64) - a
    pa = P - a
    baba = ba @ ba
    paba = pa @ ba
    xv = pa * baba - np.outer(paba, ba)
    x = np.sqrt(np.einsum("ij,ij->i", xv, xv)) - r * baba
    y = np.abs(paba - baba * 0.5) - baba * 0.5
    x2 = x * x
    y2 = y * y * baba
    inside = np.maximum(x, y) < 0
    d = np.where(inside, -np.minimum(x2, y2), np.where(x > 0, x2, 0) + np.where(y > 0, y2, 0))
    return np.sign(d) * np.sqrt(np.abs(d)) / baba


def _catmull(points, n):
    out = []
    k = len(points)
    for i in range(k - 1):
        p0, p1, p2, p3 = points[max(i - 1, 0)], points[i], points[i + 1], points[min(i + 2, k - 1)]
        for s in range(n):
            t = s / n
            t2, t3 = t * t, t * t * t
            out.append(
                [
                    0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)
                    for j in range(len(p1))
                ]
            )
    out.append(list(points[-1]))
    return out


def tube(P, stations, per_span=3, k=0.0):
    """A smooth tube through stations (x, y, z, r): a chain of round cones
    along a Catmull-Rom spline."""
    pts = _catmull([list(s) for s in stations], per_span)
    d = None
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        if math.dist(a[:3], b[:3]) < 1e-6:
            continue
        s = capsule(P, a[:3], b[:3], a[3], b[3])
        d = s if d is None else (np.minimum(d, s) if k <= 0 else smin(d, s, k))
    return d


def flat_tube(P, stations, direction, squash, per_span=3, k=0.0):
    """A tube whose section is squashed to `squash` (<1) along `direction`
    (flattened tendons, the distal humerus). Distances are approximate."""
    d = np.asarray(direction, dtype=np.float64)
    d /= np.linalg.norm(d)
    c = np.asarray(stations[0][:3], dtype=np.float64)
    stretch = 1.0 / squash

    def T(X):
        # Stretch space along d: a round tube there is flat here.
        return X + np.outer(((X - c) @ d) * (stretch - 1.0), d)

    centres = T(np.asarray([s[:3] for s in stations], dtype=np.float64))
    st = [(*centres[i], s[3]) for i, s in enumerate(stations)]
    return tube(T(P), st, per_span, k) * squash


def torus_z(P, c, R, r):
    """A torus around an axis parallel to rig Z through c."""
    e = np.array([R + r, R + r, r])
    return _boxed(P, np.asarray(c) - e, np.asarray(c) + e, lambda Q: _torus_z(Q, c, R, r))


def _torus_z(P, c, R, r):
    q = P - np.asarray(c)
    xy = np.sqrt(q[:, 0] ** 2 + q[:, 1] ** 2) - R
    return np.sqrt(xy * xy + q[:, 2] ** 2) - r


# ─── Noise ─────────────────────────────────────────────────────────


def _hash(ix, iy, iz, seed):
    h = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791) ^ (seed * 2654435761)
    h = (h ^ (h >> 13)) * 1274126177
    h = h ^ (h >> 16)
    return (h & 0xFFFF).astype(np.float64) / 65535.0


def value_noise(P, scale, seed=0):
    """Smooth value noise in [-1, 1]; `scale` may be a 3-vector (anisotropic)."""
    q = P / np.asarray(scale, dtype=np.float64)
    i = np.floor(q).astype(np.int64)
    f = q - i
    f = f * f * (3 - 2 * f)
    out = 0.0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (f[:, 0] if dx else 1 - f[:, 0]) * (f[:, 1] if dy else 1 - f[:, 1]) * (f[:, 2] if dz else 1 - f[:, 2])
                out = out + w * _hash(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz, seed)
    return out * 2 - 1


def roughen(d, P, amplitude, scale, seed=0, octaves=2):
    """Add fbm to a field only near its surface (where it can show)."""
    m = np.abs(d) < 4 * amplitude + 0.004
    if m.any():
        d = d.copy()
        d[m] += amplitude * fbm(P[m], scale, octaves, seed)
    return d


def fbm(P, scale, octaves=3, seed=0):
    s = np.asarray(scale, dtype=np.float64)
    amp, tot, out = 1.0, 0.0, 0.0
    for o in range(octaves):
        out = out + amp * value_noise(P, s, seed + o * 17)
        tot += amp
        amp *= 0.5
        s = s * 0.5
    return out / tot


# ─── Meshing ───────────────────────────────────────────────────────


def grid_points(lo, hi, voxel):
    lo = np.asarray(lo, dtype=np.float64)
    hi = np.asarray(hi, dtype=np.float64)
    n = np.ceil((hi - lo) / voxel).astype(int) + 1
    xs = lo[0] + np.arange(n[0]) * voxel
    ys = lo[1] + np.arange(n[1]) * voxel
    zs = lo[2] + np.arange(n[2]) * voxel
    X, Y, Z = np.meshgrid(xs, ys, zs, indexing="ij")
    P = np.stack([X.ravel(), Y.ravel(), Z.ravel()], axis=1).astype(np.float32)
    return P, tuple(int(v) for v in n), lo


def sample_band(field, lo, hi, voxel, coarse=4):
    """Sample the field on the fine grid only near its surface.

    A pass on a grid `coarse` times coarser finds where the surface is; fine
    samples further than ~2.5 coarse cells from it just take the coarse sign.
    A distance field changes by at most its step between samples, so nothing
    within the band is missed (the smooth blends are bounds, close enough)."""
    origin = np.asarray(lo, dtype=np.float64)
    n = tuple(int(v) for v in np.ceil((np.asarray(hi) - origin) / voxel).astype(int) + 1)
    ix = np.arange(n[0]) // coarse
    iy = np.arange(n[1]) // coarse
    iz = np.arange(n[2]) // coarse
    cx = np.unique(ix)
    cy = np.unique(iy)
    cz = np.unique(iz)
    C = np.stack(
        np.meshgrid(origin[0] + (cx * coarse + coarse / 2) * voxel, origin[1] + (cy * coarse + coarse / 2) * voxel, origin[2] + (cz * coarse + coarse / 2) * voxel, indexing="ij"),
        axis=-1,
    ).reshape(-1, 3)
    dc = evaluate(field, C).reshape(len(cx), len(cy), len(cz)).astype(np.float32)
    far = np.float32(2.5 * coarse * voxel)
    near = dc[np.ix_(ix, iy, iz)]  # (n0, n1, n2) float32: the coarse value over each fine sample
    band = np.abs(near) < far
    d = np.where(near > 0, far, -far).astype(np.float32)
    # Coordinates only for the band samples (the full grid can be 10M+).
    bi, bj, bk = np.nonzero(band)
    P = np.stack([origin[0] + bi * voxel, origin[1] + bj * voxel, origin[2] + bk * voxel], axis=1).astype(np.float32)
    d[bi, bj, bk] = evaluate(field, P)
    return d, n, origin


def mesh_sdf(name, col, field, lo, hi, voxel):
    """Sample `field(P)` over the box [lo, hi] (rig units) and mesh its zero set."""
    d, n, origin = sample_band(field, lo, hi, voxel)
    grid = openvdb.FloatGrid(1e3)
    grid.copyFromArray(d)
    grid.transform = openvdb.createLinearTransform(voxelSize=voxel)
    pts, quads = grid.convertToQuads(isovalue=0.0)
    pts = pts + origin  # index space * voxel -> rig
    # Rig (X, Y, Z) -> Blender (X, -Z, Y): a proper rotation, so the winding holds.
    verts = np.stack([pts[:, 0], -pts[:, 2], pts[:, 1]], axis=1).astype(np.float32)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(verts))
    me.vertices.foreach_set("co", verts.ravel())
    nq = len(quads)
    me.loops.add(nq * 4)
    me.loops.foreach_set("vertex_index", quads.astype(np.int32).ravel())
    me.polygons.add(nq)
    me.polygons.foreach_set("loop_start", np.arange(0, nq * 4, 4, dtype=np.int32))
    me.update(calc_edges=True)
    me.validate()
    obj = bpy.data.objects.new(name, me)
    col.objects.link(obj)
    # OpenVDB's quads face inwards for a negative-inside field: flip if so.
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    return obj


# ─── Plates ────────────────────────────────────────────────────────


def polygon2d(px, py, poly):
    """Signed distance to a closed 2D polygon, vectorised (IQ)."""
    poly = np.asarray(poly, dtype=np.float64)
    n = len(poly)
    d = (px - poly[0, 0]) ** 2 + (py - poly[0, 1]) ** 2
    s = np.ones_like(px)
    j = n - 1
    for i in range(n):
        vi, vj = poly[i], poly[j]
        ex, ey = vj[0] - vi[0], vj[1] - vi[1]
        wx, wy = px - vi[0], py - vi[1]
        t = np.clip((wx * ex + wy * ey) / (ex * ex + ey * ey), 0.0, 1.0)
        bx, by = wx - ex * t, wy - ey * t
        d = np.minimum(d, bx * bx + by * by)
        c1 = py >= vi[1]
        c2 = py < vj[1]
        c3 = ex * wy > ey * wx
        flip = (c1 & c2 & c3) | (~c1 & ~c2 & ~c3)
        s = np.where(flip, -s, s)
        j = i
    return s * np.sqrt(d)


def plate(P, origin, u, v, poly, half, thicken=None, per_span=3):
    """A plate in the plane through `origin` spanned by unit vectors u, v:
    the (u, v) polygon `poly` (smoothed through a Catmull-Rom loop) extruded
    to +-`half` along u x v. `thicken(a, b)` may return an extra half-depth
    per point (a thick rim, a boss)."""
    o = np.asarray(origin, dtype=np.float64)
    u = np.asarray(u, dtype=np.float64)
    v = np.asarray(v, dtype=np.float64)
    nrm = np.cross(u, v)
    loop = list(poly) + [poly[0], poly[1], poly[2]]
    sm = _catmull([list(p) for p in loop], per_span)
    sm = sm[per_span : per_span * (len(poly) + 1)]
    pts2 = np.asarray(sm)
    lo2 = pts2.min(axis=0)
    hi2 = pts2.max(axis=0)
    corners = [o + u * a + v * b for a in (lo2[0], hi2[0]) for b in (lo2[1], hi2[1])]
    extra = 0.1
    lo = np.min(corners, axis=0) - half - extra
    hi = np.max(corners, axis=0) + half + extra

    def f(Q):
        q = Q - o
        a = q @ u
        b = q @ v
        c = q @ nrm
        d2 = polygon2d(a, b, pts2)
        h = half if thicken is None else half + thicken(a, b)
        dz = np.abs(c) - h
        outside = np.sqrt(np.maximum(d2, 0) ** 2 + np.maximum(dz, 0) ** 2)
        return np.minimum(np.maximum(d2, dz), 0) + outside

    return _boxed(P, lo, hi, f)


# ─── Cached fields ─────────────────────────────────────────────────


class GridField:
    """A field sampled once on a band-limited grid (sample_band) and read
    back by trilinear interpolation: how a muscle asks about its
    neighbours and the bones cheaply. Beyond the band the grid holds +-far,
    outside the box `outside`."""

    def __init__(self, field, lo, hi, voxel, outside=None):
        d, n, origin = sample_band(field, lo, hi, voxel, coarse=3)
        self.d = d.astype(np.float32)
        self.n = np.asarray(n)
        self.origin = np.asarray(origin, dtype=np.float64)
        self.voxel = float(voxel)
        self.outside = float(outside if outside is not None else MARGIN)
        self.lo = self.origin
        self.hi = self.origin + (self.n - 1) * self.voxel

    def __call__(self, P):
        g = (np.asarray(P, dtype=np.float64) - self.origin) / self.voxel
        out = np.full(len(P), self.outside)
        inside = np.all((g >= 0) & (g <= self.n - 1.0001), axis=1)
        if not inside.any():
            return out
        q = g[inside]
        i0 = np.floor(q).astype(np.int64)
        f = q - i0
        d = self.d
        acc = 0.0
        for dx in (0, 1):
            for dy in (0, 1):
                for dz in (0, 1):
                    w = (f[:, 0] if dx else 1 - f[:, 0]) * (f[:, 1] if dy else 1 - f[:, 1]) * (f[:, 2] if dz else 1 - f[:, 2])
                    acc = acc + w * d[i0[:, 0] + dx, i0[:, 1] + dy, i0[:, 2] + dz]
        out[inside] = acc
        return out

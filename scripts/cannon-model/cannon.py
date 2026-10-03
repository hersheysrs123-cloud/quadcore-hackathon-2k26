"""The projectile scene's cannon: a bronze barrel on an oak garrison carriage
with iron trucks (see README.md).

Everything is in the projectile scene's units. The barrel is in its own frame:
the trunnion axis is the z axis, the bore runs along +x, and the scene turns
it to the launch angle about that axis. The carriage is in the scene's frame:
the trunnions sit at (0, LAUNCH_Y, 0), the runway starts at x = 0, and the
ground is y = 0.

Parts are explicit meshes (lathes, extrusions, sweeps), not signed-distance
fields: a cannon is turned and sawn, and its edges should be crisp.
"""

import math

import bmesh
import numpy as np

# ─── The scene's numbers (components/visualizations/PhysicsCanvas.jsx) ───

RUNWAY_TOP_Y = 0.28
BALL_RADIUS = 0.13
LAUNCH_Y = RUNWAY_TOP_Y + BALL_RADIUS
#: the runway deck occupies x >= 0, |z| <= RUNWAY_HALF, y <= RUNWAY_TOP_Y
RUNWAY_HALF = 0.36

# ─── Barrel ─────────────────────────────────────────────────────────

BORE_R = 0.14
MUZZLE_X = 0.6
#: cheek faces either side of the barrel
CHEEK_IN = 0.235
CHEEK_OUT = 0.285
TRUNNION_R = 0.05

BRONZE = np.array([0.74, 0.53, 0.3])
BORE_DARK = np.array([0.09, 0.07, 0.05])
OAK = np.array([0.5, 0.33, 0.19])
IRON = np.array([0.15, 0.15, 0.16])

# (x, r): the barrel's outline from the cascabel's button to the muzzle, then
# back down the bore. Steps between rings come out crisp (`crisp` splits any
# corner sharper than 40 degrees); the gentle curves stay smooth.
BARREL_PROFILE = [
    (-0.300, 0.000),
    (-0.297, 0.020),
    (-0.287, 0.035),
    (-0.270, 0.041),
    (-0.254, 0.035),
    (-0.244, 0.024),
    (-0.236, 0.024),
    (-0.228, 0.040),
    (-0.221, 0.075),
    (-0.214, 0.115),
    (-0.204, 0.152),
    (-0.190, 0.181),
    (-0.175, 0.199),
    (-0.165, 0.207),
    # base ring
    (-0.165, 0.214),
    (-0.140, 0.214),
    (-0.140, 0.205),
    # base ring's fillet, then the first reinforce
    (-0.132, 0.205),
    (-0.132, 0.199),
    (0.108, 0.193),
    # first reinforce ring
    (0.108, 0.199),
    (0.124, 0.199),
    (0.124, 0.191),
    # second reinforce
    (0.255, 0.184),
    (0.255, 0.178),
    # chase astragal: a bead between two fillets
    (0.262, 0.178),
    (0.262, 0.181),
    (0.268, 0.187),
    (0.274, 0.181),
    (0.274, 0.178),
    (0.280, 0.178),
    (0.280, 0.175),
    # the chase tapers to the neck, then swells to the muzzle
    (0.420, 0.168),
    (0.500, 0.163),
    (0.535, 0.166),
    (0.560, 0.174),
    (0.578, 0.179),
    (0.590, 0.177),
    (0.597, 0.170),
    (0.600, 0.162),
    (0.600, 0.150),
    (0.596, 0.142),
    (0.588, 0.140),
    # the bore, to its rounded bottom
    (-0.040, 0.140),
    (-0.052, 0.128),
    (-0.060, 0.100),
    (-0.064, 0.000),
]
#: profile points from here on are the bore (painted dark)
BORE_FROM = 41


def _outward(V, F):
    """Flip F so a closed mesh faces out (positive signed volume)."""
    t = V[F[:, :3]]
    if np.einsum("ij,ij->i", t[:, 0], np.cross(t[:, 1], t[:, 2])).sum() < 0:
        F = F[:, ::-1]
    return F


def lathe(profile, axis="x", segs=72):
    """A surface of revolution from (along, radius) pairs about the x, y or z
    axis through the origin. Returns V, F (triangles) and each vertex's
    profile index."""
    prof = np.asarray([(p[0], p[1]) for p in profile], dtype=np.float64)
    a = np.linspace(0, 2 * np.pi, segs, endpoint=False)
    ca, sa = np.cos(a), np.sin(a)
    rows = []
    for s, r in prof:
        if axis == "x":
            rows.append(np.stack([np.full(segs, s), r * ca, r * sa], axis=1))
        elif axis == "y":
            rows.append(np.stack([r * sa, np.full(segs, s), r * ca], axis=1))
        else:
            rows.append(np.stack([r * ca, r * sa, np.full(segs, s)], axis=1))
    V = np.concatenate(rows)
    F = []
    for i in range(len(prof) - 1):
        for j in range(segs):
            p = i * segs + j
            q = i * segs + (j + 1) % segs
            F.append([p, q, q + segs])
            F.append([p, q + segs, p + segs])
    F = np.asarray(F)
    # rows of radius 0 collapse to a point: drop the degenerate triangles
    t = V[F]
    area = np.linalg.norm(np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0]), axis=1)
    F = F[area > 1e-12]
    return V, _outward(V, F), np.repeat(np.arange(len(prof)), segs)


def crisp(V, F, angle_deg=35.0, extra=None):
    """Weld coincident vertices, then split every edge sharper than
    `angle_deg`, so each flat face or ring shades on its own and smooth
    curves stay smooth. `extra` is a per-vertex array carried through."""
    bm = bmesh.new()
    layer = None
    if extra is not None:
        layer = bm.verts.layers.float.new("extra")
    for i, p in enumerate(V):
        v = bm.verts.new(p)
        if layer is not None:
            v[layer] = float(extra[i])
    bm.verts.ensure_lookup_table()
    for f in F:
        try:
            bm.faces.new([bm.verts[i] for i in f])
        except ValueError:
            pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    sharp = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > math.radians(angle_deg)]
    bmesh.ops.split_edges(bm, edges=sharp)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.verts.index_update()
    Vo = np.array([v.co[:] for v in bm.verts])
    Fo = np.array([[v.index for v in f.verts] for f in bm.faces])
    ex = np.array([v[layer] for v in bm.verts]) if layer is not None else None
    bm.free()
    return Vo, Fo, ex


def barrel():
    """The barrel, vent and trunnions, in the barrel's frame: (V, F, colours)."""
    parts = []
    V, F, row = lathe(BARREL_PROFILE, "x", 96)
    V, F, row = crisp(V, F, 40.0, row.astype(np.float64))
    row = np.rint(row).astype(int)
    C = np.tile(BRONZE, (len(V), 1))
    C[row >= BORE_FROM] = BORE_DARK
    # a lip of bronze just inside the muzzle before the bore darkens
    C[(row == BORE_FROM) & (V[:, 0] > 0.59)] = BRONZE * 0.7
    parts.append((V, F, C))

    # trunnions with their rimbases, out to the cheeks' bearings
    for side in (-1, 1):
        prof = [
            (0.17, 0.0),
            (0.17, 0.072),
            (0.205, 0.072),
            (0.212, 0.066),
            (0.218, 0.052),
            (0.222, TRUNNION_R),
            (CHEEK_OUT + 0.004, TRUNNION_R),
            (CHEEK_OUT + 0.012, TRUNNION_R - 0.008),
            (CHEEK_OUT + 0.014, 0.0),
        ]
        prof = [(side * s, r) for s, r in prof]
        if side < 0:
            prof = prof[::-1]
        V, F, _ = lathe(prof, "z", 40)
        V, F, _ = crisp(V, F, 40.0)
        parts.append((V, F, np.tile(BRONZE, (len(V), 1))))

    # the vent on top of the breech: a raised field with a dark touch-hole
    vent = [(0.0, 0.17), (0.006, 0.17), (0.006, 0.209), (0.015, 0.209), (0.019, 0.205), (0.019, 0.185), (0.0, 0.185)]
    V, F, row = lathe(vent, "y", 24)
    V[:, 0] += -0.105
    V, F, row = crisp(V, F, 40.0, row.astype(np.float64))
    C = np.tile(BRONZE, (len(V), 1))
    C[np.rint(row) <= 2] = BORE_DARK
    parts.append((V, F, C))

    # two dolphins (lifting handles) over the trunnions
    for side in (-1, 1):
        z = side * 0.06
        pts = [(-0.07, 0.17), (-0.058, 0.212), (-0.02, 0.232), (0.06, 0.232), (0.098, 0.212), (0.11, 0.17)]
        path = np.array([[x, y, z] for x, y in pts])
        V, F = handle(path, 0.013)
        parts.append((V, F, np.tile(BRONZE, (len(V), 1))))
    return parts


def handle(points, radius):
    import plantlib as pl

    path = pl.catmull(points, 8)
    V, F, _, _ = pl.sweep(path, radius, sides=12, up=(0.0, 0.0, 1.0))
    V, F, _ = crisp(V, pl.quads_to_tris(F), 60.0)
    return V, F


# ─── Carriage ───────────────────────────────────────────────────────


def _arc(cx, cy, r, a0, a1, n):
    return [(cx + r * math.cos(t), cy + r * math.sin(t)) for t in np.linspace(a0, a1, n)]


def cheek_outline():
    """The cheek's side outline (x, y), counter-clockwise: stepped at the
    back, a seat for the trunnion at the top, and arched between the two
    axletrees. Below the runway's top it stays behind x = 0."""
    T = LAUNCH_Y
    pts = [(-0.015, 0.12), (-0.015, 0.27), (0.07, 0.315), (0.075, T)]
    pts += [(0.052, T)]
    pts += _arc(0.0, T, TRUNNION_R + 0.002, 0.0, -math.pi, 13)[1:-1]
    pts += [(-0.052, T), (-0.09, T), (-0.11, T - 0.025), (-0.11, 0.335)]
    pts += [(-0.22, 0.335), (-0.22, 0.265), (-0.33, 0.265), (-0.33, 0.195)]
    pts += [(-0.44, 0.195), (-0.46, 0.17), (-0.46, 0.12)]
    # the arch between the axletrees
    pts += [(-0.43, 0.12), (-0.33, 0.12), (-0.31, 0.15), (-0.2, 0.15), (-0.18, 0.12)]
    return pts


def extrude(outline, z0, z1, chamfer=0.006):
    """A slab of the (x, y) polygon between z0 and z1, its edges chamfered."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z0)) for x, y in outline]
    face = bm.faces.new(vs)
    ret = bmesh.ops.extrude_face_region(bm, geom=[face])
    top = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=top, vec=(0.0, 0.0, z1 - z0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if chamfer > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=chamfer, segments=1, profile=0.5, affect="EDGES", clamp_overlap=True)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.verts.index_update()
    V = np.array([v.co[:] for v in bm.verts])
    F = np.array([[v.index for v in f.verts] for f in bm.faces])
    bm.free()
    return crisp(V, F, 30.0)[:2]


def box(lo, hi, chamfer=0.005):
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    return extrude([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, chamfer)


#: front and rear axletree centres (x), and the trucks' radius
AXLES = (-0.13, -0.38)
TRUCK_R = 0.075
TRUCK_Z = 0.315


def grain(V, axis, centre, seed):
    """Wood-grain coordinates for the oak shader: (along the grain, and the
    two offsets from the log's heart across it, seed)."""
    a = {"x": 0, "y": 1, "z": 2}[axis]
    o = [i for i in range(3) if i != a]
    g = np.zeros((len(V), 4))
    g[:, 0] = V[:, a]
    g[:, 1] = V[:, o[0]] - centre[0]
    g[:, 2] = V[:, o[1]] - centre[1]
    g[:, 3] = seed
    return g


def carriage():
    """(node, V, F, colours, grain or None) for the carriage, in the scene's frame."""
    out = []
    # the two cheeks
    for k, side in enumerate((-1, 1)):
        z0, z1 = sorted((side * CHEEK_IN, side * CHEEK_OUT))
        V, F = extrude(cheek_outline(), z0, z1, 0.007)
        # flat-sawn: the heart of the log well below and to one side
        out.append(("wood", V, F, np.tile(OAK, (len(V), 1)), grain(V, "x", (-0.45 + 0.3 * k, side * 0.9), 0.17 + 0.31 * k)))
    # axletrees, and a transom joining the cheeks at the back
    for k, x in enumerate(AXLES):
        V, F = box((x - 0.05, 0.045, -0.29), (x + 0.05, 0.12, 0.29), 0.006)
        out.append(("wood", V, F, np.tile(OAK * 0.92, (len(V), 1)), grain(V, "z", (0.4 + x, -0.5), 0.53 + 0.21 * k)))
    V, F = box((-0.445, 0.12, -CHEEK_IN), (-0.355, 0.19, CHEEK_IN), 0.006)
    out.append(("wood", V, F, np.tile(OAK * 0.96, (len(V), 1)), grain(V, "z", (0.2, -0.6), 0.91)))

    # iron: the axle arms, the trucks and their linchpins
    for x in AXLES:
        for side in (-1, 1):
            arm = [(side * 0.28, 0.0), (side * 0.28, 0.022), (side * 0.352, 0.022), (side * 0.356, 0.016), (side * 0.358, 0.0)]
            if side < 0:
                arm = arm[::-1]
            V, F, _ = lathe(arm, "z", 20)
            V += np.array([x, TRUCK_R, 0.0])
            V, F, _ = crisp(V, F, 40.0)
            out.append(("iron", V, F, np.tile(IRON, (len(V), 1)), None))
            # a truck: a solid iron wheel with a raised hub and a rim
            w = 0.02
            prof = [(-0.026, 0.0), (-0.026, 0.03), (-w, 0.036), (-w, TRUCK_R - 0.012), (-w - 0.002, TRUCK_R - 0.006), (-w, TRUCK_R), (w, TRUCK_R), (w + 0.002, TRUCK_R - 0.006), (w, TRUCK_R - 0.012), (w, 0.036), (0.026, 0.03), (0.026, 0.0)]
            V, F, _ = lathe([(side * TRUCK_Z + s, r) for s, r in prof], "z", 40)
            V += np.array([x, TRUCK_R, 0.0])
            V, F, _ = crisp(V, F, 40.0)
            out.append(("iron", V, F, np.tile(IRON * 1.1, (len(V), 1)), None))

    # cap squares: iron straps over each trunnion, and the cheeks' bolts
    for side in (-1, 1):
        z0, z1 = sorted((side * (CHEEK_IN - 0.004), side * (CHEEK_OUT + 0.004)))
        # a half-ring over the trunnion, with a flap along the cheek's top
        # either side
        T = LAUNCH_Y
        inner = _arc(0.0, T, TRUNNION_R + 0.002, 0.0, math.pi, 13)
        outer = _arc(0.0, T, TRUNNION_R + 0.02, math.pi - 0.17, 0.17, 13)
        ring = inner + [(-0.095, T), (-0.095, T + 0.012)] + outer + [(0.075, T + 0.012), (0.075, T)]
        V, F = extrude(ring, z0, z1, 0.003)
        out.append(("iron", V, F, np.tile(IRON, (len(V), 1)), None))
        zf = side * CHEEK_OUT
        for bx, by in [(-0.06, 0.2), (-0.08, 0.37), (-0.165, 0.3), (-0.28, 0.23), (-0.39, 0.165), (-0.13, 0.085), (-0.38, 0.085)]:
            bolt = [(0.0, 0.011), (0.004, 0.011), (0.007, 0.008), (0.008, 0.004), (0.008, 0.0)]
            V, F, _ = lathe([(zf + side * s, r) for s, r in bolt], "z", 12)
            V += np.array([bx, by, 0.0])
            out.append(("iron", V, F, np.tile(IRON * 0.9, (len(V), 1)), None))
    return out


def anchors():
    return {
        "launchY": round(LAUNCH_Y, 4),
        "muzzleX": MUZZLE_X,
        "boreR": BORE_R,
        "cheekOut": CHEEK_OUT,
        "trunnionR": TRUNNION_R,
        "axles": list(AXLES),
        "truckR": TRUCK_R,
    }

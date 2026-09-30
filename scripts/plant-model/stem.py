"""A length of young bean stem, magnified about x40, with a wedge cut out.

Frame: the stem's axis is y, from y = -H to y = +H, radius 1. The angle phi
is measured round the axis from +z towards +x; the wedge phi in (-pi/4,
pi/4), the side facing the viewer, is removed, leaving two radial cut faces
(at phi = +-pi/4) and the transverse face on top.

Primary structure of a dicot stem, from the outside in (bean, as in any
botany text and in stained sections of Phaseolus):

  epidermis       one layer, cuticle, hooked hairs (uncinate trichomes)
  collenchyma     a few layers of thick-cornered cells under it
  cortex          parenchyma, with chloroplasts near the outside
  endodermis      the starch sheath
  vascular ring   eight collateral bundles: a cap of phloem fibres, phloem,
                  a thin cambium, then xylem, whose vessels grow wider
                  outwards (protoxylem in, metaxylem out)
  pith            large, pale parenchyma cells

Bundles sit at phi = pi/4 + k pi/4, so each cut face runs down the middle of
one: its vessels and sieve tubes are split open along their length. Those
open channels are real grooves in the mesh, with the ring and spiral
thickenings of the vessel walls inside them and sieve plates across the
sieve tubes. The tissue itself (cells, walls, colours) is drawn per pixel by
the scene's stem shader from the same numbers, which are exported in the
meta so the two cannot drift apart.
"""

import math

import numpy as np

import plantlib as pl

H = 1.25
R = 1.0
WEDGE = math.pi / 4
BUNDLES = [math.pi / 4 + k * math.pi / 4 for k in range(8)]

# Where each tissue starts (its inner radius, as a fraction of R); it runs
# out to the next one. The vascular tissues only fill the bundles; between
# them the same radii are rays of parenchyma, except the cambium, which is a
# continuous ring.
RINGS = {
    "xylem": 0.3,
    "cambium": 0.55,
    "phloem": 0.565,
    "fibres": 0.64,
    "endodermis": 0.68,
    "cortex": 0.7,
    "collenchyma": 0.895,
    "epidermis": 0.965,
}

# Vessels in each bundle: radial position, radius, kind. They are drawn
# about twice life size, as textbook diagrams draw them: at true scale a
# vessel is a hundredth of the stem's width and the water in it would not show. Protoxylem (inside)
# has ring thickenings, the next spiral ones, the wide metaxylem pits.
VESSELS = [
    (0.335, 0.03, "annular"),
    (0.405, 0.044, "spiral"),
    (0.49, 0.06, "pitted"),
]
# (radial position, lateral offset along the face) - one per face is split open.
SIEVE = [(0.6, 0.0, 0.026)]


def face_frame(phi):
    """Unit radial direction e_r and the cut face's outward normal n for the
    face at angle phi (the normal points into the removed wedge)."""
    er = np.array([math.sin(phi), 0.0, math.cos(phi)])
    et = np.array([math.cos(phi), 0.0, -math.sin(phi)])  # d(er)/dphi
    # For phi = +pi/4 the wedge lies at smaller phi, so its normal is -et.
    n = -et if phi > 0 else et
    return er, n


def channel_depth(r, grooves):
    d = np.zeros_like(r)
    for rc, rv in grooves:
        m = np.abs(r - rc) < rv
        d[m] = np.maximum(d[m], np.sqrt(rv * rv - (r[m] - rc) ** 2))
    return d


def radial_face(phi, n_y=4):
    """The cut face at phi: a grid in (r, y), grooved where vessels and the
    sieve tube are split open."""
    er, n = face_frame(phi)
    grooves = [(rc, rv) for rc, rv, _ in VESSELS] + [(rc, rv) for rc, _, rv in SIEVE]
    # radial samples: fine across the bundle, coarse elsewhere
    fine = np.arange(0.29, 0.63, 0.004)
    rs = np.unique(np.concatenate([np.linspace(0.0, 0.29, 8), fine, np.linspace(0.63, R, 10)]))
    ys = np.linspace(-H, H, n_y)
    Rg, Yg = np.meshgrid(rs, ys, indexing="ij")
    depth = channel_depth(Rg.ravel(), grooves)
    P = Rg.ravel()[:, None] * er[None, :] + Yg.ravel()[:, None] * np.array([0, 1.0, 0]) - depth[:, None] * n[None, :]
    nr, ny = len(rs), len(ys)
    F = []
    for i in range(nr - 1):
        for j in range(ny - 1):
            a, b, c, d = i * ny + j, (i + 1) * ny + j, (i + 1) * ny + j + 1, i * ny + j + 1
            F.append([a, b, c, d])
    F = np.asarray(F)
    # face outward along n
    e1 = P[F[0, 1]] - P[F[0, 0]]
    e2 = P[F[0, 3]] - P[F[0, 0]]
    if np.dot(np.cross(e1, e2), n) < 0:
        F = F[:, ::-1]
    return P, F


def outer_surface(n_phi=120, n_y=4):
    phis = np.linspace(WEDGE, 2 * math.pi - WEDGE, n_phi)
    ys = np.linspace(-H, H, n_y)
    PH, Y = np.meshgrid(phis, ys, indexing="ij")
    # five low ribs, as a bean stem has
    rr = R * (1 + 0.012 * np.cos(5 * PH))
    P = np.stack([rr * np.sin(PH), Y, rr * np.cos(PH)], axis=-1).reshape(-1, 3)
    F = []
    for i in range(n_phi - 1):
        for j in range(n_y - 1):
            a, b, c, d = i * n_y + j, (i + 1) * n_y + j, (i + 1) * n_y + j + 1, i * n_y + j + 1
            F.append([a, d, c, b])
    F = np.asarray(F)
    e1 = P[F[0, 1]] - P[F[0, 0]]
    e2 = P[F[0, 3]] - P[F[0, 0]]
    mid = P[F[0, 0]]
    if np.dot(np.cross(e1, e2), mid * np.array([1, 0, 1])) < 0:
        F = F[:, ::-1]
    return P, F


def end_face(y, up, n_r=24, n_phi=120):
    """The transverse face at height y (a flat annular sector)."""
    rs = np.linspace(0, R, n_r) ** 0.9
    phis = np.linspace(WEDGE, 2 * math.pi - WEDGE, n_phi)
    Rg, PH = np.meshgrid(rs, phis, indexing="ij")
    rr = Rg * (1 + 0.012 * np.cos(5 * PH))
    P = np.stack([rr * np.sin(PH), np.full_like(rr, y), rr * np.cos(PH)], axis=-1).reshape(-1, 3)
    F = []
    for i in range(n_r - 1):
        for j in range(n_phi - 1):
            a, b, c, d = i * n_phi + j, (i + 1) * n_phi + j, (i + 1) * n_phi + j + 1, i * n_phi + j + 1
            F.append([a, b, c, d])
    F = np.asarray(F)
    e1 = P[F[-1, 1]] - P[F[-1, 0]]
    e2 = P[F[-1, 3]] - P[F[-1, 0]]
    if np.cross(e1, e2)[1] * up < 0:
        F = F[:, ::-1]
    return P, F


def thickenings(phi):
    """Rings and spirals inside the split vessels, and sieve plates across
    the split sieve tube, on the face at phi."""
    er, n = face_frame(phi)
    parts = []
    for rc, rv, kind in VESSELS:
        centre_line = lambda y: rc * er + np.array([0, y, 0])
        # Only the half of each ring or turn that lines the split channel
        # (the solid side, -n) is kept: the other half was cut away with the wedge.
        if kind == "annular":
            for y in np.arange(-H + 0.05, H - 0.02, 0.1):
                a = np.linspace(math.pi + 0.05, 2 * math.pi - 0.05, 12)
                ring = np.stack([rc * er + (rv - 0.004) * (np.cos(t) * er + np.sin(t) * n) + np.array([0, y, 0]) for t in a])
                V, F, _, _ = pl.sweep(ring, 0.006, sides=4, cap_start=True, cap_end=True)
                parts.append((V, pl.quads_to_tris(F)))
        elif kind == "spiral":
            pitch = 0.075
            turns = int(2 * H / pitch)
            for k in range(turns):
                t = np.linspace(math.pi + 0.05, 2 * math.pi - 0.05, 12) + 2 * math.pi * k
                y = -H + 0.02 + (t / (2 * math.pi)) * pitch
                if y[-1] > H - 0.02:
                    break
                helix = rc * er[None, :] + (rv - 0.004) * (np.cos(t)[:, None] * er[None, :] + np.sin(t)[:, None] * n[None, :]) + y[:, None] * np.array([0, 1.0, 0])
                V, F, _, _ = pl.sweep(helix, 0.006, sides=4, cap_start=True, cap_end=True)
                parts.append((V, pl.quads_to_tris(F)))
    # sieve plates across the sieve tube every so often
    for rc, _, rv in SIEVE:
        for y in np.arange(-H + 0.18, H - 0.1, 0.3):
            a = np.linspace(-math.pi / 2, math.pi / 2, 9)
            # a half-disc (the half that shows in the open groove), slightly domed
            ctr = rc * er + np.array([0, y, 0])
            pts = [ctr]
            for t in a:
                pts.append(ctr + rv * (math.sin(t) * er - abs(math.cos(t)) * n * 0 - math.cos(t) * n))
            pts = np.asarray(pts)
            # fan, both sides
            F = [[0, i, i + 1] for i in range(1, len(pts) - 1)]
            F += [[0, i + 1, i] for i in range(1, len(pts) - 1)]
            parts.append((pts, np.asarray(F)))
    return parts


def trichomes(seed=21, count=46):
    """Hooked hairs on the epidermis: a tapering stalk that bends over."""
    rng = pl.rng(seed)
    parts = []
    for _ in range(count):
        phi = rng.uniform(WEDGE + 0.1, 2 * math.pi - WEDGE - 0.1)
        y = rng.uniform(-H + 0.1, H - 0.1)
        er = np.array([math.sin(phi), 0, math.cos(phi)])
        base = er * R * 0.995 + np.array([0, y, 0])
        L = rng.uniform(0.07, 0.15)
        up = np.array([0, 1.0, 0])
        pts = [base, base + er * L * 0.5 + up * L * 0.1, base + er * L * 0.85 + up * L * 0.35, base + er * L * 0.8 + up * L * 0.55]
        path = pl.catmull(pts, 5)
        m = len(path)
        V, F, _, _ = pl.sweep(path, np.linspace(0.011, 0.002, m), sides=4, cap_start=False, cap_end=True)
        parts.append((V, pl.quads_to_tris(F)))
    return parts


def build():
    """(body V, F), (detail V, F): the body gets the tissue shader, the
    detail (thickenings, plates, hairs) plain colours."""
    body = []
    for phi in (WEDGE, -WEDGE):
        body.append(radial_face(phi))
    body.append(outer_surface())
    body.append(end_face(H, 1))
    body.append(end_face(-H, -1, n_r=20, n_phi=60))
    Vb, Fb = pl.combine(body)
    thick = []
    for phi in (WEDGE, -WEDGE):
        thick += thickenings(phi)
    Vt, Ft = pl.combine(thick)
    Vh, Fh = pl.combine(trichomes())
    return (Vb, Fb), (Vt, Ft), (Vh, Fh)


def meta():
    """What the scene needs: the rings and bundles for the tissue shader,
    and the split channels the water and sugar run in."""
    channels = []
    for phi in (WEDGE, -WEDGE):
        er, n = face_frame(phi)
        for rc, rv, kind in VESSELS:
            c = rc * er - n * rv * 0.35
            channels.append({"kind": "xylem", "x": round(float(c[0]), 4), "z": round(float(c[2]), 4), "r": rv, "vessel": kind})
        for rc, _, rv in SIEVE:
            c = rc * er - n * rv * 0.35
            channels.append({"kind": "phloem", "x": round(float(c[0]), 4), "z": round(float(c[2]), 4), "r": rv})
    return {
        "H": H,
        "R": R,
        "wedge": WEDGE,
        "bundles": [round(b, 5) for b in BUNDLES],
        "rings": RINGS,
        "vessels": [[v[0], v[1]] for v in VESSELS],
        "sieve": [[s[0], s[2]] for s in SIEVE],
        "channels": channels,
    }

"""The lower epidermis of a bean leaf seen face-on, magnified about x800.

Frame: the leaf surface is the x-y plane, z out of it towards the viewer
(the outside air). A stoma sits at the origin with its pore along y, and a
second one is caught at the corner of the field, as stomata are spaced on a
bean leaf (a few hundred per square millimetre on the lower side).

  pavement cells  interlocking jigsaw-puzzle outlines, each gently domed,
                  the anticlinal walls as grooves between them (bean's are
                  strongly lobed)
  guard cells     two kidney-shaped cells whose tips meet; the ledge of
                  cuticle along each one's inner edge rims the pore
  the pore        a slit between them opening onto the dark substomatal
                  chamber below
  a hooked hair   (uncinate trichome), common on bean leaves

The guard cells carry an "open" morph: the middle of each bows away from
the pore and swells while the tips stay pinned, which is how a stoma opens
(radially arranged cellulose microfibrils let a guard cell lengthen but not
fatten, so it curves). Scale: 1 um is about 0.052 units.
"""

import math

import numpy as np

import plantlib as pl
from plantlib import sdf

W, HGT = 2.0, 1.6  # half extents of the patch
STOMATA = [(0.0, 0.0, 0.0), (1.42, -0.98, 0.45)]  # x, y, rotation (radians)
GA, GB = 0.34, 0.66  # stoma outline half-width, half-length (closed)
GR = 0.19  # guard cell radius at its middle

C = {
    "pavement": pl.hex_rgb("#d5e6c3"),
    "wall": pl.hex_rgb("#9fbf86"),
    "guard": pl.hex_rgb("#6fb455"),
    "chloroplast": pl.hex_rgb("#2f7a26"),
    "ledge": pl.hex_rgb("#e4f0d4"),
    "pore": pl.hex_rgb("#0f160c"),
    "hair": pl.hex_rgb("#eef3e2"),
}


def local(P, s):
    """Points into a stoma's frame (pore along y)."""
    x, y, rot = s
    c, sn = math.cos(rot), math.sin(rot)
    q = P[:, :2] - np.array([x, y])
    return np.stack([q[:, 0] * c + q[:, 1] * sn, -q[:, 0] * sn + q[:, 1] * c], axis=1)


def stoma_dist(P2):
    """Signed distance (roughly) to the nearest stomatal complex's outline."""
    d = np.full(len(P2), 9.0)
    for s in STOMATA:
        q = local(np.concatenate([P2, np.zeros((len(P2), 1))], axis=1), s)
        e = np.sqrt((q[:, 0] / (GA + 0.1)) ** 2 + (q[:, 1] / (GB + 0.06)) ** 2)
        d = np.minimum(d, (e - 1) * min(GA, GB))
    return d


def seeds(seed=8):
    rng = pl.rng(seed)
    pts = []
    tries = 0
    while len(pts) < 17 and tries < 6000:
        tries += 1
        p = np.array([rng.uniform(-W - 0.6, W + 0.6), rng.uniform(-HGT - 0.6, HGT + 0.6)])
        if stoma_dist(p[None, :])[0] < 0.55:
            continue
        if any(np.linalg.norm(p - q) < 1.12 for q in pts):
            continue
        pts.append(p)
    # neighbour cells hugging each stoma (a bean stoma is ringed by 3-5 cells)
    return np.asarray(pts)


def pavement_height(X, Y, S):
    """Height of the pavement surface: each cell domed, grooves between,
    the outlines warped into interlocking lobes."""
    P3 = np.stack([X, Y, np.zeros_like(X)], axis=1)
    # Lobes: a smooth warp of the plane, about 0.6 units (12 um) between
    # lobes, strong enough to interlock the walls without pinching off islands.
    wx = sdf.fbm(P3 * 1.0, np.array([0.34, 0.34, 1.0]), 2, 3)
    wy = sdf.fbm(P3 * 1.0 + 7.1, np.array([0.34, 0.34, 1.0]), 2, 5)
    wx2 = sdf.value_noise(P3 + 3.3, np.array([0.16, 0.16, 1.0]), 11)
    wy2 = sdf.value_noise(P3 + 9.9, np.array([0.16, 0.16, 1.0]), 12)
    Xw = X + 0.28 * wx + 0.07 * wx2
    Yw = Y + 0.28 * wy + 0.07 * wy2
    d = np.sqrt((Xw[:, None] - S[None, :, 0]) ** 2 + (Yw[:, None] - S[None, :, 1]) ** 2)
    d.sort(axis=1)
    edge = (d[:, 1] - d[:, 0]) / 2  # distance to the (warped) wall
    cid = np.argmin(np.sqrt((Xw[:, None] - S[None, :, 0]) ** 2 + (Yw[:, None] - S[None, :, 1]) ** 2), axis=1)
    dome = 0.075 * np.sqrt(pl.smooth(0.0, 0.7, edge))
    groove = -0.04 * (1 - pl.smooth(0.0, 0.03, edge))
    h = dome + groove
    # round the stomata: the pavement dips to the stomatal complex, and
    # inside it the surface drops away into the dark chamber under the pore
    sd = stoma_dist(np.stack([X, Y], axis=1))
    h = np.where(sd < 0.06, h * pl.smooth(-0.02, 0.06, sd), h)
    inner = pl.smooth(0.02, -0.08, sd)
    h = h - 0.45 * inner
    return h, edge, cid, sd


def surface(step=0.016, seed=8):
    S = seeds(seed)
    xs = np.arange(-W, W + 1e-6, step)
    ys = np.arange(-HGT, HGT + 1e-6, step)
    X, Y = np.meshgrid(xs, ys, indexing="ij")
    h, edge, cid, sd = pavement_height(X.ravel(), Y.ravel(), S)
    V = np.stack([X.ravel(), Y.ravel(), h], axis=1)
    nx, ny = len(xs), len(ys)
    ii, jj = np.meshgrid(np.arange(nx - 1), np.arange(ny - 1), indexing="ij")
    a = (ii * ny + jj).ravel()
    F = np.stack([a, a + ny, a + ny + 1, a + 1], axis=1)
    return V, F, S


def colour_surface(P, S):
    h, edge, cid, sd = pavement_height(P[:, 0], P[:, 1], S)
    rng = pl.rng(3)
    tint = rng.uniform(0.94, 1.04, len(S))
    col = C["pavement"][None, :] * tint[cid][:, None]
    col = pl.mix(col, C["wall"], 1 - pl.smooth(0.0, 0.05, edge))
    # everything inside the stomatal complex is the dark chamber under the pore
    col = pl.mix(col, C["pore"], pl.smooth(0.03, -0.03, sd))
    return col


def guard_field(P):
    """Both stomata's guard cells, closed: in each stoma's frame, two tubes
    along half-ellipse centrelines that meet at the tips (0, +-GB)."""
    out = np.full(len(P), 1.0)
    for s in STOMATA:
        q = local(P, s)
        z = P[:, 2]
        cells = []
        for side in (-1, 1):
            # nearest point on the centreline x = side*ac*cos(t), y = GB*sin(t)
            ac = GR * 1.02
            t = np.arcsin(np.clip(q[:, 1] / GB, -1, 1))
            cx = side * ac * np.cos(t)
            cy = GB * np.sin(t)
            # radius: fat in the middle, pinched to the tips
            r = GR * (0.36 + 0.64 * np.cos(t) ** 0.7)
            dx = q[:, 0] - cx
            dy = (q[:, 1] - cy) * 0.5
            dz = (z - 0.02) / 0.62  # a little flattened
            d = np.sqrt(dx * dx + dy * dy + dz * dz) - r
            # tips join their partner's
            d = np.where(np.abs(q[:, 1]) > GB, np.sqrt(q[:, 0] ** 2 + ((np.abs(q[:, 1]) - GB) * 0.5) ** 2 + dz * dz) - GR * 0.36, d)
            cells.append(d)
        # the pair fuses only at the tips; along the pore they stay two cells
        a, b = cells
        k = 0.002 + 0.06 * pl.smooth(0.55 * GB, 0.9 * GB, np.abs(q[:, 1]))
        h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
        pair = b * (1 - h) + a * h - k * h * (1 - h)
        out = np.minimum(out, pair)
    return out


def guard_open(P):
    """Morph delta: the middle of each guard cell bows away from the pore
    and swells a little; the tips stay pinned."""
    d = np.zeros_like(P)
    for s in STOMATA:
        x, y, rot = s
        q = local(P, s)
        near = (np.abs(q[:, 0]) < GA + 0.2) & (np.abs(q[:, 1]) < GB + 0.25)
        t = np.arcsin(np.clip(q[:, 1] / GB, -1, 1))
        side = np.sign(q[:, 0])
        bow = np.cos(t) ** 1.2 * pl.smooth(GB + 0.12, GB * 0.8, np.abs(q[:, 1]))
        lx = side * 0.13 * bow + q[:, 0] * 0.06 * bow
        lz = (P[:, 2] - 0.0) * 0.12 * bow
        c, sn = math.cos(rot), math.sin(rot)
        dx = lx * c
        dy = lx * sn
        d[near, 0] += dx[near]
        d[near, 1] += dy[near]
        d[near, 2] += lz[near]
    return d


def colour_guard(P):
    col = np.tile(C["guard"], (len(P), 1))
    # chloroplasts seen through the wall: soft dark spots
    n = sdf.value_noise(P, np.array([0.045, 0.045, 0.045]), 21)
    col = pl.mix(col, C["chloroplast"], pl.smooth(0.35, 0.7, n) * 0.8)
    for s in STOMATA:
        q = local(P, s)
        # the cuticular ledge rims the pore: a pale lip along the top of each
        # cell's inner edge only; the inner flanks below it stay green
        near = (np.abs(q[:, 1]) < GB * 0.8) & (P[:, 2] > 0.1)
        ledge = pl.smooth(0.06, 0.035, np.abs(q[:, 0])) * near
        col = pl.mix(col, C["ledge"], ledge * 0.8)
        # the inner flanks, facing into the pore, are in shadow
        flank = pl.smooth(0.05, 0.01, np.abs(q[:, 0])) * (P[:, 2] < 0.08) * (np.abs(q[:, 1]) < GB)
        col = pl.mix(col, C["chloroplast"] * 0.6, flank * 0.7)
    return col


def hair():
    """One hooked trichome on a pavement cell."""
    base = np.array([-1.35, 0.95, 0.05])
    pts = [base, base + [0.02, 0.05, 0.3], base + [0.1, 0.12, 0.55], base + [0.3, 0.1, 0.62], base + [0.38, 0.0, 0.55]]
    path = pl.catmull(pts, 8)
    m = len(path)
    r = np.interp(np.linspace(0, 1, m), [0, 0.12, 1], [0.1, 0.055, 0.008])
    V, F, t, a = pl.sweep(path, r, sides=12, cap_start=False, cap_end=True)
    # a foot of cells round the base
    Vf, Ff = pl.ellipsoid_mesh(base + [0, 0, -0.02], (0.18, 0.18, 0.06), nu=18, nv=8)
    return pl.combine([(V, F), (Vf, Ff)])


def meta():
    return {
        "stomata": [[s[0], s[1], s[2]] for s in STOMATA],
        "GA": GA,
        "GB": GB,
        "GR": GR,
        "openBow": 0.13,
        "umPerUnit": 1 / 0.052,
    }

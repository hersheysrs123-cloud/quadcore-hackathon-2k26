"""The two specimens of the bacteria-vs-virus scene, in the scene's units.

E. COLI (cell frame: centre at the origin, long axis x, 1 unit = 0.43 µm)
is a cut-away: its front is removed in terraces, the wall's
window widest, then the membrane's, then the cytoplasm's, so each layer
shows its edge, as in a museum model. Layers are signed-distance shells of
a capsule (`_capsule_d`) cut by a wedge-and-slab window (`window`).
Inside: a supercoiled nucleoid (one long tube following a ball-of-yarn
path, with a plectonemic twist), supercoiled plasmids, and 70S ribosomes
(a large and a small subunit, instanced by the scene). Outside: short
fimbriae (pili), and peritrichous flagella: a basal body and hook on the
wall (the scene draws the moving helical filaments).

T4 BACTERIOPHAGE (phage frame: baseplate at the origin, tail up +y) is an
elongated icosahedral capsid patterned with hexagonal capsomeres, its
front sliced off to show the DNA spool inside; a collar with whiskers; a
contractile sheath of 23 helical rings of six subunits round the tail
tube; a hexagonal baseplate with short pins; and six kinked long tail
fibres. A low-detail whole phage is built for the progeny.

PENICILLIN G is a ball-and-stick molecule (heavy atoms only, CPK colours).
"""

import math

import numpy as np

import plantlib as pl

sdf = pl.sdf
H = pl.hex_rgb
sm = pl.smooth


def mix(a, b, t):
    return pl.mix(np.asarray(a, dtype=np.float64), np.asarray(b, dtype=np.float64), np.clip(t, 0, 1))


# ─── E. coli ───────────────────────────────────────────────────────

HALF = 1.3  # half-length of the cylinder
LAYERS = {
    # outer, inner radius of each shell
    "wall": (1.0, 0.93),
    "membrane": (0.912, 0.878),
    "cytoplasm": (0.872, 0.0),
}
# The cut-away window of each layer: angle range round the axis (from +y
# towards +z, the viewer) and the x slab. Inner layers step back.
WINDOWS = {
    "wall": {"a": (0.42, 2.62), "x": (-1.25, 1.55)},
    "membrane": {"a": (0.58, 2.46), "x": (-1.05, 1.35)},
    "cytoplasm": {"a": (0.72, 2.32), "x": (-0.88, 1.18)},
}


def _capsule_d(P, r):
    return sdf._capsule(P, (-HALF, 0, 0), (HALF, 0, 0), r, r)


def window(P, name):
    w = WINDOWS[name]
    a0, a1 = w["a"]
    y, z = P[:, 1], P[:, 2]
    h0 = -(math.cos(a0) * z - math.sin(a0) * y)
    h1 = math.cos(a1) * z - math.sin(a1) * y
    wedge = np.maximum(h0, h1)
    x0, x1 = w["x"]
    slab = np.abs(P[:, 0] - (x0 + x1) / 2) - (x1 - x0) / 2
    return sdf.smax(wedge, slab, 0.04)


def layer_full(P, name):
    ro, ri = LAYERS[name]
    d = _capsule_d(P, ro)
    if ri > 0:
        d = np.maximum(d, -_capsule_d(P, ri))
    return d


def layer_field(name):
    def f(P):
        return sdf.cut(layer_full(P, name), window(P, name), 0.012)

    return f


def _rim(P, name):
    """How near a point is to the layer's cut edge (1 on it)."""
    return 1 - sm(0.006, 0.02, np.abs(window(P, name)))


def _radial(P):
    q = P.copy()
    q[:, 0] = np.clip(q[:, 0], -HALF, HALF)
    return np.linalg.norm(P - q * np.array([1, 0, 0]), axis=1)


def wall_colour(P, N):
    n = sdf.fbm(P, 0.05, 3, 3)
    c = mix(H("#b98f57"), H("#dcbb84"), 0.5 + 0.5 * n)
    # Lipopolysaccharide fuzz: fine mottling on the outer surface.
    c = c * (1 + 0.06 * sdf.value_noise(P, 0.012, 9)[:, None])
    rim = _rim(P, "wall")
    r = _radial(P)
    # The cut edge: outer membrane (dark), the peptidoglycan mesh (pale,
    # cross-hatched) and the periplasm's inner face.
    hatch = np.maximum(np.abs(np.mod(P[:, 0] * 22 + r * 40, 1) - 0.5), np.abs(np.mod(P[:, 0] * 22 - r * 40, 1) - 0.5))
    mesh = mix(H("#f6e2b8"), H("#c9a066"), sm(0.32, 0.46, hatch))
    edge = np.where((r > 0.985)[:, None], H("#8a6334"), np.where((r < 0.942)[:, None], H("#a77f48"), mesh))
    return mix(c, edge, rim)


def membrane_colour(P, N):
    n = sdf.fbm(P, 0.06, 2, 5)
    c = mix(H("#e98bb6"), H("#f7b5d1"), 0.5 + 0.5 * n)
    rim = _rim(P, "membrane")
    r = _radial(P)
    # A bilayer in section: two dark head-group lines with the pale tails between.
    heads = np.maximum(1 - sm(0.0, 0.006, np.abs(r - 0.908)), 1 - sm(0.0, 0.006, np.abs(r - 0.882)))
    edge = mix(H("#fde4ef"), H("#b0477a"), heads)
    return mix(c, edge, rim)


def cytoplasm_colour(P, N):
    n = sdf.value_noise(P, 0.03, 13)
    c = mix(H("#9bd2ee"), H("#c4e6f6"), 0.5 + 0.5 * n)
    rim = _rim(P, "cytoplasm")
    return mix(c, H("#e2f3fb"), rim * 0.6)


def pili(n=150, seed=7):
    """Fimbriae: short straight hairs over the wall, none in the window."""
    rnd = pl.rng(seed)
    parts = []
    k = 0
    while len(parts) < n and k < n * 6:
        k += 1
        x = rnd.uniform(-HALF - 0.9, HALF + 0.9)
        a = rnd.uniform(0, 2 * math.pi)
        if abs(x) <= HALF:
            base = np.array([x, math.cos(a), math.sin(a)])
            nrm = np.array([0.0, math.cos(a), math.sin(a)])
        else:
            s = math.copysign(1, x)
            u = rnd.normal(size=3)
            u[0] = abs(u[0]) * s
            u /= np.linalg.norm(u)
            base = np.array([s * HALF, 0, 0]) + u
            nrm = u
        if window(base[None, :], "wall")[0] < 0.05:
            continue
        ln = rnd.uniform(0.16, 0.3)
        tilt = rnd.normal(size=3) * 0.25
        d = nrm + tilt
        d /= np.linalg.norm(d)
        path = np.stack([base - nrm * 0.02, base + d * ln * 0.5, base + d * ln])
        V, F, tt, _ = pl.sweep(path, np.array([0.008, 0.007, 0.005]), sides=4, cap_start=False)
        parts.append((V, F, mix(H("#c9a774"), H("#efe0c0"), tt)))
    return pl.combine(parts)


# Peritrichous flagella: base on the wall (cell frame) and the outward normal.
def _flagella_bases():
    out = []
    for x, a in ((0.55, -0.55), (1.15, math.pi + 0.45), (-0.45, -1.35), (0.15, math.pi - 0.2)):
        out.append((np.array([x, math.cos(a), math.sin(a)]), np.array([0.0, math.cos(a), math.sin(a)])))
    d = np.array([0.8, 0.45, -0.4])
    d /= np.linalg.norm(d)
    out.append((np.array([HALF, 0, 0]) + d, d))
    return out


def flagella_layout():
    """Each flagellum: its base, the hook's end, and the way the hook bends
    (out of the wall and back along the body, towards the bundle). The
    filaments themselves are drawn by the scene, which moves them."""
    out = []
    for base, nrm in _flagella_bases():
        hook_end = base + nrm * 0.16 + np.array([0.12, 0, 0])
        d = nrm * 0.5 + np.array([1.0, 0, 0])
        d /= np.linalg.norm(d)
        out.append({"base": base, "normal": nrm, "hookEnd": hook_end, "dir": d})
    return out


def flagella_hooks():
    """Basal bodies (rings in the wall) and the curved hooks."""
    parts = []
    for f in flagella_layout():
        base, nrm, end, d = f["base"], f["normal"], f["hookEnd"], f["dir"]
        path = pl.catmull([base - nrm * 0.06, base + nrm * 0.06, base + nrm * 0.13 + d * 0.04, end, end + d * 0.03], 5)
        V, F, _, _ = pl.sweep(path, 0.03, sides=8)
        parts.append((V, F, np.tile(H("#e7dcc5"), (len(V), 1))))
        # The basal body's rings, flat on the wall.
        R = pl.rot_to((0, 1, 0), nrm)
        for off, rr in ((0.0, 0.07), (-0.05, 0.06)):
            Vr, Fr = pl.ellipsoid_mesh(base + nrm * off, (rr, 0.014, rr), R, nu=14, nv=5)
            parts.append((Vr, Fr, np.tile(H("#8f7650"), (len(Vr), 1))))
    return pl.combine(parts)


# Nucleoid: one long chromosome, crumpled into the middle of the cell.
NUCLEOID_C = np.array([-0.1, 0.0, -0.05])


def nucleoid(seed=3):
    t = np.linspace(0, 1, 5200)
    rnd = pl.rng(seed)
    f = rnd.uniform(0.8, 1.2, 6)
    ph = rnd.uniform(0, 2 * math.pi, 6)
    x = 0.95 * np.sin(2 * math.pi * (3.0 * f[0] * t) + ph[0]) * (0.75 + 0.25 * np.sin(2 * math.pi * 7 * t + ph[3]))
    y = 0.36 * np.sin(2 * math.pi * (19.0 * f[1] * t) + ph[1]) * (0.8 + 0.2 * np.cos(2 * math.pi * 5 * t))
    z = 0.34 * np.sin(2 * math.pi * (27.0 * f[2] * t) + ph[2]) * (0.8 + 0.2 * np.sin(2 * math.pi * 3 * t + ph[4]))
    base = np.stack([x, y, z], axis=1) + NUCLEOID_C
    base = pl.resample(base, 0.016)
    T, Nn, Bn = pl.frames(base)
    s = np.arange(len(base)) * 0.016
    tw = 2 * math.pi * s / 0.11  # plectonemic supercoil
    path = base + 0.018 * (np.cos(tw)[:, None] * Nn + np.sin(tw)[:, None] * Bn)
    path = pl.resample(path, 0.02)
    V, F, tt, _ = pl.sweep(path, 0.0125, sides=5)
    n = sdf.value_noise(V, 0.08, 17)
    C = mix(H("#6f72e8"), H("#a5a8ff"), 0.5 + 0.5 * n)
    return V, F, C


def plasmid(seed=5):
    """A small supercoiled ring: two strands twined round a circle."""
    th = np.linspace(0, 2 * math.pi, 241)
    R = 0.2
    parts = []
    for s in (0, math.pi):
        tw = 4 * th + s
        r = R + 0.035 * np.cos(tw)
        path = np.stack([r * np.cos(th), 0.035 * np.sin(tw), r * np.sin(th)], axis=1)
        V, F, _, _ = pl.sweep(path, 0.016, sides=6, cap_start=False, cap_end=False)
        parts.append((V, F, np.tile(H("#c084fc") if s == 0 else H("#a35ef0"), (len(V), 1))))
    return pl.combine(parts)


def dna_fragment():
    """A short, broken length of host DNA (the scene scatters them)."""
    s = np.linspace(0, 0.32, 40)
    path = np.stack([s, 0.03 * np.sin(s * 40), 0.03 * np.cos(s * 40)], axis=1)
    V, F, _, _ = pl.sweep(path, 0.0125, sides=5)
    return V, F, np.tile(H("#8f92f5"), (len(V), 1))


def ribosome_field(P):
    """A 70S ribosome at unit scale: the 50S subunit (a crown of lobes) and
    the flatter 30S subunit seated on it, with the cleft between."""
    large = sdf._ellipsoid(P, (0, -0.15, 0), (0.62, 0.48, 0.55), (0, 0, 0))
    for c, r in (((0.35, 0.18, 0.1), 0.24), ((-0.32, 0.16, -0.05), 0.22), ((0.0, 0.25, -0.3), 0.2)):
        large = sdf.smin(large, sdf._ellipsoid(P, c, (r, r * 0.9, r), (0, 0, 0)), 0.12)
    small = sdf._ellipsoid(P, (0.05, 0.5, 0.05), (0.52, 0.26, 0.4), (0, 0, 0.15))
    small = sdf.smin(small, sdf._ellipsoid(P, (-0.3, 0.6, 0.1), (0.2, 0.18, 0.18), (0, 0, 0)), 0.08)
    d = np.minimum(large, small)
    return sdf.roughen(d, P, 0.03, 0.18, 2, 2)


def ribosome_colour(P, N):
    small = P[:, 1] > 0.33
    n = sdf.value_noise(P, 0.15, 4)
    return np.where(small[:, None], mix(H("#fff0c8"), H("#ffe3a0"), 0.5 + 0.5 * n), mix(H("#ffe39a"), H("#f8cd6a"), 0.5 + 0.5 * n))


# ─── T4 bacteriophage ──────────────────────────────────────────────

SHEATH_LENGTH = 1.05
HEAD_C = 0.68  # head centre above the collar's base
HEAD_R = 0.44  # equatorial
HEAD_STRETCH = 1.32
HEAD_CUT_Z = 0.17  # the capsid's front is sliced off here


def _ico_normals():
    t = (1 + 5**0.5) / 2
    V = []
    for a in (-1, 1):
        for b in (-1, 1):
            for c in (-1, 1):
                V.append((a, b, c))
    for a in (-1, 1):
        for b in (-1, 1):
            V += [(0, a / t, b * t), (a / t, b * t, 0), (a * t, 0, b / t)]
    V = np.asarray(V, dtype=np.float64)
    return V / np.linalg.norm(V, axis=1, keepdims=True)  # the 20 dodecahedron vertices = icosahedron face normals


ICO_N = _ico_normals()


def _capsid_planes(r):
    # Prolate along y: stretch space by S, so normals transform by S^-1.
    S_inv = np.array([1.0, 1.0 / HEAD_STRETCH, 1.0])
    n = ICO_N * S_inv
    ln = np.linalg.norm(n, axis=1)
    d = r * 0.7947 / ln  # inradius of a unit-circumradius icosahedron is 0.7947
    return n / ln[:, None], d


def capsid_full(P, r=HEAD_R):
    n, d = _capsid_planes(r)
    q = P - np.array([0, HEAD_C, 0])
    vals = q @ n.T - d
    # Smoothly rounded edges: a soft max over the faces.
    k = 0.03
    m = vals.max(axis=1)
    return m + k * np.log(np.exp((vals - m[:, None]) / k).sum(axis=1)) - k * 0.6


def _hexpattern(P):
    """Hexagonal capsomere relief in each face's own plane, 1 at a capsomere's centre."""
    n, d = _capsid_planes(HEAD_R)
    q = P - np.array([0, HEAD_C, 0])
    f = np.argmax(q @ n.T - d, axis=1)
    nf = n[f]
    up = np.where(np.abs(nf[:, 1:2]) > 0.9, np.array([[1.0, 0, 0]]), np.array([[0, 1.0, 0]]))
    u = np.cross(nf, up)
    u /= np.linalg.norm(u, axis=1, keepdims=True)
    v = np.cross(nf, u)
    a, b = np.einsum("ij,ij->i", q, u), np.einsum("ij,ij->i", q, v)
    s = 0.085
    k = 2 * math.pi / s
    h = sum(np.cos(k * (a * math.cos(t) + b * math.sin(t))) for t in (0, 2 * math.pi / 3, 4 * math.pi / 3))
    return (h + 1.5) / 4.5


def head_field(P):
    shell = np.maximum(capsid_full(P), -capsid_full(P, HEAD_R - 0.045))
    m = np.abs(shell) < 0.03
    if m.any():
        shell = shell.copy()
        shell[m] -= 0.009 * _hexpattern(P[m])
    shell = sdf.cut(shell, HEAD_CUT_Z - P[:, 2], 0.008)  # the front, z > HEAD_CUT_Z, sliced away
    collar = sdf._round_cone(P, (0, 0.0, 0), (0, 0.12, 0), 0.19, 0.15)
    portal = sdf._round_cone(P, (0, 0.08, 0), (0, HEAD_C - HEAD_R * HEAD_STRETCH * 0.75, 0), 0.12, 0.08)
    d = np.minimum(shell, sdf.smin(collar, portal, 0.05))
    # Whiskers: six thin fibrils hanging from the collar.
    for i in range(6):
        a = i * math.pi / 3 + 0.25
        c, s_ = math.cos(a), math.sin(a)
        w = sdf._capsule(P, (0.17 * c, 0.08, 0.17 * s_), (0.42 * c, -0.12, 0.42 * s_), 0.014, 0.01)
        d = np.minimum(d, w)
    return d


def head_colour(P, N):
    h = _hexpattern(P)
    c = mix(H("#7f9fd0"), H("#c6d8f2"), sm(0.3, 0.8, h))
    cutf = (np.abs(P[:, 2] - HEAD_CUT_Z) < 0.006) & (N[:, 2] > 0.6)
    c[cutf] = H("#dde7f6")
    low = P[:, 1] < 0.2
    c = np.where(low[:, None], mix(H("#5a60c8"), H("#8b8fe0"), sm(-0.1, 0.15, P[:, 1])), c)
    return c


def _spool_span(r, clearance=0.07):
    """How far up and down a spool layer of radius r can run and stay
    inside the capsid all the way round (tested against its field)."""
    th = np.linspace(0, 2 * math.pi, 24, endpoint=False)
    best = 0.0
    for y in np.linspace(0, HEAD_R * HEAD_STRETCH, 80):
        P = np.stack([r * np.cos(th), np.full_like(th, HEAD_C + y), r * np.sin(th)], axis=1)
        Q = P.copy()
        Q[:, 1] = HEAD_C - y  # the same height below the centre
        if (capsid_full(P, HEAD_R - 0.045) < -clearance).all() and (capsid_full(Q, HEAD_R - 0.045) < -clearance).all():
            best = y
        else:
            break
    return best


def dna_spool():
    """The packed genome: coaxial layers wound round the tail axis, one
    strand going up a layer and down the next (centred on the head)."""
    pts = []
    layers = [0.33, 0.265, 0.2, 0.135]
    pitch = 0.046
    for k, r in enumerate(layers):
        span = _spool_span(r)
        turns = int(2 * span / pitch)
        th = np.linspace(0, 2 * math.pi * turns, turns * 26)
        y = np.linspace(-span, span, len(th)) * (1 if k % 2 == 0 else -1)
        pts.append(np.stack([r * np.cos(th), y, r * np.sin(th)], axis=1))
    path = pl.resample(np.concatenate(pts), 0.05)
    # Sliced with the capsid: only the runs of strand behind its cut face.
    keep = path[:, 2] < HEAD_CUT_Z - 0.03
    parts = []
    i = 0
    while i < len(path):
        if not keep[i]:
            i += 1
            continue
        j = i
        while j < len(path) and keep[j]:
            j += 1
        if j - i >= 3:
            V, F, _, _ = pl.sweep(path[i:j], 0.018, sides=5)
            n = sdf.value_noise(V, 0.06, 3)
            parts.append((V, F, mix(H("#e45f9f"), H("#f8a6cb"), 0.5 + 0.5 * n)))
        i = j
    return pl.combine(parts)


def sheath_field(P):
    """23 rings of six subunits on a 6-start helix, round the tail tube;
    centred at the origin, SHEATH_LENGTH tall."""
    L = SHEATH_LENGTH
    d = sdf._capsule(P, (0, -L / 2 + 0.02, 0), (0, L / 2 - 0.02, 0), 0.128, 0.128)
    d = np.maximum(d, -sdf._capsule(P, (0, -L, 0), (0, L, 0), 0.062, 0.062))
    rings = 23
    for i in range(rings):
        y = -L / 2 + (i + 0.5) * L / rings
        for j in range(6):
            a = j * math.pi / 3 + i * math.radians(17.2)
            c = (0.125 * math.cos(a), y, 0.125 * math.sin(a))
            e = sdf.ellipsoid(P, c, (0.05, 0.03, 0.06), (0, -a, 0))
            d = sdf.smin(d, e, 0.02)
    return d


def sheath_colour(P, N):
    r = np.hypot(P[:, 0], P[:, 2])
    n = sdf.value_noise(P, 0.02, 21)
    return mix(H("#7d86d8"), H("#b7bff2"), sm(0.13, 0.17, r) * 0.75 + 0.15 * n)


def core_mesh():
    path = np.stack([np.zeros(30), np.linspace(-SHEATH_LENGTH / 2, SHEATH_LENGTH / 2, 30), np.zeros(30)], axis=1)
    V, F, tt, _ = pl.sweep(path, 0.048, sides=10)
    return V, F, mix(H("#d6dcfa"), H("#eef1ff"), tt)


def baseplate_field(P):
    q = P.copy()
    th = np.arctan2(q[:, 2], q[:, 0])
    # A hexagonal plate: a prism with six lobes at the corners.
    sec = np.mod(th + math.pi / 6, math.pi / 3) - math.pi / 6
    rr = np.hypot(q[:, 0], q[:, 2]) * np.cos(sec)
    plate = np.maximum(rr - 0.3, np.abs(q[:, 1]) - 0.045)
    d = plate
    for i in range(6):
        a = i * math.pi / 3
        c = (0.31 * math.cos(a), 0.0, 0.31 * math.sin(a))
        d = sdf.smin(d, sdf._ellipsoid(P, c, (0.07, 0.06, 0.07), (0, 0, 0)), 0.03)
        # Short tail pins folded under the plate.
        tip = (0.36 * math.cos(a + 0.5), -0.14, 0.36 * math.sin(a + 0.5))
        d = np.minimum(d, sdf._capsule(P, (0.26 * math.cos(a + 0.3), -0.03, 0.26 * math.sin(a + 0.3)), tip, 0.016, 0.012))
    hub = sdf._round_cone(P, (0, -0.02, 0), (0, -0.14, 0), 0.1, 0.05)
    return sdf.smin(d, hub, 0.03)


def baseplate_colour(P, N):
    n = sdf.value_noise(P, 0.03, 8)
    return mix(H("#4b4fbf"), H("#7175dd"), 0.5 + 0.5 * n)


def tail_fibre():
    """One long tail fibre from a baseplate corner (the origin): the
    proximal half out and up, a kink at the knee, the distal half down to
    the tip that binds the receptor. Beaded, as in electron micrographs."""
    ctrl = [(0, 0, 0), (0.18, 0.06, 0), (0.42, 0.04, 0), (0.55, -0.02, 0), (0.62, -0.2, 0), (0.68, -0.42, 0), (0.7, -0.55, 0)]
    path = pl.resample(pl.catmull(ctrl, 6), 0.012)
    s = np.linspace(0, 1, len(path))
    r = 0.014 * (1 + 0.25 * np.cos(s * 2 * math.pi * 18) ** 2)
    V, F, tt, _ = pl.sweep(path, r, sides=6)
    parts = [(V, F, mix(H("#b9c1f5"), H("#dfe3ff"), tt))]
    for p, rr in ((path[int(len(path) * 0.5)], 0.026), (path[-1], 0.024)):
        Vk, Fk = pl.ellipsoid_mesh(p, (rr, rr, rr), nu=10, nv=7)
        parts.append((Vk, Fk, np.tile(H("#9aa3ef"), (len(Vk), 1))))
    return pl.combine(parts)


def phage_low():
    """A whole phage at low detail (baseplate at the origin), for the progeny."""
    parts = []
    # Head: the same elongated icosahedron as a flat-faceted hull.
    t = (1 + 5**0.5) / 2
    Vi = np.array([(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)], dtype=np.float64)
    Vi /= np.linalg.norm(Vi, axis=1, keepdims=True)
    Fi = np.array([(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)])
    # Flat shading needs unshared vertices.
    Vh = (Vi[Fi.ravel()] * np.array([HEAD_R, HEAD_R * HEAD_STRETCH, HEAD_R])) + np.array([0, SHEATH_LENGTH + 0.1 + HEAD_C, 0])
    Fh = np.arange(len(Vh)).reshape(-1, 3)
    parts.append((Vh, np.concatenate([Fh, Fh[:, 2:3]], axis=1), np.tile(H("#a9c0ea"), (len(Vh), 1))))
    path = np.stack([np.zeros(6), np.linspace(0.04, SHEATH_LENGTH + 0.12, 6), np.zeros(6)], axis=1)
    V, F, _, _ = pl.sweep(path, 0.13, sides=8)
    parts.append((V, F, np.tile(H("#949ee6"), (len(V), 1))))
    Vb, Fb = pl.ellipsoid_mesh((0, 0, 0), (0.33, 0.05, 0.33), nu=6, nv=4)
    parts.append((Vb, Fb, np.tile(H("#5a5ed0"), (len(Vb), 1))))
    for i in range(6):
        a = i * math.pi / 3 + 0.3
        c, s_ = math.cos(a), math.sin(a)
        path = np.array([[0.3 * c, 0, 0.3 * s_], [0.65 * c, 0.02, 0.65 * s_], [0.9 * c, -0.5, 0.9 * s_]])
        V, F, _, _ = pl.sweep(path, 0.02, sides=4, cap_start=False, cap_end=False)
        parts.append((V, F, np.tile(H("#c7cdf8"), (len(V), 1))))
    return pl.combine(parts)


# ─── Penicillin G ──────────────────────────────────────────────────

# Heavy atoms in ångströms (a flattened layout of benzylpenicillin): the
# beta-lactam square fused to the thiazolidine ring, its gem-dimethyl and
# carboxyl, and the phenylacetyl amide side chain.
PEN_ATOMS = [
    ("N", (0.0, 0.0, 0.0)), ("C", (1.05, 0.55, 0.15)), ("C", (1.2, -0.95, 0.0)), ("C", (-0.05, -1.45, -0.1)),
    ("O", (-0.6, -2.5, -0.25)), ("S", (2.3, 1.45, -0.35)), ("C", (1.05, 2.75, 0.2)), ("C", (-0.15, 1.3, 0.1)),
    ("C", (1.55, 3.6, 1.35)), ("C", (0.8, 3.6, -1.0)), ("C", (-1.5, 1.6, 0.3)), ("O", (-2.3, 0.75, 0.6)), ("O", (-1.95, 2.85, 0.15)),
    ("N", (2.45, -1.7, 0.1)), ("C", (3.7, -1.25, 0.25)), ("O", (3.95, -0.05, 0.35)), ("C", (4.85, -2.25, 0.25)),
    ("C", (6.2, -1.6, 0.3)), ("C", (7.1, -1.85, -0.75)), ("C", (8.35, -1.25, -0.7)), ("C", (8.7, -0.4, 0.35)), ("C", (7.8, -0.15, 1.4)), ("C", (6.55, -0.75, 1.35)),
]
PEN_BONDS = [(0, 1), (1, 2), (2, 3), (3, 0), (3, 4), (1, 5), (5, 6), (6, 7), (7, 0), (6, 8), (6, 9), (7, 10), (10, 11), (10, 12), (2, 13), (13, 14), (14, 15), (14, 16), (16, 17), (17, 18), (18, 19), (19, 20), (20, 21), (21, 22), (22, 17)]
CPK = {"C": ("#9aa3ad", 0.36), "N": ("#4f7df0", 0.34), "O": ("#ef4f4f", 0.33), "S": ("#f2c230", 0.45)}


def penicillin():
    P = np.array([a[1] for a in PEN_ATOMS], dtype=np.float64)
    P -= P.mean(axis=0)
    P *= 0.1  # 1 Å → 0.1 scene units at scale 1; the scene sizes it
    parts = []
    for (el, _), p in zip(PEN_ATOMS, P):
        col, r = CPK[el]
        V, F = pl.ellipsoid_mesh(p, (r * 0.1,) * 3, nu=8, nv=6)
        parts.append((V, F, np.tile(H(col), (len(V), 1))))
    for i, j in PEN_BONDS:
        path = np.stack([P[i], P[j]])
        V, F, tt, _ = pl.sweep(path, 0.011, sides=5, cap_start=False, cap_end=False)
        parts.append((V, F, mix(H(CPK[PEN_ATOMS[i][0]][0]), H(CPK[PEN_ATOMS[j][0]][0]), sm(0.45, 0.55, tt))))
    return pl.combine(parts)


def meta():
    return {
        "units": "scene",
        "cell": {"half": HALF, "layers": LAYERS, "windows": WINDOWS},
        "flagella": [{"hookEnd": f["hookEnd"].round(4).tolist(), "dir": f["dir"].round(4).tolist()} for f in flagella_layout()],
        "nucleoidCentre": NUCLEOID_C.tolist(),
        "phage": {"sheathLength": SHEATH_LENGTH, "headCentre": HEAD_C, "headRadius": HEAD_R, "headStretch": HEAD_STRETCH},
    }

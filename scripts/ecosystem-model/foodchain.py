"""The organisms of the food-chain scene, in centimetres, y up, each in its
own frame with its feet (or base) at the origin and facing +x.

  sprig        a pedunculate oak (Quercus robur) shoot tip: a twig with a
               rosette of lobed leaves and a pair of acorns on a stalk
  caterpillar  a winter moth (Operophtera brumata) larva, the oak-wood
               caterpillar blue tits time their broods to. A looper: two
               pairs of prolegs only, so it walks by arching its back. The
               mesh is stretched; the morph "loop" is the same body arched
  blueTit      Cyanistes caeruleus, standing
  hawk         an adult male sparrowhawk (Accipiter nisus) perched on a
               fallen log

Thin, branching or segmented things are built parametrically (leaves, twig,
caterpillar); the birds and the log are signed-distance sculptures, meshed by
scripts/arm-model's mesher. Colours are per vertex, in sRGB terms.
"""

import math

import numpy as np

import plantlib as pl
from plantlib import sdf

H = pl.hex_rgb


def _rz(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0.0], [s, c, 0.0], [0.0, 0.0, 1.0]])


def _noise(P, scale, seed):
    return sdf.value_noise(np.asarray(P, dtype=np.float64), scale, seed)


def _grid_faces(nu, nv, flip=False):
    F = []
    for i in range(nu - 1):
        for j in range(nv - 1):
            a, b, c, d = i * nv + j, i * nv + j + 1, (i + 1) * nv + j + 1, (i + 1) * nv + j
            F.append([a, d, c, b] if not flip else [a, b, c, d])
    return np.asarray(F)


def _seg_dist(P, a, b):
    """Distance from 2D points P (N,2) to the segment a-b."""
    a = np.asarray(a, dtype=np.float64)
    ab = np.asarray(b, dtype=np.float64) - a
    t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * ab), axis=1)


# ─── Oak ───────────────────────────────────────────────────────────

LEAF_TOP = H("#3f7a2c")
LEAF_UNDER = H("#7da55a")
LEAF_VEIN = H("#a9c766")


def oak_half_width(u, side):
    """Half-width of a pedunculate oak leaf as a fraction of its length:
    obovate, four rounded lobes a side and a terminal one, the sides out of
    step, small auricles at the base and almost no petiole."""
    ph = 0.0 if side > 0 else 0.07
    uc = np.clip(u, 1e-4, 1.0)
    env = np.sin(np.pi * uc**0.95) ** 0.7 * (0.22 + 0.78 * uc)
    lob = 0.38 + 0.62 * np.abs(np.cos(np.pi * (4.5 * u + ph))) ** 0.4
    blade = 0.34 * env * lob * pl.smooth(0.02, 0.1, u)
    aur = 0.025 * np.exp(-(((u - 0.08) / 0.03) ** 2))
    return 0.009 + blade + aur


def oak_leaf(L, seed=0):
    """One leaf, petiole at the origin, midrib along +x, upper face +y.
    Two skins 0.03 cm apart (the upper dark and glossy, the lower paler)."""
    r = pl.rng(seed)
    nu, nv = 50, 13
    u = np.linspace(0, 1, nu)
    v = np.linspace(-1, 1, nv)
    U, Vv = np.meshgrid(u, v, indexing="ij")
    hp = oak_half_width(u, 1) * L
    hn = oak_half_width(u, -1) * L
    HW = np.where(Vv >= 0, hp[:, None], hn[:, None])
    x = U * L
    z = Vv * HW
    wave = r.uniform(0, 6.28)
    y = 0.16 * np.abs(z) + L * (0.05 * U - 0.07 * U**2) + 0.05 * np.sin(7 * U + wave) * np.abs(Vv) * L * 0.08
    top = np.stack([x, y, z], axis=-1).reshape(-1, 3)
    bot = top - np.array([0, 0.03, 0])
    F = _grid_faces(nu, nv, flip=True)
    V = np.concatenate([top, bot])
    F = np.concatenate([F, _grid_faces(nu, nv) + len(top)])
    # Veins: the midrib, and one secondary to each lobe tip.
    XZ = top[:, [0, 2]]
    d = np.abs(XZ[:, 1]) + 0.0 * XZ[:, 0]
    w = 0.06 + 0.06 * (1 - top[:, 0] / L)
    vein = (d < w).astype(float)
    for side, h in ((1, hp), (-1, hn)):
        ph = 0.0 if side > 0 else 0.07
        for k in range(1, 5):
            uk = (k - ph) / 4.5
            if uk >= 0.97:
                continue
            hk = np.interp(uk, u, h)
            dd = _seg_dist(XZ, ((uk - 0.11) * L, 0.0), (uk * L, side * 0.86 * hk))
            vein = np.maximum(vein, pl.smooth(0.1, 0.03, dd) * 0.6)
    shade = 1 + 0.07 * _noise(top * [1, 1, 1], 1.3, seed + 3)
    ctop = pl.mix(LEAF_TOP, LEAF_VEIN, vein * 0.75) * shade[:, None]
    # Edges a touch yellower, as a sunlit leaf's are.
    edge = np.clip(np.abs(Vv.ravel()) - 0.8, 0, 1) / 0.2
    ctop = pl.mix(ctop, H("#6b9a35"), edge * 0.3)
    cbot = pl.mix(LEAF_UNDER, H("#c4d89a"), vein * 0.7)
    C = np.concatenate([ctop, cbot])
    return V, F, np.clip(C, 0, 1)


def _frame(d, up=(0, 1, 0), twist=0.0):
    """Rotation whose columns are (midrib d, upper-face normal, across)."""
    d = np.asarray(d, dtype=np.float64)
    d /= np.linalg.norm(d)
    n = np.asarray(up, dtype=np.float64) - np.dot(up, d) * d
    n /= np.linalg.norm(n)
    s = np.cross(d, n)
    c, sn = math.cos(twist), math.sin(twist)
    n, s = n * c + s * sn, -n * sn + s * c
    return np.stack([d, n, s], axis=1)


def acorn(base, hang, seed):
    """An acorn hanging from `base` along `hang`: a cup of scales and the nut."""
    hang = np.asarray(hang, dtype=np.float64) / np.linalg.norm(hang)
    R = pl.rot_to((0, -1, 0), hang)
    cup_c = base + hang * 0.45
    Vc, Fc = pl.ellipsoid_mesh((0, 0, 0), (0.62, 0.48, 0.62), nu=14, nv=9)
    Vc[:, 1] = np.minimum(Vc[:, 1], 0.12)
    Vc = Vc @ R.T + cup_c
    sc = _noise(Vc * 6, 1.0, seed)
    Cc = pl.mix(H("#6f5b3a"), H("#9b8558"), 0.5 + 0.5 * sc)
    nut_c = base + hang * 1.25
    Vn, Fn = pl.ellipsoid_mesh((0, 0, 0), (0.5, 0.82, 0.5), nu=14, nv=11)
    Vn = Vn @ R.T + nut_c
    t = np.clip(((Vn - nut_c) @ hang + 0.82) / 1.64, 0, 1)
    Cn = pl.mix(H("#8b9a3c"), H("#a9823a"), pl.smooth(0.2, 0.9, t))
    tip = t > 0.95
    Cn[tip] = H("#5a4326")
    return (Vc, Fc, Cc), (Vn, Fn, Cn)


def sprig(seed=1):
    """An oak shoot tip, ~15 cm tall: twig, a rosette of five leaves at the
    tip (oak leaves crowd at the end of each year's growth), two lower
    leaves, and a pair of acorns on a long stalk."""
    r = pl.rng(seed)
    parts = []
    path = pl.catmull([(0, 0, 0), (0.25, 3.0, 0.15), (0.75, 6.4, -0.15), (1.2, 9.2, 0.25)], 10)
    rad = np.interp(np.linspace(0, 1, len(path)), [0, 1], [0.24, 0.12])
    Vt, Ft, tt, aa = pl.sweep(path, rad, sides=8, cap_start=True, cap_end=True)
    bark = pl.mix(H("#5f4a33"), H("#7a6a4a"), 0.5 + 0.5 * _noise(Vt * 3, 1.0, seed))
    parts.append((Vt, pl.quads_to_tris(Ft), bark))
    tip = path[-1]
    phi0 = r.uniform(0, 6.28)
    for k in range(5):
        phi = phi0 + k * 2 * math.pi / 5 + r.uniform(-0.25, 0.25)
        th = math.radians(r.uniform(28, 58))
        d = np.array([math.cos(th) * math.cos(phi), math.sin(th), math.cos(th) * math.sin(phi)])
        L = r.uniform(7.0, 9.4)
        V, F, C = oak_leaf(L, seed * 13 + k)
        R = _frame(d, twist=r.uniform(-0.35, 0.35))
        parts.append((V @ R.T + tip, pl.quads_to_tris(F), C))
    for k, (h, phi) in enumerate(((4.6, phi0 + 1.2), (7.0, phi0 + 4.1))):
        p = pl.catmull([(0, 0, 0), (0.25, 3.0, 0.15), (0.75, 6.4, -0.15), (1.2, 9.2, 0.25)], 10)
        base = p[int(np.argmin(np.abs(p[:, 1] - h)))]
        th = math.radians(18)
        d = np.array([math.cos(th) * math.cos(phi), math.sin(th), math.cos(th) * math.sin(phi)])
        V, F, C = oak_leaf(r.uniform(6.0, 7.2), seed * 29 + k)
        R = _frame(d, twist=r.uniform(-0.3, 0.3))
        parts.append((V @ R.T + base, pl.quads_to_tris(F), C))
    # Pedunculate: the acorns hang on a stalk several cm long.
    base = path[int(len(path) * 0.55)]
    phi = phi0 + 2.6
    out = np.array([math.cos(phi), 0, math.sin(phi)])
    ped = pl.catmull([base, base + out * 1.6 + [0, 0.5, 0], base + out * 3.0 - [0, 0.6, 0]], 6)
    Vp, Fp, _, _ = pl.sweep(ped, 0.07, sides=6)
    parts.append((Vp, pl.quads_to_tris(Fp), np.tile(H("#6a6a3a"), (len(Vp), 1))))
    end = ped[-1]
    for k, off in enumerate((out * 0.15 + np.cross(out, [0, 1, 0]) * 0.55, -np.cross(out, [0, 1, 0]) * 0.5)):
        for V, F, C in acorn(end + off, np.array([0, -1, 0]) + off * 0.6, seed * 7 + k):
            parts.append((V, pl.quads_to_tris(F), C))
    return pl.combine(parts)


# ─── Caterpillar ───────────────────────────────────────────────────

CAT_L = 2.8
CAT_R = 0.21
CAT_N = 96
CAT_SEG = 13  # three thoracic and ten abdominal segments behind the head


def _turtle(kappa, n=CAT_N, L=CAT_L):
    """A planar path of length L from heading 0 at the tail (x = -L/2),
    curving by kappa(s) per unit length; n stations evenly spaced in s."""
    s = np.linspace(0, L, n * 8)
    k = kappa(s / L)
    ds = s[1] - s[0]
    th = np.concatenate([[0], np.cumsum(k[:-1] * ds)])
    x = np.concatenate([[0], np.cumsum(np.cos(th[:-1]) * ds)])
    y = np.concatenate([[0], np.cumsum(np.sin(th[:-1]) * ds)])
    idx = np.linspace(0, len(s) - 1, n).round().astype(int)
    P = np.stack([x[idx] - L / 2, y[idx] + CAT_R, np.zeros(n)], axis=1)
    return P


def _cat_path(loop):
    if not loop:
        return _turtle(lambda t: 0.25 * np.sin(t * 9.0) * 0)
    up = math.radians(82)
    a, b, c, d = 0.34, 0.07, 0.10, 0.14

    def kappa(t):
        k = np.zeros_like(t)
        e = a
        k[(t >= e) & (t < e + b)] = up / (b * CAT_L)
        e += b + c
        k[(t >= e) & (t < e + d)] = -2 * up / (d * CAT_L)
        e += d + c
        k[(t >= e) & (t < e + b)] = up / (b * CAT_L)
        return k

    return _turtle(kappa)


def _cat_radius(t):
    r = CAT_R * (0.72 + 0.28 * pl.smooth(0.0, 0.1, t)) * (1 - 0.18 * pl.smooth(0.86, 1.0, t))
    return r * (0.9 + 0.1 * np.sin(np.pi * CAT_SEG * t) ** 2)


def caterpillar(loop=False):
    """The larva, tail at t = 0, head at t = 1. Same topology in both poses."""
    path = _cat_path(loop)
    t = np.linspace(0, 1, len(path))
    rad = _cat_radius(t)
    Vb, Fb, tt, aa = pl.sweep(path, rad, sides=16, cap_start=True, cap_end=False)
    T, N, Bn = pl.frames(path)
    # Body: aa = 0 is ventral (N points down on a flat path), 0.5 dorsal.
    da = np.abs(aa - 0.5)
    C = np.tile(H("#6fae3c"), (len(Vb), 1))
    C = pl.mix(C, H("#9cc965"), (da > 0.36).astype(float))
    C = pl.mix(C, H("#3f7a22"), (da < 0.04).astype(float))
    C = pl.mix(C, H("#e2f0b8"), ((da > 0.12) & (da < 0.15)).astype(float) * 0.8)
    C = pl.mix(C, H("#eef3c8"), ((da > 0.29) & (da < 0.325)).astype(float) * 0.85)
    ring = np.cos(np.pi * CAT_SEG * tt) ** 16
    C = C * (1 - 0.12 * ring)[:, None]
    parts = [(Vb, pl.quads_to_tris(Fb), C)]
    # Head capsule, a little narrower than T1, with dark mandibles.
    hc = path[-1] + T[-1] * 0.12
    R = np.stack([T[-1], -N[-1], Bn[-1]], axis=1)
    Vh, Fh = pl.ellipsoid_mesh((0, 0, 0), (0.21, 0.19, 0.2), nu=14, nv=10)
    Ch = np.tile(H("#7aa63c"), (len(Vh), 1))
    Ch[(Vh[:, 0] > 0.14) & (Vh[:, 1] < 0.02)] = H("#3a3420")
    Ch[(Vh[:, 0] > 0.08) & (np.abs(Vh[:, 2]) > 0.14) & (Vh[:, 1] > -0.02)] = H("#2c3a1c")
    parts.append((Vh @ R.T + hc, pl.quads_to_tris(Fh), Ch))
    # Three pairs of true legs, and prolegs on A6 and A10 only (a looper).
    def seg_t(k):
        return 1 - (k + 0.5) / CAT_SEG * 0.94

    legs = [(seg_t(k), 0.07, 0.025, H("#55772b")) for k in (0, 1, 2)] + [(seg_t(8), 0.1, 0.05, H("#7fb34e")), (0.03, 0.1, 0.055, H("#7fb34e"))]
    for tl, ln, rl, col in legs:
        i = int(round(tl * (len(path) - 1)))
        for side in (-1, 1):
            base = path[i] + N[i] * rad[i] * 0.55 + Bn[i] * side * rad[i] * 0.6
            tip = base + N[i] * (rad[i] * 0.45 + ln) + Bn[i] * side * 0.02
            Vl, Fl, lt, _ = pl.sweep(np.stack([base, (base + tip) / 2, tip]), np.array([rl, rl * 0.85, rl * 0.6]), sides=6, cap_start=False)
            Cl = np.tile(col, (len(Vl), 1))
            Cl[lt > 0.85] = H("#3c4a24")
            parts.append((Vl, pl.quads_to_tris(Fl), Cl))
    return pl.combine(parts)


# ─── Birds ─────────────────────────────────────────────────────────


def _dirs(P, c):
    q = P - np.asarray(c)
    return q / np.maximum(np.linalg.norm(q, axis=1, keepdims=True), 1e-9)


class Bird:
    """A bird as named signed-distance parts; `field` blends them, `part`
    says which one a surface point belongs to."""

    def __init__(self, parts, blends):
        self.parts = parts  # name -> fn(P)
        self.blends = blends  # list of (name, k): blended in, in order

    def field(self):
        def f(P):
            d = None
            for name, k in self.blends:
                v = self.parts[name](P)
                d = v if d is None else sdf.smin(d, v, k)
            return d

        return f

    def part(self, P):
        names = list(self.parts)
        D = np.stack([self.parts[n](P) for n in names], axis=1)
        return np.array(names)[np.argmin(D, axis=1)]


# Blue tit, ~11.5 cm bill to tail.
TIT = {
    "body": ((0.0, 3.7, 0.0), (3.4, 2.55, 2.45), 0.42),
    "head": ((2.55, 5.95, 0.0), 1.95),
    "eye": 0.28,
}


def blue_tit():
    bc, br, ba = TIT["body"]
    hc, hr = TIT["head"]
    p = {
        "body": lambda P: sdf._ellipsoid(P, bc, br, (0, 0, ba)),
        "head": lambda P: np.linalg.norm(P - np.asarray(hc), axis=1) - hr,
        "beak": lambda P: sdf._round_cone(P, (4.2, 5.78, 0), (5.25, 5.6, 0), 0.4, 0.05),
        "tail": lambda P: sdf._ellipsoid(P, (-4.0, 2.45, 0), (2.6, 0.32, 1.15), (0, 0, 0.42)),
        "wingL": lambda P: sdf._ellipsoid(P, (-0.6, 3.95, 1.8), (3.0, 1.5, 0.55), (0, -0.14, 0.4)),
        "wingR": lambda P: sdf._ellipsoid(P, (-0.6, 3.95, -1.8), (3.0, 1.5, 0.55), (0, 0.14, 0.4)),
    }
    for side, z in (("L", 0.6), ("R", -0.6)):
        p["leg" + side] = lambda P, z=z: sdf._capsule(P, (0.25, 1.7, z), (0.45, 0.25, z * 1.2), 0.17, 0.13)
        p["toes" + side] = lambda P, z=z: np.minimum.reduce(
            [
                sdf._capsule(P, (0.45, 0.15, z * 1.2), (1.45, 0.1, z * 1.2 + 0.32 * np.sign(z)), 0.09, 0.07),
                sdf._capsule(P, (0.45, 0.15, z * 1.2), (1.55, 0.1, z * 1.2), 0.09, 0.07),
                sdf._capsule(P, (0.45, 0.15, z * 1.2), (1.35, 0.1, z * 1.2 - 0.3 * np.sign(z)), 0.09, 0.07),
                sdf._capsule(P, (0.45, 0.15, z * 1.2), (-0.45, 0.1, z * 1.2), 0.09, 0.07),
            ]
        )
    blends = [("body", 0), ("head", 0.9), ("beak", 0.15), ("tail", 0.45), ("wingL", 0.22), ("wingR", 0.22), ("legL", 0.25), ("legR", 0.25), ("toesL", 0.08), ("toesR", 0.08)]
    return Bird(p, blends)


def blue_tit_colour(bird):
    bc, br, ba = TIT["body"]
    hc, hr = TIT["head"]
    R = _rz(ba)

    def colour(P, N):
        part = bird.part(P)
        S = pl.smooth
        C = np.tile(H("#8a9c55"), (len(P), 1))  # olive-green mantle

        def lay(col, w):
            nonlocal C
            C = pl.mix(C, H(col), np.clip(w, 0, 1))

        q = _dirs(P, hc)
        # Body: sulphur-yellow below a line from the throat to the vent.
        l = (P - np.asarray(bc)) @ R
        under = S(0.3, -0.3, l[:, 1] + 0.08 * l[:, 0] - 0.35)
        lay("#f0d23a", under)
        lay("#5d6844", under * S(0.35, 0.1, np.abs(P[:, 2])) * S(-0.9, -1.4, l[:, 1]) * 0.6)
        # Head: a cobalt cap ringed white, a navy stripe through the eye to
        # the nape, white cheeks, a navy collar and a small black bib.
        dist = np.linalg.norm(P - np.asarray(hc), axis=1)
        h = S(hr + 0.6, hr + 0.1, dist) * (part != "beak")
        stripe_y = 0.12 + 0.2 * np.clip(-q[:, 0], 0, 1)
        lay("#f3f4ee", h * S(-0.55, -0.4, q[:, 1]))
        lay("#2c6fd2", h * S(0.44, 0.54, q[:, 1]) * S(0.86, 0.74, q[:, 0]))
        lay("#1b2340", h * S(0.12, 0.07, np.abs(q[:, 1] - stripe_y)) * S(0.9, 0.8, q[:, 0]))
        lay("#22336a", h * S(-0.45, -0.7, q[:, 0]) * S(-0.3, -0.1, q[:, 1]) * S(0.55, 0.45, q[:, 1]))
        lay("#1f2a52", h * S(-0.45, -0.55, q[:, 1]) * S(0.2, 0.35, np.abs(q[:, 2])))
        lay("#1b2340", h * S(-0.3, -0.45, q[:, 1]) * S(0.4, 0.55, q[:, 0]) * S(0.5, 0.35, np.abs(q[:, 2])))
        # Wings: blue, a white bar across the coverts, dark primaries.
        w = np.isin(part, ["wingL", "wingR"]).astype(float)
        u = (P[:, 0] + 0.6) / 3.0
        lay("#3a74c9", w)
        lay("#eef3f5", w * S(0.14, 0.2, u) * S(0.36, 0.3, u))
        lay("#26355d", w * S(-0.35, -0.5, u))
        lay("#4f6fae", w * S(-0.35, -0.5, u) * S(0.6, 0.95, np.abs(np.sin(P[:, 0] * 7))) * 0.7)
        lay("#2f63b6", (part == "tail").astype(float))
        lay("#2a2b30", (part == "beak").astype(float))
        lay("#76869f", np.isin(part, ["legL", "legR", "toesL", "toesR"]).astype(float))
        return np.clip(C * (1 + 0.05 * _noise(P, 0.35, 5))[:, None], 0, 1)

    return colour


def eye_meshes(centre, radius, direction, r_eye, iris=None, pupil="#0d0d10"):
    """A glossy black bead (or an iris with a pupil) set into the head."""
    out = []
    for s in (1, -1):
        d = np.array([direction[0], direction[1], direction[2] * s])
        d /= np.linalg.norm(d)
        c = np.asarray(centre) + d * (radius - r_eye * 0.35)
        V, F = pl.ellipsoid_mesh((0, 0, 0), (r_eye, r_eye, r_eye), nu=14, nv=10)
        R = pl.rot_to((0, 1, 0), d)
        V = V @ R.T + c
        if iris is None:
            C = np.tile(H(pupil), (len(V), 1))
            hl = ((V - c) @ (d + [0, 0.6, 0]) / np.linalg.norm(d + [0, 0.6, 0])) > r_eye * 0.82
            C[hl] = H("#e8eef5")
        else:
            k = (V - c) @ d / r_eye
            C = np.tile(H(iris), (len(V), 1))
            C[k > 0.72] = H(pupil)
        out.append((V, pl.quads_to_tris(F), C))
    return out


# Sparrowhawk (adult male), ~31 cm, upright; feet at y = 0 on the log.
HAWK = {
    "body": ((0.2, 9.4, 0.0), (7.0, 4.3, 4.1), 1.05),
    "head": ((2.6, 17.3, 0.0), (3.2, 2.9, 2.85)),
    "log": 4.4,
}


def hawk():
    bc, br, ba = HAWK["body"]
    hc, hr = HAWK["head"]
    p = {
        "body": lambda P: sdf._ellipsoid(P, bc, br, (0, 0, ba)),
        "head": lambda P: sdf._ellipsoid(P, hc, hr, (0, 0, 0.1)),
        "brow": lambda P: np.minimum(
            sdf._ellipsoid(P, (4.1, 18.35, 1.45), (1.3, 0.55, 0.8), (0, 0.3, -0.15)),
            sdf._ellipsoid(P, (4.1, 18.35, -1.45), (1.3, 0.55, 0.8), (0, -0.3, -0.15)),
        ),
        "beak": lambda P: np.minimum(
            sdf._round_cone(P, (5.0, 17.3, 0), (6.45, 16.85, 0), 0.95, 0.38),
            sdf._round_cone(P, (6.45, 16.85, 0), (6.8, 15.9, 0), 0.38, 0.07),
        ),
        "tail": lambda P: sdf._ellipsoid(P, (-4.0, -0.6, 0), (0.55, 7.2, 2.0), (0, 0, -0.36)),
        "wingL": lambda P: sdf._ellipsoid(P, (-1.3, 8.6, 3.05), (7.8, 2.7, 0.95), (0, -0.1, 1.15)),
        "wingR": lambda P: sdf._ellipsoid(P, (-1.3, 8.6, -3.05), (7.8, 2.7, 0.95), (0, 0.1, 1.15)),
        "thighL": lambda P: sdf._ellipsoid(P, (1.4, 4.1, 1.7), (1.8, 2.3, 1.4), (0, 0, -0.2)),
        "thighR": lambda P: sdf._ellipsoid(P, (1.4, 4.1, -1.7), (1.8, 2.3, 1.4), (0, 0, -0.2)),
    }
    for side, z in (("L", 1.5), ("R", -1.5)):
        p["leg" + side] = lambda P, z=z: sdf._capsule(P, (1.6, 2.6, z), (1.9, 0.45, z), 0.38, 0.33)
        p["toes" + side] = lambda P, z=z: np.minimum.reduce(
            [
                sdf._capsule(P, (1.9, 0.35, z), (4.1, 0.05, z + 0.9 * np.sign(z)), 0.24, 0.17),
                sdf._capsule(P, (1.9, 0.35, z), (4.4, -0.1, z), 0.24, 0.17),
                sdf._capsule(P, (1.9, 0.35, z), (3.9, 0.05, z - 0.8 * np.sign(z)), 0.24, 0.17),
                sdf._capsule(P, (1.9, 0.35, z), (0.2, 0.0, z), 0.24, 0.17),
            ]
        )
        p["talons" + side] = lambda P, z=z: np.minimum.reduce(
            [
                sdf._round_cone(P, (4.1, 0.05, z + 0.9 * np.sign(z)), (4.45, -0.5, z + 1.0 * np.sign(z)), 0.17, 0.04),
                sdf._round_cone(P, (4.4, -0.1, z), (4.75, -0.65, z), 0.17, 0.04),
                sdf._round_cone(P, (3.9, 0.05, z - 0.8 * np.sign(z)), (4.25, -0.5, z - 0.9 * np.sign(z)), 0.17, 0.04),
                sdf._round_cone(P, (0.2, 0.0, z), (-0.15, -0.55, z), 0.17, 0.04),
            ]
        )
    blends = [
        ("body", 0),
        ("head", 1.6),
        ("brow", 0.35),
        ("beak", 0.25),
        ("tail", 0.6),
        ("wingL", 0.3),
        ("wingR", 0.3),
        ("thighL", 0.7),
        ("thighR", 0.7),
        ("legL", 0.3),
        ("legR", 0.3),
        ("toesL", 0.15),
        ("toesR", 0.15),
        ("talonsL", 0.06),
        ("talonsR", 0.06),
    ]
    return Bird(p, blends)


def hawk_colour(bird):
    bc, br, ba = HAWK["body"]
    hc, hr = HAWK["head"]
    R = _rz(ba)
    SLATE = H("#56657a")
    CREAM = H("#f0e7d8")
    RUFOUS = H("#c86a3a")

    def colour(P, N):
        part = bird.part(P)
        C = np.tile(SLATE, (len(P), 1))
        l = (P - np.asarray(bc)) @ R
        under = l[:, 1] < 1.0 - 0.05 * l[:, 0]
        # Fine rufous chevrons on cream, the male's barring.
        bars = np.sin((P[:, 1] + 0.35 * np.abs(P[:, 2])) * 2 * np.pi / 1.05) > 0.15
        u = under & np.isin(part, ["body", "thighL", "thighR"])
        C[u] = CREAM
        C[u & bars] = pl.mix(RUFOUS, CREAM, 0.15)
        # Head: slate cap and nape, rufous cheeks, pale streaked throat.
        q = _dirs(P, hc)
        h = np.isin(part, ["head", "brow"])
        C[h] = H("#4b586b")
        cheek = h & (q[:, 1] < 0.15) & (q[:, 1] > -0.6) & (np.abs(q[:, 2]) > 0.45) & (q[:, 0] > -0.5)
        C[cheek] = H("#cf7d48")
        throat = h & (q[:, 1] < -0.35) & (np.abs(q[:, 2]) < 0.6)
        C[throat] = pl.mix(CREAM, H("#b8a58a"), (np.sin(P[throat, 2] * 18) > 0.6).astype(float))
        # Wings: slate coverts, darker barred primaries towards the tips.
        for side in ("wingL", "wingR"):
            w = part == side
            along = (P[:, 1] - 8.6) / 7.0
            C[w] = SLATE
            dark = w & (along < -0.25)
            C[dark] = H("#3d4656")
            C[dark & (np.sin(P[:, 1] * 3.2) > 0.55)] = H("#2c323d")
        # Tail: grey with four dark bands and a pale tip.
        t = part == "tail"
        tl = P[:, 1]
        C[t] = H("#687586")
        C[t & (np.sin((tl + 1.0) * 2 * np.pi / 3.2) > 0.6)] = H("#2f3540")
        C[t & (tl < -7.0)] = H("#e9e4da")
        # Beak dark with a yellow cere; legs and feet yellow; talons black.
        bk = part == "beak"
        C[bk] = H("#2b2f36")
        C[bk & (P[:, 0] < 5.6)] = H("#e5c548")
        for s in ("legL", "legR", "toesL", "toesR"):
            C[part == s] = H("#e2bd3c")
        for s in ("talonsL", "talonsR"):
            C[part == s] = H("#17181b")
        return np.clip(C * (1 + 0.05 * _noise(P, 0.6, 9))[:, None], 0, 1)

    return colour


def log_field():
    """A fallen log along z under the hawk's feet: barked, cut square at
    both ends; its top is at y = 0."""
    R = HAWK["log"]
    c = np.array([0.4, -R, 0.0])

    def f(P):
        d = sdf._cylinder(P, c + [0, 0, -8.5], c + [0, 0, 8.5], R)
        return sdf.roughen(d, P, 0.18, (1.6, 1.6, 4.0), seed=21)

    return f


def log_colour(P, N):
    R = HAWK["log"]
    c = np.array([0.4, -R, 0.0])
    r = np.linalg.norm((P - c)[:, :2], axis=1)
    bark = pl.mix(H("#4b3a2a"), H("#6b5640"), 0.5 + 0.5 * _noise(P * [1, 1, 0.3], 0.5, 4))
    C = bark
    end = np.abs(N[:, 2]) > 0.75
    rings = 0.5 + 0.5 * np.sin(r * 9.0)
    C[end] = pl.mix(H("#b8976a"), H("#8e6f4a"), rings[end] * 0.6 + 0.3 * (r[end] / R))
    moss = (N[:, 1] > 0.55) & (_noise(P, 1.2, 8) > 0.05) & ~end
    C[moss] = pl.mix(H("#5f7f34"), H("#7d9a44"), 0.5 + 0.5 * _noise(P[moss], 0.3, 2))
    return np.clip(C, 0, 1)


def meta():
    return {
        "units": "cm",
        "sizes": {"sprig": 15.0, "caterpillar": CAT_L, "blueTit": 11.5, "hawk": 31.0},
        "logRadius": HAWK["log"],
    }

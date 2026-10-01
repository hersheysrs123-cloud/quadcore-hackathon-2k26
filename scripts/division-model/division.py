"""The parts of the cell-division scene that are modelled rather than drawn,
each in its own unit frame (y up). The scene scales and places them.

CHROMATIN TERRITORIES (`territory0`..`territory3`): in interphase each
chromosome is a decondensed fibre occupying its own territory of the
nucleus, not a tangle shared with the others. Each territory is one long
fibre on a ball-of-yarn path with a fine coil, in a ball of radius about 1.
The scene draws one per chromatid where that chromosome is, tinted by its
parent, and shrinks it as the chromosome condenses.

NUCLEOLUS: a granular body with paler fibrillar centres (radius ~1).

NUCLEAR ENVELOPE: a unit sphere shell perforated by nuclear pores, each
ringed by its pore complex. The scene breaks it up in prophase and
re-forms it in telophase.

CENTRIOLES: a barrel of nine triplet microtubules (A innermost, the C
tubule shorter), a cartwheel at the proximal end; the mother also carries
nine distal appendages. Axis +y, proximal end at the origin, length 1.
PCM: the pericentriolar material, a lumpy cloud (radius ~1).

MITOCHONDRION: a bent capsule along x (length ~1.3) with cristae painted
through its outer membrane.
"""

import math

import numpy as np

import plantlib as pl

sdf = pl.sdf
H = pl.hex_rgb


def mix(a, b, t):
    return pl.mix(np.asarray(a, dtype=np.float64), np.asarray(b, dtype=np.float64), np.clip(t, 0, 1))


# ─── Chromatin territories ──────────────────────────────────────────

TERRITORIES = 4


def territory(variant):
    """One chromosome's decondensed fibre, confined to a ball of radius ~1."""
    rnd = pl.rng(31 + 7 * variant)
    t = np.linspace(0, 1, 6000)
    f = rnd.uniform(0.85, 1.15, 6) * np.array([4.0, 5.0, 6.0, 11.0, 13.0, 9.0])
    ph = rnd.uniform(0, 2 * math.pi, 6)
    x = 0.62 * np.sin(2 * math.pi * f[0] * t + ph[0]) + 0.22 * np.sin(2 * math.pi * f[3] * t + ph[3])
    y = 0.68 * np.sin(2 * math.pi * f[1] * t + ph[1]) + 0.2 * np.sin(2 * math.pi * f[4] * t + ph[4])
    z = 0.6 * np.sin(2 * math.pi * f[2] * t + ph[2]) + 0.22 * np.sin(2 * math.pi * f[5] * t + ph[5])
    base = np.stack([x, y, z], axis=1)
    # Keep it inside the ball: pull points beyond r = 0.92 back in.
    r = np.linalg.norm(base, axis=1, keepdims=True)
    base = base * np.minimum(1.0, 0.92 / np.maximum(r, 1e-9))
    base = pl.resample(base, 0.03)
    T, Nn, Bn = pl.frames(base)
    s = np.arange(len(base)) * 0.03
    tw = 2 * math.pi * s / 0.24  # the fibre coils on itself
    path = base + 0.04 * (np.cos(tw)[:, None] * Nn + np.sin(tw)[:, None] * Bn)
    path = pl.resample(path, 0.032)
    V, F, tt, _ = pl.sweep(path, 0.032, sides=5)
    # Euchromatin (pale, open) and heterochromatin (denser, darker) alternate along the fibre.
    hetero = sdf.value_noise(np.stack([tt * 40, np.zeros_like(tt), np.full_like(tt, variant)], axis=1), 1.0, 5)
    n = sdf.value_noise(V, 0.12, 9 + variant)
    C = mix(H("#f4f0ff"), H("#cfc4f2"), 0.5 + 0.5 * n)
    C = mix(C, H("#9d8fd6"), np.clip(hetero * 1.6 - 0.35, 0, 1))
    return V, F, C


# ─── Nucleolus ──────────────────────────────────────────────────────


def nucleolus_field(P):
    a = sdf._ellipsoid(P, (0.0, 0.0, 0.0), (0.82, 0.74, 0.78), (0.2, 0.4, 0.1))
    b = sdf._ellipsoid(P, (0.38, 0.22, 0.12), (0.5, 0.46, 0.5), (0.0, 0.0, 0.0))
    c = sdf._ellipsoid(P, (-0.32, -0.26, 0.05), (0.48, 0.44, 0.46), (0.0, 0.0, 0.0))
    d = sdf.smin(sdf.smin(a, b, 0.2), c, 0.2)
    return sdf.roughen(d, P, 0.07, 0.22, seed=4, octaves=3)


def nucleolus_colour(P, N):
    fc = sdf.value_noise(P, 0.28, 12)  # fibrillar centres: pale islands
    grain = sdf.value_noise(P, 0.07, 13)
    C = mix(H("#7d6bb8"), H("#a497d6"), 0.5 + 0.5 * grain)
    return mix(C, H("#efe8ff"), np.clip(fc * 2.2 - 1.1, 0, 1))


# ─── Nuclear envelope ───────────────────────────────────────────────

ENVELOPE_HALF = 0.013  # half the double membrane's thickness
PORE_STEP = 0.2  # angular spacing of the pores, radians
PORE_R = 0.03
NPC_R = 0.045
NPC_TUBE = 0.017


def _hash(i, j, k):
    return np.mod(np.sin(i * 12.9898 + j * 78.233 + k * 37.719) * 43758.5453, 1.0)


def _pore_dirs():
    out = []
    M = int(round(math.pi / PORE_STEP))
    for i in range(M + 1):
        phi = i * PORE_STEP
        n = max(1, int(round(2 * math.pi * math.sin(phi) / PORE_STEP)))
        for j in range(n):
            ph = phi + (0.0 if i in (0, M) else 0.3 * PORE_STEP * (_hash(i, j, 1) - 0.5))
            th = (0.5 * (i % 2) + j + 0.3 * (_hash(i, j, 2) - 0.5)) * 2 * math.pi / n
            out.append((math.sin(ph) * math.cos(th), math.cos(ph), math.sin(ph) * math.sin(th)))
    return np.asarray(out)


PORES = _pore_dirs()


def _nearest_pore(P):
    """Angle to the nearest pore and the height off the unit sphere, per point.
    The pores sit in latitude bands, so only the three nearest bands are searched."""
    r = np.linalg.norm(P, axis=1)
    D = P / np.maximum(r, 1e-9)[:, None]
    phi = np.arccos(np.clip(D[:, 1], -1, 1))
    th = np.arctan2(D[:, 2], D[:, 0])
    M = int(round(math.pi / PORE_STEP))
    i0 = np.round(phi / PORE_STEP).astype(int)
    best = np.full(len(P), 9.0)
    for di in (-1, 0, 1):
        i = np.clip(i0 + di, 0, M)
        n = np.maximum(1, np.round(2 * math.pi * np.sin(i * PORE_STEP) / PORE_STEP)).astype(int)
        step = 2 * math.pi / n
        for dj in (-1, 0, 1):
            j = np.mod(np.round((th / step) - 0.5 * (i % 2)).astype(int) + dj, n)
            edge = (i == 0) | (i == M)
            ph = i * PORE_STEP + np.where(edge, 0.0, 0.3 * PORE_STEP * (_hash(i, j, 1) - 0.5))
            tj = (0.5 * (i % 2) + j + 0.3 * (_hash(i, j, 2) - 0.5)) * step
            q = np.stack([np.sin(ph) * np.cos(tj), np.cos(ph), np.sin(ph) * np.sin(tj)], axis=1)
            ang = np.arccos(np.clip((D * q).sum(axis=1), -1, 1))
            best = np.minimum(best, ang)
    return best, r - 1.0


def envelope_field(P):
    ang, h = _nearest_pore(P)
    rho = ang * (1.0 + h)  # distance from the pore's axis
    shell = np.abs(h) - ENVELOPE_HALF
    shell = sdf.cut(shell, rho - PORE_R, 0.006)  # the pore itself
    ring = np.sqrt((rho - NPC_R) ** 2 + h**2) - NPC_TUBE  # the pore complex round it
    plug = np.sqrt(rho**2 + (h * 1.4) ** 2) - 0.012  # the central transporter
    return sdf.smin(sdf.smin(shell, ring, 0.008), plug, 0.004)


def envelope_colour(P, N):
    ang, h = _nearest_pore(P)
    rho = ang * (1.0 + h)
    n = sdf.value_noise(P, 0.1, 21)
    C = mix(H("#e4dbff"), H("#c9bbf5"), 0.5 + 0.5 * n)
    ringish = np.exp(-((rho - NPC_R) ** 2) / (2 * 0.016**2))
    C = mix(C, H("#7c6ad0"), ringish * 0.85)
    return mix(C, H("#4c3f99"), np.clip(1 - rho / 0.022, 0, 1))


# ─── Centrioles and the PCM ─────────────────────────────────────────

CENTRIOLE_R = 0.19  # radius to the B tubule of each triplet
TUBULE_R = 0.036
TUBULE_STEP = 0.062
BLADE_TILT = math.radians(52)


def _rod(a, b, r, sides=10):
    path = np.stack([np.linspace(a[k], b[k], 2) for k in range(3)], axis=1)
    V, F, _, _ = pl.sweep(path, r, sides=sides)
    return V, F


def centriole(mother=False):
    parts = []
    for k in range(9):
        al = 2 * math.pi * k / 9
        radial = np.array([math.cos(al), 0.0, math.sin(al)])
        tang = np.array([-math.sin(al), 0.0, math.cos(al)])
        d = math.cos(BLADE_TILT) * tang + math.sin(BLADE_TILT) * radial
        c = CENTRIOLE_R * radial
        for m, (off, top, col) in enumerate(((-TUBULE_STEP, 1.0, "#e9a92f"), (0.0, 1.0, "#f6c453"), (TUBULE_STEP, 0.74, "#fbd77e"))):
            p = c + d * off
            V, F = _rod(p, p + np.array([0, top, 0]), TUBULE_R)
            parts.append((V, F, np.tile(H(col), (len(V), 1))))
    # The cartwheel: a hub and nine spokes in two tiers at the proximal end.
    V, F = _rod((0, 0.04, 0), (0, 0.3, 0), 0.045)
    parts.append((V, F, np.tile(H("#fde68a"), (len(V), 1))))
    for k in range(9):
        al = 2 * math.pi * k / 9
        radial = np.array([math.cos(al), 0.0, math.sin(al)])
        tang = np.array([-math.sin(al), 0.0, math.cos(al)])
        a_tub = CENTRIOLE_R * radial - TUBULE_STEP * (math.cos(BLADE_TILT) * tang + math.sin(BLADE_TILT) * radial)
        for y in (0.1, 0.22):
            V, F = _rod(np.array([0, y, 0]) + radial * 0.04, a_tub + np.array([0, y, 0]), 0.011, sides=6)
            parts.append((V, F, np.tile(H("#fde68a"), (len(V), 1))))
    if mother:
        # Distal appendages: nine fins sloping out from the distal end.
        for k in range(9):
            al = 2 * math.pi * k / 9 + 0.2
            radial = np.array([math.cos(al), 0.0, math.sin(al)])
            path = pl.catmull([radial * 0.22 + [0, 0.88, 0], radial * 0.3 + [0, 0.93, 0], radial * 0.4 + [0, 0.95, 0]], 6)
            r = np.linspace(0.024, 0.014, len(path))
            V, F, _, _ = pl.sweep(path, r, sides=6)
            parts.append((V, F, np.tile(H("#f59e0b"), (len(V), 1))))
    V, F, C = pl.combine(parts)
    return V, F, C


def pcm_field(P):
    d = np.linalg.norm(P, axis=1) - 0.85
    return sdf.roughen(d, P, 0.14, 0.3, seed=8, octaves=3)


def pcm_colour(P, N):
    n = sdf.value_noise(P, 0.15, 3)
    return mix(H("#fde7a8"), H("#f8c869"), 0.5 + 0.5 * n)


# ─── Mitochondrion ──────────────────────────────────────────────────

MITO_HALF = 0.5
MITO_R = 0.19


def _mito_q(P):
    Q = np.array(P, dtype=np.float64, copy=True)
    Q[:, 1] -= 0.22 * (P[:, 0] ** 2 - MITO_HALF**2)  # a gentle bend
    return Q


def mito_field(P):
    Q = _mito_q(P)
    d = sdf._capsule(Q, (-MITO_HALF, 0, 0), (MITO_HALF, 0, 0), MITO_R, MITO_R)
    return sdf.roughen(d, P, 0.012, 0.09, seed=6, octaves=2)


def mito_colour(P, N):
    Q = _mito_q(P)
    wob = sdf.value_noise(P, 0.12, 7)
    cristae = 0.5 + 0.5 * np.sin(Q[:, 0] * 30 + 2.2 * wob + 0.8 * np.sin(Q[:, 2] * 9))
    C = mix(H("#f7a07e"), H("#ffc3a6"), 0.5 + 0.5 * sdf.value_noise(P, 0.06, 8))
    return mix(C, H("#d9735a"), np.clip(cristae * 1.4 - 0.6, 0, 1) * 0.4)


def meta():
    return {
        "units": "unit frames, y up",
        "territories": TERRITORIES,
        "envelope": {"radius": 1.0, "pores": int(len(PORES)), "thickness": 2 * ENVELOPE_HALF},
        "centriole": {"length": 1.0, "radius": CENTRIOLE_R + TUBULE_STEP + TUBULE_R},
        "mitochondrion": {"half": MITO_HALF, "radius": MITO_R},
    }

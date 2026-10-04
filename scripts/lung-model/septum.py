"""One alveolar septum, cut open: the half-micrometre the oxygen crosses.

Units are micrometres, y up, +z towards the viewer. A septum is the wall
between two alveoli: air above it (one alveolus) and below it (the next),
and a capillary running through it along x. The block spans x -14..14 and
is cut at z = 0 through the capillary's axis, so the cut face shows every
layer in section and the red cells show inside the opened lumen.

Layers (Weibel; Ross & Pawlina), each its own mesh so each keeps its colour
in the section:

  epithelium    type I pneumocytes: a sheet ~0.2 um thick covering both air
                faces, with a nucleus bulging out on the top face away from
                the capillary
  basement      basement membrane under the epithelium and round the
                capillary; on the THIN side (top) the two are fused, so
                air to blood is epithelium + basement + endothelium ~0.55 um
  endothelium   the capillary's lining, ~0.2 um, with its nucleus bulging
                into the lumen on the thick side
  interstitium  the THICK side (below): connective tissue with collagen and
                elastin fibres, where fluid and cells sit, ~1.3 um
  typeTwo       a type II pneumocyte on the lower face, cut in half: its
                nucleus and the lamellar bodies that store surfactant
  macrophage    an alveolar macrophage crawling on the upper face

The scene adds the red cells (`rbc`, Evans & Fung's biconcave disc with a
"parachute" morph for the squeeze through the capillary), the molecules and
the surfactant film.
"""

import math

import numpy as np

import plantlib as pl
from plantlib import sdf

AXIS_Y = 0.6
LUMEN_R = 3.3
ENDO = 0.2
BASE = 0.14
EPI = 0.22
X0, X1 = -14.0, 14.0
Z0 = -12.5
SLAB_TOP = 0.9
SLAB_BOT = -1.9
THICK = 1.3  # interstitium under the capillary


# The septum is a sheet of capillaries side by side: the one cut open on the
# front face, and the next one behind it, whole.
CAPS = [(AXIS_Y, 0.0), (AXIS_Y - 0.3, -8.4)]


def _cap(P):
    """Distance from the nearest capillary's axis (they run along x)."""
    return np.min([np.hypot(P[:, 1] - y, P[:, 2] - z) for y, z in CAPS], axis=0)


def body(P):
    """The whole septum (negative inside), before layering."""
    r = _cap(P)
    tube = r - (LUMEN_R + ENDO + BASE + EPI)
    slab = np.maximum(P[:, 1] - SLAB_TOP, SLAB_BOT - P[:, 1])
    # the thick side: an interstitial cushion hanging under the capillary
    cushion = sdf._ellipsoid(P, (-3.0, AXIS_Y - LUMEN_R - 0.2, -2.0), (7.5, 1.6 + THICK, 6.0), (0, 0, 0))
    d = sdf.smin(tube, slab, 1.6)
    d = sdf.smin(d, cushion, 1.0)
    return d


# The type I nucleus on the top face and the type II cell on the bottom.
T1_NUC = ((-8.6, SLAB_TOP + 0.05, -3.0), (3.0, 0.75, 2.2))
# in the corner under the capillary, on the thick side
T2 = ((9.0, -5.3, 0.0), (3.2, 2.0, 2.8))
T2_NUC = ((8.8, -5.45, 0.0), (1.2, 0.95, 1.1))
LAMELLAR = [((7.1, -6.0, 0.0), 0.5), ((10.6, -5.9, 0.0), 0.48), ((10.2, -4.5, 0.0), 0.42), ((7.4, -4.6, 0.0), 0.4)]


def outer(P):
    """The septum including the cells that bulge from it."""
    d = body(P)
    d = sdf.smin(d, sdf._ellipsoid(P, *T1_NUC, (0, 0, 0)) - EPI, 0.5)
    d = sdf.smin(d, sdf._ellipsoid(P, *T2, (0, 0, 0)), 0.8)
    # microvilli on the type II cell's free surface
    c, r = np.array(T2[0]), np.array(T2[1])
    for k in range(22):
        a = k / 22 * 2 * math.pi
        for row in (0.55, 0.8):
            u = np.array([math.cos(a) * row, -math.sqrt(1 - row * row), math.sin(a) * row])
            p = c + u * r * 1.0
            d = sdf.smin(d, sdf.capsule(P, p, p + u * 0.45, 0.09, 0.07), 0.05)
    return d


def _box(P):
    """The block: x X0..X1, z Z0..0 (the cut face at z = 0)."""
    return np.maximum.reduce([X0 - P[:, 0], P[:, 0] - X1, Z0 - P[:, 2], P[:, 2]])


def _clip(d, P):
    return np.maximum(d, _box(P))


def epithelium(P):
    o = outer(P)
    d = np.maximum(o, -(o + EPI))
    # the type II cell is its own mesh: no sheet across it
    d = np.maximum(d, -sdf._ellipsoid(P, T2[0], np.array(T2[1]) * 0.98, (0, 0, 0)))
    return _clip(d, P)


def basement(P):
    o = outer(P)
    under_epi = np.abs(o + EPI + BASE / 2) - BASE / 2
    r = _cap(P)
    round_cap = np.abs(r - (LUMEN_R + ENDO + BASE / 2)) - BASE / 2
    d = np.minimum(under_epi, np.maximum(round_cap, o + EPI))
    d = np.maximum(d, -sdf._ellipsoid(P, T2[0], np.array(T2[1]) * 0.98, (0, 0, 0)))
    return _clip(d, P)


ENDO_NUC = ((3.5, AXIS_Y - LUMEN_R + 0.35, -1.6), (2.6, 0.55, 1.4))


def endothelium(P):
    r = _cap(P)
    d = np.abs(r - (LUMEN_R + ENDO / 2)) - ENDO / 2
    bump = sdf._ellipsoid(P, *ENDO_NUC, (0, 0, 0))
    d = sdf.smin(d, np.maximum(bump, r - LUMEN_R - ENDO), 0.3)
    return _clip(d, P)


def interstitium(P):
    o = outer(P)
    r = _cap(P)
    d = np.maximum(o + EPI + BASE, -(r - (LUMEN_R + ENDO + BASE)))
    d = np.maximum(d, -sdf._ellipsoid(P, T2[0], np.array(T2[1]) * 0.98, (0, 0, 0)))
    return _clip(d, P)


def type_two(P):
    """The type II cell: replaces the sheet where it sits, reaching from the
    basement membrane out to its microvilli."""
    o = outer(P)
    ell = sdf._ellipsoid(P, *T2, (0, 0, 0))
    big = sdf._ellipsoid(P, T2[0], np.array(T2[1]) * 1.25, (0, 0, 0))
    d1 = np.maximum.reduce([o, big, -(body(P) + EPI)])
    d2 = np.maximum(ell, o)
    return _clip(np.minimum(d1, d2), P)


def type_two_parts(P):
    """The nucleus and lamellar bodies, cut at z = 0 like the cell."""
    d = sdf._ellipsoid(P, *T2_NUC, (0, 0, 0))
    for c, r in LAMELLAR:
        d = np.minimum(d, sdf._ellipsoid(P, c, (r, r * 0.85, r), (0, 0, 0)))
    # proud of the cut face by a hair, so it does not z-fight the cell's
    return np.maximum(d, P[:, 2] - 0.03)


# on top of the back capillary
MAC = (np.array([4.5, AXIS_Y - 0.3 + LUMEN_R + ENDO + BASE + EPI + 0.95, -7.9]), np.array([2.4, 1.1, 1.9]))


def macrophage(P):
    d = sdf._ellipsoid(P, MAC[0], MAC[1], (0, 0.3, 0))
    rng = pl.rng(9)
    for k in range(6):
        a = k / 6 * 2 * math.pi + rng.uniform(-0.3, 0.3)
        u = np.array([math.cos(a), -0.25, math.sin(a)])
        d = sdf.smin(d, sdf._capsule(P, MAC[0] + u * 1.4, MAC[0] + u * rng.uniform(3.0, 4.2) + np.array([0, -0.6, 0]), 0.45, 0.16), 0.5)
    return sdf.roughen(d, P, 0.08, np.array([0.7, 0.7, 0.7]), seed=4, octaves=2)


def fibres(seed=7):
    """Collagen bundles and elastin threads in the interstitium, running
    along the septum, lying on the cut face: [(points, radius, kind)]."""
    rng = pl.rng(seed)
    out = []
    # the cut face crosses the septum through the capillary's axis, so the
    # interstitium shows there only on the thick side, under the lumen
    floor_y = AXIS_Y - LUMEN_R - 0.2 - (1.6 + THICK)
    for k in range(9):
        y = rng.uniform(floor_y + 0.7, AXIS_Y - LUMEN_R - 0.75)
        x = np.linspace(-10.4, 4.4, 50)
        ph = rng.uniform(0, 6)
        kind = "collagen" if k % 3 else "elastin"
        amp = 0.12 if kind == "collagen" else 0.22
        pts = np.stack([x, y + amp * np.sin(x * (0.9 if kind == "collagen" else 2.1) + ph), np.full_like(x, -0.08)], axis=1)
        out.append((pts, 0.16 if kind == "collagen" else 0.07, kind))
    return out


def inside_septum(pts):
    """Which fibre points lie inside the interstitium (so a fibre does not
    cross the lumen)."""
    return interstitium(pts) < -0.05


# ─── Colours ──────────────────────────────────────────────────────

C = {
    "epithelium": "#f3c9cc",
    "nucleus": "#6d4b9a",
    "basement": "#f8f1e4",
    "endothelium": "#e9a5ad",
    "interstitium": "#f5ddd2",
    "collagen": "#fbe9e0",
    "elastin": "#b5838d",
    "typeTwo": "#e8b4c4",
    "lamellar": "#7a5a7a",
    "lamellarPale": "#f1e3f0",
    "macrophage": "#d8b6a0",
}


def epithelium_colour(P, N):
    col = np.tile(pl.hex_rgb(C["epithelium"]), (len(P), 1))
    n = sdf.fbm(P, np.array([0.5, 0.5, 0.5]), 3, 3)
    col *= (0.92 + 0.1 * n)[:, None]
    # the nucleus bulge, purple where it shows through
    nuc = sdf._ellipsoid(P, *T1_NUC, (0, 0, 0)) < EPI * 1.6
    col[nuc] = pl.hex_rgb(C["nucleus"]) * 1.25
    # faint cell borders on the air faces (type I cells are huge and flat)
    cells = np.abs(np.sin(P[:, 0] * 0.21 + np.sin(P[:, 2] * 0.3) * 1.4)) < 0.035
    col[cells] *= 0.85
    return col


def endothelium_colour(P, N):
    col = np.tile(pl.hex_rgb(C["endothelium"]), (len(P), 1))
    nuc = sdf._ellipsoid(P, *ENDO_NUC, (0, 0, 0)) < 0.12
    col[nuc] = pl.hex_rgb(C["nucleus"]) * 1.2
    return col


def interstitium_colour(P, N):
    col = np.tile(pl.hex_rgb(C["interstitium"]), (len(P), 1))
    n = sdf.fbm(P, np.array([0.9, 0.9, 0.9]), 3, 8)
    col *= (0.9 + 0.12 * n)[:, None]
    return col


def type_two_colour(P, N):
    col = np.tile(pl.hex_rgb(C["typeTwo"]), (len(P), 1))
    n = sdf.fbm(P, np.array([0.6, 0.6, 0.6]), 3, 12)
    col *= (0.9 + 0.12 * n)[:, None]
    # granular cytoplasm on the cut face
    cut = np.abs(P[:, 2]) < 0.05
    dots = (np.sin(P[:, 0] * 9.1) * np.sin(P[:, 1] * 8.3) > 0.82) & cut
    col[dots] *= 0.8
    return col


def parts_colour(P, N):
    col = np.tile(pl.hex_rgb(C["nucleus"]), (len(P), 1))
    # chromatin flecks
    n = sdf.fbm(P, np.array([0.25, 0.25, 0.25]), 2, 6)
    col *= (0.85 + 0.3 * n)[:, None]
    for c, r in LAMELLAR:
        d = np.linalg.norm((P - np.array(c)) / np.array([1, 0.85, 1]), axis=1)
        inside = d < r * 1.05
        rings = 0.5 + 0.5 * np.cos(d / r * 7 * math.pi)
        col[inside] = pl.mix(pl.hex_rgb(C["lamellar"]), pl.hex_rgb(C["lamellarPale"]), rings[inside])
    return col


def macrophage_colour(P, N):
    col = np.tile(pl.hex_rgb(C["macrophage"]), (len(P), 1))
    n = sdf.fbm(P, np.array([0.4, 0.4, 0.4]), 3, 2)
    col *= (0.88 + 0.16 * n)[:, None]
    # phagocytosed dust: dark specks
    specks = (np.sin(P[:, 0] * 7.3 + 1) * np.sin(P[:, 1] * 6.1) * np.sin(P[:, 2] * 5.7 + 2)) > 0.55
    col[specks] = pl.hex_rgb("#5b4636")
    return col


# ─── The red cell ──────────────────────────────────────────────────

RBC_R = 3.91  # Evans & Fung (1972)
FUNG = (0.207, 2.003, -1.123)


def rbc(n_r=28, n_a=40):
    """The biconcave disc, axis +y, radius 3.91 um. Returns V, F and the
    'parachute' morph: the shape it takes squeezed through a capillary
    narrower than itself, its rim swept back."""
    rho = np.sin(np.linspace(0, math.pi / 2, n_r)) * 0.999
    c0, c2, c4 = FUNG
    h = 0.5 * np.sqrt(np.maximum(1 - rho**2, 0)) * (c0 + c2 * rho**2 + c4 * rho**4) * RBC_R
    a = np.linspace(0, 2 * math.pi, n_a, endpoint=False)
    rows = []
    for sgn in (1, -1):
        for i in range(n_r):
            ring = np.stack([RBC_R * rho[i] * np.cos(a), np.full(n_a, sgn * h[i]), RBC_R * rho[i] * np.sin(a)], axis=1)
            rows.append(ring)
    top = rows[:n_r]
    bot = rows[n_r:][::-1]
    rings = top + [np.stack([RBC_R * np.cos(a), np.zeros(n_a), RBC_R * np.sin(a)], axis=1)] + bot
    V = np.concatenate(rings)
    m = len(rings)
    F = []
    for i in range(m - 1):
        for j in range(n_a):
            j2 = (j + 1) % n_a
            F.append([i * n_a + j, i * n_a + j2, (i + 1) * n_a + j2, (i + 1) * n_a + j])
    F = np.array(F)
    # parachute: narrower, the rim bent back along -y
    r = np.hypot(V[:, 0], V[:, 2]) / RBC_R
    M = V.copy()
    M[:, 0] *= 0.8
    M[:, 2] *= 0.8
    M[:, 1] += -2.2 * r**2 + 0.6
    return V, F, M - V


def meta():
    return {
        "unit": "um",
        "axisY": AXIS_Y,
        "lumen": LUMEN_R,
        "endothelium": ENDO,
        "basement": BASE,
        "epithelium": EPI,
        "x": [X0, X1],
        "z0": Z0,
        "slab": [SLAB_BOT, SLAB_TOP],
        "thin": round(ENDO + BASE + EPI, 3),
        "rbcRadius": RBC_R,
        "typeTwo": list(T2[0]),
        "macrophage": MAC[0].round(2).tolist(),
    }

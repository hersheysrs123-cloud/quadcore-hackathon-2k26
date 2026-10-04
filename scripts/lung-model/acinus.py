"""An alveolar duct and the sac at its end: where the air in the lung meets
the blood.

Units are 50 um (so an alveolus about 200 um across has a radius of 2) and
the frame is the scene's: y up, the respiratory bronchiole coming in from
above along the y axis, +z towards the viewer.

  bronchiole   the last airway with a proper wall, from y = 10.5 down to 5
  duct         the alveolar duct, y = 5 to -1.5: no wall of its own, just
               the rims of the alveoli that open all round it
  sac          the blind end: an atrium with alveoli clustered round it
  alveoli      hollow; neighbouring alveoli share one septum (a power-
               diagram face between their spheres), and the wall is about
               6 um thick (0.12)
  window       the front-right quadrant (x > 0, z > 0) is cut away, so the
               hollow alveoli and the septa between them show

The capillaries are a net over each alveolus's outer surface, an
icosphere's edges jittered and thinned, kept only where the surface is
exposed. Each net vertex carries `f`, how far along the capillary it is from
where the blood comes in (near the duct) to where it leaves (the far side
of the alveolus); the scene colours the blood from the solved PO2 at that
fraction, so the same file shows any altitude, disease or exercise.

Blood comes in down a pulmonary arteriole that runs with the bronchiole
(arteries follow airways), disappears into the septa, comes out onto the
alveoli, and leaves through venules on the outside of the cluster (veins
run at the edges). `paths()` gives the flow paths the scene runs red
cells along.
"""

import heapq
import math

import numpy as np

import plantlib as pl

WALL = 0.12
CAP_R = 0.075
DUCT_R = 1.25
BRONCH_R = 1.05
BRONCH_WALL = 0.32
TOP = 10.5
DUCT_TOP = 5.0


def _alveoli():
    out = []
    # Three rings along the duct, staggered.
    for k, y in enumerate((3.7, 1.5, -0.7)):
        for j in range(5):
            a = (j + 0.5 * k) / 5 * 2 * math.pi + 0.3
            rr = 2.85 + 0.12 * math.sin(3 * a + k)
            r = 1.95 + 0.12 * math.cos(2 * a + k * 1.7)
            out.append((rr * math.cos(a), y + 0.25 * math.sin(2 * a + k), rr * math.sin(a), r))
    # The sac at the end: a fan round the atrium, and one at the bottom.
    cy = -3.2
    for j in range(6):
        a = j / 6 * 2 * math.pi + 0.05
        out.append((2.65 * math.cos(a), cy - 0.9, 2.65 * math.sin(a), 1.95 + 0.1 * math.sin(4 * a)))
    out.append((0.15, cy - 3.0, -0.1, 2.0))
    return np.array(out)


ALVEOLI = _alveoli()
ATRIUM = (np.array([0.0, -3.0, 0.0]), 1.45)


def _seg_dist(P, a, b):
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    ab = b - a
    t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * ab), axis=1)


def cores(P):
    """Air with no tissue in it: the bronchiole's lumen, the duct, the atrium."""
    duct = _seg_dist(P, (0, TOP + 1, 0), (0, -1.6, 0)) - np.where(P[:, 1] > DUCT_TOP, BRONCH_R, DUCT_R)
    atrium = np.linalg.norm(P - ATRIUM[0], axis=1) - ATRIUM[1]
    return np.minimum(duct, atrium)


def alveolar_d(P):
    """Signed distance to every alveolus sphere, (N, A)."""
    C = ALVEOLI[:, :3]
    return np.sqrt(((P[:, None, :] - C[None, :, :]) ** 2).sum(-1)) - ALVEOLI[None, :, 3]


def union(P):
    """Air in the acinus (negative inside), alveoli and cores, slightly rounded."""
    d = alveolar_d(P).min(axis=1)
    return pl.sdf.smin(d, cores(P), 0.25)


def tissue_field(P, chunk=400000):
    out = np.empty(len(P))
    for s in range(0, len(P), chunk):
        Q = P[s : s + chunk]
        D = alveolar_d(Q)
        part = np.partition(D, 1, axis=1)
        d1, d2 = part[:, 0], part[:, 1]
        c = cores(Q)
        U = pl.sdf.smin(d1, c, 0.25)
        shell = np.abs(U) - WALL / 2
        septum = np.maximum((d2 - d1) / 2 - WALL / 2, U)
        t = np.minimum(shell, septum)
        # No tissue inside the duct and atrium; the alveoli open into them
        # through rims.
        t = pl.sdf.smax(t, -c, 0.06)
        # The bronchiole's own wall above the duct.
        rad = np.hypot(Q[:, 0], Q[:, 2])
        bw = np.maximum(np.abs(rad - BRONCH_R - BRONCH_WALL / 2) - BRONCH_WALL / 2, np.maximum(Q[:, 1] - TOP, DUCT_TOP - 0.6 - Q[:, 1]))
        t = pl.sdf.smin(t, bw, 0.2)
        # The window: the front-right quadrant is cut away.
        t = np.maximum(t, np.minimum(Q[:, 0], Q[:, 2]) - 0.0)
        out[s : s + chunk] = t
    return out


def tissue_colour(P, N):
    base = pl.hex_rgb("#f0bcc1")
    col = np.tile(base, (len(P), 1))
    n = pl.sdf.fbm(P, np.array([0.9, 0.9, 0.9]), 3, 5)
    col = col * (0.9 + 0.14 * n)[:, None]
    # the cut faces a little deeper, so the septa read as cut tissue
    cut = (np.abs(np.minimum(P[:, 0], P[:, 2])) < 0.03)
    col[cut] = pl.hex_rgb("#d9868f") * (0.92 + 0.1 * n[cut, None])
    # the bronchiole: cuboidal lining and smooth muscle, pinker
    br = P[:, 1] > DUCT_TOP - 0.4
    col[br] = pl.mix(col[br], pl.hex_rgb("#d88a8a"), 0.55)
    return col


# ─── Capillary net ─────────────────────────────────────────────────


def _icosphere(sub=2):
    t = (1 + 5**0.5) / 2
    V = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    V = [np.array(v, dtype=np.float64) / np.linalg.norm(v) for v in V]
    F = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    for _ in range(sub):
        cache = {}

        def mid(i, j):
            key = (min(i, j), max(i, j))
            if key not in cache:
                m = V[i] + V[j]
                V.append(m / np.linalg.norm(m))
                cache[key] = len(V) - 1
            return cache[key]

        F2 = []
        for a, b, c in F:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            F2 += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        F = F2
    V = np.array(V)
    E = set()
    for a, b, c in F:
        for i, j in ((a, b), (b, c), (c, a)):
            E.add((min(i, j), max(i, j)))
    return V, sorted(E)


def _random_rotation(rng):
    q = rng.normal(size=4)
    q /= np.linalg.norm(q)
    w, x, y, z = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def _dijkstra(n, adj, src, weight):
    dist = np.full(n, np.inf)
    prev = np.full(n, -1)
    dist[src] = 0
    h = [(0.0, src)]
    while h:
        d, u = heapq.heappop(h)
        if d > dist[u]:
            continue
        for v, w in adj[u]:
            nd = d + w * weight(u, v)
            if nd < dist[v]:
                dist[v] = nd
                prev[v] = u
                heapq.heappush(h, (nd, v))
    return dist, prev


def nets(seed=11):
    """Per alveolus: kept net vertices (on the sphere just outside the wall),
    edges, entry and exit vertices, and the fraction f at every vertex."""
    rng = pl.rng(seed)
    V0, E0 = _icosphere(3)
    out = []
    for i, (cx, cy, cz, r) in enumerate(ALVEOLI):
        c = np.array([cx, cy, cz])
        R = r + WALL / 2 + CAP_R * 0.7
        dirs = V0 @ _random_rotation(rng).T
        # jitter along the surface for an irregular mesh
        dirs = dirs + rng.normal(scale=0.035, size=dirs.shape)
        dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
        P = c + dirs * R
        D = alveolar_d(P)
        D[:, i] = np.inf
        exposed = (D.min(axis=1) > 0.12) & (cores(P) > 0.3) & (np.minimum(P[:, 0], P[:, 2]) < -0.05)
        exposed &= (P[:, 1] < DUCT_TOP - 0.3) | (np.hypot(P[:, 0], P[:, 2]) > BRONCH_R + BRONCH_WALL + 0.45)
        keep = np.nonzero(exposed)[0]
        if len(keep) < 40:
            continue
        idx = {k: n for n, k in enumerate(keep)}
        edges = [(idx[a], idx[b]) for a, b in E0 if a in idx and b in idx and rng.uniform() > 0.06]
        n = len(keep)
        adj = [[] for _ in range(n)]
        for a, b in edges:
            w = float(np.linalg.norm(P[keep[a]] - P[keep[b]]))
            adj[a].append((b, w))
            adj[b].append((a, w))
        pts = P[keep]
        # work in the largest connected piece of the net
        comp = np.full(n, -1)
        sizes = []
        for s0 in range(n):
            if comp[s0] >= 0:
                continue
            stack, comp[s0], size = [s0], len(sizes), 0
            while stack:
                u = stack.pop()
                size += 1
                for v, _ in adj[u]:
                    if comp[v] < 0:
                        comp[v] = comp[s0]
                        stack.append(v)
            sizes.append(size)
        main = comp == int(np.argmax(sizes))
        # the blood comes in nearest the duct, leaves on the far side
        radial = np.hypot(pts[:, 0], pts[:, 2]) - 0.25 * np.abs(pts[:, 1] - cy)
        entry = int(np.argmin(np.where(main, radial, np.inf)))
        dist, _ = _dijkstra(n, adj, entry, lambda u, v: 1.0)
        reach = np.isfinite(dist)
        if reach.sum() < 30:
            continue
        exit_ = int(np.argmax(np.where(reach, dist, -1)))
        f = np.where(reach, dist / dist[exit_], 1.0)
        out.append({"alveolus": i, "centre": c, "R": R, "pts": pts, "edges": edges, "adj": adj, "entry": entry, "exit": exit_, "f": np.clip(f, 0, 1), "reach": reach})
    return out


def _arc(c, R, a, b, n=5):
    """Points on the sphere (c, R) between a and b."""
    ua = (a - c) / np.linalg.norm(a - c)
    ub = (b - c) / np.linalg.norm(b - c)
    t = np.linspace(0, 1, n)[:, None]
    u = ua * (1 - t) + ub * t
    u /= np.linalg.norm(u, axis=1, keepdims=True)
    return c + u * R


def net_mesh(net_list):
    """One mesh of every capillary: V, F and per-vertex (f, alveolus, 0, 0)."""
    parts = []
    for net in net_list:
        pts, f = net["pts"], net["f"]
        for a, b in net["edges"]:
            if not (net["reach"][a] and net["reach"][b]):
                continue
            # net edges are short beside the alveolus, so a straight chord
            # and a three-sided tube are indistinguishable from an arc
            path = np.stack([pts[a], pts[b]])
            V, F, t, _ = pl.sweep(path, CAP_R, sides=3, cap_start=False, cap_end=False)
            ff = f[a] + (f[b] - f[a]) * t
            A = np.stack([ff, np.full(len(V), net["alveolus"]), np.zeros(len(V)), np.zeros(len(V))], axis=1)
            parts.append((V, F, A))
    return pl.combine(parts)


# ─── Vessels and flow ─────────────────────────────────────────────


def _push_out(P, margin):
    """Move points out of the acinus's air-and-tissue so a vessel lies on its outside."""
    P = P.copy()
    for _ in range(80):
        D = alveolar_d(P)
        d = D.min(axis=1)
        bad = d < margin
        if not bad.any():
            break
        near = ALVEOLI[D.argmin(axis=1), :3]
        u = P - near
        u /= np.maximum(np.linalg.norm(u, axis=1, keepdims=True), 1e-9)
        P[bad] += u[bad] * 0.06
    return P


ART_R = 0.26
VEN_R = 0.3


def arteriole():
    """Down the back of the bronchiole, to where it dives into the septa."""
    pts = pl.catmull([(-0.55, TOP, -1.55), (-0.5, 8.0, -1.62), (-0.45, 6.2, -1.6), (-0.6, 4.9, -1.75)], 10)
    return pl.resample(pts, 0.2)


def venules():
    """Two pulmonary venules on the outside of the cluster, running up to the top."""
    out = []
    for ctrl in (
        [(-2.6, -7.2, 1.6), (-4.6, -3.6, 1.2), (-5.1, 0.0, 0.6), (-4.8, 3.6, 0.4), (-2.6, 6.6, 0.2), (-1.85, TOP, 0.1)],
        [(1.0, -7.4, -2.4), (2.8, -3.9, -4.2), (2.7, -0.4, -4.9), (2.0, 3.4, -4.7), (1.1, 6.8, -2.4), (0.7, TOP, -1.75)],
    ):
        p = pl.resample(pl.catmull(ctrl, 12), 0.2)
        p = _push_out(p, VEN_R + 0.18)
        # keep it hugging the bronchiole above the duct
        above = p[:, 1] > DUCT_TOP
        rad = np.hypot(p[above, 0], p[above, 2])
        p[above, 0] *= (BRONCH_R + BRONCH_WALL + VEN_R + 0.02) / np.maximum(rad, 1e-6)
        p[above, 2] *= (BRONCH_R + BRONCH_WALL + VEN_R + 0.02) / np.maximum(rad, 1e-6)
        out.append(pl.resample(pl.catmull(p[::3].tolist() + [p[-1].tolist()], 6), 0.2))
    return out


def vessel_mesh(art, vens):
    parts = []
    V, F, t, _ = pl.sweep(art, ART_R, sides=12, cap_start=False, cap_end=True)
    parts.append((V, F, np.stack([np.zeros(len(V)), np.full(len(V), -1), np.zeros(len(V)), np.zeros(len(V))], axis=1)))
    for k, v in enumerate(vens):
        r = np.interp(np.linspace(0, 1, len(v)), [0, 1], [VEN_R * 0.6, VEN_R])
        V, F, t, _ = pl.sweep(v, r, sides=12, cap_start=True, cap_end=False)
        parts.append((V, F, np.stack([np.ones(len(V)), np.full(len(V), -2 - k), np.zeros(len(V)), np.zeros(len(V))], axis=1)))
    return pl.combine(parts)


def paths(net_list, vens, per=3, seed=5):
    """Flow paths through each alveolus's net: capillary polyline (entry to
    exit, ~0.15 spacing) and which venule it drains to, at which index."""
    rng = pl.rng(seed)
    out = []
    for net in net_list:
        pts = net["pts"]
        n = len(pts)
        for k in range(per):
            noise = {}

            def weight(u, v):
                key = (min(u, v), max(u, v))
                if key not in noise:
                    noise[key] = rng.uniform(0.6, 1.6)
                return noise[key]

            dist, prev = _dijkstra(n, net["adj"], net["entry"], weight)
            # end anywhere on the far side
            far = np.nonzero(net["f"] > 0.85)[0]
            if len(far) == 0:
                continue
            end = int(rng.choice(far))
            if not np.isfinite(dist[end]):
                continue
            chain = [end]
            while chain[-1] != net["entry"]:
                chain.append(int(prev[chain[-1]]))
            chain = chain[::-1]
            poly = [pts[chain[0]]]
            for a, b in zip(chain[:-1], chain[1:]):
                poly += list(_arc(net["centre"], net["R"], pts[a], pts[b], 3)[1:])
            poly = pl.resample(np.array(poly), 0.15)
            # nearest venule point to the exit
            best = None
            for vi, v in enumerate(vens):
                d = np.linalg.norm(v - poly[-1], axis=1)
                j = int(d.argmin())
                if best is None or d[j] < best[2]:
                    best = (vi, j, d[j])
            out.append({"alveolus": net["alveolus"], "venule": best[0], "at": best[1], "pts": poly})
    return out


def meta(net_list, art, vens, flow):
    r2 = lambda a: np.round(np.asarray(a, dtype=np.float64), 2).ravel().tolist()
    return {
        "unitUm": 50,
        "wall": WALL,
        "capillaryRadius": CAP_R,
        "alveoli": r2(ALVEOLI),
        "top": TOP,
        "ductTop": DUCT_TOP,
        "arteriole": r2(art),
        "venules": [r2(v) for v in vens],
        "paths": [{"a": p["alveolus"], "v": p["venule"], "at": p["at"], "pts": r2(p["pts"])} for p in flow],
    }

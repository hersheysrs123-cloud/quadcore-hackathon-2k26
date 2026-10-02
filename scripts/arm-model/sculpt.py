"""Shape primitives built from cross-sections, for bones and muscles.

sdf.py sculpts with blobs (spheres, capsules), which is what made the first
arm lumpy. Real bones and muscles are better described the way anatomy
books draw them: by their outline at each level. Three primitives here:

  RadialLoft  a long bone as a stack of cross-sections along rig -Y. Each
              section is a star-shaped outline (radius by angle round the
              section centre), interpolated smoothly between levels, so a
              shaft can be round above, triangular below and flat at its end.
  lathe       a surface of revolution from a 2D profile (the trochlea's
              spool, the radial head's disc, a metacarpal head).
  Sweep       a band swept along a curved path with an elliptical section
              that can be wide and thin and flatter underneath than on top:
              a muscle belly lying on the layer below it, narrowing into its
              tendon. It also reports, per point, where along the path it is
              and the path's direction there (the fibre direction).

All take and return rig-frame numpy arrays and slot into sdf.py's
combinators and mesher. Angles round a vertical axis are measured from +X
(anterior) towards +Z (medial), in degrees where authored.
"""

import math

import numpy as np

import sdf

N_ANG = 32
ANG = np.arange(N_ANG) * (2 * np.pi / N_ANG)


# ─── Section outlines (radius by angle) ────────────────────────────


def section(front, back, medial, lateral, n=2.0, rot=0.0):
    """Radii at ANG of a four-quadrant superellipse: half-extents towards +X
    (front), -X (back), +Z (medial) and -Z (lateral). n=2 is an ellipse,
    larger is boxier, smaller is pointier. `rot` (degrees) turns the
    quadrants round the centre."""
    a = ANG - math.radians(rot)
    c, s = np.cos(a), np.sin(a)
    ax = np.where(c >= 0, front, back)
    az = np.where(s >= 0, medial, lateral)
    return (np.abs(c / ax) ** n + np.abs(s / az) ** n) ** (-1.0 / n)


def _angdiff(a, b):
    return (a - b + np.pi) % (2 * np.pi) - np.pi


def bump(r, angle, height, width):
    """Add a ridge (height > 0) or groove (height < 0) centred at `angle`
    degrees, `width` degrees across (Gaussian)."""
    d = _angdiff(ANG, math.radians(angle)) / math.radians(width)
    return r + height * np.exp(-d * d)


def triangle(front, back, medial, lateral, apex, sharp=0.35, n=2.0):
    """A rounded triangular section: an ellipse whose `apex` angle (degrees)
    is drawn out into a border (the interosseous border of the radius and
    ulna, the supracondylar ridges)."""
    r = section(front, back, medial, lateral, n)
    d = _angdiff(ANG, math.radians(apex))
    return r * (1 + sharp * np.exp(-(d / 0.45) ** 2))


# ─── Smooth interpolation along a coordinate ───────────────────────


def _hermite(xs, vals, x):
    """Cubic Hermite interpolation of vals (k, m) at x (n,), with
    finite-difference tangents for uneven spacing (like Catmull-Rom).
    Returns (value (n, m), derivative (n, m))."""
    xs = np.asarray(xs, dtype=np.float64)
    vals = np.asarray(vals, dtype=np.float64)
    k = len(xs)
    tang = np.zeros_like(vals)
    for i in range(k):
        a, b = max(i - 1, 0), min(i + 1, k - 1)
        tang[i] = (vals[b] - vals[a]) / (xs[b] - xs[a])
    i = np.clip(np.searchsorted(xs, x) - 1, 0, k - 2)
    h = xs[i + 1] - xs[i]
    t = np.clip((x - xs[i]) / h, 0.0, 1.0)[:, None]
    hh = h[:, None]
    t2, t3 = t * t, t * t * t
    h00 = 2 * t3 - 3 * t2 + 1
    h10 = t3 - 2 * t2 + t
    h01 = -2 * t3 + 3 * t2
    h11 = t3 - t2
    v = h00 * vals[i] + h10 * hh * tang[i] + h01 * vals[i + 1] + h11 * hh * tang[i + 1]
    d00 = (6 * t2 - 6 * t) / hh
    d10 = 3 * t2 - 4 * t + 1
    d01 = (-6 * t2 + 6 * t) / hh
    d11 = 3 * t2 - 2 * t
    dv = d00 * vals[i] + d10 * tang[i] + d01 * vals[i + 1] + d11 * tang[i + 1]
    return v, dv


# ─── RadialLoft ────────────────────────────────────────────────────


class RadialLoft:
    """A solid given by its cross-sections at levels y (descending or
    ascending), each (y, cx, cz, radii[N_ANG]). Between levels the centre and
    outline are interpolated with cubic Hermite curves, the outline through
    its Fourier coefficients (harmonics up to `harmonics`), so it stays
    smooth. The ends are flat at the first and last levels; bones close them
    with their articular ends."""

    def __init__(self, stations, harmonics=8, frame=None):
        """`frame` (origin, R) places the loft in the rig: its local -Y runs
        along R's second column. R's columns are the local axes in rig
        coordinates."""
        self.frame = frame
        st = sorted(stations, key=lambda s: s[0])
        self.ys = np.array([s[0] for s in st], dtype=np.float64)
        cx = np.array([s[1] for s in st])
        cz = np.array([s[2] for s in st])
        R = np.array([np.asarray(s[3], dtype=np.float64) for s in st])
        F = np.fft.rfft(R, axis=1) / N_ANG
        F = F[:, : harmonics + 1]
        self.h = F.shape[1] - 1
        # channels: cx, cz, a0, then (re, im) for each harmonic
        ch = [cx, cz, F[:, 0].real]
        for k in range(1, self.h + 1):
            ch.append(F[:, k].real)
            ch.append(F[:, k].imag)
        self.vals = np.stack(ch, axis=1)
        rmax = R.max()
        self.lo = np.array([cx.min() - rmax, self.ys[0], cz.min() - rmax])
        self.hi = np.array([cx.max() + rmax, self.ys[-1], cz.max() + rmax])
        if frame is not None:
            o, M = frame
            o = np.asarray(o, dtype=np.float64)
            M = np.asarray(M, dtype=np.float64)
            corners = np.array([[x, y, z] for x in (self.lo[0], self.hi[0]) for y in (self.lo[1], self.hi[1]) for z in (self.lo[2], self.hi[2])])
            world = corners @ M.T + o
            self.wlo, self.whi = world.min(axis=0), world.max(axis=0)
            self.o, self.M = o, M

    def __call__(self, P):
        if self.frame is not None:
            return sdf._boxed(P, self.wlo, self.whi, lambda Q: self._eval((Q - self.o) @ self.M))
        return sdf._boxed(P, self.lo, self.hi, self._eval)

    def radius_at(self, y, phi_deg):
        v, _ = _hermite(self.ys, self.vals, np.atleast_1d(np.asarray(y, dtype=np.float64)))
        R, _, _ = self._outline(v, np.radians(np.atleast_1d(phi_deg)))
        return R

    def centre_at(self, y):
        v, _ = _hermite(self.ys, self.vals, np.atleast_1d(np.asarray(y, dtype=np.float64)))
        return v[:, 0], v[:, 1]

    def _outline(self, v, phi):
        R = v[:, 2].copy()
        dR = np.zeros_like(R)
        j = 3
        for k in range(1, self.h + 1):
            c, s = np.cos(k * phi), np.sin(k * phi)
            re, im = v[:, j], v[:, j + 1]
            # irfft of a real signal: 2 Re(F_k e^{ik phi})
            R += 2 * (re * c - im * s)
            dR += 2 * k * (-re * s - im * c)
            j += 2
        return R, dR, j

    def _eval(self, Q):
        out = np.empty(len(Q))
        for a in range(0, len(Q), 400000):
            out[a : a + 400000] = self._eval_chunk(Q[a : a + 400000])
        return out

    def _eval_chunk(self, Q):
        y = Q[:, 1].astype(np.float64)
        v, dv = _hermite(self.ys, self.vals, y)
        dx = Q[:, 0] - v[:, 0]
        dz = Q[:, 2] - v[:, 1]
        rho = np.sqrt(dx * dx + dz * dz)
        phi = np.arctan2(dz, dx)
        R, dRphi, _ = self._outline(v, phi)
        # dR/dy at fixed phi, including the centre's drift
        dRy = dv[:, 2].copy()
        j = 3
        for k in range(1, self.h + 1):
            c, s = np.cos(k * phi), np.sin(k * phi)
            dRy += 2 * (dv[:, j] * c - dv[:, j + 1] * s)
            j += 2
        drift = (dv[:, 0] * dx + dv[:, 1] * dz) / np.maximum(rho, 1e-6)
        R = np.maximum(R, 1e-4)
        g = np.sqrt(1 + (dRphi / R) ** 2 + (dRy + drift) ** 2)
        d = (rho - R) / g
        # flat ends
        d = np.maximum(d, np.maximum(y - self.ys[-1], self.ys[0] - y))
        return d


# ─── Lathe ─────────────────────────────────────────────────────────


def lathe(P, a, b, profile, per_span=4):
    """A surface of revolution about the axis a -> b. `profile` is a list of
    (t, r) with t in [0, 1] along the axis and r the radius (dm); it is
    smoothed with a Catmull-Rom spline and closed along the axis, so the
    distance is exact (the 2D distance in the (along, radius) half-plane)."""
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    L = float(np.linalg.norm(b - a))
    u = (b - a) / L
    pts = sdf._catmull([[t * L, r] for t, r in profile], per_span)
    poly = [[pts[0][0], 0.0]] + pts + [[pts[-1][0], 0.0]]
    rmax = max(r for _, r in profile)
    lo = np.minimum(a, b) - rmax
    hi = np.maximum(a, b) + rmax

    def f(Q):
        q = Q - a
        t = q @ u
        rho = np.linalg.norm(q - np.outer(t, u), axis=1)
        return sdf.polygon2d(t, rho, poly)

    return sdf._boxed(P, lo, hi, f)


# ─── Sweep ─────────────────────────────────────────────────────────


def limb_point(axis, y, ang, depth):
    """A point `depth` out from a vertical limb axis at height y, at `ang`
    degrees (0 anterior, 90 medial, 180 posterior, 270 lateral). `axis(y)`
    returns the axis's (x, z) there."""
    ax, az = axis(y)
    a = math.radians(ang)
    return (ax + depth * math.cos(a), y, az + depth * math.sin(a))


def limb_out(ang):
    a = math.radians(ang)
    return (math.cos(a), 0.0, math.sin(a))


PIECE_PAD = 0.09
JOINT_CAP = 0.012


class Sweep:
    """A band swept along a smooth path.

    stations: dicts with
      p     (x, y, z) on the path
      w     half-width across the band (along the section's B axis)
      t     half-thickness on the outer side (along N)
      ti    half-thickness on the inner side (default t): smaller is a
            flatter underside, as a muscle lying on the layer below
      out   the direction N should face (outwards from the limb); it is
            projected square to the path. Default: continue the last one.
      tend  0 muscle .. 1 tendon (interpolated, for colour; carries on
            from station to station until changed)
      shift offset of the section centre along N (default 0)
      h, f  how far this part of the path turns with the humerus and with
            the forearm (0..1; default: continue the last one, else 1, 0)
    `n` > 2 makes the section a superellipse: fuller, with flatter sides
    that pack against neighbours as real bellies do.
    The ends are rounded (an ellipsoidal cap as long as the section is thin).
    """

    def __init__(self, stations, per_span=8, name="", n=2.0):
        self.name = name
        self.n = float(n)
        pts = [list(s["p"]) for s in stations]
        k = len(stations)
        out = []
        last = None
        for s in stations:
            o = s.get("out", last)
            if o is None:
                o = (1.0, 0.0, 0.0)
            out.append(list(o))
            last = o
        params = []
        lh, lf, lt = 1.0, 0.0, 0.0
        for s in stations:
            w = s["w"]
            t = s.get("t", w)
            ti = s.get("ti", t)
            lh = s.get("h", lh)
            lf = s.get("f", lf)
            lt = s.get("tend", lt)
            params.append([w, t, ti, lt, s.get("shift", 0.0), lh, lf])
        dense = np.asarray(sdf._catmull([p + o + q for p, o, q in zip(pts, out, params)], per_span), dtype=np.float64)
        self.C = dense[:, 0:3]
        o = dense[:, 3:6]
        self.W = np.maximum(dense[:, 6], 1e-4)
        self.T = np.maximum(dense[:, 7], 1e-4)
        self.TI = np.maximum(dense[:, 8], 1e-4)
        self.TEND = np.clip(dense[:, 9], 0, 1)
        self.SHIFT = dense[:, 10]
        self.H = np.clip(dense[:, 11], 0, 1)
        self.F = np.clip(dense[:, 12], 0, 1)
        seg = np.diff(self.C, axis=0)
        L = np.linalg.norm(seg, axis=1)
        self.seg_len = np.maximum(L, 1e-9)
        self.S = np.concatenate([[0.0], np.cumsum(L)])
        self.length = float(self.S[-1])
        self.S /= max(self.length, 1e-9)
        tan = np.zeros_like(self.C)
        tan[1:-1] = self.C[2:] - self.C[:-2]
        tan[0] = self.C[1] - self.C[0]
        tan[-1] = self.C[-1] - self.C[-2]
        tan /= np.linalg.norm(tan, axis=1, keepdims=True)
        self.TAN = tan
        N = o - np.einsum("ij,ij->i", o, tan)[:, None] * tan
        bad = np.linalg.norm(N, axis=1) < 1e-6
        if bad.any():
            N[bad] = np.cross(tan[bad], [0.0, 0.0, 1.0])
        N /= np.linalg.norm(N, axis=1, keepdims=True)
        self.N = N
        self.B = np.cross(tan, N)
        r = np.maximum(self.W, np.maximum(self.T, self.TI)) + np.abs(self.SHIFT)
        self.r = r
        self.lo = (self.C - r[:, None]).min(axis=0)
        self.hi = (self.C + r[:, None]).max(axis=0)

    def _section_q(self, P, i, t, traw, ends_only=True):
        """Section coordinates of points P against path segment i at
        fraction t (clamped), with the path's smooth frame there."""
        tt = t[:, None]
        C = self.C[i] * (1 - tt) + self.C[i + 1] * tt
        Tv = self.TAN[i] * (1 - tt) + self.TAN[i + 1] * tt
        Tv /= np.linalg.norm(Tv, axis=1, keepdims=True)
        N = self.N[i] * (1 - tt) + self.N[i + 1] * tt
        N = N - np.einsum("ij,ij->i", N, Tv)[:, None] * Tv
        N /= np.linalg.norm(N, axis=1, keepdims=True)
        B = np.cross(Tv, N)
        shift = self.SHIFT[i] * (1 - t) + self.SHIFT[i + 1] * t
        d = P - C - N * shift[:, None]
        u = np.einsum("ij,ij->i", d, B)
        v = np.einsum("ij,ij->i", d, N)
        L = self.seg_len[i]
        last = len(self.C) - 2
        if ends_only:
            w = np.where((i == 0) & (traw < 0), traw * L, np.where((i == last) & (traw > 1), (traw - 1) * L, 0.0))
        else:
            w = (traw - t) * L
        W = self.W[i] * (1 - t) + self.W[i + 1] * t
        To = self.T[i] * (1 - t) + self.T[i + 1] * t
        Ti = self.TI[i] * (1 - t) + self.TI[i + 1] * t
        bb = np.where(v >= 0, To, Ti)
        c = np.minimum(W, bb)
        e = self.n
        q = (np.abs(u / W) ** e + np.abs(v / bb) ** e + np.abs(w / c) ** e) ** (1.0 / e)
        return q, u, v, w, W, bb, c

    def footprint(self, Q):
        """How far out across the band each point lies, ignoring depth: < 1
        over the band's footprint (a sheet painted onto whatever it lies
        on), and the depth off its centre sheet."""
        ok, i, t, traw = self._nearest(Q)
        e = self.n
        _, u, v, w, W, _, c = self._section_q(Q, i, t, traw)
        q = (np.abs(u / W) ** e + np.abs(w / c) ** e) ** (1.0 / e)
        return np.where(ok, q, np.inf), np.where(ok, v, np.inf)

    def _pieces(self, Q):
        """Each point is measured against the section at its nearest point on
        the path, with the path's smoothly interpolated frame and sizes there.
        Returns (field, segment, fraction, u, v)."""
        ok, bi, bt, btr = self._nearest(Q)
        q, u, v, w, W, bb, c = self._section_q(Q, bi, bt, btr)
        e = self.n
        if e == 2.0:
            q1 = np.sqrt((u / W**2) ** 2 + (v / bb**2) ** 2 + (w / c**2) ** 2)
            f = np.where(q1 > 1e-12, q * (q - 1.0) / np.maximum(q1, 1e-12), -np.minimum(W, bb))
        else:
            au, av, aw = np.abs(u / W), np.abs(v / bb), np.abs(w / c)
            qs = np.maximum(q, 1e-9) ** (1.0 - e)
            g = np.sqrt((qs * au ** (e - 1) / W) ** 2 + (qs * av ** (e - 1) / bb) ** 2 + (qs * aw ** (e - 1) / c) ** 2)
            f = np.maximum((q - 1.0) / np.maximum(g, 1e-9), -np.minimum(W, bb))
        f = np.where(ok, f, sdf.MARGIN)
        return f, bi, bt, u, v

    def _nearest(self, Q):
        """Each point's nearest point on the path: (found, segment,
        fraction clamped, fraction unclamped)."""
        n = len(Q)
        best = np.full(n, np.inf)
        bi = np.zeros(n, dtype=np.int64)
        bt = np.zeros(n)
        btr = np.zeros(n)
        pad = min(sdf.MARGIN, PIECE_PAD)
        for i in range(len(self.C) - 1):
            a, b = self.C[i], self.C[i + 1]
            rr = max(self.r[i], self.r[i + 1]) + pad
            lo = np.minimum(a, b) - rr
            hi = np.maximum(a, b) + rr
            m = (Q[:, 0] >= lo[0]) & (Q[:, 0] <= hi[0]) & (Q[:, 1] >= lo[1]) & (Q[:, 1] <= hi[1]) & (Q[:, 2] >= lo[2]) & (Q[:, 2] <= hi[2])
            if not m.any():
                continue
            idx = np.nonzero(m)[0]
            ab = b - a
            traw = ((Q[idx] - a) @ ab) / (ab @ ab)
            t = np.clip(traw, 0.0, 1.0)
            # the nearest path point (Euclidean): unique wherever a muscle's
            # width is less than its path's radius of curvature, so the
            # surface is smooth; keep bellies on straight-ish paths and give
            # long tendons their own thin heads (muscle_specs.py)
            q = np.einsum("ij,ij->i", Q[idx] - a - t[:, None] * ab, Q[idx] - a - t[:, None] * ab)
            better = q < best[idx]
            j = idx[better]
            best[j] = q[better]
            bi[j] = i
            bt[j] = t[better]
            btr[j] = traw[better]
        return np.isfinite(best), bi, bt, btr

    def field(self, Q):
        return self._pieces(Q)[0]

    def __call__(self, P):
        return sdf._boxed(P, self.lo, self.hi, self.field)

    def field_tend(self, P):
        """The field and, per point, the tendon weight of the path there (0
        muscle .. 1 tendon), in one pass. Beyond the box: MARGIN, tendon 0."""
        lo = self.lo - sdf.MARGIN
        hi = self.hi + sdf.MARGIN
        d = np.full(len(P), sdf.MARGIN)
        t = np.zeros(len(P))
        m = np.all((P >= lo) & (P <= hi), axis=1)
        if m.any():
            f, i, s, _, _ = self._pieces(P[m])
            d[m] = f
            t[m] = self.TEND[i] * (1 - s) + self.TEND[i + 1] * s
        return d, t

    def attributes(self, Q):
        """Per point: s along the path, and the path's tendon weight, bend
        weights (humerus, forearm), fibre direction and section frame."""
        _, i, t, u, v = self._pieces(Q)
        tt = t[:, None]
        lerp = lambda A: A[i] * (1 - t) + A[i + 1] * t
        fib = self.TAN[i] * (1 - tt) + self.TAN[i + 1] * tt
        fib /= np.linalg.norm(fib, axis=1, keepdims=True)
        N = self.N[i] * (1 - tt) + self.N[i + 1] * tt
        C = self.C[i] * (1 - tt) + self.C[i + 1] * tt
        s = self.S[i] * (1 - t) + self.S[i + 1] * t
        return dict(s=s, tend=lerp(self.TEND), h=lerp(self.H), f=lerp(self.F), fib=fib, N=N, C=C, u=u, v=v)


# ─── Pillow ────────────────────────────────────────────────────────


class Pillow:
    """A flat muscle filling a hollow of a flat bone (the fossae of the
    scapula), as a head alongside Sweeps.

    Its origin is an outline (u, v) in the bone's plane (origin o, unit axes
    U, V; `side` picks the face, +1 along U x V). It rises from the bone's
    surface (n0 out from the plane) as a dome, T thick, whose margin rounds
    down onto the bone over R, so the edge of the muscle sinks into its
    attachment as a real one does instead of ending in a slab's edge. T may
    be (medial, lateral): muscles converging on the shoulder are thicker
    towards the neck. Fibres run towards `toward` (u, v), where a Sweep
    carries the muscle on to its tendon."""

    def __init__(self, o, U, V, outline, T, R=0.08, n0=0.0, side=1.0, toward=(0.0, 0.0), h=0.0, f=0.0, name="", per_span=3):
        self.name = name
        self.o = np.asarray(o, dtype=np.float64)
        self.U = np.asarray(U, dtype=np.float64)
        self.V = np.asarray(V, dtype=np.float64)
        self.N = np.cross(self.U, self.V) * float(side)
        loop = [list(p) for p in outline] + [list(p) for p in outline[:3]]
        sm = sdf._catmull(loop, per_span)
        self.poly = np.asarray(sm[per_span : per_span * (len(outline) + 1)], dtype=np.float64)
        self.T = (float(T), float(T)) if np.isscalar(T) else (float(T[0]), float(T[1]))
        self.R = float(R)
        self.n0 = float(n0)
        self.umin, self.vmin = self.poly.min(axis=0)
        self.umax, self.vmax = self.poly.max(axis=0)
        self.toward = self.o + self.U * toward[0] + self.V * toward[1]
        self.h, self.f = float(h), float(f)
        corners = [self.o + self.U * a + self.V * b for a in (self.umin, self.umax) for b in (self.vmin, self.vmax)]
        top = self.n0 + max(self.T)
        pts = np.array(corners + [c + self.N * top for c in corners] + [c - self.N * 0.02 for c in corners])
        self.lo = pts.min(axis=0)
        self.hi = pts.max(axis=0)
        self.length = float(np.max(np.linalg.norm(np.array(corners) - self.toward, axis=1)))

    def _thick(self, a):
        k = np.clip((self.umax - a) / max(self.umax - self.umin, 1e-6), 0.0, 1.0)
        return self.T[0] + (self.T[1] - self.T[0]) * k

    def field(self, Q):
        q = Q - self.o
        a = q @ self.U
        b = q @ self.V
        c = q @ self.N
        d2 = sdf.polygon2d(a, b, self.poly)
        s = np.clip(-d2 / self.R, 0.0, 1.0)
        T = self._thick(a)
        h = T * (1.0 - (1.0 - s) ** 2)
        g = 2.0 * T * (1.0 - s) / self.R
        top = (c - self.n0 - h) / np.sqrt(1.0 + g * g)
        # cut at the bone's mid-plane: the buried part never shows
        return np.maximum(np.maximum(d2, top), -c)

    def __call__(self, P):
        return sdf._boxed(P, self.lo, self.hi, self.field)

    def field_tend(self, P):
        return self(P), np.zeros(len(P))

    def attributes(self, Q):
        q = Q - self.o
        c = q @ self.N
        C = Q - np.outer(c, self.N)
        d = self.toward - C
        d -= np.outer(d @ self.N, self.N)
        dist = np.linalg.norm(d, axis=1)
        fib = d / np.maximum(dist, 1e-9)[:, None]
        n = len(Q)
        return dict(
            s=np.clip(1.0 - dist / self.length, 0.0, 1.0) * 0.5,
            tend=np.zeros(n),
            h=np.full(n, self.h),
            f=np.full(n, self.f),
            fib=fib,
            N=np.tile(self.N, (n, 1)),
            C=C,
            u=q @ self.U,
            v=q @ self.V,
        )

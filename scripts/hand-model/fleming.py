"""A human left hand held in Fleming's left-hand rule, as one skin surface.

The skeleton is the arm build's (scripts/arm-model/hand.py): its 19 finger
bones, joint pivots and posing. Here the hand is posed with the first finger
straight, the second finger bent 90 degrees at its knuckle so it points out of
the palm, the thumb stretched out to the side, and the ring and little
fingers curled into the palm. The skin is a signed-distance field built
round the posed bones and meshed with the arm build's OpenVDB mesher.

Frames:
  HAND   the arm build's forearm frame, in decimetres: palm forward (+X),
         fingers down (-Y), thumb lateral (-Z).
  SCENE  the motor-effect scene's frame, in its world units: first finger
         along +X (the field B), thumb along +Y (the force F), second finger
         along +Z (the current I), the forearm running back along -X. The
         origin is the first finger's knuckle.

The field is evaluated in SCENE coordinates (`to_hand` maps them back), so the
mesh comes out in the scene's frame and units with nothing to place.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARM = os.path.join(HERE, "..", "arm-model")
if ARM not in sys.path:
    sys.path.insert(0, ARM)

import numpy as np  # noqa: E402

import hand as H  # noqa: E402
import sdf  # noqa: E402

SCALE = 2.4  # scene units per decimetre: a 19 cm hand is 4.6 units long

# Joint angles, degrees, in hand.py's terms: flex is per joint from the
# carpometacarpal out; abd is at the first joint.
POSE = {
    # stretched out sideways: extended at its saddle joint, a little
    # hyperextended at the knuckle and the tip, as a thumb held out is
    "thumb": dict(flex=[-50, -12, -8], abd=-18, spin=0),
    "index": dict(flex=[0, 0, 2, 2], abd=0),
    # bent at the knuckle only, the rest of the finger straight
    "middle": dict(flex=[0, 88, 4, 3], abd=0),
    # curled into the palm, the thumb clear of them
    "ring": dict(flex=[4, 84, 98, 52], abd=0),
    "little": dict(flex=[8, 86, 94, 48], abd=0),
}

RAYS = ("index", "middle", "ring", "little")


def unit(v):
    v = np.asarray(v, dtype=np.float64)
    return v / np.linalg.norm(v)


# ─── The posed skeleton ────────────────────────────────────────────


# The arm build's rays sit about 3.8 cm apart across the knuckles; a man's
# are nearer 5.5 cm, which the arm scenes never show (there the hand grips or
# points). Here the palm is the subject, so the rays are spread across (z)
# for this build only: their bases by SPREAD_BASE and their fan by SPREAD_FAN.
SPREAD_BASE = 1.3
SPREAD_FAN = 1.6
PALM_Z = -0.02  # the line the rays are spread from


def _spread_rays():
    out = {}
    for name, r in H.RAYS.items():
        r = dict(r)
        bx, by, bz = r["base"]
        r["base"] = (bx, by, PALM_Z + (bz - PALM_Z) * SPREAD_BASE)
        if name != "thumb":
            dx, dy, dz = r["dir"]
            r["dir"] = (dx, dy, dz * SPREAD_FAN)
        out[name] = r
    return out


def bones():
    """Every metacarpal and phalanx, posed: name, ray, kind, proximal pivot
    `a`, distal pivot `b`, frame `R` (columns: palmar, proximal, across),
    length and bone half-width."""
    H.POSES["fleming"] = POSE
    saved = H.RAYS
    H.RAYS = _spread_rays()  # put back below: the arm build shares the module
    try:
        segs = H.segments()
        M = H.pose_matrices("fleming")
    finally:
        H.RAYS = saved
    out = {}
    for i, s in enumerate(segs):
        if i == 0:
            continue
        A, t = M[i][:3, :3], M[i][:3, 3]
        a = A @ s["pivot"] + t
        b = A @ (s["pivot"] + s["R"] @ np.array([0.0, -s["L"], 0.0])) + t
        out[s["name"]] = dict(ray=s["ray"], kind=s["kind"], a=a, b=b, R=A @ s["R"], L=s["L"], w=s["w"])
    return out


BONES = bones()


def _frame():
    """Origin and rotation from HAND to SCENE."""
    i1, i3 = BONES["index_p1"], BONES["index_p3"]
    e1 = unit(i3["b"] - i1["a"])  # first finger -> +X
    m = BONES["middle_p1"]
    d2 = m["b"] - m["a"]
    e2 = unit(d2 - (d2 @ e1) * e1)  # second finger -> +Z
    e3 = np.cross(e2, e1)  # thumb -> +Y (X x Y = Z)
    return i1["a"].copy(), np.stack([e1, e3, e2])  # rows: scene x, y, z


ORIGIN, ROT = _frame()


def to_scene(Ph):
    return SCALE * (np.asarray(Ph, dtype=np.float64) - ORIGIN) @ ROT.T


def to_hand(Ps):
    return (np.asarray(Ps, dtype=np.float64) / SCALE) @ ROT + ORIGIN


def scene_dir(v):
    return np.asarray(v, dtype=np.float64) @ ROT.T


# ─── Primitives (HAND frame, decimetres) ───────────────────────────

M = 0.16  # beyond a primitive's box its distance is reported as this


def boxed(P, lo, hi, fn):
    lo = np.asarray(lo) - M
    hi = np.asarray(hi) + M
    out = np.full(len(P), M)
    m = np.all((P >= lo) & (P <= hi), axis=1)
    if m.any():
        out[m] = fn(P[m])
    return out


def smin(a, b, k):
    """Polynomial smooth minimum with a per-point (or scalar) width."""
    k = np.broadcast_to(np.asarray(k, dtype=np.float64), a.shape)
    out = np.minimum(a, b)
    m = (np.abs(a - b) < k) & (k > 1e-9)
    if m.any():
        am, bm, km = a[m], b[m], k[m]
        h = 0.5 + 0.5 * (bm - am) / km
        out[m] = bm * (1 - h) + am * h - km * h * (1 - h)
    return out


def limb(P, a, b, ux, r0, r1, squash=1.0, off=0.0):
    """A tapered capsule from a to b, its section an ellipse flattened
    `squash` along ux (the palmar direction), its axis moved `off` palmar
    of the bone's (the bone lies nearer the back of a finger)."""
    a = np.asarray(a) + ux * off
    b = np.asarray(b) + ux * off
    r = max(r0, r1)

    def f(Q):
        q = Q - a
        qx = q @ ux
        qs = q + np.outer(qx * (1.0 / squash - 1.0), ux)
        return sdf._round_cone(qs, np.zeros(3), b - a, r0, r1) * min(1.0, squash)

    return boxed(P, np.minimum(a, b) - r, np.maximum(a, b) + r, f)


def blob(P, c, axes, radii):
    """An ellipsoid with the given axes (columns) and radii."""
    c = np.asarray(c, dtype=np.float64)
    r = np.asarray(radii, dtype=np.float64)
    e = r.max()

    def f(Q):
        q = (Q - c) @ axes
        k0 = np.linalg.norm(q / r, axis=1)
        k1 = np.linalg.norm(q / (r * r), axis=1)
        return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)

    return boxed(P, c - e, c + e, f)


def triangle(P, A, B, C):
    """Unsigned distance to a triangle (IQ)."""
    A, B, C = (np.asarray(v, dtype=np.float64) for v in (A, B, C))

    def f(Q):
        ba, pa = B - A, Q - A
        cb, pb = C - B, Q - B
        ac, pc = A - C, Q - C
        nor = np.cross(ba, ac)
        inside = (np.sign(pa @ np.cross(ba, nor)) + np.sign(pb @ np.cross(cb, nor)) + np.sign(pc @ np.cross(ac, nor))) >= 2.0

        def seg(e, p):
            t = np.clip((p @ e) / (e @ e), 0.0, 1.0)
            d = p - np.outer(t, e)
            return np.einsum("ij,ij->i", d, d)

        edge = np.minimum(np.minimum(seg(ba, pa), seg(cb, pb)), seg(ac, pc))
        plane = (pa @ nor) ** 2 / (nor @ nor)
        return np.sqrt(np.where(inside, plane, edge))

    lo = np.minimum(np.minimum(A, B), C)
    hi = np.maximum(np.maximum(A, B), C)
    return boxed(P, lo, hi, f)


# ─── Sizes ─────────────────────────────────────────────────────────

# Skin half-widths (dm) over each finger bone, proximal end; a finger is
# about 2 cm wide at its base and 1.6 cm at the pad.
def skin_r(bone):
    r = 0.052 + 1.12 * bone["w"]
    if bone["ray"] == "thumb":
        r += 0.01
    return r


def tip_r(bone):
    return skin_r(bone) * 0.86


FINGER_SQUASH = 0.86  # fingers are a little flatter than round
FINGER_OFF = 0.012  # the bone sits towards the back of the finger
TIP_EXT = 0.028  # the pad reaches past the end of the bone


def digit_chain(ray):
    names = [n for n in ("p1", "p2", "p3") if f"{ray}_{n}" in BONES]
    return [BONES[f"{ray}_{n}"] for n in names]


def _axis(b):
    return unit(b["b"] - b["a"])


# ─── The skin field ────────────────────────────────────────────────

WRIST_Y = H.WRIST  # the radiocarpal joint line, HAND frame
FOREARM = 1.55  # dm of forearm drawn past the wrist


def digit_field(P, ray):
    """One finger (or the thumb's two phalanges) from its knuckle out."""
    chain = digit_chain(ray)
    d = None
    for j, b in enumerate(chain):
        ux = b["R"][:, 0]
        last = j == len(chain) - 1
        r0 = skin_r(b)
        r1 = tip_r(b) if last else skin_r(chain[j + 1])
        end = b["b"] + _axis(b) * (TIP_EXT if last else 0.0)
        di = limb(P, b["a"], end, ux, r0, r1, FINGER_SQUASH, FINGER_OFF)
        if last:
            # the pulp of the fingertip, fuller on the palm side
            ax = _axis(b)
            c = b["a"] + ax * (b["L"] * 0.62) + ux * (FINGER_OFF + 0.022)
            pad = blob(P, c, np.stack([ux, ax, b["R"][:, 2]], axis=1), (r1 * 0.8, b["L"] * 0.55, r1 * 0.95))
            di = smin(di, pad, 0.02)
            # the nail plate stands a hair proud of the back of the tip
            nc = b["a"] + ax * (b["L"] * 0.66) - ux * (r1 * FINGER_SQUASH * 0.82 - FINGER_OFF)
            nail = blob(P, nc, np.stack([ux, ax, b["R"][:, 2]], axis=1), (0.012, b["L"] * 0.5, r1 * 0.68))
            di = smin(di, nail, 0.008)
        d = di if d is None else smin(d, di, 0.014)
    # the bony back of each joint: the head of the bone proximal to it
    for j, b in enumerate(chain[1:]):
        prev = chain[j]
        ux = prev["R"][:, 0]
        ax = _axis(prev)
        # it shows on a bent joint and hardly at all on a straight one
        bend = 1.0 - float(ax @ _axis(b))
        r = skin_r(b) * 0.45
        rise = 0.002 + 0.016 * min(bend, 1.0)
        c = b["a"] - ux * (skin_r(b) * FINGER_SQUASH - FINGER_OFF - r + rise)
        d = smin(d, limb(P, c - ax * 0.012, c + ax * 0.012, ux, r, r, 0.8), 0.03)
    return d


def palm_field(P):
    d = None
    # the palm: a slab over the four metacarpals, fuller towards the knuckles
    for ray in RAYS:
        b = BONES[f"{ray}_mc"]
        ux = b["R"][:, 0]
        ax = _axis(b)
        a = b["a"] + ax * 0.06
        di = limb(P, a, b["b"], ux, 0.11, 0.118, 0.95, 0.026)
        d = di if d is None else smin(d, di, 0.085)
    # the knuckles: the heads of the metacarpals, under the skin of the back
    for ray in RAYS:
        b = BONES[f"{ray}_mc"]
        ux = b["R"][:, 0]
        # the bent fingers' knuckles stand out; the straight one's are soft
        flexed = BONES[f"{ray}_p1"]
        bend = 1.0 - max(0.0, _axis(flexed) @ _axis(b))
        r = 0.068 + 0.012 * bend
        d = smin(d, limb(P, b["b"] - b["R"][:, 2] * 0.02, b["b"] + b["R"][:, 2] * 0.02, ux, r, r, 1.0, -0.004), 0.05)
    # the thumb's metacarpal and the thenar eminence over it
    t = BONES["thumb_mc"]
    ux = t["R"][:, 0]
    ax = _axis(t)
    d = smin(d, limb(P, t["a"] + ax * 0.04, t["b"], ux, 0.118, 0.106, 0.95, 0.02), 0.07)
    mid = BONES["middle_mc"]
    palmar = mid["R"][:, 0]
    across = mid["R"][:, 2]
    c = t["a"] + ax * (t["L"] * 0.4) + palmar * 0.045 + across * 0.075
    pa = unit(ax + across * 0.4)
    pz = unit(np.cross(palmar, pa))
    pxx = np.cross(pa, pz)
    d = smin(d, blob(P, c, np.stack([pxx, pa, pz], axis=1), (0.055, 0.17, 0.11)), 0.1)
    # the hypothenar eminence along the little finger's side
    lm = BONES["little_mc"]
    lax = _axis(lm)
    c = lm["a"] + lax * (lm["L"] * 0.42) + palmar * 0.06 + lm["R"][:, 2] * 0.07
    d = smin(d, blob(P, c, np.stack([lm["R"][:, 0], lax, lm["R"][:, 2]], axis=1), (0.075, 0.25, 0.085)), 0.06)
    # the web between thumb and first finger: a thick sheet, thinning to its edge
    i = BONES["index_mc"]
    tp = BONES["thumb_p1"]
    A = t["a"] + _axis(t) * 0.1
    Bp = tp["a"] + _axis(tp) * 0.06
    C = i["a"] + _axis(i) * (i["L"] * 0.72)
    web = triangle(P, A, Bp, C) - 0.065
    # its free edge is a curve, hollowed back towards the root of the thumb
    mid = 0.5 * (Bp + C)
    out = unit(mid - A)
    rc = 0.55 * np.linalg.norm(Bp - C)
    web = sdf.cut(web, np.linalg.norm(P - (mid + out * rc * 0.82), axis=1) - rc, 0.03)
    d = smin(d, web, 0.07)
    return d


def wrist_field(P):
    """The wrist and a length of forearm, running back up +Y from the carpus."""
    ux = np.array([1.0, 0.0, 0.0])
    # the wrist is flat and narrow; the forearm swells into its muscles
    a = np.array([0.0, WRIST_Y - 0.12, 0.02])
    w = np.array([0.0, WRIST_Y + 0.3, 0.02])
    b = np.array([-0.02, WRIST_Y + FOREARM, 0.02])
    d = limb(P, a, w, ux, 0.27, 0.27, 0.6, 0.0)
    d = smin(d, limb(P, w, b, ux, 0.27, 0.35, 0.74, 0.0), 0.12)
    # the head of the ulna on the back of the wrist, little-finger side
    d = smin(d, blob(P, (-0.07, WRIST_Y + 0.1, 0.2), np.eye(3), (0.05, 0.07, 0.05)), 0.07)
    return d


def hand_field(P):
    """Distance (dm) to the skin, HAND frame."""
    d = smin(palm_field(P), wrist_field(P), 0.12)
    for ray in ("thumb",) + RAYS:
        dj = digit_field(P, ray)
        # a finger joins the palm with a fillet at its root only, so a
        # curled fingertip lying on the palm does not fuse to it
        base = digit_chain(ray)[0]["a"]
        reach = np.linalg.norm(P - base, axis=1)
        k = 0.05 * np.clip(1.0 - (reach - 0.06) / 0.1, 0.0, 1.0)
        d = smin(d, dj, k)
    return d


def scene_field(Ps):
    """Distance in SCENE units, SCENE frame: what the mesher samples."""
    return hand_field(to_hand(Ps)) * SCALE


def bounds():
    """SCENE-frame box round the hand and forearm."""
    pts = [b["a"] for b in BONES.values()] + [b["b"] for b in BONES.values()]
    pts += [np.array([0.0, WRIST_Y + FOREARM, 0.02])]
    S = to_scene(np.array(pts))
    return S.min(axis=0) - 0.45, S.max(axis=0) + 0.45


# ─── Colour ────────────────────────────────────────────────────────

SKIN = np.array([0.84, 0.62, 0.5])  # back of the hand
PALM = np.array([0.9, 0.69, 0.6])  # paler, pinker palm and finger pads
KNUCKLE = np.array([0.78, 0.53, 0.45])
CREASE = np.array([0.62, 0.42, 0.36])
NAIL = np.array([0.93, 0.75, 0.71])
NAIL_EDGE = np.array([0.97, 0.92, 0.86])


def _sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def _palmar_field(P, sigma=0.06):
    """Which way the palm faces, blended over every bone by nearness, so it
    turns smoothly from bone to bone instead of jumping where the nearest
    bone changes (which painted seams across the palm)."""
    acc = np.zeros((len(P), 3))
    tot = np.full(len(P), 1e-12)
    for b in BONES.values():
        ab = b["b"] - b["a"]
        t = np.clip(((P - b["a"]) @ ab) / (ab @ ab), 0, 1)
        dist = np.linalg.norm(P - (b["a"] + np.outer(t, ab)), axis=1)
        w = np.exp(-((dist / sigma) ** 2))
        acc += w[:, None] * b["R"][:, 0]
        tot += w
    v = acc / tot[:, None]
    far = (tot < 1e-6)[:, None]
    v = np.where(far, np.array([1.0, 0.0, 0.0]), v)
    return v / np.maximum(np.linalg.norm(v, axis=1), 1e-9)[:, None]


def colour(Ps, Ns):
    """sRGB colour and alpha per vertex (SCENE frame in, as stored)."""
    P = to_hand(Ps)
    N = np.asarray(Ns) @ ROT  # scene normal -> hand frame
    n = len(P)
    palmar_ax = _palmar_field(P)
    # on the forearm and wrist the palm faces +X: blend into it at the wrist
    arm_w = _sstep(WRIST_Y - 0.35, WRIST_Y + 0.05, P[:, 1])[:, None]
    palmar_ax = palmar_ax * (1 - arm_w) + np.array([1.0, 0.0, 0.0]) * arm_w
    on_arm = P[:, 1] > WRIST_Y - 0.12
    facing = np.einsum("ij,ij->i", N, palmar_ax)
    # the inner forearm is only a shade paler than the back of it
    c = SKIN + (PALM - SKIN) * (_sstep(-0.2, 0.7, facing) * (1 - 0.75 * arm_w[:, 0]))[:, None]
    # warmth over the knuckles on the back of the hand and fingers
    warm = np.zeros(n)
    crease = np.zeros(n)
    for ray in ("thumb",) + RAYS:
        chain = digit_chain(ray)
        joints = [BONES[f"{ray}_mc"]] + chain
        for j in range(1, len(joints)):
            prev, b = joints[j - 1], joints[j]
            back = b["a"] - prev["R"][:, 0] * 0.08
            warm = np.maximum(warm, np.exp(-np.sum((P - back) ** 2, axis=1) / 0.004))
            # a flexion crease across the palm side of each finger joint
            ax = _axis(b)
            s = (P - b["a"]) @ ax
            if prev["kind"] == "mc":
                s = s - 0.07  # the finger's root crease lies past the knuckle
            near = np.linalg.norm(P - b["a"], axis=1) < 0.16
            line = np.exp(-(s ** 2) / (2 * 0.007 ** 2)) * near
            crease = np.maximum(crease, line * _sstep(0.2, 0.7, N @ b["R"][:, 0]))
    # the palm's three main creases: round the thenar eminence, and two across
    t = BONES["thumb_mc"]
    mid = BONES["middle_mc"]
    palmar = mid["R"][:, 0]
    on_palm = _sstep(0.3, 0.75, N @ palmar) * (~on_arm)
    c_then = t["a"] + _axis(t) * (t["L"] * 0.45) + palmar * 0.07 + mid["R"][:, 2] * 0.07
    life = np.abs(np.linalg.norm((P - c_then) / np.array([0.16, 0.24, 0.16]), axis=1) - 1.0)
    crease = np.maximum(crease, np.exp(-(life ** 2) / (2 * 0.04 ** 2)) * on_palm * 0.8)
    mc_ax = _axis(mid)
    for frac, lo_z, hi_z in ((0.78, -0.05, 0.36), (0.62, -0.3, 0.12)):
        y0 = mid["a"] + mc_ax * (mid["L"] * frac)
        s = (P - y0) @ mc_ax + 0.04 * ((P[:, 2] - 0.05) ** 2) * 6.0
        span = _sstep(lo_z - 0.03, lo_z + 0.03, P[:, 2]) * (1 - _sstep(hi_z - 0.03, hi_z + 0.03, P[:, 2]))
        crease = np.maximum(crease, np.exp(-(s ** 2) / (2 * 0.006 ** 2)) * on_palm * span * 0.7)
    c = c + (KNUCKLE - c) * (warm * 0.5 * (1 - _sstep(0.0, 0.5, facing)))[:, None]
    c = c + (CREASE - c) * (crease * 0.35)[:, None]
    # nails on the back of each fingertip
    for ray in ("thumb",) + RAYS:
        b = digit_chain(ray)[-1]
        ax = _axis(b)
        ux = b["R"][:, 0]
        uz = b["R"][:, 2]
        q = P - b["a"]
        s = (q @ ax) / b["L"]
        x = q @ ux
        z = q @ uz
        r1 = tip_r(b)
        back = -x / (r1 * FINGER_SQUASH)
        # only on the fingertip itself: a curled finger's tip points back at
        # the wrist, and an open-ended mask would paint nail down the forearm
        on_tip = (1 - _sstep(1.15, 1.25, s)) * (1 - _sstep(1.2, 1.4, np.sqrt(x * x + z * z) / r1))
        m = _sstep(0.32, 0.4, s) * _sstep(0.25, 0.45, back) * (1 - _sstep(0.62, 0.74, np.abs(z) / r1)) * on_tip
        tipw = _sstep(1.0, 1.12, s)
        nc = NAIL + (NAIL_EDGE - NAIL) * tipw[:, None]
        # the lunula, the pale half-moon at the nail's root
        lun = _sstep(0.44, 0.38, s) * 0.5
        nc = nc + (NAIL_EDGE - nc) * lun[:, None]
        c = c + (nc - c) * m[:, None]
    # faint mottling, so the skin is not a flat paint
    mot = sdf.value_noise(P, (0.03, 0.03, 0.03), seed=11) - 0.5
    c = np.clip(c * (1.0 + 0.05 * mot[:, None]), 0, 1)
    # the forearm fades out behind the wrist
    alpha = 1.0 - _sstep(WRIST_Y + 0.45, WRIST_Y + FOREARM - 0.05, P[:, 1])
    return c, alpha


# ─── What the scene anchors to ─────────────────────────────────────


def anchors():
    """Each digit's tip and pointing direction, SCENE frame."""
    out = {}
    for ray, key in (("index", "field"), ("middle", "current"), ("thumb", "force")):
        b = digit_chain(ray)[-1]
        ax = _axis(b)
        tip = b["b"] + ax * (TIP_EXT + tip_r(b)) + b["R"][:, 0] * FINGER_OFF
        out[key] = dict(tip=[round(float(v), 4) for v in to_scene(tip[None])[0]], dir=[round(float(v), 4) for v in unit(scene_dir(ax))])
    return out

"""The bones of the left upper limb, modelled from cross-sections.

Traced against Gray's Anatomy (20th ed., public domain): the humerus from
Figs. 207-208, the radius and ulna from 212-214, the hand from 219-220 and
the scapula and clavicle from 200-203. Widths are scaled to standard adult
measurements (a 32 cm humerus with a 4.7 cm head and a 6.3 cm epicondylar
breadth; a 26 cm ulna; a 24 cm radius with a 2.3 cm head).

Rig frame (see armlib.py): decimetres, +X anterior, -Y down the limb, +Z
medial; the humerus hangs from its head's centre at the origin and the elbow
axis is 3 dm below it, along Z. Each long bone is a RadialLoft (its outline
level by level) with its articular ends and processes blended on.
"""

import math

import numpy as np

import sculpt
from armlib import decimate, shade_smooth, smooth, tri_count
from sculpt import RadialLoft, bump, lathe, section
from sdf import capsule, cut, ellipsoid, mesh_sdf, roughen, smax, smin, sphere, tube

H = 3.0  # humeral head centre to the elbow axis (ARM.humerus)
GRAIN = 0.0012  # periosteal texture, dm


def grain(d, P, seed):
    return roughen(d, P, GRAIN, (0.03, 0.03, 0.03), seed, octaves=2)


def finish(obj, target_tris, smooth_iters=2):
    if smooth_iters:
        smooth(obj, iters=smooth_iters, factor=0.5)
    n = tri_count(obj)
    if n > target_tris:
        decimate(obj, target_tris / n)
    shade_smooth(obj)
    return obj


def unit(v):
    v = np.asarray(v, dtype=np.float64)
    return v / np.linalg.norm(v)


def halfspace(P, n, offset):
    """Distance to the plane P.n = offset (positive on the +n side)."""
    return P @ unit(n) - offset


# ─── Humerus (humerus frame) ───────────────────────────────────────

# The head faces up (neck-shaft angle 135 deg), in and back (30 deg of
# retroversion); its articular cap is a little under a hemisphere.
HEAD_R = 0.235
HEAD_AXIS = unit((-math.sin(math.radians(30)) * math.cos(math.radians(45)), math.sin(math.radians(45)), math.cos(math.radians(30)) * math.cos(math.radians(45))))


def _humerus_sections():
    S = []

    def add(y, cx, cz, r):
        S.append((y, cx, cz, r))

    # Greater tubercle's top, then the metaphysis carrying both tubercles,
    # with the bicipital groove between them (anterior, ~0 deg) and the
    # lesser tubercle anteromedial (~45 deg). The head (added separately)
    # sits on its medial, upper and back side.
    add(0.155, -0.005, -0.2, section(0.04, 0.04, 0.04, 0.04))
    add(0.135, -0.005, -0.195, section(0.085, 0.085, 0.075, 0.08))
    add(0.08, 0.005, -0.165, section(0.14, 0.14, 0.11, 0.13))
    r = section(0.175, 0.16, 0.14, 0.145)
    r = bump(r, 45, 0.02, 25)
    r = bump(r, 3, -0.025, 16)
    add(0.0, 0.015, -0.15, r)
    r = section(0.18, 0.16, 0.16, 0.15)
    r = bump(r, 45, 0.028, 22)  # lesser tubercle
    r = bump(r, -35, 0.01, 25)  # crest of the greater tubercle
    r = bump(r, 3, -0.03, 15)  # bicipital groove
    add(-0.1, 0.025, -0.135, r)
    r = section(0.16, 0.15, 0.175, 0.14)
    r = bump(r, 40, 0.012, 22)
    r = bump(r, -30, 0.01, 22)
    r = bump(r, 3, -0.025, 16)
    add(-0.22, 0.028, -0.115, r)
    r = section(0.135, 0.13, 0.14, 0.125)
    r = bump(r, 3, -0.016, 18)
    add(-0.35, 0.028, -0.1, r)
    # surgical neck
    r = section(0.122, 0.118, 0.118, 0.12)
    r = bump(r, 3, -0.009, 20)
    add(-0.52, 0.025, -0.095, r)
    r = section(0.115, 0.11, 0.106, 0.116)
    r = bump(r, 3, -0.004, 22)
    add(-0.8, 0.02, -0.095, r)
    # deltoid tuberosity: a raised V on the anterolateral surface
    r = section(0.11, 0.105, 0.102, 0.118)
    r = bump(r, -70, 0.016, 30)
    add(-1.1, 0.012, -0.097, r)
    r = section(0.107, 0.102, 0.1, 0.118)
    r = bump(r, -75, 0.02, 26)
    r = bump(r, 190, -0.007, 30)  # radial groove, spiralling down the back
    add(-1.3, 0.006, -0.096, r)
    r = section(0.105, 0.1, 0.1, 0.11)
    r = bump(r, 215, -0.007, 30)
    add(-1.55, -0.002, -0.093, r)
    # the lower shaft turns triangular, then flattens into a plate between
    # the two supracondylar ridges, and curves forward into the condyle
    r = section(0.1, 0.096, 0.115, 0.112)
    r = bump(r, 95, 0.012, 22)
    r = bump(r, 265, 0.012, 22)
    add(-1.9, -0.015, -0.085, r)
    r = section(0.095, 0.092, 0.15, 0.15)
    r = bump(r, 92, 0.022, 18)
    r = bump(r, 268, 0.022, 18)
    add(-2.15, -0.03, -0.07, r)
    r = section(0.085, 0.084, 0.215, 0.205, n=2.4)
    r = bump(r, 90, 0.02, 14)
    r = bump(r, 270, 0.02, 14)
    add(-2.4, -0.055, -0.045, r)
    r = section(0.08, 0.082, 0.285, 0.245, n=2.6)
    r = bump(r, 90, 0.012, 12)
    r = bump(r, 270, 0.012, 12)
    add(-2.6, -0.065, -0.02, r)
    add(-2.74, -0.06, 0.02, section(0.095, 0.09, 0.3, 0.26, n=2.4))
    add(-2.86, -0.045, 0.02, section(0.1, 0.1, 0.25, 0.22, n=2.2))
    add(-2.93, -0.025, 0.02, section(0.09, 0.09, 0.17, 0.16, n=2.0))
    return S


# The humerus's articular condyle, about the elbow axis (rig Z through the
# forearm frame's origin): the capitulum laterally, then the trochlea's
# spool, its medial lip the largest and lowest. Shared with the ulna and
# radius, whose joint surfaces are cut to fit it.
CONDYLE_PROFILE = [
    (0.0, 0.05),
    (0.06, 0.085),
    (0.2, 0.1),  # capitulum
    (0.36, 0.093),
    (0.43, 0.083),  # capitulotrochlear groove
    (0.51, 0.1),  # lateral lip of the trochlea
    (0.64, 0.083),  # trochlear groove
    (0.82, 0.118),  # medial lip
    (0.93, 0.112),
    (1.0, 0.07),
]


def condyle_field(Q, inflate=0.0):
    """The condyle in the forearm frame (elbow axis through the origin)."""
    prof = [(t, r + inflate) for t, r in CONDYLE_PROFILE]
    return sculpt.lathe(Q, (0.0, 0.0, -0.21 - inflate), (0.0, 0.0, 0.25 + inflate), prof)


HUMERUS_SHAFT = None


def humerus_field(P):
    global HUMERUS_SHAFT
    if HUMERUS_SHAFT is None:
        HUMERUS_SHAFT = RadialLoft(_humerus_sections(), harmonics=10)
    d = HUMERUS_SHAFT(P)

    # Head: the articular cap of a 4.7 cm sphere, cut off at the anatomical
    # neck, which leaves a slight lip where it meets the metaphysis.
    head = sphere(P, (0.0, 0.0, 0.0), HEAD_R)
    head = smax(head, -halfspace(P, HEAD_AXIS, 0.02), 0.03)
    # The neck under it: bone fills in from the head's rim to the shaft, so
    # the head sits on the metaphysis instead of overhanging it.
    d = smin(d, capsule(P, (-0.01, -0.03, 0.03), (0.02, -0.5, -0.09), 0.19, 0.115), 0.06)
    d = smin(d, head, 0.06)

    # Distal end. The articular condyle turns about the elbow axis (rig Z
    # through (0, -3, 0)): the capitulum laterally, then the trochlea's
    # spool, its medial lip the largest and lowest.
    condyle = condyle_field(P - np.array([0.0, -H, 0.0], dtype=P.dtype))
    d = smin(d, condyle, 0.05)
    # The supracondylar ridges thicken into the epicondyles: the medial one
    # a prominent blunt hook (the ulnar nerve runs behind it), the lateral
    # one small, just above the capitulum.
    d = smin(d, capsule(P, (-0.065, -2.42, 0.17), (-0.05, -2.84, 0.31), 0.03, 0.06), 0.08)
    d = smin(d, capsule(P, (-0.06, -2.42, -0.16), (-0.04, -2.84, -0.225), 0.024, 0.036), 0.07)
    # the lateral condyle rounds off behind the capitulum into one knob
    d = smin(d, ellipsoid(P, (-0.03, -2.93, -0.13), (0.085, 0.085, 0.075)), 0.07)
    # Fossae just above the condyle: the olecranon fossa behind (deep), the
    # coronoid and radial fossae in front (shallow).
    d = cut(d, ellipsoid(P, (-0.125, -2.7, 0.08), (0.065, 0.13, 0.095)), 0.05)
    d = cut(d, ellipsoid(P, (0.105, -2.8, 0.1), (0.04, 0.07, 0.055)), 0.03)
    d = cut(d, ellipsoid(P, (0.1, -2.84, -0.105), (0.03, 0.05, 0.045)), 0.03)
    return grain(d, P, 1)


def humerus(col, voxel=0.007):
    obj = mesh_sdf("humerus", col, humerus_field, (-0.28, -3.15, -0.35), (0.28, 0.28, 0.42), voxel)
    return finish(obj, 30000, smooth_iters=1)


# ─── Ulna and radius (forearm frame: elbow axis at the origin) ──────

RADIAL_HEAD = (0.0, -0.105)  # (x, z) of the radius's axis at its head
RADIAL_HEAD_R = 0.11
ULNA_HEAD = (-0.02, -2.2, 0.18)
ULNA_HEAD_R = 0.07


def _ulna_sections():
    S = []

    def add(y, cx, cz, r):
        S.append((y, cx, cz, r))

    # Olecranon: the point of the elbow, rising behind the trochlea, its
    # beak hooking forward over it (the notch is cut out by the condyle).
    add(0.225, -0.13, 0.125, section(0.04, 0.05, 0.05, 0.05))
    add(0.2, -0.12, 0.125, section(0.085, 0.07, 0.08, 0.075))
    add(0.14, -0.105, 0.125, section(0.12, 0.095, 0.1, 0.09))
    add(0.04, -0.085, 0.125, section(0.12, 0.1, 0.1, 0.095))
    # Coronoid process jutting forward under the notch, the radial notch on
    # its lateral side.
    add(-0.08, -0.05, 0.125, section(0.17, 0.1, 0.1, 0.12))
    add(-0.16, -0.03, 0.125, section(0.165, 0.1, 0.095, 0.135))
    # Ulnar tuberosity (brachialis), then the shaft: triangular, its sharp
    # interosseous border facing the radius (laterally), tapering to the wrist.
    r = section(0.115, 0.1, 0.1, 0.11)
    r = bump(r, 0, 0.015, 30)
    add(-0.27, -0.015, 0.13, r)
    r = section(0.095, 0.095, 0.09, 0.1)
    r = bump(r, 270, 0.022, 20)
    add(-0.5, -0.02, 0.138, r)
    r = section(0.082, 0.082, 0.078, 0.088)
    r = bump(r, 270, 0.02, 18)
    add(-0.95, -0.025, 0.152, r)
    r = section(0.068, 0.068, 0.064, 0.074)
    r = bump(r, 270, 0.016, 18)
    add(-1.45, -0.028, 0.164, r)
    add(-1.9, -0.028, 0.175, section(0.056, 0.057, 0.055, 0.06))
    # head
    add(-2.08, -0.024, 0.18, section(0.062, 0.062, 0.064, 0.066))
    add(-2.18, -0.02, 0.18, section(0.07, 0.07, 0.072, 0.074))
    add(-2.25, -0.02, 0.18, section(0.05, 0.05, 0.055, 0.055))
    return S


def _radius_sections():
    S = []

    def add(y, cx, cz, r):
        S.append((y, cx, cz, r))

    hx, hz = RADIAL_HEAD
    # Head: a thick disc under the capitulum, then the narrow neck.
    add(-0.095, hx, hz, section(0.1, 0.1, 0.1, 0.1))
    add(-0.11, hx, hz, section(RADIAL_HEAD_R, RADIAL_HEAD_R, RADIAL_HEAD_R, RADIAL_HEAD_R))
    add(-0.18, hx, hz, section(0.107, 0.107, 0.107, 0.107))
    add(-0.215, hx, hz + 0.003, section(0.075, 0.075, 0.075, 0.075))
    add(-0.3, hx + 0.005, hz + 0.005, section(0.064, 0.064, 0.064, 0.064))
    # Radial tuberosity (biceps), anteromedial.
    r = bump(section(0.072, 0.07, 0.07, 0.07), 50, 0.035, 38)
    add(-0.4, hx + 0.01, hz + 0.003, r)
    r = bump(section(0.07, 0.068, 0.07, 0.068), 60, 0.012, 35)
    add(-0.52, hx + 0.012, hz - 0.005, r)
    # Shaft: bowed laterally, triangular with its interosseous border facing
    # the ulna (medially), widening to the wrist.
    r = bump(section(0.068, 0.066, 0.07, 0.07), 90, 0.02, 18)
    add(-0.8, 0.015, -0.13, r)
    r = bump(section(0.074, 0.07, 0.08, 0.078), 90, 0.022, 18)
    add(-1.2, 0.016, -0.15, r)
    r = bump(section(0.085, 0.078, 0.095, 0.095), 90, 0.018, 20)
    add(-1.6, 0.014, -0.148, r)
    r = section(0.098, 0.088, 0.13, 0.125)
    add(-1.92, 0.01, -0.128, r)
    # Distal end: broad; the dorsal (Lister) tubercle behind, the ulnar
    # notch facing the ulna, the styloid process laterally.
    r = bump(section(0.105, 0.1, 0.155, 0.16, n=2.3), 190, 0.02, 14)
    add(-2.1, 0.005, -0.105, r)
    add(-2.2, 0.0, -0.1, section(0.1, 0.1, 0.16, 0.17, n=2.3))
    add(-2.26, -0.005, -0.1, section(0.085, 0.085, 0.14, 0.16, n=2.2))
    return S


_ULNA = None
_RADIUS = None


def ulna_field(P):
    global _ULNA
    if _ULNA is None:
        _ULNA = RadialLoft(_ulna_sections(), harmonics=10)
    d = _ULNA(P)
    # styloid process, posteromedial
    d = smin(d, capsule(P, (-0.05, -2.14, 0.215), (-0.05, -2.32, 0.225), 0.032, 0.016), 0.03)
    # Trochlear notch: the ulna wraps the trochlea, so cut it to its shape
    # (with a film of cartilage between); the radial notch likewise takes the
    # radial head.
    d = cut(d, condyle_field(P, inflate=0.012), 0.012)
    hx, hz = RADIAL_HEAD
    d = cut(d, sculpt_cyl(P, (hx, -0.1, hz), (hx, -0.2, hz), RADIAL_HEAD_R + 0.01), 0.01)
    return grain(d, P, 2)


def radius_field(P):
    global _RADIUS
    if _RADIUS is None:
        _RADIUS = RadialLoft(_radius_sections(), harmonics=10)
    d = _RADIUS(P)
    d = smin(d, capsule(P, (0.0, -2.14, -0.225), (-0.005, -2.36, -0.25), 0.045, 0.02), 0.04)
    # the fovea on top of the head, cupped to the capitulum; the ulnar notch
    d = cut(d, condyle_field(P, inflate=0.012), 0.01)
    d = cut(d, sphere(P, ULNA_HEAD, ULNA_HEAD_R + 0.01), 0.01)
    # the carpal surface: shallowly concave, facing down and a little forward
    d = cut(d, ellipsoid(P, (0.02, -2.43, -0.09), (0.12, 0.18, 0.22)), 0.015)
    return grain(d, P, 3)


def sculpt_cyl(P, a, b, r):
    from sdf import cylinder

    return cylinder(P, a, b, r)


def forearm_bones(col, voxel=0.006):
    u = mesh_sdf("ulna", col, ulna_field, (-0.25, -2.36, -0.03), (0.2, 0.26, 0.32), voxel)
    r = mesh_sdf("radius", col, radius_field, (-0.15, -2.4, -0.33), (0.15, -0.06, 0.1), voxel)
    return [finish(u, 14000, 1), finish(r, 14000, 1)]


# ─── Shoulder girdle (shoulder frame, fixed) ─────────────────────────

# The scapular plane runs medially and back from the glenoid at about 35
# deg to the coronal plane; the glenoid faces along -BLADE_U (forwards and
# out), meeting the humeral head, which faces back and in.
BLADE_U = unit((-0.57, 0.0, 0.82))
BLADE_V = np.array([0.0, 1.0, 0.0])
BLADE_N = np.cross(BLADE_U, BLADE_V)  # the dorsal side: back and out
GLENOID = BLADE_U * (HEAD_R + 0.02)
BLADE_O = GLENOID + BLADE_U * 0.03

# The blade's outline in (u, v) of the scapular plane, dm, traced from
# Gray's Fig. 203 (left scapula, dorsal view) at 2.25 mm per pixel: superior
# angle, down the medial border to the inferior angle, up the lateral border
# to the glenoid neck, and along the superior border past the notch.
BLADE = [
    (0.877, 0.292), (0.952, 0.121), (0.983, 0.007), (0.992, -0.101), (1.01, -0.193), (1.001, -0.286),
    (0.988, -0.331), (0.967, -0.412), (0.956, -0.495), (0.952, -0.589), (0.949, -0.706), (0.943, -0.772),
    (0.929, -0.841), (0.907, -0.911), (0.877, -0.981), (0.832, -1.042), (0.781, -1.102), (0.722, -1.159),
    (0.657, -1.213), (0.583, -1.253), (0.529, -1.262), (0.461, -1.215), (0.394, -1.154), (0.344, -1.08),
    (0.308, -1.006), (0.281, -0.934), (0.27, -0.844), (0.259, -0.742), (0.252, -0.641), (0.243, -0.551),
    (0.227, -0.479), (0.2, -0.409), (0.169, -0.344), (0.124, -0.27), (0.079, -0.18), (0.03, -0.09),
    (0.02, 0.06), (0.079, 0.112), (0.236, 0.146), (0.394, 0.18), (0.502, 0.166), (0.587, 0.166),
    (0.686, 0.18), (0.787, 0.281),
]


def S3(u, v, n=0.0):
    """A point in the scapular plane (u medial, v up, n dorsal), rig."""
    return BLADE_O + BLADE_U * u + BLADE_V * v + BLADE_N * n


def girdle_field(P):
    from sculpt import Sweep
    from sdf import plate, flat_tube

    # Blade: thin in its fossae, thickened along the lateral (axillary)
    # border that runs from the glenoid to the inferior angle, and a little
    # along the medial border.
    lat0, lat1 = np.array([0.03, -0.08]), np.array([0.53, -1.25])
    ld = (lat1 - lat0) / np.linalg.norm(lat1 - lat0)

    def rim(a, b):
        q = np.stack([a - lat0[0], b - lat0[1]], axis=1)
        t = np.clip(q @ ld, 0, np.linalg.norm(lat1 - lat0))
        dist = np.linalg.norm(q - t[:, None] * ld, axis=1)
        lateral = 0.03 * np.exp(-((dist / 0.07) ** 2))
        medial = 0.006 * np.exp(-(((a - 0.98) / 0.05) ** 2))
        return lateral + medial

    # the blade's costal face is gently hollow, to lie on the ribs
    d = plate(P, BLADE_O, BLADE_U, BLADE_V, BLADE, 0.011, thicken=rim, per_span=3)
    # Glenoid neck, and the shallow pear-shaped cavity cut to the head.
    d = smin(d, ellipsoid(P, tuple(S3(0.035, -0.02, 0.0)), (0.07, 0.17, 0.12)), 0.05)
    d = smin(d, ellipsoid(P, tuple(S3(-0.005, -0.03, 0.0)), (0.035, 0.19, 0.13)), 0.03)
    d = cut(d, sphere(P, (0.0, 0.0, 0.0), HEAD_R + 0.018), 0.012)
    # Spine: a fin standing off the dorsal face, taller towards the
    # shoulder, its crest thickened, rising into the acromion.
    root, mid, lat = (0.99, -0.14), (0.6, 0.0), (0.25, 0.13)
    fin = []
    for (u, v), h, w in ((root, 0.035, 0.035), (mid, 0.09, 0.05), (lat, 0.14, 0.065)):
        fin.append(dict(p=tuple(S3(u, v, h * 0.5)), w=w, t=h * 0.5 + 0.012, out=tuple(BLADE_N)))
    d = smin(d, Sweep(fin, name="spine")(P), 0.025)
    # the crest: broad and flattened, facing back
    acromial_angle = np.array([-0.26, 0.345, -0.1])
    crest = [
        dict(p=tuple(S3(1.0, -0.16, 0.03)), w=0.03, t=0.018, out=tuple(BLADE_N)),
        dict(p=tuple(S3(0.6, 0.0, 0.09)), w=0.045, t=0.02),
        dict(p=tuple(S3(0.25, 0.13, 0.15)), w=0.055, t=0.024),
        dict(p=tuple(acromial_angle + np.array([0.02, -0.02, 0.06])), w=0.06, t=0.028),
    ]
    d = smin(d, Sweep(crest, name="crest")(P), 0.03)
    # Acromion: a flat, broad plate arching over the top of the humeral
    # head, sloping down laterally; its front tip in front of the head.
    acr = [(-0.22, 0.02), (-0.16, -0.09), (-0.02, -0.12), (0.1, -0.1), (0.18, -0.02), (0.15, 0.07), (0.05, 0.1), (-0.08, 0.14), (-0.2, 0.12)]
    tilt = unit((0.0, 0.25, 1.0))  # the plate's z axis, tipped down laterally
    d = smin(d, plate(P, (-0.04, 0.375, -0.1), (1.0, 0.0, 0.0), tuple(tilt), acr, 0.01, per_span=3) - 0.024, 0.035)
    # Coracoid: a bent finger from the top of the glenoid neck, up, then
    # forwards and out, its tip in front of and inside the head.
    cor = [(*S3(0.06, 0.12, -0.03), 0.045), (0.02, 0.2, 0.27, 0.042), (0.17, 0.2, 0.26, 0.038), (0.28, 0.12, 0.2, 0.033), (0.32, 0.06, 0.18, 0.03)]
    d = smin(d, tube(P, cor), 0.04)
    # Clavicle: an S from the acromion to the sternum, flat at its lateral
    # end and round and stout medially.
    clav = flat_tube(
        P,
        [(0.07, 0.395, 0.02, 0.065), (0.13, 0.41, 0.3, 0.064), (0.22, 0.39, 0.62, 0.066), (0.3, 0.34, 0.98, 0.07), (0.34, 0.29, 1.35, 0.085), (0.34, 0.28, 1.45, 0.08)],
        (0, 1, 0),
        0.72,
    )
    d = np.minimum(d, clav)
    return grain(d, P, 5)


def girdle(col, voxel=0.008):
    import sdf

    saved = sdf.MARGIN
    sdf.MARGIN = 0.2
    try:
        obj = mesh_sdf("girdle", col, girdle_field, (-1.1, -1.55, -0.35), (0.5, 0.55, 1.6), voxel)
    finally:
        sdf.MARGIN = saved
    return finish(obj, 26000, 1)

"""What each muscle is: its path, its section level by level, where it turns
to tendon, and how it bends with the joints.

Paths and sections are laid out from Gray's Anatomy (Figs. 409-424: the
muscles of the shoulder, arm, forearm and hand, and the transverse
sections through the middle of the arm and forearm), with sizes from
standard adult measurements: an upper arm about 10 cm front to back and
8.5 cm across at mid-length under the skin, a forearm about 8 x 7 cm below
the elbow.

Station arguments (anat.S): position, half-width across the band,
half-thickness outwards (t) and inwards (ti), the outward direction, then
tend (0 muscle .. 1 tendon) and the bend weights h (humerus) and f
(forearm), which carry on from station to station until changed.

Per muscle:
  heads   one list of stations per head (a Sweep), or a dict of Pillow
          arguments for a flat head filling a fossa (blade_pillow)
  blend   smooth-union width between heads
  groups  regions whose muscles pack into one filled hull (soft.py)
  morph   "contract" (shortens and swells) or "stretch" (drawn out)
  carve   a bone ("humerus") carved out of it: a muscle wrapping the
          shaft runs its path down the shaft's centre (anat.hum_c)
  hand    ends in the hand, so it follows the finger segments too
"""

import numpy as np

from anat import BN, BNi, CORACOID_TIP, INFRAGLENOID, LAT_EPI, MED_EPI, OLECRANON, RADIAL_TUB, S3, SUPRAGLENOID, F, S, add, hum, hum_c, rad, radial, uln

SH, ARM, FA = ("shoulder",), ("arm",), ("forearm",)


def shoulder(M):
    M["deltoid"] = dict(
        heads=[
            # acromial (middle) fibres: multipennate, the roundest part
            [
                S((-0.05, 0.37, -0.21), 0.132, 0.03, out=(0, 1, -0.4), tend=0.6, h=0),
                S((-0.04, 0.23, -0.42), 0.22, 0.11, ti="bone", out=(0, 0.4, -1), tend=0, h=0.3),
                S((-0.03, -0.15, -0.47), 0.231, 0.12, ti="bone", out=(0, 0, -1), h=0.9),
                S((-0.01, -0.62, -0.39), 0.165, 0.1, ti="bone", h=1),
                S((0.0, -1.0, -0.27), 0.083, 0.055, ti="bone"),
                S(hum(-1.27, 285, 0.005), 0.04, 0.016, tend=0.4),
            ],
            # clavicular (anterior) fibres
            [
                S((0.15, 0.41, 0.13), 0.176, 0.03, out=(0.4, 1, 0), tend=0.5, h=0),
                S((0.33, 0.2, 0.0), 0.22, 0.1, ti="bone", out=(1, 0.4, -0.2), tend=0, h=0.3),
                S((0.39, -0.2, -0.15), 0.209, 0.11, ti="bone", out=(1, 0, -0.5), h=0.9),
                S((0.25, -0.7, -0.25), 0.132, 0.08, ti="bone", h=1),
                S((0.06, -1.15, -0.21), 0.05, 0.03),
                S(hum(-1.27, 292, 0.005), 0.034, 0.014, tend=0.4),
            ],
            # spinal (posterior) fibres
            [
                S((-0.38, 0.3, 0.12), 0.176, 0.03, out=(-1, 0.6, 0.1), tend=0.5, h=0),
                S((-0.43, 0.06, -0.12), 0.22, 0.09, ti="bone", out=(-1, 0.1, -0.4), tend=0, h=0.3),
                S((-0.35, -0.36, -0.29), 0.187, 0.1, ti="bone", out=(-0.6, 0, -1), h=0.9),
                S((-0.17, -0.85, -0.27), 0.11, 0.07, ti="bone", h=1),
                S((-0.04, -1.2, -0.21), 0.044, 0.025),
                S(hum(-1.27, 278, 0.005), 0.034, 0.014, tend=0.4),
            ],
        ],
        blend=0.14,
        groups=SH + ARM,
        voxel=0.009,
        tris=15000,
        shade=0.45,
    )
    # The rotator cuff and teres muscles fill the fossae of the scapula
    # (Gray's Figs. 409-412): each rises from its fossa as a dome whose
    # margin sinks into the bone (a Pillow), and converges as a thick belly
    # onto its tendon (a Sweep).
    M["supraspinatus"] = dict(
        heads=[
            blade_pillow(SUPRA_FOSSA, T=(0.06, 0.1), toward=(0.2, 0.16)),
            [
                S(S3(0.42, 0.13, 0.07), 0.075, 0.05, ti=0.05, out=BN, h=0),
                S(S3(0.28, 0.17, 0.07), 0.08, 0.055, ti="bone"),
                S((-0.1, 0.3, -0.02), 0.075, 0.04, out=(0, 1, -0.3), h=0.5, tend=0.2),
                S((0.02, 0.2, -0.2), 0.063, 0.02, out=(0, 1, -1), tend=0.9, h=1),
            ],
        ],
        blend=0.07,
        groups=SH,
        voxel=0.009,
        tris=3500,
        shade=0.6,
    )
    M["infraspinatus"] = dict(
        heads=[
            blade_pillow(INFRA_FOSSA, T=(0.05, 0.1), toward=(0.12, -0.02)),
            [
                S(S3(0.36, -0.2, 0.07), 0.13, 0.06, ti=0.05, out=BN, h=0),
                S(S3(0.16, -0.09, 0.07), 0.1, 0.055, ti="bone"),
                S((-0.25, -0.02, -0.18), 0.085, 0.045, out=(-1, 0, -0.5), h=0.4, tend=0.3),
                S((-0.12, 0.08, -0.27), 0.058, 0.02, out=(-0.5, 0.3, -1), tend=0.9, h=1),
            ],
        ],
        blend=0.07,
        groups=SH,
        voxel=0.009,
        tris=5000,
        shade=0.55,
    )
    M["teres_minor"] = dict(
        heads=[
            blade_pillow(TERES_MINOR_AREA, T=(0.04, 0.06), R=0.05, n0=0.025, toward=(0.05, -0.2)),
            [
                S(S3(0.24, -0.45, 0.05), 0.08, 0.045, out=BN, h=0),
                S(S3(0.1, -0.27, 0.06), 0.085, 0.05),
                S((-0.26, -0.15, -0.12), 0.07, 0.045, out=(-1, 0, -0.3), h=0.4),
                S((-0.13, -0.06, -0.25), 0.039, 0.02, out=(-0.5, 0, -1), tend=0.9, h=1),
            ],
        ],
        blend=0.06,
        groups=SH,
        voxel=0.009,
        tris=2200,
        shade=0.5,
    )
    M["teres_major"] = dict(
        heads=[
            blade_pillow(TERES_MAJOR_AREA, T=(0.05, 0.08), R=0.05, n0=0.015, toward=(0.2, -0.85)),
            [
                S(S3(0.45, -1.06, 0.05), 0.13, 0.075, out=BN, h=0),
                S(S3(0.28, -0.9, 0.05), 0.14, 0.08),
                S((-0.1, -0.62, 0.26), 0.11, 0.065, out=(-0.2, 0, 1), h=0.5),
                S((0.08, -0.56, 0.1), 0.055, 0.02, out=(0, 0, 1), tend=0.8, h=1),
            ],
        ],
        blend=0.06,
        groups=SH,
        voxel=0.009,
        tris=2800,
        shade=0.5,
    )
    M["subscapularis"] = dict(
        heads=[
            blade_pillow(SUBSCAP_FOSSA, T=(0.06, 0.13), R=0.1, side=-1.0, toward=(0.1, -0.1)),
            [
                S(S3(0.36, -0.36, -0.1), 0.19, 0.07, ti=0.05, out=BNi, h=0),
                S(S3(0.12, -0.15, -0.09), 0.16, 0.06, ti="bone"),
                S((0.18, -0.08, 0.14), 0.11, 0.035, out=(1, 0, 0.6), h=0.5, tend=0.4),
                S(hum(-0.1, 45, 0.005), 0.047, 0.02, tend=0.9, h=1),
            ],
        ],
        blend=0.07,
        groups=SH,
        voxel=0.009,
        tris=5000,
        shade=0.5,
    )


# Areas of origin on the scapula, (u, v) in its plane (skeleton.BLADE):
# inset a little from the borders and from the spine's root.
SUPRA_FOSSA = [(0.93, -0.09), (0.6, 0.025), (0.32, 0.13), (0.3, 0.155), (0.4, 0.165), (0.5, 0.15), (0.59, 0.15), (0.68, 0.165), (0.78, 0.255), (0.87, 0.27), (0.94, 0.1)]
INFRA_FOSSA = [(0.93, -0.16), (0.6, -0.035), (0.33, 0.075), (0.22, 0.02), (0.22, -0.15), (0.27, -0.33), (0.34, -0.58), (0.4, -0.8), (0.5, -0.93), (0.72, -1.0), (0.87, -0.87), (0.93, -0.55)]
TERES_MINOR_AREA = [(0.12, -0.2), (0.21, -0.2), (0.27, -0.36), (0.33, -0.58), (0.38, -0.8), (0.35, -0.88), (0.29, -0.85), (0.25, -0.62), (0.18, -0.4), (0.11, -0.28)]
TERES_MAJOR_AREA = [(0.3, -0.93), (0.45, -0.95), (0.62, -1.03), (0.7, -1.12), (0.6, -1.2), (0.5, -1.21), (0.4, -1.14), (0.31, -1.03)]
SUBSCAP_FOSSA = [(0.95, 0.1), (0.97, -0.3), (0.94, -0.75), (0.85, -0.99), (0.66, -1.15), (0.5, -1.17), (0.37, -1.05), (0.29, -0.8), (0.25, -0.5), (0.13, -0.25), (0.07, -0.05), (0.12, 0.1), (0.4, 0.15), (0.75, 0.19)]


def blade_pillow(outline, T, R=0.08, n0=0.011, side=1.0, toward=(0.0, 0.0)):
    """A Pillow head on the scapula's dorsal (side=1) or costal (-1) face;
    fixed to the scapula (no bend)."""
    import skeleton

    return dict(o=tuple(skeleton.BLADE_O), U=tuple(skeleton.BLADE_U), V=tuple(skeleton.BLADE_V), outline=outline, T=T, R=R, n0=n0, side=side, toward=toward, h=0.0, f=0.0)


def arm(M):
    M["biceps"] = dict(
        heads=[
            # long head's tendon: from the supraglenoid tubercle over the
            # humeral head and down the bicipital groove into its belly
            [
                S(SUPRAGLENOID, 0.019, 0.012, out=(0, 1, 0), tend=1, h=0),
                S((-0.06, 0.25, 0.08), 0.019, 0.012, h=0.3),
                S((0.1, 0.23, -0.05), 0.019, 0.012, out=(1, 1, -0.3), h=0.9),
                S(hum(0.02, 5, 0.005), 0.019, 0.012, out=(1, 0, 0), h=1),
                S(hum(-0.35, 4, 0.012), 0.022, 0.014),
                S((0.18, -0.8, -0.12), 0.024, 0.016, tend=0.8),
            ],
            # long head's belly, laterally
            [
                S((0.17, -0.62, -0.12), 0.03, 0.025, out=(1, 0, 0), tend=0.7, h=1),
                S((0.22, -0.95, -0.14), 0.1, 0.085, ti=0.08, tend=0),
                S((0.29, -1.45, -0.14), 0.155, 0.125, ti=0.11),
                S((0.33, -1.95, -0.09), 0.14, 0.12, ti=0.1),
                S((0.3, -2.35, -0.05), 0.076, 0.065, tend=0.2),
                S((0.27, -2.5, -0.045), 0.043, 0.035, tend=0.8),
            ],
            # short head: from the tip of the coracoid (with coracobrachialis)
            [
                S(CORACOID_TIP, 0.027, 0.018, out=(1, 0, 0.3), tend=1, h=0),
                S((0.33, -0.2, 0.14), 0.043, 0.03, tend=0.7, h=0.6),
                S((0.3, -0.6, 0.09), 0.092, 0.07, tend=0.1, h=1),
                S((0.27, -1.1, 0.04), 0.14, 0.12, ti=0.1, tend=0),
                S((0.31, -1.6, 0.0), 0.151, 0.125, ti=0.11),
                S((0.34, -2.05, -0.04), 0.13, 0.12, ti=0.1),
                S((0.3, -2.35, -0.05), 0.076, 0.065, tend=0.2),
                S((0.27, -2.5, -0.045), 0.043, 0.035, tend=0.8),
            ],
        ],
        blend=0.1,
        groups=ARM,
        voxel=0.008,
        tris=13000,
        shade=0.5,
        morph="contract",
    )
    M["biceps_tendon"] = dict(
        # the distal tendon, into the cubital fossa to the radial tuberosity
        heads=[
            [
                S((0.28, -2.42, -0.045), 0.035, 0.028, out=(1, 0, 0), tend=1, f=0),
                S((0.25, -2.72, -0.05), 0.03, 0.022, f=0.25),
                S(F(0.2, -0.12, -0.06), 0.028, 0.02, f=0.8),
                S(F(0.14, -0.3, -0.07), 0.026, 0.018, f=1),
                S(add(RADIAL_TUB, (0.01, 0, 0)), 0.024, 0.016),
            ],
        ],
        tissue="tendon",
        voxel=0.005,
        tris=2000,
        shade=0.5,
    )
    M["bicipital_aponeurosis"] = dict(
        # the sheet fanning from the tendon over the flexors' origin into
        # the deep fascia: a film on those muscles, so it is painted onto
        # them (paint=) rather than built. Thick here only so that it
        # reaches their surfaces.
        heads=[
            [
                S((0.3, -2.66, -0.02), 0.03, 0.04, out=(1, 0, 0.2), tend=1, f=0.1),
                S(F(0.3, -0.12, 0.1), 0.065, 0.05, out=(1, 0, 0.5), f=0.7),
                S(F(0.26, -0.33, 0.24), 0.08, 0.05, out=(0.6, 0, 1), f=1),
            ],
        ],
        tissue="tendon",
        paint_only=True,
    )
    M["brachialis"] = dict(
        # wraps the front half of the lower humerus (its path runs down the
        # shaft's centre and the bone is carved out of it), from the deltoid
        # insertion to the coronoid process
        heads=[
            [
                S(hum(-1.1, 300, 0.01), 0.06, 0.02, ti="bone", out=radial(300)),
                S(hum_c(-1.4, 0.03, 0.0), 0.15, 0.17, ti=0.06, out=(1, 0, 0)),
                S(hum_c(-1.8, 0.0, 0.01), 0.21, 0.225, ti=0.08),
                S(hum_c(-2.15, 0.0, 0.02), 0.235, 0.235, ti=0.07),
                S(hum_c(-2.45, 0.03, 0.03), 0.21, 0.215, ti=0.03, f=0.05),
                S((0.14, -2.75, 0.04), 0.16, 0.12, ti=0.06, f=0.2),
                S(F(0.19, -0.1, 0.08), 0.099, 0.06, ti="bone", f=0.6, tend=0.2),
                S(F(0.12, -0.26, 0.11), 0.05, 0.025, f=1, tend=0.9),
            ]
        ],
        carve="humerus",
        groups=ARM,
        voxel=0.009,
        tris=6000,
        shade=0.4,
        morph="contract",
    )
    M["coracobrachialis"] = dict(
        heads=[
            [
                S(add(CORACOID_TIP, (-0.01, -0.03, 0.0)), 0.029, 0.02, out=(0.4, 0, 1), tend=1, h=0),
                S((0.27, -0.25, 0.18), 0.069, 0.05, tend=0.3, h=0.7),
                S((0.2, -0.6, 0.15), 0.12, 0.085, ti="bone", tend=0, h=1),
                S((0.12, -1.0, 0.09), 0.1, 0.07, ti="bone"),
                S(hum(-1.35, 80, 0.012), 0.04, 0.018, tend=0.8),
            ]
        ],
        carve="humerus",
        groups=ARM,
        voxel=0.009,
        tris=2500,
        shade=0.55,
    )
    M["triceps"] = dict(
        heads=[
            # long head, from the infraglenoid tubercle, posteromedial
            [
                S(INFRAGLENOID, 0.052, 0.03, out=(-1, 0, 0.3), tend=0.9, h=0),
                S((-0.2, -0.45, 0.2), 0.092, 0.07, tend=0.2, h=0.8),
                S((-0.3, -0.9, 0.13), 0.17, 0.12, ti="bone", tend=0, h=1),
                S((-0.35, -1.4, 0.11), 0.196, 0.14, ti="bone"),
                S((-0.32, -1.9, 0.09), 0.172, 0.11, ti="bone"),
                S((-0.26, -2.4, 0.06), 0.115, 0.065, tend=0.3),
            ],
            # lateral head, from the back of the shaft above the radial groove
            [
                S(hum(-0.35, 235, 0.01), 0.081, 0.035, out=radial(235), tend=0.4),
                S((-0.22, -0.8, -0.18), 0.15, 0.1, ti="bone", out=(-0.6, 0, -1), tend=0),
                S((-0.31, -1.3, -0.16), 0.19, 0.12, ti="bone"),
                S((-0.33, -1.8, -0.13), 0.161, 0.1, ti="bone"),
                S((-0.28, -2.35, -0.03), 0.127, 0.065, tend=0.3),
            ],
            # medial head, deep and low, wrapping the back half of the shaft
            # (carved to it) and showing either side of the tendon
            [
                S(hum(-0.7, 125, 0.01), 0.07, 0.03, out=radial(125)),
                S(hum(-1.1, 120, 0.01), 0.13, 0.05, ti="bone", out=radial(130)),
                S(hum_c(-1.6, -0.02, 0.03), 0.17, 0.2, ti=0.06, out=(-1, 0, 0)),
                S(hum_c(-2.0, 0.0, 0.03), 0.23, 0.225, ti=0.08),
                S(hum_c(-2.35, 0.0, 0.04), 0.26, 0.22, ti=0.06),
                S((-0.14, -2.68, 0.07), 0.19, 0.14, ti=0.05, tend=0.3),
            ],
        ],
        blend=0.08,
        carve="humerus",
        groups=ARM,
        voxel=0.009,
        tris=15000,
        shade=0.5,
        morph="stretch",
        paint=("triceps_aponeurosis",),
    )
    M["triceps_aponeurosis"] = dict(
        # the common tendon's broad sheet over the back of the lower half,
        # painted onto the belly; only its straight part, since near the
        # tendon's hook round the olecranon the nearest point on its path
        # flips from one side of the hook to the other and the paint speckles
        heads=[
            [
                S((-0.41, -1.7, 0.05), 0.06, 0.008, out=(-1, 0, 0), tend=1, f=0),
                S((-0.405, -2.0, 0.05), 0.12, 0.01),
                S((-0.345, -2.4, 0.07), 0.12, 0.016),
                S((-0.29, -2.62, 0.085), 0.095, 0.02),
            ]
        ],
        tissue="tendon",
        paint_only=True,
    )
    M["triceps_tendon"] = dict(
        # the common tendon from the lower end of the belly onto the
        # olecranon. Its broad sheet over the belly above is painted onto the
        # triceps (triceps_aponeurosis), so it stretches with the belly
        # instead of standing off it when the elbow bends.
        heads=[
            [
                # close behind the bone, so the part that turns with the
                # forearm wraps the point of the elbow instead of swinging
                # out in a wide loop round the elbow's axis
                S((-0.3, -2.45, 0.08), 0.085, 0.02, ti=0.04, out=(-1, 0, 0), tend=1, f=0),
                S((-0.255, -2.62, 0.09), 0.09, 0.022, ti=0.03, f=0),
                S((-0.24, -2.76, 0.1), 0.088, 0.022, ti=0.02, f=0.15),
                S((-0.225, -2.83, 0.11), 0.08, 0.022, f=0.6),
                S(add(OLECRANON, (-0.005, 0.0, 0.0)), 0.075, 0.025, out=(-1, 0.4, 0), f=1),
                S(add(OLECRANON, (0.02, 0.06, 0.0)), 0.05, 0.02, out=(-0.4, 1, 0), f=1),
            ]
        ],
        tissue="tendon",
        voxel=0.006,
        tris=2500,
        shade=0.5,
    )


def forearm(M):
    # ── lateral (radial) group ──
    M["brachioradialis"] = dict(
        heads=[
            [
                S(hum(-2.1, 272, 0.01), 0.057, 0.02, out=radial(272), tend=0.3),
                S((0.02, -2.5, -0.34), 0.115, 0.08, ti="bone", out=(0.2, 0, -1), tend=0),
                S((0.1, -2.95, -0.35), 0.149, 0.1, ti="bone", out=(0.4, 0, -1), f=0.3),
                S(F(0.14, -0.45, -0.32), 0.138, 0.09, ti="bone", f=1),
                S(F(0.1, -1.0, -0.28), 0.092, 0.06),
                S(F(0.07, -1.35, -0.26), 0.04, 0.02, tend=0.8),
                S(F(0.04, -1.9, -0.25), 0.028, 0.012, tend=1),
                S(rad(-2.12, 265, 0.01), 0.023, 0.01),
            ]
        ],
        groups=ARM + FA,
        voxel=0.009,
        tris=4500,
        shade=0.45,
        morph="contract",
    )
    M["ecrl"] = dict(
        heads=[
            [
                S(hum(-2.5, 268, 0.01), 0.046, 0.02, out=radial(268), tend=0.3),
                S((-0.03, -2.85, -0.34), 0.086, 0.065, out=(-0.2, 0, -1), tend=0, f=0.2),
                S(F(-0.03, -0.45, -0.31), 0.098, 0.07, f=1),
                S(F(-0.04, -0.9, -0.27), 0.069, 0.045),
                S(F(-0.05, -1.15, -0.25), 0.034, 0.016, tend=0.9),
                S(F(-0.07, -1.9, -0.19), 0.023, 0.01, tend=1),
                S(F(-0.08, -2.3, -0.16), 0.023, 0.01),
                S(F(-0.05, -2.62, -0.13), 0.021, 0.01),
            ]
        ],
        groups=ARM + FA,
        voxel=0.009,
        tris=3000,
        shade=0.55,
        hand=True,
    )
    M["ecrb"] = dict(
        heads=[
            [
                S(add(LAT_EPI, (-0.02, 0.0, -0.02)), 0.048, 0.02, out=(-0.3, 0, -1), tend=0.5),
                S(F(-0.11, -0.35, -0.27), 0.096, 0.065, tend=0, f=1),
                S(F(-0.11, -0.9, -0.22), 0.078, 0.05),
                S(F(-0.1, -1.25, -0.2), 0.036, 0.015, tend=0.9),
                S(F(-0.1, -1.95, -0.14), 0.024, 0.01, tend=1),
                S(F(-0.1, -2.35, -0.07), 0.024, 0.01),
                S(F(-0.06, -2.62, -0.02), 0.022, 0.01),
            ]
        ],
        groups=FA,
        voxel=0.009,
        tris=2800,
        shade=0.5,
        hand=True,
    )
    M["anconeus"] = dict(
        heads=[
            [
                S(add(LAT_EPI, (-0.05, 0.0, 0.02)), 0.039, 0.02, out=(-1, 0, -0.5), tend=0.3, f=0),
                S(F(-0.19, -0.12, -0.08), 0.088, 0.04, tend=0, f=0.6),
                S(uln(-0.35, 200, 0.01), 0.066, 0.02, f=1),
            ]
        ],
        groups=FA,
        voxel=0.008,
        tris=1500,
        shade=0.55,
    )

    # ── posterior (extensor) group ──
    M["extensor_digitorum"] = dict(
        heads=[
            [
                S(add(LAT_EPI, (-0.05, -0.03, 0.0)), 0.048, 0.02, out=(-1, 0, -0.6), tend=0.5),
                S(F(-0.21, -0.4, -0.16), 0.114, 0.075, ti="bone", out=(-1, 0, -0.3), tend=0, f=1),
                S(F(-0.22, -0.95, -0.1), 0.102, 0.065, ti="bone"),
                S(F(-0.19, -1.45, -0.06), 0.072, 0.04, tend=0.3),
                S(F(-0.14, -1.8, -0.04), 0.06, 0.012, tend=1),
                S(F(-0.12, -2.25, -0.02), 0.072, 0.01),
            ]
        ],
        groups=FA,
        voxel=0.009,
        tris=3000,
        shade=0.55,
    )
    M["edm"] = dict(
        heads=[
            [
                S(add(LAT_EPI, (-0.06, -0.05, 0.04)), 0.036, 0.018, out=(-1, 0, 0), tend=0.5),
                S(F(-0.23, -0.5, -0.02), 0.054, 0.045, tend=0, f=1),
                S(F(-0.22, -1.1, 0.04), 0.048, 0.035),
                S(F(-0.17, -1.55, 0.08), 0.024, 0.012, tend=1),
                S(F(-0.13, -2.2, 0.12), 0.018, 0.009),
            ]
        ],
        groups=FA,
        voxel=0.008,
        tris=1500,
        shade=0.6,
    )
    M["ecu"] = dict(
        heads=[
            [
                S(add(LAT_EPI, (-0.07, -0.06, 0.07)), 0.042, 0.02, out=(-1, 0, 0.3), tend=0.5),
                S(F(-0.2, -0.55, 0.11), 0.078, 0.055, out=(-1, 0, 0.5), tend=0, f=1),
                S(F(-0.17, -1.2, 0.2), 0.066, 0.045),
                S(F(-0.12, -1.65, 0.22), 0.036, 0.02, tend=0.9),
                S(F(-0.08, -2.1, 0.24), 0.024, 0.012, tend=1),
                S(F(-0.03, -2.45, 0.22), 0.022, 0.01),
                S(F(-0.02, -2.6, 0.2), 0.019, 0.01),
            ]
        ],
        groups=FA,
        voxel=0.008,
        tris=2500,
        shade=0.5,
        hand=True,
    )
    # the thumb's outcropping muscles, spiralling round the radius
    M["apl_epb"] = dict(
        heads=[
            [
                S(uln(-1.0, 215, 0.01), 0.05, 0.02, out=(-1, 0, -0.2), f=1),
                S(F(-0.17, -1.35, -0.15), 0.072, 0.045, out=(-1, 0, -1)),
                S(F(-0.06, -1.7, -0.27), 0.061, 0.04, out=(0, 0, -1), tend=0.2),
                S(F(0.02, -1.95, -0.29), 0.033, 0.018, tend=1),
                S(F(0.07, -2.25, -0.3), 0.028, 0.012),
                S(F(0.11, -2.52, -0.29), 0.024, 0.01),
            ]
        ],
        groups=FA,
        voxel=0.008,
        tris=2000,
        shade=0.6,
        hand=True,
    )
    M["epl"] = dict(
        heads=[
            [
                S(uln(-1.15, 225, 0.005), 0.035, 0.02, out=(-1, 0, 0), f=1),
                S(F(-0.17, -1.55, -0.02), 0.04, 0.035),
                S(F(-0.15, -1.85, -0.07), 0.018, 0.012, tend=1),
                S(F(-0.14, -2.1, -0.12), 0.015, 0.01),
                S(F(-0.07, -2.45, -0.24), 0.015, 0.01),
                S(F(0.05, -2.62, -0.3), 0.014, 0.009),
            ]
        ],
        groups=FA,
        voxel=0.007,
        tris=1500,
        shade=0.6,
        hand=True,
    )

    # ── anterior (flexor-pronator) group ──
    M["pronator_teres"] = dict(
        heads=[
            [
                S(add(MED_EPI, (0.04, 0.05, -0.02)), 0.052, 0.025, out=(1, 0, 0.5), tend=0.3),
                S(F(0.16, -0.2, 0.2), 0.092, 0.06, ti=0.045, tend=0, f=0.7),
                S(F(0.2, -0.5, 0.02), 0.086, 0.06, ti=0.045, out=(1, 0, 0), f=1),
                S(F(0.14, -0.8, -0.15), 0.063, 0.04, out=(0.6, 0, -1)),
                S(rad(-1.02, 280, 0.005), 0.04, 0.012, tend=0.8),
            ]
        ],
        groups=FA,
        paint=("bicipital_aponeurosis",),
        voxel=0.008,
        tris=2500,
        shade=0.45,
    )
    M["fcr"] = dict(
        heads=[
            [
                S(add(MED_EPI, (0.05, 0.0, -0.03)), 0.04, 0.02, out=(1, 0, 0.3), tend=0.4),
                S(F(0.21, -0.4, 0.14), 0.081, 0.055, tend=0, f=1),
                S(F(0.22, -0.9, 0.06), 0.069, 0.045),
                S(F(0.19, -1.25, 0.02), 0.034, 0.02, tend=0.9),
                S(F(0.15, -1.8, -0.05), 0.021, 0.012, tend=1),
                S(F(0.12, -2.3, -0.11), 0.02, 0.011),
                S(F(0.08, -2.6, -0.12), 0.017, 0.01),
            ]
        ],
        groups=FA,
        paint=("bicipital_aponeurosis",),
        voxel=0.008,
        tris=2200,
        shade=0.55,
        hand=True,
    )
    M["palmaris_longus"] = dict(
        heads=[
            [
                S(add(MED_EPI, (0.05, -0.04, 0.0)), 0.025, 0.016, out=(1, 0, 0.4), tend=0.4),
                S(F(0.25, -0.45, 0.19), 0.045, 0.032, tend=0, f=1),
                S(F(0.26, -0.85, 0.15), 0.03, 0.02, tend=0.6),
                S(F(0.25, -1.2, 0.12), 0.012, 0.007, tend=1),
                S(F(0.21, -2.1, 0.02), 0.012, 0.006),
                S(F(0.19, -2.4, 0.0), 0.05, 0.004),
            ]
        ],
        groups=FA,
        paint=("bicipital_aponeurosis",),
        voxel=0.006,
        tris=1500,
        shade=0.6,
        hand=True,
    )
    M["fcu"] = dict(
        heads=[
            [
                S(add(MED_EPI, (-0.01, -0.02, 0.03)), 0.048, 0.025, out=(0, 0, 1), tend=0.3),
                S(F(0.03, -0.35, 0.31), 0.102, 0.065, ti="bone", tend=0, f=1),
                S(F(0.04, -0.95, 0.29), 0.09, 0.055, ti="bone"),
                S(F(0.06, -1.5, 0.25), 0.06, 0.04, tend=0.4),
                S(F(0.08, -1.95, 0.2), 0.034, 0.018, tend=1),
                S(F(0.085, -2.3, 0.15), 0.026, 0.016),
            ]
        ],
        groups=FA,
        voxel=0.008,
        tris=2800,
        shade=0.5,
    )
    M["fds"] = dict(
        heads=[
            [
                S(add(MED_EPI, (0.04, -0.07, -0.06)), 0.046, 0.025, out=(1, 0, 0.2), tend=0.3),
                S(F(0.14, -0.55, 0.1), 0.127, 0.07, ti=0.05, tend=0, f=1),
                S(F(0.16, -1.1, 0.07), 0.138, 0.065, ti=0.05),
                S(F(0.15, -1.6, 0.05), 0.115, 0.045, ti=0.035, tend=0.2),
                S(F(0.13, -1.95, 0.04), 0.081, 0.02, tend=0.9),
            ]
        ],
        groups=FA,
        paint=("bicipital_aponeurosis",),
        voxel=0.009,
        tris=3500,
        shade=0.45,
    )
    M["fdp"] = dict(
        heads=[
            [
                S(uln(-0.4, 60, 0.0), 0.081, 0.035, out=(1, 0, 0.8), f=1),
                S(F(0.08, -0.9, 0.17), 0.138, 0.06, ti="bone"),
                S(F(0.09, -1.5, 0.12), 0.138, 0.05, ti="bone"),
                S(F(0.08, -1.95, 0.08), 0.092, 0.02, tend=0.9),
            ]
        ],
        groups=FA,
        voxel=0.009,
        tris=2500,
        shade=0.4,
    )
    M["fpl"] = dict(
        heads=[
            [
                S(rad(-0.7, 20, 0.0), 0.061, 0.02, out=(1, 0, -0.3), f=1),
                S(F(0.09, -1.2, -0.14), 0.083, 0.04, ti="bone"),
                S(F(0.08, -1.75, -0.12), 0.055, 0.028, tend=0.4),
                S(F(0.07, -2.1, -0.1), 0.02, 0.012, tend=1),
                S(F(0.08, -2.45, -0.14), 0.017, 0.01),
            ]
        ],
        groups=FA,
        voxel=0.008,
        tris=1800,
        shade=0.4,
        hand=True,
    )
    M["pronator_quadratus"] = dict(
        # a thin square sheet across the front of the lowest quarter of both
        # bones, deep to every flexor tendon
        heads=[[S(uln(-1.95, 25, -0.01), 0.075, 0.016, out=(1, 0, 0), f=1), S(F(0.07, -1.98, 0.02), 0.08, 0.02), S(rad(-1.95, 350, -0.01), 0.075, 0.016)]],
        groups=FA,
        voxel=0.007,
        tris=1200,
        shade=0.4,
    )
    M["supinator"] = dict(
        heads=[
            [
                S(add(LAT_EPI, (0.0, -0.1, 0.05)), 0.05, 0.02, out=(-0.5, 0, -1), f=0.3),
                S(F(-0.02, -0.35, -0.17), 0.099, 0.035, f=1),
                S(F(0.06, -0.55, -0.18), 0.088, 0.03, out=(0.5, 0, -1)),
                S(rad(-0.7, 330, 0.0), 0.055, 0.015),
            ]
        ],
        groups=FA,
        voxel=0.008,
        tris=1500,
        shade=0.4,
    )


def _rp(ray, k, frac, palmar=0.0, side=0.0):
    import hand as H_

    return F(*H_.ray_point(ray, k, frac, palmar, side))


def hand(M):
    """The tendons in the hand and the hand's own muscles."""
    fingers = ["index", "middle", "ring", "little"]
    flex, ext = [], []
    for i, ray in enumerate(fingers):
        zt = -0.07 + 0.05 * i
        # flexor tendons (superficialis over profundus) through the carpal
        # tunnel, over the palm and along the front of the finger
        flex.append(
            [
                S(F(0.11, -2.26, zt), 0.022, 0.014, out=(1, 0, 0), tend=1, f=1),
                S(_rp(ray, 0, 0.35, 0.07), 0.024, 0.014),
                S(_rp(ray, 0, 0.95, 0.075), 0.024, 0.015),
                S(_rp(ray, 1, 0.5, 0.047), 0.022, 0.013),
                S(_rp(ray, 2, 0.5, 0.037), 0.018, 0.011),
                S(_rp(ray, 3, 0.25, 0.028), 0.014, 0.009),
                S(_rp(ray, 3, 0.55, 0.024), 0.011, 0.007),
            ]
        )
        # extensor tendons, widening into the hood over the knuckle and P1
        ext.append(
            [
                S(F(-0.14, -2.22, -0.05 + 0.035 * i), 0.016, 0.008, out=(-1, 0, 0), tend=1, f=1),
                S(_rp(ray, 0, 0.45, -0.058), 0.017, 0.008),
                S(_rp(ray, 0, 1.0, -0.068), 0.026, 0.009),
                S(_rp(ray, 1, 0.45, -0.046), 0.036, 0.008),
                S(_rp(ray, 2, 0.5, -0.036), 0.026, 0.007),
                S(_rp(ray, 3, 0.3, -0.027), 0.016, 0.006),
            ]
        )
    # the thumb: flexor pollicis longus in front, extensor longus behind
    flex.append(
        [
            S(F(0.09, -2.42, -0.15), 0.016, 0.01, out=(1, 0, 0), tend=1, f=1),
            S(_rp("thumb", 0, 0.5, 0.06), 0.017, 0.011),
            S(_rp("thumb", 1, 0.5, 0.042), 0.016, 0.01),
            S(_rp("thumb", 2, 0.4, 0.03), 0.013, 0.008),
        ]
    )
    ext.append(
        [
            S(F(0.05, -2.62, -0.3), 0.014, 0.008, out=(-0.3, 0, -1), tend=1, f=1),
            S(_rp("thumb", 0, 0.6, -0.052), 0.015, 0.008),
            S(_rp("thumb", 1, 0.5, -0.042), 0.022, 0.007),
            S(_rp("thumb", 2, 0.35, -0.03), 0.015, 0.006),
        ]
    )
    M["hand_tendons"] = dict(heads=flex + ext, tissue="tendon", voxel=0.0042, tris=12000, shade=0.5, hand=True)
    M["retinacula"] = dict(
        heads=[
            # flexor retinaculum, roofing the carpal tunnel
            [
                S(F(0.1, -2.36, -0.21), 0.07, 0.012, out=(1, 0, -0.5), tend=1, f=1),
                S(F(0.145, -2.37, -0.05), 0.075, 0.012, out=(1, 0, 0)),
                S(F(0.14, -2.37, 0.08), 0.075, 0.012),
                S(F(0.1, -2.36, 0.17), 0.07, 0.012, out=(1, 0, 0.6)),
            ],
            # extensor retinaculum across the back of the wrist
            [
                S(F(-0.02, -2.12, -0.27), 0.06, 0.01, out=(0, 0, -1), tend=1, f=1),
                S(F(-0.13, -2.14, -0.14), 0.065, 0.01, out=(-1, 0, -0.4)),
                S(F(-0.15, -2.15, 0.02), 0.065, 0.01, out=(-1, 0, 0)),
                S(F(-0.1, -2.14, 0.2), 0.06, 0.01, out=(-1, 0, 0.7)),
            ],
        ],
        tissue="tendon",
        voxel=0.005,
        tris=2000,
        shade=0.5,
        hand=True,
    )
    M["thenar"] = dict(
        heads=[
            [
                S(F(0.12, -2.4, -0.13), 0.045, 0.035, out=(1, 0, -0.3), f=1),
                S(_rp("thumb", 0, 0.3, 0.055, 0.02), 0.075, 0.065, ti=0.03),
                S(_rp("thumb", 0, 0.7, 0.05, 0.015), 0.06, 0.05, ti=0.025),
                S(_rp("thumb", 1, 0.05, 0.035), 0.03, 0.02, tend=0.7),
            ]
        ],
        groups=("hand",),
        voxel=0.007,
        tris=2500,
        shade=0.5,
        hand=True,
    )
    M["adductor_pollicis"] = dict(
        heads=[
            [
                S(_rp("middle", 0, 0.45, 0.05), 0.08, 0.02, out=(1, 0, 0), f=1),
                S(_rp("index", 0, 0.45, 0.07, -0.06), 0.06, 0.025),
                S(_rp("thumb", 1, 0.0, 0.03, 0.035), 0.03, 0.015, tend=0.6),
            ]
        ],
        groups=("hand",),
        voxel=0.007,
        tris=1500,
        shade=0.45,
        hand=True,
    )
    M["hypothenar"] = dict(
        heads=[
            [
                S(F(0.09, -2.42, 0.15), 0.04, 0.03, out=(1, 0, 0.6), f=1),
                S(_rp("little", 0, 0.35, 0.04, 0.035), 0.06, 0.05, ti=0.03),
                S(_rp("little", 0, 0.8, 0.035, 0.035), 0.05, 0.04, ti=0.025),
                S(_rp("little", 1, 0.05, 0.02, 0.035), 0.025, 0.018, tend=0.7),
            ]
        ],
        groups=("hand",),
        voxel=0.007,
        tris=2000,
        shade=0.5,
        hand=True,
    )
    inter = []
    # first dorsal interosseous, filling the web between thumb and index
    inter.append(
        [
            S(_rp("thumb", 0, 0.35, -0.01, 0.045), 0.045, 0.035, out=(-0.5, 0, -1), f=1),
            S(_rp("index", 0, 0.45, -0.005, -0.075), 0.05, 0.045),
            S(_rp("index", 0, 0.95, 0.0, -0.05), 0.025, 0.02),
            S(_rp("index", 1, 0.05, 0.0, -0.045), 0.015, 0.012, tend=0.7),
        ]
    )
    for a, b in (("index", "middle"), ("middle", "ring"), ("ring", "little")):
        pa0 = np.array(_rp(a, 0, 0.3, -0.02))
        pb0 = np.array(_rp(b, 0, 0.3, -0.02))
        pa1 = np.array(_rp(a, 0, 0.85, -0.02))
        pb1 = np.array(_rp(b, 0, 0.85, -0.02))
        inter.append(
            [
                S((pa0 + pb0) / 2, 0.028, 0.025, out=(-1, 0, 0), f=1),
                S((pa1 + pb1) / 2, 0.025, 0.022),
                S(np.array(_rp(b, 1, 0.05, -0.01)) * 0.5 + np.array(_rp(a, 1, 0.05, -0.01)) * 0.5, 0.012, 0.01, tend=0.7),
            ]
        )
    M["interossei"] = dict(heads=inter, groups=("hand",), voxel=0.006, tris=3000, shade=0.45, hand=True)


def _fill_forearm(M):
    """The forearm is crowded: pack its muscles into one another (soft.py)
    and give their bellies a little more girth than drawn, so the packing
    has overlaps to resolve rather than gaps to leave."""
    for name, spec in M.items():
        if spec.get("tissue", "muscle") != "muscle" or "forearm" not in spec.get("groups", ()):
            continue
        spec["pack"] = "forearm"
        for head in spec["heads"]:
            tend = 0.0
            for st in head:
                tend = st.get("tend", tend)
                if tend < 0.5:
                    st["w"] *= 1.25
                    st["t"] *= 1.15
                    if "ti" in st:
                        st["ti"] *= 1.1


def specs():
    M = {}
    shoulder(M)
    arm(M)
    forearm(M)
    _fill_forearm(M)
    hand(M)
    return M

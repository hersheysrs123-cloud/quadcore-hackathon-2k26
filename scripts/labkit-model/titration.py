"""The titration set: a 50 cm3 burette with its stopcock and clamp, a
magnetic stirrer and its follower, a pH meter and its electrode, and an
indicator dropper bottle. For AcidBaseCanvas.jsx; each part in its own
frame (named in each docstring), scene units (1 cm = 0.2).

The burette is a little shorter than a real one (its 0-50 graduations span
40 cm rather than 55) so the stand and flask fit one view. Its glass is a
thin lathe shell; the graduations, every 0.1 cm3 with every 1 cm3
numbered, are real geometry wrapped onto the front of the tube, with a
Schellbach stripe (white with a blue line) down the back so the meniscus
reads as it does on the bench. The liquid inside it is three.js (it falls
as the scene runs alkali out).
"""

import math

import numpy as np

from cannon import lathe
from labkit import BLACK, DARK, PANEL, STEELC, WHITE, bar, block, coloured, instrument, knob, merge, rounded_rect, ry, slab, turned, xf

cm = lambda v: v * 0.2  # noqa: E731

GLASS = np.array([0.88, 0.94, 0.97])
INK = np.array([0.08, 0.16, 0.42])  # graduation blue
PTFE = np.array([0.93, 0.94, 0.95])
NUT = np.array([0.2, 0.42, 0.8])
AMBER = np.array([0.55, 0.28, 0.07])
RUBBER = np.array([0.12, 0.12, 0.13])
CLAMP_RED = np.array([0.7, 0.13, 0.12])
ENAMEL = np.array([0.84, 0.86, 0.88])
CERAMIC = np.array([0.97, 0.97, 0.96])

# ─── The burette ────────────────────────────────────────────────────
# Origin at the end of the jet, y up. One cm3 is BU_PER_CM3 tall.

BU_OUTER = cm(0.62)
BU_BORE = cm(0.53)
BU_TIP_Y = 0.0
BU_STOPCOCK_Y = 1.3
BU_FIFTY_Y = 2.8
BU_PER_CM3 = 0.16
BU_ZERO_Y = BU_FIFTY_Y + 50 * BU_PER_CM3
BU_TOP_Y = BU_ZERO_Y + 0.8


def burette_glass():
    """The glass: the jet, the stopcock barrel (its axis along x) and the
    long graduated tube, as a shell with a fire-polished lip."""
    o, b = BU_OUTER, BU_BORE
    s = BU_STOPCOCK_Y
    outer = [
        (0.0, 0.022), (0.02, 0.034), (0.5, 0.05), (0.95, 0.06), (s - 0.16, 0.062),
        (s + 0.16, 0.062), (s + 0.45, 0.064), (2.0, 0.07), (2.25, o), (BU_TOP_Y - 0.05, o),
        (BU_TOP_Y - 0.02, o + 0.012), (BU_TOP_Y, o + 0.006),
    ]
    inner = [(BU_TOP_Y, b + 0.008), (BU_TOP_Y - 0.06, b), (2.3, b), (2.05, 0.042), (s + 0.45, 0.034), (0.95, 0.03), (0.5, 0.022), (0.02, 0.014), (0.0, 0.014)]
    prof = outer + inner
    V, F, _ = lathe(prof, "y", 40)
    tube = coloured(V, F, GLASS)
    # the barrel the key turns in: a glass sleeve along x, flared at the key's end
    barrel = turned([(-0.21, 0.0), (-0.21, 0.098), (-0.18, 0.09), (0.16, 0.085), (0.19, 0.092), (0.19, 0.0)], "x", 32, GLASS)
    return merge([tube, xf(barrel, None, (0, s, 0))])


def _arc_band(y, h, a0, a1, r, colour, n=8):
    """A thin band wrapped round the tube at height y, from angle a0 to a1
    (radians from +z toward +x), height h."""
    a = np.linspace(a0, a1, n + 1)
    V = []
    for yy in (y - h / 2, y + h / 2):
        for t in a:
            V.append((r * math.sin(t), yy, r * math.cos(t)))
    V = np.array(V)
    F = []
    for i in range(n):
        F.append([i, i + 1, n + 1 + i + 1])
        F.append([i, n + 1 + i + 1, n + 1 + i])
    return coloured(V, np.array(F), colour)


def _text(s, size):
    """A string as a flat mesh in xy (its baseline on y = 0, left at x = 0),
    from Blender's own font."""
    import bpy

    cu = bpy.data.curves.new("labkit_text", "FONT")
    cu.body = s
    cu.size = size
    cu.fill_mode = "FRONT"
    cu.resolution_u = 3
    ob = bpy.data.objects.new("labkit_text", cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = ob.evaluated_get(dg).to_mesh()
    me.calc_loop_triangles()
    V = np.array([v.co[:] for v in me.vertices])
    F = np.array([t.vertices[:] for t in me.loop_triangles])
    ob.evaluated_get(dg).to_mesh_clear()
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    return V, F


def burette_marks():
    """The graduations on the front of the tube (every 0.1 cm3; longer at
    each 0.5 and 1; every 1 numbered) and the Schellbach stripe down the
    back, a white band with a blue line, just outside the glass."""
    r = BU_OUTER + 0.0015
    parts = []
    for k in range(501):
        v = k / 10
        y = BU_ZERO_Y - v * BU_PER_CM3
        if k % 10 == 0:
            half, h = 0.62, 0.007
        elif k % 5 == 0:
            half, h = 0.4, 0.006
        else:
            half, h = 0.24, 0.005
        parts.append(_arc_band(y, h, -half, half, r, INK, 6))
    for n in range(51):
        V, F = _text(str(n), 0.055)
        if not len(V):
            continue
        y = BU_ZERO_Y - n * BU_PER_CM3
        x0 = V[:, 0].min()
        # to the right of the long tick, centred on it, wrapped round the tube
        th = 0.72 + (V[:, 0] - x0) / r
        P = np.stack([r * np.sin(th), y + V[:, 1] - 0.02, r * np.cos(th)], axis=1)
        parts.append(coloured(P, F, INK))
    # "cm3 / 20 °C / class B", up the tube above the zero mark
    for s_, yy in (("cm³", BU_ZERO_Y + 0.22), ("20 °C  B", BU_ZERO_Y + 0.1)):
        V, F = _text(s_, 0.05)
        th = -0.4 + (V[:, 0] - V[:, 0].min()) / r
        P = np.stack([r * np.sin(th), yy + V[:, 1], r * np.cos(th)], axis=1)
        parts.append(coloured(P, F, INK))
    # the stripe: white, with a blue line down its middle, at the back
    y0, y1 = BU_FIFTY_Y - 0.25, BU_ZERO_Y + 0.3
    hgt = y1 - y0
    for a0, a1, c in ((math.pi - 0.42, math.pi - 0.05, WHITE), (math.pi - 0.05, math.pi + 0.05, np.array([0.1, 0.3, 0.85])), (math.pi + 0.05, math.pi + 0.42, WHITE)):
        band = _arc_band((y0 + y1) / 2, hgt, a0, a1, r, c, 6)
        V, F, C = band
        parts.append((V, F[:, ::-1], C))
    return merge(parts)


def stopcock_key():
    """The PTFE key, in its own frame at the barrel's centre, turning about
    x: a plug through the barrel, a flat grip at -x (vertical when open,
    as here) and a blue retaining nut at +x."""
    plug = turned([(-0.25, 0.0), (-0.25, 0.07), (0.23, 0.066), (0.23, 0.0)], "x", 28, PTFE)
    neck = turned([(-0.31, 0.0), (-0.31, 0.045), (-0.25, 0.045), (-0.25, 0.0)], "x", 20, PTFE)
    grip = slab(rounded_rect(0.0, 0.0, 0.1, 0.34, 0.035), -0.36, -0.3, 0.008, PTFE, plane="zy")
    nut = xf(knob(0.07, 0.062, 8, 0.0, 0.06, NUT, 0.006), ry(math.pi / 2), (0.21, 0, 0))
    washer = turned([(0.19, 0.0), (0.19, 0.08), (0.21, 0.08), (0.21, 0.0)], "x", 24, NUT * 0.8)
    return merge([plug, neck, grip, nut, washer])


BU_CLAMP_AXIS_X = 0.3


def burette_clamp():
    """(cast body, red jaw pads): a burette clamp on the end of an arm at
    the origin (its stem over the arm along -x, like the lab kit's clamp),
    two spring-loaded V-jaws holding a burette whose axis is vertical at
    x = BU_CLAMP_AXIS_X."""
    ax = BU_CLAMP_AXIS_X
    body = [turned([(-0.16, 0.0), (-0.16, 0.05), (-0.04, 0.05), (-0.02, 0.06), (0.04, 0.06), (0.04, 0.0)], "x", 20, STEELC)]
    body.append(block((0.02, -0.07, -0.09), (0.16, 0.07, 0.09), 0.02, np.array([0.3, 0.34, 0.41]), r=0.03))
    pads = []
    for s in (-1, 1):
        # each jaw: an arm forward and round the tube, a V-pad on its inside
        arm = bar([(0.1, 0.0, s * 0.07), (0.18, 0.0, s * 0.15), (ax, 0.0, s * (BU_OUTER + 0.06)), (ax + 0.1, 0.0, s * (BU_OUTER + 0.02))], 0.022, STEELC, n=6)
        body.append(xf(arm, None, (0, 0.035, 0)))
        body.append(xf(arm, None, (0, -0.035, 0)))
        pads.append(block((ax - 0.07, -0.06, s * BU_OUTER), (ax + 0.07, 0.06, s * (BU_OUTER + 0.035)), 0.01, CLAMP_RED))
    # the spring between the jaws' tails, and a thumb lever
    coil = [(0.11 + 0.01 * k / 3, 0.03 * math.cos(k * 1.4), -0.07 + 0.14 * k / 30) for k in range(31)]
    body.append(bar(coil, 0.006, STEELC, sides=6, n=2))
    body.append(bar([(0.16, 0.0, 0.0), (0.06, 0.09, 0.0), (-0.02, 0.15, 0.0)], 0.018, CLAMP_RED * 0.9, n=4))
    return merge(body), merge(pads)


# ─── The magnetic stirrer ───────────────────────────────────────────
# Origin at its foot's centre; the flask stands on the white top at ST_TOP.

ST_W, ST_D = 2.6, 2.6
ST_TOP = 0.62


def stirrer():
    """(enamel case, white ceramic top): a low case on rubber feet, a dark
    sloped fascia with a speed knob and a power lamp bezel, and a white top
    plate the flask stands on (it doubles as the white tile)."""
    w, d = ST_W, ST_D
    case = [block((-w / 2, 0.03, -d / 2), (w / 2, ST_TOP - 0.03, d / 2), 0.05, ENAMEL, r=0.16)]
    case.append(slab(rounded_rect(0, 0.3, w - 0.5, 0.4, 0.05), d / 2 - 0.02, d / 2 + 0.012, 0.01, PANEL))
    case.append(xf(merge([knob(0.13, 0.115, 14, 0.0, 0.09, BLACK, 0.008), block((-0.012, 0.03, 0.09), (0.012, 0.11, 0.1), 0.003, WHITE)]), None, (0.55, 0.3, d / 2 + 0.012)))
    case.append(xf(turned([(0.0, 0.0), (0.0, 0.06), (0.03, 0.055), (0.035, 0.0)], "z", 20, STEELC), None, (-0.55, 0.3, d / 2 + 0.012)))
    for sx in (-1, 1):
        for sz in (-1, 1):
            case.append(xf(turned([(0.0, 0.0), (0.0, 0.09), (0.03, 0.085), (0.04, 0.0)], "y", 16, DARK), None, (sx * (w / 2 - 0.25), 0.0, sz * (d / 2 - 0.25))))
    top = block((-w / 2 + 0.08, ST_TOP - 0.04, -d / 2 + 0.08), (w / 2 - 0.08, ST_TOP, d / 2 - 0.08), 0.015, CERAMIC, r=0.12)
    return merge(case), top


def stir_bar():
    """The PTFE follower: a capsule along x, 2.5 cm long, its centre at the
    origin (the scene spins it about y), with the pivot ring round its middle."""
    L = cm(2.5)
    r = 0.045
    prof = [(-L / 2, 0.0)]
    for k in range(1, 7):
        a = math.pi / 2 * k / 6
        prof.append((-L / 2 + r - r * math.cos(a), r * math.sin(a)))
    for k in range(0, 7):
        a = math.pi / 2 * k / 6
        prof.append((L / 2 - r + r * math.sin(a), r * math.cos(a)))
    prof[-1] = (L / 2, 0.0)
    cap = turned(prof, "x", 18, PTFE, angle=70.0)
    ring = turned([(-0.03, 0.0), (-0.03, r + 0.012), (0.03, r + 0.012), (0.03, 0.0)], "x", 18, PTFE * 0.92)
    return merge([cap, ring])


# ─── The pH meter and electrode ─────────────────────────────────────

PH_W, PH_H, PH_D = 1.7, 0.85, 1.1
PH_DISPLAY = (-0.15, 0.5, 1.0, 0.36)
PH_SOCKET = (0.62, 0.2)


def ph_meter():
    """A bench pH meter: its display window at PH_DISPLAY (the scene fills
    it), CAL / pH / mV buttons and the electrode's BNC socket."""
    p = instrument(PH_W, PH_H, PH_D, np.array([0.9, 0.91, 0.92]), PH_DISPLAY, sockets=[(PH_SOCKET[0], PH_SOCKET[1], STEELC)])
    btns = []
    for k, c in enumerate((np.array([0.12, 0.45, 0.75]), np.array([0.3, 0.33, 0.38]), np.array([0.3, 0.33, 0.38]))):
        btns.append(xf(slab(rounded_rect(0, 0, 0.18, 0.09, 0.02), 0.0, 0.035, 0.008, c), None, (-0.55 + k * 0.26, 0.17, PH_D / 2 + 0.015)))
    return merge([p] + btns)


PR_LEN = cm(14)


def ph_probe():
    """(body, glass bulb): a combination electrode, its bulb's tip at the
    origin, y up: the glass membrane bulb under a protective skirt, a clear
    epoxy body with the reference junction, and a black cap the cable
    leaves from at y = PR_LEN."""
    r = cm(0.6)
    body = turned(
        [(0.12, 0.0), (0.12, r * 0.92), (0.16, r), (PR_LEN - 0.5, r), (PR_LEN - 0.48, r + 0.015), (PR_LEN - 0.08, r + 0.015), (PR_LEN, r * 0.6), (PR_LEN, 0.0)],
        "y",
        28,
        np.array([0.2, 0.22, 0.26]),
    )
    # the skirt round the bulb, open at the bottom, and a white ring at the
    # reference junction
    skirt = turned([(0.0, r), (0.15, r), (0.15, r - 0.014), (0.0, r - 0.014)], "y", 28, np.array([0.2, 0.22, 0.26]), angle=60.0)
    junction = turned([(0.3, r + 0.004), (0.36, r + 0.004)], "y", 24, WHITE)
    bulb = turned([(0.0, 0.0), (0.006, 0.022), (0.02, 0.038), (0.045, 0.05), (0.13, 0.05), (0.13, 0.0)], "y", 24, GLASS, angle=70.0)
    return merge([body, junction, skirt]), bulb


# ─── Indicator dropper bottle ───────────────────────────────────────


DR_R, DR_H = cm(1.6), cm(5.5)


def dropper_bottle():
    """(amber glass, cap and teat): a 30 cm3 dropper bottle, origin at its
    foot's centre."""
    R, H = DR_R, DR_H
    prof = [(0.0, 0.0), (0.0, R - 0.03), (0.03, R), (H - 0.25, R), (H - 0.1, R * 0.62), (H - 0.06, cm(0.75)), (H + 0.12, cm(0.75)), (H + 0.12, cm(0.6)), (H - 0.05, cm(0.6)), (H - 0.12, R * 0.55), (H - 0.28, R - 0.025), (0.04, R - 0.025), (0.04, 0.0)]
    V, F, _ = lathe(prof, "y", 40)
    glass = coloured(V, F, AMBER)
    cap = turned([(H + 0.02, 0.0), (H + 0.02, cm(0.85)), (H + 0.22, cm(0.85)), (H + 0.24, cm(0.7)), (H + 0.24, 0.0)], "y", 32, WHITE * 0.95)
    teat = turned([(H + 0.24, 0.0), (H + 0.24, cm(0.42)), (H + 0.32, cm(0.5)), (H + 0.48, cm(0.48)), (H + 0.56, cm(0.32)), (H + 0.6, 0.0)], "y", 28, RUBBER)
    return glass, merge([cap, teat])


def anchors():
    return {
        "burette": {
            "tipY": BU_TIP_Y,
            "stopcockY": BU_STOPCOCK_Y,
            "fiftyY": BU_FIFTY_Y,
            "zeroY": round(BU_ZERO_Y, 4),
            "topY": round(BU_TOP_Y, 4),
            "perCm3": BU_PER_CM3,
            "bore": round(BU_BORE, 4),
            "outer": round(BU_OUTER, 4),
            "clampAxisX": BU_CLAMP_AXIS_X,
        },
        "stirrer": {"top": ST_TOP, "w": ST_W, "d": ST_D, "barLength": cm(2.5)},
        "phMeter": {"w": PH_W, "h": PH_H, "d": PH_D, "display": list(PH_DISPLAY), "socket": list(PH_SOCKET)},
        "phProbe": {"length": PR_LEN, "radius": cm(0.6)},
        "dropper": {"radius": DR_R, "height": DR_H},
    }

"""Builds public/models/lab-kit.glb and
components/visualizations/lab-kit-model-meta.js: the bench apparatus the lab
scenes share (see README.md).

Reuses scripts/plant-model's helpers and GLB writer, scripts/arm-model's SDF
mesher and scripts/cannon-model's lathe and extrusion helpers.

Each node is one part in the frame of the three.js component it replaces
(labkit.py says which). The scenes give each node a material of its own.
"""

import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
for sub in ("plant-model", "cannon-model", "arm-model"):
    p = os.path.join(HERE, "..", sub)
    if p not in sys.path:
        sys.path.insert(0, p)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import numpy as np  # noqa: E402

import plantlib as pl  # noqa: E402

COL = "LabKit"


def _kit():
    import cannon
    import labkit

    importlib.reload(pl)
    importlib.reload(cannon)
    importlib.reload(labkit)
    return labkit


def parts(lk):
    """node name -> (V, F, C)."""
    out = {}
    out["standBase"] = lk.stand_base()
    out["bossHead"], out["bossScrews"] = lk.boss_head()
    out["clampSteel"], out["clampCork"] = lk.clamp()
    out["burnerBase"] = lk.burner_base()
    out["burnerBarrel"] = lk.burner_barrel()
    out["burnerInlet"] = lk.burner_inlet()
    out["burnerValve"] = lk.burner_valve()
    out["tripodRing"] = lk.tripod_ring()
    out["tripodLeg"] = lk.tripod_leg()
    out["psuCase"] = lk.psu_case()
    out["psuTrim"] = lk.psu_trim()
    out["psuKnob"] = lk.psu_knob()
    out["psuPostBrass"], out["psuPostCaps"] = lk.psu_posts()
    out["scaler"] = lk.scaler()
    out["hvSupply"] = lk.hv_supply()
    out["gmTube"], out["gmTrim"] = lk.gm_tube()
    out["gmStand"] = lk.gm_stand()
    out["roundFoot"] = lk.round_foot()
    out["leadCastle"] = lk.lead_castle()
    out["bulbHolder"] = lk.bulb_holder()
    out["bulbBase"] = lk.bulb_base()
    out["bulbGlass"] = lk.bulb_glass()
    out["bulbWires"] = lk.bulb_wires()
    out["cellWrap"], out["cellSteel"] = lk.cell()
    out["batteryHolder"], out["batteryContacts"] = lk.battery_holder()
    out["postMetal"], out["postCap"] = lk.binding_post()
    out["switchBase"], out["switchMetal"], out["switchHandle"] = lk.knife_switch()
    out["meterCase"] = lk.meter_case()
    out["galvoCase"], out["galvoBezel"] = lk.galvo_case()
    out["lampHolder"], out["lampCap"], out["lampGlass"] = lk.demo_lamp()
    out["gasTurret"], out["gasValve"] = lk.gas_turret()
    out["gasLever"] = lk.gas_lever()
    out["hotplate"], out["hotplateTop"] = lk.hotplate()
    out["furnaceCasing"], out["furnaceSteel"] = lk.furnace()
    out["tankShell"], out["tankSteel"] = lk.crude_tank()
    return out


def build():
    lk = _kit()
    col = pl.collection(COL)
    pl.clear(col)
    info = {}
    for node, (V, F, C) in parts(lk).items():
        o = pl.mesh_from(node, col, V, F, node=node)
        pl.set_attr(o, "col", np.concatenate([np.clip(C, 0, 1), np.ones((len(V), 1))], axis=1))
        pl.smooth_shade(o)
        info[node] = pl.triangles(o)
    # the air collar, which needs real holes: a signed-distance field
    lo, hi = lk.collar_bounds()
    o = pl.sdf.mesh_sdf("burnerCollar", col, lk.collar_field, tuple(lo), tuple(hi), 0.006)
    o["node"] = "burnerCollar"
    pl.decimate(o, 5000 / max(pl.triangles(o), 1))
    pl.smooth_shade(o)
    pl.paint(o, lk.BRASSC)
    info["burnerCollar"] = pl.triangles(o)
    return info


def anchors(lk):
    return {
        "units": "scene",
        "burner": {
            "mouthY": round(lk.B_MOUTH, 4),
            "holeY": round(lk.B_HOLE_Y, 4),
            "valveAt": [round(v, 4) for v in lk.B_VALVE_AT],
            "inletTip": list(lk.B_INLET_TIP),
            "collarY": round(lk.B_HOLE_Y, 4),
        },
        "tripod": {"legAngles": [round(a, 5) for a in lk.T_LEG_ANGLES], "legRadius": round(lk.T_LEG_R, 4), "ringR": round(lk.T_RING_R, 4)},
        "psu": {"knobAt": list(lk.PSU_KNOB_AT), "posts": {k: list(v) for k, v in lk.PSU_POSTS.items()}},
        "gm": {"radius": lk.GM_R, "length": lk.GM_L},
    }


def export(repo):
    import plant_export

    importlib.reload(plant_export)
    lk = _kit()
    return plant_export.export_to(
        os.path.join(repo, "public", "models", "lab-kit.glb"),
        os.path.join(repo, "components", "visualizations", "lab-kit-model-meta.js"),
        "LAB_KIT_MODEL",
        [pl.collection(COL)],
        anchors(lk),
        "SocraticOS. Modelled in-house in Blender (scripts/labkit-model); no third-party mesh.",
        "SocraticOS lab kit build (scripts/labkit-model)",
        "scripts/labkit-model/build_labkit.py",
    )


def build_all(repo):
    info = build()
    info["export"] = export(repo)
    return info

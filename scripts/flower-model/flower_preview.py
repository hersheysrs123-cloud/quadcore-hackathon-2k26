"""Workbench renders of chosen build nodes, for checking by eye.

    flower_preview.nodes(path, {"body", "ovules"}, target=(x, y, z), dist=..., direction=(dx, dy, dz))

`target` and `direction` are in scene coordinates (y up), as in
scripts/plant-model/plant_preview.py, which does the rendering. The stigmas
are built about their own centre, so for a preview they are lifted to the
height the scene draws them at.
"""

import bpy

import plant_preview

LIFT = {"stigmaSticky": 4.75, "stigmaFeathery": 4.75}


def nodes(path, show, **kw):
    hidden, moved = [], []
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        n = o.get("node")
        if n not in show and not o.hide_render:
            o.hide_render = True
            hidden.append(o)
        if n in LIFT and n in show:
            moved.append((o, o.location.z))
            o.location.z = LIFT[n]
    try:
        plant_preview.shoot(path, **kw)
    finally:
        for o in hidden:
            o.hide_render = False
        for o, z in moved:
            o.location.z = z
    return path

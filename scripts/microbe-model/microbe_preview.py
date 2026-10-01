"""Workbench renders of chosen build nodes, for checking by eye.

    microbe_preview.nodes(path, {"wall", "membrane"}, target=(x, y, z), dist=..., direction=(dx, dy, dz))

`target` and `direction` are in scene coordinates (y up), as in
scripts/plant-model/plant_preview.py, which does the rendering. Each node
is in its own frame (the cell's centre, or the phage's baseplate).
"""

import bpy

import plant_preview


def nodes(path, show, **kw):
    hidden = []
    for o in bpy.data.objects:
        if o.type == "MESH" and o.get("node") not in show and not o.hide_render:
            o.hide_render = True
            hidden.append(o)
    try:
        plant_preview.shoot(path, **kw)
    finally:
        for o in hidden:
            o.hide_render = False
    return path

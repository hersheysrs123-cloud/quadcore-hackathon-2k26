"""Workbench renders of one build node at a time, for checking by eye.

    eco_preview.node(path, "hawk", target=(x, y, z), dist=..., direction=(dx, dy, dz))

`target` and `direction` are in scene coordinates (y up), as in
scripts/plant-model/plant_preview.py, which does the rendering.
"""

import bpy

import plant_preview


def node(path, name, target=(0, 0, 0), dist=40.0, direction=(0.3, 0.25, 1.0), lens=50, size=(900, 900), morph=None):
    hidden = []
    keys = []
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        if o.get("node") != name and not o.hide_render:
            o.hide_render = True
            hidden.append(o)
        if morph and o.get("node") == name and o.data.shape_keys:
            for kb in o.data.shape_keys.key_blocks[1:]:
                if kb.name in morph:
                    keys.append((kb, kb.value))
                    kb.value = morph[kb.name]
    try:
        plant_preview.shoot(path, target=target, dist=dist, direction=direction, lens=lens, size=size)
    finally:
        for o in hidden:
            o.hide_render = False
        for kb, v in keys:
            kb.value = v
    return path

"""Workbench renders of the plant parts, for checking the model by eye.

    plant_preview.shoot(path, target=(x, y, z), dist=..., direction=(dx, dy, dz))

`target` and `direction` are in scene coordinates (y up); the camera looks
at the target from `direction`, as the transpiration scene's camera does.
Only objects in the collections named in `show` are rendered.
"""

import math

import bpy
from mathutils import Vector


def _cam():
    cam = bpy.data.objects.get("PreviewCam")
    if cam is None:
        data = bpy.data.cameras.new("PreviewCam")
        cam = bpy.data.objects.new("PreviewCam", data)
        bpy.context.scene.collection.objects.link(cam)
    return cam


def shoot(path, target=(0, 0, 0), dist=10.0, direction=(0.0, 0.1, 1.0), lens=50, size=(900, 900), show=None, ortho=None):
    sc = bpy.context.scene
    cam = _cam()
    d = Vector(direction).normalized()
    t = Vector(target)
    pos = t + d * dist
    to_b = lambda v: Vector((v[0], -v[2], v[1]))
    cam.location = to_b(pos)
    look = to_b(t) - cam.location
    cam.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = lens
    cam.data.clip_start = 0.01
    cam.data.clip_end = 200
    if ortho:
        cam.data.type = "ORTHO"
        cam.data.ortho_scale = ortho
    else:
        cam.data.type = "PERSP"
    sc.camera = cam
    sc.render.engine = "BLENDER_WORKBENCH"
    sh = sc.display.shading
    sh.light = "STUDIO"
    sh.color_type = "VERTEX"
    sh.show_cavity = True
    sh.cavity_type = "BOTH"
    sh.show_shadows = False
    sh.show_specular_highlight = True
    sc.render.resolution_x, sc.render.resolution_y = size
    sc.render.film_transparent = False
    sc.world.color = (0.08, 0.1, 0.14) if sc.world else None
    hidden = []
    if show is not None:
        for col in bpy.data.collections:
            if col.name not in show:
                for o in col.objects:
                    if not o.hide_render:
                        o.hide_render = True
                        hidden.append(o)
    for o in bpy.data.objects:
        if o.type == "MESH" and o.data.color_attributes.get("col") is not None:
            o.data.color_attributes.active_color = o.data.color_attributes["col"]
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for o in hidden:
        o.hide_render = False
    return path

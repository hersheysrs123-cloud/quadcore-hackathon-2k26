"""Workbench renders of the arm from the rig's standard views (for checking)."""

import math

import bpy
from mathutils import Vector

from armlib import B

# view name -> camera direction in rig axes (from the target towards the camera)
VIEWS = {
    "medial": (0, 0, 1),  # what the reflex scene's camera sees
    "lateral": (0, 0, -1),
    "anterior": (1, 0, 0),
    "posterior": (-1, 0, 0),
    "oblique": (0.6, 0.15, 0.8),
}


def setup():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "VERTEX"
    shading.show_cavity = True
    shading.cavity_type = "BOTH"
    shading.show_shadows = False
    scene.render.film_transparent = False
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    for name in ("Cube",):
        o = bpy.data.objects.get(name)
        if o:
            bpy.data.objects.remove(o, do_unlink=True)
    cam = bpy.data.objects.get("Camera")
    cam.data.type = "ORTHO"
    scene.camera = cam
    return cam


def shoot(path, target, size, view, res=900):
    cam = setup()
    scene = bpy.context.scene
    scene.render.resolution_x = res
    scene.render.resolution_y = res
    d = Vector(VIEWS[view]).normalized()
    t = B(target)
    dirb = B(tuple(d))
    cam.location = t + dirb * 20
    up = B((0, 1, 0))
    look = (t - cam.location).normalized()
    right = look.cross(up).normalized()
    true_up = right.cross(look)
    from mathutils import Matrix

    rot = Matrix((right, true_up, -look)).transposed()
    cam.rotation_euler = rot.to_euler()
    cam.data.ortho_scale = size
    cam.data.clip_end = 100
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

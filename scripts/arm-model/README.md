# Arm model

Builds `public/models/arm.glb` and `components/visualizations/arm-model-meta.js`, the left upper limb that the reflex-arc and antagonistic-muscles scenes draw. Every mesh is our own, modelled in Blender. The bones are traced from Gray's Anatomy plates (20th ed., public domain) and scaled to standard adult measurements. The muscles are laid out from Gray's muscle plates and its cross-sections through the arm and forearm. No scanned or third-party mesh is used, so the model needs no credit.

## Files

| File | What it does |
| --- | --- |
| `armlib.py` | Rig-to-Blender axes (`B`), scene helpers, modifier helpers |
| `sdf.py` | numpy SDF primitives, smooth union and cut, noise, narrow-band sampling, OpenVDB meshing (`mesh_sdf`), cached grid fields |
| `sculpt.py` | Section-based primitives: `RadialLoft` (a bone as outlines level by level), `lathe` (a surface of revolution), `Sweep` (a band swept along a path, for muscles and tendons), `Pillow` (a flat muscle domed over its area of origin on a flat bone) |
| `skeleton.py` | Humerus, ulna, radius, scapula and clavicle |
| `hand.py` | The carpus and the 19 finger bones as a jointed skeleton, its poses (rest, relaxed, grip, point) and the per-vertex segment weights that make soft tissue follow the fingers |
| `anat.py` | Landmarks, and helpers that put points on the bones' surfaces or sink a muscle onto the bone beneath |
| `muscle_specs.py` | Every muscle and tendon: its path, section, tendon parts, bend weights and morph |
| `soft.py` | Builds the muscles and tendons from their specs: meshing, forearm packing, per-vertex attributes, morphs |
| `exporter.py` | The GLB writer and `arm-model-meta.js` |
| `preview.py` | Workbench renders from the rig's views, for checking the model |
| `build_arm.py` | Runs everything, and fits the dumbbell grip and the landmarks the scenes mark |

## Conventions

- **Units and axes:** the arm rig's (`arm-rig.jsx`). Units are decimetres, with the humeral head's centre at the origin. `+X` is anterior, the limb hangs down `-Y`, and `+Z` is medial.
- **Frames:**
  - The girdle is in the shoulder frame and never moves.
  - The humerus is in the shoulder frame and turns at the shoulder.
  - The ulna, radius and hand are in the forearm frame, with the elbow axis at the origin. The hand bones are also posed per segment.
  - The muscles and tendons are in the shoulder frame at the rest pose: arm hanging, elbow straight, palm forward.

## How the model works

### Bones

- **Long bones:** each is a `RadialLoft`. Its outline is given level by level as radius by angle (a four-quadrant superellipse, with ridges and grooves added), then interpolated smoothly.
- **Joints and processes:** the joint surfaces are lathes, and the processes are blended on.
- **Congruent joints:**
  - The ulna's trochlear notch and the radial head's fovea are cut by the humerus's condyle.
  - Each phalanx's base is cupped to the head it sits on.
  - So joints stay closed as they move.

### Muscles

- **Shape:** each muscle is one or more heads, smoothly joined:
  - A `Sweep`: a band along a path. A section can be wide and thin, and flatter on the side lying on the layer beneath. `ti="bone"` sinks a deep muscle's underside onto the skeleton.
  - A `Pillow`, for the muscles filling the fossae of the scapula (supraspinatus, infraspinatus, the teres muscles, subscapularis). It is an outline on the blade, domed up from the bone, whose margin rounds down into the bone. A Sweep carries it on to its tendon.
- **Placement:**
  - Muscles of the arm and shoulder are separate smooth bodies that meet in creases.
  - `carve="humerus"`: brachialis and the medial head of triceps run their paths down the shaft's centre (`anat.hum_c`) and have the bone carved out of them. They wrap the front and back halves of the shaft, as in Gray's mid-arm section, so the humerus never shows between biceps and triceps.
  - The crowded forearm is packed. The group's muscles join in a smooth hull that fills the gaps between them, and each keeps the part nearer its own inside than any neighbour's, with a seam between. The fill is wide over the fleshy upper forearm and narrows towards the wrist, where the tendons run apart.
  - The bicipital aponeurosis is `paint_only`: it is painted white onto the flexors it covers rather than built as a plate.

### Per-vertex data

Every value is blended over a muscle's heads by how near each head's surface is (`soft.head_weights`). Taking it from the nearest head alone makes it jump where two heads merge. A jump in the bend weights or a morph then tears the mesh along that line when it moves.

- `_humerus`, `_forearm` (bend weights):
  - Interpolated along each muscle's path from its stations, so a tendon crossing a joint bends round it while its belly stays put.
  - The scene's vertex shader turns each vertex about the elbow by its share of the elbow angle, then about the shoulder.
- `_tendon`: 0 is muscle and 1 is tendon, so one mesh can be a whole muscle-tendon unit. The triceps paints its common tendon onto its back this way.
- `_fibre`: the path direction at rest. The fragment shader draws fascicles along it.
- `_seg`: carried by anything reaching into the hand, so it follows the finger segments.

### Morphs

- `contract` on the biceps
- `stretch` on the triceps
- `flex` on the brachialis and brachioradialis

A carved muscle's face on the bone stays put. The shape keys are saved at value 0, so the rest renders show the rest shape.

## Running it

It needs Blender 5.x, whose Python ships numpy and OpenVDB.

```
blender --background --python-expr "import sys; sys.path.insert(0, r'<repo>/scripts/arm-model'); import build_arm; build_arm.build_all(r'<repo>')"
```

A full build takes a few minutes. These steps can each be run on their own from a Blender session, which is how the model was iterated on with `preview.shoot(...)` renders:

- `build_arm.build_bones(col)`
- `soft.build(col, only=[...])`
- `exporter.export(repo, col, landmarks=..., grip=...)`

A muscle's build is well under a minute, so a Blender MCP call can do one at a time.

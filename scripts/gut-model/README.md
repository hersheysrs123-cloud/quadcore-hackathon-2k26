# Gut model

Builds `public/models/gut.glb` and `components/visualizations/gut-model-meta.js`: the oesophagus, stomach and boluses the peristalsis scene draws. Every mesh is our own, modelled in Blender. The shapes follow Gray's Anatomy (public domain) and histology texts (Ross & Pawlina) for the layers of the oesophageal wall. No third-party mesh is used.

It reuses `scripts/plant-model`: its helpers (`plantlib`), the SDF mesher (from `scripts/arm-model`), the GLB writer (`plant_export.export_to`) and `run_async`.

## Files

| File | What it does |
| --- | --- |
| `gut.py` | The oesophagus (parametric, cut away at the front, stored at rest with per-vertex `tube` = station, depth into the wall, fold offset); the stomach (an SDF sweep along a J, flattened front to back, with a pyloric waist and a cut duodenum) and its vessels pressed onto its front; the chewed and dry boluses (SDF) |
| `build_gut.py` | One builder per part, and `build_all` (build and export) |
| `wave_preview.py` | Poses the oesophagus in Blender exactly as the scene's vertex shader does, for a bolus at a given station, and tints the layers as they contract |

## Conventions

- **Units and axes:** centimetres, y up. The mouth end of the oesophagus is at the origin and the tube runs down −y. +x is the viewer's right, where the stomach lies.
- **Storage:** as with the other builds, a point (x, y, z) is stored in Blender as (x, −z, y).
- **Moving the wall:** the oesophagus is never posed in the file. The scene's vertex shader (`gut-model.jsx`) places every vertex at the radius the peristaltic wave gives its station. It reads the depth into the wall and the fold offset from `_TUBE`, and the layer depths in `LAYERS` from the meta.
  - The fragment shader colours by the same depths, so the shader and `gut.py` share one table.
- **Colours:** the stomach and the boluses are baked vertex colours (sRGB). The oesophagus's colours are all in its shader.

## Running it

```
blender --background --python-expr "import sys; sys.path.insert(0, r'<repo>/scripts/gut-model'); import build_gut; build_gut.build_all(r'<repo>')"
```

A build takes well under a minute. `build_all(repo, export_only=True)` re-exports what is already built.

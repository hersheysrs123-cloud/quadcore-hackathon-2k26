# Villus model

Builds `public/models/villus.glb` and `components/visualizations/villus-model-meta.js`. These are the two zoomed-in levels of the peristalsis scene: the small intestine's lining, and one villus dissected. Every mesh is our own, modelled in Blender. The shapes follow histology texts (Ross & Pawlina) and Helander & Fändriks (2014) for the mucosal surface. No third-party mesh is used.

It reuses `scripts/plant-model`: its helpers (`plantlib`), the SDF mesher (from `scripts/arm-model`), the GLB writer (`plant_export.export_to`) and `run_async`.

## Files

| File | What it does |
| --- | --- |
| `villus.py` | **Level 1 (mm):** a block of jejunum wall, opened out and curving up gently at the sides. It has two circular folds over a submucosal core. Each vertex carries `tube` = (depth below the mucosal surface, depth below the surface line), which the shader turns into the wall's layers. Also: <br>• `villus_low`: one villus for instancing, with an "atrophy" morph for coeliac disease <br>• `villus_sites`: points about 0.235 mm apart on the mucosal surface, projected onto it and Poisson-thinned <br>**Level 2 (10 µm):** one villus in three storeys. The epithelium is peeled off the tip, the front half of the middle is cut away, and the base is intact. It stands on a floor of mucosa with crypts. Also: <br>• the lacteal, laid open <br>• smooth muscle strands <br>• the arteriole, the capillary fountain (the two side meridians lie in the cut plane) and the venule, clipped where the middle storey was removed |
| `build_villus.py` | `build_wall`, `build_villus`, `export` and `build_all` |

## Conventions

- **Units and axes:** y up, +z towards the viewer. Level 1 is in mm with the mucosal surface at y = 0. Level 2 is in 10 µm units with the villus's base at y = 0.
- **Storage:** as with the other builds, a point (x, y, z) is stored in Blender as (x, −z, y).
- **The cells are drawn by shaders, not baked.** The villus, the floor and the wall carry per-vertex depths in `_TUBE`. `villus-model.jsx`'s fragment shaders draw the cells from them: columnar enterocytes with basal nuclei, goblet cells, the brush border, crypts and the layers of the wall. Depth interpolates cleanly across big triangles, so the meshes can be decimated hard.
- **Villus sites** are stored as one tiny triangle each. Vertex 3i is the site, and its `_TUBE.xyz` is the surface normal there; `villusSites()` reads them back. A degenerate triangle would be dropped by `mesh.validate()`.

## Running it

The whole build takes about 40 s in the live Blender, so `run_async` is enough.

```
blender --background --python-expr "import sys; sys.path.insert(0, r'<repo>/scripts/villus-model'); import build_villus; build_villus.build_all(r'<repo>')"
```

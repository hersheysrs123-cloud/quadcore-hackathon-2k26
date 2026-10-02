# Division model

Builds the modelled parts of the mitosis-and-meiosis scene: chromatin territories, the nucleolus, the nuclear envelope with its pores, centrioles, the pericentriolar material and a mitochondrion. Every mesh is our own, modelled in Blender from electron micrographs and textbook cell-biology figures. No third-party mesh is used.

| Output | Scene |
| --- | --- |
| `public/models/division.glb` and `components/visualizations/division-model-meta.js` (`DIVISION_MODEL`) | Mitosis & Meiosis — Spindle Mechanics & Crossing Over |

It reuses `scripts/plant-model`: its helpers (`plantlib`), the SDF mesher (from `scripts/arm-model`), the GLB writer (`plant_export.export_to`) and `run_async`.

The cell membrane, the chromosomes and the spindle are not here: they change shape every frame, so the scene draws them itself (dynamic tubes and instanced fibres).

## Nodes

| Node | What it is |
| --- | --- |
| `territory0`–`territory3` | One chromosome's decondensed fibre, coiled on itself, filling a ball of radius ~1. Painted pale with heterochromatin stretches; the scene tints each by its parent and draws one per chromatid |
| `nucleolus` | A lumpy granular body with paler fibrillar centres (radius ~1) |
| `envelope` | A unit sphere shell perforated by ~315 nuclear pores, each ringed by its pore complex with a central transporter |
| `centriole` | A barrel of nine triplet microtubules (A innermost, the C tubule shorter) with a two-tier cartwheel. Axis +y, proximal end at the origin, length 1 |
| `centrioleMother` | The same with nine distal appendages |
| `pcm` | The pericentriolar material: a lumpy cloud (radius ~1) |
| `mitochondrion` | A gently bent capsule along x, its cristae showing through the outer membrane |

## Files

| File | What it does |
| --- | --- |
| `division.py` | Every part's field or surface and its painting. Also `meta()` |
| `build_division.py` | `build_division`, `export_division` and `build_all` |

For previews, `scripts/microbe-model/microbe_preview.nodes` renders any node by name.

## Conventions

- **Units:** each part in its own unit frame, y up; the scene scales and places it.
- **Pores:** the pores sit in latitude bands (`PORE_STEP` apart, jittered), so the field finds the nearest pore by searching only the three nearest bands (`_nearest_pore`).
- **Storage:** as with the other builds, a point (x, y, z) is stored in Blender as (x, −z, y).
- **Colours:** baked sRGB vertex colours. The territories are pale so that a material colour can tint them.

## Running it

It needs Blender 5.x, whose Python ships numpy and OpenVDB.

```
blender --background --python-expr "import sys; sys.path.insert(0, r'<repo>/scripts/division-model'); import build_division; build_division.build_all(r'<repo>')"
```

A full build takes about ninety seconds (most of it the envelope). From a Blender MCP session, which times out after a minute, use `build_division.run_async(status_path, build_division.build_all, repo)` and poll the JSON it writes.

# Flower model

Builds the models of the flower pollination scene: a dissected half-flower, a worker honeybee and two kinds of pollen grain. Every mesh is our own, modelled in Blender from botany texts, dissection photographs and entomology plates. No third-party mesh is used.

| Output | Scene |
| --- | --- |
| `public/models/flower.glb` and `components/visualizations/flower-model-meta.js` (`FLOWER_MODEL`) | Flower Anatomy, Pollination & Pollen Tube Growth |

It reuses `scripts/plant-model`: its helpers (`plantlib`), the SDF mesher (from `scripts/arm-model`), the GLB writer (`plant_export.export_to`) and `run_async`.

## The dissection

The flower is cut by the plane z = 0, and everything in front of it is taken away.

- **Solid organs** are signed-distance fields cut by that plane (`dissect`, a softened max with z, so the meshed rim is a clean curve and not a voxel staircase). Their cut faces are painted as fresh tissue: a green epidermis, a pale cortex, dark vascular strands sliced along their length, and the style's pale transmitting tract.
  - Solid: the pedicel, receptacle and carpel (one body), the ovules, the nectary and the sticky stigma.
- **Thin organs** are parametric blades and sweeps. The scene clips the petals and sepals at the same plane with a material clipping plane, so the ones crossing the cut are halved too.
- **Decimation** spares the cut face (`decimate_keep_cut`): the painted tissue needs its vertices.

## Nodes

| Node | What it is |
| --- | --- |
| `body` | Pedicel, receptacle and carpel: ovary with five faint ribs, the open locule with a basal placenta, the style, all cut lengthways |
| `ovules` | Two orthotropous ovules on funicles, cut open. Each shows its two integuments, the micropyle canal and the embryo sac cavity (the scene draws the cells inside) |
| `nectary` | A lobed glandular disc at the ovary's base (insect flower) |
| `stigmaSticky` | A three-lobed, papillate, wet stigma, cut, with the transmitting tract down its middle. Built about its own centre |
| `stigmaFeathery` | Two plumose branches of fine barbs on the cut style top (wind flower). Built about its own centre |
| `stamenInsect` | A filament and a basifixed anther: four pollen sacs in two thecae, with a dehiscence slit down each inner face |
| `stamenWind` | A hair-thin filament arching over, and a long versatile anther dangling from it, its thecae splayed at both ends |
| `petal` | Broadly obovate on a claw, cupped and ruffled, white at the claw flushing to pink, with a yellow nectar guide. Carries leaf coordinates (`_UVL`) for the scene's vein shader |
| `sepal` | Ovate, acuminate, with a paler midrib |
| `tepal` | The wind flower's small, papery perianth scale |
| `bee` | A worker honeybee: SDF head, thorax and banded abdomen, compound eyes, six legs with broad hind tibiae, elbowed antennae |
| `beePollen` | The pollen loads in the hind-leg baskets, shown once the bee has visited an anther |
| `beeWing` | One side's fore- and hindwing, the hinge at the origin; the membrane and veins are in vertex alpha |
| `pollenSpiky` | An echinate grain with three pores (unit radius) |
| `pollenSmooth` | A smooth monoporate grain (unit radius) |

## Files

| File | What it does |
| --- | --- |
| `flower.py` | The layout constants, every organ's field or surface, and its painting. Also `meta()` |
| `build_flower.py` | One builder per part, `build_flower`, `export_flower` and `build_all` |
| `flower_preview.py` | Workbench renders of chosen nodes, lifting the stigmas to their height in the scene |

## Conventions

- **Units:** scene units, y up. The body, ovules, nectary, stamens, petals and sepals are in the flower's own frame:
  - Whorl organs stand at the origin and run out along +x. The scene turns each one to its azimuth and moves it to its base radius, which is recorded in the meta.
  - The stigmas are built about their own centre, at height `stigmaY`.
  - The bee faces +x.
- **Storage:** as with the other builds, a point (x, y, z) is stored in Blender as (x, −z, y).
- **Colours:** baked sRGB vertex colours. The pollen grains are painted pale so the scene can tint them through `instanceColor`.

## Running it

It needs Blender 5.x, whose Python ships numpy and OpenVDB.

```
blender --background --python-expr "import sys; sys.path.insert(0, r'<repo>/scripts/flower-model'); import build_flower; build_flower.build_all(r'<repo>')"
```

A full build takes about twenty seconds. From a Blender MCP session, which times out after a minute, use `build_flower.run_async(status_path, build_flower.build_all, repo)` and poll the JSON it writes.

# Plant model

Builds `public/models/transpiration.glb` and `components/visualizations/plant-model-meta.js`: the bean seedling and the four magnified panels the transpiration scene draws. Every mesh is our own, modelled in Blender. The shapes follow botany texts (Esau, *Anatomy of Seed Plants*), stained sections and SEM images of *Phaseolus vulgaris*, and photographs of bean seedlings. No scanned or third-party mesh is used, so the model needs no credit.

## Files

| File | What it does |
| --- | --- |
| `plantlib.py` | Scene-to-Blender axes, attributes, decimation, and parametric builders: Catmull-Rom paths, parallel-transport `sweep` tubes, ellipsoids. It puts `scripts/arm-model` on the path and re-exports its SDF mesher (`sdf`) |
| `plant.py` | The seedling (parametric): the stem, the cordate primary leaves and the trifoliate leaf with their veins, pulvini and petioles, the shrivelled cotyledons, and the shoot tip. The roots are meandering gravitropic walks with laterals, root-hair fuzz and nodules. The soil block is an SDF with crumbs and pebbles |
| `stem.py` | A length of stem with a wedge cut out. The vessels and a sieve tube are split open as grooves on the cut faces, with the ring and spiral thickenings and the sieve plates inside them. Also the stem hairs, and the ring radii the scene's tissue shader uses |
| `leafsec.py` | A freeze-fractured block of leaf (SDF): cuticle and epidermis, palisade with chloroplasts, lobed spongy mesophyll, a minor vein, the lower epidermis, and guard cells cut through the pore |
| `stoma.py` | The lower epidermis face-on: a heightfield of jigsaw pavement cells, and two stomata whose guard cells are an SDF |
| `roothair.py` | A root tip (translucent epidermis with cells, stele, root cap), root hairs steered round the soil particles, sand, silt and clay–humus crumbs, and their water films (SDF) |
| `plant_export.py` | The GLB writer, built on `scripts/arm-model/exporter.py`'s. It writes 16-bit positions under a per-node scale, int8 normals, uint8 colours, `_SWAY`, `_UVL`, sparse morphs, and `plant-model-meta.js` |
| `plant_preview.py` | Workbench renders from the scene's views, for checking the model |
| `build_plant.py` | One builder per part, the morphs, `run_async` (for long builds from an MCP call), and `build_all` |

## Conventions

- **Axes and units:** each part is authored in scene coordinates (y up, the transpiration scene's units) in its own frame, which the scene places.
- **Storage:** as with the arm, a point (x, y, z) is stored in Blender as (x, −z, y), and the exporter turns it back.
- **Colours:** baked as sRGB vertex colours (`col`). `plant-model.jsx` makes them linear on load. The stem is the exception: its tissues are drawn per pixel by the scene's shader from the meta, because a vertex colour cannot resolve cells.
- **Morphs:** all are stored at value 0.
  - `wilt` (plant): the plant built again with the same topology, with its leaves drooped at the pulvini and the shoot tip nodding.
  - `open` (both sets of guard cells): each cell bows away from the pore, pinned at its tips.
  - `dry` (root water): the films pulled back along their normals.

## Nodes

The nodes are `plant`, `roots`, `soil`, `stem`, `stemDetail`, `leafSection`, `leafGuard`, `stomaSurface`, `stomaGuard`, `rootTip`, `rootStele`, `rootSoil` and `rootWater`. Each is every object in the build collections whose `node` property has that name, merged.

## Running it

It needs Blender 5.x, whose Python ships numpy and OpenVDB.

```
blender --background --python-expr "import sys; sys.path.insert(0, r'<repo>/scripts/plant-model'); import build_plant; build_plant.build_all(r'<repo>')"
```

A full build takes about four minutes. The leaf section and the root tip are the slow parts. From a Blender MCP session, which times out after a minute, run a build through `build_plant.run_async(status_path, fn, ...)` and poll the JSON it writes. The builders can each be run on their own, for example `build_plant.build_stoma(pl.collection("Stoma"))`. `build_all(repo, export_only=True)` re-exports what is already built.

# Ecosystem models

Builds the models of the two ecosystem scenes. Every mesh is our own, modelled in Blender from field-guide plates and photographs. No third-party mesh is used.

| Output | Scene | Nodes |
| --- | --- | --- |
| `public/models/food-chain.glb` and `components/visualizations/food-chain-model-meta.js` | Food chains & the 10 % energy pyramid | `sprig`, `caterpillar`, `blueTit`, `hawk` |
| `public/models/carbon-cycle.glb` and `components/visualizations/carbon-cycle-model-meta.js` | The carbon cycle | `broadleaf`, `conifer`, `stump`, `cow`, `plant` |

It reuses `scripts/plant-model`: its helpers (`plantlib`), the SDF mesher (from `scripts/arm-model`), the GLB writer (`plant_export.export_to`) and `run_async`.

## Files

| File | What it does |
| --- | --- |
| `foodchain.py` | A pedunculate oak shoot tip (twig, a rosette of lobed leaves built parametrically with veins painted, a pair of acorns on a long stalk). A winter moth caterpillar, a looper: a segmented sweep with true legs and prolegs on A6 and A10 only. The same body arched is the `loop` morph. A blue tit and a male sparrowhawk on a fallen log, as SDF parts with soft-edged plumage painted per part |
| `carbon.py` | A broadleaf tree (swept trunk and branches, an SDF crown of leafy lobes), a spruce, a felled stump with growth rings, a Holstein cow (SDF, with patches), and a coal power station: turbine hall and boiler house built as gridded boxes so windows and brick courses can be painted, two banded stacks, a conveyor and an SDF coal heap |
| `build_eco.py` | One builder per part, `build_food_chain` and `build_carbon`, the two exports, and `build_all` |
| `eco_preview.py` | Workbench renders of one node at a time, with a morph set if asked |

## Conventions

- **Units:** each node is in its own frame, standing on y = 0 and facing +x. The scenes scale each node:
  - Centimetres for the food-chain organisms.
  - Metres for the trees and the station.
  - Decimetres for the cow.
  - The units are recorded in the meta.
- **The hawk** stands on its log: the log is below its feet, so the scene lifts it by `2 × logRadius`.
- **Storage:** as with the other builds, a point (x, y, z) is stored in Blender as (x, −z, y).
- **Colours:** baked sRGB vertex colours. The scenes tint instances through `instanceColor`, for example a poisoned bird greyed or each tree a shade lighter or darker.
- **Morphs:** stored at value 0. The scene drives `loop` per instance with `InstancedMesh.setMorphAt`.

## Running it

It needs Blender 5.x, whose Python ships numpy and OpenVDB.

```
blender --background --python-expr "import sys; sys.path.insert(0, r'<repo>/scripts/ecosystem-model'); import build_eco; build_eco.build_all(r'<repo>')"
```

A full build takes under half a minute. From a Blender MCP session, which times out after a minute, use `build_eco.run_async(status_path, build_eco.build_all, repo)` and poll the JSON it writes.

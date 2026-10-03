# Sweater model

Builds `public/models/sweater.glb` and `components/visualizations/sweater-model-meta.js`: the wool sweater on a dress form that the static-electricity scene rubs the balloon on. Every mesh is our own, modelled in Blender. No third-party mesh is used.

It reuses `scripts/arm-model`'s SDF mesher and `RadialLoft`, and `scripts/plant-model`'s helpers, GLB writer and `run_async`.

## Files

| File | What it does |
| --- | --- |
| `sweater.py` | The sweater's signed-distance field: body loft, sleeves, collar, cables, ribbing and folds. Also its knit coordinates and colour, the dress form and stand parts, and the meta anchors |
| `build_sweater.py` | `build_wool` (mesh, decimate, paint), `paint` (recolour and re-coordinate only), `build_stand`, `export` and `build_all` |

## The model

- **Body:** a `RadialLoft` of horizontal sections.
  - It is boxy at the chest, hangs straight past the waist, and is bloused slightly over the ribbed hem band. It slopes in over the shoulders to a crew neck.
  - The hem is hollow, so you can see up into it. The neck is cut for the form's neck.
- **Sleeves:** empty sleeves hang against the sides.
  - They are flattened front to back, as an empty sleeve is. They join the body with a fillet only at the shoulder, so they don't melt into its sides.
  - They have soft folds, bunching above the cuff, and a ribbed cuff.
- **Relief:**
  - Three rope cables up the front and the back. Each is two strands crossing every 0.2 units, with the strand on top alternating, and a twisted-stitch column either side.
  - Rib ridges on the hem, cuffs and collar.
  - Gentle drape folds low on the body.
- **Stand:**
  - The dress form's linen neck, with a turned wooden cap and finial.
  - An elliptical base plate, hidden inside the hem.
  - A pole with a height collar.
  - A wooden hub, three curved legs and felt feet.

## Conventions

- **Frame and units:** the scene's own units. x is measured from the sweater's centre line (the scene adds `SWEATER_X`), y is up and the front faces +z. It stands on the floor at y = −2.6.
- **Nodes:** `sweater` (the wool), `form` (linen and felt), `wood` and `metal`. The scene gives each its own material.
- **`_KNIT`** (float × 4, per wool vertex): stitch across, row along, kind (0 stockinette, 1 rib, 2 cable panel), and cable height (0–1).
  - The fragment shader in `sweater-model.jsx` draws the stitches from these coordinates, because they are far too small for the mesh.
  - Round the body the stitch count is a whole number (64), so the pattern closes on itself.
  - In the ribbing the coordinate counts two stitches per moulded ridge. The shader then draws k1p1 with a knit column on each ridge.
  - This attribute was added to the shared GLB writer (`plant_export.py`) and to `usePackedModel`'s unpacker.
- **Colours:** baked sRGB vertex colours. The wool is an undyed cream, lightly heathered, and darker inside the hem.
- **Meta:** `frontZ` (the chest's front, cables included, which is where the charge signs sit), `chestY`, `hemY`, `neckY`, `top` (the cap's top, for the label), `halfWidth`, `sleeveX` and `floorY`.

## Pitfalls

- **Cable crossings:** the over/under bias at a crossing must apply only on each strand's own footprint. Added everywhere, it rippled the whole front and back with faint horizontal ridges.
- **Neck hole:** cutting the neck hole too far down thinned the wool under the collar until the mesh opened there. It is cut only from just below the collar.
- **Stale exporter:** in a long Blender session, reload `plant_export` after changing it. A stale module silently dropped `_KNIT` from the GLB, and only `tests/unit/sweater-model.test.mjs` caught it.

## Running it

It needs Blender 5.x, whose Python ships numpy and OpenVDB.

```
blender --background --python-expr "import sys; sys.path.insert(0, r'<repo>/scripts/sweater-model'); import build_sweater; build_sweater.build_all(r'<repo>')"
```

The wool takes about a minute to mesh. From a Blender MCP session, which times out after a minute, use `build_sweater.run_async(status_path, build_sweater.build_all, repo)` and poll the JSON it writes. After a colour or knit change, `build_sweater.paint()` then `build_sweater.export(repo)` is enough.

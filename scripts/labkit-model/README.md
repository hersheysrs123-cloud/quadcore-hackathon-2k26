# Lab kit

Builds `public/models/lab-kit.glb` and `components/visualizations/lab-kit-model-meta.js`: the bench apparatus the physics and chemistry lab scenes share. Every mesh is our own, modelled in Blender. No third-party mesh is used.

It reuses:

- `scripts/plant-model`'s helpers and GLB writer
- `scripts/arm-model`'s SDF mesher
- `scripts/cannon-model`'s `lathe`, `crisp` and `extrude`

## Files

| File | What it does |
| --- | --- |
| `labkit.py` | One builder per part. Each returns `(V, F, colours)` in the frame of the three.js component it replaces. The helpers: `turned` (a lathe), `slab` and `block` (chamfered extrusions), `knob` (a fluted extrusion), `rod` and `bar` (round bars), `ring`, `disc_on_cylinder` (a painted patch on a barrel) |
| `titration.py` | The titration parts: the burette (origin at the tip, 0.16 units per cm³, ticks every 0.1 cm³ and numbers 0–50 made from Blender text, Schellbach stripe), the stopcock key (rotates about x; grip vertical is open), the burette clamp, the magnetic stirrer and bar, the pH meter and probe, and the amber dropper bottle |
| `build_labkit.py` | `parts` (node name to part), `build` (every part into the `LabKit` collection, plus the Bunsen collar as an SDF), `export` and `build_all` |

## The parts

| Group | Nodes | Replaces | Scenes |
| --- | --- | --- | --- |
| Retort stand | `standBase`, `bossHead`, `bossScrews`, `clampSteel`, `clampCork` | `RetortStand` in `lab-bench.jsx`, the Hooke's-law stand | separation, combustion, Hooke's law |
| Bunsen burner | `burnerBase`, `burnerBarrel`, `burnerInlet`, `burnerValve`, `burnerCollar` | `BunsenBurner` (lab-bench), the heat-transfer burner | combustion, separation, heat transfer |
| Tripod | `tripodRing`, `tripodLeg` | `Tripod` (lab-bench), the heat-transfer tripod | separation, heat transfer |
| Bench supply | `psuCase`, `psuTrim`, `psuKnob`, `psuPostBrass`, `psuPostCaps` | `PowerSupply` | electrolysis |
| Counting | `scaler`, `hvSupply`, `gmTube`, `gmTrim`, `gmStand`, `roundFoot`, `leadCastle` | the GM tube, counter, HV supply, barrier foot and lead castle | radioactive decay |
| Circuit | `bulbHolder`, `bulbBase`, `bulbGlass`, `bulbWires`, `cellWrap`, `cellSteel`, `batteryHolder`, `batteryContacts`, `postMetal`, `postCap`, `switchBase`, `switchMetal`, `switchHandle`, `meterCase` | `Bulb`, `Cell`, `BatteryPack`, `BindingPost`, `KnifeSwitch`, `Meter` | circuits |
| Induction | `galvoCase`, `galvoBezel`, `lampHolder`, `lampCap`, `lampGlass` | `LaboratoryGalvanometer`, `DemonstrationBulb` | induction |
| Gas tap | `gasTurret`, `gasValve`, `gasLever` | the bench gas taps | combustion, heat transfer |
| Hotplate | `hotplate`, `hotplateTop` | `HotPlate` | particle model |
| Furnace | `furnaceCasing`, `furnaceSteel`, `tankShell`, `tankSteel` | the distillation furnace's casing and the crude tank | distillation |
| Titration | `buretteGlass`, `buretteMarks`, `stopcockKey`, `buretteClamp`, `buretteClampPads`, `stirrerCase`, `stirrerTop`, `stirBar`, `phMeter`, `phProbe`, `phProbeBulb`, `dropperGlass`, `dropperCap` | new parts, built in `titration.py` | acids & bases |

## Conventions

- **Frames:** each part is in the frame and units of the component it replaced, so a scene swaps a stack of primitives for the part without moving anything. `labkit.py`'s docstrings name each origin.
  - The scene units are 1 cm = 0.2.
  - The lead castle and the furnace use their scenes' absolute coordinates.
- **Moving and stretched parts:**
  - Parts a scene drives are separate nodes in their own pivot frames: the burner's collar (about y) and valve wheel (about x), the supply's knob (about z), and the gas lever (about y).
  - Anything a slider stretches stays three.js beside the parts: stand rods and arms, a ring's radius, flames, displays, needles, filaments, and the furnace's fire, lining and coil.
- **Scaled parts:**
  - The tripod's leg is one node, scaled to the tripod's height.
  - The heat-transfer scene squashes the burner to its own flame height and widens the tripod to its 2.3 mm unit.
  - The Hooke's-law stand scales the base and boss head up for its heavier rod.
- **Meta:** the burner's mouth, collar and valve positions and its inlet tip (scenes run their hoses onto it), the tripod's leg angles and radius, the supply's knob and post positions, and the GM tube's size.
- **Colours:** baked sRGB vertex colours. `lab-kit-model.jsx` gives each node a finish (painted, enamel, steel, brass, lead, cork, plastic, porcelain or glass). The white binding-post caps take their colour from the `color` prop.

## Pitfalls

- **Normals:** the GLB writer stores one normal per vertex, so smooth shading blurs every chamfer and step. `crisp` splits each edge sharper than its angle, so flat faces shade flat.
- **Real holes:** the collar's air holes have to be real, because the scene looks through them at the barrel's dark holes. The collar is the one SDF part.
- **Materials across scenes:** each `KitPart` makes its own material. The studio environment patches materials once per scene, so a material shared between scenes would carry a stale reflection map into the next one.
- **Shell heredocs:** `labkit.py` is long, and Git Bash heredocs choke on its quotes. Edit it with the editor, not with `cat <<EOF`.

## Running it

```
blender --background --python-expr "import sys; sys.path.insert(0, r'<repo>/scripts/labkit-model'); import build_labkit; build_labkit.build_all(r'<repo>')"
```

It builds in about ten seconds, which fits within an MCP call.

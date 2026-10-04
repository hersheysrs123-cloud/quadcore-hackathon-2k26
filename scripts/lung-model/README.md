# Lung model (alveoli)

Builds `public/models/alveoli.glb` and `components/visualizations/alveoli-model-meta.js`. These are the two zoomed-in levels of the respiratory scene: an alveolar duct and sac with its capillary net, and one alveolar septum cut open through a capillary. Every mesh is our own, modelled in Blender. The shapes follow Weibel's lung morphometry and histology texts (Ross & Pawlina). No third-party mesh is used. (`public/models/lung.glb`, the chest-level lungs, is a separate third-party model; see `lib/respiratoryCredits.js`.)

It reuses `scripts/plant-model`: its helpers (`plantlib`), the SDF mesher (from `scripts/arm-model`), the GLB writer (`plant_export.export_to`) and `run_async`.

## Files

| File | What it does |
| --- | --- |
| `acinus.py` | The duct and sac, in 50 µm units. Its parts: <br>• alveoli as spheres, with neighbours sharing one septum (a power-diagram face between their spheres) <br>• walls 6 µm thick <br>• the bronchiole's own wall <br>• the front-right quarter cut away <br>• the capillary net, made from an icosphere's edges kept where an alveolus is exposed, with per-vertex `f` (how far along the capillary) <br>• the arteriole and two venules <br>• Dijkstra flow paths through each net for the red cells |
| `septum.py` | One septum, in µm. Its layers, each its own mesh: type I epithelium, fused basement membrane, endothelium, and the interstitium (thick side) with its collagen and elastin. Also: <br>• two capillaries side by side, the front one opened by the cut at z = 0 <br>• a type II cell with its nucleus and lamellar bodies <br>• an alveolar macrophage <br>• the red cell (Evans & Fung's biconcave disc with a "parachute" shape key) |
| `build_alveoli.py` | `build_acinus`, `build_net`, `build_septum` (all the layers; slow), `build_septum_extras` (just the fibres and the red cell), `export`, and `build_all` |

## Conventions

- **Units and axes:** y up, +z towards the viewer. The acinus is in 50 µm units, with the bronchiole coming down the y axis from y = 10.5. The septum is in µm: the capillary runs along x at y = 0.6, and the cut face is at z = 0.
- **Storage:** as with the other builds, a point (x, y, z) is stored in Blender as (x, −z, y).
- **Blood colour is not baked.** The capillaries and vessels carry `_TUBE.x`, which is 0 where the blood comes in and 1 where it leaves. `alveoli-model.jsx` colours them from the saturation `lib/gasExchange.js` solves at that fraction, so one file shows every altitude, disease and exercise level.
- **The meta lives in `STATE`, filled by `build_net` and `build_septum_extras`.** Reloading `build_alveoli` empties it. After a reload, run those two steps again before calling `export`, or the meta is written empty.

## Running it

In the live Blender (the MCP), the septum layers take about 9 minutes and the acinus about 1 minute. Queue them with `run_async(status_path, fn, col)` and watch the status file.

```
blender --background --python-expr "import sys; sys.path.insert(0, r'<repo>/scripts/lung-model'); import build_alveoli; build_alveoli.build_all(r'<repo>')"
```

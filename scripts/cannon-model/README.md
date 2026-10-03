# Cannon model

Builds `public/models/cannon.glb` and `components/visualizations/cannon-model-meta.js`: the bronze cannon on its oak garrison carriage that the projectile scene fires. Every mesh is our own, modelled in Blender. No third-party mesh is used.

It reuses `scripts/plant-model`'s helpers and GLB writer.

## Files

| File | What it does |
| --- | --- |
| `cannon.py` | The barrel's profile, the carriage's outlines, and the helpers that build them: `lathe` (a surface of revolution about x, y or z), `crisp` (weld, then split every edge sharper than an angle so steps shade crisply), `extrude` (a chamfered slab from an outline, via bmesh) and `grain` (the oak's grain coordinates). Also the meta anchors |
| `build_cannon.py` | `build` (every part into the `Cannon` collection), `export` and `build_all` |

## The model

- **Barrel:** a turned bronze barrel from one lathe profile.
  - From the back, the profile runs: cascabel button, breech, base ring, first and second reinforce, chase astragal, chase, and a muzzle swell. It then turns into the dark bore.
  - It has trunnions with rimbases, a vent with a dark touch-hole, and two dolphins (lifting handles).
- **Carriage:** stepped oak cheeks either side of the barrel, two axletrees and a transom, all chamfered.
- **Iron:** four solid trucks on axle arms, cap squares over the trunnions, and bolt heads on the cheeks.

## Conventions

- **Units:** the projectile scene's own units.
- **Barrel frame:** the trunnion axis is the z axis through the origin and the bore runs along +x. The scene turns it to the launch angle about z and places it at `(0, launchY, 0)`.
- **Carriage frame:** the scene's frame. The trunnions are at `(0, launchY, 0)`, the runway starts at x = 0 and the ground is y = 0.
- **Clearances:**
  - Nothing below the runway's top (y = 0.28) reaches past x = 0.
  - The muzzle clears the deck at 5°, the slider's lowest angle.
  - At 85°, the breech swings down between the cheeks without touching the front axletree.
- **Nodes:**
  - `barrel`: bronze.
  - `wood`: oak, with `_TUBE` carrying grain coordinates (along the grain, two offsets from the log's heart, seed). `cannon-model.jsx` draws the growth rings from these in a fragment shader.
  - `iron`.
- **Colours:** baked sRGB vertex colours.
- **Meta:** `launchY`, `muzzleX`, `boreR`, `cheekOut`, `trunnionR`, `axles`, `truckR`.

## Pitfalls

- **Ball size:** the ball's radius (0.13) sets the bore, so the barrel is stubby: about three calibres long, like a howitzer. Thinning it to a long gun's proportions would not fit the ball.
- **Muzzle against the deck:** the trunnions are only 0.13 above the runway's deck. At 5° a fat muzzle digs into it, which is why the chase thins to the neck before the swell.
- **Smooth shading:** the GLB writer stores one normal per vertex, so smooth shading blurs a step between rings into a gradient. `crisp` splits those edges so each ring shades on its own.

## Running it

```
blender --background --python-expr "import sys; sys.path.insert(0, r'<repo>/scripts/cannon-model'); import build_cannon; build_cannon.build_all(r'<repo>')"
```

It builds in a few seconds, well within an MCP call.

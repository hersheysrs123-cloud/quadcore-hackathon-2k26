# Fleming hand model

Builds `public/models/fleming-hand.glb` and `components/visualizations/fleming-hand-model-meta.js`. This is the human left hand that the motor-effect scene (`MotorEffectScene` in `PhysicsCanvas.jsx`) holds in Fleming's left-hand rule. The mesh is our own, modelled in Blender. No third-party mesh is used.

It reuses `scripts/arm-model`'s hand skeleton (`hand.py`: the bones, joint pivots and posing, traced from Gray's Anatomy) and SDF mesher, and `scripts/plant-model`'s helpers, GLB writer and `run_async`.

## Files

| File | What it does |
| --- | --- |
| `fleming.py` | The pose, the frames, the skin's signed-distance field (fingers, palm, thenar and hypothenar pads, thumb web, wrist and forearm), the vertex colours and the fingertip anchors |
| `build_hand.py` | `build` (mesh, decimate, paint), `paint` (repaint only), `export` and `build_all` |

## Conventions

- **Frame and units:** the skin is meshed straight in the scene's frame and world units, so the scene does not place it.
  - The first finger points along +X (the field B), the thumb along +Y (the force F) and the second finger along +Z (the current I).
  - The forearm runs back along −X. The origin is the first finger's knuckle.
  - `SCALE` is 2.4 scene units per decimetre.
- **Pose:**
  - The first finger is straight.
  - The second finger is bent 88° at its knuckle only.
  - The thumb is stretched out sideways.
  - The ring and little fingers are curled into the palm.
- **Wider palm:** the arm skeleton's rays sit about 3.8 cm apart across the knuckles, which is narrow for a palm seen face-on. This build spreads them (`SPREAD_BASE`, `SPREAD_FAN`) while it poses the hand, then puts `hand.RAYS` back, because the arm build shares the module.
- **Colours:** baked sRGB vertex colours.
  - The palm is paler than the back of the hand.
  - The knuckles are warmer.
  - The joints and palm have flexion creases, and the nails have a lunula and a free edge.
  - The colour's alpha fades the forearm out behind the wrist. The scene's material is transparent for this.
- **Meta:** `anchors.field`, `anchors.current` and `anchors.force` give each digit's tip and pointing direction. The scene starts its B, I and F arrows just past them.
- **Polarity:** when B or I is reversed, the scene turns the whole hand by a half-turn. It never mirrors it, so the hand stays a left hand.

## Pitfalls

- **Nail masks:** a curled finger's tip points back at the wrist. A nail mask bounded only at its base painted a nail-white stripe down the forearm. Every mask is bounded at the tip, and radially as well.
- **Palm-facing colour:** if the palm-facing direction is taken from the nearest bone alone, it jumps where that bone changes and paints seams across the palm. `_palmar_field` blends it over every bone by nearness.

## Running it

It needs Blender 5.x, whose Python ships numpy and OpenVDB.

```
blender --background --python-expr "import sys; sys.path.insert(0, r'<repo>/scripts/hand-model'); import build_hand; build_hand.build_all(r'<repo>')"
```

A build takes about two minutes. From a Blender MCP session, which times out after a minute, use `build_hand.run_async(status_path, build_hand.build_all, repo)` and poll the JSON it writes. After a colour-only change, `build_hand.paint()` then `build_hand.export(repo)` is enough.

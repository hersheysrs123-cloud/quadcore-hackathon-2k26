# Coaster car model

Builds `public/models/coaster-car.glb` and `components/visualizations/coaster-car-model-meta.js`: the four-seat car that runs the roller-coaster scene's loop. Every mesh is our own, modelled in Blender. No third-party mesh is used.

It reuses:

- `scripts/arm-model`'s SDF mesher
- `scripts/plant-model`'s helpers, GLB writer and `run_async`
- `scripts/cannon-model`'s `lathe` and `crisp`

## Files

| File | What it does |
| --- | --- |
| `coaster_car.py` | The fields for the shell, seats, riders and chassis, and their colours. Also the lap-bar sweeps, the wheel lathes, the wheel positions and the meta anchors |
| `build_coaster.py` | `build_shell`, `build_seats`, `build_riders`, `build_chassis`, `build_parts` (lap bars and wheels), `export` and `build_all` |

## The model

- **Shell:** a moulded fibreglass body.
  - Shape: a nose cowl, an open cockpit, a fairing behind the rear row, wheel arches and a swage line along each side.
  - Paint: amber, with a white side stripe that sweeps up the nose, and a dark skirt and cockpit lining.
- **Seats:** upholstered benches with tipped backrests and a headrest per rider.
- **Riders:** four riders, smooth mannequins coloured part by part.
  - The front-left and rear-right riders have both arms up; the others hold the lap bar.
  - Each part is coloured by soft nearest-part weights.
- **Lap bars:** a padded bar across each row on two steel posts.
- **Chassis:** a steel spine and two cross-members. A wheel carrier at each corner holds three wheels against the rail, as a real car's are:
  - a running wheel on top
  - an upstop wheel underneath
  - a guide wheel outside

## Conventions

- **Units and frame:** metres, in the car's frame: x forward, y up, z across.
- **Rails:** the rails' centres are at y = 0, z = ±0.7, with a 0.16 radius, as `RollerCoasterCanvas.jsx` draws them.
- **Bogies:** at x = ±0.95.
- **Track clearances:** the scene's track keeps its ties between the rails and its struts on their inner sides, so the upstop and guide wheels never meet them.
- **Nodes:**
  - Body: `shell`, `seats`, `riders`, `pad`, `steel`.
  - Wheels: `roadWheel` and `upWheel` turn about z; `guideWheel` turns about y. Each is a single wheel centred on the origin.
  - `coaster-car-model.jsx` draws a copy of each wheel at every position in the meta and turns it by distance ÷ radius.
- **Meta:**
  - `floor` and `rows` (seat positions), `seatZ`.
  - `wheels.{road, up, guide}.{r, at}` (radius and positions).
  - `eye`: the ride camera's eye, in the front-right rider's head.

## Pitfalls

- **Slow build:** the full build takes about 25 minutes, almost all of it in `rider_colour`, which evaluates every part's field at every vertex. Use `run_async` and poll the status file. After a colour change to the shell, `pl.paint(shell, cc.shell_colour)` and then `export` is enough.
- **Wheel arches against the cockpit floor:** an arch cut taller than the cockpit floor (y = 0.55) opens a hole into the cockpit beside each bogie.
- **Ride camera:** the camera looks out from inside a rider's head. It does not see the head, because its faces point away from the camera and are culled. If the camera reads the car's position a frame late, it lands behind the head and shows the dark back of the hair. `FollowCamera` must be mounted after the car.

## Running it

```
blender --background --python-expr "import sys; sys.path.insert(0, r'<repo>/scripts/coaster-model'); import build_coaster; build_coaster.build_all(r'<repo>')"
```

From a Blender MCP session, which times out after a minute, use `build_coaster.run_async(status_path, build_coaster.build_all, repo)` and poll the JSON it writes.

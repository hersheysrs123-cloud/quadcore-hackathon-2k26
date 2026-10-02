# Heart bake

Builds `public/models/heart.glb` and `components/visualizations/heart-model-meta.js` for the cardiac-cycle scene from **BodyParts3D**, © The Database Center for Life Science, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The credit and the list of changes shown in the app live in `lib/heartCredits.js`.

## What it does

1. **`bake1.py`** voxelises the scanned heart parts at 1 mm. It:
   - reads the four chamber cavities, the atrial walls, the papillary muscles and the great vessels;
   - checks the voxel volumes against the scan's own figures (for example LV 97.9 vs 97.0 cm³);
   - grows the ventricular walls around the real cavities (LV 10 mm, RV 4 mm, atria 2.5 mm);
   - fills the grooves with epicardial fat (a morphological closing);
   - adds trabeculae.

   It writes signed-distance fields to `bake/`.
2. **`bake2.py`** fits the four-chamber plane through the cavity centroids. It turns the heart so the long axis (apex → AV valves) points up and the right heart sits on the viewer's left, then cuts the tissue field at that plane.
3. **`bake3.mjs`** does the meshing and writes the outputs. It:
   - runs marching cubes on the cut field;
   - bakes the tissue colours and wetness, plus the per-vertex beat weights;
   - hinges each scanned valve leaflet and cusp;
   - finds the papillary tips;
   - snaps the conduction system onto the real inner walls;
   - meshes a ghost of the great vessels in front of the cut;
   - writes the GLB (normals and weights quantised, with `KHR_mesh_quantization`) and the metadata module.

## Running it

It needs Python 3 with numpy and scipy, plus Node with the repo's `three`.

1. In a scratch directory, download `partof_BP3D_4.0_obj_99.zip` (62 MB) and `partof_element_parts.txt` from the [BodyParts3D download page](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html).
2. Unzip the element files each script names (the `FJ…` ids in `bake1.py`) into `obj/`.
3. Run:

   ```
   python <repo>/scripts/heart-bake/bake1.py
   python <repo>/scripts/heart-bake/bake2.py
   node   <repo>/scripts/heart-bake/bake3.mjs
   ```

   `bake1.py` also writes `bake/tissue.npy`. Save it as `bake/tissue_full.f32` (float32) for the ghost pass: `np.load("bake/tissue.npy").astype("float32").tofile("bake/tissue_full.f32")`.

The raw BodyParts3D data is not committed; only the adapted GLB is.

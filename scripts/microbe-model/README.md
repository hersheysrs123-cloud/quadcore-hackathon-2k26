# Microbe model

Builds the models of the bacteria-vs-virus scene: a cut-away E. coli, a T4 bacteriophage and a penicillin G molecule. Every mesh is our own, modelled in Blender from electron micrographs, cryo-EM structures and textbook cut-aways. No third-party mesh is used.

| Output | Scene |
| --- | --- |
| `public/models/microbes.glb` and `components/visualizations/microbe-model-meta.js` (`MICROBE_MODEL`) | Bacteria vs Virus — Anatomy & the Lytic Cycle |

It reuses `scripts/plant-model`: its helpers (`plantlib`), the SDF mesher (from `scripts/arm-model`), the GLB writer (`plant_export.export_to`) and `run_async`.

## The cut-away

The cell's front is removed in terraces, as in a museum model. The wall's window is the widest, then the membrane's, then the cytoplasm's, so each layer shows its own edge.

- **Layers** are signed-distance shells of one capsule (`LAYERS`), each cut by a wedge-and-slab window (`WINDOWS`, `window()`).
- **Cut rims** are painted: the wall's rim shows the outer membrane over the peptidoglycan hatch, and the membrane's shows the bilayer.
- **Decimation** spares the rims (`decimate_keep`): the painted sections need their vertices. Elsewhere a smooth shell decimates hard.
- **The phage's capsid** is sliced at `HEAD_CUT_Z` to show the DNA spool. The spool is fitted inside the capsid with a clearance (`_spool_span`) and keeps only the runs behind the cut.

## Nodes

| Node | What it is |
| --- | --- |
| `wall` | Outer membrane and peptidoglycan, cut away |
| `membrane` | The inner (cell) membrane, cut away less |
| `cytoplasm` | The translucent cytoplasm, cut away least |
| `pili` | Short fimbriae over the surface |
| `flagellaHooks` | Five basal bodies in the wall and their curved hooks. The scene draws the moving filaments from each hook's end (`flagella` in the meta) |
| `nucleoid` | One long supercoiled tube on a ball-of-yarn path, with a plectonemic twist |
| `plasmid` | A small supercoiled ring (the scene places two) |
| `dnaFragment` | A short broken strand, instanced as the phage degrades the chromosome |
| `ribosome` | A 70S ribosome, large and small subunits, instanced by the scene (which tints the hijacked ones) |
| `phageHead` | The elongated icosahedral capsid with hexagonal capsomeres, front sliced off; collar, portal and whiskers |
| `phageDna` | The DNA spool, in concentric layers |
| `phageSheath` | The contractile sheath: 23 helical rings of six subunits |
| `phageCore` | The tail tube inside the sheath |
| `phageBaseplate` | The hexagonal baseplate with short pins |
| `phageFibre` | One beaded long tail fibre, kinked at the knee, from a baseplate corner (the scene places six) |
| `phageLow` | A low-detail whole phage for the progeny |
| `penicillin` | Penicillin G, ball and stick, heavy atoms only, CPK colours |

## Files

| File | What it does |
| --- | --- |
| `microbe.py` | The layout constants, every part's field or surface, and its painting. Also `meta()` |
| `build_microbe.py` | `build_cell`, `build_phage`, `export_microbes` and `build_all` |
| `microbe_preview.py` | Workbench renders of chosen nodes |

## Conventions

- **Units:** scene units, y up.
  - The cell is centred at the origin, its long axis along x; 1 unit is about 0.43 µm.
  - The phage has its baseplate at the origin and its tail up +y. The head is built in that frame; the spool is built about its own centre and the scene moves it to `headCentre` (in the meta).
- **Storage:** as with the other builds, a point (x, y, z) is stored in Blender as (x, −z, y).
- **Colours:** baked sRGB vertex colours.

## Running it

It needs Blender 5.x, whose Python ships numpy and OpenVDB.

```
blender --background --python-expr "import sys; sys.path.insert(0, r'<repo>/scripts/microbe-model'); import build_microbe; build_microbe.build_all(r'<repo>')"
```

A full build takes about thirty seconds. From a Blender MCP session, which times out after a minute, use `build_microbe.run_async(status_path, build_microbe.build_all, repo)` and poll the JSON it writes.

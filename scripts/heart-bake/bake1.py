"""Stage 1 of the heart bake: real BodyParts3D meshes -> signed-distance fields.

Frame: every mesh is moved into the "scene" frame (mm), in which
  +z points out of the four-chamber section plane towards the viewer (anterior),
  +y is superior (projected onto the plane),
  +x = y × z, which is the patient's LEFT (viewer's right in an anterior view).
The section plane is z = 0 and passes through the four cavity centroids.

Outputs (in ./bake):
  meta.json            transform, grid origin/size/spacing, part list
  field.f32            final SDF (cut, hollow, fat added), N^3, x fastest
  f_<name>.f32         helper SDFs sampled per vertex in stage 3
  parts/<id>.json      transformed small meshes (valves, coronaries, papillary tips)
"""
import json, os, glob, math
import numpy as np
from scipy import ndimage

OUT = "bake"
os.makedirs(OUT + "/parts", exist_ok=True)

def load_obj(fid):
    V, F = [], []
    for line in open(f"obj/{fid}.obj", encoding="utf-8", errors="ignore"):
        if line.startswith("v "):
            V.append([float(t) for t in line.split()[1:4]])
        elif line.startswith("f "):
            F.append([int(t.split("/")[0]) - 1 for t in line.split()[1:4]])
    return np.array(V), np.array(F, dtype=np.int64)

CAV = {"lv": "FJ2422", "rv": "FJ2423", "ra": "FJ2424", "la": "FJ2425"}
WALLS = {"la": "FJ2438", "ra": "FJ2439"}
PAPILLARY = {"lvAnterolateral": "FJ2418", "lvLateral": "FJ2429", "rvAnterior": "FJ2419", "rvPosterior": "FJ2430", "rvSeptal": "FJ2437"}
VESSELS = {
    "ascendingAorta": ("FJ3413", "aorta"), "aorticArch": ("FJ3411", "aorta"), "descendingAorta": ("FJ1931", "aorta"),
    "pulmonaryTrunk": ("FJ2966", "pulmonary"), "rightPA": ("FJ3019", "pulmonary"), "leftPA": ("FJ2924", "pulmonary"),
    "svc": ("FJ3645", "vein"), "ivc": ("FJ3441", "vein"),
    "rspv": ("FJ3020", "pvein"), "ripv": ("FJ3040", "pvein"), "lspv": ("FJ2925", "pvein"), "lspv2": ("FJ2933", "pvein"),
    "lipv": ("FJ2944", "pvein"), "lipv2": ("FJ2950", "pvein"), "lipv3": ("FJ2955", "pvein"),
    "brachiocephalic": ("FJ3417", "aorta"), "leftCarotid": ("FJ3483", "aorta"), "leftSubclavian": ("FJ3479", "aorta"), "rightCarotid": ("FJ3564", "aorta"),
}
VALVES = {
    "tricuspid": ["FJ2421", "FJ2433", "FJ2436"],
    "mitral": ["FJ2420", "FJ2432"],
    "aortic": ["FJ2435", "FJ2431", "FJ2426"],
    "pulmonary": ["FJ2417", "FJ2434", "FJ2427"],
}
CORONARY_ARTERIES = sorted({f"FJ{n}" for n in list(range(2631, 2655)) + [2667, 2668, 2670, 2671, 2672, 2673, 2674, 2675, 2676, 2677] + list(range(2692, 2701)) + list(range(2714, 2724)) + [2737]})
CORONARY_VEINS = ["FJ2655", "FJ2656", "FJ2724", "FJ2727", "FJ2728", "FJ2729", "FJ2731"]

# ─── The frame ───────────────────────────────────────────────────────
cav = {k: load_obj(v) for k, v in CAV.items()}
cent = {k: v.mean(axis=0) for k, (v, f) in cav.items()}
P = np.array([cent[k] for k in ["ra", "la", "rv", "lv"]])
origin = P.mean(axis=0)
_, _, vt = np.linalg.svd(P - origin)
n = vt[2]
if n[1] > 0:  # point anterior (body -y)
    n = -n
up = np.array([0.0, 0.0, 1.0])
up = up - n * up.dot(n)
up /= np.linalg.norm(up)
xa = np.cross(up, n)
R_view = np.stack([xa, up, n])  # the four-chamber frame, kept for reference
R = np.eye(3)  # voxelise in body axes; the view rotation is applied after meshing
print("normal", n.round(3), "x", xa.round(3), "angle from frontal", math.degrees(math.acos(-n[1])).__round__(1))

def to_scene(V):
    return (V - origin) @ R.T

# ─── Grid ────────────────────────────────────────────────────────────
H = 1.0
N = 200
all_v = np.concatenate([to_scene(load_obj(f)[0]) for f in list(CAV.values()) + list(WALLS.values()) + [v[0] for v in VESSELS.values()]])
lo = np.percentile(all_v, 0.5, axis=0)
hi = np.percentile(all_v, 99.5, axis=0)
centre = (lo + hi) / 2
# Keep the heart centred; vessels running off the grid are clipped by it.
# Body z is superior: start the grid 15 mm below the lowest cavity point.
cav_lo = min(to_scene(v)[:, 2].min() for v, f in cav.values())
centre[2] = cav_lo - 15 + N * H / 2
g0 = centre - N * H / 2
print("scene extent", lo.round(1), hi.round(1), "grid origin", g0.round(1))

def voxelize(V, F):
    """Occupancy of a closed triangle mesh by majority vote of ray parity along x, y and z."""
    Vg = (to_scene(V) - g0) / H - 0.5  # voxel-centre coordinates
    votes = np.zeros((N, N, N), dtype=np.uint8)  # [z, y, x]
    for axis in range(3):
        a1, a2 = [i for i in range(3) if i != axis]
        cross = {}
        T = Vg[F]
        for tri in T:
            p, q = tri[:, a1], tri[:, a2]
            i0, i1 = int(math.ceil(p.min())), int(math.floor(p.max()))
            j0, j1 = int(math.ceil(q.min())), int(math.floor(q.max()))
            if i1 < i0 or j1 < j0:
                continue
            ii, jj = np.meshgrid(np.arange(i0, i1 + 1), np.arange(j0, j1 + 1), indexing="ij")
            ii = ii.ravel().astype(float); jj = jj.ravel().astype(float)
            (x0, y0), (x1, y1), (x2, y2) = zip(p, q)
            d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
            if abs(d) < 1e-12:
                continue
            l0 = ((y1 - y2) * (ii - x2) + (x2 - x1) * (jj - y2)) / d
            l1 = ((y2 - y0) * (ii - x2) + (x0 - x2) * (jj - y2)) / d
            l2 = 1 - l0 - l1
            ok = (l0 >= 0) & (l1 >= 0) & (l2 >= 0)
            if not ok.any():
                continue
            h = l0 * tri[0, axis] + l1 * tri[1, axis] + l2 * tri[2, axis]
            for a, b, c in zip(ii[ok].astype(int), jj[ok].astype(int), h[ok]):
                cross.setdefault((a, b), []).append(c)
        occ = np.zeros((N, N, N), dtype=bool)
        for (a, b), hs in cross.items():
            if not (0 <= a < N and 0 <= b < N):
                continue
            hs = np.sort(np.array(hs))
            # merge near-duplicates (a ray through a shared edge hits two triangles)
            keep = np.concatenate([[True], np.diff(hs) > 1e-6])
            hs = hs[keep]
            for k in range(0, len(hs) - 1, 2):
                s, e = int(math.ceil(hs[k])), int(math.floor(hs[k + 1]))
                s, e = max(s, 0), min(e, N - 1)
                if e < s:
                    continue
                idx = [0, 0, 0]
                idx[a1] = a; idx[a2] = b
                sl = [None, None, None]
                sl[a1] = a; sl[a2] = b; sl[axis] = slice(s, e + 1)
                # occ is [z, y, x]; sl is in (x, y, z) order
                occ[sl[2], sl[1], sl[0]] = True
        votes += occ
    return votes >= 2

def sdf(occ):
    return (ndimage.distance_transform_edt(~occ) - ndimage.distance_transform_edt(occ)) * H

fields = {}
occ_cav = {}
for k, (V, F) in cav.items():
    occ_cav[k] = voxelize(V, F)
    fields["cav_" + k] = sdf(occ_cav[k]).astype(np.float32)
    print("cavity", k, occ_cav[k].sum() * H**3 / 1000, "cm3")

wall_occ = {k: voxelize(*load_obj(v)) for k, v in WALLS.items()}
pap_occ = np.zeros((N, N, N), bool)
for fid in PAPILLARY.values():
    pap_occ |= voxelize(*load_obj(fid))
vessel_sd = {}
for name, (fid, kind) in VESSELS.items():
    o = voxelize(*load_obj(fid))
    vessel_sd[name] = sdf(o).astype(np.float32)
    print("vessel", name, o.sum() * H**3 / 1000, "cm3")

# ─── Tissue ──────────────────────────────────────────────────────────
# Walls are grown around the REAL blood pools at textbook thicknesses:
# LV ~10 mm, RV ~4 mm (the septum is where the two meet), atria ~2.5 mm
# plus the scanned atrial wall meshes (auricles, venous stubs).
LV_WALL, RV_WALL, ATRIAL_WALL = 10.0, 4.0, 2.5
myo = np.minimum(fields["cav_lv"] - LV_WALL, fields["cav_rv"] - RV_WALL)
# Keep ventricular muscle below the atrioventricular junction: above the
# atrial blood pools it would bury the atria in 10 mm of muscle.
above_atria = np.minimum(fields["cav_la"], fields["cav_ra"]) < np.minimum(fields["cav_lv"], fields["cav_rv"]) - 2
myo[above_atria] = np.maximum(myo[above_atria], np.minimum(fields["cav_la"], fields["cav_ra"])[above_atria] - ATRIAL_WALL)
atria = np.minimum(fields["cav_la"], fields["cav_ra"]) - ATRIAL_WALL
atria = np.minimum(atria, sdf(wall_occ["la"] | wall_occ["ra"]))
VNAMES = list(VESSELS)
vstack = np.stack([vessel_sd[k] for k in VNAMES])
vessel_outer = vstack.min(axis=0)
vessel_label = vstack.argmin(axis=0).astype(np.uint8)
del vstack
solid = np.minimum(np.minimum(myo, atria), vessel_outer)
solid = np.minimum(solid, sdf(pap_occ))

hollow = np.min(np.stack([fields["cav_" + k] for k in CAV]), axis=0)
# Vessel lumens: the vessel less its wall; arteries ~2 mm, veins ~1.2 mm.
lumens = []
for name, (fid, kind) in VESSELS.items():
    lumens.append(vessel_sd[name] + (2.0 if kind in ("aorta", "pulmonary") else 1.2))
hollow = np.minimum(hollow, np.min(np.stack(lumens), axis=0))
# Papillary muscles stand inside the cavities.
hollow = np.maximum(hollow, -sdf(pap_occ))

# Trabeculae carneae: ridged lining low in the ventricles.
zz, yy, xx = np.meshgrid(*(g0[i] + (np.arange(N) + 0.5) * H for i in (2, 1, 0)), indexing="ij")
vent = np.minimum(fields["cav_lv"], fields["cav_rv"])
near = np.abs(vent) < 3
ridge = 0.9 * np.sin(0.55 * xx + 0.2 * yy) * np.sin(0.47 * yy - 0.3 * zz + 1.3)
apical = np.clip((0 - zz) / 40.0 + 0.3, 0, 1)
hollow = np.where(near & (vent <= hollow + 1e-6), hollow + ridge * apical, hollow)

tissue = np.maximum(solid, -hollow)
tissue = ndimage.gaussian_filter(tissue, 0.8)

# Epicardial fat fills the grooves: a morphological closing of the outer
# surface (radius ~4 mm) adds material only where the surface is concave.
outer_occ = solid < 0
r = 4.0
dil = ndimage.distance_transform_edt(~outer_occ) * H <= r
closed = ndimage.distance_transform_edt(dil) * H > r
fat_occ = closed & ~outer_occ & (hollow > 0)
fat_sd = sdf(fat_occ)
fields["fat"] = fat_sd
tissue = np.minimum(tissue, ndimage.gaussian_filter(fat_sd, 1.0))
fields["solid"] = solid
fields["hollow"] = hollow
fields["myo"] = myo
fields["vessel_outer"] = vessel_outer
vessel_label.tofile(f"{OUT}/vessel_label.u8")

np.save(f"{OUT}/tissue.npy", tissue.astype(np.float32))
for k, f in fields.items():
    f.astype(np.float32).tofile(f"{OUT}/f_{k}.f32")

# ─── Small meshes, carried over as they are ─────────────────────────
def dump(pid, fids):
    Vs, Fs, off = [], [], 0
    for fid in fids:
        V, F = load_obj(fid)
        Vs.append(to_scene(V)); Fs.append(F + off); off += len(V)
    V = np.concatenate(Vs); F = np.concatenate(Fs)
    json.dump({"v": V.round(3).ravel().tolist(), "f": F.ravel().tolist()}, open(f"{OUT}/parts/{pid}.json", "w"))
for vname, fids in VALVES.items():
    for i, fid in enumerate(fids):
        dump(f"valve_{vname}_{i}", [fid])
for name, fid in PAPILLARY.items():
    dump(f"pap_{name}", [fid])
dump("coronaryArteries", CORONARY_ARTERIES)
dump("coronaryVeins", CORONARY_VEINS)

json.dump({
    "origin_body_mm": origin.tolist(), "R_view": R_view.tolist(), "grid_origin": g0.tolist(), "N": N, "H": H,
    "centroids": {k: to_scene(cent[k][None])[0].tolist() for k in cent},
    "vessels": {k: v[1] for k, v in VESSELS.items()}, "vessel_order": VNAMES,
    "valves": VALVES,
}, open(f"{OUT}/meta.json", "w"), indent=1)
print("done")

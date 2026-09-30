"""Stage 2: pick the section plane and the view frame, cut the tissue field.

The plane is the four-chamber plane (best fit through the four cavity
centroids). In it, "up" is the heart's long axis (apex -> AV valves), so the
atria sit above the ventricles like an atlas plate; the camera looks from
the anterior side, so the patient's right heart is on the viewer's left.
"""
import json, sys
import numpy as np

B = "bake"
meta = json.load(open(f"{B}/meta.json"))
N, H = meta["N"], meta["H"]
g0 = np.array(meta["grid_origin"])
tissue = np.load(f"{B}/tissue.npy")

def load_part(pid):
    d = json.load(open(f"{B}/parts/{pid}.json"))
    return np.array(d["v"]).reshape(-1, 3)

cent = {k: np.array(v) for k, v in meta["centroids"].items()}
P = np.stack([cent[k] for k in ["ra", "la", "rv", "lv"]])
o = P.mean(axis=0)
_, _, vt = np.linalg.svd(P - o)
n = vt[2]
if n[1] > 0:  # face anterior (body -y)
    n = -n

# Long axis: LV apex -> the middle of the mitral and tricuspid valves.
lv = np.fromfile(f"{B}/f_cav_lv.f32", dtype=np.float32).reshape(N, N, N)
zz, yy, xx = np.nonzero(lv < 0)
pts = np.stack([xx, yy, zz], axis=1) * H + g0 + H / 2
base = np.concatenate([load_part("valve_mitral_0"), load_part("valve_mitral_1"), load_part("valve_tricuspid_0"), load_part("valve_tricuspid_1"), load_part("valve_tricuspid_2")]).mean(axis=0)
apex = pts[np.argmax(np.linalg.norm(pts - base, axis=1))]
up = base - apex
up -= n * up.dot(n)
up /= np.linalg.norm(up)
x = np.cross(up, n)
R = np.stack([x, up, n])
ra_x = (cent["ra"] - o) @ x
print("normal", n.round(3), "up", up.round(3), "RA on the viewer's", "left" if ra_x < 0 else "RIGHT", "| long axis", round(float(np.linalg.norm(base - apex)), 1), "mm")

# Section offset along n (mm): 0 goes through the centroids.
offset = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
Z, Y, X = np.meshgrid(*(g0[i] + (np.arange(N) + 0.5) * H for i in (2, 1, 0)), indexing="ij")
depth = (X - o[0]) * n[0] + (Y - o[1]) * n[1] + (Z - o[2]) * n[2] - offset
field = np.maximum(tissue, depth)
field.astype(np.float32).tofile(f"{B}/field.f32")
json.dump({"n": n.tolist(), "up": up.tolist(), "x": x.tolist(), "R": R.tolist(), "o": o.tolist(), "offset": offset, "apex": apex.tolist(), "base": base.tolist()}, open(f"{B}/frame.json", "w"), indent=1)
print("field written")

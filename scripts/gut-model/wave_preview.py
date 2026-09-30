"""Pose the oesophagus in Blender the way the scene's vertex shader does,
for a bolus at a given station, so the wave can be checked by eye.

A straight port of lib/peristalsis.js (transitAt's positions, waveFeatures,
layerActivation) and lib/tubeTransit.js (profileRadius), and of the vertex
shader in components/visualizations/gut-model.jsx.

    wave_preview.pose(obj, bolus_cm=10.0)   # writes a "wave" shape key
"""

import math

import numpy as np

import plantlib as pl

LAG, LEAD = 2.4, 2.6
C_WIDTH, R_WIDTH = 1.4, 2.2
C_DEPTH, R_DILATION = 0.78, 0.28
FLOOR = 0.12


def profile(s, bolus, bolus_bulge=0.0):
    constriction = bolus - LAG
    relaxation = bolus + LEAD
    scale = 1.0
    scale -= C_DEPTH * np.exp(-(((s - constriction) / C_WIDTH) ** 2))
    scale += R_DILATION * np.exp(-(((s - relaxation) / R_WIDTH) ** 2))
    scale += bolus_bulge * np.exp(-(((s - bolus) / 1.0) ** 2))
    L = np.maximum(FLOOR, scale)
    circ = np.exp(-(((s - constriction) / C_WIDTH) ** 2))
    lon = np.exp(-(((s - relaxation) / R_WIDTH) ** 2))
    shift = 0.22 * lon * (relaxation - s)
    return L, circ, lon, shift


def pose(obj, bolus_cm=10.0, bolus_bulge=0.0):
    tube = pl.get_attr(obj, "tube")
    P = pl.verts(obj)
    s, w, fo = tube[:, 0], tube[:, 1], tube[:, 2]
    L, circ, lon, shift = profile(s, bolus_cm, bolus_bulge)
    theta = np.arctan2(P[:, 0], P[:, 2])
    fold_amt = (1 - np.clip((L - 0.95) / 0.45, 0, 1) ** 2 * (3 - 2 * np.clip((L - 0.95) / 0.45, 0, 1))) * L
    thick = 1 + 0.45 * circ - 0.22 * np.clip(L - 1, 0, 0.8)
    r = L + fo * fold_amt + w * thick
    Q = np.stack([r * np.sin(theta), -(s + shift), r * np.cos(theta)], axis=1)
    if obj.data.shape_keys is None:
        obj.shape_key_add(name="Basis")
    k = obj.data.shape_keys.key_blocks.get("wave") or obj.shape_key_add(name="wave")
    k.data.foreach_set("co", pl.to_blender(Q).ravel())
    k.value = 1.0
    # colour by layer, flushed where each muscle layer contracts
    wf = w / 0.9
    base = np.array([[0.93, 0.7, 0.72], [0.85, 0.53, 0.56], [0.95, 0.88, 0.79], [0.62, 0.24, 0.28], [0.7, 0.33, 0.38], [0.92, 0.86, 0.8]])
    edges = [0, 0.07, 0.2, 0.44, 0.73, 0.985]
    idx = np.clip(np.searchsorted(edges, wf, side="right") - 1, 0, 5)
    col = base[idx]
    rose = np.array([1.0, 0.35, 0.43])
    amber = np.array([0.98, 0.75, 0.14])
    m = idx == 3
    col[m] = col[m] * (1 - circ[m, None]) + rose * circ[m, None]
    m = idx >= 4
    col[m] = col[m] * (1 - 0.75 * lon[m, None]) + amber * 0.75 * lon[m, None]
    pl.set_attr(obj, "col", np.concatenate([col, np.ones((len(col), 1))], axis=1))
    return k

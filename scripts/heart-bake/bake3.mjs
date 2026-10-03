// Stage 3: mesh the cut tissue field, bake colours and beat weights, write
// public/models/heart.glb and components/visualizations/heart-model-meta.js.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Run from a working directory that holds bake/ (stages 1–2); outputs go into the repo.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const THREE = await import(pathToFileURL(`${REPO}/node_modules/three/build/three.module.js`).href);
const { MarchingCubes } = await import(pathToFileURL(`${REPO}/node_modules/three/examples/jsm/objects/MarchingCubes.js`).href);
const { mergeVertices } = await import(pathToFileURL(`${REPO}/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js`).href);

const B = "bake";
const meta = JSON.parse(fs.readFileSync(`${B}/meta.json`, "utf8"));
const frame = JSON.parse(fs.readFileSync(`${B}/frame.json`, "utf8"));
const { N, H } = meta;
const g0 = meta.grid_origin;
const SCALE = 0.05; // world units per mm (the heart is ~5.5 units across)
const STEP = Number(process.argv[2] || 1); // marching-cubes cell = STEP voxels

const readGrid = (name) => new Float32Array(fs.readFileSync(`${B}/${name}`).buffer.slice(0));
const field = readGrid("field.f32");
const F = {};
for (const k of ["cav_lv", "cav_rv", "cav_ra", "cav_la", "fat", "hollow", "myo", "solid", "vessel_outer"]) F[k] = readGrid(`f_${k}.f32`);
const vesselLabel = new Uint8Array(fs.readFileSync(`${B}/vessel_label.u8`));
const VNAMES = meta.vessel_order;

/** Trilinear sample of an N³ grid at body-frame mm (relative to the origin). */
function sample(g, p) {
  const fx = (p[0] - g0[0]) / H - 0.5, fy = (p[1] - g0[1]) / H - 0.5, fz = (p[2] - g0[2]) / H - 0.5;
  const x0 = Math.max(0, Math.min(N - 2, Math.floor(fx))), y0 = Math.max(0, Math.min(N - 2, Math.floor(fy))), z0 = Math.max(0, Math.min(N - 2, Math.floor(fz)));
  const tx = Math.min(1, Math.max(0, fx - x0)), ty = Math.min(1, Math.max(0, fy - y0)), tz = Math.min(1, Math.max(0, fz - z0));
  const at = (x, y, z) => g[(z * N + y) * N + x];
  const c00 = at(x0, y0, z0) * (1 - tx) + at(x0 + 1, y0, z0) * tx;
  const c10 = at(x0, y0 + 1, z0) * (1 - tx) + at(x0 + 1, y0 + 1, z0) * tx;
  const c01 = at(x0, y0, z0 + 1) * (1 - tx) + at(x0 + 1, y0, z0 + 1) * tx;
  const c11 = at(x0, y0 + 1, z0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1, z0 + 1) * tx;
  return (c00 * (1 - ty) + c10 * ty) * (1 - tz) + (c01 * (1 - ty) + c11 * ty) * tz;
}
const nearestLabel = (p) => {
  const x = Math.round((p[0] - g0[0]) / H - 0.5), y = Math.round((p[1] - g0[1]) / H - 0.5), z = Math.round((p[2] - g0[2]) / H - 0.5);
  if (x < 0 || y < 0 || z < 0 || x >= N || y >= N || z >= N) return 0;
  return vesselLabel[(z * N + y) * N + x];
};

// Body mm → scene units: rotate into the view frame (z = depth past the cut).
const R = frame.R, o = frame.o, off = frame.offset;
const toScene = (p) => {
  const d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
  return [(R[0][0] * d[0] + R[0][1] * d[1] + R[0][2] * d[2]) * SCALE, (R[1][0] * d[0] + R[1][1] * d[1] + R[1][2] * d[2]) * SCALE, (R[2][0] * d[0] + R[2][1] * d[1] + R[2][2] * d[2] - off) * SCALE];
};
const dirToScene = (d) => [R[0][0] * d[0] + R[0][1] * d[1] + R[0][2] * d[2], R[1][0] * d[0] + R[1][1] * d[1] + R[1][2] * d[2], R[2][0] * d[0] + R[2][1] * d[1] + R[2][2] * d[2]];

// ─── Marching cubes ─────────────────────────────────────────────────
const M = Math.floor(N / STEP);
const scratch = new THREE.MeshBasicMaterial();
const mc = new MarchingCubes(M, scratch, false, false, 2_000_000);
mc.isolation = 0;
for (let z = 0; z < M; z += 1) for (let y = 0; y < M; y += 1) for (let x = 0; x < M; x += 1) {
  const p = [g0[0] + (x * STEP + STEP / 2) * H, g0[1] + (y * STEP + STEP / 2) * H, g0[2] + (z * STEP + STEP / 2) * H];
  mc.field[(z * M + y) * M + x] = -(STEP === 1 ? field[(z * N + y) * N + x] : sample(field, p));
}
// Close the box: nothing on the outermost shell.
for (let a = 0; a < M; a += 1) for (let b = 0; b < M; b += 1) for (const [x, y, z] of [[0, a, b], [M - 1, a, b], [a, 0, b], [a, M - 1, b], [a, b, 0], [a, b, M - 1]]) mc.field[(z * M + y) * M + x] = -5;
mc.update();
const count = mc.count;
const raw = new THREE.BufferGeometry();
const pos = new Float32Array(count * 3);
// MC positions are in [-1, 1] over the grid; back to body mm.
for (let i = 0; i < count; i += 1) for (let k = 0; k < 3; k += 1) pos[i * 3 + k] = g0[k] + ((mc.positionArray[i * 3 + k] + 1) * M / 2) * STEP * H;
raw.setAttribute("position", new THREE.BufferAttribute(pos, 3));
const geo = mergeVertices(raw, 1e-4);
geo.computeVertexNormals();
const nv = geo.attributes.position.count;
console.log("marching cubes", M, "cells →", nv, "vertices,", geo.index.count / 3, "triangles");

// ─── Colours and weights ────────────────────────────────────────────
const C = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const TISSUE = {
  cutMuscle: C("#7d2a24"), cutAtrial: C("#8e3a31"), cutFat: C("#e2c07a"), cutArtery: C("#e8cdb8"), cutVein: C("#9a8298"),
  endoLeft: C("#b8564d"), endoRight: C("#9a4e58"), intimaArtery: C("#e9c4b4"), intimaPulm: C("#d9b8bf"), intimaVein: C("#8c6f8c"),
  epicardium: C("#96352f"), fat: C("#e5c27c"), aorta: C("#e3b39c"), pulmonary: C("#cda3a8"), vein: C("#5f4467"), pvein: C("#b7685f"),
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };

const posB = geo.attributes.position.array;
const nrmB = geo.attributes.normal.array;
const colours = new Uint8Array(nv * 4);
const beat = new Float32Array(nv * 8);
const posS = new Float32Array(nv * 3);
const nrmS = new Float32Array(nv * 3);
const cav = ["cav_lv", "cav_rv", "cav_la", "cav_ra"];
const ZONE = { cav_lv: [11, 17], cav_rv: [5, 10], cav_la: [3.5, 8], cav_ra: [3.5, 8] };
const apex = toScene(frame.apex), base = toScene(frame.base);
const axis = [base[0] - apex[0], base[1] - apex[1], 0];
const axisLen = Math.hypot(axis[0], axis[1]);
axis[0] /= axisLen; axis[1] /= axisLen;

for (let i = 0; i < nv; i += 1) {
  const p = [posB[i * 3], posB[i * 3 + 1], posB[i * 3 + 2]];
  const nb = [nrmB[i * 3], nrmB[i * 3 + 1], nrmB[i * 3 + 2]];
  const s = toScene(p);
  const ns = dirToScene(nb);
  posS.set(s, i * 3);
  nrmS.set(ns, i * 3);
  const depth = s[2] / SCALE;
  const onCut = Math.abs(depth) < 0.45 && ns[2] > 0.5;
  const d = Object.fromEntries(cav.map((k) => [k, sample(F[k], p)]));
  const hollow = sample(F.hollow, p);
  const fat = sample(F.fat, p);
  const vOuter = sample(F.vessel_outer, p);
  const myo = sample(F.myo, p);
  const vKind = meta.vessels[VNAMES[nearestLabel(p)]];
  const nearestCav = cav.reduce((a, b) => (d[a] < d[b] ? a : b));
  const isVessel = vOuter < myo - 1 && vOuter < Math.min(d.cav_la, d.cav_ra) - 1;
  let c;
  if (onCut) {
    if (fat < 0.3) c = TISSUE.cutFat;
    else if (isVessel) c = vKind === "vein" ? TISSUE.cutVein : TISSUE.cutArtery;
    else if (nearestCav === "cav_la" || nearestCav === "cav_ra") c = TISSUE.cutAtrial;
    else c = TISSUE.cutMuscle;
    // Subendocardium a touch paler, like fresh cut muscle.
    c = mix(c, TISSUE.endoLeft, 0.18 * (1 - sm(0.5, 3, Math.abs(hollow))));
  } else if (hollow < 1.2) {
    // Inside a chamber or vessel.
    const inCavity = d[nearestCav] < 1.5;
    if (inCavity) c = nearestCav === "cav_lv" || nearestCav === "cav_la" ? TISSUE.endoLeft : TISSUE.endoRight;
    else c = vKind === "vein" ? TISSUE.intimaVein : vKind === "pulmonary" ? TISSUE.intimaPulm : vKind === "pvein" ? TISSUE.endoLeft : TISSUE.intimaArtery;
  } else if (fat < 0.4) {
    c = TISSUE.fat;
  } else if (isVessel) {
    c = vKind === "aorta" ? TISSUE.aorta : vKind === "pulmonary" ? TISSUE.pulmonary : vKind === "vein" ? TISSUE.vein : TISSUE.pvein;
  } else {
    // Epicardium; a thin film of fat thins out over the muscle near the grooves.
    c = mix(TISSUE.epicardium, TISSUE.fat, 0.35 * (1 - sm(0.4, 4, fat)));
  }
  const mottle = 0.93 + 0.07 * hash(Math.round(p[0] * 1.3), Math.round(p[1] * 1.3), Math.round(p[2] * 1.3)) + 0.04 * Math.sin(p[0] * 0.9 + p[2] * 0.7) * Math.sin(p[1] * 0.8);
  colours[i * 4] = Math.round(Math.min(1, c[0] * mottle) * 255);
  colours[i * 4 + 1] = Math.round(Math.min(1, c[1] * mottle) * 255);
  colours[i * 4 + 2] = Math.round(Math.min(1, c[2] * mottle) * 255);
  // Wetness in alpha: the cut face is duller than the glistening linings and epicardium.
  colours[i * 4 + 3] = onCut ? 90 : hollow < 1.2 ? 255 : 210;

  // Beat weights: lv, rv, la, ra, descent, lvDepth (hypertrophy), vessel, spare.
  const w = cav.map((k) => (1 - sm(ZONE[k][0], ZONE[k][1], d[k])) * (isVessel ? 0.15 : 1));
  const along = (s[0] - apex[0]) * axis[0] + (s[1] - apex[1]) * axis[1];
  const baseAlong = axisLen;
  let descent = along <= baseAlong ? Math.min(1, Math.max(0, along / baseAlong)) : 1 - sm(0, 2.2, (along - baseAlong));
  if (isVessel) descent *= 1 - sm(0, 1.5, along - baseAlong);
  const lvDepth = Math.min(1, Math.max(0, d.cav_lv / 10)) * w[0] * (along <= baseAlong ? 1 : 0);
  beat.set([w[0], w[1], w[2], w[3], descent, lvDepth, isVessel ? 1 : 0, 0], i * 8);
}

// ─── Small parts ────────────────────────────────────────────────────
function loadPart(pid) {
  const d = JSON.parse(fs.readFileSync(`${B}/parts/${pid}.json`, "utf8"));
  const v = new Float32Array(d.v.length);
  for (let i = 0; i < d.v.length; i += 3) v.set(toScene([d.v[i], d.v[i + 1], d.v[i + 2]]), i);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(v, 3));
  g.setIndex(d.f);
  const m = mergeVertices(g, 1e-4);
  m.computeVertexNormals();
  return m;
}
const centroid = (g) => { const a = g.attributes.position.array; const c = [0, 0, 0]; for (let i = 0; i < a.length; i += 3) { c[0] += a[i]; c[1] += a[i + 1]; c[2] += a[i + 2]; } return c.map((v) => v / (a.length / 3)); };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crossV = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };

const chamberCentre = Object.fromEntries(Object.entries(meta.centroids).map(([k, v]) => [k, toScene(v)]));
const vesselCentre = {};
for (const name of VNAMES) {
  // Centroid of the grid cells labelled as this vessel and inside it.
  let c = [0, 0, 0], k = 0;
  const idx = VNAMES.indexOf(name);
  for (let z = 0; z < N; z += 2) for (let y = 0; y < N; y += 2) for (let x = 0; x < N; x += 2) {
    const j = (z * N + y) * N + x;
    if (vesselLabel[j] === idx && F.vessel_outer[j] < 0) { c[0] += g0[0] + (x + 0.5) * H; c[1] += g0[1] + (y + 0.5) * H; c[2] += g0[2] + (z + 0.5) * H; k += 1; }
  }
  vesselCentre[name] = toScene(c.map((v) => v / k));
}
const FLOW = {
  tricuspid: [chamberCentre.ra, chamberCentre.rv],
  mitral: [chamberCentre.la, chamberCentre.lv],
  aortic: [chamberCentre.lv, vesselCentre.ascendingAorta],
  pulmonary: [chamberCentre.rv, vesselCentre.pulmonaryTrunk],
};
const valves = {};
const leafletGeos = {};
for (const [name, fids] of Object.entries(meta.valves)) {
  const geos = fids.map((_, i) => loadPart(`valve_${name}_${i}`));
  const all = geos.map(centroid);
  const C0 = [0, 1, 2].map((k) => all.reduce((s, c) => s + c[k], 0) / all.length);
  const dFlow = norm(sub(FLOW[name][1], FLOW[name][0]));
  const leaflets = geos.map((g, i) => {
    const L = centroid(g);
    let r = sub(L, C0);
    r = norm(sub(r, dFlow.map((v) => v * dot(r, dFlow))));
    // Hinge: the leaflet's attached rim — its points furthest out along r.
    const a = g.attributes.position.array;
    let far = -Infinity;
    for (let j = 0; j < a.length; j += 3) far = Math.max(far, dot(sub([a[j], a[j + 1], a[j + 2]], C0), r));
    const hinge = [C0[0] + r[0] * far, C0[1] + r[1] * far, C0[2] + r[2] * far];
    // Free edge: the points nearest the valve's axis, for the chordae.
    const edge = [];
    for (let j = 0; j < a.length; j += 3) { const q = [a[j], a[j + 1], a[j + 2]]; edge.push([dot(sub(q, C0), r), q]); }
    edge.sort((u, v) => u[0] - v[0]);
    const tips = [0.02, 0.12, 0.25].map((f) => edge[Math.floor(f * edge.length)][1]);
    leafletGeos[`${name}_${i}`] = g;
    return { hinge, axis: norm(crossV(dFlow, r)), edge: tips };
  });
  const radius = Math.max(...leaflets.map((l) => Math.hypot(...sub(l.hinge, C0))));
  valves[name] = { centre: C0, flow: dFlow, radius, leaflets };
}
const papillary = {};
for (const pid of ["lvAnterolateral", "lvLateral", "rvAnterior", "rvPosterior", "rvSeptal"]) {
  const g = loadPart(`pap_${pid}`);
  const valve = pid.startsWith("lv") ? "mitral" : "tricuspid";
  const vc = valves[valve].centre;
  const a = g.attributes.position.array;
  let best = null, bd = Infinity;
  for (let j = 0; j < a.length; j += 3) { const q = [a[j], a[j + 1], a[j + 2]]; const dd = Math.hypot(...sub(q, vc)); if (dd < bd) { bd = dd; best = q; } }
  papillary[pid] = { tip: best, valve };
}
const GM = Math.floor(N / 2);
const gmc = new MarchingCubes(GM, scratch, false, false, 1_000_000);
gmc.isolation = 0;
for (let z = 0; z < GM; z += 1) for (let y = 0; y < GM; y += 1) for (let x = 0; x < GM; x += 1) {
  const p = [g0[0] + (x * 2 + 1) * H, g0[1] + (y * 2 + 1) * H, g0[2] + (z * 2 + 1) * H];
  const sc = toScene(p);
  // Only the great vessels and their roots (the outflow tracts), and only
  // in front of the cut: the ventricular wall in front would veil the section.
  const vessels = sample(F.vessel_outer, p);
  gmc.field[(z * GM + y) * GM + x] = -Math.max(vessels, -sc[2] / SCALE + 0.5);
}
for (let a = 0; a < GM; a += 1) for (let b = 0; b < GM; b += 1) for (const [x, y, z] of [[0, a, b], [GM - 1, a, b], [a, 0, b], [a, GM - 1, b], [a, b, 0], [a, b, GM - 1]]) gmc.field[(z * GM + y) * GM + x] = -5;
gmc.update();
const gpos = new Float32Array(gmc.count * 3);
for (let i = 0; i < gmc.count; i += 1) {
  const p = [0, 1, 2].map((k) => g0[k] + ((gmc.positionArray[i * 3 + k] + 1) * GM / 2) * 2 * H);
  gpos.set(toScene(p), i * 3);
}
const graw = new THREE.BufferGeometry();
graw.setAttribute("position", new THREE.BufferAttribute(gpos, 3));
const ghost = mergeVertices(graw, 1e-4);
ghost.computeVertexNormals();
console.log("ghost", ghost.attributes.position.count, "vertices");

const coronaryArteries = loadPart("coronaryArteries");
const coronaryVeins = loadPart("coronaryVeins");

// ─── The conduction system, snapped onto the real walls ─────────────
const toBody = (s) => {
  const d = [s[0] / SCALE, s[1] / SCALE, s[2] / SCALE + off];
  return [o[0] + R[0][0] * d[0] + R[1][0] * d[1] + R[2][0] * d[2], o[1] + R[0][1] * d[0] + R[1][1] * d[1] + R[2][1] * d[2], o[2] + R[0][2] * d[0] + R[1][2] * d[1] + R[2][2] * d[2]];
};
/** Walk a scene-space point onto the tissue surface, then lift it `lift` mm into the open side. */
function snap(sp, lift = 0.7) {
  let p = toBody(sp);
  for (let it = 0; it < 40; it += 1) {
    const e = 0.5;
    const d = sample(field, p);
    const g = [sample(field, [p[0] + e, p[1], p[2]]) - sample(field, [p[0] - e, p[1], p[2]]), sample(field, [p[0], p[1] + e, p[2]]) - sample(field, [p[0], p[1] - e, p[2]]), sample(field, [p[0], p[1], p[2] + e]) - sample(field, [p[0], p[1], p[2] - e])];
    const gl = Math.hypot(...g) || 1;
    const step = d - lift;
    p = [p[0] - (g[0] / gl) * step, p[1] - (g[1] / gl) * step, p[2] - (g[2] / gl) * step];
    if (Math.abs(step) < 0.05) break;
  }
  return toScene(p);
}
/** March out from a chamber's centre through its REAL cavity to the wall, then snap onto it. */
const onWall = (ch, deg, frac = 0.95, z = -0.22) => {
  const c = chamberCentre[ch];
  const t = (deg * Math.PI) / 180;
  const dir = [Math.cos(t), Math.sin(t)];
  let last = [c[0], c[1], z];
  for (let r = 0; r < 4; r += 0.01) {
    const q = [c[0] + dir[0] * r, c[1] + dir[1] * r, z];
    if (sample(F["cav_" + ch], toBody(q)) > -0.8) break;
    last = q;
  }
  return snap(last);
};
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const tri = valves.tricuspid.centre;
const toLV = norm(sub(chamberCentre.lv, chamberCentre.rv));
const upV = [0, 1, 0];
const avNode = snap([tri[0] + toLV[0] * 0.55 + upV[0] * 0.25, tri[1] + toLV[1] * 0.55 + 0.25, -0.3]);
const crest = snap([(chamberCentre.rv[0] + chamberCentre.lv[0]) / 2, Math.max(chamberCentre.rv[1], chamberCentre.lv[1]) + 0.45, -0.3]);
const saNode = onWall("ra", 128, 0.97);
const rvPap = papillary.rvAnterior.tip;
const conduction = {
  sa: saNode,
  av: avNode,
  paths: {
    atria: [saNode, onWall("ra", 160), onWall("ra", 200), onWall("ra", 240), onWall("ra", 280, 0.9), avNode],
    bachmann: [saNode, onWall("ra", 95), snap(lerp3(chamberCentre.ra, chamberCentre.la, 0.5).map((v, i) => (i === 1 ? v + 0.9 : i === 2 ? -0.35 : v))), onWall("la", 90), onWall("la", 45)],
    his: [avNode, snap(lerp3(avNode, crest, 0.5)), crest],
    leftBranch: [crest, onWall("lv", 175), onWall("lv", 205), onWall("lv", 235), onWall("lv", 265, 0.9), onWall("lv", 300), onWall("lv", 335), onWall("lv", 5), onWall("lv", 30)],
    rightBranch: [crest, onWall("rv", 0), onWall("rv", -30), snap(lerp3(onWall("rv", -30), rvPap, 0.5)), snap(rvPap, 0.4), onWall("rv", 200), onWall("rv", 160)],
    rightApical: [onWall("rv", -30), onWall("rv", -70), onWall("rv", -110), onWall("rv", -150)],
  },
  seats: Array.from({ length: 32 }, (_, i) => {
    const ch = i % 2 ? "lv" : "rv";
    const t = (hash(i, 3, 7) * 360);
    return onWall(ch, t, 0.9 + 0.08 * hash(i, 5, 1), -0.12 - 0.35 * hash(i, 9, 2));
  }),
};

// ─── GLB ────────────────────────────────────────────────────────────
const chunks = [];
let byteLength = 0;
const bufferViews = [], accessors = [];
function addAccessor(array, type, componentType, { normalized = false, target, minmax = false } = {}) {
  const pad = (4 - (byteLength % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); byteLength += pad; }
  const buf = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: buf.length, ...(target ? { target } : {}) });
  chunks.push(buf); byteLength += buf.length;
  const comps = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type];
  const acc = { bufferView: bufferViews.length - 1, componentType, count: array.length / comps, type, ...(normalized ? { normalized: true } : {}) };
  if (minmax) {
    const mn = Array(comps).fill(Infinity), mx = Array(comps).fill(-Infinity);
    for (let i = 0; i < array.length; i += 1) { const k = i % comps; mn[k] = Math.min(mn[k], array[i]); mx[k] = Math.max(mx[k], array[i]); }
    acc.min = mn; acc.max = mx;
  }
  accessors.push(acc);
  return accessors.length - 1;
}
const FLOAT = 5126, UBYTE = 5121, UINT = 5125, BYTE = 5120;
const toU8 = (f) => { const q = new Uint8Array(f.length); for (let i = 0; i < f.length; i += 1) q[i] = Math.round(Math.max(0, Math.min(1, f[i])) * 255); return q; };
// Normals are 4-byte aligned per vertex: pad VEC3 bytes out to VEC4.
const normals4 = (f) => { const n = f.length / 3; const q = new Int8Array(n * 4); for (let i = 0; i < n; i += 1) { q[i * 4] = Math.round(f[i * 3] * 127); q[i * 4 + 1] = Math.round(f[i * 3 + 1] * 127); q[i * 4 + 2] = Math.round(f[i * 3 + 2] * 127); } return q; };
const meshes = [], nodes = [];
/** Byte normals: a VEC3 accessor over a 4-byte-stride view (KHR_mesh_quantization). */
function addNormals(f) {
  const q = normals4(f);
  const pad = (4 - (byteLength % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); byteLength += pad; }
  const buf = Buffer.from(q.buffer);
  bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: buf.length, byteStride: 4, target: 34962 });
  chunks.push(buf); byteLength += buf.length;
  accessors.push({ bufferView: bufferViews.length - 1, componentType: BYTE, normalized: true, count: f.length / 3, type: "VEC3" });
  return accessors.length - 1;
}
function addMesh(name, geo, extra = {}) {
  const attributes = {
    POSITION: addAccessor(geo.attributes.position.array, "VEC3", FLOAT, { target: 34962, minmax: true }),
    NORMAL: addNormals(geo.attributes.normal.array),
  };
  for (const [k, v] of Object.entries(extra)) attributes[k] = v;
  const indices = addAccessor(new Uint32Array(geo.index.array), "SCALAR", UINT, { target: 34963 });
  meshes.push({ name, primitives: [{ attributes, indices }] });
  nodes.push({ name, mesh: meshes.length - 1 });
}
const heartGeo = new THREE.BufferGeometry();
heartGeo.setAttribute("position", new THREE.BufferAttribute(posS, 3));
heartGeo.setAttribute("normal", new THREE.BufferAttribute(nrmS, 3));
heartGeo.setIndex(geo.index);
addMesh("heart", heartGeo, {
  COLOR_0: addAccessor(colours, "VEC4", UBYTE, { normalized: true, target: 34962 }),
  _BEAT_A: addAccessor(toU8(beat.filter((_, i) => i % 8 < 4)), "VEC4", UBYTE, { normalized: true, target: 34962 }),
  _BEAT_B: addAccessor(toU8(beat.filter((_, i) => i % 8 >= 4)), "VEC4", UBYTE, { normalized: true, target: 34962 }),
});
for (const [k, g] of Object.entries(leafletGeos)) addMesh(`leaflet_${k}`, g);
addMesh("coronaryArteries", coronaryArteries);
addMesh("ghost", ghost);
addMesh("coronaryVeins", coronaryVeins);

const json = {
  extensionsUsed: ["KHR_mesh_quantization"], extensionsRequired: ["KHR_mesh_quantization"],
  asset: { version: "2.0", generator: "SocraticOS heart bake", copyright: "BodyParts3D, © The Database Center for Life Science, CC BY 4.0 (adapted: sectioned, walls and fat modelled, recoloured)" },
  scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes, accessors, bufferViews,
  buffers: [{ byteLength }],
};
let jsonBuf = Buffer.from(JSON.stringify(json));
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
let bin = Buffer.concat(chunks);
bin = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonBuf.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
const glb = Buffer.concat([header, jh, jsonBuf, bh, bin]);
fs.writeFileSync(`${REPO}/public/models/heart.glb`, glb);
console.log("heart.glb", (glb.length / 1e6).toFixed(2), "MB");

// ─── Metadata for the scene ─────────────────────────────────────────
const r3 = (a) => a.map((v) => Math.round(v * 1000) / 1000);
const out = {
  scale: SCALE,
  chambers: Object.fromEntries(Object.entries(chamberCentre).map(([k, v]) => [k, r3([v[0], v[1], 0])])),
  cavityRadius: Object.fromEntries(["lv", "rv", "la", "ra"].map((k) => [k, Math.round(Math.cbrt((3 * { lv: 97.9, rv: 117, la: 51.9, ra: 84.6 }[k] * 1000) / (4 * Math.PI)) * SCALE * 1000) / 1000])),
  apex: r3(apex), base: r3(base), longAxis: r3([axis[0], axis[1], 0]),
  valves: Object.fromEntries(Object.entries(valves).map(([k, v]) => [k, { centre: r3(v.centre), flow: r3(v.flow), radius: Math.round(v.radius * 1000) / 1000, leaflets: v.leaflets.map((l) => ({ hinge: r3(l.hinge), axis: r3(l.axis), edge: l.edge.map(r3) })) }])),
  papillary: Object.fromEntries(Object.entries(papillary).map(([k, v]) => [k, { tip: r3(v.tip), valve: v.valve }])),
  vessels: Object.fromEntries(Object.entries(vesselCentre).map(([k, v]) => [k, r3(v)])),
  conduction: { sa: r3(conduction.sa), av: r3(conduction.av), paths: Object.fromEntries(Object.entries(conduction.paths).map(([k, v]) => [k, v.map(r3)])), seats: conduction.seats.map(r3) },
};
fs.writeFileSync(`${REPO}/components/visualizations/heart-model-meta.js`, `// Generated by the heart bake (scratch pipeline) from BodyParts3D, © The Database Center for Life\n// Science, CC BY 4.0. Scene units; the section plane is z = 0 and the camera looks from +z.\nexport const HEART_MODEL = ${JSON.stringify(out, null, 1)};\n`);
console.log("meta written", JSON.stringify(out.chambers));

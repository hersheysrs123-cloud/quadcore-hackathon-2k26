import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { PAIRS, chiasmaPlan, chromatids as listChromatids, cycleFor } from "../../lib/cellDivision.js";
import { ORGANELLES, cellRadiusAt, choreograph, fibreReach, makeLiveBag, placeOrganelle } from "../../components/visualizations/mitosis-choreography.js";

// The cell-division scene must flow from stage to stage: nothing on screen
// may jump between one frame and the next. This plays the whole cycle at
// 60 frames a second and measures how far everything visible moves per
// frame. The fastest real motion (the anaphase pull, the centrosomes'
// walk round the nucleus) is under 0.06 world units a frame; a jump is
// several times that. The only allowed break is the wrap from the last
// stage back to interphase, which the scene fades through.

const FRAME = 1 / 60;
const MAX_STEP = 0.1; // world units per frame
const MAX_TURN = 0.12; // radians per frame

/** Everything visible this frame, as named points (world), sizes and orientations. */
function sample(live, chromatids) {
  const points = {};
  const groups = { centrosome: [], nucleus: [], lobe: [] };
  const turns = {};
  const v = new THREE.Vector3();
  for (const ch of chromatids) {
    const st = live.chromatids[ch.key];
    if (st.opacity > 0.05) {
      points[`centromere:${ch.key}`] = st.world.clone();
      turns[`chromatid:${ch.key}`] = st.quat.clone();
      // The sister's offset: its long axis sits this far to one side.
      v.set(st.side * st.bow * 0.1, 0, 0).applyQuaternion(st.quat);
      points[`side:${ch.key}`] = v.clone();
    }
    if (st.territoryOpacity > 0.05) {
      points[`territory:${ch.key}`] = st.territory.clone();
      points[`territorySize:${ch.key}`] = new THREE.Vector3(st.territorySize, 0, 0);
    }
  }
  for (const u of live.units) {
    if (!u.active) continue;
    const m = u.frame.matrix;
    for (const c of u.centrosomes) groups.centrosome.push(c.clone().applyMatrix4(m));
    const n = u.nucleus;
    if (n.centre > 0.05) groups.nucleus.push({ p: new THREE.Vector3(0, 0, 0).applyMatrix4(m), r: n.centreRadius * u.frame.scale });
    if (n.poles > 0.05) {
      for (const d of [-1, 1]) groups.nucleus.push({ p: new THREE.Vector3(d * n.poleOffset, 0, 0).applyMatrix4(m), r: n.poleRadius * u.frame.scale });
    }
    for (const d of [-1, 1]) groups.lobe.push({ p: new THREE.Vector3(d * u.c, 0, 0).applyMatrix4(m), r: u.r * u.frame.scale });
  }
  const o = new THREE.Vector3();
  [...ORGANELLES.mito, ...ORGANELLES.ves].forEach((org, i) => {
    if (placeOrganelle(live, org, o)) points[`organelle:${i}`] = o.clone();
  });
  return { points, groups, turns };
}

/** The largest move from `a` to `b`: named points by name, groups by nearest match. */
function largestMove(a, b) {
  let worst = { d: 0, what: "" };
  const note = (d, what) => {
    if (d > worst.d) worst = { d, what };
  };
  for (const [k, p] of Object.entries(b.points)) if (a.points[k]) note(p.distanceTo(a.points[k]), k);
  for (const [k, q] of Object.entries(b.turns)) if (a.turns[k]) note(q.angleTo(a.turns[k]) * (MAX_STEP / MAX_TURN), `${k} (turn)`);
  for (const g of ["centrosome", "nucleus", "lobe"]) {
    for (const item of b.groups[g]) {
      const p = item.p ?? item;
      let best = Infinity;
      for (const prev of a.groups[g]) {
        const q = prev.p ?? prev;
        const d = p.distanceTo(q) + (item.r !== undefined ? Math.abs(item.r - prev.r) : 0);
        best = Math.min(best, d);
      }
      if (Number.isFinite(best)) note(best, g);
    }
  }
  return worst;
}

function playThrough(mode) {
  const cycle = cycleFor(mode);
  const chromatids = listChromatids();
  const live = makeLiveBag(chromatids);
  live.plan = mode === "meiosis" ? chiasmaPlan(2) : [];
  const failures = [];
  let prev = null;
  let prevStage = null;
  for (let t = 0; t < cycle.total - FRAME; t += FRAME) {
    const pose = choreograph(live, { t, arrested: false }, mode, chromatids, FRAME, 1);
    const now = sample(live, chromatids);
    // The wrap back to interphase is faded through; skip the frames around it.
    if (prev && pose.fade > 0.98) {
      const worst = largestMove(prev, now);
      if (worst.d > MAX_STEP) failures.push(`${prevStage} → ${pose.stage} at t = ${t.toFixed(2)}: ${worst.what} moved ${worst.d.toFixed(3)}`);
    }
    prev = now;
    prevStage = pose.stage;
  }
  return failures;
}

describe("Cell-division choreography is continuous", () => {
  it("mitosis flows from stage to stage with nothing jumping", () => {
    const failures = playThrough("mitosis");
    assert.deepEqual(failures.slice(0, 5), []);
  });

  it("meiosis flows through both divisions, including the handover from meiosis I to meiosis II", () => {
    const failures = playThrough("meiosis");
    assert.deepEqual(failures.slice(0, 5), []);
  });
});

describe("Everything stays inside what contains it", () => {
  function forEachFrame(mode, fn) {
    const cycle = cycleFor(mode);
    const chromatids = listChromatids();
    const live = makeLiveBag(chromatids);
    live.plan = mode === "meiosis" ? chiasmaPlan(2) : [];
    for (let t = 0; t < cycle.total - FRAME; t += FRAME) {
      const pose = choreograph(live, { t, arrested: false }, mode, chromatids, FRAME, 1);
      fn(live, pose, chromatids, t);
    }
  }

  for (const mode of ["mitosis", "meiosis"]) {
    it(`${mode}: a chromosome never reaches through an intact nuclear envelope`, () => {
      const bad = [];
      const v = new THREE.Vector3();
      const c = new THREE.Vector3();
      forEachFrame(mode, (live, pose, chromatids, t) => {
        const after = pose.phase === "telophase" || pose.phase === "cytokinesis";
        for (const ch of chromatids) {
          const st = live.chromatids[ch.key];
          const u = live.units[st.unit];
          const enclosed = after ? u.nucleus.poles : u.nucleus.centre;
          if (enclosed < 0.98 || st.opacity < 0.05) continue;
          const pair = PAIRS[ch.pair];
          const total = 1.3 * pair.length;
          c.set(after ? st.pullDir * u.nucleus.poleOffset : 0, 0, 0).applyMatrix4(u.frame.matrix);
          const radius = (after ? u.nucleus.poleRadius : u.nucleus.centreRadius) * u.frame.scale;
          for (const arm of [total * (1 - pair.centromere), -total * pair.centromere]) {
            v.set(0, arm * st.lengthScale, 0).applyQuaternion(st.quat).add(st.world);
            const d = v.distanceTo(c);
            if (d > radius) bad.push(`${pose.stage} t=${t.toFixed(2)} ${ch.key}: tip ${d.toFixed(2)} from the centre of a nucleus of radius ${radius.toFixed(2)}`);
          }
        }
      });
      assert.deepEqual(bad.slice(0, 5), []);
    });

    it(`${mode}: no chromosome reaches out of the cell, even as the sets near the poles`, () => {
      const bad = [];
      const v = new THREE.Vector3();
      const inv = new THREE.Matrix4();
      forEachFrame(mode, (live, pose, chromatids, t) => {
        if (pose.fade < 0.98) return;
        for (const ch of chromatids) {
          const st = live.chromatids[ch.key];
          if (st.opacity < 0.05) continue;
          const u = live.units[st.unit];
          const pair = PAIRS[ch.pair];
          const total = 1.3 * pair.length;
          for (const arm of [total * (1 - pair.centromere), -total * pair.centromere]) {
            const trail = -st.pullDir * st.bend * 0.42 * Math.abs(arm);
            v.set(trail, arm * st.lengthScale, 0).applyQuaternion(st.quat).add(st.world);
            v.applyMatrix4(inv.copy(u.frame.matrix).invert());
            const reach = Math.hypot(v.y, v.z) + 0.085 / u.frame.scale;
            if (reach > cellRadiusAt(u, v.x)) bad.push(`${pose.stage} t=${t.toFixed(2)} ${ch.key}: ${reach.toFixed(2)} > ${cellRadiusAt(u, v.x).toFixed(2)}`);
          }
        }
      });
      assert.deepEqual(bad.slice(0, 5), []);
    });

    it(`${mode}: no mitochondrion or vesicle pokes through the membrane`, () => {
      const bad = [];
      const p = new THREE.Vector3();
      const inv = new THREE.Matrix4();
      forEachFrame(mode, (live, pose, chromatids, t) => {
        if (pose.fade < 0.98) return;
        for (const [list, extent] of [
          [ORGANELLES.mito, 0.36 * 1.2 * 0.69],
          [ORGANELLES.ves, 0.055 * 1.2],
        ]) {
          for (const o of list) {
            const placed = placeOrganelle(live, o, p);
            if (!placed) continue;
            const u = live.division === 2 ? live.units[o.x < 0 ? 0 : 1] : live.units[0];
            p.applyMatrix4(inv.copy(u.frame.matrix).invert());
            const reach = Math.hypot(p.y, p.z) + (extent * placed[0]) / u.frame.scale;
            if (reach > cellRadiusAt(u, p.x)) bad.push(`${pose.stage} t=${t.toFixed(2)}: ${reach.toFixed(2)} > ${cellRadiusAt(u, p.x).toFixed(2)}`);
          }
        }
      });
      assert.deepEqual(bad.slice(0, 5), []);
    });
  }

  it("an astral fibre stops at the cortex", () => {
    const live = makeLiveBag(listChromatids());
    choreograph(live, { t: cycleFor("mitosis").byKey.metaphase.hold, arrested: false }, "mitosis", listChromatids(), FRAME, 1);
    const u = live.units[0];
    const c = u.centrosomes[1];
    const f = fibreReach(u, c.x, c.y, c.z, c.x + 2, c.y + 0.5, c.z);
    assert.ok(f > 0 && f < 1, `cut short, got ${f}`);
    const ex = c.x + 2 * f;
    const ey = c.y + 0.5 * f;
    assert.ok(Math.hypot(ey, c.z) <= cellRadiusAt(u, ex), "its end is inside the membrane");
  });
});

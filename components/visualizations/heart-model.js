import { HEART_MODEL } from "@/components/visualizations/heart-model-meta";

// ─── The scanned heart: runtime helpers ─────────────────────────────
// `public/models/heart.glb` is baked offline from BodyParts3D (© The
// Database Center for Life Science, CC BY 4.0), a human body segmented
// from MRI. The chambers' blood pools, the valve leaflets and cusps, the
// papillary muscles, the coronary vessels and the great vessels are the
// scan's own shapes; the ventricular walls are grown around the real
// cavities at textbook thicknesses (LV 10 mm, RV 4 mm, atria 2.5 mm), and
// epicardial fat fills the grooves. The heart is opened along the
// four-chamber plane (z = 0 here), turned so the long axis runs apex-up to
// the atria and the right heart is on the viewer's left.
//
// The GLB's "heart" mesh carries two custom attributes the beat reads:
//   _beat_a = (lv, rv, la, ra) weights — how much each vertex moves with
//             each chamber (1 in its wall, fading outside it)
//   _beat_b = (descent, lvDepth, vessel, —) — the share of the AV plane's
//             systolic descent it takes, how deep it sits in the LV wall
//             (what hypertrophy thickens), and whether it is a great vessel
// ─────────────────────────────────────────────────────────────────────

export const HEART_GLB = "/models/heart.glb";

/**
 * The palette the bake paints into the GLB's vertex colours (mottled ±7 %),
 * kept here so the Details key names colours the scene really draws.
 */
export const HEART_TISSUE = {
  cutMuscle: "#7d2a24",
  cutAtrial: "#8e3a31",
  epicardium: "#96352f",
  fat: "#e5c27c",
  endocardiumLeft: "#b8564d",
  endocardiumRight: "#9a4e58",
  aorta: "#e3b39c",
  pulmonaryTrunk: "#cda3a8",
  venaCava: "#5f4467",
};
export { HEART_MODEL };

const CHAMBER_IDS = ["lv", "rv", "la", "ra"];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** One beat pose for the whole heart: cavity scales (1 = as scanned), AV-plane descent, hypertrophy, jitter. */
export function makeBeat() {
  return { lv: 1, rv: 1, la: 1, ra: 1, descent: 0, jitter: [0, 0], hyper: 0 };
}

/**
 * Beat weights for a point that is not a baked vertex (a blood particle, a
 * conduction path, a valve hinge): the same fields approximated by distance
 * from each chamber's centre in units of its cavity radius.
 */
export function weightsAt(x, y, z) {
  const w = [0, 0, 0, 0, 0, 0];
  CHAMBER_IDS.forEach((id, i) => {
    const c = HEART_MODEL.chambers[id];
    const a = HEART_MODEL.cavityRadius[id];
    const r = Math.hypot(x - c[0], y - c[1], z - c[2]) / a;
    w[i] = 1 - smoothstep(1.05, 1.7, r);
  });
  const { apex, longAxis } = HEART_MODEL;
  const span = (HEART_MODEL.base[0] - apex[0]) * longAxis[0] + (HEART_MODEL.base[1] - apex[1]) * longAxis[1];
  const along = (x - apex[0]) * longAxis[0] + (y - apex[1]) * longAxis[1];
  w[4] = along <= span ? clamp(along / span, 0, 1) : 1 - smoothstep(0, 2.2, along - span);
  w[5] = 0;
  return w;
}

/**
 * Move a rest position to where the beat has it. Each chamber scales about
 * its centre keeping its wall's volume: a point at radius r goes to
 * ∛(r³ + a³(s³ − 1)), so the lining moves by the full scale and the outside
 * less, and a squeezing ventricle thickens. The AV plane then descends
 * towards the apex (which barely moves), stretching the atria.
 */
export function deformPoint(rx, ry, rz, w, beat, out) {
  let x = rx;
  let y = ry;
  let z = rz;
  for (let i = 0; i < 4; i += 1) {
    const wi = w[i];
    if (wi <= 1e-4) continue;
    const id = CHAMBER_IDS[i];
    const s = beat[id];
    if (Math.abs(s - 1) < 1e-4) continue;
    const c = HEART_MODEL.chambers[id];
    const dx = rx - c[0];
    const dy = ry - c[1];
    const dz = rz;
    const r = Math.hypot(dx, dy, dz);
    if (r < 1e-6) continue;
    const a = HEART_MODEL.cavityRadius[id];
    const r2 = Math.cbrt(Math.max(1e-9, r * r * r + a * a * a * (s * s * s - 1)));
    const k = wi * (r2 / r - 1);
    x += dx * k;
    y += dy * k;
    z += dz * k;
  }
  if (beat.hyper && w[5] > 0) {
    // Concentric hypertrophy: the LV wall stands proud of where it was.
    const c = HEART_MODEL.chambers.lv;
    const dx = rx - c[0];
    const dy = ry - c[1];
    const r = Math.hypot(dx, dy, rz) || 1;
    const k = (beat.hyper * 0.22 * w[5]) / r;
    x += dx * k;
    y += dy * k;
    z += rz * k;
  }
  const d = beat.descent * w[4];
  x -= HEART_MODEL.longAxis[0] * d;
  y -= HEART_MODEL.longAxis[1] * d;
  if (beat.jitter) {
    const j = w[0] + w[1];
    x += beat.jitter[0] * j;
    y += beat.jitter[1] * j;
  }
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

/**
 * deformPoint on the GPU. Doing the 120 k heart vertices in JavaScript took
 * 35–66 ms a frame, so the beat stuttered; the vertex shader does the same
 * sum from the `aBeatA` (lv, rv, la, ra) and `aBeatB` (descent, lvDepth)
 * attributes and the uniforms `beatUniforms` makes.
 */
export function beatUniforms() {
  return {
    // Uniform arrays go to three flat.
    uBeatCentre: { value: new Float32Array(CHAMBER_IDS.flatMap((id) => HEART_MODEL.chambers[id])) },
    uBeatRadius: { value: CHAMBER_IDS.map((id) => HEART_MODEL.cavityRadius[id]) },
    uBeatScale: { value: [1, 1, 1, 1] },
    uBeatDescent: { value: 0 },
    uBeatHyper: { value: 0 },
    uBeatJitter: { value: [0, 0] },
    uBeatAxis: { value: HEART_MODEL.longAxis.slice() },
  };
}

/** Copy a beat pose into uniforms made by `beatUniforms`. */
export function setBeatUniforms(u, beat) {
  const s = u.uBeatScale.value;
  s[0] = beat.lv;
  s[1] = beat.rv;
  s[2] = beat.la;
  s[3] = beat.ra;
  u.uBeatDescent.value = beat.descent;
  u.uBeatHyper.value = beat.hyper || 0;
  u.uBeatJitter.value[0] = beat.jitter ? beat.jitter[0] : 0;
  u.uBeatJitter.value[1] = beat.jitter ? beat.jitter[1] : 0;
}

export const BEAT_VERTEX_HEAD = `
uniform vec3 uBeatCentre[4];
uniform float uBeatRadius[4];
uniform float uBeatScale[4];
uniform float uBeatDescent;
uniform float uBeatHyper;
uniform vec2 uBeatJitter;
uniform vec3 uBeatAxis;
attribute vec4 aBeatA;
attribute vec4 aBeatB;
`;

export const BEAT_VERTEX_BODY = `
{
  vec3 rp = transformed;
  vec3 dp = rp;
  float ws[4];
  ws[0] = aBeatA.x; ws[1] = aBeatA.y; ws[2] = aBeatA.z; ws[3] = aBeatA.w;
  for (int i = 0; i < 4; i++) {
    float s = uBeatScale[i];
    if (ws[i] > 1e-4 && abs(s - 1.0) > 1e-4) {
      vec3 d = rp - uBeatCentre[i];
      float r = length(d);
      if (r > 1e-6) {
        float a = uBeatRadius[i];
        float r2 = pow(max(1e-9, r * r * r + a * a * a * (s * s * s - 1.0)), 1.0 / 3.0);
        dp += d * (ws[i] * (r2 / r - 1.0));
      }
    }
  }
  if (uBeatHyper > 0.0 && aBeatB.y > 0.0) {
    vec3 d = rp - uBeatCentre[0];
    dp += d * (uBeatHyper * 0.22 * aBeatB.y / max(length(d), 1e-6));
  }
  dp -= uBeatAxis * (uBeatDescent * aBeatB.x);
  dp.xy += uBeatJitter * (aBeatA.x + aBeatA.y);
  transformed = dp;
}
`;

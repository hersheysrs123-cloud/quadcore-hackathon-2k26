// ─── Shadow formation ───────────────────────────────────────────────
// The geometry behind the primary-school light lab: straight-line
// propagation, how far a shadow spreads, what a wide lamp does to its edges,
// and how much light a material lets through.
//
// The shadow is not a scaled outline. It is found the way light finds it: a
// ray is fired from every point of the lamp through every point of the drawn
// solid to the screen, and the screen is dark where the ray was stopped. The
// solid is the very mesh the scene draws (lib/shadowSolids.js), so a rotated
// cube throws the odd shadow a rotated cube really throws, parts of a thick
// object nearer the lamp are magnified more than parts further from it, and a
// wide lamp's penumbra is what a row of point lamps really adds up to rather
// than a blur painted over the edge.
//
// Every rule the scene claims to prove is derived here and checked by
// `tests/unit/shadow-optics.test.mjs` — including against a brute-force
// ray/triangle test, one ray per screen point.
// ─────────────────────────────────────────────────────────────────────

import { SHAPES, SHAPE_DEFS, SHAPE_GROUPS, SHAPE_LABELS, getSolid } from "./shadowSolids.js";

export { SHAPES, SHAPE_DEFS, SHAPE_GROUPS, SHAPE_LABELS, getSolid };

/** Bench limits in centimetres — the floor ruler the child drags along. */
export const BENCH = { min: 0, max: 120, lightHome: 12, objectHome: 55, screenHome: 105 };

/**
 * How much light each material lets straight through.
 *
 * `transmission` is the fraction of light that survives a `referenceCm`-thick
 * slab of the material — thicker parts of the object pass less (Beer–Lambert),
 * thinner parts more, which is what puts a darker heart in the shadow of a
 * frosted ball. `scatter` is how much of what gets through is thrown
 * sideways, which is what makes a translucent shadow soft grey rather than
 * merely lighter.
 */
export const MATERIALS = {
  opaque: {
    label: "Opaque",
    example: "wood or metal",
    transmission: 0,
    scatter: 0,
    referenceCm: 5,
    shadow: "a solid, sharp, black shadow",
  },
  translucent: {
    label: "Translucent",
    example: "frosted glass or tracing paper",
    transmission: 0.45,
    scatter: 0.7,
    referenceCm: 5,
    shadow: "a pale, soft grey shadow",
  },
  transparent: {
    label: "Transparent",
    example: "clear acrylic",
    transmission: 0.94,
    scatter: 0.05,
    referenceCm: 5,
    shadow: "almost no shadow at all",
  },
};

export const MATERIAL_OPTIONS = Object.entries(MATERIALS).map(([value, m]) => ({
  value,
  label: m.label,
  title: `${m.label} — ${m.example}`,
}));

/**
 * The emitting face of each lamp, in cm, facing the object.
 *
 * The wide lamp is a fluorescent tube lying across the bench: 6 cm of it
 * along x and its 2.7 cm diameter up and down. The lamp sits ON the optical
 * axis, at its bench position — the mesh in the scene is built around that
 * point, so the rays start where the light is drawn.
 */
export const SOURCES = {
  point: { label: "Pinpoint bulb", width: 0.2, height: 0.2, note: "a tiny source gives crisp edges" },
  broad: { label: "Wide lamp", width: 6, height: 2.7, note: "a wide source smears the edge into a penumbra" },
};

// ─── Orientation ────────────────────────────────────────────────────

/**
 * The 3×3 (row-major) rotation "turn the shape" applies: a tip toward the
 * screen about x, or a spin on the stand about y. Right-handed, matching
 * three.js's makeRotationX / makeRotationY, so the mesh the scene turns and
 * the mesh the rays are fired at are turned identically.
 */
export function turnMatrix(shape, angleRad = 0) {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  if ((SHAPE_DEFS[shape] ?? SHAPE_DEFS.cylinder).turn === "x") return [1, 0, 0, 0, c, -s, 0, s, c];
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}

/** The solid turned and stood on the bench: vertices and face normals in world cm. */
export function placeSolid({ shape, rotation = 0, objectZ }) {
  const solid = getSolid(shape);
  const R = turnMatrix(solid.shape, rotation);
  const P = solid.positions;
  const world = new Float64Array(P.length);
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    world[i] = R[0] * x + R[1] * y + R[2] * z;
    world[i + 1] = R[3] * x + R[4] * y + R[5] * z;
    world[i + 2] = R[6] * x + R[7] * y + R[8] * z + objectZ;
  }
  const N = solid.normals;
  const normals = new Float64Array(N.length);
  for (let i = 0; i < N.length; i += 3) {
    const x = N[i], y = N[i + 1], z = N[i + 2];
    normals[i] = R[0] * x + R[1] * y + R[2] * z;
    normals[i + 1] = R[3] * x + R[4] * y + R[5] * z;
    normals[i + 2] = R[6] * x + R[7] * y + R[8] * z;
  }
  return { solid, world, normals, R };
}

/** How far below the object's centre its lowest point hangs, once turned — where its stand must stop. */
export function underside(shape, rotation = 0) {
  const solid = getSolid(shape);
  const R = turnMatrix(solid.shape, rotation);
  const P = solid.positions;
  let low = 0;
  for (let i = 0; i < P.length; i += 3) {
    low = Math.max(low, -(R[3] * P[i] + R[4] * P[i + 1] + R[5] * P[i + 2]));
  }
  return low;
}

// ─── Bench rules ────────────────────────────────────────────────────

/**
 * How far apart the lamp, the object and the screen must stand: the object's
 * reach in every direction it can be turned, plus a centimetre. Closer than
 * that and the solid would poke through the lamp or the paper.
 */
export function benchGap(shape) {
  return Math.ceil((getSolid(shape).radius + 1) * 2) / 2;
}

const clampTo = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Nudge a layout back into a physically possible order for `shape`: lamp, object, screen. */
export function enforceBench({ lightZ, objectZ, screenZ }, shape) {
  const gap = benchGap(shape);
  const object = clampTo(objectZ, BENCH.min + gap, BENCH.max - gap);
  return {
    lightZ: clampTo(lightZ, BENCH.min, object - gap),
    objectZ: object,
    screenZ: clampTo(screenZ, object + gap, BENCH.max),
  };
}

// ─── Simple rules of thumb ──────────────────────────────────────────

/**
 * How many times bigger the shadow is than the object, at the object's middle.
 *
 * M = (light→screen) ÷ (light→object), which rearranges to 1 + b/a. Both
 * primary rules the lab is built to prove are visible in that one expression:
 * shrink a (light closer) and M grows; grow b (screen further) and M grows.
 * It is exact for a thin flat object. A thick one is magnified a little more
 * on its near face and a little less on its far one — the rays below settle it.
 */
export function magnification(lightToObject, objectToScreen) {
  const a = Math.max(lightToObject, 0.1);
  const b = Math.max(objectToScreen, 0);
  return 1 + b / a;
}

/**
 * Umbra and penumbra half-widths for a thin, flat object.
 *
 * A source of width `sourceWidth` is a whole row of point sources, each
 * casting its own slightly offset sharp shadow. Where every one of them is
 * blocked you get the umbra; where only some are, the penumbra. The gap
 * between the two edges works out to exactly sourceWidth × b ÷ a.
 */
export function shadowBands(objectHalfSize, lightToObject, objectToScreen, sourceWidth = 0) {
  const a = Math.max(lightToObject, 0.1);
  const b = Math.max(objectToScreen, 0);
  const M = magnification(a, b);
  const half = (sourceWidth / 2) * (b / a);
  return {
    magnification: M,
    /** Fully dark core. Goes to nothing when the lamp is wide enough. */
    umbra: Math.max(objectHalfSize * M - half, 0),
    /** Outer edge of any shadow at all. */
    penumbra: objectHalfSize * M + half,
    /** Width of the fuzzy band on each side: sourceWidth × b ÷ a. */
    penumbraWidth: sourceWidth * (b / a),
    /** True once the source is wide enough to light every part of the shadow. */
    umbraLost: objectHalfSize * M - half <= 0,
  };
}

/**
 * How dark the shadow is, 0 (invisible) to 1 (pitch black), for a slab as
 * thick as the material's reference. The scene works out the real thing per
 * ray from the path length; this is the summary the readouts quote.
 */
export function shadowDarkness(material) {
  const m = MATERIALS[material] ?? MATERIALS.opaque;
  return 1 - m.transmission;
}

/** Screen illuminance falls off as 1/d² — the inverse-square law. */
export function screenBrightness(lightToScreen, lampPower = 1) {
  const d = Math.max(lightToScreen, 1);
  return (lampPower * 10000) / (d * d);
}

/**
 * Does light bend around the object? No — and that is the point.
 *
 * Kept as an explicit, testable statement because the whole lab exists to
 * rule it out: the shadow edge is found by drawing a STRAIGHT line from the
 * lamp past the object's edge, and nothing else.
 */
export function shadowEdgeOnScreen(lightX, lightZ, edgeX, edgeZ, screenZ) {
  const dz = edgeZ - lightZ;
  if (Math.abs(dz) < 1e-9) return edgeX;
  const t = (screenZ - lightZ) / dz;
  return lightX + (edgeX - lightX) * t;
}

// ─── Presets ────────────────────────────────────────────────────────

export const PRESETS = {
  huge: {
    label: "Make shadow huge",
    lightZ: 42,
    objectZ: 55,
    screenZ: 118,
    hint: "Lamp pushed right up to the object and the screen shoved far back.",
  },
  tiny: {
    label: "Make shadow tiny",
    lightZ: 2,
    objectZ: 55,
    screenZ: 60,
    hint: "Lamp far away so its rays arrive nearly parallel, screen right behind the object.",
  },
  circle: {
    label: "Cylinder → circle",
    shape: "cylinder",
    rotation: Math.PI / 2,
    hint: "Turn the cylinder to point its flat end at the screen.",
  },
};

// ─── Scene framing ──────────────────────────────────────────────────

/**
 * Where the scene stands its apparatus and its camera, in bench centimetres.
 *
 * These live out here rather than inside the canvas because one of them is
 * load-bearing and was silently wrong: a shadow lands on the face of the
 * screen that points BACK at the lamp, so a camera parked beyond the screen
 * sees nothing but its blank back — edge-on, and half out of frame. The lab
 * looked like it was refusing to project anything at all.
 */
export const SCENE = {
  /** Height of the optical axis above the bench: lamp, object, screen centre. */
  axisHeightCm: 30,
  /** Half-extents of the projection screen's paper. */
  screenHalfWidthCm: 34,
  screenHalfHeightCm: 28,
  /** Where the default camera stands, as a bench coordinate. */
  cameraBenchZ: -24,
  /** …and what it looks at. */
  targetBenchZ: 64,
};

/**
 * Can a camera at `cameraBenchZ` see the face the shadow is cast on?
 *
 * Only from the lamp's side of the screen. Stated as a function so the test
 * suite can assert it of the shipping default rather than of a copy.
 */
export function seesShadowSide(cameraBenchZ, screenZ) {
  return cameraBenchZ < screenZ;
}

/** Does the whole shadow still land on the paper, or is it running off? */
export function shadowFitsScreen(solved, screen = SCENE) {
  const o = solved.box.outer;
  return (
    o.left >= -screen.screenHalfWidthCm &&
    o.right <= screen.screenHalfWidthCm &&
    o.bottom >= -screen.screenHalfHeightCm &&
    o.top <= screen.screenHalfHeightCm
  );
}

// ─── The rays ───────────────────────────────────────────────────────
//
// Frames. The solid is in the bench's world frame (x = world X, y up from the
// optical axis, z along the bench). The camera looks down +z, so what it calls
// "right" is −x; everything a person reads off the screen — the boxes, the
// picture — is in that VIEWER frame: u = −x to the right, v = y up.

/** Van der Corput sequence: a fixed, evenly-spreading jitter, so results are repeatable. */
function halton(i, base) {
  let f = 1;
  let r = 0;
  let n = i;
  while (n > 0) {
    f /= base;
    r += f * (n % base);
    n = Math.floor(n / base);
  }
  return r;
}

/**
 * Points spread over the lamp's emitting face, one stratum each, with a fixed
 * jitter inside the stratum (and a sub-pixel one on the screen, which anti-
 * aliases an edge that is otherwise razor sharp). Offsets are in cm from the
 * lamp's centre: x along the bench's width, y up.
 */
export function sourceSamples(source, count) {
  const src = SOURCES[source] ?? SOURCES.point;
  const aspect = src.width / src.height;
  const ny = Math.max(1, Math.round(Math.sqrt(count / aspect)));
  const nx = Math.max(1, Math.round(count / ny));
  const out = [];
  let k = 1;
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1, k += 1) {
      out.push({
        x: ((i + halton(k, 2)) / nx - 0.5) * src.width,
        y: ((j + halton(k, 3)) / ny - 0.5) * src.height,
        jx: halton(k, 5) - 0.5,
        jy: halton(k, 7) - 0.5,
      });
    }
  }
  return out;
}

/** The four corners of the lamp's face: the extreme sources, which set the shadow's outer and inner edges. */
function sourceCorners(source) {
  const src = SOURCES[source] ?? SOURCES.point;
  const hx = src.width / 2;
  const hy = src.height / 2;
  return [
    { x: -hx, y: -hy },
    { x: hx, y: -hy },
    { x: -hx, y: hy },
    { x: hx, y: hy },
  ];
}

/**
 * The straight-line map from a source, through a point on the solid, to the
 * screen. `t` is how many times further the screen is than the point.
 */
export function projectPoint(source, point, screenZ, lightZ) {
  const w = Math.max(point[2] - lightZ, 0.05);
  const t = (screenZ - lightZ) / w;
  return [source.x + (point[0] - source.x) * t, source.y + (point[1] - source.y) * t];
}

/** Where every vertex of the placed solid lands on the screen, from one point of the lamp. */
function projectAll(world, source, lightZ, screenZ, outX, outY) {
  const D = screenZ - lightZ;
  const n = world.length / 3;
  for (let i = 0; i < n; i += 1) {
    const w = Math.max(world[i * 3 + 2] - lightZ, 0.05);
    const t = D / w;
    outX[i] = source.x + (world[i * 3] - source.x) * t;
    outY[i] = source.y + (world[i * 3 + 1] - source.y) * t;
  }
}

/**
 * The exact outer and inner extent of the shadow, from the rays through the
 * solid's vertices. Projection through a point is a straight-line map, so the
 * bounding box of the projected vertices IS the bounding box of the shadow —
 * no sampling error at all.
 *
 * "Outer" is where any part of the lamp is shadowed (the penumbra's edge);
 * "inner" is where all of it is (the umbra's). Boxes are in the viewer frame.
 */
export function shadowBox(world, lightZ, screenZ, source = "point") {
  const n = world.length / 3;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const outer = { left: Infinity, right: -Infinity, bottom: Infinity, top: -Infinity };
  const inner = { left: -Infinity, right: Infinity, bottom: -Infinity, top: Infinity };
  for (const corner of sourceCorners(source)) {
    projectAll(world, corner, lightZ, screenZ, xs, ys);
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (let i = 0; i < n; i += 1) {
      if (xs[i] < xMin) xMin = xs[i];
      if (xs[i] > xMax) xMax = xs[i];
      if (ys[i] < yMin) yMin = ys[i];
      if (ys[i] > yMax) yMax = ys[i];
    }
    // Viewer frame: u = −x.
    const box = { left: -xMax, right: -xMin, bottom: yMin, top: yMax };
    outer.left = Math.min(outer.left, box.left);
    outer.right = Math.max(outer.right, box.right);
    outer.bottom = Math.min(outer.bottom, box.bottom);
    outer.top = Math.max(outer.top, box.top);
    inner.left = Math.max(inner.left, box.left);
    inner.right = Math.min(inner.right, box.right);
    inner.bottom = Math.max(inner.bottom, box.bottom);
    inner.top = Math.min(inner.top, box.top);
  }
  return { outer, inner };
}

/**
 * One solve for the whole bench, without painting a pixel: the numbers the
 * ruler readouts, the game and the quiz answers quote. The picture comes from
 * `castShadow`, which fires the same rays at every screen point.
 */
export function solveShadow({
  lightZ,
  objectZ,
  screenZ,
  shape = "cylinder",
  rotation = 0,
  material = "opaque",
  source = "point",
}) {
  const a = Math.max(objectZ - lightZ, 0.1);
  const b = Math.max(screenZ - objectZ, 0);
  const placed = placeSolid({ shape, rotation, objectZ });
  const box = shadowBox(placed.world, lightZ, screenZ, source);
  const src = SOURCES[source] ?? SOURCES.point;
  const darkness = shadowDarkness(material);

  const band = (o, i, lo, hi) => {
    const spread = ((o[hi] - i[hi]) + (i[lo] - o[lo])) / 2;
    return {
      umbra: Math.max((i[hi] - i[lo]) / 2, 0),
      penumbra: (o[hi] - o[lo]) / 2,
      penumbraWidth: Math.max(spread, 0),
      umbraLost: i[hi] - i[lo] <= 0,
    };
  };

  return {
    lightToObject: a,
    objectToScreen: b,
    lightToScreen: a + b,
    /** At the object's middle: 1 + b/a. */
    magnification: magnification(a, b),
    shape: placed.solid.shape,
    box,
    horizontal: band(box.outer, box.inner, "left", "right"),
    vertical: band(box.outer, box.inner, "bottom", "top"),
    sourceWidth: src.width,
    sourceHeight: src.height,
    darkness,
    material: MATERIALS[material] ?? MATERIALS.opaque,
    /** A transparent object casts nothing worth calling a shadow. */
    castsShadow: darkness > 0.1,
    brightness: screenBrightness(a + b),
    shadowWidthCm: box.outer.right - box.outer.left,
    shadowHeightCm: box.outer.top - box.outer.bottom,
  };
}

// ─── Casting the shadow onto the screen ─────────────────────────────

// Scratch buffers, kept between casts: a cast runs on every slider tick.
let stampBuf = new Uint8Array(0);
let thickBuf = new Float64Array(0);

/**
 * Fire the rays and return what landed on the paper.
 *
 * For every point of the lamp, each front-facing triangle of the solid is
 * projected onto the screen and filled — the set of screen points whose ray
 * to that lamp point runs into the solid. (Only faces turned toward that lamp
 * point are needed: a ray must enter the solid through one, so the union of
 * them is the whole shadow.) `blocked[i]` is how many of the `samples` lamp
 * points are shut out at pixel i, so 0 is full light, `samples` is umbra and
 * everything between is penumbra.
 *
 * A translucent or transparent solid is different: light passes, dimmed by
 * the thickness it went through. There, front faces and back faces are both
 * filled with their depth along the ray, and the difference is the path
 * length, which sets the transmittance T = τ^(length ÷ reference).
 *
 * Pixels are canvas pixels: column i is viewer-right, row j is downward, the
 * optical axis is at the centre, and `pxPerCm` pixels are one centimetre.
 */
export function castShadow(
  { shape = "cylinder", rotation = 0, lightZ, objectZ, screenZ, source = "point", material = "opaque" },
  {
    pxPerCm = 8,
    halfWidthCm = SCENE.screenHalfWidthCm,
    halfHeightCm = SCENE.screenHalfHeightCm,
    samples: given,
    budget = 6e6,
  } = {},
) {
  const W = Math.round(halfWidthCm * 2 * pxPerCm);
  const H = Math.round(halfHeightCm * 2 * pxPerCm);
  const cx = W / 2;
  const cy = H / 2;
  const D = screenZ - lightZ;
  const mat = MATERIALS[material] ?? MATERIALS.opaque;
  const opaque = mat.transmission <= 0;

  const { solid, world, normals } = placeSolid({ shape, rotation, objectZ });
  const nVert = world.length / 3;
  const nTri = solid.tris.length / 3;
  const tris = solid.tris;

  // How many lamp points: as many as the paper's area affords.
  let list = given;
  if (!list) {
    const { outer } = shadowBox(world, lightZ, screenZ, source);
    const wPx = Math.min(outer.right - outer.left, halfWidthCm * 2) * pxPerCm;
    const hPx = Math.min(outer.top - outer.bottom, halfHeightCm * 2) * pxPerCm;
    const base = source === "broad" ? 96 : 16;
    const perSample = Math.max(wPx * hPx, 1) * (opaque ? 1.2 : 2.4);
    list = sourceSamples(source, Math.max(12, Math.min(base, Math.floor(budget / perSample), 200)));
  }
  const N = list.length;

  const blocked = new Uint8Array(W * H);
  const shade = new Float32Array(W * H);
  if (stampBuf.length !== W * H) stampBuf = new Uint8Array(W * H);
  else stampBuf.fill(0);
  if (!opaque && thickBuf.length !== W * H) thickBuf = new Float64Array(W * H);
  const stamp = stampBuf;
  const thick = thickBuf;

  const px = new Float64Array(nVert);
  const py = new Float64Array(nVert);
  const iw = new Float64Array(nVert);
  for (let i = 0; i < nVert; i += 1) iw[i] = 1 / Math.max(world[i * 3 + 2] - lightZ, 0.05);

  const refCm = mat.referenceCm;
  const logT = Math.log(Math.max(mat.transmission, 1e-9));

  for (let k = 0; k < N; k += 1) {
    const S = list[k];
    const id = k + 1;
    // Viewer column = cx − x·px, row = cy − y·px, nudged by the sub-pixel jitter.
    for (let i = 0; i < nVert; i += 1) {
      const t = D * iw[i];
      const X = S.x + (world[i * 3] - S.x) * t;
      const Y = S.y + (world[i * 3 + 1] - S.y) * t;
      px[i] = cx - X * pxPerCm + S.jx;
      py[i] = cy - Y * pxPerCm + S.jy;
    }
    let rowMin = H;
    let rowMax = -1;

    for (let t = 0; t < nTri; t += 1) {
      const ia = tris[t * 3], ib = tris[t * 3 + 1], ic = tris[t * 3 + 2];
      if (ia === ib || ib === ic || ia === ic) continue;
      // Turned toward this lamp point? (a front face: the ray enters here)
      const facing =
        normals[t * 3] * (S.x - world[ia * 3]) +
          normals[t * 3 + 1] * (S.y - world[ia * 3 + 1]) +
          normals[t * 3 + 2] * (lightZ - world[ia * 3 + 2]) >
        0;
      if (opaque && !facing) continue;

      let ax = px[ia], ay = py[ia], bx = px[ib], by = py[ib], cxp = px[ic], cyp = py[ic];
      let aw = iw[ia], bw = iw[ib], cw = iw[ic];
      // Skip anything wholly off the paper.
      if (Math.max(ay, by, cyp) < 0 || Math.min(ay, by, cyp) > H) continue;
      if (Math.max(ax, bx, cxp) < 0 || Math.min(ax, bx, cxp) > W) continue;

      // Depth plane 1/w = A·x + B·y + C, for the thick (translucent) case.
      let pA = 0, pB = 0, pC = 0;
      if (!opaque) {
        const det = (bx - ax) * (cyp - ay) - (cxp - ax) * (by - ay);
        if (Math.abs(det) < 1e-12) continue;
        pA = ((bw - aw) * (cyp - ay) - (cw - aw) * (by - ay)) / det;
        pB = ((bx - ax) * (cw - aw) - (cxp - ax) * (bw - aw)) / det;
        pC = aw - pA * ax - pB * ay;
      }

      // Sort the corners by row.
      let tx, ty;
      if (ay > by) { tx = ax; ax = bx; bx = tx; ty = ay; ay = by; by = ty; }
      if (by > cyp) { tx = bx; bx = cxp; cxp = tx; ty = by; by = cyp; cyp = ty; }
      if (ay > by) { tx = ax; ax = bx; bx = tx; ty = ay; ay = by; by = ty; }

      const j0 = Math.max(0, Math.ceil(ay - 0.5));
      const j1 = Math.min(H - 1, Math.floor(cyp - 0.5));
      if (j0 > j1) continue;
      if (j0 < rowMin) rowMin = j0;
      if (j1 > rowMax) rowMax = j1;
      const dAC = cyp - ay;
      const dAB = by - ay;
      const dBC = cyp - by;

      for (let j = j0; j <= j1; j += 1) {
        const yc = j + 0.5;
        const xLong = dAC > 0 ? ax + ((cxp - ax) * (yc - ay)) / dAC : ax;
        let xShort;
        if (yc < by) xShort = dAB > 0 ? ax + ((bx - ax) * (yc - ay)) / dAB : bx;
        else xShort = dBC > 0 ? bx + ((cxp - bx) * (yc - by)) / dBC : bx;
        const xl = xLong < xShort ? xLong : xShort;
        const xr = xLong < xShort ? xShort : xLong;
        const i0 = Math.max(0, Math.ceil(xl - 0.5));
        const i1 = Math.min(W - 1, Math.floor(xr - 0.5));
        const rowBase = j * W;
        if (opaque) {
          for (let i = i0; i <= i1; i += 1) {
            const idx = rowBase + i;
            if (stamp[idx] !== id) {
              stamp[idx] = id;
              blocked[idx] += 1;
            }
          }
        } else {
          // Path length along the ray, from the depth of this face there.
          const sign = facing ? -1 : 1;
          const Yp = (cy + S.jy - yc) / pxPerCm - S.y;
          for (let i = i0; i <= i1; i += 1) {
            const idx = rowBase + i;
            const invW = pA * (i + 0.5) + pB * yc + pC;
            if (invW <= 1e-9) continue;
            const Xp = (cx + S.jx - (i + 0.5)) / pxPerCm - S.x;
            const along = Math.sqrt(D * D + Xp * Xp + Yp * Yp) / D;
            thick[idx] += (sign * along) / invW;
            stamp[idx] = id;
          }
        }
      }
    }

    if (!opaque) {
      for (let j = rowMin; j <= rowMax; j += 1) {
        const rowBase = j * W;
        for (let i = 0; i < W; i += 1) {
          const idx = rowBase + i;
          if (stamp[idx] !== id) continue;
          const L = thick[idx];
          thick[idx] = 0;
          if (L > 1e-4) {
            blocked[idx] += 1;
            shade[idx] += 1 - Math.exp((logT * L) / refCm);
          }
        }
      }
    }
  }

  if (opaque) {
    for (let i = 0; i < blocked.length; i += 1) shade[i] = blocked[i] / N;
  } else {
    for (let i = 0; i < shade.length; i += 1) shade[i] /= N;
  }

  return { width: W, height: H, pxPerCm, samples: N, blocked, shade, opaque };
}

// ─── Reading the finished shadow ────────────────────────────────────

/**
 * Is any part of the paper shut off from the WHOLE lamp — a true umbra?
 *
 * Asked of the painted rays, not of the shadow's bounding box: a letter's
 * narrow arms can be thinner than the penumbra even when the letter as a whole
 * is wide, and then those arms have no dark core however big the box is.
 */
export function hasUmbra(field) {
  const { blocked, samples } = field;
  for (let i = 0; i < blocked.length; i += 1) if (blocked[i] >= samples) return true;
  return false;
}

/**
 * What the picture on the paper measures: bounding boxes of the lit-anywhere
 * (outer) and blocked-everywhere (inner) regions, in the viewer frame and cm,
 * the shadow's area, and how many holes it has.
 */
export function measureField(field, fraction = 0.5) {
  const { width: W, height: H, pxPerCm: PX, blocked, samples: N } = field;
  const cx = W / 2;
  const cy = H / 2;
  const box = (test) => {
    let l = W, r = -1, t = H, b = -1;
    for (let j = 0; j < H; j += 1) {
      for (let i = 0; i < W; i += 1) {
        if (!test(blocked[j * W + i])) continue;
        if (i < l) l = i;
        if (i > r) r = i;
        if (j < t) t = j;
        if (j > b) b = j;
      }
    }
    if (r < 0) return null;
    return { left: (l - cx) / PX, right: (r + 1 - cx) / PX, top: (cy - t) / PX, bottom: (cy - (b + 1)) / PX, px: { l, r, t, b } };
  };
  const outer = box((v) => v > 0);
  const inner = box((v) => v >= N);
  const main = box((v) => v >= N * fraction);
  const touchesEdge = Boolean(outer && (outer.px.l === 0 || outer.px.r === W - 1 || outer.px.t === 0 || outer.px.b === H - 1));

  let area = 0;
  let holes = 0;
  let hullArea = 0;
  let sumRow = 0;
  if (main) {
    const { l, r, t, b } = main.px;
    const w = r - l + 1;
    const h = b - t + 1;
    const solidMask = new Uint8Array(w * h);
    const leftMost = new Int32Array(h).fill(-1);
    const rightMost = new Int32Array(h).fill(-1);
    for (let j = t; j <= b; j += 1) {
      for (let i = l; i <= r; i += 1) {
        if (blocked[j * W + i] < N * fraction) continue;
        solidMask[(j - t) * w + (i - l)] = 1;
        area += 1;
        sumRow += j - t + 0.5;
        if (leftMost[j - t] < 0) leftMost[j - t] = i;
        rightMost[j - t] = i;
      }
    }
    // Holes: background regions inside the box that do not reach its border.
    const seen = new Uint8Array(w * h);
    const stack = [];
    const flood = (start) => {
      let reachesBorder = false;
      stack.push(start);
      seen[start] = 1;
      while (stack.length) {
        const p = stack.pop();
        const pi = p % w;
        const pj = (p - pi) / w;
        if (pi === 0 || pj === 0 || pi === w - 1 || pj === h - 1) reachesBorder = true;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = pi + di;
          const nj = pj + dj;
          if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
          const q = nj * w + ni;
          if (seen[q] || solidMask[q]) continue;
          seen[q] = 1;
          stack.push(q);
        }
      }
      return reachesBorder;
    };
    for (let p = 0; p < w * h; p += 1) {
      if (solidMask[p] || seen[p]) continue;
      if (!flood(p)) holes += 1;
    }
    // Convex hull of the row extremes, for a convexity measure.
    const pts = [];
    for (let j = 0; j < h; j += 1) {
      if (leftMost[j] < 0) continue;
      pts.push([leftMost[j] - l, j], [rightMost[j] - l + 1, j], [leftMost[j] - l, j + 1], [rightMost[j] - l + 1, j + 1]);
    }
    pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cross = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
    const lower = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i -= 1) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
    for (let i = 0; i < hull.length; i += 1) {
      const p = hull[i];
      const q = hull[(i + 1) % hull.length];
      hullArea += p[0] * q[1] - q[0] * p[1];
    }
    hullArea = Math.abs(hullArea) / 2;
  }

  const px2 = PX * PX;
  const widthCm = main ? main.right - main.left : 0;
  const heightCm = main ? main.top - main.bottom : 0;
  return {
    outer,
    inner,
    main,
    touchesEdge,
    areaCm2: area / px2,
    widthCm,
    heightCm,
    holes,
    fill: main && widthCm * heightCm > 0 ? area / px2 / (widthCm * heightCm) : 0,
    convexity: hullArea > 0 ? Math.min(area / hullArea, 1) : 1,
    aspect: heightCm > 0 ? widthCm / heightCm : 1,
    /** Where the shadow's centre of mass sits, as a fraction of its height from the top: ⅓ or ⅔ for a triangle, ½ for a symmetric shape. */
    centroidFromTop: main && area > 0 ? sumRow / area / (main.px.b - main.px.t + 1) : 0.5,
  };
}

/**
 * A plain-English name for the shadow that actually landed, worked out from
 * the picture rather than looked up — so it is right for a rotated cube, a
 * pipe seen end-on, or a shape the child has turned to some odd angle.
 */
export function describeShadow({ shape, rotation = 0, field }) {
  const def = SHAPE_DEFS[shape] ?? SHAPE_DEFS.cylinder;
  const m = measureField(field);
  if (!m.main) return "no shadow at all";
  if (m.touchesEdge) return "bigger than the paper — its edges are running off the screen";

  const cosT = Math.cos(rotation);
  if (def.group === "cutout") {
    if (def.turn === "y" && Math.abs(cosT) < 0.28) return "a narrow bar — the cut-out seen edge-on";
    const name = def.label.replace(/^Letter /, "the letter ").replace(/^Plus sign$/, "a plus sign").replace(/^(Star|Heart|Arrow)$/, (s) => `a ${s.toLowerCase()}`);
    if (def.chiral && cosT < -0.28) return `${name} back to front — the torch is looking at its back`;
    if (Math.abs(cosT) < 0.9) return `${name}, squashed narrower because it is turned away`;
    return name;
  }

  if (m.holes > 0) return "a ring — light shines straight through the hole in the middle";
  // Measured on a pixel grid, so a smooth edge reads a little less convex and a
  // little less full than it is: the thresholds leave that much room.
  if (m.convexity >= 0.94) {
    const round = Math.abs(m.aspect - 1) < 0.05;
    const centred = Math.abs(m.centroidFromTop - 0.5) < 0.03;
    if (m.fill >= 0.95) return round ? "a square" : "a rectangle";
    if (Math.abs(m.fill - Math.PI / 4) < 0.035 && round && centred) return "a circle";
    if (Math.abs(m.fill - Math.PI / 4) < 0.035 && centred && m.aspect > 0.4 && m.aspect < 2.5) return "an oval";
    // A triangle has its weight a third of the way up from its base; a diamond
    // has the same half-fill but is balanced in the middle.
    if (Math.abs(m.fill - 0.5) < 0.04) {
      if (Math.abs(m.centroidFromTop - 1 / 3) < 0.04 || Math.abs(m.centroidFromTop - 2 / 3) < 0.04) return "a triangle";
      if (centred) return round ? "a diamond" : "a rhombus";
    }
  }
  return `the outline of the ${def.label.toLowerCase()} as the torch sees it`;
}

// ─── Drawing the rays ───────────────────────────────────────────────

/**
 * The straight lines to draw: lamp → a point on the solid → the screen.
 *
 * A fan of them through evenly-spaced points of the shadow's outline (each
 * passing exactly through a vertex of the drawn solid and landing exactly on
 * the outline), and for a wide lamp the four extreme rays that set the umbra's
 * and penumbra's edges. Points are in world cm: x, height above the axis, z.
 */
export function lightRays({ shape, rotation = 0, lightZ, objectZ, screenZ, source = "point", fan = 14 }) {
  const { world } = placeSolid({ shape, rotation, objectZ });
  const n = world.length / 3;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const rays = [];
  const make = (S, i, kind) => ({
    kind,
    from: [S.x, S.y, lightZ],
    through: [world[i * 3], world[i * 3 + 1], world[i * 3 + 2]],
    to: [xs[i], ys[i], screenZ],
  });

  // Fan from the middle of the lamp, through the outline's vertices.
  const centre = { x: 0, y: 0 };
  projectAll(world, centre, lightZ, screenZ, xs, ys);
  const order = Array.from({ length: n }, (_, i) => i).sort((p, q) => xs[p] - xs[q] || ys[p] - ys[q]);
  const cross = (o, a, c) => (xs[a] - xs[o]) * (ys[c] - ys[o]) - (ys[a] - ys[o]) * (xs[c] - xs[o]);
  const lower = [];
  for (const p of order) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const p = order[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  if (hull.length > 0) {
    // Evenly along the outline's length.
    const seg = hull.map((p, i) => {
      const q = hull[(i + 1) % hull.length];
      return Math.hypot(xs[q] - xs[p], ys[q] - ys[p]);
    });
    const total = seg.reduce((s, v) => s + v, 0);
    const chosen = new Set();
    for (let f = 0; f < fan; f += 1) {
      const target = (f / fan) * total;
      let run = 0;
      let pick = 0;
      for (let i = 0; i < hull.length; i += 1) {
        if (run + seg[i] / 2 >= target) { pick = i; break; }
        run += seg[i];
        pick = i;
      }
      chosen.add(hull[pick]);
    }
    for (const i of chosen) rays.push(make(centre, i, "fan"));
  }

  // The lamp's ends: which pair of rays bounds the penumbra, which the umbra.
  if (source === "broad") {
    const src = SOURCES.broad;
    const ends = [-1, 1].map((e) => ({ x: (e * src.width) / 2, y: 0 }));
    const edges = ends.map((S) => {
      projectAll(world, S, lightZ, screenZ, xs, ys);
      let lo = 0, hi = 0;
      for (let i = 1; i < n; i += 1) {
        if (xs[i] < xs[lo]) lo = i;
        if (xs[i] > xs[hi]) hi = i;
      }
      return { S, lo, hi, xLo: xs[lo], xHi: xs[hi] };
    });
    // The outer edge on each side comes from whichever lamp end reaches furthest.
    const outerEnd = { hi: edges[0].xHi >= edges[1].xHi ? 0 : 1, lo: edges[0].xLo <= edges[1].xLo ? 0 : 1 };
    for (const side of ["hi", "lo"]) {
      for (const e of [0, 1]) {
        projectAll(world, edges[e].S, lightZ, screenZ, xs, ys);
        rays.push(make(edges[e].S, edges[e][side], e === outerEnd[side] ? "outer" : "inner"));
      }
    }
  }
  return rays;
}

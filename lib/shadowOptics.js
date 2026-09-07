// ─── Shadow formation ───────────────────────────────────────────────
// The geometry behind the primary-school light lab: straight-line
// propagation, how far a shadow spreads, what a wide lamp does to its edges,
// and how much light a material lets through.
//
// Every rule the scene claims to prove is derived here and checked by
// `tests/unit/shadow-optics.test.mjs`, so the simulation cannot quietly start
// teaching the opposite of the textbook.
// ─────────────────────────────────────────────────────────────────────

/** Bench limits in centimetres — the floor ruler the child drags along. */
export const BENCH = { min: 0, max: 120, lightHome: 12, objectHome: 55, screenHome: 105 };

/**
 * How much light each material lets straight through.
 *
 * `transmission` is the fraction of rays that carry on; `scatter` is how much
 * of what gets through is thrown sideways, which is what turns a translucent
 * object's shadow soft and grey rather than merely lighter.
 */
export const MATERIALS = {
  opaque: {
    label: "Opaque",
    example: "wood or metal",
    transmission: 0,
    scatter: 0,
    shadow: "a solid, sharp, black shadow",
  },
  translucent: {
    label: "Translucent",
    example: "frosted glass or tracing paper",
    transmission: 0.45,
    scatter: 0.7,
    shadow: "a pale, soft grey shadow",
  },
  transparent: {
    label: "Transparent",
    example: "clear acrylic",
    transmission: 0.94,
    scatter: 0.05,
    shadow: "almost no shadow at all",
  },
};

export const MATERIAL_OPTIONS = Object.entries(MATERIALS).map(([value, m]) => ({
  value,
  label: m.label,
  title: `${m.label} — ${m.example}`,
}));

/** Source width in cm: a bare bulb filament versus a long fluorescent tube. */
export const SOURCES = {
  point: { label: "Pinpoint bulb", width: 0.2, note: "a tiny source gives crisp edges" },
  broad: { label: "Wide lamp", width: 6, note: "a wide source smears the edge into a penumbra" },
};

// ─── Shape silhouettes ──────────────────────────────────────────────

/**
 * The outline a solid presents to the light, as half-width and half-height in
 * centimetres, for a given rotation.
 *
 * This is the heart of the "same object, different shadow" module. A cylinder
 * standing up blocks a rectangle of light; turned to point at the screen it
 * blocks a circle. A sphere, famously, cannot be turned into anything else.
 */
export function silhouette(shape, rotationRad = 0, size = 10) {
  const c = Math.abs(Math.cos(rotationRad));
  const s = Math.abs(Math.sin(rotationRad));
  const r = size / 2;

  switch (shape) {
    case "cylinder": {
      // Rotating the axis out of the vertical: the projected outline is the
      // axis length foreshortened by cos, plus the end-cap radius by sin.
      const halfHeight = r * 1.2 * c + r * 0.55 * s;
      const halfWidth = r * 0.55;
      return {
        halfWidth,
        halfHeight,
        kind: s > 0.94 ? "circle" : c > 0.94 ? "rectangle" : "capsule",
        description: s > 0.94 ? "a circle" : c > 0.94 ? "a rectangle" : "a rounded rectangle",
      };
    }
    case "cube": {
      // Turning a square presents its diagonal: widest at 45°, by a factor √2.
      const halfWidth = r * (c + s);
      return {
        halfWidth,
        halfHeight: r,
        kind: "polygon",
        description: s > 0.3 && c > 0.3 ? "a wider rectangle — you are seeing the diagonal" : "a square",
      };
    }
    case "cone":
      return {
        halfWidth: r * 0.62,
        halfHeight: r * 1.1,
        kind: "triangle",
        description: "a triangle, whichever way you spin it about its axis",
      };
    case "sphere":
      // The one shape rotation cannot change — every silhouette is the same circle.
      return { halfWidth: r, halfHeight: r, kind: "circle", description: "a circle, always" };
    case "letterT":
      return {
        halfWidth: r * (0.85 * c + 0.16 * s),
        halfHeight: r,
        kind: "letter",
        description: c > 0.7 ? "the letter T" : "a narrow bar — the T turned edge-on",
      };
    case "letterL":
      return {
        halfWidth: r * (0.7 * c + 0.16 * s),
        halfHeight: r,
        kind: "letter",
        description: c > 0.7 ? "the letter L" : "a narrow bar — the L turned edge-on",
      };
    default:
      return { halfWidth: r, halfHeight: r, kind: "circle", description: "a circle" };
  }
}

export const SHAPES = ["cylinder", "cube", "cone", "sphere", "letterT", "letterL"];

export const SHAPE_LABELS = {
  cylinder: "Cylinder",
  cube: "Cube",
  cone: "Cone",
  sphere: "Sphere",
  letterT: "Letter T",
  letterL: "Letter L",
};

// ─── Shadow geometry ────────────────────────────────────────────────

/**
 * How many times bigger the shadow is than the object.
 *
 * M = (light→screen) ÷ (light→object), which rearranges to 1 + b/a. Both
 * primary rules the lab is built to prove are visible in that one expression:
 * shrink a (light closer) and M grows; grow b (screen further) and M grows.
 */
export function magnification(lightToObject, objectToScreen) {
  const a = Math.max(lightToObject, 0.1);
  const b = Math.max(objectToScreen, 0);
  return 1 + b / a;
}

/**
 * Umbra and penumbra half-widths on the screen.
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
 * How dark the shadow is, 0 (invisible) to 1 (pitch black).
 *
 * Straight from what the material transmits. The scatter term only softens
 * the edge — it cannot make a translucent shadow darker than the light it
 * blocked.
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
  return (
    solved.horizontal.penumbra <= screen.screenHalfWidthCm &&
    solved.vertical.penumbra <= screen.screenHalfHeightCm
  );
}

/**
 * One solve for the whole bench, so the 3D scene, the ruler readouts and the
 * quiz answers can never disagree about how big the shadow is.
 */
export function solveShadow({
  lightZ,
  objectZ,
  screenZ,
  shape = "cylinder",
  rotation = 0,
  material = "opaque",
  source = "point",
  size = 10,
}) {
  const a = Math.max(objectZ - lightZ, 0.1);
  const b = Math.max(screenZ - objectZ, 0);
  const outline = silhouette(shape, rotation, size);
  const sourceWidth = (SOURCES[source] ?? SOURCES.point).width;

  const horizontal = shadowBands(outline.halfWidth, a, b, sourceWidth);
  const vertical = shadowBands(outline.halfHeight, a, b, sourceWidth);
  const darkness = shadowDarkness(material);

  return {
    lightToObject: a,
    objectToScreen: b,
    lightToScreen: a + b,
    magnification: horizontal.magnification,
    outline,
    horizontal,
    vertical,
    sourceWidth,
    darkness,
    material: MATERIALS[material] ?? MATERIALS.opaque,
    /** A transparent object casts nothing worth calling a shadow. */
    castsShadow: darkness > 0.1,
    brightness: screenBrightness(a + b),
    shadowWidthCm: horizontal.penumbra * 2,
    shadowHeightCm: vertical.penumbra * 2,
  };
}

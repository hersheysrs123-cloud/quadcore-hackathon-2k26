// ─── The solids on the shadow bench ─────────────────────────────────
// One definition per shape, and ONE mesh per definition. That mesh is what the
// scene draws and it is also what the shadow is cast from, so the solid and its
// shadow cannot disagree: there is no separate "silhouette" to drift out of
// step with the thing on the stand (the old lab had exactly that bug — the
// ring was drawn 2.9 cm across and shadowed as if it were 4).
//
// Everything is in centimetres, centred on the bounding box, in the bench's
// world frame: +x is world X, +y is up, +z runs from the torch toward the
// screen. The camera looks down the bench along +z, so what it sees as
// "right" is −x. Flat cut-outs are therefore drawn from a "reading frame"
// (u to the right AS THE CAMERA SEES IT, v up) and mirrored into x = −u, so a
// letter reads the right way round from the torch's side.
// ─────────────────────────────────────────────────────────────────────

import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Depth of a flat cut-out, cm. Thick enough to read as a solid card. */
const CUTOUT_DEPTH = 2.5;

// ─── Building blocks ────────────────────────────────────────────────

const circlePoints = (r, n = 72) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [r * Math.cos(a), r * Math.sin(a)];
  });

/**
 * A polygon in the reading frame, extruded along z.
 *
 * `holes` are further polygons cut out of it. u is negated so the finished
 * solid, seen from the camera behind the torch, reads the way it was drawn.
 */
function extrudeOutline(points, depth = CUTOUT_DEPTH, holes = []) {
  const toVec = ([u, v]) => new THREE.Vector2(-u, v);
  const shape = new THREE.Shape(points.map(toVec));
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(toVec)));
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1, curveSegments: 1 });
}

const polar = (n, outer, inner) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = Math.PI / 2 + (i / (n * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? outer : inner;
    return [r * Math.cos(a), r * Math.sin(a)];
  });

/** The classic heart curve, sampled finely so its shadow's cusp stays sharp. */
function heartPoints(n = 96) {
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([x * 0.36, y * 0.36]);
  }
  return pts;
}

function merge(list) {
  const nonIndexed = list.map((g) => {
    const flat = g.index ? g.toNonIndexed() : g;
    return flat;
  });
  const total = nonIndexed.reduce((n, g) => n + g.attributes.position.count, 0);
  const positions = new Float32Array(total * 3);
  let offset = 0;
  for (const g of nonIndexed) {
    positions.set(g.attributes.position.array, offset);
    offset += g.attributes.position.array.length;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return merged;
}

// ─── The shape shelf ────────────────────────────────────────────────

/**
 * `turn` is the axis the "turn the shape" slider spins it about: "y" is a spin
 * on the stand, "x" tips it toward the screen. `chiral` shapes have a mirror
 * image that is a different shape (an L reversed is not an L).
 */
export const SHAPE_DEFS = {
  cylinder: {
    label: "Cylinder",
    group: "solid",
    turn: "x",
    build: () => new THREE.CylinderGeometry(2.75, 2.75, 12, 72),
  },
  cube: {
    label: "Cube",
    group: "solid",
    turn: "y",
    build: () => new THREE.BoxGeometry(10, 10, 10),
  },
  cuboid: {
    label: "Cuboid (brick)",
    group: "solid",
    turn: "y",
    build: () => new THREE.BoxGeometry(12, 5, 6),
  },
  sphere: {
    label: "Sphere",
    group: "solid",
    turn: "y",
    build: () => new THREE.SphereGeometry(5, 72, 44),
  },
  hemisphere: {
    label: "Hemisphere (dome)",
    group: "solid",
    turn: "x",
    build: () => {
      const dome = new THREE.SphereGeometry(5, 72, 24, 0, Math.PI * 2, 0, Math.PI / 2);
      const base = new THREE.CircleGeometry(5, 72);
      base.rotateX(Math.PI / 2);
      return merge([dome, base]);
    },
  },
  cone: {
    label: "Cone",
    group: "solid",
    turn: "x",
    build: () => new THREE.ConeGeometry(3.1, 11, 72),
  },
  pyramid: {
    label: "Square pyramid",
    group: "solid",
    turn: "x",
    build: () => {
      const g = new THREE.ConeGeometry(3.75 * Math.SQRT2, 10, 4);
      g.rotateY(Math.PI / 4);
      return g;
    },
  },
  prism: {
    label: "Triangular prism",
    group: "solid",
    turn: "y",
    build: () =>
      extrudeOutline(
        [
          [-4, -3.5],
          [4, -3.5],
          [0, 3.5],
        ],
        8,
      ),
  },
  octahedron: {
    label: "Octahedron (diamond)",
    group: "solid",
    turn: "y",
    build: () => new THREE.OctahedronGeometry(5.5),
  },
  ring: {
    label: "Ring (torus)",
    group: "solid",
    turn: "x",
    build: () => new THREE.TorusGeometry(3.6, 1.2, 36, 80),
  },
  pipe: {
    label: "Pipe (hollow tube)",
    group: "solid",
    turn: "x",
    // The wall's cross-section swept round the axis: outer wall, top rim, inner
    // wall, bottom rim. (Extruding a circle with a hole in it comes out with
    // its inner wall inside-out, and a shadow cast from that is wrong.)
    build: () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(2, -5),
          new THREE.Vector2(3, -5),
          new THREE.Vector2(3, 5),
          new THREE.Vector2(2, 5),
          new THREE.Vector2(2, -5),
        ],
        72,
      ),
  },
  capsule: {
    label: "Capsule (pill)",
    group: "solid",
    turn: "x",
    build: () => new THREE.CapsuleGeometry(2.5, 6, 14, 56),
  },
  egg: {
    label: "Egg",
    group: "solid",
    turn: "x",
    build: () => {
      const g = new THREE.SphereGeometry(1, 72, 44);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i += 1) {
        const y = p.getY(i);
        // Narrower toward the top, so it has a blunt end and a pointed one.
        const squeeze = 1 - 0.14 * y;
        p.setXYZ(i, p.getX(i) * 3.6 * squeeze, y * 5.4, p.getZ(i) * 3.6 * squeeze);
      }
      return g;
    },
  },
  star: {
    label: "Star",
    group: "cutout",
    turn: "y",
    build: () => extrudeOutline(polar(5, 5.6, 2.3)),
  },
  heart: {
    label: "Heart",
    group: "cutout",
    turn: "y",
    build: () => extrudeOutline(heartPoints()),
  },
  cross: {
    label: "Plus sign",
    group: "cutout",
    turn: "y",
    build: () =>
      extrudeOutline([
        [-1.7, 5.5],
        [1.7, 5.5],
        [1.7, 1.7],
        [5.5, 1.7],
        [5.5, -1.7],
        [1.7, -1.7],
        [1.7, -5.5],
        [-1.7, -5.5],
        [-1.7, -1.7],
        [-5.5, -1.7],
        [-5.5, 1.7],
        [-1.7, 1.7],
      ]),
  },
  arrow: {
    label: "Arrow",
    group: "cutout",
    turn: "y",
    build: () =>
      extrudeOutline([
        [0, 5.5],
        [4.2, 0.5],
        [1.4, 0.5],
        [1.4, -5.5],
        [-1.4, -5.5],
        [-1.4, 0.5],
        [-4.2, 0.5],
      ]),
  },
  letterT: {
    label: "Letter T",
    group: "cutout",
    turn: "y",
    build: () =>
      extrudeOutline([
        [-4.25, 5],
        [4.25, 5],
        [4.25, 2.6],
        [1.2, 2.6],
        [1.2, -5],
        [-1.2, -5],
        [-1.2, 2.6],
        [-4.25, 2.6],
      ]),
  },
  letterL: {
    label: "Letter L",
    group: "cutout",
    turn: "y",
    chiral: true,
    build: () =>
      extrudeOutline([
        [-3.5, 5],
        [-1.1, 5],
        [-1.1, -2.6],
        [3.5, -2.6],
        [3.5, -5],
        [-3.5, -5],
      ]),
  },
  letterF: {
    label: "Letter F",
    group: "cutout",
    turn: "y",
    chiral: true,
    build: () =>
      extrudeOutline([
        [-3, 5],
        [3.5, 5],
        [3.5, 2.6],
        [-0.6, 2.6],
        [-0.6, 1.4],
        [2.6, 1.4],
        [2.6, -0.9],
        [-0.6, -0.9],
        [-0.6, -5],
        [-3, -5],
      ]),
  },
};

export const SHAPES = Object.keys(SHAPE_DEFS);

export const SHAPE_LABELS = Object.fromEntries(SHAPES.map((s) => [s, SHAPE_DEFS[s].label]));

export const SHAPE_GROUPS = [
  { id: "solid", label: "Solid shapes", shapes: SHAPES.filter((s) => SHAPE_DEFS[s].group === "solid") },
  { id: "cutout", label: "Flat cut-outs", shapes: SHAPES.filter((s) => SHAPE_DEFS[s].group === "cutout") },
];

// ─── The finished solid ─────────────────────────────────────────────

const cache = new Map();

/** Signed volume of a triangle soup: positive when the faces point outward. */
function signedVolume(pos) {
  let vol = 0;
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
    const bx = pos[i + 3], by = pos[i + 4], bz = pos[i + 5];
    const cx = pos[i + 6], cy = pos[i + 7], cz = pos[i + 8];
    vol += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return vol / 6;
}

/**
 * The solid for a shape, built once.
 *
 * `geometry` is what the scene draws (triangle soup, centred, creased normals).
 * `positions`, `tris` and `normals` are the same triangles welded into unique
 * vertices, which is what the ray projection walks. `radius` is the distance
 * from the centre to the furthest point, so the bench can keep the lamp and
 * the screen clear of it whatever way it is turned.
 */
export function getSolid(shape) {
  const key = SHAPE_DEFS[shape] ? shape : "cylinder";
  if (cache.has(key)) return cache.get(key);

  let g = SHAPE_DEFS[key].build();
  g = g.index ? g.toNonIndexed() : g;
  g.computeBoundingBox();
  const centre = new THREE.Vector3();
  g.boundingBox.getCenter(centre);
  g.translate(-centre.x, -centre.y, -centre.z);

  // Faces must point outward, or the per-sample facing test would pick the
  // far side of the solid. Extrusions of a mirrored outline can come out the
  // wrong way round, so check the volume rather than trusting the builder.
  if (signedVolume(g.attributes.position.array) < 0) {
    const a = g.attributes.position.array;
    for (let i = 0; i < a.length; i += 9) {
      for (let k = 0; k < 3; k += 1) {
        const t = a[i + 3 + k];
        a[i + 3 + k] = a[i + 6 + k];
        a[i + 6 + k] = t;
      }
    }
  }
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  const geometry = toCreasedNormals(g, 0.7);
  geometry.computeBoundingSphere();

  // Weld into unique vertices.
  const soup = geometry.attributes.position.array;
  const index = new Map();
  const verts = [];
  const tris = new Uint32Array(soup.length / 3);
  for (let i = 0; i < soup.length / 3; i += 1) {
    const x = soup[i * 3], y = soup[i * 3 + 1], z = soup[i * 3 + 2];
    const k = `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
    let id = index.get(k);
    if (id === undefined) {
      id = verts.length / 3;
      index.set(k, id);
      verts.push(x, y, z);
    }
    tris[i] = id;
  }
  const positions = Float64Array.from(verts);

  const nTri = tris.length / 3;
  const normals = new Float64Array(nTri * 3);
  for (let t = 0; t < nTri; t += 1) {
    const a = tris[t * 3] * 3, b = tris[t * 3 + 1] * 3, c = tris[t * 3 + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-12) {
      normals[t * 3] = nx / len;
      normals[t * 3 + 1] = ny / len;
      normals[t * 3 + 2] = nz / len;
    }
  }

  let radius = 0;
  for (let i = 0; i < positions.length; i += 3) {
    radius = Math.max(radius, Math.hypot(positions[i], positions[i + 1], positions[i + 2]));
  }

  const solid = { shape: key, geometry, positions, tris, normals, radius, turn: SHAPE_DEFS[key].turn };
  cache.set(key, solid);
  return solid;
}

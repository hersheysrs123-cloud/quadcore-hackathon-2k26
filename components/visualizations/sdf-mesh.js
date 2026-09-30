import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ─── Signed-distance meshing ────────────────────────────────────────
// For shapes that are easy to describe and hard to model: a protein with a
// pocket carved to exactly the shape of its substrate is one `max(body,
// -pocket)`, where building it from primitives left the pocket as boxes
// stuck on the outside.
//
// A signed distance is negative inside the solid. `meshSdf` samples it on a
// grid and runs three's marching cubes over the samples once, at build time;
// the result is an ordinary indexed BufferGeometry with smooth normals.
// ─────────────────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Smooth maximum: an intersection or subtraction with a rounded seam `k` wide. */
export function smax(a, b, k) {
  const h = clamp(0.5 - (0.5 * (b - a)) / k, 0, 1);
  return a * h + b * (1 - h) + k * h * (1 - h);
}

/** Smooth minimum: a union with a rounded seam `k` wide. */
export function smin(a, b, k) {
  return -smax(-a, -b, k);
}

/**
 * Signed distance from (px, py) to a closed polygon given as [[x, y], ...],
 * negative inside. Either winding works. (Inigo Quilez's polygon SDF.)
 */
export function sdPolygon(px, py, poly) {
  const n = poly.length;
  let d = (px - poly[0][0]) ** 2 + (py - poly[0][1]) ** 2;
  let s = 1;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const [vix, viy] = poly[i];
    const [vjx, vjy] = poly[j];
    const ex = vjx - vix;
    const ey = vjy - viy;
    const wx = px - vix;
    const wy = py - viy;
    const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1);
    const bx = wx - ex * t;
    const by = wy - ey * t;
    d = Math.min(d, bx * bx + by * by);
    const c1 = py >= viy;
    const c2 = py < vjy;
    const c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}

/** A polygon in the xy plane extruded to |z| ≤ halfDepth. */
export function sdExtrudedPolygon(px, py, pz, poly, halfDepth) {
  const d2 = sdPolygon(px, py, poly);
  const dz = Math.abs(pz) - halfDepth;
  const outside = Math.hypot(Math.max(d2, 0), Math.max(dz, 0));
  return Math.min(Math.max(d2, dz), 0) + outside;
}

/**
 * Mesh the zero level set of `sdf(x, y, z)` inside the cube of half-size
 * `half` around `centre`.
 *
 * `resolution` is samples per side; the cell is 2·half / resolution, and a
 * feature much thinner than two cells will not survive. Allocation is
 * resolution³ floats (several of them), so this is a build-time call only.
 */
export function meshSdf(sdf, { half = 2, resolution = 64, maxPolys = 60000, centre = [0, 0, 0] } = {}) {
  const [cx, cy, cz] = centre;
  // It reads the material's flatShading while building, so it needs a real one.
  const scratchMaterial = new THREE.MeshBasicMaterial();
  const mc = new MarchingCubes(resolution, scratchMaterial, false, false, maxPolys);
  mc.isolation = 0;
  const n = resolution;
  const h = n / 2;
  const field = mc.field;
  for (let z = 0; z < n; z += 1) {
    const pz = ((z - h) / h) * half + cz;
    for (let y = 0; y < n; y += 1) {
      const py = ((y - h) / h) * half + cy;
      const row = z * n * n + y * n;
      for (let x = 0; x < n; x += 1) {
        // Marching cubes treats values above the isolation as inside.
        field[row + x] = -sdf(((x - h) / h) * half + cx, py, pz);
      }
    }
  }
  mc.update();

  const count = mc.count;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i += 1) positions[i] = mc.positionArray[i] * half + centre[i % 3];
  mc.geometry.dispose();
  scratchMaterial.dispose();

  const raw = new THREE.BufferGeometry();
  raw.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  // Neighbouring cells emit the same edge vertex; welding them is what lets
  // the normals average across triangles instead of shading every facet.
  const geometry = mergeVertices(raw, 1e-5);
  raw.dispose();
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

// ─── Best-fit rigid placement ───────────────────────────────────────
// The rotation and translation that lay one set of points over another as
// closely as a rigid body can (least squares), by Horn's quaternion method.
//
// The organic builder uses it to start each monomer of a polymerisation in
// the pose that already matches its place in the chain, so the animation
// shows only what the chemistry changes — the C=C opening and the carbon
// going from trigonal to tetrahedral — rather than whole molecules tumbling
// through each other on their way there.
// ─────────────────────────────────────────────────────────────────────

/** Weighted centroid of `points` ([x, y, z] each). */
function centroid(points, weights) {
  let w = 0;
  const c = [0, 0, 0];
  points.forEach((p, i) => {
    const k = weights ? weights[i] : 1;
    w += k;
    c[0] += p[0] * k;
    c[1] += p[1] * k;
    c[2] += p[2] * k;
  });
  return c.map((v) => v / w);
}

/**
 * Eigenvector of the largest eigenvalue of a symmetric 4×4 matrix, by cyclic
 * Jacobi rotations. Small and exact enough; it converges in a handful of
 * sweeps for a matrix this size.
 */
function dominantEigenvector(m) {
  const a = m.map((row) => row.slice());
  const v = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
  for (let sweep = 0; sweep < 50; sweep += 1) {
    let off = 0;
    for (let p = 0; p < 4; p += 1) for (let q = p + 1; q < 4; q += 1) off += a[p][q] * a[p][q];
    if (off < 1e-22) break;
    for (let p = 0; p < 4; p += 1) {
      for (let q = p + 1; q < 4; q += 1) {
        if (Math.abs(a[p][q]) < 1e-30) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < 4; k += 1) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < 4; k += 1) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 4; k += 1) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  let best = 0;
  for (let i = 1; i < 4; i += 1) if (a[i][i] > a[best][best]) best = i;
  return [v[0][best], v[1][best], v[2][best], v[3][best]];
}

/** Rotates [x, y, z] by the unit quaternion [w, x, y, z]. */
export function rotateByQuaternion(q, p) {
  const [w, qx, qy, qz] = q;
  // v' = v + 2w(q×v) + 2q×(q×v)
  const tx = 2 * (qy * p[2] - qz * p[1]);
  const ty = 2 * (qz * p[0] - qx * p[2]);
  const tz = 2 * (qx * p[1] - qy * p[0]);
  return [
    p[0] + w * tx + (qy * tz - qz * ty),
    p[1] + w * ty + (qz * tx - qx * tz),
    p[2] + w * tz + (qx * ty - qy * tx),
  ];
}

/**
 * The rigid motion carrying `from` onto `to` (same length, paired by index)
 * with the least weighted squared error.
 *
 * Returns the rotation as a unit quaternion [w, x, y, z] and an `apply(p)`
 * that rotates about `from`'s centroid and moves it to `to`'s.
 */
export function bestFitRigid(from, to, weights) {
  if (from.length !== to.length || from.length === 0) {
    throw new Error("bestFitRigid needs two equal, non-empty point sets");
  }
  const cf = centroid(from, weights);
  const ct = centroid(to, weights);
  let sxx = 0, sxy = 0, sxz = 0, syx = 0, syy = 0, syz = 0, szx = 0, szy = 0, szz = 0;
  from.forEach((p, i) => {
    const k = weights ? weights[i] : 1;
    const a = [p[0] - cf[0], p[1] - cf[1], p[2] - cf[2]];
    const b = [to[i][0] - ct[0], to[i][1] - ct[1], to[i][2] - ct[2]];
    sxx += k * a[0] * b[0]; sxy += k * a[0] * b[1]; sxz += k * a[0] * b[2];
    syx += k * a[1] * b[0]; syy += k * a[1] * b[1]; syz += k * a[1] * b[2];
    szx += k * a[2] * b[0]; szy += k * a[2] * b[1]; szz += k * a[2] * b[2];
  });
  const n = [
    [sxx + syy + szz, syz - szy, szx - sxz, sxy - syx],
    [syz - szy, sxx - syy - szz, sxy + syx, szx + sxz],
    [szx - sxz, sxy + syx, -sxx + syy - szz, syz + szy],
    [sxy - syx, szx + sxz, syz + szy, -sxx - syy + szz],
  ];
  const q = dominantEigenvector(n);
  const len = Math.hypot(...q) || 1;
  const quat = q.map((v) => v / len);
  const apply = (p) => {
    const r = rotateByQuaternion(quat, [p[0] - cf[0], p[1] - cf[1], p[2] - cf[2]]);
    return [r[0] + ct[0], r[1] + ct[1], r[2] + ct[2]];
  };
  return { quaternion: quat, apply };
}

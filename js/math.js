// Core math shared by every model.
// Vectors are plain arrays [x, y, z]. Quaternions are [w, x, y, z].

export const PI = Math.PI;

/** Unit axis from two angles in degrees: azimuth (around z) and polar (down from +z). */
export function axisFromAngles(azDeg, polDeg) {
  const az = (azDeg * PI) / 180;
  const pol = (polDeg * PI) / 180;
  return [Math.sin(pol) * Math.cos(az), Math.sin(pol) * Math.sin(az), Math.cos(pol)];
}

/** Keep the angle in [0, π]: a turn by θ > π about n equals a turn by 2π − θ about −n. */
export function canonical(axis, spin) {
  const s = ((spin % (2 * PI)) + 2 * PI) % (2 * PI);
  if (s <= PI) return { axis, angle: s };
  return { axis: axis.map((c) => -c), angle: 2 * PI - s };
}

/** Unit quaternion for a turn by `angle` about the unit vector `axis`. */
export function quatFromAxisAngle(axis, angle) {
  const s = Math.sin(angle / 2);
  return [Math.cos(angle / 2), axis[0] * s, axis[1] * s, axis[2] * s];
}

/** Hamilton product of two quaternions. */
export function quatMul([a1, b1, c1, d1], [a2, b2, c2, d2]) {
  return [
    a1 * a2 - b1 * b2 - c1 * c2 - d1 * d2,
    a1 * b2 + b1 * a2 + c1 * d2 - d1 * c2,
    a1 * c2 - b1 * d2 + c1 * a2 + d1 * b2,
    a1 * d2 + b1 * c2 - c1 * b2 + d1 * a2,
  ];
}

/** 3×3 rotation matrix (array of rows) from a unit quaternion. */
export function matrixFromQuat([w, x, y, z]) {
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
  ];
}

/** Axis-angle ball: the turn by θ about n sits at the point θ·n (inside a ball of radius π). */
export function ballPoint(axis, angle) {
  return axis.map((c) => c * angle);
}

/** Stereographic projection of the 4D unit sphere S³ from q = −1 into 3D. */
export function stereo([w, x, y, z]) {
  const d = 1 + w;
  return [x / d, y / d, z / d];
}

/** ZYZ Euler angles: R = Rz(α) · Ry(β) · Rz(γ), with α, γ in [0, 2π) and β in [0, π]. */
export function zyzAngles(R) {
  const wrap = (a) => (a + 2 * PI) % (2 * PI);
  const beta = Math.acos(Math.max(-1, Math.min(1, R[2][2])));
  if (Math.sin(beta) < 1e-6) {
    // Gimbal lock: only α + γ (β = 0) or α − γ (β = π) is defined. Put it all in α.
    const alpha = beta < 1 ? Math.atan2(R[1][0], R[0][0]) : Math.atan2(-R[1][0], -R[0][0]);
    return { alpha: wrap(alpha), beta, gamma: 0 };
  }
  return {
    alpha: wrap(Math.atan2(R[1][2], R[0][2])),
    beta,
    gamma: wrap(Math.atan2(R[2][1], -R[2][0])),
  };
}

/** Conjugate (inverse) of a unit quaternion. */
export function quatConj([w, x, y, z]) {
  return [w, -x, -y, -z];
}

export function quatNormalize(q) {
  const n = Math.hypot(...q);
  return q.map((c) => c / n);
}

/** Ball point of any unit quaternion. q and −q give the same rotation and land on the same point. */
export function ballFromQuat(q) {
  const [w, x, y, z] = q[0] < 0 ? q.map((c) => -c) : q;
  const s = Math.hypot(x, y, z);
  if (s < 1e-9) return [0, 0, 0];
  const angle = 2 * Math.atan2(s, w); // 0 .. π
  return [(x / s) * angle, (y / s) * angle, (z / s) * angle];
}

/** Angle (radians) of the rotation that takes a to b. */
export function angleBetween(a, b) {
  const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, d));
}

/** Spherical linear interpolation: the shortest, constant-speed path from rotation a to rotation b. */
export function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0) { b = b.map((c) => -c); d = -d; } // q and −q are the same rotation: take the short way
  if (d > 0.9995) return quatNormalize(a.map((c, i) => c + (b[i] - c) * t));
  const om = Math.acos(d);
  const ka = Math.sin((1 - t) * om) / Math.sin(om);
  const kb = Math.sin(t * om) / Math.sin(om);
  return a.map((c, i) => ka * c + kb * b[i]);
}

/** Quaternion of R = Rz(α) · Ry(β) · Rz(γ). */
export function quatFromZYZ(alpha, beta, gamma) {
  const qz = (a) => quatFromAxisAngle([0, 0, 1], a);
  return quatMul(quatMul(qz(alpha), quatFromAxisAngle([0, 1, 0], beta)), qz(gamma));
}

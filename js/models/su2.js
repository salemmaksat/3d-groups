import * as THREE from 'three';
import { PI, ballFromQuat, quatFromAxisAngle } from '../math.js';
import { tube, cage, label, splitJumps } from '../scene.js';

/** SU(2) ball: the quaternion q = (cos θ/2, n sin θ/2) sits at θ·n, with θ from 0 to 2π.
 *  The whole outer sphere (θ = 2π) is a single point: q = −1. */
export function su2Point([w, x, y, z]) {
  const s = Math.hypot(x, y, z);
  if (s < 1e-9) return w > 0 ? [0, 0, 0] : [2 * PI, 0, 0];
  const theta = 2 * Math.atan2(s, w); // 0 .. 2π
  return [(x / s) * theta, (y / s) * theta, (z / s) * theta];
}

/** The full 0 → 720° spin about axis n, as points in the SU(2) ball. */
export function spin720(n, steps = 240) {
  return Array.from({ length: steps + 1 }, (_, i) => su2Point(quatFromAxisAngle(n, (4 * PI * i) / steps)));
}

export default {
  id: 'su2',
  name: 'SU(2) double cover',
  camera: [16, 12.5, 8.5],
  dotSize: 0.2,
  state: { inner: true },
  controls: [{ type: 'check', key: 'inner', label: 'Show the SO(3) part' }],

  build({ group, colors, state }) {
    group.add(cage(2 * PI, colors.cage, 0.035, 0.05));
    if (state.inner) {
      group.add(new THREE.Mesh(
        new THREE.SphereGeometry(PI, 48, 32),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.accent), transparent: true, opacity: 0.16, depthWrite: false }),
      ));
      group.add(label('inner ball: w > 0, one full copy of SO(3)', [0, 0, PI + 0.55], 0.45, colors.fg));
    }
    group.add(label('outer sphere = one point, q = −1', [0, 0, 2 * PI + 0.7], 0.5, colors.fg));
  },

  update({ colors, marker, dyn }, rot) {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.loop) });
    for (const run of splitJumps(spin720(rot.n), 3)) dyn.add(tube(run, 0.06, m));
    marker(ballFromQuat(rot.qRaw), colors.accent, 0.13);       // where SO(3) sees it
    return { dot: su2Point(rot.qRaw), q: rot.qRaw };
  },

  coords(rot) {
    const p = su2Point(rot.qRaw);
    const r = Math.hypot(...p);
    return [
      ['SU(2) element q', `(${rot.qRaw.map((c) => c.toFixed(2)).join(', ')})`],
      ['SU(2) radius', `${r.toFixed(2)} of 2π${r > PI + 1e-6 ? ' (outer shell: the −q copy)' : ''}`],
      ['same rotation as', `(${rot.qRaw.map((c) => (-c).toFixed(2)).join(', ')})`],
    ];
  },

  text: `
    <p>SO(3) has a bigger sibling, <b>SU(2)</b>: the unit quaternions themselves, before q and −q are treated as the same. It contains every rotation <b>twice</b>.</p>
    <p>Draw it as a ball of radius 2π: put q = (cos θ/2, n̂ sin θ/2) at θ·n̂. Spins under 180° fill the shaded inner ball (w &gt; 0), which is one full copy of SO(3). Spins from 180° to 360° fill the outer shell (w &lt; 0), which is the second copy: each rotation there is −q of a point in the inner ball. The entire outer sphere is one single point, q = −1, a spin of exactly 360°.</p>
    <p>Set the spin slider to 0 and press Play (the spin slider goes to 720°). The big yellow dot runs out along the orange line, reaches the outer sphere at 360°, comes back in from the opposite side, and gets home at 720°. The small teal dot is the same rotation seen in SO(3): it runs through its loop twice in that time.</p>
    <p>SU(2) has no gluing problem. It is a 3-sphere, and every loop in it can shrink to a point. Electron spin lives here: an electron must turn 720° to return to its starting state.</p>`,

  formulas: [
    { tex: 'SU(2) = \\{\\,q \\in \\mathbb H : |q| = 1\\,\\} \\cong S^3', caption: 'The unit quaternions form the 3-sphere.' },
    { tex: 'SU(2) \\to SO(3), \\quad q \\mapsto R_q, \\qquad R_q = R_{-q}', caption: 'Two-to-one: q and −q give the same rotation.' },
    { tex: '\\mathbf p = \\theta\\,\\hat n, \\quad 0 \\le \\theta \\le 2\\pi, \\qquad |\\mathbf p| = 2\\pi \\iff q = -1', caption: 'The SU(2) ball. Its whole surface is one point.' },
  ],
  code: [su2Point, spin720],
};

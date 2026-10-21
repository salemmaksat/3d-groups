import * as THREE from 'three';
import { PI, ballPoint, canonical } from '../math.js';
import { tube, material, circle, v3 } from '../scene.js';

/** All turns about one axis n as the spin goes 0 → 360°.
 *  Halfway it reaches +π·n and jumps to −π·n: those two points are the same rotation. */
export function spinLoop(axis, steps = 120) {
  const runs = [[]];
  let prev = null;
  for (let i = 0; i <= steps; i++) {
    const { axis: a, angle } = canonical(axis, (2 * PI * i) / steps);
    const p = ballPoint(a, angle);
    if (prev && Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]) > 1) runs.push([]);
    runs[runs.length - 1].push(p);
    prev = p;
  }
  return runs;
}

/** Wire cage of the ball of radius π: equator, four meridians, two latitude rings. */
export function cageRings(R = PI) {
  const rings = [circle([0, 0, 1], R)];
  for (const deg of [0, 45, 90, 135]) {
    const a = (deg * PI) / 180;
    rings.push(circle([Math.cos(a), Math.sin(a), 0], R));
  }
  for (const z of [0.6 * R, -0.6 * R]) rings.push(circle([0, 0, 1], Math.sqrt(R * R - z * z), [0, 0, z]));
  return rings;
}

const PAIR_SHAPES = [
  [[1, 0, 0], () => new THREE.BoxGeometry(0.2, 0.2, 0.2)],
  [[0, 1, 0], () => new THREE.SphereGeometry(0.13, 20, 14)],
  [[0, 0, 1], () => new THREE.CylinderGeometry(0.13, 0.13, 0.08, 24)],
  [[1, 1, 1], () => new THREE.ConeGeometry(0.13, 0.24, 20)],
];

export default {
  id: 'ball',
  name: 'Ball of rotations',
  camera: [8, 6, 5.5],
  state: { cage: true, pairs: true },
  controls: [
    { type: 'check', key: 'cage', label: 'Cage' },
    { type: 'check', key: 'pairs', label: 'Matching pairs' },
  ],

  build({ group, colors, state }) {
    if (state.cage) {
      const m = material(colors.cage);
      for (const ring of cageRings()) group.add(tube(ring, 0.03, m, true));
      group.add(new THREE.Mesh(
        new THREE.SphereGeometry(PI, 48, 32),
        material(colors.cage, { transparent: true, opacity: 0.07, depthWrite: false }),
      ));
    }
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), material(colors.fg)));
    if (state.pairs) {
      for (const [dir, make] of PAIR_SHAPES) {
        const d = v3(dir).normalize();
        for (const s of [1, -1]) {
          const m = new THREE.Mesh(make(), material(colors.cage));
          m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().multiplyScalar(s));
          m.position.copy(d.clone().multiplyScalar(s * PI));
          group.add(m);
        }
      }
    }
  },

  update({ dyn, colors }, rot) {
    const m = material(colors.loop);
    for (const run of spinLoop(rot.n)) dyn.add(tube(run, 0.05, m));
    // The two ends of the loop are one rotation: mark them with the same disc.
    const near180 = rot.angle > PI - 0.06;
    for (const s of [1, -1]) {
      const end = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.04, 10, 32),
        material(near180 ? colors.dot : colors.loop),
      );
      const d = v3(rot.n).multiplyScalar(s);
      end.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
      end.position.copy(d.multiplyScalar(PI));
      dyn.add(end);
    }
    return ballPoint(rot.axis, rot.angle);
  },

  coords(rot) {
    const p = ballPoint(rot.axis, rot.angle);
    return `point θ·n̂ = (${p.map((c) => c.toFixed(2)).join(', ')}), distance ${rot.angle.toFixed(2)} of π`;
  },

  text: `
    <p>Every rotation is a turn by some angle θ about some axis n̂. Put that rotation at the point <b>θ·n̂</b>. The direction of the point is the axis. The distance from the center is the angle. Angles only need to go up to 180°, so every rotation fits in a ball of radius π.</p>
    <p>The center is “no rotation”. The surface holds the 180° turns. A 180° turn about n̂ is the same as a 180° turn about −n̂, so <b>opposite points on the surface are the same rotation</b>. The gray shapes mark four such pairs, and the two rings mark the pair on the current axis.</p>
    <p>Press <b>Play</b>. The dot runs out along the orange line, leaves through one ring and comes back in through the opposite ring. The object in the small window turns smoothly the whole time. The jump is only in the picture.</p>
    <p>One full turn (360°) is a loop that cannot be shrunk to a point inside the ball, because its two ends are stuck to opposite sides. Two full turns (720°) can be shrunk. This is the plate trick, also called the belt trick.</p>`,

  formulas: [
    { tex: 'R(\\hat n,\\theta) = I + \\sin\\theta\\,[\\hat n]_\\times + (1-\\cos\\theta)\\,[\\hat n]_\\times^2', caption: 'Rodrigues’ formula: the rotation matrix for a turn by θ about the unit axis n̂.' },
    { tex: '\\mathbf p = \\theta\\,\\hat n,\\qquad 0 \\le \\theta \\le \\pi,\\qquad |\\mathbf p| \\le \\pi', caption: 'Where each rotation goes in the ball.' },
    { tex: '\\mathbf p \\sim -\\mathbf p \\quad\\text{when } |\\mathbf p| = \\pi', caption: 'The gluing rule on the surface.' },
    { tex: '(\\hat n,\\ \\theta) \\equiv (-\\hat n,\\ 2\\pi-\\theta)', caption: 'Why angles above 180° fold back into the ball.' },
  ],
  code: [ballPoint, canonical, spinLoop, cageRings],
};

import * as THREE from 'three';
import { PI, ballFromQuat, quatFromAxisAngle, quatFromZYZ } from '../math.js';
import { cage } from '../scene.js';

/** Small seeded random number generator, so the picture is the same on every load. */
export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Truly uniform random rotation (Shoemake): a uniform point on the 4D unit sphere. */
export function uniformRotation(r) {
  const u1 = r(), u2 = r(), u3 = r();
  const a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
  return [a * Math.sin(2 * PI * u2), a * Math.cos(2 * PI * u2), b * Math.sin(2 * PI * u3), b * Math.cos(2 * PI * u3)];
}

/** Common mistake 1: pick the three Euler angles uniformly. */
export function naiveEuler(r) {
  return quatFromZYZ(2 * PI * r(), PI * r(), 2 * PI * r());
}

/** Common mistake 2: uniform random axis, uniform angle in [0, π]. */
export function naiveAxisAngle(r) {
  const z = 2 * r() - 1, t = 2 * PI * r(), s = Math.sqrt(1 - z * z);
  return quatFromAxisAngle([s * Math.cos(t), s * Math.sin(t), z], PI * r());
}

const SAMPLERS = {
  uniform: ['Uniform (Haar)', uniformRotation],
  euler: ['Random Euler angles', naiveEuler],
  axis: ['Random axis + uniform angle', naiveAxisAngle],
};
let lastStats = null;

export default {
  id: 'random',
  name: 'Random rotations',
  global: false,
  noInset: true,
  camera: [8, 6, 5.5],
  state: { kind: 'uniform', count: 3000 },
  controls: [
    { type: 'select', key: 'kind', label: 'Sampler', options: Object.entries(SAMPLERS).map(([k, v]) => [k, v[0]]) },
    { type: 'range', key: 'count', label: 'Number of rotations', min: 500, max: 8000, step: 500, fmt: (v) => `${v}` },
  ],

  build({ group, colors, state }) {
    group.add(cage(PI, colors.cage));
    const r = rng(7);
    const pick = SAMPLERS[state.kind][1];
    const pos = new Float32Array(state.count * 3);
    let small = 0;
    for (let i = 0; i < state.count; i++) {
      const p = ballFromQuat(pick(r));
      pos.set(p, 3 * i);
      if (Math.hypot(...p) < PI / 2) small++;
    }
    lastStats = { small: small / state.count };
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    group.add(new THREE.Points(g, new THREE.PointsMaterial({ color: new THREE.Color(colors.loop), size: 0.06, sizeAttenuation: true })));
  },

  update() {
    return {};
  },

  coords(rot, state) {
    const pct = (x) => `${(100 * x).toFixed(1)}%`;
    return [
      ['sampler', SAMPLERS[state.kind][0]],
      ['turns under 90°', `${pct(lastStats.small)} of ${state.count}`],
      ['uniform should give', `${pct((PI / 2 - 1) / PI)}  (= (π/2 − 1)/π)`],
    ];
  },

  text: `
    <p>How do you pick a rotation “at random”, with every orientation equally likely? Robotics, graphics and molecular simulations all need this, and the obvious recipes are wrong.</p>
    <p><b>Uniform (Haar)</b> picks a uniform point on the 4D sphere of quaternions. It is truly uniform, but in the ball it looks crowded in the middle. That is a distortion of the ball: there is a lot of room near the surface and not that many large rotations to fill it.</p>
    <p>Switch to <b>Random Euler angles</b>: the points pile up along the vertical axis and around the equator. Those are the gimbal-lock rotations, where many angle triples give the same rotation, so they get picked too often. <b>Random axis + uniform angle</b> piles points into the center, because it picks small turns far too often. Compare the “turns under 90°” number with the uniform value, about 18.2%.</p>`,

  formulas: [
    { tex: 'q = \\left(\\sqrt{1-u_1}\\sin 2\\pi u_2,\\ \\sqrt{1-u_1}\\cos 2\\pi u_2,\\ \\sqrt{u_1}\\sin 2\\pi u_3,\\ \\sqrt{u_1}\\cos 2\\pi u_3\\right)', caption: 'Shoemake’s method, with u₁, u₂, u₃ uniform in [0, 1).' },
    { tex: 'p(\\theta) = \\frac{1-\\cos\\theta}{\\pi}, \\qquad 0 \\le \\theta \\le \\pi', caption: 'For a uniform rotation, the angle is not uniform: large angles are more likely.' },
    { tex: 'P(\\theta < \\tfrac\\pi2) = \\int_0^{\\pi/2} \\frac{1-\\cos\\theta}{\\pi}\\,d\\theta = \\frac{\\pi/2 - 1}{\\pi} \\approx 0.182', caption: 'The share of uniform rotations that turn less than 90°.' },
  ],
  code: [uniformRotation, naiveEuler, naiveAxisAngle],
};

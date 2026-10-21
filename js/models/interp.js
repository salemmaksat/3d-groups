import * as THREE from 'three';
import { PI, quatFromAxisAngle, ballFromQuat, slerp, zyzAngles, matrixFromQuat, quatFromZYZ, angleBetween } from '../math.js';
import { cage, tube, label, splitJumps } from '../scene.js';

const unit = (v) => { const n = Math.hypot(...v); return v.map((c) => c / n); };
const STARTS = {
  x90: ['90° about x', quatFromAxisAngle([1, 0, 0], PI / 2)],
  id: ['no rotation', [1, 0, 0, 0]],
  d150: ['150° about (1,−1,0)', quatFromAxisAngle(unit([1, -1, 0]), (5 * PI) / 6)],
  y60: ['60° about y', quatFromAxisAngle([0, 1, 0], PI / 3)],
};

/** Naive interpolation: blend the three ZYZ Euler angles linearly. */
export function eulerLerp(a, b, t) {
  const ea = zyzAngles(matrixFromQuat(a)), eb = zyzAngles(matrixFromQuat(b));
  const mix = (k) => ea[k] + (eb[k] - ea[k]) * t;
  return quatFromZYZ(mix('alpha'), mix('beta'), mix('gamma'));
}

/** Total turning along a path of rotations: add up the small angles between neighbours. */
export function pathAngle(path) {
  let sum = 0;
  for (let i = 1; i < path.length; i++) sum += angleBetween(path[i - 1], path[i]);
  return sum;
}

const STEPS = 160;
function paths(a, b) {
  const s = [], e = [];
  for (let i = 0; i <= STEPS; i++) { s.push(slerp(a, b, i / STEPS)); e.push(eulerLerp(a, b, i / STEPS)); }
  return { s, e };
}

export default {
  id: 'interp',
  name: 'Interpolation',
  camera: [8, 6, 5.5],
  state: { a: 'x90', t: 0 },
  controls: [
    { type: 'select', key: 'a', label: 'Start A', options: Object.entries(STARTS).map(([k, v]) => [k, v[0]]) },
    { type: 'play', key: 't', label: 'Move from A to B', min: 0, max: 100, step: 1, speed: 22, loop: true, fmt: (v) => `${Math.round(v)}%` },
  ],

  build({ group, colors }) {
    group.add(cage(PI, colors.cage));
  },

  update({ state, colors, marker, dyn }, rot) {
    const A = STARTS[state.a][1], B = rot.q;
    const { s, e } = paths(A, B);
    const ms = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.accent) });
    const me = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.loop) });
    for (const run of splitJumps(s.map(ballFromQuat), 2)) dyn.add(tube(run, 0.05, ms));
    for (const run of splitJumps(e.map(ballFromQuat), 2)) dyn.add(tube(run, 0.035, me));
    const pa = ballFromQuat(A), pb = ballFromQuat(B);
    marker(pa, colors.fg, 0.1);
    marker(pb, colors.fg, 0.1);
    dyn.add(label('A', [pa[0], pa[1], pa[2] + 0.4], 0.42, colors.fg));
    dyn.add(label('B', [pb[0], pb[1], pb[2] + 0.4], 0.42, colors.fg));
    const t = state.t / 100;
    marker(ballFromQuat(eulerLerp(A, B, t)), colors.loop, 0.12);
    const q = slerp(A, B, t);
    return { dot: ballFromQuat(q), q };
  },

  coords(rot, state) {
    const A = STARTS[state.a][1], B = rot.q;
    const { s, e } = paths(A, B);
    const d = (x) => `${Math.round((x * 180) / PI)}°`;
    return [
      ['A → B', `${d(angleBetween(A, B))} apart`],
      ['slerp turns', `${d(pathAngle(s))} in total (the minimum)`],
      ['Euler blend turns', `${d(pathAngle(e))} in total`],
      ['window', 'follows the slerp path'],
    ];
  },

  text: `
    <p>A robot or a camera often has to turn smoothly from orientation A to orientation B. There are many paths through SO(3) between them.</p>
    <p><b>Slerp</b> (teal, with the yellow dot) is the shortest one. It turns about a single fixed axis at constant speed. The orange path blends the three Euler angles linearly, which is the first thing most people try. It wanders, turns further, and can swing through odd orientations on the way.</p>
    <p>A is picked from the menu. B is the rotation from the sliders. Press <b>Play</b> and compare the two dots, then read the totals: the Euler blend always turns at least as far as slerp, and often much further, especially near gimbal lock (axis tilt near 0° or 180°).</p>`,

  formulas: [
    { tex: '\\operatorname{slerp}(q_A, q_B; t) = \\frac{\\sin((1-t)\\Omega)}{\\sin\\Omega}\\,q_A + \\frac{\\sin(t\\Omega)}{\\sin\\Omega}\\,q_B', caption: 'Spherical linear interpolation, with cos Ω = q_A · q_B (flip q_B if negative).' },
    { tex: 'q(t) = q_A\\,(q_A^{-1}q_B)^t', caption: 'The same path written as a power: a constant-speed turn about one axis.' },
    { tex: 'd(q_A, q_B) = 2\\arccos|q_A \\cdot q_B|', caption: 'The angle between two rotations: the length of the slerp path.' },
  ],
  code: [slerp, eulerLerp, pathAngle],
};

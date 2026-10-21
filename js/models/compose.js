import * as THREE from 'three';
import { PI, quatMul, quatFromAxisAngle, ballFromQuat, angleBetween } from '../math.js';
import { cage, label, tube } from '../scene.js';

const unit = (v) => { const n = Math.hypot(...v); return v.map((c) => c / n); };
const PRESETS = {
  x90: ['90° about x', quatFromAxisAngle([1, 0, 0], PI / 2)],
  y90: ['90° about y', quatFromAxisAngle([0, 1, 0], PI / 2)],
  d120: ['120° about (1,1,1)', quatFromAxisAngle(unit([1, 1, 1]), (2 * PI) / 3)],
  z45: ['45° about z', quatFromAxisAngle([0, 0, 1], PI / 4)],
};

/** Compose two rotations. AB means: first do B, then A (like matrices acting on a vector). */
export function compose(A, B) {
  return { AB: quatMul(A, B), BA: quatMul(B, A) };
}

export default {
  id: 'compose',
  name: 'Order matters',
  camera: [8, 6, 5.5],
  state: { b: 'x90' },
  controls: [
    { type: 'select', key: 'b', label: 'Rotation B', options: Object.entries(PRESETS).map(([k, v]) => [k, v[0]]) },
  ],

  build({ group, colors }) {
    group.add(cage(PI, colors.cage));
  },

  update({ state, colors, marker, dyn }, rot) {
    const A = rot.q, B = PRESETS[state.b][1];
    const { AB, BA } = compose(A, B);
    const pts = { A: ballFromQuat(A), B: ballFromQuat(B), AB: ballFromQuat(AB), BA: ballFromQuat(BA) };
    const col = { B: colors.accent, AB: colors.loop, BA: colors.glueB };
    for (const k of ['B', 'AB', 'BA']) marker(pts[k], col[k], 0.13);
    for (const k of ['A', 'B', 'AB', 'BA']) dyn.add(label(k, pts[k].map((c, i) => c + (i === 2 ? 0.42 : 0)), 0.42, colors.fg));
    const ab = pts.AB, ba = pts.BA;
    if (Math.hypot(ab[0] - ba[0], ab[1] - ba[1], ab[2] - ba[2]) < 2.5) {
      dyn.add(tube([ab, ba], 0.02, new THREE.MeshBasicMaterial({ color: new THREE.Color(colors.muted) })));
    }
    return { dot: pts.A, q: AB };
  },

  coords(rot, state) {
    const { AB, BA } = compose(rot.q, PRESETS[state.b][1]);
    const gap = (angleBetween(AB, BA) * 180) / PI;
    const deg = (q) => `${Math.round((angleBetween([1, 0, 0, 0], q) * 180) / PI)}°`;
    return [
      ['A', `current rotation (${deg(rot.q)})`],
      ['B', PRESETS[state.b][0]],
      ['AB vs BA', gap < 0.5 ? 'equal: these two commute' : `differ by a ${gap.toFixed(1)}° turn`],
      ['window', `shows AB (${deg(AB)})`],
    ];
  },

  text: `
    <p>Doing two rotations one after another gives another rotation. The order matters. <b>AB</b> means “do B first, then A”. <b>BA</b> is the other order, and it usually lands somewhere else in the ball.</p>
    <p>A is the rotation from the sliders (yellow dot). Pick B from the menu. The orange dot is AB, the blue dot is BA, and the thin line joins them. The small window shows the object turned by AB.</p>
    <p>Try setting the axis of A to match B’s axis: AB and BA meet, because rotations about the same axis commute. Tilt the axis away and they split apart. This is why SO(3) is called non-abelian, and why the order of joints in a robot arm matters.</p>`,

  formulas: [
    { tex: 'AB \\ne BA \\quad\\text{in general}', caption: 'Rotations in 3D do not commute.' },
    { tex: 'q_{AB} = q_A\\,q_B', caption: 'With quaternions, composing is multiplying.' },
    { tex: 'q_Aq_B = q_Bq_A \\iff \\hat n_A \\parallel \\hat n_B \\ \\text{(or one is the identity, or two half-turns about perpendicular axes)}', caption: 'When two rotations commute.' },
  ],
  code: [compose, quatMul],
};

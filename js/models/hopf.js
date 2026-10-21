import * as THREE from 'three';
import { PI, quatFromAxisAngle, quatMul, stereo } from '../math.js';
import { tube, material, hueColor, splitRuns } from '../scene.js';

/** The rotation that tilts +z to the direction with polar angle a and azimuth φ. */
export function tiltTo(a, phi) {
  return quatFromAxisAngle([-Math.sin(phi), Math.cos(phi), 0], a);
}

/** Hopf fiber through q0: the rotations q0 · (cos s, 0, 0, sin s).
 *  All of them send the z axis to the same direction, so they form one ring. */
export function hopfFiber(q0, steps = 240) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const s = (2 * PI * i) / steps;
    pts.push(stereo(quatMul(q0, [Math.cos(s), 0, 0, Math.sin(s)])));
  }
  return pts;
}

/** Polar angles of the bands of directions we draw rings for. */
export function bandAngles(count) {
  if (count === 1) return [(2 * PI) / 3];
  return Array.from({ length: count }, (_, k) => PI / 2 + ((5 * PI) / 12) * (k / (count - 1)));
}

const LIMIT = 3; // rings that pass near q = −1 shoot off to infinity; clip them here

export default {
  id: 'hopf',
  name: 'Quaternion rings',
  camera: [5.6, 4.3, 3.5],
  state: { bands: 3, rings: 12, ball: true },
  controls: [
    { type: 'range', key: 'bands', label: 'Bands of directions', min: 1, max: 5, step: 1, fmt: (v) => `${v}` },
    { type: 'range', key: 'rings', label: 'Rings per band', min: 3, max: 24, step: 1, fmt: (v) => `${v}` },
    { type: 'check', key: 'ball', label: 'Unit ball' },
  ],

  build({ group, colors, state }) {
    for (const a of bandAngles(state.bands)) {
      for (let j = 0; j < state.rings; j++) {
        const phi = (2 * PI * j) / state.rings;
        const color = hueColor(phi / (2 * PI), 0.7, 0.62 - 0.22 * (a / PI));
        const m = material(color);
        for (const run of splitRuns(hopfFiber(tiltTo(a, phi)), LIMIT)) group.add(tube(run, 0.022, m));
      }
    }
    if (state.ball) {
      group.add(new THREE.Mesh(
        new THREE.SphereGeometry(1, 48, 32),
        material(colors.cage, { transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
      ));
    }
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), material(colors.fg)));
  },

  update({ dyn, colors }, rot) {
    const m = material(colors.dot, { emissive: new THREE.Color(colors.dot), emissiveIntensity: 0.25 });
    for (const run of splitRuns(hopfFiber(rot.q), LIMIT)) dyn.add(tube(run, 0.04, m));
    return stereo(rot.q);
  },

  coords(rot) {
    const p = stereo(rot.q);
    const d = [rot.R[0][2], rot.R[1][2], rot.R[2][2]];
    return `projected point (${p.map((c) => c.toFixed(2)).join(', ')}) · screen faces (${d.map((c) => c.toFixed(2)).join(', ')})`;
  },

  text: `
    <p>A rotation can be written as a <b>unit quaternion</b> q = (w, x, y, z): four numbers with w² + x² + y² + z² = 1. Those points form a sphere in 4D, called S³. The quaternions q and −q give the same rotation, so S³ holds every rotation twice.</p>
    <p>To draw S³ in 3D, we project it from the point q = −1 (stereographic projection). Rotations with w ≥ 0 land inside the gray unit ball, each one once. The center is “no rotation”, and the ball's surface holds the 180° turns, glued to their opposites as before.</p>
    <p>Each ring is the set of all rotations that point the object's screen in one direction. The ring's color is that direction. Any two rings are <b>linked</b>, like links of a chain. This picture is called the Hopf fibration.</p>
    <p>The yellow ring passes through the current rotation. Spinning the object about its own screen axis keeps you on that ring. Half of each ring lies inside the unit ball. The other half is the −q copy of the same rotations.</p>`,

  formulas: [
    { tex: 'q = \\left(\\cos\\tfrac{\\theta}{2},\\ \\hat n\\,\\sin\\tfrac{\\theta}{2}\\right) \\in S^3 \\subset \\mathbb R^4', caption: 'The unit quaternion for a turn by θ about n̂.' },
    { tex: 'SO(3) \\;\\cong\\; S^3 / \\{\\pm 1\\} \\;=\\; \\mathbb{RP}^3', caption: 'Each rotation is a pair ±q.' },
    { tex: '\\mathbf p = \\frac{(x,\\,y,\\,z)}{1+w} = \\hat n\\,\\tan\\tfrac{\\theta}{4}', caption: 'Stereographic projection from q = −1. For θ ≤ 180°, |p| ≤ 1.' },
    { tex: 'h(q) = q\\,\\mathbf k\\,q^{-1} = R\\,\\hat z, \\qquad h^{-1}(\\mathbf d) = \\{\\,q_0\\,(\\cos s + \\mathbf k \\sin s)\\,\\}', caption: 'The Hopf map sends a rotation to where it points the z axis. Each ring is one fiber of this map.' },
  ],
  code: [quatFromAxisAngle, quatMul, stereo, tiltTo, hopfFiber, bandAngles],
};

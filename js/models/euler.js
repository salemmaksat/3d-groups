import * as THREE from 'three';
import { PI, zyzAngles } from '../math.js';
import { tube, material, label, splitRuns } from '../scene.js';

const A = 2 * PI, B = PI, C = 2 * PI; // box size: α, β, γ

/** Place the Euler angles (α, β, γ) in a box centered on the origin. */
export function eulerPoint({ alpha, beta, gamma }) {
  return [alpha - A / 2, beta - B / 2, gamma - C / 2];
}

/** At gimbal lock, a whole line of (α, γ) gives one rotation.
 *  β = 0: only α + γ matters. β = π: only α − γ matters. */
export function gimbalLine(e, steps = 200) {
  const wrap = (x) => ((x % (2 * PI)) + 2 * PI) % (2 * PI);
  const locked0 = e.beta < PI / 2;
  const sum = locked0 ? e.alpha + e.gamma : e.alpha - e.gamma;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = (2 * PI * i) / steps;
    const g = wrap(locked0 ? sum - a : a - sum);
    pts.push(eulerPoint({ alpha: a, beta: e.beta, gamma: g }));
  }
  // Break the line where γ wraps from 2π back to 0
  const runs = [[]];
  for (let i = 0; i < pts.length; i++) {
    if (i && Math.abs(pts[i][2] - pts[i - 1][2]) > PI) runs.push([]);
    runs[runs.length - 1].push(pts[i]);
  }
  return runs;
}

export default {
  id: 'euler',
  name: 'Euler-angle box',
  camera: [13.5, -12.5, 9.5],
  state: { glued: true, lock: true },
  controls: [
    { type: 'check', key: 'glued', label: 'Glued faces' },
    { type: 'check', key: 'lock', label: 'Gimbal-lock faces' },
  ],

  build({ group, colors, state }) {
    group.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(A, B, C)),
      new THREE.LineBasicMaterial({ color: new THREE.Color(colors.muted) }),
    ));
    const face = (w, h, color, pos, rot, opacity) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        material(color, { transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }),
      );
      m.position.set(...pos);
      m.rotation.set(...rot);
      group.add(m);
    };
    if (state.glued) {
      face(C, B, colors.glueA, [-A / 2, 0, 0], [0, PI / 2, 0], 0.32); // α = 0
      face(C, B, colors.glueA, [A / 2, 0, 0], [0, PI / 2, 0], 0.32);  // α = 2π
      face(A, B, colors.glueB, [0, 0, -C / 2], [0, 0, 0], 0.32);      // γ = 0
      face(A, B, colors.glueB, [0, 0, C / 2], [0, 0, 0], 0.32);       // γ = 2π
    }
    if (state.lock) {
      face(A, C, colors.lock, [0, -B / 2, 0], [PI / 2, 0, 0], 0.2);   // β = 0
      face(A, C, colors.lock, [0, B / 2, 0], [PI / 2, 0, 0], 0.2);    // β = π
    }
    group.add(label('α  0 → 360°', [0, -B / 2 - 0.7, -C / 2 - 0.5], 0.5, colors.fg));
    group.add(label('β  0 → 180°', [A / 2 + 0.3, 0, C / 2 + 0.6], 0.5, colors.fg));
    group.add(label('γ  0 → 360°', [-A / 2 - 1.5, -B / 2, 0], 0.5, colors.fg));
  },

  update({ dyn, colors }, rot) {
    const e = zyzAngles(rot.R);
    // Near gimbal lock, show every box point that is the same rotation
    if (e.beta < 0.12 || e.beta > PI - 0.12) {
      const m = material(colors.dot);
      for (const run of gimbalLine(e)) if (run.length > 1) dyn.add(tube(run, 0.035, m));
    }
    return eulerPoint(e);
  },

  coords(rot) {
    const e = zyzAngles(rot.R);
    const d = (x) => `${((x * 180) / PI).toFixed(0)}°`;
    return `α = ${d(e.alpha)}, β = ${d(e.beta)}, γ = ${d(e.gamma)}`;
  },

  text: `
    <p>Engineers often describe a rotation with three angles: turn by α about z, tilt by β about y, then turn by γ about z again. These are <b>ZYZ Euler angles</b>. α and γ run from 0 to 360°, β from 0 to 180°, so every rotation sits somewhere in this box.</p>
    <p>The box repeats itself. The orange faces are glued, because α = 0° and α = 360° are the same turn. The blue faces are glued for the same reason with γ.</p>
    <p>On the pink faces (β = 0° and β = 180°) the two z turns line up, and only α + γ or α − γ matters. A whole line of the box is then one rotation. This is <b>gimbal lock</b>. Set the polar slider near 0° to see the yellow line of matching points.</p>
    <p>Press <b>Play</b> and watch the dot jump across the box while the object turns smoothly. Of the five models, this one is the hardest to print, because all of its structure is in the gluing rules.</p>`,

  formulas: [
    { tex: 'R = R_z(\\alpha)\\,R_y(\\beta)\\,R_z(\\gamma),\\qquad \\alpha,\\gamma \\in [0, 2\\pi),\\ \\beta \\in [0, \\pi]', caption: 'ZYZ Euler angles.' },
    { tex: '\\beta = \\arccos R_{33},\\quad \\alpha = \\operatorname{atan2}(R_{23},\\, R_{13}),\\quad \\gamma = \\operatorname{atan2}(R_{32},\\, -R_{31})', caption: 'Reading the angles back from the matrix (when sin β ≠ 0).' },
    { tex: '\\beta = 0:\\ R = R_z(\\alpha+\\gamma) \\qquad \\beta = \\pi:\\ R = R_z(\\alpha-\\gamma)\\,R_y(\\pi)', caption: 'Gimbal lock: one rotation, a whole line of angle triples.' },
  ],
  code: [zyzAngles, eulerPoint, gimbalLine],
};

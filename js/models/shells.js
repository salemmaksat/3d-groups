import * as THREE from 'three';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { PI, ballPoint } from '../math.js';
import { material, label } from '../scene.js';

/** A point on the shell of all turns by angle θ. (u, v) choose the axis direction. */
export function shellPoint(theta, u, v) {
  return [
    theta * Math.sin(v) * Math.cos(u),
    theta * Math.sin(v) * Math.sin(u),
    theta * Math.cos(v),
  ];
}

/** Mesh of one shell with a wedge of `cut` radians removed so you can see inside. */
export function shellGeometry(theta, cut) {
  return new ParametricGeometry((u, v, target) => {
    const p = shellPoint(theta, cut + u * (2 * PI - cut), v * PI);
    target.set(p[0], p[1], p[2]);
  }, 72, 36);
}

export default {
  id: 'shells',
  name: 'Nested shells',
  camera: [8, 7, 5],
  state: { cut: 90, count: 4 },
  controls: [
    { type: 'range', key: 'cut', label: 'Cutaway', min: 0, max: 180, step: 5, fmt: (v) => `${v}°` },
    { type: 'range', key: 'count', label: 'Shells', min: 2, max: 8, step: 1, fmt: (v) => `${v}` },
  ],

  build({ group, colors, state }) {
    const cut = (state.cut * PI) / 180;
    for (let i = 1; i <= state.count; i++) {
      const theta = (PI * i) / state.count;
      const outer = i === state.count;
      const c = new THREE.Color().setHSL(0.52 - 0.3 * (i / state.count), 0.5, 0.48);
      group.add(new THREE.Mesh(
        shellGeometry(theta, cut),
        material(c, { side: THREE.DoubleSide, transparent: outer, opacity: outer ? 0.3 : 1, depthWrite: !outer }),
      ));
      if (cut > 0.2) {
        const pos = shellPoint(theta - 0.12, cut / 2, PI / 2 + 0.3);
        group.add(label(`${Math.round((180 * i) / state.count)}°`, pos, 0.32, colors.fg));
      }
    }
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), material(colors.fg)));
  },

  update({ dyn, colors, state }, rot) {
    // Wire shell through the current rotation: every rotation with the same angle.
    if (rot.angle > 0.05) {
      const geo = shellGeometry(rot.angle, (state.cut * PI) / 180);
      dyn.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: new THREE.Color(colors.dot), wireframe: true, transparent: true, opacity: 0.28,
      })));
    }
    return ballPoint(rot.axis, rot.angle);
  },

  coords(rot) {
    return `on the ${(rot.angle * 180 / PI).toFixed(0)}° shell (radius ${rot.angle.toFixed(2)})`;
  },

  text: `
    <p>This is the ball of rotations, sorted by angle. All rotations by the same angle θ, about every possible axis, form a <b>sphere of radius θ</b>. Stack those spheres and you fill the ball.</p>
    <p>The center is “no rotation”. Small shells are small turns. The yellow wire shell passes through the current rotation, so it shows every rotation that turns by the same amount.</p>
    <p>The outer shell (180°) is the surface of the ball. There, each point is glued to the point opposite it. Every inner shell is an ordinary sphere. Only the outer one has the gluing, which is the step 3D space can't do.</p>
    <p>For printing, shells that nest like Russian dolls, or one cutaway piece, both work well.</p>`,

  formulas: [
    { tex: 'S_\\theta = \\{\\,\\theta\\,\\hat n \\;:\\; \\hat n \\in S^2\\,\\}', caption: 'The shell of all turns by angle θ.' },
    { tex: '\\operatorname{tr} R = 1 + 2\\cos\\theta', caption: 'You can read the angle straight off the matrix: rotations on one shell share a trace.' },
    { tex: '\\mathbf p(u,v) = \\theta\\,(\\sin v\\cos u,\\ \\sin v\\sin u,\\ \\cos v)', caption: 'The parametric surface drawn for each shell.' },
  ],
  code: [shellPoint, shellGeometry],
};

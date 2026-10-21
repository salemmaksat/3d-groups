import * as THREE from 'three';
import { PI, ballPoint } from '../math.js';
import { tube, material, hueColor, v3 } from '../scene.js';

/** Heights of n evenly spaced slices through the ball of radius π. */
export function sliceHeights(n) {
  return Array.from({ length: n }, (_, i) => -0.85 * PI + (1.7 * PI * i) / (n - 1));
}

/** Rim of the slice at height z: a circle of radius √(π² − z²) on the ball's surface. */
export function sliceRim(z, steps = 160) {
  const r = Math.sqrt(PI * PI - z * z);
  return Array.from({ length: steps }, (_, i) => {
    const phi = (2 * PI * i) / steps;
    return [r * Math.cos(phi), r * Math.sin(phi), z];
  });
}

/** Rim color. The rim points (φ, z) and (φ + π, −z) are the same rotation, so they share a hue. */
export function rimHue(phi, z) {
  return (((phi + (z < 0 ? PI : 0)) / (2 * PI)) % 1 + 1) % 1;
}

export default {
  id: 'slices',
  name: 'Slice stack',
  camera: [8.5, 6.5, 5],
  state: { n: 6, spread: 0 },
  controls: [
    { type: 'range', key: 'n', label: 'Slices', min: 2, max: 12, step: 2, fmt: (v) => `${v}` },
    { type: 'range', key: 'spread', label: 'Pull apart', min: 0, max: 100, step: 1, fmt: (v) => `${v}%` },
  ],

  build({ group, colors, state }) {
    const k = 1 + state.spread / 60;
    for (const z of sliceHeights(state.n)) {
      const r = Math.sqrt(PI * PI - z * z);
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(r, 72),
        material(colors.muted, { transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
      );
      disc.position.z = z * k;
      group.add(disc);

      const rim = sliceRim(z).map(([x, y]) => [x, y, z * k]);
      const mesh = tube(rim, 0.07, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), true);
      const pos = mesh.geometry.attributes.position;
      const cols = [];
      for (let i = 0; i < pos.count; i++) {
        const c = hueColor(rimHue(Math.atan2(pos.getY(i), pos.getX(i)), z), 0.8, 0.52);
        cols.push(c.r, c.g, c.b);
      }
      mesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      group.add(mesh);
    }
    group.add(tube([[0, 0, -PI * 1.7 * k], [0, 0, PI * 1.7 * k]], 0.025, material(colors.muted)));
  },

  update({ dyn, colors, state }, rot) {
    const k = 1 + state.spread / 60;
    const p = ballPoint(rot.axis, rot.angle);
    const r = Math.sqrt(Math.max(0, PI * PI - p[2] * p[2]));
    // The slice through the current rotation
    const disc = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0, r - 0.06), r, 96),
      material(colors.dot, { side: THREE.DoubleSide }),
    );
    disc.position.z = p[2] * k;
    dyn.add(disc);
    return [p[0], p[1], p[2] * k];
  },

  coords(rot) {
    const p = ballPoint(rot.axis, rot.angle);
    return `on the slice z = ${p[2].toFixed(2)}, at (${p[0].toFixed(2)}, ${p[1].toFixed(2)})`;
  },

  text: `
    <p>Cut the ball of rotations into horizontal slices. Each slice is a flat disc of rotations, and its rim lies on the ball's surface, where the 180° turns live.</p>
    <p>The rim colors follow the gluing rule. A rim point and the point <b>straight through the center</b>, on the mirror slice, have the same color, because they are the same rotation. Compare the top and bottom slices: the colors run in the same order, turned by half a circle.</p>
    <p>Pull the slices apart to see each disc. The yellow ring is the slice through the current rotation.</p>
    <p>For printing, these work well as plates stacked on a center rod, with the rims in color using a multi-material printer.</p>`,

  formulas: [
    { tex: 'D_z = \\{(x, y, z) : x^2 + y^2 \\le \\pi^2 - z^2\\}', caption: 'The slice at height z is a disc.' },
    { tex: '(r\\cos\\varphi,\\ r\\sin\\varphi,\\ z) \\;\\sim\\; (-r\\cos\\varphi,\\ -r\\sin\\varphi,\\ -z)', caption: 'The gluing rule between the rims of mirror slices.' },
    { tex: '\\text{hue}(\\varphi, z) = \\frac{\\varphi + \\pi\\,[z<0]}{2\\pi} \\bmod 1', caption: 'The coloring that makes glued points match.' },
  ],
  code: [sliceHeights, sliceRim, rimHue],
};

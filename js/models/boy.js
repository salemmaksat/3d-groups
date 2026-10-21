import * as THREE from 'three';
import { PI } from '../math.js';

/** Bryant–Kusner Boy's surface. Input: a unit axis n. B(−n) = B(n), just like a
 *  180° turn about n equals a 180° turn about −n. */
export function boyRaw([x, y, z]) {
  if (z < 0) { x = -x; y = -y; z = -z; }                    // B(−n) = B(n)
  const w = [x / (1 + z), y / (1 + z)];                     // hemisphere → unit disc (complex w)
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const div = (a, b) => {
    const d = b[0] * b[0] + b[1] * b[1];
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
  };
  const w2 = mul(w, w), w3 = mul(w2, w), w4 = mul(w2, w2), w6 = mul(w3, w3);
  const D = [w6[0] + Math.sqrt(5) * w3[0] - 1, w6[1] + Math.sqrt(5) * w3[1]];
  const a = div(mul(w, [1 - w4[0], -w4[1]]), D);
  const b = div(mul(w, [1 + w4[0], w4[1]]), D);
  const c = div([1 + w6[0], w6[1]], D);
  const g1 = -1.5 * a[1], g2 = -1.5 * b[0], g3 = c[1] - 0.5;
  const g = g1 * g1 + g2 * g2 + g3 * g3;
  return [g1 / g, g2 / g, g3 / g];
}

// Center Boy's surface and scale it to the size of the ball (radius π)
const NORM = (() => {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], pts = [];
  for (let i = 0; i < 4000; i++) {
    const z = 1 - (2 * (i + 0.5)) / 4000, r = Math.sqrt(1 - z * z), t = i * 2.39996;
    const p = boyRaw([r * Math.cos(t), r * Math.sin(t), z]);
    pts.push(p);
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  }
  const c = lo.map((v, k) => (v + hi[k]) / 2);
  let m = 0;
  for (const p of pts) m = Math.max(m, Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]));
  return { c, s: PI / m };
})();
const boy = (n) => boyRaw(n).map((v, k) => (v - NORM.c[k]) * NORM.s);

/** Glue the ball's skin: t = 0 is the sphere of 180° turns, t = 1 is Boy's surface. */
export function glue(n, t) {
  const b = boy(n);
  return [0, 1, 2].map((k) => (1 - t) * PI * n[k] + t * b[k]);
}

/** A color that depends only on the pair ±n, so glued points match. */
export function pairHSL([x, y, z]) {
  const hue = ((Math.atan2(y, x) * 2) / (2 * PI) + 1) % 1;  // 2·azimuth: same for n and −n
  const e = Math.abs(z);
  return [hue, 0.75 * (1 - e * e) + 0.1, 0.5 + 0.22 * e];
}

const PAIRS = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0.577, 0.577, 0.577], [0.707, -0.707, 0]];
const ease = (t) => t * t * (3 - 2 * t);
let mesh = null, base = null, boyPos = null, lastGlue = -1;

export default {
  id: 'boy',
  name: 'Boy’s surface',
  camera: [8.6, 6.7, 5.1],
  state: { glue: 0 },
  controls: [
    { type: 'play', key: 'glue', label: 'Glue the skin', min: 0, max: 100, step: 1, speed: 30, fmt: (v) => `${Math.round(v)}%` },
  ],

  build({ group }) {
    const g = new THREE.SphereGeometry(1, 200, 130);
    const pos = g.attributes.position;
    base = new Float32Array(pos.array);
    boyPos = new Float32Array(pos.count * 3);
    const cols = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const n = [base[3 * i], base[3 * i + 1], base[3 * i + 2]];
      boyPos.set(boy(n), 3 * i);
      c.setHSL(...pairHSL(n));
      cols.set([c.r, c.g, c.b], 3 * i);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      vertexColors: true, side: THREE.DoubleSide, roughness: 0.45, metalness: 0.05,
    }));
    group.add(mesh);
    lastGlue = -1;
  },

  update({ state, marker }, rot) {
    const e = ease(state.glue / 100);
    if (e !== lastGlue) {
      const p = mesh.geometry.attributes.position.array;
      for (let i = 0; i < p.length; i++) p[i] = (1 - e) * PI * base[i] + e * boyPos[i];
      mesh.geometry.attributes.position.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      lastGlue = e;
    }
    for (const d of PAIRS) {
      const col = new THREE.Color().setHSL(...pairHSL(d)).offsetHSL(0, 0, -0.18);
      marker(glue(d, e), col, 0.09);
      marker(glue(d.map((x) => -x), e), col, 0.09);
    }
    const n = rot.n;
    marker(glue(n.map((x) => -x), e), null, 0.13);           // the twin of the main dot
    return { dot: glue(n, e), q: [0, n[0], n[1], n[2]] };     // 180° about n
  },

  coords(rot, state) {
    const e = ease(state.glue / 100);
    const a = glue(rot.n, e), b = glue(rot.n.map((x) => -x), e);
    const gap = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    return [
      ['shows', '180° about n̂ and 180° about −n̂'],
      ['gap', `${gap.toFixed(3)} (0 when fully glued)`],
    ];
  },

  text: `
    <p>The skin of the ball model holds the 180° turns. A 180° turn about n̂ equals a 180° turn about −n̂, so every point of the skin is <b>the same rotation as the point opposite it</b>.</p>
    <p>Press <b>Play</b> next to “Glue the skin”. The sphere folds until each point lands on its opposite. The two yellow dots (180° about n̂ and about −n̂) merge, and every colored pair meets its partner. The axis sliders move the yellow pair. The spin slider does nothing here, because this surface only holds 180° turns.</p>
    <p>The finished shape is <b>Boy’s surface</b>, the standard picture of the projective plane ℝP². Like a Klein bottle, it has to pass through itself to exist in 3D. Unlike a Klein bottle, it is an exact piece of SO(3): each point on it is one 180° rotation, counted once.</p>
    <p>All of SO(3) is this surface with a solid ball attached (the turns under 180°). Boy’s surface is also a well-known 3D print.</p>`,

  formulas: [
    { tex: 'w = \\frac{n_x + i\\,n_y}{1 + n_z}, \\qquad B(\\hat n) = B(-\\hat n)', caption: 'Each axis n̂ becomes a complex number w. The axes n̂ and −n̂ give the same point.' },
    { tex: 'D = w^6 + \\sqrt5\\,w^3 - 1', caption: 'Bryant–Kusner denominator.' },
    { tex: 'g_1 = -\\tfrac32\\operatorname{Im}\\frac{w(1-w^4)}{D},\\quad g_2 = -\\tfrac32\\operatorname{Re}\\frac{w(1+w^4)}{D},\\quad g_3 = \\operatorname{Im}\\frac{1+w^6}{D} - \\tfrac12', caption: 'The three coordinate functions.' },
    { tex: 'B = \\frac{(g_1,\\,g_2,\\,g_3)}{g_1^2+g_2^2+g_3^2}', caption: 'The point on Boy’s surface.' },
    { tex: '\\mathbf p(t) = (1-t)\\,\\pi\\hat n + t\\,B(\\hat n)', caption: 'The glue slider blends the sphere into Boy’s surface.' },
  ],
  code: [boyRaw, glue, pairHSL],
};

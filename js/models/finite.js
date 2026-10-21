import * as THREE from 'three';
import { PI, quatMul, quatFromAxisAngle, ballFromQuat } from '../math.js';
import { tube, cage } from '../scene.js';

/** All products of the generators, until nothing new appears. q and −q count as one rotation. */
export function generateGroup(generators) {
  const canon = (q) => { const i = q.findIndex((c) => Math.abs(c) > 1e-6); return q[i] < 0 ? q.map((c) => -c) : q; };
  const key = (q) => canon(q).map((c) => Math.round(c * 1e4) || 0).join(',');
  const elems = new Map([[key([1, 0, 0, 0]), [1, 0, 0, 0]]]);
  let frontier = [[1, 0, 0, 0]];
  while (frontier.length) {
    const next = [];
    for (const a of frontier) {
      for (const g of generators) {
        const p = canon(quatMul(a, g));
        const k = key(p);
        if (!elems.has(k)) { elems.set(k, p); next.push(p); }
      }
    }
    frontier = next;
  }
  return [...elems.values()];
}

/** Order of a rotation: the smallest m such that doing it m times gets back to the start.
 *  (A 144° turn has order 5: five of them make 720°.) */
export function orderOf(q) {
  const turns = Math.acos(Math.min(1, Math.abs(q[0]))) / PI; // θ / 2π
  for (let m = 1; m <= 12; m++) {
    if (Math.abs(m * turns - Math.round(m * turns)) < 1e-4) return m;
  }
  return Infinity;
}

const unit = (v) => { const n = Math.hypot(...v); return v.map((c) => c / n); };
const PHI = (1 + Math.sqrt(5)) / 2;
const qa = quatFromAxisAngle;
const GROUPS = {
  C6: { label: 'Cyclic C₆', solid: 'Hexagonal pyramid', gens: [qa([0, 0, 1], PI / 3)] },
  D6: { label: 'Dihedral D₆', solid: 'Hexagonal prism', gens: [qa([0, 0, 1], PI / 3), qa([1, 0, 0], PI)] },
  T: { label: 'Tetrahedral T', solid: 'Tetrahedron', gens: [qa(unit([1, 1, 1]), (2 * PI) / 3), qa([0, 0, 1], PI)] },
  O: { label: 'Octahedral O', solid: 'Cube', gens: [qa([0, 0, 1], PI / 2), qa(unit([1, 1, 1]), (2 * PI) / 3)] },
  I: { label: 'Icosahedral I', solid: 'Icosahedron', gens: [qa(unit([0, 1, PHI]), (2 * PI) / 5), qa(unit([1, 1, 1]), (2 * PI) / 3)] },
};
const ORDER_COLORS = { 1: '#868e96', 2: '#e8590c', 3: '#2f9e44', 4: '#1c7ed6', 5: '#ae3ec9', 6: '#f08c00' };
const ORDER_NAMES = { 2: '180°', 3: '120°', 4: '90°', 5: '72° or 144°', 6: '60°' };

const cache = {};
function elements(id) {
  if (!cache[id]) {
    const els = generateGroup(GROUPS[id].gens);
    els.sort((a, b) => orderOf(a) - orderOf(b) || b[0] - a[0]);
    cache[id] = els;
  }
  return cache[id];
}

function solid(id) {
  let geo;
  if (id === 'C6') { geo = new THREE.ConeGeometry(0.75, 1.3, 6); geo.rotateX(PI / 2); }
  else if (id === 'D6') { geo = new THREE.CylinderGeometry(0.72, 0.72, 0.75, 6); geo.rotateX(PI / 2); }
  else if (id === 'T') geo = new THREE.TetrahedronGeometry(1.05);
  else if (id === 'O') geo = new THREE.BoxGeometry(0.95, 0.95, 0.95);
  else geo = new THREE.IcosahedronGeometry(0.88);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x74c0fc, flatShading: true, roughness: 0.5 })));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x1b2a38 })));
  return g;
}

export default {
  id: 'finite',
  name: 'Symmetry groups',
  global: false,
  camera: [8, 6, 5.5],
  state: { group: 'I', k: 0 },
  controls: [
    { type: 'select', key: 'group', label: 'Group', options: Object.entries(GROUPS).map(([k, g]) => [k, `${g.label} · ${generateGroup(g.gens).length} rotations`]),
      onChange: (s) => { s.k = 0; } },
    { type: 'play', key: 'k', label: 'Step through the group', min: 0, max: (s) => elements(s.group).length - 1, step: 1, speed: 1.2, loop: true,
      fmt: (v) => `${Math.floor(v) + 1}` },
  ],
  insetObject: ({ state }) => solid(state.group),

  build({ group, colors, state }) {
    group.add(cage(PI, colors.cage));
    const els = elements(state.group);
    const seen = new Set();
    const lineMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.muted), transparent: true, opacity: 0.45 });
    for (const q of els) {
      const p = ballFromQuat(q);
      const r = Math.hypot(...p);
      if (r < 1e-6) continue;
      const n = p.map((c) => c / r);
      const sg = Math.sign(n.find((c) => Math.abs(c) > 1e-3)); // n and −n are the same axis
      const key = n.map((c) => Math.round(c * sg * 100) || 0).join(',');
      if (!seen.has(key)) {
        seen.add(key);
        group.add(tube([n.map((c) => -c * PI), n.map((c) => c * PI)], 0.012, lineMat));
      }
    }
    for (const q of els) {
      const p = ballFromQuat(q);
      const ord = orderOf(q);
      const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(ORDER_COLORS[ord] || colors.fg) });
      const pts = Math.hypot(...p) > PI - 1e-3 ? [p, p.map((c) => -c)] : [p]; // 180° turns sit on the glued skin twice
      for (const pt of pts) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(ord === 1 ? 0.12 : 0.09, 16, 12), m);
        s.position.set(...pt);
        group.add(s);
      }
    }
  },

  update({ state, marker }) {
    const els = elements(state.group);
    const q = els[Math.min(els.length - 1, Math.floor(state.k))];
    const p = ballFromQuat(q);
    if (Math.hypot(...p) > PI - 1e-3) marker(p.map((c) => -c), null, 0.15);
    return { dot: p, q };
  },

  coords(rot, state) {
    const els = elements(state.group);
    const q = els[Math.min(els.length - 1, Math.floor(state.k))];
    const ord = orderOf(q);
    const counts = {};
    for (const e of els) { const o = orderOf(e); counts[o] = (counts[o] || 0) + 1; }
    const p = ballFromQuat(q), th = Math.hypot(...p);
    const axis = th > 1e-6 ? p.map((c) => (c / th).toFixed(2)).join(', ') : '–';
    return [
      ['element', `${Math.floor(state.k) + 1} of ${els.length}: ${Math.round((th * 180) / PI)}° about (${axis})`],
      ['order', ord === 1 ? 'identity' : `${ord} (repeat ${ord}× to get back)`],
      ['contents', Object.entries(counts).map(([o, c]) => (o === '1' ? '1 identity' : `${c} of order ${o}`)).join(' · ')],
    ];
  },

  text: `
    <p>Some objects look exactly the same after certain rotations. Those rotations form a <b>finite subgroup</b> of SO(3). Here each one is drawn as dots in the ball of rotations, colored by order: <span style="color:#e8590c">●</span> 180°, <span style="color:#2f9e44">●</span> 120°, <span style="color:#1c7ed6">●</span> 90°, <span style="color:#ae3ec9">●</span> 72°/144°, <span style="color:#f08c00">●</span> 60°.</p>
    <p>Press <b>Play</b> to step through the group. The solid in the small window jumps to each rotation, and it looks unchanged every time. That is what it means to be a symmetry.</p>
    <p>The dots sit on straight lines through the center: these are the symmetry axes. The icosahedral group has 60 rotations: the identity, 15 half-turns about edge axes, 20 thirds about face axes and 24 fifths about vertex axes. The 180° dots appear twice, on opposite points of the glued skin.</p>
    <p>Every finite group of rotations in 3D is one of these types: cyclic Cₙ, dihedral Dₙ, or the rotations of the tetrahedron, cube or icosahedron.</p>`,

  formulas: [
    { tex: 'G = \\langle g_1, g_2 \\rangle = \\{\\, g_{i_1} g_{i_2} \\cdots g_{i_k} \\,\\}', caption: 'The group is everything you get by multiplying the generators.' },
    { tex: '|C_n| = n,\\quad |D_n| = 2n,\\quad |T| = 12,\\quad |O| = 24,\\quad |I| = 60', caption: 'The sizes of the finite rotation groups.' },
    { tex: 'I:\\ 1 + 15\\cdot\\tfrac{1}{2} + 20\\cdot\\tfrac13 + 24\\cdot\\tfrac15 \\ \\text{turns}\\quad (1 + 15 + 20 + 24 = 60)', caption: 'How the 60 icosahedral rotations split by order.' },
    { tex: '\\operatorname{order}(R) = \\frac{2\\pi}{\\theta}', caption: 'A turn by 2π/m returns home after m steps.' },
  ],
  code: [generateGroup, orderOf],
};

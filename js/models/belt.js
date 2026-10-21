import * as THREE from 'three';
import { PI, ballFromQuat, matrixFromQuat } from '../math.js';
import { tube, cage, splitJumps } from '../scene.js';

/** A loop of rotations that starts and ends at "no rotation", as unit quaternions.
 *  u runs along the loop (0 to 1). turns = 2 is a 720° spin about x, turns = 1 is 360°.
 *  rho = π/2 is the full spin. Lowering rho slides the loop over the 4D sphere toward
 *  q = 1, shrinking it to a point. That only works when the loop is closed in 4D (turns = 2). */
export function beltLoop(rho, u, turns) {
  const t = PI + PI * turns * u;
  const m = [Math.cos(rho), 0, Math.sin(rho), 0];   // center of the circle, from 1 toward j
  const e1 = [-Math.sin(rho), 0, Math.cos(rho), 0];
  const e2 = [0, 1, 0, 0];                           // the i direction (x axis)
  return m.map((c, k) => Math.cos(rho) * c + Math.sin(rho) * (Math.cos(t) * e1[k] + Math.sin(t) * e2[k]));
}

/** The ribbon: slice u sits at x = −L/2 + L·u and is turned by the rotation beltLoop(u). */
export function ribbon(rho, turns, L = 2 * PI, width = 0.9, steps = 200) {
  const left = [], right = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const R = matrixFromQuat(beltLoop(rho, u, turns));
    const side = [R[0][1], R[1][1], R[2][1]].map((c) => (c * width) / 2); // R · ŷ
    const c = [-L / 2 + L * u, 0, 0];
    left.push(c.map((v, k) => v + side[k]));
    right.push(c.map((v, k) => v - side[k]));
  }
  return { left, right };
}

const Z0 = -PI - 2.2; // ribbon sits below the ball

export default {
  id: 'belt',
  name: 'Belt trick',
  global: false,
  camera: [12.5, 10, 5],
  target: [0, 0, -2.6],
  state: { turns: 2, shrink: 0, walk: 30 },
  controls: [
    { type: 'select', key: 'turns', label: 'Loop', options: [[2, '720° spin (two turns)'], [1, '360° spin (one turn)']] },
    { type: 'play', key: 'shrink', label: 'Untwist', min: 0, max: 100, step: 1, speed: 22, fmt: (v) => `${Math.round(v)}%`,
      disabled: (s) => s.turns === 1, rebuild: true },
    { type: 'play', key: 'walk', label: 'Walk along the loop', min: 0, max: 100, step: 1, speed: 18, loop: true, fmt: (v) => `${Math.round(v)}%` },
  ],

  build({ group, colors, state }) {
    const rho = (PI / 2) * (1 - (state.turns === 2 ? state.shrink : 0) / 100);
    group.add(cage(PI, colors.cage));
    // the loop inside the ball
    const pts = Array.from({ length: 401 }, (_, i) => ballFromQuat(beltLoop(rho, i / 400, state.turns)));
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.loop) });
    for (const run of splitJumps(pts, 2)) group.add(tube(run, 0.05, m));
    // the ribbon
    const { left, right } = ribbon(rho, state.turns);
    const pos = [], idx = [];
    left.forEach((p, i) => { pos.push(p[0], p[1], p[2] + Z0, right[i][0], right[i][1], right[i][2] + Z0); });
    for (let i = 0; i < left.length - 1; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.accent), side: THREE.FrontSide, roughness: 0.5 })));
    group.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.loop), side: THREE.BackSide, roughness: 0.5 })));
    for (const x of [-PI - 0.15, PI + 0.15]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 1.6), new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.muted) }));
      wall.position.set(x, 0, Z0);
      group.add(wall);
    }
  },

  update({ state, marker }) {
    const rho = (PI / 2) * (1 - (state.turns === 2 ? state.shrink : 0) / 100);
    const q = beltLoop(rho, state.walk / 100, state.turns);
    marker([-PI + 2 * PI * (state.walk / 100), 0, Z0 + 0.55], null, 0.1);
    return { dot: ballFromQuat(q), q };
  },

  coords(rot, state) {
    const shrinkable = state.turns === 2;
    return [
      ['loop', state.turns === 2 ? '720° about x' : '360° about x'],
      ['untwisted', shrinkable ? `${Math.round(state.shrink)}%` : 'not possible: the ends would have to tear'],
      ['ribbon', shrinkable && state.shrink >= 99.5 ? 'flat, both ends never moved' : `${state.turns === 2 ? 'two' : 'one'} full twist${state.turns === 2 ? 's' : ''}`],
    ];
  },

  text: `
    <p>Hold a belt with both ends fixed and give it two full twists (720°). You can make it flat again by looping the middle around, without turning either end. With one twist (360°) you can’t. This is the belt trick, also called the plate trick.</p>
    <p>The ribbon below the ball is that belt. Each thin slice of it is turned by one rotation, and moving along the ribbon walks along a loop of rotations from “no rotation” back to “no rotation”. The orange tube in the ball is the same loop.</p>
    <p>Press <b>Play</b> on <b>Untwist</b>. The 720° loop slides off its straight line, curls through the ball, and shrinks to the center, while the ribbon goes from two twists to flat. Its ends never move.</p>
    <p>Switch to the <b>360° loop</b> and the untwist control turns off. That loop runs from one side of the ball to the glued opposite side, and no amount of sliding gets its ends together. In math terms, SO(3) has fundamental group ℤ/2: one twist is stuck, two twists cancel.</p>`,

  formulas: [
    { tex: '\\pi_1\\big(SO(3)\\big) = \\mathbb Z/2', caption: 'Loops of rotations come in two kinds: shrinkable and not. Two of the second kind make the first kind.' },
    { tex: 'q_\\rho(t) = \\cos\\rho\\,\\mathbf m_\\rho + \\sin\\rho\\,(\\cos t\\,\\mathbf e_1 + \\sin t\\,\\mathbf i)', caption: 'The loop at untwist level ρ, a circle on the unit quaternions.' },
    { tex: '\\mathbf m_\\rho = \\cos\\rho\\,\\mathbf 1 + \\sin\\rho\\,\\mathbf j, \\qquad \\mathbf e_1 = -\\sin\\rho\\,\\mathbf 1 + \\cos\\rho\\,\\mathbf j', caption: 'At ρ = π/2 it is the 720° spin about x. At ρ = 0 it is the single point q = 1.' },
    { tex: '\\text{slice}(u) = R\\big(q_\\rho(u)\\big)\\,\\hat y', caption: 'Each slice of the ribbon points along the turned y axis.' },
  ],
  code: [beltLoop, ribbon],
};

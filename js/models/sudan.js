import * as THREE from 'three';
import { PI, quatMul, stereo } from '../math.js';
import { tube } from '../scene.js';

/** Sudanese Möbius band on the 4D sphere of unit quaternions.
 *  η runs across the band (0 to π), φ runs along it (0 to 2π). */
export function sudanese(eta, phi) {
  return [
    Math.cos(eta) * Math.cos(phi / 2),
    Math.cos(eta) * Math.sin(phi / 2),
    Math.sin(eta) * Math.cos(phi),
    Math.sin(eta) * Math.sin(phi),
  ];
}

/** Its edge: q = (cos ψ, sin ψ, 0, 0), a spin of 2ψ about the x axis. ψ from 0 to 2π is a 720° spin. */
export function edge(psi) {
  return [Math.cos(psi), Math.sin(psi), 0, 0];
}

// Project S³ → 3D from a pole P that is not on the band, so nothing runs off to infinity.
const P = (() => { const v = [-0.366, 0.605, 0.293, 0.643], n = Math.hypot(...v); return v.map((x) => x / n); })();
const TO_POLE = [-P[0], P[1], P[2], P[3]]; // −conj(P): sends P to −1

/** 3D point: turn S³ so the pole sits at −1, then stereographic projection. */
export function project(q) {
  return stereo(quatMul(TO_POLE, q)).map((c) => c * 1.3);
}

export default {
  id: 'sudan',
  name: 'Sudanese Möbius band',
  global: false,
  camera: [9.6, -5.6, -5.6],
  state: { spin: 0 },
  controls: [
    { type: 'play', key: 'spin', label: 'Walk the edge: spin about x', min: 0, max: 720, step: 1, speed: 80, loop: true, fmt: (v) => `${Math.round(v)}°` },
  ],

  build({ group, colors }) {
    const NE = 90, NP = 240, pos = [], col = [], idx = [];
    const rim = new THREE.Color(colors.loop), core = new THREE.Color(colors.accent);
    for (let i = 0; i <= NE; i++) {
      for (let j = 0; j <= NP; j++) {
        const eta = (PI * i) / NE, phi = (2 * PI * j) / NP;
        pos.push(...project(sudanese(eta, phi)));
        const c = rim.clone().lerp(core, Math.pow(Math.sin(eta), 0.6));
        c.offsetHSL(0, 0, 0.1 * Math.cos(12 * phi));
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < NE; i++) {
      for (let j = 0; j < NP; j++) {
        const a = i * (NP + 1) + j, b = a + NP + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.45 })));
    const ring = Array.from({ length: 200 }, (_, k) => project(edge((2 * PI * k) / 200)));
    group.add(tube(ring, 0.035, new THREE.MeshStandardMaterial({ color: new THREE.Color(colors.loop) }), true));
  },

  update({ state }) {
    const q = edge((state.spin * PI) / 360);
    return { dot: project(q), q };
  },

  coords(rot, state) {
    const s = state.spin;
    return [
      ['spin', `${Math.round(s)}° about x`],
      ['quaternion', `(${edge((s * PI) / 360).map((c) => c.toFixed(2)).join(', ')})`],
      ['object', s >= 360 ? `looks like ${Math.round(s - 360)}° (second time round)` : `turned ${Math.round(s)}°`],
    ];
  },

  text: `
    <p>Write every rotation as a unit quaternion, a point on a sphere in 4D. This Möbius band lives on that 4D sphere. Projected into 3D, its edge becomes a <b>perfect circle</b>. That is the Sudanese Möbius band.</p>
    <p>Read as rotations, the edge is one continuous <b>spin about the x axis, all the way to 720°</b>. Press Play: the dot goes once around the edge while the object spins twice. After 360° the object looks the same, but the dot is only halfway, because the quaternion has changed sign.</p>
    <p>The band is a surface of rotations whose edge is the 720° spin. It is one way to see that a 720° spin can be filled in (see the Belt trick tab) while a 360° spin can’t.</p>
    <p>Unlike Boy’s surface, this one does not pass through itself: a Möbius band fits in 3D with no cheat, and the Sudanese band is an especially symmetric one. Look in through the round opening to see the twist.</p>`,

  formulas: [
    { tex: 'q(\\eta,\\varphi) = \\left(\\cos\\eta\\cos\\tfrac\\varphi2,\\ \\cos\\eta\\sin\\tfrac\\varphi2,\\ \\sin\\eta\\cos\\varphi,\\ \\sin\\eta\\sin\\varphi\\right)', caption: 'The band on the unit quaternions, η ∈ [0, π], φ ∈ [0, 2π).' },
    { tex: 'q(\\eta,\\varphi + 2\\pi) = q(\\pi - \\eta,\\ \\varphi)', caption: 'Going once around flips the band: this is the Möbius twist.' },
    { tex: '\\partial\\,\\text{band} = \\{(\\cos\\psi,\\ \\sin\\psi,\\ 0,\\ 0)\\} = \\text{spin of } 2\\psi \\text{ about } x', caption: 'The edge is a 720° spin about x.' },
    { tex: '\\mathbf p = \\operatorname{stereo}(-\\bar P\\, q), \\qquad \\operatorname{stereo}(w,x,y,z) = \\frac{(x,y,z)}{1+w}', caption: 'Projection to 3D from a pole P off the band.' },
  ],
  code: [sudanese, edge, project],
};

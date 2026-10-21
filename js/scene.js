// Small three.js helpers used by the models.
import * as THREE from 'three';

export const v3 = (p) => new THREE.Vector3(p[0], p[1], p[2]);

/** Read the color tokens from CSS so the scene follows light and dark mode. */
export function readColors() {
  const s = getComputedStyle(document.documentElement);
  const g = (n) => s.getPropertyValue(n).trim();
  return {
    fg: g('--fg'), muted: g('--muted'), cage: g('--cage'), loop: g('--loop'),
    dot: g('--dot'), accent: g('--accent'), surface: g('--surface'),
    glueA: g('--glue-a'), glueB: g('--glue-b'), lock: g('--lock'),
  };
}

export function material(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), roughness: 0.5, metalness: 0.05, ...opts,
  });
}

export function hueColor(h, s = 0.75, l = 0.55) {
  return new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l);
}

/** A tube along a list of [x, y, z] points. */
export function tube(points, radius, mat, closed = false) {
  if (points.length < 2) return new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(points.map(v3), closed);
  const geo = new THREE.TubeGeometry(curve, Math.max(32, points.length * 2), radius, 10, closed);
  return new THREE.Mesh(geo, mat);
}

/** Split a polyline into pieces wherever it leaves the box |x|,|y|,|z| < limit. */
export function splitRuns(points, limit) {
  const runs = [[]];
  for (const p of points) {
    if (Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2])) < limit) {
      runs[runs.length - 1].push(p);
    } else if (runs[runs.length - 1].length) {
      runs.push([]);
    }
  }
  return runs.filter((r) => r.length > 1);
}

/** Circle of radius r around `normal`, lifted by `offset`. */
export function circle(normal, r, offset = [0, 0, 0], steps = 120) {
  const n = v3(normal).normalize();
  const u = new THREE.Vector3().crossVectors(n, new THREE.Vector3(1, 0, 0));
  if (u.length() < 1e-6) u.crossVectors(n, new THREE.Vector3(0, 1, 0));
  u.normalize();
  const w = new THREE.Vector3().crossVectors(n, u);
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (2 * Math.PI * i) / steps;
    pts.push([
      r * (Math.cos(t) * u.x + Math.sin(t) * w.x) + offset[0],
      r * (Math.cos(t) * u.y + Math.sin(t) * w.y) + offset[1],
      r * (Math.cos(t) * u.z + Math.sin(t) * w.z) + offset[2],
    ]);
  }
  return pts;
}

/** A text label that always faces the camera. */
export function label(text, pos, size, color) {
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  const font = '500 56px "IBM Plex Sans", system-ui, sans-serif';
  x.font = font;
  const w = Math.ceil(x.measureText(text).width) + 24;
  c.width = w;
  c.height = 96;
  x.font = font;
  x.fillStyle = color;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, w / 2, 48);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set((size * w) / 96, size, 1);
  s.position.copy(v3(pos));
  s.renderOrder = 5;
  return s;
}

/** Free GPU memory for everything under `obj`. */
export function dispose(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
}

/** Split a path wherever it jumps (e.g. crossing the glued surface of the ball). */
export function splitJumps(points, maxStep = 1.5) {
  const runs = [[]];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[i - 1];
    if (q && Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > maxStep) runs.push([]);
    runs[runs.length - 1].push(p);
  }
  return runs.filter((r) => r.length > 1);
}

/** Light wire cage of a ball of radius r. */
export function cage(r, color, radius = 0.025, opacity = 0.06) {
  const g = new THREE.Group();
  const m = material(color);
  g.add(tube(circle([0, 0, 1], r), radius, m, true));
  for (const deg of [0, 60, 120]) {
    const a = (deg * Math.PI) / 180;
    g.add(tube(circle([Math.cos(a), Math.sin(a), 0], r), radius, m, true));
  }
  g.add(new THREE.Mesh(
    new THREE.SphereGeometry(r, 48, 32),
    material(color, { transparent: true, opacity, depthWrite: false }),
  ));
  return g;
}

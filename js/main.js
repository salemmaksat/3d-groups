import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PI, axisFromAngles, canonical, quatFromAxisAngle, matrixFromQuat } from './math.js';
import { readColors, material, dispose, v3 } from './scene.js';
import ball from './models/ball.js';
import shells from './models/shells.js';
import hopf from './models/hopf.js';
import slices from './models/slices.js';
import euler from './models/euler.js';
import boy from './models/boy.js';
import sudan from './models/sudan.js';
import belt from './models/belt.js';
import su2 from './models/su2.js';
import finite from './models/finite.js';
import compose from './models/compose.js';
import interp from './models/interp.js';
import random from './models/random.js';

/* A model is an object with:
 *   id, name, camera, target?, dotSize?, global? (false = ignores the rotation sliders),
 *   noInset?, insetObject?({ state }) — what the small window shows (default: a phone)
 *   state, controls: [{ type: 'range' | 'play' | 'check' | 'select', key, label, ... }]
 *   build({ group, colors, state })          static geometry
 *   update({ dyn, colors, state, marker }, rot) → [x, y, z] | { dot, q }
 *   coords(rot, state) → string | [[label, value], ...]
 *   text, formulas, code
 */
const GROUPS = [
  ['The space', [ball, shells, slices, euler, hopf]],
  ['Surfaces inside', [boy, sudan]],
  ['Loops and covers', [belt, su2]],
  ['Groups and motion', [finite, compose, interp, random]],
];
const models = GROUPS.flatMap(([, ms]) => ms);
const $ = (s) => document.querySelector(s);

// ---------- rotation state (shared by the models that use it) ----------
const DEFAULT = { az: 120, pol: 60, spin: 120 };
const ui = { ...DEFAULT, playing: false };

function currentRotation() {
  const n = axisFromAngles(ui.az, ui.pol);
  const spin = (ui.spin * PI) / 180;               // 0 .. 4π
  const { axis, angle } = canonical(n, spin);
  const q = quatFromAxisAngle(axis, angle);        // w ≥ 0 because angle ≤ π
  const qRaw = quatFromAxisAngle(n, spin);         // keeps the sign: 360° gives −1
  return { n, spin, axis, angle, q, qRaw, R: matrixFromQuat(q) };
}

// ---------- renderer, main scene ----------
const stage = $('#stage');
const insetFrame = $('#insetFrame');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.autoClear = false;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(5, 3, 8);
scene.add(sun);
const backLight = new THREE.DirectionalLight(0xffffff, 0.35);
backLight.position.set(-4, -3, -5);
scene.add(backLight);

const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 300);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
// Wheel zoom only after the viewer is touched, so the page still scrolls normally.
controls.enableZoom = false;
stage.addEventListener('pointerdown', () => (controls.enableZoom = true));
stage.addEventListener('pointerleave', () => (controls.enableZoom = false));

let staticGroup = new THREE.Group();
let dynGroup = new THREE.Group();
scene.add(staticGroup, dynGroup);

const dot = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ depthTest: false }));
dot.renderOrder = 10;
const dotRing = new THREE.Mesh(
  new THREE.SphereGeometry(1.35, 24, 16),
  new THREE.MeshBasicMaterial({ depthTest: false, transparent: true, opacity: 0.35 }),
);
dotRing.renderOrder = 9;
scene.add(dot, dotRing);

/** Extra always-visible dot, added to the dynamic layer. */
function marker(p, color, size = 0.1) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(size, 18, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color || colors.dot), depthTest: false }),
  );
  m.renderOrder = 10;
  m.position.set(p[0], p[1], p[2]);
  dynGroup.add(m);
  return m;
}

// ---------- inset scene: the rotated object ----------
const inset = new THREE.Scene();
inset.add(new THREE.HemisphereLight(0xffffff, 0x556677, 1.7));
const insetSun = new THREE.DirectionalLight(0xffffff, 1);
insetSun.position.set(3, 2, 5);
inset.add(insetSun);
const insetCam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
insetCam.up.set(0, 0, 1);
insetCam.position.set(3.2, 2.5, 2.0);
insetCam.lookAt(0, 0, 0);

const phone = new THREE.Group();
const phoneBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.78, 0.14), material('#4a5866'));
const phoneScreen = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.64, 0.02), material('#74c0fc'));
phoneScreen.position.z = 0.08;
const phoneCam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 20), material('#e8590c'));
phoneCam.rotation.x = PI / 2;
phoneCam.position.set(0.55, 0, -0.09);
const phoneTip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 16), material('#e8590c'));
phoneTip.rotation.z = -PI / 2;
phoneTip.position.set(0.86, 0, 0);
phone.add(phoneBody, phoneScreen, phoneCam, phoneTip);
let insetObject = phone;
inset.add(phone);
const axisArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 1.35, 0x888888, 0.2, 0.12);
inset.add(axisArrow);
inset.add(new THREE.AxesHelper(1.1));

function setInsetObject(obj) {
  if (insetObject === obj) return;
  inset.remove(insetObject);
  if (insetObject !== phone) dispose(insetObject);
  insetObject = obj;
  inset.add(obj);
}

// ---------- model switching ----------
let current = models[0];
let colors = readColors();

function rebuild() {
  colors = readColors();
  scene.remove(staticGroup);
  dispose(staticGroup);
  staticGroup = new THREE.Group();
  scene.add(staticGroup);
  current.build({ group: staticGroup, colors, state: current.state });
  setInsetObject(current.insetObject ? current.insetObject({ state: current.state }) : phone);
  dot.material.color.set(colors.dot);
  dotRing.material.color.set(colors.dot);
  updateRotation();
}

function updateRotation() {
  const rot = currentRotation();
  scene.remove(dynGroup);
  dispose(dynGroup);
  dynGroup = new THREE.Group();
  scene.add(dynGroup);
  const out = current.update({ dyn: dynGroup, colors, state: current.state, marker }, rot);
  const res = Array.isArray(out) ? { dot: out } : out || {};
  dot.visible = dotRing.visible = !!res.dot;
  if (res.dot) {
    const size = current.dotSize || 0.13;
    dot.position.copy(v3(res.dot));
    dot.scale.setScalar(size);
    dotRing.position.copy(dot.position);
    dotRing.scale.setScalar(size);
  }
  const q = res.q || rot.q;
  insetObject.quaternion.set(q[1], q[2], q[3], q[0]);
  const v = new THREE.Vector3(q[1], q[2], q[3]);
  axisArrow.visible = v.length() > 1e-4;
  if (axisArrow.visible) axisArrow.setDirection(v.normalize());
  writeReadout(rot);
}

const fmt = (x) => (x >= 0 ? ' ' : '') + x.toFixed(2);
function writeReadout(rot) {
  const rows = [];
  if (current.global !== false) {
    const deg = Math.round((rot.angle * 180) / PI);
    const s = ui.spin % 360;
    const folded = s > 180 ? ` <span class="note">(${Math.round(ui.spin)}° spin = ${deg}° about −n̂)</span>` : '';
    const full = ui.spin >= 360 ? ` <span class="note">(past one full turn)</span>` : '';
    rows.push(['axis n̂', `(${rot.axis.map(fmt).join(', ')})`]);
    rows.push(['angle θ', `${deg}°${folded}${full}`]);
    rows.push(['quaternion', `(${rot.q.map(fmt).join(', ')})`]);
  }
  const c = current.coords(rot, current.state);
  if (typeof c === 'string') rows.push([current.name, c]);
  else rows.push(...c);
  $('#readout').innerHTML = rows.map(([k, val]) => `<div><dt>${k}</dt><dd>${val}</dd></div>`).join('');
}

// ---------- per-model controls ----------
const playing = new Set();
const maxOf = (c) => (typeof c.max === 'function' ? c.max(current.state) : c.max);

function renderModelControls(m) {
  playing.clear();
  const box = $('#modelControls');
  box.hidden = !m.controls.length;
  const parts = [`<h2>${m.name}</h2>`];
  const checks = [];
  for (const c of m.controls) {
    const val = m.state[c.key];
    const dis = c.disabled && c.disabled(m.state) ? 'disabled' : '';
    if (c.type === 'range' || c.type === 'play') {
      parts.push(`
        <div class="ctl ${dis ? 'is-disabled' : ''}">
          <span class="ctl-row"><label for="c-${c.key}">${c.label}</label><output id="o-${c.key}">${c.fmt(val)}</output></span>
          <div class="ctl-line">
            ${c.type === 'play' ? `<button class="btn small" id="p-${c.key}" aria-pressed="false" ${dis}>Play</button>` : ''}
            <input type="range" id="c-${c.key}" min="${c.min}" max="${maxOf(c)}" step="${c.step}" value="${val}" ${dis}>
          </div>
        </div>`);
    } else if (c.type === 'select') {
      parts.push(`
        <label class="ctl" for="c-${c.key}"><span class="ctl-row"><span>${c.label}</span></span>
          <select id="c-${c.key}">${c.options.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </label>`);
    } else if (c.type === 'check') {
      checks.push(`<label class="check"><input type="checkbox" id="c-${c.key}" ${val ? 'checked' : ''}> ${c.label}</label>`);
    }
  }
  if (checks.length) parts.push(`<div class="checks">${checks.join('')}</div>`);
  box.innerHTML = parts.join('');

  for (const c of m.controls) {
    const el = $(`#c-${c.key}`);
    if (c.type === 'range' || c.type === 'play') {
      el.addEventListener('input', (e) => {
        m.state[c.key] = +e.target.value;
        $(`#o-${c.key}`).textContent = c.fmt(m.state[c.key]);
        applyChange(c);
      });
      if (c.type === 'play') {
        $(`#p-${c.key}`).addEventListener('click', (e) => {
          if (playing.has(c)) playing.delete(c);
          else {
            if (!c.loop && m.state[c.key] >= maxOf(c)) m.state[c.key] = c.min; // restart from the beginning
            playing.add(c);
          }
          e.target.textContent = playing.has(c) ? 'Pause' : 'Play';
          e.target.setAttribute('aria-pressed', playing.has(c));
        });
      }
    } else if (c.type === 'select') {
      el.addEventListener('change', (e) => {
        const raw = e.target.value;
        m.state[c.key] = typeof m.state[c.key] === 'number' ? +raw : raw;
        if (c.onChange) c.onChange(m.state);
        renderModelControls(m);
        rebuild();
      });
    } else if (c.type === 'check') {
      el.addEventListener('change', (e) => { m.state[c.key] = e.target.checked; rebuild(); });
    }
  }
}

/** Ranges rebuild the geometry; play controls only re-run update() unless they ask to rebuild. */
function applyChange(c) {
  if (c.type === 'range' || c.rebuild) rebuild();
  else updateRotation();
}

function stepPlaying(dt) {
  for (const c of playing) {
    const m = current, max = maxOf(c);
    let v = m.state[c.key] + c.speed * dt;
    if (v > max + (c.step >= 1 && max < 100 ? 0.999 : 0)) {
      if (c.loop) v = c.min;
      else {
        v = max;
        playing.delete(c);
        const b = $(`#p-${c.key}`);
        if (b) { b.textContent = 'Play'; b.setAttribute('aria-pressed', 'false'); }
      }
    }
    m.state[c.key] = v;
    const el = $(`#c-${c.key}`);
    if (el) el.value = v;
    $(`#o-${c.key}`).textContent = c.fmt(v);
    applyChange(c);
  }
}

// ---------- the text under the viewer ----------
function renderAbout(m) {
  $('#modelTitle').textContent = m.name;
  $('#modelText').innerHTML = m.text;
  const mathBox = $('#modelMath');
  mathBox.innerHTML = '';
  for (const f of m.formulas) {
    const fig = document.createElement('figure');
    const eq = document.createElement('div');
    eq.className = 'eq';
    try {
      window.katex.render(f.tex, eq, { displayMode: true, output: 'mathml', throwOnError: false });
    } catch {
      eq.textContent = f.tex;
    }
    const cap = document.createElement('figcaption');
    cap.textContent = f.caption;
    fig.append(eq, cap);
    mathBox.append(fig);
  }
  const source = m.code.map((fn) => fn.toString()).join('\n\n');
  const codeEl = $('#modelCode');
  codeEl.dataset.raw = source;
  codeEl.innerHTML = window.Prism
    ? window.Prism.highlight(source, window.Prism.languages.javascript, 'javascript')
    : source.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  $('#codeFile').textContent = `js/models/${m.id}.js · js/math.js`;
}

function show(m, { pushHash = true } = {}) {
  current = m;
  for (const b of document.querySelectorAll('#tabs button')) {
    const on = b.dataset.id === m.id;
    b.setAttribute('aria-selected', on);
    b.tabIndex = on ? 0 : -1;
    if (on && pushHash) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  $('#rotCard').hidden = m.global === false;
  insetFrame.hidden = !!m.noInset;
  $('#legendObj').hidden = !!m.noInset;
  camera.position.set(...m.camera);
  controls.target.set(...(m.target || [0, 0, 0]));
  controls.update();
  renderModelControls(m);
  renderAbout(m);
  rebuild();
  if (pushHash) history.replaceState(null, '', `#${m.id}`);
}

// tabs, grouped
const tabs = $('#tabs');
let num = 0;
for (const [title, ms] of GROUPS) {
  const g = document.createElement('div');
  g.className = 'tab-group';
  g.innerHTML = `<span class="tab-group-label">${title}</span>`;
  const row = document.createElement('div');
  row.className = 'tab-row';
  for (const m of ms) {
    const b = document.createElement('button');
    b.role = 'tab';
    b.dataset.id = m.id;
    b.innerHTML = `<span class="n">${++num}</span>${m.name}`;
    b.addEventListener('click', () => show(m));
    row.append(b);
  }
  g.append(row);
  tabs.append(g);
}
tabs.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const i = models.indexOf(current);
  const next = models[(i + (e.key === 'ArrowRight' ? 1 : models.length - 1)) % models.length];
  show(next);
  tabs.querySelector(`[data-id="${next.id}"]`).focus();
});

// ---------- rotation sliders ----------
const sliders = { az: $('#az'), pol: $('#pol'), spin: $('#spin') };
const outputs = { az: $('#o-az'), pol: $('#o-pol'), spin: $('#o-spin') };
function syncSliders() {
  for (const k of Object.keys(sliders)) {
    sliders[k].value = ui[k];
    outputs[k].textContent = `${Math.round(ui[k])}°`;
  }
}
for (const k of Object.keys(sliders)) {
  sliders[k].addEventListener('input', (e) => {
    ui[k] = +e.target.value;
    outputs[k].textContent = `${Math.round(ui[k])}°`;
    updateRotation();
  });
}
const playBtn = $('#play');
playBtn.addEventListener('click', () => {
  ui.playing = !ui.playing;
  playBtn.textContent = ui.playing ? 'Pause' : 'Play';
  playBtn.setAttribute('aria-pressed', ui.playing);
});
$('#reset').addEventListener('click', () => {
  Object.assign(ui, DEFAULT);
  syncSliders();
  updateRotation();
});
$('#copy').addEventListener('click', async () => {
  const btn = $('#copy');
  try {
    await navigator.clipboard.writeText($('#modelCode').dataset.raw);
    btn.textContent = 'Copied';
  } catch {
    const r = document.createRange();
    r.selectNodeContents($('#modelCode'));
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    btn.textContent = 'Selected';
  }
  setTimeout(() => (btn.textContent = 'Copy'), 1500);
});

// ---------- theme, size, render loop ----------
const onTheme = () => rebuild();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onTheme);
new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

let W = 1, H = 1, S = 1;
function resize() {
  W = stage.clientWidth;
  H = stage.clientHeight;
  S = Math.round(Math.min(W * 0.34, 190));
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  insetFrame.style.width = insetFrame.style.height = `${S}px`;
}
new ResizeObserver(resize).observe(stage);

let visible = true;
new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(stage);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (ui.playing && current.global !== false) {
    ui.spin = (ui.spin + dt * 60) % 720;
    sliders.spin.value = ui.spin;
    outputs.spin.textContent = `${Math.round(ui.spin)}°`;
    updateRotation();
  }
  if (playing.size) stepPlaying(dt);
  if (visible) {
    controls.update();
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W, H);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    if (!current.noInset) {
      const m = 10;
      renderer.setScissorTest(true);
      renderer.setScissor(W - S - m, m, S, S);
      renderer.setViewport(W - S - m, m, S, S);
      renderer.setClearColor(new THREE.Color(colors.surface), 1);
      renderer.clear();
      renderer.render(inset, insetCam);
      renderer.setScissorTest(false);
    }
  }
  requestAnimationFrame(frame);
}

// ---------- start ----------
syncSliders();
resize();
const start = models.find((m) => m.id === location.hash.slice(1)) || models[0];
show(start, { pushHash: false });
requestAnimationFrame(frame);

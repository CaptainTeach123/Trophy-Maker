import { Viewer, MATERIALS } from './viewer.js';
import { buildTrophy, defaultState } from './builder.js';
import { loadFont, registerCustomFont, listFonts } from './text.js';
import { parseSTL, stlToManifold, bodiesToBinarySTL } from './stl.js';
import { zipSync, deflateSync, inflateSync, strToU8, strFromU8 } from '../vendor/fflate/fflate.js';
import { Thumbs } from './thumbs.js';
import { initUI, h } from './ui.js';
import { PRESETS, applyPatch } from './presets.js';
import { BASES } from './parts/bases.js';
import { COLUMNS } from './parts/columns.js';
import { TOPPERS } from './parts/toppers.js';
import { PLAQUES } from './parts/plaques.js';

const STORE = 'trophymaker.design.v1';

/** Make a loaded/shared design safe: unknown styles or fonts fall back to defaults instead of breaking the build. */
function sanitize(st) {
  const d = defaultState();
  const known = (list, id, fallback) => (list.some((x) => x.id === id) ? id : fallback);
  st.base.style = known(BASES, st.base.style, d.base.style);
  st.column.style = known(COLUMNS, st.column.style, d.column.style);
  st.topper.style = known(TOPPERS, st.topper.style, d.topper.style);
  st.plaque.style = known(PLAQUES, st.plaque.style, d.plaque.style);
  const fonts = listFonts();
  const okFont = (id) => (fonts.some((f) => f.id === id) ? id : 'cinzel');
  st.topper.font = okFont(st.topper.font);
  st.plaque.lines = (st.plaque.lines || []).slice(0, 6).map((l) => ({ text: String(l.text ?? ''), font: okFont(l.font), size: Number(l.size) || 4 }));
  st.extras = (st.extras || []).slice(0, 24).map((e) => (e.type === 'text' ? { ...e, font: okFont(e.font) } : e));
  if (!['weld', 'parts'].includes(st.output.mode)) st.output.mode = 'weld';
  return st;
}
const $ = (id) => document.getElementById(id);

const app = {
  state: loadFromHash() || loadSaved() || defaultState(),
  assets: {},
  last: null,
  filename: 'trophy',
  thumbs: new Thumbs(),
  changed, loadPreset, randomize, saveDesign, reset, pickStl, pickFont, removeAsset, download, shareLink,
};
window.app = app; // handy for debugging / tests

/* ------------------------------------------------------------------ persistence */
function loadSaved() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    return sanitize(applyPatch(JSON.parse(raw)));
  } catch { return null; }
}
/* shareable link: the design JSON, deflated + base64url in the URL hash */
const b64 = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (str) => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
function loadFromHash() {
  try {
    const m = location.hash.match(/^#d=(.+)$/);
    if (!m) return null;
    return sanitize(applyPatch(JSON.parse(strFromU8(inflateSync(unb64(m[1]))))));
  } catch { return null; }
}
function shareLink() {
  const url = location.origin + location.pathname + '#d=' + b64(deflateSync(strToU8(JSON.stringify(app.state))));
  history.replaceState(null, '', url);
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
    () => toast('Link copied — anyone opening it gets this exact design (uploaded STLs and fonts are not included).', '', 5000),
    () => toast('Link is now in the address bar — copy it from there.', '', 5000));
}
function persist() { try { localStorage.setItem(STORE, JSON.stringify(app.state)); } catch { /* private mode */ } }

/* ------------------------------------------------------------------ toasts */
function toast(msg, kind = '', ms = 6000) {
  const el = h('div', { class: 'toast ' + kind }, h('span', { text: msg }), h('button', { text: '✕', onClick: () => el.remove() }));
  $('toasts').append(el);
  if (ms) setTimeout(() => el.remove(), ms);
  return el;
}

/* ------------------------------------------------------------------ viewer */
let viewer;
try {
  viewer = new Viewer($('view'));
} catch (e) {
  window.__fatal && window.__fatal('Your browser could not start WebGL, which the 3D preview needs. Try a current Chrome, Edge, Firefox or Safari with hardware acceleration enabled.');
  throw e;
}
app.viewer = viewer;

function initViewbar() {
  const vb = $('viewbar');
  vb.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    vb.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('on', x === b));
    viewer.frame(b.dataset.view);
  }));
  $('vSpin').addEventListener('click', (e) => { viewer.autoRotate = !viewer.autoRotate; e.currentTarget.classList.toggle('on', viewer.autoRotate); });
  $('vBed').addEventListener('click', (e) => { const on = !e.currentTarget.classList.contains('on'); e.currentTarget.classList.toggle('on', on); viewer.bed.visible = on; });
  $('vWire').addEventListener('click', (e) => { viewer.wire = !viewer.wire; e.currentTarget.classList.toggle('on', viewer.wire); viewer.refreshMaterials(); });
  const mb = $('matbar');
  const dots = Object.entries(MATERIALS).map(([name, m]) => {
    const b = h('button', { class: 'dot' + (name === viewer.materialName ? ' on' : ''), title: name[0].toUpperCase() + name.slice(1), style: `background:#${m.color.toString(16).padStart(6, '0')}` });
    b.addEventListener('click', () => { viewer.materialName = name; viewer.colorByPart = false; mb.querySelectorAll('.dot').forEach((x) => x.classList.toggle('on', x === b)); part.classList.remove('on'); viewer.refreshMaterials(); });
    return b;
  });
  const part = h('button', { text: 'By part', title: 'Colour each part differently' });
  part.addEventListener('click', () => { viewer.colorByPart = !viewer.colorByPart; part.classList.toggle('on', viewer.colorByPart); viewer.refreshMaterials(); });
  mb.append(...dots, part);
}
initViewbar();

/* ------------------------------------------------------------------ building */
let building = false, dirty = false, timer = null, firstBuild = true;
function setBusy(on) { $('stage').classList.toggle('busy', on); }
app.thumbs.busy = () => building || timer !== null;

function fontsNeeded() {
  const s = app.state;
  const ids = new Set(['cinzel']);
  if (s.topper.style === 'text') ids.add(s.topper.font);
  s.plaque.lines.forEach((l) => ids.add(l.font));
  s.extras.forEach((e) => e.type === 'text' && ids.add(e.font));
  if (s.base.style === 'podium') ids.add('anton');
  return [...ids];
}
async function ensureFonts() {
  for (const id of fontsNeeded()) {
    try { await loadFont(id); } catch (e) { /* custom font ids are already registered; unknown ones fall back */ }
  }
}

function changed() {
  persist();
  schedule(60);
}
function schedule(delay) {
  clearTimeout(timer);
  setBusy(true);
  timer = setTimeout(() => { timer = null; rebuild(); }, delay);
}

async function rebuild() {
  if (building) { dirty = true; return; }
  building = true; dirty = false;
  setBusy(true);
  try {
    await ensureFonts();
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    const t0 = performance.now();
    const r = buildTrophy(app.state, app.assets);
    app.buildMs = performance.now() - t0;
    app.last = r;
    viewer.setBodies(r.bodies);
    if (firstBuild) { viewer.frame('iso'); firstBuild = false; }
    showStatus(r);
    document.querySelectorAll('.toast.build').forEach((t) => t.remove());
    [...new Set(r.warnings)].forEach((w) => toast(w, '', 9000).classList.add('build'));
  } catch (e) {
    console.error(e);
    toast('Could not build this combination: ' + (e.message || e), 'err', 9000);
  }
  building = false;
  if (dirty) schedule(0);
  else { setBusy(false); if (app.tab === 'export') app.rerender(); }
}

function showStatus(r) {
  const st = $('status');
  [...st.querySelectorAll('.chip')].forEach((c) => c.remove());
  const ok = r.bodies.length && r.bodies.every((b) => b.watertight);
  const chips = [
    h('span', { class: 'chip' }, h('b', { text: r.stats.size.map((v) => v.toFixed(0)).join(' × ') }), ' mm'),
    h('span', { class: 'chip', text: `${Math.round(r.stats.triangles / 1000 * 10) / 10}k triangles` }),
    h('span', { class: 'chip ' + (ok ? 'ok' : 'warn'), text: ok ? `✓ Watertight${r.bodies.length > 1 ? ` · ${r.bodies.length} bodies` : ''}` : '⚠ Contains unwelded shell' }),
    h('span', { class: 'chip', text: `${(r.stats.volume / 1000).toFixed(0)} cm³` }),
  ];
  st.append(...chips);
  $('statusText').textContent = '';
}

/* ------------------------------------------------------------------ actions */
function loadPreset(id) {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return;
  const keepOut = { ...app.state.output };
  app.state = applyPatch(p.patch);
  app.state.output = { ...app.state.output, ...keepOut };
  persist(); schedule(0);
  firstBuild = true;
}
function reset() { app.state = defaultState(); persist(); schedule(0); app.rerender(); firstBuild = true; }

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rnd = (a, b, step = 1) => Math.round((a + Math.random() * (b - a)) / step) * step;
function randomize() {
  const s = app.state;
  const rect = (id) => BASES.find((b) => b.id === id).rect;
  s.base.style = pick(BASES).id;
  s.base.width = rnd(76, 110); s.base.depth = rect(s.base.style) ? rnd(60, 100) : s.base.width; s.base.height = rnd(30, 50);
  s.column.style = pick(COLUMNS).id; s.column.height = rnd(18, 56); s.column.radius = rnd(6, 11, 0.5);
  s.topper.style = pick(TOPPERS.filter((t) => t.build && t.id !== 'text')).id; s.topper.size = rnd(80, 130);
  s.plaque.style = pick(PLAQUES).id;
  const o = s.orn;
  o.base.beadsTop = Math.random() < 0.4; o.base.beadsFoot = Math.random() < 0.2; o.base.finials = Math.random() < 0.25; o.base.feet = Math.random() < 0.2;
  o.base.finialStyle = pick(['urn', 'ball', 'spike']);
  o.column.collars = Math.random() < 0.35; o.column.leaves = Math.random() < 0.2;
  o.topper.wings = Math.random() < 0.15; o.topper.halo = Math.random() < 0.15;
  o.plaque.border = Math.random() < 0.4; o.plaque.studs = Math.random() < 0.3; o.plaque.scrolls = Math.random() < 0.25; o.plaque.laurel = Math.random() < 0.2;
  persist(); schedule(0); app.rerender();
}

function download_(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function saveDesign() {
  download_(new Blob([JSON.stringify(app.state, null, 2)], { type: 'application/json' }), `${app.filename}.trophy.json`);
  toast('Design saved. Note: uploaded STL files and fonts are not stored inside the design file.', '', 6000);
}
async function download() {
  if (building || timer) { toast('Still building — try again in a moment.', '', 2500); return; }
  const r = app.last;
  if (!r || !r.bodies.length) { toast('Nothing to export yet.', 'err'); return; }
  if (app.state.output.mode === 'parts' && r.bodies.length > 1) {
    const files = {};
    r.bodies.forEach((b, i) => { files[`${app.filename}-${String(i + 1).padStart(2, '0')}-${b.name.replace(/[^\w-]+/g, '_')}.stl`] = new Uint8Array(bodiesToBinarySTL([b], `Trophy Maker ${b.name}`)); });
    download_(new Blob([zipSync(files)], { type: 'application/zip' }), `${app.filename}-parts.zip`);
  } else {
    download_(new Blob([bodiesToBinarySTL(r.bodies)], { type: 'model/stl' }), `${app.filename}.stl`);
  }
  toast(`Exported ${r.stats.triangles.toLocaleString()} triangles.`, '', 3500);
}

/* ------------------------------------------------------------------ file inputs */
function openFile(input, handler) {
  input.value = '';
  input.onchange = async () => { const f = input.files[0]; if (f) await handler(f); };
  input.click();
}
let stlCounter = 0;
function pickStl(cb) {
  openFile($('fileStl'), async (f) => {
    try {
      const buf = await f.arrayBuffer();
      const soup = parseSTL(buf);
      if (soup.length / 9 > 400000) toast('That is a very dense mesh — welding may be slow. Consider decimating it first.', '', 8000);
      const res = stlToManifold(soup);
      const id = 'stl' + ++stlCounter;
      app.assets[id] = { name: f.name, soup, manifold: res.manifold, reason: res.reason, rev: 1 };
      if (!res.manifold) toast(res.reason, '', 10000);
      cb && cb(id);
    } catch (e) { toast('Could not read that STL: ' + e.message, 'err'); }
  });
}
function pickFont(cb) {
  openFile($('fileFont'), async (f) => {
    try {
      const id = registerCustomFont(f.name.replace(/\.\w+$/, ''), await f.arrayBuffer());
      // use it right away on the first plaque line so the effect is visible
      const line = app.state.plaque.lines[0];
      if (line) line.font = id;
      toast(`Font “${f.name}” loaded and applied to plaque line 1.`, '', 4000);
      changed(); cb && cb();
    } catch (e) { toast('Could not read that font file (use TTF, OTF or WOFF).', 'err'); }
  });
}
function removeAsset(id) {
  const a = app.assets[id];
  if (a && a.manifold) a.manifold.delete();
  delete app.assets[id];
  const s = app.state;
  if (s.topper.stlId === id) s.topper.stlId = null;
  s.extras = s.extras.filter((e) => e.assetId !== id);
  changed(); app.rerender();
}
$('fileDesign').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try { app.state = sanitize(applyPatch(JSON.parse(await f.text()))); persist(); schedule(0); app.rerender(); firstBuild = true; toast('Design loaded.', '', 2500); } catch { toast('That is not a Trophy Maker design file.', 'err'); }
  e.target.value = '';
});

$('btnExport').addEventListener('click', download);
$('btnRandom').addEventListener('click', randomize);

/* ------------------------------------------------------------------ dev hook: tools/gen-thumbs.mjs */
window.__renderThumbs = () => {
  const items = [];
  BASES.forEach((x) => items.push(['base', x.id]));
  COLUMNS.filter((x) => x.build).forEach((x) => items.push(['column', x.id]));
  TOPPERS.filter((x) => x.build).forEach((x) => items.push(['topper', x.id]));
  PLAQUES.forEach((x) => items.push(['plaque', x.id]));
  PRESETS.forEach((x) => items.push(['preset', x.id]));
  return app.thumbs.renderAll(items);
};

/* ------------------------------------------------------------------ go */
app.ui = initUI(app);
$('statusText').textContent = 'Building…';
schedule(0);
if (new URLSearchParams(location.search).has('debug')) window.listFonts = listFonts;

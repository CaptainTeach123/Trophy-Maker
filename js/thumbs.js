// Lazy thumbnail renderer: every option card shows a real 3D preview built by the same geometry code.
import { scoped, toMeshData, setCacheEnabled, quality } from './kernel.js';
import { getBase } from './parts/bases.js';
import { getColumn } from './parts/columns.js';
import { getTopper } from './parts/toppers.js';
import { buildPlaque } from './parts/plaques.js';
import { buildTrophy } from './builder.js';
import { applyPatch, PRESETS } from './presets.js';
import { loadFont } from './text.js';
import { ThumbRenderer } from './viewer.js';
import { VERSION } from './version.js';

const body = (m) => { const d = toMeshData(m); return { positions: d.positions, indices: d.indices }; };

const BUILDERS = {
  base: (id) => {
    const d = getBase(id);
    const b = d.build({ width: 90, depth: d.id === 'oval' ? 58 : d.rect ? 78 : 90, height: 38 });
    return { bodies: [body(b.solid)] };
  },
  column: (id) => {
    const d = getColumn(id);
    const c = d.build({ height: 56, radius: 10 });
    return { bodies: [body(c.solid)] };
  },
  topper: (id) => {
    const d = getTopper(id);
    if (!d.build) return null;
    return { bodies: [body(d.build(100, { text: '1', font: 'bebas' }))] };
  },
  plaque: (id) => {
    const p = buildPlaque({
      style: id, width: 64, height: 26, thickness: 3, bevel: 0.8, textMode: 'raise', textDepth: 1, orn: {},
      lines: [{ text: 'TROPHY', font: 'cinzel', size: 6 }],
    }, { embed: 0 });
    return { bodies: [body(p.body), ...(p.text ? [body(p.text)] : [])], opts: { dir: [-0.12, -1, 0.1], fill: 1.0 } };
  },
  preset: (id) => {
    const preset = PRESETS.find((p) => p.id === id);
    const state = applyPatch(preset.patch);
    state.output.quality = 0.55;
    setCacheEnabled(false);
    try {
      const r = buildTrophy(state, {});
      return { bodies: r.bodies.map((b) => ({ positions: b.positions, indices: b.indices })), opts: { dir: [-0.45, -1, 0.32], fill: 1.0 } };
    } finally { setCacheEnabled(true); }
  },
};

const STORE = 'trophymaker.thumbs.' + VERSION;

export class Thumbs {
  constructor() {
    this.cache = new Map();
    try { for (const [k, v] of Object.entries(JSON.parse(localStorage.getItem(STORE) || '{}'))) this.cache.set(k, v); } catch { /* storage unavailable */ }
    this.waiting = new Map(); // key -> [callbacks]
    this.queue = [];
    this.running = false;
    this.renderer = null;
    this.busy = () => false; // main thread can say "user is editing, hold off"
  }
  key(kind, id) { return kind + ':' + id; }
  get(kind, id) { return this.cache.get(this.key(kind, id)); }
  want(kind, id, cb, priority = false) {
    const k = this.key(kind, id);
    if (this.cache.has(k)) { cb(this.cache.get(k)); return; }
    if (this.waiting.has(k)) { this.waiting.get(k).push(cb); if (priority) this.bump(k); return; }
    this.waiting.set(k, [cb]);
    const task = { k, kind, id };
    if (priority) this.queue.unshift(task); else this.queue.push(task);
    this.pump();
  }
  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE, JSON.stringify(Object.fromEntries(this.cache))); } catch { /* quota or private mode */ }
    }, 1500);
  }
  bump(k) {
    const i = this.queue.findIndex((t) => t.k === k);
    if (i > 0) this.queue.unshift(...this.queue.splice(i, 1));
  }
  pump() {
    if (this.running) return;
    this.running = true;
    const step = async () => {
      if (!this.queue.length) { this.running = false; return; }
      if (this.busy()) { setTimeout(step, 250); return; }
      const t = this.queue.shift();
      let url = '';
      try {
        if (t.kind === 'preset') { await loadFontsFor(t.id); }
        if (!this.renderer) this.renderer = new ThumbRenderer(120);
        const res = scoped(() => BUILDERS[t.kind](t.id));
        url = res ? this.renderer.render(res.bodies, res.opts || {}) : '';
      } catch (e) { console.warn('thumb failed', t.k, e); }
      this.cache.set(t.k, url);
      this.save();
      for (const cb of this.waiting.get(t.k) || []) cb(url);
      this.waiting.delete(t.k);
      setTimeout(step, t.kind === 'preset' ? 30 : 0);
    };
    setTimeout(step, 30);
  }
}

async function loadFontsFor(presetId) {
  const preset = PRESETS.find((p) => p.id === presetId);
  const st = applyPatch(preset.patch);
  const ids = new Set(['cinzel', 'bebas', st.topper.font, ...st.plaque.lines.map((l) => l.font)]);
  for (const id of ids) await loadFont(id);
}

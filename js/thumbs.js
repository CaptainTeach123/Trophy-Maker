// Option-card thumbnails. Normally pre-rendered images shipped in /thumbs; anything missing is built by the worker and
// rendered here (then remembered in localStorage).
import { ThumbRenderer } from './viewer.js';
import { VERSION } from './version.js';
import { BASES, COLUMNS, TOPPERS, PLAQUES } from './catalog.js';
import { PRESETS } from './presets.js';

const STORE = 'trophymaker.thumbs.' + VERSION;

export class Thumbs {
  constructor(engine) {
    this.engine = engine;
    // pre-rendered thumbnails (see tools/gen-thumbs.mjs)
    this.manifest = fetch(new URL('../thumbs/manifest.json', import.meta.url)).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    this.cache = new Map();
    try { for (const [k, v] of Object.entries(JSON.parse(localStorage.getItem(STORE) || '{}'))) this.cache.set(k, v); } catch { /* storage unavailable */ }
    this.waiting = new Map(); // key -> [callbacks]
    this.queue = [];
    this.running = false;
    this.renderer = null;
    this.busy = () => false; // main thread can say "the user is editing, hold off"
  }

  key(kind, id) { return kind + ':' + id; }

  want(kind, id, cb, priority = false) {
    const k = this.key(kind, id);
    if (this.cache.has(k)) { cb(this.cache.get(k)); return; }
    if (!this.manifestLoaded) {
      this.manifest.then((m) => { this.manifestLoaded = true; this.statics = m; this.want(kind, id, cb, priority); });
      return;
    }
    if (this.statics[k]) { const url = new URL('../thumbs/' + this.statics[k], import.meta.url).href; this.cache.set(k, url); cb(url); return; }
    if (this.waiting.has(k)) { this.waiting.get(k).push(cb); if (priority) this.bump(k); return; }
    this.waiting.set(k, [cb]);
    const task = { k, kind, id };
    if (priority) this.queue.unshift(task); else this.queue.push(task);
    this.pump();
  }

  bump(k) { const i = this.queue.findIndex((t) => t.k === k); if (i > 0) this.queue.unshift(...this.queue.splice(i, 1)); }

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      const generated = Object.fromEntries([...this.cache].filter(([, v]) => v.startsWith('data:')));
      try { localStorage.setItem(STORE, JSON.stringify(generated)); } catch { /* quota or private mode */ }
    }, 1500);
  }

  /** build (in the worker) + render one thumbnail; returns a data URL ('' if the part has no geometry) */
  async renderOne(kind, id) {
    const res = await this.engine.thumb(kind, id);
    if (!res) return '';
    this.renderer = this.renderer || new ThumbRenderer(120);
    return this.renderer.render(res.bodies, res.opts || {});
  }

  /** every thumbnail from scratch (used by tools/gen-thumbs.mjs) -> { key: dataURL } */
  async renderAll() {
    const items = [
      ...BASES.map((x) => ['base', x.id]), ...COLUMNS.filter((x) => x.solid).map((x) => ['column', x.id]),
      ...TOPPERS.filter((x) => x.solid).map((x) => ['topper', x.id]), ...PLAQUES.map((x) => ['plaque', x.id]),
      ...PRESETS.map((x) => ['preset', x.id]),
    ];
    const out = {};
    for (const [kind, id] of items) out[this.key(kind, id)] = await this.renderOne(kind, id);
    return out;
  }

  pump() {
    if (this.running) return;
    this.running = true;
    const step = async () => {
      if (!this.queue.length) { this.running = false; return; }
      if (this.busy()) { setTimeout(step, 250); return; }
      const t = this.queue.shift();
      let url = '';
      try { url = await this.renderOne(t.kind, t.id); } catch (e) { console.warn('thumb failed', t.k, e); }
      this.cache.set(t.k, url);
      this.save();
      for (const cb of this.waiting.get(t.k) || []) cb(url);
      this.waiting.delete(t.k);
      setTimeout(step, 0);
    };
    setTimeout(step, 30);
  }
}

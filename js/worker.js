// Geometry worker: the WASM boolean kernel, fonts and all mesh building live here so the page never freezes.
//   main -> worker : { rid, type, payload }          worker -> main : { rid, ok:true, result } | { rid, ok:false, error }
import { buildTrophy } from './builder.js';
import { fontsNeeded } from './state.js';
import { loadFont, registerCustomFont } from './text.js';
import { parseSTL, stlToManifold, bodiesToBinarySTL } from './stl.js';
import { creaseNormals } from './normals.js';
import { buildThumb } from './thumb-builders.js';
import { dispose } from './kernel.js';

const bootMs = Math.round(performance.now()); // time from worker start until all modules (incl. the WASM kernel) finished loading
loadFont('cinzel').catch(() => {}); // warm the default font while the first request is still in flight
const assets = {}; // id -> { name, soup, manifold, reason, rev }
let last = null;   // most recent build (kept so export needs no re-transfer)

/** render buffers for a body: non-indexed corners + crease-aware normals */
const renderBuffers = (b) => creaseNormals(b.positions, b.indices);

const handlers = {
  ping: () => ({ result: { bootMs } }),

  async build({ state }) {
    const t0 = performance.now();
    for (const f of fontsNeeded(state)) { try { await loadFont(f); } catch { /* unknown id falls back to the default font */ } }
    const r = buildTrophy(state, assets);
    last = { r, state };
    const t1 = performance.now();
    const transfer = [];
    const bodies = r.bodies.map((b) => {
      const { pos, nrm } = renderBuffers(b);
      transfer.push(pos.buffer, nrm.buffer);
      return { name: b.name, group: b.group, watertight: b.watertight, genus: b.genus, volume: b.volume, pos, nrm };
    });
    return { result: { bodies, stats: r.stats, warnings: r.warnings, ms: { build: Math.round(t1 - t0), normals: Math.round(performance.now() - t1) } }, transfer };
  },

  importStl({ assetId, name, buffer }) {
    const soup = parseSTL(buffer);
    const res = stlToManifold(soup);
    if (assets[assetId]?.manifold) dispose(assets[assetId].manifold);
    assets[assetId] = { name, soup, manifold: res.manifold, reason: res.reason, rev: (assets[assetId]?.rev || 0) + 1 };
    return { result: { triangles: soup.length / 9, weldable: !!res.manifold, reason: res.reason } };
  },

  removeAsset({ assetId }) {
    if (assets[assetId]?.manifold) dispose(assets[assetId].manifold);
    delete assets[assetId];
    return {};
  },

  registerFont({ id, buffer }) { registerCustomFont(id, buffer); return {}; },

  /** STL (or a ZIP of STLs in "parts" mode) for the last build */
  async export({ basename }) {
    if (!last || !last.r.bodies.length) throw new Error('Nothing to export yet.');
    const { r, state } = last;
    const tris = r.stats.triangles;
    if (state.output.mode === 'parts' && r.bodies.length > 1) {
      const files = {};
      r.bodies.forEach((b, i) => { files[`${basename}-${String(i + 1).padStart(2, '0')}-${b.name.replace(/[^\w-]+/g, '_')}.stl`] = new Uint8Array(bodiesToBinarySTL([b], `Trophy Maker ${b.name}`)); });
      const { zipSync } = await import('../vendor/fflate/fflate.js'); // only needed for ZIP exports
      const zip = zipSync(files, { level: 1 }); // STL barely compresses; favour speed
      return { result: { buffer: zip.buffer, filename: `${basename}-parts.zip`, mime: 'application/zip', triangles: tris }, transfer: [zip.buffer] };
    }
    const buffer = bodiesToBinarySTL(r.bodies);
    return { result: { buffer, filename: `${basename}.stl`, mime: 'model/stl', triangles: tris }, transfer: [buffer] };
  },

  async thumb({ kind, id }) {
    const res = await buildThumb(kind, id);
    if (!res) return { result: null };
    const transfer = [];
    const bodies = res.bodies.map((b) => { const { pos, nrm } = renderBuffers(b); transfer.push(pos.buffer, nrm.buffer); return { pos, nrm }; });
    return { result: { bodies, opts: res.opts || {} }, transfer };
  },
};

self.onmessage = async (e) => {
  const { rid, type, payload } = e.data;
  try {
    const out = await handlers[type](payload);
    self.postMessage({ rid, ok: true, result: out?.result }, out?.transfer || []);
  } catch (err) {
    self.postMessage({ rid, ok: false, error: String(err && err.message ? err.message : err) });
  }
};

self.postMessage({ hello: true, bootMs }); // everything is loaded: the page may start sending requests

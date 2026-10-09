// Slicer's-eye check: export each design to STL bytes, re-import them, and require ONE solid shell —
// no floating islands, no zero-volume slivers and no internal voids.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setFontLoader, loadFont, BUILTIN_FONTS } from '../js/text.js';
import { buildTrophy, defaultState } from '../js/builder.js';
import { Manifold, MeshCtor } from '../js/kernel.js';
import { BASES } from '../js/parts/bases.js';
import { COLUMNS } from '../js/parts/columns.js';
import { TOPPERS } from '../js/parts/toppers.js';
import { PLAQUES } from '../js/parts/plaques.js';
import { SHAPES } from '../js/parts/shapes.js';
import { newExtra } from '../js/state.js';
import { PRESETS, applyPatch } from '../js/presets.js';
import { clearCache } from '../js/kernel.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
setFontLoader(async (f) => { const b = fs.readFileSync(path.join(dir, '../fonts', f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); });
for (const f of BUILTIN_FONTS) await loadFont(f.id);

export function problems(state, built) {
  const r = built || buildTrophy(state, {});
  const out = [];
  for (const body of r.bodies) {
    if (!body.watertight) continue;
    // exact topology (shared vertex indices), exactly what the exported STL's triangles describe
    const m = Manifold.ofMesh(new MeshCtor({ numProp: 3, vertProperties: body.positions, triVerts: body.indices }));
    const comps = m.decompose();
    const info = comps.map((c) => { const bb = c.boundingBox(); return { v: c.volume(), z0: bb.min[2], z1: bb.max[2] }; });
    comps.forEach((c) => c.delete()); m.delete();
    info.sort((a, b) => b.v - a.v);
    const voids = info.filter((c) => c.v < -1e-6); // float32 rounding after scaling can leave ~1e-9 mm³ dust
    const slivers = info.filter((c) => c.v >= 0 && c.v < 1e-3);
    const solids = info.filter((c) => c.v >= 1e-3);
    const tag = r.bodies.length > 1 ? `[${body.name}] ` : '';
    const isLettering = /^(plaque-text|text-)/.test(body.name); // letters are naturally separate shells
    if (solids.length > 1 && !isLettering) out.push(`${tag}${solids.length} separate solid pieces — floating geometry: ${solids.slice(1).map((c) => `vol ${c.v.toFixed(0)} z ${c.z0.toFixed(0)}..${c.z1.toFixed(0)}`).join('; ')}`);
    if (voids.length) out.push(`${tag}${voids.length} internal void(s): ${voids.slice(0, 3).map((c) => `vol ${c.v.toExponential(1)} z ${c.z0.toFixed(0)}..${c.z1.toFixed(0)}`).join('; ')}`);
    if (slivers.length) out.push(`${tag}${slivers.length} zero-volume sliver(s)`);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let bad = 0, n = 0;
  const run = (label, state) => { n++; const p = problems(state); if (p.length) { bad++; console.log('FAIL', label.padEnd(34), p.join(' | ')); } };
  const mk = (patch) => { const s = defaultState(); for (const [k, v] of Object.entries(patch)) Object.assign(s[k], v); return s; };
  for (const p of PRESETS) run('preset ' + p.id, applyPatch(p.patch));
  for (const b of BASES) run('base ' + b.id, mk({ base: { style: b.id } }));
  for (const c of COLUMNS) run('column ' + c.id, mk({ column: { style: c.id } }));
  for (const t of TOPPERS) if (t.id !== 'stl') run('topper ' + t.id, mk({ topper: { style: t.id, text: 'MVP' } }));
  for (const t of TOPPERS) if (t.build) run('topper-no-column ' + t.id, mk({ topper: { style: t.id, text: 'Hi!' }, column: { style: 'none' } }));
  for (const p of PLAQUES) run('plaque ' + p.id, mk({ plaque: { style: p.id } }));
  for (const mode of ['raise', 'engrave']) for (const b of ['round', 'oval', 'bell', 'slope', 'wedge', 'hex']) run(`plaque ${mode} on ${b}`, mk({ base: { style: b }, plaque: { textMode: mode } }));
  const orn = defaultState();
  Object.assign(orn.orn.base, { beadsTop: true, beadsFoot: true, finials: true, feet: true });
  Object.assign(orn.orn.column, { collars: true, leaves: true });
  Object.assign(orn.orn.topper, { wings: true, halo: true });
  Object.assign(orn.orn.plaque, { border: true, doubleBorder: true, studs: true, scrolls: true, laurel: true });
  run('all ornaments (cup)', orn);
  for (const b of ['block', 'round', 'hex', 'oct2', 'podium', 'wedge', 'oval']) { const s = JSON.parse(JSON.stringify(orn)); s.base.style = b; run('all ornaments on ' + b, s); clearCache(); }
  // the v1.1 detail options, each one on every base / column / topper it can touch
  const baseDeco = { beadsTop: true, beadShape: 'diamond', cordTop: true, cordFoot: true, topPanel: true, railTop: true, railFoot: true, studRow: true, finials: true, finialStyle: 'flame' };
  for (const b of BASES) { run('base details on ' + b.id, mk({ base: { style: b.id, edge: 2.2, corner: 8 } })); }
  for (const b of BASES) { const s = defaultState(); s.base.style = b.id; Object.assign(s.orn.base, baseDeco); run('base deco on ' + b.id, s); clearCache(); }
  for (const b of ['block', 'round', 'hex', 'tier3', 'table']) for (const style of ['cone', 'bun']) { const s = defaultState(); s.base.style = b; Object.assign(s.orn.base, { feet: true, footStyle: style, finials: true, finialStyle: 'acorn', beadsFoot: true, beadShape: 'cube' }); run(`feet ${style} on ${b}`, s); }
  for (const c of COLUMNS) { const s = defaultState(); s.column.style = c.id; Object.assign(s.orn.column, { collars: true, leaves: true, bands: 3, knob: true, capital: true, skirt: true }); run('column details on ' + c.id, s); clearCache(); }
  for (const t of TOPPERS) if (t.build) for (const col of ['baluster', 'none']) { const s = defaultState(); s.topper.style = t.id; s.column.style = col; Object.assign(s.orn.topper, { rays: true, pedestal: true }); run(`topper rays+pedestal ${t.id}/${col}`, s); }
  for (const pl of PLAQUES) { const s = defaultState(); s.plaque.style = pl.id; s.plaque.width = 70; s.plaque.height = 24; Object.assign(s.orn.plaque, { border: true, beadBorder: true, studs: true, studStyle: 'star' }); s.plaque.lines[0].italic = 12; s.plaque.lines[0].caps = 'upper'; s.plaque.textAlign = 'left'; run('plaque details on ' + pl.id, s); clearCache(); }
  for (const st of ['ball', 'star', 'diamond', 'square', 'flower']) { const s = defaultState(); Object.assign(s.orn.plaque, { studs: true, studStyle: st, doubleBorder: true, border: true }); run('studs ' + st, s); }
  for (const sh of SHAPES) for (const anchor of ['baseFront', 'baseTop']) { const s = defaultState(); const e = newExtra('shape'); e.shape = sh.id; e.anchor = anchor; e.orient = anchor === 'baseTop' ? 'flat' : 'upright'; e.size = 14; s.extras.push(e); const bare = { ...s, extras: [] }; run(`shape ${sh.id} on ${anchor}`, bare); const r = buildTrophy(s, {}); if (!r.bodies.every((b) => b.watertight)) { bad++; console.log('FAIL shape not watertight', sh.id, anchor); } n++; }
  console.log(`\n${n - bad}/${n} designs are one clean connected solid`);
  process.exit(bad ? 1 : 0);
}

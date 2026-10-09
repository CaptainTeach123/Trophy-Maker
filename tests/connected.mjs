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
    const voids = info.filter((c) => c.v < 0);
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
  console.log(`\n${n - bad}/${n} designs are one clean connected solid`);
  process.exit(bad ? 1 : 0);
}

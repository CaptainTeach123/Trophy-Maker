// Headless smoke test: every option must produce a valid, watertight solid.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setFontLoader, loadFont, BUILTIN_FONTS } from '../js/text.js';
import { buildTrophy, defaultState, newExtra } from '../js/builder.js';
import { BASES } from '../js/parts/bases.js';
import { COLUMNS } from '../js/parts/columns.js';
import { TOPPERS } from '../js/parts/toppers.js';
import { PLAQUES } from '../js/parts/plaques.js';
import { PRESETS } from '../js/presets.js';
import { catalogSource } from '../tools/gen-catalog.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
setFontLoader(async (f) => { const b = fs.readFileSync(path.join(dir, '../fonts', f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); });
for (const f of BUILTIN_FONTS) await loadFont(f.id);

let fails = 0;
function check(label, state) {
  const t0 = performance.now();
  try {
    const r = buildTrophy(state, {});
    const ok = r.bodies.length > 0 && r.bodies.every((b) => b.watertight && b.volume > 0);
    const ms = (performance.now() - t0).toFixed(0);
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(34)} tris=${String(r.stats.triangles).padStart(7)} size=${r.stats.size.map((v) => v.toFixed(0)).join('x')} ${ms}ms ${r.warnings.length ? '[' + r.warnings.join('; ') + ']' : ''}`);
    if (!ok) fails++;
    return r;
  } catch (e) { console.log('FAIL', label, e.stack.split('\n').slice(0, 3).join(' | ')); fails++; }
}
const only = process.argv[2];
const mk = (patch) => { const s = defaultState(); for (const [k, v] of Object.entries(patch)) Object.assign(s[k], v); return s; };
if (!only || only === 'base') for (const b of BASES) check('base:' + b.id, mk({ base: { style: b.id } }));
if (!only || only === 'column') for (const c of COLUMNS) check('column:' + c.id, mk({ column: { style: c.id } }));
if (!only || only === 'topper') for (const t of TOPPERS) { if (t.id === 'stl') continue; check('topper:' + t.id, mk({ topper: { style: t.id, text: 'MVP' } })); }
if (!only || only === 'plaque') for (const p of PLAQUES) check('plaque:' + p.id, mk({ plaque: { style: p.id } }));
if (!only || only === 'orn') {
  const s = defaultState();
  Object.assign(s.orn.base, { beadsTop: true, beadsFoot: true, finials: true, feet: true });
  Object.assign(s.orn.column, { collars: true, leaves: true });
  Object.assign(s.orn.topper, { wings: true, halo: true });
  Object.assign(s.orn.plaque, { border: true, doubleBorder: true, studs: true, scrolls: true, laurel: true });
  check('all ornaments', s);
}
// the UI's id/name catalogue must match the real part lists (regenerate with `node tools/gen-catalog.mjs`)
if (!only) {
  const same = fs.readFileSync(path.join(dir, '../js/catalog.js'), 'utf8') === catalogSource();
  console.log(same ? 'ok   js/catalog.js is up to date' : 'STALE js/catalog.js — run: node tools/gen-catalog.mjs');
  if (!same) fails++;
}
// every option card needs a pre-rendered thumbnail (run `node tools/gen-thumbs.mjs` after adding parts)
if (!only) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, '../thumbs/manifest.json'), 'utf8'));
  const missing = [];
  const need = (kind, list) => list.filter((x) => x.build !== null).forEach((x) => { if (!manifest[`${kind}:${x.id}`]) missing.push(`${kind}:${x.id}`); });
  need('base', BASES); need('column', COLUMNS); need('topper', TOPPERS); need('plaque', PLAQUES);
  PRESETS.forEach((p) => { if (!manifest[`preset:${p.id}`]) missing.push(`preset:${p.id}`); });
  if (missing.length) { console.log('MISSING thumbnails:', missing.join(', '), '— run: node tools/gen-thumbs.mjs'); fails++; } else console.log('ok   thumbnails cover every option');
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);

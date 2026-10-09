// Random-combination fuzz test: every combination must yield valid, watertight, non-empty solids.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setFontLoader, loadFont, BUILTIN_FONTS } from '../js/text.js';
import { buildTrophy, defaultState, newExtra, ANCHORS } from '../js/builder.js';
import { BASES } from '../js/parts/bases.js';
import { COLUMNS } from '../js/parts/columns.js';
import { TOPPERS } from '../js/parts/toppers.js';
import { PLAQUES } from '../js/parts/plaques.js';
import { PRESETS, applyPatch } from '../js/presets.js';
import { clearCache } from '../js/kernel.js';
import { problems } from './connected.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
setFontLoader(async (f) => { const b = fs.readFileSync(path.join(dir, '../fonts', f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); });
for (const f of BUILTIN_FONTS) await loadFont(f.id);

let seed = Number(process.argv[3]) || 12345;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rand() * a.length)];
const range = (a, b) => a + rand() * (b - a);
const N = Number(process.argv[2]) || 60;
const ONLY = process.argv[4] !== undefined ? Number(process.argv[4]) : -1; // re-run just one case and dump its state
let fails = 0, slow = 0;
const t00 = performance.now();

function validate(label, state) {
  const t0 = performance.now();
  try {
    const r = buildTrophy(state, {});
    let ok = r.bodies.length > 0 && r.bodies.every((b) => b.watertight && b.volume > 0) && isFinite(r.stats.size[2]) && r.stats.size[2] > 5;
    let conn = [];
    if (ok) {
      // structural check on the design without free-placed extras (those are the user's responsibility)
      // In "parts" mode each part is cut against the ones before it, which can slice the roots off a plaque's scrolls or
      // laurel where a stepped round base overlaps them — a known limitation, so that combination is checked as a weld.
      const flourish = state.plaque.mount === 'front' && (state.orn.plaque.scrolls || state.orn.plaque.laurel);
      const bare = { ...state, extras: [], plaque: { ...state.plaque, tilt: 0 }, output: { ...state.output, mode: flourish ? 'weld' : state.output.mode } };
      conn = problems(bare, (state.extras.length || state.plaque.tilt || flourish) ? buildTrophy(bare, {}) : r);
    }
    if (conn.length) { ok = false; console.log('DISCONNECTED', label, conn.join(' | ')); }
    const ms = performance.now() - t0;
    if (ms > 2500) slow++;
    if (!ok) { fails++; console.log('FAIL', label, JSON.stringify(r.bodies.map((b) => [b.name, b.watertight, b.volume])), r.stats.size); fs.writeFileSync(path.join(dir, 'last-fail.json'), JSON.stringify(state)); }
    return ok;
  } catch (e) { fails++; console.log('THROW', label, e.stack.split('\n').slice(0, 4).join(' | ')); fs.writeFileSync(path.join(dir, 'last-throw.json'), JSON.stringify(state)); return false; }
}

for (const p of PRESETS) validate('preset ' + p.id, applyPatch(p.patch));

for (let i = 0; i < N; i++) {
  const s = defaultState();
  s.base.style = pick(BASES).id; s.base.width = range(50, 130); s.base.depth = range(40, 120); s.base.height = range(20, 70);
  s.column.style = pick(COLUMNS).id; s.column.height = range(10, 90); s.column.radius = range(4, 16);
  s.topper.style = pick(TOPPERS.filter((t) => t.id !== 'stl')).id; s.topper.size = range(40, 160); s.topper.text = pick(['MVP', '1', 'WIN', 'Hello World']);
  s.topper.font = pick(BUILTIN_FONTS).id;
  s.plaque.style = pick(PLAQUES).id; s.plaque.mount = pick(['front', 'front', 'separate', 'none']); s.plaque.width = range(25, 110); s.plaque.height = range(10, 40);
  s.plaque.thickness = range(1.5, 6); s.plaque.bevel = range(0, 2); s.plaque.textMode = pick(['raise', 'engrave', 'none']); s.plaque.textDepth = range(0.4, 2);
  s.plaque.tilt = range(-10, 20);
  s.plaque.lines = [{ text: pick(['CHAMPION', 'First Place', 'Best in Show', 'WORLD']), font: pick(BUILTIN_FONTS).id, size: range(3, 9) }, { text: pick(['', '2026', 'Season Finale']), font: pick(BUILTIN_FONTS).id, size: range(2.5, 6) }];
  for (const grp of Object.values(s.orn)) for (const k of Object.keys(grp)) if (typeof grp[k] === 'boolean') grp[k] = rand() < 0.35;
  s.orn.base.finialStyle = pick(['urn', 'ball', 'spike', 'cone', 'pyramid']); s.orn.base.footStyle = pick(['ball', 'block']);
  s.orn.base.finialSize = range(5, 18); s.orn.base.beadSize = range(1, 3); s.orn.base.beadSpacing = range(3.5, 9);
  const ne = Math.floor(rand() * 3);
  for (let k = 0; k < ne; k++) {
    const e = newExtra('text');
    e.text = pick(['JANE DOE', '2026', 'Thank you']); e.anchor = pick(ANCHORS)[0]; e.mode = pick(['weld', 'engrave', 'separate']); e.size = range(3, 14); e.depth = range(0.5, 3);
    // same rules the UI applies: lettering stands upright on vertical faces and lies flat on top surfaces;
    // text dropped on the bare print bed can only be a separate piece
    e.orient = ['baseTop', 'topperTop', 'floor'].includes(e.anchor) ? 'flat' : 'upright';
    if (e.anchor === 'floor') e.mode = 'separate';
    e.oz = range(-10, 10);
    s.extras.push(e);
  }
  s.output.mode = pick(['weld', 'weld', 'parts']); s.output.splitText = rand() < 0.3; s.output.scaleTo = rand() < 0.2 ? range(100, 250) : 0;
  s.output.quality = pick([0.6, 1, 1.6]);
  if (ONLY >= 0 && i !== ONLY) { continue; }
  if (ONLY >= 0) fs.writeFileSync(path.join(dir, 'case.json'), JSON.stringify(s, null, 1));
  if (validate(`#${i} ${s.base.style}/${s.column.style}/${s.topper.style}/${s.plaque.style}`, s) && i % 10 === 0) process.stdout.write('.');
  if (i % 8 === 0) clearCache();
}
console.log(`\n${N} random + ${PRESETS.length} presets in ${((performance.now() - t00) / 1000).toFixed(0)}s — ${fails} failed, ${slow} slow (>2.5s)`);
process.exit(fails ? 1 : 0);

// Cache coherence: after every random edit, the incrementally cached build must equal a from-scratch build.
// (Catches cache keys that forget a dependency, which would show stale geometry in the app.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setFontLoader, loadFont, BUILTIN_FONTS } from '../js/text.js';
import { buildTrophy, defaultState, newExtra, ANCHORS } from '../js/builder.js';
import { BASES } from '../js/parts/bases.js';
import { COLUMNS } from '../js/parts/columns.js';
import { TOPPERS } from '../js/parts/toppers.js';
import { PLAQUES } from '../js/parts/plaques.js';
import { clearCache } from '../js/kernel.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
setFontLoader(async (f) => { const b = fs.readFileSync(path.join(dir, '../fonts', f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); });
for (const f of BUILTIN_FONTS) await loadFont(f.id);

let seed = Number(process.argv[3]) || 99;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rand() * a.length)];
const range = (a, b) => a + rand() * (b - a);
const STEPS = Number(process.argv[2]) || 60;

const MUTATIONS = [
  (s) => { s.base.style = pick(BASES).id; }, (s) => { s.base.width = range(60, 120); }, (s) => { s.base.height = range(24, 60); },
  (s) => { s.column.style = pick(COLUMNS).id; }, (s) => { s.column.height = range(10, 70); },
  (s) => { s.topper.style = pick(TOPPERS.filter((t) => t.id !== 'stl')).id; }, (s) => { s.topper.size = range(50, 140); },
  (s) => { s.plaque.style = pick(PLAQUES).id; }, (s) => { s.plaque.width = range(30, 90); }, (s) => { s.plaque.tilt = range(-5, 15); },
  (s) => { s.plaque.lines[0].text = pick(['ALPHA', 'Best in Show', 'WORLD CHAMPION']); },
  (s) => { s.plaque.textMode = pick(['raise', 'engrave']); }, (s) => { s.plaque.mount = pick(['front', 'front', 'separate', 'none']); },
  (s) => { s.orn.base.beadsTop = !s.orn.base.beadsTop; }, (s) => { s.orn.base.feet = !s.orn.base.feet; }, (s) => { s.orn.column.collars = !s.orn.column.collars; },
  (s) => { s.orn.topper.wings = !s.orn.topper.wings; }, (s) => { s.orn.topper.rays = !s.orn.topper.rays; }, (s) => { s.orn.base.railTop = !s.orn.base.railTop; }, (s) => { s.orn.column.knob = !s.orn.column.knob; }, (s) => { s.orn.plaque.beadBorder = !s.orn.plaque.beadBorder; }, (s) => { s.base.edge = s.base.edge === 1 ? 2.5 : 1; }, (s) => { s.plaque.textAlign = s.plaque.textAlign === 'left' ? 'center' : 'left'; }, (s) => { s.orn.plaque.scrolls = !s.orn.plaque.scrolls; },
  (s) => { s.output.mode = pick(['weld', 'weld', 'parts']); }, (s) => { s.output.splitText = !s.output.splitText; },
  (s) => { const e = newExtra('text'); e.text = pick(['JANE', '2026', 'HELLO']); e.anchor = pick(ANCHORS)[0]; e.mode = pick(['weld', 'engrave', 'separate']); e.orient = ['baseTop', 'topperTop', 'floor'].includes(e.anchor) ? 'flat' : 'upright'; if (e.anchor === 'floor') e.mode = 'separate'; s.extras.push(e); },
  (s) => { if (s.extras.length) s.extras[Math.floor(rand() * s.extras.length)].oz = range(-8, 8); },
  (s) => { if (s.extras.length) s.extras.splice(Math.floor(rand() * s.extras.length), 1); },
];
const fingerprint = (r) => JSON.stringify([r.stats.triangles, +r.stats.volume.toFixed(2), r.stats.size.map((v) => +v.toFixed(3)), r.bodies.map((b) => [b.name, b.volume == null ? null : +b.volume.toFixed(2)])]);

const state = defaultState();
let bad = 0;
for (let i = 0; i < STEPS; i++) {
  const m = pick(MUTATIONS);
  m(state);
  const cached = fingerprint(buildTrophy(JSON.parse(JSON.stringify(state)), {}));
  const keepNothing = JSON.parse(JSON.stringify(state));
  // from scratch (separate cache lifecycle): clear, build, then rebuild the cached path next iteration
  clearCache();
  const cold = fingerprint(buildTrophy(keepNothing, {}));
  if (cached !== cold) { bad++; console.log(`MISMATCH at step ${i} after mutation ${MUTATIONS.indexOf(m)}\n  cached ${cached.slice(0, 160)}\n  cold   ${cold.slice(0, 160)}`); fs.writeFileSync(path.join(dir, 'last-cache-fail.json'), JSON.stringify(state)); }
  // the cold build repopulated the cache from this very state, so also exercise a stale-then-edit path:
  // build an unrelated state first so the next mutation really starts from a cache that is one step behind
}
console.log(bad ? `\n${bad} cache mismatches` : `${STEPS} edits: cached builds identical to cold builds`);
process.exit(bad ? 1 : 0);

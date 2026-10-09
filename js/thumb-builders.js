// Builds the isolated meshes behind the option-card thumbnails (runs in the worker; pre-rendered images in /thumbs
// normally make this unnecessary — it is the fallback for new parts and the source for tools/gen-thumbs.mjs).
import { scoped, toMeshData, setCacheEnabled } from './kernel.js';
import { getBase } from './parts/bases.js';
import { getColumn } from './parts/columns.js';
import { getTopper } from './parts/toppers.js';
import { buildPlaque } from './parts/plaques.js';
import { buildTrophy } from './builder.js';
import { applyPatch, PRESETS } from './presets.js';
import { loadFont } from './text.js';

const body = (m) => { const d = toMeshData(m); return { positions: d.positions, indices: d.indices }; };

export const THUMB_BUILDERS = {
  base: (id) => {
    const d = getBase(id);
    return { bodies: [body(d.build({ width: 90, depth: d.id === 'oval' ? 58 : d.rect ? 78 : 90, height: 38 }).solid)] };
  },
  column: (id) => ({ bodies: [body(getColumn(id).build({ height: 56, radius: 10 }).solid)] }),
  topper: (id) => {
    const d = getTopper(id);
    return d.build ? { bodies: [body(d.build(100, { text: '1', font: 'bebas' }))] } : null;
  },
  plaque: (id) => {
    const p = buildPlaque({
      style: id, width: 64, height: 26, thickness: 3, bevel: 0.8, textMode: 'raise', textDepth: 1, orn: {},
      lines: [{ text: 'TROPHY', font: 'cinzel', size: 6 }],
    }, { embed: 0 });
    return { bodies: [body(p.body), ...(p.text ? [body(p.text)] : [])], opts: { dir: [-0.12, -1, 0.1], fill: 1.0 } };
  },
  preset: (id) => {
    const state = applyPatch(PRESETS.find((p) => p.id === id).patch);
    state.output.quality = 0.55;
    setCacheEnabled(false);
    try {
      const r = buildTrophy(state, {});
      return { bodies: r.bodies.map((b) => ({ positions: b.positions, indices: b.indices })), opts: { dir: [-0.45, -1, 0.32], fill: 1.0 } };
    } finally { setCacheEnabled(true); }
  },
};

export async function buildThumb(kind, id) {
  if (kind === 'preset') {
    const st = applyPatch(PRESETS.find((p) => p.id === id).patch);
    for (const f of new Set(['cinzel', 'bebas', st.topper.font, ...st.plaque.lines.map((l) => l.font)])) await loadFont(f);
  } else if (kind === 'plaque') await loadFont('cinzel');
  return scoped(() => THUMB_BUILDERS[kind](id));
}

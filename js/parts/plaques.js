// Plaque outlines (2D, centred on the origin, x = width, y = height) and the plaque builder.
import { Manifold, polys, union, box, ball, cyl, rad, ellipsoid, stroke2d, quality } from '../kernel.js';
import { textCross } from '../text.js';
import { shieldPoly } from './toppers.js';
import { plaqueOrnaments } from './ornaments.js';

const arc = (cx, cy, r, a0, a1, n = 12) => Array.from({ length: n + 1 }, (_, i) => {
  const a = rad(a0 + ((a1 - a0) * i) / n);
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
});

function roundedRect(w, h, r, n = 8) {
  r = Math.min(r, w / 2 - 0.01, h / 2 - 0.01);
  const x = w / 2, y = h / 2;
  return [...arc(x - r, y - r, r, 0, 90, n), ...arc(-x + r, y - r, r, 90, 180, n), ...arc(-x + r, -y + r, r, 180, 270, n), ...arc(x - r, -y + r, r, 270, 360, n)];
}

/** fit = fraction of the plate's width / height that text may safely use */
export const PLAQUES = [
  { id: 'rect', name: 'Rectangle', fit: [0.94, 0.8], outline: (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] },
  { id: 'rounded', name: 'Rounded', fit: [0.9, 0.78], outline: (w, h) => roundedRect(w, h, Math.min(w, h) * 0.22) },
  { id: 'chamfer', name: 'Cut Corners', fit: [0.88, 0.78], outline: (w, h) => { const c = Math.min(w, h) * 0.24; return [[-w / 2 + c, -h / 2], [w / 2 - c, -h / 2], [w / 2, -h / 2 + c], [w / 2, h / 2 - c], [w / 2 - c, h / 2], [-w / 2 + c, h / 2], [-w / 2, h / 2 - c], [-w / 2, -h / 2 + c]]; } },
  { id: 'stadium', name: 'Pill', fit: [0.82, 0.74], outline: (w, h) => roundedRect(w, h, h / 2, 14) },
  {
    id: 'arch', name: 'Arched Top', fit: [0.86, 0.68],
    outline: (w, h) => {
      const ry = Math.min(w * 0.5, h * 0.45);
      const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2 - ry]];
      for (let i = 1; i < 28; i++) { const a = (i / 28) * Math.PI; pts.push([Math.cos(a) * w / 2, h / 2 - ry + Math.sin(a) * ry]); }
      pts.push([-w / 2, h / 2 - ry]);
      return pts;
    },
  },
  {
    id: 'oval', name: 'Oval', fit: [0.72, 0.62],
    outline: (w, h) => Array.from({ length: 72 }, (_, i) => { const a = (i / 72) * Math.PI * 2; return [Math.cos(a) * w / 2, Math.sin(a) * h / 2]; }),
  },
  { id: 'shield', name: 'Shield', fit: [0.74, 0.58], outline: (w, h) => shieldPoly(w, h, 16) },
  {
    id: 'banner', name: 'Ribbon Banner', fit: [0.78, 0.74],
    outline: (w, h) => { const n = Math.min(w * 0.1, h * 0.5); return [[-w / 2, h / 2], [w / 2, h / 2], [w / 2 - n, 0], [w / 2, -h / 2], [-w / 2, -h / 2], [-w / 2 + n, 0]]; },
  },
  {
    id: 'hex', name: 'Long Hexagon', fit: [0.78, 0.78],
    outline: (w, h) => { const c = Math.min(h * 0.5, w * 0.2); return [[-w / 2, 0], [-w / 2 + c, h / 2], [w / 2 - c, h / 2], [w / 2, 0], [w / 2 - c, -h / 2], [-w / 2 + c, -h / 2]]; },
  },
  {
    id: 'cartouche', name: 'Scooped Corners', fit: [0.86, 0.72], cs: true,
    outline: (w, h) => {
      const c = Math.min(w, h) * 0.2;
      let cs = polys([[[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]]);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) cs = cs.subtract(polys([arc(0, 0, c, 0, 360, 24)]).translate([sx * w / 2, sy * h / 2]));
      return cs;
    },
  },
];
export function getPlaque(id) { return PLAQUES.find((p) => p.id === id) || PLAQUES[0]; }

function outlineCS(style, w, h) {
  const def = getPlaque(style);
  const o = def.outline(w, h);
  return def.cs ? o : polys([o]);
}

/**
 * Builds an upright plaque. Local frame: origin = anchor on the base surface, +X right, +Z up,
 * the visible face is at y = -t (toward the viewer), the tang that welds into the base extends to y = +embed.
 * Returns { body, text, w, h, t } (text null when engraved or empty).
 */
export function buildPlaque(pl, o = {}) {
  const w = pl.width, h = pl.height, t = pl.thickness;
  const def = getPlaque(pl.style);
  const outline = outlineCS(pl.style, w, h);
  const bevel = Math.min(pl.bevel || 0, t * 0.6, Math.min(w, h) * 0.2);
  const orn = pl.orn || {};

  // plate: stepped bevel
  let plate;
  if (bevel > 0.05) {
    const lower = Manifold.extrude(outline, t * 0.5, 0, 0, 1);
    const upper = Manifold.extrude(outline.offset(-bevel, 'Miter', 2), t, 0, 0, 1);
    plate = union([lower, upper]);
  } else plate = Manifold.extrude(outline, t, 0, 0, 1);
  const parts = [plate];

  // border frames
  const bw = Math.max(0.8, Math.min(2.2, Math.min(w, h) * 0.07));
  const bh = Math.min(1.4, t * 0.55);
  let innerInset = bevel + 1.2;
  if (orn.border) {
    const out = outline.offset(-(bevel + 1.0), 'Miter', 2), inn = outline.offset(-(bevel + 1.0 + bw), 'Miter', 2);
    parts.push(Manifold.extrude(out.subtract(inn), bh + t - 0.2, 0, 0, 1).translate([0, 0, 0.2]));
    innerInset = bevel + 1.0 + bw + 1.2;
    if (orn.doubleBorder) {
      const o2 = outline.offset(-(bevel + 1.0 + bw + 1.3), 'Miter', 2), i2 = outline.offset(-(bevel + 1.0 + bw + 1.3 + bw * 0.5), 'Miter', 2);
      parts.push(Manifold.extrude(o2.subtract(i2), bh * 0.7 + t - 0.2, 0, 0, 1).translate([0, 0, 0.2]));
      innerInset += 1.3 + bw * 0.5;
    }
  }

  // text
  const lines = (pl.lines || []).filter((l) => l.text && l.text.trim());
  let textSolid = null;
  const depth = Math.max(0.3, Math.min(pl.textDepth, t * 0.75));
  if (lines.length && pl.textMode !== 'none') {
    const usableW = Math.max(4, (w - 2 * innerInset) * def.fit[0]);
    const usableH = Math.max(3, (h - 2 * innerInset) * def.fit[1]);
    const gapK = 0.55;
    const sizes = lines.map((l) => l.size);
    let total = sizes.reduce((a, b) => a + b, 0) + gapK * (sizes.reduce((a, b) => a + b, 0) / sizes.length) * (lines.length - 1);
    const k = Math.min(1, usableH / total);
    total *= k;
    let y = total / 2;
    const meshes = [];
    lines.forEach((l, i) => {
      const sz = l.size * k;
      const cs = textCross(l.font, l.text, sz, { embolden: pl.embolden || 0, spacing: l.spacing || 0, maxWidth: usableW });
      const cy = y - sz / 2;
      y -= sz + gapK * (sizes.reduce((a, b) => a + b, 0) / sizes.length) * k;
      if (!cs) return;
      meshes.push(cs.translate([(l.dx || 0), cy + (l.dy || 0)]));
    });
    if (meshes.length) {
      const all = meshes.length > 1 ? meshes.reduce((a, b) => a.add(b)) : meshes[0];
      if (pl.textMode === 'engrave') {
        const cut = Manifold.extrude(all, depth + 1, 0, 0, 1).translate([0, 0, t - depth]);
        const base = union(parts);
        parts.length = 0;
        parts.push(base.subtract(cut));
      } else {
        textSolid = Manifold.extrude(all, depth + 0.3, 0, 0, 1).translate([0, 0, t - 0.3]);
      }
    }
  }

  // ornaments attached to the plate (built in the flat extrusion frame: z = outward)
  const ornParts = plaqueOrnaments(orn, { w, h, t, outline, def, bevel });
  parts.push(...ornParts);

  // tang welded into the base
  const embed = o.embed ?? 4;
  const tang = Manifold.extrude(outline.offset(-Math.max(1, bevel + 0.5), 'Miter', 2), embed + 0.2, 0, 0, 1).mirror([0, 0, 1]).translate([0, 0, 0.2]);
  parts.push(tang);

  // flat extrusion frame (z outward) -> upright frame (y toward viewer = -y)
  const orient = (m) => m.rotate([90, 0, 0]);
  return { body: orient(union(parts)), text: textSolid ? orient(textSolid) : null, w, h, t };
}

export { outlineCS };

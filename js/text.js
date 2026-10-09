// Font registry + text -> 2D outline conversion (opentype.js)
import * as opentype from '../vendor/opentype/opentype.min.mjs';
import { polys, quality } from './kernel.js';

import { BUILTIN_FONTS } from './fonts-meta.js';
export { BUILTIN_FONTS };

const fontCache = new Map(); // id -> opentype Font
let fontLoader = async (file) => {
  const res = await fetch(new URL(`../fonts/${file}`, import.meta.url));
  if (!res.ok) throw new Error('font fetch failed: ' + file);
  return res.arrayBuffer();
};
/** Tests (node) can swap the loader. */
export function setFontLoader(fn) { fontLoader = fn; }

export async function loadFont(id) {
  if (fontCache.has(id)) return fontCache.get(id);
  const meta = BUILTIN_FONTS.find((f) => f.id === id);
  if (!meta) throw new Error('unknown font ' + id);
  const buf = await fontLoader(meta.file);
  const font = opentype.parse(buf);
  fontCache.set(id, font);
  return font;
}

/** Parse an uploaded font and make it available under `id` (the UI chose the id). */
export function registerCustomFont(id, arrayBuffer) {
  fontCache.set(id, opentype.parse(arrayBuffer));
  return id;
}

export function getFont(id) {
  return fontCache.get(id) || fontCache.get('cinzel');
}

function capHeightUnits(font) {
  const os2 = font.tables && font.tables.os2;
  if (os2 && os2.sCapHeight > 0) return os2.sCapHeight;
  const g = font.charToGlyph('H');
  if (g && g.getBoundingBox) {
    const b = g.getBoundingBox();
    if (b.y2 - b.y1 > 0) return b.y2 - b.y1;
  }
  return font.unitsPerEm * 0.7;
}

const polyCache = new Map();

/**
 * Flatten text to polygons (y up, baseline at y=0, starting at x=0). `size` is the capital letter height in mm.
 * Returns plain arrays so results can be cached freely (WASM objects must not be cached).
 */
export function textPolygons(fontId, str, size, spacing = 0) {
  const font = getFont(fontId);
  const key = [fontId, str, size.toFixed(3), spacing.toFixed(3), quality.factor].join('|');
  if (polyCache.has(key)) return polyCache.get(key);
  const fontSize = (size / capHeightUnits(font)) * font.unitsPerEm;
  // own simple layout (cmap + kerning): avoids opentype's GSUB shaping, which throws on some fonts
  const k = fontSize / font.unitsPerEm;
  const glyphs = Array.from(str).map((ch) => font.charToGlyph(ch));
  const commands = [];
  let penX = 0;
  glyphs.forEach((g, i) => {
    commands.push(...g.getPath(penX, 0, fontSize).commands);
    penX += (g.advanceWidth || 0) * k + spacing;
    if (glyphs[i + 1]) { try { penX += (font.getKerningValue(g, glyphs[i + 1]) || 0) * k; } catch { /* no kerning */ } }
  });
  const path = { commands };
  // adaptive curve flattening: chord error stays below ~0.03 mm whatever the letter size
  const tol = 0.04 / quality.factor;
  const stepsFor = (ctrlLen) => Math.max(2, Math.min(12, Math.ceil(0.55 * Math.sqrt(ctrlLen / 1.57 / tol))));
  const contours = [];
  let cur = null, cx = 0, cy = 0;
  const pt = (x, y) => [x, -y];
  for (const c of path.commands) {
    switch (c.type) {
      case 'M':
        if (cur && cur.length > 2) contours.push(cur);
        cur = [pt(c.x, c.y)]; cx = c.x; cy = c.y; break;
      case 'L':
        cur.push(pt(c.x, c.y)); cx = c.x; cy = c.y; break;
      case 'Q': {
        const steps = stepsFor(Math.hypot(c.x1 - cx, c.y1 - cy) + Math.hypot(c.x - c.x1, c.y - c.y1));
        for (let i = 1; i <= steps; i++) {
          const t = i / steps, u = 1 - t;
          cur.push(pt(u * u * cx + 2 * u * t * c.x1 + t * t * c.x, u * u * cy + 2 * u * t * c.y1 + t * t * c.y));
        }
        cx = c.x; cy = c.y; break;
      }
      case 'C': {
        const steps = stepsFor(Math.hypot(c.x1 - cx, c.y1 - cy) + Math.hypot(c.x2 - c.x1, c.y2 - c.y1) + Math.hypot(c.x - c.x2, c.y - c.y2));
        for (let i = 1; i <= steps; i++) {
          const t = i / steps, u = 1 - t;
          cur.push(pt(
            u * u * u * cx + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
            u * u * u * cy + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y));
        }
        cx = c.x; cy = c.y; break;
      }
      case 'Z':
        if (cur && cur.length > 2) contours.push(cur);
        cur = null; break;
    }
  }
  if (cur && cur.length > 2) contours.push(cur);
  // drop consecutive duplicates
  const clean = contours.map((c) => c.filter((p, i) => {
    const q = c[(i + c.length - 1) % c.length];
    return Math.abs(p[0] - q[0]) > 1e-6 || Math.abs(p[1] - q[1]) > 1e-6;
  })).filter((c) => c.length > 2);
  if (polyCache.size > 400) polyCache.clear();
  polyCache.set(key, clean);
  return clean;
}

/**
 * Text as a 2D cross-section. Anchored: x centered/left/right per `align`, y centered on the middle of the capital letters.
 * `embolden` (mm) grows the outlines — handy for thin script fonts.
 */
export function textCross(fontId, str, size, { align = 'center', spacing = 0, embolden = 0, maxWidth = 0 } = {}) {
  if (!str || !str.trim()) return null;
  let contours = textPolygons(fontId, str, size, spacing);
  if (!contours.length) return null;
  let cs = polys(contours);
  if (embolden > 0.001) cs = cs.offset(embolden, 'Round', 2, 6);
  let b = cs.bounds();
  const w = b.max[0] - b.min[0];
  let k = 1;
  if (maxWidth > 0 && w > maxWidth) {
    k = maxWidth / w;
    cs = cs.scale([k, k]);
    b = cs.bounds();
  }
  const dx = align === 'left' ? -b.min[0] : align === 'right' ? -b.max[0] : -(b.min[0] + b.max[0]) / 2;
  return cs.translate([dx, -(size * k) / 2]);
}

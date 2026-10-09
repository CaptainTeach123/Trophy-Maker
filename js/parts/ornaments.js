// Ornamental details that get welded onto the main parts.
import {
  Manifold, polys, union, box, ball, cyl, lathe, polyLathe, ellipsoid, tube, stroke2d, segs, rad, polarArray, bevelSolid,
  starPoly, bounds,
} from '../kernel.js';
import { wingPair } from './toppers.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ------------------------------------------------------------------ polygon helpers */
function ccw(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a >= 0 ? poly : poly.slice().reverse();
}
/** Evenly spaced points along a polygon boundary, always including the corners. Returns [{p, n}] n = inward normal. */
export function edgePoints(poly0, spacing, inset = 0) {
  const poly = ccw(poly0);
  const n = poly.length;
  const dirs = poly.map((p, i) => {
    const q = poly[(i + 1) % n];
    const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l, l];
  });
  const isCorner = poly.map((_, i) => {
    const a = dirs[(i + n - 1) % n], b = dirs[i];
    return a[0] * b[0] + a[1] * b[1] < Math.cos(rad(25));
  });
  const corners = isCorner.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
  const out = [];
  const normalAt = (i) => {
    const a = dirs[(i + n - 1) % n], b = dirs[i];
    let nx = -(a[1] + b[1]), ny = a[0] + b[0];
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    const cosHalf = clamp(nx * -a[1] + ny * a[0], 0.55, 1);
    return [nx / cosHalf, ny / cosHalf];
  };
  const walk = (startIdx, endIdx) => {
    // chain from startIdx to endIdx (cyclic; start === end walks the whole loop)
    const pts = [poly[startIdx]];
    let i = startIdx;
    do { i = (i + 1) % n; pts.push(poly[i]); } while (i !== endIdx);
    let L = 0;
    const cum = [0];
    for (let k = 1; k < pts.length; k++) { L += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); cum.push(L); }
    const cnt = Math.max(1, Math.round(L / spacing));
    for (let s = 0; s < cnt; s++) {
      const d = (s * L) / cnt;
      let k = 1;
      while (k < cum.length - 1 && cum[k] < d) k++;
      const f = (d - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1);
      const p = [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f];
      const idx = (startIdx + k - 1) % n;
      const nn = s === 0 ? normalAt(startIdx) : [-dirs[idx][1], dirs[idx][0]];
      out.push({ p: [p[0] + nn[0] * inset, p[1] + nn[1] * inset], n: nn });
    }
  };
  if (corners.length < 3) {
    // smooth outline: one closed chain
    walk(0, 0);
  } else {
    for (let c = 0; c < corners.length; c++) walk(corners[c], corners[(c + 1) % corners.length]);
  }
  return out;
}
export function cornerPoints(poly0, inset) {
  const poly = ccw(poly0);
  const pts = edgePoints(poly, 1e9, inset); // spacing huge => only corners (or one point if the outline is smooth)
  if (pts.length >= 3) return pts.map((q) => q.p);
  // smooth outline (circle, oval, rounded square): ray-cast the four diagonals against the outline
  const out = [];
  for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const d = [sx * Math.SQRT1_2, sy * Math.SQRT1_2];
    let best = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const ex = q[0] - p[0], ey = q[1] - p[1];
      const den = d[0] * ey - d[1] * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = (p[0] * ey - p[1] * ex) / den, u = (p[0] * d[1] - p[1] * d[0]) / den;
      if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, t);
    }
    if (isFinite(best)) out.push([d[0] * (best - inset), d[1] * (best - inset)]);
  }
  return out;
}

/* ------------------------------------------------------------------ finials */
export function finial(style, f) {
  const base = cyl(f * 0.12, f * 0.3, f * 0.3, [0, 0, 0], 20);
  switch (style) {
    case 'ball': return union([base, cyl(f * 0.4, f * 0.2, f * 0.2, [0, 0, 0], 16), ball(f * 0.3, [0, 0, f * 0.62], 24)]);
    case 'cone': return lathe([[f * 0.3, 0], [f * 0.3, f * 0.1], [f * 0.0, f]], 24);
    case 'pyramid': return polyLathe([[f * 0.3, 0], [f * 0.3, f * 0.1], [f * 0.0, f]], 4, { rot: 45 });
    case 'spike': return union([base, lathe([[f * 0.16, f * 0.05], [f * 0.2, f * 0.3], [f * 0.0, f]], 16)]);
    case 'urn':
    default:
      return union([
        lathe([[f * 0.3, 0], [f * 0.3, f * 0.08], [f * 0.18, f * 0.16], [f * 0.16, f * 0.28], [f * 0.3, f * 0.42], [f * 0.34, f * 0.55], [f * 0.2, f * 0.68], [f * 0.12, f * 0.74], [f * 0.18, f * 0.78], [f * 0.0, f * 0.82]], 24),
        ball(f * 0.09, [0, 0, f * 0.9], 12),
      ]);
  }
}

/* ------------------------------------------------------------------ base ornaments */
/** Returns the base info with decorations welded on (and possibly lifted on feet). */
export function decorateBase(base, o) {
  if (!o) return base;
  const parts = [base.solid];
  let lift = 0;
  const topZ = base.top[2];

  if (o.beadsTop) {
    const r = o.beadSize;
    for (const { p } of edgePoints(base.topPoly, o.beadSpacing, r * 1.0)) parts.push(ball(r, [p[0], p[1], topZ + r * 0.25], r > 2.5 ? 10 : 8));
  }
  if (o.beadsFoot) {
    const r = o.beadSize;
    for (const { p } of edgePoints(base.footPoly, o.beadSpacing, r * 0.15)) parts.push(ball(r, [p[0], p[1], r * 0.8], r > 2.5 ? 10 : 8));
  }
  if (o.finials) {
    const f = o.finialSize;
    for (const p of cornerPoints(base.topPoly, f * 0.45)) parts.push(finial(o.finialStyle, f).translate([p[0], p[1], topZ - 0.4]));
  }
  let solid = union(parts);
  let info = { ...base };
  if (o.feet) {
    const fh = o.footHeight;
    const r = fh * 1.05;
    const feet = [];
    for (const p of cornerPoints(base.footPoly, r * 1.15)) {
      const f = o.footStyle === 'block'
        ? box(r * 1.8, r * 1.8, fh + 1.5, [p[0], p[1], 0])
        : ball(r, [p[0], p[1], fh * 0.7], 20).intersect(box(r * 4, r * 4, r * 4, [p[0], p[1], 0]));
      feet.push(f);
    }
    solid = union([solid.translate([0, 0, fh]), ...feet]);
    lift = fh;
    info = { ...info, top: [info.top[0], info.top[1], info.top[2] + fh], mount: { ...info.mount, z: info.mount.z + fh } };
  }
  info.solid = solid;
  info.lift = lift;
  return info;
}

/* ------------------------------------------------------------------ column ornaments */
export function decorateColumn(col, o) {
  if (!o || !col) return col;
  const parts = [col.solid];
  const rAt = col.radiusAt || (() => col.topR * 0.9);
  const H = col.height;
  const minR = (z0, z1) => { let m = Infinity; for (let i = 0; i <= 8; i++) m = Math.min(m, rAt(z0 + ((z1 - z0) * i) / 8)); return m; };
  const maxR = (z0, z1) => { let m = 0; for (let i = 0; i <= 8; i++) m = Math.max(m, rAt(z0 + ((z1 - z0) * i) / 8)); return m; };
  if (o.collars) {
    const h = Math.min(7, H * 0.12);
    const ring = (z) => {
      const rin = minR(z, z + h) * 0.8, rout = Math.max(maxR(z, z + h) * 1.18, minR(z, z + h) * 1.45);
      return lathe([[rin, z], [rout * 0.93, z + h * 0.25], [rout, z + h * 0.5], [rout * 0.93, z + h * 0.75], [rin, z + h]], segs(rout, 32), 0, false);
    };
    parts.push(ring(H * 0.04), ring(H - h - H * 0.04));
  }
  if (o.leaves) {
    const len = Math.min(H * 0.4, rAt(0.2 * H) * 3.2);
    const r = Math.min(rAt(len * 0.15), rAt(len * 0.5)) * 0.9; // inside the shaft where the leaves start
    const n = Math.max(8, Math.round((r * 2 * Math.PI) / 5));
    const leaf = (L, tilt, w) => ellipsoid(w / 2, L * 0.07, L / 2, [0, 0, L / 2], 14).rotate([0, tilt, 0]);
    for (const [L, tilt, off] of [[len, 32, 0], [len * 0.72, 12, 0.5]]) {
      parts.push(...polarArray(n, (i, a) => leaf(L, tilt, (2 * Math.PI * r) / n * 1.05).translate([r * 0.92, 0, 0]).rotate([0, 0, a + off * (360 / n)])));
    }
  }
  return { ...col, solid: union(parts) };
}

/* ------------------------------------------------------------------ topper ornaments */
export function decorateTopper(solid, size, o) {
  if (!o) return solid;
  const parts = [solid];
  const b = bounds(solid);
  const zc = b.min[2] + (b.max[2] - b.min[2]) * (o.wingHeight ?? 0.5);
  const dy = Math.max(size * 0.1, (b.size[1] / 2) + size * 0.05);
  const z0 = size * 0.016; // foot level
  let tied = false;
  const tieToFoot = (r) => { if (!tied) { tied = true; parts.push(tube([[0, 0, z0], [0, dy, z0]], r, 8)); } };
  if (o.wings) {
    const span = size * (o.wingSize ?? 0.4);
    const wings = wingPair(span, 0, 1.2);
    parts.push(wings.translate([0, dy, zc]));
    // the wings ride on a slim rear spine that is tied back to the topper's foot
    parts.push(tube([[0, dy, zc], [0, dy, z0]], size * 0.014, 8));
    tieToFoot(size * 0.016);
  }
  if (o.halo) {
    const Rr = Math.max(b.size[0], b.size[2] * 0.55) * 0.5 + size * (o.haloSize ?? 0.3);
    const tr = size * 0.013; // the arch stands on a low cross-bar that is tied to the topper's foot
    const pts = [];
    for (let i = 0; i <= 28; i++) { const a = rad(i * (180 / 28)); pts.push([Math.cos(a) * Rr, dy, Math.sin(a) * Rr + z0]); }
    parts.push(tube(pts, tr, 8));
    parts.push(tube([[-Rr, dy, z0], [Rr, dy, z0]], tr, 8)); // cross-bar
    tieToFoot(tr * 1.2);
    const ns = o.haloStars || 7;
    for (let i = 0; i < ns; i++) {
      const a = rad(12 + (156 * i) / (ns - 1));
      const R = size * 0.045;
      const star = bevelSolid(polys([starPoly(5, R, R * 0.45)]), R * 0.55, 0.35, 0.2).rotate([90, 0, 0]);
      parts.push(star.translate([Math.cos(a) * Rr, dy, Math.sin(a) * Rr + z0]));
    }
  }
  return union(parts);
}

/* ------------------------------------------------------------------ plaque ornaments (flat frame: z outward) */
/** x of the outline's right-hand edge at height y (so ornaments attach to the real edge, not the bounding box) */
function edgeX(contours, y, fallback) {
  let best = -Infinity;
  for (const c of contours) for (let i = 0; i < c.length; i++) {
    const [x0, y0] = c[i], [x1, y1] = c[(i + 1) % c.length];
    if ((y0 <= y && y < y1) || (y1 <= y && y < y0)) best = Math.max(best, x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
  }
  return isFinite(best) ? best : fallback;
}
function scroll(side, v, w, h, t, contours) {
  const Ro = h * 0.42;
  const Sy = v * h * 0.1;
  const Sx = edgeX(contours, Sy, w / 2) - 1.2;
  const cx = Sx + Ro * 1.0, cy = Sy + v * Ro * 0.55;
  const th0 = Math.atan2(Sy - cy, Sx - cx);
  const r0 = Math.hypot(Sx - cx, Sy - cy);
  const pts = [], wd = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const th = th0 + (v > 0 ? 1 : -1) * rad(600) * u;
    const r = r0 * (1 - 0.9 * Math.pow(u, 0.9));
    pts.push([cx + Math.cos(th) * r, cy + Math.sin(th) * r]);
    wd.push(h * (0.1 - 0.075 * u));
  }
  const cs = polys([stroke2d(pts, wd)]);
  const last = pts[pts.length - 1];
  const sol = Manifold.extrude(cs, t * 0.8, 0, 0, 1);
  const bulb = ball(h * 0.05, [last[0], last[1], t * 0.4], 14);
  let m = union([sol, bulb]);
  if (side < 0) m = m.mirror([1, 0, 0]);
  return m;
}
export function plaqueOrnaments(o, { w, h, t, outline, def, bevel }) {
  const out = [];
  if (!o) return out;
  if (o.studs) {
    const r = clamp(h * 0.065, 1.1, 2.4);
    const m = clamp(h * 0.14, 3.2, 6.5) + bevel;
    const shrunk = outline.offset(-(r + 0.6), 'Miter', 2);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const p = [sx * (w / 2 - m), sy * (h / 2 - m)];
      const probe = polys([[[p[0] - 0.1, p[1] - 0.1], [p[0] + 0.1, p[1] - 0.1], [p[0] + 0.1, p[1] + 0.1], [p[0] - 0.1, p[1] + 0.1]]]);
      if (!probe.intersect(shrunk).isEmpty()) out.push(ball(r, [p[0], p[1], t + r * 0.15], 16));
    }
  }
  if (o.scrolls) {
    const contours = outline.toPolygons();
    for (const side of [1, -1]) for (const v of [1, -1]) out.push(scroll(side, v, w, h, t, contours));
  }
  if (o.laurel) {
    const L = h * 0.34, wid = h * 0.13, th = Math.max(1.2, t * 0.6);
    const n = 5;
    const contours = outline.toPolygons();
    for (const side of [1, -1]) {
      const stemPts = [];
      for (let i = 0; i < n; i++) {
        const yy = -h * 0.36 + (i * h * 0.72) / (n - 1);
        const x0 = side * (edgeX(contours, yy, w / 2) - 1.2);
        for (const [phi, k] of [[38, 1], [-4, 0.78]]) {
          const ang = rad(90 - side * phi); // direction of leaf axis (from +x)
          const len = L * k * (1 - 0.18 * (i / (n - 1)));
          const dx = Math.cos(ang), dy = Math.sin(ang);
          out.push(ellipsoid(len / 2, wid / 2 * k, th / 2, [0, 0, 0], 14).rotate([0, 0, (ang * 180) / Math.PI])
            .translate([x0 + dx * len * 0.5, yy + dy * len * 0.5, t * 0.45]));
        }
        stemPts.push([x0, yy, t * 0.45]);
      }
      out.push(tube(stemPts, th * 0.5, 8));
    }
  }
  return out;
}

// Columns / stems between base and topper. build(p) -> { solid, height, topR }
// p = { height, radius }  (radius = nominal column radius in mm)
import { Manifold, lathe, polyLathe, polys, union, cyl, ball, segs, rad, box } from '../kernel.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function turned(p, fn) {
  // fn(r, h) -> profile [[r,z],...]
  const solid = lathe(fn(p.radius, p.height), segs(p.radius * 1.4, 32));
  return { solid, height: p.height, topR: p.radius * 0.8 };
}

export const COLUMNS = [
  { id: 'none', name: 'No column', build: null },
  {
    id: 'cylinder', name: 'Plain Cylinder',
    build: (p) => turned(p, (r, h) => [[r, 0], [r, h]]),
  },
  {
    id: 'collared', name: 'Collared Cylinder',
    build: (p) => turned(p, (r, h) => {
      const c = Math.min(h * 0.08, r * 0.5);
      return [[r * 1.45, 0], [r * 1.45, c * 0.6], [r * 1.15, c], [r, c * 1.5], [r, h - c * 1.5], [r * 1.15, h - c], [r * 1.45, h - c * 0.6], [r * 1.45, h]];
    }),
  },
  {
    id: 'tapered', name: 'Tapered Column',
    build: (p) => turned(p, (r, h) => [[r * 1.25, 0], [r * 0.7, h]]),
  },
  {
    id: 'baluster', name: 'Turned Baluster',
    build: (p) => turned(p, (r, h) => {
      const pts = [[r * 1.35, 0], [r * 1.35, h * 0.04], [r * 0.8, h * 0.08], [r * 0.55, h * 0.13]];
      const n = 14;
      for (let i = 0; i <= n; i++) { // vase belly
        const t = i / n;
        pts.push([r * (0.55 + 0.75 * Math.sin(Math.PI * Math.pow(t, 0.8))), h * (0.13 + 0.6 * t)]);
      }
      pts.push([r * 0.5, h * 0.76], [r * 0.5, h * 0.84], [r * 0.9, h * 0.88], [r * 0.9, h * 0.93], [r * 0.7, h * 0.97], [r * 0.7, h]);
      return pts;
    }),
  },
  {
    id: 'knop', name: 'Knop Stem',
    build: (p) => turned(p, (r, h) => {
      const k = Math.min(h * 0.22, r * 1.5);
      const mid = h * 0.5;
      const pts = [[r * 1.4, 0], [r * 1.4, h * 0.05], [r * 0.5, h * 0.12], [r * 0.5, mid - k]];
      const n = 10;
      for (let i = 0; i <= n; i++) {
        const a = -Math.PI / 2 + (i / n) * Math.PI;
        pts.push([r * 0.5 + r * 0.9 * Math.cos(a), mid + Math.sin(a) * k]);
      }
      pts.push([r * 0.5, mid + k], [r * 0.5, h * 0.88], [r * 1.1, h]);
      return pts.map(([rr, z]) => [Math.max(rr, 0.2), z]);
    }),
  },
  {
    id: 'hex', name: 'Hexagonal Column',
    build: (p) => ({
      solid: polyLathe([[p.radius * 1.1, 0], [p.radius * 1.1, p.height]], 6),
      height: p.height, topR: p.radius * 0.9,
    }),
  },
  {
    id: 'square', name: 'Square Pillar',
    build: (p) => ({
      solid: box(p.radius * 1.7, p.radius * 1.7, p.height),
      height: p.height, topR: p.radius * 0.85,
    }),
  },
  {
    id: 'twist', name: 'Twisted Column',
    build: (p) => {
      const R = p.radius * 1.1;
      const pts = [];
      const N = 72;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const r = R * (1 + 0.32 * Math.cos(3 * a));
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      const cs = polys([pts]);
      const div = Math.max(12, Math.round(p.height * 1.4));
      const twisted = Manifold.extrude(cs, p.height, div, 220, 1);
      const cap = (z) => cyl(Math.min(3, p.height * 0.07), R * 1.2, R * 1.2, [0, 0, z]);
      return { solid: union([twisted, cap(0), cap(p.height - Math.min(3, p.height * 0.07))]), height: p.height, topR: R * 0.95 };
    },
  },
  {
    id: 'fluted', name: 'Fluted Doric',
    build: (p) => {
      const r = p.radius * 1.15, h = p.height;
      const cH = Math.min(h * 0.07, 4);
      const shaft = lathe([[r * 0.95, cH], [r * 0.82, h - cH]], segs(r, 32));
      let flutes = [];
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        flutes.push(cyl(h, r * 0.17, r * 0.17, [Math.cos(a) * r * 0.97, Math.sin(a) * r * 0.97, 0], 12));
      }
      const fl = Manifold.union(flutes);
      const sh = shaft.subtract(fl.translate([0, 0, 0]));
      const base = lathe([[r * 1.3, 0], [r * 1.3, cH * 0.5], [r * 1.05, cH]], segs(r, 32));
      const cap = lathe([[r * 0.95, h - cH], [r * 1.2, h - cH * 0.5], [r * 1.35, h - cH * 0.4], [r * 1.35, h]], segs(r, 32));
      return { solid: union([sh, base, cap]), height: h, topR: r * 1.2 };
    },
  },
  {
    id: 'ringed', name: 'Ringed Pillar',
    build: (p) => turned(p, (r, h) => {
      const pts = [[r * 1.3, 0], [r * 1.3, h * 0.04]];
      const rings = Math.max(2, Math.round(h / 14));
      pts.push([r, h * 0.08]);
      for (let i = 1; i <= rings; i++) {
        const z = (h * 0.08) + ((h * 0.84) * i) / (rings + 1);
        const w = Math.min(h * 0.03, 2.2);
        pts.push([r, z - w * 2], [r * 1.28, z - w], [r * 1.28, z + w], [r, z + w * 2]);
      }
      pts.push([r, h * 0.92], [r * 1.3, h * 0.96], [r * 1.3, h]);
      return pts;
    }),
  },
];

export function getColumn(id) { return COLUMNS.find((c) => c.id === id) || COLUMNS[0]; }

// Columns / stems between base and topper. build(p) -> { solid, height, topR }
// p = { height, radius }  (radius = nominal column radius in mm)
import { Manifold, lathe, polyLathe, polys, union, cyl, ball, segs, rad, box } from '../kernel.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** radius of a [[r,z],...] profile at height z (linear interpolation) */
function profileRadius(prof) {
  return (z) => {
    for (let i = 0; i < prof.length - 1; i++) {
      const [r0, z0] = prof[i], [r1, z1] = prof[i + 1];
      if (z >= Math.min(z0, z1) - 1e-9 && z <= Math.max(z0, z1) + 1e-9) return z1 === z0 ? Math.min(r0, r1) : r0 + ((r1 - r0) * (z - z0)) / (z1 - z0);
    }
    return prof[prof.length - 1][0];
  };
}
/** z must never go back down — clamp to the running maximum so unusual heights cannot fold the profile over itself */
function monotone(prof) { let zmax = -Infinity; return prof.map(([r, z]) => { zmax = Math.max(zmax, z); return [r, zmax]; }); }
function turned(p, fn) {
  // fn(r, h) -> profile [[r,z],...]
  const prof = monotone(fn(p.radius, p.height));
  const solid = lathe(prof, segs(p.radius * 1.4, 32));
  // radiusAt(z): guaranteed-solid radius at height z, used by ornaments so they never float off the shaft
  return { solid, height: p.height, topR: p.radius * 0.8, radiusAt: profileRadius(prof) };
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
      height: p.height, topR: p.radius * 0.9, radiusAt: () => p.radius * 1.1 * 0.97,
    }),
  },
  {
    id: 'square', name: 'Square Pillar',
    build: (p) => ({
      solid: box(p.radius * 1.7, p.radius * 1.7, p.height),
      height: p.height, topR: p.radius * 0.85, radiusAt: () => p.radius * 0.85 * 0.97,
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
      return { solid: union([twisted, cap(0), cap(p.height - Math.min(3, p.height * 0.07))]), height: p.height, topR: R * 0.95, radiusAt: () => R * 0.68 };
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
      return { solid: union([sh, base, cap]), height: h, topR: r * 1.2, radiusAt: (z) => (z < cH ? r * 1.05 : z > h - cH ? r * 0.95 : r * 0.78) };
    },
  },
  {
    id: 'ringed', name: 'Ringed Pillar',
    build: (p) => turned(p, (r, h) => {
      const pts = [[r * 1.3, 0], [r * 1.3, h * 0.04]];
      const rings = Math.max(2, Math.round(h / 14));
      pts.push([r, h * 0.08]);
      const gap = (h * 0.84) / (rings + 1);
      for (let i = 1; i <= rings; i++) {
        const z = (h * 0.08) + gap * i;
        const w = Math.min(h * 0.03, 2.2, gap * 0.2); // ring half-width never exceeds a fifth of the spacing
        pts.push([r, z - w * 2], [r * 1.28, z - w], [r * 1.28, z + w], [r, z + w * 2]);
      }
      pts.push([r, h * 0.92], [r * 1.3, h * 0.96], [r * 1.3, h]);
      return pts;
    }),
  },
  {
    id: 'oct', name: 'Octagonal Column',
    build: (p) => ({
      solid: polyLathe([[p.radius * 1.05, 0], [p.radius * 1.05, p.height]], 8, { rot: 22.5 }),
      height: p.height, topR: p.radius * 0.95, radiusAt: () => p.radius * 1.05 * 0.97,
    }),
  },
  {
    id: 'octTaper', name: 'Tapered Octagon',
    build: (p) => {
      const r0 = p.radius * 1.3, r1 = p.radius * 0.65;
      return { solid: polyLathe([[r0, 0], [r1, p.height]], 8, { rot: 22.5 }), height: p.height, topR: r1 * 0.95, radiusAt: (z) => (r0 + (r1 - r0) * clamp(z / p.height, 0, 1)) * 0.97 };
    },
  },
  {
    id: 'spire', name: 'Spire',
    build: (p) => turned(p, (r, h) => [[r * 1.5, 0], [r * 1.1, h * 0.12], [r * 0.75, h * 0.5], [r * 0.45, h]]),
  },
  {
    id: 'hourglass', name: 'Hourglass',
    build: (p) => turned(p, (r, h) => {
      const pts = [];
      const n = 16;
      for (let i = 0; i <= n; i++) { const t = i / n; pts.push([r * (0.5 + 1.0 * Math.pow(Math.abs(2 * t - 1), 1.6)), h * t]); }
      return pts;
    }),
  },
  {
    id: 'urn', name: 'Classic Urn',
    build: (p) => turned(p, (r, h) => {
      const pts = [[r * 1.1, 0], [r * 1.1, h * 0.05], [r * 0.6, h * 0.1], [r * 0.45, h * 0.18]];
      const n = 14;
      for (let i = 0; i <= n; i++) { const t = i / n; pts.push([r * (0.45 + 0.95 * Math.sin(Math.PI * Math.pow(t, 0.7) * 0.92)), h * (0.18 + 0.5 * t)]); }
      pts.push([r * 0.8, h * 0.74], [r * 0.55, h * 0.8], [r * 0.55, h * 0.88], [r * 1.0, h * 0.93], [r * 1.0, h]);
      return pts;
    }),
  },
  {
    id: 'beads', name: 'Bead Stack',
    build: (p) => turned(p, (r, h) => {
      const n = Math.max(2, Math.min(6, Math.round(h / (r * 1.6))));
      const seg = h / n, pts = [];
      for (let k = 0; k < n; k++) {
        for (let i = 0; i <= 8; i++) {
          const a = -Math.PI / 2 + (i / 8) * Math.PI;
          pts.push([r * (0.62 + 0.62 * Math.cos(a)) , seg * (k + 0.5 + 0.5 * Math.sin(a))]);
        }
      }
      return pts.map(([rr, z]) => [Math.max(rr, r * 0.6), z]);
    }),
  },
  {
    id: 'discs', name: 'Stacked Discs',
    build: (p) => turned(p, (r, h) => {
      const n = Math.max(3, Math.min(9, Math.round(h / 8))), seg = h / n, pts = [];
      for (let k = 0; k < n; k++) {
        const rr = r * (k % 2 ? 0.85 : 1.25), z0 = k * seg, z1 = (k + 1) * seg;
        pts.push([rr, z0], [rr, z1]);
      }
      return pts;
    }),
  },
  {
    id: 'rope', name: 'Rope Twist',
    build: (p) => {
      const R = p.radius * 1.05, lobes = 5, pts = [];
      for (let i = 0; i < 80; i++) {
        const a = (i / 80) * Math.PI * 2, r = R * (1 + 0.24 * Math.cos(lobes * a));
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      const div = Math.max(16, Math.round(p.height * 1.6));
      const twisted = Manifold.extrude(polys([pts]), p.height, div, -300, 1);
      const cH = Math.min(3, p.height * 0.07);
      const cap = (z) => cyl(cH, R * 1.25, R * 1.25, [0, 0, z]);
      return { solid: union([twisted, cap(0), cap(p.height - cH)]), height: p.height, topR: R * 0.95, radiusAt: () => R * 0.74 };
    },
  },
  {
    id: 'twistSquare', name: 'Twisted Square',
    build: (p) => {
      const s = p.radius * 0.95;
      const cs = polys([[[-s, -s], [s, -s], [s, s], [-s, s]]]);
      const twisted = Manifold.extrude(cs, p.height, Math.max(12, Math.round(p.height * 1.2)), 90, 1);
      const cH = Math.min(3, p.height * 0.07), cs2 = s * 1.45;
      return { solid: union([twisted, box(cs2, cs2, cH), box(cs2, cs2, cH).translate([0, 0, p.height - cH])]), height: p.height, topR: s, radiusAt: () => s * 0.96 };
    },
  },
];

export function getColumn(id) { return COLUMNS.find((c) => c.id === id) || COLUMNS[0]; }

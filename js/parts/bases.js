// Trophy bases. Every builder returns:
//  solid   : Manifold standing on z=0
//  top     : [x,y,z] where the column / topper stands
//  topHalf : [hx, hy] free half-extent of the top surface around `top`
//  mount   : { y, z, tilt, maxW, maxH } plaque anchor on the front surface (tilt = degrees leaned back from vertical)
//  topPoly : outline polygon of the top face (for beads / finials)
//  footPoly: outline polygon at the foot
//  round   : bool, true for round shapes
import { Manifold, hullOf, union, polyLathe, polys, rad, segs } from '../kernel.js';
import { textCross } from '../text.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ----- rectangular stack of frusta (profile entries are [inset, z]) ----- */
function rectRing(hw, hd, inset, z, cr) {
  const x = Math.max(hw - inset, 0.05), y = Math.max(hd - inset, 0.05);
  const r = clamp(cr - inset, 0, Math.min(x, y) - 0.01);
  if (r < 0.2) return [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
  const pts = [];
  const n = 6;
  const corners = [[x - r, y - r, 0], [-x + r, y - r, 90], [-x + r, -y + r, 180], [x - r, -y + r, 270]];
  for (const [cx, cy, a0] of corners) for (let i = 0; i <= n; i++) {
    const a = rad(a0 + (i / n) * 90);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
  }
  return pts;
}
export function rectStack(hw, hd, prof, cr = 0) {
  const pieces = [];
  for (let i = 0; i < prof.length - 1; i++) {
    const [i0, z0] = prof[i], [i1, z1] = prof[i + 1];
    if (z1 - z0 < 1e-6) continue; // horizontal step: the next piece starts with the new inset
    pieces.push(hullOf([...rectRing(hw, hd, i0, z0, cr), ...rectRing(hw, hd, i1, z1, cr)]));
  }
  return union(pieces);
}
const rectPoly = (hw, hd, inset) => [[-(hw - inset), -(hd - inset)], [hw - inset, -(hd - inset)], [hw - inset, hd - inset], [-(hw - inset), hd - inset]];
const ngonPoly = (n, apothem, rot = 0) => {
  const R = apothem / Math.cos(Math.PI / n);
  return Array.from({ length: n }, (_, i) => { const a = rad(rot + (i / n) * 360); return [Math.cos(a) * R, Math.sin(a) * R]; });
};
const circlePoly = (r, n = 48) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r]; });

/** insetAt(prof, z) : linear interpolation of inset along a profile */
function insetAt(prof, z) {
  for (let i = 0; i < prof.length - 1; i++) {
    const [a, za] = prof[i], [b, zb] = prof[i + 1];
    if (z >= za - 1e-9 && z <= zb + 1e-9 && zb > za) return a + ((b - a) * (z - za)) / (zb - za);
  }
  return prof[prof.length - 1][0];
}

/* ----- generic rectangular base from a profile ----- */
function rectBase(p, prof, o = {}) {
  const hw = p.width / 2, hd = p.depth / 2, h = p.height;
  const maxIn = Math.min(hw, hd) * 0.92;
  prof = prof.map(([i, z]) => [Math.min(i, maxIn), z]);
  const solid = rectStack(hw, hd, prof, o.cr || 0);
  const topInset = prof[prof.length - 1][0];
  const [b0, b1] = o.band || [h * 0.12, h * 0.78];
  const zm = (b0 + b1) / 2;
  const ins = insetAt(prof, zm);
  return {
    solid,
    top: [0, 0, prof[prof.length - 1][1]],
    topHalf: [hw - topInset, hd - topInset],
    mount: { y: -(hd - ins), z: zm, tilt: o.tilt || 0, maxW: 2 * (hw - ins) - 4, maxH: b1 - b0, back: hd },
    halfAt: (z) => { const i = insetAt(prof, clamp(z, 0, prof[prof.length - 1][1])); return [hw - i, hd - i]; },
    topPoly: rectPoly(hw, hd, topInset),
    footPoly: rectPoly(hw, hd, 0),
    round: false,
  };
}

/* ----- generic polygonal / round base ----- */
function lathedBase(p, n, rProf, o = {}) {
  const h = p.height;
  const R = p.width / 2;
  const prof = rProf(R, h);
  const sy = o.oval ? p.depth / p.width : 1;
  const solid = polyLathe(prof, n, { rot: o.rot || 0, sx: 1, sy });
  const topR = prof[prof.length - 1][0];
  const [b0, b1] = o.band || [h * 0.12, h * 0.78];
  const zm = (b0 + b1) / 2;
  const rAt = (z) => {
    let r = prof[0][0];
    for (let i = 0; i < prof.length - 1; i++) {
      if (z >= prof[i][1] && z <= prof[i + 1][1] && prof[i + 1][1] > prof[i][1]) {
        r = prof[i][0] + ((prof[i + 1][0] - prof[i][0]) * (z - prof[i][1])) / (prof[i + 1][1] - prof[i][1]);
      }
    }
    return r;
  };
  const round = n >= 24;
  const ap = rAt(zm); // radius (round) or apothem (polygon)
  const topPoly = round ? circlePoly(topR * 1, 48).map(([x, y]) => [x, y * sy]) : ngonPoly(n, topR, o.rot || 0);
  const footPoly = round ? circlePoly(prof[0][0], 48).map(([x, y]) => [x, y * sy]) : ngonPoly(n, prof[0][0], o.rot || 0);
  return {
    solid,
    top: [0, 0, prof[prof.length - 1][1]],
    topHalf: [topR, topR * sy],
    mount: { y: -ap * sy, z: zm, tilt: o.tilt || 0, maxW: round ? ap * 1.5 : 2 * ap * Math.tan(Math.PI / n) - 4, maxH: b1 - b0, back: ap * sy, curved: round ? { a: ap, b: ap * sy } : null },
    halfAt: (z) => { const r = rAt(clamp(z, 0, h)); return [r, r * sy]; },
    topPoly,
    footPoly,
    round,
  };
}

export const BASES = [
  {
    id: 'block', name: 'Classic Block', rect: true,
    build: (p) => {
      const c = Math.min(3, p.height * 0.18);
      return rectBase(p, [[0, 0], [0, p.height - c], [c, p.height]], { band: [3, p.height - c - 2] });
    },
  },
  {
    id: 'rounded', name: 'Soft Block', rect: true,
    build: (p) => {
      const c = Math.min(3, p.height * 0.18);
      return rectBase(p, [[0, 0], [0, p.height - c], [c, p.height]], { cr: Math.min(p.width, p.depth) * 0.12, band: [3, p.height - c - 2] });
    },
  },
  {
    id: 'plinth', name: 'Moulded Plinth', rect: true,
    build: (p) => {
      const h = p.height, s = Math.min(p.width, p.depth) * 0.045;
      const prof = [[0, 0], [0, h * 0.1], [s, h * 0.1 + s * 0.8], [s * 2, h * 0.1 + s * 1.6], [s * 2, h * 0.78],
        [s * 1.2, h * 0.78 + s * 0.5], [s * 0.4, h * 0.78 + s * 1.0], [0, h * 0.78 + s * 1.2], [0, h * 0.93], [s * 0.7, h]];
      return rectBase(p, prof, { band: [h * 0.1 + s * 1.6 + 1, h * 0.78 - 1] });
    },
  },
  {
    id: 'tier2', name: 'Two-Tier', rect: true,
    build: (p) => {
      const h = p.height, W = Math.min(p.width, p.depth) / 2, c = Math.min(2, h * 0.07);
      const hL = h * 0.62, ins = W * 0.2;
      const prof = [[0, 0], [0, hL - c], [c, hL], [ins, hL], [ins, h - c], [ins + c, h]];
      return rectBase(p, prof, { band: [2, hL - c - 1.5] });
    },
  },
  {
    id: 'tier3', name: 'Stepped Pyramid', rect: true,
    build: (p) => {
      const h = p.height, W = Math.min(p.width, p.depth) / 2, c = Math.min(1.6, h * 0.05);
      const h1 = h * 0.4, h2 = h * 0.72;
      const prof = [[0, 0], [0, h1 - c], [c, h1], [W * 0.17, h1], [W * 0.17, h2 - c], [W * 0.17 + c, h2], [W * 0.34, h2], [W * 0.34, h - c], [W * 0.34 + c, h]];
      return rectBase(p, prof, { band: [2, h1 - c - 1] });
    },
  },
  {
    id: 'slope', name: 'Sloped Plinth', rect: true,
    build: (p) => {
      const h = p.height, W = Math.min(p.width, p.depth) / 2, ins = W * 0.3;
      const z0 = h * 0.1, z1 = h * 0.9;
      const prof = [[0, 0], [0, z0], [ins, z1], [ins, h]];
      const tilt = (Math.atan2(ins, z1 - z0) * 180) / Math.PI;
      return rectBase(p, prof, { band: [h * 0.25, h * 0.75], tilt });
    },
  },
  {
    id: 'wedge', name: 'Desk Wedge', rect: true,
    build: (p) => {
      const h = p.height, hw = p.width / 2, hd = p.depth / 2;
      const hf = h * 0.3, yb = hd * 0.15;
      const cs = polys([[[-hd, 0], [hd, 0], [hd, h], [yb, h], [-hd, hf]]]);
      const solid = Manifold.extrude(cs, p.width, 0, 0, 1, true).rotate([90, 0, 90]);
      const run = yb + hd, rise = h - hf;
      const slope = Math.atan2(rise, run);
      const lean = 90 - (slope * 180) / Math.PI;
      const t = 0.45;
      const y = -hd + run * t, z = hf + rise * t;
      return {
        solid,
        top: [0, (yb + hd) / 2, h],
        topHalf: [hw, (hd - yb) / 2],
        mount: { y, z, tilt: lean, maxW: p.width - 6, maxH: Math.hypot(run, rise) * 0.8, back: hd - y, onSlope: true },
        halfAt: () => [hw, hd],
        topPoly: rectPoly(hw, (hd - yb) / 2, 0).map(([x, yy]) => [x, yy + (yb + hd) / 2]),
        footPoly: rectPoly(hw, hd, 0),
        round: false,
      };
    },
  },
  {
    id: 'podium', name: 'Winners Podium', rect: true,
    build: (p) => {
      const h = p.height, hd = p.depth / 2, W = p.width;
      const wC = W * 0.4, wS = W * 0.3;
      const hL = h * 0.72, hR = h * 0.5, c = Math.min(1.5, h * 0.05);
      const blk = (cx, w, hh) => rectStack(w / 2, hd, [[0, 0], [0, hh - c], [c, hh]]).translate([cx, 0, 0]);
      let solid = union([blk(0, wC, h), blk(-(wC / 2 + wS / 2), wS, hL), blk(wC / 2 + wS / 2, wS, hR)]);
      const nums = [];
      const addNum = (txt, cx, w, hh) => {
        const size = clamp(Math.min(w * 0.4, hh * 0.35), 3, 20);
        const cs = textCross('anton', txt, size, {});
        if (!cs) return;
        nums.push(Manifold.extrude(cs, 0.8 + 0.5, 0, 0, 1).rotate([90, 0, 0]).translate([cx, -hd + 0.5, hh * 0.72]));
      };
      if (p.podiumNumbers !== false) {
        addNum('2', -(wC / 2 + wS / 2), wS, hL);
        addNum('3', wC / 2 + wS / 2, wS, hR);
        addNum('1', 0, wC, h);
      }
      if (nums.length) solid = union([solid, ...nums]);
      return {
        solid,
        top: [0, 0, h],
        topHalf: [wC / 2 - c, hd - c],
        mount: { y: -hd, z: h * 0.3, tilt: 0, maxW: wC - 4, maxH: h * 0.38, back: hd * 2 },
        halfAt: () => [W / 2, hd],
        topPoly: rectPoly(wC / 2, hd, c),
        footPoly: rectPoly(W / 2, hd, 0),
        round: false,
        podium: true,
      };
    },
  },
  {
    id: 'round', name: 'Round Disc',
    build: (p) => lathedBase(p, 96, (R, h) => { const c = Math.min(3, h * 0.18); return [[R, 0], [R, h - c], [R - c, h]]; }, { band: [3, p.height - 5] }),
  },
  {
    id: 'oval', name: 'Oval Plaque Base', rect: true,
    build: (p) => lathedBase(p, 96, (R, h) => { const c = Math.min(3, h * 0.18); return [[R, 0], [R, h - c], [R - c, h]]; }, { oval: true, band: [3, p.height - 5] }),
  },
  {
    id: 'roundTier', name: 'Round Tiered',
    build: (p) => lathedBase(p, 96, (R, h) => {
      const c = Math.min(2, h * 0.07);
      return [[R, 0], [R, h * 0.5 - c], [R - c, h * 0.5], [R * 0.74, h * 0.5], [R * 0.74, h - c], [R * 0.74 - c, h]];
    }, { band: [2, p.height * 0.5 - 3] }),
  },
  {
    id: 'bell', name: 'Flared Pedestal',
    build: (p) => lathedBase(p, 96, (R, h) => {
      const pts = [[R, 0], [R, h * 0.1], [R * 0.95, h * 0.14]];
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        pts.push([R * (0.5 + 0.45 * Math.pow(1 - t, 2.2)), h * (0.14 + 0.66 * t)]);
      }
      pts.push([R * 0.62, h * 0.84], [R * 0.64, h * 0.9], [R * 0.6, h]);
      return pts;
    }, { band: [p.height * 0.2, p.height * 0.4] }),
  },
  {
    id: 'hex', name: 'Hexagon',
    build: (p) => lathedBase(p, 6, (R, h) => { const c = Math.min(3, h * 0.18); return [[R, 0], [R, h - c], [R - c, h]]; }, { rot: 0, band: [3, p.height - 5] }),
  },
  {
    id: 'hexTier', name: 'Hexagon Stepped',
    build: (p) => lathedBase(p, 6, (R, h) => {
      const c = Math.min(2, h * 0.07);
      return [[R, 0], [R, h * 0.55 - c], [R - c, h * 0.55], [R * 0.72, h * 0.55], [R * 0.72, h - c], [R * 0.72 - c, h]];
    }, { rot: 0, band: [2, p.height * 0.55 - 3] }),
  },
  {
    id: 'oct', name: 'Octagon',
    build: (p) => lathedBase(p, 8, (R, h) => { const c = Math.min(3, h * 0.18); return [[R, 0], [R, h - c], [R - c, h]]; }, { rot: 22.5, band: [3, p.height - 5] }),
  },
  {
    id: 'oct2', name: 'Octagon Plinth',
    build: (p) => lathedBase(p, 8, (R, h) => {
      const s = R * 0.06;
      return [[R, 0], [R, h * 0.12], [R - s, h * 0.12 + s], [R - s * 2, h * 0.12 + s * 2], [R - s * 2, h * 0.8], [R - s, h * 0.8 + s * 0.5], [R, h * 0.8 + s], [R, h * 0.92], [R - s * 0.8, h]];
    }, { rot: 22.5, band: [p.height * 0.2, p.height * 0.76] }),
  },
];

export function getBase(id) { return BASES.find((b) => b.id === id) || BASES[0]; }
export { circlePoly, ngonPoly, rectPoly };

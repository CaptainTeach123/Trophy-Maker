// Trophy toppers. build(s, p) -> Manifold standing on z=0, centered on x=y=0, facing -Y (front).
//   s = overall height in mm.  p = { text, font, embolden, stl: {manifold, ...}, ... }
import {
  Manifold, CrossSection, lathe, polyLathe, polys, union, cyl, ball, ellipsoid, box, tube, tubeJoined, segs, rad, starPoly, regularPoly,
  bevelSolid, standUp, stroke2d, polarArray, hullOf, bounds,
} from '../kernel.js';
import { textCross } from '../text.js';

const PHI = (1 + Math.sqrt(5)) / 2;

function bez(p0, p1, p2, p3, n = 16) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([0, 1, 2].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]));
  }
  return out;
}
const mirrorX = (m) => m.mirror([1, 0, 0]);

/** Round foot disc with chamfered edge */
function foot(s, r = 0.15, h = 0.035) {
  const R = r * s, H = h * s;
  return lathe([[R, 0], [R, H * 0.6], [R * 0.86, H]], segs(R, 24));
}
/** Foot + short post up to z1 */
function standard(s, zTop, postR = 0.04, footR = 0.15) {
  return union([foot(s, footR), cyl(zTop * s, postR * s, postR * s, [0, 0, 0])]);
}

/* ------------------------------------------------------------------ cups */
function chalice(s, o = {}) {
  const R = (o.rim ?? 0.2) * s, footR = 0.14 * s;
  const stemTop = o.stemTop ?? 0.26;
  const stemPts = o.thin
    ? [[footR, 0], [footR, 0.02 * s], [0.05 * s, 0.045 * s], [0.025 * s, 0.08 * s], [0.025 * s, stemTop * s + 0.02 * s]]
    : [[footR, 0], [footR, 0.022 * s], [0.075 * s, 0.05 * s], [0.04 * s, 0.085 * s], [0.04 * s, 0.11 * s], [0.068 * s, 0.14 * s],
      [0.068 * s, 0.17 * s], [0.04 * s, 0.2 * s], [0.04 * s, stemTop * s + 0.02 * s]];
  const parts = [lathe(stemPts, segs(footR, 32))];
  const z0 = stemTop * s, z1 = (o.top ?? 0.9) * s, wall = 0.016 * s, r0 = 0.04 * s;
  const rOut = (t) => r0 + (R - r0) * Math.pow(Math.sin((t * Math.PI) / 2), o.curve ?? 0.7);
  const N = 20;
  const O = [], I = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    O.push([rOut(t), z0 + (z1 - z0) * t]);
    I.push([Math.max(rOut(t) - wall, 0.01 * s), z0 + wall * 1.3 + (z1 - z0 - wall * 1.3) * t]);
  }
  parts.push(lathe([...O, ...I.reverse()], segs(R, 40)));
  // rim bead
  parts.push(lathe([[R - wall * 0.9, z1 - wall * 0.2], [R + wall * 0.5, z1 - wall * 0.2], [R + wall * 0.7, z1 + wall * 0.5], [R - wall * 0.9, z1 + wall * 0.5]], segs(R, 40), 0, false));
  if (o.handles !== false) {
    const zA = z0 + (z1 - z0) * 0.78, tA = 0.78;
    const A = [rOut(tA) * 0.92, 0, zA];
    const H = bez(A, [R * 2.0, 0, zA + 0.04 * s], [R * 2.0, 0, z0 + 0.02 * s], [0.045 * s, 0, z0 + 0.03 * s], 20);
    const rr = H.map((_, i) => 0.017 * s * (1 + 0.25 * Math.sin((i / 20) * Math.PI)));
    const h1 = tube(H, rr, 10);
    parts.push(h1, mirrorX(h1));
  }
  return union(parts);
}

function lovingCup(s) {
  const footR = 0.15 * s;
  const prof = [[footR, 0], [footR, 0.03 * s], [0.08 * s, 0.065 * s], [0.05 * s, 0.1 * s], [0.05 * s, 0.15 * s], [0.09 * s, 0.19 * s]];
  const N = 16;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    prof.push([0.09 * s + 0.15 * s * Math.sin(Math.PI * Math.pow(t, 0.85)) * (1 - 0.25 * t), 0.19 * s + 0.4 * s * t]);
  }
  prof.push([0.1 * s, 0.62 * s], [0.14 * s, 0.645 * s], [0.16 * s, 0.665 * s], [0.15 * s, 0.675 * s]);
  const body = lathe(prof, segs(0.25 * s, 40));
  const dome = [];
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * (Math.PI / 2); dome.push([0.15 * s * Math.cos(a), 0.675 * s + 0.1 * s * Math.sin(a)]); }
  const lid = lathe(dome, segs(0.15 * s, 32));
  const fin = union([cyl(0.05 * s, 0.025 * s, 0.025 * s, [0, 0, 0.76 * s]), ball(0.048 * s, [0, 0, 0.83 * s]), Manifold.cylinder(0.1 * s, 0.026 * s, 0, 24, false).translate([0, 0, 0.865 * s])]);
  const A = [0.17 * s, 0, 0.52 * s];
  const Hh = bez(A, [0.5 * s, 0, 0.58 * s], [0.5 * s, 0, 0.26 * s], [0.1 * s, 0, 0.22 * s], 24);
  const h1 = tube(Hh, Hh.map((_, i) => 0.02 * s * (1 + 0.3 * Math.sin((i / 24) * Math.PI))), 10);
  return union([body, lid, fin, h1, mirrorX(h1)]);
}

/* ------------------------------------------------------------ star family */
function starTopper(s, o = {}) {
  const zBase = 0.12 * s;
  const R = (s - zBase) / 1.809;
  const zc = zBase + R * 0.809;
  return union([foot(s, 0.17), cyl(zc, 0.05 * s, 0.05 * s, [0, 0, 0]), bevelStandUp(R, o.thick ?? 0.42).translate([0, 0, zc])]);
}
function bevelStandUp(R, thickK) {
  const cs = polys([starPoly(5, R, R * 0.43)]);
  return bevelSolid(cs, R * thickK, 0.28, 0.14).rotate([90, 0, 0]);
}
function ringedStar(s) {
  const zBase = 0.1 * s;
  const Ro = (s - zBase) / 2;
  const zc = zBase + Ro;
  const ring = polys([regularPoly(96, Ro, 0)]).subtract(polys([regularPoly(96, Ro * 0.86, 0)]));
  const ringSolid = Manifold.extrude(ring, Ro * 0.2, 0, 0, 1, true).rotate([90, 0, 0]);
  const Rs = Ro * 0.74;
  const star = bevelStandUp(Rs, 0.34);
  return union([foot(s, 0.17), cyl(zc, 0.05 * s, 0.05 * s, [0, 0, 0]), ringSolid.translate([0, 0, zc]), star.translate([0, 0, zc - Rs * 0.06])]);
}
function heartTopper(s) {
  const pts = [];
  const N = 90;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    pts.push([16 * Math.pow(Math.sin(t), 3), 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)]);
  }
  const zBase = 0.1 * s, H = s - zBase;
  const k = H / 30; // heart height ~ 30 units (from -17 to 12.9)
  const cs = polys([pts.map(([x, y]) => [x * k, (y + 2) * k])]).translate([0, 0]);
  const heart = bevelSolid(cs, H * 0.34, 0.35, 0.2).rotate([90, 0, 0]);
  const b = bounds(heart);
  return union([foot(s, 0.16), cyl(zBase + H * 0.15, 0.05 * s, 0.05 * s, [0, 0, 0]), heart.translate([0, 0, zBase - b.min[2] + 0.02 * s])]);
}
function boltTopper(s) {
  const raw = [[0.15, 1], [-0.35, 0.05], [-0.02, 0.05], [-0.22, -1], [0.4, -0.15], [0.06, -0.15], [0.38, 1]];
  const zBase = 0.1 * s, H = s - zBase;
  const cs = polys([raw.map(([x, y]) => [x * H * 0.52, y * H * 0.5])]);
  const bolt = bevelSolid(cs, H * 0.22, 0.4, 0.2).rotate([90, 0, 0]);
  return union([foot(s, 0.15), cyl(zBase + H * 0.15, 0.045 * s, 0.045 * s), bolt.translate([0, 0, zBase + H * 0.5 - 0.0])]);
}

/* ------------------------------------------------------------------ balls */
function truncatedIcosahedron(R) {
  const base = [[0, 1, 3 * PHI], [1, 2 + PHI, 2 * PHI], [PHI, 2, 2 * PHI + 1]];
  const pts = [];
  for (const [a, b, c] of base) {
    for (const sa of [1, -1]) for (const sb of [1, -1]) for (const sc of [1, -1]) {
      const v = [a * sa, b * sb, c * sc];
      pts.push(v, [v[1], v[2], v[0]], [v[2], v[0], v[1]]);
    }
  }
  const uniq = new Map();
  for (const p of pts) uniq.set(p.map((x) => x.toFixed(4)).join(), p);
  const len = Math.hypot(0, 1, 3 * PHI);
  return [...uniq.values()].map((p) => p.map((x) => (x / len) * R));
}
function ballStand(s, zc, R, topCut = 0.4) {
  const zStem = zc - R * 0.85;
  return union([foot(s, 0.17), cyl(zStem, 0.05 * s, 0.05 * s, [0, 0, 0]), cyl(0.035 * s, 0.1 * s, 0.1 * s, [0, 0, zStem - 0.03 * s])]);
}
function soccer(s) {
  const zBase = 0.12 * s;
  const R = (s - zBase) / 2;
  const zc = zBase + R * 0.98;
  const poly = Manifold.hull(truncatedIcosahedron(R));
  const rounded = poly.intersect(Manifold.sphere(R * 0.975, 48));
  // pentagon inlays: shallow grooves around each pentagonal face give the classic panel look
  return union([ballStand(s, zc, R), rounded.translate([0, 0, zc])]);
}
function seamRing(R, w, depth) {
  // torus-like cutter: ring of radius R, tube half-size w
  const prof = [[R - w, -w], [R + w, -w], [R + w, w], [R - w, w]];
  return lathe(prof, segs(R, 48), 0, false);
}
function basketball(s) {
  const zBase = 0.12 * s;
  const R = (s - zBase) / 2;
  const zc = zBase + R * 0.98;
  const w = R * 0.04;
  let sph = Manifold.sphere(R, segs(R, 64));
  const eq = seamRing(R, w, w);
  const mer1 = seamRing(R, w, w).rotate([90, 0, 0]);
  const mer2 = seamRing(R, w, w).rotate([90, 0, 90]);
  const sideR = R * 0.8, d = R * 0.6;
  const mkSide = (sx) => seamRing(sideR, w, w).rotate([0, 90, 0]).translate([sx * d, 0, 0]);
  sph = sph.subtract(union([eq, mer1, mkSide(1), mkSide(-1)]));
  return union([ballStand(s, zc, R), sph.translate([0, 0, zc])]);
}
function golfBall(s) {
  const zBase = 0.14 * s;
  const R = (s - zBase) / 2;
  const zc = zBase + R * 0.9;
  const N = 90;
  const dimples = [];
  const dr = R * 0.105;
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(1 - y * y), th = i * Math.PI * (3 - Math.sqrt(5));
    const dir = [Math.cos(th) * rr, y, Math.sin(th) * rr];
    dimples.push(ball(dr, dir.map((c) => c * (R + dr * 0.55)), 8));
  }
  const sph = Manifold.sphere(R, segs(R, 48)).subtract(union(dimples));
  const tee = union([foot(s, 0.12), Manifold.cylinder(zc - R * 0.8, 0.06 * s, 0.025 * s, 32, false)]);
  const cup = lathe([[0.025 * s, zc - R * 1.02], [0.075 * s, zc - R * 0.92], [0.06 * s, zc - R * 0.8]], 32);
  return union([tee, cup, sph.translate([0, 0, zc])]);
}
function football(s) {
  const zBase = 0.14 * s;
  const L = s * 0.62; // long axis length
  const rx = L / 2, rz = L * 0.3;
  const tiltDeg = 32;
  const zc = zBase + rx * Math.sin(rad(tiltDeg)) + rz * 0.9;
  let body = ellipsoid(rx, rz, rz, [0, 0, 0], 64);
  // end stripes
  const stripe = (x) => seamRing(rz * 0.97, rz * 0.04, 0).rotate([0, 90, 0]).translate([x, 0, 0]);
  body = body.subtract(union([stripe(rx * 0.52), stripe(rx * 0.62), stripe(-rx * 0.52), stripe(-rx * 0.62)]).intersect(ellipsoid(rx * 1.1, rz * 1.1, rz * 1.1, [0, 0, 0], 32)));
  // laces on the front face (towards -Y)
  const laces = [];
  laces.push(box(rx * 0.55, rz * 0.06, rz * 0.045, [0, -rz * 0.97, 0]));
  for (let i = -2; i <= 2; i++) laces.push(box(rz * 0.045, rz * 0.06, rz * 0.3, [i * rx * 0.1, -rz * 0.96, 0]));
  const ball2 = union([body, ...laces.map((l) => l)]).rotate([0, -tiltDeg, 0]);
  const stand = union([foot(s, 0.17), cyl(zc - rz * 0.6, 0.05 * s, 0.05 * s), cyl(0.04 * s, 0.1 * s, 0.1 * s, [0, 0, zc - rz * 1.0 - 0.0])]);
  return union([stand, ball2.translate([0, 0, zc])]);
}

/* ---------------------------------------------------------------- crown etc */
function crown(s) {
  const zBase = 0.0;
  const Rb = 0.23 * s, bandH = 0.22 * s, wall = 0.018 * s;
  const band = lathe([[Rb * 0.92, 0], [Rb, 0.02 * s], [Rb * 1.0, bandH], [Rb * 1.02, bandH + 0.02 * s], [Rb * 0.98, bandH + 0.02 * s], [Rb - wall, bandH], [Rb * 0.9 - wall, 0.03 * s], [Rb * 0.9 - wall, 0.02 * s]], segs(Rb, 48), 0, false);
  const floor = cyl(0.025 * s, Rb * 0.95, Rb * 0.95, [0, 0, 0]);
  const lower = lathe([[Rb * 1.1, 0], [Rb * 1.1, 0.025 * s], [Rb * 0.98, 0.04 * s]], segs(Rb, 48));
  const n = 7;
  const spikes = polarArray(n, (i, a) => {
    const tri = polys([[[-Rb * 0.21, 0], [Rb * 0.21, 0], [0, 0.34 * s * 0.7]]]);
    const sp = Manifold.extrude(tri, 0.045 * s, 0, 0, 1, true).rotate([90, 0, 0]);
    const tip = ball(0.03 * s, [0, 0, 0.34 * s * 0.7], 16);
    return union([sp, tip]).translate([0, -Rb * 0.99, bandH]).rotate([0, 0, a + 90 - 90]).rotate([0, 0, 0]);
  });
  // arches
  const archH = 0.3 * s;
  const arch = (rotZ) => {
    const pts = [];
    for (let i = 0; i <= 18; i++) { const a = (i / 18) * Math.PI; pts.push([Math.cos(a) * Rb * 0.97, 0, bandH + 0.02 * s + Math.sin(a) * archH]); }
    return tube(pts, 0.016 * s, 10).rotate([0, 0, rotZ]);
  };
  const orb = ball(0.04 * s, [0, 0, bandH + 0.02 * s + archH + 0.025 * s], 20);
  const cross = union([box(0.014 * s, 0.014 * s, 0.07 * s, [0, 0, bandH + 0.02 * s + archH + 0.05 * s]), box(0.05 * s, 0.014 * s, 0.014 * s, [0, 0, bandH + 0.02 * s + archH + 0.085 * s])]);
  return union([lower, band, floor, ...spikes, arch(0), arch(90), orb, cross]);
}
function laurelBranch(Rw, s, count = 11, fromDeg = -78, toDeg = 82, withStem = true) {
  const parts = [];
  const len = 0.15 * s, wid = 0.062 * s, th = 0.022 * s;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const th0 = fromDeg + (toDeg - fromDeg) * t;
    for (const side of [1, -1]) {
      const rr = Rw + side * 0.012 * s;
      const psi = th0 + 90 - side * 26;
      const lscale = 1 - 0.28 * t;
      const cx = Math.cos(rad(th0)) * rr, cz = Math.sin(rad(th0)) * rr;
      const dirx = Math.cos(rad(psi)), dirz = Math.sin(rad(psi));
      const L = len * lscale;
      parts.push(ellipsoid(L / 2, th / 2, wid / 2 * lscale, [0, 0, 0], 12).rotate([0, -psi, 0]).translate([cx + dirx * L * 0.42, 0, cz + dirz * L * 0.42]));
    }
  }
  if (withStem) {
    const pts = [];
    for (let i = 0; i <= 24; i++) { const a = rad(fromDeg + (toDeg - fromDeg) * (i / 24)); pts.push([Math.cos(a) * Rw, 0, Math.sin(a) * Rw]); }
    parts.push(tube(pts, 0.011 * s, 8));
  }
  return union(parts);
}
function laurel(s, withStar = false) {
  const zBase = 0.06 * s;
  const Rw = (s - zBase) / 2 - 0.05 * s;
  const zc = zBase + Rw + 0.075 * s;
  const right = laurelBranch(Rw, s);
  const wreath = union([right, mirrorX(right)]);
  const bz = -Rw - 0.02 * s;
  const endX = Rw * Math.cos(rad(78)), endZ = -Rw * Math.sin(rad(78));
  const bow = union([ellipsoid(0.06 * s, 0.012 * s, 0.025 * s, [0.06 * s, 0, bz], 16).rotate([0, 25, 0]),
    ellipsoid(0.06 * s, 0.012 * s, 0.025 * s, [-0.06 * s, 0, bz], 16).rotate([0, -25, 0]), ball(0.02 * s, [0, 0, bz], 12),
    // ribbon ties joining the knot to both branch ends
    tube([[endX, 0, endZ], [endX * 0.5, 0, (endZ + bz) / 2 - 0.004 * s], [0, 0, bz]], 0.011 * s, 8),
    tube([[-endX, 0, endZ], [-endX * 0.5, 0, (endZ + bz) / 2 - 0.004 * s], [0, 0, bz]], 0.011 * s, 8)]);
  const parts = [foot(s, 0.15), cyl(zc - Rw - 0.01 * s, 0.045 * s, 0.045 * s), wreath.translate([0, 0, zc]), bow.translate([0, 0, zc])];
  if (withStar) {
    const Rs = Rw * 0.62;
    parts.push(bevelStandUp(Rs, 0.3).translate([0, 0, zc + Rw * 0.04]));
    // slim spokes from the star tips out to the wreath so the star is part of the same solid
    for (let i = 0; i < 5; i++) {
      const a = rad(90 + i * 72);
      parts.push(tube([[Math.cos(a) * Rs * 0.8, 0, zc + Rw * 0.04 + Math.sin(a) * Rs * 0.8], [Math.cos(a) * Rw, 0, zc + Math.sin(a) * Rw]], 0.008 * s, 6));
    }
  }
  // tie wreath to the post
  parts.push(cyl(0.05 * s, 0.045 * s, 0.045 * s, [0, 0, zc - Rw - 0.035 * s]));
  return union(parts);
}
export function wingPair(span, zc, thick = 1) {
  // Swept wings spreading left/right from the origin in the XZ plane; `span` = length of one wing.
  const lens = [0.55, 0.72, 0.88, 1.0, 0.95, 0.82, 0.64];
  const angs = [40, 29, 18, 7, -4, -15, -26];
  const feathers = [];
  for (let k = 0; k < 7; k++) {
    const L = span * lens[k], a = angs[k];
    const dx = Math.cos(rad(a)), dz = Math.sin(rad(a));
    feathers.push(ellipsoid(L / 2, span * 0.028 * thick, span * 0.1, [0, 0, 0], 16).rotate([0, -a, 0])
      .translate([dx * L / 2 + span * 0.05, 0, dz * L / 2]));
  }
  // covert row: shorter feathers on top for depth
  for (let k = 0; k < 6; k++) {
    const L = span * lens[k] * 0.55, a = angs[k] + 4;
    const dx = Math.cos(rad(a)), dz = Math.sin(rad(a));
    feathers.push(ellipsoid(L / 2, span * 0.03 * thick, span * 0.085, [0, 0, 0], 14).rotate([0, -a, 0])
      .translate([dx * L / 2 + span * 0.04, -span * 0.025, dz * L / 2 + span * 0.02]));
  }
  const w = union(feathers);
  // central hub fuses both wings into one piece and fills the pockets between feather roots
  const hub = ellipsoid(span * 0.09, span * 0.045 * thick, span * 0.12, [0, 0, 0], 20);
  return union([w, mirrorX(w), hub]).translate([0, 0, zc]);
}
function wingedOrb(s) {
  const span = 0.4 * s;
  const R = 0.11 * s;
  const zc = 0.5 * s;
  return union([foot(s, 0.16), cyl(zc - R * 0.5, 0.05 * s, 0.05 * s), ball(R, [0, 0, zc], 40), wingPair(span, zc), ball(0.02 * s, [0, 0, zc + R * 1.05], 12)]);
}
function wingedStar(s) {
  const zc = 0.5 * s;
  const R = 0.2 * s;
  const star = bevelStandUp(R, 0.4).translate([0, -0.012 * s, zc + R * 0.04]);
  const wings = wingPair(0.4 * s, zc + R * 0.05).translate([0, 0.02 * s, 0]);
  return union([foot(s, 0.16), cyl(zc, 0.05 * s, 0.05 * s), wings, star]);
}
function figure(s) {
  const unit = s / 100;
  const U = (v) => v * unit;
  const parts = [];
  parts.push(foot(s, 0.17));
  // legs
  parts.push(tubeJoined([[U(-5), 0, U(46)], [U(-8), 0, U(26)], [U(-9), 0, U(9)]], [U(5.5), U(4.2), U(3.8)], 12));
  parts.push(tubeJoined([[U(5), 0, U(46)], [U(8), 0, U(26)], [U(9), 0, U(9)]], [U(5.5), U(4.2), U(3.8)], 12));
  parts.push(ellipsoid(U(6), U(8), U(3), [U(-9), U(-3), U(5)], 12), ellipsoid(U(6), U(8), U(3), [U(9), U(-3), U(5)], 12));
  parts.push(cyl(U(12), U(18), U(18), [0, 0, 0]));
  // torso
  parts.push(hullOf([ellipsoid(U(10), U(6), U(5), [0, 0, U(47)], 16), ellipsoid(U(13), U(6.5), U(5), [0, 0, U(70)], 16)]));
  // head + neck
  parts.push(cyl(U(12), U(3.6), U(3.6), [0, 0, U(68)], 12), ball(U(8), [0, 0, U(84)], 28));
  // raised arms
  parts.push(tubeJoined([[U(12), 0, U(70)], [U(22), 0, U(80)], [U(30), 0, U(94)]], [U(4.2), U(3.4), U(3.2)], 12));
  parts.push(tubeJoined([[U(-12), 0, U(70)], [U(-22), 0, U(80)], [U(-30), 0, U(94)]], [U(4.2), U(3.4), U(3.2)], 12));
  parts.push(ball(U(4.2), [U(30), 0, U(95.5)], 14), ball(U(4.2), [U(-30), 0, U(95.5)], 14));
  return union(parts);
}
function gradCap(s) {
  const unit = s / 100;
  const U = (v) => v * unit;
  const post = union([foot(s, 0.17), cyl(U(34), U(7), U(7), [0, 0, 0])]);
  const capBody = lathe([[U(22), U(30)], [U(22), U(36)], [U(19), U(52)], [U(15), U(55)]], 48);
  const board = box(U(70), U(70), U(4), [0, 0, 0]).rotate([0, 0, 45]).rotate([-8, 0, 0]).translate([0, 0, U(57)]);
  const button = ball(U(3.2), [0, 0, U(61.5)], 16);
  const cordPts = bez([0, 0, U(61.5)], [U(14), 0, U(66)], [U(36), 0, U(64)], [U(46), 0, U(55)], 16);
  const cord = tube(cordPts, U(1.4), 8);
  const hang = tube([[U(46), 0, U(56)], [U(47), 0, U(40)], [U(47), 0, U(34)]], U(1.4), 8);
  const tass = union([ball(U(2.6), [U(47), 0, U(34)], 12), Manifold.cylinder(U(16), U(2.2), U(4.6), 24, false).translate([U(47), 0, U(18)])]);
  return union([post, capBody, board, button, cord, hang, tass]);
}
function torch(s) {
  const unit = s / 100;
  const U = (v) => v * unit;
  const handle = lathe([[U(15), 0], [U(15), U(4)], [U(8), U(8)], [U(6), U(14)], [U(5), U(35)], [U(8), U(46)], [U(5.5), U(48)], [U(6), U(52)], [U(15), U(60)], [U(19), U(68)], [U(18), U(70)], [U(10), U(68)], [U(8), U(68)]], 56);
  const flameProf = [];
  const N = 26;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    flameProf.push([U(15) * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 1.15), U(62) + U(38) * t]);
  }
  flameProf[N] = [0.0, flameProf[N][1]];
  let flame = lathe(flameProf, 40).warp((v) => { v[0] += U(4) * Math.sin((v[2] - U(62)) / U(38) * Math.PI * 1.5); });
  const flame2 = lathe(flameProf.map(([r, z]) => [r * 0.55, U(62) + (z - U(62)) * 0.6]), 32).translate([U(13), 0, U(3)]).warp((v) => { v[0] += U(2) * Math.sin((v[2] - U(62)) / U(22) * Math.PI); });
  const flame3 = flame2.mirror([1, 0, 0]);
  return union([handle, flame, flame2, flame3]);
}
function rocket(s) {
  const unit = s / 100;
  const U = (v) => v * unit;
  const prof = [[U(7), U(11)], [U(9), U(18)], [U(10.5), U(26)], [U(10.5), U(66)], [U(9.8), U(74)], [U(8), U(83)], [U(5), U(92)], [U(0), U(100)]];
  const body = lathe(prof, 48);
  const bell = lathe([[U(8.6), U(8)], [U(6.5), U(14)], [U(0), U(14)]], 32);
  const fin = (a) => {
    const f = polys([[[U(9), U(18)], [U(24), U(8)], [U(25), U(40)], [U(9.5), U(54)]]]);
    return Manifold.extrude(f, U(3.4), 0, 0, 1, true).rotate([90, 0, 0]).rotate([0, 0, a]);
  };
  const fins = [0, 120, 240].map((a) => fin(a));
  // porthole: raised ring + domed glass (no cavities, so the solid stays one clean shell)
  const portY = -U(10.2);
  const ring = lathe([[U(4.2), 0], [U(6.4), 0], [U(6.4), U(2.2)], [U(4.2), U(2.2)]], 32, 0, false).rotate([90, 0, 0]).translate([0, portY + U(0.6), U(55)]);
  const glass = ellipsoid(U(4.6), U(2.4), U(4.6), [0, portY - U(0.2), U(55)], 24);
  const stripe = lathe([[U(10.4), U(44)], [U(10.9), U(44)], [U(10.9), U(47)], [U(10.4), U(47)]], 48, 0, false);
  const stand = union([foot(s, 0.17), cyl(U(14), U(4), U(4), [0, 0, 0]), lathe([[U(14), U(3)], [U(4.5), U(9)]], 32)]);
  return union([stand, bell, body, ring, glass, stripe, ...fins]);
}
function obelisk(s) {
  const prof = [[0.17 * s, 0], [0.17 * s, 0.05 * s], [0.13 * s, 0.075 * s], [0.13 * s, 0.1 * s], [0.095 * s, 0.11 * s], [0.058 * s, 0.84 * s], [0.0, 0.96 * s]];
  const body = polyLathe(prof.slice(0, 5), 4, { rot: 45 });
  const spire = polyLathe([[0.095 * s, 0.1 * s], [0.095 * s, 0.11 * s], [0.058 * s, 0.84 * s], [0.0, 0.97 * s]], 4, { rot: 45 });
  const body2 = polyLathe([[0.17 * s, 0], [0.17 * s, 0.05 * s], [0.13 * s, 0.075 * s], [0.13 * s, 0.1 * s]], 4, { rot: 45 });
  return union([body2, spire, ball(0.012 * s, [0, 0, 0.972 * s], 10)]);
}
function gem(s) {
  const R = 0.3 * s;
  const zt = 0.22 * s;
  const prof = [[0.03 * s, zt], [R, zt + 0.17 * s], [R, zt + 0.2 * s], [R * 0.62, zt + 0.37 * s], [R * 0.62, zt + 0.37 * s + 0.0]];
  const gemBody = polyLathe([[0.03 * s, zt], [R, zt + 0.21 * s], [R, zt + 0.24 * s], [R * 0.58, zt + 0.37 * s]], 8, { rot: 22.5 });
  const prongs = polarArray(4, (i, a) => cyl(0.055 * s, 0.014 * s, 0.014 * s, [0, 0, 0]).translate([R * 0.55, 0, zt + 0.05 * s]).rotate([0, 0, a + 45]));
  const stem = union([foot(s, 0.16), cyl(zt + 0.02 * s, 0.045 * s, 0.045 * s), Manifold.cylinder(0.06 * s, 0.05 * s, 0.16 * s, 40, false).translate([0, 0, zt - 0.02 * s])]);
  return union([stem, gemBody]);
}
function gearTopper(s) {
  const zBase = 0.1 * s;
  const Ro = (s - zBase) / 2;
  const zc = zBase + Ro;
  const teeth = 14;
  const rIn = Ro * 0.84;
  const core = polys([regularPoly(64, rIn, 0)]);
  const tooth = polys([[[rIn * 0.96, -Ro * 0.12], [Ro, -Ro * 0.07], [Ro, Ro * 0.07], [rIn * 0.96, Ro * 0.12]]]);
  let cs = core;
  for (let i = 0; i < teeth; i++) cs = cs.add(tooth.rotate((i / teeth) * 360));
  cs = cs.subtract(polys([regularPoly(48, Ro * 0.2, 0)]));
  for (let i = 0; i < 6; i++) {
    const a = rad((i / 6) * 360 + 30);
    cs = cs.subtract(polys([regularPoly(24, Ro * 0.13, 0)]).translate([Math.cos(a) * Ro * 0.52, Math.sin(a) * Ro * 0.52]));
  }
  const gear = Manifold.extrude(cs, Ro * 0.3, 0, 0, 1, true).rotate([90, 0, 0]);
  return union([foot(s, 0.17), cyl(zc, 0.05 * s, 0.05 * s), gear.translate([0, 0, zc])]);
}
function medallion(s) {
  const zBase = 0.1 * s;
  const R = (s - zBase) / 2;
  const zc = zBase + R;
  const t = R * 0.2;
  const disc = Manifold.cylinder(t, R, R, 96, true).rotate([90, 0, 0]);
  const rimCs = polys([regularPoly(96, R, 0)]).subtract(polys([regularPoly(96, R * 0.88, 0)]));
  const rim = Manifold.extrude(rimCs, t * 1.7, 0, 0, 1, true).rotate([90, 0, 0]);
  const star = bevelStandUp(R * 0.58, 0.42).translate([0, -t * 0.1, 0]);
  return union([foot(s, 0.17), cyl(zc, 0.05 * s, 0.05 * s), union([disc, rim, star]).translate([0, 0, zc])]);
}
export function shieldPoly(w, h, n = 14) {
  const pts = [];
  const hw = w / 2;
  pts.push([-hw, h / 2], [hw, h / 2]);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    // right side curve down to the tip
    pts.push([hw * (1 - Math.pow(t, 2.0)) * (1 - 0.0), h / 2 - h * (0.35 + 0.65 * t)]);
  }
  for (let i = n - 1; i >= 1; i--) {
    const t = i / n;
    pts.push([-hw * (1 - Math.pow(t, 2.0)), h / 2 - h * (0.35 + 0.65 * t)]);
  }
  // straight upper sides
  pts.splice(2, 0, [hw, h / 2 - h * 0.35]);
  pts.push([-hw, h / 2 - h * 0.35]);
  return pts;
}
function shield(s) {
  const zBase = 0.1 * s;
  const H = s - zBase, W = H * 0.78;
  const cs = polys([shieldPoly(W, H)]);
  const body = bevelSolid(cs, H * 0.16, 0.8, 0.5).rotate([90, 0, 0]);
  const star = bevelStandUp(W * 0.3, 0.2).translate([0, -H * 0.08, H * 0.04]);
  return union([foot(s, 0.15), cyl(zBase + H * 0.15, 0.045 * s, 0.045 * s), body.translate([0, 0, zBase + H / 2]), star.translate([0, 0, zBase + H / 2])]);
}
function textTopper(s, p) {
  const str = (p.text || '1').slice(0, 24);
  const capH = s * 0.78;
  const cs = textCross(p.font || 'bebas', str, capH, { embolden: p.embolden || 0, align: 'center' });
  if (!cs) return foot(s, 0.12);
  const b = cs.bounds();
  const w = b.max[0] - b.min[0], cx = (b.min[0] + b.max[0]) / 2;
  const depth = Math.max(capH * 0.2, 3);
  const zBase = s * 0.13;
  const letters = standUp(cs, depth).translate([0, 0, zBase + capH / 2]);
  const slab = box(w + s * 0.16, depth * 1.5, s * 0.1, [cx, 0, 0]);
  const slabTop = box(w + s * 0.08, depth * 1.25, s * 0.05, [cx, 0, s * 0.1]);
  const parts = [slab, slabTop, letters];
  if (p.backing !== false) {
    // a thin panel behind the lettering ties dots, umlauts and separate strokes into the same solid
    const t = Math.max(1.6, depth * 0.3);
    parts.push(box(w + s * 0.06, t, capH * 1.08, [cx, depth / 2 - t / 2 + 0.01, zBase - capH * 0.04]));
  }
  return union(parts);
}


/* ------------------------------------------------------------------ more toppers (v1.1) */
const ellipse2d = (rx, ry, at = [0, 0], rot = 0, n = 48) => polys([Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [Math.cos(a) * rx, Math.sin(a) * ry]; })]).rotate(rot).translate(at);

function globe(s) {
  const zBase = 0.13 * s, R = (s - zBase) / 2, zc = zBase + R, n = segs(R, 40);
  const band = (rIn, rOut, w) => lathe([[rIn, -w], [rOut * 0.95, -w * 0.5], [rOut, 0], [rOut * 0.95, w * 0.5], [rIn, w]], n, 0, false);
  const w = R * 0.07;
  const equator = band(R * 0.9, R * 1.08, w);
  const meridian = band(R * 0.9, R * 1.08, w).rotate([90, 0, 0]);
  const meridian2 = band(R * 0.9, R * 1.08, w).rotate([90, 0, 60]);
  const tilt = (m) => m.rotate([0, 23, 0]).translate([0, 0, zc]);
  return union([foot(s, 0.17), cyl(zc, 0.045 * s, 0.045 * s), ball(R, [0, 0, zc], n), tilt(equator), tilt(meridian), tilt(meridian2)]);
}
function pyramid(s) {
  const zBase = 0.08 * s, H = s - zBase, W = 0.7 * s, tiers = 4, th = (H * 0.8) / tiers;
  const parts = [box(W * 1.04, W * 1.04, zBase + 0.6)];
  for (let k = 0; k < tiers; k++) {
    const w = W * (1 - 0.2 * k);
    parts.push(box(w, w, th + 0.8, [0, 0, zBase - 0.6 + k * th]));
  }
  const wTop = W * (1 - 0.2 * tiers) + 0.4;
  parts.push(Manifold.cylinder(H * 0.2 + 0.6, wTop / Math.SQRT2, 0, 4, false).rotate([0, 0, 45]).translate([0, 0, zBase + tiers * th - 0.6]));
  return union(parts);
}
function crescent(s) {
  const zBase = 0.1 * s, H = s - zBase, R = H / 2, zc = zBase + R;
  const cs = polys([regularPoly(72, R, 0)]).subtract(polys([regularPoly(72, R * 0.8, 0)]).translate([R * 0.38, R * 0.06]));
  const moon = bevelSolid(cs, R * 0.4, 0.45, 0.2).rotate([90, 0, 0]);
  return union([foot(s, 0.17), cyl(zBase + 0.6 * R, 0.045 * s, 0.045 * s), moon.translate([0, 0, zc + 0.02 * s])]);
}
function raceFlag(s) {
  const zBase = 0.07 * s, pr = Math.max(0.016 * s, 1.1), W = 0.56 * s, Hf = 0.4 * s, d = Math.max(0.022 * s, 2), zf = s - 0.06 * s - Hf;
  const parts = [foot(s, 0.17), cyl(s * 0.95, pr, pr), ball(pr * 1.8, [0, 0, s - pr * 1.8])];
  parts.push(box(W + pr, d, Hf, [pr + W / 2 - pr * 0.5 - 0.0, 0, zf]));
  const cols = 6, rows = 4, cw = W / cols, ch = Hf / rows, t = Math.max(0.9, d * 0.5);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if ((i + j) % 2 === 0) parts.push(box(cw - 0.15, t + 0.3, ch - 0.15, [pr + cw * (i + 0.5), -d / 2 - t / 2 + 0.15, zf + ch * j + 0.075]));
  return union(parts);
}
function sword(s) {
  const zBase = 0.09 * s, gripTop = 0.3 * s, guardW = 0.3 * s, gd = 0.04 * s, bw = 0.075 * s;
  const grip = lathe([[0.022 * s, zBase - 1], [0.028 * s, zBase + 0.03 * s], [0.022 * s, zBase + 0.08 * s], [0.028 * s, zBase + 0.13 * s], [0.022 * s, gripTop]], 20);
  const bladeCs = polys([[[-bw, 0], [bw, 0], [bw * 0.9, (s - gripTop) * 0.86], [0, s - gripTop], [-bw * 0.9, (s - gripTop) * 0.86]]]);
  const blade = bevelSolid(bladeCs, 0.045 * s, 0.1, 0.12).rotate([90, 0, 0]).translate([0, 0, gripTop - 0.6]);
  const guard = hullOf([box(guardW, gd, 0.028 * s, [0, 0, gripTop - 0.02 * s]), ball(0.03 * s, [guardW / 2, 0, gripTop - 0.006 * s]), ball(0.03 * s, [-guardW / 2, 0, gripTop - 0.006 * s])]);
  const pommel = ball(0.04 * s, [0, 0, zBase + 0.005 * s]);
  return union([foot(s, 0.17), cyl(zBase + 1, 0.03 * s, 0.03 * s), grip, pommel, guard, blade]);
}
function musicNote(s) {
  const hr = 0.075 * s, a = 0.2 * s, plate = 0.04 * s, zh = plate + hr * 0.75, zb = s - 0.05 * s, sr = 0.014 * s;
  const head = (x) => ellipsoid(hr * 1.4, hr * 1.0, hr * 0.95, [x, 0, zh]);
  const sx = (x) => x + hr * 1.25;
  const parts = [box(2 * a + hr * 5, hr * 3.4, plate + 0.6), head(-a), head(a)];
  for (const x of [-a, a]) parts.push(cyl(zb - zh, sr, sr, [sx(x), 0, zh]));
  parts.push(tubeJoined([[sx(-a), 0, zb - 0.025 * s], [sx(a), 0, zb - 0.025 * s]], 0.032 * s, 10));
  return union(parts);
}
function openBook(s) {
  const zBase = 0.08 * s, H = 0.86 * s, W = 0.36 * s, t = Math.max(0.04 * s, 3), ang = 26;
  // right-hand leaf (page + slightly larger cover behind it), hinged on the spine at x = 0, angled toward the viewer
  const right = union([box(W, t, H, [W / 2 - 0.5, 0, 0]), box(W + 1.6, t * 0.5, H + 1.6, [W / 2 - 0.5, t * 0.5, -0.8])]).rotate([0, 0, -ang]);
  const hr = Math.max(0.013 * s, 1);
  return union([foot(s, 0.22), cyl(zBase + 1, hr * 2.2, hr * 2.2), union([right, right.mirror([1, 0, 0]), cyl(H, hr * 1.6, hr * 1.6, [0, 0, 0], 12)]).translate([0, 0, zBase])]);
}
function bulb(s) {
  const zBase = 0.12 * s, R = 0.25 * s, zc = s - R - 0.01 * s, n = segs(R, 40);
  const neck = lathe([[0.12 * s, zBase - 1], [0.12 * s, zBase + 0.04 * s], [0.115 * s, zBase + 0.06 * s], [0.12 * s, zBase + 0.08 * s], [0.115 * s, zBase + 0.1 * s], [0.12 * s, zBase + 0.12 * s], [0.14 * s, zc - R * 0.7], [R * 0.7, zc - R * 0.7]], 40);
  const filament = tubeJoined([[-R * 0.25, 0, zc - R * 0.4], [-R * 0.25, 0, zc + R * 0.1], [0, 0, zc - R * 0.05], [R * 0.25, 0, zc + R * 0.1], [R * 0.25, 0, zc - R * 0.4]], R * 0.045, 8);
  return union([foot(s, 0.17), cyl(zBase + 1, 0.06 * s, 0.06 * s), neck, ball(R, [0, 0, zc], n), filament]);
}
function dumbbell(s) {
  const zBase = 0.1 * s, rP = 0.19 * s, zc = Math.min(s - rP - 0.02 * s, zBase + rP + 0.05 * s), L = 0.78 * s;
  const horiz = (m) => m.rotate([0, 90, 0]).translate([0, 0, zc]);
  const bar = horiz(Manifold.cylinder(L, 0.028 * s, 0.028 * s, 24, true));
  const plates = [];
  for (const sg of [-1, 1]) {
    plates.push(horiz(Manifold.cylinder(0.075 * s, rP, rP, segs(rP, 32), true).translate([0, 0, sg * (L / 2 - 0.1 * s)])));
    plates.push(horiz(Manifold.cylinder(0.075 * s, rP * 0.78, rP * 0.78, segs(rP, 32), true).translate([0, 0, sg * (L / 2 - 0.1 * s - 0.07 * s)])));
    plates.push(horiz(Manifold.cylinder(0.03 * s, 0.045 * s, 0.045 * s, 24, true).translate([0, 0, sg * (L / 2 - 0.0 * s)])));
  }
  return union([foot(s, 0.19), cyl(zc, 0.045 * s, 0.045 * s), bar, ...plates]);
}
function microphone(s) {
  const zBase = 0.1 * s, R = 0.16 * s, zc = s - R - 0.005 * s;
  const handle = lathe([[0.17 * s, 0], [0.17 * s, 0.035 * s], [0.05 * s, 0.07 * s], [0.04 * s, 0.12 * s], [0.07 * s, zc - R * 0.8], [R * 0.65, zc - R * 0.75]], 40);
  const band = lathe([[R * 0.82, -0.012 * s], [R * 1.04, -0.012 * s], [R * 1.04, 0.012 * s], [R * 0.82, 0.012 * s]], 40, 0, false).translate([0, 0, zc - R * 0.55]);
  const head = ball(R, [0, 0, zc], segs(R, 40));
  const bands = [-0.2, 0.3].map((k) => lathe([[R * 0.8, -0.008 * s], [R * 1.02, -0.008 * s], [R * 1.02, 0.008 * s], [R * 0.8, 0.008 * s]], 40, 0, false).translate([0, 0, zc + R * k]));
  return union([handle, head, band, ...bands]);
}
function pawPrint(s) {
  const zBase = 0.1 * s, H = s - zBase, k = H / 0.8;
  // big palm pad + four round toes that overlap its rim, so the whole print is one piece
  let cs = ellipse2d(0.3 * k, 0.235 * k, [0, 0.17 * k]);
  const toes = [[-0.305, 0.3, 0, 0.1, 0.11], [-0.125, 0.47, 0, 0.1, 0.11], [0.125, 0.47, 0, 0.1, 0.11], [0.305, 0.3, 0, 0.1, 0.11]];
  for (const [x, y, r, rx, ry] of toes) cs = cs.add(ellipse2d(rx * k, ry * k, [x * k, y * k], r));
  const paw = bevelSolid(cs, H * 0.26, 0.5, 0.3).rotate([90, 0, 0]);
  const b = bounds(paw);
  return union([foot(s, 0.17), cyl(zBase + 0.1 * H, 0.05 * s, 0.05 * s), paw.translate([0, 0, zBase - b.min[2]])]);
}
function sunburst(s) {
  const zBase = 0.1 * s, R = (s - zBase) / 2, zc = zBase + R;
  const cs = polys([starPoly(16, R, R * 0.7)]).add(polys([regularPoly(64, R * 0.78, 0)]));
  const sun = bevelSolid(cs, R * 0.34, 0.5, 0.25).rotate([90, 0, 0]);
  const core = polys([regularPoly(64, R * 0.5, 0)]);
  const face = Manifold.extrude(core, R * 0.34, 0, 0, 1, true).rotate([90, 0, 0]).translate([0, -R * 0.04, 0]);
  return union([foot(s, 0.17), cyl(zc, 0.05 * s, 0.05 * s), union([sun, face]).translate([0, 0, zc])]);
}

export const TOPPERS = [
  { id: 'cup', name: 'Classic Cup', build: (s) => chalice(s) },
  { id: 'lovingCup', name: 'Loving Cup & Lid', build: (s) => lovingCup(s) },
  { id: 'goblet', name: 'Goblet', build: (s) => chalice(s, { handles: false, thin: true, rim: 0.17, stemTop: 0.3, curve: 1.1, top: 0.92 }) },
  { id: 'star', name: 'Faceted Star', build: (s) => starTopper(s) },
  { id: 'ringedStar', name: 'Ringed Star', build: (s) => ringedStar(s) },
  { id: 'laurelStar', name: 'Laurel Star', build: (s) => laurel(s, true) },
  { id: 'laurel', name: 'Laurel Wreath', build: (s) => laurel(s, false) },
  { id: 'wingedStar', name: 'Winged Star', build: (s) => wingedStar(s) },
  { id: 'wingedOrb', name: 'Winged Orb', build: (s) => wingedOrb(s) },
  { id: 'crown', name: 'Royal Crown', build: (s) => crown(s) },
  { id: 'figure', name: 'Victory Figure', build: (s) => figure(s) },
  { id: 'heart', name: 'Heart', build: (s) => heartTopper(s) },
  { id: 'bolt', name: 'Lightning Bolt', build: (s) => boltTopper(s) },
  { id: 'soccer', name: 'Soccer Ball', build: (s) => soccer(s) },
  { id: 'basketball', name: 'Basketball', build: (s) => basketball(s) },
  { id: 'football', name: 'Football', build: (s) => football(s) },
  { id: 'golf', name: 'Golf Ball & Tee', build: (s) => golfBall(s) },
  { id: 'gradcap', name: 'Graduation Cap', build: (s) => gradCap(s) },
  { id: 'torch', name: 'Victory Torch', build: (s) => torch(s) },
  { id: 'rocket', name: 'Rocket', build: (s) => rocket(s) },
  { id: 'medallion', name: 'Medallion', build: (s) => medallion(s) },
  { id: 'shield', name: 'Crest Shield', build: (s) => shield(s) },
  { id: 'gear', name: 'Gear', build: (s) => gearTopper(s) },
  { id: 'gem', name: 'Gem', build: (s) => gem(s) },
  { id: 'obelisk', name: 'Obelisk', build: (s) => obelisk(s) },
  { id: 'bowl', name: 'Champion Bowl', build: (s) => chalice(s, { thin: true, rim: 0.3, stemTop: 0.13, top: 0.93, curve: 0.55 }) },
  { id: 'flute', name: 'Tall Flute', build: (s) => chalice(s, { handles: false, thin: true, rim: 0.1, stemTop: 0.36, top: 0.97, curve: 0.4 }) },
  { id: 'globe', name: 'Globe', build: (s) => globe(s) },
  { id: 'pyramid', name: 'Stepped Pyramid', build: (s) => pyramid(s) },
  { id: 'crescent', name: 'Crescent Moon', build: (s) => crescent(s) },
  { id: 'sunburst', name: 'Sunburst', build: (s) => sunburst(s) },
  { id: 'flag', name: 'Checkered Flag', build: (s) => raceFlag(s) },
  { id: 'sword', name: 'Sword', build: (s) => sword(s) },
  { id: 'note', name: 'Music Notes', build: (s) => musicNote(s) },
  { id: 'book', name: 'Open Book', build: (s) => openBook(s) },
  { id: 'bulb', name: 'Light Bulb', build: (s) => bulb(s) },
  { id: 'dumbbell', name: 'Dumbbell', build: (s) => dumbbell(s) },
  { id: 'mic', name: 'Microphone', build: (s) => microphone(s) },
  { id: 'paw', name: 'Paw Print', build: (s) => pawPrint(s) },
  { id: 'text', name: 'Custom Text', build: (s, p) => textTopper(s, p), custom: 'text' },
  { id: 'stl', name: 'Your STL', build: null, custom: 'stl' },
  { id: 'none', name: 'No topper', build: null },
];

export function getTopper(id) { return TOPPERS.find((t) => t.id === id) || TOPPERS[0]; }

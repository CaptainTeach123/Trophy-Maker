// Geometry kernel: thin layer over Manifold (WASM) that gives us
//  - guaranteed watertight booleans (so every STL we export is a clean solid)
//  - automatic memory management through scopes (WASM objects must be freed by hand)
//  - a handful of shape helpers shared by all parts.
import Module from '../vendor/manifold/manifold.js';

const wasm = await Module();
wasm.setup();

export const wasmModule = wasm;
export const Manifold = wasm.Manifold;
export const CrossSection = wasm.CrossSection;
export const MeshCtor = wasm.Mesh;

/* ------------------------------------------------------------------ */
/* Scoped memory management                                            */
/* ------------------------------------------------------------------ */
const scopeStack = [];
const manifoldStatics = ['cube', 'cylinder', 'sphere', 'tetrahedron', 'extrude', 'revolve', 'compose', 'union',
  'difference', 'intersection', 'ofMesh', 'hull'];
const manifoldMembers = ['add', 'subtract', 'intersect', 'decompose', 'warp', 'transform', 'translate', 'rotate',
  'scale', 'mirror', 'refine', 'simplify', 'asOriginal', 'trimByPlane', 'split', 'splitByPlane', 'slice',
  'project', 'hull', 'setTolerance', 'refineToLength', 'refineToTolerance'];
const csStatics = ['square', 'circle', 'union', 'difference', 'intersection', 'compose', 'ofPolygons', 'hull'];
const csMembers = ['add', 'subtract', 'intersect', 'rectClip', 'decompose', 'transform', 'translate', 'rotate',
  'scale', 'mirror', 'simplify', 'offset', 'hull'];

function track(r) {
  const s = scopeStack[scopeStack.length - 1];
  if (s && r) s.items.push(r);
  return r;
}
function patch(target, names) {
  for (const n of names) {
    const orig = target[n];
    if (typeof orig !== 'function') continue;
    target[n] = function (...args) { return track(orig.apply(this, args)); };
  }
}
patch(Manifold, manifoldStatics);
patch(CrossSection, csStatics);
// Instances created by the factory functions do NOT use `Manifold.prototype` (embind hands out a derived prototype),
// so patch the prototype that instances actually have — otherwise chained results would never be freed.
{
  const probeM = Manifold.cube(1);
  const probeC = CrossSection.square(1);
  patch(Object.getPrototypeOf(probeM), manifoldMembers);
  patch(Object.getPrototypeOf(probeC), csMembers);
  probeM.delete(); probeC.delete();
}

// The WASM binding reads a scalar `scaleTop` as (s, 0) and flattens the top face, so always pass a pair.
{
  const rawExtrude = Manifold.extrude;
  Manifold.extrude = (cs, height, nDivisions = 0, twist = 0, scaleTop = [1, 1], center = false) => {
    // extruding an empty outline yields an "InvalidConstruction" manifold that poisons every union it touches
    if (cs && typeof cs.isEmpty === 'function' && cs.isEmpty()) return emptySolid();
    return rawExtrude.call(Manifold, cs, height, nDivisions, twist, typeof scaleTop === 'number' ? [scaleTop, scaleTop] : scaleTop, center);
  };
}

function safeDelete(o) {
  if (Array.isArray(o)) { o.forEach(safeDelete); return; }
  try { if (o && !o.isDeleted()) o.delete(); } catch (e) { /* already gone */ }
}

/** Run fn; every Manifold/CrossSection created inside is freed afterwards, except those passed to keep(). */
export function scoped(fn, { persist = false } = {}) {
  const scope = { items: [], keep: new Set() };
  scopeStack.push(scope);
  let result;
  try {
    result = fn();
  } finally {
    scopeStack.pop();
    for (const it of scope.items) {
      if (Array.isArray(it)) { for (const e of it) if (!scope.keep.has(e)) safeDelete(e); }
      else if (!scope.keep.has(it)) safeDelete(it);
    }
    // kept objects bubble up to the parent scope so they are cleaned there unless kept again
    const parent = scopeStack[scopeStack.length - 1];
    if (parent && !persist) for (const k of scope.keep) parent.items.push(k);
  }
  return result;
}
export function keep(...objs) {
  const s = scopeStack[scopeStack.length - 1];
  if (!s) return objs[0];
  for (const o of objs) if (o) s.keep.add(o);
  return objs[0];
}
export function dispose(...objs) { objs.forEach(safeDelete); }

/** Is this a Manifold / CrossSection (something that must be freed)? */
const isWasm = (o) => o && typeof o === 'object' && typeof o.delete === 'function' && typeof o.isDeleted === 'function';
/** Free every WASM object held (one level deep) by a cached value. */
export function disposeValue(v) {
  if (!v || typeof v !== 'object') return;
  if (isWasm(v)) { safeDelete(v); return; }
  for (const x of Object.values(v)) if (isWasm(x)) safeDelete(x);
}

const groupCache = new Map();
let cacheEnabled = true;
/** Disable caching for one-off builds (thumbnails) so they never evict the live design's solids. */
export function setCacheEnabled(on) { cacheEnabled = on; }
/**
 * Build-and-remember: runs fn() once per distinct key and keeps its (fully evaluated) solids alive between
 * builds, so editing one part does not rebuild the others.
 */
export function cached(name, key, fn) {
  if (!cacheEnabled) return fn();
  const hit = groupCache.get(name);
  if (hit && hit.key === key) return hit.value;
  if (hit) disposeValue(hit.value);
  groupCache.delete(name);
  const value = scoped(() => {
    const v = fn();
    for (const x of Object.values(v)) if (isWasm(x)) { x.status(); keep(x); } // status() forces the lazy boolean tree
    return v;
  }, { persist: true });
  groupCache.set(name, { key, value });
  return value;
}
export function dropCached(name) { const h = groupCache.get(name); if (h) { disposeValue(h.value); groupCache.delete(name); } }
export function clearCache() { for (const h of groupCache.values()) disposeValue(h.value); groupCache.clear(); }

/* ------------------------------------------------------------------ */
/* Quality / tessellation                                              */
/* ------------------------------------------------------------------ */
export const quality = { factor: 1 };
/** Number of segments for a circle of radius r (mm) — multiple of 4 for clean geometry. */
export function segs(r, min = 16) {
  const n = Math.max(min, Math.min(160, Math.ceil(Math.sqrt(Math.max(r, 0.5)) * 11 * quality.factor)));
  return Math.ceil(n / 4) * 4;
}

/* ------------------------------------------------------------------ */
/* Basic builders                                                      */
/* ------------------------------------------------------------------ */
export const rad = (d) => (d * Math.PI) / 180;

export function polys(contours, fill = 'NonZero') {
  return track(new CrossSection(contours, fill));
}

/** Solid of revolution. profile = [[r,z],...] ; closed down to the axis automatically unless close=false (ring profiles). */
export function lathe(profile, nseg = 64, rot = 0, close = true) {
  const pts = profile.map(([r, z]) => [Math.max(r, 0), z]);
  const first = pts[0], last = pts[pts.length - 1];
  const poly = [];
  if (close && first[0] > 1e-6) poly.push([0, first[1]]);
  poly.push(...pts);
  if (close && last[0] > 1e-6) poly.push([0, last[1]]);
  const cs = polys([poly]);
  let m = Manifold.revolve(cs, nseg);
  if (rot) m = m.rotate([0, 0, rot]);
  return m;
}

/** Prism-like solid with n sides built from a [apothem|radius, z] profile. n>=24 => round. */
export function polyLathe(profile, n, opts = {}) {
  const { rot = 0, sx = 1, sy = 1 } = opts;
  const isRound = n >= 24;
  const k = isRound ? 1 : 1 / Math.cos(Math.PI / n);
  const prof = profile.map(([r, z]) => [r * k, z]);
  let m = lathe(prof, n, isRound ? 0 : rot);
  if (sx !== 1 || sy !== 1) m = m.scale([sx, sy, 1]);
  return m;
}

export function ball(r, at = [0, 0, 0], n) {
  return Manifold.sphere(r, n || segs(r, 12)).translate(at);
}
export function ellipsoid(rx, ry, rz, at = [0, 0, 0], n) {
  const r = Math.max(rx, ry, rz);
  return Manifold.sphere(1, n || segs(r, 12)).scale([rx, ry, rz]).translate(at);
}
export function cyl(h, r, r2 = r, at = [0, 0, 0], n) {
  return Manifold.cylinder(h, r, r2, n || segs(Math.max(r, r2)), false).translate(at);
}
export function box(w, d, h, at = [0, 0, 0]) {
  return Manifold.cube([w, d, h], false).translate([at[0] - w / 2, at[1] - d / 2, at[2]]);
}
export function union(list) {
  const l = list.filter(Boolean);
  if (!l.length) return Manifold.cube([0.001, 0.001, 0.001]).subtract(Manifold.cube(1));
  if (l.length === 1) return l[0];
  return Manifold.union(l);
}
export function hullOf(list) { return Manifold.hull(list); }

/** Rounded tube/capsule chain along 3D points with per-point radius. */
export function tube(points, radii, n) {
  const r = (i) => (Array.isArray(radii) ? radii[i] : radii);
  const spheres = points.map((p, i) => ball(r(i), p, n || segs(r(i), 12)));
  const parts = [];
  for (let i = 0; i < points.length - 1; i++) parts.push(Manifold.hull([spheres[i], spheres[i + 1]]));
  return union(parts);
}

/** Closed 2D polygon around a polyline with varying width (for flourishes / scrolls). */
export function stroke2d(points, widths) {
  const w = (i) => (Array.isArray(widths) ? widths[i] : widths) / 2;
  const L = [], R = [];
  for (let i = 0; i < points.length; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[Math.min(points.length - 1, i + 1)];
    let dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    L.push([points[i][0] - dy * w(i), points[i][1] + dx * w(i)]);
    R.push([points[i][0] + dy * w(i), points[i][1] - dx * w(i)]);
  }
  return [...L, ...R.reverse()];
}

export function regularPoly(n, r, rot = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = rad(rot) + (i / n) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}
export function starPoly(n, rOut, rIn, rot = 90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rad(rot) + (i / (n * 2)) * Math.PI * 2;
    const r = i % 2 ? rIn : rOut;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

/** Extrude a 2D cross section/polygons, then stand it up so it faces the viewer (-Y). Thickness centered on y=0. */
export function standUp(cs, thickness, scaleTop = 1) {
  return Manifold.extrude(cs, thickness, 0, 0, scaleTop, true).rotate([90, 0, 0]);
}

/** Faceted "pillow" shape: extrude 2D shape and bevel both faces to a smaller top. */
export function bevelSolid(cs, thickness, topScale = 0.55, flat = 0.25) {
  const th = thickness / 2, f = thickness * flat;
  const mid = Manifold.extrude(cs, f, 0, 0, 1, true);
  const up = Manifold.extrude(cs, th - f / 2, 0, 0, topScale).translate([0, 0, f / 2]);
  const dn = up.mirror([0, 0, 1]);
  return union([mid, up, dn]);
}

/** Circular array of builder(i, angleDeg) results about Z. */
export function polarArray(count, fn, startDeg = 0, spanDeg = 360) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = startDeg + (spanDeg === 360 ? (i / count) * 360 : count > 1 ? (i / (count - 1)) * spanDeg : 0);
    out.push(fn(i, a));
  }
  return out;
}

export function bounds(m) {
  const b = m.boundingBox();
  return { min: b.min, max: b.max, size: [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]] };
}

/**
 * Drop numerical dust: connected shells too small to ever print (tiny sealed cavities and floating specks that the
 * booleans can leave at near-coincident surfaces). Sealed cavities under `minVoid` mm³ are filled in; floating specks
 * under `minSolid` mm³ are removed. Lettering passes a far smaller `minSolid` so full stops and dots survive.
 */
export function cleanDust(m, { minSolid = 0.5, minVoid = 2 } = {}) {
  const comps = m.decompose();
  if (comps.length < 2) return m;
  const real = comps.filter((c) => { const v = c.volume(); return v < 0 ? -v >= minVoid : v >= minSolid; });
  if (real.length === comps.length || !real.length) return m;
  return Manifold.compose(real);
}

export function emptySolid() {
  return track(Manifold.cube([1, 1, 1]).subtract(Manifold.cube([3, 3, 3], true)));
}

/* ------------------------------------------------------------------ */
/* Mesh extraction                                                     */
/* ------------------------------------------------------------------ */
export function toMeshData(m) {
  const mesh = m.getMesh();
  const np = mesh.numProp;
  const nv = mesh.vertProperties.length / np;
  const pos = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) {
    pos[i * 3] = mesh.vertProperties[i * np];
    pos[i * 3 + 1] = mesh.vertProperties[i * np + 1];
    pos[i * 3 + 2] = mesh.vertProperties[i * np + 2];
  }
  return { positions: pos, indices: new Uint32Array(mesh.triVerts) };
}

export function meshStats(m) {
  const b = bounds(m);
  return {
    triangles: m.numTri(),
    vertices: m.numVert(),
    volume: m.volume(),
    area: m.surfaceArea(),
    genus: m.genus(),
    status: m.status(),
    size: b.size,
    min: b.min,
    max: b.max,
  };
}

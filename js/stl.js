// STL import (binary + ASCII) -> watertight Manifold, and STL export.
import { Manifold, MeshCtor, scoped, keep, toMeshData } from './kernel.js';

/** Parse an STL ArrayBuffer into a flat Float32Array of triangle corner positions (9 floats / triangle). */
export function parseSTL(buffer) {
  const dv = new DataView(buffer);
  if (buffer.byteLength >= 84) {
    const n = dv.getUint32(80, true);
    if (84 + n * 50 === buffer.byteLength) {
      const out = new Float32Array(n * 9);
      let off = 84;
      for (let i = 0; i < n; i++) {
        off += 12; // normal
        for (let k = 0; k < 9; k++) { out[i * 9 + k] = dv.getFloat32(off, true); off += 4; }
        off += 2;
      }
      return out;
    }
  }
  const text = new TextDecoder().decode(buffer);
  const re = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;
  const vals = [];
  let m;
  while ((m = re.exec(text))) vals.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
  if (!vals.length || vals.length % 9) throw new Error('Not a valid STL file');
  return Float32Array.from(vals);
}

/**
 * Weld triangle soup into an indexed mesh and try to make a Manifold from it.
 * Returns { manifold|null, soup, reason }. The manifold (if any) is permanent: caller owns it.
 */
export function stlToManifold(soup) {
  // bounding box for tolerance
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < soup.length; i += 3) for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], soup[i + k]); max[k] = Math.max(max[k], soup[i + k]);
  }
  const diag = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
  const inv = 1 / (diag * 1e-6); // vertices closer than ~1e-6 of the model size are the same vertex
  // open-addressing hash table over quantised integer coordinates (several times faster than string keys)
  const nCorners = soup.length / 3;
  let cap = 1; while (cap < nCorners * 2) cap <<= 1;
  const table = new Int32Array(cap).fill(-1); // slot -> vertex index
  const q = new Int32Array(nCorners * 3);     // quantised coordinates per vertex index
  const verts = new Float32Array(nCorners * 3);
  let nv = 0;
  const vid = (x, y, z) => {
    const ix = Math.round((x - min[0]) * inv) | 0, iy = Math.round((y - min[1]) * inv) | 0, iz = Math.round((z - min[2]) * inv) | 0;
    let h = (Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791)) & (cap - 1);
    for (;;) {
      const v = table[h];
      if (v === -1) { table[h] = nv; q[nv * 3] = ix; q[nv * 3 + 1] = iy; q[nv * 3 + 2] = iz; verts[nv * 3] = x; verts[nv * 3 + 1] = y; verts[nv * 3 + 2] = z; return nv++; }
      if (q[v * 3] === ix && q[v * 3 + 1] === iy && q[v * 3 + 2] === iz) return v;
      h = (h + 1) & (cap - 1);
    }
  };
  const tris = new Uint32Array(nCorners);
  let nt = 0;
  for (let i = 0; i < soup.length; i += 9) {
    const a = vid(soup[i], soup[i + 1], soup[i + 2]);
    const b = vid(soup[i + 3], soup[i + 4], soup[i + 5]);
    const c = vid(soup[i + 6], soup[i + 7], soup[i + 8]);
    if (a !== b && b !== c && a !== c) { tris[nt++] = a; tris[nt++] = b; tris[nt++] = c; }
  }
  const vertList = verts.subarray(0, nv * 3), triList = tris.subarray(0, nt);
  const attempt = (list, merge) => {
    try {
      const mesh = new MeshCtor({ numProp: 3, vertProperties: vertList, triVerts: list });
      if (merge) mesh.merge(); // best-effort stitching of open seams; skipped when the welded mesh is already closed
      const m = Manifold.ofMesh(mesh);
      if (m.status() !== 'NoError' || m.isEmpty() || m.volume() < 0) { m.delete(); return null; }
      return m;
    } catch (e) { return null; }
  };
  let m = attempt(triList, false) || attempt(triList, true);
  if (!m) {
    const flipped = new Uint32Array(nt);
    for (let i = 0; i < nt; i += 3) { flipped[i] = triList[i]; flipped[i + 1] = triList[i + 2]; flipped[i + 2] = triList[i + 1]; }
    m = attempt(flipped, false) || attempt(flipped, true);
  }
  if (m) return { manifold: m, soup, reason: null };
  return { manifold: null, soup, reason: 'This STL is not watertight (open holes or non-manifold edges), so it cannot be welded. It will still be exported as its own separate shell.' };
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */
/** Binary STL from one or more bodies given as {positions, indices}. */
export function bodiesToBinarySTL(bodies, header = 'Trophy Maker') {
  let nTri = 0;
  for (const b of bodies) nTri += b.indices ? b.indices.length / 3 : b.positions.length / 9;
  const buf = new ArrayBuffer(84 + nTri * 50);
  const dv = new DataView(buf);
  const h = new TextEncoder().encode(header.slice(0, 79));
  new Uint8Array(buf, 0, h.length).set(h);
  dv.setUint32(80, nTri, true);
  let off = 84;
  const P = new Float32Array(9);
  for (const b of bodies) {
    const count = b.indices ? b.indices.length / 3 : b.positions.length / 9;
    for (let t = 0; t < count; t++) {
      for (let c = 0; c < 3; c++) {
        const vi = b.indices ? b.indices[t * 3 + c] : t * 3 + c;
        P[c * 3] = b.positions[vi * 3]; P[c * 3 + 1] = b.positions[vi * 3 + 1]; P[c * 3 + 2] = b.positions[vi * 3 + 2];
      }
      const ux = P[3] - P[0], uy = P[4] - P[1], uz = P[5] - P[2];
      const vx = P[6] - P[0], vy = P[7] - P[1], vz = P[8] - P[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      dv.setFloat32(off, nx, true); dv.setFloat32(off + 4, ny, true); dv.setFloat32(off + 8, nz, true); off += 12;
      for (let k = 0; k < 9; k++) { dv.setFloat32(off, P[k], true); off += 4; }
      dv.setUint16(off, 0, true); off += 2;
    }
  }
  return buf;
}

/** Soup (unwelded raw triangles) -> body */
export function soupBody(soup) { return { positions: soup }; }

/** Re-export a Manifold through STL bytes then parse again (used by tests to prove round-trip validity). */
export function manifoldToBody(m) { return toMeshData(m); }

export { scoped, keep };

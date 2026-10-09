// Smooth normals only across gentle edges (crease angle), flat across sharp ones. Pure typed-array code: runs in the
// worker so the main thread only has to upload ready-made buffers to the GPU.
/**
 * @param {Float32Array} positions  x,y,z per vertex (indexed) — or 9 floats per triangle when `indices` is null
 * @param {Uint32Array|null} indices
 * @returns {{pos: Float32Array, nrm: Float32Array}} non-indexed triangle corners and their normals
 */
export function creaseNormals(positions, indices, creaseDeg = 38) {
  const tris = indices ? indices.length / 3 : positions.length / 9;
  const pos = new Float32Array(tris * 9);
  const nrm = new Float32Array(tris * 9);
  const fn = new Float32Array(tris * 3); // unit face normals
  const area = new Float32Array(tris);
  const vi = (t, k) => (indices ? indices[t * 3 + k] : t * 3 + k);
  for (let t = 0; t < tris; t++) {
    const a = vi(t, 0) * 3, b = vi(t, 1) * 3, c = vi(t, 2) * 3;
    pos.set([positions[a], positions[a + 1], positions[a + 2], positions[b], positions[b + 1], positions[b + 2], positions[c], positions[c + 1], positions[c + 2]], t * 9);
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    fn[t * 3] = nx / l; fn[t * 3 + 1] = ny / l; fn[t * 3 + 2] = nz / l;
    area[t] = l;
  }
  if (!indices) {
    for (let t = 0; t < tris; t++) for (let k = 0; k < 3; k++) nrm.set([fn[t * 3], fn[t * 3 + 1], fn[t * 3 + 2]], t * 9 + k * 3);
    return { pos, nrm };
  }
  // CSR adjacency: triangles around each vertex
  const nv = positions.length / 3;
  const start = new Uint32Array(nv + 1);
  for (let i = 0; i < indices.length; i++) start[indices[i] + 1]++;
  for (let i = 0; i < nv; i++) start[i + 1] += start[i];
  const fill = start.slice(0, nv);
  const adj = new Uint32Array(indices.length);
  for (let t = 0; t < tris; t++) for (let k = 0; k < 3; k++) adj[fill[indices[t * 3 + k]]++] = t;
  const cosC = Math.cos((creaseDeg * Math.PI) / 180);
  for (let t = 0; t < tris; t++) {
    const tx = fn[t * 3], ty = fn[t * 3 + 1], tz = fn[t * 3 + 2];
    for (let k = 0; k < 3; k++) {
      const v = indices[t * 3 + k];
      let sx = 0, sy = 0, sz = 0;
      for (let j = start[v]; j < start[v + 1]; j++) {
        const o = adj[j];
        if (fn[o * 3] * tx + fn[o * 3 + 1] * ty + fn[o * 3 + 2] * tz >= cosC) { const w = area[o]; sx += fn[o * 3] * w; sy += fn[o * 3 + 1] * w; sz += fn[o * 3 + 2] * w; }
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      nrm[t * 9 + k * 3] = sx / l; nrm[t * 9 + k * 3 + 1] = sy / l; nrm[t * 9 + k * 3 + 2] = sz / l;
    }
  }
  return { pos, nrm };
}

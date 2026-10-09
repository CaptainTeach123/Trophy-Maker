// three.js viewer (Z-up, like slicers). Shows the same meshes that get exported.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { RoomEnvironment } from '../vendor/three/RoomEnvironment.js';

export const MATERIALS = {
  gold: { color: 0xd9ac3c, metalness: 0.92, roughness: 0.3 },
  silver: { color: 0xd8dde4, metalness: 0.95, roughness: 0.28 },
  bronze: { color: 0xb87333, metalness: 0.88, roughness: 0.38 },
  white: { color: 0xeeeeee, metalness: 0.0, roughness: 0.65 },
  black: { color: 0x25262b, metalness: 0.4, roughness: 0.35 },
};
const GROUP_COLORS = { base: 0x6d7a96, column: 0xc9a14a, topper: 0xd9ac3c, plaque: 0x8a5a3c, plaqueText: 0xf0e6c8, extra: 0x5fb37c, trophy: 0xd9ac3c };

/** Smooth normals only across gentle edges (crease angle), flat across sharp ones. Returns non-indexed attributes. */
export function creaseGeometry(positions, indices, creaseDeg = 38) {
  const triCount = indices ? indices.length / 3 : positions.length / 9;
  const pos = new Float32Array(triCount * 9);
  const nrm = new Float32Array(triCount * 9);
  const fn = new Float32Array(triCount * 3);
  const get = (t, c) => (indices ? indices[t * 3 + c] : t * 3 + c);
  for (let t = 0; t < triCount; t++) {
    const a = get(t, 0), b = get(t, 1), c = get(t, 2);
    for (let k = 0; k < 3; k++) {
      const v = get(t, k);
      pos[t * 9 + k * 3] = positions[v * 3]; pos[t * 9 + k * 3 + 1] = positions[v * 3 + 1]; pos[t * 9 + k * 3 + 2] = positions[v * 3 + 2];
    }
    const ux = positions[b * 3] - positions[a * 3], uy = positions[b * 3 + 1] - positions[a * 3 + 1], uz = positions[b * 3 + 2] - positions[a * 3 + 2];
    const vx = positions[c * 3] - positions[a * 3], vy = positions[c * 3 + 1] - positions[a * 3 + 1], vz = positions[c * 3 + 2] - positions[a * 3 + 2];
    // area-weighted (unnormalised) face normal
    fn[t * 3] = uy * vz - uz * vy; fn[t * 3 + 1] = uz * vx - ux * vz; fn[t * 3 + 2] = ux * vy - uy * vx;
  }
  if (!indices) {
    for (let t = 0; t < triCount; t++) {
      const l = Math.hypot(fn[t * 3], fn[t * 3 + 1], fn[t * 3 + 2]) || 1;
      for (let k = 0; k < 3; k++) { nrm[t * 9 + k * 3] = fn[t * 3] / l; nrm[t * 9 + k * 3 + 1] = fn[t * 3 + 1] / l; nrm[t * 9 + k * 3 + 2] = fn[t * 3 + 2] / l; }
    }
    return { pos, nrm };
  }
  const nv = positions.length / 3;
  const counts = new Uint32Array(nv + 1);
  for (let i = 0; i < indices.length; i++) counts[indices[i] + 1]++;
  for (let i = 0; i < nv; i++) counts[i + 1] += counts[i];
  const fill = counts.slice(0, nv);
  const adj = new Uint32Array(indices.length);
  for (let t = 0; t < triCount; t++) for (let k = 0; k < 3; k++) adj[fill[indices[t * 3 + k]]++] = t;
  const cosC = Math.cos((creaseDeg * Math.PI) / 180);
  const len = (t) => Math.hypot(fn[t * 3], fn[t * 3 + 1], fn[t * 3 + 2]) || 1;
  for (let t = 0; t < triCount; t++) {
    const lt = len(t);
    const tx = fn[t * 3] / lt, ty = fn[t * 3 + 1] / lt, tz = fn[t * 3 + 2] / lt;
    for (let k = 0; k < 3; k++) {
      const v = indices[t * 3 + k];
      let sx = 0, sy = 0, sz = 0;
      for (let j = counts[v]; j < counts[v + 1]; j++) {
        const o = adj[j];
        const lo = len(o);
        const d = (fn[o * 3] * tx + fn[o * 3 + 1] * ty + fn[o * 3 + 2] * tz) / lo;
        if (d >= cosC) { sx += fn[o * 3]; sy += fn[o * 3 + 1]; sz += fn[o * 3 + 2]; }
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      nrm[t * 9 + k * 3] = sx / l; nrm[t * 9 + k * 3 + 1] = sy / l; nrm[t * 9 + k * 3 + 2] = sz / l;
    }
  }
  return { pos, nrm };
}

export class Viewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.background = new THREE.Color(0x15171c);

    this.camera = new THREE.PerspectiveCamera(32, 1, 1, 4000);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(-260, -420, 260);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0, 80);
    this.controls.maxPolarAngle = Math.PI * 0.52;

    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(-180, -260, 420);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -200, right: 200, top: 200, bottom: -200, near: 50, far: 1200 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.6;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x9db8ff, 0.5);
    fill.position.set(300, -120, 150);
    this.scene.add(fill);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x303038, 0.35));

    this.bed = new THREE.Group();
    this.scene.add(this.bed);
    this.setBed(220);

    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.materialName = 'gold';
    this.colorByPart = false;
    this.wire = false;
    this.autoRotate = false;
    this.bodies = [];

    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    const loop = () => { this.controls.autoRotate = this.autoRotate; this.controls.autoRotateSpeed = 1.6; this.controls.update(); this.renderer.render(this.scene, this.camera); requestAnimationFrame(loop); };
    loop();
  }

  setBed(size) {
    this.bed.clear();
    if (!size) return;
    const plate = new THREE.Mesh(new THREE.CircleGeometry(size * 0.62, 96), new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 1, metalness: 0.0, envMapIntensity: 0.04 }));
    plate.position.z = -0.05;
    plate.receiveShadow = true;
    this.bed.add(plate);
    const grid = new THREE.GridHelper(size, 22, 0x3a3f4b, 0x2a2e38);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = 0;
    this.bed.add(grid);
    const sq = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(size, size)), new THREE.LineBasicMaterial({ color: 0x5b6173 }));
    sq.position.z = 0.02;
    this.bed.add(sq);
  }

  resize() {
    const p = this.canvas.parentElement;
    const w = p.clientWidth, h = p.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
  }

  materialFor(group) {
    const base = MATERIALS[this.materialName];
    const color = this.colorByPart ? GROUP_COLORS[group] ?? base.color : base.color;
    const m = this.colorByPart ? { metalness: 0.5, roughness: 0.45 } : base;
    return new THREE.MeshStandardMaterial({ color, metalness: m.metalness, roughness: m.roughness, wireframe: this.wire, side: THREE.DoubleSide });
  }

  setBodies(bodies) {
    this.bodies = bodies;
    for (const c of [...this.group.children]) { c.geometry.dispose(); c.material.dispose(); this.group.remove(c); }
    for (const b of bodies) {
      const { pos, nrm } = creaseGeometry(b.positions, b.indices);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      const mesh = new THREE.Mesh(g, this.materialFor(b.group));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.group = b.group;
      this.group.add(mesh);
    }
  }

  refreshMaterials() {
    for (const m of this.group.children) { m.material.dispose(); m.material = this.materialFor(m.userData.group); }
  }

  bbox() {
    const box = new THREE.Box3().setFromObject(this.group);
    return box;
  }

  frame(view = 'iso', animate = false) {
    const box = this.bbox();
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z * 0.62) * 1.0;
    const dist = (r / Math.tan((this.camera.fov * Math.PI) / 360)) * 0.95 + 120;
    const dirs = {
      iso: [-0.55, -1, 0.5], front: [0, -1, 0.06], side: [1, 0, 0.06], back: [0, 1, 0.06], top: [0.0001, -0.0001, 1],
    };
    const d = new THREE.Vector3(...dirs[view]).normalize().multiplyScalar(dist);
    this.controls.target.set(c.x, c.y, c.z * 0.96);
    this.camera.position.copy(this.controls.target).add(d);
    this.controls.update();
  }

  snapshot() { return this.canvas.toDataURL('image/png'); }
}

/** Small offscreen renderer for option thumbnails. */
export class ThumbRenderer {
  constructor(size = 160) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size * 2;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setSize(size * 2, size * 2, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-120, -200, 260);
    this.scene.add(key);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444450, 0.4));
    this.camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
    this.camera.up.set(0, 0, 1);
    this.mat = new THREE.MeshStandardMaterial({ color: 0xd9ac3c, metalness: 0.9, roughness: 0.32, side: THREE.DoubleSide });
  }

  render(bodies, { dir = [-0.5, -1, 0.45], fill = 1 } = {}) {
    const group = new THREE.Group();
    for (const b of bodies) {
      const { pos, nrm } = creaseGeometry(b.positions, b.indices);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      group.add(new THREE.Mesh(g, this.mat));
    }
    this.scene.add(group);
    const box = new THREE.Box3().setFromObject(group);
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    const r = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z) / 2;
    const dist = (r / Math.sin((this.camera.fov * Math.PI) / 360)) * fill * 1.04;
    this.camera.position.copy(c).add(new THREE.Vector3(...dir).normalize().multiplyScalar(dist));
    this.camera.lookAt(c);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    const url = this.canvas.toDataURL('image/webp', 0.88);
    this.scene.remove(group);
    group.children.forEach((m) => m.geometry.dispose());
    return url;
  }
}

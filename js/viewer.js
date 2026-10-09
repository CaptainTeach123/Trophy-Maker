// three.js viewer (Z-up, like slicers). Shows the same meshes that get exported.
import * as THREE from 'three';
import { OrbitControls, RoomEnvironment } from 'three';

export const MATERIALS = {
  gold: { color: 0xd9ac3c, metalness: 0.92, roughness: 0.3 },
  silver: { color: 0xd8dde4, metalness: 0.95, roughness: 0.28 },
  bronze: { color: 0xb87333, metalness: 0.88, roughness: 0.38 },
  white: { color: 0xeeeeee, metalness: 0.0, roughness: 0.65 },
  black: { color: 0x25262b, metalness: 0.4, roughness: 0.35 },
};
const GROUP_COLORS = { base: 0x6d7a96, column: 0xc9a14a, topper: 0xd9ac3c, plaque: 0x8a5a3c, plaqueText: 0xf0e6c8, extra: 0x5fb37c, trophy: 0xd9ac3c };

export class Viewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false; // the shadow only depends on the model: redraw it when the model changes
    this.renderer.shadowMap.needsUpdate = true;
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
    key.shadow.mapSize.set(1536, 1536);
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
    this.controls.autoRotateSpeed = 1.6;
    this.controls.addEventListener('change', () => this.requestRender());
    this.requestRender();
  }

  /** Draw on demand: zero CPU/GPU while nothing moves. Keeps running only while the camera is settling or spinning. */
  requestRender() {
    if (this._raf || this._compiling) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this.controls.autoRotate = this.autoRotate;
      const moving = this.controls.update(); // fires 'change' (-> another frame) while damping/auto-rotating
      this.renderer.render(this.scene, this.camera);
      if (this.autoRotate || moving) this.requestRender();
    });
  }

  setBed(size) {
    this.bed.clear();
    this.requestRender();
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
    this.requestRender();
  }

  materialFor(group) {
    const base = MATERIALS[this.materialName];
    const color = this.colorByPart ? GROUP_COLORS[group] ?? base.color : base.color;
    const m = this.colorByPart ? { metalness: 0.5, roughness: 0.45 } : base;
    return new THREE.MeshStandardMaterial({ color, metalness: m.metalness, roughness: m.roughness, wireframe: this.wire, side: THREE.DoubleSide });
  }

  /** bodies: [{ group, pos, nrm }] — typed arrays prepared (and normals smoothed) in the worker */
  setBodies(bodies) {
    this.bodies = bodies;
    for (const c of [...this.group.children]) { c.geometry.dispose(); c.material.dispose(); this.group.remove(c); }
    for (const b of bodies) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(b.nrm, 3));
      const mesh = new THREE.Mesh(g, this.materialFor(b.group));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.group = b.group;
      this.group.add(mesh);
    }
    this.renderer.shadowMap.needsUpdate = true;
    if (!this._compiled) {
      // first model: compile the shaders with the browser's parallel-compile support so the page stays responsive
      // (falls back to a synchronous compile where the extension is missing)
      this._compiled = true;
      this._compiling = this.renderer.compileAsync(this.scene, this.camera).catch(() => {}).then(() => { this._compiling = null; this.requestRender(); });
    }
    this.requestRender();
  }

  refreshMaterials() {
    for (const m of this.group.children) { m.material.dispose(); m.material = this.materialFor(m.userData.group); }
    this.requestRender();
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
    this.requestRender();
  }

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

  /** bodies: [{ pos, nrm }] prepared by the worker */
  render(bodies, { dir = [-0.5, -1, 0.45], fill = 1 } = {}) {
    const group = new THREE.Group();
    for (const b of bodies) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(b.nrm, 3));
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

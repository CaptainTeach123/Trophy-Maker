// Entry for the tree-shaken three.js bundle (vendor/three/three.bundle.js). Only what the viewer uses is listed,
// so esbuild can drop the other ~90% of the library. Add a name here if viewer.js starts using a new class.
export {
  ACESFilmicToneMapping, Box3, BufferAttribute, BufferGeometry, CircleGeometry, Color, DirectionalLight, DoubleSide,
  EdgesGeometry, GridHelper, Group, HemisphereLight, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial,
  PCFShadowMap, PMREMGenerator, PerspectiveCamera, PlaneGeometry, Scene, Vector3, WebGLRenderer,
} from 'three';
export { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
export { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

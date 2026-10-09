// Rebuilds the minified, tree-shaken three.js bundle.   npm i -D three esbuild && node tools/build-vendor.mjs
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await build({
  entryPoints: [path.join(root, 'tools/three-entry.js')],
  outfile: path.join(root, 'vendor/three/three.bundle.js'),
  bundle: true, minify: true, format: 'esm', target: 'es2020', legalComments: 'none',
  banner: { js: '/* three.js (MIT) tree-shaken bundle — see vendor/three/LICENSE. Rebuild with tools/build-vendor.mjs */' },
});
console.log('built vendor/three/three.bundle.js');

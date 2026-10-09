# 🏆 Trophy Maker

A browser-based trophy designer that exports **clean, watertight STL files** for 3D printing.
Mix and match bases, columns, toppers and plaques, add your own text, fonts and STL models, weld on ornate
details — and download one fused solid (or a ZIP of separate parts for multi-colour prints).

It is a plain static site: no build step, no server, no accounts. Everything runs in your browser and nothing you
upload ever leaves it.

## Features

| | |
|---|---|
| **16 bases** | classic block, soft block, moulded plinth, two-tier, stepped pyramid, sloped plinth, desk wedge, winners podium (1-2-3), round disc, oval, round tiered, flared pedestal, hexagon, stepped hexagon, octagon, octagon plinth |
| **10 columns** | none, cylinder, collared, tapered, turned baluster, knop stem, hexagonal, square pillar, twisted, fluted Doric, ringed pillar |
| **25 toppers** | classic cup, loving cup & lid, goblet, faceted star, ringed star, laurel star, laurel wreath, winged star, winged orb, royal crown, victory figure, heart, lightning bolt, soccer ball, basketball, football, golf ball & tee, graduation cap, torch, rocket, medallion, crest shield, gear, gem, obelisk — plus **Custom Text** and **Your STL** |
| **10 plaque shapes** | rectangle, rounded, cut corners, pill, arched top, oval, shield, ribbon banner, long hexagon, scooped corners — mounted on the base (flat, sloped, or **curved around round bases**), as a separate printable piece, or off |
| **Text & fonts** | 18 bundled fonts (OFL), or upload any **TTF / OTF / WOFF**. Raised or engraved, auto-fitted to the plate, adjustable depth and "thicken" for delicate script fonts |
| **Ornate details** | beaded rims, corner finials (urn / ball / spike / cone / pyramid), ball or block feet, collar rings, acanthus leaf wrap, rear wings, star halo, plaque borders (single/double), rivets, side scrolls, laurel sprigs |
| **Extras** | drop extra text or your own **STL models** onto any face (front, back, left, right, top, column, plaque…), then **weld**, **engrave** or keep **separate** |
| **Presets** | 12 ready-made trophies to start from, plus a 🎲 random generator |
| **Export** | single welded binary STL, or a ZIP of non-overlapping parts (base / column / topper / plaque / text) positioned as assembled. Optional scale-to-height and 3 smoothness levels |
| **Share** | copy a link that encodes your whole design, or save/load a `.json` |

### Why the STLs are clean

Geometry is built with [Manifold](https://github.com/elalish/manifold), a robust mesh-boolean kernel (WebAssembly).
Every part is a closed, correctly oriented solid and every weld is a real boolean union, so there are no
internal faces, flipped normals, gaps or self-intersections. The status bar shows **✓ Watertight** only when every body
in the export is a valid manifold. Parts are deliberately overlapped by a fraction of a millimetre where they meet (never
just touching), so a welded trophy is **one connected solid** with no floating islands, internal voids or zero-volume
slivers — the tests below assert exactly that on every preset and hundreds of random combinations.

**Uploading your own STL?** If it is watertight it is welded into the trophy like any other part. If it has holes
or non-manifold edges it can't be fused safely, so it's exported as its own separate shell and you get a warning.

## Using it

1. Pick a preset on **Start**, or build from scratch: **Base → Column → Topper → Plaque**.
2. **Details** adds the ornate welded extras. **Extras** adds your own text/STL anywhere.
3. **Export** → download. Units are millimetres, Z-up, sitting flat on the bed.

Printing tips: print upright; text depth ≥ 0.8 mm and letters ≥ 4 mm tall print well on a 0.4 mm nozzle; use
"Thicken" for script fonts; columns and cups print without supports.

## Deploying to GitHub Pages

This repo is already a deployable static site.

* **Easiest:** Settings → Pages → *Deploy from a branch* → choose your branch and `/ (root)`.
* **Or** use the included workflow (`.github/workflows/pages.yml`): Settings → Pages → Source: **GitHub Actions**.
  It runs the geometry tests and publishes on every push to `main`.

Run locally: `python3 -m http.server` (or any static server) and open <http://localhost:8000>.
Opening `index.html` straight from disk won't work — ES modules and WASM need `http://`.

## How it stays fast

* **Geometry runs in a Web Worker.** The page never freezes: dragging a slider keeps the preview responsive while the
  worker rebuilds, and edits made mid-build are coalesced into one follow-up build.
* **Only what changed is rebuilt.** Base, column, topper and plaque solids are cached by their parameters (raised
  plaque text is fused into its plate inside that cache), so editing a plaque name or resizing a topper doesn't redo
  the rest. Typical edits take 60–150 ms in the worker.
* **Cheap primitives.** Tubes (handles, arches, stems) are swept meshes rather than chains of boolean unions
  (~25× faster), and tessellation is tuned to chord errors well below a print layer.
* **Render on demand.** The preview draws only when something moves or changes (0% CPU/GPU idle); the shadow map is
  re-rendered only when the model changes. Smoothed normals are computed in the worker.
* **Small payload.** three.js is a tree-shaken, minified bundle (570 KB → 143 KB gzip); opentype.js is the minified
  build; fflate loads only for ZIP exports and share links; fonts load on demand; option thumbnails are pre-rendered
  WebP. First load is about 1.8 MB raw / 0.6 MB gzip.

## Project layout

```
index.html            page shell (starts the worker immediately, in parallel with the UI modules)
css/style.css
js/main.js            UI thread: state, viewer, actions, persistence, share links
js/ui.js              panels and controls            js/viewer.js   three.js preview + thumbnail renderer
js/engine.js          promise-based RPC to the worker js/thumbs.js   option-card thumbnails
js/state.js           design state + defaults        js/presets.js  full-trophy presets
js/catalog.js         GENERATED id/name lists for the UI (tools/gen-catalog.mjs)
js/worker.js          geometry worker: build, STL import/export, fonts
js/builder.js         state -> watertight solids (stacking, plaque mount, extras, weld/parts, caching)
js/kernel.js          Manifold wrapper: scoped memory management, tubes, lathes, dust cleanup
js/text.js            text -> 2D outlines (opentype.js)   js/stl.js  STL import (weld) / export
js/normals.js         crease-aware smooth normals
js/parts/             bases.js columns.js toppers.js plaques.js ornaments.js  ← add new options here
vendor/               manifold-3d, three.js bundle, opentype.js, fflate (see THIRD_PARTY.md)
fonts/                bundled OFL fonts            thumbs/   pre-rendered option previews
tests/                smoke.mjs, connected.mjs, fuzz.mjs
tools/                gen-thumbs.mjs, gen-catalog.mjs, build-vendor.mjs
```

### Adding a part

Each part type is a list of `{ id, name, build }` entries. For example a new topper in `js/parts/toppers.js`:

```js
{ id: 'pyramid', name: 'Pyramid', build: (s) => polyLathe([[0.3 * s, 0], [0, s]], 4, { rot: 45 }) }
```

`s` is the requested height in mm; return a Manifold standing on `z = 0`, centred on the origin, facing `-Y`.
Then run `npm run catalog` (updates the UI's id/name list), `npm run thumbs` (renders its preview, needs Playwright) and
`npm test` (watertight, one connected solid, catalogue and thumbnails up to date).

## Tests

```
node tests/smoke.mjs       # every base / column / topper / plaque / ornament builds a valid solid (+ thumbnails exist)
node tests/connected.mjs   # every preset/option exports as ONE connected solid: no floating bits, voids or slivers
node tests/fuzz.mjs 100    # 100 random combinations incl. extras, parts mode, scaling, connectivity
node tools/gen-catalog.mjs # regenerate js/catalog.js after adding/renaming a part
node tools/gen-thumbs.mjs  # regenerate the option-card previews in /thumbs (needs playwright) after changing geometry
node tools/build-vendor.mjs# rebuild the minified three.js bundle (npm i -D three esbuild)
```

## License

MIT for the code (see `LICENSE`). Bundled libraries and fonts keep their own licenses — see `THIRD_PARTY.md` and
`fonts/LICENSES.txt`.

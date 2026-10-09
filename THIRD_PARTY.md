# Third-party software

Everything is vendored into `vendor/` and `fonts/` so the site works from any static host with no build step and no
runtime CDN dependency.

| Component | Version | License | Used for |
|-----------|---------|---------|----------|
| [manifold-3d](https://github.com/elalish/manifold) | 3.5.4 | Apache-2.0 | WASM boolean/CSG kernel — guarantees watertight solids |
| [three.js](https://threejs.org) | r186 | MIT | 3D preview (tree-shaken, minified bundle built by `tools/build-vendor.mjs`) |
| [opentype.js](https://opentype.js.org) | 2.0.0 | MIT | Reading TTF/OTF/WOFF fonts and glyph outlines (minified build) |
| [fflate](https://github.com/101arrowz/fflate) | 0.8.3 | MIT | ZIP export and share-link compression |
| Fonts (Cinzel, Playfair Display, Oswald, …) | — | SIL OFL 1.1 | Plaque / topper lettering — see `fonts/LICENSES.txt` |

Each vendored library keeps its own `LICENSE` file next to it.

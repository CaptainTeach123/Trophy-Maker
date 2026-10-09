// Pure data: the design state, its defaults and the list of anchors. No geometry code, so the UI can load it instantly.
export function defaultState() {
  return {
    base: { style: 'plinth', width: 90, depth: 90, height: 42, edge: 1, corner: 0 },
    column: { style: 'baluster', height: 44, radius: 9 },
    topper: { style: 'cup', size: 100, text: '1', font: 'bebas', embolden: 0, backing: true, stlId: null, rx: 0, ry: 0, rz: 0 },
    plaque: {
      style: 'rounded', mount: 'front', width: 64, height: 18, thickness: 3, bevel: 0.8, textMode: 'raise', textDepth: 1,
      embolden: 0, tilt: 0, lineGap: 0.55, textAlign: 'center',
      lines: [
        { text: 'WORLD CHAMPION', font: 'cinzel', size: 5.5 },
        { text: 'First Place · 2026', font: 'cinzel', size: 3.8 },
      ],
    },
    orn: {
      base: { beadsTop: false, beadsFoot: false, beadSize: 1.7, beadSpacing: 5.5, finials: false, finialStyle: 'urn', finialSize: 11, feet: false, footHeight: 6, footStyle: 'ball', podiumNumbers: true,
        beadShape: 'ball', cordTop: false, cordFoot: false, cordSize: 1.5, topPanel: false, panelInset: 4, panelHeight: 1.4,
        railTop: false, railFoot: false, railSize: 1.4, studRow: false, studZ: 0.5, studSize: 1.6, studSpacing: 7 },
      column: { collars: false, leaves: false, bands: 0, knob: false, knobSize: 1.5, capital: false, skirt: false },
      topper: { wings: false, wingSize: 0.42, wingHeight: 0.55, halo: false, haloSize: 0.3, haloStars: 7, rays: false, rayCount: 14, rayLength: 0.22, pedestal: false },
      plaque: { border: false, doubleBorder: false, borderWidth: 1, beadBorder: false, beadBorderSize: 1, studs: false, studStyle: 'ball', studSize: 1, scrolls: false, laurel: false },
    },
    extras: [],
    output: { mode: 'weld', splitText: false, scaleTo: 0, quality: 1 },
  };
}

export function newExtra(type = 'text', n = 1) {
  if (type === 'shape') return { id: Math.random().toString(36).slice(2, 8), type: 'shape', shape: 'star', size: 12, depth: 1.2, anchor: 'baseFront', orient: 'upright', ox: 0, oy: 0, oz: 0, rz: 0, mode: 'weld' };
  return type === 'text'
    ? { id: Math.random().toString(36).slice(2, 8), type: 'text', text: 'TEXT', font: 'cinzel', size: 8, depth: 1.2, embolden: 0, anchor: 'baseFront', orient: 'upright', ox: 0, oy: 0, oz: 0, rz: 0, mode: 'weld', align: 'center' }
    : { id: Math.random().toString(36).slice(2, 8), type: 'stl', assetId: null, anchor: 'topperTop', scale: 100, fitHeight: 0, ox: 0, oy: 0, oz: 0, rx: 0, ry: 0, rz: 0, mode: 'weld' };
}

export const ANCHORS = [
  ['baseFront', 'Base — front face'],
  ['baseBack', 'Base — back face'],
  ['baseLeft', 'Base — left face'],
  ['baseRight', 'Base — right face'],
  ['baseTop', 'Base — top surface'],
  ['column', 'Column — middle'],
  ['topperTop', 'Very top of the trophy'],
  ['plaqueFront', 'Plaque — front face'],
  ['floor', 'Print bed (0,0,0)'],
];

/** font ids a design needs loaded before it can be built */
export function fontsNeeded(state) {
  const ids = new Set(['cinzel']);
  if (state.topper.style === 'text') ids.add(state.topper.font);
  state.plaque.lines.forEach((l) => ids.add(l.font));
  state.extras.forEach((e) => e.type === 'text' && ids.add(e.font));
  if (state.base.style === 'podium') ids.add('anton');
  return [...ids];
}

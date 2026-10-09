// Font catalogue (no font parsing here, so the main thread never loads opentype.js).
export const BUILTIN_FONTS = [
  { id: 'cinzel', name: 'Cinzel Bold — Roman capitals', file: 'Cinzel_700Bold.ttf' },
  { id: 'cinzelDeco', name: 'Cinzel Decorative — ornate caps', file: 'CinzelDecorative_700Bold.ttf' },
  { id: 'playfair', name: 'Playfair Display Bold — classic serif', file: 'PlayfairDisplay_700Bold.ttf' },
  { id: 'abril', name: 'Abril Fatface — fat didone', file: 'AbrilFatface_400Regular.ttf' },
  { id: 'robotoSlab', name: 'Roboto Slab Bold — slab serif', file: 'RobotoSlab_700Bold.ttf' },
  { id: 'alfa', name: 'Alfa Slab One — heavy slab', file: 'AlfaSlabOne_400Regular.ttf' },
  { id: 'oswald', name: 'Oswald Bold — condensed sans', file: 'Oswald_700Bold.ttf' },
  { id: 'bebas', name: 'Bebas Neue — sports caps', file: 'BebasNeue_400Regular.ttf' },
  { id: 'anton', name: 'Anton — heavy condensed', file: 'Anton_400Regular.ttf' },
  { id: 'bungee', name: 'Bungee — block display', file: 'Bungee_400Regular.ttf' },
  { id: 'russo', name: 'Russo One — modern sports', file: 'RussoOne_400Regular.ttf' },
  { id: 'orbitron', name: 'Orbitron Bold — sci-fi', file: 'Orbitron_700Bold.ttf' },
  { id: 'blackops', name: 'Black Ops One — stencil', file: 'BlackOpsOne_400Regular.ttf' },
  { id: 'rye', name: 'Rye — western', file: 'Rye_400Regular.ttf' },
  { id: 'fraktur', name: 'UnifrakturCook — blackletter', file: 'UnifrakturCook_700Bold.ttf' },
  { id: 'greatVibes', name: 'Great Vibes — formal script', file: 'GreatVibes_400Regular.ttf' },
  { id: 'pacifico', name: 'Pacifico — casual script', file: 'Pacifico_400Regular.ttf' },
  { id: 'lobster', name: 'Lobster — bold script', file: 'Lobster_400Regular.ttf' },
];

const customFonts = []; // {id, name}
export function listFonts() { return [...BUILTIN_FONTS, ...customFonts]; }
export function addCustomFontMeta(id, name) { if (!customFonts.some((f) => f.id === id)) customFonts.push({ id, name: name + ' (uploaded)' }); }
export function nextCustomFontId(name) { return 'custom:' + name + ':' + customFonts.length; }

// Ready-made trophy recipes: each is a patch applied on top of the default state.
import { defaultState } from './state.js';

const merge = (target, patch) => {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') merge(target[k], v);
    else target[k] = JSON.parse(JSON.stringify(v));
  }
  return target;
};
export const applyPatch = (patch) => merge(defaultState(), patch);

export const PRESETS = [
  {
    id: 'classic', name: 'Classic Champion', blurb: 'Loving-cup on a moulded plinth',
    patch: {
      base: { style: 'plinth', width: 92, depth: 92, height: 38 }, column: { style: 'baluster', height: 40, radius: 9 },
      topper: { style: 'cup', size: 105 }, plaque: { style: 'rounded' },
      orn: { base: { beadsTop: true }, column: { collars: true } },
    },
  },
  {
    id: 'star', name: 'Star Award', blurb: 'Faceted star on a stepped base',
    patch: {
      base: { style: 'tier3', width: 90, depth: 90, height: 40 }, column: { style: 'none' },
      topper: { style: 'star', size: 120 }, plaque: { style: 'rect', width: 64, height: 12 },
      orn: { base: { beadsFoot: true } },
    },
  },
  {
    id: 'podium', name: 'Podium MVP', blurb: '1-2-3 podium with a victory figure',
    patch: {
      base: { style: 'podium', width: 100, depth: 56, height: 46 }, column: { style: 'none' },
      topper: { style: 'figure', size: 78 }, plaque: { style: 'rect', width: 34, height: 16, mount: 'front', lines: [{ text: 'MVP', font: 'bebas', size: 7 }, { text: '2026', font: 'bebas', size: 4 }] },
    },
  },
  {
    id: 'soccer', name: 'Golden Ball', blurb: 'Soccer ball on a round pedestal',
    patch: {
      base: { style: 'round', width: 86, height: 34 }, column: { style: 'collared', height: 26, radius: 8 },
      topper: { style: 'soccer', size: 92 }, plaque: { style: 'stadium', width: 58, height: 18, lines: [{ text: 'TOP SCORER', font: 'bebas', size: 7 }, { text: 'Season 2026', font: 'bebas', size: 4 }] },
      orn: { base: { beadsTop: true } },
    },
  },
  {
    id: 'royal', name: 'Royal Crown', blurb: 'Ornate crown with urn finials',
    patch: {
      base: { style: 'oct2', width: 90, height: 40 }, column: { style: 'knop', height: 34, radius: 9 },
      topper: { style: 'crown', size: 92 }, plaque: { style: 'banner', width: 60, height: 20, lines: [{ text: 'HIGH KING', font: 'cinzelDeco', size: 5.5 }] },
      orn: { base: { beadsTop: true, finials: true, finialStyle: 'urn', finialSize: 12 }, column: { collars: true }, plaque: { border: true, studs: true } },
    },
  },
  {
    id: 'laurel', name: 'Laurel of Honour', blurb: 'Laurel wreath and fluted column',
    patch: {
      base: { style: 'block', width: 84, depth: 84, height: 34 }, column: { style: 'fluted', height: 36, radius: 9 },
      topper: { style: 'laurelStar', size: 110 }, plaque: { style: 'arch', width: 46, height: 26, lines: [{ text: 'HONOUR', font: 'cinzel', size: 6 }, { text: 'EXCELLENCE', font: 'cinzel', size: 3.4 }] },
      orn: { plaque: { laurel: true }, column: { leaves: true } },
    },
  },
  {
    id: 'wings', name: 'Victory Wings', blurb: 'Winged star on a twisted column',
    patch: {
      base: { style: 'hexTier', width: 84, height: 42 }, column: { style: 'twist', height: 48, radius: 8 },
      topper: { style: 'wingedStar', size: 96 }, plaque: { style: 'hex', width: 40, height: 14, lines: [{ text: 'VICTORY', font: 'cinzel', size: 5.5 }] },
      orn: { base: { beadsTop: true } },
    },
  },
  {
    id: 'scholar', name: 'Scholar', blurb: 'Graduation cap on a desk wedge',
    patch: {
      base: { style: 'wedge', width: 96, depth: 60, height: 34 }, column: { style: 'none' },
      topper: { style: 'gradcap', size: 74 },
      plaque: { style: 'rounded', width: 74, height: 16, lines: [{ text: 'CLASS OF 2026', font: 'playfair', size: 5 }, { text: 'Bachelor of Arts', font: 'playfair', size: 3.2 }] },
    },
  },
  {
    id: 'tech', name: 'Tech Gear', blurb: 'Gear on a sloped plinth',
    patch: {
      base: { style: 'slope', width: 90, depth: 70, height: 40 }, column: { style: 'ringed', height: 24, radius: 7 },
      topper: { style: 'gear', size: 86 },
      plaque: { style: 'chamfer', width: 54, height: 18, lines: [{ text: 'INNOVATOR', font: 'orbitron', size: 5.2 }, { text: 'of the year', font: 'orbitron', size: 3 }] },
    },
  },
  {
    id: 'loving', name: 'Grand Loving Cup', blurb: 'Lidded urn on ball feet — all the trimmings',
    patch: {
      base: { style: 'rounded', width: 96, depth: 96, height: 34 }, column: { style: 'collared', height: 20, radius: 8 },
      topper: { style: 'lovingCup', size: 118 },
      plaque: { style: 'cartouche', width: 72, height: 24, lines: [{ text: 'GRAND CHAMPION', font: 'cinzelDeco', size: 5.2 }, { text: 'Best in Show', font: 'greatVibes', size: 5.5 }] },
      orn: { base: { beadsTop: true, feet: true, footStyle: 'ball', finials: true, finialStyle: 'ball', finialSize: 9 }, plaque: { border: true, studs: true, scrolls: true } },
    },
  },
  {
    id: 'hoops', name: 'Hoops Champ', blurb: 'Basketball on an oval base',
    patch: {
      base: { style: 'oval', width: 100, depth: 66, height: 30 }, column: { style: 'cylinder', height: 22, radius: 7 },
      topper: { style: 'basketball', size: 88 }, plaque: { style: 'rounded', width: 66, height: 18, lines: [{ text: 'LEAGUE CHAMPIONS', font: 'oswald', size: 5.2 }, { text: '2026', font: 'oswald', size: 3.6 }] },
    },
  },
  {
    id: 'space', name: 'Rocket Launch', blurb: 'Rocket on a round tiered base',
    patch: {
      base: { style: 'roundTier', width: 86, height: 36 }, column: { style: 'none' },
      topper: { style: 'rocket', size: 120 }, plaque: { style: 'oval', width: 56, height: 20, lines: [{ text: 'MISSION', font: 'orbitron', size: 5 }, { text: 'ACCOMPLISHED', font: 'orbitron', size: 3 }] },
    },
  },
];

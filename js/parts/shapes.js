// Flat 2D shapes for "Shape" extras (badges, stars, rings…). cross(size) -> CrossSection centred on the origin, `size` mm tall.
import { polys, regularPoly, starPoly } from '../kernel.js';

const arc = (n, fn) => Array.from({ length: n }, (_, i) => fn((i / n) * Math.PI * 2));
const heart = (k) => arc(72, (t) => [16 * Math.pow(Math.sin(t), 3) * k, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) + 2) * k]);

export const SHAPES = [
  { id: 'circle', name: 'Disc', cross: (s) => polys([regularPoly(64, s / 2, 0)]) },
  { id: 'ring', name: 'Ring', cross: (s) => polys([regularPoly(64, s / 2, 0)]).subtract(polys([regularPoly(64, s * 0.36, 0)])) },
  { id: 'star', name: 'Star', cross: (s) => polys([starPoly(5, s / 1.9, s / 1.9 * 0.42)]) },
  { id: 'star6', name: '6-point Star', cross: (s) => polys([starPoly(6, s / 2, s / 2 * 0.55)]) },
  { id: 'burst', name: 'Starburst', cross: (s) => polys([starPoly(14, s / 2, s / 2 * 0.78)]) },
  { id: 'heart', name: 'Heart', cross: (s) => polys([heart(s / 30)]) },
  { id: 'diamond', name: 'Diamond', cross: (s) => polys([[[0, -s / 2], [s * 0.34, 0], [0, s / 2], [-s * 0.34, 0]]]) },
  { id: 'triangle', name: 'Triangle', cross: (s) => polys([regularPoly(3, s / 1.5, 90)]).translate([0, -s / 6]) },
  { id: 'square', name: 'Rounded Square', cross: (s) => polys([arc(80, (t) => { const c = Math.cos(t), si = Math.sin(t), p = 4; return [Math.sign(c) * Math.pow(Math.abs(c), 2 / p) * s / 2, Math.sign(si) * Math.pow(Math.abs(si), 2 / p) * s / 2]; })]) },
  { id: 'hexagon', name: 'Hexagon', cross: (s) => polys([regularPoly(6, s / 2, 0)]) },
  { id: 'octagon', name: 'Octagon', cross: (s) => polys([regularPoly(8, s / 2, 22.5)]) },
  { id: 'cross', name: 'Cross', cross: (s) => { const a = s / 2, b = s * 0.17; return polys([[[-b, -a], [b, -a], [b, -b], [a, -b], [a, b], [b, b], [b, a], [-b, a], [-b, b], [-a, b], [-a, -b], [-b, -b]]]); } },
  { id: 'shield', name: 'Shield', cross: (s) => polys([[[-s * 0.4, s / 2], [s * 0.4, s / 2], [s * 0.4, s * 0.1], [s * 0.3, -s * 0.2], [0, -s / 2], [-s * 0.3, -s * 0.2], [-s * 0.4, s * 0.1]]]) },
  { id: 'bolt', name: 'Lightning Bolt', cross: (s) => polys([[[s * 0.08, s / 2], [-s * 0.3, -s * 0.06], [-s * 0.02, -s * 0.06], [-s * 0.12, -s / 2], [s * 0.3, s * 0.1], [s * 0.02, s * 0.1]]]) },
  { id: 'crescent', name: 'Crescent', cross: (s) => polys([regularPoly(72, s / 2, 0)]).subtract(polys([regularPoly(72, s * 0.4, 0)]).translate([s * 0.2, s * 0.06])) },
  { id: 'arrow', name: 'Arrow', cross: (s) => polys([[[-s * 0.16, -s / 2], [s * 0.16, -s / 2], [s * 0.16, s * 0.1], [s * 0.4, s * 0.1], [0, s / 2], [-s * 0.4, s * 0.1], [-s * 0.16, s * 0.1]]]) },
  { id: 'check', name: 'Check Mark', cross: (s) => polys([[[-s * 0.45, -s * 0.02], [-s * 0.3, -s * 0.17], [-s * 0.1, s * 0.03], [s * 0.3, -s * 0.4], [s * 0.45, -s * 0.25], [-s * 0.1, s * 0.33]]]) },
  { id: 'bar', name: 'Divider Bar', cross: (s) => polys([arc(48, (t) => [Math.sign(Math.cos(t)) * (Math.abs(Math.cos(t)) ** 0.35) * s * 1.5, Math.sin(t) * s * 0.07])]) },
];
export function getShape(id) { return SHAPES.find((x) => x.id === id) || SHAPES[0]; }

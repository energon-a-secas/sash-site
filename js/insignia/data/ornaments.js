/**
 * Original local vector ornaments. Drawn from these geometric descriptions,
 * without reference artwork, by Codex on 2026-09-24. Same 24-unit field as the
 * Lucide glyphs; no remote assets, markup parsing or additional dependencies.
 *
 * laurel: two mirrored quadratic stems from (12,22) to (6,3), each with five
 * closed, pointed leaves. laurel-star adds a five-point star between the stems.
 * compass-rose: four long and four short triangular rays about (12,12).
 * orbital: three ellipses rotated by 60 degrees around one central disc.
 * quatrefoil: four circular lobes around (12,12), with an inset diamond.
 */
const path = (d, extra = {}) => ({ t: 'path', d, 'stroke-width': '1', ...extra });
const branch = [
  path('M12 22 Q3 17 6 3', { nofill: true }),
  path('M6 6 Q2 6 3 2 Q7 3 6 6 Z'),
  path('M5.1 9.5 Q1 9 1.8 5.8 Q5.6 6.2 5.1 9.5 Z'),
  path('M5.2 13 Q1 12.8 1.5 9.5 Q5.3 10 5.2 13 Z'),
  path('M6.5 16.6 Q2.1 17.1 2.2 13.6 Q6 13.4 6.5 16.6 Z'),
  path('M8.8 19.5 Q4.8 21 4 17.5 Q7.7 16.8 8.8 19.5 Z'),
];
const laurel = [...branch, ...branch.map(p => ({ ...p, transform: 'translate(24 0) scale(-1 1)' }))];
const star = path('M12 5.5 13.7 9 17.5 9.6 14.8 12.2 15.4 16 12 14.2 8.6 16 9.2 12.2 6.5 9.6 10.3 9 Z');

export const ORNAMENTS = {
  laurel,
  'laurel-star': [...laurel, star],
  'compass-rose': [
    { t: 'circle', cx: '12', cy: '12', r: '8.5', 'stroke-width': '0.7' },
    ...[0, 90, 180, 270].map(a => path('M12 1 14 10 12 12 10 10 Z', { transform: `rotate(${a} 12 12)` })),
    ...[45, 135, 225, 315].map(a => path('M12 5 13 10 12 12 11 10 Z', { transform: `rotate(${a} 12 12)` })),
  ],
  orbital: [
    ...[0, 60, 120].map(a => ({ t: 'ellipse', cx: '12', cy: '12', rx: '10', ry: '4',
      'stroke-width': '1', transform: `rotate(${a} 12 12)`, nofill: true })),
    { t: 'circle', cx: '12', cy: '12', r: '1.5', fill: 'currentColor', stroke: 'none' },
  ],
  quatrefoil: [
    path('M12 5 C16 -1 25 8 19 12 C25 16 16 25 12 19 C8 25 -1 16 5 12 C-1 8 8 -1 12 5 Z'),
    path('M12 7 17 12 12 17 7 12 Z'),
  ],
};

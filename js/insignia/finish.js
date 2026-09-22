/**
 * Insignia Kit: the badge body and its finish (C1.1 `palette.metal`, `finish`).
 *
 * Two call points, frozen by design round 2's plan (section 1.4):
 *
 *   drawBody(stage, defs, d, path)            the silhouette fill: the palette
 *                                             base, or the material paint plus
 *                                             its sheen when `palette.metal` is
 *                                             not `none`
 *   drawFinish(stage, defs, d, path, layer)   `'under'` draws bevel and facet
 *                                             beneath the rings; `'over'` draws
 *                                             gloss above everything but the
 *                                             provenance strip
 *
 * The material paint (round 2, finish-stack) replaces the flat three-stop metal
 * the kit shipped with: a six-stop gradient at an angle, with a second light
 * band at 0.62 that is the specular crossing the body, under a white radial
 * sheen at the upper left clipped to the silhouette. The three metal ids keep
 * their names and change their drawing, so an award stored with `metal: gold`
 * draws the new material on the site while a PNG already downloaded is
 * untouched. A plain base colour draws as it did, byte for byte.
 *
 * The finish is optional and additive. `none` draws nothing and emits no def,
 * so a design carrying the default serialises to the bytes it did before the
 * field existed (the additivity test in `tests/insignia.test.mjs` reads this).
 * `finish.strength` scales the finish's opacities; the prototype tiles the
 * round judged were drawn at the default 0.6, so that is the unit.
 *
 * Every def takes its id from `nextId(prefix)` (A12) and lives in `defs`,
 * never inline, so `inlineImages` and the serialiser see it. The silhouette
 * clip is made once per `defs` and shared by the sheen, the facets and the
 * gloss. Gradients on fills and strokes, `clipPath` and `radialGradient` all
 * rasterise through the data: SVG in an `<img>` in Chromium, WebKit and
 * Firefox; no lighting filter is used, because `feSpecularLighting` produced
 * nothing usable in any engine (plan, section 5).
 */
import { svgEl, n } from './patterns.js';
import { F, CX, CY, nextId } from './draw.js';
import { ringScale, about, bodyPath, mix, stopNodes, drawBevel } from './rings.js';

/* ── the materials (C7.9) ──────────────────────────────────────────────────── */

// Six stops on one curve: a light at the top, the body colour at the half,
// the specular band at 0.62, then the shade into the foot. Bronze follows the
// gold curve between its own light and dark.
const MATERIALS = {
  gold:   [[0, '#fff3c4'], [0.28, '#f0cc55'], [0.5, '#c8941a'], [0.62, '#f2d36b'], [0.85, '#9a6f10'], [1, '#5d4208']],
  silver: [[0, '#ffffff'], [0.28, '#e3e7ee'], [0.5, '#a9b1bd'], [0.62, '#eef1f5'], [0.85, '#7c8592'], [1, '#4b535e']],
  bronze: [[0, '#f7d9b8'], [0.28, '#dfa87a'], [0.5, '#b3762f'], [0.62, '#e2ad7c'], [0.85, '#7d4b16'], [1, '#4a2a0c']],
};

/** The material's stops, or null for `none` and any id the kit does not know. */
export function materialStops(metal) {
  return MATERIALS[metal] || null;
}

/** The default `finish.strength`; the opacities below are the look at this value. */
const STRENGTH_UNIT = 0.6;

/* ── the silhouette clip, once per defs ────────────────────────────────────── */

const CLIPS = new WeakMap();

/** The id of a `<clipPath>` holding the silhouette, made once per `defs` and shared. */
export function silhouetteClip(defs, path) {
  let byPath = CLIPS.get(defs);
  if (!byPath) { byPath = new Map(); CLIPS.set(defs, byPath); }
  if (!byPath.has(path)) {
    const id = nextId('clip');
    defs.appendChild(svgEl('clipPath', { id }, [svgEl('path', { d: path })]));
    byPath.set(path, id);
  }
  return byPath.get(path);
}

/* ── the body ──────────────────────────────────────────────────────────────── */

/**
 * The body: the silhouette, filled with the palette base or the material
 * paint, and under a metal the sheen. Appends to `stage`; returns nothing.
 */
export function drawBody(stage, defs, d, path) {
  const stops = materialStops(d.palette.metal);
  if (!stops) {
    stage.appendChild(svgEl('path', { d: path, fill: d.palette.base }));
    return;
  }
  const paint = nextId('metal');
  defs.appendChild(svgEl('linearGradient', {
    id: paint, x1: '0', y1: '0', x2: '1', y2: '1', gradientTransform: 'rotate(-20 0.5 0.5)' }, stopNodes(stops)));
  stage.appendChild(svgEl('path', { d: path, fill: `url(#${paint})` }));
  // The sheen: a white radial at the upper left over the whole field, clipped
  // to the silhouette, so the same light falls on every shape from one place.
  const sheen = nextId('sheen');
  defs.appendChild(svgEl('radialGradient', { id: sheen, cx: '0.32', cy: '0.22', r: '0.55' },
    stopNodes([[0, '#ffffff', 0.55], [0.5, '#ffffff', 0.08], [1, '#ffffff', 0]])));
  stage.appendChild(svgEl('rect', {
    x: '0', y: '0', width: n(F), height: n(F), fill: `url(#${sheen})`, 'clip-path': `url(#${silhouetteClip(defs, path)})` }));
}

/* ── the finish ────────────────────────────────────────────────────────────── */

/**
 * The finish layer named by `layer`: `'under'` (bevel, facet) or `'over'`
 * (gloss). Draws nothing while `finish.kind` is `none`. Appends to `stage`;
 * returns nothing.
 */
export function drawFinish(stage, defs, d, path, layer) {
  const { kind, strength } = d.finish;
  if (kind === 'none') return;
  const k = (Number.isFinite(strength) ? strength : STRENGTH_UNIT) / STRENGTH_UNIT;
  if (layer === 'under' && kind === 'bevel') drawBevelFinish(stage, defs, d, path, k);
  if (layer === 'under' && kind === 'facet') drawFacets(stage, defs, path, k);
  if (layer === 'over' && kind === 'gloss') drawGloss(stage, defs, path, k);
}

const alpha = (v, k) => n(Math.min(1, v * k));

/**
 * The bevel: the rim gradient stroked ten wide five in from the edge, the
 * hairline eleven in, and the edge itself outlined in the dark stop. On a
 * metal body the rim is that metal's light, body and dark; on a plain body it
 * is the accent, tinted and shaded, so an enamel pin gets a metal rim without
 * a metal body. The rim follows the body subpath; the outline, the whole edge.
 */
function drawBevelFinish(stage, defs, d, path, k) {
  const stops = materialStops(d.palette.metal);
  const [light, mid, dark] = stops
    ? [stops[0][1], stops[2][1], stops[5][1]]
    : [mix(d.palette.accent, '#ffffff', 0.55), d.palette.accent, mix(d.palette.accent, d.palette.ink, 0.55)];
  drawBevel(stage, defs, bodyPath(path), { inset: 5, width: 10, light, mid, dark, ink: d.palette.ink, k });
  stage.appendChild(svgEl('path', {
    d: path, fill: 'none', stroke: dark, 'stroke-width': '1.5', 'stroke-linejoin': 'round',
    'stroke-opacity': k >= 1 ? null : n(k), transform: about(ringScale(0)) }));
}

/**
 * The vertices of a silhouette made of `M` and `L` commands only, or null for
 * any other path: a facet is a flat plane, and a curved edge has none.
 */
export function polygonVertices(path) {
  const body = bodyPath(path);
  if (!/^M[\d\s.,\-L]*Z?$/.test(body)) return null;
  const pts = [...body.matchAll(/[ML]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  return pts.length >= 3 ? pts : null;
}

/**
 * Facets: one wedge per edge, from the centre of the field to the edge's two
 * vertices, light and dark in turn, clipped to the silhouette because a
 * re-entrant polygon (the star, the zigzag) has wedges that leave it.
 */
function drawFacets(stage, defs, path, k) {
  const pts = polygonVertices(path);
  if (!pts) return;
  const g = svgEl('g', { 'clip-path': `url(#${silhouetteClip(defs, path)})` });
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const light = i % 2 === 0;
    g.appendChild(svgEl('path', {
      d: `M${n(CX)} ${n(CY)} L${n(a[0])} ${n(a[1])} L${n(b[0])} ${n(b[1])} Z`,
      fill: light ? '#ffffff' : '#000000', 'fill-opacity': alpha(light ? 0.16 : 0.22, k) }));
  });
  stage.appendChild(g);
}

// The dome: the top of the field down to a curve that bottoms at 240 in the
// middle, which on every silhouette reads as the epoxy highlight of a pin.
const DOME = 'M20 20 H492 V210 C400 250 112 250 20 210 Z';

/** The gloss: the dome under a vertical white fade, clipped to the silhouette. */
function drawGloss(stage, defs, path, k) {
  const id = nextId('gloss');
  defs.appendChild(svgEl('linearGradient', { id, x1: '0', y1: '0', x2: '0', y2: '1' },
    stopNodes([[0, '#ffffff', Math.min(1, 0.38 * k)], [1, '#ffffff', Math.min(1, 0.04 * k)]])));
  stage.appendChild(svgEl('path', { d: DOME, fill: `url(#${id})`, 'clip-path': `url(#${silhouetteClip(defs, path)})` }));
}

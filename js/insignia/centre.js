/**
 * Insignia Kit: the centre mark (C1.1 `centre`).
 *
 * One call point, frozen by design round 2's plan (section 1.4):
 *
 *   drawCentre(stage, defs, d)   the glyph or the image, with every C1.1 field
 *
 * The mark is an inlay, never the badge: it sits under the arcs and the rings
 * are drawn before it, the provenance strip after it, so nothing here can
 * cover the band (C11.1). A glyph is Lucide line art scaled onto a
 * `176 * centre.scale` square centred on `256 + dx, 214 + dy`; an image is the
 * resolved art on the same square. An unresolved `imageRef` draws nothing,
 * plate included, rather than a broken frame (C10.3); an unknown glyph id
 * draws nothing rather than substituting one.
 *
 * Every field's default draws the bytes that shipped before the field existed
 * (the additivity group in `insignia.test.mjs`), so a def, a wrapper group or
 * an attribute appears only when the field is off its default:
 *
 *   style     glyph only: `line`, `bold` (stroke 2.6), `emboss` (a light copy
 *             at +3 +3 beneath), `duotone` (the closed paths filled at 0.22
 *             under the stroke; an open stroke marked `nofill` in glyphs.js
 *             is drawn but not tinted, since a fill closes it on a chord)
 *   fit       image only: `cover` is `xMidYMid slice`, `contain` is `meet`
 *   mask      image only: `circle`, `rounded` (rx 0.18 side), `shape` (the
 *             silhouette scaled by side / 472 about the mark's centre), `none`
 *   plate     both kinds: the mask outline 8 units larger (the circle when
 *             mask is `none`), `solid` in plateColor at 0.92 with a 3-unit
 *             accent ring, or `metal` in the material of palette.metal (gold
 *             when that is `none`) with a 2-unit ink edge. Drawn first.
 *   tone      image only: `mono` maps luminance from black to centre.color,
 *             `duotone` from palette.ink to toneColor. Alpha is untouched.
 *   rotation  degrees about the mark's centre. The transform goes on the
 *             image or the glyph group, never on the clip, so the mask
 *             stays put while the mark turns; a rotated image therefore
 *             sits in a `<g clip-path>` wrapper.
 *   opacity   on the mark, not the plate
 *   dx        sideways nudge; `dy` already existed
 *
 * Every filter, gradient and clipPath lives in `defs` under `nextId` (A12),
 * so `inlineImages` and the serialiser see it and a wall of badges cannot
 * share a def by accident. The tone filter interpolates in sRGB so a table
 * value is the colour it names; the README's export section records how each
 * engine rasterises it.
 */
import { svgEl, n, metalGradient } from './patterns.js';
import { shapePath } from './shapes.js';
import { GLYPHS, GLYPH_FIELD, glyphNode, glyphFillNode } from './glyphs.js';
import { CX, CENTRE_SIDE, CENTRE_Y, nextId, artUrl } from './draw.js';

/** The silhouettes are drawn to radius 236 on the 512 field, so `shape` scales this span to the mark's side. */
export const SHAPE_SPAN = 472;
const PLATE_GROW = 8, PLATE_RING = 3, PLATE_ALPHA = 0.92, PLATE_EDGE = 2, PLATE_EDGE_ALPHA = 0.45;
const EMBOSS_SHIFT = 3, EMBOSS_ALPHA = 0.45, DUOTONE_FILL = 0.22, BOLD_STROKE = 2.6;
/** Rec. 709 luminance, the row `feColorMatrix` folds every channel to. */
const LUMA_ROW = '0.2126 0.7152 0.0722 0 0';

const f3 = (v) => String(Math.round(v * 1000) / 1000);

/** `#rrggbb` to three 0..1 channels. The schema has already validated the form. */
function channels(hex) {
  const v = parseInt(String(hex).slice(1, 7), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => c / 255);
}

/**
 * The outline `mask` names, as one element centred on the mark: a circle (the
 * clip that shipped), a rounded square, the badge's own silhouette scaled
 * about the mark's centre, or null for `none`. `grow` widens it for the plate.
 * Returns `{ node, k }`, `k` being the scale the silhouette variant carries so
 * a stroke on it can be corrected back to field units.
 */
export function maskOutline(mask, { cx, cy, side, shape, grow = 0 }) {
  const s = side + grow * 2;
  if (mask === 'none') return { node: null, k: 1 };
  if (mask === 'rounded') {
    return { node: svgEl('rect', { x: n(cx - s / 2), y: n(cy - s / 2), width: n(s), height: n(s), rx: n(s * 0.18) }), k: 1 };
  }
  if (mask === 'shape') {
    const k = s / SHAPE_SPAN;
    const node = svgEl('path', { d: shapePath(shape), transform: `translate(${n(cx - CX * k)} ${n(cy - CX * k)}) scale(${n(k)})` });
    return { node, k };
  }
  return { node: svgEl('circle', { cx: n(cx), cy: n(cy), r: n(s / 2) }), k: 1 };
}

/**
 * The recolour filter for `tone`, or null for `full`. `feColorMatrix` folds
 * the image to luminance with the alpha row untouched, then
 * `feComponentTransfer` tables map luminance 0 to `dark` and 1 to `light` per
 * channel. Interpolation is pinned to sRGB so the table values are the colours
 * named, not their linear-light versions.
 */
export function toneFilter(tone, { dark, light, id }) {
  if (tone !== 'mono' && tone !== 'duotone') return null;
  const lo = channels(dark), hi = channels(light);
  const table = (i) => `${f3(lo[i])} ${f3(hi[i])}`;
  return svgEl('filter', { id, 'color-interpolation-filters': 'sRGB' }, [
    svgEl('feColorMatrix', { type: 'matrix', values: `${LUMA_ROW} ${LUMA_ROW} ${LUMA_ROW} 0 0 0 1 0` }),
    svgEl('feComponentTransfer', {}, [
      svgEl('feFuncR', { type: 'table', tableValues: table(0) }),
      svgEl('feFuncG', { type: 'table', tableValues: table(1) }),
      svgEl('feFuncB', { type: 'table', tableValues: table(2) }),
    ]),
  ]);
}

function rotateAbout(c, { cx, cy }) {
  return c.rotation === 0 ? null : `rotate(${n(c.rotation)} ${n(cx)} ${n(cy)})`;
}

/* ── the plate ─────────────────────────────────────────────────────────────── */

function drawPlate(stage, defs, d, geo) {
  const c = d.centre;
  if (c.plate === 'none') return;
  const mask = c.mask === 'none' ? 'circle' : c.mask;
  const { node, k } = maskOutline(mask, { ...geo, shape: d.shape, grow: PLATE_GROW });
  if (c.plate === 'metal') {
    const grad = metalGradient(d.palette.metal === 'none' ? 'gold' : d.palette.metal, nextId('plate'));
    if (!grad) return;
    defs.appendChild(grad);
    node.setAttribute('fill', `url(#${grad.getAttribute('id')})`);
    node.setAttribute('stroke', d.palette.ink);
    node.setAttribute('stroke-opacity', n(PLATE_EDGE_ALPHA));
    node.setAttribute('stroke-width', n(PLATE_EDGE / k));
  } else {
    node.setAttribute('fill', c.plateColor);
    node.setAttribute('fill-opacity', n(PLATE_ALPHA));
    node.setAttribute('stroke', d.palette.accent);
    node.setAttribute('stroke-width', n(PLATE_RING / k));
  }
  stage.appendChild(node);
}

/* ── the image ─────────────────────────────────────────────────────────────── */

function drawImage(stage, defs, d, geo, url) {
  const c = d.centre;
  const { cx, cy, side } = geo;
  let clipRef = null;
  const { node: outline } = maskOutline(c.mask, { ...geo, shape: d.shape });
  if (outline) {
    const clip = svgEl('clipPath', { id: nextId('art') }, [outline]);
    defs.appendChild(clip);
    clipRef = `url(#${clip.getAttribute('id')})`;
  }
  let filterRef = null;
  if (c.tone !== 'full') {
    const filter = toneFilter(c.tone, {
      dark: c.tone === 'mono' ? '#000000' : d.palette.ink,
      light: c.tone === 'mono' ? c.color : c.toneColor,
      id: nextId('tone'),
    });
    defs.appendChild(filter);
    filterRef = `url(#${filter.getAttribute('id')})`;
  }
  const rotate = rotateAbout(c, geo);
  const image = svgEl('image', {
    href: url, x: n(cx - side / 2), y: n(cy - side / 2), width: n(side), height: n(side),
    preserveAspectRatio: c.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice',
    // A clip on a transformed element turns with it, so a rotated image is
    // clipped by its wrapper instead and the mask holds still.
    'clip-path': rotate ? null : clipRef,
    filter: filterRef,
    opacity: c.opacity === 1 ? null : n(c.opacity),
    transform: rotate,
  });
  if (rotate && clipRef) stage.appendChild(svgEl('g', { 'clip-path': clipRef }, [image]));
  else stage.appendChild(image);
}

/* ── the glyph ─────────────────────────────────────────────────────────────── */

function drawGlyph(stage, d, geo) {
  const c = d.centre;
  const { cx, cy, side } = geo;
  const k = side / GLYPH_FIELD;
  const place = (shift) => `translate(${n(cx - side / 2 + shift)} ${n(cy - side / 2 + shift)}) scale(${n(k)})`;
  const layers = [];
  if (c.style === 'emboss') {
    const light = glyphNode(c.glyph, { color: '#ffffff' });
    light.setAttribute('opacity', n(EMBOSS_ALPHA));
    light.setAttribute('transform', place(EMBOSS_SHIFT));
    layers.push(light);
  }
  if (c.style === 'duotone') {
    const tint = glyphFillNode(c.glyph, { color: c.color, opacity: DUOTONE_FILL });
    tint.setAttribute('transform', place(0));
    layers.push(tint);
  }
  const line = glyphNode(c.glyph, { color: c.color, strokeWidth: c.style === 'bold' ? BOLD_STROKE : 2 });
  line.setAttribute('transform', place(0));
  layers.push(line);
  const rotate = rotateAbout(c, geo);
  const faded = c.opacity !== 1;
  if (layers.length === 1 && !rotate && !faded) { stage.appendChild(line); return; }
  stage.appendChild(svgEl('g', { transform: rotate, opacity: faded ? n(c.opacity) : null }, layers));
}

/* ── the call point ────────────────────────────────────────────────────────── */

/** The centre mark. Appends to `stage`; returns nothing. */
export function drawCentre(stage, defs, d) {
  const c = d.centre;
  if (c.kind === 'none') return;
  const url = c.kind === 'image' ? artUrl(c.imageRef) : null;
  if (c.kind === 'image' && !url) return;                 // unresolved art draws nothing, never a broken frame
  if (c.kind === 'glyph' && !GLYPHS[c.glyph]) return;     // an unknown glyph draws nothing, never a substitute
  const geo = { cx: CX + c.dx, cy: CENTRE_Y + c.dy, side: CENTRE_SIDE * c.scale };
  drawPlate(stage, defs, d, geo);
  if (c.kind === 'image') drawImage(stage, defs, d, geo, url);
  else drawGlyph(stage, d, geo);
}

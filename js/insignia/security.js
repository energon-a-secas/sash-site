/**
 * Insignia Kit: the certificate's security print (C1.2, round 2).
 *
 * Two call points and one collector, frozen by design round 2's plan
 * (section 1.4) and filled by workstream K3:
 *
 *   drawSecurity(root, defs, d, prov, helpers, 'ground')   paper grain
 *                                                          (`background.grain`)
 *                                                          and the latent word
 *                                                          (`background.latent`),
 *                                                          laid after the base
 *                                                          fill and the pattern,
 *                                                          before the frame
 *   drawSecurity(root, defs, d, prov, helpers, 'over')     the microtext border
 *                                                          (`frame.microtext`)
 *                                                          and the issue stamp
 *                                                          (`stamp.show`), laid
 *                                                          after the seal and
 *                                                          before the band
 *   securityRuns(d, prov)                                  every `{ field, role,
 *                                                          text }` the two layers
 *                                                          draw, so `usedFonts`
 *                                                          covers every letter
 *
 * Every default (`grain` 0, `latent` none, `microtext` false, `stamp.show`
 * false) draws nothing and reports nothing, so a certificate that never heard
 * of these fields serialises as before: that is the additivity the kit tests
 * prove, and it is why no def is emitted at a default.
 *
 * Every string here is provenance. The microtext repeats
 * `provenanceLines(prov, 'certificate')`, the latent word is the fixed system
 * word PARODY or the serial, and the stamp carries SASH, the issuing handle,
 * ISSUED plus the date, and the origin word. None of it is author text, so
 * none of it can carry a real issuer's name, and the accreditation vocabulary
 * C11.7 forbids in system strings never appears because nothing here composes
 * a sentence. The plan's section 6 is the copy; this file is the drawing.
 *
 * `helpers` is the object `render.js` hands the certificate:
 * `{ textNode, nextId, artUrl, renderSealNode }`. Every def takes its id from
 * `helpers.nextId(prefix)` (A12) and lives in `defs`, never inline, so
 * `inlineImages` and the serialiser see it. Nothing here is random and nothing
 * reads the clock (C1.6): the turbulence seeds are constants, the latent
 * opacity is the kit's, and the stamp's tilt is fixed.
 *
 * The strings the two layers draw and the strings `securityRuns` reports come
 * from the same three builders (`microtextEdges`, `latentWord`,
 * `stampStrings`), so the `&text=` subset the exporter asks for cannot drift
 * from the characters on the page (C6.3).
 */
import { svgEl, n, xmlSafe } from './patterns.js';
import { familyFor } from './draw.js';
import { FONT_FAMILIES } from './schema.js';
import { provenanceLines, formatDate, handleText, ORIGIN_WORDS } from './provenance.js';
import { MONO_ADV } from './strip.js';
import { bandGeometry } from './cert-band.js';

/* ── the paper ─────────────────────────────────────────────────────────────── */

/**
 * True when `palette.base` is a light paper, by the gamma-encoded luma of the
 * hex (0.2126 R + 0.7152 G + 0.0722 B, at or above one half). The grain and the
 * latent tone are ink-coloured on a light base and white on a dark one, so the
 * mark shows on both: the two light presets sit at 0.95 and 1, the ten dark
 * ones under 0.1, and the C1.2 default violet lands at 0.33.
 */
export function isLightBase(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(String(hex));
  if (!m) return false;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b >= 0.5;
}

/** The three channels of a hex colour as 0 to 1 strings, for a colour matrix. */
function channels(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(String(hex)) || [null, 'ff', 'ff', 'ff'];
  return [m[1], m[2], m[3]].map((h) => n(parseInt(h, 16) / 255));
}

/** The frame's inner edge: `frame.inset` plus the ink each C7.16 style lays inside its outer line, plus a 6 unit gap. */
// The extents read `drawFrame` in cert-band.js: a single or corner frame is one
// stroke centred on the inset, a double frame's second box sits 1.4 widths in
// at 0.42 wide, a rope's second box 0.6 in at 0.5 wide. The microtext and the
// stamp keep inside this edge so neither touches the frame's ink.
const FRAME_EXTENT = { none: 0, single: 0.5, double: 1.61, rope: 0.85, corner: 0.5 };
const EDGE_GAP = 6;

export function innerEdge(d) {
  const f = d.frame;
  const extent = FRAME_EXTENT[f.style] === undefined ? 0.5 : FRAME_EXTENT[f.style];
  return f.inset + f.width * extent + EDGE_GAP;
}

/* ── paper grain (background.grain) ────────────────────────────────────────── */

/** The turbulence the grain is made of. Fixed, so the serialised bytes are the same on every call (C1.6). */
export const GRAIN = Object.freeze({ baseFrequency: '0.85', numOctaves: '2', seed: '7' });

/**
 * One full-page rect through `feTurbulence fractalNoise` and an `feColorMatrix`
 * that keeps only the noise's alpha, scaled by `background.grain`, under the
 * grain colour. The rect's own fill is transparent, so an engine that ignored
 * the filter would draw nothing rather than a flat plate over the pattern.
 */
function drawGrain(root, defs, d, nextId) {
  const strength = d.background.grain;
  if (!(strength > 0)) return;
  const { w, h } = d.size;
  const [r, g, b] = channels(isLightBase(d.palette.base) ? d.palette.ink : '#ffffff');
  const id = nextId('grain');
  defs.appendChild(svgEl('filter', { id, x: '0', y: '0', width: '1', height: '1' }, [
    svgEl('feTurbulence', {
      type: 'fractalNoise', baseFrequency: GRAIN.baseFrequency, numOctaves: GRAIN.numOctaves, seed: GRAIN.seed,
      stitchTiles: 'stitch', result: 'noise',
    }),
    svgEl('feColorMatrix', {
      in: 'noise', type: 'matrix',
      values: `0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 ${n(strength)} 0`,
    }),
  ]));
  root.appendChild(svgEl('rect', { width: n(w), height: n(h), fill: '#000000', 'fill-opacity': '0', filter: `url(#${id})` }));
}

/* ── the latent word (background.latent) ───────────────────────────────────── */

/** The kit's tone, by paper. Not authorable: too strong is a watermark, too weak is nothing. */
export const LATENT_OPACITY = Object.freeze({ dark: 0.04, light: 0.05 });
export const LATENT_SIZE = 260;      // the display role at this size, about a fifth of the page's height
export const LATENT_TILT = -30;      // degrees, rising to the right
const LATENT_WORD = 'PARODY';        // C11.7 rules out the negated accreditation phrase, so this is the honest word that is left
const LATENT_EM = 0.72;              // Playfair Display 700 capitals average about this; an over-estimate only widens the gaps
const LATENT_GAP = 200;              // between repeats along a row
const LATENT_PITCH = 1.5;            // row pitch, in em

/** The word `background.latent` tiles: `PARODY`, the serial, or the empty string when there is nothing to tile. */
export function latentWord(d, prov) {
  if (d.background.latent === 'parody') return LATENT_WORD;
  // A preview may carry no serial yet (C1.3 allows the empty string there), and
  // an empty word tiles as nothing rather than as a placeholder invented here.
  if (d.background.latent === 'serial') return xmlSafe(prov.serial || '');
  return '';
}

/**
 * Where each copy of the word sits: rows across a square that covers the page's
 * diagonal, so the rotated tiling leaves no corner bare, in brick courses. Every
 * copy is its own `<text>` and the word is drawn without separators, so the run
 * `securityRuns` reports is exactly the word.
 */
function latentTiles(word, w, h) {
  const reach = Math.ceil(Math.sqrt(w * w + h * h));
  const period = word.length * LATENT_EM * LATENT_SIZE + LATENT_GAP;
  const pitch = LATENT_SIZE * LATENT_PITCH;
  const rows = Math.ceil(reach / pitch / 2);
  const cols = Math.ceil(reach / period) + 1;
  const tiles = [];
  for (let r = -rows; r <= rows; r++) {
    const shift = (r % 2 === 0) ? 0 : period / 2;
    for (let c = -cols; c <= cols; c++) {
      tiles.push({ x: w / 2 + c * period - shift, y: h / 2 + r * pitch + LATENT_SIZE * 0.35 });
    }
  }
  return tiles;
}

function drawLatent(root, defs, d, prov, nextId, textNode) {
  const word = latentWord(d, prov);
  if (!word) return;
  const { w, h } = d.size;
  const light = isLightBase(d.palette.base);
  const id = nextId('latent');
  const field = svgEl('g', { transform: `rotate(${n(LATENT_TILT)} ${n(w / 2)} ${n(h / 2)})` });
  for (const t of latentTiles(word, w, h)) {
    field.appendChild(textNode(word, { x: t.x, y: t.y, role: 'display', size: LATENT_SIZE, color: '#ffffff', anchor: 'middle' }));
  }
  defs.appendChild(svgEl('mask', { id, maskUnits: 'userSpaceOnUse', x: '0', y: '0', width: n(w), height: n(h) }, [field]));
  root.appendChild(svgEl('rect', {
    width: n(w), height: n(h), fill: light ? d.palette.ink : '#ffffff',
    'fill-opacity': n(light ? LATENT_OPACITY.light : LATENT_OPACITY.dark), mask: `url(#${id})`,
  }));
}

/* ── the microtext border (frame.microtext) ────────────────────────────────── */

export const MICRO_SIZE = 4;         // JetBrains Mono at 4 units: 8 px cap height at scale 2, about 0.7 mm on A4
export const MICRO_GAP = 12;         // the end gap the strip keeps, at both ends of every run (A24's Firefox margin)
const MICRO_OPACITY = 0.9;

/**
 * The four runs, clockwise: top left to right, right top to bottom, bottom
 * right to left, left bottom to top, so every glyph's top faces the frame.
 * Each run is a straight `<textPath>` pinned with `textLength` and
 * `lengthAdjust="spacing"`, and the string is cut to the number of glyphs that
 * fit by the same arithmetic as the strip: `chars * MONO_ADV * size` never
 * exceeds the pinned length, so the spacing adjustment only ever spreads, never
 * squeezes. The unit repeated is the strip's two lines with single spaces
 * (a whitespace run draws as one space, and the count has to match what is
 * drawn), and the last repeat on an edge is partial by design: a border, not a
 * sentence. Returns `[{ side, d, textLength, count, text }]`.
 */
export function microtextEdges(d, prov) {
  const { w, h } = d.size;
  const e = innerEdge(d);
  const lines = provenanceLines(prov, 'certificate');
  const unit = `${lines.top} · ${lines.bottom} · `.replace(/\s+/g, ' ');
  const sides = [
    { side: 'top', from: [e + MICRO_GAP, e], to: [w - e - MICRO_GAP, e] },
    { side: 'right', from: [w - e, e + MICRO_GAP], to: [w - e, h - e - MICRO_GAP] },
    { side: 'bottom', from: [w - e - MICRO_GAP, h - e], to: [e + MICRO_GAP, h - e] },
    { side: 'left', from: [e, h - e - MICRO_GAP], to: [e, e + MICRO_GAP] },
  ];
  return sides.map(({ side, from, to }) => {
    const textLength = Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]);
    const count = Math.max(0, Math.floor(textLength / (MONO_ADV * MICRO_SIZE)));
    const text = unit.repeat(Math.ceil(count / unit.length) + 1).slice(0, count);
    return { side, d: `M${n(from[0])} ${n(from[1])} L${n(to[0])} ${n(to[1])}`, textLength, count, text };
  });
}

function drawMicrotext(root, defs, d, prov, nextId) {
  if (!d.frame.microtext) return;
  const mono = FONT_FAMILIES.mono;
  const group = svgEl('g');
  for (const edge of microtextEdges(d, prov)) {
    if (edge.count < 1) continue;
    const id = nextId('micro');
    defs.appendChild(svgEl('path', { id, d: edge.d }));
    const text = svgEl('text', {
      'font-family': familyFor('mono'), 'font-size': n(MICRO_SIZE), 'font-weight': String(mono.weight),
      fill: d.frame.color, 'fill-opacity': n(MICRO_OPACITY),
    });
    const tp = svgEl('textPath', { href: `#${id}`, textLength: n(edge.textLength), lengthAdjust: 'spacing' });
    tp.textContent = edge.text;
    text.appendChild(tp);
    group.appendChild(text);
  }
  if (group.childNodes.length) root.appendChild(group);
}

/* ── the issue stamp (stamp.show) ──────────────────────────────────────────── */

export const STAMP_TILT = -8;        // degrees, fixed: a stamp is never quite square to the page
export const STAMP_OPACITY = 0.85;
// The pressed edge: `feDisplacementMap` fed by a fixed-seed turbulence. Kept
// only because the three-engine probe in the README's export section passed
// on the stamp itself; set false and the stamp draws with a clean edge.
export const STAMP_PRESS = true;
export const STAMP_PRESS_FILTER = Object.freeze({ baseFrequency: '0.06', numOctaves: '2', seed: '11', scale: '2.2' });
const SANS_EM = 0.72;                // Poppins 600 capitals average about this; the model only decides whether to pin
const STAMP_RING_FILL = 0.96;        // the ring text is squeezed to this much of its circle when the handle is long
const STAMP_WORD_FILL = 0.84;        // and the origin word to this much of the inner ring's diameter

/**
 * The stamp's two strings, both from the provenance: the ring reads `SASH ·
 * @handle · ISSUED 15 SEPTEMBER 2026 ·` (a segment whose value is missing is
 * left out, never drawn as a placeholder), the middle is the origin word.
 */
export function stampStrings(prov) {
  const handle = handleText(prov.issuerHandle);
  const issued = formatDate(prov.issuedAt);
  const parts = ['SASH', handle, issued ? `ISSUED ${issued.toUpperCase()}` : ''].filter(Boolean);
  return { ring: `${parts.join(' · ')} ·`, middle: ORIGIN_WORDS[prov.origin] || '' };
}

/** The stamp's geometry for `size`: the two ring radii, the text ring, the type sizes. */
export function stampGeometry(size) {
  return {
    outer: size / 2 - 2, inner: size / 2 - 26, textRing: size / 2 - 20,
    ringSize: size * 0.062, wordSize: size * 0.095,
    dash: `${n(size * 0.05)} ${n(size * 0.028)}`,
  };
}

/**
 * Where the stamp's centre lands: `stamp.x` and `stamp.y` as fractions of the
 * page, held on the paper. The ring stays inside the frame's inner edge and 6
 * units above the band's top line, so a stamp can sit on a signature rule but
 * never under the band (C11.2 is drawn last and would cover it) and never
 * across the frame's ink. This is what `bandGeometry` is exported for.
 */
export function stampCentre(d) {
  const { w, h } = d.size;
  const r = stampGeometry(d.stamp.size).outer + 2;
  const e = innerEdge(d);
  const { top } = bandGeometry(d);
  const lo = e + r + 4;
  const cx = Math.min(Math.max(d.stamp.x * w, lo), Math.max(lo, w - e - r - 4));
  const cy = Math.min(Math.max(d.stamp.y * h, lo), Math.max(lo, top - EDGE_GAP - r));
  return { cx, cy };
}

function drawStamp(root, defs, d, prov, nextId, textNode) {
  if (!d.stamp.show) return;
  const size = d.stamp.size;
  const geo = stampGeometry(size);
  const { cx, cy } = stampCentre(d);
  const { ring, middle } = stampStrings(prov);
  const accent = d.palette.accent;
  const sans = FONT_FAMILIES.sans;

  const g = svgEl('g', { transform: `translate(${n(cx)} ${n(cy)}) rotate(${n(STAMP_TILT)})`, opacity: n(STAMP_OPACITY) });
  g.appendChild(svgEl('circle', { r: n(geo.outer), fill: 'none', stroke: accent, 'stroke-width': '3', 'stroke-dasharray': geo.dash }));
  g.appendChild(svgEl('circle', { r: n(geo.inner), fill: 'none', stroke: accent, 'stroke-width': '1.6' }));

  // The ring text on a clockwise circle that starts at the foot, so `startOffset`
  // 50% is the crown and the string centres there, reading left to right over
  // the top with every glyph's top facing outward: the badge arc's primitive.
  const rt = geo.textRing;
  const pathId = nextId('stamp');
  defs.appendChild(svgEl('path', {
    id: pathId, d: `M0 ${n(rt)} A${n(rt)} ${n(rt)} 0 1 1 0 ${n(-rt)} A${n(rt)} ${n(rt)} 0 1 1 0 ${n(rt)}`,
  }));
  const circumference = 2 * Math.PI * rt;
  const ringModel = ring.length * (SANS_EM * geo.ringSize + 1);
  const ringPin = ringModel > circumference * STAMP_RING_FILL ? circumference * STAMP_RING_FILL : null;
  const text = svgEl('text', {
    'font-family': familyFor('sans'), 'font-size': n(geo.ringSize), 'font-weight': String(sans.weight),
    fill: accent, 'letter-spacing': '1',
  });
  const tp = svgEl('textPath', {
    href: `#${pathId}`, startOffset: '50%', 'text-anchor': 'middle',
    ...(ringPin === null ? {} : { textLength: n(ringPin), lengthAdjust: 'spacingAndGlyphs' }),
  });
  tp.textContent = ring;
  text.appendChild(tp);
  g.appendChild(text);

  if (middle) {
    const chord = geo.inner * 2 * STAMP_WORD_FILL;
    const tracking = size * 0.012;
    const wordModel = middle.length * (SANS_EM * geo.wordSize + tracking);
    g.appendChild(textNode(middle, {
      x: 0, y: geo.wordSize * 0.36, role: 'sans', size: geo.wordSize, color: accent, anchor: 'middle',
      tracking, textLength: wordModel > chord ? chord : null,
    }));
  }

  if (STAMP_PRESS) {
    const id = nextId('press');
    const f = STAMP_PRESS_FILTER;
    defs.appendChild(svgEl('filter', { id, x: '-8%', y: '-8%', width: '116%', height: '116%' }, [
      svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: f.baseFrequency, numOctaves: f.numOctaves, seed: f.seed, result: 'press' }),
      svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'press', scale: f.scale, xChannelSelector: 'R', yChannelSelector: 'G' }),
    ]));
    g.setAttribute('filter', `url(#${id})`);
  }
  root.appendChild(g);
}

/* ── the call points ───────────────────────────────────────────────────────── */

/** The security layer named by `layer`, `'ground'` or `'over'`. Appends to `root`; returns nothing. */
export function drawSecurity(root, defs, d, prov, helpers, layer) {
  const { textNode, nextId } = helpers;
  if (layer === 'ground') {
    drawGrain(root, defs, d, nextId);
    drawLatent(root, defs, d, prov, nextId, textNode);
  } else if (layer === 'over') {
    drawMicrotext(root, defs, d, prov, nextId);
    drawStamp(root, defs, d, prov, nextId, textNode);
  }
}

/**
 * Every `{ field, role, text }` the two security layers draw, in drawing order,
 * for `usedFonts` (C6.3). The fields are the ones `fieldLabel` in export.js
 * names: `background.latent`, `frame.microtext`, `stamp`.
 */
export function securityRuns(d, prov) {
  const runs = [];
  const word = latentWord(d, prov);
  if (word) runs.push({ field: 'background.latent', role: 'display', text: word });
  if (d.frame.microtext) {
    for (const edge of microtextEdges(d, prov)) {
      if (edge.count > 0) runs.push({ field: 'frame.microtext', role: 'mono', text: edge.text });
    }
  }
  if (d.stamp.show) {
    const { ring, middle } = stampStrings(prov);
    runs.push({ field: 'stamp', role: 'sans', text: ring });
    if (middle) runs.push({ field: 'stamp', role: 'sans', text: middle });
  }
  return runs;
}

/**
 * Insignia Kit: the renderer (C1.4).
 *
 * The only drawing code path in the campaign. Both sites, every page, every
 * export and every print goes through `renderSvg`, which is what makes the
 * provenance strip structural rather than remembered: there is no route from a
 * design document to pixels that skips it (C11.1).
 *
 * Pure with respect to app state: no `document.getElementById`, no fetch, no
 * Convex. It does use `document.createElementNS` to build the node it returns.
 *
 * Deterministic (C1.6): no `Math.random`, no `Date.now`, no `crypto.randomUUID`,
 * no locale-dependent formatting. Element ids come from a counter reset at the
 * start of every `renderSvg` call and are prefixed `ins-`.
 */
import { svgEl, n, patternDefs, metalGradient, SVG_NS } from './patterns.js';
import { shapePath, SHAPE_FIELD } from './shapes.js';
import { glyphNode } from './glyphs.js';
import {
  SCHEMA_VERSION, normalizeDesign, validateDesign, designSize,
  validateProvenance, FONT_FAMILIES, originLabel, provenanceLines,
} from './schema.js';
import { drawCertificate, certificateRuns } from './certificate.js';

export { SCHEMA_VERSION, normalizeDesign, validateDesign, designSize, SVG_NS };

/* ── art resolution (C10.3) ────────────────────────────────────────────────── */

// A design stores `centre.imageRef`, a Convex storage id, never a serving URL: a
// stored URL goes stale the moment the file is deleted and bakes a deployment
// hostname into every saved design. The caller resolves the map before drawing.
let ART_URLS = {};

/** Set the storage-id to serving-URL map the renderer resolves `imageRef` through. */
export function setArtUrls(map) {
  ART_URLS = map && typeof map === 'object' ? map : {};
}

/** The serving URL for an art reference, or null when the caller has not resolved it. */
export function artUrl(ref) {
  return (ref && Object.prototype.hasOwnProperty.call(ART_URLS, ref)) ? ART_URLS[ref] : null;
}

/* ── deterministic ids (C1.6) ──────────────────────────────────────────────── */

let idSeq = 0;
let idPrefix = 'ins';

export function nextId(prefix) {
  idSeq += 1;
  return `${idPrefix}-${prefix}-${idSeq}`;
}

/**
 * A counter alone is not enough. `url(#id)` resolves against the **document**,
 * not against the enclosing `<svg>`, so a wall of badges whose ids all restart
 * at 1 makes every badge draw the first badge's pattern, gradient and clip path.
 * The counter therefore runs under a prefix derived from the design and the
 * provenance, which keeps C1.6's guarantee (the same input serialises to the
 * same bytes) and removes the collision. Two byte-identical badges on one page
 * still share ids, and that is harmless: what they share is identical.
 *
 * FNV-1a, 32 bit, base 36. Not a random source and not a hash of anything
 * outside the two arguments.
 */
function idSaltFor(design, provenance) {
  const text = JSON.stringify(design) + JSON.stringify(provenance);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/* ── the field ─────────────────────────────────────────────────────────────── */

const F = SHAPE_FIELD;          // 512
const CX = F / 2;
const CY = F / 2;
const R = 236;                  // the nominal outer radius every shape is drawn to
const ARC_MARGIN = 24;
// The lower half of the field is shared by four optional elements and the strip,
// which is not optional. Each gets its own band so a design that switches all of
// them on at once still reads: pips 306 to 330, ribbon 336 to 394, bottom arc
// text 400 to 430, provenance strip 434 to 498. The edition mark sits at the top
// instead, under the top arc, because the foot has no room left.
const BOTTOM_ARC_R = 174;       // a baseline at y 430, clear of the strip below it
const STRIP_TOP = 434;
const PIP_Y = 318;
const RIBBON_TOP = 336;
const RIBBON_BOTTOM = 394;
const MARK_Y = 118;
// A24. The strip's bottom line is the verify URL, whose length the renderer does
// not get to choose, so its size comes from the string and `textLength` pins the
// advance. Drawn at a fixed 17 it lost its first character and the last of the
// serial off the plate. README, "Why the provenance strip is fitted", measures it.
const STRIP_INNER = F - 28 - 24;   // 460: the 484 plate, less a 12 gap at each end
const STRIP_SIZE = 17;             // what a line that already fits is drawn at
const STRIP_MIN = 11;              // past here the line is squeezed instead, never cut
const MONO_ADV = 0.601;            // JetBrains Mono, 0.6 em per glyph, every glyph
// A51. The line above the URL is the sans role, Poppins 600, and it is
// proportional: `i` advances 0.279 em where `@` advances 1.051, so the one
// constant that bounds the mono line cannot bound this one at all. These are the
// measured advances in thousandths of an em, grouped by value, covering every
// character the line can draw: the origin label's capitals and its space, `@`,
// and a handle matching `^[a-z0-9][a-z0-9-]{1,29}$`. Measured per glyph with the
// face loaded in Chromium, Firefox and WebKit, which agree to 0.00004 em, then
// rounded up, so the model never under-reports a width in any of the three.
const SANS_EM3 = {
  239: ' ', 279: 'Iijl', 345: 'f', 362: '1', 389: 't', 404: 'r', 459: 'L', 483: 'z', 530: 'F', 533: 'E', 540: 'x', 545: 's', 548: '7', 570: 'J', 574: '2', 577: 'Z', 578: 'T',
  583: '-', 584: 'k', 599: '3v', 603: 'c', 605: 'y', 608: 'P', 609: 'S', 618: 'e', 627: '9', 637: 'Y', 638: 'o', 640: '6', 642: 'R', 644: '58B', 647: '0', 662: '4hnu',
  664: 'K', 679: 'abdgpq', 687: 'X', 698: 'U', 712: 'V', 717: 'A', 718: 'DH', 735: 'N', 769: 'CG', 785: 'O', 788: 'Q', 844: 'w', 899: 'M', 1025: 'W', 1048: 'm', 1051: '@',
};
const SANS_ADV = new Map();
for (const em3 of Object.keys(SANS_EM3)) for (const ch of SANS_EM3[em3]) SANS_ADV.set(ch, +em3 / 1000);
// A character the table does not name counts as the widest advance in it, so a
// string outside the alphabet errs towards being fitted, never towards running off.
const SANS_MAX = Math.max(...SANS_ADV.values());
const TOP_SIZE = 20;               // what a top line that already fits the plate is drawn at
const TOP_TRACK = 1.5;             // and the tracking it carries; the two shrink together
const TOP_MIN = 13;                // 0.65 of nominal, the proportion STRIP_MIN keeps for mono

const GENERIC = { display: 'serif', slab: 'serif', sans: 'sans-serif', mono: 'monospace', script: 'cursive', rounded: 'sans-serif' };

/** The `font-family` value for a role. The exporter inlines the named family. */
export function familyFor(role) {
  const f = FONT_FAMILIES[role] || FONT_FAMILIES.sans;
  return `'${f.family}', ${GENERIC[role] || 'sans-serif'}`;
}

function textNode(value, { x, y, role = 'sans', size = 24, color = '#ffffff', anchor = 'middle', tracking = 0, opacity = null, textLength = null }) {
  const f = FONT_FAMILIES[role] || FONT_FAMILIES.sans;
  const node = svgEl('text', {
    x: n(x), y: n(y), 'font-family': familyFor(role), 'font-size': n(size), 'font-weight': String(f.weight),
    'text-anchor': anchor, fill: color, 'letter-spacing': tracking ? n(tracking) : null, 'fill-opacity': opacity === null ? null : n(opacity),
    // `spacingAndGlyphs`, not the default: a pinned line wants narrower glyphs.
    ...(textLength === null ? {} : { textLength: n(textLength), lengthAdjust: 'spacingAndGlyphs' }),
  });
  node.textContent = value;
  return node;
}

/* ── the strings the renderer draws, in one place ──────────────────────────── */

// Both the drawing code and `usedFonts` read these, so the character set the
// exporter subsets with `&text=` cannot drift from the characters drawn (C6.3).

export { originLabel, provenanceLines };

function markText(d) {
  const bits = [];
  if (d.mark.edition) bits.push(d.mark.edition);
  if (d.mark.year !== null && d.mark.year !== undefined) bits.push(String(d.mark.year));
  return bits.join(' ');
}

/* ── renderSvg ─────────────────────────────────────────────────────────────── */

/**
 * The only drawing code path in the campaign.
 * Throws TypeError when `provenance` is absent or fails C1.3.
 * Returns a detached <svg> element with xmlns set, ready to append or serialise.
 */
export function renderSvg(design, provenance) {
  const problems = validateProvenance(provenance);
  if (problems.length) throw new TypeError(`renderSvg needs a valid provenance object (C1.3): ${problems.join('; ')}`);
  const d = normalizeDesign(design);
  idSeq = 0;
  idPrefix = `ins${idSaltFor(d, provenance)}`;

  const { w, h } = d.size;
  const root = svgEl('svg', { xmlns: SVG_NS, viewBox: `0 0 ${n(w)} ${n(h)}`, width: n(w), height: n(h), role: 'img' });
  const title = svgEl('title');
  title.textContent = titleFor(d, provenance);
  root.appendChild(title);

  const defs = svgEl('defs');
  root.appendChild(defs);

  const k = Math.min(w, h) / F;
  const stage = svgEl('g', { transform: `translate(${n((w - F * k) / 2)} ${n((h - F * k) / 2)}) scale(${n(k)})` });
  root.appendChild(stage);

  if (d.kind === 'certificate') {
    // A certificate is laid out against its own page, not the 512 field.
    root.removeChild(stage);
    drawCertificate(root, defs, d, provenance, { textNode, nextId, artUrl, renderSealNode: renderSealSvg });
  } else {
    drawBadge(stage, defs, d, provenance);
  }
  return root;
}

/**
 * A badge drawn as a certificate seal: the same badge, without a second
 * provenance strip. The certificate draws the band itself (C11.2), so the strip
 * is drawn exactly once per artefact rather than twice at 220 units, where
 * neither copy would be legible. Internal to this module: there is no exported
 * way to draw a badge without its strip.
 */
function renderSealSvg(design, provenance) {
  // No counter or salt reset here: the seal is part of the certificate's own
  // document and shares its id namespace.
  const d = normalizeDesign(design);
  const { w, h } = d.size;
  const root = svgEl('svg', { viewBox: `0 0 ${n(w)} ${n(h)}`, role: 'presentation' });
  const defs = svgEl('defs');
  root.appendChild(defs);
  const k = Math.min(w, h) / F;
  const stage = svgEl('g', { transform: `translate(${n((w - F * k) / 2)} ${n((h - F * k) / 2)}) scale(${n(k)})` });
  root.appendChild(stage);
  drawBadge(stage, defs, d, provenance, { strip: false });
  return root;
}

function titleFor(d, prov) {
  // A14: the accessible name says which artefact this is, for the same reason
  // the band does. A screen reader announcing "badge" over a certificate is the
  // same mislabel, read aloud.
  const label = originLabel(prov.origin, d.kind);
  if (d.kind === 'certificate') return `${d.text.title.value} certificate, ${label.toLowerCase()}`;
  const arcs = [d.arcs.top && d.arcs.top.text, d.arcs.bottom && d.arcs.bottom.text].filter(Boolean);
  return arcs.length ? `${arcs.join(' ')}, ${label.toLowerCase()}` : label.toLowerCase();
}

/* ── the badge ─────────────────────────────────────────────────────────────── */

function drawBadge(stage, defs, d, prov, { strip = true } = {}) {
  const path = shapePath(d.shape);

  // Body: the silhouette, filled with the palette base or the metal gradient.
  let fill = d.palette.base;
  const grad = metalGradient(d.palette.metal, nextId('metal'));
  if (grad) { defs.appendChild(grad); fill = `url(#${grad.getAttribute('id')})`; }
  stage.appendChild(svgEl('path', { d: path, fill }));

  // Pattern, clipped to the silhouette by being drawn on the same path.
  const pat = patternDefs(d.pattern.kind, {
    color: d.pattern.color, opacity: d.pattern.opacity, scale: d.pattern.scale, id: nextId('pat'),
  });
  if (pat) {
    defs.appendChild(pat);
    stage.appendChild(svgEl('path', { d: path, fill: `url(#${pat.getAttribute('id')})` }));
  }

  // Rings, outermost first.
  for (const ring of d.rings) drawRing(stage, path, ring);

  // Centre art, under the arcs so a wide glyph cannot cover the text.
  drawCentre(stage, defs, d);

  // Arc text.
  if (d.arcs.top && d.arcs.top.text) drawArc(stage, defs, d.arcs.top, 'top');
  if (d.arcs.bottom && d.arcs.bottom.text) drawArc(stage, defs, d.arcs.bottom, 'bottom');

  if (d.pips.count > 0) drawPips(stage, d.pips);
  if (d.ribbon && d.ribbon.text) drawRibbon(stage, d.ribbon);

  const mark = markText(d);
  if (mark) {
    stage.appendChild(textNode(mark, { x: CX, y: MARK_Y, role: 'sans', size: 18, color: d.palette.accent, tracking: 2 }));
  }

  if (strip) drawProvenance(stage, d, prov);
}

function ringScale(inset) {
  return Math.max(0.05, (R - inset) / R);
}

function drawRing(stage, path, ring) {
  const k = ringScale(ring.inset);
  const at = (scale) => `translate(${n(CX)} ${n(CY)}) scale(${n(scale)}) translate(${n(-CX)} ${n(-CY)})`;
  const base = { d: path, fill: 'none', stroke: ring.color, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const w = ring.width;
  if (ring.style === 'double') {
    stage.appendChild(svgEl('path', { ...base, 'stroke-width': n(w * 0.32), transform: at(k) }));
    stage.appendChild(svgEl('path', { ...base, 'stroke-width': n(w * 0.32), transform: at(ringScale(ring.inset + w * 0.9)) }));
    return;
  }
  if (ring.style === 'dashed') {
    stage.appendChild(svgEl('path', { ...base, 'stroke-width': n(w), 'stroke-dasharray': `${n(w * 1.7)} ${n(w * 1.2)}`, transform: at(k) }));
    return;
  }
  if (ring.style === 'beaded') {
    // A zero-length dash with a round cap is a bead, and it stays a bead at
    // every scale, which a circle-per-bead loop would not.
    stage.appendChild(svgEl('path', { ...base, 'stroke-width': n(w), 'stroke-dasharray': `0 ${n(w * 1.85)}`, transform: at(k) }));
    return;
  }
  if (ring.style === 'rope') {
    const rope = { ...base, 'stroke-width': n(w * 0.55), 'stroke-dasharray': `${n(w * 1.1)} ${n(w * 1.1)}` };
    stage.appendChild(svgEl('path', { ...rope, transform: at(ringScale(ring.inset)) }));
    stage.appendChild(svgEl('path', { ...rope, 'stroke-dashoffset': n(w * 1.1), transform: at(ringScale(ring.inset + w * 0.5)) }));
    return;
  }
  stage.appendChild(svgEl('path', { ...base, 'stroke-width': n(w), transform: at(k) }));
}

function drawCentre(stage, defs, d) {
  const c = d.centre;
  if (c.kind === 'none') return;
  const side = 176 * c.scale;
  const cy = 214 + c.dy;
  if (c.kind === 'image') {
    const url = artUrl(c.imageRef);
    if (!url) return;                       // unresolved art draws nothing, never a broken frame
    const clip = svgEl('clipPath', { id: nextId('art') }, [
      svgEl('circle', { cx: n(CX), cy: n(cy), r: n(side / 2) }),
    ]);
    defs.appendChild(clip);
    stage.appendChild(svgEl('image', {
      href: url, x: n(CX - side / 2), y: n(cy - side / 2), width: n(side), height: n(side),
      preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${clip.getAttribute('id')})` }));
    return;
  }
  const glyph = glyphNode(c.glyph, { color: c.color });
  if (!glyph) return;
  glyph.setAttribute('transform',
    `translate(${n(CX - side / 2)} ${n(cy - side / 2)}) scale(${n(side / 24)})`);
  stage.appendChild(glyph);
}

function drawArc(stage, defs, arc, side) {
  const isTop = side === 'top';
  const r = isTop ? R - ARC_MARGIN - arc.size * 0.72 : BOTTOM_ARC_R;
  // Both arcs run left to right, which is what keeps the glyphs upright: text on
  // a path grows to the left of its direction of travel, so an arc traversed the
  // other way sets the bottom line upside down. Sweep 1 goes over the top and
  // the glyphs grow outward; sweep 0 goes under the foot and they grow inward,
  // toward the centre, which is the conventional look and keeps the line clear
  // of the provenance strip below it.
  const d = isTop
    ? `M${n(CX - r)} ${n(CY)} A${n(r)} ${n(r)} 0 0 1 ${n(CX + r)} ${n(CY)}`
    : `M${n(CX - r)} ${n(CY)} A${n(r)} ${n(r)} 0 0 0 ${n(CX + r)} ${n(CY)}`;
  const pathId = nextId(isTop ? 'arctop' : 'arcbot');
  defs.appendChild(svgEl('path', { id: pathId, d }));

  const f = FONT_FAMILIES[arc.font] || FONT_FAMILIES.display;
  const text = svgEl('text', {
    'font-family': familyFor(arc.font), 'font-size': n(arc.size), fill: arc.color,
    'font-weight': String(f.weight), 'letter-spacing': arc.tracking ? n(arc.tracking) : null });
  const tp = svgEl('textPath', { href: `#${pathId}`, startOffset: '50%', 'text-anchor': 'middle' });
  tp.textContent = arc.text;
  text.appendChild(tp);
  stage.appendChild(text);
}

function drawPips(stage, pips) {
  const count = Math.min(pips.count, pips.max);
  const gap = 30;
  const y = PIP_Y;
  const startX = CX - ((pips.max - 1) * gap) / 2;
  for (let i = 0; i < pips.max; i++) {
    const x = startX + i * gap;
    const on = i < count;
    const attrs = { fill: on ? pips.color : 'none', stroke: pips.color, 'stroke-width': '2', 'fill-opacity': on ? '1' : '0' };
    if (pips.style === 'bar') {
      stage.appendChild(svgEl('rect', { x: n(x - 8), y: n(y - 4), width: '16', height: '8', rx: '4', ...attrs }));
    } else if (pips.style === 'star') {
      stage.appendChild(svgEl('path', { d: starPath(x, y, 11, 4.6), ...attrs }));
    } else {
      stage.appendChild(svgEl('circle', { cx: n(x), cy: n(y), r: '7', ...attrs }));
    }
  }
}

function starPath(cx, cy, outer, inner) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${n(cx + rad * Math.cos(a))} ${n(cy + rad * Math.sin(a))}`);
  }
  return `M${pts.join(' L')} Z`;
}

function drawRibbon(stage, ribbon) {
  const mid = (RIBBON_TOP + RIBBON_BOTTOM) / 2;
  const d = `M62 ${n(RIBBON_TOP)} H450 L414 ${n(mid)} L450 ${n(RIBBON_BOTTOM)} H62 L98 ${n(mid)} Z`;
  stage.appendChild(svgEl('path', { d, fill: ribbon.color }));
  stage.appendChild(textNode(ribbon.text, {
    x: CX, y: mid + ribbon.size * 0.35, role: ribbon.font, size: ribbon.size, color: ribbon.textColor, tracking: 2 }));
}

/**
 * The provenance strip (C11.2). Drawn last so no other layer can cover it, and
 * drawn in both modes: an author who has never seen the strip would design
 * around a space that is not free. Both lines are fitted to the plate, A24 the
 * serial and A51 the issuing handle: whatever string either is handed, it draws
 * at most `STRIP_INNER` wide, so no reader loses the end of what they must read.
 */
function drawProvenance(stage, d, prov) {
  const lines = provenanceLines(prov, d.kind);
  stage.appendChild(svgEl('rect', {
    x: '14', y: n(STRIP_TOP), width: n(F - 28), height: n(F - STRIP_TOP - 14), rx: '14', fill: d.palette.ink, 'fill-opacity': '0.86' }));
  // A51. The same fit as the line below, on a proportional face. The table decides
  // whether the string clears the plate; `textLength` is what holds it there
  // afterwards, on any face, including the fallback that draws when Poppins never
  // loaded. Size and tracking shrink together so the line keeps its proportions,
  // down to TOP_MIN, past which the glyphs narrow instead. A whitespace run draws
  // as one space (SVG's default `xml:space`), so the label's three are measured as
  // one. The string is never shortened: a cut handle resolves to no profile at all,
  // which is the defect this fixes rather than a way of fixing it.
  const top = String(lines.top).replace(/\s+/g, ' ').trim();
  let em = 0;
  for (const ch of top) em += SANS_ADV.has(ch) ? SANS_ADV.get(ch) : SANS_MAX;
  const fit = Math.min(1, STRIP_INNER / (em * TOP_SIZE + TOP_TRACK * top.length));
  stage.appendChild(textNode(lines.top, {
    x: CX, y: STRIP_TOP + 26, role: 'sans', color: '#ffffff', textLength: fit < 1 ? STRIP_INNER : null,
    size: Math.max(TOP_MIN, TOP_SIZE * fit), tracking: TOP_TRACK * Math.max(TOP_MIN / TOP_SIZE, fit),
  }));
  // Code units, not code points: a pair counted twice only asks for a size
  // smaller than it needs, which is the safe direction to be wrong in.
  const chars = String(lines.bottom).length;
  const over = chars * MONO_ADV * STRIP_SIZE > STRIP_INNER;
  stage.appendChild(textNode(lines.bottom, {
    x: CX, y: STRIP_TOP + 50, role: 'mono', color: '#e7e9ff', opacity: 0.92,
    size: over ? Math.max(STRIP_MIN, STRIP_INNER / (chars * MONO_ADV)) : STRIP_SIZE,
    textLength: over ? STRIP_INNER : null,
  }));
}

/* ── usedFonts (C1.4, feeds the C6.3 subsetting) ───────────────────────────── */

/**
 * Every {role, text} pair a badge draws apart from the provenance strip: the
 * `strip: false` half of `drawBadge`. A certificate seal is that same badge, so
 * `certificateRuns` takes this and the seal's arcs reach the `&text=` subset the
 * exporter asks for. Until it did, a letter the certificate's own text happened
 * not to use fell back per character and shifted every advance after it (C6.3).
 */
function badgeRuns(d) {
  const runs = [];
  const add = (role, text) => { if (text) runs.push({ role, text: String(text) }); };
  if (d.arcs.top) add(d.arcs.top.font, d.arcs.top.text);
  if (d.arcs.bottom) add(d.arcs.bottom.font, d.arcs.bottom.text);
  if (d.ribbon) add(d.ribbon.font, d.ribbon.text);
  add('sans', markText(d));
  return runs;
}

/** Every role the design actually draws with, and the exact string each draws. */
function textRuns(design, provenance) {
  const d = normalizeDesign(design);
  // `badgeRuns` goes in for the same reason `renderSealSvg` does in `renderSvg`:
  // certificate.js can neither draw a badge nor read one, so one module supplies
  // both halves and they cannot describe different characters.
  const drawn = d.kind === 'certificate'
    ? certificateRuns(d, provenance, { sealRuns: badgeRuns })
    : badgeRuns(d);
  // The kind has to reach the label here too: BADGE and CERTIFICATE do not draw
  // the same letters, and a character the `&text=` subset leaves out falls back
  // per character and shifts every advance in the run (C6.3).
  const lines = provenanceLines(provenance, d.kind);
  return [...drawn, { role: 'sans', text: lines.top }, { role: 'mono', text: lines.bottom }]
    .filter((run) => run.text).map((run) => ({ role: run.role, text: String(run.text) }));
}

/**
 * Every font the design actually draws with, and exactly the characters each one
 * draws. Consumed by the exporter's `&text=` subsetting (C6.2).
 *
 * The returned `text` is the sorted unique character set, because that is what
 * the Google Fonts reply's `unicode-range` comes back as: any character left out
 * falls back per character and shifts every textPath advance.
 */
export function usedFonts(design, provenance) {
  const byFace = new Map();
  for (const run of textRuns(design, provenance)) {
    const f = FONT_FAMILIES[run.role] || FONT_FAMILIES.sans;
    const key = `${f.family}|${f.weight}|${f.italic}`;
    const seen = byFace.get(key) || { family: f.family, weight: f.weight, italic: f.italic, chars: new Set() };
    for (const ch of run.text) seen.chars.add(ch);
    byFace.set(key, seen);
  }
  return [...byFace.values()].map((f) => ({ family: f.family, weight: f.weight, italic: f.italic, text: [...f.chars].sort().join('') }))
    .sort((a, b) => (a.family < b.family ? -1 : a.family > b.family ? 1 : 0));
}

/**
 * Link the Google Fonts stylesheet for the roles a page draws with, once.
 *
 * On-screen only. The export path does not use it: it inlines a subset face per
 * C6.2, because an SVG inside an `<img>` cannot fetch anything at all.
 */
export function ensureFonts(roles = Object.keys(FONT_FAMILIES), doc = document) {
  const id = 'ins-fonts';
  if (doc.getElementById(id)) return;
  const families = [...new Set(roles)].map((r) => FONT_FAMILIES[r]).filter(Boolean)
    .map((f) => `family=${encodeURIComponent(f.family).replace(/%20/g, '+')}:wght@${f.weight}`);
  if (!families.length) return;
  const link = doc.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
  doc.head.appendChild(link);
}

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
 * start of every `renderSvg` call and are prefixed `ins-` (`draw.js`).
 *
 * Design round 2 (2026-09-15) split the badge into modules at frozen call
 * points, so a stream restyles the body, the rings, the centre or the strip
 * without editing this file: `finish.js` (`drawBody`, `drawFinish`),
 * `rings.js` (`drawRings`), `centre.js` (`drawCentre`), `strip.js`
 * (`drawProvenance`). The arcs, pips, ribbon and edition mark stay here. The
 * pattern step also stays here and asks `patterns.js` for `fadeMask` only when
 * `pattern.fade` is above zero, through the module namespace, so the mask
 * lands the day K1 exports it and nothing here changes.
 */
import * as patterns from './patterns.js';
import { svgEl, n, patternDefs, SVG_NS } from './patterns.js';
import { shapePath } from './shapes.js';
import {
  SCHEMA_VERSION, normalizeDesign, validateDesign, designSize,
  validateProvenance, FONT_FAMILIES, originLabel, provenanceLines, provenanceDesc,
} from './schema.js';
import {
  F, CX, CY, R, ARC_MARGIN, BOTTOM_ARC_R, PIP_Y, RIBBON_TOP, RIBBON_BOTTOM, MARK_Y,
  nextId, resetIds, textNode, familyFor, hook, setArtUrls, artUrl,
} from './draw.js';
import { drawBody, drawFinish } from './finish.js';
import { drawRings } from './rings.js';
import { drawCentre } from './centre.js';
import { drawProvenance } from './strip.js';
import { drawCertificate, certificateRuns } from './certificate.js';

export { SCHEMA_VERSION, normalizeDesign, validateDesign, designSize, SVG_NS };
export { setArtUrls, artUrl, nextId, textNode, familyFor };
export { originLabel, provenanceLines };

/* ── the strings the renderer draws, in one place ──────────────────────────── */

// Both the drawing code and `usedFonts` read these, so the character set the
// exporter subsets with `&text=` cannot drift from the characters drawn (C6.3).

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
  resetIds(d, provenance);

  const { w, h } = d.size;
  const root = svgEl('svg', { xmlns: SVG_NS, viewBox: `0 0 ${n(w)} ${n(h)}`, width: n(w), height: n(h), role: 'img' });
  const title = svgEl('title');
  title.textContent = titleFor(d, provenance);
  root.appendChild(title);
  // V10. The provenance as a sentence, for a screen reader, an image indexer
  // and anything that reads the file rather than the pixels. It is built from
  // the same strings as the strip, so the two cannot disagree, and it survives
  // the export the way the strip does (C11.1).
  const desc = svgEl('desc');
  desc.textContent = provenanceDesc(provenance, d.kind);
  root.appendChild(desc);

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
  const root = svgEl('svg', { viewBox: `0 0 ${n(w)} ${n(h)}`, role: 'presentation', class: 'ins-seal' });
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
  // same mislabel, read aloud. The ribbon counts as words: three seeded badges
  // carry theirs on the ribbon alone and were announced as "community badge".
  const label = originLabel(prov.origin, d.kind);
  if (d.kind === 'certificate') return `${d.text.title.value} certificate, ${label.toLowerCase()}`;
  const words = [d.arcs.top && d.arcs.top.text, d.arcs.bottom && d.arcs.bottom.text, d.ribbon && d.ribbon.text].filter(Boolean);
  return words.length ? `${words.join(' ')}, ${label.toLowerCase()}` : label.toLowerCase();
}

/* ── the badge ─────────────────────────────────────────────────────────────── */

/**
 * The badge, in the order the round's plan froze (section 1.4). Each named
 * step is a module another stream fills; each is wrapped in a class hook (V5)
 * that carries no style, so a page can animate the reveal without the kit
 * knowing and an export draws the same with the hook as without it.
 */
function drawBadge(stage, defs, d, prov, { strip = true } = {}) {
  const path = shapePath(d.shape);

  // Body: the silhouette, the pattern on it, and the finish that sits under the rings.
  const body = hook('ins-body');
  drawBody(body, defs, d, path);
  drawPattern(body, defs, d, path);
  drawFinish(body, defs, d, path, 'under');
  stage.appendChild(body);

  // Rings, outermost first.
  const rings = hook('ins-rings');
  drawRings(rings, defs, d, path);
  mount(stage, rings);

  // Centre art, under the arcs so a wide glyph cannot cover the text.
  const centre = hook('ins-centre');
  drawCentre(centre, defs, d);
  mount(stage, centre);

  // Arc text.
  if (d.arcs.top && d.arcs.top.text) stage.appendChild(drawArc(defs, d.arcs.top, 'top'));
  if (d.arcs.bottom && d.arcs.bottom.text) stage.appendChild(drawArc(defs, d.arcs.bottom, 'bottom'));

  if (d.pips.count > 0) stage.appendChild(drawPips(d.pips));
  if (d.ribbon && d.ribbon.text) stage.appendChild(drawRibbon(d.ribbon));

  const mark = markText(d);
  if (mark) {
    stage.appendChild(hook('ins-mark', [
      textNode(mark, { x: CX, y: MARK_Y, role: 'sans', size: 18, color: d.palette.accent, tracking: 2 }),
    ]));
  }

  // Gloss sits over everything but the strip.
  const over = hook('ins-finish');
  drawFinish(over, defs, d, path, 'over');
  mount(stage, over);

  if (strip) {
    const prov_ = hook('ins-prov');
    drawProvenance(prov_, defs, d, prov);
    stage.appendChild(prov_);
  }
}

/** Append a hook group only when its module drew into it: an empty `<g>` is noise in every export. */
function mount(stage, group) {
  if (group.childNodes.length) stage.appendChild(group);
}

/**
 * The pattern, clipped to the silhouette by being drawn on the same path. With
 * `pattern.fade` above zero the fill takes a radial mask from `patterns.js`
 * (`fadeMask`, K1), read through the namespace so this file needs no edit the
 * day it lands; at zero, today's bytes.
 */
function drawPattern(stage, defs, d, path) {
  const pat = patternDefs(d.pattern.kind, {
    color: d.pattern.color, opacity: d.pattern.opacity, scale: d.pattern.scale, id: nextId('pat'),
  });
  if (!pat) return;
  defs.appendChild(pat);
  const fill = svgEl('path', { d: path, fill: `url(#${pat.getAttribute('id')})` });
  if (d.pattern.fade > 0 && typeof patterns.fadeMask === 'function') {
    const mask = patterns.fadeMask({ w: F, h: F, cx: CX, cy: CY, fade: d.pattern.fade, id: nextId('fade') });
    if (mask) {
      defs.appendChild(mask);
      fill.setAttribute('mask', `url(#${mask.getAttribute('id')})`);
    }
  }
  stage.appendChild(fill);
}

function drawArc(defs, arc, side) {
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
  return hook('ins-arc', [text]);
}

function drawPips(pips) {
  const g = hook('ins-pips');
  const count = Math.min(pips.count, pips.max);
  const gap = 30;
  const y = PIP_Y;
  const startX = CX - ((pips.max - 1) * gap) / 2;
  for (let i = 0; i < pips.max; i++) {
    const x = startX + i * gap;
    const on = i < count;
    const attrs = { fill: on ? pips.color : 'none', stroke: pips.color, 'stroke-width': '2', 'fill-opacity': on ? '1' : '0' };
    if (pips.style === 'bar') {
      g.appendChild(svgEl('rect', { x: n(x - 8), y: n(y - 4), width: '16', height: '8', rx: '4', ...attrs }));
    } else if (pips.style === 'star') {
      g.appendChild(svgEl('path', { d: starPath(x, y, 11, 4.6), ...attrs }));
    } else {
      g.appendChild(svgEl('circle', { cx: n(x), cy: n(y), r: '7', ...attrs }));
    }
  }
  return g;
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

function drawRibbon(ribbon) {
  const mid = (RIBBON_TOP + RIBBON_BOTTOM) / 2;
  const d = `M62 ${n(RIBBON_TOP)} H450 L414 ${n(mid)} L450 ${n(RIBBON_BOTTOM)} H62 L98 ${n(mid)} Z`;
  return hook('ins-ribbon', [
    svgEl('path', { d, fill: ribbon.color }),
    textNode(ribbon.text, {
      x: CX, y: mid + ribbon.size * 0.35, role: ribbon.font, size: ribbon.size, color: ribbon.textColor, tracking: 2 }),
  ]);
}

/* ── usedFonts (C1.4, feeds the C6.3 subsetting) ───────────────────────────── */

/**
 * Every {role, text} pair a badge draws apart from the provenance strip: the
 * `strip: false` half of `drawBadge`. A certificate seal is that same badge, so
 * `certificateRuns` takes this and the seal's arcs reach the `&text=` subset the
 * exporter asks for. Until it did, a letter the certificate's own text happened
 * not to use fell back per character and shifted every advance after it (C6.3).
 * No badge field added in round 2 draws text, so this is unchanged.
 */
function badgeRuns(d) {
  const runs = [];
  const add = (field, role, text) => { if (text) runs.push({ field, role, text: String(text) }); };
  if (d.arcs.top) add('arcs.top', d.arcs.top.font, d.arcs.top.text);
  if (d.arcs.bottom) add('arcs.bottom', d.arcs.bottom.font, d.arcs.bottom.text);
  if (d.ribbon) add('ribbon', d.ribbon.font, d.ribbon.text);
  add('mark', 'sans', markText(d));
  return runs;
}

/** Every role drawn, the exact string each draws, and the field it came from (named on export failure). */
export function textRuns(design, provenance) {
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
  return [...drawn, { field: 'provenance', role: 'sans', text: lines.top }, { field: 'provenance', role: 'mono', text: lines.bottom }]
    .filter((run) => run.text).map((run) => ({ field: run.field, role: run.role, text: String(run.text) }));
}

/**
 * Every font the design actually draws with, and exactly the characters each one
 * draws. Consumed by the exporter's `&text=` subsetting (C6.2).
 *
 * The returned `text` is the sorted unique character set, because that is what
 * the Google Fonts reply's `unicode-range` comes back as: any character left out
 * falls back per character and shifts every textPath advance. `fields` lists
 * the sorted field paths the face draws, for the exporter's failure message.
 */
export function usedFonts(design, provenance) {
  const byFace = new Map();
  for (const run of textRuns(design, provenance)) {
    const f = FONT_FAMILIES[run.role] || FONT_FAMILIES.sans;
    const key = `${f.family}|${f.weight}|${f.italic}`;
    const seen = byFace.get(key) || { family: f.family, weight: f.weight, italic: f.italic, chars: new Set(), fields: new Set() };
    for (const ch of run.text) seen.chars.add(ch);
    seen.fields.add(run.field);
    byFace.set(key, seen);
  }
  return [...byFace.values()].map((f) => ({ family: f.family, weight: f.weight, italic: f.italic, text: [...f.chars].sort().join(''), fields: [...f.fields].sort() }))
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

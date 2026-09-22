/**
 * Insignia Kit: the provenance strip (C11.2), the plaque a badge carries.
 *
 * One call point, frozen by design round 2's plan (section 1.4):
 *
 *   drawProvenance(stage, defs, d, prov)   the plate and its two fitted lines
 *
 * Drawn last so no other layer can cover it, and drawn in both modes: an author
 * who has never seen the strip would design around a space that is not free.
 * Both lines are fitted to the plate, A24 the serial and A51 the issuing
 * handle: whatever string either is handed, it draws at most `STRIP_INNER`
 * wide, so no reader loses the end of what they must read.
 *
 * The plate is a plaque (round 2, provenance-plaque): chamfered corners on the
 * same 14 to 498 by 434 to 498 box the rounded rectangle occupied, a two-unit
 * accent rule along its straight top edge, a one-unit light inner line, and a
 * drop shadow so it sits on the badge rather than floating in front of it.
 * Every string, size and fit is as it was: only the plate changed. The shadow
 * is the one `<filter>` every badge carries; it lives in `defs` under an A12
 * id. A strip that looks designed is a strip nobody crops, and the accent rule
 * ties it to the badge's own palette so it reads as part of the artefact
 * rather than as a watermark to remove.
 *
 * `MONO_ADV` and `fitMono` are exported for K3, whose microtext border and
 * record block fit JetBrains Mono lines by the same arithmetic, and `fitSans`
 * is the A51 table as a function, so the band's top line in cert-band.js is
 * held to the width left of the record block the way this one is held to the plate.
 */
import { svgEl, n } from './patterns.js';
import { provenanceLines } from './provenance.js';
import { F, CX, STRIP_TOP, textNode, nextId } from './draw.js';

// A24. The strip's bottom line is the verify URL, whose length the renderer does
// not get to choose, so its size comes from the string and `textLength` pins the
// advance. Drawn at a fixed 17 it lost its first character and the last of the
// serial off the plate. README, "Why the provenance strip is fitted", measures it.
export const STRIP_INNER = F - 28 - 24;   // 460: the 484 plate, less a 12 gap at each end
/** The plate's box on the 512 field, and the chamfer cut off each corner. */
export const STRIP_PLATE = Object.freeze({ x: 14, y: STRIP_TOP, w: F - 28, h: F - STRIP_TOP - 14, chamfer: 10 });
const PLATE_OPACITY = 0.92;               // the ink over the body; warnings.js composites the same
const STRIP_SIZE = 17;                    // what a line that already fits is drawn at
const STRIP_MIN = 11;                     // past here the line is squeezed instead, never cut
/** JetBrains Mono advances 0.6 em per glyph, every glyph; rounded up so a width is never under-reported. */
export const MONO_ADV = 0.601;
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

/**
 * The size and pin for a JetBrains Mono line that must fit `inner` units:
 * `{ size, textLength }`, where `textLength` is null when the line already
 * fits at `nominal` and `inner` when it had to be squeezed, never below `min`.
 * Code units, not code points: a pair counted twice only asks for a size
 * smaller than it needs, which is the safe direction to be wrong in.
 */
export function fitMono(text, { inner = STRIP_INNER, nominal = STRIP_SIZE, min = STRIP_MIN } = {}) {
  const chars = String(text).length;
  const over = chars * MONO_ADV * nominal > inner;
  return {
    size: over ? Math.max(min, inner / (chars * MONO_ADV)) : nominal,
    textLength: over ? inner : null,
  };
}

/**
 * The size, tracking and pin for a Poppins 600 line that must fit `inner`
 * units: `{ size, tracking, textLength }`. Size and tracking shrink together
 * so the line keeps its proportions, down to `min`, past which `textLength`
 * narrows the glyphs instead; `textLength` is null when the line already fits
 * at `nominal`. A whitespace run is measured as one space, which is how SVG
 * draws it. The string is never shortened.
 */
export function fitSans(text, { inner = STRIP_INNER, nominal = TOP_SIZE, tracking = TOP_TRACK, min = TOP_MIN } = {}) {
  const line = String(text).replace(/\s+/g, ' ').trim();
  let em = 0;
  for (const ch of line) em += SANS_ADV.has(ch) ? SANS_ADV.get(ch) : SANS_MAX;
  const fit = Math.min(1, inner / (em * nominal + tracking * line.length));
  return {
    size: Math.max(min, nominal * fit),
    tracking: tracking * Math.max(min / nominal, fit),
    textLength: fit < 1 ? inner : null,
  };
}

/** The chamfered outline of a box, `c` cut off each corner. */
function chamfered({ x, y, w, h, c }) {
  return `M${n(x + c)} ${n(y)} H${n(x + w - c)} L${n(x + w)} ${n(y + c)} V${n(y + h - c)} L${n(x + w - c)} ${n(y + h)} `
    + `H${n(x + c)} L${n(x)} ${n(y + h - c)} V${n(y + c)} Z`;
}

/** The strip: the plaque, the fitted top line, the fitted URL line. Appends to `stage`; returns nothing. */
export function drawProvenance(stage, defs, d, prov) {
  const lines = provenanceLines(prov, d.kind);
  const { x, y, w, h, chamfer: c } = STRIP_PLATE;
  // The shadow: three units down, three of blur, under the plate only. The
  // region is widened so the blur is not cut at the plate's own box.
  const shadow = nextId('shadow');
  defs.appendChild(svgEl('filter', { id: shadow, x: '-10%', y: '-30%', width: '120%', height: '160%' }, [
    svgEl('feDropShadow', { dx: '0', dy: '3', stdDeviation: '3', 'flood-color': '#000000', 'flood-opacity': '0.45' }),
  ]));
  stage.appendChild(svgEl('path', { d: chamfered({ x, y, w, h, c }), fill: d.palette.ink, 'fill-opacity': n(PLATE_OPACITY), filter: `url(#${shadow})` }));
  // The accent rule is a rect on the plate's straight top edge, chamfer to
  // chamfer. Its span is the plate's, and the A24 and A51 tests read the span
  // the lines must fit from it.
  stage.appendChild(svgEl('rect', { x: n(x + c), y: n(y), width: n(w - 2 * c), height: '2', fill: d.palette.accent, 'fill-opacity': '0.9' }));
  stage.appendChild(svgEl('path', { d: chamfered({ x: x + 6, y: y + 6, w: w - 12, h: h - 12, c: c - 2 }),
    fill: 'none', stroke: '#ffffff', 'stroke-width': '1', 'stroke-opacity': '0.18' }));
  // A51. The same fit as the line below, on a proportional face. The table decides
  // whether the string clears the plate; `textLength` is what holds it there
  // afterwards, on any face, including the fallback that draws when Poppins never
  // loaded. The string is never shortened: a cut handle resolves to no profile at
  // all, which is the defect this fixes rather than a way of fixing it.
  const top = fitSans(lines.top);
  stage.appendChild(textNode(lines.top, {
    x: CX, y: STRIP_TOP + 26, role: 'sans', color: '#ffffff', textLength: top.textLength,
    size: top.size, tracking: top.tracking,
  }));
  const mono = fitMono(lines.bottom);
  stage.appendChild(textNode(lines.bottom, {
    x: CX, y: STRIP_TOP + 50, role: 'mono', color: '#e7e9ff', opacity: 0.92,
    size: mono.size, textLength: mono.textLength,
  }));
}

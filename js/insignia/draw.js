/**
 * Insignia Kit: the primitives every badge module draws with.
 *
 * The 512 field and its bands, the salted id counter (A12), `textNode` and
 * `familyFor`. These lived in `render.js` until design round 2 split the badge
 * into `finish.js`, `rings.js`, `centre.js` and `strip.js`; each of those needs
 * an id and a text node, and importing them back out of `render.js` would make
 * the graph circular. `patterns.js` is the kit's other leaf for the same reason
 * (`svgEl` lives there), and this file is the leaf for what is specific to the
 * badge field rather than to any pattern.
 *
 * Nothing here is random and nothing reads the clock (C1.6).
 */
import { svgEl, n } from './patterns.js';
import { SHAPE_FIELD } from './shapes.js';
import { FONT_FAMILIES } from './schema.js';

/* ── the field ─────────────────────────────────────────────────────────────── */

export const F = SHAPE_FIELD;          // 512
export const CX = F / 2, CY = F / 2;
export const R = 236;                  // the nominal outer radius every shape is drawn to
export const ARC_MARGIN = 24;
// The lower half of the field is shared by four optional elements and the strip,
// which is not optional. Each gets its own band so a design that switches all of
// them on at once still reads: pips 306 to 330, ribbon 336 to 394, bottom arc
// text 400 to 430, provenance strip 434 to 498. The edition mark sits at the top
// instead, under the top arc, because the foot has no room left.
export const BOTTOM_ARC_R = 174;       // a baseline at y 430, clear of the strip below it
export const STRIP_TOP = 434;
export const PIP_Y = 318;
export const RIBBON_TOP = 336, RIBBON_BOTTOM = 394;
export const MARK_Y = 118;
// The centre mark: side `176 * centre.scale`, centred on `214 + centre.dy`.
export const CENTRE_SIDE = 176;
export const CENTRE_Y = 214;

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

/* ── deterministic ids (C1.6, A12) ─────────────────────────────────────────── */

let idSeq = 0, idPrefix = 'ins';

/** The next id under the current salt. Every def any module adds takes its id here. */
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
 * outside the two arguments. Called once at the top of `renderSvg`, never by a
 * seal: the seal is part of the certificate's document and shares its salt.
 */
export function resetIds(design, provenance) {
  const text = JSON.stringify(design) + JSON.stringify(provenance);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  idSeq = 0;
  idPrefix = `ins${h.toString(36)}`;
}

/* ── text ──────────────────────────────────────────────────────────────────── */

const GENERIC = { display: 'serif', slab: 'serif', sans: 'sans-serif', mono: 'monospace', script: 'cursive', rounded: 'sans-serif' };

/** The `font-family` value for a role. The exporter inlines the named family. */
export function familyFor(role) {
  const f = FONT_FAMILIES[role] || FONT_FAMILIES.sans;
  return `'${f.family}', ${GENERIC[role] || 'sans-serif'}`;
}

/** One `<text>` node in a role. `textLength` pins the advance with `spacingAndGlyphs`. */
export function textNode(value, { x, y, role = 'sans', size = 24, color = '#ffffff', anchor = 'middle', tracking = 0, opacity = null, textLength = null }) {
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

/**
 * A class hook for a page to animate or style (V5). The kit ships no CSS for
 * these names, so the attribute changes no pixel: an export with the hook and
 * one without draw the same, and the claim-page reveal keys off them without
 * the kit knowing.
 */
export function hook(name, children = []) {
  return svgEl('g', { class: name }, children);
}

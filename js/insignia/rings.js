/**
 * Insignia Kit: the rings (C1.1 `rings[]`, C7.10).
 *
 * One call point, frozen by design round 2's plan (section 1.4):
 *
 *   drawRings(stage, defs, d, path)   every ring, outermost first
 *
 * Seven styles. `solid`, `double`, `dashed` and `beaded` draw as they shipped.
 * `rope` keeps its id and is redrawn (round 2, ring-styles): a dark cord under
 * two half-phase strands with a highlight, so it reads as twisted cord rather
 * than a chain of dashes. `bevel` is a gradient stroke, light at the top and
 * dark at the foot, with a shadow hairline inside it: the same rim the finish
 * stack draws, in one implementation (`drawBevel`), so a flat-colour body can
 * carry a metal rim without a metal body. `gear` is square-ended teeth over a
 * thinner solid ring, the engineering register.
 *
 * A ring is a stroke on the silhouette path scaled about the field's centre by
 * `ringScale(inset)`, which is what keeps every style concentric with the body
 * whatever the shape. Dashes are laid along the path in its own user space,
 * before that transform, so two strands drawn at different insets keep their
 * dashes at the same points of the outline: the half-phase pairing holds all
 * the way round, whatever the shape.
 *
 * Body-only rings: on a silhouette with more than one subpath (ribbon-rosette,
 * whose tails follow its disc), a ring follows the first subpath only, so beads
 * stop running down the tails. The first subpath is the body by convention.
 *
 * Each ring is wrapped in `<g class="ins-ring">` for the claim-page reveal (V5).
 * Every def takes its id from `nextId` (A12) and lives in `defs`.
 */
import { svgEl, n } from './patterns.js';
import { CX, CY, R, hook, nextId } from './draw.js';

/** The scale that moves the silhouette's outer edge `inset` units inward. */
export function ringScale(inset) {
  return Math.max(0.05, (R - inset) / R);
}

/** The transform that scales the silhouette about the field's centre. */
export function about(scale) {
  return `translate(${n(CX)} ${n(CY)}) scale(${n(scale)}) translate(${n(-CX)} ${n(-CY)})`;
}

/** The first subpath of a path string: the body of a multi-subpath silhouette, the whole of any other. */
export function bodyPath(path) {
  const s = String(path).trim();
  const next = s.slice(1).search(/[Mm]/);
  return next === -1 ? s : s.slice(0, next + 1).trim();
}

/* ── colour ────────────────────────────────────────────────────────────────── */

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(String(hex).slice(i, i + 2), 16));
const rgbToHex = (rgb) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;

/**
 * `a` moved `t` of the way toward `b`, both six-digit hex, lowercase hex out.
 * Plain sRGB arithmetic: what a tint or a shade of a ring colour wants, and
 * the same result in every engine because no engine does it.
 */
export function mix(a, b, t) {
  const p = hexToRgb(a), q = hexToRgb(b);
  const k = Math.min(1, Math.max(0, Number(t) || 0));
  return rgbToHex(p.map((v, i) => v + (q[i] - v) * k));
}

/** `<stop>` nodes from `[offset, color, opacity?]` rows. */
export function stopNodes(stops) {
  return stops.map(([offset, color, opacity]) => svgEl('stop', {
    offset: n(offset), 'stop-color': color, 'stop-opacity': opacity === undefined ? null : n(opacity) }));
}

/**
 * A top-to-bottom gradient for a rim: `light` at the top, `mid` across the
 * middle, `dark` at the foot. Appended to `defs`; returns the `url(#id)` fill.
 */
export function rimGradient(defs, light, mid, dark) {
  const id = nextId('rim');
  defs.appendChild(svgEl('linearGradient', { id, x1: '0', y1: '0', x2: '0', y2: '1' },
    stopNodes([[0, light], [0.5, mid], [1, dark]])));
  return `url(#${id})`;
}

/* ── the bevel rim, shared with finish.js ──────────────────────────────────── */

/**
 * A bevel: the rim gradient stroked `width` wide at `inset`, and a 1.5 hairline
 * in `ink` at 0.55 opacity six tenths of the width further in, which is the
 * shadow the rim casts on the body. `k` scales the opacities (the finish's
 * `strength`); a ring passes 1. Appends to `stage`; returns nothing.
 */
export function drawBevel(stage, defs, path, { inset, width, light, mid, dark, ink, k = 1 }) {
  const rim = rimGradient(defs, light, mid, dark);
  stage.appendChild(svgEl('path', {
    d: path, fill: 'none', stroke: rim, 'stroke-width': n(width), 'stroke-linejoin': 'round',
    'stroke-opacity': k >= 1 ? null : n(k), transform: about(ringScale(inset)) }));
  stage.appendChild(svgEl('path', {
    d: path, fill: 'none', stroke: ink, 'stroke-width': '1.5', 'stroke-linejoin': 'round',
    'stroke-opacity': n(Math.min(1, 0.55 * k)), transform: about(ringScale(inset + width * 0.6)) }));
}

/* ── the rings ─────────────────────────────────────────────────────────────── */

/** Every ring, outermost first, on the body subpath. Appends to `stage`; returns nothing. */
export function drawRings(stage, defs, d, path) {
  const body = bodyPath(path);
  for (const ring of d.rings) {
    const g = hook('ins-ring');
    drawRing(g, defs, body, ring, d.palette.ink);
    stage.appendChild(g);
  }
}

function drawRing(stage, defs, path, ring, ink) {
  const k = ringScale(ring.inset);
  const base = { d: path, fill: 'none', stroke: ring.color, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const w = ring.width;
  if (ring.style === 'double') {
    stage.appendChild(svgEl('path', { ...base, 'stroke-width': n(w * 0.32), transform: about(k) }));
    stage.appendChild(svgEl('path', { ...base, 'stroke-width': n(w * 0.32), transform: about(ringScale(ring.inset + w * 0.9)) }));
    return;
  }
  if (ring.style === 'dashed') {
    stage.appendChild(svgEl('path', { ...base, 'stroke-width': n(w), 'stroke-dasharray': `${n(w * 1.7)} ${n(w * 1.2)}`, transform: about(k) }));
    return;
  }
  if (ring.style === 'beaded') {
    // A zero-length dash with a round cap is a bead, and it stays a bead at
    // every scale, which a circle-per-bead loop would not.
    stage.appendChild(svgEl('path', { ...base, 'stroke-width': n(w), 'stroke-dasharray': `0 ${n(w * 1.85)}`, transform: about(k) }));
    return;
  }
  if (ring.style === 'rope') {
    // A dark cord the full width, then two strands of alternating dashes a
    // little inside and outside it, the outer one in the ring colour and the
    // inner one a shade darker, so each turn of the cord reads as a twist. A
    // thin light line on the outer strand's dashes is the lit edge.
    const dash = `${n(w * 0.75)} ${n(w * 0.75)}`;
    stage.appendChild(svgEl('path', { ...base, stroke: mix(ring.color, ink, 0.45), 'stroke-width': n(w), transform: about(k) }));
    const strand = { ...base, 'stroke-width': n(w * 0.62), 'stroke-dasharray': dash };
    stage.appendChild(svgEl('path', { ...strand, transform: about(ringScale(ring.inset - w * 0.12)) }));
    stage.appendChild(svgEl('path', { ...strand, stroke: mix(ring.color, ink, 0.18), 'stroke-dashoffset': n(w * 0.75), transform: about(ringScale(ring.inset + w * 0.12)) }));
    stage.appendChild(svgEl('path', { ...base, stroke: mix(ring.color, '#ffffff', 0.6), 'stroke-width': '1.5', 'stroke-opacity': '0.5',
      'stroke-dasharray': dash, transform: about(ringScale(ring.inset - w * 0.2)) }));
    return;
  }
  if (ring.style === 'bevel') {
    drawBevel(stage, defs, path, { inset: ring.inset, width: w, light: mix(ring.color, '#ffffff', 0.55), mid: ring.color, dark: mix(ring.color, ink, 0.55), ink });
    return;
  }
  if (ring.style === 'gear') {
    // Teeth are a dashed stroke with square ends, 1.4 widths tall, over a
    // thinner solid ring: a tooth one width long, a gap nine tenths of one.
    stage.appendChild(svgEl('path', { ...base, 'stroke-width': n(w * 0.45), transform: about(k) }));
    stage.appendChild(svgEl('path', { ...base, 'stroke-linecap': 'butt', 'stroke-width': n(w * 1.4), 'stroke-dasharray': `${n(w)} ${n(w * 0.9)}`, transform: about(k) }));
    return;
  }
  stage.appendChild(svgEl('path', { ...base, 'stroke-width': n(w), transform: about(k) }));
}

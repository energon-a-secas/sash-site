/**
 * Insignia catalogue: the preset list a picker reads.
 *
 * C1's target is that a first badge looks like something in about thirty
 * seconds, which means the author picks a preset and edits the words. This file
 * is the entry point named in `data/README.md`; the designs themselves live in
 * `badges.js` and `certificates.js`, which is a split for the 500-line rule on
 * a module a browser loads, not a split with meaning.
 *
 *   PRESETS        every preset, `{ id, name, kind, design }`, badges first
 *   DEFAULT_PRESET the one a new document of each kind starts from
 *   RANDOM_POOLS   what a randomize control draws from
 *   randomDesign   one design out of those pools, with an injectable source
 *
 * Owned by D1. Vendored into `<site>/js/insignia/data/presets.js`.
 */
import { normalizeDesign, SHAPE_IDS, PATTERN_KINDS, RING_STYLES, PIP_STYLES } from '../schema.js';
import { GLYPH_LIST } from '../glyphs.js';
import { badge, BADGE_PRESETS } from './badges.js';
import { CERTIFICATE_PRESETS } from './certificates.js';

const certificate = (d) => normalizeDesign({ ...d, schemaVersion: 1, kind: 'certificate' });

/* ── the exported catalogue ────────────────────────────────────────────────── */

/** Every preset, badges first, then certificates. `{ id, name, kind, design }`. */
export const PRESETS = [
  ...BADGE_PRESETS.map((p) => ({ ...p, kind: 'badge' })),
  ...CERTIFICATE_PRESETS.map((p) => ({ ...p, kind: 'certificate' })),
];

/** The preset a new document of each kind starts from. C12 DO #7 for the badge. */
export const DEFAULT_PRESET = { badge: 'energon-hex', certificate: 'violet-signal' };

/** Presets of one kind, in catalogue order. */
export function presetsFor(kind) {
  return PRESETS.filter((p) => p.kind === kind);
}

/** A preset by id, or null. The design is shared, so a caller clones before editing. */
export function preset(id) {
  return PRESETS.find((p) => p.id === id) || null;
}

/** A fresh copy of a preset's design, safe to hand to an editor. */
export function presetDesign(id) {
  const found = preset(id) || preset(DEFAULT_PRESET.badge);
  return JSON.parse(JSON.stringify(found.design));
}

/* ── randomize ─────────────────────────────────────────────────────────────── */

/**
 * What a randomize control draws from. Pools rather than a generator, so the
 * editor owns the interaction and this file owns the taste.
 *
 * The palettes are lifted from the badge presets rather than invented, which is
 * what keeps a random badge inside the same colour language instead of walking
 * the whole hue wheel. `ink` is dark in every one of them, for the provenance
 * strip.
 */
export const RANDOM_POOLS = {
  shapes: [...SHAPE_IDS],
  patterns: PATTERN_KINDS.filter((k) => k !== 'none'),
  ringStyles: [...RING_STYLES],
  pipStyles: [...PIP_STYLES],
  metals: ['none', 'none', 'none', 'gold', 'silver', 'bronze'],
  glyphs: [...GLYPH_LIST],
  palettes: BADGE_PRESETS.map((p) => ({
    base: p.design.palette.base,
    accent: p.design.palette.accent,
    ink: p.design.palette.ink,
    arc: p.design.arcs.top ? p.design.arcs.top.color : '#ffffff',
  })),
  arcTop: ['NEARLY THERE', 'ROOT CAUSE', 'ON CALL', 'FIRST LIGHT', 'HOTFIX', 'GREEN BUILD',
    'DEEP WORK', 'ONE MORE TRY', 'SHIPPED', 'RUBBER DUCK'],
  arcBottom: ['AND COUNTING', 'NO PANIC', 'HELD', 'CONFIRMED', 'AT LAST', 'AGAIN',
    'WITH WITNESSES', 'BY MORNING'],
  ribbons: ['2026', 'exit 0', 'SEV 1', 'day 400', 'v1', 'no meetings', 'p95'],
  arcFonts: ['display', 'slab', 'sans', 'mono', 'rounded'],
  certBackgrounds: ['guilloche', 'topo', 'mesh', 'tiles'],
  certFrames: ['single', 'double', 'rope', 'corner'],
};

const take = (list, pick) => list[Math.min(list.length - 1, Math.max(0, Math.floor(pick() * list.length)))];

/**
 * One random design. `pick` returns a number in [0, 1) and defaults to
 * `Math.random`; passing a seeded generator makes the result reproducible,
 * which is what a test needs. Never returns an invalid document: every value
 * comes from a pool declared above and the result goes through
 * `normalizeDesign`.
 */
export function randomDesign(kind = 'badge', pick = Math.random) {
  if (kind === 'certificate') {
    const source = take(CERTIFICATE_PRESETS, pick).design;
    return certificate({
      ...JSON.parse(JSON.stringify(source)),
      background: { ...source.background, kind: take(RANDOM_POOLS.certBackgrounds, pick) },
      frame: { ...source.frame, style: take(RANDOM_POOLS.certFrames, pick) },
    });
  }
  const p = take(RANDOM_POOLS.palettes, pick);
  const font = take(RANDOM_POOLS.arcFonts, pick);
  const ringCount = Math.floor(pick() * 3);
  return badge({
    palette: { base: p.base, accent: p.accent, ink: p.ink, metal: take(RANDOM_POOLS.metals, pick) },
    shape: take(RANDOM_POOLS.shapes, pick),
    rings: Array.from({ length: ringCount }, (_, i) => ({
      style: take(RANDOM_POOLS.ringStyles, pick),
      width: 12 - i * 4,
      color: p.accent,
      inset: i * 22,
    })),
    pattern: { kind: take(RANDOM_POOLS.patterns, pick), color: p.arc, opacity: 0.16, scale: 1 },
    arcs: {
      top: { text: take(RANDOM_POOLS.arcTop, pick), font, size: 32, tracking: 4, color: p.arc },
      bottom: { text: take(RANDOM_POOLS.arcBottom, pick), font, size: 24, tracking: 6, color: p.accent },
    },
    centre: { kind: 'glyph', glyph: take(RANDOM_POOLS.glyphs, pick), color: p.arc, scale: 0.95, dy: -8 },
    ribbon: { text: take(RANDOM_POOLS.ribbons, pick), color: p.accent, textColor: p.ink, font: 'sans', size: 22 },
    pips: { count: Math.floor(pick() * 6), max: 5, style: take(RANDOM_POOLS.pipStyles, pick), color: p.accent },
  });
}


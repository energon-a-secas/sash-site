/**
 * Insignia Kit: the design document schema.
 *
 * Contract C1 (`neo-insignia/1`) and C7 (`neo-sash-enums/1`). Every field name
 * and every enum member here is a one-way door: a stored `templateVersions.design`
 * and every issued award carries them, so renaming one invalidates artefacts that
 * have already been downloaded.
 *
 * Pure functions only. No DOM, no fetch, no app state. The renderer, the
 * exporter and the server-side structural validator all read these lists.
 * `projects/sash-site/convex/lib/design.ts` re-declares them because the Convex
 * runtime cannot import `packages/`; that duplication is deliberate (C2.10) and
 * a node test asserts the two lists are equal.
 */

import { xmlSafe, hasControl } from './patterns.js';

export const SCHEMA_VERSION = 1;

/* ── C7 enums, exhaustive, lowercase, stored verbatim ──────────────────────── */

export const KINDS = ['badge', 'certificate'];                                    // C7.1
export const ORIGINS = ['neorgon', 'community', 'imported'];                      // C7.2, A6
export const CATEGORIES = ['kt', 'course', 'challenge', 'fun', 'meme', 'recognition']; // C7.3
export const SPHERES = ['work', 'fun', 'mindset'];                                // C7.4
export const ACCESS_LEVELS = ['open', 'limited', 'private'];                      // C7.5
export const VISIBILITIES = ['public', 'unlisted', 'private'];                    // C7.6
export const TEMPLATE_STATUSES = ['draft', 'published', 'archived'];              // C7.6b
export const ORIENTATIONS = ['landscape', 'portrait'];                            // C7.7

// C7.8. Fifteen ids, one flat alphabetical list, no grouping and no ordering
// (C12 DO #5). The naming rules in C12 are a legal-risk control: every id is a
// plain geometric noun, and `tests/insignia.test.mjs` asserts each one against a
// frozen reserved-name list.
export const SHAPE_IDS = [
  'circle', 'crescent', 'diamond', 'drop', 'flame', 'gem', 'hexagon', 'leaf',
  'ribbon-rosette', 'rosette', 'rounded-square', 'shield', 'star', 'wave', 'zigzag',
];

export const METALS = ['none', 'gold', 'silver', 'bronze'];                       // C7.9
export const RING_STYLES = ['solid', 'double', 'dashed', 'beaded', 'rope'];       // C7.10
export const PATTERN_KINDS = ['none', 'stripes', 'dots', 'rays', 'guilloche',
  'hexgrid', 'circuit', 'chevrons', 'noise'];                                     // C7.11
export const PIP_STYLES = ['dot', 'star', 'bar'];                                 // C7.12
export const FONT_ROLES = ['display', 'slab', 'sans', 'mono', 'script', 'rounded']; // C7.13

// C7.14. A design stores the role, never the family: swapping a family is then a
// kit change rather than a migration of every stored design.
export const FONT_FAMILIES = {
  display: { family: 'Playfair Display', weight: 700, italic: false },
  slab:    { family: 'Roboto Slab',      weight: 700, italic: false },
  sans:    { family: 'Poppins',          weight: 600, italic: false },
  mono:    { family: 'JetBrains Mono',   weight: 500, italic: false },
  script:  { family: 'Great Vibes',      weight: 400, italic: false },
  rounded: { family: 'Nunito',           weight: 700, italic: false },
};

export const CERT_BACKGROUNDS = ['plain', 'guilloche', 'topo', 'mesh', 'tiles'];  // C7.15
export const CERT_FRAMES = ['none', 'single', 'double', 'rope', 'corner'];        // C7.16
export const AWARD_SOURCES = ['claim', 'sent', 'earned', 'import'];               // C7.17
export const AWARD_STATUSES = ['valid', 'expired', 'revoked'];                    // C7.18
export const IMPORT_PROVIDERS = ['credly', 'badgr', 'openbadges', 'manual'];      // C7.19
export const IMPORT_DIALECTS = ['ob2-json', 'ob2-png', 'ob2-svg', 'ob3-jws', 'manual']; // C7.20
export const EXPORT_FORMATS = ['badge-png', 'badge-svg', 'certificate-png',
  'certificate-pdf', 'profile-png', 'group-png'];                                 // C7.21
export const WALLET_GROUPS = ['all', 'neorgon', 'community', 'recognition', 'imported']; // C7.22

export const CENTRE_KINDS = ['glyph', 'image', 'none'];
export const PROVENANCE_MODES = ['award', 'preview'];

export const HEX_RE = /^#[0-9a-f]{6}$/;
export const PUBLIC_ID_RE = /^[0-9abcdefghjkmnpqrstvwxyz]{10}$/;                  // C4.1
export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,29}$/;                             // C4.2
export const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

// ISO A series. Both certificate orientations hold it so print-to-PDF against A4
// is exact; US Letter is 1.294 and letterboxes rather than stretching (R4 1.6).
export const CERT_ASPECT = 1.4142;
const ASPECT_TOLERANCE = 0.004;

/* ── helpers ───────────────────────────────────────────────────────────────── */

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, dflt) => (typeof v === 'number' && Number.isFinite(v) ? v : dflt);
const int = (v, dflt) => (typeof v === 'number' && Number.isInteger(v) ? v : dflt);
const str = (v, dflt) => (typeof v === 'string' ? xmlSafe(v) : dflt);   // strips what XML cannot hold
const bool = (v, dflt) => (typeof v === 'boolean' ? v : dflt);
const hex = (v, dflt) => (typeof v === 'string' && HEX_RE.test(v) ? v : dflt);
const oneOf = (v, list, dflt) => (list.includes(v) ? v : dflt);

const DEFAULT_PALETTE = { base: '#7c3aed', accent: '#f5d67b', ink: '#0b1020', metal: 'none' };

function normPalette(raw, defaults) {
  const p = isObj(raw) ? raw : {};
  return {
    base: hex(p.base, defaults.base),
    accent: hex(p.accent, defaults.accent),
    ink: hex(p.ink, defaults.ink),
    metal: oneOf(p.metal, METALS, 'none'),
  };
}

function normText(raw, dflt) {
  const t = isObj(raw) ? raw : {};
  return {
    value: str(t.value, dflt.value),
    font: oneOf(t.font, FONT_ROLES, dflt.font),
    size: num(t.size, dflt.size),
    color: hex(t.color, dflt.color),
  };
}

/* ── normalizeDesign ───────────────────────────────────────────────────────── */

/** Fill defaults so every consumer can trust the shape. Never throws. */
export function normalizeDesign(raw) {
  const d = isObj(raw) ? raw : {};
  return d.kind === 'certificate' ? normalizeCertificate(d) : normalizeBadge(d);
}

function normalizeBadge(d) {
  const palette = normPalette(d.palette, DEFAULT_PALETTE);
  const size = isObj(d.size) ? d.size : {};
  const rings = Array.isArray(d.rings) ? d.rings : [];
  const pattern = isObj(d.pattern) ? d.pattern : {};
  const arcs = isObj(d.arcs) ? d.arcs : {};
  const centre = isObj(d.centre) ? d.centre : {};
  const pips = isObj(d.pips) ? d.pips : {};
  const mark = isObj(d.mark) ? d.mark : {};

  return {
    schemaVersion: int(d.schemaVersion, SCHEMA_VERSION),
    kind: 'badge',
    size: { w: int(size.w, 512), h: int(size.h, 512) },
    palette,
    shape: oneOf(d.shape, SHAPE_IDS, 'hexagon'),
    rings: rings.filter(isObj).map((r) => ({
      style: oneOf(r.style, RING_STYLES, 'solid'),
      width: num(r.width, 12),
      color: hex(r.color, palette.accent),
      inset: num(r.inset, 0),
    })),
    pattern: {
      kind: oneOf(pattern.kind, PATTERN_KINDS, 'none'),
      color: hex(pattern.color, '#ffffff'),
      opacity: num(pattern.opacity, 0.15),
      scale: num(pattern.scale, 1),
    },
    arcs: { top: normArc(arcs.top), bottom: normArc(arcs.bottom) },
    centre: {
      kind: oneOf(centre.kind, CENTRE_KINDS, 'glyph'),
      glyph: str(centre.glyph, 'star'),
      imageRef: typeof centre.imageRef === 'string' ? centre.imageRef : null,
      color: hex(centre.color, '#ffffff'),
      scale: num(centre.scale, 1),
      dy: num(centre.dy, 0),
    },
    ribbon: normRibbon(d.ribbon, palette),
    pips: {
      count: int(pips.count, 0),
      max: int(pips.max, 5),
      style: oneOf(pips.style, PIP_STYLES, 'dot'),
      color: hex(pips.color, palette.accent),
    },
    mark: {
      edition: str(mark.edition, ''),
      year: typeof mark.year === 'number' ? int(mark.year, null) : null,
    },
    layers: Array.isArray(d.layers) ? d.layers : [],
  };
}

function normArc(raw) {
  if (!isObj(raw)) return null;
  return {
    text: str(raw.text, ''),
    font: oneOf(raw.font, FONT_ROLES, 'display'),
    size: num(raw.size, 36),
    tracking: num(raw.tracking, 2),
    color: hex(raw.color, '#ffffff'),
  };
}

function normRibbon(raw, palette) {
  if (!isObj(raw)) return null;
  return {
    text: str(raw.text, ''),
    color: hex(raw.color, palette.accent),
    textColor: hex(raw.textColor, palette.ink),
    font: oneOf(raw.font, FONT_ROLES, 'sans'),
    size: num(raw.size, 24),
  };
}

const CERT_TEXT_DEFAULTS = {
  eyebrow:     { value: 'CERTIFICATE OF', font: 'sans',    size: 34, color: '#9aa3d0' },
  title:       { value: 'ACHIEVEMENT',    font: 'display', size: 96, color: '#e7e9ff' },
  holderLabel: { value: 'awarded to',     font: 'sans',    size: 28, color: '#9aa3d0' },
  holder:      { value: '',               font: 'script',  size: 84, color: '#e7e9ff' },
  issuerLine:  { value: '',               font: 'sans',    size: 26, color: '#9aa3d0' },
  body:        { value: '',               font: 'sans',    size: 26, color: '#c3c8ea' },
  dateLabel:   { value: 'issued',         font: 'sans',    size: 22, color: '#9aa3d0' },
};

export const CERT_TEXT_KEYS = Object.keys(CERT_TEXT_DEFAULTS);

function normalizeCertificate(d) {
  const orientation = oneOf(d.orientation, ORIENTATIONS, 'landscape');
  const size = isObj(d.size) ? d.size : {};
  const defW = orientation === 'portrait' ? 1191 : 1684;
  const defH = orientation === 'portrait' ? 1684 : 1191;
  const palette = normPalette(d.palette, { base: '#0b1020', accent: '#7c3aed', ink: '#e7e9ff', metal: 'none' });
  const bg = isObj(d.background) ? d.background : {};
  const frame = isObj(d.frame) ? d.frame : {};
  const seal = isObj(d.seal) ? d.seal : {};
  const text = isObj(d.text) ? d.text : {};
  const serial = isObj(d.serial) ? d.serial : {};
  const verify = isObj(d.verify) ? d.verify : {};
  const sigs = Array.isArray(d.signatures) ? d.signatures : [];

  const out = {
    schemaVersion: int(d.schemaVersion, SCHEMA_VERSION),
    kind: 'certificate',
    orientation,
    size: { w: int(size.w, defW), h: int(size.h, defH) },
    palette,
    background: {
      kind: oneOf(bg.kind, CERT_BACKGROUNDS, 'plain'),
      color: hex(bg.color, palette.accent),
      opacity: num(bg.opacity, 0.2),
      scale: num(bg.scale, 1),
    },
    frame: {
      style: oneOf(frame.style, CERT_FRAMES, 'single'),
      width: num(frame.width, 12),
      color: hex(frame.color, palette.accent),
      inset: num(frame.inset, 40),
    },
    seal: {
      design: isObj(seal.design) ? normalizeBadge(seal.design) : null,
      x: num(seal.x, 0.5),
      y: num(seal.y, 0.78),
      size: num(seal.size, 220),
    },
    text: {},
    signatures: sigs.filter(isObj).slice(0, 2).map((s) => ({
      name: str(s.name, ''), role: str(s.role, ''),
    })),
    serial: {
      show: bool(serial.show, true),
      font: oneOf(serial.font, FONT_ROLES, 'mono'),
      size: num(serial.size, 20),
      color: hex(serial.color, '#9aa3d0'),
    },
    verify: {
      show: bool(verify.show, true),
      qr: bool(verify.qr, true),
      size: num(verify.size, 120),
    },
    layers: Array.isArray(d.layers) ? d.layers : [],
  };
  for (const k of CERT_TEXT_KEYS) out.text[k] = normText(text[k], CERT_TEXT_DEFAULTS[k]);
  return out;
}

/* ── validateDesign ────────────────────────────────────────────────────────── */

const range = (out, label, v, lo, hi) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) out.push(`${label} must be a number between ${lo} and ${hi}, got ${JSON.stringify(v)}`);
};
const enumOf = (out, label, v, list) => {
  if (!list.includes(v)) out.push(`${label} must be one of ${list.join(', ')}, got ${JSON.stringify(v)}`);
};
const colour = (out, label, v) => {
  if (!HEX_RE.test(String(v))) out.push(`${label} must be lowercase six-digit hex like #7c3aed, got ${JSON.stringify(v)}`);
};
const maxLen = (out, label, v, n) => {
  if (typeof v !== 'string') out.push(`${label} must be a string`);
  else if ([...v].length > n) out.push(`${label} must be ${n} characters or fewer, got ${[...v].length}`);
  else if (hasControl(v)) out.push(`${label} must not contain control characters: XML cannot hold them, so the export would fail`);
};

/** Returns an array of human-readable problems. Empty array means valid. */
export function validateDesign(design) {
  const out = [];
  if (!isObj(design)) return ['design must be an object'];
  if (design.schemaVersion !== SCHEMA_VERSION) {
    out.push(`schemaVersion must be ${SCHEMA_VERSION}, got ${JSON.stringify(design.schemaVersion)}. A higher version is refused, not migrated.`);
  }
  enumOf(out, 'kind', design.kind, KINDS);
  if (!Array.isArray(design.layers) || design.layers.length > 0) {
    out.push('layers is reserved for a v2 freeform mode and must be the empty array in v1');
  }
  const size = isObj(design.size) ? design.size : {};
  range(out, 'size.w', size.w, 128, 2048);
  range(out, 'size.h', size.h, 128, 2048);
  const p = isObj(design.palette) ? design.palette : {};
  for (const k of ['base', 'accent', 'ink']) colour(out, `palette.${k}`, p[k]);
  enumOf(out, 'palette.metal', p.metal, METALS);

  if (design.kind === 'certificate') validateCertificate(design, out);
  else validateBadge(design, out);
  return out;
}

function validateBadge(d, out) {
  enumOf(out, 'shape', d.shape, SHAPE_IDS);
  const rings = Array.isArray(d.rings) ? d.rings : [];
  if (!Array.isArray(d.rings)) out.push('rings must be an array');
  if (rings.length > 3) out.push(`rings holds at most 3 items, got ${rings.length}`);
  rings.forEach((r, i) => {
    enumOf(out, `rings[${i}].style`, r.style, RING_STYLES);
    range(out, `rings[${i}].width`, r.width, 1, 64);
    colour(out, `rings[${i}].color`, r.color);
    range(out, `rings[${i}].inset`, r.inset, 0, 128);
  });
  const pat = isObj(d.pattern) ? d.pattern : {};
  enumOf(out, 'pattern.kind', pat.kind, PATTERN_KINDS);
  colour(out, 'pattern.color', pat.color);
  range(out, 'pattern.opacity', pat.opacity, 0, 1);
  range(out, 'pattern.scale', pat.scale, 0.25, 4);

  const arcs = isObj(d.arcs) ? d.arcs : {};
  for (const side of ['top', 'bottom']) {
    const a = arcs[side];
    if (a === null || a === undefined) continue;
    if (!isObj(a)) { out.push(`arcs.${side} must be an object or null`); continue; }
    maxLen(out, `arcs.${side}.text`, a.text, 48);
    enumOf(out, `arcs.${side}.font`, a.font, FONT_ROLES);
    range(out, `arcs.${side}.size`, a.size, 8, 120);
    range(out, `arcs.${side}.tracking`, a.tracking, -8, 24);
    colour(out, `arcs.${side}.color`, a.color);
  }

  const c = isObj(d.centre) ? d.centre : {};
  enumOf(out, 'centre.kind', c.kind, CENTRE_KINDS);
  if (c.kind === 'glyph' && !c.glyph) out.push('centre.glyph is required when centre.kind is glyph');
  if (c.kind === 'image' && typeof c.imageRef !== 'string') {
    out.push('centre.imageRef is required when centre.kind is image, and it is a storage id, never a URL');
  }
  colour(out, 'centre.color', c.color);
  range(out, 'centre.scale', c.scale, 0.2, 2);
  range(out, 'centre.dy', c.dy, -128, 128);

  if (d.ribbon !== null && d.ribbon !== undefined) {
    if (!isObj(d.ribbon)) out.push('ribbon must be an object or null');
    else {
      maxLen(out, 'ribbon.text', d.ribbon.text, 24);
      colour(out, 'ribbon.color', d.ribbon.color);
      colour(out, 'ribbon.textColor', d.ribbon.textColor);
      enumOf(out, 'ribbon.font', d.ribbon.font, FONT_ROLES);
      range(out, 'ribbon.size', d.ribbon.size, 8, 64);
    }
  }
  const pips = isObj(d.pips) ? d.pips : {};
  range(out, 'pips.count', pips.count, 0, 10);
  range(out, 'pips.max', pips.max, 1, 10);
  enumOf(out, 'pips.style', pips.style, PIP_STYLES);
  colour(out, 'pips.color', pips.color);
  const mark = isObj(d.mark) ? d.mark : {};
  maxLen(out, 'mark.edition', mark.edition, 16);
  if (mark.year !== null && mark.year !== undefined) range(out, 'mark.year', mark.year, 1900, 2999);
}

function validateCertificate(d, out) {
  enumOf(out, 'orientation', d.orientation, ORIENTATIONS);
  const size = isObj(d.size) ? d.size : {};
  if (Number.isFinite(size.w) && Number.isFinite(size.h) && size.w > 0 && size.h > 0) {
    const aspect = d.orientation === 'portrait' ? size.h / size.w : size.w / size.h;
    if (Math.abs(aspect - CERT_ASPECT) > ASPECT_TOLERANCE) {
      out.push(`certificate aspect is fixed at ${CERT_ASPECT} (ISO A series) so print to A4 is exact, got ${aspect.toFixed(4)}`);
    }
  }
  const bg = isObj(d.background) ? d.background : {};
  enumOf(out, 'background.kind', bg.kind, CERT_BACKGROUNDS);
  colour(out, 'background.color', bg.color);
  range(out, 'background.opacity', bg.opacity, 0, 1);
  range(out, 'background.scale', bg.scale, 0.25, 4);
  const f = isObj(d.frame) ? d.frame : {};
  enumOf(out, 'frame.style', f.style, CERT_FRAMES);
  range(out, 'frame.width', f.width, 1, 64);
  colour(out, 'frame.color', f.color);
  range(out, 'frame.inset', f.inset, 0, 200);
  const s = isObj(d.seal) ? d.seal : {};
  range(out, 'seal.x', s.x, 0, 1);
  range(out, 'seal.y', s.y, 0, 1);
  range(out, 'seal.size', s.size, 60, 600);
  if (s.design !== null && s.design !== undefined) {
    if (!isObj(s.design)) out.push('seal.design must be a badge design document or null');
    else for (const problem of validateDesign(s.design)) out.push(`seal.design: ${problem}`);
  }
  const t = isObj(d.text) ? d.text : {};
  for (const k of CERT_TEXT_KEYS) {
    const v = t[k];
    if (!isObj(v)) { out.push(`text.${k} must be an object`); continue; }
    if (typeof v.value !== 'string') out.push(`text.${k}.value must be a string`);
    else if (hasControl(v.value)) out.push(`text.${k}.value must not contain control characters: XML cannot hold them, so the export would fail`);
    enumOf(out, `text.${k}.font`, v.font, FONT_ROLES);
    range(out, `text.${k}.size`, v.size, 8, 200);
    colour(out, `text.${k}.color`, v.color);
  }
  const sigs = Array.isArray(d.signatures) ? d.signatures : [];
  if (!Array.isArray(d.signatures)) out.push('signatures must be an array');
  if (sigs.length > 2) out.push(`signatures holds at most 2 items, got ${sigs.length}`);
  sigs.forEach((s, i) => { if (isObj(s) && (hasControl(s.name) || hasControl(s.role))) out.push(`signatures[${i}] must not contain control characters`); });
  const ser = isObj(d.serial) ? d.serial : {};
  enumOf(out, 'serial.font', ser.font, FONT_ROLES);
  range(out, 'serial.size', ser.size, 8, 64);
  colour(out, 'serial.color', ser.color);
  const ver = isObj(d.verify) ? d.verify : {};
  range(out, 'verify.size', ver.size, 60, 400);
}

/* ── provenance (C1.3), required at draw time ──────────────────────────────── */

/** Returns an array of human-readable problems. Empty array means valid. */
export function validateProvenance(prov) {
  const out = [];
  if (!isObj(prov)) return ['provenance is required at draw time and must be an object (C1.3)'];
  enumOf(out, 'provenance.origin', prov.origin, ORIGINS);
  enumOf(out, 'provenance.mode', prov.mode, PROVENANCE_MODES);
  // A6. An imported credential was not issued here, so it has no Sash issuing
  // handle: the value is null, never an empty string. Refusing the empty string
  // is the point of the amendment, which traded five differently shaped empty
  // values for one null.
  if (prov.origin === 'imported') {
    if (prov.issuerHandle !== null && prov.issuerHandle !== undefined) {
      out.push('provenance.issuerHandle must be null when origin is imported: an import has no Sash issuer');
    }
  } else if (typeof prov.issuerHandle !== 'string' || !prov.issuerHandle) {
    out.push('provenance.issuerHandle is required');
  }
  if (prov.origin === 'neorgon' && prov.issuerHandle !== 'neorgon') {
    out.push('provenance.issuerHandle must be "neorgon" when origin is neorgon');
  }
  if (typeof prov.holder !== 'string') out.push('provenance.holder must be a string, empty when unknown');
  const preview = prov.mode === 'preview';
  if (typeof prov.serial !== 'string' || (!preview && !PUBLIC_ID_RE.test(prov.serial))) {
    out.push('provenance.serial must be a 10-character public id, empty only in preview mode');
  }
  if (typeof prov.verifyUrl !== 'string' || (!preview && !/^https:\/\/\S+$/.test(prov.verifyUrl))) {
    out.push('provenance.verifyUrl must be an absolute https URL, empty only in preview mode');
  }
  for (const k of ['issuedAt', 'expiresAt']) {
    const v = prov[k];
    if (v === null || v === undefined) continue;
    if (typeof v !== 'string' || !ISO_UTC_RE.test(v)) out.push(`provenance.${k} must be ISO 8601 UTC with Z, or null`);
  }
  return out;
}

/* ── the provenance strings both the badge and the certificate draw ────────── */

// C11.2. Frozen: the same three items appear on every artefact, so a reader who
// has only the exported pixels can still see the origin, the issuing handle and
// the verify URL.
//
// A14 amended what the first item says. The band names the artefact it is
// stamped on, so a certificate reads COMMUNITY CERTIFICATE and never COMMUNITY
// BADGE. The band is a legal-risk control before it is a design element, and one
// that mislabels the object it is printed on argues against its own claim.
export const ORIGIN_WORDS = { neorgon: 'NEORGON', community: 'COMMUNITY', imported: 'IMPORTED' };
export const ARTEFACT_WORDS = { badge: 'BADGE', certificate: 'CERTIFICATE' };
const PREVIEW_SERIAL = 'preview, not yet issued';
const PREVIEW_URL = 'sash.neorgon.com/badge.html?id=...';

/**
 * The origin word and the artefact word, as one string: `COMMUNITY CERTIFICATE`.
 *
 * It throws on a pair it has no wording for rather than picking one. The version
 * this replaced fell back to `COMMUNITY BADGE` for anything it did not know,
 * which is how a third origin would have been stamped with the label of the
 * second, and how a certificate came to be labelled a badge in the first place.
 */
export function originLabel(origin, kind) {
  const word = ORIGIN_WORDS[origin];
  const artefact = ARTEFACT_WORDS[kind];
  if (!word || !artefact) {
    throw new TypeError(`no provenance wording for origin ${JSON.stringify(origin)} on a ${JSON.stringify(kind)} (C11.2)`);
  }
  return `${word} ${artefact}`;
}

/** The two lines of the provenance strip. Drawn in both modes, never optional. */
export function provenanceLines(prov, kind) {
  const label = originLabel(prov.origin, kind);
  // An imported credential carries `issuerHandle: null` (A6). A null is drawn as
  // nothing at all, never as `@null` and never as a bare `@`.
  const handle = typeof prov.issuerHandle === 'string' && prov.issuerHandle ? `@${xmlSafe(prov.issuerHandle)}` : '';
  return {
    top: handle ? `${label}   ${handle}` : label,
    bottom: prov.mode === 'preview' ? `${PREVIEW_URL}   ${PREVIEW_SERIAL}` : xmlSafe(prov.verifyUrl),
  };
}

/** { width, height } in user units, from design.size. */
export function designSize(design) {
  const d = normalizeDesign(design);
  return { width: d.size.w, height: d.size.h };
}

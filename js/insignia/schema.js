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
 *
 * Design round 2 (2026-09-15) moved the C7 lists to `enums.js` and the
 * provenance wording and validator to `provenance.js`. Both are re-exported
 * here in full, so every importer of this module reads what it always did.
 * Every field the round added is optional, defaults to the value that
 * reproduces the previous drawing, and is filled by `normalizeDesign`, which
 * is what "additive" means and what the additivity test in
 * `tests/insignia.test.mjs` proves.
 */

import { xmlSafe, hasControl } from './patterns.js';
import {
  KINDS, ORIENTATIONS, SHAPE_IDS, METALS, RING_STYLES, PATTERN_KINDS, PIP_STYLES, FONT_ROLES,
  CERT_BACKGROUNDS, CERT_FRAMES, CENTRE_KINDS, FINISH_KINDS, CENTRE_STYLES, CENTRE_FITS,
  CENTRE_MASKS, CENTRE_PLATES, CENTRE_TONES, CERT_LATENTS, SIGNATURE_SOURCES, SERIAL_STYLES,
} from './enums.js';

export * from './enums.js';
export * from './provenance.js';

export const SCHEMA_VERSION = 1;

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

export const HEX_RE = /^#[0-9a-f]{6}$/;
export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,29}$/;                             // C4.2

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
  const pips = isObj(d.pips) ? d.pips : {};
  const mark = isObj(d.mark) ? d.mark : {};
  const finish = isObj(d.finish) ? d.finish : {};

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
      fade: num(pattern.fade, 0),
    },
    finish: {
      kind: oneOf(finish.kind, FINISH_KINDS, 'none'),
      strength: num(finish.strength, 0.6),
    },
    arcs: { top: normArc(arcs.top), bottom: normArc(arcs.bottom) },
    centre: normCentre(d.centre, palette),
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

// Round 2 (C1.1): every key after `dy` is new, and every default is the value
// that draws what shipped before the key existed. `plateColor` follows the ink
// and `toneColor` follows the glyph colour, both resolved here so a consumer
// never sees a null.
function normCentre(raw, palette) {
  const c = isObj(raw) ? raw : {};
  const color = hex(c.color, '#ffffff');
  return {
    kind: oneOf(c.kind, CENTRE_KINDS, 'glyph'),
    glyph: str(c.glyph, 'star'),
    imageRef: typeof c.imageRef === 'string' ? c.imageRef : null,
    color,
    scale: num(c.scale, 1),
    dy: num(c.dy, 0),
    dx: num(c.dx, 0),
    style: oneOf(c.style, CENTRE_STYLES, 'line'),
    fit: oneOf(c.fit, CENTRE_FITS, 'cover'),
    mask: oneOf(c.mask, CENTRE_MASKS, 'circle'),
    plate: oneOf(c.plate, CENTRE_PLATES, 'none'),
    plateColor: hex(c.plateColor, palette.ink),
    tone: oneOf(c.tone, CENTRE_TONES, 'full'),
    toneColor: hex(c.toneColor, color),
    rotation: num(c.rotation, 0),
    opacity: num(c.opacity, 1),
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
  const stamp = isObj(d.stamp) ? d.stamp : {};
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
      fade: num(bg.fade, 0),
      grain: num(bg.grain, 0),
      latent: oneOf(bg.latent, CERT_LATENTS, 'none'),
    },
    frame: {
      style: oneOf(frame.style, CERT_FRAMES, 'single'),
      width: num(frame.width, 12),
      color: hex(frame.color, palette.accent),
      inset: num(frame.inset, 40),
      microtext: bool(frame.microtext, false),
    },
    seal: {
      design: isObj(seal.design) ? normalizeBadge(seal.design) : null,
      x: num(seal.x, 0.5),
      y: num(seal.y, 0.78),
      size: num(seal.size, 220),
    },
    // Round 2 (C1.2). Off by default; every string it draws is provenance.
    stamp: {
      show: bool(stamp.show, false),
      x: num(stamp.x, 0.24),
      y: num(stamp.y, 0.80),
      size: num(stamp.size, 180),
    },
    text: {},
    signatures: sigs.filter(isObj).slice(0, 2).map((s) => ({
      name: str(s.name, ''), role: str(s.role, ''),
      from: oneOf(s.from, SIGNATURE_SOURCES, 'text'),
    })),
    serial: {
      show: bool(serial.show, true),
      font: oneOf(serial.font, FONT_ROLES, 'mono'),
      size: num(serial.size, 20),
      color: hex(serial.color, '#9aa3d0'),
      style: oneOf(serial.style, SERIAL_STYLES, 'quiet'),
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
const flag = (out, label, v) => {
  if (typeof v !== 'boolean') out.push(`${label} must be a boolean, got ${JSON.stringify(v)}`);
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
  range(out, 'pattern.fade', pat.fade, 0, 1);
  const fin = isObj(d.finish) ? d.finish : {};
  enumOf(out, 'finish.kind', fin.kind, FINISH_KINDS);
  range(out, 'finish.strength', fin.strength, 0, 1);

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
  range(out, 'centre.dx', c.dx, -128, 128);
  enumOf(out, 'centre.style', c.style, CENTRE_STYLES);
  enumOf(out, 'centre.fit', c.fit, CENTRE_FITS);
  enumOf(out, 'centre.mask', c.mask, CENTRE_MASKS);
  enumOf(out, 'centre.plate', c.plate, CENTRE_PLATES);
  colour(out, 'centre.plateColor', c.plateColor);
  enumOf(out, 'centre.tone', c.tone, CENTRE_TONES);
  colour(out, 'centre.toneColor', c.toneColor);
  range(out, 'centre.rotation', c.rotation, -180, 180);
  range(out, 'centre.opacity', c.opacity, 0, 1);

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
  range(out, 'background.fade', bg.fade, 0, 1);
  range(out, 'background.grain', bg.grain, 0, 0.2);
  enumOf(out, 'background.latent', bg.latent, CERT_LATENTS);
  const f = isObj(d.frame) ? d.frame : {};
  enumOf(out, 'frame.style', f.style, CERT_FRAMES);
  range(out, 'frame.width', f.width, 1, 64);
  colour(out, 'frame.color', f.color);
  range(out, 'frame.inset', f.inset, 0, 200);
  flag(out, 'frame.microtext', f.microtext);
  const s = isObj(d.seal) ? d.seal : {};
  range(out, 'seal.x', s.x, 0, 1);
  range(out, 'seal.y', s.y, 0, 1);
  range(out, 'seal.size', s.size, 60, 600);
  if (s.design !== null && s.design !== undefined) {
    if (!isObj(s.design)) out.push('seal.design must be a badge design document or null');
    else for (const problem of validateDesign(s.design)) out.push(`seal.design: ${problem}`);
  }
  const st = isObj(d.stamp) ? d.stamp : {};
  flag(out, 'stamp.show', st.show);
  range(out, 'stamp.x', st.x, 0, 1);
  range(out, 'stamp.y', st.y, 0, 1);
  range(out, 'stamp.size', st.size, 100, 300);
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
  sigs.forEach((sig, i) => {
    if (!isObj(sig)) return;
    if (hasControl(sig.name) || hasControl(sig.role)) out.push(`signatures[${i}] must not contain control characters`);
    enumOf(out, `signatures[${i}].from`, sig.from, SIGNATURE_SOURCES);
  });
  const ser = isObj(d.serial) ? d.serial : {};
  enumOf(out, 'serial.font', ser.font, FONT_ROLES);
  range(out, 'serial.size', ser.size, 8, 64);
  colour(out, 'serial.color', ser.color);
  enumOf(out, 'serial.style', ser.style, SERIAL_STYLES);
  const ver = isObj(d.verify) ? d.verify : {};
  range(out, 'verify.size', ver.size, 60, 400);
}

/** { width, height } in user units, from design.size. */
export function designSize(design) {
  const d = normalizeDesign(design);
  return { width: d.size.w, height: d.size.h };
}

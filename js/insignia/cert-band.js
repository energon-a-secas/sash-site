/**
 * Insignia Kit: the certificate's frame and its provenance band (C1.2, C11.2).
 *
 * Two call points, frozen by design round 2's plan (section 1.4) and filled by
 * workstream K3:
 *
 *   drawFrame(root, defs, d)                               the five C7.16 frames
 *   drawBand(root, defs, d, prov, textNode, qrNode)        the band: origin word,
 *                                                          handle, verify URL,
 *                                                          serial, QR
 *
 *   bandRuns(d, prov)                                      every `{ field, role,
 *                                                          text }` the band draws
 *                                                          beyond its two lines
 *
 * `drawFrame` is the drawing that shipped, moved out of `certificate.js`
 * unchanged. `drawBand` reads `serial.style` (C7.31): `quiet` keeps the band
 * that shipped byte for byte, quiet zone 2 included, and `loud` restyles its
 * right end as the record block: `No.` and the serial at 34 to 40 units in
 * the mono role and the accent colour (the red-serial convention), the QR at
 * the spec's own quiet zone of 4 modules inside a hairline crop-mark frame, a
 * 4-unit mono caption saying where the code goes for a reader who does not
 * scan, and the issued and valid-until dates as a two-column table, moved off
 * the body's date line. Text, rects and lines only: the block adds no def, so
 * a filter budget spent elsewhere on the page is not spent here.
 *
 * Every string the block draws is provenance or the author's own date label.
 * The serial is the C4.1 public id, the caption's host is read from the verify
 * URL so the two cannot name different sites, and the dates are the award's.
 * `bandRuns` and `drawBand` read the same `recordBlock`, so the `&text=`
 * subset the exporter asks for cannot drift from the characters drawn (C6.3).
 * `frame.microtext` is drawn by `security.js`, not here, and `bandGeometry`
 * is what that module keeps clear of.
 *
 * `textNode` and `qrNode` arrive as arguments, as they did before the split:
 * `render.js` hands the certificate its text primitive so both artefacts set
 * type through one function, and `qr.js` is the encoder.
 */
import { svgEl, n, xmlSafe } from './patterns.js';
import { provenanceLines, formatDate } from './provenance.js';
import { fitMono, MONO_ADV } from './strip.js';

/** The frame named by `frame.style`. Appends to `root`; returns nothing. */
export function drawFrame(root, defs, d) {
  void defs;   // a gradient stroke or a bevel would live here, under an A12 id (K3)
  const { w, h } = d.size;
  const f = d.frame;
  if (f.style === 'none') return;
  const box = (inset, width, extra = {}) => svgEl('rect', {
    x: n(inset), y: n(inset), width: n(w - inset * 2), height: n(h - inset * 2),
    fill: 'none', stroke: f.color, 'stroke-width': n(width), ...extra,
  });
  if (f.style === 'double') {
    root.appendChild(box(f.inset, f.width * 0.42));
    root.appendChild(box(f.inset + f.width * 1.4, f.width * 0.42));
    return;
  }
  if (f.style === 'rope') {
    root.appendChild(box(f.inset, f.width * 0.5, { 'stroke-dasharray': `${n(f.width * 1.2)} ${n(f.width * 1.2)}` }));
    root.appendChild(box(f.inset + f.width * 0.6, f.width * 0.5, {
      'stroke-dasharray': `${n(f.width * 1.2)} ${n(f.width * 1.2)}`, 'stroke-dashoffset': n(f.width * 1.2),
    }));
    return;
  }
  if (f.style === 'corner') {
    const i = f.inset;
    const len = Math.min(w, h) * 0.18;
    const corner = (x, y, dx, dy) =>
      `M${n(x + dx * len)} ${n(y)} H${n(x)} V${n(y + dy * len)}`;
    const d2 = [
      corner(i, i, 1, 1), corner(w - i, i, -1, 1),
      corner(i, h - i, 1, -1), corner(w - i, h - i, -1, -1),
    ].join(' ');
    root.appendChild(svgEl('path', {
      d: d2, fill: 'none', stroke: f.color, 'stroke-width': n(f.width), 'stroke-linecap': 'square',
    }));
    return;
  }
  root.appendChild(box(f.inset, f.width));
}

/** Where the band sits: `{ pad, bandH, top }`, so the security print can keep clear of it. */
export function bandGeometry(d) {
  const pad = d.frame.inset + 26;
  const bandH = 96;
  return { pad, bandH, top: d.size.h - pad - bandH };
}

/* ── the record block (serial.style loud) ──────────────────────────────────── */

const SERIAL_PREFIX = 'No. ';
const SERIAL_NOMINAL = 40, SERIAL_MIN = 34;   // the plan's 34 to 40 units, fitted by MONO_ADV arithmetic
const RECORD_W = 340;                         // `No.` plus a ten-character public id at 40 is 336.6
const ROW_SIZE = 15;                          // the date table
const ROW_GAP = 10;                           // between the label column and the value column
const CAPTION_SIZE = 4;                       // the microtext size, as the plan sets it
const QR_QUIET = 4;                           // ISO/IEC 18004's own margin; the quiet band keeps 2
const QR_GAP = 24;                            // between the QR plate and the band, as the quiet band keeps it
const CROP_GAP = 4, CROP_LEN = 10;            // a crop mark stands off the plate and is this long
const VALID_UNTIL = 'valid until';
const CAPTION_HOST = 'sash.neorgon.com';      // when the provenance carries no verify URL to read one from

/** The host the verify URL names, without the scheme, or the fallback. */
function hostOf(prov) {
  const m = /^https?:\/\/([^/?#]+)/.exec(typeof prov.verifyUrl === 'string' ? prov.verifyUrl : '');
  return m ? xmlSafe(m[1]) : CAPTION_HOST;
}

/**
 * What the loud block draws, as data, read by `drawBand` and `bandRuns` alike:
 * `serial` (the fitted `No.` line, or null), `caption` (or null when there is
 * no QR to caption), `rows` (the date table, label and value, empty when the
 * award carries no date) and `qr` (whether the code is drawn). The flags
 * follow the quiet band's: at award time a `false` is ignored and the serial
 * and the code are drawn (C11.2); the code needs a verify URL, which a bare
 * preview provenance does not carry.
 */
export function recordBlock(d, prov) {
  const award = prov.mode === 'award';
  const showSerial = award ? true : d.serial.show;
  const qr = Boolean(d.verify.qr && prov.verifyUrl);
  let serial = null;
  if (showSerial && prov.serial) {
    const text = `${SERIAL_PREFIX}${xmlSafe(prov.serial)}`;
    const fit = fitMono(text, { inner: RECORD_W, nominal: SERIAL_NOMINAL, min: SERIAL_MIN });
    serial = { text, size: fit.size, textLength: fit.textLength };
  }
  const rows = [];
  const issued = formatDate(prov.issuedAt);
  const until = formatDate(prov.expiresAt);
  if (issued) rows.push({ label: d.text.dateLabel.value, value: issued });
  if (until) rows.push({ label: VALID_UNTIL, value: until });
  return { serial, caption: qr ? `scan to verify, ${hostOf(prov)}` : null, rows, qr };
}

/**
 * Every `{ field, role, text }` the band draws beyond its two provenance lines
 * (which `textRuns` in render.js reports itself): the serial in both styles,
 * and in the loud style the caption and the date table. The fields are the
 * ones `fieldLabel` already names: `serial`, `provenance`, `text.dateLabel`.
 */
export function bandRuns(d, prov) {
  if (d.serial.style !== 'loud') {
    const show = prov.mode !== 'award' ? d.serial.show : true;
    return show && prov.serial ? [{ field: 'serial', role: d.serial.font, text: xmlSafe(prov.serial) }] : [];
  }
  const block = recordBlock(d, prov);
  const runs = [];
  if (block.serial) runs.push({ field: 'serial', role: 'mono', text: block.serial.text });
  if (block.caption) runs.push({ field: 'provenance', role: 'mono', text: block.caption });
  for (const row of block.rows) {
    if (row.label) runs.push({ field: 'text.dateLabel', role: d.text.dateLabel.font, text: row.label });
    runs.push({ field: 'text.dateLabel', role: 'mono', text: row.value });
  }
  return runs;
}

/** Eight hairline crop marks around the plate at (x, y) of side `size`: two per corner, standing off it, never crossing it. */
function cropMarks(x, y, size, color) {
  const parts = [];
  for (const [cx, cy, sx, sy] of [[x, y, -1, -1], [x + size, y, 1, -1], [x, y + size, -1, 1], [x + size, y + size, 1, 1]]) {
    parts.push(`M${n(cx + sx * (CROP_GAP + CROP_LEN))} ${n(cy)} L${n(cx + sx * CROP_GAP)} ${n(cy)}`);
    parts.push(`M${n(cx)} ${n(cy + sy * (CROP_GAP + CROP_LEN))} L${n(cx)} ${n(cy + sy * CROP_GAP)}`);
  }
  return svgEl('path', { d: parts.join(' '), fill: 'none', stroke: color, 'stroke-width': '1', 'stroke-opacity': '0.7' });
}

/** The record block: the QR with its marks and caption above the band's right end, the serial and the dates inside it. */
function drawRecordBlock(root, d, prov, textNode, qrNode) {
  const { w } = d.size;
  const { pad, top } = bandGeometry(d);
  const right = w - pad - 24;
  const block = recordBlock(d, prov);

  if (block.serial) {
    root.appendChild(textNode(block.serial.text, {
      x: right, y: top + 40, role: 'mono', size: block.serial.size, color: d.palette.accent, anchor: 'end',
      textLength: block.serial.textLength,
    }));
  }
  block.rows.forEach((row, i) => {
    const y = top + 64 + i * 20;
    root.appendChild(textNode(row.value, { x: right, y, role: 'mono', size: ROW_SIZE, color: d.text.body.color, anchor: 'end' }));
    if (row.label) {
      // The value column is mono, so its width is arithmetic; the label sits
      // one gap to its left and grows leftward, in the author's date-label face.
      const valueW = row.value.length * MONO_ADV * ROW_SIZE;
      root.appendChild(textNode(row.label, {
        x: right - valueW - ROW_GAP, y, role: d.text.dateLabel.font, size: ROW_SIZE, color: d.text.dateLabel.color, anchor: 'end',
      }));
    }
  });

  if (block.qr) {
    const size = d.verify.size;
    const x = right - size;
    const y = top - QR_GAP - size;
    // Black on white, never the palette, for the reason the quiet band gives.
    const qr = qrNode(prov.verifyUrl, size, '#000000', '#ffffff', { quiet: QR_QUIET });
    qr.setAttribute('transform', `translate(${n(x)} ${n(y)})`);
    root.appendChild(qr);
    root.appendChild(cropMarks(x, y, size, d.palette.ink));
    root.appendChild(textNode(block.caption, {
      x: x + size / 2, y: y + size + 12, role: 'mono', size: CAPTION_SIZE, color: d.text.body.color, anchor: 'middle',
    }));
  }
}

/**
 * The provenance band (C11.2, amended by A14): the origin word paired with the
 * artefact word, so this one reads CERTIFICATE and never BADGE, then the issuing
 * handle, the verify URL, the serial in the mono role, and the QR when the
 * design asks for one. With `serial.style` loud the right end is the record
 * block above instead.
 *
 * `serial.show` and `verify.show` are honoured only in preview mode. At award
 * time a `false` is ignored and both are drawn, which removes the whole category
 * of "the author turned it off". Appends to `root`; returns nothing.
 */
export function drawBand(root, defs, d, prov, textNode, qrNode) {
  void defs;   // the block needs no def; a filter would go here, under an A12 id
  const { w } = d.size;
  const { pad, bandH, top } = bandGeometry(d);
  const award = prov.mode === 'award';
  const showSerial = award ? true : d.serial.show;
  const showVerify = award ? true : d.verify.show;
  const lines = provenanceLines(prov, d.kind);

  root.appendChild(svgEl('rect', {
    x: n(pad), y: n(top), width: n(w - pad * 2), height: n(bandH),
    rx: '10', fill: d.palette.ink, 'fill-opacity': '0.1',
  }));
  root.appendChild(svgEl('line', {
    x1: n(pad), y1: n(top), x2: n(w - pad), y2: n(top),
    stroke: d.palette.accent, 'stroke-width': '2', 'stroke-opacity': '0.55',
  }));

  // One line, built once, in provenance.js. The badge strip and this band drew
  // the same string from two places until A14, which is how the certificate
  // came to be labelled a badge on one of them and not the other.
  root.appendChild(textNode(lines.top, {
    x: pad + 24, y: top + 40, role: 'sans', size: 26, color: d.text.eyebrow.color, anchor: 'start', tracking: 1.5,
  }));
  if (showVerify) {
    root.appendChild(textNode(lines.bottom, {
      x: pad + 24, y: top + 76, role: 'mono', size: 22, color: d.text.body.color, anchor: 'start',
    }));
  }

  if (d.serial.style === 'loud') {
    drawRecordBlock(root, d, prov, textNode, qrNode);
    return;
  }

  if (showSerial && prov.serial) {
    root.appendChild(textNode(xmlSafe(prov.serial), {
      x: w - pad - 24, y: top + 76, role: d.serial.font, size: d.serial.size, color: d.serial.color, anchor: 'end',
    }));
  }

  if (d.verify.qr && prov.verifyUrl) {
    const size = d.verify.size;
    // Black on white, never the palette. A QR is a machine-readable format
    // before it is a design element, and a certificate palette whose ink is a
    // light colour (the C1.2 default is #e7e9ff) would draw the modules onto a
    // plate of the same value and produce a blank square that still looks like
    // a QR to the author.
    const qr = qrNode(prov.verifyUrl, size, '#000000', '#ffffff');
    qr.setAttribute('transform', `translate(${n(w - pad - size)} ${n(top - 24 - size)})`);
    root.appendChild(qr);
  }
}

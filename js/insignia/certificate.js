/**
 * Insignia Kit: the certificate layout engine (C1.2) and its QR encoder.
 *
 * Called by render.js, never directly: `renderSvg` is the one drawing path, and
 * that is what makes the provenance band structural (C11.1). The engine is pure
 * geometry over the normalised document, so the same design and provenance lay
 * out identically on every call.
 *
 * `layoutText` is the single source of both what is drawn and what `usedFonts`
 * reports, so the `&text=` subset the exporter requests cannot drift from the
 * characters on the page (C6.3).
 *
 * The QR encoder is here rather than in its own module because a certificate is
 * the only artefact that draws one. Byte mode, error correction level L,
 * versions 1 to 5, which is a single error-correction block at every version and
 * therefore needs no interleaving. It refuses a payload over 106 bytes rather
 * than truncating one.
 */
import { svgEl, n, patternDefs } from './patterns.js';
import { provenanceLines } from './schema.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const HOLDER_PLACEHOLDER = 'holder name';

/** `2026-09-09T12:00:00.000Z` to `9 September 2026`. No locale lookup (C1.6). */
export function formatDate(iso) {
  if (typeof iso !== 'string' || iso.length < 10) return '';
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  if (!y || !m || !d || m < 1 || m > 12) return '';
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/* ── text layout ───────────────────────────────────────────────────────────── */

/**
 * Every string the certificate draws, positioned. `holder`, `issuerLine` and the
 * date are filled from the award: an authored `holder` is used only in the
 * editor preview, which is what C1.2 means by "filled by the renderer".
 */
export function layoutText(d, prov) {
  const { w, h } = d.size;
  const t = d.text;
  const award = prov.mode === 'award';
  const items = [];
  const put = (spec, value, y, extra = {}) => {
    if (!value) return;
    items.push({
      value: String(value), role: spec.font, size: spec.size, color: spec.color,
      x: w / 2, y, anchor: 'middle', ...extra,
    });
  };

  put(t.eyebrow, t.eyebrow.value, h * 0.20);
  put(t.title, t.title.value, h * 0.30);
  put(t.holderLabel, t.holderLabel.value, h * 0.385);
  put(t.holder, award ? prov.holder : (t.holder.value || prov.holder || HOLDER_PLACEHOLDER), h * 0.475);
  put(t.body, t.body.value, h * 0.545);

  // An imported credential carries `issuerHandle: null` (A6), so there is no
  // line to draw rather than a line reading `issued by @null`. `put` skips an
  // empty value, which is what makes the null render as nothing.
  const issuedBy = prov.issuerHandle ? `issued by @${prov.issuerHandle}` : '';
  const issuer = award || !t.issuerLine.value ? issuedBy : t.issuerLine.value;
  put(t.issuerLine, issuer, h * 0.585);

  const issued = formatDate(prov.issuedAt);
  const until = formatDate(prov.expiresAt);
  const dateLine = [
    issued ? `${t.dateLabel.value} ${issued}` : '',
    until ? `valid until ${until}` : '',
  ].filter(Boolean).join('   ');
  put(t.dateLabel, dateLine, h * 0.625);

  // Signatures sit on their own rules, in the lower third, and never in the
  // middle: the seal is centred at `seal.x` 0.5 by default and a centred
  // signature ends up underneath it.
  const sigY = h * 0.78;
  d.signatures.forEach((sig, i) => {
    const x = i === 0 ? w * 0.24 : w * 0.76;
    if (sig.name) {
      items.push({ value: sig.name, role: 'script', size: 46, color: d.palette.ink, x, y: sigY, anchor: 'middle' });
    }
    if (sig.role) {
      items.push({ value: sig.role, role: 'sans', size: 22, color: d.text.issuerLine.color, x, y: sigY + 54, anchor: 'middle' });
    }
    items.push({ rule: true, x, y: sigY + 16, width: w * 0.2 });
  });

  return items;
}

/**
 * Every {role, text} pair a certificate draws, for `usedFonts`. That includes
 * the seal, which is a whole badge design embedded by value (C1.2) and draws
 * arcs of its own.
 *
 * `sealRuns` reads a badge the way the `renderSealNode` helper draws one: this
 * module owns the certificate's own layout and neither reads nor draws a badge,
 * so render.js hands in both and the characters collected cannot disagree with
 * the characters drawn. It is **required** for a design carrying a seal and
 * this throws without it, because the alternative is a subset that omits the
 * seal's letters, a per-character fallback in the arc, and an export that
 * reports success (C6.3).
 */
export function certificateRuns(d, prov, { sealRuns } = {}) {
  const runs = layoutText(d, prov)
    .filter((i) => !i.rule)
    .map((i) => ({ role: i.role, text: i.value }));
  const show = prov.mode !== 'award' ? d.serial.show : true;
  if (show && prov.serial) runs.push({ role: d.serial.font, text: prov.serial });
  if (d.seal.design) {
    if (typeof sealRuns !== 'function') {
      throw new TypeError('certificateRuns needs a sealRuns collector to read a seal design (C6.3)');
    }
    for (const run of sealRuns(d.seal.design)) runs.push(run);
  }
  return runs;
}

/* ── drawing ───────────────────────────────────────────────────────────────── */

export function drawCertificate(root, defs, d, prov, helpers) {
  const { textNode, nextId, renderSealNode } = helpers;
  const { w, h } = d.size;

  root.appendChild(svgEl('rect', { width: n(w), height: n(h), fill: d.palette.base }));

  const bg = patternDefs(d.background.kind, {
    color: d.background.color, opacity: d.background.opacity,
    scale: d.background.scale, id: nextId('bg'),
  });
  if (bg) {
    defs.appendChild(bg);
    root.appendChild(svgEl('rect', { width: n(w), height: n(h), fill: `url(#${bg.getAttribute('id')})` }));
  }

  drawFrame(root, d);

  for (const item of layoutText(d, prov)) {
    if (item.rule) {
      root.appendChild(svgEl('line', {
        x1: n(item.x - item.width / 2), y1: n(item.y), x2: n(item.x + item.width / 2), y2: n(item.y),
        stroke: d.palette.accent, 'stroke-width': '2', 'stroke-opacity': '0.7',
      }));
      continue;
    }
    root.appendChild(textNode(item.value, item));
  }

  if (d.seal.design) {
    const size = d.seal.size;
    const seal = renderSealNode(d.seal.design, prov);
    seal.setAttribute('x', n(d.seal.x * w - size / 2));
    seal.setAttribute('y', n(d.seal.y * h - size / 2));
    seal.setAttribute('width', n(size));
    seal.setAttribute('height', n(size));
    root.appendChild(seal);
  }

  drawBand(root, d, prov, textNode);
}

function drawFrame(root, d) {
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

/**
 * The provenance band (C11.2, amended by A14): the origin word paired with the
 * artefact word, so this one reads CERTIFICATE and never BADGE, then the issuing
 * handle, the verify URL, the serial in the mono role, and the QR when the
 * design asks for one.
 *
 * `serial.show` and `verify.show` are honoured only in preview mode. At award
 * time a `false` is ignored and both are drawn, which removes the whole category
 * of "the author turned it off".
 */
function drawBand(root, d, prov, textNode) {
  const { w, h } = d.size;
  const pad = d.frame.inset + 26;
  const bandH = 96;
  const top = h - pad - bandH;
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

  // One line, built once, in schema.js. The badge strip and this band drew the
  // same string from two places until A14, which is how the certificate came to
  // be labelled a badge on one of them and not the other.
  root.appendChild(textNode(lines.top, {
    x: pad + 24, y: top + 40, role: 'sans', size: 26, color: d.text.eyebrow.color, anchor: 'start', tracking: 1.5,
  }));
  if (showVerify) {
    root.appendChild(textNode(lines.bottom, {
      x: pad + 24, y: top + 76, role: 'mono', size: 22, color: d.text.body.color, anchor: 'start',
    }));
  }
  if (showSerial && prov.serial) {
    root.appendChild(textNode(prov.serial, {
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

/* ── QR (byte mode, level L, versions 1 to 5) ──────────────────────────────── */

const EC_CODEWORDS = { 1: 7, 2: 10, 3: 15, 4: 20, 5: 26 };
const DATA_CODEWORDS = { 1: 19, 2: 34, 3: 55, 4: 80, 5: 108 };
const ALIGN_CENTRE = { 2: 18, 3: 22, 4: 26, 5: 30 };
// Format information for level L, one entry per mask, BCH(15,5) with the 0x5412 mask.
const FORMAT_L = [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976];

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// The product of (x + a^i) for i in 0..degree, highest-degree coefficient
// first, so `gen[0]` is the leading 1 and `eccOf` can index from `gen[1]`.
// Storing it the other way round produces a reversed polynomial, an ECC block
// that is wrong in every byte, and a symbol that scans as a valid-looking QR
// and decodes to nothing.
function generatorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function eccOf(data, count) {
  const gen = generatorPoly(count);
  const rem = new Array(count).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem[0];
    rem.shift();
    rem.push(0);
    for (let i = 0; i < count; i++) rem[i] ^= mul(gen[i + 1], factor);
  }
  return rem;
}

/** The module matrix for `text`, as an array of rows of 0 and 1. */
export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let version = 0;
  for (let v = 1; v <= 5; v++) {
    if (bytes.length + 2 <= DATA_CODEWORDS[v]) { version = v; break; }
  }
  if (!version) {
    throw new Error(`QR payload is ${bytes.length} bytes; this encoder tops out at 106 (version 5, level L)`);
  }
  const size = version * 4 + 17;
  const capacity = DATA_CODEWORDS[version];

  // Bit stream: mode 0100, an 8-bit length, the bytes, a terminator, then pad.
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, capacity * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  for (let i = 0; data.length < capacity; i++) data.push(i % 2 ? 0x11 : 0xec);
  const codewords = data.concat(eccOf(data, EC_CODEWORDS[version]));

  const m = Array.from({ length: size }, () => new Array(size).fill(null));
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < size && y < size) m[y][x] = v; };

  const finder = (ox, oy) => {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const on = x >= 0 && x <= 6 && y >= 0 && y <= 6
          && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
        set(ox + x, oy + y, on ? 1 : 0);
      }
    }
  };
  finder(0, 0); finder(size - 7, 0); finder(0, size - 7);

  for (let i = 8; i < size - 8; i++) {
    const on = i % 2 === 0 ? 1 : 0;
    m[6][i] = on; m[i][6] = on;
  }
  const centre = ALIGN_CENTRE[version];
  if (centre) {
    for (let y = -2; y <= 2; y++) {
      for (let x = -2; x <= 2; x++) {
        const on = Math.max(Math.abs(x), Math.abs(y)) !== 1 ? 1 : 0;
        set(centre + x, centre + y, on);
      }
    }
  }
  m[size - 8][8] = 1;                                   // the always-dark module
  // Reserve the two format areas exactly: 9 modules on each of row 8 and
  // column 8 at the top left, 8 more at each of the other two corners. One cell
  // too many here silently shifts every data module that follows.
  for (let i = 0; i < 9; i++) {
    if (m[8][i] === null) m[8][i] = 0;
    if (m[i][8] === null) m[i][8] = 0;
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][size - 1 - i] === null) m[8][size - 1 - i] = 0;
    if (m[size - 1 - i][8] === null) m[size - 1 - i][8] = 0;
  }

  const reserved = m.map((row) => row.map((v) => v !== null));
  let bit = 0;
  const stream = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) stream.push((cw >>> i) & 1);
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const upward = ((size - 1 - right) >> 1) % 2 === 0;
      const y = upward ? size - 1 - step : step;
      for (const x of [right, right - 1]) {
        if (reserved[y][x]) continue;
        m[y][x] = bit < stream.length ? stream[bit] : 0;
        bit++;
      }
    }
  }

  const maskAt = (id, x, y) => [
    (x + y) % 2 === 0,
    y % 2 === 0,
    x % 3 === 0,
    (x + y) % 3 === 0,
    (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
    ((x * y) % 2) + ((x * y) % 3) === 0,
    (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ][id];

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const cand = m.map((row, y) => row.map((v, x) => (reserved[y][x] ? v : v ^ (maskAt(mask, x, y) ? 1 : 0))));
    writeFormat(cand, mask, size);
    const score = penalty(cand, size);
    if (best === null || score < best.score) best = { score, matrix: cand };
  }
  return best.matrix;
}

function writeFormat(m, mask, size) {
  const bitsOf = FORMAT_L[mask];
  for (let i = 0; i < 15; i++) {
    const on = (bitsOf >>> i) & 1;
    if (i < 6) m[i][8] = on;
    else if (i < 8) m[i + 1][8] = on;
    else if (i === 8) m[8][7] = on;
    else m[8][14 - i] = on;
    if (i < 8) m[8][size - 1 - i] = on;
    else m[size - 15 + i][8] = on;
  }
  m[size - 8][8] = 1;
}

function penalty(m, size) {
  let score = 0;
  const runs = (get) => {
    for (let a = 0; a < size; a++) {
      let run = 1;
      for (let b = 1; b < size; b++) {
        if (get(a, b) === get(a, b - 1)) { run++; continue; }
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
      if (run >= 5) score += 3 + (run - 5);
    }
  };
  runs((a, b) => m[a][b]);
  runs((a, b) => m[b][a]);
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const v = m[y][x];
      if (v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1]) score += 3;
    }
  }
  const needle = '1011101';
  for (let a = 0; a < size; a++) {
    const row = m[a].join('');
    const col = m.map((r) => r[a]).join('');
    for (const line of [row, col]) {
      let from = line.indexOf(needle);
      while (from !== -1) {
        if (line.slice(Math.max(0, from - 4), from).includes('0000')
          || line.slice(from + 7, from + 11).includes('0000')) score += 40;
        from = line.indexOf(needle, from + 1);
      }
    }
  }
  const dark = m.reduce((sum, row) => sum + row.reduce((s, v) => s + v, 0), 0);
  score += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
  return score;
}

/** A `<g>` holding the QR for `text`, drawn `size` units square on a light plate. */
export function qrNode(text, size, darkColor, lightColor) {
  const m = qrMatrix(text);
  const modules = m.length;
  const quiet = 2;
  const unit = size / (modules + quiet * 2);
  const parts = [];
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      if (!m[y][x]) continue;
      parts.push(`M${n((x + quiet) * unit)} ${n((y + quiet) * unit)}h${n(unit)}v${n(unit)}h${n(-unit)}z`);
    }
  }
  return svgEl('g', {}, [
    svgEl('rect', { width: n(size), height: n(size), rx: n(unit), fill: lightColor }),
    svgEl('path', { d: parts.join(''), fill: darkColor }),
  ]);
}

/**
 * Insignia Kit: the QR encoder the certificate band draws with.
 *
 * Byte mode, error correction level L, versions 1 to 5, which is a single
 * error-correction block at every version and therefore needs no interleaving.
 * It refuses a payload over 106 bytes rather than truncating one.
 *
 * Lived inside `certificate.js` until design round 2 (2026-09-15), because a
 * certificate is the only artefact that draws one; it moved out so the
 * certificate module could take the round's security print under the 500-line
 * cap. `certificate.js` re-exports both names, so the tests and any importer
 * read what they always did.
 *
 * `qrNode` takes the quiet zone as an option because the loud record block
 * (C1.2 `serial.style`, K3) wants 4 where the quiet band keeps 2, byte for
 * byte.
 */
import { svgEl, n } from './patterns.js';

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

/**
 * A `<g>` holding the QR for `text`, drawn `size` units square on a light
 * plate. `quiet` is the quiet zone in modules: 2 is the band that shipped,
 * 4 is the spec's own margin and what the loud record block uses.
 */
export function qrNode(text, size, darkColor, lightColor, { quiet = 2 } = {}) {
  const m = qrMatrix(text);
  const modules = m.length;
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

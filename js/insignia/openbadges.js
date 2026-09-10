/**
 * Insignia Kit: the Open Badges codec (C9.6).
 *
 * Bakes a signed credential into a PNG or an SVG, and reads one back out of a
 * file a user uploads. Dependency-free: nothing in the fleet reads or writes a
 * PNG chunk, and this is about 90 lines of it, so no `js/vendor/` addition is
 * justified.
 *
 * Sash issues Open Badges 3.0 and never 2.0, but it parses both, because 2.0 is
 * what Credly and Badgr serve today (C9.1).
 *
 * The keywords are not interchangeable. A PNG baked with `openbadgecredential`
 * fed to an OB 2.0 reader answers "No credential inside PNG", so `unbakePng`
 * looks for all three known forms and names which one it found.
 *
 * The order is fixed and it is the trap in this file: `canvas.toBlob` writes a
 * fresh PNG datastream, so any bake applied before a canvas round trip is gone.
 * Render, export the bytes, then bake. Symmetrically, parse an uploaded PNG from
 * the File before it is ever drawn into a canvas for display.
 */

export const OB3_KEYWORD = 'openbadgecredential';
export const OB2_KEYWORD = 'openbadges';
export const OB3_NS = 'https://purl.imsglobal.org/ob/v3p0';
export const OB2_NS = 'http://openbadges.org';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/* ── CRC32 ─────────────────────────────────────────────────────────────────── */

// Reflected table form, constant 0xEDB88320, initialised to all ones, ones
// complement at the end. Every intermediate stays unsigned.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? ((0xedb88320 ^ (c >>> 1)) >>> 0) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = (CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  return (c ^ 0xffffffff) >>> 0;
}

/* ── PNG chunks ────────────────────────────────────────────────────────────── */

const toBytes = (input) => {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  throw new TypeError('expected a Uint8Array or an ArrayBuffer of PNG bytes');
};

function assertPng(bytes) {
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) throw new Error('not a PNG: the 8-byte signature does not match');
  }
}

/** Every chunk in order: `{ type, data, start, end }`. */
export function readChunks(input) {
  const bytes = toBytes(input);
  assertPng(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks = [];
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]);
    const data = bytes.subarray(at + 8, at + 8 + length);
    chunks.push({ type, data, start: at, end: at + 12 + length });
    at += 12 + length;
    if (type === 'IEND') break;
  }
  return chunks;
}

function chunkBytes(type, data) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);                       // big-endian, the PNG default
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const covered = out.subarray(4, 8 + data.length);     // the Length field is not covered
  view.setUint32(8 + data.length, crc32(covered));
  return out;
}

/** The iTXt data field: keyword, 0, flag 0, method 0, empty lang, 0, empty translation, 0, UTF-8 text. */
function itxtData(keyword, text) {
  const key = new TextEncoder().encode(keyword);
  const body = new TextEncoder().encode(text);
  const out = new Uint8Array(key.length + 5 + body.length);
  out.set(key, 0);
  out.set([0, 0, 0, 0, 0], key.length);
  out.set(body, key.length + 5);
  return out;
}

function keywordOf(chunk) {
  const zero = chunk.data.indexOf(0);
  if (zero < 1) return null;
  return new TextDecoder().decode(chunk.data.subarray(0, zero));
}

/**
 * Write `payload` into an `iTXt` chunk directly after `IHDR`, so a reader that
 * stops at the first match stops early. An existing chunk with the same keyword
 * is replaced, never appended to: the spec says the keyword must not appear
 * twice. Compression is not used, per the baking spec.
 */
export function bakePng(input, payload, { keyword = OB3_KEYWORD } = {}) {
  const bytes = toBytes(input);
  const chunks = readChunks(bytes);
  const kept = chunks.filter((c) => !(c.type === 'iTXt' && keywordOf(c) === keyword));
  const inserted = chunkBytes('iTXt', itxtData(keyword, payload));

  const parts = [new Uint8Array(PNG_SIGNATURE)];
  for (const chunk of kept) {
    parts.push(bytes.subarray(chunk.start, chunk.end));  // every other chunk is copied unmodified
    if (chunk.type === 'IHDR') parts.push(inserted);
  }
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

/**
 * The credential inside a PNG, as `{ keyword, payload }`, or null.
 * Looks for all three known forms: iTXt/openbadgecredential (3.0),
 * iTXt/openbadges (2.0), and the pre-spec tEXt/openbadges, which held a hosted
 * assertion URL rather than the assertion itself.
 */
export function unbakePng(input) {
  for (const chunk of readChunks(input)) {
    if (chunk.type !== 'iTXt' && chunk.type !== 'tEXt') continue;
    const keyword = keywordOf(chunk);
    if (keyword !== OB3_KEYWORD && keyword !== OB2_KEYWORD) continue;
    const skip = chunk.type === 'iTXt' ? keyword.length + 5 : keyword.length + 1;
    const payload = new TextDecoder().decode(chunk.data.subarray(skip));
    return { keyword, chunk: chunk.type, payload, legacyUrl: chunk.type === 'tEXt' };
  }
  return null;
}

/* ── SVG ───────────────────────────────────────────────────────────────────── */

const OPEN_TAG = /<svg\b[^>]*>/i;
const OB_ELEMENT = /<openbadges:(assertion|credential)\b[\s\S]*?(\/>|<\/openbadges:(?:assertion|credential)>)/i;

/** Bake a compact JWS into an SVG string as an `<openbadges:credential>`. */
export function bakeSvg(svgText, jws) {
  const open = svgText.match(OPEN_TAG);
  if (!open) throw new Error('not an SVG: no opening <svg> tag');
  const stripped = svgText.replace(OB_ELEMENT, '');
  const opener = stripped.match(OPEN_TAG)[0];
  const withNs = opener.includes('xmlns:openbadges')
    ? opener
    : opener.replace(/>$/, ` xmlns:openbadges="${OB3_NS}">`);
  const element = `<openbadges:credential verify="${jws}"></openbadges:credential>`;
  // A function replacement, so a `$` anywhere in the payload or in an inlined
  // data URI is a literal dollar rather than a replacement pattern.
  return stripped.replace(OPEN_TAG, () => `${withNs}${element}`);
}

/**
 * The credential inside an SVG, or null.
 *
 * A `verify` attribute is read by its contents, not by the tag name: two dots
 * means a compact JWS, `://` means a hosted URL. The OB 2.0 baking spec's own
 * worked example uses `verify="<url>"` and the official inspector then fails it
 * with a base64 decode error, so trusting the attribute name is not safe.
 */
export function unbakeSvg(svgText) {
  const found = String(svgText).match(OB_ELEMENT);
  if (!found) return null;
  const keyword = found[1] === 'credential' ? OB3_KEYWORD : OB2_KEYWORD;
  const verify = found[0].match(/verify="([^"]*)"/);
  if (verify && verify[1]) {
    const value = verify[1];
    if (value.includes('://')) return { keyword, payload: value, hostedUrl: true };
    if (value.split('.').length === 3) return { keyword, payload: value, jws: true };
  }
  const inner = found[0].replace(/^<openbadges:\w+\b[^>]*>/, '').replace(/<\/openbadges:\w+>$/, '');
  return inner.trim() ? { keyword, payload: unescapeXml(inner.trim()) } : null;
}

const unescapeXml = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/* ── reading a credential (C9.4 paths 1 to 3) ──────────────────────────────── */

/** The payload of a compact JWS, decoded. Verifying the signature is the server's job. */
export function decodeJws(jws) {
  const parts = String(jws).split('.');
  if (parts.length !== 3) throw new Error('not a compact JWS: expected three dot-separated segments');
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

const PROVIDER_BY_HOST = [
  [/(^|\.)credly\.com$/, 'credly'],
  [/(^|\.)badgr\.io$/, 'badgr'],
];

function providerOf(url) {
  if (typeof url !== 'string') return 'openbadges';
  try {
    const host = new URL(url).hostname;
    for (const [re, name] of PROVIDER_BY_HOST) if (re.test(host)) return name;
  } catch { /* a malformed URL is simply not a known provider */ }
  return 'openbadges';
}

const asString = (v) => (typeof v === 'string' ? v : '');
const asUrl = (v) => (typeof v === 'string' && /^https?:\/\//.test(v) ? v : null);
const asDate = (v) => {
  if (typeof v !== 'string' || !v) return null;
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

/**
 * Normalise an Open Badges 2.0 assertion or a 3.0 credential into the C9.5
 * `ImportMeta` fields a client can know.
 *
 * `fetchedAt`, `verified` and `recipientMatch` are not set here: they are
 * server-side judgments, and `imports:save` rebuilds the record from its own
 * fetch rather than trusting what a client hands it.
 */
export function parseCredential(input, { sourceUrl = null, dialect = null } = {}) {
  let doc = input;
  let inferred = dialect;
  if (typeof doc === 'string') {
    const text = doc.trim();
    if (text.startsWith('{')) {
      doc = JSON.parse(text);
      inferred = inferred || 'ob2-json';
    } else {
      doc = decodeJws(text);
      inferred = inferred || 'ob3-jws';
    }
  }
  if (!doc || typeof doc !== 'object') throw new Error('not a credential: expected JSON or a compact JWS');
  if (doc.vc && typeof doc.vc === 'object') doc = doc.vc;          // the VC-JWT `vc` claim

  const types = [].concat(doc.type || []);
  const isOb3 = types.includes('OpenBadgeCredential') || types.includes('VerifiableCredential');
  const meta = isOb3 ? fromOb3(doc) : fromOb2(doc);
  return {
    provider: providerOf(sourceUrl || meta.assertionUrl || meta.issuerUrl),
    dialect: inferred || (isOb3 ? 'ob3-jws' : 'ob2-json'),
    sourceUrl: sourceUrl || meta.assertionUrl,
    ...meta,
  };
}

function fromOb3(doc) {
  const subject = doc.credentialSubject || {};
  const achievement = subject.achievement || {};
  const issuer = typeof doc.issuer === 'object' ? doc.issuer : {};
  const criteria = achievement.criteria || {};
  return {
    assertionUrl: asUrl(doc.id),
    name: asString(achievement.name || doc.name),
    description: asString(achievement.description || doc.description),
    criteriaNarrative: asString(criteria.narrative),
    criteriaUrl: asUrl(criteria.id),
    skills: [].concat(achievement.tag || []).filter((s) => typeof s === 'string').slice(0, 40),
    issuerName: asString(issuer.name || (typeof doc.issuer === 'string' ? doc.issuer : '')),
    issuerUrl: asUrl(issuer.url || issuer.id),
    issuerImageUrl: asUrl(typeof issuer.image === 'object' ? issuer.image && issuer.image.id : issuer.image),
    imageUrl: asUrl(typeof achievement.image === 'object' ? achievement.image && achievement.image.id : achievement.image),
    issuedOn: asDate(doc.validFrom || doc.issuanceDate),
    expiresOn: asDate(doc.validUntil || doc.expirationDate),
  };
}

function fromOb2(doc) {
  const badge = typeof doc.badge === 'object' ? doc.badge : {};
  const issuer = typeof badge.issuer === 'object' ? badge.issuer : {};
  const criteria = typeof badge.criteria === 'object' ? badge.criteria : {};
  return {
    assertionUrl: asUrl(doc.id) || asUrl(typeof doc.badge === 'string' ? doc.badge : null),
    name: asString(badge.name),
    description: asString(badge.description),
    criteriaNarrative: asString(criteria.narrative),
    criteriaUrl: asUrl(criteria.id) || asUrl(typeof badge.criteria === 'string' ? badge.criteria : null),
    skills: [].concat(badge.tags || []).filter((s) => typeof s === 'string').slice(0, 40),
    issuerName: asString(issuer.name),
    issuerUrl: asUrl(issuer.url) || asUrl(issuer.id),
    issuerImageUrl: asUrl(typeof issuer.image === 'object' ? issuer.image && issuer.image.id : issuer.image),
    imageUrl: asUrl(typeof badge.image === 'object' ? badge.image && badge.image.id : badge.image),
    issuedOn: asDate(doc.issuedOn),
    expiresOn: asDate(doc.expires),
  };
}

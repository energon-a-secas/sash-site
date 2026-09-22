/**
 * Insignia Kit: the provenance object (C1.3) and the strings it turns into.
 *
 * Everything the renderer draws about *who issued this and where to check* is
 * built here, once, and read by the badge strip, the certificate band, the
 * exporter's font subset and the SVG `<desc>`. Two surfaces drew the same
 * string from two places until A14, which is how a certificate came to be
 * labelled a badge on one of them and not the other.
 *
 * Split out of `schema.js` in design round 2 (2026-09-15). `schema.js`
 * re-exports every name here, so no importer changed. Pure: no DOM, no fetch,
 * no locale lookup (C1.6).
 */
import { xmlSafe } from './patterns.js';
import { ORIGINS, PROVENANCE_MODES } from './enums.js';

export const PUBLIC_ID_RE = /^[0-9abcdefghjkmnpqrstvwxyz]{10}$/;                  // C4.1
export const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const enumOf = (out, label, v, list) => {
  if (!list.includes(v)) out.push(`${label} must be one of ${list.join(', ')}, got ${JSON.stringify(v)}`);
};

/* ── validation, required at draw time ─────────────────────────────────────── */

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

/* ── dates ─────────────────────────────────────────────────────────────────── */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** `2026-09-09T12:00:00.000Z` to `9 September 2026`. No locale lookup (C1.6). */
export function formatDate(iso) {
  if (typeof iso !== 'string' || iso.length < 10) return '';
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  if (!y || !m || !d || m < 1 || m > 12) return '';
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/* ── the strings both the badge and the certificate draw ───────────────────── */

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

/** `@handle`, or the empty string for an import's null (A6): never `@null`, never a bare `@`. */
export function handleText(handle) {
  return typeof handle === 'string' && handle ? `@${xmlSafe(handle)}` : '';
}

/** The two lines of the provenance strip. Drawn in both modes, never optional. */
export function provenanceLines(prov, kind) {
  const label = originLabel(prov.origin, kind);
  const handle = handleText(prov.issuerHandle);
  return {
    top: handle ? `${label}   ${handle}` : label,
    bottom: prov.mode === 'preview' ? `${PREVIEW_URL}   ${PREVIEW_SERIAL}` : xmlSafe(prov.verifyUrl),
  };
}

/**
 * The provenance as one plain sentence, for the SVG `<desc>` (V10) and for any
 * surface that wants the same facts as text: a screen reader, an image indexer,
 * a chat window the PNG was pasted into. It starts with the origin word and the
 * handle, exactly as the strip does, so the two cannot disagree.
 *
 * Built from the provenance alone. The criteria and the status are not on the
 * C1.3 object, so they are not here yet; when they arrive they arrive as a
 * third `renderSvg` argument, additively.
 */
export function provenanceDesc(prov, kind) {
  const label = originLabel(prov.origin, kind);
  const handle = handleText(prov.issuerHandle);
  const parts = [handle ? `${label} ${handle}` : label];
  if (prov.mode === 'preview') {
    parts.push('Preview, not yet issued');
  } else {
    const holder = handleText(prov.holder);
    const issued = formatDate(prov.issuedAt);
    const until = formatDate(prov.expiresAt);
    let sentence = holder ? `Issued to ${holder}` : 'Issued';
    if (issued) sentence += ` on ${issued}`;
    if (until) sentence += `, valid until ${until}`;
    parts.push(sentence);
    parts.push(`Serial ${xmlSafe(prov.serial)}`);
    parts.push(`Verify at ${xmlSafe(prov.verifyUrl)}`);
  }
  return `${parts.join('. ')}.`;
}

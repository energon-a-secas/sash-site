// ── Shared utilities ─────────────────────────────────────────
// Small helpers used across every page of this site.
//
// The generic half is not written here. C15 A53: `escHtml`, `debounce`,
// `showToast` and the rest come from the Neorgon DOM Kit, `js/neorgon-dom.js`,
// which is vendored by `packages/neorgon-ui/sync-dom.sh` and never edited in
// place. This file wrote its own `escHtml` for one week and it escaped four
// characters where the kit's escapes five: no `'`, so an attribute-position
// call site would have been injectable the moment somebody added one.
//
// What is left below is the part that is about badges, plus `el` and `$`, which
// the kit does not carry.

import { showToast as neoShowToast } from './neorgon-dom.js';
import { formatDate } from './insignia/certificate.js';

/**
 * Cached element lookup by ID.
 *
 * The cache is permanent, which is correct here and is **not** what Enamel's
 * `$` does: this site never replaces a shell node, it only fills one. Enamel
 * re-resolves when the cached node has left the document, because its editor
 * rebuilds whole panels. Two rules, both deliberate, neither a bug.
 */
const _els = {};
export function $(id) {
  if (!(id in _els)) _els[id] = document.getElementById(id);
  return _els[id];
}

/**
 * Build an element in one call. Text is set as text, never as HTML.
 *
 * The kit has no `el`, so this is where the site's copy lives. A53 counted
 * seven across this campaign, six of them here; `badge.js`, `claim.js`,
 * `embed.js`, `import.js` and `send.js` import this one now. `js/frame.js`
 * keeps its own, and the reason is written in that file.
 */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null && text !== '') node.textContent = String(text);
  return node;
}

/** A query string parameter, trimmed. Returns '' when absent. */
export function param(name) {
  const value = new URLSearchParams(location.search).get(name);
  return value === null ? '' : value.trim();
}

/** Show or hide by the hidden attribute, so CSS display values cannot beat it. */
export function show(node, on) {
  if (!node) return;
  if (on) node.removeAttribute('hidden');
  else node.setAttribute('hidden', '');
}

/** Put a message in an error slot, or clear it. */
export function setError(node, message) {
  if (!node) return;
  node.textContent = message || '';
  show(node, !!message);
}

/**
 * A temporary toast: the kit's, with this site's dwell time.
 *
 * 2400ms rather than the kit's 2000 because several of these messages are a
 * full sentence ("A handle is 2 to 30 characters, lowercase letters, digits and
 * hyphens."), and 2000ms is under the time it takes to read one. The class and
 * id names are the kit's defaults and match `css/style.css`. The kit sets
 * `aria-live` as well as `role`, which the copy this replaced did not.
 */
export function showToast(msg) {
  return neoShowToast(msg, { duration: 2400 });
}

/**
 * The wallet group an award belongs to (C7.22).
 *
 * This mirrors `awardGroup` in `convex/lib/awards.ts`, and it is the only rule
 * written twice on this site. It has to be: `awards:mine` returns the whole
 * wallet with no group parameter, so the signed-in page partitions the array
 * itself. The public page passes `group` to `awards:forHandle` instead, which
 * is what would surface a disagreement between the two.
 *
 * An import is tested first and by both of the things that say so, because
 * `category` is null on one (A6) and asking for `category === 'recognition'`
 * first would file it nowhere.
 */
export function walletGroup(award) {
  if (award.source === 'import' || award.origin === 'imported') return 'imported';
  if (award.category === 'recognition') return 'recognition';
  return award.origin === 'neorgon' ? 'neorgon' : 'community';
}

export const GROUP_LABELS = {
  all: 'All',
  neorgon: 'Neorgon',
  community: 'Community',
  recognition: 'Recognition',
  imported: 'Imported',
};

/* ── dates and durations, one of each (C15 A54) ─────────────────────────────
   One award's dates used to render four ways across four pages. The kit's
   `formatDate` is the one formatter now, and everything below is a thin
   adapter onto it. Do not write a second one: a visitor who claims a badge,
   opens their wallet and imports a credential reads three pages in a row.
   `formatDate` reads the ISO string rather than converting to local time, so
   the date on screen is the date drawn onto the artefact (C1.6). */

/** Epoch ms or an ISO string, as an ISO string. Empty for anything unusable. */
function isoOf(value) {
  const ms = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : '';
}

/**
 * A date and a UTC time: `9 September 2026 at 21:06 UTC`.
 *
 * For the two things that can happen later today rather than one day: a claim
 * link's expiry, and the moment an import was last checked with its issuer. The
 * zone is named because it is not the reader's. Empty rather than a raw
 * timestamp when the value will not parse: painting `2026-09-09T21:06:21.000Z`
 * at a reader is the defect A42.2 exists to stop.
 */
export function stamp(value) {
  const iso = isoOf(value);
  return iso ? `${formatDate(iso)} at ${iso.slice(11, 16)} UTC` : '';
}

const MINUTE = 60000, HOUR = 3600000, DAY = 86400000;

/**
 * A duration in the words a person uses for it. Never a rounded-up zero.
 *
 * A54. Enamel's `links.js` says the same thing about the same number at the
 * other end of the transaction ("expires 30 days after it is claimed"), so this
 * body is byte-identical in `enamel-site/js/utils.js`. Two copies, because the
 * two sites share no source that is ours to edit; the kit is closed and
 * `js/insignia/` is vendored. There is no `--check` on this pair, which is the
 * same recorded drift A53 noted for `js/frame.js`. Change one, change both.
 */
export function humanMs(ms) {
  if (ms < MINUTE) return 'less than a minute';
  if (ms < HOUR) { const n = Math.round(ms / MINUTE); return `${n} minute${n === 1 ? '' : 's'}`; }
  if (ms < DAY) { const n = Math.round(ms / HOUR); return `${n} hour${n === 1 ? '' : 's'}`; }
  const days = Math.round(ms / DAY);
  if (days % 365 === 0) { const y = days / 365; return `${y} year${y === 1 ? '' : 's'}`; }
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** "1 badge" / "4 badges", without a library. */
export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

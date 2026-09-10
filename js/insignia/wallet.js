/**
 * Insignia Kit: the award grid (C1.4) and the profile poster (C6.1).
 *
 * `index.html`, `u.html` and `embed.html` all draw the same wall of awards and
 * they belong to three different owners, so the grid lives in the kit. That is
 * the only arrangement where "the shared renderer is the only drawing code path"
 * survives the page split.
 *
 * Imported credentials never reach the design engine (C11.4). The data shape
 * enforces it: `PublicAward.design` is null whenever `source === "import"`, so
 * an import renders as a labelled row on a distinct surface with the provider's
 * artwork hotlinked, and in the export it becomes a line of text with no
 * provider pixels at all (C6.6).
 *
 * A6 gave the same row an `origin` of its own, `imported`, and made `category`,
 * `sphere`, `issuerHandle` and `versionN` null on it. Null here means the field
 * does not apply, so nothing in this module renders one: a missing issuer leaves
 * the line out rather than drawing an empty handle.
 *
 * No inline handlers anywhere: a card is markup and links. Pages wire their own
 * listeners in their own `events.js`.
 */
import { renderSvg, usedFonts, setArtUrls, familyFor } from './render.js';
import { FONT_FAMILIES } from './schema.js';
import { formatDate } from './certificate.js';
import { svgEl, n } from './patterns.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ── shared helpers ────────────────────────────────────────────────────────── */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

/**
 * An imported credential, by either of the two things that say so.
 *
 * `source === "import"` is C7.17 and `origin === "imported"` is C7.2 as amended
 * by A6. They are set together by the server, and this reads both because a row
 * carrying only one of them is a bug worth rendering as an import rather than as
 * a community badge, which is the mislabel A6 exists to end.
 */
export const isImported = (award) => award.source === 'import' || award.origin === 'imported';

/** The C1.3 provenance an award carries. Never built from client-side guesses. */
export function provenanceOf(award) {
  return {
    origin: award.origin,
    issuerHandle: award.issuerHandle,
    serial: award.publicId,
    verifyUrl: award.verifyUrl,
    holder: award.holderHandle || '',
    issuedAt: award.issuedAt || null,
    expiresAt: award.expiresAt || null,
    mode: 'award',
  };
}

function artMapFor(awards) {
  const map = {};
  for (const a of awards) {
    if (!a || !a.design || !a.artUrl) continue;
    const ref = a.design.centre && a.design.centre.imageRef;
    if (ref) map[ref] = a.artUrl;
  }
  return map;
}

const STATUS_TEXT = { valid: '', expired: 'expired', revoked: 'revoked' };

/**
 * The no-art presentation: the provider's name where the artwork would be.
 *
 * Two things reach it. A credential that names no image, and a credential whose
 * image failed to load (A38). They are the same card because they are the same
 * situation from the reader's side.
 */
const noArtLabel = (meta) => el('span', 'ins-card-noart', (meta.provider || 'imported').slice(0, 12));

const importLine = (meta) => `Imported from ${meta.provider}: ${meta.name}, `
  + `issued by ${meta.issuerName}, ${formatDate(meta.issuedOn) || 'date not stated'}`;

/* ── one card ──────────────────────────────────────────────────────────────── */

/** One award as a DOM node. `award` is the C2 PublicAward shape. */
export function renderAwardCard(award, opts = {}) {
  const { size = 180, linkToVerify = true, showDates = true } = opts;
  const imported = isImported(award);
  const card = el('article', `ins-card${imported ? ' ins-card--import' : ''}`);
  card.dataset.origin = imported ? 'imported' : award.origin;
  card.dataset.status = award.status;
  if (award.status !== 'valid') card.classList.add('ins-card--muted');

  const href = imported
    ? (award.importMeta && award.importMeta.sourceUrl)
    : award.verifyUrl;
  const artWrap = linkToVerify && href ? el('a', 'ins-card-art') : el('div', 'ins-card-art');
  if (artWrap.tagName === 'A') {
    artWrap.href = href;
    if (imported) { artWrap.target = '_blank'; artWrap.rel = 'noopener'; }
  }
  artWrap.style.setProperty('--ins-card-size', `${size}px`);

  if (imported) {
    const meta = award.importMeta || {};
    if (meta.imageUrl) {
      const img = el('img', 'ins-card-provider-art');
      img.src = meta.imageUrl;                 // hotlinked, never copied into our storage
      img.alt = `${meta.name || award.name} from ${meta.issuerName || meta.provider}`;
      img.loading = 'lazy';
      img.width = size;
      img.height = size;
      // A38: the artwork sits on whatever host the issuer used, so a blocked
      // host, a dead link and a 404 are ordinary outcomes rather than surprises.
      // Degrade to the no-art card instead of leaving a hole where the art was.
      // The error event fires once per load attempt and the src is never
      // reassigned, but the swap is idempotent because a second run would
      // append a second label.
      let swapped = false;
      img.addEventListener('error', () => {
        if (swapped) return;
        swapped = true;
        artWrap.removeChild(img);
        artWrap.appendChild(noArtLabel(meta));
      });
      artWrap.appendChild(img);
    } else {
      artWrap.appendChild(noArtLabel(meta));
    }
  } else if (award.design) {
    setArtUrls(artMapFor([award]));
    const svg = renderSvg(award.design, provenanceOf(award));
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    artWrap.appendChild(svg);
  }
  card.appendChild(artWrap);

  const body = el('div', 'ins-card-body');
  body.appendChild(el('h3', 'ins-card-name', award.name));

  // An import has `issuerHandle: null` (A6) and names its real issuer from
  // `importMeta` instead. A null is never drawn: the line is left out entirely
  // rather than reading `@null` or a bare `@`.
  const issuer = imported
    ? (award.importMeta && award.importMeta.issuerName) || 'unknown issuer'
    : (award.issuerHandle ? `@${award.issuerHandle}` : '');
  const meta = el('p', 'ins-card-meta');
  if (issuer) meta.appendChild(el('span', 'ins-card-issuer', issuer));
  if (award.count > 1) meta.appendChild(el('span', 'ins-card-count', `x${award.count}`));
  if (meta.childNodes.length) body.appendChild(meta);

  if (showDates) {
    const issued = imported
      ? formatDate(award.importMeta && award.importMeta.issuedOn)
      : formatDate(award.issuedAt);
    const expires = imported
      ? formatDate(award.importMeta && award.importMeta.expiresOn)
      : formatDate(award.expiresAt);
    const bits = [];
    if (issued) bits.push(`issued ${issued}`);
    if (expires) bits.push(`until ${expires}`);
    if (bits.length) body.appendChild(el('p', 'ins-card-dates', bits.join('  ')));
  }

  const tags = el('p', 'ins-card-tags');
  if (STATUS_TEXT[award.status]) tags.appendChild(el('span', 'ins-tag ins-tag--warn', STATUS_TEXT[award.status]));
  if (imported) {
    const m = award.importMeta || {};
    tags.appendChild(el('span', 'ins-tag', `imported from ${m.provider || 'elsewhere'}`));
    if (!m.verified) tags.appendChild(el('span', 'ins-tag ins-tag--warn', 'unverified'));
    if (m.recipientMatch === false) tags.appendChild(el('span', 'ins-tag ins-tag--warn', 'unverified holder'));
  }
  if (tags.childNodes.length) body.appendChild(tags);

  card.appendChild(body);
  return card;
}

/* ── the grid ──────────────────────────────────────────────────────────────── */

// An import carries `category: null` and `sphere: null` (A6), so grouping by
// category files it under `imported` rather than inventing a category for it or
// heading a section with the word `null`.
const GROUP_OF = {
  none: () => 'all',
  category: (a) => (isImported(a) ? 'imported' : a.category || 'other'),
  origin: (a) => (isImported(a) ? 'imported' : a.origin),
};

/** A grid of cards. Imported credentials render through C11.4, never the engine. */
export function renderAwardGrid(awards, opts = {}) {
  const { groupBy = 'none', ...cardOpts } = opts;
  const list = Array.isArray(awards) ? awards : [];
  const wrap = el('div', 'ins-wall');
  if (!list.length) return wrap;

  const key = GROUP_OF[groupBy] ? groupBy : 'none';
  if (key === 'none') {
    wrap.appendChild(gridOf(list, cardOpts));
    return wrap;
  }
  const groups = new Map();
  for (const award of list) {
    const g = GROUP_OF[key](award);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(award);
  }
  for (const name of [...groups.keys()].sort()) {
    const section = el('section', 'ins-wall-group');
    section.appendChild(el('h2', 'ins-wall-title', name));
    section.appendChild(gridOf(groups.get(name), cardOpts));
    wrap.appendChild(section);
  }
  return wrap;
}

/**
 * A42.1: a row the renderer refuses costs one card, never the wall.
 *
 * `renderSvg` throws on a provenance that fails C1.3, and a server row can carry
 * one: an award whose issuer profile row is missing arrives with an empty
 * `issuerHandle`, which is not a valid non-imported provenance. With no boundary
 * that throw escapes `renderAwardGrid` and the whole section renders blank, so a
 * stranger reading the profile sees nothing rather than one gap.
 *
 * The card is visibly broken and the reason is named in the console. This is a
 * boundary, not a silence: a caught error nobody can see is the failure this
 * repository keeps re-finding.
 */
function brokenCard(award, err, cardOpts) {
  const name = (award && (award.name || award.publicId)) || 'unnamed award';
  console.warn(`[insignia] award ${name} could not be rendered: ${(err && err.message) || err}`);
  const card = el('article', 'ins-card ins-card--broken');
  card.dataset.status = 'broken';
  const artWrap = el('div', 'ins-card-art');
  if (cardOpts.size) artWrap.style.setProperty('--ins-card-size', `${cardOpts.size}px`);
  artWrap.appendChild(el('span', 'ins-card-noart', 'unavailable'));
  card.appendChild(artWrap);
  const body = el('div', 'ins-card-body');
  body.appendChild(el('h3', 'ins-card-name', name));
  const tags = el('p', 'ins-card-tags');
  tags.appendChild(el('span', 'ins-tag ins-tag--warn', 'could not be displayed'));
  body.appendChild(tags);
  card.appendChild(body);
  return card;
}

function gridOf(awards, cardOpts) {
  const grid = el('div', 'ins-grid');
  if (cardOpts.size) grid.style.setProperty('--ins-card-size', `${cardOpts.size}px`);
  for (const award of awards) {
    let card;
    try {
      card = renderAwardCard(award, cardOpts);
    } catch (err) {
      card = brokenCard(award, err, cardOpts);
    }
    grid.appendChild(card);
  }
  return grid;
}

/* ── the profile poster (C6.1, C6.6) ───────────────────────────────────────── */

const POSTER_W = 1200;
const PAD = 56;

/**
 * The poster the profile and group PNG exports rasterise.
 *
 * Returns the node, its size, and every font face it draws with, so the exporter
 * subsets exactly the characters on the poster and nothing else.
 *
 * Imported credentials are a line of text here, never provider artwork: their
 * terms prohibit reproduction, and hotlinking a logo on screen is a different
 * act from copying its pixels into an artefact we hand somebody (C6.6).
 */
export function buildProfileSvg(awards, profile, opts = {}) {
  const { size = 200, title = 'Badges', background = '#0b1020', ink = '#e7e9ff', muted = '#9aa3d0' } = opts;
  const list = (Array.isArray(awards) ? awards : []);
  const drawn = list.filter((a) => a.design && !isImported(a));
  const imported = list.filter((a) => isImported(a) || !a.design);

  const cols = Math.max(1, Math.floor((POSTER_W - PAD * 2 + 28) / (size + 28)));
  const rows = Math.ceil(drawn.length / cols);
  const gridTop = 236;
  const rowH = size + 62;
  const importTop = gridTop + rows * rowH + (imported.length ? 24 : 0);
  const height = Math.round(importTop + imported.length * 40 + PAD + 40);

  const runs = [];
  const svg = svgEl('svg', {
    xmlns: SVG_NS, viewBox: `0 0 ${POSTER_W} ${height}`, width: String(POSTER_W), height: String(height),
    role: 'img',
  });
  svg.appendChild(svgEl('rect', { width: String(POSTER_W), height: String(height), fill: background }));

  const text = (value, { x, y, role, size: fs, color, anchor = 'start' }) => {
    if (!value) return;
    runs.push({ role, text: String(value) });
    const node = svgEl('text', {
      x: n(x), y: n(y), 'font-family': familyFor(role), 'font-size': n(fs),
      'font-weight': String(faceOf(role).weight), 'text-anchor': anchor, fill: color,
    });
    node.textContent = String(value);
    svg.appendChild(node);
  };

  const p = profile || {};
  text(p.displayName || p.handle || title, { x: PAD, y: 108, role: 'display', size: 64, color: ink });
  text(p.handle ? `@${p.handle}` : '', { x: PAD, y: 156, role: 'sans', size: 30, color: muted });
  text(p.headline || title, { x: PAD, y: 200, role: 'sans', size: 26, color: muted });

  setArtUrls(artMapFor(drawn));
  drawn.forEach((award, i) => {
    const x = PAD + (i % cols) * (size + 28);
    const y = gridTop + Math.floor(i / cols) * rowH;
    const badge = renderSvg(award.design, provenanceOf(award));
    badge.setAttribute('x', n(x));
    badge.setAttribute('y', n(y));
    badge.setAttribute('width', n(size));
    badge.setAttribute('height', n(size));
    svg.appendChild(badge);
    for (const face of usedFonts(award.design, provenanceOf(award))) runs.push({ face });
    const label = (award.name || '').slice(0, 22);
    text(label, { x: x + size / 2, y: y + size + 34, role: 'sans', size: 20, color: ink, anchor: 'middle' });
  });

  imported.forEach((award, i) => {
    const meta = award.importMeta || { provider: 'elsewhere', name: award.name, issuerName: '' };
    text(importLine(meta), { x: PAD, y: importTop + i * 40 + 24, role: 'sans', size: 22, color: muted });
  });

  const foot = p.handle ? `sash.neorgon.com/u.html?h=${p.handle}` : 'sash.neorgon.com';
  text(foot, { x: PAD, y: height - PAD + 12, role: 'mono', size: 22, color: muted });

  return { svg, width: POSTER_W, height, fonts: mergeFaces(runs) };
}

/** The C7.14 family behind a role. One table, in schema.js, never a second copy. */
const faceOf = (role) => FONT_FAMILIES[role] || FONT_FAMILIES.sans;

/** Merge the poster's own runs and every nested badge's faces into one list. */
function mergeFaces(runs) {
  const byFace = new Map();
  const add = (family, weight, italic, chars) => {
    const key = `${family}|${weight}|${italic}`;
    const seen = byFace.get(key) || { family, weight, italic, chars: new Set() };
    for (const ch of chars) seen.chars.add(ch);
    byFace.set(key, seen);
  };
  for (const run of runs) {
    if (run.face) { add(run.face.family, run.face.weight, run.face.italic, run.face.text); continue; }
    const f = faceOf(run.role);
    add(f.family, f.weight, f.italic, run.text);
  }
  return [...byFace.values()]
    .map((f) => ({ family: f.family, weight: f.weight, italic: f.italic, text: [...f.chars].sort().join('') }))
    .sort((a, b) => (a.family < b.family ? -1 : a.family > b.family ? 1 : 0));
}

/**
 * badge.html: the verify page. CONTRACTS.md C4.4, C6, C9.3, C11.4, C11.6.
 *
 * This is the page an outsider arrives at to decide what a Sash credential is,
 * so three things are non-negotiable here.
 *
 * It works signed out. Verification that needs an account is not verification,
 * so nothing on this page loads Clerk and every read is an anonymous query.
 *
 * An expired credential and a revoked one are each unmistakable and they are
 * not the same fact. Expired means the window ran out; revoked means the issuer
 * withdrew it. Each gets its own word, its own colour and its own date, and
 * neither is a subtle grey.
 *
 * The disclosure leads (C11.6). It sits above the art, above the fold, in plain
 * words, and it is in the HTML rather than built here so a failure to load
 * cannot be what removed it.
 *
 * No inline handlers: every listener is wired below.
 */
import { framed } from './frame.js';
import { convex, api } from './convex.js';
import { PUBLIC_ID_RE } from './insignia/schema.js';
import { renderSvg, ensureFonts, setArtUrls } from './insignia/render.js';
import { provenanceOf, isImported } from './insignia/wallet.js';
import { formatDate } from './insignia/certificate.js';
import { exportPng, exportSvgFile, triggerDownload, slugify, printRoot } from './insignia/export.js';
import { el } from './utils.js';

const stage = document.getElementById('stage');
const disclosureLine = document.getElementById('disclosureLine');

/* ── small local helpers ────────────────────────────────────────────────────
   `el` used to be local here, on the reasoning that js/utils.js belonged to
   the wallet workstream and the three public pages shared no file with it.
   C15 A53 ended that: the same six lines were written six times on this site,
   which is how one of them ends up differing from the others. Ownership of a
   file is a scheduling fact, not an architecture. `card` and `link` below stay
   local because only this page draws them. */

function link(href, text, opts = {}) {
  const a = el('a', opts.className, text);
  a.href = href;
  if (opts.blank) { a.target = '_blank'; a.rel = 'noopener'; }
  return a;
}

/** A message card. `tone` is one of good, warn, bad, or absent for neutral. */
function card(title, body, tone) {
  const box = el('section', 'pg-msg');
  if (tone) box.dataset.tone = tone;
  box.appendChild(el('h2', null, title));
  if (body) box.appendChild(el('p', null, body));
  return box;
}

function facts(rows) {
  const dl = el('dl', 'pv-facts');
  for (const [term, value] of rows) {
    if (value === null || value === undefined || value === '') continue;
    dl.appendChild(el('dt', null, term));
    const dd = el('dd', null);
    if (value instanceof Node) dd.appendChild(value);
    else dd.textContent = String(value);
    dl.appendChild(dd);
  }
  return dl;
}

/* ── the disclosure sentence (C11.6) ────────────────────────────────────────
   Three origins, three honest sentences. An imported credential was not issued
   here at all and saying otherwise would be the exact overclaim C11 forbids. */

function disclosureFor(award) {
  if (isImported(award)) {
    const from = award.importMeta && award.importMeta.issuerName;
    // An import that names no issuer says so, in the words every other surface
    // uses for the same absence, rather than inventing "another issuer".
    return (from
      ? `This credential was issued by ${from} and imported into Sash by its holder. `
      : 'This credential was imported into Sash by its holder and its issuer is not stated. ')
      + 'Sash did not issue it and does not vouch for it.';
  }
  if (award.origin === 'neorgon') {
    return 'This is a Neorgon community credential, issued by Neorgon on sash.neorgon.com. '
      + 'It is not a professional certification and it is not accredited by anyone.';
  }
  const who = award.issuerHandle ? `@${award.issuerHandle}` : 'a Sash member';
  return `This is a Neorgon community credential, issued by ${who} on sash.neorgon.com. `
    + 'It is not a professional certification and it is not accredited by anyone.';
}

/* ── status ─────────────────────────────────────────────────────────────────*/

const STATUS_WORD = { valid: 'Valid', expired: 'Expired', revoked: 'Revoked' };

function statusNote(award) {
  if (award.status === 'revoked') {
    const on = formatDate(award.revokedAt);
    return on ? `The issuer withdrew this credential on ${on}.`
              : 'The issuer withdrew this credential.';
  }
  if (award.status === 'expired') {
    const on = formatDate(award.expiresAt);
    return on ? `Its validity ran out on ${on}.` : 'Its validity has run out.';
  }
  const until = formatDate(award.expiresAt);
  return until ? `In force until ${until}.` : 'In force, with no end date.';
}

function statusBanner(award) {
  const box = el('section', 'pv-status');
  box.dataset.status = award.status;
  box.setAttribute('aria-label', `Status: ${STATUS_WORD[award.status] || award.status}`);
  box.appendChild(el('strong', 'pv-status-word', STATUS_WORD[award.status] || award.status));
  box.appendChild(el('span', 'pv-status-note', statusNote(award)));
  return box;
}

/* ── the artefact ───────────────────────────────────────────────────────────*/

function artFor(award) {
  const frame = el('section', 'pv-art');
  frame.dataset.kind = award.kind;
  frame.dataset.status = award.status;

  if (isImported(award) || !award.design) {
    // C11.4. An import never reaches the design engine, so the provider's own
    // artwork is hotlinked and labelled rather than redrawn.
    const wrap = el('div', 'pv-art-import');
    const meta = award.importMeta || {};
    if (meta.imageUrl) {
      const img = el('img');
      img.src = meta.imageUrl;
      const from = meta.issuerName || meta.provider;
      img.alt = from ? `${meta.name || award.name} from ${from}` : `${meta.name || award.name}, issuer not stated`;
      img.loading = 'lazy';
      wrap.appendChild(img);
    }
    wrap.appendChild(el('p', 'pg-note', 'Artwork shown as its issuer serves it. Sash does not copy or redraw an imported credential.'));
    frame.appendChild(wrap);
    return frame;
  }

  setArtUrls(award.design.centre && award.design.centre.imageRef && award.artUrl
    ? { [award.design.centre.imageRef]: award.artUrl } : {});
  frame.appendChild(renderSvg(award.design, provenanceOf(award)));
  return frame;
}

/* ── downloads (C6, C9.3) ───────────────────────────────────────────────────
   The degraded export, and it is a contract rather than a fallback that crept
   in. ob:credentialFor is callable by the holder or an admin only, and this
   page never signs anybody in, so the file it hands out is an image with no
   openbadgecredential chunk in it and the UI says exactly that. */

function downloads(award) {
  const section = el('section', 'pg-section');
  section.appendChild(el('h3', null, 'Download'));

  const row = el('div', 'pg-actions');
  const png = el('button', 'btn', 'PNG');
  const svg = el('button', 'btn', 'SVG');
  row.appendChild(png);
  row.appendChild(svg);

  let print = null;
  if (award.kind === 'certificate') {
    print = el('button', 'btn', 'Print or save as PDF');
    row.appendChild(print);
  }
  section.appendChild(row);

  const status = el('p', 'pg-note', '');
  status.setAttribute('aria-live', 'polite');
  section.appendChild(status);

  section.appendChild(el('p', 'pg-note',
    'This copy is an image only. Sign in as the holder to download the verifiable badge.'));
  section.appendChild(el('p', 'pg-note',
    'A downloaded file is a point-in-time snapshot. This page is the live source of truth for whether the credential still stands.'));
  section.appendChild(el('p', 'pg-note',
    'The SVG opens correctly in any browser. Design tools drop embedded fonts, so use the PNG for Figma.'));

  const guard = async (button, label, work, doneText) => {
    button.disabled = true;
    status.textContent = `Building the ${label}.`;
    try {
      await work();
      status.textContent = doneText || `The ${label} is in your downloads.`;
    } catch (err) {
      // Loud on purpose. The export throws when it cannot inline a font or an
      // image, and an export that reports success in the wrong typeface is the
      // failure the whole pipeline exists to prevent.
      console.error('Sash: the export failed', err);
      status.textContent = `The ${label} could not be built: ${err.message}`;
    } finally {
      button.disabled = false;
    }
  };

  const prov = provenanceOf(award);
  png.addEventListener('click', () => guard(png, 'PNG', async () => {
    triggerDownload(await exportPng(award.design, prov, { scale: 2 }), `${slugify(award.name)}.png`);
  }));
  svg.addEventListener('click', () => guard(svg, 'SVG', async () => {
    triggerDownload(await exportSvgFile(award.design, prov), `${slugify(award.name)}.svg`);
  }));
  if (print) {
    // printRoot owns the title swap and its restore, waits for the fonts and
    // two frames, and wires the afterprint cleanup. The title it is given is
    // what the print dialog proposes as the file name, so it is the credential
    // rather than the page.
    print.addEventListener('click', () => guard(print, 'print sheet', async () => {
      await printRoot(award.design, prov, { pageSize: 'A4', title: award.name });
      window.print();
    }, 'Your browser has the print dialog. Pick "Save as PDF" in it.'));
  }
  return section;
}

/* ── kudos (C2.7) ───────────────────────────────────────────────────────────
   kudos:forAward is an anonymous read and this is the award's own page, so it
   is the one place the messages behind a stacked recognition badge can be
   read. Absent or empty, nothing is drawn. */

async function kudosSection(publicId) {
  let rows = [];
  try {
    rows = await convex.query(api.kudos.forAward, { awardPublicId: publicId, limit: 20 });
  } catch (err) {
    console.warn('Sash: could not read the messages on this award', err);
    return null;
  }
  if (!Array.isArray(rows) || !rows.length) return null;

  const section = el('section', 'pg-section');
  section.appendChild(el('h3', null, `Messages (${rows.length})`));
  const list = el('ul', 'pv-kudos');
  for (const row of rows) {
    const item = el('li', 'pv-kudo');
    item.appendChild(el('span', 'pv-kudo-from', `@${row.fromHandle}`));
    item.appendChild(el('span', 'pv-kudo-text', row.message));
    list.appendChild(item);
  }
  section.appendChild(list);
  return section;
}

/* ── the page ───────────────────────────────────────────────────────────────*/

function copyControl(text) {
  const wrap = el('span', 'pg-actions');
  const value = el('span', 'pv-serial', text);
  const button = el('button', 'btn', 'Copy');
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Copy blocked';
    }
    setTimeout(() => { button.textContent = 'Copy'; }, 1600);
  });
  wrap.appendChild(value);
  wrap.appendChild(button);
  return wrap;
}

function detail(award) {
  const rows = [];
  rows.push(['Holder', award.holderDisplayName
    ? `${award.holderDisplayName} (@${award.holderHandle})`
    : (award.holderHandle ? `@${award.holderHandle}` : 'not stated')]);

  if (isImported(award)) {
    const meta = award.importMeta || {};
    rows.push(['Issuer', meta.issuerName || 'not stated']);
    rows.push(['Origin', 'imported into Sash']);
    rows.push(['Provider', meta.provider || 'not stated']);
    if (meta.sourceUrl) rows.push(['Source', link(meta.sourceUrl, meta.sourceUrl, { blank: true })]);
    rows.push(['Checked by Sash', meta.verified ? 'yes, against the issuer' : 'no']);
    rows.push(['Holder match', meta.recipientMatch ? 'the addresses agree' : 'not established']);
    rows.push(['Issued', formatDate(meta.issuedOn) || 'not stated']);
    rows.push(['Expires', formatDate(meta.expiresOn) || 'no end date']);
  } else {
    rows.push(['Issuer', award.issuerHandle ? `@${award.issuerHandle}` : 'not stated']);
    rows.push(['Origin', award.origin]);
    rows.push(['Category', award.category || null]);
    rows.push(['Sphere', award.sphere || null]);
    rows.push(['Design version', award.versionN ? `v${award.versionN}` : null]);
    rows.push(['Issued', formatDate(award.issuedAt) || 'not stated']);
    rows.push(['Expires', formatDate(award.expiresAt) || 'no end date']);
    if (award.revokedAt) rows.push(['Revoked', formatDate(award.revokedAt)]);
    if (award.count > 1) rows.push(['Held', `${award.count} times`]);
    rows.push(['How it was earned', award.source]);
  }
  if (award.evidenceUrl) rows.push(['Evidence', link(award.evidenceUrl, award.evidenceUrl, { blank: true })]);
  rows.push(['Public id', copyControl(award.publicId)]);
  rows.push(['Verify at', copyControl(award.verifyUrl)]);
  return facts(rows);
}

async function renderAward(award) {
  disclosureLine.textContent = disclosureFor(award);
  document.title = `Sash | ${award.name || 'a credential'}`;

  const parts = [];
  parts.push(statusBanner(award));

  const head = el('section', 'pg-section');
  head.appendChild(el('h2', 'pg-title', award.name || 'Untitled credential'));
  if (award.description) head.appendChild(el('p', 'pg-lead', award.description));
  if (Array.isArray(award.skills) && award.skills.length) {
    const chips = el('div', 'pg-chips');
    for (const skill of award.skills) chips.appendChild(el('span', 'pg-chip', skill));
    head.appendChild(chips);
  }
  parts.push(head);

  parts.push(artFor(award));
  parts.push(detail(award));

  if (award.criteria) {
    const crit = el('section', 'pg-section');
    crit.appendChild(el('h3', null, 'What it is for'));
    crit.appendChild(el('p', 'pg-prose', award.criteria));
    parts.push(crit);
  }

  if (!isImported(award) && award.design) parts.push(downloads(award));

  stage.replaceChildren(...parts);

  const kudos = await kudosSection(award.publicId);
  if (kudos) stage.appendChild(kudos);
}

function fail(title, body, tone) {
  disclosureLine.textContent = 'Sash issues parody badges. Nothing here is an accredited credential.';
  stage.replaceChildren(card(title, body, tone));
}

/**
 * The lookup the no-id state draws under its card, so a link that promises
 * one (the 404 page's "Look up a credential") lands on one. A plain GET form:
 * submitting it opens badge.html?id=<typed>, the same address a scanned link
 * reaches, so the lookup and the verify page are one page and not two.
 */
function lookupForm() {
  const form = el('form', 'pg-lookup');
  form.method = 'get';
  form.action = 'badge.html';
  form.setAttribute('aria-label', 'Look up a credential');
  const input = el('input');
  input.type = 'text';
  input.name = 'id';
  input.placeholder = 'the ten character id';
  input.maxLength = 10;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Credential id');
  const button = el('button', 'btn', 'Verify');
  button.type = 'submit';
  form.append(input, button);
  return form;
}

async function main() {
  ensureFonts();
  // C4.1's alphabet is lowercase because the id is read off paper and typed
  // back in, and a person typing it back in may capitalise it. Fold the case
  // before the test so a capitalised transcription is a lookup, not a lecture
  // about the alphabet.
  const id = (new URLSearchParams(location.search).get('id') || '').trim().toLowerCase();

  if (!id) {
    fail('This address needs a credential id',
      'A Sash verify link looks like badge.html?id= followed by the ten character id printed on the badge. Type one here to look it up.');
    stage.firstElementChild.appendChild(lookupForm());
    return;
  }
  if (!PUBLIC_ID_RE.test(id)) {
    fail('That is not a Sash credential id',
      'A Sash id is ten characters long and uses no i, l, o or u, because it is meant to be read off paper and typed back in.',
      'warn');
    return;
  }

  let award = null;
  try {
    award = await convex.query(api.awards.byPublicId, { publicId: id });
  } catch (err) {
    console.error('Sash: the credential could not be read', err);
    fail('Sash could not read this credential',
      'The lookup did not come back. Reload the page, and if it keeps happening the service is down rather than the badge being wrong.',
      'bad');
    return;
  }

  if (!award) {
    fail('No credential has that id',
      `Nothing in Sash is filed under ${id}. Check the id against the one printed on the badge: the alphabet has no i, l, o or u in it.`,
      'warn');
    return;
  }

  try {
    await renderAward(award);
  } catch (err) {
    console.error('Sash: the credential could not be drawn', err);
    fail('This credential could not be drawn',
      'The record exists but its design did not render. That is a fault on our side, not a problem with the credential.',
      'bad');
  }
}

// A36: framed, the notice stands in for the page and nothing here runs.
if (!framed) main();

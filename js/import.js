/**
 * import.html: bringing a real credential into a Sash wallet. C9.4, C9.5, C11.4.
 *
 * Four ways in, and the reason each one exists belongs next to the code.
 *
 *   1. A pasted badge URL goes to imports:fetchPreview, a Convex action. It
 *      cannot happen here: neither www.credly.com nor api.credly.com sends any
 *      access-control-* header even when asked with an explicit Origin, so a
 *      browser cannot read either. That is structural, not a preference.
 *   2 and 3. An uploaded .json, .png or .svg is parsed in this tab by the kit's
 *      openbadges codec, no dependency and no upload. 2.0 and 3.0 are both read.
 *   4. Typed in by hand, for an issuer that publishes nothing machine readable.
 *
 * What is deliberately absent: the Credly wallet endpoint. It returns a complete
 * badge list signed out with no bot protection, and Credly's User Terms 4(b)
 * prohibit exactly that, so it is not built. And the visible badge picture is
 * not a baked badge: Credly's public PNG carries two ImageMagick timestamps and
 * no assertion, so this page never offers "download the image" as a path.
 *
 * A7 is the rule this file exists to honour. imports:save is a mutation, a
 * mutation cannot fetch, and C9.5 requires the record to be rebuilt from the
 * issuer's own answer, so the row lands unverified and a scheduled action
 * patches it about a second later. This page renders a saved import as PENDING
 * and updates when the patch lands. It never renders an unverified import as
 * verified and it never presents saving as verifying.
 */
import { framed } from './frame.js';
import { convex, api } from './convex.js';
import { unbakePng, unbakeSvg, parseCredential, OB3_KEYWORD } from './insignia/openbadges.js';
import { renderAwardCard } from './insignia/wallet.js';
import { el, stamp } from './utils.js';

const $ = (id) => document.getElementById(id);

const show = (node, on) => { if (node) node.hidden = !on; };

/** Sets a message and shows the node, or clears it and hides it. */
function say(node, message) {
  node.textContent = message || '';
  node.hidden = !message;
}

/* ── auth ──────────────────────────────────────────────────────────────────── */

let clerk = null;
let signedIn = false;

async function initAuth() {
  const key = document.querySelector('meta[name="clerk-publishable-key"]')?.content?.trim();
  if (!key) { console.warn('Sash import: no clerk-publishable-key meta, saving is unavailable.'); return; }
  const { initNeorgonClerkConvex, neorgonDisplayLabel } = await import('./vendor/neorgon-auth.js');
  clerk = await initNeorgonClerkConvex({
    convex,
    publishableKey: key,
    signInMode: 'modal',            // the only host here is the header sheet
    userButtonHost: '#neorgon-user-mount',
    onSession: ({ clerk: c, hasSession }) => {
      signedIn = hasSession;
      show($('authGate'), !hasSession);
      show($('authUser'), hasSession);
      $('authToggle')?.classList.toggle('logged-in', hasSession);
      if (hasSession) { $('authUsername').textContent = neorgonDisplayLabel(c); authSheet(false); }
    },
  });
}

/** The header sheet. Wired here because these pages do not load js/events.js. */
function authSheet(open) {
  const panel = $('authPanel');
  const on = open === undefined ? !panel.classList.contains('open') : open;
  panel.classList.toggle('open', on);
  $('authToggle').setAttribute('aria-expanded', on ? 'true' : 'false');
}

function requireSignIn(target) {
  if (signedIn) return false;
  say(target, 'Sign in first. Sash needs to know whose wallet this goes into.');
  authSheet(true);
  return true;
}

/* ── the record being previewed ────────────────────────────────────────────── */

let preview = null;          // a C9.5 ImportMeta, or null
let previewOrigin = '';      // one honest sentence about where it came from

/**
 * A15. A client parse can produce none of fetchedAt, verified or recipientMatch
 * honestly, so the two judgments are false and the timestamp says when this tab
 * read the file. imports:save forces both flags false again server-side and
 * rebuilds the record from its own fetch; this is what the validator needs to
 * accept the object at all, not a claim about it.
 */
function fromClientParse(doc, opts) {
  const meta = parseCredential(doc, opts);
  return { ...meta, verified: false, recipientMatch: false, fetchedAt: new Date().toISOString() };
}

/** Shows the record as a card plus every field, so nothing is saved unseen. */
function renderPreview() {
  const card = $('previewCard');
  const fields = $('previewFields');
  card.replaceChildren();
  fields.replaceChildren();
  if (!preview) { show($('previewSection'), false); return; }

  // C11.4: an import is drawn by the kit's import path, which reads design:null
  // and never reaches the badge renderer. The same call the wallet makes.
  card.appendChild(renderAwardCard({
    publicId: '', name: preview.name, origin: 'imported', source: 'import',
    issuerHandle: null, design: null, count: 1, status: 'valid',
    issuedAt: preview.issuedOn, expiresAt: preview.expiresOn,
    holderHandle: '', verifyUrl: '', importMeta: preview,
  }, { size: 200, linkToVerify: false }));

  const img = card.querySelector('img');
  // images.credly.com answers with access-control-allow-origin: * only when an
  // Origin header is present, and crossOrigin is what sends one. A probe taken
  // without an Origin looks like the opposite conclusion.
  if (img) img.crossOrigin = 'anonymous';

  const row = (label, value, asLink) => {
    if (value === null || value === undefined || value === '') return;
    fields.appendChild(el('dt', null, label));
    const dd = el('dd');
    if (asLink) {
      const a = el('a', null, value);
      a.href = value; a.target = '_blank'; a.rel = 'noopener noreferrer';
      dd.appendChild(a);
    } else dd.textContent = String(value);
    fields.appendChild(dd);
  };

  row('Name', preview.name);
  row('Issuer', preview.issuerName);
  row('Issuer site', preview.issuerUrl, true);
  row('Issued', preview.issuedOn);
  row('Expires', preview.expiresOn);
  row('Description', preview.description);
  row('Criteria', preview.criteriaNarrative);
  row('Criteria page', preview.criteriaUrl, true);
  row('Skills', (preview.skills || []).join(', '));
  row('Source', preview.sourceUrl, true);
  row('Assertion', preview.assertionUrl, true);
  row('Format', `${preview.provider}, ${preview.dialect}`);

  $('previewOrigin').textContent = previewOrigin;
  show($('sourceFix'), !preview.sourceUrl);
  show($('previewSection'), true);
  show($('savedSection'), false);
  say($('saveError'), '');
  $('previewSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearPreview() {
  preview = null;
  previewOrigin = '';
  show($('previewSection'), false);
  say($('saveError'), '');
}

/* ── path 1: a pasted badge URL ────────────────────────────────────────────── */

async function readUrl() {
  const err = $('readError');
  say(err, '');
  const url = $('urlInput').value.trim();
  if (!url) return say(err, 'Paste the address of one badge first.');
  if (requireSignIn(err)) return;

  const btn = $('readUrlBtn');
  btn.disabled = true;
  btn.textContent = 'Reading it';
  try {
    const res = await convex.action(api.imports.fetchPreview, { url });
    if (!res.ok) return say(err, res.message);
    preview = res.preview;
    previewOrigin = `Sash read this from ${hostOf(preview.assertionUrl)} just now. `
      + 'Nothing is saved until you say so.';
    renderPreview();
  } catch (e) {
    say(err, authAware(e, 'Sash could not read that badge.'));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Read this badge';
  }
}

const hostOf = (url) => { try { return new URL(url).hostname; } catch { return 'the issuer'; } };

const authAware = (e, fallback) => (String(e && e.message).includes('Not authenticated')
  ? 'Sign in first. Sash needs to know whose wallet this goes into.'
  : fallback);

/* ── paths 2 and 3: an uploaded file ───────────────────────────────────────── */

async function readFile() {
  const err = $('readError');
  say(err, '');
  const file = $('fileInput').files && $('fileInput').files[0];
  if (!file) return say(err, 'Choose a file first.');

  try {
    const name = file.name.toLowerCase();
    if (name.endsWith('.png')) return readPng(file);
    if (name.endsWith('.svg')) return readSvg(file);
    if (name.endsWith('.json')) return readJson(file);
    say(err, 'Sash reads a .png, a .svg or a .json. That file is none of the three.');
  } catch (e) {
    say(err, e && e.message ? e.message : 'Sash could not read that file.');
  }
}

async function readPng(file) {
  const found = unbakePng(new Uint8Array(await file.arrayBuffer()));
  if (!found) {
    return say($('readError'), 'There is no badge inside that PNG. The picture a badge site '
      + 'shows you is usually a plain image with no credential in it, whatever it looks like. '
      + 'Look for a download that says Open Badge, or paste the badge address on the first tab.');
  }
  if (found.legacyUrl) return handOffHostedUrl(found.payload);
  const dialect = found.keyword === OB3_KEYWORD ? 'ob3-jws' : 'ob2-png';
  accept(found.payload, { dialect, from: `the PNG you uploaded, which carries an ${found.keyword} chunk` });
}

async function readSvg(file) {
  const found = unbakeSvg(await file.text());
  if (!found) {
    return say($('readError'), 'There is no badge inside that SVG. Sash looks for an '
      + 'openbadges assertion or credential element.');
  }
  if (found.hostedUrl) return handOffHostedUrl(found.payload);
  const dialect = found.keyword === OB3_KEYWORD ? 'ob3-jws' : 'ob2-svg';
  accept(found.payload, { dialect, from: 'the SVG you uploaded' });
}

async function readJson(file) {
  const text = await file.text();
  const dialect = /"OpenBadgeCredential"/.test(text) ? 'ob3-jws' : 'ob2-json';
  accept(text, { dialect, from: 'the file you uploaded' });
}

/**
 * A pre-spec baked PNG and an OB 2.0 SVG can carry the ADDRESS of the assertion
 * rather than the assertion. There is nothing to parse, so the file hands off to
 * the URL path rather than failing: the address is exactly what tab one takes.
 */
function handOffHostedUrl(url) {
  $('urlInput').value = url;
  selectTab('url');
  say($('readError'), 'That file points at an address rather than carrying the badge itself. '
    + 'Sash has put the address in the box above, because reading it needs the server.');
}

function accept(payload, { dialect, from }) {
  const err = $('readError');
  try {
    preview = fromClientParse(payload, { dialect });
  } catch (e) {
    return say(err, `Sash could not read that as a credential: ${e.message}`);
  }
  previewOrigin = `Read from ${from}. Sash has not checked it with the issuer yet, `
    + 'and it will say so on the badge until it has.';
  renderPreview();
}

/* ── path 4: by hand ───────────────────────────────────────────────────────── */

function readManual() {
  const err = $('readError');
  say(err, '');
  const name = $('mName').value.trim();
  const issuerName = $('mIssuer').value.trim();
  const sourceUrl = $('mSource').value.trim();
  if (!name) return say(err, 'A credential needs a name.');
  if (!issuerName) return say(err, 'Name the issuer. That is the whole point of an import.');
  if (!/^https:\/\//i.test(sourceUrl)) return say(err, 'Where it lives has to be an https address.');

  const day = (id) => {
    const v = $(id).value;
    return v ? new Date(`${v}T00:00:00Z`).toISOString() : null;
  };
  preview = {
    provider: 'manual',
    dialect: 'manual',
    sourceUrl,
    assertionUrl: null,
    name,
    description: $('mDescription').value.trim(),
    criteriaNarrative: $('mCriteria').value.trim(),
    criteriaUrl: null,
    skills: $('mSkills').value.split(',').map((s) => s.trim()).filter(Boolean),
    issuerName,
    issuerUrl: null,
    issuerImageUrl: null,
    imageUrl: null,
    issuedOn: day('mIssuedOn'),
    expiresOn: day('mExpiresOn'),
    recipientMatch: false,
    verified: false,
    fetchedAt: new Date().toISOString(),
  };
  previewOrigin = 'Typed in by you. There is no issuer address for Sash to check, '
    + 'so this one stays labelled unverified for as long as it is in your wallet.';
  renderPreview();
}

/* ── saving, and the A7 pending state ──────────────────────────────────────── */

let pollTimer = null;

function setStatus(state, headline, detail) {
  const box = $('verifyStatus');
  box.dataset.state = state;
  box.replaceChildren();
  box.appendChild(el('span', 'status__dot'));
  const body = el('div');
  body.appendChild(el('strong', null, headline));
  if (detail) { body.appendChild(document.createTextNode(' ')); body.appendChild(document.createTextNode(detail)); }
  box.appendChild(body);
  return body;
}

async function save() {
  const err = $('saveError');
  say(err, '');
  if (!preview) return;
  if (requireSignIn(err)) return;

  if (!preview.sourceUrl) {
    const fixed = $('sourceFixInput').value.trim();
    if (!/^https:\/\//i.test(fixed)) return say(err, 'Add the https address this credential lives at.');
    preview = { ...preview, sourceUrl: fixed };
  }

  const btn = $('saveBtn');
  btn.disabled = true;
  btn.textContent = 'Saving';
  try {
    const res = await convex.mutation(api.imports.save, { preview });
    if (!res.ok) {
      if (res.code === 'no-handle') {
        return say(err, `${res.message} Your wallet page is where you pick one.`);
      }
      return say(err, res.message);
    }
    show($('previewSection'), false);
    await showSaved(res.awardPublicId);
  } catch (e) {
    say(err, authAware(e, 'Sash could not save that. Try again.'));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save to my wallet';
  }
}

/**
 * The A7 contract, rendered. The row exists and it is not verified yet, so the
 * page says exactly that and then watches for the patch. Saving is not
 * verifying and this function never lets the two look like one event.
 */
async function showSaved(publicId) {
  clearTimeout(pollTimer);
  show($('savedSection'), true);
  $('savedVerifyLink').href = `badge.html?id=${encodeURIComponent(publicId)}`;
  setStatus('pending', 'Saved, and not checked yet.',
    'Sash is asking the issuer about it now. This normally takes about a second.');
  $('savedSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

  const award = await fetchAward(publicId);
  if (!award) return;
  paintSaved(award);
  if (!award.importMeta || !award.importMeta.assertionUrl) {
    setStatus('unverified', 'Saved, and it will stay unverified.',
      'There is no issuer address on this record for Sash to check, so nothing can confirm it. '
      + 'It sits in your wallet with that label on it.');
    return;
  }
  poll(publicId, 0);
}

async function fetchAward(publicId) {
  try {
    return await convex.query(api.awards.byPublicId, { publicId });
  } catch {
    setStatus('unverified', 'Saved, but this page lost sight of it.', 'Open your wallet to see it.');
    return null;
  }
}

function paintSaved(award) {
  const card = $('savedCard');
  const fields = $('savedFields');
  card.replaceChildren();
  fields.replaceChildren();
  card.appendChild(renderAwardCard(award, { size: 200 }));
  const img = card.querySelector('img');
  if (img) img.crossOrigin = 'anonymous';

  const meta = award.importMeta || {};
  const put = (k, v) => { if (v) { fields.appendChild(el('dt', null, k)); fields.appendChild(el('dd', null, v)); } };
  put('Serial', award.publicId);
  put('Issuer', meta.issuerName);
  put('Checked', meta.verified ? `yes, ${stamp(meta.fetchedAt)}` : 'not yet');
  put('Holder match', meta.recipientMatch ? 'the issuer hashed your email' : 'no match');
}

const POLL_TRIES = 12;
const POLL_MS = 900;

/**
 * The card is repainted only when the verification actually moves, not on every
 * tick. Repainting it each time re-requests the provider's artwork, which turns
 * one blocked image into a dozen identical console errors and buries whatever
 * else is in there.
 */
function poll(publicId, tries) {
  pollTimer = setTimeout(async () => {
    const award = await fetchAward(publicId);
    const meta = (award && award.importMeta) || {};
    if (meta.verified) {
      paintSaved(award);
      const body = setStatus('verified', 'Checked with the issuer.',
        `Sash re-read ${hostOf(meta.assertionUrl)} ${stamp(meta.fetchedAt)} and rebuilt this record from the answer.`);
      if (!meta.recipientMatch) {
        body.appendChild(el('p', 'form-note',
          'The recipient on the badge does not match an email on your account. That is '
          + 'information, not a refusal: a badge you genuinely earned can have been issued '
          + 'to an address you no longer use. The credential keeps an unverified holder label.'));
      }
      return;
    }
    if (tries + 1 < POLL_TRIES) return poll(publicId, tries + 1);

    const body = setStatus('unverified', 'Still unverified.',
      'The issuer has not answered yet, or the answer did not match. The credential is in '
      + 'your wallet with an unverified label, which is the honest state until that changes.');
    const again = el('button', 'btn btn--ghost btn--sm', 'Check again');
    again.type = 'button';
    again.addEventListener('click', () => {
      setStatus('pending', 'Asking again.', '');
      poll(publicId, 0);
    });
    body.appendChild(again);
  }, POLL_MS);
}

/* ── tabs and wiring ───────────────────────────────────────────────────────── */

const TABS = ['url', 'file', 'manual'];

function selectTab(which) {
  for (const name of TABS) {
    const on = name === which;
    $(`tab-${name}`).classList.toggle('is-active', on);
    $(`tab-${name}`).setAttribute('aria-selected', on ? 'true' : 'false');
    $(`panel-${name}`).hidden = !on;
  }
}

function startOver() {
  clearTimeout(pollTimer);
  show($('savedSection'), false);
  clearPreview();
  $('urlInput').value = '';
  $('fileInput').value = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function wire() {
  for (const name of TABS) {
    $(`tab-${name}`).addEventListener('click', () => { say($('readError'), ''); selectTab(name); });
  }
  $('readUrlBtn').addEventListener('click', readUrl);
  $('readFileBtn').addEventListener('click', readFile);
  $('readManualBtn').addEventListener('click', readManual);
  $('saveBtn').addEventListener('click', save);
  $('discardBtn').addEventListener('click', clearPreview);
  $('importAnotherBtn').addEventListener('click', startOver);
  $('authToggle').addEventListener('click', () => authSheet());
  $('signInBtn').addEventListener('click', () => clerk && clerk.neorgonOpenSignIn());
  $('urlInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') readUrl(); });
}

// A36: framed, the notice stands in for the page. No listener is bound and
// Clerk is never asked for, so nothing here can write while framed.
if (!framed) { wire(); initAuth().catch((e) => console.warn('Sash import: Clerk did not load.', e)); }

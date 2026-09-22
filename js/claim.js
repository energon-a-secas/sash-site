/**
 * claim.html: the claim page. CONTRACTS.md C3, C4.3, C11.6, C15 A21 and A30.
 *
 * The page is worth arriving at whether or not the visitor has an account, so
 * `claims:preview` runs first, consumes nothing, and the badge is drawn before
 * anything mentions signing in.
 *
 * A21, which is the whole reason this file reads two expiry fields rather than
 * one: `defaultValidityMs` is how long the BADGE lasts once claimed, and
 * `expiresAt` is when the LINK stops working. They are different facts on the
 * same object and presenting either as the other is the defect the amendment
 * exists to prevent. Both are rendered, separately labelled, and both sit above
 * the sign-in call to action rather than below it. A null validity means the
 * award does not expire; it never means it expires now.
 *
 * C3.2: redeem is never called on a session change. It is behind an explicit
 * button press, so a screenshot of a claim URL opened on somebody else's
 * browser cannot quietly burn a seat.
 *
 * V5 (design round 2): a successful claim reads the minted award back and
 * swaps the whole offer for js/reveal.js's reveal, the badge drawn large with
 * its real strip, then Pin, Share and Download. The text card it replaced is
 * kept as the fallback for the case where the read-back fails: a claim that
 * went through is never reported as anything less because a second query did
 * not come back.
 */
import { framed } from './frame.js';
import { convex, api } from './convex.js';
import { renderSvg, ensureFonts } from './insignia/render.js';
import { NeoAuth } from './neorgon-auth.js';
import { prefersReducedMotion } from './neorgon-dom.js';
import { claimReveal } from './reveal.js';
import { el, humanMs, stamp } from './utils.js';

const TOKEN_RE = /^[0-9abcdefghjkmnpqrstvwxyz]{22}$/;      // C4.3

/** The lede of the Auth Kit's dialog when this page asks for a sign-in. */
const SIGN_IN_REASON = 'Sign in to claim this badge.';

const stage = document.getElementById('stage');
const disclosureLine = document.getElementById('disclosureLine');
const token = new URLSearchParams(location.search).get('t') || '';

/* ── small local helpers ────────────────────────────────────────────────────
   `el`, `humanMs` and `stamp` moved to js/utils.js under C15 A53 and A54:
   `humanMs` had a twin in Enamel that rendered "0 years" for anything under
   twelve hours, and `stamp` is the campaign's one date-and-time format. What
   stays here is what only this page draws. */

function card(title, body, tone) {
  const box = el('section', 'pg-msg');
  if (tone) box.dataset.tone = tone;
  box.appendChild(el('h2', null, title));
  if (body) box.appendChild(el('p', null, body));
  return box;
}

function linkRow(href, text) {
  const p = el('p');
  const a = el('a', null, text);
  a.href = href;
  p.appendChild(a);
  return p;
}

const ISO_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g;

/**
 * Any ISO timestamp in a server message, in words. A42.2.
 *
 * `claims:redeem` interpolated the stored number straight into its expired
 * message, so the page could read `This link expired on
 * 2026-09-09T21:06:21.000Z.` where C3.3 asks for a date. B4 is fixing the
 * string it sends; this makes the page render a date whatever arrives, which
 * is the half that holds for every other code and every future message too.
 * A string with no timestamp in it comes back unchanged.
 */
function inWords(text) {
  return String(text).replace(ISO_RE, (iso) => stamp(Date.parse(iso)) || iso);
}

/* ── the offer ──────────────────────────────────────────────────────────────*/

function artOf(preview) {
  const frame = el('section', 'pv-art');
  frame.dataset.kind = preview.kind;
  if (!preview.design) return frame;
  try {
    frame.appendChild(renderSvg(preview.design, {
      origin: preview.origin,
      issuerHandle: preview.issuerHandle,
      serial: '',
      verifyUrl: '',
      holder: '',
      issuedAt: null,
      expiresAt: null,
      mode: 'preview',                 // C3.2: nothing is issued yet, and the
    }));                               // strip still draws, with placeholders
  } catch (err) {
    // Loud, and the rest of the offer still renders: a visitor who cannot see
    // the art still needs to read the terms before signing in.
    console.error('Sash: the badge on this link could not be drawn', err);
    frame.appendChild(el('p', 'pg-note', 'The artwork on this badge did not render. Everything else on this page is what the issuer set.'));
  }
  return frame;
}

function offerOf(preview) {
  const wrap = el('section', 'pc-offer');
  wrap.appendChild(artOf(preview));

  const body = el('div', 'pg-section');
  body.appendChild(el('h2', 'pg-title', preview.templateName || 'A Sash badge'));

  const who = preview.origin === 'neorgon'
    ? 'Issued by Neorgon'
    : (preview.issuerHandle ? `Issued by @${preview.issuerHandle}` : 'Issuer not stated');
  body.appendChild(el('p', 'pg-lead', who));

  if (preview.templateDescription) body.appendChild(el('p', 'pg-prose', preview.templateDescription));

  const chips = el('div', 'pg-chips');
  if (preview.category) chips.appendChild(el('span', 'pg-chip', preview.category));
  if (preview.sphere) chips.appendChild(el('span', 'pg-chip', preview.sphere));
  chips.appendChild(el('span', 'pg-chip', preview.kind));
  body.appendChild(chips);

  if (preview.templateCriteria) {
    body.appendChild(el('h3', null, 'What it is for'));
    body.appendChild(el('p', 'pg-prose', preview.templateCriteria));
  }
  wrap.appendChild(body);
  return wrap;
}

/* ── the two expiries, which are not the same expiry (A21, A30) ─────────────*/

function term(key, label, value) {
  const row = el('div', 'pc-term');
  row.dataset.key = key;
  row.appendChild(el('dt', null, label));
  row.appendChild(el('dd', null, value));
  return row;
}

function termsOf(preview) {
  const box = el('dl', 'pc-terms');

  // The award's own validity window. Null is "this badge does not expire", and
  // it is never rendered as "expires now".
  const ms = preview.defaultValidityMs;
  if (typeof ms === 'number' && Number.isFinite(ms) && ms > 0) {
    const until = stamp(Date.now() + ms);
    box.appendChild(term('validity', 'The badge lasts',
      `${humanMs(ms)} from the moment you claim it. Claimed now, it would run until ${until}.`));
  } else {
    box.appendChild(term('validity', 'The badge lasts', 'For good. This badge does not expire.'));
  }

  // The link's own expiry. A different fact, and it gets a different label.
  const linkStamp = stamp(preview.expiresAt);
  box.appendChild(term('link', 'This link closes',
    linkStamp ? `On ${linkStamp}.` : 'No closing date was recorded on this link.'));

  const left = preview.usesLeft;
  box.appendChild(term('seats', 'Seats left',
    left === null || left === undefined
      ? 'No limit on how many people can use this link.'
      : `${left}.`));

  return box;
}

/* ── the gate ───────────────────────────────────────────────────────────────*/

const DEAD = {
  expired: ['This link has expired', 'The issuer set a closing date and it has passed. Ask them for a new one.'],
  exhausted: ['Every seat on this link is taken', 'The issuer capped how many people could use it. Ask them for a new one.'],
  revoked: ['The issuer withdrew this link', 'It cannot be claimed any more. Any badge already claimed through it is unaffected.'],
  'not-found': ['This link does not exist', 'Nothing in Sash matches this token. Check you copied the whole address.'],
};

function gateOf(preview, state) {
  const gate = el('section', 'pc-gate');

  if (state !== 'ok') {
    const [title, body] = DEAD[state] || ['This link cannot be used', 'Ask whoever sent it for a new one.'];
    gate.appendChild(card(title, body, 'warn'));
    return gate;
  }

  gate.appendChild(el('h2', null, 'Claim it'));
  gate.appendChild(el('p', 'pc-who', 'Sash needs to know who to give it to, so this part needs an account.'));

  const who = el('p', 'pc-who');
  who.id = 'who';
  who.hidden = true;
  gate.appendChild(who);

  // Two buttons, one shown at a time once the session is known: the sign-in
  // opens the Auth Kit's dialog and nothing else, and only the claim redeems.
  const actions = el('div', 'pg-actions');
  const signIn = el('button', 'btn btn--primary', 'Sign in to claim it');
  signIn.id = 'claimSignInBtn';
  signIn.type = 'button';
  signIn.hidden = true;
  actions.appendChild(signIn);
  const button = el('button', 'btn btn--primary', 'Claim this badge');
  button.id = 'claimBtn';
  button.type = 'button';
  button.hidden = true;
  actions.appendChild(button);
  gate.appendChild(actions);

  const outcome = el('div');
  outcome.id = 'outcome';
  outcome.setAttribute('aria-live', 'polite');
  gate.appendChild(outcome);

  return gate;
}

/* ── redeem, and every outcome C3.3 defines ─────────────────────────────────
   The server owns the message for each code, so the message shown is the
   message the contract froze. What is added here is the way out of each one.
   `already-held` is not an error: it is "you have this already", plus the link
   to it. */

const RETRYABLE = new Set(['rate-limited', 'no-handle', 'not-invited']);

const TONE = {
  'already-held': 'good',
  'no-handle': 'warn',
  'not-invited': 'warn',
  unpublished: 'warn',
  expired: 'warn',
  exhausted: 'warn',
  revoked: 'warn',
  'rate-limited': 'warn',
};

function outcomeNode(result, preview) {
  const out = el('div');

  if (result && result.ok) {
    // The fallback when the reveal cannot draw: the claim still went through.
    const box = card('Claimed', 'It is in your wallet now.', 'good');
    box.appendChild(linkRow(`badge.html?id=${encodeURIComponent(result.awardPublicId)}`, 'See the badge'));
    box.appendChild(linkRow('index.html', 'Open your wallet'));
    out.appendChild(box);
    return out;
  }

  const code = (result && result.code) || 'unknown';
  let message = inWords((result && result.message) || 'The claim did not go through.');

  // The preview already carries the number, so when it is there the sentence is
  // written from it rather than rewritten out of the server's. `inWords` above
  // is what covers the case where it is not: a dead token's preview reports
  // `expiresAt: 0` (A41) and there is nothing local to write from.
  if (code === 'expired' && preview && stamp(preview.expiresAt)) {
    message = `This link closed on ${stamp(preview.expiresAt)}.`;
  }

  if (code === 'already-held') {
    const box = card('You have this one already', message, 'good');
    if (result.awardPublicId) {
      box.appendChild(linkRow(`badge.html?id=${encodeURIComponent(result.awardPublicId)}`, 'See the one you hold'));
    }
    out.appendChild(box);
    return out;
  }

  const box = card('Not claimed', message, TONE[code] || 'bad');
  if (code === 'no-handle') box.appendChild(linkRow('index.html', 'Pick a handle'));
  if (code === 'not-invited') {
    box.appendChild(el('p', null, 'If you think you are on the list, check you signed in with the account that holds that handle.'));
  }
  out.appendChild(box);
  return out;
}

/**
 * V5. The badge the server just minted, drawn large where the offer was.
 *
 * `awards:byPublicId` is the anonymous read every verify page makes, so the
 * badge shown here is the badge a stranger will see, real strip included. If
 * that read fails or the reveal throws, the text card stands in: the claim is
 * settled either way and the page says so either way.
 */
async function revealClaimed(result, outcome, preview) {
  let award = null;
  try {
    award = await convex.query(api.awards.byPublicId, { publicId: result.awardPublicId });
  } catch (err) {
    console.error('Sash: the claimed badge could not be read back', err);
  }
  if (!award || !award.design) {
    outcome.replaceChildren(outcomeNode(result, preview));
    return;
  }
  let section = null;
  try {
    section = claimReveal(award);
  } catch (err) {
    console.error('Sash: the reveal could not be drawn', err);
    outcome.replaceChildren(outcomeNode(result, preview));
    return;
  }
  stage.replaceChildren(section);
  if (award.name) document.title = `Sash | ${award.name} is yours`;
  section.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

/** Redeems once. Returns true when a second press could still change the answer. */
async function redeem(button, outcome, preview) {
  button.disabled = true;
  outcome.replaceChildren(el('p', 'pg-note', 'Claiming.'));
  let result = null;
  try {
    result = await convex.mutation(api.claims.redeem, { token });
  } catch (err) {
    // C2's error convention: a throw is an authentication failure and nothing
    // else, so the way out of it is to sign in again rather than to retry.
    console.error('Sash: the claim call threw', err);
    outcome.replaceChildren(card('Sash could not tell who you are',
      'The session did not carry through to the claim. Sign in again and press the button once more.', 'bad'));
    button.disabled = false;
    return true;
  }
  if (result && result.ok) await revealClaimed(result, outcome, preview);
  else outcome.replaceChildren(outcomeNode(result, preview));

  // Only three outcomes can change if the button is pressed again: the rate
  // limit lifts, a handle gets picked, or the visitor signs in as the account
  // that is on the allow list. Every other outcome is settled, and leaving a
  // live button under a settled answer invites a retry that costs a metered
  // attempt (A9) and can never succeed. A successful claim is settled too:
  // on a stackable badge a second press quietly takes a second seat.
  const retryable = !!result && !result.ok && RETRYABLE.has(result.code);
  button.disabled = !retryable;
  button.hidden = !retryable;
  return retryable;
}

/* ── auth wiring ────────────────────────────────────────────────────────────*/

/**
 * The Auth Kit owns the sign-in: its dialog, in this site's palette, opens
 * from the gate's own button and from the header slot alike. This page only
 * decides which of its two buttons is on screen, and when redeem may run.
 *
 * C3.2 holds in two places. The session listener shows a button and never
 * calls redeem, and the claim button asks the kit for a session before it
 * redeems, so a press with a session that ended since the paint gets the
 * dialog rather than a thrown "Not authenticated".
 */
async function wireAuth(preview) {
  const button = document.getElementById('claimBtn');
  const signIn = document.getElementById('claimSignInBtn');
  const outcome = document.getElementById('outcome');
  const who = document.getElementById('who');
  if (!button) return;

  // Once an outcome is settled the claim button stays away, whatever the
  // session does afterwards: signing out and back in must not offer a second
  // seat on a stackable badge.
  let settled = false;

  signIn.addEventListener('click', (event) => {
    void NeoAuth.requireSignIn({ reason: SIGN_IN_REASON, invoker: event.currentTarget });
  });

  button.addEventListener('click', async () => {
    if (settled || button.disabled) return;
    if (!(await NeoAuth.requireSignIn({ reason: SIGN_IN_REASON, invoker: button }))) return;
    settled = !(await redeem(button, outcome, preview));
  });

  NeoAuth.onChange(({ signedIn, label }) => {
    // C3.2. This handler shows a button. It never calls redeem.
    signIn.hidden = signedIn;
    who.hidden = !signedIn;
    if (signedIn) who.textContent = `Signed in as ${label}.`;
    if (!settled) button.hidden = !signedIn;
  });

  try {
    await NeoAuth.start({ convex });
  } catch (err) {
    console.error('Sash: the sign-in could not be started', err);
    outcome.replaceChildren(card('Sign-in could not load',
      'The badge above is real and the link is fine. Sash could not reach its sign-in service, so claiming has to wait.', 'bad'));
  }
}

/* ── the page ───────────────────────────────────────────────────────────────*/

const GENERIC_DISCLOSURE =
  'Sash issues parody badges. Nothing here is an accredited credential.';

/**
 * A not-found preview names no issuer, so it gets the generic line. Saying
 * "issued by a Sash member" about a link that resolves to nothing would be
 * describing a credential that does not exist.
 */
function disclosureFor(preview) {
  if (!preview || preview.state === 'not-found') return GENERIC_DISCLOSURE;
  const who = preview.origin === 'neorgon'
    ? 'Neorgon'
    : (preview.issuerHandle ? `@${preview.issuerHandle}` : 'a Sash member');
  return `This is a Neorgon community credential, issued by ${who} on sash.neorgon.com. `
    + 'It is not a professional certification and it is not accredited by anyone.';
}

async function main() {
  ensureFonts();
  // The header slot is painted on every state of this page, dead links and
  // bad addresses included: somebody signed in elsewhere on neorgon.com still
  // sees their account here. Idempotent, so wireAuth's own start is the same
  // call. With no session cookie the kit downloads nothing from Clerk.
  NeoAuth.start({ convex }).catch((err) => console.error('Sash: the sign-in could not be started', err));

  if (!token) {
    disclosureLine.textContent = GENERIC_DISCLOSURE;
    stage.replaceChildren(card('This address needs a claim token',
      'A Sash claim link looks like claim.html?t= followed by a 22 character token. Ask whoever sent it to send the whole address.'));
    return;
  }
  if (!TOKEN_RE.test(token)) {
    disclosureLine.textContent = GENERIC_DISCLOSURE;
    stage.replaceChildren(card('This link is not a Sash claim link',
      'A Sash token is 22 characters and uses no i, l, o or u. This one is a different shape, so it was probably cut short in transit.',
      'warn'));
    return;
  }

  let preview = null;
  try {
    preview = await convex.query(api.claims.preview, { token });
  } catch (err) {
    console.error('Sash: the claim link could not be read', err);
    stage.replaceChildren(card('Sash could not read this link',
      'The lookup did not come back. Reload the page; if it keeps happening the service is down rather than the link being wrong.',
      'bad'));
    return;
  }

  if (!preview) {
    stage.replaceChildren(card('This link is not a Sash claim link',
      'The token in this address is not the shape Sash issues.', 'warn'));
    return;
  }

  disclosureLine.textContent = disclosureFor(preview);
  if (preview.templateName) document.title = `Sash | Claim ${preview.templateName}`;

  const parts = [];
  // A dead link with a design still shows the badge: knowing what you missed
  // is more use than a bare refusal.
  if (preview.design) {
    parts.push(offerOf(preview));
    parts.push(termsOf(preview));           // A21: before the gate, never after
  }
  parts.push(gateOf(preview, preview.state));
  stage.replaceChildren(...parts);

  if (preview.state === 'ok') await wireAuth(preview);
}

// A36: framed, the notice stands in for the page. Redeem is a write and a
// framed page offers none, so this is the one line that has to hold.
if (!framed) main();

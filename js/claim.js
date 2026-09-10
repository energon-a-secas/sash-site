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
 */
import { framed } from './frame.js';
import { convex, api } from './convex.js';
import { renderSvg, ensureFonts } from './insignia/render.js';
import { el, humanMs, stamp } from './utils.js';
import { initNeorgonClerkConvex, neorgonDisplayLabel } from './vendor/neorgon-auth.js';

const TOKEN_RE = /^[0-9abcdefghjkmnpqrstvwxyz]{22}$/;      // C4.3

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

  const signIn = el('div', 'pc-signin');
  signIn.id = 'signInHost';
  gate.appendChild(signIn);

  const who = el('p', 'pc-who');
  who.id = 'who';
  who.hidden = true;
  gate.appendChild(who);

  const actions = el('div', 'pg-actions');
  const button = el('button', 'btn btn--primary', 'Claim this badge');
  button.id = 'claimBtn';
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
    return;
  }
  outcome.replaceChildren(outcomeNode(result, preview));

  // Only three outcomes can change if the button is pressed again: the rate
  // limit lifts, a handle gets picked, or the visitor signs in as the account
  // that is on the allow list. Every other outcome is settled, and leaving a
  // live button under a settled answer invites a retry that costs a metered
  // attempt (A9) and can never succeed. A successful claim is settled too:
  // on a stackable badge a second press quietly takes a second seat.
  const retryable = !!result && !result.ok && RETRYABLE.has(result.code);
  button.disabled = !retryable;
  button.hidden = !retryable;
}

/* ── auth wiring ────────────────────────────────────────────────────────────*/

/**
 * Clerk's own widget, in this page's palette rather than its default light card.
 * The pattern and the variable names are `projects/buyhacks-site/js/events.js:89`,
 * the fleet's existing dark Clerk theme.
 *
 * These are literals rather than token reads because Clerk's widget lives in
 * its own shadow root and takes colours as JavaScript, not CSS. `colorPrimary`
 * and `colorText` are the values of --accent and --text-primary; the card's
 * background is deliberately one step lighter than --bg so the widget reads as
 * a panel on the page rather than a hole in it.
 */
const CLERK_APPEARANCE = {
  baseTheme: 'dark',
  variables: {
    colorPrimary: '#7c3aed',
    colorBackground: '#0b1020',
    colorInputBackground: 'rgba(255, 255, 255, 0.08)',
    colorText: '#f9f9f9',
    colorTextSecondary: 'rgba(202, 202, 202, 0.92)',
    // Without these two the social button's label draws near-black on a dark
    // card and "Continue with Google" is unreadable. Measured on the rendered
    // widget, not inferred from the token names.
    colorForeground: '#f9f9f9',
    colorNeutral: 'rgba(255, 255, 255, 0.72)',
    borderRadius: '10px',
    fontFamily: "'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
};

async function wireAuth(preview) {
  const button = document.getElementById('claimBtn');
  const outcome = document.getElementById('outcome');
  const who = document.getElementById('who');
  if (!button) return;

  button.addEventListener('click', () => { redeem(button, outcome, preview); });

  try {
    await initNeorgonClerkConvex({
      convex,
      publishableKey: document.querySelector('meta[name="clerk-publishable-key"]').content,
      signInHost: '#signInHost',
      userButtonHost: '#userButton',
      clerkAppearance: CLERK_APPEARANCE,
      signInProps: { appearance: CLERK_APPEARANCE },
      onSession: ({ clerk, hasSession }) => {
        // C3.2. This handler shows a button. It never calls redeem.
        button.hidden = !hasSession;
        who.hidden = !hasSession;
        if (hasSession) who.textContent = `Signed in as ${neorgonDisplayLabel(clerk)}.`;
      },
    });
  } catch (err) {
    console.error('Sash: the sign-in could not be loaded', err);
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

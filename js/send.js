/**
 * send.html: handing someone a stackable badge and a line about why. C2.7.
 *
 * Every rule this page shows is enforced in kudos:send, not here. A handle is
 * checked against C4.2's regex before the call only so a typo costs no round
 * trip; the refusals that matter are the server's and the page prints what the
 * server said rather than a message of its own invention.
 *
 * The two refusals worth naming, because a generic error would waste them:
 * sending to yourself is refused outright, and the caps are per day, one for
 * everything you send and a tighter one per recipient. Both come back as an
 * ordinary result rather than a throw, which is why this file reads res.ok
 * rather than catching.
 *
 * The message cap is 240 characters and nothing is truncated. The textarea has
 * no maxlength on purpose: a silent trim teaches the sender their words were
 * accepted when they were not, so the counter warns and the server refuses with
 * the exact overage.
 */
import { framed } from './frame.js';
import { convex, api } from './convex.js';
import { renderSvg, ensureFonts } from './insignia/render.js';
import { NeoAuth } from './neorgon-auth.js';
import { el } from './utils.js';

const $ = (id) => document.getElementById(id);

const show = (node, on) => { if (node) node.hidden = !on; };

function say(node, message) {
  if (!node) return;
  node.textContent = message || '';
  node.hidden = !message;
}

const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,29}$/;      // C4.2
const MESSAGE_CAP = 240;                            // C14.4

/* ── auth ──────────────────────────────────────────────────────────────────── */
// The Auth Kit owns the header slot, the sign-in dialog and the Convex token.
// This page only remembers whether there is a session, and asks for one in
// front of the send.

const SIGN_IN_REASON = 'Sign in to send recognition.';
let signedIn = false;

function initAuth() {
  NeoAuth.onChange((session) => { signedIn = session.signedIn; });
  return NeoAuth.start({ convex });
}

/* ── the badge list ────────────────────────────────────────────────────────── */

let chosen = null;                    // a TemplateRow
const designs = new Map();            // publicId to a C1 design, fetched once

// C7.4. The three spheres, in the order the catalogue uses. `meme` is not a
// sphere: it is a category that also allows stackable, so it gets its own group
// rather than being filed under one of the three.
const GROUPS = [
  ['work', 'Work'],
  ['fun', 'Fun'],
  ['mindset', 'Mindset'],
  ['meme', 'Memes'],
];

const groupOf = (t) => (t.category === 'meme' ? 'meme' : t.sphere);

async function loadBadges() {
  const list = $('badgeList');
  let rows;
  try {
    const [recognition, memes] = await Promise.all([
      convex.query(api.templates.listPublic, { category: 'recognition' }),
      convex.query(api.templates.listPublic, { category: 'meme' }),
    ]);
    rows = [...recognition, ...memes].filter((t) => t.stackable);
  } catch (e) {
    console.warn('Sash send: the badge list did not load.', e);
    list.replaceChildren(el('p', 'form-error', 'Sash could not load the badges. Reload the page.'));
    return;
  }
  if (!rows.length) {
    list.replaceChildren(el('p', 'muted', 'There are no stackable badges published yet.'));
    return;
  }

  list.replaceChildren();
  for (const [key, title] of GROUPS) {
    const inGroup = rows.filter((t) => groupOf(t) === key);
    if (!inGroup.length) continue;
    const section = el('div', 'sphere');
    section.appendChild(el('h3', 'sphere__title', title));
    const options = el('div', 'sphere__options');
    for (const t of inGroup) options.appendChild(optionFor(t));
    section.appendChild(options);
    list.appendChild(section);
  }
}

function optionFor(t) {
  const button = el('button', 'badge-option');
  button.type = 'button';
  button.setAttribute('role', 'radio');
  button.setAttribute('aria-checked', 'false');
  button.dataset.publicId = t.publicId;
  button.appendChild(el('span', 'badge-option__name', t.name));
  button.appendChild(el('span', 'badge-option__desc', t.description));
  button.addEventListener('click', () => choose(t, button));
  return button;
}

async function choose(t, button) {
  chosen = t;
  for (const other of document.querySelectorAll('.badge-option')) {
    other.setAttribute('aria-checked', other === button ? 'true' : 'false');
  }
  say($('sendError'), '');
  show($('sendNote'), false);
  await drawChosen(t);
}

/**
 * The badge as the recipient will hold it, drawn in preview mode.
 *
 * mode: "preview" is the only setting under which the serial and the verify URL
 * may be blank, and the renderer still draws the provenance strip with its
 * placeholder text, so nobody sees a Sash badge without one.
 */
async function drawChosen(t) {
  const host = $('chosenArt');
  host.replaceChildren(el('p', 'muted', 'Drawing it.'));
  let design = designs.get(t.publicId);
  if (!design) {
    try {
      const detail = await convex.query(api.templates.get, { publicId: t.publicId });
      design = detail && (detail.publishedDesign || detail.design);
      if (design) designs.set(t.publicId, design);
    } catch (e) {
      console.warn('Sash send: could not read that template.', e);
    }
  }
  if (!design) {
    host.replaceChildren(el('p', 'muted', `${t.name}. Sash could not draw this one.`));
    return;
  }
  ensureFonts();
  const svg = renderSvg(design, {
    origin: t.origin,
    issuerHandle: t.issuerHandle,
    serial: '',
    verifyUrl: '',
    holder: '',
    issuedAt: null,
    expiresAt: null,
    mode: 'preview',
  });
  svg.setAttribute('width', '220');
  svg.setAttribute('height', '220');
  host.replaceChildren(svg);
}

/* ── the message counter ───────────────────────────────────────────────────── */

function countMessage() {
  const length = $('messageInput').value.trim().length;
  const counter = $('messageCount');
  counter.textContent = `${length} of ${MESSAGE_CAP}`;
  counter.dataset.over = length > MESSAGE_CAP ? 'yes' : 'no';
}

/* ── sending ───────────────────────────────────────────────────────────────── */

async function send() {
  const err = $('sendError');
  const note = $('sendNote');
  say(err, '');
  show(note, false);

  // Signed out, the kit's dialog opens with this page's reason. Dismissed, the
  // line below says why the send did not go; signed in, the send carries on.
  if (!signedIn && !(await NeoAuth.requireSignIn({ reason: SIGN_IN_REASON, invoker: $('sendBtn') }))) {
    say(err, 'Sign in first. A badge has to come from somebody.');
    return;
  }
  if (!chosen) return say(err, 'Pick a badge first.');

  const toHandle = $('handleInput').value.trim().toLowerCase();
  if (!HANDLE_RE.test(toHandle)) {
    return say(err, 'A handle is 2 to 30 characters, lowercase letters, digits and hyphens, '
      + 'and it does not start with a hyphen.');
  }

  const btn = $('sendBtn');
  btn.disabled = true;
  btn.textContent = 'Sending';
  try {
    const res = await convex.mutation(api.kudos.send, {
      toHandle,
      templatePublicId: chosen.publicId,
      message: $('messageInput').value,
    });
    if (!res.ok) return refused(res, toHandle);
    sent(res, toHandle);
  } catch (e) {
    say(err, String(e && e.message).includes('Not authenticated')
      ? 'Your session ended. Sign in again.'
      : 'Sash could not send that. Try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send it';
  }
}

/**
 * The server's message, plus the reason behind it for the two refusals a person
 * is most likely to hit. Neither is an error in the sense of something broken,
 * so neither is rendered as one.
 */
function refused(res, toHandle) {
  say($('sendError'), res.message);
  const note = $('sendNote');
  let extra = '';

  if (res.code === 'self-send') {
    extra = 'Recognition is something somebody else hands you. Sash refuses a self-send '
      + 'rather than letting a profile fill up with badges its owner awarded themselves.';
  } else if (res.code === 'rate-limited') {
    extra = res.message.includes('@')
      ? `The per-person cap is three a day, so a single target cannot be stacked up in a `
        + `minute. Everything else you send today is unaffected, and @${toHandle} can have `
        + 'another tomorrow.'
      : 'The daily cap is thirty. Recognition that costs nothing to send stops meaning '
        + 'anything, which is the failure mode of every reward system, so there is a limit.';
  } else if (res.code === 'no-handle') {
    extra = 'Pick your own handle on your wallet page first. It is the name that appears '
      + 'on the badge as the sender.';
  } else if (res.code === 'not-found') {
    extra = 'Check the spelling. A handle is the name in a profile address, not a display name.';
  }

  if (extra) { note.textContent = extra; note.hidden = false; }
}

function sent(res, toHandle) {
  const box = $('sentStatus');
  box.dataset.state = 'verified';
  box.replaceChildren();
  box.appendChild(el('span', 'status__dot'));

  const body = el('div');
  body.appendChild(el('strong', null, `${chosen.name} is now @${toHandle}'s.`));
  body.appendChild(document.createTextNode(' '));
  body.appendChild(document.createTextNode(res.count > 1
    ? `They hold it ${res.count} times over. It shows once on their profile with x${res.count} beside it, `
      + 'and every message sent with it is kept.'
    : 'It is the first one they have of this badge. Send it again and the count stacks '
      + 'rather than the badge appearing twice.'));
  box.appendChild(body);

  $('sentAwardLink').href = `badge.html?id=${encodeURIComponent(res.awardPublicId)}`;
  show($('sentSection'), true);
  $('sentSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── wiring ────────────────────────────────────────────────────────────────── */

function wire() {
  $('sendBtn').addEventListener('click', send);
  $('messageInput').addEventListener('input', countMessage);
  $('sendAnotherBtn').addEventListener('click', () => {
    show($('sentSection'), false);
    $('messageInput').value = '';
    countMessage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('handleInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
}

// A36: framed, the notice stands in for the page. Sending is a write and a
// framed page offers none, so none of this runs.
if (!framed) {
  wire();
  countMessage();
  loadBadges();
  initAuth().catch((e) => console.warn('Sash send: sign-in did not start.', e));
}

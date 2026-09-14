// ── The signed-in wallet (index.html) ────────────────────────
// Page wiring only. The award art is drawn by js/insignia/wallet.js, which is
// the vendored kit and a different file with the same basename: this one is
// mine, that one is never edited here.

import { state, q, m, loadPrefs, savePrefs, startAuth } from './state.js';
import {
  renderSections, renderShowcase, renderCounts, countsOf,
  avatarNode, hasAvatar, bindCounter, setChip,
} from './render.js';
import { exportProfilePng, triggerDownload, slugify } from './insignia/export.js';
import { ensureFonts } from './insignia/render.js';
import { HANDLE_RE } from './insignia/schema.js';
import { randomSpec, readCharacter, specToCode } from './neorgon-avatar.js';
import { NeoAuth } from './neorgon-auth.js';
import { $, el, show, setError, showToast, walletGroup, GROUP_LABELS, plural } from './utils.js';

const SHOWCASE_MAX = 24;

/** The lede of the sign-in dialog when a write on this page asks for one. */
const SIGN_IN_REASON = 'Sign in to see your wallet.';

/** The avatar code being edited, before it is saved. */
let draftAvatar = null;

/* ── boot ───────────────────────────────────────────────────── */

export async function initWallet() {
  loadPrefs();
  ensureFonts();
  $('showHidden').checked = state.showHidden;
  bindCounter($('fDisplayName'), document.querySelector('[data-count-for="fDisplayName"]'));
  bindCounter($('fHeadline'), document.querySelector('[data-count-for="fHeadline"]'));
  bindCounter($('fBio'), document.querySelector('[data-count-for="fBio"]'));

  try {
    await startAuth((signedIn) => { void onSession(signedIn); });
  } catch (err) {
    // The kit reports its own failures in its dialog; this is only for a
    // throw before it got that far, and the page still has to leave "Loading".
    console.error('Sash: auth did not start', err);
    paintState(false);
  }
}

async function onSession(signedIn) {
  if (!signedIn) {
    state.profile = null;
    state.awards = [];
    paintState(false);
    return;
  }
  await refresh();
}

/** Load the profile and the wallet, then draw whichever of the three states holds. */
export async function refresh() {
  try {
    state.profile = await q.me();
    state.awards = state.profile ? await q.mine() : [];
    setError($('pageError'), '');
  } catch (err) {
    console.error('Sash: could not load the wallet', err);
    setError($('pageError'), 'Sash could not load your wallet. Reload the page to try again.');
  }
  paintState(true);
}

function paintState(signedIn) {
  state.ready = true;
  const hasHandle = !!(state.profile && state.profile.handle);
  show($('bootState'), false);
  show($('signedOut'), !signedIn);
  show($('needHandle'), signedIn && !hasHandle);
  show($('walletMain'), signedIn && hasHandle);
  if (signedIn && hasHandle) paintWallet();
}

/* ── drawing ────────────────────────────────────────────────── */

function paintWallet() {
  const p = state.profile;
  $('meName').textContent = p.displayName || p.handle;
  $('meHandle').textContent = `@${p.handle}`;
  $('meHeadline').textContent = p.headline || '';
  $('viewPublic').href = `u.html?h=${encodeURIComponent(p.handle)}`;
  $('meAvatar').replaceChildren(avatarNode(p.avatarCode, p.handle, 72));
  renderCounts($('meCounts'), countsOf(state.awards));

  if (!$('meForm').dataset.filled) fillForm(p);

  const visible = state.awards.filter((a) => state.showHidden || !a.hidden);
  const hiddenCount = state.awards.filter((a) => a.hidden).length;
  $('awardsLead').textContent = hiddenCount
    ? `${plural(state.awards.length, 'badge', 'badges')}, ${hiddenCount} hidden.`
    : plural(state.awards.length, 'badge', 'badges');

  renderShowcase($('showcaseList'), p.showcase || [], state.awards, showcaseControls);
  renderSections($('awardSections'), visible, {
    filter: state.group,
    controls: cardControls,
    emptyText: state.group === 'all'
      ? 'No badges yet. Claim one from a link, or send recognition to somebody else.'
      : `Nothing in ${GROUP_LABELS[state.group]} yet.`,
  });
}

function fillForm(p) {
  $('fDisplayName').value = p.displayName || '';
  $('fHeadline').value = p.headline || '';
  $('fBio').value = p.bio || '';
  $('fVisibility').value = p.visibility || 'public';
  draftAvatar = p.avatarCode || null;
  paintAvatarField();
  $('meForm').dataset.filled = 'yes';
  for (const input of $('meForm').querySelectorAll('input, textarea')) {
    input.dispatchEvent(new Event('input'));
  }
}

function paintAvatarField() {
  $('formAvatar').replaceChildren(avatarNode(draftAvatar, state.profile?.handle, 96));
  $('avatarHint').textContent = hasAvatar(draftAvatar)
    ? 'Saved with your profile and shown on your public page.'
    : 'No character saved yet. This is the stand-in every Neorgon site draws for your handle.';
}

/* ── the controls under a card ──────────────────────────────── */

function actionButton(label, act, id, extra) {
  const button = el('button', `sash-act${extra ? ` ${extra}` : ''}`, label);
  button.type = 'button';
  button.dataset.act = act;
  button.dataset.id = id;
  return button;
}

function cardControls(award) {
  const row = el('div', 'sash-card-actions');
  const pinned = !!award.pinned;
  row.appendChild(actionButton(pinned ? 'Pinned' : 'Pin', 'pin', award.publicId,
    pinned ? 'is-on' : ''));
  row.appendChild(actionButton(award.hidden ? 'Show' : 'Hide', 'hide', award.publicId));
  return row;
}

function showcaseControls(award, place, total) {
  const row = el('div', 'sash-card-actions');
  const up = actionButton('Move left', 'up', award.publicId);
  up.title = 'Move earlier in the showcase';
  up.disabled = place <= 0;
  const down = actionButton('Move right', 'down', award.publicId);
  down.title = 'Move later in the showcase';
  down.disabled = place >= total - 1;
  row.appendChild(up);
  row.appendChild(down);
  row.appendChild(actionButton('Unpin', 'unpin', award.publicId));
  return row;
}

/* ── actions ────────────────────────────────────────────────── */

/**
 * The hero "Sign in to start" button. The kit's dialog is the only sign-in
 * surface: on a host where clerk-js cannot load it says so inside the dialog,
 * so there is nothing for this page to catch or to paint.
 */
export function signIn(event) {
  void NeoAuth.openSignIn({ reason: SIGN_IN_REASON, invoker: event?.currentTarget });
}

/**
 * True when there is a session to write with, asking for one otherwise. Every
 * write below runs behind a control that is only drawn signed in, but a session
 * can end between the paint and the press; the dialog is the answer to that,
 * not a thrown "Not authenticated".
 */
function signedIn(invoker) {
  return NeoAuth.requireSignIn({ reason: SIGN_IN_REASON, invoker });
}

export async function claimHandle(raw) {
  const handle = String(raw || '').trim().toLowerCase();
  const errorSlot = $('handleError');
  if (!HANDLE_RE.test(handle)) {
    setError(errorSlot, 'A handle is 2 to 30 characters, lowercase letters, digits and hyphens, and starts with a letter or a digit.');
    return;
  }
  setError(errorSlot, '');
  if (!(await signedIn($('handleSubmit')))) return;
  $('handleSubmit').disabled = true;
  try {
    const out = await m.claimHandle(handle);
    if (!out.ok) { setError(errorSlot, out.message); return; }
    showToast(`Your handle is @${handle}.`);
    await refresh();
  } catch (err) {
    console.error('Sash: claiming a handle failed', err);
    setError(errorSlot, 'That did not reach the server. Try again.');
  } finally {
    $('handleSubmit').disabled = false;
  }
}

export async function saveProfile() {
  const errorSlot = $('profileError');
  setError(errorSlot, '');
  show($('profileSaved'), false);
  if (!(await signedIn($('profileSave')))) return;
  $('profileSave').disabled = true;
  try {
    const out = await m.updateMine({
      displayName: $('fDisplayName').value.trim(),
      headline: $('fHeadline').value.trim(),
      bio: $('fBio').value.trim(),
      visibility: $('fVisibility').value,
      avatarCode: draftAvatar,
    });
    if (!out.ok) { setError(errorSlot, out.message); return; }
    show($('profileSaved'), true);
    await refresh();
    paintAvatarField();
  } catch (err) {
    console.error('Sash: saving the profile failed', err);
    setError(errorSlot, 'That did not reach the server. Try again.');
  } finally {
    $('profileSave').disabled = false;
  }
}

/* avatar */

export function avatarFromCookie() {
  const spec = readCharacter();
  if (!spec) {
    showToast('No Neorgon character found in this browser yet.');
    return;
  }
  draftAvatar = specToCode(spec);
  paintAvatarField();
}

export function avatarShuffle() {
  draftAvatar = specToCode(randomSpec());
  paintAvatarField();
}

export function avatarClear() {
  draftAvatar = null;
  paintAvatarField();
}

/* showcase */

async function writeShowcase(next, undoMessage) {
  const before = state.profile.showcase || [];
  state.profile.showcase = next;
  for (const award of state.awards) award.pinned = next.includes(award.publicId);
  paintWallet();
  try {
    const out = await m.setShowcase(next);
    if (out.ok) return;
    state.profile.showcase = before;
    for (const award of state.awards) award.pinned = before.includes(award.publicId);
    paintWallet();
    showToast(out.message || undoMessage);
  } catch (err) {
    console.error('Sash: the showcase did not save', err);
    state.profile.showcase = before;
    for (const award of state.awards) award.pinned = before.includes(award.publicId);
    paintWallet();
    showToast('The showcase did not save. Try again.');
  }
}

export async function togglePin(publicId) {
  if (!(await signedIn())) return;
  const list = [...(state.profile.showcase || [])];
  const at = list.indexOf(publicId);
  if (at >= 0) {
    list.splice(at, 1);
  } else {
    if (list.length >= SHOWCASE_MAX) {
      showToast(`A showcase holds ${SHOWCASE_MAX} badges. Unpin one first.`);
      return;
    }
    list.push(publicId);
  }
  await writeShowcase(list, 'The showcase did not save.');
}

export async function moveShowcase(publicId, delta) {
  if (!(await signedIn())) return;
  const list = [...(state.profile.showcase || [])];
  const at = list.indexOf(publicId);
  const to = at + delta;
  if (at < 0 || to < 0 || to >= list.length) return;
  [list[at], list[to]] = [list[to], list[at]];
  await writeShowcase(list, 'The new order did not save.');
}

/* hide */

export async function toggleHidden(publicId) {
  const award = state.awards.find((a) => a.publicId === publicId);
  if (!award) return;
  if (!(await signedIn())) return;
  const next = !award.hidden;
  award.hidden = next;
  paintWallet();
  try {
    const out = await m.setAwardHidden(publicId, next);
    if (out.ok) {
      showToast(next ? 'Hidden from your public profile.' : 'Back on your public profile.');
      return;
    }
    award.hidden = !next;
    paintWallet();
    showToast(out.message);
  } catch (err) {
    console.error('Sash: hiding an award failed', err);
    award.hidden = !next;
    paintWallet();
    showToast('That did not reach the server. Try again.');
  }
}

/* view */

export function setGroup(group) {
  state.group = group;
  setChip(document.querySelector('.sash-chips'), group);
  paintWallet();
}

export function setShowHidden(on) {
  state.showHidden = on;
  savePrefs();
  paintWallet();
}

export function toggleEdit() {
  const panel = $('profileForm');
  const open = panel.hasAttribute('hidden');
  show(panel, open);
  $('editToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* export */

export async function exportWallet() {
  const button = $('exportBtn');
  const list = state.awards
    .filter((a) => !a.hidden && a.status !== 'revoked')
    .filter((a) => state.group === 'all' || walletGroup(a) === state.group);
  if (!list.length) {
    showToast('Nothing to put in the picture yet.');
    return;
  }
  button.disabled = true;
  const label = button.textContent;
  button.textContent = 'Drawing';
  try {
    const p = state.profile;
    const blob = await exportProfilePng(list, {
      handle: p.handle, displayName: p.displayName, headline: p.headline,
    });
    const suffix = state.group === 'all' ? '' : `-${state.group}`;
    triggerDownload(blob, `${slugify(p.handle)}${suffix}.png`);
  } catch (err) {
    // The exporter throws rather than shipping a picture in the wrong typeface
    // (C6.2). A silent fallback here would report success on a broken export.
    console.error('Sash: the export failed', err);
    showToast('The picture could not be drawn. Try again; if it keeps failing, use the report control in the bottom left corner.');
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

export function lookUp(handle) {
  const wanted = String(handle || '').trim().toLowerCase();
  if (!HANDLE_RE.test(wanted)) {
    showToast('A handle is 2 to 30 characters, lowercase letters, digits and hyphens.');
    return;
  }
  location.href = `u.html?h=${encodeURIComponent(wanted)}`;
}

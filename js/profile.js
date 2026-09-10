// ── The public profile (u.html?h=<handle>) ───────────────────
// A stranger with no account is the first reader of this page, so the profile
// loads before auth does and never waits on it.

import { state, q, startAuth, openSignIn } from './state.js';
import { renderSections, renderShowcase, resolveShowcase, renderCounts, avatarNode, setChip } from './render.js';
import { exportProfilePng, triggerDownload, slugify } from './insignia/export.js';
import { ensureFonts } from './insignia/render.js';
import { HANDLE_RE } from './insignia/schema.js';
import { $, show, setError, showToast, param, GROUP_LABELS, plural } from './utils.js';

/* ── boot ───────────────────────────────────────────────────── */

export async function initProfile() {
  ensureFonts();
  state.handle = param('h').toLowerCase();
  await load();
  // Auth is for the header only here. A failure to load it leaves the profile
  // on screen, because a reader of a public page never needed an account.
  try {
    await startAuth((signedIn) => {
      $('authUsername').textContent = state.authLabel;
      show($('authGate'), !signedIn);
      show($('authUser'), signedIn);
      $('authToggle').classList.toggle('logged-in', signedIn);
    });
  } catch (err) {
    console.error('Sash: auth did not start', err);
    setError($('authError'), 'Sign-in did not load. The profile below does not need it.');
  }
}

async function load() {
  show($('bootState'), true);
  if (!HANDLE_RE.test(state.handle)) {
    missing(state.handle
      ? 'That is not a Sash handle. A handle is 2 to 30 characters, lowercase letters, digits and hyphens.'
      : 'Add a handle to the address, like u.html?h=duckfan.');
    return;
  }

  try {
    state.publicProfile = await q.byHandle(state.handle);
  } catch (err) {
    console.error('Sash: could not read the profile', err);
    show($('bootState'), false);
    setError($('pageError'), 'Sash could not load this profile. Reload the page to try again.');
    return;
  }

  if (!state.publicProfile) {
    missing(`No public profile at @${state.handle}. It may not exist, or its owner keeps it private.`);
    return;
  }
  await loadAwards();
  // The first read is always the whole wall, so it is also what the showcase
  // resolves against. A chip narrows `awards` afterwards and this list stays
  // put: filtering the wall is not meant to empty the strip above it.
  state.allAwards = state.awards;
  paint();
}

/** The wall for the current chip. The server does the grouping (C7.22). */
async function loadAwards() {
  try {
    state.awards = await q.forHandle(state.handle, state.group);
    setError($('pageError'), '');
  } catch (err) {
    console.error('Sash: could not read the wall', err);
    state.awards = [];
    setError($('pageError'), 'Sash could not load these badges. Reload the page to try again.');
  }
}

function missing(text) {
  show($('bootState'), false);
  show($('profileMain'), false);
  $('missingText').textContent = text;
  show($('profileMissing'), true);
  document.title = 'Sash | Public profile';
}

/* ── drawing ────────────────────────────────────────────────── */

function paint() {
  const p = state.publicProfile;
  show($('bootState'), false);
  show($('profileMissing'), false);
  show($('profileMain'), true);

  const name = p.displayName || p.handle;
  document.title = `Sash | ${name}`;
  $('pName').textContent = name;
  $('pHandle').textContent = `@${p.handle}`;
  $('pHeadline').textContent = p.headline || '';
  show($('pHeadline'), !!p.headline);
  $('pBio').textContent = p.bio || '';
  show($('pBio'), !!p.bio);
  $('pAvatar').replaceChildren(avatarNode(p.avatarCode, p.handle, 96));
  renderCounts($('pCounts'), p.counts || {});

  paintShowcase();
  paintWall();
  paintEmbed(p);
}

/**
 * The showcase, A39.
 *
 * `profiles:byHandle` returned no `showcase` until that amendment, so pinning
 * had no public effect and a stranger read the server's order. The feature is
 * "choose what to show proudly", which needs a reader other than its owner.
 *
 * An absent or empty list is not an error and not an empty state: the section
 * is simply not there, exactly as it was before the field existed.
 */
function paintShowcase() {
  const p = state.publicProfile;
  const pinned = resolveShowcase(p.showcase, state.allAwards);
  show($('pShowcaseSection'), pinned.length > 0);
  if (!pinned.length) return;

  $('pShowcaseLead').textContent =
    `${plural(pinned.length, 'badge', 'badges')} @${p.handle} chose to show first.`;
  renderShowcase($('pShowcaseList'), p.showcase, state.allAwards, null);
}

function paintWall() {
  const p = state.publicProfile;
  const total = Object.values(p.counts || {}).reduce((sum, n) => sum + n, 0);
  $('wallLead').textContent = state.group === 'all'
    ? `${plural(total, 'badge', 'badges')} on this profile.`
    : `${GROUP_LABELS[state.group]}: ${plural(state.awards.length, 'badge', 'badges')}.`;

  renderSections($('awardSections'), showcaseFirst(state.awards, p.showcase), {
    filter: 'all',                  // the server already filtered by group
    emptyText: state.group === 'all'
      ? `@${p.handle} has no badges to show yet.`
      : `@${p.handle} has nothing in ${GROUP_LABELS[state.group]}.`,
  });
}

/**
 * The wall in the owner's order: pinned first, in showcase order, then the rest
 * in the order the server sent.
 *
 * The strip above already shows the pinned badges, and this is what makes the
 * choice hold inside a group as well, so a reader who filters to Community
 * still sees the pinned Community badge first. `sort` is stable, so everything
 * unpinned keeps the server's order rather than being shuffled.
 */
function showcaseFirst(awards, showcase) {
  if (!Array.isArray(showcase) || !showcase.length) return awards;
  const rank = new Map(showcase.map((id, i) => [id, i]));
  const last = Number.MAX_SAFE_INTEGER;
  return [...awards].sort((a, b) =>
    (rank.has(a.publicId) ? rank.get(a.publicId) : last)
    - (rank.has(b.publicId) ? rank.get(b.publicId) : last));
}

/**
 * The embed snippet, exactly as C5.1 froze it.
 *
 * The literal string matters: it is the markup a reader pastes into somebody
 * else's page, and the contract names every attribute on it.
 */
function paintEmbed(p) {
  const name = p.displayName || p.handle;
  const snippet =
    `<iframe src="https://sash.neorgon.com/embed.html?h=${p.handle}&group=all&limit=12"\n`
    + `        title="${name} on Sash" width="100%" height="420"\n`
    + `        style="border:0" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
  $('embedSnippet').textContent = snippet;
  $('embedPreview').href = `embed.html?h=${encodeURIComponent(p.handle)}&group=all&limit=12`;
}

/* ── actions ────────────────────────────────────────────────── */

export function signIn() {
  if (!openSignIn()) setError($('authError'), 'Sign-in has not loaded yet. Try again in a moment.');
}

export async function setGroup(group) {
  state.group = group;
  setChip(document.querySelector('.sash-chips'), group);
  await loadAwards();
  paintWall();
}

export function toggleEmbed() {
  const box = $('embedBox');
  const open = box.hasAttribute('hidden');
  show(box, open);
  $('embedToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export async function copyEmbed() {
  const text = $('embedSnippet').textContent;
  try {
    await navigator.clipboard.writeText(text);
    showToast('Snippet copied.');
  } catch {
    // Clipboard access is refused in plenty of ordinary situations, so say what
    // to do instead of pretending it worked.
    const range = document.createRange();
    range.selectNodeContents($('embedSnippet'));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    showToast('The browser refused the clipboard. The snippet is selected, copy it.');
  }
}

export async function exportProfile() {
  const button = $('exportBtn');
  const list = state.awards.filter((a) => a.status !== 'revoked');
  if (!list.length) {
    showToast('Nothing to put in the picture yet.');
    return;
  }
  button.disabled = true;
  const label = button.textContent;
  button.textContent = 'Drawing';
  try {
    const p = state.publicProfile;
    const blob = await exportProfilePng(list, {
      handle: p.handle, displayName: p.displayName, headline: p.headline,
    });
    const suffix = state.group === 'all' ? '' : `-${state.group}`;
    triggerDownload(blob, `${slugify(p.handle)}${suffix}.png`);
  } catch (err) {
    console.error('Sash: the export failed', err);
    showToast('The picture could not be drawn. The console has the reason.');
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

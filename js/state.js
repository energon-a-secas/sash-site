// ── State ────────────────────────────────────────────────────
// One shared mutable object, plus the session boot. Every module imports the
// same reference. Nothing here touches the DOM.

import { convex, api } from './convex.js';

const PREFS_KEY = 'sash-prefs';

export const state = {
  page: '',                 // 'wallet' | 'profile'
  ready: false,             // the first load has settled, success or not
  signedIn: false,
  authLabel: '',
  clerk: null,

  profile: null,            // profiles:me      (wallet page)
  publicProfile: null,      // profiles:byHandle (profile page). Carries `showcase` since A39.
  handle: '',               // whose profile the profile page is showing
  awards: [],               // OwnAward[] on the wallet, PublicAward[] on a profile
  allAwards: [],            // profile page only: the ungrouped wall from the first
                            // load, so the showcase survives a chip that narrows
                            // `awards` to one group

  group: 'all',             // C7.22, the visible filter
  showHidden: false,
  busy: false,
};

/** Only view preferences are persisted. Nothing about a person lives here. */
export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (typeof saved.showHidden === 'boolean') state.showHidden = saved.showHidden;
  } catch { /* ignore corrupted preferences */ }
}

export function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ showHidden: state.showHidden }));
  } catch { /* quota exceeded or private browsing */ }
}

/* ── Convex calls ───────────────────────────────────────────── */
// Thin named wrappers so a page never types a function-name string. The names
// come from js/convex.js, which is B1's file and the mirror of the server.

export const q = {
  me:        () => convex.query(api.profiles.me, {}),
  byHandle:  (handle) => convex.query(api.profiles.byHandle, { handle }),
  mine:      () => convex.query(api.awards.mine, {}),
  forHandle: (handle, group) => convex.query(api.awards.forHandle, { handle, group }),
};

export const m = {
  claimHandle:    (handle) => convex.mutation(api.profiles.claimHandle, { handle }),
  updateMine:     (patch) => convex.mutation(api.profiles.updateMine, patch),
  setShowcase:    (awardPublicIds) => convex.mutation(api.profiles.setShowcase, { awardPublicIds }),
  setAwardHidden: (awardPublicId, hidden) =>
    convex.mutation(api.profiles.setAwardHidden, { awardPublicId, hidden }),
};

/* ── Session ────────────────────────────────────────────────── */

/**
 * Boot Clerk and keep the Convex client's JWT in step.
 *
 * The public profile must render for a stranger, so this is always called
 * after the page's own data has loaded and a failure here is reported in the
 * auth sheet rather than thrown at the page.
 */
export async function startAuth(onSession) {
  const key = document.querySelector('meta[name="clerk-publishable-key"]')?.content?.trim();
  if (!key) throw new Error('clerk-publishable-key meta tag is missing');

  const { initNeorgonClerkConvex, neorgonDisplayLabel } = await import('./vendor/neorgon-auth.js');
  state.clerk = await initNeorgonClerkConvex({
    convex,
    publishableKey: key,
    signInHost: '#neorgon-signin-mount',
    // The only host here is the header sheet, which is too small for the form.
    signInMode: 'modal',
    userButtonHost: '#neorgon-user-mount',
    signInProps: { appearance: { layout: { unsafe_disableDevelopmentModeWarnings: true } } },
    onSession: ({ clerk, hasSession }) => {
      state.signedIn = hasSession;
      state.authLabel = hasSession ? neorgonDisplayLabel(clerk) : '';
      onSession(hasSession);
    },
  });
  return state.clerk;
}

/** Open Clerk's own dialog. Returns false when auth has not booted yet. */
export function openSignIn() {
  if (state.clerk && typeof state.clerk.neorgonOpenSignIn === 'function') {
    state.clerk.neorgonOpenSignIn();
    return true;
  }
  return false;
}

// ── State ────────────────────────────────────────────────────
// One shared mutable object, plus the session boot. Every module imports the
// same reference. Nothing here touches the DOM: the header slot and the sign-in
// dialog are the Auth Kit's (js/neorgon-auth.js, vendored, never edited here).

import { convex, api } from './convex.js';
import { NeoAuth } from './neorgon-auth.js';

const PREFS_KEY = 'sash-prefs';

export const state = {
  page: '',                 // 'wallet' | 'profile'
  ready: false,             // the first load has settled, success or not
  signedIn: false,
  authLabel: '',

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
 * Start the Auth Kit and keep the Convex client's token in step with it.
 *
 * The kit owns the header slot and the sign-in dialog, so nothing here paints
 * a signed-in state into markup. `onSession` hears the settled state once, then
 * every real change (signed in, signed out, another account), never a token
 * refresh tick. The public profile must render for a stranger, so this is
 * always called after the page's own data has loaded.
 *
 * A production key on localhost, or a blocked clerk-js, is reported inside the
 * kit's dialog when somebody asks to sign in. It never throws at the page.
 */
export function startAuth(onSession) {
  NeoAuth.onChange(({ signedIn, label }) => {
    state.signedIn = signedIn;
    state.authLabel = signedIn ? label : '';
    onSession(signedIn);
  });
  return NeoAuth.start({ convex });
}

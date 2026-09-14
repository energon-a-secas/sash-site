// ── Event handlers ───────────────────────────────────────────
// Every listener on both pages lives here. There is no inline onclick anywhere
// in this project and nothing is put on `window` for markup to call: the
// markup is markup, and the wiring is this file.

import { $ } from './utils.js';
import * as wallet from './wallet.js';
import * as profile from './profile.js';

// The header's account control is the Auth Kit's slot, wired by the kit itself.
// Nothing here binds a sign-in sheet: the only site-owned sign-in control is
// the hero button on index.html, and it opens the kit's dialog.

/* ── index.html ─────────────────────────────────────────────── */

export function bindWalletEvents() {
  $('heroSigninBtn')?.addEventListener('click', wallet.signIn);

  $('handleForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    void wallet.claimHandle($('handleInput').value);
  });

  $('lookupForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    wallet.lookUp($('lookupHandle').value);
  });

  $('editToggle')?.addEventListener('click', wallet.toggleEdit);

  $('meForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    void wallet.saveProfile();
  });

  $('avatarFromCookie')?.addEventListener('click', wallet.avatarFromCookie);
  $('avatarShuffle')?.addEventListener('click', wallet.avatarShuffle);
  $('avatarClear')?.addEventListener('click', wallet.avatarClear);

  $('exportBtn')?.addEventListener('click', () => { void wallet.exportWallet(); });

  $('showHidden')?.addEventListener('change', (e) => {
    wallet.setShowHidden(e.target.checked);
  });

  document.querySelector('.sash-chips')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.sash-chip');
    if (chip) wallet.setGroup(chip.dataset.group);
  });

  // The card controls are rebuilt on every paint, so they are delegated from
  // the two containers rather than bound per button.
  const onAction = (e) => {
    const button = e.target.closest('[data-act]');
    if (!button) return;
    const id = button.dataset.id;
    switch (button.dataset.act) {
      case 'pin':
      case 'unpin': void wallet.togglePin(id); break;
      case 'hide':  void wallet.toggleHidden(id); break;
      case 'up':    void wallet.moveShowcase(id, -1); break;
      case 'down':  void wallet.moveShowcase(id, 1); break;
      default: break;
    }
  };
  $('awardSections')?.addEventListener('click', onAction);
  $('showcaseList')?.addEventListener('click', onAction);
}

/* ── u.html ─────────────────────────────────────────────────── */

export function bindProfileEvents() {
  $('lookupForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    profile.lookUp($('lookupHandle').value);
  });

  $('exportBtn')?.addEventListener('click', () => { void profile.exportProfile(); });
  $('embedToggle')?.addEventListener('click', profile.toggleEmbed);
  $('embedCopy')?.addEventListener('click', () => { void profile.copyEmbed(); });

  document.querySelector('.sash-chips')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.sash-chip');
    if (chip) void profile.setGroup(chip.dataset.group);
  });
}

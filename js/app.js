// ── Entry point ──────────────────────────────────────────────
// Both pages load this one module and it dispatches on `body[data-page]`.
// Wiring only: keep it under 50 lines.

import { framed } from './frame.js';
import { state } from './state.js';
import { bindWalletEvents, bindProfileEvents } from './events.js';
import { initWallet } from './wallet.js';
import { initProfile } from './profile.js';

const PAGES = {
  wallet: { bind: bindWalletEvents, init: initWallet },
  profile: { bind: bindProfileEvents, init: initProfile },
};

function init() {
  // A36: framed, js/frame.js has already put a notice in place of the page.
  // Nothing below this line runs, so no sign-in mounts and no control is wired.
  if (framed) return;
  state.page = document.body.dataset.page || '';
  const page = PAGES[state.page];
  if (!page) {
    console.error('Sash: no page controller for %o', state.page);
    return;
  }
  page.bind();
  void page.init();
}

init();

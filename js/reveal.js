/**
 * The claim moment (V5), and the reveal the wallet reuses for new arrivals.
 *
 * Two things live here. `reveal(node)` marks a rendered badge for the
 * animated reveal that css/public.css and css/style.css define on the kit's
 * class hooks (`.ins-body`, `.ins-rings`, `.ins-centre`, `.ins-arc`,
 * `.ins-pips`, `.ins-ribbon`, `.ins-mark`, `.ins-finish`, `.ins-prov`) and
 * resolves once the provenance strip has settled. `claimReveal(award)` is the
 * section claim.html swaps in for the text card it used to show: the badge
 * drawn large from the award the server just minted, the count when the
 * badge is stacked, and Pin, Share and Download in one row.
 *
 * The strip is the last part the kit draws and the last part that moves
 * here, so no screenshot of a reveal catches the disclosure still fading while
 * the achievement is already sharp; the action row is shown only after it has
 * settled. Under prefers-reduced-motion the stylesheets set no animation and
 * this module resolves at once, so nothing waits on an event that never fires.
 *
 * Share is the kit's `sharePng`, with the strip inside the picture, where the
 * browser has a share sheet that takes files. Where it does not (desktop
 * Firefox has no `navigator.canShare`) the verify URL goes on the clipboard.
 * Neither branch is silent: each writes one line into the status slot.
 */
import { renderSvg, setArtUrls } from './insignia/render.js';
import { provenanceOf } from './insignia/wallet.js';
import { formatDate } from './insignia/certificate.js';
import { exportPng, sharePng, triggerDownload, slugify } from './insignia/export.js';
import { copyText, prefersReducedMotion } from './neorgon-dom.js';
import { q, m } from './state.js';
import { el } from './utils.js';

export const REVEAL_CLASS = 'pc-reveal';
/** The stylesheet's sequence ends near 1.5 s. Past this the row shows whatever the strip did. */
export const SETTLE_TIMEOUT_MS = 2600;
/** profiles:setShowcase's cap, the number wallet.js keeps under the same name. */
const SHOWCASE_MAX = 24;

/* ── the reveal itself ──────────────────────────────────────────────────────*/

/**
 * Mark `node` for the reveal and resolve when the strip has settled.
 *
 * Resolves with `'instant'` under reduced motion or when the node holds no
 * strip to wait for (a certificate's band is static and drawn in full), with
 * `'settled'` on the strip's own animationend, and with `'timeout'` if no
 * such event arrives, so a browser that never fires it still gets the row.
 */
export function reveal(node, { reduced = prefersReducedMotion() } = {}) {
  node.classList.add(REVEAL_CLASS);
  if (reduced || !node.querySelector('.ins-prov')) {
    node.classList.add('is-settled');
    return Promise.resolve('instant');
  }
  return new Promise((resolve) => {
    let timer = 0;
    const settle = (how) => {
      clearTimeout(timer);
      node.removeEventListener('animationend', onEnd, true);
      node.classList.add('is-settled');
      resolve(how);
    };
    const onEnd = (event) => {
      const target = event.target;
      if (target && typeof target.closest === 'function' && target.closest('.ins-prov')) settle('settled');
    };
    node.addEventListener('animationend', onEnd, true);
    timer = setTimeout(() => settle('timeout'), SETTLE_TIMEOUT_MS);
  });
}

/* ── the count when stacked ─────────────────────────────────────────────────*/

const SMALL = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

/** `3` to `third`, `21` to `21st`. Words up to ten, digits past it. */
export function ordinal(count) {
  const n = Math.floor(count);
  if (n >= 1 && n <= 10) return SMALL[n];
  const tail = n % 100;
  const suffix = tail >= 11 && tail <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th';
  return `${n}${suffix}`;
}

/** "Your third Debugging Hero." on a stacked badge; empty on the first. */
export function nthLine(count, name) {
  if (!(count > 1)) return '';
  return `Your ${ordinal(count)} ${name}.`;
}

/* ── the three actions ──────────────────────────────────────────────────────*/

function artMap(award) {
  const ref = award.design && award.design.centre && award.design.centre.imageRef;
  return ref && award.artUrl ? { [ref]: award.artUrl } : {};
}

/** True when this browser's share sheet takes a file, probed before any picture is drawn. */
function shareSheetTakesFiles() {
  if (typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([new Uint8Array(1)], 'probe.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

/**
 * Share the badge, or hand over its verify link. The PNG carries the strip
 * (C11.1); the link leads to the page that carries the disclosure (C11.6).
 * Returns the one line the status slot shows.
 */
async function shareAward(award, prov) {
  if (shareSheetTakesFiles()) {
    const blob = await exportPng(award.design, prov, { scale: 2 });
    const how = await sharePng(blob, award.name);
    if (how === 'shared') return 'Shared.';
    if (how === 'dismissed') return 'Share closed. Nothing was sent.';
  }
  const copied = await copyText(award.verifyUrl);
  return copied
    ? 'No share sheet in this browser, so the verify link is on your clipboard. Paste it anywhere.'
    : `This browser could not copy it. The verify link is ${award.verifyUrl}`;
}

/**
 * Pin the award to the showcase. `profiles:setShowcase` takes the whole list,
 * so the current one is read first. Returns `{ pinned, message }`.
 */
async function pinAward(publicId) {
  const me = await q.me();
  const list = [...((me && me.showcase) || [])];
  if (list.includes(publicId)) return { pinned: true, message: 'Already in your showcase.' };
  if (list.length >= SHOWCASE_MAX) {
    return { pinned: false, message: `Your showcase holds ${SHOWCASE_MAX} badges. Unpin one on your wallet first.` };
  }
  list.push(publicId);
  const out = await m.setShowcase(list);
  return out && out.ok
    ? { pinned: true, message: 'Pinned. It leads your public profile now.' }
    : { pinned: false, message: (out && out.message) || 'The showcase did not save. Try again.' };
}

/* ── the section claim.html swaps in ───────────────────────────────────────*/

function actionButton(label) {
  const button = el('button', 'btn', label);
  button.type = 'button';
  return button;
}

function linkRow(href, text) {
  const p = el('p', 'pc-reveal-links');
  const a = el('a', null, text);
  a.href = href;
  p.appendChild(a);
  return p;
}

/**
 * The reveal for an award just claimed: a C2.6 PublicAward with a design.
 * Returns a detached section; the caller puts it where the offer was.
 */
export function claimReveal(award) {
  const section = el('section', 'pc-reveal-layout');
  section.setAttribute('aria-labelledby', 'revealTitle');

  const frame = el('div', 'pc-reveal-frame');
  frame.dataset.kind = award.kind;
  const prov = provenanceOf(award);
  setArtUrls(artMap(award));
  frame.appendChild(renderSvg(award.design, prov));
  section.appendChild(frame);

  const body = el('div', 'pg-section');
  const title = el('h2', 'pg-title', award.name || 'Your badge');
  title.id = 'revealTitle';
  body.appendChild(title);
  body.appendChild(el('p', 'pg-lead', 'Claimed. It is in your wallet now.'));
  const nth = nthLine(award.count, award.name);
  if (nth) body.appendChild(el('p', 'pc-reveal-count', nth));
  body.appendChild(el('p', 'pg-note', award.expiresAt
    ? `Valid until ${formatDate(award.expiresAt)}.`
    : 'It does not expire.'));

  // Shown once the strip has settled: the reveal ends on the disclosure, and
  // only then does the page offer to send the picture anywhere.
  const row = el('div', 'pg-actions pc-reveal-actions');
  row.id = 'revealActions';
  row.hidden = true;
  const pin = actionButton('Pin to showcase');
  const share = actionButton('Share');
  const download = actionButton('Download');
  row.append(pin, share, download);
  body.appendChild(row);

  const status = el('p', 'pg-note pc-reveal-status');
  status.id = 'revealStatus';
  status.setAttribute('aria-live', 'polite');
  body.appendChild(status);

  body.appendChild(linkRow(`badge.html?id=${encodeURIComponent(award.publicId)}`, 'See the badge'));
  body.appendChild(linkRow('index.html', 'Open your wallet'));
  section.appendChild(body);

  // Loud on failure, and the button comes back: the export throws when it
  // cannot inline a font or the mark, and a picture in the wrong typeface is
  // the failure the pipeline exists to prevent (C6.2).
  const guard = async (button, work, failure) => {
    button.disabled = true;
    try {
      status.textContent = await work();
    } catch (err) {
      console.error('Sash: the action on the claimed badge failed', err);
      status.textContent = `${failure}: ${err.message}`;
      button.disabled = false;
      return;
    }
    if (button !== pin || !button.dataset.pinned) button.disabled = false;
  };

  pin.addEventListener('click', () => guard(pin, async () => {
    const out = await pinAward(award.publicId);
    if (out.pinned) {
      pin.textContent = 'Pinned';
      pin.dataset.pinned = 'yes';
    }
    return out.message;
  }, 'The showcase did not save. Sign in again and press Pin once more'));

  share.addEventListener('click', () => guard(share, () => shareAward(award, prov),
    'The picture could not be drawn'));

  download.addEventListener('click', () => guard(download, async () => {
    triggerDownload(await exportPng(award.design, prov, { scale: 2 }), `${slugify(award.name)}.png`);
    return 'The PNG is in your downloads.';
  }, 'The picture could not be drawn'));

  void reveal(frame).then(() => { row.hidden = false; });
  return section;
}

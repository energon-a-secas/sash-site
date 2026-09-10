/**
 * Framed pages. CONTRACTS.md C15 A36, which replaced C5.3.
 *
 * C5.3 froze a frame buster, `window.top.location = window.self.location`.
 * Measured from a real cross-origin host it is refused for want of user
 * activation in Chromium, Firefox and WebKit alike: it throws a TypeError into
 * the framed document and the page stays framed. It refused nothing, and it
 * logged an error while failing.
 *
 * The constraint behind that is not fixable here. `frame-ancestors` is the
 * directive that prevents framing, it is ignored in a <meta> CSP by
 * specification, and GitHub Pages cannot set a response header. Framing cannot
 * be prevented on this host, so it is handled rather than pretended away.
 *
 * Three pieces, one per layer:
 *
 *   1. the inline guard in every non-embed <head> sets `data-framed` on <html>
 *      before anything paints. It attempts no navigation, so nothing throws.
 *   2. css/frame.css takes the page out of view and leaves this notice.
 *   3. the page's own entry module imports `framed` and returns before it
 *      mounts anything, so no sign-in loads and no write control is wired.
 *
 * The way out is a link the reader clicks: a click carries the user activation
 * the browser asked for, and `target="_top"` is what replaces the framing page.
 * Nothing in this module navigates on its own.
 *
 * embed.html loads none of this. Being framed is its whole purpose.
 */

export const framed = window.top !== window.self;

const LEAD = 'This page is open inside a frame on another site. '
  + 'It does not sign anyone in and it writes nothing while it is framed.';

/**
 * The one `el` C15 A53 did not fold into js/utils.js, on purpose.
 *
 * Three pages load this file as their only module: sash `404.html`,
 * `policy.html` and enamel `404.html`. An import of `./utils.js` would pull the
 * DOM kit and the certificate layout engine behind it onto a 404 page, to draw
 * four elements. And A53 records this file as the next thing that wants a
 * canonical source, since it is byte-identical in both sites with no `--check`;
 * a module that is going to move into `packages/neorgon-ui/` cannot depend on a
 * site's `./utils.js`. Keeping this here is what keeps that move a copy.
 *
 * A59: the two bodies also differ, so it is a copy of the idea and not of the
 * code. This one tests `if (text)` where sash's `js/utils.js` tests undefined,
 * null and empty string and then coerces, so `el('span', 'c', 0)` renders "0"
 * there and nothing here; every call in this file passes a string literal, so
 * nothing depends on the difference today, and a fold into
 * `packages/neorgon-ui/` should take that body rather than this one.
 *
 * The other five copies are gone: badge.js, claim.js, embed.js, import.js and
 * send.js import `el` from js/utils.js now.
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * The interstitial.
 *
 * The heading is `document.title`, which is how the notice names the page it
 * stands in for. Page code never runs while framed, so the title is still the
 * one the HTML shipped.
 *
 * The link carries the whole address, query and all. The line under it stops at
 * the path: some of these addresses carry a bearer token (C4.3), and there is
 * no reason to paint one on screen just to say which page this is.
 */
function notice() {
  const wrap = el('div', 'frame-notice');
  const card = el('div', 'frame-notice-card');

  card.appendChild(el('h1', null, document.title || 'This page'));
  card.appendChild(el('p', null, LEAD));

  const out = el('a', 'frame-notice-link', 'Open this page directly');
  out.href = location.href;
  out.target = '_top';
  card.appendChild(out);

  card.appendChild(el('p', 'frame-notice-host', location.host + location.pathname));

  wrap.appendChild(card);
  return wrap;
}

function mount() {
  document.body.appendChild(notice());
}

if (framed) {
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
}

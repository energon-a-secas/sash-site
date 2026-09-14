/**
 * embed.html: the iframe widget. CONTRACTS.md C5.
 *
 * What this page is, and what it is not:
 *
 *   It loads no Clerk and calls no authenticated function. A third-party
 *   document must not get a Clerk instance from us (C5.2).
 *
 *   It is stateless. Nothing here reads localStorage, sessionStorage or a
 *   cookie, so a Sash widget on somebody else's page cannot render the
 *   visitor's own wallet. All configuration is in the URL.
 *
 *   It has no postMessage vocabulary, on purpose (C5.2). Nothing needs an
 *   answer back from a badge wall, and shipping a protocol nobody consumes is
 *   the failure this repository already recorded once.
 *
 *   It never renders empty. Four states, four visible cards (C5.4), and every
 *   one of them carries the attribution line, because that link is the only
 *   way out of the frame (C5.2) and a card with no name on it is a dark box.
 *
 *   Framed, it fits its frame. The host decides the height and the width, and
 *   a badge grid reflows with the width, so no fixed height can hold twelve
 *   cards at every column: at 420px the frozen snippet showed one row and put
 *   the attribution under an inner scrollbar (EMB-01). So the frame shows the
 *   whole cards that fit above the attribution, says how many it left out,
 *   and never grows a scrollbar. Opened directly, which is how a person
 *   previews their own wall, nothing is trimmed and the page scrolls like any
 *   page.
 *
 * The framed-page guard on every other page (C15 A36) is absent from
 * embed.html by design, and so are css/frame.css and js/frame.js.
 */
import { convex, api } from './convex.js';
import { HANDLE_RE, WALLET_GROUPS } from './insignia/schema.js';
import { renderAwardGrid } from './insignia/wallet.js';
import { ensureFonts } from './insignia/render.js';
import { escHtml, debounce } from './neorgon-dom.js';
import { el, plural } from './utils.js';

const SITE = 'https://sash.neorgon.com/';
const PROFILE_BASE = `${SITE}u.html?h=`;

/**
 * The height the C5.1 snippet asks for. Two rows of default-size cards plus
 * the attribution measure 613px in a 1000px column and 619px in a 360px one
 * (chromium, 2026-09-14), so 640 holds two rows at any width a page is likely
 * to give the widget; the fit below handles whatever the host chooses instead.
 */
const SNIPPET_HEIGHT = 640;

// The same check the framed-page guard makes on every other page, with the
// opposite reaction: framed is the normal state of this page.
const FRAMED = window.top !== window.self;

const wrap = document.getElementById('wrap');

/**
 * An integer inside a range, or the default.
 *
 * Strictly digits, then strictly inside the range: 12.7, 0, -3, 1e3, "twelve"
 * and 900 all fall back rather than being coerced into something adjacent.
 * That is `projects/quiz-site/js/embed.js:31-33`'s rule, restated by C5.1 as
 * "discarded, never rounded", and it applies to the bounds as well as to the
 * shape. Rounding a caller's 900 down to 60 answers a question nobody asked.
 */
function intParam(raw, { min, max, fallback }) {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const n = Number(raw);
  return n >= min && n <= max ? n : fallback;
}

/* ── the four cards that stand in for an empty frame (C5.4) ─────────────────*/

function textCard(text) {
  const box = el('div', 'em-card');
  box.appendChild(document.createTextNode(text));
  return box;
}

function nameCard(displayName, tail) {
  const box = el('div', 'em-card');
  box.appendChild(el('strong', null, displayName));
  box.appendChild(document.createTextNode(` ${tail}`));
  return box;
}

/* ── attribution, and the snippet (C5.1, C5.2) ──────────────────────────────*/

/**
 * The one line every state of this page ends with.
 *
 * With a handle it links the profile (C5.2). Without one, which is the
 * "add a handle" card, there is no profile to link, so it links the site:
 * the reader of the host page still learns whose widget this is and where it
 * lives. `hidden` is how many loaded cards the fit left out of the frame.
 */
function attribution(handle, displayName, hidden = 0) {
  const foot = el('div', 'em-foot');
  foot.appendChild(el('span', null, 'Parody badges. Not accredited by anyone.'));
  const right = el('span', 'em-foot-link');
  if (hidden > 0) right.appendChild(el('span', 'em-more', `+${hidden} more`));
  const a = el('a', null, handle ? `${displayName || handle} on Sash` : 'Sash');
  a.href = handle ? PROFILE_BASE + encodeURIComponent(handle) : SITE;
  a.rel = 'noopener';                 // <base target="_blank"> covers the target
  right.appendChild(a);
  foot.appendChild(right);
  return foot;
}

function snippetFor(cfg, displayName) {
  // The C5.1 literal, with this frame's own group and limit substituted so the
  // code a person copies is the wall they are looking at. Every other
  // attribute is byte-identical to the frozen template. The name is escaped
  // because it lands in an attribute of somebody else's markup: a display name
  // may carry a quote (the backend caps its length and nothing else), and a
  // raw quote closes the title early and spills the rest into the host page.
  return '<iframe src="https://sash.neorgon.com/embed.html'
    + `?h=${cfg.handle}&group=${cfg.group}&limit=${cfg.limit}"\n`
    + `        title="${escHtml(displayName || cfg.handle)} on Sash" width="100%" height="${SNIPPET_HEIGHT}"\n`
    + '        style="border:0" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>';
}

/**
 * The copy control, and only when this page is not framed.
 *
 * Inside somebody's article a "copy the code" panel is noise nobody asked for.
 * Opened directly, which is how a person previews their own wall before
 * pasting it anywhere, it is the whole reason they opened it.
 */
function snippetPanel(cfg, displayName) {
  if (FRAMED) return null;

  const panel = el('section', 'em-snippet');
  panel.appendChild(el('h2', null, 'Paste this into your page'));
  const text = snippetFor(cfg, displayName);
  panel.appendChild(el('code', null, text));

  const button = el('button', null, 'Copy the snippet');
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Copy blocked, select it by hand';
    }
    setTimeout(() => { button.textContent = 'Copy the snippet'; }, 1800);
  });
  panel.appendChild(button);
  return panel;
}

/* ── fitting the frame ──────────────────────────────────────────────────────*/

/** True while the document is taller than the frame, i.e. would scroll. */
function overflows() {
  return document.documentElement.scrollHeight > window.innerHeight + 0.5;
}

/**
 * Draws the wall into the frame and trims it to what fits.
 *
 * Whole cards only: the last card is removed until the attribution line sits
 * inside the frame, so the reader sees complete rows (a short last row is a
 * grid's ordinary last row) and never a card cut in half. If the frame is too
 * short for even one card, the grid gives way to a count, which still fits
 * and still links out. Each removal is one reflow and the list is at most 60
 * long, so the loop is cheap; nothing is re-rendered inside it.
 *
 * Unframed there is no frame to fit, so everything loaded is shown and the
 * page scrolls.
 */
function paintWall(cfg, name, awards) {
  const grid = renderAwardGrid(awards, { size: cfg.size, linkToVerify: true, showDates: true });
  let foot = attribution(cfg.handle, name, 0);
  wrap.replaceChildren(grid, foot);
  if (!FRAMED) return;

  const cards = grid.querySelectorAll('.ins-card');
  let shown = cards.length;
  while (shown > 0 && overflows()) {
    shown -= 1;
    cards[shown].remove();
    foot.replaceWith(foot = attribution(cfg.handle, name, awards.length - shown));
  }
  if (shown === 0) {
    grid.replaceWith(nameCard(name, `has ${plural(awards.length, 'badge', 'badges')} on Sash.`));
  }
}

/* ── the page ───────────────────────────────────────────────────────────────*/

function readConfig(search = location.search) {
  const p = new URLSearchParams(search);
  const raw = (p.get('h') || '').trim().toLowerCase();
  const group = p.get('group');
  return {
    handle: HANDLE_RE.test(raw) ? raw : null,
    group: WALLET_GROUPS.includes(group) ? group : 'all',
    limit: intParam(p.get('limit'), { min: 1, max: 60, fallback: 12 }),
    size: intParam(p.get('size'), { min: 96, max: 320, fallback: 140 }),
  };
}

/** A C5.4 card, and the attribution under it. */
function failWith(text, handle) {
  wrap.replaceChildren(textCard(text), attribution(handle, null));
}

async function main() {
  const cfg = readConfig();

  if (!cfg.handle) {
    failWith('Add a handle to the embed URL.', null);
    return;
  }

  let profile = null;
  let awards = [];
  try {
    profile = await convex.query(api.profiles.byHandle, { handle: cfg.handle });
    // byHandle answers null for a profile that does not exist and for a
    // private one alike, which is the point: a private profile must not be
    // distinguishable from an absent one from outside.
    if (profile) {
      awards = await convex.query(api.awards.forHandle, {
        handle: cfg.handle, group: cfg.group, limit: cfg.limit,
      });
    }
  } catch (err) {
    console.error('Sash: the embed could not read this wall', err);
    failWith('Sash could not load this wall.', cfg.handle);
    return;
  }

  if (!profile) {
    failWith('This Sash profile is not public.', cfg.handle);
    return;
  }

  const name = profile.displayName || cfg.handle;

  if (!Array.isArray(awards) || !awards.length) {
    wrap.replaceChildren(
      nameCard(name, cfg.group === 'all' ? 'has no badges yet.' : 'has no badges in this group yet.'),
      attribution(cfg.handle, name),
    );
    return;
  }

  ensureFonts();
  paintWall(cfg, name, awards);

  const panel = snippetPanel(cfg, name);
  if (panel) wrap.appendChild(panel);

  if (FRAMED) {
    // The host's column can change width, which changes how many cards make a
    // row; and the web fonts land after the first paint and move the text
    // lines by a pixel or two. Both are a fresh fit from the full list.
    window.addEventListener('resize', debounce(() => paintWall(cfg, name, awards), 150));
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => paintWall(cfg, name, awards)).catch(() => {});
    }
  }
}

main();

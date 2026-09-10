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
 *   It never renders empty. Four states, four visible cards (C5.4).
 *
 * The framed-page guard on every other page (C15 A36) is absent from
 * embed.html by design, and so are css/frame.css and js/frame.js.
 */
import { convex, api } from './convex.js';
import { HANDLE_RE, WALLET_GROUPS } from './insignia/schema.js';
import { renderAwardGrid } from './insignia/wallet.js';
import { ensureFonts } from './insignia/render.js';
import { el } from './utils.js';

const PROFILE_BASE = 'https://sash.neorgon.com/u.html?h=';

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

function stateCard(node) {
  const box = el('div', 'em-card');
  box.appendChild(node);
  return box;
}

function textCard(text) {
  return stateCard(document.createTextNode(text));
}

function nameCard(displayName, tail) {
  const box = el('div', 'em-card');
  box.appendChild(el('strong', null, displayName));
  box.appendChild(document.createTextNode(` ${tail}`));
  return box;
}

/* ── attribution, and the snippet (C5.1, C5.2) ──────────────────────────────*/

function attribution(handle, displayName) {
  const foot = el('div', 'em-foot');
  foot.appendChild(el('span', null, 'Parody badges. Not accredited by anyone.'));
  const a = el('a', null, `${displayName || handle} on Sash`);
  a.href = PROFILE_BASE + encodeURIComponent(handle);
  a.rel = 'noopener';                 // <base target="_blank"> covers the target
  foot.appendChild(a);
  return foot;
}

function snippetFor(cfg, displayName) {
  // The C5.1 literal, with this frame's own group and limit substituted so the
  // code a person copies is the wall they are looking at. Every other
  // attribute is byte-identical to the frozen template.
  return '<iframe src="https://sash.neorgon.com/embed.html'
    + `?h=${cfg.handle}&group=${cfg.group}&limit=${cfg.limit}"\n`
    + `        title="${displayName || cfg.handle} on Sash" width="100%" height="420"\n`
    + '        style="border:0" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>';
}

/**
 * The copy control, and only when this page is not framed.
 *
 * Inside somebody's article a "copy the code" panel is noise nobody asked for.
 * Opened directly, which is how a person previews their own wall before
 * pasting it anywhere, it is the whole reason they opened it. This reads
 * window.top, which is the same check the framed-page guard makes on every
 * other page and the opposite reaction to it.
 */
function snippetPanel(cfg, displayName) {
  if (window.top !== window.self) return null;

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

async function main() {
  const cfg = readConfig();

  if (!cfg.handle) {
    wrap.replaceChildren(textCard('Add a handle to the embed URL.'));
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
    wrap.replaceChildren(textCard('Sash could not load this wall.'));
    return;
  }

  if (!profile) {
    wrap.replaceChildren(textCard('This Sash profile is not public.'));
    return;
  }

  const name = profile.displayName || cfg.handle;
  const parts = [];

  if (!Array.isArray(awards) || !awards.length) {
    parts.push(nameCard(name, cfg.group === 'all'
      ? 'has no badges yet.'
      : `has no badges in this group yet.`));
  } else {
    ensureFonts();
    parts.push(renderAwardGrid(awards, { size: cfg.size, linkToVerify: true, showDates: true }));
  }

  parts.push(attribution(cfg.handle, name));

  const panel = snippetPanel(cfg, name);
  if (panel) parts.push(panel);

  wrap.replaceChildren(...parts);
}

main();

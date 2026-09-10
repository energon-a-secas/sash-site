// ── DOM rendering ────────────────────────────────────────────
// Everything both pages draw. The award art itself is never drawn here: the
// kit's renderAwardGrid is the one drawing path (C1.4), shared with the embed
// and the verify page, and this module only decides which awards go in which
// section and what controls sit under a card.

import { renderAwardGrid } from './insignia/wallet.js';
import { codeToSpec, seededSpec, spriteDataUrl } from './neorgon-avatar.js';
import { el, show, walletGroup, GROUP_LABELS, plural } from './utils.js';

/* ── the pixel avatar ───────────────────────────────────────── */

/**
 * The visitor's character, from the fleet avatar kit.
 *
 * `avatarCode` null means the person has not chosen one. The kit's own answer
 * for that case is `seededSpec(name)`, a deterministic look drawn from common
 * parts so every Neorgon site shows the same stand-in for the same handle. It
 * is a placeholder and the profile form says so, rather than reading as a
 * choice nobody made.
 */
export function avatarNode(avatarCode, handle, px = 64) {
  const spec = (avatarCode && codeToSpec(avatarCode)) || seededSpec(handle || 'sash');
  const img = el('img', 'px-avatar');
  img.src = spriteDataUrl(spec, 1);
  img.width = px;
  img.height = px;
  img.draggable = false;
  img.alt = '';
  img.style.imageRendering = 'pixelated';
  return img;
}

export const hasAvatar = (code) => !!(code && codeToSpec(code));

/* ── counts ─────────────────────────────────────────────────── */

const COUNT_ORDER = ['neorgon', 'community', 'recognition', 'imported'];

/** The four counts as a list. A zero is drawn, because absent and zero differ. */
export function renderCounts(node, counts) {
  if (!node) return;
  node.replaceChildren();
  for (const key of COUNT_ORDER) {
    const item = el('li', 'sash-count-item');
    item.appendChild(el('strong', null, String(counts[key] ?? 0)));
    item.appendChild(el('span', null, GROUP_LABELS[key]));
    node.appendChild(item);
  }
}

/** The same four counts, from a list of awards, for the signed-in wallet. */
export function countsOf(awards) {
  const counts = { neorgon: 0, community: 0, recognition: 0, imported: 0 };
  for (const award of awards) {
    if (award.hidden || award.status === 'revoked') continue;
    counts[walletGroup(award)] += 1;
  }
  return counts;
}

/* ── sections ───────────────────────────────────────────────── */

const SECTIONS = [
  { key: 'neorgon',     title: 'Neorgon badges',      lead: 'Granted by the site itself for something you did here.' },
  { key: 'community',   title: 'Community badges',    lead: 'Issued by a person, grouped by what the badge is for.' },
  { key: 'recognition', title: 'Recognition',         lead: 'Sent by other people. A repeat send stacks on the badge already held.' },
  { key: 'imported',    title: 'Imported credentials', lead: 'Held elsewhere and listed here as it was sent, never redrawn by Sash.' },
];

const CATEGORY_LABELS = {
  kt: 'Knowledge sharing',
  course: 'Courses',
  challenge: 'Challenges',
  fun: 'Fun',
  meme: 'Memes',
  recognition: 'Recognition',
};

/**
 * One grid, with an optional control row under each card.
 *
 * `renderAwardGrid` with no grouping emits one card per award in the order it
 * was handed them, so index maps to award. That is checked rather than
 * assumed: a mismatch drops the controls instead of putting a Hide button on
 * somebody else's badge.
 */
function gridOf(list, cardOpts, controls) {
  const wrap = renderAwardGrid(list, { ...cardOpts, groupBy: 'none' });
  if (!controls) return wrap;
  const cards = wrap.querySelectorAll('.ins-card');
  if (cards.length !== list.length) {
    console.error('Sash: the grid returned %d cards for %d awards; controls skipped.',
      cards.length, list.length);
    return wrap;
  }
  list.forEach((award, i) => {
    const row = controls(award);
    if (row) cards[i].appendChild(row);
  });
  return wrap;
}

function emptyNote(text) {
  return el('p', 'sash-hint sash-empty', text);
}

/**
 * The wall: the four wallet groups (C7.22), community split by category.
 *
 * `opts.filter` is the chip selection. `opts.controls` is a function from an
 * award to a control row, present only on the signed-in wallet.
 */
export function renderSections(node, awards, opts = {}) {
  const { filter = 'all', controls = null, size = 180, emptyText = 'Nothing here yet.' } = opts;
  node.replaceChildren();

  const visible = awards.filter((a) => filter === 'all' || walletGroup(a) === filter);
  if (!visible.length) {
    node.appendChild(emptyNote(emptyText));
    return;
  }

  for (const section of SECTIONS) {
    const list = visible.filter((a) => walletGroup(a) === section.key);
    if (!list.length) continue;

    const wrap = el('section', 'sash-group');
    const head = el('div', 'sash-group-head');
    head.appendChild(el('h3', 'sash-group-title', section.title));
    head.appendChild(el('span', 'sash-group-count', plural(list.length, 'badge', 'badges')));
    wrap.appendChild(head);
    wrap.appendChild(el('p', 'sash-hint', section.lead));

    if (section.key === 'community') {
      // C7.3's categories, in the contract's own order, so two profiles read
      // the same way. A template whose category did not survive lands last.
      const buckets = new Map();
      for (const award of list) {
        const key = award.category || 'other';
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(award);
      }
      const order = [...Object.keys(CATEGORY_LABELS), 'other'].filter((k) => buckets.has(k));
      for (const key of order) {
        const sub = el('div', 'sash-subgroup');
        sub.appendChild(el('h4', 'sash-subgroup-title', CATEGORY_LABELS[key] || 'Other'));
        sub.appendChild(gridOf(buckets.get(key), { size }, controls));
        wrap.appendChild(sub);
      }
    } else {
      if (section.key === 'recognition') {
        const stacked = list.reduce((sum, a) => sum + (a.count || 1), 0);
        if (stacked > list.length) {
          wrap.appendChild(el('p', 'sash-hint', `${plural(stacked, 'send', 'sends')} across ${plural(list.length, 'badge', 'badges')}.`));
        }
      }
      wrap.appendChild(gridOf(list, { size }, controls));
    }

    node.appendChild(wrap);
  }
}

/* ── the showcase strip (the wallet and the public profile) ── */

/**
 * The awards a showcase names, in the showcase's own order.
 *
 * `showcase` is an ordered list of award public ids. An id that no longer
 * resolves to an award is skipped rather than drawn as a hole: hiding a badge
 * or having one revoked leaves its id in the stored list.
 *
 * The wallet and the public profile both order by this, so the rule is written
 * once. Until A39 only the wallet had the list at all, which made pinning a
 * private bookmark rather than the feature.
 */
export function resolveShowcase(showcase, awards) {
  if (!Array.isArray(showcase) || !showcase.length) return [];
  const byId = new Map(awards.map((a) => [a.publicId, a]));
  return showcase.map((id) => byId.get(id)).filter(Boolean);
}

/**
 * The pinned awards, in the stored order, each with move and unpin controls.
 */
export function renderShowcase(node, showcase, awards, controls) {
  if (!node) return;
  node.replaceChildren();

  const pinned = resolveShowcase(showcase, awards);

  if (!pinned.length) {
    node.appendChild(emptyNote('Nothing pinned yet. Use Pin on any badge below to put it here.'));
    return;
  }
  // The controls need to know where in the order they sit, so the ends can say
  // there is nowhere further to go rather than offering a click that does
  // nothing.
  const withPlace = controls
    ? (award) => controls(award, pinned.indexOf(award), pinned.length)
    : null;
  node.appendChild(gridOf(pinned, { size: 160 }, withPlace));
}

/* ── small shared bits ──────────────────────────────────────── */

/** Live character counter next to a capped field. */
export function bindCounter(input, counter) {
  if (!input || !counter) return;
  const paint = () => {
    counter.textContent = `${input.value.length} / ${input.maxLength}`;
    counter.classList.toggle('is-full', input.value.length >= input.maxLength);
  };
  input.addEventListener('input', paint);
  paint();
}

/** Swap the on state across a chip row. */
export function setChip(row, group) {
  if (!row) return;
  for (const chip of row.querySelectorAll('.sash-chip')) {
    chip.classList.toggle('is-on', chip.dataset.group === group);
    chip.setAttribute('aria-pressed', chip.dataset.group === group ? 'true' : 'false');
  }
}

export { show };

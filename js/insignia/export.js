/**
 * Insignia Kit: the exporter (C6).
 *
 * Modelled on `projects/character-sheet-site/js/card/export.js`: the image
 * inlining, the `setTransform` raster, the deferred `revokeObjectURL`, the
 * clipboard and share paths, and the print root. Two things from that file are
 * deliberately absent: it fetches a stylesheet and wraps the card in a
 * `<foreignObject>` because its card is DOM. Ours is not, so there is no CSS to
 * fetch and no `foreignObject`, which is where Safari's worst SVG bugs live.
 * The print path additionally takes `await fontsReady()` and the double
 * `requestAnimationFrame` from `projects/resume-forge-site/js/export.js`.
 *
 * The failure this file exists to prevent is silent. An SVG inside an `<img>`
 * runs in the SVG Integration spec's secure static mode, where every external
 * reference is treated as a network error with no `onerror` and no console
 * warning: `font-family` resolves to a system fallback and an `<image href>`
 * draws nothing. So every font and every image is inlined as a data URI before
 * serialisation, and anything that cannot be inlined throws. A badge exported in
 * the wrong typeface reports success, which is worse than an export that fails.
 *
 * One narrowing of that rule, H1 (2026-09-14). A character the family does not
 * list (emoji, Arabic and CJK on all six roles) is never requested: Google
 * answers 400, with no CORS header, to a subset made only of such characters,
 * and the on-screen preview already draws them in the generic fallback of the
 * role's stack because the linked stylesheet declares the same ranges. The
 * export matches the screen there. It still throws for anything the family
 * lists and cannot deliver, and the error names the field and the family.
 */
import { renderSvg, usedFonts, textRuns, normalizeDesign, ensureFonts } from './render.js';
import { FONT_FAMILIES } from './schema.js';
import { buildProfileSvg } from './wallet.js';

/* ── what each family can draw (H1) ────────────────────────────────────────── */

// Google's own `unicode-range` per subset, as its css2 reply declares them.
// Fetched 2026-09-14 for each C7.14 family with a Chrome User-Agent. The ranges
// are identical across families; only the subset list per family differs.
//
// Measured the same day, from the same reply: the font file behind a `&text=`
// request answers 200 when at least one requested character sits in a listed
// range (`WIN` plus a trophy, Cyrillic on Playfair Display) and 400 when none
// does (three trophies, an Arabic word, two CJK characters on Playfair Display;
// Cyrillic on Poppins, which lists no Cyrillic). Two characters inside a listed
// range still answered 400 (U+A7FF, U+FFFD): the range is a block, not a glyph
// list, so that residue stays a loud failure and is named as such below.
const SUBSET_RANGES = {
  latin: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  'latin-ext': 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
  cyrillic: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116',
  'cyrillic-ext': 'U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F',
  greek: 'U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF',
  'greek-ext': 'U+1F00-1FFF',
  vietnamese: 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB',
  devanagari: 'U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B09',
};

// The subsets each C7.14 family lists, in Google's reply of 2026-09-14. A family
// absent here counts as covering everything, which is the behaviour before H1:
// a new family is measured and added, never silently narrowed to Latin.
export const FAMILY_SUBSETS = {
  'Playfair Display': ['latin', 'latin-ext', 'cyrillic', 'vietnamese'],
  'Roboto Slab': ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'greek', 'greek-ext', 'vietnamese'],
  Poppins: ['latin', 'latin-ext', 'devanagari'],
  'JetBrains Mono': ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'greek', 'vietnamese'],
  'Great Vibes': ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'greek-ext', 'vietnamese'],
  Nunito: ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'vietnamese'],
};

const parseRanges = (spec) => spec.split(',').map((r) => {
  const [lo, hi] = r.trim().replace(/^U\+/, '').split('-');
  return [parseInt(lo, 16), parseInt(hi || lo, 16)];
});
const RANGES = Object.fromEntries(Object.entries(SUBSET_RANGES).map(([k, v]) => [k, parseRanges(v)]));

/** True when `ch` is inside a subset Google lists for `family`. */
export function familyCovers(family, ch) {
  const subsets = FAMILY_SUBSETS[family];
  if (!subsets) return true;
  const cp = String(ch).codePointAt(0);
  return subsets.some((s) => RANGES[s].some(([lo, hi]) => cp >= lo && cp <= hi));
}

/** A face's characters split into what its family lists and what falls back, each as a `subsetChars` string. */
export function partitionChars(family, text) {
  const covered = [];
  const fallback = [];
  for (const ch of String(text)) (familyCovers(family, ch) ? covered : fallback).push(ch);
  return { covered: subsetChars(covered.join('')), fallback: subsetChars(fallback.join('')) };
}

// Field paths as `usedFonts` reports them, worded for the person who typed there.
const FIELD_LABELS = {
  'arcs.top': 'top arc words', 'arcs.bottom': 'bottom arc words', ribbon: 'ribbon words', mark: 'edition mark',
  provenance: 'provenance strip', serial: 'serial', 'text.eyebrow': 'eyebrow line', 'text.title': 'title',
  'text.holderLabel': 'holder label', 'text.holder': 'holder name', 'text.body': 'body text',
  'text.issuerLine': 'issuer line', 'text.dateLabel': 'date line', 'profile.displayName': 'profile name',
  'profile.handle': 'handle', 'profile.headline': 'headline', 'award.name': 'award name',
  'import.line': 'imported credential line', 'poster.footer': 'poster footer',
  // Round 2: the security print (security.js) and the resolved signatures.
  'frame.microtext': 'microtext border', 'background.latent': 'latent word', stamp: 'issue stamp',
};

/**
 * `seal.arcs.top` reads as "seal top arc words", `signatures[1].name` as
 * "signature 2 name", and `signatures[0].from` (the handle a signature resolves
 * to, and the line beneath it) as "signature 1 handle".
 */
export function fieldLabel(field) {
  const f = String(field);
  if (f.startsWith('seal.')) return `seal ${fieldLabel(f.slice(5))}`;
  const sig = f.match(/^signatures\[(\d+)\]\.(name|role|from)$/);
  if (sig) return `signature ${Number(sig[1]) + 1} ${sig[2] === 'from' ? 'handle' : sig[2]}`;
  return FIELD_LABELS[f] || f;
}

/**
 * Every field whose characters the role's family does not list, so a page can
 * warn the author before the export, where those characters draw in the
 * generic fallback exactly as they do in the preview. Empty when every glyph is
 * covered. Each entry: `{ field, label, family, chars }`.
 */
export function fallbackRuns(design, provenance) {
  return textRuns(design, provenance).map((run) => {
    const f = FONT_FAMILIES[run.role] || FONT_FAMILIES.sans;
    const { fallback } = partitionChars(f.family, run.text);
    return fallback ? { field: run.field, label: fieldLabel(run.field), family: f.family, chars: fallback } : null;
  }).filter(Boolean);
}

/* ── fonts (C6.3) ──────────────────────────────────────────────────────────── */

const FONT_CACHE = new Map();

/** The exact character set to request: sorted, de-duplicated, spaces included. */
export function subsetChars(text) {
  return [...new Set(String(text))].sort().join('');
}

/**
 * The face URL in a Google Fonts reply, matched on the `format(...)` that
 * follows it rather than on a file extension.
 *
 * An extension-anchored regex matches nothing: with `&text=` Google returns
 * `.../l/font?kit=...&skey=...&v=v37` with no extension at all, and the export
 * would then go on to report success in a system font.
 *
 * **woff is accepted as well as woff2, and this departs from C6.3's frozen
 * regex.** Measured on 2026-09-09 in Playwright 1.62.1, fetching from inside
 * the page, which is where this code runs and where Google keys the reply off
 * the browser's own User-Agent (a fetch cannot override it: it is a forbidden
 * header). For a **variable** family, WebKit and Firefox are served
 * `format('woff')`:
 *
 *   family            WebKit  Firefox  Chromium
 *   Playfair Display  woff    woff     woff2
 *   Roboto Slab       woff    woff     woff2
 *   JetBrains Mono    woff    woff     woff2
 *   Nunito            woff    woff     woff2
 *   Poppins           woff2   woff2    woff2
 *   Great Vibes       woff2   woff2    woff2
 *
 * Four of the six roles in C7.14 are variable families, and the mono role draws
 * the provenance strip on every badge, so a woff2-only match makes every export
 * throw in two of three engines. The rule C6.3 exists to enforce is unchanged:
 * a real subset of the requested family is inlined or the export fails loudly.
 * woff is inlined identically, is supported everywhere, and costs roughly 30 per
 * cent more bytes. **C6.3 needs amending to say so; `delivery-lead` decides.**
 */
export function pickFace(css) {
  const found = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)\s*format\('(woff2|woff)'\)/g)]
    .map((m) => ({ url: m[1], format: m[2] }));
  return found.find((f) => f.format === 'woff2') || found[0] || null;
}

/**
 * One `@font-face` rule for one family, one weight and exactly the characters
 * the design draws, with the woff2 inlined as a data URI.
 *
 * Throws when the fetch fails or the reply carries no woff2. It never returns
 * an empty string: a silent miss is a system-font export that claims success.
 */
export async function inlineGoogleFont({ family, weight = 400, italic = false, text }) {
  const chars = subsetChars(text);
  const key = `${family}|${weight}|${italic}|${chars}`;
  if (FONT_CACHE.has(key)) return FONT_CACHE.get(key);

  const load = (async () => {
    const axis = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;
    const url = 'https://fonts.googleapis.com/css2'
      + `?family=${encodeURIComponent(family).replace(/%20/g, '+')}:${axis}`
      + `&text=${encodeURIComponent(chars)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google Fonts replied ${res.status} for ${family}`);
    const css = await res.text();
    const src = pickFace(css);
    if (!src) throw new Error(`No woff2 or woff in the Google Fonts reply for ${family}`);
    const fontRes = await fetch(src.url, { credentials: 'omit' });
    if (!fontRes.ok) throw new Error(`font fetch failed with ${fontRes.status} for ${family}`);
    const dataUri = await blobToDataUrl(await fontRes.blob());
    return `@font-face{font-family:'${family}';font-style:${italic ? 'italic' : 'normal'};`
      + `font-weight:${weight};src:url(${dataUri}) format('${src.format}');}`;
  })();

  FONT_CACHE.set(key, load);
  try {
    return await load;
  } catch (err) {
    FONT_CACHE.delete(key);            // a failure must not be cached as an answer
    throw err;
  }
}

/**
 * Every face a set of runs needs, fetched in parallel.
 * A multi-family request returns one @font-face block per family and
 * `String.match` without /g returns only the first, so this asks per family.
 *
 * Each face is asked for only the characters its family lists (H1). A face left
 * with none is skipped, and its runs draw in the generic fallback, as on screen.
 * A face that still cannot be inlined throws an error naming the family, the
 * fields it draws and the characters asked for, never a bare "Failed to fetch".
 */
async function faceCss(faces) {
  const rules = await Promise.all(faces.map(async (f) => {
    const { covered } = partitionChars(f.family, f.text);
    if (!covered) return '';
    try {
      return await inlineGoogleFont({ ...f, text: covered });
    } catch (err) {
      throw new Error(describeFontFailure(f, covered, err), { cause: err });
    }
  }));
  return rules.filter(Boolean).join('\n');
}

/** The message a page shows: which face, which fields, which characters, and what the browser said. */
function describeFontFailure(face, chars, err) {
  const where = (face.fields || []).map(fieldLabel).join(', ') || 'the text';
  const shown = chars.replace(/\s+/g, '').slice(0, 24) || chars;
  return `Google Fonts did not deliver ${face.family}, which draws the ${where}, for "${shown}". `
    + 'The face may lack those characters, or the connection dropped. '
    + `(${err && err.message ? err.message : String(err)})`;
}

/* ── images (C6.2 step 3) ──────────────────────────────────────────────────── */

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('could not read the fetched bytes'));
    fr.readAsDataURL(blob);
  });
}

/**
 * Replace every `<image href>` in the tree with a data URI.
 *
 * character-sheet swallows a failed image and lets it render as an empty frame.
 * This throws instead: a certificate that exports with a blank seal is worse
 * than one that refuses to export.
 */
export async function inlineImages(svgNode) {
  const nodes = [...svgNode.querySelectorAll('image')];
  await Promise.all(nodes.map(async (node) => {
    const href = node.getAttribute('href');
    if (!href || href.startsWith('data:')) return;
    const res = await fetch(href, { credentials: 'omit' });
    if (!res.ok) throw new Error(`export could not inline ${href}: ${res.status}`);
    node.setAttribute('href', await blobToDataUrl(await res.blob()));
  }));
  return svgNode;
}

/* ── the one serialisation both outputs come from (C6.2) ───────────────────── */

async function serialise(node, faces) {
  const clone = node.cloneNode(true);
  const css = await faceCss(faces);
  await inlineImages(clone);
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = css;
  clone.insertBefore(style, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}

/**
 * The serialised export SVG: real `<text>`, subset fonts inlined as data URIs,
 * every image inlined. This one string is both the `.svg` download and the
 * source of the PNG, so the two cannot disagree.
 */
export async function buildExportSvg(design, provenance) {
  const node = renderSvg(design, provenance);
  return serialise(node, usedFonts(design, provenance));
}

/* ── raster ────────────────────────────────────────────────────────────────── */

/**
 * Rasterise a serialised SVG.
 *
 * One pass. The "render twice, keep the second" workaround that circulates for
 * WebKit was measured unnecessary on 2026-09-09: WebKit, Chromium and Firefox
 * all apply a data: @font-face on the first render, with byte-identical first
 * and second renders.
 *
 * `img.crossOrigin` is deliberately not set. A data: URL cannot taint a canvas,
 * and a data: URL with the CORS flag set has a history of never firing load.
 */
export async function rasterise(svgText, { width, height, scale = 2 }) {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
  try {
    await img.decode();                    // stronger than onload: it resolves on decoded pixels
  } catch (err) {
    // The browser's own wording is "The source image cannot be decoded", which
    // names nothing. It has one known cause left now that H2 strips control
    // characters at normalisation, and that cause is said here.
    throw new Error(`The browser could not decode the export as an SVG image (${err && err.message ? err.message : err}). `
      + 'That means the serialised SVG was not well-formed; report the design that produced it.', { cause: err });
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('the canvas produced no PNG');
  return blob;
}

/** A badge or certificate PNG at `scale` 1, 2 or 3. */
export async function exportPng(design, provenance, { scale = 2 } = {}) {
  const d = normalizeDesign(design);
  const svgText = await buildExportSvg(d, provenance);
  return rasterise(svgText, { width: d.size.w, height: d.size.h, scale });
}

/** The same artefact as an `.svg` file. Same bytes as the PNG's source. */
export async function exportSvgFile(design, provenance) {
  const svgText = await buildExportSvg(design, provenance);
  return new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
}

/** A profile or group poster: 1200 units wide, height computed from the grid. */
export async function exportProfilePng(awards, profile, opts = {}) {
  const { svg, fonts, width, height } = buildProfileSvg(awards, profile, opts);
  const svgText = await serialise(svg, fonts);
  return rasterise(svgText, { width, height, scale: opts.scale || 2 });
}

/* ── download, clipboard, share ────────────────────────────────────────────── */

export function slugify(name) {
  return (name || 'insignia').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'insignia';
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  // Revoke on a later turn: revoking immediately can cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copy a PNG blob to the clipboard. Returns false when the browser blocks it. */
export async function copyPng(blob) {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}

/**
 * The native share sheet with the PNG attached.
 * Returns 'shared', 'dismissed' or 'unsupported' so the caller writes the copy.
 */
export async function sharePng(blob, name) {
  const file = new File([blob], `${slugify(name)}.png`, { type: 'image/png' });
  if (!navigator.canShare || !navigator.canShare({ files: [file] })) return 'unsupported';
  try {
    await navigator.share({ title: name, files: [file] });
    return 'shared';
  } catch (err) {
    if (err && err.name === 'AbortError') return 'dismissed';
    throw err;
  }
}

/* ── print to PDF (C6.4) ───────────────────────────────────────────────────── */

/** Resolves when the page's fonts are loaded, or after `timeout`. */
export function fontsReady(timeout = 2500) {
  if (!document.fonts) return Promise.resolve();
  return Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, timeout))]);
}

const PAGE_MM = { A4: { landscape: [297, 210], portrait: [210, 297] } };

/**
 * Fill `#print-root` with the certificate as inline SVG and wait until the page
 * is ready to print. The caller then calls `window.print()` and the visitor
 * picks "Save as PDF". No PDF library.
 *
 * Inline SVG rather than a CSS background on purpose: `print-color-adjust`
 * defaults to `economy` and Chrome's "Background graphics" box is off, but
 * `<rect fill>`, `<path fill>` and `<linearGradient>` are foreground content and
 * print regardless.
 */
export async function printRoot(design, provenance, { pageSize = 'A4', rootId = 'print-root', title } = {}) {
  const d = normalizeDesign(design);
  const orientation = d.kind === 'certificate' ? d.orientation : 'portrait';
  const [mmW, mmH] = (PAGE_MM[pageSize] || PAGE_MM.A4)[orientation];

  let root = document.getElementById(rootId);
  if (!root) {
    root = document.createElement('div');
    root.id = rootId;
    document.body.appendChild(root);
  }
  let style = document.getElementById('ins-page');
  if (!style) {
    style = document.createElement('style');
    style.id = 'ins-page';
    document.head.appendChild(style);
  }
  style.textContent = `@media print{@page{size:${pageSize} ${orientation};margin:0}`
    + `#${rootId} svg{width:${mmW}mm;height:${mmH}mm}}`;

  root.innerHTML = '';
  ensureFonts();   // the print path draws from the page's own font stack, not from an inlined subset
  const svg = renderSvg(d, provenance);
  // cloneNode copies ids, so a second copy of every gradient and clip path would
  // sit in the document and any later getElementById would resolve to whichever
  // came first. renderSvg builds a fresh tree instead of cloning the preview.
  root.appendChild(svg);

  const previousTitle = document.title;
  if (title) document.title = title;      // the print dialog proposes it as the file name

  await fontsReady();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const cleanup = () => {
    root.innerHTML = '';
    document.title = previousTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // Browsers with no afterprint, and cancelled print-to-file, still get cleaned.
  setTimeout(() => { if (root.innerHTML) cleanup(); }, 60000);
  return root;
}

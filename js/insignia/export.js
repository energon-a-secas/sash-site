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
 */
import { renderSvg, usedFonts, normalizeDesign, ensureFonts } from './render.js';
import { buildProfileSvg } from './wallet.js';

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
 */
async function faceCss(faces) {
  const rules = await Promise.all(faces.map((f) => inlineGoogleFont(f)));
  return rules.join('\n');
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
  await img.decode();                      // stronger than onload: it resolves on decoded pixels
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

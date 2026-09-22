/**
 * Insignia Kit: the certificate layout engine (C1.2).
 *
 * Called by render.js, never directly: `renderSvg` is the one drawing path, and
 * that is what makes the provenance band structural (C11.1). The engine is pure
 * geometry over the normalised document, so the same design and provenance lay
 * out identically on every call.
 *
 * `layoutText` is the single source of both what is drawn and what `usedFonts`
 * reports, so the `&text=` subset the exporter requests cannot drift from the
 * characters on the page (C6.3).
 *
 * Design round 2 (2026-09-15) split the page at frozen call points, so a
 * stream restyles the frame, the band or the security print without editing
 * this file: `cert-band.js` (`drawFrame`, `drawBand`), `security.js`
 * (`drawSecurity`, `securityRuns`), `qr.js` (the encoder). `formatDate` moved
 * to `provenance.js` because the SVG `<desc>` needs it too; it, `qrMatrix` and
 * `qrNode` are re-exported here so every importer reads what it always did.
 * The background step asks `patterns.js` for `guillocheLayers` and `fadeMask`
 * through the module namespace, so the page-size guilloche (K1) lands the day
 * it is exported and nothing here changes.
 *
 * A signature that resolves to a handle (C7.30) is laid out here and fitted
 * the way the badge strip fits its top line (A51): Great Vibes is
 * proportional, so the kit carries its measured advance per character for the
 * handle alphabet and pins the autograph to the rule with `textLength` only
 * when the model says it would run past it. The 4-unit mono line beneath
 * gives the handle's profile address, built from the verify URL's host so the
 * two cannot name different sites.
 */
import * as patterns from './patterns.js';
import { svgEl, n, patternDefs, xmlSafe } from './patterns.js';
import { formatDate, handleText } from './provenance.js';
import { drawFrame, drawBand, bandRuns } from './cert-band.js';
import { drawSecurity, securityRuns } from './security.js';
import { qrMatrix, qrNode } from './qr.js';

export { formatDate, qrMatrix, qrNode };

const HOLDER_PLACEHOLDER = 'holder name';
const SIGNATURE_SIZE = 46;               // the script face, on the rule
const PROFILE_SIZE = 4;                  // the mono profile line beneath it, the microtext size
const PROFILE_HOST = 'sash.neorgon.com'; // when the provenance carries no verify URL to read one from

// Great Vibes 400, the script role, is proportional: `i` advances 0.176 em
// where `@` advances 1.028, so no single constant bounds a handle the way
// `MONO_ADV` bounds the mono line. These are the measured advances in
// thousandths of an em, grouped by value, over every character a handle can
// draw: `@` and `^[a-z0-9][a-z0-9-]{1,29}$` (C4.2). Measured per glyph with the
// face loaded in Chromium, Firefox and WebKit on 2026-09-15, which agree to the
// thousandth, and a whole handle measures at or under the sum of its glyphs
// (kerning only tightens), so the model never under-reports a width.
const SCRIPT_EM3 = {
  176: 'i', 178: 'j', 194: 'f', 201: 't', 213: 'l', 256: 'e', 259: 'r', 263: 'c', 267: 's', 303: '1', 309: 'v',
  327: 'b', 334: 'x', 336: 'hp', 338: 'no', 343: 'z', 347: '7q', 356: 'u', 358: 'a', 360: 'k', 372: 'd5',
  381: 'y', 384: '8', 387: '3', 392: '2', 395: '6', 396: 'g', 402: '9', 404: '-', 406: '4', 458: '0',
  495: 'w', 509: 'm', 1028: '@',
};
const SCRIPT_ADV = new Map();
for (const em3 of Object.keys(SCRIPT_EM3)) for (const ch of SCRIPT_EM3[em3]) SCRIPT_ADV.set(ch, +em3 / 1000);
// A character outside the alphabet counts as the widest in it, so a string the
// table does not know errs towards being pinned, never towards running off.
const SCRIPT_MAX = Math.max(...SCRIPT_ADV.values());

/**
 * The `textLength` pin for a script-role line that must stay inside `inner`
 * units at `size`: `inner` when the modelled width runs past it, null when the
 * line already fits and is drawn as it is. The table only decides whether the
 * line clears the rule; the pin is what holds it there afterwards, on any
 * face, the fallback that draws when Great Vibes never loaded included.
 */
export function fitScript(text, { inner, size = SIGNATURE_SIZE }) {
  let em = 0;
  for (const ch of String(text)) em += SCRIPT_ADV.has(ch) ? SCRIPT_ADV.get(ch) : SCRIPT_MAX;
  return em * size > inner ? inner : null;
}

/** The host the verify URL names, or the fallback when the provenance has none. */
export function verifyHost(prov) {
  const m = /^https?:\/\/([^/?#]+)/.exec(typeof prov.verifyUrl === 'string' ? prov.verifyUrl : '');
  return m ? xmlSafe(m[1]) : PROFILE_HOST;
}

/** `sash.neorgon.com/u.html?h=duckfan`: the profile address of a handle, without the scheme, as the strip writes its URL. */
function profileUrl(prov, handle) {
  return `${verifyHost(prov)}/u.html?h=${handle}`;
}

/* ── text layout ───────────────────────────────────────────────────────────── */

/**
 * Every string the certificate draws, positioned. `holder`, `issuerLine` and the
 * date are filled from the award: an authored `holder` is used only in the
 * editor preview, which is what C1.2 means by "filled by the renderer".
 *
 * `signatures[].from` (round 2, C7.30) is resolved here, so the handle a
 * signature draws is a run like any other and reaches `usedFonts`. `text` is
 * the authored name and role; `issuer` and `holder` draw the handle in the
 * script role on the rule, pinned to the rule's width when the model says it
 * would run past it, with the 4-unit mono profile line beneath. Field names
 * are frozen for `fieldLabel`: `signatures[i].name`, `signatures[i].role`, and
 * `signatures[i].from` for both the handle and the line beneath it.
 *
 * With `serial.style` loud the date line moves off the body and into the
 * record block (cert-band.js), so it is laid out here only when the band
 * keeps its quiet style.
 */
export function layoutText(d, prov) {
  const { w, h } = d.size;
  const t = d.text;
  const award = prov.mode === 'award';
  const items = [];
  // `key` names the C1.2 text slot, so a run reports the field it came from.
  // Provenance strings arrive unnormalised, so `xmlSafe` runs here for all of them.
  const put = (key, value, y) => {
    const spec = t[key];
    const text = xmlSafe(value === null || value === undefined ? '' : value);
    if (!text) return;
    items.push({
      field: `text.${key}`, value: text, role: spec.font, size: spec.size, color: spec.color,
      x: w / 2, y, anchor: 'middle',
    });
  };

  put('eyebrow', t.eyebrow.value, h * 0.20);
  put('title', t.title.value, h * 0.30);
  put('holderLabel', t.holderLabel.value, h * 0.385);
  put('holder', award ? prov.holder : (t.holder.value || prov.holder || HOLDER_PLACEHOLDER), h * 0.475);
  put('body', t.body.value, h * 0.545);

  // An imported credential carries `issuerHandle: null` (A6), so there is no
  // line to draw rather than a line reading `issued by @null`. `put` skips an
  // empty value, which is what makes the null render as nothing.
  const issuedBy = prov.issuerHandle ? `issued by @${prov.issuerHandle}` : '';
  const issuer = award || !t.issuerLine.value ? issuedBy : t.issuerLine.value;
  put('issuerLine', issuer, h * 0.585);

  const issued = formatDate(prov.issuedAt);
  const until = formatDate(prov.expiresAt);
  const dateLine = [
    issued ? `${t.dateLabel.value} ${issued}` : '',
    until ? `valid until ${until}` : '',
  ].filter(Boolean).join('   ');
  if (d.serial.style !== 'loud') put('dateLabel', dateLine, h * 0.625);

  // Signatures sit on their own rules, in the lower third, and never in the
  // middle: the seal is centred at `seal.x` 0.5 by default and a centred
  // signature ends up underneath it.
  const sigY = h * 0.78;
  const ruleW = w * 0.2;
  d.signatures.forEach((sig, i) => {
    const x = i === 0 ? w * 0.24 : w * 0.76;
    const { name, role, handle } = resolveSignature(sig, prov);
    if (name) {
      items.push({ field: handle ? `signatures[${i}].from` : `signatures[${i}].name`,
        value: name, role: 'script', size: SIGNATURE_SIZE, color: d.palette.ink, x, y: sigY, anchor: 'middle',
        // An authored name keeps the drawing that shipped; a handle is pinned
        // to the rule, since a 30-character one at this size is wider than it.
        textLength: handle ? fitScript(name, { inner: ruleW }) : null });
    }
    if (role) {
      items.push({ field: `signatures[${i}].role`, value: role, role: 'sans', size: 22, color: d.text.issuerLine.color, x, y: sigY + 54, anchor: 'middle' });
    }
    if (handle) {
      // The profile line: where the handle resolves, in the microtext size,
      // under the role when there is one and under the rule when there is not.
      items.push({ field: `signatures[${i}].from`, value: profileUrl(prov, handle), role: 'mono', size: PROFILE_SIZE,
        color: d.text.issuerLine.color, x, y: role ? sigY + 68 : sigY + 28, anchor: 'middle' });
    }
    items.push({ rule: true, x, y: sigY + 16, width: ruleW });
  });

  return items;
}

/**
 * What a signature draws, by `from`: the authored text, the issuer's handle,
 * or the holder's handle with the role defaulting to `accepted by`. Preview
 * mode has no award, so a handle that is not there yet draws as a placeholder
 * rather than as nothing, which is how the author sees the slot. `handle` is
 * the bare handle the profile line points at, `...` under a placeholder the
 * way the strip's preview URL ends, and null for a `text` signature, which
 * stays exactly the drawing that shipped.
 */
function resolveSignature(sig, prov) {
  if (sig.from === 'text') return { name: sig.name, role: sig.role, handle: null };
  const real = handleText(sig.from === 'issuer' ? prov.issuerHandle : prov.holder);
  const name = real || (prov.mode === 'preview' ? `@${sig.from}` : '');
  const role = sig.from === 'holder' ? (sig.role || 'accepted by') : sig.role;
  return { name, role, handle: name ? (real ? real.slice(1) : '...') : null };
}

/**
 * Every {role, text} pair a certificate draws, for `usedFonts`. That includes
 * the seal, which is a whole badge design embedded by value (C1.2) and draws
 * arcs of its own, the band (`bandRuns`: the serial, and the loud record
 * block's caption and dates) and the security print (`securityRuns`), so the
 * microtext, the latent word, the stamp, the record block and the signature
 * handles reach the `&text=` subset the exporter asks for.
 *
 * `sealRuns` reads a badge the way the `renderSealNode` helper draws one: this
 * module owns the certificate's own layout and neither reads nor draws a badge,
 * so render.js hands in both and the characters collected cannot disagree with
 * the characters drawn. It is **required** for a design carrying a seal and
 * this throws without it, because the alternative is a subset that omits the
 * seal's letters, a per-character fallback in the arc, and an export that
 * reports success (C6.3).
 */
export function certificateRuns(d, prov, { sealRuns } = {}) {
  const runs = layoutText(d, prov)
    .filter((i) => !i.rule)
    .map((i) => ({ field: i.field, role: i.role, text: i.value }));
  // The band's own strings, quiet or loud, come from the module that draws them.
  runs.push(...bandRuns(d, prov));
  runs.push(...securityRuns(d, prov));
  if (d.seal.design) {
    if (typeof sealRuns !== 'function') {
      throw new TypeError('certificateRuns needs a sealRuns collector to read a seal design (C6.3)');
    }
    for (const run of sealRuns(d.seal.design)) runs.push({ ...run, field: `seal.${run.field}` });
  }
  return runs;
}

/* ── drawing ───────────────────────────────────────────────────────────────── */

/**
 * The page, in the order the round's plan froze (section 1.4): base, ground,
 * security ground, frame, text, seal, security over, band. `helpers` is
 * `{ textNode, nextId, artUrl, renderSealNode }` from render.js.
 */
export function drawCertificate(root, defs, d, prov, helpers) {
  const { textNode, nextId, renderSealNode } = helpers;
  const { w, h } = d.size;

  root.appendChild(svgEl('rect', { width: n(w), height: n(h), fill: d.palette.base }));
  drawGround(root, defs, d, nextId);
  drawSecurity(root, defs, d, prov, helpers, 'ground');
  drawFrame(root, defs, d);

  for (const item of layoutText(d, prov)) {
    if (item.rule) {
      root.appendChild(svgEl('line', {
        x1: n(item.x - item.width / 2), y1: n(item.y), x2: n(item.x + item.width / 2), y2: n(item.y),
        stroke: d.palette.accent, 'stroke-width': '2', 'stroke-opacity': '0.7',
      }));
      continue;
    }
    root.appendChild(textNode(item.value, item));
  }

  if (d.seal.design) {
    const size = d.seal.size;
    const seal = renderSealNode(d.seal.design, prov);
    seal.setAttribute('x', n(d.seal.x * w - size / 2));
    seal.setAttribute('y', n(d.seal.y * h - size / 2));
    seal.setAttribute('width', n(size));
    seal.setAttribute('height', n(size));
    root.appendChild(seal);
  }

  drawSecurity(root, defs, d, prov, helpers, 'over');
  drawBand(root, defs, d, prov, textNode, qrNode);
}

/**
 * The background. A guilloche draws once at page size through
 * `guillocheLayers` (patterns.js, K1) when that returns non-null, so there is
 * no seam and no 3.3-times tile; every other kind, and a guilloche until K1
 * lands, is the `<pattern>` fill that shipped. `background.fade` above zero
 * masks the fill through `fadeMask`; at zero, today's bytes.
 */
function drawGround(root, defs, d, nextId) {
  const { w, h } = d.size;
  const bg = d.background;
  const opts = { w, h, color: bg.color, opacity: bg.opacity, scale: bg.scale, id: nextId('bg') };
  let fill = null;
  if (bg.kind === 'guilloche' && typeof patterns.guillocheLayers === 'function') {
    fill = patterns.guillocheLayers(opts);
  }
  if (!fill) {
    const pat = patternDefs(bg.kind, opts);
    if (!pat) return;
    defs.appendChild(pat);
    fill = svgEl('rect', { width: n(w), height: n(h), fill: `url(#${pat.getAttribute('id')})` });
  }
  if (bg.fade > 0 && typeof patterns.fadeMask === 'function') {
    const mask = patterns.fadeMask({ w, h, cx: w / 2, cy: h / 2, fade: bg.fade, id: nextId('fade') });
    if (mask) {
      defs.appendChild(mask);
      fill.setAttribute('mask', `url(#${mask.getAttribute('id')})`);
    }
  }
  root.appendChild(fill);
}

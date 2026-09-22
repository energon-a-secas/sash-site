#!/usr/bin/env node
/**
 * The detector for the signature fold into the C11.3 blocklist. Design round 2,
 * plan section 2.4 (server-only) and 3.4.
 *
 * `templates:publish` screens every author-supplied string in a template
 * against the real-issuer blocklist before it writes anything. Which strings
 * it screens is decided by one function, `designTextFields` in lib/design.ts,
 * and until design round 2 that function never looked at a certificate's
 * `signatures[].name` or `.role`: the one free-text slot on the document that
 * could carry "aws" past the control. K0 added the fold; this test plants a
 * blocked term in a signature name and watches it come out, and then runs the
 * same list through the real matcher so the whole path is exercised, not one
 * function of it.
 *
 * It also asserts the fold did not drop anything C11.3 already named (the
 * arcs, the ribbon, the edition mark, every text block, the seal recursion),
 * and that templates.ts still hands the function's output to the matcher: a
 * fold that is present while publish has stopped calling it is the regression
 * no unit test of the function alone can see.
 *
 * Exit codes, matching tests/enums.test.mjs:
 *   0  the planted terms come out and the matcher trips on them
 *   1  they do not, and the missing field is named
 *   2  the sources could not be loaded, so nothing was checked. This runtime
 *      cannot import TypeScript before Node 22.18.
 *
 * Run it with:  node convex/tests/textfields.test.mjs   (from projects/sash-site)
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import * as nodeModule from "node:module";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * lib/blocklist.ts imports "../data/blocklist" with no extension, which the
 * Convex bundler resolves and Node's own loader does not. This hook retries a
 * relative specifier that failed to resolve with ".ts" appended, so the
 * shipping matcher is imported as written rather than reimplemented here.
 * registerHooks arrived in Node 22.15; type stripping needs 22.18 anyway.
 */
if (typeof nodeModule.registerHooks !== "function") {
  console.error("textfields.test: this Node cannot register resolve hooks. Nothing was checked. Use Node 22.18 or newer.");
  process.exit(2);
}
nodeModule.registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (/^\.\.?\//.test(specifier) && !/\.[a-z]+$/i.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw err;
    }
  },
});
const DESIGN = resolve(here, "../lib/design.ts");
const BLOCKLIST = resolve(here, "../lib/blocklist.ts");
const TEMPLATES = resolve(here, "../templates.ts");

for (const file of [DESIGN, BLOCKLIST, TEMPLATES]) {
  if (!existsSync(file)) {
    console.error(`textfields.test: ${file} is not on disk. Nothing was checked.`);
    process.exit(2);
  }
}

let designTextFields, checkBlocklist, blockedMessage;
try {
  ({ designTextFields } = await import(pathToFileURL(DESIGN).href));
  ({ checkBlocklist, blockedMessage } = await import(pathToFileURL(BLOCKLIST).href));
} catch (err) {
  console.error("textfields.test: could not load the TypeScript sources directly.");
  console.error(`  ${err.message}`);
  console.error("Nothing was checked. This is not a pass. Node 22.18 or newer strips types natively.");
  process.exit(2);
}

if (typeof designTextFields !== "function") {
  console.error("textfields.test: lib/design.ts no longer exports designTextFields.");
  process.exit(1);
}

let pass = 0, fail = 0;
const ok = (label) => { console.log(`  ok    ${label}`); pass++; };
const bad = (label, why) => { console.log(`  FAIL  ${label}${why ? `: ${why}` : ""}`); fail++; };
const group = (title) => console.log(`\n${title}`);

const carries = (label, design, value) => {
  const out = designTextFields(design);
  out.includes(value) ? ok(label) : bad(label, `${JSON.stringify(value)} is not in ${JSON.stringify(out)}`);
};
const omits = (label, design, value) => {
  const out = designTextFields(design);
  out.includes(value) ? bad(label, `${JSON.stringify(value)} is in ${JSON.stringify(out)}`) : ok(label);
};

/** A certificate with both signature slots authored, one of them a real issuer. */
const certificate = {
  kind: "certificate",
  text: {
    title: { value: "Ceremonial Yak Shaver" },
    body: { value: "for services to the build" },
  },
  signatures: [
    { name: "aws", role: "sponsor" },
    { name: "A. Person", role: "Amazon Web Services liaison" },
  ],
  seal: {
    design: {
      kind: "badge",
      arcs: { top: { text: "SEAL TOP" }, bottom: { text: "seal bottom" } },
      ribbon: { text: "seal ribbon" },
      mark: { edition: "seal ed." },
    },
  },
};

// ── 2.4 the fold: signatures[].name and signatures[].role ─────────────────────
group("2.4 designTextFields carries signatures[].name and signatures[].role");
carries("a planted aws in signatures[0].name comes out", certificate, "aws");
carries("signatures[0].role comes out", certificate, "sponsor");
carries("signatures[1].name comes out", certificate, "A. Person");
carries("a planted Amazon Web Services in signatures[1].role comes out", certificate, "Amazon Web Services liaison");
carries("a signature on an embedded seal design comes out through the recursion",
  { kind: "certificate", seal: { design: { kind: "certificate", signatures: [{ name: "gcp" }] } } }, "gcp");
{
  const out = designTextFields(certificate);
  const nameAt = out.indexOf("aws");
  const bodyAt = out.indexOf("for services to the build");
  const sealAt = out.indexOf("SEAL TOP");
  if (bodyAt < nameAt && nameAt < sealAt) ok("signatures sit after the text block values and before the seal recursion");
  else bad("signature position in the list", JSON.stringify(out));
}

group("  what the fold must not do");
omits("an empty signature name is not pushed", { signatures: [{ name: "", role: "x" }] }, "");
omits("a whitespace-only role is not pushed", { signatures: [{ name: "x", role: "   " }] }, "   ");
{
  let threw = false;
  let out;
  try { out = designTextFields({ signatures: [null, 42, "aws", { name: "okta" }] }); } catch { threw = true; }
  if (threw) bad("a signature entry that is not an object is skipped without throwing");
  else if (out.includes("okta") && !out.includes("aws")) ok("a signature entry that is not an object is skipped without throwing, and a bare string is not a signature");
  else bad("a signature entry that is not an object is skipped", JSON.stringify(out));
}
{
  let threw = false;
  try { designTextFields({ signatures: "aws" }); designTextFields(null); designTextFields("aws"); } catch { threw = true; }
  threw ? bad("a non-array signatures field and a non-object design do not throw") : ok("a non-array signatures field and a non-object design do not throw");
}
{
  const out = designTextFields({ signatures: [{ name: "aws", from: "issuer" }] });
  if (out.length === 1 && out[0] === "aws") ok("signatures[].from, an enum, is not treated as author text");
  else bad("signatures[].from is not pushed", JSON.stringify(out));
}

// ── C11.3's original list is intact ───────────────────────────────────────────
group("C11.3 the fields the blocklist already saw are still carried");
const badge = {
  kind: "badge",
  arcs: { top: { text: "TOP ARC" }, bottom: { text: "bottom arc" } },
  ribbon: { text: "the ribbon" },
  mark: { edition: "1st" },
};
carries("arcs.top.text", badge, "TOP ARC");
carries("arcs.bottom.text", badge, "bottom arc");
carries("ribbon.text", badge, "the ribbon");
carries("mark.edition", badge, "1st");
carries("every text.*.value on a certificate", certificate, "Ceremonial Yak Shaver");
carries("the seal's arcs through the recursion", certificate, "SEAL TOP");
carries("the seal's ribbon through the recursion", certificate, "seal ribbon");
carries("the seal's edition mark through the recursion", certificate, "seal ed.");
{
  const out = designTextFields(badge);
  if (out.length === 4) ok("a badge with no signatures yields exactly its four strings, nothing invented");
  else bad("badge string count", `${out.length}: ${JSON.stringify(out)}`);
}

// ── The whole path: fold plus matcher ─────────────────────────────────────────
group("the control end to end: designTextFields into checkBlocklist");
{
  const verdict = checkBlocklist(designTextFields(certificate));
  if (verdict.hit && verdict.term === "aws") ok("a certificate whose signature is named aws is refused, term aws");
  else bad("signature name aws through the matcher", JSON.stringify(verdict));
  if (verdict.unguarded) bad("the list is loaded", "verdict says unguarded");
  else ok(`the list is loaded, ${verdict.listSize} terms`);
}
{
  // The matcher reports the first term in list order, and "amazon" sits before
  // "amazon web services", so the phrase property is shown on a term whose
  // single words are not listed on their own.
  const roleOnly = { kind: "certificate", signatures: [{ name: "A. Person", role: "Linux Foundation liaison" }] };
  const verdict = checkBlocklist(designTextFields(roleOnly));
  if (verdict.hit && verdict.term === "linux foundation") ok("a role naming the Linux Foundation is refused as a phrase of whole words, through signatures[].role");
  else bad("signature role through the matcher", JSON.stringify(verdict));
}
{
  const roleOnly = { kind: "certificate", signatures: [{ name: "A. Person", role: "Amazon Web Services liaison" }] };
  const verdict = checkBlocklist(designTextFields(roleOnly));
  if (verdict.hit && /^amazon/.test(verdict.term)) ok(`a role naming Amazon Web Services is refused, term ${verdict.term}`);
  else bad("signature role naming Amazon Web Services", JSON.stringify(verdict));
}
{
  const sealed = { kind: "certificate", seal: { design: { kind: "badge", arcs: { top: { text: "ISC2 CLUB" } } } } };
  const verdict = checkBlocklist(designTextFields(sealed));
  if (verdict.hit && verdict.term === "isc2") ok("a blocked term on the embedded seal is refused through the recursion");
  else bad("seal through the matcher", JSON.stringify(verdict));
}
{
  const nearMiss = { kind: "certificate", signatures: [{ name: "Awkward Penguin", role: "Amazonian explorer" }] };
  const verdict = checkBlocklist(designTextFields(nearMiss));
  if (!verdict.hit) ok("Awkward and Amazonian in a signature walk past, the whole-word rule holds on the new fields");
  else bad("near miss in a signature", `tripped ${verdict.term}`);
}
{
  const clean = { kind: "certificate", signatures: [{ name: "Grandmother Yak", role: "head of yaks" }] };
  const verdict = checkBlocklist(designTextFields(clean));
  if (!verdict.hit) ok("an honest signature is not refused");
  else bad("honest signature", `tripped ${verdict.term}`);
}
{
  const m = blockedMessage("aws");
  if (/\b(certified|accredited|licensed|official)\b/i.test(m)) bad("blockedMessage avoids the C11.7 vocabulary", m);
  else ok("the refusal an author sees for a signature carries no accreditation vocabulary (C11.7)");
}

// ── The revert: publish must still hand the fold's output to the matcher ──────
group("templates:publish still screens designTextFields(row.design)");
{
  const src = readFileSync(TEMPLATES, "utf8");
  const feeds = /designTextFields\(\s*row\.design\s*\)/.test(src);
  const checks = /checkBlocklist\(\s*texts\s*\)/.test(src);
  const before = src.indexOf("designTextFields(row.design)") < src.indexOf("checkBlocklist(texts)");
  if (feeds && checks && before) ok("templates.ts builds texts from designTextFields(row.design) and passes them to checkBlocklist");
  else bad("templates.ts wiring", `feeds=${feeds} checks=${checks} ordered=${before}`);
}
{
  const src = readFileSync(DESIGN, "utf8");
  const body = src.slice(src.indexOf("export function designTextFields"));
  if (/push\(sig\.name\)/.test(body) && /push\(sig\.role\)/.test(body)) ok("design.ts pushes sig.name and sig.role by those names, so a rename shows up here");
  else bad("design.ts text", "push(sig.name) or push(sig.role) not found in designTextFields");
}

console.log(`\ntextfields.test: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

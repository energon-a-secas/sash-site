#!/usr/bin/env node
/**
 * The detector for CONTRACTS.md C15 A25.
 *
 * seed:ensureNeorgonTemplates compared a design read back out of Convex against
 * the literal in data/catalog.ts with JSON.stringify. Convex returns an object's
 * fields in alphabetical order and the catalogue builds them in its own order,
 * so the two strings never matched, every design looked changed on every run,
 * and the seed minted fifteen fresh templateVersions rows each time it ran while
 * reporting created 0, updated 15. templateVersions is immutable and every award
 * pins a versionId, so two identical Neorgon awards granted either side of a
 * re-seed pinned different version numbers.
 *
 * **The return value cannot detect this and never could.** The only way it
 * surfaced was counting rows. This test is the cheap standing substitute for
 * that count: it runs the seed's own comparison, against the seed's own
 * catalogue, without a deployment and without writing anything.
 *
 * Exit codes, following the convention enums.test.mjs set:
 *   0  the comparison is order-insensitive and the seed uses it
 *   1  it is not, and a re-seed will mint immutable rows
 *   2  nothing was compared, which is not a pass. This runtime cannot import
 *      TypeScript directly, so run it on Node 22.18 or newer.
 *
 * Run it with:  npm run test:seed   (from projects/sash-site)
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SHARED = resolve(here, "../lib/shared.ts");
const CATALOG = resolve(here, "../data/catalog.ts");
const SEED = resolve(here, "../seed.ts");

for (const path of [SHARED, CATALOG, SEED]) {
  if (!existsSync(path)) {
    console.error(`seed-idempotence.test: ${path} is not on disk. Nothing was compared.`);
    process.exit(2);
  }
}

/**
 * The shipping helper and the real catalogue, imported rather than reimplemented:
 * a detector that carries its own copy of the thing it checks proves nothing.
 * Node strips the types itself from 22.18 onward, so this needs no build step,
 * which is what keeps the test runnable next to the other two.
 */
let sameValue, NEORGON_TEMPLATES;
try {
  ({ sameValue } = await import(pathToFileURL(SHARED).href));
  ({ NEORGON_TEMPLATES } = await import(pathToFileURL(CATALOG).href));
} catch (err) {
  console.error("seed-idempotence.test: could not load the TypeScript sources directly.");
  console.error(`  ${err.message}`);
  console.error("Nothing was compared. This is not a pass. Node 22.18 or newer strips types natively.");
  process.exit(2);
}

if (typeof sameValue !== "function") {
  console.error("seed-idempotence.test: lib/shared.ts no longer exports sameValue.");
  process.exit(1);
}
if (!Array.isArray(NEORGON_TEMPLATES) || NEORGON_TEMPLATES.length === 0) {
  console.error("seed-idempotence.test: the catalogue is empty, so nothing was compared.");
  process.exit(2);
}

/** What Convex hands back: the same value with every object's keys sorted. */
function asConvexReturnsIt(value) {
  if (Array.isArray(value)) return value.map(asConvexReturnsIt);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = asConvexReturnsIt(value[key]);
    return out;
  }
  return value;
}

let failures = 0;
const bad = (msg) => { console.error(`FAIL  ${msg}`); failures++; };

// 1. The properties the seed depends on, on values this test controls, so this
//    section can never go vacuous no matter what the catalogue looks like.
if (!sameValue({ a: 1, b: 2 }, { b: 2, a: 1 })) bad("sameValue is sensitive to object key order.");
if (!sameValue({ x: { p: 1, q: 2 } }, { x: { q: 2, p: 1 } })) bad("sameValue is sensitive to nested key order.");
if (!sameValue([{ a: 1, b: 2 }], [{ b: 2, a: 1 }])) bad("sameValue is sensitive to key order inside an array.");
if (sameValue([1, 2], [2, 1])) bad("sameValue ignores array order. Ring order is paint order and must count.");
if (sameValue({ a: 1 }, { a: 2 })) bad("sameValue does not notice a changed value.");
if (sameValue({ a: 1 }, { a: 1, b: 1 })) bad("sameValue does not notice an added key.");
if (!sameValue(null, null)) bad("sameValue says null differs from null.");
if (sameValue(null, undefined)) bad("sameValue conflates null with absent.");

// 2. Every real catalogue design, through the seed's own comparison, in the
//    exact direction a re-seed makes it. A failure here means the next run of
//    seed:ensureNeorgonTemplates mints one immutable row per entry.
let wouldHaveMinted = 0;
for (const entry of NEORGON_TEMPLATES) {
  const stored = asConvexReturnsIt(entry.design);
  if (!sameValue(stored, entry.design)) {
    bad(`slug ${entry.slug}: a stored design compares unequal to its own catalogue entry.`);
  }
  if (JSON.stringify(stored) !== JSON.stringify(entry.design)) wouldHaveMinted++;
}

// 3. The revert. The defect was a one-line comparison, so the thing that brings
//    it back is a one-line edit, and no behavioural check above would notice:
//    sameValue would still be correct while the seed had stopped calling it.
const seedSrc = readFileSync(SEED, "utf8");
if (/JSON\.stringify\([^)]*\)\s*!==\s*JSON\.stringify\(/.test(seedSrc)) {
  bad("seed.ts compares with JSON.stringify again. That comparison is order-sensitive. C15 A25.");
}
if (!/sameValue\(/.test(seedSrc)) {
  bad("seed.ts no longer calls sameValue, so its comparison is no longer order-insensitive.");
}

if (failures) {
  console.error(`\n${failures} check(s) failed. Run the seed twice and count templateVersions:`);
  console.error("  npx convex run seed:ensureNeorgonTemplates");
  console.error("  npx convex data templateVersions --format jsonLines | wc -l");
  process.exit(1);
}

console.log(`seed-idempotence.test: ${NEORGON_TEMPLATES.length} catalogue designs survive the`);
console.log("  round trip through Convex key ordering, and seed.ts still uses sameValue.");
console.log(`  ${wouldHaveMinted} of ${NEORGON_TEMPLATES.length} would have minted a version under the old`);
console.log("  JSON.stringify comparison, so the guard is doing work rather than sitting idle.");

#!/usr/bin/env node
/**
 * The detector for the one relationship between two rate-limit buckets that a
 * reviewer cannot see by reading either one of them.
 *
 * CONTRACTS.md C15 A9 requires two limiters on claims:redeem, doing different
 * jobs: "claim.attempt" prices a guess at the 110-bit token space before the
 * lookup, and C14.3's "claim.redeem" stops a seat being burned by a double
 * click after the work. Both are in the code, and nothing in either one says
 * that the first has to be looser than the second.
 *
 * It does. If claim.attempt's max were at or below claim.redeem's, the attempt
 * limiter would always fire first and claim.redeem would become unreachable:
 * the C14.3 limiter would still be in the file, still be reviewed, and never
 * run. That is a silent regression a diff does not show, because it is a
 * property of two numbers in different rows.
 *
 * Static rather than live on purpose: it needs no deployment, so it can run in
 * the same sweep as test:enums.
 *
 * Exit codes, matching tests/enums.test.mjs:
 *   0  the relationship holds
 *   1  it does not, and the two numbers are printed
 *   2  a bucket or the file is missing, so nothing was compared.
 *      An empty sweep is a broken path, not a clean result.
 *
 * Run it with:  npm run test:limits   (from projects/sash-site)
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const LIMITS = resolve(here, "../lib/limits.ts");

if (!existsSync(LIMITS)) {
  console.error(`limits.test: the limit table is not on disk at ${LIMITS}.`);
  console.error("Nothing was compared. This is not a pass.");
  process.exit(2);
}

const src = readFileSync(LIMITS, "utf8");

/** Reads one row out of the LIMITS record. Text, not import: the file is TypeScript. */
function bucket(name) {
  const re = new RegExp(`"${name.replace(".", "\\.")}"\\s*:\\s*\\{\\s*max:\\s*(\\d+)\\s*,\\s*windowMs:\\s*([A-Za-z0-9_ *]+?)\\s*\\}`);
  const m = src.match(re);
  return m ? { max: Number(m[1]), windowMs: m[2].trim() } : null;
}

const attempt = bucket("claim.attempt");
const redeem = bucket("claim.redeem");

for (const [name, row] of [["claim.attempt", attempt], ["claim.redeem", redeem]]) {
  if (!row) {
    console.error(`limits.test: no "${name}" row in lib/limits.ts.`);
    console.error("C15 A9 requires both buckets to exist. Nothing was compared.");
    process.exit(2);
  }
}

let failures = 0;

if (!(attempt.max > redeem.max)) {
  console.error("FAIL  claim.attempt must be looser than claim.redeem.");
  console.error(`  claim.attempt: max ${attempt.max}`);
  console.error(`  claim.redeem:  max ${redeem.max}`);
  console.error("  At or below claim.redeem, the attempt limiter fires first on every");
  console.error("  honest caller and C14.3's redeem limiter never runs.");
  failures++;
}

if (attempt.windowMs !== redeem.windowMs) {
  console.error("FAIL  the two claim buckets use different windows.");
  console.error(`  claim.attempt: ${attempt.windowMs}`);
  console.error(`  claim.redeem:  ${redeem.windowMs}`);
  console.error("  Comparing their maxima only means something over the same window.");
  failures++;
}

if (failures) process.exit(1);

console.log(`limits.test: claim.attempt (${attempt.max}) is looser than claim.redeem`);
console.log(`  (${redeem.max}) over the same ${attempt.windowMs} window, so both limiters can fire.`);

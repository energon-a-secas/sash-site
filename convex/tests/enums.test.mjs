#!/usr/bin/env node
/**
 * The detector for the one deliberate duplication in the campaign.
 * DESIGN.md section 6.2 gap 6, CONTRACTS.md C2.10 and C7.
 *
 * The C7 enum lists are declared twice on purpose: once in
 * packages/neorgon-ui/insignia/schema.js, which the browser uses, and once in
 * projects/sash-site/convex/lib/design.ts, because the Convex runtime cannot
 * import packages/. A client-side validator is advice and a server-side one is
 * a control, so both have to exist. This asserts they say the same thing.
 *
 * Exit codes, following the sync scripts' own convention:
 *   0  the two files agree
 *   1  they disagree, and the mismatch is printed
 *   2  the kit is not on disk, so there was nothing to compare against.
 *      An empty sweep is a broken path, not a clean result.
 *
 * Run it with:  npm run test:enums   (from projects/sash-site)
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(here, "../lib/design.ts");
const KIT = resolve(here, "../../../../packages/neorgon-ui/insignia/schema.js");

/** The C7 lists that must be identical in both files, by export name. */
const ENUMS = [
  "KINDS", "ORIGINS", "CATEGORIES", "SPHERES", "ACCESS_LEVELS", "VISIBILITIES",
  "TEMPLATE_STATUSES", "ORIENTATIONS", "SHAPE_IDS", "METALS", "RING_STYLES",
  "PATTERN_KINDS", "PIP_STYLES", "FONT_ROLES", "CERT_BACKGROUNDS", "CERT_FRAMES",
  "AWARD_SOURCES", "AWARD_STATUSES", "IMPORT_PROVIDERS", "IMPORT_DIALECTS",
  "EXPORT_FORMATS", "WALLET_GROUPS", "CENTRE_KINDS", "PROVENANCE_MODES",
];

/**
 * Both files are read as text rather than imported: one is TypeScript that
 * node cannot load without a build, and importing the other would run kit code
 * this test has no business running. A regex over an array literal is enough
 * because both files declare these as flat string arrays.
 */
function extract(source, name) {
  const re = new RegExp(`export const ${name}\\s*(?::[^=]+)?=\\s*\\[([\\s\\S]*?)\\]`, "m");
  const m = source.match(re);
  if (!m) return null;
  return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
}

if (!existsSync(KIT)) {
  console.error(`enums.test: the kit schema is not on disk at ${KIT}.`);
  console.error("Nothing was compared. This is not a pass.");
  process.exit(2);
}
if (!existsSync(SERVER)) {
  console.error(`enums.test: the server validator is not on disk at ${SERVER}.`);
  process.exit(2);
}

const kitSrc = readFileSync(KIT, "utf8");
const serverSrc = readFileSync(SERVER, "utf8");

let failures = 0;
for (const name of ENUMS) {
  const kit = extract(kitSrc, name);
  const server = extract(serverSrc, name);
  if (kit === null) { console.error(`MISSING in the kit:    ${name}`); failures++; continue; }
  if (server === null) { console.error(`MISSING in convex:     ${name}`); failures++; continue; }
  const a = JSON.stringify(kit);
  const b = JSON.stringify(server);
  if (a !== b) {
    console.error(`DRIFT  ${name}`);
    console.error(`  kit:    ${a}`);
    console.error(`  convex: ${b}`);
    failures++;
  }
}

const kitVersion = kitSrc.match(/export const SCHEMA_VERSION\s*=\s*(\d+)/)?.[1];
const serverVersion = serverSrc.match(/export const SCHEMA_VERSION\s*=\s*(\d+)/)?.[1];
if (kitVersion !== serverVersion) {
  console.error(`DRIFT  SCHEMA_VERSION: kit ${kitVersion}, convex ${serverVersion}`);
  failures++;
}

if (failures) {
  console.error(`\n${failures} enum list(s) disagree between the kit and the server validator.`);
  process.exit(1);
}
console.log(`enums.test: ${ENUMS.length} enum lists and SCHEMA_VERSION agree between`);
console.log("  packages/neorgon-ui/insignia/schema.js");
console.log("  projects/sash-site/convex/lib/design.ts");

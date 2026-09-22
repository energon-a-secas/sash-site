#!/usr/bin/env node
/**
 * The detector for the site-mark fetch guard. Design round 2, plan section 3.2,
 * the checklist lines marked (guard).
 *
 * These exist to watch the guard refuse something. A guard nobody has seen
 * reject a request is an assumption, not a control. Every (guard) line in the
 * plan's checklist is a named group below, and inside each group every case
 * says which rule it exercises, so a reviewer ticking the list can find the
 * test for each tick.
 *
 * Three things it checks beyond the cases:
 *
 *   1. The module is imported by no action this round. `grep -r fetchGuard
 *      convex/` must return the module and this test. When artFetch.ts lands
 *      the round after, its path goes into EXPECTED_IMPORTERS below and the
 *      check keeps holding the set to exactly that.
 *   2. The module imports nothing. It is a pure leaf that bundles for either
 *      Convex runtime; the resolver and the socket belong to the action.
 *   3. The blocked v4 table is a copy of lockdown's, and the header says so.
 *      When projects/lockdown-site is on disk the two tables are compared and
 *      drift fails; when it is not, that one comparison is reported as skipped
 *      rather than counted as a pass.
 *
 * Exit codes, matching tests/enums.test.mjs:
 *   0  every case behaves
 *   1  at least one does not, and it is named
 *   2  the module could not be loaded, so nothing was checked. This runtime
 *      cannot import TypeScript before Node 22.18.
 *
 * Run it with:  node convex/tests/fetchGuard.test.mjs   (from projects/sash-site)
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join, relative } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const CONVEX = resolve(here, "..");
const GUARD = resolve(here, "../lib/fetchGuard.ts");
const LOCKDOWN = resolve(here, "../../../lockdown-site/convex/lib/guard.ts");

/** Files that may import the guard. Empty this round by design (plan 3.1). */
const EXPECTED_IMPORTERS = [];

if (!existsSync(GUARD)) {
  console.error(`fetchGuard.test: the guard is not on disk at ${GUARD}. Nothing was checked.`);
  process.exit(2);
}

let g;
try {
  g = await import(pathToFileURL(GUARD).href);
} catch (err) {
  console.error("fetchGuard.test: could not load lib/fetchGuard.ts directly.");
  console.error(`  ${err.message}`);
  console.error("Nothing was checked. This is not a pass. Node 22.18 or newer strips types natively.");
  process.exit(2);
}

let pass = 0, fail = 0, skipped = 0;
const ok = (label) => { console.log(`  ok    ${label}`); pass++; };
const bad = (label, why) => { console.log(`  FAIL  ${label}${why ? `: ${why}` : ""}`); fail++; };
const skip = (label, why) => { console.log(`  skip  ${label}: ${why}`); skipped++; };
const group = (title) => console.log(`\n${title}`);

/** admitUrl must refuse with exactly this code. */
function refusesUrl(label, raw, code) {
  const r = g.admitUrl(raw);
  if (r.ok) return bad(label, `${raw} was ADMITTED, expected refusal ${code}`);
  if (r.code !== code) return bad(label, `${raw} refused as ${r.code}, expected ${code}`);
  if (typeof r.message !== "string" || !r.message.trim()) return bad(label, "refusal carries no message");
  ok(`${label}  (${code})`);
}

/** admitUrl must admit, and hand back this host. */
function admitsUrl(label, raw, host) {
  const r = g.admitUrl(raw);
  if (!r.ok) return bad(label, `${raw} was REFUSED as ${r.code}: ${r.message}`);
  if (host !== undefined && r.host !== host) return bad(label, `host ${r.host}, expected ${host}`);
  if (!(r.url instanceof URL)) return bad(label, "admission carries no parsed URL");
  ok(label);
}

function refusesAnswer(label, answer, code) {
  const r = g.admitAnswer("example.com", answer);
  if (r.ok) return bad(label, `answer ${JSON.stringify(answer)} was ADMITTED, expected ${code}`);
  if (r.code !== code) return bad(label, `refused as ${r.code}, expected ${code}`);
  ok(`${label}  (${code})`);
}

function admitsAnswer(label, answer) {
  const r = g.admitAnswer("example.com", answer);
  if (!r.ok) return bad(label, `answer was REFUSED as ${r.code}: ${r.message}`);
  if (r.addresses.length !== answer.length) return bad(label, "admitted list is not the whole answer");
  ok(label);
}

const v4 = (address) => ({ address, family: 4 });
const v6 = (address) => ({ address, family: 6 });

// ── 3.2 URL admission, line 1 ─────────────────────────────────────────────────
group("3.2 URL admission (guard): parses; https only; no userinfo; port empty or 443; hostname has a dot; not an address literal");
refusesUrl("not a URL",                     "not a url",                          "bad-url");
refusesUrl("empty string",                  "",                                   "bad-url");
refusesUrl("http scheme",                   "http://example.com/",                "bad-scheme");
refusesUrl("file scheme",                   "file:///etc/passwd",                 "bad-scheme");
refusesUrl("gopher scheme",                 "gopher://example.com/",              "bad-scheme");
refusesUrl("data scheme",                   "data:text/html,hi",                  "bad-scheme");
refusesUrl("userinfo, name and password",   "https://user:pw@example.com/",       "userinfo");
refusesUrl("userinfo, name only",           "https://user@example.com/",          "userinfo");
refusesUrl("port 8443",                     "https://example.com:8443/",          "bad-port");
refusesUrl("port 80 on https",              "https://example.com:80/",            "bad-port");
admitsUrl("port 443 spelled out is the default", "https://example.com:443/",      "example.com");
refusesUrl("bare hostname, no dot",         "https://intranet/",                  "bare-host");
refusesUrl("bare hostname, trailing dot only", "https://com./",                   "bare-host");
refusesUrl("IPv4 literal, public",          "https://93.184.216.34/",             "ip-literal");
refusesUrl("IPv4 literal, metadata",        "https://169.254.169.254/latest/",    "ip-literal");
refusesUrl("IPv4 literal as one integer",   "https://2130706433/",                "ip-literal");
refusesUrl("IPv4 literal in hex",           "https://0x7f000001/",                "ip-literal");
refusesUrl("IPv4 literal, short form",      "https://127.1/",                     "ip-literal");
refusesUrl("IPv6 literal, loopback",        "https://[::1]/",                     "ip-literal");
refusesUrl("IPv6 literal, public",          "https://[2606:2800:220:1:248:1893:25c8:1946]/", "ip-literal");
refusesUrl("IPv6 literal, v4-mapped",       "https://[::ffff:127.0.0.1]/",        "ip-literal");
admitsUrl("plain https",                    "https://example.com/",               "example.com");
admitsUrl("subdomain, path and query",      "https://a.b.example.co.uk/p?q=1",    "a.b.example.co.uk");
admitsUrl("hostname is lowercased",         "https://EXAMPLE.com/",               "example.com");
admitsUrl("trailing dot is stripped from the host", "https://example.com./",      "example.com");

// ── 3.2 URL admission, line 2 ─────────────────────────────────────────────────
group("3.2 URL admission (guard): hostname does not end in localhost, .localhost, .local, .internal, .home.arpa, .arpa, .onion");
refusesUrl("localhost",                     "https://localhost/",                 "internal-host");
refusesUrl(".localhost suffix",             "https://app.localhost/",             "internal-host");
refusesUrl(".local suffix",                 "https://nas.local/",                 "internal-host");
refusesUrl(".internal suffix",              "https://vault.internal/",            "internal-host");
refusesUrl(".home.arpa suffix",             "https://router.home.arpa/",          "internal-host");
refusesUrl(".arpa suffix",                  "https://1.0.0.127.in-addr.arpa/",    "internal-host");
refusesUrl(".onion suffix",                 "https://example.onion/",             "internal-host");
refusesUrl("suffix with a trailing dot does not evade", "https://vault.internal./", "internal-host");
refusesUrl("suffix in upper case does not evade", "https://VAULT.INTERNAL/",      "internal-host");
admitsUrl("a suffix inside a label is not a suffix", "https://localhost.example.com/", "localhost.example.com");
admitsUrl("a public name ending in a similar word", "https://mylocal.example.com/", "mylocal.example.com");

// ── 3.2 URL admission, line 3 ─────────────────────────────────────────────────
group("3.2 URL admission (guard): CIDR arithmetic and v6 checks ported from lockdown, source named, a copy not an import");
{
  const src = readFileSync(GUARD, "utf8");
  if (/projects\/lockdown-site\/convex\/lib\/guard\.ts/.test(src)) ok("the header names projects/lockdown-site/convex/lib/guard.ts as the source");
  else bad("the header names the source", "no mention of projects/lockdown-site/convex/lib/guard.ts");

  if (/^\s*import\s/m.test(src)) bad("the module imports nothing", "an import statement is present");
  else ok("the module imports nothing, so it bundles for either runtime and is a copy, not a cross-project import");

  if (/from\s+["'][^"']*lockdown/.test(src)) bad("no import reaches across to lockdown", "an import from a lockdown path is present");
  else ok("no import reaches across to lockdown");

  const table = (text) => {
    const m = text.match(/BLOCKED_V4[^=]*=\s*\[([\s\S]*?)\n\];/);
    if (!m) return null;
    return [...m[1].matchAll(/\[\s*"([\d.]+)"\s*,\s*(\d+)\s*\]/g)].map((x) => `${x[1]}/${x[2]}`);
  };
  const mine = table(src);
  if (!mine || mine.length === 0) bad("BLOCKED_V4 is a parseable table", "could not read the table out of the module");
  else if (existsSync(LOCKDOWN)) {
    const theirs = table(readFileSync(LOCKDOWN, "utf8"));
    if (!theirs) bad("BLOCKED_V4 matches lockdown", "could not read lockdown's table");
    else if (JSON.stringify(mine) !== JSON.stringify(theirs)) {
      bad("BLOCKED_V4 matches lockdown", `\n    here:     ${mine.join(" ")}\n    lockdown: ${theirs.join(" ")}`);
    } else ok(`BLOCKED_V4 matches lockdown's table, ${mine.length} ranges`);
  } else skip("BLOCKED_V4 matches lockdown", "projects/lockdown-site is not on disk, the copy was not compared");

  // The exported table and the parsed text agree, so the test above is reading the real thing.
  const exported = g.BLOCKED_V4.map(([b, n]) => `${b}/${n}`);
  if (JSON.stringify(exported) === JSON.stringify(mine)) ok("the exported BLOCKED_V4 is the table the text check read");
  else bad("the exported BLOCKED_V4 is the table the text check read");
}

group("  the ported arithmetic, case by case");
{
  const int = (s, want) => { const got = g.v4ToInt(s); got === want ? ok(`v4ToInt ${s}`) : bad(`v4ToInt ${s}`, `${got}, expected ${want}`); };
  int("0.0.0.0", 0);
  int("127.0.0.1", 2130706433);
  int("255.255.255.255", 4294967295);
  int("256.0.0.1", null);
  int("1.2.3", null);
  int("1.2.3.4.5", null);
  int("a.b.c.d", null);
  int("01.2.3.4", 16909060);   // leading zero is still a decimal octet here; the URL parser never hands one over

  const cidr = (ip, base, bits, want) => {
    const got = g.inV4Cidr(g.v4ToInt(ip), base, bits);
    got === want ? ok(`${ip} ${want ? "in" : "not in"} ${base}/${bits}`) : bad(`${ip} in ${base}/${bits}`, `${got}`);
  };
  cidr("10.255.255.255", "10.0.0.0", 8, true);
  cidr("11.0.0.0", "10.0.0.0", 8, false);
  cidr("172.16.0.1", "172.16.0.0", 12, true);
  cidr("172.31.255.255", "172.16.0.0", 12, true);
  cidr("172.32.0.0", "172.16.0.0", 12, false);
  cidr("100.64.0.1", "100.64.0.0", 10, true);
  cidr("100.128.0.0", "100.64.0.0", 10, false);
  cidr("1.2.3.4", "0.0.0.0", 0, true);

  const blocked = (ip, want) => {
    const got = g.isBlockedV4Literal(ip);
    got === want ? ok(`isBlockedV4Literal ${ip} ${want}`) : bad(`isBlockedV4Literal ${ip}`, `${got}, expected ${want}`);
  };
  blocked("0.0.0.0", true);          // this host
  blocked("10.1.2.3", true);         // RFC1918
  blocked("100.100.0.1", true);      // CGNAT
  blocked("127.0.0.1", true);        // loopback
  blocked("127.255.1.2", true);      // loopback, far end
  blocked("169.254.169.254", true);  // link-local, metadata
  blocked("172.20.0.1", true);       // RFC1918
  blocked("192.0.0.1", true);        // IETF protocol assignments
  blocked("192.168.1.1", true);      // RFC1918
  blocked("198.18.0.1", true);       // benchmarking
  blocked("224.0.0.1", true);        // multicast
  blocked("240.0.0.1", true);        // reserved
  blocked("255.255.255.255", true);  // broadcast, inside 240/4
  blocked("93.184.216.34", false);   // public
  blocked("8.8.8.8", false);         // public
  blocked("172.32.0.1", false);      // just past 172.16/12
  blocked("not-an-ip", false);       // not a literal, this function does not judge names

  const b6 = (ip, want) => {
    const got = g.isBlockedV6(ip);
    got === want ? ok(`isBlockedV6 ${ip} ${want}`) : bad(`isBlockedV6 ${ip}`, `${got}, expected ${want}`);
  };
  b6("::", true);                          // unspecified
  b6("::1", true);                         // loopback
  b6("[::1]", true);                       // bracketed
  b6("fd00::1", true);                     // unique-local
  b6("fc00::1", true);                     // unique-local, low half
  b6("FD12:3456::1", true);                // upper case
  b6("fe80::1", true);                     // link-local
  b6("febf::1", true);                     // link-local, top of /10
  b6("fec0::1", false);                    // just past fe80::/10
  b6("::ffff:127.0.0.1", true);            // v4-mapped, dotted spelling
  b6("::ffff:7f00:1", true);               // v4-mapped, hex spelling, same address
  b6("::ffff:10.0.0.1", true);             // v4-mapped RFC1918, dotted
  b6("::ffff:a00:1", true);                // v4-mapped RFC1918, hex
  b6("::ffff:169.254.169.254", true);      // v4-mapped metadata, dotted
  b6("::ffff:a9fe:a9fe", true);            // v4-mapped metadata, hex
  b6("::ffff:93.184.216.34", false);       // v4-mapped public, dotted
  b6("::ffff:5db8:d822", false);           // v4-mapped public, hex
  b6("::ffff:zz:1", false);                // v4-mapped with garbage hex is not blocked by this function
  b6("2606:2800:220:1:248:1893:25c8:1946", false); // public
}

// ── 3.2 Resolution ────────────────────────────────────────────────────────────
group("3.2 Resolution (guard): an empty answer refuses; every returned address must pass the CIDR checks");
refusesAnswer("empty answer",                        [],                                        "no-address");
refusesAnswer("answer is not an array",              null,                                      "no-address");
refusesAnswer("private, RFC1918",                    [v4("10.0.0.5")],                          "private-address");
refusesAnswer("loopback",                            [v4("127.0.0.1")],                         "private-address");
refusesAnswer("link-local, cloud metadata",          [v4("169.254.169.254")],                   "private-address");
refusesAnswer("CGNAT",                               [v4("100.64.1.1")],                        "private-address");
refusesAnswer("multicast",                           [v4("224.0.0.1")],                         "private-address");
refusesAnswer("reserved",                            [v4("240.0.0.1")],                         "private-address");
refusesAnswer("v4-mapped private, dotted spelling",  [v6("::ffff:192.168.0.1")],                "private-address");
refusesAnswer("v4-mapped private, hex spelling",     [v6("::ffff:c0a8:1")],                     "private-address");
refusesAnswer("IPv6 loopback",                       [v6("::1")],                               "private-address");
refusesAnswer("IPv6 unique-local",                   [v6("fd00::1")],                           "private-address");
refusesAnswer("IPv6 link-local",                     [v6("fe80::1")],                           "private-address");
refusesAnswer("one public and one private, in that order",  [v4("93.184.216.34"), v4("10.0.0.1")], "private-address");
refusesAnswer("one private and one public, in that order",  [v4("127.0.0.1"), v4("93.184.216.34")], "private-address");
refusesAnswer("an address that is not an address",   [v4("nonsense")],                          "bad-address");
refusesAnswer("an octet out of range",               [v4("300.1.1.1")],                         "bad-address");
refusesAnswer("an entry with no address field",      [{ family: 4 }],                           "bad-address");
admitsAnswer("one public v4",                        [v4("93.184.216.34")]);
admitsAnswer("two public v4",                        [v4("93.184.216.34"), v4("93.184.216.35")]);
admitsAnswer("public v4 and public v6",              [v4("93.184.216.34"), v6("2606:2800:220:1:248:1893:25c8:1946")]);
admitsAnswer("v4-mapped public",                     [v6("::ffff:93.184.216.34")]);
{
  const r = g.admitAnswer("example.com", [v4("93.184.216.34"), v4("93.184.216.35")]);
  if (r.ok && r.host === "example.com" && r.addresses.join(",") === "93.184.216.34,93.184.216.35") ok("the admission hands back the host and every address that passed, in order, for the connection pin");
  else bad("the admission hands back the host and the addresses", JSON.stringify(r));
}

group("  resolveAdmitted through an injected lookup, so the action can pass dns.promises.lookup(host, { all: true })");
{
  const calls = [];
  const stub = (answer) => async (host) => { calls.push(host); return answer; };
  let r = await g.resolveAdmitted("example.com", stub([v4("93.184.216.34")]));
  if (r.ok && calls[0] === "example.com") ok("the lookup is called with the host and a public answer is admitted");
  else bad("public answer through the lookup", JSON.stringify(r));

  r = await g.resolveAdmitted("evil.example.com", stub([v4("169.254.169.254")]));
  if (!r.ok && r.code === "private-address") ok("a name resolving to the metadata address is refused  (private-address)");
  else bad("metadata through the lookup", JSON.stringify(r));

  r = await g.resolveAdmitted("rebind.example.com", stub([v4("93.184.216.34"), v4("10.0.0.1")]));
  if (!r.ok && r.code === "private-address") ok("a name resolving to a public and a private address is refused, every address must pass  (private-address)");
  else bad("mixed answer through the lookup", JSON.stringify(r));

  r = await g.resolveAdmitted("none.example.com", stub([]));
  if (!r.ok && r.code === "no-address") ok("an empty answer through the lookup is refused  (no-address)");
  else bad("empty answer through the lookup", JSON.stringify(r));

  r = await g.resolveAdmitted("gone.example.com", async () => { const e = new Error("getaddrinfo ENOTFOUND"); e.code = "ENOTFOUND"; throw e; });
  if (!r.ok && r.code === "no-address") ok("a resolver error is a refusal, not a throw  (no-address)");
  else bad("resolver error through the lookup", JSON.stringify(r));
}

// ── 3.1 Exported by no action ─────────────────────────────────────────────────
group("3.1 the guard is exported by no action: grep -r fetchGuard convex/ returns only the module and this test");
{
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (name === "_generated" || name === "node_modules") continue;
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (/\.(ts|js|mjs)$/.test(name)) files.push(full);
    }
  };
  walk(CONVEX);
  const mentions = files
    .filter((f) => readFileSync(f, "utf8").includes("fetchGuard"))
    .map((f) => relative(CONVEX, f))
    .filter((f) => f !== "lib/fetchGuard.ts" && f !== relative(CONVEX, fileURLToPath(import.meta.url)))
    .sort();
  const expected = [...EXPECTED_IMPORTERS].sort();
  if (JSON.stringify(mentions) === JSON.stringify(expected)) {
    ok(`${files.length} files under convex/ scanned, importers of the guard: ${mentions.length ? mentions.join(", ") : "none"}`);
  } else {
    bad("importers of the guard", `found ${mentions.join(", ") || "none"}, expected ${expected.join(", ") || "none"}. When artFetch.ts lands, add it to EXPECTED_IMPORTERS here.`);
  }
}

// ── C11.7 and A92 on every refusal message ────────────────────────────────────
group("C11.7 and A92: every refusal message avoids the accreditation vocabulary and names Sash, never the runtime");
{
  const inputs = [
    "not a url", "http://example.com/", "https://u:p@example.com/", "https://example.com:8443/",
    "https://intranet/", "https://127.0.0.1/", "https://[::1]/", "https://nas.local/", "https://com./",
  ];
  const messages = inputs.map((raw) => g.admitUrl(raw)).filter((r) => !r.ok).map((r) => r.message);
  for (const answer of [[], [v4("10.0.0.1")], [v4("nonsense")]]) {
    const r = g.admitAnswer("example.com", answer);
    if (!r.ok) messages.push(r.message);
  }
  const banned = /\b(certified|accredited|licensed|official)\b/i;
  const runtime = /\b(convex|deployment)\b/i;
  const dash = /\u2014/;   // the em dash, by code point, so this file does not carry the character
  let clean = true;
  for (const m of messages) {
    if (banned.test(m)) { bad("accreditation vocabulary", m); clean = false; }
    if (runtime.test(m)) { bad("runtime named in a visitor string", m); clean = false; }
    if (dash.test(m)) { bad("em dash in a visitor string", m); clean = false; }
  }
  if (messages.length < 10) { bad("enough refusal messages were collected to mean anything", `${messages.length}`); clean = false; }
  if (clean) ok(`${messages.length} distinct refusal messages checked`);
}

console.log(`\nfetchGuard.test: ${pass} passed, ${fail} failed, ${skipped} skipped`);
process.exit(fail === 0 ? 0 : 1);

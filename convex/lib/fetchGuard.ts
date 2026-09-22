/**
 * The admission guard for the site-mark fetch. Design round 2, plan section 3.2.
 *
 * The round after this one adds `convex/artFetch.ts`, a "use node" action that
 * fetches a page the template author names, finds its icon, and hands the bytes
 * back to the browser. An action that fetches a user-supplied URL from the
 * runtime's network is an open proxy unless something in front of it refuses
 * the addresses only the runtime can reach: loopback, the private ranges, the
 * link-local block where cloud instance metadata lives. This module is that
 * something, and it lands a round early so it is reviewed and tested before any
 * action exists to call it.
 *
 * **Exported by no action this round.** `grep -r fetchGuard convex/` returns
 * this file and its test, and tests/fetchGuard.test.mjs asserts it. When the
 * action lands, it is the only importer.
 *
 * Two halves, both pure, both tested without a deployment:
 *
 *   admitUrl(raw)             what may be asked for: https, no userinfo, port 443,
 *                             a dotted hostname that is not an address literal
 *                             and not on the internal-suffix list.
 *   admitAnswer(host, answer) what the name resolved to: every address the
 *                             resolver returned must sit outside the blocked
 *                             ranges, and an empty answer refuses.
 *
 * The resolver call itself (`dns.promises.lookup(host, { all: true })`) and
 * the connection pinned to an admitted address belong to the action, which is
 * where `node:dns` and `node:https` can be imported. This file imports nothing,
 * so it bundles for either Convex runtime and the lookup is injected in tests.
 *
 * The CIDR arithmetic, the blocked v4 table and the v6 checks are a copy of
 * projects/lockdown-site/convex/lib/guard.ts (`BLOCKED_V4`, `v4ToInt`,
 * `inV4Cidr`, `isBlockedV6` with v4-mapped addresses in both spellings). A
 * copy, not an import: the two projects are separate repos and a Convex
 * bundle cannot reach across them. The test compares the table against the
 * source when lockdown is on disk, so the copy cannot drift silently.
 *
 * Refusal messages are visitor strings (C11.7, A92): they name Sash, never the
 * runtime, and carry none of the accreditation vocabulary.
 *
 * What is not covered, so nobody reads more into this than it does: an IPv6
 * answer is checked as the string the resolver returned, which Node compresses
 * (`::1`, `fe80::1`, `::ffff:127.0.0.1`), and NAT64 (`64:ff9b::/96`) is not on
 * the list. Neither matters until a Convex runtime has an IPv6 route, and the
 * connection pin in the action is what makes the check hold between lookup and
 * connect either way.
 */

export type Refusal = { ok: false; code: string; message: string };
export type Admission = { ok: true; url: URL; host: string };
export type LookupAnswer = { address: string; family: number };
export type ResolvedAdmission = { ok: true; host: string; addresses: string[] };

function refuse(code: string, message: string): Refusal {
  return { ok: false, code, message };
}

/** Hostnames that never denote a site on the public internet. */
export const BLOCKED_HOST_SUFFIXES: readonly string[] = [
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
  ".arpa",
  ".onion",
];

/** IPv4 CIDRs that must never be reachable through the fetch. Copied from lockdown. */
export const BLOCKED_V4: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8],      // "this host"
  ["10.0.0.0", 8],     // RFC1918
  ["100.64.0.0", 10],  // CGNAT
  ["127.0.0.0", 8],    // loopback
  ["169.254.0.0", 16], // link-local, where cloud instance metadata lives
  ["172.16.0.0", 12],  // RFC1918
  ["192.0.0.0", 24],   // IETF protocol assignments
  ["192.168.0.0", 16], // RFC1918
  ["198.18.0.0", 15],  // benchmarking
  ["224.0.0.0", 4],    // multicast
  ["240.0.0.0", 4],    // reserved, and broadcast
];

/** Dotted quad to an unsigned 32-bit integer, or null when it is not one. */
export function v4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    out = (out << 8) + n;
  }
  return out >>> 0;
}

export function inV4Cidr(ip: number, base: string, bits: number): boolean {
  const b = v4ToInt(base);
  if (b === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ip & mask) === (b & mask);
}

/** True for a dotted quad inside any blocked range. False for anything that is not a dotted quad. */
export function isBlockedV4Literal(host: string): boolean {
  const ip = v4ToInt(host);
  if (ip === null) return false;
  return BLOCKED_V4.some(([base, bits]) => inV4Cidr(ip, base, bits));
}

/** True for any IPv6 literal the fetch refuses to reach. */
export function isBlockedV6(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "::" || h === "::1") return true;          // unspecified, loopback
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true;        // fc00::/7 unique-local
  if (/^fe[89ab][0-9a-f]:/.test(h)) return true;        // fe80::/10 link-local
  if (h.startsWith("::ffff:")) {
    // v4-mapped. The URL parser normalises ::ffff:127.0.0.1 to the hex form
    // ::ffff:7f00:1, so both spellings have to be handled here.
    const mapped = h.slice(7);
    if (mapped.includes(".")) return isBlockedV4Literal(mapped);
    const groups = mapped.split(":");
    if (groups.length !== 2) return false;
    const hi = parseInt(groups[0], 16);
    const lo = parseInt(groups[1], 16);
    if (Number.isNaN(hi) || Number.isNaN(lo)) return false;
    const asV4 = [(hi >> 8) & 255, hi & 255, (lo >> 8) & 255, lo & 255].join(".");
    return isBlockedV4Literal(asV4);
  }
  return false;
}

const V4_SHAPE = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * URL admission. Returns the parsed URL and the hostname the action should
 * resolve, or a refusal with a code the action returns verbatim.
 *
 * The hostname the WHATWG parser hands back is already lowercased and already
 * normalised: `https://2130706433/`, `https://0x7f000001/` and `https://127.1/`
 * all arrive as `127.0.0.1`, which is why the literal test runs on `url.hostname`
 * and not on the raw string. A single trailing dot is stripped before the
 * suffix test so `vault.internal.` cannot walk past `.internal`.
 */
export function admitUrl(raw: string): Admission | Refusal {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return refuse("bad-url", "That is not a URL Sash can read.");
  }

  if (url.protocol !== "https:") {
    return refuse("bad-scheme", "Sash fetches a site mark over https only.");
  }
  if (url.username || url.password) {
    return refuse("userinfo", "A URL carrying a username or password is not fetched.");
  }
  if (url.port !== "" && url.port !== "443") {
    return refuse("bad-port", "Sash fetches a site mark on port 443 only.");
  }

  const host = url.hostname.replace(/\.$/, "");
  if (!host) {
    return refuse("bad-url", "That URL has no hostname.");
  }
  if (host.startsWith("[") || V4_SHAPE.test(host)) {
    return refuse("ip-literal", "Sash fetches a site mark by hostname, not by address.");
  }
  if (host === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    return refuse("internal-host", "That hostname is not on the public internet.");
  }
  if (!host.includes(".")) {
    return refuse("bare-host", "Give the site's full hostname, with its domain.");
  }

  return { ok: true, url, host };
}

/**
 * One resolved address. Fails closed: a string that is neither a dotted quad
 * nor an IPv6 address is refused, not waved through.
 */
export function admitAddress(address: string): Refusal | null {
  const a = String(address ?? "").trim();
  if (V4_SHAPE.test(a)) {
    if (v4ToInt(a) === null) return refuse("bad-address", "That hostname resolved to an address Sash cannot read.");
    if (isBlockedV4Literal(a)) return refuse("private-address", privateMessage());
    return null;
  }
  if (a.includes(":")) {
    if (isBlockedV6(a)) return refuse("private-address", privateMessage());
    return null;
  }
  return refuse("bad-address", "That hostname resolved to an address Sash cannot read.");
}

function privateMessage(): string {
  return "That site resolves to a private or reserved address, which Sash does not reach.";
}

/**
 * The resolver's answer, checked. An empty answer refuses, and every address
 * must pass: a name that resolves to one public and one private address is a
 * rebinding attempt or a misconfiguration, and either way the fetch does not
 * happen. The addresses that passed come back so the action can pin its
 * connection to one of them.
 */
export function admitAnswer(host: string, answer: readonly LookupAnswer[]): ResolvedAdmission | Refusal {
  if (!Array.isArray(answer) || answer.length === 0) {
    return refuse("no-address", `Sash could not find an address for ${host}.`);
  }
  const addresses: string[] = [];
  for (const entry of answer) {
    const refusal = admitAddress(entry?.address);
    if (refusal) return refusal;
    addresses.push(entry.address);
  }
  return { ok: true, host, addresses };
}

/**
 * Resolution through an injected lookup, so the action passes
 * `(h) => dns.promises.lookup(h, { all: true })` and the test passes a stub.
 * A resolver error (ENOTFOUND, a timeout) is a refusal, not a throw.
 */
export async function resolveAdmitted(
  host: string,
  lookup: (host: string) => Promise<readonly LookupAnswer[]>,
): Promise<ResolvedAdmission | Refusal> {
  let answer: readonly LookupAnswer[];
  try {
    answer = await lookup(host);
  } catch {
    return refuse("no-address", `Sash could not find an address for ${host}.`);
  }
  return admitAnswer(host, answer);
}

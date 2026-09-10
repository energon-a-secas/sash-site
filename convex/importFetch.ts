"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { createHash } from "node:crypto";
import {
  ALLOWED_IMPORT_HOSTS, IMPORT_USER_AGENT, isAllowedImportHost, normalizeImportMeta,
} from "./lib/importMeta";

/**
 * The campaign's only outbound network call. CONTRACTS.md C9.4.
 *
 * It has to run here rather than in the browser: neither www.credly.com nor
 * api.credly.com sends any access-control-* header even with an explicit
 * Origin, so a page cannot read either. That is a structural constraint, not
 * an optimisation.
 *
 * The guard is a three-host allowlist rather than the SSRF blocklist in
 * projects/lockdown-site/convex/lib/guard.ts. An allowlist is strictly
 * stronger here and needs no CIDR arithmetic: nothing outside the three hosts
 * is reachable at all, so there is no private range to reason about.
 *
 * There is no wallet import, no profile import, no crawl and no scheduled
 * re-fetch. https://www.credly.com/users/<vanity>/badges.json returns a
 * complete wallet with no bot protection and it is not built, because Credly's
 * User Terms 4(b) prohibits exactly that.
 */

const CREDLY_BADGE_RE = /\/badges\/([0-9a-f-]{36})/i;
const FETCH_TIMEOUT_MS = 10_000;

type Fetched = { ok: true; json: any; url: string } | { ok: false; code: string; message: string };

async function getJson(url: string): Promise<Fetched> {
  if (!isAllowedImportHost(url)) {
    return {
      ok: false,
      code: "host-not-allowed",
      message: `Sash can only read badges from ${ALLOWED_IMPORT_HOSTS.join(", ")}.`,
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "manual",     // a redirect could leave the allowlist
      signal: controller.signal,
      headers: { "User-Agent": IMPORT_USER_AGENT, Accept: "application/json" },
    });
    if (res.status >= 300 && res.status < 400) {
      return { ok: false, code: "redirected", message: "That badge URL redirects, which Sash does not follow." };
    }
    if (!res.ok) {
      return { ok: false, code: "fetch-failed", message: `The issuer returned HTTP ${res.status}.` };
    }
    return { ok: true, json: await res.json(), url };
  } catch (err: any) {
    return {
      ok: false,
      code: err?.name === "AbortError" ? "timeout" : "fetch-failed",
      message: "Sash could not read that badge.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Turns whatever the user pasted into the assertion URL to GET. */
function assertionUrlFor(raw: string): string | null {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "https:") return null;

  if (url.hostname === "www.credly.com") {
    const m = url.pathname.match(CREDLY_BADGE_RE);
    if (!m) return null;
    // C9.4 path 1. The hosted assertion, not the wallet endpoint.
    return `https://api.credly.com/v1/obi/v2/badge_assertions/${m[1]}`;
  }
  return isAllowedImportHost(raw) ? raw : null;
}

function providerFor(host: string): "credly" | "badgr" | "openbadges" {
  if (host.endsWith("credly.com")) return "credly";
  if (host.endsWith("badgr.io")) return "badgr";
  return "openbadges";
}

function asString(x: any): string {
  return typeof x === "string" ? x : "";
}

function firstUrl(x: any): string | null {
  if (typeof x === "string" && /^https:\/\//i.test(x)) return x;
  if (x && typeof x === "object") {
    for (const key of ["id", "url", "href"]) {
      if (typeof x[key] === "string" && /^https:\/\//i.test(x[key])) return x[key];
    }
  }
  return null;
}

function isoOrNull(x: any): string | null {
  if (typeof x !== "string" || !x) return null;
  const ms = Date.parse(x);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/**
 * The ownership check, advisory and never a hard block. R2 could not reproduce
 * Credly's hash for the operator's own badge in three casings, and a genuine
 * badge may have been issued to an address the holder no longer controls. A
 * mismatch labels the row; it does not refuse it.
 */
function recipientMatches(recipient: any, emails: string[]): boolean {
  const identity = asString(recipient?.identity);
  if (!identity) return false;
  const salt = asString(recipient?.salt);
  const hashed = recipient?.hashed !== false;

  const candidates = new Set<string>();
  for (const email of emails) {
    for (const form of [email, email.toLowerCase(), email.trim()]) {
      if (!form) continue;
      candidates.add(form);
    }
  }
  for (const candidate of candidates) {
    if (!hashed) {
      if (identity === candidate || identity === `mailto:${candidate}`) return true;
      continue;
    }
    for (const algo of ["sha256", "sha1"]) {
      const digest = createHash(algo).update(salt ? candidate + salt : candidate).digest("hex");
      if (identity === `${algo}$${digest}`) return true;
      // Some issuers prepend the salt instead of appending it.
      const other = createHash(algo).update(salt ? salt + candidate : candidate).digest("hex");
      if (identity === `${algo}$${other}`) return true;
    }
  }
  return false;
}

/** Open Badges 2.0 and 3.0 both land in the one C9.5 shape. */
function normalise(assertion: any, badgeClass: any, sourceUrl: string, assertionUrl: string, emails: string[]) {
  const host = new URL(assertionUrl).hostname;
  const isV3 = Array.isArray(assertion?.type)
    ? assertion.type.includes("OpenBadgeCredential")
    : asString(assertion?.type) === "OpenBadgeCredential";

  const achievement = isV3 ? assertion?.credentialSubject?.achievement : null;
  const badge = badgeClass ?? (typeof assertion?.badge === "object" ? assertion.badge : null);
  const issuer = achievement?.creator ?? assertion?.issuer ?? badge?.issuer ?? null;

  const name = asString(achievement?.name ?? badge?.name ?? assertion?.name) || "Imported badge";
  const criteria = achievement?.criteria ?? badge?.criteria ?? null;

  return normalizeImportMeta({
    provider: providerFor(host),
    dialect: isV3 ? "ob3-jws" : "ob2-json",
    sourceUrl,
    assertionUrl,
    name,
    description: asString(achievement?.description ?? badge?.description),
    criteriaNarrative: asString(criteria?.narrative),
    criteriaUrl: firstUrl(criteria),
    skills: Array.isArray(badge?.tags) ? badge.tags.slice(0, 40).map(String) : [],
    issuerName: asString(issuer?.name) || host,
    issuerUrl: firstUrl(issuer?.url ?? issuer),
    issuerImageUrl: firstUrl(issuer?.image),
    imageUrl: firstUrl(badge?.image ?? achievement?.image ?? assertion?.image),
    issuedOn: isoOrNull(assertion?.issuedOn ?? assertion?.validFrom ?? assertion?.issuanceDate),
    expiresOn: isoOrNull(assertion?.expires ?? assertion?.validUntil ?? assertion?.expirationDate),
    recipientMatch: recipientMatches(assertion?.recipient, emails),
    verified: true,
    fetchedAt: new Date().toISOString(),
  });
}

/** Fetches an assertion, then at most one BadgeClass on the same host. */
export const resolve = internalAction({
  args: { url: v.string(), emails: v.array(v.string()) },
  handler: async (_ctx, { url, emails }) => {
    const assertionUrl = assertionUrlFor(url);
    if (!assertionUrl) {
      return {
        ok: false as const,
        code: "unsupported-url",
        message: `Paste a badge URL from ${ALLOWED_IMPORT_HOSTS.join(", ")}, or upload the badge file.`,
      };
    }

    const first = await getJson(assertionUrl);
    if (!first.ok) return { ok: false as const, code: first.code, message: first.message };

    const assertion = first.json;
    let badgeClass: any = null;
    const badgeUrl = typeof assertion?.badge === "string" ? assertion.badge : null;
    if (badgeUrl) {
      // The second fetch is allowed only on the host of the first one.
      const sameHost = (() => {
        try { return new URL(badgeUrl).hostname === new URL(assertionUrl).hostname; }
        catch { return false; }
      })();
      if (sameHost) {
        const second = await getJson(badgeUrl);
        if (second.ok) badgeClass = second.json;
        // A failed BadgeClass read is not fatal: the preview falls back to the
        // assertion-only fields rather than refusing the import.
      }
    }

    return {
      ok: true as const,
      preview: normalise(assertion, badgeClass, url, assertionUrl, emails),
    };
  },
});

/**
 * Runs after imports:save has already written the row. C9.5 requires the
 * server to rebuild the record from the issuer's own response rather than
 * trust the preview, and a mutation cannot fetch, so the row is written
 * unverified and this pass upgrades it. If the re-fetch fails, or the row was
 * hand-entered, it stays unverified, which is the honest outcome.
 */
export const reverify = internalAction({
  args: { awardPublicId: v.string(), emails: v.array(v.string()) },
  handler: async (ctx, { awardPublicId, emails }) => {
    const row: any = await ctx.runQuery(internal.imports.forReverify, { publicId: awardPublicId });
    if (!row || !row.importMeta?.assertionUrl) return { ok: false as const, code: "nothing-to-verify" };

    const meta = row.importMeta;
    const first = await getJson(meta.assertionUrl);
    if (!first.ok) return { ok: false as const, code: first.code };

    let badgeClass: any = null;
    const badgeUrl = typeof first.json?.badge === "string" ? first.json.badge : null;
    if (badgeUrl) {
      try {
        if (new URL(badgeUrl).hostname === new URL(meta.assertionUrl).hostname) {
          const second = await getJson(badgeUrl);
          if (second.ok) badgeClass = second.json;
        }
      } catch { /* a malformed badge URL is simply not followed */ }
    }

    const rebuilt = normalise(first.json, badgeClass, meta.sourceUrl, meta.assertionUrl, emails);
    await ctx.runMutation(internal.imports.applyReverify, {
      publicId: awardPublicId,
      meta: rebuilt,
    });
    return { ok: true as const, verified: true };
  },
});

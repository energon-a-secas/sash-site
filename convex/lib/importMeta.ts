import { IMPORT_DIALECTS, IMPORT_PROVIDERS } from "./design";

/**
 * The normalised import record. CONTRACTS.md C9.5.
 *
 * Every field is re-validated server-side by imports:save, which never trusts
 * the preview object it is handed, because a client can send anything. The
 * preview exists so the user can see what they are about to save, not so the
 * server can skip work.
 */

/** C9.4, frozen. Only these three hosts are reachable, and nothing else is. */
export const ALLOWED_IMPORT_HOSTS = ["api.credly.com", "www.credly.com", "api.badgr.io"] as const;

/** C9.4, frozen. Tested against Credly and returned 200. */
export const IMPORT_USER_AGENT =
  "NeorgonSash/1.0 (+https://sash.neorgon.com; badge import for the profile owner)";

export function isAllowedImportHost(raw: unknown): boolean {
  if (typeof raw !== "string" || !raw) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return (ALLOWED_IMPORT_HOSTS as readonly string[]).includes(url.hostname);
}

function httpsOrNull(p: string[], value: unknown, field: string) {
  if (value === null || value === undefined) return;
  if (typeof value !== "string" || !/^https:\/\//i.test(value)) {
    p.push(`${field} must be an https URL or null`);
  }
}

function isoOrNull(p: string[], value: unknown, field: string) {
  if (value === null || value === undefined) return;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    p.push(`${field} must be an ISO 8601 date or null`);
  }
}

function capped(p: string[], value: unknown, field: string, min: number, max: number) {
  if (typeof value !== "string") { p.push(`${field} must be a string`); return; }
  if (value.length < min) p.push(`${field} needs at least ${min} character`);
  if (value.length > max) p.push(`${field} is limited to ${max} characters`);
}

/** Returns an array of problems. An empty array means the record is storable. */
export function validateImportMeta(meta: any): string[] {
  const p: string[] = [];
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) {
    return ["the import record must be an object"];
  }

  if (!IMPORT_PROVIDERS.includes(meta.provider)) {
    p.push(`provider must be one of ${IMPORT_PROVIDERS.join(", ")}`);
  }
  if (!IMPORT_DIALECTS.includes(meta.dialect)) {
    p.push(`dialect must be one of ${IMPORT_DIALECTS.join(", ")}`);
  }
  if (typeof meta.sourceUrl !== "string" || !/^https:\/\//i.test(meta.sourceUrl)) {
    p.push("sourceUrl must be an https URL");
  }
  httpsOrNull(p, meta.assertionUrl, "assertionUrl");
  capped(p, meta.name, "name", 1, 160);
  capped(p, meta.description ?? "", "description", 0, 2000);
  capped(p, meta.criteriaNarrative ?? "", "criteriaNarrative", 0, 2000);
  httpsOrNull(p, meta.criteriaUrl, "criteriaUrl");

  if (!Array.isArray(meta.skills)) p.push("skills must be an array");
  else {
    if (meta.skills.length > 40) p.push("skills takes at most 40 items");
    for (const s of meta.skills) if (typeof s !== "string") p.push("every skill must be a string");
  }

  capped(p, meta.issuerName, "issuerName", 1, 120);
  httpsOrNull(p, meta.issuerUrl, "issuerUrl");
  httpsOrNull(p, meta.issuerImageUrl, "issuerImageUrl");
  httpsOrNull(p, meta.imageUrl, "imageUrl");
  isoOrNull(p, meta.issuedOn, "issuedOn");
  isoOrNull(p, meta.expiresOn, "expiresOn");

  if (typeof meta.recipientMatch !== "boolean") p.push("recipientMatch must be a boolean");
  if (typeof meta.verified !== "boolean") p.push("verified must be a boolean");
  // C15 A42.4. A record may arrive without fetchedAt and it is still valid.
  //
  // A15 ratified that a client-side parse omits fetchedAt, verified and
  // recipientMatch, and that the server fills them. This file required it
  // anyway, so a hand-entered or baked-file record was refused unless the
  // client invented a timestamp, and a timestamp a client asserts is evidence
  // of nothing. imports:save stamps it. What is still checked is the shape of
  // one that does arrive, since applyReverify hands a rebuilt record back
  // through here and that one is a real fetch time.
  isoOrNull(p, meta.fetchedAt, "fetchedAt");

  return p;
}

/**
 * Fills every optional field so a stored record always has the C9.5 shape.
 *
 * `stampedAt` is the server's own reading of the clock and it wins outright
 * when it is supplied, which is C15 A42.4: fetchedAt records when **this
 * deployment** last read the credential, so nothing a caller sends may set it.
 * The one caller that legitimately knows the answer is importFetch, which puts
 * its own timestamp in the record because it did the fetch.
 */
export function normalizeImportMeta(meta: any, stampedAt?: string) {
  return {
    provider: meta.provider,
    dialect: meta.dialect,
    sourceUrl: meta.sourceUrl,
    assertionUrl: meta.assertionUrl ?? null,
    name: String(meta.name).trim(),
    description: String(meta.description ?? "").trim(),
    criteriaNarrative: String(meta.criteriaNarrative ?? "").trim(),
    criteriaUrl: meta.criteriaUrl ?? null,
    skills: Array.isArray(meta.skills) ? meta.skills.map((s: any) => String(s)) : [],
    issuerName: String(meta.issuerName).trim(),
    issuerUrl: meta.issuerUrl ?? null,
    issuerImageUrl: meta.issuerImageUrl ?? null,
    imageUrl: meta.imageUrl ?? null,
    issuedOn: meta.issuedOn ?? null,
    expiresOn: meta.expiresOn ?? null,
    recipientMatch: !!meta.recipientMatch,
    verified: !!meta.verified,
    fetchedAt: stampedAt ?? (typeof meta.fetchedAt === "string" && meta.fetchedAt ? meta.fetchedAt : null),
  };
}

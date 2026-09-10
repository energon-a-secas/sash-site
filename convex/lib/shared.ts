/**
 * Small helpers every function file uses. No Convex registrations live here,
 * so this module is safe to import from a "use node" file as well.
 *
 * The error convention is CONTRACTS.md C2, and it is not a style preference:
 * an authentication failure throws, because the only thing a client can do
 * about it is offer sign in. Every other failure returns { ok:false, code },
 * because the client renders a specific message per code.
 */

export type Failure = { ok: false; code: string; message: string; [k: string]: unknown };
export type Success = { ok: true; [k: string]: unknown };

export function fail(code: string, message: string, extra: Record<string, unknown> = {}): Failure {
  return { ok: false, code, message, ...extra };
}

export function done(extra: Record<string, unknown> = {}): Success {
  return { ok: true, ...extra };
}

/** C14.1. Throws rather than returning, so the client offers sign in. */
export async function requireIdentity(ctx: {
  auth: { getUserIdentity: () => Promise<any> };
}): Promise<{ subject: string; email?: string; name?: string }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
}

/**
 * The public origin every server-built URL is rooted at. C8.5. It lives in an
 * environment variable so claims:create and the award shaper do not hard-code
 * the host in three files, and so a dev deployment cannot print a localhost
 * origin into an exported certificate.
 */
export function publicOrigin(): string {
  const raw = (process.env.SASH_PUBLIC_ORIGIN || "https://sash.neorgon.com").trim();
  return raw.replace(/\/+$/, "");
}

/** C4.4, frozen. The only place either site builds this string. */
export function verifyUrl(publicId: string): string {
  return `${publicOrigin()}/badge.html?id=${publicId}`;
}

/** C3.1, frozen. Returned by claims:create so the two sites cannot disagree. */
export function claimUrl(token: string): string {
  return `${publicOrigin()}/claim.html?t=${token}`;
}

/** ISO 8601 UTC with Z, or null. Every date crossing the wire uses this. */
export function toIso(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined) return null;
  return new Date(ms).toISOString();
}

const UTC_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * A date a person reads. CONTRACTS.md C3.3 asks the expired message for a
 * date, and C15 A42.2 records what shipping the stored number instead cost:
 * `This link expired on 2026-09-09T21:06:21.000Z.` is a machine artefact
 * handed to somebody at the moment something has just refused them.
 *
 * Built from UTC parts rather than through toLocaleDateString on purpose. The
 * server does not know the reader's timezone and cannot guess it, and a
 * locale-formatted string would also change with whatever ICU data the runtime
 * happens to carry. A page that knows better is free to re-render the same
 * instant in the reader's own zone; this is what the sentence says when
 * nothing does.
 */
export function dateText(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "an earlier date";
  const at = new Date(ms);
  return `${at.getUTCDate()} ${UTC_MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}`;
}

function unit(n: number, name: string): string {
  return `${n} ${name}${n === 1 ? "" : "s"}`;
}

/**
 * How long to wait, in the largest unit that does not lie. C15 A42.3.
 *
 * Every day-window bucket used to report "Try again in 1440 minutes", which
 * asks a person to divide at the one moment they are least inclined to: the
 * moment they have been refused. Every unit rounds **up**, because a retry
 * hint that under-states sends the caller straight back into the same refusal.
 */
export function retryAfterText(ms: number): string {
  const safe = typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? ms : 0;
  const minutes = Math.max(1, Math.ceil(safe / 60000));
  if (minutes < 60) return unit(minutes, "minute");
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return unit(hours, "hour");
  return unit(Math.ceil(hours / 24), "day");
}

/** Parses an ISO string to epoch ms, or null when it is absent or unparseable. */
export function fromIso(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * C14.4. Nothing is silently truncated: a cap that truncates teaches the user
 * their input was accepted when it was not. Returns null when the value fits.
 */
export function overCap(value: string, cap: number, field: string): Failure | null {
  if (value.length > cap) {
    return fail("too-long", `${field} is limited to ${cap} characters. Yours is ${value.length}.`);
  }
  return null;
}

export function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** C7.18. Computed server-side on every read, never stored. */
export function awardStatus(row: { revokedAt: number | null; expiresAt: number | null }, now: number):
  "valid" | "expired" | "revoked" {
  if (row.revokedAt !== null && row.revokedAt !== undefined) return "revoked";
  if (row.expiresAt !== null && row.expiresAt !== undefined && row.expiresAt <= now) return "expired";
  return "valid";
}

/** Clamps a client-supplied limit. Non-finite and non-positive fall back. */
export function clampLimit(raw: unknown, fallback: number, max: number): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

/**
 * A serialisation that does not depend on object key order, for comparing a
 * value read back out of Convex against the literal it was written from.
 *
 * **Convex returns an object's fields in alphabetical order, not the order they
 * were inserted in.** C15 A25 records what comparing them with a plain
 * JSON.stringify cost: seed.ts decided every catalogue design had changed on
 * every run, and minted a fresh row in templateVersions for all fifteen
 * entries each time, while reporting that nothing had been created. Those rows
 * are immutable and every award pins one, so two identical Neorgon awards
 * granted either side of a re-seed pinned different version numbers.
 *
 * Array order is preserved, because in a design an array's order is meaning:
 * `rings` paints back to front and `skills` is the author's ordering. Only
 * object keys are sorted.
 *
 * `undefined` answers the string "undefined" rather than the JS value, which
 * JSON can never produce, so an absent value and the literal null stay
 * distinguishable and the return type is honestly a string.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(stabilise(value)) ?? "undefined";
}

function stabilise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stabilise);
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = stabilise(source[key]);
    return out;
  }
  return value;
}

/** Deep equality that ignores object key order. The comparison C15 A25 needs. */
export function sameValue(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

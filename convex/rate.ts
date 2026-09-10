import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { fail, retryAfterText } from "./lib/shared";
import { LIMITS, type LimitName } from "./lib/limits";

export { LIMITS };
export type { LimitName };

/**
 * Server-side rate limiting, keyed by identity. CONTRACTS.md C14.2 and C14.3.
 *
 * Generalised from projects/lockdown-site/convex/rateLimit.ts: same sliding
 * window, same deletion of stale rows inside the window's own query so the
 * table stays bounded, and the same decision to return rather than throw so
 * the caller writes the user-facing message. The change is that the bucket
 * string and the two numbers are arguments, so one function serves every
 * bucket in lib/limits.ts instead of one copy of a limiter per bucket.
 *
 * docs/architecture/auth-flow.md records that most fleet sites have no
 * server-side throttle at all and trust a client-supplied visitorId. Every
 * bucket below starts with the Clerk subject, never with anything a client
 * sent.
 */

export type Verdict = {
  allowed: boolean;
  used: number;
  max: number;
  retryAfterMs: number;
};

/**
 * The implementation. Mutations call this directly so the check runs inside
 * the caller's own transaction; actions cannot touch the database and reach it
 * through the internalMutation below.
 */
export async function recordAndCheckCore(
  ctx: { db: any },
  bucket: string,
  max: number,
  windowMs: number,
): Promise<Verdict> {
  const now = Date.now();
  const cutoff = now - windowMs;

  const recent = await ctx.db
    .query("rateEvents")
    .withIndex("by_bucket_at", (q: any) => q.eq("bucket", bucket).gte("at", cutoff))
    .collect();

  // Drop anything already outside the window so the table stays bounded.
  const stale = await ctx.db
    .query("rateEvents")
    .withIndex("by_bucket_at", (q: any) => q.eq("bucket", bucket).lt("at", cutoff))
    .collect();
  for (const row of stale) await ctx.db.delete(row._id);

  if (recent.length >= max) {
    // The oldest event in the window is the one that has to age out.
    const oldest = recent.reduce((a: any, b: any) => (a.at <= b.at ? a : b));
    return {
      allowed: false,
      used: recent.length,
      max,
      retryAfterMs: Math.max(0, oldest.at + windowMs - now),
    };
  }

  await ctx.db.insert("rateEvents", { bucket, at: now });
  return { allowed: true, used: recent.length + 1, max, retryAfterMs: 0 };
}

/** C2.8. Internal only: actions reach the limiter through ctx.runMutation. */
export const recordAndCheck = internalMutation({
  args: { bucket: v.string(), max: v.number(), windowMs: v.number() },
  handler: async (ctx, { bucket, max, windowMs }) =>
    recordAndCheckCore(ctx, bucket, max, windowMs),
});

/**
 * The shape every limited mutation uses. Returns null when the call is within
 * budget and a ready-made C2 failure when it is not.
 */
export async function enforce(
  ctx: { db: any },
  subject: string,
  name: LimitName,
  thing: string,
  suffix?: string,
): Promise<ReturnType<typeof fail> | null> {
  const { max, windowMs } = LIMITS[name];
  const bucket = suffix ? `${subject}|${name}|${suffix}` : `${subject}|${name}`;
  const verdict = await recordAndCheckCore(ctx, bucket, max, windowMs);
  if (verdict.allowed) return null;
  // C15 A42.3. kudos.send, kudos.to and art.upload are day windows, so the
  // old fixed "minutes" said "Try again in 1440 minutes" every single time.
  return fail("rate-limited", `Too many ${thing}. Try again in ${retryAfterText(verdict.retryAfterMs)}.`, {
    retryAfterMs: verdict.retryAfterMs,
  });
}

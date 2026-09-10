import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { clampLimit, done, fail, requireIdentity } from "./lib/shared";
import { normalizeHandle } from "./lib/handles";
import { WALLET_GROUPS } from "./lib/design";
import { awardGroup, shapeAward } from "./lib/awards";
import { isAdminSubject } from "./lib/admin";
import { profileFor, profileForHandle } from "./profiles";

/** CONTRACTS.md C2.6. */

export async function awardByPublicId(ctx: any, publicId: string) {
  return await ctx.db
    .query("awards")
    .withIndex("by_public_id", (q: any) => q.eq("publicId", publicId))
    .first();
}

/**
 * A revoked award stays in the database and stays addressable here, because
 * deleting it would make a printed certificate point at a 404, which reads as
 * a broken site rather than a withdrawn credential. C3.5.
 */
export const byPublicId = query({
  args: { publicId: v.string() },
  handler: async (ctx, { publicId }) => {
    const row = await awardByPublicId(ctx, publicId);
    if (!row) return null;
    return await shapeAward(ctx, row);
  },
});

export const forHandle = query({
  args: { handle: v.string(), group: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const handle = normalizeHandle(args.handle);
    if (!handle) return [];
    const profile = await profileForHandle(ctx, handle);
    if (!profile) return [];

    const identity = await ctx.auth.getUserIdentity();
    const isOwner = !!identity && identity.subject === profile.clerkSubject;
    if (profile.visibility === "private" && !isOwner) return [];

    const group = WALLET_GROUPS.includes(args.group as any) ? args.group : "all";
    const limit = clampLimit(args.limit, 60, 200);

    const rows = await ctx.db
      .query("awards")
      .withIndex("by_holder", (q: any) => q.eq("holderSubject", profile.clerkSubject))
      .collect();

    const kept = [];
    for (const row of rows) {
      if (row.hidden) continue;
      // A revoked award is not listed on a wall. It stays reachable at its own
      // verify URL, which is where the revocation is explained.
      if (row.revokedAt !== null && row.revokedAt !== undefined) continue;
      if (group !== "all") {
        const template = row.templateId ? await ctx.db.get(row.templateId) : null;
        if (awardGroup(row, template) !== group) continue;
      }
      kept.push(row);
    }

    kept.sort((a: any, b: any) => b.issuedAt - a.issuedAt);
    return await Promise.all(kept.slice(0, limit).map((r: any) => shapeAward(ctx, r)));
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const profile = await profileFor(ctx, identity.subject);
    const showcase = profile?.showcase ?? [];

    const rows = await ctx.db
      .query("awards")
      .withIndex("by_holder", (q: any) => q.eq("holderSubject", identity.subject))
      .collect();
    rows.sort((a: any, b: any) => b.issuedAt - a.issuedAt);

    return await Promise.all(
      rows.map((r: any) => shapeAward(ctx, r, { includeOwn: true, showcase })),
    );
  },
});

export async function revokeCore(ctx: any, subject: string, publicId: string) {
  const row = await awardByPublicId(ctx, publicId);
  if (!row) return fail("not-found", "No award with that id.");

  const template = row.templateId ? await ctx.db.get(row.templateId) : null;
  const issuers = [row.issuedBy, template?.ownerSubject].filter(Boolean);
  if (!issuers.includes(subject) && !isAdminSubject(subject)) {
    return fail("not-authorised", "Only the issuer can revoke this award.");
  }
  if (row.revokedAt !== null && row.revokedAt !== undefined) return done();

  await ctx.db.patch(row._id, { revokedAt: Date.now() });
  return done();
}

export const revoke = mutation({
  args: { publicId: v.string() },
  handler: async (ctx, { publicId }) => {
    const identity = await requireIdentity(ctx);
    return await revokeCore(ctx, identity.subject, publicId);
  },
});

// ── Internal read for the Open Badges signer ─────────────────────────────────

/**
 * ob:credentialFor is a "use node" action, and an action cannot touch the
 * database, so it reads through here. It returns only what C9.2 puts inside
 * the credential: no email, no subject, nothing that is not already public on
 * the verify page.
 */
export const forCredential = internalQuery({
  args: { publicId: v.string() },
  handler: async (ctx, { publicId }) => {
    const row = await awardByPublicId(ctx, publicId);
    if (!row) return null;
    const shaped = await shapeAward(ctx, row);
    return {
      holderSubject: row.holderSubject,
      source: row.source,
      award: {
        publicId: shaped.publicId,
        name: shaped.name,
        description: shaped.description,
        criteria: shaped.criteria,
        issuerHandle: shaped.issuerHandle,
        holderHandle: shaped.holderHandle,
        issuedAt: shaped.issuedAt,
        expiresAt: shaped.expiresAt,
        status: shaped.status,
        verifyUrl: shaped.verifyUrl,
      },
    };
  },
});

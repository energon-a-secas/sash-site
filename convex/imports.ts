import { action, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { done, fail, requireIdentity, retryAfterText } from "./lib/shared";
import { LIMITS } from "./lib/limits";
import { mintPublicId } from "./ids";
import {
  isAllowedImportHost, normalizeImportMeta, validateImportMeta,
} from "./lib/importMeta";
import { profileFor } from "./profiles";

/** CONTRACTS.md C2.8 and C9.4. */

function emailsOf(identity: any): string[] {
  const out: string[] = [];
  if (typeof identity?.email === "string" && identity.email) out.push(identity.email);
  return out;
}

/**
 * Writes nothing. The outbound fetch itself lives in importFetch.ts, which
 * carries "use node"; a "use node" file can only export actions, and this file
 * also has to export mutations, so the two are split. The public name is the
 * one C2.8 froze and the client shim uses.
 */
export const fetchPreview = action({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    const identity = await requireIdentity(ctx);

    // An action cannot touch the database, so the limiter is reached through
    // its internalMutation. This bucket is the one that leaves our network.
    const { max, windowMs } = LIMITS["import.fetch"];
    const verdict = await ctx.runMutation(internal.rate.recordAndCheck, {
      bucket: `${identity.subject}|import.fetch`,
      max,
      windowMs,
    });
    if (!verdict.allowed) {
      return fail("rate-limited", `Too many imports. Try again in ${retryAfterText(verdict.retryAfterMs)}.`, {
        retryAfterMs: verdict.retryAfterMs,
      });
    }

    return await ctx.runAction(internal.importFetch.resolve, {
      url,
      emails: emailsOf(identity),
    });
  },
});

export async function saveCore(ctx: any, subject: string, preview: any) {
  const profile = await profileFor(ctx, subject);
  if (!profile?.handle) return fail("no-handle", "Pick a handle before importing a credential.");

  const problems = validateImportMeta(preview);
  if (problems.length) return fail("invalid", problems[0], { problems });

  // C15 A42.4. fetchedAt is when this deployment read the credential, so the
  // server stamps it and a value the caller sent is discarded. A record that
  // arrives without one is now valid: a browser parse of a baked file has
  // nothing honest to put there, and A15 already ratified that it omits it.
  const meta = normalizeImportMeta(preview, new Date().toISOString());

  // Never trust a client-asserted trust flag. C9.5 requires the server to
  // rebuild the record from the issuer's own response; a mutation cannot
  // fetch, so the row lands unverified and importFetch:reverify upgrades it.
  meta.verified = false;
  meta.recipientMatch = false;

  // C15 A40. **The allowlist gates verification, not acceptance.**
  //
  // This used to refuse the save outright, and the case that proved it wrong
  // is Sash's own export: a baked SVG carrying a real signed VC-JWT, with
  // id https://sash.neorgon.com/badge.html?id=<publicId>, parsed and previewed
  // and then could not be saved, because sash.neorgon.com is not one of the
  // three hosts on a list whose entire purpose is deciding where an **outbound
  // fetch** may go. The baked-file path makes no fetch at all.
  //
  // So an off-allowlist assertion URL stores, unverified, exactly as C9.4 path
  // 4 already describes for a hand-entered record. verified is false above for
  // every record that lands here, and the reverify pass is what can raise it,
  // which is only schedulable for a host this deployment may actually GET.
  const reverifiable = isAllowedImportHost(meta.assertionUrl);

  const publicId = await mintPublicId(ctx, "awards");
  if (!publicId) return fail("id-collision", "Could not mint a public id. Try again.");

  const issuedAt = meta.issuedOn ? Date.parse(meta.issuedOn) : Date.now();
  const expiresAt = meta.expiresOn ? Date.parse(meta.expiresOn) : null;

  await ctx.db.insert("awards", {
    publicId,
    holderSubject: subject,
    // An imported credential has no Sash template and no pinned version.
    templateId: null,
    versionId: null,
    claimId: null,                      // C15 A5. An import is minted by no link.
    count: 1,
    issuedAt: Number.isFinite(issuedAt) ? issuedAt : Date.now(),
    expiresAt: expiresAt !== null && Number.isFinite(expiresAt) ? expiresAt : null,
    issuedBy: subject,
    issuerSite: null,
    source: "import",
    importMeta: meta,
    evidenceUrl: meta.sourceUrl,
    hidden: false,
    revokedAt: null,
  });

  return { result: done({ awardPublicId: publicId }), reverify: reverifiable, publicId };
}

export const save = mutation({
  args: { preview: v.any() },
  handler: async (ctx, { preview }) => {
    const identity = await requireIdentity(ctx);
    const outcome = await saveCore(ctx, identity.subject, preview);
    if ("ok" in outcome) return outcome;   // a failure came straight back
    if (outcome.reverify) {
      await ctx.scheduler.runAfter(0, internal.importFetch.reverify, {
        awardPublicId: outcome.publicId,
        emails: emailsOf(identity),
      });
    }
    return outcome.result;
  },
});

export async function removeCore(ctx: any, subject: string, publicId: string) {
  const row = await ctx.db
    .query("awards")
    .withIndex("by_public_id", (q: any) => q.eq("publicId", publicId))
    .first();
  if (!row) return fail("not-found", "No award with that id.");
  if (row.holderSubject !== subject) {
    return fail("not-authorised", "Only the holder can remove an imported credential.");
  }
  if (row.source !== "import") {
    return fail("invalid", "Only an imported credential can be removed. Ask the issuer to revoke a Sash award.");
  }
  await ctx.db.delete(row._id);
  return done();
}

export const remove = mutation({
  args: { publicId: v.string() },
  handler: async (ctx, { publicId }) => {
    const identity = await requireIdentity(ctx);
    return await removeCore(ctx, identity.subject, publicId);
  },
});

// ── The re-verification pass, internal ───────────────────────────────────────

export const forReverify = internalQuery({
  args: { publicId: v.string() },
  handler: async (ctx, { publicId }) => {
    const row = await ctx.db
      .query("awards")
      .withIndex("by_public_id", (q: any) => q.eq("publicId", publicId))
      .first();
    if (!row || row.source !== "import") return null;
    return { publicId: row.publicId, importMeta: row.importMeta };
  },
});

export const applyReverify = internalMutation({
  args: { publicId: v.string(), meta: v.any() },
  handler: async (ctx, { publicId, meta }) => {
    const row = await ctx.db
      .query("awards")
      .withIndex("by_public_id", (q: any) => q.eq("publicId", publicId))
      .first();
    if (!row || row.source !== "import") return { ok: false };

    const problems = validateImportMeta(meta);
    if (problems.length) {
      console.warn(`applyReverify refused a rebuilt record for ${publicId}: ${problems[0]}`);
      return { ok: false };
    }
    await ctx.db.patch(row._id, { importMeta: normalizeImportMeta(meta) });
    return { ok: true };
  },
});

import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { done, fail, requireIdentity } from "./lib/shared";
import { enforce } from "./rate";
import { loadOwned } from "./templates";

/**
 * Badge art. CONTRACTS.md C10.
 *
 * SVG is refused. Convex serves the uploaded Content-Type verbatim with no
 * Content-Disposition, no X-Content-Type-Options and no Content-Security-Policy
 * (measured on a live deployment), so a stored SVG would let any signed-in user
 * host script on the convex.cloud subdomain that also serves this deployment's
 * /api/query, /api/mutation and /api/action endpoints. A user who wants vector
 * art has the shape and glyph catalogue, which is the point of C1.
 */

export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_ART_BYTES = 512 * 1024;
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * The authorisation point for uploads, and the only one: the URL it returns is
 * a bearer credential valid for an hour, so the check has to happen here
 * rather than at attach time.
 */
export async function getUploadUrlCore(ctx: any, subject: string) {
  const limited = await enforce(ctx, subject, "art.upload", "uploads");
  if (limited) return limited;
  return done({ url: await ctx.storage.generateUploadUrl() });
}

export const getUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    return await getUploadUrlCore(ctx, identity.subject);
  },
});

export async function attachCore(ctx: any, subject: string, templateId: any, storageId: any) {
  const { row, error } = await loadOwned(ctx, subject, templateId);
  if (error) return error;

  // The declared type is never trusted. This reads what Convex recorded.
  const meta = await ctx.db.system.get("_storage", storageId);
  if (!meta) return fail("not-found", "That upload is not in storage.");

  if (!meta.contentType || !ACCEPTED_TYPES.includes(meta.contentType)) {
    await ctx.storage.delete(storageId);
    return fail(
      "bad-type",
      `Badge art must be a PNG, a JPEG or a WEBP. This upload is ${meta.contentType || "of no declared type"}.`,
    );
  }
  if (typeof meta.size === "number" && meta.size > MAX_ART_BYTES) {
    await ctx.storage.delete(storageId);
    return fail("too-large", `Badge art is capped at ${MAX_ART_BYTES} bytes. This upload is ${meta.size}.`);
  }

  const previous = row.artStorageId;
  await ctx.db.patch(row._id, { artStorageId: storageId, updatedAt: Date.now() });

  if (previous && previous !== storageId) {
    // C10.4. Deleting on replace is right only for a draft, which has no
    // versions and no awards. A template with any version is still serving the
    // old file to already-issued certificates, so the old id is left alone and
    // the daily sweep will never see it as an orphan.
    const anyVersion = await ctx.db
      .query("templateVersions")
      .withIndex("by_template_n", (q: any) => q.eq("templateId", row._id))
      .first();
    if (!anyVersion && row.status === "draft") {
      await ctx.storage.delete(previous);
    }
  }

  return done({ artRef: String(storageId) });
}

export const attach = mutation({
  args: { templateId: v.id("templates"), storageId: v.id("_storage") },
  handler: async (ctx, { templateId, storageId }) => {
    const identity = await requireIdentity(ctx);
    return await attachCore(ctx, identity.subject, templateId, storageId);
  },
});

/** Every storage id a design document points at, including an embedded seal. */
function designRefs(design: any, into: Set<string>) {
  if (!design || typeof design !== "object") return;
  const ref = design?.centre?.imageRef;
  if (typeof ref === "string" && ref) into.add(ref);
  if (design?.seal?.design) designRefs(design.seal.design, into);
}

/**
 * C10.4. The sweep exists because the upload flow has three requests and a
 * user can close the tab between the POST and art:attach, leaving a file
 * nothing will ever reference. The 24 hour age condition is what stops it
 * deleting a file in that window rather than after it.
 *
 * Its return value is the signal: DESIGN.md 6.2 gap 7 names { deleted } as the
 * only evidence that orphans are not quietly eating the shared 1 GB.
 */
export const sweepOrphans = internalMutation({
  args: {},
  handler: async (ctx) => {
    const referenced = new Set<string>();

    for (const t of await ctx.db.query("templates").collect()) {
      if (t.artStorageId) referenced.add(String(t.artStorageId));
      designRefs(t.design, referenced);
    }
    for (const v of await ctx.db.query("templateVersions").collect()) {
      designRefs(v.design, referenced);
    }

    const cutoff = Date.now() - ORPHAN_AGE_MS;
    let deleted = 0;
    for (const file of await ctx.db.system.query("_storage").collect()) {
      if (referenced.has(String(file._id))) continue;
      if (file._creationTime > cutoff) continue;
      await ctx.storage.delete(file._id);
      deleted++;
    }
    if (deleted > 0) console.warn(`art:sweepOrphans deleted ${deleted} unreferenced files`);
    return { deleted };
  },
});

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { done, fail, requireIdentity } from "./lib/shared";
import { KINDS, MAX_DESIGN_BYTES, SCHEMA_VERSION } from "./lib/design";
import { isAdminSubject } from "./lib/admin";
import { loadOwned } from "./templates";

/**
 * CONTRACTS.md C2.4.
 *
 * versions:saveDraft writes the working design onto the templates row.
 * A templateVersions row is created only by templates:publish, and no mutation
 * anywhere patches one. That is what makes a version immutable, and awards pin
 * versionId, so an issued badge cannot change under its holder.
 */

async function mayRead(ctx: any, template: any): Promise<boolean> {
  if (template.status === "published") return true;
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  return identity.subject === template.ownerSubject || isAdminSubject(identity.subject);
}

export const list = query({
  args: { templateId: v.id("templates") },
  handler: async (ctx, { templateId }) => {
    const template = await ctx.db.get(templateId);
    if (!template) return [];
    if (!(await mayRead(ctx, template))) return [];

    const rows = await ctx.db
      .query("templateVersions")
      .withIndex("by_template_n", (q: any) => q.eq("templateId", templateId))
      .collect();
    return rows
      .sort((a: any, b: any) => a.n - b.n)
      .map((r: any) => ({
        versionId: r._id, n: r.n, changelog: r.changelog,
        createdAt: r.createdAt, createdBy: r.createdBy,
      }));
  },
});

export const get = query({
  args: { versionId: v.id("templateVersions") },
  handler: async (ctx, { versionId }) => {
    const row = await ctx.db.get(versionId);
    if (!row) return null;
    const template = await ctx.db.get(row.templateId);
    if (!template) return null;
    if (!(await mayRead(ctx, template))) return null;
    return { n: row.n, design: row.design, changelog: row.changelog, createdAt: row.createdAt };
  },
});

export async function saveDraftCore(ctx: any, subject: string, templateId: any, design: any) {
  const { row, error } = await loadOwned(ctx, subject, templateId);
  if (error) return error;

  // Full C1 validation belongs to publish, which is the last point before a
  // version is frozen. A draft still has to be storable, so the three checks a
  // bad draft could break the row with are enforced here.
  if (typeof design !== "object" || design === null || Array.isArray(design)) {
    return fail("invalid-design", "A design must be an object.");
  }
  if (design.schemaVersion !== SCHEMA_VERSION) {
    return fail("invalid-design", `schemaVersion must equal ${SCHEMA_VERSION}.`);
  }
  if (!KINDS.includes(design.kind)) {
    return fail("invalid-design", `kind must be one of ${KINDS.join(", ")}.`);
  }
  const bytes = new TextEncoder().encode(JSON.stringify(design) ?? "").length;
  if (bytes > MAX_DESIGN_BYTES) {
    return fail("too-long", `The design is ${bytes} bytes, over the ${MAX_DESIGN_BYTES} byte cap.`);
  }

  await ctx.db.patch(row._id, { design, updatedAt: Date.now() });
  return done();
}

export const saveDraft = mutation({
  args: { templateId: v.id("templates"), design: v.any() },
  handler: async (ctx, { templateId, design }) => {
    const identity = await requireIdentity(ctx);
    return await saveDraftCore(ctx, identity.subject, templateId, design);
  },
});

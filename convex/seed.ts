import { internalMutation } from "./_generated/server";
import { mintPublicId } from "./ids";
import { validateDesign } from "./lib/design";
import { NEORGON_TEMPLATES } from "./data/catalog";
import { SYSTEM_SUBJECT } from "./lib/grants";
import { sameValue } from "./lib/shared";

/**
 * CONTRACTS.md C2.9. Run it from the CLI:
 *   npx convex run seed:ensureNeorgonTemplates
 *
 * Internal, and it stays internal. It is the only writer of origin "neorgon",
 * so a public version of it would let anyone mint a first-party badge. That is
 * the exact mistake docs/architecture/auth-flow.md:60-61 records for
 * auth:seedAdmin.
 *
 * Idempotent: it upserts by the stable slug in data/catalog.ts and never
 * duplicates. A new version is minted only when the design actually changed,
 * because templateVersions is immutable and every awarded badge pins one.
 *
 * C15 A25. "Actually changed" is decided by sameValue, not by JSON.stringify.
 * Convex returns an object's fields in alphabetical order and data/catalog.ts
 * builds them in the order badge() writes them, so the two strings never
 * matched and this function used to mint fifteen immutable versions on every
 * run while reporting created 0. The failure was invisible from the return
 * value and only ever showed up by counting rows, which is how it was found
 * and how it stays found: run the seed twice and count templateVersions.
 *
 * The alternative fix, alphabetising the catalogue's own keys at the source,
 * was declined on purpose. It works today and hides the defect permanently,
 * because the next hand-written design in any key order brings it straight
 * back with nothing to notice it.
 */
export const ensureNeorgonTemplates = internalMutation({
  args: {},
  handler: async (ctx) => {
    let created = 0;
    let updated = 0;
    const skipped: string[] = [];

    const existing = await ctx.db
      .query("templates")
      .withIndex("by_owner", (q: any) => q.eq("ownerSubject", SYSTEM_SUBJECT))
      .collect();

    for (const entry of NEORGON_TEMPLATES) {
      const problems = validateDesign(entry.design);
      if (problems.length) {
        console.warn(`seed: skipping ${entry.slug}, its design is invalid: ${problems[0]}`);
        skipped.push(entry.slug);
        continue;
      }

      const now = Date.now();
      const meta = {
        kind: entry.kind,
        name: entry.name,
        description: entry.description,
        criteria: entry.criteria,
        skills: entry.skills,
        category: entry.category,
        sphere: entry.sphere,
        access: entry.access,
        stackable: entry.stackable,
      };

      const row = existing.find((t: any) => t.slug === entry.slug);

      if (!row) {
        const publicId = await mintPublicId(ctx, "templates");
        if (!publicId) { skipped.push(entry.slug); continue; }
        const templateId = await ctx.db.insert("templates", {
          ...meta,
          publicId,
          ownerSubject: SYSTEM_SUBJECT,
          origin: "neorgon",
          seats: null,
          allowList: [],
          // C15 A4, written explicitly so no writer in the tree leaves the
          // column absent. A Neorgon grant does not expire, and CatalogEntry
          // (D1's) carries no validity, so null is the only value it can take.
          defaultValidityMs: null,
          status: "published",
          design: entry.design,
          slug: entry.slug,
          currentVersionId: null,
          artStorageId: null,
          issuerSite: null,
          createdAt: now,
          updatedAt: now,
        });
        const versionId = await ctx.db.insert("templateVersions", {
          templateId,
          n: 1,
          design: entry.design,
          changelog: "seeded",
          createdBy: SYSTEM_SUBJECT,
          createdAt: now,
        });
        await ctx.db.patch(templateId, { currentVersionId: versionId });
        created++;
        continue;
      }

      // Both comparisons cross the same boundary: row.* came back out of
      // Convex in alphabetical order, meta.* and entry.design are the source
      // literals in their own order. Neither may use JSON.stringify. C15 A25.
      const designChanged = !sameValue(row.design, entry.design);
      const metaChanged = (Object.keys(meta) as Array<keyof typeof meta>)
        .some((k) => !sameValue(row[k], meta[k]));
      if (!designChanged && !metaChanged) continue;

      const patch: Record<string, unknown> = { ...meta, updatedAt: now };
      if (designChanged) {
        patch.design = entry.design;
        const previous = await ctx.db
          .query("templateVersions")
          .withIndex("by_template_n", (q: any) => q.eq("templateId", row._id))
          .order("desc")
          .first();
        const versionId = await ctx.db.insert("templateVersions", {
          templateId: row._id,
          n: (previous?.n ?? 0) + 1,
          design: entry.design,
          changelog: "seeded",
          createdBy: SYSTEM_SUBJECT,
          createdAt: now,
        });
        patch.currentVersionId = versionId;
      }
      await ctx.db.patch(row._id, patch);
      updated++;
    }

    if (skipped.length) console.warn(`seed: skipped ${skipped.join(", ")}`);
    return { created, updated };
  },
});

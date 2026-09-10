import { mintPublicId } from "../ids";

/**
 * The Neorgon badge grant helper. CONTRACTS.md C2.9.
 *
 * Neorgon badges are granted inside the mutation that makes them true, not by
 * a sweep on read, because an award has to be a row with a public id and a
 * verify URL. guild-hall-site recomputes its badges on every render; that
 * pattern cannot produce a credential.
 *
 * A no-op when the holder already has the award, when the slug is not in the
 * seeded catalogue, or when the seeded template has not been published yet.
 * None of those is an error the calling mutation should fail on: nobody should
 * be unable to redeem a claim link because a seed row is missing.
 */

export const SYSTEM_SUBJECT = "system";

export async function grantNeorgon(
  ctx: { db: any },
  subject: string,
  slug: string,
): Promise<string | null> {
  const templates = await ctx.db
    .query("templates")
    .withIndex("by_owner", (q: any) => q.eq("ownerSubject", SYSTEM_SUBJECT))
    .collect();

  const template = templates.find((t: any) => t.slug === slug);
  if (!template) {
    console.warn(`grantNeorgon: no seeded template for slug ${slug}. Run seed:ensureNeorgonTemplates.`);
    return null;
  }
  if (!template.currentVersionId) {
    console.warn(`grantNeorgon: seeded template ${slug} has no published version.`);
    return null;
  }

  const existing = await ctx.db
    .query("awards")
    .withIndex("by_holder_template", (q: any) =>
      q.eq("holderSubject", subject).eq("templateId", template._id))
    .first();
  if (existing) return existing.publicId;

  const publicId = await mintPublicId(ctx, "awards");
  if (!publicId) {
    console.warn(`grantNeorgon: could not mint a public id for ${slug}`);
    return null;
  }

  await ctx.db.insert("awards", {
    publicId,
    holderSubject: subject,
    templateId: template._id,
    versionId: template.currentVersionId,
    claimId: null,                      // C15 A5. A grant is minted by no link.
    count: 1,
    issuedAt: Date.now(),
    expiresAt: null,
    issuedBy: SYSTEM_SUBJECT,
    issuerSite: null,
    source: "earned",
    importMeta: null,
    evidenceUrl: null,
    hidden: false,
    revokedAt: null,
  });
  return publicId;
}

/** Counts a holder's awards without loading them all into a shaped result. */
export async function awardCount(ctx: { db: any }, subject: string): Promise<number> {
  const rows = await ctx.db
    .query("awards")
    .withIndex("by_holder", (q: any) => q.eq("holderSubject", subject))
    .collect();
  return rows.length;
}

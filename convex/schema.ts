import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Sash and Enamel share this one deployment. CONTRACTS.md C8.1: the convex
 * folder lives here and nowhere else, and enamel-site points a
 * ConvexHttpClient at this deployment's URL.
 *
 * Tables are CONTRACTS.md C2.1 verbatim, with two additive fields that C2's
 * own prose requires and that its table listing omits. Both are flagged in
 * B1's report for delivery-lead to ratify:
 *
 *   templates.design  C2.4 says "versions:saveDraft writes the working design
 *                     onto the template row, not into templateVersions". The
 *                     C2.1 listing has no column to write it to, so nothing in
 *                     C2.3 or C2.4 could work without this field.
 *   templates.slug    C2.9 says ensureNeorgonTemplates "upserts by a stable
 *                     slug embedded in data/catalog.ts" and grantNeorgon takes
 *                     a slug. Without a persisted slug the upsert would have to
 *                     match on the display name, which is exactly the kind of
 *                     match that drifts. Null on every community template.
 *
 * CONTRACTS.md C15 then added two more, brokered rather than invented, and
 * both are B2's:
 *
 *   templates.defaultValidityMs  A4. C3.3 says claims:redeem copies expiresAt
 *                     "from the template's defaultValidityMs if set else null"
 *                     and C2.1 defines no such column, so every claimed award
 *                     was non-expiring. Optional, and null means "does not
 *                     expire". Absence is never "expires now".
 *   awards.claimId    A5. Without it an award cannot be attributed to the link
 *                     that minted it, so claims:claimants over-reported on any
 *                     template carrying more than one live link. Null on every
 *                     award that no claim link minted.
 *
 * No other table exists in v1. The Neorgon templates are ordinary templates
 * rows with origin "neorgon" and ownerSubject "system".
 */
export default defineSchema({
  profiles: defineTable({
    clerkSubject: v.string(),
    handle: v.string(),                 // lowercase, C4.2
    displayName: v.string(),
    headline: v.string(),
    bio: v.string(),
    avatarCode: v.union(v.string(), v.null()),
    visibility: v.string(),             // C7.6
    showcase: v.array(v.string()),      // ordered award publicIds
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_subject", ["clerkSubject"])
    .index("by_handle", ["handle"]),

  templates: defineTable({
    publicId: v.string(),               // C4.1
    ownerSubject: v.string(),
    kind: v.string(),                   // C7.1
    name: v.string(),
    description: v.string(),
    criteria: v.string(),
    skills: v.array(v.string()),
    origin: v.string(),                 // C7.2
    category: v.string(),               // C7.3
    sphere: v.union(v.string(), v.null()),  // C7.4, non-null only when category is recognition
    access: v.string(),                 // C7.5
    seats: v.union(v.number(), v.null()),
    allowList: v.array(v.string()),
    status: v.string(),                 // C7.6b
    stackable: v.boolean(),
    design: v.any(),                    // the working draft, see the header note
    slug: v.union(v.string(), v.null()),// seed identity, see the header note
    // C15 A4. Optional, so a row written before the amendment reads as absent
    // rather than as zero. Absent and null both mean "the award does not
    // expire"; only a positive number gives an award an expiry.
    defaultValidityMs: v.optional(v.union(v.number(), v.null())),
    currentVersionId: v.union(v.id("templateVersions"), v.null()),
    artStorageId: v.union(v.id("_storage"), v.null()),
    issuerSite: v.union(v.string(), v.null()),  // reserved, always null in v1
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_public_id", ["publicId"])
    .index("by_owner", ["ownerSubject"])
    .index("by_status_category", ["status", "category"]),

  // IMMUTABLE once written. No mutation patches a row in this table, ever.
  templateVersions: defineTable({
    templateId: v.id("templates"),
    n: v.number(),                      // 1-based, monotonic per template
    design: v.any(),                    // a C1 design document
    changelog: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
  }).index("by_template_n", ["templateId", "n"]),

  awards: defineTable({
    publicId: v.string(),               // C4.1
    holderSubject: v.string(),
    // Null exactly when source is "import": an imported credential has no Sash
    // template and no pinned version. C2.1 types both as required ids and C2.6
    // requires source "import" rows to exist, so one of the two had to give.
    // Flagged in B1's report.
    templateId: v.union(v.id("templates"), v.null()),
    versionId: v.union(v.id("templateVersions"), v.null()),
    // C15 A5. The claim link that minted this award, null on every award that
    // no link minted (a kudos, a Neorgon grant, an import). Required rather
    // than optional on purpose: a new insert site that forgets it fails the
    // schema instead of quietly writing an award no link can claim.
    claimId: v.union(v.id("claims"), v.null()),
    count: v.number(),                  // 1 for non-stackable, N for stackable
    issuedAt: v.number(),
    expiresAt: v.union(v.number(), v.null()),
    issuedBy: v.string(),               // a clerkSubject, or the literal "system"
    issuerSite: v.union(v.string(), v.null()),  // reserved, always null in v1
    source: v.string(),                 // C7.17
    importMeta: v.union(v.any(), v.null()),     // C9.5, non-null only when source is import
    evidenceUrl: v.union(v.string(), v.null()),
    hidden: v.boolean(),
    revokedAt: v.union(v.number(), v.null()),
  })
    .index("by_public_id", ["publicId"])
    .index("by_holder", ["holderSubject"])
    .index("by_template", ["templateId"])
    .index("by_holder_template", ["holderSubject", "templateId"]),

  claims: defineTable({
    token: v.string(),                  // C4.3
    templateId: v.id("templates"),
    expiresAt: v.number(),
    maxUses: v.union(v.number(), v.null()),
    uses: v.number(),
    allowList: v.array(v.string()),     // lowercase handles, empty means open
    createdBy: v.string(),
    createdAt: v.number(),
    revokedAt: v.union(v.number(), v.null()),
  })
    .index("by_token", ["token"])
    .index("by_template", ["templateId"])
    // C15 A55. Without it claims:mine collected every claim row in the
    // deployment and filtered createdBy in JavaScript, so one issuer opening
    // their links list read every other issuer's rows and the query failed
    // outright once the table passed Convex's per-query read limit. Rows are
    // unchanged: this is an index addition, not a migration.
    .index("by_creator", ["createdBy"]),

  kudos: defineTable({
    fromSubject: v.string(),
    toSubject: v.string(),
    templateId: v.id("templates"),
    awardId: v.id("awards"),
    message: v.string(),                // 0 to 240 chars
    createdAt: v.number(),
  })
    .index("by_award", ["awardId"])
    .index("by_to_template", ["toSubject", "templateId"])
    .index("by_from_at", ["fromSubject", "createdAt"]),

  rateEvents: defineTable({
    bucket: v.string(),                 // "<subject>|<action>"
    at: v.number(),
  }).index("by_bucket_at", ["bucket", "at"]),
});

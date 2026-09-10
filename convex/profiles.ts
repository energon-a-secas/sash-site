import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { done, fail, overCap, requireIdentity, trimmed } from "./lib/shared";
import { handleProblem, normalizeHandle } from "./lib/handles";
import { VISIBILITIES } from "./lib/design";
import { enforce } from "./rate";
import { grantNeorgon } from "./lib/grants";
import { isAdminSubject } from "./lib/admin";

/** CONTRACTS.md C2.2. */

const EARLY_ADOPTER_CUTOFF = 500;

export async function profileFor(ctx: any, subject: string) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_subject", (q: any) => q.eq("clerkSubject", subject))
    .first();
}

export async function profileForHandle(ctx: any, handle: string) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_handle", (q: any) => q.eq("handle", handle))
    .first();
}

function shapeMine(row: any) {
  return {
    handle: row.handle,
    displayName: row.displayName,
    headline: row.headline,
    bio: row.bio,
    avatarCode: row.avatarCode,
    visibility: row.visibility,
    showcase: row.showcase,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isAdmin: isAdminSubject(row.clerkSubject),
  };
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const row = await profileFor(ctx, identity.subject);
    return row ? shapeMine(row) : null;
  },
});

/**
 * The PublicProfile shaper. C2.2, plus C15 A39.
 *
 * Split from the query so testkit:read can call it with an explicit viewer,
 * because `npx convex run` carries no identity and the owner-sees-their-own
 * -private-profile branch is otherwise unreachable from the command line. Same
 * function the public query calls, so a rule proved here is the rule that
 * ships.
 *
 * **`visibility` is checked once, at the top, and it gates the whole object.**
 * A private profile answers null to anyone but its owner, so there is no field
 * on this shape that a stranger can read off a private profile: not the bio,
 * not the counts, and not the showcase A39 added.
 */
export async function byHandleCore(ctx: any, viewerSubject: string | null, handle: string) {
  const wanted = normalizeHandle(handle);
  if (!wanted) return null;
  const row = await profileForHandle(ctx, wanted);
  if (!row) return null;

  const isOwner = !!viewerSubject && viewerSubject === row.clerkSubject;
  // "unlisted" returns the profile and is only excluded from listings.
  if (row.visibility === "private" && !isOwner) return null;

  const awards = await ctx.db
    .query("awards")
    .withIndex("by_holder", (q: any) => q.eq("holderSubject", row.clerkSubject))
    .collect();

  const counts = { neorgon: 0, community: 0, recognition: 0, imported: 0 };
  const listable = new Set<string>();
  for (const a of awards) {
    if (a.revokedAt !== null || a.hidden) continue;
    listable.add(a.publicId);
    if (a.source === "import") { counts.imported++; continue; }
    const template = a.templateId ? await ctx.db.get(a.templateId) : null;
    if (template?.category === "recognition") counts.recognition++;
    else if (template?.origin === "neorgon") counts.neorgon++;
    else counts.community++;
  }

  // C15 A39. Without this the pin order a person sets is invisible to everyone
  // but themselves, and "choose what to show proudly" is a private bookmark.
  //
  // Filtered to the awards this profile would actually list, in the stored
  // order. Two reasons, and the first is the one that matters: a public id is
  // a capability. awards:byPublicId answers for a hidden award, so publishing
  // the raw array would hand a stranger the id of a credential its holder
  // chose to hide and undo setAwardHidden. The second is that counts on this
  // same object already skips hidden and revoked, so an unfiltered showcase
  // would disagree with the object it travels on.
  const showcase = (row.showcase ?? []).filter((id: string) => listable.has(id));

  return {
    handle: row.handle,
    displayName: row.displayName,
    headline: row.headline,
    bio: row.bio,
    avatarCode: row.avatarCode,
    counts,
    showcase,
  };
}

export const byHandle = query({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const identity = await ctx.auth.getUserIdentity();
    return await byHandleCore(ctx, identity?.subject ?? null, handle);
  },
});

// ── claimHandle ──────────────────────────────────────────────────────────────

export async function claimHandleCore(ctx: any, subject: string, rawHandle: string) {
  const limited = await enforce(ctx, subject, "handle.claim", "handle attempts");
  if (limited) return limited;

  const handle = normalizeHandle(rawHandle);
  const problem = handleProblem(handle);
  if (problem === "handle-invalid") {
    return fail("handle-invalid", "A handle is 2 to 30 characters, lowercase letters, digits and hyphens, and starts with a letter or a digit.");
  }
  if (problem === "handle-reserved") {
    return fail("handle-reserved", `The handle ${handle} is reserved.`);
  }

  const mine = await profileFor(ctx, subject);
  if (mine) {
    // C4.2: a handle is claimed once. It is printed into every rendered
    // artefact and sits inside every signed credential, so a rename would have
    // to reach files that have already been downloaded.
    return fail("already-set", "Your handle is set and cannot be changed.");
  }

  const taken = await profileForHandle(ctx, handle);
  if (taken) return fail("handle-taken", `The handle ${handle} is taken.`);

  // C15 A55. `.take(EARLY_ADOPTER_CUTOFF)` answers the same question as the
  // `.collect()` that used to sit here, with a bound. The question is not "how
  // many profiles exist", it is "have we reached the cutoff", and take returns
  // min(total, cutoff): below the cutoff it returns the true total and the
  // comparison is unchanged; at or above it returns exactly the cutoff, so
  // `length < cutoff` is false, which is what `total < cutoff` was. The two
  // predicates agree for every table size, and this one reads at most 500 rows
  // instead of the whole table.
  //
  // Worth the words because of what the unbounded read cost: claiming a handle
  // is the onboarding path of both sites, so once `profiles` passed Convex's
  // per-query read limit **nobody could create a profile at all**, and it
  // would have failed only for people who had no account yet.
  //
  // Read before the insert, deliberately: the cutoff counts the profiles that
  // existed before this one, so the 500th person to claim a handle is granted
  // and the 501st is not.
  const existingProfiles = await ctx.db.query("profiles").take(EARLY_ADOPTER_CUTOFF);
  const now = Date.now();
  await ctx.db.insert("profiles", {
    clerkSubject: subject,
    handle,
    displayName: "",
    headline: "",
    bio: "",
    avatarCode: null,
    visibility: "public",
    showcase: [],
    createdAt: now,
    updatedAt: now,
  });

  if (existingProfiles.length < EARLY_ADOPTER_CUTOFF) {
    await grantNeorgon(ctx, subject, "early-adopter");
  }
  return done({ handle });
}

export const claimHandle = mutation({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const identity = await requireIdentity(ctx);
    return await claimHandleCore(ctx, identity.subject, handle);
  },
});

// ── updateMine ───────────────────────────────────────────────────────────────

export type ProfilePatch = {
  displayName?: string;
  headline?: string;
  bio?: string;
  avatarCode?: string | null;
  visibility?: string;
};

export async function updateMineCore(ctx: any, subject: string, patch: ProfilePatch) {
  const row = await profileFor(ctx, subject);
  if (!row) return fail("not-found", "Pick a handle before editing your profile.");

  const next: Record<string, unknown> = {};

  if (patch.displayName !== undefined) {
    const value = trimmed(patch.displayName);
    const over = overCap(value, 60, "displayName");
    if (over) return over;
    next.displayName = value;
  }
  if (patch.headline !== undefined) {
    const value = trimmed(patch.headline);
    const over = overCap(value, 120, "headline");
    if (over) return over;
    next.headline = value;
  }
  if (patch.bio !== undefined) {
    const value = trimmed(patch.bio);
    const over = overCap(value, 600, "bio");
    if (over) return over;
    next.bio = value;
  }
  if (patch.avatarCode !== undefined) {
    if (patch.avatarCode === null) next.avatarCode = null;
    else {
      const value = trimmed(patch.avatarCode);
      const over = overCap(value, 200, "avatarCode");
      if (over) return over;
      next.avatarCode = value || null;
    }
  }
  if (patch.visibility !== undefined) {
    if (!VISIBILITIES.includes(patch.visibility as any)) {
      // C2.2's code list has no member for a bad enum value. Flagged in B1's report.
      return fail("invalid", `visibility must be one of ${VISIBILITIES.join(", ")}.`);
    }
    next.visibility = patch.visibility;
  }

  next.updatedAt = Date.now();
  await ctx.db.patch(row._id, next);

  const after = await ctx.db.get(row._id);
  if (after.displayName && after.headline && after.avatarCode) {
    await grantNeorgon(ctx, subject, "profile-complete");
  }
  return done();
}

export const updateMine = mutation({
  args: {
    displayName: v.optional(v.string()),
    headline: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarCode: v.optional(v.union(v.string(), v.null())),
    visibility: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    return await updateMineCore(ctx, identity.subject, args);
  },
});

// ── setShowcase ──────────────────────────────────────────────────────────────

export async function setShowcaseCore(ctx: any, subject: string, awardPublicIds: string[]) {
  const row = await profileFor(ctx, subject);
  if (!row) return fail("not-found", "Pick a handle before setting a showcase.");

  if (awardPublicIds.length > 24) {
    return fail("too-long", "A showcase holds at most 24 awards.");
  }

  const seen = new Set<string>();
  for (const publicId of awardPublicIds) {
    if (seen.has(publicId)) return fail("invalid", `${publicId} appears twice in the showcase.`);
    seen.add(publicId);
    const award = await ctx.db
      .query("awards")
      .withIndex("by_public_id", (q: any) => q.eq("publicId", publicId))
      .first();
    if (!award) return fail("not-found", `No award with the id ${publicId}.`);
    if (award.holderSubject !== subject) {
      return fail("not-authorised", "A showcase can only hold your own awards.");
    }
  }

  await ctx.db.patch(row._id, { showcase: awardPublicIds, updatedAt: Date.now() });
  return done();
}

export const setShowcase = mutation({
  args: { awardPublicIds: v.array(v.string()) },
  handler: async (ctx, { awardPublicIds }) => {
    const identity = await requireIdentity(ctx);
    return await setShowcaseCore(ctx, identity.subject, awardPublicIds);
  },
});

// ── setAwardHidden ───────────────────────────────────────────────────────────

export async function setAwardHiddenCore(
  ctx: any, subject: string, awardPublicId: string, hidden: boolean,
) {
  const award = await ctx.db
    .query("awards")
    .withIndex("by_public_id", (q: any) => q.eq("publicId", awardPublicId))
    .first();
  if (!award) return fail("not-found", "No award with that id.");
  if (award.holderSubject !== subject) {
    return fail("not-authorised", "Only the holder can hide an award.");
  }
  await ctx.db.patch(award._id, { hidden });
  return done();
}

export const setAwardHidden = mutation({
  args: { awardPublicId: v.string(), hidden: v.boolean() },
  handler: async (ctx, { awardPublicId, hidden }) => {
    const identity = await requireIdentity(ctx);
    return await setAwardHiddenCore(ctx, identity.subject, awardPublicId, hidden);
  },
});

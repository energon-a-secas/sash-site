import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { claimUrl, dateText, done, fail, requireIdentity, toIso } from "./lib/shared";
import { TOKEN_RE, mintPublicId, mintToken } from "./ids";
import { enforce } from "./rate";
import { isAdminSubject } from "./lib/admin";
import { profileFor } from "./profiles";
import { grantNeorgon } from "./lib/grants";

/** CONTRACTS.md C2.5 and C3. */

async function claimByToken(ctx: any, token: string) {
  return await ctx.db
    .query("claims")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .first();
}

function claimState(row: any, now: number): "ok" | "expired" | "exhausted" | "revoked" {
  if (row.revokedAt !== null && row.revokedAt !== undefined) return "revoked";
  if (now >= row.expiresAt) return "expired";
  if (row.maxUses !== null && row.maxUses !== undefined && row.uses >= row.maxUses) return "exhausted";
  return "ok";
}

function shapeClaim(row: any) {
  return {
    claimId: row._id,
    token: row.token,
    url: claimUrl(row.token),
    templateId: row.templateId,
    expiresAt: row.expiresAt,
    maxUses: row.maxUses,
    uses: row.uses,
    usesLeft: row.maxUses === null || row.maxUses === undefined
      ? null
      : Math.max(0, row.maxUses - row.uses),
    allowList: row.allowList,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
    state: claimState(row, Date.now()),
  };
}

// ── create ───────────────────────────────────────────────────────────────────

export async function createCore(
  ctx: any, subject: string,
  args: { templateId: any; expiresAt: number; maxUses: number | null; allowList: string[] },
) {
  const limited = await enforce(ctx, subject, "claim.create", "claim links");
  if (limited) return limited;

  const template = await ctx.db.get(args.templateId);
  if (!template) return fail("not-found", "No such template.");
  if (template.ownerSubject !== subject && !isAdminSubject(subject)) {
    return fail("not-authorised", "Only the owner can mint a claim link for this template.");
  }
  if (!Number.isFinite(args.expiresAt) || args.expiresAt <= Date.now()) {
    return fail("invalid", "A claim link needs an expiry in the future.");
  }
  if (args.maxUses !== null && (!Number.isInteger(args.maxUses) || args.maxUses < 1)) {
    return fail("invalid", "maxUses is a positive whole number, or null for unlimited.");
  }
  if (args.allowList.length > 200) {
    return fail("too-long", "An allow list holds at most 200 handles.");
  }

  const token = await mintToken(ctx);
  if (!token) return fail("id-collision", "Could not mint a token. Try again.");

  await ctx.db.insert("claims", {
    token,
    templateId: args.templateId,
    expiresAt: args.expiresAt,
    maxUses: args.maxUses,
    uses: 0,
    allowList: args.allowList.map((h) => String(h).trim().toLowerCase()).filter(Boolean),
    createdBy: subject,
    createdAt: Date.now(),
    revokedAt: null,
  });

  // The URL is built server-side from SASH_PUBLIC_ORIGIN so the two sites
  // cannot disagree about its shape. C3.1.
  return done({ token, url: claimUrl(token) });
}

export const create = mutation({
  args: {
    templateId: v.id("templates"),
    expiresAt: v.number(),
    maxUses: v.union(v.number(), v.null()),
    allowList: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    return await createCore(ctx, identity.subject, args);
  },
});

// ── mine ─────────────────────────────────────────────────────────────────────

/**
 * C2.5: "signed-in, own claims only".
 *
 * **C15 A55.** The no-template branch used to be `query("claims").collect()`,
 * every claim row in the deployment, filtered on `createdBy` in JavaScript
 * afterwards. That read one issuer's links by reading all of them, and once
 * `claims` passed Convex's per-query read limit it stopped answering for
 * everybody at once. A55 added the `by_creator` index this now walks, so the
 * read is bounded by the caller's own link count and touches no other
 * issuer's row at all.
 *
 * The `templateId` branch still walks `by_template`, which is the tighter
 * bound for that question: `createCore` refuses a link on a template the
 * caller does not own, so the rows under one template are that owner's rows.
 * The `createdBy` filter below is therefore load-bearing on that branch only,
 * where it is the authorisation check that makes "own claims only" true for a
 * caller who passes somebody else's `templateId`. On the `by_creator` branch
 * it is already true of every row read and cannot remove one. **Residual:** a
 * caller passing a `templateId` they do not own still reads that template's
 * rows before discarding them. Nothing leaves the function, and the read is
 * bounded by one template. Closing it exactly needs a compound
 * `by_creator_template` index, which is more than A55 ruled.
 */
export async function mineCore(ctx: any, subject: string, templateId?: any) {
  const rows = templateId
    ? await ctx.db.query("claims")
        .withIndex("by_template", (q: any) => q.eq("templateId", templateId)).collect()
    : await ctx.db.query("claims")
        .withIndex("by_creator", (q: any) => q.eq("createdBy", subject)).collect();

  return rows
    .filter((r: any) => r.createdBy === subject)
    .sort((a: any, b: any) => b.createdAt - a.createdAt)
    .map(shapeClaim);
}

export const mine = query({
  args: { templateId: v.optional(v.id("templates")) },
  handler: async (ctx, { templateId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await mineCore(ctx, identity.subject, templateId);
  },
});

// ── preview ──────────────────────────────────────────────────────────────────

/**
 * Consumes nothing, needs no identity, and answers a dead token with a state
 * rather than a null so claim.html can say why instead of showing a 404. It
 * returns null only when the token string does not match C4.3.
 *
 * **This is the one unauthenticated read of a claim link, so what it omits is
 * the point.** It answers about the badge on offer and about the link's own
 * liveness, and nothing about the issuer's operation: no seats, no allow list,
 * no uses count, no creator subject, no claimId, no token echo. `usesLeft` is
 * a derived remainder rather than `maxUses` and `uses`, and `issuerHandle` is
 * the public handle the badge already prints, never the Clerk subject behind
 * it. Adding a field here publishes it to anyone holding the link.
 *
 * C15 A21 added defaultValidityMs for one reason: without it a visitor could
 * not learn the badge expires until after they had claimed it. It describes
 * the credential on offer, which is exactly the category of thing this query
 * is for.
 */
export const preview = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!TOKEN_RE.test(token)) return null;

    const row = await claimByToken(ctx, token);
    // C15 A41. The not-found shape is a documented variant, not an accident.
    // It used to carry three differently shaped absences, category "", sphere
    // null and issuerHandle "", which asked the page to learn two magic values
    // for one idea. There is one now: every field a live link would have
    // supplied is null, and expiresAt is the single 0 A41 kept because the
    // field is typed number.
    const empty = {
      templateName: "", templateDescription: "", templateCriteria: "",
      kind: "badge", origin: "community", category: null, sphere: null,
      issuerHandle: null, design: null, state: "not-found",
      expiresAt: 0, usesLeft: null, defaultValidityMs: null,
    };
    if (!row) return empty;

    const template = await ctx.db.get(row.templateId);
    if (!template) return { ...empty, state: "not-found" };

    const version = template.currentVersionId ? await ctx.db.get(template.currentVersionId) : null;
    const issuer = template.origin === "neorgon"
      ? { handle: "neorgon" }
      : await profileFor(ctx, template.ownerSubject);

    return {
      templateName: template.name,
      templateDescription: template.description,
      templateCriteria: template.criteria,
      kind: template.kind,
      origin: template.origin,
      category: template.category,
      sphere: template.sphere,
      // C15 A42.1's reasoning, applied to the same absence on this object: a
      // missing issuer profile is null, never "". validateProvenance in the
      // kit refuses an empty handle on a non-imported origin and would throw
      // inside the pre-sign-in render.
      issuerHandle: issuer?.handle ?? null,
      design: version?.design ?? null,
      state: claimState(row, Date.now()),
      // The link's own expiry: when this door closes. Not the badge's.
      expiresAt: row.expiresAt,
      // C15 A41: null means unlimited, and it always has. The type block said
      // number for two amendments running. undefined is folded in with null
      // because a row written before maxUses existed carries neither.
      usesLeft: row.maxUses === null || row.maxUses === undefined
        ? null
        : Math.max(0, row.maxUses - row.uses),
      // C15 A21. How long the badge itself lasts once claimed, or null for a
      // badge that does not expire. Read through the same validityFor that
      // redeem computes expiresAt with, so the promise made here before
      // sign-in is the promise kept there after it.
      defaultValidityMs: validityFor(template),
    };
  },
});

// ── redeem ───────────────────────────────────────────────────────────────────

/**
 * C15 A4 and A21. The one reading of templates.defaultValidityMs, shared by
 * the preview a visitor sees before signing in and the redeem that mints the
 * award, so the two cannot tell a person different things about the same
 * badge. Answers a positive finite number of milliseconds, or null.
 *
 * **Null means the award does not expire. It never means "expires now".**
 * Absent, null, 0, a negative and NaN all answer null, because a template that
 * silently accepted 0 would otherwise mint awards that expired at the instant
 * they were claimed, which is the outcome A4 names.
 */
export function validityFor(template: { defaultValidityMs?: number | null }): number | null {
  const ms = template.defaultValidityMs;
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return null;
  return ms;
}

/**
 * C15 A4. The one place a claimed award's expiry is computed.
 *
 * The dangerous reading of "expiresAt = now + defaultValidityMs" is the one
 * where an absent field arrives as undefined, `now + undefined` is NaN, or a
 * null coerces to zero and every award expires the instant it is claimed.
 * Nothing here arithmetics on a value validityFor has not first proved is a
 * positive finite number, so absence and null both leave the award
 * non-expiring.
 */
export function expiryFor(template: { defaultValidityMs?: number | null }, now: number): number | null {
  const ms = validityFor(template);
  return ms === null ? null : now + ms;
}

/**
 * C3.3, in the contract's own evaluation order. Every check is inside this one
 * mutation, and a Convex mutation is a transaction, so a concurrent second
 * redeem cannot read a stale `uses`.
 */
export async function redeemCore(ctx: any, subject: string, token: string) {
  if (!TOKEN_RE.test(token)) {
    return fail("bad-token", "This link is not a Sash claim link.");
  }

  // C15 A9. C3.3 meters at step 11, after the work, so a redeem of a token
  // that resolves to nothing costs the caller nothing and the 110-bit token
  // space can be probed for free. This meters the attempt itself, keyed by
  // identity, before the by_token lookup. It sits after the regex test on
  // purpose: a string that cannot be a token cannot probe anything, so
  // rejecting it needs no database write at all.
  //
  // The C3.3 check stays exactly where it was. The two do different jobs: this
  // one prices a guess, that one stops a seat being burned by a double click.
  const attempts = await enforce(ctx, subject, "claim.attempt", "claim attempts");
  if (attempts) return attempts;

  const row = await claimByToken(ctx, token);
  if (!row) return fail("not-found", "This link does not exist.");
  if (row.revokedAt !== null && row.revokedAt !== undefined) {
    return fail("revoked", "The issuer withdrew this link.");
  }
  const now = Date.now();
  if (now >= row.expiresAt) {
    // C3.3 asks for a date. C15 A42.2: this used to interpolate toIso and
    // hand the reader `2026-09-09T21:06:21.000Z`, which is the stored number
    // wearing a costume. expiresAt still travels in the extra field, so a page
    // that wants the instant in the reader's own zone has the number.
    return fail("expired", `This link expired on ${dateText(row.expiresAt)}.`, {
      expiresAt: row.expiresAt,
    });
  }
  if (row.maxUses !== null && row.maxUses !== undefined && row.uses >= row.maxUses) {
    return fail("exhausted", "Every seat on this link is taken.");
  }

  const profile = await profileFor(ctx, subject);
  const handle = profile?.handle ?? "";

  if (row.allowList.length > 0 && !row.allowList.includes(handle)) {
    return fail("not-invited", "This link was issued to specific handles.");
  }

  const template = await ctx.db.get(row.templateId);
  if (!template) return fail("not-found", "This link does not exist.");
  if (template.status !== "published") {
    return fail("unpublished", "The issuer unpublished this badge.");
  }

  const held = await ctx.db
    .query("awards")
    .withIndex("by_holder_template", (q: any) =>
      q.eq("holderSubject", subject).eq("templateId", template._id))
    .collect();
  const live = held.find((a: any) => a.revokedAt === null || a.revokedAt === undefined);

  if (live && !template.stackable) {
    // C3.4. A double click or a refresh must not burn two seats, so `uses` is
    // untouched and the existing award id comes back with the refusal.
    return fail("already-held", "You already hold this one.", { awardPublicId: live.publicId });
  }
  if (!handle) return fail("no-handle", "Pick a handle before claiming.");

  const limited = await enforce(ctx, subject, "claim.redeem", "claims");
  if (limited) return limited;

  if (!template.currentVersionId) {
    return fail("unpublished", "The issuer unpublished this badge.");
  }

  const firstEver = (await ctx.db
    .query("awards")
    .withIndex("by_holder", (q: any) => q.eq("holderSubject", subject))
    .collect()).length === 0;

  await ctx.db.patch(row._id, { uses: row.uses + 1 });

  let awardPublicId: string;
  if (live && template.stackable) {
    await ctx.db.patch(live._id, { count: live.count + 1 });
    awardPublicId = live.publicId;
  } else {
    const publicId = await mintPublicId(ctx, "awards");
    if (!publicId) return fail("id-collision", "Could not mint a public id. Try again.");
    await ctx.db.insert("awards", {
      publicId,
      holderSubject: subject,
      templateId: template._id,
      // Pinned at issue, so a later version never changes an issued badge.
      versionId: template.currentVersionId,
      // C15 A5. The link that minted this award, so claims:claimants can
      // answer the question the issuer actually asked.
      claimId: row._id,
      count: 1,
      issuedAt: now,
      // C3.3 and C15 A4. A set validity is added to the issue time; absent and
      // null both mean the award does not expire. Never "expires now".
      expiresAt: expiryFor(template, now),
      issuedBy: template.ownerSubject,
      issuerSite: null,
      source: "claim",
      importMeta: null,
      evidenceUrl: null,
      hidden: false,
      revokedAt: null,
    });
    awardPublicId = publicId;
  }

  if (firstEver) await grantNeorgon(ctx, subject, "first-claim");
  return done({ awardPublicId });
}

export const redeem = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const identity = await requireIdentity(ctx);
    return await redeemCore(ctx, identity.subject, token);
  },
});

// ── revoke ───────────────────────────────────────────────────────────────────

export async function revokeCore(ctx: any, subject: string, claimId: any) {
  const row = await ctx.db.get(claimId);
  if (!row) return fail("not-found", "No such claim link.");
  const template = await ctx.db.get(row.templateId);
  const owner = template?.ownerSubject ?? row.createdBy;
  if (owner !== subject && !isAdminSubject(subject)) {
    return fail("not-authorised", "Only the issuer can revoke this link.");
  }
  // Revoking a link stops future redeems. It does not revoke awards already
  // issued from it: that is awards:revoke. C3.5.
  await ctx.db.patch(row._id, { revokedAt: Date.now() });
  return done();
}

export const revoke = mutation({
  args: { claimId: v.id("claims") },
  handler: async (ctx, { claimId }) => {
    const identity = await requireIdentity(ctx);
    return await revokeCore(ctx, identity.subject, claimId);
  },
});

// ── claimants ────────────────────────────────────────────────────────────────

/**
 * C2.5, now exact. C15 A5 added awards.claimId, so this answers "who claimed
 * this link" rather than "who holds an award from this link's template that
 * postdates it", which over-reported every time a template carried more than
 * one live link.
 *
 * The comparison is on the id and nothing else: no time window, no source
 * heuristic. An award minted by no link has claimId null and can never match.
 *
 * The one residual, worth stating because nothing detects it: a stackable
 * template redeemed by the same holder through two different links mints one
 * award row on the first redeem and increments its count on the second, so the
 * row carries the id of the link that minted it and the second link reports no
 * claimant for that holder. Under-reporting a stack is the smaller error than
 * the over-report it replaces, and a column can only name one link.
 */
export async function claimantsCore(ctx: any, subject: string, claimId: any) {
  const row = await ctx.db.get(claimId);
  if (!row) return [];
  const template = await ctx.db.get(row.templateId);
  const owner = template?.ownerSubject ?? row.createdBy;
  if (owner !== subject && !isAdminSubject(subject)) return [];

  const awards = await ctx.db
    .query("awards")
    .withIndex("by_template", (q: any) => q.eq("templateId", row.templateId))
    .collect();

  const out = [];
  for (const a of awards) {
    if (a.claimId !== row._id) continue;
    const holder = await profileFor(ctx, a.holderSubject);
    out.push({
      handle: holder?.handle ?? "",
      displayName: holder?.displayName ?? "",
      awardPublicId: a.publicId,
      issuedAt: toIso(a.issuedAt),
    });
  }
  return out.sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));
}

export const claimants = query({
  args: { claimId: v.id("claims") },
  handler: async (ctx, { claimId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await claimantsCore(ctx, identity.subject, claimId);
  },
});

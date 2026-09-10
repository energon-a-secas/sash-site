import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { clampLimit, done, fail, requireIdentity, toIso, trimmed } from "./lib/shared";
import { normalizeHandle } from "./lib/handles";
import { enforce } from "./rate";
import { mintPublicId } from "./ids";
import { grantNeorgon } from "./lib/grants";
import { profileFor, profileForHandle } from "./profiles";
import { awardByPublicId } from "./awards";

/** CONTRACTS.md C2.7. Every rule below is enforced here, not in the page. */

const MESSAGE_CAP = 240;
const TEN_SENT = 10;

export async function sendCore(
  ctx: any, subject: string,
  args: { toHandle: string; templatePublicId: string; message: string },
) {
  const message = trimmed(args.message);
  if (message.length > MESSAGE_CAP) {
    // Not truncated: a cap that truncates teaches the sender their words were
    // accepted when they were not. C14.4.
    return fail("too-long", `A message is limited to ${MESSAGE_CAP} characters. Yours is ${message.length}.`);
  }

  const sender = await profileFor(ctx, subject);
  if (!sender?.handle) return fail("no-handle", "Pick a handle before sending recognition.");

  const toHandle = normalizeHandle(args.toHandle);
  if (!toHandle) return fail("not-found", "That handle does not exist.");
  if (toHandle === sender.handle) return fail("self-send", "You cannot send this to yourself.");

  const recipient = await profileForHandle(ctx, toHandle);
  if (!recipient) return fail("not-found", "That handle does not exist.");

  const template = await ctx.db
    .query("templates")
    .withIndex("by_public_id", (q: any) => q.eq("publicId", args.templatePublicId))
    .first();
  if (!template) return fail("not-found", "That badge does not exist.");
  if (template.status !== "published") return fail("unpublished", "That badge is not published.");
  if (!template.stackable) return fail("invalid", "That badge cannot be sent as recognition.");
  if (!template.currentVersionId) return fail("unpublished", "That badge has no published version.");

  const limited = await enforce(ctx, subject, "kudos.send", "recognition");
  if (limited) return limited;
  const perRecipient = await enforce(
    ctx, subject, "kudos.to", `recognition to @${toHandle}`, recipient.clerkSubject,
  );
  if (perRecipient) return perRecipient;

  const held = await ctx.db
    .query("awards")
    .withIndex("by_holder_template", (q: any) =>
      q.eq("holderSubject", recipient.clerkSubject).eq("templateId", template._id))
    .collect();
  const live = held.find((a: any) => a.revokedAt === null || a.revokedAt === undefined);

  let awardId: any;
  let awardPublicId: string;
  let count: number;

  if (live) {
    count = live.count + 1;
    await ctx.db.patch(live._id, { count });
    awardId = live._id;
    awardPublicId = live.publicId;
  } else {
    const publicId = await mintPublicId(ctx, "awards");
    if (!publicId) return fail("id-collision", "Could not mint a public id. Try again.");
    count = 1;
    awardId = await ctx.db.insert("awards", {
      publicId,
      holderSubject: recipient.clerkSubject,
      templateId: template._id,
      versionId: template.currentVersionId,
      claimId: null,                    // C15 A5. A kudos is minted by no link.
      count: 1,
      issuedAt: Date.now(),
      expiresAt: null,
      issuedBy: subject,
      issuerSite: null,
      source: "sent",
      importMeta: null,
      evidenceUrl: null,
      hidden: false,
      revokedAt: null,
    });
    awardPublicId = publicId;
  }

  // Always written, so the message history survives even when the award
  // already existed and only its count moved.
  await ctx.db.insert("kudos", {
    fromSubject: subject,
    toSubject: recipient.clerkSubject,
    templateId: template._id,
    awardId,
    message,
    createdAt: Date.now(),
  });

  const sent = await ctx.db
    .query("kudos")
    .withIndex("by_from_at", (q: any) => q.eq("fromSubject", subject))
    .collect();
  if (sent.length >= TEN_SENT) await grantNeorgon(ctx, subject, "ten-sent");

  return done({ awardPublicId, count });
}

export const send = mutation({
  args: { toHandle: v.string(), templatePublicId: v.string(), message: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    return await sendCore(ctx, identity.subject, args);
  },
});

export const forAward = query({
  args: { awardPublicId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { awardPublicId, limit }) => {
    const award = await awardByPublicId(ctx, awardPublicId);
    if (!award) return [];
    const capped = clampLimit(limit, 20, 100);

    const rows = await ctx.db
      .query("kudos")
      .withIndex("by_award", (q: any) => q.eq("awardId", award._id))
      .collect();
    rows.sort((a: any, b: any) => b.createdAt - a.createdAt);

    const out = [];
    for (const row of rows.slice(0, capped)) {
      const from = await profileFor(ctx, row.fromSubject);
      out.push({
        fromHandle: from?.handle ?? "",
        message: row.message,
        createdAt: toIso(row.createdAt),
      });
    }
    return out;
  },
});

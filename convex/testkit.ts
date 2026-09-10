import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import * as profiles from "./profiles";
import * as templates from "./templates";
import * as versions from "./versions";
import * as claims from "./claims";
import * as awards from "./awards";
import * as kudos from "./kudos";
import * as art from "./art";
import * as imports from "./imports";
import { shapeAward } from "./lib/awards";

/**
 * A verification harness, internal only, and inert unless SASH_TESTKIT is set.
 *
 * It exists because the Convex CLI has no identity: `npx convex run` calls a
 * function with ctx.auth.getUserIdentity() returning null, so every mutation
 * that writes for a user throws before its logic runs, and there is no way to
 * exercise "owner A cannot touch owner B's template" from the command line.
 *
 * It does not reimplement anything. Every entry below calls the same core
 * function the public mutation calls, with an explicit subject in place of the
 * one requireIdentity would have read, so an authorisation rule proved here is
 * the rule that ships. The authentication boundary is the one thing it cannot
 * exercise, and that is checked the other way round: calling the public
 * function with no identity and seeing it throw.
 *
 * SASH_TESTKIT must not be set on a production deployment. Every entry point
 * is an internalMutation or an internalQuery, so it is unreachable from a
 * browser either way, but the guard makes the intent explicit rather than
 * relying on that.
 */

function armed(): boolean {
  return (process.env.SASH_TESTKIT || "").trim() === "on";
}

function disarmed() {
  return {
    ok: false,
    code: "testkit-disabled",
    message: "SASH_TESTKIT is not set on this deployment.",
  };
}

export const run = internalMutation({
  args: { subject: v.string(), fn: v.string(), args: v.any() },
  handler: async (ctx, { subject, fn, args }) => {
    if (!armed()) return disarmed();
    const a = args ?? {};
    switch (fn) {
      case "profiles:claimHandle":   return await profiles.claimHandleCore(ctx, subject, a.handle);
      case "profiles:updateMine":    return await profiles.updateMineCore(ctx, subject, a);
      case "profiles:setShowcase":   return await profiles.setShowcaseCore(ctx, subject, a.awardPublicIds);
      case "profiles:setAwardHidden":return await profiles.setAwardHiddenCore(ctx, subject, a.awardPublicId, a.hidden);
      case "templates:create":       return await templates.createCore(ctx, subject, a);
      case "templates:updateMeta":   return await templates.updateMetaCore(ctx, subject, a.templateId, a);
      case "templates:publish":      return await templates.publishCore(ctx, subject, a.templateId, a.changelog ?? "");
      case "templates:archive":      return await templates.archiveCore(ctx, subject, a.templateId);
      case "versions:saveDraft":     return await versions.saveDraftCore(ctx, subject, a.templateId, a.design);
      case "claims:create":          return await claims.createCore(ctx, subject, a);
      case "claims:redeem":          return await claims.redeemCore(ctx, subject, a.token);
      case "claims:revoke":          return await claims.revokeCore(ctx, subject, a.claimId);
      case "awards:revoke":          return await awards.revokeCore(ctx, subject, a.publicId);
      case "kudos:send":             return await kudos.sendCore(ctx, subject, a);
      case "art:getUploadUrl":       return await art.getUploadUrlCore(ctx, subject);
      case "art:attach":             return await art.attachCore(ctx, subject, a.templateId, a.storageId);
      case "imports:save": {
        const outcome: any = await imports.saveCore(ctx, subject, a.preview);
        if ("ok" in outcome) return outcome;
        // C15 A40 moved the allowlist from "may this save" to "may this be
        // re-fetched", and the scheduler call the public mutation makes off
        // that decision leaves no trace a query can read. Reporting the flag
        // is the only way to show the two halves of the ruling separately:
        // the row stored, and the fetch not attempted.
        return { ...outcome.result, reverifyScheduled: outcome.reverify };
      }
      case "imports:remove":         return await imports.removeCore(ctx, subject, a.publicId);

      // C15 A42.1 describes a state no public function can reach: a community
      // template whose owner profile row is gone, while the template and the
      // awards minted from it survive. Nothing deletes a profile, which is
      // exactly why the empty string sat there undetected, and it is the same
      // shape as A19. This deletes **the profile row and nothing else**, so
      // the orphan can be produced, read back and then cleaned up. reset()
      // will not do: it takes the template with it and the shaper then reads
      // a null template rather than a missing issuer.
      case "probe:orphanIssuer": {
        const row = await profiles.profileFor(ctx, a.of ?? subject);
        if (!row) return { ok: false, code: "not-found", message: "No profile for that subject." };
        await ctx.db.delete(row._id);
        return { ok: true, forgot: row.handle };
      }
      default:
        return { ok: false, code: "unknown-fn", message: `testkit has no entry for ${fn}` };
    }
  },
});

export const read = internalQuery({
  args: { subject: v.string(), fn: v.string(), args: v.any() },
  handler: async (ctx, { subject, fn, args }) => {
    if (!armed()) return disarmed();
    const a = args ?? {};
    switch (fn) {
      case "profiles:me": {
        const row = await profiles.profileFor(ctx, subject);
        return row ? { handle: row.handle, displayName: row.displayName, showcase: row.showcase } : null;
      }

      // C15 A39. The public read, with an explicit viewer. The branch worth
      // exercising is the one npx convex run cannot reach on its own: an owner
      // reading their own private profile still gets an object, where everyone
      // else gets null. Pass subject "" for a signed-out stranger.
      case "profiles:byHandle":
        return await profiles.byHandleCore(ctx, subject || null, a.handle);
      case "awards:mine": {
        const profile = await profiles.profileFor(ctx, subject);
        const rows = await ctx.db
          .query("awards")
          .withIndex("by_holder", (q: any) => q.eq("holderSubject", subject))
          .collect();
        return await Promise.all(rows.map((r: any) =>
          shapeAward(ctx, r, { includeOwn: true, showcase: profile?.showcase ?? [] })));
      }
      // C15 A32. draftDirty is computed only for a privileged caller, so the
      // JSON.stringify comparison the amendment is about cannot be observed
      // over the CLI without an explicit subject. Pass subject "" for a
      // signed-out stranger.
      case "templates:get":
        return await templates.getCore(ctx, subject || null, a.publicId);

      case "templates:mine": {
        const rows = await ctx.db
          .query("templates")
          .withIndex("by_owner", (q: any) => q.eq("ownerSubject", subject))
          .collect();
        return rows.map((r: any) => ({
          templateId: r._id, publicId: r.publicId, name: r.name,
          status: r.status, currentVersionId: r.currentVersionId, slug: r.slug ?? null,
        }));
      }
      // C15 A5. The exactness of claims:claimants is the whole point of the
      // amendment, and it cannot be exercised over the CLI without an entry
      // here: the public query reads ctx.auth, which npx convex run has none
      // of. Same core function the query calls, so the authorisation rule
      // proved here is the rule that ships.
      case "claims:claimants":
        return await claims.claimantsCore(ctx, subject, a.claimId);

      // C15 A55. Same reason as claimants: the public query reads ctx.auth and
      // the CLI has no identity, so the branch the amendment changed could not
      // be called at all from here. Same core function the query calls.
      case "claims:mine":
        return await claims.mineCore(ctx, subject, a.templateId);

      // C15 A4, the direction that no writer can reach any more but that a
      // row written before the amendment is in: defaultValidityMs absent
      // rather than null. `now + undefined` is NaN and a null coerced to zero
      // expires the award at the instant it is claimed, so both readings are
      // exercised here against the same function claims:redeem calls.
      case "claims:expiryProbe": {
        const now = a.now ?? Date.now();
        return {
          now,
          absent: claims.expiryFor({} as any, now),
          nullValue: claims.expiryFor({ defaultValidityMs: null }, now),
          zero: claims.expiryFor({ defaultValidityMs: 0 }, now),
          negative: claims.expiryFor({ defaultValidityMs: -1000 }, now),
          notANumber: claims.expiryFor({ defaultValidityMs: NaN }, now),
          ninetyDays: claims.expiryFor({ defaultValidityMs: 7776000000 }, now),
        };
      }

      // Row counts per table, so a workstream can prove it left the fixtures
      // another workstream depends on where it found them. `npx convex data`
      // prints rows and no totals.
      case "db:counts": {
        const out: Record<string, number> = {};
        for (const table of ["profiles", "templates", "templateVersions", "claims", "awards", "kudos", "rateEvents"] as const) {
          out[table] = (await ctx.db.query(table).collect()).length;
        }
        return out;
      }

      // C15 A55, both halves, measured on the live table instead of asserted.
      //
      // `earlyAdopter` runs the predicate claimHandle asks, "have we reached
      // the cutoff", both ways at once for a sweep of cutoffs: the unbounded
      // count the code used to take, and the bounded `.take(n)` it takes now.
      // `agree` must be true on every row, and `rowsRead` must never exceed
      // the cutoff, which is the whole point of the change. The `.collect()`
      // here is the read the fix removed from the shipping path; a harness may
      // take it because it needs the true total to compare against.
      //
      // `claims` does the same for claims:mine: how many rows the old
      // fleet-wide `.collect()` touched, how many of those belonged to another
      // issuer, and the same two numbers for the `by_creator` read that
      // replaced it. `foreign` on the new read is the number that has to be 0,
      // and `sameAnswer` is what says the bound did not also change the answer.
      case "probe:scans": {
        const who = a.of || subject;

        const profileRows = await ctx.db.query("profiles").collect();
        const total = profileRows.length;
        const earlyAdopter = [];
        for (const n of (a.cutoffs ?? [1, total - 1, total, total + 1, 500]) as number[]) {
          const bounded = await ctx.db.query("profiles").take(n);
          earlyAdopter.push({
            cutoff: n,
            profilesInTable: total,
            rowsRead: bounded.length,
            unboundedGrants: total < n,
            boundedGrants: bounded.length < n,
            agree: (total < n) === (bounded.length < n),
          });
        }

        const allClaims = await ctx.db.query("claims").collect();
        const indexed = await ctx.db
          .query("claims")
          .withIndex("by_creator", (q: any) => q.eq("createdBy", who))
          .collect();
        const ids = (rows: any[]) => rows.map((r: any) => String(r._id)).sort();
        const oldAnswer = ids(allClaims.filter((r: any) => r.createdBy === who));

        return {
          earlyAdopter,
          claims: {
            rowsInTable: allClaims.length,
            distinctCreators: new Set(allClaims.map((r: any) => r.createdBy)).size,
            oldRead: {
              rowsRead: allClaims.length,
              foreign: allClaims.filter((r: any) => r.createdBy !== who).length,
            },
            newRead: {
              rowsRead: indexed.length,
              foreign: indexed.filter((r: any) => r.createdBy !== who).length,
            },
            sameAnswer: JSON.stringify(oldAnswer) === JSON.stringify(ids(indexed)),
            answerRows: oldAnswer.length,
          },
        };
      }

      case "rate:count": {
        const rows = await ctx.db
          .query("rateEvents")
          .withIndex("by_bucket_at", (q: any) => q.eq("bucket", a.bucket))
          .collect();
        return rows.length;
      }
      default:
        return { ok: false, code: "unknown-fn", message: `testkit has no entry for ${fn}` };
    }
  },
});

/**
 * Wipes every row this harness created. Refuses unless SASH_TESTKIT is on.
 *
 * **It also gives back the seat.** Deleting an award minted by a claim link
 * used to leave that link's `uses` one higher for good, so a workstream that
 * tidied up after itself still left a permanent mark on somebody else's
 * fixture link, and the mark was invisible until an issuer dashboard counted
 * it. C15 A5 put the link's id on the award, which is exactly what makes the
 * reversal exact rather than a guess.
 *
 * The one case it under-restores: a stackable template redeemed twice by the
 * same holder through the same link increments `uses` twice and mints one row,
 * so one row coming out gives back one seat of the two. Same residual C2.5's
 * claimants note already records, and for the same reason: a column can only
 * name one link.
 */
export const reset = internalMutation({
  args: { subjects: v.array(v.string()) },
  handler: async (ctx, { subjects }) => {
    if (!armed()) return disarmed();
    let deleted = 0;
    let seatsReturned = 0;
    for (const table of ["kudos", "awards", "claims", "templateVersions", "templates", "profiles", "rateEvents"] as const) {
      for (const row of await ctx.db.query(table).collect()) {
        const owner = (row as any).clerkSubject ?? (row as any).ownerSubject ??
                      (row as any).holderSubject ?? (row as any).createdBy ??
                      (row as any).fromSubject ?? "";
        const bucketOwner = typeof (row as any).bucket === "string"
          ? String((row as any).bucket).split("|")[0] : "";
        if (subjects.includes(owner) || subjects.includes(bucketOwner)) {
          const claimId = table === "awards" ? (row as any).claimId : null;
          await ctx.db.delete(row._id);
          deleted++;
          if (claimId) {
            const link: any = await ctx.db.get(claimId);
            if (link && link.uses > 0) {
              await ctx.db.patch(link._id, { uses: link.uses - 1 });
              seatsReturned++;
            }
          }
        }
      }
    }
    // templateVersions rows are keyed by template, not by subject, so any left
    // pointing at a deleted template go too.
    for (const row of await ctx.db.query("templateVersions").collect()) {
      if (!(await ctx.db.get(row.templateId))) { await ctx.db.delete(row._id); deleted++; }
    }
    return { deleted, seatsReturned };
  },
});

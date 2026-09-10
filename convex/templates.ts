import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { clampLimit, done, fail, overCap, requireIdentity, trimmed } from "./lib/shared";
import {
  ACCESS_LEVELS, CATEGORIES, KINDS, SPHERES, designTextFields, validateDesign,
} from "./lib/design";
import { blockedMessage, checkBlocklist } from "./lib/blocklist";
import { enforce } from "./rate";
import { mintPublicId } from "./ids";
import { grantNeorgon } from "./lib/grants";
import { isAdminSubject } from "./lib/admin";
import { profileFor } from "./profiles";

/**
 * CONTRACTS.md C2.3.
 *
 * origin is never a client argument. templates:create always writes
 * origin "community" and ownerSubject identity.subject. The only writer of
 * origin "neorgon" is seed:ensureNeorgonTemplates, which is internal, because
 * a public one would let anyone mint a first-party badge. That is the exact
 * mistake docs/architecture/auth-flow.md records for auth:seedAdmin.
 */

async function issuerHandleFor(ctx: any, row: any): Promise<string> {
  if (row.origin === "neorgon") return "neorgon";
  const profile = await profileFor(ctx, row.ownerSubject);
  return profile?.handle ?? "";
}

async function shapeRow(ctx: any, row: any) {
  const version = row.currentVersionId ? await ctx.db.get(row.currentVersionId) : null;
  return {
    templateId: row._id,
    publicId: row.publicId,
    kind: row.kind,
    name: row.name,
    description: row.description,
    criteria: row.criteria,
    skills: row.skills,
    origin: row.origin,
    category: row.category,
    sphere: row.sphere,
    access: row.access,
    seats: row.seats,
    allowList: row.allowList,
    status: row.status,
    stackable: row.stackable,
    // C15 A4. Normalised to null on the way out, so a consumer never has to
    // tell absent from null: both mean the award does not expire.
    defaultValidityMs: row.defaultValidityMs ?? null,
    slug: row.slug ?? null,
    currentVersionId: row.currentVersionId,
    versionN: version?.n ?? 0,
    issuerHandle: await issuerHandleFor(ctx, row),
    artUrl: row.artStorageId ? await ctx.storage.getUrl(row.artStorageId) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** TemplateDetail. C2.3 names the type and does not define it, so: a row plus
 *  the design a caller is entitled to see. A published template shows its
 *  published design to anyone; the owner and an admin also see the draft. */
async function shapeDetail(ctx: any, row: any, privileged: boolean) {
  const base = await shapeRow(ctx, row);
  const version = row.currentVersionId ? await ctx.db.get(row.currentVersionId) : null;
  return {
    ...base,
    publishedDesign: version?.design ?? null,
    design: privileged ? (row.design ?? version?.design ?? null) : (version?.design ?? null),
    // C15 A32. This is the `JSON.stringify` comparison A25 proved
    // order-sensitive, and it is safe **here and only here**: both operands are
    // read out of Convex (`row.design` off the template row, `version.design`
    // off the pinned version), and Convex returns an object's fields in
    // alphabetical order, so the two sides arrive keyed the same way and the
    // string compare answers the question the deep compare would.
    //
    // What would stop it being safe: comparing either side against a source
    // literal, an object built in this file, an argument off the wire, or
    // anything from `data/catalog.ts`. That is exactly the shape that made
    // `seed.ts` mint fifteen immutable `templateVersions` rows per run while
    // reporting that nothing had changed. If either operand ever stops coming
    // straight out of `ctx.db`, swap this for `sameValue(a, b)` from
    // `lib/shared.ts`, which is one import away and is the comparison A25
    // needed. A false positive here is cosmetic (the editor shows an unsaved
    // draft that matches the published one); the same pattern one file over
    // was not.
    draftDirty: privileged
      ? JSON.stringify(row.design ?? null) !== JSON.stringify(version?.design ?? null)
      : false,
  };
}

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const rows = await ctx.db
      .query("templates")
      .withIndex("by_owner", (q: any) => q.eq("ownerSubject", identity.subject))
      .collect();
    return await Promise.all(rows.map((r: any) => shapeRow(ctx, r)));
  },
});

/**
 * Split out for the same reason as `claims:claimantsCore`: `draftDirty` is only
 * computed for a privileged caller, `ctx.auth` is null over the CLI, and the
 * A32 comparison above is therefore unreachable from a command line without an
 * explicit subject. Pass null for a signed-out stranger.
 */
export async function getCore(ctx: any, subject: string | null, publicId: string) {
  const row = await ctx.db
    .query("templates")
    .withIndex("by_public_id", (q: any) => q.eq("publicId", publicId))
    .first();
  if (!row) return null;

  const privileged = !!subject && (subject === row.ownerSubject || isAdminSubject(subject));

  if (!privileged && (row.status !== "published" || row.access === "private")) return null;
  return await shapeDetail(ctx, row, privileged);
}

export const get = query({
  args: { publicId: v.string() },
  handler: async (ctx, { publicId }) => {
    const identity = await ctx.auth.getUserIdentity();
    return await getCore(ctx, identity?.subject ?? null, publicId);
  },
});

export const listPublic = query({
  args: {
    origin: v.optional(v.string()),
    category: v.optional(v.string()),
    sphere: v.optional(v.string()),
    kind: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 48, 100);
    const rows = await ctx.db
      .query("templates")
      .withIndex("by_status_category", (q: any) =>
        args.category
          ? q.eq("status", "published").eq("category", args.category)
          : q.eq("status", "published"))
      .collect();

    const kept = rows.filter((r: any) =>
      r.access !== "private" &&
      (!args.origin || r.origin === args.origin) &&
      (!args.sphere || r.sphere === args.sphere) &&
      (!args.kind || r.kind === args.kind));

    kept.sort((a: any, b: any) => b.updatedAt - a.updatedAt);
    return await Promise.all(kept.slice(0, limit).map((r: any) => shapeRow(ctx, r)));
  },
});

// ── Shared metadata validation ───────────────────────────────────────────────

type Meta = {
  kind?: string; name?: string; description?: string; criteria?: string;
  skills?: string[]; category?: string; sphere?: string | null; access?: string;
  seats?: number | null; allowList?: string[]; stackable?: boolean;
  defaultValidityMs?: number | null;
};

function checkMeta(meta: Meta, merged: Required<Pick<Meta, "category" | "access" | "stackable">> & { seats: number | null }) {
  if (meta.kind !== undefined && !KINDS.includes(meta.kind as any)) {
    return fail("invalid", `kind must be one of ${KINDS.join(", ")}.`);
  }
  if (meta.name !== undefined) {
    const over = overCap(meta.name, 80, "name");
    if (over) return over;
    if (!meta.name.trim()) return fail("invalid", "A template needs a name.");
  }
  if (meta.description !== undefined) {
    const over = overCap(meta.description, 600, "description");
    if (over) return over;
  }
  if (meta.criteria !== undefined) {
    const over = overCap(meta.criteria, 1200, "criteria");
    if (over) return over;
  }
  if (meta.skills !== undefined) {
    if (meta.skills.length > 20) return fail("too-long", "A template holds at most 20 skills.");
    for (const skill of meta.skills) {
      const over = overCap(skill, 40, "skill");
      if (over) return over;
    }
  }
  if (meta.allowList !== undefined && meta.allowList.length > 200) {
    return fail("too-long", "An allow list holds at most 200 handles.");
  }
  if (meta.category !== undefined && !CATEGORIES.includes(meta.category as any)) {
    return fail("invalid", `category must be one of ${CATEGORIES.join(", ")}.`);
  }
  if (meta.access !== undefined && !ACCESS_LEVELS.includes(meta.access as any)) {
    return fail("invalid", `access must be one of ${ACCESS_LEVELS.join(", ")}.`);
  }
  if (meta.sphere !== undefined && meta.sphere !== null && !SPHERES.includes(meta.sphere as any)) {
    return fail("invalid", `sphere must be one of ${SPHERES.join(", ")} or null.`);
  }
  // C15 A4. Null is the way to say "does not expire". Zero and a negative are
  // refused rather than normalised, because a template that silently accepted
  // 0 would mint awards that expired at the moment they were claimed, which is
  // the one outcome the amendment names.
  if (meta.defaultValidityMs !== undefined && meta.defaultValidityMs !== null) {
    const ms = meta.defaultValidityMs;
    if (!Number.isFinite(ms) || !Number.isInteger(ms) || ms <= 0) {
      return fail("invalid", "defaultValidityMs is a positive whole number of milliseconds, or null for an award that does not expire.");
    }
  }
  return checkConsistency(merged);
}

/** The three cross-field rules, re-checked on create, on updateMeta and again
 *  on publish, because publish is the last point before a version is frozen. */
function checkConsistency(m: { category: string; access: string; stackable: boolean; seats: number | null; sphere?: string | null }) {
  if (m.stackable && m.category !== "recognition" && m.category !== "meme") {
    return fail("stackable-not-allowed", "Only a recognition or meme template can be stackable.");
  }
  if (m.sphere !== undefined) {
    const wantsSphere = m.category === "recognition";
    if (wantsSphere && !m.sphere) {
      return fail("sphere-mismatch", "A recognition template needs a sphere.");
    }
    if (!wantsSphere && m.sphere) {
      return fail("sphere-mismatch", "Only a recognition template carries a sphere.");
    }
  }
  if (m.access === "limited" && (m.seats === null || m.seats === undefined)) {
    return fail("seats-required", "A limited template needs a number of seats.");
  }
  return null;
}

// ── create ───────────────────────────────────────────────────────────────────

export type CreateArgs = {
  kind: string; name: string; description: string; criteria: string;
  skills: string[]; category: string; sphere: string | null; access: string;
  seats: number | null; allowList: string[]; stackable: boolean; design: any;
  defaultValidityMs?: number | null;
};

export async function createCore(ctx: any, subject: string, args: CreateArgs) {
  const limited = await enforce(ctx, subject, "template.create", "templates");
  if (limited) return limited;

  const profile = await profileFor(ctx, subject);
  if (!profile?.handle) {
    return fail("no-handle", "Pick a handle before creating a template. It is the issuing handle on every badge you make.");
  }

  const bad = checkMeta(args, {
    category: args.category, access: args.access, stackable: args.stackable,
    seats: args.seats, sphere: args.sphere,
  } as any);
  if (bad) return bad;

  const problems = validateDesign(args.design);
  if (problems.length) {
    return fail("invalid-design", problems[0], { problems });
  }

  const publicId = await mintPublicId(ctx, "templates");
  if (!publicId) return fail("id-collision", "Could not mint a public id. Try again.");

  const now = Date.now();
  const templateId = await ctx.db.insert("templates", {
    publicId,
    ownerSubject: subject,
    kind: args.kind,
    name: trimmed(args.name),
    description: trimmed(args.description),
    criteria: trimmed(args.criteria),
    skills: args.skills.map(trimmed).filter(Boolean),
    origin: "community",
    category: args.category,
    sphere: args.sphere,
    access: args.access,
    seats: args.seats,
    allowList: args.allowList.map((h) => String(h).trim().toLowerCase()).filter(Boolean),
    status: "draft",
    stackable: args.stackable,
    // C15 A4. Defaults to null: a template says nothing about expiry unless
    // its author says something.
    defaultValidityMs: args.defaultValidityMs ?? null,
    design: args.design,
    slug: null,
    currentVersionId: null,
    artStorageId: null,
    issuerSite: null,
    createdAt: now,
    updatedAt: now,
  });

  return done({ publicId, templateId });
}

export const create = mutation({
  args: {
    kind: v.string(), name: v.string(), description: v.string(), criteria: v.string(),
    skills: v.array(v.string()), category: v.string(), sphere: v.union(v.string(), v.null()),
    access: v.string(), seats: v.union(v.number(), v.null()), allowList: v.array(v.string()),
    stackable: v.boolean(), design: v.any(),
    // C15 A4. Optional, so every caller written against the pre-amendment
    // shape keeps working and gets the non-expiring default.
    defaultValidityMs: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    return await createCore(ctx, identity.subject, args as CreateArgs);
  },
});

// ── updateMeta ───────────────────────────────────────────────────────────────

/** Owner or admin. The row is fetched first so an unauthorised caller and a
 *  missing row are answered with different codes; neither leaks a design. */
export async function loadOwned(ctx: any, subject: string, templateId: any) {
  const row = await ctx.db.get(templateId);
  if (!row) return { row: null, error: fail("not-found", "No such template.") };
  if (row.ownerSubject !== subject && !isAdminSubject(subject)) {
    return { row: null, error: fail("not-authorised", "Only the owner can change this template.") };
  }
  return { row, error: null };
}

export async function updateMetaCore(ctx: any, subject: string, templateId: any, patch: Meta) {
  const { row, error } = await loadOwned(ctx, subject, templateId);
  if (error) return error;

  const merged = {
    category: patch.category ?? row.category,
    access: patch.access ?? row.access,
    stackable: patch.stackable ?? row.stackable,
    seats: patch.seats !== undefined ? patch.seats : row.seats,
    sphere: patch.sphere !== undefined ? patch.sphere : row.sphere,
  };
  const bad = checkMeta(patch, merged as any);
  if (bad) return bad;

  const next: Record<string, unknown> = { updatedAt: Date.now() };
  for (const key of ["name", "description", "criteria"] as const) {
    if (patch[key] !== undefined) next[key] = trimmed(patch[key]);
  }
  if (patch.skills !== undefined) next.skills = patch.skills.map(trimmed).filter(Boolean);
  if (patch.allowList !== undefined) {
    next.allowList = patch.allowList.map((h) => String(h).trim().toLowerCase()).filter(Boolean);
  }
  for (const key of ["category", "sphere", "access", "seats", "stackable", "defaultValidityMs"] as const) {
    if (patch[key] !== undefined) next[key] = patch[key];
  }
  await ctx.db.patch(row._id, next);
  return done();
}

export const updateMeta = mutation({
  args: {
    templateId: v.id("templates"),
    name: v.optional(v.string()), description: v.optional(v.string()),
    criteria: v.optional(v.string()), skills: v.optional(v.array(v.string())),
    category: v.optional(v.string()), sphere: v.optional(v.union(v.string(), v.null())),
    access: v.optional(v.string()), seats: v.optional(v.union(v.number(), v.null())),
    allowList: v.optional(v.array(v.string())), stackable: v.optional(v.boolean()),
    defaultValidityMs: v.optional(v.union(v.number(), v.null())),  // C15 A4
  },
  handler: async (ctx, { templateId, ...patch }) => {
    const identity = await requireIdentity(ctx);
    return await updateMetaCore(ctx, identity.subject, templateId, patch);
  },
});

// ── publish ──────────────────────────────────────────────────────────────────

export async function publishCore(ctx: any, subject: string, templateId: any, changelog: string) {
  const limited = await enforce(ctx, subject, "template.publish", "publishes");
  if (limited) return limited;

  const { row, error } = await loadOwned(ctx, subject, templateId);
  if (error) return error;

  const ownerProfile = await profileFor(ctx, row.ownerSubject);
  if (!ownerProfile?.handle) {
    return fail("no-handle", "This template has no issuing handle, so nothing could carry its provenance.");
  }

  const over = overCap(changelog, 600, "changelog");
  if (over) return over;

  // C11.3: the blocklist check runs before anything is written. A design rule
  // is advice; a mutation that returns an error is a control.
  const texts = [row.name, row.description, row.criteria, ...designTextFields(row.design)];
  const verdict = checkBlocklist(texts);
  if (verdict.unguarded) {
    console.warn(
      `blocklist is unguarded (${verdict.listSize} terms loaded from convex/data/blocklist.ts). ` +
      `Publish by ${subject} of template ${row.publicId} was not screened.`,
    );
  }
  if (verdict.hit && verdict.term) {
    console.warn(`blocked-issuer: subject ${subject} matched the term "${verdict.term}" publishing ${row.publicId}`);
    return fail("blocked-issuer", blockedMessage(verdict.term), { term: verdict.term });
  }

  const problems = validateDesign(row.design);
  if (problems.length) return fail("invalid-design", problems[0], { problems });
  if (row.design?.kind !== row.kind) {
    return fail("invalid-design", `A ${row.kind} template needs a ${row.kind} design.`);
  }

  const inconsistent = checkConsistency({
    category: row.category, access: row.access, stackable: row.stackable,
    seats: row.seats, sphere: row.sphere,
  });
  if (inconsistent) return inconsistent;

  const previous = await ctx.db
    .query("templateVersions")
    .withIndex("by_template_n", (q: any) => q.eq("templateId", row._id))
    .order("desc")
    .first();
  const n = (previous?.n ?? 0) + 1;

  const now = Date.now();
  // templateVersions is immutable once written. Awards pin versionId, so a
  // later version never changes an issued badge.
  const versionId = await ctx.db.insert("templateVersions", {
    templateId: row._id,
    n,
    design: row.design,
    changelog: trimmed(changelog),
    createdBy: subject,
    createdAt: now,
  });

  const firstPublish = !previous;
  await ctx.db.patch(row._id, {
    currentVersionId: versionId,
    status: "published",
    updatedAt: now,
  });

  if (firstPublish) {
    const owned = await ctx.db
      .query("templates")
      .withIndex("by_owner", (q: any) => q.eq("ownerSubject", row.ownerSubject))
      .collect();
    const published = owned.filter((t: any) => t.currentVersionId !== null);
    if (published.length === 1) await grantNeorgon(ctx, row.ownerSubject, "first-publish");
  }

  return done({ versionId, n });
}

export const publish = mutation({
  args: { templateId: v.id("templates"), changelog: v.string() },
  handler: async (ctx, { templateId, changelog }) => {
    const identity = await requireIdentity(ctx);
    return await publishCore(ctx, identity.subject, templateId, changelog);
  },
});

// ── archive ──────────────────────────────────────────────────────────────────

export async function archiveCore(ctx: any, subject: string, templateId: any) {
  const { row, error } = await loadOwned(ctx, subject, templateId);
  if (error) return error;
  await ctx.db.patch(row._id, { status: "archived", updatedAt: Date.now() });
  return done();
}

export const archive = mutation({
  args: { templateId: v.id("templates") },
  handler: async (ctx, { templateId }) => {
    const identity = await requireIdentity(ctx);
    return await archiveCore(ctx, identity.subject, templateId);
  },
});

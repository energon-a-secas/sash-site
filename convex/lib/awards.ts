import { awardStatus, toIso, verifyUrl } from "./shared";

/**
 * The PublicAward shaper. CONTRACTS.md C2.6.
 *
 * Two properties of this file are load-bearing:
 *
 *   design is null whenever source is "import" (C11.4). That makes "imported
 *   credentials never touch the design engine" a property of the data rather
 *   than a rule a renderer author has to remember.
 *
 *   an award whose art has been deleted returns artUrl null rather than being
 *   dropped from the result. memes-site drops such a row
 *   (convex/memes.ts:11); dropping an award because its picture vanished would
 *   silently delete a credential.
 */

type AnyCtx = { db: any; storage: { getUrl: (id: any) => Promise<string | null> } };

const handleCache = new WeakMap<object, Map<string, any>>();

async function profileBySubject(ctx: AnyCtx, subject: string) {
  let cache = handleCache.get(ctx as unknown as object);
  if (!cache) { cache = new Map(); handleCache.set(ctx as unknown as object, cache); }
  if (cache.has(subject)) return cache.get(subject);
  const row = await ctx.db
    .query("profiles")
    .withIndex("by_subject", (q: any) => q.eq("clerkSubject", subject))
    .first();
  cache.set(subject, row);
  return row;
}

/** Resolves the art on a design at read time. Never stores a serving URL. */
async function resolveArtUrl(ctx: AnyCtx, design: any): Promise<string | null> {
  const ref = design?.centre?.imageRef;
  if (typeof ref !== "string" || !ref) return null;
  try {
    return await ctx.storage.getUrl(ref as any);
  } catch {
    // A stale reference is a null picture, not a failed read of the award.
    return null;
  }
}

export type ShapeOptions = { includeOwn?: boolean; showcase?: string[] };

export async function shapeAward(ctx: AnyCtx, row: any, opts: ShapeOptions = {}) {
  const now = Date.now();
  const holder = await profileBySubject(ctx, row.holderSubject);

  const base = {
    publicId: row.publicId,
    count: row.count,
    source: row.source,
    issuedAt: toIso(row.issuedAt) as string,
    expiresAt: toIso(row.expiresAt),
    revokedAt: toIso(row.revokedAt),
    status: awardStatus(row, now),
    evidenceUrl: row.evidenceUrl ?? null,
    holderHandle: holder?.handle ?? "",
    holderDisplayName: holder?.displayName ?? "",
    verifyUrl: verifyUrl(row.publicId),
  };

  if (row.source === "import") {
    // No Sash template, so no template-derived field has a value.
    //
    // CONTRACTS.md C15 A6 settled what they hold. Before it, this returned
    // origin "community" plus four differently shaped empty values ("", null,
    // "" and 0), which asked five frontend workstreams to learn five magic
    // values meaning "not applicable". Now there is one shape: origin is
    // "imported" and every field a Sash template would have supplied is null.
    // C11.4 still sends imports down the labelled row path, keyed off source
    // and importMeta; this makes the same fact readable off origin.
    const meta = row.importMeta ?? null;
    return {
      ...base,
      kind: "badge" as const,
      name: meta?.name ?? "",
      description: meta?.description ?? "",
      criteria: meta?.criteriaNarrative ?? "",
      skills: Array.isArray(meta?.skills) ? meta.skills : [],
      origin: "imported" as const,
      category: null,
      sphere: null,
      issuerHandle: null,
      versionN: null,
      design: null,
      importMeta: meta,
      artUrl: null,
      ...(opts.includeOwn
        ? { hidden: !!row.hidden, pinned: (opts.showcase ?? []).includes(row.publicId) }
        : {}),
    };
  }

  const template = row.templateId ? await ctx.db.get(row.templateId) : null;
  const version = row.versionId ? await ctx.db.get(row.versionId) : null;
  const design = version?.design ?? null;

  // C15 A42.1. A missing issuer profile is null, never "".
  //
  // The empty string was not a smaller version of the same absence: the kit's
  // validateProvenance refuses an empty handle on a non-imported origin, so
  // renderSvg threw inside renderAwardCard and the whole profile section
  // failed to render rather than the one card. Null is the value every other
  // absent field on this object already uses, and it is the value an import
  // has carried since A6. Unreachable while nothing deletes a profile, which
  // is exactly what made A19 sit undetected.
  let issuerHandle: string | null = "neorgon";
  if (template && template.origin !== "neorgon") {
    const issuer = await profileBySubject(ctx, template.ownerSubject);
    issuerHandle = issuer?.handle ?? null;
  }

  return {
    ...base,
    kind: template?.kind ?? "badge",
    name: template?.name ?? "",
    description: template?.description ?? "",
    criteria: template?.criteria ?? "",
    skills: template?.skills ?? [],
    origin: template?.origin ?? "community",
    category: template?.category ?? "",
    sphere: template?.sphere ?? null,
    issuerHandle,
    versionN: version?.n ?? 0,
    design,
    importMeta: null,
    artUrl: await resolveArtUrl(ctx, design),
    ...(opts.includeOwn
      ? { hidden: !!row.hidden, pinned: (opts.showcase ?? []).includes(row.publicId) }
      : {}),
  };
}

/** C7.22. The group a wallet query filters on, computed the same way everywhere. */
export function awardGroup(row: any, template: any): string {
  if (row.source === "import") return "imported";
  if (template?.category === "recognition") return "recognition";
  return template?.origin === "neorgon" ? "neorgon" : "community";
}

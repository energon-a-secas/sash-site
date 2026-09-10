# Sash and Enamel: the Convex backend

One deployment, two origins. `sash.neorgon.com` and `enamel.neorgon.com` read
and write the same tables through this folder. **`projects/enamel-site/` has no
`convex/` folder**, and that is deliberate: nothing else in the fleet does it,
so the next operator will look for one and not find it. See CONTRACTS.md C8.1.

Sash owns the folder because Sash is the system of record: it holds `profiles`,
`awards`, `claims` and `kudos`, and it is the origin printed on every artefact
and inside every signed credential. Enamel writes `templates` and
`templateVersions` and nothing else.

## Layout

| File | What it is |
|---|---|
| `schema.ts` | The seven tables. `templateVersions` is immutable once written and awards pin a `versionId`, so nothing patches a row in it, ever. |
| `auth.config.ts` | A byte copy of `projects/memes-site/convex/auth.config.ts`. Eight other fleet deployments carry the same two lines. |
| `auth.ts`, `lib/admin.ts` | `ADMIN_SUBJECTS`, split on comma and trimmed. |
| `ids.ts` | Public ids and claim tokens, C4. Crockford base32 with the four ambiguous characters removed, from `crypto.getRandomValues` with rejection sampling. |
| `rate.ts`, `lib/limits.ts` | The sliding window, generalised from `projects/lockdown-site/convex/rateLimit.ts` so one function serves every bucket. Ten are C14.3; the eleventh, `claim.attempt`, is C15 A9. |
| `lib/design.ts` | The **server-side** structural validator and the C7 enum lists. |
| `lib/blocklist.ts` | The real-issuer matcher. The list itself is `data/blocklist.ts` and belongs to D1. |
| `lib/awards.ts` | The one `PublicAward` shaper. `design` is `null` for imports, which is C11.4 made a property of the data. |
| `lib/grants.ts` | `grantNeorgon`, called from inside the mutation that makes each Neorgon badge true. |
| `profiles.ts` `templates.ts` `versions.ts` `claims.ts` `awards.ts` `kudos.ts` `art.ts` `imports.ts` `ob.ts` | The C2 function surface. |
| `importFetch.ts` | `"use node"`. The only outbound network call in the campaign, behind a three-host allowlist. |
| `crons.ts` | One daily job: `art:sweepOrphans`. |
| `seed.ts` | `ensureNeorgonTemplates`, internal, the only writer of `origin: "neorgon"`. |
| `testkit.ts` | A verification harness. Internal, and inert unless `SASH_TESTKIT` is set. |
| `data/` | **D1's**, not B1's. B1 created empty stubs so a deploy could resolve the imports. |
| `tests/enums.test.mjs` | The detector for the one deliberate duplication. `npm run test:enums`. |
| `tests/limits.test.mjs` | The detector for the one relationship between two rate-limit buckets. `npm run test:limits`. |
| `tests/seed-idempotence.test.mjs` | The detector for C15 A25, the seed's order-sensitive compare. `npm run test:seed`. |

## The C15 amendments this folder carries

B1 built against CONTRACTS.md as frozen and reported four gaps rather than
inventing an answer. C15 ruled on all four and B2 applied them. B3 then
applied three more, A21, A25 and A28.1.

| # | What changed here |
|---|---|
| A4 | `templates.defaultValidityMs`, optional, settable on create and updateMeta. `claims:redeem` computes the award's `expiresAt` through `expiryFor` in `claims.ts`. Before it, every claimed award was non-expiring. |
| A5 | `awards.claimId`, required and nullable. Set at redeem, null at every other insert site. `claims:claimants` filters on it exactly instead of guessing from `issuedAt`. |
| A6 | `origin` gained `imported`. An imported award reports `origin: "imported"` with `category`, `sphere`, `issuerHandle` and `versionN` all **null**, replacing four differently shaped empty values. |
| A9 | A second limiter, `claim.attempt`, keyed by identity and run **before** the token lookup, so probing the token space costs something. C3.3's `claim.redeem` check stays exactly where it was. |
| A21 | `ClaimPreview` gained `defaultValidityMs: number \| null`, so a visitor learns the badge expires **before** signing in rather than after claiming. Read through `validityFor`, the same function `expiryFor` uses, so the preview cannot promise what redeem will not do. |
| A25 | `seed.ts` compares with `sameValue` from `lib/shared.ts`, not `JSON.stringify`. Convex returns fields alphabetically and the catalogue builds them in its own order, so the old compare was always true and every run minted fifteen immutable versions while reporting nothing changed. |
| A28.1 | `lib/blocklist.ts`'s header now names the two things the matcher does **not** cover, plurals and a term spelled out with separators, instead of implying it covers everything. |

**`defaultValidityMs` absent is not `defaultValidityMs` zero.** `expiryFor` in
`claims.ts` refuses to do arithmetic on anything it has not first proved is a
positive finite number, so absent, null, 0, a negative and NaN all leave the
award non-expiring. `now + undefined` is NaN and a null coerced to zero expires
an award at the instant it is claimed, and that is the failure A4 names by
name. `testkit:read claims:expiryProbe` exercises all six inputs at once.

**`claims:claimants` under-reports one case and no test catches it.** A
stackable template redeemed by the same holder through two different links
mints one award row and increments its count, so the row carries the id of the
link that minted it and the second link reports no claimant for that holder. A
single column can only name one link. This replaces an over-report, which is
the worse error for an issuer dashboard, but it is not exact.

## Gotchas

**`https://sash.neorgon.com/ob/keys/1.json` must never move, never 404 and never
change content.** If it does, every badge Sash has ever exported becomes
unverifiable at once. Key rotation means publishing `2.json` and keeping
`1.json` forever.

**The C7 enums are written twice on purpose**, here and in
`packages/neorgon-ui/insignia/schema.js`, because the Convex runtime cannot
import `packages/`. A client-side validator is advice and a server-side one is
a control. `npm run test:enums` is what keeps them in step; if it exits 2 the
kit is not on disk and nothing was compared, which is not a pass.

**`imports.ts` is not a `"use node"` file even though its fetch runs in Node.**
A Node file can only export actions and this one has to export mutations too,
so the fetch lives in `importFetch.ts` and `imports:fetchPreview` calls it. The
public name is unchanged.

**Do not accept SVG uploads.** Convex serves the uploaded content type verbatim
with no `nosniff`, no `Content-Disposition` and no CSP, so a stored SVG hosts
script on the same origin as this deployment's API endpoints. `art:attach`
reads the `_storage` metadata rather than trusting the client, and deletes the
file on refusal.

**Two user-facing reads used to walk a whole table, and nothing would have told
you.** C15 A55: `profiles:claimHandle` collected every profile row to compare a
count against `EARLY_ADOPTER_CUTOFF`, and `claims:mine` with no `templateId`
collected every claim row in the deployment before filtering `createdBy` in
JavaScript. Both are bounded now, by `.take(EARLY_ADOPTER_CUTOFF)` and by the
`by_creator` index A55 added to `claims`. **What detects a regression:**
`testkit:read probe:scans` runs the old read and the new one side by side on
the live table and reports the row counts, so `claims.newRead.foreign` going
above 0, or `earlyAdopter[].rowsRead` exceeding its cutoff, is the whole
failure. No unit test catches either, because both are read-volume properties
and both answer correctly at fixture scale. `probe:scans` is the only thing in
the tree that would have caught them, and it has to be run to catch anything.

**A residual on the other branch of `claims:mine`:** with a `templateId` it
walks `by_template`, so a caller who passes a `templateId` they do not own
reads that template's claim rows before the `createdBy` filter discards them.
Nothing leaves the function and the read is bounded by one template, and
`createCore` refuses a link on a template the caller does not own, so those rows
are that template owner's. Closing it exactly needs a compound
`by_creator_template` index, which is more than A55 ruled.

**Deleting art on replace is wrong here.** `templateVersions` is immutable and
awards pin a version, so an old version is still serving its art. Only a draft
with no versions deletes on replace; everything else waits for the sweep.

## Running it

```bash
cd projects/sash-site
npx convex dev --once        # push to the dev deployment. This is not a deploy.
npx convex deploy            # production, for anything the public touches
npx convex run seed:ensureNeorgonTemplates
npm test                     # test:enums, test:limits and test:seed
```

No test needs a deployment. `test:enums` reads two files and compares their
enum lists; `test:limits` reads one and checks that `claim.attempt` is looser
than `claim.redeem`, because if it were not, the C14.3 redeem limiter would be
unreachable and would never run again; `test:seed` runs the seed's own
comparison over the real catalogue and asserts `seed.ts` still calls it.

`test:seed` imports `lib/shared.ts` and `data/catalog.ts` directly, which Node
strips the types of from 22.18 onward. On an older runtime it exits **2**, the
same "nothing was compared" code `test:enums` uses for a missing kit. Two is
not a pass.

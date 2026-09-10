/**
 * The rate-limit table. CONTRACTS.md C14.3.
 *
 * In lib/ rather than in rate.ts so a "use node" action can read a bucket's
 * numbers without importing a module that registers an internalMutation.
 * Every number here is cheap to change: the table is the only definition.
 *
 * Ten of the eleven buckets are C14.3 verbatim. "claim.attempt" is the
 * eleventh and it is CONTRACTS.md C15 A9, which requires a cheap attempt limiter before
 * claims:redeem looks a token up so that probing the 110-bit token space is
 * not free. **C14.3's table has no row for it and A9 names no numbers**, so 60
 * an hour is B2's proposal and delivery-lead owns the ruling. The reasoning:
 * it has to sit above claim.redeem's 30, because a cap at or below 30 would
 * fire first on every honest user and turn the C14.3 redeem limiter into dead
 * code. 60 leaves an honest holder 30 successful claims plus 30 mistyped,
 * expired or revoked links in an hour, and still caps a prober at 60 guesses
 * an hour against 2^110 tokens.
 *
 * What detects a wrong number here: convex/tests/limits.test.mjs asserts that
 * claim.attempt's max is strictly greater than claim.redeem's, which is the
 * one relationship between the two that has to hold. Run it with
 * `npm run test:limits`.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type LimitName =
  | "handle.claim"
  | "template.create"
  | "template.publish"
  | "claim.create"
  | "claim.attempt"
  | "claim.redeem"
  | "kudos.send"
  | "kudos.to"
  | "art.upload"
  | "import.fetch"
  | "ob.sign";

export const LIMITS: Record<LimitName, { max: number; windowMs: number }> = {
  "handle.claim": { max: 5, windowMs: HOUR },          // handle squatting
  "template.create": { max: 20, windowMs: HOUR },      // database growth
  "template.publish": { max: 30, windowMs: HOUR },     // the blocklist check runs here
  "claim.create": { max: 50, windowMs: HOUR },         // token generation
  "claim.attempt": { max: 60, windowMs: HOUR },        // C15 A9, see the header note
  "claim.redeem": { max: 30, windowMs: HOUR },         // seat exhaustion on someone else's link
  "kudos.send": { max: 30, windowMs: DAY },            // recognition spam
  "kudos.to": { max: 3, windowMs: DAY },               // stacking on one target
  "art.upload": { max: 30, windowMs: DAY },            // the 1 GB storage budget
  "import.fetch": { max: 20, windowMs: HOUR },         // this one leaves our network
  "ob.sign": { max: 60, windowMs: HOUR },              // a Node action per call
};

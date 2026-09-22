import { BLOCKLIST } from "../data/blocklist";

/**
 * The real-issuer blocklist matcher. CONTRACTS.md C11.3.
 *
 * The list itself is data and belongs to D1 at convex/data/blocklist.ts, so it
 * grows without a schema change or a code review. This file is the control:
 * templates:publish calls it before it writes anything and refuses on a hit.
 * A design rule is advice, a mutation that returns an error is a control.
 *
 * Matching is case-insensitive, accent-folded and whole-word, after runs of
 * non-alphanumeric characters collapse to single spaces. It is deliberately
 * not a substring match: "Amazonian" must not trip "amazon". Multi-word terms
 * such as "amazon web services" match as a phrase of whole words.
 *
 * **What that does and does not cover.** C15 A28.1, because a comment that
 * overstates a control is how a future author adds one term where two were
 * needed, and this is a legal-risk control.
 *
 *   Covered: case and accents, so no term needs a variant for either.
 *   "AWS", "Aws" and "aws" fold to one string, and "Atlássian" trips
 *   "atlassian". A hyphen is a word boundary, which is the matcher working
 *   rather than a false positive: "Snowflake-free" folds to "snowflake free",
 *   the term is present as a whole word, and it is refused. So is the
 *   possessive "Snowflake's", which folds to "snowflake s".
 *
 *   **Not covered: plurals.** Nothing stems. " snowflakes " does not contain
 *   " snowflake ", so a plural walks straight past a singular entry. If a
 *   term needs both forms, **both forms go in the list**. No other inflection
 *   or misspelling is covered either.
 *
 *   **Not covered: a term spelled out with separators.** Every run of
 *   non-alphanumerics becomes a space, and a space is a boundary, so "A.W.S."
 *   folds to "a w s" and does not trip "aws". Punctuation inside a term
 *   loosens the match, it does not tighten it.
 *
 *   Both gaps hold against an honest author naming a real issuer, which is
 *   the threat C11 addresses. Neither holds against someone evading the list
 *   on purpose, and nothing here should be read as claiming otherwise.
 *
 * data/blocklist.ts records the near misses this whole-word rule is meant to
 * let through, and is D1's file. This one is the matcher.
 */

export type BlocklistVerdict = {
  hit: boolean;
  term: string | null;
  listSize: number;
  /** True when the list is empty or malformed, so the caller can say so. */
  unguarded: boolean;
};

/** Lowercase, strip diacritics, collapse anything non-alphanumeric to a space. */
export function foldForMatch(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function loadList(): { terms: string[]; malformed: boolean } {
  const raw: unknown = BLOCKLIST;
  if (!Array.isArray(raw)) return { terms: [], malformed: true };
  const terms = raw.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
  return { terms, malformed: terms.length !== raw.length };
}

/**
 * Checks a set of author-supplied strings against the list.
 *
 * An empty or malformed list does not silently pass: the verdict carries
 * `unguarded: true` and the caller logs it, so "nothing was blocked" and
 * "there was nothing to block with" are distinguishable in the logs.
 */
export function checkBlocklist(texts: readonly string[]): BlocklistVerdict {
  const { terms, malformed } = loadList();
  const unguarded = terms.length === 0 || malformed;

  if (terms.length === 0) return { hit: false, term: null, listSize: 0, unguarded };

  const haystacks = texts
    .filter((t) => typeof t === "string" && t.trim().length > 0)
    .map((t) => ` ${foldForMatch(t)} `);

  for (const term of terms) {
    const needle = ` ${foldForMatch(term)} `;
    if (needle.trim().length === 0) continue;
    for (const hay of haystacks) {
      if (hay.includes(needle)) {
        return { hit: true, term, listSize: terms.length, unguarded };
      }
    }
  }
  return { hit: false, term: null, listSize: terms.length, unguarded };
}

/** C11.3's message, frozen wording. */
export function blockedMessage(term: string): string {
  return (
    `A Sash template cannot name ${term} as its issuer. ` +
    `The issuer of every Sash credential is Sash. ` +
    `Take the name out, or say it another way.`
  );
}

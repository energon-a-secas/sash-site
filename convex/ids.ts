/**
 * Public ids and claim tokens. CONTRACTS.md C4, a one-way door: these strings
 * are printed on certificates, typed back in off paper, and are the credential
 * id inside every exported Open Badge.
 *
 * Crockford base32 lowercase, with i, l, o and u removed because a serial is
 * read off paper. Not Math.random, not a counter, not a hash of anything.
 */

export const ID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
export const PUBLIC_ID_LENGTH = 10;   // 50 bits
export const TOKEN_LENGTH = 22;       // 110 bits, a bearer secret rather than a label

export const PUBLIC_ID_RE = /^[0-9abcdefghjkmnpqrstvwxyz]{10}$/;
export const TOKEN_RE = /^[0-9abcdefghjkmnpqrstvwxyz]{22}$/;

/**
 * Rejection sampling: a byte at or above 224 is discarded rather than folded,
 * because 256 is not a multiple of 32 and a plain modulo would make the first
 * eight symbols more likely than the rest.
 */
export function randomCode(length: number): string {
  let out = "";
  while (out.length < length) {
    const bytes = new Uint8Array(length * 2);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b >= 224) continue;
      out += ID_ALPHABET[b % 32];
      if (out.length === length) break;
    }
  }
  return out;
}

type IndexedCtx = {
  db: {
    query: (table: string) => any;
  };
};

const MAX_TRIES = 5;

/**
 * Mints a public id unique in `table`. Checked against the by_public_id index
 * inside the minting mutation and retried at most five times, then the caller
 * returns { ok:false, code:"id-collision" } rather than looping. Returns null
 * on exhaustion so the caller owns the message.
 */
export async function mintPublicId(
  ctx: IndexedCtx,
  table: "templates" | "awards",
): Promise<string | null> {
  for (let i = 0; i < MAX_TRIES; i++) {
    const candidate = randomCode(PUBLIC_ID_LENGTH);
    const clash = await ctx.db
      .query(table)
      .withIndex("by_public_id", (q: any) => q.eq("publicId", candidate))
      .first();
    if (!clash) return candidate;
  }
  return null;
}

/** Same rules as mintPublicId, against the claims by_token index. */
export async function mintToken(ctx: IndexedCtx): Promise<string | null> {
  for (let i = 0; i < MAX_TRIES; i++) {
    const candidate = randomCode(TOKEN_LENGTH);
    const clash = await ctx.db
      .query("claims")
      .withIndex("by_token", (q: any) => q.eq("token", candidate))
      .first();
    if (!clash) return candidate;
  }
  return null;
}

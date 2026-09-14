"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { createHash, createSign } from "node:crypto";
import { adminSubjects } from "./lib/admin";
import { LIMITS } from "./lib/limits";
import { retryAfterText } from "./lib/shared";

/**
 * The Open Badges 3.0 signer. CONTRACTS.md C9.2 and C9.3.
 *
 * node:crypto createSign('RSA-SHA256'), not Web Crypto. No Convex document
 * enumerates which algorithms the default runtime's SubtleCrypto exposes and
 * R1 could not establish whether RSASSA-PKCS1-v1_5 is among them. The Node
 * action is certain, and certainty is what a signature needs.
 *
 * The two URLs below are frozen literals rather than reads of
 * SASH_PUBLIC_ORIGIN. They are a permanent public commitment: every badge Sash
 * has ever exported becomes unverifiable the moment the key URL moves, so it
 * must not be able to change with a deployment-level environment variable.
 * Key rotation means publishing 2.json and keeping 1.json forever.
 */

const OB_ORIGIN = "https://sash.neorgon.com";
const KEY_URL = `${OB_ORIGIN}/ob/keys/1.json`;
const ISSUER_ID = `${OB_ORIGIN}/ob/issuer.json`;
const RECIPIENT_SALT = "sash-v1";

/**
 * C9.2 item 3: issuer.url is the one field the verifier dereferences, and an
 * unreachable one produces a WARNING, so it is omitted until the site is
 * published. Flip this to true in the same change that publishes
 * sash.neorgon.com. It is a constant rather than an environment variable
 * because it is a property of the world, not of a deployment.
 */
const ISSUER_URL_IS_LIVE = true;

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function numericDate(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/**
 * Builds the C9.2 credential and signs it. Shared by the public action and by
 * the guarded test action below, so the bytes exercised in verification are
 * the bytes that ship.
 */
function buildAndSign(found: any, opts: { email: string }) {
  const pem = process.env.OB_SIGNING_KEY as string;
  const a = found.award;

  // C15 A42.1 made issuerHandle null when the issuing profile row is missing.
  // Every other consumer degrades; this one must not. A signed credential
  // naming "null" as its achievement creator, at a URL of u.html?h=null, is a
  // permanent artefact asserting something false, and the signature is what
  // makes it permanent. Refusing is the only honest option here.
  if (typeof a.issuerHandle !== "string" || !a.issuerHandle) {
    return {
      ok: false as const,
      code: "issuer-missing",
      message: "This award's issuer profile is missing, so Sash cannot name its creator.",
    };
  }

  const credentialId = a.verifyUrl;

  // C9.2 item 4: a hashed identifier, never a plaintext address, so the
  // downloaded file does not leak the holder's email. When an admin signs on
  // someone else's behalf the caller's email is the wrong email, so the
  // spec's other option is used: credentialSubject.id plus a sub claim.
  const email = opts.email;
  const credentialSubject: Record<string, unknown> = {
    type: ["AchievementSubject"],
    achievement: {
      id: `${credentialId}#achievement`,
      type: ["Achievement"],
      achievementType: "Badge",
      name: a.name,
      description: a.description,
      criteria: { narrative: a.criteria },
      creator: {
        id: `${OB_ORIGIN}/u.html?h=${a.issuerHandle}`,
        type: ["Profile"],
        name: a.issuerHandle,
      },
    },
  };
  let subjectId: string | null = null;
  if (email) {
    const digest = createHash("sha256").update(RECIPIENT_SALT + email.toLowerCase()).digest("hex");
    credentialSubject.identifier = [{
      type: "IdentityObject",
      identityType: "emailAddress",
      hashed: true,
      salt: RECIPIENT_SALT,
      identityHash: `sha256$${digest}`,
    }];
  } else {
    subjectId = `${OB_ORIGIN}/u.html?h=${a.holderHandle}`;
    credentialSubject.id = subjectId;
  }

  const issuer: Record<string, unknown> = {
    id: ISSUER_ID,
    type: ["Profile"],
    name: "Sash",
    description: "Sash issues parody badges. Nothing here is an accredited credential.",
  };
  if (ISSUER_URL_IS_LIVE) issuer.url = `${OB_ORIGIN}/`;

  const credential: Record<string, unknown> = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
      // Without this inline map a custom termsOfUse type fails with
      // "Undefined JSON-LD term: SashParodyPolicy". The first two entries
      // stay fixed and ours goes third.
      { SashParodyPolicy: "https://neorgon.com/ns/sash#ParodyPolicy" },
    ],
    id: credentialId,
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    // C11.5: the issuer is always Sash and the community author is always
    // achievement.creator. Never the reverse, or a parody badge becomes a
    // machine-verifiable claim about somebody else.
    issuer,
    validFrom: a.issuedAt,
    name: a.name,
    credentialSubject,
    // The parody policy travels inside the signed payload, so it cannot be
    // stripped without breaking the signature.
    termsOfUse: [{ type: "SashParodyPolicy", id: `${OB_ORIGIN}/policy.html` }],
  };
  if (a.expiresAt) credential.validUntil = a.expiresAt;

  const payload: Record<string, unknown> = {
    ...credential,
    iss: ISSUER_ID,
    jti: credentialId,
    nbf: numericDate(a.issuedAt),
  };
  if (subjectId) payload.sub = subjectId;
  const exp = numericDate(a.expiresAt);
  if (exp !== null) payload.exp = exp;

  // Ship kid, never jwk. A VC-JWT carrying the public key inline validates
  // happily with a key minted seconds earlier for a domain that does not
  // exist, which makes the signature meaningless.
  const header = { alg: "RS256", typ: "JWT", kid: KEY_URL };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;

  let signature: string;
  try {
    const signer = createSign("RSA-SHA256");
    signer.update(signingInput);
    signer.end();
    signature = b64url(signer.sign(pem));
  } catch (err: any) {
    console.warn(`ob:credentialFor could not sign: ${err?.message}`);
    return { ok: false as const, code: "sign-failed", message: "The signer is misconfigured." };
  }

  return { ok: true as const, jws: `${signingInput}.${signature}`, credential };
}

export const credentialFor = action({
  args: { publicId: v.string() },
  handler: async (ctx, { publicId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const { max, windowMs } = LIMITS["ob.sign"];
    const verdict = await ctx.runMutation(internal.rate.recordAndCheck, {
      bucket: `${identity.subject}|ob.sign`, max, windowMs,
    });
    if (!verdict.allowed) {
      return {
        ok: false as const, code: "rate-limited",
        message: `Too many signatures. Try again in ${retryAfterText(verdict.retryAfterMs)}.`,
        retryAfterMs: verdict.retryAfterMs,
      };
    }

    const found: any = await ctx.runQuery(internal.awards.forCredential, { publicId });
    if (!found) return { ok: false as const, code: "not-found", message: "No award with that id." };

    const isHolder = found.holderSubject === identity.subject;
    const isAdmin = adminSubjects().includes(identity.subject);
    if (!isHolder && !isAdmin) {
      // A visitor on a public verify page gets the degraded export instead:
      // the PNG without the openbadgecredential chunk, and one line of UI
      // saying so. C9.3. That is a contract, not an accident.
      return {
        ok: false as const, code: "not-holder",
        message: "Sign in as the holder to download the verifiable badge.",
      };
    }
    if (found.source === "import") {
      return {
        ok: false as const, code: "not-issuable",
        message: "Sash does not re-issue a credential it did not create.",
      };
    }
    if (found.award.status === "revoked") {
      return { ok: false as const, code: "revoked", message: "This award was revoked." };
    }

    const pem = process.env.OB_SIGNING_KEY as string;
    if (!pem) {
      return {
        ok: false as const, code: "no-key",
        message: "This deployment has no Open Badges signing key.",
      };
    }

    return buildAndSign(found, { email: isHolder && typeof identity.email === "string" ? identity.email : "" });
  },
});


/**
 * The same signing path with an explicit subject, for verification only.
 * Internal, and inert unless SASH_TESTKIT is set. It exists because
 * `npx convex run` has no identity, so the public action can only be observed
 * throwing "Not authenticated" and the signature itself would otherwise never
 * be exercised before release. Every authorisation rule above is re-applied
 * here against the supplied subject rather than skipped.
 */
export const signForTest = internalAction({
  args: { subject: v.string(), email: v.string(), publicId: v.string() },
  handler: async (ctx, { subject, email, publicId }) => {
    if ((process.env.SASH_TESTKIT || "").trim() !== "on") {
      return { ok: false as const, code: "testkit-disabled", message: "SASH_TESTKIT is not set." };
    }
    const found: any = await ctx.runQuery(internal.awards.forCredential, { publicId });
    if (!found) return { ok: false as const, code: "not-found", message: "No award with that id." };

    const isHolder = found.holderSubject === subject;
    const isAdmin = adminSubjects().includes(subject);
    if (!isHolder && !isAdmin) {
      return {
        ok: false as const, code: "not-holder",
        message: "Sign in as the holder to download the verifiable badge.",
      };
    }
    if (found.source === "import") {
      return { ok: false as const, code: "not-issuable", message: "Sash does not re-issue a credential it did not create." };
    }
    if (found.award.status === "revoked") {
      return { ok: false as const, code: "revoked", message: "This award was revoked." };
    }
    if (!process.env.OB_SIGNING_KEY) {
      return { ok: false as const, code: "no-key", message: "This deployment has no Open Badges signing key." };
    }
    return buildAndSign(found, { email: isHolder ? email : "" });
  },
});

/**
 * Handles. CONTRACTS.md C4.2, a one-way door: a handle is claimed once, is
 * printed into provenance.issuerHandle on every rendered artefact, and sits
 * inside every signed Open Badges payload. There is no rename in v1 because a
 * rename cannot reach an artefact somebody has already downloaded.
 */

export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,29}$/;

/** Frozen list. A handle here is refused with code "handle-reserved". */
export const RESERVED_HANDLES: readonly string[] = [
  "admin", "api", "assets", "badge", "badges", "claim", "css", "embed", "enamel",
  "help", "img", "index", "js", "neorgon", "ob", "policy", "profile", "root",
  "sash", "settings", "sitemap", "static", "support", "system", "u", "user",
  "users", "verify", "www",
];

/** Lowercased and trimmed. A handle differing only in case is the same handle. */
export function normalizeHandle(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/** Returns an error code, or null when the handle is acceptable. */
export function handleProblem(handle: string): "handle-invalid" | "handle-reserved" | null {
  if (!HANDLE_RE.test(handle)) return "handle-invalid";
  if (RESERVED_HANDLES.includes(handle)) return "handle-reserved";
  return null;
}

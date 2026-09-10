/**
 * Admin identity. CONTRACTS.md C14.1, copied from
 * projects/memes-site/convex/auth.ts:3-8.
 *
 * It lives in lib/ rather than in auth.ts so a "use node" action can import it
 * without pulling a registered Convex query into the Node bundle.
 */
export function adminSubjects(): string[] {
  return (process.env.ADMIN_SUBJECTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdminSubject(subject: string | null | undefined): boolean {
  if (!subject) return false;
  return adminSubjects().includes(subject);
}

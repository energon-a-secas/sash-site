import { query } from "./_generated/server";
import { adminSubjects, isAdminSubject } from "./lib/admin";

export { adminSubjects, isAdminSubject };

/** True when the signed-in Clerk user is listed in Convex env ADMIN_SUBJECTS. */
export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    return adminSubjects().includes(identity.subject);
  },
});

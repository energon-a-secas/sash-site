import type { AuthConfig } from "convex/server";

const CLERK_JWT_ISSUER = "https://clerk.neorgon.com";

export default {
  providers: [
    {
      domain: CLERK_JWT_ISSUER,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;

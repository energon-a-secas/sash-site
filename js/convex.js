// projects/{sash,enamel}-site/js/convex.js  -- owned by B1, do not edit in a frontend workstream
import { ConvexHttpClient } from "https://esm.sh/convex@1.21.0/browser";

const meta = document.querySelector('meta[name="neo-convex-url"]');
const CONVEX_URL = meta && meta.content;
if (!/^https:\/\/[a-z-]+-\d+\.convex\.cloud$/.test(CONVEX_URL || '')) {
  throw new Error('neo-convex-url meta tag is missing or malformed');
}

export const convex = new ConvexHttpClient(CONVEX_URL);

export const api = {
  profiles: { me: "profiles:me", byHandle: "profiles:byHandle",
              claimHandle: "profiles:claimHandle", updateMine: "profiles:updateMine",
              setShowcase: "profiles:setShowcase", setAwardHidden: "profiles:setAwardHidden" },
  templates: { mine: "templates:mine", get: "templates:get", listPublic: "templates:listPublic",
               create: "templates:create", updateMeta: "templates:updateMeta",
               publish: "templates:publish", archive: "templates:archive" },
  versions: { list: "versions:list", get: "versions:get", saveDraft: "versions:saveDraft" },
  claims:   { create: "claims:create", mine: "claims:mine", preview: "claims:preview",
              redeem: "claims:redeem", revoke: "claims:revoke", claimants: "claims:claimants" },
  awards:   { byPublicId: "awards:byPublicId", forHandle: "awards:forHandle",
              mine: "awards:mine", revoke: "awards:revoke" },
  kudos:    { send: "kudos:send", forAward: "kudos:forAward" },
  imports:  { fetchPreview: "imports:fetchPreview", save: "imports:save", remove: "imports:remove" },
  art:      { getUploadUrl: "art:getUploadUrl", attach: "art:attach" },
  ob:       { credentialFor: "ob:credentialFor" },
  auth:     { isAdmin: "auth:isAdmin" },
};

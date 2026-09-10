/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as art from "../art.js";
import type * as auth from "../auth.js";
import type * as awards from "../awards.js";
import type * as claims from "../claims.js";
import type * as crons from "../crons.js";
import type * as data_blocklist from "../data/blocklist.js";
import type * as data_catalog from "../data/catalog.js";
import type * as ids from "../ids.js";
import type * as importFetch from "../importFetch.js";
import type * as imports from "../imports.js";
import type * as kudos from "../kudos.js";
import type * as lib_admin from "../lib/admin.js";
import type * as lib_awards from "../lib/awards.js";
import type * as lib_blocklist from "../lib/blocklist.js";
import type * as lib_design from "../lib/design.js";
import type * as lib_grants from "../lib/grants.js";
import type * as lib_handles from "../lib/handles.js";
import type * as lib_importMeta from "../lib/importMeta.js";
import type * as lib_limits from "../lib/limits.js";
import type * as lib_shared from "../lib/shared.js";
import type * as ob from "../ob.js";
import type * as profiles from "../profiles.js";
import type * as rate from "../rate.js";
import type * as seed from "../seed.js";
import type * as templates from "../templates.js";
import type * as testkit from "../testkit.js";
import type * as versions from "../versions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  art: typeof art;
  auth: typeof auth;
  awards: typeof awards;
  claims: typeof claims;
  crons: typeof crons;
  "data/blocklist": typeof data_blocklist;
  "data/catalog": typeof data_catalog;
  ids: typeof ids;
  importFetch: typeof importFetch;
  imports: typeof imports;
  kudos: typeof kudos;
  "lib/admin": typeof lib_admin;
  "lib/awards": typeof lib_awards;
  "lib/blocklist": typeof lib_blocklist;
  "lib/design": typeof lib_design;
  "lib/grants": typeof lib_grants;
  "lib/handles": typeof lib_handles;
  "lib/importMeta": typeof lib_importMeta;
  "lib/limits": typeof lib_limits;
  "lib/shared": typeof lib_shared;
  ob: typeof ob;
  profiles: typeof profiles;
  rate: typeof rate;
  seed: typeof seed;
  templates: typeof templates;
  testkit: typeof testkit;
  versions: typeof versions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

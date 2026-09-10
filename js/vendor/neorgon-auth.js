/**
 * Neorgon shared browser auth: Clerk session + ConvexHttpClient JWT (template "convex").
 * Lives in the neorgon-auth-client repo; sites load this module from their deployed URL
 * or from the local CORS dev server (make serve).
 *
 * Sites that set a Content-Security-Policy meta/header must allow Clerk + Turnstile, e.g.:
 * script-src … https://*.clerk.accounts.dev https://challenges.cloudflare.com;
 * (clerk-js is loaded from your own Clerk Frontend API host, derived from the key)
 * connect-src … https://challenges.cloudflare.com https://*.clerk.accounts.dev https://api.clerk.com …;
 * frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev;
 * worker-src 'self' blob:;
 * See https://clerk.com/docs/security/clerk-csp and Cloudflare Turnstile CSP docs.
 *
 * @typedef {object} NeorgonAuthOptions
 * @property {import("https://esm.sh/convex@1.21.0/browser").ConvexHttpClient} convex
 * @property {string} publishableKey Clerk publishable key (pk_test_… / pk_live_…)
 * @property {HTMLElement | string} signInHost Mount target for SignIn (selector or element)
 * @property {HTMLElement | string} [userButtonHost] Mount target for UserButton when signed in
 * @property {(info: { clerk: import("@clerk/clerk-js").LoadedClerk, hasSession: boolean }) => void} [onSession] Called after load and when session changes
 * @property {"modal" | "inline"} [signInMode] "inline" (default) mounts the form into `signInHost`,
 *   which is right when the host is already a real dialog: character-sheet and buyhacks both own one.
 *   "modal" opens Clerk's own centred dialog via `openSignIn` and leaves `signInHost` alone, which is
 *   what a site wants when its only host is a header dropdown too small for the form. Default is
 *   inline because that is what existed, and a shared kit should not change five sites to serve one.
 * @property {Record<string, unknown>} [signInProps] Extra props passed to Clerk `mountSignIn` / `openSignIn` (e.g. `appearance`, `localization`).
 * @property {Record<string, unknown>} [userButtonProps] Extra props passed to Clerk `mountUserButton` (e.g. `showName: false`).
 * @property {Record<string, unknown>} [clerkAppearance] Passed to `clerk.load({ appearance })` so UserButton popover, menus, and sign-out match your theme.
 */

/** @param {HTMLElement | string | undefined} host */
function el(host) {
  if (!host) return null;
  if (typeof host === "string") return document.querySelector(host);
  return host;
}

/**
 * ConvexHttpClient.setAuth() only accepts a JWT string (unlike ConvexClient WebSocket, which
 * accepts a token fetcher). Resolve Clerk's Convex template token and set or clear auth.
 * @param {import("@clerk/clerk-js").LoadedClerk} clerk
 * @param {import("https://esm.sh/convex@1.21.0/browser").ConvexHttpClient} convex
 */
async function syncConvexHttpJwt(clerk, convex) {
  try {
    const session = clerk.session;
    if (!session) {
      convex.clearAuth();
      return;
    }
    const token = await session.getToken({ template: "convex" });
    if (token) convex.setAuth(token);
    else convex.clearAuth();
  } catch (err) {
    // Loud on purpose. This catch used to be bare, and it turns every reason a
    // token cannot be minted into the same silent outcome: the person is signed
    // in, the UI says so, and every mutation fails "Not authenticated" with
    // nothing anywhere saying why. The likeliest cause is the JWT template named
    // "convex" not existing on this Clerk instance, which is easy to miss on a
    // freshly created production instance.
    console.error(
      "Neorgon auth: could not mint the Convex token. Check that a JWT template " +
      "named \"convex\" exists on this Clerk instance (Clerk dashboard, JWT Templates).",
      err,
    );
    convex.clearAuth();
  }
}

/**
 * Load clerk-js from Clerk's own Frontend API rather than a third-party CDN.
 *
 * Measured on one machine, same minute: esm.sh delivers 1,253,349 compressed
 * bytes over 4 requests with 2 serial round trips; this path delivers 87,986
 * bytes in one. It also takes a third party out of the critical path of login.
 *
 * The host is DERIVED from the publishable key, which carries it base64-encoded
 * after the `pk_test_` / `pk_live_` prefix. That is deliberate: it means this
 * file does not name an environment, so promoting an instance from development
 * to production needs no edit here.
 *
 * Two things about this bundle, both established by loading it and looking,
 * not by reading about it:
 *   - It REQUIRES `data-clerk-publishable-key` on the script tag. Without it the
 *     bundle throws "Missing publishableKey" and never assigns window.Clerk.
 *   - window.Clerk is then a ready INSTANCE, not a constructor. Calling
 *     `new window.Clerk(key)` on it fails.
 *
 * @param {string} publishableKey
 * @returns {Promise<import("@clerk/clerk-js").LoadedClerk>}
 */
function loadClerk(publishableKey) {
  if (window.Clerk) return Promise.resolve(window.Clerk);
  const prefix = publishableKey.startsWith("pk_live_") ? "pk_live_" : "pk_test_";
  let host;
  try {
    host = atob(publishableKey.slice(prefix.length)).replace(/\$$/, "");
  } catch {
    return Promise.reject(new Error("Neorgon auth: publishable key is not decodable; expected pk_test_… or pk_live_…"));
  }
  if (!host) return Promise.reject(new Error("Neorgon auth: could not derive the Clerk host from the publishable key."));

  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://${host}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.setAttribute("data-clerk-publishable-key", publishableKey);
    s.onload = () => {
      if (window.Clerk) resolve(window.Clerk);
      else reject(new Error("Neorgon auth: clerk-js loaded but did not expose window.Clerk."));
    };
    s.onerror = () => reject(new Error(`Neorgon auth: could not load clerk-js from ${host}. Check the site's script-src allows it.`));
    document.head.appendChild(s);
  });
}

/**
 * Load Clerk, wire Convex JWT, mount Sign-In or UserButton.
 * @param {NeorgonAuthOptions} options
 * @returns {Promise<import("@clerk/clerk-js").LoadedClerk>}
 */
export async function initNeorgonClerkConvex(options) {
  const {
    convex,
    publishableKey,
    signInHost,
    userButtonHost,
    onSession,
    signInMode = "inline",
    signInProps = {},
    userButtonProps = {},
    clerkAppearance,
  } = options;
  if (!publishableKey) {
    throw new Error("Neorgon auth: set <meta name=\"clerk-publishable-key\" content=\"pk_…\"> or pass publishableKey.");
  }

  const clerk = await loadClerk(publishableKey);

  const signInEl = el(signInHost);
  const userEl = el(userButtonHost);

  let mounted = /** @type {"signin" | "user" | null} */ (null);

  function unmountClerkUi() {
    if (mounted === "signin" && signInEl) {
      try {
        clerk.unmountSignIn(signInEl);
      } catch {
        /* ignore */
      }
    }
    if (mounted === "user" && userEl) {
      try {
        clerk.unmountUserButton(userEl);
      } catch {
        /* ignore */
      }
    }
    mounted = null;
    if (signInEl) signInEl.replaceChildren();
    if (userEl) userEl.replaceChildren();
  }

  async function mountClerkUi() {
    unmountClerkUi();
    await syncConvexHttpJwt(clerk, convex);
    if (clerk.session && userEl) {
      clerk.mountUserButton(userEl, {
        ...userButtonProps,
      });
      mounted = "user";
    } else if (signInEl && signInMode === "inline") {
      // withSignUp + hash routing: stay in the mounted modal. Do not set signUpUrl /
      // fallbackRedirectUrl to location.href, that becomes a normal navigation and reloads the page.
      clerk.mountSignIn(signInEl, {
        routing: "hash",
        withSignUp: true,
        ...signInProps,
      });
      mounted = "signin";
    }
    onSession?.({ clerk, hasSession: !!clerk.session });
  }

  if (clerkAppearance != null) {
    await clerk.load({ appearance: clerkAppearance });
  } else {
    await clerk.load();
  }
  await mountClerkUi();

  if (typeof clerk.addListener === "function") {
    let prev = !!clerk.session;
    clerk.addListener(() => {
      void (async () => {
        await syncConvexHttpJwt(clerk, convex);
        const next = !!clerk.session;
        if (next !== prev) {
          prev = next;
          await mountClerkUi();
        } else {
          onSession?.({ clerk, hasSession: next });
        }
      })();
    });
  }

  // In modal mode the caller opens the dialog, because the control that should
  // open it is the site's own header button and the kit does not own that.
  clerk.neorgonOpenSignIn = () =>
    clerk.openSignIn({ withSignUp: true, ...signInProps });

  return clerk;
}

/**
 * Sign out and clear Convex credentials (call after clerk.signOut if you handle UI yourself).
 * @param {import("@clerk/clerk-js").LoadedClerk} clerk
 * @param {import("https://esm.sh/convex@1.21.0/browser").ConvexHttpClient} convex
 */
export async function neorgonSignOut(clerk, convex) {
  await clerk.signOut({ redirectUrl: window.location.href });
  convex.clearAuth();
}

/** @param {import("@clerk/clerk-js").LoadedClerk} clerk */
export function neorgonDisplayLabel(clerk) {
  const u = clerk.user;
  if (!u) return "";
  if (u.username) return u.username;
  const email = u.primaryEmailAddress?.emailAddress;
  if (email) return email.split("@")[0] || email;
  if (u.firstName) return u.firstName;
  return "Account";
}

<div align="center">

# Sash

Collect badges and certificates on one profile, claim them from expiring links, and share it as an image or an embed

[![Live][badge-site]][url-site]
[![HTML5][badge-html]][url-html]
[![CSS3][badge-css]][url-css]
[![JavaScript][badge-js]][url-js]
[![Convex][badge-convex]][url-convex]
[![Claude Code][badge-claude]][url-claude]
[![License][badge-license]](LICENSE)

[badge-site]:    https://img.shields.io/badge/live_site-0063e5?style=for-the-badge&logo=googlechrome&logoColor=white
[badge-html]:    https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white
[badge-css]:     https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white
[badge-js]:      https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black
[badge-convex]:  https://img.shields.io/badge/Convex-EE342F?style=for-the-badge&logo=convex&logoColor=white
[badge-claude]:  https://img.shields.io/badge/Claude_Code-CC785C?style=for-the-badge&logo=anthropic&logoColor=white
[badge-license]: https://img.shields.io/badge/license-MIT-404040?style=for-the-badge

[url-site]:   https://sash.neorgon.com/
[url-html]:   https://developer.mozilla.org/docs/Web/HTML
[url-css]:    https://developer.mozilla.org/docs/Web/CSS
[url-js]:     https://developer.mozilla.org/docs/Web/JavaScript
[url-convex]: https://www.convex.dev/
[url-claude]: https://claude.ai/code

</div>

---

## Overview

Sash is where a Neorgon badge lands. Somebody designs one in Enamel, hands out a
claim link, and the person who redeems it gets a credential on a page they
control: they pin the ones they want seen first, hide the ones they do not, and
share the wall as a PNG or an iframe.

Every badge is drawn with the handle that issued it, the wall it belongs to and
the address that verifies it printed into the artwork, so a badge saved as an
image still says where it came from. These are community badges. They are not a
professional qualification and nobody accredits them, which the site says on
every page rather than in a footnote.

**Live:** sash.neorgon.com

---

## Features

- **One wall, four groups** -- Neorgon badges the site grants, community badges
  grouped by what they are for, recognition other people send, and credentials
  imported from elsewhere.
- **Choose what to show** -- pin up to 24 badges into a showcase, order them,
  and hide anything you would rather not display.
- **A public profile** -- `u.html?h=<handle>` reads without an account.
- **Stacked recognition** -- a badge sent twice counts twice instead of
  appearing twice.
- **Imports stay imports** -- a credential from another issuer is listed as its
  issuer sent it, linked to the source, and never redrawn as a Sash badge.
- **PNG export** -- the whole wall or one group, with the fonts embedded so the
  picture matches the page.
- **An embeddable wall** -- one iframe snippet, no account, no tracking.

---

## Running locally

ES modules require an HTTP server (not `file://`):

```bash
make serve            # http://localhost:8884
```

The backend is Convex and lives in `convex/`. See `convex/README.md`.

```bash
npx convex dev --once   # push functions to the dev deployment
npm test                # enum, rate-limit and seed-idempotence checks
```

**Clerk refuses a production key on `localhost`.** Sign-in works on
`https://sash.neorgon.com` and nowhere else, so signed-out pages (`u.html`,
`badge.html`, `embed.html`, `policy.html`) are the ones a local server can
exercise fully. See Gotchas in `CLAUDE.md`.

---

## Architecture

```
sash-site/
├── index.html          # My wallet: awards, pin, hide, reorder, profile, handle
├── u.html              # Public profile, readable with no account
├── badge.html          # Verify one award
├── claim.html          # Redeem a claim link
├── embed.html          # The iframe widget
├── import.html         # Import a credential from elsewhere
├── send.html           # Send recognition
├── policy.html         # What a Sash badge is, and is not
├── css/
│   ├── style.css       # Site styles. Tokens come from the CDN base.css
│   └── neorgon-*.css   # Vendored kits: header, themes, footer, beacon, insignia
├── js/
│   ├── app.js          # Entry point, dispatches on body[data-page]
│   ├── state.js        # Shared state, Convex calls, the Clerk session
│   ├── render.js       # The profile head, the groups, the showcase
│   ├── events.js       # Every listener on every page
│   ├── wallet.js       # index.html page wiring
│   ├── profile.js      # u.html page wiring
│   ├── utils.js        # Shared helpers
│   ├── convex.js       # The function-name map (owned by the backend)
│   ├── insignia/       # Vendored renderer, exporter and award grid
│   └── vendor/         # Vendored Clerk and Convex auth client
├── convex/             # The backend. Enamel uses this deployment too
├── ob/                 # Static Open Badges issuer documents
└── Makefile
```

---

<div align="center">
<sub>Part of <a href="https://neorgon.com/">Neorgon</a></sub>
</div>

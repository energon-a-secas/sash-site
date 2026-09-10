/**
 * The seeded Neorgon catalogue. CONTRACTS.md C2.9, C7.3, C7.4, C11.7.
 *
 * Two exports, both consumed by `convex/seed.ts` and `convex/lib/grants.ts`.
 * `NEORGON_TEMPLATES` are ordinary `templates` rows with `origin: "neorgon"`
 * and `ownerSubject: "system"`. `seed:ensureNeorgonTemplates` upserts them by
 * `slug`, so **a slug is permanent once seeded** and renaming one creates a
 * second row rather than moving the first.
 *
 * The catalogue holds two different kinds of thing:
 *
 *   **Five milestones**, one per grant point in C2.9. Each is granted from
 *   inside the mutation that makes it true, by `grantNeorgon(ctx, subject,
 *   slug)`, which finds the row by the slug below. Delete a slug here and that
 *   grant silently stops: `grantNeorgon` logs and returns null rather than
 *   failing the mutation, which is right for a claim that must not break, and
 *   is also why nothing shouts if a slug is lost.
 *
 *     first-claim       claims:redeem        the holder's first award of any kind
 *     profile-complete  profiles:updateMine  displayName, headline and avatarCode all set
 *     first-publish     templates:publish    the owner's first published template
 *     ten-sent          kudos:send           the sender's tenth kudos row
 *     early-adopter     profiles:claimHandle profiles row count below 500 at claim time
 *
 *   **Ten recognition templates**, spread across the three spheres of C7.4.
 *   These exist so `kudos:send` has something to send on the day the site opens:
 *   it requires a template that is published and `stackable`, and until these
 *   are seeded there is none. They are `category: "recognition"` with a non-null
 *   `sphere`, which is the pairing C2.3 enforces, and they are the only rows
 *   here that stack.
 *
 * C11.7: none of the four accreditation words that contract names appears in
 * any system-generated string, which includes every name, description and
 * criteria below. The rule is grep-able, and it is graded by
 * `packages/neorgon-ui/tests/insignia.test.mjs`, which walks this whole project
 * tree looking for them. This file does not spell them out, because a comment
 * saying "do not write X" is still a file containing X.
 *
 * C12: no name, description, criteria, arc or ribbon string here uses a proper
 * noun from any entertainment franchise. The shape ids the designs name are the
 * frozen fifteen of C7.8.
 *
 * Owned by D1.
 */

export type CatalogEntry = {
  slug: string;
  kind: "badge" | "certificate";
  name: string;
  description: string;
  criteria: string;
  skills: string[];
  category: "kt" | "course" | "challenge" | "fun" | "meme" | "recognition";
  sphere: "work" | "fun" | "mindset" | null;
  access: "open" | "limited" | "private";
  stackable: boolean;
  /** A C1 design document. Validated by convex/lib/design.ts before it is written. */
  design: Record<string, unknown>;
};

/* ── designs ─────────────────────────────────────────────────────────────────
 *
 * Every design is stored **whole**, not as the fields that differ from a
 * default. `templateVersions` is immutable and an award pins a version, so a
 * stored partial document would change appearance the day a renderer default
 * moved, and an already-issued badge would quietly become a different badge.
 *
 * The Convex runtime cannot import `packages/neorgon-ui`, so the base document
 * below is the C1.1 shape written out a second time. `convex/lib/design.ts`
 * validates it, and the kit's own `validateDesign` was run over every one of
 * these designs before they were committed.
 *
 * Arcs sit only on shapes wide enough to hold them. A badge exports with a
 * transparent ground, so arc text that falls outside the silhouette disappears
 * the moment the PNG is dropped on a light page. The narrow silhouettes here
 * carry their words on a ribbon, which draws its own plate.
 */

type Ring = { style: string; width: number; color: string; inset: number };
type Arc = { text: string; font: string; size: number; tracking: number; color: string } | null;

type BadgeOver = {
  shape: string;
  base: string;
  accent: string;
  ink: string;
  arcColor: string;
  pattern: string;
  glyph: string;
  rings: Ring[];
  top?: Arc;
  bottom?: Arc;
  ribbon?: { text: string; font: string; size: number } | null;
  pips?: number;
};

function badge(o: BadgeOver): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: "badge",
    size: { w: 512, h: 512 },
    palette: { base: o.base, accent: o.accent, ink: o.ink, metal: "none" },
    shape: o.shape,
    rings: o.rings,
    pattern: { kind: o.pattern, color: o.arcColor, opacity: 0.16, scale: 1 },
    arcs: { top: o.top ?? null, bottom: o.bottom ?? null },
    centre: { kind: "glyph", glyph: o.glyph, imageRef: null, color: o.arcColor, scale: 0.95, dy: -8 },
    ribbon: o.ribbon
      ? { text: o.ribbon.text, color: o.accent, textColor: o.ink, font: o.ribbon.font, size: o.ribbon.size }
      : null,
    pips: { count: o.pips ?? 0, max: 5, style: "dot", color: o.accent },
    mark: { edition: "", year: null },
    layers: [],
  };
}

const arc = (text: string, font: string, size: number, color: string): Arc =>
  ({ text, font, size, tracking: 3, color });

/**
 * One palette per family, so the three spheres read as three families and the
 * five milestones read as the fleet's own. Colour is assigned to the family and
 * never to the silhouette (C12 DO NOT #7): the star below is magenta because it
 * is a fun badge, not because it is a star.
 */
const FLEET = { base: "#7c3aed", accent: "#f5d67b", ink: "#0b1020", arcColor: "#ffffff", pattern: "hexgrid" };
const WORK = { base: "#06243f", accent: "#7fd4ff", ink: "#04182a", arcColor: "#dff2ff", pattern: "circuit" };
const FUN = { base: "#2a0b2e", accent: "#ff7ad9", ink: "#150416", arcColor: "#ffe4f7", pattern: "dots" };
const MINDSET = { base: "#04252b", accent: "#45e0c8", ink: "#012025", arcColor: "#d9fff7", pattern: "rays" };

const ring = (color: string, width = 10, inset = 0, style = "solid"): Ring =>
  ({ style, width, color, inset });

/* ── the catalogue ─────────────────────────────────────────────────────────── */

const MILESTONES: CatalogEntry[] = [
  {
    slug: "first-claim",
    kind: "badge",
    name: "First Claim",
    description: "The first credential to land in your wallet.",
    criteria: "Redeem any Sash claim link.",
    skills: ["arriving"],
    category: "challenge",
    sphere: null,
    access: "open",
    stackable: false,
    design: badge({
      ...FLEET,
      shape: "hexagon",
      glyph: "package",
      rings: [ring("#f5d67b", 14), ring("#0b1020", 5, 24, "beaded")],
      top: arc("FIRST CLAIM", "display", 34, "#ffffff"),
    }),
  },
  {
    slug: "profile-complete",
    kind: "badge",
    name: "Full Profile",
    description: "A name, a line about yourself, and a face to go with them.",
    criteria: "Set a display name, a headline and an avatar.",
    skills: ["introducing yourself"],
    category: "challenge",
    sphere: null,
    access: "open",
    stackable: false,
    design: badge({
      ...FLEET,
      shape: "circle",
      glyph: "smile",
      rings: [ring("#f5d67b", 12), ring("#0b1020", 4, 26, "beaded")],
      top: arc("PROFILE", "display", 36, "#ffffff"),
      bottom: arc("COMPLETE", "display", 26, "#f5d67b"),
    }),
  },
  {
    slug: "first-publish",
    kind: "badge",
    name: "First Publish",
    description: "You put a template in front of other people.",
    criteria: "Publish a template on Enamel.",
    skills: ["shipping"],
    category: "challenge",
    sphere: null,
    access: "open",
    stackable: false,
    design: badge({
      ...FLEET,
      shape: "rounded-square",
      glyph: "rocket",
      rings: [ring("#f5d67b", 12, 10)],
      top: arc("FIRST PUBLISH", "display", 32, "#ffffff"),
    }),
  },
  {
    slug: "ten-sent",
    kind: "badge",
    name: "Ten Sent",
    description: "Ten pieces of recognition sent to other people.",
    criteria: "Send recognition ten times.",
    skills: ["noticing other people"],
    category: "challenge",
    sphere: null,
    access: "open",
    stackable: false,
    design: badge({
      ...FLEET,
      shape: "rosette",
      glyph: "handshake",
      rings: [ring("#f5d67b", 10, 8), ring("#0b1020", 4, 26, "beaded")],
      top: arc("TEN SENT", "display", 34, "#ffffff"),
      pips: 5,
    }),
  },
  {
    slug: "early-adopter",
    kind: "badge",
    name: "Early Adopter",
    description: "You were here before the five hundredth handle was taken.",
    criteria: "Claim a handle while Sash has fewer than 500 profiles.",
    skills: ["turning up early"],
    category: "challenge",
    sphere: null,
    access: "open",
    stackable: false,
    design: badge({
      ...FLEET,
      shape: "shield",
      glyph: "sprout",
      rings: [ring("#f5d67b", 12, 12, "double")],
      top: arc("EARLY", "display", 36, "#ffffff"),
      bottom: arc("ADOPTER", "display", 26, "#f5d67b"),
    }),
  },
];

const RECOGNITION: CatalogEntry[] = [
  /* work */
  {
    slug: "debugging-hero",
    kind: "badge",
    name: "Debugging Hero",
    description: "Went into the log and came back out with the answer.",
    criteria: "Send this to someone who found the cause while everyone else was still guessing.",
    skills: ["debugging", "patience"],
    category: "recognition",
    sphere: "work",
    access: "open",
    stackable: true,
    design: badge({
      ...WORK,
      shape: "shield",
      glyph: "microscope",
      rings: [ring("#7fd4ff", 10, 12, "double")],
      top: arc("DEBUGGING", "sans", 30, "#dff2ff"),
      bottom: arc("HERO", "sans", 24, "#7fd4ff"),
    }),
  },
  {
    slug: "on-call-saviour",
    kind: "badge",
    name: "On-Call Saviour",
    description: "Picked it up at the hour nobody wants to be awake.",
    criteria: "Send this to whoever answered the page you were dreading.",
    skills: ["incident response", "showing up"],
    category: "recognition",
    sphere: "work",
    access: "open",
    stackable: true,
    design: badge({
      ...WORK,
      shape: "circle",
      glyph: "hourglass",
      rings: [ring("#7fd4ff", 12), ring("#04182a", 4, 26, "beaded")],
      top: arc("ON CALL", "sans", 34, "#dff2ff"),
      bottom: arc("SAVIOUR", "sans", 24, "#7fd4ff"),
    }),
  },
  {
    slug: "mentor",
    kind: "badge",
    name: "Mentor",
    description: "Explained it twice, without making anyone feel small.",
    criteria: "Send this to someone who taught you something and had time for the second question.",
    skills: ["teaching", "generosity"],
    category: "recognition",
    sphere: "work",
    access: "open",
    stackable: true,
    design: badge({
      ...WORK,
      shape: "rosette",
      glyph: "book-open",
      rings: [ring("#7fd4ff", 10, 8), ring("#04182a", 4, 26, "beaded")],
      top: arc("MENTOR", "sans", 34, "#dff2ff"),
    }),
  },
  {
    slug: "shipped-it",
    kind: "badge",
    name: "Shipped It",
    description: "It is out, it is in front of people, and it works.",
    criteria: "Send this to whoever got the thing over the line.",
    skills: ["finishing", "nerve"],
    category: "recognition",
    sphere: "work",
    access: "open",
    stackable: true,
    design: badge({
      ...WORK,
      shape: "rounded-square",
      glyph: "package",
      rings: [ring("#7fd4ff", 10, 10, "dashed")],
      top: arc("SHIPPED IT", "sans", 32, "#dff2ff"),
    }),
  },

  /* fun */
  {
    slug: "meme-lord",
    kind: "badge",
    name: "Meme Lord",
    description: "The right image, in the right thread, at the right moment.",
    criteria: "Send this to whoever posted the one that ended the argument.",
    skills: ["timing"],
    category: "recognition",
    sphere: "fun",
    access: "open",
    stackable: true,
    design: badge({
      ...FUN,
      shape: "star",
      glyph: "crown",
      rings: [ring("#ff7ad9", 9)],
      ribbon: { text: "MEME LORD", font: "rounded", size: 24 },
    }),
  },
  {
    slug: "coffee-dependency",
    kind: "badge",
    name: "Coffee Dependency",
    description: "Runs on it, admits it, refills before speaking.",
    criteria: "Send this to whoever measures the day in cups.",
    skills: ["stamina"],
    category: "recognition",
    sphere: "fun",
    access: "open",
    stackable: true,
    design: badge({
      ...FUN,
      shape: "drop",
      glyph: "coffee",
      rings: [ring("#ff7ad9", 8, 12)],
      ribbon: { text: "REFILLED", font: "mono", size: 22 },
    }),
  },
  {
    slug: "chaos-gremlin",
    kind: "badge",
    name: "Chaos Gremlin",
    description: "Breaks it on purpose, in daylight, with a way back.",
    criteria: "Send this to whoever pulled the plug to see what would happen, and told everyone first.",
    skills: ["curiosity", "nerve"],
    category: "recognition",
    sphere: "fun",
    access: "open",
    stackable: true,
    design: badge({
      ...FUN,
      shape: "gem",
      glyph: "skull",
      rings: [ring("#ff7ad9", 9, 14)],
      ribbon: { text: "GREMLIN", font: "rounded", size: 24 },
    }),
  },

  /* mindset */
  {
    slug: "calm-under-fire",
    kind: "badge",
    name: "Calm Under Fire",
    description: "Kept the voice level while the graphs did not.",
    criteria: "Send this to whoever stayed steady when the room stopped being steady.",
    skills: ["composure"],
    category: "recognition",
    sphere: "mindset",
    access: "open",
    stackable: true,
    design: badge({
      ...MINDSET,
      shape: "shield",
      glyph: "umbrella",
      rings: [ring("#45e0c8", 10, 12, "double")],
      top: arc("CALM", "rounded", 36, "#d9fff7"),
      bottom: arc("UNDER FIRE", "rounded", 24, "#45e0c8"),
    }),
  },
  {
    slug: "curiosity",
    kind: "badge",
    name: "Curiosity",
    description: "Asked the question everyone else had stopped asking.",
    criteria: "Send this to whoever went and found out rather than assuming.",
    skills: ["curiosity"],
    category: "recognition",
    sphere: "mindset",
    access: "open",
    stackable: true,
    design: badge({
      ...MINDSET,
      shape: "diamond",
      glyph: "telescope",
      rings: [ring("#45e0c8", 8), ring("#d9fff7", 3, 20, "dashed")],
      ribbon: { text: "CURIOSITY", font: "rounded", size: 24 },
    }),
  },
  {
    slug: "grit",
    kind: "badge",
    name: "Grit",
    description: "Came back to it on the fourth day, and the fifth.",
    criteria: "Send this to whoever kept going after it stopped being interesting.",
    skills: ["persistence"],
    category: "recognition",
    sphere: "mindset",
    access: "open",
    stackable: true,
    design: badge({
      ...MINDSET,
      shape: "rounded-square",
      glyph: "hammer",
      rings: [ring("#45e0c8", 10, 10)],
      top: arc("GRIT", "rounded", 40, "#d9fff7"),
      pips: 3,
    }),
  },
];

export const NEORGON_TEMPLATES: CatalogEntry[] = [...MILESTONES, ...RECOGNITION];

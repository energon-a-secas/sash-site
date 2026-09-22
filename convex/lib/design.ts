/**
 * Server-side structural validation of a C1 design document.
 * CONTRACTS.md C2.10 and C7.
 *
 * The Convex runtime cannot import packages/neorgon-ui, so the C7 enum lists
 * and the C1 numeric ranges are declared here a second time. That duplication
 * is deliberate and is the one place in the campaign where the same rule is
 * written twice: a client-side validator is advice, a server-side one is a
 * control. The detector that keeps the two in step is
 * convex/tests/enums.test.mjs, which reads the lists out of both files and
 * asserts they are equal.
 *
 * This validator does not render. It checks shape, enum membership, numeric
 * range, hex format, that layers is empty, and that the serialised document is
 * under 64 KB.
 */

export const SCHEMA_VERSION = 1;
export const MAX_DESIGN_BYTES = 64 * 1024;

// ── C7 enums, exhaustive, lowercase, stored verbatim ─────────────────────────

export const KINDS = ["badge", "certificate"] as const;                                    // C7.1
// C7.2, widened by CONTRACTS.md C15 A6. "imported" is the origin of an award
// Sash did not issue. Added now rather than later because a late addition to a
// stored enum is a migration, and nothing is live yet.
export const ORIGINS = ["neorgon", "community", "imported"] as const;
export const CATEGORIES = ["kt", "course", "challenge", "fun", "meme", "recognition"] as const;  // C7.3
export const SPHERES = ["work", "fun", "mindset"] as const;                                // C7.4
export const ACCESS_LEVELS = ["open", "limited", "private"] as const;                      // C7.5
export const VISIBILITIES = ["public", "unlisted", "private"] as const;                    // C7.6
export const TEMPLATE_STATUSES = ["draft", "published", "archived"] as const;              // C7.6b
export const ORIENTATIONS = ["landscape", "portrait"] as const;                            // C7.7
export const SHAPE_IDS = [                                                                    // C7.8
  "circle", "crescent", "diamond", "drop", "flame", "gem", "hexagon", "leaf",
  "ribbon-rosette", "rosette", "rounded-square", "shield", "star", "wave", "zigzag",
] as const;
export const METALS = ["none", "gold", "silver", "bronze"] as const;                       // C7.9
// C7.10, widened in design round 2: `bevel` and `gear` are new ids; `rope` keeps
// its id and changes its drawing.
export const RING_STYLES = ["solid", "double", "dashed", "beaded", "rope", "bevel", "gear"] as const;
export const PATTERN_KINDS = [                                                             // C7.11, widened in round 2
  "none", "stripes", "dots", "rays", "guilloche", "hexgrid", "circuit", "chevrons", "noise",
  "sunburst", "halftone", "hatch",
] as const;
export const PIP_STYLES = ["dot", "star", "bar"] as const;                                 // C7.12
export const FONT_ROLES = ["display", "slab", "sans", "mono", "script", "rounded"] as const;  // C7.13
export const CERT_BACKGROUNDS = [                                                          // C7.15, widened in round 2
  "plain", "guilloche", "topo", "mesh", "tiles", "sunburst", "halftone", "hatch",
] as const;
export const CERT_FRAMES = ["none", "single", "double", "rope", "corner"] as const;        // C7.16
export const AWARD_SOURCES = ["claim", "sent", "earned", "import"] as const;               // C7.17
export const AWARD_STATUSES = ["valid", "expired", "revoked"] as const;                    // C7.18
export const IMPORT_PROVIDERS = ["credly", "badgr", "openbadges", "manual"] as const;      // C7.19
export const IMPORT_DIALECTS = ["ob2-json", "ob2-png", "ob2-svg", "ob3-jws", "manual"] as const;  // C7.20
export const EXPORT_FORMATS = [                                                            // C7.21
  "badge-png", "badge-svg", "certificate-png", "certificate-pdf", "profile-png", "group-png",
] as const;
export const WALLET_GROUPS = ["all", "neorgon", "community", "recognition", "imported"] as const;  // C7.22

// Design round 2, C7.23 to C7.31. The first member of each is the default and
// draws what shipped before the field existed. Every one is optional on the
// wire: this validator tolerates an absent field and refuses a wrong one.
export const FINISH_KINDS = ["none", "bevel", "gloss", "facet"] as const;                  // C7.23
export const CENTRE_STYLES = ["line", "bold", "emboss", "duotone"] as const;               // C7.24
export const CENTRE_FITS = ["cover", "contain"] as const;                                  // C7.25
export const CENTRE_MASKS = ["circle", "rounded", "shape", "none"] as const;               // C7.26
export const CENTRE_PLATES = ["none", "solid", "metal"] as const;                          // C7.27
export const CENTRE_TONES = ["full", "mono", "duotone"] as const;                          // C7.28
export const CERT_LATENTS = ["none", "parody", "serial"] as const;                         // C7.29
export const SIGNATURE_SOURCES = ["text", "issuer", "holder"] as const;                    // C7.30
export const SERIAL_STYLES = ["quiet", "loud"] as const;                                   // C7.31

export const CENTRE_KINDS = ["glyph", "image", "none"] as const;   // C1.1
export const PROVENANCE_MODES = ["award", "preview"] as const;     // C1.3

// C1.2: aspect is fixed at the ISO A ratio in both orientations so
// print-to-PDF against A4 is exact. 1684 / 1191 is 1.41393.
export const CERT_ASPECT = 1.4142;
export const CERT_ASPECT_TOLERANCE = 0.006;

const HEX_RE = /^#[0-9a-f]{6}$/;

// ── The validator ────────────────────────────────────────────────────────────

type Problems = string[];

function isObj(x: unknown): x is Record<string, any> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function hex(p: Problems, value: unknown, path: string, required: boolean) {
  if (value === undefined || value === null) {
    if (required) p.push(`${path} is required`);
    return;
  }
  if (typeof value !== "string" || !HEX_RE.test(value)) {
    p.push(`${path} must be a lowercase six digit hex colour like #7c3aed, got ${JSON.stringify(value)}`);
  }
}

function num(p: Problems, value: unknown, path: string, min: number, max: number) {
  if (value === undefined || value === null) return;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    p.push(`${path} must be a finite number`);
    return;
  }
  if (value < min || value > max) p.push(`${path} must be between ${min} and ${max}, got ${value}`);
}

function int(p: Problems, value: unknown, path: string, min: number, max: number) {
  if (value === undefined || value === null) return;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    p.push(`${path} must be an integer`);
    return;
  }
  if (value < min || value > max) p.push(`${path} must be between ${min} and ${max}, got ${value}`);
}

// C15 A97: the same code points the kit's xmlSafe strips (packages/neorgon-ui/insignia/patterns.js).
// XML 1.0 cannot hold them, so a stored row carrying one would render clean on screen and still
// be a template nobody can export; refusing it at the server is the control, the kit strip is advice.
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function str(p: Problems, value: unknown, path: string, max: number, required: boolean) {
  if (value === undefined || value === null) {
    if (required) p.push(`${path} is required`);
    return;
  }
  if (typeof value !== "string") {
    p.push(`${path} must be a string`);
    return;
  }
  if (value.length > max) p.push(`${path} is limited to ${max} characters, got ${value.length}`);
  if (CONTROL_RE.test(value)) p.push(`${path} must not contain control characters`);
}

function flag(p: Problems, value: unknown, path: string) {
  if (value === undefined || value === null) return;
  if (typeof value !== "boolean") p.push(`${path} must be a boolean`);
}

function member(p: Problems, value: unknown, path: string, list: readonly string[], required: boolean) {
  if (value === undefined || value === null) {
    if (required) p.push(`${path} is required`);
    return;
  }
  if (typeof value !== "string" || !list.includes(value)) {
    p.push(`${path} must be one of ${list.join(", ")}, got ${JSON.stringify(value)}`);
  }
}

function palette(p: Problems, value: unknown, path: string) {
  if (value === undefined || value === null) return;
  if (!isObj(value)) { p.push(`${path} must be an object`); return; }
  hex(p, value.base, `${path}.base`, false);
  hex(p, value.accent, `${path}.accent`, false);
  hex(p, value.ink, `${path}.ink`, false);
  member(p, value.metal, `${path}.metal`, METALS, false);
}

function layersEmpty(p: Problems, value: unknown, path: string) {
  if (value === undefined || value === null) return;
  if (!Array.isArray(value)) { p.push(`${path} must be an array`); return; }
  // Reserved for a v2 freeform mode. In v1 it must be empty so v2 needs no
  // schema bump, and a non-empty one is refused rather than ignored.
  if (value.length > 0) p.push(`${path} must be empty in schemaVersion 1`);
}

function validateBadge(p: Problems, d: Record<string, any>, path: string) {
  int(p, d.size?.w, `${path}size.w`, 128, 2048);
  int(p, d.size?.h, `${path}size.h`, 128, 2048);
  palette(p, d.palette, `${path}palette`);
  member(p, d.shape, `${path}shape`, SHAPE_IDS, false);

  if (d.rings !== undefined && d.rings !== null) {
    if (!Array.isArray(d.rings)) {
      p.push(`${path}rings must be an array`);
    } else {
      if (d.rings.length > 3) p.push(`${path}rings takes at most 3 items, got ${d.rings.length}`);
      d.rings.forEach((r: any, i: number) => {
        const rp = `${path}rings[${i}]`;
        if (!isObj(r)) { p.push(`${rp} must be an object`); return; }
        member(p, r.style, `${rp}.style`, RING_STYLES, true);
        num(p, r.width, `${rp}.width`, 1, 64);
        hex(p, r.color, `${rp}.color`, false);
        num(p, r.inset, `${rp}.inset`, 0, 128);
      });
    }
  }

  if (isObj(d.pattern)) {
    member(p, d.pattern.kind, `${path}pattern.kind`, PATTERN_KINDS, false);
    hex(p, d.pattern.color, `${path}pattern.color`, false);
    num(p, d.pattern.opacity, `${path}pattern.opacity`, 0, 1);
    num(p, d.pattern.scale, `${path}pattern.scale`, 0.25, 4);
    num(p, d.pattern.fade, `${path}pattern.fade`, 0, 1);
  } else if (d.pattern !== undefined && d.pattern !== null) {
    p.push(`${path}pattern must be an object or null`);
  }

  if (isObj(d.finish)) {
    member(p, d.finish.kind, `${path}finish.kind`, FINISH_KINDS, false);
    num(p, d.finish.strength, `${path}finish.strength`, 0, 1);
  } else if (d.finish !== undefined && d.finish !== null) {
    p.push(`${path}finish must be an object`);
  }

  for (const slot of ["top", "bottom"]) {
    const arc = d.arcs?.[slot];
    if (arc === undefined || arc === null) continue;
    const ap = `${path}arcs.${slot}`;
    if (!isObj(arc)) { p.push(`${ap} must be an object or null`); continue; }
    str(p, arc.text, `${ap}.text`, 48, true);
    member(p, arc.font, `${ap}.font`, FONT_ROLES, false);
    num(p, arc.size, `${ap}.size`, 8, 120);
    num(p, arc.tracking, `${ap}.tracking`, -8, 24);
    hex(p, arc.color, `${ap}.color`, false);
  }

  if (isObj(d.centre)) {
    const c = d.centre;
    member(p, c.kind, `${path}centre.kind`, CENTRE_KINDS, false);
    if (c.kind === "glyph" && (typeof c.glyph !== "string" || !c.glyph)) {
      // The glyph registry itself belongs to the kit (C1.5), which this runtime
      // cannot import, so the server checks presence and leaves membership to
      // the renderer.
      p.push(`${path}centre.glyph is required when centre.kind is glyph`);
    }
    if (c.kind === "image" && (typeof c.imageRef !== "string" || !c.imageRef)) {
      p.push(`${path}centre.imageRef is required when centre.kind is image`);
    }
    if (c.imageRef !== undefined && c.imageRef !== null && typeof c.imageRef === "string") {
      // C10.3: an art reference is the string form of a storage id, never a URL.
      if (/^https?:/i.test(c.imageRef)) {
        p.push(`${path}centre.imageRef must be a storage id, not a URL`);
      }
    }
    hex(p, c.color, `${path}centre.color`, false);
    num(p, c.scale, `${path}centre.scale`, 0.2, 2);
    num(p, c.dy, `${path}centre.dy`, -128, 128);
    num(p, c.dx, `${path}centre.dx`, -128, 128);
    member(p, c.style, `${path}centre.style`, CENTRE_STYLES, false);
    member(p, c.fit, `${path}centre.fit`, CENTRE_FITS, false);
    member(p, c.mask, `${path}centre.mask`, CENTRE_MASKS, false);
    member(p, c.plate, `${path}centre.plate`, CENTRE_PLATES, false);
    hex(p, c.plateColor, `${path}centre.plateColor`, false);
    member(p, c.tone, `${path}centre.tone`, CENTRE_TONES, false);
    hex(p, c.toneColor, `${path}centre.toneColor`, false);
    num(p, c.rotation, `${path}centre.rotation`, -180, 180);
    num(p, c.opacity, `${path}centre.opacity`, 0, 1);
  } else if (d.centre !== undefined && d.centre !== null) {
    p.push(`${path}centre must be an object`);
  }

  if (isObj(d.ribbon)) {
    str(p, d.ribbon.text, `${path}ribbon.text`, 24, true);
    hex(p, d.ribbon.color, `${path}ribbon.color`, false);
    hex(p, d.ribbon.textColor, `${path}ribbon.textColor`, false);
    member(p, d.ribbon.font, `${path}ribbon.font`, FONT_ROLES, false);
    num(p, d.ribbon.size, `${path}ribbon.size`, 8, 64);
  } else if (d.ribbon !== undefined && d.ribbon !== null) {
    p.push(`${path}ribbon must be an object or null`);
  }

  if (isObj(d.pips)) {
    int(p, d.pips.count, `${path}pips.count`, 0, 10);
    int(p, d.pips.max, `${path}pips.max`, 1, 10);
    member(p, d.pips.style, `${path}pips.style`, PIP_STYLES, false);
    hex(p, d.pips.color, `${path}pips.color`, false);
  }

  if (isObj(d.mark)) {
    str(p, d.mark.edition, `${path}mark.edition`, 16, false);
    if (d.mark.year !== null && d.mark.year !== undefined) {
      int(p, d.mark.year, `${path}mark.year`, 1900, 2999);
    }
  }

  layersEmpty(p, d.layers, `${path}layers`);
}

function validateCertificate(p: Problems, d: Record<string, any>) {
  member(p, d.orientation, "orientation", ORIENTATIONS, false);
  int(p, d.size?.w, "size.w", 128, 2048);
  int(p, d.size?.h, "size.h", 128, 2048);

  const w = d.size?.w, h = d.size?.h;
  if (typeof w === "number" && typeof h === "number" && w > 0 && h > 0) {
    const ratio = Math.max(w, h) / Math.min(w, h);
    if (Math.abs(ratio - CERT_ASPECT) > CERT_ASPECT_TOLERANCE) {
      p.push(
        `size must keep the ISO A aspect of ${CERT_ASPECT} in either orientation, got ${ratio.toFixed(4)}`,
      );
    }
    const wantLandscape = (d.orientation ?? "landscape") === "landscape";
    if (wantLandscape && w < h) p.push("a landscape certificate needs size.w greater than size.h");
    if (!wantLandscape && h < w) p.push("a portrait certificate needs size.h greater than size.w");
  }

  palette(p, d.palette, "palette");

  if (isObj(d.background)) {
    member(p, d.background.kind, "background.kind", CERT_BACKGROUNDS, false);
    hex(p, d.background.color, "background.color", false);
    num(p, d.background.opacity, "background.opacity", 0, 1);
    num(p, d.background.scale, "background.scale", 0.25, 4);
    num(p, d.background.fade, "background.fade", 0, 1);
    num(p, d.background.grain, "background.grain", 0, 0.2);
    member(p, d.background.latent, "background.latent", CERT_LATENTS, false);
  }

  if (isObj(d.frame)) {
    member(p, d.frame.style, "frame.style", CERT_FRAMES, false);
    num(p, d.frame.width, "frame.width", 0, 200);
    hex(p, d.frame.color, "frame.color", false);
    num(p, d.frame.inset, "frame.inset", 0, 200);
    flag(p, d.frame.microtext, "frame.microtext");
  }

  if (isObj(d.seal)) {
    num(p, d.seal.x, "seal.x", 0, 1);
    num(p, d.seal.y, "seal.y", 0, 1);
    num(p, d.seal.size, "seal.size", 60, 600);
    if (d.seal.design !== null && d.seal.design !== undefined) {
      if (!isObj(d.seal.design)) {
        p.push("seal.design must be a badge design document or null");
      } else {
        // Embedded by value so a certificate version is self-contained.
        if (d.seal.design.kind !== undefined && d.seal.design.kind !== "badge") {
          p.push('seal.design.kind must be "badge"');
        }
        validateBadge(p, d.seal.design, "seal.design.");
      }
    }
  }

  if (isObj(d.stamp)) {
    flag(p, d.stamp.show, "stamp.show");
    num(p, d.stamp.x, "stamp.x", 0, 1);
    num(p, d.stamp.y, "stamp.y", 0, 1);
    num(p, d.stamp.size, "stamp.size", 100, 300);
  } else if (d.stamp !== undefined && d.stamp !== null) {
    p.push("stamp must be an object");
  }

  if (isObj(d.text)) {
    for (const [key, block] of Object.entries<any>(d.text)) {
      if (!isObj(block)) { p.push(`text.${key} must be an object`); continue; }
      str(p, block.value, `text.${key}.value`, 2000, false);
      member(p, block.font, `text.${key}.font`, FONT_ROLES, false);
      num(p, block.size, `text.${key}.size`, 6, 400);
      hex(p, block.color, `text.${key}.color`, false);
    }
  }

  if (d.signatures !== undefined && d.signatures !== null) {
    if (!Array.isArray(d.signatures)) {
      p.push("signatures must be an array");
    } else {
      if (d.signatures.length > 2) p.push("signatures takes at most 2 items");
      d.signatures.forEach((s: any, i: number) => {
        if (!isObj(s)) { p.push(`signatures[${i}] must be an object`); return; }
        str(p, s.name, `signatures[${i}].name`, 80, false);
        str(p, s.role, `signatures[${i}].role`, 80, false);
        member(p, s.from, `signatures[${i}].from`, SIGNATURE_SOURCES, false);
      });
    }
  }

  if (isObj(d.serial)) {
    if (d.serial.show !== undefined && typeof d.serial.show !== "boolean") {
      p.push("serial.show must be a boolean");
    }
    member(p, d.serial.font, "serial.font", FONT_ROLES, false);
    num(p, d.serial.size, "serial.size", 6, 200);
    hex(p, d.serial.color, "serial.color", false);
    member(p, d.serial.style, "serial.style", SERIAL_STYLES, false);
  }

  if (isObj(d.verify)) {
    for (const flag of ["show", "qr"]) {
      if (d.verify[flag] !== undefined && typeof d.verify[flag] !== "boolean") {
        p.push(`verify.${flag} must be a boolean`);
      }
    }
    num(p, d.verify.size, "verify.size", 40, 600);
  }

  layersEmpty(p, d.layers, "layers");
}

/**
 * Returns an array of human-readable problems. An empty array means the
 * document is structurally acceptable. Never throws.
 */
export function validateDesign(design: unknown): string[] {
  const p: Problems = [];

  if (!isObj(design)) return ["design must be an object"];

  if (design.schemaVersion !== SCHEMA_VERSION) {
    // A document with a higher value is refused, not migrated.
    p.push(`schemaVersion must equal ${SCHEMA_VERSION}, got ${JSON.stringify(design.schemaVersion)}`);
  }
  member(p, design.kind, "kind", KINDS, true);

  let serialised = "";
  try {
    serialised = JSON.stringify(design) ?? "";
  } catch {
    return ["design is not serialisable as JSON"];
  }
  const bytes = new TextEncoder().encode(serialised).length;
  if (bytes > MAX_DESIGN_BYTES) {
    p.push(`the serialised design is ${bytes} bytes, over the ${MAX_DESIGN_BYTES} byte cap`);
  }

  if (design.kind === "badge") validateBadge(p, design, "");
  else if (design.kind === "certificate") validateCertificate(p, design);

  return p;
}

/**
 * Every author-supplied string in a design that the C11.3 blocklist inspects:
 * the arcs, the ribbon and the edition mark on a badge; every text block value
 * and, since design round 2, every signature name and role on a certificate;
 * and the same again for an embedded seal. The signature slot was the one
 * free-text field the blocklist never saw, so a template already carrying a
 * blocked signature name is refused on its next publish, which is the intended
 * outcome.
 */
export function designTextFields(design: unknown): string[] {
  const out: string[] = [];
  if (!isObj(design)) return out;

  const push = (x: unknown) => { if (typeof x === "string" && x.trim()) out.push(x); };

  push(design.arcs?.top?.text);
  push(design.arcs?.bottom?.text);
  push(design.ribbon?.text);
  push(design.mark?.edition);

  if (isObj(design.text)) {
    for (const block of Object.values<any>(design.text)) push(block?.value);
  }
  if (Array.isArray(design.signatures)) {
    for (const sig of design.signatures) {
      if (!isObj(sig)) continue;
      push(sig.name);
      push(sig.role);
    }
  }
  if (isObj(design.seal?.design)) out.push(...designTextFields(design.seal.design));

  return out;
}

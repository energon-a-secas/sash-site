/**
 * Insignia Kit: the C7 enums (`neo-sash-enums/1`).
 *
 * Every list here is exhaustive, lowercase, and stored verbatim in a
 * `templateVersions.design` row and in every issued award, so a member is a
 * one-way door: renaming or removing one invalidates artefacts that have
 * already been downloaded. Adding a member is cheap; that is the only edit
 * this file expects.
 *
 * The lists lived in `schema.js` until design round 2 (2026-09-15). They moved
 * here so `schema.js` could take the round's new fields without crossing the
 * 500-line cap; `schema.js` re-exports every name below, so no importer
 * changed. `projects/sash-site/convex/lib/design.ts` declares the same lists a
 * second time because the Convex runtime cannot import `packages/`, and
 * `convex/tests/enums.test.mjs` reads both files as text and fails until every
 * flat array here has an equal twin there (C2.10).
 *
 * Pure data. No DOM, no fetch, no import.
 */

export const KINDS = ['badge', 'certificate'];                                    // C7.1
export const ORIGINS = ['neorgon', 'community', 'imported'];                      // C7.2, A6
export const CATEGORIES = ['kt', 'course', 'challenge', 'fun', 'meme', 'recognition']; // C7.3
export const SPHERES = ['work', 'fun', 'mindset'];                                // C7.4
export const ACCESS_LEVELS = ['open', 'limited', 'private'];                      // C7.5
export const VISIBILITIES = ['public', 'unlisted', 'private'];                    // C7.6
export const TEMPLATE_STATUSES = ['draft', 'published', 'archived'];              // C7.6b
export const ORIENTATIONS = ['landscape', 'portrait'];                            // C7.7

// C7.8. Fifteen ids, one flat alphabetical list, no grouping and no ordering
// (C12 DO #5). The naming rules in C12 are a legal-risk control: every id is a
// plain geometric noun, and `tests/insignia.test.mjs` asserts each one against a
// frozen reserved-name list.
export const SHAPE_IDS = [
  'circle', 'crescent', 'diamond', 'drop', 'flame', 'gem', 'hexagon', 'leaf',
  'ribbon-rosette', 'rosette', 'rounded-square', 'shield', 'star', 'wave', 'zigzag',
];

export const METALS = ['none', 'gold', 'silver', 'bronze'];                       // C7.9
// C7.10, widened in round 2: `bevel` and `gear` are new ids; `rope` keeps its
// id and changes its drawing, which is the door staying shut.
export const RING_STYLES = ['solid', 'double', 'dashed', 'beaded', 'rope', 'bevel', 'gear'];
// C7.11, widened in round 2 by `sunburst`, `halftone` and `hatch`.
export const PATTERN_KINDS = ['none', 'stripes', 'dots', 'rays', 'guilloche',
  'hexgrid', 'circuit', 'chevrons', 'noise', 'sunburst', 'halftone', 'hatch'];
export const PIP_STYLES = ['dot', 'star', 'bar'];                                 // C7.12
export const FONT_ROLES = ['display', 'slab', 'sans', 'mono', 'script', 'rounded']; // C7.13
// C7.14, the role-to-family map, stays in schema.js: it is a map, not a list.
// C7.15, widened in round 2 by the same three kinds as C7.11.
export const CERT_BACKGROUNDS = ['plain', 'guilloche', 'topo', 'mesh', 'tiles', 'sunburst', 'halftone', 'hatch'];
export const CERT_FRAMES = ['none', 'single', 'double', 'rope', 'corner'];        // C7.16
export const AWARD_SOURCES = ['claim', 'sent', 'earned', 'import'];               // C7.17
export const AWARD_STATUSES = ['valid', 'expired', 'revoked'];                    // C7.18
export const IMPORT_PROVIDERS = ['credly', 'badgr', 'openbadges', 'manual'];      // C7.19
export const IMPORT_DIALECTS = ['ob2-json', 'ob2-png', 'ob2-svg', 'ob3-jws', 'manual']; // C7.20
export const EXPORT_FORMATS = ['badge-png', 'badge-svg', 'certificate-png',
  'certificate-pdf', 'profile-png', 'group-png'];                                 // C7.21
export const WALLET_GROUPS = ['all', 'neorgon', 'community', 'recognition', 'imported']; // C7.22

// Round 2, C7.23 to C7.31. Each first member is the default, and the default
// reproduces the drawing that shipped before the field existed, so a stored
// design that never heard of the field draws as it always did.
export const FINISH_KINDS = ['none', 'bevel', 'gloss', 'facet'];                  // C7.23
export const CENTRE_STYLES = ['line', 'bold', 'emboss', 'duotone'];               // C7.24
export const CENTRE_FITS = ['cover', 'contain'];                                  // C7.25
export const CENTRE_MASKS = ['circle', 'rounded', 'shape', 'none'];               // C7.26
export const CENTRE_PLATES = ['none', 'solid', 'metal'];                          // C7.27
export const CENTRE_TONES = ['full', 'mono', 'duotone'];                          // C7.28
export const CERT_LATENTS = ['none', 'parody', 'serial'];                         // C7.29
export const SIGNATURE_SOURCES = ['text', 'issuer', 'holder'];                    // C7.30
export const SERIAL_STYLES = ['quiet', 'loud'];                                   // C7.31

export const CENTRE_KINDS = ['glyph', 'image', 'none'];                           // C1.1
export const PROVENANCE_MODES = ['award', 'preview'];                             // C1.3

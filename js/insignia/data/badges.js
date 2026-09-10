/**
 * Insignia catalogue: the badge presets.
 *
 * Twelve finished designs, not skeletons. Each names a shape, a palette, a
 * pattern, rings, a centre and a foot, and each passes `validateDesign` from
 * `../schema.js` with zero problems. `data/presets.js` assembles these with the
 * certificate presets into the one `PRESETS` list a picker reads.
 *
 * Four rules these designs follow, and every one of them is a control rather
 * than taste:
 *
 *   **Colour is assigned to the mood of the preset, never to the shape**
 *   (C12 DO NOT #7). The flame here is cold violet and cyan, the leaf is slate
 *   blue and the star is pink on near-black. Nothing pairs a silhouette with
 *   the colour anyone would guess for it.
 *
 *   **`palette.ink` is always dark, whatever the ground is.** The renderer
 *   fills the provenance strip with `palette.ink` and sets white text on it, so
 *   a light ink makes the one element C11.1 requires to be legible the one
 *   element that is not. `parchment` is the light-ground preset and it still
 *   carries a near-black ink for exactly that reason.
 *
 *   **An arc only sits on a shape wide enough to hold it.** A badge exports
 *   with a transparent ground, so arc text that falls outside the silhouette
 *   vanishes the moment the PNG lands on a light page. Measured, per preset,
 *   by sampling points along each arc against the shape path: the star, leaf,
 *   diamond, wave and flame presets carry their words on a ribbon instead,
 *   because the ribbon draws its own plate.
 *
 *   **A bottom arc and a ribbon are not combined unless they were measured to
 *   clear each other.** The bottom arc runs on a circle of radius 174, so a
 *   long string climbs the sides into the ribbon band at y 336 to 394. The
 *   example design in C1.1 pairs a nine-glyph bottom arc with a ribbon, and the
 *   two overlap.
 *
 * Owned by D1. Vendored into `<site>/js/insignia/data/badges.js`.
 */
import { normalizeDesign } from '../schema.js';

/**
 * Presets are declared as the fields that differ and completed by the kit's own
 * `normalizeDesign`, so every exported `design` is a whole C1 document with no
 * absent field for a consumer to guess at. Declaring them whole by hand would
 * be 900 lines of repetition, and a preset that stored only its differences
 * would silently change appearance the day a default moved.
 */
export const badge = (d) => normalizeDesign({ ...d, schemaVersion: 1, kind: 'badge' });

export const BADGE_PRESETS = [
  {
    id: 'energon-hex',
    name: 'Energon Hex',
    note: 'The fleet mark, violet and gold. The default a new badge starts from.',
    design: badge({
      palette: { base: '#7c3aed', accent: '#f5d67b', ink: '#0b1020', metal: 'none' },
      shape: 'hexagon',
      rings: [
        { style: 'solid', width: 16, color: '#f5d67b', inset: 0 },
        { style: 'beaded', width: 6, color: '#0b1020', inset: 24 },
      ],
      pattern: { kind: 'hexgrid', color: '#ffffff', opacity: 0.14, scale: 1 },
      arcs: {
        top: { text: 'RUBBER DUCK', font: 'display', size: 40, tracking: 4, color: '#ffffff' },
        bottom: { text: 'WHISPERER', font: 'display', size: 30, tracking: 6, color: '#ffffff' },
      },
      centre: { kind: 'glyph', glyph: 'sparkles', color: '#ffffff', scale: 1, dy: -6 },
      ribbon: null,
      mark: { edition: '', year: 2026 },
    }),
  },
  {
    id: 'midnight-disc',
    name: 'Midnight Disc',
    note: 'Fleet blue on the fleet ground. A disc with a double rim and a low count of pips.',
    design: badge({
      palette: { base: '#040714', accent: '#0063e5', ink: '#040714', metal: 'none' },
      shape: 'circle',
      rings: [
        { style: 'double', width: 14, color: '#0063e5', inset: 0 },
        { style: 'solid', width: 3, color: '#0080ff', inset: 28 },
      ],
      pattern: { kind: 'dots', color: '#0080ff', opacity: 0.22, scale: 1.2 },
      arcs: {
        top: { text: 'ON CALL', font: 'sans', size: 38, tracking: 6, color: '#f9f9f9' },
        bottom: null,
      },
      centre: { kind: 'glyph', glyph: 'hourglass', color: '#0080ff', scale: 1, dy: -8 },
      ribbon: { text: '03:00', color: '#0063e5', textColor: '#040714', font: 'mono', size: 22 },
      pips: { count: 2, max: 5, style: 'dot', color: '#0080ff' },
    }),
  },
  {
    id: 'terminal',
    name: 'Terminal',
    note: 'Phosphor on black, fixed width throughout, a dashed rim and a circuit ground.',
    design: badge({
      palette: { base: '#04120a', accent: '#29ff9c', ink: '#04120a', metal: 'none' },
      shape: 'rounded-square',
      rings: [{ style: 'dashed', width: 8, color: '#29ff9c', inset: 12 }],
      pattern: { kind: 'circuit', color: '#29ff9c', opacity: 0.18, scale: 1 },
      arcs: {
        top: { text: 'ROOT CAUSE', font: 'mono', size: 32, tracking: 2, color: '#d8ffe9' },
        bottom: { text: 'FOUND', font: 'mono', size: 26, tracking: 6, color: '#29ff9c' },
      },
      centre: { kind: 'glyph', glyph: 'bot', color: '#29ff9c', scale: 1, dy: -6 },
      ribbon: { text: 'exit 0', color: '#29ff9c', textColor: '#04120a', font: 'mono', size: 22 },
    }),
  },
  {
    id: 'gold-rosette',
    name: 'Gold Rosette',
    note: 'The metal gradient on a scalloped disc, with a full row of star pips.',
    design: badge({
      palette: { base: '#b98b2e', accent: '#2b1c05', ink: '#2b1c05', metal: 'gold' },
      shape: 'rosette',
      rings: [
        { style: 'solid', width: 10, color: '#2b1c05', inset: 8 },
        { style: 'beaded', width: 5, color: '#f6e2a8', inset: 26 },
      ],
      pattern: { kind: 'rays', color: '#ffffff', opacity: 0.12, scale: 1 },
      arcs: {
        top: { text: 'TEN YEARS', font: 'display', size: 34, tracking: 3, color: '#2b1c05' },
        bottom: { text: 'OF UPTIME', font: 'display', size: 26, tracking: 5, color: '#2b1c05' },
      },
      centre: { kind: 'glyph', glyph: 'medal', color: '#2b1c05', scale: 0.95, dy: -10 },
      pips: { count: 5, max: 5, style: 'star', color: '#2b1c05' },
    }),
  },
  {
    id: 'alert-star',
    name: 'Alert Star',
    note: 'Pink on near-black with a ray burst. The loudest thing in the list.',
    design: badge({
      palette: { base: '#12040a', accent: '#ff4d6d', ink: '#12040a', metal: 'none' },
      shape: 'star',
      rings: [{ style: 'solid', width: 9, color: '#ff4d6d', inset: 0 }],
      pattern: { kind: 'rays', color: '#ff4d6d', opacity: 0.2, scale: 1.4 },
      arcs: { top: null, bottom: null },
      centre: { kind: 'glyph', glyph: 'zap', color: '#ffe3e9', scale: 0.9, dy: -10 },
      ribbon: { text: 'BLAST RADIUS', color: '#ff4d6d', textColor: '#12040a', font: 'mono', size: 22 },
    }),
  },
  {
    id: 'field-notes',
    name: 'Field Notes',
    note: 'A leaf drawn in cold slate rather than the green anyone would expect.',
    design: badge({
      palette: { base: '#1b2733', accent: '#9fb4c7', ink: '#0d141b', metal: 'none' },
      shape: 'leaf',
      rings: [{ style: 'rope', width: 9, color: '#9fb4c7', inset: 10 }],
      pattern: { kind: 'noise', color: '#ffffff', opacity: 0.1, scale: 1 },
      arcs: { top: null, bottom: null },
      centre: { kind: 'glyph', glyph: 'telescope', color: '#e6eef5', scale: 0.95, dy: -6 },
      ribbon: { text: 'FIELD NOTES', color: '#9fb4c7', textColor: '#0d141b', font: 'slab', size: 24 },
      mark: { edition: 'II', year: 2026 },
    }),
  },
  {
    id: 'parchment',
    name: 'Parchment',
    note: 'The light-ground preset. Dark ink, hairline stripes, a double rim.',
    design: badge({
      palette: { base: '#f0ece0', accent: '#7a5a1e', ink: '#1b1a17', metal: 'none' },
      shape: 'shield',
      rings: [{ style: 'double', width: 10, color: '#7a5a1e', inset: 12 }],
      pattern: { kind: 'stripes', color: '#1b1a17', opacity: 0.07, scale: 1.6 },
      arcs: {
        top: { text: 'ARCHIVIST', font: 'display', size: 34, tracking: 4, color: '#1b1a17' },
        bottom: { text: 'SECOND CLASS', font: 'display', size: 22, tracking: 4, color: '#4a4437' },
      },
      centre: { kind: 'glyph', glyph: 'scroll', color: '#7a5a1e', scale: 1, dy: -4 },
      ribbon: null,
      pips: { count: 3, max: 5, style: 'bar', color: '#7a5a1e' },
      mark: { edition: '', year: 2026 },
    }),
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    note: 'Drafting blue, a chevron ground and two rims, one of them dashed.',
    design: badge({
      palette: { base: '#06243f', accent: '#7fd4ff', ink: '#04182a', metal: 'none' },
      shape: 'diamond',
      rings: [
        { style: 'solid', width: 8, color: '#7fd4ff', inset: 0 },
        { style: 'dashed', width: 4, color: '#ffffff', inset: 20 },
      ],
      pattern: { kind: 'chevrons', color: '#7fd4ff', opacity: 0.16, scale: 1 },
      arcs: { top: null, bottom: null },
      centre: { kind: 'glyph', glyph: 'ruler', color: '#dff2ff', scale: 0.85, dy: -8 },
      ribbon: { text: 'SPEC WRITTEN', color: '#7fd4ff', textColor: '#04182a', font: 'mono', size: 22 },
      mark: { edition: 'v1', year: 2026 },
    }),
  },
  {
    id: 'undertow',
    name: 'Undertow',
    note: 'A guilloche ground under a banded silhouette, no rim, four pips of five.',
    design: badge({
      palette: { base: '#04252b', accent: '#45e0c8', ink: '#012025', metal: 'none' },
      shape: 'wave',
      rings: [],
      pattern: { kind: 'guilloche', color: '#45e0c8', opacity: 0.2, scale: 1 },
      arcs: { top: null, bottom: null },
      centre: { kind: 'glyph', glyph: 'umbrella', color: '#d9fff7', scale: 1, dy: -4 },
      ribbon: { text: 'STEADY STATE', color: '#45e0c8', textColor: '#012025', font: 'rounded', size: 24 },
    }),
  },
  {
    id: 'ribbon-award',
    name: 'Ribbon Award',
    note: 'The scalloped disc with tails. The tails take the foot, so no ribbon and no bottom arc.',
    design: badge({
      palette: { base: '#7a0f22', accent: '#f5d67b', ink: '#2b0209', metal: 'none' },
      shape: 'ribbon-rosette',
      rings: [{ style: 'beaded', width: 6, color: '#f5d67b', inset: 16 }],
      pattern: { kind: 'rays', color: '#f5d67b', opacity: 0.14, scale: 1 },
      arcs: {
        top: { text: 'FIRST PLACE', font: 'display', size: 30, tracking: 3, color: '#ffe9c9' },
        bottom: null,
      },
      centre: { kind: 'glyph', glyph: 'trophy', color: '#f5d67b', scale: 0.8, dy: -40 },
      ribbon: null,
      mark: { edition: '', year: 2026 },
    }),
  },
  {
    id: 'steel-drop',
    name: 'Steel Drop',
    note: 'The silver gradient, a hex ground and a fixed-width ribbon of one measurement.',
    design: badge({
      palette: { base: '#8a9099', accent: '#1a1d21', ink: '#1a1d21', metal: 'silver' },
      shape: 'drop',
      rings: [{ style: 'solid', width: 8, color: '#1a1d21', inset: 12 }],
      pattern: { kind: 'hexgrid', color: '#ffffff', opacity: 0.1, scale: 1.2 },
      arcs: {
        top: null,
        bottom: { text: 'MACHINED', font: 'slab', size: 22, tracking: 2, color: '#1a1d21' },
      },
      centre: { kind: 'glyph', glyph: 'wrench', color: '#1a1d21', scale: 1, dy: 14 },
      ribbon: { text: 'tolerance 0.01', color: '#1a1d21', textColor: '#d9dde1', font: 'mono', size: 18 },
    }),
  },
  {
    id: 'cold-flame',
    name: 'Cold Flame',
    note: 'A flame silhouette in violet and cyan. Warm colours are the obvious answer, so it does not use them.',
    design: badge({
      palette: { base: '#1d0b3a', accent: '#66e0ff', ink: '#0a0418', metal: 'none' },
      shape: 'flame',
      rings: [],
      pattern: { kind: 'stripes', color: '#66e0ff', opacity: 0.12, scale: 2 },
      arcs: { top: null, bottom: null },
      centre: { kind: 'glyph', glyph: 'lightbulb', color: '#66e0ff', scale: 0.9, dy: -14 },
      ribbon: { text: 'SLOW BURN', color: '#66e0ff', textColor: '#0a0418', font: 'rounded', size: 24 },
    }),
  },
];

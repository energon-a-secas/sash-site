/**
 * Insignia Kit: the shape catalogue (C1.5, C7.8, C12).
 *
 * Fifteen silhouettes, one flat alphabetical list, every path hand-built from a
 * written geometric description on a 512 by 512 field with a 20 unit margin.
 * Nothing here is traced, auto-traced or drawn over any reference image, and
 * none of it comes from a third-party icon set: the centre glyphs in glyphs.js
 * are Lucide, the outlines here are not.
 *
 * The names are a legal-risk control, not a style choice (C12.3). Every id is a
 * plain geometric noun, `tests/insignia.test.mjs` asserts each one against a
 * frozen reserved-name list, and a new shape that collides fails `make smoke`
 * rather than a review. The formal per-shape provenance record (author, date,
 * description) lives in `data/shape-catalogue.json`, owned by D1.
 */

export const SHAPE_VIEWBOX = '0 0 512 512';

/** The field every path is drawn on. Renderers scale this to `design.size`. */
export const SHAPE_FIELD = 512;

export const SHAPES = {
  // A plain disc, radius 236, drawn as two half arcs.
  circle: {
    d: 'M20 256 A236 236 0 1 0 492 256 A236 236 0 1 0 20 256 Z',
    viewBox: SHAPE_VIEWBOX,
  },

  // A disc with a wider disc bitten out of its right, leaving two points.
  crescent: {
    d: 'M256 20 A236 236 0 1 0 256 492 A260 260 0 0 1 256 20 Z',
    viewBox: SHAPE_VIEWBOX,
  },

  // A square stood on its corner.
  diamond: {
    d: 'M256 20 L492 256 L256 492 L20 256 Z',
    viewBox: SHAPE_VIEWBOX,
  },

  // A teardrop: one point at the top, sides falling into a circular base.
  drop: {
    d: 'M256 20 C300 120 446 190 446 300 A190 190 0 1 1 66 300 C66 190 212 120 256 20 Z',
    viewBox: SHAPE_VIEWBOX,
  },

  // A tongue of fire: a single point at the top, two lower lobes, a centre notch.
  flame: {
    d: 'M256 16 C300 116 386 160 396 258 C404 342 356 424 286 470 '
     + 'C300 424 282 396 256 380 C230 396 212 424 226 470 '
     + 'C156 424 108 342 116 258 C126 160 212 116 256 16 Z',
    viewBox: SHAPE_VIEWBOX,
  },

  // A brilliant cut seen face on: flat table, shoulders, a point at the base.
  gem: {
    d: 'M160 56 L352 56 L472 200 L256 492 L40 200 Z',
    viewBox: SHAPE_VIEWBOX,
  },

  // The fleet's own mark: a regular six-sided figure, vertex at the top.
  // C12 DO #7 makes it the default shape for a new badge.
  hexagon: {
    d: 'M256 20 L460.4 138 L460.4 374 L256 492 L51.6 374 L51.6 138 Z',
    viewBox: SHAPE_VIEWBOX,
  },

  // A pointed oval: two mirrored curves meeting at a point top and bottom.
  leaf: {
    d: 'M256 20 C392 128 392 384 256 492 C120 384 120 128 256 20 Z',
    viewBox: SHAPE_VIEWBOX,
  },

  // A twelve-lobed scalloped disc with two short tails falling from beneath it.
  // Redrawn 2026-09-15 (design round 2): the disc's lobe tips reach radius 190
  // about 256,210, so it spans y 20 to 400 and the top arc sits on the disc
  // rather than across its scallops; the tails stop at y 430, above the
  // provenance strip. The disc is the first subpath, which is the one a ring
  // follows. Record: data/shape-catalogue.json.
  'ribbon-rosette': {
    d: 'M211.5 43.9 A53.4 53.4 0 0 1 300.5 43.9 A53.4 53.4 0 0 1 377.6 88.4 '
     + 'A53.4 53.4 0 0 1 422.1 165.5 A53.4 53.4 0 0 1 422.1 254.5 A53.4 53.4 0 0 1 377.6 331.6 '
     + 'A53.4 53.4 0 0 1 300.5 376.1 A53.4 53.4 0 0 1 211.5 376.1 A53.4 53.4 0 0 1 134.4 331.6 '
     + 'A53.4 53.4 0 0 1 89.9 254.5 A53.4 53.4 0 0 1 89.9 165.5 A53.4 53.4 0 0 1 134.4 88.4 '
     + 'A53.4 53.4 0 0 1 211.5 43.9 Z '
     + 'M220 380 L266 380 L236 430 L206 416 L176 430 Z '
     + 'M246 380 L292 380 L336 430 L306 416 L276 430 Z',
    viewBox: SHAPE_VIEWBOX,
  },

  // A sixteen-lobed scalloped disc, each lobe an outward semicircle.
  rosette: {
    d: 'M256 20 A48.8 48.8 0 0 1 346.3 38 A48.8 48.8 0 0 1 422.9 89.1 '
     + 'A48.8 48.8 0 0 1 474 165.7 A48.8 48.8 0 0 1 492 256 A48.8 48.8 0 0 1 474 346.3 '
     + 'A48.8 48.8 0 0 1 422.9 422.9 A48.8 48.8 0 0 1 346.3 474 A48.8 48.8 0 0 1 256 492 '
     + 'A48.8 48.8 0 0 1 165.7 474 A48.8 48.8 0 0 1 89.1 422.9 A48.8 48.8 0 0 1 38 346.3 '
     + 'A48.8 48.8 0 0 1 20 256 A48.8 48.8 0 0 1 38 165.7 A48.8 48.8 0 0 1 89.1 89.1 '
     + 'A48.8 48.8 0 0 1 165.7 38 A48.8 48.8 0 0 1 256 20 Z',
    viewBox: SHAPE_VIEWBOX,
  },

  // A square with a 100 unit corner radius.
  'rounded-square': {
    d: 'M120 20 H392 A100 100 0 0 1 492 120 V392 A100 100 0 0 1 392 492 '
     + 'H120 A100 100 0 0 1 20 392 V120 A100 100 0 0 1 120 20 Z',
    viewBox: SHAPE_VIEWBOX,
  },

  // A heater shield: a shallow gable that climbs 68 units from the shoulders at
  // y 84 to a peak at 256,16, straight sides, a rounded point at the foot.
  shield: {
    d: 'M256 16 L472 84 V264 C472 380 380 460 256 496 C132 460 40 380 40 264 V84 Z',
    viewBox: SHAPE_VIEWBOX,
  },

  // A five-pointed star, outer radius 236, inner radius 100, point at the top.
  star: {
    d: 'M256 20 L314.8 175.1 L480.4 183.1 L351.1 286.9 L394.7 446.9 L256 356 '
     + 'L117.3 446.9 L160.9 286.9 L31.6 183.1 L197.2 175.1 Z',
    viewBox: SHAPE_VIEWBOX,
  },

  // A band whose top and bottom edges are the same two-crest curve.
  wave: {
    d: 'M28 148 C100 60 180 240 256 148 C332 56 412 236 484 148 '
     + 'L484 364 C412 452 332 272 256 364 C180 456 100 276 28 364 Z',
    viewBox: SHAPE_VIEWBOX,
  },

  // A band of constant width that turns twice on its way down the field.
  zigzag: {
    d: 'M160 20 L360 20 L240 220 L390 220 L200 492 L260 270 L120 270 Z',
    viewBox: SHAPE_VIEWBOX,
  },
};

/** Every shape id, sorted. The picker order (C12 DO #5: flat and alphabetical). */
export const SHAPE_LIST = Object.keys(SHAPES).sort();

/** Path data for an id, or the default hexagon when the id is unknown. */
export function shapePath(id) {
  return (SHAPES[id] || SHAPES.hexagon).d;
}

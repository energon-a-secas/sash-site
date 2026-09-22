/**
 * Insignia Kit: the dense engraved guilloche, as geometry (design round 2,
 * pattern-density).
 *
 * Pure: no DOM and no import, so `patterns.js` stays the kit's element leaf
 * and a node test reads this file with no stand-in. `patterns.js` wraps what
 * `denseLayers` returns in elements (`guillocheLayers`).
 *
 * Three hypotrochoids, each emitted as a chain of cubic segments whose end
 * tangents are the curve's own derivative (Hermite), so the lobes stay smooth
 * at any raster scale where a polyline of the same byte count shows its
 * corners. Every rolling ratio is `lobes / turns` with the two coprime, so the
 * curve precesses and never retraces itself: 73 distinct lobes over nine
 * turns, not the same eight drawn nine times. Generated from parameters,
 * never traced (17 U.S.C. 102(b); R2/R3 2.4); nothing here is random and
 * nothing reads the clock (C1.6).
 *
 * The field is the page. The base circle and the lobe amplitude scale with the
 * longer side, so the outer lobe tips reach the corners of any page and the
 * middle stays clear for the title whatever the aspect; `scale` changes how
 * many lobes go round (smaller is finer) and never the extent, so a page at
 * 0.5 has no bare corners. About 20 KB of path data per layer at scale 1,
 * three layers to a page.
 */

const TAU = Math.PI * 2;

/** The field the layer table is written on; a page scales it by its longer side. */
export const DENSE_FIELD = 512;

/** Stroke width in page units: 0.17 mm on A4, a line print holds and a 2x raster keeps crisp. */
export const DENSE_STROKE = 1;

/** Cubic segments per lobe. Ten keeps the Hermite error under 0.1 units on an A4 page. */
export const SEGMENTS_PER_LOBE = 10;

/**
 * One row per layer. `base` is the radius of the circle the lobes ride on and
 * `amp` their reach, both in 512-field units; `lobes` and `turns` the rolling
 * ratio (coprime); `weight` the stroke opacity relative to the author's
 * `opacity`; `phase` an offset in radians so the three layers' lobe tips do not
 * line up on one spoke.
 */
export const DENSE_LAYERS = Object.freeze([
  Object.freeze({ base: 210, amp: 103, lobes: 73, turns: 9, weight: 1, phase: 0 }),
  Object.freeze({ base: 207, amp: 73, lobes: 85, turns: 12, weight: 0.72, phase: 1.1 }),
  Object.freeze({ base: 206, amp: 117, lobes: 43, turns: 7, weight: 0.55, phase: 2.3 }),
]);

/** The lobe count is clamped so `scale` 0.25 costs at most about twice scale 1. */
export const MIN_LOBES = 24;
export const MAX_LOBES = 160;

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** One decimal, locale-independent, no negative zero: 0.05 units on a page is invisible. */
const f1 = (v) => {
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? '0' : String(r);
};

/** Numbers packed as the path grammar allows: a space only where the next one has no sign. */
const pack = (nums) => nums.map((v, i) => {
  const s = f1(v);
  return i > 0 && !s.startsWith('-') ? ` ${s}` : s;
}).join('');

/** The lobe count for a layer at `scale`, kept coprime with its turns so the curve precesses. */
export function lobesFor(layer, scale) {
  let lobes = Math.min(MAX_LOBES, Math.max(MIN_LOBES, Math.round(layer.lobes / scale)));
  while (gcd(lobes, layer.turns) !== 1) lobes += 1;
  return lobes;
}

/**
 * Path data for one hypotrochoid centred on (cx, cy), every length in the
 * layer table multiplied by `k`. Relative cubic segments; each endpoint is
 * rounded once and the next segment starts from the rounded point, so the
 * rounding never accumulates.
 */
export function trochoidPath({ cx, cy, k, base, amp, lobes, turns, phase = 0 }) {
  const m = lobes / turns;
  const segs = lobes * SEGMENTS_PER_LOBE;
  const dt = (TAU * turns) / segs;
  const P = (t) => [
    cx + k * (base * Math.cos(t) + amp * Math.cos(m * t + phase)),
    cy + k * (base * Math.sin(t) - amp * Math.sin(m * t + phase)),
  ];
  const D = (t) => [
    k * (-base * Math.sin(t) - amp * m * Math.sin(m * t + phase)),
    k * (base * Math.cos(t) - amp * m * Math.cos(m * t + phase)),
  ];
  const round = (v) => Math.round(v * 10) / 10;
  let [ex, ey] = P(0).map(round);
  let d = `M${pack([ex, ey])}`;
  for (let i = 0; i < segs; i++) {
    const t0 = i * dt;
    const t1 = t0 + dt;
    const p0 = P(t0);
    const p1 = P(t1);
    const d0 = D(t0);
    const d1 = D(t1);
    const c1 = [p0[0] + (d0[0] * dt) / 3, p0[1] + (d0[1] * dt) / 3];
    const c2 = [p1[0] - (d1[0] * dt) / 3, p1[1] - (d1[1] * dt) / 3];
    const nx = round(p1[0]);
    const ny = round(p1[1]);
    d += `c${pack([c1[0] - ex, c1[1] - ey, c2[0] - ex, c2[1] - ey, nx - ex, ny - ey])}`;
    ex = nx;
    ey = ny;
  }
  return d;
}

/**
 * The three layers for a page of `w` by `h`, centred on it, as
 * `{ d, weight }` rows in drawing order. Deterministic: the same arguments
 * give the same strings.
 */
export function denseLayers({ w, h, scale = 1 }) {
  const k = Math.max(w, h) / DENSE_FIELD;
  return DENSE_LAYERS.map((layer) => ({
    d: trochoidPath({ cx: w / 2, cy: h / 2, k, ...layer, lobes: lobesFor(layer, scale) }),
    weight: layer.weight,
  }));
}

/**
 * Insignia Kit: generated pattern and gradient definitions (C1.5, C7.11, C7.15).
 *
 * Every pattern is generated from parameters. Nothing here is traced from any
 * source work, and the guilloche in particular is a sampled hypotrochoid rather
 * than a copy of an engraved one: the process is unprotectable under
 * 17 U.S.C. 102(b), and generating the curve means there is no source work at
 * all (R2/R3 2.4).
 *
 * Nothing here is random. `noise` is a hash of the tile coordinate, so the same
 * design serialises to the same bytes on every call (C1.6).
 *
 * `svgEl` lives in this file because patterns.js is the kit's leaf module: every
 * other drawing module imports it, and putting the factory in render.js would
 * make the graph circular.
 */

export const SVG_NS = 'http://www.w3.org/2000/svg';

/** Create an SVG element. Null and undefined attributes are dropped, not stringified. */
export function svgEl(name, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, name);
  for (const key of Object.keys(attrs)) {
    const v = attrs[key];
    if (v !== null && v !== undefined) node.setAttribute(key, String(v));
  }
  for (const child of children) if (child) node.appendChild(child);
  return node;
}

/** Fixed-precision number formatting. Locale-independent, so output is byte-stable. */
export function n(value) {
  const r = Math.round(Number(value) * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
}

/** The tile every whole-field pattern is generated on. */
const FIELD = 512;

const clampScale = (s) => {
  const v = Number(s);
  return Number.isFinite(v) && v >= 0.25 && v <= 4 ? v : 1;
};

/* ── metals (C7.9) ─────────────────────────────────────────────────────────── */

const METAL_STOPS = {
  gold:   ['#f7e7a6', '#d4a017', '#7a5a08'],
  silver: ['#f2f4f8', '#b9c0cc', '#6a7180'],
  bronze: ['#f0c9a0', '#b3762f', '#6b3f14'],
};

/**
 * The three-stop gradient that replaces `palette.base` when `palette.metal` is
 * not `none`. Returns null for `none` or an unknown metal.
 */
export function metalGradient(metal, id) {
  const stops = METAL_STOPS[metal];
  if (!stops) return null;
  return svgEl('linearGradient', { id, x1: '0', y1: '0', x2: '0.35', y2: '1' }, [
    svgEl('stop', { offset: '0', 'stop-color': stops[0] }),
    svgEl('stop', { offset: '0.52', 'stop-color': stops[1] }),
    svgEl('stop', { offset: '1', 'stop-color': stops[2] }),
  ]);
}

/* ── patterns ──────────────────────────────────────────────────────────────── */

/**
 * A `<pattern>` element for `kind`, or null when the kind draws nothing
 * (`none`, `plain`, or an id this kit does not know).
 *
 * Fill any shape with `fill="url(#<id>)"` to apply it.
 */
export function patternDefs(kind, { color = '#ffffff', opacity = 0.15, scale = 1, id } = {}) {
  const build = BUILDERS[kind];
  if (!build || !id) return null;
  const s = clampScale(scale);
  const o = Number.isFinite(Number(opacity)) ? Math.min(1, Math.max(0, Number(opacity))) : 0.15;
  return build({ color, opacity: o, scale: s, id });
}

/** Every pattern id this module draws, for a picker that wants to skip the empties. */
export const DRAWN_PATTERNS = Object.freeze([
  'stripes', 'dots', 'rays', 'guilloche', 'hexgrid', 'circuit', 'chevrons', 'noise',
  'topo', 'mesh', 'tiles',
]);

const tile = (id, w, h, children, extra = {}) => svgEl('pattern', {
  id, width: n(w), height: n(h), patternUnits: 'userSpaceOnUse', ...extra,
}, children);

const stroke = (d, color, width, opacity, cap = 'round') => svgEl('path', {
  d, fill: 'none', stroke: color, 'stroke-width': n(width),
  'stroke-opacity': n(opacity), 'stroke-linecap': cap, 'stroke-linejoin': 'round',
});

const BUILDERS = {
  // Parallel bars at 45 degrees.
  stripes: ({ color, opacity, scale, id }) => {
    const w = 24 * scale;
    return tile(id, w, w, [
      svgEl('rect', { width: n(w / 2), height: n(w), fill: color, 'fill-opacity': n(opacity) }),
    ], { patternTransform: 'rotate(45)' });
  },

  // A single dot per tile.
  dots: ({ color, opacity, scale, id }) => {
    const w = 28 * scale;
    return tile(id, w, w, [
      svgEl('circle', { cx: n(w / 2), cy: n(w / 2), r: n(3.2 * scale), fill: color, 'fill-opacity': n(opacity) }),
    ]);
  },

  // Wedges radiating from the centre of the field.
  rays: ({ color, opacity, scale, id }) => {
    const c = FIELD / 2;
    const count = Math.max(6, Math.round(24 / scale));
    const step = (Math.PI * 2) / count;
    const parts = [];
    for (let i = 0; i < count; i += 2) {
      const a0 = i * step;
      const a1 = a0 + step;
      const r = FIELD;
      parts.push(`M${n(c)} ${n(c)} L${n(c + r * Math.cos(a0))} ${n(c + r * Math.sin(a0))} `
        + `L${n(c + r * Math.cos(a1))} ${n(c + r * Math.sin(a1))} Z`);
    }
    return tile(id, FIELD, FIELD, [
      svgEl('path', { d: parts.join(' '), fill: color, 'fill-opacity': n(opacity) }),
    ]);
  },

  // A hypotrochoid, sampled and emitted as one polyline. Generated, never traced.
  guilloche: ({ color, opacity, scale, id }) => {
    const c = FIELD / 2;
    const R = 200 * scale;
    const r = R / 7;
    const d = R / 2.6;
    const steps = 720;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 14;
      const k = (R - r) / r;
      pts.push(`${n(c + (R - r) * Math.cos(t) + d * Math.cos(k * t))} `
        + `${n(c + (R - r) * Math.sin(t) - d * Math.sin(k * t))}`);
    }
    return tile(id, FIELD, FIELD, [
      stroke(`M${pts.join(' L')}`, color, 1.1, opacity, 'butt'),
    ]);
  },

  // An interlocking grid of six-sided cells.
  hexgrid: ({ color, opacity, scale, id }) => {
    const s = 18 * scale;
    const w = Math.sqrt(3) * s;
    const h = 3 * s;
    const hex = (cx, cy) => {
      const p = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i - 90);
        p.push(`${n(cx + s * Math.cos(a))} ${n(cy + s * Math.sin(a))}`);
      }
      return `M${p.join(' L')} Z`;
    };
    return tile(id, w, h, [
      stroke([hex(w / 2, s), hex(0, h / 2 + s / 2), hex(w, h / 2 + s / 2)].join(' '), color, 1.2, opacity),
    ]);
  },

  // Right-angle traces with a pad at each turn.
  circuit: ({ color, opacity, scale, id }) => {
    const w = 64 * scale;
    const u = w / 8;
    const d = `M0 ${n(u * 2)} H${n(u * 3)} V${n(u * 6)} H${n(u * 8)} `
      + `M${n(u * 5)} 0 V${n(u * 3)} H${n(u * 8)} `
      + `M0 ${n(u * 7)} H${n(u * 2)} V${n(u * 8)}`;
    return tile(id, w, w, [
      stroke(d, color, 1.6 * scale, opacity, 'square'),
      svgEl('circle', { cx: n(u * 3), cy: n(u * 6), r: n(2.4 * scale), fill: color, 'fill-opacity': n(opacity) }),
      svgEl('circle', { cx: n(u * 5), cy: n(u * 3), r: n(2.4 * scale), fill: color, 'fill-opacity': n(opacity) }),
    ]);
  },

  // Stacked shallow V shapes.
  chevrons: ({ color, opacity, scale, id }) => {
    const w = 32 * scale;
    const h = 20 * scale;
    const d = `M0 ${n(h * 0.7)} L${n(w / 2)} ${n(h * 0.2)} L${n(w)} ${n(h * 0.7)}`;
    return tile(id, w, h, [stroke(d, color, 2 * scale, opacity)]);
  },

  // Scattered dots from a hash of the cell index. Deterministic, never Math.random.
  noise: ({ color, opacity, scale, id }) => {
    const w = 96 * scale;
    const cells = 12;
    const step = w / cells;
    const parts = [];
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        const hash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        if (hash % 5 !== 0) continue;
        const ox = ((hash >>> 8) % 100) / 100;
        const oy = ((hash >>> 16) % 100) / 100;
        const r = 0.6 + ((hash >>> 24) % 100) / 100 * 1.4;
        parts.push(svgEl('circle', {
          cx: n((x + ox) * step), cy: n((y + oy) * step), r: n(r * scale),
          fill: color, 'fill-opacity': n(opacity),
        }));
      }
    }
    return tile(id, w, w, parts);
  },

  // Nested contour lines, as on a survey map.
  topo: ({ color, opacity, scale, id }) => {
    const w = 256 * scale;
    const parts = [];
    for (let i = 1; i <= 6; i++) {
      const k = i / 6;
      const rx = w * 0.42 * k;
      const ry = w * 0.30 * k;
      const cx = w * (0.5 + 0.06 * (1 - k));
      const cy = w * (0.5 - 0.04 * (1 - k));
      parts.push(svgEl('ellipse', {
        cx: n(cx), cy: n(cy), rx: n(rx), ry: n(ry),
        fill: 'none', stroke: color, 'stroke-width': n(1.2),
        'stroke-opacity': n(opacity), transform: `rotate(-18 ${n(cx)} ${n(cy)})`,
      }));
    }
    return tile(id, w, w, parts);
  },

  // A square grid crossed by both diagonals.
  mesh: ({ color, opacity, scale, id }) => {
    const w = 40 * scale;
    const d = `M0 0 H${n(w)} M0 0 V${n(w)} M0 0 L${n(w)} ${n(w)} M${n(w)} 0 L0 ${n(w)}`;
    return tile(id, w, w, [stroke(d, color, 0.9, opacity, 'butt')]);
  },

  // Offset brickwork.
  tiles: ({ color, opacity, scale, id }) => {
    const w = 64 * scale;
    const h = 32 * scale;
    const box = (x, y, bw, bh) => svgEl('rect', {
      x: n(x), y: n(y), width: n(bw), height: n(bh), rx: n(2 * scale),
      fill: 'none', stroke: color, 'stroke-width': n(1.2), 'stroke-opacity': n(opacity),
    });
    return tile(id, w, h, [
      box(1, 1, w / 2 - 2, h / 2 - 2),
      box(w / 2 + 1, 1, w / 2 - 2, h / 2 - 2),
      box(w / 4 + 1, h / 2 + 1, w / 2 - 2, h / 2 - 2),
    ]);
  },
};

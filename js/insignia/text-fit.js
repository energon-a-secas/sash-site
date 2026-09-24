/** Deterministic certificate typesetting, shared by preview and export. */
import { FONT_METRICS } from './data/font-metrics.js';

/**
 * Sum advances, with a little room for kerning and font substitution. Accented
 * Latin letters use their base letter; unknown scripts reserve a full em.
 * No canvas or DOM measurements: font loading never changes line breaks.
 */
export function textAdvance(value, role, size) {
  const widths = FONT_METRICS[role] || FONT_METRICS.sans;
  let em = 0;
  for (const char of String(value).normalize('NFD')) {
    if (/\p{Mark}/u.test(char)) continue;
    const code = char.codePointAt(0);
    em += code >= 32 && code <= 126 ? widths[code - 32] / 1000 : 1;
  }
  return em * size * 1.04;
}

function wrap(value, role, size, width) {
  const lines = [];
  for (const paragraph of value.split('\n')) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/u)) {
      const next = line ? `${line} ${word}` : word;
      if (line && textAdvance(next, role, size) > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

/** Fit all the text into its slot. Never truncate a recipient or award text. */
export function fitText(value, { role, size, width, height, maxLines = 1 }) {
  const clean = String(value).replace(/\r\n?/g, '\n');
  // Try the authored size first, then reduce gradually. Below 10 units a
  // pathological long input is kept whole on one fitted line.
  const nominal = Math.min(size, height);
  for (let current = nominal; current >= 10; current -= 1) {
    const lines = maxLines > 1 ? wrap(clean, role, current, width) : [clean.replace(/\n/g, ' ')];
    if (lines.length <= maxLines && current * (1 + (lines.length - 1) * 1.25) <= height
      && lines.every(line => textAdvance(line, role, current) <= width)) {
      return { lines, size: current, leading: current * 1.25 };
    }
  }
  const line = clean.replace(/\n/g, ' ');
  const fitted = Math.min(nominal, width / Math.max(1, textAdvance(line, role, 1)));
  return { lines: [line], size: fitted, leading: fitted * 1.25 };
}

/**
 * Original technology symbols, drawn from the descriptions below by Codex on
 * 2026-09-24. Local SVG primitives on a 24-unit field, with no external assets.
 *
 * terminal-node: a clipped-corner terminal, prompt, cursor and three status dots.
 * circuit-core: a square die with four corner cuts and eight external contacts.
 * fault-line: a hexagonal test chamber split by a stepped electrical fault.
 * network-mesh: four square endpoints linked through one diamond-shaped router.
 * radar-sweep: two concentric scanning arcs, crosshair ticks and two returns.
 * pulse-loop: a recovery arrow encircling a single heartbeat trace.
 * Open linework is excluded from duotone fills so it never gains a false face.
 */
const line = d => ({ t: 'path', d, 'stroke-width': '1.4', nofill: true });
const face = d => ({ t: 'path', d, 'stroke-width': '1.4' });
const dot = (cx, cy, r = '0.7') => ({ t: 'circle', cx, cy, r, fill: 'currentColor', stroke: 'none' });

export const TECH_SYMBOLS = {
  'terminal-node': [
    face('M3 4 H18 L22 8 V20 H2 V5 Z'),
    line('M2 8 H22 M6 12 L9 14.5 6 17 M12 17 H17'),
    dot('5', '6'), dot('8', '6'), dot('11', '6'),
  ],
  'circuit-core': [
    face('M7 5 H17 L19 7 V17 L17 19 H7 L5 17 V7 Z'),
    face('M9 9 H15 V15 H9 Z'),
    line('M9 1 V5 M15 1 V5 M9 19 V23 M15 19 V23 M1 9 H5 M1 15 H5 M19 9 H23 M19 15 H23'),
  ],
  'fault-line': [
    line('M10 2 3 6 V17 L9 21 M14 2 21 6 V17 L15 21'),
    line('M14 2 10 9 H15 L9 16 H13 L10 22 M2 12 H6 M18 12 H22'),
  ],
  'network-mesh': [
    ...[[2, 2], [18, 2], [2, 18], [18, 18]].map(([x, y]) =>
      ({ t: 'rect', x: String(x), y: String(y), width: '4', height: '4', rx: '0.5', 'stroke-width': '1.4' })),
    line('M6 6 10 10 M18 6 14 10 M6 18 10 14 M18 18 14 14'),
    face('M12 8 16 12 12 16 8 12 Z'),
  ],
  'radar-sweep': [
    line('M12 2 A10 10 0 1 0 22 12 M12 6 A6 6 0 1 0 18 12 M12 12 20 4'),
    line('M12 1 V3 M1 12 H3 M12 21 V23 M21 12 H23'),
    dot('12', '12', '1'), dot('7', '15', '1'), dot('17', '18', '1'),
  ],
  'pulse-loop': [
    line('M20 7 A9 9 0 1 0 21 14 M20 2 V7 H15'),
    line('M5 12 H8 L10 8 13 16 15 12 H19'),
  ],
};

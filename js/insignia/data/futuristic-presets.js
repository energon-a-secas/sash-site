/**
 * Eight editable badge/certificate pairs for security labs and chaos engineering.
 * Fine technical linework, readable type and distinct palettes, using only the
 * existing v1 design schema. Symbols are original local vectors in tech-symbols.
 */
import { normalizeDesign } from '../schema.js';
import { badge } from './badges.js';

const ring = (style, color, width, inset = 0) => ({ style, color, width, inset });
const arc = (text, color, size = 25) => ({ text, color, font: 'mono', size, tracking: 1.5 });
const symbol = (glyph, color, over = {}) => ({ kind: 'glyph', glyph, color, scale: 1.04, dy: 12, ...over });
const ribbon = (text, color, textColor) => ({ text, color, textColor, font: 'mono', size: 21 });
const entry = (id, name, tags, note, design) => ({ id, name, style: 'futuristic', tags: ['futuristic', ...tags], note, design });

const shell = { base: '#101d19', accent: '#b6f36b', ink: '#0a1511', metal: 'none' };
const chaos = { base: '#25282b', accent: '#ffae70', ink: '#14181b', metal: 'none' };
const packet = { base: '#173b4b', accent: '#a0e7f0', ink: '#102834', metal: 'none' };
const kernel = { base: '#ed8c83', accent: '#432d3c', ink: '#2c202b', metal: 'none' };
const radar = { base: '#292e1f', accent: '#dae98a', ink: '#181e13', metal: 'none' };
const entropy = { base: '#382e53', accent: '#d4c5f3', ink: '#211c32', metal: 'none' };
const blackout = { base: '#20272e', accent: '#d4dde4', ink: '#11181f', metal: 'none' };
const recovery = { base: '#e1edf2', accent: '#2d5781', ink: '#20394c', metal: 'none' };

export const FUTURISTIC_BADGES = [
  entry('ghost-shell', 'Ghost Shell', ['hacking', 'security', 'terminal', 'cyberpunk'],
    'Phosphor green, a clipped terminal symbol and quiet circuit traces.', badge({
      shape: 'rounded-square', palette: shell,
      rings: [ring('double', shell.accent, 5, 9)],
      pattern: { kind: 'circuit', color: shell.accent, opacity: 0.12, scale: 1.4, fade: 0.85 },
      arcs: { top: arc('GHOST SHELL', shell.accent) },
      centre: symbol('terminal-node', shell.accent, { scale: 1.12 }),
      ribbon: ribbon('ACCESS GRANTED', shell.accent, shell.ink),
    })),
  entry('chaos-operator', 'Chaos Operator', ['chaos engineering', 'resilience', 'fault injection', 'sre'],
    'A graphite test chamber, copper-orange fault line and machined rim.', badge({
      shape: 'hexagon', palette: chaos,
      rings: [ring('gear', chaos.accent, 11), ring('solid', chaos.accent, 2, 24)],
      pattern: { kind: 'hatch', color: chaos.accent, opacity: 0.08, scale: 1.6, fade: 0.9 },
      finish: { kind: 'bevel', strength: 0.22 },
      mark: { edition: 'CHAOS OPERATOR' },
      centre: symbol('fault-line', chaos.accent),
      ribbon: ribbon('BREAK. LEARN. REPEAT.', chaos.accent, chaos.ink),
    })),
  entry('packet-phantom', 'Packet Phantom', ['hacking', 'network', 'packets', 'security', 'observability'],
    'Ice-blue routing nodes in a deep petrol shield with a fine circuit ground.', badge({
      shape: 'shield', palette: packet,
      rings: [ring('bevel', packet.accent, 8), ring('dashed', packet.accent, 3, 23)],
      pattern: { kind: 'circuit', color: packet.accent, opacity: 0.1, scale: 1.8, fade: 0.9 },
      mark: { edition: 'PACKET PHANTOM' },
      centre: symbol('network-mesh', packet.accent, { style: 'duotone', scale: 0.96 }),
      ribbon: ribbon('FOLLOW THE SIGNAL', packet.accent, packet.ink),
    })),
  entry('kernel-panic', 'Kernel Panic', ['hacking', 'debugging', 'systems', 'hardware', 'cyberpunk'],
    'Coral enamel, a dark silicon die and a precise hardware border.', badge({
      shape: 'rounded-square', palette: kernel,
      rings: [ring('dashed', kernel.accent, 2, 2), ring('solid', kernel.accent, 4, 12)],
      pattern: { kind: 'dots', color: kernel.accent, opacity: 0.1, scale: 1.4, fade: 0.8 },
      arcs: { top: arc('KERNEL PANIC', kernel.accent) },
      centre: symbol('circuit-core', kernel.accent, { style: 'duotone' }),
      ribbon: ribbon('DEBUG THE UNKNOWN', kernel.accent, '#ffede8'),
    })),
  entry('signal-hunter', 'Signal Hunter', ['hacking', 'detection', 'radar', 'observability', 'security'],
    'Citron radar returns, calibrated scanning rings and an olive-black field.', badge({
      shape: 'circle', palette: radar,
      rings: [ring('solid', radar.accent, 3, 1), ring('dashed', radar.accent, 6, 11)],
      pattern: { kind: 'rays', color: radar.accent, opacity: 0.07, scale: 1.5, fade: 0.95 },
      arcs: { top: arc('SIGNAL HUNTER', radar.accent), bottom: arc('NOTHING UNSEEN', radar.accent, 21) },
      centre: symbol('radar-sweep', radar.accent, { scale: 1.16, dy: 26 }),
    })),
  entry('entropy-engine', 'Entropy Engine', ['chaos engineering', 'experiments', 'distributed systems', 'resilience'],
    'Violet alloy, a floating orbital mark and a finely toothed outer ring.', badge({
      shape: 'circle', palette: entropy,
      rings: [ring('gear', entropy.accent, 10), ring('double', entropy.accent, 3, 12)],
      pattern: { kind: 'hexgrid', color: entropy.accent, opacity: 0.12, scale: 1.6, fade: 0.8 },
      finish: { kind: 'bevel', strength: 0.28 },
      arcs: { top: arc('ENTROPY ENGINE', entropy.accent, 24), bottom: arc('EXPECT THE UNEXPECTED', entropy.accent, 18) },
      centre: symbol('orbital', entropy.accent, { scale: 1.25, dy: 27 }),
    })),
  entry('blackout-protocol', 'Blackout Protocol', ['chaos engineering', 'incident response', 'on-call', 'sre'],
    'A monochrome watchkeeper with brushed edges and a measured, open layout.', badge({
      shape: 'hexagon', palette: blackout,
      rings: [ring('bevel', blackout.accent, 12), ring('solid', blackout.accent, 2, 24)],
      pattern: { kind: 'stripes', color: blackout.accent, opacity: 0.04, scale: 1.8, fade: 0.9 },
      mark: { edition: 'BLACKOUT / 07' },
      centre: symbol('eye', blackout.accent, { scale: 1.18, style: 'duotone' }),
      ribbon: ribbon('STAY SHARP', blackout.accent, blackout.ink),
    })),
  entry('recovery-loop', 'Recovery Loop', ['chaos engineering', 'failover', 'recovery', 'sre', 'resilience'],
    'Pale ceramic, cobalt telemetry and a heartbeat inside a recovery loop.', badge({
      shape: 'shield', palette: recovery,
      rings: [ring('double', recovery.accent, 7, 4)],
      pattern: { kind: 'hexgrid', color: recovery.accent, opacity: 0.07, scale: 1.2, fade: 0.85 },
      mark: { edition: 'RECOVERY LOOP' },
      centre: symbol('pulse-loop', recovery.accent, { scale: 1.16 }),
      ribbon: ribbon('BACK ONLINE', recovery.accent, '#edf6fa'),
    })),
];

/** Small technical seals stay clear of both signature rules and the date line. */
function seal(palette, glyph, shape = 'hexagon') {
  return badge({
    shape, palette,
    rings: [ring('solid', palette.accent, 5, 3), ring('dashed', palette.accent, 3, 25)],
    centre: symbol(glyph, palette.accent, { scale: 1.6, dy: 42 }),
  });
}

function certificate({ base, accent, ink, muted, title, eyebrow, body, issuer, glyph,
  badgePalette, frame = 'corner', width = 5, background = 'tiles', opacity = 0.12,
  titleFont = 'sans', holderFont = 'sans', portrait = false, sealShape = 'hexagon' }) {
  const text = (value, font, size, color) => ({ value, font, size, color });
  return normalizeDesign({
    schemaVersion: 1, kind: 'certificate', orientation: portrait ? 'portrait' : 'landscape',
    size: portrait ? { w: 1191, h: 1684 } : { w: 1684, h: 1191 },
    palette: { base, accent, ink, metal: 'none' },
    background: { kind: background, color: accent, opacity, scale: 1.4, fade: 0.92 },
    frame: { style: frame, color: accent, width, inset: portrait ? 60 : 52 },
    text: {
      eyebrow: text(eyebrow, 'mono', 22, accent),
      title: text(title, titleFont, portrait ? 72 : 96, ink),
      holderLabel: text('AWARDED TO', 'mono', 18, muted),
      holder: text('Alex Morgan', holderFont, portrait ? 86 : 98, ink),
      body: text(body, 'sans', 25, muted),
      issuerLine: text(issuer, 'mono', 19, muted),
      dateLabel: text('Recorded on', 'mono', 18, muted),
    },
    signatures: [{ name: 'Jordan Ellis', role: 'Lab director', from: 'text' },
      { name: 'Taylor Reed', role: 'Exercise lead', from: 'text' }],
    seal: { design: seal(badgePalette, glyph, sealShape), x: 0.5,
      y: portrait ? 0.71 : 0.737, size: portrait ? 220 : 186 },
    serial: { show: true, font: 'mono', size: 17, color: muted },
    verify: { show: true, qr: true, size: 84 },
  });
}

export const FUTURISTIC_CERTIFICATES = [
  entry('ghost-shell-credential', 'Ghost Shell Credential', ['hacking', 'security', 'terminal', 'cyberpunk'],
    'A dark phosphor terminal sheet with precise type and a custom shell seal.', certificate({
      base: '#101d19', accent: '#b6f36b', ink: '#edf5e5', muted: '#aec5b5',
      title: 'Ghost Shell', titleFont: 'mono', eyebrow: 'SECURITY RESEARCH / FIELD CREDENTIAL',
      body: 'For questioning assumptions, tracing the unexpected and finding what others missed.',
      issuer: 'Curiosity. Precision. Responsible discovery.', glyph: 'terminal-node', badgePalette: shell,
      background: 'mesh', opacity: 0.14,
    })),
  entry('chaos-field-report', 'Chaos Field Report', ['chaos engineering', 'resilience', 'fault injection', 'sre'],
    'Warm laboratory paper, burnt-orange crop rules and an industrial fault seal.', certificate({
      base: '#f1eee5', accent: '#944b25', ink: '#2a302e', muted: '#5a6057',
      title: 'Chaos Engineering', eyebrow: 'RESILIENCE LAB / CONTROLLED EXPERIMENT',
      body: 'For testing the limits, observing the blast radius and making recovery repeatable.',
      issuer: 'A steady state worth defending. A hypothesis worth testing.',
      glyph: 'fault-line', badgePalette: chaos, background: 'hatch', opacity: 0.07, width: 9,
    })),
  entry('packet-trace', 'Packet Trace', ['hacking', 'network', 'packets', 'security', 'observability'],
    'Ice-white paper, a network mesh and a dark routing seal in precise blue.', certificate({
      base: '#e8f2f4', accent: '#27687b', ink: '#20404b', muted: '#3d5862',
      title: 'Follow the signal', eyebrow: 'NETWORK RESEARCH / TRACE COMPLETE',
      body: 'For turning scattered packets into a clear picture of how the system really works.',
      issuer: 'Observe carefully. Connect the evidence.', glyph: 'network-mesh', badgePalette: packet,
      background: 'mesh', opacity: 0.09, frame: 'double', width: 5, holderFont: 'mono',
    })),
  entry('kernel-override', 'Kernel Override', ['hacking', 'debugging', 'systems', 'hardware', 'cyberpunk'],
    'Carbon-black paper, warm coral circuitry and an oversized slab-serif title.', certificate({
      base: '#231e28', accent: '#f5a095', ink: '#fbece8', muted: '#cdb5bd',
      title: 'Kernel Override', titleFont: 'slab', eyebrow: 'SYSTEMS RESEARCH / DEEP DEBUGGING',
      body: 'For working below the surface and turning an impossible failure into an understood one.',
      issuer: 'Read the trace. Find the cause. Leave it stronger.', glyph: 'circuit-core', badgePalette: kernel,
      background: 'halftone', opacity: 0.09, frame: 'double', width: 7,
    })),
  entry('radar-array', 'Radar Array', ['hacking', 'detection', 'radar', 'observability', 'security'],
    'A portrait observation record with citron scanning geometry and a radar seal.', certificate({
      base: '#252c20', accent: '#dae98a', ink: '#f0f2de', muted: '#bfc9a9',
      title: 'Signal acquired.', titleFont: 'mono', eyebrow: 'DETECTION LAB / OBSERVER RECORD',
      body: 'For finding the meaningful signal and making the invisible visible.',
      issuer: 'An alert mind. A clearer picture.', glyph: 'radar-sweep', badgePalette: radar,
      background: 'topo', opacity: 0.13, portrait: true, sealShape: 'circle',
    })),
  entry('entropy-lab', 'Entropy Lab', ['chaos engineering', 'experiments', 'distributed systems', 'resilience'],
    'Cool lilac paper, violet topographic lines and a finely drawn orbital seal.', certificate({
      base: '#eeebf5', accent: '#65508b', ink: '#38304a', muted: '#625972',
      title: 'Order through chaos', titleFont: 'mono', eyebrow: 'DISTRIBUTED SYSTEMS / EXPERIMENT LOG',
      body: 'For challenging the happy path and discovering where the system bends before it breaks.',
      issuer: 'Inject uncertainty. Record what changes. Learn.', glyph: 'orbital', badgePalette: entropy,
      background: 'topo', opacity: 0.1, frame: 'single', width: 3, sealShape: 'circle',
    })),
  entry('blackout-recovery', 'Blackout Recovery', ['chaos engineering', 'incident response', 'on-call', 'sre'],
    'A spare graphite incident record with silver rules and a watchkeeper seal.', certificate({
      base: '#20272e', accent: '#d4dde4', ink: '#f1f4f5', muted: '#b6c1ca',
      title: 'Calm under pressure', eyebrow: 'INCIDENT RESPONSE / RECOVERY RECORD',
      body: 'For keeping a clear head, guiding the response and bringing the lights back on.',
      issuer: 'Good judgment when it matters most.', glyph: 'eye', badgePalette: blackout,
      background: 'hatch', opacity: 0.055, frame: 'single', width: 3,
    })),
  entry('failover-protocol', 'Failover Protocol', ['chaos engineering', 'failover', 'recovery', 'sre', 'resilience'],
    'Deep cobalt, frost-blue telemetry and a ceramic recovery seal.', certificate({
      base: '#253e66', accent: '#adcce9', ink: '#f0f6fa', muted: '#c3d3e7',
      title: 'Built to recover', eyebrow: 'RELIABILITY ENGINEERING / FAILOVER VERIFIED',
      body: 'For rehearsing the failure, proving the fallback and making resilience part of the design.',
      issuer: 'The recovery is part of the system.', glyph: 'pulse-loop', badgePalette: recovery,
      background: 'mesh', opacity: 0.12, frame: 'corner', width: 7,
    })),
];

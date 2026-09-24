/**
 * Finished studio defaults across print, minimal and digital styles.
 * Every design uses the existing v1 schema, including its embedded seal.
 * Colors are authored as hex because that is the persisted palette format.
 */
import { normalizeDesign } from '../schema.js';
import { badge } from './badges.js';

const arc = (text, color, font = 'sans', size = 27) => ({ text, color, font, size, tracking: 2 });
const ring = (style, color, width, inset = 0) => ({ style, color, width, inset });
const mark = (glyph, color, over = {}) => ({ kind: 'glyph', glyph, color, scale: 1.12, dy: 6, ...over });

export const STUDIO_BADGES = [
  {
    id: 'gilt-laurel', name: 'Gilt Laurel', style: 'elegant',
    note: 'Satin gold, a fine beaded rim and a hand-drawn laurel.',
    design: badge({
      shape: 'circle', palette: { base: '#d8b665', accent: '#70511d', ink: '#302616', metal: 'gold' },
      rings: [ring('beaded', '#70511d', 5, 5), ring('double', '#70511d', 3, 24)],
      pattern: { kind: 'guilloche', color: '#70511d', opacity: 0.08, scale: 1.5, fade: 0.8 },
      finish: { kind: 'bevel', strength: 0.35 },
      arcs: { top: arc('WITH DISTINCTION', '#392b14', 'display', 26), bottom: arc('WELL EARNED', '#392b14', 'sans', 21) },
      centre: mark('laurel-star', '#392b14', { scale: 1.25, style: 'duotone' }),
    }),
  },
  {
    id: 'porcelain-compass', name: 'Porcelain Compass', style: 'minimal',
    note: 'Porcelain blue, precise linework and an eight-point compass.',
    design: badge({
      shape: 'hexagon', palette: { base: '#e9eff5', accent: '#325777', ink: '#233a50', metal: 'none' },
      rings: [ring('double', '#325777', 7, 3)],
      pattern: { kind: 'hatch', color: '#325777', opacity: 0.05, scale: 1.6, fade: 0.85 },
      arcs: { top: arc('EXPLORER', '#325777', 'sans', 24) },
      centre: mark('compass-rose', '#325777'),
      ribbon: { text: 'EXPLORER', color: '#325777', textColor: '#edf3f8', font: 'mono', size: 20 },
    }),
  },
  {
    id: 'copper-crest', name: 'Copper Crest', style: 'elegant',
    note: 'Oxblood enamel, a copper rim and a softly embossed emblem.',
    design: badge({
      shape: 'shield', palette: { base: '#532e34', accent: '#e0b598', ink: '#352127', metal: 'none' },
      rings: [ring('bevel', '#e0b598', 12), ring('solid', '#e0b598', 2, 25)],
      finish: { kind: 'gloss', strength: 0.25 },
      arcs: { top: arc('EXCEPTIONAL', '#f0d5bc', 'display', 28), bottom: arc('CRAFT', '#f0d5bc', 'display', 23) },
      centre: mark('quatrefoil', '#e0b598', { style: 'emboss' }),
    }),
  },
  {
    id: 'silver-imprint', name: 'Silver Imprint', style: 'elegant',
    note: 'A scalloped graphite seal with engraved silver details.',
    design: badge({
      shape: 'rosette', palette: { base: '#25343e', accent: '#d9e3e8', ink: '#192831', metal: 'none' },
      rings: [ring('bevel', '#b9cbd4', 10), ring('beaded', '#b9cbd4', 4, 23)],
      pattern: { kind: 'rays', color: '#d9e3e8', opacity: 0.05, scale: 1 },
      arcs: { top: arc('A LASTING MARK', '#e7eef2', 'display', 27), bottom: arc('EXCELLENCE', '#e7eef2', 'sans', 21) },
      centre: mark('laurel-star', '#d9e3e8', { scale: 1.2 }),
    }),
  },
  {
    id: 'peach-studio', name: 'Peach Studio', style: 'minimal',
    note: 'Warm ceramic, generous space and a simple creative mark.',
    design: badge({
      shape: 'rounded-square', palette: { base: '#f3d4bd', accent: '#88462f', ink: '#482e24', metal: 'none' },
      rings: [ring('solid', '#88462f', 3, 12)],
      arcs: { top: arc('GOOD THINGS', '#88462f', 'sans', 28) },
      centre: mark('palette', '#88462f', { scale: 0.95, style: 'duotone' }),
      ribbon: { text: 'TAKE PRACTICE', color: '#88462f', textColor: '#fae9dc', font: 'sans', size: 20 },
    }),
  },
  {
    id: 'orbital-mint', name: 'Orbital Mint', style: 'bold',
    note: 'Mint enamel, dark inlay and an orbital symbol drawn locally.',
    design: badge({
      shape: 'hexagon', palette: { base: '#58d6ba', accent: '#163f42', ink: '#15383b', metal: 'none' },
      rings: [ring('bevel', '#b4f1de', 13), ring('solid', '#163f42', 3, 20)],
      finish: { kind: 'gloss', strength: 0.4 },
      arcs: { top: arc('CURIOUS', '#163f42', 'mono', 24) },
      centre: mark('orbital', '#163f42', { scale: 1.2 }),
      ribbon: { text: 'DISCOVERY', color: '#163f42', textColor: '#d1faed', font: 'mono', size: 21 },
    }),
  },
  {
    id: 'vermilion-star', name: 'Vermilion Star', style: 'bold',
    note: 'A sculpted red star, warm highlights and a confident ribbon.',
    design: badge({
      shape: 'star', palette: { base: '#b54139', accent: '#f6c59d', ink: '#492622', metal: 'none' },
      rings: [ring('bevel', '#f6c59d', 11)], finish: { kind: 'facet', strength: 0.38 },
      centre: mark('sparkles', '#fae4cf', { scale: 0.62, dy: 18 }),
      ribbon: { text: 'STANDOUT', color: '#f6c59d', textColor: '#492622', font: 'slab', size: 24 },
    }),
  },
  {
    id: 'sage-rosette', name: 'Sage Rosette', style: 'minimal',
    note: 'Sage green and cream, a stitched edge and a growing sprout.',
    design: badge({
      shape: 'rosette', palette: { base: '#456258', accent: '#e0ddbd', ink: '#273e36', metal: 'none' },
      rings: [ring('rope', '#e0ddbd', 9), ring('solid', '#e0ddbd', 2, 24)],
      arcs: { top: arc('ROOM TO GROW', '#eeeacf', 'display', 28), bottom: arc('EVERY DAY', '#eeeacf', 'sans', 22) },
      centre: mark('sprout', '#eeeacf', { scale: 1, style: 'duotone' }),
    }),
  },
];

/** A compact medal: no ribbon or arc competing with the certificate's words. */
function seal({ base, accent, ink, glyph = 'laurel-star', shape = 'circle', metal = 'none' }) {
  return badge({
    shape, palette: { base, accent, ink, metal },
    rings: [ring('beaded', accent, 5, 5), ring('double', accent, 4, 28)],
    pattern: { kind: 'guilloche', color: accent, opacity: 0.09, scale: 1.5, fade: 0.8 },
    centre: mark(glyph, accent, { scale: 1.7, dy: 42, style: 'duotone' }),
    finish: { kind: 'bevel', strength: 0.3 },
  });
}

function certificate({ base, accent, ink, muted, title, eyebrow = 'CERTIFICATE OF ACHIEVEMENT',
  body, frame = 'double', background = 'plain', opacity = 0.08, titleFont = 'display',
  holderFont = 'script', portrait = false, emblem = 'laurel-star', metal = 'none', bold = false }) {
  const slot = (value, font, size, color) => ({ value, font, size, color });
  return normalizeDesign({
    schemaVersion: 1, kind: 'certificate', orientation: portrait ? 'portrait' : 'landscape',
    size: portrait ? { w: 1191, h: 1684 } : { w: 1684, h: 1191 },
    palette: { base, accent, ink, metal: 'none' },
    background: { kind: background, color: accent, opacity, scale: 1.2, fade: 0.85 },
    frame: { style: frame, width: bold ? 12 : 4, color: accent, inset: portrait ? 58 : 52 },
    text: {
      eyebrow: slot(eyebrow, 'mono', 22, muted),
      title: slot(title, titleFont, portrait ? 76 : 88, ink),
      holderLabel: slot('PRESENTED TO', 'sans', 18, muted),
      holder: slot('Alex Morgan', holderFont, portrait ? 100 : 106, ink),
      body: slot(body, 'sans', 25, muted),
      issuerLine: slot('In recognition of dedication, curiosity and craft.', 'sans', 21, muted),
      dateLabel: slot('Awarded on', 'mono', 18, muted),
    },
    signatures: [{ name: 'Jordan Ellis', role: 'Program director', from: 'text' },
      { name: 'Taylor Reed', role: 'Community lead', from: 'text' }],
    seal: { design: seal({ base: metal === 'gold' ? '#d8b665' : base, accent, ink, glyph: emblem, metal }),
      x: 0.5, y: portrait ? 0.70 : 0.737, size: portrait ? 210 : 184 },
    serial: { show: true, font: 'mono', size: 17, color: muted },
    verify: { show: true, qr: true, size: 84 },
  });
}

export const STUDIO_CERTIFICATES = [
  {
    id: 'ivory-honours', name: 'Ivory Honours', style: 'elegant',
    note: 'Warm paper, engraved gold lines and a satin laurel seal.',
    design: certificate({ base: '#f8f4e9', accent: '#977338', ink: '#33372d', muted: '#68624f',
      title: 'Excellence in Practice', background: 'guilloche', opacity: 0.11, metal: 'gold',
      body: 'For thoughtful work, continued growth and a standard worth celebrating.' }),
  },
  {
    id: 'botanical-paper', name: 'Botanical Paper', style: 'elegant',
    note: 'Portrait paper in sage and cream, a botanical seal and fine rules.',
    design: certificate({ base: '#f0f2e9', accent: '#526951', ink: '#293d32', muted: '#586454',
      portrait: true, title: 'A Lasting Contribution', eyebrow: 'COMMUNITY RECOGNITION',
      background: 'hatch', opacity: 0.035, emblem: 'sprout',
      body: 'For sharing knowledge generously and helping others find their footing.' }),
  },
  {
    id: 'claret-fellowship', name: 'Claret Fellowship', style: 'elegant',
    note: 'A deep claret sheet, champagne type and an intricate metallic seal.',
    design: certificate({ base: '#39232c', accent: '#d1b184', ink: '#f7ead8', muted: '#c6b39f',
      title: 'An Outstanding Contribution', eyebrow: 'RECOGNITION OF DISTINCTION',
      background: 'guilloche', opacity: 0.12, emblem: 'quatrefoil',
      body: 'For raising the quality of the work and bringing the whole team forward.' }),
  },
  {
    id: 'swiss-record', name: 'Swiss Record', style: 'minimal',
    note: 'Clean paper, charcoal typography and measured vermilion details.',
    design: certificate({ base: '#f4f2ed', accent: '#a33d2d', ink: '#303532', muted: '#575c54',
      title: 'Beautifully done.', titleFont: 'sans', holderFont: 'display', frame: 'corner',
      eyebrow: 'A RECORD OF GOOD WORK', emblem: 'compass-rose',
      body: 'Completed with care. Built to last. Ready for what comes next.' }),
  },
  {
    id: 'blueprint-edition', name: 'Blueprint Edition', style: 'minimal',
    note: 'A cool drafting sheet with fine blue geometry and precise type.',
    design: certificate({ base: '#eaf0f5', accent: '#356185', ink: '#253f54', muted: '#465d6b',
      title: 'From idea to impact', titleFont: 'slab', holderFont: 'sans', frame: 'single',
      eyebrow: 'CERTIFICATE OF COMPLETION', emblem: 'compass-rose',
      background: 'tiles', opacity: 0.065,
      body: 'For turning a difficult question into something useful, clear and complete.' }),
  },
  {
    id: 'cobalt-distinction', name: 'Cobalt Distinction', style: 'bold',
    note: 'Saturated cobalt, luminous cream typography and a bright seal.',
    design: certificate({ base: '#233f88', accent: '#eace8d', ink: '#f8f0de', muted: '#d0dbee',
      title: 'Beyond the expected', titleFont: 'display', holderFont: 'sans', bold: true,
      eyebrow: 'EXCEPTIONAL WORK, RECOGNISED', background: 'guilloche', opacity: 0.16,
      body: 'For original thinking, confident execution and a remarkable result.' }),
  },
  {
    id: 'apricot-statement', name: 'Apricot Statement', style: 'bold',
    note: 'Warm apricot, confident red type and a playful orbital emblem.',
    design: certificate({ base: '#f4cba9', accent: '#81392b', ink: '#633226', muted: '#664333',
      title: 'A brilliant beginning.', titleFont: 'sans', holderFont: 'display', frame: 'corner',
      eyebrow: 'FIRST MILESTONE', emblem: 'orbital', bold: true,
      body: 'For taking the first step, asking good questions and making it happen.' }),
  },
  {
    id: 'midnight-orbit', name: 'Midnight Orbit', style: 'bold',
    note: 'Midnight teal, mint contour lines and a crisp scientific seal.',
    design: certificate({ base: '#173539', accent: '#8bdfc0', ink: '#e6f5e8', muted: '#aecdc1',
      title: 'Curiosity, rewarded.', titleFont: 'sans', holderFont: 'script', frame: 'double',
      eyebrow: 'THE NEXT DISCOVERY STARTS HERE', emblem: 'orbital',
      background: 'topo', opacity: 0.16,
      body: 'For exploring the unfamiliar and sharing what you found along the way.' }),
  },
];

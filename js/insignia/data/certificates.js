/**
 * Insignia catalogue: the certificate presets.
 *
 * Twelve of them, and deliberately not diploma stock. The reference is the
 * colour language of incident tooling and security consoles: dark grounds, one
 * signal colour each, fixed-width serials, contour and mesh backgrounds. Two
 * are light because a certificate gets printed, and neither of those is beige.
 *
 * Every design holds the ISO A aspect of 1.4142 in both orientations, so
 * print-to-PDF against A4 is exact, and `serial.show` and `verify.show` are on
 * everywhere. The seals are whole badge documents embedded by value (C1.2), and
 * each one sits high enough to clear the provenance band, which starts at
 * `size.h - (frame.inset + 26) - 96`.
 *
 * Design round 2 (2026-09-15) gave six of them one of the security-print
 * fields each, so the catalogue shows every new field somewhere and the rest
 * draw as they shipped: `charter` a microtext border, a paper grain and the
 * issuer's handle on its first signature rule; `red-team` the latent PARODY
 * tone; `audit-trail` the issue stamp and the loud record block; `cold-print`
 * a hatch ground with an ink-coloured grain; `violet-signal` the dense
 * guilloche fading to a clear middle; `graphite` a sunburst. Every default is
 * the drawing that shipped before its field existed, so the other six are
 * byte for byte what they were.
 *
 * Owned by D1. Vendored into `<site>/js/insignia/data/certificates.js`.
 */
import { normalizeDesign } from '../schema.js';
import { badge } from './badges.js';

const certificate = (d) => normalizeDesign({ ...d, schemaVersion: 1, kind: 'certificate' });

const LANDSCAPE = { w: 1684, h: 1191 };
const PORTRAIT = { w: 1191, h: 1684 };

/** The seal on a certificate is a whole badge design, embedded by value (C1.2). */
const seal = (over) => badge({
  shape: 'hexagon',
  rings: [{ style: 'solid', width: 14, color: '#f5d67b', inset: 0 }],
  pattern: { kind: 'hexgrid', color: '#ffffff', opacity: 0.12, scale: 1 },
  arcs: { top: null, bottom: null },
  centre: { kind: 'glyph', glyph: 'shield', color: '#ffffff', scale: 1.2, dy: -30 },
  ribbon: null,
  ...over,
});

const cert = ({ base, accent, ink, dim, body, background, frame, text, ...rest }) => certificate({
  orientation: rest.orientation || 'landscape',
  size: rest.orientation === 'portrait' ? PORTRAIT : LANDSCAPE,
  palette: { base, accent, ink, metal: 'none' },
  background,
  frame,
  text: {
    eyebrow: { value: text.eyebrow, font: text.eyebrowFont || 'sans', size: 34, color: dim },
    title: { value: text.title, font: text.titleFont || 'display', size: text.titleSize || 96, color: ink },
    holderLabel: { value: 'awarded to', font: 'sans', size: 28, color: dim },
    holder: { value: '', font: text.holderFont || 'script', size: 84, color: ink },
    issuerLine: { value: '', font: 'sans', size: 26, color: dim },
    body: { value: text.body || '', font: 'sans', size: 26, color: body },
    dateLabel: { value: 'issued', font: 'sans', size: 22, color: dim },
  },
  serial: { show: true, font: 'mono', size: 20, color: dim, style: rest.serialStyle || 'quiet' },
  verify: { show: true, qr: true, size: 120 },
  signatures: rest.signatures || [],
  seal: rest.seal || { design: null, x: 0.5, y: 0.72, size: 200 },
  // Off unless a preset asks; the kit's 0.24, 0.80, 180 are the defaults it fills.
  stamp: rest.stamp || {},
});

export const CERTIFICATE_PRESETS = [
  {
    id: 'incident-report',
    name: 'Incident Report',
    note: 'Graphite ground, one red signal colour, corner rules. Reads as a document rather than a prize.',
    design: cert({
      base: '#0b0f14', accent: '#ff4d4d', ink: '#e8edf2', dim: '#8fa0b0', body: '#c2ced8',
      background: { kind: 'topo', color: '#ff4d4d', opacity: 0.16, scale: 1 },
      frame: { style: 'corner', width: 6, color: '#ff4d4d', inset: 48 },
      text: {
        eyebrow: 'POST INCIDENT REVIEW',
        title: 'BLAST RADIUS',
        titleFont: 'slab',
        body: 'Held the line for four hours with the graphs on fire.',
      },
      signatures: [{ name: '', role: 'incident commander' }],
    }),
  },
  {
    id: 'chaos-lab',
    name: 'Chaos Lab',
    note: 'Phosphor green on near-black with a mesh ground. The house style of the campaign.',
    design: cert({
      base: '#06110c', accent: '#29ff9c', ink: '#e6fff4', dim: '#7fbfa3', body: '#bfe9d6',
      background: { kind: 'mesh', color: '#29ff9c', opacity: 0.18, scale: 1 },
      frame: { style: 'double', width: 10, color: '#29ff9c', inset: 44 },
      text: {
        eyebrow: 'FIELD EXERCISE',
        title: 'CHAOS ENGINEERING',
        body: 'Broke it deliberately, in daylight, with a rollback ready.',
      },
      seal: { design: seal({ palette: { base: '#06110c', accent: '#29ff9c', ink: '#02150c', metal: 'none' }, rings: [{ style: 'solid', width: 14, color: '#29ff9c', inset: 0 }], centre: { kind: 'glyph', glyph: 'skull', color: '#29ff9c', scale: 1.2, dy: -30 } }), x: 0.5, y: 0.71, size: 200 },
    }),
  },
  {
    id: 'red-team',
    name: 'Red Team',
    note: 'Guilloche under crimson, single heavy rule, the word PARODY latent in the paper at the kit\'s fixed four percent. The most conventional layout here, in the least conventional colours.',
    design: cert({
      base: '#120507', accent: '#ff2e63', ink: '#ffe9ee', dim: '#c98a99', body: '#f3c9d4',
      background: { kind: 'guilloche', color: '#ff2e63', opacity: 0.22, scale: 1, latent: 'parody' },
      frame: { style: 'single', width: 12, color: '#ff2e63', inset: 46 },
      text: {
        eyebrow: 'ADVERSARY SIMULATION',
        title: 'GOT IN ANYWAY',
        titleSize: 88,
        body: 'Found the door that was never in the diagram.',
      },
      signatures: [{ name: '', role: 'exercise lead' }, { name: '', role: 'observer' }],
    }),
  },
  {
    id: 'blue-team',
    name: 'Blue Team',
    note: 'Contour lines in cold blue, a doubled rule and a seal. The defensive half of the pair.',
    design: cert({
      base: '#05101c', accent: '#4cc9ff', ink: '#e6f6ff', dim: '#7fa8c4', body: '#c3e2f5',
      background: { kind: 'topo', color: '#4cc9ff', opacity: 0.2, scale: 1.2 },
      frame: { style: 'double', width: 10, color: '#4cc9ff', inset: 44 },
      text: {
        eyebrow: 'DETECTION AND RESPONSE',
        title: 'CAUGHT IT FIRST',
        body: 'Read the alert nobody else read, at the hour nobody else was awake.',
      },
      seal: { design: seal({ palette: { base: '#05101c', accent: '#4cc9ff', ink: '#02090f', metal: 'none' }, rings: [{ style: 'double', width: 12, color: '#4cc9ff', inset: 0 }], centre: { kind: 'glyph', glyph: 'eye', color: '#4cc9ff', scale: 1.2, dy: -30 } }), x: 0.5, y: 0.71, size: 200 },
    }),
  },
  {
    id: 'amber-console',
    name: 'Amber Console',
    note: 'Tiles in amber on a warm black, rope rule. The one that looks like a serial console at four in the morning.',
    design: cert({
      base: '#140c00', accent: '#ffb020', ink: '#fff2d9', dim: '#c99b52', body: '#f0d9ac',
      background: { kind: 'tiles', color: '#ffb020', opacity: 0.16, scale: 1 },
      frame: { style: 'rope', width: 10, color: '#ffb020', inset: 46 },
      text: {
        eyebrow: 'SUSTAINED OPERATIONS',
        title: 'KEPT IT RUNNING',
        titleFont: 'slab',
        holderFont: 'mono',
        body: 'Four hundred days of somebody else never noticing.',
      },
    }),
  },
  {
    id: 'violet-signal',
    name: 'Violet Signal',
    note: 'The campaign palette on a certificate: violet guilloche fading to a clear middle so the words sit on plain ground, gold rule, embedded seal.',
    design: cert({
      base: '#0b1020', accent: '#7c3aed', ink: '#e7e9ff', dim: '#9aa3d0', body: '#c3c8ea',
      background: { kind: 'guilloche', color: '#7c3aed', opacity: 0.22, scale: 1, fade: 0.5 },
      frame: { style: 'double', width: 14, color: '#7c3aed', inset: 42 },
      text: {
        eyebrow: 'CERTIFICATE OF',
        title: 'DELIBERATE PRACTICE',
        body: 'Did the unglamorous version of the work, repeatedly.',
      },
      seal: { design: seal({ palette: { base: '#7c3aed', accent: '#f5d67b', ink: '#0b1020', metal: 'none' }, centre: { kind: 'glyph', glyph: 'sparkles', color: '#ffffff', scale: 1.2, dy: -30 } }), x: 0.5, y: 0.71, size: 210 },
    }),
  },
  {
    id: 'graphite',
    name: 'Graphite',
    note: 'Light ground, near-black text, one red rule, a faint sunburst behind the title. For printing, and not beige.',
    design: cert({
      base: '#f2f3f5', accent: '#b3001b', ink: '#14171a', dim: '#5c646c', body: '#2c3238',
      background: { kind: 'sunburst', color: '#14171a', opacity: 0.07, scale: 1 },
      frame: { style: 'single', width: 8, color: '#b3001b', inset: 46 },
      text: {
        eyebrow: 'REVIEW BOARD',
        title: 'SIGNED OFF',
        titleFont: 'slab',
        body: 'Read every line of it before saying yes.',
      },
      signatures: [{ name: '', role: 'reviewer' }],
    }),
  },
  {
    id: 'cold-print',
    name: 'Cold Print',
    note: 'White ground with the fleet blue, a faint hatched weave over an ink-coloured paper grain, corner rules. The other print preset.',
    design: cert({
      // The dim slate was #5a6472 until the band was measured over the ink
      // grain it now sits on (warnings.js bandWorst): 4.47:1 on the grained
      // plate, so a shade darker to keep the shipped preset silent.
      base: '#ffffff', accent: '#0063e5', ink: '#0b1020', dim: '#56606e', body: '#243040',
      background: { kind: 'hatch', color: '#0063e5', opacity: 0.1, scale: 1.1, grain: 0.08 },
      frame: { style: 'corner', width: 6, color: '#0063e5', inset: 50 },
      text: {
        eyebrow: 'ON THE RECORD',
        title: 'SHIPPED IT',
        body: 'Put it in front of a stranger and it worked.',
      },
    }),
  },
  {
    id: 'audit-trail',
    name: 'Audit Trail',
    note: 'Monochrome, no signal colour at all. Everything carried by the rules, the fixed-width serial in its loud record block, and the issue stamp.',
    design: cert({
      base: '#0a0a0a', accent: '#d4d4d4', ink: '#fafafa', dim: '#8a8a8a', body: '#c4c4c4',
      background: { kind: 'tiles', color: '#ffffff', opacity: 0.08, scale: 1.4 },
      frame: { style: 'corner', width: 5, color: '#d4d4d4', inset: 52 },
      text: {
        eyebrow: 'RECORD OF WORK',
        title: 'EVERY COMMIT EXPLAINED',
        titleFont: 'mono',
        titleSize: 64,
        holderFont: 'mono',
        body: 'Wrote down why, not only what.',
      },
      // The record block (No., the serial, the QR in its crop marks, the dates)
      // and the stamp at the kit's default place, which the band holds on the
      // paper at about y 0.785 on a landscape page.
      stamp: { show: true },
      serialStyle: 'loud',
    }),
  },
  {
    id: 'charter',
    name: 'Charter',
    note: 'The portrait preset. Gold rope rule on deep blue with a microtext border inside it, a paper grain, seal set low, the issuer\'s handle on the first signature rule and a witness on the second.',
    design: cert({
      orientation: 'portrait',
      base: '#081226', accent: '#f5d67b', ink: '#f4efe1', dim: '#a8a48f', body: '#ded7c2',
      background: { kind: 'guilloche', color: '#f5d67b', opacity: 0.16, scale: 0.9, grain: 0.06 },
      frame: { style: 'rope', width: 12, color: '#f5d67b', inset: 56, microtext: true },
      text: {
        eyebrow: 'BY RESOLUTION OF THE FLEET',
        title: 'CHARTER MEMBER',
        titleSize: 76,
        body: 'Was here before there was anything to be here for.',
      },
      signatures: [{ name: '', role: 'for the fleet', from: 'issuer' }, { name: '', role: 'witness' }],
      seal: { design: seal({ palette: { base: '#c8a24a', accent: '#2b1c05', ink: '#2b1c05', metal: 'gold' }, rings: [{ style: 'beaded', width: 8, color: '#2b1c05', inset: 10 }], centre: { kind: 'glyph', glyph: 'crown', color: '#2b1c05', scale: 1.2, dy: -30 } }), x: 0.5, y: 0.7, size: 220 },
    }),
  },
  {
    id: 'on-call',
    name: 'On Call',
    note: 'Magenta on aubergine with a mesh ground. Loud on a screen, still readable printed.',
    design: cert({
      base: '#100a16', accent: '#ff7ad9', ink: '#ffe9fb', dim: '#c48ab4', body: '#f0c6e4',
      background: { kind: 'mesh', color: '#ff7ad9', opacity: 0.18, scale: 1.1 },
      frame: { style: 'double', width: 10, color: '#ff7ad9', inset: 44 },
      text: {
        eyebrow: 'ROTATION COMPLETE',
        title: 'CARRIED THE PAGER',
        titleSize: 84,
        body: 'Answered every page, including the ones that were nothing.',
      },
      signatures: [{ name: '', role: 'rotation lead' }],
    }),
  },
  {
    id: 'dry-run',
    name: 'Dry Run',
    note: 'Cyan contour lines, a single hairline rule, no seal. The quietest certificate here.',
    design: cert({
      base: '#071013', accent: '#7ce7ff', ink: '#dff7ff', dim: '#7fa6b3', body: '#b9dfeb',
      background: { kind: 'topo', color: '#7ce7ff', opacity: 0.14, scale: 1.3 },
      frame: { style: 'single', width: 4, color: '#7ce7ff', inset: 50 },
      text: {
        eyebrow: 'REHEARSAL',
        title: 'PRACTISED THE FAILURE',
        titleFont: 'sans',
        titleSize: 72,
        body: 'Ran the recovery before anybody needed it.',
      },
    }),
  },
];

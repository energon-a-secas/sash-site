/**
 * Insignia catalogue: font pairings.
 *
 * A pairing names three **roles** (C7.13), never a family. A design document
 * stores the role and the kit maps role to family in `schema.js` (C7.14), so
 * swapping Playfair Display for something else is a kit change rather than a
 * migration of every stored design. That indirection is the most valuable one
 * in C1 and this file is the place it would be easiest to break, so: no string
 * in here is a font name.
 *
 * The three slots, and what each drives:
 *
 *   arc     the badge's top and bottom arc text, and a certificate title
 *   ribbon  the badge ribbon, and a certificate holder line
 *   body    everything set in running text: a certificate eyebrow, body,
 *           issuer line and date line
 *
 * The serial is always the mono role and no pairing changes it, because the
 * serial is read off paper and typed back in (C4.1) and a proportional face
 * makes that harder for no gain.
 *
 * Owned by D1. Vendored into `<site>/js/insignia/data/fonts.js`.
 */

export const PAIRING_SLOTS = ['arc', 'ribbon', 'body'];

export const PAIRINGS = [
  {
    id: 'classic',
    name: 'Classic',
    note: 'A high-contrast serif over a geometric sans. The safe first choice.',
    arc: 'display', ribbon: 'sans', body: 'sans',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    note: 'The same serif, with a joined hand on the ribbon for the one human line.',
    arc: 'display', ribbon: 'script', body: 'sans',
  },
  {
    id: 'industrial',
    name: 'Industrial',
    note: 'A heavy slab against a fixed-width ribbon. Reads as machined rather than awarded.',
    arc: 'slab', ribbon: 'mono', body: 'sans',
  },
  {
    id: 'terminal',
    name: 'Terminal',
    note: 'Fixed width throughout. Every glyph on the same rhythm as the serial.',
    arc: 'mono', ribbon: 'mono', body: 'mono',
  },
  {
    id: 'console',
    name: 'Console',
    note: 'Fixed-width arcs over a readable sans body, for long paragraphs a mono would fight.',
    arc: 'mono', ribbon: 'rounded', body: 'sans',
  },
  {
    id: 'soft',
    name: 'Soft',
    note: 'Rounded terminals top and bottom. The warmest pairing here.',
    arc: 'rounded', ribbon: 'rounded', body: 'sans',
  },
  {
    id: 'ledger',
    name: 'Ledger',
    note: 'A slab arc, a written ribbon and a fixed-width body: a record rather than a poster.',
    arc: 'slab', ribbon: 'script', body: 'mono',
  },
  {
    id: 'poster',
    name: 'Poster',
    note: 'One family doing all three jobs. Loud, even and quick to read at thumbnail size.',
    arc: 'sans', ribbon: 'sans', body: 'sans',
  },
  {
    id: 'plate',
    name: 'Plate',
    note: 'Slab arcs with a sans ribbon and a slab body. Weighty without the serif contrast.',
    arc: 'slab', ribbon: 'sans', body: 'slab',
  },
  {
    id: 'handwritten',
    name: 'Handwritten',
    note: 'A serif arc with a joined hand on the ribbon and rounded running text.',
    arc: 'display', ribbon: 'script', body: 'rounded',
  },
];

/** Pairing ids, in the order a picker should list them. */
export const PAIRING_LIST = PAIRINGS.map((p) => p.id);

/** A pairing by id, or the first one. Never returns undefined. */
export function pairing(id) {
  return PAIRINGS.find((p) => p.id === id) || PAIRINGS[0];
}

/**
 * The roles a pairing puts on a badge, as a patch over an existing design.
 * Returns only the font fields, so a caller merges it without disturbing the
 * text, the size or the colour an author already set.
 */
export function badgeFonts(id) {
  const p = pairing(id);
  return { arcTop: p.arc, arcBottom: p.arc, ribbon: p.ribbon };
}

/** The same, for the seven certificate text slots of C1.2. */
export function certificateFonts(id) {
  const p = pairing(id);
  return {
    eyebrow: p.body,
    title: p.arc,
    holderLabel: p.body,
    holder: p.ribbon,
    issuerLine: p.body,
    body: p.body,
    dateLabel: p.body,
  };
}

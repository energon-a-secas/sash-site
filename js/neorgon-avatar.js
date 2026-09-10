// ══════════════════════════════════════════════════════════════
// Neorgon Avatar Kit — canonical source: packages/neorgon-ui/avatar/avatar.js
// Vendored into sites as js/neorgon-avatar.js by packages/neorgon-ui/sync-avatar.sh
// DO NOT EDIT THE VENDORED COPY. Edit the canonical file and re-run the sync.
//
// 16x16 pixel characters, drawn from a spec:
//   { kind, skin, coat, hair, hairColor, eyes, face, outfit, shirt, head, accessory, held, pet }
// Every value is an id from CATALOG (or a hex for skin/coat/hairColor/shirt).
// A spec travels as a code: "neoav1:" + base64url(JSON). The code is what
// the fleet cookie `neo_character` holds, what Pixeldoll exports, and what
// Floorplan's person sheet accepts. Parts carry a tier (common, rare,
// legendary) and an `unlock` id; rendering never gates a part, only a
// picker does, reading the `neo_unlocks` cookie.
// ══════════════════════════════════════════════════════════════

export const SIZE = 16
export const CODE_PREFIX = 'neoav1:'

// ── Palette ──────────────────────────────────────────────────
export const SKIN = ['#f9d3b4', '#eab68a', '#d9a06b', '#c68642', '#8d5524', '#5c3a21']
export const COAT = ['#f2a65a', '#c9c9c9', '#3a3a3a', '#a8703a', '#f4efe6', '#7a5230']
export const HAIR_COLORS = ['#2b1b0e', '#4a2c17', '#8a5a2b', '#d9a441', '#1c1c1c', '#c9c9c9', '#b5423a', '#3b2f6b', '#e8d4a2', '#22c55e']
const INK = {
  K: '#111827', W: '#f8fafc', M: '#9ca3af', m: '#4b5563', G: '#eab308', g: '#a16207', R: '#ef4444', B: '#3b82f6', b: '#1d4ed8',
  N: '#8b5a2b', n: '#5c3a21', P: '#f9a8d4', L: '#22c55e', l: '#15803d', Y: '#fde047', O: '#f97316', T: '#22d3ee', V: '#7c3aed', v: '#4c1d95', A: '#a3e635',
}

// ── Catalog: every slot and its parts. tier: common | rare | legendary ──
const part = (id, name, tier = 'common', unlock = null) => ({ id, name, tier, unlock })
export const CATALOG = {
  kind: [part('person', 'Person'), part('cat', 'Cat'), part('dog', 'Dog'), part('robot', 'Robot'), part('ghost', 'Ghost', 'legendary', 'spectral'), part('alien', 'Alien', 'legendary', 'visitor')],
  hair: [part('none', 'None'), part('flat', 'Flat'), part('tall', 'Tall'), part('side', 'Side swept'), part('long', 'Long'), part('curly', 'Curly'), part('bun', 'Bun'), part('ponytail', 'Ponytail'), part('afro', 'Afro', 'rare', 'style'), part('mohawk', 'Mohawk', 'rare', 'style')],
  eyes: [part('dot', 'Dot'), part('wide', 'Wide'), part('sleepy', 'Sleepy'), part('wink', 'Wink', 'rare', 'charm')],
  face: [part('none', 'None'), part('beard', 'Beard'), part('moustache', 'Moustache'), part('freckles', 'Freckles'), part('blush', 'Blush')],
  outfit: [part('tee', 'T-shirt'), part('hoodie', 'Hoodie'), part('suit', 'Suit'), part('overalls', 'Overalls'), part('labcoat', 'Lab coat'), part('armor', 'Armor', 'rare', 'quest'), part('gown', 'Gown', 'legendary', 'royal')],
  head: [part('none', 'None'), part('cap', 'Cap'), part('beanie', 'Beanie'), part('headset', 'Headset'), part('bandana', 'Bandana'), part('tophat', 'Top hat', 'rare', 'charm'), part('horns', 'Horns', 'rare', 'quest'), part('crown', 'Crown', 'legendary', 'royal'), part('halo', 'Halo', 'legendary', 'spectral')],
  accessory: [part('none', 'None'), part('glasses', 'Glasses'), part('sunglasses', 'Sunglasses'), part('scarf', 'Scarf'), part('bowtie', 'Bow tie'), part('badge', 'Badge'), part('earrings', 'Earrings', 'rare', 'charm'), part('cape', 'Cape', 'legendary', 'royal')],
  held: [part('none', 'None'), part('laptop', 'Laptop'), part('coffee', 'Coffee'), part('book', 'Book'), part('phone', 'Phone'), part('plant', 'Plant'), part('sword', 'Sword', 'rare', 'quest'), part('wand', 'Wand', 'legendary', 'spectral')],
  pet: [part('none', 'None'), part('cat', 'Cat'), part('dog', 'Dog'), part('bird', 'Bird', 'rare', 'charm'), part('dragon', 'Dragon', 'legendary', 'quest')],
}
export const SLOTS = Object.keys(CATALOG)
export const UNLOCK_IDS = ['style', 'charm', 'quest', 'royal', 'spectral', 'visitor']

const isHex = v => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v || ''))
const has = (slot, id) => CATALOG[slot].some(p => p.id === id)
export const partOf = (slot, id) => CATALOG[slot].find(p => p.id === id) || CATALOG[slot][0]

// ── Spec ─────────────────────────────────────────────────────
export function defaultSpec() {
  return { kind: 'person', skin: SKIN[1], coat: COAT[0], hair: 'flat', hairColor: HAIR_COLORS[0], eyes: 'dot', face: 'none', outfit: 'tee', shirt: '#64748b', head: 'none', accessory: 'none', held: 'none', pet: 'none' }
}
/** Anything -> a complete, valid spec. Unknown ids fall back; hexes are kept. */
export function normalizeSpec(raw) {
  const d = defaultSpec()
  if (!raw || typeof raw !== 'object') return d
  for (const slot of SLOTS) if (raw[slot] != null && has(slot, String(raw[slot]))) d[slot] = String(raw[slot])
  for (const k of ['skin', 'coat', 'hairColor', 'shirt']) if (isHex(raw[k])) d[k] = String(raw[k]).toLowerCase()
  if (typeof raw.skin === 'number' && SKIN[raw.skin]) d.skin = SKIN[raw.skin]
  if (typeof raw.coat === 'number' && COAT[raw.coat]) d.coat = COAT[raw.coat]
  if (typeof raw.hairColor === 'number' && HAIR_COLORS[raw.hairColor]) d.hairColor = HAIR_COLORS[raw.hairColor]
  return d
}
export function specToCode(spec) {
  const s = normalizeSpec(spec), d = defaultSpec(), out = {}
  for (const k of Object.keys(s)) if (s[k] !== d[k]) out[k] = s[k]   // only what differs from the default keeps codes short
  return CODE_PREFIX + b64url(JSON.stringify(out))
}
/** Accepts a bare code, a URL carrying #c= or ?c=, or a JSON object string. null when unreadable. */
export function codeToSpec(input) {
  let s = String(input || '').trim()
  if (!s) return null
  const m = s.match(/[#?&]c=([^&#\s]+)/); if (m) s = decodeURIComponent(m[1])
  if (s.startsWith(CODE_PREFIX)) s = s.slice(CODE_PREFIX.length)
  try { if (s.startsWith('{')) return normalizeSpec(JSON.parse(s)); return normalizeSpec(JSON.parse(b64urlDecode(s))) } catch { return null }
}
function b64url(str) { const bytes = new TextEncoder().encode(str); let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b) }); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
function b64urlDecode(str) { const b64 = str.replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))) }

// ── Seeded and random looks ──────────────────────────────────
export function hashStr(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
export function mulberry32(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
/** Deterministic look for a name: common parts only, so two sites agree. */
export function seededSpec(name, { shirt } = {}) {
  const rnd = mulberry32(hashStr(String(name || '?').toLowerCase()))
  const pick = arr => arr[Math.floor(rnd() * arr.length)]
  const commons = slot => CATALOG[slot].filter(p => p.tier === 'common').map(p => p.id)
  const s = defaultSpec()
  s.skin = pick(SKIN); s.coat = pick(COAT); s.hairColor = pick(HAIR_COLORS.slice(0, 9))
  s.hair = pick(commons('hair').filter(h => h !== 'none'))
  s.eyes = rnd() < 0.8 ? 'dot' : pick(commons('eyes'))
  s.face = rnd() < 0.25 ? pick(commons('face').filter(f => f !== 'none')) : 'none'
  s.outfit = rnd() < 0.7 ? 'tee' : pick(commons('outfit'))
  s.accessory = rnd() < 0.22 ? 'glasses' : 'none'
  if (shirt && isHex(shirt)) s.shirt = shirt
  return s
}
/** A random look drawn from unlocked parts (unlocked: Set of unlock ids). */
export function randomSpec(rnd = Math.random, unlocked = new Set()) {
  const allowed = slot => CATALOG[slot].filter(p => !p.unlock || unlocked.has(p.unlock)).map(p => p.id)
  const pick = arr => arr[Math.floor(rnd() * arr.length)]
  const s = defaultSpec()
  s.kind = rnd() < 0.75 ? 'person' : pick(allowed('kind'))
  s.skin = pick(SKIN); s.coat = pick(COAT); s.hairColor = pick(HAIR_COLORS)
  for (const slot of ['hair', 'eyes', 'face', 'outfit', 'head', 'accessory', 'held', 'pet']) s[slot] = rnd() < (slot === 'hair' || slot === 'outfit' ? 1 : 0.45) ? pick(allowed(slot)) : 'none'
  if (s.hair === 'none' && rnd() < 0.8) s.hair = pick(allowed('hair').filter(h => h !== 'none'))
  return s
}

// ── Drawing ──────────────────────────────────────────────────
function shade(hex, f) {
  const m = String(hex).replace('#', ''); const h = m.length === 3 ? m.split('').map(c => c + c).join('') : m
  const n = parseInt(h, 16); const k = v => Math.max(0, Math.min(255, Math.round(v * f)))
  return `rgb(${k((n >> 16) & 255)},${k((n >> 8) & 255)},${k(n & 255)})`
}
/** Draw `rows` (strings of palette letters, '.' = skip) at (x0, y0). */
function blit(px, rows, x0, y0, pal) {
  rows.forEach((row, dy) => { for (let dx = 0; dx < row.length; dx++) { const ch = row[dx]; if (ch === '.' || ch === ' ') continue; const c = pal[ch] ?? INK[ch]; if (c) px(x0 + dx, y0 + dy, c) } })
}

/** Draw the sprite at 1 unit per pixel onto ctx at (ox, oy), scaled by `scale`. `frame` 0 stands, 1 and 2 are the two walking steps. */
export function drawSprite(ctx, rawSpec, { x = 0, y = 0, scale = 1, frame = 0 } = {}) {
  const s = normalizeSpec(rawSpec)
  const px = (cx, cy, c) => { if (cx < 0 || cy < 0 || cx >= SIZE || cy >= SIZE) return; ctx.fillStyle = c; ctx.fillRect(x + cx * scale, y + cy * scale, scale, scale) }
  const pal = {
    S: s.skin, s: shade(s.skin, 0.8), H: s.hairColor, h: shade(s.hairColor, 0.75), C: s.shirt, c: shade(s.shirt, 0.78), d: shade(s.shirt, 1.2),
    F: s.coat, f: shade(s.coat, 0.72), E: s.kind === 'robot' ? INK.T : INK.K,
  }
  const human = s.kind === 'person' || s.kind === 'alien'
  const furry = s.kind === 'cat' || s.kind === 'dog'
  // 1. cape behind everything
  if (s.accessory === 'cape') blit(px, ['..VV........VV..', '..VV........VV..', '..VVV......VVV..', '..VVVV....VVVV..', '..VVVVVVVVVVVV..', '...VVVVVVVVVV...'], 0, 10, pal)
  // 2. body + legs by kind
  if (s.kind === 'ghost') {
    const tail = frame === 1 ? ['....WW.WW.WW....', '.....W....W.....'] : ['....W.WWWW.W....', '....W..WW..W....']
    blit(px, ['.....WWWWWW.....', '....WWWWWWWW....', '....WWWWWWWW....', '....WWWWWWWW....', '....WWWWWWWW....', '....WWWWWWWW....', '....WWWWWWWW....', '....WWWWWWWW....', '....WWWWWWWW....', '....WWWWWWWW....', ...tail], 0, 3, pal)
    px(6, 6, INK.K); px(9, 6, INK.K); px(7, 8, INK.m)
  } else {
    blit(px, outfitRows(s), 0, 10, pal)
    // legs: frame 0 both planted, 1 lifts the right leg, 2 lifts the left
    const legs = s.kind === 'robot' ? 'm' : furry ? 'f' : 'n'
    const L = INK[legs] || pal[legs]
    px(5, 14, L); px(6, 14, L); px(9, 14, L); px(10, 14, L)
    if (frame !== 1) { px(9, 15, L); px(10, 15, L) }
    if (frame !== 2) { px(5, 15, L); px(6, 15, L) }
    if (frame === 1) { px(4, 15, L) }
    if (frame === 2) { px(11, 15, L) }
    // hands
    const hand = human ? 'S' : furry ? 'F' : 'M'
    px(3, 13, pal[hand] || INK[hand]); px(12, 13, pal[hand] || INK[hand])
  }
  // 3. head by kind
  if (s.kind === 'person') blit(px, ['......SSSS......', '.....SSSSSS.....', '.....SSSSSS.....', '.....SSSSSS.....', '.....SSSSSS.....', '......SSSS......', '.......SS.......'], 0, 3, pal)
  if (s.kind === 'alien') { blit(px, ['.....AAAAAA.....', '....AAAAAAAA....', '....AAAAAAAA....', '....AAAAAAAA....', '.....AAAAAA.....', '......AAAA......', '.......AA.......'], 0, 2, pal); px(6, 4, INK.K); px(6, 5, INK.K); px(9, 4, INK.K); px(9, 5, INK.K) }
  if (s.kind === 'cat') { blit(px, ['.....F....F.....', '.....FF..FF.....', '.....FFFFFF.....', '....FFFFFFFF....', '....FFFFFFFF....', '.....FFFFFF.....', '......FFFF......', '.......FF.......'], 0, 2, pal); px(5, 3, INK.P); px(10, 3, INK.P); px(7, 7, INK.P); px(8, 7, INK.P); px(3, 6, pal.f); px(12, 6, pal.f) }
  if (s.kind === 'dog') { blit(px, ['......FFFF......', '....fFFFFFFf....', '....fFFFFFFf....', '....fFFFFFFf....', '.....FFFFFF.....', '......FFFF......', '.......FF.......'], 0, 3, pal); px(7, 7, pal.f); px(8, 7, pal.f); px(7, 8, INK.K); px(8, 8, INK.K) }
  if (s.kind === 'robot') { blit(px, ['.......R........', '.......m........', '.....MMMMMM.....', '....MMMMMMMM....', '....MMMMMMMM....', '....MMMMMMMM....', '....MMMMMMMM....', '.....mmmmmm.....', '.......mm.......'], 0, 1, pal); px(6, 8, INK.m); px(8, 8, INK.m); px(4, 5, INK.m); px(11, 5, INK.m) }
  // 4. face hair, eyes, mouth (not for ghost/robot where drawn)
  if (s.kind !== 'ghost') {
    if (human || furry) {
      if (s.face === 'beard') blit(px, ['.....H....H.....', '.....HHHHHH.....', '......HHHH......'], 0, 7, pal)
      if (s.face === 'moustache') blit(px, ['......HHHH......'], 0, 7, pal)
      if (s.face === 'freckles') { px(6, 7, pal.s); px(9, 7, pal.s) }
      if (s.face === 'blush') { px(5, 7, INK.P); px(10, 7, INK.P) }
      if (s.face === 'none' && human) { px(7, 8, pal.s); px(8, 8, pal.s) }
    }
    if (s.kind !== 'alien') {
      const E = pal.E
      if (s.eyes === 'dot') { px(6, 6, E); px(9, 6, E) }
      if (s.eyes === 'wide') { px(6, 5, E); px(6, 6, E); px(9, 5, E); px(9, 6, E) }
      if (s.eyes === 'sleepy') { px(6, 6, E); px(9, 6, E); px(6, 5, pal.s || INK.m); px(9, 5, pal.s || INK.m) }
      if (s.eyes === 'wink') { px(5, 6, E); px(6, 6, E); px(9, 6, E); px(9, 5, E) }
    }
  }
  // 5. hair (person only; pets and robots keep their own tops)
  if (s.kind === 'person' && s.hair !== 'none') blit(px, hairRows(s.hair), 0, 0, pal)
  // 6. head items
  if (s.head !== 'none') blit(px, headRows(s.head), 0, 0, pal)
  // 7. accessories over the face/neck
  if (s.accessory === 'glasses') blit(px, ['.....K.KK.K.....'], 0, 6, pal)
  if (s.accessory === 'sunglasses') blit(px, ['.....KKKKKK.....'], 0, 6, pal)
  if (s.accessory === 'scarf') blit(px, ['.....RRRRRR.....', '.........RR.....'], 0, 9, pal)
  if (s.accessory === 'bowtie') blit(px, ['......R.KR......'], 0, 9, pal)
  if (s.accessory === 'badge') px(5, 11, INK.G)
  if (s.accessory === 'earrings') { px(4, 7, INK.G); px(11, 7, INK.G) }
  // 8. held item, right hand
  if (s.held !== 'none') blit(px, heldRows(s.held), 0, 0, pal)
  // 9. pet, bottom left
  if (s.pet !== 'none') blit(px, petRows(s.pet), 0, 0, pal)
}

function outfitRows(s) {
  switch (s.outfit) {
    case 'hoodie': return ['.....cccccc.....', '....CCcCCcCC....', '...SCCCCCCCCS...', '...SCCCCCCCCS...', '....CCCCCCCC....']
    case 'suit': return ['....KKKWWKKK....', '...SKKKWRKKKS...', '...SKKKWRKKKS...', '....KKKKKKKK....']
    case 'overalls': return ['....CbCCCCbC....', '...SCbbbbbbCS...', '...SbbbbbbbbS...', '....bbbbbbbb....']
    case 'labcoat': return ['....WWWCCWWW....', '...SWWWCCWWWS...', '...SWWWWWWWWS...', '....WWWWWWWW....']
    case 'armor': return ['....GMMMMMMG....', '...MMMmMMmMMM...', '...MMMMMMMMMM...', '....mMMMMMMm....']
    case 'gown': return ['....dCCCCCCd....', '...SCCdCCdCCS...', '..CCCCCCCCCCCC..', '.CCCCCCCCCCCCCC.']
    default: return ['....CCCCCCCC....', '...SCCCdCCCCS...', '...SCCCCCCCCS...', '....cCCCCCCc....']
  }
}
function hairRows(hair) {
  switch (hair) {
    case 'flat': return ['', '', '', '......HHHH......', '.....H....H.....']
    case 'tall': return ['', '', '.....HHHHHH.....', '.....HHHHHH.....', '.....H....H.....']
    case 'side': return ['', '', '.....HHHHH......', '....HHHHHHH.....', '....HH..........', '....H...........']
    case 'long': return ['', '', '.....HHHHHH.....', '....HHHHHHHH....', '....H......H....', '....H......H....', '....H......H....', '....H......H....', '....H......H....']
    case 'curly': return ['', '', '....HH.HH.HH....', '...HHHHHHHHHH...', '...HH......HH...', '....H......H....']
    case 'bun': return ['', '.......HH.......', '......HHHH......', '......HHHH......', '.....H....H.....']
    case 'ponytail': return ['', '', '.....HHHHHH.....', '....HHHHHHHH....', '...........HH...', '...........HH...', '............H...', '............H...']
    case 'afro': return ['', '....HHHHHHHH....', '...HHHHHHHHHH...', '...HHHHHHHHHH...', '...HH......HH...', '...HH......HH...', '....H......H....']
    case 'mohawk': return ['.......HH.......', '.......HH.......', '.......HH.......', '......HHHH......', '']
    default: return []
  }
}
function headRows(head) {
  switch (head) {
    case 'cap': return ['', '', '.....CCCCCC.....', '....CCCCCCCCcc..', '']
    case 'beanie': return ['', '.......WW.......', '.....RRRRRR.....', '....RRRRRRRR....', '....R......R....']
    case 'headset': return ['', '', '.....mmmmmm.....', '....m......m....', '....m......m....', '....m......m....', '....M...........', '....MM..........']
    case 'bandana': return ['', '', '.....RRRRRR.....', '....RRRRRRRR....', '....R......RR...', '............R...']
    case 'tophat': return ['......KKKK......', '......KKKK......', '......KRRK......', '....KKKKKKKK....']
    case 'horns': return ['....N......N....', '.....N....N.....', '.....N....N.....']
    case 'crown': return ['', '.....G.GG.G.....', '.....GGGGGG.....', '.....GRGGRG.....']
    case 'halo': return ['', '......YYYY......', '.....Y....Y.....']
    default: return []
  }
}
function heldRows(held) {
  switch (held) {
    case 'laptop': return ['', '', '', '', '', '', '', '', '', '', '', '............BBBB', '............MMMM', '............MMMM']
    case 'coffee': return ['', '', '', '', '', '', '', '', '', '', '', '.............W..', '............WWW.', '............WW..']
    case 'book': return ['', '', '', '', '', '', '', '', '', '', '.............RRR', '.............RWR', '.............RWR', '.............RRR']
    case 'phone': return ['', '', '', '', '', '', '', '', '', '', '', '.............KK.', '.............KT.', '.............KK.']
    case 'plant': return ['', '', '', '', '', '', '', '', '', '............L.L.', '.............LL.', '.............NN.', '.............NN.']
    case 'sword': return ['', '', '', '', '', '', '', '', '..............M.', '..............M.', '..............M.', '..............M.', '.............GGG', '..............n.']
    case 'wand': return ['', '', '', '', '', '', '', '.............Y.Y', '..............Y.', '..............N.', '..............N.', '..............N.', '..............N.']
    default: return []
  }
}
function petRows(pet) {
  switch (pet) {
    case 'cat': return ['', '', '', '', '', '', '', '', '', '', '', '', '.M.M............', '.MMM............', '.MMM............', '.M.M............']
    case 'dog': return ['', '', '', '', '', '', '', '', '', '', '', '', '.NNN............', 'nNNNn...........', '.NNN............', '.N.N............']
    case 'bird': return ['', '', '', '', '', '', '', '', '', '', '', '', '..BB............', '..BBO...........', '...B............', '..B.B...........']
    case 'dragon': return ['', '', '', '', '', '', '', '', '', '', '.L..............', 'LLL.............', '.LLR............', 'LLLL............', '.LLL............', '.L.L............']
    default: return []
  }
}

// ── Rasterize (cached) ───────────────────────────────────────
const cache = new Map()
export function spriteDataUrl(rawSpec, scale = 1, frame = 0) {
  const s = normalizeSpec(rawSpec)
  const key = JSON.stringify(s) + '@' + scale + (frame ? '#' + frame : '')
  if (cache.has(key)) return cache.get(key)
  if (typeof document === 'undefined') return ''
  const c = document.createElement('canvas'); c.width = SIZE * scale; c.height = SIZE * scale
  drawSprite(c.getContext('2d'), s, { scale, frame })
  const url = c.toDataURL('image/png')
  cache.set(key, url)
  return url
}
export function spriteImg(spec, { px = 32, cls = '', alt = '' } = {}) {
  return `<img class="px-avatar ${cls}" src="${spriteDataUrl(spec, 1)}" alt="${alt}" width="${px}" height="${px}" draggable="false" style="image-rendering:pixelated">`
}

// ── Fleet cookies: my character and my unlocks, shared across *.neorgon.com ──
const CHAR_COOKIE = 'neo_character', UNLOCK_COOKIE = 'neo_unlocks'
function cookieDomain() { return typeof location !== 'undefined' && /(^|\.)neorgon\.com$/.test(location.hostname) ? '; Domain=.neorgon.com' : '' }
function readCookie(name) { if (typeof document === 'undefined') return null; const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)')); return m ? decodeURIComponent(m[1]) : null }
function writeCookie(name, value, days = 365) { if (typeof document === 'undefined') return; document.cookie = name + '=' + encodeURIComponent(value) + '; Path=/; Max-Age=' + (days * 86400) + '; SameSite=Lax' + cookieDomain() }
/** The visitor's own character (spec) or null. */
export function readCharacter() { const c = readCookie(CHAR_COOKIE); return c ? codeToSpec(c) : null }
export function writeCharacter(spec) { writeCookie(CHAR_COOKIE, specToCode(spec)) }
export function clearCharacter() { writeCookie(CHAR_COOKIE, '', -1) }
/** Set of unlock ids the visitor has earned. */
export function readUnlocks() { const c = readCookie(UNLOCK_COOKIE); return new Set((c || '').split(',').map(x => x.trim()).filter(x => UNLOCK_IDS.includes(x))) }
export function writeUnlocks(set) { writeCookie(UNLOCK_COOKIE, [...set].filter(x => UNLOCK_IDS.includes(x)).join(',')) }
export function isUnlocked(part, unlocked) { return !part?.unlock || unlocked.has(part.unlock) }

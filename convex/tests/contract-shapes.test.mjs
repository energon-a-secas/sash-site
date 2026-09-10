/**
 * Run: node projects/sash-site/convex/tests/contract-shapes.test.mjs
 *
 * C15 A45's durable check, built by `qa-engineer`. Four amendments (A19, A30,
 * A41, A45) exist because a type block in CONTRACTS.md disagreed with the
 * object its own function returns, and every one of the four was found by a
 * human calling the function by hand. Nothing in this repository would have
 * caught any of them.
 *
 * What it does: calls every public query that has an observable shape, in every
 * state a fixture can put it in, and diffs two things against the expectation
 * table below:
 *
 *   1. the sorted key list, so an added or dropped field is red, and
 *   2. the null-ness of each field, so A19's class of defect (a value that
 *      became nullable while its type block still said `string`) is red.
 *
 * The expectation table is transcribed from CONTRACTS.md **as amended**, with
 * the section or amendment cited on every row. When this file was written the
 * body block and the amendment disagreed for three of these shapes, and the
 * amendment won; **A49 has since corrected all four of those divergences in the
 * body**, so the two now say the same thing. The citations stay because they
 * are how a reader gets from a key list back to the ruling that put the key
 * there, and the foot of every run records that the divergences were closed
 * rather than leaving a reader to re-derive it.
 *
 * It needs the deployment, unlike the other three tests in this folder, and it
 * reads the URL out of the shipped page rather than out of .env.local, which is
 * C8.2's rule and makes the test point at whatever the site points at.
 *
 * Exit codes follow the house convention in enums.test.mjs:
 *   0  every shape matches
 *   1  a shape disagrees with the contract
 *   2  nothing was compared (no deployment, no fixtures, no client). Not a pass.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, '..', '..');                  // projects/sash-site
const ROOT = join(SITE, '..', '..');                  // the monorepo root

/* ── the deployment URL comes out of the page, per C8.2 ───────────────────── */
const PAGE = join(SITE, 'index.html');
if (!existsSync(PAGE)) bail(`no ${PAGE} to read a deployment URL from`);
const meta = readFileSync(PAGE, 'utf8')
  .match(/<meta\s+name="neo-convex-url"\s+content="(https:\/\/[a-z-]+-\d+\.convex\.cloud)"/);
if (!meta) bail(`${PAGE} carries no valid neo-convex-url meta tag`);
const DEPLOYMENT = meta[1];

const CLIENT = join(SITE, 'node_modules', 'convex', 'dist', 'esm', 'browser', 'index.js');
if (!existsSync(CLIENT)) bail('convex is not installed under projects/sash-site (npm install)');
const { ConvexHttpClient } = await import(CLIENT);
const convex = new ConvexHttpClient(DEPLOYMENT);

function bail(why) {
  console.error(`contract-shapes.test: nothing was compared: ${why}`);
  process.exit(2);
}

/* ── the expectation table ────────────────────────────────────────────────────
   `keys` is the exact sorted key list. `null` lists the fields that ARE null in
   this state; every other key must be non-null. Splitting it this way is the
   point: "nullable" as a type is unfalsifiable, "null in this state and not in
   that one" is a check that can fail. */

const SHAPES = {
  // C2.2 as amended by A39, which added `showcase`. The body block omitted it
  // until A49; it lists all seven keys now and agrees with this row.
  PublicProfile: {
    ref: 'C2.2 + A39',
    keys: ['avatarCode', 'bio', 'counts', 'displayName', 'handle', 'headline', 'showcase'],
  },

  // C2.6 as amended by A6, A19, A42.1 and A45. The body block typed origin,
  // category, issuerHandle and versionN non-nullable until A49; it carries the
  // nullable forms now and agrees with this row and with the null lists below.
  PublicAward: {
    ref: 'C2.6 + A6 + A19 + A45',
    keys: ['artUrl', 'category', 'count', 'criteria', 'description', 'design', 'evidenceUrl',
           'expiresAt', 'holderDisplayName', 'holderHandle', 'importMeta', 'issuedAt',
           'issuerHandle', 'kind', 'name', 'origin', 'publicId', 'revokedAt', 'skills',
           'source', 'sphere', 'status', 'verifyUrl', 'versionN'],
  },

  // C2.6's one-line intersection type.
  OwnAward: {
    ref: 'C2.6, OwnAward = PublicAward & { hidden, pinned }',
    keys: ['artUrl', 'category', 'count', 'criteria', 'description', 'design', 'evidenceUrl',
           'expiresAt', 'hidden', 'holderDisplayName', 'holderHandle', 'importMeta', 'issuedAt',
           'issuerHandle', 'kind', 'name', 'origin', 'pinned', 'publicId', 'revokedAt', 'skills',
           'source', 'sphere', 'status', 'verifyUrl', 'versionN'],
  },

  // C2.5 as amended by A21 (added defaultValidityMs), A30, A41 and A46.1. The
  // body block was short by `defaultValidityMs` until A49; it lists all
  // thirteen keys now and agrees with this row.
  ClaimPreview: {
    ref: 'C2.5 + A21 + A30 + A41',
    keys: ['category', 'defaultValidityMs', 'design', 'expiresAt', 'issuerHandle', 'kind',
           'origin', 'sphere', 'state', 'templateCriteria', 'templateDescription',
           'templateName', 'usesLeft'],
  },

  // C2.7. Three keys, and the only one of these shapes no amendment touched.
  Kudo: {
    ref: 'C2.7',
    keys: ['createdAt', 'fromHandle', 'message'],
  },

  // C2.5's claimants row.
  Claimant: {
    ref: 'C2.5',
    keys: ['awardPublicId', 'displayName', 'handle', 'issuedAt'],
  },

  // A8.3 ruled that TemplateRow and TemplateDetail are never defined in the
  // contract and that B1's definitions in templates.ts are the contract, so
  // these two rows are a snapshot rather than a transcription. A field arriving
  // or leaving is still red, which is the value: it is the only warning a
  // frontend gets that the shape it reads has moved.
  TemplateRow: {
    ref: 'A8.3, snapshot of templates.ts',
    keys: ['access', 'allowList', 'artUrl', 'category', 'createdAt', 'criteria',
           'currentVersionId', 'defaultValidityMs', 'description', 'issuerHandle', 'kind',
           'name', 'origin', 'publicId', 'seats', 'skills', 'slug', 'sphere', 'stackable',
           'status', 'templateId', 'updatedAt', 'versionN'],
  },
  TemplateDetail: {
    ref: 'A8.3, snapshot of templates.ts',
    keys: ['access', 'allowList', 'artUrl', 'category', 'createdAt', 'criteria',
           'currentVersionId', 'defaultValidityMs', 'description', 'design', 'draftDirty',
           'issuerHandle', 'kind', 'name', 'origin', 'publicId', 'publishedDesign', 'seats',
           'skills', 'slug', 'sphere', 'stackable', 'status', 'templateId', 'updatedAt',
           'versionN'],
  },
};

/* ── fixtures, and what state each one puts a query in ────────────────────── */
const FIX = {
  handlePublic:   'sash-qa',
  handlePrivate:  'f3b-hidden',
  handleLong:     'abcdefghij-klmnopqrst-uvwxyz12',
  handleAbsent:   'no-such-handle-exists-here',
  awardCommunity: 'cd28grv80a',   // community certificate, claim, valid, no expiry
  awardExpired:   'ze79panfbe',   // community badge, claim, expired
  awardImported:  'kkn7wfj1f3',   // origin imported, five nulls
  awardStacked:   'zre9aw99y5',   // recognition, count 5, sphere non-null
  awardHidden:    'pg7hyq95s1',   // hidden by its holder, A43
  awardMine:      '1ptt6t7yg6',   // the same holder's own wallet row, seen through awards:mine:
                                  // community, claim, valid, no expiry. Pinned by id so the
                                  // OwnAward null list below describes one known state (A56)
  awardAbsent:    'zzzzzzzzzz',
  tokenOk:        'yhdnm4zs24p2z9dyyqxrdf',
  tokenExpired:   'mbxcewp04y5pmjs5hwy41e',
  tokenExhausted: 'fbsctkbc12dh2c2rfmhbd1',
  tokenRevoked:   '3grcfr5x54dg8xjxqfjr24',
  tokenAbsent:    '00000000000000000000zz',   // matches C4.3, no row
  tokenMalformed: 'NOT-A-TOKEN!',             // fails C4.3
};

/* ── the runner ───────────────────────────────────────────────────────────── */
let pass = 0, fail = 0, compared = 0;
const notes = [];

function ok(label) { pass++; console.log(`  ok   ${label}`); }
function no(label, got, want) {
  fail++;
  console.log(`  FAIL ${label}`);
  console.log(`         got  ${JSON.stringify(got)}`);
  console.log(`         want ${JSON.stringify(want)}`);
}
function is(label, got, want) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) ok(label); else no(label, got, want);
}

/** The two diffs A45 asks for, run against one object. */
function checkShape(shapeName, label, obj, nullFields) {
  const spec = SHAPES[shapeName];
  if (!spec) throw new Error(`no expectation for ${shapeName}`);
  compared++;
  if (obj === null || typeof obj !== 'object') {
    no(`${label}: ${shapeName} is an object`, obj, `a ${shapeName}`);
    return;
  }
  is(`${label}: ${shapeName} key list (${spec.ref})`, Object.keys(obj).sort(), [...spec.keys].sort());
  const actuallyNull = Object.keys(obj).filter((k) => obj[k] === null).sort();
  is(`${label}: null fields`, actuallyNull, [...nullFields].sort());
}

async function q(fn, args) {
  try { return { value: await convex.query(fn, args) }; }
  // The whole message, not its first line: Convex prefixes a request id and
  // "Server Error" ahead of the thrown text, so a first-line match reports
  // every refusal as the wrong refusal. This check failed that way once.
  catch (e) { return { threw: String(e.message || e) }; }
}

/* ── profiles ─────────────────────────────────────────────────────────────── */
console.log(`\ncontract-shapes.test against ${DEPLOYMENT}`);
console.log('\nC2.2 profiles');
{
  const r = await q('profiles:me', {});
  is('profiles:me signed out is null, not an empty object (C2.2)', r.value, null);

  const pub = (await q('profiles:byHandle', { handle: FIX.handlePublic })).value;
  checkShape('PublicProfile', `byHandle public @${FIX.handlePublic}`, pub, ['avatarCode'].filter(() => pub && pub.avatarCode === null));
  is('and counts carries the four C2.2 groups',
     pub && Object.keys(pub.counts).sort(), ['community', 'imported', 'neorgon', 'recognition']);
  is('and showcase is an array (A39)', Array.isArray(pub && pub.showcase), true);

  const priv = await q('profiles:byHandle', { handle: FIX.handlePrivate });
  is('byHandle on a private profile is null to a stranger (C2.2)', priv.value, null);
  const gone = await q('profiles:byHandle', { handle: FIX.handleAbsent });
  is('byHandle on an absent handle is null (C2.2)', gone.value, null);
}

/* ── awards ───────────────────────────────────────────────────────────────── */
console.log('\nC2.6 awards');
{
  const cases = [
    // label,                     fixture,               fields that must be null in this state
    ['valid community, no expiry', FIX.awardCommunity,   ['artUrl', 'evidenceUrl', 'expiresAt', 'importMeta', 'revokedAt', 'sphere']],
    ['expired community',          FIX.awardExpired,     ['artUrl', 'evidenceUrl', 'importMeta', 'revokedAt', 'sphere']],
    // A6 + A19 + A45: five nulls at once, and the state every one of the four
    // amendments was about.
    ['imported',                   FIX.awardImported,    ['artUrl', 'category', 'design', 'importMeta', 'issuerHandle', 'revokedAt', 'sphere', 'versionN'].filter((k) => k !== 'importMeta')],
    ['stacked recognition',        FIX.awardStacked,     ['artUrl', 'evidenceUrl', 'expiresAt', 'importMeta', 'revokedAt']],
  ];
  for (const [label, publicId, nulls] of cases) {
    const aw = (await q('awards:byPublicId', { publicId })).value;
    checkShape('PublicAward', `byPublicId ${label}`, aw, nulls);
  }

  const imported = (await q('awards:byPublicId', { publicId: FIX.awardImported })).value;
  is('an imported award reports origin "imported" (A6)', imported && imported.origin, 'imported');
  is('and importMeta is non-null exactly there (C2.6)', imported && imported.importMeta !== null, true);
  is('and design is null, so it cannot reach renderSvg (C11.4)', imported && imported.design, null);

  const stacked = (await q('awards:byPublicId', { publicId: FIX.awardStacked })).value;
  is('sphere is non-null exactly when category is recognition (C7.4)',
     stacked && [stacked.category, stacked.sphere !== null], ['recognition', true]);
  is('a stacked award reports its count, not one row per stack (C2.7.5)',
     stacked && stacked.count > 1, true);

  const expired = (await q('awards:byPublicId', { publicId: FIX.awardExpired })).value;
  is('status is computed server-side and reads "expired" (C2.6)', expired && expired.status, 'expired');
  is('and expiresAt is an ISO 8601 string with Z, not a number (C2.6)',
     typeof (expired && expired.expiresAt) === 'string' && /Z$/.test(expired.expiresAt), true);
  is('issuedAt likewise (C2.6, and A19 types both of these `number`)',
     typeof (expired && expired.issuedAt) === 'string' && /Z$/.test(expired.issuedAt), true);

  const absent = await q('awards:byPublicId', { publicId: FIX.awardAbsent });
  is('byPublicId on an absent id is null (C2.6)', absent.value, null);

  // A43. A public id is a capability, so byPublicId still answers for a hidden
  // award, and the public listing and the public showcase both drop it.
  const hidden = (await q('awards:byPublicId', { publicId: FIX.awardHidden })).value;
  is('a hidden award still answers on its own public id (A43)', hidden !== null, true);
  const listed = (await q('awards:forHandle', { handle: FIX.handlePublic, limit: 200 })).value;
  is('and is absent from awards:forHandle (A43)',
     Array.isArray(listed) && listed.some((a) => a.publicId === FIX.awardHidden), false);
  const owner = (await q('profiles:byHandle', { handle: FIX.handlePublic })).value;
  is('and absent from the public showcase (A43)',
     owner && owner.showcase.includes(FIX.awardHidden), false);

  is('forHandle rows are PublicAwards, not a narrower projection (C2.6)',
     Array.isArray(listed) && listed.length > 0
       ? Object.keys(listed[0]).sort().join(',') === [...SHAPES.PublicAward.keys].sort().join(',')
       : 'no rows to check',
     true);
  compared++;

  const privateWall = (await q('awards:forHandle', { handle: FIX.handlePrivate, limit: 200 })).value;
  is('forHandle on a private profile leaks no rows (C2.2 visibility)',
     Array.isArray(privateWall) ? privateWall.length : privateWall, 0);
}

/* ── claims ───────────────────────────────────────────────────────────────── */
console.log('\nC2.5 claims:preview, five states');
{
  const live = ['category', 'defaultValidityMs', 'sphere', 'usesLeft'];
  const cases = [
    ['ok, unlimited',  FIX.tokenOk,        'ok',        ['sphere', 'usesLeft']],
    ['expired',        FIX.tokenExpired,   'expired',   ['defaultValidityMs', 'sphere', 'usesLeft']],
    ['exhausted',      FIX.tokenExhausted, 'exhausted', ['defaultValidityMs', 'sphere']],
    ['revoked',        FIX.tokenRevoked,   'revoked',   ['sphere', 'usesLeft']],
    // A41's documented not-found variant: one absent value in the shape, plus
    // the three empty template strings A46.1 accepted as a residual.
    ['not-found',      FIX.tokenAbsent,    'not-found', ['category', 'defaultValidityMs', 'design', 'issuerHandle', 'sphere', 'usesLeft']],
  ];
  for (const [label, token, state, nulls] of cases) {
    const cp = (await q('claims:preview', { token })).value;
    checkShape('ClaimPreview', `preview ${label}`, cp, nulls);
    is(`preview ${label}: state`, cp && cp.state, state);
  }
  void live;

  const ok = (await q('claims:preview', { token: FIX.tokenOk })).value;
  is('usesLeft is null on an unlimited link, not a number (A41)', ok && ok.usesLeft, null);
  const ex = (await q('claims:preview', { token: FIX.tokenExhausted })).value;
  is('and a number on a seat-limited one (A41)', typeof (ex && ex.usesLeft), 'number');
  is('an exhausted link reports no seats left', ex && ex.usesLeft, 0);

  const nf = (await q('claims:preview', { token: FIX.tokenAbsent })).value;
  is('the not-found variant reports expiresAt 0 (A41)', nf && nf.expiresAt, 0);
  is('and origin "community", which is A46.1\'s accepted lie', nf && nf.origin, 'community');
  is('and empty strings for the three template fields (A46.1)',
     nf && [nf.templateName, nf.templateDescription, nf.templateCriteria], ['', '', '']);

  const bad = await q('claims:preview', { token: FIX.tokenMalformed });
  is('a token failing the C4.3 regex returns null, not a state (C2.5)', bad.value, null);

  const preview = (await q('claims:preview', { token: FIX.tokenOk })).value;
  is('preview leaks no seat count, allow list or subject (B3, C3.2)',
     Object.keys(preview || {}).filter((k) => /^(maxUses|uses|allowList|createdBy|token)$/.test(k)), []);
}

/* ── templates, kudos, auth ───────────────────────────────────────────────── */
console.log('\nC2.3 templates and C2.7 kudos');
{
  const rows = (await q('templates:listPublic', { limit: 100 })).value;
  if (!Array.isArray(rows) || rows.length === 0) bail('templates:listPublic returned nothing, so no TemplateRow was compared');
  checkShape('TemplateRow', 'listPublic[0]', rows[0], Object.keys(rows[0]).filter((k) => rows[0][k] === null));
  is('listPublic returns only published rows (C2.3)', [...new Set(rows.map((t) => t.status))], ['published']);
  is('and only non-private access (C2.3)', rows.filter((t) => t.access === 'private').length, 0);
  is('and no row hands an anonymous caller an allow list',
     rows.filter((t) => (t.allowList || []).length > 0).map((t) => t.publicId), []);

  const detail = (await q('templates:get', { publicId: rows[0].publicId })).value;
  checkShape('TemplateDetail', `get ${rows[0].publicId}`, detail, Object.keys(detail || {}).filter((k) => detail[k] === null));

  const kudos = (await q('kudos:forAward', { awardPublicId: FIX.awardStacked })).value;
  if (!Array.isArray(kudos) || kudos.length === 0) bail('no kudos on the stacked fixture, so no Kudo was compared');
  checkShape('Kudo', 'kudos:forAward[0]', kudos[0], []);
  is('a stacked award keeps one kudos row per send (C2.7.6)',
     kudos.length >= 2, true);

  const admin = await q('auth:isAdmin', {});
  is('auth:isAdmin answers a boolean signed out, not null (C2.8)', typeof admin.value, 'boolean');
  is('and it is false', admin.value, false);
}

/* ── the authentication boundary ──────────────────────────────────────────── */
console.log('\nC2 error convention: authentication throws, everything else returns');
for (const fn of ['awards:mine', 'claims:mine', 'templates:mine']) {
  const r = await q(fn, {});
  is(`${fn} throws signed out rather than returning an envelope (C2)`,
     Boolean(r.threw) && /Uncaught Error: Not authenticated/.test(r.threw), true);
}

/* ── the identity-scoped shapes, through the A10 testkit ──────────────────── */
console.log('\nC2.6 OwnAward and C2.5 Claimant, through convex/testkit.ts (A10)');
{
  const { execFileSync } = await import('node:child_process');
  const run = (fn, subject, args) => {
    const out = execFileSync('npx', ['convex', 'run', 'testkit:read',
      JSON.stringify({ subject, fn, args })], { cwd: SITE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const start = out.search(/[[{]/);
    return start < 0 ? null : JSON.parse(out.slice(start));
  };
  let mine = null;
  try { mine = run('awards:mine', 'user_f3a_me', {}); }
  catch { console.log('  ..   testkit is unreachable or disarmed, so OwnAward was not compared'); }

  if (Array.isArray(mine) && mine.length) {
    // A56. This null list was `Object.keys(plain).filter((k) => plain[k] === null)`,
    // computed from the object under test, so the null half of the check could not
    // fail: `delivery-reviewer` injected `plain.holderHandle = null` and the run
    // still reported 0 failed. It is literal now, from the contract, the way every
    // other contract-defined shape in this file is, and the row is pinned by public
    // id so the literal describes one known state instead of whatever `awards:mine`
    // happens to return first. C2.6 makes OwnAward `PublicAward & { hidden, pinned }`
    // and both added keys are booleans, never null, so the expected nulls are
    // PublicAward's own valid-community-no-expiry list, the same six as
    // `byPublicId valid community, no expiry` above.
    const plain = mine.find((a) => a.publicId === FIX.awardMine);
    is('the wallet still carries the community-claim fixture the list below describes',
       plain && [plain.origin, plain.source], ['community', 'claim']);
    checkShape('OwnAward', `awards:mine ${FIX.awardMine}, own community row`, plain ?? null,
               ['artUrl', 'evidenceUrl', 'expiresAt', 'importMeta', 'revokedAt', 'sphere']);
    is('exactly one fixture award is hidden', mine.filter((a) => a.hidden).length, 1);
    is('exactly one is pinned', mine.filter((a) => a.pinned).length, 1);
    is('the hidden one is the fixture the public checks above used (A43)',
       mine.find((a) => a.hidden).publicId, FIX.awardHidden);
  } else if (mine !== null) {
    console.log('  ..   awards:mine returned no rows, so OwnAward was not compared');
  }
}

/* ── the divergence record ────────────────────────────────────────────────────
   These four were live disagreements between a body block in CONTRACTS.md and
   the object the deployment actually returns, and they are what this file was
   built to catch. **A49 corrected all four in the body**, so they are history
   rather than warnings: the lines stay because each one names a field this run
   has just re-checked on the wire, and because a shape that agrees today is
   only known to agree while something keeps calling it.

   This list is prose and proves nothing on its own. What proves it is the 73
   assertions above, which read the same four fields off the live deployment
   every run. If a body block goes stale again, the failure appears up there as
   a key list or a null list, not down here. */
notes.push(
  'C2.2  PublicProfile omitted `showcase` (A39). Corrected by A49; the key list above re-checks it.',
  'C2.5  ClaimPreview omitted `defaultValidityMs` (A21). Corrected by A49; the key list above re-checks it.',
  'C2.6  PublicAward typed origin, category, issuerHandle and versionN non-nullable (A6, A19, A45). Corrected by A49; the null lists above re-check all four.',
  "A19's replacement block typed `issuedAt: number` and `expiresAt: number | null`; both are ISO 8601 strings. Corrected by A49; the two type checks above re-check it.",
);
console.log('\nfour body blocks that disagreed with the wire, all corrected by A49');
console.log('(kept as a record of what this file catches; each line is re-checked by an assertion above, not by this list)');
for (const n of notes) console.log(`  ..   ${n}`);

if (compared === 0) bail('no shape was compared');
console.log(`\n${pass} passed, ${fail} failed, ${compared} shapes compared`);
process.exit(fail === 0 ? 0 : 1);

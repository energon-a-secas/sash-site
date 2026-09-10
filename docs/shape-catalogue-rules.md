# Shape catalogue rules

Read this before drawing a shape, adding one, or renaming one.

The badge silhouettes this site draws come from the Insignia Kit, vendored here
as `js/insignia/shapes.js` with a provenance record per shape in
`js/insignia/data/shape-catalogue.json`. The canonical source of both is
`packages/neorgon-ui/insignia/` in the Neorgon monorepo; **never edit the
vendored copy**, edit the canonical one and re-run `sync-insignia.sh`.

The rules below are a legal-risk control, not a style guide. They exist so that
the question "was anything taken" never has to be argued: nothing was, and the
repository can show it. They cost one string each and they remove the argument.

## Why a naming rule exists at all

A simple silhouette drawn from scratch is outside copyright. The US Copyright
Office's own practice manual excludes common geometric shapes and familiar
symbols by name, and lists the spade, club, heart, diamond and star among them.
Names are the opposite: a name is not copyrightable at all, which means a name
is protected, if it is protected, by **trademark**. Trademark is where the whole
risk sits, and it is the cheap one to design around.

The specific exposure is not the word. An ordinary English word for a thing is
owned by nobody. The exposure is **the pairing of that word with "badge" inside
a badge product**, because that pairing is the evidence anyone would point at to
show an intent to evoke somebody else's badge. So the rule is narrow: where a
geometric noun happens to also name a badge in a published entertainment
franchise, pick a different geometric noun.

## DO

1. **Draw every path from scratch, from a written description**, with no
   reference image of any kind open. Independent creation is a complete answer
   to a copyright claim and it is the only one that comes free.
2. **Record provenance per shape** in `data/shape-catalogue.json`: `author`,
   `createdAt`, and a one-line `description` of what was drawn. Write the
   description as a geometric statement someone could redraw the path from,
   with coordinates, not as a label and not as what the silhouette resembles.
   That file is the answer to "how did this shape come to exist" and it is the
   only answer there will be.
3. **Name every shape by its geometry**, using the common English noun for the
   thing depicted.
4. **Where the geometric noun collides with a franchise badge name, pick a
   different geometric noun.** Apply the test to every candidate before the
   name goes anywhere. Two names have already failed it: see "Names already
   ruled out" below.
5. **Keep the catalogue one flat, alphabetical list.** Fifteen shapes in one
   picker, sorted by name, with the organic silhouettes mixed in among the
   conventional ones. No grouping, no ordering, no tiers.
6. **Use the fleet's own token palette** for shape colours, so the colour
   assignment is demonstrably ours and demonstrably arbitrary.
7. **Lead with the fleet's own mark.** The Energon hexagon is the fleet's shared
   shape and it is the default shape for a new badge. A catalogue whose default
   is our own mark reads very differently from one whose default is not.
8. **Keep this file next to the shapes**, so the next person to add one reads it
   before drawing.

## DO NOT

1. **Do not trace, auto-trace, image-trace, or draw on top of** a screenshot,
   sprite, render, wiki image or fan reproduction. Not as a starting point, and
   not "and then I changed it".
2. **Do not use a franchise's proper nouns anywhere.** Not the franchise name,
   not creature names, not character names, not place names, not badge names,
   not league names. **"Anywhere" means: shipped UI strings, SVG `id` and
   `class` attributes, file names, CSS custom property names, JS variable names,
   JSON keys and values, code comments, commit messages, branch names, `alt`
   text, `title` attributes, `<meta>` descriptions, image text, this README's
   siblings, and the hub card description.** It is not a rule about what a
   visitor sees. It is a rule about what is in the repository.
3. **Do not write "inspired by" plus a franchise name in any public text.** A
   public statement of that shape is an admission of intent to evoke and it buys
   nothing. Internal design rationale belongs in the monorepo's delivery notes,
   which are not published.
4. **Do not use the words "gym badge" in shipped strings.** Say `badge`,
   `insignia`, `achievement badge` or `award`.
5. **Do not name a preset, a theme, a template pack or a colour ramp** after a
   franchise's league, its badge order, or any of its regions.
6. **Do not ship the organic shapes as a numbered or ordered set**, as a
   "collection", as a progression, or with a completion meter. This is the one
   real exposure in the catalogue and it is about selection and arrangement
   rather than about any single shape. One flat alphabetical picker closes it.
7. **Do not reproduce anyone else's colour assignments shape by shape.** Assign
   colour to the mood of the design, never to the silhouette. The shipped
   presets do this deliberately: the flame is cold violet and cyan, the leaf is
   slate blue, and the star is pink.
8. **Do not use a franchise's typeface or a clone of it.** The font list is the
   six Google Fonts roles the kit already names, and it stays that way.
9. **Do not accept a user-uploaded image into a shared template** without
   review. The terms make the uploader responsible, and a published community
   template is moderatable and revocable. A clean catalogue does not help if the
   community feature becomes an unmoderated sprite host.

## Names already ruled out

Three candidate names were rejected while the catalogue was being built, and
`zigzag` shipped in place of the two that mattered. Two of the three are in the
reserved list the detector reads, so a re-proposal fails a test rather than a
review, and neither word is repeated on this page for the reason given under
"The detector, and its limits" below.

The one worth naming here is `spark`, because it is not a franchise collision at
all and the detector will never catch it: the fleet already uses "accent spark"
for a favicon element, so the word is taken internally. Names collide inside a
codebase as well as outside it, and only one of those two failures is automated.

The instructive part of the other two is the sequence. The first bad name
survived the initial shape list and one review before anybody ran the test
against it. The second was the **replacement recommended by the review that
wrote the test**, and it failed the same test. Neither was caught by care. Both
were caught by running the check.

## The detector, and its limits

`packages/neorgon-ui/tests/insignia.test.mjs` in the monorepo holds a frozen
list of reserved names and asserts that no shape id and no glyph id appears in
it. A shape added later that collides fails the fleet's smoke run rather than a
review.

That test is **the only mechanical protection any of this gets**. Every other
rule on this page is prose, and prose is enforced by whoever reads it. Two
things follow. Run the test before proposing a name, because it is faster and
more reliable than remembering. And do not treat a green test as the whole
check: it knows about ids, and it does not know about a preset name, a commit
message or an `alt` attribute.

The reserved list lives in that test file rather than here on purpose. A
published document listing several dozen franchise badge names, under a heading
explaining that they are franchise badge names, is the "inspired by" admission
that DO NOT #3 exists to avoid.

## Adding a shape

1. Write the geometric description first, in words, before touching a path.
2. Check the name against the detector.
3. Draw the path on the 512 by 512 field with a 20 unit margin, closed with `Z`.
4. Add the id to `schema.js` and to the server's enum list, which is duplicated
   on purpose and kept in step by its own test.
5. Add the entry to `data/shape-catalogue.json` with `author`, `createdAt` and
   the description you wrote in step 1.
6. Re-run the sync script, then the kit's tests.

A shape id is stored inside every saved design and inside every issued award, so
adding one is cheap and renaming one is a migration. Get the name right first.

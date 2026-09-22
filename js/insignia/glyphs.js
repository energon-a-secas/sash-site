/**
 * Insignia Kit: the centre glyph registry (C1.5).
 *
 * A glyph is line art drawn inside a badge. A shape is the badge outline. They
 * are separate concerns and separate files: the outlines in shapes.js are drawn
 * here from written descriptions and are not Lucide, and are not any other
 * third-party set.
 *
 * Icons: Lucide (https://lucide.dev), ISC License. Same origin as
 * projects/cardforge-site/js/icons.js, whose registry these entries were taken
 * from unchanged, except the two round-2 deviations noted at `build()` below
 * (the `nofill` flag and the palette dots). The licence is reproduced below.
 *
 *   ISC License
 *
 *   Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as
 *   part of Feather (MIT). All other copyright (c) for Lucide are held by
 *   Lucide Contributors 2022.
 *
 *   Permission to use, copy, modify, and/or distribute this software for any
 *   purpose with or without fee is hereby granted, provided that the above
 *   copyright notice and this permission notice appear in all copies.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 *   WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 *   MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 *   SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 *   WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 *   OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 *   CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * Each entry is a list of primitive descriptors rather than a markup string, so
 * the renderer builds real nodes with `createElementNS` and never parses HTML.
 */
import { svgEl } from './patterns.js';

/** Every glyph is drawn on Lucide's 24 by 24 field with a 2 unit stroke. */
export const GLYPH_FIELD = 24;

export const GLYPHS = {
  "book-open": [{ t: "path", d: "M12 5v16" }, { t: "path", d: "M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" }],
  "bot": [{ t: "path", d: "M12 8V4H8", nofill: true }, { t: "rect", height: "12", rx: "2", width: "16", x: "4", y: "8" }, { t: "path", d: "M2 14h2" }, { t: "path", d: "M20 14h2" }, { t: "path", d: "M15 13v2" }, { t: "path", d: "M9 13v2" }],
  "cat": [{ t: "path", d: "M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z" }, { t: "path", d: "M8 14v.5" }, { t: "path", d: "M16 14v.5" }, { t: "path", d: "M11.25 16.25h1.5L12 17l-.75-.75Z" }],
  "coffee": [{ t: "path", d: "M10 2v2" }, { t: "path", d: "M14 2v2" }, { t: "path", d: "M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" }, { t: "path", d: "M6 2v2" }],
  "compass": [{ t: "circle", cx: "12", cy: "12", r: "10" }, { t: "path", d: "m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" }],
  "crown": [{ t: "path", d: "M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" }, { t: "path", d: "M5 21h14" }],
  "dice-5": [{ t: "rect", height: "18", rx: "2", ry: "2", width: "18", x: "3", y: "3" }, { t: "path", d: "M16 8h.01" }, { t: "path", d: "M8 8h.01" }, { t: "path", d: "M8 16h.01" }, { t: "path", d: "M16 16h.01" }, { t: "path", d: "M12 12h.01" }],
  "eye": [{ t: "path", d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" }, { t: "circle", cx: "12", cy: "12", r: "3" }],
  "flame": [{ t: "path", d: "M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" }],
  "gamepad-2": [{ t: "line", x1: "6", y1: "11", x2: "10", y2: "11" }, { t: "line", x1: "8", y1: "9", x2: "8", y2: "13" }, { t: "line", x1: "15", y1: "12", x2: "15.01", y2: "12" }, { t: "line", x1: "18", y1: "10", x2: "18.01", y2: "10" }, { t: "path", d: "M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" }],
  "gem": [{ t: "path", d: "M10.5 3 8 9l4 13 4-13-2.5-6" }, { t: "path", d: "M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z" }, { t: "path", d: "M2 9h20" }],
  "hammer": [{ t: "path", d: "m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9" }, { t: "path", d: "m18 15 4-4" }, { t: "path", d: "m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" }],
  "handshake": [{ t: "path", d: "m11 17 2 2a1 1 0 1 0 3-3" }, { t: "path", d: "m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4", nofill: true }, { t: "path", d: "m21 3 1 11h-2" }, { t: "path", d: "M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3", nofill: true }, { t: "path", d: "M3 4h8" }],
  "heart": [{ t: "path", d: "M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" }],
  "hourglass": [{ t: "path", d: "M5 22h14" }, { t: "path", d: "M5 2h14" }, { t: "path", d: "M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" }, { t: "path", d: "M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" }],
  "lightbulb": [{ t: "path", d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" }, { t: "path", d: "M9 18h6" }, { t: "path", d: "M10 22h4" }],
  "lock": [{ t: "rect", height: "11", rx: "2", ry: "2", width: "18", x: "3", y: "11" }, { t: "path", d: "M7 11V7a5 5 0 0 1 10 0v4" }],
  "map": [{ t: "path", d: "M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" }, { t: "path", d: "M15 5.764v15" }, { t: "path", d: "M9 3.236v15" }],
  "medal": [{ t: "path", d: "M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" }, { t: "path", d: "M11 12 5.12 2.2" }, { t: "path", d: "m13 12 5.88-9.8" }, { t: "path", d: "M8 7h8" }, { t: "circle", cx: "12", cy: "17", r: "5" }, { t: "path", d: "M12 18v-2h-.5" }],
  "microscope": [{ t: "path", d: "M6 18h8" }, { t: "path", d: "M3 22h18" }, { t: "path", d: "M14 22a7 7 0 1 0 0-14h-1" }, { t: "path", d: "M9 14h2" }, { t: "path", d: "M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" }, { t: "path", d: "M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" }],
  "music": [{ t: "path", d: "M9 18V5l12-2v13" }, { t: "circle", cx: "6", cy: "18", r: "3" }, { t: "circle", cx: "18", cy: "16", r: "3" }],
  "package": [{ t: "path", d: "M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" }, { t: "path", d: "M12 22V12" }, { t: "polyline", points: "3.29 7 12 12 20.71 7" }, { t: "path", d: "m7.5 4.27 9 5.15" }],
  "palette": [{ t: "path", d: "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" }, { t: "circle", cx: "13.5", cy: "6.5", fill: "currentColor", r: "1.5", stroke: "none" }, { t: "circle", cx: "17.5", cy: "10.5", fill: "currentColor", r: "1.5", stroke: "none" }, { t: "circle", cx: "6.5", cy: "12.5", fill: "currentColor", r: "1.5", stroke: "none" }, { t: "circle", cx: "8.5", cy: "7.5", fill: "currentColor", r: "1.5", stroke: "none" }],
  "party-popper": [{ t: "path", d: "M5.8 11.3 2 22l10.7-3.79" }, { t: "path", d: "M4 3h.01" }, { t: "path", d: "M22 8h.01" }, { t: "path", d: "M15 2h.01" }, { t: "path", d: "M22 20h.01" }, { t: "path", d: "m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10" }, { t: "path", d: "m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17" }, { t: "path", d: "m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7" }, { t: "path", d: "M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z" }],
  "puzzle": [{ t: "path", d: "M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z" }],
  "rocket": [{ t: "path", d: "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" }, { t: "path", d: "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09" }, { t: "path", d: "M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z" }, { t: "path", d: "M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05" }],
  "ruler": [{ t: "path", d: "M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" }, { t: "path", d: "m14.5 12.5 2-2" }, { t: "path", d: "m11.5 9.5 2-2" }, { t: "path", d: "m8.5 6.5 2-2" }, { t: "path", d: "m17.5 15.5 2-2" }],
  "scale": [{ t: "path", d: "M12 3v18" }, { t: "path", d: "m19 8 3 8a5 5 0 0 1-6 0zV7" }, { t: "path", d: "M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" }, { t: "path", d: "m5 8 3 8a5 5 0 0 1-6 0zV7" }, { t: "path", d: "M7 21h10" }],
  "scroll": [{ t: "path", d: "M19 17V5a2 2 0 0 0-2-2H4", nofill: true }, { t: "path", d: "M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" }],
  "shield": [{ t: "path", d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" }],
  "skull": [{ t: "path", d: "m12.5 17-.5-1-.5 1h1z" }, { t: "path", d: "M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z" }, { t: "circle", cx: "15", cy: "12", r: "1" }, { t: "circle", cx: "9", cy: "12", r: "1" }],
  "smile": [{ t: "circle", cx: "12", cy: "12", r: "10" }, { t: "path", d: "M8 14s1.5 2 4 2 4-2 4-2" }, { t: "line", x1: "9", y1: "9", x2: "9.01", y2: "9" }, { t: "line", x1: "15", y1: "9", x2: "15.01", y2: "9" }],
  "snowflake": [{ t: "path", d: "m10 20-1.25-2.5L6 18", nofill: true }, { t: "path", d: "M10 4 8.75 6.5 6 6", nofill: true }, { t: "path", d: "m14 20 1.25-2.5L18 18", nofill: true }, { t: "path", d: "m14 4 1.25 2.5L18 6", nofill: true }, { t: "path", d: "m17 21-3-6h-4", nofill: true }, { t: "path", d: "m17 3-3 6 1.5 3", nofill: true }, { t: "path", d: "M2 12h6.5L10 9", nofill: true }, { t: "path", d: "m20 10-1.5 2 1.5 2", nofill: true }, { t: "path", d: "M22 12h-6.5L14 15", nofill: true }, { t: "path", d: "m4 10 1.5 2L4 14", nofill: true }, { t: "path", d: "m7 21 3-6-1.5-3", nofill: true }, { t: "path", d: "m7 3 3 6h4", nofill: true }],
  "sparkles": [{ t: "path", d: "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" }, { t: "path", d: "M20 2v4" }, { t: "path", d: "M22 4h-4" }, { t: "circle", cx: "4", cy: "20", r: "2" }],
  "sprout": [{ t: "path", d: "M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3" }, { t: "path", d: "M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4" }, { t: "path", d: "M5 21h14" }],
  "star": [{ t: "path", d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" }],
  "swords": [{ t: "polyline", points: "14.5 17.5 3 6 3 3 6 3 17.5 14.5" }, { t: "line", x1: "13", y1: "19", x2: "19", y2: "13" }, { t: "line", x1: "16", y1: "16", x2: "20", y2: "20" }, { t: "line", x1: "19", y1: "21", x2: "21", y2: "19" }, { t: "polyline", points: "14.5 6.5 18 3 21 3 21 6 17.5 9.5" }, { t: "line", x1: "5", y1: "14", x2: "9", y2: "18" }, { t: "line", x1: "7", y1: "17", x2: "4", y2: "20" }, { t: "line", x1: "3", y1: "19", x2: "5", y2: "21" }],
  "target": [{ t: "circle", cx: "12", cy: "12", r: "10" }, { t: "circle", cx: "12", cy: "12", r: "6" }, { t: "circle", cx: "12", cy: "12", r: "2" }],
  "telescope": [{ t: "path", d: "m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44" }, { t: "path", d: "m13.56 11.747 4.332-.924" }, { t: "path", d: "m16 21-3.105-6.21" }, { t: "path", d: "M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z" }, { t: "path", d: "m6.158 8.633 1.114 4.456" }, { t: "path", d: "m8 21 3.105-6.21" }, { t: "circle", cx: "12", cy: "13", r: "2" }],
  "timer": [{ t: "line", x1: "10", y1: "2", x2: "14", y2: "2" }, { t: "line", x1: "12", y1: "14", x2: "15", y2: "11" }, { t: "circle", cx: "12", cy: "14", r: "8" }],
  "trending-up": [{ t: "path", d: "M16 7h6v6", nofill: true }, { t: "path", d: "m22 7-8.5 8.5-5-5L2 17", nofill: true }],
  "trophy": [{ t: "path", d: "M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2" }, { t: "path", d: "M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2" }, { t: "path", d: "M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3" }, { t: "path", d: "M4 22h16" }, { t: "path", d: "M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" }, { t: "path", d: "M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3" }],
  "umbrella": [{ t: "path", d: "M12 13v7a2 2 0 0 0 4 0", nofill: true }, { t: "path", d: "M12 2v2" }, { t: "path", d: "M20.992 13a1 1 0 0 0 .97-1.274 10.284 10.284 0 0 0-19.923 0A1 1 0 0 0 3 13z" }],
  "users": [{ t: "path", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }, { t: "path", d: "M16 3.128a4 4 0 0 1 0 7.744" }, { t: "path", d: "M22 21v-2a4 4 0 0 0-3-3.87" }, { t: "circle", cx: "9", cy: "7", r: "4" }],
  "wand-sparkles": [{ t: "path", d: "m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" }, { t: "path", d: "m14 7 3 3" }, { t: "path", d: "M5 6v4" }, { t: "path", d: "M19 14v4" }, { t: "path", d: "M10 2v2" }, { t: "path", d: "M7 8H3" }, { t: "path", d: "M21 16h-4" }, { t: "path", d: "M11 3H9" }],
  "wrench": [{ t: "path", d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" }],
  "zap": [{ t: "path", d: "M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" }],
};

/** Every glyph id, sorted. Feeds the centre-art picker. */
export const GLYPH_LIST = Object.keys(GLYPHS).sort();

/**
 * The attributes each primitive must carry to draw. Fourteen `line` parts in
 * four glyphs (gamepad-2, smile, swords, timer) once carried none: each drew a
 * zero-length line at 0,0, a stray dot with a round cap, and the glyph lost
 * its sticks, its eyes, its stem or its second blade. Repaired 2026-09-15 from
 * the cardforge origin; `glyphProblems` is the check that would have caught it.
 */
export const REQUIRED_ATTRS = Object.freeze({
  path: ['d'], line: ['x1', 'y1', 'x2', 'y2'], circle: ['cx', 'cy', 'r'],
  rect: ['x', 'y', 'width', 'height'], polyline: ['points'], polygon: ['points'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
});

/**
 * Every part in `registry` that cannot draw: an unknown primitive, or one
 * missing an attribute `REQUIRED_ATTRS` names. Empty when the registry is
 * whole, which is what the kit tests assert.
 */
export function glyphProblems(registry = GLYPHS) {
  const out = [];
  for (const [id, parts] of Object.entries(registry)) {
    parts.forEach((p, i) => {
      const need = REQUIRED_ATTRS[p.t];
      if (!need) { out.push(`${id}[${i}]: unknown primitive ${String(p.t)}`); return; }
      const missing = need.filter((a) => !(a in p) || p[a] === '' || p[a] === undefined);
      if (missing.length) out.push(`${id}[${i}]: ${p.t} without ${missing.join(' ')}`);
    });
  }
  return out;
}

// The palette glyph's four dots are `fill: "currentColor"` in Lucide, which is
// the page colour on a page and black inside an `<img>`, where an SVG has no
// page. Resolved here to the glyph colour, so the export draws the dots the
// preview shows. Nothing else in the registry names a colour. Lucide draws
// each dot as an r .5 circle under the 2 unit stroke; here they are r 1.5
// discs with `stroke: "none"`, the same 3 unit disc, because Chromium strokes
// a circle narrower than its stroke with a faint inner ring (round 2, K-fix).
//
// `nofill` is a registry-only flag: the part draws in the line copy and is
// skipped by `glyphFillNode`. It never reaches the DOM.
function build(parts, color) {
  return parts.map((p) => {
    const { t, nofill, ...attrs } = p;
    if (attrs.fill === 'currentColor') attrs.fill = color;
    return svgEl(t, attrs);
  });
}

/**
 * A `<g>` holding one glyph, drawn in Lucide's stroke style at its native
 * 24 by 24 size. The caller positions and scales it with a transform.
 * Returns null for an unknown id: an unknown glyph draws nothing rather than
 * substituting a different one. `strokeWidth` 2 is the line style; `bold`
 * passes 2.6.
 */
export function glyphNode(id, { color = '#ffffff', strokeWidth = 2 } = {}) {
  const parts = GLYPHS[id];
  if (!parts) return null;
  return svgEl('g', {
    fill: 'none',
    stroke: color,
    'stroke-width': String(strokeWidth),
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }, build(parts, color));
}

/**
 * The same primitives as a fill with no stroke: the tint the `duotone` centre
 * style lays under the line copy. A browser closes an open subpath to fill it,
 * so a closed Lucide outline becomes its own silhouette. An open stroke closes
 * on a chord instead and tints a region the glyph never drew (scroll's spine
 * became a triangle across the parchment, trending-up a wedge under the line,
 * each snowflake arm a grey triangle), so a part marked `nofill: true` in the
 * registry is left out of the tint and drawn by the line copy only. Null for
 * an unknown id.
 */
export function glyphFillNode(id, { color = '#ffffff', opacity = 0.22 } = {}) {
  const parts = GLYPHS[id];
  if (!parts) return null;
  return svgEl('g', { fill: color, 'fill-opacity': String(opacity), stroke: 'none' }, build(parts.filter((p) => !p.nofill), color));
}

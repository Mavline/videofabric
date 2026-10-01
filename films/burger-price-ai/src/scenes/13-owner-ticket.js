// 13 owner-ticket: The owner gets the ticket. T 22.5 to 24.0 (shot-local t 0 to 1.5, 36 frames), schematic.
// docs/storyboard.md, plan 13 with G2 and G8: the interior of 02 and 08 on the same pixels, the rich street
// in the window and nobody at it. The ticket the machine printed in 12 flutters in through the window on
// twos; the owner snaps it out of the air on ones (T 22.75) and holds it up beside his head to read
// RECOMMENDED: $6.89 (T 23.0); his head and shoulders sink. The phone rings and jumps on 16ths from T 23.5;
// on T 23.75 his head rolls back and turns to it. The ticket is advice: the next shot shows who types.
// Layers, back to front:
//   1 the rich street through the window: a cached light plate (fieldSky, washes, colored pencil)
//   2 the inside: a cached dense plate, the warm wall with the window cut out, its frame, the counter
//     (02's code with 02's seeds, so the wall is the same painting)
//   3 on the counter: the register, the phone
//   4 the ticket: props.ticket's slip with the words lettered at G8's sizes
//   5 the smear of the catch, on ones, behind the arm
//   6 the owner, three-quarter from behind (G2)
//   7 the caption, white over an ink pass, popping on over 3 frames from frame 0
(() => {
  'use strict';
  const ID = 'owner-ticket';
  const REF = 'owner-serves'; // 02 owns the interior: the wall and the counter are painted from its seeds
  const sd = (...k) => FILM.lib.hash(ID, ...k) & 0x7fffffff;
  const sdRef = (...k) => FILM.lib.hash(REF, ...k) & 0x7fffffff;

  // ---- G2 at its pixels (02's numbers) ----
  const WIN = { x0: 240, y0: 560, x1: 840, y1: 1100 }; // window opening
  const FRAME = 30; // the frame around it
  const TOP = { y0: 1100, y1: 1170 }; // counter top across the whole width; its inner side runs to the bottom edge
  const OWN = { x: 92.5, y: 1636, h: 1167 }; // art bible 8: head at (180, 650), head height 210
  const OS = OWN.h / 400; // one of the owner's design units in px
  const REG = [960, 1100]; // register x 860 to 1060 at w 200
  const PHONE = [770, 1100]; // phone x 700 to 840 at w 140
  const INNER = FILM.lib.mix(FILM.lib.pal.fence, FILM.lib.pal.trunk, 0.45); // the counter's inner side (02)
  const D = (p) => [(p[0] - OWN.x) / OS, (p[1] - OWN.y) / OS]; // a frame point in the owner's design units

  // ---- timing, shot-local frames: frame n is T 22.5 + n / 24 ----
  const CATCH = 6; // T 22.75: the hand snaps up, closes on the ticket, settles (ones: frames 6, 7, 8)
  const RING = 24; // T 23.5 (beat): the phone jumps 12 px on each 16th, frames 24, 27, 30, 33
  const LAST = 35;

  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

  // ---- layer 1: the rich street through the window ----
  // a background object as the street plate paints one: an opaque wash with brush marks, a pencil edge
  function wash(g, L, pts, color, seed) {
    L.softWash(g, pts, { color, solid: true, marks: 0.6, rim: 0.12, seed });
    L.pencil(g, pts, { closed: true, base: color, seed: seed + 1, width: 2 });
  }
  // a band of water along a polyline, w0 wide at the start and w1 at the end (as in 06 and 11)
  function waterBand(g, L, pts, w0, w1, seed) {
    const left = [], right = [];
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const w = L.lerp(w0, w1, i / (pts.length - 1)) / 2;
      left.push([p[0] - ((b[1] - a[1]) / d) * w, p[1] + ((b[0] - a[0]) / d) * w]);
      right.push([p[0] + ((b[1] - a[1]) / d) * w, p[1] - ((b[0] - a[0]) / d) * w]);
    });
    const poly = left.concat(right.reverse());
    L.softWash(g, poly, { color: L.pal.waterTop, alpha: 0.95, soft: 2, marks: 0.3, rim: 0, seed });
    L.pencil(g, poly, { closed: true, color: L.pal.waterDeep, width: 2, seed: seed + 1 });
  }
  function drop(g, L, x, y, r) {
    g.fillStyle = L.pal.waterTop;
    g.strokeStyle = L.pal.waterDeep;
    g.lineWidth = 1.8;
    g.beginPath();
    g.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  const halfEll = (cx, cy, rx, ry, n = 24) => Array.from({ length: n + 1 }, (_, i) => [cx + rx * Math.cos((i / n) * Math.PI), cy + ry * Math.sin((i / n) * Math.PI)]);

  // the rich house on the right, two of its portico columns in the opening (x 675 and 762; the third
  // hides under the jamb); on the left a fountain's spray over clipped bushes. The ground is under the sill.
  const HOUSE = { x: 805, y: 1150, h: 480 };
  const FX = 380, BOWL_Y = 1040, BOWL_R = 40, JET = 190, JET_S = 80;
  function street(ctx, L, P, R) {
    L.plate(ctx, `${ID}|street|1`, (g) => {
      g.translate(-WIN.x0, -WIN.y0);
      g.fillStyle = P.fieldSky;
      g.fillRect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);
      L.softWash(g, L.blobPts(330, 620, 80, 21, sd(1), 0.2), { color: P.paper, alpha: 0.85, soft: 12, seed: sd(2) });
      L.softWash(g, L.blobPts(600, 598, 58, 17, sd(3), 0.2), { color: P.paper, alpha: 0.85, soft: 12, seed: sd(4) });
      L.softWash(g, [[200, 952], [380, 930], [600, 948], [880, 924], [880, 1040], [200, 1040]], { color: P.hillsFar, soft: 8, seed: sd(5) });
      L.softWash(g, L.densify([[200, 1030], [880, 1022], [880, 1130], [200, 1130]], 24), { color: P.grass, alpha: 0.62, soft: 6, marks: 0.7, seed: sd(6) });
      R.house(g, HOUSE.x, HOUSE.y, { h: HOUSE.h, kind: 'rich', gate: false, fountain: false });
      // the fountain's upper bowl on its pedestal; the basin is below the sill
      wash(g, L, L.rectPts(FX - 11, BOWL_Y + 4, 22, 120, 4), P.stone, sd(10));
      wash(g, L, halfEll(FX, BOWL_Y, BOWL_R, 17, 20), P.stone, sd(11));
      wash(g, L, L.ellipsePts(FX, BOWL_Y, BOWL_R, 8, 40), L.mix(P.stone, P.paper, 0.45), sd(12));
      L.softWash(g, L.ellipsePts(FX, BOWL_Y + 1, BOWL_R - 8, 4, 32), { color: P.waterTop, solid: true, marks: 0, rim: 0, seed: sd(13) });
      // the spray: a centre jet with a crown spilling both ways, two arcs out of the bowl, drops
      const top = BOWL_Y - 4 - JET;
      waterBand(g, L, Array.from({ length: 9 }, (_, i) => [FX, L.lerp(BOWL_Y - 2, top, i / 8)]), 15, 9, sd(14));
      for (const sx of [-1, 1]) {
        const crown = Array.from({ length: 9 }, (_, i) => {
          const u = i / 8;
          return [FX + sx * (7 + 0.3 * JET * u), top + 4 + 0.42 * JET * u * u - 0.05 * JET * u * (1 - u)];
        });
        waterBand(g, L, crown, 9, 4, sd(15, sx));
        [[0.36, 0.5, 5], [0.4, 0.66, 4], [0.43, 0.82, 3.5]].forEach(([ux, uy, r]) => drop(g, L, FX + sx * ux * JET, top + uy * JET, r));
        const arc = Array.from({ length: 13 }, (_, i) => {
          const u = i / 12;
          return [L.lerp(FX + sx * 22, FX + sx * 100, u), BOWL_Y - 2 - 4 * JET_S * u * (1 - u) + 60 * u * u];
        });
        waterBand(g, L, arc, 10, 5, sd(16, sx));
      }
      drop(g, L, FX - 5, top - 12, 4.5);
      drop(g, L, FX + 8, top - 21, 3.5);
      // round clipped bushes in front, a shade deeper than the lawn
      [[FX - 118, 1086, 54, 44], [FX + 118, 1090, 50, 40], [560, 1094, 44, 34], [FX, 1100, 40, 30]].forEach(([x, y, rx, ry], i) => {
        const pts = L.blobPts(x, y, rx, ry, sd(20, i), 0.07);
        L.softWash(g, pts, { color: P.grass, alpha: 0.96, soft: 4, marks: 0.8, angle: -0.6, seed: sd(21, i) });
        L.pencil(g, pts, { closed: true, base: P.grass, seed: sd(22, i), width: 2 });
      });
    }, { x: WIN.x0, y: WIN.y0, w: WIN.x1 - WIN.x0, h: WIN.y1 - WIN.y0 });
  }

  // ---- layer 2: the inside, a dense plate with the window cut out (02's inside(), 02's seeds) ----
  function inside(ctx, L, P) {
    L.plate(ctx, `${ID}|inside|1`, (g) => {
      const fx0 = WIN.x0 - FRAME, fy0 = WIN.y0 - FRAME, fx1 = WIN.x1 + FRAME;
      L.dense(g, [rect(0, 0, 1080, TOP.y0), rect(fx0, fy0, fx1, TOP.y0)], { bounds: [0, 0, 1080, TOP.y0], base: P.wallWarm, dir: 'vertical', seed: sdRef(10) });
      L.dense(g, null, { bounds: [fx0, fy0, fx1 - fx0, FRAME], base: P.shadowWarm, dir: 'horizontal', seed: sdRef(11) });
      L.dense(g, null, { bounds: [fx0, WIN.y0, FRAME, TOP.y0 - WIN.y0], base: P.shadowWarm, dir: 'vertical', seed: sdRef(12) });
      L.dense(g, null, { bounds: [WIN.x1, WIN.y0, FRAME, TOP.y0 - WIN.y0], base: P.shadowWarm, dir: 'vertical', seed: sdRef(13) });
      L.ragged(g, L.densify([[fx0, TOP.y0], [fx0, fy0], [fx1, fy0], [fx1, TOP.y0]], 20, false), { base: P.wallWarm, width: 5, seed: sdRef(14) });
      L.ragged(g, L.densify([[WIN.x0, TOP.y0], [WIN.x0, WIN.y0], [WIN.x1, WIN.y0], [WIN.x1, TOP.y0]], 20, false), { base: P.shadowWarm, width: 4, seed: sdRef(15) });
      L.dense(g, null, { bounds: [0, TOP.y0, 1080, TOP.y1 - TOP.y0], base: P.fence, dir: 'horizontal', seed: sdRef(16) });
      L.dense(g, null, { bounds: [0, TOP.y1, 1080, 1920 - TOP.y1], base: INNER, dir: 'vertical', seed: sdRef(17) });
      L.ragged(g, [[0, TOP.y0], [1080, TOP.y0 - 1]], { base: P.fence, width: 4, seed: sdRef(18) });
      L.ragged(g, [[0, TOP.y1], [1080, TOP.y1 + 1]], { base: P.fence, width: 5, seed: sdRef(19) });
      g.save();
      g.globalCompositeOperation = 'destination-out';
      g.fillRect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);
      g.restore();
    });
  }

  // ---- layer 4: the ticket ----
  // props.ticket's slip (perforated top, torn bottom) with the words lettered in ink, as on the machine's
  // strip in 12: RECOMMENDED: cap 26 and $6.89 cap 72, each shrunk only if wider than FIT px. G8's box for
  // them (x 300 to 540) held these caps at only about 20 and 58 in the note face, so the lead widened it to
  // x 300 to 640 (2026-10-01): held up, the slip covers about x 303 to 633, y 588 to 812, clear of his head.
  // Drawn about its centre, turned by rot, at size k (it grows as it comes in through the window toward
  // the camera); the contour stays LINE at every size.
  const TW = 330, TH = 225; // the slip in his hand, px
  const BASE1 = 68, BASE2 = 166; // the two baselines below the slip's top edge, px
  const FIT = 300; // the widest a line may be: held at x 468, the words stay inside x 318 to 618
  function ticket(ctx, L, cx, cy, rot, k) {
    const P = L.pal;
    const fit = (str, size, seed, tracking) => {
      const o = { size, face: 'note', align: 'center', color: P.ink, jitter: 0.5, seed, tracking };
      const w = L.letters(ctx, str, 0, 0, Object.assign({ measure: true }, o)).w;
      if (w > FIT) o.size *= FIT / w;
      o.size *= k;
      return o;
    };
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    L.props.ticket(ctx, 0, (-TH / 2) * k, { w: TW * k, h: TH * k, lines: [], seed: 3 });
    L.letters(ctx, 'RECOMMENDED:', 0, (BASE1 - TH / 2) * k, fit('RECOMMENDED:', 26 / 0.71, sd('words', 1)));
    L.letters(ctx, '$6.89', 0, (BASE2 - TH / 2) * k, fit('$6.89', 72 / 0.72, sd('words', 2), 0));
    ctx.restore();
  }

  // ---- layer 6: the owner, moved as 02 moves him: lean toward the window (radians), sag 0..1 ----
  const O = { hip: [0, -194], neck: [12, -310], head: [30, -338] }; // rigOwner's defaults (design units)
  function ownerRig(L, lean, sag, tilt) {
    const c = Math.cos(lean), s = Math.sin(lean);
    const d = L.ease.outCubic(L.clamp(sag)) * 16; // the 'sigh' pose's drop
    const turn = (p, k) => {
      const x = p[0] - O.hip[0], y = p[1] - O.hip[1];
      return [O.hip[0] + x * c - y * s, O.hip[1] + x * s + y * c + d * k];
    };
    return { neck: turn(O.neck, 1), head: turn(O.head, 1.1), tilt };
  }
  // key drawings: frame -> owner pose, his working wrist (frame px), lean, sag, head tilt (+ forward and
  // down), and the ticket [cx, cy, rot, size]. A frame holds the last key at or before it: the snap of
  // the catch (6, 7, 8) is on ones, everything else on twos.
  const READ = (tilt, sag, lean = 0.02) => ({ pose: 'read', wrist: [419, 826], lean, sag, tilt, tk: [468, 700, -0.03, 1] });
  const KEYS = {
    0: { pose: 'push', wrist: [396, 1080], lean: 0, sag: 0.35, tilt: 0.22, tk: [805, 585, -0.45, 0.62] }, // bored at the counter
    2: { pose: 'push', wrist: [396, 1080], lean: 0, sag: 0.2, tilt: -0.02, tk: [745, 622, 0.3, 0.75] }, // he looks up at it
    4: { pose: 'push', wrist: [352, 1088], lean: -0.04, sag: 0.45, tilt: -0.12, tk: [790, 598, -0.2, 0.88] }, // anticipation: he dips
    6: { pose: 'catch', k: 0.2, wrist: [700, 738], lean: 0.12, sag: 0, tilt: -0.2, tk: [778, 622, 0.1, 1] }, // the snap: arm stretched, hand open
    7: { pose: 'catch', k: 0.8, wrist: [726, 723], lean: 0.15, sag: 0, tilt: -0.16, tk: [760, 620, 0.06, 1] }, // the fist closes on its edge
    8: { pose: 'catch', k: 0.8, wrist: [722, 711], lean: 0.16, sag: 0, tilt: -0.14, tk: [752, 608, 0.02, 1] }, // overshoot
    10: { pose: 'read', wrist: [585, 767], lean: 0.08, sag: 0, tilt: 0, tk: [640, 650, -0.02, 1] }, // he brings it to his face
    12: READ(0.08, 0.05), // T 23.0: he reads
    14: READ(0.14, 0.18), // and his head and shoulders sink
    16: READ(0.2, 0.3),
    24: READ(0.04, 0.1), // T 23.5: the ring, he flinches
    26: READ(0.2, 0.3),
    30: READ(-0.14, 0.26, -0.03), // T 23.75: the eyes roll, the head tips back
    32: READ(0.3, 0.32, -0.06), // and turns down to the phone
    34: READ(0.27, 0.3, -0.05), // settle; hold to the cut
  };
  function keyAt(f) {
    let k = f;
    while (!KEYS[k]) k--;
    return KEYS[k];
  }

  // ---- layer 7: the caption (G8) ----
  // McDonald's: / "a tool, / not a mandate": white handwriting on the wall (art bible 9.2), left edge x 80,
  // cap height 56. G8 gives two lines (baselines 300 and 380), but in the note face the quote is 972 px wide
  // at cap 56, so the lead split it into three lines on baselines 300, 380 and 460 (2026-10-01): the widest
  // is about 610 px, all lines shrink together only if one overflows x 80 to 800. Two passes as in 14: ink
  // with an ink contour 5.5 wide, then white, so the letters part from the patchy wall. The block pops with
  // outBack over 3 frames on ones from frame 0, growing from its left edge.
  const CAPTION = [["McDonald's:", 300], ['"a tool,', 380], ['not a mandate"', 460]];
  function caption(ctx, L, f) {
    const P = L.pal;
    const base = { size: 56 / 0.71, face: 'note' };
    const w = Math.max(...CAPTION.map(([s, y], i) => L.letters(ctx, s, 80, y, Object.assign({ seed: sd('cap', i), measure: true }, base)).w));
    if (w > 720) base.size *= 720 / w;
    const k = f < 3 ? L.ease.outBack((f + 1) / 3) : 1;
    ctx.save();
    ctx.translate(80, 352);
    ctx.scale(k, k);
    ctx.translate(-80, -352);
    for (const pass of [{ color: P.ink, outline: P.ink, outlineWidth: 5.5 }, { color: P.white }]) {
      CAPTION.forEach(([s, y], i) => L.letters(ctx, s, 80, y, Object.assign({ seed: sd('cap', i) }, base, pass)));
    }
    ctx.restore();
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal, C = L.cast, R = L.props;
      const t = L.clamp(tIn, 0, info.dur);
      const f = Math.min(LAST, Math.floor(t * 24 + 1e-6));
      const key = keyAt(f);

      // 1 the street, 2 the inside
      street(ctx, L, P, R);
      inside(ctx, L, P);

      // 3 on the counter: the register; the phone rings from T 23.5, jumping 12 px on each 16th (ones)
      R.register(ctx, REG[0], REG[1], { w: 200 });
      const ring = f >= RING;
      const jump = ring ? [12, 5, 0][(f - RING) % 3] : 0;
      R.phone(ctx, PHONE[0], PHONE[1] - jump, { w: 140, ring, t });

      // 4 the ticket
      ticket(ctx, L, ...key.tk);

      // 5 the smear of the snap, along the hand's path (2 frames)
      if (f === CATCH) L.smear(ctx, [[420, 1015], [560, 858], [690, 750]], { colors: [P.skin, P.pink], width: 40, seed: sd('smear', 1) });
      if (f === CATCH + 1) L.smear(ctx, [[600, 800], [680, 745], [720, 726]], { colors: [P.skin], width: 34, seed: sd('smear', 2) });

      // 6 the owner from behind: his right hand catches and holds; the left hangs
      const rig = Object.assign(ownerRig(L, key.lean, key.sag, key.tilt), { handN: D(key.wrist) });
      if (key.pose === 'read') Object.assign(rig, { handF: [-6, -170], elbowF: [-0.4, 0.3] });
      C.owner(ctx, OWN.x, OWN.y, { h: OWN.h, view: 'back', pose: key.pose, k: key.k, ground: INNER, rig });

      // 7 the caption
      caption(ctx, L, f);
    },
  });
})();

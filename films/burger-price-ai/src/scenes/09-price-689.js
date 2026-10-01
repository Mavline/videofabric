// 09 price-689: $6.89. T 16.0 to 18.0 (shot t 0 to 2.0, frames 0 to 47), street plate (illustrated).
// Hard cut in on the bar 9 downbeat, the film's midpoint; the shot fades itself to black at its end and
// 10 comes up from black.
//
// G5 and G4 on the same pixels as 03 (art bible 8): g5Hero, holdAt, HERO_OPEN, g4Tag and G4_SLOTS are
// copied verbatim from 03-first-bite.js, and so are the shared pieces of 03's street (its horizon,
// pavement and the booth's window frame, with 03's seeds), so only the neighborhood and the price
// change at the cut.
//
// Layers, back to front:
//   1 the still street plate, painted once (lib.plate): the fieldSky light field, 03's far hills, a stone
//     column carrying a fountain bowl and its spray, a clipped hedge where 03 has its picket fence, 03's
//     pavement and the booth's window frame at the right edge. Washes and colored pencil, no ink.
//   2 the $6.89 tag (G4), settling from 4 degrees to 0 about (700, 300) on twos
//   3 the hero (G5): 03's opening bite pose, eyes on the tag, frozen mid-bite (at the open-mouth stage lib
//     draws the burger behind his face); the take, the dropped jaw, the trembling grip
//   4 tremble strokes around the burger (drawn effect, on ones)
//   5 the red hand-scrawled +21% and its underline (G8 caption slot), and above it the source line
//     Reuters, Sept 29, 2026 in ink (art bible 10.15: a price on screen carries its source)
//   6 the dip to black (art bible 7.5: never solid on the checked frames, 0.92 there)
//
// Beats (global T, shot t, shot frame). The reaction follows art bible 7.2: a hold, a burst of the eyes on
// stalks for 4 frames on ones, the return, then the hold on the dropped jaw.
//   T 16.0    t 0      f 0   frame 0: frozen mid-bite, eyes up on the tag; the tag swings 4, -2, 1 degrees on twos
//   T 16.125  t 0.125  f 3   the take on ones: the eyes shoot out on stalks toward the tag (0.6, 1.24, 1.15, 1.15)
//                             and the cap jumps off his hair (0.16, 0.38, 0.32, 0.32), both landing with the return
//   T 16.25   t 0.25   f 6   the tag hangs still; +21% scrawls on over 3 frames on ones: "+2", "+21", "+21%"
//   T 16.292  t 0.292  f 7   the eyes snap back and the cap drops (one in-between), home on f 8
//   T 16.375  t 0.375  f 9   the underline, and the source line with it (no pop); both held to the dip
//   T 16.5    t 0.5    f 12  the jaw drops, the mouth hangs open over the burger; held
//   T 16.75   t 0.75   f 18  a blink, eyes shut for exactly 2 frames (life on the hold)
//   T 17.0    t 1.0    f 24  the burger trembles on ones for 6 frames, with tremble strokes, then holds
//   T 17.625  t 1.625  f 39  the dip to black over 6 frames, then 0.92 black to the cut (f 45 to 47)
(() => {
  'use strict';
  const ID = 'price-689';
  const REF = 'first-bite';
  const DEG = Math.PI / 180;

  // ---------------------------------------------------------------------------
  // G5: the hero (verbatim from 03-first-bite.js)
  // ---------------------------------------------------------------------------
  const HERO = { x: 304, y: 2024, h: 1289 };
  const HIP = [0, -106]; // his lunge and his sways turn about the hip (design units)
  // frame 0: mouth wide open, the burger raised, eyes on the burger
  const HERO_OPEN = { k: 0, look: [0.9, 0.35] };

  /** Rig targets that move the burger, and both hands with it as the pose places them, to h (design units). */
  const holdAt = (h) => ({ hold: h, handN: [h[0] - 12, h[1] + 14], handF: [h[0] + 16, h[1] + 10] });

  /** The hero at the G5 placement: o is added to pose 'bite'. Cut off by the frame, so no foot shadow. */
  function g5Hero(ctx, L, o) {
    const rig = Object.assign({ pivot: HIP }, o.rig);
    return L.cast.hero(ctx, HERO.x, HERO.y, Object.assign({ h: HERO.h, pose: 'bite', shadow: false }, o, { rig }));
  }

  // ---------------------------------------------------------------------------
  // G4: the tag (verbatim from 03-first-bite.js)
  // ---------------------------------------------------------------------------
  const G4_SLOTS = [[505, 585], [590, 675], [680, 710], [715, 800], [805, 890]];
  /** The G4 tag, its strings up out of the frame, turned by swing about the card's top centre (700, 300). */
  function g4Tag(ctx, L, price, swing) {
    return L.props.priceTag(ctx, 700, 300, { w: 440, h: 280, hang: 'holes', drop: 400, pivot: 'top', size: 160, baseline: 230, slots: G4_SLOTS, price, swing });
  }

  // ---------------------------------------------------------------------------
  // 09's own numbers
  // ---------------------------------------------------------------------------
  // 03's frame 0 with the eyes on the tag instead of the burger: up and to the right
  const LOOK_TAG = [0.55, -0.85];
  // the tag's settle, one value per drawing on twos from f 0, degrees; still from f 6
  const SETTLE = [4, -2, 1];
  // the take on ones from f 3: stalk length per frame (lib: 1.15 is the full stalk, eyes 1.6 times
  // bigger; 1.24 is the 8 percent overshoot), then one in-between on the way home
  const TAKE = [0.6, 1.24, 1.15, 1.15, 0.4];
  // the cap's jump per frame of the take (lib's pop pose lifts it 0.32 of the head radius), with the
  // 8 percent overshoot, and one in-between on the way down
  const TAKE_CAP = [0.16, 0.38, 0.32, 0.32, 0.12];
  // the stalks rise toward the tag (head frame, radians; the head is tilted back 0.04 in this pose);
  // lib draws eyes on stalks over the visor, so the jumping cap never hides them
  const STALK_DIR = -1.0;
  // G5's burger point (centre of the burger in his hands), the base of the tremble
  const G5_BURGER = [560, 1170];
  // the tremble from f 24 on ones, px: the grip shakes, the face holds still
  const TREMBLE = [[3, -1], [-3, 1], [3, 1], [-3, -1], [2, 0], [-2, 0]];
  // G8: +21%, red, cap height 120 (digits are 0.72 of the size in 'note'), box x 90 to 420, baseline 520
  const CAPTION = { text: '+21%', x0: 90, x1: 420, base: 520, cap: 120 };
  // the source of the numbers, over +21% on the clear sky (its glyphs start at y 433): ink 'note',
  // cap height 24 (0.71 of the size), fitted into 360 px, left edge x 90, baseline y 405
  const SOURCE = { text: 'Reuters, Sept 29, 2026', x: 90, base: 405, cap: 24, w: 360 };

  // ---------------------------------------------------------------------------
  // 1 The rich street, painted once
  // ---------------------------------------------------------------------------
  function g9Street(g, L) {
    const P = L.pal;
    const sd = (...k) => L.hash(ID, 'street', ...k) & 0x7fffffff;
    const sdRef = (...k) => L.hash(REF, 'street', ...k) & 0x7fffffff; // 03's seeds for the shared pieces
    const wash = (pts, color, seed, o) => L.softWash(g, pts, Object.assign({ color, solid: true, marks: 0.6, rim: 0.12, seed }, o));
    const part = (pts, color, seed) => {
      wash(pts, color, seed);
      L.pencil(g, pts, { closed: true, base: color, seed: seed + 1 });
    };
    const ours = (pts, color, id) => part(pts, color, sd(id));
    // 03's pieces: wash seed sd(id), pencil seed sd(id, 'p'), exactly as 03 draws them
    const theirs = (pts, color, id) => {
      wash(pts, color, sdRef(id));
      L.pencil(g, pts, { closed: true, base: color, seed: sdRef(id, 'p') });
    };

    // the light field, sky and open ground (art bible 2.3)
    g.fillStyle = P.fieldSky;
    g.fillRect(0, 0, 1080, 1920);
    // 03's far hills along the same horizon
    L.softWash(g, [[-20, 1168], [180, 1132], [420, 1150], [700, 1122], [900, 1140], [1100, 1126], [1100, 1340], [-20, 1340]], { color: P.hillsFar, soft: 9, seed: sdRef('hills') });

    // a stone column at the upper left carrying a fountain bowl: shaft with three flutes, the bowl,
    // the water in it, and the spray (water may take a gradient, art bible 4.2)
    ours(L.rectPts(12, 780, 116, 640, 6), P.stone, 'shaft');
    [42, 70, 98].forEach((x, i) => L.pencil(g, [[x, 800], [x + 1, 1400]], { base: P.stone, width: 2, seed: sd('flute', i) }));
    ours([[-80, 738], [-40, 768], [10, 782], [70, 786], [130, 782], [180, 768], [220, 738]], P.stone, 'bowl');
    ours(L.ellipsePts(70, 736, 150, 24, 40), P.stone, 'rim');
    ours(L.ellipsePts(70, 734, 130, 15, 36), P.waterTop, 'pool');
    const plume = L.smoothPts([[46, 734], [52, 650], [60, 606], [70, 594], [80, 606], [88, 650], [94, 734]], true, 4);
    const grad = g.createLinearGradient(0, 590, 0, 740);
    grad.addColorStop(0, P.waterTop);
    grad.addColorStop(1, L.mix(P.waterTop, P.waterDeep, 0.35));
    g.save();
    g.globalAlpha = 0.85;
    g.fillStyle = grad;
    g.beginPath();
    L.tracePath(g, plume, true);
    g.fill();
    g.restore();
    const jet = (pts, id, width, alpha) => L.pencil(g, pts, { color: P.waterDeep, width, alpha, seed: sd('jet', id) });
    jet([[70, 730], [70, 660], [70, 600]], 0, 2.6);
    jet([[70, 600], [30, 594], [-6, 620], [-30, 690], [-36, 736]], 1, 2.4);
    jet([[70, 600], [110, 594], [146, 620], [170, 690], [176, 736]], 2, 2.4);
    jet([[70, 612], [44, 618], [20, 650], [10, 720]], 3, 1.8, 0.7);
    jet([[70, 612], [96, 618], [120, 650], [130, 720]], 4, 1.8, 0.7);
    [[-18, 612, 7], [158, 610, 6], [4, 584, 5], [138, 580, 5], [190, 668, 5], [-48, 660, 5]].forEach(([x, y, r], i) => {
      const pts = L.ellipsePts(x, y, r, r * 1.25, 12);
      wash(pts, P.waterTop, sd('drop', i), { marks: 0, rim: 0 });
      L.pencil(g, pts, { closed: true, color: P.waterDeep, width: 1.6, seed: sd('drop', i, 'p'), double: false });
    });

    // a clipped hedge along the street where 03 has its picket fence, round tops every 120 px
    const hedge = [[-20, 1612]];
    for (let x = -20; x <= 960; x += 10) hedge.push([x, 1346 - 22 * Math.abs(Math.sin((Math.PI * (x + 20)) / 120))]);
    hedge.push([960, 1612]);
    ours(hedge, P.grass, 'hedge');

    // 03's pavement and its kerb
    wash(L.rectPts(-20, 1604, 1120, 340, 16), P.cityPastel, sdRef('pave'), { marks: 0.5 });
    L.pencil(g, [[-10, 1606], [1090, 1602]], { base: P.cityPastel, width: 2.6, seed: sdRef('pave', 'top') });
    L.pencil(g, [[-10, 1740], [1090, 1746]], { base: P.cityPastel, width: 3, seed: sdRef('kerb') });

    // 03's booth window frame at the right edge (G5: x 940 to 1080, from y 620 down): awning scallops,
    // the jamb, a slice of the dark window, the end of the counter shelf, the lower panel's planks
    const scal = (x) => 618 + 16 * Math.abs(Math.sin((Math.PI * (x - 920)) / 80));
    const stripe = (x0, x1) => {
      const pts = [[x0, 470], [x1, 470]];
      for (let x = x1; x >= x0; x -= 5) pts.push([x, scal(x)]);
      return L.densify(pts, 8);
    };
    theirs(stripe(920, 1000), P.flower, 'awn1');
    theirs(stripe(1000, 1100), P.paper, 'awn2');
    theirs(L.rectPts(940, 636, 160, 1320, 12), P.wallYellow, 'jamb');
    theirs(L.rectPts(1032, 676, 80, 724, 10), P.shadowWarm, 'window');
    theirs(L.rectPts(1004, 1400, 100, 34, 8), P.fence, 'shelf');
    [990, 1050].forEach((x, i) => L.pencil(g, [[x, 1470], [x + 1, 1700], [x, 1930]], { base: P.wallYellow, width: 2.4, seed: sdRef('plank', i) }));
  }

  // ---------------------------------------------------------------------------
  // The action, frame by frame (fr: frame of the shot, 0 to 47)
  // ---------------------------------------------------------------------------
  const tagSwingAt = (fr) => (fr < 6 ? SETTLE[fr >> 1] * DEG : 0);

  /** The grip for a burger centre c in frame px, through 03's holdAt (design units). */
  function grip(c) {
    const s = HERO.h / 300;
    return holdAt([(c[0] - HERO.x) / s, (c[1] - HERO.y) / s]);
  }

  function heroAt(fr) {
    const o = { k: HERO_OPEN.k, look: LOOK_TAG };
    if (fr >= 3 && fr < 8) o.rig = { stalk: TAKE[fr - 3], stalkDir: STALK_DIR, capLift: TAKE_CAP[fr - 3] };
    if (fr >= 12) o.face = 'jaw';
    if (fr >= 24 && fr < 30) o.rig = grip([G5_BURGER[0] + TREMBLE[fr - 24][0], G5_BURGER[1] + TREMBLE[fr - 24][1]]);
    if (fr === 18 || fr === 19) o.blink = true;
    return o;
  }

  /**
   * Short ink strokes on the burger's free sides, shifting on every frame. The burger (G5: 320 x 220
   * about the hold anchor) sits against his face on the left, so the strokes keep to its top right,
   * right and bottom right.
   */
  function trembleStrokes(ctx, L, fr, c) {
    const odd = fr & 1;
    [-64, -30, 4, 38, 72].forEach((deg, i) => {
      const a = (deg + (odd ? 6 : -6)) * DEG;
      const rx = 192 + (odd ? 8 : 0), ry = 142 + (odd ? 8 : 0);
      const p0 = [c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry];
      const p1 = [c[0] + Math.cos(a) * (rx + 30), c[1] + Math.sin(a) * (ry + 30)];
      L.stroke(ctx, [p0, p1], { seed: L.hash(ID, 'tremble', fr, i) & 0x7fffffff, taper: [1, 3] });
    });
  }

  /** +21% in the caption slot: "+2" on f 6, "+21" on f 7, the whole word on f 8, the underline from f 9. */
  function caption(ctx, L, fr) {
    if (fr < 6) return;
    const seed = L.hash(ID, 'caption') & 255;
    let size = CAPTION.cap / 0.72;
    const w = L.letters(ctx, CAPTION.text, 0, 0, { size, face: 'note', measure: true, seed }).w;
    if (w > CAPTION.x1 - CAPTION.x0) size *= (CAPTION.x1 - CAPTION.x0) / w;
    const cx = (CAPTION.x0 + CAPTION.x1) / 2;
    const b = L.letters(ctx, CAPTION.text, cx, CAPTION.base, { size, face: 'note', align: 'center', color: L.pal.red, p: fr === 6 ? 0.5 : fr === 7 ? 0.75 : 1, seed });
    if (fr >= 9) {
      const y = CAPTION.base + 26;
      L.stroke(ctx, [[b.x0 + 6, y + 6], [cx, y], [b.x1 - 4, y - 8]], { color: L.pal.red, width: 9, seed: L.hash(ID, 'underline') & 0x7fffffff, taper: [6, 14] });
    }
  }

  /** The source line, from f 9 with the underline, held; lettered like the tag's price (jitter 0.6). */
  function sourceLine(ctx, L, fr) {
    if (fr < 9) return;
    const seed = L.hash(ID, 'source') & 255;
    let size = SOURCE.cap / 0.71;
    const w = L.letters(ctx, SOURCE.text, 0, 0, { size, face: 'note', jitter: 0.6, measure: true, seed }).w;
    if (w > SOURCE.w) size *= SOURCE.w / w;
    L.letters(ctx, SOURCE.text, SOURCE.x, SOURCE.base, { size, face: 'note', color: L.pal.ink, jitter: 0.6, seed });
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib;
      const t = L.clamp(tIn, 0, info.dur);
      const fr = Math.min(47, Math.floor(t * 24 + 1e-6));
      // 1 the street
      L.plate(ctx, `${ID}|g5-street-rich`, (g) => g9Street(g, L));
      // 2 the tag
      g4Tag(ctx, L, '$6.89', tagSwingAt(fr));
      // 3 the hero with the burger (at the open-mouth stage lib draws the burger behind his face)
      const a = g5Hero(ctx, L, heroAt(fr));
      // 4 the tremble
      if (fr >= 24 && fr < 30) trembleStrokes(ctx, L, fr, a.hold);
      // 5 +21% and its source
      caption(ctx, L, fr);
      sourceLine(ctx, L, fr);
      // 6 the dip: 0 on f 39, rising to 0.92 on f 45, held to the cut (it reads as black, and the gate's
      // last frame still holds a picture)
      const k = 0.92 * L.clamp((t - 1.625) / 0.25);
      if (k > 0) L.dipBlack(ctx, k);
    },
  });
})();

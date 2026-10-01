/*
 * 04 title-card: One burger, two prices. T 6.0 to 8.0 (t 0 to 2), illustrated (street plate).
 * Layers, back to front:
 *   1. plate (cached): the white paper field and three pale blots, one under each title line
 *   2. the title: ONE from frame 0; BURGER, at T 6.125, TWO at 6.25, PRICES at 6.375, each a whole
 *      word popping in 3 drawings on ones with an 8 percent overshoot
 *   3. the byline REUTERS, SEPT 29, 2026 in ink round capitals (art bible 9.1), left to right a word
 *      group per 16th: REUTERS, at 6.5, SEPT 29, at 6.625, 2026 at 6.75 (no letter-by-letter typing)
 *   4. the whole burger at (540, 1300): squash from 6.917, the pluck at 7.0 throws it up, it lands
 *      and settles by 7.5, all on twos; then the card holds
 * Title lines are fitted into their storyboard G8 boxes (narrower than the face at the planned cap
 * heights), so ONE and BURGER, share one size and TWO PRICES keeps the 120:150 ratio. The byline
 * keeps cap 40 (art bible 9.1 wants 40 to 55) and so runs wider than its G8 box, inside the safe area.
 */
(function () {
  'use strict';
  const ID = 'title-card';
  const CAP = 0.74; // cap height per letter size of the round face (art bible 9)
  const BYLINE = 'REUTERS, SEPT 29, 2026';
  const BYLINE_SHOWN = [[18, 22], [15, 17], [12, 8]]; // [from frame, letters shown]: a word group per 16th
  // lib.letters seeds picked so each word's baseline jumps up and down by about 12 px, no letter shrunk
  const SEED = { ONE: 5560, BURGER: 19865, TWO: 3094, PRICES: 10767, BYLINE: 120206 };
  const POP = [0.75, 1.08, 1]; // a word's 3 drawings, on ones from its beat frame
  // the burger, one drawing per 2 frames from frame 22 (T 6.917): [x scale, y scale, lift px]
  const HOP = [
    [1.03, 0.96, 0], // anticipation
    [1.06, 0.92, 0], // T 7.0, the pluck: full squash
    [0.94, 1.12, 30], // stretched, leaving
    [0.98, 1.04, 50], // top
    [0.96, 1.08, 24], // falling
    [1.05, 0.94, 0], // lands
    [0.99, 1.02, 0], // settles
  ];
  const BURGER_W = 360 / 1.1; // props.burger draws 1.1 times o.w wide; the plan wants 360 px
  const BURGER_BASE = 1300 + 0.39 * BURGER_W; // the bottom bun's underside, the squash pivot

  // the round-face size that fits str, its ink outline included, into maxW px, at most cap high
  function fit(ctx, L, str, cap, maxW, outline) {
    const size = cap / CAP;
    const w = L.letters(ctx, str, 0, 0, { size, measure: true }).w + (outline ? 0.14 * size : 0);
    return w > maxW ? (size * maxW) / w : size;
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal;
      const t = L.clamp(tIn, 0, info.dur);
      const fr = Math.floor(t * 24 + 1e-6); // frames since T 6.0

      // 1. plate
      L.plate(ctx, ID + '|plate|1', (g) => {
        g.fillStyle = P.paper;
        g.fillRect(0, 0, 1080, 1920);
        L.spot(g, 528, 512, 225, 100, { color: P.titleSpot, seed: L.hash(ID, 'spot', 1) });
        L.spot(g, 552, 712, 410, 105, { color: P.titleSpotPink, seed: L.hash(ID, 'spot', 2) });
        L.spot(g, 532, 918, 455, 92, { color: P.titleSpot, seed: L.hash(ID, 'spot', 3) });
      });

      // 2. title. G8 boxes: ONE x 370-710, BURGER, x 160-920, TWO PRICES x 150-930
      const s12 = Math.min(fit(ctx, L, 'ONE', 150, 340, true), fit(ctx, L, 'BURGER,', 150, 760, true));
      const s3 = fit(ctx, L, 'TWO PRICES', 120, 780, true);
      const word = (str, cx, base, size, at, seed) => {
        if (fr < at) return;
        const sc = POP[Math.min(2, fr - at)];
        const mid = base - (size * CAP) / 2; // a pop grows about the word's middle
        L.letters(ctx, str, cx, mid + (base - mid) * sc, {
          size: size * sc, align: 'center', color: P.titleBlue, firstColor: P.titleYellow, outline: P.ink, seed,
        });
      };
      const m = (str) => L.letters(ctx, str, 0, 0, { size: s3, measure: true }).w;
      const x3 = 540 - m('TWO PRICES') / 2;
      word('ONE', 540, 560, s12, -2, SEED.ONE); // on frame 0, already settled
      word('BURGER,', 540, 760, s12, 3, SEED.BURGER); // T 6.125
      word('TWO', x3 + m('TWO') / 2, 960, s3, 6, SEED.TWO); // T 6.25
      word('PRICES', x3 + m('TWO PRICES') - m('PRICES') / 2, 960, s3, 9, SEED.PRICES); // T 6.375

      // 3. byline, cap 40, baseline 1080, kept inside the title's column x 150-930
      const shown = BYLINE_SHOWN.find(([from]) => fr >= from);
      if (shown) {
        L.letters(ctx, BYLINE, 540, 1080, {
          size: fit(ctx, L, BYLINE, 40, 780, false), align: 'center', color: P.ink, seed: SEED.BYLINE, p: shown[1] / BYLINE.length,
        });
      }

      // 4. burger
      const [sx, sy, lift] = (fr >= 22 && HOP[(fr - 22) >> 1]) || [1, 1, 0];
      ctx.save();
      ctx.translate(540, BURGER_BASE - lift);
      ctx.scale(sx, sy);
      ctx.translate(-540, -BURGER_BASE);
      L.props.burger(ctx, 540, 1300, { w: BURGER_W });
      ctx.restore();
    },
  });
})();

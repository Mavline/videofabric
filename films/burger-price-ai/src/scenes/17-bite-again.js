// 17 bite-again: Same burger, different neighborhood. T 28.0 to 30.0 (shot t 0 to 2.0, frames 0 to 47),
// street plate (illustrated). Hard cut in from 16, hard cut out to 18.
//
// G5 and G4 on 03's pixels: the modest street, the $5.69 tag, the hero in the bite pose. Frame 0 is 03's
// frame 0. Copied verbatim from src/scenes/03-first-bite.js, seeds from REF 'first-bite' (if 03 changes
// them, copy them again):
//   - the place: HERO, HIP, HERO_OPEN, holdAt, g5Hero, g5Street, G4_SLOTS, tagSwing, g4Tag
//   - the bite drawings: CHOMP_HOLD, CHEW_HOLD, BITE, biteWindUp, biteTeeth, biteAway, biteChew, biteBliss,
//     bitePoint, crumbs and the impact star call
// 17's own: the caption, the frames the drawings sit on, and a bite played harder than 03's (the owner's
// review of the draft: the second time he must be seen to bite): windUpHard leans back further, teethHard
// presses the head deeper and squashes the body into the bite, chewHard nods the head further with the jaw
// and bobs the body with each chew. The street plate is cached
// under this shot's own key, so the two shots never share a cache entry.
//
// Layers, back to front:
//   1 the still street plate (03's g5Street)
//   2 the caption in the G5 caption slot (G8 box x 80 to 455, y 278 to 520): ink 'note' lettering on two
//     titleSpot blots, painted on the sky, so the tag hangs in front of the blots' right tips
//   3 the $5.69 tag (G4), rocking plus or minus 2 degrees about (700, 300) on twos
//   4 the hero: lib.cast.hero pose 'bite' from (304, 2024) at h 1289; the pose draws the burger, behind his
//     face while the mouth is open, then in his hands with a big crescent bite on his mouth's side
//   5 drawn effects on the bite: an impact star for 2 frames, three crumbs for 4 frames, on ones
//
// Beats (global T, shot t, shot frame):
//   T 28.0    t 0      f 0   03's frame 0: mouth wide open, burger raised
//   T 28.25   t 0.25   f 6   "Same burger." pops (3 frames on ones); wind-up on twos, a third deeper than 03's
//   T 28.5    t 0.5    f 12  bar 15 beat 2: teeth in the burger, 3 frames on ones, pressed harder than in 03
//                            and the body squashed into it; the star (2 frames), the crumbs (4)
//   T 28.625  t 0.625  f 15  the burger comes away, on ones then on twos (f 15, 16), the crescent bite on his
//                            mouth's side, and stays in his hands in view to the cut
//   T 28.75   t 0.75   f 18  "Different" / "neighborhood." pop (3 frames on ones); chewing on the 8ths
//                            (f 18, 24, 30) on twos, the jaw and the head working harder than in 03; he leans
//                            in (f 32) before the sway
//   T 29.5    t 1.5    f 36  bliss: eyes shut into arcs, deeper blush, one 6 degree sway back, held to the cut
(() => {
  'use strict';
  const ID = 'bite-again';
  const REF = 'first-bite';
  const DEG = Math.PI / 180;
  const sd = (L, ...k) => L.hash(ID, ...k) & 0x7fffffff;

  // ---------------------------------------------------------------------------
  // G5: the hero (art bible 8: cast.hero(ctx, 304, 2024, { h: 1289, pose: 'bite', k: 0 }))
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

  /** The G5 street behind him, painted once: the modest street (03 and 17). */
  function g5Street(g, L) {
    const P = L.pal;
    const sd = (...k) => L.hash(REF, 'street', ...k) & 0x7fffffff;
    const wash = (pts, color, id, o) => L.softWash(g, pts, Object.assign({ color, solid: true, marks: 0.6, rim: 0.12, seed: sd(id) }, o));
    const edge = (pts, base, id) => L.pencil(g, pts, { closed: true, base, seed: sd(id, 'p') });
    const part = (pts, color, id) => {
      wash(pts, color, id);
      edge(pts, color, id);
    };
    // the light field, sky and open ground (art bible 2.3)
    g.fillStyle = P.fieldSky;
    g.fillRect(0, 0, 1080, 1920);
    // far hills along the horizon, pale and cool
    L.softWash(g, [[-20, 1168], [180, 1132], [420, 1150], [700, 1122], [900, 1140], [1100, 1126], [1100, 1340], [-20, 1340]], { color: P.hillsFar, soft: 9, seed: sd('hills') });
    // the modest house's corner: its wall, the right half of its gable, a window with curtains
    part(L.rectPts(-40, 800, 290, 830, 12), P.wallYellow, 'wall');
    part(L.densify([[-40, 512], [304, 812], [-40, 812]], 10), P.roof, 'roof');
    part(L.rectPts(-8, 900, 128, 172, 8), P.waterTop, 'glass');
    L.pencil(g, [[56, 904], [56, 1068]], { base: P.waterTop, seed: sd('mull') });
    part(L.densify([[-8, 900], [40, 900], [-8, 1030]], 6), P.flower, 'curtL');
    part(L.densify([[120, 900], [72, 900], [120, 1030]], 6), P.flower, 'curtR');
    part(L.rectPts(-16, 1072, 148, 18, 6), P.fence, 'sill');
    // a picket fence in front of it, colored-pencil grain in trunk
    part(L.rectPts(-20, 1368, 980, 24, 10), P.fence, 'rail1');
    part(L.rectPts(-20, 1500, 980, 24, 10), P.fence, 'rail2');
    for (let i = 0, x = 6; x < 960; x += 58, i++) {
      const pk = L.densify([[x - 15, 1612], [x - 15, 1336], [x, 1306], [x + 15, 1336], [x + 15, 1612]], 8, true);
      part(pk, P.fence, `pick${i}`);
      L.pencil(g, [[x - 3, 1350], [x - 4, 1440], [x - 2, 1560]], { color: P.trunk, width: 1.8, alpha: 0.55, seed: sd('grain', i) });
    }
    // the pavement and its kerb
    wash(L.rectPts(-20, 1604, 1120, 340, 16), P.cityPastel, 'pave', { marks: 0.5 });
    L.pencil(g, [[-10, 1606], [1090, 1602]], { base: P.cityPastel, width: 2.6, seed: sd('pave', 'top') });
    L.pencil(g, [[-10, 1740], [1090, 1746]], { base: P.cityPastel, width: 3, seed: sd('kerb') });
    // the booth's window frame at the right edge: awning scallops, the jamb, a slice of the dark window,
    // the end of the counter shelf, the lower panel's planks
    const scal = (x) => 618 + 16 * Math.abs(Math.sin((Math.PI * (x - 920)) / 80));
    const stripe = (x0, x1) => {
      const pts = [[x0, 470], [x1, 470]];
      for (let x = x1; x >= x0; x -= 5) pts.push([x, scal(x)]);
      return L.densify(pts, 8);
    };
    part(stripe(920, 1000), P.flower, 'awn1');
    part(stripe(1000, 1100), P.paper, 'awn2');
    part(L.rectPts(940, 636, 160, 1320, 12), P.wallYellow, 'jamb');
    part(L.rectPts(1032, 676, 80, 724, 10), P.shadowWarm, 'window');
    part(L.rectPts(1004, 1400, 100, 34, 8), P.fence, 'shelf');
    [990, 1050].forEach((x, i) => L.pencil(g, [[x, 1470], [x + 1, 1700], [x, 1930]], { base: P.wallYellow, width: 2.4, seed: sd('plank', i) }));
  }

  // ---------------------------------------------------------------------------
  // G4: the tag (art bible 8)
  // ---------------------------------------------------------------------------
  const G4_SLOTS = [[505, 585], [590, 675], [680, 710], [715, 800], [805, 890]];
  /** The tag's rock: plus or minus 2 degrees on twos, one swing a second, upright on frame 0. */
  const tagSwing = (L, t) => 2 * DEG * Math.sin(2 * Math.PI * L.onTwos(t));
  /** The G4 tag, its strings up out of the frame, turned by swing about the card's top centre (700, 300). */
  function g4Tag(ctx, L, price, swing) {
    return L.props.priceTag(ctx, 700, 300, { w: 440, h: 280, hang: 'holes', drop: 400, pivot: 'top', size: 160, baseline: 230, slots: G4_SLOTS, price, swing });
  }

  // ---------------------------------------------------------------------------
  // The bite, drawing by drawing (shared with 17, which places the drawings on its own frames)
  // ---------------------------------------------------------------------------
  // where the bite pose holds the burger on the chomp (lib, k 0.5), and where he holds it after it: in
  // front of his chest, right of the near sleeve so the bitten side (toward his mouth) shows
  const CHOMP_HOLD = [42, -208];
  const CHEW_HOLD = [72, -162];
  // the bite: on the edge toward his mouth, big enough to read at a quarter of the frame size
  // (lib props.burger: biteSide, biteSize = the bite's diameter as a share of the burger's width)
  const BITE = { biteSide: 'left', biteSize: 0.48 };

  /** Wind-up, drawing i of 3 on twos: he leans back to 20 px at the head, the head tipping back. */
  function biteWindUp(i) {
    const d = [0.45, 0.8, 1][i];
    return Object.assign({}, HERO_OPEN, { rot: -2.05 * DEG * d, tilt: -0.1 - 0.07 * d });
  }
  /**
   * Teeth in the burger, frame i of 3 on ones: the head 20 px forward and pressed into the burger, tipped
   * forward, then easing off on the third frame (the lib has no squash for his head: the press and the tilt
   * stand in for it).
   */
  function biteTeeth(i) {
    const p = [1, 1, 0.5][i];
    return { k: 0.5, rot: 2.05 * DEG, tilt: 0.06 + 0.08 * p, rig: { head: [6 + 3 * p, -236 + 2.5 * p] } };
  }
  /**
   * The burger comes away from his mouth to his chest, drawing i of 3 on twos, the big bite on his mouth's
   * side; he settles back, cheeks full, mouth shut. No chew phase yet, so the lib draws the burger over his
   * chin and the bite is not hidden under it.
   */
  function biteAway(i) {
    const u = [0.4, 0.8, 1][i];
    const h = [CHOMP_HOLD[0] + (CHEW_HOLD[0] - CHOMP_HOLD[0]) * u, CHOMP_HOLD[1] + (CHEW_HOLD[1] - CHOMP_HOLD[1]) * u];
    return Object.assign({ k: 0.9, rot: 2.05 * DEG * (1 - u), rig: holdAt(h) }, BITE);
  }
  /**
   * Chewing, frame c of the 6 frames of one chew on an 8th, on twos: the jaw drops, half shuts, shuts (chew
   * phase 1, 0.5, 0) and the head nods with it; c 6 or more is the rest between chews (jaw shut).
   */
  function biteChew(c, lean = 0) {
    const rig = holdAt(CHEW_HOLD);
    const o = Object.assign({ k: 0.9, chewPhase: 0, rot: lean, rig }, BITE);
    if (c < 2) return Object.assign(o, { chewPhase: 1, tilt: 0.06, rig: Object.assign(rig, { head: [6.5, -233] }) });
    if (c < 4) return Object.assign(o, { chewPhase: 0.5, tilt: 0.03, rig: Object.assign(rig, { head: [6.2, -234.5] }) });
    return o;
  }
  /** Bliss, the burger at his chest, swayed by deg degrees about his hip (plus is forward). */
  function biteBliss(deg) {
    return Object.assign({ k: 0.9, face: 'bliss', rot: deg * DEG, rig: holdAt(CHEW_HOLD) }, BITE);
  }
  /** Where his teeth meet the burger: the star and the crumbs start here. */
  const bitePoint = (a) => [a.mouth[0] + 0.3 * a.headR, a.mouth[1] - 0.12 * a.headR];

  // ---------------------------------------------------------------------------
  // The caption (G8): "Same burger." / "Different" / "neighborhood.", ink 'note' on titleSpot
  // ---------------------------------------------------------------------------
  // Baselines 330, 420 and 505, left edge x 80. The storyboard's cap heights (52, 52, 48) do not fit the
  // box's 375 px in the handwriting face, so the lines shrink to fit (art bible 9): the first two share
  // one size, the third is never bigger than them.
  const NOTE_CAP = 0.71; // cap height of 'note' per unit of size (art bible 9)
  const BOX = [80, 455];
  const LINES = [['Same burger.', 52], ['Different', 52], ['neighborhood.', 48]];
  // each pop: its frame, its blot [cx, cy, rx, ry] and its lines [line index, baseline]
  const CAPTION = [
    { at: 6, spot: [268, 314, 232, 62], lines: [[0, 330]] }, // T 28.25
    { at: 18, spot: [268, 452, 245, 108], lines: [[1, 420], [2, 505]] }, // T 28.75
  ];
  const POP = [0.72, 1.08, 1]; // 3 drawings on ones with an 8 percent overshoot, about the blot's centre

  function captionSizes(ctx, L) {
    const fit = ([str, cap]) => {
      const size = cap / NOTE_CAP;
      const w = L.letters(ctx, str, 0, 0, { size, face: 'note', measure: true }).w;
      return Math.min(size, (size * (BOX[1] - BOX[0])) / w);
    };
    const s12 = Math.min(fit(LINES[0]), fit(LINES[1]));
    return [s12, s12, Math.min(fit(LINES[2]), s12)];
  }

  function caption(ctx, L, sizes, fr) {
    CAPTION.forEach((c, i) => {
      if (fr < c.at) return;
      const k = POP[Math.min(2, fr - c.at)];
      const [cx, cy, rx, ry] = c.spot;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(k, k);
      ctx.translate(-cx, -cy);
      L.spot(ctx, cx, cy, rx, ry, { color: L.pal.titleSpot, irr: 0.08, seed: sd(L, 'spot', i) });
      c.lines.forEach(([j, base]) => L.letters(ctx, LINES[j][0], BOX[0], base, { size: sizes[j], face: 'note', color: L.pal.ink, seed: sd(L, 'line', j) }));
      ctx.restore();
    });
  }

  // ---------------------------------------------------------------------------
  // 17's timing, frame by frame (fr: frame of the shot, 0 to 47)
  // ---------------------------------------------------------------------------
  // the bite played harder than 03's. The wind-up leans back a third further; on the first two frames of
  // the teeth the head presses 40 percent deeper, the lunge is a quarter longer and the body squashes into
  // the bite (skeleton 2 percent wider, 2.5 percent shorter)
  function windUpHard(i) {
    const o = biteWindUp(i);
    return Object.assign(o, { rot: o.rot * 1.35, tilt: o.tilt - 0.03 * [0.45, 0.8, 1][i] });
  }
  function teethHard(i) {
    const o = biteTeeth(i);
    const p = [1, 1, 0.5][i];
    const h = o.rig.head;
    return Object.assign(o, {
      rot: o.rot * 1.25,
      tilt: o.tilt + 0.035 * p,
      rig: { head: [h[0] + 1.2 * p, h[1] + 1 * p], sq: i < 2 ? [1.02, 0.975] : null },
    });
  }
  // the chewing played harder than 03's: the head nods and drops further with the jaw, and the body bobs
  // down with each chew (skeleton 1.5 percent shorter on the jaw-down drawing, half that on the next)
  function chewHard(c, lean) {
    const o = biteChew(c, lean);
    if (c < 4) {
      const e = c < 2 ? 1 : 0.5;
      o.tilt += 0.04 * e;
      o.rig.head = [o.rig.head[0] + 0.8 * e, o.rig.head[1] + 2 * e];
      o.rig.sq = [1 + 0.008 * e, 1 - 0.015 * e];
    }
    return o;
  }

  function heroAt(fr) {
    if (fr < 6) return HERO_OPEN;
    if (fr < 12) return windUpHard((fr - 6) >> 1);
    if (fr < 15) return teethHard(fr - 12);
    // the burger comes away: on ones (f 15), then on twos (f 16), and reaches his chest with the first chew
    if (fr < 18) return biteAway(fr < 16 ? 0 : 1);
    // chewing on the 8ths (f 18, 24, 30); he leans in (f 32) before the sway
    if (fr < 36) return chewHard((fr - 18) % 6, fr >= 32 ? [1, 2][(fr - 32) >> 1] * DEG : 0);
    // bliss: the sway back pops in over 3 drawings (f 36) and holds to the cut
    return biteBliss(-6 * [0.6, 1.08, 1][Math.min(2, (fr - 36) >> 1)]);
  }

  /** Three crumbs flying off the bite up and away from his face, on ones for 4 frames from the chomp (i 0 to 3). */
  function crumbs(ctx, L, at, headR, i) {
    const P = L.pal;
    const sd = (...k) => L.hash(REF, 'crumb', ...k) & 0x7fffffff;
    [[-78, 50, P.bun, 17], [-42, 60, P.sesame, 13], [-12, 54, P.lettuce, 15]].forEach(([deg, v, fill, r], j) => {
      const a = deg * DEG;
      const d = 0.46 * headR + v * i;
      const x = at[0] + Math.cos(a) * d, y = at[1] + Math.sin(a) * d + 8 * i * i;
      L.speedLines(ctx, x, y, a, { n: 1, spread: 0, len: [30, 50], gap: r + 6, width: 4, seed: sd('trail', j, i) });
      L.cel(ctx, L.blobPts(x, y, r, r * 0.78, sd('shape', j), 0.28, 14), { fill, width: 3.2, seed: sd('line', j) });
    });
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib;
      const t = L.clamp(tIn, 0, info.dur);
      const fr = Math.min(47, Math.floor(t * 24 + 1e-6));
      // 1 the street
      L.plate(ctx, `${ID}|g5-street`, (g) => g5Street(g, L));
      // 2 the caption, on the sky behind the tag
      caption(ctx, L, captionSizes(ctx, L), fr);
      // 3 the tag
      g4Tag(ctx, L, '$5.69', tagSwing(L, t));
      // 4 the hero with the burger
      const a = g5Hero(ctx, L, heroAt(fr));
      // 5 the bite, where his teeth meet the burger: star for 2 frames, crumbs for 4, on ones
      const bite = bitePoint(a);
      if (fr >= 12 && fr < 16) crumbs(ctx, L, bite, a.headR, fr - 12);
      if (fr >= 12 && fr < 14) L.impactStar(ctx, bite[0], bite[1], 0.36 * a.headR, { seed: L.hash(REF, 'star', fr) & 255 });
    },
  });
})();

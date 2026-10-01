// 03 first-bite: The first bite. T 3.5 to 6.0 (shot t 0 to 2.5, frames 0 to 59), street plate (illustrated).
//
// G5 (the hero close-up at the counter) and G4 (the price tag, close) on their exact pixels, with the
// calls of art bible section 8. 09 and 17 repeat this composition, and 17's frame 0 is this frame 0.
// Shared pieces, copied verbatim (seeds come from REF, keep it 'first-bite'):
//   - the place: HERO, HIP, HERO_OPEN, holdAt, g5Hero, g5Street, G4_SLOTS, tagSwing, g4Tag
//   - the bite, one drawing per call, placed on frames by each shot's own heroAt: CHOMP_HOLD, CHEW_HOLD,
//     BITE, biteWindUp(i), biteTeeth(i), biteAway(i), biteChew(c, lean), biteBliss(deg), bitePoint, crumbs,
//     and the impact star call in draw
//
// Layers, back to front:
//   1 the still street plate, painted once (lib.plate): the fieldSky light field, far hills, the corner
//     of the modest house (gable, window with curtains), a picket fence, the pavement, and at the right
//     edge the booth's window frame (G5: x 940 to 1080, from y 620 down). Washes and colored pencil.
//   2 the $5.69 tag (G4): card x 480 to 920, y 300 to 580, strings up out of the frame, rocking
//     plus or minus 2 degrees about (700, 300) on twos
//   3 the hero: lib.cast.hero pose 'bite' from (304, 2024) at h 1289, head centre (330, 1010); the pose
//     draws the burger in his hands, at G5's (560, 1170) behind his face while the mouth is open
//   4 drawn effects on the bite: three crumbs on ones for 4 frames, an impact star for 2 frames
//
// Beats (global T, shot t, shot frame):
//   T 3.5    t 0      f 0   mouth wide open, burger raised, eyes on the burger (the pose 09 and 17 open on)
//   T 3.75   t 0.25   f 6   wind-up on twos, 6 frames: he leans back 20 px, the head tips back
//   T 4.0    t 0.5    f 12  bar 3 downbeat: teeth in the burger, 3 frames on ones, the head lunged 20 px and
//                           pressed into it, eyes squeezed shut; the star (2 frames), the crumbs (4)
//   T 4.125  t 0.625  f 15  the burger comes away to his chest on twos (f 15, 17, 19), a big crescent bite
//                           on the side of his mouth; cheeks full
//   T 4.5    t 1.0    f 24  chew, and again at T 4.75 (f 30), on twos: the jaw drops, half shuts, shuts,
//                           the head nodding with it; he leans in (f 32) before the sway
//   T 5.0    t 1.5    f 36  bliss: eyes shut into arcs, deeper blush, a 6 degree sway back, held
//   T 5.333  t 1.833  f 44  he leans further back (anticipation)
//   T 5.5    t 2.0    f 48  the sway forward, 6 degrees the other side, held to the cut
(() => {
  'use strict';
  const ID = 'first-bite';
  const REF = 'first-bite';
  const DEG = Math.PI / 180;

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
  // 03's timing, frame by frame (fr: frame of the shot, 0 to 59)
  // ---------------------------------------------------------------------------
  function heroAt(fr) {
    if (fr < 6) return HERO_OPEN;
    if (fr < 12) return biteWindUp((fr - 6) >> 1);
    if (fr < 15) return biteTeeth(fr - 12);
    if (fr < 24) return biteAway(Math.min(2, (fr - 15) >> 1));
    // chewing on the 8ths (f 24, 30); he leans in (f 32) before the sway
    if (fr < 36) return biteChew(fr >= 24 ? (fr - 24) % 6 : 6, fr >= 32 ? [1, 2][(fr - 32) >> 1] * DEG : 0);
    // bliss: the sway back pops in over 3 drawings (f 36) and holds; he leans further back (f 44);
    // the sway forward goes over 4 drawings (f 48) and holds to the cut
    if (fr < 44) return biteBliss(-6 * [0.6, 1.08, 1][Math.min(2, (fr - 36) >> 1)]);
    if (fr < 48) return biteBliss(-7.5);
    return biteBliss([-2.4, 1.8, 6.5, 6][Math.min(3, (fr - 48) >> 1)]);
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
      const fr = Math.min(59, Math.floor(t * 24 + 1e-6));
      // 1 the street
      L.plate(ctx, `${REF}|g5-street`, (g) => g5Street(g, L));
      // 2 the tag
      g4Tag(ctx, L, '$5.69', tagSwing(L, t));
      // 3 the hero with the burger
      const a = g5Hero(ctx, L, heroAt(fr));
      // 4 the bite, where his teeth meet the burger: star for 2 frames, crumbs for 4, on ones
      const bite = bitePoint(a);
      if (fr >= 12 && fr < 16) crumbs(ctx, L, bite, a.headR, fr - 12);
      if (fr >= 12 && fr < 14) L.impactStar(ctx, bite[0], bite[1], 0.36 * a.headR, { seed: L.hash(REF, 'star', fr) & 255 });
    },
  });
})();

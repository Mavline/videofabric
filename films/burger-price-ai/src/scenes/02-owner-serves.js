// 02 owner-serves: Inside booth one, the owner serves. T 2.0 to 3.5 (shot-local t 0 to 1.5), schematic.
// docs/storyboard.md, plan 02 and shared geometry G2; the same interior returns in 08 and 13.
// Layers, back to front:
//   1 the modest street through the window: a cached light plate (fieldSky, washes, colored pencil)
//   2 the hero outside, front view, clipped to the window opening
//   3 the inside: a cached dense plate, the warm wall with the window cut out, its frame, the counter
//   4 on the counter: the phone, the register, the coins, the burger
//   5 the owner, three-quarter from behind, in the left foreground
//   6 drawn effects on ones: the smears of the snatch and of the flick, the impact star of the ka-ching
(() => {
  'use strict';
  const ID = 'owner-serves';
  const sd = (...k) => FILM.lib.hash(ID, ...k) & 0x7fffffff;

  // ---- G2 at its pixels (08 and 13 copy these numbers) ----
  const WIN = { x0: 240, y0: 560, x1: 840, y1: 1100 }; // window opening
  const FRAME = 30; // the frame around it
  const TOP = { y0: 1100, y1: 1170 }; // counter top across the whole width; its inner side runs to the bottom edge
  const OWN = { x: 92.5, y: 1636, h: 1167 }; // art bible 8: head at (180, 650), head height 210
  const HERO = { x: 560, y: 1483, h: 838 }; // art bible 8: hands on the sill at 465 and 655, y 1100
  const HS = HERO.h / 300; // one of the hero's design units in px
  const BURGER_W = 75 * HS; // in his hands the burger is 75 of his units (art bible 10.4)
  const BURGER_Y = 1080; // the burger path, on the counter
  const COIN_W = 34 * HS; // the coins he held up in 01, at this scale
  const COINS = [[598, 1096, 1], [643, 1089, 2]]; // x, y, seed: lying flat on the sill around (620, 1092), as in 08
  const REG = [960, 1100]; // register x 860 to 1060, y 886 to 1100 at w 200
  const PHONE = [770, 1100]; // phone x 704 to 836, y 996 to 1100 at w 140
  const INNER = FILM.lib.mix(FILM.lib.pal.fence, FILM.lib.pal.trunk, 0.45); // the counter's inner side

  // ---- timing, shot-local; frame n is T 2.0 + n / 24 ----
  const SLIDE = 0.25; // T 2.0 to 2.25: the burger slides from 380 to 500 on twos, easing out
  const WIND = 6; // frames 6 to 11: the hero's hands rise into claws, the body stretches up (anticipation, twos)
  const SNATCH = 12; // T 2.5: grab, yank, stretch on ones (frames 12 to 14)
  const RING = 24; // T 3.0: the flick into the register and the ka-ching on ones (frames 24 to 26)
  const BLINK = 30; // the hero's blink on the hold: exactly 2 frames

  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

  // ---- layer 1: the modest street, a light plate seen through the window ----
  function street(ctx, L, P, R) {
    L.plate(ctx, `${ID}|street|1`, (g) => {
      g.translate(-WIN.x0, -WIN.y0);
      g.fillStyle = P.fieldSky;
      g.fillRect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);
      L.softWash(g, L.blobPts(340, 616, 84, 22, sd(1), 0.2), { color: P.paper, alpha: 0.85, soft: 12, seed: sd(2) });
      L.softWash(g, L.blobPts(772, 662, 66, 19, sd(3), 0.2), { color: P.paper, alpha: 0.85, soft: 12, seed: sd(4) });
      L.softWash(g, [[200, 930], [420, 905], [650, 925], [880, 900], [880, 1012], [200, 1012]], { color: P.hillsFar, soft: 8, seed: sd(5) });
      L.softWash(g, L.blobPts(792, 936, 72, 62, sd(6), 0.25), { color: P.grass, soft: 8, seed: sd(7) });
      R.house(g, 228, 1150, { h: 470, kind: 'modest', seed: 2 });
    }, { x: WIN.x0, y: WIN.y0, w: WIN.x1 - WIN.x0, h: WIN.y1 - WIN.y0 });
  }

  // ---- layer 3: the inside, a dense plate with the window cut out ----
  function inside(ctx, L, P) {
    L.plate(ctx, `${ID}|inside|1`, (g) => {
      const fx0 = WIN.x0 - FRAME, fy0 = WIN.y0 - FRAME, fx1 = WIN.x1 + FRAME;
      // the warm wall around the frame
      L.dense(g, [rect(0, 0, 1080, TOP.y0), rect(fx0, fy0, fx1, TOP.y0)], { bounds: [0, 0, 1080, TOP.y0], base: P.wallWarm, dir: 'vertical', seed: sd(10) });
      // the window frame in shadowWarm: the head across, the jambs down
      L.dense(g, null, { bounds: [fx0, fy0, fx1 - fx0, FRAME], base: P.shadowWarm, dir: 'horizontal', seed: sd(11) });
      L.dense(g, null, { bounds: [fx0, WIN.y0, FRAME, TOP.y0 - WIN.y0], base: P.shadowWarm, dir: 'vertical', seed: sd(12) });
      L.dense(g, null, { bounds: [WIN.x1, WIN.y0, FRAME, TOP.y0 - WIN.y0], base: P.shadowWarm, dir: 'vertical', seed: sd(13) });
      L.ragged(g, L.densify([[fx0, TOP.y0], [fx0, fy0], [fx1, fy0], [fx1, TOP.y0]], 20, false), { base: P.wallWarm, width: 5, seed: sd(14) });
      L.ragged(g, L.densify([[WIN.x0, TOP.y0], [WIN.x0, WIN.y0], [WIN.x1, WIN.y0], [WIN.x1, TOP.y0]], 20, false), { base: P.shadowWarm, width: 4, seed: sd(15) });
      // the counter: the top in fence with strokes along its length, the inner side below it darker
      L.dense(g, null, { bounds: [0, TOP.y0, 1080, TOP.y1 - TOP.y0], base: P.fence, dir: 'horizontal', seed: sd(16) });
      L.dense(g, null, { bounds: [0, TOP.y1, 1080, 1920 - TOP.y1], base: INNER, dir: 'vertical', seed: sd(17) });
      L.ragged(g, [[0, TOP.y0], [1080, TOP.y0 - 1]], { base: P.fence, width: 4, seed: sd(18) });
      L.ragged(g, [[0, TOP.y1], [1080, TOP.y1 + 1]], { base: P.fence, width: 5, seed: sd(19) });
      // the opening stays clear for the street and the hero
      g.save();
      g.globalCompositeOperation = 'destination-out';
      g.fillRect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);
      g.restore();
    });
  }

  // ---- the owner: his right wrist on the counter and the sag of his shoulders 0..1 ----
  // From behind, cast.owner hangs the broad shoulders on the hip-to-neck line, so lowering the neck and the
  // head (the 'sigh' pose's 16-unit drop, rigOwner's defaults below) sags the whole back.
  const O = { neck: [12, -310], head: [30, -338] };
  function ownerRig(L, sag) {
    if (!sag) return undefined; // at rest he is cast.owner's own drawing
    const d = L.ease.outCubic(L.clamp(sag)) * 16;
    return { neck: [O.neck[0], O.neck[1] + d], head: [O.head[0], O.head[1] + d * 1.1], tilt: 0.12 + 0.14 * L.clamp(sag) };
  }
  // key drawings: frame -> [wrist [x, y], sag]; a frame holds the last key at or before it
  const OWNER_KEYS = {
    6: [[430, 1040], 0], // the push ends with his hand on the bun; he holds while the boy grabs
    13: [[444, 1110], 0], // the burger is yanked from under his hand: it drops onto the counter (ones)
    14: [[452, 1112], 0], // and rests there (twos)
    16: [[512, 1102], 0], // over the coins
    18: [[470, 1106], 0.25], // drawn back, shoulders hunched: the anticipation, 6 frames
    24: [[600, 1102], 0], // the flick (ones): the coins fly into the register
    25: [[616, 1106], 0], // overshoot
    26: [[598, 1106], 0], // settle
    28: [[540, 1112], 0.15], // the hand comes back along the counter (twos)
    30: [[492, 1118], 0.5], // and he sags
    32: [[486, 1120], 0.85],
    34: [[486, 1120], 1], // hold to the cut
  };
  function ownerKey(fr, bx) {
    if (fr < 6) return [[bx - 70, 1040], 0]; // the push: his flat hand on the bun's upper left, moving with it
    let k = fr;
    while (!OWNER_KEYS[k]) k--;
    return OWNER_KEYS[k];
  }

  // ---- the hero: options per frame (facing -1, so his near hand is the one by the burger) ----
  // a frame point to his design units under a squash sq (the rig is scaled by sq after it is set)
  const heroU = (x, y, sq) => [(x - HERO.x) / -HS / sq[0], (y - HERO.y) / HS / sq[1]];
  function heroOpts(L, R, ctx, fr, bx) {
    const o = { h: HERO.h, facing: -1, view: 'front', plate: 'street', face: 'grin', shadow: false };
    // two hands at frame points under the squash sq, elbows out and down
    const hands = (n, f, sq, kind) => ({ handN: heroU(n[0], n[1], sq), handF: heroU(f[0], f[1], sq), elbowN: [0.7, 1], elbowF: [-0.7, 1], kindN: kind, kindF: kind, sq });
    // look x is mirrored by facing -1: positive looks to the frame's left
    if (fr < WIND) return Object.assign(o, { pose: 'sill', target: [0, TOP.y0], look: [L.clamp((560 - bx) / 260) * 0.9, 0.75], rig: fr < 2 ? { sq: [1.04, 0.95] } : undefined });
    if (fr < SNATCH) {
      // anticipation, 6 frames on twos: both hands rise into open claws either side of the burger, the body stretches up
      const k = fr < WIND + 2 ? 0.5 : 1;
      const sq = [1 - 0.04 * k, 1 + 0.05 * k];
      return Object.assign(o, { pose: 'sill', look: [0.2, 0.9], rig: hands([L.lerp(465, 425, k), L.lerp(1100, 950, k)], [L.lerp(655, 695, k), L.lerp(1100, 950, k)], sq, 'open') });
    }
    if (fr === SNATCH) {
      // the grab on the beat: the fists come down on the top bun, the body squashed into it
      return Object.assign(o, { pose: 'sill', look: [0.2, 0.9], rig: hands([448, 1040], [572, 1036], [1.07, 0.92], 'fist') });
    }
    if (fr === SNATCH + 1) {
      // the yank: the burger goes down and out over the sill with his fists
      return Object.assign(o, { pose: 'sill', look: [0.2, 0.9], rig: hands([462, 1098], [556, 1094], [1.08, 0.91], 'fist'), hold: () => R.burger(ctx, 507, 1140, { w: BURGER_W, rot: 0.06 }) });
    }
    // the burger is his, below the sill: beaming at the owner; the rebound stretch, the bounce on T 3.0, a blink
    const sq = fr === SNATCH + 2 ? [0.95, 1.06] : fr >= RING && fr < RING + 2 ? [1.04, 0.95] : null;
    return Object.assign(o, { pose: 'stand', look: fr < 20 ? [0.25, 0.5] : [0.45, 0.12], blink: fr === BLINK || fr === BLINK + 1, rig: sq ? { sq } : undefined });
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal, C = L.cast, R = L.props;
      const t = L.clamp(tIn, 0, info.dur);
      const fr = Math.min(35, Math.floor(t * 24 + 1e-6)); // frame in the shot, for the actions on ones
      const bx = 380 + 120 * L.ease.outCubic(L.clamp(L.onTwos(t) / SLIDE)); // the burger on the counter

      // 1 the street
      street(ctx, L, P, R);

      // 2 the hero outside, clipped to the window
      ctx.save();
      ctx.beginPath();
      ctx.rect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);
      ctx.clip();
      C.hero(ctx, HERO.x, HERO.y, heroOpts(L, R, ctx, fr, bx));
      ctx.restore();

      // 3 the inside
      inside(ctx, L, P);

      // 4 on the counter: the drawer shoots out over 3 frames, the register jolts 6 px for 2
      R.phone(ctx, PHONE[0], PHONE[1], { w: 140 });
      const jolt = fr === RING || fr === RING + 1 ? -6 : 0;
      const drawer = fr < RING ? 0 : fr === RING ? 0.4 : fr === RING + 1 ? 0.8 : 1;
      R.register(ctx, REG[0], REG[1] + jolt, { w: 200, drawer });
      if (fr < RING) COINS.forEach(([x, y, seed]) => R.coin(ctx, x, y, { w: COIN_W, spin: 1 / 3, rot: Math.PI / 2, seed }));
      if (fr <= SNATCH) R.burger(ctx, bx, BURGER_Y, { w: BURGER_W });

      // 5 the owner from behind: his right hand works on the counter
      const [hand, sag] = ownerKey(fr, bx);
      C.owner(ctx, OWN.x, OWN.y, { h: OWN.h, view: 'back', pose: 'push', target: hand, ground: INNER, rig: ownerRig(L, sag) });

      // 6 effects on ones: the snatch (2 frames), the coins flicked into the drawer (2), the ka-ching star (2)
      if (fr === SNATCH) {
        L.smear(ctx, [[422, 930], [436, 975], [448, 1016]], { colors: [P.skinKid, P.red], width: 48, seed: sd(30) });
        L.smear(ctx, [[698, 930], [636, 975], [578, 1012]], { colors: [P.skinKid, P.red], width: 48, seed: sd(35) });
      }
      if (fr === SNATCH + 1) L.smear(ctx, [[500, 1000], [502, 1060], [505, 1120]], { colors: [P.bun, P.lettuce, P.patty, P.skinKid], width: 110, seed: sd(31) });
      if (fr === RING) {
        L.smear(ctx, [[612, 1088], [650, 1050], [700, 1026]], { colors: [P.coin, P.skin], width: 60, seed: sd(32) });
        R.coin(ctx, 700, 1024, { w: COIN_W * 0.9, rot: 0.4, spin: 0.3, seed: 1 });
        R.coin(ctx, 724, 1040, { w: COIN_W * 0.9, rot: -0.3, spin: 0.15, seed: 2 });
      }
      if (fr === RING + 1) {
        L.smear(ctx, [[700, 1026], [760, 1000], [816, 1012]], { colors: [P.coin], width: 50, seed: sd(33) });
        R.coin(ctx, 818, 1014, { w: COIN_W * 0.8, rot: 0.9, spin: 0.4, seed: 1 });
        R.coin(ctx, 838, 1030, { w: COIN_W * 0.8, rot: -0.6, spin: 0.25, seed: 2 });
      }
      if (fr === RING || fr === RING + 1) L.impactStar(ctx, 900, 862 + jolt, 58, { seed: sd(34) });
    },
  });
})();

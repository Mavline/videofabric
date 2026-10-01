// 15 turn-back: Crouch, spin, dash. T 26.0 to 27.0 (t = T - 26, frames 0 to 23), street plate (illustrated).
// Storyboard: docs/storyboard.md, "15 turn-back" and table G1. Hard cut in from the owner's close-up (14).
//
// G1 on the same pixels as 01 and 18: the booth, the owner's place in the window, the tag on its strings,
// the hero's stop mark, the ground line, the pavement and the kerb (painted from 01's seeds). Only the
// street behind (the rich one: portico, fountain, clipped bushes, a cypress) and the price ($6.89) differ.
//
// Layers, back to front:
//   1 the rich street, painted once (lib.plate): fieldSky light field, two clouds, the cypress, the portico
//     of four stone columns under its pediment, the fountain, clipped bushes, 01's pavement and kerb, the
//     booth's dark window
//   2 the owner's back layer, clipped to the window
//   3 the booth's front, painted once on a transparent plate (as 01, the price off it)
//   4 the hero's smears (the spin, the stretch of the dash), under the owner's arm
//   5 the owner's front layer: his arm out over the counter with the rejected burger
//   6 the $6.89 tag: rocking 2 degrees on twos, then the gust (up to 8 degrees)
//   7 the exit: the dust cloud at the stop mark, the speed lines
//   8 the hero on the bicycle
//
// Beats (global T, shot frame f; t = f / 24):
//   T 26.0    f 0   frame 0: at the stop mark facing the booth, the coins clutched in his fist, glaring at
//                   the tag; held (the tag rocks)
//   T 26.25   f 6   the crouch on twos: a first squash (f 6), the full coil (f 8), held to the beat
//   T 26.5    f 12  the spin on ones, three drawings: the yank (front wheel up), head-on behind the swirl of
//                   the smear, the other side facing left with the smear's tail
//   T 26.625  f 15  the dash: one stretched drawing at x 100 with five speed lines; the dust cloud bursts at
//                   the stop mark
//   T 26.667  f 16  gone off the left edge; the speed lines linger one frame, the gust reaches the tag
//   T 26.75   f 18  to the end: the dust thins on twos, the tag swings to 8 degrees and back, the owner
//                   blinks twice on twos (f 18 and f 22), still holding out the burger
(function () {
  'use strict';
  const ID = 'turn-back';
  const REF = 'booth-569'; // 01: the booth, the pavement and the kerb come from its seeds
  const DEG = Math.PI / 180;

  // G1 (storyboard): booth front centre on the ground line, tag card top centre, the hero's stop mark
  const G1 = { boothX: 690, ground: 1480, boothW: 580, tagTop: [680, 750], price: '$6.89' };
  // the hero's size comes from the bicycle lib.js draws: G1 wants wheels of radius 80 px (art bible: h 510.6
  // at 47 of 300). bikeUnits reads the bicycle's own anchors in his design units (layer 'none' draws nothing)
  const bikeUnits = (L) => L.props.bike(null, 0, 0, { h: 300, layer: 'none' });
  const STOP = 290; // ground point at the stop mark: wheels at x 150 and 430, radius 80
  const DASH_X = 100; // the stretched dash drawing (storyboard)
  const BEAT = { crouch: 6, coil: 8, spin: 12, dash: 15, gone: 16, blinkA: 18, blinkB: 22 }; // shot frames

  let BOOTH = null; // the booth's anchors, captured while the street plate is painted (a pure function of G1)

  const seedOf = (L, ...k) => L.hash(ID, ...k) & 0x7fffffff;

  // a still object of the street plate: an opaque wash with brush marks and a pencil edge of its own color
  function part(g, L, pts, color, id, o) {
    const seed = seedOf(L, 'part', id);
    L.softWash(g, pts, Object.assign({ color, solid: true, marks: 0.6, rim: 0.12, seed }, o));
    L.pencil(g, pts, { closed: true, base: color, width: 2, seed: seed + 1 });
  }

  // ---------------------------------------------------------------------------
  // 1 the rich street (G1, 15): no ink anywhere, washes and colored pencil
  // ---------------------------------------------------------------------------
  function street(g, L) {
    const P = L.pal;
    const sd = (...k) => seedOf(L, 'street', ...k);
    const rs = (id) => L.hash(REF, 'g1', id) & 0x7fffffff; // 01's seeds
    const rect = (x0, y0, x1, y1, color, id) => part(g, L, L.rectPts(x0, y0, x1 - x0, y1 - y0, Math.max(3, Math.min(16, (x1 - x0) / 4, (y1 - y0) / 4))), color, id);
    const poly = (pts, color, id) => part(g, L, L.densify(pts, 5), color, id);
    const line = (pts, base, id, width = 2) => L.pencil(g, pts, { base, width, seed: sd('line', id) });

    // the light field (art bible 2.3) and two pale clouds, clear of the sign and the tag
    g.fillStyle = P.fieldSky;
    g.fillRect(0, 0, 1080, 1920);
    L.softWash(g, L.blobPts(860, 190, 118, 28, sd('cloud', 1), 0.22), { color: P.paper, alpha: 0.85, soft: 12, marks: 0.4, rim: 0.06, seed: sd('cloud', 2) });
    L.softWash(g, L.blobPts(196, 540, 132, 30, sd('cloud', 3), 0.22), { color: P.paper, alpha: 0.85, soft: 12, marks: 0.4, rim: 0.06, seed: sd('cloud', 4) });
    // the lawn under everything, as 01's meadow
    L.softWash(g, L.rectPts(-20, 1254, 1120, 236, 20), { color: L.mix(P.grass, P.paper, 0.45), solid: true, marks: 0.5, rim: 0, seed: sd('lawn') });

    // the cypress behind the booth's right edge, where 01 has its tree: a tall dark flame
    const cyp = L.mix(P.grass, P.trunk, 0.55);
    const flame = [];
    for (let i = 0; i <= 24; i++) {
      const v = i / 24, y = 572 + v * 920, w = 72 * Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.25)), 0.7);
      flame.push([1012 + w + 4 * Math.sin(i * 1.7), y]);
    }
    for (let i = 24; i >= 0; i--) {
      const v = i / 24, y = 572 + v * 920, w = 72 * Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.25)), 0.7);
      flame.push([1012 - w - 4 * Math.sin(i * 2.3), y]);
    }
    part(g, L, flame, cyp, 'cypress');
    for (let i = 0; i < 7; i++) {
      const y = 680 + i * 110, w = 34 + 10 * (i % 3);
      line([[1012 - w, y + 30], [1006, y], [1012 + w * 0.8, y + 26]], cyp, 'cyp' + i, 1.8);
    }

    // the portico: cityPastel wall behind four stone columns, x 20 to 380, under a pediment y 690 to 780
    rect(-20, 780, 404, 1482, P.cityPastel, 'wall');
    // between the columns: two tall windows and the door with a fanlight
    for (const [cx, id] of [[100, 'winL'], [300, 'winR']]) {
      rect(cx - 30, 880, cx + 30, 896, P.stone, id + 'lintel');
      rect(cx - 24, 896, cx + 24, 1090, P.waterTop, id);
      line([[cx, 900], [cx, 1086]], P.waterTop, id + 'bar');
      line([[cx - 22, 966], [cx + 22, 966]], P.waterTop, id + 'rail');
      rect(cx - 30, 1090, cx + 30, 1100, P.stone, id + 'sill');
    }
    rect(172, 1170, 228, 1482, P.trunk, 'door');
    poly([[170, 1170], [172, 1150], [184, 1136], [200, 1131], [216, 1136], [228, 1150], [230, 1170]], P.waterTop, 'fan');
    line([[200, 1190], [200, 1470]], P.trunk, 'doorsplit');
    // the columns: base, fluted shaft, capital
    [50, 150, 250, 350].forEach((cx, i) => {
      poly([[cx - 21, 822], [cx + 21, 822], [cx + 23, 1462], [cx - 23, 1462]], P.stone, 'shaft' + i);
      line([[cx - 8, 832], [cx - 9, 1452]], P.stone, 'flute' + i + 'a');
      line([[cx + 8, 832], [cx + 9, 1452]], P.stone, 'flute' + i + 'b');
      rect(cx - 31, 806, cx + 31, 822, P.stone, 'cap' + i);
      rect(cx - 31, 1460, cx + 31, 1482, P.stone, 'base' + i);
    });
    // entablature and pediment with a cityPastel tympanum and an oculus
    rect(-20, 780, 412, 806, P.stone, 'entab');
    line([[-16, 794], [408, 794]], P.stone, 'entabline');
    poly([[-20, 782], [196, 690], [412, 782]], P.stone, 'pediment');
    poly([[40, 772], [196, 706], [352, 772]], P.cityPastel, 'tympanum');
    part(g, L, L.ellipsePts(196, 748, 16, 16, 28), P.waterTop, 'oculus');

    // the fountain in front of the portico: basin x 60 to 340, y 1330 to 1480, jets up to y 1200
    rect(60, 1346, 340, 1482, P.stone, 'basin');
    line([[64, 1404], [336, 1404]], P.stone, 'basinline');
    part(g, L, L.ellipsePts(200, 1342, 146, 16, 48), L.mix(P.stone, P.paper, 0.45), 'rim');
    part(g, L, L.ellipsePts(200, 1341, 128, 9, 40), P.waterTop, 'pool');
    // the plume (water may take a gradient, art bible 4.2), and the jets falling back into the basin
    const plume = L.smoothPts([[186, 1340], [190, 1262], [196, 1214], [200, 1200], [204, 1214], [210, 1262], [214, 1340]], true, 4);
    const grad = g.createLinearGradient(0, 1196, 0, 1342);
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
    jet([[200, 1338], [200, 1260], [200, 1204]], 0, 2.6);
    jet([[200, 1206], [168, 1204], [128, 1232], [100, 1290], [92, 1336]], 1, 2.4);
    jet([[200, 1206], [232, 1204], [272, 1232], [300, 1290], [308, 1336]], 2, 2.4);
    jet([[200, 1220], [178, 1226], [150, 1262], [138, 1330]], 3, 1.8, 0.7);
    jet([[200, 1220], [222, 1226], [250, 1262], [262, 1330]], 4, 1.8, 0.7);

    // round clipped bushes in grass: one at the left edge, one at the cypress's foot
    for (const [cx, cy, rx, ry, id] of [[18, 1420, 72, 62, 'bushL'], [1040, 1418, 78, 66, 'bushR']]) {
      part(g, L, L.blobPts(cx, cy, rx, ry, sd(id), 0.08), P.grass, id);
      line([[cx - rx * 0.5, cy - ry * 0.1], [cx - rx * 0.2, cy - ry * 0.35], [cx + rx * 0.2, cy - ry * 0.3]], P.grass, id + 'leaf', 1.8);
    }

    // 01's pavement from the ground line, the kerb at y 1600, the road under it (01's seeds)
    L.softWash(g, L.rectPts(-20, 1480, 1120, 140, 20), { color: P.cityPastel, solid: true, marks: 0.6, rim: 0, seed: rs(70) });
    L.softWash(g, L.rectPts(-20, 1600, 1120, 340, 20), { color: L.mix(P.cityPastel, P.hillsFar, 0.45), solid: true, marks: 0.6, rim: 0, seed: rs(71) });
    L.pencil(g, [[-10, 1481], [1090, 1479]], { base: P.cityPastel, width: 2.4, seed: rs(72) });
    L.pencil(g, [[-10, 1600], [1090, 1602]], { base: P.cityPastel, width: 3, seed: rs(73) });
    // the booth's dark window behind the owner
    BOOTH = L.props.booth(g, G1.boothX, G1.ground, { w: G1.boothW, layer: 'back' });
  }

  // ---------------------------------------------------------------------------
  // the owner: facing the street, the rejected burger held out over the counter
  // ---------------------------------------------------------------------------
  // booth.owner stands a right-facing owner with his head on G1's (710, 1105); facing left, his ground point
  // moves by twice the head's offset (as in 01). The serve pose's hand is lifted and pushed out of the window
  // so the burger hangs over the counter at BURGER, toward the hero; the fist sits under its right edge.
  const BURGER = [526, 1195]; // frame px: just outside the window's left edge, above the shelf (y 1250)
  function ownerOpts(b, f) {
    const h = b.ownerH, s = h / 400; // his design units: standing height 400
    const x = b.owner[0] + 60 * s, y = b.owner[1];
    const unit = (px, py) => [(x - px) / s, (py - y) / s]; // frame px to his design units, facing left
    return {
      x, y,
      o: {
        h, facing: -1, pose: 'serve',
        face: f >= BEAT.gone ? 'surprised' : 'tired',
        blink: (f >= BEAT.blinkA && f < BEAT.blinkA + 2) || (f >= BEAT.blinkB && f < BEAT.blinkB + 2),
        rig: { hold: unit(BURGER[0], BURGER[1]), handN: unit(BURGER[0] + 25, BURGER[1] + 22) },
      },
    };
  }

  // the tag: 2 degrees on twos on the global clock as in 01, then the gust of the dash on twos (degrees)
  const GUST = [3, 3, 8, 8, -5, -5, 2.5, 2.5]; // from frame BEAT.gone
  function tagSwing(L, T, f) {
    if (f >= BEAT.gone) return GUST[Math.min(GUST.length - 1, f - BEAT.gone)] * DEG;
    return 2 * DEG * Math.sin(2 * Math.PI * L.onTwos(T));
  }

  // ---------------------------------------------------------------------------
  // the hero, one drawing per frame
  // ---------------------------------------------------------------------------
  // a squash of the body over the bicycle (the rig's sq scales the body joints about his ground point), with
  // the hands kept on the grips
  const squash = (B, sx, sy) => ({ sq: [sx, sy], handN: [B.grip[0] / sx, B.grip[1] / sy], handF: [(B.grip[0] - 3) / sx, (B.grip[1] - 1) / sy] });

  function heroAt(t, f, B, hx, hy) {
    if (f < BEAT.crouch) {
      // the glare, held: the coins clutched at his chest, eyes on the tag
      return { x: STOP, o: { pose: 'coins', face: 'glare', look: [0.55, -0.85], target: [hx(40), hy(-128)] } };
    }
    if (f < BEAT.spin) {
      // the crouch on twos: a first squash, then the full coil held to the beat
      const sy = f < BEAT.coil ? 0.94 : 0.88;
      return { x: STOP, o: { pose: 'crouch', look: [0.7, -0.6], rig: squash(B, 1.03, sy) } };
    }
    if (f === BEAT.spin) {
      // the yank: the bars pulled up, the front wheel off the ground about the rear tyre
      return { x: STOP, o: { pose: 'spin', k: 0, ones: true, rot: -0.12, rig: Object.assign({ pivot: [B.axleRear[0], 0] }, squash(B, 1.03, 0.9)) } };
    }
    if (f === BEAT.spin + 1) return { x: STOP, o: { pose: 'spin', k: 0.5, ones: true } }; // head-on
    if (f === BEAT.spin + 2) return { x: STOP, o: { pose: 'spin', k: 1, ones: true, face: 'determined' } }; // facing left
    if (f === BEAT.dash) {
      // the stretched dash drawing, on ones
      return { x: DASH_X, o: { pose: 'dash', facing: -1, t, ones: true, face: 'determined', look: [1, 0], rig: squash(B, 1.25, 0.92) } };
    }
    return null; // gone off the left edge
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal;
      const t = L.clamp(tIn, 0, info.dur);
      const f = Math.min(23, Math.floor(t * 24 + 1e-6)); // shot frame, for the moves on ones
      const sd = (...k) => seedOf(L, ...k);
      const B = bikeUnits(L);
      const HS = 80 / B.wheelR; // his design units to px: wheel radius 80 (G1)
      const hx = (u) => STOP + u * HS; // design units to frame px at the stop mark, facing right
      const hy = (v) => G1.ground + v * HS;

      // 1 the street
      L.plate(ctx, ID + '|street', (g) => street(g, L));
      const b = BOOTH;

      // 2-3 the owner's back layer in the window, the booth's front
      const ow = ownerOpts(b, f);
      const w = b.window;
      ctx.save();
      ctx.beginPath();
      ctx.rect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0);
      ctx.clip();
      L.cast.owner(ctx, ow.x, ow.y, Object.assign({ layer: 'back' }, ow.o));
      ctx.restore();
      L.plate(ctx, ID + '|booth-front', (g) => L.props.booth(g, G1.boothX, G1.ground, { w: G1.boothW, layer: 'front', price: false }));

      // 4 the hero's smears: the spin and the stretch of the dash, his own colors along his path, faint at the
      // tail; under the owner's arm, so the rejected burger stays clean
      const heroCols = [P.green, P.slate, P.red, P.skinKid, P.cap]; // bottom to top on a right-to-left path
      if (f === BEAT.spin + 1) {
        L.smear(ctx, [[hx(98), hy(-160)], [hx(70), hy(-112)], [hx(0), hy(-96)], [hx(-70), hy(-112)], [hx(-98), hy(-160)]], { colors: heroCols, width: 210, strands: 5, seed: sd('smear', 1) });
      } else if (f === BEAT.spin + 2) {
        L.smear(ctx, [[hx(100), hy(-110)], [hx(80), hy(-100)], [hx(60), hy(-95)]], { colors: heroCols, width: 150, strands: 5, alpha: 0.6, seed: sd('smear', 2) });
      } else if (f === BEAT.dash) {
        L.smear(ctx, [[470, 1300], [380, 1290], [270, 1280]], { colors: heroCols, width: 240, strands: 5, seed: sd('smear', 3) });
      }

      // 5 the owner's front layer: his arm out over the counter with the burger
      L.cast.owner(ctx, ow.x, ow.y, Object.assign({ layer: 'front' }, ow.o));

      // 6 the tag
      L.props.priceTag(ctx, G1.tagTop[0], G1.tagTop[1], { w: 280, h: 150, drop: 30, hang: 'corners', pivot: 'strings', size: 100, baseline: 115, price: G1.price, swing: tagSwing(L, info.T, f) });

      // 7 the exit: the dust cloud at the stop mark (kicked back behind the rear tyre, thinning on twos) and
      // five speed lines along his path
      if (f >= BEAT.dash) {
        const age = f === BEAT.dash ? 0 : 1 + Math.floor((f - BEAT.gone) / 2);
        const p = [0.08, 0.26, 0.42, 0.58, 0.74][Math.min(4, age)];
        L.dust(ctx, 452, 1452, { r: 96, p, dir: -0.28, n: 5, seed: sd('dust') });
        L.dust(ctx, 340, 1468, { r: 60, p, dir: 0.05, n: 3, seed: sd('dust', 2) });
      }
      if (f === BEAT.dash) L.speedLines(ctx, 320, 1345, Math.PI, { n: 5, spread: 190, len: [110, 220], gap: 14, width: 6, seed: sd('speed', 0) });
      else if (f === BEAT.gone) L.speedLines(ctx, -40, 1290, Math.PI, { n: 5, spread: 280, len: [220, 380], gap: 10, width: 5, alpha: 0.7, seed: sd('speed', 1) });

      // 8 the hero
      const hero = heroAt(t, f, B, hx, hy);
      if (hero) L.cast.hero(ctx, hero.x, G1.ground, Object.assign({ h: 300 * HS, facing: 1 }, hero.o));
    },
  });
})();

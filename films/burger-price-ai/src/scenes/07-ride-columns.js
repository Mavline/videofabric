// 07 ride-columns: Mile 2, columns. T 11.5 to 13.0 (t = T - 11.5, 36 frames), illustrated: the street plate.
// The camera stands; the hero crosses left to right past the richest street of the trip: a mansion with a
// portico of four stone columns under a pediment whose top is at y 562, cityPastel walls, a long lawn, a
// stone urn on a plinth, a tall iron gate in slate pencil. The street's frame is shared with 05 and 06: the
// same far hills, the yard line y 1145 and its lawn, the G1 ground line y 1480 with the pavement and the
// kerb at y 1600, the G6 counter at the upper left.
//   T 11.5   frame 0: front wheel centre at x 40, riding on twos; the counter pops 1.75
//   T 12.0   bar 7 downbeat: the counter pops 2 (the bell); he sniffs twice, his head lifting, and his eyes
//            slide right toward something ahead (12.0 to 12.167); he grins (12.167 to 12.333); he crouches
//            over the bars with the grin, the pedals still (12.333 to 12.5)
//   T 12.5   beat: he stands on the pedals and sprints on ones, 1100 px/s on the beat and still speeding up
//            (6000 px/s/s), six speed lines, a puff of dust at the launch, a smear for the last frames; the
//            back of his rear tyre clears the right edge at 12.833
//   T 12.833 to 13.0: the empty mansion holds
// Layers, back to front:
//   1 the plate, drawn once and cached: the light field, far hills, the lawn, the mansion, the urn on its
//     plinth, the gate, the pavement and its kerb
//   2 behind the hero: the launch dust, the speed lines, the smear
//   3 the hero on the bicycle
//   4 the G6 mile counter: 1.75 (T 11.5), 2 (T 12.0)
(function () {
  'use strict';
  const ID = 'ride-columns';
  const REF = 'ride-fence'; // 05: the hills, the lawn and the pavement are painted from its seeds, so they hold across the cuts

  // G6, the mile counter of 05, 06, 07 and 16. Canonical: those shots copy this function verbatim.
  // value: the miles shown, a number (0, 0.25 ... 2); popAge: seconds since the value changed, or null
  // for no pop. A change pops on ones over 3 frames with an 8 percent overshoot. A titleSpot blob
  // centred (265, 300), 390 x 140; on it the value and "mi" in ink 'note' letters, baseline y 330, left
  // edge x 100. Cap height 70 as far as the G8 box x 100..440 allows: the widest value sets one size for
  // every value, so the line never changes size ('note' is wide: the cap height lands near 64).
  function drawMileCounter(ctx, L, value, popAge) {
    const P = L.pal;
    L.spot(ctx, 265, 300, 195, 70, { seed: 6 });
    // letter seed 52: no 'i' of any value 0..2 drops below the line (seed 6 turned '1.25 mi' into 'mj')
    const o = { face: 'note', color: P.ink, seed: 52, size: 70 / 0.72 }; // digits stand 0.72 of the size
    const widest = Math.max(...['0.25', '0.75', '1.25', '1.75'].map((v) => L.letters(ctx, v + ' mi', 0, 0, Object.assign({}, o, { measure: true })).w));
    o.size = Math.min(o.size, (o.size * 340) / widest);
    const str = value + ' mi';
    const f = popAge == null ? 3 : Math.floor(popAge * 24 + 1e-6);
    const k = f >= 0 && f < 3 ? [0.72, 1.08, 1][f] : 1;
    const b = L.letters(ctx, str, 100, 330, Object.assign({}, o, { measure: true }));
    const cx = (b.x0 + b.x1) / 2, cy = 295;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    ctx.translate(-cx, -cy);
    L.letters(ctx, str, 100, 330, o);
    ctx.restore();
  }

  // the hero's measures come from the cast's own anchors, so the lib may refine his proportions: one probe
  // at height 300 into a 1 px canvas, cached (a pure function of the lib), gives per unit of height the wheel
  // radius, the front axle and the head, each from his ground point
  const heroUnit = (L) => L.cached(ID + '|hero-unit', () => {
    const c = FILM.makeCanvas ? FILM.makeCanvas(1, 1) : document.createElement('canvas');
    c.width = c.height = 1;
    const a = L.cast.hero(c.getContext('2d'), 0, 0, { h: 300, pose: 'ride', phase: 0, shadow: false });
    return { wheelR: a.wheelR / 300, front: a.axleFront[0] / 300, head: [a.head[0] / 300, a.head[1] / 300] };
  });

  const WHEEL_R = 80; // G1: the hero at the size where his wheels have radius 80 (art bible 8, 10.1)
  const TAIL = 360; // G1: the front wheel centre to the back of the rear tyre (wheelbase 280, radius 80)
  const GROUND = 1480; // G1 ground line, the pavement's top edge
  const YARD = 1145; // 05's yard line: the mansion stands back from the street on it, behind the long lawn
  const COUNTER = [[0, 1.75], [0.5, 2]]; // shot-local t, miles; 1.75 is a change from 06's 1.5, so it pops
  const B_TWO = 0.5; // T 12.0
  const B_DASH = 1.0; // T 12.5
  // the sprint: from the beat the front wheel runs on ones at 1100 px/s and speeds up so the back of the
  // rear tyre reaches x 1080 eight frames after the beat (at 1100 px/s flat it would still be in at the cut)
  const X_DASH = 40 + 700 * B_DASH; // 740
  const OUT_F = 8;
  const DASH_A = (2 * (1080 + TAIL - X_DASH - (1100 * OUT_F) / 24)) / Math.pow(OUT_F / 24, 2); // 6000 px/s/s

  const frameOf = (t) => Math.floor(t * 24 + 1e-6);
  // the front wheel centre at shot time t: 40 + 700 t on twos, then the sprint on ones
  function frontX(L, t) {
    if (t + 1e-6 < B_DASH) return 40 + 700 * L.onTwos(t);
    const u = frameOf(t - B_DASH) / 24;
    return X_DASH + 1100 * u + 0.5 * DASH_A * u * u;
  }

  function plate(g, L) {
    const P = L.pal;
    const sd = (...k) => L.hash(ID, ...k) & 0x7fffffff;
    const rs = (...k) => L.hash(REF, ...k) & 0x7fffffff;
    let n = 0;
    // a part of the picture: a solid wash with brush marks, edged in pencil of its own color made darker
    const wash = (pts, color) => {
      n++;
      L.softWash(g, pts, { color, solid: true, marks: 0.6, rim: 0.12, seed: sd('w', n) });
      L.pencil(g, pts, { closed: true, base: color, width: 2, seed: sd('p', n) });
    };
    const rect = (x0, y0, x1, y1, color) => wash(L.rectPts(x0, y0, x1 - x0, y1 - y0, Math.max(3, Math.min(20, (x1 - x0) / 4, (y1 - y0) / 4))), color);
    const poly = (pts, color) => wash(L.densify(pts, 5), color);
    const line = (pts, base, width = 2) => L.pencil(g, pts, { base, width, seed: sd('l', ++n) });

    // the street's light field, in its pale tint (art bible 2.3)
    g.fillStyle = P.fieldSky;
    g.fillRect(0, 0, 1080, 1920);
    // far hills and the lawn: 05's, to the pixel and the seed
    const hills = [[-20, 1060], [120, 1012], [300, 1060], [470, 1002], [650, 1052], [820, 996], [1000, 1046], [1100, 1020]];
    L.softWash(g, L.densify(hills.concat([[1100, 1200], [-20, 1200]]), 12), { color: P.hillsFar, soft: 10, seed: rs('hills') });
    const lawn = [[-20, YARD - 6], [260, YARD - 12], [560, YARD - 4], [820, YARD - 14], [1100, YARD - 6]];
    L.softWash(g, L.densify(lawn.concat([[1100, GROUND + 6], [-20, GROUND + 6]]), 12), { color: P.grass, alpha: 0.7, soft: 12, seed: rs('lawn') });

    // the mansion on the yard line: a hip roof, a cornice, two storeys of wings, a portico in the middle
    const MX = 520;
    poly([[140, 702], [232, 638], [808, 638], [900, 702]], P.hillsFar);
    rect(130, 694, 910, 716, P.stone);
    rect(150, 716, 890, YARD + 2, P.cityPastel);
    rect(150, 880, 322, 892, P.stone); // string courses
    rect(718, 880, 890, 892, P.stone);
    const win = (cx, y0, y1, w) => {
      rect(cx - w / 2 - 10, y0 - 13, cx + w / 2 + 10, y0, P.stone); // lintel
      rect(cx - w / 2, y0, cx + w / 2, y1, P.waterTop); // glass
      rect(cx - w / 2 - 6, y1, cx + w / 2 + 6, y1 + 9, P.stone); // sill
      line([[cx, y0 + 4], [cx, y1 - 4]], P.cityPastel);
      line([[cx - w / 2 + 4, y0 + (y1 - y0) * 0.36], [cx + w / 2 - 4, y0 + (y1 - y0) * 0.36]], P.cityPastel);
    };
    for (const wx of [198, 272, 768, 842]) {
      win(wx, 764, 852, 52);
      win(wx, 932, 1060, 52);
    }
    rect(140, 1108, 900, YARD + 2, P.stone); // base course
    // the portico: the shaded recess with a door and two tall windows, four columns, entablature, pediment
    rect(322, 728, 718, 1080, P.hillsFar);
    rect(494, 880, 546, 1080, P.trunk);
    poly([[492, 880], [494, 864], [503, 854], [520, 850], [537, 854], [546, 864], [548, 880]], P.waterTop); // fanlight
    for (const wx of [415, 625]) {
      rect(wx - 23, 770, wx + 23, 860, P.waterTop);
      rect(wx - 23, 932, wx + 23, 1050, P.waterTop);
    }
    for (const cx of [MX - 157.5, MX - 52.5, MX + 52.5, MX + 157.5]) {
      rect(cx - 30, 1062, cx + 30, 1080, P.stone); // base
      poly([[cx - 21, 744], [cx + 21, 744], [cx + 24, 1062], [cx - 24, 1062]], P.stone); // shaft
      line([[cx - 8, 754], [cx - 9, 1052]], P.stone);
      line([[cx + 8, 754], [cx + 9, 1052]], P.stone);
      rect(cx - 31, 728, cx + 31, 744, P.stone); // capital
    }
    rect(312, 690, 728, 728, P.stone); // entablature
    line([[318, 709], [722, 709]], P.stone);
    poly([[298, 692], [MX, 562], [742, 692]], P.stone); // pediment
    poly([[340, 684], [MX, 586], [700, 684]], P.cityPastel); // tympanum
    wash(L.ellipsePts(MX, 646, 20, 20, 32), P.waterTop); // oculus
    rect(300, 1080, 740, 1100, P.stone); // the steps down to the lawn
    rect(284, 1100, 756, 1122, P.stone);
    rect(268, 1122, 772, YARD + 2, P.stone);

    // the stone urn on its plinth at the left end of the lawn, a clipped plant in it
    rect(33, 1282, 117, 1300, P.stone);
    rect(43, 1196, 107, 1282, P.stone);
    rect(33, 1180, 117, 1196, P.stone);
    poly([[61, 1180], [89, 1180], [84, 1162], [66, 1162]], P.stone);
    wash([[47, 1096], [103, 1096], [111, 1116], [102, 1142], [84, 1162], [66, 1162], [48, 1142], [39, 1116]], P.stone);
    rect(39, 1082, 111, 1096, P.stone);
    line([[43, 1106], [29, 1102], [29, 1120], [42, 1124]], P.stone, 2.4);
    line([[107, 1106], [121, 1102], [121, 1120], [108, 1124]], P.stone, 2.4);
    wash(L.blobPts(75, 1064, 42, 22, sd('plant'), 0.22), P.grass);

    // the tall iron gate at the right: a stone pillar with a ball on it, wrought-iron bars in slate pencil
    rect(900, 1452, 970, GROUND + 4, P.stone);
    rect(910, 962, 960, 1452, P.stone);
    rect(900, 944, 970, 962, P.stone);
    rect(925, 932, 945, 944, P.stone);
    wash(L.ellipsePts(935, 906, 28, 28, 32), P.stone);
    const top = (x) => 1062 - (x - 976) * 0.6;
    for (let x = 980; x <= 1090; x += 20) {
      L.pencil(g, [[x, GROUND - 2], [x, top(x)]], { color: P.slate, width: 3, seed: sd('bar', x), double: false });
      L.pencil(g, [[x - 6, top(x) + 10], [x, top(x) - 10], [x + 6, top(x) + 10]], { color: P.slate, width: 2.6, seed: sd('tip', x), double: false });
    }
    for (const [dy, w] of [[34, 3.4], [52, 2.6]]) L.pencil(g, [[966, top(966) + dy], [1090, top(1090) + dy]], { color: P.slate, width: w, seed: sd('rail', dy), double: false });
    L.pencil(g, [[966, 1270], [1090, 1270]], { color: P.slate, width: 3, seed: sd('rail', 2) });
    L.pencil(g, [[966, 1440], [1090, 1440]], { color: P.slate, width: 3.4, seed: sd('rail', 3) });

    // the pavement from the ground line, and its kerb (G1): 05's, to the pixel and the seed
    L.softWash(g, L.rectPts(-20, GROUND, 1120, 460, 12), { color: P.cityPastel, soft: 2, solid: true, marks: 0.6, seed: rs('pavement') });
    L.pencil(g, [[0, 1600], [1080, 1602]], { base: P.cityPastel, width: 3, seed: rs('kerb') });
  }

  // the hero's acting at shot time t; k is the drawing on twos, u his measures (heroUnit)
  function heroPose(t, k, u) {
    // the sniff lifts his head off its riding place by a few design units, nose up
    const lift = (dx, dy) => ({ head: [u.head[0] * 300 + dx, u.head[1] * 300 + dy] });
    const ride = (o) => Object.assign({ pose: 'ride', t, cadence: 3, cycle: 4 }, o);
    if (t + 1e-6 < B_TWO) return ride({});
    if (k === 6) return ride({ face: 'sniff', tilt: -0.14, look: [0.5, -0.6], rig: lift(-1, -2) }); // T 12.0: the sniff
    if (k === 7) return ride({ face: 'sniff', tilt: -0.28, look: [1, -0.4], rig: lift(-2, -4) }); // higher; the eyes slide right
    if (k === 8 || k === 9) return ride({ face: 'grin', look: [1, 0] }); // T 12.167: he grins at what is ahead
    if (t + 1e-6 < B_DASH) return { pose: 'crouch', phase: 2.5, face: 'grin', look: [1, 0.1] }; // T 12.333: anticipation, pedals still
    return { pose: 'dash', t, ones: true, cadence: 6, cycle: 4, look: [1, 0] }; // T 12.5: the sprint, on ones
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal;
      const t = L.clamp(tIn, 0, info.dur);
      const k = Math.round(L.onTwos(t) * 12); // the drawing on twos
      const fd = frameOf(t) - 24; // frames since the beat of the sprint

      // 1 the plate
      L.plate(ctx, ID + '|plate|4', (g) => plate(g, L));

      // 2 behind the hero: his ground point sits behind the front wheel centre by the axle's offset
      const u = heroUnit(L);
      const h = WHEEL_R / u.wheelR;
      const xf = frontX(L, t);
      const x = xf - u.front * h;
      if (fd < 0) L.speedLines(ctx, x - 100, 1250, 0, { n: 3, spread: 120, len: [70, 140], gap: 14, width: 5, seed: 5 + (k % 2) });
      else {
        // the launch: dust kicked up behind the rear tyre where it stood on the beat, grown and gone in 7 frames
        if (fd < 7) L.dust(ctx, X_DASH - 300, GROUND - 16, { r: 56, p: (fd + 0.5) / 7, seed: L.hash(ID, 'dust') });
        // doubled speed lines, a new drawing every frame
        if (fd < OUT_F) L.speedLines(ctx, x - 100, 1260, 0, { n: 6, spread: 250, len: [150, 300], gap: 12, width: 6, seed: L.hash(ID, 'dash', fd) });
        // the smear: his own colors along the path he just covered, faint at the tail
        if (fd >= 4 && fd <= OUT_F) {
          const len = 3.6 * (xf - frontX(L, t - 1 / 24));
          L.smear(ctx, [[x - 30 - len, 1250], [x - 30 - len * 0.66, 1240], [x - 30 - len * 0.33, 1226], [x - 30, 1214]], { colors: [P.red, P.cap, P.skinKid, P.slate, P.green], width: 96, strands: 5, seed: L.hash(ID, 'smear', fd) });
        }
      }

      // 3 the hero, while any of him is in the picture
      // ponytail: the storyboard's 4 px body bob per stroke (05, 'as before') waits for a bob option on the ride pose (asked of the library)
      if (xf - TAIL < 1080) L.cast.hero(ctx, x, GROUND, Object.assign({ h, ground: P.cityPastel }, heroPose(t, k, u)));

      // 4 the mile counter
      let i = 0;
      while (i + 1 < COUNTER.length && t + 1e-6 >= COUNTER[i + 1][0]) i++;
      drawMileCounter(ctx, L, COUNTER[i][1], t - COUNTER[i][0]);
    },
  });
})();

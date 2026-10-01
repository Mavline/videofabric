// 07 ride-columns: Mile 2, columns. T 11.5 to 13.0 (t = T - 11.5, 36 frames), illustrated: the street plate.
// The camera stands; the hero crosses left to right past the richest street of the trip: a mansion with a
// portico of four stone columns under a pediment whose top is at y 562, cityPastel walls, a long lawn, a
// stone urn on a plinth, a tall iron gate in slate pencil. The street's frame is shared with 05 and 06: the
// same far hills, the yard line y 1145 and its lawn, the G1 ground line y 1480 with the pavement and the
// kerb at y 1600, the G6 counter at the upper left.
//   T 11.5   frame 0: front wheel centre at x 40, riding at 760 px/s on twos (wheel radius 107, the body
//            bobbing 4 px a stroke, three speed lines behind him); the counter pops 1.75
//   T 12.0   bar 7 downbeat: the counter pops 2 (the bell); he sniffs twice, his head lifting, and his eyes
//            slide right toward something ahead (12.0 to 12.167); he grins (12.167 to 12.333); he crouches
//            over the bars with the grin, the pedals still (12.333 to 12.5)
//   T 12.5   beat: he stands on the pedals and sprints on ones, 1100 px/s on the beat and still speeding up
//            so the back of his rear tyre clears the right edge at 12.833; six speed lines, a puff of dust at
//            the launch, a smear for the last frames, all sized in his height
//   T 12.833 to 13.0: the empty mansion holds
// Layers, back to front:
//   1 the plate, drawn once and cached: the light field, two pale clouds, far hills with a row of small trees,
//     the lawn (05's, to the pixel and the seed), the mansion, the urn on its plinth, the gate, the pavement
//     and its kerb
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
  // every value, so the line never changes size ('note' is wide: the cap height lands near 64). Letter seed 52
  // with jitter 0.35: every 'i' stands on the line and no digit rides up like an exponent.
  function drawMileCounter(ctx, L, value, popAge) {
    const P = L.pal;
    L.spot(ctx, 265, 300, 195, 70, { seed: 6 });
    const o = { face: 'note', color: P.ink, seed: 52, jitter: 0.35, size: 70 / 0.72 }; // digits stand 0.72 of the size
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

  // The ride shots' hero (05, 06, 07, 16; canonical here, those shots copy heroUnit and speedTrail verbatim).
  // heroUnit: his riding proportions per unit of height, read once from his anchors, so no part of him is
  // hard-coded and the library may refine the body and the bicycle. Points are relative to his ground point.
  const heroUnit = (L) => L.cached(ID + '|hero-unit', () => {
    const c = FILM.makeCanvas ? FILM.makeCanvas(1, 1) : document.createElement('canvas');
    c.width = c.height = 1;
    const a = L.cast.hero(c.getContext('2d'), 0, 0, { h: 300, pose: 'ride', phase: 0, shadow: false });
    const u = (p) => [p[0] / 300, p[1] / 300];
    return { wheelR: a.wheelR / 300, front: a.axleFront[0] / 300, head: u(a.head), headR: a.headR / 300, rear: u(a.axleRear), seat: u(a.seat), chest: u(a.chest) };
  });
  // speedTrail: three speed lines on twos, thin tapering strokes 60 to 90 px long in pavement grey at half
  // opacity, 12 to 24 px behind the rider's back (two thirds of a head behind the chest), the saddle and the
  // rear tyre, at their heights. (x, y) the hero's ground point, h his height, k the drawing on twos.
  function speedTrail(ctx, L, x, y, h, u, k) {
    const at = (p, dx) => [x + (p[0] + dx) * h, y + p[1] * h];
    [at(u.chest, -0.65 * u.headR), at(u.seat, -0.4 * u.wheelR), at(u.rear, -u.wheelR)].forEach((p, i) =>
      L.speedLines(ctx, p[0], p[1], 0, { n: 1, spread: 0, len: [60, 90], gap: 12, width: 4, alpha: 0.5, seed: 21 + i * 3 + (k % 3) }));
  }

  const WHEEL_R = 107; // the ride shots' hero (05, 06, 07, 16): the size that gives his wheels this radius
  const GROUND = 1480; // G1 ground line, the pavement's top edge
  const YARD = 1145; // 05's yard line: the mansion stands back from the street on it, behind the long lawn
  const COUNTER = [[0, 1.75], [0.5, 2]]; // shot-local t, miles; 1.75 is a change from 06's 1.5, so it pops
  const B_TWO = 0.5; // T 12.0
  const B_DASH = 1.0; // T 12.5
  // the sprint: from the beat the front wheel runs on ones at 1100 px/s and speeds up so the back of the
  // rear tyre (tail px behind the front wheel centre) reaches x 1080 eight frames after the beat, T 12.833
  // (at 1100 px/s flat it would still be in the picture at the cut)
  const RIDE_V = 760; // px/s before the sprint, on twos, in every ride shot (the lead, after the critique)
  const X_DASH = 40 + RIDE_V * B_DASH; // 800
  const OUT_F = 8;

  const frameOf = (t) => Math.floor(t * 24 + 1e-6);
  // the front wheel centre at shot time t: 40 + 760 t on twos, then the sprint on ones
  function frontX(L, t, tail) {
    if (t + 1e-6 < B_DASH) return 40 + RIDE_V * L.onTwos(t);
    const out = OUT_F / 24;
    const a = (2 * (1080 + tail - X_DASH - 1100 * out)) / (out * out);
    const u = frameOf(t - B_DASH) / 24;
    return X_DASH + 1100 * u + 0.5 * a * u * u;
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

    g.fillStyle = P.fieldSky; // the scene's light field (art bible 2.3, 4.2)
    g.fillRect(0, 0, 1080, 1920);
    // two pale clouds
    [[800, 520, 140, 40], [420, 700, 110, 32]].forEach(([cx, cy, rx, ry], i) =>
      L.softWash(g, L.blobPts(cx, cy, rx, ry, rs('cloud', i), 0.2), { color: P.paper, alpha: 0.85, soft: 16, marks: 0.3, seed: rs('cloud', i, 2) }));
    // far hills, pale and cool, seen between the houses, with a row of small trees on their slopes, paler and
    // cooler than the near grass (art bible 2.3, depth) and below the roofs
    const hills = [[-20, 1060], [120, 1012], [300, 1060], [470, 1002], [650, 1052], [820, 996], [1000, 1046], [1100, 1020]];
    L.softWash(g, L.densify(hills.concat([[1100, 1200], [-20, 1200]]), 12), { color: P.hillsFar, soft: 10, seed: rs('hills') });
    const hillY = (x) => {
      let i = 1;
      while (i < hills.length - 1 && x > hills[i][0]) i++;
      const [x0, y0] = hills[i - 1], [x1, y1] = hills[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    };
    const far = L.mix(P.grass, P.hillsFar, 0.5);
    for (let i = 0, x = 14; x < 1080; x += 30 + ((i * 37) % 23), i++) {
      const r = 10 + ((i * 7) % 6), base = hillY(x) + 24;
      L.softWash(g, L.blobPts(x, base - r, r * 0.9, r * 1.2, rs('far', i), 0.18, 20), { color: far, soft: 3, marks: 0, rim: 0.15, seed: rs('far', i, 2) });
    }
    // the lawn of the front yards, from the houses' line down behind the fence
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

  // the hero's acting at shot time t; k is the drawing on twos, u his measures (heroUnit), h his height
  function heroPose(t, k, u, h) {
    const bob = k % 2 ? 0 : 4; // px, down on the push of each stroke (as in 05)
    // the sniff lifts his head off its riding place (sunk by the bob) by a few design units, nose up
    const lift = (dx, dy) => ({ head: [u.head[0] * 300 + dx, u.head[1] * 300 + dy + (bob * 300) / h] });
    const ride = (o) => Object.assign({ pose: 'ride', t, cadence: 3, cycle: 4, bob }, o);
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
      L.plate(ctx, ID + '|plate|5', (g) => plate(g, L));

      // 2 behind the hero: his ground point sits behind the front wheel centre by the axle's offset; the
      // launch and the sprint's effects are placed and sized in his height h, so they grow with him
      const u = heroUnit(L);
      const h = WHEEL_R / u.wheelR;
      const ax = u.front * h; // the ground point to the front wheel centre
      const tail = 2 * ax + WHEEL_R; // the front wheel centre to the back of the rear tyre
      const xf = frontX(L, t, tail);
      const x = xf - ax;
      if (fd < 0) speedTrail(ctx, L, x, GROUND, h, u, k);
      else {
        // the launch: dust kicked up behind the rear tyre where it stood on the beat, grown and gone in 7 frames
        if (fd < 7) L.dust(ctx, X_DASH - 2 * ax - 0.04 * h, GROUND - 0.03 * h, { r: 0.11 * h, p: (fd + 0.5) / 7, seed: L.hash(ID, 'dust') });
        // the speed lines doubled (storyboard 07): a second three a little further back and higher, a new
        // drawing every frame
        if (fd < OUT_F) {
          speedTrail(ctx, L, x, GROUND, h, u, fd);
          speedTrail(ctx, L, x - 0.12 * h, GROUND - 0.06 * h, h, u, fd + 1);
        }
        // the smear: his own colors along the path he just covered, faint at the tail, at his chest's height
        if (fd >= 4 && fd <= OUT_F) {
          const len = 3.6 * (xf - frontX(L, t - 1 / 24, tail));
          const x0 = x - 0.06 * h, y0 = GROUND - 0.52 * h, y1 = GROUND - 0.45 * h;
          L.smear(ctx, [[x0 - len, y1], [x0 - len * 0.66, L.lerp(y1, y0, 0.3)], [x0 - len * 0.33, L.lerp(y1, y0, 0.66)], [x0, y0]], { colors: [P.red, P.cap, P.skinKid, P.slate, P.green], width: 0.19 * h, strands: 5, seed: L.hash(ID, 'smear', fd) });
        }
      }

      // 3 the hero, while any of him is in the picture
      if (xf - tail < 1080) L.cast.hero(ctx, x, GROUND, Object.assign({ h, ground: P.cityPastel }, heroPose(t, k, u, h)));

      // 4 the mile counter
      let i = 0;
      while (i + 1 < COUNTER.length && t + 1e-6 >= COUNTER[i + 1][0]) i++;
      drawMileCounter(ctx, L, COUNTER[i][1], t - COUNTER[i][0]);
    },
  });
})();

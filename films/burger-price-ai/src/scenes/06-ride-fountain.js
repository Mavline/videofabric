// 06 ride-fountain: Mile 1, a fountain. T 10.0 to 11.5 (t = T - 10, 36 frames), illustrated: the street plate.
// The camera stands; the hero crosses left to right past a richer street: bigger houses, lawns, a fountain.
// The street's frame is shared with 05 and 07: the same far hills, the yard line y 1145 and its lawn edge,
// the G1 ground line y 1480 with the pavement and the kerb at y 1600, the G6 counter at the upper left.
// Layers, back to front:
//   1 the plate, drawn once and cached: the fieldSky light field, two pale clouds, far hills with a row of small
//     trees (05's, to the pixel and the seed), lawn, a two-storey cityPastel house
//     with a hip roof and a balcony on the left (no columns: they are 07's), a yellow two-storey house on the
//     right, clipped bushes, the fountain's stone basin, pedestal
//     and bowl (a basin 360 px wide centred (700, 1330)), the low wrought-iron fence in slate pencil, the
//     pavement
//   2 the fountain's three jets: on each beat (T 10.0, 10.5, 11.0) they leap to full height on ones, then
//     sag on twos (background: washes and pencil, no ink)
//   3 three speed lines behind the hero (05's speedTrail)
//   4 the hero riding, wheel radius 107 as in every ride shot: front wheel centre x = 40 + 700 t on twos, wheels
//     on y 1480, four pedal drawings a turn on twos, the body bobbing 4 px a stroke; at T 10.5 a double take
//     toward the fountain, then his eyes, and at last his head, follow it as he rides past
//   5 the G6 mile counter: 1 (T 10.0), 1.25 (T 10.5), 1.5 (T 11.0), each popping as it changes
(function () {
  'use strict';
  const ID = 'ride-fountain';
  const REF = 'ride-fence'; // 05: the hills, the lawn and the pavement are painted from its seeds, so they hold across the cut

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

  const GROUND = 1480; // G1 ground line, the pavement's top edge
  const YARD = 1145; // the houses stand back from the street on 05's line; bigger houses, so roofs reach y 700
  const BEATS = [0, 0.5, 1.0]; // shot-local t of T 10.0, 10.5, 11.0
  const COUNTER = [[0, 1], [0.5, 1.25], [1.0, 1.5]]; // shot-local t, miles; 1 is a change from 05's 0.75, so it pops

  // the fountain: a stone basin 360 px wide centred (700, 1330), a pedestal with a bowl, three waterTop jets
  const FX = 700;
  const RIM_Y = 1310, RIM_RX = 180, RIM_RY = 26, WALL = 30; // the basin spans y 1284 to 1366
  const BOWL_Y = 1240; // the bowl on the pedestal, where the centre jet starts
  const JET_C = 340; // the centre jet at full leap, px above the bowl
  const JET_S = 140; // the side arcs' apex at full leap, px above the water
  // jet height by frames since the beat: the leap on ones (frames 0 and 1), then the sag on twos
  const LEAP = [0.78, 1.0, 0.9, 0.9, 0.8, 0.8, 0.7, 0.7, 0.62, 0.62, 0.55, 0.55];

  function plate(g, L) {
    const P = L.pal;
    const sd = (...k) => L.hash(ID, ...k) & 0x7fffffff;
    const rs = (...k) => L.hash(REF, ...k) & 0x7fffffff;
    const wash = (pts, color, id, o) => {
      L.softWash(g, pts, Object.assign({ color, solid: true, marks: 0.6, rim: 0.12, seed: sd(id) }, o));
      L.pencil(g, pts, { closed: true, base: color, width: 2, seed: sd(id, 'p') });
    };
    const rect = (x, y, w, h) => L.rectPts(x, y, w, h, 4);
    const ell = (cx, cy, rx, ry, n = 48) => L.ellipsePts(cx, cy, rx, ry, n);
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

    // the yellow two-storey house on the right, cut by the frame: chimney, gable roof, walls, windows, door
    wash(rect(915, 728, 32, 100), P.stone, 'chimney');
    wash(rect(870, 845, 290, 300), P.wallYellow, 'walls');
    wash(L.densify([[850, 853], [1015, 700], [1180, 853]], 4), P.roof, 'roof');
    wash(rect(870, 986, 290, 10), P.stone, 'band');
    [[893, 880], [1000, 880], [1000, 1012]].forEach(([x, y], i) => {
      wash(rect(x - 6, y - 6, 66, 96), P.paper, 'frame' + i);
      wash(rect(x, y, 54, 84), P.waterTop, 'pane' + i);
      L.pencil(g, [[x + 27, y + 2], [x + 27, y + 82]], { base: P.wallYellow, width: 2, seed: sd('bar', i) });
      L.pencil(g, [[x + 2, y + 36], [x + 52, y + 36]], { base: P.wallYellow, width: 2, seed: sd('rung', i) });
    });
    wash(rect(893, 1032, 56, 113), P.trunk, 'door');
    wash(rect(883, 1141, 76, 9), P.stone, 'step');
    // the house on the left: two storeys of cityPastel under a hip roof (ridge at y 700), eight windows, a door
    // and over it a balcony whose iron railing rhymes with the street fence; no columns, no pediment (07's)
    wash(rect(372, 676, 34, 110), P.stone, 'chimney2');
    wash(rect(-40, 853, 510, YARD - 853), P.cityPastel, 'walls2');
    wash(L.densify([[-70, 857], [70, 700], [330, 700], [500, 857]], 4), P.hillsFar, 'roof2');
    wash(rect(-46, 853, 522, 10), P.stone, 'cornice2');
    wash(rect(-40, 992, 510, 10), P.stone, 'band2');
    [0, 90, 330, 410].forEach((x, i) => [885, 1028].forEach((y, j) => {
      wash(rect(x - 6, y - 6, 66, 92), P.paper, 'frame2' + i + j);
      wash(rect(x, y, 54, 80), P.waterTop, 'pane2' + i + j);
      L.pencil(g, [[x + 27, y + 2], [x + 27, y + 78]], { base: P.cityPastel, width: 2, seed: sd('bar2', i, j) });
      L.pencil(g, [[x + 2, y + 34], [x + 52, y + 34]], { base: P.cityPastel, width: 2, seed: sd('rung2', i, j) });
    }));
    wash(rect(182, 874, 66, 112), P.paper, 'frame2door');
    wash(rect(188, 880, 54, 106), P.waterTop, 'pane2door');
    L.pencil(g, [[215, 882], [215, 984]], { base: P.cityPastel, width: 2, seed: sd('bar2door') });
    wash(rect(150, 978, 130, 12), P.stone, 'balcony');
    for (let i = 0, x = 156; x <= 274; x += 13, i++) L.pencil(g, [[x, 978], [x, 940]], { color: P.slate, width: 2.2, seed: sd('rail2', i), double: false });
    L.pencil(g, [[152, 940], [278, 940]], { color: P.slate, width: 2.6, seed: sd('railtop2') });
    wash(rect(188, 1035, 54, YARD - 1035), P.trunk, 'door2');
    wash(rect(176, YARD - 4, 78, 9), P.stone, 'step2');

    // round clipped bushes along the houses and a pair on the lawn by the fountain, a shade deeper than the lawn
    [[-10, 1128, 66, 50], [458, 1134, 50, 40], [848, 1136, 40, 34], [1066, 1138, 44, 36], [462, 1318, 46, 38], [940, 1322, 44, 36]].forEach(([x, y, rx, ry], i) => {
      const pts = L.blobPts(x, y, rx, ry, sd('bush', i), 0.07);
      L.softWash(g, pts, { color: P.grass, alpha: 0.96, soft: 4, marks: 0.8, angle: -0.6, seed: sd('bushw', i) });
      L.pencil(g, pts, { closed: true, base: P.grass, width: 2, seed: sd('bushp', i) });
    });

    // the fountain: the basin's front wall, its rim, the water (a gradient is allowed for water), the pedestal and bowl
    const wall = [];
    for (let i = 0; i <= 32; i++) wall.push([FX + RIM_RX * Math.cos((i / 32) * Math.PI), RIM_Y + WALL + RIM_RY * Math.sin((i / 32) * Math.PI)]);
    for (let i = 32; i >= 0; i--) wall.push([FX + RIM_RX * Math.cos((i / 32) * Math.PI), RIM_Y + RIM_RY * Math.sin((i / 32) * Math.PI)]);
    wash(wall, P.stone, 'basin');
    const stoneTop = L.mix(P.stone, P.paper, 0.45);
    wash(ell(FX, RIM_Y, RIM_RX, RIM_RY, 64), stoneTop, 'rim');
    const water = ell(FX, RIM_Y + 2, RIM_RX - 20, RIM_RY - 9, 64);
    const gr = g.createLinearGradient(0, RIM_Y - 15, 0, RIM_Y + 19);
    gr.addColorStop(0, P.waterTop);
    gr.addColorStop(1, P.waterDeep);
    g.save();
    g.fillStyle = gr;
    g.beginPath();
    L.tracePath(g, L.smoothPts(water, true, 4), true);
    g.fill();
    g.restore();
    L.pencil(g, water, { closed: true, color: P.waterDeep, width: 2, seed: sd('water') });
    wash(rect(FX - 13, BOWL_Y + 6, 26, RIM_Y - BOWL_Y), P.stone, 'pedestal');
    const bowl = [];
    for (let i = 0; i <= 20; i++) bowl.push([FX + 52 * Math.cos((i / 20) * Math.PI), BOWL_Y + 22 * Math.sin((i / 20) * Math.PI)]);
    wash(bowl, P.stone, 'bowl');
    wash(ell(FX, BOWL_Y, 52, 10, 40), stoneTop, 'bowlrim');
    L.softWash(g, ell(FX, BOWL_Y + 1, 42, 6, 32), { color: P.waterTop, solid: true, marks: 0, rim: 0, seed: sd('bowlw') });

    // the low wrought-iron fence along the lawn's front edge: slate pencil bars with spear tips, two rails
    for (let i = 0, x = 8; x < 1080; x += 24, i++) {
      L.pencil(g, [[x, GROUND - 2], [x, 1416]], { color: P.slate, width: 2.2, seed: sd('pick', i), double: false });
      L.pencil(g, [[x - 4, 1421], [x, 1408], [x + 4, 1421]], { color: P.slate, width: 2.2, seed: sd('tip', i), double: false });
    }
    L.pencil(g, [[0, 1428], [1080, 1426]], { color: P.slate, width: 2.6, seed: sd('rail1') });
    L.pencil(g, [[0, 1468], [1080, 1467]], { color: P.slate, width: 2.6, seed: sd('rail2') });

    // the pavement from the ground line, and its kerb (G1): 05's, to the pixel and the seed
    L.softWash(g, L.rectPts(-20, GROUND, 1120, 460, 12), { color: P.cityPastel, soft: 2, solid: true, marks: 0.6, seed: rs('pavement') });
    L.pencil(g, [[0, 1600], [1080, 1602]], { base: P.cityPastel, width: 3, seed: rs('kerb') });
  }

  // a band of water along a polyline, w0 wide at the start and w1 at the end: a wash with a waterDeep pencil edge
  function waterBand(ctx, L, pts, w0, w1, seed) {
    const P = L.pal;
    const n = pts.length;
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d;
      const w = L.lerp(w0, w1, i / (n - 1)) / 2;
      left.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
      right.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
    }
    const poly = left.concat(right.reverse());
    L.softWash(ctx, poly, { color: P.waterTop, alpha: 0.95, soft: 2, marks: 0.3, rim: 0, seed });
    L.pencil(ctx, poly, { closed: true, color: P.waterDeep, width: 2, seed: seed + 1 });
  }
  function drop(ctx, L, x, y, r) {
    ctx.save();
    ctx.fillStyle = L.pal.waterTop;
    ctx.strokeStyle = L.pal.waterDeep;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 2 the jets at height k (1 = full leap): the centre jet with a crown spilling to both sides, two arcs outward
  function jets(ctx, L, k, seed) {
    const c = JET_C * k;
    const top = BOWL_Y - 4 - c;
    const col = [];
    for (let i = 0; i <= 8; i++) col.push([FX, L.lerp(BOWL_Y - 2, top, i / 8)]);
    waterBand(ctx, L, col, 18, 11, seed);
    for (const sx of [-1, 1]) {
      const arc = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        arc.push([FX + sx * (8 + 0.3 * c * u), top + 4 + 0.42 * c * u * u - 0.05 * c * u * (1 - u)]);
      }
      waterBand(ctx, L, arc, 10, 5, seed + (sx > 0 ? 10 : 20));
      [[0.36, 0.5, 6], [0.4, 0.66, 5], [0.43, 0.82, 4]].forEach(([ux, uy, r]) => drop(ctx, L, FX + sx * ux * c, top + uy * c, r * (0.75 + 0.25 * k)));
      const x0 = FX + sx * 30, x1 = FX + sx * 140;
      const side = [];
      for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        side.push([L.lerp(x0, x1, u), RIM_Y - 2 - 4 * JET_S * k * u * (1 - u)]);
      }
      waterBand(ctx, L, side, 13, 7, seed + (sx > 0 ? 30 : 40));
      drop(ctx, L, x1 + sx * 10, RIM_Y - 18 - 8 * k, 4);
    }
    drop(ctx, L, FX - 6, top - 14 * k, 5);
    drop(ctx, L, FX + 9, top - 24 * k, 4);
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
      L.speedLines(ctx, p[0], p[1], 0, { n: 1, spread: 0, len: [60, 90], gap: 12, width: 3.5, alpha: 0.5, seed: 21 + i * 3 + (k % 3) }));
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib;
      const t = L.clamp(tIn, 0, info.dur);
      const tw = L.onTwos(t);
      const k = Math.round(tw * 12); // the drawing on twos
      let b = 0;
      while (b + 1 < BEATS.length && t + 1e-6 >= BEATS[b + 1]) b++;
      const since = Math.floor((t - BEATS[b]) * 24 + 1e-6); // frames since the beat

      // 1 the plate
      L.plate(ctx, ID + '|plate|1', (g) => plate(g, L));
      // 2 the jets
      jets(ctx, L, LEAP[Math.min(LEAP.length - 1, since)], L.hash(ID, 'jet', b, since < 2 ? since : 2 + (since >> 1)));

      // 3 and 4 the hero, wheel radius 107 as in every ride shot; the ground point sits behind the front wheel centre
      const u = heroUnit(L);
      const h = 107 / u.wheelR;
      const x = 40 + 700 * tw - u.front * h;
      speedTrail(ctx, L, x, GROUND, h, u, k);
      // the fountain's crown as he sees it: ahead and up, then above, then behind him
      const dx = FX - (x + u.head[0] * h), dy = BOWL_Y - 0.85 * JET_C - (GROUND + u.head[1] * h);
      let face = 'smile', look = null, tilt = 0, turn = 1, blink = false;
      if (k === 6) {
        // T 10.5, the double take: a blink with the head dipped on the beat the jets leap, then the stare
        face = 'neutral';
        tilt = 0.08;
        blink = true;
      } else if (k > 6) {
        face = 'O';
        tilt = -0.14;
        look = [L.clamp(dx / 240, -1, 1), L.clamp(dy / 240 - 0.25, -1, 1)];
        turn = L.clamp(1 + dx / 160, 0.25, 1); // once it is behind him, the head turns round toward us to keep it in sight
      }
      const bob = k % 2 ? 0 : 4; // px, down on the push of each stroke
      L.cast.hero(ctx, x, GROUND, { h, pose: 'ride', t, cadence: 3, cycle: 4, face, look, tilt, turn, blink, bob });

      // 5 the mile counter
      let i = 0;
      while (i + 1 < COUNTER.length && t + 1e-6 >= COUNTER[i + 1][0]) i++;
      drawMileCounter(ctx, L, COUNTER[i][1], t - COUNTER[i][0]);
    },
  });
})();

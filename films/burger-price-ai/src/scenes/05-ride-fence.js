// Shot 05 ride-fence, "Mile 0: picket fences". T 8.0 to 10.0 (t = T - 8), illustrated: the street plate.
// The camera stands; the hero crosses left to right past three modest houses, finishing the burger.
// Layers, back to front:
//   1 the plate, drawn once and cached: the fieldSky light field, far hills, lawn, a tree, three modest houses, the
//     laundry posts and line, the street picket fence on y 1330..1480, the pavement from the G1 ground
//     line y 1480 with its kerb at y 1600
//   2 the laundry, flapping on twos (background: washes and pencil, no ink)
//   3 three speed lines behind the hero
//   4 the hero riding: front wheel centre x = 40 + 700 t on twos, wheels on y 1480, four pedal drawings
//     a turn on twos; chewing to T 9.0, the gulp (3 frames), the lick
//   5 the G6 mile counter: 0, then 0.25 (T 8.5), 0.5 (T 9.0), 0.75 (T 9.5)
(function () {
  'use strict';
  const ID = 'ride-fence';

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

  const GROUND = 1480; // G1 ground line, the pavement's top edge
  const YARD = 1145; // the houses stand back from the street on this line, so their roofs top out near y 880
  const COUNTER = [[0, 0], [0.5, 0.25], [1.0, 0.5], [1.5, 0.75]]; // shot-local t, miles; 0 is already up at the cut

  // the laundry line: posts at x 300 and 455 standing in the yard, the line sagging between them
  const POSTS = [300, 455];
  const lineY = (x) => 1010 + 18 * (1 - Math.pow((x - 377.5) / 77.5, 2));
  // the laundry: u across a piece (0..1, sleeves reach past it), v down it (0 on the line, 1 at the hem)
  const HEM = [[0.75, 1], [0.5, 1], [0.25, 1]];
  const LAUNDRY = [
    { x0: 319, w: 50, h: 66, color: 'white', shape: [[0, 0], [1, 0], [1.26, 0.14], [1.18, 0.32], [0.86, 0.26], [0.86, 1], [0.62, 1], [0.38, 1], [0.14, 1], [0.14, 0.26], [-0.18, 0.32], [-0.26, 0.14]] },
    { x0: 380, w: 36, h: 84, color: 'flower', shape: [[0.18, 0], [0.82, 0], [1, 1], ...HEM, [0, 1]] },
    { x0: 424, w: 24, h: 44, color: 'white', shape: [[0, 0], [1, 0], [1, 1], ...HEM, [0, 1]] },
  ];

  function plate(g, L) {
    const P = L.pal, R = L.props;
    const sd = (...k) => L.hash(ID, ...k) & 0x7fffffff;
    const wash = (pts, color, id) => {
      L.softWash(g, pts, { color, solid: true, marks: 0.6, rim: 0.12, seed: sd(id) });
      L.pencil(g, pts, { closed: true, base: color, width: 2, seed: sd(id, 'p') });
    };
    g.fillStyle = P.fieldSky; // the scene's light field (art bible 2.3, 4.2)
    g.fillRect(0, 0, 1080, 1920);
    // far hills, pale and cool, seen between the houses
    const hills = [[-20, 1060], [120, 1012], [300, 1060], [470, 1002], [650, 1052], [820, 996], [1000, 1046], [1100, 1020]];
    L.softWash(g, L.densify(hills.concat([[1100, 1200], [-20, 1200]]), 12), { color: P.hillsFar, soft: 10, seed: sd('hills') });
    // the lawn of the front yards, from the houses' line down behind the fence
    const lawn = [[-20, YARD - 6], [260, YARD - 12], [560, YARD - 4], [820, YARD - 14], [1100, YARD - 6]];
    L.softWash(g, L.densify(lawn.concat([[1100, GROUND + 6], [-20, GROUND + 6]]), 12), { color: P.grass, alpha: 0.7, soft: 12, seed: sd('lawn') });
    // a tree behind the gap between the second and third houses
    wash(L.densify([[777, YARD + 4], [784, 976], [796, 976], [805, YARD + 4]], 8), P.trunk, 'trunk');
    L.softWash(g, L.blobPts(790, 880, 92, 108, sd('crown'), 0.22), { color: P.grass, soft: 8, seed: sd('crown', 2) });
    // three modest houses; the middle one mirrored so its chimney stands on the other side
    R.house(g, 175, YARD, { h: 250, kind: 'modest', fence: false, seed: 1 });
    g.save();
    g.translate(1200, 0);
    g.scale(-1, 1);
    R.house(g, 600, YARD, { h: 270, kind: 'modest', fence: false, seed: 2 });
    g.restore();
    R.house(g, 955, YARD, { h: 245, kind: 'modest', fence: false, seed: 3 });
    // the laundry posts and the line (trunk-coloured, background)
    POSTS.forEach((x, i) => wash(L.rectPts(x - 4, 996, 8, YARD + 70 - 996, 6), P.trunk, 'post' + i));
    const line = [];
    for (let x = POSTS[0]; x <= POSTS[1]; x += 10) line.push([x, lineY(x)]);
    L.pencil(g, line, { color: P.trunk, width: 2, seed: sd('line') });
    // the street picket fence along y 1330..1480: two rails, then pointed pickets in front of them
    wash(L.rectPts(-20, 1364, 1120, 16, 8), P.fence, 'rail1');
    wash(L.rectPts(-20, 1428, 1120, 16, 8), P.fence, 'rail2');
    for (let i = 0, x = 6; x < 1110; x += 46, i++) {
      wash(L.densify([[x - 15, GROUND], [x - 15, 1347], [x, 1330], [x + 15, 1347], [x + 15, GROUND]], 6), P.fence, 'picket' + i);
    }
    // the pavement from the ground line, and its kerb (G1)
    L.softWash(g, L.rectPts(-20, GROUND, 1120, 460, 12), { color: P.cityPastel, soft: 2, solid: true, marks: 0.6, seed: sd('pavement') });
    L.pencil(g, [[0, 1600], [1080, 1602]], { base: P.cityPastel, width: 3, seed: sd('kerb') });
  }

  // the laundry flaps on twos: the hems swing and wave, the tops stay pegged to the line
  function laundry(ctx, L, k) {
    const P = L.pal;
    LAUNDRY.forEach((c, i) => {
      const wind = L.noise1(k * 0.9 + i * 2.3, L.hash(ID, 'wind'));
      const hemY = lineY(c.x0 + c.w / 2) + c.h;
      const pts = L.densify(c.shape.map(([u, v]) => [
        c.x0 + u * c.w + wind * 9 * v * v,
        lineY(c.x0 + u * c.w) * (1 - v) + hemY * v + (v === 1 ? 4 * Math.sin(u * 6.28 + k * 1.7 + i) : 0),
      ]), 6);
      L.softWash(ctx, pts, { color: P[c.color], solid: true, marks: 0.5, rim: 0.12, seed: L.hash(ID, 'laundry', i) });
      L.pencil(ctx, pts, { closed: true, base: P[c.color], width: 2, seed: L.hash(ID, 'laundry', i, 'p') });
    });
  }

  // the hero's riding proportions per unit of height, read from his anchors once (copied verbatim from 06):
  // the library may refine the body and the bicycle, so no part of him is hard-coded here
  const heroUnit = (L) => L.cached(ID + '|hero-unit', () => {
    const c = FILM.makeCanvas ? FILM.makeCanvas(1, 1) : document.createElement('canvas');
    c.width = c.height = 1;
    const a = L.cast.hero(c.getContext('2d'), 0, 0, { h: 300, pose: 'ride', phase: 0, shadow: false });
    return { wheelR: a.wheelR / 300, front: a.axleFront[0] / 300, head: [a.head[0] / 300, a.head[1] / 300] };
  });

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib;
      const t = L.clamp(tIn, 0, info.dur);
      const tw = L.onTwos(t);
      const k = Math.round(tw * 12); // the drawing on twos

      // 1 the plate
      L.plate(ctx, ID + '|plate|2', (g) => plate(g, L));
      // 2 the laundry
      laundry(ctx, L, k);

      // 3 and 4 the hero at the G1 size (wheel radius 80); the ground point sits behind the front wheel centre
      const u = heroUnit(L);
      const h = 80 / u.wheelR;
      const x = 40 + 700 * tw - u.front * h;
      L.speedLines(ctx, x - 100, 1250, 0, { n: 3, spread: 120, len: [70, 140], gap: 14, width: 5, seed: 5 + (k % 2) });
      const gulp = t + 1e-6 >= 1 && t + 1e-6 < 1 + 3 / 24; // T 9.0, three frames on ones
      const face = t + 1e-6 < 1 ? 'chew' : gulp ? 'gulp' : 'lick';
      const tilt = face === 'chew' ? [0.07, 0.035, 0][k % 3] : gulp ? -0.07 : 0; // chewing on 8ths; the chin lifts to swallow
      // ponytail: the storyboard's 4 px body bob per stroke waits for a bob option on the ride pose (asked of the library)
      L.cast.hero(ctx, x, GROUND, { h, pose: 'ride', t, cadence: 3, cycle: 4, face, tilt });

      // 5 the mile counter
      let i = 0;
      while (i + 1 < COUNTER.length && t + 1e-6 >= COUNTER[i + 1][0]) i++;
      drawMileCounter(ctx, L, COUNTER[i][1], i ? t - COUNTER[i][0] : null);
    },
  });
})();

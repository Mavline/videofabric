// 16 ride-back: Two miles back. Global T 27.0 to 28.0 (t = T - 27, 24 frames), illustrated (street plate).
// A cascade of four still cards, 6 frames each, cut on the 8ths inside the shot; the camera is locked on each.
// Screen direction right to left: the hero rides home. Every card keeps 05's street frame: the fieldSky
// light field, the far hills (tops near y 1000 to 1060), the lawn from the yard line y 1145, the G1 ground
// line y 1480, the cityPastel pavement and its kerb at y 1600. The hero is drawn at the ride plans' size
// (wheel radius 107) read from his anchors, facing left.
//   T 27.0    card 1, the columns (07's street, simplified)
//   T 27.25   card 2, the fountain (06's street, simplified)
//   T 27.5    card 3, the fences (05's street, simplified)
//             on each of these he crosses on ones: a smear (2 frames), one stretched drawing (1 frame),
//             a smear (2 frames), gone
//   T 27.75   card 4, the modest street of booth one, its corner at the left edge: he skids in from the right
//             (3 frames on ones) and stops facing left, the front wheel centre on x 300; dust; hold
//   G6 counter: 1.75 on the cut, then one step down every 16th, 0 on T 27.875 (the bell), held
// Layers, back to front:
//   1 the card's street, one cached plate per card (no black line in it)
//   2 behind the hero: 05's speed trail (mirrored, he rides left), the tyre streak, dust
//   3 the hero: a smear in his own colours, or his cel drawing (lib.cast.hero)
//   4 the G6 mile counter, screen-fixed
(function () {
  'use strict';
  const ID = 'ride-back';
  const EPS = 1e-6;

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

  // ---- timing: frames of the shot (0..23) ----
  const CARD_F = 6; // each card holds 6 frames, an 8th
  const MILES = [1.75, 1.5, 1.25, 1, 0.75, 0.5, 0.25, 0]; // one value a 16th (3 frames), 0 from T 27.875

  const GROUND = 1480; // G1 ground line, the pavement's top edge
  const YARD = 1145; // 05: the houses stand back from the street on this line
  const WHEEL_R = 107; // the ride plans' hero: the size that gives his bicycle this wheel radius (lead, after the critique)

  // heroUnit, copied verbatim from 05 (the ride shots' canonical): his riding proportions per unit of
  // height, read once from his anchors, so no part of him is hard-coded here
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
  // he rides left: 05's trail drawn in a frame mirrored about his ground point x, so its points and its
  // direction turn round with him and the function stays verbatim
  function mirrored(ctx, x, fn) {
    ctx.save();
    ctx.translate(2 * x, 0);
    ctx.scale(-1, 1);
    fn();
    ctx.restore();
  }
  // the dash drawing at height h, facing right: its anchors relative to his ground point give the smear its bands
  const dashShape = (L, h) => L.cached(ID + '|dash-shape|' + h, () => {
    const c = FILM.makeCanvas ? FILM.makeCanvas(1, 1) : document.createElement('canvas');
    c.width = c.height = 1;
    return L.cast.hero(c.getContext('2d'), 0, 0, { h, pose: 'dash', phase: 0, shadow: false });
  });

  // cards 1 to 3: his ground point on frames 0..4 of the card, 260 px a frame right to left (on ones)
  const passX = (cf) => 540 + 260 * (2 - cf);
  // card 4: px past the stop mark on the skid's frames 0..2 (the last a 4 px overshoot); then he stands on it
  const SKID = [160, 30, -4];

  // ---- 1 the four streets, each painted once ----
  // one part of a picture: a solid wash with brush marks, edged in pencil of its own colour, darker
  function painter(g, L, card) {
    const sd = (...k) => L.hash(ID, card, ...k) & 0x7fffffff;
    let id = 0;
    const part = (pts, fill, o = {}) => {
      id++;
      L.softWash(g, pts, { color: fill, solid: true, marks: o.marks != null ? o.marks : 0.6, rim: 0.12, seed: sd('w', id) });
      L.pencil(g, pts, { closed: true, base: fill, width: 2, seed: sd('p', id) });
    };
    const rect = (x0, y0, x1, y1, fill, o) => part(L.rectPts(x0, y0, x1 - x0, y1 - y0, Math.max(3, Math.min(20, (y1 - y0) / 4, (x1 - x0) / 4))), fill, o);
    const poly = (pts, fill, o) => part(L.densify(pts, 5), fill, o);
    const line = (pts, color, w) => L.pencil(g, pts, { color, width: w || 2.2, seed: sd('l', ++id), double: false });
    return { sd, part, rect, poly, line };
  }

  // 05's street frame under every card: the light field (art bible 2.3), the far hills, the lawn from the yard line
  function street(g, L, d) {
    const P = L.pal;
    g.fillStyle = P.fieldSky;
    g.fillRect(0, 0, 1080, 1920);
    const hills = [[-20, 1060], [120, 1012], [300, 1060], [470, 1002], [650, 1052], [820, 996], [1000, 1046], [1100, 1020]];
    L.softWash(g, L.densify(hills.concat([[1100, 1200], [-20, 1200]]), 12), { color: P.hillsFar, soft: 10, seed: d.sd('hills') });
    const lawn = [[-20, YARD - 6], [260, YARD - 12], [560, YARD - 4], [820, YARD - 14], [1100, YARD - 6]];
    L.softWash(g, L.densify(lawn.concat([[1100, GROUND + 6], [-20, GROUND + 6]]), 12), { color: P.grass, alpha: 0.7, soft: 12, seed: d.sd('lawn') });
  }
  // and over everything at the bottom, 05's pavement from the ground line with its kerb (G1)
  function pavement(g, L, d) {
    const P = L.pal;
    L.softWash(g, L.rectPts(-20, GROUND, 1120, 460, 12), { color: P.cityPastel, soft: 2, solid: true, marks: 0.6, seed: d.sd('pavement') });
    L.pencil(g, [[0, 1600], [1080, 1602]], { base: P.cityPastel, width: 3, seed: d.sd('kerb') });
  }

  // card 1: 07's mansion, fewer details: the hip roof, two storeys of wings, the portico of four columns
  // under a pediment (top near y 562), the urn on its plinth, the gate at the right; 05's lawn in front
  function cardColumns(g, L) {
    const P = L.pal;
    const d = painter(g, L, 1);
    street(g, L, d);
    const MX = 520;
    d.poly([[140, 716], [232, 650], [808, 650], [900, 716]], P.hillsFar);
    d.rect(130, 706, 910, 730, P.stone);
    d.rect(150, 730, 890, 1292, P.cityPastel);
    for (const wx of [198, 272, 766, 840]) {
      d.rect(wx - 26, 792, wx + 26, 900, P.waterTop);
      d.rect(wx - 26, 1030, wx + 26, 1170, P.waterTop);
    }
    d.rect(140, 1250, 900, 1292, P.stone);
    d.rect(322, 745, 718, 1214, P.hillsFar);
    d.rect(494, 992, 546, 1214, P.trunk);
    for (const wx of [415, 625]) {
      d.rect(wx - 23, 800, wx + 23, 930, P.waterTop);
      d.rect(wx - 23, 1030, wx + 23, 1170, P.waterTop);
    }
    for (const cx of [MX - 157.5, MX - 52.5, MX + 52.5, MX + 157.5]) {
      d.rect(cx - 30, 1196, cx + 30, 1214, P.stone);
      d.poly([[cx - 21, 762], [cx + 21, 762], [cx + 24, 1196], [cx - 24, 1196]], P.stone);
      d.rect(cx - 31, 745, cx + 31, 762, P.stone);
    }
    d.rect(312, 700, 728, 745, P.stone);
    d.poly([[298, 704], [MX, 562], [742, 704]], P.stone);
    d.poly([[340, 696], [MX, 588], [700, 696]], P.cityPastel);
    d.rect(300, 1214, 740, 1236, P.stone);
    d.rect(284, 1236, 756, 1260, P.stone);
    d.rect(268, 1260, 772, 1292, P.stone);
    d.rect(46, 1440, 130, 1462, P.stone);
    d.rect(56, 1352, 120, 1440, P.stone);
    d.rect(46, 1336, 130, 1352, P.stone);
    d.part([[60, 1250], [116, 1250], [124, 1270], [114, 1298], [96, 1318], [80, 1318], [62, 1298], [52, 1270]], P.stone);
    d.part(L.blobPts(88, 1222, 42, 22, d.sd('plant'), 0.22), P.grass);
    d.rect(900, 1452, 970, 1484, P.stone);
    d.rect(910, 962, 960, 1452, P.stone);
    d.rect(900, 944, 970, 962, P.stone);
    d.part(L.ellipsePts(935, 906, 28, 28, 32), P.stone);
    const top = (x) => 1062 - (x - 976) * 0.6;
    for (let x = 980; x <= 1090; x += 20) d.line([[x, 1478], [x, top(x)]], P.slate, 3);
    d.line([[966, 1270], [1090, 1270]], P.slate, 3);
    d.line([[966, 1440], [1090, 1440]], P.slate, 3.4);
    pavement(g, L, d);
  }

  // card 2: 06's street, fewer details: the cityPastel house with a balcony on the left, the yellow
  // two-storey house on the right, clipped bushes, the fountain (a basin 360 wide centred (700, 1330)) with its jets standing
  // still, the low wrought-iron fence in slate pencil
  function cardFountain(g, L) {
    const P = L.pal;
    const d = painter(g, L, 2);
    street(g, L, d);
    d.rect(915, 728, 947, 828, P.stone);
    d.rect(870, 845, 1160, 1145, P.wallYellow);
    d.poly([[850, 853], [1015, 700], [1180, 853]], P.roof);
    for (const [x, y] of [[893, 880], [1000, 880], [1000, 1012]]) d.rect(x, y, x + 54, y + 84, P.waterTop);
    d.rect(893, 1032, 949, 1145, P.trunk);
    // the house on the left (06's): two storeys of cityPastel under a hip roof, eight windows, a door with a
    // balcony over it, its iron railing in slate pencil
    d.rect(372, 676, 406, 786, P.stone);
    d.rect(-40, 853, 470, YARD, P.cityPastel);
    d.poly([[-70, 857], [70, 700], [330, 700], [500, 857]], P.hillsFar);
    d.rect(-46, 853, 476, 863, P.stone);
    d.rect(-40, 992, 470, 1002, P.stone);
    for (const x of [0, 90, 330, 410]) for (const y of [885, 1028]) d.rect(x, y, x + 54, y + 80, P.waterTop);
    d.rect(188, 880, 242, 986, P.waterTop);
    d.rect(150, 978, 280, 990, P.stone);
    for (let x = 156; x <= 274; x += 13) d.line([[x, 978], [x, 940]], P.slate, 2.2);
    d.line([[152, 940], [278, 940]], P.slate, 2.6);
    d.rect(188, 1035, 242, YARD, P.trunk);
    d.rect(176, YARD - 4, 254, YARD + 5, P.stone);
    for (const [x, y, rx, ry] of [[-10, 1128, 66, 50], [458, 1134, 50, 40], [848, 1136, 40, 34], [1066, 1138, 44, 36], [462, 1318, 46, 38], [940, 1322, 44, 36]]) {
      const pts = L.blobPts(x, y, rx, ry, d.sd('bush', x), 0.07);
      L.softWash(g, pts, { color: P.grass, alpha: 0.96, soft: 4, marks: 0.8, angle: -0.6, seed: d.sd('bushw', x) });
      L.pencil(g, pts, { closed: true, base: P.grass, width: 2, seed: d.sd('bushp', x) });
    }
    // the fountain: the basin's front wall, the rim, the water (a gradient is allowed for water), pedestal, bowl
    const FX = 700, RIM_Y = 1310, RX = 180, RY = 26, BOWL_Y = 1240;
    const wall = [];
    for (let i = 0; i <= 32; i++) wall.push([FX + RX * Math.cos((i / 32) * Math.PI), RIM_Y + 30 + RY * Math.sin((i / 32) * Math.PI)]);
    for (let i = 32; i >= 0; i--) wall.push([FX + RX * Math.cos((i / 32) * Math.PI), RIM_Y + RY * Math.sin((i / 32) * Math.PI)]);
    d.part(wall, P.stone);
    const stoneTop = L.mix(P.stone, P.paper, 0.45);
    d.part(L.ellipsePts(FX, RIM_Y, RX, RY, 64), stoneTop);
    const water = L.ellipsePts(FX, RIM_Y + 2, RX - 20, RY - 9, 64);
    const gr = g.createLinearGradient(0, RIM_Y - 15, 0, RIM_Y + 19);
    gr.addColorStop(0, P.waterTop);
    gr.addColorStop(1, P.waterDeep);
    g.save();
    g.fillStyle = gr;
    g.beginPath();
    L.tracePath(g, L.smoothPts(water, true, 4), true);
    g.fill();
    g.restore();
    d.rect(FX - 13, BOWL_Y + 6, FX + 13, RIM_Y, P.stone);
    const bowl = [];
    for (let i = 0; i <= 20; i++) bowl.push([FX + 52 * Math.cos((i / 20) * Math.PI), BOWL_Y + 22 * Math.sin((i / 20) * Math.PI)]);
    d.part(bowl, P.stone);
    d.part(L.ellipsePts(FX, BOWL_Y, 52, 10, 40), stoneTop);
    // the jets, still: the centre jet with its crown spilling both ways, and two low arcs into the basin
    const jet = (pts, w0, w1) => {
      const left = [], right = [];
      pts.forEach((p, i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l, w = L.lerp(w0, w1, i / (pts.length - 1)) / 2;
        left.push([p[0] + nx * w, p[1] + ny * w]);
        right.push([p[0] - nx * w, p[1] - ny * w]);
      });
      const poly = left.concat(right.reverse());
      const id = d.sd('jet', pts[0][0], pts[pts.length - 1][0]);
      L.softWash(g, poly, { color: P.waterTop, alpha: 0.95, soft: 2, marks: 0.3, rim: 0, seed: id });
      L.pencil(g, poly, { closed: true, color: P.waterDeep, width: 2, seed: id + 1 });
    };
    const c = 0.85 * 340, topY = BOWL_Y - 4 - c;
    jet([[FX, BOWL_Y - 2], [FX, topY]], 18, 11);
    for (const sx of [-1, 1]) {
      const arc = [], side = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        arc.push([FX + sx * (8 + 0.3 * c * u), topY + 4 + 0.42 * c * u * u - 0.05 * c * u * (1 - u)]);
      }
      for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        side.push([L.lerp(FX + sx * 30, FX + sx * 140, u), RIM_Y - 2 - 4 * 140 * 0.85 * u * (1 - u)]);
      }
      jet(arc, 10, 5);
      jet(side, 13, 7);
    }
    for (let x = 8; x < 1080; x += 24) d.line([[x, GROUND - 2], [x, 1412]], P.slate, 2.2);
    d.line([[0, 1428], [1080, 1426]], P.slate, 2.6);
    d.line([[0, 1468], [1080, 1467]], P.slate, 2.6);
    pavement(g, L, d);
  }

  // card 3: 05's street, fewer details: three small houses set back on the yard line, a tree, the laundry
  // line with two pieces hanging still, the picket fence along y 1330..1480
  function cardFences(g, L) {
    const P = L.pal;
    const d = painter(g, L, 3);
    street(g, L, d);
    d.part(L.densify([[777, YARD + 4], [784, 976], [796, 976], [805, YARD + 4]], 8), P.trunk);
    L.softWash(g, L.blobPts(790, 880, 92, 108, d.sd('crown'), 0.22), { color: P.grass, soft: 8, seed: d.sd('crownw') });
    L.props.house(g, 175, YARD, { h: 250, kind: 'modest', fence: false, seed: 1 });
    g.save();
    g.translate(1200, 0);
    g.scale(-1, 1);
    L.props.house(g, 600, YARD, { h: 270, kind: 'modest', fence: false, seed: 2 });
    g.restore();
    L.props.house(g, 955, YARD, { h: 245, kind: 'modest', fence: false, seed: 3 });
    const lineY = (x) => 1010 + 18 * (1 - Math.pow((x - 377.5) / 77.5, 2));
    for (const x of [300, 455]) d.rect(x - 4, 996, x + 4, YARD + 70, P.trunk);
    const ln = [];
    for (let x = 300; x <= 455; x += 10) ln.push([x, lineY(x)]);
    d.line(ln, P.trunk, 2);
    d.part(L.densify([[319, lineY(319)], [369, lineY(369)], [375, lineY(369) + 18], [362, lineY(369) + 18], [362, lineY(369) + 64], [326, lineY(319) + 64], [326, lineY(319) + 18], [313, lineY(319) + 18]], 6), P.white);
    d.part(L.densify([[386, lineY(386)], [410, lineY(410)], [416, lineY(410) + 82], [380, lineY(386) + 82]], 6), P.flower);
    d.rect(-20, 1364, 1100, 1380, P.fence);
    d.rect(-20, 1428, 1100, 1444, P.fence);
    for (let x = 6; x < 1110; x += 46) d.part(L.densify([[x - 15, GROUND], [x - 15, 1347], [x, 1330], [x + 15, 1347], [x + 15, GROUND]], 6), P.fence);
    pavement(g, L, d);
  }

  // card 4: 01's modest street, the camera 850 px further right along it: booth one's right corner (its
  // striped awning, the sign board's end, a post, the yellow front with planks) at the left edge, the tree
  // that stands behind it, then a small yellow house and its picket fence; two clouds
  const HOME = 850;
  function cardHome(g, L) {
    const P = L.pal;
    const d = painter(g, L, 4);
    street(g, L, d);
    L.softWash(g, L.blobPts(800, 470, 120, 30, d.sd('cloud1'), 0.25), { color: P.waterTop, alpha: 0.45, soft: 12, marks: 0.5, rim: 0.1, seed: d.sd('cloud1w') });
    L.softWash(g, L.blobPts(430, 690, 130, 30, d.sd('cloud2'), 0.25), { color: P.waterTop, alpha: 0.45, soft: 12, marks: 0.5, rim: 0.1, seed: d.sd('cloud2w') });
    // the tree behind the booth's right edge (01: crown x 920..1080, trunk x 998..1034)
    d.rect(998 - HOME, 930, 1034 - HOME, 1490, P.trunk);
    d.part(L.blobPts(1008 - HOME, 850, 92, 150, d.sd('crown'), 0.16), P.grass, { marks: 0.8 });
    // the small yellow house, as 01's but the other way round: walls, roof, chimney, window, door
    d.rect(860, 694, 904, 814, P.stone);
    d.rect(680, 860, 1100, 1500, P.wallYellow);
    d.poly([[656, 874], [1110, 874], [1110, 760], [704, 760]], P.roof);
    d.rect(842, 958, 978, 1084, P.waterTop);
    d.line([[910, 960], [910, 1082]], L.mix(P.waterTop, P.ink, 0.35), 2);
    d.line([[844, 1021], [976, 1021]], L.mix(P.waterTop, P.ink, 0.35), 2);
    d.poly([[844, 960], [884, 960], [844, 1024]], P.flower);
    d.poly([[976, 960], [936, 960], [976, 1024]], P.flower);
    d.rect(836, 1084, 984, 1096, P.fence);
    d.rect(722, 1130, 798, 1490, P.fence);
    // the picket fence along the street, two rails behind the pickets
    d.rect(250, 1366, 1100, 1378, P.fence);
    d.rect(250, 1436, 1100, 1448, P.fence);
    for (let px = 262; px < 1100; px += 34) d.part(L.densify([[px, 1490], [px, 1342], [px + 11, 1330], [px + 22, 1342], [px + 22, 1490]], 6), P.fence);
    // booth one, all of it but the tag; only its right corner is in the picture
    L.props.booth(g, 690 - HOME, GROUND, { w: 580, price: false });
    pavement(g, L, d);
  }
  const CARDS = [cardColumns, cardFountain, cardFences, cardHome];

  // ---- 3 the hero ----
  // the smear that stands for him on a fast frame: dry-brush streaks in his own colours, one for each band
  // of the figure, so it still reads as a boy on a bicycle: the wheels with his legs and shoes, the shirt
  // with his arms, the head under the cap. The bands come from the dash drawing's anchors a (facing right,
  // relative to his ground point); x is his ground point and he faces left, so each streak's head is that
  // band's front edge and its tail trails right, fading.
  function heroSmear(ctx, L, a, x, trail, seed) {
    const P = L.pal;
    const R = a.wheelR, axleY = a.axleFront[1], chin = a.head[1] + a.headR;
    const bands = [
      { y: axleY, w: 2 * R + 10, front: a.axleFront[0] + R, back: a.axleRear[0] - R, cols: [P.ink, P.shoe, P.green, P.skinKid, P.green, P.ink] },
      { y: (axleY - R + chin) / 2, w: axleY - R - chin + 20, front: a.grip[0] + 20, back: a.seat[0] - 20, cols: [P.red, P.skinKid, P.red, P.red, P.red] },
      { y: (a.top[1] + chin) / 2, w: chin - a.top[1], front: a.head[0] + 1.3 * a.headR, back: a.head[0] - a.headR, cols: [P.skinKid, P.skinKid, P.hairYellow, P.cap, P.cap] },
    ];
    bands.forEach((b, i) => {
      const head = x - b.front, tail = x - b.back + trail * (1 - 0.15 * i), y = GROUND + b.y;
      L.smear(ctx, [[tail, y + 14], [L.lerp(tail, head, 0.55), y + 2], [head, y]], { colors: b.cols, width: b.w, strands: b.cols.length, seed: seed + i * 13 });
    });
  }

  // the stretched drawing of the pass: the dash with 05's speed trail behind it, drawn 1.4 times long and
  // 0.86 high about his ground point; the line is thinned so it stays 3.5 to 5.7 px after the stretch
  // (art bible 3.2)
  function heroStretched(ctx, L, h, u, x, t, k, face) {
    const sx = 1.4, sy = 0.86;
    ctx.save();
    ctx.translate(x, GROUND);
    ctx.scale(sx, sy);
    ctx.translate(-x, -GROUND);
    mirrored(ctx, x, () => speedTrail(ctx, L, x, GROUND, h, u, k));
    L.cast.hero(ctx, x, GROUND, { h, facing: -1, pose: 'dash', t, ones: true, cadence: 6, cycle: 4, face, look: [1, 0], line: L.LINE / Math.sqrt(sx * sy) });
    ctx.restore();
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib;
      const t = L.clamp(tIn, 0, info.dur);
      const f = Math.min(23, Math.floor(t * 24 + EPS)); // frame of the shot: everything here is on ones
      const card = Math.min(3, Math.floor(f / CARD_F));
      const cf = f - card * CARD_F; // frame of the card
      const sd = (...k) => L.hash(ID, ...k) & 0x7fffffff;
      // the hero at the ride plans' size, from his anchors
      const u = heroUnit(L);
      const h = WHEEL_R / u.wheelR;
      const R = WHEEL_R;
      const a = dashShape(L, h);

      // 1 the street of this card
      L.plate(ctx, `${ID}|card${card}|3`, (g) => CARDS[card](g, L));

      if (card < 3) {
        // 2 and 3: the pass, on ones: smear, smear, the stretched drawing, smear, smear, gone; the smear is its
        // own speed effect, the drawing carries 05's trail
        if (cf < 5) {
          const x = passX(cf);
          if (cf === 2) heroStretched(ctx, L, h, u, x, t, f, card === 2 ? 'grin' : 'determined');
          else heroSmear(ctx, L, a, x, cf < 2 ? 340 : 260, sd('smear', card, cf));
        }
      } else {
        // card 4: the skid on ones (frames 0..2), the stop on the bell (frame 3), held
        const stop = 300 + u.front * h; // his ground point with the front wheel centre on x 300, facing left
        const x = stop + (cf < 3 ? SKID[cf] : 0);
        const rear = x - a.axleRear[0]; // the rear wheel's centre
        if (cf === 0) heroSmear(ctx, L, a, x + 340, 300, sd('smear', 3));
        if (cf < 2) mirrored(ctx, x, () => speedTrail(ctx, L, x, GROUND, h, u, f));
        // the tyre's streak on the pavement behind the rear wheel's contact, and the dust kicked up there
        const streak = R * [0.62, 1.12, 1.62, 1.75][Math.min(3, cf)];
        L.speedLines(ctx, rear - 2, GROUND + 4, Math.PI, { n: 2, spread: 7, gap: 0, width: 6, len: [streak * 0.8, streak], seed: sd('skid') });
        const age = cf < 3 ? cf : 3 + ((cf - 3) >> 1); // on ones in the skid, on twos as it thins
        const p = [0.08, 0.24, 0.4, 0.56, 0.76][age];
        L.dust(ctx, rear + 0.62 * R, GROUND - 0.3 * R, { r: 1.15 * R, p, dir: -0.25, n: 4, seed: sd('dust') });
        L.dust(ctx, rear, GROUND - 0.1 * R, { r: 0.7 * R, p, dir: 0.15, n: 3, seed: sd('dust', 2) });
        const o = cf < 3 ? { pose: 'skid', face: 'determined', look: [0.8, -0.1] } : { pose: 'straddle', face: 'grin', look: [0.9, -0.3] };
        L.cast.hero(ctx, x, GROUND, Object.assign({ h, facing: -1 }, o));
      }

      // 4 the G6 counter: a new value every 16th (3 frames), each popping as it changes
      const m = Math.min(MILES.length - 1, Math.floor(f / 3));
      drawMileCounter(ctx, L, MILES[m], (f - m * 3) / 24);
    },
  });
})();

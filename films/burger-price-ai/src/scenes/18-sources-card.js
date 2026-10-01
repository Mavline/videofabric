// 18 sources-card: Sources, and the booth again. Global T 30.0 to 32.0, so t = T - 30.
// Street plate (illustrated). Storyboard: docs/storyboard.md, "18 sources-card", tables G1 and G8.
//
// Layers, back to front:
//   1 the modest street under the fieldSky light field, painted once (lib.plate), as in 01
//   2 the owner's back layer, clipped to the window
//   3 the booth's front, painted once on a transparent plate
//   4 the owner's front layer: his near arm on the shelf
//   5 the $5.69 tag, rocking 2 degrees on twos on 01's global clock
//   6 the titleSpot blobs in the sky's lettering zone, painted once
//   7 the three source lines and the Reuters caveat, ink 'note' letters
//   8 the channel mark, titleBlue 'round' capitals with the I and the T in titleYellow, drawing on
//
// Beats (shot frames, t = T - 30): f0 (T 30.0) the booth, the sources and the caveat fully drawn; f12 (T 30.5)
// the channel mark draws on over 12 frames on twos, then holds; f20 the owner draws breath, f24 (T 31.0) he
// yawns on twos, f34 he is back in 01's frame-0 pose (chin on hand); hold to the end. The last frame is 01's
// frame 0 plus the lettering and minus the hero's front wheel, so the film loops.
(function () {
  'use strict';
  const ID = 'sources-card';
  const DEG = Math.PI / 180;

  // Layers 1 to 5: 01's G1 block, copied verbatim (keep it in step with src/scenes/01-booth-569.js).
  // ===========================================================================
  // G1, the modest street at rest. 18 (sources-card) ends on this picture and loops into this shot's
  // frame 0, so it copies this block verbatim: same REF seeds, same owner pose, same tag clock. The plate
  // keys carry the file's own ID, so each copy paints its own plate and captures its own booth anchors.
  // ===========================================================================
  const REF = 'booth-569';
  const G1 = { boothX: 690, ground: 1480, boothW: 580, tagTop: [680, 750], price: '$5.69' };
  let G1B = null; // the booth's anchors, captured while the street plate is painted (a pure function of G1)

  // a still object of the street plate: an opaque wash with brush marks and a colored pencil edge, no black
  function g1Paint(g, L, pts, color, id, o = {}) {
    const seed = L.hash(REF, 'g1', id) & 0x7fffffff;
    L.softWash(g, pts, Object.assign({ color, solid: true, marks: 0.6, rim: 0.12, seed }, o));
    L.pencil(g, pts, { closed: true, base: color, width: 2, seed: seed + 1 });
  }

  function g1Street(g, L) {
    const P = L.pal;
    const sd = (id) => L.hash(REF, 'g1', id) & 0x7fffffff;
    // the light field of a street scene (art bible 2.3, 4.2)
    g.fillStyle = P.fieldSky;
    g.fillRect(0, 0, 1080, 1920);
    // two pale clouds, clear of 18's lettering zone (x 80 to 940, y 230 to 540)
    L.softWash(g, L.blobPts(830, 158, 120, 30, sd(1), 0.25), { color: P.paper, alpha: 0.85, soft: 12, marks: 0.4, rim: 0.06, seed: sd(2) });
    L.softWash(g, L.blobPts(205, 642, 140, 32, sd(3), 0.25), { color: P.paper, alpha: 0.85, soft: 12, marks: 0.4, rim: 0.06, seed: sd(4) });
    // far hills along y 1150 to 1260, and the pale meadow under them down to the pavement
    const hills = [];
    for (let x = -20; x <= 1100; x += 20) hills.push([x, 1176 - 20 * Math.sin(x / 150 + 0.4) - 8 * Math.sin(x / 47)]);
    hills.push([1100, 1262], [-20, 1262]);
    L.softWash(g, hills, { color: P.hillsFar, soft: 8, marks: 0.6, seed: sd(5) });
    L.softWash(g, L.rectPts(-20, 1254, 1120, 236, 20), { color: L.mix(P.grass, P.fieldSky, 0.45), solid: true, marks: 0.5, rim: 0, seed: sd(6) });
    // the tree behind the booth's right edge: crown x 920 to 1080, y 700 to 1000
    g1Paint(g, L, L.rectPts(998, 930, 36, 560, 16), P.trunk, 7);
    L.softWash(g, L.blobPts(1008, 850, 92, 150, sd(8), 0.16), { color: P.grass, solid: true, marks: 0.8, rim: 0.14, seed: sd(9) });
    L.pencil(g, L.blobPts(1008, 850, 92, 150, sd(8), 0.16), { closed: true, base: P.grass, width: 2, seed: sd(10) });
    // the small yellow house: x 0 to 380, y 860 to 1480, roof ridge at y 760, a stone chimney
    g1Paint(g, L, L.rectPts(262, 694, 44, 120, 10), P.stone, 11);
    g1Paint(g, L, L.rectPts(-20, 860, 400, 640, 16), P.wallYellow, 12);
    g1Paint(g, L, L.densify([[-30, 874], [404, 874], [356, 760], [-30, 760]], 8), P.roof, 13);
    // its window: glass, a pencil cross, flower curtains in the top corners
    g1Paint(g, L, L.rectPts(62, 958, 136, 126, 10), P.waterTop, 14);
    L.pencil(g, [[130, 960], [130, 1082]], { base: P.waterTop, width: 2, seed: sd(15) });
    L.pencil(g, [[64, 1021], [196, 1021]], { base: P.waterTop, width: 2, seed: sd(16) });
    g1Paint(g, L, L.densify([[64, 960], [104, 960], [64, 1024]], 6), P.flower, 17);
    g1Paint(g, L, L.densify([[196, 960], [156, 960], [196, 1024]], 6), P.flower, 18);
    g1Paint(g, L, L.rectPts(56, 1084, 148, 12, 8), P.fence, 19);
    // its door, half behind the fence
    g1Paint(g, L, L.rectPts(262, 1130, 76, 360, 12), P.fence, 20);
    L.softWash(g, L.ellipsePts(323, 1316, 5, 5, 12), { color: P.trunk, solid: true, marks: 0, rim: 0, seed: sd(21) });
    // the picket fence: x 0 to 400, y 1330 to 1480, two rails behind the pickets, trunk pencil grain
    g1Paint(g, L, L.rectPts(-20, 1366, 420, 12, 10), P.fence, 22);
    g1Paint(g, L, L.rectPts(-20, 1436, 420, 12, 10), P.fence, 23);
    for (let i = 0, px = -6; px < 400; px += 34, i++) {
      g1Paint(g, L, L.densify([[px, 1490], [px, 1342], [px + 11, 1330], [px + 22, 1342], [px + 22, 1490]], 6), P.fence, 30 + i);
      if (i % 3 === 1) L.pencil(g, [[px + 8, 1352], [px + 9, 1410], [px + 7, 1470]], { color: P.trunk, width: 1.6, alpha: 0.5, seed: sd(60 + i) });
    }
    // the pavement from the ground line y 1480, the kerb at y 1600, the road under it
    L.softWash(g, L.rectPts(-20, 1480, 1120, 140, 20), { color: P.cityPastel, solid: true, marks: 0.6, rim: 0, seed: sd(70) });
    L.softWash(g, L.rectPts(-20, 1600, 1120, 340, 20), { color: L.mix(P.cityPastel, P.hillsFar, 0.45), solid: true, marks: 0.6, rim: 0, seed: sd(71) });
    L.pencil(g, [[-10, 1481], [1090, 1479]], { base: P.cityPastel, width: 2.4, seed: sd(72) });
    L.pencil(g, [[-10, 1600], [1090, 1602]], { base: P.cityPastel, width: 3, seed: sd(73) });
    // the booth's dark window behind the owner
    G1B = L.props.booth(g, G1.boothX, G1.ground, { w: G1.boothW, layer: 'back' });
  }

  // the owner at rest: facing the street (left), elbow on the shelf, chin on his fist, bored, no shadow spot
  // (a figure in the booth window has none). booth.owner stands a right-facing owner with his head on G1's
  // (710, 1105); facing left, his head sits on the other side of his ground point, so the ground point moves
  // by twice the head offset.
  function g1OwnerRest(b) {
    const h = b.ownerH;
    const x = b.owner[0] + (60 * h) / 400;
    return { x, y: b.owner[1], o: { h, facing: -1, pose: 'lean', target: [x - 0.14 * h, b.shelf.y], shadow: false } };
  }

  // the tag rocks 2 degrees on twos, one swing a second, on the global clock: 0 on T 0 (and on T 32)
  const g1TagSwing = (L, T) => 2 * DEG * Math.sin(2 * Math.PI * L.onTwos(T));

  // layers 1 to 5; owner(b, rest) returns the owner's options (rest for the still picture)
  function g1Scene(ctx, L, T, owner) {
    L.plate(ctx, ID + '|g1-street', (g) => g1Street(g, L));
    const b = G1B;
    const rest = g1OwnerRest(b);
    const ow = owner ? owner(b, rest) : rest;
    const w = b.window;
    ctx.save();
    ctx.beginPath();
    ctx.rect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0);
    ctx.clip();
    L.cast.owner(ctx, ow.x, ow.y, Object.assign({ layer: 'back' }, ow.o));
    ctx.restore();
    L.plate(ctx, ID + '|g1-booth-front', (g) => L.props.booth(g, G1.boothX, G1.ground, { w: G1.boothW, layer: 'front', price: false }));
    L.cast.owner(ctx, ow.x, ow.y, Object.assign({ layer: 'front' }, ow.o));
    L.props.priceTag(ctx, G1.tagTop[0], G1.tagTop[1], { w: 280, h: 150, drop: 30, price: G1.price, swing: g1TagSwing(L, T) });
    return b;
  }
  // ===========================================================================
  // end of the G1 block
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // The owner's yawn, on twos. Values in his design units (standing height 400, y up negative, x toward
  // where he faces), as offsets from 01's rest pose ('lean': chin on the fist, elbow on the shelf):
  // [first frame of the drawing, head dx, head dy, tilt, face, fist dy, neck and shoulders dy]
  // ---------------------------------------------------------------------------
  const REST = { head: [30, -338], neck: [12, -310], shN: [12, -300], shF: [-2, -302], fist: [28.6, -294.9] };
  const YAWN = [
    [20, 0, 2, 0.23, 'sigh', 2, 2], // anticipation: he sinks onto the fist and draws breath
    [22, 0, 3, 0.25, 'sigh', 3, 3],
    [24, -6, -1, 0.02, 'yawn', 9, -3], // T 31.0, on the beat: the head tips back off the fist, the mouth opens
    [26, -9, -2, -0.12, 'yawn', 12, -5], // the peak, shoulders up (the head stays low: the cap is at the window top)
    [28, -10, -2, -0.15, 'yawn', 12, -6], // held, still stretching
    [30, -4, 0, 0.08, 'sigh', 6, -2], // closing
    [32, 1, 2, 0.24, 'bored', 2, 1], // the chin drops back onto the fist, a little past rest
  ]; // from frame 34 (T 31.417) g1Scene draws the rest pose, 01's frame 0

  function ownerYawn(f) {
    if (f < YAWN[0][0] || f >= YAWN[0][0] + 2 * YAWN.length) return null;
    const [, dx, dy, tilt, face, fy, sy] = YAWN[(f - YAWN[0][0]) >> 1];
    return (b, rest) => ({
      x: rest.x,
      y: rest.y,
      o: Object.assign({}, rest.o, {
        face,
        tilt,
        rig: {
          head: [REST.head[0] + dx, REST.head[1] + dy],
          neck: [REST.neck[0] + 0.3 * dx, REST.neck[1] + sy],
          shN: [REST.shN[0], REST.shN[1] + sy],
          shF: [REST.shF[0], REST.shF[1] + sy],
          handN: [REST.fist[0], REST.fist[1] + fy],
        },
      }),
    });
  }

  // ---------------------------------------------------------------------------
  // The sources card (G8, art bible 9.1 and 9.4). Baselines and cap heights are the storyboard's, every line
  // centred on x 540. A block of lines shares one size, shrunk only if its widest line overflows the column
  // x 150 to 930 (the title card's column in 04): the G8 boxes are too narrow for these faces at these cap
  // heights ('Engadget, Restaurant Business' at cap 36 is about 800 px against a 580 px box).
  // ---------------------------------------------------------------------------
  const CX = 540;
  const COL_W = 780;
  const CAP = { note: 0.71, round: 0.74 }; // cap height as a share of the size (art bible 9)
  const SOURCES = { lines: ['Sources: Reuters / CNBC,', 'Engadget, Restaurant Business', 'Sept 29 – Oct 1, 2026'], base: [266, 312, 358], cap: 36, seed: 1800 };
  const CAVEAT = { lines: ['Reuters could not confirm the Fresno gap', 'came from the engine.'], base: [402, 432], cap: 24, seed: 1810 };
  const MARK = { str: 'Ideas & Technologies', base: 520, cap: 56, seed: 1820, at: 12 }; // at: frame of T 30.5

  // pad: extra width per unit of size (an ink outline adds 0.14, as in 04)
  function fitSize(ctx, L, lines, cap, face, pad = 0) {
    const size = cap / CAP[face];
    const w = Math.max(...lines.map((s) => L.letters(ctx, s, 0, 0, { size, face, measure: true }).w + pad * size));
    return w > COL_W ? (size * COL_W) / w : size;
  }

  function noteBlock(ctx, L, B) {
    const size = fitSize(ctx, L, B.lines, B.cap, 'note');
    B.lines.forEach((s, i) => L.letters(ctx, s, CX, B.base[i], { size, face: 'note', align: 'center', color: L.pal.ink, seed: B.seed + i }));
  }

  function drawCard(ctx, L, f) {
    const P = L.pal;
    // 6 one blob under the sources and the caveat, one under the channel mark
    L.plate(ctx, ID + '|blobs', (g) => {
      L.spot(g, CX, 334, 470, 128, { seed: L.hash(ID, 'spot', 1) & 0x7fffffff, irr: 0.08 });
      L.spot(g, CX, 505, 470, 44, { seed: L.hash(ID, 'spot', 2) & 0x7fffffff, irr: 0.08 });
    });
    // 7 sources and the caveat
    noteBlock(ctx, L, SOURCES);
    noteBlock(ctx, L, CAVEAT);
    // 8 the channel mark: six drawings on twos from T 30.5, complete on the sixth (T 30.917), then held
    if (f < MARK.at) return;
    const size = fitSize(ctx, L, [MARK.str], MARK.cap, 'round', 0.14);
    const colors = Array.from(MARK.str).map((c) => (c === 'I' || c === 'T' ? P.titleYellow : P.titleBlue));
    const p = Math.min(1, (((f - MARK.at) >> 1) + 1) / 6);
    L.letters(ctx, MARK.str, CX, MARK.base, { size, face: 'round', align: 'center', colors, outline: P.ink, seed: MARK.seed, p });
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib;
      const t = L.clamp(tIn, 0, info.dur);
      const f = Math.floor(t * 24 + 1e-6); // frame of the shot
      // 1-5 G1 at rest, the owner yawning; the tag swings on 01's global clock, on into the loop
      g1Scene(ctx, L, info.shot.start + t, ownerYawn(f));
      // 6-8 the sources card
      drawCard(ctx, L, f);
    },
  });
})();

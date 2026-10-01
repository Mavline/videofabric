// 01 booth-569: Cold open, the $5.69 booth. Global T 0.0 to 2.0 (the shot starts at 0, so t = T).
// Street plate (illustrated). Storyboard: docs/storyboard.md, "01 booth-569" and table G1; art bible 8.
//
// Layers, back to front:
//   1 the modest street, painted once (lib.plate): the fieldSky light field, two clouds, far hills, the tree,
//     the yellow house and its picket fence, pavement and kerb, and the booth's dark window
//   2 the owner's back layer, clipped to the window
//   3 the booth's front, painted once on a transparent plate: walls, planks, shelf, posts, awning, BURGERS
//   4 the owner's front layer: his near arm on the shelf
//   5 the $5.69 tag, rocking 2 degrees on twos
//   6 drawn effects behind the hero: speed lines, the tyre's streak, dust, the slam's speed lines
//   7 the coins on the shelf and the impact star
//   8 the hero on the bicycle (with his own shadow spot)
//
// Beats (shot frames, t = T): f0 the front wheel at x 40, pedalling on twos; f0-f11 rolls to the G1 stop mark,
// easing out on twos; f12-f13 the skid on ones, f14 the foot down, hold (eyes on the tag, a blink); f20 the
// hand goes to his pocket; f24 two coins up with a grin, a pop over 3 frames; f30 the wind-up; f35 the strike;
// f36 the slap on the shelf at (560, 1262), impact star f36-f37, the owner's brows rise, he leans in on twos
// (f38, f40); hold. The owner dozes off on his fist (his head sinks on twos) until the slap.
(function () {
  'use strict';
  const ID = 'booth-569';
  const DEG = Math.PI / 180;

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

  // The hero at G1's stop mark, the call from art bible section 8: h 510.6 puts his wheels at x 150 and 430
  // (radius 80) with his ground point (under the bottom bracket) at x 290.
  const HERO_H = 510.6;
  const STOP = 290;
  const COINS = [560, 1262]; // where the slapped coins land on the shelf (G1)

  // His joints, measured once from the anchors of his own poses (drawn through an empty clip), so the scene
  // follows the library when it refines his proportions. A pure function of the library; built on first use.
  let BASE = null;
  function heroBase(ctx, L) {
    if (BASE) return BASE;
    const m = (o) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, 0, 0);
      ctx.clip();
      const a = L.cast.hero(ctx, STOP, G1.ground, Object.assign({ h: HERO_H }, o));
      ctx.restore();
      return a;
    };
    const st = m({ pose: 'straddle' }), co = m({ pose: 'coins' }), ri = m({ pose: 'ride', phase: 0 });
    const s = HERO_H / 300; // his design units: standing height 300 (art bible 10.1)
    const D = (p) => [(p[0] - STOP) / s, (p[1] - G1.ground) / s];
    const neck = D(st.neck), chest = D(st.chest);
    BASE = {
      s,
      // the straddle's hip, from its chest anchor (60 percent of the way from the hip to the neck)
      hip: [(chest[0] - 0.6 * neck[0]) / 0.4, (chest[1] - 0.6 * neck[1]) / 0.4],
      neck,
      head: D(st.head),
      px: (u) => [STOP + u[0] * s, G1.ground + u[1] * s],
      frontDx: st.axleFront[0] - STOP, // bottom bracket to the front axle
      rearX: st.axleRear[0], // the rear tyre's contact with the pavement
      coinsHand: co.hand, // the raised fist of coins
      rideBack: ri.chest[0] - STOP - 0.14 * HERO_H, // the back of his shirt while he pedals
    };
    return BASE;
  }

  // the torso tipped over the bars about the straddle's hip by k * 46 degrees (back for k < 0), the head
  // following at half the angle; the shoulders by the library's own rule (12 units down the torso)
  function leanRig(B, k) {
    const a = 46 * DEG * k;
    const rot = (v, t) => [v[0] * Math.cos(t) - v[1] * Math.sin(t), v[0] * Math.sin(t) + v[1] * Math.cos(t)];
    const e = rot([B.neck[0] - B.hip[0], B.neck[1] - B.hip[1]], a);
    const neck = [B.hip[0] + e[0], B.hip[1] + e[1]];
    const hd = rot([B.head[0] - B.neck[0], B.head[1] - B.neck[1]], a * 0.5);
    const len = Math.hypot(e[0], e[1]);
    const dn = [(-e[0] * 12) / len, (-e[1] * 12) / len];
    return {
      neck, head: [neck[0] + hd[0], neck[1] + hd[1]],
      shN: [neck[0] + dn[0] + 3, neck[1] + dn[1]], shF: [neck[0] + dn[0] - 4, neck[1] + dn[1] - 1],
    };
  }

  // the roll-in: one position per drawing on twos, easing out into the stop mark at t 0.5, with speed left
  // for the skid to kill
  const rollX = (enter, d) => (d >= 6 ? STOP : enter + (STOP - enter) * (1 - Math.pow(1 - d / 6, 1.6)));

  // the owner: dozing on his fist (the head sinks on twos, one blink) until the slap; then the brows shoot up
  // and he jolts back (f36), and leans in on twos (f38 halfway, f40 there). His lower body is behind the
  // counter, so the lean moves the visible figure toward the coins with the head nodding over them.
  function ownerAt(f, d) {
    return (b, rest) => {
      const o = Object.assign({}, rest.o);
      let dx = 0;
      if (f < 36) {
        o.tilt = 0.2 + 0.008 * Math.min(15, Math.max(0, d - 2));
        if (f === 10 || f === 11) o.blink = true;
      } else {
        o.face = 'surprised';
        dx = f < 38 ? 10 : f < 40 ? -10 : -20;
        o.tilt = f < 38 ? 0.02 : f < 40 ? 0.22 : 0.3;
      }
      o.target = [rest.o.target[0] + dx, rest.o.target[1]];
      return { x: rest.x + dx, y: rest.y, o };
    };
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, C = L.cast;
      const t = L.clamp(tIn, 0, info.dur);
      const f = Math.floor(t * 24 + 1e-6); // frame of the shot, for the moves on ones
      const d = Math.floor(t * 12 + 1e-6); // drawing on twos
      const sd = (...k) => L.hash(ID, ...k) & 0x7fffffff;

      // 1-5 the street, the booth, the owner, the tag
      g1Scene(ctx, L, info.T, ownerAt(f, d));

      // the hero's drawing for this frame
      const B = heroBase(ctx, L);
      const enter = 40 - B.frontDx; // frame 0: the front wheel's centre at x 40
      const pocket = B.px([B.hip[0] + 16, B.hip[1] + 8]);
      const toCoins = (k) => [pocket[0] + (B.coinsHand[0] - pocket[0]) * k, pocket[1] + (B.coinsHand[1] - pocket[1]) * k];
      const strike = [COINS[0] - 60, COINS[1] - 72]; // the fist of coins over the shelf, one frame before the hit
      let x = STOP, ho;
      if (f < 12) {
        // pedalling in on twos: the crank turns a quarter a drawing, then he coasts the last two drawings
        x = rollX(enter, d);
        ho = { pose: 'ride', phase: Math.min(d, 3) * 0.25, wheel: (x - enter) / 80, face: 'smile', look: [0.6, -0.2] };
      } else if (f < 14) {
        // the skid, on ones: the bicycle tips back 4 degrees about the rear tyre, the foot planted ahead
        x = f === 12 ? STOP - 5 : STOP;
        ho = { pose: 'skid', face: 'determined', look: [0.7, -0.2] };
      } else if (f < 20) {
        // settled, foot down: eyes on the tag, a blink
        ho = { pose: 'straddle', face: 'smile', look: [0.55, -0.85], blink: f === 18 || f === 19 };
      } else if (f < 24) {
        // the anticipation: the hand drops to his pocket, eyes on the owner
        ho = { pose: 'coins', coins: false, face: 'smile', look: [1, -0.1], target: f < 22 ? toCoins(-0.5) : toCoins(0) };
      } else if (f < 30) {
        // coins up, a pop over 3 frames on ones: 60 percent, 8 percent past, home (the library's raised fist)
        const target = f === 24 ? toCoins(0.6) : f === 25 ? toCoins(1.08) : null;
        ho = { pose: 'coins', face: 'grin', look: [1, -0.1], target };
      } else if (f < 35) {
        // the wind-up on twos: the fist of coins goes back and up, the torso tips back
        const k = f < 32 ? 0.5 : 1;
        ho = { pose: 'coins', face: 'grin', look: [1, -0.1], target: [B.coinsHand[0] - 44 * k, B.coinsHand[1] - 30 * k], rig: leanRig(B, -0.2 * k) };
      } else if (f === 35) {
        // the strike, on ones: over the bars, the fist of coins already above the shelf
        ho = { pose: 'coins', face: 'grin', look: [1, 0.2], target: strike, rig: leanRig(B, 0.7) };
      } else {
        // the slap: the flat hand on the shelf, the coins out from under the fingers, held; a blink
        ho = { pose: 'slap', face: 'grin', look: [1, -0.3], target: [COINS[0] - 55, COINS[1] - 12], rig: leanRig(B, 1), blink: f === 44 || f === 45 };
      }

      // 6 drawn effects behind the hero
      if (f < 12) {
        const k = (rollX(enter, d + 1) - rollX(enter, d)) / (rollX(enter, 1) - rollX(enter, 0));
        L.speedLines(ctx, x + B.rideBack, 1236, 0, { n: 4, spread: 220, gap: 10, width: 5, len: [70 * k + 30, 170 * k + 40], seed: sd('speed', d) });
      }
      if (f >= 12) {
        // the tyre's streak on the pavement, behind the rear wheel's contact
        const len = f === 12 ? 40 : f === 13 ? 70 : 96;
        L.speedLines(ctx, B.rearX + 2, G1.ground + 4, 0, { n: 2, spread: 7, gap: 0, width: 6, len: [len * 0.8, len], seed: sd('skid') });
      }
      if (f >= 12 && f < 21) {
        const p = (f - 11) / 9;
        L.dust(ctx, B.rearX - 46, G1.ground - 22, { r: 78, p, dir: Math.PI + 0.25, n: 4, seed: sd('dust') });
        L.dust(ctx, B.rearX, G1.ground - 8, { r: 46, p, dir: Math.PI - 0.15, n: 3, seed: sd('dust', 2) });
      }
      if (f === 35) L.speedLines(ctx, strike[0] + 8, strike[1] - 62, Math.PI / 2, { n: 3, spread: 64, gap: 6, width: 6, len: [50, 90], seed: sd('slam') });

      // 7 the coins on the shelf, the impact star for 2 frames
      if (f >= 36) {
        L.props.coin(ctx, COINS[0], COINS[1] - 1, { w: 46, spin: 0.39, rot: Math.PI / 2, seed: 1 });
        L.props.coin(ctx, COINS[0] + 27, COINS[1] + 2, { w: 46, spin: 0.39, rot: Math.PI / 2, seed: 2 });
      }
      if (f === 36 || f === 37) L.impactStar(ctx, COINS[0] - 10, COINS[1] - 14, f === 36 ? 70 : 78, { rot: f === 36 ? 0 : 0.18, seed: sd('star') });

      // 8 the hero
      C.hero(ctx, x, G1.ground, Object.assign({ h: HERO_H, facing: 1 }, ho));
    },
  });
})();

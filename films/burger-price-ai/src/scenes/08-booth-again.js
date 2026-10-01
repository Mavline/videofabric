// 08 booth-again: Inside booth two, the same burger
// T 13.0 to 16.0 (shot-local t 0 to 3.0, 72 frames), schematic (the dense plate). Hard cut in from the
// mansion (07); hard cut out on the bar 9 downbeat, from the hero's eyes to the tag he is looking at (09).
// docs/storyboard.md, plan 08 with G2: the interior of 02 and 13 on the same pixels, the rich street in
// the window; the owner three-quarter from behind in the left foreground, the hero's face at the window.
// The tag hangs outside above the window and is never in this frame.
//
// Layers, back to front (the plates ride the camera on the push-in; the cels are redrawn larger, never
// scaled, their line rising from LINE to LINE_XCU):
//   1 the rich street through the window: 13's light plate, 13's code and seeds (the same street at two
//     moments)
//   2 the skid dust at the window's bottom edge (first 4 frames, on ones)
//   3 the hero outside, front view, the street line, clipped to the window opening; the burger in flight
//     through the window and its smear (f 37, f 38)
//   4 the inside: 02's dense plate, 02's code and seeds (the wall is the same painting in 02, 08 and 13)
//   5 on the counter: the burger, the coins, the telephone, the register (cels)
//   6 the owner from behind (cel); the whip smear and the tap marks (drawn effects)
//
// Beats, shot-local t = T - 13 (f = frame in the shot, t = f / 24):
//   t 0      (T 13.0,   f 0)  the hero skids into the window: lean, overshoot, settle (ones); dust on ones
//                             for 4 frames; then he pants on twos (mouth and a small heave)
//   t 0.5    (T 13.5,   f 12) he pops the same two coins up, 3 drawings on twos with an 8 percent
//                             overshoot, and grins; a blink at f 18
//   t 0.917  (f 22)           the owner draws the burger back a little (anticipation)
//   t 1.0    (T 14.0,   f 24) he pushes it from (330, 1080) to (500, 1080) on twos over 6 frames, his
//                             flat hand following it as in 02
//   t 1.417  (f 34)           the hero's hand draws back and opens (anticipation)
//   t 1.5    (T 14.5,   f 36) the snatch on ones over 3 frames: he grabs the burger, pulls it out through
//                             the window with a smear, and it is gone below the sill, as in 02; the coins
//                             drop on the sill at (620, 1092); a blink on the hold at f 44
//   t 1.917  (f 46)           the owner leans toward the window, his finger over the coins
//   t 2.0    (T 15.0,   f 48) he taps the coins, f 48 and f 51 (15.0 and 15.125, on ones), tap marks on
//                             the counter; the hero's grin drops
//   t 2.208  (f 53)           the arm whips up: a smear frame
//   t 2.25   (T 15.25,  f 54) he points straight up; the hero's eyes roll up after his finger
//   t 2.25-3 (f 54 to 71)     the snap push-in on ones, outExpo, zoom 1 to 6 onto the hero's eye midpoint
(() => {
  'use strict';
  const ID = 'booth-again';
  const IN_REF = 'owner-serves'; // 02 owns the interior: the wall, the frame and the counter are painted from its seeds
  const ST_REF = 'owner-ticket'; // 13's rich street: painted from its seeds, so 08 and 13 show the same street
  const sd = (...k) => FILM.lib.hash(ID, ...k) & 0x7fffffff;
  const sdIn = (...k) => FILM.lib.hash(IN_REF, ...k) & 0x7fffffff;
  const sdSt = (...k) => FILM.lib.hash(ST_REF, ...k) & 0x7fffffff;
  const FPS = 24;

  // ---- G2 at its pixels (02's numbers) ----
  const WIN = { x0: 240, y0: 560, x1: 840, y1: 1100 }; // window opening
  const FRAME = 30; // the frame around it
  const TOP = { y0: 1100, y1: 1170 }; // counter top across the whole width; its inner side runs to the bottom edge
  const OWN = { x: 92.5, y: 1636, h: 1167 }; // art bible 8: head at (180, 650), head height 210
  const HERO = { x: 560, y: 1483, h: 838 }; // art bible 8: hands on the sill at 465 and 655, y 1100
  const HS = HERO.h / 300; // one of the hero's design units in px
  const BURGER_W = 75 * HS; // in his hands the burger is 75 of his units (art bible 10.4)
  const BURGER_Y = 1080; // the burger path, on the counter
  const PUSH_X = [330, 500]; // 08's push: from (330, 1080) to (500, 1080)
  const COIN_W = 34 * HS; // the coins he holds up, at this scale
  const COINS = [[598, 1096, 1], [643, 1089, 2]]; // x, y, seed: lying flat on the sill around (620, 1092), as in 02
  const REG = [960, 1100]; // register x 860 to 1060, y 886 to 1100 at w 200
  const PHONE = [770, 1100]; // phone x 704 to 836, y 996 to 1100 at w 140
  const INNER = FILM.lib.mix(FILM.lib.pal.fence, FILM.lib.pal.trunk, 0.45); // the counter's inner side
  // the snap push-in, T 15.25 to 16.0: zoom 1 to 6 onto the hero's eye midpoint, on ones, outExpo
  const PUSH = { t0: 2.25, dur: 0.75, zoom: 6 };
  const TAP_TIP = [622, 1084]; // the owner's fingertip on the coins
  const TAP_LEAN = 0.3; // his lean toward the window for the taps (radians), as he leans in 02

  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

  // ---- layer 1: the rich street through the window (13's street(), 13's seeds) ----
  // a background object as the street plate paints one: an opaque wash with brush marks, a pencil edge
  function wash(g, L, pts, color, seed) {
    L.softWash(g, pts, { color, solid: true, marks: 0.6, rim: 0.12, seed });
    L.pencil(g, pts, { closed: true, base: color, seed: seed + 1, width: 2 });
  }
  // a band of water along a polyline, w0 wide at the start and w1 at the end (as in 06 and 11)
  function waterBand(g, L, pts, w0, w1, seed) {
    const left = [], right = [];
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const w = L.lerp(w0, w1, i / (pts.length - 1)) / 2;
      left.push([p[0] - ((b[1] - a[1]) / d) * w, p[1] + ((b[0] - a[0]) / d) * w]);
      right.push([p[0] + ((b[1] - a[1]) / d) * w, p[1] - ((b[0] - a[0]) / d) * w]);
    });
    const poly = left.concat(right.reverse());
    L.softWash(g, poly, { color: L.pal.waterTop, alpha: 0.95, soft: 2, marks: 0.3, rim: 0, seed });
    L.pencil(g, poly, { closed: true, color: L.pal.waterDeep, width: 2, seed: seed + 1 });
  }
  function drop(g, L, x, y, r) {
    g.fillStyle = L.pal.waterTop;
    g.strokeStyle = L.pal.waterDeep;
    g.lineWidth = 1.8;
    g.beginPath();
    g.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  const halfEll = (cx, cy, rx, ry, n = 24) => Array.from({ length: n + 1 }, (_, i) => [cx + rx * Math.cos((i / n) * Math.PI), cy + ry * Math.sin((i / n) * Math.PI)]);

  // the rich house on the right, two of its portico columns in the opening; on the left a fountain's
  // spray over clipped bushes. The ground is under the sill.
  const HOUSE = { x: 805, y: 1150, h: 480 };
  const FX = 380, BOWL_Y = 1040, BOWL_R = 40, JET = 190, JET_S = 80;
  function street(ctx, L, P, R) {
    L.plate(ctx, `${ID}|street|13`, (g) => {
      g.translate(-WIN.x0, -WIN.y0);
      g.fillStyle = P.fieldSky;
      g.fillRect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);
      L.softWash(g, L.blobPts(330, 620, 80, 21, sdSt(1), 0.2), { color: P.paper, alpha: 0.85, soft: 12, seed: sdSt(2) });
      L.softWash(g, L.blobPts(600, 598, 58, 17, sdSt(3), 0.2), { color: P.paper, alpha: 0.85, soft: 12, seed: sdSt(4) });
      L.softWash(g, [[200, 952], [380, 930], [600, 948], [880, 924], [880, 1040], [200, 1040]], { color: P.hillsFar, soft: 8, seed: sdSt(5) });
      L.softWash(g, L.densify([[200, 1030], [880, 1022], [880, 1130], [200, 1130]], 24), { color: P.grass, alpha: 0.62, soft: 6, marks: 0.7, seed: sdSt(6) });
      R.house(g, HOUSE.x, HOUSE.y, { h: HOUSE.h, kind: 'rich', gate: false, fountain: false });
      // the fountain's upper bowl on its pedestal; the basin is below the sill
      wash(g, L, L.rectPts(FX - 11, BOWL_Y + 4, 22, 120, 4), P.stone, sdSt(10));
      wash(g, L, halfEll(FX, BOWL_Y, BOWL_R, 17, 20), P.stone, sdSt(11));
      wash(g, L, L.ellipsePts(FX, BOWL_Y, BOWL_R, 8, 40), L.mix(P.stone, P.paper, 0.45), sdSt(12));
      L.softWash(g, L.ellipsePts(FX, BOWL_Y + 1, BOWL_R - 8, 4, 32), { color: P.waterTop, solid: true, marks: 0, rim: 0, seed: sdSt(13) });
      // the spray: a centre jet with a crown spilling both ways, two arcs out of the bowl, drops
      const top = BOWL_Y - 4 - JET;
      waterBand(g, L, Array.from({ length: 9 }, (_, i) => [FX, L.lerp(BOWL_Y - 2, top, i / 8)]), 15, 9, sdSt(14));
      for (const sx of [-1, 1]) {
        const crown = Array.from({ length: 9 }, (_, i) => {
          const u = i / 8;
          return [FX + sx * (7 + 0.3 * JET * u), top + 4 + 0.42 * JET * u * u - 0.05 * JET * u * (1 - u)];
        });
        waterBand(g, L, crown, 9, 4, sdSt(15, sx));
        [[0.36, 0.5, 5], [0.4, 0.66, 4], [0.43, 0.82, 3.5]].forEach(([ux, uy, r]) => drop(g, L, FX + sx * ux * JET, top + uy * JET, r));
        const arc = Array.from({ length: 13 }, (_, i) => {
          const u = i / 12;
          return [L.lerp(FX + sx * 22, FX + sx * 100, u), BOWL_Y - 2 - 4 * JET_S * u * (1 - u) + 60 * u * u];
        });
        waterBand(g, L, arc, 10, 5, sdSt(16, sx));
      }
      drop(g, L, FX - 5, top - 12, 4.5);
      drop(g, L, FX + 8, top - 21, 3.5);
      // round clipped bushes in front, a shade deeper than the lawn
      [[FX - 118, 1086, 54, 44], [FX + 118, 1090, 50, 40], [560, 1094, 44, 34], [FX, 1100, 40, 30]].forEach(([x, y, rx, ry], i) => {
        const pts = L.blobPts(x, y, rx, ry, sdSt(20, i), 0.07);
        L.softWash(g, pts, { color: P.grass, alpha: 0.96, soft: 4, marks: 0.8, angle: -0.6, seed: sdSt(21, i) });
        L.pencil(g, pts, { closed: true, base: P.grass, seed: sdSt(22, i), width: 2 });
      });
    }, { x: WIN.x0, y: WIN.y0, w: WIN.x1 - WIN.x0, h: WIN.y1 - WIN.y0 });
  }

  // ---- layer 4: the inside, a dense plate with the window cut out (02's inside(), 02's seeds) ----
  function inside(ctx, L, P) {
    L.plate(ctx, `${ID}|inside|02`, (g) => {
      const fx0 = WIN.x0 - FRAME, fy0 = WIN.y0 - FRAME, fx1 = WIN.x1 + FRAME;
      L.dense(g, [rect(0, 0, 1080, TOP.y0), rect(fx0, fy0, fx1, TOP.y0)], { bounds: [0, 0, 1080, TOP.y0], base: P.wallWarm, dir: 'vertical', seed: sdIn(10) });
      L.dense(g, null, { bounds: [fx0, fy0, fx1 - fx0, FRAME], base: P.shadowWarm, dir: 'horizontal', seed: sdIn(11) });
      L.dense(g, null, { bounds: [fx0, WIN.y0, FRAME, TOP.y0 - WIN.y0], base: P.shadowWarm, dir: 'vertical', seed: sdIn(12) });
      L.dense(g, null, { bounds: [WIN.x1, WIN.y0, FRAME, TOP.y0 - WIN.y0], base: P.shadowWarm, dir: 'vertical', seed: sdIn(13) });
      L.ragged(g, L.densify([[fx0, TOP.y0], [fx0, fy0], [fx1, fy0], [fx1, TOP.y0]], 20, false), { base: P.wallWarm, width: 5, seed: sdIn(14) });
      L.ragged(g, L.densify([[WIN.x0, TOP.y0], [WIN.x0, WIN.y0], [WIN.x1, WIN.y0], [WIN.x1, TOP.y0]], 20, false), { base: P.shadowWarm, width: 4, seed: sdIn(15) });
      L.dense(g, null, { bounds: [0, TOP.y0, 1080, TOP.y1 - TOP.y0], base: P.fence, dir: 'horizontal', seed: sdIn(16) });
      L.dense(g, null, { bounds: [0, TOP.y1, 1080, 1920 - TOP.y1], base: INNER, dir: 'vertical', seed: sdIn(17) });
      L.ragged(g, [[0, TOP.y0], [1080, TOP.y0 - 1]], { base: P.fence, width: 4, seed: sdIn(18) });
      L.ragged(g, [[0, TOP.y1], [1080, TOP.y1 + 1]], { base: P.fence, width: 5, seed: sdIn(19) });
      g.save();
      g.globalCompositeOperation = 'destination-out';
      g.fillRect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);
      g.restore();
    });
  }

  // ---- the owner's lean toward the window (02's ownerRig without the sag): rigOwner's defaults for the
  // joints it moves (his design units, y up negative); from behind, cast.owner hangs the shoulders on the
  // hip-to-neck line, so they follow the neck ----
  const O = { hip: [0, -194], neck: [12, -310], head: [30, -338] };
  function ownerLean(lean) {
    if (!lean) return undefined; // upright he is cast.owner's own drawing
    const c = Math.cos(lean), s = Math.sin(lean);
    const turn = (p) => {
      const x = p[0] - O.hip[0], y = p[1] - O.hip[1];
      return [O.hip[0] + x * c - y * s, O.hip[1] + x * s + y * c];
    };
    return { neck: turn(O.neck), head: turn(O.head) };
  }

  // ---- memoized geometry, t-independent, measured on the cast's own anchors (drawn once on a scratch
  // canvas), so a change of the characters' drawings moves these points with them:
  //   eyeMid    the hero's eye midpoint at zoom 1, the push-in target
  //   tapWrist  the owner's wrist target, leaning, that puts his fingertip on the coins ----
  let GEO = null;
  function geo(L) {
    if (GEO) return GEO;
    const g = FILM.makeCanvas(1, 1).getContext('2d');
    const a = L.cast.hero(g, HERO.x, HERO.y, { h: HERO.h, pose: 'sill', target: [0, TOP.y0], face: 'O', plate: 'street', shadow: false });
    let w = [548, 1016];
    for (let i = 0; i < 6; i++) {
      const b = L.cast.owner(g, OWN.x, OWN.y, { h: OWN.h, view: 'back', pose: 'tap', target: w, k: 0, rig: ownerLean(TAP_LEAN), shadow: false });
      w = [w[0] + TAP_TIP[0] - b.hand[0], w[1] + TAP_TIP[1] - b.hand[1]];
    }
    GEO = { eyeMid: [(a.eye[0] + a.eyeFar[0]) / 2, (a.eye[1] + a.eyeFar[1]) / 2], tapWrist: w };
    return GEO;
  }

  // ---- the burger's centre on the counter (frame px at zoom 1), or null once the hero has it (f 37) ----
  function burgerOnCounter(f, L) {
    if (f > 36) return null;
    if (f < 22) return [PUSH_X[0], BURGER_Y];
    if (f < 24) return [PUSH_X[0] - 14, BURGER_Y]; // drawn back before the push
    // the push on twos over 6 frames, easing out as in 02 (outCubic): drawings at f 24, 26, 28, at rest from f 30
    return [L.lerp(PUSH_X[0], PUSH_X[1], L.ease.outCubic(Math.min(1, Math.floor((f - 24) / 2) / 3))), BURGER_Y];
  }

  // ---- the hero: options for cast.hero at zoom 1 (rig in his design units, x to the frame's right),
  // the skid offset, and the burger the scene draws in flight (f 37) ----
  const D = (p) => [(p[0] - HERO.x) / HS, (p[1] - HERO.y) / HS];
  const SILL_V = (TOP.y0 - HERO.y) / HS;
  const COIN_HAND = [62, -252]; // the fist of coins held up beside his face
  const COIN_HOLD = [65, -274];
  function heroState(f, t, L) {
    const o = { pose: 'sill', face: 'grin', look: [-0.55, 0.15] };
    let dx = 0, dy = 0, rot = 0, burger = null;
    const rig = {};
    const sillN = [34, SILL_V], sillF = [-34, SILL_V];
    if (f < 12) {
      // the arrival: a skid lean on ones, an overshoot, the settle; then panting on twos
      const lean = [[-46, -0.06], [-16, -0.025], [8, 0.02], [8, 0.02]][f] || [0, 0];
      dx = lean[0];
      rot = lean[1];
      o.face = 'pant';
      o.t = t;
      if (f >= 4 && Math.floor(L.onTwos(t) * 6) % 2 === 0) dy = -6; // the chest heaves with the open mouth
    } else if (f < 34) {
      // the coins pop up: 3 drawings on twos with an 8 percent overshoot, then held up
      const k = [0.72, 0.72, 1.08, 1.08][f - 12] || 1;
      rig.handN = [L.lerp(sillN[0], COIN_HAND[0], k), L.lerp(sillN[1], COIN_HAND[1], k)];
      rig.hold = [L.lerp(sillN[0], COIN_HOLD[0], k), L.lerp(sillN[1], COIN_HOLD[1], k)];
      rig.elbowN = [1, 0.3];
      o.coins = true;
      if (f === 18 || f === 19) o.blink = true;
      if (f >= 24) o.look = f < 30 ? [-0.45, 0.55] : [-0.25, 0.8]; // his eyes follow the burger along the counter
      if (f >= 30) o.face = 'lick';
    } else if (f < 36) {
      // anticipation: the snatching hand draws back and opens; the coins still up
      rig.handN = COIN_HAND;
      rig.hold = COIN_HOLD;
      rig.elbowN = [1, 0.3];
      rig.handF = [sillF[0] - 16, sillF[1] - 20];
      rig.kindF = 'open';
      rig.elbowF = [-1, 0.1];
      o.coins = true;
      o.face = 'determined';
      o.look = [-0.25, 0.8];
    } else if (f === 36) {
      // the snatch, drawing 1: his hand behind the burger on the counter, the coins let go on the sill
      rig.handF = D([PUSH_X[1] - 66, BURGER_Y - 66]);
      rig.kindF = 'open';
      rig.elbowF = [-1, -0.2];
      rig.handN = D([636, 1066]);
      rig.kindN = 'open';
      rig.elbowN = [1, 0.2];
      o.face = 'open';
      o.look = [-0.3, 0.8];
    } else if (f === 37) {
      // drawing 2: he pulls it out through the window to his chest, both hands on it
      burger = [556, 1010];
      rig.handF = D([burger[0] - 0.5 * BURGER_W - 14, burger[1] + 8]);
      rig.handN = D([burger[0] + 0.5 * BURGER_W + 14, burger[1] + 4]);
      rig.kindN = rig.kindF = 'fist';
      rig.elbowN = [1, 0.5];
      rig.elbowF = [-1, 0.5];
      o.look = [0, 0.8];
    } else {
      // drawing 3: gone below the sill, in both hands; he beams down at it, then freezes at the taps
      rig.handN = [22, SILL_V + 26];
      rig.handF = [-22, SILL_V + 26];
      rig.elbowN = [1, 0.4];
      rig.elbowF = [-1, 0.4];
      o.look = [0.04, 0.85];
      if (f === 44 || f === 45) o.blink = true;
      if (f >= 48) {
        // the owner's taps on the coins: his grin drops, his eyes go to the finger
        o.face = 'neutral';
        o.look = [0.45, 0.85];
      }
      if (f >= 53) o.face = 'O';
      if (f === 53) o.look = [0.2, -0.5]; // his eyes roll up after the finger
      if (f === 54) o.look = [-0.1, -0.95];
      if (f >= 55) o.look = [0, -1];
    }
    o.rig = rig;
    return { o, dx, dy, rot, burger };
  }

  // ---- the owner: pose, wrist target (frame px at zoom 1), lean, head tilt ----
  function ownerState(f, L, G) {
    if (f < 46) {
      // the push: his flat hand follows the burger, as in 02; then it rests where the push ended
      const b = burgerOnCounter(f, L) || [PUSH_X[1], BURGER_Y];
      // on the holds his head sinks, drawing by drawing; it lifts for the push
      const tilt = f < 8 ? 0.12 : f < 12 ? 0.15 : f < 16 ? 0.18 : f < 22 ? 0.21 : f < 40 ? 0.1 : 0.14;
      return { pose: 'push', target: [b[0] - 196, 1078], lean: 0, tilt, tap: -1 };
    }
    if (f < 53) {
      // he leans to the coins (twos), then taps down on f 48 and f 51 (15.0 and 15.125, on ones)
      const down = f === 48 || f === 49 || f === 51 || f === 52;
      return { pose: 'tap', target: G.tapWrist, k: down ? 0 : 0.75, lean: f < 48 ? 0.15 : TAP_LEAN, tilt: 0.04, tap: f === 48 || f === 51 ? 0 : f === 49 || f === 52 ? 1 : -1 };
    }
    // f 53 whips up (a smear frame, already pointing); from f 54 he points straight up
    return { pose: 'point', lean: 0, whip: f === 53, tap: -1 };
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal, C = L.cast, R = L.props;
      const t = L.clamp(tIn, 0, info.dur);
      const f = Math.min(71, Math.floor(t * FPS + 1e-6)); // frame in the shot, for the actions on ones
      const G = geo(L);

      // the camera: locked until the push-in, then on ones toward the eye midpoint
      const e = t < PUSH.t0 ? 0 : L.ease.outExpo(L.clamp((t - PUSH.t0) / PUSH.dur));
      const z = 1 + (PUSH.zoom - 1) * e;
      const cx = L.lerp(540, G.eyeMid[0], e), cy = L.lerp(960, G.eyeMid[1], e);
      const S = (p) => [(p[0] - cx) * z + 540, (p[1] - cy) * z + 960];
      const lw = L.lerp(L.LINE, L.LINE_XCU, L.clamp((z - 1) / 5));
      const clipWindow = () => {
        const a = S([WIN.x0, WIN.y0]), b = S([WIN.x1, WIN.y1]);
        ctx.beginPath();
        ctx.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        ctx.clip();
      };

      // 1 the street
      L.camera(ctx, { x: cx, y: cy, zoom: z }, (c) => street(c, L, P, R));

      // 2 the skid dust rising at the window's bottom edge, on ones for 4 frames
      if (f < 4) {
        ctx.save();
        clipWindow();
        L.dust(ctx, 446, 1004, { r: 112, p: 0.12 + f * 0.22, dir: Math.PI + 0.5, seed: sd('dust', 1) });
        L.dust(ctx, 688, 1008, { r: 66, p: 0.2 + f * 0.22, dir: -0.5, n: 3, seed: sd('dust', 2) });
        ctx.restore();
      }

      // 3 the hero outside, clipped to the window; the burger in flight through it and the smear after it
      const hs = heroState(f, t, L);
      const g0 = S([HERO.x + hs.dx, HERO.y + hs.dy]);
      // the sill target stays put, so on the heave the body rises and the hands stay on the sill
      const opt = Object.assign({}, hs.o, { h: HERO.h * z, line: lw, plate: 'street', shadow: false, target: [0, S([0, TOP.y0])[1]] });
      if (hs.rot) opt.rot = hs.rot;
      if (opt.coins) {
        delete opt.coins;
        opt.hold = (g, a) => {
          const s = (HERO.h * z) / 300;
          R.coin(g, a.hold[0] - 10 * s, a.hold[1] + 2 * s, { w: 34 * s, rot: -0.3, seed: 1, line: lw, plate: 'street' });
          R.coin(g, a.hold[0] + 11 * s, a.hold[1] - 4 * s, { w: 34 * s, rot: 0.25, seed: 2, line: lw, plate: 'street' });
        };
      }
      ctx.save();
      clipWindow();
      C.hero(ctx, g0[0], g0[1], opt);
      if (hs.burger) {
        const bp = S(hs.burger);
        R.burger(ctx, bp[0], bp[1], { w: BURGER_W * z, line: lw, plate: 'street' });
      }
      if (f === 38) L.smear(ctx, [[556, 990], [558, 1046], [560, 1104]], { colors: [P.bun, P.skinKid, P.bun], width: 150, alpha: 0.8, seed: sd('smear', 2) });
      ctx.restore();

      // 4 the inside; deep in the push-in (from f 57) the opening fills the frame and the wall is out of it
      const wa = S([WIN.x0, WIN.y0]), wb = S([WIN.x1, WIN.y1]);
      if (!(wa[0] <= 0 && wa[1] <= 0 && wb[0] >= 1080 && wb[1] >= 1920)) L.camera(ctx, { x: cx, y: cy, zoom: z }, (c) => inside(c, L, P));

      // 5 on the counter: the snatch smear (f 37), the burger, the coins, the telephone, the register
      if (f === 37) L.smear(ctx, [[PUSH_X[1] - 20, BURGER_Y + 40], [PUSH_X[1] + 10, BURGER_Y + 10], [556, 1030]], { colors: [P.bun, P.skinKid, P.bun], width: 150, seed: sd('smear', 1) });
      const bc = burgerOnCounter(f, L);
      if (bc) R.burger(ctx, bc[0], bc[1], { w: BURGER_W });
      if (f >= 36) {
        COINS.forEach(([x, y, seed]) => {
          const p = S([x, y]);
          R.coin(ctx, p[0], p[1], { w: COIN_W * z, spin: 1 / 3, rot: Math.PI / 2, seed, line: lw });
        });
      }
      const ph = S(PHONE);
      if (ph[0] - 70 * z < 1080 && ph[1] - 110 * z < 1920) R.phone(ctx, ph[0], ph[1], { w: 140 * z, line: lw });
      const rg = S(REG);
      if (rg[0] - 100 * z < 1080 && rg[1] - 220 * z < 1920) R.register(ctx, rg[0], rg[1], { w: 200 * z, line: lw });

      // 6 the owner from behind; he is out of the frame once the push-in is under way (zoom 2.6 on f 55)
      if (z < 2.2) {
        const os = ownerState(f, L, G);
        const oo = { h: OWN.h * z, view: 'back', pose: os.pose, line: lw, ground: INNER };
        if (os.target) oo.target = S(os.target);
        if (os.k != null) oo.k = os.k;
        if (os.tilt != null) oo.tilt = os.tilt;
        const rig = ownerLean(os.lean);
        if (rig) oo.rig = rig;
        if (os.whip) L.smear(ctx, [S([606, 1070]), S([440, 1012]), S([330, 860]), S([250, 600]), S([200, 420])], { colors: [P.skin, P.pink], width: 80, seed: sd('whip') });
        const og = S([OWN.x, OWN.y]);
        const a = C.owner(ctx, og[0], og[1], oo);
        // tiny tap marks: the coins clack on the counter, short strokes out from under them onto the light
        // counter top, 2 frames a tap, spreading on the second
        if (os.tap >= 0) {
          const tip = a.hand;
          const r0 = os.tap ? 66 : 56;
          [0.3, 1.15, 2.45].forEach((ang, i) => {
            const c = Math.cos(ang), s = Math.sin(ang);
            L.stroke(ctx, [[tip[0] + c * r0, tip[1] + s * r0], [tip[0] + c * (r0 + 22), tip[1] + s * (r0 + 22)]], { width: L.LINE, taper: [2, 6], seed: sd('tap', i, os.tap) });
          });
        }
      }
    },
  });
})();

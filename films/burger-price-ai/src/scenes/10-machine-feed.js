// 10 machine-feed: The pricing machine eats. T 18.0 to 20.0 (t = T - 18), schematic (machine plate).
// Comes up from black: the ink flash is the timeline's transitionIn, drawn by core; frame 0 here is full.
// Layers, back to front:
//   1 the room, a cached plate: nightSky wall under dense strokes, pavement floor from y 1480, and the
//     G3 wall map (x 80 to 1000, y 400 to 700: a pale land, 140 restaurants, a dozen booths, two pins)
//   2 T 18.5: the map's red dots pulse to 1.3 and back, seeded phases, redrawn over the cached map
//   3 the G3 machine (h 660 from (540, 1480)): periscope down, needle at LOW, a 1 px hum on twos,
//     gulps on 19.0 and 19.5 (on ones)
//   4 the purchase stream: seven streams of receipts and coins leap from the dots and fall into the
//     hopper's mouth (on ones)
//   5 the captions (G8): nearly 14,000 restaurants (18.25) / millions of orders a day (18.5)
(() => {
  'use strict';
  const ID = 'machine-feed';

  // beats, shot-local
  const B_CAP1 = 0.25; // T 18.25: caption line 1 pops
  const B_CAP2 = 0.5; // T 18.5 (beat): caption line 2 pops, the dots pulse
  const GULPS = [1.0, 1.5]; // T 19.0 and 19.5 (beats)
  const B_GLANCE = 1.75; // T 19.75: the eye glances right, toward the street the periscope shows next

  // the purchase stream: seven streams fanned across the map, one per column; each leaps from one
  // seeded dot for 8 launches (1 s), then moves to another; a launch on every 16th, each flight 0.75 s,
  // so about 40 are in the air. The streams stop one by one (the last launch of each, below), the
  // last launches are coins only, and the last two dive in on T 20.0
  const STEP = 0.125;
  const FLIGHT = 0.75;
  const STREAMS = 7;
  const HOLD = 8;
  const LAST = [8, 10, 7, 9, 6, 10, 8]; // launch index t / STEP of each stream's last item
  const APEX_MIN = 415; // no leap rises into the captions (they end at y 390)

  // The room and the wall map of storyboard G3. Shot 12 draws the same room: copy these two verbatim.
  const MAP = { x: 80, y: 400, o: { w: 920, h: 300, n: 140, dotR: 7, mono: true, booths: 12, style: 'land', pinned: true, seed: 9, plate: 'machine' } };
  function drawRoom(g, L) {
    const P = L.pal;
    L.dense(g, null, { bounds: [0, 0, 1080, 1480], base: P.nightSky, dir: 'vertical', seed: 21 });
    L.dense(g, null, { bounds: [0, 1480, 1080, 440], base: P.pavement, dir: 'perspective', vp: [540, 900], seed: 22 });
    L.ragged(g, [[0, 1480], [1080, 1478]], { base: P.nightSky, seed: 4 });
    L.props.map(g, MAP.x, MAP.y, MAP.o);
  }

  // the map's dots (pure: the same call as in the plate, drawn once into a throwaway canvas)
  let DOTS = null;
  const mapDots = (L) => DOTS || (DOTS = L.props.map(FILM.makeCanvas(1, 1).getContext('2d'), MAP.x, MAP.y, MAP.o).dots);

  // every red dot pops 1.18, 1.3, 1.1 on twos (6 frames) after a seeded delay of 0, 2, 4 or 6 frames,
  // so the pulse ripples over the map and is over by the gulp on 19.0; booths (the first dots) stay
  function pulse(ctx, L, t, dots) {
    const f = Math.floor((t - B_CAP2) * 24 + 1e-6);
    if (f < 0 || f >= 12) return;
    const r0 = MAP.o.dotR;
    for (let i = MAP.o.booths; i < dots.length; i++) {
      const d = f - 2 * Math.floor(L.rng(L.hash(ID, 'pulse', i))() * 4);
      if (d < 0 || d >= 6) continue;
      const r = r0 * [1.18, 1.3, 1.1][d >> 1];
      // the map's own dot drawing (props.map), larger: same fill, line and seed
      L.cel(ctx, L.ellipsePts(dots[i].x, dots[i].y, r, r, 18, 0), { fill: L.pal.red, width: Math.min(L.LINE, r0 * 0.42), seed: 4600 + i });
    }
  }

  // the gulp's three drawings on ones from each beat: squeeze and squash, swell, settle
  function gulpK(t) {
    for (const b of GULPS) {
      const f = Math.floor((t - b) * 24 + 1e-6);
      if (f >= 0 && f < 3) return (f + 0.5) / 3;
    }
    return null;
  }

  // each stream's dots: the column's dots low enough to leap 60 px or more (pure, built once)
  let COLS = null;
  function columns(dots) {
    if (COLS) return COLS;
    COLS = [];
    for (let m = 0; m < STREAMS; m++) {
      const x0 = MAP.x + (m * MAP.o.w) / STREAMS, x1 = x0 + MAP.o.w / STREAMS;
      const col = dots.filter((d) => d.x >= x0 && d.x < x1);
      const low = col.filter((d) => d.y >= APEX_MIN + 60);
      COLS.push(low.length ? low : col);
    }
    return COLS;
  }

  // receipts and coins on parabolas from the stream's dot into the hopper's mouth, newest first so
  // the ones diving in lie on top; clipped to above the mouth's front rim so each drops in. On ones
  // (a fall is fast action, art bible 7.1): on twos each item would move 2/3 of the gap to the next
  // one per drawing, and the stream would seem to crawl backward
  function stream(ctx, L, t, dots, mouth) {
    const R = L.props;
    const cols = columns(dots);
    const tq = Math.floor(t * 24 + 1e-6) / 24;
    const jLast = Math.floor(tq / STEP + 1e-6);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 1080, mouth[1]);
    ctx.ellipse(mouth[0], mouth[1], 220, 18, 0, 0, Math.PI * 2);
    ctx.clip();
    for (let j = jLast; j >= jLast - Math.ceil(FLIGHT / STEP); j--) {
      const age = tq - j * STEP;
      if (age < 0 || age >= FLIGHT) continue;
      const u = age / FLIGHT;
      for (let m = 0; m < STREAMS; m++) {
        if (j > LAST[m]) continue;
        // the stream's dot and leap for this stretch of launches (staggered so they never all move at once)
        const ra = L.rng(L.hash(ID, 'arc', m, Math.floor((j + ((m * 3) % HOLD)) / HOLD)));
        const col = cols[m];
        const d = col[Math.floor(ra() * col.length)];
        const lift = L.lerp(60, 140, ra());
        // this item: a few px of scatter about the stream's arc
        const r = L.rng(L.hash(ID, 'item', j, m));
        const coin = j >= 9 || r() < 0.5;
        const xl = 520 + (m - 3) * 34 + (r() - 0.5) * 8, yl = mouth[1] + 45;
        // apex A px above the dot: y = y0 + v u + g u^2 with y(1) = yl and a top at y0 - A
        const A = Math.max(0, Math.min(lift, d.y - APEX_MIN) + (r() - 0.5) * 8);
        const D = yl - d.y;
        const g = Math.pow(Math.sqrt(A) + Math.sqrt(A + D), 2);
        const x = L.lerp(d.x, xl, u), y = d.y + (D - g) * u + g * u * u;
        const ph = r(), wob = L.lerp(4, 9, r());
        if (coin) R.coin(ctx, x, y, { w: 24, spin: (ph + age * 1.6) % 1, rot: (ph - 0.5) * 0.6, seed: j * 8 + m });
        else R.receipt(ctx, x, y, { w: 26, rot: Math.sin(ph * 6.28 + age * wob) * 0.6, seed: j * 8 + m });
      }
    }
    ctx.restore();
  }

  // a white handwritten line (art bible 9.2) at left edge x, fitted into maxW, popping with outBack
  // over 3 frames on ones from t0; it grows from its left edge, so the 9 percent overshoot stays
  // inside the safe area
  function caption(ctx, L, str, x, base, maxW, t0, t, seed) {
    if (t < t0 - 1e-6) return;
    const f = Math.floor((t - t0) * 24 + 1e-6);
    const s = f < 3 ? L.ease.outBack((f + 1) / 3) : 1;
    const o = { size: 52 / 0.71, face: 'note', color: L.pal.white, seed };
    const w = L.letters(ctx, str, x, base, Object.assign({ measure: true }, o)).w;
    if (w > maxW) o.size *= maxW / w;
    const cy = base - o.size * 0.36;
    ctx.save();
    ctx.translate(x, cy);
    ctx.scale(s, s);
    ctx.translate(-x, -cy);
    L.letters(ctx, str, x, base, o);
    ctx.restore();
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib;
      const t = L.clamp(tIn, 0, info.dur);
      const dots = mapDots(L);

      // 1 the room and the wall map
      L.plate(ctx, ID + '|room', (g) => drawRoom(g, L));

      // 2 the dots pulse (T 18.5)
      pulse(ctx, L, t, dots);

      // 3 the machine: a 1 px hum on twos, the gulps on ones; on the hold the eye acts (art bible 7.2):
      // it watches the stream, shuts for exactly 2 frames on the first gulp, glances right before the cut
      const k = gulpK(t);
      const hum = Math.floor(t * 12 + 1e-6) % 2;
      const fg = Math.floor((t - GULPS[0]) * 24 + 1e-6);
      const m = L.cast.machine(ctx, 540 + hum, 1480, {
        h: 660, pose: k == null ? 'idle' : 'gulp', k: k == null ? 0 : k, t, scope: 0, level: 0,
        look: t < B_GLANCE ? [-0.8, -0.5] : [0.85, -0.2], blink: fg === 0 || fg === 1, ground: L.pal.pavement,
      });

      // 4 the purchase stream into the hopper's mouth
      stream(ctx, L, t, dots, m.hopper);

      // 5 the captions (G8 boxes x 80 to 800 and x 80 to 780)
      caption(ctx, L, 'nearly 14,000 restaurants', 80, 300, 720, B_CAP1, t, 1001);
      caption(ctx, L, 'millions of orders a day', 80, 375, 700, B_CAP2, t, 1002);
    },
  });
})();

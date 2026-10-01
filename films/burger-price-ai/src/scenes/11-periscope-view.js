// 11 periscope-view: The periscope looks at the street.
// T 20.0 to 21.0 (24 frames), illustrated (street plate). Hard cut in from 10, hard cut out to 12.
// The machine's point of view: a full ink field with a round hole (centre 540, 900, radius 400, a 10 px
// slate rim) and inside it the rich street on the light plate: the fountain on the lawn, a cypress,
// clipped bushes, the stone portico with its columns. The street slides 600 px left (20.0 to 20.5,
// inOutSine, 24 fps), locks on the beat with a 6 px overshoot, holds; the eyelid blinks at 20.875.
// The G7 caption pops at 20.25 and stays on the same pixels into 12.
//
// Layers, back to front:
//   1. the street plate (painted once, cached), sliding left inside the round view
//   2. the eyelid: ink over the view from its top, 20.875 to the cut, on ones
//   3. the ink matte with the round hole, and the slate rim (screen-fixed)
//   4. the G7 caption in white (screen-fixed)
(() => {
  'use strict';
  const ID = 'periscope-view';
  const FPS = 24;
  // the round view (storyboard 11)
  const CX = 540, CY = 900, R = 400, RIM = 10;
  // shot-local frames (frame 0 = T 20.0)
  const PAN = 600; // px the street slides left
  const PAN_END = 12; // T 20.5, the beat: the view stops
  const OVER = [6, 2]; // px past the stop on frames 12 and 13, then held at 600
  const CAPTION_AT = 6; // T 20.25
  const BLINK_AT = 21; // T 20.875
  const LID = [0.55, 1, 0.45]; // lid closure on frames 21, 22, 23, on ones
  // the street plate in street coordinates (frame pixels on frame 0), covering every frame of the pan
  const X0 = CX - R - 10, Y0 = CY - R - 10;
  const PW = 2 * R + PAN + OVER[0] + 20, PH = 2 * R + 20;
  // the rich house: its portico, centred on x 1140, is centred in the view once the street has slid 600 px
  const HOUSE_X = CX + PAN, GROUND = 1150, HOUSE_H = 520;
  // the fountain on the lawn, on the left half of the view on frame 0. Built like 06's (the same street):
  // a round basin with a pale rim and a front wall, a pedestal, a small bowl, the jets at full height
  const FX = 380, RIM_Y = GROUND + 16, RIM_RX = 150, RIM_RY = 22, WALL = 26;
  const BOWL_Y = GROUND - 44, BOWL_R = 44, JET_C = 250, JET_S = 100;

  // G7, the engine caption: three white lines in the note face from x 80, one size for all three (cap
  // height 46 shrunk together until the longest fits x 80 to 760, so about 40). The lead widened G8's
  // box from x 640 and raised the baselines from G7's 290, 360, 430 to 272, 328, 384, so the third
  // line ends above y 392, clear of 12's wall map (y 400 to 700). Shot 11 owns it; shot 12 copies this
  // function verbatim so the caption keeps its pixels across the cut. k: the pop scale about (80, 222),
  // above the block, so the pop never lifts the first line past the safe top (y 220); 1 at rest.
  // An ink pass goes under the white: invisible on 11's ink field, it rings the letters on 12's plate.
  function drawEngineCaption(ctx, L, k = 1) {
    const P = L.pal;
    const lines = ['The engine recommends', 'an "optimal price"', 'for each restaurant.'];
    let size = 46 / 0.71;
    const w = Math.max(...lines.map((s, i) => L.letters(ctx, s, 80, 272, { size, face: 'note', seed: 1100 + i, measure: true }).w));
    if (w > 680) size *= 680 / w;
    ctx.save();
    ctx.translate(80, 222);
    ctx.scale(k, k);
    ctx.translate(-80, -222);
    for (const pass of [{ color: P.ink, outline: P.ink, outlineWidth: 5.5 }, { color: P.white }]) {
      lines.forEach((s, i) => L.letters(ctx, s, 80, 272 + 56 * i, Object.assign({ size, face: 'note', seed: 1100 + i }, pass)));
    }
    ctx.restore();
  }

  const sd = (L, ...k) => L.hash(ID, ...k) & 0x7fffffff;
  // a background object the way the street plate paints one: an opaque wash with brush marks, a pencil edge
  function wash(g, L, pts, color, seed) {
    L.softWash(g, pts, { color, solid: true, marks: 0.6, rim: 0.12, seed });
    L.pencil(g, pts, { closed: true, base: color, seed: seed + 1, width: 2 });
  }
  // a band of water along a polyline, w0 wide at the start and w1 at the end (as in 06)
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
  // a half-ellipse below (rim) or above a centre line, as a closed outline
  const halfEll = (cx, cy, rx, ry, n = 24) => Array.from({ length: n + 1 }, (_, i) => [cx + rx * Math.cos((i / n) * Math.PI), cy + ry * Math.sin((i / n) * Math.PI)]);

  function paintStreet(g, L) {
    const P = L.pal, x1 = X0 + PW, y1 = Y0 + PH;
    g.translate(-X0, -Y0);
    g.fillStyle = P.paper;
    g.fillRect(X0, Y0, PW, PH);
    // two pale clouds: one over the fountain, one over the roof once the view has turned
    L.softWash(g, L.blobPts(330, 650, 110, 36, 4, 0.2), { color: P.titleSpot, alpha: 0.45, soft: 12, seed: sd(L, 'cloud', 1) });
    L.softWash(g, L.blobPts(1250, 572, 96, 30, 7, 0.2), { color: P.titleSpot, alpha: 0.45, soft: 12, seed: sd(L, 'cloud', 2) });
    // far hills along the horizon, paler and cooler than anything near
    const hills = [[X0, 1050], [300, 1026], [520, 1040], [760, 1010], [1000, 1032], [1300, 1016], [1560, 1038], [x1, 1024], [x1, 1160], [X0, 1160]];
    L.softWash(g, hills, { color: P.hillsFar, soft: 12, alpha: 0.6, marks: 0.6, seed: sd(L, 'hills') });
    // the lawn, from the ground line to the bottom of the view
    L.softWash(g, L.densify([[X0, GROUND - 8], [x1, GROUND - 12], [x1, y1], [X0, y1]], 24), { color: P.grass, alpha: 0.62, soft: 6, marks: 0.7, seed: sd(L, 'lawn') });
    L.pencil(g, [[X0, GROUND - 8], [x1, GROUND - 12]], { base: P.grass, seed: sd(L, 'lawn-edge') });
    // a tall cypress between the fountain and the house
    const cx = 650, cb = GROUND + 4, ch = 500;
    wash(g, L, [[cx - 26, cb], [cx - 40, cb - 0.25 * ch], [cx - 38, cb - 0.55 * ch], [cx - 24, cb - 0.8 * ch], [cx - 8, cb - 0.95 * ch], [cx, cb - ch], [cx + 8, cb - 0.95 * ch], [cx + 24, cb - 0.8 * ch], [cx + 38, cb - 0.55 * ch], [cx + 40, cb - 0.25 * ch], [cx + 26, cb]], P.grass, sd(L, 'cypress'));
    // the rich house: two storeys, the portico of four columns under a pediment, steps
    L.props.house(g, HOUSE_X, GROUND, { h: HOUSE_H, kind: 'rich', gate: false, fountain: false });
    // a broad stone forecourt from the steps down past the edge of the view
    wash(g, L, L.densify([[HOUSE_X - 236, GROUND + 8], [HOUSE_X + 236, GROUND + 8], [HOUSE_X + 300, y1], [HOUSE_X - 300, y1]], 20), P.stone, sd(L, 'court'));
    // round clipped bushes, a shade deeper than the lawn (as in 06)
    [[HOUSE_X - 300, GROUND - 22, 52, 44], [HOUSE_X + 300, GROUND - 22, 52, 44], [HOUSE_X - 392, GROUND - 14, 40, 34], [HOUSE_X + 392, GROUND - 14, 40, 34], [196, GROUND + 8, 46, 38], [574, GROUND - 4, 44, 36]].forEach(([x, y, rx, ry], i) => {
      const pts = L.blobPts(x, y, rx, ry, sd(L, 'bush', i), 0.07);
      L.softWash(g, pts, { color: P.grass, alpha: 0.96, soft: 4, marks: 0.8, angle: -0.6, seed: sd(L, 'bushw', i) });
      L.pencil(g, pts, { closed: true, base: P.grass, seed: sd(L, 'bushp', i), width: 2 });
    });
    // the fountain: the basin's front wall, its pale rim, the water (a gradient is allowed for water)
    wash(g, L, halfEll(FX, RIM_Y + WALL, RIM_RX, RIM_RY, 32).concat(halfEll(FX, RIM_Y, RIM_RX, RIM_RY, 32).reverse()), P.stone, sd(L, 'wall'));
    wash(g, L, L.ellipsePts(FX, RIM_Y, RIM_RX, RIM_RY, 64), L.mix(P.stone, P.paper, 0.45), sd(L, 'rim'));
    const water = L.ellipsePts(FX, RIM_Y + 2, RIM_RX - 18, RIM_RY - 8, 64);
    const gr = g.createLinearGradient(0, RIM_Y - 12, 0, RIM_Y + 16);
    gr.addColorStop(0, P.waterTop);
    gr.addColorStop(1, P.waterDeep);
    g.fillStyle = gr;
    g.beginPath();
    L.tracePath(g, L.smoothPts(water, true, 4), true);
    g.fill();
    L.pencil(g, water, { closed: true, color: P.waterDeep, seed: sd(L, 'water'), width: 2 });
    // the pedestal and the small bowl with its water
    wash(g, L, L.rectPts(FX - 12, BOWL_Y + 6, 24, RIM_Y - BOWL_Y, 4), P.stone, sd(L, 'pedestal'));
    wash(g, L, halfEll(FX, BOWL_Y, BOWL_R, 19, 20), P.stone, sd(L, 'bowl'));
    wash(g, L, L.ellipsePts(FX, BOWL_Y, BOWL_R, 9, 40), L.mix(P.stone, P.paper, 0.45), sd(L, 'bowlrim'));
    L.softWash(g, L.ellipsePts(FX, BOWL_Y + 1, BOWL_R - 9, 5, 32), { color: P.waterTop, solid: true, marks: 0, rim: 0, seed: sd(L, 'bowlw') });
    // the jets, still at full height: a centre jet with a crown spilling both ways, two arcs from the water
    const top = BOWL_Y - 4 - JET_C;
    waterBand(g, L, Array.from({ length: 9 }, (_, i) => [FX, L.lerp(BOWL_Y - 2, top, i / 8)]), 16, 10, sd(L, 'jet'));
    for (const sx of [-1, 1]) {
      const crown = Array.from({ length: 9 }, (_, i) => {
        const u = i / 8;
        return [FX + sx * (7 + 0.3 * JET_C * u), top + 4 + 0.42 * JET_C * u * u - 0.05 * JET_C * u * (1 - u)];
      });
      waterBand(g, L, crown, 9, 4, sd(L, 'crown', sx));
      [[0.36, 0.5, 5], [0.4, 0.66, 4], [0.43, 0.82, 3.5]].forEach(([ux, uy, r]) => drop(g, L, FX + sx * ux * JET_C, top + uy * JET_C, r));
      const arc = Array.from({ length: 13 }, (_, i) => {
        const u = i / 12;
        return [L.lerp(FX + sx * 26, FX + sx * 116, u), RIM_Y - 2 - 4 * JET_S * u * (1 - u)];
      });
      waterBand(g, L, arc, 11, 6, sd(L, 'arc', sx));
      drop(g, L, FX + sx * 126, RIM_Y - 22, 3.5);
    }
    drop(g, L, FX - 5, top - 12, 4.5);
    drop(g, L, FX + 8, top - 21, 3.5);
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal;
      const t = L.clamp(tIn, 0, info.dur);
      const f = Math.min(Math.round(info.dur * FPS) - 1, Math.floor(t * FPS + 1e-6));

      // 1. the street, sliding left inside the round view (a camera move: a new position every frame)
      let dx = -PAN;
      if (f < PAN_END) dx = -PAN * L.ease.inOutSine(f / PAN_END);
      else if (f - PAN_END < OVER.length) dx = -PAN - OVER[f - PAN_END];
      ctx.save();
      ctx.beginPath();
      ctx.arc(CX, CY, R + 1, 0, Math.PI * 2);
      ctx.clip();
      L.plate(ctx, `${ID}|street|2`, (g) => paintStreet(g, L), { w: PW, h: PH, x: X0 + Math.round(dx), y: Y0 });

      // 2. the eyelid: ink comes down over the view from its top, its edge sagging like a lid's
      const k = f >= BLINK_AT ? LID[Math.min(LID.length - 1, f - BLINK_AT)] : 0;
      if (k > 0) {
        const bulge = 0.3 * R;
        const yc = CY - R + k * (2 * R + bulge);
        const ys = yc - bulge;
        ctx.fillStyle = P.ink;
        ctx.beginPath();
        ctx.moveTo(CX - R - 2, CY - R - 2);
        ctx.lineTo(CX + R + 2, CY - R - 2);
        ctx.lineTo(CX + R + 2, ys);
        ctx.quadraticCurveTo(CX, yc + bulge, CX - R - 2, ys);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // 3. the ink field with the round hole, and the slate rim around the hole
      ctx.fillStyle = P.ink;
      ctx.beginPath();
      ctx.rect(0, 0, info.W, info.H);
      ctx.arc(CX, CY, R, 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      ctx.strokeStyle = P.slate;
      ctx.lineWidth = RIM;
      ctx.beginPath();
      ctx.arc(CX, CY, R + RIM / 2, 0, Math.PI * 2);
      ctx.stroke();

      // 4. the G7 caption: pops with outBack over 3 frames from T 20.25 (visible on its frame), then holds
      if (f >= CAPTION_AT) drawEngineCaption(ctx, L, L.ease.outBack((f - CAPTION_AT + 1) / 3));
    },
  });
})();

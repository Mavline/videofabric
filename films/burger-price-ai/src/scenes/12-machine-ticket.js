// 12 machine-ticket: The gauge and the ticket. T 21.0 to 22.5 (36 frames), schematic plate, hard cut in.
// Storyboard plan 12 with G3, G7 and G8. The machine reads its own gauge: the needle ratchets from LOW
// on 16ths and lands on MEDIUM on the beat (21.5); four print clicks on 16ths (21.75 to 22.125) push the
// ticket out of the slot; from 22.25 it hangs out, readable, and flutters on twos. It recommends; it
// never sets a price.
// Layers, back to front:
//   1 the room, a cached plate: nightSky wall and pavement floor under dense strokes, the still wall map
//   2 the machine on G3's pixels, periscope up, its eye on the needle, then on the ticket (while the
//     ticket flutters, it is drawn again, turned about the slot)
//   3 shudder strokes at the box's sides on each print click
//   4 the G7 caption, screen-fixed, on the same pixels as 11
(() => {
  'use strict';
  const ID = 'machine-ticket';

  // ---- beats, as local frames (T = 21.0 + f / 24) ----------------------------------------------------
  const STEP_F = [3, 6, 9]; // T 21.125, 21.25, 21.375: ratchet steps of 17.5 degrees
  const LAND_F = 12; // T 21.5 (beat): the needle lands on MEDIUM
  const CLICK_F = [18, 21, 24, 27]; // T 21.75, 21.875, 22.0, 22.125 (16ths): print clicks
  const OUT_F = 30; // T 22.25: the ticket hangs out, readable; it flutters on twos to the cut

  // ---- the needle, on ones: o.level 0 is LOW (200 degrees), 0.5 MEDIUM (270), 1 HIGH (340) -------------
  const DEG = 1 / 140;
  function needleLevel(f) {
    if (f >= LAND_F) return 0.5 + ([3, -3, 2, -1][f - LAND_F] || 0) * DEG; // quiver 4 frames, then hold
    let n = 0;
    while (n < STEP_F.length && f >= STEP_F[n]) n++;
    return n ? n * 0.125 + ([2, -1, 0][f - STEP_F[n - 1]] || 0) * DEG : 0; // each step wobbles 2 degrees
  }

  // ---- printing, on ones: each click jolts the box 3 px and slides the ticket out a quarter (61 px) ----
  // The print pose rattles its box by a hashed amount picked by o.t. On the current lib these o.t
  // values pick +3, -3 and 0 px (measured through the slot anchor), so the box jolts on the click frame
  // and stands still between clicks instead of rattling on every frame.
  const SHAKE_T = { 3: 80.5 / 24, '-3': 34.5 / 24, 0: 55.5 / 24 };
  function printing(f) {
    let i = CLICK_F.length - 1;
    while (i >= 0 && f < CLICK_F[i]) i--;
    if (i < 0) return null;
    const age = f - CLICK_F[i];
    return {
      k: age === 0 ? (i + 0.7) / 4 : (i + 1) / 4, // the step lands over two frames
      shake: age === 0 ? (i % 2 ? -3 : 3) : 0,
      strokes: age < 2,
    };
  }

  // ---- G7 caption: copied verbatim from 11-periscope-view.js (shot 11 owns it) -------------------------
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

  // ---- the room: copied verbatim from 10-machine-feed.js (shot 10 owns it) -----------------------------
  // The room and the wall map of storyboard G3. Shot 12 draws the same room: copy these two verbatim.
  const MAP = { x: 80, y: 400, o: { w: 920, h: 300, n: 140, dotR: 7, mono: true, booths: 12, style: 'land', pinned: true, seed: 9, plate: 'machine' } };
  function drawRoom(g, L) {
    const P = L.pal;
    L.dense(g, null, { bounds: [0, 0, 1080, 1480], base: P.nightSky, dir: 'vertical', seed: 21 });
    L.dense(g, null, { bounds: [0, 1480, 1080, 440], base: P.pavement, dir: 'perspective', vp: [540, 900], seed: 22 });
    L.ragged(g, [[0, 1480], [1080, 1478]], { base: P.nightSky, seed: 4 });
    L.props.map(g, MAP.x, MAP.y, MAP.o);
  }

  // ---- the eye (the periscope lens): secondary motion with the action ----------------------------------
  // the pupil steps with the needle up the dial, the eye blinks for exactly 2 frames on the hold after
  // MEDIUM, then looks down at its ticket from the first print click
  const BLINK_F = [16, 17];
  function eyeLook(f) {
    if (f >= CLICK_F[0]) return [-0.15, 1];
    const steps = STEP_F.filter((x) => f >= x).length + (f >= LAND_F ? 1 : 0);
    return [-0.75 + 0.45 * (steps / 4), 0.8];
  }

  // G3's ticket strip, relative to the slot anchor (the slot's centre): it hangs from the slot's lower
  // edge (the slot is 30 tall), 300 wide and 245 long down to the tips of its torn edge
  const SLOT_HALF = 15, TICKET_HALF_W = 150, TICKET_LEN = 245;

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal, C = L.cast;
      const t = L.clamp(tIn, 0, info.dur);
      const f = Math.min(Math.round(info.dur * 24) - 1, Math.floor(t * 24 + 1e-6));

      // 1 the room: G3's wall and floor, the wall map pinned above the hopper, still (no pulse in 12)
      L.plate(ctx, ID + '|room', (g) => drawRoom(g, L));

      // 2 the machine: G3 from (540, 1480) at h 660, periscope up
      const base = { h: 660, scope: 1, look: eyeLook(f), blink: BLINK_F.includes(f), level: needleLevel(f), plate: 'machine', ground: P.pavement };
      const pr = printing(f);
      let m;
      if (f >= OUT_F) {
        // the ticket is out and flutters 2 degrees on twos about the slot's lower edge: the machine
        // without it, then the printed ticket again, turned, clipped to the strip so that nothing
        // else is drawn twice
        m = C.machine(ctx, 540, 1480, Object.assign({}, base, { pose: 'idle' }));
        const px = m.slot[0], py = m.slot[1] + SLOT_HALF;
        const a = ([2, -2, 2][(f - OUT_F) >> 1] * Math.PI) / 180;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(a);
        ctx.translate(-px, -py);
        ctx.beginPath();
        ctx.rect(px - TICKET_HALF_W - 4, py - 2, 2 * TICKET_HALF_W + 8, TICKET_LEN + 8);
        ctx.clip();
        C.machine(ctx, 540, 1480, Object.assign({}, base, { pose: 'print', k: 1, shadow: false }));
        ctx.restore();
      } else if (pr) {
        m = C.machine(ctx, 540, 1480, Object.assign({}, base, { pose: 'print', k: pr.k, t: SHAKE_T[pr.shake] }));
      } else {
        m = C.machine(ctx, 540, 1480, Object.assign({}, base, { pose: 'idle' }));
      }

      // 3 three short shudder strokes at each side of the box on every click (on ones, two frames)
      if (pr && pr.strokes && f < OUT_F) {
        const cy = (m.body.y0 + m.body.y1) / 2;
        for (const sd of [-1, 1]) {
          const x0 = (sd < 0 ? m.body.x0 : m.body.x1) + sd * 18;
          for (let i = 0; i < 3; i++) {
            const y0 = cy - 50 + i * 55;
            L.stroke(ctx, [[x0, y0], [x0 + sd * 34, y0 - 14]], { width: L.LINE, brush: true, taper: [1, 3], seed: L.hash(ID, 'shudder', sd, i) });
          }
        }
      }

      // 4 the G7 caption, held from 11
      drawEngineCaption(ctx, L);
    },
  });
})();

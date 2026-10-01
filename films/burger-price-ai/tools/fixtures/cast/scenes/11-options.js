// Cast sheet page 11 (street plate): the options added after the first scenes were drawn. Bites from
// either side and of any size, chewing with the jaw (o.chewPhase), iris size, the gulp lump, the
// owner's resigned face and his head turned from behind, pulsing map dots, bicycle anchors measured
// without drawing (pink crosses).
FILM.scene({
  id: 'options',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal, C = L.cast, R = L.props;
    ctx.fillStyle = P.fieldMint;
    ctx.fillRect(0, 0, info.W, info.H);
    const label = (s, x, y) => L.text(ctx, s, x, y, { size: 20, color: P.slate, align: 'center', weight: 400 });
    L.text(ctx, 'options · bite side and size, chewing, iris, gulp, owner, map pulse, bike measure', 40, 60, { size: 24, color: P.ink, weight: 400 });
    // bites: right (default), left, left and bigger
    [[{ bites: 1 }, 'bites 1'], [{ bites: 2 }, 'bites 2'], [{ bites: 1, biteSide: 'left' }, "left"], [{ bites: 2, biteSide: 'left' }, 'left, 2'], [{ bites: 1, biteSide: 'left', biteSize: 0.5 }, 'left, size .5'], [{ bites: 2, biteSide: 'left', biteSize: 0.5 }, 'left, .5, 2']]
      .forEach(([o, n], i) => {
        R.burger(ctx, 95 + i * 178, 170, Object.assign({ w: 150 }, o));
        label(n, 95 + i * 178, 250);
      });
    // chewing with the jaw: phases 1, .5, 0 (the bite from the mouth's side)
    const ground = (y) => L.pencil(ctx, [[20, y], [1060, y + 2]], { color: L.mix(P.grass, P.ink, 0.35), width: 2, seed: y });
    ground(720);
    [1, 0.5, 0].forEach((ph, i) => {
      C.hero(ctx, 150 + i * 260, 720, { h: 380, pose: 'bite', k: 0.9, biteSide: 'left', biteSize: 0.45, chewPhase: ph });
      label('chew, chewPhase ' + ph, 150 + i * 260, 752);
    });
    C.hero(ctx, 930, 720, { h: 380, face: 'gulp', gulp: 1 });
    label('gulp, gulp 1', 930, 752);
    // iris
    ground(1200);
    [[0.7, 'iris .7'], [1.3, 'iris 1.3']].forEach(([v, n], i) => {
      C.hero(ctx, 150 + i * 220, 1200, { h: 380, iris: v, look: [0.6, -0.2] });
      label(n, 150 + i * 220, 1232);
    });
    // the owner: resigned; from behind with the head turned
    C.owner(ctx, 620, 1200, { h: 420, face: 'resigned', tilt: 0.2 });
    label('owner resigned', 620, 1232);
    const ob = C.owner(ctx, 900, 1200, { h: 420, view: 'back', headTurn: 1 });
    label('back, headTurn 1 (+ shoulders)', 900, 1232);
    const mark = (p, color) => {
      ctx.save();
      ctx.strokeStyle = color || P.pink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p[0] - 10, p[1]);
      ctx.lineTo(p[0] + 10, p[1]);
      ctx.moveTo(p[0], p[1] - 10);
      ctx.lineTo(p[0], p[1] + 10);
      ctx.stroke();
      ctx.restore();
    };
    mark(ob.shoulder, P.ink);
    mark(ob.shoulderFar, P.ink);
    // the map with four dots pulsing, and the bicycle's anchors measured before it is drawn
    R.map(ctx, 50, 1330, { w: 460, h: 330, n: 30, style: 'land', mono: true, pulse: { idx: [0, 3, 7, 12], k: 0.5 } });
    label('map, pulse k .5', 280, 1700);
    const a = R.bike(ctx, 800, 1640, { h: 400, measure: true });
    R.bike(ctx, 800, 1640, { h: 400 });
    [a.seat, a.grip, a.pedal, a.bb, a.axleFront, a.axleRear].forEach((p) => mark(p));
    label('bike, measure: true (crosses)', 800, 1700);
  },
});

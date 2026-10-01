// Cast sheet page 8 (machine plate): the owner from behind at the counter (storyboard G2, roughly), the
// hero at the window, the telephone ringing, the register, then the keypad, gauge, ticket, a handset
// on its cord, and lettering of both plates.
FILM.scene({
  id: 'owner-back',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal, C = L.cast, R = L.props;
    // the street through the window, and the hero at the sill
    ctx.save();
    ctx.beginPath();
    ctx.rect(240, 560, 600, 540);
    ctx.clip();
    ctx.fillStyle = P.paper;
    ctx.fillRect(240, 560, 600, 540);
    L.softWash(ctx, [[240, 760], [520, 740], [520, 1100], [240, 1100]], { color: P.wallYellow, solid: true, seed: 2 });
    L.pencil(ctx, [[240, 760], [520, 740], [520, 1100]], { base: P.wallYellow, seed: 3 });
    C.hero(ctx, 560, 1480, { h: 838, pose: 'sill', target: [0, 1100], plate: 'street' });
    ctx.restore();
    // the inside wall around the window
    const wall = [[[0, 0], [1080, 0], [1080, 1100], [0, 1100]], [[240, 560], [840, 560], [840, 1100], [240, 1100]]];
    L.dense(ctx, wall, { bounds: [0, 0, 1080, 1100], base: P.wallWarm, dir: 'vertical', cover: [0.22, 0.08], seed: 31 });
    L.ragged(ctx, L.rectPts(210, 530, 660, 570, 20), { closed: true, color: P.shadowWarm, width: 6, seed: 5 });
    // the counter
    L.dense(ctx, null, { bounds: [0, 1100, 1080, 820], base: P.fence, dir: 'horizontal', cover: [0.16, 0.06], seed: 32 });
    L.ragged(ctx, [[0, 1170], [1080, 1168]], { base: P.fence, seed: 6 });
    R.register(ctx, 960, 1100, { w: 200, drawer: 1, text: '$5.69' });
    R.phone(ctx, 770, 1100, { w: 140, ring: true, t: 0.1 });
    R.coin(ctx, 620, 1092, { w: 24, seed: 1 });
    R.coin(ctx, 640, 1094, { w: 24, seed: 2, rot: 0.3 });
    C.owner(ctx, 92, 1636, { h: 1167, pose: 'rake', k: 0.4, view: 'back' });
    L.letters(ctx, 'owner from behind (G2), hero at the sill, telephone ringing, register', 40, 70, { size: 26, face: 'note', color: P.white, seed: 9 });
    // the props on the counter top area below
    const label = (s, x, y) => L.letters(ctx, s, x, y, { size: 22, face: 'note', align: 'center', color: P.ink, seed: x + y, jitter: 0.5 });
    R.keypad(ctx, 330, 1900, { w: 200, text: '$6.8', press: 7 });
    label('keypad 3 x 4', 330, 1535);
    R.gauge(ctx, 640, 1410, { r: 105, level: 0.62 });
    R.ticket(ctx, 930, 1200, { w: 120, lines: ['RECOMMENDED:', '$6.89'] });
    const hs = R.handset(ctx, 560, 1540, { w: 110, rot: 0.4 });
    R.cord(ctx, hs.cord, [640, 1660], { loops: 8 });
    label('handset, cord', 640, 1700);
    R.mobile(ctx, 860, 1520, { h: 190, lines: ['YOUR RESTAURANT', 'IS SHOWING', 'MEDIUM', 'SENSITIVITY', 'TO PRICE'] });
    L.cel(ctx, L.rectPts(470, 1730, 580, 110, 30), { fill: P.paper, seed: 4 });
    L.spot(ctx, 760, 1785, 240, 40, { seed: 8 });
    L.letters(ctx, 'ONE BURGER', 760, 1808, { size: 56, align: 'center', color: P.titleBlue, firstColor: P.titleYellow, outline: P.ink, seed: 23 });
    L.letters(ctx, 'a tool, not a mandate', 760, 1895, { size: 40, face: 'note', align: 'center', color: P.white, seed: 21 });
  },
});

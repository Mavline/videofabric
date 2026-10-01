// Cast sheet page 8 (machine plate): storyboard G2 at its own pixels. The street and the hero through
// the window; the warm inside wall; the owner from behind raking coins; register, telephone, coins.
// Pink crosses mark the G2 targets.
FILM.scene({
  id: 'g2-inside',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal, C = L.cast, R = L.props;
    // the street through the window, and the hero at the sill (street plate inside the window)
    ctx.save();
    ctx.beginPath();
    ctx.rect(240, 560, 600, 540);
    ctx.clip();
    ctx.fillStyle = P.fieldSky;
    ctx.fillRect(240, 560, 600, 540);
    L.softWash(ctx, L.rectPts(240, 760, 290, 340, 20), { color: P.wallYellow, solid: true, seed: 2 });
    L.pencil(ctx, [[530, 760], [530, 1100]], { base: P.wallYellow, seed: 3 });
    const hero = C.hero(ctx, 560, 1483, { h: 838, pose: 'sill', target: [0, 1100], plate: 'street', shadow: false });
    ctx.restore();
    // the inside wall around the window, its frame, the counter
    const wall = [[[0, 0], [1080, 0], [1080, 1100], [0, 1100]], [[210, 530], [870, 530], [870, 1100], [210, 1100]]];
    L.dense(ctx, wall, { bounds: [0, 0, 1080, 1100], base: P.wallWarm, dir: 'vertical', seed: 31 });
    L.dense(ctx, [[[210, 530], [870, 530], [870, 1100], [210, 1100]], [[240, 560], [840, 560], [840, 1100], [240, 1100]]], { bounds: [210, 530, 660, 570], base: P.shadowWarm, mute: 0.2, dir: 'vertical', seed: 33 });
    L.ragged(ctx, L.rectPts(210, 530, 660, 570, 20), { closed: true, color: P.shadowWarm, width: 6, seed: 5 });
    L.dense(ctx, null, { bounds: [0, 1100, 1080, 820], base: P.fence, dir: 'horizontal', seed: 32 });
    L.ragged(ctx, [[0, 1170], [1080, 1168]], { base: P.fence, seed: 6 });
    R.register(ctx, 960, 1100, { w: 200, drawer: 1, text: '$5.69' });
    R.phone(ctx, 770, 1100, { w: 140, ring: true, t: 0.1 });
    R.coin(ctx, 620, 1092, { w: 24, seed: 1 });
    R.coin(ctx, 640, 1094, { w: 24, seed: 2, rot: 0.3 });
    const own = C.owner(ctx, 92.5, 1636, { h: 1167, pose: 'rake', target: [600, 1098], k: 0.3, view: 'back', ground: P.fence });
    const mark = (x, y) => {
      ctx.save();
      ctx.strokeStyle = P.pink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 12, y);
      ctx.lineTo(x + 12, y);
      ctx.moveTo(x, y - 12);
      ctx.lineTo(x, y + 12);
      ctx.stroke();
      ctx.restore();
    };
    [[180, 650], [0, 800], [400, 800], [560, 820], [525, 790], [600, 790], [470, 1100], [650, 1100], [860, 880], [1060, 1100], [700, 990], [840, 1100], [620, 1092]].forEach(([x, y]) => mark(x, y));
    const e = [hero.eye, hero.eyeFar, hero.hand, hero.handFar].map((q) => q.map(Math.round).join(', '));
    L.letters(ctx, `G2 at its pixels · owner head ${own.head.map(Math.round).join(', ')}, hero eyes ${e[0]} and ${e[1]}`, 40, 70, { size: 26, face: 'note', color: P.white, seed: 9 });
    L.letters(ctx, `hero hands ${e[2]} and ${e[3]}`, 40, 112, { size: 26, face: 'note', color: P.white, seed: 10 });
  },
});

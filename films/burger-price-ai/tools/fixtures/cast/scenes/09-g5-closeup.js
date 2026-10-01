// Cast sheet page 9 (street plate): storyboard G4 (the close tag with its glyph slots) over G5 (the
// hero from the chest up with the burger), at their own pixels. Pink crosses mark the targets.
FILM.scene({
  id: 'g5-closeup',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal, C = L.cast, R = L.props;
    ctx.fillStyle = P.fieldSky;
    ctx.fillRect(0, 0, info.W, info.H);
    L.softWash(ctx, L.rectPts(-20, 700, 300, 1300, 20), { color: P.wallYellow, solid: true, seed: 2 });
    L.pencil(ctx, [[280, 700], [280, 1920]], { base: P.wallYellow, seed: 3 });
    L.softWash(ctx, L.rectPts(940, 620, 160, 1320, 20), { color: P.wallYellow, solid: true, seed: 4 });
    L.pencil(ctx, [[940, 620], [940, 1920]], { base: P.wallYellow, seed: 5 });
    const G4 = [[505, 585], [590, 675], [680, 710], [715, 800], [805, 890]];
    R.priceTag(ctx, 700, 300, { w: 440, h: 280, hang: 'holes', drop: 400, pivot: 'top', size: 160, baseline: 230, slots: G4, price: '$5.69', swing: 0.02 });
    const hero = C.hero(ctx, 304, 2024, { h: 1289, pose: 'bite', k: 0, look: [0.7, -0.7], shadow: false });
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
    [[480, 300], [920, 580], [520, 330], [880, 330], [330, 1010], [370, 960], [460, 960], [450, 1110], [560, 1170]].forEach(([x, y]) => mark(x, y));
    G4.flat().forEach((x) => mark(x, 530));
    const e = [hero.eye, hero.eyeFar, hero.mouth, hero.hold].map((q) => q.map(Math.round).join(', '));
    L.text(ctx, `G4 + G5 · eyes ${e[0]} / ${e[1]}, mouth ${e[2]}, burger ${e[3]}`, 40, 60, { size: 22, color: P.ink, weight: 400 });
  },
});

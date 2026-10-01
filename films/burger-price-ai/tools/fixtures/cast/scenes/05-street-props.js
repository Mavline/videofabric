// Cast sheet page 5 (street plate): houses, bike, burgers, the close tag (G4), lettering, effects.
FILM.scene({
  id: 'street-props',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal, R = L.props;
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, info.W, info.H);
    const label = (s, x, y) => L.text(ctx, s, x, y, { size: 21, color: P.slate, align: 'center', weight: 400 });
    L.text(ctx, 'street plate · houses, burgers, the tag (G4), lettering, effects', 40, 60, { size: 26, color: P.ink, weight: 400 });
    L.softWash(ctx, [[0, 380], [1080, 366], [1080, 440], [0, 446]], { color: P.grass, soft: 6, seed: 2 });
    R.house(ctx, 220, 400, { h: 220, kind: 'modest' });
    R.house(ctx, 800, 400, { h: 190, kind: 'rich' });
    label('house modest', 220, 470);
    label('house rich', 800, 470);
    R.priceTag(ctx, 700, 560, { w: 440, h: 280, drop: 60, price: '$6.89', swing: -0.02 });
    label('price tag, G4 size', 700, 930);
    R.bike(ctx, 210, 860, { h: 300, phase: 0.15 });
    label('bike', 210, 890);
    [0, 1, 2, 3].forEach((n, i) => {
      R.burger(ctx, 130 + i * 160, 1050, { w: 140, bites: n });
      label(`${n} bites`, 130 + i * 160, 1130);
    });
    L.spot(ctx, 540, 1290, 420, 120, { seed: 5 });
    L.letters(ctx, 'ONE BURGER,', 540, 1330, { size: 104, align: 'center', color: P.titleBlue, firstColor: P.titleYellow, outline: P.ink, seed: 1 });
    L.spot(ctx, 540, 1450, 330, 80, { color: P.titleSpotPink, seed: 6 });
    L.letters(ctx, 'TWO PRICES', 540, 1480, { size: 84, align: 'center', color: P.titleBlue, firstColor: P.titleYellow, outline: P.ink, seed: 2 });
    L.letters(ctx, 'Reuters, Sept 29, 2026', 540, 1560, { size: 40, align: 'center', face: 'note', color: P.ink, seed: 3 });
    L.speedLines(ctx, 200, 1700, 0, { n: 4, spread: 120, len: [50, 110], seed: 4 });
    label('speed lines', 140, 1800);
    L.dust(ctx, 360, 1720, { r: 50, p: 0.25, seed: 7 });
    label('dust', 360, 1800);
    L.impactStar(ctx, 540, 1700, 70, { seed: 2 });
    label('impact star', 540, 1800);
    L.puff(ctx, 680, 1720, { p: 0.3, seed: 2 });
    label('puff', 720, 1800);
    L.smear(ctx, [[820, 1760], [900, 1700], [980, 1720], [1050, 1660]], { colors: [P.red, P.skinKid, P.slate], width: 60, seed: 3 });
    label('smear', 940, 1800);
  },
});

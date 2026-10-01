// Cast sheet page 4 (street plate): storyboard G1 at its own pixels. Pink crosses mark the G1 targets:
// sign board, string tops, tag card, window, the owner's head, the hero's head and wheel centres.
FILM.scene({
  id: 'g1-booth',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal, C = L.cast, R = L.props;
    ctx.fillStyle = P.fieldSky;
    ctx.fillRect(0, 0, info.W, info.H);
    L.softWash(ctx, L.blobPts(250, 300, 150, 50, 3, 0.2), { color: P.paper, alpha: 0.7, soft: 12, seed: 3 });
    L.softWash(ctx, L.blobPts(820, 420, 120, 40, 4, 0.2), { color: P.paper, alpha: 0.7, soft: 12, seed: 4 });
    L.softWash(ctx, [[0, 1180], [300, 1150], [700, 1170], [1080, 1150], [1080, 1270], [0, 1270]], { color: P.hillsFar, soft: 8, seed: 5 });
    L.softWash(ctx, L.blobPts(1000, 820, 110, 150, 6, 0.25), { color: P.grass, soft: 8, seed: 6 });
    L.softWash(ctx, [[985, 960], [1015, 960], [1020, 1480], [980, 1480]], { color: P.trunk, soft: 3, seed: 7 });
    R.house(ctx, 190, 1480, { h: 560, kind: 'modest' });
    L.softWash(ctx, [[0, 1480], [1080, 1480], [1080, 1920], [0, 1920]], { color: P.cityPastel, soft: 2, solid: true, marks: 0.6, seed: 8 });
    L.pencil(ctx, [[0, 1600], [1080, 1602]], { base: P.cityPastel, width: 3, seed: 9 });
    // the owner stands inside: his back layer is clipped to the window, his leaning arm comes out over the shelf
    const b = R.booth(ctx, 690, 1480, { w: 580, price: '$5.69', layer: 'back' });
    const lean = { h: b.ownerH, pose: 'lean', target: [b.owner[0] + 0.14 * b.ownerH, b.shelf.y] };
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.window.x0, b.window.y0, b.window.x1 - b.window.x0, b.window.y1 - b.window.y0);
    ctx.clip();
    C.owner(ctx, b.owner[0], b.owner[1], Object.assign({ layer: 'back' }, lean));
    ctx.restore();
    R.booth(ctx, 690, 1480, { w: 580, price: '$5.69', swing: 0.03, layer: 'front' });
    C.owner(ctx, b.owner[0], b.owner[1], Object.assign({ layer: 'front' }, lean));
    const hero = C.hero(ctx, 290, 1480, { h: 510.6, pose: 'straddle', ground: P.cityPastel });
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
    [[420, 560], [940, 720], [560, 720], [800, 720], [540, 750], [820, 900], [540, 1030], [880, 1250], [710, 1105], [290, 1080], [150, 1400], [430, 1400]].forEach(([x, y]) => mark(x, y));
    L.text(ctx, `G1 at its pixels · hero head ${hero.head.map(Math.round).join(', ')} (target 290, 1080), wheels ${hero.axleRear.map(Math.round).join(', ')} and ${hero.axleFront.map(Math.round).join(', ')}`, 40, 60, { size: 22, color: P.ink, weight: 400 });
    L.text(ctx, 'pink crosses: storyboard targets', 40, 96, { size: 22, color: P.slate, weight: 400 });
  },
});

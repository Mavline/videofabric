// Cast sheet page 7 (machine plate): the owner in every pose.
FILM.scene({
  id: 'owner-poses',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal, C = L.cast, R = L.props;
    L.dense(ctx, null, { bounds: [0, 0, 1080, 1920], base: P.wallWarm, dir: 'vertical', cover: [0.2, 0.08], seed: 11 });
    L.letters(ctx, 'owner · every pose (machine plate)', 40, 70, { size: 32, face: 'note', color: P.white, seed: 9 });
    const label = (s, x, y) => L.letters(ctx, s, x, y, { size: 22, face: 'note', align: 'center', color: P.white, seed: x + y, jitter: 0.5 });
    const rows = [[560, [['stand + shadow', { pose: 'stand' }], ['lean', { pose: 'lean' }], ['serve', { pose: 'serve' }], ['push', { pose: 'push' }], ['rake k .5', { pose: 'rake', k: 0.5 }], ['tap', { pose: 'tap', k: 0.2 }]]],
      [1100, [['point', { pose: 'point' }], ['catch k .2', { pose: 'catch', k: 0.2 }], ['catch k .8', { pose: 'catch', k: 0.8 }], ['read', { pose: 'read', lines: ['RECOMMENDED:', '$6.89'] }], ['phone', { pose: 'phone', t: 0.1 }], ['listen', { pose: 'listen' }]]],
      [1640, [['sigh k 1 (+ puff)', { pose: 'sigh', k: 1 }], ['type', { pose: 'type', t: 0.1 }], ['holdup (+ tag)', { pose: 'holdup' }], ['shrug', { pose: 'shrug' }], ['yawn', { pose: 'stand', face: 'yawn' }], ['back view', { pose: 'stand', view: 'back' }]]]];
    rows.forEach(([y, items]) => {
      L.ragged(ctx, [[0, y + 4], [1080, y + 2]], { base: P.wallWarm, seed: y });
      items.forEach(([name, o], i) => {
        const x = 95 + i * 178;
        const op = Object.assign({ h: 380, t: 0.1 }, o);
        if (i === 0 && y === 560) L.wallShadow(ctx, (g) => C.owner(g, x, y, op), { dx: 70, dy: -24 });
        if (o.pose === 'holdup') {
          op.hold = (g, a) => R.priceTag(g, a.hold[0] + 6, a.hold[1] + 28, { w: 110, h: 70, drop: 0, strings: 'dangle', price: '$6.89' });
        }
        const a = C.owner(ctx, x, y, op);
        if (o.pose === 'sigh') L.puff(ctx, a.mouth[0] + 10, a.mouth[1], { p: 0.35, len: 50, width: 12, seed: 4 });
        label(name, x, y + 34);
      });
    });
  },
});

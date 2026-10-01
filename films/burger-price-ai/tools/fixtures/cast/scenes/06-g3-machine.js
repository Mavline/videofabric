// Cast sheet page 6 (machine plate): storyboard G3 at its own pixels, the machine printing under the
// wall map with the purchase stream; small poses on the floor. Pink crosses mark G3 targets.
FILM.scene({
  id: 'g3-machine',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal, C = L.cast, R = L.props;
    L.dense(ctx, null, { bounds: [0, 0, 1080, 1480], base: P.nightSky, dir: 'vertical', cover: [0.17, 0.14], seed: 21 });
    L.dense(ctx, null, { bounds: [0, 1480, 1080, 440], base: P.pavement, dir: 'perspective', vp: [540, 900], cover: [0.14, 0.04], seed: 22 });
    L.ragged(ctx, [[0, 1480], [1080, 1478]], { base: P.nightSky, seed: 4 });
    const map = R.map(ctx, 80, 400, { w: 920, h: 300, n: 140, dotR: 7, mono: true, booths: 12, style: 'land', pinned: true, seed: 9 });
    const m = C.machine(ctx, 540, 1480, { h: 660, pose: 'print', k: 0.75, level: 0.62, scope: 0, t: 0.2 });
    R.flow(ctx, [[map.dots[20].x, map.dots[20].y], [m.hopper[0] - 60, 650], m.hopper], { t: 0.3, n: 6, size: 34, seed: 2 });
    R.flow(ctx, [[map.dots[90].x, map.dots[90].y], [m.hopper[0] + 80, 640], m.hopper], { t: 0.3, n: 6, size: 34, seed: 3, kind: 'coin' });
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
    [[200, 820], [880, 1300], [540, 1150], [340, 1215], [740, 1245], [300, 720], [740, 720], [780, 730], [900, 820], [540, 1430]].forEach(([x, y]) => mark(x, y));
    L.letters(ctx, 'G3 at its pixels · pink: storyboard targets', 40, 70, { size: 30, face: 'note', color: P.white, seed: 9 });
    // small poses on the floor
    [['gulp k .1', { pose: 'gulp', k: 0.1 }], ['gulp k .5', { pose: 'gulp', k: 0.5 }], ['think', { pose: 'think', t: 0.3 }], ['scope 1', { scope: 1, look: [0.6, 0.3] }], ['blink, HIGH', { blink: true, level: 1 }]].forEach(([name, o], i) => {
      const x = 110 + i * 215;
      C.machine(ctx, x, 1870, Object.assign({ h: 150 }, o));
      L.letters(ctx, name, x, 1905, { size: 22, face: 'note', align: 'center', color: P.white, seed: i });
    });
  },
});

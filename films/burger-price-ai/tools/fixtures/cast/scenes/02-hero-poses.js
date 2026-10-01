// Cast sheet page 2 (street plate): the hero on foot.
FILM.scene({
  id: 'hero-poses',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal, C = L.cast;
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, info.W, info.H);
    const label = (s, x, y) => L.text(ctx, s, x, y, { size: 21, color: P.slate, align: 'center', weight: 400 });
    const ground = (y) => L.pencil(ctx, [[20, y], [1060, y + 2]], { color: L.mix(P.grass, P.ink, 0.35), width: 2, seed: y });
    L.text(ctx, 'hero · on foot (street plate)', 40, 60, { size: 30, color: P.ink, weight: 400 });
    const rows = [[470, [['stand', { pose: 'stand' }], ['bite k 0 open', { pose: 'bite', k: 0.1 }], ['bite k .5 chomp', { pose: 'bite', k: 0.5 }], ['bite k .9 chew', { pose: 'bite', k: 0.9, bites: 1 }]]],
      [930, [['pop', { pose: 'pop' }], ['pop, stalk 1', { pose: 'pop', stalk: 1 }], ['turn k 0', { pose: 'turn', k: 0.1 }], ['turn k .5 front', { pose: 'turn', k: 0.5 }]]],
      [1390, [['turn k 1', { pose: 'turn', k: 0.9 }], ['sill (front)', { pose: 'sill', target: [0, 1390 - 150] }], ['snatch front', { pose: 'snatch', view: 'front', target: [0, 0] }], ['facing -1, blink', { pose: 'stand', facing: -1, blink: true }]]],
      [1850, [['look up, tilt -.2', { pose: 'stand', look: [0.3, -1], tilt: -0.2 }], ['rot .1 (sway)', { pose: 'stand', rot: 0.1, face: 'bliss' }], ['rig: hand up', { pose: 'stand', rig: { handN: [40, -260], kindN: 'point' } }], ['h 150', { pose: 'stand', h: 150 }]]]];
    rows.forEach(([y, items]) => {
      ground(y);
      items.forEach(([name, o], i) => {
        const x = 135 + i * 270;
        if (o.target && o.pose === 'snatch') o.target = [x + 90, y - 200];
        if (o.target && o.pose === 'sill') {
          o.target = [x, y - 150];
          L.pencil(ctx, [[x - 90, y - 150], [x + 90, y - 150]], { color: P.trunk, width: 3, seed: x });
        }
        C.hero(ctx, x, y, Object.assign({ h: 280 }, o));
        label(name, x, y + 30);
      });
    });
  },
});

// Cast sheet page 1 (street plate): the hero on the bicycle.
FILM.scene({
  id: 'hero-bike',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal, C = L.cast;
    ctx.fillStyle = P.fieldSky; // the scene's light field (art bible 2.3)
    ctx.fillRect(0, 0, info.W, info.H);
    const label = (s, x, y) => L.text(ctx, s, x, y, { size: 22, color: P.slate, align: 'center', weight: 400 });
    const ground = (y) => L.pencil(ctx, [[20, y], [1060, y + 2]], { color: L.mix(P.grass, P.ink, 0.35), width: 2, seed: y });
    L.text(ctx, 'hero · on the bicycle (street plate)', 40, 60, { size: 30, color: P.ink, weight: 400 });
    const H = 250;
    const rows = [[440, [['ride', { pose: 'ride', phase: 0, cycle: 4 }], ['ride phase .25', { pose: 'ride', phase: 0.25, cycle: 4 }], ['ride phase .5, bob 4', { pose: 'ride', phase: 0.5, cycle: 4, bob: 4 }]]],
      [880, [['crouch', { pose: 'crouch' }], ['dash (speed lines)', { pose: 'dash', t: 0.3 }], ['straddle', { pose: 'straddle' }]]],
      [1320, [['skid (+ dust)', { pose: 'skid' }], ['coins', { pose: 'coins' }], ['slap (+ star)', { pose: 'slap' }]]],
      [1760, [['snatch (+ smear)', { pose: 'snatch', target: [0, 0] }], ['spin k .5 (front)', { pose: 'spin', k: 0.5 }], ['spin k 1', { pose: 'spin', k: 0.9 }]]]];
    rows.forEach(([y, items]) => {
      ground(y);
      items.forEach(([name, o], i) => {
        const x = 185 + i * 355;
        if (o.pose === 'dash') L.speedLines(ctx, x - 150, y - 140, 0, { n: 4, spread: 150, len: [40, 90], seed: 4 });
        if (o.pose === 'skid') L.dust(ctx, x - 150, y - 16, { r: 40, p: 0.3, seed: 2 });
        if (o.pose === 'snatch') {
          o.target = [x + 160, y - 140];
          L.smear(ctx, [[x + 30, y - 200], [x + 90, y - 170], [x + 150, y - 145]], { colors: [P.skinKid, P.red], width: 40, seed: 5 });
        }
        const a = C.hero(ctx, x, y, Object.assign({ h: H }, o));
        if (o.pose === 'slap') L.impactStar(ctx, a.hand[0] + 18, a.hand[1] + 10, 40, { seed: 3 });
        label(name, x, y + 32);
      });
    });
  },
});

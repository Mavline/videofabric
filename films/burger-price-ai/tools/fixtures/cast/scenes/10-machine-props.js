// Cast sheet page 10 (machine plate): the three grounds of the plate (warm wall, night, pavement in
// perspective) bare at the top of each band, then the props: gauge, ticket, keypad, handset on its
// cord, mobile, and lettering of both plates.
FILM.scene({
  id: 'machine-props',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal, R = L.props;
    L.dense(ctx, null, { bounds: [0, 0, 1080, 640], base: P.wallWarm, dir: 'vertical', seed: 41 });
    L.dense(ctx, null, { bounds: [0, 640, 1080, 640], base: P.nightSky, dir: 'swirl', vp: [540, 960], seed: 42 });
    L.dense(ctx, null, { bounds: [0, 1280, 1080, 640], base: P.pavement, dir: 'perspective', vp: [540, 1000], seed: 43 });
    L.ragged(ctx, [[0, 640], [1080, 638]], { base: P.wallWarm, seed: 4 });
    L.ragged(ctx, [[0, 1280], [1080, 1278]], { base: P.nightSky, seed: 5 });
    const label = (s, x, y) => L.letters(ctx, s, x, y, { size: 24, face: 'note', align: 'center', color: P.white, seed: x + y, jitter: 0.6 });
    L.letters(ctx, 'machine plate · wall, night, floor', 40, 70, { size: 32, face: 'note', color: P.white, seed: 9 });
    // lettering of both plates on the warm wall
    L.letters(ctx, 'a tool, not a mandate', 540, 300, { size: 64, face: 'note', align: 'center', color: P.white, seed: 21 });
    L.cel(ctx, L.rectPts(150, 400, 780, 170, 30), { fill: P.paper, seed: 4 });
    L.spot(ctx, 540, 480, 300, 52, { seed: 8 });
    const tsz = Math.min(66, (66 * 700) / L.letters(ctx, 'ONE BURGER, TWO PRICES', 0, 0, { size: 66, measure: true }).w);
    L.letters(ctx, 'ONE BURGER, TWO PRICES', 540, 505, { size: tsz, align: 'center', color: P.titleBlue, firstColor: P.titleYellow, outline: P.ink, seed: 23 });
    label('street title on a card', 540, 600);
    // the gauge and the ticket on the night ground
    R.gauge(ctx, 330, 1090, { r: 150, level: 0.62 });
    R.ticket(ctx, 820, 760, { w: 170, lines: ['RECOMMENDED:', '$6.89'] });
    label('ticket', 820, 1010);
    // keypad, handset and mobile on the floor
    R.keypad(ctx, 230, 1900, { w: 220, text: '$6.8', press: 7, labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '#'] });
    const hs = R.handset(ctx, 560, 1460, { w: 130, rot: 0.4 });
    R.cord(ctx, hs.cord, [640, 1640], { loops: 9 });
    label('handset, cord', 620, 1700);
    R.mobile(ctx, 880, 1560, { h: 260, lines: ['YOUR RESTAURANT', 'IS SHOWING', 'MEDIUM', 'SENSITIVITY', 'TO PRICE'] });
  },
});

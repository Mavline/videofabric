// Cast sheet page 3 (street plate): every face of the hero, heads only, and the extreme close-up line.
FILM.scene({
  id: 'hero-faces',
  draw(ctx, t, info) {
    const L = info.lib, P = L.pal, C = L.cast;
    ctx.fillStyle = P.fieldMint; // the scene's light field (art bible 2.3)
    ctx.fillRect(0, 0, info.W, info.H);
    L.text(ctx, 'hero · faces (head radius 77 px), and line 11 at the bottom', 40, 60, { size: 28, color: P.ink, weight: 400 });
    const faces = ['smile', 'neutral', 'grin', 'open', 'O', 'chew', 'bliss', 'gulp', 'lick', 'jaw', 'glare', 'determined', 'sniff', 'pant', 'pop', 'sad'];
    faces.forEach((face, i) => {
      const cx = 140 + (i % 4) * 267, cy = 300 + Math.floor(i / 4) * 330;
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - 125, cy - 160, 250, 300);
      ctx.clip();
      // h 480: head radius 77; the head centre sits 236/300 of h above the ground
      C.hero(ctx, cx - 10, cy + 0.787 * 480, { h: 480, pose: 'stand', face, t: 0.1 });
      ctx.restore();
      L.text(ctx, face, cx, cy + 165, { size: 22, color: P.slate, align: 'center', weight: 400 });
    });
    ctx.save();
    ctx.beginPath();
    ctx.rect(20, 1600, 1040, 310);
    ctx.clip();
    C.hero(ctx, 300, 1640 + 0.787 * 1200, { h: 1200, pose: 'stand', face: 'grin', line: L.LINE_XCU });
    C.hero(ctx, 800, 1640 + 0.787 * 1200, { h: 1200, pose: 'pop', stalk: 0.6, line: L.LINE_XCU });
    ctx.restore();
  },
});

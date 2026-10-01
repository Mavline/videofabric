// 14 owner-types: A sigh, then he types the price. T 24.0 to 26.0 (shot t 0 to 2.0, frames 0 to 47), schematic.
// docs/storyboard.md plan 14: a dense close-up of the owner behind his counter, the handset pinned between his
// ear and shoulder, the G4 tag held up in his far hand, his near hand typing on the keypad.
//
// Layers, back to front:
//   1 the warm wall above the counter (lib.dense, its texture cached)
//   2 the G4 tag: the $ from frame 0, each digit pops into its place with its key; the strings dangle
//   3 the owner, back layer: the far arm raised to the tag's lower left corner, body, apron, head
//   4 the telephone cord from the handset, looping down behind the counter
//   5 the counter top (lib.dense, its texture cached; two torn lines on its far edge) and the keypad on it
//   6 the owner, front layer: the near arm typing; then the handset (lib.props.handset), its earpiece on his ear
//     anchor, laid over the arm because it rests on that shoulder
//   7 drawn effects: zigzags at the earpiece while the voice talks (twos), the sigh puff, a key flash per press
//   8 the white caption at the lower left (G8)
//
// Beats (global T, shot t, shot frame f):
//   T 24.0    t 0      f 0   frame 0: listening, the handset at his ear, the tag shows only $, the caption on;
//                             zigzags flicker at the earpiece on twos while the voice talks (they change on f 1, 3,
//                             5, 7, 9, 11, with the nods)
//   T 24.125  t 0.125  f 3   a nod (2 frames)
//   T 24.375  t 0.375  f 9   a nod; on f 11 the head comes up past rest and the shoulders rise: the in-breath
//   T 24.5    t 0.5    f 12  the sigh: the shoulders drop 20 px on twos (22 on f 16, the overshoot), the lids
//                             half close, the puff leaves his mouth and drifts 60 px over 12 frames
//   T 24.917  t 0.917  f 22  the finger winds up (twos)
//   T 25.0    t 1.0    f 24  four presses on 16ths, on ones (f 24, 27, 30, 33): 6, the point, 8, 9; the finger is
//                             down for 1 frame, the key sinks with a 1-frame flash, the glyph pops for 2 frames
//   T 25.5    t 1.5    f 36  the tag reads $6.89: a 4 px dip (f 34), then he lifts it 20 px (24 on f 36, 20 from
//                             f 38) and shows it with the resigned face; a blink on f 42 and 43; held to the cut
(() => {
  'use strict';
  const ID = 'owner-types';
  const sd = (...k) => FILM.lib.hash(ID, ...k) & 0x7fffffff;

  // ---- composition, frame px (storyboard plan 14) ----
  const S = 300 / 72; // px per design unit: head height 300 over his 72-unit head (art bible 10.2: h about 1670)
  const HEAD = [24, -330]; // the 'listen' pose's head centre, design units
  const OWN = { x: 300 - HEAD[0] * S, y: 820 - HEAD[1] * S, h: 400 * S }; // the head centre lands on (300, 820)
  const D = (p) => [(p[0] - OWN.x) / S, (p[1] - OWN.y) / S]; // frame px to his design units
  const COUNTER_Y = 1150; // the counter's far edge, the warm wall above it
  const TAG = { x: 700, y: 300, w: 440, h: 280 }; // G4: card x 480 to 920, y 300 to 580
  const GRIP = [474, 590]; // his fist on the card's lower left corner, clear of the $
  const PRICE = '$6.89';
  // keypad bottom centre: top at y 1180, keys of 83 px from x 655 to 925 (body to x 936), no screen strip. At
  // the storyboard's 92 px keys (w 300) the bottom row's labels end at y 1640, below the safe area (the gate
  // stops them at 1540); 20 px right of the storyboard's x 620 so the hand on the point key clears the caption
  const PAD = { x: 790, y: 1585, w: 270, screen: false };
  const LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '#']; // the point where a phone has '*'
  const KEYS = [5, 9, 7, 8]; // 6, the point, 8, 9
  const PRESS = [24, 27, 30, 33]; // the presses, T 25.0, 25.125, 25.25, 25.375
  const HANDSET = { w: 240, rot: 0.8 }; // the handset from his ear down across the jaw to the shoulder
  // the quote re-broken so it stands at G8's cap height 44 inside x 80 to 590 (team lead, after review)
  const CAPTION = ['Ex-owner:', '"You don\'t really', 'have much of a', 'choice anymore."'];
  const CAP_BASE = [1250, 1320, 1390, 1460];

  // ---- the action, frame by frame ----
  function beat(fr) {
    const st = { drop: 0, nod: 0, tilt: -0.24, face: 'tired', blink: false, lift: 0, count: 1, pop: 1, press: -1 };
    if (fr === 3 || fr === 4 || fr === 9 || fr === 10) Object.assign(st, { tilt: -0.1, nod: 2.5 }); // the nods, on twos
    if (fr === 11) Object.assign(st, { drop: -8, tilt: -0.3 }); // the in-breath, snapped up before the beat
    if (fr >= 12) {
      st.drop = fr < 14 ? 9 : fr < 16 ? 17 : fr < 18 ? 22 : 20;
      st.tilt = fr < 14 ? -0.2 : fr < 16 ? -0.15 : -0.12;
      st.face = fr < 22 ? 'sigh' : 'bored';
    }
    for (let i = 0; i < 4; i++) {
      if (fr >= PRESS[i]) st.count = i + 2;
      if (fr === PRESS[i]) Object.assign(st, { pop: 1.3, press: KEYS[i] });
      if (fr === PRESS[i] + 1) st.pop = 1.12;
    }
    if (fr >= 34) st.lift = fr < 36 ? 4 : fr < 38 ? -24 : -20;
    if (fr >= 36) Object.assign(st, { tilt: 0, face: 'resigned' }); // the head dips as he shows it
    if (fr === 42 || fr === 43) st.blink = true;
    return st;
  }

  // where the near fingertip is: a frame point, or a key (down on it, or raised over it by px)
  const REST_TIP = [868, 1376];
  function fingerAt(fr) {
    if (fr < 12) return { pt: REST_TIP }; // resting on the keypad while he listens
    if (fr < 22) return { pt: [862, 1392] }; // sunk with the sigh
    if (fr < 24) return { pt: [884, 1286] }; // the wind-up: the finger lifts before the first jab
    for (let i = 3; i >= 0; i--) {
      const f0 = PRESS[i];
      if (fr === f0) return { key: KEYS[i], raise: 0 };
      if (fr === f0 + 1) return { key: KEYS[i], raise: 34 };
      if (fr === f0 + 2 && i < 3) return { key: KEYS[i + 1], raise: 30 };
      if (fr > f0 && i === 3) return { key: KEYS[3], raise: fr < 36 ? 40 : 56 };
    }
    return { key: KEYS[0], raise: 30 };
  }
  // the near shoulder leans toward the keypad while he types (design units)
  const lean = (fr) => (fr >= 24 && fr < 36 ? 9 : 0);
  // His arm is long and the keypad far: left to the arm's own bend, the near elbow drops onto the caption or
  // rises across his chin. It is pinned instead (rig.elbowAt) in the free band between the two, and follows
  // the fingertip a little
  const ELBOW = [540, 1110];
  const elbowAt = (st, tip) => [ELBOW[0] + st.lean * S * 0.5 + 0.1 * (tip[0] - REST_TIP[0]), ELBOW[1] + st.drop + 0.2 * (tip[1] - REST_TIP[1])];

  // ---- 1 the warm wall, 5 the counter: lib.dense caches each texture, so the shot keeps two cache entries ----
  function wall(ctx, L, P) {
    L.dense(ctx, null, { bounds: [0, 0, 1080, COUNTER_Y + 20], base: P.wallWarm, dir: 'vertical', seed: sd('wall') });
  }
  function counter(ctx, L, P) {
    L.dense(ctx, null, { bounds: [0, COUNTER_Y, 1080, 1920 - COUNTER_Y], base: P.fence, dir: 'horizontal', seed: sd('top') });
    L.ragged(ctx, [[-10, COUNTER_Y + 2], [1090, COUNTER_Y]], { base: P.fence, width: 5, seed: sd('edge') });
    L.ragged(ctx, [[-10, COUNTER_Y + 16], [1090, COUNTER_Y + 13]], { base: P.fence, width: 3, seed: sd('edge2') });
  }

  // ---- 2 the G4 tag held in his hand (03's call with the strings dangling): count glyphs in their slots ----
  const G4_SLOTS = [[505, 585], [590, 675], [680, 710], [715, 800], [805, 890]];
  function tag(ctx, R, y, count, pop) {
    R.priceTag(ctx, TAG.x, y, { w: TAG.w, h: TAG.h, hang: 'holes', drop: 400, pivot: 'top', size: 160, baseline: 230, slots: G4_SLOTS, price: PRICE, strings: 'dangle', count, popLast: pop });
  }

  // ---- 7 drawn effects ----
  // three short zigzags off the earpiece, away from his head; two drawings swapped on twos, on the odd frames
  // where the nods change too, so nothing moves on the even frames of the listening
  function zigzags(ctx, L, ear, fr) {
    const alt = Math.floor((fr + 1) / 2) % 2;
    [-2.2, -2.75, -3.3].forEach((a, i) => {
      const r0 = 46 + (alt ? 8 : 0) + i * 4, len = 58 + (alt ? -8 : 6), n = 5;
      const ca = Math.cos(a), sa = Math.sin(a);
      const pts = [];
      for (let k = 0; k <= n; k++) {
        const u = r0 + (len * k) / n, z = (k % 2 ? 1 : -1) * 9;
        pts.push([ear[0] + ca * u - sa * z, ear[1] + sa * u + ca * z]);
      }
      L.stroke(ctx, pts, { width: 4, smooth: false, taper: [3, 6], seed: sd('zig', i, alt) });
    });
  }
  // a click: short strokes off the pressed key for 1 frame, on the side away from his hand
  function keyFlash(ctx, L, c, i) {
    [-0.5, 0.15, 0.8, 1.45].forEach((a, k) => {
      const ca = Math.cos(a), sa = Math.sin(a);
      L.stroke(ctx, [[c[0] + ca * 58, c[1] + sa * 58], [c[0] + ca * 84, c[1] + sa * 84]], { width: 4.5, taper: [2, 4], seed: sd('flash', i, k) });
    });
  }

  // ---- 8 the caption (G8): white handwriting on the counter, an ink pass under it so it reads on the wood ----
  // cap height 44; shrunk only if a line would leave the box x 80 to 590
  function caption(ctx, L, P) {
    const base = { size: 44 / 0.71, face: 'note' };
    const wide = Math.max(...CAPTION.map((s, i) => L.letters(ctx, s, 80, CAP_BASE[i], Object.assign({ seed: sd('cap', i), measure: true }, base)).w));
    if (wide > 510) base.size *= 510 / wide;
    for (const pass of [{ color: P.ink, outline: P.ink, outlineWidth: 5.5 }, { color: P.white }]) {
      CAPTION.forEach((s, i) => L.letters(ctx, s, 80, CAP_BASE[i], Object.assign({ seed: sd('cap', i) }, base, pass)));
    }
  }

  // runs a draw call into an empty clip: nothing lands on the frame, the anchors come back
  function blind(ctx, fn) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 0, 0);
    ctx.clip();
    const r = fn();
    ctx.restore();
    return r;
  }

  // ---- the owner's rig for one drawing (design units, y up negative) ----
  function rig(st, wrist, elbow) {
    const d = st.drop / S;
    const head = [HEAD[0] + st.nod * 0.4, HEAD[1] + d + st.nod];
    return {
      neck: [12 + st.lean * 0.4, -310 + d], shN: [12 + st.lean, -300 + d], shF: [-2, -302 + d], head,
      holdKind: null, armsFront: false,
      handF: D([GRIP[0] - 4, GRIP[1] + 42 + st.lift]), elbowF: [1, 0.4], kindF: 'fist',
      handN: D(wrist), elbowAt: D(elbow), kindN: 'point',
    };
  }

  FILM.scene({
    id: ID,
    draw(ctx, tIn, info) {
      const L = info.lib, P = L.pal, C = L.cast, R = L.props;
      const t = L.clamp(tIn, 0, info.dur);
      const fr = Math.min(47, Math.floor(t * 24 + 1e-6));
      const st = beat(fr);
      st.lean = lean(fr);

      // 1 the wall
      wall(ctx, L, P);
      // 2 the tag
      tag(ctx, R, TAG.y + st.lift, st.count, st.pop);

      // the keypad's keys, for the finger (measured without drawing)
      const keyAt = blind(ctx, () => R.keypad(ctx, PAD.x, PAD.y, { w: PAD.w, screen: PAD.screen, labels: false })).key;
      const fa = fingerAt(fr);
      const tip = fa.pt || [keyAt(fa.key)[0] - 6, keyAt(fa.key)[1] - 10 - fa.raise];
      // the wrist: 33 units back from the fingertip along the forearm, then corrected once by a blind draw
      const elbow = elbowAt(st, tip);
      const dl = Math.hypot(tip[0] - elbow[0], tip[1] - elbow[1]);
      let wrist = [tip[0] - ((tip[0] - elbow[0]) / dl) * 33 * S, tip[1] - ((tip[1] - elbow[1]) / dl) * 33 * S];
      const o = { h: OWN.h, pose: 'listen', face: st.face, tilt: st.tilt, blink: st.blink };
      const a0 = blind(ctx, () => C.owner(ctx, OWN.x, OWN.y, Object.assign({}, o, { layer: 'front', rig: rig(st, wrist, elbow) })));
      wrist = [wrist[0] + tip[0] - a0.hand[0], wrist[1] + tip[1] - a0.hand[1]];
      const ro = Object.assign({}, o, { rig: rig(st, wrist, elbow) });

      // 3 the owner, back layer
      const a = C.owner(ctx, OWN.x, OWN.y, Object.assign({ layer: 'back' }, ro));
      // the handset's place: its earpiece on his ear (measured at the origin without drawing)
      const hs0 = blind(ctx, () => R.handset(ctx, 0, 0, HANDSET));
      const hsAt = [a.ear[0] - hs0.ear[0], a.ear[1] - hs0.ear[1]];
      // 4 the cord from the handset's lower end, down behind the counter
      R.cord(ctx, [hsAt[0] + hs0.cord[0], hsAt[1] + hs0.cord[1]], [150, COUNTER_Y + 60], { loops: 9, r: 15, sag: 50 });
      // 5 the counter and the keypad
      counter(ctx, L, P);
      R.keypad(ctx, PAD.x, PAD.y, { w: PAD.w, screen: PAD.screen, labels: LABELS, press: st.press });
      // 6 the owner, front layer: the near arm; the handset pinned over his ear and shoulder
      C.owner(ctx, OWN.x, OWN.y, Object.assign({ layer: 'front' }, ro));
      R.handset(ctx, hsAt[0], hsAt[1], HANDSET);

      // 7 drawn effects
      if (fr < 12) zigzags(ctx, L, a.ear, fr);
      if (fr >= 12 && fr < 24) {
        const age = (Math.floor((fr - 12) / 2) * 2) / 12;
        // pale grey, so the breath reads over the pink sleeve and the dark wall; it passes under his far elbow
        L.puff(ctx, a.mouth[0] + 24, a.mouth[1] + 14, { p: age, dir: 0.22, drift: 60, len: 170, width: 54, color: L.mix(P.white, P.hillsFar, 0.45), seed: sd('puff') });
      }
      if (st.press >= 0) keyFlash(ctx, L, keyAt(st.press), fr);

      // 8 the caption
      caption(ctx, L, P);
    },
  });
})();

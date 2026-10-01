// music.js : the score and sound design of the film.
// Owner: music. Contract: docs/CONTRACT.md, section Audio.
//
// FILM.audio.render(ctx, { start = 0, dest = ctx.destination }) schedules the whole piece,
// music and effects, from global time `start` into any BaseAudioContext.
// Every sound is synthesised here: oscillators, periodic waves, seeded noise, filters, envelopes,
// a ping-pong delay, convolver reverbs on generated impulse responses, a glue compressor and a
// soft limiter. Randomness comes only from FILM.lib.rng, seeded per event, so any start time
// schedules the same notes at the same global times.
//
// The engine, instruments, effects and master chain below are film-agnostic. Per film the music
// agent replaces three things: the CH chord table, the MIX.ride section automation, and the whole
// score() function — composing against FILM.TIMELINE.bpm and FILM.TIMELINE.cues so hits land on
// the cuts. The score below is this film's: a puppet-jazz band (pizzicato, xylophone, a clarinet-like
// reed, a small cymbal, a woodblock) with every cue of FILM.TIMELINE at its time; see the score section.
(function () {
  'use strict';
  const FILM = window.FILM;
  const lib = FILM.lib;
  const TAU = Math.PI * 2;
  const FLOOR = 1e-5;

  // DynamicsCompressorNode delays its output by a fixed 6 ms look-ahead (measured: 288 samples at
  // 48 kHz). Every event before the compressor is scheduled that much early, so it leaves the master
  // exactly on its cue. Only an event inside the first 6 ms of a render window can land late.
  const LAT = 0.006;

  // Mix constants, tuned by measurement (tools/audio): loudness, peaks, per-bar profile.
  const MIX = {
    trim: 1.05,
    ceiling: 0.66, // soft limiter output ceiling (about -3.6 dBFS)
    knee: 0.5,
    bus: { drums: 0.6, perc: 0.8, bass: 0.3, pad: 0.26, keys: 0.6, bells: 0.45, lead: 0.5, sfx: 0.62, amb: 0.5 },
    // Master tilt EQ in dB: a low shelf under the subs, presence and air for phone speakers.
    eq: { low: -4, presence: 5, air: 3 },
    comp: { threshold: -18, knee: 10, ratio: 2, attack: 0.006, release: 0.2 },
    // Section fader rides in dB at global times, pre-compressor: the cold open a touch forward, then
    // level, and a lift through the last half-second that meets the opening level at the loop seam.
    ride: [[0, 1], [1.9, 1], [2.0, 0], [31.5, 0], [32, 1]],
  };

  // ---------------------------------------------------------------- pitch
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function hz(n) {
    if (typeof n === 'number') return n;
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
    const midi = 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // ---------------------------------------------------------------- envelopes
  // pts: [[dt, value, shape]] with dt from the note start; shape is the ramp INTO that point:
  // 'lin' (default), 'exp' or 'set'. The first point must sit at dt 0.
  // When the voice started before the render window (skip > 0) the value at `skip` is computed
  // and automation resumes from there, so a seek hears the same envelope.
  function setEnv(param, pts, c0, skip) {
    let i;
    let prev;
    if (skip > 0) {
      let v = pts[0][1];
      for (i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        if (skip < b[0]) {
          const f = (skip - a[0]) / Math.max(1e-9, b[0] - a[0]);
          const sh = b[2] || 'lin';
          if (sh === 'set') v = a[1];
          else if (sh === 'exp' && a[1] > 0) v = a[1] * Math.pow(Math.max(b[1], FLOOR) / a[1], f);
          else v = a[1] + (b[1] - a[1]) * f;
          break;
        }
        v = b[1];
      }
      param.setValueAtTime(v, c0 + skip);
      prev = v;
    } else {
      param.setValueAtTime(pts[0][1], c0);
      prev = pts[0][1];
      i = 1;
    }
    for (; i < pts.length; i++) {
      const v = pts[i][1];
      const sh = pts[i][2] || 'lin';
      const w = c0 + pts[i][0];
      if (sh === 'set') {
        param.setValueAtTime(v, w);
        prev = v;
      } else if (sh === 'exp' && prev > 0) {
        param.exponentialRampToValueAtTime(Math.max(v, FLOOR), w);
        prev = Math.max(v, FLOOR);
      } else {
        param.linearRampToValueAtTime(v, w);
        prev = v;
      }
    }
  }

  // Percussive amplitude envelope: attack then exponential decay to silence.
  const perc = (vel, att, dec) => [[0, 0], [att, vel], [att + dec, FLOOR, 'exp']];

  // ---------------------------------------------------------------- generated buffers
  function noiseBuffer(ctx, secs, channels, seed) {
    const n = Math.floor(secs * ctx.sampleRate);
    const buf = ctx.createBuffer(channels, n, ctx.sampleRate);
    for (let ch = 0; ch < channels; ch++) {
      const r = lib.rng(lib.hash('film-noise', seed, ch));
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    }
    return buf;
  }

  // Impulse response: seeded stereo noise, exponential decay to -60 dB at `secs`, a two-pole
  // lowpass that darkens over the tail, a pre-delay and a few early reflections.
  function impulse(ctx, secs, seed, o) {
    const sr = ctx.sampleRate;
    const n = Math.floor(secs * sr);
    const buf = ctx.createBuffer(2, n, sr);
    const pre = Math.floor(o.pre * sr);
    const tail = secs - o.pre;
    for (let ch = 0; ch < 2; ch++) {
      const r = lib.rng(lib.hash('film-ir', seed, ch));
      const d = buf.getChannelData(ch);
      let l1 = 0;
      let l2 = 0;
      for (let i = pre; i < n; i++) {
        const t = (i - pre) / sr;
        const u = t / tail;
        const env = Math.exp(-6.9 * u) * (t < 0.005 ? t / 0.005 : 1);
        const a = o.bright + (o.dark - o.bright) * Math.sqrt(u);
        l1 += a * (r() * 2 - 1 - l1);
        l2 += a * (l1 - l2);
        d[i] = l2 * env;
      }
      for (let k = 0; k < o.early; k++) {
        const i = pre + Math.floor((0.003 + r() * o.spread) * sr);
        if (i < n) d[i] += (r() * 2 - 1) * 0.35 * (1 - k / o.early);
      }
    }
    return buf;
  }

  // Grains rendered straight into a stereo buffer: band-passed noise flaps and clicks, or short sines.
  // g: { t, dur, amp, pan (-1..1), f, q, att, dec, sine }
  function grainBuffer(ctx, key, secs, grains) {
    const sr = ctx.sampleRate;
    const n = Math.max(1, Math.ceil(secs * sr));
    const buf = ctx.createBuffer(2, n, sr);
    const L = buf.getChannelData(0);
    const R = buf.getChannelData(1);
    const r = lib.rng(lib.hash('film-grain', key));
    for (const g of grains) {
      const i0 = Math.floor(g.t * sr);
      const m = Math.floor(g.dur * sr);
      const gl = Math.cos(((g.pan + 1) * Math.PI) / 4);
      const gr = Math.sin(((g.pan + 1) * Math.PI) / 4);
      const att = g.att || 0.002;
      const dec = g.dec || g.dur * 0.3;
      const w = (TAU * g.f) / sr;
      const al = Math.sin(w) / (2 * (g.q || 1));
      const cw = Math.cos(w);
      const a0 = 1 + al;
      let x1 = 0;
      let x2 = 0;
      let y1 = 0;
      let y2 = 0;
      const ph = r() * TAU;
      for (let k = 0; k < m; k++) {
        const j = i0 + k;
        if (j >= n) break;
        const tt = k / sr;
        let s;
        if (g.sine) s = Math.sin(ph + w * k);
        else {
          const x = r() * 2 - 1;
          s = (al * x - al * x2 + 2 * cw * y1 - (1 - al) * y2) / a0;
          x2 = x1;
          x1 = x;
          y2 = y1;
          y1 = s;
        }
        const env = tt < att ? tt / att : Math.exp(-(tt - att) / dec);
        const tailFade = k > m - 64 ? (m - k) / 64 : 1;
        const v = s * env * tailFade * g.amp;
        if (j >= 0) {
          L[j] += v * gl;
          R[j] += v * gr;
        }
      }
    }
    return buf;
  }

  // Stick-slip creak: irregular pulses, each ringing three damped wooden resonances.
  function creakBuffer(ctx, key, secs, rate0, rate1, formants) {
    const sr = ctx.sampleRate;
    const n = Math.ceil(secs * sr);
    const buf = ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    const r = lib.rng(lib.hash('film-creak', key));
    let t = 0.004;
    while (t < secs - 0.01) {
      const u = t / secs;
      const swell = Math.sin(Math.PI * Math.min(1, u * 1.15)) * (0.55 + 0.45 * r());
      const i0 = Math.floor(t * sr);
      for (const [f, tau, a] of formants) {
        const m = Math.min(n - i0, Math.floor(tau * 5 * sr));
        const fj = f * (0.94 + 0.12 * r());
        for (let k = 0; k < m; k++) d[i0 + k] += swell * a * Math.exp(-k / sr / tau) * Math.sin((TAU * fj * k) / sr);
      }
      const rate = rate0 + (rate1 - rate0) * u;
      t += (1 / rate) * (0.7 + 0.6 * r());
    }
    for (let k = 0; k < 96 && k < n; k++) d[n - 1 - k] *= k / 96;
    return buf;
  }

  // Soft limiter transfer curve. The shaper is fed at half level, so the curve covers inputs up to
  // +6 dBFS: linear to the knee, then a tanh shoulder that never passes the ceiling.
  function limiterCurve(ceiling, knee) {
    const n = 16385;
    const c = new Float32Array(n);
    const room = ceiling - knee;
    for (let i = 0; i < n; i++) {
      const x = ((i / (n - 1)) * 2 - 1) * 2;
      const a = Math.abs(x);
      const y = a <= knee ? a : knee + room * Math.tanh((a - knee) / room);
      c[i] = x < 0 ? -y : y;
    }
    return c;
  }

  function periodic(ctx, n, amp) {
    const real = new Float32Array(n + 1);
    const imag = new Float32Array(n + 1);
    for (let k = 1; k <= n; k++) imag[k] = amp(k);
    return ctx.createPeriodicWave(real, imag);
  }

  // ---------------------------------------------------------------- engine
  function makeEngine(ctx, start, dest, DUR, MIX) {
    const base = ctx.currentTime;
    const E = { ctx, sr: ctx.sampleRate, start, base, DUR, duckTargets: [] };

    // A voice is a note or effect that starts at global time t0 and lasts len seconds (release included).
    // A sustained voice whose compensated start falls before the window resumes mid-envelope on time.
    // A short voice that starts inside the first 6 ms plays whole, up to 6 ms late; one that began
    // earlier is skipped.
    E.w0 = -Infinity;
    E.w1 = Infinity;
    E.voice = function (t0, len, sustain) {
      if (t0 < E.w0 || t0 >= E.w1) return null; // belongs to another scheduling window
      if (t0 >= DUR || t0 + len <= start) return null;
      const c = base + (t0 - start) - LAT;
      let c0 = c;
      let skip = 0;
      if (c < base) {
        if (sustain) skip = base - c;
        else if (t0 >= start) c0 = base;
        else return null;
      }
      return {
        c0,
        skip,
        len,
        env: (param, pts) => setEnv(param, pts, c0, skip),
        osc(node, stopDt) {
          node.start(c0 + skip);
          node.stop(c0 + Math.max(stopDt === undefined ? len : stopDt, skip + 0.002));
          return node;
        },
        buf(node, offset, stopDt) {
          const d = node.buffer.duration;
          let off = (offset || 0) + skip;
          if (node.loop) off %= d;
          else if (off >= d) return node;
          node.start(c0 + skip, off);
          node.stop(c0 + Math.max(stopDt === undefined ? len : stopDt, skip + 0.002));
          return node;
        },
      };
    };

    E.gain = (v) => {
      const g = ctx.createGain();
      g.gain.value = v === undefined ? 1 : v;
      return g;
    };
    E.osc = (type, f) => {
      const o = ctx.createOscillator();
      if (typeof type === 'string') o.type = type;
      else o.setPeriodicWave(type);
      o.frequency.value = f;
      return o;
    };
    E.filt = (type, f, q) => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q === undefined ? 0.707 : q;
      return b;
    };
    E.panner = (p) => {
      const s = ctx.createStereoPanner();
      s.pan.value = p;
      return s;
    };
    E.rng = (...k) => lib.rng(lib.hash('film-score', ...k));

    // ---- master: highpass, glue compressor, trim, soft limiter, output fades
    const master = E.gain(1);
    const hp = E.filt('highpass', 26, 0.6);
    const lowShelf = E.filt('lowshelf', 140, 0.7);
    lowShelf.gain.value = MIX.eq.low;
    const presence = E.filt('peaking', 3000, 0.7);
    presence.gain.value = MIX.eq.presence;
    const air = E.filt('highshelf', 8000, 0.7);
    air.gain.value = MIX.eq.air;
    const comp = ctx.createDynamicsCompressor();
    for (const k in MIX.comp) comp[k].value = MIX.comp[k];
    const trim = E.gain(MIX.trim * 0.5);
    const lim = ctx.createWaveShaper();
    lim.curve = limiterCurve(MIX.ceiling, MIX.knee);
    lim.oversample = 'none';
    const out = E.gain(1);
    master.connect(hp);
    hp.connect(lowShelf);
    lowShelf.connect(presence);
    presence.connect(air);
    air.connect(comp);
    comp.connect(trim);
    trim.connect(lim);
    lim.connect(out);
    out.connect(dest);
    E.master = master;
    // Output fades sit after the compressor, so they use uncompensated times. The compressor's
    // first 6 ms are silent; the output then opens over 3 ms, and the last 10 ms taper to zero, so the
    // loop seam and every seek start without a click.
    out.gain.setValueAtTime(0, base);
    out.gain.setValueAtTime(0, base + LAT);
    out.gain.linearRampToValueAtTime(1, base + LAT + 0.003);
    const cEnd = base + (DUR - start);
    if (DUR - start > 0.05) {
      out.gain.setValueAtTime(1, cEnd - 0.01);
      out.gain.linearRampToValueAtTime(0, cEnd);
    }
    // Section rides on the master input, compensated like every other pre-compressor event.
    setEnv(master.gain, MIX.ride.map(([t, d], i) => [t, Math.pow(10, d / 20), i ? 'lin' : undefined]), base - start - LAT, start + LAT);

    // ---- shared buffers
    E.white = noiseBuffer(ctx, 2.5, 1, 'white');
    E.wide = noiseBuffer(ctx, 5, 2, 'wide');
    E.warmSaw = periodic(ctx, 48, (k) => Math.pow(k, -1.35) * (k > 24 ? Math.exp(-(k - 24) / 10) : 1));
    E.softSquare = periodic(ctx, 31, (k) => (k % 2 ? Math.pow(k, -1.5) : 0.04 / k));
    E.brassSaw = periodic(ctx, 40, (k) => Math.pow(k, -1.05));

    // ---- effects returns
    E.fx = {};
    const verb = (name, secs, o, ret) => {
      const c = ctx.createConvolver();
      c.buffer = impulse(ctx, secs, name, o);
      const g = E.gain(ret);
      c.connect(g);
      g.connect(master);
      E.fx[name] = c;
    };
    verb('room', 0.9, { pre: 0.006, bright: 0.55, dark: 0.18, early: 10, spread: 0.035 }, 0.9);
    verb('hall', 2.8, { pre: 0.018, bright: 0.45, dark: 0.09, early: 14, spread: 0.07 }, 0.9);
    verb('cave', 6.0, { pre: 0.03, bright: 0.35, dark: 0.05, early: 18, spread: 0.12 }, 0.85);

    // Ping-pong delay, a dotted 8th (0.375 s) each side.
    const dIn = E.gain(1);
    dIn.channelCount = 1;
    dIn.channelCountMode = 'explicit';
    const dL = ctx.createDelay(1);
    const dR = ctx.createDelay(1);
    dL.delayTime.value = 0.375;
    dR.delayTime.value = 0.375;
    const fL = E.filt('lowpass', 4200, 0.5);
    const fR = E.filt('lowpass', 3400, 0.5);
    const gL = E.gain(0.4);
    const gR = E.gain(0.4);
    dIn.connect(dL);
    dL.connect(fL);
    fL.connect(gL);
    gL.connect(dR);
    dR.connect(fR);
    fR.connect(gR);
    gR.connect(dL);
    const mrg = ctx.createChannelMerger(2);
    fL.connect(mrg, 0, 0);
    fR.connect(mrg, 0, 1);
    const dRet = E.gain(0.75);
    mrg.connect(dRet);
    dRet.connect(master);
    const dVerb = E.gain(0.25);
    dRet.connect(dVerb);
    dVerb.connect(E.fx.hall);
    E.fx.delay = dIn;

    // ---- buses
    E.bus = {};
    // Per-voice sends pass through a tap scaled by the bus gain, so a bus fader moves its reverb too.
    E.tap = {};
    const taps = (name) => {
      E.tap[name] = {};
      for (const k of ['room', 'hall', 'cave', 'delay']) {
        const g = E.gain(MIX.bus[name]);
        g.connect(E.fx[k]);
        E.tap[name][k] = g;
      }
    };
    const bus = (name, sends, duck, hpf) => {
      taps(name);
      const b = E.gain(MIX.bus[name]);
      let tail = b;
      if (hpf) {
        const h = E.filt('highpass', hpf, 0.6);
        tail.connect(h);
        tail = h;
      }
      if (duck) {
        const d = E.gain(1);
        b.connect(d);
        tail = d;
        E.duckTargets.push(d.gain);
      }
      tail.connect(master);
      for (const k in sends) {
        const s = E.gain(sends[k]);
        tail.connect(s);
        s.connect(E.fx[k]);
      }
      E.bus[name] = b;
    };
    // Drum bus: a gentle saturator adds harmonics so the kick reads on phone speakers.
    {
      const b = E.gain(MIX.bus.drums);
      const drive = E.gain(1.6);
      const sat = ctx.createWaveShaper();
      const curve = new Float32Array(2049);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1;
        curve[i] = Math.tanh(x * 1.4) / Math.tanh(1.4);
      }
      sat.curve = curve;
      const back = E.gain(0.72);
      b.connect(drive);
      drive.connect(sat);
      sat.connect(back);
      back.connect(master);
      const rs = E.gain(0.1);
      back.connect(rs);
      rs.connect(E.fx.room);
      E.bus.drums = b;
      taps('drums');
    }
    bus('perc', { room: 0.1 });
    bus('bass', {}, true);
    bus('pad', { hall: 0.22 }, true, 180);
    bus('keys', { room: 0.12, hall: 0.14, delay: 0.06 });
    bus('bells', { hall: 0.3, cave: 0.06, delay: 0.14 });
    bus('lead', { hall: 0.22, delay: 0.18 });
    bus('sfx', { room: 0.14 });
    bus('amb', { hall: 0.12 });

    // Route a voice's last node to a bus, with an optional pan and extra sends.
    E.out = (node, busName, o) => {
      o = o || {};
      let n = node;
      if (o.pan) {
        const p = E.panner(o.pan);
        n.connect(p);
        n = p;
      }
      n.connect(E.bus[busName]);
      for (const k of ['room', 'hall', 'cave', 'delay']) {
        if (o[k]) {
          const s = E.gain(o[k]);
          n.connect(s);
          s.connect(E.tap[busName][k]);
        }
      }
      return n;
    };

    // Looping noise source with a per-event deterministic read offset.
    E.noise = (V, key, stereo) => {
      const s = ctx.createBufferSource();
      s.buffer = stereo ? E.wide : E.white;
      s.loop = true;
      const off = ((lib.hash('film-nz', key) % 100003) / 100003) * s.buffer.duration;
      return V.buf(s, off);
    };

    // Sidechain-style pump: a decaying negative curve added to the pad and bass bus gains on a kick.
    const duckLen = 0.32;
    E.duckBuf = ctx.createBuffer(1, Math.floor(duckLen * E.sr), E.sr);
    {
      const d = E.duckBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        const t = i / E.sr;
        d[i] = -(t < 0.006 ? t / 0.006 : Math.exp(-(t - 0.006) / 0.085)) * (i > d.length - 48 ? (d.length - i) / 48 : 1);
      }
    }
    E.duck = (t, depth) => {
      const V = E.voice(t, duckLen, false);
      if (!V) return;
      const s = ctx.createBufferSource();
      s.buffer = E.duckBuf;
      for (const p of E.duckTargets) {
        const g = E.gain(depth);
        s.connect(g);
        g.connect(p);
      }
      V.buf(s, 0);
    };
    return E;
  }

  // ---------------------------------------------------------------- instruments
  function instruments(E) {
    const ctx = E.ctx;
    const I = {};

    // Felt, full, heartbeat or thud kick: a pitch-dropping sine with a short filtered click.
    I.kick = (t, vel, kind) => {
      const P = {
        felt: { f0: 125, f1: 50, fd: 0.055, dec: 0.36, click: 0.18, cf: 1600 },
        full: { f0: 165, f1: 47, fd: 0.065, dec: 0.5, click: 0.3, cf: 4200 },
        heart: { f0: 96, f1: 46, fd: 0.05, dec: 0.3, click: 0.16, cf: 1500 },
        thud: { f0: 95, f1: 52, fd: 0.04, dec: 0.2, click: 0.12, cf: 1200 },
      }[kind || 'felt'];
      const V = E.voice(t, P.dec + 0.03, false);
      if (!V) return;
      const o = E.osc('sine', P.f0);
      V.env(o.frequency, [[0, P.f0], [P.fd, P.f1, 'exp'], [P.dec, P.f1 * 0.92, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.002, vel], [0.06, vel * 0.75, 'exp'], [P.dec, FLOOR, 'exp']]);
      o.connect(g);
      E.out(g, 'drums');
      V.osc(o);
      const n = E.noise(V, ['kick', t]);
      const f = E.filt('lowpass', P.cf, 0.7);
      const cg = E.gain(0);
      V.env(cg.gain, perc(vel * P.click, 0.0008, 0.012));
      n.connect(f);
      f.connect(cg);
      E.out(cg, 'drums');
    };

    I.brush = (t, vel, pan) => {
      const V = E.voice(t, 0.26, false);
      if (!V) return;
      const n = E.noise(V, ['brush', t]);
      const f = E.filt('bandpass', 3000, 0.55);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.004, vel], [0.05, vel * 0.45, 'exp'], [0.24, FLOOR, 'exp']]);
      n.connect(f);
      f.connect(g);
      E.out(g, 'perc', { pan: pan || 0.12 });
      const o = E.osc('sine', 185);
      const og = E.gain(0);
      V.env(og.gain, perc(vel * 0.35, 0.002, 0.06));
      o.connect(og);
      E.out(og, 'drums');
      V.osc(o, 0.1);
    };

    I.hat = (t, vel, open) => {
      const len = open ? 0.22 : 0.055;
      const V = E.voice(t, len + 0.01, false);
      if (!V) return;
      const n = E.noise(V, ['hat', t]);
      const f = E.filt('highpass', 7200, 0.8);
      const f2 = E.filt('peaking', 10500, 1.2);
      f2.gain.value = 5;
      const g = E.gain(0);
      V.env(g.gain, perc(vel, 0.001, len));
      n.connect(f);
      f.connect(f2);
      f2.connect(g);
      E.out(g, 'perc', { pan: -0.25 });
    };

    I.shaker = (t, vel, pan) => {
      const V = E.voice(t, 0.09, false);
      if (!V) return;
      const n = E.noise(V, ['shaker', t]);
      const f = E.filt('bandpass', 6500, 1.1);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.01, vel], [0.075, FLOOR, 'exp']]);
      n.connect(f);
      f.connect(g);
      E.out(g, 'perc', { pan: pan || 0.3 });
    };

    I.crash = (t, vel, o) => {
      o = o || {};
      const dec = o.dec || 1.55;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const n = E.noise(V, ['crash', t], true);
      const f = E.filt('highpass', 4800, 0.6);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.003, vel], [0.12, vel * 0.45, 'exp'], [dec, FLOOR, 'exp']]);
      n.connect(f);
      f.connect(g);
      E.out(g, 'perc', o);
    };

    // Woodblock tock or small wooden click.
    I.tock = (t, vel, f, o) => {
      o = o || {};
      const V = E.voice(t, 0.1, false);
      if (!V) return;
      const s = E.osc('sine', f * 1.5);
      V.env(s.frequency, [[0, f * 1.5], [0.006, f, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, perc(vel, 0.001, o.dec || 0.06));
      s.connect(g);
      E.out(g, o.bus || 'perc', o);
      V.osc(s);
      const tri = E.osc('triangle', f * 2.71);
      const tg = E.gain(0);
      V.env(tg.gain, perc(vel * 0.25, 0.001, 0.025));
      tri.connect(tg);
      E.out(tg, o.bus || 'perc', o);
      V.osc(tri, 0.05);
      const n = E.noise(V, ['tock', t, f]);
      const nf = E.filt('bandpass', Math.min(9000, f * 2.4), 2.5);
      const ng = E.gain(0);
      V.env(ng.gain, perc(vel * 0.5, 0.0005, 0.01));
      n.connect(nf);
      nf.connect(ng);
      E.out(ng, o.bus || 'perc', o);
    };

    // FM marimba: soft-mallet FM attack on the fundamental, the tuned 4th partial, a mallet thump.
    I.marimba = (t, f, vel, o) => {
      o = o || {};
      const dec = o.dec || Math.min(2.2, Math.max(0.35, 1.5 * Math.sqrt(220 / f)));
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const c = E.osc('sine', f);
      const m = E.osc('sine', f);
      const mg = E.gain(0);
      V.env(mg.gain, [[0, f * 1.4], [0.04, f * 0.04, 'exp'], [dec, FLOOR, 'exp']]);
      m.connect(mg);
      mg.connect(c.frequency);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.003, vel], [dec, FLOOR, 'exp']]);
      c.connect(g);
      E.out(g, o.bus || 'keys', o);
      V.osc(c);
      V.osc(m);
      if (f * 4 < 16000) {
        const p = E.osc('sine', f * 4);
        const pg = E.gain(0);
        V.env(pg.gain, perc(vel * 0.22, 0.002, 0.12));
        p.connect(pg);
        E.out(pg, o.bus || 'keys', o);
        V.osc(p, 0.2);
      }
      const n = E.noise(V, ['mar', t, f]);
      const nf = E.filt('lowpass', 1400, 0.7);
      const ng = E.gain(0);
      V.env(ng.gain, perc(vel * 0.12, 0.001, 0.012));
      n.connect(nf);
      nf.connect(ng);
      E.out(ng, o.bus || 'keys', o);
    };

    // Kalimba: sine tine with a small pitch settle, an inharmonic overtone and a thumb click.
    I.kalimba = (t, f, vel, o) => {
      o = o || {};
      const dec = o.dec || 1.5;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const s = E.osc('sine', f);
      V.env(s.frequency, [[0, f * 1.007], [0.03, f, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.002, vel], [0.09, vel * 0.55, 'exp'], [dec, FLOOR, 'exp']]);
      s.connect(g);
      E.out(g, o.bus || 'keys', o);
      V.osc(s);
      if (f * 5.93 < 17000) {
        const p = E.osc('sine', f * 5.93);
        const pg = E.gain(0);
        V.env(pg.gain, perc(vel * 0.28, 0.001, 0.07));
        p.connect(pg);
        E.out(pg, o.bus || 'keys', o);
        V.osc(p, 0.12);
      }
      const h = E.osc('sine', f * 2);
      const hg = E.gain(0);
      V.env(hg.gain, perc(vel * 0.1, 0.002, 0.35));
      h.connect(hg);
      E.out(hg, o.bus || 'keys', o);
      V.osc(h, 0.5);
      const n = E.noise(V, ['kal', t, f]);
      const nf = E.filt('bandpass', 3300, 1.8);
      const ng = E.gain(0);
      V.env(ng.gain, perc(vel * 0.3, 0.0005, 0.008));
      n.connect(nf);
      nf.connect(ng);
      E.out(ng, o.bus || 'keys', o);
    };

    // Glockenspiel: free-bar partial ratios, higher partials die first.
    I.glock = (t, f, vel, o) => {
      o = o || {};
      const dec = o.dec || 1.8;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const parts = [
        [1, 1, 1],
        [2.756, 0.3, 0.35],
        [5.404, 0.11, 0.14],
        [8.933, 0.05, 0.06],
      ];
      for (const [ratio, a, d] of parts) {
        if (f * ratio > 18000) continue;
        const s = E.osc('sine', f * ratio);
        const g = E.gain(0);
        V.env(g.gain, perc(vel * a, 0.001, dec * d));
        s.connect(g);
        E.out(g, o.bus || 'bells', o);
        V.osc(s, dec * d + 0.02);
      }
    };

    // Glassy sine ping.
    I.glass = (t, f, vel, o) => {
      o = o || {};
      const dec = o.dec || 1.6;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const parts = [
        [1, 1, 1],
        [2, 0.12, 0.35],
        [3.01, 0.05, 0.18],
      ];
      for (const [ratio, a, d] of parts) {
        const s = E.osc('sine', f * ratio);
        const g = E.gain(0);
        V.env(g.gain, perc(vel * a, o.att || 0.003, dec * d));
        s.connect(g);
        E.out(g, o.bus || 'bells', o);
        V.osc(s, dec * d + 0.02);
      }
    };

    // FM bell: modulator at an inharmonic or harmonic ratio, index decaying with the note.
    I.fmBell = (t, f, vel, o) => {
      o = o || {};
      const dec = o.dec || 1.6;
      const ratio = o.ratio || 1.4;
      const idx = o.index || 3;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const c = E.osc('sine', f);
      const m = E.osc('sine', f * ratio);
      const mg = E.gain(0);
      V.env(mg.gain, [[0, f * idx], [dec * 0.5, f * idx * 0.08, 'exp']]);
      m.connect(mg);
      mg.connect(c.frequency);
      const g = E.gain(0);
      V.env(g.gain, perc(vel, o.att || 0.002, dec));
      c.connect(g);
      E.out(g, o.bus || 'bells', o);
      V.osc(c);
      V.osc(m);
    };

    // Soft FM gong.
    I.gong = (t, f, vel, o) => {
      o = o || {};
      const dec = o.dec || 2.2;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const c = E.osc('sine', f);
      const m = E.osc('sine', f * 1.41);
      const mg = E.gain(0);
      V.env(mg.gain, [[0, f * 0.3], [0.09, f * 2.2], [dec, f * 0.15, 'exp']]);
      m.connect(mg);
      mg.connect(c.frequency);
      const lp = E.filt('lowpass', 1900, 0.5);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.012, vel], [dec, FLOOR, 'exp']]);
      c.connect(lp);
      lp.connect(g);
      E.out(g, o.bus || 'bells', o);
      V.osc(c);
      V.osc(m);
    };

    // Metallic FM ting for the gold dots.
    I.ting = (t, f, vel, o) => I.fmBell(t, f, vel, Object.assign({ ratio: 3.51, index: 1.6, dec: 0.45 }, o || {}));

    // Warm detuned pad: two warm-saw voices per note, spread left and right, one shared lowpass.
    // o: att, rel, cut0, cut1 (cutoff at the start and at t1), q, sine (hushed sine pad), bus, sends
    I.pad = (t0, t1, notes, vel, o) => {
      o = o || {};
      const att = Math.min(o.att === undefined ? 0.25 : o.att, t1 - t0);
      const rel = o.rel === undefined ? 0.35 : o.rel;
      const hold = t1 - t0;
      const len = hold + rel;
      const V = E.voice(t0, len, true);
      if (!V) return;
      const lp = E.filt('lowpass', o.cut0 || 1200, o.q || 0.6);
      V.env(lp.frequency, [[0, o.cut0 || 1200], [hold, o.cut1 || o.cut0 || 1200, 'exp'], [len, (o.cut1 || o.cut0 || 1200) * 0.7, 'exp']]);
      const g = E.gain(0);
      const pts = [[0, 0], [att, vel, o.attShape || 'lin']];
      if (hold > att) pts.push([hold, vel * (o.sus === undefined ? 1 : o.sus), 'lin']);
      pts.push([len, 0, 'lin']);
      V.env(g.gain, pts);
      lp.connect(g);
      E.out(g, o.bus || 'pad', o);
      const per = 1 / Math.sqrt(notes.length * 2);
      notes.forEach((nm, i) => {
        const f = hz(nm);
        const sides = o.sine ? [0] : [-1, 1];
        for (const side of sides) {
          const s = E.osc(o.sine ? 'sine' : E.warmSaw, f);
          s.detune.value = side * (o.detune || 8) + (i % 2 ? 1.5 : -1.5);
          const sg = E.gain(per * (o.sine ? 1.4 : 1));
          const p = E.panner(side * (o.width === undefined ? 0.55 : o.width) * (i % 2 ? 0.8 : 1));
          s.connect(sg);
          sg.connect(p);
          p.connect(lp);
          V.osc(s);
        }
      });
    };

    // Sub bass: sine with a little 2nd and 3rd harmonic so it survives small speakers.
    I.sub = (t0, t1, note, vel, o) => {
      o = o || {};
      const att = Math.min(o.att === undefined ? 0.008 : o.att, t1 - t0);
      const rel = o.rel === undefined ? 0.06 : o.rel;
      const hold = t1 - t0;
      const len = hold + rel;
      const V = E.voice(t0, len, true);
      if (!V) return;
      const f = hz(note);
      const g = E.gain(0);
      const pts = [[0, 0], [att, vel, o.attShape || 'lin']];
      if (hold > att) pts.push([hold, vel * (o.sus === undefined ? 0.85 : o.sus), 'lin']);
      pts.push([len, 0, 'lin']);
      V.env(g.gain, pts);
      const lp = E.filt('lowpass', 420, 0.5);
      for (const [k, a] of [
        [1, 1],
        [2, 0.3],
        [3, 0.1],
      ]) {
        const s = E.osc('sine', f * k);
        const sg = E.gain(a);
        s.connect(sg);
        sg.connect(lp);
        V.osc(s);
      }
      lp.connect(g);
      E.out(g, 'bass');
    };

    // Sub drop: a sine sweeping down under a hit.
    I.subDrop = (t, f0, f1, len, vel) => {
      const V = E.voice(t, len + 0.02, false);
      if (!V) return;
      const s = E.osc('sine', f0);
      V.env(s.frequency, [[0, f0], [len, f1, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.004, vel], [len * 0.5, vel * 0.7, 'lin'], [len, FLOOR, 'exp']]);
      s.connect(g);
      E.out(g, 'bass');
      V.osc(s);
    };

    // Warm pluck: warm saw plus soft square an octave up, a fast lowpass sweep.
    I.pluck = (t, note, vel, o) => {
      o = o || {};
      const f = hz(note);
      const dec = o.dec || 0.8;
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const lp = E.filt('lowpass', 2000, o.q || 1.2);
      const top = Math.min(11000, f * (o.bright || 9));
      V.env(lp.frequency, [[0, top], [0.16, Math.max(180, f * 1.8), 'exp'], [dec, Math.max(150, f * 1.2), 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.003, vel], [0.14, vel * 0.45, 'exp'], [dec, FLOOR, 'exp']]);
      const a = E.osc(E.warmSaw, f);
      a.detune.value = -5;
      const b = E.osc(E.softSquare, f * 2);
      b.detune.value = 6;
      const bg = E.gain(0.35);
      a.connect(lp);
      b.connect(bg);
      bg.connect(lp);
      lp.connect(g);
      E.out(g, o.bus || 'keys', o);
      V.osc(a);
      V.osc(b);
    };

    // FM boop with an upward bend (the molts).
    I.boop = (t, note, vel, o) => {
      o = o || {};
      const f = hz(note);
      const V = E.voice(t, 0.32, false);
      if (!V) return;
      const c = E.osc('sine', f * 0.8);
      V.env(c.frequency, [[0, f * 0.8], [0.06, f, 'exp']]);
      const m = E.osc('sine', f * 1.6);
      V.env(m.frequency, [[0, f * 1.6], [0.06, f * 2, 'exp']]);
      const mg = E.gain(0);
      V.env(mg.gain, [[0, f * 2.2], [0.14, f * 0.2, 'exp']]);
      m.connect(mg);
      mg.connect(c.frequency);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.004, vel], [0.08, vel * 0.6, 'exp'], [0.3, FLOOR, 'exp']]);
      c.connect(g);
      E.out(g, 'keys', Object.assign({ room: 0.2 }, o));
      V.osc(c);
      V.osc(m);
    };

    // Detuned, band-passed saw stab.
    I.stab = (t, notes, vel, o) => {
      o = o || {};
      const len = o.len || 0.22;
      const V = E.voice(t, len + 0.02, false);
      if (!V) return;
      const bp = E.filt('bandpass', o.f || 1500, 1.4);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.003, vel], [len, FLOOR, 'exp']]);
      bp.connect(g);
      E.out(g, 'keys', o);
      for (const nm of notes) {
        for (const d of [-14, 14]) {
          const s = E.osc('sawtooth', hz(nm));
          s.detune.value = d;
          const sg = E.gain(0.5 / notes.length);
          s.connect(sg);
          sg.connect(bp);
          V.osc(s);
        }
      }
    };

    // Continuous FM lead with glides and delayed vibrato. phrase: [[t, note, glide]]
    I.lead = (phrase, tEnd, vel, o) => {
      o = o || {};
      const t0 = phrase[0][0];
      const rel = o.rel || 0.3;
      const len = tEnd - t0 + rel;
      const V = E.voice(t0, len, true);
      if (!V) return;
      const pitch = ctx.createConstantSource();
      const pp = [[0, hz(phrase[0][1])]];
      const vib = [[0, 0]];
      for (let i = 1; i < phrase.length; i++) {
        const dt = phrase[i][0] - t0;
        const gl = Math.max(0.005, phrase[i][2] || 0);
        pp.push([dt, hz(phrase[i - 1][1]), 'set']);
        pp.push([dt + gl, hz(phrase[i][1]), 'exp']);
      }
      for (let i = 0; i < phrase.length; i++) {
        const a = phrase[i][0] - t0;
        const b = (i + 1 < phrase.length ? phrase[i + 1][0] : tEnd + rel) - t0;
        const f = hz(phrase[i][1]);
        vib.push([a, 0, 'set']);
        if (b - a > 0.35) {
          vib.push([a + 0.18, 0, 'set']);
          vib.push([Math.min(b, a + 0.45), f * 0.008, 'lin']);
          vib.push([b, f * 0.008, 'lin']);
        }
      }
      V.env(pitch.offset, pp);
      const c = E.osc('sine', 0);
      const m = E.osc('sine', 0);
      const sub = E.osc('triangle', 0);
      pitch.connect(c.frequency);
      const mr = E.gain(1);
      pitch.connect(mr);
      mr.connect(m.frequency);
      const sr = E.gain(0.5);
      pitch.connect(sr);
      sr.connect(sub.frequency);
      const mg = E.gain(hz(phrase[0][1]) * 0.9);
      m.connect(mg);
      mg.connect(c.frequency);
      const lfo = E.osc('sine', 5.3);
      const vg = E.gain(0);
      V.env(vg.gain, vib);
      lfo.connect(vg);
      vg.connect(c.frequency);
      const lp = E.filt('lowpass', 3200, 0.8);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.012, vel], [tEnd - t0, vel * 0.9, 'lin'], [len, 0, 'lin']]);
      const sg = E.gain(0.35);
      c.connect(lp);
      sub.connect(sg);
      sg.connect(lp);
      lp.connect(g);
      E.out(g, 'lead', o);
      V.osc(pitch);
      V.osc(c);
      V.osc(m);
      V.osc(sub);
      V.osc(lfo);
    };

    // Synth horn: two brass saws with a filter swell per note and a scoop into pitch.
    I.horn = (phrase, tEnd, vel, o) => {
      o = o || {};
      const t0 = phrase[0][0];
      const rel = 0.25;
      const len = tEnd - t0 + rel;
      const V = E.voice(t0, len, true);
      if (!V) return;
      const pitch = ctx.createConstantSource();
      const pp = [];
      const cut = [];
      phrase.forEach(([t, nm], i) => {
        const dt = t - t0;
        const f = hz(nm);
        if (i === 0) pp.push([0, f * 0.97]);
        else pp.push([dt, f * 0.97, 'set']);
        pp.push([dt + 0.07, f, 'exp']);
        cut.push([dt, 300, i === 0 ? 'lin' : 'set']);
        cut.push([dt + 0.16, 2400, 'exp']);
        cut.push([dt + 0.45, 1500, 'exp']);
      });
      cut[0] = [0, 300];
      V.env(pitch.offset, pp);
      const lp = E.filt('lowpass', 300, 1.1);
      V.env(lp.frequency, cut);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.06, vel], [tEnd - t0, vel, 'lin'], [len, 0, 'lin']]);
      for (const d of [-7, 7]) {
        const s = E.osc(E.brassSaw, 0);
        s.detune.value = d;
        pitch.connect(s.frequency);
        const sg = E.gain(0.5);
        s.connect(sg);
        sg.connect(lp);
        V.osc(s);
      }
      lp.connect(g);
      E.out(g, 'lead', o);
      V.osc(pitch);
    };

    // Generic filtered noise: whooshes, sweeps, cracks, risers.
    // o: { type, f: env pts, q, amp: env pts, pan, panEnv, bus, sustain, stereo, sends }
    I.nz = (t, len, o) => {
      const V = E.voice(t, len, !!o.sustain);
      if (!V) return;
      const n = E.noise(V, ['nz', t, len, o.key || ''], !!o.stereo);
      const f = E.filt(o.type || 'bandpass', o.f[0][1], o.q || 0.8);
      V.env(f.frequency, o.f);
      const g = E.gain(0);
      V.env(g.gain, o.amp);
      n.connect(f);
      let last = f;
      if (o.type2) {
        const f2 = E.filt(o.type2, o.f2, o.q2 || 0.7);
        f.connect(f2);
        last = f2;
      }
      last.connect(g);
      let node = g;
      if (o.panEnv) {
        const p = E.panner(0);
        V.env(p.pan, o.panEnv);
        g.connect(p);
        node = p;
      }
      E.out(node, o.bus || 'sfx', o);
    };

    // A generated buffer played through an optional filter. make() builds the buffer only when the
    // voice is actually scheduled; secs must match its length.
    I.play = (t, secs, make, vel, o) => {
      o = o || {};
      const V = E.voice(t, secs + 0.01, o.sustain !== false);
      if (!V) return;
      const s = ctx.createBufferSource();
      s.buffer = make();
      let last = s;
      if (o.filt) {
        const f = E.filt(o.filt[0], o.filt[1], o.filt[2]);
        s.connect(f);
        last = f;
      }
      const g = E.gain(vel);
      last.connect(g);
      E.out(g, o.bus || 'sfx', o);
      V.buf(s, 0);
    };

    // Wing flutter: band-passed noise sweeping f0 to f1 with a flap on each listed offset.
    I.flutter = (t, len, flaps, o) => {
      const amp = [[0, 0]];
      const fl = o.floor || 0.08;
      flaps.forEach((dt, i) => {
        const pk = o.vel * (o.grow ? 0.6 + (0.4 * i) / Math.max(1, flaps.length - 1) : 1);
        amp.push([dt, amp.length > 1 ? o.vel * fl : 0, 'lin']);
        amp.push([dt + 0.008, pk, 'lin']);
        amp.push([dt + 0.06, o.vel * fl, 'exp']);
      });
      amp.push([len, FLOOR, 'exp']);
      I.nz(t, len, {
        type: 'bandpass',
        q: 1.1,
        f: [[0, o.f0], [len, o.f1, 'exp']],
        amp,
        panEnv: o.pan ? [[0, -o.pan], [len, o.pan, 'lin']] : null,
        bus: 'sfx',
        room: 0.25,
        key: 'flutter',
      });
    };

    I.chew = (t, vel, pan) =>
      I.nz(t, 0.02, { type: 'highpass', q: 0.7, f: [[0, 4200]], amp: perc(vel, 0.0008, 0.012), pan, key: 'chew' });

    I.plip = (t, f0, f1, vel, o) => {
      o = o || {};
      const V = E.voice(t, 0.14, false);
      if (!V) return;
      for (const [k, a] of [
        [1, 1],
        [2, 0.25],
      ]) {
        const s = E.osc('sine', f0 * k);
        V.env(s.frequency, [[0, f0 * k], [0.05, f1 * k, 'exp']]);
        const g = E.gain(0);
        V.env(g.gain, [[0, 0], [0.002, vel * a], [0.02, vel * a * 0.6, 'exp'], [0.12, FLOOR, 'exp']]);
        s.connect(g);
        E.out(g, 'sfx', Object.assign({ room: 0.2 }, o));
        V.osc(s);
      }
    };

    I.glide = (t, f0, f1, len, vel, o) => {
      o = o || {};
      const V = E.voice(t, len + 0.3, false);
      if (!V) return;
      const s = E.osc('sine', f0);
      V.env(s.frequency, [[0, f0], [len, f1, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.003, vel], [len, vel * 0.5, 'exp'], [len + 0.28, FLOOR, 'exp']]);
      s.connect(g);
      E.out(g, o.bus || 'sfx', o);
      V.osc(s);
    };

    // Low whump for the wing pumps: a rising sine body plus a soft rising noise sweep.
    I.whump = (t, vel) => {
      const V = E.voice(t, 0.42, false);
      if (!V) return;
      const s = E.osc('sine', 55);
      V.env(s.frequency, [[0, 55], [0.14, 88, 'exp'], [0.4, 80, 'lin']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.006, vel], [0.12, vel * 0.7, 'exp'], [0.4, FLOOR, 'exp']]);
      s.connect(g);
      E.out(g, 'bass');
      V.osc(s);
      const h = E.osc('triangle', 110);
      V.env(h.frequency, [[0, 110], [0.14, 176, 'exp']]);
      const hg = E.gain(0);
      V.env(hg.gain, perc(vel * 0.25, 0.005, 0.18));
      h.connect(hg);
      E.out(hg, 'sfx');
      V.osc(h, 0.25);
      I.nz(t, 0.3, {
        type: 'bandpass',
        q: 1.5,
        f: [[0, 220], [0.26, 1500, 'exp']],
        amp: [[0, 0], [0.02, vel * 0.08], [0.2, vel * 0.18, 'lin'], [0.3, FLOOR, 'exp']],
        key: 'whump',
      });
    };

    I.whistle = (t, len, f0, f1, vel) => {
      const V = E.voice(t, len + 0.05, false);
      if (!V) return;
      const s = E.osc('sine', f0);
      V.env(s.frequency, [[0, f0], [len, f1, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.015, vel], [len, FLOOR, 'exp']]);
      s.connect(g);
      E.out(g, 'sfx', { hall: 0.15 });
      V.osc(s);
    };

    I.bleep = (t, f, vel) => {
      const V = E.voice(t, 0.07, false);
      if (!V) return;
      const s = E.osc('sine', f);
      const lp = E.filt('lowpass', 6500, 0.7);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.002, vel], [0.062, FLOOR, 'exp']]);
      s.connect(lp);
      lp.connect(g);
      E.out(g, 'sfx', { room: 0.15 });
      V.osc(s);
    };

    // Striated buzz: a rising saw, chopped at 30 Hz, through a feedback comb.
    I.buzz = (t, len, vel) => {
      const V = E.voice(t, len + 0.05, false);
      if (!V) return;
      const s = E.osc('sawtooth', 98);
      V.env(s.frequency, [[0, 98], [len, 196, 'exp']]);
      const chop = E.gain(0.5);
      const lfo = E.osc('square', 30);
      const lg = E.gain(0.45);
      lfo.connect(lg);
      lg.connect(chop.gain);
      const d = ctx.createDelay(0.05);
      d.delayTime.value = 0.0034;
      const fb = E.gain(0.55);
      const bp = E.filt('bandpass', 1300, 0.8);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.04, vel * 0.5], [len * 0.85, vel, 'lin'], [len, FLOOR, 'exp']]);
      s.connect(chop);
      chop.connect(bp);
      chop.connect(d);
      d.connect(fb);
      fb.connect(d);
      d.connect(bp);
      bp.connect(g);
      E.out(g, 'sfx', { hall: 0.25 });
      V.osc(s);
      V.osc(lfo);
    };

    // Reverse swell: noise rising exponentially into a hard stop at t + len.
    I.revSwell = (t, len, vel, o) => {
      o = o || {};
      const hi = o.hi || false;
      I.nz(t, len, {
        type: hi ? 'highpass' : 'lowpass',
        q: 0.7,
        f: hi ? [[0, 9000], [len, 3500, 'exp']] : [[0, 400], [len, o.fTop || 3500, 'exp']],
        type2: hi ? 'peaking' : null,
        f2: 9500,
        amp: [[0, vel * 0.004], [len - 0.012, vel, 'exp'], [len, FLOOR, 'lin']],
        stereo: true,
        sustain: true,
        bus: o.bus || 'sfx',
        hall: o.hall || 0.2,
        key: 'rev',
      });
    };

    // Stereo wind bed: wide noise through a slowly wandering band-pass. amp: env pts.
    I.wind = (t0, t1, amp, o) => {
      o = o || {};
      const len = t1 - t0;
      const f = [[0, 700]];
      for (let k = 1; k * 0.25 < len; k++) f.push([k * 0.25, 650 + 380 * lib.noise1(k * 0.23 + t0, 'film-wind'), 'lin']);
      I.nz(t0, len, { type: 'bandpass', q: 0.45, f, type2: 'lowpass', f2: o.lp || 2600, amp, stereo: true, sustain: true, bus: 'amb', key: 'wind' });
    };

    return I;
  }

  // ---------------------------------------------------------------- grain textures
  function flapGrains(r, t0, len, rate, o) {
    const out = [];
    const n = Math.floor(len * rate);
    for (let i = 0; i < n; i++) {
      const t = t0 + r() * len;
      out.push({
        t,
        dur: 0.05 + r() * 0.05,
        amp: (o.amp || 0.3) * (0.4 + 0.6 * r()),
        pan: (r() * 2 - 1) * (o.width || 0.9),
        f: (o.f0 || 380) + r() * (o.f1 || 1200),
        q: 0.9,
        att: 0.008 + r() * 0.008,
        dec: 0.02 + r() * 0.02,
      });
    }
    return out;
  }
  function clickGrains(r, t0, len, count, o) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const u = o.shape ? Math.pow(r(), o.shape) : r();
      out.push({
        t: t0 + u * len,
        dur: 0.008,
        amp: (o.amp || 0.3) * (0.3 + 0.7 * r()),
        pan: (r() * 2 - 1) * (o.width || 0.9),
        f: (o.f0 || 3000) + r() * (o.f1 || 5000),
        q: o.q || 1.2,
        att: 0.0004,
        dec: o.dec || 0.0015,
      });
    }
    return out;
  }

  // ---------------------------------------------------------------- the score
  // "One burger, two prices", scored for a puppet-jazz band in the manner of 1960s-70s Soviet cartoon
  // music: pizzicato strings (an oom-pah bass and off-beat chords), a xylophone, a clarinet-like reed
  // (high and low), a small cymbal and a woodblock. F major on the street, D minor at the machine and
  // with the owner. Every tune is original: the burger motif (F A C A, then C E F), the ride tune
  // (A C F D E C Bb G), the machine ostinato (D A F A on 16ths). Times are global seconds on the
  // 120 bpm grid (a beat 0.5 s, a 16th 0.125 s); every FILM.TIMELINE cue is implemented by hand at
  // its own time and tagged "cue" below.

  // Pizzicato chord voicings, sounding pitches.
  const CH = {
    F: ['A3', 'C4', 'F4'],
    Fwide: ['F3', 'A3', 'C4', 'F4'],
    Fmaj7: ['A3', 'C4', 'E4'],
    F6: ['A3', 'D4', 'F4'],
    F69: ['A3', 'D4', 'G4', 'C5'],
    Bb6: ['Bb3', 'D4', 'G4'],
    C7: ['Bb3', 'E4', 'G4'],
    dim: ['B3', 'D4', 'F4', 'Ab4'],
    A7: ['G3', 'C#4', 'E4'],
    Dm: ['A3', 'D4', 'F4'],
    Dsus: ['A3', 'D4', 'G4'],
    Gm: ['G3', 'Bb3', 'D4'],
  };

  // Karplus-Strong plucked string rendered into a buffer: one period of low-passed seeded noise
  // circulating through a fractional delay line with a two-point average and a loss tuned to t60.
  // The pitch glides f0 to f1 over `glide` seconds (a zing, a boop). Normalised to a peak of 1.
  function pluckBuffer(ctx, key, f0, f1, glide, t60, secs, bright) {
    const sr = ctx.sampleRate;
    const n = Math.ceil(secs * sr);
    const buf = ctx.createBuffer(1, n, sr);
    const y = buf.getChannelData(0);
    const r = lib.rng(lib.hash('film-pluck', key));
    const exc = Math.ceil(sr / f0);
    const gN = Math.max(1, glide * sr);
    let f = f0;
    let rho = Math.pow(10, -3 / (t60 * f0));
    let lp = 0;
    let peak = 1e-9;
    for (let i = 0; i < n; i++) {
      if (glide > 0 && i <= gN) {
        f = f0 * Math.pow(f1 / f0, i / gN);
        rho = Math.pow(10, -3 / (t60 * f));
      }
      let v = 0;
      if (i < exc) {
        lp += bright * (r() * 2 - 1 - lp);
        v = lp;
      }
      const d = i - (sr / f - 0.5);
      if (d >= 1) {
        const j = Math.floor(d);
        const a = d - j;
        v += rho * 0.5 * (y[j] + (y[j + 1] - y[j]) * a + y[j - 1] + (y[j] - y[j - 1]) * a);
      }
      y[i] = v;
      if (Math.abs(v) > peak) peak = Math.abs(v);
    }
    const fade = Math.floor(0.03 * sr);
    for (let i = 0; i < n; i++) y[i] = (y[i] / peak) * (i > n - fade ? (n - i) / fade : 1);
    return buf;
  }

  // The band and its sound effects, built once per render on the engine's primitives and instruments.
  function band(E, I) {
    const ctx = E.ctx;
    const B = {};
    const plucks = {};
    // Inside the booth (shots 02, 08, 13 and 14) the band is heard through the wall, low-passed at 1.5 kHz.
    const muff = (t) => ((t >= 2 && t < 3.5) || (t >= 13 && t < 16) || (t >= 22.5 && t < 26) ? 1500 : 0);
    B.out = (node, t, bus, o) => {
      const c = o.open ? 0 : muff(t);
      if (c) {
        const f = E.filt('lowpass', c, 0.7);
        node.connect(f);
        node = f;
      }
      return E.out(node, bus, o);
    };

    // Pizzicato: a plucked string, cached per pitch, glide, length and one of three seeded variants.
    // o: glide [note, secs], bright (excitation), dec (t60), lpx (low-pass as a multiple of the pitch),
    // bus, pan, sends, open (not muffled in the booth).
    B.pizz = (t, note, vel, o) => {
      o = o || {};
      const f0 = hz(note);
      const f1 = o.glide ? hz(o.glide[0]) : f0;
      const gl = o.glide ? o.glide[1] : 0;
      const t60 = o.dec || Math.min(1.1, Math.max(0.2, 0.9 * Math.pow(110 / f0, 0.6)));
      const V = E.voice(t, t60 + 0.05, false);
      if (!V) return;
      const bright = o.bright || 0.45;
      const key = [note, f1, gl, t60, bright, lib.hash('film-pizz', t) % 3].join('|');
      const s = ctx.createBufferSource();
      s.buffer = plucks[key] || (plucks[key] = pluckBuffer(ctx, key, f0, f1, gl, t60, t60 + 0.05, bright));
      const lp = E.filt('lowpass', Math.min(10000, Math.max(f0, f1) * (o.lpx || 10)), 0.6);
      const g = E.gain(vel);
      s.connect(lp);
      lp.connect(g);
      B.out(g, t, o.bus || 'keys', o);
      V.buf(s, 0);
    };
    B.bass = (t, note, vel, o) => B.pizz(t, note, vel, Object.assign({ bus: 'bass', room: 0.12, lpx: 16 }, o));
    const spread = [-0.3, 0.1, 0.35, -0.12];
    // The pad bus sits low in the mix, so the off-beat chords play half again as loud as written.
    B.pah = (t, notes, vel, o) => notes.forEach((n, i) => B.pizz(t, n, vel * 1.5, Object.assign({ bus: 'pad', pan: spread[i % 4], dec: 0.35 }, o)));

    // Xylophone: a hard-mallet bar ringing its tuned twelfth (3f) and a short third mode, with a click.
    B.xylo = (t, note, vel, o) => {
      o = o || {};
      const f = hz(note);
      vel *= 0.7; // the xylophone's level against the band
      const dec = o.dec || Math.min(0.9, Math.max(0.22, 0.6 * Math.sqrt(700 / f)));
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const g = E.gain(1);
      for (const [k, a, d] of [
        [1, 1, 1],
        [3, 0.3, 0.35],
        [6.27, 0.09, 0.12],
      ]) {
        if (f * k > 15000) continue;
        const s = E.osc('sine', f * k);
        const sg = E.gain(0);
        V.env(sg.gain, perc(vel * a, 0.001, dec * d));
        s.connect(sg);
        sg.connect(g);
        V.osc(s, dec * d + 0.02);
      }
      const n = E.noise(V, ['xylo', t, f]);
      const nf = E.filt('bandpass', Math.min(8000, f * 3.5), 1.3);
      const ng = E.gain(0);
      V.env(ng.gain, perc(vel * 0.5, 0.0004, 0.006));
      n.connect(nf);
      nf.connect(ng);
      ng.connect(g);
      B.out(g, t, o.bus || 'keys', o);
    };

    // Clarinet-like reed: an odd-harmonic wave on a gliding pitch, tongued re-attacks between detached
    // notes, a delayed vibrato and a breath of noise. phrase: [[t, note, glide]]; a note with a glide is
    // slurred into. o: att, rel, sus (level at tEnd relative to vel; above 1 it swells), cut, vib (depth),
    // rate, wave, breath, bus, pan, sends, open.
    B.clar = (phrase, tEnd, vel, o) => {
      o = o || {};
      vel *= 0.4; // the reed's level against the band
      const t0 = phrase[0][0];
      const rel = o.rel || 0.07;
      const len = tEnd - t0 + rel;
      const V = E.voice(t0, len, true);
      if (!V) return;
      const f0 = hz(phrase[0][1]);
      const depth = o.vib === undefined ? 0.005 : o.vib;
      const pp = [[0, f0]];
      const amp = [
        [0, 0],
        [o.att || 0.025, vel],
      ];
      const vib = [[0, 0]];
      phrase.forEach(([t, nm, gl], i) => {
        const a = t - t0;
        const b = (i + 1 < phrase.length ? phrase[i + 1][0] : tEnd) - t0;
        const f = hz(nm);
        if (i > 0) {
          pp.push([a, hz(phrase[i - 1][1]), 'set'], [a + Math.max(0.004, gl || 0), f, 'exp']);
          if (!gl) amp.push([a - 0.02, vel, 'lin'], [a, vel * 0.4, 'lin'], [a + 0.02, vel, 'lin']);
        }
        if (depth && b - a > 0.3) vib.push([a, 0, 'set'], [a + 0.15, 0, 'set'], [Math.min(b, a + 0.45), f * depth, 'lin'], [b, f * depth, 'lin']);
      });
      amp.push([tEnd - t0, vel * (o.sus === undefined ? 0.9 : o.sus), 'lin'], [len, 0, 'lin']);
      const pitch = ctx.createConstantSource();
      V.env(pitch.offset, pp);
      const osc = E.osc(o.wave || E.softSquare, 0);
      pitch.connect(osc.frequency);
      const lfo = E.osc('sine', o.rate || 5);
      const vg = E.gain(0);
      V.env(vg.gain, vib);
      lfo.connect(vg);
      vg.connect(osc.frequency);
      const lp = E.filt('lowpass', o.cut || Math.min(3600, Math.max(900, f0 * 4)), 0.8);
      const g = E.gain(0);
      V.env(g.gain, amp);
      osc.connect(lp);
      lp.connect(g);
      if (o.breath !== 0) {
        const n = E.noise(V, ['reed', t0]);
        const nf = E.filt('bandpass', Math.min(5000, f0 * 5), 1.5);
        const ng = E.gain(o.breath || 0.06);
        n.connect(nf);
        nf.connect(ng);
        ng.connect(g);
      }
      B.out(g, t0, o.bus || 'amb', o);
      V.osc(pitch);
      V.osc(osc);
      V.osc(lfo);
    };

    // Small cymbal: bright noise and a metallic ring. An attack of 6 ms or more brushes it; a short
    // dec chokes it.
    B.cym = (t, vel, dec, o) => {
      o = o || {};
      const V = E.voice(t, dec + 0.05, false);
      if (!V) return;
      const att = o.att || 0.002;
      const g = E.gain(1);
      const n = E.noise(V, ['cym', t], true);
      const hp = E.filt('highpass', o.hp || 4500, 0.7);
      const ng = E.gain(0);
      V.env(ng.gain, [[0, 0], [att, vel], [att + Math.min(0.1, dec * 0.25), vel * 0.45, 'exp'], [dec, FLOOR, 'exp']]);
      n.connect(hp);
      hp.connect(ng);
      ng.connect(g);
      if (!o.brush) {
        for (const [f, a] of [
          [3170, 0.07],
          [4410, 0.05],
          [5870, 0.045],
          [7230, 0.035],
        ]) {
          const s = E.osc('sine', f);
          const sg = E.gain(0);
          V.env(sg.gain, perc(vel * a, 0.001, dec * 0.7));
          s.connect(sg);
          sg.connect(g);
          V.osc(s);
        }
      }
      B.out(g, t, 'perc', o);
    };

    // Struck metal from fixed partials [f, amp, decay]: the bicycle bell, the register, the phone.
    B.metal = (t, vel, parts, o) => {
      o = o || {};
      const len = Math.max(...parts.map((p) => p[2]));
      const V = E.voice(t, len + 0.02, false);
      if (!V) return;
      const g = E.gain(0.6); // bright metal sits high after the master's presence lift
      for (const [f, a, d] of parts) {
        const s = E.osc('sine', f);
        const sg = E.gain(0);
        V.env(sg.gain, perc(vel * a, o.att || 0.0006, d));
        s.connect(sg);
        sg.connect(g);
        V.osc(s, d + 0.01);
      }
      E.out(g, o.bus || 'sfx', o);
    };
    // Bicycle bell: partials 2.6, 5.9 and 7.3 kHz, each doubled a few Hz apart so it shimmers; 0.35 s.
    const BIKE = [
      [2600, 1, 0.35],
      [2622, 0.7, 0.33],
      [5900, 0.45, 0.24],
      [5941, 0.3, 0.22],
      [7300, 0.3, 0.16],
    ];
    B.bike = (t, vel) => B.metal(t, vel, BIKE, { room: 0.15, pan: -0.15 });

    // A tone gliding f0 to f1 with a percussive envelope. o: wave, glide (secs), wob [Hz, depth as a
    // fraction of f0], att, lp, bus, pan, sends.
    B.tone = (t, len, f0, f1, vel, o) => {
      o = o || {};
      const V = E.voice(t, len + 0.02, false);
      if (!V) return;
      const s = E.osc(o.wave || 'sine', f0);
      if (f1 !== f0) V.env(s.frequency, [[0, f0], [o.glide || len, f1, 'exp']]);
      if (o.wob) {
        const lfo = E.osc('sine', o.wob[0]);
        const lg = E.gain(f0 * o.wob[1]);
        lfo.connect(lg);
        lg.connect(s.frequency);
        V.osc(lfo);
      }
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [o.att || 0.002, vel], [len, FLOOR, 'exp']]);
      let last = s;
      if (o.lp) {
        const f = E.filt('lowpass', o.lp, 0.7);
        s.connect(f);
        last = f;
      }
      last.connect(g);
      E.out(g, o.bus || 'sfx', o);
      V.osc(s);
    };

    // Coins: short FM clinks.
    B.clink = (t, f, vel, pan) => I.fmBell(t, f, vel * 0.7, { ratio: 1.47, index: 1.6, dec: 0.08, att: 0.0006, bus: 'sfx', pan, room: 0.15 });

    // Skid: band-passed noise sweeping 2.5 kHz down to 700 Hz over 0.25 s with a gritty 30 Hz flutter.
    // Heard from inside the booth it sweeps an octave lower under a 1.2 kHz low-pass.
    B.skid = (t, vel, muffled) => {
      const len = 0.27;
      const amp = [[0, 0]];
      for (let k = 0; k / 30 < len - 0.03; k++) {
        const pk = vel * (1 - (0.5 * k) / 30 / len);
        amp.push([k / 30 + 0.003, pk], [k / 30 + 1 / 60, pk * 0.4]);
      }
      amp.push([len, FLOOR, 'exp']);
      const f = muffled ? [[0, 1150], [0.25, 450, 'exp']] : [[0, 2500], [0.25, 700, 'exp']];
      I.nz(t, len, { type: 'bandpass', q: 2.2, f, amp, type2: muffled ? 'lowpass' : null, f2: 1200, key: 'skid', room: 0.12 });
    };

    // Friction zip: band noise rising 1.2 to 3 kHz over 120 ms, grained by a fast flutter.
    B.zip = (t, vel) => {
      const amp = [[0, 0]];
      for (let k = 0; k * 0.012 < 0.11; k++) amp.push([k * 0.012 + 0.002, vel * (k % 2 ? 0.7 : 1)], [k * 0.012 + 0.008, vel * 0.3]);
      amp.push([0.13, FLOOR, 'exp']);
      I.nz(t, 0.13, { type: 'bandpass', q: 2, f: [[0, 1200], [0.12, 3000, 'exp']], amp, key: 'zip', pan: -0.2 });
    };

    // High-passed whoosh with a hard front.
    B.whoosh = (t, len, vel, o) =>
      I.nz(t, len, Object.assign({ type: 'highpass', q: 0.7, f: [[0, 1800], [len, 4500, 'exp']], amp: [[0, 0], [0.004, vel], [len * 0.4, vel * 0.5, 'exp'], [len, FLOOR, 'exp']], stereo: true, key: 'whoosh' }, o));

    // The snatch: an 80 ms whoosh and a bright pizzicato C5.
    B.snatch = (t) => {
      B.whoosh(t, 0.08, 0.25);
      B.pizz(t, 'C5', 0.4, { bright: 0.7, open: true, lpx: 14, pan: 0.15 });
    };

    // Cash register: bell partials 2.1 and 5.3 kHz ringing 0.6 s, a 60 ms drawer clatter, a low chunk.
    B.kaching = (t, vel) => {
      B.metal(
        t,
        vel,
        [
          [2100, 1, 0.6],
          [2113, 0.6, 0.55],
          [5300, 0.5, 0.35],
          [5327, 0.3, 0.3],
        ],
        { room: 0.2, pan: 0.2 }
      );
      const amp = [[0, 0]];
      [0, 0.011, 0.019, 0.032, 0.041, 0.052].forEach((a, i) => amp.push([a + 0.0008, vel * (i ? 0.45 : 0.7)], [a + 0.006, vel * 0.08]));
      amp.push([0.06, FLOOR, 'exp']);
      I.nz(t, 0.06, { type: 'bandpass', q: 1.2, f: [[0, 3200]], amp, key: 'clatter', pan: 0.2 });
      B.tone(t, 0.05, 110, 100, vel * 0.9, {});
    };

    // Chomp: a 50 ms crunch (noise between 1.5 and 4 kHz in crackles) over a sine thock 140 to 80 Hz.
    B.chomp = (t, vel) => {
      const r = lib.rng(lib.hash('film-crunch', t));
      const amp = [
        [0, 0],
        [0.0008, vel],
      ];
      for (let k = 1; k < 7; k++) amp.push([k * 0.007, vel * (0.2 + 0.3 * r())], [k * 0.007 + 0.0035, vel * (0.5 + 0.4 * r())]);
      amp.push([0.05, FLOOR, 'exp']);
      I.nz(t, 0.05, { type: 'bandpass', q: 0.7, f: [[0, 2450]], amp, key: 'crunch', room: 0.1 });
      B.tone(t, 0.09, 140, 80, vel * 0.9, { glide: 0.05 });
    };

    // Chewing: a soft squelch, noise low-passed near 400 Hz with a wet resonance.
    B.squelch = (t, vel) => I.nz(t, 0.06, { type: 'lowpass', q: 4, f: [[0, 300], [0.06, 460, 'exp']], amp: [[0, 0], [0.006, vel], [0.06, FLOOR, 'exp']], key: 'squelch', pan: 0.1 });

    // Pencil scribble: band noise in strokes with a jittered amplitude; the first stroke is the hardest.
    B.scribble = (t, len, f0, f1, vel) => {
      const r = lib.rng(lib.hash('film-pencil', t));
      const amp = [
        [0, 0],
        [0.002, vel],
      ];
      let a = 0.012;
      while (a < len - 0.025) {
        amp.push([a, vel * (0.12 + 0.2 * r())], [a + 0.006 + 0.006 * r(), vel * (0.4 + 0.4 * r())]);
        a += 0.016 + 0.012 * r();
      }
      amp.push([len, FLOOR, 'exp']);
      I.nz(t, len, { type: 'highpass', q: 0.7, f: [[0, f0]], type2: 'lowpass', f2: f1, amp, key: 'pencil', pan: 0.15 });
    };

    // Gulp: a sine falling 300 to 120 Hz over 120 ms with a 25 Hz wobble, and a wet click above it.
    B.gulp = (t, vel) => {
      B.tone(t, 0.15, 300, 120, vel, { glide: 0.12, wob: [25, 0.12], att: 0.003 });
      I.nz(t, 0.03, { type: 'bandpass', q: 3, f: [[0, 1000], [0.03, 650, 'exp']], amp: perc(vel * 0.3, 0.001, 0.02), key: 'gulp' });
    };

    // Fountain jet: band noise near 4 kHz, 0.2 s.
    B.fountain = (t, vel) =>
      I.nz(t, 0.24, { type: 'bandpass', q: 0.9, f: [[0, 4000], [0.2, 3300, 'exp']], amp: [[0, 0], [0.004, vel], [0.06, vel * 0.6, 'exp'], [0.22, FLOOR, 'exp']], stereo: true, key: 'fountain', hall: 0.1 });

    // Sniff: two short rising noise puffs.
    B.sniff = (t, vel) =>
      [0, 0.09].forEach((d, i) =>
        I.nz(t + d, 0.06, { type: 'bandpass', q: 1.4, f: [[0, 1600 + i * 600], [0.06, 2600 + i * 600, 'exp']], amp: [[0, 0], [0.004, vel], [0.06, FLOOR, 'exp']], key: 'sniff', pan: 0.1 })
      );

    // Snare-like stroke for the roll.
    B.snare = (t, vel) => I.nz(t, 0.07, { type: 'bandpass', q: 0.7, f: [[0, 3200]], amp: perc(vel, 0.0008, 0.04), key: 'snare', room: 0.12 });

    // Slide whistle: a near-sine gliding f0 to f1, with a breathy chiff at the start.
    B.swhistle = (t, len, f0, f1, vel) => {
      const V = E.voice(t, len + 0.04, false);
      if (!V) return;
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.008, vel], [len - 0.02, vel * 0.9], [len + 0.03, 0]]);
      for (const [k, a] of [
        [1, 1],
        [2, 0.12],
      ]) {
        const s = E.osc('sine', f0 * k);
        V.env(s.frequency, [[0, f0 * k], [len, f1 * k, 'exp']]);
        const sg = E.gain(a);
        s.connect(sg);
        sg.connect(g);
        V.osc(s);
      }
      E.out(g, 'sfx', { hall: 0.12 });
      I.nz(t, 0.03, { type: 'bandpass', q: 1.5, f: [[0, Math.min(6000, f0 * 4)]], amp: perc(vel * 0.6, 0.001, 0.012), key: 'chiff' });
    };

    // Boing: a twanged spring at 220 Hz with a 12 Hz vibrato of 40 percent, decaying over 0.5 s.
    B.boing = (t, vel) => {
      const V = E.voice(t, 0.55, false);
      if (!V) return;
      const lfo = E.osc('sine', 12);
      const dep = E.gain(0);
      V.env(dep.gain, [[0, 88], [0.5, 30, 'exp']]);
      lfo.connect(dep);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.003, vel], [0.5, FLOOR, 'exp']]);
      const lp = E.filt('lowpass', 3500, 0.7);
      for (const [type, a] of [
        ['sine', 0.6],
        ['sawtooth', 0.6],
      ]) {
        const s = E.osc(type, 220);
        dep.connect(s.frequency);
        const sg = E.gain(a);
        s.connect(sg);
        sg.connect(lp);
        V.osc(s);
      }
      lp.connect(g);
      E.out(g, 'sfx', { room: 0.2 });
      V.osc(lfo);
    };

    // Machine hum: a 55 Hz saw low-passed at 300 Hz with a 2 Hz wobble in pitch and level.
    B.hum = (t0, t1, vel) => {
      const len = t1 - t0;
      const V = E.voice(t0, len, true);
      if (!V) return;
      const s = E.osc('sawtooth', 55);
      const lfo = E.osc('sine', 2);
      const dg = E.gain(1.2);
      lfo.connect(dg);
      dg.connect(s.frequency);
      const lp = E.filt('lowpass', 300, 0.9);
      const am = E.gain(1);
      const ag = E.gain(0.25);
      lfo.connect(ag);
      ag.connect(am.gain);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.15, vel], [len - 0.15, vel], [len, 0]]);
      s.connect(lp);
      lp.connect(am);
      am.connect(g);
      E.out(g, 'amb');
      V.osc(s);
      V.osc(lfo);
    };

    // Receipt stream: soft granular paper rustle between 2 and 6 kHz, kept clear of the listed cue times.
    B.rustle = (t0, len, vel, clear) =>
      I.play(
        t0,
        len,
        () => {
          const r = lib.rng(lib.hash('film-rustle', t0));
          const grains = flapGrains(r, 0, len - 0.1, 110, { amp: 0.22, f0: 2000, f1: 4000, width: 0.8 }).filter((g) => clear.every((c) => t0 + g.t + g.dur < c - 0.005 || t0 + g.t > c + 0.012));
          return grainBuffer(ctx, 'rustle' + t0, len, grains);
        },
        vel,
        { sustain: true, room: 0.1 }
      );

    // Hopper gulp: a jaw click and a sine thunk at 80 Hz, then the swallow.
    B.gobble = (t, vel) => {
      I.nz(t, 0.012, { type: 'highpass', q: 0.7, f: [[0, 2500]], amp: perc(vel * 0.7, 0.0003, 0.004), key: 'gobble' });
      B.tone(t, 0.14, 120, 80, vel, { glide: 0.03 });
      B.tone(t + 0.07, 0.1, 90, 60, vel * 0.6, {});
    };

    // Creaky squeak: a saw gliding 300 to 900 Hz (with a seeded stick-slip jitter) through a narrow
    // band-pass that tracks its third harmonic.
    B.squeak = (t, len, vel) => {
      const V = E.voice(t, len + 0.02, false);
      if (!V) return;
      const r = lib.rng(lib.hash('film-squeak', t));
      const fp = [[0, 300]];
      for (let k = 1; k <= 12; k++) fp.push([(k / 12) * len, 300 * Math.pow(3, k / 12) * (0.96 + 0.08 * r()), 'lin']);
      const s = E.osc('sawtooth', 300);
      V.env(s.frequency, fp);
      const bp = E.filt('bandpass', 900, 7);
      V.env(bp.frequency, [[0, 900], [len, 2700, 'exp']]);
      const g = E.gain(0);
      V.env(g.gain, [[0, 0], [0.006, vel], [len * 0.7, vel * 0.8], [len, FLOOR, 'exp']]);
      s.connect(bp);
      bp.connect(g);
      E.out(g, 'sfx', { room: 0.2 });
      V.osc(s);
    };

    // Whirr: band noise chopped at 40 Hz.
    B.whirr = (t, len, vel) => {
      const amp = [[0, 0]];
      for (let k = 0; k * 0.025 < len - 0.03; k++) amp.push([k * 0.025 + 0.004, vel], [k * 0.025 + 0.0125, vel * 0.35]);
      amp.push([len, FLOOR, 'exp']);
      I.nz(t, len, { type: 'bandpass', q: 2.5, f: [[0, 600], [len, 900, 'exp']], amp, key: 'whirr' });
    };

    // Clunk: a 40 ms sine at 150 Hz and a click.
    B.clunk = (t, vel) => {
      B.tone(t, 0.06, 150, 140, vel, {});
      I.nz(t, 0.012, { type: 'highpass', q: 0.7, f: [[0, 2200]], amp: perc(vel * 0.7, 0.0003, 0.004), key: 'clunk' });
    };

    // Ratchet click: a short resonant noise tick at f.
    B.ratchet = (t, f, vel) => I.nz(t, 0.02, { type: 'bandpass', q: 5, f: [[0, f]], amp: perc(vel, 0.0004, 0.01), key: 'ratchet', pan: 0.2 });

    // Typewriter click: a 3 ms high-passed noise burst with a 1.8 kHz tick.
    B.typeClick = (t, vel) => {
      I.nz(t, 0.005, { type: 'highpass', q: 0.7, f: [[0, 3000]], amp: perc(vel, 0.0002, 0.0015), key: 'type' });
      B.tone(t, 0.03, 1800, 1800, vel * 0.3, {});
    };

    // Paper flutter: noise band-passed 1 to 3 kHz, amplitude-modulated at 14 Hz, dying away over 0.25 s.
    B.flutter = (t, vel) => {
      const amp = [[0, 0]];
      for (let k = 0; k < 4; k++) amp.push([k / 14 + 0.004, vel * (1 - k * 0.25)], [k / 14 + 0.5 / 14, vel * 0.1]);
      amp.push([0.25, FLOOR, 'exp']);
      I.nz(t, 0.25, { type: 'bandpass', q: 1.1, f: [[0, 1000], [0.25, 3000, 'exp']], amp, key: 'flutter', room: 0.2, panEnv: [[0, -0.3], [0.25, 0.2, 'lin']] });
    };

    // Soft paper snap.
    B.paperSnap = (t, vel) => I.nz(t, 0.04, { type: 'bandpass', q: 1, f: [[0, 2800], [0.04, 1600, 'exp']], amp: perc(vel, 0.0005, 0.015), key: 'snap', pan: 0.2 });

    // Telephone bell: a 20 Hz striker hitting two bells, 1.1 and 1.4 kHz, in turn (40 strikes a second).
    B.phone = (t, len, vel) => {
      for (let k = 0; k * 0.025 < len; k++) {
        const f = k % 2 ? 1400 : 1100;
        B.metal(
          t + k * 0.025,
          vel * (k ? 0.7 : 1),
          [
            [f, 1, 0.22],
            [f * 2.76, 0.25, 0.07],
            [f * 5.4, 0.1, 0.03],
          ],
          { att: 0.0004, room: 0.2, pan: 0.25 }
        );
      }
    };

    // A muffled voice in the receiver: a saw on a seeded wobbly pitch, band-passed 400 to 1500 Hz, with a
    // moving vowel; one syllable per [t, len].
    B.squawk = (sylls, vel) => {
      const t0 = sylls[0][0];
      const end = sylls[sylls.length - 1];
      const len = end[0] + end[1] - t0 + 0.02;
      const V = E.voice(t0, len, true);
      if (!V) return;
      const r = lib.rng(lib.hash('film-squawk', t0));
      const fp = [[0, 180]];
      const vow = [[0, 700]];
      for (let k = 1; k * 0.03 < len; k++) {
        fp.push([k * 0.03, 180 * (0.85 + 0.35 * r()), 'lin']);
        vow.push([k * 0.03, 600 + 700 * r(), 'lin']);
      }
      const amp = [[0, 0]];
      for (const [t, l] of sylls) amp.push([t - t0 + 0.008, vel], [t - t0 + l * 0.6, vel * 0.8], [t - t0 + l, 0]);
      const s = E.osc('sawtooth', 180);
      V.env(s.frequency, fp);
      const hp = E.filt('highpass', 400, 0.8);
      const lp = E.filt('lowpass', 1500, 0.8);
      const pk = E.filt('peaking', 700, 2.5);
      pk.gain.value = 9;
      V.env(pk.frequency, vow);
      const g = E.gain(0);
      V.env(g.gain, amp);
      s.connect(hp);
      hp.connect(lp);
      lp.connect(pk);
      pk.connect(g);
      E.out(g, 'sfx', { pan: 0.3, room: 0.1 });
      V.osc(s);
    };

    // Sigh: breath noise band-passed 1.2 kHz falling to 420 Hz, 0.1 s in, 0.6 s out.
    B.sigh = (t, vel) => I.nz(t, 0.72, { type: 'bandpass', q: 1.1, f: [[0, 1200], [0.7, 420, 'exp']], amp: [[0, 0], [0.1, vel], [0.7, FLOOR, 'exp']], stereo: true, sustain: true, key: 'sigh', room: 0.2 });

    // Keypad: a 5 ms plastic click through a 2.5 kHz resonance with a 120 Hz thump.
    B.key = (t, vel) => {
      I.nz(t, 0.01, { type: 'bandpass', q: 4, f: [[0, 2500]], amp: perc(vel, 0.0003, 0.005), key: 'key', pan: -0.2 });
      B.tone(t, 0.04, 120, 110, vel * 0.5, {});
    };

    // Whip: a crack and a short swish across the frame.
    B.whip = (t, vel, pan) => {
      I.nz(t, 0.014, { type: 'highpass', q: 0.7, f: [[0, 3000]], amp: perc(vel, 0.0003, 0.005), pan, key: 'crack' });
      I.nz(t, 0.14, { type: 'bandpass', q: 1.2, f: [[0, 1200], [0.12, 4500, 'exp']], amp: [[0, 0], [0.006, vel * 0.5], [0.14, FLOOR, 'exp']], panEnv: [[0, Math.min(1, pan + 0.3)], [0.14, Math.max(-1, pan - 0.3), 'lin']], key: 'whip' });
    };
    return B;
  }

  function score(E, I) {
    const B = E.band || (E.band = band(E, I));
    const { pizz, bass, pah, xylo, clar, cym, bike, tone, clink } = B;
    const { tock, nz, fmBell } = I;
    const range = (a, b, step) => {
      const out = [];
      for (let k = 0; a + k * step < b - 1e-9; k++) out.push(Math.round((a + k * step) * 10000) / 10000);
      return out;
    };
    const R = (key) => lib.rng(lib.hash('burger-score', key));
    const brush = (t, vel) => cym(t, (vel || 0.2) * 0.45, 0.2, { att: 0.006, brush: true, pan: 0.3 });
    const motif = (notes, vel, o) => notes.forEach(([n, t], i) => xylo(t, n, Array.isArray(vel) ? vel[i] : vel, o));
    const run = (notes, t0, step) => notes.map((n, i) => [n, t0 + i * step]);

    // =========================================================== ACT 1: a burger for $5.69 (F major)
    // ---- bar 1 (0-2) the booth. cue 0: the bicycle bell twice; the band starts on the burger motif.
    bike(0, 0.22);
    bike(0.125, 0.18);
    bass(0, 'F2', 0.9);
    bass(1.0, 'F2', 0.8);
    pah(0.5, CH.F, 0.26);
    pah(1.5, CH.F, 0.2);
    brush(0.5);
    brush(1.5);
    // cue 1: the coins held up on C6 E6; the slap lands on F6
    motif([['F5', 0], ['A5', 0.25], ['C6', 0.5], ['A5', 0.75], ['C6', 1.0], ['E6', 1.125], ['F6', 1.5]], [0.42, 0.34, 0.38, 0.32, 0.4, 0.36, 0.3]);
    // cue 0.5: the skid, with a plunk on C3
    B.skid(0.5, 0.42);
    bass(0.5, 'C3', 0.6);
    // cue 1.5: the coins slapped, three clinks on 32nds over a woodblock
    tock(1.5, 0.15, 900);
    [3800, 4400, 5100].forEach((f, i) => clink(1.5 + i * 0.0625, f, 0.26 - i * 0.04, [-0.2, 0.15, 0.3][i]));

    // ---- bar 2 (2-4) inside booth one: the band through the wall, a low reed holding F3
    B.zip(2.0, 0.32); // cue 2: the burger slides
    clar([[2.0, 'F3']], 3.45, 0.3, { att: 0.04 });
    bass(2.0, 'Bb1', 0.85);
    bass(3.0, 'C2', 0.85);
    pah(2.5, CH.Bb6, 0.28);
    brush(2.5, 0.16);
    B.snatch(2.5); // cue 2.5
    B.kaching(3.0, 0.28); // cue 3: the register
    // cue 3.5: outside again at full bandwidth; the mouth opens on a rising reed glissando C4 to C5
    pah(3.5, CH.C7, 0.3);
    brush(3.5);
    clar([[3.5, 'C4'], [3.51, 'C5', 0.47]], 3.98, 0.3, { att: 0.02, rel: 0.02 });

    // ---- bar 3 (4-6) cue 4: the chomp on a pizzicato F major chord
    B.chomp(4.0, 0.48);
    bass(4.0, 'F2', 0.9);
    pah(4.0, CH.Fwide, 0.3);
    [4.5, 4.75, 5.0].forEach((t) => B.squelch(t, 0.45)); // cue 4.5: chewing
    pah(4.5, CH.F, 0.24);
    brush(4.5, 0.16);
    bass(5.0, 'C2', 0.8);
    // cue 5: bliss, a pentatonic xylophone run F5 to F6 on 32nds over a high reed A5 with a slow vibrato
    motif(run(['F5', 'G5', 'A5', 'C6', 'D6', 'F6'], 5.0, 0.0625), 0.34);
    clar([[5.0, 'A5']], 5.9, 0.2, { att: 0.07, vib: 0.01, rate: 4.2 });
    pah(5.5, CH.C7, 0.24);
    brush(5.5, 0.16);

    // ---- bar 4 (6-8) the title. cue 6: the stinger, the whole band on F6/9 and a small-cymbal crash
    bass(6.0, 'F2', 0.95);
    pah(6.0, CH.F69, 0.26);
    xylo(6.0, 'D6', 0.26);
    xylo(6.0, 'G6', 0.22);
    clar([[6.0, 'C5']], 6.09, 0.28, { att: 0.01, rel: 0.03 });
    cym(6.0, 0.1, 0.6, { pan: 0.2, hall: 0.15 });
    motif([['A5', 6.125], ['C6', 6.25], ['F6', 6.375]], 0.5); // cues 6.125, 6.25, 6.375: the words pop
    B.scribble(6.5, 0.25, 3000, 6000, 0.3); // cue 6.5: the byline
    // cue 7: the burger bounces on a pizzicato boop gliding F3 to C4; a C7 turnaround into the ride
    pizz(7.0, 'F3', 0.42, { glide: ['C4', 0.12], bright: 0.3, open: true });
    bass(7.0, 'C2', 0.7);
    bass(7.5, 'E2', 0.7);
    pah(7.5, CH.C7, 0.26);
    brush(7.5, 0.16);
    motif([['A4', 7.25], ['Bb4', 7.5], ['B4', 7.75]], 0.3);

    // =========================================================== ACT 2: two miles
    // ---- bars 5-7 (8-13) cue 8: the ride. A walking pizzicato bass on quarters, chords on 2 and 4,
    // brushes, freewheel ticks on 16ths, the ride tune on the xylophone, then the reed an octave up.
    [['F2', 8.0], ['A2', 8.5], ['C3', 9.0], ['Bb2', 9.5], ['A2', 10.0], ['D3', 10.5], ['C3', 11.0], ['Bb2', 11.5], ['F2', 12.0], ['C3', 12.5]].forEach(([n, t]) => bass(t, n, 0.75));
    [[8.5, CH.F6], [9.5, CH.C7], [10.5, CH.F6], [11.0, CH.C7], [12.5, CH.F6]].forEach(([t, c]) => pah(t, c, 0.24));
    range(8.5, 13.0, 1.0).forEach((t) => brush(t, 0.16));
    range(8.0, 12.95, 0.125).forEach((t, i) => nz(t, 0.006, { type: 'highpass', q: 0.7, f: [[0, 6000]], amp: perc(i % 2 ? 0.05 : 0.08, 0.0003, 0.002), pan: i % 2 ? 0.25 : -0.25, key: 'freewheel' }));
    motif([['A4', 8.0], ['C5', 8.25], ['F5', 8.5], ['D5', 8.75], ['E5', 9.0], ['C5', 9.25], ['Bb4', 9.5], ['G4', 9.75]], [0.4, 0.32, 0.38, 0.32, 0.34, 0.32, 0.36, 0.32]);
    // cue 8.5: the mile counter steps, a tiny woodblock at 1.6 kHz on every beat to 11.5
    range(8.5, 11.75, 0.5).forEach((t) => tock(t, 0.12, 1600, { pan: -0.35 }));
    B.gulp(9.0, 0.3); // cue 9
    // cue 10: the fountain jets on the beats; the reed takes the tune up an octave
    [10.0, 10.5, 11.0].forEach((t) => B.fountain(t, 0.3));
    clar([[10.0, 'A5'], [10.25, 'C6'], [10.5, 'F6'], [10.75, 'D6'], [11.0, 'E6'], [11.25, 'C6']], 11.45, 0.24, { att: 0.015, vib: 0 });
    // cue 11.5: the columns, a brassy colour (the reed doubled by a low-passed saw a fifth below) and a
    // pizzicato run up F major on 32nds
    clar([[11.5, 'G5'], [11.75, 'C6'], [12.0, 'A5']], 12.45, 0.26, { att: 0.015, vib: 0.004 });
    clar([[11.5, 'C5'], [11.75, 'F5'], [12.0, 'D5']], 12.45, 0.16, { att: 0.03, wave: E.brassSaw, cut: 1600, breath: 0, vib: 0 });
    run(['F3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4'], 11.5, 0.0625).forEach(([n, t], i) => pizz(t, n, 0.34 + i * 0.02, { dec: 0.3, pan: -0.3 + i * 0.08 }));
    // cue 12: two miles, a bicycle bell and a xylophone C7; the sniff with the head lift
    bike(12.0, 0.2);
    xylo(12.0, 'C7', 0.3);
    B.sniff(12.0, 0.3);
    // cue 12.5: the tune doubles into 16ths for the sprint
    motif(run(['A4', 'C5', 'F5', 'D5'], 12.5, 0.125), [0.38, 0.32, 0.36, 0.32]);

    // ---- bars 7-8 (13-16) inside booth two: the band thins to pizzicato and the low reed
    B.skid(13.0, 0.5, true); // cue 13: the skid outside, through the wall
    bass(13.0, 'F2', 0.85);
    pah(13.5, CH.F, 0.26);
    bass(14.0, 'Bb1', 0.85);
    pah(14.5, CH.C7, 0.26);
    clar([[13.0, 'F3'], [14.0, 'D3'], [14.5, 'E3']], 14.95, 0.3, { att: 0.04 });
    [4200, 4800, 3900].forEach((f, i) => clink(13.5 + i * 0.125, f, 0.28, [-0.3, 0.2, 0.35][i])); // cue 13.5
    B.zip(14.0, 0.32); // cue 14
    B.snatch(14.5); // cue 14.5
    clink(14.5, 4600, 0.22, 0.25);
    // cue 15: two dry knocks; the band stops on one held reed note that swells into the push-in
    tock(15.0, 0.25, 950, { dec: 0.04 });
    tock(15.125, 0.22, 950, { dec: 0.04 });
    clar([[15.0, 'C4']], 15.96, 0.16, { att: 0.05, sus: 2.4, rel: 0.03 });
    // cue 15.25: the push-in, a slide whistle rising two octaves and a roll from 16ths to 32nds
    B.swhistle(15.25, 0.74, 400, 1600, 0.2);
    [...range(15.25, 15.65, 0.125), ...range(15.6875, 15.95, 0.0625)].forEach((t, i) => B.snare(t, 0.12 + i * 0.03));

    // =========================================================== ACT 3: where $6.89 comes from
    // ---- bar 9 (16-18) cue 16: the tag. A shock stab on B D F Ab, a small-cymbal crash, a low boom.
    bass(16.0, 'B1', 0.7, { dec: 0.5 });
    pah(16.0, CH.dim, 0.3, { dec: 0.3 });
    xylo(16.0, 'B5', 0.2);
    xylo(16.0, 'F6', 0.18);
    clar([[16.0, 'D5']], 16.09, 0.32, { att: 0.006, rel: 0.03 });
    cym(16.0, 0.1, 0.4, { hall: 0.2 });
    I.subDrop(16.0, 70, 45, 0.5, 0.45);
    B.boing(16.125, 0.36); // cue 16.125: the eyes pop
    B.scribble(16.25, 0.2, 2500, 5000, 0.32); // cue 16.25: +21%, and a falling reed A4 to E4
    clar([[16.25, 'A4'], [16.3, 'E4', 0.3]], 16.65, 0.24, { att: 0.012 });
    bass(16.5, 'F2', 1.0, { bright: 0.8, lpx: 20 }); // cue 16.5: the jaw drops
    tone(16.5, 0.12, 95, 70, 0.4, { bus: 'bass' });
    // cue 17: the burger trembles, a xylophone tremolo on E5 over A (the dominant of D minor)
    range(17.0, 17.24, 0.05).forEach((t, i) => xylo(t, 'E5', i % 2 ? 0.26 : 0.32, { dec: 0.3 }));
    bass(17.0, 'A1', 0.7, { dec: 0.6 });
    clar([[17.0, 'D2']], 17.625, 0.3, { att: 0.1, rel: 0.35, cut: 600 }); // the low reed that outlasts the band
    // cue 17.625: the band stops on a choked cymbal
    cym(17.625, 0.18, 0.07);
    pah(17.625, CH.A7, 0.3, { dec: 0.15 });
    bass(17.625, 'A1', 0.7, { dec: 0.2 });

    // ---- bars 10-11 (18-22.5) cue 18: the machine in D minor. Tick-tock on 8ths, a pizzicato ostinato
    // on 16ths, a low reed pedal on D2 and the hum.
    B.hum(18.0, 22.4, 0.14);
    clar([[18.0, 'D2'], [21.5, 'F2']], 22.2, 0.2, { att: 0.03, cut: 600, vib: 0 });
    const tick = (a, b) => range(a, b, 0.25).forEach((t, i) => tock(t, i % 2 ? 0.14 : 0.2, i % 2 ? 1200 : 900, { pan: i % 2 ? 0.35 : -0.35 }));
    const ost = (a, b, notes) => range(a, b, 0.125).forEach((t, i) => pizz(t, notes[i % 4], i % 4 ? 0.26 : 0.34, { dec: 0.25, pan: 0.1 }));
    tick(18.0, 20.0);
    ost(18.0, 20.0, ['D3', 'A3', 'F3', 'A3']);
    // cue 18.25: the receipt stream until 20.0, rustling paper and seeded coin clinks on 16ths
    B.rustle(18.25, 1.75, 0.45, [18.5, 19.0, 19.5, 20.0]);
    range(18.25, 20.0, 0.125).forEach((t) => {
      const r = R('coin' + t);
      if (r() < 0.75) clink(t, 3400 + r() * 2200, 0.08 + r() * 0.08, r() * 1.4 - 0.7);
    });
    [18.25, 18.5].forEach((t) => tock(t, 0.14, 2000, { bus: 'sfx', dec: 0.03 })); // cues 18.25, 18.5: caption ticks
    [19.0, 19.5].forEach((t) => B.gobble(t, 0.5)); // cue 19: the hopper gulps
    // ---- bar 11 (20-21) cue 20: the periscope, a creaky squeak, a whirr under the pan, a held Dsus4
    B.squeak(20.0, 0.3, 0.26);
    B.whirr(20.0, 0.5, 0.12);
    bass(20.0, 'D2', 0.7);
    pah(20.0, CH.Dsus, 0.22);
    clar([[20.0, 'G4']], 20.95, 0.16, { att: 0.04 });
    tock(20.25, 0.14, 2000, { bus: 'sfx', dec: 0.03 }); // cue 20.25: caption tick
    B.clunk(20.5, 0.36); // cue 20.5: the view locks
    ['C6', 'D6', 'E6'].forEach((n) => xylo(20.5, n, 0.2));
    tone(20.875, 0.04, 1200, 1200, 0.3, { room: 0.15 }); // cue 20.875: the blink, a 40 ms blip
    // ---- 21-22.5 cue 21: the gauge, ratchet clicks on 16ths rising 1 to 2 kHz
    tick(21.0, 22.25);
    ost(21.0, 21.5, ['D3', 'A3', 'F3', 'A3']);
    ost(21.5, 22.25, ['F3', 'C4', 'A3', 'C4']); // cue 21.5: the ostinato steps up to F
    [21.125, 21.25, 21.375, 21.5].forEach((t, i) => B.ratchet(t, 1000 * Math.pow(2, i / 3), 0.4));
    fmBell(21.5, 2400, 0.28, { ratio: 1.41, index: 1.5, dec: 0.6, bus: 'sfx', room: 0.2 }); // the needle on MEDIUM
    [21.75, 21.875, 22.0, 22.125].forEach((t) => B.typeClick(t, 0.38)); // cue 21.75: printing
    nz(21.75, 0.5, { type: 'bandpass', q: 0.7, f: [[0, 2600]], amp: [[0, 0], [0.1, 0.05], [0.42, 0.05], [0.5, FLOOR, 'exp']], key: 'slide' });
    fmBell(22.25, 1600, 0.32, { ratio: 3.51, index: 2.2, dec: 1.0, bus: 'sfx', room: 0.25 }); // cue 22.25: the ticket

    // ---- bars 12-13 (22.5-26) inside booth two, weary in D minor: a slow pizzicato lament, a falling reed
    B.flutter(22.5, 0.3); // cue 22.5: the ticket flutters in
    B.paperSnap(22.75, 0.45); // cue 22.75: the catch
    [['D2', 22.5], ['C#2', 23.5], ['D2', 24.0], ['Bb1', 24.5], ['A1', 25.0]].forEach(([n, t]) => bass(t, n, 0.75));
    [[23.0, CH.Dm], [24.0, CH.Dm], [24.5, CH.Gm], [25.0, CH.A7]].forEach(([t, c]) => pah(t, c, 0.22));
    clar([[22.5, 'A4'], [23.0, 'G4'], [23.25, 'F4'], [23.5, 'E4']], 23.95, 0.2, { att: 0.05 });
    B.phone(23.5, 0.375, 0.3); // cue 23.5: the phone rings
    B.squawk([[24.0, 0.11], [24.25, 0.11]], 0.3); // cue 24: the receiver squawks
    B.sigh(24.5, 0.32); // cue 24.5: the sigh, doubled by the reed A4 F4 D4
    clar([[24.5, 'A4'], [24.7, 'F4', 0.12], [24.9, 'D4', 0.15]], 24.98, 0.18, { att: 0.06 });
    [25.0, 25.125, 25.25, 25.375].forEach((t) => B.key(t, 0.5)); // cue 25: the keys
    fmBell(25.5, 1300, 0.3, { ratio: 1.4, index: 1.1, dec: 1.1, bus: 'sfx', room: 0.2 }); // cue 25.5: a tired ding
    bass(25.5, 'D2', 0.8, { open: true });

    // =========================================================== ACT 4: back to $5.69 (F major)
    // ---- bar 14 (26-28) cue 26: the street, F major over a held pizzicato tremolo on C
    range(26.0, 26.6, 0.0625).forEach((t, i) => pizz(t, 'C3', i ? 0.3 : 0.5, { dec: 0.25, pan: -0.1 }));
    bass(26.0, 'C2', 0.8);
    pah(26.0, CH.F, 0.3);
    xylo(26.0, 'F5', 0.3);
    xylo(26.0, 'C6', 0.24);
    cym(26.0, 0.09, 0.5, { att: 0.004, pan: 0.2 });
    B.swhistle(26.25, 0.25, 300, 900, 0.22); // cue 26.25: the crouch
    B.swhistle(26.5, 0.2, 1600, 400, 0.22); // cue 26.5: the turn
    // cue 26.625: the dash, a whoosh and a pizzicato zing; the ride tune comes back in 16ths on the reed
    B.whoosh(26.625, 0.25, 0.2, { type2: 'lowpass', f2: 6500 });
    pizz(26.625, 'C4', 0.4, { glide: ['C5', 0.06], bright: 0.8, lpx: 16 });
    clar(run(['A4', 'C5', 'F5', 'D5', 'E5', 'C5', 'Bb4', 'G4', 'A4', 'C5', 'F5'], 26.625, 0.125).map(([n, t]) => [t, n]), 27.95, 0.22, { att: 0.01, vib: 0 });
    // cues 27-27.75: the cascade back, a whip and a falling xylophone note on each card, then the skid
    [['F6', 27.0], ['D6', 27.25], ['C6', 27.5], ['A5', 27.75]].forEach(([n, t], i) => {
      B.whip(t, 0.32, 0.4 - i * 0.25);
      xylo(t, n, 0.4);
    });
    bass(27.0, 'F2', 0.8);
    bass(27.5, 'C2', 0.8);
    pah(27.25, CH.F6, 0.22);
    pah(27.75, CH.C7, 0.22);
    B.skid(27.75, 0.36);
    bike(27.875, 0.2); // cue 27.875: the counter at zero

    // ---- bar 15 (28-30) cue 28: the bite again. The burger motif returns warm; the reed glissando.
    clar([[28.0, 'C4'], [28.01, 'C5', 0.47]], 28.48, 0.3, { att: 0.02, rel: 0.02 });
    bass(28.0, 'F2', 0.85);
    xylo(28.0, 'F5', 0.38, { hall: 0.2 });
    xylo(28.25, 'A5', 0.42, { hall: 0.2 }); // cue 28.25: "Same burger."
    B.chomp(28.5, 0.48); // cue 28.5
    pah(28.5, CH.Fwide, 0.3);
    xylo(28.75, 'C6', 0.42, { hall: 0.2 }); // cue 28.75: "Different neighbourhood."
    [28.75, 29.0, 29.25].forEach((t) => B.squelch(t, 0.42));
    bass(29.0, 'C2', 0.8);
    xylo(29.0, 'A5', 0.3, { hall: 0.2 });
    // cue 29.5: bliss again
    motif(run(['F5', 'G5', 'A5', 'C6', 'D6', 'F6'], 29.5, 0.0625), 0.34);
    clar([[29.5, 'A5']], 29.95, 0.2, { att: 0.07, vib: 0.01, rate: 4.2 });
    pah(29.5, CH.Fmaj7, 0.24);

    // ---- bar 16 (30-32) cue 30: the closing cadence. Pizzicato F2 C3 F2 on the beats, the burger motif
    // slower on the xylophone, the reed holding A4, a brushed swish.
    bass(30.0, 'F2', 0.85);
    bass(30.5, 'C3', 0.75);
    bass(31.0, 'F2', 0.75);
    cym(30.0, 0.12, 0.5, { att: 0.03, brush: true, pan: 0.3 });
    clar([[30.0, 'A4']], 30.92, 0.2, { att: 0.05 });
    motif([['F5', 30.0], ['A5', 30.5], ['C6', 31.0], ['A5', 31.25]], 0.36);
    // cue 30.5: the channel mark, a xylophone sparkle C6 E6 G6 C7 on 32nds
    motif(run(['C6', 'E6', 'G6', 'C7'], 30.5, 0.0625), [0.3, 0.27, 0.24, 0.21]);
    pah(30.5, CH.C7, 0.2);
    // cue 31: the owner yawns, a soft low reed glide F3 down to C3
    clar([[31.0, 'F3'], [31.06, 'C3', 0.36]], 31.45, 0.2, { att: 0.08, cut: 900 });
    // cue 31.5: a soft final F major chord, short
    bass(31.5, 'F2', 0.6, { dec: 0.4 });
    pah(31.5, CH.F, 0.22, { dec: 0.3 });
    xylo(31.5, 'F5', 0.3);
    xylo(31.5, 'A5', 0.24);
    // cue 31.75: the pickup, C5 and E5 on 32nds, resolving onto the bell and the F of bar 1
    xylo(31.75, 'C5', 0.3);
    xylo(31.8125, 'E5', 0.32);
  }

  FILM.audio = {
    render(ctx, opts) {
      const o = opts || {};
      const start = Math.max(0, Number(o.start) || 0);
      const dest = o.dest || ctx.destination;
      const DUR = (FILM.TIMELINE && FILM.TIMELINE.duration) || FILM.DURATION || 32;
      // opts.mix overrides the mix constants (bus gains, trim); the analysis tools use it for solo renders.
      const om = o.mix || {};
      const mix = Object.assign({}, MIX, om, {
        bus: Object.assign({}, MIX.bus, om.bus || {}),
        eq: Object.assign({}, MIX.eq, om.eq || {}),
        comp: Object.assign({}, MIX.comp, om.comp || {}),
      });
      const E = makeEngine(ctx, start, dest, DUR, mix);
      const I = instruments(E);
      // The score is scheduled one bar at a time, so the audio graph only ever holds the voices of
      // the next few seconds. Each voice belongs to exactly one bar by its start time, so the output
      // is the same as scheduling everything at once. The first bar also takes every earlier voice
      // still sounding at `start`.
      const BAR = 240 / ((FILM.TIMELINE && FILM.TIMELINE.bpm) || 120);
      const first = Math.floor(start / BAR);
      const last = Math.ceil(DUR / BAR) - 1;
      const run = (k) => {
        E.w0 = k === first ? -Infinity : k * BAR;
        E.w1 = k === last ? Infinity : (k + 1) * BAR;
        score(E, I);
      };
      const due = (k) => E.base + (k * BAR - start) - LAT; // context time of bar k's first event
      run(first);
      let k = first + 1;
      const isOffline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
      if (isOffline && typeof ctx.suspend !== 'function') {
        // An offline context that cannot pause mid-render gets every bar up front.
        for (; k <= last; k++) run(k);
      } else if (isOffline) {
        // Offline: pause the render 0.25 s before each bar, schedule it, resume.
        const q = 128 / ctx.sampleRate;
        const end = ctx.length / ctx.sampleRate;
        for (; k <= last; k++) {
          const j = k;
          const when = Math.floor((due(j) - 0.25) / q) * q;
          if (when >= end - q) break; // this bar starts after the render window ends
          let paused = null;
          if (when > ctx.currentTime + q) {
            try {
              paused = ctx.suspend(when);
            } catch (e) {
              paused = null;
            }
          }
          if (!paused) run(j);
          else
            paused.then(
              () => {
                run(j);
                ctx.resume();
              },
              () => run(j)
            );
        }
      } else {
        // Live: a look-ahead timer schedules each bar 1.5 s before it sounds.
        const AHEAD = 1.5;
        const pump = () => {
          while (k <= last && due(k) - ctx.currentTime < AHEAD) run(k++);
          return k <= last;
        };
        if (pump()) {
          const timer = setInterval(() => {
            if (ctx.state === 'closed' || !pump()) clearInterval(timer);
          }, 100);
        }
      }
    },
  };
})();

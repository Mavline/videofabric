/*
 * lib.js : FILM.lib, the shared drawing library.
 *
 * Everything here is a pure function of its arguments plus FILM.lib.T (the global time
 * core sets before each shot draws, used only for the 12 fps line boil).
 * Randomness comes from rng(seed) and hash(...). Caches are keyed by every input.
 *
 * Shape inputs ("clip") accepted by hatch, crossHatch, stipple and hexLattice:
 *   - an array of points [[x,y], ...] or [{x,y}, ...]      (fast: exact spans, natural ends)
 *   - an array of polygons [[[x,y],...], [[x,y],...]]      (even-odd, so inner polygons are holes)
 *   - a function (ctx) => { ctx.moveTo...; ctx.arc... }     (hard clip; pass opts.bounds for speed)
 *   - a Path2D                                             (hard clip; pass opts.bounds for speed)
 *   - null                                                 (no clip; opts.bounds or the whole frame)
 * Bounds are { x, y, w, h } or [x, y, w, h] in the current (logical) coordinates.
 *
 * Angles are radians. Sizes are logical pixels on the 1080x1920 frame.
 */
(function () {
  'use strict';

  const FILM = (window.FILM = window.FILM || {});
  const lib = (FILM.lib = {});
  const W = () => FILM.W || 1080;
  const H = () => FILM.H || 1920;
  const TAU = Math.PI * 2;

  lib.TAU = TAU;
  // global time of the frame being drawn; core sets it before each shot draws, scenes can only read it
  Object.defineProperty(lib, 'T', { get: () => FILM.frameT || 0, enumerable: true });

  // ===========================================================================
  // Numbers
  // ===========================================================================

  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  const smoothstep = (e0, e1, x) => {
    const t = clamp(invLerp(e0, e1, x));
    return t * t * (3 - 2 * t);
  };
  lib.clamp = clamp;
  lib.lerp = lerp;
  lib.invLerp = invLerp;
  lib.smoothstep = smoothstep;

  // ===========================================================================
  // Easing (inputs are clamped to 0..1)
  // ===========================================================================

  const c01 = (p) => (p < 0 ? 0 : p > 1 ? 1 : p);
  const B1 = 1.70158;
  const B2 = B1 * 1.525;
  const ease = {
    linear: (p) => c01(p),
    inQuad: (p) => ((p = c01(p)), p * p),
    outQuad: (p) => ((p = c01(p)), 1 - (1 - p) * (1 - p)),
    inOutQuad: (p) => ((p = c01(p)), p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
    inCubic: (p) => ((p = c01(p)), p * p * p),
    outCubic: (p) => ((p = c01(p)), 1 - Math.pow(1 - p, 3)),
    inOutCubic: (p) => ((p = c01(p)), p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    inQuart: (p) => ((p = c01(p)), p * p * p * p),
    outQuart: (p) => ((p = c01(p)), 1 - Math.pow(1 - p, 4)),
    inOutQuart: (p) => ((p = c01(p)), p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2),
    inQuint: (p) => ((p = c01(p)), p * p * p * p * p),
    outQuint: (p) => ((p = c01(p)), 1 - Math.pow(1 - p, 5)),
    inOutQuint: (p) => ((p = c01(p)), p < 0.5 ? 16 * p * p * p * p * p : 1 - Math.pow(-2 * p + 2, 5) / 2),
    inSine: (p) => ((p = c01(p)), 1 - Math.cos((p * Math.PI) / 2)),
    outSine: (p) => ((p = c01(p)), Math.sin((p * Math.PI) / 2)),
    inOutSine: (p) => ((p = c01(p)), -(Math.cos(Math.PI * p) - 1) / 2),
    inExpo: (p) => ((p = c01(p)), p === 0 ? 0 : Math.pow(2, 10 * p - 10)),
    outExpo: (p) => ((p = c01(p)), p === 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    inOutExpo: (p) => ((p = c01(p)), p === 0 ? 0 : p === 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2),
    inCirc: (p) => ((p = c01(p)), 1 - Math.sqrt(1 - p * p)),
    outCirc: (p) => ((p = c01(p)), Math.sqrt(1 - Math.pow(p - 1, 2))),
    inOutCirc: (p) => ((p = c01(p)), p < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * p, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * p + 2, 2)) + 1) / 2),
    inBack: (p) => ((p = c01(p)), (B1 + 1) * p * p * p - B1 * p * p),
    outBack: (p) => ((p = c01(p)), 1 + (B1 + 1) * Math.pow(p - 1, 3) + B1 * Math.pow(p - 1, 2)),
    inOutBack: (p) => ((p = c01(p)), p < 0.5 ? (Math.pow(2 * p, 2) * ((B2 + 1) * 2 * p - B2)) / 2 : (Math.pow(2 * p - 2, 2) * ((B2 + 1) * (p * 2 - 2) + B2) + 2) / 2),
    outElastic: (p) => ((p = c01(p)), p === 0 ? 0 : p === 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * (TAU / 3)) + 1),
    outBounce: (p) => {
      p = c01(p);
      const n = 7.5625, d = 2.75;
      if (p < 1 / d) return n * p * p;
      if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
      if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
      return n * (p -= 2.625 / d) * p + 0.984375;
    },
    /** Snappy settle used for drawn-animation poses: fast out, tiny overshoot. */
    snap: (p) => ((p = c01(p)), 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2)),
    /** Factory: hold-and-jump in n steps. */
    steps: (n) => (p) => Math.min(1, Math.floor(c01(p) * n) / n),
  };
  lib.ease = ease;

  const easeFn = (e) => (typeof e === 'function' ? e : typeof e === 'string' && ease[e] ? ease[e] : ease.linear);

  /** mapRange(x, a0, a1, b0, b1, easing?) clamps x into [a0,a1] and maps to [b0,b1]. */
  lib.mapRange = (x, a0, a1, b0, b1, e) => b0 + (b1 - b0) * easeFn(e)(clamp(invLerp(a0, a1, x)));
  /** seg(t, t0, t1, easing?) : 0..1 progress of t through [t0,t1]. */
  lib.seg = (t, t0, t1, e) => easeFn(e)(clamp(invLerp(t0, t1, t)));

  // ===========================================================================
  // Hash, rng, noise
  // ===========================================================================

  const F64 = new Float64Array(1);
  const U32 = new Uint32Array(F64.buffer);
  function mix32(h) {
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15;
    h = Math.imul(h, 0x846ca68b);
    h ^= h >>> 16;
    return h >>> 0;
  }
  /** hash(...values) : stable unsigned 32-bit int from numbers and strings. */
  function hash() {
    let h = 0x811c9dc5 ^ arguments.length;
    for (let a = 0; a < arguments.length; a++) {
      const v = arguments[a];
      if (typeof v === 'number') {
        if ((v | 0) === v) {
          h = mix32(h ^ Math.imul(v, 0x9e3779b1));
        } else {
          F64[0] = v;
          h = mix32(h ^ U32[0]);
          h = mix32(h ^ U32[1]);
        }
      } else {
        const s = String(v);
        for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
        h = mix32(h ^ s.length);
      }
    }
    return h >>> 0;
  }
  lib.hash = hash;

  const seedInt = (s) => (typeof s === 'number' && (s | 0) === s ? s : hash(s) | 0);

  /** Fast stateless 3-int hash to [0,1). */
  function h3(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
    h ^= h >>> 15;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  lib.h3 = h3;

  /** rng(seed) : function returning [0,1). Has .range(a,b) .int(a,b) .pick(arr) .sign() .chance(p) .gauss(). */
  function rng(seed) {
    let a = hash(seed === undefined ? 1 : seed) || 0x9e3779b9;
    const r = function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (lo, hi) => lo + (hi - lo) * r();
    r.int = (lo, hi) => lo + Math.floor((hi - lo + 1) * r());
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.sign = () => (r() < 0.5 ? -1 : 1);
    r.chance = (p) => r() < p;
    r.gauss = () => {
      const u = 1 - r();
      const v = r();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
    };
    return r;
  }
  lib.rng = rng;

  const fade5 = (f) => f * f * f * (f * (f * 6 - 15) + 10);

  /** noise1(x, seed) : smooth 1D gradient noise in [-1,1]. */
  function noise1(x, seed) {
    const s = seed === undefined ? 0 : seedInt(seed);
    const i = Math.floor(x);
    const f = x - i;
    const g0 = h3(i, 71, s) * 2 - 1;
    const g1 = h3(i + 1, 71, s) * 2 - 1;
    const v = lerp(g0 * f, g1 * (f - 1), fade5(f)) * 2;
    return v < -1 ? -1 : v > 1 ? 1 : v;
  }
  lib.noise1 = noise1;

  const GX = [1, -1, 1, -1, 1.4142, -1.4142, 0, 0];
  const GY = [1, 1, -1, -1, 0, 0, 1.4142, -1.4142];
  function grad(ix, iy, s, x, y) {
    const k = (h3(ix, iy, s) * 8) | 0;
    return GX[k] * x + GY[k] * y;
  }
  /** noise2(x, y, seed) : smooth 2D gradient noise in [-1,1]. */
  function noise2(x, y, seed) {
    const s = seed === undefined ? 0 : seedInt(seed);
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const u = fade5(fx);
    const v = fade5(fy);
    const n00 = grad(ix, iy, s, fx, fy);
    const n10 = grad(ix + 1, iy, s, fx - 1, fy);
    const n01 = grad(ix, iy + 1, s, fx, fy - 1);
    const n11 = grad(ix + 1, iy + 1, s, fx - 1, fy - 1);
    const r = lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) * 1.1;
    return r < -1 ? -1 : r > 1 ? 1 : r;
  }
  lib.noise2 = noise2;

  lib.fbm1 = (x, seed, oct = 3) => {
    const s = seed === undefined ? 0 : seedInt(seed);
    let a = 0.5, f = 1, sum = 0, norm = 0;
    for (let o = 0; o < oct; o++) {
      sum += a * noise1(x * f, s + o * 101);
      norm += a;
      a *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  };
  lib.fbm2 = (x, y, seed, oct = 3) => {
    const s = seed === undefined ? 0 : seedInt(seed);
    let a = 0.5, f = 1, sum = 0, norm = 0;
    for (let o = 0; o < oct; o++) {
      sum += a * noise2(x * f, y * f, s + o * 101);
      norm += a;
      a *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  };

  // ===========================================================================
  // Animation clocks
  // ===========================================================================

  /** boil(T, fps=12) : index of the held drawing at global time T. Lines re-wobble when it changes. */
  lib.boil = (T, fps = 12) => Math.floor(T * fps + 1e-6);
  /** onTwos(t) : quantise time to 1/12 s so motion steps like drawn animation. */
  lib.onTwos = (t) => Math.floor(t * 12 + 1e-6) / 12;

  // This film's lines never boil (art bible 4, rule 6 of docs/reference-analysis.md): a stroke stays
  // put until the drawing changes. So boiling is off unless a call asks for it with boil: true or a
  // drawing index. Everything below reads boilOff(o) instead of testing o.boil === false.
  const BOIL_BY_DEFAULT = false;
  const boilOff = (o) => o.boil === false || (o.boil == null && !BOIL_BY_DEFAULT);
  function boilIndex(o) {
    if (boilOff(o)) return 0;
    if (typeof o.boil === 'number') return o.boil;
    return lib.boil(lib.T);
  }

  // ===========================================================================
  // Colour
  // ===========================================================================

  // Keys and values follow docs/art-bible.md section 2 (the published palette).
  // This film's names come first (so the palette sheet shows them first); the skill's house colours
  // after them stay only for the tool fixtures and src/props.js. A scene of this film reads only the
  // names in the first two blocks.
  const pal = {
    // 2.1 the manner, sampled from the reference frames (docs/reference-analysis.md, "Палитра")
    ink: '#001003', // contour of every character and moving object
    paper: '#FEFFF5', // white of cards, signs and title fields; the white flash
    fieldSky: '#DDE7EC', // light field tinted per scene (STYLE.md 3): pale blue
    fieldMint: '#DCE8D8', // light field: pale mint
    fieldPink: '#F0D9D2', // light field: pale pink
    hillsFar: '#B5B7C3', // far hills, the distance
    grass: '#89D48C', // near meadow, lawns, hills
    wallYellow: '#E7D885', // house walls
    waterTop: '#A8FEF3', // water at the surface, window glass
    waterDeep: '#19A0A5', // water in the depth (gradient end, background only)
    sand: '#CABE73', // sand, dry ground
    fence: '#A9C5BA', // fence boards, counter wood
    trunk: '#6B8569', // tree trunks, pencil grain of fences
    flower: '#CB8FB9', // meadow flowers, awning stripes
    cityPastel: '#D4C2B5', // pastel town (machine plate), rich house walls
    pavement: '#898A8B', // pavement and floor (machine plate), speed lines
    wallWarm: '#C57B3E', // warm room walls (machine plate)
    shadowWarm: '#754926', // shadow on the warm wall
    nightSky: '#6B77A4', // night sky, the machine's inside
    windowLight: '#DA9067', // lit windows at night
    skin: '#E8B998', // adult skin
    blush: '#E19F88', // adult blush
    skinKid: '#D3ADA2', // child skin
    blushKid: '#D08D7C', // child blush
    hairYellow: '#D8B967', // the hero's hair
    hairRed: '#E9541E', // red hair, small accents
    red: '#CC0005', // the hero's shirt, main accent, HIGH
    green: '#117E43', // the bicycle, LOW
    pink: '#FE85AE', // the owner's shirt
    slate: '#3C686E', // shorts, trousers, the phone, dark fills
    white: '#F3F3F0', // white fills on the cel layer: eyes, teeth, apron, paper cap
    mouth: '#A02D2E', // inside of an open mouth
    iris: '#3C78B6', // the child's iris
    cap: '#2D584B', // the hero's cap
    titleSpot: '#B2F0E6', // pale blot under a title
    titleSpotPink: '#E9D6E8', // second pale blot under a title
    titleBlue: '#2D8DA7', // title letters, the closing word
    titleYellow: '#E9DE3C', // first letter of a name, MEDIUM, lit lamp
    // 2.2 subject palette: the burger, the machine and the props, in the same logic: saturated
    // colour and white only on the cel layer, the background stays light and quiet
    bun: '#E8A04A', // burger bun
    sesame: '#FFF3D1', // sesame seeds on the bun
    patty: '#6A3417', // burger patty
    lettuce: '#58B947', // lettuce leaf
    cheese: '#F8C31C', // cheese slice
    tag: '#F7E36B', // price tag card
    ticket: '#F6F4EA', // the machine's ticket, receipts, the map sheet
    dial: '#FBF3D5', // face of the willingness-to-pay gauge
    machine: '#2D8DA7', // the pricing machine's body
    machineDark: '#1F5F70', // the machine's legs, periscope, hopper
    screen: '#BFEFD9', // phone and keypad screens
    coin: '#EDB92C', // coins in the purchase stream
    shoe: '#5A3321', // shoes, the bicycle saddle
    hairGrey: '#A3A3A8', // the owner's hair and moustache
    roof: '#D19A7E', // roof of the modest house (background)
    stone: '#D8D4C8', // stone of the rich house, steps, fountain (background)
    // ---- house colours of the skill: tool fixtures and src/props.js only, never this film's scenes ----
    // 2.1 warm illustrated palette (paper plate); ink, paper, white, red and nightSky moved up
    paperShade: '#E2D1B0',
    paperDeep: '#CDB58C',
    stripeCream: '#F2E7CF',
    stripeYellow: '#EFDCA3',
    stripeApricot: '#F0D9B5',
    stripeSage: '#DCE3CC',
    stripeSpring: '#E4EDD0',
    stripeSky: '#C9D3D2',
    inkSoft: '#5B4331',
    inkFaint: '#8A735C',
    tan: '#C8A47A',
    ochre: '#C38F2E',
    rose: '#C88C86',
    duskRose: '#E3B1A1',
    sage: '#94A47F',
    teal: '#3C8783',
    tealDeep: '#285F5D',
    sun: '#F1BF4A',
    night: '#2F2748',
    orange: '#D8742B',
    leaf: '#6E8F4F',
    wood: '#A8784C',
    sunset: '#E79D8F',
    dusk: '#5A4878',
    // 2.2b photo-doodle house colours, used by src/props.js; blush moved up
    paperMint: '#DCE7DC',
    paperPink: '#F2DCD8',
    paperButter: '#F1E5C2',
    paperSky: '#D7E3EE',
    paperCream: '#EEE5D4',
    paperLilac: '#DFD9EA',
    paperPeach: '#F2DDCA',
    paperSage: '#D9E0CE',
    paperNight: '#1C2340',
    doodleInk: '#26221D',
    chalk: '#F1EDE2',
    washYellow: '#F0C85F',
    washPink: '#EEA6A4',
    washBlue: '#9DC3DF',
    washGreen: '#A7C79A',
    washLilac: '#BFB2DC',
    washRed: '#D2685A',
    washCream: '#EFE1C2',
    washBrown: '#C09A6B',
    // 2.3 cool schematic palette (blueprint plate)
    navy: '#0B1230',
    navyDeep: '#060A1C',
    navyLight: '#18234D',
    grid: '#3A4A86',
    lavender: '#C8C1EF',
    lineWhite: '#EEF0FF',
    paleBlue: '#9CC2EA',
    glow: '#FFF3DC',
    magenta: '#FF3D98',
    // 2.4 overlay colours on illustrations
    annMagenta: '#E43D8C',
    annBlue: '#3B8EE0',
    annYellow: '#EAB530',
  };
  // earlier names kept as aliases
  pal.stripeA = pal.stripeCream;
  pal.stripeB = pal.stripeYellow;
  lib.pal = pal;

  const rgbCache = {};
  function parseColor(c) {
    if (rgbCache[c]) return rgbCache[c];
    let r = 0, g = 0, b = 0;
    if (c[0] === '#') {
      let h = c.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      const n = parseInt(h.slice(0, 6), 16);
      r = (n >> 16) & 255;
      g = (n >> 8) & 255;
      b = n & 255;
    } else {
      const m = c.match(/[\d.]+/g) || [0, 0, 0];
      r = +m[0];
      g = +m[1];
      b = +m[2];
    }
    return (rgbCache[c] = [r, g, b]);
  }
  lib.rgb = parseColor;
  /** rgba('#hex' or pal colour, alpha) : css string. */
  lib.rgba = (c, a = 1) => {
    const [r, g, b] = parseColor(c);
    return `rgba(${r},${g},${b},${a})`;
  };
  /** mix(colorA, colorB, t) : css string between two colours. */
  lib.mix = (a, b, t) => {
    const A = parseColor(a);
    const B = parseColor(b);
    return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
  };

  // ===========================================================================
  // Geometry helpers
  // ===========================================================================

  const XY = (p) => (Array.isArray(p) ? p : [p.x, p.y]);

  lib.ellipsePts = (cx, cy, rx, ry = rx, n = 64, rot = 0) => {
    const out = [];
    const cr = Math.cos(rot), sr = Math.sin(rot);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
    }
    return out;
  };
  lib.rectPts = (x, y, w, h, stepPx = 24) => {
    const out = [];
    const edge = (x0, y0, x1, y1) => {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / stepPx));
      for (let i = 0; i < n; i++) out.push([lerp(x0, x1, i / n), lerp(y0, y1, i / n)]);
    };
    edge(x, y, x + w, y);
    edge(x + w, y, x + w, y + h);
    edge(x + w, y + h, x, y + h);
    edge(x, y + h, x, y);
    return out;
  };
  lib.rrectPts = (x, y, w, h, r, stepPx = 24) => {
    r = Math.min(r, w / 2, h / 2);
    const out = [];
    const line = (x0, y0, x1, y1) => {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / stepPx));
      for (let i = 0; i < n; i++) out.push([lerp(x0, x1, i / n), lerp(y0, y1, i / n)]);
    };
    const corner = (cx, cy, a0) => {
      const n = Math.max(2, Math.ceil((r * Math.PI) / 2 / (stepPx * 0.5)));
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * (Math.PI / 2);
        out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    };
    line(x + r, y, x + w - r, y);
    corner(x + w - r, y + r, -Math.PI / 2);
    line(x + w, y + r, x + w, y + h - r);
    corner(x + w - r, y + h - r, 0);
    line(x + w - r, y + h, x + r, y + h);
    corner(x + r, y + h - r, Math.PI / 2);
    line(x, y + h - r, x, y + r);
    corner(x + r, y + r, Math.PI);
    return out;
  };
  /** capsulePts(cx, cy, length, radius, rot, n) : a stadium shape along its rotated long axis. */
  lib.capsulePts = (cx, cy, len, r, rot = 0, n = 72) => {
    const out = [];
    const half = Math.max(0, len / 2 - r);
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const k = Math.floor(n / 2);
    for (let i = 0; i <= k; i++) {
      const a = -Math.PI / 2 + (i / k) * Math.PI;
      const x = half + Math.cos(a) * r, y = Math.sin(a) * r;
      out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
    }
    for (let i = 0; i <= k; i++) {
      const a = Math.PI / 2 + (i / k) * Math.PI;
      const x = -half + Math.cos(a) * r, y = Math.sin(a) * r;
      out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
    }
    return out;
  };

  /** tracePath(ctx, pts, closed=true) : adds the polyline to the current path (no beginPath). */
  lib.tracePath = (ctx, pts, closed = true) => {
    for (let i = 0; i < pts.length; i++) {
      const p = XY(pts[i]);
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    }
    if (closed) ctx.closePath();
  };

  /**
   * Centripetal Catmull-Rom resample (no overshoot or cusps where long and short segments meet).
   * Returns a flat [x0,y0,x1,y1,...] array (closed: no duplicate end).
   */
  function sampleFlat(P, closed, step, smooth) {
    const n = P.length;
    const out = [];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p1 = P[i];
      const p2 = P[(i + 1) % n];
      const d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const k = Math.max(1, Math.ceil(d / step));
      if (!smooth || n < 3) {
        for (let j = 0; j < k; j++) out.push(lerp(p1[0], p2[0], j / k), lerp(p1[1], p2[1], j / k));
        continue;
      }
      let p0, p3;
      if (closed) {
        p0 = P[(i - 1 + n) % n];
        p3 = P[(i + 2) % n];
      } else {
        p0 = i > 0 ? P[i - 1] : [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]];
        p3 = i + 2 < n ? P[i + 2] : [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
      }
      const t1 = Math.sqrt(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])) || 1e-4;
      const t2 = t1 + (Math.sqrt(d) || 1e-4);
      const t3 = t2 + (Math.sqrt(Math.hypot(p3[0] - p2[0], p3[1] - p2[1])) || 1e-4);
      for (let j = 0; j < k; j++) {
        const t = t1 + (t2 - t1) * (j / k);
        const a1x = ((t1 - t) / t1) * p0[0] + (t / t1) * p1[0];
        const a1y = ((t1 - t) / t1) * p0[1] + (t / t1) * p1[1];
        const a2x = ((t2 - t) / (t2 - t1)) * p1[0] + ((t - t1) / (t2 - t1)) * p2[0];
        const a2y = ((t2 - t) / (t2 - t1)) * p1[1] + ((t - t1) / (t2 - t1)) * p2[1];
        const a3x = ((t3 - t) / (t3 - t2)) * p2[0] + ((t - t2) / (t3 - t2)) * p3[0];
        const a3y = ((t3 - t) / (t3 - t2)) * p2[1] + ((t - t2) / (t3 - t2)) * p3[1];
        const b1x = ((t2 - t) / t2) * a1x + (t / t2) * a2x;
        const b1y = ((t2 - t) / t2) * a1y + (t / t2) * a2y;
        const b2x = ((t3 - t) / (t3 - t1)) * a2x + ((t - t1) / (t3 - t1)) * a3x;
        const b2y = ((t3 - t) / (t3 - t1)) * a2y + ((t - t1) / (t3 - t1)) * a3y;
        out.push(((t2 - t) / (t2 - t1)) * b1x + ((t - t1) / (t2 - t1)) * b2x, ((t2 - t) / (t2 - t1)) * b1y + ((t - t1) / (t2 - t1)) * b2y);
      }
    }
    if (!closed) out.push(P[n - 1][0], P[n - 1][1]);
    return out;
  }

  /** smoothPts(pts, closed, step=6) : Catmull-Rom resampled points as [[x,y],...]. */
  lib.smoothPts = (pts, closed = true, step = 6) => {
    const f = sampleFlat(pts.map(XY), closed, step, true);
    const out = [];
    for (let i = 0; i < f.length; i += 2) out.push([f[i], f[i + 1]]);
    return out;
  };

  function toPolys(clip) {
    if (!Array.isArray(clip) || !clip.length) return null;
    const first = clip[0];
    if (Array.isArray(first) && typeof first[0] === 'number') return [clip];
    if (first && typeof first.x === 'number') return [clip.map(XY)];
    return clip.map((poly) => poly.map(XY));
  }

  /** polyContains(pointsOrPolys, x, y) : even-odd point-in-polygon. */
  function polysContain(polys, x, y) {
    let inside = false;
    for (let p = 0; p < polys.length; p++) {
      const poly = polys[p];
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
    return inside;
  }
  lib.polyContains = (clip, x, y) => polysContain(toPolys(clip), x, y);

  function polysBounds(polys) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const poly of polys) {
      for (const p of poly) {
        if (p[0] < x0) x0 = p[0];
        if (p[1] < y0) y0 = p[1];
        if (p[0] > x1) x1 = p[0];
        if (p[1] > y1) y1 = p[1];
      }
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  lib.bounds = (pts) => polysBounds(toPolys(pts));

  function normBounds(b) {
    if (!b) return { x: 0, y: 0, w: W(), h: H() };
    if (Array.isArray(b)) return { x: b[0], y: b[1], w: b[2], h: b[3] };
    return b;
  }

  /** Resolves a clip argument into { polys, bounds, hard(ctx) }. */
  function shapeOf(clip, o) {
    const polys = toPolys(clip);
    if (polys) {
      const b = polysBounds(polys);
      const pad = o.pad != null ? o.pad : 0;
      return {
        polys,
        bounds: { x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad },
        apply(ctx) {
          ctx.beginPath();
          for (const poly of polys) lib.tracePath(ctx, poly, true);
          ctx.clip('evenodd');
        },
      };
    }
    const bounds = normBounds(o.bounds);
    if (typeof clip === 'function') {
      return { polys: null, bounds, apply(ctx) { ctx.beginPath(); clip(ctx); ctx.clip(o.fillRule || 'nonzero'); } };
    }
    if (typeof Path2D !== 'undefined' && clip instanceof Path2D) {
      return { polys: null, bounds, apply(ctx) { ctx.clip(clip, o.fillRule || 'nonzero'); } };
    }
    return { polys: null, bounds, apply: null };
  }

  // ===========================================================================
  // Canvas cache (pure: keyed by every input, LRU)
  // ===========================================================================

  // Sized from the timeline (read lazily: lib loads before timeline.js) so a looping player keeps
  // every shot's paper or blueprint plate warm and does not rebuild one at each shot change.
  const cache = new Map();
  function cacheMax() {
    const tl = FILM.TIMELINE;
    const shots = tl && Array.isArray(tl.shots) ? tl.shots.length : 0;
    return Math.max(24, shots * 2 + 8);
  }
  function cached(key, make) {
    if (cache.has(key)) {
      const v = cache.get(key);
      cache.delete(key);
      cache.set(key, v);
      return v;
    }
    const v = make();
    cache.set(key, v);
    const max = cacheMax();
    while (cache.size > max) cache.delete(cache.keys().next().value);
    return v;
  }
  function newCanvas(w, h) {
    if (FILM.makeCanvas) return FILM.makeCanvas(w, h);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  lib.cached = cached;

  // ===========================================================================
  // Ink lines
  // ===========================================================================

  /*
   * One stroke pass over a resampled centreline (flat arrays X, Y with normals NX, NY and
   * arc length S). Builds a pressure-width ribbon out of quads so every overlap unions cleanly,
   * and fills it in one call.
   */
  function ribbon(ctx, X, Y, NX, NY, S, i0, i1, q) {
    const n = i1 - i0 + 1;
    if (n < 2) return null;
    const s0 = S[i0];
    const L = Math.max(1e-6, S[i1] - s0);
    const DX = new Float64Array(n);
    const DY = new Float64Array(n);
    const bs = q.boilSeed;
    const wf = q.wobbleFreq;
    for (let k = 0; k < n; k++) {
      const i = i0 + k;
      const s = S[i] - s0 + q.phase;
      let d =
        q.wobble * (0.72 * noise1(s * wf, q.seed) + 0.28 * noise1(s * wf * 3.3, q.seed + 1)) +
        q.tremble * noise1(s / 7.5, q.seed + 2) +
        q.boilAmp * noise1(s * wf * 2.2 + 0.37, bs) +
        q.tremble * 0.7 * noise1(s / 6.3, bs + 5) +
        q.offset;
      if (q.closeBlend > 0 && S[i1] - S[i] < q.closeBlend) {
        // pen returning to the start: pull toward the start's displacement, not all the way
        const u = 1 - (S[i1] - S[i]) / q.closeBlend;
        const s2 = s - q.loopLen;
        const d0 =
          q.wobble * (0.72 * noise1(s2 * wf, q.seed) + 0.28 * noise1(s2 * wf * 3.3, q.seed + 1)) +
          q.boilAmp * noise1(s2 * wf * 2.2 + 0.37, bs) +
          q.offset;
        d = lerp(d, d0, u * u * (3 - 2 * u) * 0.8);
      }
      DX[k] = X[i] + NX[i] * d;
      DY[k] = Y[i] + NY[i] * d;
    }
    // width profile
    const Wd = new Float64Array(n);
    const tIn = Math.min(q.taperIn, L * 0.45);
    const tOut = Math.min(q.taperOut, L * 0.45);
    for (let k = 0; k < n; k++) {
      const s = S[i0 + k] - s0;
      let w = q.width;
      if (tIn > 0 && s < tIn) w *= q.minW + (1 - q.minW) * Math.pow(s / tIn, 0.55);
      if (tOut > 0 && L - s < tOut) w *= q.minW + (1 - q.minW) * Math.pow((L - s) / tOut, 0.7);
      w *= 1 + q.widthJitter * (0.6 * noise1(s * 0.012 + 3.1, q.seed + 3) + 0.4 * noise1(s * 0.045, q.seed + 4));
      if (q.swell) w *= 1 + q.swell * Math.sin(Math.PI * clamp(s / L));
      if (q.pressure) w *= q.pressure(s / L);
      Wd[k] = Math.max(0.05, w) * 0.5;
    }
    // offset normals from the displaced line
    const LX = new Float64Array(n), LY = new Float64Array(n), RX = new Float64Array(n), RY = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      const a = k > 0 ? k - 1 : k;
      const b = k < n - 1 ? k + 1 : k;
      let tx = DX[b] - DX[a], ty = DY[b] - DY[a];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const s = S[i0 + k];
      const wl = Math.max(0.03, Wd[k] + q.rough * noise1(s / 3.1, q.seed + 20));
      const wr = Math.max(0.03, Wd[k] + q.rough * noise1(s / 3.1, q.seed + 21));
      LX[k] = DX[k] - ty * wl;
      LY[k] = DY[k] + tx * wl;
      RX[k] = DX[k] + ty * wr;
      RY[k] = DY[k] - tx * wr;
    }
    ctx.beginPath();
    for (let k = 0; k < n - 1; k++) {
      ctx.moveTo(LX[k], LY[k]);
      ctx.lineTo(LX[k + 1], LY[k + 1]);
      ctx.lineTo(RX[k + 1], RY[k + 1]);
      ctx.lineTo(RX[k], RY[k]);
      ctx.closePath();
    }
    // soft round ends, wound the same way as the quads (counter-clockwise on screen): a cap wound the
    // other way cancels the quads under it and leaves a hole at each end of a blunt stroke
    ctx.moveTo(DX[0] + Wd[0], DY[0]);
    ctx.arc(DX[0], DY[0], Wd[0], 0, TAU, true);
    ctx.moveTo(DX[n - 1] + Wd[n - 1], DY[n - 1]);
    ctx.arc(DX[n - 1], DY[n - 1], Wd[n - 1], 0, TAU, true);
    ctx.fill('nonzero');
    return { DX, DY };
  }

  function centreline(pts, closed, step, smooth, startFrac, overlapPx) {
    const P = pts.map(XY);
    let F = sampleFlat(P, closed, step, smooth);
    let m = F.length / 2;
    let loopLen = 0;
    if (closed && m > 2) {
      // rotate so the pen starts at a seeded place, then run past the start
      const st = Math.floor(startFrac * m) % m;
      const R = new Array(F.length);
      for (let k = 0; k < m; k++) {
        R[2 * k] = F[2 * ((k + st) % m)];
        R[2 * k + 1] = F[2 * ((k + st) % m) + 1];
      }
      for (let k = 0; k < m; k++) loopLen += Math.hypot(R[(2 * (k + 1)) % R.length] - R[2 * k], R[((2 * (k + 1)) % R.length) + 1] - R[2 * k + 1]);
      R.push(R[0], R[1]);
      let acc = 0;
      for (let k = 1; k <= m && acc < overlapPx; k++) {
        const x = R[2 * (k % m)], y = R[2 * (k % m) + 1];
        acc += Math.hypot(x - R[R.length - 2], y - R[R.length - 1]);
        R.push(x, y);
      }
      F = R;
      m = F.length / 2;
    }
    const X = new Float64Array(m), Y = new Float64Array(m), S = new Float64Array(m);
    for (let k = 0; k < m; k++) {
      X[k] = F[2 * k];
      Y[k] = F[2 * k + 1];
      if (k > 0) S[k] = S[k - 1] + Math.hypot(X[k] - X[k - 1], Y[k] - Y[k - 1]);
    }
    const NX = new Float64Array(m), NY = new Float64Array(m);
    for (let k = 0; k < m; k++) {
      const a = Math.max(0, k - 2), b = Math.min(m - 1, k + 2);
      let tx = X[b] - X[a], ty = Y[b] - Y[a];
      const tl = Math.hypot(tx, ty) || 1;
      NX[k] = -ty / tl;
      NY[k] = tx / tl;
    }
    return { X, Y, S, NX, NY, m, loopLen };
  }

  /**
   * inkPath(ctx, points, opts) : a hand-inked line or closed shape.
   *   closed      false
   *   width       3        nominal pen width (art bible: hero 5, secondary 3, detail 1.8)
   *   color       pal.ink
   *   alpha       1
   *   seed        1        give each drawn object its own seed so their wobbles differ
   *   smooth      true     Catmull-Rom through the points (false = straight segments)
   *   step        2.5      resample spacing in px
   *   wobble      2        low-frequency drift amplitude (px)
   *   wobbleFreq  1/150    drift frequency (cycles per px)
   *   tremble     0.4      high-frequency hand tremble (px)
   *   rough       0.22+0.07*width  ragged ink edge (px), each side independent
   *   boil        off      true boils on lib.boil(lib.T), a number is a drawing index; off by default in this film
   *   boilAmp     0.7      how far the line moves between boil drawings (px)
   *   taper       [18,34]  px of taper at start and end (number = both)
   *   minWidth    0.14     width fraction at the very tips
   *   swell       0.2      extra width through the middle of an open stroke
   *   widthJitter 0.34     pressure variation (slow plus a faster drag)
   *   pressure    null     fn(u 0..1) => width multiplier
   *   overlap     14       closed shapes: how far the pen runs past its start (px)
   *   fill        null     closed shapes: fill colour under the line (uses the wobbled outline)
   *   fillAlpha   1
   *   draw        1        draw-on progress 0..1 along the stroke (0 draws nothing; a fill waits for 1)
   *   double      false    true or { offset, width, alpha, from, to, seed }: a second quick retrace
   *                        (defaults: 30 percent of the width, min 1.5 px at 5 px, 3 px clear of the line, alpha 0.4)
   */
  function inkPath(ctx, pts, o = {}) {
    if (!pts || pts.length < 2) return;
    const drawP = o.draw == null ? 1 : clamp(o.draw);
    if (drawP <= 0) return;
    const closed = !!o.closed;
    const seed = seedInt(o.seed === undefined ? 1 : o.seed);
    const width = o.width != null ? o.width : 3;
    const step = o.step || 2.5;
    const smooth = o.smooth !== false;
    const taper = o.taper != null ? o.taper : closed ? [10, 22] : [18, 34];
    const tIn = Array.isArray(taper) ? taper[0] : taper;
    const tOut = Array.isArray(taper) ? taper[1] : taper;
    const overlap = closed ? (o.overlap != null ? o.overlap : 14) : 0;
    const C = centreline(pts, closed, step, smooth, closed ? h3(seed, 11, 3) : 0, overlap);
    if (C.m < 2) return;
    const b = boilIndex(o);
    const q = {
      seed,
      width,
      wobble: o.wobble != null ? o.wobble : 2,
      wobbleFreq: o.wobbleFreq || 1 / 150,
      tremble: o.tremble != null ? o.tremble : 0.4,
      rough: o.rough != null ? o.rough : 0.22 + width * 0.07,
      boilAmp: boilOff(o) ? 0 : o.boilAmp != null ? o.boilAmp : 0.7,
      boilSeed: (hash(seed, b) | 0) & 0x7fffffff,
      taperIn: tIn,
      taperOut: tOut,
      minW: o.minWidth != null ? o.minWidth : 0.14,
      swell: closed ? 0 : o.swell != null ? o.swell : 0.2,
      widthJitter: o.widthJitter != null ? o.widthJitter : 0.34,
      pressure: o.pressure || null,
      offset: 0,
      phase: 0,
      closeBlend: closed ? Math.min(60, C.loopLen * 0.25) + overlap : 0,
      loopLen: C.loopLen,
    };
    let iEnd = C.m - 1;
    if (drawP < 1) {
      // stop the pen partway along the centreline; a partial closed shape gets no fill and no
      // close-blend, and its tip is blunt rather than tapered to nothing
      const Lp = C.S[C.m - 1] * drawP;
      while (iEnd > 1 && C.S[iEnd] > Lp) iEnd--;
      q.closeBlend = 0;
      q.taperOut = Math.min(q.taperOut, 6);
    }
    ctx.save();
    const color = o.color || pal.ink;
    const alpha = o.alpha != null ? o.alpha : 1;
    if (closed && o.fill && drawP >= 1) {
      // fill follows the wobbled outline (without the overlap run)
      const F = ribbonLine(C, q, 0, Math.max(1, C.m - 1));
      ctx.beginPath();
      for (let k = 0; k < F.n; k++) {
        if (C.S[k] > C.loopLen) break;
        if (k === 0) ctx.moveTo(F.DX[k], F.DY[k]);
        else ctx.lineTo(F.DX[k], F.DY[k]);
      }
      ctx.closePath();
      ctx.globalAlpha *= o.fillAlpha != null ? o.fillAlpha : 1;
      ctx.fillStyle = o.fill;
      ctx.fill();
      ctx.restore();
      ctx.save();
    }
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    ribbon(ctx, C.X, C.Y, C.NX, C.NY, C.S, 0, iEnd, q);
    if (o.double && drawP >= 1) {
      const d = o.double === true ? {} : o.double;
      const ds = seedInt(d.seed != null ? d.seed : seed + 977);
      const r = rng(ds);
      const L = C.S[C.m - 1];
      let f0 = d.from != null ? d.from : closed ? r.range(0, 0.35) : r.range(0.03, 0.18);
      let f1 = d.to != null ? d.to : closed ? f0 + r.range(0.45, 0.75) : r.range(0.72, 0.95);
      f1 = Math.min(1, f1);
      let i0 = 0, i1 = C.m - 1;
      while (i0 < C.m - 1 && C.S[i0] < f0 * L) i0++;
      while (i1 > i0 && C.S[i1] > f1 * L) i1--;
      const q2 = Object.assign({}, q, {
        seed: ds,
        width: d.width != null ? width * d.width : Math.max(1.2, width * 0.3),
        rough: 0.15 + (d.width != null ? width * d.width : Math.max(1.2, width * 0.3)) * 0.07,
        offset: d.offset != null ? d.offset : (width / 2 + 3) * (r() < 0.5 ? -1 : 1),
        wobble: q.wobble * 1.3,
        boilSeed: (hash(ds, b) | 0) & 0x7fffffff,
        taperIn: Math.max(tIn, 26),
        taperOut: Math.max(tOut, 40),
        closeBlend: 0,
        swell: 0.35,
      });
      ctx.globalAlpha *= d.alpha != null ? d.alpha : 0.4;
      ribbon(ctx, C.X, C.Y, C.NX, C.NY, C.S, i0, i1, q2);
    }
    ctx.restore();
  }

  // displaced centreline only (for fills)
  function ribbonLine(C, q, i0, i1) {
    const n = i1 - i0 + 1;
    const DX = new Float64Array(n), DY = new Float64Array(n);
    const wf = q.wobbleFreq;
    for (let k = 0; k < n; k++) {
      const i = i0 + k;
      const s = C.S[i];
      const d =
        q.wobble * (0.72 * noise1(s * wf, q.seed) + 0.28 * noise1(s * wf * 3.3, q.seed + 1)) +
        q.boilAmp * noise1(s * wf * 2.2 + 0.37, q.boilSeed);
      DX[k] = C.X[i] + C.NX[i] * d;
      DY[k] = C.Y[i] + C.NY[i] * d;
    }
    return { DX, DY, n };
  }

  lib.inkPath = inkPath;

  // ===========================================================================
  // Photo-doodle mode: watercolour wash, photo cut-outs, handwriting
  // Inert in a zero-asset film — nothing below is called unless a scene calls it.
  // ===========================================================================

  /**
   * wash(ctx, pts, opts) : a translucent watercolour fill that deliberately misses its outline.
   *   color      pal.washYellow or pal.sunYellow   alpha 0.55   seed 1
   *   offset     [4, 3]   px shift off the ink outline (the mis-registration is the look)
   *   spread     3        px of edge wobble   p 1   fade-in 0..1 (the wash arrives after its outline)
   *   edge       0.35     darker pigment rim strength (0 = none)
   */
  lib.wash = (ctx, pts, o = {}) => {
    const p = o.p == null ? 1 : clamp(o.p);
    if (p <= 0 || !pts || pts.length < 3) return;
    const seed = seedInt(o.seed == null ? 1 : o.seed);
    const off = o.offset || [4, 3];
    const spread = o.spread != null ? o.spread : 3;
    const color = o.color || pal.washYellow || pal.sunYellow || pal.ink;
    const sm = lib.smoothPts(pts, true, 5);
    const n = sm.length;
    let cx = 0, cy = 0;
    for (const q of sm) { cx += q[0]; cy += q[1]; }
    cx /= n; cy /= n;
    const ring = (amp, sd) => {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const [x, y] = sm[i];
        const dx = x - cx, dy = y - cy, dl = Math.hypot(dx, dy) || 1;
        const d = amp * noise1(i * 0.09, sd) + amp * 0.4 * noise1(i * 0.31, sd + 7);
        const X = x + off[0] + (dx / dl) * d, Y = y + off[1] + (dy / dl) * d;
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.closePath();
    };
    ctx.save();
    ctx.globalAlpha *= (o.alpha != null ? o.alpha : 0.55) * p;
    ctx.fillStyle = color;
    ring(spread, seed);
    ctx.fill();
    const edge = o.edge != null ? o.edge : 0.35;
    if (edge > 0) {
      ctx.globalAlpha *= edge;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ring(spread * 1.2, seed + 3);
      ctx.stroke();
    }
    ctx.restore();
  };

  /**
   * photo(ctx, id, cx, baseY, opts) : a background-removed photograph standing on the paper, with a
   * soft contact shadow. Positioned by bottom-centre, so objects sit on a floor line.
   *   h (height px, default 620) or w   rot 0 (radians, about the base centre)   scale 1 (pop-in)
   *   shadow 0.38 (contact shadow alpha, 0 = none)   alpha 1
   * Returns { x, y, w, h } of the unscaled, unrotated placement — anchor doodles off this rather
   * than off guessed pixels. Returns null when the id is not in FILM.PHOTOS.
   *
   * One caution the gate will catch late: drawing the SAME photo at two different sizes in one page
   * can resample differently once the browser has a texture history for it, which reads as
   * non-determinism. If a film needs a photo at two sizes (an end-card grid of every shot), draw the
   * small one through an offscreen canvas at 1:1 instead of scaling it live.
   */
  lib.photo = (ctx, id, cx, baseY, o = {}) => {
    const F = typeof window !== 'undefined' ? window.FILM : globalThis.FILM;
    const img = F && F.photo ? F.photo(id) : null;
    const meta = F && F.PHOTOS ? F.PHOTOS[id] : null;
    if (!img || !meta) return null;
    const h = o.w != null ? (o.w * meta.h) / meta.w : o.h != null ? o.h : 620;
    const w = (h * meta.w) / meta.h;
    const box = { x: cx - w / 2, y: baseY - h, w, h };
    const sc = o.scale != null ? o.scale : 1;
    if (sc <= 0) return box;
    ctx.save();
    ctx.globalAlpha *= o.alpha != null ? o.alpha : 1;
    const sh = o.shadow != null ? o.shadow : 0.38;
    if (sh > 0) {
      const g = ctx.createRadialGradient(cx, baseY, 0, cx, baseY, w * 0.62 * sc);
      g.addColorStop(0, `rgba(48,36,24,${sh})`);
      g.addColorStop(0.55, `rgba(48,36,24,${sh * 0.42})`);
      g.addColorStop(1, 'rgba(48,36,24,0)');
      ctx.save();
      ctx.translate(cx, baseY);
      ctx.scale(1, 0.14);
      ctx.translate(-cx, -baseY);
      ctx.fillStyle = g;
      ctx.fillRect(cx - w, baseY - w, w * 2, w * 2);
      ctx.restore();
    }
    ctx.translate(cx, baseY);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(sc, sc);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
    return box;
  };

  /**
   * hand(ctx, str, x, y, opts) : handwritten marker lettering in a system hand face (no font files),
   * revealed letter by letter with p. Weights above 700 fall out of the hand faces onto a geometric
   * fallback, so they are clamped.
   */
  lib.hand = (ctx, str, x, y, o = {}) => {
    const q = Object.assign({ size: 46, color: pal.ink }, o);
    q.family = HAND_STACK;
    q.weight = Math.min(700, Number(q.weight) || 400);
    return lib.text(ctx, str, x, y, q);
  };
  lib.inkLine = (ctx, x1, y1, x2, y2, o = {}) => inkPath(ctx, [[x1, y1], [x2, y2]], Object.assign({ smooth: false }, o));
  lib.inkCircle = (ctx, cx, cy, r, o = {}) =>
    inkPath(ctx, lib.ellipsePts(cx, cy, r, o.ry != null ? o.ry : r, Math.max(24, Math.ceil(r * 0.6)), o.rot || 0), Object.assign({ closed: true }, o));
  lib.inkLine = (ctx, x1, y1, x2, y2, o = {}) => inkPath(ctx, [[x1, y1], [x2, y2]], Object.assign({ smooth: false }, o));
  lib.inkCircle = (ctx, cx, cy, r, o = {}) =>
    inkPath(ctx, lib.ellipsePts(cx, cy, r, o.ry != null ? o.ry : r, Math.max(24, Math.ceil(r * 0.6)), o.rot || 0), Object.assign({ closed: true }, o));

  // ===========================================================================
  // Hatching
  // ===========================================================================

  /**
   * hatch(ctx, clip, opts) : parallel pen strokes that build tone inside a shape.
   *   angle        -PI/4    stroke direction (radians): 45 degrees rising left to right
   *   spacing      8        px between rows at full density (art bible: 12 light, 8 mid, 5 dark)
   *   width        1.4      pen width (art bible: 1.2 to 1.8)
   *   color        pal.ink
   *   alpha        0.9
   *   density      1        0..1, or fn(x, y) => 0..1. Rows drop out evenly as density falls and
   *                         stroke ends stagger along the tone edge, like a hand building shade.
   *   length       [16,64]  stroke length range (px)
   *   gap          [2,7]    px between strokes along a row
   *   inset        6        polygons: how far a stroke may stop short of the edge
   *   overshoot    3        polygons: how far a stroke may cross the edge
   *   angleJitter  0.052    per stroke (+-3 degrees)
   *   spacingJitter 0.3     fraction of spacing (+-15 percent)
   *   flow         0.05     slow angle drift across the rows (radians)
   *   bow          0.7      random sideways bow per stroke (px)
   *   bend         0        consistent bow (px), follows a rounded form
   *   taper        0.3      width at the flick end (fraction)
   *   edge         0.12     how ragged the tone edge is (threshold noise)
   *   boilAmp      0.45     endpoint shimmer per boil drawing (px)
   *   clip         false    polygons: also hard-clip to the polygon
   *   bounds       frame    area to fill when clip is a function, Path2D or null
   *   seed         7
   */
  const PHI = 0.6180339887498949;
  function hatch(ctx, clip, o = {}) {
    const shape = shapeOf(clip, o);
    const seed = seedInt(o.seed === undefined ? 7 : o.seed);
    const r = rng(seed);
    const angle = o.angle != null ? o.angle : -Math.PI / 4;
    const spacing = Math.max(0.8, o.spacing || 8);
    const width = o.width != null ? o.width : 1.4;
    const density = o.density != null ? o.density : 1;
    const densFn = typeof density === 'function' ? density : null;
    const len = o.length || [16, 64];
    const gap = o.gap || [2, 7];
    const inset = o.inset != null ? o.inset : 6;
    const over = o.overshoot != null ? o.overshoot : 3;
    const aJ = o.angleJitter != null ? o.angleJitter : 0.052;
    const sJ = o.spacingJitter != null ? o.spacingJitter : 0.3;
    const flow = o.flow != null ? o.flow : 0.05;
    const bow = o.bow != null ? o.bow : 0.7;
    const bend = o.bend || 0;
    const taper = o.taper != null ? o.taper : 0.3;
    const edgeN = o.edge != null ? o.edge : 0.12;
    const boilAmp = boilOff(o) ? 0 : o.boilAmp != null ? o.boilAmp : 0.45;
    const bi = boilIndex(o);
    const minLen = Math.max(2, Math.min(len[0] * 0.35, 6));
    const probe = Math.max(3, Math.min(8, len[0] * 0.4));
    const phase = h3(seed, 3, 9);

    const dx = Math.cos(angle), dy = Math.sin(angle);
    const nx = -dy, ny = dx;
    const B = shape.bounds;
    const corners = [[B.x, B.y], [B.x + B.w, B.y], [B.x, B.y + B.h], [B.x + B.w, B.y + B.h]];
    let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
    for (const c of corners) {
      const u = c[0] * dx + c[1] * dy, v = c[0] * nx + c[1] * ny;
      if (u < umin) umin = u;
      if (u > umax) umax = u;
      if (v < vmin) vmin = v;
      if (v > vmax) vmax = v;
    }

    let edges = null;
    if (shape.polys) {
      edges = [];
      for (const poly of shape.polys) {
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const a = poly[j], b = poly[i];
          edges.push(a[0] * dx + a[1] * dy, a[0] * nx + a[1] * ny, b[0] * dx + b[1] * dy, b[0] * nx + b[1] * ny);
        }
      }
    }

    const paths = [new Path2D(), new Path2D(), new Path2D()];
    const spans = [];
    const on = [];
    const xs = [];
    let strokeId = 0;

    const emit = (u, ue, v, row, dAt) => {
      const sl = ue - u;
      const um = (u + ue) / 2;
      const mx = um * dx + v * nx, my = um * dy + v * ny;
      const ja = aJ * (r() * 2 - 1) + (flow ? flow * noise1(row * 0.09, seed + 5) : 0);
      const bw = bend + bow * (r() * 2 - 1);
      const wv = width * lerp(0.78, 1.18, r()) * lerp(0.72, 1, dAt);
      const p = paths[(r() * 3) | 0];
      const sid = strokeId++;
      const ca = Math.cos(angle + ja), sa = Math.sin(angle + ja);
      const half = sl / 2;
      const jb0 = boilAmp ? (h3(sid, row, bi + seed) - 0.5) * 2 * boilAmp : 0;
      const jb1 = boilAmp ? (h3(row, sid, bi + seed + 9) - 0.5) * 2 * boilAmp : 0;
      const pnx = -sa, pny = ca;
      const x0 = mx - ca * half + pnx * jb0, y0 = my - sa * half + pny * jb0;
      const x1 = mx + ca * (half + jb1 * 0.6) + pnx * jb1, y1 = my + sa * (half + jb1 * 0.6) + pny * jb1;
      const w0 = wv * 0.42, w1 = wv * taper * 0.5, wm = wv * 0.5;
      const k = (w0 + w1) * 0.5;
      const cx = mx + pnx * bw * 2, cy = my + pny * bw * 2;
      p.moveTo(x0 + pnx * w0, y0 + pny * w0);
      p.quadraticCurveTo(cx + pnx * (wm * 2 - k), cy + pny * (wm * 2 - k), x1 + pnx * w1, y1 + pny * w1);
      p.lineTo(x1 - pnx * w1, y1 - pny * w1);
      p.quadraticCurveTo(cx - pnx * (wm * 2 - k), cy - pny * (wm * 2 - k), x0 - pnx * w0, y0 - pny * w0);
      p.closePath();
    };

    const breakUp = (a, b, v, row, dAt) => {
      let u = a;
      while (u < b - minLen) {
        let ue = Math.min(u + lerp(len[0], len[1], r()), b);
        if (b - ue < minLen) ue = b;
        if (ue - u >= minLen) emit(u, ue, v, row, dAt);
        u = ue + lerp(gap[0], gap[1], r());
      }
    };

    let row = 0;
    for (let v0 = vmin + spacing * r(); v0 <= vmax; v0 += spacing, row++) {
      const v = v0 + (r() - 0.5) * spacing * sJ;
      // evenly distributed per-row threshold: rows vanish uniformly as density falls
      const rowTh = ((row * PHI + phase) % 1) * 0.94 + 0.03;
      spans.length = 0;
      if (edges) {
        xs.length = 0;
        for (let e = 0; e < edges.length; e += 4) {
          const va = edges[e + 1], vb = edges[e + 3];
          if ((va > v) !== (vb > v)) xs.push(edges[e] + ((v - va) / (vb - va)) * (edges[e + 2] - edges[e]));
        }
        if (xs.length < 2) continue;
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) spans.push(xs[k], xs[k + 1]);
      } else {
        spans.push(umin, umax);
      }
      if (!densFn && density < rowTh) continue;
      const dConst = densFn ? 1 : clamp(density);
      for (let sp = 0; sp < spans.length; sp += 2) {
        let u0 = spans[sp], u1 = spans[sp + 1];
        if (edges) {
          u0 += lerp(-over, inset, r() * r());
          u1 -= lerp(-over, inset, r() * r());
        } else {
          u0 -= r() * len[1];
        }
        if (u1 - u0 < minLen) continue;
        if (!densFn) {
          breakUp(u0, u1, v, row, dConst);
          continue;
        }
        // walk the row; strokes live where density beats the (slightly noisy) row threshold
        on.length = 0;
        let start = null;
        let dSum = 0, dN = 0;
        for (let u = u0; ; u += probe) {
          const uu = Math.min(u, u1);
          const d = clamp(densFn(uu * dx + v * nx, uu * dy + v * ny));
          const th = rowTh + edgeN * noise1(uu * 0.02 + row * 7.31, seed + 11);
          if (d > th) {
            if (start === null) start = uu;
            dSum += d;
            dN++;
          } else if (start !== null) {
            on.push(start, uu, dSum / dN);
            start = null;
            dSum = dN = 0;
          }
          if (uu >= u1) break;
        }
        if (start !== null) on.push(start, u1, dSum / Math.max(1, dN));
        for (let k = 0; k < on.length; k += 3) {
          // soften where the tone edge cuts a stroke
          const a = on[k] === u0 ? on[k] : on[k] + (r() - 0.5) * probe;
          const b = on[k + 1] === u1 ? on[k + 1] : on[k + 1] + (r() - 0.5) * probe;
          breakUp(a, b, v, row, on[k + 2]);
        }
      }
    }

    ctx.save();
    if (shape.apply && (!shape.polys || o.clip)) shape.apply(ctx);
    ctx.fillStyle = o.color || pal.ink;
    const alpha = o.alpha != null ? o.alpha : 0.9;
    const A = [0.74, 0.88, 1];
    const base = ctx.globalAlpha;
    for (let k = 0; k < 3; k++) {
      ctx.globalAlpha = base * alpha * A[k];
      ctx.fill(paths[k]);
    }
    ctx.restore();
  }
  lib.hatch = hatch;

  /**
   * crossHatch(ctx, clip, opts) : layered hatching where each extra layer only covers darker tone.
   *   tone     1       0..1 overall darkness (with no density, 0.25 = one layer, 1 = four)
   *   layers   2 (4 when tone is given)  maximum layer count
   *   density  1 or fn(x,y) => 0..1: local darkness; layer i appears where density*tone*layers > i
   *   angle    -PI/4   first layer angle (45 degrees); later layers turn by opts.turn
   *   turn     [-PI/3, 0.3, -1.35]  offsets for layers 2..4: layer 2 at 105 degrees, 3 and 4 thicken 1 and 2
   *   crossSpacing  spacing*1.4  spacing of layers 2..4 (art bible: 5 px base, 7 px cross)
   *   ...all hatch options
   */
  function crossHatch(ctx, clip, o = {}) {
    const layers = o.layers || (o.tone != null ? 4 : 2);
    const tone = o.tone != null ? clamp(o.tone) : 1;
    const d = o.density != null ? o.density : 1;
    const base = o.angle != null ? o.angle : -Math.PI / 4;
    const turn = o.turn || [-Math.PI / 3, 0.3, -1.35];
    const seed = seedInt(o.seed === undefined ? 11 : o.seed);
    for (let i = 0; i < layers; i++) {
      let dens;
      if (typeof d === 'function') {
        dens = (x, y) => clamp(d(x, y) * tone * layers - i);
      } else {
        dens = clamp(d * tone * layers - i);
        if (dens <= 0) break;
      }
      hatch(
        ctx,
        clip,
        Object.assign({}, o, {
          angle: base + (i === 0 ? 0 : turn[(i - 1) % turn.length]),
          seed: seed + i * 7919,
          density: dens,
          spacing: i === 0 ? o.spacing || 8 : o.crossSpacing || (o.spacing || 8) * 1.4,
        })
      );
    }
  }
  lib.crossHatch = crossHatch;

  // ===========================================================================
  // Stipple
  // ===========================================================================

  /**
   * stipple(ctx, clip, opts) : seeded dots on a jittered hex grid.
   *   spacing  7.5      mean px between dots at density 1 (about 0.02 dots per px2)
   *   r        [1.0, 2.2] dot radius range (bigger where density is higher)
   *   density  1 or fn(x,y) => 0..1
   *   jitter   0.45     fraction of spacing
   *   color    pal.ink
   *   alpha    0.9
   *   boilAmp  0.35     px shimmer per boil drawing
   *   clip     true     polygons: skip dots outside; functions/Path2D always hard-clip
   *   seed     13
   */
  function stipple(ctx, clip, o = {}) {
    const shape = shapeOf(clip, o);
    const seed = seedInt(o.seed === undefined ? 13 : o.seed);
    const sp = Math.max(1, o.spacing || 7.5);
    const rr = o.r || [1.0, 2.2];
    const density = o.density != null ? o.density : 1;
    const densFn = typeof density === 'function' ? density : null;
    const jit = (o.jitter != null ? o.jitter : 0.45) * sp;
    const boilAmp = boilOff(o) ? 0 : o.boilAmp != null ? o.boilAmp : 0.35;
    const bi = boilIndex(o);
    const B = shape.bounds;
    const rowH = sp * 0.866;
    const p = new Path2D();
    const i0 = Math.floor(B.y / rowH) - 1, i1 = Math.ceil((B.y + B.h) / rowH) + 1;
    const j0 = Math.floor(B.x / sp) - 1, j1 = Math.ceil((B.x + B.w) / sp) + 1;
    for (let i = i0; i <= i1; i++) {
      const off = i & 1 ? sp * 0.5 : 0;
      for (let j = j0; j <= j1; j++) {
        const a = h3(i, j, seed);
        const b = h3(j, i, seed + 1);
        const c = h3(i + 7, j - 3, seed + 2);
        let x = j * sp + off + (a - 0.5) * 2 * jit;
        let y = i * rowH + (b - 0.5) * 2 * jit;
        if (x < B.x || x > B.x + B.w || y < B.y || y > B.y + B.h) continue;
        const dAt = densFn ? clamp(densFn(x, y)) : density;
        if (c >= dAt) continue;
        if (shape.polys && !polysContain(shape.polys, x, y)) continue;
        if (boilAmp) {
          x += (h3(i, j, seed + bi * 31 + 5) - 0.5) * 2 * boilAmp;
          y += (h3(j, i, seed + bi * 37 + 6) - 0.5) * 2 * boilAmp;
        }
        const rad = lerp(rr[0], rr[1], clamp(h3(j, i, seed + 3) * 0.55 + dAt * 0.45));
        p.moveTo(x + rad, y);
        p.arc(x, y, rad, 0, TAU);
      }
    }
    ctx.save();
    if (shape.apply && !shape.polys) shape.apply(ctx);
    ctx.globalAlpha *= o.alpha != null ? o.alpha : 0.9;
    ctx.fillStyle = o.color || pal.ink;
    ctx.fill(p);
    ctx.restore();
  }
  lib.stipple = stipple;

  // ===========================================================================
  // Backgrounds: paper, blueprint, stripes
  // ===========================================================================

  function renderScale() {
    return FILM.S || 1;
  }

  /**
   * paper(ctx, opts) : cream paper with mottling, grain and fibres. Cached by size, seed and options.
   *   x, y, w, h   0, 0, 1080, 1920
   *   color        pal.paper
   *   seed         3
   *   grain        1      fine grain strength
   *   fibres       1      fibre count multiplier
   *   mottle       1      large soft blotches
   *   vignette     0.35   darkened edges
   */
  function paper(ctx, o = {}) {
    const x = o.x || 0, y = o.y || 0;
    const w = o.w || W(), h = o.h || H();
    const S = renderScale();
    const color = o.color || pal.paper;
    const seed = seedInt(o.seed === undefined ? 3 : o.seed);
    const grain = o.grain != null ? o.grain : 1;
    const fibres = o.fibres != null ? o.fibres : 1;
    const mottle = o.mottle != null ? o.mottle : 1;
    const vignette = o.vignette != null ? o.vignette : 0.35;
    const key = ['paper', w, h, S, color, seed, grain, fibres, mottle, vignette].join('|');
    const c = cached(key, () => makePaper(Math.max(1, Math.round(w * S)), Math.max(1, Math.round(h * S)), S, color, seed, grain, fibres, mottle, vignette));
    ctx.drawImage(c, x, y, w, h);
  }

  function makePaper(cw, ch, S, color, seed, grain, fibres, mottle, vignette) {
    const c = newCanvas(cw, ch);
    const g = c.getContext('2d');
    const [br, bg, bb] = parseColor(color);
    // mottling from a low-resolution noise field, upscaled smooth
    const mw = Math.max(4, Math.ceil(cw / 18)), mh = Math.max(4, Math.ceil(ch / 18));
    const mf = new Float32Array(mw * mh);
    for (let j = 0; j < mh; j++) {
      for (let i = 0; i < mw; i++) {
        mf[j * mw + i] = lib.fbm2(i * 0.11, j * 0.11, seed, 4) * 0.8 + noise2(i * 0.5, j * 0.5, seed + 9) * 0.2;
      }
    }
    const img = g.createImageData(cw, ch);
    const d = img.data;
    const fx = (mw - 1) / cw, fy = (mh - 1) / ch;
    const cxv = cw / 2, cyv = ch / 2;
    const vr = Math.hypot(cxv, cyv);
    for (let py = 0; py < ch; py++) {
      const my = py * fy;
      const jy = Math.floor(my), ty = my - jy;
      const jy1 = Math.min(mh - 1, jy + 1);
      for (let px = 0; px < cw; px++) {
        const mx = px * fx;
        const ix = Math.floor(mx), tx = mx - ix;
        const ix1 = Math.min(mw - 1, ix + 1);
        const m =
          lerp(lerp(mf[jy * mw + ix], mf[jy * mw + ix1], tx), lerp(mf[jy1 * mw + ix], mf[jy1 * mw + ix1], tx), ty);
        const n = h3(px, py, seed + 77);
        const n2 = h3(px >> 1, py >> 1, seed + 78);
        const gr = ((n - 0.5) * 0.6 + (n2 - 0.5) * 0.4) * 0.07 * grain;
        const dxv = (px - cxv) / vr, dyv = (py - cyv) / vr;
        const vig = vignette * Math.max(0, dxv * dxv + dyv * dyv - 0.35) * 0.18;
        const k = 1 + m * 0.055 * mottle + gr - vig;
        const i = (py * cw + px) * 4;
        // darker areas go slightly warmer, like aged paper
        d[i] = br * k;
        d[i + 1] = bg * (k - (1 - k) * 0.12);
        d[i + 2] = bb * (k - (1 - k) * 0.35);
        d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // fibres
    const r = rng(seed + 5);
    const count = Math.round(((cw * ch) / (S * S)) / 1500 * fibres);
    const dark = new Path2D(), light = new Path2D();
    for (let i = 0; i < count; i++) {
      const x = r() * cw, y = r() * ch;
      const L = r.range(5, 26) * S * (r() < 0.08 ? 2.5 : 1);
      const a = r() * TAU;
      const bend = r.range(-0.5, 0.5) * L;
      const p = r() < 0.55 ? dark : light;
      const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L;
      p.moveTo(x, y);
      p.quadraticCurveTo((x + ex) / 2 - Math.sin(a) * bend, (y + ey) / 2 + Math.cos(a) * bend, ex, ey);
    }
    g.lineCap = 'round';
    g.lineWidth = 0.7 * S;
    g.strokeStyle = lib.rgba(pal.inkSoft, 0.07);
    g.stroke(dark);
    g.lineWidth = 1.1 * S;
    g.strokeStyle = 'rgba(255,252,242,0.22)';
    g.stroke(light);
    // specks and faint foxing spots
    const specks = new Path2D();
    for (let i = 0; i < count * 0.08; i++) {
      const x = r() * cw, y = r() * ch, rad = r.range(0.3, 1.1) * S;
      specks.moveTo(x + rad, y);
      specks.arc(x, y, rad, 0, TAU);
    }
    g.fillStyle = lib.rgba(pal.inkSoft, 0.22);
    g.fill(specks);
    for (let i = 0; i < 6 * mottle; i++) {
      const x = r() * cw, y = r() * ch, rad = r.range(30, 120) * S;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, lib.rgba(pal.paperDeep, 0.07));
      gr.addColorStop(1, lib.rgba(pal.paperDeep, 0));
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    return c;
  }
  lib.paper = paper;

  /**
   * blueprint(ctx, opts) : navy plate with faint grid, big guide circles, long diagonals and noise.
   * Cached by size, seed and options.
   *   x, y, w, h   0, 0, 1080, 1920
   *   color        pal.navy
   *   seed         5
   *   grid         60      grid pitch (px); 0 turns the grid off
   *   major        5       every Nth grid line is stronger
   *   center       [0.5w, 0.44h]  centre of the guide circles
   *   circles      4
   *   diagonals    5
   *   noise        1
   *   marks        true    corner registration marks
   */
  function blueprint(ctx, o = {}) {
    const x = o.x || 0, y = o.y || 0;
    const w = o.w || W(), h = o.h || H();
    const S = renderScale();
    const opt = {
      color: o.color || pal.navy,
      seed: seedInt(o.seed === undefined ? 5 : o.seed),
      grid: o.grid != null ? o.grid : 60,
      major: o.major || 5,
      center: o.center || [w * 0.5, h * 0.44],
      circles: o.circles != null ? o.circles : 4,
      diagonals: o.diagonals != null ? o.diagonals : 5,
      noise: o.noise != null ? o.noise : 1,
      marks: o.marks !== false,
      line: o.line || pal.lavender,
    };
    const key = ['blueprint', w, h, S, JSON.stringify(opt)].join('|');
    const c = cached(key, () => makeBlueprint(w, h, S, opt));
    ctx.drawImage(c, x, y, w, h);
  }

  function makeBlueprint(w, h, S, o) {
    const cw = Math.max(1, Math.round(w * S)), ch = Math.max(1, Math.round(h * S));
    const c = newCanvas(cw, ch);
    const g = c.getContext('2d');
    const [br, bgc, bb] = parseColor(o.color);
    const [dr, dg, db] = parseColor(pal.navyDeep);
    const [lr, lg, lb] = parseColor(pal.navyLight);
    const img = g.createImageData(cw, ch);
    const d = img.data;
    const ccx = o.center[0] * S, ccy = o.center[1] * S;
    const R = Math.hypot(cw, ch) * 0.62;
    for (let py = 0; py < ch; py++) {
      for (let px = 0; px < cw; px++) {
        const rd = Math.min(1, Math.hypot(px - ccx, py - ccy) / R);
        // light centre falling to deep edges
        const t = rd * rd;
        let r = rd < 0.35 ? lerp(lr, br, rd / 0.35) : lerp(br, dr, (t - 0.1225) / 0.8775);
        let gg = rd < 0.35 ? lerp(lg, bgc, rd / 0.35) : lerp(bgc, dg, (t - 0.1225) / 0.8775);
        let b = rd < 0.35 ? lerp(lb, bb, rd / 0.35) : lerp(bb, db, (t - 0.1225) / 0.8775);
        const n = (h3(px, py, o.seed + 3) - 0.5) * 9 * o.noise + (h3(px >> 2, py >> 2, o.seed + 4) - 0.5) * 5 * o.noise;
        const i = (py * cw + px) * 4;
        d[i] = r + n * 0.8;
        d[i + 1] = gg + n * 0.85;
        d[i + 2] = b + n;
        d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    g.scale(S, S);
    const r = rng(o.seed);
    const line = o.line;
    // grid
    if (o.grid > 0) {
      const minor = new Path2D(), major = new Path2D();
      let k = 0;
      for (let gx = (w / 2) % o.grid; gx <= w; gx += o.grid, k++) {
        const p = Math.round((gx - w / 2) / o.grid) % o.major === 0 ? major : minor;
        p.moveTo(gx, 0);
        p.lineTo(gx, h);
      }
      for (let gy = (h / 2) % o.grid; gy <= h; gy += o.grid) {
        const p = Math.round((gy - h / 2) / o.grid) % o.major === 0 ? major : minor;
        p.moveTo(0, gy);
        p.lineTo(w, gy);
      }
      g.lineWidth = 1;
      g.strokeStyle = lib.rgba(pal.grid, 0.3);
      g.stroke(minor);
      g.strokeStyle = lib.rgba(pal.grid, 0.5);
      g.stroke(major);
    }
    // long diagonals
    const [cx, cy] = o.center;
    for (let i = 0; i < o.diagonals; i++) {
      const a = r.range(0, Math.PI);
      const ox = cx + r.range(-0.35, 0.35) * w, oy = cy + r.range(-0.3, 0.3) * h;
      const L = Math.hypot(w, h);
      g.beginPath();
      g.moveTo(ox - Math.cos(a) * L, oy - Math.sin(a) * L);
      g.lineTo(ox + Math.cos(a) * L, oy + Math.sin(a) * L);
      g.lineWidth = r.range(0.8, 1.3);
      g.strokeStyle = lib.rgba(line, r.range(0.07, 0.14));
      if (r() < 0.35) g.setLineDash([r.range(6, 14), r.range(6, 12)]);
      else g.setLineDash([]);
      g.stroke();
    }
    g.setLineDash([]);
    // guide circles
    const minDim = Math.min(w, h);
    for (let i = 0; i < o.circles; i++) {
      const rad = minDim * (0.2 + i * 0.17) * r.range(0.95, 1.05);
      g.beginPath();
      g.arc(cx, cy, rad, 0, TAU);
      g.lineWidth = i === o.circles - 1 ? 1.4 : 1;
      g.strokeStyle = lib.rgba(line, i % 2 ? 0.1 : 0.16);
      if (i === 1) g.setLineDash([2, 7]);
      else g.setLineDash([]);
      g.stroke();
    }
    g.setLineDash([]);
    if (o.circles > 0) {
      const rad = minDim * (0.2 + (o.circles - 1) * 0.17);
      ticksImpl(g, cx, cy, { r: rad, n: 120, len: 7, major: 10, majorLen: 16, color: line, alpha: 0.2, width: 1 });
      // off-centre satellite circle
      const a = r.range(0, TAU);
      const sr = minDim * r.range(0.07, 0.12);
      g.beginPath();
      g.arc(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, sr, 0, TAU);
      g.lineWidth = 1;
      g.strokeStyle = lib.rgba(line, 0.14);
      g.stroke();
      // centre crosshair
      g.beginPath();
      g.moveTo(cx - 18, cy);
      g.lineTo(cx + 18, cy);
      g.moveTo(cx, cy - 18);
      g.lineTo(cx, cy + 18);
      g.strokeStyle = lib.rgba(line, 0.22);
      g.stroke();
    }
    // corner registration marks
    if (o.marks) {
      g.strokeStyle = lib.rgba(line, 0.32);
      g.lineWidth = 1.2;
      const m = 34, s = 22;
      for (const [mx, my, sx, sy] of [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]]) {
        g.beginPath();
        g.moveTo(mx, my + sy * s);
        g.lineTo(mx, my);
        g.lineTo(mx + sx * s, my);
        g.stroke();
      }
    }
    // faint scattered star specks
    const sp = new Path2D();
    for (let i = 0; i < (w * h) / 5000 * o.noise; i++) {
      const x = r() * w, y = r() * h, rad = r.range(0.4, 1.1);
      sp.moveTo(x + rad, y);
      sp.arc(x, y, rad, 0, TAU);
    }
    g.fillStyle = lib.rgba(pal.lineWhite, 0.22);
    g.fill(sp);
    return c;
  }
  lib.blueprint = blueprint;

  /**
   * stripes(ctx, opts) : the wide diagonal stripe background with softly irregular edges.
   *   colors   [pal.stripeCream, pal.stripeYellow]
   *   width    140     band width (px); both colours use it
   *   angle    -0.52   stripe direction (radians): 30 degrees rising left to right
   *   offset   0       scroll along the normal (animate this)
   *   wobble   1.4     edge irregularity (px)
   *   bounds   frame
   *   seed     21
   */
  function stripes(ctx, o = {}) {
    const B = normBounds(o.bounds);
    const cols = o.colors || [pal.stripeCream, pal.stripeYellow];
    const sw = o.width || 140;
    const angle = o.angle != null ? o.angle : -0.52;
    const offset = o.offset || 0;
    const wobble = o.wobble != null ? o.wobble : 1.4;
    const seed = seedInt(o.seed === undefined ? 21 : o.seed);
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const nx = -dy, ny = dx;
    const cx = B.x + B.w / 2, cy = B.y + B.h / 2;
    const half = Math.hypot(B.w, B.h) / 2 + sw * 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(B.x, B.y, B.w, B.h);
    ctx.clip();
    ctx.fillStyle = cols[0];
    ctx.fillRect(B.x, B.y, B.w, B.h);
    const period = sw * cols.length;
    const shift = ((offset % period) + period) % period;
    const edge = (v, k, forward) => {
      const pts = [];
      const n = Math.ceil((half * 2) / 40);
      for (let i = 0; i <= n; i++) {
        const u = -half + (i / n) * half * 2;
        const vv = v + wobble * noise1(u * 0.012 + k * 3.7, seed) + wobble * 0.3 * noise1(u * 0.05, seed + k);
        pts.push([cx + dx * u + nx * vv, cy + dy * u + ny * vv]);
      }
      if (!forward) pts.reverse();
      return pts;
    };
    for (let ci = 1; ci < cols.length; ci++) {
      const p = new Path2D();
      const first = Math.floor((-half - shift) / period) - 1;
      const last = Math.ceil((half - shift) / period) + 1;
      for (let k = first; k <= last; k++) {
        const v0 = k * period + shift + sw * ci - half * 0;
        const a = edge(v0, k * 2 + ci, true);
        const b = edge(v0 + sw, k * 2 + ci + 1, false);
        a.forEach((pt, i) => (i === 0 ? p.moveTo(pt[0], pt[1]) : p.lineTo(pt[0], pt[1])));
        b.forEach((pt) => p.lineTo(pt[0], pt[1]));
        p.closePath();
      }
      ctx.fillStyle = cols[ci];
      ctx.fill(p);
    }
    ctx.restore();
  }
  lib.stripes = stripes;

  // ===========================================================================
  // Schematic helpers
  // ===========================================================================

  /**
   * hexLattice(ctx, clip, opts) : hexagonal cell lattice with shared, slightly irregular vertices.
   *   r         16       cell circumradius (px)
   *   pointy    true     pointy-top cells (false = flat-top)
   *   width     1
   *   color     pal.lavender
   *   alpha     0.35
   *   jitter    1.0      vertex irregularity (px), shared by neighbouring cells
   *   inset     0        >0 draws each cell as its own hexagon shrunk by this many px
   *   cellFn    null     fn(cx, cy, i, j) => false (skip) | true | { fill, alpha, stroke }
   *   dots      0        radius of a dot at each cell centre (0 = none)
   *   boilAmp   0.35
   *   clip      true     hard-clip to the shape
   *   bounds    frame    when clip is a function, Path2D or null
   *   seed      17
   */
  function hexLattice(ctx, clip, o = {}) {
    const shape = shapeOf(clip, Object.assign({ pad: (o.r || 16) * 2 }, o));
    const R = o.r || 16;
    const pointy = o.pointy !== false;
    const seed = seedInt(o.seed === undefined ? 17 : o.seed);
    const jitter = o.jitter != null ? o.jitter : 1.0;
    const boilAmp = boilOff(o) ? 0 : o.boilAmp != null ? o.boilAmp : 0.35;
    const bi = boilIndex(o);
    const inset = o.inset || 0;
    const B = shape.bounds;
    const sq3 = Math.sqrt(3);
    const colW = pointy ? sq3 * R : 1.5 * R;
    const rowH = pointy ? 1.5 * R : sq3 * R;
    const vtx = (x, y) => {
      const kx = Math.round(x * 4), ky = Math.round(y * 4);
      const jx = (h3(kx, ky, seed) - 0.5) * 2 * jitter + (boilAmp ? (h3(kx, ky, seed + bi * 13 + 1) - 0.5) * 2 * boilAmp : 0);
      const jy = (h3(ky, kx, seed + 2) - 0.5) * 2 * jitter + (boilAmp ? (h3(ky, kx, seed + bi * 17 + 3) - 0.5) * 2 * boilAmp : 0);
      return [x + jx, y + jy];
    };
    const edges = new Path2D();
    const dots = new Path2D();
    const fills = [];
    const i0 = Math.floor(B.y / rowH) - 1, i1 = Math.ceil((B.y + B.h) / rowH) + 1;
    const j0 = Math.floor(B.x / colW) - 1, j1 = Math.ceil((B.x + B.w) / colW) + 1;
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        let cx, cy;
        if (pointy) {
          cx = j * colW + (i & 1 ? colW / 2 : 0);
          cy = i * rowH;
        } else {
          cx = j * colW;
          cy = i * rowH + (j & 1 ? rowH / 2 : 0);
        }
        if (shape.polys && !polysContain(shape.polys, cx, cy)) {
          // keep cells that straddle the edge so the hard clip cuts them cleanly
          let near = false;
          for (let k = 0; k < 6 && !near; k++) {
            const a = (k / 6) * TAU + (pointy ? Math.PI / 6 : 0);
            near = polysContain(shape.polys, cx + Math.cos(a) * R, cy + Math.sin(a) * R);
          }
          if (!near) continue;
        }
        let cell = true;
        if (o.cellFn) {
          cell = o.cellFn(cx, cy, i, j);
          if (!cell) continue;
        }
        const V = [];
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU + (pointy ? Math.PI / 6 : 0);
          V.push(vtx(cx + Math.cos(a) * R, cy + Math.sin(a) * R));
        }
        if (typeof cell === 'object' && cell.fill) fills.push([V, cell]);
        if (inset > 0) {
          for (let k = 0; k < 6; k++) {
            const v = V[k];
            const f = Math.max(0, 1 - inset / R);
            const x = cx + (v[0] - cx) * f, y = cy + (v[1] - cy) * f;
            if (k === 0) edges.moveTo(x, y);
            else edges.lineTo(x, y);
          }
          edges.closePath();
        } else {
          // three edges per cell so shared edges are drawn once
          const ks = pointy ? [5, 0, 1] : [0, 1, 2];
          for (const k of ks) {
            edges.moveTo(V[k][0], V[k][1]);
            edges.lineTo(V[(k + 1) % 6][0], V[(k + 1) % 6][1]);
          }
          // cells on the left/top border of the drawn set need their other edges
          if (o.cellFn || shape.polys) {
            for (const k of pointy ? [2, 3, 4] : [3, 4, 5]) {
              edges.moveTo(V[k][0], V[k][1]);
              edges.lineTo(V[(k + 1) % 6][0], V[(k + 1) % 6][1]);
            }
          }
        }
        if (o.dots) {
          dots.moveTo(cx + o.dots, cy);
          dots.arc(cx, cy, o.dots, 0, TAU);
        }
      }
    }
    ctx.save();
    if (shape.apply && o.clip !== false) shape.apply(ctx);
    const color = o.color || pal.lavender;
    const alpha = o.alpha != null ? o.alpha : 0.35;
    for (const [V, cell] of fills) {
      ctx.beginPath();
      lib.tracePath(ctx, V, true);
      ctx.globalAlpha = cell.alpha != null ? cell.alpha : 0.35;
      ctx.fillStyle = cell.fill;
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
    ctx.lineWidth = o.width != null ? o.width : 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.stroke(edges);
    if (o.dots) {
      ctx.fillStyle = color;
      ctx.fill(dots);
    }
    ctx.restore();
  }
  lib.hexLattice = hexLattice;

  function needle(p, x0, y0, x1, y1, w0, w1) {
    const dx = x1 - x0, dy = y1 - y0;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    p.moveTo(x0 + nx * w0, y0 + ny * w0);
    p.lineTo(x1 + nx * w1, y1 + ny * w1);
    p.lineTo(x1 - nx * w1, y1 - ny * w1);
    p.lineTo(x0 - nx * w0, y0 - ny * w0);
    p.closePath();
  }

  /**
   * glowDot(ctx, x, y, r, opts) : soft glow, hot core and star rays (a nucleus, a spark, a star).
   *   color     pal.glow    glow colour
   *   core      '#ffffff'
   *   rays      8           ray count (0 = none); long and short alternate
   *   rayLen    3.4         ray length as a multiple of r
   *   rayWidth  0.22        ray base width as a multiple of r
   *   rot       0
   *   glow      4.5         glow radius as a multiple of r
   *   intensity 1
   *   twinkle   0.18        per boil drawing flicker
   *   additive  true        'lighter' blending (use false on paper)
   *   seed      19
   */
  function glowDot(ctx, x, y, r, o = {}) {
    const seed = seedInt(o.seed === undefined ? 19 : o.seed);
    const bi = boilIndex(o);
    const tw = o.twinkle != null ? o.twinkle : 0.18;
    const k = (o.intensity != null ? o.intensity : 1) * (1 - tw + tw * 2 * h3(bi, seed, 23));
    const color = o.color || pal.glow;
    const glowR = r * (o.glow != null ? o.glow : 4.5);
    ctx.save();
    if (o.additive !== false) ctx.globalCompositeOperation = 'lighter';
    const base = ctx.globalAlpha;
    const g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    g.addColorStop(0, lib.rgba(color, 0.55 * k));
    g.addColorStop(0.18, lib.rgba(color, 0.22 * k));
    g.addColorStop(0.5, lib.rgba(color, 0.06 * k));
    g.addColorStop(1, lib.rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - glowR, y - glowR, glowR * 2, glowR * 2);
    const rays = o.rays != null ? o.rays : 8;
    if (rays > 0) {
      const p = new Path2D();
      const rot = o.rot || 0;
      const rl = r * (o.rayLen != null ? o.rayLen : 3.4);
      const rw = r * (o.rayWidth != null ? o.rayWidth : 0.22);
      for (let i = 0; i < rays; i++) {
        const a = rot + (i / rays) * TAU;
        const L = (i % 2 ? 0.52 : 1) * rl * (0.9 + 0.2 * h3(i, bi, seed));
        needle(p, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, rw, 0.05);
      }
      ctx.globalAlpha = base * Math.min(1, 0.85 * k);
      ctx.fillStyle = o.core || '#ffffff';
      ctx.fill(p);
    }
    ctx.globalAlpha = base * Math.min(1, k);
    const cg = ctx.createRadialGradient(x, y, 0, x, y, r);
    cg.addColorStop(0, o.core || '#ffffff');
    cg.addColorStop(0.55, lib.rgba(o.core || '#ffffff', 0.9));
    cg.addColorStop(1, lib.rgba(color, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  lib.glowDot = glowDot;

  function ticksImpl(ctx, x, y, o) {
    const p = new Path2D();
    const pm = new Path2D();
    const n = o.n || 24;
    const len = o.len != null ? o.len : 12;
    const major = o.major || 0;
    const majorLen = o.majorLen != null ? o.majorLen : len * 1.8;
    const prog = o.p != null ? clamp(o.p) : 1;
    const count = Math.round(n * prog);
    if (o.kind === 'linear' || (o.r == null && o.length != null)) {
      const L = o.length || 300;
      const a = o.angle || 0;
      const dx = Math.cos(a), dy = Math.sin(a);
      const side = o.side || 1;
      const nx = -dy * side, ny = dx * side;
      for (let i = 0; i <= Math.round(n * prog); i++) {
        const u = (i / n) * L;
        const isMajor = major && i % major === 0;
        const l = isMajor ? majorLen : len;
        const tgt = isMajor ? pm : p;
        tgt.moveTo(x + dx * u, y + dy * u);
        tgt.lineTo(x + dx * u + nx * l, y + dy * u + ny * l);
      }
      if (o.baseline !== false) {
        pm.moveTo(x, y);
        pm.lineTo(x + dx * L * prog, y + dy * L * prog);
      }
    } else {
      const r = o.r != null ? o.r : 40;
      const a0 = (o.start || 0) + (o.rot || 0);
      const span = o.span != null ? o.span : TAU;
      const full = Math.abs(span - TAU) < 1e-6;
      const dir = o.inward ? -1 : 1;
      for (let i = 0; i < count; i++) {
        const a = a0 + (i / (full ? n : Math.max(1, n - 1))) * span;
        const isMajor = major && i % major === 0;
        const l = (isMajor ? majorLen : len) * dir;
        const tgt = isMajor ? pm : p;
        const c = Math.cos(a), s = Math.sin(a);
        tgt.moveTo(x + c * r, y + s * r);
        tgt.lineTo(x + c * (r + l), y + s * (r + l));
      }
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = o.color || pal.lineWhite;
    ctx.globalAlpha *= o.alpha != null ? o.alpha : 0.6;
    ctx.lineWidth = o.width != null ? o.width : 1.5;
    ctx.stroke(p);
    ctx.lineWidth = (o.width != null ? o.width : 1.5) * 1.35;
    ctx.stroke(pm);
    ctx.restore();
  }

  /**
   * ticks(ctx, x, y, opts) : radial ticks around a circle, or a linear ruler.
   * Radial (default):  r 40, n 24, len 12, start 0, span TAU, major 0, majorLen len*1.8, inward false, rot 0
   * Linear (kind 'linear' or length given): length 300, angle 0, n 24, len 12, major 0, side 1, baseline true
   * Both: color pal.lineWhite, alpha 0.6, width 1.5, p 1 (draw-on progress)
   */
  lib.ticks = (ctx, x, y, o = {}) => ticksImpl(ctx, x, y, o);

  function labelAt(ctx, str, x, y, o) {
    lib.text(ctx, str, x, y, {
      size: o.labelSize || 22,
      color: o.labelColor || o.color,
      alpha: o.alpha != null ? o.alpha : 0.9,
      align: o.labelAlign || 'center',
      baseline: 'middle',
      weight: 400,
      tracking: 1,
    });
  }

  /**
   * bracket(ctx, x1, y1, x2, y2, opts) : a measurement bracket between two points.
   *   style    'dim'    'dim' = dimension line with end bars and arrow ticks, 'square' = [ shape
   *   offset   0        perpendicular offset of the bracket from the measured points (px)
   *   cap      16       end bar length
   *   color    pal.lavender
   *   alpha    0.6
   *   width    1.5
   *   label    null     text at the middle
   *   p        1        draw-on progress
   */
  lib.bracket = (ctx, x1, y1, x2, y2, o = {}) => {
    const dx = x2 - x1, dy = y2 - y1;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    const nx = -uy, ny = ux;
    const off = o.offset || 0;
    const cap = o.cap != null ? o.cap : 16;
    const prog = o.p != null ? clamp(o.p) : 1;
    const ax = x1 + nx * off, ay = y1 + ny * off;
    const bx = x2 + nx * off, by = y2 + ny * off;
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const h = (L / 2) * prog;
    const p = new Path2D();
    const style = o.style || 'dim';
    const labelGap = o.label ? Math.min(h * 0.9, (String(o.label).length * (o.labelSize || 22)) * 0.34 + 10) : 0;
    const sx = mx - ux * h, sy = my - uy * h, ex = mx + ux * h, ey = my + uy * h;
    if (style === 'square') {
      const sgn = off >= 0 ? -1 : 1;
      p.moveTo(sx + nx * cap * sgn, sy + ny * cap * sgn);
      p.lineTo(sx, sy);
      p.lineTo(mx - ux * labelGap, my - uy * labelGap);
      p.moveTo(mx + ux * labelGap, my + uy * labelGap);
      p.lineTo(ex, ey);
      p.lineTo(ex + nx * cap * sgn, ey + ny * cap * sgn);
    } else {
      p.moveTo(sx, sy);
      p.lineTo(mx - ux * labelGap, my - uy * labelGap);
      p.moveTo(mx + ux * labelGap, my + uy * labelGap);
      p.lineTo(ex, ey);
      p.moveTo(sx - nx * cap * 0.5, sy - ny * cap * 0.5);
      p.lineTo(sx + nx * cap * 0.5, sy + ny * cap * 0.5);
      p.moveTo(ex - nx * cap * 0.5, ey - ny * cap * 0.5);
      p.lineTo(ex + nx * cap * 0.5, ey + ny * cap * 0.5);
      const ah = Math.min(9, h * 0.3);
      p.moveTo(sx + ux * ah + nx * ah * 0.5, sy + uy * ah + ny * ah * 0.5);
      p.lineTo(sx, sy);
      p.lineTo(sx + ux * ah - nx * ah * 0.5, sy + uy * ah - ny * ah * 0.5);
      p.moveTo(ex - ux * ah + nx * ah * 0.5, ey - uy * ah + ny * ah * 0.5);
      p.lineTo(ex, ey);
      p.lineTo(ex - ux * ah - nx * ah * 0.5, ey - uy * ah - ny * ah * 0.5);
      if (off) {
        // extension lines back to the measured points
        p.moveTo(x1 + nx * Math.sign(off) * 4, y1 + ny * Math.sign(off) * 4);
        p.lineTo(ax + nx * Math.sign(off) * cap * 0.6, ay + ny * Math.sign(off) * cap * 0.6);
        p.moveTo(x2 + nx * Math.sign(off) * 4, y2 + ny * Math.sign(off) * 4);
        p.lineTo(bx + nx * Math.sign(off) * cap * 0.6, by + ny * Math.sign(off) * cap * 0.6);
      }
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = o.color || pal.lavender;
    ctx.globalAlpha *= o.alpha != null ? o.alpha : 0.6;
    ctx.lineWidth = o.width != null ? o.width : 1.5;
    ctx.stroke(p);
    ctx.restore();
    if (o.label && prog > 0.6) {
      ctx.save();
      ctx.translate(mx, my);
      let a = Math.atan2(uy, ux);
      if (a > Math.PI / 2 || a < -Math.PI / 2) a += Math.PI;
      ctx.rotate(a);
      ctx.globalAlpha *= clamp((prog - 0.6) / 0.4);
      labelAt(ctx, o.label, 0, 0, Object.assign({ color: o.color || pal.lavender }, o));
      ctx.restore();
    }
  };

  /**
   * guideCircle(ctx, cx, cy, r, opts) : a faint construction circle.
   *   color pal.lavender, alpha 0.15, width 1.5, dash null ([on, off]),
   *   p 1 (draw-on progress), start -PI/2, cross 0 (centre crosshair half-size),
   *   quadrants 0 (tick length at the four quadrant points), ink false (hand-drawn via inkPath), seed
   */
  lib.guideCircle = (ctx, cx, cy, r, o = {}) => {
    const prog = o.p != null ? clamp(o.p) : 1;
    if (prog <= 0) return;
    const start = o.start != null ? o.start : -Math.PI / 2;
    const color = o.color || pal.lavender;
    const alpha = o.alpha != null ? o.alpha : 0.15;
    const width = o.width != null ? o.width : 1.5;
    ctx.save();
    if (o.ink) {
      const n = Math.max(12, Math.ceil(r * TAU * prog / 10));
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const a = start + (i / n) * TAU * prog;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      inkPath(ctx, pts, { closed: prog >= 1, width: width * 1.4, color, alpha, seed: o.seed, taper: [6, 12], wobble: 1.2 });
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, start + TAU * prog);
      ctx.strokeStyle = color;
      ctx.globalAlpha *= alpha;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      if (o.dash) ctx.setLineDash(o.dash);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (o.cross || o.quadrants) {
      const p = new Path2D();
      if (o.cross) {
        p.moveTo(cx - o.cross, cy);
        p.lineTo(cx + o.cross, cy);
        p.moveTo(cx, cy - o.cross);
        p.lineTo(cx, cy + o.cross);
      }
      if (o.quadrants) {
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2;
          const c = Math.cos(a), s = Math.sin(a);
          p.moveTo(cx + c * (r - o.quadrants), cy + s * (r - o.quadrants));
          p.lineTo(cx + c * (r + o.quadrants), cy + s * (r + o.quadrants));
        }
      }
      if (o.ink) {
        ctx.strokeStyle = color;
        ctx.globalAlpha *= alpha;
      }
      ctx.lineWidth = width;
      ctx.stroke(p);
    }
    ctx.restore();
  };

  /**
   * arcAnnotation(ctx, cx, cy, r, a0, a1, opts) : a thin coloured arc over an illustration
   * (flight paths, sound, attention), with an arrowhead and an origin dot.
   *   color pal.annMagenta, width 2, alpha 1, p 1 (draw-on progress), endTicks 8 (0 = none),
   *   arrow 0 (arrowhead size), dot 0 (origin dot radius), dash null, label null, labelOffset 26
   */
  lib.arcAnnotation = (ctx, cx, cy, r, a0, a1, o = {}) => {
    const prog = o.p != null ? clamp(o.p) : 1;
    if (prog <= 0) return;
    const color = o.color || pal.annMagenta;
    const width = o.width != null ? o.width : 2;
    const ae = a0 + (a1 - a0) * prog;
    const ccw = a1 < a0;
    ctx.save();
    ctx.globalAlpha *= o.alpha != null ? o.alpha : 1;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, ae, ccw);
    ctx.stroke();
    ctx.setLineDash([]);
    const et = o.endTicks != null ? o.endTicks : 8;
    if (et) {
      ctx.beginPath();
      for (const a of prog >= 1 ? [a0, ae] : [a0]) {
        ctx.moveTo(cx + Math.cos(a) * (r - et / 2), cy + Math.sin(a) * (r - et / 2));
        ctx.lineTo(cx + Math.cos(a) * (r + et / 2), cy + Math.sin(a) * (r + et / 2));
      }
      ctx.stroke();
    }
    const dot = o.dot != null ? o.dot : 0;
    if (dot) {
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, dot, 0, TAU);
      ctx.fill();
    }
    const ah = o.arrow != null ? o.arrow : 0;
    if (ah) {
      const ex = cx + Math.cos(ae) * r, ey = cy + Math.sin(ae) * r;
      const tdir = ae + (ccw ? -Math.PI / 2 : Math.PI / 2);
      const tx = Math.cos(tdir), ty = Math.sin(tdir);
      const nx = -ty, ny = tx;
      ctx.beginPath();
      ctx.moveTo(ex + tx * ah * 0.35, ey + ty * ah * 0.35);
      ctx.lineTo(ex - tx * ah * 0.75 + nx * ah * 0.45, ey - ty * ah * 0.75 + ny * ah * 0.45);
      ctx.lineTo(ex - tx * ah * 0.45, ey - ty * ah * 0.45);
      ctx.lineTo(ex - tx * ah * 0.75 - nx * ah * 0.45, ey - ty * ah * 0.75 - ny * ah * 0.45);
      ctx.closePath();
      ctx.fill();
    }
    if (o.label) {
      const am = (a0 + ae) / 2;
      const lo = o.labelOffset != null ? o.labelOffset : 26;
      lib.text(ctx, o.label, cx + Math.cos(am) * (r + lo), cy + Math.sin(am) * (r + lo), {
        size: o.labelSize || 24,
        color,
        align: 'center',
        baseline: 'middle',
        weight: 500,
      });
    }
    ctx.restore();
  };

  // ===========================================================================
  // Camera and text
  // ===========================================================================

  /**
   * camera(ctx, { x, y, zoom, rot }, fn) : draws fn(ctx) with world point (x, y) at the frame centre,
   * scaled by zoom and rotated by rot. Defaults: the frame centre, zoom 1, rot 0.
   */
  lib.camera = (ctx, cam, fn) => {
    const c = cam || {};
    const x = c.x != null ? c.x : W() / 2;
    const y = c.y != null ? c.y : H() / 2;
    ctx.save();
    ctx.translate(W() / 2, H() / 2);
    if (c.rot) ctx.rotate(c.rot);
    if (c.zoom != null && c.zoom !== 1) ctx.scale(c.zoom, c.zoom);
    ctx.translate(-x, -y);
    let out;
    try {
      out = fn(ctx);
    } finally {
      ctx.restore();
    }
    return out;
  };

  const FONT_STACK = '"SF Pro Rounded", ui-rounded, "Helvetica Neue", system-ui, -apple-system, "Segoe UI", Arial, sans-serif';

  /**
   * text(ctx, str, x, y, opts) : a thin single-line wordmark in the system sans-serif (no font files).
   *   size 42, weight 300, color pal.ink, alpha 1, align 'left', baseline 'alphabetic',
   *   tracking 0 (px number, or a css length such as '0.12em'; letterSpacing is an alias),
   *   family (system stack), p 1 (typewriter reveal fraction), italic false
   */
  const HAND_STACK = '"Chalkboard SE", "Marker Felt", "Comic Sans MS", cursive';
  lib.text = (ctx, str, x, y, o = {}) => {
    let s = String(str);
    if (o.p != null) s = s.slice(0, Math.round(s.length * clamp(o.p)));
    if (!s) return;
    ctx.save();
    ctx.font = `${o.italic ? 'italic ' : ''}${o.weight || 300} ${o.size || 42}px ${o.family || FONT_STACK}`;
    ctx.fillStyle = o.color || pal.ink;
    ctx.globalAlpha *= o.alpha != null ? o.alpha : 1;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    if ('letterSpacing' in ctx) {
      const tr = o.letterSpacing != null ? o.letterSpacing : o.tracking;
      ctx.letterSpacing = typeof tr === 'string' ? tr : `${tr || 0}px`;
    }
    ctx.fillText(s, x, y);
    ctx.restore();
  };

  // ===========================================================================
  // The manner: cel layer over a painted background (docs/art-bible.md sections 3 to 7)
  // ===========================================================================
  /*
   * Two layers make every frame: a still painted background and, over it, the cel layer, where
   * everything that moves is a flat colour inside a closed black contour. Widths are frame pixels
   * and never scale with the shot: LINE (4.5) for every character and moving object at every size,
   * LINE_XCU (11) only on an extreme close-up where a face is bigger than the frame. Nothing boils.
   *
   * Cel layer
   *   cel(ctx, pts, o)                   flat fill inside a closed black contour
   *                                      o: fill, width LINE, brush false, seed, color ink, alpha, smooth, draw
   *   stroke(ctx, pts, o)                open black stroke tapering to points: brows, mouths, folds, hair
   *                                      o: width LINE, brush false (true: 2-3 dabs with 2-6 px gaps), taper, seed
   *   tube(ctx, pts, w, fill, o)         a limb or tube: round-ended band w px wide in a black contour;
   *                                      tubes drawn in one call merge their joints. o: width LINE, alpha
   * Background, street plate (illustrated): white paper, soft washes, coloured pencil, no black
   *   softWash(ctx, pts, o)              soft-edged watercolour patch with visible brush marks
   *                                      o: color, alpha 0.92, soft 8 (edge px), marks 1, angle 0, rim 0.18, seed,
   *                                      solid (opaque body with a hard edge: buildings, signs)
   *   pencil(ctx, pts, o)                coloured pencil edge, 1.5 to 3 px, the object's colour made darker
   *                                      o: color (or base: the fill to darken), width 2.2, closed, alpha 0.9, seed
   * Background, machine plate (schematic): mid-tone ground, dense short strokes, torn dark lines
   *   dense(ctx, clip, o)                muted ground, tonal patches, dry streaks, short strokes in three
   *                                      tones, built once and cached. o: base, mute 0.45, cover [0.16, 0.05],
   *                                      patches 1, streaks 1, scribble 0.5, len 12, width 4, dark, light,
   *                                      dir 'vertical' | 'horizontal' | 'perspective' | 'swirl' | radians,
   *                                      vp [x, y] (vanishing point or swirl centre), bounds, seed
   *   ragged(ctx, pts, o)                torn dark line, never black (brightness 70 to 110)
   *                                      o: color (or base), width 4, closed, seed
   * Both plates
   *   plate(ctx, key, fn, o)             draws fn(g) once into an offscreen canvas and reuses it:
   *                                      the way to draw a still background. o: w, h (canvas size), x, y
   *   wallShadow(ctx, draw, o)           a character's shadow on a wall: draw(g) paints the character,
   *                                      its silhouette lands multiplied by k. o: dx, dy, k 0.57, clip
   *   speedLines(ctx, x, y, angle, o)    short grey strokes trailing a body moving along angle
   *                                      o: n 5, spread 120, len [60, 150], gap 24, width 4, color, seed
   *   impactStar(ctx, x, y, r, o)        black star with long sharp rays and a red heart. o: rays 9, rot, seed
   *   smear(ctx, pts, o)                 dry-brush swirl along a path, tail first. o: colors, width 60, strands 5, seed
   *   dust(ctx, x, y, o)                 grey dry-brush puffs. o: r 50, p 0.5 (age 0..1), dir PI, n 4, color, seed
   *   puff(ctx, x, y, o)                 a sigh: a short grey dry-brush wave drifting off. o: p (age), dir, drift 60, len 70
   *   footShadow(ctx, x, y, rx, o)       the shadow spot under the feet: flat, a dark tone of the ground at 35 percent.
   *                                      o: ground (the color it darkens), color, alpha 0.35, ry
   *   dipBlack(ctx, k), dipWhite(ctx, k) the whole frame toward black or white paper, k 0..1
   *   letters(ctx, str, x, y, o)         hand lettering, each letter turned, lifted and sized a little
   *                                      o: size 60, face 'round' | 'note', color ink, outline null,
   *                                      outlineWidth, align 'left', baseline 'alphabetic', jitter 1,
   *                                      tracking 0.04, firstColor, colors, rot, arc, p, seed, ink (each
   *                                      letter re-inked at its own weight: 1 for note, 0.4 for round), measure
   *                                      (true: draw nothing). Returns its box { x0, x1, y0, y1, w }.
   *   spot(ctx, cx, cy, rx, ry, o)       the pale soft blot under a title. o: color titleSpot, irr 0.14, seed
   *   blobPts(cx, cy, rx, ry, seed, irr, n)  an irregular closed outline
   *   densify(pts, step, closed)         extra points along straight edges: every outline is smoothed
   *                                      through its points, so a 4-point rectangle comes out as an oval
   *                                      unless densified (or built with rectPts / rrectPts)
   */
  const LINE = 4.5;
  lib.LINE = LINE;
  lib.LINE_XCU = 11;

  lib.cel = (ctx, pts, o = {}) => {
    if (!pts || pts.length < 3) return;
    if (o.width === 0) {
      if (!o.fill) return;
      ctx.save();
      ctx.globalAlpha *= o.fillAlpha != null ? o.fillAlpha : 1;
      ctx.fillStyle = o.fill;
      ctx.beginPath();
      lib.tracePath(ctx, o.smooth === false ? pts : lib.smoothPts(pts, true, 3), true);
      ctx.fill();
      ctx.restore();
      return;
    }
    const brush = !!o.brush;
    inkPath(ctx, pts, {
      closed: true,
      fill: o.fill,
      fillAlpha: o.fillAlpha,
      width: o.width != null ? o.width : LINE,
      color: o.color || pal.ink,
      alpha: o.alpha,
      seed: o.seed,
      smooth: o.smooth,
      draw: o.draw,
      boil: false,
      wobble: o.wobble != null ? o.wobble : brush ? 0.9 : 0.5,
      tremble: 0.2,
      rough: brush ? 0.4 : 0.15,
      widthJitter: brush ? 0.5 : 0.2,
      taper: 0,
      overlap: 12,
    });
  };

  lib.stroke = (ctx, pts, o = {}) => {
    if (!pts || pts.length < 2) return;
    const w = o.width != null ? o.width : LINE;
    const tp = o.taper != null ? o.taper : [w * 2, w * 3];
    const q = {
      width: w,
      color: o.color || pal.ink,
      alpha: o.alpha,
      seed: o.seed,
      smooth: o.smooth,
      draw: o.draw,
      boil: false,
      wobble: o.wobble != null ? o.wobble : 0.4,
      tremble: 0.2,
      rough: o.brush ? 0.35 : 0.12,
      widthJitter: o.brush ? 0.5 : 0.2,
      swell: o.brush ? 0.5 : 0.25,
      taper: tp,
      minWidth: o.minWidth != null ? o.minWidth : 0.1,
    };
    if (!o.brush || o.gaps === false) {
      inkPath(ctx, pts, q);
      return;
    }
    // brush line (machine plate): the stroke breaks into 2 or 3 dabs with 2 to 6 px gaps
    const sm = lib.smoothPts(pts, false, 2);
    const S = [0];
    for (let i = 1; i < sm.length; i++) S.push(S[i - 1] + Math.hypot(sm[i][0] - sm[i - 1][0], sm[i][1] - sm[i - 1][1]));
    const L = S[S.length - 1];
    const n = L > 130 ? 3 : L > 55 ? 2 : 1;
    if (n === 1) {
      inkPath(ctx, pts, q);
      return;
    }
    const r = rng(hash('brush', o.seed == null ? 1 : o.seed));
    const cuts = [0];
    for (let k = 1; k < n; k++) cuts.push((k / n + (r() - 0.5) * 0.16) * L);
    cuts.push(L);
    const t0 = Array.isArray(tp) ? tp[0] : tp, t1 = Array.isArray(tp) ? tp[1] : tp;
    for (let k = 0; k < n; k++) {
      const a = cuts[k] + (k ? lerp(1, 3, r()) : 0);
      const b = cuts[k + 1] - (k < n - 1 ? lerp(1, 3, r()) : 0);
      const piece = [];
      for (let i = 0; i < sm.length; i++) if (S[i] >= a && S[i] <= b) piece.push(sm[i]);
      if (piece.length >= 2) inkPath(ctx, piece, Object.assign({}, q, { seed: (o.seed || 1) + k * 31, smooth: false, taper: [k ? w : t0, k < n - 1 ? w : t1] }));
    }
  };

  function tube(ctx, pts, w, fill, lw, alpha) {
    if (!pts || !pts.length) return;
    const P = pts.length > 2 ? lib.smoothPts(pts, false, 4) : pts.map(XY);
    ctx.save();
    if (alpha != null) ctx.globalAlpha *= alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (P.every((p) => p[0] === P[0][0] && p[1] === P[0][1])) {
      ctx.moveTo(P[0][0], P[0][1]);
      ctx.lineTo(P[0][0] + 0.01, P[0][1]);
    } else lib.tracePath(ctx, P, false);
    if (lw > 0) {
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = w + 2 * lw;
      ctx.stroke();
    }
    ctx.strokeStyle = fill;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.restore();
  }
  /** tube(ctx, pts, w, fill, o): one tube, or an array of point lists that merge into one silhouette. */
  lib.tube = (ctx, pts, w, fill, o = {}) => {
    const lw = o.width != null ? o.width : LINE;
    const many = Array.isArray(pts[0]) && Array.isArray(pts[0][0]);
    if (!many) return tube(ctx, pts, w, fill, lw, o.alpha);
    for (const p of pts) tube(ctx, p, w, pal.ink, lw, o.alpha);
    for (const p of pts) tube(ctx, p, w, fill, 0, o.alpha);
  };

  /** Inward unit normals of a closed polygon (works for either winding). */
  function inwardNormals(P) {
    const n = P.length;
    let area = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) area += P[j][0] * P[i][1] - P[i][0] * P[j][1];
    const sg = area > 0 ? 1 : -1;
    const NX = new Float64Array(n), NY = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
      const tx = b[0] - a[0], ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1;
      NX[i] = (-ty / l) * sg;
      NY[i] = (tx / l) * sg;
    }
    return { NX, NY };
  }

  lib.softWash = (ctx, pts, o = {}) => {
    if (!pts || pts.length < 3) return;
    const color = o.color || pal.grass;
    const A = clamp(o.alpha != null ? o.alpha : 0.92, 0, 0.995);
    const soft = o.soft != null ? o.soft : 8;
    const seed = seedInt(o.seed == null ? 1 : o.seed);
    const P = lib.smoothPts(pts, true, 5);
    const n = P.length;
    const { NX, NY } = inwardNormals(P);
    const K = 4;
    const a = 1 - Math.pow(1 - A, 1 / K);
    const ring = (inset, sd, amp) => {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const d = inset + amp * (noise1(i * 0.07, sd) + 0.5 * noise1(i * 0.23, sd + 3));
        const x = P[i][0] + NX[i] * d, y = P[i][1] + NY[i] * d;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    ctx.save();
    const base = ctx.globalAlpha;
    ctx.fillStyle = color;
    if (o.solid) {
      ctx.beginPath();
      lib.tracePath(ctx, P, true);
      ctx.fill();
    } else {
      for (let k = 0; k < K; k++) {
        ctx.globalAlpha = base * a;
        ring(soft * (k / (K - 1) - 0.35), seed + k * 7, soft * 0.3 + 0.6);
        ctx.fill();
      }
    }
    // visible brush marks: long soft strokes a little darker and a little lighter than the wash
    const marks = o.marks != null ? o.marks : 1;
    if (marks > 0) {
      const B = polysBounds([P]);
      ctx.save();
      ring(soft * 0.3, seed + 99, soft * 0.2);
      ctx.clip();
      const r = rng(seed + 5);
      const ang = o.angle != null ? o.angle : 0;
      const count = Math.round(clamp((B.w * B.h) / 2600, 4, 70) * marks);
      const dark = lib.mix(color, pal.ink, 0.16);
      const light = lib.mix(color, pal.paper, 0.5);
      ctx.lineCap = 'round';
      for (let i = 0; i < count; i++) {
        const cx = B.x + r() * B.w, cy = B.y + r() * B.h;
        const L = clamp(lerp(0.3, 0.8, r()) * Math.max(B.w, B.h), 24, 320);
        const aa = ang + (r() - 0.5) * 0.35;
        const ca = Math.cos(aa), sa = Math.sin(aa);
        const bend = (r() - 0.5) * L * 0.12;
        ctx.globalAlpha = base * lerp(0.1, 0.24, r());
        ctx.strokeStyle = r() < 0.6 ? dark : light;
        ctx.lineWidth = lerp(3, clamp(Math.min(B.w, B.h) * 0.12, 5, 16), r());
        ctx.beginPath();
        ctx.moveTo(cx - (ca * L) / 2, cy - (sa * L) / 2);
        ctx.quadraticCurveTo(cx - sa * bend, cy + ca * bend, cx + (ca * L) / 2, cy + (sa * L) / 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    // the pigment dries a little darker at the edge
    const rim = o.rim != null ? o.rim : 0.18;
    if (rim > 0) {
      ctx.globalAlpha = base * rim;
      ctx.strokeStyle = lib.mix(color, pal.ink, 0.22);
      ctx.lineWidth = 1.6;
      ctx.lineJoin = 'round';
      ring(soft * 0.15, seed + 3, soft * 0.25 + 0.4);
      ctx.stroke();
    }
    ctx.restore();
  };

  lib.pencil = (ctx, pts, o = {}) => {
    const color = o.color || (o.base ? lib.mix(o.base, pal.ink, 0.32) : pal.trunk);
    inkPath(ctx, pts, {
      closed: !!o.closed,
      width: o.width != null ? o.width : 2.2,
      color,
      alpha: o.alpha != null ? o.alpha : 0.9,
      seed: o.seed,
      smooth: o.smooth,
      draw: o.draw,
      boil: false,
      wobble: o.wobble != null ? o.wobble : 1.1,
      tremble: 0.45,
      rough: 0.5,
      widthJitter: 0.45,
      taper: o.closed ? [5, 9] : [6, 10],
      minWidth: 0.35,
      overlap: 8,
      double: o.double === false ? false : { offset: 1.1, width: 0.5, alpha: 0.4 },
    });
  };

  lib.ragged = (ctx, pts, o = {}) => {
    if (!pts || pts.length < 2) return;
    const color = o.color || (o.base ? lib.mix(o.base, pal.ink, 0.45) : '#545945');
    const P = lib.smoothPts(pts, !!o.closed, 4);
    if (o.closed) P.push(P[0]);
    const S = [0];
    for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const L = S[S.length - 1];
    const seed = seedInt(o.seed == null ? 1 : o.seed);
    const r = rng(hash('ragged', seed));
    const w = o.width != null ? o.width : 4;
    let s = 0, k = 0;
    while (s < L - 2) {
      const a = s, b = Math.min(L, s + lerp(40, 150, r()));
      const piece = [];
      for (let i = 0; i < P.length; i++) if (S[i] >= a && S[i] <= b) piece.push(P[i]);
      if (piece.length >= 2) {
        inkPath(ctx, piece, {
          width: w, color, alpha: o.alpha != null ? o.alpha : 0.95, seed: seed + k * 13, boil: false, smooth: false,
          wobble: 1.4, tremble: 0.7, rough: 1.1, widthJitter: 0.6, swell: 0.3, taper: [6, 10], minWidth: 0.25,
        });
      }
      s = b + lerp(3, 9, r());
      k++;
    }
  };

  /*
   * dense: the machine plate's ground (docs/art-bible.md 4.3, R11). A muted middle tone; large
   * scumbled patches lighter and darker than it; long dry streaks along the surface; short strokes
   * 9 to 15 px in three close tones (two darks and a light), clustered, along the surface with some
   * scatter. Walls 'vertical', floors 'perspective' toward vp, skies 'swirl' around vp. Built once
   * per option set and cached; the clip is applied when the cached texture is drawn.
   */
  function muteColor(c, k) {
    const [r, g, b] = parseColor(c);
    const L = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    return lib.mix(c, `rgb(${L},${L},${L})`, k);
  }
  lib.dense = (ctx, clip, o = {}) => {
    const B = normBounds(o.bounds);
    const S = renderScale();
    const base = muteColor(o.base || pal.pavement, o.mute != null ? o.mute : 0.45);
    const opt = {
      x: B.x, y: B.y, w: B.w, h: B.h,
      base,
      dark: o.dark || lib.mix(base, pal.ink, 0.44),
      dark2: lib.mix(base, pal.ink, 0.27),
      light: o.light || lib.mix(base, pal.paper, 0.3),
      patchLight: lib.mix(base, pal.paper, 0.44),
      patchDark: lib.mix(base, pal.ink, 0.28),
      cover: o.cover || [0.16, 0.05],
      len: o.len || 12,
      width: o.width || 4,
      patches: o.patches != null ? o.patches : 1,
      streaks: o.streaks != null ? o.streaks : 1,
      scribble: o.scribble != null ? o.scribble : 0.5,
      dir: o.dir != null ? o.dir : 'vertical',
      vp: o.vp || [B.x + B.w / 2, B.y + B.h / 2],
      seed: seedInt(o.seed == null ? 29 : o.seed),
    };
    const key = 'dense|' + S + '|' + JSON.stringify(opt);
    const c = cached(key, () => makeDense(opt, S));
    ctx.save();
    if (clip) {
      const sh = shapeOf(clip, o);
      if (sh.apply) sh.apply(ctx);
    }
    ctx.drawImage(c, B.x, B.y, B.w, B.h);
    ctx.restore();
  };

  function makeDense(o, S) {
    const c = newCanvas(Math.max(1, Math.round(o.w * S)), Math.max(1, Math.round(o.h * S)));
    const g = c.getContext('2d');
    g.scale(S, S);
    g.fillStyle = o.base;
    g.fillRect(0, 0, o.w, o.h);
    const r = rng(o.seed);
    const vx = o.vp[0] - o.x, vy = o.vp[1] - o.y;
    const angleAt = (x, y) => {
      if (typeof o.dir === 'number') return o.dir;
      if (o.dir === 'horizontal') return 0;
      if (o.dir === 'perspective') return Math.atan2(y - vy, x - vx);
      if (o.dir === 'swirl') return Math.atan2(y - vy, x - vx) + Math.PI / 2 + 0.9 * noise2(x * 0.004, y * 0.004, o.seed + 7);
      return Math.PI / 2;
    };
    const area = o.w * o.h;
    const seg = (x, y, a, L, bend) => {
      const ca = Math.cos(a), sa = Math.sin(a);
      g.moveTo(x - (ca * L) / 2, y - (sa * L) / 2);
      g.quadraticCurveTo(x - sa * bend, y + ca * bend, x + (ca * L) / 2, y + (sa * L) / 2);
    };
    g.lineCap = 'round';
    // 1 tone in patches: dry-brush strokes (bristles broken where the brush ran dry) where a slow
    // field is high (lighter paint) or low (darker paint), so the tone changes with a painted edge
    for (let i = 0, n = Math.round((area / 850) * o.patches); i < n; i++) {
      const x = r() * o.w, y = r() * o.h;
      const v = lib.fbm2(x * 0.0032, y * 0.0032, o.seed + 11, 3);
      if (Math.abs(v) < 0.06) continue;
      const a = angleAt(x, y) + (r() - 0.5) * 0.45;
      const L = lerp(50, 150, r());
      const ca = Math.cos(a), sa = Math.sin(a), bend = (r() - 0.5) * 18;
      const P = [];
      for (let k = 0; k <= 6; k++) {
        const u = k / 6 - 0.5;
        P.push([x + ca * u * L - sa * bend * (1 - 4 * u * u), y + sa * u * L + ca * bend * (1 - 4 * u * u)]);
      }
      dryBrush(g, P, lerp(18, 46, r()), v > 0 ? o.patchLight : o.patchDark, Math.min(0.95, Math.abs(v) * 2.2) * lerp(0.6, 1, r()), o.seed + i * 7);
    }
    // 2 long dry streaks along the surface, broken where the brush ran dry
    for (let i = 0, n = Math.round((area / 7000) * o.streaks); i < n; i++) {
      const x = r() * o.w, y = r() * o.h;
      g.globalAlpha = lerp(0.3, 0.65, r());
      g.strokeStyle = r() < 0.6 ? o.dark : o.light;
      g.lineWidth = lerp(1.6, 4, r());
      g.setLineDash([lerp(12, 50, r()), lerp(3, 12, r()), lerp(8, 30, r()), lerp(3, 10, r())]);
      g.beginPath();
      seg(x, y, angleAt(x, y) + (r() - 0.5) * 0.2, lerp(50, 170, r()), (r() - 0.5) * 16);
      g.stroke();
    }
    g.setLineDash([]);
    // 3 short strokes, 9 to 15 px, in three close tones, gathered in loose clusters
    const spread = 0.4 + o.scribble * 1.4;
    const layer = (col, cover, widthK) => {
      if (!(cover > 0)) return;
      const n = Math.round(((area * cover) / (o.len * o.width * widthK)) * 2.2);
      const paths = [new Path2D(), new Path2D(), new Path2D()];
      for (let i = 0; i < n; i++) {
        const x = r() * o.w, y = r() * o.h;
        // strokes gather where a field is high: thick scribbled zones beside quieter painted ones
        if (r() > smoothstep(-0.3, 0.45, noise2(x * 0.006, y * 0.006, o.seed + 3))) continue;
        const a = angleAt(x, y) + (r() - 0.5) * spread;
        const L = o.len * lerp(0.55, 1.3, r());
        const ca = Math.cos(a), sa = Math.sin(a), bend = (r() - 0.5) * L * 0.3;
        const p = paths[(r() * 3) | 0];
        p.moveTo(x - (ca * L) / 2, y - (sa * L) / 2);
        p.quadraticCurveTo(x - sa * bend, y + ca * bend, x + (ca * L) / 2, y + (sa * L) / 2);
      }
      g.strokeStyle = col;
      [0.75, 1, 1.3].forEach((k, j) => {
        g.lineWidth = o.width * widthK * k;
        g.globalAlpha = alphaK * [0.75, 0.88, 1][j];
        g.stroke(paths[j]);
      });
    };
    let alphaK = 0.92;
    layer(o.dark2, o.cover[0] * 0.55, 0.9);
    layer(o.dark, o.cover[0] * 0.45, 0.85);
    alphaK = 0.7;
    layer(o.light, o.cover[1], 0.8);
    g.globalAlpha = 1;
    return c;
  }

  lib.plate = (ctx, key, fn, o = {}) => {
    const w = o.w || W(), h = o.h || H();
    const S = renderScale();
    const c = cached(`plate|${key}|${w}|${h}|${S}`, () => {
      const cv = newCanvas(Math.max(1, Math.round(w * S)), Math.max(1, Math.round(h * S)));
      const g = cv.getContext('2d');
      g.scale(S, S);
      fn(g);
      return cv;
    });
    ctx.drawImage(c, o.x || 0, o.y || 0, w, h);
  };

  // one scratch layer for wallShadow, cleared on every use, so nothing carries between frames
  let shadowLayer = null;
  lib.wallShadow = (ctx, draw, o = {}) => {
    const cv = ctx.canvas;
    if (!shadowLayer || shadowLayer.width !== cv.width || shadowLayer.height !== cv.height) shadowLayer = newCanvas(cv.width, cv.height);
    const g = shadowLayer.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, cv.width, cv.height);
    g.setTransform(ctx.getTransform());
    g.translate(o.dx || 0, o.dy || 0);
    draw(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-in';
    const k = Math.round(255 * clamp(o.k != null ? o.k : 0.57));
    g.fillStyle = `rgb(${k},${k},${k})`;
    g.fillRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = 'source-over';
    ctx.save();
    if (o.clip) {
      const sh = shapeOf(o.clip, o);
      if (sh.apply) sh.apply(ctx);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(shadowLayer, 0, 0);
    ctx.restore();
  };

  lib.speedLines = (ctx, x, y, angle, o = {}) => {
    const n = o.n || 5;
    const spread = o.spread != null ? o.spread : 120;
    const len = o.len || [60, 150];
    const gap = o.gap != null ? o.gap : 24;
    const r = rng(hash('speed', o.seed == null ? 1 : o.seed));
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const nx = -dy, ny = dx;
    for (let i = 0; i < n; i++) {
      const off = (n > 1 ? i / (n - 1) - 0.5 : 0) * spread + (r() - 0.5) * (spread / n) * 0.8;
      const L = lerp(len[0], len[1], r());
      const back = gap + r() * gap;
      const x0 = x - dx * back + nx * off, y0 = y - dy * back + ny * off;
      inkPath(ctx, [[x0, y0], [x0 - dx * L, y0 - dy * L]], {
        width: o.width || 4, color: o.color || pal.pavement, alpha: o.alpha, boil: false, smooth: false,
        taper: [L * 0.25, L * 0.55], minWidth: 0.08, wobble: 0.6, tremble: 0.2, seed: (o.seed || 1) * 7 + i,
      });
    }
  };

  lib.impactStar = (ctx, x, y, r, o = {}) => {
    const rays = o.rays || 9;
    const rot = o.rot || 0;
    const rr = rng(hash('star', o.seed == null ? 1 : o.seed));
    const outer = [], inner = [];
    for (let i = 0; i < rays * 2; i++) {
      const a = rot + (i * Math.PI) / rays + (rr() - 0.5) * 0.12;
      const long = i % 2 === 0;
      const k = long ? lerp(0.72, 1, rr()) : lerp(0.26, 0.36, rr());
      outer.push([x + Math.cos(a) * r * k, y + Math.sin(a) * r * k]);
      inner.push([x + Math.cos(a) * r * k * (long ? 0.5 : 0.62), y + Math.sin(a) * r * k * (long ? 0.5 : 0.62)]);
    }
    ctx.save();
    ctx.globalAlpha *= o.alpha != null ? o.alpha : 1;
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    lib.tracePath(ctx, outer, true);
    ctx.fill();
    ctx.fillStyle = o.heart || pal.red;
    ctx.beginPath();
    lib.tracePath(ctx, inner, true);
    ctx.fill();
    ctx.restore();
  };

  // one dry-brush stroke: a few bristles side by side, each broken where the brush ran dry
  function dryBrush(ctx, P, width, color, alpha, seed) {
    if (P.length < 2) return;
    const r = rng(hash('dry', seed));
    const { NX, NY } = openNormals(P);
    const bristles = Math.max(3, Math.round(width / 5));
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    for (let b = 0; b < bristles; b++) {
      const off = (b / (bristles - 1) - 0.5) * width;
      const dash = [lerp(18, 60, r()), lerp(3, 12, r()), lerp(10, 40, r()), lerp(4, 16, r())];
      ctx.setLineDash(dash);
      ctx.lineDashOffset = r() * 40;
      ctx.lineWidth = lerp(0.35, 0.6, r()) * (width / bristles) * 1.6;
      ctx.globalAlpha = alpha * lerp(0.55, 1, r());
      ctx.beginPath();
      for (let i = 0; i < P.length; i++) {
        const taper = Math.sin(Math.PI * clamp(i / (P.length - 1)));
        const x = P[i][0] + NX[i] * off * (0.35 + 0.65 * taper), y = P[i][1] + NY[i] * off * (0.35 + 0.65 * taper);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function openNormals(P) {
    const n = P.length;
    const NX = new Float64Array(n), NY = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      const tx = b[0] - a[0], ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1;
      NX[i] = -ty / l;
      NY[i] = tx / l;
    }
    return { NX, NY };
  }

  lib.smear = (ctx, pts, o = {}) => {
    if (!pts || pts.length < 2) return;
    const cols = o.colors || [pal.red];
    const width = o.width || 60;
    const strands = o.strands || 5;
    const P = lib.smoothPts(pts, false, 5);
    const { NX, NY } = openNormals(P);
    const seed = o.seed == null ? 1 : o.seed;
    const base = o.alpha != null ? o.alpha : 1;
    for (let s = 0; s < strands; s++) {
      const off = (strands > 1 ? s / (strands - 1) - 0.5 : 0) * width;
      const r = rng(hash('smear', seed, s));
      const Q = P.map((p, i) => {
        const u = i / (P.length - 1);
        const sw = off * (0.4 + 0.6 * u) + (r() - 0.5) * width * 0.08;
        return [p[0] + NX[i] * sw, p[1] + NY[i] * sw];
      });
      // the tail is the faint end: draw the path in four lengths, fainter toward the tail
      const q = Math.floor(Q.length / 4);
      for (let k = 0; k < 4; k++) {
        const seg = Q.slice(k * q, k === 3 ? Q.length : (k + 1) * q + 1);
        dryBrush(ctx, seg, (width / strands) * 1.3, cols[s % cols.length], base * (0.3 + 0.23 * k), seed * 31 + s * 7 + k);
      }
    }
  };

  lib.dust = (ctx, x, y, o = {}) => {
    const p = clamp(o.p != null ? o.p : 0.5);
    if (p >= 1) return;
    const R = (o.r || 50) * (0.55 + 0.75 * p);
    const n = o.n || 4;
    const dir = o.dir != null ? o.dir : Math.PI;
    const color = o.color || pal.pavement;
    const r = rng(hash('dust', o.seed == null ? 1 : o.seed));
    // n grey swipes fanning back and up from (x, y), drifting out and fading as p grows (R22)
    const up = Math.cos(dir) < 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0.5;
      const ang = dir + up * (0.08 + 0.4 * t + (r() - 0.5) * 0.1);
      const u = [Math.cos(ang), Math.sin(ang)], nrm = [-u[1] * up, u[0] * up];
      const d0 = R * (0.1 + 0.4 * p);
      const len = R * lerp(1.0, 1.5, r()) * (1 + 0.4 * p) * (1 - 0.15 * t);
      const bow = len * 0.14;
      const P = [];
      for (let k = 0; k <= 8; k++) {
        const v = k / 8;
        const b = Math.sin(Math.PI * v) * bow;
        P.push([x + u[0] * (d0 + len * v) + nrm[0] * b, y + u[1] * (d0 + len * v) + nrm[1] * b]);
      }
      dryBrush(ctx, P, R * lerp(0.22, 0.32, r()) * (1 - 0.2 * t), color, (1 - p) * 0.9, (o.seed || 1) * 17 + i);
    }
  };

  /** footShadow(ctx, x, y, rx, o): the one falling shadow, a flat spot under the feet (STYLE.md 2). */
  lib.footShadow = (ctx, x, y, rx, o = {}) => {
    const ground = o.ground || (o.machine ? pal.pavement : pal.cityPastel);
    ctx.save();
    ctx.globalAlpha *= o.alpha != null ? o.alpha : 0.35;
    ctx.fillStyle = o.color || lib.mix(ground, pal.ink, 0.55);
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(1, rx), Math.max(1, o.ry != null ? o.ry : rx * 0.2), 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  lib.puff = (ctx, x, y, o = {}) => {
    const p = clamp(o.p != null ? o.p : 0.3);
    if (p >= 1) return;
    const dir = o.dir != null ? o.dir : -0.35;
    const dist = (o.drift != null ? o.drift : 60) * p;
    const cx = x + Math.cos(dir) * dist, cy = y + Math.sin(dir) * dist;
    const L = (o.len || 70) * (0.6 + 0.4 * p);
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16, wv = Math.sin(u * TAU * 1.2) * L * 0.12;
      pts.push([cx + Math.cos(dir) * u * L - Math.sin(dir) * wv, cy + Math.sin(dir) * u * L + Math.cos(dir) * wv]);
    }
    dryBrush(ctx, pts, o.width || 24, o.color || lib.mix(pal.hillsFar, pal.pavement, 0.5), 1 - p * 0.8, (o.seed || 1) * 13);
  };

  function fullFrame(ctx, color, k) {
    k = clamp(k);
    if (k <= 0) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = k;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }
  lib.dipBlack = (ctx, k) => fullFrame(ctx, '#000000', k);
  lib.dipWhite = (ctx, k) => fullFrame(ctx, pal.paper, k);

  // Hand lettering faces (system fonts, no font files). 'round' is the bold rounded title face of
  // the street plate (art bible 9.1), 'note' the handwritten face of signs, tickets and the machine
  // plate (9.2). The tools load them before the first frame is drawn.
  const LETTER_FACES = {
    round: '"Arial Rounded MT Bold", "SF Pro Rounded", ui-rounded, "Chalkboard SE", sans-serif',
    note: '"Chalkboard SE", "Marker Felt", "Comic Sans MS", cursive',
  };
  lib.LETTER_FACES = LETTER_FACES;

  lib.letters = (ctx, str, x, y, o = {}) => {
    const chars = Array.from(String(str));
    const size = o.size || 60;
    const face = o.face === 'note' ? 'note' : 'round';
    const jit = o.jitter != null ? o.jitter : 1;
    const seed = o.seed == null ? 1 : o.seed;
    ctx.save();
    ctx.font = `700 ${size}px ${LETTER_FACES[face]}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    const kx = o.squeeze != null ? o.squeeze : 1; // every letter narrowed, its height kept
    const track = (o.tracking != null ? o.tracking : 0.04) * size * kx;
    const widths = chars.map((c) => ctx.measureText(c).width * kx);
    const total = widths.reduce((a, b) => a + b, 0) + track * Math.max(0, chars.length - 1);
    const align = o.align || 'left';
    let cx = align === 'center' ? -total / 2 : align === 'right' ? -total : 0;
    const b = o.baseline || 'alphabetic';
    const dy0 = b === 'middle' ? size * 0.36 : b === 'top' ? size * 0.74 : 0;
    const shown = o.p == null ? chars.length : Math.round(chars.length * clamp(o.p));
    const outline = o.outline || null;
    const ow = o.outlineWidth != null ? o.outlineWidth : Math.max(2.5, size * 0.07);
    // each letter is re-inked at its own weight (0 = the face as it is)
    const inkK = (o.ink != null ? o.ink : face === 'note' ? 1 : 0.4) * jit;
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const mx = cx + widths[i] / 2;
      cx += widths[i] + track;
      if (o.measure || i >= shown || ch.trim() === '') continue;
      const r = rng(hash('letter', seed, String(str), i));
      const turn = (r() * 2 - 1) * 5 * (Math.PI / 180) * jit;
      const lift = (r() * 2 - 1) * 0.08 * size * jit;
      const sc = 1 + (r() * 2 - 1) * 0.06 * jit;
      const sx = 1 + (r() * 2 - 1) * 0.05 * jit;
      const weight = size * (0.006 + 0.03 * r()) * inkK;
      let px = mx, py = dy0 + lift, pr = turn;
      if (o.arc) {
        // letters stand on an arc of radius o.arc whose centre is below the line (negative: above)
        const a = mx / o.arc;
        px = Math.sin(a) * o.arc;
        py = dy0 + lift + o.arc - Math.cos(a) * o.arc;
        pr += a;
      }
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(pr);
      ctx.scale(sc * sx * kx, sc);
      ctx.lineJoin = 'round';
      if (outline) {
        ctx.lineWidth = ow * 2 + weight;
        ctx.strokeStyle = outline;
        ctx.strokeText(ch, 0, 0);
      }
      const fillC = (o.colors && o.colors[i % o.colors.length]) || (i === 0 && o.firstColor) || o.color || pal.ink;
      ctx.fillStyle = fillC;
      ctx.fillText(ch, 0, 0);
      if (weight > 0.5) {
        ctx.lineWidth = weight;
        ctx.strokeStyle = fillC;
        ctx.strokeText(ch, 0, 0);
      }
      ctx.restore();
    }
    ctx.restore();
    const left = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    return { x0: left, x1: left + total, y0: y + dy0 - size * 0.76, y1: y + dy0 + size * 0.22, w: total };
  };

  lib.blobPts = (cx, cy, rx, ry, seed = 1, irr = 0.14, n = 56) => {
    const s = seedInt(seed);
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const k = 1 + irr * (noise2(Math.cos(a) * 1.3, Math.sin(a) * 1.3, s) + 0.45 * noise2(Math.cos(a) * 3.1, Math.sin(a) * 3.1, s + 1));
      out.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return out;
  };

  lib.spot = (ctx, cx, cy, rx, ry, o = {}) =>
    lib.softWash(ctx, lib.blobPts(cx, cy, rx, ry, o.seed == null ? 1 : o.seed, o.irr != null ? o.irr : 0.14), {
      color: o.color || pal.titleSpot,
      alpha: o.alpha != null ? o.alpha : 0.95,
      soft: o.soft != null ? o.soft : Math.min(rx, ry) * 0.22,
      marks: o.marks != null ? o.marks : 0.5,
      rim: o.rim != null ? o.rim : 0.1,
      seed: o.seed,
    });
  // ===========================================================================
  // Cast and props of "One burger, two prices" (docs/art-bible.md section 10)
  // ===========================================================================
  /*
   * Every scene draws the characters and the recurring objects with these functions and never
   * redraws them itself, so nobody drifts from shot to shot. All of them:
   *   - take (ctx, x, y, o): (x, y) is a ground point or a named anchor (each entry says which), and
   *     the size is in frame pixels (o.h or o.w)
   *   - draw at the constant line width: o.line, default LINE 4.5 (LINE_XCU 11 on an extreme close-up)
   *   - take the brush line on the machine plate: o.plate 'street' | 'machine' (default: the shot's mode)
   *   - quantise their own cycles on twos from o.t (seconds) unless o.ones is true
   *   - return anchors in frame pixels; scenes hang things on anchors instead of guessing pixels
   *   - accept o.rig: joint targets in design units that override the pose (see the rig of each)
   *   - draw their own shadow spot on the ground (o.shadow false to leave it out, o.ground the
   *     color under them that the spot darkens)
   *
   * lib.cast
   *   hero(ctx, x, y, o)     the boy. (x, y): ground under him (on the bicycle: under the bottom bracket,
   *                          halfway between the wheels). o.h his standing height px; every pose keeps it.
   *     o.facing 1 right | -1 left, o.view 'side' (three-quarter, default) | 'front', o.rot (whole figure, radians)
   *     o.pose
   *       'stand'                       standing, arms down
   *       'ride'                        pedalling: o.phase 0..1 per crank turn, or o.t with o.cadence
   *                                     (turns per second); o.cycle 4 snaps the crank to 4 drawings a turn;
   *                                     o.bob (frame px, + down) sinks or lifts the body on any bicycle pose,
   *                                     hands stay on the grips and feet on the pedals
   *       'crouch', 'dash'              squashed over the bars before the dash; stretched forward in it (ones)
   *       'straddle'                    on the bicycle at rest, near foot on the ground, hands on the grips
   *       'skid'                        the stop: bicycle tipped back 4 degrees, rider leaning back, foot down
   *       'coins', 'slap'               straddling, a fist of coins held up; the hand slapped down on o.target
   *       'snatch'                      the near arm shoots to o.target [x, y] px (draw it on ones, add a smear)
   *       'sill'                        front view, both hands on a ledge at o.target[1]
   *       'bite'                        o.k: open 0-1/3 (burger up), chomp 1/3-2/3, chew 2/3-1; o.bites before;
   *                                     o.biteSide, o.biteSize go to its burger
   *       'pop'                         eyes popped, cap jumps, hands up; o.stalk 0..1.15 shoots the eyes out
   *                                     on stalks toward o.stalkDir (radians, default up and forward)
   *       'turn'                        on foot, o.k: squash, front view, the other side (ends facing -facing)
   *       'spin'                        on the bicycle, o.k: crouch, front view, the other side
   *     o.face   'smile' | 'neutral' | 'grin' | 'open' | 'O' | 'chew' | 'bliss' | 'gulp' | 'lick' | 'jaw' |
   *              'glare' | 'determined' | 'sniff' | 'pant' | 'pop' | 'sad'
   *     o.chewPhase 0..1 with 'chew' (the scene sets it, e.g. 1 / 0.5 / 0 on twos): the jaw drops up to a
   *              tenth of the head's lower half and the mouth opens; without it 'chew' is the shut wavy mouth
   *     o.iris (scales the irises, default 1), o.gulp 0..1 with 'gulp' (the lump shows under the chin and
   *     travels down; without it the lump stays hidden),
   *     o.blink, o.look [-1..1, -1..1] (pupils), o.tilt (head nod, radians, + forward), o.turn 0..1 (head
   *     front .. three-quarter), o.hold(ctx, anchors) draws what the hands hold between body and near hand
   *     returns { head, headR, eye, eyeFar, mouth, hand, handFar, hold, chest, neck, top, ground,
   *               seat, grip, pedal, axleFront, axleRear, wheelR }
   *   owner(ctx, x, y, o)    the booth's owner. (x, y): ground between his feet. o.h standing height px.
   *     o.facing, o.view 'side' (default) | 'back' (three-quarter from behind: the broad torso, legs and
   *     shadow sit 27 units right of x, under the head; shoulders 112 units apart), o.t, o.k
   *     o.pose
   *       'stand' (tired slump), 'lean' (chin on his hand, elbow on the counter), 'serve' (a burger held
   *       out), 'push' (flat hand forward on the counter at o.target), 'rake' (o.k 0..1 sweeps the hand
   *       back along the counter from o.target), 'tap' (one finger taps, o.k < 0.5 down), 'point' (straight up),
   *       'catch' (o.k < 0.5 open hand up, then closed), 'read' (a ticket, o.lines), 'phone' (the handset
   *       in his hand at the ear), 'listen' (the handset pinned between ear and shoulder, hands forward),
   *       'sigh' (o.k 0..1: the shoulders drop, lids half close; puff from anchors.mouth), 'type' (both
   *       hands tap at o.hold's keypad), 'holdup' (a fist raised to face height: hang the tag from it),
   *       'shrug'
   *     o.face 'tired' | 'bored' | 'surprised' | 'talk' | 'read' | 'yawn' | 'resigned'; o.blink; o.tilt;
   *     o.headTurn 0..1 with view 'back' (the near eye and its brow come round past the cheek)
   *     o.layer 'all' | 'back' | 'front' (front = the arms that reach a counter, and what they hold)
   *     returns { head, headR, mouth, ear, eye, hand, handFar, hold, keys, chest, top, shoulder, shoulderFar, ground }
   *   machine(ctx, x, y, o)  the pricing machine, seen from the front. (x, y): ground between its shoes.
   *     o.h ground to the top of the box px (660 draws storyboard G3 at its own pixels from (540, 1480))
   *     o.pose 'idle' | 'gulp' (o.k: the hopper neck squeezes and swells, the body squashes 4 percent) |
   *       'print' (o.k 0..1 pushes the ticket out; it shudders on ones while it prints) | 'think' |
   *       'crouch' | 'hop'
   *     o.scope 0 (periscope down) .. 1 (up), o.look, o.blink, o.level 0..1 (needle LOW .. HIGH),
   *     o.name ('SENSITIVITY TO PRICE'), o.source ('based on willingness to pay in your area'),
   *     o.lines (ticket, ['RECOMMENDED:', '$6.89']), o.shake (frame px, signed: the body's shudder; without it
   *     'print' and 'think' shudder on their own from o.t), o.ticketRot (radians, the strip about the slot)
   *     returns { slot, ticketTip, ticketTop, hopper, hopperNeck, eye, dial: { x, y, r }, needleTip, top, ground, body }
   * lib.props
   *   burger(x, y: centre)     o.w px (0.69 as tall), o.bites 0..3, o.biteSide 'right' (default) | 'left', o.biteSize
   *                            (first bite's diameter as a share of the width, default 0.36), o.rot.
   *                            Returns { top, bottom, bite, center }
   *   bike(x, y: ground)       o.h hero height px (its scale: wheel radius 47/300 of it), o.phase, o.wheel,
   *                            o.layer 'all'|'far'|'mid'|'near', o.measure (the anchors only, nothing drawn)
   *   priceTag(x, y: card top centre)  o.w, o.h px, o.price, o.swing radians, o.pivot 'strings' | 'top',
   *                            o.hang 'corners' (G1, default) | 'holes' (G4), o.strings 'up' | 'dangle' | 'none',
   *                            o.drop px, o.size (glyph height px, default 2/3 of h), o.baseline (px below the card
   *                            top, default 0.767 h), o.slots [[x0, x1]...]
   *                            (frame x per glyph, G4), o.count (glyphs shown), o.popLast (scale of the newest)
   *   booth(x, y: ground, front centre)  o.w px (580 draws storyboard G1 from (690, 1480)), o.price,
   *                            o.sign, o.swing, o.layer 'all' | 'back' | 'front', o.mode 'bg' | 'cel'.
   *                            Returns { window, shelf, counterY, tagTop, sign, owner, ownerH }
   *   house(x, y: ground)      o.h px, o.kind 'modest' (fence, small window) | 'rich' (columns, gate,
   *                            fountain), o.fence, o.gate, o.fountain, o.mode 'bg' | 'cel'
   *   gauge(x, y: pivot)       o.r px, o.level 0..1, o.labels, o.title ('SENSITIVITY TO PRICE' or false),
   *                            o.caption ('based on willingness to pay in your area' or false)
   *   ticket(x, y: top centre) o.w, o.h px, o.lines ['RECOMMENDED:', '$6.89'], o.rot
   *   phone(x, y: bottom centre)  desk telephone: o.w px, o.lifted (handset off), o.ring with o.t
   *   handset(x, y: centre)    o.w px, o.rot; returns { ear, mouth }
   *   cord(a, b)               a curly cord between two points, o.loops, o.sag
   *   mobile(x, y: centre)     a smartphone: o.h px, o.lines (screen), o.ring with o.t, o.rot
   *   register(x, y: bottom centre)  o.w px, o.drawer 0..1, o.text (display)
   *   keypad(x, y: bottom centre)    o.w px, 3 x 4 keys, o.text (screen strip), o.press key index (0..11),
   *                            o.labels (12 key labels, e.g. '.' for '*'; false for none)
   *   map(x, y: top-left)      o.w, o.h px, o.n dots, o.p reveal, o.style 'city' | 'land', o.mono (all red),
   *                            o.booths (tiny booths), o.pins [{ u, v, label }], o.pulse { idx: [dot indexes],
   *                            k: 0..1 } (those dots swell and settle). Returns { dots, pins }
   *   receipt(x, y), coin(x, y)   centre; o.w px, o.rot; coin o.spin 0..1
   *   flow(pts)                a stream of receipts and coins from pts[0] to the last point; o.t, o.n,
   *                            o.rate (trips per second), o.size, o.kind 'mix' | 'receipt' | 'coin', o.spread
   */
  const DEG = Math.PI / 180;
  const cast = {};
  const props = {};
  const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul2 = (a, k) => [a[0] * k, a[1] * k];
  const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  const len2 = (a) => Math.hypot(a[0], a[1]);
  const dir2 = (a) => [Math.cos(a), Math.sin(a)];
  const rot2 = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
  const angOf = (v) => Math.atan2(v[1], v[0]);
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const stage3 = (k) => (k < 1 / 3 ? 0 : k < 2 / 3 ? 1 : 2);

  /** Two-bone reach: the middle joint between root a and target b, bent toward pref. Stretches past full reach. */
  function ik2(a, b, l1, l2, pref) {
    const d = sub2(b, a);
    let L = len2(d) || 1e-6;
    if (L >= l1 + l2) return lerp2(a, b, l1 / (l1 + l2));
    L = Math.max(L, Math.abs(l1 - l2) + 1e-3);
    const base = angOf(d);
    const c = clamp((l1 * l1 + L * L - l2 * l2) / (2 * l1 * L), -1, 1);
    const k = Math.acos(c);
    const m1 = add2(a, mul2(dir2(base + k), l1));
    const m2 = add2(a, mul2(dir2(base - k), l1));
    const mid = lerp2(a, b, 0.5);
    const s1 = (m1[0] - mid[0]) * pref[0] + (m1[1] - mid[1]) * pref[1];
    const s2 = (m2[0] - mid[0]) * pref[0] + (m2[1] - mid[1]) * pref[1];
    return s1 >= s2 ? m1 : m2;
  }

  function plateIsMachine(o) {
    if (o.plate) return o.plate === 'machine';
    if (!FILM.TIMELINE || typeof FILM.activeShot !== 'function' || typeof FILM.modeOf !== 'function') return false;
    const s = FILM.activeShot(lib.T);
    return !!s && FILM.modeOf(s) === 'schematic';
  }

  /*
   * A figure's drawing kit: maps design units (y up negative, facing +x) to the frame, and draws
   * cels, strokes and tubes at the constant line width. Part ids keep every part's seed fixed, so a
   * part looks the same in every pose and every frame. rot turns the drawing about pivot (design units).
   */
  function kit(x, y, s, f, o, seed, rot = 0, pivot = null) {
    const lw = o.line != null ? o.line : LINE;
    const brush = plateIsMachine(o);
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const pv = pivot || [0, 0];
    const T = (p) => {
      const qx = p[0] - pv[0], qy = p[1] - pv[1];
      const px = f * (qx * cr - qy * sr + pv[0]), py = qx * sr + qy * cr + pv[1];
      return [x + px * s, y + py * s];
    };
    return {
      lw, brush, s, f, T,
      TT: (pts) => pts.map(T),
      // a frame point back to design units (rotation ignored: targets are given for upright figures)
      D: (q) => [(q[0] - x) / (f * s), (q[1] - y) / s],
      cel(ctx, pts, fill, id, extra) {
        lib.cel(ctx, pts.map(T), Object.assign({ fill, width: lw, brush, seed: seed + id * 101 }, extra));
      },
      line(ctx, pts, id, extra) {
        lib.stroke(ctx, pts.map(T), Object.assign({ width: lw, brush, seed: seed + id * 101 }, extra));
      },
      // tubes: polylines in design units merged into one silhouette; an item may be { pts, w } for its own width
      tubes(ctx, list, w, fill, lineW) {
        const lwx = lineW != null ? lineW : lw;
        const items = list.map((p) => (Array.isArray(p) ? { pts: p, w } : p));
        for (const it of items) tube(ctx, it.pts.map(T), it.w * s, pal.ink, lwx);
        for (const it of items) tube(ctx, it.pts.map(T), it.w * s, fill, 0);
      },
      disc(ctx, p, r, fill, alpha) {
        const q = T(p);
        ctx.save();
        if (alpha != null) ctx.globalAlpha *= alpha;
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(q[0], q[1], Math.max(0.5, r * s), 0, TAU);
        ctx.fill();
        ctx.restore();
      },
      text(ctx, str, p, size, extra) {
        const q = T(p);
        return lib.letters(ctx, str, q[0], q[1], Object.assign({ size: size * s, rot: rot * f }, extra));
      },
    };
  }
  const ell = (cx, cy, rx, ry, rot = 0, n = 36) => lib.ellipsePts(cx, cy, rx, ry, n, rot);
  // cap height of the lettering faces as a fraction of the font size, measured on this machine's
  // Chromium (H: 0.74 and 0.705, digits: 0.735 and 0.72)
  const CAP = { round: 0.74, note: 0.71 };

  /*
   * Type 1 eye (art bible 10.1): white oval, thin contour, coloured iris, black pupil, white glint,
   * lashes for the child. c, rx, ry in frame px. o: look [-1..1, -1..1], lid 0 (open) .. 1 (shut),
   * iris colour or null, lashes 0..5, side 1 | -1 (the eye's outer side), ew contour width, seed.
   */
  function eyeOpen(ctx, c, rx, ry, o) {
    const ew = o.ew;
    const pts = ell(c[0], c[1], rx, ry, 0, 32);
    if (o.lid >= 0.95) {
      // a ball that stands out of its head (the machine's lens) is covered by a lid of the head's color
      if (o.ball) lib.cel(ctx, pts, { fill: o.skin, width: ew, seed: o.seed });
      lib.stroke(ctx, [[c[0] - rx, c[1]], [c[0], c[1] + ry * 0.28], [c[0] + rx, c[1]]], { width: ew * 1.15, seed: o.seed });
      return;
    }
    lib.cel(ctx, pts, { fill: pal.white, width: ew, seed: o.seed });
    ctx.save();
    ctx.beginPath();
    lib.tracePath(ctx, pts, true);
    ctx.clip();
    const lk = o.look || [0, 0];
    const ir = o.irisR != null ? o.irisR : rx * 0.66;
    const ix = c[0] + lk[0] * (rx - ir * 0.75), iy = c[1] + lk[1] * (ry - ir * 0.75) + ry * 0.05;
    ctx.fillStyle = o.iris || pal.ink;
    ctx.beginPath();
    ctx.arc(ix, iy, ir, 0, TAU);
    ctx.fill();
    if (o.iris) {
      ctx.fillStyle = pal.ink;
      ctx.beginPath();
      ctx.arc(ix, iy, ir * 0.56, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = pal.white;
    ctx.beginPath();
    ctx.arc(ix - ir * 0.32, iy - ir * 0.36, Math.max(1.2, ir * 0.28), 0, TAU);
    ctx.fill();
    if (o.lid > 0) {
      const ly = c[1] - ry + o.lid * ry * 2;
      ctx.fillStyle = o.skin;
      ctx.fillRect(c[0] - rx - 2, c[1] - ry - 2, rx * 2 + 4, ly - (c[1] - ry) + 2);
    }
    ctx.restore();
    if (o.lid > 0) {
      const ly = c[1] - ry + o.lid * ry * 2;
      const hw = rx * Math.sqrt(Math.max(0, 1 - Math.pow((ly - c[1]) / ry, 2)));
      lib.stroke(ctx, [[c[0] - hw - 1, ly], [c[0] + hw + 1, ly]], { width: ew * 1.2, seed: o.seed + 5, taper: [2, 2] });
    }
    lib.cel(ctx, pts, { width: ew, seed: o.seed });
    const n = o.lashes || 0;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + o.side * (0.35 + i * 0.32);
      const p0 = [c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry];
      const p1 = [c[0] + Math.cos(a) * rx * 1.3, c[1] + Math.sin(a) * ry * 1.2 - ry * 0.04];
      lib.stroke(ctx, [p0, p1], { width: ew, seed: o.seed + 11 + i, taper: [1, ew * 1.5] });
    }
  }

  /*
   * A hand: 'fist' (holding, gripping), 'open' (palm, three fingers and the thumb), 'point' (the
   * index finger out). p wrist point and a forearm direction in design units; size = hand radius.
   */
  function drawHand(ctx, K, p, dirA, size, kind, fill, id, thumbSide) {
    const d = dir2(dirA);
    const nrm = [-d[1] * thumbSide, d[0] * thumbSide];
    const c = add2(p, mul2(d, size * 0.55));
    const crease = Math.max(2.5, K.lw * 0.6);
    if (kind === 'open') {
      const parts = [];
      for (let i = 0; i < 3; i++) {
        const a = dirA + (i - 1) * 0.45 * thumbSide;
        const base = add2(c, add2(mul2(d, size * 0.3), mul2(nrm, (1 - i) * size * 0.36)));
        parts.push({ pts: [base, add2(base, mul2(dir2(a), size * (0.95 - Math.abs(i - 1) * 0.12)))], w: size * 0.3 });
      }
      const tb = add2(c, mul2(nrm, size * 0.38));
      parts.push({ pts: [tb, add2(tb, mul2(dir2(dirA - thumbSide * 1.15), size * 0.6))], w: size * 0.38 });
      parts.push({ pts: [sub2(c, mul2(d, size * 0.25)), add2(c, mul2(d, size * 0.2))], w: size * 0.95 });
      K.tubes(ctx, parts, size, fill);
      for (let i = 0; i < 2; i++) {
        const q0 = add2(c, add2(mul2(d, size * 0.42), mul2(nrm, (0.5 - i) * size * 0.3)));
        K.line(ctx, [q0, add2(q0, mul2(d, -size * 0.1))], id + 3 + i, { width: crease, taper: [1, 2] });
      }
      return c;
    }
    if (kind === 'point') {
      const base = add2(c, add2(mul2(d, size * 0.3), mul2(nrm, size * 0.22)));
      K.tubes(ctx, [{ pts: [base, add2(base, mul2(d, size * 1.0))], w: size * 0.36 }, { pts: [c, c], w: size * 1.15 }], size, fill);
      K.line(ctx, [add2(c, add2(mul2(d, size * 0.1), mul2(nrm, -size * 0.55))), add2(c, add2(mul2(d, size * 0.38), mul2(nrm, -size * 0.2)))], id + 1, { width: crease, taper: [1, 2] });
      const th = add2(c, mul2(nrm, size * 0.48));
      K.cel(ctx, ell(th[0], th[1], size * 0.38, size * 0.2, dirA + 0.3 * thumbSide, 16), fill, id + 4);
      return add2(base, mul2(d, size * 1.0));
    }
    const pts = ell(c[0], c[1], size * 0.72, size * 0.6, dirA, 24);
    K.cel(ctx, pts, fill, id);
    for (let i = 0; i < 2; i++) {
      const q = add2(c, add2(mul2(d, size * (0.15 + i * 0.28)), mul2(nrm, -size * 0.6)));
      K.line(ctx, [q, add2(q, mul2(nrm, size * 0.34))], id + 1 + i, { width: crease, taper: [1, 2] });
    }
    const th = add2(c, add2(mul2(d, -size * 0.05), mul2(nrm, size * 0.42)));
    K.cel(ctx, ell(th[0], th[1], size * 0.42, size * 0.22, dirA + 0.35 * thumbSide, 16), fill, id + 4);
    return c;
  }

  /** Sutherland-Hodgman: the part of polygon subj inside the convex polygon clip (c: a point inside clip). */
  function clipConvex(subj, clip, c) {
    let out = subj;
    for (let i = 0; i < clip.length && out.length; i++) {
      const a = clip[i], b = clip[(i + 1) % clip.length];
      const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      const sc = side(c);
      const inp = out;
      out = [];
      for (let j = 0; j < inp.length; j++) {
        const p = inp[j], q = inp[(j + 1) % inp.length];
        const sp = side(p) * sc, sq = side(q) * sc;
        if (sp >= 0) out.push(p);
        if ((sp >= 0) !== (sq >= 0)) out.push(lerp2(p, q, sp / (sp - sq)));
      }
    }
    return out;
  }

  /*
   * No seams (STYLE.md 5, 9): a limb drawn over the body must not close its contour across the joint
   * like a cut-out piece. limbTube draws the tube pts (design units) of width w, and leaves its outline
   * out where it lies on the body (bodyDesign, its outline in design units) within reach of the joint.
   * Nothing is painted over, so the collar, the apron and the other arm stay whole.
   */
  function limbTube(ctx, K, pts, w, color, bodyDesign, joint) {
    const P = pts.map(K.T);
    let cut = null;
    if (bodyDesign) {
      const B = lib.smoothPts(K.TT(bodyDesign), true, 4);
      const { NX, NY } = inwardNormals(B);
      const d = K.lw * 0.8;
      const inset = B.map((p, i) => [p[0] + NX[i] * d, p[1] + NY[i] * d]);
      const c = K.T(joint), r = (w / 2) * K.s + K.lw + 1.5;
      const disc = [];
      for (let i = 0; i < 28; i++) disc.push([c[0] + Math.cos((i / 28) * TAU) * r, c[1] + Math.sin((i / 28) * TAU) * r]);
      cut = clipConvex(inset, disc, c);
    }
    ctx.save();
    if (cut && cut.length > 2) {
      ctx.beginPath();
      ctx.rect(-1e5, -1e5, 2e5, 2e5);
      cut.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.clip('evenodd');
    }
    tube(ctx, P, w * K.s, pal.ink, K.lw);
    ctx.restore();
    tube(ctx, P, w * K.s, color, 0);
  }

  /** A shoe under the ankle a (design units), toe along angle ang; len and height in design units. */
  function drawShoe(ctx, K, a, ang, len, ht, front, fill, id) {
    const L = lerp(len * 0.42, len, front);
    const local = [
      [-L * 0.3, -1], [-L * 0.3, -ht * 0.62], [-L * 0.08, -ht], [L * 0.32, -ht * 0.86], [L * 0.62, -ht * 0.66],
      [L * 0.8, -ht * 0.36], [L * 0.82, 0], [L * 0.6, ht * 0.14], [-L * 0.12, ht * 0.14],
    ];
    const pts = local.map((q) => add2(a, rot2([q[0], q[1] + ht * 0.55], ang)));
    K.cel(ctx, pts, fill, id);
    return add2(a, rot2([L * 0.3, ht * 0.55], ang));
  }

  // ---------------------------------------------------------------------------
  // The bicycle (design units of the hero: the hero stands 300 tall; wheel radius 47, saddle and bars
  // raised, so a boy of his proportions reaches the pedals and stands over it with a foot down)
  // ---------------------------------------------------------------------------
  const BIKE = {
    R: 47, tyre: 7, rear: [-82, -47], front: [82, -47], bb: [-3, -49], crank: 17, ring: 12,
    seat: [-33, -97], saddle: [-40, -120], post: [-38, -117], headTop: [62, -101], headBot: [68, -84], fork: [75, -66],
    stem: [58, -130], grip: [44, -140], tubeW: 7,
  };
  function bikePoints(phase) {
    const a = phase * TAU;
    return { pedalN: add2(BIKE.bb, mul2(dir2(a), BIKE.crank)), pedalF: add2(BIKE.bb, mul2(dir2(a + Math.PI), BIKE.crank)) };
  }
  function drawBike(ctx, K, phase, wheel, layer) {
    const { pedalN, pedalF } = bikePoints(phase);
    const crank = (p, id) => {
      K.tubes(ctx, [[BIKE.bb, p]], 5, pal.white);
      K.cel(ctx, [[p[0] - 9, p[1] - 3.5], [p[0] + 9, p[1] - 3.5], [p[0] + 9, p[1] + 3.5], [p[0] - 9, p[1] + 3.5]], pal.ink, id, { smooth: false });
    };
    if (layer === 'far' || layer === 'all') crank(pedalF, 70);
    if (layer === 'mid' || layer === 'all') {
      for (const [c, id] of [[BIKE.rear, 60], [BIKE.front, 61]]) {
        const C = K.T(c);
        const R = BIKE.R * K.s;
        const tw = BIKE.tyre * K.s;
        ctx.save();
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = tw;
        ctx.beginPath();
        ctx.arc(C[0], C[1], R - tw / 2, 0, TAU);
        ctx.stroke();
        ctx.lineWidth = Math.max(2.5, K.lw * 0.6);
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = wheel * K.f + (i * Math.PI) / 4 + id;
          ctx.moveTo(C[0] + Math.cos(a) * 4 * K.s, C[1] + Math.sin(a) * 4 * K.s);
          ctx.lineTo(C[0] + Math.cos(a) * (R - tw), C[1] + Math.sin(a) * (R - tw));
        }
        ctx.stroke();
        ctx.restore();
        K.cel(ctx, ell(c[0], c[1], 5, 5, 0, 14), pal.white, id + 2);
      }
      K.tubes(ctx, [
        [BIKE.seat, BIKE.headTop], [BIKE.bb, BIKE.headBot], [BIKE.bb, BIKE.seat], [BIKE.bb, BIKE.rear],
        [BIKE.seat, BIKE.rear], [BIKE.headTop, BIKE.headBot], [BIKE.headBot, BIKE.fork, BIKE.front],
      ], BIKE.tubeW, pal.green);
      K.tubes(ctx, [[BIKE.headTop, BIKE.stem, BIKE.grip], [BIKE.seat, BIKE.post]], 5, pal.white);
      const cw = Math.max(2.5, K.lw * 0.6);
      K.line(ctx, [[BIKE.bb[0], BIKE.bb[1] - BIKE.ring], [BIKE.rear[0], BIKE.rear[1] - 5]], 64, { width: cw, taper: [1, 1] });
      K.line(ctx, [[BIKE.bb[0], BIKE.bb[1] + BIKE.ring], [BIKE.rear[0], BIKE.rear[1] + 5]], 65, { width: cw, taper: [1, 1] });
      K.cel(ctx, ell(BIKE.bb[0], BIKE.bb[1], BIKE.ring, BIKE.ring, 0, 22), pal.white, 66);
      const sd = BIKE.saddle;
      K.cel(ctx, [[sd[0] - 15, sd[1] - 2], [sd[0] - 11, sd[1] - 6], [sd[0] + 5, sd[1] - 5], [sd[0] + 14, sd[1] - 3], [sd[0] + 12, sd[1] + 2], [sd[0] - 4, sd[1] + 4], [sd[0] - 14, sd[1] + 3]], pal.shoe, 67);
    }
    if (layer === 'near' || layer === 'all') crank(pedalN, 71);
    return { pedalN, pedalF };
  }
  // the bicycle seen head-on (the middle drawing of the spin): the front tyre edge-on, fork, bars across
  function drawBikeFront(ctx, K, layer) {
    if (layer === 'back') {
      for (const sx of [-1, 1]) {
        K.tubes(ctx, [[[sx * 4, -49], [sx * 20, -51]]], 5, pal.white);
        K.cel(ctx, [[sx * 20 - 7, -54], [sx * 20 + 7, -54], [sx * 20 + 7, -48], [sx * 20 - 7, -48]], pal.ink, sx > 0 ? 70 : 71, { smooth: false });
      }
      return;
    }
    K.cel(ctx, lib.capsulePts(0, -47, 94, 5, Math.PI / 2, 36), pal.ink, 60);
    K.tubes(ctx, [[[-6, -45], [-8, -86]], [[6, -45], [8, -86]], [[0, -84], [0, -104]]], 6, pal.green);
    K.tubes(ctx, [[[0, -104], [0, -130]], [[-42, -136], [-28, -140], [28, -140], [42, -136]]], 5, pal.white);
  }

  // ---------------------------------------------------------------------------
  // The hero: a boy about three heads tall, the Karlsson proportion (art bible 10.1)
  // ---------------------------------------------------------------------------
  const HB = { headR: 48, torso: 84, neck: 46, thigh: 48, shin: 46, ankle: 12, upper: 42, fore: 40, legW: 11, armW: 10, sleeveW: 21, hand: 16, shoeL: 46, shoeH: 17 };

  function rigHero(o, tq, K0) {
    const pose = o.pose || 'stand';
    const k = clamp(o.k != null ? o.k : 0);
    const R = {
      pose, stage: 0, tilt: 0, face: 'smile', capLift: 0, flip: false, sq: null, bike: null, bikeFront: false, chewPhase: o.chewPhase,
      iris: o.iris != null ? o.iris : 1, gulp: o.gulp,
      kindN: 'fist', kindF: 'fist', hold: null, holdW: 75, look: null, rot: 0, pivot: null, armsFront: false, stalk: 0,
    };
    const side = () => Object.assign(R, {
      turn: 1, front: 1, hip: [0, -106], neck: [2, -190], head: [6, -236], hipN: [4, -104], hipF: [-6, -104],
      ankleN: [6, -12], ankleF: [-8, -12], footN: 0, footF: 0, shN: [6, -178], shF: [-6, -179],
      handN: [14, -100], handF: [-14, -102], elbowN: [-0.3, 0.2], elbowF: [-0.3, 0.2], kneeN: [1, 0], kneeF: [1, 0],
    });
    const front = () => Object.assign(R, {
      turn: 0, front: 0, armsFront: true, hip: [0, -106], neck: [0, -190], head: [0, -237], hipN: [8, -104], hipF: [-8, -104],
      ankleN: [14, -12], ankleF: [-14, -12], footN: 0, footF: 0, shN: [21, -176], shF: [-21, -176],
      handN: [26, -104], handF: [-26, -104], elbowN: [1, 0.3], elbowF: [-1, 0.3], kneeN: [0, -1], kneeF: [0, -1],
    });
    const target = (def) => (o.target ? K0.D(o.target) : def);
    const shoulders = () => {
      const e = sub2(R.neck, R.hip);
      const sl = len2(e);
      R.shN = add2(R.neck, add2(mul2(e, -12 / sl), [3, 0]));
      R.shF = add2(R.neck, add2(mul2(e, -12 / sl), [-4, -1]));
    };
    const ride = (lean, torso, hip, cad, headK, hd) => {
      side();
      const t = o.ones || pose === 'dash' ? o.t || 0 : tq;
      let phase = o.phase != null ? o.phase : t * cad;
      if (o.cycle) phase = Math.floor(phase * o.cycle + 1e-6) / o.cycle;
      R.bike = { phase, wheel: o.wheel != null ? o.wheel : phase * TAU * 2.2 };
      R.hip = hip;
      R.neck = add2(hip, [Math.sin(lean * DEG) * torso, -Math.cos(lean * DEG) * torso]);
      const ha = lean * headK * DEG;
      R.head = add2(R.neck, [Math.sin(ha) * hd, -Math.cos(ha) * hd]);
      const { pedalN, pedalF } = bikePoints(phase);
      R.hipN = add2(hip, [2, 2]);
      R.hipF = add2(hip, [-3, 0]);
      R.ankleN = add2(pedalN, [-3, -10]);
      R.ankleF = add2(pedalF, [-3, -10]);
      R.footN = 0.12 * Math.sin(phase * TAU);
      R.footF = 0.12 * Math.sin(phase * TAU + Math.PI);
      R.kneeN = R.kneeF = [1, -0.4];
      shoulders();
      R.handN = BIKE.grip;
      R.handF = add2(BIKE.grip, [-3, -1]);
      R.elbowN = R.elbowF = [-0.2, 1];
    };
    const straddle = (back) => {
      side();
      R.bike = { phase: 0.15, wheel: 0 };
      R.hip = back ? [-12, -106] : [-4, -104];
      const lean = back ? -10 : 3;
      R.neck = add2(R.hip, [Math.sin(lean * DEG) * HB.torso, -Math.cos(lean * DEG) * HB.torso]);
      R.head = add2(R.neck, [Math.sin(lean * 0.5 * DEG) * HB.neck, -Math.cos(lean * 0.5 * DEG) * HB.neck]);
      R.hipN = add2(R.hip, [3, 2]);
      R.hipF = add2(R.hip, [-3, 0]);
      R.ankleN = back ? [30, -12] : [12, -12];
      R.ankleF = add2(bikePoints(0.15).pedalF, [-3, -10]);
      R.kneeN = [1, -0.2];
      R.kneeF = [1, -0.4];
      shoulders();
      R.handN = BIKE.grip;
      R.handF = add2(BIKE.grip, [-3, -1]);
      R.elbowN = R.elbowF = [-0.2, 1];
      R.face = 'grin';
      if (back) {
        // the bicycle tips back 4 degrees about the rear tyre's contact; the planted foot stays on the ground
        R.rot = -4 * DEG;
        R.pivot = [BIKE.rear[0], 0];
        R.ankleN = add2(rot2(sub2(R.ankleN, R.pivot), -R.rot), R.pivot);
        R.tilt = -0.1;
      }
    };
    switch (pose) {
      case 'ride':
        ride(22, HB.torso, [-38, -128], o.cadence != null ? o.cadence : 1.1, 0.5, HB.neck);
        break;
      case 'crouch':
        ride(42, 74, [-38, -128], 0, 0.6, 42);
        R.tilt = 0.12;
        R.face = 'determined';
        R.elbowN = R.elbowF = [-0.5, 0.8];
        break;
      case 'dash':
        ride(44, 92, [-34, -134], o.cadence != null ? o.cadence : 2.6, 0.8, HB.neck);
        R.tilt = 0.1;
        R.face = 'grin';
        R.elbowN = R.elbowF = [-0.4, -1];
        break;
      case 'straddle':
      case 'skid':
        straddle(pose === 'skid');
        break;
      case 'coins':
        straddle(false);
        R.handN = target([46, -238]);
        R.elbowN = [0.4, 1];
        R.hold = add2(R.handN, [4, -24]);
        break;
      case 'slap':
        straddle(false);
        R.handN = target([72, -150]);
        R.kindN = 'open';
        R.elbowN = [-0.3, -1];
        break;
      case 'snatch':
        if (o.view === 'front') front();
        else side();
        R.handN = target([150, -186]);
        R.elbowN = [0, -1];
        R.face = 'grin';
        break;
      case 'sill': {
        front();
        const ly = o.target ? K0.D(o.target)[1] : -150;
        R.handN = [34, ly];
        R.handF = [-34, ly];
        R.elbowN = [1, 0.4];
        R.elbowF = [-1, 0.4];
        R.face = 'smile';
        break;
      }
      case 'bite':
        side();
        R.stage = stage3(k);
        R.face = ['open', 'chomp', 'chew'][R.stage];
        R.tilt = [-0.04, 0.06, 0][R.stage];
        R.hold = [[60, -199], [42, -208], [46, -156]][R.stage];
        R.handN = add2(R.hold, [-12, 14]);
        R.handF = add2(R.hold, [16, 10]);
        R.elbowN = R.elbowF = [0, 1];
        R.bites = (o.bites || 0) + (R.stage === 2 ? 1 : 0);
        break;
      case 'pop':
        side();
        R.sq = [0.97, 1.05];
        R.face = 'pop';
        R.capLift = 0.32;
        R.handN = [72, -192];
        R.handF = [-62, -198];
        R.elbowN = [0.8, 1];
        R.elbowF = [-0.8, 1];
        R.kindN = R.kindF = 'open';
        R.look = [0, 0];
        R.stalk = o.stalk || 0;
        if (o.stalkDir != null) R.stalkDir = o.stalkDir;
        break;
      case 'turn':
        R.stage = stage3(k);
        if (R.stage === 0) {
          side();
          R.sq = [1.06, 0.88];
          R.face = 'neutral';
          R.look = [-0.8, 0];
          R.handN = [8, -118];
          R.handF = [-10, -120];
        } else if (R.stage === 1) {
          front();
          R.sq = [0.96, 1.05];
          R.face = 'O';
          R.look = [0, 0];
          R.handN = [56, -170];
          R.handF = [-56, -170];
          R.elbowN = [1, 0.6];
          R.elbowF = [-1, 0.6];
          R.kindN = R.kindF = 'open';
        } else {
          side();
          R.flip = true;
          R.face = 'neutral';
        }
        break;
      case 'spin':
        R.stage = stage3(k);
        if (R.stage === 0) {
          ride(42, 74, [-38, -128], 0, 0.6, 42);
          R.tilt = 0.12;
          R.face = 'determined';
        } else if (R.stage === 1) {
          front();
          R.bikeFront = true;
          Object.assign(R, {
            hip: [0, -124], neck: [0, -206], head: [0, -253], hipN: [10, -122], hipF: [-10, -122],
            ankleN: [20, -60], ankleF: [-20, -60], kneeN: [1, -0.3], kneeF: [-1, -0.3],
            shN: [21, -194], shF: [-21, -194], handN: [40, -140], handF: [-40, -140], elbowN: [1, 0.2], elbowF: [-1, 0.2], face: 'O',
          });
        } else {
          ride(30, HB.torso, [-38, -128], 0, 0.5, HB.neck);
          R.flip = true;
          R.face = 'grin';
        }
        break;
      default:
        if (o.view === 'front') front();
        else side();
        if (pose !== 'stand') R.face = 'neutral';
    }
    if (o.face) R.face = o.face;
    if (o.look) R.look = o.look;
    if (o.tilt != null) R.tilt = o.tilt;
    if (o.turn != null) R.turn = clamp(o.turn);
    // o.bob (frame px, + down): on the bicycle the body sinks or rises; hands stay on the grips, feet on the pedals
    if (o.bob && R.bike) {
      const d = [0, o.bob / K0.s];
      for (const key of ['hip', 'neck', 'head', 'hipN', 'hipF', 'shN', 'shF']) R[key] = add2(R[key], d);
    }
    if (o.rig) Object.assign(R, o.rig);
    if (R.sq) {
      const S2 = (p) => [p[0] * R.sq[0], p[1] * R.sq[1]];
      for (const key of ['hip', 'neck', 'head', 'hipN', 'hipF', 'shN', 'shF', 'handN', 'handF', 'hold']) if (R[key]) R[key] = S2(R[key]);
    }
    return R;
  }

  function heroHead(ctx, K, hc, r, R, blink) {
    const tilt = R.tilt, face = R.face, capLift = R.capLift;
    const P = (u, v) => {
      const q = rot2([u * r, v * r], tilt);
      return [hc[0] + q[0], hc[1] + q[1]];
    };
    const PP = (arr) => arr.map((q) => P(q[0], q[1]));
    const tu = clamp(R.turn);
    const rpx = r * K.s;
    const fw = clamp(rpx * 0.05, 2.6, K.lw);
    const ew = clamp(rpx * 0.035, 2.5, K.lw);
    // chewing with o.chewPhase: the jaw drops (the lower half of the head stretches) and the mouth opens
    const chewK = face === 'chew' && R.chewPhase != null ? clamp(R.chewPhase) : null;
    const jaw = face === 'jaw' ? 0.32 : chewK != null ? 0.1 * chewK : 0;
    const full = face === 'chew' || face === 'chomp' || face === 'gulp' ? 0.17 : 0;
    // 1 the head: round, full cheeks (the jaw drops for 'jaw')
    const head = [];
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * TAU;
      const cF = Math.exp(-Math.pow(wrapA(a - 0.75), 2) / 0.2) * (0.07 + full) * (0.3 + 0.7 * tu);
      const cB = Math.exp(-Math.pow(wrapA(a - (Math.PI - 0.75)), 2) / 0.2) * 0.07 * (1 - tu);
      const kk = 1 + cF + cB;
      const sn = Math.sin(a);
      head.push([Math.cos(a) * kk, sn * kk * 0.97 * (sn > 0 ? 1 + jaw : 1)]);
    }
    K.cel(ctx, PP(head), pal.skinKid, 1);
    // 2 hair under the cap at the back, spiking past the outline (both sides from the front); ears; blush
    const tuft = [[-0.5, -0.6], [-0.98, -0.56], [-1.12, -0.44], [-0.98, -0.34], [-1.14, -0.2], [-0.94, -0.16], [-0.96, -0.02], [-0.74, -0.1], [-0.62, -0.32]];
    const tufts = tu < 0.35 ? [1, -1] : [1];
    tufts.forEach((m, i) => {
      const kx = m > 0 ? 1 - 0.14 * tu : 1;
      K.cel(ctx, PP(tuft.map((q) => [q[0] * m * kx, q[1]])), pal.hairYellow, 35 + i);
      K.line(ctx, PP([[-0.66 * m * kx, -0.48], [-0.86 * m * kx, -0.34]]), 37 + i, { width: fw * 0.7 });
    });
    const earU = -(0.9 - 0.24 * tu);
    (tu < 0.35 ? [earU, -earU] : [earU]).forEach((eu, i) => {
      const sg = eu < 0 ? 1 : -1;
      K.cel(ctx, PP(ell(eu, 0.08, 0.15, 0.22, 0, 20)), pal.skinKid, 20 + i);
      K.line(ctx, PP([[eu + 0.06 * sg, -0.03], [eu - 0.03 * sg, 0.07], [eu + 0.04 * sg, 0.16]]), 22 + i, { width: fw * 0.7 });
    });
    const bl = face === 'bliss' ? 1.4 : 1;
    const blush = tu > 0.5 ? [[-0.12 + 0.34 * tu, 0.2]] : [[-0.44 + 0.3 * tu, 0.2], [0.44 + 0.2 * tu, 0.2]];
    blush.forEach((b, i) => K.cel(ctx, PP(ell(b[0], b[1], 0.15 * bl, 0.1 * bl, 0, 18)), face === 'bliss' ? pal.blush : pal.blushKid, 30 + i, { width: 0 }));
    if (capLift > 0.05) {
      K.cel(ctx, PP([[-0.98, -0.46], [-0.85, -0.9], [-0.55, -1.08], [-0.4, -1.28], [-0.22, -1.1], [0.0, -1.3], [0.16, -1.1], [0.38, -1.27], [0.52, -1.04], [0.82, -0.94], [0.98, -0.46], [0.6, -0.58], [0, -0.64], [-0.6, -0.58]]), pal.hairYellow, 39);
    }
    // 3 the cap's crown, set high on the head (the eyes sit at 0.23 of the radius above the center)
    const liftP = (q) => {
      const p = rot2([q[0], q[1] + 0.56], -0.3 * capLift);
      return [p[0], p[1] - 0.56 - capLift];
    };
    const dome = [[-1.0, -0.52]];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      dome.push([-0.03 + Math.cos(a) * 1.03, -0.6 + Math.sin(a) * 0.68]);
    }
    dome.push([0.98, -0.56], [0.55, -0.62], [0, -0.65], [-0.55, -0.6]);
    K.cel(ctx, PP(dome.map(liftP)), pal.cap, 40);
    K.line(ctx, PP([[-0.9, -0.6], [0, -0.71], [0.88, -0.64]].map(liftP)), 41, { width: fw * 0.7 });
    // 4 eyes (on stalks when they pop out)
    const pop = face === 'pop';
    const erx = pop ? 0.2 : 0.15, ery = pop ? 0.26 : 0.19;
    const ev = pop ? -0.27 : -0.23;
    const happy = face === 'chomp' || face === 'bliss';
    const lid = face === 'determined' ? 0.34 : face === 'glare' ? 0.46 : face === 'sad' ? 0.22 : face === 'sniff' ? 0.55 : face === 'chew' ? 0.25 : 0;
    const lk = R.look || [0.4 * tu, 0];
    const eyes = [[-0.28 + 0.46 * tu, 1, -1], [0.28 + 0.36 * tu, 1 - 0.3 * tu, 1]];
    const stalk = R.stalk || 0;
    const sdir = dir2(R.stalkDir != null ? R.stalkDir : -0.55);
    const centres = eyes.map(([u]) => [u + sdir[0] * stalk * 0.85, ev + sdir[1] * stalk * 0.85]);
    const big = 1 + stalk * 0.52;
    const drawEyes = () => {
    if (stalk > 0) {
      eyes.forEach(([u], i) => K.tubes(ctx, [[P(u, ev), P(centres[i][0], centres[i][1])]], 0.13 * r, pal.skinKid));
    }
    eyes.forEach(([u, kx, sideE], i) => {
      const [cu, cv] = centres[i];
      const rx = erx * kx * rpx * big, ry = ery * rpx * big;
      if (rx < 5) {
        K.disc(ctx, P(cu, cv), Math.max(0.06, erx * 0.6) * r, pal.ink);
        return;
      }
      if (blink || happy) {
        const d = happy ? -0.08 : 0.04;
        K.line(ctx, [P(cu - erx * kx, cv + 0.02), P(cu, cv + d), P(cu + erx * kx, cv + 0.02)], 45 + i, { width: fw });
        return;
      }
      eyeOpen(ctx, K.T(P(cu, cv)), rx, ry, {
        ew, look: [lk[0] * K.f, lk[1]], lid, iris: pal.iris, irisR: rx * (pop ? 0.44 : face === 'glare' ? 0.5 : 0.66) * R.iris, lashes: 3, side: sideE * K.f, skin: pal.skinKid, seed: 4501 + i * 7,
      });
    });
    };
    // eyes on stalks shoot out over the cap, so they are drawn after the visor (8)
    if (stalk <= 0) drawEyes();
    // 5 brows (drawn over the visor, after 8, so the visor never hides the anger)
    const bv = pop ? -0.62 : -0.47;
    const drawBrows = () => eyes.forEach(([u, kx, sideE], i) => {
      if (stalk > 0.3) return;
      const inner = sideE < 0 ? 1 : -1;
      const dIn = face === 'determined' ? 0.07 : face === 'glare' ? 0.11 : face === 'sad' ? -0.07 : face === 'jaw' ? -0.08 : 0;
      const a = [u - 0.14 * kx * inner, bv - 0.01], b = [u + 0.14 * kx * inner, bv + dIn];
      K.line(ctx, PP([a, [u, bv - 0.05 - (pop ? 0.03 : 0)], b]), 50 + i, { width: fw, taper: [fw * 0.5, fw * 1.6] });
    });
    // 6 nose
    const nu = 0.92 * tu, nv = 0.1;
    K.cel(ctx, PP(ell(nu, nv, 0.12, 0.11, 0, 18)), pal.skinKid, 55);
    if (face === 'sniff') {
      for (let i = 0; i < 2; i++) K.line(ctx, PP([[nu + 0.16, nv - 0.06 + i * 0.1], [nu + 0.3, nv - 0.1 + i * 0.12]]), 56 + i, { width: Math.max(2.5, fw * 0.6), taper: [1, 2] });
    }
    // 7 mouth
    const mu = 0.56 * tu, mv = 0.48 + (chewK != null ? 0.48 * jaw : 0);
    const mw = 0.21 * (1 - 0.2 * tu);
    const serif = (q, dx) => K.line(ctx, PP([[q[0] - dx * 0.03, q[1] - 0.05], [q[0] + dx * 0.01, q[1] + 0.03]]), 63 + (dx > 0 ? 1 : 0), { width: fw * 0.8, taper: [1, 1] });
    const cavity = (deep, wide) => {
      const cav = PP([[mu - mw * wide, mv - 0.06], [mu, mv - 0.04], [mu + mw * wide, mv - 0.06], [mu + mw * 0.7, mv + deep * 0.7], [mu, mv + deep], [mu - mw * 0.7, mv + deep * 0.7]]);
      K.cel(ctx, cav, pal.mouth, 61);
      ctx.save();
      ctx.beginPath();
      lib.tracePath(ctx, lib.smoothPts(K.TT(cav), true, 3), true);
      ctx.clip();
      K.cel(ctx, PP(ell(mu + 0.03, mv + deep * 0.85, mw * 0.65, Math.min(0.12, deep * 0.38), 0, 18)), pal.blushKid, 62, { width: 0 });
      ctx.restore();
      K.cel(ctx, PP([[mu - 0.05, mv - 0.07], [mu + 0.05, mv - 0.07], [mu + 0.045, mv + 0.02], [mu - 0.045, mv + 0.02]]), pal.white, 66, { width: Math.max(2.5, fw * 0.6), smooth: false });
      K.cel(ctx, cav, null, 61);
    };
    if (face === 'smile' || face === 'neutral' || face === 'determined' || face === 'sad' || face === 'glare' || face === 'bliss' || face === 'lick') {
      const dip = face === 'smile' || face === 'bliss' || face === 'lick' ? 0.08 : face === 'neutral' ? 0.025 : face === 'sad' ? -0.06 : face === 'glare' ? -0.02 : -0.005;
      const ends = dip > 0.05 ? -0.05 : 0;
      const p0 = [mu - mw, mv + ends], p1 = [mu + mw, mv + ends];
      if (face === 'lick') K.cel(ctx, PP(ell(mu + mw * 0.75, mv + 0.04, 0.08, 0.06, 0.6, 14)), pal.blushKid, 67);
      K.line(ctx, PP([p0, [mu, mv + dip], p1]), 60, { width: fw, taper: [fw * 0.4, fw * 0.4] });
      if (dip > 0.05) {
        serif(p0, -1);
        serif(p1, 1);
      }
    } else if (face === 'open' || face === 'grin' || face === 'pant') {
      const shut = face === 'pant' && Math.floor((R.tq || 0) * 6) % 2 === 1;
      cavity(face === 'open' ? 0.3 : face === 'pant' ? (shut ? 0.1 : 0.18) : 0.2, face === 'pant' ? 0.8 : 1.15);
    } else if (face === 'jaw') {
      cavity(0.62, 0.9);
    } else if (face === 'O' || face === 'pop') {
      const b = face === 'pop' ? 1.35 : 1;
      K.cel(ctx, PP(ell(mu, mv + 0.05, 0.08 * b, 0.11 * b, 0, 18)), pal.mouth, 61);
    } else if (chewK != null && chewK > 0.25) {
      cavity(0.04 + 0.16 * chewK, 0.75);
    } else if (face === 'chew' || face === 'chomp' || face === 'gulp') {
      if (face === 'chew') K.line(ctx, PP([[mu - mw, mv], [mu - mw * 0.4, mv - 0.035], [mu, mv + 0.02], [mu + mw * 0.5, mv - 0.03], [mu + mw, mv + 0.01]]), 60, { width: fw });
      if (face === 'gulp') K.line(ctx, PP([[mu - mw * 0.6, mv + 0.01], [mu + mw * 0.6, mv - 0.01]]), 60, { width: fw, taper: [2, 2] });
    } else if (face === 'sniff') {
      K.cel(ctx, PP(ell(mu, mv + 0.03, 0.05, 0.05, 0, 12)), pal.mouth, 61);
    }
    // 8 the visor
    const vis3 = [[0.4, -0.66], [0.92, -0.69], [1.36, -0.6], [1.42, -0.5], [0.96, -0.53], [0.44, -0.57]];
    const visF = [[-0.8, -0.62], [0, -0.66], [0.8, -0.62], [0.7, -0.5], [0, -0.47], [-0.7, -0.5]];
    K.cel(ctx, PP(vis3.map((q, i) => liftP(lerp2(visF[i], q, tu)))), pal.cap, 70);
    drawBrows();
    if (stalk > 0) drawEyes();
    return { mouth: P(mu, mv), eye: P(centres[0][0], centres[0][1]), eyeFar: P(centres[1][0], centres[1][1]), top: P(0, -1.28 - capLift) };
  }

  function hero(ctx, x, y, o = {}) {
    const tq = o.ones ? o.t || 0 : lib.onTwos(o.t || 0);
    const s = (o.h || 480) / 300;
    const f0 = o.facing === -1 || o.facing === 'left' ? -1 : 1;
    const R = rigHero(o, tq, kit(x, y, s, f0, o, 1100));
    R.tq = tq;
    const f = R.flip ? -f0 : f0;
    const K = kit(x, y, s, f, o, 1100, R.rot + (o.rot || 0), R.pivot);
    const skin = pal.skinKid;
    let body = null; // the shirt's outline in design units, once drawn
    if (o.shadow !== false) {
      const rx = R.bike ? (R.bikeFront ? 44 : BIKE.front[0] + BIKE.R * 0.6) : 46;
      lib.footShadow(ctx, x + f * (R.bike ? 0 : R.front < 1 ? 0 : 3) * s, y, rx * s, { ground: o.ground, machine: K.brush });
    }
    const arm = (sh, hand, pref, kind, near) => {
      const el = ik2(sh, hand, HB.upper, HB.fore, pref);
      limbTube(ctx, K, [sh, el, hand], HB.armW, skin, body, sh);
      limbTube(ctx, K, [sh, lerp2(sh, el, 0.5)], HB.sleeveW, pal.red, body, sh);
      return drawHand(ctx, K, hand, angOf(sub2(hand, el)), HB.hand, kind, skin, near ? 80 : 85, -1);
    };
    const leg = (hip, ankle, footA, knee, id) => {
      const kn = ik2(hip, ankle, HB.thigh, HB.shin, knee);
      K.tubes(ctx, [[hip, kn, ankle]], HB.legW, skin);
      K.tubes(ctx, [[lerp2(ankle, kn, 0.38), ankle]], HB.legW + 2, pal.white);
      drawShoe(ctx, K, ankle, footA, HB.shoeL, HB.shoeH, R.front, pal.shoe, id);
      return kn;
    };
    const torso = () => {
      const kN = ik2(R.hipN, R.ankleN, HB.thigh, HB.shin, R.kneeN), kF = ik2(R.hipF, R.ankleF, HB.thigh, HB.shin, R.kneeF);
      K.tubes(ctx, [[R.hip, R.hip], [R.hipN, lerp2(R.hipN, kN, 0.42)], [R.hipF, lerp2(R.hipF, kF, 0.42)]], 30, pal.slate);
      const e = sub2(R.neck, R.hip);
      const L = len2(e);
      const ev = mul2(e, 1 / L), nv = [-ev[1], ev[0]];
      const map = (u, v) => add2(R.hip, add2(mul2(ev, v), mul2(nv, u))); // u > 0 is the front
      const b = R.front < 1 ? 0 : 2;
      const sack = [[-20, L + 1], [-26, L * 0.86], [-29, L * 0.55], [-31, L * 0.2], [-28, -2], [-12, -7], [6, -7], [24, -3], [31 + b, L * 0.2], [32 + b, L * 0.5], [27, L * 0.86], [18, L + 1], [0, L + 4]];
      body = sack.map((q) => map(q[0], q[1]));
      K.cel(ctx, body, pal.red, 10);
      K.line(ctx, [map(-12, L * 0.92), map(0, L * 0.84), map(12, L * 0.92)], 11, { width: Math.max(2.6, K.lw * 0.7) });
    };
    const B = R.bike;
    // 1 what is behind the body: far arm, far pedal and far leg, the bicycle, the near pedal
    if (!R.armsFront) arm(R.shF, R.handF, R.elbowF, R.kindF, false);
    if (B && !R.bikeFront) drawBike(ctx, K, B.phase, B.wheel, 'far');
    if (R.bikeFront) drawBikeFront(ctx, K, 'back');
    leg(R.hipF, R.ankleF, R.footF || 0, R.kneeF, 91);
    if (B && !R.bikeFront) {
      drawBike(ctx, K, B.phase, B.wheel, 'mid');
      drawBike(ctx, K, B.phase, B.wheel, 'near');
    }
    leg(R.hipN, R.ankleN, R.footN || 0, R.kneeN, 92);
    // 2 shorts over the thighs, the shirt over the shorts, the throat bulge of a gulp
    torso();
    if (R.face === 'gulp' && R.gulp != null) {
      // o.gulp 0..1: the lump bulges under the chin and travels down the throat (the head covers its top)
      const g = clamp(R.gulp), r0 = HB.headR;
      const c = add2(R.head, rot2([0.22 * clamp(R.turn != null ? R.turn : 1) * r0, (0.92 + 0.2 * g) * r0], R.tilt));
      K.cel(ctx, ell(c[0], c[1], 11, 10, 0, 14), skin, 12);
    } else if (R.face === 'gulp') {
      const nk = lerp2(R.neck, R.head, 0.32);
      K.cel(ctx, ell(nk[0] + 10, nk[1], 8, 7, 0, 14), skin, 12);
    }
    // 3 the head (in a crouch or a dash the chin tucks over the near shoulder: the head goes over the arms)
    const anchors = { hold: K.T(R.hold || lerp2(R.handN, R.handF, 0.5)) };
    const held = () => {
      if (typeof o.hold === 'function') o.hold(ctx, anchors);
      else if (R.pose === 'bite' && o.burger !== false) {
        props.burger(ctx, anchors.hold[0], anchors.hold[1], { w: R.holdW * s, bites: R.bites, rot: f * (R.stage === 2 ? 0 : -0.12), biteSide: o.biteSide, biteSize: o.biteSize, plate: o.plate, line: o.line });
      } else if (R.pose === 'coins' && o.coins !== false) {
        props.coin(ctx, anchors.hold[0] - 10 * s, anchors.hold[1] + 2 * s, { w: 34 * s, rot: -0.3, seed: 1, plate: o.plate, line: o.line });
        props.coin(ctx, anchors.hold[0] + 11 * s, anchors.hold[1] - 4 * s, { w: 34 * s, rot: 0.25, seed: 2, plate: o.plate, line: o.line });
      }
    };
    // at the open-mouth stage of a bite the burger is held up beside the face, so the open mouth shows (G5)
    const heldFirst = R.pose === 'bite' && R.stage === 0 && typeof o.hold !== 'function';
    // the chewing jaw drops over the near shoulder too, so with o.chewPhase the head goes over the arms
    const headLast = R.pose === 'crouch' || R.pose === 'dash' || (R.face === 'chew' && R.chewPhase != null);
    if (heldFirst) held();
    let hd = headLast ? null : heroHead(ctx, K, R.head, HB.headR, R, !!o.blink);
    if (R.bikeFront) drawBikeFront(ctx, K, 'front');
    // 4 what the hands hold, then the arms in front
    if (!heldFirst) held();
    if (R.armsFront) arm(R.shF, R.handF, R.elbowF, R.kindF, false);
    const tip = arm(R.shN, R.handN, R.elbowN, R.kindN, true);
    if (headLast) hd = heroHead(ctx, K, R.head, HB.headR, R, !!o.blink);
    Object.assign(anchors, {
      head: K.T(R.head), headR: HB.headR * s, eye: K.T(hd.eye), eyeFar: K.T(hd.eyeFar), mouth: K.T(hd.mouth), top: K.T(hd.top),
      hand: K.T(tip), handFar: K.T(R.handF), chest: K.T(lerp2(R.hip, R.neck, 0.6)), neck: K.T(R.neck), ground: [x, y],
    });
    if (B) {
      const bp = bikePoints(B.phase);
      Object.assign(anchors, { seat: K.T(BIKE.saddle), grip: K.T(BIKE.grip), pedal: K.T(bp.pedalN), axleFront: K.T(BIKE.front), axleRear: K.T(BIKE.rear), wheelR: BIKE.R * s });
    }
    return anchors;
  }
  cast.hero = hero;

  props.bike = (ctx, x, y, o = {}) => {
    const s = (o.h || 480) / 300;
    const f = o.facing === -1 || o.facing === 'left' ? -1 : 1;
    const tq = o.ones ? o.t || 0 : lib.onTwos(o.t || 0);
    const phase = o.phase != null ? o.phase : tq * (o.cadence || 0);
    const K = kit(x, y, s, f, o, 1300);
    // o.measure: the anchors only, nothing drawn
    const bp = o.measure ? bikePoints(phase) : drawBike(ctx, K, phase, o.wheel != null ? o.wheel : phase * TAU * 2.2, o.layer || 'all');
    return { seat: K.T(BIKE.saddle), grip: K.T(BIKE.grip), pedal: K.T(bp.pedalN), pedalFar: K.T(bp.pedalF), bb: K.T(BIKE.bb), axleFront: K.T(BIKE.front), axleRear: K.T(BIKE.rear), wheelR: BIKE.R * s };
  };

  // ---------------------------------------------------------------------------
  // The owner: a tall, tired adult, about ten face heights (art bible 10.2)
  // ---------------------------------------------------------------------------
  const OB = { headR: 36, torso: 118, thigh: 92, shin: 88, upper: 70, fore: 66, legW: 15, armW: 11, sleeveW: 22, hand: 18, shoeL: 56, shoeH: 19 };
  const COUNTER = -214; // where his hands rest on a counter, in his design units

  function rigOwner(o, tq, K0) {
    const pose = o.pose || 'stand';
    const k = clamp(o.k != null ? o.k : 0);
    const R = {
      pose, tilt: 0.12, face: 'tired', kindN: 'fist', kindF: 'fist', hold: null, holdKind: null,
      elbowN: [-0.4, 0.3], elbowF: [-0.4, 0.3], knee: [1, 0], armsFront: false,
      hip: [0, -194], neck: [12, -310], head: [30, -338], hipN: [5, -192], hipF: [-7, -192],
      ankleN: [6, -14], ankleF: [-10, -14], shN: [12, -300], shF: [-2, -302], handN: [16, -168], handF: [-6, -170],
    };
    const target = (def) => (o.target ? K0.D(o.target) : def);
    switch (pose) {
      case 'lean': {
        // elbow on the counter (o.target: the elbow's point, e.g. on booth.shelf), chin on the fist, bored
        R.tilt = 0.2;
        R.face = 'bored';
        R.handN = add2(R.head, rot2([0.2 * OB.headR, 1.18 * OB.headR], R.tilt));
        R.elbowAt = target([50, -246]);
        break;
      }
      case 'serve':
        R.handN = [96, -238];
        R.hold = [110, -250];
        R.holdKind = 'burger';
        R.elbowN = [-0.2, 1];
        break;
      case 'push':
        R.handN = target([100, COUNTER]);
        R.kindN = 'open';
        R.elbowN = [-0.2, 1];
        break;
      case 'rake': {
        // o.target: where the stroke starts; the hand sweeps 66 units back along the counter
        const a = target([112, COUNTER]);
        R.handN = lerp2(a, add2(a, [-66, 0]), k);
        R.kindN = 'open';
        R.elbowN = [-0.2, 1];
        break;
      }
      case 'tap': {
        const down = o.k != null ? k < 0.5 : Math.floor(tq * 8) % 2 === 0;
        R.handN = target([84, COUNTER]);
        R.handN = add2(R.handN, [0, down ? 0 : -10]);
        R.kindN = 'point';
        R.elbowN = [-0.2, 1];
        break;
      }
      case 'point':
        R.handN = [24, -454];
        R.kindN = 'point';
        R.elbowN = [1, 0.2];
        R.tilt = -0.16;
        R.face = 'surprised';
        break;
      case 'catch':
        R.handN = [90, -392];
        R.kindN = k < 0.5 ? 'open' : 'fist';
        R.elbowN = [0.2, 1];
        R.hold = [96, -398];
        R.face = 'surprised';
        R.tilt = -0.1;
        break;
      case 'read':
        R.handN = [86, -212];
        R.handF = [60, -216];
        R.hold = [72, -250];
        R.holdKind = 'ticket';
        R.tilt = 0.32;
        R.face = 'read';
        R.elbowN = R.elbowF = [0, 1];
        break;
      case 'phone':
        R.handN = [28, -306];
        R.elbowN = [0.6, 1];
        R.handF = [-26, -206];
        R.elbowF = [-1, -0.2];
        R.face = 'talk';
        R.tilt = 0.02;
        R.hold = [6, -334];
        R.holdKind = 'handset';
        break;
      case 'listen':
        // the handset pinned between ear and shoulder, head tipped onto it, both hands free at the counter
        R.head = [24, -330];
        R.tilt = -0.24;
        R.hold = [0, -318];
        R.holdKind = 'pinned';
        R.handN = [80, COUNTER];
        R.handF = [64, COUNTER - 6];
        R.elbowN = R.elbowF = [-0.3, 1];
        R.armsFront = true;
        break;
      case 'sigh': {
        const d = ease.outCubic(k) * 16;
        R.neck = [12, -310 + d];
        R.head = [30, -338 + d * 1.1];
        R.shN = [12, -300 + d];
        R.shF = [-2, -302 + d];
        R.tilt = 0.12 + 0.14 * k;
        R.face = 'sigh';
        break;
      }
      case 'type': {
        const tap = Math.floor(tq * 8) % 2;
        R.handN = [72, tap ? -204 : -212];
        R.handF = [58, tap ? -214 : -206];
        R.elbowN = R.elbowF = [-0.3, 1];
        R.tilt = 0.36;
        R.hold = [66, -200];
        R.armsFront = true;
        break;
      }
      case 'holdup':
        R.handN = [112, -408];
        R.elbowN = [0.3, 1];
        R.hold = [112, -410];
        R.tilt = -0.04;
        break;
      case 'shrug':
        Object.assign(R, { shN: [12, -312], shF: [-2, -314], neck: [10, -320], head: [26, -350], handN: [66, -232], handF: [-50, -236], elbowN: [-0.2, 1], elbowF: [0.2, 1], face: 'surprised', tilt: -0.06 });
        R.kindN = R.kindF = 'open';
        break;
      default:
        break;
    }
    if (o.face) R.face = o.face;
    if (o.tilt != null) R.tilt = o.tilt;
    if (o.rig) Object.assign(R, o.rig);
    return R;
  }

  function ownerHead(ctx, K, hc, r, tilt, face, tq, blink, back, turn = 0) {
    const P = (u, v) => {
      const q = rot2([u * r, v * r], tilt);
      return [hc[0] + q[0], hc[1] + q[1]];
    };
    const PP = (arr) => arr.map((q) => P(q[0], q[1]));
    const rpx = r * K.s;
    const fw = clamp(rpx * 0.06, 2.6, K.lw);
    const cap = [[-0.74, -0.62], [-0.88, -1.0], [-0.3, -1.12], [0.36, -1.14], [0.84, -0.98], [0.72, -0.66], [0, -0.75]];
    const head = [];
    const jawO = face === 'yawn' && !back ? 0.22 : 0; // a yawn drops the jaw with the mouth
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * TAU;
      const sn = Math.sin(a);
      head.push([Math.cos(a) * 0.74 * (sn > 0 ? 1 - 0.12 * sn : 1) + 0.06 * Math.max(0, sn), sn * (sn > 0 ? 1 + jawO : 1)]);
    }
    if (back) {
      // from behind: the nose tip and a moustache end just show past the cheek; grey hair covers the back
      K.cel(ctx, PP(ell(0.72, 0.06, 0.13, 0.12, 0, 14)), pal.skin, 50);
      K.cel(ctx, PP([[0.5, 0.3], [0.78, 0.26], [0.86, 0.38], [0.62, 0.42]]), pal.hairGrey, 52);
      K.cel(ctx, PP(head), pal.skin, 1);
      K.cel(ctx, PP([[-0.7, -0.6], [-0.8, -0.2], [-0.72, 0.3], [-0.5, 0.62], [-0.2, 0.66], [0.06, 0.5], [0.18, 0.16], [0.14, -0.3], [0.2, -0.62]]), pal.hairGrey, 30);
      // long tapering strands from the crown to the neck, in the hair's own darker tone (never ink)
      const strand = lib.mix(pal.hairGrey, pal.ink, 0.33);
      [[[-0.56, -0.52], [-0.64, -0.08], [-0.56, 0.32]], [[-0.34, -0.58], [-0.4, -0.08], [-0.34, 0.48]], [[-0.12, -0.58], [-0.16, -0.08], [-0.12, 0.46]], [[0.08, -0.54], [0.06, -0.14], [0.0, 0.26]]]
        .forEach((pts, i) => K.line(ctx, PP(pts), 31 + i, { width: fw * 0.75, color: strand, taper: [fw * 1.5, fw * 3] }));
      K.cel(ctx, PP(ell(0.36, 0.04, 0.15, 0.24, 0, 20)), pal.skin, 20);
      K.line(ctx, PP([[0.31, -0.09], [0.41, 0.04], [0.32, 0.15]]), 21, { width: fw * 0.7 });
      if (turn > 0) {
        // o.headTurn: he turns his head toward us; the near eye and its brow come round past the cheek
        const tk = clamp(turn), eu = 0.66 - 0.08 * tk, ev = -0.2;
        K.line(ctx, PP([[eu - 0.05 * tk, ev + 0.01], [eu + 0.05, ev + 0.01]]), 40, { width: fw * 1.15, taper: [1, 1] });
        K.line(ctx, PP([[eu - 0.08 * tk, ev - 0.07], [eu + 0.06, ev - 0.06]]), 42, { width: fw * 0.8 });
        K.cel(ctx, PP([[eu - 0.1 * tk, -0.41], [eu, -0.45], [eu + 0.08, -0.38], [eu + 0.08, -0.34], [eu, -0.4], [eu - 0.1 * tk, -0.37]]), pal.hairGrey, 46);
      }
      K.cel(ctx, PP(cap), pal.white, 60);
      K.line(ctx, PP([[-0.7, -0.74], [0, -0.86], [0.66, -0.78]]), 61, { width: fw * 0.75 });
      return { mouth: P(0.7, 0.5), ear: P(0.36, 0.04), top: P(0, -1.14), eye: P(turn > 0 ? 0.66 - 0.08 * clamp(turn) : 0.6, -0.2) };
    }
    // 1 long face, jaw a little narrower, chin forward
    K.cel(ctx, PP(head), pal.skin, 1);
    // 2 grey hair at the side under the cap, the big ear over it, the blush
    K.cel(ctx, PP([[-0.72, -0.6], [-0.8, -0.38], [-0.72, -0.14], [-0.62, -0.26], [-0.6, -0.08], [-0.48, -0.28], [-0.44, -0.54]]), pal.hairGrey, 30);
    K.cel(ctx, PP(ell(-0.5, 0.04, 0.15, 0.24, 0, 20)), pal.skin, 20);
    K.line(ctx, PP([[-0.45, -0.09], [-0.55, 0.04], [-0.46, 0.15]]), 21, { width: fw * 0.7 });
    K.cel(ctx, PP(ell(0.02, 0.28, 0.13, 0.09, 0, 16)), pal.blush, 31, { width: 0 });
    // 3 eyes: type 2, dark dashes under heavy lids; dots when surprised; shut lines for a yawn or a blink
    const eyes = [[0.12, 1, -1], [0.4, 0.8, 1]];
    const ev = face === 'read' ? -0.19 : -0.22;
    const shut = blink || face === 'yawn';
    const heavy = face === 'bored' || face === 'sigh' || face === 'resigned' ? 0.05 : 0;
    eyes.forEach(([u, kx, side], i) => {
      if (shut) {
        K.line(ctx, PP([[u - 0.09 * kx, ev], [u, ev + 0.03], [u + 0.09 * kx, ev]]), 40 + i, { width: fw });
        return;
      }
      if (face === 'surprised') {
        K.cel(ctx, PP(ell(u, ev, 0.055 * kx, 0.075, 0, 12)), pal.ink, 40 + i, { width: 0 });
        return;
      }
      const out = side;
      K.line(ctx, PP([[u - 0.08 * kx, ev + 0.01 + heavy], [u + 0.08 * kx, ev + 0.01 + heavy]]), 40 + i, { width: fw * 1.15, taper: [1, 1] });
      K.line(ctx, PP([[u - 0.13 * kx * out, ev - 0.08 + heavy * 1.6], [u, ev - 0.08 + heavy * 1.6], [u + 0.14 * kx * out, ev - 0.02 + heavy]]), 42 + i, { width: fw * 0.8 });
      K.line(ctx, PP([[u - 0.07 * kx, ev + 0.08], [u + 0.07 * kx, ev + 0.09]]), 44 + i, { width: Math.max(2.5, fw * 0.55), taper: [1, 1] });
    });
    // 4 brows: grey tufts, the outer ends drooping (raised when surprised)
    eyes.forEach(([u, kx, side], i) => {
      const up = face === 'surprised' ? -0.12 : face === 'talk' ? -0.04 : face === 'yawn' ? -0.06 : 0;
      const bv = -0.4 + up;
      const outEnd = [u + 0.17 * kx * side, bv + (face === 'surprised' ? -0.02 : 0.07)];
      const inEnd = [u - 0.13 * kx * side, bv - (face === 'resigned' ? 0.1 : 0.01)];
      K.cel(ctx, PP([inEnd, [u, bv - 0.05], outEnd, [outEnd[0], outEnd[1] + 0.04], [u, bv], [inEnd[0], inEnd[1] + 0.045]]), pal.hairGrey, 46 + i);
    });
    // 5 the big nose, 6 the moustache
    const nu = 0.6, nv = 0.08;
    K.cel(ctx, PP(ell(nu, nv, 0.22, 0.19, -0.2, 22)), pal.skin, 50);
    const mx = nu - 0.06, my = 0.3;
    // 7 mouth under the moustache (drawn first, the moustache hangs over it)
    const mu = mx - 0.02, mv = 0.57;
    if (face === 'yawn') {
      K.cel(ctx, PP(ell(mu, mv + 0.17, 0.12, 0.22, 0, 20)), pal.mouth, 55);
    } else if ((face === 'talk' && Math.floor(tq * 6) % 2 === 0) || face === 'surprised' || face === 'sigh') {
      K.cel(ctx, PP(ell(mu, mv, 0.09, face === 'surprised' ? 0.1 : 0.065, 0, 16)), pal.mouth, 55);
    } else {
      const dn = face === 'resigned' ? 0.075 : 0.03; // the corners of the mouth sink
      K.line(ctx, PP([[mu - 0.12, mv + dn], [mu, mv - 0.005], [mu + 0.12, mv + dn]]), 55, { width: fw * 0.9, taper: [2, 2] });
    }
    K.cel(ctx, PP([[mx - 0.36, my + 0.15], [mx - 0.26, my - 0.02], [mx - 0.08, my - 0.06], [mx, my - 0.02], [mx + 0.1, my - 0.07], [mx + 0.26, my - 0.03], [mx + 0.34, my + 0.13], [mx + 0.25, my + 0.17], [mx + 0.1, my + 0.1], [mx, my + 0.13], [mx - 0.13, my + 0.11], [mx - 0.28, my + 0.21]]), pal.hairGrey, 52);
    // 8 white paper cap, set a little back
    K.cel(ctx, PP(cap), pal.white, 60);
    K.line(ctx, PP([[-0.7, -0.74], [0, -0.86], [0.66, -0.78]]), 61, { width: fw * 0.75 });
    return { mouth: P(mu, mv), ear: P(-0.5, 0.04), top: P(0, -1.14), eye: P(eyes[0][0], ev) };
  }

  function owner(ctx, x, y, o = {}) {
    const tq = o.ones ? o.t || 0 : lib.onTwos(o.t || 0);
    const s = (o.h || 560) / 400;
    const f = o.facing === -1 || o.facing === 'left' ? -1 : 1;
    const R = rigOwner(o, tq, kit(x, y, s, f, o, 2700));
    const K = kit(x, y, s, f, o, 2700);
    const back = o.view === 'back';
    const layer = o.layer || 'all';
    const showBack = layer !== 'front', showFront = layer !== 'back';
    const skin = pal.skin;
    let body = null; // the shirt's outline in design units, for the seams of arms drawn over it
    // from behind the broad torso sits under the head (G2: head centre (180, 650), shoulders across x 0
    // to 400 at y 800 when h is 1167 from (92.5, 1636)), so the legs and the shadow move with it
    const U0 = back ? 27 : 0;
    if (o.shadow !== false && showBack) lib.footShadow(ctx, x + f * (4 + U0) * s, y, (back ? 68 : 54) * s, { ground: o.ground, machine: K.brush });
    const arm = (sh, hand, pref, kind, id, seam) => {
      const el = id === 85 && R.elbowAt ? R.elbowAt : ik2(sh, hand, OB.upper, OB.fore, pref);
      limbTube(ctx, K, [sh, el, hand], OB.armW, skin, seam ? body : null, sh);
      limbTube(ctx, K, [sh, lerp2(sh, el, 0.94)], OB.sleeveW, pal.pink, seam ? body : null, sh);
      const cuff = lerp2(sh, el, 0.94);
      const ad = angOf(sub2(el, sh));
      const nrm = [-Math.sin(ad), Math.cos(ad)];
      K.line(ctx, [add2(cuff, mul2(nrm, OB.sleeveW * 0.45)), add2(cuff, mul2(nrm, -OB.sleeveW * 0.45))], id, { width: Math.max(2.6, K.lw * 0.7), taper: [1, 1] });
      return drawHand(ctx, K, hand, angOf(sub2(hand, el)), OB.hand, kind, skin, id + 2, -1);
    };
    const leg = (hip, ankle, id) => {
      const kn = ik2(hip, ankle, OB.thigh, OB.shin, R.knee);
      K.tubes(ctx, [[hip, kn, ankle]], OB.legW, pal.slate);
      drawShoe(ctx, K, ankle, 0, OB.shoeL, OB.shoeH, back ? 0.6 : 1, pal.shoe, id);
    };
    const e = sub2(R.neck, R.hip);
    const L = len2(e);
    const ev = mul2(e, 1 / L), nv = [-ev[1], ev[0]];
    const map = (u, v) => add2(R.hip, add2(mul2(ev, v), mul2(nv, u)));
    const sack = [[-20, L + 2], [-31, L * 0.86], [-31, L * 0.58], [-27, L * 0.25], [-25, 0], [-20, -8], [0, -10], [20, -8], [27, 0], [31, L * 0.3], [29, L * 0.6], [24, L * 0.88], [14, L + 2], [0, L + 5]];
    const backSack = [[-30, L + 4], [-56, L * 0.96], [-68, L * 0.82], [-63, L * 0.5], [-53, L * 0.18], [-48, 0], [-36, -9], [0, -11], [36, -9], [48, 0], [53, L * 0.18], [63, L * 0.5], [68, L * 0.82], [56, L * 0.96], [30, L + 4], [0, L + 6]].map((q) => map(U0 + q[0], q[1]));
    body = back ? backSack : sack.map((q) => map(q[0], q[1]));
    if (back) {
      R.shN = map(U0 + 56, L * 0.8);
      R.shF = map(U0 - 56, L * 0.8);
      R.hipN = add2(R.hipN, [U0 + 10, 0]);
      R.hipF = add2(R.hipF, [U0 - 10, 0]);
      R.ankleN = add2(R.ankleN, [U0 + 12, 0]);
      R.ankleF = add2(R.ankleF, [U0 - 8, 0]);
    }
    const anchors = {};
    let tip = R.handN;
    if (showBack) {
      if (back) {
        // from behind: the working arm reaches past his back, the other hangs on the near side
        tip = arm(R.shN, R.handN, R.elbowN, R.kindN, 85, false);
        leg(R.hipN, R.ankleN, 92);
        leg(R.hipF, R.ankleF, 91);
        K.tubes(ctx, [[R.neck, R.head]], 16, skin);
        K.cel(ctx, backSack, pal.pink, 10);
        // apron straps crossing the back, the bow at the waist, the neck loop
        K.tubes(ctx, [[map(U0 + 50, L * 0.88), map(U0 - 22, L * 0.2)], [map(U0 - 50, L * 0.88), map(U0 + 22, L * 0.2)]], 7, pal.white);
        K.cel(ctx, ell(...map(U0 - 9, L * 0.18), 10, 7, 0.5, 14), pal.white, 15);
        K.cel(ctx, ell(...map(U0 + 9, L * 0.18), 10, 7, -0.5, 14), pal.white, 16);
        K.tubes(ctx, [[map(U0, L * 0.16), map(U0 - 5, L * 0.02)], [map(U0, L * 0.16), map(U0 + 6, L * 0.0)]], 5, pal.white);
        const hd = ownerHead(ctx, K, R.head, OB.headR, R.tilt, R.face, tq, !!o.blink, true, o.headTurn || 0);
        Object.assign(anchors, { mouth: K.T(hd.mouth), ear: K.T(hd.ear), top: K.T(hd.top), eye: K.T(hd.eye) });
        arm(R.shF, R.handF, R.elbowF, R.kindF, 80, true);
      } else {
        if (!R.armsFront) arm(R.shF, R.handF, R.elbowF, R.kindF, 80, false);
        leg(R.hipF, R.ankleF, 91);
        leg(R.hipN, R.ankleN, 92);
        K.tubes(ctx, [[R.neck, R.head]], 16, skin);
        K.cel(ctx, body, pal.pink, 10);
        // apron: bib to mid-thigh, strap round the neck, a pocket, the bow at the back
        const apron = [[4, L * 0.8], [26, L * 0.8], [28, L * 0.55], [33, L * 0.25], [36, -10], [38, -64], [34, -84], [-2, -86], [-8, -64], [-6, -10], [-2, L * 0.3]];
        K.line(ctx, [map(5, L * 0.8), map(-6, L + 4), map(-12, L + 2)], 12, { width: Math.max(2.6, K.lw * 0.7) });
        K.cel(ctx, apron.map((q) => map(q[0], q[1])), pal.white, 13);
        K.line(ctx, [map(10, -14), map(11, -38), map(28, -38), map(28, -14)], 14, { width: Math.max(2.6, K.lw * 0.7), taper: [1, 1] });
        K.cel(ctx, ell(...map(-31, L * 0.3), 6, 9, 0.5, 12), pal.white, 15);
        K.cel(ctx, ell(...map(-33, L * 0.22), 5, 8, -0.4, 12), pal.white, 16);
        const hd = ownerHead(ctx, K, R.head, OB.headR, R.tilt, R.face, tq, !!o.blink, false);
        Object.assign(anchors, { mouth: K.T(hd.mouth), ear: K.T(hd.ear), top: K.T(hd.top), eye: K.T(hd.eye) });
      }
    }
    anchors.hold = K.T(R.hold || lerp2(R.handN, R.handF, 0.5));
    anchors.keys = K.T([66, -200]);
    if (showFront && !back) {
      if (R.armsFront) arm(R.shF, R.handF, R.elbowF, R.kindF, 80, true);
      if (typeof o.hold === 'function') o.hold(ctx, anchors);
      else if (R.holdKind === 'ticket' && o.ticket !== false) props.ticket(ctx, anchors.hold[0], anchors.hold[1] - 48 * s, { w: 76 * s, lines: o.lines, rot: f * -0.08, plate: o.plate, line: o.line, seed: 3 });
      else if (R.holdKind === 'handset' || R.holdKind === 'pinned') props.handset(ctx, anchors.hold[0], anchors.hold[1], { w: 66 * s, rot: f * (R.holdKind === 'pinned' ? 1.2 : 1.35), plate: o.plate, line: o.line, flip: f < 0 });
      else if (R.holdKind === 'burger' && o.burger !== false) props.burger(ctx, anchors.hold[0], anchors.hold[1], { w: 64 * s, plate: o.plate, line: o.line });
      tip = arm(R.shN, R.handN, R.elbowN, R.kindN, 85, true);
    }
    Object.assign(anchors, { head: K.T(R.head), headR: OB.headR * s, hand: K.T(tip), handFar: K.T(R.handF), chest: K.T(lerp2(R.hip, R.neck, 0.7)), shoulder: K.T(R.shN), shoulderFar: K.T(R.shF), ground: [x, y] });
    return anchors;
  }
  cast.owner = owner;

  // ---------------------------------------------------------------------------
  // Telephones: the desk telephone, its handset and curly cord, a mobile
  // ---------------------------------------------------------------------------
  props.handset = (ctx, x, y, o = {}) => {
    const w = o.w || 110;
    const K = kit(x, y, w / 100, o.flip ? -1 : 1, o, 4050, o.rot || 0);
    K.tubes(ctx, [{ pts: [[-38, 4], [-20, -6], [20, -6], [38, 4]], w: 15 }, { pts: [[-42, 8], [-42, 8]], w: 30 }, { pts: [[42, 8], [42, 8]], w: 30 }], 15, pal.slate);
    K.line(ctx, [[-52, 14], [-32, 14]], 2, { width: Math.max(2.5, K.lw * 0.6), taper: [2, 2] });
    K.line(ctx, [[32, 14], [52, 14]], 3, { width: Math.max(2.5, K.lw * 0.6), taper: [2, 2] });
    return { ear: K.T([-42, 10]), mouth: K.T([42, 10]), cord: K.T([44, 22]) };
  };

  props.cord = (ctx, a, b, o = {}) => {
    const n = o.loops || 12;
    const sag = o.sag != null ? o.sag : Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.3;
    const r = o.r || 7;
    const pts = [];
    const steps = n * 10;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const cx = lerp(a[0], b[0], u), cy = lerp(a[1], b[1], u) + Math.sin(Math.PI * u) * sag;
      const ph = u * n * TAU;
      pts.push([cx + Math.cos(ph) * r, cy + Math.sin(ph) * r * 0.6]);
    }
    lib.stroke(ctx, pts, { width: Math.max(2.5, (o.line != null ? o.line : LINE) * 0.6), color: pal.ink, seed: 4060, taper: [3, 3], smooth: false, brush: plateIsMachine(o) });
  };

  props.phone = (ctx, x, y, o = {}) => {
    const w = o.w || 140;
    const s = w / 140;
    let dx = 0;
    if (o.ring) dx = (Math.floor((o.t || 0) * 24 + 1e-6) % 2 ? 1 : -1) * Math.max(1.5, w * 0.015);
    const K = kit(x + dx, y, s, 1, o, 4070);
    K.cel(ctx, densePoly([[-66, 0], [66, 0], [52, -66], [-52, -66]], 4), pal.slate, 1);
    let id = 10;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        K.cel(ctx, lib.rrectPts(-27 + c * 18 - 6 + r * 1.2, -54 + r * 15, 13, 10, 3, 2), pal.white, id++, { width: Math.max(2.5, K.lw * 0.55) });
      }
    }
    K.cel(ctx, lib.rrectPts(-44, -80, 14, 16, 4, 2), pal.slate, 3);
    K.cel(ctx, lib.rrectPts(30, -80, 14, 16, 4, 2), pal.slate, 4);
    if (!o.lifted) props.handset(ctx, ...K.T([0, -88]), { w: 120 * s, rot: 0, plate: o.plate, line: o.line });
    if (o.ring) {
      for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) K.line(ctx, [[sd * 76, -70 + i * 22], [sd * 90, -76 + i * 22]], 20 + i + (sd > 0 ? 3 : 0), { taper: [1, 3] });
    }
    return { cradle: K.T([0, -88]), cordStart: K.T([60, -24]), top: K.T([0, -104]) };
  };

  props.mobile = (ctx, x, y, o = {}) => {
    const h = o.h || 260;
    const s = h / 100;
    let dx = 0;
    if (o.ring) dx = (Math.floor((o.t || 0) * 24 + 1e-6) % 2 ? 1 : -1) * Math.max(1.5, h * 0.012);
    const K = kit(x + dx, y, s, 1, o, 4100, o.rot || 0);
    K.cel(ctx, lib.rrectPts(-25, -50, 50, 100, 9, 3), pal.slate, 1);
    K.cel(ctx, lib.rrectPts(-20, -40, 40, 76, 4, 3), pal.screen, 2, { width: Math.max(2.5, K.lw * 0.6) });
    K.line(ctx, [[-6, -45], [6, -45]], 3, { width: Math.max(2.6, K.lw * 0.6), taper: [1, 1] });
    K.cel(ctx, ell(0, 43, 3.2, 3.2, 0, 12), pal.white, 4, { width: Math.max(2.5, K.lw * 0.5) });
    (o.lines || []).forEach((str, i) => {
      const size = fitSize(ctx, str, 'note', 9 * s, 34 * s);
      K.text(ctx, str, [0, -26 + i * 13], size / s, { face: 'note', align: 'center', baseline: 'middle', color: pal.ink, seed: 80 + i, jitter: 0.6 });
    });
    if (o.ring) {
      for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) K.line(ctx, [[sd * 32, -24 + i * 16], [sd * 40, -28 + i * 16]], 10 + i + (sd > 0 ? 3 : 0), { taper: [1, 3] });
    }
    const a = K.T([-20, -40]), b = K.T([20, 36]);
    return { screen: { x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) }, top: K.T([0, -50]) };
  };

  props.register = (ctx, x, y, o = {}) => {
    const w = o.w || 200;
    const s = w / 200;
    const K = kit(x, y, s, 1, o, 4150);
    const dr = clamp(o.drawer || 0) * 40;
    K.cel(ctx, lib.rrectPts(-96 - dr, -42, 150, 40, 5, 4), pal.slate, 5);
    K.line(ctx, [[-60 - dr, -22], [-36 - dr, -22]], 6, { width: Math.max(2.6, K.lw * 0.7), taper: [2, 2] });
    K.cel(ctx, densePoly([[-100, -40], [100, -40], [100, -120], [70, -150], [-100, -150]], 4), pal.slate, 1);
    K.cel(ctx, densePoly([[-10, -150], [70, -150], [96, -124], [96, -112], [-10, -112]], 4), pal.machineDark, 2);
    let id = 10;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) K.cel(ctx, lib.rrectPts(-88 + c * 20, -136 + r * 16, 14, 10, 3, 2), pal.white, id++, { width: Math.max(2.5, K.lw * 0.55) });
    K.cel(ctx, lib.rrectPts(-88, -100, 74, 14, 4, 3), pal.white, id++, { width: Math.max(2.5, K.lw * 0.55) });
    K.tubes(ctx, [[[40, -150], [40, -176]]], 8, pal.slate);
    K.cel(ctx, lib.rrectPts(0, -214, 84, 40, 6, 3), pal.slate, 3);
    K.cel(ctx, lib.rrectPts(8, -207, 68, 26, 4, 3), pal.screen, 4, { width: Math.max(2.5, K.lw * 0.6) });
    if (o.text) K.text(ctx, o.text, [42, -194], fitSize(ctx, o.text, 'note', 20 * s, 60 * s) / s, { face: 'note', align: 'center', baseline: 'middle', color: pal.ink, seed: 91, jitter: 0.5 });
    return { display: K.T([42, -194]), drawer: K.T([-21 - dr, -22]), top: K.T([42, -214]) };
  };

  props.keypad = (ctx, x, y, o = {}) => {
    const w = o.w || 300;
    const s = w / 300;
    const K = kit(x, y, s, 1, o, 4200);
    const screen = o.screen !== false;
    // 3 x 4 keys of 92 px with 12 px gaps at w 300 (storyboard 14), a screen strip on top
    const top = screen ? -526 : -450;
    K.cel(ctx, lib.rrectPts(-162, top, 324, -top, 18, 6), pal.slate, 1);
    if (screen) {
      K.cel(ctx, lib.rrectPts(-140, top + 14, 280, 56, 8, 4), pal.screen, 2, { width: Math.max(2.5, K.lw * 0.6) });
      if (o.text) K.text(ctx, o.text, [0, top + 44], fitSize(ctx, o.text, 'note', 42, 250), { face: 'note', align: 'center', baseline: 'middle', color: pal.ink, seed: 90, jitter: 0.5 });
    }
    const labels = Array.isArray(o.labels) && o.labels.length === 12 ? o.labels : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
    const press = o.press != null ? o.press : -1;
    const y0 = top + (screen ? 84 : 12);
    for (let i = 0; i < 12; i++) {
      const r = Math.floor(i / 3), c = i % 3;
      const kx = -150 + c * 104, ky = y0 + r * 104 + (i === press ? 6 : 0);
      K.cel(ctx, lib.rrectPts(kx, ky, 92, 92, 14, 4), i === press ? pal.stone : pal.white, 10 + i, { width: Math.max(2.5, K.lw * 0.7) });
      if (o.labels !== false) K.text(ctx, labels[i], [kx + 46, ky + 48], 34, { face: 'note', align: 'center', baseline: 'middle', color: pal.slate, seed: 100 + i, jitter: 0.4 });
    }
    return { screen: K.T([0, top + 44]), top: K.T([0, top]), key: (i) => K.T([-104 + (i % 3) * 104, y0 + Math.floor(i / 3) * 104 + 46]) };
  };

  // ---------------------------------------------------------------------------
  // The gauge (the machine's face and the big gauge share it). Design: radius 190, pivot at (cx, cy),
  // ticks every 10 degrees from 200 to 340 (canvas angles, 270 straight up), LOW at 200, HIGH at 340
  // ---------------------------------------------------------------------------
  function gaugeDraw(ctx, K, cx, cy, level, o) {
    const r = 190;
    const face = [];
    for (let i = 0; i <= 32; i++) {
      const a = Math.PI + (i / 32) * Math.PI;
      face.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    face.push([cx + r, cy + 14], [cx - r, cy + 14]);
    K.cel(ctx, face, pal.dial, 1);
    const tw = Math.max(2.6, K.lw * 0.7);
    for (let i = 0; i <= 14; i++) {
      const a = (200 + i * 10) * DEG;
      const r0 = i % 7 === 0 ? 0.7 : 0.8;
      K.line(ctx, [[cx + Math.cos(a) * r * r0, cy + Math.sin(a) * r * r0], [cx + Math.cos(a) * r * 0.94, cy + Math.sin(a) * r * 0.94]], 10 + i, { width: tw, taper: [1, 1] });
    }
    const a = (200 + 140 * clamp(level)) * DEG;
    const d = dir2(a), nn = [-d[1], d[0]];
    const c = [cx, cy];
    K.cel(ctx, [add2(c, mul2(nn, 4)), add2(c, add2(mul2(d, 160), mul2(nn, 1.5))), add2(c, add2(mul2(d, 160), mul2(nn, -1.5))), add2(c, mul2(nn, -4)), add2(c, mul2(d, -18))], pal.ink, 20, { smooth: false, width: Math.max(2.5, K.lw * 0.6) });
    K.cel(ctx, ell(cx, cy, 14, 14, 0, 18), pal.red, 21);
    if (o.labels !== false) {
      const size = 30 / CAP.note;
      [['LOW', [-240, -5], pal.grass, pal.ink], ['MEDIUM', [0, -195], pal.titleYellow, pal.ink], ['HIGH', [245, -5], pal.red, pal.white]].forEach(([str, q, bg, fg], i) => {
        const p = K.T([cx + q[0], cy + q[1]]);
        const box = lib.letters(ctx, str, p[0], p[1], { size: size * K.s, face: 'note', align: 'center', measure: true });
        const pad = 9 * K.s;
        const q0 = K.D([box.x0 - pad, box.y0 - pad]), q1 = K.D([box.x1 + pad, box.y1 + pad * 0.5]);
        K.cel(ctx, lib.rrectPts(q0[0], q0[1], q1[0] - q0[0], q1[1] - q0[1], 8, 3), bg, 30 + i, { width: Math.max(2.5, K.lw * 0.6) });
        lib.letters(ctx, str, p[0], p[1], { size: size * K.s, face: 'note', align: 'center', color: fg, seed: 40 + i });
      });
    }
    // the title and the caption on white strips, as on the machine's face, so they read on any ground
    const strip = (str, face, cap, base, maxW, id, jitter) => {
      const sz = fitSize(ctx, str, face, (cap / CAP[face]) * K.s, maxW * K.s);
      const w = lib.letters(ctx, str, 0, 0, { size: sz, face, measure: true }).w / K.s;
      const c2 = (sz / K.s) * CAP[face];
      K.cel(ctx, lib.rrectPts(cx - w / 2 - 16, base - c2 - 12, w + 32, c2 + 26, 8, 3), pal.white, id, { width: Math.max(2.5, K.lw * 0.6) });
      const p = K.T([cx, base]);
      lib.letters(ctx, str, p[0], p[1], { size: sz, face, align: 'center', color: pal.ink, seed: id + 2, jitter });
    };
    if (o.title) strip(o.title, 'round', 34, cy - 262, 520, 45, 1);
    if (o.caption) strip(o.caption, 'note', 22, cy + 64, 480, 46, 0.6);
    return K.T(add2(c, mul2(d, 160)));
  }
  props.gauge = (ctx, x, y, o = {}) => {
    const r = o.r || 300;
    const K = kit(x, y, r / 190, 1, o, 3300);
    const tip = gaugeDraw(ctx, K, 0, 0, o.level != null ? o.level : 0.5, {
      labels: o.labels,
      title: o.title === false ? null : o.title || 'SENSITIVITY TO PRICE',
      caption: o.caption === false ? null : o.caption || 'based on willingness to pay in your area',
    });
    return { tip, pivot: [x, y], r };
  };

  // ---------------------------------------------------------------------------
  // The pricing machine, from the front (art bible 10.3). Design units are the storyboard's G3 pixels
  // relative to the ground point (540, 1480): o.h 660 draws G3 exactly.
  // ---------------------------------------------------------------------------
  function machineShoe(side) {
    const q = [[-70, 25], [-74, -2], [-58, -20], [-12, -25], [40, -21], [70, -6], [76, 14], [62, 25]];
    return q.map(([u, v]) => [side * (150 + u * 0.9 + 20) - side * 20, -25 + v]);
  }
  function machine(ctx, x, y, o = {}) {
    const tq = o.ones ? o.t || 0 : lib.onTwos(o.t || 0);
    const pose = o.pose || 'idle';
    const s = (o.h || 660) / 660;
    const k = clamp(o.k != null ? o.k : pose === 'print' ? 1 : 0);
    let sx = 1, sy = 1, dx = 0, neck = 1;
    if (pose === 'crouch') {
      sx = 1.06;
      sy = 0.9;
    } else if (pose === 'hop') {
      sx = 0.95;
      sy = 1.08;
    } else if (pose === 'gulp') {
      const st = stage3(k);
      neck = [0.5, 1.4, 1][st];
      sy = [0.96, 1.0, 1][st];
      sx = [1.02, 1, 1][st];
    }
    if (typeof o.shake === 'number') dx = o.shake / s; // frame px, signed: the scene's own shudder
    else if (pose === 'think' || (pose === 'print' && k > 0 && k < 1)) {
      const fr = Math.floor((o.t || 0) * 24 + 1e-6);
      dx = (h3(fr, 3, 9) - 0.5) * 8;
    }
    const K = kit(x, y, s, 1, o, 3100);
    const B = (p) => [p[0] * sx + dx, p[1] * sy];
    const BB = (arr) => arr.map(B);
    // 1 the shadow spot, legs and shoes, toes turned out
    const hop = pose === 'hop';
    if (o.shadow !== false) {
      // it stands where the floor meets the wall (G3): the spot lies on the floor only
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 400 * s, y, 800 * s, 80 * s);
      ctx.clip();
      lib.footShadow(ctx, x, y, 280 * s, { ground: o.ground, machine: K.brush, ry: 34 * s });
      ctx.restore();
    }
    for (const side of [-1, 1]) {
      const top = B([side * 150, -180]);
      const ank = hop ? [side * 140, -26] : [side * 150, -50];
      const kn = ik2(top, ank, 70, 70, [side, 0]);
      K.tubes(ctx, [[top, kn, ank]], 26, pal.machineDark);
      K.cel(ctx, machineShoe(side).map((p) => (hop ? [p[0], p[1] + 24] : p)), pal.shoe, side > 0 ? 92 : 91);
    }
    // 2 periscope behind the box top: down (o.scope 0) to up (1)
    const scope = clamp(o.scope != null ? o.scope : 0);
    const hy = lerp(-750, -1140, scope);
    K.tubes(ctx, [BB([[300, -650], [300, hy + 60]])], 40, pal.machineDark);
    K.cel(ctx, BB(lib.rrectPts(240, hy, 120, 90, 16, 5)), pal.machineDark, 20);
    // 3 the hopper: a funnel on top, its neck squeezes and swells as it gulps
    const nk = (u) => -20 + (u + 20) * neck;
    K.cel(ctx, BB(densePoly([[-240, -760], [200, -760], [nk(30), -660], [nk(-70), -660]], 6)), pal.machineDark, 21);
    // 4 the box, its name band, the gauge, the source strip, the slot
    K.cel(ctx, BB(lib.rrectPts(-340, -660, 680, 480, 40, 8)), pal.machine, 1);
    K.cel(ctx, BB(ell(-20, -760, 220, 18, 0, 40)), pal.ink, 22);
    for (const [rx, ry] of [[-315, -635], [315, -635], [-315, -205], [315, -205]]) K.disc(ctx, B([rx, ry]), 4, pal.ink);
    K.cel(ctx, BB(lib.rrectPts(-310, -645, 620, 60, 10, 5)), pal.white, 2);
    const name = o.name != null ? o.name : 'SENSITIVITY TO PRICE';
    if (name) K.text(ctx, name, B([0, -600]), fitSize(ctx, name, 'note', (34 / CAP.note) * s, 600 * s) / s, { face: 'note', align: 'center', color: pal.ink, seed: 61, jitter: 0.6 });
    const pv = B([0, -330]);
    const gK = kit(...K.T(pv), s, 1, o, 3200);
    const tip = gaugeDraw(ctx, gK, 0, 0, o.level != null ? o.level : 0.5, { labels: o.labels });
    K.cel(ctx, BB(lib.rrectPts(-325, -320, 650, 45, 8, 5)), pal.white, 3);
    const src = o.source != null ? o.source : 'based on willingness to pay in your area';
    if (src) K.text(ctx, src, B([0, -288]), fitSize(ctx, src, 'note', (22 / CAP.note) * s, 620 * s) / s, { face: 'note', align: 'center', color: pal.ink, seed: 62, jitter: 0.5 });
    K.cel(ctx, BB(lib.rrectPts(-212, -272, 424, 44, 12, 5)), pal.machineDark, 4);
    K.cel(ctx, BB(lib.rrectPts(-200, -265, 400, 30, 10, 5)), pal.ink, 5);
    // 5 the ticket comes out bottom first, shuddering on ones while it prints
    const anchors = {};
    const slotY = K.T(B([0, -250]))[1];
    if (pose === 'print' && k > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-1e5, slotY, 2e5, 1e5);
      ctx.clip();
      const off = (k - 1) * 245;
      if (o.ticketRot) {
        // the strip swings about the slot
        const c = K.T(B([0, -250]));
        ctx.translate(c[0], c[1]);
        ctx.rotate(o.ticketRot);
        ctx.translate(-c[0], -c[1]);
      }
      machineTicket(ctx, K, B([0, -235 + off]), o.lines || ['RECOMMENDED:', '$6.89']);
      ctx.restore();
      anchors.ticketTip = K.T(B([0, -235 + k * 245]));
      anchors.ticketTop = K.T(B([0, -235 + off]));
    } else anchors.ticketTip = anchors.ticketTop = K.T(B([0, -250]));
    // 6 thinking: thin smoke rising from the hopper
    if (pose === 'think') {
      for (let j = 0; j < 2; j++) {
        const pts = [];
        for (let i = 0; i <= 8; i++) pts.push(B([-60 + j * 60 + Math.sin(i * 1.1 + tq * 9 + j * 2) * 14, -790 - i * 22]));
        K.line(ctx, pts, 40 + j, { width: Math.max(2.6, K.lw * 0.6), color: pal.pavement, taper: [3, 12] });
      }
    }
    // 7 the eye: the periscope's lens on the head's left face
    const ec = B([238, hy + 45]);
    eyeOpen(ctx, K.T(ec), 30 * s, 30 * s, { ew: clamp(30 * s * 0.12, 2.5, K.lw), look: o.look || [-0.6, 0.2], lid: o.blink ? 1 : pose === 'think' ? 0.3 : 0, iris: null, irisR: 12 * s, lashes: 0, side: -1, skin: pal.machineDark, ball: true, seed: 3171 });
    Object.assign(anchors, {
      slot: K.T(B([0, -250])), hopper: K.T(B([-20, -760])), hopperNeck: K.T(B([-20, -660])), eye: K.T(ec),
      dial: { x: K.T(pv)[0], y: K.T(pv)[1], r: 190 * s }, needleTip: tip, top: K.T(B([300, hy])), ground: [x, y],
    });
    const c0 = K.T(B([-340, -660])), c1 = K.T(B([340, -180]));
    anchors.body = { x0: c0[0], y0: c0[1], x1: c1[0], y1: c1[1] };
    return anchors;
  }
  // the machine's ticket strip, top centre at p (design units of the machine): G3 lettering
  function machineTicket(ctx, K, p, lines) {
    const [x0, y0] = p;
    const pts = [[x0 - 150, y0], [x0 + 150, y0], [x0 + 150, y0 + 239]];
    for (let i = 1; i <= 12; i++) pts.push([x0 + 150 - i * 25, y0 + (i % 2 ? 245 : 239)]);
    K.cel(ctx, densePoly(pts, 6), pal.ticket, 30, { smooth: false });
    const [l1, l2] = [lines[0], lines[lines.length - 1]];
    if (lines.length > 1) K.text(ctx, l1, [x0, y0 + 55], fitSize(ctx, l1, 'note', 30 / CAP.note, 260), { face: 'note', align: 'center', color: pal.ink, seed: 63, jitter: 0.5 });
    K.text(ctx, l2, [x0, y0 + 185], fitSize(ctx, l2, 'note', 90 / CAP.note, 270), { face: 'note', align: 'center', color: pal.ink, seed: 64, jitter: 0.6 });
  }
  cast.machine = machine;
  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  /** Subdivide a polygon's edges so smoothing keeps straight edges straight. */
  function densePoly(pts, step, closed = true) {
    const out = [];
    const n = pts.length;
    const m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      for (let j = 0; j < k; j++) out.push(lerp2(a, b, j / k));
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  }
  const rectU = (x0, y0, w, h, step = 3) => lib.rectPts(x0, y0, w, h, step);
  /** densify(pts, step, closed = true): extra points along straight edges, so smoothing keeps them straight. */
  lib.densify = densePoly;
  /** The letter size that fits str into maxW px, at most size. */
  const fitSize = (ctx, str, face, size, maxW) => {
    const b = lib.letters(ctx, str, 0, 0, { size, face, measure: true });
    return b.w > maxW ? (size * maxW) / b.w : size;
  };

  /*
   * A part of a background object or of a cel, by mode: 'cel' (flat fill in a black contour),
   * 'bg' (street plate: soft wash with a pencil edge in its own darker colour).
   */
  function painter(ctx, K, mode, seed) {
    return {
      shape(pts, fill, id) {
        if (mode === 'cel') return K.cel(ctx, pts, fill, id);
        const P = K.TT(pts);
        lib.softWash(ctx, P, { color: fill, solid: true, marks: 0.6, rim: 0.12, seed: seed + id * 7 });
        lib.pencil(ctx, P, { closed: true, base: fill, seed: seed + id * 7 + 1, width: 2 });
      },
      line(pts, id, base) {
        if (mode === 'cel') return K.line(ctx, pts, id, { width: Math.max(2.6, K.lw * 0.7), taper: [2, 2] });
        lib.pencil(ctx, K.TT(pts), { base: base || pal.trunk, seed: seed + id * 7 + 3, width: 2 });
      },
    };
  }

  // the burger's whole outline: top bun, the lettuce and patty ends, the bottom bun
  const BURGER_OUTLINE = [[-48, -14], [-40, -28], [-24, -38], [0, -42], [24, -38], [40, -28], [48, -14], [52, -7], [55, -1], [53, 14], [50, 22], [48, 30], [42, 38], [0, 39], [-42, 38], [-48, 30], [-50, 22], [-53, 14], [-55, -1], [-52, -7]];
  props.burger = (ctx, x, y, o = {}) => {
    // the outline is 110 x 81 design units: drawn o.w wide and 0.69 o.w tall (G5: 320 x 220)
    const s = (o.w || 220) / 110;
    const FY = 0.937;
    const K0 = kit(x, y, s, 1, o, 3500, o.rot || 0);
    const fl = (pts) => pts.map((p) => [p[0], p[1] * FY]);
    const K = Object.assign({}, K0, {
      T: (p) => K0.T([p[0], p[1] * FY]),
      TT: (pts) => K0.TT(fl(pts)),
      cel: (c, pts, fill, id, extra) => K0.cel(c, fl(pts), fill, id, extra),
    });
    const bites = Math.max(0, Math.min(3, Math.round(o.bites || 0)));
    // o.biteSide 'right' (default) | 'left': the edge the mouth eats from; o.biteSize: the first bite's
    // diameter as a share of the width (default 40/110, about 0.36), the later bites in proportion
    const bs = o.biteSide === 'left' ? -1 : 1;
    const bk = o.biteSize != null ? (o.biteSize * 110) / 40 : 1;
    const B = [[54, -14, 20], [56, 14, 19], [36, -40, 18]].slice(0, bites).map(([bx, by, br]) => [bx * bs, by, br * bk]);
    // one clip per bite: where two bites overlap, an even-odd clip of all of them would paint the overlap back
    const clipOut = ([bx, by, br]) => {
      const c = K.T([bx, by]);
      ctx.beginPath();
      ctx.rect(-1e5, -1e5, 2e5, 2e5);
      ctx.moveTo(c[0] + br * s, c[1]);
      ctx.arc(c[0], c[1], br * s, 0, TAU);
      ctx.clip('evenodd');
    };
    const cut = (fn) => {
      if (!B.length) return fn();
      ctx.save();
      B.forEach(clipOut);
      fn();
      ctx.restore();
    };
    cut(() => {
      K.cel(ctx, [[-46, 22], [-16, 21], [16, 21], [46, 22], [48, 30], [42, 38], [0, 39], [-42, 38], [-48, 30]], pal.bun, 1);
      const patty = [];
      for (let i = 0; i <= 10; i++) patty.push([-50 + i * 10, 5 + (i % 2) * 1.6]);
      patty.push([53, 14]);
      for (let i = 10; i >= 0; i--) patty.push([-50 + i * 10, 23 - (i % 2) * 1.6]);
      patty.push([-53, 14]);
      K.cel(ctx, patty, pal.patty, 2);
      K.cel(ctx, [[-46, 0], [46, 0], [48, 6], [40, 7], [37, 17], [32, 7], [-18, 7], [-23, 16], [-28, 7], [-48, 6]], pal.cheese, 3, { smooth: false });
      const lt = [[-52, -7], [52, -7], [55, -1]];
      for (let i = 0; i <= 8; i++) lt.push([52 - i * 13, i % 2 ? 1 : 6]);
      lt.push([-55, -1]);
      K.cel(ctx, lt, pal.lettuce, 4);
      K.cel(ctx, [[-48, -4], [-48, -14], [-40, -28], [-24, -38], [0, -42], [24, -38], [40, -28], [48, -14], [48, -4], [0, -2]], pal.bun, 5);
      [[-24, -26, 0.3], [-8, -33, -0.2], [10, -31, 0.5], [27, -23, -0.4], [-34, -14, 0.1], [2, -19, -0.5], [35, -12, 0.3]].forEach(([sx, sy, a], i) =>
        K.cel(ctx, ell(sx, sy, 3.4, 1.9, a, 10), pal.sesame, 10 + i, { width: 0 })
      );
    });
    // bite edges: each bite's arc inside the burger, outside the other bites
    B.forEach(([bx, by, br], i) => {
      ctx.save();
      ctx.beginPath();
      lib.tracePath(ctx, K.TT(BURGER_OUTLINE), true);
      ctx.clip();
      B.forEach((b, j) => j !== i && clipOut(b));
      K.cel(ctx, ell(bx, by, br, br, 0, 30), null, 30 + i);
      ctx.restore();
    });
    const next = [[48, -10], [50, 12], [32, -32], [40, 0]][bites];
    return { top: K.T([0, -42]), bottom: K.T([0, 39]), bite: K.T([next[0] * bs, next[1]]), center: [x, y] };
  };


  props.priceTag = (ctx, x, y, o = {}) => {
    // (x, y) is the card's top center. G1: 280 x 150, strings to the corners, rocks about the string
    // tops; G4: 440 x 280, punched holes, glyph slots, rocks about the card's top center.
    const w = o.w || 280, h = o.h || 150;
    const drop = o.drop != null ? o.drop : h * 0.2;
    const pivotTop = o.pivot === 'top';
    const K = kit(x, pivotTop ? y : y - drop, 1, 1, o, 3600, o.swing || 0);
    const oy = pivotTop ? 0 : drop; // the card's top in K's units
    const sw = Math.max(2.6, K.lw * 0.6);
    const strings = o.strings || 'up';
    const corners = o.hang !== 'holes'; // default: the G1 card, strings to its top corners
    const hx = w / 2 - 0.09 * w, hy = oy + 0.107 * h;
    if (strings === 'up') {
      if (corners) {
        K.line(ctx, [[-(w / 2 - 20), oy - drop], [-(w / 2 - 3), oy + 3]], 1, { width: sw, taper: [1, 1] });
        K.line(ctx, [[w / 2 - 20, oy - drop], [w / 2 - 3, oy + 3]], 2, { width: sw, taper: [1, 1] });
      } else {
        K.line(ctx, [[-hx, oy - drop], [-hx, hy]], 1, { width: sw, taper: [1, 1] });
        K.line(ctx, [[hx, oy - drop], [hx, hy]], 2, { width: sw, taper: [1, 1] });
      }
    }
    K.cel(ctx, lib.rrectPts(-w / 2, oy, w, h, 0.064 * h, 4), pal.tag, 3);
    if (!corners) {
      for (const sx of [-1, 1]) K.cel(ctx, ell(sx * hx, hy, 0.022 * w, 0.022 * w, 0, 12), pal.white, sx > 0 ? 4 : 5, { width: Math.max(2.5, K.lw * 0.6) });
      if (strings === 'dangle') {
        for (const sx of [-1, 1]) K.line(ctx, [[sx * hx, hy], [sx * (hx + 0.05 * w), hy - 0.12 * h], [sx * (hx + 0.12 * w), hy + 0.2 * h], [sx * (hx + 0.1 * w), hy + 0.55 * h]], sx > 0 ? 6 : 7, { width: sw, taper: [1, 4] });
      }
    }
    // the price: glyph height o.size, baseline o.baseline below the card's top
    const price = o.price || '$5.69';
    const chars = Array.from(price);
    const count = o.count != null ? Math.max(0, Math.min(chars.length, o.count)) : chars.length;
    const base = oy + (o.baseline != null ? o.baseline : (115 / 150) * h); // G1: 115 below the top at h 150
    const fsz = (o.size || (100 / 150) * h) / CAP.note; // G1: glyphs 100 tall at h 150
    const seed = hash('tag', price) & 255;
    if (o.slots) {
      chars.forEach((ch, i) => {
        if (i >= count || !o.slots[i]) return;
        const [a, b] = o.slots[i];
        const sz = fitSize(ctx, ch, 'note', fsz, (b - a) * 1.1) * (i === count - 1 && o.popLast ? o.popLast : 1);
        K.text(ctx, ch, [(a + b) / 2 - x, base], sz, { face: 'note', align: 'center', color: pal.ink, seed: seed + i, jitter: 0.6 });
      });
    } else if (count > 0) {
      // the glyphs keep their height (G8: 100 in the G1 box 260 wide): narrow the letters first, shrink last
      // set tight, as a sign painter letters a price tag
      const maxW = 0.93 * w, tracking = -0.02;
      const w0 = lib.letters(ctx, price, 0, 0, { size: fsz, face: 'note', tracking, measure: true }).w;
      const squeeze = clamp(maxW / w0, 0.6, 1);
      const sz = w0 * squeeze > maxW ? (fsz * maxW) / (w0 * squeeze) : fsz;
      K.text(ctx, chars.slice(0, count).join(''), [0, base], sz, { face: 'note', align: 'center', color: pal.ink, seed, jitter: 0.6, squeeze, tracking });
    }
    return { pivot: pivotTop ? [x, y] : [x, y - drop], center: K.T([0, oy + h / 2]), bottom: K.T([0, oy + h]), holes: [K.T([-hx, hy]), K.T([hx, hy])] };
  };

  props.booth = (ctx, x, y, o = {}) => {
    // design units are the storyboard's G1 pixels relative to the ground point (690, 1480): o.w 580 draws G1
    const w = o.w || 580;
    const s = w / 580;
    const K = kit(x, y, s, 1, o, 3700);
    const pt = painter(ctx, K, o.mode || 'bg', 3700);
    const layer = o.layer || 'all';
    if (layer !== 'front') pt.shape(rectU(-150, -450, 340, 220, 10), pal.shadowWarm, 1);
    if (layer !== 'back') {
      pt.shape(rectU(-290, -480, 580, 30, 10), pal.wallYellow, 2);
      pt.shape(rectU(-290, -450, 140, 242, 10), pal.wallYellow, 3);
      pt.shape(rectU(190, -450, 100, 242, 10), pal.wallYellow, 4);
      pt.shape(rectU(-290, -208, 580, 208, 10), pal.wallYellow, 5);
      for (let i = 0, px = -250; px <= 250; px += 40, i++) pt.line([[px, -200], [px, -6]], 6 + i, pal.wallYellow);
      pt.shape(rectU(-170, -230, 380, 22, 6), pal.fence, 30);
      pt.shape(rectU(-248, -760, 16, 210, 6), pal.fence, 31);
      pt.shape(rectU(212, -760, 16, 210, 6), pal.fence, 32);
      // awning: stripes 60 wide in flower and paper, eight scallops on the lower edge
      const edge = (px) => -484 + 12 * Math.abs(Math.sin((Math.PI * (px + 310)) / 77.5));
      for (let i = 0, sx = -310; sx < 310; sx += 60, i++) {
        const x1 = Math.min(310, sx + 60);
        const st = [[sx, -550], [x1, -550]];
        for (let px = x1; px >= sx; px -= 5) st.push([px, edge(px)]);
        pt.shape(st, i % 2 ? pal.paper : pal.flower, 40 + i);
      }
      pt.shape(rectU(-270, -920, 520, 160, 10), pal.paper, 60);
      const sign = o.sign || 'BURGERS';
      K.text(ctx, sign, [-10, -805], fitSize(ctx, sign, 'round', 90 / CAP.round, 470), { face: 'round', align: 'center', color: pal.red, seed: 21 });
      if (o.price !== false) {
        const tp = K.T([-10, -730]);
        props.priceTag(ctx, tp[0], tp[1], { w: 280 * s, h: 150 * s, drop: 30 * s, hang: 'corners', size: 100 * s, baseline: 115 * s, price: o.price || '$5.69', swing: o.swing || 0, plate: o.plate, line: o.line });
      }
    }
    // the owner standing behind the counter: head centre (20, -375), head height 130 (storyboard G1);
    // his head is 72 of his 400 design units tall and sits at (30, -338) above his ground point
    const k2 = 130 / 72;
    const w0 = K.T([-150, -450]), w1 = K.T([190, -230]);
    return {
      window: { x0: w0[0], y0: w0[1], x1: w1[0], y1: w1[1] }, shelf: { x0: K.T([-170, 0])[0], x1: K.T([210, 0])[0], y: K.T([0, -230])[1] },
      counterY: K.T([0, -230])[1], tagTop: K.T([-10, -730]), sign: K.T([-10, -840]),
      owner: [x + (20 - 30 * k2) * s, y + (-375 + 338 * k2) * s], ownerH: 400 * k2 * s,
    };
  };

  props.ticket = (ctx, x, y, o = {}) => {
    const w = o.w || 220;
    const s = w / 100;
    const h = o.h != null ? o.h / s : 128;
    const K = kit(x, y, s, 1, o, 4000 + (o.seed || 0), o.rot || 0);
    const pts = [[-50, 0], [50, 0], [50, h - 6]];
    for (let i = 1; i <= 10; i++) pts.push([50 - i * 10, h - (i % 2 ? 0 : 6)]);
    K.cel(ctx, densePoly(pts, 4), pal.ticket, 1, { smooth: false });
    for (let i = 0; i < 9; i++) K.disc(ctx, [-40 + i * 10, 8], 1.6, pal.pavement);
    const lines = o.lines || ['RECOMMENDED:', '$6.89'];
    const n = lines.length;
    let yy = 24;
    lines.forEach((str, i) => {
      const last = i === n - 1;
      const size = fitSize(ctx, str, 'note', (last ? 32 : 13) * s, 86 * s) / s;
      yy += size * (last ? 0.85 : 0.7);
      K.text(ctx, str, [0, yy], size, { face: 'note', align: 'center', baseline: 'middle', color: last ? pal.ink : pal.slate, seed: 60 + i, jitter: 0.7 });
      yy += size * (last ? 0.6 : 0.45);
      if (!last && i === n - 2) {
        K.line(ctx, [[-38, yy + 2], [38, yy + 2]], 70, { width: Math.max(2.5, K.lw * 0.55), color: pal.slate, taper: [3, 3] });
        yy += 6;
      }
    });
    return { top: [x, y], bottom: K.T([0, h]) };
  };
  props.house = (ctx, x, y, o = {}) => {
    const h = o.h || 520;
    const s = h / 100;
    const K = kit(x, y, s, 1, o, 3800 + (o.seed || 0));
    const pt = painter(ctx, K, o.mode || 'bg', 3800 + (o.seed || 0));
    const rich = o.kind === 'rich';
    const anchors = {};
    if (!rich) {
      pt.shape(rectU(16, -92, 12, 24), pal.stone, 1);
      pt.shape(densePoly([[-55, -55], [0, -98], [55, -55]], 3), pal.roof, 2);
      pt.shape(rectU(-40, -58, 80, 58), pal.wallYellow, 3);
      pt.shape(rectU(-30, -46, 24, 24), pal.waterTop, 4);
      pt.line([[-18, -46], [-18, -22]], 5, pal.wallYellow);
      pt.line([[-30, -34], [-6, -34]], 6, pal.wallYellow);
      pt.shape(densePoly([[-30, -46], [-22, -46], [-30, -32]], 2), pal.flower, 7);
      pt.shape(densePoly([[-6, -46], [-14, -46], [-6, -32]], 2), pal.flower, 8);
      pt.shape(rectU(8, -42, 20, 42), pal.fence, 9);
      pt.shape(ell(24, -20, 1.6, 1.6, 0, 8), pal.trunk, 10);
      if (o.fence !== false) {
        pt.shape(rectU(-78, -13, 156, 3.5), pal.fence, 11);
        pt.shape(rectU(-78, -1, 156, 3.5), pal.fence, 12);
        for (let i = 0, px = -74; px <= 74; px += 9, i++) {
          pt.shape(densePoly([[px - 3.2, 9], [px - 3.2, -16], [px, -21], [px + 3.2, -16], [px + 3.2, 9]], 3), pal.fence, 20 + i);
        }
      }
      anchors.door = K.T([18, 0]);
      anchors.window = K.T([-18, -34]);
    } else {
      if (o.fountain !== false) {
        pt.shape(rectU(-121, -16, 6, 26), pal.stone, 1);
        pt.shape(ell(-118, -17, 12, 3.5, 0, 20), pal.stone, 2);
        for (const sx of [-1, 1]) lib.pencil(ctx, K.TT([[-118, -19], [-118 + sx * 7, -31], [-118 + sx * 16, -16], [-118 + sx * 22, 6]]), { color: pal.waterDeep, width: 2.4, seed: 3830 + sx });
        pt.shape(rectU(-146, 8, 56, 10), pal.stone, 3);
        pt.shape(ell(-118, 8, 28, 5, 0, 28), pal.waterTop, 4);
        anchors.fountain = K.T([-118, 8]);
      }
      pt.shape(densePoly([[-70, -84], [70, -84], [58, -101], [-58, -101]], 3), pal.hillsFar, 5);
      pt.shape(rectU(-64, -84, 128, 84), pal.cityPastel, 6);
      pt.shape(rectU(-68, -88, 136, 5), pal.stone, 7);
      let id = 10;
      for (const wx of [-58, -44, 31, 45]) {
        pt.shape(rectU(wx, -74, 13, 21), pal.waterTop, id++);
        pt.shape(rectU(wx, -40, 13, 27), pal.waterTop, id++);
        pt.line([[wx + 6.5, -40], [wx + 6.5, -13]], id++, pal.cityPastel);
      }
      pt.shape(densePoly([[-37, -67], [0, -88], [37, -67]], 3), pal.paper, 30);
      pt.shape(rectU(-38, -69, 76, 6), pal.stone, 31);
      pt.shape(rectU(-6, -38, 12, 32), pal.trunk, 32);
      [-27, -9, 9, 27].forEach((cx, i) => {
        pt.shape(rectU(cx - 3.6, -63, 7.2, 57), pal.paper, 33 + i * 3);
        pt.shape(rectU(cx - 5.2, -65, 10.4, 3), pal.stone, 34 + i * 3);
        pt.line([[cx, -60], [cx, -9]], 35 + i * 3, pal.stone);
      });
      pt.shape(rectU(-40, -6, 80, 4), pal.stone, 50);
      pt.shape(rectU(-44, -2, 88, 4), pal.stone, 51);
      if (o.gate !== false) {
        pt.shape(rectU(-92, -44, 12, 58), pal.stone, 52);
        pt.shape(rectU(80, -44, 12, 58), pal.stone, 53);
        pt.shape(ell(-86, -49, 6, 6, 0, 16), pal.stone, 54);
        pt.shape(ell(86, -49, 6, 6, 0, 16), pal.stone, 55);
        const bars = [];
        for (let bx = -76; bx <= 76; bx += 6.5) {
          const top = -24 - 8 * Math.cos((bx / 76) * (Math.PI / 2));
          bars.push([[bx, 13], [bx, top]]);
          bars.push([[bx - 1.6, top + 2], [bx, top - 2.5], [bx + 1.6, top + 2]]);
        }
        bars.forEach((b, i) => lib.pencil(ctx, K.TT(b), { color: pal.slate, width: 2.2, seed: 3900 + i, double: false }));
        lib.pencil(ctx, K.TT([[-80, -18], [-40, -26], [0, -30], [40, -26], [80, -18]]), { color: pal.slate, width: 2.6, seed: 3990 });
        lib.pencil(ctx, K.TT([[-80, 8], [80, 8]]), { color: pal.slate, width: 2.6, seed: 3991 });
        anchors.gate = K.T([0, 13]);
      }
      anchors.door = K.T([0, 0]);
    }
    anchors.top = K.T([0, rich ? -101 : -98]);
    anchors.ground = [x, y];
    return anchors;
  };

  props.receipt = (ctx, x, y, o = {}) => {
    const w = o.w || 70;
    const s = w / 40;
    const K = kit(x, y, s, 1, o, 4300 + (o.seed || 0) * 3, o.rot || 0);
    const pts = [[-20, -28], [20, -28], [20, 24]];
    for (let i = 1; i <= 6; i++) pts.push([20 - (i * 40) / 6, i % 2 ? 28 : 24]);
    K.cel(ctx, densePoly(pts, 4), pal.ticket, 1, { smooth: false });
    const lw = Math.max(2.5, K.lw * 0.55);
    [[-12, 8, -18], [-12, 4, -10], [-12, 12, -2]].forEach(([a, b, yy], i) => K.line(ctx, [[a, yy], [b, yy]], 2 + i, { width: lw, taper: [1, 1] }));
    if (w > 40) {
      const c = K.T([6, 12]);
      lib.letters(ctx, '$', c[0], c[1], { size: 16 * s, face: 'note', align: 'center', baseline: 'middle', rot: o.rot || 0, color: pal.green, seed: 7, jitter: 0.5 });
    }
  };

  props.coin = (ctx, x, y, o = {}) => {
    const w = o.w || 60;
    const sp = o.spin != null ? Math.abs(Math.cos(o.spin * Math.PI)) : 1;
    const rx = (w / 2) * Math.max(0.16, sp), ry = w / 2;
    const rot = o.rot || 0;
    const seed = 4400 + (o.seed || 0) * 3;
    lib.cel(ctx, ell(x, y, rx, ry, rot, 28), { fill: pal.coin, width: o.line != null ? o.line : LINE, seed, brush: plateIsMachine(o) });
    if (sp > 0.45) {
      lib.stroke(ctx, ell(x, y, rx * 0.7, ry * 0.7, rot, 24).concat([ell(x, y, rx * 0.7, ry * 0.7, rot, 24)[0]]), { width: Math.max(2.5, LINE * 0.55), seed: seed + 1, taper: [2, 2] });
      if (sp > 0.6) lib.letters(ctx, '$', x, y, { size: w * 0.56 * sp, face: 'round', align: 'center', baseline: 'middle', rot, color: pal.shoe, seed: 3, jitter: 0.3 });
    }
  };

  props.flow = (ctx, pts, o = {}) => {
    if (!pts || pts.length < 2) return;
    const t = o.ones ? o.t || 0 : lib.onTwos(o.t || 0);
    const n = o.n || 10;
    const rate = o.rate != null ? o.rate : 0.6;
    const size = o.size || 70;
    const spread = o.spread != null ? o.spread : size * 0.8;
    const P = lib.smoothPts(pts, false, 6);
    const S = [0];
    for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const L = S[S.length - 1] || 1;
    const { NX, NY } = openNormals(P);
    const seed = o.seed == null ? 1 : o.seed;
    for (let i = 0; i < n; i++) {
      const r = rng(hash('flow', seed, i));
      const ph = r(), sp = 0.85 + 0.3 * r(), off = (r() - 0.5) * spread, spin = (r() - 0.5) * 6, a0 = r() * TAU, kindR = r();
      const u = (((ph + t * rate * sp) % 1) + 1) % 1;
      const d = u * L;
      let j = 1;
      while (j < S.length - 1 && S[j] < d) j++;
      const q = clamp((d - S[j - 1]) / (S[j] - S[j - 1] || 1));
      const px = lerp(P[j - 1][0], P[j][0], q) + NX[j] * off, py = lerp(P[j - 1][1], P[j][1], q) + NY[j] * off;
      const kind = o.kind === 'coin' || o.kind === 'receipt' ? o.kind : kindR < 0.5 ? 'receipt' : 'coin';
      const rot = a0 + t * spin;
      if (kind === 'coin') props.coin(ctx, px, py, { w: size * 0.75, spin: (ph + t * 1.3) % 1, rot: rot * 0.2, seed: i, plate: o.plate, line: o.line });
      else props.receipt(ctx, px, py, { w: size, rot: Math.sin(rot) * 0.6, seed: i, plate: o.plate, line: o.line });
    }
  };

  props.map = (ctx, x, y, o = {}) => {
    const w = o.w || 700, h = o.h || 700;
    const K = kit(x, y, 1, 1, o, 4500);
    const seed = o.seed == null ? 7 : o.seed;
    const sheet = lib.rectPts(0, 0, w, h, 20);
    K.cel(ctx, sheet, pal.cityPastel, 1, { width: 0 });
    ctx.save();
    ctx.beginPath();
    lib.tracePath(ctx, K.TT(sheet), true);
    ctx.clip();
    if (o.style === 'land') {
      // a pale land shape with a ragged coast, no streets
      lib.softWash(ctx, K.TT(lib.blobPts(w * 0.5, h * 0.52, w * 0.46, h * 0.42, seed + 1, 0.22)), { color: pal.sand, soft: 6, marks: 0.5, alpha: 0.7, seed: seed + 1 });
      lib.softWash(ctx, K.TT(lib.blobPts(w * 0.3, h * 0.45, w * 0.16, h * 0.18, seed + 2, 0.25)), { color: pal.grass, soft: 5, marks: 0.4, alpha: 0.6, seed: seed + 2 });
    } else {
      lib.softWash(ctx, K.TT([[-20, h * 0.66], [w * 0.4, h * 0.56], [w + 20, h * 0.36], [w + 20, h * 0.46], [w * 0.42, h * 0.66], [-20, h * 0.75]]), { color: pal.waterTop, soft: 4, marks: 0.4, seed: seed + 1 });
      lib.softWash(ctx, K.TT(lib.blobPts(w * 0.74, h * 0.76, w * 0.13, h * 0.09, seed + 2, 0.2)), { color: pal.grass, soft: 4, marks: 0.4, seed: seed + 2 });
      lib.softWash(ctx, K.TT(lib.blobPts(w * 0.2, h * 0.24, w * 0.1, h * 0.08, seed + 3, 0.2)), { color: pal.grass, soft: 4, marks: 0.4, seed: seed + 3 });
      const road = lib.mix(pal.hillsFar, pal.ink, 0.25);
      const r = rng(hash('map', seed));
      for (let i = 0; i < 7; i++) {
        const vert = i % 2 === 0;
        const a = r(), b = r();
        const pts = [];
        for (let k = 0; k <= 4; k++) {
          const u = k / 4;
          const wob = (r() - 0.5) * 0.08;
          pts.push(vert ? [w * (lerp(a, b, u) + wob), h * (u * 1.2 - 0.1)] : [w * (u * 1.2 - 0.1), h * (lerp(a, b, u) + wob)]);
        }
        lib.pencil(ctx, K.TT(pts), { color: road, width: i < 3 ? 4 : 2.6, seed: seed + 10 + i });
      }
    }
    ctx.restore();
    lib.ragged(ctx, K.TT(sheet), { closed: true, base: pal.cityPastel, seed: seed + 30 });
    // restaurants: dots coloured by a smooth price field so neighbours look alike (o.mono: all red)
    const n = o.n || 36;
    const dr = o.dotR || Math.min(w, h) * 0.024;
    const dots = [];
    const rr = rng(hash('dots', seed));
    const gap = o.gap || Math.min(Math.min(w, h) * 0.09, Math.sqrt((w * h) / n) * 0.62);
    let guard = 0;
    while (dots.length < n && guard++ < n * 60) {
      const dx = lerp(0.05, 0.95, rr()) * w, dy = lerp(0.06, 0.94, rr()) * h;
      if (dots.some((d) => Math.hypot(d.x - x - dx, d.y - y - dy) < gap)) continue;
      const v = 0.5 + 0.6 * lib.fbm2((dx / w) * 2.2, (dy / h) * 2.2, seed + 5);
      dots.push({ x: x + dx, y: y + dy, level: v < 0.4 ? 0 : v < 0.62 ? 1 : 2 });
    }
    const p = o.p != null ? clamp(o.p) : 1;
    // o.pulse { idx: [dot indexes], k: 0..1 }: those dots swell and settle once over k
    const pulse = o.pulse && Array.isArray(o.pulse.idx) ? new Set(o.pulse.idx) : null;
    const pk = pulse ? 1 + 0.45 * Math.sin(Math.PI * clamp(o.pulse.k || 0)) : 1;
    const cols = [pal.green, pal.titleYellow, pal.red];
    const nb = o.booths || 0;
    dots.forEach((d, i) => {
      const local = p * dots.length - i;
      if (local <= 0) return;
      const sc = (local < 0.34 ? 0.72 : local < 0.67 ? 1.08 : 1) * (pulse && pulse.has(i) ? pk : 1);
      if (i < nb) {
        // a tiny booth: white box, red roof
        const bs = dr * 2.2 * sc;
        lib.cel(ctx, lib.rectPts(d.x - bs / 2, d.y - bs * 0.4, bs, bs * 0.8, bs * 0.3), { fill: pal.white, width: Math.min(LINE, bs * 0.16), seed: 4590 + i });
        lib.cel(ctx, [[d.x - bs * 0.62, d.y - bs * 0.38], [d.x, d.y - bs * 0.95], [d.x + bs * 0.62, d.y - bs * 0.38]], { fill: pal.red, width: Math.min(LINE, bs * 0.16), seed: 4595 + i, smooth: false });
        return;
      }
      lib.cel(ctx, ell(d.x, d.y, dr * sc, dr * sc, 0, 18), { fill: o.mono ? pal.red : cols[d.level], width: Math.min(LINE, dr * 0.42), seed: 4600 + i });
    });
    if (o.pinned) for (const [u, v] of [[0.02, 0.03], [0.98, 0.03]]) lib.cel(ctx, ell(x + u * w, y + v * h, 10, 10, 0, 14), { fill: pal.red, seed: 4580 + u * 10 });
    const pins = (o.pins || []).map((pin, i) => {
      const px = x + pin.u * w, py = y + pin.v * h;
      const ph = Math.min(w, h) * 0.09;
      const head = [px, py - ph];
      const pts = [];
      for (let k = 0; k <= 16; k++) {
        const a = Math.PI * 0.75 + (k / 16) * Math.PI * 1.5;
        pts.push([head[0] + Math.cos(a) * ph * 0.42, head[1] + Math.sin(a) * ph * 0.42]);
      }
      pts.push([px, py]);
      lib.cel(ctx, pts, { fill: pin.color || pal.red, seed: 4700 + i });
      lib.cel(ctx, ell(head[0], head[1], ph * 0.15, ph * 0.15, 0, 12), { fill: pal.white, width: Math.max(2.5, LINE * 0.6), seed: 4710 + i });
      if (pin.label) {
        const size = o.labelSize || Math.min(w, h) * 0.075;
        const box = lib.letters(ctx, pin.label, head[0], head[1] - ph * 0.62, { size, face: 'note', align: 'center', measure: true });
        lib.cel(ctx, lib.rrectPts(box.x0 - size * 0.25, box.y0 - size * 0.1, box.w + size * 0.5, box.y1 - box.y0 + size * 0.2, size * 0.2, 4), { fill: pal.white, seed: 4730 + i });
        lib.letters(ctx, pin.label, head[0], head[1] - ph * 0.62, { size, face: 'note', align: 'center', baseline: 'alphabetic', color: pal.ink, seed: 4720 + i });
      }
      return { x: px, y: py, head };
    });
    return { dots, pins };
  };

  lib.cast = cast;
  lib.props = props;

  // ===========================================================================
  // Read-only
  // ===========================================================================

  // A scene that changed lib, lib.pal or lib.ease would leak into every shot drawn after it, in
  // whatever order frames happen to be drawn (and differently in each render worker). So all of
  // it is frozen:
  //   - lib itself is a plain frozen object: a write throws in strict code and is ignored in
  //     non-strict code, so nothing leaks, and reading lib.fn in a hot loop stays at full speed.
  //   - pal and ease are also wrapped so a write throws even from non-strict scene code (core
  //     records it as a draw error, tools/check.cjs reports it). The wrapper makes each read about
  //     20 ns slower, so hoist colours out of per-point loops (const ink = P.ink). Code inside lib
  //     uses the raw objects and pays nothing.
  function readOnly(target, name) {
    const fail = (verb, prop) => {
      throw new TypeError(
        `${name} is read-only: a scene cannot ${verb} '${String(prop)}' (it would leak into other shots). ` +
          `Make a local copy instead, for example const P = Object.assign({}, FILM.lib.pal, { ink: '#000' }).`
      );
    };
    return new Proxy(Object.freeze(target), {
      set: (t, prop) => fail('set', prop),
      defineProperty: (t, prop) => fail('define', prop),
      deleteProperty: (t, prop) => fail('delete', prop),
      setPrototypeOf: () => fail('change the prototype of', name),
    });
  }
  for (const key of Object.keys(ease)) Object.freeze(ease[key]);
  lib.pal = readOnly(pal, 'FILM.lib.pal');
  lib.ease = readOnly(ease, 'FILM.lib.ease');
  for (const key of Object.keys(lib)) {
    const v = Object.getOwnPropertyDescriptor(lib, key).value;
    if (typeof v === 'function') Object.freeze(v);
  }
  // the cast and the props are namespaces of functions: frozen the same way, so no scene can swap one
  for (const ns of [cast, props]) {
    for (const key of Object.keys(ns)) Object.freeze(ns[key]);
    Object.freeze(ns);
  }
  Object.defineProperty(FILM, 'lib', { value: Object.freeze(lib), writable: false, enumerable: true, configurable: false });
})();

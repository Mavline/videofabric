# Art bible: One burger, two prices

The visual rules every scene follows.
Where this file and a scene brief disagree on a colour, a line weight or a drawing rule, this file wins.
Where this file and `docs/storyboard.md` disagree on a position or a time, the storyboard wins.

**This film does not use the skill's house style.** The skill's template calls sections 1 to 9 "the house style, already decided": inked cream paper, a navy blueprint plate, hatching, stipple, boiling lines and coloured overlay rings. For this film all of that is replaced. Sections 1 to 9 below are rewritten from `docs/reference-analysis.md`, the frame-by-frame analysis of two Soyuzmultfilm films: "Nu, pogodi!" episode 1 (art director S. Rusakov) and "Malysh i Karlson" (art directors A. Savchenko and Yu. Butyrin). Its 30 numbered style rules are cited here as R1 to R30. Sections 2.2 and 10 are this film's subject sections.

Everything below is implemented in `src/lib.js`: the manner helpers (`lib.cel`, `lib.softWash`, `lib.dense`, `lib.letters` and the rest), the cast (`lib.cast`) and the props (`lib.props`). The cast sheet in `tools/fixtures/cast/` shows every character in every pose and every prop on both plates:

```bash
node tools/snap.cjs --fixtures=tools/fixtures/cast --samples 8 --sheet   # one frame per page
node tools/check.cjs --fixtures=tools/fixtures/cast
```

Pages 4 and 6 of that sheet draw storyboard tables G1 (the booth) and G3 (the machine) at their own pixels, with pink crosses on the storyboard's target points.

## 1. Frame

The canvas is 1080 px wide and 1920 px tall at 24 fps.
Every pixel value in this file assumes that size.
The origin is the top-left corner and y grows downward.

The reference films are 4:3 at 360 px high. Their short side maps to our short side (1080 px), a factor of 3, and every measured thickness in this file is converted that way (R4).

### 1.1 Shorts safe area

YouTube Shorts draws its own interface over the video.
The title and channel row covers roughly the bottom 380 px, the button column covers roughly x 950 to 1080 from y 1000 down, and the top bar covers roughly the top 180 px.
Anything the viewer must read (the prices, the captions, a title, a face that tells the story) sits inside x 60 to 940 and y 220 to 1540.
Backgrounds and scenery run full bleed.
If a composition collides with the safe area, move the scenery, never the must-read content.

### 1.2 Composition for a tall frame

Compose for the height; never crop a square.
Frames are airy: on the street plate most of the frame is white paper (R10, R13).
A character that carries the shot is big: 0.22 to 0.40 of the frame height standing, and a face that carries a reaction is 0.15 to 0.25 of the frame height.
The camera almost never moves (section 7.3), so staging is done by placing characters, not by panning to them.

## 2. Palettes

Names below are the keys of `FILM.lib.pal`, mirrored exactly in the marked block of `src/lib.js`.
Section 2.1 was sampled from the reference frames (`docs/reference-analysis.md`, "Палитра"); section 2.2 is this film's own.
`lib.pal` also still holds the skill's house colours (`lavender`, `navy`, `sage`, `stripeCream` and so on) because the tool fixtures use them. **No scene of this film reads them.** A scene reads only the 51 names in 2.1 and 2.2.

Colour is flat everywhere on the cel layer (R7).
A gradient is allowed only in the background, and only for water and a pale sky band (R10).

### 2.1 The manner palette

| Name | Hex | Layer | Use |
|---|---|---|---|
| ink | #001003 | cel | Contour of every character and moving object; dips to black use pure black |
| paper | #FEFFF5 | background | Street plate paper, white sky, title field, the white flash |
| hillsFar | #B5B7C3 | background | Far hills, anything distant; the booth's interior on a light street |
| grass | #89D48C | background | Near meadow, lawns, bushes, the LOW patch on the gauge |
| wallYellow | #E7D885 | background | House walls, the booth front |
| waterTop | #A8FEF3 | background | Water at the surface, window glass, fountain water |
| waterDeep | #19A0A5 | background | Water in the depth, fountain jets (background only) |
| sand | #CABE73 | background | Sand, dry ground, the land on the wall map |
| fence | #A9C5BA | background | Fence boards, counter wood, sign posts |
| trunk | #6B8569 | background | Tree trunks, pencil grain of fences, doors |
| flower | #CB8FB9 | background | Meadow flowers, the awning stripes, curtains |
| cityPastel | #D4C2B5 | background | Pastel town of the machine plate, the rich house's walls, pavement on the street plate |
| pavement | #898A8B | background | Floor and pavement of the machine plate; speed lines and dust |
| wallWarm | #C57B3E | background | Warm room walls of the machine plate (inside the booth) |
| shadowWarm | #754926 | background | Shadow on the warm wall; the dark inside of the booth window |
| nightSky | #6B77A4 | background | Night, and the pricing machine's room |
| windowLight | #DA9067 | background | Lit windows at night |
| skin | #E8B998 | cel | Adult skin (the owner) |
| blush | #E19F88 | cel | Adult blush; the hero's blush when blissful |
| skinKid | #D3ADA2 | cel | The hero's skin |
| blushKid | #D08D7C | cel | The hero's blush, his tongue |
| hairYellow | #D8B967 | cel | The hero's hair |
| hairRed | #E9541E | cel | Spare accent (no character uses it) |
| red | #CC0005 | cel | The hero's shirt, the impact star's heart, HIGH, the BURGERS sign letters |
| green | #117E43 | cel | The bicycle frame, map dots in the LOW band |
| pink | #FE85AE | cel | The owner's shirt |
| slate | #3C686E | cel | The hero's shorts, the owner's trousers, telephone, keypad and register bodies |
| white | #F3F3F0 | cel | White fills on the cel layer: eyes, teeth, apron, paper cap, keys |
| mouth | #A02D2E | cel | Inside of an open mouth |
| iris | #3C78B6 | cel | The hero's iris |
| cap | #2D584B | cel | The hero's cap |
| titleSpot | #B2F0E6 | background | Pale blot under a title or a caption |
| titleSpotPink | #E9D6E8 | background | Second pale blot under a title |
| titleBlue | #2D8DA7 | lettering | Title letters, the closing word |
| titleYellow | #E9DE3C | lettering, cel | First letter of a title word, the MEDIUM patch |

### 2.2 Subject palette

Drawn colours for this film's objects, in the same logic as 2.1: saturated colour and white only on the cel layer, the background light and quiet.

| Name | Hex | Layer | Use |
|---|---|---|---|
| bun | #E8A04A | cel | Burger bun |
| sesame | #FFF3D1 | cel | Sesame seeds (no contour) |
| patty | #6A3417 | cel | Burger patty |
| lettuce | #58B947 | cel | Lettuce |
| cheese | #F8C31C | cel | Cheese slice with drips |
| tag | #F7E36B | cel | The price tag card |
| ticket | #F6F4EA | cel | The machine's ticket, receipts, the wall map sheet |
| dial | #FBF3D5 | cel | Face of the gauge |
| machine | #2D8DA7 | cel | The pricing machine's box |
| machineDark | #1F5F70 | cel | The machine's legs, periscope, hopper, slot lip; the register's top |
| screen | #BFEFD9 | cel | Phone, keypad and register screens (never glowing) |
| coin | #EDB92C | cel | Coins |
| shoe | #5A3321 | cel | Shoes of all three characters, the bicycle saddle |
| hairGrey | #A3A3A8 | cel | The owner's hair, brows and moustache |
| roof | #D19A7E | background | Roof of the modest house |
| stone | #D8D4C8 | background | Stone of the rich house, steps, fountain, gate pillars; a pressed key |

### 2.3 Colour logic

- **Street plate** (R9, light variant): the background is mostly light (brightness 180 to 254 of 255) and low in saturation; the characters are darker or more saturated than the background and carry a black contour.
- **Machine plate** (R9, dense variant): saturation above 0.8 and white brighter than 240 appear only on the cel layer; the ground stays in middle and dark tones (brightness 13 to 200), never pure white.
- **Depth** (R12): the far is paler, cooler and smaller (hillsFar, saturation 0.07, against grass, 0.35). No optical blur anywhere.
- **Night** (R15): the background turns to nightSky; the characters keep their day colours.
- **Shadows** (R14): no light and shade on a character, no shadow under the feet. A shadow on a wall is the character's silhouette at 0.57 of the wall's colour (shadowWarm on wallWarm), drawn with `lib.wallShadow`.

## 3. Line

### 3.1 The cel contour

Every character and every moving object has a closed black contour in ink (R2, R3).
The contour is **4.5 px at every shot size** (`lib.LINE`): a small rider in a wide shot and a burger in close-up get the same line (R4, measured 0.36 to 0.50 percent of the short side on 11 frames).
The one exception is an extreme close-up where a face is bigger than the frame: 11 px (`lib.LINE_XCU`, measured 0.99 percent). Every cast and prop function takes `o.line`.
Inner lines (brows, mouths, folds, creases) are open strokes that taper to points and may stop short of the contour (R3, R5).
No line on a character is thinner than 2.5 px except the tips of tapered strokes (R30). Eye contours, spokes, chains and creases sit between 2.5 px and the contour width.
Nothing boils (R6): a line holds perfectly still until the drawing changes. `lib.inkPath` and every lib helper are boil-free by default in this film; never pass `boil: true`.

### 3.2 Street plate line (Rusakov)

Even and smooth with slight pressure: half the measured widths fall between 3.5 and 5.5 px, the thickest at about 7.5 px (R5). This is what `lib.cel` and `lib.stroke` draw by default.

### 3.3 Machine plate line (Savchenko)

A brush line: from 2.7 px in the thin places to 10 px in the presses, and features (brows, nose, mouth) broken into 2 to 3 dabs with 2 to 6 px gaps (R5). `lib.cel` and `lib.stroke` draw it with `brush: true`.
The cast and the props switch to it by themselves on a `schematic` shot (they read the active shot's mode); pass `o.plate: 'street' | 'machine'` to force one.

### 3.4 Background lines

No black line ever appears in the background (R2, R30).

| Plate | Line | Helper | Width | Colour |
|---|---|---|---|---|
| Street | coloured pencil edge of an object | `lib.pencil(ctx, pts, { base })` | 1.5 to 3 px (default 2.2) | the object's own colour, darker (`base` darkens it by about a third; measured brightness 85 to 200) |
| Machine | torn dark line, in pieces with gaps | `lib.ragged(ctx, pts, { base })` | 3 to 6 px (default 4) | a dark tone of the object, brightness 70 to 110, never black |

Outlines are smoothed through their points. A straight-edged shape needs dense points: build it with `lib.rectPts`, `lib.rrectPts` or `lib.densify(pts, step)`, or a four-point rectangle comes out as an oval.

## 4. Fills, texture and light

### 4.1 Characters: flat

One flat colour per area, no gradient, no hatching, no light and shade (R7; measured spread 0.5 to 1.7 levels inside a fill).
Allowed on a character, and nothing else (R8): a round blush spot without contour, a white glint in a pupil or on a nose, a flat fabric pattern, one or two fold lines.
`lib.hatch`, `lib.crossHatch`, `lib.stipple`, `lib.glowDot`, `lib.paper`, `lib.blueprint`, `lib.stripes`, `lib.hexLattice`, `lib.ticks`, `lib.bracket`, `lib.guideCircle` and `lib.arcAnnotation` belong to the skill's house style. **Never call them in this film.**

### 4.2 Street plate background (R10)

- White paper, a lot of it: fill the frame with `pal.paper`, flat. The sky is usually just paper.
- Objects are washes with a soft edge and visible brush marks: `lib.softWash(ctx, pts, { color })`. Buildings, signs and anything that must hide what is behind it take `solid: true` (a hard edge, still with brush marks).
- Their edges are coloured pencil: `lib.pencil(ctx, pts, { closed: true, base: color })`.
- A gradient only for water (waterTop to waterDeep, top to bottom) and a pale band at the horizon.
- Density: about 9 percent of the frame on visible edges (R13). Leave air.

### 4.3 Machine plate background (R11)

- A mid-tone ground under dense short strokes: `lib.dense(ctx, clip, { base, dir })`.
- Dark strokes cover 11 to 22 percent of the area (warm walls up to 37), light strokes 1 to 23 percent; strokes 9 to 15 px long (defaults: cover [0.18, 0.07], len 12, width 3). Measured on the cast sheet: warm wall spread 22 to 23 levels (reference 19.6), floor 18.8 (reference 35.1).
- Strokes follow the surface: walls `dir: 'vertical'`, floors `dir: 'perspective'` with `vp` the vanishing point, skies `dir: 'swirl'` with `vp` the centre.
- Objects in the background are flat fills with a `lib.ragged` edge. No flat, clean areas (R11).
- Density: about 20 percent of the frame on visible edges (R13).

### 4.4 Draw a still background once

A background never changes inside a shot, so build it once and reuse it: `lib.dense` caches its own texture, and `lib.plate(ctx, key, (g) => { ... }, { w, h, x, y })` caches anything else. The key must change whenever the drawing changes. For a pan, draw the cached plate wider than the frame and move `x`.

### 4.5 No grain, no glow

There is no global grain or noise (R30): `src/core.js` turns its post-processing off for this film (a shot may opt in with `post: true`, and then the grain is still, never re-seeded).
A halo exists only around a visible light source: a candle flame, a lit lamp (R14). Phone and keypad screens are flat `screen`, never glowing.

## 5. The two plates

The timeline's `mode` picks the plate. There is no blueprint plate in this film (R1).

| | Street plate | Machine plate |
|---|---|---|
| Timeline mode | `illustrated` | `schematic` |
| Reference | "Nu, pogodi!", art director Rusakov | "Malysh i Karlson", Savchenko and Butyrin |
| Background | white paper, soft washes, coloured pencil (4.2) | mid-tone ground under dense strokes, torn dark lines (4.3) |
| Character line | even, smooth (3.2) | brush, broken features (3.3) |
| Lettering | rounded capitals on a pale blot (9.1) | white handwriting straight on the ground (9.2) |
| Where | the street, the ride, the booth from outside, the periscope view, title and sources | inside the booth, the machine's room, the owner's close-ups |

Recipes:

```js
// street plate
ctx.fillStyle = P.paper; ctx.fillRect(0, 0, 1080, 1920);
L.softWash(ctx, hillPts, { color: P.hillsFar, soft: 10 });
L.softWash(ctx, wallPts, { color: P.wallYellow, solid: true });
L.pencil(ctx, wallPts, { closed: true, base: P.wallYellow });

// machine plate
L.dense(ctx, null, { bounds: [0, 0, 1080, 1480], base: P.nightSky, dir: 'vertical', seed: 1 });
L.dense(ctx, null, { bounds: [0, 1480, 1080, 440], base: P.pavement, dir: 'perspective', vp: [540, 900], cover: [0.14, 0.04], seed: 2 });
L.ragged(ctx, [[0, 1480], [1080, 1478]], { base: P.nightSky });
```

The character's contour is what separates it from either plate; never add a halo or an outline in another colour around a character to make it read (R30). If a character is lost on the machine plate, lower the ground's `cover` near it or move it, never brighten it.

## 6. Drawn effects (instead of overlays)

Overlays (rings, trajectory lines, rulers, brackets, grids, glows) do not exist in this manner (R1, R22, R30). Fast motion and impacts are drawn, on ones (R20, R22):

| Effect | Helper | Rule |
|---|---|---|
| Smear: a swirl of dry-brush strokes in the character's own colours along its path, faint at the tail | `lib.smear(ctx, pts, { colors, width })` | 2 to 4 frames, on a snatch, a spin, a dash |
| Speed lines: short grey strokes behind the body, along the motion | `lib.speedLines(ctx, x, y, angle, { n, spread })` | while the body moves fast; 3 to 5 lines |
| Impact star: a black star with long sharp rays and a red heart | `lib.impactStar(ctx, x, y, r, { seed })` | 1 to 2 frames at the hit |
| Dust: grey dry-brush puffs behind | `lib.dust(ctx, x, y, { r, p })` | p is its age 0..1; it grows and fades over 4 to 8 frames |
| Sigh puff: a grey dry-brush wave from the mouth | `lib.puff(ctx, x, y, { p, dir, drift })` | drifts about 60 px over 12 frames |
| Smoke: a thin wavy grey line | built into the machine's `think` pose | |
| Shake strokes around a ringing telephone | `props.phone({ ring, t })`, `props.mobile({ ring, t })` | on ones while it rings |
| Imagined things: white lines, no fill, next to the normal coloured character | `lib.stroke(ctx, pts, { color: P.white })` | R29 |

## 7. Motion and editing

### 7.1 Tempo

- Ordinary motion is on twos: a new drawing every 2 frames, 12 a second (R20). The cast functions quantise their cycles themselves when given `o.t`; a scene that moves a character across the frame quantises the position with `lib.onTwos(t)`.
- Fast action is on ones: a dash, a snatch, a spin, a fall, a hit (R20). Pass `o.ones: true` (the dash is always on ones).
- Never on threes. Holds are absolutely still (R6, R21): 22 percent of the reference's time is holds of 4 frames or more.

### 7.2 Holds and snaps

Poses hold still and the moves between them are sharp (R21).
Before a dash the body squashes (`crouch`, the first drawing of `spin` and `turn`), in the dash it stretches (`dash`); in falls and jumps limbs stretch further than the body allows.
A move is three to five strong poses with two to four in-betweens on twos. A pop is 3 drawings on twos with an 8 percent overshoot.

### 7.3 Camera

The camera stands still. Moves are 3 to 4 percent of the reference's running time (R23): a horizontal follow or a vertical move along a facade, 350 to 1150 px per second.
The one accent is the snap push-in to the eyes over 0.8 s, a new drawing on every frame (R23).
**Do not zoom a character with `lib.camera` past 1.5:** the camera scales the contour too. For a push-in, draw the character larger each frame with `o.h` and keep the line at `lib.LINE`, rising to `lib.LINE_XCU` only when the face outgrows the frame: `line: L.lerp(L.LINE, L.LINE_XCU, L.clamp((zoom - 1) / 5))`. Backgrounds may ride the camera.

### 7.4 Cuts and transitions

- Hard cuts (R24). No dissolves: never `transitionIn: { kind: 'fade' }`.
- A large part ends with a dip to black and opens from it (R25): out and in over 0.6 to 0.9 s each with about 0.5 s of black (street manner), or 1 to 2 s each (machine manner). Draw it inside the scenes with `lib.dipBlack(ctx, k)`, or come up from black with core's `flash` in ink.
- An explosion or a shock gives a flash to white for about 0.8 s and comes out of white in about 0.6 s (R25): `lib.dipWhite(ctx, k)`, or core's `flash` with `color: P.paper`.
- **Gate trap:** `tools/check.cjs` fails a checked frame (the first, middle and last of every shot) that is one flat colour. A dip must not be fully black on those frames: peak it at `k = 0.92` there; it still reads as black.

### 7.5 Determinism

Seed every random choice from `lib.hash(shotId, ...)` through `lib.rng`; draw from `t` alone; clamp `t` past the end of the shot. The cast and props are pure functions of their arguments.

## 8. Match cuts

A match cut keeps a shape on the same pixels across a cut. The shared geometry tables live in `docs/storyboard.md`; scenes copy those numbers exactly and take the exact points of characters and props from the anchors their functions return. Shapes that survive a cut are drawn screen-fixed, never through `lib.camera`.
`props.booth` at `w: 580` from (690, 1480) draws the storyboard's G1 booth on its pixels, and `cast.machine` at `h: 660` from (540, 1480) draws G3 on its pixels (cast sheet pages 4 and 6).

## 9. Lettering

Every word on screen is lettered by hand; no printed font appears in a frame (R26 to R28). `lib.letters(ctx, str, x, y, o)` draws a line in a system face with every letter turned up to 5 degrees, lifted up to 8 percent and sized up to 6 percent, seeded per letter (no font files). `lib.text` (a thin printed sans) is for tool diagnostics only.

Two faces, both checked on this machine's Chromium, both deterministic in the gate:

| Face | `face:` | System font | For |
|---|---|---|---|
| Rounded capitals | `'round'` | Arial Rounded MT Bold | titles and signs on the street plate (9.1) |
| Handwriting | `'note'` | Chalkboard SE Bold | prices, tickets, screens, captions on the machine plate, labels in the world (9.2, 9.3) |

Cap height, measured on this machine: 0.74 of the size for `round` and 0.71 for `note` (digits 0.735 and 0.72), so a cap height of 90 px is `size: 122` in `round`. Letter widths vary; fit a line into its box with the box `lib.letters` returns (`measure: true` draws nothing and returns the box), and shrink the size until it fits.

### 9.1 Street plate titles (R26)

- White paper; under the text a pale blot with a soft edge: `lib.spot(ctx, cx, cy, rx, ry, { color: P.titleSpot })` (or titleSpotPink).
- Capitals, bold, rounded, the line jumping: `face: 'round'`.
- Role line: ink, cap height about 55 px. Name or key word: colour, about 85 px; each word its own colour, the first letter another (`titleBlue` with `firstColor: P.titleYellow`).
- Big words get a dark contour: `outline: P.ink` (outline width defaults to 7 percent of the size).
- The closing word: plump blue letters with a dark contour, cap height about 225 px.

### 9.2 Machine plate lettering (R27)

- White handwriting straight on the ground, no blot: `face: 'note', color: P.white`.
- Letter sizes uneven, the line jumping (the default jitter does it).
- A title about 170 px cap height, roles and captions 46 to 65 px.

### 9.3 Words inside the world (R28)

The BURGERS sign, the price tags, the ticket, the gauge labels, the keypad and register screens, the wall map labels are part of the drawing, lettered by the props themselves. Prices are always the real numbers (10.14).

### 9.4 Sources card and closing word

The sources card is street-plate lettering: ink `note` lines on a `titleSpot` blot, the closing word in `round` per 9.1. Copy the words from the storyboard's G8 table exactly.

## 10. Subject reference

Sources checked on 2026-10-01: `.tmp/research/notes.md` and the files it captured there: `cnbc-article.txt` (CNBC, 2026-09-29, Reuters reporting), `engadget.txt` (Engadget, 2026-09-29/30), `restaurantbusiness.txt` (Restaurant Business, 2026-10-01), `usnews-reuters.txt`, `technology-org.txt`, `reddit-thread.txt`.

Sizes below are fractions of the frame height H (1920 px). Every function and its options are listed in the comment block at the head of the cast section in `src/lib.js`; the essentials are here.

### 10.1 The hero (`lib.cast.hero`)

A boy of about ten on a green bicycle: our own character, no relation to any existing one.

- **Proportion:** about three heads tall (R16): head with cap, torso, legs in roughly equal thirds. Big round head with full cheeks; pear-sack torso; thin stick arms and legs; big hands (four fingers: three and the thumb, R19) and big shoes.
- **Colours:** cap `cap` with a visor toward where he faces; `hairYellow` hair showing under the cap at the nape and above the ear; skin `skinKid`, blush `blushKid`; shirt `red` with short sleeves; shorts `slate`; white socks; shoes `shoe`.
- **Face:** type 1 eyes (R17): white oval, thin contour, `iris` iris, black pupil, a white glint, three lash strokes. Nose a small round "potato" that pokes past the outline in three-quarter view. Closed mouth one arc with short serifs at its ends; open mouth a `mouth` cavity with a lighter tongue and one white tooth (R18).
- **Size:** `o.h` is his standing height and every pose keeps it. Wide (the booth, G1): 429 px (0.22 H), wheel radius 80. Medium: 0.25 to 0.40 H. Close-up from the chest (G5): head height 400 px means `h` about 1290 with the body cropped.
- **Anchor:** (x, y) is the ground under him; on the bicycle, the ground under the bottom bracket, halfway between the wheels.
- **View:** three-quarter facing `o.facing` (1 right, -1 left); `o.view: 'front'` for the window shots; `o.turn` 0..1 turns just the head.

| Pose | Use | Notes |
|---|---|---|
| `ride` | pedalling | `o.phase` 0..1 per crank turn, or `o.t` with `o.cadence` (turns a second, default 1.1); `o.cycle: 4` snaps the crank to a 4-drawing cycle |
| `crouch` | anticipation before the dash | squashed over the bars, `determined` face |
| `dash` | sprinting on the pedals | stretched forward, always on ones, cadence 2.6 |
| `straddle` | stopped, one foot down | near foot on the ground, hands on the grips, grin |
| `skid` | the stop | bicycle tipped back 4 degrees about the rear tyre, rider leaning back, foot planted ahead |
| `coins` | holding up coins | straddling, a fist of two coins raised |
| `slap` | slapping the coins down | straddling, flat hand down on `o.target` [x, y] px |
| `snatch` | grabbing the burger | near arm shoots to `o.target`; draw on ones with a smear |
| `sill` | at a window | front view, both hands on a ledge at `o.target[1]` |
| `bite` | eating | `o.k`: 0 to 1/3 mouth open, burger raised; 1/3 to 2/3 chomp; 2/3 to 1 chewing, one more bite gone; `o.bites` taken before |
| `pop` | the shock | eyes popped, cap jumps off the hair, hands up; `o.stalk` 0..1.15 shoots the eyes out on stalks toward `o.stalkDir` (default up and forward), 1.6 times bigger at full stalk |
| `turn` | turning round on foot | `o.k`: squash, front view, the other side (he ends facing `-facing`) |
| `spin` | turning the bicycle round | `o.k`: crouch, bicycle head-on, the other side ready to dash |
| `stand` | standing | arms down |

Faces (`o.face`, each pose has its own default): `smile`, `neutral`, `grin`, `open`, `O`, `chew`, `bliss` (eyes shut as arcs, deeper blush), `gulp` (pressed mouth, full cheeks, throat bulge), `lick` (tongue at the corner), `jaw` (the jaw drops, the mouth hangs open), `glare`, `determined`, `sniff` (lids half down, sniff strokes at the nose), `pant` (opens and closes on twos with `o.t`), `pop`, `sad`.
Also: `o.blink`, `o.look` [-1..1, -1..1] for the pupils, `o.tilt` (head nod in radians, positive forward), `o.rot` (the whole figure, for a sway), `o.rig` (joint targets in his design units, for a pose this list lacks), `o.hold(ctx, anchors)` (draws what his hands hold between the body and the near hand; the `bite` and `coins` poses draw the burger and coins themselves).
Anchors returned: `head`, `headR`, `eye`, `eyeFar`, `mouth`, `hand`, `handFar`, `hold`, `chest`, `neck`, `top`, `ground`, and on the bicycle `seat`, `grip`, `pedal`, `axleFront`, `axleRear`, `wheelR`.

`o.rig` works in his design units: standing height 300, origin at his ground point, y up negative, x toward where he faces. Joints: `hip`, `neck`, `head` (centre), `shN`/`shF` (shoulders, near and far), `handN`/`handF` (hand targets; the elbows bend toward `elbowN`/`elbowF`, direction vectors), `hipN`/`hipF`, `ankleN`/`ankleF` (knees bend toward `kneeN`/`kneeF`), `footN`/`footF` (shoe angles), `kindN`/`kindF` (`'fist'`, `'open'`, `'point'`), and `tilt`, `turn`, `face`, `look`, `hold`. Example, pointing up: `rig: { handN: [40, -260], kindN: 'point' }`.

### 10.2 The owner (`lib.cast.owner`)

The tired adult who runs a booth and types the price in himself. Our own character.

- **Proportion:** tall and thin, about ten face heights (R16), stick legs, long arms, big hands and shoes, shoulders rounded forward, head forward.
- **Colours:** white paper cap (`white`); `hairGrey` hair at the sides, bushy brows and moustache; skin `skin`, blush `blush`; shirt `pink` with sleeves rolled to the elbow; white apron from the chest to mid-thigh with a pocket, neck strap and a bow at the back; trousers `slate`; shoes `shoe`.
- **Face:** type 2 eyes (R17): short black dashes under heavy drooping lids with bags below; black dots when surprised; shut lines for a blink or a yawn. A big potato nose that pokes past the outline; the mouth under the moustache.
- **Size:** `o.h` standing height. In the booth window (G1): head height 130 px, which `props.booth` returns as `ownerH` (722) with the ground point `owner`. From behind at the counter (G2): head height 210, `h` about 1167. Close (14): head height 300, `h` about 1670, cropped.
- **Anchor:** the ground between his feet. **In the booth** draw `layer: 'back'` clipped to `booth.window`, then the booth's front layer, then `layer: 'front'` (his reaching arm and what it holds).
- **View:** three-quarter facing `o.facing`; `o.view: 'back'` is three-quarter from behind (grey hair, an ear, the moustache tip past the cheek, apron straps crossing the back).

| Pose | Use | Notes |
|---|---|---|
| `stand` | the tired slump | arms hanging |
| `lean` | bored, chin on his hand | elbow at `o.target` (e.g. on `booth.shelf`), fist under the chin |
| `serve` | holding a burger out | the burger in his hand at counter height |
| `push` | pushing a burger along the counter | flat hand at `o.target` |
| `rake` | raking coins in | `o.k` 0..1 sweeps the hand back along the counter |
| `tap` | tapping coins | one finger; down while `o.k < 0.5` (or on twos with `o.t`) |
| `point` | pointing straight up | index finger up, looking up |
| `catch` | catching the ticket | `o.k < 0.5` open hand up, then the fist closed on it (`hold` anchor) |
| `read` | reading the ticket | the ticket (`o.lines`) at his chest, head down |
| `phone` | on the telephone | the handset in his hand at the ear, talking on twos with `o.t` |
| `listen` | the handset pinned between ear and shoulder | head tipped onto it, both hands free at the counter |
| `sigh` | the sigh | `o.k` 0..1: shoulders drop 16 units, lids half down; send `lib.puff` from `anchors.mouth` |
| `type` | typing the price | both hands tap on twos with `o.t` at counter height (`keys` anchor) |
| `holdup` | holding the tag up | a fist raised forward at face height; hang the tag from `hold` with `strings: 'dangle'` |
| `shrug` | what can I do | palms up |

Faces: `tired` (default), `bored`, `surprised`, `talk`, `read`, `sigh`, `yawn`; `o.blink`, `o.tilt`, `o.rig`, `o.hold` as for the hero.
Anchors: `head`, `headR`, `mouth`, `ear`, `eye`, `hand`, `handFar`, `hold`, `keys`, `chest`, `top`, `ground`.
His design units for `o.rig`: standing height 400, same conventions and joint names as the hero (one `knee` direction for both legs), plus `elbowAt` (a fixed elbow point for the near arm). His hands rest on a counter at y -214.

### 10.3 The pricing machine (`lib.cast.machine`)

The company's pricing engine as a creature: a box on two thin legs that eats the purchase stream, looks at the street through a periscope and gives out a recommendation. It moves, so it is a cel (R2).

- **Design (front view, storyboard G3 at `h: 660` from (540, 1480)):** box 680 x 480 in `machine`, corner radius 40, four rivets. A white name band on top with SENSITIVITY TO PRICE (the franchisee screen's wording). The gauge on its front (10.8) and under it a white strip, "based on willingness to pay in your area". A slot 400 x 30 with a `machineDark` lip. Two `machineDark` legs 26 wide; `shoe` shoes 150 x 50, toes turned out. A `machineDark` hopper funnel on the top (mouth 440 wide, ink inside). A periscope tube on the right; its head is an elbow box, and its lens is the eye: a white ball of radius 30 with a black pupil of radius 12 on the head's left face.
- **Size:** `o.h` is the ground to the top of the box; the periscope rises 480 above it when up. G3: 660 (0.34 H).
- **Anchor:** the ground between its shoes.

| Pose | Notes |
|---|---|
| `idle` | still |
| `gulp` | `o.k`: the hopper neck squeezes, swells, settles; the box squashes 4 percent on the first drawing |
| `print` | `o.k` 0..1 pushes the ticket out, bottom first (RECOMMENDED: shows last); the box shudders on ones while 0 < k < 1 |
| `think` | rattles on ones, eye half-lidded, thin smoke from the hopper |
| `crouch`, `hop` | squash and stretch, for an entrance |

Options: `o.scope` 0 (periscope down) to 1 (up), `o.look` (the pupil), `o.blink`, `o.level` 0..1 (needle from LOW to HIGH), `o.name`, `o.source`, `o.lines` (ticket, default `['RECOMMENDED:', '$6.89']`).
Anchors: `slot`, `ticketTip`, `hopper` (the mouth, where the stream ends), `hopperNeck`, `eye`, `dial` {x, y, r}, `needleTip`, `top`, `ground`, `body` {x0, y0, x1, y1}.

The machine **recommends**; it never types, charges, takes money from a customer or sets the price on the tag (10.15).

### 10.4 The burger (`lib.props.burger`)

A generic burger, no logo and no brand (the storyboard's rule): bottom bun, patty with a bumpy edge, cheese slice with two drips, wavy lettuce, domed top bun with seven sesame seeds.
`o.w` is its width; in the hero's hands 72 of his units (0.24 of his height); in the close-up G5, 320 px. `o.bites` 0 to 3 cuts round bites from the right edge, each with its own contour. Anchors `top`, `bottom`, `bite` (where the next bite goes), `center`.

### 10.5 The booth and the price tag (`lib.props.booth`, `lib.props.priceTag`)

The booth is still, so it is background: washes with pencil edges, no black (R2). Design units are the storyboard's G1 pixels: `w: 580` from (690, 1480) draws G1 exactly.
Parts: a `paper` sign board with BURGERS in `red` rounded capitals (cap height 90); two `fence` sign posts; the price tag hanging below the board; a striped awning (stripes 60 px in `flower` and `paper`, eight scallops); a `wallYellow` front with the window (dark `shadowWarm` inside), a `fence` counter shelf, and a lower panel with planks every 40 px.
`o.price` sets the tag, `o.swing` rocks it about its string tops (plus or minus 2 degrees on twos at rest, up to 8 in a gust), `o.layer` splits back and front around the owner.
Anchors: `window`, `shelf` {x0, x1, y}, `counterY`, `tagTop`, `sign`, `owner` and `ownerH` (where to stand the owner so his head lands at G1's (710, 1105)).

The price tag moves, so it is a cel: a `tag` card with rounded corners, two punched holes and strings, the price in ink `note` lettering. `(x, y)` is the card's top centre; `o.w`, `o.h` (G1: 280 x 150; G4: 440 x 280), `o.drop` (string length, default 0.2 h), `o.strings` `'up'` (hanging), `'dangle'` (held in a hand) or `'none'`, `o.size` (glyph height, default 0.62 h), `o.swing`.

### 10.6 The bicycle (`lib.props.bike`)

A child's bicycle in `green`: wheel radius 0.187 of the hero's height (G1: 80 px), black tyres, eight spokes that turn with the pedals, white bars and cranks, a white chainring with the chain on the near side, a `shoe` saddle. The hero's riding poses draw it themselves; `props.bike` draws it alone (parked) with `o.h` the hero's height for scale, `o.phase`, `o.wheel` and `o.layer` 'far' | 'mid' | 'near'.

### 10.7 The two districts (`lib.props.house`)

Both are background (washes and pencil).
- **Modest** (`kind: 'modest'`): a one-storey `wallYellow` cottage with a `roof` roof, a stone chimney, one small window with `flower` curtains, a `fence` door, and a picket fence in `fence` with `trunk` pencil grain.
- **Rich** (`kind: 'rich'`): a two-storey `cityPastel` house under a `hillsFar` roof, eight windows, a portico of four white columns under a pediment, stone steps, an iron gate between stone pillars with ball tops, and a stone fountain with `waterTop` water and `waterDeep` jets.
`o.h` is the house height; the rich house with gate and fountain spans about 2.4 h. The storyboard's G1 and G2 streets may be painted directly with `lib.softWash` and `lib.pencil` when its rectangles need exact pixels.

### 10.8 The gauge (`lib.props.gauge`, and the machine's face)

A cream `dial` half-disc with ticks every 10 degrees from 200 to 340 degrees (canvas angles, 270 straight up); an ink needle tapering from 8 to 3 px, 0.84 of the radius long, on a `red` pivot cap. LOW sits left of the dial on a `grass` patch, MEDIUM above it on a `titleYellow` patch, HIGH right of it on a `red` patch with white letters (ink on red does not read). `o.level` 0..1 maps LOW to HIGH. The standalone gauge adds a title above, WILLINGNESS TO PAY by default (`o.title` a string or false).
What it measures (CNBC/Reuters): an estimate of how much each store's patrons are willing to pay, shown to the franchisee as "Your restaurant is showing medium sensitivity to price". It is per restaurant, never per customer.

### 10.9 The ticket (`lib.props.ticket`)

The machine's recommendation, a cel: a `ticket` slip, perforated top, torn zigzag bottom, a small header line and the big price, default `['RECOMMENDED:', '$6.89']`. `(x, y)` its top centre, `o.w`, `o.h`, `o.lines`, `o.rot`. The machine draws its own G3 strip (300 wide, RECOMMENDED: cap 30, $6.89 cap 90).

### 10.10 Telephone, handset, register, keypad

All cels with `slate` bodies, white keys and flat `screen` screens.
- `props.phone`: a desk telephone with white keys and its handset on the cradle (`o.lifted` takes it off); `o.ring` with `o.t` shakes it on ones and draws shake strokes. Anchors `cradle`, `cordStart`.
- `props.handset`: the handset alone, `o.w`, `o.rot`; anchors `ear`, `mouth`, `cord`. `props.cord(ctx, a, b)` draws the curly cord between two points.
- `props.mobile`: a smartphone with lines of text on its screen (the franchisee portal message), for a scene that needs one.
- `props.register`: a till with keys, a display on a stalk (`o.text`) and a drawer that slides out 40 px with `o.drawer` 0..1.
- `props.keypad`: 3 by 4 keys of 92 px with 12 px gaps at `w: 300` (storyboard 14), a screen strip with the price typed so far (`o.text`), `o.press` sinks one key 6 px; anchor `key(i)` gives each key's centre for the finger.

### 10.11 The wall map (`lib.props.map`)

A `ticket` sheet with a pale land (`style: 'land'`) or a town of streets and a river (`style: 'city'`), restaurants as dots with an ink contour. `o.n` dots (G3: 140 of radius 7), `o.mono` all `red`, `o.booths` tiny white booths with red roofs, `o.pinned` two push pins, `o.p` reveals the dots in order with a 3-drawing pop, `o.pins` [{ u, v, label }] for the two stores with price labels. Returns the dots, so the purchase stream can start at them.
Fact: the engine reads data from millions of daily transactions across nearly 14,000 restaurants (CNBC/Reuters).

### 10.12 The purchase stream (`lib.props.flow`)

Receipts (`ticket` slips with three ink lines and a green $) and coins (`coin` discs with an inner ring and $, turning edge-on as they spin) flowing along a path from the map's dots to the hopper's mouth: `props.flow(ctx, pts, { t, n, rate, size, kind, spread })`. On twos unless `o.ones`. It goes only into the hopper; only the ticket comes out of the slot.

### 10.13 Titles and the sources card

Built from `lib.letters` and `lib.spot` per section 9, with the words of the storyboard's G8 table. The sources card names Reuters (Sept 29, 2026), CNBC, Engadget and Restaurant Business, and says that Reuters could not confirm the Fresno gap came from the engine.

### 10.14 The facts on screen

| What | Exactly | Source |
|---|---|---|
| Price at the first restaurant | $5.69 | CNBC/Reuters: a company-run store in Fresno, California, Big Mac |
| Price two miles away | $6.89 | the same report: another company-run restaurant two miles away |
| The gap | +21% | the same report |
| Attribution line | Reuters, Sept 29, 2026 | CNBC carried the Reuters report on 2026-09-29 |
| The company's answer | "a tool, not a mandate" (McDonald's) | Restaurant Business, Engadget |
| Former owner | "You don't really have much of a choice anymore" (Karen King, a former owner) | CNBC/Reuters, Engadget |
| Scale | nearly 14,000 restaurants; millions of daily transactions | CNBC/Reuters |

### 10.15 Mistakes to avoid

| Mistake | Draw instead |
|---|---|
| The machine sets the price, prints it onto the tag or types it in | The machine **recommends**: its ticket says RECOMMENDED; the owner reads it and types the price into the keypad with his own finger (`owner` `type` over `props.keypad`). McDonald's: "AI does not set the price"; franchisees set prices and must input them. |
| Two customers in one queue pay different prices | The gap is between **two restaurants two miles apart**: two booths in two districts, the same burger, the hero riding between them. Never two prices at one counter. |
| The price changes hour by hour or per customer | One price per restaurant; the gauge and the map are per store. No clocks, no surge arrows, no per-face pricing. |
| Rounded or invented numbers ($5.99, $7, 20 percent) | Exactly $5.69, $6.89 and +21%, lettered in their G4 slots. |
| A price on screen with no source | "Reuters, Sept 29, 2026" on screen with the numbers, and the sources card at the end. |
| The film says the engine caused the Fresno gap | Reuters could not confirm the gap comes from the engine: the sources card says so, and no caption claims it. |
| The two Fresno stores shown as the owner's franchises | The Fresno pair are company-run stores. The owner is the film's franchisee, showing who types prices in; don't label his booths "Fresno". |
| Golden arches, a red-and-yellow logo, a clown | Generic: BURGERS on the sign, a generic burger. McDonald's appears only as the named speaker of a quote. |
| Grain, boiling lines, glows, blueprint grids, rings, rulers, brackets | None of these exist here (R1, R6, R30). Effects are drawn (section 6). |
| A black line around a house, a grey or coloured contour around a character | Background edges are coloured pencil or torn dark lines; character contours are ink, always closed (R2, R3). |
| Shading, a gradient or a highlight band on a character | Flat fills; blush spots and glints only (R7, R8). |
| A printed font in the frame (`lib.text`) | `lib.letters` in `round` or `note` (section 9). |
| A character redrawn inside a scene file, or a pose faked by distorting a cast drawing | `lib.cast.*` only; for a missing pose, `o.rig` joint targets, or ask for a new named pose. |
| A push-in by zooming the camera on a character | Redraw the character larger with `o.h`, the line at `LINE` rising to `LINE_XCU` (7.3). |
| A crossfade between shots | Hard cuts; dips to black and flashes to white only (7.4). |
| A fully black first, middle or last frame of a shot | Peak a dip at 0.92 on the checked frames (7.4). |
| The owner floating over the counter, legs showing below the booth | Draw his back layer clipped to `booth.window`, then the booth's front, then his front layer (10.5). |
| A rectangle passed as four points to a smoothed helper | `lib.rectPts`, `lib.rrectPts` or `lib.densify` (3.4). |

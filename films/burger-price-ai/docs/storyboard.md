# Storyboard: One burger, two prices

The plan every agent works from. Times are global seconds `T` unless a line says otherwise.

## Logline

A boy on a bicycle buys a burger for $5.69, rides two miles into a richer neighbourhood and finds the same burger at $6.89; behind the gap, a pricing engine recommends an "optimal price" for each restaurant from what people nearby will pay, and a tired owner types that price in himself.
Drawn in the manner of 1960s–70s Soviet hand-drawn cartoons: a light street plate for the story, a dense textured plate for the machine and the owner, hard cuts on a 120 bpm grid in a vertical 9:16 frame, scored by a synthesised puppet-jazz band.

## Numbers

- BPM 120: a beat is 0.5 s = 12 frames, an 8th 0.25 s = 6 frames, a 16th 0.125 s = 3 frames; a bar is 2.0 s = 48 frames.
- Duration 32.0 s = 16 bars of 4/4 = 768 frames at 24 fps.
- Frame 1080 x 1920, vertical. Safe area for every must-read element: x 60 to 940, y 220 to 1540.
- Shots: 18, each 1.0 to 3.0 s, every boundary on the 0.5 s grid.
- Hinge: the $6.89 tag lands on the bar 9 downbeat, T 16.0 = frame 384, the exact midpoint.
- Arithmetic, checked twice. First half: 2.0 + 1.5 + 2.5 + 2.0 + 2.0 + 1.5 + 1.5 + 3.0 = 16.0 s, frames 48 + 36 + 60 + 48 + 48 + 36 + 36 + 72 = 384. Second half: 2.0 + 2.0 + 1.0 + 1.5 + 1.5 + 2.0 + 1.0 + 1.0 + 2.0 + 2.0 = 16.0 s, frames 48 + 48 + 24 + 36 + 36 + 48 + 24 + 24 + 48 + 48 = 384. Total 768 frames, boundaries 0, 2, 3.5, 6, 8, 10, 11.5, 13, 16, 18, 20, 21, 22.5, 24, 26, 27, 28, 30, 32 with no gap and no overlap.

## Summary

| Order | Id | Start | End | Mode | Title |
|---|---|---|---|---|---|
| 01 | booth-569 | 0.0 | 2.0 | illustrated | Cold open: the $5.69 booth |
| 02 | owner-serves | 2.0 | 3.5 | schematic | Inside booth one: the owner serves |
| 03 | first-bite | 3.5 | 6.0 | illustrated | The first bite |
| 04 | title-card | 6.0 | 8.0 | illustrated | Title: one burger, two prices |
| 05 | ride-fence | 8.0 | 10.0 | illustrated | Mile 0: picket fences |
| 06 | ride-fountain | 10.0 | 11.5 | illustrated | Mile 1: a fountain |
| 07 | ride-columns | 11.5 | 13.0 | illustrated | Mile 2: columns |
| 08 | booth-again | 13.0 | 16.0 | schematic | Inside booth two: the same burger |
| 09 | price-689 | 16.0 | 18.0 | illustrated | $6.89 |
| 10 | machine-feed | 18.0 | 20.0 | schematic | The pricing machine eats |
| 11 | periscope-view | 20.0 | 21.0 | illustrated | The periscope looks at the street |
| 12 | machine-ticket | 21.0 | 22.5 | schematic | The gauge and the ticket |
| 13 | owner-ticket | 22.5 | 24.0 | schematic | The owner gets the ticket |
| 14 | owner-types | 24.0 | 26.0 | schematic | A sigh, then he types the price |
| 15 | turn-back | 26.0 | 27.0 | illustrated | Crouch, spin, dash |
| 16 | ride-back | 27.0 | 28.0 | illustrated | Two miles back |
| 17 | bite-again | 28.0 | 30.0 | illustrated | Same burger, different neighbourhood |
| 18 | sources-card | 30.0 | 32.0 | illustrated | Sources, and the booth again |

Mode names are the pipeline's: `illustrated` is this film's light street plate (the Rusakov manner), `schematic` is this film's dense textured plate (the Savchenko manner). There is no blueprint plate in this film.

## Structure

Act 1, bars 1 to 4 (0 to 8 s), "A burger for $5.69": the booth, the owner serves, the bite, the title.
Act 2, bars 5 to 8 (8 to 16 s), "Two miles": three neighbourhoods, each richer than the last, the mile counter from 0 to 2, the same booth again, and a push-in on the hero's eyes that lands on the midpoint.
Act 3, bars 9 to 13 (16 to 26 s), "Where $6.89 comes from": the tag at $6.89 on the bar 9 downbeat, a dip to black, the pricing machine (it eats, it looks, it recommends), then the owner (the ticket, the phone, the sigh, the keypad).
Act 4, bars 14 to 16 (26 to 32 s), "Back to $5.69": crouch and dash, two miles back, the same bite, the sources over the opening booth.

Plates follow the place, not a fixed alternation: the street is illustrated, the inside of the booth and the machine's room are schematic. The periscope view (11) is the street seen by the machine, so it is illustrated.
That gives the order ill, sch, ill, ill, ill, ill, ill, sch, ill, sch, ill, sch, sch, sch, ill, ill, ill, ill.

Match cuts and rhymes, all on the same pixels (see Shared geometry):

- G1, the booth wide: 01, 15 and 18. 18's last frame hands straight to 01's frame 0, so the film plays as a loop.
- G2, inside the booth: 02, 08 and 13, one camera at three moments; the window says which street we are on.
- G4 and G5, the close-up: 03 ($5.69, bite), 09 ($6.89, eyes pop) and 17 ($5.69, bite again). G4 also holds in 14, where the owner holds the same tag on the same pixels where the hero saw $6.89.
- G3, the machine: 10 and 12.
- G6, the mile counter: 05, 06, 07 and 16.
- G7, the engine caption: 11 cuts to 12 under a caption that does not move.

Camera: locked everywhere except two moves, about 4 percent of the film, which matches the reference (camera moves 3 to 4 percent of the time):

- 08: one snap push-in to the hero's eyes, zoom 1 to 6 over 0.75 s (T 15.25 to 16.0), a new drawing on every frame. This is the manner's one accent push-in.
- 11: the street inside the periscope matte pans 600 px over 0.5 s.

The ride shots keep the camera still and let the hero cross the frame, as the reference does.

Transitions: hard cuts, no dissolves. One dip to black separates the story from the explanation: 09 fades to ink over T 17.625 to 17.875 and holds black to 18.0, then 10 comes up from black through core's `flash` in ink over 0.375 s. The whole dip is 18 frames, 0.75 s.

Time devices: the mile counter (G6) for distance, the receipt stream for "millions of orders a day", the gauge needle for the estimate, and four keystrokes for the human input.

The loop: 18 ends on the opening composition, the empty booth at $5.69. The replay's frame 0 is the same picture with the sources gone and the hero's front wheel entering, and the score's last pickup resolves onto the bicycle bell of bar 1.

Reading time for the must-read words, from the frame each one is readable to the cut:

| Words | Shot | Readable | Seconds |
|---|---|---|---|
| $5.69 | 01, 03 | 0.0 to 2.0, 3.5 to 6.0 | 2.0 and 2.5 |
| ONE BURGER, TWO PRICES | 04 | 6.5 to 8.0 | 1.5 |
| Reuters, Sept 29, 2026 | 04 | 6.75 to 8.0 | 1.25 |
| 0 to 2 mi | 05 to 07 | 8.0 to 13.0 | 5.0 |
| $6.89 and +21% | 09 | 16.0 and 16.375 to 17.625 | 1.6 and 1.25 |
| nearly 14,000 restaurants; millions of orders a day | 10 | 18.375 and 18.625 to 20.0 | 1.6 and 1.4 |
| The engine recommends an "optimal price" for each restaurant. | 11, 12 | 20.375 to 22.5 | 2.1 |
| WILLINGNESS TO PAY, MEDIUM | 12 | 21.0 to 22.5 | 1.5 |
| RECOMMENDED: $6.89 | 12, 13 | 22.25 to 22.5, 23.0 to 24.0 | 1.25 |
| McDonald's: "a tool, not a mandate" | 13 | 22.625 to 24.0 | 1.4 |
| Ex-owner: "You don't really have much of a choice anymore." | 14 | 24.0 to 26.0 | 2.0 |
| Same burger. Different neighbourhood. | 17 | 28.375 and 28.875 to 30.0 | 1.6 and 1.1 |
| Sources, Ideas & Technologies | 18 | 30.0 and 31.0 to 32.0 | 2.0 and 1.0 |

## Conventions

- `T` is global seconds and `t` is shot-local seconds. Every time in a shot entry is global `T`; a scene converts with t = T − start and checks the beat arithmetic twice.
- Positions are frame pixels at camera zoom 1, origin top-left, y down.
- The camera is `lib.camera(ctx, { x, y, zoom }, fn)`: the world point (x, y) lands on the frame centre (540, 960).
- Colour names are keys of `FILM.lib.pal`, as published in `docs/art-bible.md` section 2. Where this file and the art bible disagree on a colour or a drawing rule, the art bible wins; on a position or a time, this file wins.
- The cast (hero, owner, machine) and the props are drawn by `FILM.lib.cast.*` and `FILM.lib.props.*`. This file names poses by meaning ("hero riding", "owner typing"); the function and pose names are the cast agent's. Where a shared-geometry table gives positions inside a cast drawing (the machine's slot, the booth's window), they are the targets the cast functions should hit, and scenes take the exact points from the anchors those functions return.
- The manner, from `docs/reference-analysis.md`: what moves sits on the cel layer with a closed black outline and flat fill; what stays still is background, painted without black lines. No rings, rulers, brackets, grids or glows. Drawn effects only: dry-brush smears, short speed lines, an impact star (black spikes, red centre) for 1 to 2 frames, dust, a sigh puff.
- Motion: characters on twos (`lib.onTwos`); fast actions on ones (each shot names them); poses hold absolutely still between moves; anticipation squash before a dash. Camera moves and draw-ons run at 24 fps.
- Every word on screen is hand-lettered with the art bible's lettering rules, in English, never a printed font. Must-read words sit inside the safe area; table G8 lists every one with its box.
- No real logos or mascots: the booth reads BURGERS, the burger is a generic burger, and McDonald's appears only as the named speaker of a quote in 13.
- Hard cuts are the default. Only 10 declares a transition (`flash` in ink, 0.375 s). The fade-out at the end of 09 is drawn by 09 itself.
- Scenes clamp `t` to their duration, hold the last pose, and draw frame 0 fully.

## Cast and props, by meaning

- **Hero**: a boy of about ten on a green bicycle; hairYellow hair under a cap-coloured cap, red shirt, slate shorts, shoe shoes, skinKid and blushKid, iris eyes. Poses used: riding (a four-drawing pedal cycle), skid, standing over the bike with one foot down, holding up coins, slapping coins, snatching, mouth open with the burger raised, chomp, chewing, bliss (eyes shut as arcs), gulp, sniff and grin, sprinting on the pedals, looking up, eyes popped on stalks, jaw drop, glare, crouch, spin, dash.
- **Owner**: a tired adult in a white apron over a pink shirt, slate trousers, hairGrey fringe and moustache, skin and blush. Poses used: bored with his chin on his hand (booth window), pushing a burger, raking coins, tapping coins, pointing up, catching, reading a ticket, turning to the phone, listening with the phone pinned between ear and shoulder, sighing, typing on a keypad, holding the tag up, holding a burger out, blinking, yawning. Seen three-quarter from behind in 02, 08 and 13, and from the front in 14.
- **Pricing machine**: a box on two thin legs with big shoes, a periscope whose lens is an eye, a front slot, the WILLINGNESS TO PAY gauge on its front. Poses used: idle, gobbling, periscope down and up, eye blink, needle at any angle, printing shudder, ticket out.
- **Props**: burger (whole and bitten), booth with sign, awning, window and hanging price tag ($5.69 or $6.89), bicycle, coins, modest houses with fences, a rich house with columns, fountain, gauge, ticket (RECOMMENDED: $6.89), phone, keypad, wall map of restaurant dots, purchase stream (receipts and coins).

## Shared geometry

Scenes that share a shape copy these numbers exactly, or the cuts jump. A shape listed for several shots is drawn screen-fixed in each of them.

### G1: the burger booth, wide (01, 15, 18)

All three shots draw the booth with the same placement.

- Ground line y = 1480, the top edge of the pavement; the wheels and the booth stand on it. A kerb line at y = 1600 is scenery.
- Booth front: x 400 to 980, y 1000 to 1480. Lower panel y 1272 to 1480 with vertical planks every 40 px.
- Window opening: x 540 to 880, y 1030 to 1250, dark inside. The owner stands in it, head centre (710, 1105), head height 130; on 01's frame 0 and 18's last frame he leans with his chin on his hand.
- Counter shelf: x 520 to 900, y 1250 to 1272.
- Awning: x 380 to 1000, y 930 to 1000, eight scallops on its lower edge, stripes 60 px wide in flower and white.
- Sign posts: at x 450 and x 910, 16 px wide, from y 720 down to the awning at y 930.
- Sign board: x 420 to 940, y 560 to 720, with BURGERS hand-lettered, cap height 90, baseline y 675, centred on x 680 (about x 450 to 910).
- Price tag: two strings from (560, 720) and (800, 720) to the card's top corners. Card x 540 to 820, y 750 to 900, tag fill, ink outline. The price is lettered in ink, glyph height 100, baseline y 865, centred on x 680 (about x 550 to 810): $5.69 in 01 and 18, $6.89 in 15. It rocks about (680, 720): plus or minus 2 degrees on twos in 01 and 18, up to 8 degrees in 15's gust.
- Hero stop mark: rear wheel centre (150, 1400), front wheel centre (430, 1400), wheel radius 80, head centre (290, 1080), facing right. Slapped coins land on the shelf at (560, 1262).
- Sky: paper from y 0 to 560. In 18 the lettering zone is x 80 to 940, y 230 to 540; nothing else must-read sits there in any G1 shot.
- Background, behind everything, painted without ink lines:
  - Modest street (01, 18): a wallYellow house x 0 to 380, y 860 to 1480, roof ridge at y 760 in roof; a picket fence in fence from x 0 to 400, y 1330 to 1480; a tree (trunk, grass) behind the booth's right edge, x 920 to 1080, y 700 to 1000; far hills in hillsFar along y 1150 to 1260; two pale wash clouds.
  - Rich street (15): a portico of four stone columns, x 20 to 380, y 780 to 1480, under a pediment from y 690 to 780 with cityPastel walls; a stone fountain basin x 60 to 340, y 1330 to 1480 with waterTop jets up to y 1200; round clipped bushes in grass; a tall cypress in place of the tree.

### G2: inside the booth (02, 08, 13)

The camera stands inside, behind the counter, looking out through the window. All three shots use the same pixels.

- Window opening: x 240 to 840, y 560 to 1100, with a 30 px frame around it.
- Inside wall around the window: wallWarm with dense short strokes; shadowWarm for the frame and the deepest strokes.
- Counter top: y 1100 to 1170 across the whole width; the counter's inner side runs below it to the bottom edge.
- Owner: left foreground, three-quarter from behind, head centre (180, 650), head height 210, shoulders across x 0 to 400 at y 800, apron strings crossing his back; his right hand works on the counter.
- Hero, outside (02, 08): head centre (560, 820), head height 260, eyes at (525, 790) and (600, 790), hands on the outer sill at y 1100 between x 470 and 650.
- Burger path (02, 08): it slides along the counter from (330, 1080) to (500, 1080).
- Coins on the sill: at (620, 1092).
- Register: on the counter, x 860 to 1060, y 880 to 1100; its drawer shoots out 40 px in 02.
- Phone: on the counter, x 700 to 840, y 990 to 1100.
- Push-in target (08): the eye midpoint (562, 790).
- Caption zone (13): x 80 to 940, y 230 to 520.
- Through the window: in 02 the modest street (the corner of a wallYellow house, its fence, sky); in 08 and 13 the rich street (two stone columns, a fountain's spray, a clipped bush). The price tag hangs outside above the window and is never in this frame.

### G3: the pricing machine (10, 12)

10 and 12 draw the machine with the same placement.

- Body: x 200 to 880, y 820 to 1300, machine fill, ink outline, corner radius 40.
- Name band: a white strip x 230 to 850, y 835 to 895, with WILLINGNESS TO PAY in ink, cap height 38, baseline y 882, centred on x 540.
- Gauge: the dial face (dial) is the upper half-disc with its pivot at (540, 1150) and radius 190. Ticks every 10 degrees from 200 to 340 degrees, in canvas angles where 270 points straight up. Labels in ink, cap height 30: LOW centred on x 300, baseline 1145, on a small green patch; MEDIUM centred on x 540, baseline 955, on a titleYellow patch; HIGH centred on x 785, baseline 1145, on a red patch.
- Needle: ink, 160 px long, tapering from 8 to 3 px, with a red pivot cap of radius 14. LOW is 200 degrees, MEDIUM 270, HIGH 340.
- Slot, the machine's mouth: x 340 to 740, y 1215 to 1245, ink inside, a machineDark lip.
- Legs: from (390, 1300) and (690, 1300) down to y 1430, machineDark, 26 px wide; shoes in shoe, 150 x 50, at y 1430 to 1480, toes turned out.
- Periscope: a machineDark tube 40 px wide at x 820 to 860. Retracted (10): its head, an elbow box 120 x 90, sits at x 780 to 900, y 730 to 820. Raised (12): the tube runs from y 820 up to 430 and the head sits at x 780 to 900, y 340 to 430. The lens is the eye: a white ball of radius 30 on the head's left face with an ink pupil of radius 12.
- Intake: the purchase stream goes into the slot. If the cast's machine also has a hopper on top, the stream may drop into the hopper instead (opening x 300 to 740 at y 720); the ticket always comes out of the slot.
- Ticket (12): a ticket-coloured strip x 390 to 690 that grows out of the slot from y 1245 down to y 1490. RECOMMENDED: in ink, cap height 30, baseline 1300, centred on x 540; $6.89 in ink, cap height 90, baseline 1430, centred on x 540.
- Room, dense plate: the back wall in nightSky under dense short strokes, the floor in pavement from y 1480 with strokes along the perspective.
- Wall map (10): a ticket-coloured sheet pinned to the back wall, x 80 to 1000, y 400 to 780: a pale land shape, about 140 red dots of radius 7 for restaurants and a dozen tiny booths.

### G4: the price tag, close (03, 09, 14, 17)

- Card: x 480 to 920, y 300 to 580, tag fill, ink outline, corner radius 18. Two punched holes at (520, 330) and (880, 330); in 03, 09 and 17 strings rise from them out of the top of the frame, in 14 they dangle.
- Price: ink, hand-lettered, glyph height 160, baseline y 530. Glyph slots: $ x 505 to 585, first digit 590 to 675, point 680 to 710, second digit 715 to 800, third digit 805 to 890.
- In 03, 09 and 17 the card may rock plus or minus 2 degrees about (700, 300) on twos.

### G5: the hero close-up at the counter (03, 09, 17)

- The hero from the chest up, three-quarter view, facing right and up toward the tag. Head centre (330, 1010), head height 400.
- Eyes at (370, 960) and (460, 960), white ovals 60 x 76, irises and pupils looking up and right.
- Mouth at (450, 1110).
- Burger held in both hands, centre (560, 1170), 320 x 220.
- Shoulders across x 100 to 700 from y 1330 down to the bottom edge.
- The booth's window frame edge as scenery: x 940 to 1080, y 620 to 1920.
- Caption slot: x 70 to 460, y 230 to 620. Empty in 03, +21% in 09, the punchline in 17.
- Background behind the caption slot and the hero: the modest street (a house corner, a fence) in 03 and 17, the rich street (a stone column, the fountain's spray) in 09.

### G6: the mile counter (05, 06, 07, 16)

- A titleSpot blob centred (265, 300), 390 x 140.
- On it, the distance and "mi" in ink, hand-lettered, cap height 70, baseline y 330, left edge x 100. Example: "1.25 mi".
- Values, each change popping with `outBack` over 3 frames and an 8 percent overshoot:
  - 05: T 8.0 "0", 8.5 "0.25", 9.0 "0.5", 9.5 "0.75".
  - 06: T 10.0 "1", 10.5 "1.25", 11.0 "1.5".
  - 07: T 11.5 "1.75", 12.0 "2", held to the cut.
  - 16: T 27.0 "1.75", then one step down every 16th: 27.125 "1.5", 27.25 "1.25", 27.375 "1", 27.5 "0.75", 27.625 "0.5", 27.75 "0.25", 27.875 "0", held.
- The canonical helper lives in `src/scenes/05-ride-fence.js` (suggested name `drawMileCounter(ctx, L, value, popAge)`); 06, 07 and 16 copy it verbatim.

### G7: the engine caption (11, 12)

- Three lines, white, hand-lettered, cap height 46, left edge x 80, baselines y 290, 360 and 430: "The engine recommends" / "an "optimal price"" / "for each restaurant."
- It pops on at T 20.25 in 11 and stays on the same pixels until 12 ends at T 22.5.

### G8: every must-read word

| Shot | Words | Colour | Cap height | Box |
|---|---|---|---|---|
| 01, 15, 18 | BURGERS (sign) | art bible background lettering | 90 | x 450 to 910, y 585 to 675 |
| 01, 18 | $5.69 (tag) | ink on tag | 100 | x 550 to 810, y 765 to 865 |
| 15 | $6.89 (tag) | ink on tag | 100 | x 550 to 810, y 765 to 865 |
| 03, 17 | $5.69 (tag) | ink on tag | 160 | x 505 to 890, y 370 to 530 |
| 09, 14 | $6.89 (tag) | ink on tag | 160 | x 505 to 890, y 370 to 530 |
| 04 | ONE | titleBlue, first letter titleYellow, ink outline | 150 | x 370 to 710, y 398 to 572 |
| 04 | BURGER, | as above | 150 | x 160 to 920, y 598 to 772 |
| 04 | TWO PRICES | as above | 120 | x 150 to 930, y 828 to 972 |
| 04 | Reuters, Sept 29, 2026 | ink | 40 | x 330 to 750, y 1040 to 1095 |
| 05, 06, 07, 16 | 0 to 2 mi | ink on titleSpot | 70 | x 100 to 440, y 260 to 345 |
| 09 | +21% | red | 120 | x 90 to 420, y 400 to 520 |
| 10 | nearly 14,000 restaurants | white | 52 | x 80 to 800, y 248 to 315 |
| 10 | millions of orders a day | white | 52 | x 80 to 780, y 323 to 390 |
| 11, 12 | The engine recommends / an "optimal price" / for each restaurant. | white | 46 | x 80 to 640, y 244 to 445 |
| 12 | WILLINGNESS TO PAY | ink on the white band | 38 | x 245 to 835, y 844 to 882 |
| 12 | LOW / MEDIUM / HIGH | ink | 30 | LOW x 268 to 332, y 1115 to 1145; MEDIUM x 482 to 598, y 925 to 955; HIGH x 750 to 820, y 1115 to 1145 |
| 12 | RECOMMENDED: | ink on ticket | 30 | x 420 to 660, y 1270 to 1300 |
| 12 | $6.89 (ticket) | ink on ticket | 90 | x 430 to 650, y 1340 to 1430 |
| 13 | McDonald's: / "a tool, not a mandate" | white | 56 | x 80 to 800, y 244 to 395 |
| 13 | RECOMMENDED: $6.89 (ticket in his hand) | ink on ticket | 26 and 72 | x 300 to 540, y 610 to 790 |
| 14 | Ex-owner: / "You don't really / have much of a choice / anymore." | white | 44 | x 80 to 590, y 1206 to 1475 |
| 17 | Same burger. / Different / neighbourhood. | ink on titleSpot | 52, 52, 48 | x 80 to 455, y 278 to 520 |
| 18 | Sources: Reuters / CNBC, / Engadget, Restaurant Business / Sept 29 – Oct 1, 2026 | ink on titleSpot | 40 | x 220 to 860, y 250 to 425 |
| 18 | Ideas & Technologies | titleBlue, I and T in titleYellow, ink outline | 56 | x 220 to 860, y 454 to 525 |

Every box sits inside x 60 to 940 and y 220 to 1540, and none is under the Shorts button column (x 950 and beyond from y 1000 down). Hand lettering varies in width: a scene fits each line inside its box rather than trusting the cap height alone.

---

## 01 booth-569: Cold open, the $5.69 booth

T 0.0 to 2.0, illustrated, enters on the film start and on the loop replay.

### Composition

G1 on the modest street, on its exact pixels.
White sky over the top third, the booth with its sign, awning and the hanging $5.69 tag on the right half, the owner bored in the window.
The small yellow house and its fence on the left, a tree behind the booth, far hills at the horizon, pavement along the bottom.
The hero rides in from the left edge to the G1 stop mark.

### Forms

Booth, sign, awning and background are painted scenery in the art bible's background manner: wallYellow, roof, fence, trunk, grass, hillsFar, flower and white awning stripes, paper sky, pavement.
The tag is a cel object: tag fill, ink outline, $5.69 in ink.
Hero and bicycle on the cel layer: red shirt, cap, hairYellow, skinKid, green bicycle, ink outline about 4.5 px.
Owner in the window: pink shirt, white apron, hairGrey moustache, skin.
Coins: coin fill with ink outline.

### Overlays

No rings or rulers in this manner. Drawn effects only: four short pavement-grey speed lines behind the hero while he rolls in (T 0.0 to 0.5), a dust puff and a short skid mark at the rear wheel on the skid, an impact star for 2 frames when the coins hit the counter.

### Motion

T 0.0: frame 0 fully drawn: the booth, the $5.69 tag, the bored owner, and the hero's front wheel entering at the left edge (front wheel centre x 40), pedalling on twos.
T 0.0 to 0.5: he rolls right to the G1 stop mark (front wheel centre x 430), easing out on twos.
T 0.5 (beat 2): skid stop on ones for 3 frames: the bike tips back 4 degrees, dust puffs, his left foot comes down; hold.
T 1.0 (beat 3): he holds up two coins with a grin, a pop over 3 frames.
T 1.5 (beat 4): he slaps the coins onto the counter at (560, 1262): impact star; the owner's eyebrows rise and he leans forward on twos.
T 1.5 to 2.0: hold.
Throughout: the tag rocks plus or minus 2 degrees on twos.

### Camera

Locked at zoom 1.

### Enter and exit

Enters on frame 0 of the film and again on the loop replay, from 18's last frame: the same G1 picture with the sources lettering and without the hero.
Exits on a hard cut at T 2.0 to the inside of the booth (02).

### Subject

The burger costs $5.69 here: the real price at a company-run store in Fresno, California, in a Reuters check of the McDonald's app in September 2026.
The street is modest: small houses and picket fences.
No brand marks; the booth reads BURGERS.

### Sound

T 0.0: bar 1 downbeat and the loop landing. The bicycle bell rings twice, at 0.0 and 0.125: a struck-metal tone with partials at 2.6, 5.9 and 7.3 kHz and a 0.35 s decay. The puppet-jazz band starts in F major: pizzicato oom-pah bass on F2 on beats 1 and 3, off-beat pizzicato chords on 2 and 4, a brushed small cymbal on 2 and 4, and the xylophone burger motif F5 A5 C6 A5 G5 E5 F5 on 8ths (an original suggestion; the music agent owns the final notes).
T 0.5: the skid: band-passed noise sweeping from 2.5 kHz down to 700 Hz over 0.25 s with a gritty 30 Hz flutter, and a pizzicato plunk on C3.
T 1.0: coins up: a quick xylophone C6 E6.
T 1.5: coins slapped: three metallic clinks on 32nds (FM bells at 3.8, 4.4 and 5.1 kHz, 80 ms each) over a woodblock knock at 900 Hz.

---

## 02 owner-serves: Inside booth one, the owner serves

T 2.0 to 3.5, schematic, hard cut in.

### Composition

G2 on its exact pixels: the camera inside behind the counter.
The owner fills the left foreground, three-quarter from behind.
Through the window: the modest street (the corner of a yellow house, its fence, sky) and the hero's beaming face, his hands on the sill.
The two coins lie on the sill at (620, 1092). The register stands on the right of the counter, the phone sits quiet on the counter.

### Forms

Dense plate: wallWarm walls under dense short dark strokes, shadowWarm frame and deepest strokes, the counter in fence with strokes along its length.
Owner: pink shirt, white apron and strings, slate trousers, hairGrey fringe, skin.
Burger: bun with sesame, lettuce, cheese, patty, ink outline.
Register and phone: slate bodies with ink outlines, white keys; the phone's screen in screen if the prop has one.
The street in the window keeps the light plate's colours.

### Overlays

Drawn effects: a dry-brush smear on the snatch (2 frames), an impact star at the register's ka-ching (2 frames).

### Motion

T 2.0: frame 0: the owner's hand is mid-push, the burger at (380, 1080) on the counter.
T 2.0 to 2.25: the burger slides to (500, 1080) at the sill, on twos, easing out.
T 2.5 (beat): the hero's hand snatches it out of the window on ones over 3 frames (stretch and smear); the burger is gone.
T 3.0 (beat): the owner rakes the coins into the register; the drawer shoots out 40 px on ones over 3 frames and the register jolts 6 px.
T 3.0 to 3.5: the owner sags and blinks slowly on twos; hold.
Outside: the hero's face beams, his cheeks bouncing on the beats on twos.

### Camera

Locked.

### Enter and exit

Hard cut in from the wide.
Exits on a hard cut to the bite close-up.
Rhymes with 08 and 13: the same interior on the same pixels, with a different street in the window.

### Subject

This man is the one who will later type a price; franchisees set menu prices and enter them themselves.
Here he only sells a burger.

### Sound

T 2.0: inside the booth the band is low-passed at 1.5 kHz (the dense plate's timbre) and a low clarinet-like voice holds F3. The burger slides: a friction zip, band noise rising from 1.2 to 3 kHz over 120 ms.
T 2.5: the snatch: an 80 ms high-passed whoosh and a pizzicato pluck on C5.
T 3.0: the register's ka-ching: a bell with partials at 2.1 and 5.3 kHz and a 0.6 s decay, a drawer clatter (a 60 ms filtered noise burst) and a low chunk (sine 110 Hz, 50 ms).

---

## 03 first-bite: The first bite

T 3.5 to 6.0, illustrated, hard cut in.

### Composition

G5 and G4 on their exact pixels: the hero from the chest up on the left, the burger at his mouth, the $5.69 tag at the upper right, the booth's window frame at the right edge, the modest street behind at the upper left.
The caption slot stays empty.

### Forms

Hero: skinKid, blushKid, hairYellow, cap, red shirt, iris eyes, mouth for the open mouth.
Burger: bun with sesame, lettuce, cheese, patty.
Tag: tag fill, ink outline, $5.69 in ink.
Background: wallYellow house corner, fence, paper sky, painted without ink lines.

### Overlays

Drawn effects: on the chomp, three short crumb strokes fly off the burger on ones for 4 frames, and a small impact star shows for 2 frames.

### Motion

T 3.5: frame 0: mouth wide open, the burger raised, eyes on the burger. This exact pose also opens 09 and 17.
T 4.0 (bar 3 downbeat): chomp on ones: the head lunges 20 px, the jaws close, a 110 px crescent bite appears in the burger.
T 4.5, 4.75, 5.0 (8ths): chewing, cheeks puffed, on twos.
T 5.0 (beat): bliss: eyes shut into arcs, the blush deepens, a sway of 6 degrees to one side; T 5.5 the sway to the other side; each sway holds still.
T 5.5 to 6.0: hold the bliss pose.
Throughout: the tag rocks plus or minus 2 degrees on twos.

### Camera

Locked.

### Enter and exit

Hard cut in from the interior.
Exits on a hard cut to the title card.
Rhymes with 09 and 17: same framing, same tag position.

### Subject

The burger at $5.69, enjoyed. Nothing else in the frame states a price.

### Sound

T 3.5: back outside at full bandwidth; the mouth opens on a rising clarinet glissando from C4 to C5 over 0.5 s.
T 4.0: bar 3 downbeat, the chomp: a 50 ms band-passed crunch (noise between 1.5 and 4 kHz) with a sine thock falling from 140 to 80 Hz, and a pizzicato F major chord.
T 4.5: chewing: three soft squelches on 8ths (4.5, 4.75, 5.0), noise low-passed at 400 Hz, 60 ms each.
T 5.0: bliss: a xylophone glissando from F5 to F6 on 32nds in F major pentatonic, with the clarinet holding A5 under a slow vibrato.

---

## 04 title-card: One burger, two prices

T 6.0 to 8.0, illustrated, hard cut in.

### Composition

A white field (paper) with three pale irregular blots under the lettering (titleSpot, titleSpotPink).
Three lines centred on x 540: ONE (baseline y 560), BURGER, (baseline y 760), TWO PRICES (baseline y 960).
The byline Reuters, Sept 29, 2026 under them, baseline y 1080.
A whole burger centred at (540, 1300), 360 px wide.

### Forms

Title letters: bold, rounded, puffy capitals in titleBlue with an ink outline; the first letter of each word in titleYellow; the baseline jumps up and down by about 12 px from letter to letter, as a static drawing. Cap height 150 for ONE and BURGER, and 120 for TWO PRICES, so TWO PRICES fits x 150 to 930.
Byline: ink, hand-lettered, cap height 40.
Burger: bun with sesame, lettuce, cheese, patty, ink outline.

### Overlays

None.

### Motion

T 6.0 (bar 4 downbeat): frame 0 shows the blots and ONE.
T 6.125: BURGER, pops (`outBack` over 3 frames, 8 percent overshoot).
T 6.25: TWO pops.
T 6.375: PRICES pops.
T 6.5 (beat): the byline draws on left to right over 6 frames.
T 7.0 (beat): the burger bounces once: squash to 0.92 and back on twos.
T 7.0 to 8.0: hold.

### Camera

Locked.

### Enter and exit

Hard cut in from the bliss close-up.
Exits on a hard cut to the first ride shot.

### Subject

The title names the story: one burger, two prices.
The byline credits the Reuters report of September 29, 2026, which CNBC carried.
No price appears on this card, so $6.89 stays unseen until the midpoint.

### Sound

T 6.0: bar 4 downbeat, the title stinger: the whole band on an F6/9 chord (pizzicato, xylophone, clarinet) with a small-cymbal crash.
T 6.125, 6.25, 6.375: the word pops on xylophone A5, C6, F6.
T 6.5: the byline: a pencil scribble, band-passed noise between 3 and 6 kHz with a jittered amplitude, 0.25 s.
T 7.0: the burger bounce: a soft pizzicato boop gliding from F3 up to C4.

---

## 05 ride-fence: Mile 0, picket fences

T 8.0 to 10.0, illustrated, hard cut in.

### Composition

A static street with the ground line at y 1480, the same as G1.
Background: three small single-storey houses in wallYellow with roof roofs and picket fences (fence) along y 1330 to 1480; a laundry line between two posts; a tree; far hills; white sky. The roofs top out near y 880, so the skyline is low.
The G6 mile counter at the upper left.
The hero crosses the frame from left to right.

### Forms

Background painted without ink lines: wallYellow, roof, fence, trunk, grass, hillsFar, paper.
Hero and bicycle on the cel layer as in 01.
Laundry: two or three flat white and pink shapes on a thin trunk-coloured line (background, no ink).

### Overlays

The G6 mile counter. Three short pavement-grey speed lines behind the hero. A throat bulge on the gulp is part of the drawing, not text.

### Motion

T 8.0: frame 0: the hero's front wheel centre at x 40, entering, pedalling on twos; he is chewing the last of the burger with full cheeks.
Path: front wheel centre x = 40 + 700 × t (t shot-local), wheels on y 1480; the pedal cycle has 4 drawings per turn on twos and the body bobs 4 px per stroke.
T 8.5, 9.0, 9.5: the counter pops 0.25, 0.5, 0.75 (G6).
T 9.0 (beat): gulp: a throat bulge for 3 frames, then he licks his lips.
T 9.0 to 10.0: he rides on and is fully out at the right edge by T 10.0.
The laundry flaps on twos.

### Camera

Locked.

### Enter and exit

Hard cut in from the title.
Exits on a hard cut to 06. Screen direction for the whole outbound trip is left to right: he leaves on the right and enters each next shot on the left.

### Subject

The trip is two miles because the two real stores are two miles apart.
It starts in the modest neighbourhood.

### Sound

T 8.0: bar 5, the ride groove: a walking pizzicato bass on quarters (F2, A2, C3, D3 and on), off-beat chords, an original xylophone ride melody on 8ths, quiet freewheel ticks on 16ths (6 kHz clicks), a brushed cymbal on 2 and 4.
T 8.5: the counter tick: a tiny woodblock at 1.6 kHz on each counter step at 8.5, 9.0, 9.5, 10.0, 10.5, 11.0 and 11.5.
T 9.0: the gulp: a sine falling from 300 to 120 Hz over 120 ms with a 25 Hz wobble.

---

## 06 ride-fountain: Mile 1, a fountain

T 10.0 to 11.5, illustrated, hard cut in.

### Composition

The same ground line at y 1480.
Background: bigger two-storey houses in cityPastel and wallYellow, wide lawns, round clipped bushes, a low wrought-iron fence drawn in slate pencil, and a stone fountain on the lawn: a basin 360 px wide centred (700, 1330) with three waterTop jets. Roofs reach about y 700, so the skyline rises.
The G6 counter.
The hero crosses left to right.

### Forms

Background painted without ink lines: cityPastel, wallYellow, roof, grass, stone, waterTop, waterDeep for the basin's depth, hillsFar, paper.
Hero and bicycle as before.

### Overlays

The G6 counter. Speed lines behind the hero.

### Motion

T 10.0: frame 0: front wheel centre at x 40; path x = 40 + 700 × t.
T 10.0, 10.5, 11.0: the counter pops 1, 1.25, 1.5; on the same beats the fountain jets leap to full height on ones and sag back on twos.
T 10.5: the hero turns his head toward the fountain, impressed, on twos.
At the cut he is still crossing (front wheel near x 1090).

### Camera

Locked.

### Enter and exit

Hard cut in; he enters on the left as he left 05 on the right.
Exits on a hard cut to 07.

### Subject

The neighbourhood is getting richer: bigger houses, lawns, a fountain.

### Sound

T 10.0: the clarinet-like voice takes the ride melody up an octave; a fountain fsssh (band noise around 4 kHz, 0.2 s) on 10.0, 10.5 and 11.0.

---

## 07 ride-columns: Mile 2, columns

T 11.5 to 13.0, illustrated, hard cut in.

### Composition

The same ground line.
Background: a mansion with a portico of four stone columns and a pediment whose top is near y 560, cityPastel walls, a long lawn, a stone urn on a plinth, a tall iron gate. The skyline is the highest of the trip, and it still stays below the counter.
The G6 counter.
The hero crosses left to right.

### Forms

Background painted without ink lines: stone, cityPastel, grass, hillsFar, paper; the gate in slate pencil.
Hero and bicycle as before.

### Overlays

The G6 counter. Speed lines, doubled during the sprint.

### Motion

T 11.5: frame 0: front wheel centre at x 40; the counter pops 1.75.
T 12.0 (bar 7 downbeat): the counter pops 2 with a bell. He sniffs (head lifts), his eyes slide right toward something ahead, and he grins.
T 12.5 (beat): he stands on the pedals and sprints: the pedal cycle goes on ones and the speed rises to 1100 px/s; he is out at the right edge before the cut.
T 12.5 to 13.0: the empty mansion holds for the last frames.

### Camera

Locked.

### Enter and exit

Hard cut in.
Exits on a hard cut to the inside of booth two.

### Subject

Two miles from the first booth, in the richest street of the trip.

### Sound

T 11.5: a brassy colour (the clarinet doubled by a low-passed saw a fifth below) and a pizzicato run up the F major scale on 32nds.
T 12.0: two miles: a single bicycle bell ring and a xylophone C7.
T 12.5: the sniff (two short noise puffs), and the ride melody doubles into 16ths.

---

## 08 booth-again: Inside booth two, the same burger

T 13.0 to 16.0, schematic, hard cut in.

### Composition

G2 on the same pixels as 02.
Through the window: the rich street (two stone columns, a fountain's spray, a clipped bush) and the hero's face, grinning and out of breath.
The owner in the left foreground: the same tired man, the same apron.
The tag hangs outside above the window and is not drawn.

### Forms

As 02, with the rich street in the window.
Coins: coin with ink outline.

### Overlays

Drawn effects: a dust puff at the bottom of the window on his arrival, a smear on the snatch, two tiny tap marks on the coin taps.

### Motion

T 13.0: frame 0: the hero arrives at the window, the dust from his skid rising at the window's bottom edge (on ones for 4 frames); he pants on twos.
T 13.5 (beat): he holds up the same two coins, a pop and a grin.
T 14.0 (bar 8 downbeat): the owner pushes a burger across the counter, exactly as in 02 at T 2.0, the burger travelling from (330, 1080) to (500, 1080) on twos over 6 frames.
T 14.5 (beat): the hero snatches it on ones over 3 frames and drops his coins on the sill at (620, 1092).
T 15.0 (beat): the owner taps the coins twice, at 15.0 and 15.125.
T 15.25: the owner points straight up, toward the tag outside; the hero's eyes roll up to follow his finger.
T 15.25 to 16.0: the snap push-in to the hero's eyes (see Camera). His pupils shrink toward dots as the eyes fill the frame.
The last frame is the eyes full frame; the cut at T 16.0 does not wait.

### Camera

Locked until T 15.25. Then, on ones, the camera moves its world centre from (540, 960) to the eye midpoint (562, 790) while zoom rises from 1 to 6, both with `outExpo`, so the last frame (T 15.958) is at zoom 6 or within a hair of it.

### Enter and exit

Hard cut in from the mansion.
Rhymes with 02: same interior, same push of the burger.
Exits on a hard cut on the bar 9 downbeat, from the hero's eyes to the tag he is looking at.

### Subject

The same kind of booth and the same burger, two miles away, in a richer neighbourhood.

### Sound

T 13.0: inside booth two: a muffled skid outside (the 0.5 skid low-passed at 1.2 kHz); the band thins to pizzicato and a low clarinet.
T 13.5: coins jingle: three FM clinks on 16ths.
T 14.0: the burger slide zip, as at 2.0.
T 14.5: the snatch whoosh and pluck, as at 2.5, plus a coin clink.
T 15.0: two dry woodblock knocks at 15.0 and 15.125; the band stops, leaving one held clarinet note.
T 15.25: the push-in: a slide whistle (sine) rising from 400 Hz to 1.6 kHz over 0.75 s, with a snare-like noise roll accelerating from 16ths to 32nds into 16.0.

---

## 09 price-689: $6.89

T 16.0 to 18.0, illustrated, hard cut in on the midpoint downbeat; fades to black at its end.

### Composition

G5 and G4 on the same pixels as 03, in the rich street: a stone column and the fountain's spray behind the upper left.
The tag reads $6.89.
The hero is in 03's opening pose (mouth open, burger raised) but his eyes are on the tag.
+21% sits in the caption slot (G8), red, beside the tag.

### Forms

Hero, burger and tag as in 03; tag lettering $6.89 in ink.
+21%: red, hand-scrawled, glyph height 120, baseline y 520, about x 90 to 420, with one underline stroke.
Background: stone, cityPastel, waterTop, grass, paper, painted without ink lines.

### Overlays

The red +21% scrawl. Drawn effects: short tremble strokes around the burger at T 17.0.

### Motion

T 16.0 (bar 9 downbeat): frame 0 fully drawn: the $6.89 tag settling from 4 degrees to 0 by T 16.25 on twos; the hero frozen mid-bite, eyes up on the tag.
T 16.125: the eyes pop: they bulge to 1.6 times their size and shoot 40 px toward the tag on stalks, on ones over 3 frames with an overshoot, then hold.
T 16.25: +21% scrawls on over 3 frames on ones, in stroke order +, 2, 1, %, then the underline.
T 16.5 (beat): the jaw drops 30 px and the mouth hangs open; hold.
T 17.0 (beat): the burger trembles plus or minus 3 px on ones for 6 frames, then holds.
T 17.625 to 17.875: the fade to black, drawn by this scene: an ink veil over the whole frame rising from alpha 0 to 1 over 6 frames.
T 17.875 to 18.0: full ink black for 3 frames.

### Camera

Locked.

### Enter and exit

Enters on the midpoint downbeat from the push-in on the eyes. The tag sits on G4 exactly where $5.69 sat in 03, so the change reads as a rhyme.
Exits through black into 10, which comes up from black.

### Subject

The same burger costs $6.89 at another company-run store two miles away: a 21 percent premium, from the same Reuters check in September 2026. (6.89 − 5.69) / 5.69 = 0.211.
Reuters could not confirm that this gap comes from the engine. The next shots show how the engine works in general, not proof for these two stores, so no scene adds a claim that the machine set this particular price.

### Sound

T 16.0: bar 9, the midpoint downbeat: a shock stab, the whole band on a diminished chord (B, D, F, A-flat), a small-cymbal crash and a low boom (a sine at 70 Hz falling to 45 Hz over 0.5 s).
T 16.125: the eye pop: a boing, a sine at 220 Hz with a 12 Hz vibrato of plus or minus 40 percent decaying over 0.5 s.
T 16.25: the +21% scrawl: a pencil scratch (band noise between 2.5 and 5 kHz, 0.2 s) and a falling clarinet glissando from A4 to E4.
T 16.5: the jaw drop: a low pizzicato thunk on F2.
T 17.0: the trembling burger: a fast xylophone tremolo on E5 for 0.25 s.
T 17.625: the fade: the band stops on a choked cymbal, and only a low clarinet D2 remains, fading out by 18.0.

---

## 10 machine-feed: The pricing machine eats

T 18.0 to 20.0, schematic, comes up from black (`flash` in ink, 0.375 s).

### Composition

The machine's room on the dense plate: the back wall in nightSky under dense strokes, the pavement floor from y 1480.
The wall map (G3) across the upper middle, x 80 to 1000, y 400 to 780, dotted with red restaurants.
The G3 machine at the bottom with its periscope retracted.
Streams of receipts and coins arc down from the map's dots into the slot.
Captions at the top: nearly 14,000 restaurants (baseline y 300) and millions of orders a day (baseline y 375), white, cap height 52, left edge x 80.

### Forms

Machine: machine body, machineDark legs and periscope, shoe shoes, dial face, white name band, ink outlines.
Map: a ticket-coloured sheet, a pale land shape, red dots of radius 7, a dozen tiny booths.
Receipts: ticket-coloured rectangles 26 x 34 with three ink lines each and an ink outline. Coins: coin discs of radius 12 with an ink outline.
Wall and floor strokes: dense, short, darker than their base; no pure white and no saturated colour in the background.

### Overlays

The two white captions. No rings and no arrows: the streams themselves show the flow.

### Motion

T 18.0: frame 0 fully drawn under the black: the map, the idle machine, and the streams already in flight.
Streams: about 40 particles at any moment, each on a parabolic arc from a seeded map dot to the slot centre (540, 1230) over 0.75 s, new ones leaving on every 16th; every position is a pure function of t and a seed.
T 18.25: caption line 1 pops (`outBack` over 3 frames).
T 18.5 (beat): caption line 2 pops; the map dots pulse to 1.3 times and back over 6 frames with seeded phases.
T 19.0 and 19.5 (beats): the slot gobbles: it snaps open and shut on ones over 3 frames and the whole machine squashes 4 percent and recovers.
T 19.5 to 20.0: the streams thin out as the last coins dive in.
Throughout: an idle hum shake of 1 px on twos.

### Camera

Locked.

### Enter and exit

Comes up from black: core draws ink over the shot with alpha (1 − k/9)² for frames k = 0 to 8.
Exits on a hard cut to the periscope view.
Rhymes with 12: the same machine on the same pixels.

### Subject

McDonald's pricing engine uses machine-learning algorithms to analyse data from millions of daily transactions across nearly 14,000 restaurants (CNBC carrying Reuters, September 29, 2026).
The machine is the film's picture of that analysis, not a real device. Say "nearly 14,000", never an exact count.

### Sound

T 18.0: bar 10, the machine in D minor: a woodblock tick-tock on 8ths (900 Hz and 1.2 kHz), a pizzicato ostinato on 16ths (D3 A3 F3 A3), a low clarinet pedal on D2, and the machine hum (a 55 Hz saw low-passed at 300 Hz with a 2 Hz wobble).
T 18.25: the receipt stream until 20.0: rustling paper (granular bursts of band-passed noise between 2 and 6 kHz) with seeded coin clinks on 16ths panned left and right; a soft wood tick for the first caption.
T 18.5: a soft wood tick for the second caption.
T 19.0: the slot gobbles at 19.0 and 19.5: a mechanical chomp, a sine thunk at 80 Hz plus a click.

---

## 11 periscope-view: The periscope looks at the street

T 20.0 to 21.0, illustrated, hard cut in.

### Composition

A full ink field with a round hole: the periscope's view, centre (540, 900), radius 400 (x 140 to 940, y 500 to 1300), edged by a 10 px slate rim.
Inside the circle, on the light plate: the rich street, the stone portico with its columns, the fountain on the lawn, clipped bushes.
G7 caption above the circle in white.

### Forms

Matte: ink, with the slate rim.
Street: stone, cityPastel, grass, waterTop, hillsFar, paper, painted without ink lines.
Caption: G7.

### Overlays

The G7 caption. No crosshair and no rings: the round matte is the machine's eye, not an annotation.

### Motion

T 20.0: frame 0: the view shows the fountain on the left half of the circle.
T 20.0 to 20.5: the street layer inside the circle slides 600 px to the left with `inOutSine` at 24 fps, so the view turns right until the columns are centred.
T 20.25: the G7 caption pops on (`outBack` over 3 frames).
T 20.5 (beat): the view stops with a 6 px overshoot over 2 frames.
T 20.875: the eyelid blinks: an ink lid closes over the circle from its top and opens again over 3 frames on ones.

### Camera

The matte and the caption are screen-fixed; only the street layer inside the matte moves.

### Enter and exit

Hard cut in from the machine.
Exits on a hard cut to 12 under the G7 caption, which stays on the same pixels.

### Subject

The engine includes an estimate of how much each store's customers are willing to pay; the franchisee screen cites "customer willingness to pay in your area" (CNBC/Reuters).
The columns and the fountain are the film's picture of "your area"; the real system also reads data such as competitors' public menu prices, which the film leaves out.

### Sound

T 20.0: the periscope: a creaky squeak (a saw gliding from 300 to 900 Hz through a narrow band-pass, 0.3 s) and a mechanical whirr under the pan; the band holds a suspended chord.
T 20.25: a soft wood tick for the caption.
T 20.5: the view locks: a clunk (sine at 150 Hz, 40 ms, plus a click) and a xylophone cluster C6 D6 E6.
T 20.875: the blink: a short blip, a sine at 1.2 kHz for 40 ms.

---

## 12 machine-ticket: The gauge and the ticket

T 21.0 to 22.5, schematic, hard cut in.

### Composition

G3 on the same pixels as 10, with the periscope raised (head at x 780 to 900, y 340 to 430) and its eye looking down at the gauge.
The wall map behind is still there but quieter: its dots no longer pulse.
The G7 caption at the upper left on the same pixels as 11.
The gauge reads WILLINGNESS TO PAY with LOW, MEDIUM and HIGH; the needle starts at LOW.

### Forms

As 10, plus the raised periscope and the ticket: a ticket-coloured strip with an ink outline, RECOMMENDED: and $6.89 in ink (G3).

### Overlays

The G7 caption. Drawn effects: three short shudder strokes at the machine's sides on each print click.

### Motion

T 21.0: frame 0: the needle at LOW (200 degrees).
T 21.125, 21.25, 21.375: the needle crawls toward MEDIUM in ratchet steps of 17.5 degrees, each with a 2 degree wobble.
T 21.5 (beat): the needle lands on MEDIUM (270 degrees), quivers plus or minus 3 degrees for 4 frames, and holds.
T 21.75, 21.875, 22.0, 22.125 (16ths): printing: the machine shudders 3 px on each click and the ticket slides out of the slot by about 61 px per step, revealing its text from the top.
T 22.25: the ticket hangs fully out to y 1490, readable: RECOMMENDED: $6.89. It flutters plus or minus 2 degrees on twos.
T 22.25 to 22.5: hold.

### Camera

Locked.

### Enter and exit

Hard cut in from the periscope view under the shared caption.
Exits on a hard cut to the owner, who catches this same ticket.

### Subject

The engine generates what the company calls "the optimal price" for each item at each location: a recommendation (CNBC/Reuters).
The franchisee screen shows messages such as "Your restaurant is showing medium sensitivity to price", based in part on "customer willingness to pay in your area". The gauge and its MEDIUM reading stand for that message.
The ticket says RECOMMENDED, never SET. It is per restaurant: no faces of customers, no clock, no hour-by-hour change (Restaurant Business: no dynamic pricing, no pricing for individual consumers).

### Sound

T 21.0: the gauge: ratchet clicks on 16ths at 21.125, 21.25, 21.375 and 21.5, rising in pitch from 1 to 2 kHz.
T 21.5: the needle on MEDIUM: a small bell ding (FM, 2.4 kHz); the ostinato steps up to F.
T 21.75: printing: four typewriter clicks on 16ths (21.75 to 22.125), each a 3 ms high-passed noise burst with a 1.8 kHz tick, over a paper slide.
T 22.25: the ticket is out: a cold metallic ding, an FM bell at 1.6 kHz.

---

## 13 owner-ticket: The owner gets the ticket

T 22.5 to 24.0, schematic, hard cut in.

### Composition

G2 on the same pixels as 02 and 08; through the window, the rich street, with no hero.
The ticket flutters in through the top right of the window.
The phone sits on the counter.
Caption at the top, in the G2 caption zone: McDonald's: (baseline y 300) and "a tool, not a mandate" (baseline y 380), white, cap height 56, left edge x 80.

### Forms

As 02. The ticket as in 12, smaller in his hand: RECOMMENDED: at cap height 26 and $6.89 at cap height 72, held in the box x 300 to 540, y 610 to 790.

### Overlays

The white caption. Drawn effects: short vibration strokes around the ringing phone.

### Motion

T 22.5: frame 0: the ticket in the window opening near (800, 600), tilted, starting a falling-leaf zigzag on twos; the caption pops on (3 frames).
T 22.75: the owner's hand snaps up and catches it, on ones over 3 frames.
T 23.0 (beat): he holds it up beside his head with the text to camera, in the box above, and reads; his eyebrows sink.
T 23.5 (beat): the phone rings: it jumps 12 px on each 16th, at 23.5, 23.625, 23.75 and 23.875.
T 23.75: his head turns to the phone and his eyes roll, on twos; hold to the cut.

### Camera

Locked.

### Enter and exit

Hard cut in: the ticket that left the machine arrives here.
Exits on a hard cut to the close-up of the owner on the phone.

### Subject

McDonald's says the pricing portal is "a tool, not a mandate", designed to give restaurant-specific recommendations, and that franchisees set prices (Engadget; Restaurant Business).
The ticket is advice; the next shot shows who types the price.

### Sound

T 22.5: inside booth two: a paper flutter (noise band-passed between 1 and 3 kHz, amplitude-modulated at 14 Hz, 0.25 s). The score turns weary in D minor: a slow pizzicato and a descending clarinet line.
T 22.75: the catch: a soft paper snap.
T 23.5: the phone rings: two metal bells with partials at 1.1 and 1.4 kHz struck by a 20 Hz striker, a 0.375 s burst.

---

## 14 owner-types: A sigh, then he types the price

T 24.0 to 26.0, schematic, hard cut in.

### Composition

A dense close-up of the owner behind his counter.
His head on the left, centre (300, 820), head height 300, turned right and up toward the tag; the phone pinned between his ear and shoulder on the near side, its cord looping down out of frame.
His raised hand holds the G4 tag (x 480 to 920, y 300 to 580) by its lower left corner near (490, 570).
His other hand over a keypad on the counter: x 620 to 920, y 1180 to 1440, 3 by 4 keys of 92 px with 12 px gaps (a screen strip on top if the prop has one).
Counter top at y 1150, the warm wall behind.
Caption at the lower left: Ex-owner: / "You don't really / have much of a choice / anymore." at baselines y 1250, 1320, 1390 and 1460, white, cap height 44, left edge x 80.

### Forms

Owner: skin, blush, hairGrey, pink shirt, white apron, ink outline; eyelids drawn as a line across a half-closed eye for the sigh.
Phone and keypad: slate bodies, white keys, screen for any screen, ink outlines.
Tag: G4, tag fill, ink outline; the $ is printed from frame 0, the digits appear as he types.
Wall: wallWarm under dense strokes; counter front in fence under strokes.

### Overlays

The white caption. Drawn effects: three short zigzag strokes at the earpiece while the voice talks (on twos), a sigh puff (a grey dry-brush wavy stroke), a 1-frame key flash on each press.

### Motion

T 24.0: frame 0: the phone at his ear, the tag showing only $, the caption on.
T 24.0 to 24.5: he listens; the zigzag strokes flicker at the earpiece on twos; he nods twice, at 24.125 and 24.375, on twos.
T 24.5 (beat): the sigh: his shoulders drop 20 px, the eyelids half close, and a sigh puff leaves his mouth and drifts 60 px over 12 frames.
T 25.0, 25.125, 25.25, 25.375 (16ths): four key presses (the finger goes down for 1 frame, the key sinks 6 px): 6, the point, 8 and 9 appear in their G4 slots, each with a 2-frame pop.
T 25.5 (beat): the tag reads $6.89; he lifts it 20 px and shows it with a resigned look; hold to T 26.0.

### Camera

Locked.

### Enter and exit

Hard cut in from the interior.
The finished tag sits on G4, the same pixels where the hero saw $6.89 in 09.
Exits on a hard cut back to the street.

### Subject

Franchisees set menu prices and must input them; those prices are entered by a human being (Restaurant Business).
Five store owners told Reuters the company pressured them to use the AI pricing tools, franchisees described phone calls from corporate when they strayed from the recommendations, and former owner Karen King said "You don't really have much of a choice anymore" (CNBC/Reuters). The caption calls her "Ex-owner" because she is one former owner, not all owners.
The human types the price; the machine never touches the tag.

### Sound

T 24.0: bar 13, the receiver squawks: a muffled voice from a 180 Hz saw with a seeded wobbly pitch contour, band-passed between 400 and 1500 Hz, in syllables on 8ths until 24.375, with no words.
T 24.5: the sigh: breath noise band-passed between 400 and 1200 Hz, a 0.1 s attack and a 0.6 s decay with a falling filter, doubled by a clarinet glide A4, F4, D4.
T 25.0: the keys: four plastic clicks on 16ths (25.0, 25.125, 25.25, 25.375), each a 5 ms noise burst through a 2.5 kHz resonance with a 120 Hz thump.
T 25.5: the price is in: a low, tired register ding at 1.3 kHz and a pizzicato D2.

---

## 15 turn-back: Crouch, spin, dash

T 26.0 to 27.0, illustrated, hard cut in.

### Composition

G1 on the same pixels as 01, on the rich street: the portico and the fountain behind on the left, the cypress behind the booth, the tag reading $6.89.
The hero at the G1 stop mark, facing the booth, glaring at the tag, the coins in his fist.
The owner in the window holds the rejected burger out over the counter.

### Forms

As 01, with the rich background (G1) and $6.89 on the tag.
Dust: pavement-grey dry-brush swirls.

### Overlays

Drawn effects: a dry-brush smear in the hero's own colours on the spin, five speed lines along his exit, a dust cloud at the stop mark.

### Motion

T 26.0 (bar 14 downbeat): frame 0: the glare, held.
T 26.25: crouch: hero and bike squash to 0.85 of their height, knees coiled, on twos.
T 26.5 (beat): spin on ones: three drawings (frames at 26.5, 26.542, 26.583) turn the bike to face left behind a smear.
T 26.625: dash: one stretched drawing 1.4 times long at x 100, and on the next frame he is gone off the left edge.
T 26.75 to 27.0: the dust cloud thins on twos, the tag swings up to 8 degrees in the gust, and the owner blinks twice on twos, still holding out the burger.

### Camera

Locked.

### Enter and exit

Hard cut in from the owner's close-up, back to the present.
The same G1 pixels as 01 and 18; only the background and the price differ.
Exits on a hard cut to the ride-back cascade. Screen direction for the way back is right to left.

### Subject

Nothing new is stated. The visible fact is still $6.89, and the hero refuses it.

### Sound

T 26.0: bar 14, the street: F major returns over a held pizzicato tremolo on C.
T 26.25: the crouch: a slide whistle rising from 300 to 900 Hz over 0.25 s.
T 26.5: the turn: a whistle swoop, a sine falling from 1.6 kHz to 400 Hz over 0.2 s.
T 26.625: the dash: a high-passed noise whoosh of 0.25 s and a pizzicato zing, and the band launches the fast ride-back theme (the ride melody in 16ths).

---

## 16 ride-back: Two miles back

T 27.0 to 28.0, illustrated, hard cut in.

### Composition

A cascade of four static cards, 6 frames each, all with the ground line at y 1480 and the G6 counter:

1. T 27.0 to 27.25: the columns (07's background).
2. T 27.25 to 27.5: the fountain (06's background).
3. T 27.5 to 27.75: the fences (05's background).
4. T 27.75 to 28.0: the modest street with the corner of booth one entering at the left edge.

### Forms

Each card is a simplified copy of the matching ride background: the same house positions and colours, fewer details.
Hero and bicycle on the cel layer.

### Overlays

The G6 counter. Drawn effects: the hero as a smear on cards 1 to 3, speed lines, a dust puff on card 4.

### Motion

Cards 1 to 3: within its 6 frames the hero crosses each card from right to left on ones: a 2-frame smear, a 1-frame stretched drawing, a 2-frame smear, gone.
Card 4: at T 27.75 he skids in from the right and stops facing left at front wheel centre x 300; dust; hold.
Counter (G6): 1.75 at T 27.0, then one step down every 16th, reaching 0 at T 27.875, held.

### Camera

Locked on each card. The cuts between cards fall on the 8ths inside this one shot.

### Enter and exit

Hard cut in, screen direction right to left.
Exits on a hard cut to the bite close-up at booth one.

### Subject

Back the same two miles to the $5.69 store.

### Sound

T 27.0: card 1: a whip whoosh (short noise sweep) and a xylophone F6.
T 27.25: card 2: whip and D6.
T 27.5: card 3: whip and C6.
T 27.75: card 4: whip, A5 and the skid.
T 27.875: the counter at zero: a bicycle bell ring.

---

## 17 bite-again: Same burger, different neighbourhood

T 28.0 to 30.0, illustrated, hard cut in.

### Composition

G5 and G4 on the same pixels as 03 and 09, on the modest street.
The tag reads $5.69.
In the caption slot, on a titleSpot blob: Same burger. (baseline y 330), Different (baseline y 420), neighbourhood. (baseline y 505).

### Forms

As 03.
Caption: ink, hand-lettered; cap height 52 for the first two lines and 48 for neighbourhood., so the longest line stays inside x 80 to 455.

### Overlays

The caption. Drawn effects: crumb strokes and an impact star on the chomp, as in 03.

### Motion

T 28.0 (bar 15 downbeat): frame 0 is 03's frame 0 exactly: mouth open, burger raised, eyes on the tag.
T 28.25: Same burger. pops (3 frames).
T 28.5 (beat): chomp on ones, as at T 4.0.
T 28.75: Different / neighbourhood. pops (3 frames); chewing on 8ths at 28.75, 29.0 and 29.25, on twos.
T 29.5 (beat): bliss, as at T 5.0, with one sway; hold to T 30.0.

### Camera

Locked.

### Enter and exit

Hard cut in; the frame rhymes 03 on the same pixels and the same price.
Exits on a hard cut to the wide booth with the sources.

### Subject

The gap is between neighbourhoods, two stores two miles apart; it is not between customers in one line, and not a price that changes by the hour.

### Sound

T 28.0: bar 15: the burger motif returns, warm, in F major; the mouth opens on the rising clarinet glissando from C4 to C5, as at 3.5.
T 28.25: the first caption pops on xylophone A5.
T 28.5: the chomp, as at 4.0.
T 28.75: the second caption pops on xylophone C6; chewing squelches on 8ths.
T 29.5: bliss: the xylophone glissando from F5 to F6, as at 5.0.

---

## 18 sources-card: Sources, and the booth again

T 30.0 to 32.0, illustrated, hard cut in; its last frame loops into 01.

### Composition

G1 on the same pixels as 01, on the modest street, with the $5.69 tag and the owner bored in the window, and no hero.
In the sky's lettering zone, on titleSpot blobs, centred on x 540: Sources: Reuters / CNBC, (baseline y 290), Engadget, Restaurant Business (baseline y 350), Sept 29 – Oct 1, 2026 (baseline y 410), and the channel mark Ideas & Technologies (baseline y 510).

### Forms

As 01.
Source lines: ink, hand-lettered, cap height 40.
Channel mark: titleBlue letters with ink outlines, the I and the T in titleYellow, cap height 56, the baseline jumping a little from letter to letter as on the title card.

### Overlays

The lettering only.

### Motion

T 30.0 (bar 16 downbeat): frame 0: the booth and the three source lines fully drawn.
T 30.5 (beat): the channel mark draws on letter by letter over 12 frames on twos, then holds.
T 31.0 (beat): the owner yawns once on twos and is back in 01's frame-0 pose (chin on hand) by T 31.5.
T 31.5 to 32.0: hold. The last frame equals 01's frame 0 plus the lettering and minus the hero's front wheel.

### Camera

Locked.

### Enter and exit

Hard cut in from the close-up.
On the loop replay, the cut to 01's frame 0 keeps every G1 pixel: only the lettering disappears and the hero's front wheel enters.

### Subject

Sources as captured on October 1, 2026: the Reuters report of September 29, 2026 as carried by CNBC; Engadget, September 29 to 30; Restaurant Business, October 1.

### Sound

T 30.0: bar 16, the closing cadence: pizzicato F2, C3, F2 on the beats, the burger motif slower on the xylophone, the clarinet holding A4, a brushed cymbal swish.
T 30.5: the channel mark: a xylophone sparkle C6 E6 G6 C7 on 32nds.
T 31.0: the owner's yawn: a soft low clarinet glide from F3 down to C3.
T 31.5: a soft final F major chord on pizzicato and xylophone, short.
T 31.75: the pickup: xylophone C5 and E5 on 32nds, resolving onto the bell and the F of the replay's bar 1 downbeat.

---

## Appendix: from doc to code

`src/timeline.js` is this document as data: the 18 shots with their ids, files, times, modes, titles, transitions and one-paragraph briefs, and one flat cue list collected from the Sound sections above. Re-timing a shot is a change to both files together.

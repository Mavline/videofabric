// Cast sheet for "One burger, two prices" (not the film): every character in every pose and every
// recurring object, drawn by FILM.lib.cast and FILM.lib.props, on both plates. One page per shot,
// 10 shots of 1 s (5 bars at 120 bpm), so `snap --samples 10` shows every page once.
//   node tools/check.cjs --fixtures=tools/fixtures/cast
//   node tools/snap.cjs --fixtures=tools/fixtures/cast --samples 10 --sheet
// Pages 4, 6, 8 and 9 draw the storyboard's shared geometry G1, G3, G2 and G5 (with G4) at their own
// pixels; pink crosses mark the storyboard's target points.
FILM.TIMELINE = {
  title: 'cast',
  bpm: 120,
  // a diagnostic sheet, not a Shorts deliverable: labels may run to the bottom edge
  safeBottom: 1920,
  duration: 10,
  shots: [
    { id: 'hero-bike', file: '01-hero-bike.js', start: 0, end: 1, mode: 'illustrated', brief: 'The hero on the bicycle: ride cycle, crouch, dash, straddle, skid, coins, slap, snatch, spin.' },
    { id: 'hero-poses', file: '02-hero-poses.js', start: 1, end: 2, mode: 'illustrated', brief: 'The hero on foot: stand, bite, pop, stalks, turn, sill, facing left, look up, sway, rig.' },
    { id: 'hero-faces', file: '03-hero-faces.js', start: 2, end: 3, mode: 'illustrated', brief: 'Every face of the hero, and the extreme close-up line.' },
    { id: 'g1-booth', file: '04-g1-booth.js', start: 3, end: 4, mode: 'illustrated', brief: 'Storyboard G1 at its pixels: modest street, booth at $5.69, owner leaning, hero at the stop mark.' },
    { id: 'street-props', file: '05-street-props.js', start: 4, end: 5, mode: 'illustrated', brief: 'Houses, bike, burgers, title lettering, the drawn effects.' },
    { id: 'g3-machine', file: '06-g3-machine.js', start: 5, end: 6, mode: 'schematic', brief: 'Storyboard G3 at its pixels: the machine printing under the wall map; small poses below.' },
    { id: 'owner-poses', file: '07-owner-poses.js', start: 6, end: 7, mode: 'schematic', brief: 'The owner in every pose, with a wall shadow.' },
    { id: 'g2-inside', file: '08-g2-inside.js', start: 7, end: 8, mode: 'schematic', brief: 'Storyboard G2 at its pixels: the owner from behind, the hero at the window, register, telephone, coins.' },
    { id: 'g5-closeup', file: '09-g5-closeup.js', start: 8, end: 9, mode: 'illustrated', brief: 'Storyboard G4 and G5 at their pixels: the close tag with glyph slots over the hero with the burger.' },
    { id: 'machine-props', file: '10-machine-props.js', start: 9, end: 10, mode: 'schematic', brief: 'The machine plate grounds; keypad, gauge, ticket, handset and cord, mobile; lettering of both plates.' },
  ],
  cues: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((t) => ({ t, kind: t ? 'cut' : 'open' })),
};

// Cast sheet for "One burger, two prices" (not the film): every character in every pose and every
// recurring object, drawn by FILM.lib.cast and FILM.lib.props, on both plates. One page per shot,
// 8 shots of 1 s (4 bars at 120 bpm), so `snap --samples 8` shows every page once.
//   node tools/check.cjs --fixtures=tools/fixtures/cast
//   node tools/snap.cjs --fixtures=tools/fixtures/cast --samples 8 --sheet
// Pages 4 and 6 are the storyboard's shared geometry G1 (the booth) and G3 (the machine) at their own pixels.
FILM.TIMELINE = {
  title: 'cast',
  bpm: 120,
  // a diagnostic sheet, not a Shorts deliverable: labels may run to the bottom edge
  safeBottom: 1920,
  duration: 8,
  shots: [
    { id: 'hero-bike', file: '01-hero-bike.js', start: 0, end: 1, mode: 'illustrated', brief: 'The hero on the bicycle: ride cycle, crouch, dash, straddle, skid, coins, slap, snatch.' },
    { id: 'hero-poses', file: '02-hero-poses.js', start: 1, end: 2, mode: 'illustrated', brief: 'The hero on foot: stand, bite, pop, stalks, turn, spin, sill, facing left.' },
    { id: 'hero-faces', file: '03-hero-faces.js', start: 2, end: 3, mode: 'illustrated', brief: 'Every face of the hero, and the extreme close-up line.' },
    { id: 'g1-booth', file: '04-g1-booth.js', start: 3, end: 4, mode: 'illustrated', brief: 'Storyboard G1 at its pixels: modest street, booth at $5.69, owner leaning, hero at the stop mark.' },
    { id: 'street-props', file: '05-street-props.js', start: 4, end: 5, mode: 'illustrated', brief: 'Houses, bike, burgers, the close tag (G4), title lettering, the drawn effects.' },
    { id: 'g3-machine', file: '06-g3-machine.js', start: 5, end: 6, mode: 'schematic', brief: 'Storyboard G3 at its pixels: the machine printing under the wall map; small poses below.' },
    { id: 'owner-poses', file: '07-owner-poses.js', start: 6, end: 7, mode: 'schematic', brief: 'The owner in every pose, with a wall shadow.' },
    { id: 'owner-back', file: '08-owner-back.js', start: 7, end: 8, mode: 'schematic', brief: 'The owner from behind at the counter, telephone, register, keypad, gauge, ticket, stream, lettering of both plates.' },
  ],
  cues: [0, 1, 2, 3, 4, 5, 6, 7].map((t) => ({ t, kind: t ? 'cut' : 'open' })),
};

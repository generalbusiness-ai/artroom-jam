// The lead, on guitar: a motif from the theme, answered and transposed,
// entering with long notes and intensifying. See lead.prompt.md.

import type { Interpretation } from '../interpret.ts';
import { random, snapToKey, stepInKey } from '../music.ts';
import type { NoteEvent } from '../record.ts';
import { banter, legato, themeBar, themeInKey, type Played } from './player.ts';

export const LINES = [
  'Over the top it is.',
  'Long notes first. Building suspense.',
  'Same tune, but louder.',
  'I transposed it. You are welcome.',
  'This is the solo you did not ask for.',
];

const UP = 24; // two octaves above the hum

export function lead(interpretation: Interpretation, bar: number, seed: number): Played {
  const key = interpretation.key;
  const say = banter(LINES, bar, seed, 3);
  const events: NoteEvent[] = [];
  const inKey = themeInKey(interpretation).map((p) => p + UP);
  if (inKey.length === 0) return { bars: 1, events, say };

  // Entering: long notes. First the theme's most sung note, then its last two.
  if (bar < 2) {
    if (bar === 0) {
      const count = new Map<number, number>();
      for (const p of inKey) count.set(p, (count.get(p) ?? 0) + 1);
      const held = [...count].sort((a, b) => b[1] - a[1])[0][0];
      events.push({ step: 0, length: 16, pitch: held, velocity: 84, voice: 'lead' });
    } else {
      events.push({ step: 0, length: 8, pitch: inKey.at(-2) ?? inKey[0], velocity: 88, voice: 'lead' });
      events.push({ step: 8, length: 8, pitch: inKey.at(-1)!, velocity: 92, voice: 'lead' });
    }
    return { bars: 1, events, say };
  }

  // Then the motif (the call) and the motif moved up in the key (the answer),
  // alternating every pass of the theme.
  const n = bar - 2;
  const pass = Math.floor(n / interpretation.themeBars);
  const answerDegrees = 3 + Math.floor(random(seed, 3)() * 2); // a fourth or a fifth
  const answering = pass % 2 === 1;
  const intense = n >= 4;
  const higher = n >= 8 ? 7 : 0; // another octave up once well under way
  for (const note of themeBar(interpretation, n, legato(interpretation, 8))) {
    let pitch = snapToKey(note.pitch, key) + UP;
    if (answering) pitch = stepInKey(pitch, answerDegrees, key);
    if (higher) pitch = stepInKey(pitch, higher, key);
    const velocity = intense ? 112 : 100;
    events.push({ step: note.step, length: note.length, pitch, velocity, voice: 'lead' });
    // Intensifying: each note is struck again an eighth later, a step higher.
    if (intense && note.step + 2 < 16) {
      events.push({ step: note.step + 2, length: 1, pitch: stepInKey(pitch, 1, key), velocity: 96, voice: 'lead' });
    }
  }
  return { bars: 1, events, say };
}

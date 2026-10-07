// The synth: first it hums the theme back, then it carries the whole groove.
// See synth.prompt.md.

import type { Interpretation } from '../interpret.ts';
import { atOrAbove, tonicTriad } from '../music.ts';
import type { NoteEvent } from '../record.ts';
import { banter, themeInKey, type Played } from './player.ts';

export const LINES = [
  'I heard a tune. I think it was a tune.',
  'That hum had layers. Two, maybe.',
  'Root and fifth. Nobody gets hurt.',
  'Opening the filter. Stand back.',
  'Is it late? It feels late.',
  'I will hold the groove. Someone has to.',
];

// The theme as it was sung, an octave up, each note held to the next.
function humBack(interpretation: Interpretation): Played {
  const theme = interpretation.theme;
  const end = interpretation.themeBars * 16;
  const events: NoteEvent[] = theme.map((n, i) => ({
    step: n.step,
    length: Math.min(4, (theme[i + 1]?.step ?? end) - n.step),
    pitch: n.pitch + 12,
    velocity: n.velocity,
    voice: 'hum',
  }));
  return { bars: interpretation.themeBars, events };
}

export function synth(interpretation: Interpretation, bar: number, seed: number): Played {
  const say = banter(LINES, bar, seed, 1);
  if (bar === 0 && interpretation.theme.length > 0) return { ...humBack(interpretation), say };

  const groove = Math.max(0, interpretation.theme.length > 0 ? bar - interpretation.themeBars : bar);
  const key = interpretation.key;
  const root = atOrAbove(key.tonic, 31);
  const fifth = root + 7;
  const events: NoteEvent[] = [];

  // Bass: a short root on every beat, then an octave and a root or fifth on
  // the last two sixteenths of the beat. Every fourth bar turns to the fifth.
  for (let beat = 0; beat < 4; beat++) {
    const s = beat * 4;
    const turn = groove % 4 === 3 && beat >= 2;
    events.push({ step: s, length: 1, pitch: turn ? fifth : root, velocity: 112, voice: 'bass' });
    events.push({ step: s + 2, length: 1, pitch: root + 12, velocity: 92, voice: 'bass' });
    events.push({ step: s + 3, length: 1, pitch: turn ? fifth + 12 : root, velocity: 84, voice: 'bass' });
  }

  // Off-beat chord stab: the tonic triad on the "and" of each beat.
  for (const s of [2, 6, 10, 14]) {
    for (const pitch of tonicTriad(key, 55)) {
      events.push({ step: s, length: 1, pitch, velocity: s % 8 === 2 ? 80 : 64, voice: 'stab' });
    }
  }

  // Arpeggio of the theme's notes, moved into the key, on the odd sixteenths,
  // from the third groove bar, its filter opening bar by bar.
  if (groove >= 2) {
    const notes = themeInKey(interpretation).map((p) => atOrAbove(p, 68));
    if (notes.length === 0) notes.push(...tonicTriad(key, 68));
    const filter = Math.min(1, 0.15 + 0.1 * (groove - 2));
    for (let i = 0; i < 8; i++) {
      const pitch = notes[(i + groove) % notes.length];
      events.push({ step: 2 * i + 1, length: 1, pitch, velocity: 72, voice: 'arp', filter });
    }
  }
  return { bars: 1, events, say };
}

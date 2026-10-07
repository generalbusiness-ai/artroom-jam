// The plan for the J2 clip: the theme sung at the start, the rhythm phrase
// sung half way through bar 17, and the band left to play.

import { createBand, mood, sing, tick, type Band, type BandOptions, type Phrase } from './band.ts';
import { RHYTHM, THEME } from './phrases.ts';
import { barStart } from './record.ts';

// Something the person does at a bar position, such as 17.5 for half way
// through bar 17: sing a phrase, or say a mood.
export type Sung = { at: number; phrase: Phrase } | { at: number; mood: string };

export const CLIP_SINGS: Sung[] = [
  { at: 0, phrase: { kind: 'tune', notes: THEME } },
  { at: 17.5, phrase: { kind: 'rhythm', onsets: RHYTHM } },
];

// Bar 0 is the lookahead before the first sing takes effect, so the clip
// starts at bar 1. It ends before bar 21.
export const CLIP_FROM = 1;
export const CLIP_TO = 21;

// The mood clip: the same plan, with the room saying "detroit techno" so that
// it takes effect at bar 8, and "lonesome country" to take effect at bar 16.
// Each is said on the boundary one bar (the lookahead) before.
export const MOOD_CLIP_SINGS: Sung[] = [
  ...CLIP_SINGS,
  { at: 7, mood: 'detroit techno' },
  { at: 15, mood: 'lonesome country' },
];

// Plays a plan through to the start of bar `to`, ticking at every bar
// boundary. A sing or mood on a boundary is recorded before that boundary's
// tick.
export function perform(sings: Sung[], to: number, options: BandOptions = {}): Band {
  const band = createBand(options);
  const pending = [...sings].sort((a, b) => a.at - b.at);
  const act = (s: Sung, time: number) => ('mood' in s ? mood(band, time, s.mood) : sing(band, time, s.phrase));
  for (let bar = 0; bar <= to; bar++) {
    const start = barStart(band.log, bar, band.rules);
    while (pending.length && pending[0].at === bar) act(pending.shift()!, start);
    tick(band, start);
    const barSeconds = barStart(band.log, bar + 1, band.rules) - start;
    while (pending.length && pending[0].at < bar + 1) {
      const s = pending.shift()!;
      act(s, start + (s.at - bar) * barSeconds);
    }
  }
  return band;
}

export function clipBand(options: BandOptions = {}): Band {
  return perform(CLIP_SINGS, CLIP_TO, options);
}

export function moodClipBand(options: BandOptions = {}): Band {
  return perform(MOOD_CLIP_SINGS, CLIP_TO, options);
}

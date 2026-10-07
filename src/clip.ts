// The plan for the J2 clip: the theme sung at the start, the rhythm phrase
// sung half way through bar 17, and the band left to play.

import { createBand, sing, tick, type Band, type BandOptions, type Phrase } from './band.ts';
import { RHYTHM, THEME } from './phrases.ts';
import { barStart } from './record.ts';

export interface Sung {
  at: number; // bar position, such as 17.5 for half way through bar 17
  phrase: Phrase;
}

export const CLIP_SINGS: Sung[] = [
  { at: 0, phrase: { kind: 'tune', notes: THEME } },
  { at: 17.5, phrase: { kind: 'rhythm', onsets: RHYTHM } },
];

// Bar 0 is the lookahead before the first sing takes effect, so the clip
// starts at bar 1. It ends before bar 21.
export const CLIP_FROM = 1;
export const CLIP_TO = 21;

// Plays a plan through to the start of bar `to`, ticking at every bar
// boundary. A sing on a boundary is recorded before that boundary's tick.
export function perform(sings: Sung[], to: number, options: BandOptions = {}): Band {
  const band = createBand(options);
  const pending = [...sings].sort((a, b) => a.at - b.at);
  for (let bar = 0; bar <= to; bar++) {
    const start = barStart(band.log, bar, band.rules);
    while (pending.length && pending[0].at === bar) sing(band, start, pending.shift()!.phrase);
    tick(band, start);
    const barSeconds = barStart(band.log, bar + 1, band.rules) - start;
    while (pending.length && pending[0].at < bar + 1) {
      const s = pending.shift()!;
      sing(band, start + (s.at - bar) * barSeconds, s.phrase);
    }
  }
  return band;
}

export function clipBand(options: BandOptions = {}): Band {
  return perform(CLIP_SINGS, CLIP_TO, options);
}

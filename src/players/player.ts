// What every player is: a function from (interpretation, bar, seed) to a
// pattern. `bar` counts the player's own bars from 0, the bar it arrived.

import type { Interpretation, ThemeNote } from '../interpret.ts';
import { random, snapToKey } from '../music.ts';
import type { NoteEvent } from '../record.ts';

export const STEPS_PER_BAR = 16;

export interface Played {
  bars: number; // how many bars the pattern lasts
  events: NoteEvent[];
  say?: string; // a line of banter, now and then
}

export type Player = (interpretation: Interpretation, bar: number, seed: number) => Played;

// One line on arrival, then perhaps one every fourth bar.
export function banter(lines: string[], bar: number, seed: number, salt: number): string | undefined {
  if (bar === 0) return lines[0];
  if (bar % 4 !== 0) return undefined;
  const r = random(seed, salt, bar);
  if (r() < 0.5) return undefined;
  return lines[1 + Math.floor(r() * (lines.length - 1))];
}

// The notes of one bar of the theme, with steps counted from that bar.
export function themeBar(interpretation: Interpretation, bar: number): ThemeNote[] {
  const k = ((bar % interpretation.themeBars) + interpretation.themeBars) % interpretation.themeBars;
  return interpretation.theme
    .filter((n) => Math.floor(n.step / STEPS_PER_BAR) === k)
    .map((n) => ({ ...n, step: n.step % STEPS_PER_BAR }));
}

// The theme's pitches moved to the nearest note of the key.
export function themeInKey(interpretation: Interpretation): number[] {
  return interpretation.theme.map((n) => snapToKey(n.pitch, interpretation.key));
}

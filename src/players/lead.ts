// The lead, on guitar, with a rockstar attitude: a late entrance, laid-back
// long notes, rushed fills, bends and slides, a flourish at every phrase end,
// one show-off run per pass, and an answer to the synth's motif rather than
// a copy of it. See lead.prompt.md.

import type { Interpretation } from '../interpret.ts';
import { pitchClass, random, scale, snapToKey, stepInKey, type Key } from '../music.ts';
import type { NoteEvent } from '../record.ts';
import { banter, legato, themeBar, themeInKey, type Played } from './player.ts';

export const LINES = [
  'Hello, room! Did you miss me?',
  'Long notes. I make them wait.',
  'The synth asked a question. I have answers.',
  'Was that a run? That was a run.',
  'I bent that note and it said thank you.',
  'Silence. Then me. You are welcome.',
  'Two octaves up. Mind your ears.',
];

const UP = 24; // two octaves above the hum
const LATE = 2; // long notes lie back an eighth
const FLOURISH = 11; // phrase-end flourishes rush in a sixteenth before beat 4

const note = (step: number, length: number, pitch: number, velocity: number, glide?: { from: number; steps?: number }): NoteEvent => ({
  step,
  length,
  pitch,
  velocity,
  voice: 'lead',
  ...(glide ? { from: glide.from, glide: glide.steps ?? 1 } : {}),
});

// Scale degrees from one pitch in the key to another.
function degrees(from: number, to: number, key: Key): number {
  const pcs = scale(key);
  let n = 0;
  for (let p = Math.min(from, to) + 1; p <= Math.max(from, to); p++) if (pcs.includes(pitchClass(p))) n++;
  return to >= from ? n : -n;
}

// The bars of one pass: as long as the theme, and at least two, so that a pass
// has a phrase and a show-off bar.
export function passBars(interpretation: Interpretation): number {
  return Math.max(2, interpretation.themeBars);
}

// Every fourth pass is the biggest: a bar of silence, then the burst.
export const isBigPass = (pass: number) => pass % 4 === 3;

// The theme's most sung note, moved into the key.
function mostSung(interpretation: Interpretation): number {
  const count = new Map<number, number>();
  for (const p of themeInKey(interpretation)) count.set(p, (count.get(p) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1])[0][0];
}

// Two octaves above the synth's hum of the most sung note (the hum sits an
// octave above the sung theme): where the screams go.
export function screamPitch(interpretation: Interpretation): number {
  return mostSung(interpretation) + 12 + 24;
}

export function lead(interpretation: Interpretation, bar: number, seed: number): Played {
  const key = interpretation.key;
  const say = banter(LINES, bar, seed, 3);
  const inKey = themeInKey(interpretation).map((p) => p + UP);
  if (inKey.length === 0) return { bars: 1, events: [], say };
  const scream = screamPitch(interpretation);

  // The entrance. Half a bar of nothing, then the theme's most sung note,
  // struck an eighth late, bent up a whole tone and held into the next bar.
  if (bar === 0) {
    const held = mostSung(interpretation) + UP;
    return { bars: 1, events: [note(8 + LATE, 14, held, 120, { from: held - 2, steps: 2 })], say };
  }
  // Then the theme's last two notes: a slide into the first, a bend into the
  // second, held to the end of the bar.
  if (bar === 1) {
    const a = inKey.at(-2) ?? inKey[0];
    const b = inKey.at(-1)!;
    return {
      bars: 1,
      events: [note(8, 3, a, 112, { from: a + 3 }), note(11, 5, b, 124, { from: b - 2, steps: 2 })],
      say,
    };
  }

  const n = bar - 2;
  const bars = passBars(interpretation);
  const pass = Math.floor(n / bars);
  const k = n % bars;
  const r = random(seed, 3);
  const answerUp = pass % 2 === 1 ? 3 + Math.floor(r() * 2) : 0; // a fourth or a fifth
  const turn = Math.floor(r() * 3); // which flourish comes first
  const accent = Math.min(127, 108 + 4 * (pass % 4));

  // The biggest phrase: silence, then a run of sixteenths two octaves up the
  // key into a scream, bent and left to hang.
  if (isBigPass(pass)) {
    if (k < bars - 1) return { bars: 1, events: [], say };
    const events: NoteEvent[] = [];
    for (let i = 0; i < 14; i++) events.push(note(i, 1, stepInKey(scream - 24, i, key), 90 + 2 * i));
    events.push(note(14, 16, scream, 127, { from: scream - 2, steps: 2 }));
    return { bars: 1, events, say };
  }

  // The show-off bar: what the theme has before beat 2, short, then a run up
  // the key that rushes in a sixteenth early and hangs an octave up.
  if (k === bars - 1) {
    const top = scream - 12;
    const events: NoteEvent[] = [];
    for (const t of themeBar(interpretation, k)) {
      if (t.step < 3) events.push(note(t.step, 1, snapToKey(t.pitch, key) + UP, 70));
    }
    for (let i = 0; i < 7; i++) events.push(note(3 + i, 1, stepInKey(top - 12, i, key), 84 + 4 * i));
    events.push(note(10, 8, top, 122, { from: top - 1 }));
    return { bars: 1, events, say };
  }

  // A phrase bar: an answer to the synth's motif. The theme's rhythm with its
  // contour turned upside down within the same range (the highest note
  // becomes the lowest), and on odd passes moved up a fourth or a fifth.
  // Long notes lie back an eighth and bend or slide in at full volume; short
  // notes are ghosted; a note the laid-back one runs over is dropped.
  const notes = themeBar(interpretation, k, legato(interpretation, 8)).filter((t) => t.step < FLOURISH);
  const sung = notes.map((t) => snapToKey(t.pitch, key) + UP);
  const lo = Math.min(...sung, inKey[0]);
  const hi = Math.max(...sung, inKey[0]);
  const events: NoteEvent[] = [];
  for (const [i, t] of notes.entries()) {
    if (k === 0 && t.step === 0) continue; // wait for the gap on the downbeat
    const pitch = stepInKey(stepInKey(lo, degrees(sung[i], hi, key), key), answerUp, key);
    const long = t.length >= 3;
    const step = long ? t.step + LATE : t.step;
    const last = events.at(-1);
    if (step >= FLOURISH || (last && step <= last.step)) continue;
    const bend = events.filter((e) => e.from !== undefined).length % 2 === 0;
    const glide = long ? { from: bend || !last ? pitch - 2 : last.pitch } : undefined;
    events.push(note(step, t.length, pitch, long ? accent : 64, glide));
  }
  for (let i = 0; i < events.length; i++) {
    const next = events[i + 1]?.step ?? FLOURISH;
    events[i] = { ...events[i], length: Math.max(1, Math.min(events[i].length, next - events[i].step)) };
  }

  // The flourish at the phrase's end: a trill, a fast run down to the last
  // note, or a held scream two octaves above the hum, in turn.
  const end = events.at(-1)?.pitch ?? hi;
  const kind = (pass + turn) % 3;
  if (kind === 0) {
    for (let i = 0; i < 5; i++) events.push(note(FLOURISH + i, 1, i % 2 ? stepInKey(end, 1, key) : end, i % 2 ? 92 : 104));
  } else if (kind === 1) {
    for (let i = 0; i < 5; i++) events.push(note(FLOURISH + i, 1, stepInKey(end, 4 - i, key), 96 + 4 * i));
  } else {
    events.push(note(FLOURISH, 5, scream, 124, { from: scream - 2, steps: 2 }));
  }
  return { bars: 1, events, say };
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stageAt } from '../page/view.ts';
import { CLIP_SINGS, moodClipBand, perform } from '../src/clip.ts';
import { interpretTune } from '../src/interpret.ts';
import { inMood, NEUTRAL, readMood, REFERENCE } from '../src/mood.ts';
import { pitchClass, scale } from '../src/music.ts';
import { THEME } from '../src/phrases.ts';
import { PLAYERS } from '../src/players/index.ts';
import { activeAt, barStart, schedule, type NoteEvent } from '../src/record.ts';
import { renderNote } from '../src/render.ts';

// Spectral centroid in Hz of the first 4096 samples, Hann windowed, up to 8 kHz.
function centroid(x: Float32Array): number {
  const N = 4096;
  let num = 0;
  let den = 0;
  for (let k = 1; k < 750; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const w = x[n] * (0.5 - 0.5 * Math.cos((2 * Math.PI * n) / N));
      re += w * Math.cos((2 * Math.PI * k * n) / N);
      im -= w * Math.sin((2 * Math.PI * k * n) / N);
    }
    num += ((k * 44100) / N) * Math.hypot(re, im);
    den += Math.hypot(re, im);
  }
  return num / den;
}

const band = moodClipBand();
const { log, rules } = band;
const events = (bar: number): NoteEvent[] =>
  Object.values(activeAt(log, bar, rules).parts).flatMap((p) => p!.pattern?.events ?? []);

test('a mood entry takes effect at the lookahead bar and not before', () => {
  const moods = schedule(log, rules).entries.filter((s) => s.entry.type === 'mood');
  assert.deepEqual(
    moods.map((s) => [s.entry.type === 'mood' && s.entry.text, s.effectBar]),
    [
      ['detroit techno', 8],
      ['lonesome country', 16],
    ],
  );
  assert.equal(activeAt(log, 7, rules).mood, undefined);
  assert.equal(activeAt(log, 7, rules).tempo, 120);
  assert.equal(activeAt(log, 8, rules).mood!.text, 'detroit techno');
  assert.equal(activeAt(log, 8, rules).tempo, 126);
  // The band plays the mood from that bar: bright presets, not before.
  assert.ok(events(7).every((e) => e.tone === undefined));
  assert.ok(events(8).some((e) => e.tone === 'bright'));
  // Said half way through bar 7, a mood waits until bar 9.
  const later = perform([...CLIP_SINGS, { at: 7.5, mood: 'detroit techno' }], 10);
  assert.equal(activeAt(later.log, 8, later.rules).mood, undefined);
  assert.equal(activeAt(later.log, 9, later.rules).mood!.text, 'detroit techno');
});

test('the same seed and mood give the same events', () => {
  assert.deepEqual(moodClipBand().log, log);
  const tune = interpretTune(THEME);
  for (const style of Object.values(REFERENCE)) {
    for (const [part, play] of Object.entries(PLAYERS)) {
      for (let bar = 0; bar < 12; bar++) {
        const a = play(inMood(tune, style), bar, 3, style);
        assert.deepEqual(a, play(inMood(tune, style), bar, 3, style), `${part} bar ${bar}`);
        for (const e of a.events) assert.ok(Number.isInteger(e.step) && e.step >= 0 && e.step < a.bars * 16);
      }
    }
  }
});

test('the two reference moods produce measurably different output', () => {
  const detroit = [8, 9, 10, 11, 12, 13, 14, 15];
  const country = [16, 17, 18, 19, 20];
  // Tempo: the detroit nudge is +6, the country nudge -14.
  for (const bar of detroit) assert.equal(activeAt(log, bar, rules).tempo, 126);
  assert.equal(activeAt(log, 16, rules).tempo, 106);
  // Scale: detroit stays in G minor; country plays G mixolydian, with notes
  // (B and E) that G minor does not have.
  const key = interpretTune(THEME).key;
  const minor = scale(key);
  const mixolydian = scale({ ...key, mode: 'mixolydian' });
  const pitched = (bars: number[]) =>
    bars.flatMap(events).filter((e) => ['bass', 'stab', 'arp', 'lead'].includes(e.voice));
  assert.ok(pitched(detroit).every((e) => minor.includes(pitchClass(e.pitch))));
  assert.ok(pitched(country).every((e) => mixolydian.includes(pitchClass(e.pitch))));
  assert.ok(pitched(country).some((e) => !minor.includes(pitchClass(e.pitch))));
  // Density: notes a bar, by part.
  const perBar = (bars: number[], voice: (e: NoteEvent) => boolean) =>
    bars.flatMap(events).filter(voice).length / bars.length;
  const synth = (e: NoteEvent) => ['bass', 'stab', 'arp'].includes(e.voice);
  const drums = (e: NoteEvent) => ['kick', 'clap', 'hat', 'openhat', 'tom'].includes(e.voice);
  assert.ok(perBar(detroit, synth) >= 3 * perBar(country, synth), `${perBar(detroit, synth)} ${perBar(country, synth)}`);
  assert.ok(perBar(detroit, drums) >= 2 * perBar(country, drums), `${perBar(detroit, drums)} ${perBar(country, drums)}`);
  // Swing: country's off-beat eighths are late; detroit's sixteenths are tight.
  assert.ok(detroit.flatMap(events).every((e) => !e.late));
  assert.ok(country.flatMap(events).filter((e) => e.step % 4 === 2).every((e) => e.late === 0.6));
  // Note length: the country bass holds, the detroit bass is a sixteenth.
  const bassLength = (bars: number[]) => Math.max(...bars.flatMap(events).filter((e) => e.voice === 'bass').map((e) => e.length));
  assert.equal(bassLength(detroit), 1);
  assert.ok(bassLength(country) >= 6);
  // The lead: sparse stabs in detroit, quiet slides in country.
  const tune = interpretTune(THEME);
  const lead = (style: keyof typeof REFERENCE, bar: number) =>
    PLAYERS.lead(inMood(tune, REFERENCE[style]), bar, 1, REFERENCE[style]).events;
  for (let bar = 2; bar < 10; bar++) {
    const stabs = lead('detroit techno', bar);
    assert.ok(stabs.length <= 5 && stabs.every((e) => e.length === 1 && e.from === undefined), `bar ${bar}`);
    const mournful = lead('lonesome country', bar);
    assert.ok(mournful.every((e) => e.velocity <= 85), `bar ${bar}`);
  }
  const count = (style?: keyof typeof REFERENCE) =>
    Array.from({ length: 8 }, (_, b) => (style ? lead(style, b + 2) : PLAYERS.lead(tune, b + 2, 1).events)).flat().length;
  assert.ok(2 * count('detroit techno') < count(), `${count('detroit techno')} stabs against ${count()} notes`);
  assert.ok(lead('lonesome country', 2).some((e) => e.from !== undefined && e.from > e.pitch)); // falls into notes
  // Timbre: by spectral centroid, bright is brighter than no preset, and warm
  // darker, for the synth's voices; the warm lead is darker than the rockstar's.
  const tone = (voice: string, t?: string) =>
    centroid(renderNote({ step: 0, length: 2, pitch: voice === 'bass' ? 32 : voice === 'lead' ? 75 : 68, velocity: 110, voice, filter: 0.5, ...(t ? { tone: t } : {}) }, 0.14));
  for (const voice of ['bass', 'stab', 'arp']) {
    assert.ok(tone(voice, 'bright') > tone(voice) && tone(voice) > 1.5 * tone(voice, 'warm'), voice);
  }
  assert.ok(tone('lead', 'warm') < 0.9 * tone('lead'));
});

test('an unknown phrase falls back as stated', () => {
  // A misspelt word is read as the nearest known word, and the caption says so.
  const misspelt = readMood('detriot tecno');
  assert.deepEqual(misspelt.style, REFERENCE['detroit techno']);
  assert.deepEqual(misspelt.fallback, ['"detriot" heard as "detroit"', '"tecno" heard as "techno"']);
  // A word with nothing near is ignored; the rest is understood.
  const partly = readMood('lonesome yodel');
  assert.equal(partly.heard, 'lonesome');
  assert.equal(partly.style!.lead, 'mournful');
  // Nothing understood: the style stays as it was.
  assert.equal(readMood('polka').style, undefined);
  // Object-prototype names are not lexicon entries; they must not corrupt
  // the active tempo or future bar boundaries after a valid mood.
  assert.equal(readMood('constructor').style, undefined);
  const inherited = perform([...CLIP_SINGS, { at: 3, mood: 'detroit techno' }, { at: 6, mood: 'constructor' }], 9);
  assert.deepEqual(activeAt(inherited.log, 8, inherited.rules).style, REFERENCE['detroit techno']);
  assert.equal(activeAt(inherited.log, 8, inherited.rules).tempo, 126);
  assert.ok(Number.isFinite(barStart(inherited.log, 9, inherited.rules)));
  const kept = perform([...CLIP_SINGS, { at: 3, mood: 'detroit techno' }, { at: 6, mood: 'polka' }], 9);
  const at8 = activeAt(kept.log, 8, kept.rules);
  assert.equal(at8.mood!.text, 'polka');
  assert.deepEqual(at8.style, REFERENCE['detroit techno']);
  assert.equal(at8.tempo, 126);
  const stage = stageAt(kept.log, barStart(kept.log, 7, kept.rules) + 0.1, kept.rules);
  assert.deepEqual(stage.captions.at(-1), { by: 'the room says', text: 'polka (not understood; the style stays as it was)' });
  // With no mood at all, the style is neutral.
  assert.deepEqual(activeAt(kept.log, 3, kept.rules).style, NEUTRAL);
});

test('the captions show the room\'s mood from its effect bar', () => {
  const caption = (bar: number) => stageAt(log, barStart(log, bar, rules) + 0.1, rules);
  assert.ok(!caption(7).captions.some((c) => c.by === 'the room says'));
  assert.deepEqual(caption(8).captions.find((c) => c.by === 'the room says'), { by: 'the room says', text: 'detroit techno' });
  assert.equal(caption(16).key, 'G mixolydian');
  assert.equal(caption(16).mood, 'lonesome country');
});

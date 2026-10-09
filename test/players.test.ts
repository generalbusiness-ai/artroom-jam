import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretRhythm, interpretTune } from '../src/interpret.ts';
import { RHYTHM, THEME } from '../src/phrases.ts';
import { PLAYERS } from '../src/players/index.ts';
import { CLAP, KICK, LOW_TOM } from '../src/players/percussion.ts';
import { scale, pitchClass } from '../src/music.ts';
import { screamPitch } from '../src/players/lead.ts';
import type { NoteEvent } from '../src/record.ts';
import { inMood, NEUTRAL, REFERENCE } from '../src/mood.ts';

const tune = interpretTune(THEME);
const rhythm = interpretRhythm(RHYTHM, tune);
const steps = (events: { step: number }[]) => [...new Set(events.map((e) => e.step))].sort((a, b) => a - b);

test('a rhythm-first lead remains silent in every style, including mournful', () => {
  const firstRhythm = interpretRhythm(RHYTHM);
  assert.deepEqual(firstRhythm.theme, []);
  for (const style of [NEUTRAL, ...Object.values(REFERENCE)]) {
    for (const bar of [0, 1, 2, 8, 9]) {
      const played = PLAYERS.lead(inMood(firstRhythm, style), bar, 1, style);
      assert.deepEqual(played.events, []);
      assert.equal(played.bars, 1);
      assert.equal(played.say, PLAYERS.lead(firstRhythm, bar, 1).say);
    }
  }
  assert.deepEqual(PLAYERS.lead(tune, 8, 1, REFERENCE['lonesome country']).events, []);
});

test('every player is deterministic and stays on its grid', () => {
  for (const [part, play] of Object.entries(PLAYERS)) {
    for (let bar = 0; bar < 20; bar++) {
      const a = play(tune, bar, 7);
      assert.deepEqual(a, play(tune, bar, 7), `${part} bar ${bar}`);
      for (const e of a.events) {
        assert.ok(Number.isInteger(e.step) && e.step >= 0 && e.step < a.bars * 16, `${part} step ${e.step}`);
        assert.ok(e.length >= 1 && e.velocity >= 0 && e.velocity <= 127);
      }
    }
  }
});

test('the synth hums the theme back first, then plays the groove with no drums and no lead', () => {
  const first = PLAYERS.synth(tune, 0, 1);
  assert.equal(first.bars, tune.themeBars);
  assert.equal(first.events.length, 3);
  assert.ok(first.events.every((e) => e.voice === 'hum'));
  assert.ok(first.say);

  for (let bar = 2; bar < 12; bar++) {
    const voices = new Set(PLAYERS.synth(tune, bar, 1).events.map((e) => e.voice));
    assert.ok(voices.has('bass') && voices.has('stab'));
    for (const v of voices) assert.ok(['bass', 'stab', 'arp'].includes(v), v);
  }
  const groove = PLAYERS.synth(tune, 2, 1).events;
  // The bass sits on every beat, on the root (G) or the fifth (D).
  const bassOnBeats = groove.filter((e) => e.voice === 'bass' && e.step % 4 === 0);
  assert.deepEqual(steps(bassOnBeats), [0, 4, 8, 12]);
  for (const e of groove.filter((e) => e.voice === 'bass')) assert.ok([7, 2].includes(pitchClass(e.pitch)));
  // The stab is off the beat.
  assert.deepEqual(steps(groove.filter((e) => e.voice === 'stab')), [2, 6, 10, 14]);
  // The arpeggio arrives later, in the key, and its filter opens.
  const arp = (bar: number) => PLAYERS.synth(tune, bar, 1).events.filter((e) => e.voice === 'arp');
  assert.equal(arp(2).length, 0);
  assert.equal(arp(4).length, 8);
  for (const e of arp(4)) assert.ok(scale(tune.key).includes(pitchClass(e.pitch)));
  assert.ok(arp(8)[0].filter! > arp(4)[0].filter!);
});

test('percussion keeps the floor, claps on 2 and 4, and fills every eighth bar', () => {
  for (let bar = 0; bar < 16; bar++) {
    const e = PLAYERS.percussion(tune, bar, 1).events;
    assert.deepEqual(steps(e.filter((x) => x.pitch === KICK)), [0, 4, 8, 12]);
    assert.deepEqual(steps(e.filter((x) => x.pitch === CLAP)), [4, 12]);
    const fill = e.filter((x) => x.voice === 'tom' && x.step >= 12);
    assert.equal(fill.length, bar % 8 === 7 ? 4 : 0, `bar ${bar}`);
  }
});

test('percussion follows the sung rhythm when one is active', () => {
  const bar0 = PLAYERS.percussion(rhythm, 0, 1).events;
  const bar1 = PLAYERS.percussion(rhythm, 1, 1).events;
  assert.deepEqual(steps(bar0.filter((e) => e.pitch === LOW_TOM)), [0, 6, 10]);
  assert.deepEqual(steps(bar1.filter((e) => e.pitch === LOW_TOM)), [0, 6, 10]);
  assert.deepEqual(steps(bar0.filter((e) => e.voice === 'hat')), [2, 4, 8, 12, 14]);
});

const lead = (bar: number, seed = 1, i = tune) => PLAYERS.lead(i, bar, seed).events;
const scream = screamPitch(tune);
// A run: at least six notes on consecutive sixteenths, each a step up the key.
const runs = (events: NoteEvent[]) => {
  let found = 0;
  let length = 1;
  for (let i = 1; i <= events.length; i++) {
    const a = events[i - 1];
    const b = events[i];
    const up = b && b.step === a.step + 1 && b.pitch > a.pitch && b.pitch - a.pitch <= 2;
    if (up) length++;
    else {
      if (length >= 6) found++;
      length = 1;
    }
  }
  return found;
};

test('the lead makes a later, bigger entrance: silence, one held bent note, then the two-note tail', () => {
  const [held, ...rest] = lead(0);
  assert.equal(rest.length, 0);
  assert.ok(held.step >= 8, `enters at step ${held.step}`); // the old lead entered on the downbeat
  assert.ok(held.velocity >= 120 && held.length >= 12); // the old lead's first note: velocity 84
  assert.ok(held.from! < held.pitch); // bent up into the note
  const tail = lead(1);
  assert.equal(tail.length, 2);
  assert.ok(tail.every((e) => e.from !== undefined));
});

test('the lead lays back on long notes, rushes its fills and plays big contrasts', () => {
  for (const bar of [2, 4, 6]) {
    const events = lead(bar);
    const themeSteps = new Set(tune.theme.filter((n) => n.step < 16).map((n) => n.step));
    const long = events.filter((e) => e.from !== undefined && e.step < 11);
    assert.ok(long.length >= 2, `bar ${bar}`);
    // Each laid-back note sits an eighth after a note of the theme.
    for (const e of long) assert.ok(themeSteps.has(e.step - 2), `bar ${bar} step ${e.step}`);
    // The flourish rushes in a sixteenth before beat 4.
    assert.ok(events.some((e) => e.step === 11) && !events.some((e) => e.step === 12 && e.length > 1));
  }
  // The show-off run starts a sixteenth before beat 2.
  assert.equal(lead(3).find((e) => e.pitch === scream - 24)!.step, 3);
  const velocities = Array.from({ length: 8 }, (_, b) => lead(b + 2)).flat().map((e) => e.velocity);
  assert.ok(Math.max(...velocities) - Math.min(...velocities) >= 50);
});

test('the lead ends every phrase with a flourish: a trill, a fast run or a scream two octaves up', () => {
  const kinds = new Set<string>();
  for (const bar of [2, 4, 6, 10, 12, 14]) {
    const end = lead(bar).filter((e) => e.step >= 11);
    const pitches = new Set(end.map((e) => e.pitch));
    if (end.length === 1 && end[0].pitch === scream && end[0].from! < scream) kinds.add('scream');
    else if (end.length === 5 && pitches.size === 2) kinds.add('trill');
    else if (end.length === 5 && end.every((e, i) => i === 0 || e.pitch < end[i - 1].pitch)) kinds.add('run');
    else assert.fail(`bar ${bar}: ${JSON.stringify(end)}`);
  }
  assert.deepEqual([...kinds].sort(), ['run', 'scream', 'trill']);
  // Two octaves above the synth's hum of the most sung note.
  assert.equal(scream, Math.max(...PLAYERS.synth(tune, 0, 1).events.filter((e) => e.pitch % 12 === 0).map((e) => e.pitch)) + 24);
});

test('the lead shows off once per pass with a run up the key, and lets it hang', () => {
  for (let pass = 0; pass < 8; pass++) {
    const bars = [lead(2 + 2 * pass), lead(3 + 2 * pass)];
    assert.equal(bars.map(runs).reduce((a, b) => a + b), 1, `pass ${pass}`);
    const showOff = bars[1];
    const hang = showOff.at(-1)!;
    assert.ok(hang.length >= 8, `pass ${pass}`); // held into the next bar
    for (const e of showOff) assert.ok(scale(tune.key).includes(pitchClass(e.pitch)));
  }
});

test('every fourth pass the lead keeps a bar of silence before its biggest phrase', () => {
  assert.equal(lead(8).length, 0);
  const burst = lead(9);
  // The next silent bar is four passes (eight bars) later; bars between are not silent.
  for (let bar = 10; bar < 16; bar++) assert.ok(lead(bar).length > 0, `bar ${bar}`);
  assert.equal(lead(16).length, 0);
  const all = Array.from({ length: 16 }, (_, b) => lead(b)).flat();
  assert.equal(Math.max(...burst.map((e) => e.velocity)), 127);
  assert.equal(Math.max(...burst.map((e) => e.pitch)), Math.max(...all.map((e) => e.pitch)));
  assert.equal(burst.at(-1)!.pitch, scream);
  assert.equal(burst.at(-1)!.pitch - burst[0].pitch, 24); // a run two octaves up the key
});

test('the lead answers the synth\'s motif rather than copying it', () => {
  // The synth hums the theme; the lead's phrase keeps the theme's rhythm
  // but moves the other way.
  const hum = PLAYERS.synth(tune, 0, 1).events.filter((e) => e.step < 11 && e.step >= 2);
  const answer = lead(2).filter((e) => e.from !== undefined && e.step < 11);
  assert.ok(hum[1].pitch > hum[0].pitch && answer[1].pitch < answer[0].pitch);
  for (const bar of [2, 4]) for (const e of lead(bar)) assert.ok(scale(tune.key).includes(pitchClass(e.pitch)));
  // On the next pass the answer moves up a fourth or a fifth.
  assert.ok(lead(4)[0].pitch > lead(2)[0].pitch);
  // Same seed, same result, with the rhythm phrase active too.
  for (let bar = 0; bar < 20; bar++) assert.deepEqual(PLAYERS.lead(rhythm, bar, 5), PLAYERS.lead(rhythm, bar, 5));
});

test('each player now and then says a line, always on arrival', () => {
  for (const play of Object.values(PLAYERS)) {
    assert.ok(play(tune, 0, 1).say);
    const said = Array.from({ length: 32 }, (_, bar) => play(tune, bar, 1).say).filter(Boolean);
    assert.ok(said.length >= 1 && said.length <= 9, `${said.length}`);
  }
});

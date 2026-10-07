import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretRhythm, interpretTune } from '../src/interpret.ts';
import { RHYTHM, THEME } from '../src/phrases.ts';
import { PLAYERS } from '../src/players/index.ts';
import { CLAP, KICK, LOW_TOM } from '../src/players/percussion.ts';
import { scale, pitchClass } from '../src/music.ts';

const tune = interpretTune(THEME);
const rhythm = interpretRhythm(RHYTHM, tune);
const steps = (events: { step: number }[]) => [...new Set(events.map((e) => e.step))].sort((a, b) => a - b);

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
  assert.equal(first.events.length, 8);
  assert.ok(first.events.every((e) => e.voice === 'hum'));
  assert.ok(first.say);

  for (let bar = 2; bar < 12; bar++) {
    const voices = new Set(PLAYERS.synth(tune, bar, 1).events.map((e) => e.voice));
    assert.ok(voices.has('bass') && voices.has('stab'));
    for (const v of voices) assert.ok(['bass', 'stab', 'arp'].includes(v), v);
  }
  const groove = PLAYERS.synth(tune, 2, 1).events;
  // The bass sits on every beat, on the root (G#) or the fifth (D#).
  const bassOnBeats = groove.filter((e) => e.voice === 'bass' && e.step % 4 === 0);
  assert.deepEqual(steps(bassOnBeats), [0, 4, 8, 12]);
  for (const e of groove.filter((e) => e.voice === 'bass')) assert.ok([8, 3].includes(pitchClass(e.pitch)));
  // The stab is off the beat.
  assert.deepEqual(steps(groove.filter((e) => e.voice === 'stab')), [2, 6, 10, 14]);
  // The arpeggio arrives later, in the key, and its filter opens.
  const arp = (bar: number) => PLAYERS.synth(tune, bar, 1).events.filter((e) => e.voice === 'arp');
  assert.equal(arp(3).length, 0);
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
  assert.deepEqual(steps(bar0.filter((e) => e.pitch === LOW_TOM)), [3, 4]);
  assert.deepEqual(steps(bar1.filter((e) => e.pitch === LOW_TOM)), [4, 5, 6]);
  assert.deepEqual(steps(bar0.filter((e) => e.voice === 'hat')), [0, 6, 8, 10, 12, 14]);
});

test('the lead enters with long notes, then plays the motif and answers it', () => {
  const at = (bar: number) => PLAYERS.lead(tune, bar, 1).events;
  assert.equal(at(0).length, 1);
  assert.equal(at(0)[0].length, 16);
  assert.deepEqual(
    at(1).map((e) => e.length),
    [8, 8],
  );
  // The motif keeps the theme's rhythm.
  const call = at(2);
  assert.deepEqual(steps(call), [0, 2, 5, 8, 11, 13, 15]);
  // The answer has the same rhythm, higher.
  const answer = at(4);
  assert.deepEqual(steps(answer), steps(call));
  assert.ok(answer[0].pitch > call[0].pitch);
  // Intensifying: more notes, louder.
  assert.ok(at(6).length > call.length);
  assert.ok(Math.max(...at(6).map((e) => e.velocity)) > Math.max(...call.map((e) => e.velocity)));
  for (const e of at(10)) assert.ok(scale(tune.key).includes(pitchClass(e.pitch)));
});

test('each player now and then says a line, always on arrival', () => {
  for (const play of Object.values(PLAYERS)) {
    assert.ok(play(tune, 0, 1).say);
    const said = Array.from({ length: 32 }, (_, bar) => play(tune, bar, 1).say).filter(Boolean);
    assert.ok(said.length >= 1 && said.length <= 9, `${said.length}`);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretRhythm, interpretTune, keyOf, tempoFromOnsets } from '../src/interpret.ts';
import { RHYTHM, THEME } from '../src/phrases.ts';
import { synth } from '../src/players/synth.ts';
import { themeBar } from '../src/players/player.ts';

test('the theme quantizes to eight notes and names its tempo and key', () => {
  const i = interpretTune(THEME);
  assert.equal(i.theme.length, 8);
  assert.equal(i.tempo, 105);
  assert.equal(i.tempoClear, true);
  assert.equal(i.key.name, 'G# minor');
  assert.equal(i.beatsPerBar, 4);
  assert.equal(i.stepsPerBeat, 4);
  assert.deepEqual(
    i.theme.map((n) => n.step),
    [0, 2, 5, 8, 11, 13, 15, 18],
  );
  assert.deepEqual(
    i.theme.map((n) => n.pitch),
    THEME.map((n) => n.pitch),
  );
  assert.equal(i.themeBars, 2);
});

test('a final tune onset on a bar line wraps into the playable hum and theme period without losing either downbeat note', () => {
  for (const lastStep of [16, 32]) {
    for (const repeatedPitch of [false, true]) {
      const notes = Array.from({ length: lastStep / 2 + 1 }, (_, i) => ({
        start: 3 + i / 4, duration: 0.125, pitch: repeatedPitch && i * 2 === lastStep ? 60 : 60 + i, velocity: 70 + i,
      }));
      const interpretation = interpretTune(notes);
      assert.equal(interpretation.tempo, 120);
      assert.equal(interpretation.themeBars, lastStep / 16);
      const expected = notes.map((n, i) => ({ step: (i * 2) % lastStep, length: 1, pitch: n.pitch, velocity: n.velocity })).sort((a, b) => a.step - b.step);
      assert.deepEqual(interpretation.theme, expected);
      const hum = synth(interpretation, 0, 1);
      assert.equal(hum.bars, interpretation.themeBars);
      assert.deepEqual(hum.events.map(({ step, pitch, velocity, length }) => ({ step, pitch, velocity, length })),
        expected.map((n) => ({ step: n.step, pitch: n.pitch + 12, velocity: n.velocity, length: 2 })));
      const playable = Array.from({ length: hum.bars }, (_, bar) => hum.events.filter((e) => Math.floor(e.step / 16) === bar)).flat();
      assert.equal(playable.length, notes.length);
      assert.ok(playable.every((e) => e.step >= 0 && e.step < hum.bars * 16 && e.length >= 1));
      assert.deepEqual(themeBar(interpretation, 0).filter((n) => n.step === 0), [expected[0], expected[1]]);
      assert.deepEqual(themeBar(interpretation, interpretation.themeBars), themeBar(interpretation, 0));
    }
  }
});

test('the rhythm phrase sets tempo and grid and keeps the key and theme', () => {
  const tune = interpretTune(THEME);
  const i = interpretRhythm(RHYTHM, tune);
  assert.equal(i.from, 'rhythm');
  assert.equal(i.tempo, 119);
  assert.equal(i.key.name, tune.key.name);
  assert.deepEqual(i.theme, tune.theme);
  assert.equal(i.rhythmBars, 2);
  // The last onset falls on the downbeat of the repeat and joins the first.
  assert.equal(i.rhythm.length, RHYTHM.length - 1);
  assert.deepEqual(
    i.rhythm.filter((h) => h.cls === 'low').map((h) => h.step),
    [3, 4, 20, 21, 22],
  );
});

test('a tempo is 120 and unclear when the onsets say too little', () => {
  assert.deepEqual(tempoFromOnsets([0, 1]), { tempo: 120, clear: false });
  assert.deepEqual(tempoFromOnsets([0, 0.1, 1.5, 1.6, 4]), { tempo: 120, clear: false });
});

test('a tempo snaps into 100 to 130', () => {
  // Four eighth notes at 136 snap to 130, and at 96 to 100.
  const at = (bpm: number) => Array.from({ length: 4 }, (_, i) => (i * 30) / bpm);
  assert.equal(tempoFromOnsets(at(136)).tempo, 130);
  assert.equal(tempoFromOnsets(at(96)).tempo, 100);
  // Spaced at 140 for long enough, no tempo in range fits the grid.
  assert.deepEqual(tempoFromOnsets(Array.from({ length: 9 }, (_, i) => (i * 30) / 140)), { tempo: 120, clear: false });
  // Eighth notes at exactly 112.
  const even = Array.from({ length: 9 }, (_, i) => (i * 30) / 112);
  assert.deepEqual(tempoFromOnsets(even), { tempo: 112, clear: true });
});

test('the key is the most common pitch class, minor unless the major third is sung more', () => {
  const n = (pitch: number) => ({ start: 0, duration: 0.2, pitch, velocity: 100 });
  assert.equal(keyOf([n(60), n(64), n(67), n(60)]).name, 'C major');
  assert.equal(keyOf([n(57), n(60), n(64), n(57)]).name, 'A minor');
});

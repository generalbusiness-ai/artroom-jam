import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeAt,
  barStart,
  createLog,
  DEFAULT_RULES,
  effectBarAt,
  record,
  schedule,
  type Log,
  type NoteEvent,
  type Part,
  type Rules,
} from '../src/record.ts';
import type { Interpretation } from '../src/interpret.ts';

// At the default 120 beats per minute a bar of 4/4 lasts 2 seconds.

function interpretation(tempo: number): Interpretation {
  return {
    from: 'tune',
    tempo,
    tempoClear: true,
    beatsPerBar: 4,
    stepsPerBeat: 4,
    key: { tonic: 9, mode: 'minor', name: 'A minor' },
    theme: [],
    themeBars: 1,
    rhythm: [],
    rhythmBars: 0,
  };
}

function interpret(log: Log, time: number, tempo: number) {
  return record(log, { type: 'interpret', by: 'synth', time, sing: 0, interpretation: interpretation(tempo) });
}

function pattern(log: Log, time: number, part: Part, bars: number, events: NoteEvent[] = []) {
  return record(log, { type: 'pattern', by: part, time, part, bars, follows: 0, events });
}

function effectBars(log: Log, rules: Rules = DEFAULT_RULES) {
  return schedule(log, rules).entries.map((s) => s.effectBar);
}

test('an entry takes effect at the first bar boundary at least one lookahead after it was recorded', () => {
  const log = createLog();
  record(log, { type: 'say', by: 'synth', time: 0, text: 'on the boundary' });
  record(log, { type: 'say', by: 'synth', time: 3, text: 'half way through bar 1' });
  record(log, { type: 'say', by: 'synth', time: 4, text: 'on the start of bar 2' });
  record(log, { type: 'say', by: 'synth', time: 4.01, text: 'just after the start of bar 2' });
  assert.deepEqual(effectBars(log), [1, 3, 3, 4]);
});

test('an effect bar is never before the effect bar of the entry before it', () => {
  // The lookahead is lowered from 1 bar to a quarter of a bar at 3.1 s.
  const rules = { ...DEFAULT_RULES, lookaheadChanges: [{ time: 3.1, lookahead: 0.25 }] };
  const log = createLog();
  record(log, { type: 'say', by: 'synth', time: 3, text: 'half way through bar 1' }); // bar 3
  // By the rule alone this one would take effect at bar 2, before bar 3.
  record(log, { type: 'say', by: 'synth', time: 3.2, text: 'just after' });
  // Much later, the shorter lookahead is visible.
  record(log, { type: 'say', by: 'synth', time: 9, text: 'half way through bar 4' });
  assert.deepEqual(effectBars(log, rules), [3, 3, 5]);
});

test('a lowered lookahead brings the effect bar forward', () => {
  const log = createLog();
  record(log, { type: 'say', by: 'synth', time: 3, text: 'half way through bar 1' });
  assert.deepEqual(effectBars(log), [3]);
  assert.deepEqual(effectBars(log, { ...DEFAULT_RULES, lookahead: 0.25 }), [2]);
  assert.deepEqual(effectBars(log, { ...DEFAULT_RULES, lookahead: 0.5 }), [2]);
  assert.deepEqual(effectBars(log, { ...DEFAULT_RULES, lookahead: 0.6 }), [3]);
});

test('an effect bar is computed with the tempo active at the entry time', () => {
  const log = createLog();
  interpret(log, 0, 60); // from bar 1, at 2 s, bars last 4 s
  assert.equal(barStart(log, 1), 2);
  assert.equal(barStart(log, 2), 6);
  // 5 s is a quarter of the way into bar 1 at the new tempo.
  assert.equal(effectBarAt(log, 5), 3);
  // At the old tempo 5 s would have been half way through bar 2, giving bar 4.
  const old = createLog();
  assert.equal(effectBarAt(old, 5), 4);
});

test('a tempo change recorded for a future bar does not move earlier bars', () => {
  const log = createLog();
  record(log, { type: 'say', by: 'synth', time: 10.5, text: 'x' }); // bar 5 at 120
  interpret(log, 10.5, 60); // bar 7 by the rule, at 14 s
  assert.deepEqual(effectBars(log), [7, 7]);
  assert.equal(barStart(log, 6), 12);
  assert.equal(barStart(log, 7), 14);
  assert.equal(barStart(log, 8), 18);
  assert.equal(activeAt(log, 6).tempo, 120);
  assert.equal(activeAt(log, 7).tempo, 60);
});

test('a pattern plays from its effect bar, repeats, and is replaced by the next', () => {
  const log = createLog();
  record(log, { type: 'take', by: 'synth', time: 0, part: 'synth' });
  pattern(log, 0, 'synth', 2); // bars 1 and 2, then again
  pattern(log, 8, 'synth', 1); // effect bar 5
  assert.equal(activeAt(log, 0).parts.synth?.pattern, undefined);
  assert.equal(activeAt(log, 1).parts.synth?.barInPattern, 0);
  assert.equal(activeAt(log, 2).parts.synth?.barInPattern, 1);
  assert.equal(activeAt(log, 3).parts.synth?.barInPattern, 0);
  assert.equal(activeAt(log, 4).parts.synth?.pattern?.seq, 1);
  assert.equal(activeAt(log, 5).parts.synth?.pattern?.seq, 2);
});

test('a pattern is silent until its part has been taken', () => {
  const log = createLog();
  pattern(log, 0, 'lead', 1);
  record(log, { type: 'take', by: 'lead', time: 4, part: 'lead' }); // bar 3
  assert.equal(activeAt(log, 2).parts.lead, undefined);
  assert.equal(activeAt(log, 3).parts.lead?.pattern?.seq, 0);
});

test('entries must be recorded in time order', () => {
  const log = createLog();
  record(log, { type: 'say', by: 'synth', time: 2, text: 'a' });
  assert.throws(() => record(log, { type: 'say', by: 'synth', time: 1, text: 'b' }));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORIGINAL_TUNES, RHYTHM } from '../src/phrases.ts';
import { interpretRhythm, interpretTune } from '../src/interpret.ts';
import { ContributionError, decodeContribution, decodeInterpretation, decodeStep, encodeContribution, encodeInterpretation, encodeStep, encodeTempo } from '../src/contributions.ts';
import { recordedSchedule, RecordedModelError, type RecordedAct, type RecordedInput } from '../src/recorded.ts';

// One coherent symbolic witness, not native admission/authority or audio proof.
test('recorded-v1 preserves the original contributions and assigns historical cues without rounding or pending-configuration rewrites', () => {
  const original = structuredClone({ tunes: ORIGINAL_TUNES, rhythm: RHYTHM });
  const tunes = ORIGINAL_TUNES.map(tune => encodeContribution({ kind: 'tune', notes: tune.notes }));
  for (const [index, tune] of tunes.entries()) assert.deepEqual(decodeContribution(tune), { kind: 'tune', notes: ORIGINAL_TUNES[index].notes });
  const rhythm = encodeContribution({ kind: 'rhythm', onsets: RHYTHM });
  assert.deepEqual(decodeContribution(rhythm), { kind: 'rhythm', onsets: RHYTHM });
  assert.equal(tunes[0].kind === 'tune' && tunes[0].notes[0].durationUs, 350000);
  assert.equal(tunes[0].kind === 'tune' && tunes[0].notes[2].durationUs, 700000);
  assert.equal(encodeTempo(120), 120000);
  assert.equal(encodeStep(0.6), 600000);
  assert.equal(decodeStep(600000), 0.6);
  assert.throws(() => encodeContribution({ kind: 'tune', notes: [{ ...ORIGINAL_TUNES[0].notes[0], start: 1 / 3 }] }), ContributionError);
  assert.throws(() => encodeContribution({ kind: 'tune', notes: Array.from({ length: 65 }, () => ORIGINAL_TUNES[0].notes[0]) }), ContributionError);
  assert.throws(() => decodeContribution({ ...tunes[0], effectBar: 1 }), ContributionError);

  // These full-shaped references are made-up fixtures. No scope judged them;
  // the production facade must verify the actual entry/ref/provenance first.
  const history: RecordedInput<{ at: { scope: string; inc: string; kind: 'lane' }; seq: number; hash: string }>[] = [];
  const append = (timeMs: number, act: RecordedAct) => {
    const seq = history.length;
    history.push({ seq, timeMs, fact: { at: { scope: `sc_${'a'.repeat(52)}`, inc: `in_${'a'.repeat(26)}`, kind: 'lane' }, seq, hash: `sha256:${seq.toString(16).padStart(64, '0')}` }, act });
  };
  const c = encodeInterpretation(interpretTune(ORIGINAL_TUNES[0].notes));
  const eb = encodeInterpretation(interpretTune(ORIGINAL_TUNES[1].notes));
  const beat = encodeInterpretation(interpretRhythm(RHYTHM, interpretTune(ORIGINAL_TUNES[1].notes)));
  assert.deepEqual(decodeInterpretation(c), interpretTune(ORIGINAL_TUNES[0].notes));
  assert.deepEqual(decodeInterpretation(eb), interpretTune(ORIGINAL_TUNES[1].notes));
  append(0, { kind: 'establish', lookaheadMs: 6000 });
  append(0, { kind: 'sing', contribution: tunes[0] });
  append(0, { kind: 'interpret', sing: 1, interpretation: c }); // bar 1 origin, 120 bpm
  append(10000, { kind: 'set-lookahead', lookaheadMs: 2000 }); // recorded now, active at 16 s/bar 9
  append(10500, { kind: 'sing', contribution: tunes[1] }); // pending decrease cannot move it to 14 s
  append(15900, { kind: 'interpret', sing: 4, interpretation: eb }); // 22 s/bar 12
  append(16100, { kind: 'sing', contribution: rhythm }); // new lookahead would give bar 11; prior cue holds 12
  append(16100, { kind: 'interpret', sing: 6, interpretation: beat });
  append(30000, { kind: 'set-lookahead', lookaheadMs: 6000 }); // active at 32 s/bar 17
  append(31900, { kind: 'sing', contribution: tunes[0] });
  append(32100, { kind: 'interpret', sing: 9, interpretation: c });
  const schedule = recordedSchedule(history);
  assert.equal(schedule.origin, history[2].fact);
  assert.deepEqual(schedule.cues.map(cue => cue.effectBar), [null, null, 1, 9, 10, 12, 12, 12, 17, 18, 21]);
  assert.deepEqual(recordedSchedule(history.slice(0, 5)).cues, schedule.cues.slice(0, 5));
  assert.equal(schedule.cues[5].fact, history[5].fact);
  const duplicate = [...history, { seq: 11, timeMs: 32100, fact: { ...history[2].fact, seq: 11, hash: `sha256:${'b'.repeat(64)}` }, act: { kind: 'interpret' as const, sing: 1, interpretation: c } }];
  assert.throws(() => recordedSchedule(duplicate), RecordedModelError);
  const changedRhythm = history.map((entry, i) => i === 7 ? { ...entry, act: { kind: 'interpret' as const, sing: 6,
    interpretation: { ...beat, theme: beat.theme.map((note, j) => j === 0 ? { ...note, pitch: note.pitch + 1 } : note) } } } : entry);
  assert.throws(() => recordedSchedule(changedRhythm), RecordedModelError);

  // A lower future tempo begins at its assigned existing boundary; it cannot
  // move the earlier sing's cue. BigInt rational arithmetic keeps that exact.
  const slower = history.slice(0, 6).map((entry, i) => i === 5 ? { ...entry, act: { kind: 'interpret' as const, sing: 4, interpretation: { ...eb, tempoMilliBpm: 60000 } } } : entry);
  const slow = recordedSchedule(slower);
  assert.deepEqual(slow.cues, schedule.cues.slice(0, 6));
  assert.deepEqual(slow.segments.at(-1), { bar: 12, startUs: { numerator: '22000000', denominator: '1' }, tempoMilliBpm: 60000 });
  assert.deepEqual({ tunes: ORIGINAL_TUNES, rhythm: RHYTHM }, original);
});

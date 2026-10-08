import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { scriptedRun, summarize, deliveredHistory, perception } from '../harness.mjs';
import { deriveSchedule } from '../schedule.mjs';
import { measuredModelAdapter } from '../players.mjs';
import { render } from '../render.mjs';

const protocol = JSON.parse(fs.readFileSync(new URL('../protocol.json', import.meta.url)));
const themes = JSON.parse(fs.readFileSync(new URL('../themes.json', import.meta.url)));

// Invariant: listeners derive the same second-theme bar across a tempo change,
// using active rather than pending lookahead and preserving earlier assigned bars.
// All players, entries, deliveries and the future invoker below are STAND-INS.
test('scripted listeners change theme together; historical timing survives pending changes and a decrease', async () => {
  const record = scriptedRun(protocol, themes);
  const summary = summarize(record, protocol);
  assert.deepEqual(summary.groups.map((group) => [group.bars, group.firstDownbeatMs]), [
    [[3, 3, 3, 3], 4100], [[6, 6, 6, 6], 10100],
  ]); // Independently stated arithmetic: grid origin 100 ms, 2 s bars.
  assert.deepEqual(summary.claims, { deliveredBeforeStart: true, downbeat: true, secondThemeOnOneBoundary: true });
  for (const player of protocol.players) {
    const heard = (timeMs) => perception(deliveredHistory(record, player, timeMs), timeMs, protocol).activeInterpretation.theme;
    assert.equal(heard(10099), 'synthetic-c');
    assert.equal(heard(10100), 'synthetic-eb');
  }
  // Incremental reads and fresh history readers keep the same bar assignments,
  // even though the second interpretation changes future boundaries to 90 BPM.
  const complete = deriveSchedule(record.history, 2000);
  for (let length = 6; length <= record.history.length; length++) {
    const prefix = deriveSchedule(record.history.slice(0, length), 2000);
    assert.deepEqual(prefix.rows.map((row) => row.effectBar), complete.rows.slice(0, prefix.rows.length).map((row) => row.effectBar));
  }
  assert.equal(complete.boundaryMs(9), 18100); // Three 90-BPM bars after 10100.

  // Jam R9's worked example (seconds), stated expected boundaries, not an
  // expected-value implementation of the scheduler. Step 4 holds 16.1 to 22.
  const history = [
    { kind: 'interpret', timeMs: 0, bpm: 120, meter: [4, 4] },
    { kind: 'lookahead', timeMs: 10000, lookaheadMs: 2000 },
    ...[10500, 15900, 16100, 18100, 20100].map((timeMs) => ({ kind: 'pattern', timeMs })),
    { kind: 'lookahead', timeMs: 30000, lookaheadMs: 6000 },
    ...[31900, 32100].map((timeMs) => ({ kind: 'pattern', timeMs })),
  ].map((entry, seq) => ({ ...entry, seq }));
  const schedule = deriveSchedule(history, 6000);
  assert.deepEqual(schedule.rows.slice(1).map((row) => schedule.boundaryMs(row.effectBar)), [16000, 18000, 22000, 22000, 22000, 24000, 32000, 34000, 40000]);
  const pending = [
    history[0], { seq: 1, kind: 'lookahead', timeMs: 10000, lookaheadMs: 2000 },
    { seq: 2, kind: 'lookahead', timeMs: 11000, lookaheadMs: 4000 },
    { seq: 3, kind: 'pattern', timeMs: 16500 }, { seq: 4, kind: 'pattern', timeMs: 18500 },
  ];
  const two = deriveSchedule(pending, 6000);
  assert.deepEqual(two.rows.slice(1).map((row) => two.boundaryMs(row.effectBar)), [16000, 18000, 20000, 24000]);

  const audio = render(record, protocol);
  assert.ok(audio.samples > 0 && audio.seconds < protocol.maximumRenderSeconds && audio.peak < 1);
  // STAND-IN invoker proves only the recording boundary, with a named test clock.
  let time = 10;
  const adapter = measuredModelAdapter(async () => { time = 25; return { answer: 'scripted', cost: null }; }, { now: () => time, clock: 'scripted test clock' });
  assert.equal(await adapter.call({ player: 'synth', purpose: 'interpret' }), 'scripted');
  assert.deepEqual(adapter.calls.map(({ latencyMs, status, cost }) => ({ latencyMs, status, cost })), [{ latencyMs: 15, status: 'answered', cost: null }]);
});

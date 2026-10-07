import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipBand, CLIP_FROM, CLIP_TO } from '../src/clip.ts';
import { activeAt, barStart, schedule } from '../src/record.ts';

const band = clipBand();
const { log, rules } = band;
const scheduled = schedule(log, rules).entries;

test('in the clip the agents take synth, percussion and lead, eight bars apart, and nobody takes bass', () => {
  const takes = scheduled.filter((s) => s.entry.type === 'take');
  assert.deepEqual(
    takes.map((s) => [s.entry.type === 'take' && s.entry.part, s.effectBar]),
    [
      ['synth', 1],
      ['percussion', 9],
      ['lead', 17],
    ],
  );
  assert.ok(!log.entries.some((e) => e.type === 'pattern' && e.part === 'bass'));
});

test('in the clip the synth hums the theme alone, then grooves', () => {
  for (const bar of [1, 2]) {
    const a = activeAt(log, bar, rules);
    assert.deepEqual(Object.keys(a.parts), ['synth']);
    assert.ok(a.parts.synth!.pattern!.events.every((e) => e.voice === 'hum'));
  }
  const groove = activeAt(log, 3, rules).parts.synth!.pattern!.events;
  assert.ok(groove.some((e) => e.voice === 'bass'));
});

test('in the clip the rhythm phrase takes effect at its effect bar with the tempo change', () => {
  const sing = scheduled.find((s) => s.entry.type === 'sing' && s.entry.kind === 'rhythm')!;
  const interpret = scheduled.find((s) => s.entry.type === 'interpret' && s.entry.sing === sing.entry.seq)!;
  assert.equal(sing.effectBar, 19);
  assert.equal(interpret.effectBar, 19);
  assert.equal(activeAt(log, 18, rules).tempo, 105);
  assert.equal(activeAt(log, 19, rules).tempo, 119);
  // Patterns from bar 19 follow the new interpretation; those before do not.
  assert.equal(activeAt(log, 19, rules).parts.percussion!.pattern!.follows, interpret.entry.seq);
  assert.notEqual(activeAt(log, 18, rules).parts.percussion!.pattern!.follows, interpret.entry.seq);
});

test('the clip lasts about 45 seconds', () => {
  const seconds = barStart(log, CLIP_TO, rules) - barStart(log, CLIP_FROM, rules);
  assert.ok(seconds > 43 && seconds < 47, `${seconds}`);
});

test('no pattern entry states a start bar', () => {
  for (const e of log.entries) {
    if (e.type !== 'pattern') continue;
    assert.deepEqual(Object.keys(e).sort(), ['bars', 'by', 'events', 'follows', 'part', 'seq', 'time', 'type']);
  }
});

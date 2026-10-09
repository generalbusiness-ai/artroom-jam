import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipBand, CLIP_FROM, CLIP_TO } from '../src/clip.ts';
import { activeAt, barStart, schedule } from '../src/record.ts';
import { perform } from '../src/clip.ts';
import { RHYTHM } from '../src/phrases.ts';

const band = clipBand();
const { log, rules } = band;
const scheduled = schedule(log, rules).entries;

test('a rhythm-first country session continues when the lead arrives', () => {
  const rhythmBand = perform([
    { at: 0, phrase: { kind: 'rhythm', onsets: RHYTHM } },
    { at: 0, mood: 'lonesome country' },
  ], 21);
  const atLead = activeAt(rhythmBand.log, 17, rhythmBand.rules);
  assert.equal(atLead.style.lead, 'mournful');
  assert.deepEqual(atLead.interpretation!.interpretation.theme, []);
  assert.deepEqual(atLead.parts.lead!.pattern!.events, []);
  assert.ok(atLead.parts.percussion!.pattern!.events.length > 0);
  assert.ok(atLead.parts.synth!.pattern!.events.length > 0);
  assert.ok(rhythmBand.log.entries.some((e) => e.type === 'pattern' && e.part === 'lead'));
  assert.ok(Number.isFinite(barStart(rhythmBand.log, 22, rhythmBand.rules)));
});

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
  for (const bar of [1]) {
    const a = activeAt(log, bar, rules);
    assert.deepEqual(Object.keys(a.parts), ['synth']);
    assert.ok(a.parts.synth!.pattern!.events.every((e) => e.voice === 'hum'));
  }
  const groove = activeAt(log, 2, rules).parts.synth!.pattern!.events;
  assert.ok(groove.some((e) => e.voice === 'bass'));
});

test('in the original clip the rhythm phrase takes effect at its effect bar without changing the 120-bpm pulse', () => {
  const sing = scheduled.find((s) => s.entry.type === 'sing' && s.entry.kind === 'rhythm')!;
  const interpret = scheduled.find((s) => s.entry.type === 'interpret' && s.entry.sing === sing.entry.seq)!;
  assert.equal(sing.effectBar, 19);
  assert.equal(interpret.effectBar, 19);
  assert.equal(activeAt(log, 18, rules).tempo, 120);
  assert.equal(activeAt(log, 19, rules).tempo, 120);
  // Patterns from bar 19 follow the new interpretation; those before do not.
  assert.equal(activeAt(log, 19, rules).parts.percussion!.pattern!.follows, interpret.entry.seq);
  assert.notEqual(activeAt(log, 18, rules).parts.percussion!.pattern!.follows, interpret.entry.seq);
});

test('the original demo clip plan lasts 40 seconds', () => {
  const seconds = barStart(log, CLIP_TO, rules) - barStart(log, CLIP_FROM, rules);
  assert.ok(seconds === 40, `${seconds}`);
});

test('no pattern entry states a start bar', () => {
  for (const e of log.entries) {
    if (e.type !== 'pattern') continue;
    assert.deepEqual(Object.keys(e).sort(), ['bars', 'by', 'events', 'follows', 'part', 'seq', 'time', 'type']);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perform } from '../src/clip.ts';
import { THEME } from '../src/phrases.ts';
import { barStart } from '../src/record.ts';
import { encodeWav, normalize, peak, renderBars, SAMPLE_RATE, TAIL } from '../src/render.ts';

// A short session: the theme at the start, an agent arriving every bar, so
// that the synth takes bar 1, percussion bar 2 and the lead bar 3.
const band = perform([{ at: 0, phrase: { kind: 'tune', notes: THEME } }], 5, { arrivalEvery: 1 });
const { log, rules } = band;

test('four rendered bars have the right length and peak under 0 dBFS', () => {
  const samples = normalize(renderBars(log, 1, 5, rules));
  const seconds = barStart(log, 5, rules) - barStart(log, 1, rules);
  assert.ok(Math.abs(seconds - 4 * (240 / 105)) < 1e-9); // four bars at 105 beats per minute
  assert.equal(samples.length, Math.ceil((seconds + TAIL) * SAMPLE_RATE));
  assert.ok(peak(samples) < 1);
  assert.ok(peak(samples) > 0.5);

  const wav = encodeWav(samples);
  assert.equal(wav.length, 44 + 2 * samples.length);
  assert.equal(new TextDecoder().decode(wav.slice(0, 4)), 'RIFF');
  const view = new DataView(wav.buffer);
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint16(34, true), 16);
  let max = 0;
  for (let i = 44; i < wav.length; i += 2) max = Math.max(max, Math.abs(view.getInt16(i, true)));
  assert.ok(max < 32767, `${max}`);
});

test('the lead is silent before it arrives', () => {
  const lead = renderBars(log, 1, 5, rules, { parts: ['lead'] });
  const arrives = Math.round((barStart(log, 3, rules) - barStart(log, 1, rules)) * SAMPLE_RATE);
  assert.equal(peak(lead.subarray(0, arrives)), 0);
  assert.ok(peak(lead.subarray(arrives)) > 0.01);
  // The synth, by contrast, plays from the first bar.
  const synth = renderBars(log, 1, 5, rules, { parts: ['synth'] });
  assert.ok(peak(synth.subarray(0, arrives)) > 0.01);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perform } from '../src/clip.ts';
import { THEME } from '../src/phrases.ts';
import { barStart } from '../src/record.ts';
import { encodeWav, normalize, peak, renderBars, renderNote, SAMPLE_RATE, TAIL } from '../src/render.ts';

// A short session: the theme at the start, an agent arriving every bar, so
// that the synth takes bar 1, percussion bar 2 and the lead bar 3.
const band = perform([{ at: 0, phrase: { kind: 'tune', notes: THEME } }], 5, { arrivalEvery: 1 });
const { log, rules } = band;

test('four rendered bars have the right length and peak under 0 dBFS', () => {
  const samples = normalize(renderBars(log, 1, 5, rules));
  const seconds = barStart(log, 5, rules) - barStart(log, 1, rules);
  assert.ok(Math.abs(seconds - 4 * (240 / 120)) < 1e-9); // four bars at 120 beats per minute
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

// The pitch in Hz between two times, by autocorrelation: the shortest lag
// whose correlation is within 10% of the best.
function pitchHz(samples: Float32Array, from: number, to: number): number {
  const a = Math.round(from * SAMPLE_RATE);
  const b = Math.round(to * SAMPLE_RATE);
  const corr: number[] = [];
  for (let lag = Math.floor(SAMPLE_RATE / 1000); lag <= SAMPLE_RATE / 80; lag++) {
    let xy = 0;
    let xx = 0;
    let yy = 0;
    for (let i = a; i < b; i++) {
      xy += samples[i] * samples[i + lag];
      xx += samples[i] ** 2;
      yy += samples[i + lag] ** 2;
    }
    corr[lag] = xy / Math.sqrt(xx * yy || 1);
  }
  const best = Math.max(...corr.filter((c) => c !== undefined));
  return SAMPLE_RATE / corr.findIndex((c) => c !== undefined && c >= 0.9 * best);
}

test('a glide renders a changing pitch, from the start pitch to the note', () => {
  const step = 0.3; // seconds per sixteenth; the glide takes one step, the echo comes three later
  const flat = renderNote({ step: 0, length: 8, pitch: 57, velocity: 100, voice: 'lead' }, step);
  const slide = renderNote({ step: 0, length: 8, pitch: 57, velocity: 100, voice: 'lead', from: 45 }, step);
  const near = (hz: number, target: number) => Math.abs(hz / target - 1) < 0.06;
  // Without a glide, A3 (220 Hz) from the start.
  assert.ok(near(pitchHz(flat, 0.02, 0.06), 220), `${pitchHz(flat, 0.02, 0.06)}`);
  assert.ok(near(pitchHz(flat, 0.4, 0.5), 220));
  // The slide starts near A2 (110 Hz), rises, and arrives on A3.
  const early = pitchHz(slide, 0.02, 0.06);
  const middle = pitchHz(slide, 0.1, 0.14);
  assert.ok(early < 160 && early < middle && middle < 210, `${early} ${middle}`);
  assert.ok(near(pitchHz(slide, 0.4, 0.5), 220));
});

test('the lead\'s entrance is later and louder than its first half bar', () => {
  // In the short session the lead arrives at bar 3: half a bar of silence,
  // then the held note.
  const lead = renderBars(log, 1, 5, rules, { parts: ['lead'] });
  const at = (bar: number) => Math.round((barStart(log, bar, rules) - barStart(log, 1, rules)) * SAMPLE_RATE);
  const half = (at(4) - at(3)) / 2;
  assert.equal(peak(lead.subarray(at(3), at(3) + half)), 0);
  assert.ok(peak(lead.subarray(at(3) + half, at(4))) > 0.1);
});

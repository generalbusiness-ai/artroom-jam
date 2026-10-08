import { createRequire } from 'node:module';
import { deriveSchedule } from './schedule.mjs';

const require = createRequire(import.meta.url);
const { synthNotes, synthDrums, encodeWav, decodeWav } = require('../j0/src/transcribe.js');

// Reuses only Jam's own local primitives. No audio files are read.
export function render(record, protocol) {
  const schedule = deriveSchedule(record.history, protocol.foundingLookaheadMs);
  const patterns = record.history.filter((entry) => entry.kind === 'pattern');
  const startOf = (entry) => schedule.boundaryMs(schedule.rows.find((row) => row.seq === entry.seq).effectBar) / 1000;
  const parts = [];
  for (const entry of patterns) {
    const start = startOf(entry);
    const next = patterns.find((candidate) => candidate.seq > entry.seq && candidate.player === entry.player);
    const cutoff = next ? startOf(next) : Infinity;
    const notes = entry.notes.filter((note) => start + note.start < cutoff).map((note) => ({ ...note, start: start + note.start, duration: Math.min(note.duration, cutoff - start - note.start) }));
    if (notes.some((note) => !Number.isFinite(note.start) || !Number.isFinite(note.duration) || note.start < 0 || note.duration <= 0 || note.start + note.duration > protocol.maximumRenderSeconds)) throw new RangeError('render events exceed the frozen time bound');
    const samples = entry.player === 'drums'
      ? synthDrums(notes.map((note) => ({ time: note.start, cls: note.pitch === 36 ? 'low' : 'high' })), protocol.sampleRate)
      : synthNotes(notes, protocol.sampleRate);
    // The primitives add a release tail; stop the older part at the same
    // replacement boundary too, so the synthetic theme switch does not bleed.
    if (next) samples.fill(0, Math.ceil(cutoff * protocol.sampleRate));
    parts.push(samples);
  }
  const length = Math.max(...parts.map((part) => part.length));
  if (length > protocol.maximumRenderSeconds * protocol.sampleRate) throw new RangeError('render exceeds the frozen sample bound');
  const mix = new Float32Array(length);
  for (const part of parts) for (let index = 0; index < part.length; index++) mix[index] += part[index] * protocol.mixGain;
  let peak = 0;
  for (const sample of mix) {
    if (!Number.isFinite(sample)) throw new Error('non-finite rendered sample');
    peak = Math.max(peak, Math.abs(sample));
  }
  const wav = encodeWav(mix, protocol.sampleRate);
  const readback = decodeWav(wav);
  if (readback.sr !== protocol.sampleRate || readback.samples.length !== mix.length) throw new Error('WAV format or sample count mismatch');
  return { wav, samples: mix.length, seconds: mix.length / protocol.sampleRate, peak, evidence: 'Synthetic scripted mix, unjudged; WAV readback checks format/count only' };
}

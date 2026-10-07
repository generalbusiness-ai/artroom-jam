// Renders the J2 clip to out/j2-clip.wav.
//   node scripts/clip.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { CLIP_FROM, CLIP_TO, clipBand } from '../src/clip.ts';
import { barStart } from '../src/record.ts';
import { encodeWav, normalize, peak, renderBars, SAMPLE_RATE } from '../src/render.ts';

const band = clipBand();
const started = performance.now();
const samples = normalize(renderBars(band.log, CLIP_FROM, CLIP_TO, band.rules));
const wav = encodeWav(samples, SAMPLE_RATE);
mkdirSync('out', { recursive: true });
writeFileSync('out/j2-clip.wav', wav);
writeFileSync('out/j2-log.json', JSON.stringify(band.log, null, 1));

const bars = barStart(band.log, CLIP_TO, band.rules) - barStart(band.log, CLIP_FROM, band.rules);
console.log(
  `out/j2-clip.wav: bars ${CLIP_FROM} to ${CLIP_TO - 1}, ${bars.toFixed(1)} s of bars ` +
    `and ${(samples.length / SAMPLE_RATE).toFixed(1)} s in all, ` +
    `peak ${(20 * Math.log10(peak(samples))).toFixed(2)} dBFS, ` +
    `${band.log.entries.length} log entries, rendered in ${((performance.now() - started) / 1000).toFixed(1)} s`,
);

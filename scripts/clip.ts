// Renders the J2 clip to out/j2-clip.wav, and the mood clip (the same plan,
// with the room saying "detroit techno" for bar 8 and "lonesome country" for
// bar 16) to out/j2-mood-clip.wav.
//   node scripts/clip.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import type { Band } from '../src/band.ts';
import { CLIP_FROM, CLIP_TO, clipBand, moodClipBand } from '../src/clip.ts';
import { inMood } from '../src/mood.ts';
import { activeAt, barStart } from '../src/record.ts';
import { encodeWav, normalize, peak, renderBars, SAMPLE_RATE } from '../src/render.ts';

function write(name: string, band: Band): void {
  const started = performance.now();
  const samples = normalize(renderBars(band.log, CLIP_FROM, CLIP_TO, band.rules));
  mkdirSync('out', { recursive: true });
  writeFileSync(`out/${name}.wav`, encodeWav(samples, SAMPLE_RATE));
  writeFileSync(`out/${name.replace('clip', 'log')}.json`, JSON.stringify(band.log, null, 1));

  const bars = barStart(band.log, CLIP_TO, band.rules) - barStart(band.log, CLIP_FROM, band.rules);
  console.log(
    `out/${name}.wav: bars ${CLIP_FROM} to ${CLIP_TO - 1}, ${bars.toFixed(1)} s of bars ` +
      `and ${(samples.length / SAMPLE_RATE).toFixed(1)} s in all, ` +
      `peak ${(20 * Math.log10(peak(samples))).toFixed(2)} dBFS, ` +
      `${band.log.entries.length} log entries, rendered in ${((performance.now() - started) / 1000).toFixed(1)} s`,
  );
}

write('j2-clip', clipBand());

const moodBand = moodClipBand();
write('j2-mood-clip', moodBand);
// Where the mood and the tempo change in the mood clip.
let last = '';
for (let bar = CLIP_FROM; bar < CLIP_TO; bar++) {
  const a = activeAt(moodBand.log, bar, moodBand.rules);
  const now = `${a.mood?.text ?? 'no mood'}, ${a.tempo} beats per minute, ${a.interpretation && inMood(a.interpretation.interpretation, a.style).key.name}`;
  if (now !== last) console.log(`  from bar ${bar} (${(a.start - barStart(moodBand.log, CLIP_FROM, moodBand.rules)).toFixed(1)} s): ${now}`);
  last = now;
}

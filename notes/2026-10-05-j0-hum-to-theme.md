# J0: hum to theme

Date: 2026-10-05; updated 2026-10-06. Status: first local measurements plus one
authorized hosted comparison. The full J0 spike remains open: five real phrases
by two people, singer judgments and an actual browser exercise are still owed.
The source and first measurements were preserved in commit `6cd561f`; the
hosted protocol was committed as `f726c6c` before sending audio.

Update, 2026-10-06 07:15: Hugh judged path B's reference playback good and
recognizable as the same tune, and did not prefer in-page model path A.
Planner record `475c57cac0cb27cfc729915f0919c775f23e95d7` authorizes hosted
models and this reference audio leaving the machine, Workers AI first and
OpenRouter second. This is one reference phrase from a published sketch,
one singer, not Hugh's voice. That judgment does not replace the remaining
phrases or judge the new hosted playback.

## Conclusion

A plain-JavaScript pitch tracker (path B, no model) transcribed the hummed
tune into 8 notes. The README says "about eight syllables". The model path
(path A, Basic Pitch) found the same pitches and the same syllable positions,
but split them into many fragments. Counts and timings, all from observed runs
on one clip:

| | Path B: pitch tracker | Path A: Basic Pitch |
|---|---|---|
| Notes in the tune (README: about 8 syllables) | 8 | 47 raw (24 start before 3.3 s); 11 after a reduction to one voice |
| Time to transcribe, 4.2 s of audio | 202 to 373 ms (5 runs) | 2.6 to 2.8 s (3 runs, plus a warm run each), 6.5 s for the 11 s band clip |
| What a page downloads | about 6 KB gzip of code | about 0.74 MB gzip (bundle, model) |
| Licence | own code | Apache-2.0 |

For the rhythm phrase, the onset detector found 18 hits in the 4.2 s clip, a
median gap of 0.25 s, which is 4.1 hits a second. The README says "about four
hits a second".

Recommendation after Hugh's reference judgment: do the transcription in the
page, with path B. It is small, fast and needs no model. Its playback was
recognizable on this clip. This remains provisional across singers and
phrases: the clip has clear silences between syllables, which makes note
splitting easy; legato humming is untested.

One hosted model was compared on 2026-10-06 (see "Hosted comparison"). It
returned eight flat-pitch events in 5.13 seconds for $0.0015735. Its contour
does not agree with path B. Its playback has not yet received a human judgment.

One finding for the plan: it says "a pitch tracker alone would give pitch
without onsets". On this clip, splitting on silence and on pitch jumps gave
onsets as well, because the syllables are separated by quiet gaps.

## What ran

The original local runs below were all on this machine (Apple M5 Max, macOS,
Node v26.10.0), with no audio or API leaving it. The later hosted comparison
sent only the authorized reference clip and its frozen blind prompt. The
machine was shared: the load average was about 4.5 to 6 during
the measurements, so timings are noisy.

- Path A: Basic Pitch, npm package `@spotify/basic-pitch` version 1.0.1,
  licence Apache-2.0, with its model files (shipped inside the package) and its
  own bundled TensorFlow.js 3.21.0 (Apache-2.0). Run under Node with the same
  JavaScript the browser would load, on tfjs's CPU backend. The browser would
  normally use the WebGL backend; that was not measured. The model was loaded
  from local files by a custom loader, not fetched over a network.
- Path B: `src/transcribe.js`, plain JavaScript. YIN pitch tracking (2048-sample
  window, 10 ms hop, threshold 0.15, 70 to 700 Hz), then segmentation: 5-frame
  median filter, split on a pitch jump over one semitone lasting 2 frames, split
  on silence, notes under 60 ms dropped, frames under 12% of the loudest frame
  treated as silence, notes with mean YIN confidence under 0.9 dropped.
- Rhythm: same file. Spectral flux (1024-point FFT, 256 hop) on log-compressed
  magnitudes, adaptive threshold from a 0.25 s moving median, minimum 80 ms gap.
  Class per hit: spectral centroid over the 40 ms after the onset, split into two
  groups by 1-D k-means; the lower group is "low" (kick), the higher "high"
  (snare).
- Synth: triangle plus sine with a short envelope for notes; a falling sine for
  low hits and a noise burst for high hits.
- Standard MIDI files were checked by parsing them back with `@tonejs/midi`
  2.0.28 (MIT; used only for this check).
- The harness page was built from the same `transcribe.js`.

The two parameters `rmsRel` (0.12) and `minConf` (0.9) were set after looking
at this clip. Without the confidence gate path B finds 9 notes: the extra one
is at 3.88 s, pitch 37, inside the mouth percussion that begins at 3.3 s and is
part of the 4.2 s tune file.

## Transcriptions

Path B, `hum-01-tune.wav`. Pitch is the MIDI number from the median of the note's
frames; "exact" is the unrounded median.

| # | start s | duration s | MIDI | name | exact | velocity |
|---|---|---|---|---|---|---|
| 1 | 0.14 | 0.11 | 45 | A2 | 45.47 | 76 |
| 2 | 0.47 | 0.16 | 50 | D3 | 49.77 | 122 |
| 3 | 0.80 | 0.23 | 56 | G#3 | 56.18 | 126 |
| 4 | 1.26 | 0.24 | 56 | G#3 | 56.19 | 126 |
| 5 | 1.69 | 0.14 | 56 | G#3 | 56.37 | 121 |
| 6 | 1.99 | 0.16 | 52 | E3 | 51.91 | 113 |
| 7 | 2.31 | 0.22 | 58 | A#3 | 57.76 | 127 |
| 8 | 2.71 | 0.29 | 51 | D#3 | 51.44 | 101 |

Range 45 to 58 (13 semitones). Steps between notes: +5, +6, 0, 0, -4, +6, -7.
Gaps between note starts: 0.33, 0.33, 0.46, 0.43, 0.30, 0.32, 0.40 s, about 2.7
syllables a second (README: roughly three). Duration is the loud part of each
syllable only; a quiet tail after each syllable was treated as silence.
Note 1 is on a rounding edge: at 48 kHz (the file resampled; observed once) it
came out as 46.

The README originally described the dominant pitch as G#3, then G#2 and E2,
then D#4. Neither local path found anything below A2 or above A#3. The material
README's 2026-10-05 23:15 correction says those spectral-bin readings picked
harmonics rather than fundamentals and directs us to trust the tracker.
This correction is not independent pitch ground truth.

Path A, same file, with Basic Pitch's default note thresholds, first of three
identical runs. All 47 raw notes are in `work/out/hum-01-pathA-raw.json`; those
starting before 3.3 s:

| start s | MIDI | | start s | MIDI | | start s | MIDI |
|---|---|---|---|---|---|---|---|
| 0.12 | 45 | | 1.00 | 56 | | 1.97 | 52 |
| 0.19 | 46 | | 1.17 | 56 | | 2.03 | 52 |
| 0.45 | 50 | | 1.26 | 56 | | 2.11 | 52 |
| 0.53 | 49 | | 1.47 | 56 | | 2.30 | 58 |
| 0.71 | 56 | | 1.60 | 56 | | 2.44 | 57 |
| 0.79 | 56 | | 1.68 | 56 | | 2.71 | 52 |
| 0.80 | 68 | | 1.71 | 68 | | 2.83 | 51 |
| 0.91 | 56 | | 1.75 | 56 | | | |
| | | | 1.82 | 56 | | | |

Each syllable is split into several notes, and two notes an octave above (68)
overlap the 56 notes. After 3.3 s there are 23 more notes: fragments of the mouth
percussion.

Path A reduced to one voice (keep the strongest of overlapping notes, merge
same-pitch fragments less than 0.12 s apart, only notes before 3.3 s): 11 notes,
pitches 45, 46, 50, 49, 56, 56, 52, 58, 57, 52, 51. Four pairs are
one-semitone neighbours (45/46, 50/49, 58/57, and 52/51), so the 11 notes cover 7 syllables,
and the second and third syllables on 56 merged into one long note starting at
1.26 s. This reduction is mine, not Basic Pitch's.

The two paths agree on the pitch of every syllable they both found (within one
semitone) and on the onset times (within about 0.1 s).

Rhythm, `hum-02-rhythm.wav` (4.2 s). 18 hits: 5 low, 13 high. The class split
was at a centroid of 1310 Hz. I have no reference labels, so the classes are not
checked.

| time s | class | | time s | class | | time s | class |
|---|---|---|---|---|---|---|---|
| 0.08 | high | | 1.85 | high | | 3.37 | high |
| 0.47 | low | | 2.10 | high | | 3.61 | high |
| 0.59 | low | | 2.48 | high | | 3.75 | high |
| 0.85 | high | | 2.61 | low | | 4.11 | high |
| 1.09 | high | | 2.74 | low | | | |
| 1.35 | high | | 2.87 | low | | | |
| 1.60 | high | | 3.11 | high | | | |

Gaps are mostly 0.24 to 0.26 s. Three gaps are about 0.38 s (1.5 times the
period), so a hit may be missing there, and four are 0.12 to 0.14 s (half the
period). I cannot check this without ground truth.

## Timings

Each label says how the number was taken.

| Measure | Result | How taken |
|---|---|---|
| Path A model load | 4.8, 5.3, 5.2 ms | 3 fresh Node processes; files read from local disk and graph built, no network fetch, so this is not a page's load time |
| Path A inference, first call | 2739, 2779, 2773 ms | same 3 processes; 4.2 s audio at 22.05 kHz; CPU backend |
| Path A inference, second call | 2686, 2619, 2722 ms | same processes |
| Path A note extraction | 8 to 9 ms | same |
| Path A on the band clip (11.2 s) | 6468, 6534 ms | one process, two calls |
| Path B, whole hum | 218, 214, 373, 369, 202 ms | 5 calls in one Node process, machine loaded |
| Rhythm onset detection | 18, 17, 18, 17, 18 ms | 5 calls in one Node process |
| Path B and onsets through the harness's own code | 220 ms, 74 ms | one call each in a Node `vm`, cold |

Browser timings (WebGL for path A, a real page for path B) were not measured.

## Download sizes

Measured as file sizes; "gzip" is `gzip -9` of the file, not a real page load.

| Item | Bytes | Gzip |
|---|---|---|
| Path A model weights `group1-shard1of1.bin` | 742,392 | 426,431 |
| Path A `model.json` | 174,537 | 8,107 |
| Path A JavaScript bundle (esbuild 0.28.2, minified, includes tfjs 3.21.0) | 1,230,663 | 307,549 |
| Path A total | 2,147,592 | 742,087 |
| Path B code `transcribe.js` (unminified, includes synth and MIDI writer) | 16,513 | 5,878 |
| Harness page (one file) | 29,129 | 10,366 |

The package ships no browser bundle: its files import tfjs by bare module name,
which a page cannot resolve without a build step. That is why path A is not in
the harness by default (see the harness steps).

## Licences

| Component | Version | Licence | Used for |
|---|---|---|---|
| Basic Pitch, `@spotify/basic-pitch` (model files are inside the package) | 1.0.1 | Apache-2.0 | path A |
| TensorFlow.js, bundled inside Basic Pitch | 3.21.0 | Apache-2.0 | path A |
| `@tensorflow/tfjs` (installed, not used by the run) | 4.22.0 | Apache-2.0 | none |
| esbuild | 0.28.2 | MIT | building the path A bundle for the size measurement |
| `@tonejs/midi` | 2.0.28 | MIT | checking the MIDI files |
| Path B, onsets, synth, harness | n/a | our own code | |

The package README also mentions the GPL as an alternative licence in its
copyright paragraph; the package.json and LICENSE file say Apache-2.0, and I
treated it as Apache-2.0. Worth a second look before shipping. I did not
separately check the licence of the model weights beyond that they ship under
the package licence.

## Comparison with the band clip (a measurable proxy, not a judgment)

- Tempo. `ref-03-band.wav` (11.2 s) has 39 detected onsets with a median gap of
  0.2496 s. The onset-strength autocorrelation peaks at 0.25 s, but it is nearly
  flat at 0.5 s (0.96 of the peak) and 1.0 s (0.90), so it does not by itself pick
  the beat. If 0.25 s is an eighth note this is 120 bpm, matching the README. The
  rhythm phrase has the same 0.25 s gap. The hummed syllables run slower, about
  0.33 to 0.46 s apart.
- Pitches. Neither path gives a stable result on the band: Basic Pitch returned 76
  notes scattered over MIDI 37 to 78, and the pitch tracker found only 6 notes
  (57 at 0.40 s, then 63 at 6.19 s, and so on), because the clip is polyphonic.
  So I cannot compare the hum's contour (+5, +6, 0, 0, -4, +6, -7) with the band's
  opening contour. The first few Basic Pitch notes of the band (54, 54, 57, 55 in
  the first 0.6 s) are not a clear melody, and I did not treat them as one.

## Hosted comparison

The [frozen protocol](../spikes/j0/hosted-protocol.md) records the provider
choice and literal blind prompt. Fresh Workers AI documentation did not
establish a native audio-to-note route; ASR was not called as a substitute.
This is a documented capability gap, not proof that no route exists. The
authorized fallback was [Gemini 3.8 Flash on OpenRouter](https://openrouter.ai/google/gemini-3.8-flash),
an audio-input, text-output service. Gemini is proprietary, used as a hosted
service, not an Apache-2.0 dependency; see
[Google's service terms](https://ai.google.dev/gemini-api/terms).

One call, no retry. Only `hum-01-tune.wav` (370,518 bytes, SHA-256
`595add9d8b3b0863974b395438b6436682e3aa8253beacf2ed35ced916fc5fd8`)
was sent. The prompt gave no path B pitches, note count or timing.

| Measure | Observed result |
|---|---|
| Requested / returned model | `google/gemini-3.8-flash` / same |
| Provider returned | `Google` |
| Generation ID | `gen-1791310923-KueTerzN5I75zJArPQPq` |
| Client wall time | 5.127368 seconds, including network and server time |
| Usage | 463 prompt tokens (105 audio), 327 completion, 790 total; 0 reasoning tokens reported |
| Billed cost | $0.0015735, directly from `response.usage.cost`; not a catalog estimate |
| Finish reason | `stop` |
| Validated events | 8, all MIDI 40 (E2) |

| # | Start s | Duration s | MIDI |
|---|---|---|---|
| 1 | 0.05 | 0.25 | 40 |
| 2 | 0.55 | 0.25 | 40 |
| 3 | 1.05 | 0.24 | 40 |
| 4 | 1.45 | 0.22 | 40 |
| 5 | 1.78 | 0.22 | 40 |
| 6 | 2.14 | 0.23 | 40 |
| 7 | 2.52 | 0.25 | 40 |
| 8 | 2.92 | 0.35 | 40 |

The model describes a low E2 vocalization with rhythmic articulation. That is
its claim, not verified pitch ground truth. Its seven pitch steps are all zero,
versus path B's +5, +6, 0, 0, -4, +6, -7. Matching events by position in the
two eight-event lists gives absolute onset differences of 0.09, 0.08, 0.25,
0.19, 0.09, 0.15, 0.21 and 0.21 seconds (mean 0.159, maximum 0.25). This is
agreement between outputs, not a musical accuracy measure. All hosted pitches
are 5 to 18 semitones below path B's corresponding events.

The events passed finite value, MIDI range, chronological order, duration,
clip-boundary and 20 ms overlap checks. They were rendered unchanged, at fixed
velocity 100, with the existing synth and MIDI writer. The generated MIDI was
parsed back and all eight pitch, start, duration and velocity events matched
within its tick rounding. WAV files were decoded back with the expected sample
counts: playback 3.67 seconds, comparison 8.87 seconds, both at 44.1 kHz.
Neither of these checks establishes how the playback sounds.

The [nonsecret result record](../spikes/j0/hosted-result.json) preserves the
events and usage. The full provider response and generated playback stay local
in ignored `spikes/j0/work/out/hosted/`: `response.json`, `measurement.json`,
`validated-notes.json`, `hum-01-hosted.mid`, `hum-01-hosted-playback.wav` and
`hum-01-hosted-compare.wav`. The comparison plays the original, one second of
silence, then the model events. Credentials and request base64 were never
written to output files or git.

The hosted playback remains unjudged. This single call does not support a
claim that hosted models are better, worse in general, or recognize humming
reliably. It gives no reason to replace the path B playback Hugh accepted on
this reference. It also does not complete J0's phrase or browser requirements.

## What a person must now do to judge

Listen in this order. Each "compare" file plays the original, one second of
silence, then the playback. All are in `spikes/j0/work/out/`, which is not
committed. The original wavs are in `spikes/j0/material/`.

1. `hum-01-pathB-compare.wav`: the tune against path B's 8-note transcription.
   Hugh judged it recognizable on 2026-10-06 at 07:15.
2. `hum-01-pathA-mono-compare.wav`: the same against path A reduced to one voice.
3. `hum-01-pathA-raw-compare.wav`: path A as the model gave it, 47 notes. Expected
   to be messy; it shows what the model path needs cleaning up.
4. `hum-02-rhythm-compare.wav`: the mouth percussion against kick and snare hits.
   Question: is the rhythm recognizably the same?
5. `hosted/hum-01-hosted-compare.wav`: the tune against the hosted model's
   literal 8-note output. This new playback still needs a human judgment.

The `-playback.wav` files are the same playbacks without the original. The `.mid`
and `.json` files carry the same transcriptions.

Then the secondary phrases, by two people, in the harness:

1. From `spikes/j0/harness/`, run `python3 -m http.server 8000 --bind 127.0.0.1`
   and note its PID, so you can stop it by PID afterwards. (A page on `localhost`
   is allowed to use the microphone; a `file:` page may not be.)
2. Open `http://127.0.0.1:8000/` in Chrome. Enter your name and a label (p1 to
   p5), choose "Hummed tune", press Record, hum for 3 to 8 seconds, press Stop.
3. Press "Play the transcription" and listen. Press "recognizably the tune" or
   "not".
4. Repeat for five phrases in total across the two people, each person doing at
   least two. For a rhythm, choose "Tapped or mouthed rhythm" and tap or mouth.
5. Press "Download the log (JSON)" and keep the file, for example under
   `spikes/j0/logs/`. It holds notes, timing and answers, never audio.
6. Optional path A: choose `work/out/bp-bundle.js`, and from
   `work/node_modules/@spotify/basic-pitch/model/` the files `model.json` and
   `group1-shard1of1.bin`, in the "path A" box.

## Provisional recommendation

In the page, with path B, plus a "sing again" button. Hugh accepted its
reference playback. Keep this provisional until the five phrases by two
people have singer judgments and the actual browser path is exercised.
The hosted model's flat contour does not justify changing that direction on
the current evidence. If another singer's playback is not recognizable,
record the phrase and judgment before selecting a remedy.

## What I could not do

- The original first half did not call a hosted model. Hugh authorized this
  on 2026-10-06, and one bounded audio-capable model comparison is now done.
  Which hosted model gives recognizable playback is still unanswered: the new
  playback needs a person to judge it. No broader model sweep was performed.
- I report notes, counts and timings. Hugh's earlier path B listening judgment
  is recorded above; I do not claim a listening judgment for the hosted output.
- The microphone, the harness's buttons, WebAudio playback and the optional
  path A loader in the page were not run. What was exercised: the page's own
  inline scripts were parsed and run in a Node `vm` (no DOM), and its
  `transcribePhrase` function transcribed the three wav files: the hum gave 8
  notes (45, 50, 56, 56, 56, 52, 58, 51), the rhythm gave 18 hits at 4.1 a second,
  and the band gave 6 notes. A 48 kHz resampled copy of the hum gave the same 8
  notes (the first as 46). The synth and MIDI writers were run under Node, not in
  the page; the page's WebAudio playback is separate code.
- Done-when for J0 asks for at least five real hummed phrases by two people. I
  have one clip, from one take.

## Limits

- One clip, one singer, one take, with clear gaps between syllables. Humming
  with slurs between notes, or in a noisy room, is untested.
- Two path B parameters were set after seeing this clip.
- Pitch accuracy is not measured; there is no ground truth. "Same pitch" above
  means the two paths agree.
- Path A timings are tfjs on the CPU under Node on a loaded machine, not a page
  on WebGL.
- Download sizes are file sizes and gzip, not a network measurement.

## Files

In `spikes/j0/`: `.gitignore`, `src/transcribe.js`, `src/run-basicpitch.js`,
`src/pipeline.js`, `src/build-harness.js`, `src/harness.template.html`,
`src/test-harness-path.js`, `harness/index.html` (generated from the template and
`transcribe.js`; rebuild with `node src/build-harness.js`). In the ignored
`work/`: `node_modules`, `out/` (wavs, `.mid`, `.json`, `summary.json`, `runs/`,
`bp-bundle.js`). To rerun: `node src/run-basicpitch.js <wav> <out.json>` three
times, then `node src/pipeline.js`.

For the hosted comparison: `hosted-protocol.json`, `hosted-protocol.md`,
`hosted-result.json`, `src/run-hosted.py` and `src/render-hosted.js`. The Python
helper uses only the standard library and an exclusive local attempt marker
to prevent accidental repeat inference. Run with `python3 -I` to avoid scratch
directory module shadowing. The renderer uses only Node's built-in modules
and the existing transcription helper. Local provider responses and generated
audio are ignored; no new dependencies or Artroom source were used.

Verification for this addition: JSON parsing, Python and Node syntax,
validation rejection checks, WAV/MIDI output readback, local Markdown link
checks and `git diff --check`. This standalone jam repository has no
`package.json`, `docs/testing.md` or `npm run gate`; the Artroom gate belongs
to the parent's M4 source work. The original Node-only harness measurements
have not been relabeled as browser tests or rerun as a full suite.

# J0 test material

Primary material for spike J0 (hum to theme), per hugh's direction of
2026-10-05: the first seconds of the reference clip behind the jam demo.
The tune is a little indistinct on purpose. J0 does not need an accurate
transcription of it; it needs a plausible one, which a synth playing it
back makes recognizable as the same tune.

| File | What it is | Source timing |
|---|---|---|
| `hum-01-tune.wav` | The hummed tune, about eight syllables; builder's pitch tracker found eight notes between A2 and A sharp 3 | 0.0 to 4.2 s |
| `hum-02-rhythm.wav` | Mouth percussion, about four hits a second | 3.3 to 7.5 s |
| `ref-03-band.wav` | The keyboard track the sketch answers with, about 120 bpm | 7.5 s to the end |

Mono, 44.1 kHz, 16-bit. The files are not committed: they are an excerpt
of a published comedy sketch and stay local test material. Regenerate
them with the commands below from a scratch directory (never install
tools in a checkout):

```sh
uvx yt-dlp --no-playlist -o 'clip.%(ext)s' 'https://www.instagram.com/reel/DW3mWcACCjT/'
ffmpeg -i clip.mp4 -vn -ac 1 -ar 44100 -t 4.2 hum-01-tune.wav
ffmpeg -i clip.mp4 -vn -ac 1 -ar 44100 -ss 3.3 -t 4.2 hum-02-rhythm.wav
ffmpeg -i clip.mp4 -vn -ac 1 -ar 44100 -ss 7.5 ref-03-band.wav
```

Update, 2026-10-06 07:15: Hugh judged path B's `hum-01` playback good and
recognizable as the same tune, and did not prefer the in-page model path A.
Planner record `475c57cac0cb27cfc729915f0919c775f23e95d7` also authorized
hosted models and this reference audio leaving the machine, Workers AI first
and OpenRouter second. One OpenRouter comparison has now run under the
[frozen protocol](../hosted-protocol.md). On 2026-10-06, Hugh judged its
playback “Not recognizable”. The WAV files remain ignored local files and are not published
or committed. This is a reference phrase by a singer in the sketch, not
Hugh's voice. Reusing it with another model does not add a phrase or singer.

Secondary material: phrases hummed by people in the harness, judged by
their singers. Five such real phrases across two people and an actual browser
exercise remain owed by J0.

Correction, 2026-10-05 23:15: the planner's first description of the tune
(leaps to G sharp 2, E2 and D sharp 4) came from the loudest spectral
bin per quarter second, which picks harmonics and not the fundamental.
Builder's pitch tracker found no note outside A2 to A sharp 3. Trust the
tracker.

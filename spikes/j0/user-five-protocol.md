# J0: five supplied recordings, local protocol

Frozen on 2026-10-06 before conversion or transcription. The literal input
hashes, frame counts and measurement rules are in
[user-five-protocol.json](user-five-protocol.json). The user supplied five
distinct AIFF recordings for local path B processing. No authorization for
sending these human recordings to a provider is inferred from the earlier
reference-clip authorization.

## Whole-file handling

Metadata inspection found mono 44.1 kHz PCM: four 16-bit big-endian recordings
and one signed 8-bit recording. Their durations, in input order, are 10.365397,
8.414943, 6.650204, 10.644036 and 8.879365 seconds. Four exceed the harness's
suggested 3–8 seconds. The file-input handler and pitch tracker have no such
cap; the recording handler stops at about 12 seconds. Use one complete file
at a time, with a hard 12-second safety bound and no clipping, window splitting
or repeat transcription. These are whole supplied recordings rather than
3–8-second microphone takes in the harness.

Use the installed local FFmpeg to change the AIFF container and PCM byte order
to 16-bit WAV. Keep every frame at 44.1 kHz, mono; expand signed 8-bit samples
exactly by multiplying their integer values by 256. Apply no loudness,
noise or pitch changes. Verify every decoded WAV sample against the source
AIFF's PCM integers and assert the frozen frame count and hash. Input files
are read only. Originals, converted audio, note results and file-name mapping
stay in ignored local `work/out/user-five/` with private file permissions.

## One pass and literal playback

Call the existing `transcribeHum` once per recording, using its unchanged
defaults. It uses a 2048-sample window and 441-sample hop (46.44 ms and 10 ms).
It analyzes only complete windows; report first/last window positions and
uncovered tail frames instead of claiming every endpoint sample was analyzed.
The silence, minimum duration and confidence gates already described in J0
remain in effect. There is no pitch or note-count ground truth for these files.
Do not retune thresholds or repair the output after seeing it.

Record conversion, WAV decode, transcription and render/readback elapsed times
separately for each file; report Node timings as Node timings. Preserve
unrounded note starts, durations, MIDI pitches, original velocities, exact
pitch estimates and confidence. Validate finite times, pitches 0–127, positive
duration, bounds within the complete input, chronological order and overlap
no greater than 20 ms. If any event fails, report the failure and skip playback
rather than altering it; if there are no notes, report that honestly.

Render accepted events with the existing synth and MIDI writer, 120 bpm,
channel 0, using their original velocities. Make a playback-only WAV and a
comparison WAV containing the complete original PCM, one second of silence,
then playback. Decode both generated WAVs, check their frame counts and compare
their PCM samples to the intended arrays. Parse generated MIDI note-ons and
note-offs, checking pitches, original velocities and times within tick
rounding. Check source hashes again after processing. Do not use generated
audio or recognizability guesses as singer judgments.

Five distinct recordings now exist. Their filenames do not establish singer
identity, two people, or a judgment by each singer. The current hosted result,
Hugh's judgments on the reference and the existing Chrome reference exercise
remain unchanged. These new local Node runs add neither browser nor microphone
coverage. The root agent will present the playbacks for the singers' judgments.

## Readback-check correction

The first pass rendered its first recording before a checker assertion stopped
on JavaScript negative zero versus integer PCM zero. The PCM encoding has only
one zero; the checker now compares those as equal. This changes the verifier,
not transcription. Recover the first recording's exact note-event grid from
its saved MIDI: starts are on the existing window-center minus half-hop grid,
durations on the 10 ms hop grid, and pitches/velocities are MIDI integers.
Require byte-identical MIDI and sample-identical synthesized playback readback
before accepting the recovered events. Its unrounded pitch estimates,
confidence and initial elapsed times were not journaled before the exception
and remain unavailable. Do not infer them or rerun transcription.

Journal every subsequent literal transcription before rendering. A single
explicit resume from validated local journals processes only the remaining
four files. The first attempt marker is retained, and all five source hashes
are checked again. This preserves one tracker call per supplied recording.

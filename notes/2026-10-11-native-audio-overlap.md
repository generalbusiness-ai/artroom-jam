# Notes and release tails continue across native audio frames

Request `186b4a6d9de9d1bb5012eadce7dc52a1268d9bb8`, builder promise
`40339b4a18b8a9afa646b9ac525b4cd2b88523d9`, follows source
`654e57098eff014e6d48b7d4c766bffa2a8f3d1f`.

`nativeBar` previously selected notes whose declared start lay in the requested
bar. It clipped their waveforms at the frame end and omitted those notes in the
following frame. A supported positive `late` offset could move an onset beyond
that first frame entirely.

The renderer now mixes every overlapping occurrence of the current native
pattern, including prior-bar notes and tails from an earlier loop. It renders
each whole waveform at the original onset tempo, then selects the frame's
samples. Envelope, glide, filter, and echo state therefore follow the original
onset. The current pattern, release, solo gain, replay requirement, codec, and
one-bar output size stay unchanged. The existing pattern and tempo bounds limit
how many prior occurrences can overlap a frame.

One focused structural audio case compares adjacent frames against complete
note waveforms. It covers a held glide, a release across the pattern loop, and
an accepted last-step delay beyond the preceding frame. The case retains
invalid-pattern refusals. Existing pure codec and replay coverage tests are
unchanged.

Source review comes before execution. This note records no compiler, test,
waveform output, listening, browser, native replay, model, provider, recording,
or full Jam acceptance result. The fixture report is structural input, not
native authority.

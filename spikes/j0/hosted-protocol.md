# J0 hosted comparison protocol

Frozen before remote inference on 2026-10-06. The literal prompt, audio hash,
parameters and call limits are in [hosted-protocol.json](hosted-protocol.json).
Track this work under J0 request `9ce8533f0fe1d8eefa0e7e864dc860f3b3969c35`,
promise `42eb00945fd0efa10b224ec64444f32675219771`.

Hugh judged path B's playback recognizable as the same tune on 2026-10-06
at 07:15, and did not prefer the in-page model path A. Planner record
`475c57cac0cb27cfc729915f0919c775f23e95d7` authorizes hosted models and sending
this reference clip off the machine, with Workers AI first and OpenRouter
second. This run uses one reference phrase from a published sketch, not Hugh's
voice. Extra model calls would not create extra phrases or singers.

## Provider choice

The [Workers AI catalog](https://developers.cloudflare.com/workers-ai/models/)
documents ASR models, TTS models and a turn detector. I could not establish a
documented native audio-to-note route. The hosted
[Gemma 4 26B model](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/)
has vision; its generic `audio` parameter describes output, not audio input.
Google documents native audio on
[Gemma E2B, E4B and 12B](https://ai.google.dev/gemma/docs/core).
The [GLM Flash page](https://developers.cloudflare.com/workers-ai/models/glm-5.3-flash/)
also does not establish audio input. This is a documentation capability gap,
not proof that no such Cloudflare route exists. ASR is not a pitch transcriber,
so no ASR call will stand in for the requested comparison.

Fallback: [Gemini 3.8 Flash on OpenRouter](https://openrouter.ai/google/gemini-3.8-flash).
The fresh public catalog reports audio input and text output, JSON schema,
temperature, reasoning and max-token controls. Catalog prices are $0.75 per
million prompt/audio tokens and $3.75 per million completion tokens; they are
not the measured bill. The
[OpenRouter audio API](https://openrouter.ai/docs/guides/overview/multimodal/audio)
accepts base64 WAV in an `input_audio` block at chat completions. Google's
[audio documentation](https://ai.google.dev/gemini-api/docs/audio) lists WAV.
Gemini is a proprietary hosted service, not an Apache-2.0 dependency or model
weight download. [Google's Gemini service terms](https://ai.google.dev/gemini-api/terms)
are distinct from this repository's code licence; the Apache footer on a
documentation page does not license Gemini weights.

## Measurement and claims

Send only the reference WAV and the frozen blind prompt. The prompt contains
no earlier path's pitch list, count or timing. Use one inference call, capped
at 3,000 output tokens and 120 seconds, with no blind retry. Capture the full
response locally, model, provider, generation ID, wall time and usage. Use
`usage.cost` when present; otherwise query the documented
[generation metadata API](https://openrouter.ai/docs/api/api-reference/generations/get-request-&-usage-metadata-for-a-generation)
at most twice for `total_cost`. Keep credentials and the request's base64 audio
out of files, logs and git. Audio and provider response stay in ignored `work/`.

Reject malformed or empty events for playback rather than inventing notes.
Check finite numeric values, MIDI integer 0–127, positive durations,
chronological starts, events within 4.2 seconds, and monophonic overlap no
greater than 20 ms. Do not repair pitches or alter count after seeing results.
For accepted events use the existing synth and MIDI writer with fixed velocity
100, 120 bpm, and a comparison WAV (original, one second silence, playback).
Read back WAV and MIDI events locally. Compare pitch and onset agreement to
the previously observed path B output only after inference.

The result can establish that this model returned playable note events, its
single-call latency, bill and objective agreement. It cannot establish musical
accuracy or recognizability. A person must listen to the hosted playback.
Five real phrases by at least two people, singer judgments and an actual
browser exercise remain owed by the full J0 spike.

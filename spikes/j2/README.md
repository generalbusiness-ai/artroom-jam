# J2 local harness preparation

This is the scripted preparation of J2 under request
`afc4b13be1645af051152fd44d6c742d5ff7e8c5`, promise
`748778702d4144a20f8ef85f78ee84374eb2402b`.

The [protocol](protocol.json) freezes the founding lookahead, instrument
order, synthetic submission and delivery times, and timing expectations
before the first run. Its basis is Jam revision 9 at
`8f383e04db38f6dfa3ad6646f4d351da4676f050`,
`notes/2026-10-01-jam-room.md`, sections 2, 5 and 10, adopted by
`2b3d09467a7eff74350767e6729b5aa921a4b4c5`.

Every player, commit clock, delivery and interpretation in this preparation
is scripted. Themes will be synthetic application-owned note events; no
private humming or reference recording is an input. Timing results from
this setup describe the simulation, not agents or a deployed Artroom.

Full J2 still needs an authorized actual four-agent run, measured model
latency/calls/cost, its recording, and Hugh's judgment of whether it is
worth hearing. The budget remains two revisions to the harness and prompts;
missing timing claims are reported separately from musical judgment.
Synthetic render quality is unjudged. J1 retains its deployed-room
prerequisite, and hosted development needs an actual deployment and
destination publication to a real Git host.

## Run and inspect

No packages are needed. Run from the Jam repository with Node:

```sh
node --test spikes/j2/test/harness.test.mjs
node spikes/j2/control.mjs
node spikes/j2/run.mjs scripted-run-1
```

The runner creates an exclusive directory under `spikes/j2/work/`, ignored
by Git. An existing run name is refused. It keeps copies of the protocol
and themes, `record.json`, `summary.json` and `synthetic.wav`. The summary
names the protocol's SHA-256 and reports each timing claim independently.
Audio is synthesized from the two fixtures; no source audio is read.

[themes.json](themes.json) holds two made-up tunes with J0-shaped note
events: start and duration in seconds, MIDI pitch and velocity. Their key
and tempo are explicitly scripted metadata, not estimates from a model.
[players.mjs](players.mjs) holds the four prompts and deterministic
interpretation/phrase adapters. Their transformations make simple fixture
parts and demonstrate neither composition quality nor actual agents.

## Recorded inputs and derived timing

[harness.mjs](harness.mjs) records simulated `sing`, instrument `take`,
`interpret` and `pattern` entries in sequence, along with each listener's
delivery time and each player's symbolic perception. Delivery readers
consume only a contiguous received prefix, including the inputs that
establish the transport. These are unsigned simulation records, outside
Artroom; no scope admits them, grants no authority and verifies no ledger.

The first `interpret` entry's time establishes bar 1. The initial theme
and instrument takes precede the transport and have no assigned bar.
[schedule.mjs](schedule.mjs) implements section 2's calculation after that
origin: use lower-sequence tempo segments, choose the highest-sequence
active lookahead, round up to a boundary and hold it to the preceding
entry's bar. A change uses the preceding active configuration for its own
bar. A tempo segment starts at that existing boundary; higher sequence
wins a tie. The supported inputs are integer millisecond times, positive
integer quarter-note BPM and two positive integer meter components.
Boundaries use rational arithmetic, so rounding is exact at 90 BPM too.

Entries hold no start/effect bar. Derived bars and tempo segments live in
the summary, separate from the retained entry inputs. A pattern names its
interpretation. Fresh readers and listeners derive the same bars; a
pending interpretation cannot make its pattern start earlier. Perception
includes active and pending interpretations/lookahead, musical position,
recent parts and instrument holders. Solo and banter are empty in this
fixture; their agent loops are not built by this preparation.

[render.mjs](render.mjs) uses Jam's existing J0 synths and WAV encoder.
Each part changes at its derived replacement boundary, including the old
part's release tail. The mix uses the frozen gain and sample/time bounds.
Readback checks the WAV format and sample count, not musical quality.

## Verification boundary

The one [coupled witness](test/harness.test.mjs) independently expects
first patterns on bar 3 at 4100 ms and all four second-theme patterns on
bar 6 at 10100 ms, across a change from 120 to 90 BPM. It checks each
listener's old/new interpretation immediately around that boundary and
compares incremental reads with a fresh history read. The same witness
uses section 2's manually worked decrease/increase and two-pending-change
examples to distinguish active from pending values and the preceding-entry
hold. These are synthetic histories, not runtime or network evidence.

[control.mjs](control.mjs) changes rounding and the preceding-entry hold,
one at a time in a scratch copy, and requires the unchanged witness to
fail by assertion. It retains that scratch evidence and changes no checkout
source. The test also exercises a labelled fake invoker at the future
model recording boundary, and checks the synthetic render's finite bound
and peak. There is no project `package.json` or gate in this Jam repository.

## Future model measurements

`measuredModelAdapter` takes a caller-supplied, later-authorized invoker.
Each call records player, purpose, start, latency, named clock, answer or
failure status, returned model identity and cost as amount/currency or
`null` when unknown. Call count comes from its attempt journal; combine
that with the stated run interval for calls per minute. This preparation
supplies no provider implementation or model choice. Its scripted run
uses no invoker and reports actual model metrics and Hugh's musical
judgment as unavailable. No provider credentials, uploads, browser,
deployment, package publication or Artroom source imports are involved.

## First retained scripted run

The protocol was frozen in commit
`ddab4962c0655378c0b97022c9ed8ef79b3ae575` before the run. Its SHA-256 is
`2016bbb82a679b5cb8bc573cfa8336adcc781a98d7226a3a0d7511f16503d1a0`.
The [retained summary](evidence/scripted-summary.json) records the one
`scripted-run-1` execution. The [verification log](evidence/verification.txt)
keeps the focused witness and both distinguishing controls, commands and
separate process elapsed/CPU figures. These are local Node runs on a shared
Apple M5 Max under macOS, Node v26.10.0, with existing local source and no
setup, dependency downloads or controlled cache/load conditions.

Eight patterns were delivered to four simulated listeners: 32 deliveries,
all before their start bars. The first theme's patterns share bar 3 at
4100 ms, 4100 ms after its simulated stop. The second theme's patterns
share bar 6 at 10100 ms, 3900 ms after its simulated stop. The scripted
tempo changes from 120 to 90 BPM on that boundary. These calculated delays
meet the frozen 95% and 8000 ms expectations for this fixture; they measure
no real model, client, network, scope or audio-device latency.

The generated WAV has 454231 mono samples at 22050 Hz, about 20.60 seconds;
the pre-encoding peak is about 0.1764 under the frozen gain. Format and
sample-count readback passed. The one observed local render wall time was
22.97 ms, including synthesis and the runner's WAV write; it is not an
inference or live playback measurement. The actual audio and full
simulation record stay in ignored `work/scripted-run-1/`. The summary
records their SHA-256 identities for local review. No listening judgment
was made and no browser playback was exercised.

This repository's clean external source head, native diff from accepted
J0, this primary README, the protocol, summary and verification log are the
source/evidence review inputs. Root files them under the separate evidence-only
Artroom request; no Artroom-main source artifact or hosted support is
activated. Independent ordinary exact source/evidence review remains owed.

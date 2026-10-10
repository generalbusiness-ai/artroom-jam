# First recorded Jam contribution model

Source preparation under Artroom request `c4df615a8586bbafc8a7086449efbcd546efff00`, promise `b0321713567a60523d6f90a82c67391816c28de9`, following builder readiness judgment `5f70864c8ec5381a1727c4cc8db25b623b9b05df`. Base is Jam `990dcbf3ffd15d44c9fccdd88c671866dd5e7218`. This note describes an unexecuted first source task, not native integration, review approval, audible acceptance, self-hosting or a release.

The existing procedural demo already exists. Its two original symbolic tunes, authored rhythm, local scheduling, players, histories and audio code are unchanged. `src/record.ts` remains the local demonstration model, called **demo-local-v0** here for clarity. No existing record is migrated. The new declaration, codec and reducer are separate source for the intended recorded application. Both remain application code; no Artroom source, workspace link or local tarball is imported.

## Contributions and their native boundary

`definitions/jam-contributions-v1.json` proposes one immutable declaration under the existing `artroom-definition-1` / `restricted@1` contract, with no capabilities or platform marks. Its four acts are:

- `establish`: one untimed configuration, trusted opener/controller, selected interpreter MemberRef, positive lookahead.
- `sing`: a named tune or rhythm contribution, with exactly one nonempty bounded note/onset branch, retained original timing and author.
- `interpret`: that contribution's one pending-to-final transition, by the configured interpreter under `jam.interpret`; a rhythm preserves the recorded tune basis.
- `set-lookahead`: an authorized controller changes recorded lookahead after transport starts. The projection derives when that change becomes active.

The live contribution bound is 64; interpreted contributions are final and release that live slot. Their original notes/onsets and history remain retained under native storage/admission limits. The declaration neither promises unlimited history nor evicts old contributions. A refusal does not become a musical cue. This first source does not yet declare instrument claims, patterns, solos, moods or banter, and cannot replace the complete Jam story.

The declaration is **not validated**. Its literal contract forms were read statically, but only the future supported public validator/native path can establish executable pins, reservation sizes, shape/guard behavior, configured interpreter ownership and grants. The factory never implicitly grants Jam actions. The interpreter's MemberRef must be legitimately configured in the actual membership; this source supplies no enrollment or proof of standing. The codec is a stricter application input boundary in places, including the derived key label; shape-valid native fields alone are not a certificate of musical meaning.

## Versioned integer score

`src/contributions.ts` owns **jam-score-1**. Raw starts, durations and onsets are microseconds. Tempo is milli-BPM, bounded 60000..180000. Pattern step/swing utility uses millionths of one sixteenth step; `0.6` becomes `600000`. Musical interpretation remains the existing 4/4 grid with four sixteenths per beat, bounded to 16 bars and 64 theme/rhythm events. Raw contributions are bounded to 64 events and 60 seconds; note ends must fit that span. Pitch and velocity remain MIDI integers 0..127.

Conversion computes an integer candidate and admits it only when it is safe, bounded and dividing by the unit returns the exact original number. It never silently rounds, clips, sorts, drops unknown input fields or rewrites the original arrays. A nonrepresentable input such as a one-third-second onset is an explicit refusal. Current original values `0.35`, `0.7`, `0.25` and `0.5` have their exact decimal-unit representations; the one symbolic witness checks roundtrip preservation. No sound or transcription is fabricated.

The interpreter's intentional quantization is still its musical interpretation. Lossless transport is a different operation. The step utility does not claim that every arbitrary floating filter/density/generated pattern value is transportable; complete pattern/timbre representation remains later application work. Local audio math can remain floating point.

The codec reads closed structured values, not a second JSON/canonical/signature implementation. Future native facade input uses the supported public parser/canonical bytes, exact native declaration and retained request custody. Native authorities still decide whether a shaped request takes effect.

## Recorded time and active time

`src/recorded.ts` owns **jam-recorded-v1**, separate from the existing bar-valued lookahead and bar-zero local demo. It consumes a complete bounded modeled history. A future public facade must supply each verified native entry sequence/time, exact accepted FactRef, declaration/application provenance and its decoded act. The fact is generic and opaque here; this module neither invents nor verifies native admission. The `interpret.sing` input names the contribution opened by its actual native entry/item identity, which that facade must check.

The first accepted interpretation's fact is transport origin and bar 1. Before it, establishment and sing cues have no effect bar. Subsequent cues use the native commit time, the tempo schedule of lower sequence, and the lookahead change that has become active at its own derived boundary. Pending lookahead changes do not affect earlier entries. A new effect bar is at least the previous entry's effect bar; it never changes afterwards. Tempo changes retain their existing assigned boundary and alter only following bar durations. Higher-sequence changes on the same bar win there. Rhythm may begin a run using the explicit founding empty A-minor basis, which matches the existing local interpreter default.

All scheduling comparisons use exact rational arithmetic in the local reducer. BigInt is internal only and never enters an act or Artroom canonical value. Output rational time is a numerator/denominator string pair measured in microseconds from transport origin. No epsilon, wall clock, latest settings, listener buffer or author-supplied effect bar determines a recorded cue.

The first reducer accepts at most 256 entries in one 24-hour modeled run and at most 64 pending contributions. It rejects incomplete/gapped/time-reversed or over-bound input rather than truncating it. This is an explicit first-task projection limit, not an assertion that the native scope has this retention policy. Later full-history paging/checkpoint work must preserve all scheduling inputs. Lookahead changes before a run starts are outside this first model; establish configures the positive initial value. The declaration makes that limitation explicit with its started guard.

## One meaningful symbolic witness

`test/contributions.test.ts` is authored but **has not run**. Its single case uses both retained original tunes and the authored rhythm, checks exact integer roundtrips without mutating them, then follows the adopted revision-8 lookahead decrease/increase example through made-up full-shaped fact references. Those references have no native scope or authority behind them. The case distinguishes pending configuration from active configuration, a later cue held behind an earlier cue, prefix preservation, rhythm changing the tune, repeated interpretation, and a future lower tempo retaining its assigned boundary. It makes no audio, host or native claim.

The later affected check is this one Node case, plus source syntax/type checking supported by the project's eventual public dependency release. There is no per-field test series or new test framework. A narrow control could remove exact decode equality and rerun the same case; the one-third-second refusal must distinguish. A second control could apply pending lookahead immediately and rerun the same case; the 10.5-second cue must distinguish. These are plans only. The owning builder coordinates execution and ordinary source review; no whole audio suite or Artroom gate is warranted for this isolated application source task.

## Dependencies and remaining acceptance

Public npm reads on 9 October returned 404 for `@generalbusiness/artroom-client`, `artroom-contract`, `artroom-bytes` and `artroom-derive`. Workspace `0.1.0-dev.1` and parked earlier-model tarballs are not a supported current public release. N3 request `f3299ab4b2bf553f2a221a353a7cb75f04cbd5c6`, with release/operator and installation owners, owes an actually consumable coordinated exact version/export/validator route. A later version such as `0.1.0-dev.2` is merely a proposed allocation until that owner reserves and publishes it. Pin the release's actual version/integrities, never a checkout link or guessed availability.

Native attachment depends on the initial/F1 delivery `60e59173a14827d5017d89e217a6c8e2cf8d3cde`: validated activated declaration, actual generic establishment, confirmed created full lane reference/pin, authorized member/agent grants and an actual deployed room URL. F1's application factory source is not a hosted Jam deployment. Its establishment grant is separate from `jam.sing`, `jam.interpret`, `jam.rules` and the declaration's opener grant.

Ordinary Jam source review/publication waits for Artroom hosting under this repository's instructions. Native lost-reply/reload/session/device custody, complete musical acts, real human hum, model-backed agents, actual local sound, listening and Hugh's worth-hearing judgment remain open. The original 40-second clip's symbolic checks cannot satisfy them. No README status, old design snapshot, whole M1/UX completion or cleared backlog becomes a new blanket first-task gate.

No dependency, lockfile, original fixture, existing history, player, audio code or page changed. No tests, project imports, compiler, generation/build, native execution, audio/browser/provider calls, install, public package publication or review approval occurred during this source preparation.

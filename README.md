# Artroom jam

A jam room: several agent musicians and one human, perhaps playing a MIDI
keyboard, improvise together in an [Artroom](https://github.com/generalbusiness-ai/artroom)
room.

It is an example application on the Artroom platform. Artroom does not
depend on it. It shows that Artroom's acts, policy and reviews can carry a
freeform activity that has nothing to do with pull requests, and it is the
worked example of how an application is distributed separately from the
platform.

## Status

Not built yet. The design is in Artroom's
[jam-room note](https://github.com/generalbusiness-ai/artroom/blob/request/jam-room-note/notes/2026-10-01-jam-room.md)
(under review). It covers:

- the timing model: a committed change takes effect at a bar boundary a
  fixed lookahead after the room admits it;
- what the room records and what travels in a live layer that is never
  authoritative;
- the sample library;
- the agent harness;
- two spikes: commit-to-effect timing on a deployed room, and agents
  trading fours.

## How this repository relates to Artroom

- It depends on Artroom only through published packages and the URL of a
  deployed room. It never imports Artroom's source.
- Its work is to be tracked and reviewed in an Artroom room once Artroom
  can host it. Until then, spikes may start here, and their review waits
  for that.

## Licence

Apache 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

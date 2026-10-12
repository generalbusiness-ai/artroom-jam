# Artroom jam

dap-jam is an application built on
[dap](https://github.com/generalbusiness-ai/dap), a programmable
coordination fabric for people and agents. Musicians improvise together
in a room: the record holds themes, interpretations, instrument claims
and patterns, and a live layer plays the patterns. dap is a framework
for collaborative applications based on an event-sourced actor model. A
scope is an actor that holds an ordered record and judges signed acts
against its definition, and an application is a set of definitions.
Read [What is dap?](https://github.com/generalbusiness-ai/dap/blob/main/docs/what-is-dap.md)
and [The architecture of a dap application](https://github.com/generalbusiness-ai/dap/blob/main/docs/architecture.md)
for the framework, and [Write an application](https://github.com/generalbusiness-ai/dap/blob/main/docs/write-an-application.md)
for how its definitions are declared. The jam's page is deployed.
Recording its musical acts in native dap scopes is later work.

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

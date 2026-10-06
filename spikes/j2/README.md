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

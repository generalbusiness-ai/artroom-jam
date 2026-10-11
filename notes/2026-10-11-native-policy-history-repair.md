# Native solo and history corrections

This source successor starts from native Jam
`654e57098eff014e6d48b7d4c766bffa2a8f3d1f`. The reviewed predecessor stays
unchanged. These repairs address two checker requests in the Artroom room:

- `git:sha1:589bca982736a2361d15d53f7572375ef2f7aaf3#git:sha1:48633ee979e81c77ccae906ecaf249f12d492f59`,
  under promise `git:sha1:589bca982736a2361d15d53f7572375ef2f7aaf3#git:sha1:1c38db547c9ccad59ab8694db16d53693e62eab8`.
- `git:sha1:589bca982736a2361d15d53f7572375ef2f7aaf3#git:sha1:dbe5b0dd8e8d981c863718d6af4483d682e3c4dc`,
  under promise `git:sha1:589bca982736a2361d15d53f7572375ef2f7aaf3#git:sha1:f390b4936f2df48f7f37ed997dacb43b77ef7d2b`.

The solo rule now reads the literal `also.configuration` subject key that
the SDK prepares. The configured limit and every other solo guard stay in
place. The added witness prepares and evaluates the actual declaration's
rule, then judges a solo at the configured eight-bar limit and a nine-bar
refusal. It uses the staged SDK's labelled in-memory fixture and test
grants. It does not prove deployed authority.

History now follows a successful incomplete page when it has a nonempty
string continuation cursor. An incomplete terminal page still refuses.
Frontier, repeated-cursor, position, hash, signature, budget, creation,
confirmation, and replay checks remain in place. The added witness passes
201 signed, hashed fixture entries through the real SDK handle and the
application's history reader, across the native 200-entry page boundary.
It also refuses an incomplete terminal response and an empty cursor. The
transport and parent provenance are scripted. Replay remains unconfigured,
so the witness produces no playable cues.

The earlier declaration digest in the staged SDK note describes its exact
historical source. This correction changes the declaration bytes. No new
digest, validation, native pin, or activation is claimed. Runtime callers
compute the digest of the declaration they load; they do not carry a fixed
old digest. The six staged SDK archives, lock, deployment configuration,
and historical evidence remain unchanged.

At this source freeze, both new cases, compiler checks, declaration
validation, and the affected build are unrun. Independent source review
and owner-released focused checks are next. Full native Jam, provider,
browser, audio, recording, and musical judgment obligations remain open.

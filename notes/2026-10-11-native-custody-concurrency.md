# Late Jam model answers keep their original custody

Request: `003082fb84aab46b58764208ac75a24346d3e3a2`.
Builder promise: `4f75177232594aa2a033133a3e946244f1a7676e`.
The source starts from the frozen native integration `654e57098eff014e6d48b7d4c766bffa2a8f3d1f`.

`BrowserCustody.save` previously allowed an older model callback to replace a
newer terminal active request. A stale same-original update could also replace
a known provider proposal with an unknown outcome.

The store now records a revision. A new active original requires the captured
revision and active signed envelope to match inside the IndexedDB transaction.
An unknown original still blocks a different signature. Existing stored rows
start at revision zero. No original is evicted.

Updates to an existing original merge into its current or archived row.
They cannot reactivate archived work, change its signed envelope, grants, or
`beside`, remove its recorded receipt, or erase a known provider proposal.
The same private store retains late answers. `loadOriginal` reads that history
without changing the active row.

The browser captures a version before saving a new signed request. Loaded
originals carry their observed version into later saves. The model follow-up
also checks the original inside the existing Web Lock, after a late proposal
has been retained in its own history.

The new single-case witness uses the production transaction's `custodyWrite`
transition. It scripts two pages, genuine SDK-signed envelopes, and synthetic
receipts and storage. It checks both a late model reply after a newer terminal
follow-up and an unknown write after a known proposal. It also checks stale new
activation, an unknown original, and unchanged envelope attachments.

All checks remain unrun at this source freeze. This slice changes no declaration,
native authority, provider request, deployment, or procedural page. Real
IndexedDB and browser acceptance require their own evidence.

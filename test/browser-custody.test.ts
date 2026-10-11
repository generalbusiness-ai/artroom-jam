import test from 'node:test';
import assert from 'node:assert/strict';
import type {Receipt, ScopeRef} from '@generalbusiness/artroom-contract';
import {b64url, digestBytes, intentDigest, newIncarnation, scopeIdOf} from '@generalbusiness/artroom-bytes';
import {secretSigner, signedIntent} from '@generalbusiness/artroom-client';
import {custodyWrite, type CustodyRow, type CustodyVersion} from '../src/browser-custody.ts';
import type {PendingIntent} from '../src/native.ts';

test('two pages keep late model answers in their original history and cannot regress a known proposal (scripted storage, no native or browser authority)', async () => {
  const digest = digestBytes(new Uint8Array([1]));
  const ref: ScopeRef = {scope: scopeIdOf({v: 1, kind: 'lane', definition: digest, creator: null, cause: digest, ordinal: 0}), inc: newIncarnation(new Uint8Array(16)), kind: 'lane'};
  const signer = secretSigner(new Uint8Array(32).fill(1));
  const original = async (kind: string, n: number): Promise<PendingIntent> => ({
    signed: await signedIntent(signer, {to: ref, kind}, {now: 1700000000000, idempotencyKey: b64url(new Uint8Array(16).fill(n))}), grants: [], beside: {},
  });
  // Signed envelopes are genuine. These receipt values only script storage state,
  // and do not prove native admission or authorize a dispatch.
  const receipt = (value: PendingIntent, seq: number): Receipt => ({fact: {at: ref, seq, hash: digest}, definition: digest, intent: intentDigest(value.signed.intent), effects: [], sends: [], epoch: 0});
  const capture = (row: CustodyRow): CustodyVersion => ({revision: row.revision ?? 0, original: row.active ? JSON.stringify(row.active.signed) : null});
  const read = (row: CustodyRow) => structuredClone(row.active!);
  const m = await original('musician-request', 1), followup = await original('interpret', 2), another = await original('pattern', 3);
  let row: CustodyRow = {revision: 0, active: null, history: []};
  row = custodyWrite(row, m, capture(row));
  row = custodyWrite(row, {...m, receipt: receipt(m, 1)}, capture(row));
  const pageA = {original: read(row), version: capture(row)};
  row = custodyWrite(row, {...pageA.original, provider: {status: 'unknown'}}, pageA.version);
  const pageB = {original: read(row), version: capture(row)};
  const proposal = {notes: 'scripted bounded proposal'};
  row = custodyWrite(row, {...pageB.original, provider: {status: 'proposed', proposal}}, pageB.version);
  // A stale same-M uncertainty write cannot erase the already known proposal.
  row = custodyWrite(row, {...pageA.original, provider: {status: 'unknown'}}, pageA.version);
  assert.deepEqual(row.active!.provider, {status: 'proposed', proposal});
  assert.deepEqual(row.active!.receipt, receipt(m, 1));
  const beforeFollowup = capture(row);
  row = custodyWrite(row, followup, beforeFollowup);
  const unknownFollowup = JSON.stringify(row);
  assert.throws(() => custodyWrite(row, another, capture(row)), /unknown original/);
  assert.equal(JSON.stringify(row), unknownFollowup);
  row = custodyWrite(row, {...followup, receipt: receipt(followup, 2)}, capture(row));
  const newerTerminal = structuredClone(row.active), previousRevision = row.revision!;
  // Page A's delayed provider reply belongs to M, never to the newer follow-up.
  row = custodyWrite(row, {...pageA.original, provider: {status: 'proposed', proposal}}, pageA.version);
  assert.deepEqual(row.active, newerTerminal);
  assert.ok(row.revision! > previousRevision);
  assert.equal(row.history.length, 1);
  assert.deepEqual(row.history[0]!.signed, m.signed);
  assert.deepEqual(row.history[0]!.grants, m.grants);
  assert.deepEqual(row.history[0]!.beside, m.beside);
  assert.deepEqual(row.history[0]!.provider, {status: 'proposed', proposal});
  assert.deepEqual(row.history[0]!.receipt, receipt(m, 1));
  row = custodyWrite(row, {...pageA.original, provider: {status: 'unknown'}}, pageA.version);
  assert.deepEqual(row.active, newerTerminal);
  assert.deepEqual(row.history[0]!.provider, {status: 'proposed', proposal});
  const retained = JSON.stringify(row);
  assert.throws(() => custodyWrite(row, another, beforeFollowup), /active original changed/);
  assert.throws(() => custodyWrite(row, {...pageA.original, beside: {texts: ['changed']}}, pageA.version), /exact original envelope/);
  assert.equal(JSON.stringify(row), retained);
});

/** Native identity/provenance adapter. Reads public SDK interfaces, never a local
 * Artroom checkout. Integrity and native admission are distinct from full replay. */
import type { Entry, FactRef, ScopeRef, Sealed, SignedIntent, Grant, Beside, Receipt, DeclaredDefinition, Digest, Answer } from '@generalbusiness/artroom-contract';
import { canonicalize, canonicalBytes, isDigest, definitionDigest, entryHash, factRefOf, scopeIdOf, timeMs, verifySignedIntent, isSignedIntentShape, isGrant, isReceipt } from '@generalbusiness/artroom-bytes';
import { ScopeHandle } from '@generalbusiness/artroom-client';
import { decodeContribution, validateInterpretation, type Contribution, type ScoreInterpretation } from './contributions-v2.ts';
import {decodePattern,type ScoreEvent} from './patterns-v2.ts';
import { recordedSchedule, type RecordedInput, type RecordedAct } from './recorded-v2.ts';

export class NativeHistoryError extends Error { override readonly name = 'NativeHistoryError'; }
const refuse = (why: string): never => { throw new NativeHistoryError(why); };
const same = (a: unknown, b: unknown) => canonicalize(a) === canonicalize(b);
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const parts = ['synth','percussion','lead','bass'];
const text = (x: unknown): x is string => typeof x === 'string' && new TextEncoder().encode(x).length <= 512;
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export interface NativeRoom {
  ref: ScopeRef;
  pin: Digest;
  declaration: DeclaredDefinition;
  handle: ScopeHandle;
  /** Authenticated handles on creators; never resolved from an arbitrary URL in history. */
  creator: (ref: ScopeRef) => ScopeHandle;
}
function checked(sealed: Sealed, scope: ScopeRef, seq: number): Entry {
  const e = sealed.entry;
  if (!same(e.at, scope) || e.seq !== seq || entryHash(e) !== sealed.hash) return refuse('Native entry identity/hash mismatch');
  if (timeMs(e.time) === null) return refuse('Native entry time is not canonical');
  return e;
}
function index(value: unknown, entries: readonly Entry[]): number {
  if (integer(value) && entries[value]) return value;
  if (object(value) && integer(value['seq']) && entries[value['seq']] && same(value, factRefOf(entries[value['seq']]!))) return value['seq'];
  return refuse('A musical reference is not an entry of this native history');
}
function act(entry: Entry, entries: readonly Entry[], ref: ScopeRef): RecordedAct {
  const input = entry.input;
  if (input.type === 'genesis') {
    if (entry.seq !== 0 || input.kind !== 'establish' || input.decision !== 'applied' || !input.message || !object(input.message.body) || !object(input.message.body['fields'])) return refuse('Not an applied Jam genesis');
    const n = input.message.body['fields']['lookaheadMs'];
    if (!integer(n)) return refuse('Missing founding lookahead');
    return { kind: 'establish', lookaheadMs: n };
  }
  if (input.type === 'delivery' && input.message.class === 'control' && input.message.type === 'confirm') {
    if (!same(input.message.genesis, factRefOf(entries[0]!)) || !entry.effects.some(e => e.effect === 'activate') || entry.effects.some(e => e.effect !== 'activate')) return refuse('Unexpected native confirmation');
    return { kind: 'native-only' };
  }
  if (input.type === 'timed' && input.rule === 'solo-expired' && entry.effects.every(e => e.effect === 'state' && e.item === input.item && e.state === 'ended')) return {kind:'music',name:'end-solo',fields:{},actor:'native-timer',target:input.item};
  if (input.type !== 'act') return refuse('Unsupported native entry; history was not filtered or renumbered');
  const signed = input.signed, fields = signed.intent.fields;
  if (!same(signed.intent.to, ref)) return refuse('Signed act targets another incarnation');
  switch (signed.intent.kind) {
    case 'sing': {
      const {audioDigest,...score}=fields;
      if (audioDigest !== undefined && !isDigest(audioDigest)) return refuse('Invalid captured-audio digest');
      const value = score as unknown as Contribution;
      decodeContribution(value);
      if (!entry.effects.some(e => e.effect === 'open' && e.item === entry.seq && e.type === 'contribution')) return refuse('Sing did not open its native contribution');
      return { kind: 'sing', contribution: value };
    }
    case 'interpret': {
      const sing = index(signed.intent.on, entries), interpretation = fields as unknown as ScoreInterpretation;
      const earlier = entries[sing]!.input;
      if (sing >= entry.seq || earlier.type !== 'act' || earlier.signed.intent.kind !== 'sing') return refuse('Interpretation does not name a prior contribution');
      validateInterpretation(interpretation);
      if (!entry.effects.some(e => e.effect === 'state' && e.item === sing && e.state === 'interpreted')) return refuse('Interpretation has no native final transition');
      return { kind: 'interpret', sing, interpretation };
    }
    case 'set-lookahead':
      if (!integer(fields['lookaheadMs'])) return refuse('Invalid recorded lookahead');
      return { kind: 'set-lookahead', lookaheadMs: fields['lookaheadMs'] };
    case 'musician-request':
      if (!entry.effects.some(e => e.effect === 'open' && e.item === entry.seq && e.type === 'model-request')) return refuse('Model request was not natively admitted');
      return {kind:'native-only'};
    case 'take':
      if (!parts.includes(String(fields['part'])) || !entry.effects.some(e => e.effect === 'open' && e.type === 'instrument' && e.item === entry.seq)) return refuse('Invalid native instrument opening');
      return {kind:'music', name:'take', fields, actor:signed.intent.actor, target:signed.intent.on};
    case 'pattern': {
      const follows = index(fields['follows'], entries);
      if (!integer(fields['instrument']) || follows >= entry.seq || entries[follows]!.input.type !== 'act' || !entry.effects.some(e => e.effect === 'open' && e.type === 'pattern' && e.item === entry.seq)) return refuse('Invalid native pattern references');
      const followed = entries[follows]!.input;
      if (followed.type !== 'act' || followed.signed.intent.kind !== 'interpret') return refuse('Pattern follows no interpretation');
      decodePattern(fields['bars'] as number, fields['events'] as unknown as ScoreEvent[]);
      return {kind:'music',name:'pattern',fields,actor:signed.intent.actor,target:signed.intent.on};
    }
    case 'solo':
      if (!integer(fields['instrument']) || !integer(fields['bars']) || fields['bars'] < 1 || fields['bars'] > 16 || !entry.effects.some(e => e.effect === 'open' && e.type === 'solo' && e.item === entry.seq)) return refuse('Invalid native solo');
      return {kind:'music',name:'solo',fields,actor:signed.intent.actor,target:signed.intent.on};
    case 'mood': case 'say':
      if (!text(fields['text']) || !entry.effects.some(e => e.effect === 'open' && e.type === signed.intent.kind && e.item === entry.seq)) return refuse('Invalid native spoken cue');
      return {kind:'music',name:signed.intent.kind,fields,actor:signed.intent.actor,target:signed.intent.on};
    case 'set-order':
      if (Object.keys(fields).sort().join(',') !== 'part0,part1,part2,part3' || !Object.values(fields).every(p => parts.includes(String(p))) || new Set(Object.values(fields)).size !== 4) return refuse('Invalid native instrument order');
      return {kind:'music',name:'set-order',fields,actor:signed.intent.actor,target:signed.intent.on};
    case 'release': case 'end-solo':
      if (signed.intent.on === null || !entry.effects.some(e => e.effect === 'state' && e.item === signed.intent.on && e.state === (signed.intent.kind === 'release' ? 'released' : 'ended'))) return refuse('Invalid native closing cue');
      return { kind: 'music', name: signed.intent.kind, fields: signed.intent.fields, actor: signed.intent.actor, target: signed.intent.on };
    default: return refuse('Unrecognized native Jam act');
  }
}
/** Complete, single-frontier pages. Missing/retired input never becomes a cue. */
export async function nativeHistory(room: NativeRoom) {
  if (room.handle.scope !== room.ref.scope || definitionDigest(room.declaration) !== room.pin) return refuse('Wrong declaration or handle');
  const summary = await room.handle.summary(), declared = await room.handle.definition();
  if (!summary.ok || !declared.ok || !same(summary.value.scope, room.ref) || summary.value.status !== 'active' || summary.value.definition !== room.pin || definitionDigest(declared.value) !== room.pin) return refuse('Native room is not active under this declaration');
  const entries: Entry[] = [], seen = new Set<string>();
  let keptBytes = 0;
  let cursor: string | undefined, head: { seq: number; hash: string } | null = null;
  do {
    const page = await room.handle.history(cursor);
    if (!page.ok || !page.complete) return refuse('Incomplete retained native history');
    if (head && !same(page.at, head)) return refuse('History pages have different frontiers');
    head = page.at;
    for (const sealed of page.value) {
      if (entries.length >= 8192) return refuse('Native history exceeds this explicit projection bound');
      const entry = checked(sealed, room.ref, entries.length);
      keptBytes += canonicalBytes(entry).length;
      if (keptBytes > 16 * 1024 * 1024) return refuse('Native history exceeds this explicit byte budget');
      if (entry.prev !== (entries.length ? entryHash(entries.at(-1)!) : null)) return refuse('Native history has a gap or changed prefix');
      if (entry.input.type === 'act' && !await verifySignedIntent(entry.input.signed)) return refuse('Native act signature is invalid');
      entries.push(entry);
    }
    cursor = page.next;
    if (cursor && seen.has(cursor)) return refuse('History cursor repeated');
    if (cursor) seen.add(cursor);
  } while (cursor);
  if (!head || !same(head, summary.at) || !entries.length || head.seq !== entries.length - 1 || head.hash !== entryHash(entries.at(-1)!)) return refuse('Native frontier is incomplete');
  const genesis = entries[0]!, input = genesis.input;
  if (input.type !== 'genesis' || !input.source || input.n === null || !input.message || !same(input.seed.creator, input.source.at) || input.seed.definition !== room.pin || scopeIdOf(input.seed) !== room.ref.scope || input.inc !== room.ref.inc) return refuse('Native creation provenance is missing');
  const parent = room.creator(input.source.at), read = await parent.entry(input.source.seq);
  if (!read.ok) return refuse('Native creator history unavailable');
  const origin = checked(read.value, input.source.at, input.source.seq);
  if (!same(factRefOf(origin), input.source)) return refuse('Native creator fact changed');
  const send = origin.sends.find(s => s.n === input.n);
  if (!send || !same(send.to, input.seed) || !same(send.message, input.message) || send.message.class !== 'request' || send.message.type !== 'create') return refuse('Native creation does not match its exact parent send');
  const confirmation = entries.find(e => e.input.type === 'delivery' && e.input.message.class === 'control' && e.input.message.type === 'confirm');
  if (!confirmation || confirmation.input.type !== 'delivery' || !same(confirmation.input.from.at, input.source.at)) return refuse('Native confirmation not retained from the creator');
  const confirmed = confirmation.input;
  const controlRead = await parent.entry(confirmed.from.seq);
  if (!controlRead.ok) return refuse('Native confirmation source unavailable');
  const control = checked(controlRead.value, confirmed.from.at, confirmed.from.seq);
  if (!same(factRefOf(control), confirmed.from) || !control.sends.some(s => s.n === confirmed.n && same(s.to, room.ref) && same(s.message, confirmed.message))) return refuse('Native confirmation does not match its creator send');
  const mapped: RecordedInput<FactRef>[] = entries.map(e => ({ seq: e.seq, timeMs: timeMs(e.time)!, fact: factRefOf(e), act: act(e, entries, room.ref) }));
  return { scope: room.ref, pin: room.pin, head, entries, mapped, schedule: recordedSchedule(mapped), provenance: { genesis: factRefOf(genesis), source: input.source, send: input.n }, replay: 'not-run' as const };
}

/** The app's existing private store owns one original envelope, never a second journal. */
export interface PendingIntent { signed: SignedIntent; grants: readonly Grant[]; beside: Beside; provider?: {status: 'unknown' | 'proposed'; proposal?: Record<string, import('@generalbusiness/artroom-contract').FieldValue>}; receipt?: Receipt; refusal?: Extract<Answer, {answer: 'refused'}> }
export interface IntentCustody { load(): Promise<PendingIntent | null>; save(value: PendingIntent): Promise<void> }
/** Stored judgments are evidence to reconcile, never permission to replace an original. */
export async function validatePending(pending: PendingIntent, ref: ScopeRef, actor: string) {
  if (!isSignedIntentShape(pending.signed) || !await verifySignedIntent(pending.signed)
    || !same(pending.signed.intent.to, ref) || pending.signed.intent.actor !== actor
    || !Array.isArray(pending.grants) || !pending.grants.every(isGrant)
    || !object(pending.beside) || Object.keys(pending.beside).length !== 0
    || (pending.receipt !== undefined && !isReceipt(pending.receipt))) return refuse('Private original is invalid; it was not replaced');
}
export async function reconcileOriginal(handle: ScopeHandle, custody: IntentCustody, ref: ScopeRef, actor: string, active: () => void = () => undefined) {
  active();
  const pending = await custody.load();
  if (!pending) return { status: 'none' as const };
  await validatePending(pending, ref, actor);
  active();
  const settled = await handle.settle(pending.signed);
  let receipt: Receipt;
  if (settled.ok) receipt = settled.value;
  else {
    active();
    if (settled.reason !== 'not-found') return { status: 'unknown' as const };
    // The same original may be judged again. No second signature is created.
    active();
    const answer = await handle.submit(pending.signed, pending.grants, pending.beside);
    if (answer.answer === 'refused') {
      await custody.save({...pending, refusal: answer});
      return {status: 'refused' as const};
    }
    if (answer.answer !== 'accepted') return {status: 'unknown' as const};
    receipt = answer.receipt;
  }
  const followed = await handle.followReceipt(receipt);
  if (!followed.ok || followed.entry.input.type !== 'act' || !same(followed.entry.input.signed, pending.signed)) return { status: 'unknown' as const };
  const {refusal: _oldRefusal, ...original} = pending;
  await custody.save({ ...original, receipt });
  return { status: 'recorded' as const, fact: receipt.fact };
}

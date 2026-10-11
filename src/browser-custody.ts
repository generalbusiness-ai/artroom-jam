import type {IntentCustody, PendingIntent} from './native.ts';

export interface CustodyVersion { revision: number; original: string | null }
export interface CustodyRow { revision?: number; active: PendingIntent | null; history: PendingIntent[] }
export interface CustodySnapshot extends CustodyVersion { active: PendingIntent | null }
const originalOf = (value: PendingIntent | null) => value ? JSON.stringify(value.signed) : null;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const terminal = (value: PendingIntent) => Boolean(value.receipt || value.refusal);

function known(old: PendingIntent, value: PendingIntent): PendingIntent {
  if (!same(old.signed, value.signed) || !same(old.grants, value.grants) || !same(old.beside, value.beside))
    throw new Error('The exact original envelope cannot change');
  if (old.receipt && value.receipt && !same(old.receipt, value.receipt))
    throw new Error('The recorded original receipt cannot change');
  if (!old.receipt && !value.receipt && old.refusal && value.refusal && !same(old.refusal, value.refusal))
    throw new Error('The retained original refusal cannot change');
  if (value.provider?.status === 'proposed' && !value.provider.proposal)
    throw new Error('The known provider proposal is missing');
  if (old.provider?.status === 'proposed' && value.provider?.status === 'proposed'
    && !same(old.provider.proposal, value.provider.proposal))
    throw new Error('The known original proposal cannot change');
  const merged = {...old, ...value};
  if (old.receipt) merged.receipt = old.receipt;
  if (merged.receipt) delete merged.refusal;
  else if (old.refusal) merged.refusal = old.refusal;
  if (old.provider?.status === 'proposed') merged.provider = old.provider;
  return merged;
}

/** The actual readwrite transaction uses this transition, including its CAS. */
export function custodyWrite(row: CustodyRow, value: PendingIntent, expected: CustodyVersion): CustodyRow & {revision: number} {
  const revision = row.revision ?? 0, id = originalOf(value);
  if (!Number.isSafeInteger(revision) || revision < 0 || revision === Number.MAX_SAFE_INTEGER
    || !Number.isSafeInteger(expected.revision) || expected.revision < 0 || expected.revision > revision)
    throw new Error('The captured custody revision is unavailable');
  const archived = row.history.findIndex(old => originalOf(old) === id);
  let active = row.active, history = row.history.slice();
  if (archived >= 0) {
    if (expected.original !== id) throw new Error('The captured original differs');
    history[archived] = known(history[archived]!, value);
  } else if (originalOf(active) === id) {
    if (expected.original !== id) throw new Error('The captured original differs');
    active = known(active!, value);
  } else {
    if (expected.revision !== revision || expected.original !== originalOf(active))
      throw new Error('The active original changed before this write');
    if (active && !terminal(active)) throw new Error('An unknown original cannot be replaced');
    if (terminal(value) || value.provider) throw new Error('A late answer cannot activate another original');
    if (active) history.push(active);
    active = value;
  }
  const next = {revision: revision + 1, active, history};
  if (history.length > 128 || new TextEncoder().encode(JSON.stringify(value)).length > 65536
    || new TextEncoder().encode(JSON.stringify(next)).length > 8 * 1024 * 1024)
    throw new Error('Exact request custody exceeds its storage bound');
  return next;
}

/** One private store retains exact originals. Late answers never reactivate history. */
export class BrowserCustody implements IntentCustody {
  private observed = new WeakMap<PendingIntent['signed'], CustodyVersion>();
  constructor(readonly identity: string) {}
  private async db(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open('jam-native-v2', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('intents');
      r.onerror = () => reject(r.error); r.onsuccess = () => resolve(r.result);
    });
  }
  private async read(): Promise<CustodyRow> {
    const db = await this.db();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('intents', 'readonly'), r = tx.objectStore('intents').get(this.identity);
        let row: CustodyRow | undefined;
        r.onsuccess = () => { row = r.result ?? {revision: 0, active: null, history: []}; };
        tx.oncomplete = () => row ? resolve(row) : reject(new Error('Private custody read did not complete'));
        tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? new Error('Private custody read failed'));
      });
    } finally { db.close(); }
  }
  async snapshot(): Promise<CustodySnapshot> {
    const row = await this.read();
    const version = {revision: row.revision ?? 0, original: originalOf(row.active)};
    if (row.active) this.observed.set(row.active.signed, version);
    return {...version, active: row.active};
  }
  async load(): Promise<PendingIntent | null> { return (await this.snapshot()).active; }
  async loadOriginal(signed: PendingIntent['signed']): Promise<PendingIntent | null> {
    const row = await this.read(), id = JSON.stringify(signed);
    return [row.active, ...row.history].find(value => value && originalOf(value) === id) ?? null;
  }
  async save(value: PendingIntent, expected = this.observed.get(value.signed)): Promise<void> {
    if (!expected) throw new Error('Capture the active original and revision before saving');
    const captured = {...expected}, retained = structuredClone(value);
    const db = await this.db();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('intents', 'readwrite'), store = tx.objectStore('intents'), read = store.get(this.identity);
        let next: ReturnType<typeof custodyWrite> | undefined, failure: unknown;
        read.onsuccess = () => {
          try {
            next = custodyWrite(read.result ?? {revision: 0, active: null, history: []}, retained, captured);
            store.put(next, this.identity);
          } catch (error) { failure = error; tx.abort(); }
        };
        tx.oncomplete = () => {
          if (!next) { reject(new Error('Private custody write did not complete')); return; }
          if (originalOf(next.active) === originalOf(value))
            this.observed.set(value.signed, {revision: next.revision, original: originalOf(next.active)});
          resolve();
        };
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(failure ?? tx.error ?? new Error('Exact request custody was not saved'));
      });
    } finally { db.close(); }
  }
}

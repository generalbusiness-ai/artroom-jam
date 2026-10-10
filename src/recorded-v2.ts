// jam-recorded-v2 consumes modeled accepted-entry inputs. Production callers
// must verify native admission, full FactRef/entry identity, grants, declaration
// pin and creation provenance through the future published Artroom facade.
// Generic F is the retained opaque fact: this module creates no authority.
import type { FieldValue } from '@generalbusiness/artroom-contract';
import { decodeContribution, validateInterpretation, type Contribution, type ScoreInterpretation } from './contributions-v2.ts';

export const MAX_RECORDED_ENTRIES = 8192;
export const MAX_RUN_MS = 24 * 60 * 60 * 1000;
export type RecordedAct =
  | { kind: 'native-only' }
  | { kind: 'music'; name: 'take' | 'release' | 'pattern' | 'solo' | 'mood' | 'say' | 'set-order' | 'end-solo'; fields: Readonly<Record<string, FieldValue>>; actor: string; target: number | null }
  | { kind: 'establish'; lookaheadMs: number }
  | { kind: 'sing'; contribution: Contribution }
  | { kind: 'interpret'; sing: number; interpretation: ScoreInterpretation }
  | { kind: 'set-lookahead'; lookaheadMs: number };
export interface RecordedInput<F> { seq: number; timeMs: number; fact: F; act: RecordedAct }
export interface RecordedCue<F> { seq: number; fact: F; effectBar: number | null }
export interface ExactTime { numerator: string; denominator: string } // microseconds from transport origin
export interface TempoSegment { bar: number; startUs: ExactTime; tempoMilliBpm: number }
export interface RecordedSchedule<F> {
  version: 'jam-recorded-v2'; origin: F | null; cues: RecordedCue<F>[]; segments: TempoSegment[];
}
export class RecordedModelError extends Error { override readonly name = 'RecordedModelError'; }
const refuse = (): never => { throw new RecordedModelError('History is outside the bounded jam-recorded-v2 model.'); };
const integer = (v: number, min: number, max: number): boolean => Number.isSafeInteger(v) && !Object.is(v, -0) && v >= min && v <= max;
const lookahead = (v: number): boolean => integer(v, 1, 60_000);

// Exact local arithmetic only. BigInt is never an act field or canonical value.
interface Fraction { n: bigint; d: bigint }
function fraction(n: bigint, d = 1n): Fraction {
  if (d <= 0n) return refuse();
  let a = n < 0n ? -n : n, b = d;
  while (b !== 0n) [a, b] = [b, a % b];
  return { n: n / a, d: d / a };
}
const add = (a: Fraction, b: Fraction): Fraction => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
const subtract = (a: Fraction, b: Fraction): Fraction => fraction(a.n * b.d - b.n * a.d, a.d * b.d);
const multiply = (a: Fraction, n: bigint): Fraction => fraction(a.n * n, a.d);
const beforeOrAt = (a: Fraction, b: Fraction): boolean => a.n * b.d <= b.n * a.d;
const exact = (a: Fraction): ExactTime => ({ numerator: String(a.n), denominator: String(a.d) });
interface Segment { bar: number; start: Fraction; duration: Fraction; tempoMilliBpm: number }
function atTime(segments: Segment[], time: Fraction): Segment {
  let result = segments[0]!;
  for (const segment of segments) { if (beforeOrAt(segment.start, time)) result = segment; else break; }
  return result;
}
function boundary(segments: Segment[], bar: number): Fraction {
  let result = segments[0]!;
  for (const segment of segments) { if (segment.bar <= bar) result = segment; else break; }
  return add(result.start, multiply(result.duration, BigInt(bar - result.bar)));
}
function firstBoundary(segments: Segment[], time: Fraction): number {
  const segment = atTime(segments, time), elapsed = subtract(time, segment.start);
  const n = elapsed.n * segment.duration.d, d = elapsed.d * segment.duration.n;
  if (n < 0n) return refuse();
  const bar = segment.bar + Number((n + d - 1n) / d);
  if (!integer(bar, 1, 100_000)) return refuse();
  return bar;
}
const duration = (tempoMilliBpm: number): Fraction => fraction(240_000_000_000n, BigInt(tempoMilliBpm)); // 4 quarter-note beats
const sameTune = (a: ScoreInterpretation, b: ScoreInterpretation): boolean => a.key.tonic === b.key.tonic && a.key.mode === b.key.mode
  && a.themeBars === b.themeBars && a.theme.length === b.theme.length
  && a.theme.every((note, i) => { const other = b.theme[i]!; return note.step === other.step && note.length === other.length && note.pitch === other.pitch && note.velocity === other.velocity; });

/** Rebuild from complete bounded input; do not trim history, change old cues or use a wall/audio clock. */
export function recordedSchedule<F>(history: readonly RecordedInput<F>[]): RecordedSchedule<F> {
  if (history.length < 1 || history.length > MAX_RECORDED_ENTRIES) return refuse();
  const first = history[0]!;
  if (first.act.kind !== 'establish' || first.seq !== 0 || !lookahead(first.act.lookaheadMs)) return refuse();
  let activeLookahead = first.act.lookaheadMs, origin: RecordedInput<F> | null = null, previousBar = 1;
  let priorTime = first.timeMs;
  let latest: ScoreInterpretation = { kind: 'tune', tempoMilliBpm: 120_000, tempoClear: false,
    key: { tonic: 9, mode: 'minor' }, theme: [], themeBars: 1, rhythm: [], rhythmBars: 0 };
  const pending = new Map<number, Contribution>();
  const changes: { bar: number; value: number }[] = [], segments: Segment[] = [], cues: RecordedCue<F>[] = [];
  for (const [index, entry] of history.entries()) {
    if (entry.seq !== index || !integer(entry.timeMs, 0, Number.MAX_SAFE_INTEGER) || entry.timeMs < priorTime
      || entry.timeMs - first.timeMs > MAX_RUN_MS) return refuse();
    priorTime = entry.timeMs;
    if (entry.act.kind === 'native-only') { cues.push({ seq: entry.seq, fact: entry.fact, effectBar: null }); continue; }
    if (index > 0 && entry.act.kind === 'establish') return refuse();
    if (entry.act.kind === 'sing') { decodeContribution(entry.act.contribution); pending.set(entry.seq, entry.act.contribution); if (pending.size > 64) return refuse(); }
    if (entry.act.kind === 'interpret') {
      const contribution = pending.get(entry.act.sing);
      if (!contribution || contribution.kind !== entry.act.interpretation.kind) return refuse();
      validateInterpretation(entry.act.interpretation);
      // Rhythm preserves the preceding tune, or the explicit founding empty
      // A-minor basis when the room starts with rhythm (the existing demo's default).
      if (contribution.kind === 'rhythm' && !sameTune(latest, entry.act.interpretation)) return refuse();
      pending.delete(entry.act.sing);
      latest = entry.act.interpretation;
    }
    if (!origin) {
      if (entry.act.kind === 'set-lookahead') return refuse(); // no derived boundary before transport starts
      if (entry.act.kind === 'interpret') {
        origin = entry;
        segments.push({ bar: 1, start: fraction(0n), duration: duration(entry.act.interpretation.tempoMilliBpm), tempoMilliBpm: entry.act.interpretation.tempoMilliBpm });
        cues.push({ seq: entry.seq, fact: entry.fact, effectBar: 1 });
      } else cues.push({ seq: entry.seq, fact: entry.fact, effectBar: null });
      continue;
    }
    const time = fraction(BigInt(entry.timeMs - origin.timeMs) * 1000n);
    for (const change of changes) if (beforeOrAt(boundary(segments, change.bar), time)) activeLookahead = change.value;
    const effectBar = Math.max(previousBar, firstBoundary(segments, add(time, fraction(BigInt(activeLookahead) * 1000n))));
    previousBar = effectBar;
    cues.push({ seq: entry.seq, fact: entry.fact, effectBar });
    if (entry.act.kind === 'set-lookahead') {
      if (!lookahead(entry.act.lookaheadMs)) return refuse();
      changes.push({ bar: effectBar, value: entry.act.lookaheadMs });
    }
    if (entry.act.kind === 'interpret') {
      const segment: Segment = { bar: effectBar, start: boundary(segments, effectBar), duration: duration(entry.act.interpretation.tempoMilliBpm), tempoMilliBpm: entry.act.interpretation.tempoMilliBpm };
      if (segments.at(-1)!.bar === effectBar) segments[segments.length - 1] = segment;
      else segments.push(segment);
    }
  }
  return { version: 'jam-recorded-v2', origin: origin?.fact ?? null, cues,
    segments: segments.map(segment => ({ bar: segment.bar, startUs: exact(segment.start), tempoMilliBpm: segment.tempoMilliBpm })) };
}

// jam-score-2: integer transport of symbolic contributions. This module has
// no Artroom, signer, network, storage or audio dependency.
import type { HummedNote, Interpretation, Onset, ThemeNote } from './interpret.ts';
import { keyName } from './music.ts';

export const SCORE_VERSION = 2;
export const MICROSECONDS = 1_000_000;
export const STEP_UNITS = 1_000_000; // millionths of a sixteenth step
export const MILLI_BPM = 1_000;
export const MAX_PHRASE_US = 60_000_000;
export const MAX_EVENTS = 64;
export const MAX_STEPS = 256;

export class ContributionError extends Error {
  override readonly name = 'ContributionError';
}
const refuse = (): never => { throw new ContributionError('Contribution is outside jam-score-2; nothing was converted.'); };
const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number'
  && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= min && value <= max;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const closed = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => object(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

// Rounding finds a candidate, never grants permission to lose precision.
// Exact decode equality is required before the integer leaves this function.
function scaled(value: number, unit: number, min: number, max: number): number {
  if (!Number.isFinite(value) || Object.is(value, -0)) return refuse();
  const candidate = Math.round(value * unit);
  if (!integer(candidate, min, max) || candidate / unit !== value) return refuse();
  return candidate;
}
export const encodeStep = (value: number): number => scaled(value, STEP_UNITS, 0, MAX_STEPS * STEP_UNITS);
export function decodeStep(value: number): number {
  if (!integer(value, 0, MAX_STEPS * STEP_UNITS)) return refuse();
  return value / STEP_UNITS;
}
export const encodeTempo = (value: number): number => scaled(value, MILLI_BPM, 60_000, 180_000);
export function decodeTempo(value: number): number {
  if (!integer(value, 60_000, 180_000)) return refuse();
  return value / MILLI_BPM;
}

export interface ScoreNote { startUs: number; durationUs: number; pitch: number; velocity: number }
export interface ScoreOnset { timeUs: number; cls: 'high' | 'low' }
export type Contribution =
  | { version: 2; kind: 'tune'; notes: ScoreNote[] }
  | { version: 2; kind: 'rhythm'; onsets: ScoreOnset[] };
export type Phrase = { kind: 'tune'; notes: HummedNote[] } | { kind: 'rhythm'; onsets: Onset[] };

/** Refusal keeps the original input untouched; it never sorts or clips notes. */
export function encodeContribution(phrase: Phrase): Contribution {
  if (phrase.kind === 'tune') {
    if (!closed(phrase, ['kind', 'notes']) || !Array.isArray(phrase.notes) || phrase.notes.length < 1 || phrase.notes.length > MAX_EVENTS) return refuse();
    const notes = phrase.notes.map(note => {
      if (!closed(note, ['start', 'duration', 'pitch', 'velocity'])) return refuse();
      return { startUs: scaled(note.start, MICROSECONDS, 0, MAX_PHRASE_US),
        durationUs: scaled(note.duration, MICROSECONDS, 1, MAX_PHRASE_US), pitch: note.pitch, velocity: note.velocity };
    });
    const value: Contribution = { version: SCORE_VERSION, kind: 'tune', notes };
    decodeContribution(value);
    return value;
  }
  if (phrase.kind !== 'rhythm' || !closed(phrase, ['kind', 'onsets']) || !Array.isArray(phrase.onsets) || phrase.onsets.length < 1 || phrase.onsets.length > MAX_EVENTS) return refuse();
  const value: Contribution = { version: SCORE_VERSION, kind: 'rhythm', onsets: phrase.onsets.map(onset => {
    if (!closed(onset, ['time', 'cls'])) return refuse();
    return { timeUs: scaled(onset.time, MICROSECONDS, 0, MAX_PHRASE_US), cls: onset.cls };
  }) };
  decodeContribution(value);
  return value;
}

/** Closed integer data only; JSON parsing/canonical bytes belong to the future public facade. */
export function decodeContribution(value: unknown): Phrase {
  if (!object(value) || value['version'] !== SCORE_VERSION) return refuse();
  if (value['kind'] === 'tune' && closed(value, ['version', 'kind', 'notes'])) {
    const notes = value['notes'];
    if (!Array.isArray(notes) || notes.length < 1 || notes.length > MAX_EVENTS) return refuse();
    return { kind: 'tune', notes: notes.map(note => {
      if (!closed(note, ['startUs', 'durationUs', 'pitch', 'velocity']) || !integer(note['startUs'], 0, MAX_PHRASE_US)
        || !integer(note['durationUs'], 1, MAX_PHRASE_US) || note['startUs'] + note['durationUs'] > MAX_PHRASE_US
        || !integer(note['pitch'], 0, 127) || !integer(note['velocity'], 0, 127)) return refuse();
      return { start: note['startUs'] / MICROSECONDS, duration: note['durationUs'] / MICROSECONDS, pitch: note['pitch'], velocity: note['velocity'] };
    }) };
  }
  if (value['kind'] === 'rhythm' && closed(value, ['version', 'kind', 'onsets'])) {
    const onsets = value['onsets'];
    if (!Array.isArray(onsets) || onsets.length < 1 || onsets.length > MAX_EVENTS) return refuse();
    return { kind: 'rhythm', onsets: onsets.map(onset => {
      if (!closed(onset, ['timeUs', 'cls']) || !integer(onset['timeUs'], 0, MAX_PHRASE_US) || (onset['cls'] !== 'high' && onset['cls'] !== 'low')) return refuse();
      return { time: onset['timeUs'] / MICROSECONDS, cls: onset['cls'] };
    }) };
  }
  return refuse();
}

export interface ScoreInterpretation {
  kind: 'tune' | 'rhythm'; tempoMilliBpm: number; tempoClear: boolean;
  key: Pick<Interpretation['key'], 'tonic' | 'mode'>; theme: ThemeNote[]; themeBars: number;
  rhythm: Interpretation['rhythm']; rhythmBars: number;
}
export function encodeInterpretation(value: Interpretation): ScoreInterpretation {
  if (!closed(value, ['from', 'tempo', 'tempoClear', 'beatsPerBar', 'stepsPerBeat', 'key', 'theme', 'themeBars', 'rhythm', 'rhythmBars'])
    || value.key.name !== keyName(value.key.tonic, value.key.mode)
    || value.beatsPerBar !== 4 || value.stepsPerBeat !== 4 || !Array.isArray(value.theme) || value.theme.length > MAX_EVENTS
    || !Array.isArray(value.rhythm) || value.rhythm.length > MAX_EVENTS) return refuse();
  const result: ScoreInterpretation = { kind: value.from, tempoMilliBpm: encodeTempo(value.tempo), tempoClear: value.tempoClear,
    key: { tonic: value.key.tonic, mode: value.key.mode }, theme: value.theme.map(note => ({ ...note })), themeBars: value.themeBars,
    rhythm: value.rhythm.map(hit => ({ ...hit })), rhythmBars: value.rhythmBars };
  validateInterpretation(result);
  return result;
}
export function validateInterpretation(value: ScoreInterpretation): void {
  if (!closed(value, ['kind', 'tempoMilliBpm', 'tempoClear', 'key', 'theme', 'themeBars', 'rhythm', 'rhythmBars'])
    || (value.kind !== 'tune' && value.kind !== 'rhythm') || !integer(value.tempoMilliBpm, 60_000, 180_000)
    || typeof value.tempoClear !== 'boolean' || !closed(value.key, ['tonic', 'mode']) || !integer(value.key.tonic, 0, 11)
    || !['major', 'minor', 'mixolydian', 'pentatonic', 'blues'].includes(value.key.mode)
    || !integer(value.themeBars, 1, 16) || !integer(value.rhythmBars, 0, 16)
    || !Array.isArray(value.theme) || value.theme.length > MAX_EVENTS || !Array.isArray(value.rhythm) || value.rhythm.length > MAX_EVENTS) return refuse();
  for (const note of value.theme) if (!closed(note, ['step', 'length', 'pitch', 'velocity']) || !integer(note.step, 0, MAX_STEPS - 1)
    || !integer(note.length, 1, MAX_STEPS) || !integer(note.pitch, 0, 127) || !integer(note.velocity, 0, 127)) return refuse();
  for (const hit of value.rhythm) if (!closed(hit, ['step', 'cls']) || !integer(hit.step, 0, MAX_STEPS - 1) || (hit.cls !== 'high' && hit.cls !== 'low')) return refuse();
  if (value.kind === 'tune' && (value.rhythm.length !== 0 || value.rhythmBars !== 0)) return refuse();
  if (value.kind === 'rhythm' && value.rhythmBars < 1) return refuse();
}
export function decodeInterpretation(value: ScoreInterpretation): Interpretation {
  validateInterpretation(value);
  return { from: value.kind, tempo: decodeTempo(value.tempoMilliBpm), tempoClear: value.tempoClear, beatsPerBar: 4, stepsPerBeat: 4,
    key: { ...value.key, name: keyName(value.key.tonic, value.key.mode) }, theme: value.theme.map(note => ({ ...note })), themeBars: value.themeBars,
    rhythm: value.rhythm.map(hit => ({ ...hit })), rhythmBars: value.rhythmBars };
}

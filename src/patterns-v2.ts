/** Full pattern transport is integer data; local rendering remains floating point. */
import type { NoteEvent } from './record.ts';
import { STEP_UNITS, encodeStep, decodeStep, ContributionError } from './contributions-v2.ts';
export interface ScoreEvent {
  stepUnits: number; lengthUnits: number; pitch: number; velocity: number; voice: string;
  filterUnits?: number; lateUnits?: number; tone?: string; from?: number; glideUnits?: number;
}
const integer = (n: unknown, lo: number, hi: number): n is number => typeof n === 'number' && Number.isSafeInteger(n) && !Object.is(n, -0) && n >= lo && n <= hi;
const VOICES = ['hum','bass','stab','arp','lead','kick','hat','openhat','clap','tom'];
const text = (s: unknown): s is string => typeof s === 'string' && new TextEncoder().encode(s).length > 0 && new TextEncoder().encode(s).length <= 64;
const fail = (): never => { throw new ContributionError('Pattern is outside jam-score-2; nothing was converted'); };
export function encodeEvent(e: NoteEvent): ScoreEvent {
  if (Object.keys(e).some(k => !['step','length','pitch','velocity','voice','filter','late','tone','from','glide'].includes(k))) return fail();
  const value: ScoreEvent = { stepUnits: encodeStep(e.step), lengthUnits: encodeStep(e.length), pitch: e.pitch, velocity: e.velocity, voice: e.voice };
  if (e.filter !== undefined) value.filterUnits = encodeStep(e.filter);
  if (e.late !== undefined) value.lateUnits = encodeStep(e.late);
  if (e.glide !== undefined) value.glideUnits = encodeStep(e.glide);
  if (e.from !== undefined) value.from = e.from;
  if (e.tone !== undefined) value.tone = e.tone;
  decodeEvent(value);
  return value;
}
export function decodeEvent(e: ScoreEvent): NoteEvent {
  const allowed = ['stepUnits','lengthUnits','pitch','velocity','voice','filterUnits','lateUnits','tone','from','glideUnits'];
  if (!e || Object.keys(e).some(k => !allowed.includes(k)) || !integer(e.stepUnits,0,256*STEP_UNITS) || !integer(e.lengthUnits,1,256*STEP_UNITS)
    || !integer(e.pitch,0,127) || !integer(e.velocity,0,127) || !text(e.voice) || !VOICES.includes(e.voice)) return fail();
  if (e.filterUnits !== undefined && !integer(e.filterUnits,0,STEP_UNITS)) return fail();
  if (e.lateUnits !== undefined && !integer(e.lateUnits,0,STEP_UNITS)) return fail();
  if (e.glideUnits !== undefined && !integer(e.glideUnits,0,256*STEP_UNITS)) return fail();
  if (e.from !== undefined && !integer(e.from,0,127)) return fail();
  if (e.tone !== undefined && !text(e.tone)) return fail();
  return { step: decodeStep(e.stepUnits), length: decodeStep(e.lengthUnits), pitch:e.pitch,velocity:e.velocity,voice:e.voice,
    ...(e.filterUnits === undefined ? {} : {filter:decodeStep(e.filterUnits)}), ...(e.lateUnits === undefined ? {} : {late:decodeStep(e.lateUnits)}),
    ...(e.glideUnits === undefined ? {} : {glide:decodeStep(e.glideUnits)}), ...(e.tone === undefined ? {} : {tone:e.tone}), ...(e.from === undefined ? {} : {from:e.from}) };
}
export function decodePattern(bars: number, events: readonly ScoreEvent[]): NoteEvent[] {
  if (!integer(bars,1,16) || !Array.isArray(events) || events.length < 1 || events.length > 64) return fail();
  return events.map(e => { const note = decodeEvent(e); if (e.stepUnits+e.lengthUnits > bars*16*STEP_UNITS) return fail(); return note; });
}

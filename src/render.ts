// An offline synthesizer in plain code. It renders what the record says is
// active, bar by bar, to mono samples, and encodes them as a 16-bit WAV.
// Oscillators are naive (they alias); filters are one-pole; the reverb is a
// small Schroeder reverb on a send.

import { activeAt, barStart, DEFAULT_RULES, type Log, type NoteEvent, type Part, type Rules } from './record.ts';

export const SAMPLE_RATE = 44100;
// Room after the end of a bar for releases and the reverb, in seconds.
export const TAIL = 2.5;

export interface RenderOptions {
  sampleRate?: number;
  parts?: Part[]; // only these parts; all when absent
  reverb?: boolean; // default true
}

const TWO_PI = 2 * Math.PI;

function mtof(pitch: number): number {
  return 440 * 2 ** ((pitch - 69) / 12);
}

function onePole(cutoff: number, sr: number): number {
  return 1 - Math.exp((-TWO_PI * Math.min(cutoff, sr * 0.45)) / sr);
}

// A small deterministic noise source.
function noise(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

const saw = (phase: number) => 2 * (phase - Math.floor(phase + 0.5));
const square = (phase: number) => (phase - Math.floor(phase) < 0.5 ? 1 : -1);
const triangle = (phase: number) => 1 - 4 * Math.abs(phase - Math.floor(phase + 0.5));

interface Bus {
  dry: Float32Array;
  send: Float32Array;
  sr: number;
}

// Writes one note at `offset` samples into the bus. `seconds` is the note's
// written length.
function playNote(bus: Bus, offset: number, e: NoteEvent, seconds: number): void {
  const { dry, send, sr } = bus;
  const v = e.velocity / 127;
  const f = mtof(e.pitch);
  let wet = 0;
  let length: number; // samples
  let sample: (t: number, i: number) => number;

  switch (e.voice) {
    case 'hum': {
      // A soft triangle with a little vibrato, held for its length.
      let phase = 0;
      let lp = 0;
      const a = onePole(1600, sr);
      length = Math.floor((seconds + 0.15) * sr);
      wet = 0.25;
      sample = (t) => {
        const vib = t > 0.1 ? 1 + 0.004 * Math.sin(TWO_PI * 5.5 * t) : 1;
        phase += (f * vib) / sr;
        lp += a * (triangle(phase) - lp);
        const env = Math.min(1, t / 0.03) * (t < seconds ? 1 : Math.max(0, 1 - (t - seconds) / 0.15));
        return 0.3 * v * env * lp;
      };
      break;
    }
    case 'bass': {
      // A saw through two one-pole filters whose cutoff falls with the envelope.
      let phase = 0;
      let lp1 = 0;
      let lp2 = 0;
      length = Math.floor((seconds + 0.05) * sr);
      sample = (t) => {
        phase += f / sr;
        const env = Math.exp(-t / 0.12) * (t < seconds ? 1 : Math.max(0, 1 - (t - seconds) / 0.05));
        const a = onePole(180 + 900 * env, sr);
        lp1 += a * (saw(phase) - lp1);
        lp2 += a * (lp1 - lp2);
        return 0.55 * v * Math.min(1, t / 0.003) * env * lp2;
      };
      break;
    }
    case 'stab': {
      // Two detuned saws, filtered, with a short decay.
      let p1 = 0;
      let p2 = 0;
      let lp1 = 0;
      let lp2 = 0;
      const a = onePole(2200, sr);
      length = Math.floor(0.4 * sr);
      wet = 0.5;
      sample = (t) => {
        p1 += (f * 1.004) / sr;
        p2 += (f * 0.996) / sr;
        lp1 += a * ((saw(p1) + saw(p2)) / 2 - lp1);
        lp2 += a * (lp1 - lp2);
        return 0.12 * v * Math.min(1, t / 0.002) * Math.exp(-t / 0.09) * lp2;
      };
      break;
    }
    case 'arp': {
      // A square behind a filter that the pattern opens.
      let phase = 0;
      let lp = 0;
      const open = e.filter ?? 0.5;
      const a = onePole(250 + open * open * 4500, sr);
      length = Math.floor(0.35 * sr);
      wet = 0.35;
      sample = (t) => {
        phase += f / sr;
        lp += a * (square(phase) - lp);
        return 0.12 * v * Math.min(1, t / 0.002) * Math.exp(-t / 0.08) * lp;
      };
      break;
    }
    case 'lead': {
      // Two saws, driven into a soft clip, filtered, with a late vibrato:
      // a guitar of sorts.
      let p1 = 0;
      let p2 = 0;
      let lp = 0;
      const a = onePole(3000, sr);
      length = Math.floor((seconds + 0.2) * sr);
      wet = 0.3;
      sample = (t) => {
        const vib = t > 0.25 ? 1 + 0.006 * Math.sin(TWO_PI * 5.5 * t) : 1;
        p1 += (f * vib) / sr;
        p2 += (f * vib * 1.003) / sr;
        const x = Math.tanh(2.5 * (saw(p1) + saw(p2)) * 0.5);
        lp += a * (x - lp);
        const env = Math.min(1, t / 0.008) * (0.75 + 0.25 * Math.exp(-t / 0.1)) *
          (t < seconds ? 1 : Math.max(0, 1 - (t - seconds) / 0.2));
        return 0.4 * v * env * lp;
      };
      break;
    }
    case 'kick': {
      // A sine falling from about 155 Hz to 45 Hz.
      let phase = 0;
      length = Math.floor(0.45 * sr);
      sample = (t) => {
        phase += (45 + 110 * Math.exp(-t / 0.035)) / sr;
        return 0.5 * v * Math.exp(-t / 0.28) * Math.sin(TWO_PI * phase);
      };
      break;
    }
    case 'hat':
    case 'openhat': {
      // Noise with the lows taken out.
      const n = noise(e.pitch * 131 + e.step + 1);
      let lp = 0;
      const a = onePole(7000, sr);
      const decay = e.voice === 'hat' ? 0.035 : 0.25;
      length = Math.floor(decay * 5 * sr);
      sample = (t) => {
        const x = n();
        lp += a * (x - lp);
        return 0.22 * v * Math.exp(-t / decay) * (x - lp);
      };
      break;
    }
    case 'clap': {
      // Band-limited noise in three quick bursts and a short tail.
      const n = noise(e.step + 7);
      let lo = 0;
      let band = 0;
      const aLo = onePole(900, sr);
      const aHi = onePole(3200, sr);
      length = Math.floor(0.3 * sr);
      wet = 0.3;
      sample = (t) => {
        const x = n();
        lo += aLo * (x - lo);
        band += aHi * (x - lo - band);
        const burst = t < 0.03 ? Math.exp(-((t % 0.01) / 0.003)) : Math.exp(-(t - 0.03) / 0.09);
        return 0.4 * v * burst * band;
      };
      break;
    }
    case 'tom': {
      // A sine falling a little, tuned by the drum number.
      const base = 70 * 2 ** ((e.pitch - 45) / 6);
      let phase = 0;
      length = Math.floor(0.4 * sr);
      sample = (t) => {
        phase += (base * (1 + 0.6 * Math.exp(-t / 0.04))) / sr;
        return 0.35 * v * Math.exp(-t / 0.18) * Math.sin(TWO_PI * phase);
      };
      break;
    }
    default:
      return;
  }

  const end = Math.min(dry.length, offset + length);
  for (let i = Math.max(0, offset); i < end; i++) {
    const x = sample((i - offset) / sr, i);
    dry[i] += x;
    if (wet) send[i] += x * wet;
  }
}

// Schroeder reverb: four damped combs in parallel, then two all-passes.
function reverb(input: Float32Array, sr: number): Float32Array {
  const scale = sr / 44100;
  const out = new Float32Array(input.length);
  for (const d of [1116, 1188, 1277, 1356]) {
    const len = Math.round(d * scale);
    const buf = new Float32Array(len);
    let idx = 0;
    let damp = 0;
    for (let i = 0; i < input.length; i++) {
      const y = buf[idx];
      damp = y * 0.8 + damp * 0.2;
      buf[idx] = input[i] + damp * 0.78;
      out[i] += y * 0.25;
      idx = (idx + 1) % len;
    }
  }
  for (const d of [556, 441]) {
    const len = Math.round(d * scale);
    const buf = new Float32Array(len);
    let idx = 0;
    for (let i = 0; i < out.length; i++) {
      const b = buf[idx];
      const x = out[i];
      buf[idx] = x + b * 0.5;
      out[i] = b - x * 0.5;
      idx = (idx + 1) % len;
    }
  }
  return out;
}

// One bar with its tail: what the record says is active at that bar.
export function renderBar(
  log: Log,
  bar: number,
  rules: Rules = DEFAULT_RULES,
  options: RenderOptions = {},
): { start: number; seconds: number; samples: Float32Array } {
  const sr = options.sampleRate ?? SAMPLE_RATE;
  const active = activeAt(log, bar, rules);
  const length = Math.ceil((active.barSeconds + TAIL) * sr);
  const bus: Bus = { dry: new Float32Array(length), send: new Float32Array(length), sr };
  const stepSeconds = active.barSeconds / 16;
  for (const [part, p] of Object.entries(active.parts)) {
    if (!p.pattern) continue;
    if (options.parts && !options.parts.includes(part as Part)) continue;
    for (const e of p.pattern.events) {
      if (Math.floor(e.step / 16) !== p.barInPattern) continue;
      const offset = Math.round((e.step % 16) * stepSeconds * sr);
      playNote(bus, offset, e, e.length * stepSeconds);
    }
  }
  if (options.reverb !== false) {
    const wet = reverb(bus.send, sr);
    for (let i = 0; i < length; i++) bus.dry[i] += wet[i];
  }
  return { start: active.start, seconds: active.barSeconds, samples: bus.dry };
}

// Bars `from` up to, not including, `to`, overlapped with their tails.
export function renderBars(
  log: Log,
  from: number,
  to: number,
  rules: Rules = DEFAULT_RULES,
  options: RenderOptions = {},
): Float32Array {
  const sr = options.sampleRate ?? SAMPLE_RATE;
  const t0 = barStart(log, from, rules);
  const out = new Float32Array(Math.ceil((barStart(log, to, rules) - t0 + TAIL) * sr));
  for (let bar = from; bar < to; bar++) {
    const { start, samples } = renderBar(log, bar, rules, options);
    const offset = Math.round((start - t0) * sr);
    const end = Math.min(out.length, offset + samples.length);
    for (let i = offset; i < end; i++) out[i] += samples[i - offset];
  }
  return out;
}

export function peak(samples: Float32Array): number {
  let p = 0;
  for (const x of samples) p = Math.max(p, Math.abs(x));
  return p;
}

// Scales the samples so their peak sits at `dbfs`.
export function normalize(samples: Float32Array, dbfs = -1): Float32Array {
  const p = peak(samples);
  if (p === 0) return samples;
  const g = 10 ** (dbfs / 20) / p;
  for (let i = 0; i < samples.length; i++) samples[i] *= g;
  return samples;
}

// A mono 16-bit PCM WAV file.
export function encodeWav(samples: Float32Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(x * 32767), true);
  }
  return bytes;
}

// What the stage shows at a moment: pure functions of the record and the
// time, so they can be tested without a browser.

import { activeAt, positionAt, schedule, DEFAULT_RULES, type Log, type Part, type Rules } from '../src/record.ts';

export interface Caption {
  by: string;
  text: string;
}

export interface Pending {
  kind: 'tune' | 'rhythm';
  effectBar: number;
}

export interface Stage {
  bar: number;
  beat: number; // 0 to 3
  nod: number; // 1 on the beat, falling to 0 before the next
  tempo: number;
  key?: string;
  arrived: Record<Part, boolean>;
  captions: Caption[];
  pending: Pending[];
}

// How many bars a line of banter stays up.
export const CAPTION_BARS = 3;

export function stageAt(log: Log, time: number, rules: Rules = DEFAULT_RULES): Stage {
  const position = Math.max(0, positionAt(log, time, rules));
  const bar = Math.floor(position);
  const beats = (position - bar) * rules.beatsPerBar;
  const beat = Math.floor(beats);
  const active = activeAt(log, bar, rules);
  const arrived = { synth: false, percussion: false, lead: false, bass: false };
  for (const part of Object.keys(active.parts) as Part[]) arrived[part] = true;

  const captions: Caption[] = [];
  const pending: Pending[] = [];
  for (const { entry, effectBar } of schedule(log, rules).entries) {
    if (entry.type === 'say' && effectBar <= bar && effectBar > bar - CAPTION_BARS) {
      captions.push({ by: entry.by, text: entry.text });
    }
    if (entry.type === 'sing' && effectBar > bar) pending.push({ kind: entry.kind, effectBar });
  }
  return {
    bar,
    beat,
    nod: (1 - (beats - beat)) ** 3,
    tempo: active.tempo,
    key: active.interpretation?.interpretation.key.name,
    arrived,
    captions: captions.slice(-3),
    pending,
  };
}

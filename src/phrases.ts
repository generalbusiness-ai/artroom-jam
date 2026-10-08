// The two phrases the person sang, as spike J0's in-page tracker transcribed
// them. They stand in for the microphone.

import type { HummedNote, Onset } from './interpret.ts';

// The theme: a hummed tune.
export const THEME: HummedNote[] = [
  { start: 0.138, duration: 0.11, pitch: 45, velocity: 76 },
  { start: 0.468, duration: 0.16, pitch: 50, velocity: 122 },
  { start: 0.798, duration: 0.23, pitch: 56, velocity: 126 },
  { start: 1.258, duration: 0.24, pitch: 56, velocity: 126 },
  { start: 1.688, duration: 0.14, pitch: 56, velocity: 121 },
  { start: 1.988, duration: 0.16, pitch: 52, velocity: 113 },
  { start: 2.308, duration: 0.22, pitch: 58, velocity: 127 },
  { start: 2.708, duration: 0.29, pitch: 51, velocity: 101 },
];

// The rhythm phrase: onsets with a high or low class.
export const RHYTHM: Onset[] = [
  { time: 0.081, cls: 'high' },
  { time: 0.47, cls: 'low' },
  { time: 0.592, cls: 'low' },
  { time: 0.848, cls: 'high' },
  { time: 1.091, cls: 'high' },
  { time: 1.353, cls: 'high' },
  { time: 1.596, cls: 'high' },
  { time: 1.852, cls: 'high' },
  { time: 2.101, cls: 'high' },
  { time: 2.485, cls: 'high' },
  { time: 2.606, cls: 'low' },
  { time: 2.74, cls: 'low' },
  { time: 2.868, cls: 'low' },
  { time: 3.106, cls: 'high' },
  { time: 3.367, cls: 'high' },
  { time: 3.611, cls: 'high' },
  { time: 3.75, cls: 'high' },
  { time: 4.11, cls: 'high' },
];

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../spikes/j0/', import.meta.url);
const html = readFileSync(new URL('harness/index.html', root), 'utf8');

test('the J0 generated harness exactly matches its template and transcription source', () => {
  const expected = readFileSync(new URL('src/harness.template.html', root), 'utf8')
    .replace('/*TRANSCRIBE_JS*/', () => readFileSync(new URL('src/transcribe.js', root), 'utf8'));
  assert.equal(html, expected);
});

// Exercise the actual inline event handlers with only DOM/storage stand-ins.
// No audio input, model, microphone, browser, bundle or network is used.
function harness() {
  const elements = new Map<string, any>();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', disabled: false, value: id });
    return elements.get(id);
  };
  let saved = '[]';
  const jobs: { resolve: () => void; reject: (error: Error) => void }[] = [];
  const context = vm.createContext({
    performance, console, Float32Array, Uint8Array, DataView,
    document: { getElementById: element, querySelector: () => ({ value: 'tune' }) },
    localStorage: { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } },
    window: {
      __paRun: true,
      __paModel: { evaluateModel: () => new Promise<void>((resolve, reject) => jobs.push({ resolve, reject })) },
      BP: {
        outputToNotesPoly: () => [], addPitchBendsToNoteEvents: (_bends: unknown, notes: unknown) => notes,
        noteFramesToTime: () => [{ startTimeSeconds: 0.25, durationSeconds: 0.5, pitchMidi: 60, amplitude: 0.5 }],
      },
    },
  });
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  new vm.Script(scripts[0]).runInContext(context);
  // Supply inert identifiers to reach the real show/runPathA/answer handlers;
  // do not transcribe or decode synthetic or private audio.
  vm.runInContext(`J0.decodeWav = () => ({ samples: new Float32Array(0), sr: 22050 });
    J0.transcribeHum = () => ({ notes: [] });`, context);
  new vm.Script(scripts[1]).runInContext(context);
  return {
    jobs, element,
    phrase: () => element('wavfile').onchange({ target: { files: [{ arrayBuffer: async () => new ArrayBuffer(0) }] } }),
    answer: () => element('yes').onclick(),
    log: () => JSON.parse(saved),
    settle: () => new Promise<void>((resolve) => setImmediate(resolve)),
  };
}

test('a late optional result cannot attach to the replacement phrase or change a saved pending answer', async () => {
  const h = harness();
  await h.phrase();
  h.answer();
  assert.equal(h.log()[0].pathA.status, 'pending');
  await h.phrase();
  h.jobs[0].resolve();
  await h.settle();
  h.answer();
  assert.equal(h.log()[1].pathA.status, 'pending');
  assert.ok(h.element('pastatus').textContent.startsWith('Path A running'));
  h.jobs[1].resolve();
  await h.settle();
  h.answer();
  const log = h.log();
  assert.equal(log[0].pathA.status, 'pending');
  assert.equal(log[1].pathA.status, 'pending');
  assert.equal(log[2].pathA.status, 'completed');
  assert.deepEqual(log[2].pathA.notes, [{ start: 0.25, duration: 0.5, pitch: 60, velocity: 64 }]);
});

test('a late optional failure cannot replace the current status; current failure is recorded', async () => {
  const h = harness();
  await h.phrase();
  await h.phrase();
  h.jobs[0].reject(new Error('old phrase failed'));
  await h.settle();
  assert.ok(h.element('pastatus').textContent.startsWith('Path A running'));
  h.jobs[1].reject(new Error('current phrase failed'));
  await h.settle();
  assert.equal(h.element('pastatus').textContent, 'Path A run failed: current phrase failed');
  h.answer();
  assert.deepEqual(h.log()[0].pathA, { status: 'failed', error: 'current phrase failed' });
});

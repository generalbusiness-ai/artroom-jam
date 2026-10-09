import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { advance, createLive, singNow } from '../page/live.ts';
import { stageAt } from '../page/view.ts';
import { RHYTHM, THEME } from '../src/phrases.ts';
import { barStart, schedule } from '../src/record.ts';

// Runs the live clock in steps of 25 ms, as the page does, pressing the
// buttons at the given times. Returns the bars in the order they were
// scheduled.
function run(presses: { at: number; kind: 'tune' | 'rhythm' }[], until: number) {
  const live = createLive();
  const scheduled: { bar: number; at: number }[] = [];
  const effects: number[] = [];
  const pending = [...presses];
  for (let t = 0; t < until; t += 0.025) {
    while (pending.length && pending[0].at <= t) {
      const p = pending.shift()!;
      effects.push(
        singNow(live, t, p.kind === 'tune' ? { kind: 'tune', notes: THEME } : { kind: 'rhythm', onsets: RHYTHM }),
      );
    }
    for (const bar of advance(live, t, 0.5)) scheduled.push({ bar, at: t });
  }
  return { live, scheduled, effects };
}

test('the live clock schedules each bar once, in order, before it starts', () => {
  const { live, scheduled } = run([{ at: 0, kind: 'tune' }], 30);
  assert.deepEqual(
    scheduled.map((s) => s.bar),
    scheduled.map((_, i) => i),
  );
  for (const s of scheduled) {
    const start = barStart(live.band.log, s.bar, live.band.rules);
    assert.ok(s.at <= start && start - s.at <= 0.5 + 1e-9, `bar ${s.bar}`);
  }
});

test('a button press takes effect at its effect bar, and the stage shows it waiting until then', () => {
  const { live, effects } = run(
    [
      { at: 0, kind: 'tune' },
      { at: 20, kind: 'rhythm' },
    ],
    30,
  );
  const { log, rules } = live.band;
  // At 120 beats per minute each bar lasts two seconds; at 20 seconds,
  // bar 10 starts. The sampled 25 ms clock passes that boundary,
  // so one bar of lookahead puts the rhythm at bar 12.
  assert.deepEqual(effects, [1, 12]);
  const sing = schedule(log, rules).entries.find((s) => s.entry.type === 'sing' && s.entry.kind === 'rhythm')!;
  assert.equal(sing.effectBar, 12);
  assert.deepEqual(stageAt(log, 21, rules).pending, [{ kind: 'rhythm', effectBar: 12 }]);
  assert.equal(stageAt(log, 21, rules).tempo, 120);
  const atTwelve = barStart(log, 12, rules);
  assert.deepEqual(stageAt(log, atTwelve + 0.01, rules).pending, []);
  assert.equal(stageAt(log, atTwelve + 0.01, rules).tempo, 120);
});

test('figures appear when their part is taken and nod on the beat', () => {
  const { live } = run([{ at: 0, kind: 'tune' }], 50);
  const { log, rules } = live.band;
  const at = (bar: number, beats = 0.01) => stageAt(log, barStart(log, bar, rules) + (beats * 60) / 120, rules);
  assert.deepEqual(at(0).arrived, { synth: false, percussion: false, lead: false, bass: false });
  assert.equal(at(1).arrived.synth, true);
  assert.equal(at(8).arrived.percussion, false);
  assert.equal(at(9).arrived.percussion, true);
  assert.equal(at(17).arrived.lead, true);
  assert.equal(at(17).arrived.bass, false);
  // On the beat the nod is near 1; half way to the next beat it is small.
  assert.ok(at(5, 2.01).nod > 0.9);
  assert.equal(at(5, 2.01).beat, 2);
  assert.ok(at(5, 2.5).nod < 0.2);
});

test('the captions show recent banter with who said it', () => {
  const { live } = run([{ at: 0, kind: 'tune' }], 30);
  const { log, rules } = live.band;
  const captions = stageAt(log, barStart(log, 1, rules) + 0.1, rules).captions;
  assert.deepEqual(captions, [{ by: 'synth', text: 'I heard a tune. I think it was a tune.' }]);
  const later = stageAt(log, barStart(log, 9, rules) + 0.1, rules).captions;
  assert.ok(later.some((c) => c.by === 'percussion'));
});

// The actual loopback HTTP preview refuses malformed escapes and continues
// serving; no browser, Artroom, private file or external provider runs.
test('the local preview refuses malformed URI escapes and still serves the page', async () => {
  const server = spawn(process.execPath, ['scripts/serve-page.ts'], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const lines = createInterface({ input: server.stdout });
  try {
    const [address] = await once(lines, 'line');
    const url = new URL(address);
    const refused = await fetch(new URL('/page/%', url))
      .then(async (response) => [response.status, await response.text()])
      .catch(() => [0, 'connection lost']); // An original crashing handler fails the boundary assertion.
    assert.deepEqual(refused, [400, 'bad request']);
    // Send an invalid absolute-form target that URL construction itself
    // rejects; fetch would normalize it before reaching the handler.
    const invalidUrl = await new Promise<[number, string]>((resolve) => {
      const sent = request({ hostname: url.hostname, port: url.port, path: 'http://[', method: 'GET' }, response => {
        let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; }); response.on('end', () => resolve([response.statusCode ?? 0, body]));
      });
      sent.on('error', () => resolve([0, 'connection lost'])); sent.end();
    });
    assert.deepEqual(invalidUrl, [400, 'bad request']);
    const page = await fetch(url);
    assert.equal(page.status, 200);
    assert.ok((await page.text()).includes('<title>Jam room</title>'));
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = once(server, 'exit');
      server.kill();
      await exited;
    }
    lines.close();
  }
});

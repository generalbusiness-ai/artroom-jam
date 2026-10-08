// Runs the harness page's own inline scripts (no DOM) in a Node vm, then feeds the three WAVs through
// the page's transcribePhrase(). Exercises the transcription code path only; not the DOM, the microphone or WebAudio.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'harness/index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const ctx = vm.createContext({ performance, console, Float32Array, Uint8Array, DataView, Math, JSON, Date });
ctx.globalThis = ctx;
for (const s of scripts) new vm.Script(s).runInContext(ctx);   // also proves both scripts parse
const dec = vm.runInContext('J0.decodeWav', ctx);
for (const [f, kind] of [['hum-01-tune.wav', 'tune'], ['hum-02-rhythm.wav', 'rhythm'], ['ref-03-band.wav', 'tune']]) {
  const w = dec(fs.readFileSync(path.join(root, 'material', f)));
  ctx.__s = w.samples; ctx.__sr = w.sr;
  const r = vm.runInContext(`transcribePhrase(__s, __sr, ${JSON.stringify(kind)})`, ctx);
  console.log(f, kind, r.notes ? r.notes.length + ' notes: ' + r.notes.map((n) => n.pitch).join(',') : r.hits.length + ' hits, ' + r.hitsPerSecond + '/s', Math.round(r.ms) + ' ms');
}

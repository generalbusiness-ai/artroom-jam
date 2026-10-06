// Runs path B on the hum, the onset detector on the rhythm and band, and renders everything to work/out.
// Path A notes come from run-basicpitch.js (work/out/runs/bp-hum01-run*.json).
const fs = require('fs'), path = require('path');
const J = require('./transcribe.js');
const root = path.resolve(__dirname, '..'), mat = path.join(root, 'material'), out = path.join(root, 'work/out');
fs.mkdirSync(out, { recursive: true });
const SR = 44100, now = () => performance.now();
const load = (f) => J.decodeWav(fs.readFileSync(path.join(mat, f)));
const wr = (name, data) => fs.writeFileSync(path.join(out, name), data);
const R = (n, d = 3) => +n.toFixed(d);

function render(tag, orig, playback) {
  wr(`${tag}-playback.wav`, J.encodeWav(playback, SR));
  wr(`${tag}-compare.wav`, J.encodeWav(J.sideBySide(orig, playback, SR, 1.0), SR));
}
function timeRuns(fn, n) { const t = []; for (let i = 0; i < n; i++) { const a = now(); fn(); t.push(now() - a); } return t.map((v) => R(v, 0)); }

// Monophonic reduction of path A output: keep the strongest of overlapping notes, then merge same-pitch fragments.
function reduceMono(notes, untilSec) {
  const cand = notes.filter((n) => n.start < untilSec).sort((a, b) => b.velocity - a.velocity);
  const kept = [];
  for (const n of cand) if (!kept.some((k) => n.start < k.start + k.duration && k.start < n.start + n.duration)) kept.push(n);
  kept.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const n of kept) {
    const p = merged[merged.length - 1];
    if (p && p.pitch === n.pitch && n.start - (p.start + p.duration) <= 0.12) p.duration = R(n.start + n.duration - p.start); else merged.push({ ...n });
  }
  return merged;
}

const summary = {};
// ---- hum-01
const hum = load('hum-01-tune.wav');
let B = J.transcribeHum(hum.samples, hum.sr);
summary.pathB = { notes: B.notes.map((n) => ({ start: R(n.start), duration: R(n.duration), pitch: n.pitch, pitchExact: n.pitchExact, velocity: n.velocity, conf: n.conf })), timingMsFiveRuns: timeRuns(() => J.transcribeHum(hum.samples, hum.sr), 5) };
// same without the voicing-confidence gate, to show what the gate removed
const Braw = J.transcribeHum(hum.samples, hum.sr, { minConf: 0 });
summary.pathBNoConfGate = { count: Braw.notes.length, pitches: Braw.notes.map((n) => n.pitch) };
const bNotes = summary.pathB.notes;
wr('hum-01-pathB.json', JSON.stringify({ source: 'hum-01-tune.wav', method: 'YIN + segmentation (plain JS)', notes: bNotes }, null, 1));
wr('hum-01-pathB.mid', J.writeMidi(bNotes, 120, 0));
render('hum-01-pathB', hum.samples, J.synthNotes(bNotes, SR));

const bp = JSON.parse(fs.readFileSync(path.join(out, 'runs/bp-hum01-run1.json'), 'utf8'));
const aRaw = bp.notes, aMono = reduceMono(aRaw, 3.3);
summary.pathA = { rawCount: aRaw.length, rawBefore3_3s: aRaw.filter((n) => n.start < 3.3).length, monoReduced: aMono, loadMs: [1, 2, 3].map((i) => JSON.parse(fs.readFileSync(path.join(out, `runs/bp-hum01-run${i}.json`))).loadMs).map((v) => R(v, 1)), inferenceMs: [1, 2, 3].map((i) => JSON.parse(fs.readFileSync(path.join(out, `runs/bp-hum01-run${i}.json`))).inferenceMs.map((v) => R(v, 0))), postMs: [1, 2, 3].map((i) => JSON.parse(fs.readFileSync(path.join(out, `runs/bp-hum01-run${i}.json`))).postMs.map((v) => R(v, 0))) };
wr('hum-01-pathA-raw.json', JSON.stringify({ source: 'hum-01-tune.wav', method: '@spotify/basic-pitch 1.0.1, default note thresholds (onset 0.25, frame 0.25, min length 5 frames), all notes', notes: aRaw }, null, 1));
wr('hum-01-pathA-mono.json', JSON.stringify({ source: 'hum-01-tune.wav', method: 'basic-pitch notes before 3.3 s, strongest-wins monophonic reduction, same-pitch fragments merged', notes: aMono }, null, 1));
wr('hum-01-pathA-raw.mid', J.writeMidi(aRaw, 120, 0));
wr('hum-01-pathA-mono.mid', J.writeMidi(aMono, 120, 0));
render('hum-01-pathA-raw', hum.samples, J.synthNotes(aRaw, SR));
render('hum-01-pathA-mono', hum.samples, J.synthNotes(aMono, SR));

// contour agreement between B and A-mono (same count?)
summary.contour = { B: J.contour(bNotes.map((n) => n.pitch)), Amono: J.contour(aMono.map((n) => n.pitch)), Bpitches: bNotes.map((n) => n.pitch), Apitches: aMono.map((n) => n.pitch) };

// ---- hum-02 rhythm
const rh = load('hum-02-rhythm.wav');
const O = J.detectOnsets(rh.samples, rh.sr);
const hits = O.hits;
summary.rhythm = { count: hits.length, seconds: R(rh.samples.length / rh.sr, 2), hits, splitHz: O.splitHz, medianIoiSec: O.medianIoiSec, hitsPerSecondMedian: O.hitsPerSecondMedian, hitsPerSecondOverall: R(hits.length / ((hits[hits.length - 1].time - hits[0].time) || 1), 2), acfPeriodSec: O.acfPeriodSec, timingMsFiveRuns: timeRuns(() => J.detectOnsets(rh.samples, rh.sr), 5), low: hits.filter((h) => h.cls === 'low').length, high: hits.filter((h) => h.cls === 'high').length };
wr('hum-02-rhythm.json', JSON.stringify({ source: 'hum-02-rhythm.wav', method: 'spectral flux, adaptive median threshold, centroid 2-cluster', hits: hits.map(({ time, cls, centroidHz, strength }) => ({ time, cls, centroidHz, strength })), splitHz: O.splitHz }, null, 1));
const drumEv = hits.map((h) => ({ start: h.time, duration: 0.1, pitch: h.cls === 'low' ? 36 : 38, velocity: 100 }));
wr('hum-02-rhythm.mid', J.writeMidi(drumEv, 120, 9));
render('hum-02-rhythm', rh.samples, J.synthDrums(hits, SR));

// ---- band, tempo only
const band = load('ref-03-band.wav');
const BO = J.detectOnsets(band.samples, band.sr);
// autocorrelation of the onset strength at candidate periods
const acfAt = (flux, hop, sec) => { const lag = Math.round(sec / hop); let s = 0; for (let i = lag; i < flux.length; i++) s += flux[i] * flux[i - lag]; return s / (flux.length - lag); };
const base = acfAt(BO.flux, BO.hopSec, 0.25);
summary.band = { seconds: R(band.samples.length / band.sr, 2), onsetCount: BO.hits.length, medianIoiSec: BO.medianIoiSec, acfBestPeriodSec: BO.acfPeriodSec, acfRelative: { '0.25': 1, '0.5': R(acfAt(BO.flux, BO.hopSec, 0.5) / base, 2), '1.0': R(acfAt(BO.flux, BO.hopSec, 1.0) / base, 2) }, firstOnsets: BO.hits.slice(0, 12).map((h) => h.time) };
const bandA = JSON.parse(fs.readFileSync(path.join(out, 'runs/bp-band.json'), 'utf8'));
summary.bandPitchA = { count: bandA.notes.length, first12: bandA.notes.slice(0, 12) };
const bandB = J.transcribeHum(band.samples, band.sr, { fmin: 60, fmax: 1000 });
summary.bandPitchB = { count: bandB.notes.length, notes: bandB.notes.map((n) => ({ start: R(n.start), duration: R(n.duration), pitch: n.pitch })) };

// ---- verify MIDI files parse
const { Midi } = require(path.join(root, 'work/node_modules/@tonejs/midi'));
summary.midiCheck = {};
for (const f of fs.readdirSync(out).filter((x) => x.endsWith('.mid'))) { const m = new Midi(fs.readFileSync(path.join(out, f))); summary.midiCheck[f] = { notes: m.tracks[0].notes.length, bpm: R(m.header.tempos[0].bpm, 1) }; }

wr('summary.json', JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ B: summary.pathB.notes.map((n) => n.pitch), Bgate: summary.pathBNoConfGate, Bms: summary.pathB.timingMsFiveRuns, A: summary.pathA.monoReduced.map((n) => n.pitch), raw: summary.pathA.rawCount, rawBefore: summary.pathA.rawBefore3_3s, rhythm: { n: summary.rhythm.count, hps: summary.rhythm.hitsPerSecondMedian, overall: summary.rhythm.hitsPerSecondOverall, low: summary.rhythm.low, high: summary.rhythm.high, split: summary.rhythm.splitHz, ms: summary.rhythm.timingMsFiveRuns }, band: summary.band, midi: summary.midiCheck }, null, 0));

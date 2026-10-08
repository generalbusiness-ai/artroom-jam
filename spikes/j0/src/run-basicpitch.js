// Path A under Node: @spotify/basic-pitch 1.0.1 with its own bundled TensorFlow.js (3.21.0, CPU backend).
// Usage: node run-basicpitch.js <wav> <out.json>
// Run from spikes/j0/work (needs node_modules there).
const fs = require('fs'), path = require('path');
const work = path.resolve(__dirname, '../work');
const bpDir = path.join(work, 'node_modules/@spotify/basic-pitch');
const bp = require(bpDir);
const tf = require(path.join(bpDir, 'node_modules/@tensorflow/tfjs'));
const J = require('./transcribe.js');
const now = () => performance.now();

(async () => {
  const [wavPath, outPath] = process.argv.slice(2);
  const w = J.decodeWav(fs.readFileSync(wavPath));
  const x22 = J.resample(w.samples, w.sr, 22050);

  // Model load: read the two model files (as a page would fetch them) and build the graph model.
  let t = now();
  const modelJson = JSON.parse(fs.readFileSync(path.join(bpDir, 'model/model.json'), 'utf8'));
  const weights = fs.readFileSync(path.join(bpDir, 'model/group1-shard1of1.bin'));
  const handler = { load: async () => ({ modelTopology: modelJson.modelTopology, format: modelJson.format, generatedBy: modelJson.generatedBy, convertedBy: modelJson.convertedBy, weightSpecs: modelJson.weightsManifest[0].weights, weightData: weights.buffer.slice(weights.byteOffset, weights.byteOffset + weights.byteLength) }) };
  const modelPromise = tf.loadGraphModel(handler);
  const model = await modelPromise;
  const loadMs = now() - t;
  const pitch = new bp.BasicPitch(Promise.resolve(model));

  const runs = [];
  for (let r = 0; r < 2; r++) { // run 0 = first (cold) inference, run 1 = second (warm) inference
    const frames = [], onsets = [], contours = [];
    t = now();
    await pitch.evaluateModel(x22, (f, o, c) => { frames.push(...f); onsets.push(...o); contours.push(...c); }, () => {});
    const infMs = now() - t; t = now();
    const notes = bp.noteFramesToTime(bp.addPitchBendsToNoteEvents(contours, bp.outputToNotesPoly(frames, onsets, 0.25, 0.25, 5)));
    const postMs = now() - t;
    runs.push({ infMs, postMs, notes });
  }
  const notes = runs[1].notes.map((n) => ({ start: +n.startTimeSeconds.toFixed(3), duration: +n.durationSeconds.toFixed(3), pitch: n.pitchMidi, velocity: Math.round(n.amplitude * 127) })).sort((a, b) => a.start - b.start);
  const res = { backend: tf.getBackend(), tfjs: tf.version.tfjs, loadMs, inferenceMs: runs.map((r) => r.infMs), postMs: runs.map((r) => r.postMs), notes, audioSec: w.samples.length / w.sr };
  fs.writeFileSync(outPath, JSON.stringify(res, null, 1));
  console.log(JSON.stringify({ backend: res.backend, tfjs: res.tfjs, loadMs: +loadMs.toFixed(0), inferenceMs: res.inferenceMs.map((v) => +v.toFixed(0)), postMs: res.postMs.map((v) => +v.toFixed(0)), n: notes.length }));
})().catch((e) => { console.error(e); process.exit(1); });

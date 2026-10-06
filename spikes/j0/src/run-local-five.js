// Local-only AIFF -> whole WAV -> one unchanged path B pass -> literal playback.
// Usage: node src/run-local-five.js INPUT1.aiff ... INPUT5.aiff
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process'), { createHash } = require('node:crypto');
const J = require('./transcribe.js'), { readMidi } = require('./render-hosted.js');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'work/out/user-five');
const protocol = JSON.parse(fs.readFileSync(path.join(root, 'user-five-protocol.json')));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const wr = (name, value) => fs.writeFileSync(path.join(out, name), value, { mode: 0o600 });
const json = (name, value) => wr(name, JSON.stringify(value, null, 2) + '\n');

// Read only the documented PCM AIFF chunks used by these supplied recordings.
function sourcePcm(buf, expected) {
  assert.equal(buf.subarray(0, 4).toString(), 'FORM');
  assert.equal(buf.subarray(8, 12).toString(), 'AIFF');
  let frames, bits, pcm;
  for (let o = 12; o + 8 <= buf.length;) {
    const tag = buf.subarray(o, o + 4).toString(), len = buf.readUInt32BE(o + 4), data = o + 8;
    assert(data + len <= buf.length);
    if (tag === 'COMM') {
      assert.equal(buf.readUInt16BE(data), 1);
      frames = buf.readUInt32BE(data + 2); bits = buf.readUInt16BE(data + 6);
    }
    if (tag === 'SSND') {
      const offset = buf.readUInt32BE(data); assert.equal(buf.readUInt32BE(data + 4), 0);
      pcm = buf.subarray(data + 8 + offset, data + len);
    }
    o = data + len + (len & 1);
  }
  assert.equal(frames, expected.sample_frames); assert.equal(bits, expected.bits);
  assert(pcm && pcm.length >= frames * bits / 8);
  return { frames, bits, sample: (i) => bits === 8 ? pcm.readInt8(i) * 256 : pcm.readInt16BE(i * 2) };
}

function validate(notes, seconds) {
  let previous = null;
  assert(Array.isArray(notes));
  for (const n of notes) {
    assert(Number.isInteger(n.pitch) && n.pitch >= 0 && n.pitch <= 127);
    assert(Number.isInteger(n.velocity) && n.velocity >= 1 && n.velocity <= 127);
    assert(Number.isFinite(n.start) && Number.isFinite(n.duration) && n.start >= 0 && n.duration > 0);
    assert(n.start + n.duration <= seconds + 0.001);
    if (previous) {
      assert(n.start >= previous.start);
      assert(n.start >= previous.start + previous.duration - 0.0200001);
    }
    previous = n;
  }
}

function checkWav(file, expected, sr) {
  const read = J.decodeWav(fs.readFileSync(file));
  assert.equal(read.sr, sr); assert.equal(read.samples.length, expected.length);
  for (let i = 0; i < expected.length; i++) {
    const quantized = Math.trunc(Math.max(-1, Math.min(1, expected[i])) * 32767) / 32768;
    // Integer PCM has one zero; JS Math.trunc can produce negative zero.
    assert(read.samples[i] === quantized);
  }
  return { samples: read.samples.length, seconds: read.samples.length / sr, sample_rate: sr };
}

function main() {
  const inputs = process.argv.slice(2), resume = inputs[0] === '--resume-from-local-journal';
  if (resume) inputs.shift();
  assert.equal(inputs.length, protocol.input_count);
  const data = inputs.map((source, i) => {
    const bytes = fs.readFileSync(source), expected = protocol.inputs[i];
    assert.equal(bytes.length, expected.bytes); assert.equal(hash(bytes), expected.sha256);
    const pcm = sourcePcm(bytes, expected); assert(pcm.frames / protocol.sample_rate <= protocol.max_whole_file_seconds);
    const tag = path.basename(source, path.extname(source)); assert(/^[A-Za-z0-9_-]+$/.test(tag));
    return { source: path.resolve(source), expected, pcm, tag };
  });
  assert.equal(new Set(data.map((d) => d.expected.sha256)).size, 5);
  assert.equal(new Set(data.map((d) => d.tag)).size, 5);
  fs.mkdirSync(out, { recursive: true, mode: 0o700 });
  if (resume) assert(fs.existsSync(path.join(out, 'attempt.json')));
  fs.writeFileSync(path.join(out, resume ? 'resume-attempt.json' : 'attempt.json'), JSON.stringify({ started_utc: new Date().toISOString(), protocol }), { flag: 'wx', mode: 0o600 });
  json('input-manifest.json', data.map(({ source, expected, tag }) => ({ source, tag, ...expected })));
  const results = [];
  for (const { source, expected, pcm, tag } of data) {
    const journal = path.join(out, `${tag}.json`);
    if (resume && fs.existsSync(journal)) {
      const record = JSON.parse(fs.readFileSync(journal));
      assert.equal(record.source_sha256, expected.sha256); assert.equal(record.id, expected.id);
      assert.equal(record.transcription_calls, 1); assert(!record.validation.failed);
      assert(record.source_unchanged); results.push(record);
      console.log(JSON.stringify({ file: record.source_file, resumed_without_transcription: true, note_count: record.note_count }));
      continue;
    }
    const start = performance.now(), wavPath = path.join(out, `${tag}-source.wav`);
    const conversionStart = performance.now();
    execFileSync('/opt/homebrew/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-n', '-i', source, ...protocol.conversion, wavPath], { stdio: 'pipe', timeout: 30000 });
    fs.chmodSync(wavPath, 0o600);
    const conversionMs = performance.now() - conversionStart, decodeStart = performance.now();
    const audio = J.decodeWav(fs.readFileSync(wavPath));
    assert.equal(audio.sr, protocol.sample_rate); assert.equal(audio.samples.length, pcm.frames);
    for (let i = 0; i < pcm.frames; i++) assert.equal(audio.samples[i], pcm.sample(i) / 32768);
    const decodeAndPcmCheckMs = performance.now() - decodeStart, transcribeStart = performance.now();
    const result = J.transcribeHum(audio.samples, audio.sr);
    const transcriptionMs = performance.now() - transcribeStart, renderStart = performance.now();
    const frames = result.track.frames, lastWindowStart = (frames.length - 1) * protocol.tracker_parameters.hop;
    const record = {
      id: expected.id, source_file: path.basename(source), source_sha256: expected.sha256,
      source_bytes: expected.bytes, source_bits: expected.bits, source_unchanged: null,
      sample_rate: audio.sr, input_frames: pcm.frames, input_seconds: pcm.frames / audio.sr,
      truncated_frames: 0, transcription_calls: 1, processing: 'whole file; unchanged path B defaults',
      window_coverage: { frame_count: frames.length, window_samples: protocol.tracker_parameters.win,
        hop_samples: protocol.tracker_parameters.hop, first_window_start: 0,
        first_frame_center_seconds: frames[0].t, last_window_start: lastWindowStart,
        last_frame_center_seconds: frames[frames.length - 1].t,
        last_window_end: lastWindowStart + protocol.tracker_parameters.win,
        uncovered_tail_samples: audio.samples.length - (lastWindowStart + protocol.tracker_parameters.win) },
      notes: result.notes, note_count: result.notes.length, validation: null,
      tracker_rejected_note_count: null,
      tracker_rejection_limit: 'Existing tracker applies silence/minimum-length/confidence gates, but does not expose counts of dropped candidate notes; no second pass or instrumented algorithm used.',
      singer: null, singer_judgment: null, browser_exercised: false,
      timings_ms: { conversion: conversionMs, decode_and_pcm_check: decodeAndPcmCheckMs, transcription: transcriptionMs,
        tracker_reported: result.ms, render_and_readback: null, file_total: null }
    };
    // Journal the literal transcription before any render/readback can fail.
    json(`${tag}.json`, record);
    try {
      validate(result.notes, record.input_seconds);
      record.validation = { accepted_events: result.notes.length, rejected_events: 0, empty_notes: result.notes.length === 0 };
    } catch (error) {
      record.validation = { failed: true, error: error.message, playback_skipped: true };
    }
    if (!record.validation.failed && result.notes.length) {
      const play = J.synthNotes(result.notes, audio.sr), compare = J.sideBySide(audio.samples, play, audio.sr, 1);
      wr(`${tag}-playback.wav`, J.encodeWav(play, audio.sr));
      wr(`${tag}-compare.wav`, J.encodeWav(compare, audio.sr));
      wr(`${tag}.mid`, J.writeMidi(result.notes, 120, 0));
      const midi = readMidi(fs.readFileSync(path.join(out, `${tag}.mid`)));
      assert.equal(midi.length, result.notes.length);
      midi.forEach((n, i) => {
        const expectedNote = result.notes[i]; assert.equal(n.pitch, expectedNote.pitch); assert.equal(n.velocity, expectedNote.velocity);
        assert(Math.abs(n.start - expectedNote.start) <= 1 / 960);
        assert(Math.abs(n.duration - expectedNote.duration) <= 2 / 960);
      });
      record.validation.midi_notes_read_back = midi.length;
      record.validation.playback = checkWav(path.join(out, `${tag}-playback.wav`), play, audio.sr);
      record.validation.comparison = checkWav(path.join(out, `${tag}-compare.wav`), compare, audio.sr);
      record.outputs = { source_wav: wavPath, playback_wav: path.join(out, `${tag}-playback.wav`), comparison_wav: path.join(out, `${tag}-compare.wav`), midi: path.join(out, `${tag}.mid`) };
    }
    assert.equal(hash(fs.readFileSync(source)), expected.sha256); record.source_unchanged = true;
    record.timings_ms.render_and_readback = performance.now() - renderStart;
    record.timings_ms.file_total = performance.now() - start;
    json(`${tag}.json`, record); results.push(record);
    console.log(JSON.stringify({ id: record.id, file: record.source_file, seconds: record.input_seconds,
      note_count: record.note_count, transcription_ms: transcriptionMs, validation: record.validation }));
  }
  data.forEach(({ source, expected }) => assert.equal(hash(fs.readFileSync(source)), expected.sha256));
  json('summary.json', { date: new Date().toISOString(), protocol: 'user-five-protocol.json', supplied_recordings: 5,
    distinct_hashes: 5, known_singer_count: null, singer_judgments: 0, browser_exercises: 0,
    sources_unchanged_after_all_runs: true, results });
}

if (require.main === module) main();
module.exports = { validate, sourcePcm, checkWav };

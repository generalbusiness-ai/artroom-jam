// Validate a hosted result and render its literal events with the existing synth.
// Usage: node src/render-hosted.js /absolute/path/to/hum-01-tune.wav
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const J = require('./transcribe.js');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'work/out/hosted');
const protocol = JSON.parse(fs.readFileSync(path.join(root, 'hosted-protocol.json')));

function validateNotes(notes, seconds) {
  assert(Array.isArray(notes) && notes.length > 0 && notes.length <= 64, 'no playable note list');
  let previous = null;
  for (const n of notes) {
    assert(n && Number.isInteger(n.pitch) && n.pitch >= 0 && n.pitch <= 127, 'invalid MIDI pitch');
    assert(Number.isFinite(n.start) && Number.isFinite(n.duration), 'non-numeric time');
    assert(n.start >= 0 && n.duration > 0 && n.start + n.duration <= seconds + 0.001, 'event outside clip');
    if (previous) {
      assert(n.start >= previous.start, 'unordered starts');
      assert(n.start >= previous.start + previous.duration - 0.0200001, 'overlap above 20 ms');
    }
    previous = n;
  }
  return notes.map((n) => ({ pitch: n.pitch, start: n.start, duration: n.duration, velocity: 100 }));
}

// Read the fixed-tempo format-0 MIDI written by transcribe.js, including note offs.
function readMidi(buf) {
  assert.equal(buf.subarray(0, 4).toString(), 'MThd');
  assert.equal(buf.readUInt16BE(8), 0); assert.equal(buf.readUInt16BE(10), 1);
  const ppq = buf.readUInt16BE(12), notes = [], active = new Map();
  assert.equal(buf.subarray(14, 18).toString(), 'MTrk');
  let o = 22, ticks = 0, us = null;
  const end = o + buf.readUInt32BE(18);
  const vlq = () => { let v = 0, b; do { assert(o < end); b = buf[o++]; v = v * 128 + (b & 127); } while (b & 128); return v; };
  while (o < end) {
    ticks += vlq(); const status = buf[o++];
    if (status === 0xff) {
      const type = buf[o++], length = vlq();
      if (type === 0x51) { assert.equal(length, 3); us = buf.readUIntBE(o, 3); }
      o += length;
      if (type === 0x2f) break;
    } else {
      assert(status === 0x90 || status === 0x80); assert(us !== null);
      const pitch = buf[o++], velocity = buf[o++], seconds = ticks * us / 1e6 / ppq;
      if (status === 0x90 && velocity) { assert(!active.has(pitch)); active.set(pitch, { pitch, start: seconds, velocity }); }
      else { const n = active.get(pitch); assert(n); notes.push({ ...n, duration: seconds - n.start }); active.delete(pitch); }
    }
  }
  assert.equal(active.size, 0); return notes.sort((a, b) => a.start - b.start);
}

function main() {
  const raw = fs.readFileSync(process.argv[2]);
  assert.equal(createHash('sha256').update(raw).digest('hex'), protocol.audio.sha256);
  const audio = J.decodeWav(raw), response = JSON.parse(fs.readFileSync(path.join(out, 'response.json')));
  assert.equal(response.choices[0].finish_reason, 'stop', 'incomplete provider output');
  const content = JSON.parse(response.choices[0].message.content);
  const notes = validateNotes(content.notes, audio.samples.length / audio.sr);
  const wr = (name, data) => fs.writeFileSync(path.join(out, name), data);
  const playback = J.synthNotes(notes, audio.sr);
  wr('hum-01-hosted-playback.wav', J.encodeWav(playback, audio.sr));
  wr('hum-01-hosted-compare.wav', J.encodeWav(J.sideBySide(audio.samples, playback, audio.sr, 1), audio.sr));
  wr('hum-01-hosted.mid', J.writeMidi(notes, 120, 0));
  const midi = readMidi(fs.readFileSync(path.join(out, 'hum-01-hosted.mid')));
  assert.equal(midi.length, notes.length);
  midi.forEach((n, i) => {
    assert.equal(n.pitch, notes[i].pitch); assert.equal(n.velocity, 100);
    assert(Math.abs(n.start - notes[i].start) <= 1 / 960);
    assert(Math.abs(n.duration - notes[i].duration) <= 2 / 960);
  });
  const wav = (file, length) => {
    const read = J.decodeWav(fs.readFileSync(path.join(out, file)));
    assert.equal(read.sr, audio.sr); assert.equal(read.samples.length, length);
    assert(read.samples.some((s) => s !== 0));
    return { sample_rate: read.sr, samples: read.samples.length, seconds: read.samples.length / read.sr };
  };
  const validation = {
    checks: 'Finite bounded pitches/times, chronological starts, overlap <=20 ms; WAV decoded, MIDI note-ons/offs parsed and compared',
    playback: wav('hum-01-hosted-playback.wav', playback.length),
    comparison: wav('hum-01-hosted-compare.wav', audio.samples.length + audio.sr + playback.length),
    midi_notes_read_back: midi.length
  };
  wr('validated-notes.json', JSON.stringify({ notes, model_observations: content.observations, validation }, null, 2) + '\n');
  console.log(JSON.stringify({ notes, model_observations: content.observations, validation }));
}

if (require.main === module) main();
module.exports = { validateNotes, readMidi };

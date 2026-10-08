// J0 transcription code: plain JavaScript, no dependencies.
// Runs unchanged in a browser page (as a plain script) and under Node (require).
// Path B: monophonic pitch tracker (YIN) and note segmentation.
// Rhythm: spectral-flux onset detection with a crude low/high class.
// Also: WAV decoding/encoding, a simple synth, a standard MIDI file writer.
(function (root) {
  'use strict';

  // ---------- WAV ----------
  function decodeWav(buf) {
    const dv = new DataView(buf.buffer ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf);
    const tag = (o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file');
    let o = 12, fmt = null, data = null;
    while (o + 8 <= dv.byteLength) {
      const id = tag(o), len = dv.getUint32(o + 4, true);
      if (id === 'fmt ') fmt = { format: dv.getUint16(o + 8, true), ch: dv.getUint16(o + 10, true), sr: dv.getUint32(o + 12, true), bits: dv.getUint16(o + 22, true) };
      if (id === 'data') { data = { off: o + 8, len }; break; }
      o += 8 + len + (len & 1);
    }
    if (!fmt || !data || fmt.format !== 1 || fmt.bits !== 16) throw new Error('only 16-bit PCM WAV supported');
    const n = Math.floor(data.len / 2 / fmt.ch);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let c = 0; c < fmt.ch; c++) s += dv.getInt16(data.off + (i * fmt.ch + c) * 2, true);
      out[i] = s / fmt.ch / 32768;
    }
    return { sr: fmt.sr, samples: out };
  }

  function encodeWav(samples, sr) {
    const n = samples.length, buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    w(36, 'data'); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
    return new Uint8Array(buf);
  }

  // Halve a 44.1 kHz (or any 2x multiple) signal to 22.05 kHz with a short low-pass.
  function resample(samples, from, to) {
    if (from === to) return samples;
    const ratio = from / to, n = Math.floor(samples.length / ratio), out = new Float32Array(n);
    // windowed-sinc low pass at 0.45 * to, evaluated at the output positions
    const fc = 0.45 * to / from, half = 16 * Math.max(1, Math.round(ratio));
    for (let i = 0; i < n; i++) {
      const c = i * ratio; let acc = 0, wsum = 0;
      for (let k = Math.ceil(c - half); k <= Math.floor(c + half); k++) {
        if (k < 0 || k >= samples.length) continue;
        const x = k - c, sinc = x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
        const win = 0.5 + 0.5 * Math.cos(Math.PI * x / half);
        const h = sinc * win; acc += h * samples[k]; wsum += h;
      }
      out[i] = wsum ? acc / wsum : 0;
    }
    return out;
  }

  // ---------- Path B: YIN pitch tracker ----------
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const ftom = (f) => 69 + 12 * Math.log2(f / 440);
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

  function yinTrack(x, sr, opts) {
    const o = Object.assign({ win: 2048, hop: 441, fmin: 70, fmax: 700, thresh: 0.15, rmsFloor: 0.01 }, opts || {});
    const tauMax = Math.min(Math.floor(sr / o.fmin), o.win - 1), tauMin = Math.max(2, Math.floor(sr / o.fmax));
    const W = o.win - tauMax, d = new Float32Array(tauMax + 1), cm = new Float32Array(tauMax + 1);
    const frames = [];
    for (let s = 0; s + o.win <= x.length; s += o.hop) {
      let e = 0; for (let i = 0; i < o.win; i++) e += x[s + i] * x[s + i];
      const rms = Math.sqrt(e / o.win);
      let f0 = 0, conf = 0;
      if (rms >= o.rmsFloor) {
        for (let tau = 1; tau <= tauMax; tau++) {
          let sum = 0;
          for (let i = 0; i < W; i++) { const v = x[s + i] - x[s + i + tau]; sum += v * v; }
          d[tau] = sum;
        }
        cm[0] = 1; let run = 0;
        for (let tau = 1; tau <= tauMax; tau++) { run += d[tau]; cm[tau] = run ? d[tau] * tau / run : 1; }
        let best = -1;
        for (let tau = tauMin; tau < tauMax; tau++) {
          if (cm[tau] < o.thresh) { while (tau + 1 < tauMax && cm[tau + 1] < cm[tau]) tau++; best = tau; break; }
        }
        if (best > 0) {
          const a = cm[best - 1], b = cm[best], c = cm[best + 1], den = a - 2 * b + c;
          const t = den ? best + 0.5 * (a - c) / den : best;
          f0 = sr / t; conf = 1 - b;
        }
      }
      frames.push({ t: (s + o.win / 2) / sr, f0, midi: f0 ? ftom(f0) : 0, conf, rms });
    }
    return { frames, hopSec: o.hop / sr };
  }

  // Note segmentation: median filter, split on pitch jumps > 1 semitone or on silence/energy dip, min length.
  function segmentNotes(track, opts) {
    const o = Object.assign({ medianLen: 5, jump: 1.0, jumpFrames: 2, gapFrames: 3, minNote: 0.06, minConf: 0.9, rmsRel: 0.12 }, opts || {});
    const fr = track.frames, hop = track.hopSec, n = fr.length;
    // frames quieter than rmsRel of the loudest frame count as unvoiced (room tail, breath)
    const maxRms = Math.max(0, ...fr.map((f) => f.rms)), floor = o.rmsRel * maxRms;
    for (const f of fr) if (f.rms < floor) { f.f0 = 0; f.midi = 0; }
    // median filter over voiced neighbours
    const m = fr.map((f, i) => {
      if (!f.f0) return 0;
      const nb = []; for (let k = -(o.medianLen >> 1); k <= (o.medianLen >> 1); k++) { const g = fr[i + k]; if (g && g.f0) nb.push(g.midi); }
      return median(nb);
    });
    const notes = []; let cur = null, off = 0, jumpCount = 0, gap = 0;
    const close = (endIdx) => {
      if (!cur) return;
      const dur = (endIdx - cur.s + 1) * hop;
      if (dur >= o.minNote && cur.p.length && cur.c.reduce((a, b) => a + b, 0) / cur.c.length >= o.minConf) {
        const rmsMax = Math.max(...cur.r);
        notes.push({ start: fr[cur.s].t - hop / 2, duration: dur, pitch: Math.round(median(cur.p)), pitchExact: +median(cur.p).toFixed(2), velocity: Math.max(30, Math.min(127, Math.round(30 + 97 * rmsMax / maxRms))), conf: +(cur.c.reduce((a, b) => a + b, 0) / cur.c.length).toFixed(2) });
      }
      cur = null;
    };
    for (let i = 0; i < n; i++) {
      const v = m[i];
      if (!v) { gap++; if (cur && gap >= o.gapFrames) { close(i - gap); } continue; }
      if (cur && gap > 0 && gap < o.gapFrames) { /* short dropout bridged */ }
      gap = 0;
      if (!cur) { cur = { s: i, p: [v], r: [fr[i].rms], c: [fr[i].conf] }; jumpCount = 0; continue; }
      const ref = median(cur.p.slice(-7));
      if (Math.abs(v - ref) > o.jump) {
        jumpCount++;
        if (jumpCount >= o.jumpFrames) { const cut = i - jumpCount; close(cut); cur = { s: cut + 1, p: [], r: [], c: [] }; for (let k = cut + 1; k <= i; k++) if (m[k]) { cur.p.push(m[k]); cur.r.push(fr[k].rms); cur.c.push(fr[k].conf); } jumpCount = 0; }
        continue;
      }
      jumpCount = 0;
      cur.p.push(v); cur.r.push(fr[i].rms); cur.c.push(fr[i].conf);
    }
    if (cur) close(n - 1 - gap);
    return notes;
  }

  function transcribeHum(samples, sr, opts) {
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    const track = yinTrack(samples, sr, opts);
    const notes = segmentNotes(track, opts);
    const ms = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
    return { notes, ms, track };
  }

  // ---------- Rhythm: onset detection ----------
  function fftInPlace(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }

  function spectra(x, sr, N, hop) {
    const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
    const out = [], re = new Float32Array(N), im = new Float32Array(N);
    for (let s = 0; s + N <= x.length; s += hop) {
      for (let i = 0; i < N; i++) { re[i] = x[s + i] * win[i]; im[i] = 0; }
      fftInPlace(re, im);
      const mag = new Float32Array(N / 2);
      for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
      out.push({ t: (s + N / 2) / sr, mag });
    }
    return out;
  }

  function detectOnsets(x, sr, opts) {
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    const o = Object.assign({ N: 1024, hop: 256, medianSec: 0.25, k: 1.5, floorRel: 0.15, minGap: 0.08 }, opts || {});
    const S = spectra(x, sr, o.N, o.hop), hopSec = o.hop / sr;
    // half-wave rectified flux on log-compressed magnitudes, 60 Hz and up
    const k0 = Math.floor(60 * o.N / sr), flux = new Float32Array(S.length);
    for (let i = 1; i < S.length; i++) {
      let f = 0; for (let k = k0; k < o.N / 2; k++) { const d = Math.log1p(100 * S[i].mag[k]) - Math.log1p(100 * S[i - 1].mag[k]); if (d > 0) f += d; }
      flux[i] = f;
    }
    const maxFlux = Math.max(...flux), half = Math.round(o.medianSec / hopSec / 2), onsets = [];
    for (let i = 2; i < S.length - 2; i++) {
      if (!(flux[i] >= flux[i - 1] && flux[i] > flux[i + 1] && flux[i] >= flux[i - 2] && flux[i] > flux[i + 2])) continue;
      const nb = []; for (let k = Math.max(0, i - half); k <= Math.min(S.length - 1, i + half); k++) nb.push(flux[k]);
      const thr = Math.max(median(nb) * (1 + o.k), o.floorRel * maxFlux);
      if (flux[i] < thr) continue;
      const t = S[i].t - o.N / 2 / sr; // frame start: the attack begins inside the frame
      if (onsets.length && t - onsets[onsets.length - 1].time < o.minGap) { if (flux[i] > onsets[onsets.length - 1].strength) onsets[onsets.length - 1] = { time: t, strength: flux[i], idx: i }; continue; }
      onsets.push({ time: t, strength: flux[i], idx: i });
    }
    // spectral centroid over the 40 ms after each onset
    const cframes = Math.max(2, Math.round(0.04 / hopSec));
    for (const on of onsets) {
      let num = 0, den = 0;
      for (let i = on.idx; i < Math.min(S.length, on.idx + cframes); i++) for (let k = 1; k < o.N / 2; k++) { const f = k * sr / o.N; num += f * S[i].mag[k]; den += S[i].mag[k]; }
      on.centroid = den ? num / den : 0;
    }
    // two-cluster split of log centroid (1-D k-means), low = kick, high = snare
    if (onsets.length) {
      const v = onsets.map((a) => Math.log(a.centroid + 1));
      let lo = Math.min(...v), hi = Math.max(...v);
      for (let it = 0; it < 20; it++) {
        let sl = 0, nl = 0, sh = 0, nh = 0;
        for (const a of v) { if (Math.abs(a - lo) <= Math.abs(a - hi)) { sl += a; nl++; } else { sh += a; nh++; } }
        if (nl) lo = sl / nl; if (nh) hi = sh / nh;
      }
      const cut = (lo + hi) / 2;
      for (const a of onsets) a.cls = Math.log(a.centroid + 1) <= cut ? 'low' : 'high';
      onsets.splitHz = Math.round(Math.exp(cut));
    }
    // tempo: median inter-onset interval and autocorrelation of the onset strength
    const iois = []; for (let i = 1; i < onsets.length; i++) iois.push(onsets[i].time - onsets[i - 1].time);
    const medIoi = median(iois);
    let bestLag = 0, bestV = -1; const minLag = Math.round(0.15 / hopSec), maxLag = Math.round(1.0 / hopSec);
    for (let lag = minLag; lag <= maxLag; lag++) { let s = 0; for (let i = lag; i < flux.length; i++) s += flux[i] * flux[i - lag]; s /= (flux.length - lag); if (s > bestV) { bestV = s; bestLag = lag; } }
    const ms = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
    return {
      hits: onsets.map((a) => ({ time: +a.time.toFixed(4), cls: a.cls, centroidHz: Math.round(a.centroid), strength: +a.strength.toFixed(2) })),
      splitHz: onsets.splitHz, medianIoiSec: +medIoi.toFixed(4),
      hitsPerSecondMedian: medIoi ? +(1 / medIoi).toFixed(2) : 0,
      acfPeriodSec: +(bestLag * hopSec).toFixed(4), acfBpmAtPeriod: bestLag ? +(60 / (bestLag * hopSec)).toFixed(1) : 0,
      ms, flux, hopSec,
    };
  }

  // ---------- Synth ----------
  function synthNotes(notes, sr, tail) {
    const end = Math.max(0, ...notes.map((n) => n.start + n.duration)) + (tail || 0.4);
    const out = new Float32Array(Math.ceil(end * sr));
    for (const n of notes) {
      const f = mtof(n.pitch), s0 = Math.floor(n.start * sr), len = Math.floor((n.duration + 0.05) * sr), amp = 0.3 * (n.velocity / 127);
      for (let i = 0; i < len && s0 + i < out.length; i++) {
        const t = i / sr, att = Math.min(1, t / 0.01), rel = Math.min(1, Math.max(0, (len / sr - t) / 0.05));
        const ph = 2 * Math.PI * f * t, tri = (2 / Math.PI) * Math.asin(Math.sin(ph));
        out[s0 + i] += amp * att * rel * (0.7 * tri + 0.3 * Math.sin(ph));
      }
    }
    return out;
  }

  function synthDrums(hits, sr, tail) {
    const end = Math.max(0, ...hits.map((h) => h.time)) + (tail || 0.5);
    const out = new Float32Array(Math.ceil(end * sr));
    let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
    for (const h of hits) {
      const s0 = Math.floor(h.time * sr);
      if (h.cls === 'low') { // thump: falling sine
        const len = Math.floor(0.18 * sr);
        for (let i = 0; i < len && s0 + i < out.length; i++) { const t = i / sr, f = 50 + 90 * Math.exp(-t * 40); out[s0 + i] += 0.7 * Math.exp(-t * 22) * Math.sin(2 * Math.PI * f * t + 0); }
      } else { // noise burst, high-passed by differencing
        const len = Math.floor(0.12 * sr); let prev = 0;
        for (let i = 0; i < len && s0 + i < out.length; i++) { const t = i / sr, nz = rnd(); out[s0 + i] += 0.4 * Math.exp(-t * 38) * (nz - 0.6 * prev); prev = nz; }
      }
    }
    return out;
  }

  function concat(...parts) { let n = 0; for (const p of parts) n += p.length; const o = new Float32Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; }
  function sideBySide(orig, play, sr, gapSec) { return concat(orig, new Float32Array(Math.round(sr * (gapSec || 1))), play); }

  // ---------- Standard MIDI file (format 0, 480 ppq, fixed tempo) ----------
  function writeMidi(events, bpm, channel) {
    // events: [{start, duration, pitch, velocity}] in seconds; channel 9 for drums
    const ppq = 480, usPerBeat = Math.round(60e6 / bpm), tick = (s) => Math.round(s * bpm / 60 * ppq);
    const vlq = (v) => { const b = [v & 127]; while ((v >>= 7)) b.unshift((v & 127) | 128); return b; };
    const ev = [];
    for (const e of events) { ev.push([tick(e.start), 1, [0x90 | channel, e.pitch, e.velocity]]); ev.push([tick(e.start + e.duration), 0, [0x80 | channel, e.pitch, 0]]); }
    ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const tr = [0, 0xff, 0x51, 3, (usPerBeat >> 16) & 255, (usPerBeat >> 8) & 255, usPerBeat & 255];
    let last = 0; for (const [t, , d] of ev) { tr.push(...vlq(t - last), ...d); last = t; }
    tr.push(0, 0xff, 0x2f, 0);
    const hdr = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, ppq >> 8, ppq & 255];
    const th = [0x4d, 0x54, 0x72, 0x6b, (tr.length >>> 24) & 255, (tr.length >>> 16) & 255, (tr.length >>> 8) & 255, tr.length & 255];
    return new Uint8Array([...hdr, ...th, ...tr]);
  }

  // Contour: signed semitone steps between successive notes
  const contour = (pitches) => pitches.slice(1).map((p, i) => p - pitches[i]);

  const api = { decodeWav, encodeWav, resample, yinTrack, segmentNotes, transcribeHum, detectOnsets, synthNotes, synthDrums, concat, sideBySide, writeMidi, contour, mtof, ftom, median };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.J0 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

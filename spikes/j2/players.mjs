// STAND-INS: deterministic functions, not agents, model calls or musicianship.
export const prompts = Object.freeze({
  synth: 'Read the symbolic theme. Interpret its key, quarter-note BPM, meter and quantized notes; write a synth phrase. Use the active and pending interpretations, clock, recent parts, holders, solo and banter. Never choose a start bar.',
  bass: 'Write a sparse bass phrase supporting the named interpretation. Read the active and pending themes, clock, recent parts, holders, solo and banter. Never choose a start bar.',
  drums: 'Write a percussion phrase supporting the named interpretation. Read the active and pending themes, clock, recent parts, holders, solo and banter. Never choose a start bar.',
  lead: 'Write a short lead answer to the named theme, leaving space for the other parts. Read the active and pending interpretations, clock, recent parts, holders, solo and banter. Never choose a start bar.',
});

function pattern(player, interpretation, bars) {
  const secondsPerBeat = 60 / interpretation.bpm;
  const quartersPerBar = interpretation.meter[0] * 4 / interpretation.meter[1];
  const notes = [];
  for (let bar = 0; bar < bars; bar++) {
    if (player === 'drums') {
      for (let beat = 0; beat < quartersPerBar; beat++) notes.push({ start: (bar * quartersPerBar + beat) * secondsPerBeat, duration: 0.1, pitch: beat % 2 === 0 ? 36 : 38, velocity: 75 });
    } else if (player === 'bass') {
      notes.push({ start: bar * quartersPerBar * secondsPerBeat, duration: secondsPerBeat * 1.5, pitch: interpretation.quantized[0].pitch - 24, velocity: 65 });
    } else {
      for (const note of interpretation.quantized) notes.push({ start: (bar * quartersPerBar + note.beat) * secondsPerBeat, duration: note.beats * secondsPerBeat, pitch: note.pitch + (player === 'lead' ? 12 : 0), velocity: player === 'lead' ? 65 : note.velocity });
    }
  }
  return { player, interpretation: interpretation.seq, bars, notes };
}

export const scriptedPlayers = Object.fromEntries(Object.keys(prompts).map((player) => [player, {
  prompt: prompts[player],
  interpret(theme) {
    if (player !== 'synth') throw new Error('only the synth interprets');
    // STAND-IN: fixture metadata supplies key and tempo; nothing estimates them.
    const { key, bpm, meter } = theme.scriptedInterpretation;
    return { theme: theme.id, key, bpm, meter, quantized: theme.notes.map((note) => ({ beat: Math.round(note.start * bpm / 60 * 2) / 2, beats: Math.max(0.25, Math.round(note.duration * bpm / 60 * 2) / 2), pitch: note.pitch, velocity: note.velocity })) };
  },
  phrase(perception, interpretation, bars) {
    if (perception.holders[player] !== player || ![perception.activeInterpretation, ...perception.pendingInterpretations].some((entry) => entry?.seq === interpretation.seq)) throw new Error('the scripted player lacks the interpretation or instrument');
    return pattern(player, interpretation, bars);
  },
}]));

// A caller supplies a future authorized invoker. This module supplies no provider
// implementation, model choice or network call. The scripted run never uses it.
export function measuredModelAdapter(invoke, { now = () => performance.now(), clock = 'performance.now' } = {}) {
  const calls = [];
  return {
    calls,
    async call(request) {
      const record = { call: calls.length + 1, player: request.player, purpose: request.purpose, clock, startedMs: now(), latencyMs: null, status: 'pending', cost: null, model: null };
      calls.push(record); // Keep the attempt even if the invoker fails.
      try {
        const reply = await invoke(structuredClone(request));
        const cost = reply.cost ?? null; // Unknown is not free.
        if (cost !== null && (!Number.isFinite(cost.amount) || cost.amount < 0 || typeof cost.currency !== 'string' || !cost.currency)) throw new TypeError('cost must state a nonnegative amount and currency, or null');
        record.cost = structuredClone(cost);
        record.model = reply.model ?? null;
        record.status = 'answered';
        return reply.answer;
      } catch (error) {
        record.status = 'failed';
        throw error;
      } finally {
        record.latencyMs = now() - record.startedMs;
      }
    },
  };
}

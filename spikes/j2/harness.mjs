import { deriveSchedule } from './schedule.mjs';
import { scriptedPlayers } from './players.mjs';

// STAND-IN for a clock: no sleeps and no wall-clock latency claims.
export class SimulatedClock {
  timeMs = 0;
  advanceTo(timeMs) {
    if (!Number.isSafeInteger(timeMs) || timeMs < this.timeMs) throw new RangeError('the simulated clock cannot go backwards');
    this.timeMs = timeMs;
  }
}

export function deliveredHistory(record, player, timeMs) {
  const delivered = new Set(record.deliveries.filter((delivery) => delivery.player === player && delivery.receivedAtMs <= timeMs).map((delivery) => delivery.seq));
  const firstMissing = record.history.findIndex((entry) => !delivered.has(entry.seq));
  return record.history.slice(0, firstMissing < 0 ? record.history.length : firstMissing);
}

export function perception(history, timeMs, protocol) {
  const schedule = deriveSchedule(history, protocol.foundingLookaheadMs);
  const interpretations = schedule?.interpretationsAt(timeMs) ?? { active: null, pending: [] };
  const knownTheme = (id) => history.findLast((entry) => entry.kind === 'sing' && entry.theme.id === id)?.theme ?? null;
  return {
    theme: knownTheme(interpretations.active?.theme),
    activeInterpretation: interpretations.active,
    pendingInterpretations: interpretations.pending.map((entry) => ({ ...entry, themeData: knownTheme(entry.theme) })),
    activeLookaheadMs: schedule?.activeLookahead(timeMs) ?? protocol.foundingLookaheadMs,
    pendingLookaheads: history.filter((entry) => entry.kind === 'lookahead' && schedule?.rows.find((row) => row.seq === entry.seq) && schedule.boundaryMs(schedule.rows.find((row) => row.seq === entry.seq).effectBar) > timeMs),
    position: schedule?.positionAt(timeMs) ?? null,
    recentParts: history.filter((entry) => entry.kind === 'pattern').slice(-protocol.players.length * 2),
    holders: Object.fromEntries(history.filter((entry) => entry.kind === 'take').map((entry) => [entry.instrument, entry.player])),
    solo: null, // No solo or banter is scripted in this bounded preparation.
    banter: [],
  };
}

export function scriptedRun(protocol, themes) {
  const clock = new SimulatedClock();
  const record = { evidence: 'Scripted commits/deliveries/players; synthetic themes; no Artroom authority or actual model calls', history: [], deliveries: [], perceptions: [], modelCalls: null };
  const append = (kind, body) => {
    const entry = structuredClone({ seq: record.history.length, timeMs: clock.timeMs, kind, ...body });
    record.history.push(entry);
    for (const [index, player] of protocol.players.entries()) record.deliveries.push({ seq: entry.seq, player, receivedAtMs: entry.timeMs + protocol.deliveryDelayMs[index] });
    return entry;
  };
  for (const [index, theme] of themes.entries()) {
    clock.advanceTo(protocol.themeStopsMs[index]);
    append('sing', { theme });
    if (index === 0) for (const player of protocol.players) append('take', { instrument: player, player });
    clock.advanceTo(protocol.themeStopsMs[index] + protocol.interpretationDelayMs);
    const interpretation = append('interpret', scriptedPlayers.synth.interpret(theme));
    for (const [playerIndex, player] of protocol.players.entries()) {
      clock.advanceTo(protocol.themeStopsMs[index] + protocol.patternOffsetsMs[playerIndex]);
      const seen = perception(deliveredHistory(record, player, clock.timeMs), clock.timeMs, protocol);
      record.perceptions.push({ player, atMs: clock.timeMs, value: seen });
      append('pattern', scriptedPlayers[player].phrase(seen, interpretation, protocol.phraseBars));
    }
  }
  return record;
}

export function summarize(record, protocol) {
  const schedule = deriveSchedule(record.history, protocol.foundingLookaheadMs);
  const patterns = record.history.filter((entry) => entry.kind === 'pattern');
  const starts = patterns.map((entry) => ({ seq: entry.seq, player: entry.player, interpretation: entry.interpretation, bar: schedule.rows.find((row) => row.seq === entry.seq).effectBar }));
  const before = record.deliveries.filter((delivery) => starts.some((start) => start.seq === delivery.seq && delivery.receivedAtMs < schedule.boundaryMs(start.bar)));
  const total = patterns.length * protocol.players.length;
  const groups = record.history.filter((entry) => entry.kind === 'interpret').map((entry) => {
    const selected = starts.filter((start) => start.interpretation === entry.seq);
    const stop = record.history.find((theme) => theme.kind === 'sing' && theme.theme.id === entry.theme).timeMs;
    return { interpretation: entry.seq, theme: entry.theme, bars: selected.map((start) => start.bar), firstDownbeatMs: Math.min(...selected.map((start) => schedule.boundaryMs(start.bar))), stopMs: stop };
  });
  const percentage = before.length / total * 100;
  return {
    evidence: 'Calculated from the frozen simulation; no measured network/model performance or musical judgment',
    patternDeliveries: total, deliveredBeforeStart: before.length, deliveredBeforeStartPercent: percentage,
    groups, derived: { origin: schedule.origin, rows: schedule.rows, segments: schedule.segments, starts },
    claims: {
      deliveredBeforeStart: percentage >= protocol.claims.deliveredBeforeStartPercent,
      downbeat: groups.every((group) => group.firstDownbeatMs - group.stopMs <= protocol.claims.firstDownbeatAfterStopMs),
      secondThemeOnOneBoundary: new Set(groups[1].bars).size === 1,
    },
    actualModelCalls: null, actualModelLatency: null, actualModelCost: null, musicalJudgment: null,
  };
}

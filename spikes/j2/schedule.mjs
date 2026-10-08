// Jam R9 section 2. This is application scheduling, not Artroom replay.
// Integer milliseconds, integer quarter-note BPM and a two-integer meter.
// Rational boundaries keep ceil exact, including a tempo such as 90 BPM.
const gcd = (a, b) => b === 0n ? a : gcd(b, a % b);
const rational = (n, d = 1n) => { const g = gcd(n < 0n ? -n : n, d); return { n: n / g, d: d / g }; };
const add = (a, b) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
const subtract = (a, b) => rational(a.n * b.d - b.n * a.d, a.d * b.d);
const times = (a, n) => rational(a.n * BigInt(n), a.d);
const compare = (a, b) => a.n * b.d - b.n * a.d;
const asNumber = (a) => Number(a.n) / Number(a.d);
const integer = (value, name, min = 0) => {
  if (!Number.isSafeInteger(value) || value < min) throw new RangeError(`${name} must be a safe integer >= ${min}`);
  return value;
};
const milliseconds = (value) => rational(BigInt(integer(value, 'timeMs')));
const duration = ({ bpm, meter }) => {
  integer(bpm, 'bpm', 1);
  if (!Array.isArray(meter) || meter.length !== 2) throw new TypeError('meter must have two integers');
  return rational(60000n * BigInt(integer(meter[0], 'meter numerator', 1)) * 4n,
    BigInt(bpm) * BigInt(integer(meter[1], 'meter denominator', 1)));
};

export function deriveSchedule(history, foundingLookaheadMs) {
  integer(foundingLookaheadMs, 'foundingLookaheadMs', 1);
  let previousTime = -1;
  for (const [seq, entry] of history.entries()) {
    if (entry.seq !== seq || integer(entry.timeMs, 'entry time') < previousTime) throw new Error('history must be contiguous and time ordered');
    if ('effectBar' in entry || 'startBar' in entry) throw new Error('players cannot select an effect bar');
    previousTime = entry.timeMs;
  }
  const origin = history.find((entry) => entry.kind === 'interpret');
  if (!origin) return null; // Themes and instrument takes may precede the transport.
  const segments = [{ bar: 1, at: milliseconds(origin.timeMs), duration: duration(origin), bpm: origin.bpm, meter: origin.meter }];
  const rows = [];
  const lookaheads = [];
  const interpretations = [];
  const segmentAtBar = (bar) => segments.findLast((segment) => segment.bar <= bar);
  const boundary = (bar) => {
    integer(bar, 'bar', 1);
    const segment = segmentAtBar(bar);
    return add(segment.at, times(segment.duration, bar - segment.bar));
  };
  const firstBarAt = (at) => {
    const segment = segments.findLast((held) => compare(held.at, at) <= 0n) ?? segments[0];
    const delta = subtract(at, segment.at);
    if (delta.n <= 0n) return segment.bar;
    const n = delta.n * segment.duration.d;
    const d = delta.d * segment.duration.n;
    const steps = (n + d - 1n) / d;
    const bar = segment.bar + Number(steps);
    integer(bar, 'derived bar', 1);
    const next = segments.find((held) => held.bar > segment.bar);
    return next ? Math.min(bar, next.bar) : bar;
  };
  const activeLookahead = (timeMs) => lookaheads.findLast((change) => compare(boundary(change.effectBar), milliseconds(timeMs)) <= 0n)?.lookaheadMs ?? foundingLookaheadMs;
  let previousBar = 1;
  for (const entry of history.slice(origin.seq)) {
    const lookaheadMs = activeLookahead(entry.timeMs);
    const requested = add(milliseconds(entry.timeMs), rational(BigInt(lookaheadMs)));
    const earliest = firstBarAt(requested);
    const effectBar = Math.max(previousBar, earliest);
    const row = { seq: entry.seq, kind: entry.kind, effectBar, lookaheadMs };
    rows.push(row);
    previousBar = effectBar;
    if (entry.kind === 'lookahead') {
      integer(entry.lookaheadMs, 'lookaheadMs', 1);
      lookaheads.push({ ...row, lookaheadMs: entry.lookaheadMs });
    }
    if (entry.kind === 'interpret') {
      const at = boundary(effectBar); // The existing boundary, before this change.
      const next = { bar: effectBar, at, duration: duration(entry), bpm: entry.bpm, meter: entry.meter };
      if (segments.at(-1).bar === effectBar) segments.pop(); // Higher sequence wins a tie.
      segments.push(next);
      interpretations.push({ ...entry, effectBar });
    }
  }
  return {
    origin: { seq: origin.seq, timeMs: origin.timeMs }, rows,
    segments: segments.map((segment) => ({ bar: segment.bar, boundary: { numerator: String(segment.at.n), denominator: String(segment.at.d) }, bpm: segment.bpm, meter: segment.meter })),
    boundaryMs: (bar) => asNumber(boundary(bar)),
    activeLookahead,
    interpretationsAt(timeMs) {
      const known = interpretations.filter((entry) => entry.timeMs <= timeMs);
      return {
        active: known.findLast((entry) => compare(boundary(entry.effectBar), milliseconds(timeMs)) <= 0n) ?? null,
        pending: known.filter((entry) => compare(boundary(entry.effectBar), milliseconds(timeMs)) > 0n),
      };
    },
    positionAt(timeMs) {
      const at = milliseconds(timeMs);
      if (compare(at, segments[0].at) < 0n) return null;
      const segment = segments.findLast((held) => compare(held.at, at) <= 0n);
      const delta = subtract(at, segment.at);
      const n = delta.n * segment.duration.d, d = delta.d * segment.duration.n;
      const elapsedBars = Number(n / d);
      const quartersPerBar = segment.meter[0] * 4 / segment.meter[1];
      return { bar: segment.bar + elapsedBars, beat: 1 + Number(n % d) / Number(d) * quartersPerBar };
    },
  };
}

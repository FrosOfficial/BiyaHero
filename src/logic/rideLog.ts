// Stop-to-stop timing for one ride. Pure functions, no phone APIs.
//
// While riding, we note the moment you pass each stop. From those moments we
// get how long each leg took (e.g. Makati Sq. -> Kerera: 2m 10s) and its
// average speed.

export interface Segment {
  from: string; // stop name the leg started at
  to: string; // stop name the leg ended at
  sec: number; // how long the leg took
  kph: number | null; // average speed on that leg
}

export interface RideStats {
  segments: Segment[];
  avgKph: number | null; // whole ride
  maxKph: number | null; // fastest GPS reading
}

/**
 * Build the legs of a ride.
 * @param names     stop names in route order
 * @param offsets   meters along the route for each stop
 * @param board     index of the stop you got on at
 * @param dest      index of your stop
 * @param passed    stop index -> time (ms) you passed it
 * @param startedAt when the ride started (counts as passing the board stop)
 * @param endedAt   when the ride ended (closes the last leg if it's still open)
 */
export function buildSegments(
  names: string[],
  offsets: number[],
  board: number,
  dest: number,
  passed: Record<number, number>,
  startedAt: number,
  endedAt?: number
): Segment[] {
  const out: Segment[] = [];
  let prevIdx = board;
  let prevT = startedAt;
  for (let i = board + 1; i <= dest; i++) {
    let t = passed[i];
    if (t == null && i === dest && endedAt != null) t = endedAt; // got off before GPS marked it
    if (t == null) continue;
    const sec = Math.max(1, Math.round((t - prevT) / 1000));
    const meters = offsets[i] - offsets[prevIdx];
    out.push({ from: names[prevIdx], to: names[i], sec, kph: meters > 0 ? (meters / sec) * 3.6 : null });
    prevIdx = i;
    prevT = t;
  }
  return out;
}

/** "45s", "2m 10s", "1h 03m" */
export function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

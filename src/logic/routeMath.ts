// Pure route math: no React, no phone APIs. Easy to test and reason about.
import { Direction, LatLngTuple, RouteStop, RouteVariant, SKIPPED_STOPS_GREEN, lineFor, stopsFor } from '../data/route';
import { JEEP_FARE, MOTO_TAXI, MOTO_TAXI_PUBLISHED, CO2_SAVED_G_PER_KM, JEEP_SPEED_M_PER_MIN } from '../data/fares';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const x = (((b.longitude - a.longitude) * Math.PI) / 180) * Math.cos((((a.latitude + b.latitude) / 2) * Math.PI) / 180);
  const y = ((b.latitude - a.latitude) * Math.PI) / 180;
  return Math.sqrt(x * x + y * y) * R;
}

// ---------- the route line ----------

interface LineCache {
  pts: LatLngTuple[];
  cum: number[]; // meters from the start of the line to each point
}
const cache: Partial<Record<Direction, LineCache>> = {};

function lineData(dir: Direction): LineCache {
  const hit = cache[dir];
  if (hit) return hit;
  const pts = lineFor(dir);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + distanceMeters(tuple(pts[i - 1]), tuple(pts[i])));
  }
  const out = { pts, cum };
  cache[dir] = out;
  return out;
}

const tuple = (p: LatLngTuple): LatLng => ({ latitude: p[0], longitude: p[1] });

export function routeLength(dir: Direction): number {
  const { cum } = lineData(dir);
  return cum[cum.length - 1] ?? 0;
}

export interface Progress {
  along: number; // meters from the start of the line (in this direction)
  offRoute: number; // meters away from the line
}

/** Snap a GPS point onto the drawn route line for a direction. */
export function progressOnRoute(p: LatLng, dir: Direction): Progress {
  const { pts, cum } = lineData(dir);
  const k = Math.cos((p.latitude * Math.PI) / 180);
  const R = 6371000;
  const toXY = (s: LatLngTuple) => ({
    x: (((s[1] - p.longitude) * Math.PI) / 180) * R * k,
    y: (((s[0] - p.latitude) * Math.PI) / 180) * R,
  });
  let best: Progress = { along: 0, offRoute: Infinity };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = toXY(pts[i]);
    const b = toXY(pts[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, (-a.x * dx - a.y * dy) / len2)); // point is at (0,0)
    const cx = a.x + t * dx;
    const cy = a.y + t * dy;
    const d = Math.sqrt(cx * cx + cy * cy);
    if (d < best.offRoute) best = { along: cum[i] + t * (cum[i + 1] - cum[i]), offRoute: d };
  }
  return best;
}

/** The [lat, lng] point at a distance `along` (meters) down the line. Used to
 *  glide the ride map smoothly along the route instead of jumping with raw GPS. */
export function pointAlong(dir: Direction, along: number): LatLng {
  const { pts, cum } = lineData(dir);
  if (pts.length === 0) return { latitude: 0, longitude: 0 };
  const total = cum[cum.length - 1] || 0;
  const d = Math.max(0, Math.min(along, total));
  for (let i = 1; i < pts.length; i++) {
    if (cum[i] >= d) {
      const seg = cum[i] - cum[i - 1] || 1;
      const t = (d - cum[i - 1]) / seg;
      const a = tuple(pts[i - 1]);
      const b = tuple(pts[i]);
      return { latitude: a.latitude + t * (b.latitude - a.latitude), longitude: a.longitude + t * (b.longitude - a.longitude) };
    }
  }
  return tuple(pts[pts.length - 1]);
}

/** Position of each stop (in stopsFor(dir) order) along the line, in meters. */
const offsetCache: Partial<Record<Direction, number[]>> = {};
export function stopOffsets(dir: Direction): number[] {
  const hit = offsetCache[dir];
  if (hit) return hit;
  const out = stopsFor(dir).map((s) => progressOnRoute(s, dir).along);
  offsetCache[dir] = out;
  return out;
}

/** Index of the stop closest to `along` (in stopsFor(dir)). */
export function nearestStopIndex(along: number, dir: Direction): number {
  const o = stopOffsets(dir);
  let bi = 0;
  o.forEach((v, i) => {
    if (Math.abs(v - along) < Math.abs(o[bi] - along)) bi = i;
  });
  return bi;
}

/** Index of the next stop still ahead of along (skips one you are at, and skips bypassed detour stops). */
export function nextStopIndex(along: number, dir: Direction, slack = 40, variant: RouteVariant = 'main'): number {
  const o = stopOffsets(dir);
  for (let i = 0; i < o.length; i++) {
    if (variant === 'green' && SKIPPED_STOPS_GREEN.includes(i)) continue;
    if (o[i] > along + slack) return i;
  }
  return o.length - 1;
}

/**
 * Minutes until a jeep reaches a rider, measured ALONG the route in the rider's
 * direction. Returns null if the jeep is going the other way, is off the route,
 * or has already passed the rider.
 */
export function etaMinutes(
  jeep: LatLng & { direction?: Direction },
  rider: LatLng,
  dir: Direction,
  opts = { passedSlack: 40, maxOffRoute: 250 }
): number | null {
  if (jeep.direction && jeep.direction !== dir) return null;
  const j = progressOnRoute(jeep, dir);
  const r = progressOnRoute(rider, dir);
  if (j.offRoute > opts.maxOffRoute) return null;
  const gap = r.along - j.along;
  if (gap < -opts.passedSlack) return null; // already went past you
  return Math.max(1, Math.round(Math.max(0, gap) / JEEP_SPEED_M_PER_MIN));
}

// ---------- fares & savings ----------

const roundQuarter = (v: number) => Math.round(v * 4) / 4;

export function jeepFare(km: number, discounted: boolean): number {
  const extraKm = Math.max(0, Math.ceil(km - JEEP_FARE.minimumKm));
  return discounted
    ? roundQuarter(JEEP_FARE.discountedMinimum + extraKm * JEEP_FARE.discountedPerKm)
    : roundQuarter(JEEP_FARE.minimum + extraKm * JEEP_FARE.perKm);
}

/** Estimated motorcycle-taxi price range for the same trip (whole pesos). */
export function motoRange(km: number): { low: number; high: number } {
  const m = MOTO_TAXI;
  const low = Math.round(m.minimum + Math.max(0, km - m.minimumKm) * m.perKm);
  return { low, high: low + m.spread };
}

/** Motorcycle-taxi range from published rates (second source). */
export function motoPublishedRange(km: number): { low: number; high: number } {
  const m = MOTO_TAXI_PUBLISHED;
  const low = Math.round(m.base + Math.max(0, km - m.baseKm) * m.perKm);
  return { low, high: low + m.spread };
}

export interface TripSummary {
  fromName: string;
  toName: string;
  km: number;
  minutes: number;
  fare: number;
  motoLow: number; // Move It / Angkas / JoyRide, low end
  motoHigh: number; // high end
  pubLow: number; // published rates, cheapest app
  pubHigh: number; // published rates, priciest app
  savedMin: number;
  savedMax: number;
  co2g: number;
  stops: number;
}

export function summarizeTrip(
  dir: Direction,
  fromIndex: number,
  toIndex: number,
  minutesOnBoard: number,
  discounted: boolean
): TripSummary {
  const stops: RouteStop[] = stopsFor(dir);
  const o = stopOffsets(dir);
  const km = Math.max(0.3, (o[toIndex] - o[fromIndex]) / 1000);
  const minutes = Math.max(1, Math.round(minutesOnBoard || (km * 1000) / JEEP_SPEED_M_PER_MIN));
  const fare = jeepFare(km, discounted);
  const moto = motoRange(km);
  const pub = motoPublishedRange(km);
  return {
    fromName: stops[fromIndex].name,
    toName: stops[toIndex].name,
    km: Math.round(km * 10) / 10,
    minutes,
    fare,
    motoLow: moto.low,
    motoHigh: moto.high,
    pubLow: pub.low,
    pubHigh: pub.high,
    savedMin: Math.max(0, Math.round(moto.low - fare)),
    savedMax: Math.max(0, Math.round(moto.high - fare)),
    co2g: Math.round(km * CO2_SAVED_G_PER_KM),
    stops: toIndex - fromIndex,
  };
}

// ---------- stop alert ----------

export type RidePhase = 'riding' | 'getReady' | 'arrived';

/**
 * Where the rider is relative to their stop.
 * - getReady: within one stop-gap (max 400 m, min 150 m) of the destination
 * - arrived: within 60 m of the stop, or already past it
 */
export function ridePhase(along: number, dir: Direction, destIndex: number): RidePhase {
  const o = stopOffsets(dir);
  const dest = o[destIndex];
  const remaining = dest - along;
  if (remaining <= 60) return 'arrived';
  const gap = destIndex > 0 ? dest - o[destIndex - 1] : 400;
  const warnAt = Math.min(400, Math.max(150, gap));
  return remaining <= warnAt ? 'getReady' : 'riding';
}

/** Direction a jeep is heading, from two progress readings on the toPRC line. */
export function headingFromMovement(prevAlongToPRC: number, nowAlongToPRC: number, minMove = 25): Direction | null {
  const d = nowAlongToPRC - prevAlongToPRC;
  if (Math.abs(d) < minMove) return null;
  return d > 0 ? 'toPRC' : 'toMantrade';
}

import { ref, set, remove, onValue, push } from 'firebase/database';
import { db } from '../firebase';
import { Direction, RouteStop } from '../data/route';

export interface LiveJeep {
  id: string;
  plateNumber: string;
  driverName: string;
  latitude: number;
  longitude: number;
  capacityCount: number;
  maxCapacity: number;
  status: 'driving' | 'terminal' | 'break';
  direction?: Direction; // which way the jeep is heading (older builds may omit it)
  updatedAt: number;
}

export interface WaitingPing {
  id: string;
  stopId?: string; // the stop the rider is waiting at (GPS alone is too jumpy)
  latitude: number; // the stop's location, not the phone's
  longitude: number;
  direction?: Direction; // which way the rider wants to go
  ts: number;
}

// Driver: broadcast live position
export function broadcastJeep(j: LiveJeep) {
  if (!db) return;
  set(ref(db, `jeeps/${j.id}`), { ...j, updatedAt: Date.now() });
}

export function removeJeep(id: string) {
  if (!db) return;
  remove(ref(db, `jeeps/${id}`));
}

// Commuter: listen to all live jeeps
export function subscribeJeeps(cb: (jeeps: LiveJeep[]) => void): () => void {
  if (!db) {
    cb([]);
    return () => {};
  }
  return onValue(ref(db, 'jeeps'), (snap) => {
    const v = (snap.val() as Record<string, LiveJeep>) || {};
    cb(Object.values(v));
  });
}

// Commuter: "I'm waiting at <stop>". Pinned to the STOP, not the phone's GPS,
// so an inaccurate location can't put the rider in the wrong place.
export function dropWaiting(stop: RouteStop, direction: Direction) {
  if (!db) return;
  push(ref(db, 'waiting'), {
    stopId: stop.id,
    latitude: stop.latitude,
    longitude: stop.longitude,
    direction,
    ts: Date.now(),
  });
}

/** How many riders are waiting at each stop, for one direction. */
export function waitingByStop(pings: WaitingPing[], dir: Direction): Record<string, number> {
  const out: Record<string, number> = {};
  pings.forEach((p) => {
    if (!p.stopId || (p.direction && p.direction !== dir)) return;
    out[p.stopId] = (out[p.stopId] ?? 0) + 1;
  });
  return out;
}

// Remove a specific waiting ping (e.g. a jeep with open seats passed it, or the rider boarded)
export function removeWaiting(id: string) {
  if (!db) return;
  remove(ref(db, `waiting/${id}`));
}

// Both: listen to recent waiting pings (last 15 min), each at its real location
const RECENT_MS = 15 * 60 * 1000;
export function subscribeWaiting(cb: (pings: WaitingPing[]) => void): () => void {
  if (!db) {
    cb([]);
    return () => {};
  }
  return onValue(ref(db, 'waiting'), (snap) => {
    const v = (snap.val() as Record<string, Omit<WaitingPing, 'id'>>) || {};
    const now = Date.now();
    const out: WaitingPing[] = Object.entries(v)
      .map(([id, p]) => ({ id, ...(p || {}) } as WaitingPing))
      .filter((p) => typeof p.latitude === 'number' && typeof p.ts === 'number' && now - p.ts < RECENT_MS);
    cb(out);
  });
}

// Commuter: "I got off this jeep" -> frees one seat on that jeep (no tapping for the driver)
export function reportDropoff(jeepId: string) {
  if (!db) return;
  push(ref(db, `dropoffs/${jeepId}`), { ts: Date.now() });
}

// Driver: hear about riders who got off, then clear each report once counted
export function subscribeDropoffs(jeepId: string, cb: (count: number) => void): () => void {
  if (!db || !jeepId) return () => {};
  return onValue(ref(db, `dropoffs/${jeepId}`), (snap) => {
    const v = (snap.val() as Record<string, { ts: number }>) || {};
    const ids = Object.keys(v);
    if (ids.length === 0) return;
    cb(ids.length);
    ids.forEach((id) => remove(ref(db!, `dropoffs/${jeepId}/${id}`)));
  });
}

// ---------- rider-powered tracking ----------
// A rider on board publishes an anonymous "a jeep is here" point. Their phone
// is already tracking them for the stop alert, so this costs them nothing.
export interface Sighting {
  id: string; // device id (anonymous)
  latitude: number;
  longitude: number;
  direction?: Direction;
  ts: number;
}

export function publishSighting(id: string, latitude: number, longitude: number, direction: Direction) {
  if (!db || !id) return;
  set(ref(db, `sightings/${id}`), { latitude, longitude, direction, ts: Date.now() });
}

export function removeSighting(id: string) {
  if (!db || !id) return;
  remove(ref(db, `sightings/${id}`));
}

export function subscribeSightings(cb: (s: Sighting[]) => void): () => void {
  if (!db) {
    cb([]);
    return () => {};
  }
  return onValue(ref(db, 'sightings'), (snap) => {
    const v = (snap.val() as Record<string, Omit<Sighting, 'id'>>) || {};
    cb(Object.entries(v).map(([id, p]) => ({ id, ...(p || {}) } as Sighting)));
  });
}


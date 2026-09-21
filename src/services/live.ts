import { ref, set, remove, onValue, push } from 'firebase/database';
import { db } from '../firebase';

export interface LiveJeep {
  id: string;
  plateNumber: string;
  driverName: string;
  latitude: number;
  longitude: number;
  capacityCount: number;
  maxCapacity: number;
  status: 'driving' | 'terminal' | 'break';
  updatedAt: number;
}

export interface WaitingPing {
  id: string;
  latitude: number;
  longitude: number;
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

// Commuter: drop a "waiting here" ping at the rider's ACTUAL location
export function dropWaiting(latitude: number, longitude: number) {
  if (!db) return;
  push(ref(db, 'waiting'), { latitude, longitude, ts: Date.now() });
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
    const v = (snap.val() as Record<string, { latitude: number; longitude: number; ts: number }>) || {};
    const now = Date.now();
    const out: WaitingPing[] = Object.entries(v)
      .map(([id, p]) => ({ id, ...(p || {}) } as WaitingPing))
      .filter((p) => typeof p.latitude === 'number' && typeof p.ts === 'number' && now - p.ts < RECENT_MS);
    cb(out);
  });
}

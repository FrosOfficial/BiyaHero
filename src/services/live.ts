import { ref, set, remove, onValue, push, onDisconnect } from 'firebase/database';
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

export interface Ping {
  latitude: number;
  longitude: number;
  ts: number;
}

// Driver: write live position; auto-remove if the app disconnects.
export function broadcastJeep(j: LiveJeep) {
  if (!db) return;
  const r = ref(db, `jeeps/${j.id}`);
  set(r, { ...j, updatedAt: Date.now() });
  onDisconnect(r).remove();
}

export function removeJeep(id: string) {
  if (!db) return;
  remove(ref(db, `jeeps/${id}`));
}

// Commuter: listen to all live jeeps. Returns an unsubscribe fn.
export function subscribeJeeps(cb: (jeeps: LiveJeep[]) => void): () => void {
  if (!db) {
    cb([]);
    return () => {};
  }
  const r = ref(db, 'jeeps');
  return onValue(r, (snap) => {
    const v = (snap.val() as Record<string, LiveJeep>) || {};
    cb(Object.values(v));
  });
}

// Commuter: drop a "waiting here" ping.
export function dropPing(latitude: number, longitude: number) {
  if (!db) return;
  push(ref(db, 'pings'), { latitude, longitude, ts: Date.now() });
}

// Driver: listen to waiting pings.
export function subscribePings(cb: (pings: Ping[]) => void): () => void {
  if (!db) {
    cb([]);
    return () => {};
  }
  const r = ref(db, 'pings');
  return onValue(r, (snap) => {
    const v = (snap.val() as Record<string, Ping>) || {};
    cb(Object.values(v));
  });
}

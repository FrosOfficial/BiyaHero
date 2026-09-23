import { ref, set, remove, onValue } from 'firebase/database';
import { db } from '../firebase';
import { Direction } from '../data/route';

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


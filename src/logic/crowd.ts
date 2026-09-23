// Turn many anonymous rider "sightings" into jeep pins.
//
// Riders on the same jeep report nearly the same position, so we cluster
// points that are close together AND heading the same way into one virtual
// jeep. The number of phones in a cluster is a floor on how full it is.
import { Direction } from '../data/route';
import { distanceMeters, LatLng } from './routeMath';

export interface Sighting {
  id: string;
  latitude: number;
  longitude: number;
  direction?: Direction;
  ts: number;
}

export interface CrowdJeep {
  id: string;
  latitude: number;
  longitude: number;
  direction?: Direction;
  riders: number; // phones seen on this jeep (a floor on occupancy)
  source: 'crowd';
}

const CLUSTER_M = 70; // riders within this distance + same direction = one jeep

/** Cluster fresh sightings into virtual jeeps. */
export function clusterSightings(sightings: Sighting[], freshMs = 25000): CrowdJeep[] {
  const now = Date.now();
  const fresh = sightings.filter((s) => typeof s.latitude === 'number' && now - s.ts < freshMs);
  const used = new Set<number>();
  const out: CrowdJeep[] = [];
  fresh.forEach((s, i) => {
    if (used.has(i)) return;
    const group = [s];
    used.add(i);
    fresh.forEach((o, j) => {
      if (used.has(j) || j === i) return;
      if ((s.direction ?? '') === (o.direction ?? '') && distanceMeters(s, o) < CLUSTER_M) {
        group.push(o);
        used.add(j);
      }
    });
    const lat = group.reduce((a, g) => a + g.latitude, 0) / group.length;
    const lng = group.reduce((a, g) => a + g.longitude, 0) / group.length;
    out.push({ id: 'crowd-' + s.id, latitude: lat, longitude: lng, direction: s.direction, riders: group.length, source: 'crowd' });
  });
  return out;
}

/** Drop crowd jeeps that sit on top of a real driver jeep (same direction), to
 *  avoid double-counting — the driver's exact data wins. */
export function dropOverlaps<T extends LatLng & { direction?: Direction }>(
  crowd: CrowdJeep[],
  driverJeeps: T[],
  withinM = 90
): CrowdJeep[] {
  return crowd.filter(
    (c) => !driverJeeps.some((d) => (d.direction ?? c.direction) === c.direction && distanceMeters(c, d) < withinM)
  );
}

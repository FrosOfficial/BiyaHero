// Turn many anonymous rider "sightings" into jeep pins.
//
// Every rider on a ride alert sends "I'm here, going this way" every few
// seconds. Ten riders on the same jeep send ten points that are all within a
// few meters of each other, so they should become ONE pin, not ten.
//
// How we group them:
//   1. Put each rider on the route line: "2,340 m from the start, going to PRC".
//      Riders too far from the road (walking in a mall, GPS glitch) are dropped.
//   2. Sort riders by that distance, one direction at a time.
//   3. Walk down the list. A big GAP between two riders means a different jeep.
//      A group that gets longer than one jeep plus GPS error also gets split, so
//      a long rush-hour line of jeeps doesn't turn into one giant "jeep".
//   4. Draw the pin ON the road at the middle rider's spot.
//
// Grouping along the road (1-D) instead of by straight-line distance on the map
// (2-D) keeps jeeps on opposite sides of the road apart and is simpler to tune.
import { ALL_DIRECTIONS, Direction } from '../data/route';
import { progressOnRoute, pointAlong, LatLng } from './routeMath';

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
  direction: Direction;
  along: number; // meters from the start of the line, in its direction
  riders: number; // phones with BiyaHero on this jeep
}

/** Riders farther apart than this along the road are on different jeeps. */
export const GAP_M = 35;
/** One jeep's riders never spread longer than this (jeep ~8 m + GPS error). */
export const MAX_SPAN_M = 60;
/** Farther than this from the drawn route = not on a jeep on this route. */
export const MAX_OFF_ROUTE_M = 80;
/** Sightings older than this are stale (rider's phone died, lost signal, got off). */
export const FRESH_MS = 25000;

/** Group fresh rider sightings into jeeps. */
export function clusterSightings(sightings: Sighting[], now = Date.now()): CrowdJeep[] {
  const out: CrowdJeep[] = [];
  ALL_DIRECTIONS.forEach((dir) => {
    // 1. place riders on the line, drop stale / off-route ones
    const placed = sightings
      .filter((s) => s.direction === dir && typeof s.latitude === 'number' && now - s.ts < FRESH_MS)
      .map((s) => ({ s, p: progressOnRoute(s, dir) }))
      .filter((x) => x.p.offRoute <= MAX_OFF_ROUTE_M)
      .map((x) => ({ id: x.s.id, along: x.p.along }))
      .sort((a, b) => a.along - b.along);

    // 2-3. split on gaps, and cap how long one group can get
    let group: { id: string; along: number }[] = [];
    const flush = () => {
      if (!group.length) return;
      const mid = group[Math.floor(group.length / 2)].along; // median rider
      const at: LatLng = pointAlong(dir, mid);
      // stable id: the same set of riders keeps the same pin id between updates
      const key = group.map((g) => g.id).sort()[0];
      out.push({ id: `crowd-${dir}-${key}`, latitude: at.latitude, longitude: at.longitude, direction: dir, along: mid, riders: group.length });
      group = [];
    };
    placed.forEach((r) => {
      const prev = group[group.length - 1];
      if (prev && (r.along - prev.along > GAP_M || r.along - group[0].along > MAX_SPAN_M)) flush();
      group.push(r);
    });
    flush();
  });
  return out;
}

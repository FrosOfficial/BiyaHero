// BiyaHero pilot route: Mantrade <-> PRC (Chino Roces Ave, Makati)
//
// The route line and the stops come from ONE file you draw yourself:
//   src/data/routeMap.json   (GeoJSON, e.g. made at https://geojson.io)
//
// What that file needs:
//  • A LineString for the road the jeep drives, drawn FROM Mantrade TO PRC.
//    Give it the property  "direction": "toPRC".
//  • Optional: a second LineString with "direction": "toMantrade" if the jeep
//    uses different streets on the way back (one-way roads). If you leave it
//    out, the return trip uses the same line in reverse.
//  • One Point per stop with a "name" property (e.g. "Buendia (Gil Puyat)").
//    Optional properties: "short" (label for small spaces), "terminal": true,
//    "turnover": true (many riders get off here), "direction": "toPRC" or
//    "toMantrade" (stop only used one way).
//
// Stops are ordered automatically by where they sit along the line, so the
// order of features in the file doesn't matter.
import routeMap from './routeMap.json';

export type Direction = 'toPRC' | 'toMantrade';
export type LatLngTuple = [number, number]; // [latitude, longitude]

export interface RouteStop {
  id: string;
  name: string; // full label shown in lists
  short: string; // short label for tight spaces
  latitude: number;
  longitude: number;
  terminal?: boolean;
  turnover?: boolean;
  onlyDirection?: Direction;
}

export const ROUTE_NAME = 'Mantrade – PRC';

export const DIRECTIONS: { id: Direction; from: string; to: string }[] = [
  { id: 'toPRC', from: 'Mantrade', to: 'PRC' },
  { id: 'toMantrade', from: 'PRC', to: 'Mantrade' },
];

// ---------- read the GeoJSON ----------

interface GeoFeature {
  type: string;
  properties?: Record<string, unknown> | null;
  geometry: { type: string; coordinates: unknown };
}

const features: GeoFeature[] = ((routeMap as { features?: GeoFeature[] }).features ?? []).filter(Boolean);

const toLatLng = (c: unknown): LatLngTuple => {
  const [lng, lat] = c as number[]; // GeoJSON stores [longitude, latitude]
  return [lat, lng];
};

function lineFromFile(dir: Direction): LatLngTuple[] | null {
  const f = features.find(
    (x) => x.geometry?.type === 'LineString' && (x.properties?.direction ?? 'toPRC') === dir
  );
  return f ? (f.geometry.coordinates as unknown[]).map(toLatLng) : null;
}

// geojson.io saves property values as text, so accept true, "true" or "yes"
const isYes = (v: unknown) => v === true || v === 'true' || v === 'yes';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const rawStops: RouteStop[] = features
  .filter((f) => f.geometry?.type === 'Point')
  .map((f) => {
    const p = f.properties ?? {};
    const [latitude, longitude] = toLatLng(f.geometry.coordinates);
    const name = String(p.name ?? 'Stop');
    const od = p.direction === 'toPRC' || p.direction === 'toMantrade' ? (p.direction as Direction) : undefined;
    return {
      id: slug(name),
      name,
      short: String(p.short ?? name),
      latitude,
      longitude,
      terminal: isYes(p.terminal),
      turnover: isYes(p.turnover),
      onlyDirection: od,
    };
  });

// Safety net: if a line was drawn the wrong way round, flip it so it ends
// nearest the stop whose name mentions its destination.
function oriented(line: LatLngTuple[], endWord: RegExp): LatLngTuple[] {
  const end = rawStops.find((s) => endWord.test(s.name));
  if (!end || line.length < 2) return line;
  const d = (p: LatLngTuple) => (p[0] - end.latitude) ** 2 + (p[1] - end.longitude) ** 2;
  return d(line[0]) < d(line[line.length - 1]) ? [...line].reverse() : line;
}

const LINE_TO_PRC: LatLngTuple[] = oriented(lineFromFile('toPRC') ?? [], /prc/i);
const LINE_TO_MANTRADE: LatLngTuple[] = oriented(lineFromFile('toMantrade') ?? [...LINE_TO_PRC].reverse(), /mantrade/i);

export function lineFor(dir: Direction): LatLngTuple[] {
  return dir === 'toPRC' ? LINE_TO_PRC : LINE_TO_MANTRADE;
}

// ---------- ordering stops along the line ----------
// (small local copy of the projection math so this file has no dependencies)

function alongLine(line: LatLngTuple[], lat: number, lng: number): number {
  const k = Math.cos((lat * Math.PI) / 180);
  const R = 6371000;
  const xy = (p: LatLngTuple) => ({ x: (((p[1] - lng) * Math.PI) / 180) * R * k, y: (((p[0] - lat) * Math.PI) / 180) * R });
  let run = 0;
  let best = { d: Infinity, along: 0 };
  for (let i = 0; i < line.length - 1; i++) {
    const a = xy(line[i]);
    const b = xy(line[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const t = len ? Math.max(0, Math.min(1, (-a.x * dx - a.y * dy) / (len * len))) : 0;
    const cx = a.x + t * dx;
    const cy = a.y + t * dy;
    const d = Math.sqrt(cx * cx + cy * cy);
    if (d < best.d) best = { d, along: run + t * len };
    run += len;
  }
  return best.along;
}

/** All stops, ordered from the Mantrade end to the PRC end. */
export const STOPS: RouteStop[] = [...rawStops].sort(
  (a, b) => alongLine(LINE_TO_PRC, a.latitude, a.longitude) - alongLine(LINE_TO_PRC, b.latitude, b.longitude)
);

/** Stops served in one direction, in riding order. */
export function stopsFor(dir: Direction): RouteStop[] {
  const line = lineFor(dir);
  return STOPS.filter((s) => !s.onlyDirection || s.onlyDirection === dir).sort(
    (a, b) => alongLine(line, a.latitude, a.longitude) - alongLine(line, b.latitude, b.longitude)
  );
}

export function stopById(id: string): RouteStop | undefined {
  return STOPS.find((s) => s.id === id);
}

/** The two ends of the line: [Mantrade end, PRC end]. */
export const TERMINALS: [RouteStop, RouteStop] = [STOPS[0], STOPS[STOPS.length - 1]];

// The route menu: cities, and the routes you can pick in each.
//
// A route with a `direction` works today. A route without one shows as
// "Soon" and can't be picked yet. To switch one on later: draw its line and
// stops (like Mantrade–PRC), add it to the app's route data, then give it a
// `direction` here.
import { Direction } from './route';

export interface AreaRoute {
  id: string;
  name: string; // shown in the menu, e.g. "To PRC"
  nameKey?: string; // translation key, used instead of `name` when set
  direction?: Direction; // set = available now; missing = coming soon
}

export interface Area {
  id: string;
  name: string; // city name, e.g. "Makati"
  routes: AreaRoute[];
}

export const AREAS: Area[] = [
  {
    id: 'makati',
    name: 'Makati',
    routes: [
      { id: 'makati-toPRC', name: 'To PRC', nameKey: 'toPRC', direction: 'toPRC' },
      { id: 'makati-toMantrade', name: 'To Mantrade', nameKey: 'toMantrade', direction: 'toMantrade' },
      { id: 'makati-toLRT', name: 'To LRT' },
    ],
  },
  {
    id: 'muntinlupa',
    name: 'Muntinlupa',
    routes: [
      { id: 'muntinlupa-sanpedro', name: 'San Pedro' },
      { id: 'muntinlupa-alabang', name: 'Alabang' },
      { id: 'muntinlupa-binan', name: 'Biñan' },
    ],
  },
];

/** The city + route entry for a working direction. */
export function areaFor(dir: Direction): { area: Area; route: AreaRoute } {
  for (const area of AREAS) {
    const route = area.routes.find((r) => r.direction === dir);
    if (route) return { area, route };
  }
  return { area: AREAS[0], route: AREAS[0].routes[0] };
}

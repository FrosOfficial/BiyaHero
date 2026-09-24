// Route hierarchy by region, city, and available routes.
import { Direction } from './route';

export interface AreaRoute {
  id: string;
  name: string;
  nameKey?: string;
  direction?: Direction;
}

export interface City {
  id: string;
  name: string;
  routes: AreaRoute[];
}

export interface Region {
  id: string;
  name: string;
  cities: City[];
}

export const REGIONS: Region[] = [
  {
    id: 'metro-manila',
    name: 'Metro Manila',
    cities: [
      {
        id: 'makati',
        name: 'Makati',
        routes: [
          { id: 'makati-toPRC', name: 'To PRC', nameKey: 'toPRC', direction: 'toPRC' },
          { id: 'makati-toMantrade', name: 'To Mantrade', nameKey: 'toMantrade', direction: 'toMantrade' },
          { id: 'makati-toLRT', name: 'To LRT', nameKey: 'toLRT' },
        ],
      },
      { id: 'manila', name: 'Manila', routes: [] },
      { id: 'quezon-city', name: 'Quezon City', routes: [] },
      { id: 'caloocan', name: 'Caloocan', routes: [] },
      { id: 'las-pinas', name: 'Las Piñas', routes: [] },
      { id: 'malabon', name: 'Malabon', routes: [] },
      { id: 'mandaluyong', name: 'Mandaluyong', routes: [] },
      { id: 'marikina', name: 'Marikina', routes: [] },
      { id: 'muntinlupa', name: 'Muntinlupa', routes: [] },
      { id: 'navotas', name: 'Navotas', routes: [] },
      { id: 'paranaque', name: 'Parañaque', routes: [] },
      { id: 'pasay', name: 'Pasay', routes: [] },
      { id: 'pasig', name: 'Pasig', routes: [] },
      { id: 'san-juan', name: 'San Juan', routes: [] },
      { id: 'taguig', name: 'Taguig', routes: [] },
      { id: 'valenzuela', name: 'Valenzuela', routes: [] },
    ],
  },
];

export interface AreaSelection {
  region: Region;
  city: City;
  route: AreaRoute;
  area: { id: string; name: string };
}

// Find region, city, and route for an active direction.
export function areaFor(dir: Direction): AreaSelection {
  for (const region of REGIONS) {
    for (const city of region.cities) {
      const route = city.routes.find((r) => r.direction === dir);
      if (route) {
        return {
          region,
          city,
          route,
          area: { id: city.id, name: `${region.name} › ${city.name}` },
        };
      }
    }
  }
  const region = REGIONS[0];
  const city = region.cities[0];
  const route = city.routes[0];
  return {
    region,
    city,
    route,
    area: { id: city.id, name: `${region.name} › ${city.name}` },
  };
}

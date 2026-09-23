// Fare settings used by the trip summary ("You saved ₱___").
//
// Jeepney: what riders actually pay on the Mantrade–PRC route today.
// ₱13 regular / ₱11 student, senior, PWD for the first 4 km.
// (LTFRB approved a ₱14 minimum effective 19 Mar 2026; change it here if
// drivers on this route start charging it.)
export const JEEP_FARE = {
  minimum: 13, // ₱ regular, first `minimumKm`
  discountedMinimum: 11, // ₱ student / senior / PWD, first `minimumKm`
  minimumKm: 4,
  perKm: 1.8, // ₱ per km after that (regular)
  discountedPerKm: 1.5, // ₱ per km after that (discounted)
};

// Motorcycle taxi ESTIMATE: the rider's real alternative on this route.
// Calibrated to actual prices riders see today on Move It / Angkas / JoyRide:
//   Shopwise -> Waltermart (~1.9 km): ₱60–65
//   Mantrade -> Shopwise   (~4.0 km): ~₱75
// Model: ₱60 covers the first 2 km, +₱7.50 per km after, shown as a range
// of +₱5 because prices move with traffic, weather, and which app you use.
export const MOTO_TAXI = {
  minimum: 60, // ₱ low end for the first `minimumKm`
  minimumKm: 2,
  perKm: 7.5, // ₱ per km after that
  spread: 5, // ₱ added for the high end of the range
  apps: ['Move It', 'Angkas', 'JoyRide'],
};

// Second source: PUBLISHED rates (researched), shown next to the checked prices.
//  • Move It: ₱50 base + ₱10/km (ASTIG.ph, Jul 2026) — matches the LTFRB
//    motorcycle-taxi pilot fare of ₱50 for the first 2 km (Visor).
//  • JoyRide and Angkas usually come out ~₱10–20 higher on the same trip
//    (ASTIG.ph Jul 2026; Top Gear PH May 2026), so the range adds ₱20.
export const MOTO_TAXI_PUBLISHED = {
  base: 50, // ₱ first `baseKm`
  baseKm: 2,
  perKm: 10, // ₱ per km after that
  spread: 20, // ₱ from the cheapest app (Move It) to the priciest (Angkas/JoyRide)
};

// grams of CO₂ saved per km by riding a shared jeepney instead of a solo
// motorcycle taxi (rough estimate: ~80 g/km motorcycle vs ~20 g/km per jeep rider)
export const CO2_SAVED_G_PER_KM = 60;

// average jeep speed on the corridor, used for ETAs and trip-time estimates
export const JEEP_SPEED_M_PER_MIN = 250; // ≈ 15 km/h in Makati traffic

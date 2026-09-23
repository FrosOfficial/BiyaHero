# 🚍 BiyaHero

Real-time jeepney tracking with a **Comfort & Seat Radar**. Commuters see nearby jeeps, live ETAs, and how full each one is *before* it arrives. Drivers broadcast their live location with one tap. No sign-up, no login, just pick a role and go.

Built for ITS142 (Mapúa) as a Shark Tank pitch prototype. Pilot corridor: Chino Roces Ave, Makati (Mantrade → PRC).

---

## Features

- **Pick a role, no login** — open the app and choose Commuter or Driver.
- **Live map** (OpenStreetMap / MapTiler) centered on your real GPS location.
- **Seat Radar** — every jeep is colored by how full it is: 🟢 chill · 🟡 squeezed · 🔴 sabit.
- **Real-time tracking** — drivers broadcast live GPS via Firebase; commuters see them move instantly.
- **Waiting at a stop** — commuters pick the stop they're waiting at (not raw GPS); drivers see how many riders wait at each stop ahead.
- **Direction-aware** — pick *To PRC* or *To Mantrade*. Only jeeps heading your way that haven't passed you yet count, and ETA is measured along the route.
- **Ride & alert me** — pick your stop; BiyaHero vibrates and speaks before your stop ("Para po!") and wraps up the trip when you arrive.
- **Trip savings** — after each ride: fare paid vs Move It, Angkas and JoyRide estimates (savings range), CO₂ saved, and this month's running total (saved on the phone only).
- **Zero-tap seats for drivers** — leaving a terminal marks the jeep Full (Half-full after 9:30 PM), Buendia/Waltermart free up seats, passing a waiting rider adds one, riders tapping "I got off" remove one. Manual +/- only when parked.
- **Neo-Brutalist Manila Pop** design (cream canvas, bold black outlines, jeepney gold).

## Tech stack

- React Native + Expo (TypeScript)
- Firebase Realtime Database (live driver ↔ commuter sync)
- Leaflet in a WebView + OpenStreetMap / MapTiler tiles
- expo-location for GPS

## Getting started

```bash
git clone https://github.com/YOUR_USERNAME/biyahero.git
cd biyahero
npm install
cp .env.example .env      # then fill in your own keys
npx expo start
```

Open in **Expo Go** (scan the QR), or press `w` for web.

### Environment variables

Copy `.env.example` to `.env` and fill in your own keys. Nothing runs without them.

- **MapTiler** — free key from [maptiler.com](https://www.maptiler.com/) for the clean map style. Leave blank to fall back to plain OpenStreetMap.
- **Firebase** — a Realtime Database project ([console.firebase.google.com](https://console.firebase.google.com/)) for live tracking.

`.env` is gitignored and never committed.

## Build a shareable APK

```bash
npx eas-cli env:push preview     # send your keys to EAS (once)
npx eas-cli build -p android --profile preview
```

EAS builds an installable APK in the cloud and gives you a download link to share. No Expo Go needed.

## Project structure

```
src/
├── data/routeMap.json      route line + stops (GeoJSON, draw it at geojson.io)
├── data/route.ts           reads routeMap.json: stops in order, line per direction
├── data/fares.ts           jeep fare (₱13 / ₱11), motorcycle-taxi estimates, CO₂ and speed settings
├── logic/routeMath.ts      route progress, ETA, stop alert, fares (pure functions)
├── services/trips.ts       monthly savings stored on the phone
├── theme/theme.ts          Neo-Brutalist palette + hard-shadow helper
├── components/             NeoCard, NeoButton, LeafletMap, StatusMeterPill, ...
├── context/AppContext.tsx  role state, driver identity, GPS base
├── hooks/useLocation.ts    live device GPS
├── services/live.ts        Firebase broadcast + subscribe
├── firebaseConfig.ts       reads keys from env
├── mapConfig.ts            map tile source + key
└── screens/                RoleSelect, Commuter, Ride, TripSummary, Driver
```

## Notes

- Firebase runs in **test mode** for the prototype — lock down the security rules before real-world use.
- Jeep positions are real when a driver runs Driver mode; there is no public jeepney GPS feed.
- The route line and stops live in `src/data/routeMap.json` (GeoJSON). Redraw it at [geojson.io](https://geojson.io): a LineString with `"direction": "toPRC"` drawn from Mantrade to PRC along the real road, optionally a second one with `"direction": "toMantrade"` for one-way streets, and a Point per stop with a `"name"` (plus `"terminal"` / `"turnover"` set to true where they apply). Paste the whole JSON into the file. Stops are ordered automatically.
- The stop alert works while BiyaHero is open on screen (the screen is kept awake during a ride).

---

Made by **Fros** · BSIT, Mapúa Makati

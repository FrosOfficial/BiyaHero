# BiyaHero (Expo / React Native)

Real-time jeepney tracking prototype with a Comfort & Seat Radar.
Chino Roces corridor (Mantrade → PRC), Makati. Built for ITS142 Shark Tank pitch.

## Run it

```bash
cd app
npm install
npx expo start
```

Then:
- Scan the QR with **Expo Go** on your phone (Android/iOS), or
- Press `w` for the web preview, `a` for Android emulator, `i` for iOS simulator.

If Expo Go says the SDK version doesn't match, run:
```bash
npx expo install expo@latest && npx expo install --fix
```

## What's inside

- **Commuter tab** — live corridor map + Seat Radar (chill / squeezed / sabit), curb ping + Para Po.
- **Driver tab** — 1-tap status HUD, next-stop demand radar, 2-tap headcount stepper.
- **Pitch tab** — 5-slide Shark Tank deck (Hook / Problem / Solution / Why / Ask).

Jeeps move on their own via a 4-second simulation ticker, so the app feels live with no backend.

## Structure

```
src/
├── theme/theme.ts          Neo-Brutalist palette + hard-shadow helper
├── components/             NeoCard, NeoButton, StickerBadge, StatusMeterPill, SpeechBubble, CorridorMap
├── context/AppContext.tsx  live jeep simulation + actions
├── data/corridorData.ts    6 stops + seed jeeps
└── screens/                Commuter, Driver, Pitch
```

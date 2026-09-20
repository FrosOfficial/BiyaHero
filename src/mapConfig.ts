// Keys come from environment variables (see .env / .env.example).
// EXPO_PUBLIC_ vars are read by Expo at build time.
export const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';
export const MAPTILER_STYLE = process.env.EXPO_PUBLIC_MAPTILER_STYLE ?? 'streets-v2';

export const useMapTiler = MAPTILER_KEY.length > 0;

export const tileUrl = useMapTiler
  ? `https://api.maptiler.com/maps/${MAPTILER_STYLE}/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

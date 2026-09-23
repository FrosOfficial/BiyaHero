import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

export interface Coords {
  latitude: number;
  longitude: number;
}

export type PermState = 'checking' | 'granted' | 'denied';

// central Makati - only used to unblock the UI if GPS is very slow
const FALLBACK: Coords = { latitude: 14.5547, longitude: 121.0244 };

export function useLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null); // meters; smaller = better
  const [perm, setPerm] = useState<PermState>('checking');
  const [error, setError] = useState<string | null>(null);
  const sub = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let mounted = true;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;
        if (status !== 'granted') {
          setPerm('denied');
          return;
        }
        setPerm('granted');

        // 1) instant: last known location unblocks the map fast on slow phones
        try {
          const last = await Location.getLastKnownPositionAsync();
          if (mounted && last) {
            setCoords({ latitude: last.coords.latitude, longitude: last.coords.longitude });
            setAccuracy(last.coords.accuracy ?? null);
          }
        } catch {
          /* ignore */
        }

        // 2) safety net: if no fix within 8s, show the map anyway (default center)
        fallbackTimer = setTimeout(() => {
          if (mounted) setCoords((c) => c ?? FALLBACK);
        }, 8000);

        // 3) live updates. BestForNavigation is the most accurate mode - right for a
        //    moving jeep. Updates every ~2 m / 2 s so the stop alert fires on time.
        sub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 2, timeInterval: 2000 },
          (loc) => {
            if (!mounted) return;
            setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            setAccuracy(loc.coords.accuracy ?? null);
          }
        );
      } catch (e: any) {
        if (mounted) setError(e?.message ?? 'Location error');
      }
    })();

    return () => {
      mounted = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      sub.current?.remove();
    };
  }, []);

  return { coords, accuracy, perm, error };
}

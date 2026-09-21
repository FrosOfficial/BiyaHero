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
          }
        } catch {
          /* ignore */
        }

        // 2) safety net: if no fix within 8s, show the map anyway (default center)
        fallbackTimer = setTimeout(() => {
          if (mounted) setCoords((c) => c ?? FALLBACK);
        }, 8000);

        // 3) live updates. "High" gets a first fix much faster than "Highest" on old GPS
        sub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 },
          (loc) => {
            if (!mounted) return;
            setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
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

  return { coords, perm, error };
}

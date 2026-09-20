import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

export interface Coords {
  latitude: number;
  longitude: number;
}

export type PermState = 'checking' | 'granted' | 'denied';

export function useLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [perm, setPerm] = useState<PermState>('checking');
  const [error, setError] = useState<string | null>(null);
  const sub = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;
        if (status !== 'granted') {
          setPerm('denied');
          return;
        }
        setPerm('granted');

        // quick first fix
        const first = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
        if (!mounted) return;
        setCoords({ latitude: first.coords.latitude, longitude: first.coords.longitude });

        // live updates at highest precision
        sub.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
            distanceInterval: 2,
            timeInterval: 2000,
            mayShowUserSettingsDialog: true,
          },
          (loc) => {
            setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          }
        );
      } catch (e: any) {
        if (mounted) setError(e?.message ?? 'Location error');
      }
    })();

    return () => {
      mounted = false;
      sub.current?.remove();
    };
  }, []);

  return { coords, perm, error };
}

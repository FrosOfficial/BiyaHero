// Background "Para po!" alert.
//
// Fires a phone notification (buzz + sound + lock-screen banner) one stop
// before your destination, even with the app in your pocket and the screen off.
//
// IMPORTANT: expo-notifications and background tasks do NOT work in Expo Go
// (Expo removed them in SDK 53). So this whole module turns itself OFF in Expo
// Go — the app still runs, and the on-screen alert (vibration + voice + PARA PO
// card) still works. Background notifications only switch on in a real build
// (EAS build or a dev build).
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Direction } from '../data/route';
import { progressOnRoute, stopOffsets } from '../logic/routeMath';

const TASK = 'biyahero-ride-alert';
const KEY = 'activeRide';

// true when running inside the Expo Go sandbox app
const isExpoGo =
  (Constants as any)?.appOwnership === 'expo' ||
  (Constants as any)?.executionEnvironment === 'storeClient';

// load the native-only modules lazily, and only outside Expo Go
let Notifications: any = null;
let TaskManager: any = null;

interface ActiveRide {
  direction: Direction;
  destIndex: number;
  destShort: string;
  warned: boolean;
}

async function readRide(): Promise<ActiveRide | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActiveRide) : null;
  } catch {
    return null;
  }
}

if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Notifications = require('expo-notifications');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    TaskManager = require('expo-task-manager');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Background location task: fire the notification once we're within one
    // stop of the chosen destination.
    TaskManager.defineTask(TASK, async ({ data, error }: any) => {
      if (error) return;
      const locs = data?.locations as Array<{ coords: { latitude: number; longitude: number } }> | undefined;
      const loc = locs && locs[locs.length - 1];
      if (!loc) return;

      const ride = await readRide();
      if (!ride || ride.warned) return;

      const here = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      const along = progressOnRoute(here, ride.direction).along;
      const offsets = stopOffsets(ride.direction);
      const remaining = offsets[ride.destIndex] - along;
      const gap = ride.destIndex > 0 ? offsets[ride.destIndex] - offsets[ride.destIndex - 1] : 400;
      const warnAt = Math.min(400, Math.max(150, gap));

      if (remaining <= warnAt) {
        try {
          await AsyncStorage.setItem(KEY, JSON.stringify({ ...ride, warned: true }));
        } catch {
          /* ignore */
        }
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Para po! 🚌',
            body: `${ride.destShort} is your stop — get ready to get off.`,
            sound: true,
            vibrate: [0, 600, 250, 600],
            priority: Notifications.AndroidNotificationPriority?.MAX,
          },
          trigger: null,
        });
      }
    });
  } catch {
    // if the modules aren't available for any reason, fall back to foreground-only
    Notifications = null;
    TaskManager = null;
  }
}

/**
 * Start watching for the stop in the background. Returns true only if real
 * background tracking started. In Expo Go it returns false and the app relies
 * on the on-screen alert.
 */
export async function startRideAlert(direction: Direction, destIndex: number, destShort: string): Promise<boolean> {
  if (isExpoGo || !Notifications || !TaskManager) return false;
  try {
    await Notifications.requestPermissionsAsync();
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;

    await AsyncStorage.setItem(KEY, JSON.stringify({ direction, destIndex, destShort, warned: false }));

    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') return false;

    const already = await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false);
    if (!already) {
      await Location.startLocationUpdatesAsync(TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 20,
        timeInterval: 5000,
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
        foregroundService: {
          notificationTitle: 'BiyaHero',
          notificationBody: 'Watching for your stop…',
          notificationColor: '#845EF7',
        },
      });
    }
    return true;
  } catch {
    return false;
  }
}

/** Stop background watching and clear the active ride. */
export async function stopRideAlert(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  if (!TaskManager) return;
  try {
    const on = await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false);
    if (on) await Location.stopLocationUpdatesAsync(TASK);
  } catch {
    /* ignore */
  }
}

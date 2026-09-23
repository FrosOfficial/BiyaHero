// Background "Para po!" alert + live ongoing status notification.
//
// While the app is in your pocket (screen off, app backgrounded) BiyaHero:
//   1. keeps an ONGOING notification in the panel showing your next stop and how
//      many stops are left, updating as the jeep moves, and
//   2. buzzes a loud "Para po!" alert one stop before your destination.
//
// IMPORTANT: expo-notifications and background tasks do NOT work in Expo Go
// (Expo removed them in SDK 53). So this whole module turns itself OFF in Expo
// Go — the app still runs, and the on-screen alert (vibration + voice + PARA PO
// card) still works. The notification-panel features only switch on in a real
// build (EAS build or a dev build).
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Direction, stopsFor } from '../data/route';
import { progressOnRoute, stopOffsets, nextStopIndex } from '../logic/routeMath';

const TASK = 'biyahero-ride-alert';
const KEY = 'activeRide';
const STATUS_ID = 'biyahero-ride-status'; // the ongoing "next stop" notification
const CH_STATUS = 'ride-status';
const CH_ALERT = 'ride-alert';

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

// Post/replace the ongoing status notification. Same identifier every time, so
// Android updates the existing one in place instead of stacking new ones.
async function showStatus(nextName: string, stopsLeft: number, destShort: string) {
  if (!Notifications) return;
  const line =
    stopsLeft <= 0
      ? `${destShort} — you're arriving. Para po!`
      : `Next: ${nextName}  ·  ${stopsLeft} stop${stopsLeft === 1 ? '' : 's'} to ${destShort}`;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: STATUS_ID,
      content: {
        title: 'BiyaHero — on your ride',
        body: line,
        sticky: true, // ongoing: can't be swiped away mid-ride (Android)
        autoDismiss: false,
        priority: Notifications.AndroidNotificationPriority?.LOW,
        ...(({ channelId: CH_STATUS } as any)),
      },
      trigger: null,
    });
  } catch {
    /* ignore */
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

    // Android needs channels. The status one is silent (updates every few
    // seconds), the alert one buzzes and pops.
    if (Notifications.setNotificationChannelAsync) {
      Notifications.setNotificationChannelAsync(CH_STATUS, {
        name: 'Ride status',
        importance: Notifications.AndroidImportance?.LOW ?? 2,
        sound: null,
        vibrationPattern: [0],
        enableVibrate: false,
      }).catch(() => {});
      Notifications.setNotificationChannelAsync(CH_ALERT, {
        name: 'Stop alert',
        importance: Notifications.AndroidImportance?.MAX ?? 5,
        sound: 'default',
        vibrationPattern: [0, 600, 250, 600],
      }).catch(() => {});
    }

    // Background location task: update the ongoing status every tick, and fire
    // the loud alert once we're within one stop of the chosen destination.
    TaskManager.defineTask(TASK, async ({ data, error }: any) => {
      if (error) return;
      const locs = data?.locations as Array<{ coords: { latitude: number; longitude: number } }> | undefined;
      const loc = locs && locs[locs.length - 1];
      if (!loc) return;

      const ride = await readRide();
      if (!ride) return;

      const here = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      const along = progressOnRoute(here, ride.direction).along;
      const offsets = stopOffsets(ride.direction);
      const stops = stopsFor(ride.direction);

      // live "next stop" + "stops left", capped at the destination
      const nextIdx = Math.min(nextStopIndex(along, ride.direction), ride.destIndex);
      const stopsLeft = Math.max(0, ride.destIndex - nextIdx + 1);
      const nextName = stops[nextIdx]?.short ?? ride.destShort;
      await showStatus(nextName, stopsLeft, ride.destShort);

      // loud "Para po!" alert, once
      if (ride.warned) return;
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
            ...(({ channelId: CH_ALERT } as any)),
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
    // show the ongoing notification right away so it's there from the start
    await showStatus(destShort, Math.max(1, destIndex), destShort);

    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') return false;

    const already = await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false);
    if (!already) {
      await Location.startLocationUpdatesAsync(TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 15,
        timeInterval: 4000,
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
        foregroundService: {
          notificationTitle: 'BiyaHero is tracking your stop',
          notificationBody: 'Your next stop shows in the panel below.',
          notificationColor: '#845EF7',
        },
      });
    }
    return true;
  } catch {
    return false;
  }
}

/** Stop background watching, clear the active ride, and remove the notification. */
export async function stopRideAlert(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  if (Notifications) {
    try {
      await Notifications.dismissNotificationAsync(STATUS_ID);
    } catch {
      /* ignore */
    }
  }
  if (!TaskManager) return;
  try {
    const on = await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false);
    if (on) await Location.stopLocationUpdatesAsync(TASK);
  } catch {
    /* ignore */
  }
}

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
import { AppState } from 'react-native';
import * as Speech from 'expo-speech';
import { Direction, RouteVariant, stopsFor, detectRouteVariant, stickyVariant } from '../data/route';
import { progressOnRoute, stopOffsets, nextStopIndex } from '../logic/routeMath';

const TASK = 'biyahero-ride-alert';
const KEY = 'activeRide';
const STATUS_ID = 'biyahero-ride-status'; // the ongoing "next stop" notification
const CH_STATUS = 'ride-status';
const CH_ALERT = 'ride-alert';
const CH_DONE = 'ride-done';
const DONE_ID = 'biyahero-ride-done';

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
  lastSaid?: number; // last stop index announced by voice in the background
  arrived?: boolean;
  variant?: RouteVariant; // 'green' sticks once the jeep took the shortcut
}

// what the voice says (matches the app's English / Filipino setting)
const SAY = {
  en: { next: 'Next stop, {stop}.', yours: 'Next stop, {stop}. This is your stop.', arrived: 'You have arrived at {stop}.' },
  fil: { next: 'Susunod na hintuan, {stop}.', yours: 'Susunod na hintuan, {stop}. Dito ka bababa.', arrived: 'Nandito ka na sa {stop}.' },
};

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
async function showStatus(nextName: string, stopsLeft: number, destShort: string, kmLeft: number, kph: number | null) {
  if (!Notifications) return;
  const speed = kph != null ? `  ·  ${Math.round(kph)} km/h` : '';
  const title = stopsLeft <= 0 ? `Arriving at ${destShort}` : `Next stop: ${nextName}`;
  const body =
    stopsLeft <= 0
      ? `Get ready to say "Para po!"${speed}`
      : `${stopsLeft} stop${stopsLeft === 1 ? '' : 's'} to ${destShort}  ·  ${kmLeft.toFixed(1)} km${speed}`;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: STATUS_ID,
      content: {
        title,
        body,
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

async function saveRide(ride: ActiveRide) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(ride));
  } catch {
    /* ignore */
  }
}

// speak only when the app is NOT on screen (the ride screen speaks when it is)
async function sayInBackground(text: string) {
  if (AppState.currentState === 'active') return;
  try {
    if ((await AsyncStorage.getItem('voiceMuted')) === 'yes') return;
    const fil = (await AsyncStorage.getItem('lang')) === 'fil';
    Speech.stop();
    Speech.speak(text, { language: fil ? 'fil-PH' : 'en-US', rate: 0.95 });
  } catch {
    /* ignore */
  }
}

async function langKey(): Promise<'en' | 'fil'> {
  try {
    return (await AsyncStorage.getItem('lang')) === 'fil' ? 'fil' : 'en';
  } catch {
    return 'en';
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
      Notifications.setNotificationChannelAsync(CH_DONE, {
        name: 'Ride finished',
        importance: Notifications.AndroidImportance?.DEFAULT ?? 3,
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
      const locs = data?.locations as Array<{ coords: { latitude: number; longitude: number; speed?: number | null } }> | undefined;
      const loc = locs && locs[locs.length - 1];
      if (!loc) return;

      const ride = await readRide();
      if (!ride || ride.arrived) return;

      const here = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      const along = progressOnRoute(here, ride.direction).along;
      const offsets = stopOffsets(ride.direction);
      const stops = stopsFor(ride.direction);
      const sp = loc.coords.speed;
      const kph = typeof sp === 'number' && sp >= 0 && sp * 3.6 < 100 ? sp * 3.6 : null;
      const L = SAY[await langKey()];

      // live "next stop" + "stops left", capped at the destination
      const variant = stickyVariant(ride.variant, detectRouteVariant(loc.coords.latitude, loc.coords.longitude, ride.direction));
      if (variant === 'green' && ride.variant !== 'green') {
        ride.variant = 'green';
        await saveRide(ride);
      }
      const nextIdx = Math.min(nextStopIndex(along, ride.direction, 5, variant), ride.destIndex);
      const stopsLeft = Math.max(0, ride.destIndex - nextIdx + 1);
      const nextName = stops[nextIdx]?.short ?? ride.destShort;
      const remaining = offsets[ride.destIndex] - along;
      await showStatus(nextName, remaining <= 60 ? 0 : stopsLeft, ride.destShort, Math.max(0, remaining / 1000), kph);

      // arrived: say so, post a notice, stop updating
      if (remaining <= 60) {
        await saveRide({ ...ride, arrived: true });
        await sayInBackground(L.arrived.replace('{stop}', stops[ride.destIndex].name));
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `You've arrived at ${ride.destShort} 🎉`,
              body: 'Open BiyaHero to see your trip summary and what you saved.',
              ...(({ channelId: CH_DONE } as any)),
            },
            trigger: null,
          });
        } catch {
          /* ignore */
        }
        return;
      }

      // train-style "Next stop, ..." whenever the next stop changes
      if (ride.lastSaid == null) {
        ride.lastSaid = nextIdx; // don't announce the stop you're already heading to at the start
        await saveRide(ride);
      } else if (ride.lastSaid !== nextIdx) {
        ride.lastSaid = nextIdx;
        await saveRide(ride);
        const name = stops[nextIdx].name;
        await sayInBackground((nextIdx === ride.destIndex ? L.yours : L.next).replace('{stop}', name));
      }

      // loud "Para po!" alert, once
      if (ride.warned) return;
      const gap = ride.destIndex > 0 ? offsets[ride.destIndex] - offsets[ride.destIndex - 1] : 400;
      const warnAt = Math.min(400, Math.max(150, gap));

      if (remaining <= warnAt) {
        await saveRide({ ...ride, warned: true });
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
    await showStatus(destShort, Math.max(1, destIndex), destShort, 0, null);

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
          notificationTitle: 'BiyaHero ride alert is on',
          notificationBody: 'Keeps your stop alert working with the screen off.',
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

/**
 * "Trip complete" notification with the ride's details. Called when the ride
 * ends (arrived or "I got off"), so the panel shows it, not just the app.
 */
export async function notifyTripComplete(t: {
  fromName: string;
  toName: string;
  minutes: number;
  km: number;
  savedMin: number;
  savedMax: number;
  avgKph: number | null;
  startedAt: number;
  endedAt: number;
}): Promise<void> {
  if (!Notifications) return;
  const clock = (ms: number) => {
    const d = new Date(ms);
    const h = d.getHours();
    return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  };
  const saved = t.savedMin === t.savedMax ? `₱${t.savedMin}` : `₱${t.savedMin}–${t.savedMax}`;
  const speed = t.avgKph != null ? `  ·  avg ${Math.round(t.avgKph)} km/h` : '';
  try {
    await Notifications.dismissNotificationAsync(STATUS_ID);
  } catch {
    /* ignore */
  }
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: DONE_ID,
      content: {
        title: `Trip complete: ${t.fromName} → ${t.toName}`,
        body: `${clock(t.startedAt)} → ${clock(t.endedAt)}  ·  ${t.minutes} min  ·  ${t.km} km${speed}\nYou saved ${saved} vs a motorcycle taxi.`,
        ...(({ channelId: CH_DONE } as any)),
      },
      trigger: null,
    });
  } catch {
    /* ignore */
  }
}

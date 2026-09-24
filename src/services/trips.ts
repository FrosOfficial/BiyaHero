// Trip savings + trip history, stored only on this phone.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TripSummary } from '../logic/routeMath';
import { Direction } from '../data/route';
import { Segment } from '../logic/rideLog';

export interface MonthTotals {
  rides: number;
  saved: number; // ₱
  co2g: number;
}

/** One finished ride, as shown in Trip History. */
export interface TripRecord extends TripSummary {
  id: string;
  num: number; // trip number: #1, #2, ... (never reused)
  startedAt: number; // ms timestamp when you started the ride alert
  endedAt: number; // ms timestamp when you got off
  direction: Direction;
  discounted: boolean;
  segments?: Segment[]; // stop-to-stop times
  avgKph?: number | null;
  maxKph?: number | null;
}

const key = (d = new Date()) => `trips:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const HISTORY_KEY = 'tripHistory';
const COUNTER_KEY = 'tripCounter';
const MAX_HISTORY = 300; // oldest trips drop off after this

export async function getMonthTotals(): Promise<MonthTotals> {
  try {
    const raw = await AsyncStorage.getItem(key());
    if (raw) return JSON.parse(raw) as MonthTotals;
  } catch {
    /* ignore */
  }
  return { rides: 0, saved: 0, co2g: 0 };
}

/** All saved trips, newest first. */
export async function getTripHistory(): Promise<TripRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw) as TripRecord[];
  } catch {
    /* ignore */
  }
  return [];
}

export async function deleteTrip(id: string): Promise<TripRecord[]> {
  const list = (await getTripHistory()).filter((t) => t.id !== id);
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

export async function clearTripHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Saves a finished trip: adds it to this month's totals and to Trip History.
 * Returns the new month totals.
 */
export async function recordTrip(
  trip: TripSummary,
  info: { startedAt: number; endedAt: number; direction: Direction; discounted: boolean; segments?: Segment[]; avgKph?: number | null; maxKph?: number | null }
): Promise<MonthTotals> {
  const cur = await getMonthTotals();
  const next: MonthTotals = {
    rides: cur.rides + 1,
    saved: cur.saved + trip.savedMin, // count the conservative (lowest) saving
    co2g: cur.co2g + trip.co2g,
  };
  try {
    await AsyncStorage.setItem(key(), JSON.stringify(next));
  } catch {
    /* ignore */
  }

  // history entry
  try {
    const n = Number((await AsyncStorage.getItem(COUNTER_KEY)) || '0') + 1;
    await AsyncStorage.setItem(COUNTER_KEY, String(n));
    const rec: TripRecord = { ...trip, ...info, id: `${info.endedAt}-${n}`, num: n };
    const list = [rec, ...(await getTripHistory())].slice(0, MAX_HISTORY);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return next;
}

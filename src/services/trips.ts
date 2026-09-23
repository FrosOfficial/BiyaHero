// Trip savings history, stored only on this phone.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TripSummary } from '../logic/routeMath';

export interface MonthTotals {
  rides: number;
  saved: number; // ₱
  co2g: number;
}

const key = (d = new Date()) => `trips:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export async function getMonthTotals(): Promise<MonthTotals> {
  try {
    const raw = await AsyncStorage.getItem(key());
    if (raw) return JSON.parse(raw) as MonthTotals;
  } catch {
    /* ignore */
  }
  return { rides: 0, saved: 0, co2g: 0 };
}

/** Adds a finished trip to this month's totals and returns the new totals. */
export async function recordTrip(trip: TripSummary): Promise<MonthTotals> {
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
  return next;
}

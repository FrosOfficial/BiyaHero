import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Coords } from '../hooks/useLocation';
import { isConfigured } from '../firebase';
import { Lang, translate } from '../i18n';

export type JeepStatus = 'driving' | 'terminal' | 'break';

export const MIN_MAX_CAP = 20;
export const MAX_MAX_CAP = 30;

interface AppState {
  isConfigured: boolean;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  base: Coords | null;
  setBase: (c: Coords) => void;
  // driver identity + state
  driverId: string;
  plate: string;
  name: string;
  capacity: number;
  status: JeepStatus;
  maxCapacity: number;
  setPlate: (v: string) => void;
  setName: (v: string) => void;
  setMaxCapacity: (v: number) => void;
  setDriverStatus: (s: JeepStatus) => void;
  adjustCapacity: (delta: number) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

function randomId() {
  return 'jeep-' + Math.random().toString(36).slice(2, 8);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function distanceMeters(a: Coords, b: Coords): number {
  const R = 6371000;
  const x = ((b.longitude - a.longitude) * Math.PI) / 180 * Math.cos(((a.latitude + b.latitude) / 2) * Math.PI / 180);
  const y = ((b.latitude - a.latitude) * Math.PI) / 180;
  return Math.sqrt(x * x + y * y) * R;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [base, setBaseState] = useState<Coords | null>(null);
  const [driverId, setDriverId] = useState<string>('');
  const [plate, setPlateState] = useState('');
  const [name, setNameState] = useState('Driver');
  const [capacity, setCapacity] = useState(8);
  const [maxCapacity, setMaxCapacityState] = useState(MIN_MAX_CAP);
  const [status, setStatus] = useState<JeepStatus>('driving');
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    (async () => {
      try {
        let id = await AsyncStorage.getItem('driverId');
        if (!id) {
          id = randomId();
          await AsyncStorage.setItem('driverId', id);
        }
        setDriverId(id);
        const p = await AsyncStorage.getItem('plate');
        const n = await AsyncStorage.getItem('name');
        const mc = await AsyncStorage.getItem('maxCapacity');
        const lg = await AsyncStorage.getItem('lang');
        if (p) setPlateState(p);
        if (n) setNameState(n);
        if (mc) setMaxCapacityState(clamp(parseInt(mc, 10) || MIN_MAX_CAP, MIN_MAX_CAP, MAX_MAX_CAP));
        if (lg === 'fil' || lg === 'en') setLangState(lg);
      } catch {
        setDriverId(randomId());
      }
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem('lang', l).catch(() => {});
  }, []);
  const t = useCallback((key: string) => translate(lang, key), [lang]);

  const setBase = useCallback((c: Coords) => setBaseState(c), []);
  const setPlate = useCallback((v: string) => {
    setPlateState(v);
    AsyncStorage.setItem('plate', v).catch(() => {});
  }, []);
  const setName = useCallback((v: string) => {
    setNameState(v);
    AsyncStorage.setItem('name', v).catch(() => {});
  }, []);
  const setMaxCapacity = useCallback((v: number) => {
    const mc = clamp(v, MIN_MAX_CAP, MAX_MAX_CAP);
    setMaxCapacityState(mc);
    setCapacity((c) => Math.min(c, mc)); // strictly enforce: headcount can't exceed max
    AsyncStorage.setItem('maxCapacity', String(mc)).catch(() => {});
  }, []);
  const setDriverStatus = useCallback((s: JeepStatus) => setStatus(s), []);
  const adjustCapacity = useCallback(
    (delta: number) => setCapacity((c) => clamp(c + delta, 0, maxCapacity)),
    [maxCapacity]
  );

  return (
    <AppContext.Provider
      value={{
        isConfigured,
        lang,
        setLang,
        t,
        base,
        setBase,
        driverId,
        plate,
        name,
        capacity,
        status,
        maxCapacity,
        setPlate,
        setName,
        setMaxCapacity,
        setDriverStatus,
        adjustCapacity,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

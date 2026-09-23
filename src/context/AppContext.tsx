import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Coords } from '../hooks/useLocation';
import { isConfigured } from '../firebase';
import { Lang, translate } from '../i18n';
import { Direction } from '../data/route';
import { distanceMeters as routeDistance } from '../logic/routeMath';

interface AppState {
  isConfigured: boolean;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  base: Coords | null;
  setBase: (c: Coords) => void;
  // anonymous id for this phone (used for rider-powered jeep tracking)
  deviceId: string;
  // commuter preferences
  riderDirection: Direction;
  setRiderDirection: (d: Direction) => void;
  discounted: boolean; // student / senior / PWD fare
  setDiscounted: (v: boolean) => void;
  voiceMuted: boolean; // mute the spoken "para po" alert
  setVoiceMuted: (v: boolean) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

function randomId() {
  return 'rider-' + Math.random().toString(36).slice(2, 8);
}

export function distanceMeters(a: Coords, b: Coords): number {
  return routeDistance(a, b);
}

// Stored under the old 'driverId' key so phones that already have an id keep it.
const ID_KEY = 'driverId';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [base, setBaseState] = useState<Coords | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [lang, setLangState] = useState<Lang>('en');
  const [riderDirection, setRiderDirectionState] = useState<Direction>('toPRC');
  const [discounted, setDiscountedState] = useState(false);
  const [voiceMuted, setVoiceMutedState] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        let id = await AsyncStorage.getItem(ID_KEY);
        if (!id) {
          id = randomId();
          await AsyncStorage.setItem(ID_KEY, id);
        }
        setDeviceId(id);
        const lg = await AsyncStorage.getItem('lang');
        if (lg === 'fil' || lg === 'en') setLangState(lg);
        const rd = await AsyncStorage.getItem('riderDirection');
        if (rd === 'toPRC' || rd === 'toMantrade') setRiderDirectionState(rd);
        const dc = await AsyncStorage.getItem('discounted');
        if (dc === 'yes') setDiscountedState(true);
        const vm = await AsyncStorage.getItem('voiceMuted');
        if (vm === 'yes') setVoiceMutedState(true);
      } catch {
        setDeviceId(randomId());
      }
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem('lang', l).catch(() => {});
  }, []);
  const t = useCallback((key: string) => translate(lang, key), [lang]);

  const setBase = useCallback((c: Coords) => setBaseState(c), []);
  const setRiderDirection = useCallback((d: Direction) => {
    setRiderDirectionState(d);
    AsyncStorage.setItem('riderDirection', d).catch(() => {});
  }, []);
  const setDiscounted = useCallback((v: boolean) => {
    setDiscountedState(v);
    AsyncStorage.setItem('discounted', v ? 'yes' : 'no').catch(() => {});
  }, []);
  const setVoiceMuted = useCallback((v: boolean) => {
    setVoiceMutedState(v);
    AsyncStorage.setItem('voiceMuted', v ? 'yes' : 'no').catch(() => {});
  }, []);

  return (
    <AppContext.Provider
      value={{
        isConfigured,
        lang,
        setLang,
        t,
        base,
        setBase,
        deviceId,
        riderDirection,
        setRiderDirection,
        discounted,
        setDiscounted,
        voiceMuted,
        setVoiceMuted,
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

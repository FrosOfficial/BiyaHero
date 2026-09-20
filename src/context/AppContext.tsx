import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Coords } from '../hooks/useLocation';
import { isConfigured } from '../firebase';

export type JeepStatus = 'driving' | 'terminal' | 'break';

const MAX_CAPACITY = 20;

interface AppState {
  isConfigured: boolean;
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
  setDriverStatus: (s: JeepStatus) => void;
  adjustCapacity: (delta: number) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

function randomId() {
  return 'jeep-' + Math.random().toString(36).slice(2, 8);
}

export function distanceMeters(a: Coords, b: Coords): number {
  const R = 6371000;
  const x = ((b.longitude - a.longitude) * Math.PI) / 180 * Math.cos(((a.latitude + b.latitude) / 2) * Math.PI / 180);
  const y = ((b.latitude - a.latitude) * Math.PI) / 180;
  return Math.sqrt(x * x + y * y) * R;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [base, setBaseState] = useState<Coords | null>(null);
  const [driverId, setDriverId] = useState<string>('');
  const [plate, setPlateState] = useState('MY JEEP');
  const [name, setNameState] = useState('Driver');
  const [capacity, setCapacity] = useState(8);
  const [status, setStatus] = useState<JeepStatus>('driving');

  // load / create persistent driver identity
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
        if (p) setPlateState(p);
        if (n) setNameState(n);
      } catch {
        setDriverId(randomId());
      }
    })();
  }, []);

  const setBase = useCallback((c: Coords) => setBaseState(c), []);
  const setPlate = useCallback((v: string) => {
    setPlateState(v);
    AsyncStorage.setItem('plate', v).catch(() => {});
  }, []);
  const setName = useCallback((v: string) => {
    setNameState(v);
    AsyncStorage.setItem('name', v).catch(() => {});
  }, []);
  const setDriverStatus = useCallback((s: JeepStatus) => setStatus(s), []);
  const adjustCapacity = useCallback(
    (delta: number) => setCapacity((c) => Math.max(0, Math.min(MAX_CAPACITY, c + delta))),
    []
  );

  return (
    <AppContext.Provider
      value={{
        isConfigured,
        base,
        setBase,
        driverId,
        plate,
        name,
        capacity,
        status,
        maxCapacity: MAX_CAPACITY,
        setPlate,
        setName,
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

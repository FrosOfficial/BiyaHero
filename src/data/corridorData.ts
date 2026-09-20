export interface Stop {
  id: string;
  name: string;
  short: string;
  commutersWaiting: number;
  order: number;
  latitude: number;
  longitude: number;
}

export type JeepStatus = 'driving' | 'terminal' | 'break';

export interface Jeepney {
  id: string;
  plateNumber: string;
  driverName: string;
  currentStopId: string;
  nextStopId: string;
  etaMinutes: number;
  capacityCount: number;
  maxCapacity: number; // 20 passengers
  status: JeepStatus;
  latitude: number;
  longitude: number;
}

export const CHINO_ROCES_STOPS: Stop[] = [
  { id: 'stop-1', name: 'Mantrade EDSA', short: 'Mantrade', commutersWaiting: 14, order: 1, latitude: 14.5401, longitude: 121.0189 },
  { id: 'stop-2', name: 'Don Bosco Makati', short: 'Don Bosco', commutersWaiting: 8, order: 2, latitude: 14.5492, longitude: 121.0143 },
  { id: 'stop-3', name: 'Waltermart / Pio Del Pilar', short: 'Waltermart', commutersWaiting: 22, order: 3, latitude: 14.5543, longitude: 121.0118 },
  { id: 'stop-4', name: 'San Antonio / Buendia', short: 'Buendia', commutersWaiting: 11, order: 4, latitude: 14.5601, longitude: 121.0089 },
  { id: 'stop-5', name: 'Shopwise Makati', short: 'Shopwise', commutersWaiting: 18, order: 5, latitude: 14.5654, longitude: 121.0068 },
  { id: 'stop-6', name: 'PRC Makati', short: 'PRC', commutersWaiting: 31, order: 6, latitude: 14.5712, longitude: 121.0121 },
];

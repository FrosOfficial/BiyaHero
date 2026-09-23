import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useKeepAwake } from 'expo-keep-awake';
import { useApp, distanceMeters, JeepStatus } from '../context/AppContext';
import { useLocation } from '../hooks/useLocation';
import { broadcastJeep, removeJeep, subscribeWaiting, removeWaiting, subscribeDropoffs, waitingByStop, WaitingPing } from '../services/live';
import { STOPS, TERMINALS, stopsFor, lineFor } from '../data/route';
import { progressOnRoute, headingFromMovement, stopOffsets } from '../logic/routeMath';
import DirectionToggle from '../components/DirectionToggle';
import { PALETTE, FONT, neoShadow } from '../theme/theme';
import NeoCard from '../components/NeoCard';
import NeoButton from '../components/NeoButton';
import { levelFromRatio } from '../components/StatusMeterPill';
import LeafletMap, { StopMarker } from '../components/LeafletMap';

const TERMINAL_RADIUS = 150; // m: inside this you're "at the terminal"
const HUB_RADIUS = 60; // m: passing a stop / waiting rider
const LATE_HOUR = 21.5; // 9:30 PM: terminal departures default to Half-full

type End = 'mantrade' | 'prc';
const TERMINAL_STOP: Record<End, (typeof STOPS)[number]> = { mantrade: TERMINALS[0], prc: TERMINALS[1] };

function nearTerminal(c: { latitude: number; longitude: number }, radius = TERMINAL_RADIUS): End | null {
  for (const id of ['mantrade', 'prc'] as const) {
    if (distanceMeters(c, TERMINAL_STOP[id]) < radius) return id;
  }
  return null;
}

const SEAT_LEVELS: { level: 'chill' | 'squeezed' | 'sabit'; color: string; icon: any; fill: number }[] = [
  { level: 'chill', color: PALETTE.mint, icon: 'happy-outline', fill: 0.2 },
  { level: 'squeezed', color: PALETTE.yellow, icon: 'people-outline', fill: 0.65 },
  { level: 'sabit', color: PALETTE.coral, icon: 'alert-outline', fill: 1 },
];

const STATUS_BUTTONS: { status: JeepStatus; key: string; color: string }[] = [
  { status: 'driving', key: 'drivingRoute', color: PALETTE.mint },
  { status: 'terminal', key: 'atTerminal', color: PALETTE.yellow },
  { status: 'break', key: 'onBreak', color: '#A1A1AA' },
];

export default function DriverScreen() {
  const {
    isConfigured, base, setBase, t, lang,
    driverId, plate, name, capacity, status, maxCapacity,
    setPlate, setName, setMaxCapacity, setDriverStatus, adjustCapacity,
    setCapacityTo, driverDirection, setDriverDirection,
  } = useApp();
  const { coords, perm } = useLocation();
  const [waiting, setWaiting] = useState<WaitingPing[]>([]);
  const [entered, setEntered] = useState(false);
  const [plateInput, setPlateInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  useEffect(() => { if (coords) setBase(coords); }, [coords, setBase]);
  useEffect(() => subscribeWaiting(setWaiting), []);

  // returning driver with a saved plate skips the gate
  useEffect(() => {
    if (plate) { setEntered(true); setPlateInput(plate); }
    if (name && name !== 'Driver') setNameInput(name);
  }, [plate, name]);

  // broadcast only once the driver is "in" (plate set)
  useEffect(() => {
    if (!entered || !base || !driverId) return;
    const send = () =>
      broadcastJeep({
        id: driverId, plateNumber: plate || 'MY JEEP', driverName: name || 'Driver',
        latitude: base.latitude, longitude: base.longitude,
        capacityCount: capacity, maxCapacity, status, direction: driverDirection, updatedAt: Date.now(),
      });
    send();
    const t = setInterval(send, 4000);
    return () => clearInterval(t);
  }, [entered, base, driverId, plate, name, capacity, maxCapacity, status, driverDirection]);

  useEffect(() => () => { if (driverId) removeJeep(driverId); }, [driverId]);

  // keep the screen awake while in Driver mode so the driver never fumbles to unlock
  useKeepAwake();

  // ---------- zero-tap seat rules ----------
  // Latest values for callbacks that outlive a render (Firebase listeners, timers)
  const live = useRef({ capacity, maxCapacity, adjustCapacity });
  live.current = { capacity, maxCapacity, adjustCapacity };

  // Riders who tap "I got off" free a seat automatically
  useEffect(() => {
    if (!entered || !driverId) return;
    return subscribeDropoffs(driverId, (n) => live.current.adjustCapacity(-n));
  }, [entered, driverId]);

  const prevTerminal = useRef<End | null>(null);
  const lastStopAlong = useRef<number | null>(null);
  const lastAlong = useRef<number | null>(null);
  const hubsDone = useRef<Set<string>>(new Set());
  const pingsDone = useRef<Set<string>>(new Set());
  const moveRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const manualUntil = useRef(0); // pause auto-status after a manual tap

  useEffect(() => {
    if (!entered || !base) return;
    const prev = prevTerminal.current;
    // hysteresis: once inside, you only "leave" past 200 m, so GPS jitter can't re-trigger
    const term = prev && distanceMeters(base, TERMINAL_STOP[prev]) < TERMINAL_RADIUS + 50 ? prev : nearTerminal(base);

    // 1) Terminal rule: leaving a terminal -> jeep left full (half-full late at night)
    if (prev && !term) {
      const now = new Date();
      const late = now.getHours() + now.getMinutes() / 60 >= LATE_HOUR;
      setDriverDirection(prev === 'mantrade' ? 'toPRC' : 'toMantrade');
      setCapacityTo(late ? Math.ceil(maxCapacity / 2) : maxCapacity);
      setDriverStatus('driving');
      hubsDone.current = new Set();
    }
    // 2) Arriving at the far terminal -> everyone gets off, jeep parks and loads
    if (!prev && term && status === 'driving') {
      const isEnd = (term === 'prc' && driverDirection === 'toPRC') || (term === 'mantrade' && driverDirection === 'toMantrade');
      if (isEnd) {
        setCapacityTo(0);
        setDriverStatus('terminal');
      }
    }
    prevTerminal.current = term;

    // 3) Heading from movement (for drivers who go online mid-route)
    const along = progressOnRoute(base, 'toPRC').along;
    if (!term && lastAlong.current !== null) {
      const h = headingFromMovement(lastAlong.current, along);
      if (h && h !== driverDirection) setDriverDirection(h);
    }
    if (lastAlong.current === null || Math.abs(along - lastAlong.current) >= 25) lastAlong.current = along;

    if (status !== 'driving') return;

    // 4) Turnover hubs: big groups get off at Buendia and Waltermart
    STOPS.filter((st) => st.turnover).forEach((st) => {
      if (hubsDone.current.has(st.id) || distanceMeters(base, st) > HUB_RADIUS) return;
      hubsDone.current.add(st.id);
      if (capacity / maxCapacity >= 0.85) setCapacityTo(Math.floor(maxCapacity * 0.6));
    });
  }, [entered, base]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- auto start / stop ----------
  // The driver never taps a status. Moving along the route -> Driving.
  // Parked/idle for a while (and not at a terminal) -> On break. A manual tap
  // pauses this for a few minutes so the driver can override if needed.
  const MOVE_M = 15; // meters that count as "moving"
  const IDLE_MS = 90 * 1000; // stopped this long -> on break
  useEffect(() => {
    if (!entered || !base) return;
    if (Date.now() < manualUntil.current) return;
    const nowTs = Date.now();
    const prev = moveRef.current;
    if (!prev) { moveRef.current = { lat: base.latitude, lng: base.longitude, ts: nowTs }; return; }
    const moved = distanceMeters({ latitude: prev.lat, longitude: prev.lng }, base);
    const atTerminal = nearTerminal(base) !== null;
    if (moved >= MOVE_M) {
      moveRef.current = { lat: base.latitude, lng: base.longitude, ts: nowTs };
      if (status !== 'driving' && !atTerminal) setDriverStatus('driving');
    } else if (nowTs - prev.ts > IDLE_MS && status === 'driving' && !atTerminal) {
      setDriverStatus('break');
    }
  }, [entered, base, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // riders waiting at stops AHEAD of the jeep, going the same way (within 1.5 km)
  const dirStops = stopsFor(driverDirection);
  const dirOffsets = stopOffsets(driverDirection);
  const myAlong = base ? progressOnRoute(base, driverDirection).along : 0;
  const counts = waitingByStop(waiting, driverDirection);
  const aheadStops = dirStops
    .map((st, i) => ({ st, gap: dirOffsets[i] - myAlong, n: counts[st.id] ?? 0 }))
    .filter((x) => x.n > 0 && x.gap > -HUB_RADIUS && x.gap < 1500);
  const nearbyWaiting = aheadStops.reduce((sum, x) => sum + x.n, 0);
  const nextWaitingStop = aheadStops[0];

  // 5) Auto-boarding: when a driving jeep WITH open seats passes a stop where riders
  // are waiting (same direction), it picks them up: +1 per rider, their pings clear.
  // Uses position ALONG the route, so a jumpy GPS fix can't skip a stop.
  useEffect(() => {
    if (!entered || !base || status !== 'driving') return;
    const prevAlong = lastStopAlong.current;
    lastStopAlong.current = myAlong;
    if (prevAlong === null || myAlong <= prevAlong) return;
    let room = maxCapacity - capacity;
    dirStops.forEach((st, i) => {
      const at = dirOffsets[i];
      if (!(prevAlong < at + HUB_RADIUS && myAlong >= at - HUB_RADIUS)) return; // not passing this stop now
      waiting.forEach((w) => {
        if (room <= 0 || w.stopId !== st.id || pingsDone.current.has(w.id)) return;
        if (w.direction && w.direction !== driverDirection) return;
        pingsDone.current.add(w.id);
        removeWaiting(w.id);
        adjustCapacity(1);
        room -= 1;
      });
    });
  }, [entered, base, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Voice alert: speak when more riders start waiting nearby (eyes stay on the road)
  const prevWaitRef = useRef(0);
  useEffect(() => {
    if (entered && status === 'driving' && nearbyWaiting > prevWaitRef.current) {
      Speech.stop();
      const where = nextWaitingStop ? nextWaitingStop.st.short : '';
      const msg = lang === 'fil'
        ? `${nearbyWaiting} pasahero ang naghihintay${where ? ' sa ' + where : ''}`
        : `${nearbyWaiting} rider${nearbyWaiting > 1 ? 's' : ''} waiting${where ? ' at ' + where : ' ahead'}`;
      Speech.speak(msg, { language: lang === 'fil' ? 'fil-PH' : 'en-US', rate: 0.95 });
    }
    prevWaitRef.current = nearbyWaiting;
  }, [nearbyWaiting, status, entered, lang]);

  if (perm === 'denied') {
    return (
      <View style={styles.center}>
        <Ionicons name="location-outline" size={48} color={PALETTE.coral} />
        <Text style={styles.msgTitle}>{t('locationOff')}</Text>
        <Text style={styles.msg}>{t('driverLocationNeed')}</Text>
      </View>
    );
  }
  if (!coords) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PALETTE.blue} />
        <Text style={styles.msg}>{t('gettingLocation')}</Text>
      </View>
    );
  }

  // ---- PLATE GATE ----
  if (!entered) {
    // PH plates: 6-7 letters/numbers (e.g. ABC123 or ABC1234)
    const sanitizePlate = (v: string) => v.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7);
    const ok = plateInput.length === 6 || plateInput.length === 7;
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <NeoCard style={styles.card}>
          <Text style={styles.cardTitle}>{t('registerJeep')}</Text>
          <Text style={styles.gateHint}>{t('gateHint')}</Text>
          <Text style={styles.fieldLabel}>{t('plateLabel')}</Text>
          <TextInput
            style={styles.input}
            value={plateInput}
            onChangeText={(v) => setPlateInput(sanitizePlate(v))}
            placeholder="e.g. NVK402"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
          />
          <Text style={styles.fieldLabel}>{t('driverNameOpt')}</Text>
          <TextInput style={styles.input} value={nameInput} onChangeText={setNameInput} placeholder="e.g. Mang Ben" />
          <NeoButton
            label={ok ? t('goOnline') : t('enterValidPlate')}
            color={ok ? PALETTE.mint : '#D4D4D8'}
            onPress={() => {
              if (!ok) return;
              setPlate(plateInput);
              setName(nameInput.trim() || 'Driver');
              setEntered(true);
            }}
          />
        </NeoCard>
      </ScrollView>
    );
  }

  // ---- MAIN HUD ----
  const ratio = capacity / maxCapacity;
  const stopMarkers: StopMarker[] = dirStops.map((st) => ({
    id: st.id,
    latitude: st.latitude,
    longitude: st.longitude,
    name: st.short,
    kind: nextWaitingStop?.st.id === st.id ? 'next' : 'stop',
    waiting: counts[st.id] ?? 0,
  }));
  const canEditSeats = status !== 'driving';

  return (
    <View style={styles.flex}>
      {/* fixed map area - kept OUT of the scroll view so pinch/pan don't fight scrolling */}
      <View style={styles.mapWrap}>
        <LeafletMap style={styles.map} center={coords} user={coords} stops={stopMarkers} line={lineFor(driverDirection)} badgeSide={driverDirection === 'toPRC' ? 'right' : 'left'} />
        <View style={[styles.liveTag, { backgroundColor: status === 'driving' ? PALETTE.mint : '#A1A1AA' }]}>
          <Text style={styles.liveText}>{status === 'driving' ? t('live') : '○ ' + t(status === 'terminal' ? 'atTerminal' : 'onBreak')}</Text>
        </View>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        {!isConfigured && (
          <View style={styles.notice}>
            <Ionicons name="cloud-offline-outline" size={16} color={PALETTE.textMuted} />
            <Text style={styles.noticeText}>Not connected to live sync yet.</Text>
          </View>
        )}

        {/* Seat status — one tap, no counting */}
        <NeoCard style={styles.card}>
          <Text style={styles.cardTitle}>{t('seatStatusTitle')}</Text>
          <View style={styles.seatBtns}>
            {SEAT_LEVELS.map((lv) => {
              const on = levelFromRatio(ratio) === lv.level;
              return (
                <NeoButton
                  key={lv.level}
                  style={styles.seatBtn}
                  label={t(lv.level)}
                  color={on ? lv.color : PALETTE.card2}
                  textColor={on ? '#FFFFFF' : PALETTE.textMuted}
                  icon={<Ionicons name={lv.icon} size={16} color={on ? '#FFFFFF' : PALETTE.textMuted} />}
                  onPress={() => setCapacityTo(Math.round(maxCapacity * lv.fill))}
                />
              );
            })}
          </View>
          <Text style={styles.hint}>{t('seatStatusHint')}</Text>
        </NeoCard>

        {/* Direction */}
        <NeoCard style={styles.card}>
          <Text style={styles.cardTitle}>{t('heading')}</Text>
          <DirectionToggle value={driverDirection} onChange={canEditSeats ? setDriverDirection : undefined} />
        </NeoCard>

        {/* Riders waiting ahead */}
        <NeoCard style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{t('waitingNearby')}</Text>
            <Text style={styles.bigCount}>{nearbyWaiting}</Text>
          </View>
          {aheadStops.length ? (
            aheadStops.slice(0, 3).map((x) => (
              <View key={x.st.id} style={styles.aheadRow}>
                <Text style={styles.aheadStop}>{x.st.short}</Text>
                <Text style={styles.aheadMeta}>{x.n} · {Math.max(0, Math.round(x.gap))} m</Text>
              </View>
            ))
          ) : (
            <Text style={styles.hint}>{t('within')}</Text>
          )}
        </NeoCard>

        {/* Status */}
        <NeoCard style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{t('myStatus')}</Text>
            <View style={[styles.autoPill, { backgroundColor: status === 'driving' ? PALETTE.mint : PALETTE.card2 }]}>
              <Text style={[styles.autoPillText, { color: status === 'driving' ? '#FFFFFF' : PALETTE.textMuted }]}>{t('auto')}</Text>
            </View>
          </View>
          <Text style={styles.hint}>{t('statusAutoHint')}</Text>
          <View style={styles.statusCol}>
            {STATUS_BUTTONS.map((b) => (
              <NeoButton
                key={b.status}
                label={t(b.key)}
                color={status === b.status ? b.color : PALETTE.card2}
                textColor={status === b.status ? undefined : PALETTE.textMuted}
                onPress={() => { manualUntil.current = Date.now() + 5 * 60 * 1000; setDriverStatus(b.status); }}
              />
            ))}
          </View>
        </NeoCard>

        {/* My jeep */}
        <NeoCard style={styles.card}>
          <Text style={styles.cardTitle}>{t('myJeep')} · {plate}</Text>
          <View style={styles.stepRow}>
            <NeoButton label="–" color={canEditSeats ? PALETTE.coral : PALETTE.card2} textColor={canEditSeats ? '#FFFFFF' : PALETTE.textMuted} onPress={() => canEditSeats && setMaxCapacity(maxCapacity - 1)} style={styles.stepBtn} />
            <View style={styles.countBox}>
              <Text style={styles.countNum}>{maxCapacity}</Text>
              <Text style={styles.countMax}>{t('seats')}</Text>
            </View>
            <NeoButton label="+" color={canEditSeats ? PALETTE.mint : PALETTE.card2} textColor={canEditSeats ? '#FFFFFF' : PALETTE.textMuted} onPress={() => canEditSeats && setMaxCapacity(maxCapacity + 1)} style={styles.stepBtn} />
          </View>
          {!canEditSeats ? <Text style={styles.hint}>{t('seatsHintLocked')}</Text> : null}
        </NeoCard>

        <View style={{ height: 16 }} />
            </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: PALETTE.bg },
  scroll: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: PALETTE.bg },
  msgTitle: { fontSize: 18, fontWeight: FONT.bold, color: PALETTE.text },
  msg: { fontSize: 14, fontWeight: FONT.medium, color: PALETTE.textMuted, textAlign: 'center' },
  mapWrap: { height: 240, borderBottomWidth: 1, borderColor: PALETTE.border },
  map: { flex: 1 },
  liveTag: { position: 'absolute', top: 12, right: 12, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, ...neoShadow(2) },
  liveText: { fontSize: 12, fontWeight: FONT.bold, color: '#FFFFFF' },
  card: { backgroundColor: PALETTE.cardBg },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 6 },
  noticeText: { fontSize: 12, fontWeight: FONT.medium, color: PALETTE.textMuted },
  cardTitle: { fontSize: 15, fontWeight: FONT.bold, color: PALETTE.text },
  gateHint: { fontSize: 13, fontWeight: FONT.medium, color: PALETTE.textMuted, marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: FONT.medium, color: PALETTE.textMuted, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: PALETTE.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, fontWeight: FONT.medium, color: PALETTE.text, marginBottom: 14, backgroundColor: PALETTE.card2 },
  statusCol: { gap: 10 },
  bigCount: { fontSize: 30, fontWeight: FONT.bold, color: PALETTE.coral },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stepBtn: { width: 72 },
  countBox: { alignItems: 'center', flex: 1 },
  countNum: { fontSize: 40, fontWeight: FONT.bold, color: PALETTE.text },
  countMax: { fontSize: 13, fontWeight: FONT.medium, color: PALETTE.textMuted },
  seatBtns: { flexDirection: 'row', gap: 8 },
  autoPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  autoPillText: { fontSize: 10, fontWeight: FONT.bold, letterSpacing: 0.3, textTransform: 'uppercase' },
  seatBtn: { flex: 1 },
  aheadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderColor: PALETTE.border },
  aheadStop: { fontSize: 14, fontWeight: FONT.bold, color: PALETTE.text },
  aheadMeta: { fontSize: 13, fontWeight: FONT.medium, color: PALETTE.purple },
  hint: { fontSize: 12, fontWeight: FONT.medium, color: PALETTE.textMuted, marginTop: 10 },
});

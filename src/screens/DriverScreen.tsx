import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useKeepAwake } from 'expo-keep-awake';
import { useApp, distanceMeters, JeepStatus, MIN_MAX_CAP, MAX_MAX_CAP } from '../context/AppContext';
import { useLocation } from '../hooks/useLocation';
import { broadcastJeep, removeJeep, subscribeWaiting, removeWaiting, WaitingPing } from '../services/live';
import { PALETTE, FONT } from '../theme/theme';
import NeoCard from '../components/NeoCard';
import NeoButton from '../components/NeoButton';
import StatusMeterPill, { levelFromRatio } from '../components/StatusMeterPill';
import LeafletMap, { WaitingMarker } from '../components/LeafletMap';

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
        capacityCount: capacity, maxCapacity, status, updatedAt: Date.now(),
      });
    send();
    const t = setInterval(send, 4000);
    return () => clearInterval(t);
  }, [entered, base, driverId, plate, name, capacity, maxCapacity, status]);

  useEffect(() => () => { if (driverId) removeJeep(driverId); }, [driverId]);

  // keep the screen awake while in Driver mode so the driver never fumbles to unlock
  useKeepAwake();

  // riders waiting within 1.5 km of the driver right now
  const nearbyWaiting = base ? waiting.filter((w) => distanceMeters(base, w) < 1500).length : waiting.length;

  // Auto-clear: a driving jeep WITH open seats that passes within ~60m of a waiting
  // pin is assumed to have picked them up, so remove that ping.
  useEffect(() => {
    if (!entered || !base || status !== 'driving' || capacity >= maxCapacity) return;
    waiting.forEach((w) => {
      if (distanceMeters(base, w) < 60) removeWaiting(w.id);
    });
  }, [entered, base, status, capacity, maxCapacity, waiting]);

  // Voice alert: speak when more riders start waiting nearby (eyes stay on the road)
  const prevWaitRef = useRef(0);
  useEffect(() => {
    if (entered && status === 'driving' && nearbyWaiting > prevWaitRef.current) {
      Speech.stop();
      const msg = lang === 'fil'
        ? `${nearbyWaiting} pasahero ang naghihintay malapit`
        : `${nearbyWaiting} rider${nearbyWaiting > 1 ? 's' : ''} waiting nearby`;
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
  const waitMarkers: WaitingMarker[] = waiting.map((w) => ({ id: w.id, latitude: w.latitude, longitude: w.longitude }));
  const canEditSeats = status !== 'driving';

  return (
    <View style={styles.flex}>
      {/* fixed map area - kept OUT of the scroll view so pinch/pan don't fight scrolling */}
      <View style={styles.mapWrap}>
        <LeafletMap style={styles.map} center={coords} user={coords} waiting={waitMarkers} />
        <View style={[styles.liveTag, { backgroundColor: status === 'driving' ? PALETTE.mint : '#A1A1AA' }]}>
          <Text style={styles.liveText}>{status === 'driving' ? t('live') : '○ ' + t(status === 'terminal' ? 'atTerminal' : 'onBreak')}</Text>
        </View>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        {!isConfigured && (
          <NeoCard style={[styles.card, { backgroundColor: PALETTE.yellow }]}>
            <Text style={styles.warn}>⚠ Firebase not connected. Add your config so commuters can see you.</Text>
          </NeoCard>
        )}

        {/* Live tools at the top: headcount + waiting */}
        <NeoCard style={styles.card}>
          <Text style={styles.cardTitle}>{t('passengerHeadcount')}</Text>
          <View style={styles.stepRow}>
            <NeoButton label="–" color={PALETTE.coral} textColor="#FFFFFF" onPress={() => adjustCapacity(-1)} offset={4} style={styles.stepBtn} />
            <View style={styles.countBox}>
              <Text style={styles.countNum}>{capacity}</Text>
              <Text style={styles.countMax}>/ {maxCapacity}</Text>
            </View>
            <NeoButton label="+" color={PALETTE.mint} onPress={() => adjustCapacity(1)} offset={4} style={styles.stepBtn} />
          </View>
          <View style={styles.pillRow}>
            <StatusMeterPill level={levelFromRatio(ratio)} label={t(levelFromRatio(ratio))} />
            <Ionicons name={levelFromRatio(ratio) === 'sabit' ? 'warning' : 'checkmark-circle'} size={22} color={levelFromRatio(ratio) === 'sabit' ? PALETTE.coral : PALETTE.mint} />
          </View>
          <Text style={styles.hint}>{t('headcountHint')} {capacity}/{maxCapacity} {t('aboard')}.</Text>
        </NeoCard>

        <NeoCard tag={`★ ${t('ridersWaiting')}`} tagColor={PALETTE.coral} style={styles.card}>
          <Text style={styles.cardTitle}>{t('waitingNearby')}</Text>
          <View style={styles.nextBox}>
            <Text style={styles.nextCount}>{nearbyWaiting}</Text>
            <Text style={styles.nextLabel}>{t('within')}</Text>
          </View>
          <Text style={styles.hint}>{t('waitingPinsHint')}</Text>
        </NeoCard>

        <NeoCard style={styles.card}>
          <Text style={styles.cardTitle}>{t('myStatus')}</Text>
          <View style={styles.statusCol}>
            {STATUS_BUTTONS.map((b) => (
              <NeoButton key={b.status} label={t(b.key)} color={status === b.status ? b.color : PALETTE.cardBg} onPress={() => setDriverStatus(b.status)} offset={4} />
            ))}
          </View>
        </NeoCard>

        <NeoCard style={styles.card}>
          <Text style={styles.cardTitle}>{t('myJeep')} · {plate}</Text>
          <Text style={styles.fieldLabel}>{t('totalSeats')}</Text>
          <View style={styles.stepRow}>
            <NeoButton label="–" color={canEditSeats ? PALETTE.coral : '#D4D4D8'} textColor="#FFFFFF" onPress={() => canEditSeats && setMaxCapacity(maxCapacity - 1)} offset={4} style={styles.stepBtn} />
            <View style={styles.countBox}>
              <Text style={styles.countNum}>{maxCapacity}</Text>
              <Text style={styles.countMax}>{t('seats')}</Text>
            </View>
            <NeoButton label="+" color={canEditSeats ? PALETTE.mint : '#D4D4D8'} onPress={() => canEditSeats && setMaxCapacity(maxCapacity + 1)} offset={4} style={styles.stepBtn} />
          </View>
          <Text style={styles.hint}>{canEditSeats ? t('seatsHintEditable') : t('seatsHintLocked')}</Text>
        </NeoCard>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: PALETTE.bg },
  scroll: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: PALETTE.bg },
  msgTitle: { fontSize: 18, fontWeight: FONT.black, color: PALETTE.text },
  msg: { fontSize: 14, fontWeight: FONT.semibold, color: PALETTE.textMuted, textAlign: 'center' },
  mapWrap: { height: 260, borderBottomWidth: 3, borderColor: PALETTE.border },
  map: { flex: 1 },
  liveTag: { position: 'absolute', top: 10, right: 10, borderWidth: 2, borderColor: PALETTE.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  liveText: { fontSize: 12, fontWeight: FONT.black, color: PALETTE.border },
  card: { backgroundColor: PALETTE.cardBg },
  warn: { fontSize: 13, fontWeight: FONT.black, color: PALETTE.border, textAlign: 'center' },
  cardTitle: { fontSize: 16, fontWeight: FONT.black, color: PALETTE.text, marginBottom: 12 },
  gateHint: { fontSize: 13, fontWeight: FONT.semibold, color: PALETTE.textMuted, marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: FONT.bold, color: PALETTE.textMuted, marginBottom: 4 },
  input: { borderWidth: 2, borderColor: PALETTE.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontWeight: FONT.bold, color: PALETTE.text, marginBottom: 14, backgroundColor: PALETTE.bg },
  statusCol: { gap: 12 },
  nextBox: { alignItems: 'center', paddingVertical: 4 },
  nextCount: { fontSize: 56, fontWeight: FONT.black, color: PALETTE.coral, lineHeight: 58 },
  nextLabel: { fontSize: 12, fontWeight: FONT.bold, color: PALETTE.textMuted },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: { width: 90 },
  countBox: { alignItems: 'center' },
  countNum: { fontSize: 48, fontWeight: FONT.black, color: PALETTE.text },
  countMax: { fontSize: 14, fontWeight: FONT.bold, color: PALETTE.textMuted },
  pillRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  hint: { fontSize: 12, fontWeight: FONT.semibold, color: PALETTE.textMuted, marginTop: 10 },
});

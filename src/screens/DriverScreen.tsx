import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LeafletMap from '../components/LeafletMap';
import { useApp, distanceMeters } from '../context/AppContext';
import { useLocation } from '../hooks/useLocation';
import { broadcastJeep, removeJeep, subscribePings, Ping } from '../services/live';
import { PALETTE, FONT } from '../theme/theme';
import NeoCard from '../components/NeoCard';
import NeoButton from '../components/NeoButton';
import StatusMeterPill, { levelFromRatio } from '../components/StatusMeterPill';
import { JeepStatus } from '../context/AppContext';

const STATUS_BUTTONS: { status: JeepStatus; label: string; color: string }[] = [
  { status: 'driving', label: 'Driving Route', color: PALETTE.mint },
  { status: 'terminal', label: 'At Terminal', color: PALETTE.yellow },
  { status: 'break', label: 'On Break', color: '#A1A1AA' },
];

const NEARBY_M = 800;
const PING_WINDOW = 10 * 60 * 1000;

export default function DriverScreen() {
  const {
    isConfigured, base, setBase,
    driverId, plate, name, capacity, status, maxCapacity,
    setPlate, setName, setDriverStatus, adjustCapacity,
  } = useApp();
  const { coords, perm } = useLocation();
  const [pings, setPings] = useState<Ping[]>([]);

  useEffect(() => {
    if (coords) setBase(coords);
  }, [coords, setBase]);

  useEffect(() => {
    const unsub = subscribePings(setPings);
    return unsub;
  }, []);

  // broadcast live position whenever anything changes, and every 4s to stay "fresh"
  useEffect(() => {
    if (!base || !driverId) return;
    const send = () =>
      broadcastJeep({
        id: driverId,
        plateNumber: plate || 'MY JEEP',
        driverName: name || 'Driver',
        latitude: base.latitude,
        longitude: base.longitude,
        capacityCount: capacity,
        maxCapacity,
        status,
        updatedAt: Date.now(),
      });
    send();
    const t = setInterval(send, 4000);
    return () => clearInterval(t);
  }, [base, driverId, plate, name, capacity, status, maxCapacity]);

  // stop broadcasting when leaving Driver mode
  useEffect(() => {
    return () => {
      if (driverId) removeJeep(driverId);
    };
  }, [driverId]);

  if (perm === 'denied') {
    return (
      <View style={styles.center}>
        <Ionicons name="location-outline" size={48} color={PALETTE.coral} />
        <Text style={styles.msgTitle}>Location is off</Text>
        <Text style={styles.msg}>Drivers broadcast live GPS. Enable location permission, then reopen.</Text>
      </View>
    );
  }
  if (!coords) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PALETTE.blue} />
        <Text style={styles.msg}>Getting your location…</Text>
      </View>
    );
  }

  const ratio = capacity / maxCapacity;
  const nearbyWaiting = base
    ? pings.filter((p) => Date.now() - p.ts < PING_WINDOW && distanceMeters(base, p) < NEARBY_M).length
    : 0;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <View style={styles.mapWrap}>
        <LeafletMap style={styles.map} center={coords} user={coords} />
        <View style={[styles.liveTag, { backgroundColor: status === 'driving' ? PALETTE.mint : '#A1A1AA' }]}>
          <Text style={styles.liveText}>{status === 'driving' ? '● LIVE' : '○ ' + status.toUpperCase()}</Text>
        </View>
      </View>

      {!isConfigured && (
        <NeoCard style={[styles.card, { backgroundColor: PALETTE.yellow }]}>
          <Text style={styles.warn}>⚠ Firebase not connected. Add your config so commuters can see you.</Text>
        </NeoCard>
      )}

      <NeoCard style={styles.card}>
        <Text style={styles.cardTitle}>My Jeep</Text>
        <Text style={styles.fieldLabel}>Plate / Body number</Text>
        <TextInput style={styles.input} value={plate} onChangeText={setPlate} placeholder="e.g. NVK-402" autoCapitalize="characters" />
        <Text style={styles.fieldLabel}>Driver name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Mang Ben" />
      </NeoCard>

      <NeoCard style={styles.card}>
        <Text style={styles.cardTitle}>My Status</Text>
        <View style={styles.statusCol}>
          {STATUS_BUTTONS.map((b) => (
            <NeoButton key={b.status} label={b.label} color={status === b.status ? b.color : PALETTE.cardBg} onPress={() => setDriverStatus(b.status)} offset={4} />
          ))}
        </View>
      </NeoCard>

      <NeoCard tag="★ DEMAND NEAR YOU" tagColor={PALETTE.coral} style={styles.card}>
        <Text style={styles.cardTitle}>Riders waiting within 800m</Text>
        <View style={styles.nextBox}>
          <Text style={styles.nextCount}>{nearbyWaiting}</Text>
          <Text style={styles.nextLabel}>WAITING PINGS (last 10 min)</Text>
        </View>
      </NeoCard>

      <NeoCard style={styles.card}>
        <Text style={styles.cardTitle}>Passenger Headcount</Text>
        <View style={styles.stepRow}>
          <NeoButton label="–" color={PALETTE.coral} textColor="#FFFFFF" onPress={() => adjustCapacity(-1)} offset={4} style={styles.stepBtn} />
          <View style={styles.countBox}>
            <Text style={styles.countNum}>{capacity}</Text>
            <Text style={styles.countMax}>/ {maxCapacity}</Text>
          </View>
          <NeoButton label="+" color={PALETTE.mint} onPress={() => adjustCapacity(1)} offset={4} style={styles.stepBtn} />
        </View>
        <View style={styles.pillRow}>
          <StatusMeterPill level={levelFromRatio(ratio)} />
          <Ionicons name={levelFromRatio(ratio) === 'sabit' ? 'warning' : 'checkmark-circle'} size={22} color={levelFromRatio(ratio) === 'sabit' ? PALETTE.coral : PALETTE.mint} />
        </View>
        <Text style={styles.hint}>Commuters see your live position and this seat count instantly.</Text>
      </NeoCard>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: PALETTE.bg },
  scroll: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: PALETTE.bg },
  msgTitle: { fontSize: 18, fontWeight: FONT.black, color: PALETTE.text },
  msg: { fontSize: 14, fontWeight: FONT.semibold, color: PALETTE.textMuted, textAlign: 'center' },
  mapWrap: { height: 220, borderRadius: 16, borderWidth: 2.5, borderColor: PALETTE.border, overflow: 'hidden' },
  map: { flex: 1 },
  liveTag: { position: 'absolute', top: 10, left: 10, borderWidth: 2, borderColor: PALETTE.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  liveText: { fontSize: 12, fontWeight: FONT.black, color: PALETTE.border },
  card: { backgroundColor: PALETTE.cardBg },
  warn: { fontSize: 13, fontWeight: FONT.black, color: PALETTE.border, textAlign: 'center' },
  cardTitle: { fontSize: 16, fontWeight: FONT.black, color: PALETTE.text, marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: FONT.bold, color: PALETTE.textMuted, marginBottom: 4 },
  input: { borderWidth: 2, borderColor: PALETTE.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, fontWeight: FONT.bold, color: PALETTE.text, marginBottom: 12, backgroundColor: PALETTE.bg },
  statusCol: { gap: 12 },
  nextBox: { alignItems: 'center', paddingVertical: 6 },
  nextCount: { fontSize: 60, fontWeight: FONT.black, color: PALETTE.coral, lineHeight: 62 },
  nextLabel: { fontSize: 11, fontWeight: FONT.bold, color: PALETTE.textMuted, letterSpacing: 0.5 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: { width: 90 },
  countBox: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  countNum: { fontSize: 52, fontWeight: FONT.black, color: PALETTE.text },
  countMax: { fontSize: 18, fontWeight: FONT.bold, color: PALETTE.textMuted },
  pillRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  hint: { fontSize: 12, fontWeight: FONT.semibold, color: PALETTE.textMuted, marginTop: 10 },
});

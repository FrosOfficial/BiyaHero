import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp, distanceMeters } from '../context/AppContext';
import { useLocation } from '../hooks/useLocation';
import { subscribeJeeps, dropPing, LiveJeep } from '../services/live';
import { PALETTE, FONT } from '../theme/theme';
import NeoButton from '../components/NeoButton';
import StatusMeterPill, { levelFromRatio } from '../components/StatusMeterPill';
import LeafletMap, { MapMarker } from '../components/LeafletMap';

const FRESH_MS = 25000;
const capColor = (ratio: number) => {
  const l = levelFromRatio(ratio);
  return l === 'sabit' ? PALETTE.coral : l === 'squeezed' ? PALETTE.yellow : PALETTE.mint;
};

export default function CommuterScreen() {
  const { isConfigured, setBase } = useApp();
  const { coords, perm } = useLocation();
  const [jeeps, setJeeps] = useState<LiveJeep[]>([]);

  useEffect(() => {
    if (coords) setBase(coords);
  }, [coords, setBase]);

  useEffect(() => {
    const unsub = subscribeJeeps(setJeeps);
    return unsub;
  }, []);

  // live jeeps that are driving and recently updated
  const liveJeeps = useMemo(
    () => jeeps.filter((j) => j.status === 'driving' && Date.now() - j.updatedAt < FRESH_MS),
    [jeeps]
  );

  const featured = useMemo(() => {
    if (!coords || liveJeeps.length === 0) return undefined;
    return [...liveJeeps].sort(
      (a, b) => distanceMeters(coords, a) - distanceMeters(coords, b)
    )[0];
  }, [liveJeeps, coords]);

  if (perm === 'denied') {
    return (
      <View style={styles.center}>
        <Ionicons name="location-outline" size={48} color={PALETTE.coral} />
        <Text style={styles.msgTitle}>Location is off</Text>
        <Text style={styles.msg}>BiyaHero needs your location. Enable it in phone settings, then reopen.</Text>
      </View>
    );
  }
  if (!coords) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PALETTE.blue} />
        <Text style={styles.msg}>Finding your location…</Text>
      </View>
    );
  }

  const eta = (j: LiveJeep) => Math.max(1, Math.round(distanceMeters(coords, j) / 250));
  const ratio = featured ? featured.capacityCount / featured.maxCapacity : 0;
  const seatsLeft = featured ? featured.maxCapacity - featured.capacityCount : 0;

  const markers: MapMarker[] = liveJeeps.map((j) => ({
    id: j.id,
    latitude: j.latitude,
    longitude: j.longitude,
    color: capColor(j.capacityCount / j.maxCapacity),
    label: `${j.plateNumber} · ${eta(j)} min · ${j.capacityCount}/${j.maxCapacity}`,
  }));

  return (
    <View style={styles.flex}>
      <LeafletMap style={styles.map} center={coords} user={coords} markers={markers} />

      {!isConfigured && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>⚠ Firebase not connected. Add your config to go live.</Text>
        </View>
      )}

      <View style={styles.sheet}>
        {featured ? (
          <>
            <View style={styles.sheetTop}>
              <View>
                <Text style={styles.plate}>{featured.plateNumber}</Text>
                <Text style={styles.driver}>{featured.driverName} · nearest live jeep</Text>
              </View>
              <View style={styles.etaBox}>
                <Text style={styles.etaNum}>{eta(featured)}</Text>
                <Text style={styles.etaLabel}>min away</Text>
              </View>
            </View>
            <View style={styles.gaugeTrack}>
              <View style={[styles.gaugeFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: capColor(ratio) }]} />
            </View>
            <View style={styles.statsRow}>
              <StatusMeterPill level={levelFromRatio(ratio)} />
              <Text style={styles.seatText}>{seatsLeft > 0 ? `${seatsLeft} seats left` : 'SABIT'} · {featured.capacityCount}/{featured.maxCapacity}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.msg}>
            {isConfigured ? 'No live jeeps yet. Ask a driver to open Driver mode and go online.' : 'Connect Firebase, then a driver can go live.'}
          </Text>
        )}

        <View style={styles.actions}>
          <NeoButton
            label="Waiting Ping"
            color={PALETTE.mint}
            small
            icon={<Ionicons name="add-circle" size={16} color={PALETTE.border} />}
            onPress={() => dropPing(coords.latitude, coords.longitude)}
            style={styles.flexBtn}
          />
          <NeoButton
            label="Para Po!"
            color={PALETTE.coral}
            textColor="#FFFFFF"
            small
            icon={<Ionicons name="hand-left" size={16} color="#FFFFFF" />}
            onPress={() => dropPing(coords.latitude, coords.longitude)}
            style={styles.flexBtn}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: PALETTE.bg },
  map: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: PALETTE.bg },
  msgTitle: { fontSize: 18, fontWeight: FONT.black, color: PALETTE.text },
  msg: { fontSize: 14, fontWeight: FONT.semibold, color: PALETTE.textMuted, textAlign: 'center' },
  jeepPin: { width: 30, height: 30, borderRadius: 8, borderWidth: 2.5, borderColor: PALETTE.border, alignItems: 'center', justifyContent: 'center' },
  banner: { backgroundColor: PALETTE.yellow, borderTopWidth: 2, borderColor: PALETTE.border, paddingVertical: 6, paddingHorizontal: 12 },
  bannerText: { fontSize: 12, fontWeight: FONT.black, color: PALETTE.border, textAlign: 'center' },
  sheet: { backgroundColor: PALETTE.cardBg, borderTopWidth: 3, borderTopColor: PALETTE.border, padding: 16, paddingBottom: 24, gap: 12 },
  sheetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  plate: { fontSize: 20, fontWeight: FONT.black, color: PALETTE.text },
  driver: { fontSize: 12, fontWeight: FONT.semibold, color: PALETTE.textMuted },
  etaBox: { alignItems: 'center' },
  etaNum: { fontSize: 30, fontWeight: FONT.black, color: PALETTE.blue, lineHeight: 32 },
  etaLabel: { fontSize: 10, fontWeight: FONT.bold, color: PALETTE.textMuted },
  gaugeTrack: { height: 20, borderRadius: 999, borderWidth: 2.5, borderColor: PALETTE.border, backgroundColor: PALETTE.bg, overflow: 'hidden' },
  gaugeFill: { height: '100%' },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seatText: { fontSize: 13, fontWeight: FONT.black, color: PALETTE.text },
  actions: { flexDirection: 'row', gap: 10 },
  flexBtn: { flex: 1 },
});

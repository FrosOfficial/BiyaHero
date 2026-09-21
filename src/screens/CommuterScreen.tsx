import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp, distanceMeters } from '../context/AppContext';
import { useLocation } from '../hooks/useLocation';
import { subscribeJeeps, subscribeWaiting, dropWaiting, LiveJeep, WaitingPing } from '../services/live';
import { PALETTE, FONT } from '../theme/theme';
import NeoButton from '../components/NeoButton';
import StatusMeterPill, { levelFromRatio } from '../components/StatusMeterPill';
import LeafletMap, { MapMarker, WaitingMarker } from '../components/LeafletMap';

const FRESH_MS = 25000;
const COOLDOWN = 60; // seconds between waiting pings
const capColor = (ratio: number) => {
  const l = levelFromRatio(ratio);
  return l === 'sabit' ? PALETTE.coral : l === 'squeezed' ? PALETTE.yellow : PALETTE.mint;
};

export default function CommuterScreen() {
  const { isConfigured, setBase, t } = useApp();
  const { coords, perm } = useLocation();
  const [jeeps, setJeeps] = useState<LiveJeep[]>([]);
  const [waiting, setWaiting] = useState<WaitingPing[]>([]);
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (coords) setBase(coords);
  }, [coords, setBase]);

  useEffect(() => subscribeJeeps(setJeeps), []);
  useEffect(() => subscribeWaiting(setWaiting), []);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const liveJeeps = useMemo(
    () => jeeps.filter((j) => j.status === 'driving' && Date.now() - j.updatedAt < FRESH_MS),
    [jeeps]
  );

  const featured = useMemo(() => {
    if (!coords || liveJeeps.length === 0) return undefined;
    return [...liveJeeps].sort((a, b) => distanceMeters(coords, a) - distanceMeters(coords, b))[0];
  }, [liveJeeps, coords]);

  if (perm === 'denied') {
    return (
      <View style={styles.center}>
        <Ionicons name="location-outline" size={48} color={PALETTE.coral} />
        <Text style={styles.msgTitle}>{t('locationOff')}</Text>
        <Text style={styles.msg}>{t('locationNeed')}</Text>
      </View>
    );
  }
  if (!coords) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PALETTE.blue} />
        <Text style={styles.msg}>{t('findingLocation')}</Text>
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

  const waitMarkers: WaitingMarker[] = waiting.map((w) => ({ id: w.id, latitude: w.latitude, longitude: w.longitude }));

  const sendPing = () => {
    dropWaiting(coords.latitude, coords.longitude);
    setCooldown(COOLDOWN);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1 && timer.current) clearInterval(timer.current);
        return c - 1;
      });
    }, 1000);
    Alert.alert(t('pingSentTitle'), t('pingSentBody'));
  };

  return (
    <View style={styles.flex}>
      <LeafletMap style={styles.map} center={coords} user={coords} markers={markers} waiting={waitMarkers} />

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
                <Text style={styles.driver}>{featured.driverName} · {t('nearestJeep')}</Text>
              </View>
              <View style={styles.etaBox}>
                <Text style={styles.etaNum}>{eta(featured)}</Text>
                <Text style={styles.etaLabel}>{t('minAway')}</Text>
              </View>
            </View>
            <View style={styles.gaugeTrack}>
              <View style={[styles.gaugeFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: capColor(ratio) }]} />
            </View>
            <View style={styles.statsRow}>
              <StatusMeterPill level={levelFromRatio(ratio)} label={t(levelFromRatio(ratio))} />
              <Text style={styles.seatText}>{seatsLeft > 0 ? `${seatsLeft} ${t('seatsLeft')}` : t('sabit')} · {featured.capacityCount}/{featured.maxCapacity}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.msg}>{t('noJeeps')}</Text>
        )}

        <NeoButton
          label={cooldown > 0 ? `${t('waitingPing')} (${cooldown}s)` : t('waitingPing')}
          color={cooldown > 0 ? '#D4D4D8' : PALETTE.mint}
          icon={<Ionicons name="hand-left" size={18} color={PALETTE.border} />}
          onPress={() => cooldown === 0 && sendPing()}
        />
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
});

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useLocation } from '../hooks/useLocation';
import { subscribeSightings, Sighting } from '../services/live';
import { clusterSightings, CrowdJeep } from '../logic/crowd';
import { stopsFor, lineFor } from '../data/route';
import { etaMinutes, progressOnRoute, nearestStopIndex, summarizeTrip, TripSummary } from '../logic/routeMath';
import { recordTrip, MonthTotals } from '../services/trips';
import { PALETTE, FONT } from '../theme/theme';
import NeoButton from '../components/NeoButton';
import NeoCard from '../components/NeoCard';
import RoutePicker from '../components/RoutePicker';
import LeafletMap, { MapMarker, StopMarker } from '../components/LeafletMap';
import RideScreen from './RideScreen';
import TripSummaryScreen from './TripSummaryScreen';
import TripHistoryScreen from './TripHistoryScreen';

const MAX_PINS = 5; // only the next few jeeps coming your way are drawn, so the map stays readable

type Mode = 'map' | 'pick' | 'ride' | 'summary' | 'history';

export default function CommuterScreen() {
  const { isConfigured, setBase, t, riderDirection: dir, setRiderDirection, discounted, setDiscounted } = useApp();
  const { coords, accuracy, perm } = useLocation();
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [now, setNow] = useState(Date.now());

  // ride-mode state
  const [mode, setMode] = useState<Mode>('map');
  const [boardIndex, setBoardIndex] = useState(0);
  const [destIndex, setDestIndex] = useState(0);
  const rideStart = useRef(0);
  const [trip, setTrip] = useState<TripSummary | null>(null);
  const [month, setMonth] = useState<MonthTotals | null>(null);
  const [historyBack, setHistoryBack] = useState<Mode>('map'); // where "back" goes from Trip History
  useEffect(() => {
    if (coords) setBase(coords);
  }, [coords, setBase]);

  useEffect(() => subscribeSightings(setSightings), []);
  // re-check freshness every 5 s so jeeps whose riders went offline disappear
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(i);
  }, []);

  const stops = useMemo(() => stopsFor(dir), [dir]);
  const line = useMemo(() => lineFor(dir), [dir]);
  // the stop you're at (nearest stop on the line to your GPS)
  const hereIndex = useMemo(
    () => (coords ? nearestStopIndex(progressOnRoute(coords, dir).along, dir) : 0),
    [coords, dir]
  );

  // Rider-powered pins: everyone on a ride alert reports where they are, and
  // riders on the same jeep are grouped into ONE pin (see logic/crowd.ts).
  const unified = useMemo<CrowdJeep[]>(() => clusterSightings(sightings, now), [sightings, now]);

  // jeeps heading YOUR way that have not passed you yet, with ETA along the route
  const approaching = useMemo(() => {
    if (!coords) return [];
    return unified
      .map((j) => ({ j, eta: etaMinutes(j, coords, dir) }))
      .filter((x): x is { j: CrowdJeep; eta: number } => x.eta !== null)
      .sort((a, b) => a.eta - b.eta);
  }, [unified, coords, dir]);
  const featured = approaching[0];

  // Only the next few jeeps coming toward you are drawn. Jeeps going the other
  // way, or that already passed you, are hidden so the map never fills up.
  const markers: MapMarker[] = useMemo(
    () =>
      approaching.slice(0, MAX_PINS).map(({ j, eta }) => ({
        id: j.id,
        latitude: j.latitude,
        longitude: j.longitude,
        color: PALETTE.blue,
        label: `${j.riders} ${j.riders === 1 ? t('riderWord') : t('ridersWord')} · ${eta} min`,
      })),
    [approaching, t]
  );
  const stopMarkers: StopMarker[] = useMemo(
    () =>
      stops.map((s, i) => ({
        id: s.id,
        latitude: s.latitude,
        longitude: s.longitude,
        name: s.short,
        kind: i === hereIndex ? 'next' : 'stop', // highlight the stop you're at
      })),
    [stops, hereIndex]
  );

  const onArrive = useCallback(() => {
    if (!coords) return;
    const endedAt = Date.now();
    const minutes = (endedAt - rideStart.current) / 60000;
    const summary = summarizeTrip(dir, boardIndex, destIndex, minutes, discounted);
    setTrip(summary);
    setMode('summary');
    recordTrip(summary, { startedAt: rideStart.current, endedAt, direction: dir, discounted }).then(setMonth);
  }, [coords, dir, boardIndex, destIndex, discounted]);

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

  // ---------- ride mode ----------
  if (mode === 'ride') {
    return (
      <RideScreen
        coords={coords}
        accuracy={accuracy}
        direction={dir}
        boardIndex={boardIndex}
        destIndex={destIndex}
        markers={markers}
        onArrive={onArrive}
        onCancel={() => setMode('map')}
      />
    );
  }
  if (mode === 'summary' && trip) {
    return (
      <TripSummaryScreen
        trip={trip}
        month={month}
        discounted={discounted}
        onDone={() => setMode('map')}
        onHistory={() => {
          setHistoryBack('summary');
          setMode('history');
        }}
      />
    );
  }
  if (mode === 'history') {
    return <TripHistoryScreen onBack={() => setMode(historyBack === 'summary' && trip ? 'summary' : 'map')} />;
  }

  // ---------- pick your stop ----------
  if (mode === 'pick') {
    const choices = stops.map((s, i) => ({ s, i })).filter(({ i }) => i > hereIndex);
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.pickScroll}>
        <Text style={styles.pickTitle}>{t('whereOff')}</Text>
        <Text style={styles.msgLeft}>{t('pickStopHint')}</Text>
        <RoutePicker value={dir} onChange={setRiderDirection} />
        <Text style={styles.fromHere}>
          <Ionicons name="location" size={14} color={PALETTE.blue} /> {stops[hereIndex].name}
        </Text>
        {choices.map(({ s, i }) => (
          <Pressable
            key={s.id}
            style={styles.stopRow}
            onPress={() => {
              setBoardIndex(hereIndex);
              setDestIndex(i);
              rideStart.current = Date.now();
              setMode('ride');
            }}
          >
            <Text style={styles.stopName}>{s.name}</Text>
            <Text style={styles.stopMeta}>{i - hereIndex} {i - hereIndex === 1 ? t('stopLeft') : t('stopsLeft')}</Text>
            <Ionicons name="chevron-forward" size={20} color={PALETTE.text} />
          </Pressable>
        ))}
        <NeoCard style={styles.discount}>
          <Text style={styles.discountText}>{t('discountLabel')}</Text>
          <Switch
            value={discounted}
            onValueChange={setDiscounted}
            trackColor={{ true: PALETTE.mint, false: '#D4D4D8' }}
            thumbColor={PALETTE.cardBg}
          />
        </NeoCard>
        <NeoButton label={t('cancel')} color={PALETTE.cardBg} small onPress={() => setMode('map')} />
      </ScrollView>
    );
  }

  // ---------- main map ----------
  const j = featured?.j;
  const moreComing = Math.max(0, approaching.length - 1);

  return (
    <View style={styles.flex}>
      <LeafletMap style={styles.map} center={coords} user={coords} markers={markers} stops={stopMarkers} line={line} />

      {!isConfigured && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>⚠ Firebase not connected. Add your config to go live.</Text>
        </View>
      )}

      <View style={styles.sheet}>
        <RoutePicker value={dir} onChange={setRiderDirection} />
        {j && featured ? (
          <>
            <View style={styles.sheetTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.plate}>{t('jeepComing')}</Text>
                <Text style={styles.driver}>
                  {`${t('toYourStop')} ${stops[hereIndex].short}`}
                  {moreComing > 0 ? ` · +${moreComing} ${t('moreBehind')}` : ''}
                </Text>
              </View>
              <View style={styles.etaBox}>
                <Text style={styles.etaNum}>{featured.eta}</Text>
                <Text style={styles.etaLabel}>{t('minAway')}</Text>
              </View>
            </View>
            <View style={styles.crowdRow}>
              <Ionicons name="people" size={16} color={PALETTE.blue} />
              <Text style={styles.crowdText}>
                {j.riders} {j.riders === 1 ? t('riderWord') : t('ridersWord')} {t('withAppAboard')}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.msg}>{t('noJeepsYet')}</Text>
        )}

        <NeoButton
          label={t('rideAlert')}
          color={PALETTE.yellow}
          icon={<Ionicons name="notifications" size={18} color={PALETTE.text} />}
          onPress={() => setMode('pick')}
        />
        <Pressable
          style={styles.historyLink}
          hitSlop={8}
          onPress={() => {
            setHistoryBack('map');
            setMode('history');
          }}
        >
          <Ionicons name="time-outline" size={16} color={PALETTE.textMuted} />
          <Text style={styles.historyText}>{t('tripHistory')}</Text>
        </Pressable>
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
  msgLeft: { fontSize: 14, fontWeight: FONT.semibold, color: PALETTE.textMuted },
  banner: { backgroundColor: PALETTE.yellow, borderTopWidth: 1, borderColor: PALETTE.border, paddingVertical: 6, paddingHorizontal: 12 },
  bannerText: { fontSize: 12, fontWeight: FONT.black, color: PALETTE.text, textAlign: 'center' },
  sheet: { backgroundColor: PALETTE.cardBg, borderTopWidth: 1, borderTopColor: PALETTE.border, padding: 16, paddingBottom: 24, gap: 12 },
  sheetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  plate: { fontSize: 20, fontWeight: FONT.black, color: PALETTE.text },
  driver: { fontSize: 12, fontWeight: FONT.semibold, color: PALETTE.textMuted },
  etaBox: { alignItems: 'center' },
  etaNum: { fontSize: 30, fontWeight: FONT.black, color: PALETTE.blue, lineHeight: 32 },
  etaLabel: { fontSize: 10, fontWeight: FONT.bold, color: PALETTE.textMuted },
  crowdRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  crowdText: { fontSize: 12, fontWeight: FONT.semibold, color: PALETTE.textMuted, flex: 1 },
  historyLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: -2 },
  historyText: { fontSize: 13, fontWeight: FONT.bold, color: PALETTE.textMuted },
  // pick screen
  pickScroll: { padding: 20, gap: 12 },
  pickTitle: { fontSize: 26, fontWeight: FONT.black, color: PALETTE.text },
  fromHere: { fontSize: 13, fontWeight: FONT.bold, color: PALETTE.blue, marginTop: 4 },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: PALETTE.cardBg,
  },
  stopName: { flex: 1, fontSize: 16, fontWeight: FONT.black, color: PALETTE.text },
  stopMeta: { fontSize: 12, fontWeight: FONT.bold, color: PALETTE.textMuted },
  discount: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: PALETTE.cardBg },
  discountText: { flex: 1, fontSize: 13, fontWeight: FONT.bold, color: PALETTE.text },
});

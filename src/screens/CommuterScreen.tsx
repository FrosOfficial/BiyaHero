import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, Pressable, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp, distanceMeters } from '../context/AppContext';
import { useLocation } from '../hooks/useLocation';
import { subscribeJeeps, subscribeWaiting, dropWaiting, reportDropoff, waitingByStop, subscribeSightings, LiveJeep, WaitingPing, Sighting } from '../services/live';
import { clusterSightings, dropOverlaps } from '../logic/crowd';
import { stopsFor, lineFor, RouteStop } from '../data/route';
import { etaMinutes, progressOnRoute, nearestStopIndex, summarizeTrip, TripSummary } from '../logic/routeMath';
import { recordTrip, MonthTotals } from '../services/trips';
import { PALETTE, FONT } from '../theme/theme';
import NeoButton from '../components/NeoButton';
import NeoCard from '../components/NeoCard';
import DirectionToggle from '../components/DirectionToggle';
import StatusMeterPill, { levelFromRatio } from '../components/StatusMeterPill';
import LeafletMap, { MapMarker, StopMarker } from '../components/LeafletMap';
import RideScreen from './RideScreen';
import TripSummaryScreen from './TripSummaryScreen';

const FRESH_MS = 25000;
const COOLDOWN = 60; // seconds between waiting pings
const capColor = (ratio: number) => {
  const l = levelFromRatio(ratio);
  return l === 'sabit' ? PALETTE.coral : l === 'squeezed' ? PALETTE.yellow : PALETTE.mint;
};

type Mode = 'map' | 'pick' | 'wait' | 'ride' | 'summary';

// a jeep on the map: either a real driver broadcast, or a crowd of riders
type UJeep = {
  id: string;
  latitude: number;
  longitude: number;
  direction?: 'toPRC' | 'toMantrade';
  source: 'driver' | 'crowd';
  plateNumber?: string;
  driverName?: string;
  capacityCount?: number;
  maxCapacity?: number;
  riders?: number;
};

export default function CommuterScreen() {
  const { isConfigured, setBase, t, riderDirection: dir, setRiderDirection, discounted, setDiscounted } = useApp();
  const { coords, accuracy, perm } = useLocation();
  const [jeeps, setJeeps] = useState<LiveJeep[]>([]);
  const [waiting, setWaiting] = useState<WaitingPing[]>([]);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [cooldown, setCooldown] = useState(0);
  const [now, setNow] = useState(Date.now());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ride-mode state
  const [mode, setMode] = useState<Mode>('map');
  const [boardIndex, setBoardIndex] = useState(0);
  const [destIndex, setDestIndex] = useState(0);
  const rideStart = useRef(0);
  const [trip, setTrip] = useState<TripSummary | null>(null);
  const [month, setMonth] = useState<MonthTotals | null>(null);
  // the stop you said you're waiting at (used instead of jumpy GPS for ETA)
  const [waitStop, setWaitStop] = useState<RouteStop | null>(null);

  useEffect(() => {
    if (coords) setBase(coords);
  }, [coords, setBase]);

  useEffect(() => subscribeJeeps(setJeeps), []);
  useEffect(() => subscribeWaiting(setWaiting), []);
  useEffect(() => subscribeSightings(setSightings), []);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  // re-check freshness every 5 s so jeeps that went offline disappear
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(i);
  }, []);

  const stops = useMemo(() => stopsFor(dir), [dir]);
  const line = useMemo(() => lineFor(dir), [dir]);
  // forget the chosen stop if you switch direction or it has been 15 min
  useEffect(() => { setWaitStop(null); }, [dir]);
  useEffect(() => {
    if (!waitStop) return;
    const timer = setTimeout(() => setWaitStop(null), 15 * 60 * 1000); // pings expire after 15 min
    return () => clearTimeout(timer);
  }, [waitStop]);
  const waitCounts = useMemo(() => waitingByStop(waiting, dir), [waiting, dir]);
  const riderSpot = waitStop ?? coords; // ETA is measured from your stop when you picked one

  const liveJeeps = useMemo(
    () => jeeps.filter((j) => j.status === 'driving' && now - j.updatedAt < FRESH_MS),
    [jeeps, now]
  );

  // Rider-powered pins: cluster on-board riders into jeeps, minus any that sit
  // on top of a real driver jeep (the driver's exact data wins).
  const unified = useMemo<UJeep[]>(() => {
    const crowd = dropOverlaps(clusterSightings(sightings), liveJeeps);
    return [
      ...liveJeeps.map((j): UJeep => ({
        id: j.id, latitude: j.latitude, longitude: j.longitude, direction: j.direction,
        source: 'driver', plateNumber: j.plateNumber, driverName: j.driverName,
        capacityCount: j.capacityCount, maxCapacity: j.maxCapacity,
      })),
      ...crowd.map((c): UJeep => ({
        id: c.id, latitude: c.latitude, longitude: c.longitude, direction: c.direction,
        source: 'crowd', riders: c.riders,
      })),
    ];
  }, [liveJeeps, sightings]);

  // jeeps heading YOUR way that have not passed you yet, with ETA along the route
  const approaching = useMemo(() => {
    if (!riderSpot) return [];
    return unified
      .map((j) => ({ j, eta: etaMinutes(j, riderSpot, dir) }))
      .filter((x): x is { j: UJeep; eta: number } => x.eta !== null)
      .sort((a, b) => a.eta - b.eta);
  }, [unified, riderSpot, dir]);
  const featured = approaching[0];

  const markers: MapMarker[] = useMemo(
    () =>
      unified.map((j) => {
        const a = approaching.find((x) => x.j.id === j.id);
        const isDriver = j.source === 'driver';
        const ratio = isDriver ? (j.capacityCount! / j.maxCapacity!) : 0;
        return {
          id: j.id,
          latitude: j.latitude,
          longitude: j.longitude,
          color: a ? (isDriver ? capColor(ratio) : PALETTE.blue) : '#D4D4D8',
          label: a
            ? (isDriver
                ? `${j.plateNumber} · ${a.eta} min · ${j.capacityCount}/${j.maxCapacity}`
                : `~${j.riders} aboard · ${a.eta} min`)
            : (isDriver ? `${j.plateNumber}` : t('riderTracked')),
        };
      }),
    [unified, approaching, t]
  );
  const stopMarkers: StopMarker[] = useMemo(
    () =>
      stops.map((s) => ({
        id: s.id,
        latitude: s.latitude,
        longitude: s.longitude,
        name: s.short,
        kind: waitStop?.id === s.id ? 'next' : 'stop',
        waiting: waitCounts[s.id] ?? 0,
      })),
    [stops, waitCounts, waitStop]
  );

  const onArrive = useCallback(() => {
    if (!coords) return;
    const minutes = (Date.now() - rideStart.current) / 60000;
    const summary = summarizeTrip(dir, boardIndex, destIndex, minutes, discounted);
    // free a seat on the jeep you were riding (nearest live jeep going your way)
    const onJeep = liveJeeps
      .filter((j) => !j.direction || j.direction === dir)
      .map((j) => ({ j, d: distanceMeters(coords, j) }))
      .sort((a, b) => a.d - b.d)[0];
    if (onJeep && onJeep.d < 120) reportDropoff(onJeep.j.id);
    setTrip(summary);
    setMode('summary');
    recordTrip(summary).then(setMonth);
  }, [coords, dir, boardIndex, destIndex, discounted, liveJeeps]);

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
        destIndex={destIndex}
        markers={markers}
        onArrive={onArrive}
        onCancel={() => setMode('map')}
      />
    );
  }
  if (mode === 'summary' && trip) {
    return <TripSummaryScreen trip={trip} month={month} discounted={discounted} onDone={() => setMode('map')} />;
  }

  // where you are on the route: the stop you picked, or the stop nearest your GPS
  const pickedIndex = waitStop ? stops.findIndex((s) => s.id === waitStop.id) : -1;
  const hereIndex = pickedIndex >= 0 ? pickedIndex : nearestStopIndex(progressOnRoute(coords, dir).along, dir);

  // ---------- which stop are you waiting at? ----------
  if (mode === 'wait') {
    // nearest stop first, then the rest in route order (last stop has no jeeps leaving)
    const options = stops.slice(0, -1).map((s, i) => ({ s, i }));
    options.sort((a, b) => (a.i === hereIndex ? -1 : b.i === hereIndex ? 1 : a.i - b.i));
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.pickScroll}>
        <Text style={styles.pickTitle}>{t('whichStop')}</Text>
        <Text style={styles.msgLeft}>{t('whichStopHint')}</Text>
        <DirectionToggle value={dir} onChange={setRiderDirection} />
        {options.map(({ s, i }) => (
          <Pressable
            key={s.id}
            style={[styles.stopRow, i === hereIndex && { backgroundColor: PALETTE.yellow }]}
            onPress={() => {
              dropWaiting(s, dir);
              setWaitStop(s);
              setMode('map');
              startCooldown();
              Alert.alert(t('pingSentTitle'), `${t('waitingAt')} ${s.name}. ${t('pingSentBody')}`);
            }}
          >
            <Text style={styles.stopName}>{s.name}</Text>
            {i === hereIndex ? <Text style={styles.nearTag}>{t('nearest')}</Text> : null}
            {waitCounts[s.id] ? <Text style={styles.stopMeta}>{waitCounts[s.id]} {t('waitingShort')}</Text> : null}
            <Ionicons name="hand-left" size={18} color={PALETTE.text} />
          </Pressable>
        ))}
        <NeoButton label={t('cancel')} color={PALETTE.cardBg} small onPress={() => setMode('map')} />
      </ScrollView>
    );
  }

  // ---------- pick your stop ----------
  if (mode === 'pick') {
    const choices = stops.map((s, i) => ({ s, i })).filter(({ i }) => i > hereIndex);
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.pickScroll}>
        <Text style={styles.pickTitle}>{t('whereOff')}</Text>
        <Text style={styles.msgLeft}>{t('pickStopHint')}</Text>
        <DirectionToggle value={dir} onChange={setRiderDirection} />
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
              setWaitStop(null); // you're on board now
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
  const isDriver = j?.source === 'driver';
  const ratio = isDriver ? j!.capacityCount! / j!.maxCapacity! : 0;
  const seatsLeft = isDriver ? j!.maxCapacity! - j!.capacityCount! : 0;

  function startCooldown() {
    setCooldown(COOLDOWN);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1 && timer.current) clearInterval(timer.current);
        return c - 1;
      });
    }, 1000);
  }

  return (
    <View style={styles.flex}>
      <LeafletMap style={styles.map} center={coords} user={coords} markers={markers} stops={stopMarkers} line={line} badgeSide={dir === 'toPRC' ? 'right' : 'left'} />

      {!isConfigured && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>⚠ Firebase not connected. Add your config to go live.</Text>
        </View>
      )}

      <View style={styles.sheet}>
        <DirectionToggle value={dir} onChange={setRiderDirection} />
        {j && featured ? (
          <>
            <View style={styles.sheetTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.plate}>{isDriver ? j.plateNumber : t('riderTracked')}</Text>
                <Text style={styles.driver}>
                  {isDriver ? j.driverName : `~${j.riders} ${t('aboardWord')}`} · {waitStop ? `${t('toYourStop')} ${waitStop.short}` : t('nearestJeep')}
                </Text>
              </View>
              <View style={styles.etaBox}>
                <Text style={styles.etaNum}>{featured.eta}</Text>
                <Text style={styles.etaLabel}>{t('minAway')}</Text>
              </View>
            </View>
            {isDriver ? (
              <>
                <View style={styles.gaugeTrack}>
                  <View style={[styles.gaugeFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: capColor(ratio) }]} />
                </View>
                <View style={styles.statsRow}>
                  <StatusMeterPill level={levelFromRatio(ratio)} label={t(levelFromRatio(ratio))} />
                  <Text style={styles.seatText}>{seatsLeft > 0 ? `${seatsLeft} ${t('seatsLeft')}` : t('sabit')} · {j.capacityCount}/{j.maxCapacity}</Text>
                </View>
              </>
            ) : (
              <View style={styles.crowdRow}>
                <Ionicons name="people" size={16} color={PALETTE.blue} />
                <Text style={styles.crowdText}>{t('riderTrackedHint')}</Text>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.msg}>{unified.length ? t('noJeepsDir') : t('noJeeps')}</Text>
        )}

        <View style={styles.btnRow}>
          <NeoButton
            style={styles.flexBtn}
            label={cooldown > 0 && waitStop ? `${waitStop.short} (${cooldown}s)` : t('waitingPing')}
            color={cooldown > 0 ? '#D4D4D8' : PALETTE.mint}
            icon={<Ionicons name="hand-left" size={18} color={PALETTE.text} />}
            onPress={() => cooldown === 0 && setMode('wait')}
          />
          <NeoButton
            style={styles.flexBtn}
            label={t('rideAlert')}
            color={PALETTE.yellow}
            icon={<Ionicons name="notifications" size={18} color={PALETTE.text} />}
            onPress={() => setMode('pick')}
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
  gaugeTrack: { height: 20, borderRadius: 999, borderWidth: 1, borderColor: PALETTE.border, backgroundColor: PALETTE.bg, overflow: 'hidden' },
  gaugeFill: { height: '100%' },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seatText: { fontSize: 13, fontWeight: FONT.black, color: PALETTE.text },
  crowdRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  crowdText: { fontSize: 12, fontWeight: FONT.semibold, color: PALETTE.textMuted, flex: 1 },
  btnRow: { flexDirection: 'row', gap: 10 },
  flexBtn: { flex: 1 },
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
  nearTag: {
    fontSize: 10,
    fontWeight: FONT.black,
    color: PALETTE.text,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: PALETTE.cardBg,
    overflow: 'hidden',
  },
  discount: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: PALETTE.cardBg },
  discountText: { flex: 1, fontSize: 13, fontWeight: FONT.bold, color: PALETTE.text },
});

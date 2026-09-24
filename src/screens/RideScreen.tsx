import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Vibration, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useKeepAwake } from 'expo-keep-awake';
import { useApp } from '../context/AppContext';
import { Coords } from '../hooks/useLocation';
import { Direction, stopsFor, lineFor, detectRouteVariant, SKIPPED_STOPS_GREEN } from '../data/route';
import { progressOnRoute, ridePhase, stopOffsets, nextStopIndex, nearestStopIndex, pointAlong } from '../logic/routeMath';
import { PALETTE, FONT } from '../theme/theme';
import NeoCard from '../components/NeoCard';
import NeoButton from '../components/NeoButton';
import StickerBadge from '../components/StickerBadge';
import LeafletMap, { StopMarker, MapMarker } from '../components/LeafletMap';
import { startRideAlert, stopRideAlert } from '../services/rideAlert';
import { buildSegments, fmtDuration, RideStats } from '../logic/rideLog';
import { publishSighting, removeSighting } from '../services/live';

interface Props {
  coords: Coords;
  accuracy: number | null; // GPS accuracy in meters (smaller = better)
  speedKph: number | null; // current speed from GPS
  startedAt: number; // when the ride started
  direction: Direction;
  boardIndex: number; // the stop you got on at (the strip starts here)
  destIndex: number;
  markers: MapMarker[];
  onArrive: (stats: RideStats) => void; // arrived or tapped "I got off"
  onCancel: () => void;
}

// Auto "I got off" only when GPS is trustworthy. A fix worse than this many
// meters can't tell "at my stop" from "one street over", so we wait for the tap.
const AUTO_ARRIVE_MAX_ACCURACY = 45;

export default function RideScreen({ coords, accuracy, speedKph, startedAt, direction, boardIndex, destIndex, markers, onArrive, onCancel }: Props) {
  const { t, lang, voiceMuted, setVoiceMuted, deviceId } = useApp();
  useKeepAwake(); // screen stays on so the alert can fire

  const variant = detectRouteVariant(coords.latitude, coords.longitude, direction);
  const stops = useMemo(() => stopsFor(direction), [direction]);
  const offsets = useMemo(() => stopOffsets(direction), [direction]);
  const line = useMemo(() => lineFor(direction, variant), [direction, variant]);
  const dest = stops[destIndex];

  // Background alert: keep watching for the stop even if the app is backgrounded
  // or the screen is off. Falls back to the on-screen alert if not permitted.
  useEffect(() => {
    startRideAlert(direction, destIndex, dest.short);
    return () => { stopRideAlert(); };
  }, [direction, destIndex, dest.short]);

  // Rider-powered tracking: while on board, publish an anonymous jeep sighting.
  // Your phone is already tracking you for the alert, so this is free.
  useEffect(() => {
    if (deviceId) publishSighting(deviceId, coords.latitude, coords.longitude, direction);
  }, [deviceId, coords.latitude, coords.longitude, direction]);
  useEffect(() => () => { if (deviceId) removeSighting(deviceId); }, [deviceId]);

  const prog = progressOnRoute(coords, direction);
  const phase = ridePhase(prog.along, direction, destIndex);
  const nearIdx = nearestStopIndex(prog.along, direction);
  const nextIdx = Math.min(nextStopIndex(prog.along, direction, 5, variant), destIndex);
  const stopsLeft = Math.max(0, destIndex - nextIdx + 1);
  const kmLeft = Math.max(0, (offsets[destIndex] - prog.along) / 1000);
  const offRoute = prog.offRoute > 250;

  // ---- the moment you pass each stop (for crossing out + stop-to-stop times) ----
  const passTimes = useRef<Record<number, number>>({});
  const [, setPassTick] = useState(0);
  useEffect(() => {
    if (offRoute) return;
    let changed = false;
    if (variant === 'green') {
      for (const skipped of SKIPPED_STOPS_GREEN) {
        if (passTimes.current[skipped] == null) {
          passTimes.current[skipped] = Date.now();
          changed = true;
        }
      }
    }
    for (let i = boardIndex + 1; i <= destIndex; i++) {
      // crossed out the moment you reach the stop's point on the line, not after
      if (passTimes.current[i] == null && offsets[i] <= prog.along) {
        passTimes.current[i] = Date.now();
        changed = true;
      }
    }
    if (changed) setPassTick((n) => n + 1);
  }, [prog.along, offRoute, boardIndex, destIndex, offsets, variant]);

  // ---- speed ----
  const kph = speedKph != null && speedKph < 100 ? speedKph : null; // ignore GPS spikes
  const maxKph = useRef(0);
  if (kph != null && kph > maxKph.current) maxKph.current = kph;

  // ---- train-style "Next stop, ..." announcements (while the app is on screen;
  //      the background task speaks when the app is in the background) ----
  const lastSaid = useRef(-1);
  useEffect(() => {
    if (offRoute || nextIdx <= boardIndex || lastSaid.current === nextIdx) return;
    const first = lastSaid.current === -1;
    lastSaid.current = nextIdx;
    if (first || voiceMuted || AppState.currentState !== 'active') return;
    const name = stops[nextIdx].name;
    const text = nextIdx === destIndex ? t('speakNextYours').replace('{stop}', name) : t('speakNext').replace('{stop}', name);
    Speech.stop();
    Speech.speak(text, { language: lang === 'fil' ? 'fil-PH' : 'en-US', rate: 0.95 });
  }, [nextIdx, offRoute, boardIndex, destIndex, voiceMuted, lang, t, stops]);

  // The map follows the rider's snapped spot on the line (a touch ahead so the
  // stop coming up stays in view). Snapping to the line keeps it from wiggling
  // with GPS noise, so it glides stop to stop on its own.
  const followPoint = useMemo(
    () => (offRoute ? coords : pointAlong(direction, prog.along + 90)),
    [offRoute, direction, prog.along, coords.latitude, coords.longitude]
  );

  // fire the "get ready" alert once
  const warned = useRef(false);
  useEffect(() => {
    if (offRoute || warned.current) return;
    if (phase === 'getReady' || phase === 'arrived') {
      warned.current = true;
      Vibration.vibrate([0, 600, 250, 600, 250, 900]);
      if (!voiceMuted) {
        Speech.stop();
        Speech.speak(t('speakGetReady').replace('{stop}', dest.short), {
          language: lang === 'fil' ? 'fil-PH' : 'en-US',
          rate: 0.95,
        });
      }
    }
  }, [phase, offRoute, dest.short, lang, t, voiceMuted]);

  // arrived: wrap up automatically (or when the rider taps "I got off")
  const done = useRef(false);
  const arriveRef = useRef(onArrive);
  arriveRef.current = onArrive;
  const finish = () => {
    if (done.current) return;
    done.current = true;
    const endedAt = Date.now();
    const segments = buildSegments(stops.map((x) => x.short), offsets, boardIndex, destIndex, passTimes.current, startedAt, endedAt);
    const secs = (endedAt - startedAt) / 1000;
    const meters = offsets[destIndex] - offsets[boardIndex];
    arriveRef.current({
      segments,
      avgKph: secs > 30 && meters > 0 ? (meters / secs) * 3.6 : null,
      maxKph: maxKph.current > 0 ? maxKph.current : null,
    });
  };
  // How far past the stop we are (negative = not there yet). A big overshoot
  // means we've clearly gone past it, so we finish even if GPS is rough.
  const pastDest = prog.along - offsets[destIndex];
  const gpsGoodEnough = accuracy == null || accuracy <= AUTO_ARRIVE_MAX_ACCURACY;

  useEffect(() => {
    if (phase !== 'arrived' || offRoute || done.current) return;
    // Fire when GPS is trustworthy, or once we've overshot the stop by 80 m+
    // (that overshoot can't be a small GPS wobble). Otherwise leave it to the tap.
    if (!gpsGoodEnough && pastDest < 80) return;
    const timer = setTimeout(finish, 1500); // brief hold so a 1-frame blip can't trigger it
    return () => clearTimeout(timer);
  }, [phase, offRoute, gpsGoodEnough, pastDest]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopMarkers: StopMarker[] = useMemo(
    () =>
      stops.map((s, i) => ({
        id: s.id,
        latitude: s.latitude,
        longitude: s.longitude,
        name: s.short,
        kind: i === destIndex ? 'dest' : i === nextIdx && nextIdx !== destIndex ? 'next' : 'stop',
      })),
    [stops, destIndex, nextIdx]
  );

  const ready = phase !== 'riding' && !offRoute;

  return (
    <View style={styles.flex}>
      <View style={styles.mapWrap}>
        <LeafletMap style={styles.flex} center={coords} user={coords} follow={followPoint} followZoom={16} markers={markers} stops={stopMarkers} line={line} />
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        {ready ? (
          <NeoCard style={[styles.card, { backgroundColor: PALETTE.coral }]} offset={6}>
            <Text style={styles.paraBig}>{t('getReady')}</Text>
            <Text style={styles.paraSub}>{t('getReadySub')}</Text>
          </NeoCard>
        ) : null}

        <NeoCard style={styles.card}>
          <StickerBadge label={t(direction)} color={PALETTE.yellow} style={{ marginBottom: 10 }} />
          <Text style={styles.label}>{t('gettingOffAt')}</Text>
          <Text style={styles.dest}>{dest.name}</Text>

          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{stopsLeft}</Text>
              <Text style={styles.statLabel}>{stopsLeft === 1 ? t('stopLeft') : t('stopsLeft')}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{kmLeft.toFixed(1)}</Text>
              <Text style={styles.statLabel}>{t('kmLeft')}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{kph != null ? Math.round(kph) : '–'}</Text>
              <Text style={styles.statLabel}>km/h</Text>
            </View>
          </View>

          {offRoute ? (
            <Text style={styles.warn}>{t('offRoute')}</Text>
          ) : variant === 'green' && SKIPPED_STOPS_GREEN.includes(destIndex) ? (
            <Text style={styles.warn}>{t('skippedDetourNotice')}</Text>
          ) : (
            <Text style={styles.now}>
              {t('nowNear')}: <Text style={styles.nowStrong}>{stops[nearIdx].short}</Text>
              {nextIdx !== destIndex ? (
                <>
                  {'  ·  '}
                  {t('nextStop')}: <Text style={styles.nowStrong}>{stops[nextIdx].short}</Text>
                </>
              ) : null}
            </Text>
          )}
          {accuracy != null ? (
            <View style={styles.gpsRow}>
              <Ionicons
                name={gpsGoodEnough ? 'navigate-circle' : 'warning'}
                size={14}
                color={gpsGoodEnough ? PALETTE.mint : PALETTE.coral}
              />
              <Text style={styles.gpsText}>
                {t('gpsAccuracy')} ±{Math.round(accuracy)} m
                {gpsGoodEnough ? '' : ` · ${t('gpsWeak')}`}
              </Text>
            </View>
          ) : null}
        </NeoCard>

        {/* stop strip: every stop from where you got on to your stop. Stops you've
            passed stay on the list, crossed out with a check, so you can see progress. */}
        <NeoCard style={styles.card}>
          {stops.slice(Math.min(boardIndex, destIndex), destIndex + 1).map((s, i, arr) => {
            const isDest = s.id === dest.id;
            const idx = stops.indexOf(s);
            const passed = !isDest && passTimes.current[idx] != null;
            // how long the leg INTO this stop took
            let legSec: number | null = null;
            if (passed && idx > boardIndex) {
              let prevT = startedAt;
              for (let k = idx - 1; k > boardIndex; k--) if (passTimes.current[k] != null) { prevT = passTimes.current[k]; break; }
              legSec = Math.max(1, Math.round((passTimes.current[idx] - prevT) / 1000));
            }
            return (
              <View key={s.id} style={styles.stripRow}>
                <View style={styles.stripRail}>
                  <View
                    style={[
                      styles.dot,
                      isDest && { backgroundColor: PALETTE.coral, borderColor: PALETTE.coral },
                      passed && { backgroundColor: PALETTE.mint, borderColor: PALETTE.mint },
                    ]}
                  >
                    {passed ? <Ionicons name="checkmark" size={10} color="#FFFFFF" /> : null}
                  </View>
                  {i < arr.length - 1 ? <View style={[styles.rail, passed && { backgroundColor: PALETTE.mint }]} /> : null}
                </View>
                <Text style={[styles.stripText, isDest && styles.stripDest, passed && styles.stripPassed]}>{s.name}</Text>
                {passed ? <Ionicons name="checkmark-circle" size={16} color={PALETTE.mint} /> : null}
                {legSec != null ? <Text style={styles.legTime}>{fmtDuration(legSec)}</Text> : null}
              </View>
            );
          })}
        </NeoCard>

        <NeoButton
          label={voiceMuted ? t('voiceOff') : t('voiceOn')}
          color={PALETTE.cardBg}
          small
          icon={<Ionicons name={voiceMuted ? 'volume-mute' : 'volume-high'} size={18} color={voiceMuted ? PALETTE.textMuted : PALETTE.mint} />}
          onPress={() => setVoiceMuted(!voiceMuted)}
        />
        <Text style={styles.hint}>{t('keepOpen')}</Text>

        <NeoButton
          label={t('iGotOff')}
          color={PALETTE.mint}
          icon={<Ionicons name="exit-outline" size={18} color={PALETTE.text} />}
          onPress={finish}
        />
        <NeoButton label={t('cancel')} color={PALETTE.cardBg} small onPress={onCancel} />
        <View style={{ height: 12 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: PALETTE.bg },
  mapWrap: { height: 320, borderBottomWidth: 1, borderColor: PALETTE.border },
  scroll: { padding: 12, gap: 9 },
  card: { backgroundColor: PALETTE.cardBg },
  paraBig: { fontSize: 28, fontWeight: FONT.black, color: '#FFFFFF', textAlign: 'center', letterSpacing: 1 },
  paraSub: { fontSize: 12.5, fontWeight: FONT.bold, color: '#FFFFFF', textAlign: 'center', marginTop: 2 },
  label: { fontSize: 11, fontWeight: FONT.bold, color: PALETTE.textMuted },
  dest: { fontSize: 20, fontWeight: FONT.black, color: PALETTE.text, marginBottom: 8 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 10,
    paddingVertical: 5,
    alignItems: 'center',
    backgroundColor: PALETTE.bg,
  },
  statNum: { fontSize: 22, fontWeight: FONT.black, color: PALETTE.blue },
  statLabel: { fontSize: 10, fontWeight: FONT.bold, color: PALETTE.textMuted },
  now: { fontSize: 12.5, fontWeight: FONT.semibold, color: PALETTE.textMuted },
  nowStrong: { fontWeight: FONT.black, color: PALETTE.text },
  warn: { fontSize: 12.5, fontWeight: FONT.bold, color: PALETTE.coral },
  stripRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  gpsText: { fontSize: 10.5, fontWeight: FONT.bold, color: PALETTE.textMuted },
  stripRail: { alignItems: 'center', width: 14 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: PALETTE.border, backgroundColor: PALETTE.cardBg, alignItems: 'center', justifyContent: 'center' },
  rail: { width: 3, height: 14, backgroundColor: PALETTE.blue },
  stripText: { fontSize: 12.5, fontWeight: FONT.bold, color: PALETTE.text, lineHeight: 15 },
  stripDest: { fontWeight: FONT.black, color: PALETTE.coral },
  stripPassed: { color: PALETTE.textMuted, textDecorationLine: 'line-through' },
  legTime: { marginLeft: 'auto', fontSize: 11.5, fontWeight: FONT.bold, color: PALETTE.textMuted },
  hint: { fontSize: 11, fontWeight: FONT.semibold, color: PALETTE.textMuted, textAlign: 'center' },
});

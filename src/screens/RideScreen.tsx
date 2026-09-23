import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useKeepAwake } from 'expo-keep-awake';
import { useApp } from '../context/AppContext';
import { Coords } from '../hooks/useLocation';
import { Direction, stopsFor, lineFor } from '../data/route';
import { progressOnRoute, ridePhase, stopOffsets, nextStopIndex, nearestStopIndex } from '../logic/routeMath';
import { PALETTE, FONT } from '../theme/theme';
import NeoCard from '../components/NeoCard';
import NeoButton from '../components/NeoButton';
import StickerBadge from '../components/StickerBadge';
import LeafletMap, { StopMarker, MapMarker } from '../components/LeafletMap';
import { startRideAlert, stopRideAlert } from '../services/rideAlert';
import { publishSighting, removeSighting } from '../services/live';

interface Props {
  coords: Coords;
  accuracy: number | null; // GPS accuracy in meters (smaller = better)
  direction: Direction;
  destIndex: number;
  markers: MapMarker[];
  onArrive: () => void; // arrived or tapped "I got off"
  onCancel: () => void;
}

// Auto "I got off" only when GPS is trustworthy. A fix worse than this many
// meters can't tell "at my stop" from "one street over", so we wait for the tap.
const AUTO_ARRIVE_MAX_ACCURACY = 45;

export default function RideScreen({ coords, accuracy, direction, destIndex, markers, onArrive, onCancel }: Props) {
  const { t, lang, voiceMuted, setVoiceMuted, driverId } = useApp();
  useKeepAwake(); // screen stays on so the alert can fire

  const stops = useMemo(() => stopsFor(direction), [direction]);
  const offsets = useMemo(() => stopOffsets(direction), [direction]);
  const line = useMemo(() => lineFor(direction), [direction]);
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
    if (driverId) publishSighting(driverId, coords.latitude, coords.longitude, direction);
  }, [driverId, coords.latitude, coords.longitude, direction]);
  useEffect(() => () => { if (driverId) removeSighting(driverId); }, [driverId]);

  const prog = progressOnRoute(coords, direction);
  const phase = ridePhase(prog.along, direction, destIndex);
  const nearIdx = nearestStopIndex(prog.along, direction);
  const nextIdx = Math.min(nextStopIndex(prog.along, direction), destIndex);
  const stopsLeft = Math.max(0, destIndex - nextIdx + 1);
  const kmLeft = Math.max(0, (offsets[destIndex] - prog.along) / 1000);
  const offRoute = prog.offRoute > 250;

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
    arriveRef.current();
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
        <LeafletMap style={styles.flex} center={coords} user={coords} markers={markers} stops={stopMarkers} line={line} badgeSide={direction === 'toPRC' ? 'right' : 'left'} />
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
          </View>

          {offRoute ? (
            <Text style={styles.warn}>{t('offRoute')}</Text>
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

        {/* stop strip: where you are on the line */}
        <NeoCard style={styles.card}>
          {stops.slice(Math.min(nearIdx, destIndex), destIndex + 1).map((s, i, arr) => {
            const isDest = s.id === dest.id;
            const passed = offsets[stops.indexOf(s)] < prog.along - 40;
            return (
              <View key={s.id} style={styles.stripRow}>
                <View style={styles.stripRail}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: isDest ? PALETTE.coral : passed ? PALETTE.textMuted : PALETTE.cardBg },
                    ]}
                  />
                  {i < arr.length - 1 ? <View style={styles.rail} /> : null}
                </View>
                <Text style={[styles.stripText, isDest && styles.stripDest, passed && styles.stripPassed]}>{s.name}</Text>
                {passed ? <Ionicons name="checkmark" size={16} color={PALETTE.mint} /> : null}
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
  mapWrap: { height: 230, borderBottomWidth: 1, borderColor: PALETTE.border },
  scroll: { padding: 16, gap: 14 },
  card: { backgroundColor: PALETTE.cardBg },
  paraBig: { fontSize: 40, fontWeight: FONT.black, color: '#FFFFFF', textAlign: 'center', letterSpacing: 1 },
  paraSub: { fontSize: 14, fontWeight: FONT.bold, color: '#FFFFFF', textAlign: 'center', marginTop: 4 },
  label: { fontSize: 12, fontWeight: FONT.bold, color: PALETTE.textMuted },
  dest: { fontSize: 26, fontWeight: FONT.black, color: PALETTE.text, marginBottom: 12 },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: PALETTE.bg,
  },
  statNum: { fontSize: 28, fontWeight: FONT.black, color: PALETTE.blue },
  statLabel: { fontSize: 11, fontWeight: FONT.bold, color: PALETTE.textMuted },
  now: { fontSize: 14, fontWeight: FONT.semibold, color: PALETTE.textMuted },
  nowStrong: { fontWeight: FONT.black, color: PALETTE.text },
  warn: { fontSize: 13, fontWeight: FONT.bold, color: PALETTE.coral },
  stripRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  gpsText: { fontSize: 11, fontWeight: FONT.bold, color: PALETTE.textMuted },
  stripRail: { alignItems: 'center', width: 16 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: PALETTE.border },
  rail: { width: 3, height: 18, backgroundColor: PALETTE.blue },
  stripText: { fontSize: 14, fontWeight: FONT.bold, color: PALETTE.text, lineHeight: 16 },
  stripDest: { fontWeight: FONT.black, color: PALETTE.coral },
  stripPassed: { color: PALETTE.textMuted, textDecorationLine: 'line-through' },
  hint: { fontSize: 12, fontWeight: FONT.semibold, color: PALETTE.textMuted, textAlign: 'center' },
});

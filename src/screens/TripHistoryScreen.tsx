import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { TripRecord, getTripHistory, deleteTrip, clearTripHistory } from '../services/trips';
import { PALETTE, FONT } from '../theme/theme';
import NeoCard from '../components/NeoCard';
import NeoButton from '../components/NeoButton';
import { fmtDuration } from '../logic/rideLog';

interface Props {
  onBack: () => void;
}

const peso = (v: number) => '₱' + Math.round(v).toLocaleString('en-PH');

// Dates are formatted by hand so they look the same on every phone.
const DAYS = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  fil: ['Linggo', 'Lunes', 'Martes', 'Miyerkules', 'Huwebes', 'Biyernes', 'Sabado'],
};
const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  fil: ['Ene', 'Peb', 'Mar', 'Abr', 'May', 'Hun', 'Hul', 'Ago', 'Set', 'Okt', 'Nob', 'Dis'],
};

function timeOf(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function TripHistoryScreen({ onBack }: Props) {
  const { t, lang } = useApp();
  const [trips, setTrips] = useState<TripRecord[] | null>(null);
  const [open, setOpen] = useState<string | null>(null); // trip whose stop-by-stop times are shown

  useEffect(() => {
    getTripHistory().then(setTrips);
  }, []);

  const dayLabel = (ms: number) => {
    const d = new Date(ms);
    const today = new Date();
    const yest = new Date(Date.now() - 86400000);
    const L = lang === 'fil' ? 'fil' : 'en';
    const full = `${DAYS[L][d.getDay()]}, ${MONTHS[L][d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    if (dayKey(ms) === dayKey(today.getTime())) return `${t('today')} · ${full}`;
    if (dayKey(ms) === dayKey(yest.getTime())) return `${t('yesterday')} · ${full}`;
    return full;
  };

  // group by calendar day, newest first
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: TripRecord[] }[] = [];
    (trips ?? []).forEach((tr) => {
      const k = dayKey(tr.endedAt);
      let g = out.find((x) => x.key === k);
      if (!g) {
        g = { key: k, label: dayLabel(tr.endedAt), items: [] };
        out.push(g);
      }
      g.items.push(tr);
    });
    return out;
  }, [trips, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => {
    const list = trips ?? [];
    return {
      rides: list.length,
      saved: list.reduce((a, b) => a + b.savedMin, 0),
      co2kg: list.reduce((a, b) => a + b.co2g, 0) / 1000,
      km: list.reduce((a, b) => a + b.km, 0),
    };
  }, [trips]);

  const askDelete = (tr: TripRecord) =>
    Alert.alert(t('deleteTripTitle'), `#${tr.num} · ${tr.fromName} → ${tr.toName}`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => deleteTrip(tr.id).then(setTrips) },
    ]);

  const askClear = () =>
    Alert.alert(t('clearHistoryTitle'), t('clearHistoryBody'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('clearAll'), style: 'destructive', onPress: () => clearTripHistory().then(() => setTrips([])) },
    ]);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={PALETTE.text} />
        </Pressable>
        <Text style={styles.title}>{t('tripHistory')}</Text>
      </View>

      {trips === null ? (
        <ActivityIndicator color={PALETTE.blue} style={{ marginTop: 40 }} />
      ) : trips.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bus-outline" size={44} color={PALETTE.textMuted} />
          <Text style={styles.emptyTitle}>{t('noTripsYet')}</Text>
          <Text style={styles.emptySub}>{t('noTripsHint')}</Text>
        </View>
      ) : (
        <>
          {/* all-time totals */}
          <NeoCard style={styles.card}>
            <View style={styles.totRow}>
              <View style={styles.totCell}>
                <Text style={styles.totNum}>{totals.rides}</Text>
                <Text style={styles.totLabel}>{t('rides')}</Text>
              </View>
              <View style={styles.totCell}>
                <Text style={[styles.totNum, { color: PALETTE.mint }]}>{peso(totals.saved)}</Text>
                <Text style={styles.totLabel}>{t('savedAtLeast')}</Text>
              </View>
              <View style={styles.totCell}>
                <Text style={styles.totNum}>{totals.km.toFixed(1)}</Text>
                <Text style={styles.totLabel}>km</Text>
              </View>
              <View style={styles.totCell}>
                <Text style={styles.totNum}>{totals.co2kg.toFixed(1)}kg</Text>
                <Text style={styles.totLabel}>CO₂</Text>
              </View>
            </View>
          </NeoCard>

          {groups.map((g) => (
            <View key={g.key} style={styles.group}>
              <Text style={styles.dayLabel}>{g.label}</Text>
              {g.items.map((tr) => (
                <Pressable key={tr.id} onPress={() => setOpen(open === tr.id ? null : tr.id)} onLongPress={() => askDelete(tr)} delayLongPress={450}>
                  <NeoCard style={styles.card}>
                    <View style={styles.topRow}>
                      <View style={styles.numChip}>
                        <Text style={styles.numText}>#{tr.num}</Text>
                      </View>
                      <View style={[styles.dirChip, { backgroundColor: tr.direction === 'toPRC' ? '#E7F0FF' : '#FFF4DB' }]}>
                        <Text style={styles.dirText}>{t(tr.direction)}</Text>
                      </View>
                      <View style={{ flex: 1 }} />
                      <Text style={styles.paid}>
                        {peso(tr.fare)} <Text style={styles.paidLabel}>{t('paidWord')}</Text>
                      </Text>
                    </View>

                    <Text style={styles.route} numberOfLines={1}>
                      {tr.fromName} <Text style={{ color: PALETTE.blue }}>→</Text> {tr.toName}
                    </Text>

                    <View style={styles.timeRow}>
                      <Ionicons name="time-outline" size={14} color={PALETTE.textMuted} />
                      <Text style={styles.timeText}>
                        {timeOf(tr.startedAt)} <Text style={{ color: PALETTE.textMuted }}>→</Text> {timeOf(tr.endedAt)}
                      </Text>
                      <Text style={styles.dur}>· {tr.minutes} min</Text>
                    </View>

                    <View style={styles.statsRow}>
                      <Text style={styles.stat}>{tr.km} km</Text>
                      <Text style={styles.dot}>·</Text>
                      <Text style={styles.stat}>
                        {tr.stops} {tr.stops === 1 ? t('stopWord') : t('stopsWord')}
                      </Text>
                      <Text style={styles.dot}>·</Text>
                      <Text style={[styles.stat, { color: PALETTE.mint }]}>
                        {t('savedWord')} {tr.savedMin === tr.savedMax ? peso(tr.savedMin) : `${peso(tr.savedMin)}–${tr.savedMax}`}
                      </Text>
                      <Text style={styles.dot}>·</Text>
                      <Text style={styles.stat}>{tr.co2g}g CO₂</Text>
                      {tr.avgKph != null ? (
                        <>
                          <Text style={styles.dot}>·</Text>
                          <Text style={styles.stat}>avg {Math.round(tr.avgKph)} km/h</Text>
                        </>
                      ) : null}
                    </View>

                    {tr.segments && tr.segments.length ? (
                      open === tr.id ? (
                        <View style={styles.legs}>
                          {tr.segments.map((g, i) => (
                            <View key={i} style={styles.legRow}>
                              <Text style={styles.legName} numberOfLines={1}>{g.from} → {g.to}</Text>
                              <Text style={styles.legKph}>{g.kph != null ? `${Math.round(g.kph)} km/h` : ''}</Text>
                              <Text style={styles.legTime}>{fmtDuration(g.sec)}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.more}>{t('showStopTimes')} ⌄</Text>
                      )
                    ) : null}
                  </NeoCard>
                </Pressable>
              ))}
            </View>
          ))}

          <Text style={styles.hint}>{t('holdToDelete')}</Text>
          <NeoButton label={t('clearHistory')} color={PALETTE.cardBg} small onPress={askClear} />
        </>
      )}
      <View style={{ height: 12 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: PALETTE.bg },
  scroll: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  back: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.cardBg, borderWidth: 1, borderColor: PALETTE.border },
  title: { fontSize: 22, fontWeight: FONT.black, color: PALETTE.text, marginLeft: 6 },
  card: { backgroundColor: PALETTE.cardBg },
  totRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totCell: { flex: 1, alignItems: 'center' },
  totNum: { fontSize: 17, fontWeight: FONT.black, color: PALETTE.text },
  totLabel: { fontSize: 10.5, fontWeight: FONT.bold, color: PALETTE.textMuted },
  group: { gap: 8 },
  dayLabel: { fontSize: 12, fontWeight: FONT.black, color: PALETTE.textMuted, marginTop: 6, marginLeft: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  numChip: { backgroundColor: '#EFEAFE', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  numText: { fontSize: 11, fontWeight: FONT.black, color: PALETTE.purple },
  dirChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  dirText: { fontSize: 11, fontWeight: FONT.bold, color: PALETTE.text },
  paid: { fontSize: 14, fontWeight: FONT.black, color: PALETTE.text },
  paidLabel: { fontSize: 11, fontWeight: FONT.bold, color: PALETTE.textMuted },
  route: { fontSize: 16, fontWeight: FONT.black, color: PALETTE.text },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  timeText: { fontSize: 13, fontWeight: FONT.bold, color: PALETTE.text },
  dur: { fontSize: 12, fontWeight: FONT.semibold, color: PALETTE.textMuted },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 6 },
  stat: { fontSize: 11.5, fontWeight: FONT.bold, color: PALETTE.textMuted },
  dot: { fontSize: 11.5, color: PALETTE.textMuted },
  legs: { marginTop: 8, borderTopWidth: 1, borderTopColor: PALETTE.border, paddingTop: 4 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  legName: { flex: 1, fontSize: 12, fontWeight: FONT.bold, color: PALETTE.text },
  legKph: { fontSize: 11, fontWeight: FONT.semibold, color: PALETTE.textMuted },
  legTime: { width: 58, textAlign: 'right', fontSize: 12, fontWeight: FONT.black, color: PALETTE.text },
  more: { fontSize: 11.5, fontWeight: FONT.bold, color: PALETTE.blue, marginTop: 6 },
  hint: { fontSize: 11, fontWeight: FONT.semibold, color: PALETTE.textMuted, textAlign: 'center', marginTop: 4 },
  empty: { alignItems: 'center', gap: 8, marginTop: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: FONT.black, color: PALETTE.text },
  emptySub: { fontSize: 13, fontWeight: FONT.semibold, color: PALETTE.textMuted, textAlign: 'center' },
});

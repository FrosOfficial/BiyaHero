import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { TripSummary } from '../logic/routeMath';
import { MOTO_TAXI } from '../data/fares';
import { MonthTotals } from '../services/trips';
import { PALETTE, FONT } from '../theme/theme';
import NeoCard from '../components/NeoCard';
import NeoButton from '../components/NeoButton';
import StickerBadge from '../components/StickerBadge';

const peso = (v: number) => '₱' + (Number.isInteger(v) ? v.toLocaleString('en-PH') : v.toFixed(2));

interface Props {
  trip: TripSummary;
  month: MonthTotals | null;
  discounted: boolean;
  onDone: () => void;
  onHistory: () => void;
}

export default function TripSummaryScreen({ trip, month, discounted, onDone, onHistory }: Props) {
  const { t } = useApp();
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <StickerBadge label={t('arrived').toUpperCase()} color={PALETTE.mint} />
      <Text style={styles.route}>
        {trip.fromName} <Text style={styles.arrow}>→</Text> {trip.toName}
      </Text>
      <Text style={styles.meta}>
        {trip.km} km · {trip.stops} {trip.stops === 1 ? t('stopWord') : t('stopsWord')} · {trip.minutes} {t('onBoard')}
      </Text>

      {/* the headline number: savings range vs motorcycle taxis */}
      <NeoCard style={[styles.card, { backgroundColor: PALETTE.yellow }]} offset={6}>
        <Text style={styles.savedNum} adjustsFontSizeToFit numberOfLines={1}>
          {trip.savedMin === trip.savedMax ? peso(trip.savedMin) : `${peso(trip.savedMin)}–${trip.savedMax}`}
        </Text>
        <Text style={styles.savedLabel}>{t('savedVsMoto')}</Text>
        <View style={styles.compare}>
          <View style={styles.compareCell}>
            <Text style={styles.compareLabel}>{t('youPaid')}</Text>
            <Text style={styles.compareVal}>{peso(trip.fare)}</Text>
            <Text style={styles.compareNote}>{discounted ? t('discountShort') : t('regularShort')}</Text>
          </View>
          <View style={styles.compareCell}>
            <Text style={styles.compareLabel}>{MOTO_TAXI.apps.join(' · ')}</Text>
            <View style={styles.srcRow}>
              <Text style={styles.srcLabel}>{t('checkedPrice')}</Text>
              <Text style={[styles.srcVal, styles.strike]}>{peso(trip.motoLow)}–{trip.motoHigh}</Text>
            </View>
            <View style={styles.srcRow}>
              <Text style={styles.srcLabel}>{t('publishedRates')}</Text>
              <Text style={[styles.srcVal, styles.strike]}>{peso(trip.pubLow)}–{trip.pubHigh}</Text>
            </View>
          </View>
        </View>
      </NeoCard>

      <View style={styles.row}>
        <NeoCard style={[styles.card, styles.tile]}>
          <Ionicons name="leaf" size={26} color={PALETTE.mint} />
          <Text style={styles.tileNum}>{trip.co2g}g</Text>
          <Text style={styles.tileLabel}>{t('co2Saved')}</Text>
        </NeoCard>
        <NeoCard style={[styles.card, styles.tile]}>
          <Ionicons name="time" size={26} color={PALETTE.blue} />
          <Text style={styles.tileNum}>{trip.minutes}</Text>
          <Text style={styles.tileLabel}>{t('onBoard')}</Text>
        </NeoCard>
      </View>

      {month ? (
        <NeoCard style={styles.card}>
          <View style={styles.monthHead}>
            <Text style={styles.monthTitle}>★ {t('thisMonth').toUpperCase()}</Text>
          </View>
          <View style={styles.monthRow}>
            <View style={styles.monthCell}>
              <Text style={styles.monthNum}>{peso(month.saved)}</Text>
              <Text style={styles.tileLabel}>{t('savedAtLeast')}</Text>
            </View>
            <View style={styles.monthCell}>
              <Text style={styles.monthNum}>{month.rides}</Text>
              <Text style={styles.tileLabel}>{t('rides')}</Text>
            </View>
            <View style={styles.monthCell}>
              <Text style={styles.monthNum}>{(month.co2g / 1000).toFixed(1)}kg</Text>
              <Text style={styles.tileLabel}>{t('co2Saved')}</Text>
            </View>
          </View>
        </NeoCard>
      ) : null}

      <NeoButton label={t('done')} color={PALETTE.mint} onPress={onDone} />
      <NeoButton
        label={t('tripHistory')}
        color={PALETTE.cardBg}
        small
        icon={<Ionicons name="time-outline" size={18} color={PALETTE.text} />}
        onPress={onHistory}
      />
      <View style={{ height: 12 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: PALETTE.bg },
  scroll: { padding: 20, gap: 16 },
  route: { fontSize: 24, fontWeight: FONT.black, color: PALETTE.text },
  arrow: { color: PALETTE.blue },
  meta: { fontSize: 13, fontWeight: FONT.bold, color: PALETTE.textMuted, marginTop: -8 },
  card: { backgroundColor: PALETTE.cardBg },
  savedNum: { fontSize: 52, fontWeight: FONT.black, color: PALETTE.text, textAlign: 'center' },
  savedLabel: { fontSize: 14, fontWeight: FONT.black, color: PALETTE.text, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  compare: { flexDirection: 'row', gap: 10, marginTop: 14 },
  compareCell: {
    flex: 1,
    backgroundColor: PALETTE.cardBg,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  compareLabel: { fontSize: 11, fontWeight: FONT.bold, color: PALETTE.textMuted },
  compareVal: { fontSize: 20, fontWeight: FONT.black, color: PALETTE.text },
  compareNote: { fontSize: 11, fontWeight: FONT.black, color: PALETTE.textMuted, textAlign: 'center' },
  srcRow: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: 4, gap: 6 },
  srcLabel: { fontSize: 11, fontWeight: FONT.bold, color: PALETTE.textMuted },
  srcVal: { fontSize: 14, fontWeight: FONT.black },
  strike: { textDecorationLine: 'line-through', color: PALETTE.coral },
  row: { flexDirection: 'row', gap: 14 },
  tile: { flex: 1, alignItems: 'center', gap: 2 },
  tileNum: { fontSize: 24, fontWeight: FONT.black, color: PALETTE.text },
  tileLabel: { fontSize: 11, fontWeight: FONT.bold, color: PALETTE.textMuted, textAlign: 'center' },
  monthHead: { alignSelf: 'flex-start', backgroundColor: PALETTE.purple, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  monthTitle: { fontSize: 11, fontWeight: FONT.black, color: '#FFFFFF', letterSpacing: 0.5 },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between' },
  monthCell: { flex: 1, alignItems: 'center' },
  monthNum: { fontSize: 20, fontWeight: FONT.black, color: PALETTE.purple },
});

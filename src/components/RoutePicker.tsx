// Route picker: a card showing your current route ("Makati · To PRC") that
// opens a sheet listing every city and its routes. Routes that aren't mapped
// yet show a "Soon" tag and can't be picked.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Direction, stopsFor } from '../data/route';
import { AREAS, AreaRoute, areaFor } from '../data/areas';
import { PALETTE, FONT } from '../theme/theme';
import { useApp } from '../context/AppContext';

interface Props {
  value: Direction;
  onChange: (d: Direction) => void;
  style?: StyleProp<ViewStyle>;
}

export default function RoutePicker({ value, onChange, style }: Props) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const label = (r: AreaRoute) => (r.nameKey ? t(r.nameKey) : r.name);
  // "Mantrade → PRC · 11 stops"
  const detail = (d: Direction) => {
    const st = stopsFor(d);
    return `${st[0].short} → ${st[st.length - 1].short}  ·  ${st.length} ${t('stopsWord')}`;
  };
  const cur = areaFor(value);

  return (
    <>
      <Pressable style={[styles.chip, style]} onPress={() => setOpen(true)}>
        <View style={styles.chipIcon}>
          <Ionicons name="bus" size={16} color={PALETTE.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chipCity}>{cur.area.name}</Text>
          <Text style={styles.chipRoute}>{label(cur.route)}</Text>
        </View>
        <Text style={styles.change}>{t('changeRoute')}</Text>
        <Ionicons name="chevron-down" size={18} color={PALETTE.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.grab} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{t('chooseRoute')}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={22} color={PALETTE.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.list}>
            {AREAS.map((area) => (
              <View key={area.id} style={styles.area}>
                <View style={styles.areaHead}>
                  <Ionicons name="location" size={15} color={PALETTE.blue} />
                  <Text style={styles.areaName}>{area.name}</Text>
                </View>
                <View style={styles.group}>
                  {area.routes.map((r, i) => {
                    const live = !!r.direction;
                    const on = r.direction === value;
                    return (
                      <Pressable
                        key={r.id}
                        disabled={!live}
                        onPress={() => {
                          if (r.direction) onChange(r.direction);
                          setOpen(false);
                        }}
                        style={[styles.row, i > 0 && styles.rowLine, on && styles.rowOn]}
                      >
                        <Ionicons
                          name="arrow-forward-circle"
                          size={20}
                          color={on ? PALETTE.text : live ? PALETTE.textMuted : '#C9CCD3'}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.rowName, !live && styles.soonText]}>{label(r)}</Text>
                          {live ? <Text style={styles.rowDetail}>{detail(r.direction!)}</Text> : null}
                        </View>
                        {on ? (
                          <Ionicons name="checkmark-circle" size={22} color={PALETTE.mint} />
                        ) : !live ? (
                          <View style={styles.soonPill}>
                            <Text style={styles.soonPillText}>{t('soon')}</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            <View style={styles.more}>
              <Ionicons name="map-outline" size={16} color={PALETTE.textMuted} />
              <Text style={styles.moreText}>{t('moreLocations')}</Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: PALETTE.cardBg,
  },
  chipIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: PALETTE.yellow, alignItems: 'center', justifyContent: 'center' },
  chipCity: { fontSize: 11, fontWeight: FONT.bold, color: PALETTE.textMuted },
  chipRoute: { fontSize: 15, fontWeight: FONT.black, color: PALETTE.text },
  change: { fontSize: 12, fontWeight: FONT.bold, color: PALETTE.blue },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '80%',
    backgroundColor: PALETTE.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 24,
  },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D4D4D8', marginTop: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 6 },
  sheetTitle: { fontSize: 19, fontWeight: FONT.black, color: PALETTE.text },
  list: { paddingHorizontal: 16, paddingBottom: 8, gap: 14 },
  area: { gap: 6 },
  areaHead: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 4 },
  areaName: { fontSize: 13, fontWeight: FONT.black, color: PALETTE.text, letterSpacing: 0.3 },
  group: { backgroundColor: PALETTE.cardBg, borderRadius: 14, borderWidth: 1, borderColor: PALETTE.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12 },
  rowLine: { borderTopWidth: 1, borderTopColor: PALETTE.border },
  rowOn: { backgroundColor: '#FFF4DB' },
  rowName: { fontSize: 15, fontWeight: FONT.bold, color: PALETTE.text },
  rowDetail: { fontSize: 11.5, fontWeight: FONT.semibold, color: PALETTE.textMuted, marginTop: 1 },
  soonText: { color: '#A6AAB3' },
  soonPill: { backgroundColor: PALETTE.card2, borderWidth: 1, borderColor: PALETTE.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  soonPillText: { fontSize: 10.5, fontWeight: FONT.black, color: PALETTE.textMuted },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  moreText: { fontSize: 12.5, fontWeight: FONT.semibold, color: PALETTE.textMuted },
});

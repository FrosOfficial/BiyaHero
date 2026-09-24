// Route picker sheet showing regions, cities, and selectable routes.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Direction, stopsFor } from '../data/route';
import { REGIONS, AreaRoute, areaFor } from '../data/areas';
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
            {REGIONS.map((region) => {
              const activeCities = region.cities.filter((c) => c.routes && c.routes.length > 0);
              const soonCities = region.cities.filter((c) => !c.routes || c.routes.length === 0);

              return (
                <View key={region.id} style={styles.region}>
                  <View style={styles.regionHead}>
                    <Ionicons name="location" size={15} color={PALETTE.blue} />
                    <Text style={styles.regionName}>{region.name}</Text>
                  </View>

                  {activeCities.map((city) => (
                    <View key={city.id} style={styles.cityBlock}>
                      <View style={styles.cityHead}>
                        <Ionicons name="chevron-forward" size={13} color={PALETTE.blue} />
                        <Text style={styles.cityName}>{city.name}</Text>
                      </View>

                      <View style={styles.group}>
                        {city.routes.map((r, i) => {
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

                  {soonCities.length > 0 && (
                    <View style={styles.cityBlock}>
                      <View style={styles.cityHead}>
                        <Ionicons name="time-outline" size={13} color={PALETTE.textMuted} />
                        <Text style={styles.cityName}>{t('moreCities')}</Text>
                      </View>
                      <View style={styles.group}>
                        {soonCities.map((c, i) => (
                          <View key={c.id} style={[styles.row, i > 0 && styles.rowLine]}>
                            <Ionicons name="location-outline" size={18} color="#C9CCD3" />
                            <Text style={[styles.rowName, styles.soonText, { flex: 1 }]}>{c.name}</Text>
                            <View style={styles.soonPill}>
                              <Text style={styles.soonPillText}>{t('soon')}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
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
  sheetTitle: { fontSize: 18, fontWeight: FONT.black, color: PALETTE.text },
  list: { paddingHorizontal: 16, paddingBottom: 8, gap: 14 },
  region: { gap: 10 },
  regionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4 },
  regionName: { fontSize: 13, fontWeight: FONT.black, color: PALETTE.text },
  cityBlock: { gap: 6 },
  cityHead: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 14 },
  cityName: { fontSize: 12, fontWeight: FONT.bold, color: PALETTE.textMuted },
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

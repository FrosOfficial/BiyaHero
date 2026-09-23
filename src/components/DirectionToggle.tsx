import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Direction, DIRECTIONS } from '../data/route';
import { PALETTE, FONT } from '../theme/theme';
import { useApp } from '../context/AppContext';

interface Props {
  value: Direction;
  onChange?: (d: Direction) => void; // omit to show read-only
  style?: StyleProp<ViewStyle>;
}

export default function DirectionToggle({ value, onChange, style }: Props) {
  const { t } = useApp();
  return (
    <View style={[styles.wrap, style]}>
      {DIRECTIONS.map((d) => {
        const on = d.id === value;
        return (
          <Pressable
            key={d.id}
            disabled={!onChange}
            onPress={() => onChange?.(d.id)}
            style={[styles.opt, { backgroundColor: on ? PALETTE.yellow : PALETTE.cardBg, opacity: !onChange && !on ? 0.45 : 1 }]}
          >
            <Ionicons name="arrow-forward" size={13} color={PALETTE.text} />
            <Text style={styles.txt}>{t(d.id)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: PALETTE.cardBg,
  },
  opt: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
  },
  txt: { fontSize: 13, fontWeight: FONT.black, color: PALETTE.text },
});

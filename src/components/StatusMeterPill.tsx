import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { PALETTE, FONT } from '../theme/theme';

export type CapacityLevel = 'chill' | 'squeezed' | 'sabit';

interface StatusMeterPillProps {
  level: CapacityLevel;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

const CONFIG: Record<CapacityLevel, { bg: string; fg: string; text: string }> = {
  chill: { bg: '#E6F7F1', fg: PALETTE.mint, text: 'CHILL SEATS' },
  squeezed: { bg: '#FFF4DB', fg: '#B7791F', text: 'SQUEEZED' },
  sabit: { bg: '#FFE3E4', fg: PALETTE.coral, text: 'SABIT / FULL' },
};

export function levelFromRatio(ratio: number): CapacityLevel {
  if (ratio >= 0.85) return 'sabit';
  if (ratio >= 0.5) return 'squeezed';
  return 'chill';
}

export default function StatusMeterPill({ level, label, style }: StatusMeterPillProps) {
  const cfg = CONFIG[level];
  return (
    <View style={[styles.pill, { backgroundColor: cfg.bg }, style]}>
      <Text style={[styles.text, { color: cfg.fg }]}>{label ?? cfg.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  text: {
    fontSize: 12,
    fontWeight: FONT.bold,
    letterSpacing: 0.3,
  },
});

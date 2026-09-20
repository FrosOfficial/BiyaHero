import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { PALETTE, FONT } from '../theme/theme';

interface StickerBadgeProps {
  label: string;
  color?: string;
  textColor?: string;
  rotate?: string;
  style?: StyleProp<ViewStyle>;
}

export default function StickerBadge({
  label,
  color = PALETTE.yellow,
  textColor = PALETTE.border,
  rotate = '-2deg',
  style,
}: StickerBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: color, transform: [{ rotate }] }, style]}>
      <Text style={[styles.text, { color: textColor }]}>★ {label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderColor: PALETTE.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: FONT.black,
    letterSpacing: 0.5,
  },
});

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { PALETTE, neoShadow, FONT, RADIUS } from '../theme/theme';

interface NeoCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tag?: string; // small label chip, top-right
  tagColor?: string;
  offset?: number; // kept for API compatibility
}

export default function NeoCard({ children, style, tag, tagColor = PALETTE.mint }: NeoCardProps) {
  return (
    <View style={[styles.card, neoShadow(2), style]}>
      {tag ? (
        <View style={[styles.tag, { backgroundColor: tagColor }]}>
          <Text style={styles.tagText}>{tag}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PALETTE.cardBg,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: RADIUS.lg,
    padding: 16,
  },
  tag: {
    position: 'absolute',
    top: 14,
    right: 14,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    zIndex: 5,
  },
  tagText: {
    fontSize: 10,
    fontWeight: FONT.bold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});

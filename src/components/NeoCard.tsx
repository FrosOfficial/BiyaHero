import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { PALETTE, neoShadow, FONT } from '../theme/theme';

interface NeoCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tag?: string; // floating comic sticker tag, top-right
  tagColor?: string;
  offset?: number;
}

export default function NeoCard({ children, style, tag, tagColor = PALETTE.yellow, offset = 4 }: NeoCardProps) {
  return (
    <View style={[styles.card, neoShadow(offset), style]}>
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
    borderWidth: 2.5,
    borderColor: PALETTE.border,
    borderRadius: 16,
    padding: 16,
  },
  tag: {
    position: 'absolute',
    top: -12,
    right: 12,
    borderWidth: 2,
    borderColor: PALETTE.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    transform: [{ rotate: '-2deg' }],
    zIndex: 5,
  },
  tagText: {
    fontSize: 11,
    fontWeight: FONT.black,
    color: PALETTE.border,
    letterSpacing: 0.5,
  },
});

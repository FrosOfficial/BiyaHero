import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { PALETTE, FONT } from '../theme/theme';

interface SpeechBubbleProps {
  text: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export default function SpeechBubble({ text, color = PALETTE.cardBg, style }: SpeechBubbleProps) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.bubble, { backgroundColor: color }]}>
        <Text style={styles.text}>{text}</Text>
      </View>
      <View style={styles.tailOuter}>
        <View style={[styles.tailInner, { borderTopColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
  },
  bubble: {
    borderWidth: 2,
    borderColor: PALETTE.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: FONT.bold,
    color: PALETTE.text,
  },
  tailOuter: {
    marginLeft: 16,
    marginTop: -2,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 11,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: PALETTE.border,
  },
  tailInner: {
    position: 'absolute',
    left: -7,
    top: -11,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});

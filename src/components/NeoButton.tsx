import React from 'react';
import { Text, StyleSheet, Pressable, ViewStyle, StyleProp, View } from 'react-native';
import { PALETTE, FONT, RADIUS } from '../theme/theme';

interface NeoButtonProps {
  label: string;
  onPress?: () => void;
  color?: string; // fill color
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  offset?: number; // kept for API compatibility; ignored in the soft style
  icon?: React.ReactNode;
  small?: boolean;
}

// A clean filled button: soft rounded, medium-weight label, gentle press fade.
export default function NeoButton({
  label,
  onPress,
  color = PALETTE.text,
  textColor,
  style,
  icon,
  small = false,
}: NeoButtonProps) {
  // pick readable text: dark on light fills, white on strong fills
  const fg = textColor ?? (isLight(color) ? PALETTE.text : '#FFFFFF');
  const bordered = isLight(color);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }) => [
        styles.btn,
        {
          backgroundColor: color,
          paddingVertical: small ? 9 : 13,
          borderWidth: bordered ? 1 : 0,
          borderColor: PALETTE.border,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {icon}
        <Text style={[styles.text, { color: fg, fontSize: small ? 13 : 15 }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

// crude luminance check so buttons on white/cream fills keep dark text
function isLight(hex: string): boolean {
  const m = hex.replace('#', '');
  if (m.length < 6) return true;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.7;
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontWeight: FONT.bold, letterSpacing: 0.2 },
});

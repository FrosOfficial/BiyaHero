import React, { useRef } from 'react';
import { Text, StyleSheet, Pressable, Animated, ViewStyle, StyleProp, View } from 'react-native';
import { PALETTE, FONT } from '../theme/theme';

interface NeoButtonProps {
  label: string;
  onPress?: () => void;
  color?: string; // fill color
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  offset?: number;
  icon?: React.ReactNode;
  small?: boolean;
}

export default function NeoButton({
  label,
  onPress,
  color = PALETTE.yellow,
  textColor = PALETTE.border,
  style,
  offset = 3,
  icon,
  small = false,
}: NeoButtonProps) {
  const translate = useRef(new Animated.Value(0)).current;

  const shadowStyle: ViewStyle = {
    shadowColor: PALETTE.border,
    shadowOffset: { width: offset, height: offset },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: offset,
  };

  return (
    <Animated.View
      style={[
        { transform: [{ translateX: translate }, { translateY: translate }] },
        shadowStyle,
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.timing(translate, { toValue: 2, duration: 40, useNativeDriver: true }).start()}
        onPressOut={() => Animated.timing(translate, { toValue: 0, duration: 40, useNativeDriver: true }).start()}
        style={[
          styles.btn,
          { backgroundColor: color, paddingVertical: small ? 8 : 14 },
        ]}
      >
        <View style={styles.row}>
          {icon}
          <Text style={[styles.text, { color: textColor, fontSize: small ? 13 : 15 }]}>{label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 2.5,
    borderColor: PALETTE.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontWeight: FONT.black,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useApp } from '../context/AppContext';
import { PALETTE, FONT } from '../theme/theme';

export default function LanguageToggle({ style }: { style?: StyleProp<ViewStyle> }) {
  const { lang, setLang } = useApp();
  return (
    <View style={[styles.wrap, style]}>
      {(['en', 'fil'] as const).map((l) => (
        <Pressable
          key={l}
          onPress={() => setLang(l)}
          style={[styles.opt, { backgroundColor: lang === l ? PALETTE.yellow : PALETTE.cardBg }]}
        >
          <Text style={styles.txt}>{l === 'en' ? 'EN' : 'FIL'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: PALETTE.border,
    borderRadius: 999,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  opt: { paddingHorizontal: 14, paddingVertical: 6 },
  txt: { fontSize: 13, fontWeight: FONT.black, color: PALETTE.border },
});

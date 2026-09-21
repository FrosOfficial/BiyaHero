import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PALETTE, FONT, neoShadow } from '../theme/theme';
import { useApp } from '../context/AppContext';
import NeoButton from '../components/NeoButton';
import LanguageToggle from '../components/LanguageToggle';

export default function TermsScreen({ onAccept }: { onAccept: () => void }) {
  const { t } = useApp();
  const [checked, setChecked] = useState(false);
  const sections = ['1', '2', '3', '4', '5', '6'];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <Text style={styles.title}>{t('termsTitle')}</Text>
          <LanguageToggle />
        </View>
        <Text style={styles.updated}>{t('termsSub')}</Text>

        <View style={[styles.card, neoShadow(4)]}>
          {sections.map((n) => (
            <View key={n} style={styles.section}>
              <Text style={styles.sectionTitle}>{t(`tos${n}t`)}</Text>
              <Text style={styles.sectionBody}>{t(`tos${n}b`)}</Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.checkRow} onPress={() => setChecked((v) => !v)}>
          <View style={[styles.checkbox, { backgroundColor: checked ? PALETTE.mint : PALETTE.cardBg }]}>
            {checked ? <Ionicons name="checkmark" size={20} color={PALETTE.border} /> : null}
          </View>
          <Text style={styles.checkText}>{t('agree')}</Text>
        </Pressable>

        <NeoButton
          label={t('agreeContinue')}
          color={checked ? PALETTE.yellow : '#D4D4D8'}
          onPress={() => checked && onAccept()}
        />
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.bg },
  scroll: { padding: 20, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, fontSize: 24, fontWeight: FONT.black, color: PALETTE.text },
  updated: { fontSize: 13, fontWeight: FONT.semibold, color: PALETTE.textMuted, marginTop: -6 },
  card: { backgroundColor: PALETTE.cardBg, borderWidth: 2.5, borderColor: PALETTE.border, borderRadius: 16, padding: 16, gap: 14 },
  section: { gap: 4 },
  sectionTitle: { fontSize: 15, fontWeight: FONT.black, color: PALETTE.text },
  sectionBody: { fontSize: 13.5, fontWeight: FONT.regular, color: PALETTE.textMuted, lineHeight: 19 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  checkbox: { width: 32, height: 32, borderWidth: 2.5, borderColor: PALETTE.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  checkText: { flex: 1, fontSize: 13, fontWeight: FONT.semibold, color: PALETTE.text },
});

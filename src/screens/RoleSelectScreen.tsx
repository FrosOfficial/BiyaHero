import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PALETTE, FONT, neoShadow } from '../theme/theme';
import StickerBadge from '../components/StickerBadge';

export type Role = 'commuter' | 'driver';

export default function RoleSelectScreen({ onSelect }: { onSelect: (r: Role) => void }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.brand}>BiyaHero</Text>
          <StickerBadge label="MAKATI PILOT" color={PALETTE.mint} />
        </View>
        <Text style={styles.tag}>Real-time jeepney tracking. Choose how you ride.</Text>

        <Pressable style={[styles.role, neoShadow(6), { backgroundColor: PALETTE.yellow }]} onPress={() => onSelect('commuter')}>
          <Ionicons name="walk" size={44} color={PALETTE.border} />
          <View style={styles.roleText}>
            <Text style={styles.roleTitle}>I'm a Commuter</Text>
            <Text style={styles.roleSub}>Track jeeps, see seats, find your ride.</Text>
          </View>
          <Ionicons name="chevron-forward" size={28} color={PALETTE.border} />
        </Pressable>

        <Pressable style={[styles.role, neoShadow(6), { backgroundColor: PALETTE.mint }]} onPress={() => onSelect('driver')}>
          <Ionicons name="bus" size={44} color={PALETTE.border} />
          <View style={styles.roleText}>
            <Text style={styles.roleTitle}>I'm a Driver</Text>
            <Text style={styles.roleSub}>Go live, find passengers, drive smart.</Text>
          </View>
          <Ionicons name="chevron-forward" size={28} color={PALETTE.border} />
        </Pressable>

        <View style={styles.spacer} />
        <Text style={styles.note}>No sign-up. No login. Just pick and go.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.bg },
  wrap: { flex: 1, padding: 20, justifyContent: 'center', gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { fontSize: 36, fontWeight: FONT.black, color: PALETTE.text },
  tag: { fontSize: 14, fontWeight: FONT.semibold, color: PALETTE.textMuted, marginBottom: 8 },
  role: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 3,
    borderColor: PALETTE.border,
    borderRadius: 18,
    padding: 18,
  },
  roleText: { flex: 1 },
  roleTitle: { fontSize: 20, fontWeight: FONT.black, color: PALETTE.border },
  roleSub: { fontSize: 13, fontWeight: FONT.semibold, color: PALETTE.border, marginTop: 2 },
  spacer: { height: 12 },
  note: { fontSize: 12, fontWeight: FONT.semibold, color: PALETTE.textMuted, textAlign: 'center', marginTop: 6 },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppProvider } from './src/context/AppContext';
import { PALETTE, FONT } from './src/theme/theme';
import RoleSelectScreen, { Role } from './src/screens/RoleSelectScreen';
import CommuterScreen from './src/screens/CommuterScreen';
import DriverScreen from './src/screens/DriverScreen';

const TITLES: Record<Role, string> = {
  commuter: 'Commuter',
  driver: 'Driver',
};

export default function App() {
  const [role, setRole] = useState<Role | null>(null);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        {role === null ? (
          <RoleSelectScreen onSelect={setRole} />
        ) : (
          <View style={styles.flex}>
            <SafeAreaView edges={['top']} style={styles.barWrap}>
              <View style={styles.bar}>
                <Pressable style={styles.switchBtn} onPress={() => setRole(null)}>
                  <Ionicons name="swap-horizontal" size={16} color={PALETTE.border} />
                  <Text style={styles.switchText}>Switch</Text>
                </Pressable>
                <Text style={styles.barTitle}>{TITLES[role]}</Text>
                <View style={{ width: 72 }} />
              </View>
            </SafeAreaView>
            {role === 'commuter' && <CommuterScreen />}
            {role === 'driver' && <DriverScreen />}
          </View>
        )}
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: PALETTE.bg },
  barWrap: { backgroundColor: PALETTE.cardBg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2.5,
    borderBottomColor: PALETTE.border,
    backgroundColor: PALETTE.cardBg,
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: PALETTE.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: PALETTE.yellow,
  },
  switchText: { fontSize: 12, fontWeight: FONT.black, color: PALETTE.border },
  barTitle: { fontSize: 18, fontWeight: FONT.black, color: PALETTE.text },
});

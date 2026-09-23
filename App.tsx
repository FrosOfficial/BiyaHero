import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider } from './src/context/AppContext';
import { PALETTE, FONT } from './src/theme/theme';
import TermsScreen from './src/screens/TermsScreen';
import CommuterScreen from './src/screens/CommuterScreen';
import LanguageToggle from './src/components/LanguageToggle';
import './src/services/rideAlert'; // registers the background stop-alert task

function Root() {
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('tos_accepted')
      .then((v) => setAccepted(v === 'yes'))
      .catch(() => setAccepted(false));
  }, []);

  const accept = () => {
    setAccepted(true);
    AsyncStorage.setItem('tos_accepted', 'yes').catch(() => {});
  };

  if (accepted === null) return <View style={styles.flex} />;
  if (!accepted) return <TermsScreen onAccept={accept} />;

  return (
    <View style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.barWrap}>
        <View style={styles.bar}>
          <Text style={styles.barTitle}>BiyaHero</Text>
          <LanguageToggle />
        </View>
      </SafeAreaView>
      <CommuterScreen />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Root />
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
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
    backgroundColor: PALETTE.cardBg,
  },
  barTitle: { fontSize: 18, fontWeight: FONT.black, color: PALETTE.text },
});

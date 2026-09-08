import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n, { initializeI18n } from './src/i18n';
import { moonColors, moonRadius } from './src/moonlinea/theme/tokens';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  const [ready, setReady] = useState(false);
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');

  useEffect(() => {
    initializeI18n()
      .then(() => setDirection(i18n.dir()))
      .catch(() => undefined)
      .finally(() => setReady(true));

    const handleLanguageChanged = () => setDirection(i18n.dir());
    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <View style={styles.loadingMark} />
        <View style={styles.loadingLine} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={[styles.root, { direction }]}>
        <StatusBar style="dark" />
        <AppNavigator />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: moonColors.background,
  },
  loading: {
    flex: 1,
    backgroundColor: moonColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingMark: {
    width: 42,
    height: 42,
    borderRadius: moonRadius.medium,
    backgroundColor: moonColors.textPrimary,
  },
  loadingLine: {
    width: 92,
    height: 8,
    borderRadius: moonRadius.pill,
    backgroundColor: moonColors.border,
  },
});

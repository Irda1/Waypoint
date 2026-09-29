import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { AuthProvider } from '../src/auth/AuthProvider';
import { useTheme } from '../src/theme/useTheme';
import { useAppFonts } from '../src/theme/useAppFonts';

export default function RootLayout() {
  const { colors, mode } = useTheme();
  const ready = useAppFonts();
  // Fond uni le temps de charger les polices : pas de flash de texte dans la mauvaise police.
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <AuthProvider>
      <StatusBar style={mode === 'nuit' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </AuthProvider>
  );
}

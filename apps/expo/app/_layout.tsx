import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { AuthProvider } from '../src/auth/AuthProvider';
import { useTheme } from '../src/theme/useTheme';

export default function RootLayout() {
  const { colors, mode } = useTheme();
  return (
    <AuthProvider>
      <StatusBar style={mode === 'nuit' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </AuthProvider>
  );
}

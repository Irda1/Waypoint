import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Stack, router, usePathname, type ErrorBoundaryProps } from 'expo-router';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { loadFriendPrefs } from '../src/data/friendNotifs';
import { pushSupported, registerPush, useOpenFromNotification } from '../src/lib/push';
import { installErrorReporting, reportError, setErrorScreen } from '../src/data/errors';
import { useTheme } from '../src/theme/useTheme';
import { useAppFonts } from '../src/theme/useAppFonts';

installErrorReporting();

export default function RootLayout() {
  const { colors, mode } = useTheme();
  const ready = useAppFonts();
  const path = usePathname();
  useEffect(() => setErrorScreen(path), [path]);
  // Fond uni le temps de charger les polices : pas de flash de texte dans la mauvaise police.
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <AuthProvider>
      <FriendNotifications />
      <StatusBar style={mode === 'nuit' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        {/* Nouveau voyage : s'ouvre en fondu, à la suite du zoom sur la planète de l'accueil. */}
        <Stack.Screen name="new-trip" options={{ animation: 'fade', contentStyle: { backgroundColor: '#000' } }} />
      </Stack>
    </AuthProvider>
  );
}

/** Notifications des amis : inscrit ce téléphone au démarrage (si elles sont activées) et ouvre le voyage d'une notification touchée. */
function FriendNotifications() {
  const { session } = useAuth();
  useOpenFromNotification((tripId) => router.push({ pathname: '/trip/[id]', params: { id: tripId } }));
  useEffect(() => {
    if (!session || !pushSupported) return;
    void loadFriendPrefs().then(({ prefs, missing }) => { if (!missing && prefs.enabled) void registerPush(true); });
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Écran de secours quand un écran plante : l'erreur part dans les rapports (si connecté) et on peut réessayer. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useTheme();
  useEffect(() => { void reportError(error, true); }, [error]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '600', textAlign: 'center' }}>Oups, cet écran a planté</Text>
      <Text style={{ color: colors.text2, textAlign: 'center' }}>L'erreur est signalée automatiquement quand tu es connecté.</Text>
      <Text selectable style={{ color: colors.text3, fontSize: 12, textAlign: 'center' }}>{error.message}</Text>
      <Pressable onPress={retry} accessibilityRole="button" style={{ marginTop: 8, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 999, backgroundColor: colors.accent }}>
        <Text style={{ color: colors.onAccent, fontWeight: '600' }}>Réessayer</Text>
      </Pressable>
    </View>
  );
}

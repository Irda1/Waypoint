import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, usePathname } from 'expo-router';
import { useAuth } from './AuthProvider';
import { useTheme } from '../theme/useTheme';

/**
 * Garde d'écran : renvoie un élément à afficher (chargement ou redirection vers la connexion,
 * avec retour automatique sur la page demandée, par ex. un lien d'invitation) ou null si connecté.
 */
export function useRequireAuth(): React.ReactElement | null {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const { colors } = useTheme();
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}><ActivityIndicator color={colors.accent} /></View>;
  if (!session) return <Redirect href={{ pathname: '/sign-in', params: { next: pathname } }} />;
  return null;
}

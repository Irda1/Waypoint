import React from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { router } from 'expo-router';
import { Globe } from '../globe/Globe';
import { ROUTE_BG, routeParam } from '../../domain/routeGlobe.ts';
import type { Destination } from '../../data/useTrip';
import { useAppearance } from '../../theme/store';
import { useTheme } from '../../theme/useTheme';
import { fonts, palette, radius, space } from '../../theme/tokens';

/**
 * L'itinéraire du voyage sur la planète de l'accueil : le tracé va de ville en ville, la planète est centrée et zoomée
 * sur le parcours, noms des villes à côté des étapes. Même fond que l'accueil (sable en Jour, nuit étoilée en Nuit).
 * Toucher la carte ouvre la carte détaillée du voyage.
 */
export function TripRouteCard({ tripId, destinations }: { tripId: string; destinations: Destination[] }) {
  const { colors, mode } = useTheme();
  const { accent } = useAppearance();
  if (!destinations.length) return null;
  const color = (mode === 'jour' ? colors.accent : palette('nuit', accent).accent).slice(1);
  const names = destinations.map((d) => d.name).join(' → ');
  const onPhoto = mode === 'jour' ? colors.text : '#F4EFE6';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Itinéraire : ${names}. Ouvrir la carte du voyage`} onPress={() => router.push({ pathname: '/map/[id]', params: { id: tripId } })}
      style={({ pressed }) => [styles.card, { backgroundColor: ROUTE_BG[mode], borderColor: colors.line, transform: [{ scale: pressed ? 0.99 : 1 }] }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Globe mode="route" color={color} theme={mode} route={routeParam(destinations)} />
      </View>
      <View style={styles.caption} pointerEvents="none">
        <RNText style={[styles.eyebrow, { color: mode === 'jour' ? colors.accent : '#FFD08A' }]}>Ton itinéraire · {destinations.length} ville{destinations.length > 1 ? 's' : ''}</RNText>
        <RNText style={[styles.names, { color: onPhoto }]} numberOfLines={2}>{names}</RNText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { height: 280, borderRadius: radius.card, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  caption: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.md, gap: 2 },
  eyebrow: { fontFamily: fonts.sansSemi, fontSize: 11.5, letterSpacing: 1.6, textTransform: 'uppercase' },
  names: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 25 },
});

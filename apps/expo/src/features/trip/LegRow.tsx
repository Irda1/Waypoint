import React, { useState } from 'react';
import { Linking, Pressable, Text as RNText, View } from 'react-native';
import { Text } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { fonts, radius, space } from '../../theme/tokens';
import { distanceKm } from '../../domain/planning.ts';
import { MODE_LABEL, fastest, formatKm, googleDirectionsUrl, travelOptions } from '../../domain/routes.ts';
import type { Mode, Point } from '../../domain/routes.ts';
import { useRealRoutes } from '../../data/routes';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/Icon';

const ICON: Record<Mode, IconName> = { walk: 'walk', bike: 'bike', transit: 'transit', car: 'car' };
const SHORT: Record<Mode, string> = { walk: 'à pied', bike: 'à vélo', transit: 'en transports', car: 'en voiture' };

interface Props { from: Point; to: Point; fromName: string; toName: string }

/**
 * Trajet entre deux étapes (ou entre l'hébergement et une étape) : replié, il affiche le mode le plus rapide ;
 * ouvert, il propose à pied, vélo, transports et voiture avec la durée, chacun renvoyant vers Google Maps.
 */
export function LegRow({ from, to, fromName, toName }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const real = useRealRoutes(from, to, open);
  const options = travelOptions(from, to, real);
  const best = fastest(options);
  const km = distanceKm(from, to) * 1.3;

  return (
    <View style={{ paddingLeft: 52 + space.md + 16, paddingBottom: space.xs, gap: space.xs }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`Itinéraire de ${fromName} à ${toName}`}
        onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 36 }}>
        <Icon name={ICON[best.mode]} size={16} tone="muted" />
        <Text variant="muted" style={{ flexShrink: 1 }}>{best.real ? '' : '≈ '}{best.minutes} min {SHORT[best.mode]} · {formatKm(km)}</Text>
        <Text variant="muted" style={{ color: colors.accent, fontFamily: fonts.sansSemi }}>{open ? 'Masquer' : 'Itinéraire'}</Text>
      </Pressable>
      {open ? (
        <View style={{ gap: space.xs, padding: space.sm, borderRadius: radius.field, backgroundColor: colors.surface2 }}>
          <Text variant="muted">De {fromName} à {toName}</Text>
          {options.map((o) => (
            <Pressable key={o.mode} accessibilityRole="link" accessibilityLabel={`${MODE_LABEL[o.mode]}, ${o.minutes} minutes, ouvrir dans Google Maps`}
              onPress={() => { void Linking.openURL(googleDirectionsUrl(from, to, o.mode)); }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, opacity: pressed ? 0.7 : 1 })}>
              <Icon name={ICON[o.mode]} size={20} />
              <Text variant="body" style={{ flex: 1 }}>{MODE_LABEL[o.mode]}</Text>
              <Text variant="mono">{o.real ? '' : '≈ '}{o.minutes} min</Text>
              <Icon name="external" size={16} tone="muted" />
            </Pressable>
          ))}
          <Text variant="muted" style={{ fontSize: 12 }}>
            À pied, à vélo et en voiture : itinéraire calculé, sans la circulation. Transports : estimation. Google Maps affiche ensuite les horaires et le trafic réels.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

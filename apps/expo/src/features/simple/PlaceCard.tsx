import React from 'react';
import { Linking, Pressable, Text as RNText, View } from 'react-native';
import { usePlacePhoto } from '../../data/placeInfo';
import { mapsUrl } from '../../domain/simple.ts';
import type { SimplePlace } from '../../domain/simple.ts';
import { iconFor } from '../../theme/categoryIcons';
import { Icon } from '../../ui/Icon';
import { FadeImage, Pop } from '../../ui/motion';
import { fonts, radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/** Photo Wikipédia du lieu, sinon la couleur et l'icône de sa catégorie. */
export function PlacePic({ place, root, dot, size }: { place: SimplePlace; root: string; dot: string; size?: number }) {
  const photo = usePlacePhoto(place.id, place);
  const box = size ? { width: size, height: size, borderRadius: 12 } : { width: '100%' as const, aspectRatio: 4 / 3 };
  return (
    <FadeImage uri={photo} style={{ ...box, backgroundColor: dot }}>
      <Icon name={iconFor(root)} size={size ? Math.round(size / 2.2) : 34} color="#fff" />
    </FadeImage>
  );
}

/** Grande carte photo d'un lieu (mode Simple) : cœur sur la photo, toucher la carte ouvre la fiche. */
export function PlaceCard({ place, root, dot, line, open, closed, on, onToggle, onOpen }: {
  place: SimplePlace; root: string; dot: string; line: string; open: string | null; closed: boolean; on: boolean; onToggle: () => void; onOpen: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${place.name}, ouvrir la fiche`} onPress={onOpen}
      style={({ pressed }) => ({ width: '48%', flexGrow: 1, borderRadius: radius.card - 4, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <View>
        <PlacePic place={place} root={root} dot={dot} />
        <Pop on={on} style={{ position: 'absolute', right: 6, top: 6 }}>
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={on ? `Retirer ${place.name} de ma sélection` : `Garder ${place.name}`} hitSlop={6} onPress={onToggle}
            style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? '#E0475B' : 'rgba(0,0,0,0.42)' }}>
            <Icon name="heart" filled={on} size={19} color="#fff" />
          </Pressable>
        </Pop>
      </View>
      <View style={{ padding: space.sm, gap: 2 }}>
        <RNText numberOfLines={2} style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.text }}>{place.name}</RNText>
        <RNText numberOfLines={2} style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.text2 }}>{line}</RNText>
        {open ? <RNText numberOfLines={1} style={{ fontFamily: fonts.sansSemi, fontSize: 11.5, color: closed ? colors.warm : colors.text3 }}>{open}</RNText> : null}
        <Pressable accessibilityRole="link" accessibilityLabel={`Ouvrir ${place.name} dans Google Maps`} onPress={() => void Linking.openURL(mapsUrl(place))} style={{ minHeight: 30, justifyContent: 'center', alignSelf: 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><RNText style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: colors.accent }}>Google Maps</RNText><Icon name="external" size={12} /></View>
        </Pressable>
      </View>
    </Pressable>
  );
}

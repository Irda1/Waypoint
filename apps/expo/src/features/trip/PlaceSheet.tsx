import React from 'react';
import { Modal, Pressable, ScrollView, Text as RNText, View } from 'react-native';
import * as Linking from 'expo-linking';
import { Button, ErrorNote, Text } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';
import { formatMoney } from '../../lib/format';
import { formatDuration } from '../../lib/search';
import { googlePlaceUrl } from '../../domain/routes.ts';
import { useFavorites } from '../../data/favorites';

interface Props {
  visible: boolean;
  tripId: string;
  placeId: number | null;
  name: string;
  category: string;
  dot: string;
  place: { lat: number; lng: number; price_amount: number | null; visit_duration_min: number | null } | null;
  currency: string;
  travelers: number;
  /** Fermé le jour où cette étape est prévue. */
  closedToday: boolean;
  /** Reste à payer pour cette étape (0 = rien à payer ou déjà payé) et action « Marquer payé ». */
  due?: number;
  onPay?: () => Promise<string | null>;
  onRemove: () => void;
  onClose: () => void;
}

// Feuille du bas (maquette V5 « fiche lieu ») : l'essentiel d'un lieu sans quitter la journée.
export function PlaceSheet({ visible, tripId, placeId, name, category, dot, place, currency, travelers, closedToday, due = 0, onPay, onRemove, onClose }: Props) {
  const [payError, setPayError] = React.useState<string | null>(null);
  const [paying, setPaying] = React.useState(false);
  const { colors } = useTheme();
  const fav = useFavorites(tripId, visible && placeId != null);
  const isFav = placeId != null && fav.ids.has(placeId);
  const duration = place?.visit_duration_min ? formatDuration(place.visit_duration_min) : null;
  const price = place?.price_amount != null ? place.price_amount : null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fermer la fiche" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(3, 5, 6, 0.6)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%', width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.md }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, alignSelf: 'center' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} />
              <Text variant="label">{category}</Text>
            </View>
            <Text variant="title" accessibilityRole="header">{name}</Text>
            {closedToday ? <Text variant="body" style={{ color: colors.warm, fontFamily: fonts.sansSemi }}>Fermé ce jour-là : choisis un autre jour ou une autre étape.</Text> : null}
            <View style={{ gap: space.xs }}>
              {duration ? <Row k="Durée de visite" v={duration} /> : null}
              {price != null ? <Row k={travelers > 1 ? `Prix (× ${travelers})` : 'Prix'} v={price === 0 ? 'Gratuit' : formatMoney(price * travelers, currency)} /> : null}
            </View>
            {price != null && price > 0 ? (
              due > 0 && onPay ? (
                <View style={{ gap: space.sm }}>
                  <Row k="À payer" v={`≈ ${formatMoney(due, currency)}`} />
                  {travelers > 1 ? <Text variant="muted">À partager entre {travelers} voyageurs.</Text> : null}
                  <Button label="Marquer payé" loading={paying} onPress={async () => { setPaying(true); setPayError(await onPay()); setPaying(false); }} />
                  <ErrorNote message={payError} />
                </View>
              ) : <Row k="Paiement" v={`Payé · ${formatMoney(price * travelers, currency)}`} />
            ) : null}
            <Text variant="muted" style={{ fontSize: 12.5 }}>Durées et prix : valeurs indicatives, à vérifier avant d'y aller.</Text>
            {placeId != null ? <Button label={isFav ? '♥ Dans mes favoris' : '♡ Ajouter aux favoris'} variant="ghost" onPress={() => { void fav.toggle(placeId); }} /> : null}
            {place ? <Button label="Ouvrir dans Maps" onPress={() => { void Linking.openURL(googlePlaceUrl(name, place)); }} /> : null}
            <Button label="Retirer du jour" variant="ghost" onPress={() => { onRemove(); onClose(); }} />
            <Button label="Fermer" variant="ghost" onPress={onClose} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.line }}>
      <RNText style={{ fontFamily: fonts.sans, fontSize: 15, color: colors.text2 }}>{k}</RNText>
      <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: colors.text }}>{v}</RNText>
    </View>
  );
}

import React from 'react';
import { Modal, Pressable, ScrollView, Text as RNText, View } from 'react-native';
import * as Linking from 'expo-linking';
import { Button, ErrorNote, Text } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { fonts, radius, space } from '../../theme/tokens';
import { formatMoney } from '../../lib/format';
import { formatDuration } from '../../lib/search';
import { fastest, googleDirectionsUrl, googlePlaceUrl, travelOptions } from '../../domain/routes.ts';
import type { Point } from '../../domain/routes.ts';
import { openNow, weekLines } from '../../domain/openingHours.ts';
import { useFavorites } from '../../data/favorites';
import { knownPlacePhoto, usePlaceInfo } from '../../data/placeInfo';
import { resizeThumb } from '../../domain/cityPhoto.ts';
import { iconFor } from '../../theme/categoryIcons';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/Icon';
import { FadeImage, Pop } from '../../ui/motion';

export interface PlaceDetailsProps {
  tripId: string;
  placeId: number | null;
  name: string;
  category: string;
  /** Catégorie principale (culture, pratique…) : icône quand il n'y a pas de photo. */
  root?: string;
  /** Lieu pratique : symbole de son repère (« WC », « ✚ »), à la place de l'icône de catégorie. */
  symbol?: string;
  /** Contexte affiché après la catégorie (« Jour 2, étape 1 », « À découvrir »). */
  context?: string;
  dot: string;
  place: { lat: number; lng: number; price_amount: number | null; visit_duration_min: number | null; closed_days?: number[] } | null;
  currency: string;
  travelers: number;
  /** Fermé le jour où cette étape est prévue. */
  closedToday: boolean;
  /** Reste à payer pour cette étape (0 = rien à payer ou déjà payé) et action « Marquer payé ». */
  due?: number;
  onPay?: () => Promise<string | null>;
  /** Étape précédente (ou hébergement pour la première) : sert au bouton « Y aller ». Sans elle, l'itinéraire part d'où l'on est. */
  from?: (Point & { name: string }) | null;
  /** Action principale du moment (« Ajouter au jour 2 » depuis la carte). */
  primary?: { label: string; onPress: () => void; busy?: boolean } | null;
  /** Petit message sous les actions (aide ou erreur). */
  note?: string | null;
  /** Absent quand la fiche n'est pas une étape d'un jour (ex. depuis la carte) : pas de bouton « Retirer du jour ». */
  onRemove?: () => void;
  onClose: () => void;
}

/**
 * Fiche d'un lieu (maquette « Carte et fiche ») : en aperçu, vignette, nom, ouvert ou fermé et quatre actions ;
 * en grand, photo, description, durée, prix, adresse, paiement et horaires de la semaine.
 */
export function PlaceDetails(props: PlaceDetailsProps & { expanded: boolean; visible?: boolean }) {
  const { tripId, placeId, name, category, root, symbol, context, dot, place, currency, travelers, closedToday, due = 0, onPay, from = null, primary, note, onRemove, onClose, expanded, visible = true } = props;
  const [payError, setPayError] = React.useState<string | null>(null);
  const [paying, setPaying] = React.useState(false);
  const { colors } = useTheme();
  const fav = useFavorites(tripId, visible && placeId != null);
  const isFav = placeId != null && fav.ids.has(placeId);
  const info = usePlaceInfo(placeId, visible);
  const duration = place?.visit_duration_min ? formatDuration(place.visit_duration_min) : null;
  const price = place?.price_amount != null ? place.price_amount : null;
  const trip = from && place ? fastest(travelOptions(from, place)) : null;
  const status = openNow(info.hours, place?.closed_days ?? [], new Date());
  const week = weekLines(info.hours);
  const today = new Date().getDay();
  const statusColor = status.tone === 'ok' ? colors.paid : status.tone === 'warn' ? colors.warm : colors.text3;
  const mapsUrl = place ? googlePlaceUrl(name, place) : null;
  const go = () => {
    if (!place) return;
    void Linking.openURL(trip && from ? googleDirectionsUrl(from, place, trip.mode) : `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`);
  };
  const site = info.website ? (/^https?:\/\//i.test(info.website) ? info.website : `https://${info.website}`) : null;
  const tel = info.phone ? `tel:${info.phone.replace(/[^\d+]/g, '')}` : null;

  // Photo déjà vue (grille, carte…) affichée tout de suite, sans attendre la fiche complète.
  const photo = info.photo ?? knownPlacePhoto(placeId);
  const picture = (size: 'thumb' | 'hero') => {
    const style = size === 'hero' ? { height: photo || info.loading ? 200 : 120, borderRadius: 18 } : { width: 64, height: 64, borderRadius: 14 };
    return (
      <FadeImage uri={photo ? resizeThumb(photo, size === 'hero' ? 500 : 330) : info.loading ? undefined : null} style={{ ...style, backgroundColor: dot }}>
        {symbol ? <RNText style={{ fontFamily: fonts.sansBold, fontSize: size === 'hero' ? 54 : 22, color: '#fff' }}>{symbol}</RNText>
          : <Icon name={iconFor(root ?? '')} size={size === 'hero' ? 56 : 28} color="#fff" />}
      </FadeImage>
    );
  };

  return (
    <ScrollView scrollEnabled={expanded} contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.md }}>
      {expanded ? (
        <View>
          {picture('hero')}
          {photo ? <RNText style={{ position: 'absolute', right: 8, bottom: 8, fontFamily: fonts.sans, fontSize: 10.5, color: '#fff', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' }}>Photo : Wikipédia</RNText> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer la fiche" onPress={onClose} style={{ position: 'absolute', right: 10, top: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={18} color="#fff" />
          </Pressable>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        {expanded ? null : picture('thumb')}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: dot }} />
            <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>{context ? `${category} · ${context}` : category}</Text>
          </View>
          <Text variant={expanded ? 'title' : 'heading'} accessibilityRole="header" numberOfLines={expanded ? undefined : 2}>{name}</Text>
          <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, color: statusColor }}>{status.text}</RNText>
        </View>
        {expanded ? null : (
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer la fiche" hitSlop={8} onPress={onClose} style={{ width: 32, height: 32, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={20} tone="muted" />
          </Pressable>
        )}
      </View>
      {closedToday ? <Text variant="body" style={{ color: colors.warm, fontFamily: fonts.sansSemi }}>Fermé ce jour-là : choisis un autre jour ou une autre étape.</Text> : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Action main icon="navigate" label="Y aller" disabled={!place} onPress={go} />
        {placeId != null ? <Pop on={isFav} style={{ flex: 1 }}><Action icon="heart" filled={isFav} label={isFav ? 'Favori ✓' : 'Favori'} onPress={() => { void fav.toggle(placeId); }} /></Pop> : null}
        <Action icon="external" label="Maps" disabled={!mapsUrl} onPress={() => { if (mapsUrl) void Linking.openURL(mapsUrl); }} />
        {site ? <Action icon="link" label="Site" onPress={() => void Linking.openURL(site)} />
          : tel ? <Action icon="call" label="Appeler" onPress={() => void Linking.openURL(tel)} />
            : <Action icon="link" label="Site" disabled onPress={() => {}} />}
      </View>
      {trip && from ? <Text variant="muted" style={{ fontSize: 12.5 }}>Y aller : ≈ {formatDuration(trip.minutes)} {trip.mode === 'walk' ? 'à pied' : trip.mode === 'bike' ? 'à vélo' : trip.mode === 'transit' ? 'en transports' : 'en voiture'} depuis {from.name}</Text> : null}
      {primary ? <Button label={primary.label} loading={primary.busy} onPress={primary.onPress} /> : null}
      {note ? <Text variant="muted" style={{ fontSize: 12.5 }}>{note}</Text> : null}
      {onRemove ? <Button label="Retirer du jour" variant="ghost" onPress={() => { onRemove(); onClose(); }} /> : null}
      {info.text ? (
        <View style={{ gap: 2 }}>
          <Text variant="body">{info.text}</Text>
          {info.source === 'wikipedia' ? <Text variant="muted" style={{ fontSize: 12 }}>Source : Wikipédia (CC BY-SA)</Text> : null}
        </View>
      ) : null}
      {duration || price != null || info.address ? (
        <View>
          {duration ? <Row k="Durée de visite" v={`≈ ${duration}`} /> : null}
          {price != null ? <Row k={travelers > 1 ? `Entrée estimée (× ${travelers})` : 'Entrée estimée'} v={price === 0 ? 'Gratuit' : `≈ ${formatMoney(price * travelers, currency)}`} /> : null}
          {info.address ? <Row k="Adresse" v={info.address} /> : null}
        </View>
      ) : null}
      {price != null && price > 0 ? (
        due > 0 && onPay ? (
          <View style={{ gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface2 }}>
            <Row k="À payer" v={`≈ ${formatMoney(due, currency)}`} bare />
            {travelers > 1 ? <Text variant="muted">À partager entre {travelers} voyageurs.</Text> : null}
            <Button label="Marquer payé" loading={paying} onPress={async () => { setPaying(true); setPayError(await onPay()); setPaying(false); }} />
            <ErrorNote message={payError} />
          </View>
        ) : <Row k="Paiement" v={`Payé · ${formatMoney(price * travelers, currency)}`} />
      ) : null}
      {week ? (
        <View style={{ gap: space.xs }}>
          <Text variant="label">Horaires</Text>
          {week.map((l) => (
            <View key={l.day} style={{ flexDirection: 'row', gap: space.md }}>
              <RNText style={{ width: 40, fontFamily: l.weekday === today ? fonts.sansBold : fonts.sans, fontSize: 13.5, color: l.weekday === today ? colors.text : colors.text2 }}>{l.day}</RNText>
              <RNText style={{ flex: 1, fontFamily: l.weekday === today ? fonts.sansBold : fonts.sans, fontSize: 13.5, color: l.weekday === today ? colors.text : colors.text2 }}>{l.text}</RNText>
            </View>
          ))}
        </View>
      ) : info.loading ? null : (
        <View style={{ gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface2 }}>
          <Text variant="label">Horaires non renseignés</Text>
          <Text variant="muted">Les horaires, avis et photos de ce lieu sont sur Google Maps.</Text>
          {mapsUrl ? <Button label="Voir horaires et avis sur Google Maps" icon="external" variant="ghost" onPress={() => void Linking.openURL(mapsUrl)} /> : null}
        </View>
      )}
      <Text variant="muted" style={{ fontSize: 12.5 }}>Durées, prix et horaires : valeurs indicatives, à vérifier avant d'y aller.</Text>
    </ScrollView>
  );
}

function Action({ icon, label, onPress, main, filled, disabled }: { icon: IconName; label: string; onPress: () => void; main?: boolean; filled?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ flex: 1, minHeight: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 2, opacity: disabled ? 0.4 : 1,
        backgroundColor: main ? colors.accent : colors.surface2, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
      <Icon name={icon} size={20} tone={main ? 'onAccent' : 'text'} filled={filled} />
      <RNText numberOfLines={1} style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: main ? colors.onAccent : colors.text }}>{label}</RNText>
    </Pressable>
  );
}

function Row({ k, v, bare }: { k: string; v: string; bare?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: bare ? 0 : space.sm, borderTopWidth: bare ? 0 : 1, borderTopColor: colors.line }}>
      <RNText style={{ fontFamily: fonts.sans, fontSize: 15, color: colors.text2 }}>{k}</RNText>
      <RNText style={{ flexShrink: 1, textAlign: 'right', fontFamily: fonts.sansSemi, fontSize: 15, color: colors.text }}>{v}</RNText>
    </View>
  );
}

/** Fiche en grand par-dessus l'écran (depuis une étape de l'onglet Jour). */
export function PlaceSheet(props: PlaceDetailsProps & { visible: boolean }) {
  const { colors } = useTheme();
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <Pressable accessibilityLabel="Fermer la fiche" onPress={props.onClose} style={{ flex: 1, backgroundColor: 'rgba(3, 5, 6, 0.6)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', width: '100%', maxWidth: 560, alignSelf: 'center', paddingTop: space.sm }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: space.sm }} />
          <PlaceDetails {...props} expanded />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

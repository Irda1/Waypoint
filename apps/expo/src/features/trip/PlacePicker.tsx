import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { Button, Chip, ErrorNote, Field, Text } from '../../ui';
import { glyphFor } from '../../theme/categoryIcons';
import { useTheme } from '../../theme/useTheme';
import { categoryColors, fonts, space } from '../../theme/tokens';
import { formatMoney } from '../../lib/format';
import { formatDuration } from '../../lib/search';
import { rankCities, titleWords } from '../../lib/cities';
import { useCategories } from '../../data/categories';
import { addPlaceItem, listCities, requestCityCollection, searchPlaces, setDayCity } from '../../data/places';
import type { CityOption, PlaceHit } from '../../data/places';

interface Props {
  tripId: string;
  dayId: string;
  /** Titre du voyage : les villes qu'il cite sont proposées en premier. */
  tripTitle: string;
  /** Destinations du voyage : proposées en premier. */
  destinations: CityOption[];
  /** Ville déjà choisie pour ce jour, si elle existe. */
  defaultCityId: number | null;
  /** Position à donner à la prochaine étape (après la dernière du jour). */
  nextPosition: number;
  /** Lieux déjà présents dans ce jour, pour ne pas les proposer deux fois. */
  existingPlaceIds: Set<number>;
  onAdded: () => void;
  onClose: () => void;
}

export function PlacePicker({ tripId, dayId, tripTitle, destinations, defaultCityId, nextPosition, existingPlaceIds, onAdded, onClose }: Props) {
  const { colors, mode } = useTheme();
  const categories = useCategories();
  const [cities, setCities] = useState<CityOption[] | null>(null);
  const [cityId, setCityId] = useState<number | null>(null);
  const [selected, setSelected] = useState<CityOption | null>(null);
  const [cityQuery, setCityQuery] = useState('');
  const [text, setText] = useState('');
  const [root, setRoot] = useState<string | null>(null);
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [requesting, setRequesting] = useState(false);
  const run = useRef(0);
  const destKey = destinations.map((d) => d.id).join(',');

  // Villes : celles du voyage d'abord ; le champ « Autre ville » cherche dans toute la base.
  useEffect(() => {
    let alive = true;
    const id = setTimeout(() => {
      void listCities({ words: titleWords(tripTitle), query: cityQuery }).then((res) => {
        if (!alive) return;
        const merged = cityQuery ? res.cities : [...destinations, ...res.cities.filter((c) => !destinations.some((d) => d.id === c.id))];
        const ranked = cityQuery ? merged : rankCities(merged, { title: tripTitle, preferredId: defaultCityId, priorityIds: destinations.map((d) => d.id) });
        setCities(ranked);
        setError(res.error);
        setCityId((current) => current ?? ranked[0]?.id ?? null);
      });
    }, cityQuery ? 250 : 0);
    return () => { alive = false; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `destinations` est suivi par son contenu (destKey), pas par son identité
  }, [tripTitle, defaultCityId, cityQuery, destKey]);

  const city = cities?.find((c) => c.id === cityId) ?? (selected && selected.id === cityId ? selected : null);
  // La ville choisie reste visible même quand la recherche de ville la fait sortir de la liste.
  const chips = cities === null ? null : selected && !cities.some((c) => c.id === selected.id) ? [selected, ...cities] : cities;
  const ready = city?.collection_status === 'ready';

  // Recherche avec un léger délai pendant la saisie ; les réponses arrivées en retard sont ignorées.
  useEffect(() => {
    if (cityId == null || !ready) { setHits(null); return; }
    const ticket = ++run.current;
    const id = setTimeout(async () => {
      const res = await searchPlaces({ cityId, text, categories: root ? categories.familyOf(root) : null, kind: root === 'pratique' ? 'service' : 'activity' });
      if (ticket !== run.current) return;
      setHits(res.places);
      setError(res.error);
    }, 250);
    return () => clearTimeout(id);
  }, [cityId, ready, text, root, categories]);

  async function add(place: PlaceHit) {
    setBusyId(place.id);
    setNotice(null);
    const err = await addPlaceItem({ tripId, dayId, placeId: place.id, position: nextPosition });
    setBusyId(null);
    if (err) { setError(err); return; }
    setError(null);
    setNotice(`« ${place.name} » ajouté au jour.`);
    if (city && city.id !== defaultCityId) await setDayCity(dayId, city.id);
    onAdded();
  }

  async function collect() {
    if (!city) return;
    setRequesting(true);
    const res = await requestCityCollection(city.id);
    setRequesting(false);
    if (res.error) { setError(res.error); return; }
    setError(null);
    const status = (res.status ?? 'queued') as CityOption['collection_status'];
    setCities((list) => (list ?? []).map((c) => (c.id === city.id ? { ...c, collection_status: status } : c)));
    setNotice('Demande enregistrée. Les lieux apparaissent après le prochain passage de la collecte.');
  }

  const anyEstimate = (hits ?? []).some((h) => h.duration_is_estimate || (h.price_amount != null && h.price_is_estimate));

  return (
    <View style={{ gap: space.md }}>
      <Text variant="label">Ville</Text>
      {chips === null ? <Text variant="muted">Chargement des villes…</Text> : chips.length === 0 ? (
        <Text variant="muted">{cityQuery ? 'Aucune ville ne correspond.' : 'Aucune ville en base. Lance d\'abord la collecte des villes (voir le guide).'}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {chips.map((c) => (
            <Chip key={c.id} label={`${c.name} · ${c.country_code}`} selected={c.id === cityId}
              onPress={() => { setCityId(c.id); setSelected(c); setHits(null); setNotice(null); }} />
          ))}
        </ScrollView>
      )}
      <Field label="Autre ville" value={cityQuery} onChangeText={setCityQuery} placeholder="Ex. Coimbra, Kyoto…" autoCorrect={false} />

      {city && !ready ? (
        <View style={{ gap: space.sm }}>
          <Text variant="muted">
            {city.collection_status === 'queued' || city.collection_status === 'collecting'
              ? `Les lieux de ${city.name} sont en cours de collecte. Reviens dans quelques heures.`
              : `Les lieux de ${city.name} n'ont pas encore été collectés.`}
          </Text>
          {city.collection_status === 'empty' || city.collection_status === 'failed' ? (
            <Button label={`Demander les lieux de ${city.name}`} onPress={collect} loading={requesting} />
          ) : null}
        </View>
      ) : null}

      {ready ? (
        <>
          <Field label="Rechercher un lieu" value={text} onChangeText={setText} placeholder="Ex. musée, marché, atelier…" autoCorrect={false} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            <Chip label="Tout" selected={root === null} onPress={() => setRoot(null)} />
            {categories.activityRoots.map((c) => <Chip key={c.code} label={c.name_fr} selected={root === c.code} onPress={() => setRoot(root === c.code ? null : c.code)} />)}
            {categories.byCode.has('pratique') ? <Chip label="Pratique" selected={root === 'pratique'} onPress={() => setRoot(root === 'pratique' ? null : 'pratique')} /> : null}
          </ScrollView>

          {hits === null ? <Text variant="muted">Recherche…</Text> : hits.length === 0 ? (
            <Text variant="muted">Aucun lieu ne correspond. Essaie un autre mot ou une autre catégorie.</Text>
          ) : hits.map((h) => {
            const already = existingPlaceIds.has(h.id);
            const category = categories.byCode.get(h.category_code)?.name_fr ?? h.category_code;
            const dot = categoryColors[mode][categories.rootOf(h.category_code)] ?? colors.text3;
            const details = [
              category,
              h.visit_duration_min ? `${h.duration_is_estimate ? '≈ ' : ''}${formatDuration(h.visit_duration_min)}` : null,
              h.price_amount != null ? `${h.price_is_estimate ? '≈ ' : ''}${formatMoney(h.price_amount, h.price_currency ?? 'EUR')}` : null,
            ].filter(Boolean).join(' · ');
            return (
              <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs }}>
                <View accessible={false} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${dot}33`, alignItems: 'center', justifyContent: 'center' }}>
                  <RNText style={{ fontSize: 17 }}>{glyphFor(categories.rootOf(h.category_code))}</RNText>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{h.name}</Text>
                  <Text variant="muted">{details}</Text>
                </View>
                {already ? <Text variant="muted">Déjà ajouté</Text> : (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Ajouter ${h.name}`} disabled={busyId === h.id} onPress={() => add(h)}
                    style={{ minHeight: 44, minWidth: 44, paddingHorizontal: space.md, borderRadius: 999, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.accent, opacity: busyId === h.id ? 0.5 : 1 }}>
                    <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.onAccent }}>Ajouter</RNText>
                  </Pressable>
                )}
              </View>
            );
          })}
          {anyEstimate ? <Text variant="muted">≈ : valeur estimée d'après la catégorie, à vérifier avant d'y aller.</Text> : null}
          <Text variant="muted" style={{ fontSize: 12 }}>Données de lieux : © contributeurs d'OpenStreetMap (licence ODbL).</Text>
        </>
      ) : null}

      {notice ? <Text variant="muted" style={{ color: colors.accent }} accessibilityLiveRegion="polite">{notice}</Text> : null}
      <ErrorNote message={error} />
      <Button label="Fermer" variant="ghost" onPress={onClose} />
      <View style={{ height: 96 }} />
    </View>
  );
}

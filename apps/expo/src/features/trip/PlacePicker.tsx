import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { Button, Chip, ErrorNote, Field, Text } from '../../ui';
import { iconFor } from '../../theme/categoryIcons';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../theme/useTheme';
import { categoryColors, fonts, space } from '../../theme/tokens';
import { formatMoney } from '../../lib/format';
import { formatDuration } from '../../lib/search';
import { rankCities, titleWords } from '../../lib/cities';
import { useCategories } from '../../data/categories';
import { addPlaceItem, listCities, searchPlaces, setDayCity } from '../../data/places';
import { collectCityNow } from '../../data/cityCollection';
import { cityPoint, expandShortLink, guessCategory, saveExternalPlace, searchOsm } from '../../data/addPlace';
import { MAX_KM, kmBetween, parseGoogleMapsLink } from '../../domain/addPlace.ts';
import type { ExternalPlace } from '../../domain/addPlace.ts';
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
  const [percent, setPercent] = useState<number | null>(null);
  const [otherCity, setOtherCity] = useState(false);
  // Lieux qui manquent dans Waypoint : suggestions OpenStreetMap et lien Google Maps collé dans la recherche.
  const [osm, setOsm] = useState<ExternalPlace[]>([]);
  const [linked, setLinked] = useState<{ place: ExternalPlace | null; message: string | null } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const run = useRef(0);
  const runOsm = useRef(0);
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

  const link = parseGoogleMapsLink(text);

  // Recherche avec un léger délai pendant la saisie ; les réponses arrivées en retard sont ignorées.
  useEffect(() => {
    if (cityId == null || !ready || link) { setHits(null); return; }
    const ticket = ++run.current;
    const id = setTimeout(async () => {
      const res = await searchPlaces({ cityId, text, categories: root ? categories.familyOf(root) : null, kind: root === 'pratique' ? 'service' : 'activity' });
      if (ticket !== run.current) return;
      setHits(res.places);
      setError(res.error);
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `link` découle de `text`
  }, [cityId, ready, text, root, categories]);

  // Suggestions OpenStreetMap (Photon) : dès 3 lettres, une fois la saisie arrêtée.
  useEffect(() => {
    const ticket = ++runOsm.current;
    setOsm([]);
    if (cityId == null || !ready || link || text.trim().length < 3) return;
    const id = setTimeout(async () => {
      const point = await cityPoint(cityId);
      const found = point ? await searchOsm(text.trim(), point) : [];
      if (ticket === runOsm.current) setOsm(found);
    }, 450);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `link` découle de `text`
  }, [cityId, ready, text]);

  // Lien Google Maps collé : on lit le nom et la position, on devine le type de lieu.
  useEffect(() => {
    let alive = true;
    if (!link || cityId == null) { setLinked(null); return; }
    setLinked({ place: null, message: null });
    void (async () => {
      let parsed = link;
      if (parsed.kind === 'short') {
        const full = await expandShortLink(parsed.url);
        parsed = (full && parseGoogleMapsLink(full)) || { kind: 'unreadable' };
        if (parsed.kind === 'short') parsed = { kind: 'unreadable' };
      }
      const point = await cityPoint(cityId);
      if (!alive) return;
      if (parsed.kind !== 'place') {
        setLinked({ place: null, message: link.kind === 'short'
          ? 'Impossible de lire ce lien court ici. Ouvre-le, puis copie l\'adresse complète de la page Google Maps.'
          : 'Ce lien ne donne pas la position du lieu. Ouvre le lieu dans Google Maps, puis copie l\'adresse de la page.' });
        return;
      }
      const km = point ? kmBetween(point.lat, point.lng, parsed.lat, parsed.lng) : 0;
      if (km > MAX_KM) { setLinked({ place: null, message: `Ce lieu est à plus de ${MAX_KM} km de ${city?.name ?? 'la ville'} : choisis d'abord la bonne ville.` }); return; }
      const category = await guessCategory(parsed.name, parsed.lat, parsed.lng);
      if (alive) setLinked({ place: { name: parsed.name, lat: parsed.lat, lng: parsed.lng, category, address: null, km, source: 'google_maps', osm_type: null, osm_id: null }, message: null });
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `link` découle de `text`
  }, [text, cityId]);

  async function add(place: { id: number; name: string }) {
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

  const keyOf = (p: ExternalPlace) => (p.osm_id ? `${p.osm_type}${p.osm_id}` : `${p.name}@${p.lat},${p.lng}`);

  async function addExternal(p: ExternalPlace) {
    if (!city) return;
    const key = keyOf(p);
    setBusyKey(key);
    const saved = await saveExternalPlace(city.id, p);
    if (saved.id == null) { setBusyKey(null); setError(saved.error); return; }
    if (!existingPlaceIds.has(saved.id)) await add({ id: saved.id, name: p.name });
    setBusyKey(null);
    setAddedKeys((s) => new Set(s).add(key));
  }

  async function collect() {
    if (!city) return;
    setRequesting(true);
    setPercent(0);
    const res = await collectCityNow(city.id, (f) => setPercent(Math.round(f * 100)));
    setRequesting(false);
    setPercent(null);
    if (res.outcome === 'failed') { setError(res.error ?? 'Collecte impossible pour le moment.'); return; }
    setError(null);
    const status: CityOption['collection_status'] = res.outcome === 'ready' ? 'ready' : res.outcome === 'busy' ? 'collecting' : 'queued';
    setCities((list) => (list ?? []).map((c) => (c.id === city.id ? { ...c, collection_status: status } : c)));
    setNotice(res.outcome === 'ready' ? `Les lieux de ${city.name} sont chargés.`
      : res.outcome === 'busy' ? 'Quelqu\'un est déjà en train de charger cette ville : réessaie dans un instant.'
      : 'Le chargement direct n\'a pas abouti : la demande est enregistrée, les lieux arriveront au prochain passage de la collecte.');
  }

  const anyEstimate = (hits ?? []).some((h) => h.duration_is_estimate || (h.price_amount != null && h.price_is_estimate));
  // Suggestions OpenStreetMap filtrées comme la recherche (catégorie choisie ; activités seulement hors « Pratique »),
  // sans répéter un lieu déjà trouvé dans Waypoint.
  const known = new Set((hits ?? []).map((h) => h.name.toLowerCase()));
  const extra = osm.filter((p) => !known.has(p.name.toLowerCase())
    && (root ? categories.familyOf(root).includes(p.category) : categories.byCode.get(p.category)?.kind === 'activity'));

  const externalRow = (p: ExternalPlace) => {
    const r0 = categories.rootOf(p.category);
    const dot = categoryColors[mode][r0] ?? colors.text3;
    const key = keyOf(p);
    const details = [categories.byCode.get(p.category)?.name_fr ?? p.category, p.address, `${p.km < 10 ? p.km.toFixed(1).replace('.', ',') : Math.round(p.km)} km`].filter(Boolean).join(' · ');
    return (
      <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs }}>
        <View accessible={false} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${dot}33`, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={iconFor(r0)} size={17} color={dot} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{p.name}</Text>
          <Text variant="muted">{details}{p.source === 'google_maps' ? <RNText style={{ fontFamily: fonts.sansSemi, color: colors.accent }}> · Google Maps</RNText> : null}</Text>
        </View>
        {addedKeys.has(key) ? <Text variant="muted">Déjà ajouté</Text> : (
          <Pressable accessibilityRole="button" accessibilityLabel={`Ajouter ${p.name}`} disabled={busyKey === key} onPress={() => addExternal(p)}
            style={{ minHeight: 44, minWidth: 44, paddingHorizontal: space.md, borderRadius: 999, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.accent, opacity: busyKey === key ? 0.5 : 1 }}>
            <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.onAccent }}>Ajouter</RNText>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={{ gap: space.md }}>
      <Text variant="label">Ville</Text>
      {chips === null ? <Text variant="muted">Chargement des villes…</Text> : chips.length === 0 ? (
        <Text variant="muted">{cityQuery ? 'Aucune ville ne correspond.' : 'Aucune ville en base. Lance d\'abord la collecte des villes (voir le guide).'}</Text>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {(chips ?? []).map((c) => (
          <Chip key={c.id} label={`${c.name} · ${c.country_code}`} selected={c.id === cityId}
            onPress={() => { setCityId(c.id); setSelected(c); setHits(null); setNotice(null); }} />
        ))}
        <Chip label="+ Autre ville" selected={otherCity} onPress={() => { if (otherCity) setCityQuery(''); setOtherCity(!otherCity); }} />
      </ScrollView>
      {otherCity ? <Field label="Autre ville" value={cityQuery} onChangeText={setCityQuery} placeholder="Ex. Coimbra, Kyoto…" autoCorrect={false} autoFocus /> : null}

      {city && !ready ? (
        <View style={{ gap: space.sm }}>
          <Text variant="muted">
            {city.collection_status === 'queued' || city.collection_status === 'collecting'
              ? `Les lieux de ${city.name} sont en cours de collecte. Reviens dans un instant, ou relance le chargement.`
              : `Les lieux de ${city.name} ne sont pas encore chargés. Cela prend quelques secondes.`}
          </Text>
          <Button label={requesting && percent != null ? `Chargement… ${percent} %` : `Charger les lieux de ${city.name}`} onPress={collect} loading={requesting} />
        </View>
      ) : null}

      {ready ? (
        <>
          <Field label="Rechercher un lieu" value={text} onChangeText={setText} placeholder="Nom du lieu, ou lien Google Maps" autoCorrect={false} autoCapitalize="none" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            <Chip label="Tout" selected={root === null} onPress={() => setRoot(null)} />
            {categories.activityRoots.map((c) => <Chip key={c.code} label={c.name_fr} selected={root === c.code} onPress={() => setRoot(root === c.code ? null : c.code)} />)}
            {categories.byCode.has('pratique') ? <Chip label="Pratique" selected={root === 'pratique'} onPress={() => setRoot(root === 'pratique' ? null : 'pratique')} /> : null}
          </ScrollView>

          {link ? (
            linked?.place ? externalRow(linked.place) : <Text variant="muted">{linked?.message ?? 'Lecture du lien…'}</Text>
          ) : hits === null ? <Text variant="muted">Recherche…</Text> : hits.length === 0 && extra.length === 0 ? (
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
                  <Icon name={iconFor(categories.rootOf(h.category_code))} size={17} color={dot} />
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
          {link ? null : extra.map(externalRow)}
          {link ? null : <Text variant="muted">Astuce : tu peux aussi coller ici le lien d'un lieu Google Maps.</Text>}
          {anyEstimate ? <Text variant="muted">≈ : valeur estimée d'après la catégorie, à vérifier avant d'y aller.</Text> : null}
          <Text variant="muted" style={{ fontSize: 12 }}>Données de lieux : © contributeurs d'OpenStreetMap (licence ODbL) · Powered by Geoapify · Photon.</Text>
        </>
      ) : null}

      {notice ? <Text variant="muted" style={{ color: colors.accent }} accessibilityLiveRegion="polite">{notice}</Text> : null}
      <ErrorNote message={error} />
      <Button label="Fermer" variant="ghost" onPress={onClose} />
      <View style={{ height: 96 }} />
    </View>
  );
}

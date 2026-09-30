import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { Button, Card, Chip, ErrorNote, Field, Text } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';
import { daysForStay, nightsByStay, nightsChange, toggleNight } from '../../domain/stays.ts';
import { addStay, removeStay, setStayNights } from '../../data/stays';
import { searchPlaces } from '../../data/places';
import type { PlaceHit } from '../../data/places';
import type { TripData } from '../../data/useTrip';
import { addExpense } from '../../data/trips';
import { parseAmount, formatMoney } from '../../lib/format';
import { shortDate } from '../../lib/dates.ts';

/** Hébergements du voyage : on choisit un lieu de la base (hôtels, auberges…) et il est rattaché aux jours de sa ville. */
export function StayCard({ data, userId, onChanged }: { data: TripData; userId: string | null; onChanged: () => void }) {
  const { colors } = useTheme();
  const [choosing, setChoosing] = useState(false);
  const [cityId, setCityId] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState<number | string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cities = data.destinations;
  const city = cities.find((c) => c.city_id === cityId) ?? cities[0];
  const nights = nightsByStay(data.days);
  const paid = (id: string): string | null => {
    const total = data.expenses.filter((e) => e.stay_id === id).reduce((n, e) => n + Number(e.amount), 0);
    return total > 0 ? `payé ${formatMoney(total, data.trip.currency)}` : null;
  };

  useEffect(() => {
    if (!choosing || !city || city.collection_status !== 'ready') { setHits(null); return; }
    let alive = true;
    const id = setTimeout(async () => {
      const res = await searchPlaces({ cityId: city.city_id, text, categories: null, kind: 'lodging' });
      if (!alive) return;
      setHits(res.places);
      setError(res.error);
    }, 250);
    return () => { alive = false; clearTimeout(id); };
  }, [choosing, city?.city_id, city?.collection_status, text]); // eslint-disable-line react-hooks/exhaustive-deps -- suivi par contenu

  async function pick(place: PlaceHit) {
    if (!city) return;
    setBusy(place.id);
    const err = await addStay({ tripId: data.trip.id, place, cityId: city.city_id, dayIds: daysForStay(data.days, city.city_id, cities.length) });
    setBusy(null);
    setError(err);
    if (!err) { setChoosing(false); setText(''); onChanged(); }
  }

  async function toggle(stayId: string, dayId: string) {
    setBusy(dayId);
    setError(await setStayNights(stayId, nightsChange(data.days, stayId, toggleNight(data.days, stayId, dayId))));
    setBusy(null);
    onChanged();
  }

  async function pay(stay: { id: string; name: string }) {
    const value = parseAmount(amount);
    if (value == null || !userId) { setError('Montant invalide (ex. 240).'); return; }
    setBusy(stay.id);
    const err = await addExpense({ tripId: data.trip.id, label: `Hébergement : ${stay.name}`, poste: 'hebergement', amount: value, currency: data.trip.currency, paidBy: userId, stayId: stay.id });
    setBusy(null);
    setError(err);
    if (!err) { setPaying(null); setAmount(''); onChanged(); }
  }

  async function remove(id: string) {
    setBusy(id);
    setError(await removeStay(id));
    setBusy(null);
    onChanged();
  }

  return (
    <Card>
      <Text variant="label">Hébergement</Text>
      {data.stays.length === 0 && !choosing ? (
        <Text variant="muted">Aucun hébergement : ajoute-en un pour voir les trajets depuis et vers l'hébergement dans chaque journée.</Text>
      ) : null}
      {data.stays.map((s) => (
        <View key={s.id} style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{s.name}</Text>
              <Text variant="muted">{[s.address, paid(s.id), nights.get(s.id) ? `${nights.get(s.id)} nuit${nights.get(s.id)! > 1 ? 's' : ''}` : 'aucune nuit rattachée'].filter(Boolean).join(' · ')}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Payer ${s.name}`} onPress={() => { setPaying(paying === s.id ? null : s.id); setError(null); }} style={{ minHeight: 44, justifyContent: 'center' }}>
              <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.accent }}>{paying === s.id ? 'Annuler' : 'Payer'}</RNText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Modifier les nuits de ${s.name}`} onPress={() => setEditing(editing === s.id ? null : s.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.accent }}>{editing === s.id ? 'Fermer' : 'Nuits'}</RNText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${s.name}`} disabled={busy === s.id} onPress={() => remove(s.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.text2 }}>Retirer</RNText>
            </Pressable>
          </View>
          {paying === s.id ? (
            <>
              <Field label={`Montant payé (${data.trip.currency})`} value={amount} onChangeText={setAmount} placeholder="240" keyboardType="decimal-pad" />
              <Button label="Enregistrer le paiement" onPress={() => pay(s)} loading={busy === s.id} />
            </>
          ) : null}
          {editing === s.id ? (
            <>
              <Text variant="muted">Touche les nuits passées ici. Une nuit déjà prise par un autre hébergement lui est retirée.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {data.days.map((d) => {
                  const other = d.stay_id && d.stay_id !== s.id ? data.stays.find((x) => x.id === d.stay_id) : null;
                  return <Chip key={d.id} label={`${shortDate(d.day_date)}${other ? ` · ${other.name}` : ''}`} selected={d.stay_id === s.id} onPress={() => toggle(s.id, d.id)} />;
                })}
              </View>
            </>
          ) : null}
        </View>
      ))}
      {choosing ? (
        cities.length === 0 ? <Text variant="muted">Choisis d'abord une destination.</Text> : (
          <>
            {cities.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                {cities.map((c) => <Chip key={c.city_id} label={c.name} selected={c.city_id === city?.city_id} onPress={() => setCityId(c.city_id)} />)}
              </ScrollView>
            ) : null}
            {city?.collection_status !== 'ready' ? (
              <Text variant="muted">Les lieux de {city?.name} ne sont pas encore collectés : ouvre « Ajouter un lieu » dans un jour pour lancer la collecte.</Text>
            ) : (
              <>
                <Field label={`Rechercher un hébergement à ${city.name}`} value={text} onChangeText={setText} placeholder="Ex. hôtel, auberge, nom…" autoCorrect={false} />
                {hits === null ? <Text variant="muted">Recherche…</Text> : hits.length === 0 ? <Text variant="muted">Aucun hébergement ne correspond.</Text> : hits.map((h) => (
                  <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{h.name}</Text>
                      {h.address ? <Text variant="muted">{h.address}</Text> : null}
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Choisir ${h.name}`} disabled={busy === h.id} onPress={() => pick(h)}
                      style={{ minHeight: 44, paddingHorizontal: space.md, borderRadius: 999, justifyContent: 'center', backgroundColor: colors.accent, opacity: busy === h.id ? 0.5 : 1 }}>
                      <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: colors.onAccent }}>Choisir</RNText>
                    </Pressable>
                  </View>
                ))}
                <Text variant="muted" style={{ fontSize: 12 }}>Données de lieux : © contributeurs d'OpenStreetMap (licence ODbL).</Text>
              </>
            )}
          </>
        )
      ) : null}
      <ErrorNote message={error} />
      <Button label={choosing ? 'Fermer' : 'Ajouter un hébergement'} variant="ghost" onPress={() => { setChoosing((v) => !v); setError(null); }} />
    </Card>
  );
}

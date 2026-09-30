import React, { useEffect, useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { Button, Card, Chip, ErrorNote, Field, Text } from '../../ui';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';
import { listCities } from '../../data/places';
import type { CityOption } from '../../data/places';
import { saveDestinations } from '../../data/trips';
import { addCity, moveCity, nightDetail, removeCity, shiftNights, totalNights } from '../../domain/destinations.ts';
import type { Dest } from '../../domain/destinations.ts';
import { addDays, shortDate } from '../../lib/dates.ts';
import type { TripData } from '../../data/useTrip';
import { DragRow } from './DragRow';

const PAGE = 5;

/** Villes du voyage : ordre (glisser ou flèches), nuits (+/−), détail des nuits, ajout depuis une liste de villes du pays. */
export function DestinationsCard({ data, onChanged }: { data: TripData; onChanged: () => void }) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [pool, setPool] = useState<CityOption[]>([]);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<CityOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dests: Dest[] = [...data.destinations].sort((a, b) => a.position - b.position).map((d) => ({ id: d.city_id, name: d.name, nights: d.nights }));
  const dates = data.days.map((d) => d.day_date);
  const nights = totalNights(data.days.length);
  const country = data.trip.country_code ?? data.destinations[0]?.country_code ?? null;

  // Les villes du pays du voyage, les plus peuplées d'abord.
  useEffect(() => {
    if (!adding) return;
    let alive = true;
    void listCities({ country, limit: 40 }).then((r) => { if (alive) { setPool(r.cities); if (r.error) setError(r.error); } });
    return () => { alive = false; };
  }, [adding, country]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setFound(null); return; }
    let alive = true;
    const id = setTimeout(() => { void listCities({ query: term }).then((r) => { if (alive) setFound(r.cities); }); }, 250);
    return () => { alive = false; clearTimeout(id); };
  }, [query]);

  async function apply(next: Dest[]) {
    setBusy(true);
    const err = await saveDestinations(data.trip.id, next, data.days.map((d) => d.id));
    setBusy(false);
    setError(err);
    onChanged();
  }

  const chosen = new Set(dests.map((d) => d.id));
  const proposals = (found ?? pool).filter((c) => !chosen.has(c.id));
  const visible = found ? proposals : proposals.slice(0, shown);
  const detail = nightDetail(dests, dates, (iso) => addDays(iso, 1));

  return (
    <Card>
      <Text variant="label">Destinations · {nights} nuit{nights > 1 ? 's' : ''}</Text>
      {dests.length === 0 ? <Text variant="muted">Aucune destination choisie : ajoutes-en pour retrouver directement les bonnes villes dans la recherche de lieux.</Text> : null}
      {dests.map((d, index) => (
        <DragRow key={d.id} index={index} onMove={(from, to) => { if (editing) void apply(moveCity(dests, from, to)); }}>
          <View style={{ gap: space.xs, paddingVertical: space.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 }}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === d.id }} accessibilityLabel={`Détail des nuits à ${d.name}`} onPress={() => setOpen(open === d.id ? null : d.id)} style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}>
                <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{index + 1}. {d.name}</Text>
                <Text variant="muted">{d.nights} nuit{d.nights > 1 ? 's' : ''} {open === d.id ? '▴' : '▾'}</Text>
              </Pressable>
              {editing ? (
                <>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Une nuit de moins à ${d.name}`} disabled={busy || dests.length < 2} onPress={() => void apply(shiftNights(dests, index, -1))} style={{ minWidth: 40, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
                    <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 20, color: colors.accent }}>−</RNText>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Une nuit de plus à ${d.name}`} disabled={busy || dests.length < 2} onPress={() => void apply(shiftNights(dests, index, 1))} style={{ minWidth: 40, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
                    <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 20, color: colors.accent }}>＋</RNText>
                  </Pressable>
                  {index > 0 ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Monter ${d.name}`} disabled={busy} onPress={() => void apply(moveCity(dests, index, index - 1))} style={{ minWidth: 36, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
                      <RNText style={{ fontSize: 16, color: colors.text2 }}>↑</RNText>
                    </Pressable>
                  ) : null}
                  {index < dests.length - 1 ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Descendre ${d.name}`} disabled={busy} onPress={() => void apply(moveCity(dests, index, index + 1))} style={{ minWidth: 36, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
                      <RNText style={{ fontSize: 16, color: colors.text2 }}>↓</RNText>
                    </Pressable>
                  ) : null}
                  <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${d.name}`} disabled={busy} onPress={() => void apply(removeCity(dests, d.id, nights))} style={{ minWidth: 36, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
                    <RNText style={{ fontSize: 16, color: colors.text3 }}>✕</RNText>
                  </Pressable>
                </>
              ) : null}
            </View>
            {open === d.id ? (
              <View style={{ paddingLeft: space.md, gap: 2 }}>
                {detail[index].nights.length === 0 ? <Text variant="muted">Aucune nuit ici (jour du départ).</Text> : detail[index].nights.map((n, i) => (
                  <Text key={n.from} variant="muted">Nuit {i + 1} : {shortDate(n.from)} → {shortDate(n.to)}</Text>
                ))}
              </View>
            ) : null}
          </View>
        </DragRow>
      ))}
      {editing && adding ? (
        <View style={{ gap: space.sm }}>
          <Field label="Chercher une ville" value={query} onChangeText={setQuery} placeholder="Ex. Porto, Kyoto…" autoCorrect={false} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {visible.map((c) => <Chip key={c.id} label={`${c.name} · ${c.country_code}`} onPress={() => { void apply(addCity(dests, { id: c.id, name: c.name }, nights)); setQuery(''); }} />)}
          </View>
          {!found && proposals.length > shown ? <Button label="Afficher plus de villes" variant="ghost" onPress={() => setShown((n) => n + PAGE)} /> : null}
          {found && visible.length === 0 ? <Text variant="muted">Aucune ville ne correspond.</Text> : null}
        </View>
      ) : null}
      <ErrorNote message={error} />
      {editing ? <Button label={adding ? 'Fermer la liste des villes' : 'Ajouter une ville'} variant="ghost" onPress={() => { setAdding((v) => !v); setShown(PAGE); setQuery(''); }} /> : null}
      <Button label={editing ? 'Terminer' : dests.length ? 'Modifier les destinations' : 'Choisir une destination'} variant="ghost" onPress={() => { setEditing((v) => !v); setAdding(!editing && dests.length === 0); setError(null); }} />
    </Card>
  );
}

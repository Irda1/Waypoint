import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, ErrorNote, Text } from '../../ui';
import { supabase } from '../../lib/supabase';
import { addPlaceItem } from '../../data/places';
import { formatDay } from '../../lib/format';
import { space } from '../../theme/tokens';
import type { TripData } from '../../data/useTrip';

interface Saved { id: number; name: string }

/**
 * « Non prévu » (maquette Escale) : les lieux gardés en favoris qui ne sont dans aucun jour.
 * Toucher un lieu propose les jours où l'ajouter ; il disparaît de la liste une fois planifié.
 */
export function UnplannedCard({ data, onChanged }: { data: TripData; onChanged: () => void }) {
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tripId = data.trip.id;

  const load = useCallback(async () => {
    const { data: rows, error: err } = await supabase.from('saved_places').select('place_id,places(id,name)').eq('trip_id', tripId).eq('list', 'favorite');
    if (err) { setError(err.message); return; }
    type R = { place_id: number; places: { id: number; name: string } | { id: number; name: string }[] | null };
    setSaved(((rows ?? []) as unknown as R[]).flatMap((r) => { const p = Array.isArray(r.places) ? r.places[0] : r.places; return p ? [{ id: p.id, name: p.name }] : []; }));
  }, [tripId]);
  useEffect(() => { void load(); }, [load]);

  const planned = new Set(data.items.map((i) => i.place_id).filter((x): x is number => x != null));
  const unplanned = (saved ?? []).filter((s) => !planned.has(s.id));
  if (!unplanned.length) return null;

  async function addTo(placeId: number, dayId: string) {
    const next = data.items.filter((i) => i.day_id === dayId).reduce((m, i) => Math.max(m, i.position), -1) + 1;
    const err = await addPlaceItem({ tripId, dayId, placeId, position: next });
    setError(err);
    if (!err) { setOpen(null); onChanged(); }
  }
  async function forget(placeId: number) {
    const { error: err } = await supabase.from('saved_places').delete().eq('trip_id', tripId).eq('place_id', placeId).eq('list', 'favorite');
    setError(err?.message ?? null);
    void load();
  }

  return (
    <Card>
      <Text variant="label">Non prévu · {unplanned.length} lieu{unplanned.length > 1 ? 'x' : ''} gardé{unplanned.length > 1 ? 's' : ''}</Text>
      <Text variant="muted">Tes favoris qui ne sont dans aucun jour. Touche un lieu pour choisir le jour.</Text>
      {unplanned.map((s) => (
        <View key={s.id} style={{ gap: space.sm }}>
          <Button label={open === s.id ? `${s.name} · choisis un jour` : s.name} variant="ghost" onPress={() => setOpen(open === s.id ? null : s.id)} />
          {open === s.id ? (
            <View style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {data.days.map((d, i) => <Chip key={d.id} label={`J${i + 1} · ${formatDay(d.day_date)}`} onPress={() => { void addTo(s.id, d.id); }} />)}
              </View>
              <Button label="Retirer des favoris" variant="ghost" onPress={() => { void forget(s.id); }} />
            </View>
          ) : null}
        </View>
      ))}
      <ErrorNote message={error} />
    </Card>
  );
}

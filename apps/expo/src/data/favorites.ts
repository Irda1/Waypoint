// Lieux favoris d'un voyage (table saved_places, liste « favorite »).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useFavorites(tripId: string, enabled = true) {
  const [ids, setIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void supabase.from('saved_places').select('place_id').eq('trip_id', tripId).eq('list', 'favorite').then(({ data, error: err }) => {
      if (!alive) return;
      if (err) { setError(err.message); return; }
      setIds(new Set((data ?? []).map((r) => Number(r.place_id))));
    });
    return () => { alive = false; };
  }, [tripId, enabled]);

  const toggle = useCallback(async (placeId: number) => {
    const on = !ids.has(placeId);
    setIds((cur) => { const next = new Set(cur); if (on) next.add(placeId); else next.delete(placeId); return next; });
    const res = on
      ? await supabase.from('saved_places').insert({ trip_id: tripId, place_id: placeId, list: 'favorite' })
      : await supabase.from('saved_places').delete().eq('trip_id', tripId).eq('place_id', placeId).eq('list', 'favorite');
    if (res.error) {
      setError(res.error.message);
      setIds((cur) => { const next = new Set(cur); if (on) next.delete(placeId); else next.add(placeId); return next; });
    } else setError(null);
  }, [ids, tripId]);

  return { ids, toggle, error };
}

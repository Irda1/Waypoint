// Mode « Simple » : lieux des villes du voyage et nombre de voyageurs du budget.
import { supabase } from '../lib/supabase';
import { withEstimatedPrice } from '../domain/priceEstimate.ts';
import type { SimplePlace } from '../domain/simple.ts';

const PER_CITY = 200;

/** Les lieux à visiter des villes (activités, les plus populaires d'abord), avec un prix estimé quand le vrai manque. */
export async function loadCityPlaces(cityIds: number[]): Promise<{ places: SimplePlace[]; error: string | null }> {
  const results = await Promise.all(cityIds.map((id) =>
    supabase.from('places')
      .select('id,city_id,name,kind,category_code,lat,lng,price_amount,visit_duration_min,closed_days,opening_hours,popularity')
      .eq('city_id', id).eq('kind', 'activity').eq('status', 'active')
      .order('popularity', { ascending: false }).limit(PER_CITY)));
  const places = results.flatMap((r) => ((r.data ?? []) as (SimplePlace & { kind: string })[]).map((p) => withEstimatedPrice(p) as SimplePlace));
  return { places, error: results.find((r) => r.error)?.error?.message ?? null };
}

/** Nombre de personnes pour le budget de la sélection. */
export async function setTravelers(tripId: string, travelers: number): Promise<string | null> {
  const { error } = await supabase.from('trips').update({ travelers: Math.max(1, Math.min(20, travelers)) }).eq('id', tripId);
  return error?.message ?? null;
}

// Programme automatique : lecture des lieux candidats et écriture des étapes dans les jours vides.
import { supabase } from '../lib/supabase';
import { formatTime } from '../domain/planning.ts';
import type { Candidate, PlannedDay } from '../domain/itinerary.ts';
import type { Place } from '../domain/types.ts';

type Row = Place & { city_id: number; popularity: number };

/** Meilleurs lieux d'activité de chaque ville (120 par ville au plus, les plus populaires d'abord). */
export async function loadCandidates(cityIds: number[], rootOf: (code: string) => string): Promise<{ candidates: Candidate[]; error: string | null }> {
  const results = await Promise.all(cityIds.map((id) =>
    supabase.from('places')
      .select('id,city_id,name,kind,category_code,lat,lng,price_amount,visit_duration_min,closed_days,popularity')
      .eq('city_id', id).eq('kind', 'activity').eq('status', 'active')
      .order('popularity', { ascending: false }).limit(120)));
  const candidates = results.flatMap((r) => ((r.data ?? []) as Row[]).map((p) => ({ place: p as Place, cityId: p.city_id, root: rootOf(p.category_code), popularity: p.popularity })));
  return { candidates, error: results.find((r) => r.error)?.error?.message ?? null };
}

/**
 * Écrit le programme proposé. Ne touche jamais à une journée qui contient déjà des étapes :
 * `days` ne doit contenir que des jours vides (voir `emptyDayIds`).
 */
export async function applyPlan(tripId: string, days: { dayId: string; plan: PlannedDay }[]): Promise<string | null> {
  const rows = days.flatMap(({ dayId, plan }) => plan.items.map((i, position) => ({
    trip_id: tripId, day_id: dayId, plan: 'A',
    place_id: i.place?.id ?? null,
    title: i.place ? null : i.title,
    category_code: i.place ? null : i.root,
    start_time: formatTime(i.startMin),
    duration_min: i.place ? null : i.durationMin,
    position: position + 1,
  })));
  if (!rows.length) return null;
  const { error } = await supabase.from('trip_items').insert(rows);
  return error?.message ?? null;
}

/** Donne une heure aux étapes d'un jour. */
export async function applyTimes(changes: { id: string; startMin: number }[]): Promise<string | null> {
  const results = await Promise.all(changes.map((c) => supabase.from('trip_items').update({ start_time: formatTime(c.startMin) }).eq('id', c.id)));
  return results.find((r) => r.error)?.error?.message ?? null;
}

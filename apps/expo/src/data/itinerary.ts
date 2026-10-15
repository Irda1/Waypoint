// Programme automatique : lecture des lieux candidats et écriture des étapes dans les jours vides.
import { supabase } from '../lib/supabase';
import { formatTime } from '../domain/planning.ts';
import type { Candidate, PlannedDay } from '../domain/itinerary.ts';
import type { WizardCity } from '../domain/wizard.ts';
import type { Place } from '../domain/types.ts';

type Row = Place & { city_id: number; popularity: number };

/** Meilleurs lieux d'activité de chaque ville (120 par ville au plus, les plus populaires d'abord). */
export async function loadCandidates(cityIds: number[], rootOf: (code: string) => string): Promise<{ candidates: Candidate[]; error: string | null }> {
  const results = await Promise.all(cityIds.map((id) =>
    supabase.from('places')
      .select('id,city_id,name,kind,category_code,lat,lng,price_amount,visit_duration_min,closed_days,opening_hours,popularity')
      .eq('city_id', id).eq('kind', 'activity').eq('status', 'active')
      .order('popularity', { ascending: false }).limit(120)));
  const candidates = results.flatMap((r) => ((r.data ?? []) as Row[]).map((p) => ({ place: p as Place, cityId: p.city_id, root: rootOf(p.category_code), popularity: p.popularity })));
  return { candidates, error: results.find((r) => r.error)?.error?.message ?? null };
}

/** Ids à collecter pour l'assistant : les villes, puis leurs quartiers à explorer. */
export const wizardCityIds = (cities: WizardCity[]): number[] => [...cities.map((c) => c.id), ...cities.flatMap((c) => (c.quartiers ?? []).map((q) => q.id))];

/** Lieux des villes de l'assistant : ceux des quartiers choisis comptent pour leur ville (un lieu n'apparaît qu'une fois). */
export async function loadWizardCandidates(cities: WizardCity[], rootOf: (code: string) => string): Promise<{ candidates: Candidate[]; error: string | null }> {
  const cityOf = new Map(cities.flatMap((c) => (c.quartiers ?? []).map((q) => [q.id, c.id] as const)));
  const r = await loadCandidates(wizardCityIds(cities), rootOf);
  const seen = new Set<number>();
  const candidates: Candidate[] = [];
  for (const c of r.candidates) if (!seen.has(c.place.id)) { seen.add(c.place.id); candidates.push({ ...c, cityId: cityOf.get(c.cityId) ?? c.cityId }); }
  return { candidates, error: r.error };
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
    note: i.note ?? null,
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

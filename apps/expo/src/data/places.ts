// Recherche de lieux dans la base collectée (lecture publique, voir la migration 0500) et ajout à un jour.
import { supabase } from '../lib/supabase';
import { accentTolerantTerm, likeTerm } from '../lib/search';
import type { Place } from '../domain/types.ts';

export interface CityOption {
  id: number;
  /** Nom affiché (français si connu). */
  name: string;
  /** Tous les noms connus, pour reconnaître la ville dans le titre d'un voyage. */
  names: string[];
  country_code: string;
  collection_status: 'empty' | 'queued' | 'collecting' | 'ready' | 'failed';
}

export interface PlaceHit extends Place {
  address: string | null;
  price_currency: string | null;
  price_is_estimate: boolean;
  duration_is_estimate: boolean;
}

const CITY_COLUMNS = 'id,name,name_fr,name_ascii,country_code,collection_status';
type CityRow = { id: number; name: string; name_fr: string | null; name_ascii: string | null; country_code: string; collection_status: CityOption['collection_status'] };

const toOption = (r: CityRow): CityOption => ({
  id: r.id,
  name: r.name_fr ?? r.name,
  names: [r.name_fr, r.name, r.name_ascii].filter((n): n is string => !!n),
  country_code: r.country_code,
  collection_status: r.collection_status,
});

/**
 * Villes proposables. Sans texte : les plus peuplées, plus celles dont le nom ressemble à un mot du titre du
 * voyage (les cinq premières lettres suffisent : « lisbo » trouve Lisbon, Lisboa et Lisbonne). Avec un texte :
 * les villes dont le nom le contient, sur toute la base.
 */
export async function listCities(opts: { words?: string[]; query?: string } = {}): Promise<{ cities: CityOption[]; error: string | null }> {
  const term = likeTerm(opts.query ?? '');
  const queries = [];
  if (term) {
    queries.push(supabase.from('cities').select(CITY_COLUMNS)
      .or(`name.ilike.%${term}%,name_fr.ilike.%${term}%,name_ascii.ilike.%${term}%`)
      .order('population', { ascending: false, nullsFirst: false }).limit(30));
  } else {
    queries.push(supabase.from('cities').select(CITY_COLUMNS).order('population', { ascending: false, nullsFirst: false }).limit(40));
    const words = (opts.words ?? []).slice(0, 4).map((w) => likeTerm(w.slice(0, 5))).filter(Boolean);
    if (words.length) {
      queries.push(supabase.from('cities').select(CITY_COLUMNS)
        .or(words.map((w) => `name.ilike.%${w}%,name_fr.ilike.%${w}%,name_ascii.ilike.%${w}%`).join(','))
        .order('population', { ascending: false, nullsFirst: false }).limit(30));
    }
  }
  const results = await Promise.all(queries);
  const seen = new Set<number>();
  const cities: CityOption[] = [];
  for (const r of results) for (const row of (r.data ?? []) as CityRow[]) if (!seen.has(row.id)) { seen.add(row.id); cities.push(toOption(row)); }
  return { cities, error: results.find((r) => r.error)?.error?.message ?? null };
}

/** Mémorise la ville d'un jour : elle sera proposée en premier la prochaine fois. */
export async function setDayCity(dayId: string, cityId: number): Promise<string | null> {
  const { error } = await supabase.from('trip_days').update({ city_id: cityId }).eq('id', dayId);
  return error?.message ?? null;
}

export async function searchPlaces(args: { cityId: number; text: string; categories: string[] | null; kind?: 'activity' | 'service' | 'lodging'; limit?: number }): Promise<{ places: PlaceHit[]; error: string | null }> {
  let q = supabase
    .from('places')
    .select('id,name,kind,category_code,lat,lng,price_amount,price_currency,price_is_estimate,visit_duration_min,duration_is_estimate,closed_days,address')
    .eq('city_id', args.cityId)
    .eq('kind', args.kind ?? 'activity')
    .eq('status', 'active');
  const term = accentTolerantTerm(args.text);
  if (term) q = q.ilike('name', `%${term}%`);
  if (args.categories && args.categories.length) q = q.in('category_code', args.categories);
  const { data, error } = await q.order('popularity', { ascending: false }).limit(args.limit ?? 20);
  return { places: (data ?? []) as PlaceHit[], error: error?.message ?? null };
}

export async function addPlaceItem(args: { tripId: string; dayId: string; placeId: number; position: number }): Promise<string | null> {
  const { error } = await supabase.from('trip_items').insert({
    trip_id: args.tripId, day_id: args.dayId, place_id: args.placeId, position: args.position,
  });
  return error?.message ?? null;
}

/** Demande à la collecte de remplir les lieux d'une ville (file d'attente traitée par le pipeline). */
export async function requestCityCollection(cityId: number): Promise<{ status: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('request_city_collection', { p_city: cityId });
  if (error?.code === '54000') return { status: null, error: 'Trop de demandes aujourd\'hui : réessaie demain.' };
  return { status: (data as string | null) ?? null, error: error?.message ?? null };
}

/** Villes d'un pays pour le parcours de création : les villes phares d'abord (rang), puis les plus peuplées. */
export async function listCountryCities(country: string, query = ''): Promise<{ cities: (CityOption & { featured_rank: number | null })[]; error: string | null }> {
  const term = likeTerm(query);
  let q = supabase.from('cities').select(`${CITY_COLUMNS},featured_rank`).eq('country_code', country);
  if (term) q = q.or(`name.ilike.%${term}%,name_fr.ilike.%${term}%,name_ascii.ilike.%${term}%`);
  const { data, error } = await q
    .order('featured_rank', { ascending: true, nullsFirst: false })
    .order('population', { ascending: false, nullsFirst: false })
    .limit(40);
  const rows = (data ?? []) as (CityRow & { featured_rank: number | null })[];
  return { cities: rows.map((r) => ({ ...toOption(r), featured_rank: r.featured_rank })), error: error?.message ?? null };
}

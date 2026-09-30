// Hébergements d'un voyage (table trip_stays) et leur rattachement aux jours (trip_days.stay_id).
import { supabase } from '../lib/supabase';
import type { PlaceHit } from './places';

/** Ajoute l'hébergement (un lieu de la base) et le rattache aux jours donnés. Renvoie un message d'erreur, ou null. */
export async function addStay(args: { tripId: string; place: PlaceHit; cityId: number; dayIds: string[] }): Promise<string | null> {
  const { data, error } = await supabase.from('trip_stays').insert({
    trip_id: args.tripId, city_id: args.cityId, place_id: args.place.id, name: args.place.name, address: args.place.address, lat: args.place.lat, lng: args.place.lng,
  }).select('id').single();
  if (error || !data) return error?.message ?? 'Hébergement non enregistré.';
  if (!args.dayIds.length) return null;
  const { error: linkError } = await supabase.from('trip_days').update({ stay_id: data.id }).in('id', args.dayIds);
  return linkError?.message ?? null;
}

/** Retire l'hébergement et le détache de ses jours. */
export async function removeStay(stayId: string): Promise<string | null> {
  const { error: unlink } = await supabase.from('trip_days').update({ stay_id: null }).eq('stay_id', stayId);
  if (unlink) return unlink.message;
  const { error } = await supabase.from('trip_stays').delete().eq('id', stayId);
  return error?.message ?? null;
}

/** Rattache et libère des nuits (jours) d'un hébergement. */
export async function setStayNights(stayId: string, change: { assign: string[]; release: string[] }): Promise<string | null> {
  if (change.release.length) {
    const { error } = await supabase.from('trip_days').update({ stay_id: null }).in('id', change.release).eq('stay_id', stayId);
    if (error) return error.message;
  }
  if (change.assign.length) {
    const { error } = await supabase.from('trip_days').update({ stay_id: stayId }).in('id', change.assign);
    if (error) return error.message;
  }
  return null;
}

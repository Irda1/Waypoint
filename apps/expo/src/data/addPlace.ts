// Lieux qui manquent dans Waypoint : suggestions OpenStreetMap (Photon, gratuit, sans clé : on n'envoie que le texte tapé
// et la position de la ville), lien Google Maps collé, puis enregistrement par la fonction add_user_place (migration 2500).
import { supabase } from '../lib/supabase';
import { kmBetween, photonPlaces } from '../domain/addPlace.ts';
import type { ExternalPlace } from '../domain/addPlace.ts';

const points = new Map<number, { lat: number; lng: number } | null>();

/** Position d'une ville (gardée le temps de la session). */
export async function cityPoint(cityId: number): Promise<{ lat: number; lng: number } | null> {
  if (points.has(cityId)) return points.get(cityId) ?? null;
  const { data } = await supabase.from('cities').select('lat,lng').eq('id', cityId).maybeSingle();
  const p = (data as { lat: number; lng: number } | null) ?? null;
  points.set(cityId, p);
  return p;
}

/** Lieux OpenStreetMap proches de la ville qui correspondent au texte ; liste vide en cas d'échec. */
export async function searchOsm(text: string, city: { lat: number; lng: number }): Promise<ExternalPlace[]> {
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&lat=${city.lat}&lon=${city.lng}&limit=12&lang=fr`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    return photonPlaces(await res.json(), city);
  } catch { return []; }
}

/** Type le plus probable d'un lieu venu de Google Maps : celui du lieu OpenStreetMap du même nom à moins de 150 m, sinon « culture ». */
export async function guessCategory(name: string, lat: number, lng: number): Promise<string> {
  const near = (await searchOsm(name, { lat, lng })).find((p) => kmBetween(lat, lng, p.lat, p.lng) < 0.15);
  return near?.category ?? 'culture';
}

/** Lien court (maps.app.goo.gl) → adresse complète. Marche dans l'appli ; le navigateur bloque souvent cette lecture. */
export async function expandShortLink(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    return res.url && res.url !== url ? res.url : null;
  } catch { return null; }
}

/** Enregistre le lieu dans Waypoint (ou retrouve celui qui existe déjà) et renvoie son identifiant. */
export async function saveExternalPlace(cityId: number, p: ExternalPlace): Promise<{ id: number | null; error: string | null }> {
  const { data, error } = await supabase.rpc('add_user_place', {
    p_city: cityId, p_name: p.name, p_lat: p.lat, p_lng: p.lng, p_category: p.category, p_source: p.source,
    p_osm_type: p.osm_type, p_osm_id: p.osm_id, p_address: p.address,
  });
  if (error) {
    // Fonction absente : la migration 2500 n'est pas encore passée.
    if (error.code === 'PGRST202' || error.code === '42883') return { id: null, error: 'Ajout de nouveaux lieux pas encore disponible.' };
    return { id: null, error: error.message };
  }
  return { id: data as number, error: null };
}

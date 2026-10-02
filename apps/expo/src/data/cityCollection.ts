// Chargement des lieux d'une ville « à la demande », le plus vite possible.
//
// 1. Ville déjà prête : rien à faire.
// 2. Sinon l'appli prend la main (begin_city_collection), lit OpenStreetMap elle-même (domain/cityCollect.ts : 4 groupes
//    en parallèle, serveurs de secours) et écrit le résultat (ingest_city_places) : quelques secondes à une minute.
// 3. Si ça échoue (réseau, serveurs surchargés) ou si la migration 1600 n'est pas installée (la fonction est alors introuvable), la ville est rendue
//    à la file du robot GitHub (request_city_collection), comme avant.
// 4. Si quelqu'un d'autre est déjà en train de collecter cette ville, on attend qu'elle devienne prête.
import { collectCityPlaces } from '../domain/cityCollect.ts';
import { fractionProgress } from '../domain/collection.ts';
import type { CollectionProgress } from '../domain/collection.ts';
import { supabase } from '../lib/supabase';
import { cityCollectionStatuses, requestCityCollection } from './places';

export type CollectOutcome = 'ready' | 'queued' | 'busy' | 'failed';

/** Collecte une ville maintenant. `onFraction` reçoit un avancement de 0 à 1. */
export async function collectCityNow(cityId: number, onFraction?: (f: number) => void): Promise<{ outcome: CollectOutcome; error: string | null }> {
  const begin = await supabase.rpc('begin_city_collection', { p_city: cityId });
  if (begin.error) {
    if (begin.error.code === '54000') return { outcome: 'failed', error: 'Trop de demandes aujourd\'hui : réessaie demain.' };
    const queued = await requestCityCollection(cityId);
    return { outcome: queued.error ? 'failed' : 'queued', error: queued.error };
  }
  const state = begin.data as string;
  if (state === 'ready') { onFraction?.(1); return { outcome: 'ready', error: null }; }
  if (state === 'busy') return { outcome: 'busy', error: null };

  onFraction?.(0.05);
  try {
    const { data: city, error } = await supabase.from('cities').select('id,lat,lng,population').eq('id', cityId).maybeSingle();
    if (error || !city) throw new Error(error?.message ?? 'ville introuvable');
    const { rows } = await collectCityPlaces(city as { id: number; lat: number; lng: number; population: number | null }, {
      onGroup: (done, total) => onFraction?.(0.05 + 0.85 * (done / total)),
    });
    const res = await supabase.rpc('ingest_city_places', { p_city: cityId, p_places: rows });
    if (res.error) throw new Error(res.error.message);
    onFraction?.(1);
    return { outcome: 'ready', error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // On rend la main au robot pour que la ville soit quand même remplie plus tard.
    await supabase.rpc('release_city_collection', { p_city: cityId, p_error: message });
    return { outcome: 'queued', error: message };
  }
}

/**
 * Attend que toutes ces villes soient prêtes, en collectant en direct celles qui ne le sont pas (2 à la fois pour
 * ménager les serveurs OpenStreetMap). `onProgress` reçoit un pourcentage réel : lecture des groupes, écriture, etc.
 */
export async function ensureCitiesCollected(ids: number[], onProgress: (p: CollectionProgress) => void, alive: () => boolean, maxWaitMs = 10 * 60_000): Promise<{ error: string | null }> {
  const fractions = new Map<number, number>(ids.map((id) => [id, 0]));
  const failed = new Set<number>();
  const emit = () => onProgress(fractionProgress(ids.map((id) => fractions.get(id) ?? 0), failed.size));
  const started = Date.now();
  let lastError: string | null = null;

  const first = await cityCollectionStatuses(ids);
  if (first.error) return { error: first.error };
  for (const id of ids) if ((first.statuses.get(id) ?? 'ready') === 'ready') fractions.set(id, 1);
  emit();

  const todo = ids.filter((id) => fractions.get(id) !== 1);
  const waiting: number[] = [];
  let next = 0;
  const worker = async () => {
    while (alive() && next < todo.length) {
      const id = todo[next++];
      const r = await collectCityNow(id, (f) => { fractions.set(id, Math.max(fractions.get(id) ?? 0, f)); emit(); });
      if (r.error) lastError = r.error;
      if (r.outcome === 'ready') fractions.set(id, 1);
      else if (r.outcome === 'failed') failed.add(id);
      else waiting.push(id);   // en file chez le robot, ou en cours chez quelqu'un d'autre
      emit();
    }
  };
  await Promise.all([worker(), worker()]);

  // Villes confiées au robot ou à quelqu'un d'autre : on suit leur état.
  while (alive() && waiting.some((id) => fractions.get(id) !== 1 && !failed.has(id)) && Date.now() - started < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 4000));
    const st = await cityCollectionStatuses(waiting);
    for (const id of waiting) {
      const s = st.statuses.get(id);
      if (s === 'ready') fractions.set(id, 1);
      else if (s === 'failed') failed.add(id);
      else if (s === 'collecting') fractions.set(id, Math.max(fractions.get(id) ?? 0, 0.5));
    }
    emit();
  }
  return { error: failed.size && lastError ? lastError : null };
}

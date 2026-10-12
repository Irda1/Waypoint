// Carnet de voyage (migration 2600) : une note par jour et jusqu'à 12 photos, réservées aux membres du voyage.
// Les photos sont dans l'espace de stockage privé « trip-photos » ; on les affiche par des liens signés valables une heure.
// Sans la migration, `available` reste faux et le carnet ne s'affiche pas.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { photoFile } from '../lib/photoFile';

export interface JournalNote { day_id: string; note: string; created_by: string | null; updated_by: string | null; updated_at: string }
export interface JournalPhoto { id: string; day_id: string; path: string; width: number | null; height: number | null; created_by: string | null; created_at: string; url: string | null }
export interface Journal { available: boolean; notes: Map<string, JournalNote>; photos: JournalPhoto[] }

const BUCKET = 'trip-photos';
export const MAX_PHOTOS = 12;
const EMPTY: Journal = { available: false, notes: new Map(), photos: [] };
const signed = new Map<string, { url: string; until: number }>();

async function signUrls(paths: string[]): Promise<Map<string, string>> {
  const now = Date.now();
  const missing = paths.filter((p) => (signed.get(p)?.until ?? 0) < now + 5 * 60_000);
  if (missing.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(missing, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, { url: s.signedUrl, until: now + 3600_000 });
  }
  return new Map(paths.flatMap((p) => (signed.has(p) ? [[p, signed.get(p)!.url] as const] : [])));
}

export async function loadJournal(tripId: string): Promise<Journal> {
  const [notes, photos] = await Promise.all([
    supabase.from('trip_journal').select('day_id,note,created_by,updated_by,updated_at').eq('trip_id', tripId),
    supabase.from('trip_photos').select('id,day_id,path,width,height,created_by,created_at').eq('trip_id', tripId).order('created_at'),
  ]);
  if (notes.error || photos.error) return EMPTY;   // tables absentes (migration 2600 pas encore passée) ou hors connexion
  const rows = (photos.data ?? []) as Omit<JournalPhoto, 'url'>[];
  const urls = await signUrls(rows.map((r) => r.path)).catch(() => new Map<string, string>());
  return {
    available: true,
    notes: new Map(((notes.data ?? []) as JournalNote[]).map((n) => [n.day_id, n])),
    photos: rows.map((r) => ({ ...r, url: urls.get(r.path) ?? null })),
  };
}

/** Carnet d'un voyage, rechargé quand `stamp` change (données du voyage rechargées) ou après une modification. */
export function useJournal(tripId: string, stamp?: unknown): Journal & { reload: () => void } {
  const [journal, setJournal] = useState<Journal>(EMPTY);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    void loadJournal(tripId).then((j) => { if (alive) setJournal(j); });
    return () => { alive = false; };
  }, [tripId, stamp, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...journal, reload };
}

export async function saveNote(tripId: string, dayId: string, note: string): Promise<string | null> {
  const { error } = await supabase.from('trip_journal').upsert({ trip_id: tripId, day_id: dayId, note: note.slice(0, 5000) }, { onConflict: 'day_id' });
  return error?.message ?? null;
}

/** Envoie une photo (déjà choisie sur l'appareil) puis l'inscrit au carnet du jour. */
export async function addPhoto(tripId: string, dayId: string, asset: { uri: string; width: number; height: number }): Promise<string | null> {
  try {
    const file = await photoFile(asset.uri, asset.width, asset.height);
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path = `${tripId}/${dayId}/${id}.jpg`;
    const up = await supabase.storage.from(BUCKET).upload(path, file.body, { contentType: file.contentType, upsert: false });
    if (up.error) return up.error.message;
    const { error } = await supabase.from('trip_photos').insert({ trip_id: tripId, day_id: dayId, path, width: file.width, height: file.height });
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);   // pas de fichier orphelin si la ligne est refusée (12 photos…)
      return error.message.includes('12') ? `Au plus ${MAX_PHOTOS} photos par jour.` : error.message;
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Envoi impossible pour le moment.';
  }
}

export async function deletePhoto(photo: JournalPhoto): Promise<string | null> {
  const { error } = await supabase.from('trip_photos').delete().eq('id', photo.id);
  if (error) return error.message;
  await supabase.storage.from(BUCKET).remove([photo.path]);
  signed.delete(photo.path);
  return null;
}

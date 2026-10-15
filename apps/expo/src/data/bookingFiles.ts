// Billets joints aux réservations (table trip_booking_files et stockage privé « trip-files », migration 2800).
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';
import { FILE_TYPES, checkFile, fileType } from '../domain/bookings.ts';
import { isKept, openKept } from '../lib/offlineFile';

const BUCKET = 'trip-files';
export interface BookingFile { id: string; booking_id: string; path: string; name: string; size: number | null; content_type: string; created_by: string | null }
export const extOf = (f: BookingFile) => FILE_TYPES[f.content_type] ?? 'bin';

const missing = (e: { message: string; code?: string }) => e.code === '42P01' || e.code === 'PGRST205' || (/trip_booking_files/.test(e.message) && /schema cache|does not exist/i.test(e.message));
const msg = (e: { message: string; code?: string }) => (e.code === '42501' ? 'Action non autorisée.' : e.code === '23514' ? 'Au plus 5 fichiers par réservation.' : e.message);

/** Fichiers des réservations du voyage ; `available` faux tant que la migration 2800 n'est pas installée. */
export function useBookingFiles(tripId: string) {
  const [files, setFiles] = useState<BookingFile[]>([]);
  const [available, setAvailable] = useState(false);
  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('trip_booking_files').select('id,booking_id,path,name,size,content_type,created_by').eq('trip_id', tripId).order('created_at');
    if (error) { setAvailable(!missing(error)); return; }
    setAvailable(true);
    setFiles((data ?? []) as BookingFile[]);
  }, [tripId]);
  useEffect(() => { void reload(); }, [reload]);
  return { files, available, reload };
}

/** Choisit un PDF ou une photo sur l'appareil et le joint à la réservation. Renvoie une erreur, ou null (y compris si on annule). */
export async function attachFile(tripId: string, bookingId: string, count: number): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: Object.keys(FILE_TYPES), copyToCacheDirectory: true, multiple: false });
  const asset = res.canceled ? null : res.assets[0];
  if (!asset) return null;
  const refused = checkFile(asset.name, asset.mimeType, asset.size, count);
  if (refused) return refused;
  const type = fileType(asset.name, asset.mimeType)!;
  const body = asset.file ?? (await (await fetch(asset.uri)).arrayBuffer());
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${tripId}/${bookingId}/${id}.${FILE_TYPES[type]}`;
  const up = await supabase.storage.from(BUCKET).upload(path, body, { contentType: type, upsert: false });
  if (up.error) return up.error.message;
  const { error } = await supabase.from('trip_booking_files').insert({ trip_id: tripId, booking_id: bookingId, path, name: asset.name.slice(0, 160), size: asset.size ?? null, content_type: type });
  if (error) { await supabase.storage.from(BUCKET).remove([path]); return msg(error); }   // pas de fichier orphelin
  return null;
}

export async function removeFile(f: BookingFile): Promise<string | null> {
  const { error } = await supabase.from('trip_booking_files').delete().eq('id', f.id);
  if (error) return msg(error);
  await supabase.storage.from(BUCKET).remove([f.path]);
  return null;
}

/** Retire du stockage ses propres fichiers d'une réservation qu'on supprime (les lignes partent avec elle). */
export async function removeOwnFiles(files: BookingFile[]): Promise<void> {
  if (files.length) await supabase.storage.from(BUCKET).remove(files.map((f) => f.path));
}

/** Lien d'une heure vers le fichier. */
export async function fileUrl(f: BookingFile): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(f.path, 3600);
  return data?.signedUrl ?? null;
}

/** Ouvre le billet : la copie du téléphone si elle existe, sinon en ligne. */
export async function openFile(f: BookingFile): Promise<string | null> {
  if (isKept(f.id, extOf(f))) { await openKept(f.id, extOf(f), f.content_type); return null; }
  const url = await fileUrl(f);
  if (!url) return 'Billet indisponible hors connexion : active « Garder sur ce téléphone » quand tu as du réseau.';
  await Linking.openURL(url);
  return null;
}

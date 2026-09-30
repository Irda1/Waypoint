// Réservations du voyage (table trip_bookings, migration 1300).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { draftToRow, sortBookings } from '../domain/bookings.ts';
import type { Booking, BookingDraft } from '../domain/bookings.ts';

const MISSING = 'Les réservations ne sont pas encore activées sur le serveur (migration 1300 à installer).';
const msg = (e: { message: string; code?: string }): string =>
  e.code === '42P01' || e.code === 'PGRST205' || /trip_bookings/.test(e.message) && /schema cache|does not exist/i.test(e.message) ? MISSING : e.code === '42501' ? 'Action non autorisée : tu n\'es pas membre de ce voyage.' : e.message;

export function useBookings(tripId: string) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data, error: e } = await supabase.from('trip_bookings').select('id,kind,title,reference,starts_on,start_time,url,notes').eq('trip_id', tripId);
    if (e) setError(msg(e)); else { setError(null); setBookings(sortBookings((data ?? []) as Booking[])); }
    setLoading(false);
  }, [tripId]);

  useEffect(() => { void reload(); }, [reload]);
  return { bookings, error, loading, reload };
}

export async function saveBooking(tripId: string, draft: BookingDraft, id?: string): Promise<string | null> {
  const row = draftToRow(draft);
  const { error } = id
    ? await supabase.from('trip_bookings').update(row).eq('id', id)
    : await supabase.from('trip_bookings').insert({ trip_id: tripId, ...row });
  return error ? msg(error) : null;
}

export async function removeBooking(id: string): Promise<string | null> {
  const { error } = await supabase.from('trip_bookings').delete().eq('id', id);
  return error ? msg(error) : null;
}

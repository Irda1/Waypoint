// Liste « À ne pas oublier » du voyage (table trip_checklist, migration 1400).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CheckItem } from '../domain/checklist.ts';

const MISSING = 'La liste n\'est pas encore activée sur le serveur (migration 1400 à installer).';
const msg = (e: { message: string; code?: string }): string =>
  e.code === '42P01' || e.code === 'PGRST205' || (/trip_checklist/.test(e.message) && /schema cache|does not exist/i.test(e.message)) ? MISSING : e.code === '42501' ? 'Action non autorisée : tu n\'es pas membre de ce voyage.' : e.message;

export function useChecklist(tripId: string) {
  const [items, setItems] = useState<CheckItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data, error: e } = await supabase.from('trip_checklist').select('id,label,done').eq('trip_id', tripId).order('created_at');
    if (e) setError(msg(e)); else { setError(null); setItems((data ?? []) as CheckItem[]); }
    setLoading(false);
  }, [tripId]);

  useEffect(() => { void reload(); }, [reload]);
  return { items, setItems, error, loading, reload };
}

export async function addItems(tripId: string, labels: string[]): Promise<string | null> {
  if (!labels.length) return null;
  const { error } = await supabase.from('trip_checklist').insert(labels.map((label) => ({ trip_id: tripId, label })));
  return error ? msg(error) : null;
}

export async function setDone(id: string, done: boolean): Promise<string | null> {
  const { error } = await supabase.from('trip_checklist').update({ done }).eq('id', id);
  return error ? msg(error) : null;
}

export async function removeItem(id: string): Promise<string | null> {
  const { error } = await supabase.from('trip_checklist').delete().eq('id', id);
  return error ? msg(error) : null;
}

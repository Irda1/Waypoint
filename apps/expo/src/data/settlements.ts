// Remboursements entre amis (table settlement_payments, migration 1100).
import { supabase } from '../lib/supabase';

/** Enregistre qu'un ami a remboursé une part. Renvoie un message d'erreur, ou null. */
export async function markReceived(args: { tripId: string; from: string; to: string; amount: number; currency: string }): Promise<string | null> {
  const { error } = await supabase.from('settlement_payments').insert({ trip_id: args.tripId, from_user: args.from, to_user: args.to, amount: args.amount, currency: args.currency });
  return error?.message ?? null;
}

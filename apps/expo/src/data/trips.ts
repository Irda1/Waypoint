// Lecture et écriture des voyages. Chaque fonction d'écriture renvoie un message d'erreur
// lisible ou null. La sécurité est assurée par la base (RLS) : ces appels n'ont besoin
// d'aucun contrôle de droits côté appli.
import { supabase } from '../lib/supabase';
import type { Poste } from '../domain/types.ts';

const msg = (e: { message: string; code?: string } | null): string | null => {
  if (!e) return null;
  if (e.code === '42501') return 'Action non autorisée : tu n\'es pas membre de ce voyage.';
  if (e.code === '23505') return 'Cet élément existe déjà.';
  if (e.code === 'P0002') return 'Invitation invalide ou expirée.';
  return e.message;
};

export interface TripSummary {
  id: string;
  title: string;
  starts_on: string | null;
  ends_on: string | null;
  currency: string;
}

export async function listTrips(): Promise<{ trips: TripSummary[]; error: string | null }> {
  const { data, error } = await supabase
    .from('trips')
    .select('id,title,starts_on,ends_on,currency')
    .is('deleted_at', null)
    .order('starts_on', { ascending: false, nullsFirst: true });
  return { trips: (data ?? []) as TripSummary[], error: msg(error) };
}

export async function createTrip(title: string, startsOn: string | null, endsOn: string | null): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.from('trips').insert({ title: title.trim(), starts_on: startsOn, ends_on: endsOn }).select('id').single();
  return { id: (data as { id: string } | null)?.id ?? null, error: msg(error) };
}

export async function addDay(tripId: string, date: string): Promise<string | null> {
  const { error } = await supabase.from('trip_days').insert({ trip_id: tripId, day_date: date });
  return error?.code === '23505' ? 'Ce jour existe déjà dans le voyage.' : msg(error);
}

export async function addItem(args: { tripId: string; dayId: string; title: string; startTime: string | null; position: number }): Promise<string | null> {
  const { error } = await supabase.from('trip_items').insert({
    trip_id: args.tripId, day_id: args.dayId, title: args.title.trim(), start_time: args.startTime, position: args.position,
  });
  return msg(error);
}

export async function addExpense(args: { tripId: string; label: string; poste: Poste; amount: number; currency: string; paidBy: string; itemId?: string | null }): Promise<string | null> {
  const { error } = await supabase.from('expenses').insert({
    trip_id: args.tripId, label: args.label.trim(), poste: args.poste, amount: args.amount, currency: args.currency, paid_by: args.paidBy, item_id: args.itemId ?? null,
  });
  return msg(error);
}

export async function deleteItem(itemId: string): Promise<string | null> {
  const { error } = await supabase.from('trip_items').delete().eq('id', itemId);
  return msg(error);
}

/** Crée un lien d'invitation (14 jours) et renvoie son code. */
export async function createInvite(tripId: string): Promise<{ code: string | null; error: string | null }> {
  const { data, error } = await supabase.from('trip_invites').insert({ trip_id: tripId }).select('code').single();
  return { code: (data as { code: string } | null)?.code ?? null, error: msg(error) };
}

export interface InvitePreview {
  trip_id: string;
  title: string;
  starts_on: string | null;
  ends_on: string | null;
  member_count: number;
}

export async function previewInvite(code: string): Promise<{ preview: InvitePreview | null; error: string | null }> {
  const { data, error } = await supabase.rpc('preview_invite', { p_code: code });
  const rows = (data ?? []) as InvitePreview[];
  return { preview: rows[0] ?? null, error: msg(error) };
}

export async function joinTrip(code: string): Promise<{ tripId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('join_trip', { p_code: code });
  return { tripId: (data as string | null) ?? null, error: msg(error) };
}

export async function leaveTrip(tripId: string): Promise<string | null> {
  const { error } = await supabase.rpc('leave_trip', { p_trip: tripId });
  return msg(error);
}

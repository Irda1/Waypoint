// Choix des notifications entre amis (table notification_prefs, migration 2900) : sans ligne, tout est activé.
import { supabase } from '../lib/supabase';

export const FRIEND_KINDS = [
  { key: 'programme', title: 'Programme', hint: 'Étape ajoutée, déplacée ou retirée' },
  { key: 'depenses', title: 'Dépenses', hint: 'Nouvelle dépense ou remboursement' },
  { key: 'reservations', title: 'Réservations et billets', hint: 'Vol, train, hôtel ajouté ou billet joint' },
  { key: 'carnet', title: 'Carnet', hint: 'Photos et notes du jour' },
  { key: 'voyageurs', title: 'Voyageurs', hint: 'Quelqu\'un rejoint ou quitte le voyage' },
] as const;
export type FriendKind = (typeof FRIEND_KINDS)[number]['key'];
export type FriendPrefs = { enabled: boolean } & Record<FriendKind, boolean>;
export const DEFAULT_FRIEND_PREFS: FriendPrefs = { enabled: true, programme: true, depenses: true, reservations: true, carnet: true, voyageurs: true };

/** `missing` : la migration 2900 n'est pas encore installée. */
export async function loadFriendPrefs(): Promise<{ prefs: FriendPrefs; missing: boolean }> {
  const { data, error } = await supabase.from('notification_prefs').select('enabled,programme,depenses,reservations,carnet,voyageurs').maybeSingle();
  if (error) return { prefs: DEFAULT_FRIEND_PREFS, missing: error.code === '42P01' || error.code === 'PGRST205' };
  return { prefs: (data as FriendPrefs | null) ?? DEFAULT_FRIEND_PREFS, missing: false };
}

export async function saveFriendPrefs(userId: string, prefs: FriendPrefs): Promise<string | null> {
  const { error } = await supabase.from('notification_prefs').upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() });
  return error?.message ?? null;
}

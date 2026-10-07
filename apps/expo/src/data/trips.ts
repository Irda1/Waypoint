// Lecture et écriture des voyages. Chaque fonction d'écriture renvoie un message d'erreur
// lisible ou null. La sécurité est assurée par la base (RLS) : ces appels n'ont besoin
// d'aucun contrôle de droits côté appli.
import { supabase } from '../lib/supabase';
import { loadOffline, saveOffline } from './offline';
import { dayCities } from '../domain/destinations.ts';
import { capitalCovers, COVER_FIELDS, toCover } from './cityCover';
import type { CityCover } from './cityCover';
import { POSTES } from '../domain/types.ts';
import type { Poste, TripItem } from '../domain/types.ts';
import { addDays } from '../lib/dates.ts';
import { autoTitle, budgetTotal, cityPerDay, dayCount, splitBudget, wizardPlan } from '../domain/wizard.ts';
import type { WizardState } from '../domain/wizard.ts';
import { applyPlan, loadCandidates } from './itinerary';

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
  country_code: string | null;
  /** Photo (Pexels) de la capitale du pays du voyage, sinon de sa première ville. */
  cover: CityCover | null;
}

export async function listTrips(): Promise<{ trips: TripSummary[]; error: string | null; savedAt?: number | null }> {
  const { data, error } = await supabase
    .from('trips')
    .select('id,title,starts_on,ends_on,currency,country_code')
    .is('deleted_at', null)
    .order('starts_on', { ascending: false, nullsFirst: true });
  const rows = (data ?? []) as Omit<TripSummary, 'cover'>[];
  const covers = new Map<string, CityCover>();
  if (rows.length) {
    const { data: dest } = await supabase.from('trip_destinations')
      .select(`trip_id,position,cities(${COVER_FIELDS})`)
      .in('trip_id', rows.map((t) => t.id)).order('position');
    for (const d of (dest ?? []) as unknown as { trip_id: string; cities: { cover_media: Parameters<typeof toCover>[0] } | null }[]) {
      const c = toCover(d.cities?.cover_media ?? null);
      if (c && !covers.has(d.trip_id)) covers.set(d.trip_id, c);
    }
  }
  const capitals = await capitalCovers(rows.map((t) => t.country_code ?? ''));
  if (error) {
    const copy = await loadOffline<TripSummary[]>('trips');
    if (copy) return { trips: copy.data, error: null, savedAt: copy.savedAt };
    return { trips: [], error: msg(error) };
  }
  const trips = rows.map((t) => ({ ...t, cover: (t.country_code ? capitals.get(t.country_code) : null) ?? covers.get(t.id) ?? null }));
  void saveOffline('trips', trips);
  return { trips, error: null, savedAt: null };
}

/** Crée le voyage puis ses destinations. Si seules les destinations échouent, l'id est rendu avec un message. */
export async function createTrip(title: string, startsOn: string | null, endsOn: string | null, cityIds: number[] = []): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.from('trips').insert({ title: title.trim(), starts_on: startsOn, ends_on: endsOn }).select('id').single();
  const id = (data as { id: string } | null)?.id ?? null;
  if (!id) return { id: null, error: msg(error) };
  if (cityIds.length) {
    const res = await supabase.from('trip_destinations').insert(cityIds.map((city_id, position) => ({ trip_id: id, city_id, position })));
    if (res.error) return { id, error: `Voyage créé, mais les destinations n'ont pas pu être ajoutées : ${res.error.message}` };
  }
  return { id, error: null };
}

/**
 * Enregistre les villes du voyage (ordre et nuits) puis rattache chaque jour à sa ville d'après ces nuits.
 * `dayIds` : les jours du voyage, dans l'ordre des dates.
 */
export async function saveDestinations(tripId: string, dests: { id: number; nights: number }[], dayIds: string[]): Promise<string | null> {
  const keep = dests.map((d) => d.id);
  const old = await supabase.from('trip_destinations').select('city_id').eq('trip_id', tripId);
  if (old.error) return old.error.message;
  const gone = ((old.data ?? []) as { city_id: number }[]).map((r) => r.city_id).filter((id) => !keep.includes(id));
  if (gone.length) {
    const del = await supabase.from('trip_destinations').delete().eq('trip_id', tripId).in('city_id', gone);
    if (del.error) return del.error.message;
  }
  if (dests.length) {
    const up = await supabase.from('trip_destinations').upsert(dests.map((d, position) => ({ trip_id: tripId, city_id: d.id, position, nights: d.nights })), { onConflict: 'trip_id,city_id' });
    if (up.error) return up.error.message;
  }
  for (const [cityId, ids] of dayCities(dests.map((d) => ({ ...d, name: '' })), dayIds)) {
    const r = await supabase.from('trip_days').update({ city_id: cityId }).in('id', ids);
    if (r.error) return r.error.message;
  }
  return null;
}

export async function addDestination(tripId: string, cityId: number, position: number): Promise<string | null> {
  const { error } = await supabase.from('trip_destinations').insert({ trip_id: tripId, city_id: cityId, position });
  return error?.code === '23505' ? null : msg(error);
}

export async function removeDestination(tripId: string, cityId: number): Promise<string | null> {
  const { error } = await supabase.from('trip_destinations').delete().eq('trip_id', tripId).eq('city_id', cityId);
  return msg(error);
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

export async function addExpense(args: { tripId: string; label: string; poste: Poste; amount: number; currency: string; paidBy: string; itemId?: string | null; stayId?: string | null }): Promise<string | null> {
  const { error } = await supabase.from('expenses').insert({
    trip_id: args.tripId, label: args.label.trim(), poste: args.poste, amount: args.amount, currency: args.currency, paid_by: args.paidBy, item_id: args.itemId ?? null, stay_id: args.stayId ?? null,
  });
  return msg(error);
}

/** Remet une étape « pas encore payée » : retire les dépenses rattachées à cette étape. */
export async function clearItemExpenses(itemId: string): Promise<string | null> {
  const { error } = await supabase.from('expenses').delete().eq('item_id', itemId);
  return msg(error);
}

/** Fixe (ou efface, avec null) l'heure de début d'une étape. */
export async function setItemTime(itemId: string, time: string | null): Promise<string | null> {
  const { error } = await supabase.from('trip_items').update({ start_time: time }).eq('id', itemId);
  return msg(error);
}

/** Copie des étapes du plan A dans un plan de repli (B ou C) d'un même jour. Renvoie un message d'erreur, ou null. */
export async function copyItemsToPlan(args: { tripId: string; dayId: string; plan: 'B' | 'C'; items: TripItem[] }): Promise<string | null> {
  if (args.items.length === 0) return null;
  const rows = args.items.map((i) => ({
    trip_id: args.tripId, day_id: args.dayId, plan: args.plan, place_id: i.place_id, title: i.title, category_code: i.category_code,
    start_time: i.start_time, duration_min: i.duration_min, position: i.position,
  }));
  const { error } = await supabase.from('trip_items').insert(rows);
  return error?.message ?? null;
}

/** Heures de départ et de retour du logement pour un jour ; `null` = valeur par défaut. */
export async function setDayHours(dayId: string, depart: string | null, ret: string | null): Promise<string | null> {
  const { error } = await supabase.from('trip_days').update({ depart_time: depart, return_time: ret }).eq('id', dayId);
  return error?.message ?? null;
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

/** Crée le voyage décrit par le parcours : voyage, destinations avec leurs nuits, jours (avec leur ville) et budget par poste. */
export async function createTripFromWizard(s: WizardState, rootOf?: (code: string) => string): Promise<{ id: string | null; error: string | null }> {
  const total = budgetTotal(s);
  const days = dayCount(s);
  if (!s.country || !s.start || !s.end || !days || !s.party || total === null) return { id: null, error: 'Il manque des informations pour créer le voyage.' };
  const level = s.budget.level === 'montant' ? null : s.budget.level;
  const title = (s.title.trim() || autoTitle(s)).slice(0, 120);
  const { data, error } = await supabase.from('trips').insert({
    title, starts_on: s.start, ends_on: s.end, currency: s.budget.currency, budget_level: level, budget_total: total,
    styles: s.interests, travelers: s.travelers, party_type: s.party, dates_indicative: s.indicative, country_code: s.country,
  }).select('id').single();
  const id = (data as { id: string } | null)?.id ?? null;
  if (!id) return { id: null, error: msg(error) };

  const fail = (what: string, e: { message: string }) => ({ id, error: `Voyage créé, mais ${what} : ${e.message}` });
  if (s.cities.length) {
    const r = await supabase.from('trip_destinations').insert(s.cities.map((c, position) => ({ trip_id: id, city_id: c.id, position, nights: c.nights })));
    if (r.error) return fail('les villes n\'ont pas pu être ajoutées', r.error);
  }
  const perDay = cityPerDay(s.cities, days);
  const r2 = await supabase.from('trip_days').insert(perDay.map((city_id, i) => ({ trip_id: id, day_date: addDays(s.start!, i), city_id })));
  if (r2.error) return fail('les jours n\'ont pas pu être créés', r2.error);
  const split = splitBudget(total);
  const r3 = await supabase.from('trip_budget_lines').insert(POSTES.map((poste) => ({ trip_id: id, poste, amount: split[poste] })));
  if (r3.error) return fail('le budget n\'a pas pu être réparti', r3.error);
  if (s.program && rootOf && s.cities.length) {
    const err = await fillProgram(id, s, rootOf);
    if (err) return fail('le programme proposé n\'a pas pu être ajouté', { message: err });
  }
  return { id, error: null };
}

/** Remplit les jours d'un voyage tout juste créé avec le programme proposé par l'assistant. */
async function fillProgram(tripId: string, s: WizardState, rootOf: (code: string) => string): Promise<string | null> {
  const { candidates, error } = await loadCandidates(s.cities.map((c) => c.id), rootOf);
  if (error) return error;
  const { data, error: e2 } = await supabase.from('trip_days').select('id,day_date').eq('trip_id', tripId);
  if (e2) return e2.message;
  const idByDate = new Map(((data ?? []) as { id: string; day_date: string }[]).map((d) => [d.day_date, d.id]));
  const plan = wizardPlan(s, candidates)
    .map((p) => ({ dayId: idByDate.get(p.date) ?? '', plan: p }))
    .filter((p) => p.dayId && p.plan.items.length);
  return applyPlan(tripId, plan);
}

/** Enregistre le mémo du voyage (notes libres partagées entre les voyageurs). */
export async function setTripMemo(tripId: string, memo: string): Promise<string | null> {
  const { error } = await supabase.from('trips').update({ memo: memo.trim() }).eq('id', tripId);
  return msg(error);
}

/** Fixe le budget prévu d'un poste (crée la ligne si elle n'existe pas). */
export async function setBudgetLine(tripId: string, poste: Poste, amount: number): Promise<string | null> {
  const { error } = await supabase.from('trip_budget_lines').upsert({ trip_id: tripId, poste, amount }, { onConflict: 'trip_id,poste' });
  return msg(error);
}

/** Enregistre l'échange de deux étapes voisines (heure de début et rang). */
export async function applyItemMoves(moves: { id: string; start_time: string | null; position: number }[]): Promise<string | null> {
  for (const m of moves) {
    const { error } = await supabase.from('trip_items').update({ start_time: m.start_time, position: m.position }).eq('id', m.id);
    if (error) return msg(error);
  }
  return null;
}

/** Met le voyage à la corbeille (restaurable) : il disparaît de l'accueil pour tous ses voyageurs. */
export async function deleteTrip(tripId: string): Promise<string | null> {
  const { error } = await supabase.from('trips').update({ deleted_at: new Date().toISOString() }).eq('id', tripId);
  return msg(error);
}

export async function restoreTrip(tripId: string): Promise<string | null> {
  const { error } = await supabase.from('trips').update({ deleted_at: null }).eq('id', tripId);
  return msg(error);
}

export interface TrashedTrip { id: string; title: string; starts_on: string | null; ends_on: string | null; deleted_at: string }

/** Voyages à la corbeille (ceux dont on est membre). */
export async function listTrash(): Promise<{ trips: TrashedTrip[]; error: string | null }> {
  const { data, error } = await supabase.from('trips').select('id,title,starts_on,ends_on,deleted_at')
    .not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
  return { trips: (data ?? []) as TrashedTrip[], error: msg(error) };
}

/** Lien de partage actif du voyage (lecture seule), s'il y en a un. `missing` : migration 1500 pas encore installée. */
export async function getShareToken(tripId: string): Promise<{ token: string | null; missing: boolean; error: string | null }> {
  const { data, error } = await supabase.from('trip_shares').select('token').eq('trip_id', tripId).is('revoked_at', null).order('created_at', { ascending: false }).limit(1);
  if (error) return { token: null, missing: error.code === 'PGRST205' || error.code === '42P01', error: msg(error) };
  return { token: (data?.[0] as { token: string } | undefined)?.token ?? null, missing: false, error: null };
}

export async function createShare(tripId: string): Promise<{ token: string | null; error: string | null }> {
  const { data, error } = await supabase.from('trip_shares').insert({ trip_id: tripId }).select('token').single();
  return { token: (data as { token: string } | null)?.token ?? null, error: msg(error) };
}

export async function revokeShare(tripId: string): Promise<string | null> {
  const { error } = await supabase.from('trip_shares').update({ revoked_at: new Date().toISOString() }).eq('trip_id', tripId).is('revoked_at', null);
  return msg(error);
}

export interface SharedTrip {
  title: string; starts_on: string | null; ends_on: string | null; destinations: string[];
  days: { date: string; city: string | null; items: { time: string | null; name: string | null; category: string | null; note: string | null }[] }[];
}

/** Programme d'un voyage partagé : lisible sans compte, avec le jeton du lien. */
export async function loadSharedTrip(token: string): Promise<{ trip: SharedTrip | null; error: string | null }> {
  const { data, error } = await supabase.rpc('shared_trip', { p_token: token });
  return { trip: (data as SharedTrip | null) ?? null, error: msg(error) };
}

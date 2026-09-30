// Charge un voyage complet et le garde à jour en temps réel (Supabase Realtime, « Postgres Changes »).
//
// Stratégie volontairement simple : à chaque changement reçu, on recharge le voyage
// (quelques requêtes légères pour un groupe d'amis). Deux raisons de ne pas filtrer par
// trip_id côté abonnement : (1) la sécurité par ligne n'affiche que les voyages dont on est
// membre pour les ajouts et modifications ; (2) les suppressions ne portent que la clé
// primaire (identité de réplique par défaut), donc un filtre les ferait disparaître.
import { useCallback, useEffect, useRef, useState } from 'react';
import { capitalCovers, COVER_FIELDS, toCover } from './cityCover';
import type { CityCover } from './cityCover';
import { supabase } from '../lib/supabase';
import type { Expense, Place, TripItem } from '../domain/types.ts';

export interface Trip { id: string; title: string; starts_on: string | null; ends_on: string | null; currency: string; country_code?: string | null; travelers: number; styles: string[]; budget_total: number | null; memo: string; deleted_at: string | null; version: number }
export interface Member { user_id: string; color: string; left_at: string | null; profiles: { display_name: string; avatar_url: string | null } | null }
export interface Day { id: string; day_date: string; city_id: number | null; stay_id: string | null; depart_time: string | null; return_time: string | null }
export interface Stay { id: string; name: string; address: string | null; lat: number | null; lng: number | null }
export interface Destination { city_id: number; position: number; nights: number; lat: number; lng: number; name: string; country_code: string; collection_status: 'empty' | 'queued' | 'collecting' | 'ready' | 'failed'; cover: CityCover | null }
export interface BudgetLine { poste: string; amount: number }

export interface TripData {
  trip: Trip;
  members: Member[];
  days: Day[];
  items: TripItem[];
  places: Map<number, Place>;
  expenses: (Expense & { label: string; currency: string; spent_on?: string | null })[];
  budgetLines: BudgetLine[];
  destinations: Destination[];
  /** Photo de la capitale du pays du voyage. */
  capitalCover: CityCover | null;
  stays: Stay[];
  /** Remboursements déjà reçus ; `null` tant que la migration 1100 n'est pas installée. */
  payments: { id: string; from_user: string; to_user: string; amount: number }[] | null;
}

export type LiveStatus = 'connecting' | 'live' | 'offline';

type DestinationRow = { city_id: number; position: number; nights: number; cities: { lat: number; lng: number; name: string; name_fr: string | null; country_code: string; collection_status: Destination['collection_status']; cover_media: { url_large: string | null; url_medium: string | null; attribution: string | null } | null } | null };

function toDestinations(rows: unknown): Destination[] {
  return ((rows ?? []) as DestinationRow[])
    .filter((r) => r.cities)
    .map((r) => ({ city_id: r.city_id, position: r.position, nights: r.nights, lat: r.cities!.lat, lng: r.cities!.lng, name: r.cities!.name_fr ?? r.cities!.name, country_code: r.cities!.country_code, collection_status: r.cities!.collection_status, cover: toCover(r.cities!.cover_media) }));
}

const TABLES = ['trips', 'trip_members', 'trip_days', 'trip_items', 'trip_stays', 'expenses', 'trip_budget_lines', 'trip_destinations'] as const;

export function useTrip(tripId: string) {
  const [data, setData] = useState<TripData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const known = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const [trip, members, days, items, expenses, budget, dest, stays] = await Promise.all([
      supabase.from('trips').select('id,title,starts_on,ends_on,currency,country_code,travelers,styles,budget_total,memo,deleted_at,version').eq('id', tripId).maybeSingle(),
      supabase.from('trip_members').select('user_id,color,left_at,profiles(display_name,avatar_url)').eq('trip_id', tripId),
      supabase.from('trip_days').select('id,day_date,city_id,stay_id,depart_time,return_time').eq('trip_id', tripId).order('day_date'),
      supabase.from('trip_items').select('*').eq('trip_id', tripId),
      supabase.from('expenses').select('id,poste,amount,paid_by,item_id,stay_id,label,currency,spent_on').eq('trip_id', tripId).order('spent_on'),
      supabase.from('trip_budget_lines').select('poste,amount').eq('trip_id', tripId),
      supabase.from('trip_destinations').select(`city_id,position,nights,cities(name,name_fr,lat,lng,country_code,collection_status,${COVER_FIELDS})`).eq('trip_id', tripId).order('position'),
      supabase.from('trip_stays').select('id,name,address,lat,lng').eq('trip_id', tripId),
    ]);
    const failure = [trip, members, days, items, expenses, budget, dest, stays].find((r) => r.error)?.error;
    if (failure) { setError(failure.message); setLoading(false); return; }
    if (!trip.data) { setError('Voyage introuvable, ou tu n\'en es plus membre.'); setData(null); setLoading(false); return; }

    const placeIds = [...new Set((items.data ?? []).map((i) => i.place_id).filter((x): x is number => x != null))];
    const places = new Map<number, Place>();
    if (placeIds.length) {
      const { data: rows } = await supabase.from('places')
        .select('id,name,kind,category_code,lat,lng,price_amount,visit_duration_min,closed_days,opening_hours').in('id', placeIds);
      for (const p of (rows ?? []) as Place[]) places.set(p.id, p);
    }
    // Table ajoutée par la migration 1100 : son absence ne doit jamais empêcher d'ouvrir le voyage.
    const pay = await supabase.from('settlement_payments').select('id,from_user,to_user,amount').eq('trip_id', tripId).order('created_at');
    const cc = (trip.data as { country_code?: string | null }).country_code;
    const capital = cc ? (await capitalCovers([cc])).get(cc) ?? null : null;
    const next: TripData = {
      trip: trip.data as Trip,
      members: (members.data ?? []) as unknown as Member[],
      days: (days.data ?? []) as Day[],
      items: (items.data ?? []) as TripItem[],
      places,
      expenses: (expenses.data ?? []) as TripData['expenses'],
      budgetLines: (budget.data ?? []) as BudgetLine[],
      destinations: toDestinations(dest.data),
      capitalCover: capital,
      stays: (stays.data ?? []) as Stay[],
      payments: pay.error ? null : ((pay.data ?? []) as { id: string; from_user: string; to_user: string; amount: number }[]).map((x) => ({ ...x, amount: Number(x.amount) })),
    };
    known.current = new Set([next.trip.id, ...next.days.map((d) => d.id), ...next.items.map((i) => i.id), ...next.expenses.map((e) => e.id), ...next.members.map((m) => m.user_id), ...next.stays.map((x) => x.id)]);
    setData(next);
    setError(null);
    setLoading(false);
  }, [tripId]);

  const reloadSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void load(); }, 150);
  }, [load]);

  useEffect(() => {
    void load();
    // Nom unique par écran : la carte et le voyage sont ouverts en même temps et supabase réutilise un canal de même nom (déjà abonné).
    let channel = supabase.channel(`trip-${tripId}-${Math.random().toString(36).slice(2, 10)}`);
    for (const table of TABLES) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Record<string, unknown>;
        if (payload.eventType === 'DELETE') {
          // Les suppressions ne sont pas filtrées par la sécurité par ligne : on ne réagit qu'à nos propres lignes.
          const id = (row.id ?? row.user_id) as string | undefined;
          // trip_destinations n'a pas d'id : sa clé primaire contient trip_id, présent dans l'ancienne ligne.
          if ((id && known.current.has(id)) || row.trip_id === tripId) reloadSoon();
        } else if (row.trip_id === tripId || row.id === tripId) {
          reloadSoon();
        }
      });
    }
    channel.subscribe((s) => {
      if (s === 'SUBSCRIBED') { setStatus('live'); void load(); }   // recharge après une reconnexion : rien de manqué
      else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') setStatus('offline');
    });
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [tripId, load, reloadSoon]);

  return { data, error, loading, status, reload: load };
}

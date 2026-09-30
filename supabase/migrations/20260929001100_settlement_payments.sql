-- Waypoint · migration 1100 : remboursements entre amis
--
-- « Marquer reçu » : quand un ami rembourse une part, on l'enregistre ici. Les soldes de l'écran « Entre amis »
-- en tiennent compte (celui qui rembourse voit sa dette baisser, celui qui reçoit voit sa créance baisser).
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 1000.

create table public.settlement_payments (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  from_user   uuid not null references public.profiles (id) on delete cascade,   -- celui qui rembourse
  to_user     uuid not null references public.profiles (id) on delete cascade,   -- celui qui reçoit
  amount      numeric(12, 2) not null check (amount > 0),
  currency    char(3) not null default 'EUR',
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (from_user <> to_user)
);
create index settlement_payments_trip_idx on public.settlement_payments (trip_id, created_at);

alter table public.settlement_payments enable row level security;
create policy "membres : lecture" on public.settlement_payments for select to authenticated using (public.is_trip_member(trip_id));
create policy "membres : ajout" on public.settlement_payments for insert to authenticated with check (public.is_trip_member(trip_id));
create policy "membres : suppression" on public.settlement_payments for delete to authenticated using (public.is_trip_member(trip_id));
revoke update, truncate on public.settlement_payments from authenticated;
revoke all on public.settlement_payments from anon;

-- Mise à jour en direct chez les autres membres (Supabase uniquement).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'settlement_payments') then
    alter publication supabase_realtime add table public.settlement_payments;
  end if;
end $$;

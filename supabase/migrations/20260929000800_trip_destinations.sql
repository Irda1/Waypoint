-- Waypoint · migration 0800 : destinations d'un voyage
--
-- Un voyage peut avoir plusieurs destinations (villes de la base). Elles servent à proposer
-- directement les bonnes villes dans le sélecteur de lieux, et à illustrer la couverture.
-- Même règle que le reste du voyage : tout membre lit, ajoute et retire, sans rôle.

create table public.trip_destinations (
  trip_id     uuid not null references public.trips (id) on delete cascade,
  city_id     bigint not null references public.cities (id) on delete cascade,
  position    integer not null default 0,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (trip_id, city_id)
);
create index trip_destinations_city_idx on public.trip_destinations (city_id);

alter table public.trip_destinations enable row level security;

create policy "membres : lecture" on public.trip_destinations for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "membres : ajout" on public.trip_destinations for insert to authenticated
  with check (public.is_trip_member(trip_id));
create policy "membres : modification" on public.trip_destinations for update to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy "membres : suppression" on public.trip_destinations for delete to authenticated
  using (public.is_trip_member(trip_id));
revoke all on public.trip_destinations from anon;

-- Temps réel (Supabase uniquement, comme la migration 0600)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_destinations') then
    alter publication supabase_realtime add table public.trip_destinations;
  end if;
end $$;

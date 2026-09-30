-- Waypoint · migration 1300 : réservations du voyage
--
-- Vols, trains, hébergements, billets d'activité : un titre, un numéro de confirmation, une date et une heure,
-- un lien (billet en ligne, PDF hébergé ailleurs) et des notes. Visibles et modifiables par tous les voyageurs.
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 1200.

create table public.trip_bookings (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  kind        text not null default 'autre' check (kind in ('vol', 'train', 'hebergement', 'activite', 'autre')),
  title       text not null check (char_length(title) between 1 and 120),
  reference   text check (char_length(reference) <= 80),
  starts_on   date,
  start_time  text check (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  url         text check (char_length(url) <= 500),
  notes       text check (char_length(notes) <= 1000),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index trip_bookings_trip_idx on public.trip_bookings (trip_id, starts_on);

alter table public.trip_bookings enable row level security;
create policy "membres : lecture" on public.trip_bookings for select to authenticated using (public.is_trip_member(trip_id));
create policy "membres : ajout" on public.trip_bookings for insert to authenticated with check (public.is_trip_member(trip_id));
create policy "membres : modification" on public.trip_bookings for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy "membres : suppression" on public.trip_bookings for delete to authenticated using (public.is_trip_member(trip_id));
revoke truncate on public.trip_bookings from authenticated;
revoke all on public.trip_bookings from anon;

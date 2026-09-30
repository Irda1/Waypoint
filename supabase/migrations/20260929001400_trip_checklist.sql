-- Waypoint · migration 1400 : liste « À ne pas oublier » du voyage
--
-- Bagages, papiers, démarches : des lignes à cocher, partagées entre les voyageurs du voyage.
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 1300.

create table public.trip_checklist (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 120),
  done        boolean not null default false,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index trip_checklist_trip_idx on public.trip_checklist (trip_id, created_at);

alter table public.trip_checklist enable row level security;
create policy "membres : lecture" on public.trip_checklist for select to authenticated using (public.is_trip_member(trip_id));
create policy "membres : ajout" on public.trip_checklist for insert to authenticated with check (public.is_trip_member(trip_id));
create policy "membres : modification" on public.trip_checklist for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy "membres : suppression" on public.trip_checklist for delete to authenticated using (public.is_trip_member(trip_id));
revoke truncate on public.trip_checklist from authenticated;
revoke all on public.trip_checklist from anon;

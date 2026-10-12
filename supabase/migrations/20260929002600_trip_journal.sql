-- Waypoint · migration 2600 : carnet de voyage (une note et des photos par jour)
--
-- Chaque journée reçoit un « Carnet du jour » : une note commune et jusqu'à 12 photos, écrites par les membres du
-- voyage. Tables `trip_journal` (une note par jour) et `trip_photos` (une ligne par photo), réservées aux membres.
-- Les photos sont rangées dans un espace de stockage PRIVÉ « trip-photos », sous `<voyage>/<jour>/<photo>.jpg` :
-- seuls les membres du voyage peuvent les voir ou en ajouter, et chacun ne supprime que les siennes.
-- Taille limitée à 3 Mo par photo (l'appli les réduit à environ 300 Ko avant l'envoi).
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 2500.
-- Sans elle l'appli marche comme avant : le carnet ne s'affiche pas.

-- ---------------------------------------------------------------------------
-- Note du jour
-- ---------------------------------------------------------------------------
create table public.trip_journal (
  day_id      uuid primary key,
  trip_id     uuid not null references public.trips (id) on delete cascade,
  note        text not null default '' check (char_length(note) <= 5000),
  version     integer not null default 1,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (day_id, trip_id) references public.trip_days (id, trip_id) on delete cascade
);
create index trip_journal_trip_idx on public.trip_journal (trip_id);
create trigger trip_journal_meta before insert or update on public.trip_journal
  for each row execute function public.tg_row_meta();

alter table public.trip_journal enable row level security;
create policy "membres : lecture" on public.trip_journal for select to authenticated using (public.is_trip_member(trip_id));
create policy "membres : ajout" on public.trip_journal for insert to authenticated with check (public.is_trip_member(trip_id));
create policy "membres : modification" on public.trip_journal for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy "membres : suppression" on public.trip_journal for delete to authenticated using (public.is_trip_member(trip_id));
revoke truncate on public.trip_journal from authenticated;
revoke all on public.trip_journal from anon;

-- ---------------------------------------------------------------------------
-- Photos du jour (le fichier est dans le stockage « trip-photos », la ligne dit à quel jour il appartient)
-- ---------------------------------------------------------------------------
create table public.trip_photos (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  day_id      uuid not null,
  path        text not null unique check (split_part(path, '/', 1) = trip_id::text and split_part(path, '/', 2) = day_id::text),
  width       integer check (width between 1 and 10000),
  height      integer check (height between 1 and 10000),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  foreign key (day_id, trip_id) references public.trip_days (id, trip_id) on delete cascade
);
create index trip_photos_day_idx on public.trip_photos (trip_id, day_id, created_at);

-- Auteur imposé, et au plus 12 photos par jour.
create or replace function public.tg_trip_photo_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by := auth.uid();
  if (select count(*) from public.trip_photos p where p.day_id = new.day_id) >= 12 then
    raise exception 'Au plus 12 photos par jour.' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trip_photos_insert before insert on public.trip_photos
  for each row execute function public.tg_trip_photo_insert();

alter table public.trip_photos enable row level security;
create policy "membres : lecture" on public.trip_photos for select to authenticated using (public.is_trip_member(trip_id));
create policy "membres : ajout" on public.trip_photos for insert to authenticated with check (public.is_trip_member(trip_id));
create policy "auteur : suppression" on public.trip_photos for delete to authenticated
  using (public.is_trip_member(trip_id) and created_by = (select auth.uid()));
revoke update, truncate on public.trip_photos from authenticated;
revoke all on public.trip_photos from anon;

-- Temps réel (Supabase uniquement, comme la migration 0600)
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['trip_journal', 'trip_photos'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Stockage privé des photos : « trip-photos/<voyage>/<jour>/<photo>.jpg »
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-photos', 'trip-photos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Le premier dossier du chemin est l'identifiant du voyage ; un chemin qui n'en est pas un ne donne aucun droit.
create or replace function public.photo_trip_member(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_trip_member(split_part(p_name, '/', 1)::uuid)
    else false
  end
$$;
revoke all on function public.photo_trip_member(text) from public, anon;
grant execute on function public.photo_trip_member(text) to authenticated;

create policy "photos de voyage : lecture" on storage.objects for select to authenticated
  using (bucket_id = 'trip-photos' and public.photo_trip_member(name));
create policy "photos de voyage : ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-photos' and public.photo_trip_member(name));
create policy "photos de voyage : suppression de ses photos" on storage.objects for delete to authenticated
  using (bucket_id = 'trip-photos' and owner_id = (select auth.uid())::text and public.photo_trip_member(name));
